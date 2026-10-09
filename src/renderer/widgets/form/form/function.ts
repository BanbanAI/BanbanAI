import { linkWidgetTypeMap, replaceColFieldsByFormula, FORMULA_RECORD_COUNT_FIELD_UID, getSourceTableUID, isHistoryTableUID } from "@common/utils/formula";
import { FieldUID } from "@common/types/project";
import { transformCondition, getUUIDSystemField, SystemField } from "@common/utils/connection";
import { LogicalOperator } from "@renderer/b2/types";
import { FormElement, SubFormRow, isSubForm } from "@renderer/b2/controllers/form";
import { SubForm } from "@renderer/widgets/form/subForm/subForm";
import { dayjs } from "element-plus";
import { Field, FieldType, OptionTableUID, TableUID, WhereCondition } from "@common/types/project";
import { FormMode } from "../_common/type";
import { equals } from "@common/utils/object";
import { FilterRule } from "@common/types/nocode";
import { TheWidget as TimePicker } from "@renderer/widgets/form/timePicker";
import { getSubFormColumnLastChangeTimes } from "./formula-change-triggers";

export type Formula = { name: string, subName: string, intro: string, usage: string, example: string, argOfNotTableCol?: number[], argStrOfdefault?: string, ignoreBlankReplace?: boolean }
export type FieldUsage = {
  formula: Formula | null
  functionId: string | null,
  usageType: 'function' | 'standalone'
  argIndex: number | null
  argsLength: number
}
export const FORMULA_REFERENCED_STANDALONE_CACHE_KEY = "__standalone__";

export function getReferencedTableCacheKey(usage?: FieldUsage | null, fieldUID?: string) {
  if (usage?.functionId) return usage.functionId;
  return fieldUID === FORMULA_RECORD_COUNT_FIELD_UID ? FORMULA_REFERENCED_STANDALONE_CACHE_KEY : null;
}

function hasReferencedTableCacheValue(formElement: FormElement, cacheKey: string, idPath: string) {
  return Object.prototype.hasOwnProperty.call(formElement["otherTableDataCache"]?.[cacheKey] ?? {}, idPath);
}


export const parseFormulaTableUID = (rawTableUID?: string, currentConnectionUID?: string) => {
  if (!rawTableUID) {
    return {
      connectionUID: currentConnectionUID,
      tableUID: undefined,
    };
  }

  if (rawTableUID.includes(":")) {
    const [connectionUID, tableUID] = rawTableUID.split(":");
    return {
      connectionUID,
      tableUID,
    };
  }

  return {
    connectionUID: currentConnectionUID,
    tableUID: rawTableUID,
  };
}

function replaceEmptyValue(fieldType: FieldType) {
  switch (fieldType) {
    case "number":
      return 0;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

function createFormulaValueBatchContext(formElement: FormElement, signalOnly = false) {
  const topForm = formElement.topForm;
  const childElements = new Map<string, FormElement | undefined>();
  const rowChildren = new WeakMap<SubFormRow, Map<string, FormElement | undefined>>();
  const settings = new WeakMap<FormElement, ReturnType<FormElement["resolveFormSetting"]>>();
  let topFormWidgets: Map<string, FormElement> | undefined;

  return {
    signalOnly,
    getTopFormWidget(uid: string) {
      if (!topFormWidgets) {
        topFormWidgets = new Map(
          topForm.container.getChildWidgets(true).map(widget => [widget.uid, widget as FormElement])
        );
      }
      return topFormWidgets.get(uid);
    },
    getChildElement(uid: string) {
      if (!childElements.has(uid)) childElements.set(uid, topForm.getChildElement(uid) as FormElement | undefined);
      return childElements.get(uid);
    },
    getRowChild(row: SubFormRow, fieldId: string) {
      let children = rowChildren.get(row);
      if (!children) { children = new Map(); rowChildren.set(row, children); }
      if (!children.has(fieldId)) {
        const mountedChild = row.children.find(child => child.fieldId === fieldId);
        if (mountedChild) {
          children.set(fieldId, mountedChild);
        } else {
          // Virtual rows do not have child widgets. Reuse the template widget's
          // metadata and expose the raw row value without creating a component.
          const template = (row.parent as any)?.children?.find((child: FormElement) => child.fieldId === fieldId);
          if (!template) {
            children.set(fieldId, undefined);
          } else {
            const proxy = Object.create(template) as FormElement;
            Object.defineProperty(proxy, "inputValue", {
              configurable: true,
              enumerable: true,
              get: () => row.getRow()?.[fieldId],
              set: (value) => {
                const currentRow = row.getRow();
                if (currentRow) currentRow[fieldId] = value;
              },
            });
            Object.defineProperty(proxy, "status", {
              configurable: true,
              get: () => template.status,
            });
            children.set(fieldId, proxy);
          }
        }
      }
      return children.get(fieldId);
    },
    getFormSetting(widget: FormElement) {
      if (!settings.has(widget)) settings.set(widget, widget.resolveFormSetting());
      return settings.get(widget);
    },
  };
}

type FormulaValueBatchContext = ReturnType<typeof createFormulaValueBatchContext>;

function collectFormulaWidgetValue(widget: FormElement | undefined, usage: FieldUsage, context: FormulaValueBatchContext) {
  if (!widget) return;
  if (context.signalOnly) return { value: widget.inputValue, lastChangeTime: widget.status?.lastChangeTime };
  return normalizeBlankValue(preprocessingSpecialValue(widget, context), widget.fieldType, usage.formula?.ignoreBlankReplace);
}

function preprocessingSpecialValue(widget: FormElement | undefined, context?: FormulaValueBatchContext) { // 处理特殊组件inputValue
  if(!widget) {
    return
  };
  let value = widget?.inputValue;
  if (value instanceof Date) value = dayjs(value).format("YYYY-MM-DD HH:mm:ss");
  else if (widget.type === "widget.form.timePicker") {
    const time = dayjs(value, (widget as TimePicker).format)
    value = time.isValid() ? time.format("HH:mm:ss") : value;
  }
  else {
    const subType = context ? context.getFormSetting(widget)?.subType : widget.resolveFormSetting()?.subType;
    if ((subType === "image" || subType === "file") && value) {
      value = value.map(item => item.name);
    }
  }

  return value;
}

function preprocessingSpecialRaw(value: any, field: Field) { // 处理特殊组件inputValue
  if(value === undefined || value === null) {
    return;
  };

  if (field.meta.subType === "date") {
    const date = dayjs(value, field.meta.extra.format);
    return date.isValid() ? date.format("YYYY-MM-DD HH:mm:ss") : value;
  }
  else if (field.meta.subType === "time") {
    const time = dayjs(value, field.meta.extra.format);
    return time.isValid() ? time.format("HH:mm:ss") : value;
  }

  return value;
}

function normalizeBlankValue(
  value: any,
  fieldType: FieldType,
  ignoreBlankReplace?: boolean
) {
  if (ignoreBlankReplace) return value;
  if (value === null || value === undefined) {
    return replaceEmptyValue(fieldType);
  }
  return value;
}

function preprocessingLinkageFormColumnValue(options: {
  widget: FormElement
  subFieldUID: FieldUID
  sourceFieldUID?: FieldUID
  usage: FieldUsage
}): any[] {
  const { widget, subFieldUID, sourceFieldUID, usage } = options;

  let field;
  try {
    const key = linkWidgetTypeMap[widget.getSoul()?.type];
    const linkTableUID = widget[key] as OptionTableUID;
    field = widget.getField([...linkTableUID, subFieldUID + (sourceFieldUID ? `.${sourceFieldUID}` : '')]);
  } catch (error) {
  }

  const rawCol = widget.getValue(subFieldUID, sourceFieldUID);
  if (widget.getSoul()?.type === "widget.form.searchForm" && widget['showDataRow'] === "single") return rawCol;
  if (!Array.isArray(rawCol)) return [];

  const ignoreBlankReplace = usage.formula?.ignoreBlankReplace;

  return rawCol.map(v =>
    field ? normalizeBlankValue(preprocessingSpecialRaw(v, field), field.type, ignoreBlankReplace) : v
  );
}

function collectFormulaLinkageValue(options: Parameters<typeof preprocessingLinkageFormColumnValue>[0], context: FormulaValueBatchContext) {
  if (context.signalOnly) return { value: (options.widget as any).getValue(options.subFieldUID, options.sourceFieldUID), lastChangeTime: options.widget.status?.lastChangeTime, dataVersion: options.widget["formulaDataVersion"] ?? 0 };
  return preprocessingLinkageFormColumnValue(options);
}

function getFormulaFieldValuesCompatibility(formElement: FormElement, ids, formulaFieldMap: Map<string, FieldUsage[]>, context: FormulaValueBatchContext): {formulaDeps: Record<string, any[]>, queryDeps: Record<string, any[]>} {
  const usageCursor: Record<string, number> = {};

  return ids.reduce((acc, id) => {
    const usages = formulaFieldMap.get(id);
    if (!usages || usages.length === 0) return acc;

    const index = usageCursor[id] ?? 0;
    const usage = usages[index];
    usageCursor[id] = index + 1;

    const widget = context.getTopFormWidget(id);
    if (!widget) return acc;

    if (!widget.isInSubForm) {
      if (!acc.formulaDeps[id]) acc.formulaDeps[id] = [];
      acc.formulaDeps[id].push(collectFormulaWidgetValue(widget, usage, context));
      return acc;
    } else {
      if (!formElement.isInSubForm) {
        const subform = widget.form as SubForm;
        const col = subform.tableData.map(subformRow => {
          const subWidget = context.getRowChild(subformRow, widget.fieldId);
          return collectFormulaWidgetValue(subWidget, usage, context);
        })
        if (!acc.formulaDeps[id]) acc.formulaDeps[id] = [];
        acc.formulaDeps[id].push(col);
        return acc;
      } else {
        const subformRow = formElement.form;
        if (!(subformRow instanceof SubFormRow)) return acc;

        const subWidget = context.getRowChild(subformRow, widget.fieldId);
        if (!acc.formulaDeps[id]) acc.formulaDeps[id] = [];
        acc.formulaDeps[id].push(collectFormulaWidgetValue(subWidget, usage, context));
        return acc;
      }
    }
  }, {formulaDeps: {}, queryDeps: {}})
}

const typeOfDepWithCondition = ['widget.form.searchForm']
function collectFormulaFieldValues(formElement: FormElement, ids, formulaFieldMap: Map<string, FieldUsage[]>, signalOnly = false): {formulaDeps: Record<string, any[]>, queryDeps: Record<string, any[]>} {
  const context = createFormulaValueBatchContext(formElement, signalOnly);
  const isOldFormula = ids.some(id => id.split('.').length === 1);
  if (isOldFormula) return getFormulaFieldValuesCompatibility(formElement, ids, formulaFieldMap, context); // 兼容旧公式

  const usageCursor: Record<string, number> = {};

  return ids.reduce((acc, id) => {
    const usages = formulaFieldMap.get(id);
    if (!usages || usages.length === 0) return acc;

    const index = usageCursor[id] ?? 0;
    const usage = usages[index];
    usageCursor[id] = index + 1;

    const [tableUID, fieldUID, subFieldUID, sourceFieldUID] = id.split(".");
    if (tableUID !== formElement.topForm.tableUID[1]) return acc; // 排除掉他表的字段
    if (subFieldUID) {
      const nestingForm = context.getChildElement(fieldUID);
      if (!nestingForm) return acc;

      const linkageFormKey = linkWidgetTypeMap[nestingForm.getSoul()?.type];
      if (linkageFormKey){
        if (typeOfDepWithCondition.includes(nestingForm.getSoul()?.type)) {
          if (!acc.queryDeps[id]) acc.queryDeps[id] = [];
          acc.queryDeps[id].push(nestingForm.formDataFilter?.conditions?.map(c => c.value)) // 查询表单字段监听时返回筛选条件value， 不做空值判断处理
          const conditionValues = acc.queryDeps[id][acc.queryDeps[id].length - 1];
          acc.queryDeps[id][acc.queryDeps[id].length - 1] = {
            conditionValues,
            dataVersion: nestingForm["formulaDataVersion"] ?? 0,
          }
        } else {
          if (!acc.formulaDeps[id]) acc.formulaDeps[id] = [];
          acc.formulaDeps[id].push(
            collectFormulaLinkageValue({
              widget: nestingForm,
              subFieldUID,
              sourceFieldUID,
              usage
            }, context)
          )
        }

        return acc
      } else if (isSubForm(nestingForm)) {
        // 子表单字段
        const widget = context.getChildElement(subFieldUID);
        if (!widget) return acc;

        // 用公式列表中的配置和当前字段在公式中的参数index判断是否参与列计算逻辑
        const rawArgOfNotTableCol = usage.formula?.argOfNotTableCol;
        let needColumnCompute = false;
        if (rawArgOfNotTableCol && usage.argIndex != null) {
          const resolvedArgIndexes = rawArgOfNotTableCol.map(i =>
            i < 0 ? usage.argsLength + i : i
          );

          needColumnCompute = !resolvedArgIndexes.includes(usage.argIndex);
        }

        if (formElement.isInSubForm && !needColumnCompute) { // 获取当前行的字段值
          const subformRow = formElement.form;
          if (!(subformRow instanceof SubFormRow)) return acc;

          const subWidget = context.getRowChild(subformRow, widget.fieldId);
          if (!subWidget) return acc;
          if (!acc.formulaDeps[id]) acc.formulaDeps[id] = [];
          acc.formulaDeps[id].push(collectFormulaWidgetValue(subWidget, usage, context));

          return acc;
        } else { // 获取一列字段值数组
          const col = (nestingForm as SubForm).tableData.map(subformRow => {
            const subWidget = context.getRowChild(subformRow, widget.fieldId);
            return collectFormulaWidgetValue(subWidget, usage, context);
          })
          if (!acc.formulaDeps[id]) acc.formulaDeps[id] = [];
          acc.formulaDeps[id].push(col)
          return acc;
        }
      }
    } else {
      // 普通字段
      const widget = context.getChildElement(fieldUID);
      if (!widget) return acc;

      if (!acc.formulaDeps[id]) acc.formulaDeps[id] = [];
      acc.formulaDeps[id].push(collectFormulaWidgetValue(widget, usage, context));

      return acc;
    }
  }, {formulaDeps: {}, queryDeps: {}})
}

export function getFormulaFieldValues(formElement: FormElement, ids, formulaFieldMap: Map<string, FieldUsage[]>): {formulaDeps: Record<string, any[]>, queryDeps: Record<string, any[]>} {
  return collectFormulaFieldValues(formElement, ids, formulaFieldMap);
}

export function getFormulaDependencySignals(formElement: FormElement, ids, formulaFieldMap: Map<string, FieldUsage[]>): {formulaDeps: Record<string, any[]>, queryDeps: Record<string, any[]>} {
  return collectFormulaFieldValues(formElement, ids, formulaFieldMap, true);
}

export function getQuoteFieldLastChangeCompatibility(formElement: FormElement, ids: string[]) {
  const topForm = formElement.topForm;
  const topFormWidgets = topForm.container.getChildWidgets(true);
  return ids.reduce((acc, id) => {
    const widget = topFormWidgets.find(input => input.uid === id) as FormElement;
    if (!widget) return acc;

    if (!widget.isInSubForm) {
      acc[id] = widget?.status.lastChangeTime;
      return acc;
    } else {
      if (!formElement.isInSubForm) {
        const subform = widget.form as SubForm;
        const lastChangeOfCol = getSubFormColumnLastChangeTimes(subform, widget.fieldId)
        acc[id] = lastChangeOfCol;
        return acc;
      } else {
        const subformRow = formElement.form;
        if (!(subformRow instanceof SubFormRow)) return acc;
        acc[id] = subformRow.children.find(c => c.fieldId === widget.fieldId)?.status.lastChangeTime;
        return acc;
      }
    }
  }, {})
}

export function getQuoteFieldLastChange(formElement: FormElement, ids: string[], formulaFieldMap: Map<string, FieldUsage[]>) {
  const isOldFormula = ids.some(id => id.split('.').length === 1);
  if (isOldFormula) return getQuoteFieldLastChangeCompatibility(formElement, ids); // 兼容旧公式

  const topForm = formElement.topForm;
  const usageCursor: Record<string, number> = {};

  return ids.reduce((acc, id) => {
    const usages = formulaFieldMap.get(id);
    if (!usages || usages.length === 0) return acc;

    const index = usageCursor[id] ?? 0;
    const usage = usages[index];
    usageCursor[id] = index + 1;

    const [tableUID, fieldUID, subFieldUID, sourceFieldUID] = id.split(".");
    if (subFieldUID) {
      const nestingForm = topForm.getChildElement(fieldUID);
      if (!nestingForm) return acc;

      const linkageFormKey = linkWidgetTypeMap[nestingForm.getSoul()?.type];
      if (linkageFormKey){
        if (!acc[id]) acc[id] = [];
        acc[id].push(nestingForm.status.lastChangeTime);
        return acc
      } else if (isSubForm(nestingForm)) {
        const widget = topForm.getChildElement(subFieldUID);
        if (!widget) return acc;

        // 用公式列表中的配置和当前字段在公式中的参数index判断是否参与列计算逻辑
        const rawArgOfNotTableCol = usage.formula?.argOfNotTableCol;
        let needColumnCompute = false;
        if (rawArgOfNotTableCol && usage.argIndex != null) {
          const resolvedArgIndexes = rawArgOfNotTableCol.map(i =>
            i < 0 ? usage.argsLength + i : i
          );

          needColumnCompute = !resolvedArgIndexes.includes(usage.argIndex);
        }

        if (formElement.isInSubForm && !needColumnCompute) {
          const subformRow = formElement.form;
          if (!(subformRow instanceof SubFormRow)) return acc;
          if (!acc[id]) acc[id] = [];
          acc[id].push(subformRow.children.find(c => c.fieldId === widget.fieldId)?.status.lastChangeTime);
          return acc;
        } else {
          const subform = nestingForm as SubForm;
          const lastChangeOfCol = getSubFormColumnLastChangeTimes(subform, widget.fieldId)
          if (!acc[id]) acc[id] = [];
          acc[id].push(lastChangeOfCol);
          return acc;
        }
      }
    } else {
      const widget = topForm?.getChildElement(fieldUID) as FormElement;
      if (!widget) return acc;
      if (!acc[id]) acc[id] = [];
      acc[id].push(widget.status.lastChangeTime);
      return acc;
    }
  }, {})
}

export function processFormulaResult(result, type: FieldType) {
  switch (type) { // 根据当前使用公式的组件的类型处理结果
    // case 'array':
      // return Array.isArray(processed) ? processed : [processed].filter(item => item != null);

    case 'number':
      const num = Number(result);
      return !isNaN(num) ? num : result;

    default:
      return Array.isArray(result) ? result.join(',') : result;
  }
}

export function getPeerSubfieldWithColumnCompute(formula: string, formElement: FormElement) {
  const ids = [];
  replaceColFieldsByFormula(formula, (keys) => {
    const [tableUID, fieldUID, subFieldUID, sourceFieldUID] = keys;
    const topForm = formElement.topForm;
    const nestingForm = topForm.getChildElement(fieldUID);
    const id = keys.join('.');
    if (formElement.isInSubForm && nestingForm && isSubForm(nestingForm)) {
      ids.push(id)
      return id
    }
    return id
  });
  return ids;
}

export function hasFormulaWidgetInited(ids: string[], formElement: FormElement) {
  for (const id of ids) {
    const [tableUID, fieldUID, subFieldUID, sourceFieldUID] = id.split(".");
    const topForm = formElement.topForm;

    const widget = topForm.getChildElement(fieldUID);
    if (isSubForm(widget) && !(widget as SubForm).status.rowsInitialized) return false;
  }

  return true;
}

export function getChangedSearchFormIds(
  newDeps: Record<string, any>,
  oldDeps: Record<string, any> = {}
): Record<string, Array<string>> {
  const changed = {};

  for (const key in newDeps) {
    if (!equals(newDeps[key], oldDeps[key])) {
      const [tableUID, fieldUID, subFieldUID, sourceFieldUID] = key.split('.');
      if (!changed[fieldUID]) changed[fieldUID] = [];
      const id = sourceFieldUID ? `${subFieldUID}.${sourceFieldUID}` : subFieldUID;
      changed[fieldUID].push(id);
    }
  }

  return changed;
}

export async function refreshSearchFormCacheIfNeeded(
  newDeps: Record<string, any>,
  oldDeps: Record<string, any> = {},
  formElement: FormElement
) {
  const changed = getChangedSearchFormIds(newDeps, oldDeps);
  const topForm = formElement.topForm;

  for (const key in newDeps) {
    const [tableUID, searchFormId, subFieldUID, sourceFieldUID] = key.split('.');
    const widget = topForm.getChildElement(searchFormId);
    if (!widget) continue;

    const isFirstRun = formElement.getBoard().formMode === FormMode.Edit && Object.values(oldDeps).filter(Boolean).length === 0;

    const columnKey = sourceFieldUID
      ? `${subFieldUID}.${sourceFieldUID}`
      : subFieldUID;

    const cache = widget.columnCache || {};
    const needInit = cache[columnKey] === undefined;

    // 变化刷新 OR 首次缺失刷新
    if (
      changed[searchFormId]?.includes(columnKey) ||
      isFirstRun && needInit
    ) {
      await widget.refreshColumnCache?.([columnKey]);
    }
  }
}

// 构建公式中字段值Map
export function buildFormulaValueMap(options: {
  formElement: FormElement;
  commonDeps: Record<string, any>;
  queryDeps: Record<string, any>;
  formulaFieldMap: Map<string, FieldUsage[]>
}) {
  const { formElement, commonDeps, queryDeps, formulaFieldMap } = options;

  return {
    ...commonDeps,
    ...collectQueryFormulaValues(formElement, queryDeps, formulaFieldMap),
  };
}

function collectQueryFormulaValues(
  formElement: FormElement,
  queryDeps: Record<string, any[]>,
  formulaFieldMap: Map<string, FieldUsage[]>
): Record<string, any[]> {
  const topForm = formElement.topForm;
  const queryMap: Record<string, any[]> = {};
  const usageCursor: Record<string, number> = {};

  for (const id in queryDeps) {
    const usages = formulaFieldMap.get(id);
    if (!usages || usages.length === 0 || !queryDeps[id]?.length) continue;

    for (let i = 0; i < queryDeps[id].length; i++) {
      const index = usageCursor[id] ?? 0;
      const usage = usages[index];
      usageCursor[id] = index + 1;

      const [tableUID, fieldUID, subFieldUID, sourceFieldUID] = id.split('.');
      const widget = topForm.getChildElement(fieldUID);
      if (!widget) continue;

      if (!queryMap[id]) queryMap[id] = [];
      queryMap[id].push(
        preprocessingLinkageFormColumnValue({
          widget: widget,
          subFieldUID: subFieldUID as FieldUID,
          sourceFieldUID: sourceFieldUID as FieldUID,
          usage
        })
      )
    }
  }

  return queryMap;
}

function resolveReferencedTableUID(tableUID: string) {
  return {
    rawTableUID: tableUID,
    referencedTableUID: getSourceTableUID(tableUID),
    isHistoryData: isHistoryTableUID(tableUID)
  };
}

export const refreshReferencedTableFieldCache = async (
  formElement: FormElement, ids: string[], filterRulesMap: Record<string, Record<TableUID, FilterRule>>, formulaFieldMap: Map<string, FieldUsage[]>
) => {
  const usageCursor: Record<string, number> = {};
  for (const idPath of ids) {
    const usages = formulaFieldMap.get(idPath);
    if (!usages || usages.length === 0) continue;

    const index = usageCursor[idPath] ?? 0;
    const usage = usages[index];
    usageCursor[idPath] = index + 1;

    const [rawTableUID, UID, subUID, sourceFieldUID] = idPath.split(".");
    const { connectionUID, tableUID } = parseFormulaTableUID(rawTableUID, formElement.topForm.tableUID[0]);
    const cacheKey = getReferencedTableCacheKey(usage, UID);
    if (!cacheKey || hasReferencedTableCacheValue(formElement, cacheKey, idPath)) continue;

    const option = {};
    if (usage) {
      const { referencedTableUID, isHistoryData } = resolveReferencedTableUID(tableUID);
      const filterRules = usage.functionId ? filterRulesMap[usage.functionId] : undefined;
      const filterRule = filterRules?.[rawTableUID] || filterRules?.[tableUID] || filterRules?.[referencedTableUID];

      if (filterRule) {
        const cond = filterRule.conditions.filter(c => c.uid?.split(".").length === 1);
        const queryConditions = cond.map(transformCondition);
        const logicKey = filterRule.logic === LogicalOperator.AND ? "$and" : "$or";
        let queryParts: any[] = [];
        if (cond.length) {
          queryParts.push({ [logicKey]: queryConditions });
        }
        const query: WhereCondition = queryParts.length > 1
          ? { $and: queryParts }
          : queryParts[0]; // 只有一个条件就不用包 $and
        option["filters"] = {
          [referencedTableUID]: [
            query,
          ]
        };
      }

      let col = [];
      const optionTableUID: OptionTableUID = [connectionUID, isHistoryData ? referencedTableUID : tableUID];
      const {count, rows: rawRows} = await formElement.getData().getPagingRows(optionTableUID, option);
      let rows = rawRows;

      let fieldUID = UID;
      if (isHistoryData && referencedTableUID === formElement.topForm.tableUID[1]) {
        const uuidKey = getUUIDSystemField(formElement.getTableFields([connectionUID, referencedTableUID]))?.uid;
        const currentRowUUID = formElement.topForm.getRow?.()?.[uuidKey];
        rows = uuidKey ? rawRows.filter(row => row[uuidKey] !== currentRowUUID) : rawRows;

        if (UID !== FORMULA_RECORD_COUNT_FIELD_UID) {
          const table = formElement.topForm.getTable(formElement.topForm.tableUID);
          fieldUID = table.fields.find(f=> f.meta.uid === UID)?.uid;
        }
      }

      if (UID === FORMULA_RECORD_COUNT_FIELD_UID) {
        col = rows.length;
      } else if (!subUID) {
        col = rows?.map(row => row[fieldUID])
      } else {
        const field = formElement.getField([connectionUID, referencedTableUID, fieldUID]);
        const subTableUID = field?.meta?.extra?.subTableUID?.[1];
        const subTable = subTableUID ? formElement.getTable([connectionUID, subTableUID]) : undefined;
        let subFieldUID;
        if (isHistoryData) {
          subFieldUID = subTable.fields.find(f=> f.meta.uid === subUID)?.uid;
        } else {
          subFieldUID = subTable?.fields?.find(f=> f.uid === subUID)?.uid;
        }
        const uuidKey = getUUIDSystemField(formElement.getTableFields([connectionUID, referencedTableUID]))?.uid;
        const keys = rows.map(row => row[uuidKey]);
        const relationKey = subTable?.fields?.find(field => field.meta.name === SystemField.KEY)?.uid;
        if (subTable && subFieldUID && relationKey) {
          const { rows: subRows } = await formElement.getData().getPagingRows([connectionUID, subTable.uid], {
            filters: {
              [subTable.uid]: [{
                [relationKey]: {
                  $in: keys,
                }
              }]
            },
          });
          col = subRows.map(col => col[subFieldUID]);
        }
      }

      if (!formElement["otherTableDataCache"]) formElement["otherTableDataCache"] = {};
      if (!formElement["otherTableDataCache"][cacheKey]) formElement["otherTableDataCache"][cacheKey] = {};
      formElement["otherTableDataCache"][cacheKey][idPath] = col;
    }
  }
}

