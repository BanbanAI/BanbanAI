import type { Field, Table } from "@common/types/project";
import {
  FORMULA_RECORD_COUNT_FIELD_ALIAS,
  FORMULA_RECORD_COUNT_FIELD_UID,
  formulaList as sharedFormulaList,
  isHistoryTableUID,
} from "@common/utils/formula";
import { buildFormulaFieldToken, getFormulaTokenFieldUID, isFormulaHiddenField } from "./utils";

export type DefaultFormulaFieldSourceType = "current-row" | "current-history" | "linked-table" | "other-table";

export type DefaultFormulaFieldContext = {
  token: string;
  title: string;
  valueType: string;
  sourceType: DefaultFormulaFieldSourceType;
  disabled?: boolean;
  disabledReason?: string;
};

export type DefaultFormulaFunctionContext = {
  name: string;
  category: string;
  kind: "normal" | "column" | "context";
  usage?: string;
  defaultArgTail?: string;
  summary?: string;
};

type FormulaTableLike = Table & {
  linkedForm?: string;
  formulaAlias?: string;
  name?: string;
};

type FormulaFieldLike = Field & {
  subTableFields?: FormulaFieldLike[];
};

type DisabledFieldMap = Record<string, {
  title: string;
}>;

type BuildDefaultFormulaAiContextParams = {
  widgetId: string;
  widgetTitle: string;
  currentFormula: string;
  rules?: string[];
  fieldList: DefaultFormulaFieldContext[];
  formulaList: DefaultFormulaFunctionContext[];
};

type BuildDefaultFormulaFieldListParams = {
  currentTables: FormulaTableLike[];
  linkedTables: FormulaTableLike[];
  otherTables: FormulaTableLike[];
  disabledFieldMap?: DisabledFieldMap;
};

type BuildDefaultFormulaTargetContextParams = {
  widgetId: string;
  widgetTitle: string;
};

export type AiDefaultFormulaContext = {
  type: "default-formula";
  widgetId: string;
  widgetTitle: string;
  currentFormula: string;
  rules: string[];
  fieldList: DefaultFormulaFieldContext[];
  formulaList: DefaultFormulaFunctionContext[];
};

export type AiDefaultFormulaTargetContext = {
  type: "default-formula-target";
  widgetId: string;
  widgetTitle: string;
};

const DEFAULT_RULES = [
  "字段请直接使用提供的 token 原样引用，不要自行拼接路径。",
  "不要引用 disabled=true 的字段。",
  "优先使用 kind=normal 的函数；只有整列计算时才使用 kind=column。",
  "kind=context 的函数依赖运行时上下文，没有明确需要时不要优先使用。",
];

const normalizeFieldValueType = (field: FormulaFieldLike) => {
  return String(field.revisedType || field.type || "string");
};

const pickMeaningfulText = (...values: Array<unknown>) => {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
};

const getTableLabel = (table?: FormulaTableLike) => {
  return String(table?.formulaAlias || table?.alias || table?.name || table?.uid || "");
};

const getFieldLabel = (field: FormulaFieldLike) => {
  return String(field.alias || field.meta?.name || field.meta?.uid || field.uid || "");
};

const getSourceType = (table: FormulaTableLike, tableKind: DefaultFormulaFieldSourceType): DefaultFormulaFieldSourceType => {
  if (tableKind === "current-row" || tableKind === "current-history") {
    return isHistoryTableUID(table.uid) ? "current-history" : "current-row";
  }
  return tableKind;
};

const appendField = (
  target: DefaultFormulaFieldContext[],
  table: FormulaTableLike,
  field: FormulaFieldLike,
  tableKind: DefaultFormulaFieldSourceType,
  disabledFieldMap: DisabledFieldMap,
  parentField?: FormulaFieldLike,
) => {
  const fieldUID = getFormulaTokenFieldUID(field);
  if (!fieldUID) return;

  const disabledMeta = tableKind === "current-row"
    ? disabledFieldMap[fieldUID]
    : undefined;
  target.push({
    token: buildFormulaFieldToken({
      tableUID: table.linkedForm || table.uid,
      tableLabel: getTableLabel(table),
      field,
      parentField,
    }),
    title: getFieldLabel(field),
    valueType: normalizeFieldValueType(field),
    sourceType: getSourceType(table, tableKind),
    ...(disabledMeta
      ? {
        disabled: true,
        disabledReason: disabledMeta.title,
      }
      : {}),
  });
};

const appendFieldList = (
  target: DefaultFormulaFieldContext[],
  table: FormulaTableLike,
  tableKind: DefaultFormulaFieldSourceType,
  disabledFieldMap: DisabledFieldMap,
) => {
  const fields = Array.isArray(table.fields) ? table.fields : [];

  fields.forEach((field) => {
    const currentField = field as FormulaFieldLike;
    if (isFormulaHiddenField(currentField)) {
      return;
    }

    if (String(currentField?.meta?.extra?.widgetType || "") === "widget.form.subform") {
      if (Array.isArray(currentField.subTableFields) && currentField.subTableFields.length) {
        currentField.subTableFields.forEach((subField) => {
          if (isFormulaHiddenField(subField)) return;
          appendField(target, table, subField, tableKind, disabledFieldMap, currentField);
        });
      }
      return;
    }

    appendField(target, table, currentField, tableKind, disabledFieldMap);
  });

  if (tableKind === "current-history" || tableKind === "other-table") {
    target.push({
      token: `[[${table.linkedForm || table.uid}.${FORMULA_RECORD_COUNT_FIELD_UID},${getTableLabel(table)}.${FORMULA_RECORD_COUNT_FIELD_ALIAS()}]]`,
      title: FORMULA_RECORD_COUNT_FIELD_ALIAS(),
      valueType: "number",
      sourceType: getSourceType(table, tableKind),
    });
  }
};

export const buildDefaultFormulaRules = () => DEFAULT_RULES.slice();

export const buildDefaultFormulaFunctionList = (): DefaultFormulaFunctionContext[] => {
  return sharedFormulaList.flatMap((category) => {
    const children = Array.isArray(category.children) ? category.children : [];
    return children.map((item) => ({
      name: item.name,
      category: String(category.category),
      kind: item.extraContext
        ? "context"
        : Array.isArray(item.argOfNotTableCol)
          ? "column"
          : "normal",
      usage: pickMeaningfulText(item.usage, `${item.name}(...)`),
      defaultArgTail: item.argStrOfdefault,
      summary: pickMeaningfulText(item.subName, item.name),
    }));
  });
};

export const buildDefaultFormulaFieldList = ({
  currentTables,
  linkedTables,
  otherTables,
  disabledFieldMap = {},
}: BuildDefaultFormulaFieldListParams): DefaultFormulaFieldContext[] => {
  const fieldList: DefaultFormulaFieldContext[] = [];

  currentTables.forEach((table) => {
    appendFieldList(
      fieldList,
      table,
      isHistoryTableUID(table.uid) ? "current-history" : "current-row",
      disabledFieldMap,
    );
  });

  linkedTables.forEach((table) => {
    appendFieldList(fieldList, table, "linked-table", disabledFieldMap);
  });

  otherTables.forEach((table) => {
    appendFieldList(fieldList, table, "other-table", disabledFieldMap);
  });

  return fieldList;
};

export const buildDefaultFormulaAiContext = ({
  widgetId,
  widgetTitle,
  currentFormula,
  rules,
  fieldList,
  formulaList,
}: BuildDefaultFormulaAiContextParams): AiDefaultFormulaContext => {
  return {
    type: "default-formula",
    widgetId,
    widgetTitle,
    currentFormula,
    rules: rules?.length ? rules.slice() : buildDefaultFormulaRules(),
    fieldList,
    formulaList,
  };
};

export const buildDefaultFormulaTargetContext = ({
  widgetId,
  widgetTitle,
}: BuildDefaultFormulaTargetContextParams): AiDefaultFormulaTargetContext => {
  return {
    type: "default-formula-target",
    widgetId,
    widgetTitle,
  };
};
