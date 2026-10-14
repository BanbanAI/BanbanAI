import { ColumnDefinition, CellReadContext } from "./column-definition";
import { RowStore } from "./row-store";
import { CellAddress, RowId } from "./types";

export type ValidationError = {
  readonly address: CellAddress;
  readonly message: string;
};

export type ValidationSummary = {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
};

const defaultRequiredMessage = "This field is required";
const isEmptyValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return true;
  return Array.isArray(value) && value.length === 0;
};

export type ValidationEngineOptions = {
  readonly requiredMessage?: string | (() => string);
};

export class ValidationEngine {
  constructor(
    private readonly store: RowStore,
    private readonly columns: readonly ColumnDefinition[],
    private readonly services: unknown = undefined,
    private readonly options: ValidationEngineOptions = {},
  ) {}

  private resolveRequiredMessage(): string {
    const source = this.options.requiredMessage;
    if (typeof source === "function") return source();
    return source || defaultRequiredMessage;
  }

  async validate(rowIds: readonly RowId[] = this.store.rowIds): Promise<ValidationSummary> {
    const errors: ValidationError[] = [];
    const uniqueColumns = this.columns.filter(column => column.unique);
    const uniqueValues = new Map<string, Map<string, RowId[]>>();
    this.clearCellErrors(rowIds);

    const pushError = (address: CellAddress, message: string) => {
      errors.push({ address, message });
      this.store.ensureCellState(address).error = message;
    };

    for (const column of uniqueColumns) uniqueValues.set(column.fieldId, new Map());
    for (const rowId of rowIds) {
      const row = this.store.getRow(rowId);
      if (!row) continue;
      for (const column of this.columns) {
        const address = { rowId, fieldId: column.fieldId };
        const context = this.createContext(address);
        if (column.adapter.isVisible && !column.adapter.isVisible(context)) continue;
        const value = this.store.getValue(address);
        if (column.adapter.isRequired?.(context) && isEmptyValue(value)) {
          pushError(address, column.adapter.emptyRequiredMessage?.(context) || this.resolveRequiredMessage());
          continue;
        }
        if (column.adapter.validate) {
          const result = await column.adapter.validate(context);
          if (result.valid === false) pushError(address, result.message);
        }
        if (column.unique && !isEmptyValue(value)) {
          const key = this.normalizeUniqueValue(value);
          const values = uniqueValues.get(column.fieldId)!;
          const owners = values.get(key) || [];
          owners.push(rowId);
          values.set(key, owners);
        }
      }
    }

    for (const column of uniqueColumns) {
      for (const rowIdsWithValue of uniqueValues.get(column.fieldId)!.values()) {
        if (rowIdsWithValue.length < 2) continue;
        for (const rowId of rowIdsWithValue) {
          pushError({ rowId, fieldId: column.fieldId }, "Duplicate value");
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private clearCellErrors(rowIds: readonly RowId[]) {
    for (const rowId of rowIds) {
      for (const column of this.columns) {
        const state = this.store.getCellState({ rowId, fieldId: column.fieldId });
        if (state?.error) state.error = undefined;
      }
    }
  }

  private createContext(address: CellAddress): CellReadContext {
    return {
      address,
      row: this.store.getRow(address.rowId)!,
      store: this.store,
      services: this.services,
    };
  }

  private normalizeUniqueValue(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }
}
