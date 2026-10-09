import type { Field } from "@common/types/project";
import {
  collectFormulaFieldUsages,
  replaceByFormula,
  replaceColFieldsByFormula,
} from "@common/utils/formula";

type FormulaFieldUsage = ReturnType<typeof collectFormulaFieldUsages> extends Map<string, infer Usages>
  ? Usages extends Array<infer Usage>
    ? Usage
    : never
  : never;

export type ResolvedFormulaFieldValue = {
  field?: Pick<Field, "type">;
  scalar: unknown;
  column: unknown[];
  isCollection?: boolean;
};

const replaceEmptyValue = (field?: Pick<Field, "type">) => {
  switch (field?.type) {
  case "number":
    return 0;
  case "array":
    return [];
  case "object":
    return {};
  case "string":
    return "";
  default:
    return undefined;
  }
};

const normalizeBlankValue = (
  value: unknown,
  resolved: ResolvedFormulaFieldValue,
  usage?: FormulaFieldUsage,
  isColumn = false,
) => {
  if (usage?.formula?.ignoreBlankReplace) return value;

  const normalize = (item: unknown) => {
    if (item !== null && item !== undefined) return item;
    const emptyValue = replaceEmptyValue(resolved.field);
    return emptyValue === undefined ? item : emptyValue;
  };

  if (Array.isArray(value) && (isColumn || resolved.isCollection)) {
    return value.map(normalize);
  }
  return normalize(value);
};

const isColumnUsage = (usage?: FormulaFieldUsage) => {
  const argOfNotTableCol = usage?.formula?.argOfNotTableCol;
  if (!Array.isArray(argOfNotTableCol) || usage?.argIndex === null || usage?.argIndex === undefined) {
    return false;
  }

  const scalarArgIndexes = argOfNotTableCol.map(index =>
    index < 0 ? usage.argsLength + index : index
  );
  return !scalarArgIndexes.includes(usage.argIndex);
};

const asFormulaReplacement = (value: unknown) => value as string;

export const replaceFormulaFieldValues = (
  formula: string,
  valueMap: Map<string, ResolvedFormulaFieldValue>,
) => {
  const usageMap = collectFormulaFieldUsages(formula);
  const usageCursors = {
    column: {} as Record<string, number>,
    scalar: {} as Record<string, number>,
  };

  const getNextUsage = (id: string, column: boolean) => {
    const mode = column ? "column" : "scalar";
    const usages = (usageMap.get(id) || []).filter(usage => isColumnUsage(usage) === column);
    const index = usageCursors[mode][id] ?? 0;
    usageCursors[mode][id] = index + 1;
    return usages[index];
  };

  let replaced = replaceColFieldsByFormula(formula, keys => {
    const id = keys.join(".");
    const resolved = valueMap.get(id);
    if (!resolved) return [];
    return normalizeBlankValue(resolved.column, resolved, getNextUsage(id, true), true);
  });

  replaced = replaceByFormula(replaced, keys => {
    const id = keys.join(".");
    const resolved = valueMap.get(id);
    if (!resolved) return asFormulaReplacement(undefined);
    return asFormulaReplacement(
      normalizeBlankValue(resolved.scalar, resolved, getNextUsage(id, false))
    );
  });

  return replaced;
};

export const resolveFormulaDisplayValue = <T>(result: T | undefined, storedValue: T) => {
  return result === undefined ? storedValue : result;
};
