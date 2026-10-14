
import { replaceByFormula, getFormulaStr, evaluateFormula } from "@common/utils/formula";
import { CompiledFormula } from "../column-definition";

export type SubFormFormulaCompilerOptions = {
  resolveExternalValue?: (widgetUid: string) => unknown;
  resolveEmptyValue?: (referenceId: string) => unknown;
};

export function createSubFormFormulaCompiler(options: SubFormFormulaCompilerOptions = {}) {
  return function compileFormula(
    formulaStr: string,
    widgetUid: string,
    fieldId: string,
    widgetUidToFieldId: Map<string, string>,
  ): CompiledFormula {
    const rawFormula = getFormulaStr(formulaStr);
    const references = extractFormulaReferences(rawFormula, widgetUidToFieldId);

    const toFormulaValue = (referenceId: string, value: unknown) => {
      if (value === undefined || value === null) {
        return options.resolveEmptyValue?.(referenceId) ?? null;
      }
      return value;
    };

    return {
      dependencies: references.rowFields,
      externalDependencies: references.externalWidgets,
      evaluate: (ctx) => {
        const { row, store } = ctx as any;
        const resolveReference = (uid: string) => {
          const targetFieldId = widgetUidToFieldId.get(uid);
          if (targetFieldId) {
            return toFormulaValue(targetFieldId, store.getValue({ rowId: row.id, fieldId: targetFieldId }));
          }
          return options.resolveExternalValue ? toFormulaValue(uid, options.resolveExternalValue(uid)) : null;
        };
        const substituted = replaceByFormula(rawFormula, keys => resolveReference(keys[keys.length - 1]) as any);

        try {
          return evaluateFormula(substituted);
        } catch {
          return undefined;
        }
      },
    };
  };
}

const SUBFORM_FIELD_REFERENCE = /\[\[([a-zA-Z0-9._:-]+)(?:,[^\]]*)?\]\]/g;

function extractFormulaReferences(
  formulaStr: string,
  widgetUidToFieldId: Map<string, string>,
): { rowFields: string[]; externalWidgets: string[] } {
  const rowFields = new Set<string>();
  const externalWidgets = new Set<string>();
  if (!formulaStr) return { rowFields: [], externalWidgets: [] };
  const matches = formulaStr.matchAll(SUBFORM_FIELD_REFERENCE);
  for (const match of matches) {
    const reference = match[1].split(',')[0].trim().split('.');
    const uid = reference[reference.length - 1];
    const fieldId = widgetUidToFieldId.get(uid);
    if (fieldId) rowFields.add(fieldId);
    else externalWidgets.add(uid);
  }
  return { rowFields: [...rowFields], externalWidgets: [...externalWidgets] };
}
