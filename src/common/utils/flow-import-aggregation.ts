import type { Field, Row, TableUID } from "@common/types/project";
import { createFormulaRuntimeByData, evaluateFormulaWithRuntime } from "@common/utils/formula";

/**
 * Evaluates the worker-safe part of an import aggregation. Database reads and
 * writes stay outside this function so it can run in a Tinypool worker.
 */
export function evaluateImportBatchAggregationFormula(
  formula: string,
  sourceRows: Row[],
  sourceTableUID: TableUID,
  currentRow: Row,
  sourceFields: Field[],
): unknown | undefined {
  let hasSourceReference = false;
  let hasUnsupportedReference = false;
  const formulaWithValues = formula.replaceAll(/\[\[(.*?)\]\]/g, (_token, content: string) => {
    const [referenceTableUID, fieldUID, subFieldUID] = content?.split(",")?.[0]?.split(".") || [];
    if (referenceTableUID !== sourceTableUID || !sourceFields.some(field => field.uid === fieldUID)) {
      hasUnsupportedReference = true;
      return "null";
    }

    hasSourceReference = true;
    const values = sourceRows.flatMap(sourceRow => {
      const fieldValue = sourceRow?.[fieldUID];
      if (subFieldUID) {
        return Array.isArray(fieldValue)
          ? fieldValue.map(subRow => subRow?.[subFieldUID])
          : [];
      }
      return [fieldValue];
    });
    return JSON.stringify(values);
  });

  if (!hasSourceReference || hasUnsupportedReference) return undefined;

  try {
    const formulaRuntime = createFormulaRuntimeByData(currentRow, sourceFields);
    const result = evaluateFormulaWithRuntime(formulaWithValues, formulaRuntime);
    if (Array.isArray(result)) return undefined;
    return result;
  } catch {
    return undefined;
  }
}
