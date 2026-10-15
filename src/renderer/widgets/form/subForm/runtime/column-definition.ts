import { CellAddress, RowContext } from "./types";

export type CellReadContext = {
  readonly address: CellAddress;
  readonly row: RowContext;
  readonly store: unknown;
  readonly services?: unknown;
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export type FormulaContext = CellReadContext & {
  getValue(fieldId: string): unknown;
};

export type CompiledFormula = {
  readonly dependencies: readonly string[];
  readonly externalDependencies?: readonly string[];
  evaluate(ctx: FormulaContext): unknown;
};

export type FieldAdapter = {
  format(ctx: CellReadContext): unknown;
  formatEditor?(ctx: CellReadContext): unknown;
  parse(value: unknown, ctx: CellReadContext): unknown;
  validate?(ctx: CellReadContext): ValidationResult | Promise<ValidationResult>;
  isVisible?(ctx: CellReadContext): boolean;
  isReadonly?(ctx: CellReadContext): boolean;
  isRequired?(ctx: CellReadContext): boolean;
  emptyRequiredMessage?(ctx: CellReadContext): string | undefined;
};

export type ColumnDefinition = {
  readonly id: string;
  readonly fieldId: string;
  readonly type: string;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly adapter: FieldAdapter;
  readonly dependencies: readonly string[];
  readonly formula?: CompiledFormula;
  readonly unique?: boolean;
};

export const createDefaultFieldAdapter = (): FieldAdapter => ({
  format: ({ row, address }) => row.data[address.fieldId],
  parse: value => value,
  isVisible: () => true,
  isReadonly: () => false,
  isRequired: () => false,
});

export const freezeColumnDefinition = (definition: ColumnDefinition): ColumnDefinition => {
  Object.freeze(definition.dependencies);
  Object.freeze(definition.schema);
  return Object.freeze(definition);
};
