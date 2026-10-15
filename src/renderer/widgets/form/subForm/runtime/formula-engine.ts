import { ColumnDefinition, FormulaContext } from "./column-definition";
import { RowStore } from "./row-store";
import { ChangeSet, RowId } from "./types";

type FormulaEvaluationContext = Omit<FormulaContext, "store"> & {
  store: RowStore;
};

export class FormulaEngine {
  private readonly formulas = new Map<string, ColumnDefinition>();
  private readonly dependents = new Map<string, Set<string>>();
  private readonly order: string[];
  private readonly stopListening: () => boolean;
  private pendingRecompute: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(
    private readonly store: RowStore,
    columns: readonly ColumnDefinition[],
    private readonly services: unknown = undefined,
  ) {
    for (const column of columns) {
      if (!column.formula) continue;
      this.formulas.set(column.fieldId, column);
      for (const dependency of column.formula.dependencies) {
        let dependents = this.dependents.get(dependency);
        if (!dependents) {
          dependents = new Set();
          this.dependents.set(dependency, dependents);
        }
        dependents.add(column.fieldId);
      }
    }
    this.order = this.resolveEvaluationOrder();
    this.stopListening = store.subscribe(changeSet => {
      if (
        changeSet.changes.length
        && changeSet.changes.every(change => change.source === "deduplication")
      ) return;
      if (
        !changeSet.addedRows.length
        && changeSet.changes.length
        && changeSet.changes.every(change => change.source === "formula")
      ) return;
      const run = this.pendingRecompute
        .catch(() => undefined)
        .then(() => this.recompute(changeSet));
      this.pendingRecompute = run;
      void run.catch(() => undefined);
    });
  }

  get formulaFields(): readonly string[] {
    return this.order.slice();
  }

  async recomputeAll(rowIds: readonly RowId[] = this.store.rowIds, options: { onlyMissing?: boolean } = {}) {
    if (this.disposed || !this.formulas.size || !rowIds.length) return;
    const onlyMissing = options.onlyMissing === true;
    await this.store.transact(tx => {
      for (const fieldId of this.order) {
        const column = this.formulas.get(fieldId)!;
        for (const rowId of rowIds) {
          const row = this.store.getRow(rowId);
          if (!row) continue;
          if (onlyMissing && this.store.getValue({ rowId, fieldId }) !== undefined) continue;
          const nextValue = this.evaluate(column, rowId);
          if (!Object.is(this.store.getValue({ rowId, fieldId }), nextValue)) {
            tx.setValue({ rowId, fieldId }, nextValue, "formula");
          }
        }
      }
    });
  }

  async flush() {
    let pending: Promise<void>;
    do {
      pending = this.pendingRecompute;
      await pending;
    } while (pending !== this.pendingRecompute);
  }

  dispose() {
    this.disposed = true;
    this.stopListening();
  }

  private async recompute(changeSet: ChangeSet) {
    if (this.disposed) return;
    const affectedFields = changeSet.addedRows.length
      ? new Set(this.formulas.keys())
      : this.resolveAffectedFields(changeSet.changedFields);
    if (!affectedFields.size) return;
    await this.store.transact(tx => {
      for (const fieldId of this.order) {
        if (!affectedFields.has(fieldId)) continue;
        const column = this.formulas.get(fieldId)!;
        for (const rowId of changeSet.changedRows) {
          const row = this.store.getRow(rowId);
          if (!row) continue;
          const nextValue = this.evaluate(column, rowId);
          if (!Object.is(this.store.getValue({ rowId, fieldId }), nextValue)) {
            tx.setValue({ rowId, fieldId }, nextValue, "formula");
          }
        }
      }
    });
  }

  private evaluate(column: ColumnDefinition, rowId: RowId) {
    const row = this.store.getRow(rowId)!;
    const address = { rowId, fieldId: column.fieldId };
    return column.formula!.evaluate({
      address,
      row,
      store: this.store,
      services: this.services,
      getValue: fieldId => this.store.getValue({ rowId, fieldId }),
    } as FormulaEvaluationContext);
  }

  private resolveAffectedFields(changedFields: readonly string[]) {
    const affected = new Set<string>();
    const pending = [...changedFields];
    while (pending.length) {
      const fieldId = pending.shift()!;
      for (const dependent of this.dependents.get(fieldId) || []) {
        if (affected.has(dependent)) continue;
        affected.add(dependent);
        pending.push(dependent);
      }
    }
    return affected;
  }

  private resolveEvaluationOrder() {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const order: string[] = [];
    const visit = (fieldId: string) => {
      if (visited.has(fieldId)) return;
      if (visiting.has(fieldId)) throw new Error(`Formula dependency cycle at ${fieldId}`);
      visiting.add(fieldId);
      const formula = this.formulas.get(fieldId)?.formula;
      for (const dependency of formula?.dependencies || []) {
        if (this.formulas.has(dependency)) visit(dependency);
      }
      visiting.delete(fieldId);
      visited.add(fieldId);
      order.push(fieldId);
    };
    for (const fieldId of this.formulas.keys()) visit(fieldId);
    return order;
  }
}
