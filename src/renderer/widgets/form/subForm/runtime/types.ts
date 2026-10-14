export type RowId = string;
export type FieldId = string;

export type CellAddress = {
  rowId: RowId;
  fieldId: FieldId;
};

export type CellState = {
  draftValue?: unknown;
  touched?: boolean;
  error?: string;
  loading?: boolean;
  requestVersion?: number;
};

export type RowContext = {
  readonly id: RowId;
  readonly data: Readonly<Record<string, unknown>>;
  readonly revision: number;
  readonly dirtyFields: ReadonlySet<FieldId>;
};

export type ChangeSource =
  | "user"
  | "selectData"
  | "formula"
  | "linkage"
  | "import"
  | "default"
  | "deduplication";

export type CellChange = {
  readonly address: CellAddress;
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly source: ChangeSource;
  readonly transactionId: string;
};

export type ChangeSet = {
  readonly transactionId: string;
  readonly changes: readonly CellChange[];
  readonly changedRows: readonly RowId[];
  readonly changedFields: readonly FieldId[];
  readonly addedRows: readonly RowId[];
  readonly deletedRows: readonly RowId[];
};

export type RowPatch = {
  readonly rowId: RowId;
  readonly values: Readonly<Record<FieldId, unknown>>;
};

export type RowStoreListener = (changeSet: ChangeSet) => void;

export type RowTransaction = {
  setValue(address: CellAddress, value: unknown, source?: ChangeSource): void;
  patchRow(patch: RowPatch, source?: ChangeSource): void;
  addRow(rowId: RowId, values?: Readonly<Record<FieldId, unknown>>, source?: ChangeSource, index?: number): void;
  deleteRow(rowId: RowId, source?: ChangeSource): void;
};
