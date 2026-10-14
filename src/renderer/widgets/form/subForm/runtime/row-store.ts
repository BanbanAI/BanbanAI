import {
  CellAddress,
  CellState,
  ChangeSet,
  ChangeSource,
  FieldId,
  RowContext,
  RowId,
  RowPatch,
  RowStoreListener,
  RowTransaction,
} from "./types";

type MutableRow = {
  id: RowId;
  data: Record<string, unknown>;
  revision: number;
  dirtyFields: Set<FieldId>;
  context?: RowContext;
};

type PendingChange = {
  address: CellAddress;
  oldValue: unknown;
  newValue: unknown;
  source: ChangeSource;
};

type PendingStructureChange = {
  addedRows: Set<RowId>;
  deletedRows: Set<RowId>;
};

type StoreSnapshot = {
  rows: Map<RowId, MutableRow>;
  order: RowId[];
  cellStates: Map<string, CellState>;
};

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const cellKey = ({ rowId, fieldId }: CellAddress) => `${rowId}\u0000${fieldId}`;
const cloneValue = <T>(value: T): T => {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map(item => cloneValue(item)) as T;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = cloneValue(item);
  }
  return result as T;
};
const freezeValue = <T>(value: T): T => {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value as Record<string, unknown>)) freezeValue(item);
  return Object.freeze(value);
};
const cloneValues = (values: Readonly<Record<string, unknown>>) => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) result[key] = freezeValue(cloneValue(value));
  return result;
};

export class RowStore {
  private readonly rows = new Map<RowId, MutableRow>();
  private readonly order: RowId[] = [];
  private readonly cellStates = new Map<string, CellState>();
  private readonly listeners = new Set<RowStoreListener>();
  private transactionDepth = 0;
  private activeChanges: Map<string, PendingChange> | undefined;
  private activeStructureChanges: PendingStructureChange | undefined;
  private activeTransactionId: string | undefined;
  private activeSnapshot: StoreSnapshot | undefined;
  private transactionQueue: Promise<void> = Promise.resolve();

  constructor(initialRows: readonly RowPatch[] = []) {
    for (const row of initialRows) {
      this.addRowInternal(row.rowId, row.values);
    }
  }

  get size() {
    return this.order.length;
  }

  get rowIds(): readonly RowId[] {
    return this.order.slice();
  }

  get cellStateCount() {
    return this.cellStates.size;
  }

  getRow(rowId: RowId): RowContext | undefined {
    const row = this.rows.get(rowId);
    if (!row) return undefined;
    return this.toContext(row);
  }

  getValue(address: CellAddress) {
    const row = this.rows.get(address.rowId);
    if (!row || !hasOwn(row.data, address.fieldId)) return undefined;
    const value = row.data[address.fieldId];
    return value instanceof Date ? new Date(value.getTime()) : value;
  }

  getCellState(address: CellAddress): CellState | undefined {
    return this.cellStates.get(cellKey(address));
  }

  ensureCellState(address: CellAddress): CellState {
    const key = cellKey(address);
    let state = this.cellStates.get(key);
    if (!state) {
      state = {};
      this.cellStates.set(key, state);
    }
    return state;
  }

  releaseCellState(address: CellAddress) {
    this.cellStates.delete(cellKey(address));
  }

  subscribe(listener: RowStoreListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async transact<T>(fn: (transaction: RowTransaction) => T | Promise<T>): Promise<T> {
    if (this.transactionDepth > 0) {
      throw new Error("Nested RowStore transactions are not supported; use the current transaction");
    }
    let resolveResult!: (value: T | PromiseLike<T>) => void;
    let rejectResult!: (reason?: unknown) => void;
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    const run = this.transactionQueue.then(async () => {
      try {
        resolveResult(await this.executeTransaction(fn));
      } catch (error) {
        rejectResult(error);
      }
    });
    this.transactionQueue = run.then(() => undefined, () => undefined);
    return result;
  }

  async whenIdle(): Promise<void> {
    await this.transactionQueue;
  }

  private async executeTransaction<T>(fn: (transaction: RowTransaction) => T | Promise<T>): Promise<T> {
    const isOuterTransaction = this.transactionDepth === 0;
    if (isOuterTransaction) {
      this.activeChanges = new Map();
      this.activeStructureChanges = { addedRows: new Set(), deletedRows: new Set() };
      this.activeTransactionId = createTransactionId();
      this.activeSnapshot = this.createSnapshot();
    }
    this.transactionDepth += 1;

    try {
      const transaction = this.createTransaction();
      const result = await fn(transaction);
      this.transactionDepth -= 1;
      if (isOuterTransaction) this.commitActiveTransaction();
      return result;
    } catch (error) {
      this.transactionDepth -= 1;
      if (isOuterTransaction) this.rollbackActiveTransaction();
      throw error;
    }
  }

  snapshot(): readonly Record<string, unknown>[] {
    return this.order.map(rowId => ({
      ...cloneValues(this.rows.get(rowId)?.data || {}),
      __rowId: rowId,
    }));
  }

  assertInTransaction() {
    if (this.transactionDepth === 0) throw new Error("RowStore writes must happen inside transact()");
  }

  private createTransaction(): RowTransaction {
    return {
      setValue: (address, value, source = "user") => this.setValueInternal(address, value, source),
      patchRow: (patch, source = "user") => {
        for (const [fieldId, value] of Object.entries(patch.values)) {
          this.setValueInternal({ rowId: patch.rowId, fieldId }, value, source);
        }
      },
      addRow: (rowId, values = {}, source = "default", index) => {
        this.addRowInternal(rowId, values, index);
        const wasDeleted = this.activeStructureChanges?.deletedRows.delete(rowId);
        if (!wasDeleted || !this.activeSnapshot?.rows.has(rowId)) {
          this.activeStructureChanges?.addedRows.add(rowId);
        }
        for (const [fieldId, value] of Object.entries(values)) {
          this.recordChange({ rowId, fieldId }, undefined, value, source);
        }
      },
      deleteRow: (rowId, source = "user") => {
        const row = this.rows.get(rowId);
        if (!row) return;
        for (const fieldId of Object.keys(row.data)) {
          this.recordChange({ rowId, fieldId }, row.data[fieldId], undefined, source);
        }
        this.rows.delete(rowId);
        if (this.activeStructureChanges?.addedRows.delete(rowId)) {
          this.activeStructureChanges.deletedRows.delete(rowId);
        } else {
          this.activeStructureChanges?.deletedRows.add(rowId);
        }
        const index = this.order.indexOf(rowId);
        if (index >= 0) this.order.splice(index, 1);
        for (const key of this.cellStates.keys()) {
          if (key.startsWith(`${rowId}\u0000`)) this.cellStates.delete(key);
        }
      },
    };
  }

  private addRowInternal(rowId: RowId, values: Readonly<Record<string, unknown>> = {}, index?: number) {
    if (this.rows.has(rowId)) throw new Error(`Row already exists: ${rowId}`);
    this.rows.set(rowId, { id: rowId, data: cloneValues(values), revision: 0, dirtyFields: new Set() });
    if (index === undefined || index < 0 || index >= this.order.length) {
      this.order.push(rowId);
    } else {
      this.order.splice(index, 0, rowId);
    }
  }

  private setValueInternal(address: CellAddress, value: unknown, source: ChangeSource) {
    this.assertInTransaction();
    const row = this.rows.get(address.rowId);
    if (!row) throw new Error(`Unknown row: ${address.rowId}`);
    const oldValue = hasOwn(row.data, address.fieldId) ? row.data[address.fieldId] : undefined;
    if (Object.is(oldValue, value)) return;
    if (value === undefined) delete row.data[address.fieldId];
    else row.data[address.fieldId] = freezeValue(cloneValue(value));
    row.context = undefined;
    row.dirtyFields.add(address.fieldId);
    this.recordChange(address, oldValue, value, source);
  }

  private recordChange(address: CellAddress, oldValue: unknown, newValue: unknown, source: ChangeSource) {
    if (!this.activeChanges || !this.activeTransactionId) {
      throw new Error("RowStore writes must happen inside transact()");
    }
    const key = cellKey(address);
    const current = this.activeChanges.get(key);
    if (current) {
      current.newValue = newValue;
      current.source = source;
      return;
    }
    this.activeChanges.set(key, { address, oldValue, newValue, source });
  }

  private commitActiveTransaction() {
    const changes = [...(this.activeChanges?.values() || [])]
      .filter(change => !Object.is(change.oldValue, change.newValue));
    const addedRows = [...(this.activeStructureChanges?.addedRows || [])];
    const deletedRows = [...(this.activeStructureChanges?.deletedRows || [])];
    const changedRows = new Set<RowId>();
    const changedFields = new Set<FieldId>();
    for (const change of changes) {
      changedRows.add(change.address.rowId);
      changedFields.add(change.address.fieldId);
    }
    for (const rowId of addedRows) changedRows.add(rowId);
    for (const rowId of deletedRows) changedRows.add(rowId);
    for (const rowId of [...changedRows, ...addedRows, ...deletedRows]) {
      const row = this.rows.get(rowId);
      if (row) {
        row.revision += 1;
        row.context = undefined;
      }
    }
    if (changes.length || addedRows.length || deletedRows.length) {
      const changeSet: ChangeSet = {
        transactionId: this.activeTransactionId!,
        changes: changes.map(change => ({ ...change, address: { ...change.address }, transactionId: this.activeTransactionId! })),
        changedRows: [...changedRows],
        changedFields: [...changedFields],
        addedRows,
        deletedRows,
      };
      for (const listener of [...this.listeners]) listener(changeSet);
    }
    this.clearTransactionState();
  }

  private rollbackActiveTransaction() {
    if (this.activeSnapshot) {
      this.rows.clear();
      for (const [rowId, row] of this.activeSnapshot.rows) {
        this.rows.set(rowId, { ...row, data: cloneValues(row.data), dirtyFields: new Set(row.dirtyFields), context: undefined });
      }
      this.order.splice(0, this.order.length, ...this.activeSnapshot.order);
      this.cellStates.clear();
      for (const [key, state] of this.activeSnapshot.cellStates) this.cellStates.set(key, { ...state });
    }
    this.clearTransactionState();
  }

  private createSnapshot(): StoreSnapshot {
    return {
      rows: new Map([...this.rows].map(([rowId, row]) => [rowId, { ...row, data: cloneValues(row.data), dirtyFields: new Set(row.dirtyFields), context: undefined }])),
      order: this.order.slice(),
      cellStates: new Map([...this.cellStates].map(([key, state]) => [key, { ...state }])),
    };
  }

  private clearTransactionState() {
    this.activeChanges = undefined;
    this.activeStructureChanges = undefined;
    this.activeTransactionId = undefined;
    this.activeSnapshot = undefined;
  }

  private toContext(row: MutableRow): RowContext {
    if (row.context) return row.context;
    row.context = {
      id: row.id,
      data: Object.freeze({ ...row.data }),
      revision: row.revision,
      dirtyFields: new Set(row.dirtyFields),
    };
    return row.context;
  }
}

let transactionSequence = 0;
const createTransactionId = () => `subform-tx-${Date.now()}-${transactionSequence += 1}`;
