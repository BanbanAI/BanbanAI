import { AggregateDefinition, AggregateIndex } from "./aggregate-index";
import { CellRuntimeRegistry } from "./cell-runtime";
import { RuntimeAsyncService } from "./async-service";
import { ColumnDefinition } from "./column-definition";
import { FormulaEngine } from "./formula-engine";
import { LinkageEngine, LinkageRule } from "./linkage-engine";
import { RowStore } from "./row-store";
import { ValidationEngine, ValidationSummary } from "./validation-engine";
import { ChangeSource, RowPatch, RowId } from "./types";

export type SubFormRuntimeOptions = {
  readonly columns: readonly ColumnDefinition[];
  readonly aggregates?: readonly AggregateDefinition[];
  readonly linkageRules?: readonly LinkageRule[];
  readonly linkageConcurrency?: number;
  readonly services?: unknown;
  readonly requiredMessage?: string | (() => string);
};

export class SubFormRuntime {
  readonly store: RowStore;
  readonly formulaEngine: FormulaEngine;
  readonly aggregateIndex: AggregateIndex;
  readonly validationEngine: ValidationEngine;
  readonly linkageEngine: LinkageEngine;
  readonly cellRuntime: CellRuntimeRegistry;
  readonly asyncService: RuntimeAsyncService;
  private disposed = false;

  constructor(options: SubFormRuntimeOptions, initialRows: readonly RowPatch[] = []) {
    this.store = new RowStore(initialRows);
    this.formulaEngine = new FormulaEngine(this.store, options.columns, options.services);
    this.aggregateIndex = new AggregateIndex(this.store, options.aggregates || []);
    this.validationEngine = new ValidationEngine(this.store, options.columns, options.services, {
      requiredMessage: options.requiredMessage,
    });
    this.linkageEngine = new LinkageEngine(this.store, options.linkageRules || [], {
      concurrency: options.linkageConcurrency,
    });
    this.cellRuntime = new CellRuntimeRegistry(this.store);
    this.asyncService = new RuntimeAsyncService(this.store);
  }

  async replaceRows(rows: readonly Readonly<Record<string, unknown>>[], source: ChangeSource = "selectData") {
    this.assertActive();
    const existing = new Set(this.store.rowIds);
    for (const rowId of existing) this.asyncService.invalidateRow(rowId);
    const patches = rows.map(row => ({
      rowId: String(row.__rowId || createRuntimeRowId()),
      values: Object.fromEntries(Object.entries(row).filter(([key]) => key !== "__rowId")),
    }));
    await this.store.transact(tx => {
      for (const rowId of existing) tx.deleteRow(rowId, source);
      for (const patch of patches) tx.addRow(patch.rowId, patch.values, source);
    });
    if (source === "deduplication") return;
    await this.formulaEngine.flush();
    await this.formulaEngine.recomputeAll(patches.map(patch => patch.rowId));
  }

  async patchRows(patches: readonly RowPatch[], source: ChangeSource = "selectData") {
    this.assertActive();
    await this.store.transact(tx => {
      for (const patch of patches) tx.patchRow(patch, source);
    });
    await this.formulaEngine.flush();
  }

  async addRow(
    values: Readonly<Record<string, unknown>> = {},
    source: "user" | "default" = "user",
    rowId = createRuntimeRowId(),
    index?: number,
  ) {
    this.assertActive();
    await this.store.transact(tx => tx.addRow(rowId, values, source, index));
    await this.formulaEngine.flush();
    return rowId;
  }

  async addRows(
    rows: readonly Readonly<Record<string, unknown>>[],
    source: ChangeSource = "import",
    index?: number,
  ) {
    this.assertActive();
    if (!rows.length) return [] as RowId[];
    const rowIds = rows.map(row => String(row.__rowId || createRuntimeRowId()));
    await this.store.transact(tx => {
      rows.forEach((row, rowIndex) => {
        const values = Object.fromEntries(
          Object.entries(row).filter(([key]) => key !== "__rowId"),
        );
        tx.addRow(rowIds[rowIndex], values, source, index === undefined ? undefined : index + rowIndex);
      });
    });
    await this.formulaEngine.flush();
    return rowIds;
  }

  async deleteRows(rowIds: readonly RowId[]) {
    this.assertActive();
    for (const rowId of rowIds) this.asyncService.invalidateRow(rowId);
    await this.store.transact(tx => {
      for (const rowId of rowIds) tx.deleteRow(rowId);
    });
  }

  snapshot() {
    this.assertActive();
    return this.store.snapshot();
  }

  validate(rowIds?: readonly RowId[]): Promise<ValidationSummary> {
    this.assertActive();
    return this.validationEngine.validate(rowIds);
  }

  flush() {
    this.assertActive();
    return this.linkageEngine.flush();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.formulaEngine.dispose();
    this.aggregateIndex.dispose();
    this.linkageEngine.dispose();
    this.cellRuntime.dispose();
    this.asyncService.dispose();
  }

  private assertActive() {
    if (this.disposed) throw new Error("SubFormRuntime has been disposed");
  }
}

let runtimeRowSequence = 0;
const createRuntimeRowId = () => `subform-row-${Date.now()}-${runtimeRowSequence += 1}`;
