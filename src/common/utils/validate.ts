import { Field, FieldExtra, FieldUID, Row, WidgetSoul } from "@common/types/project";
import { ExcelLocation, ExcelSubformColMaps, SheetData, SpecialFieldProcess, SpecialFieldProcessRes } from "@common/types/excel";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { Department, NocodeUser } from "@common/types/account"
import { FilterRule, FormCondition, LogicalOperator, NocodeBody } from "@common/types/nocode";
import i18next from "i18next";
import { funcMap } from "./flow";
import { findWidgetSoulByUID } from "./element";

dayjs.extend(customParseFormat);

export const dataRegex = {
  phone: /^(?:(?:\+|00)86|0)?1[3-9]\d{9}$/,
  address: /^([\u4e00-\u9fa5\w]+\/){1,3}[\u4e00-\u9fa5\w]+/,
}

export type StrictDatePrecision = "year" | "month" | "day" | "hour" | "minute" | "second";

type StrictDateInfo = {
  date: dayjs.Dayjs;
  precision: StrictDatePrecision;
}

const getFieldLabel = (field?: Field) => field?.alias || field?.meta?.name || "-";

const getFieldReason = (field: Field, key: string, options: Record<string, any> = {}) => {
  const i18n = (globalThis as any)?.i18next || i18next;
  return i18n.t(`ImportExcelDialog.${key}`, {
    field: getFieldLabel(field),
    ...options,
  });
}

const RELATED_DATA_ID_REGEX = /^[a-z0-9]{12}$/i;
const RELATED_DATA_VALUE_REGEX = /\(([a-z0-9]{12})\)$/i;
const CONDITIONAL_REQUIRED_MODE = "condition";
const STATIC_REQUIRED_MODE = "on";
const CONDITION_WIDGET_SEPARATOR = ".";

type ImportVisibleRule = {
  logic?: LogicalOperator;
  conditions?: FormCondition[];
  widgetIds?: string[];
  visibleType?: "show" | "hide";
}

const isExcelEmptyValue = (value: any) => {
  return value == null || (typeof value === 'string' && value.trim() === '');
}

/**
 * Excel 多选、标签类字段按英文逗号拆成数组，与表单填写、导出的存储格式保持一致。
 * 导入时若保留字符串，公式（COUNTA/UNION 等）会按字符逐个计算，结果与手动添加的数据不一致。
 */
const parseExcelArrayValue = (data: unknown) => {
  if (isExcelEmptyValue(data)) return [];
  if (Array.isArray(data)) return data;

  return String(data)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export const parseRelatedDataIds = (data: any) => {
  if (isExcelEmptyValue(data)) return [];

  return String(data)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => item.match(RELATED_DATA_VALUE_REGEX)?.[1] || item);
}

export const normalizeRelatedDataTitle = (title: any) => {
  return String(title ?? '')
    .replace(/,/g, '，')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）');
}

export const formatRelatedDataExportValue = (data: any, labelMap: Record<string, string>) => {
  return parseRelatedDataIds(data).map(uuid => {
    const label = labelMap?.[uuid];
    const uuidSuffix = `(${uuid})`;
    if (!label || !label.endsWith(uuidSuffix)) return uuid;

    const title = normalizeRelatedDataTitle(label.slice(0, -uuidSuffix.length));
    return title ? `${title}${uuidSuffix}` : uuid;
  }).join(',');
}

const getRuleMatcher = (logic?: LogicalOperator) => {
  return logic === LogicalOperator.OR ? "some" : "every";
}

const splitConditionUid = (uid?: string | null) => {
  return String(uid || "").split(CONDITION_WIDGET_SEPARATOR).filter(Boolean);
}

const findFieldByConditionUid = (fields: Field[] = [], uid?: string | null) => {
  if (!uid) return null;
  const conditionIds = splitConditionUid(uid);
  const targetUid = conditionIds[conditionIds.length - 1] || uid;
  return fields.find(field => {
    return field?.uid === targetUid || field?.meta?.uid === targetUid;
  }) || null;
}

const findSubFormFieldByConditionUid = (fields: Field[] = [], uid?: string | null) => {
  if (!uid) return null;
  const conditionIds = splitConditionUid(uid);
  if (conditionIds.length < 2) return null;
  const [subFormUid, childUid] = conditionIds;
  return fields.find(field => {
    const widgetUid = field?.meta?.uid || field?.uid;
    if (widgetUid !== subFormUid && field?.uid !== subFormUid) {
      return false;
    }
    return field.subTableFields?.some(subField => {
      return subField?.uid === childUid || subField?.meta?.uid === childUid;
    });
  }) || null;
}

const getFormWidgetSoul = (nocodeBody?: NocodeBody, tableUID?: string, field?: Field | null) => {
  if (!nocodeBody) return null;
  const directWidgetSoul = tableUID ? nocodeBody.formData?.formOptions?.[tableUID]?.widget as WidgetSoul | null : null;
  if (directWidgetSoul) {
    return directWidgetSoul;
  }
  const fieldWidgetUid = field?.meta?.uid || field?.uid;
  if (!fieldWidgetUid) {
    return null;
  }
  const formOptions = nocodeBody.formData?.formOptions || {};
  for (const option of Object.values(formOptions)) {
    const widgetSoul = option?.widget as WidgetSoul | undefined;
    if (!widgetSoul) {
      continue;
    }
    if (findWidgetSoulByUID([widgetSoul], fieldWidgetUid)) {
      return widgetSoul;
    }
  }
  return null;
}

const getWidgetSoulByConditionUid = (widgetSoul: WidgetSoul | null, uid?: string | null) => {
  if (!widgetSoul || !uid) return null;
  const conditionIds = splitConditionUid(uid);
  if (conditionIds.length > 1) {
    const subFormSoul = findWidgetSoulByUID([widgetSoul], conditionIds[0]);
    if (!subFormSoul) return null;
    return findWidgetSoulByUID(subFormSoul.widgets || [], conditionIds[1]);
  }
  return findWidgetSoulByUID([widgetSoul], conditionIds[0]);
}

const isWidgetSoulInTab = (rootSoul: WidgetSoul | null, targetUid?: string | null): boolean => {
  if (!rootSoul || !targetUid) return false;
  const walk = (currentSoul: WidgetSoul, inTabPanel: boolean): boolean => {
    const currentInTabPanel = inTabPanel || currentSoul.type === "widget.form.tabPanel";
    if (currentSoul.uid === targetUid) {
      return currentInTabPanel;
    }
    return (currentSoul.widgets || []).some(child => walk(child, currentInTabPanel));
  };
  return walk(rootSoul, false);
}

const getWidgetSoulVisibleRules = (widgetSoul: WidgetSoul | null, optionName: string) => {
  const rules = widgetSoul?.options?.[optionName];
  return Array.isArray(rules) ? rules as ImportVisibleRule[] : [];
}

const getConditionWidgetVisibleRules = (formWidgetSoul: WidgetSoul | null, uid?: string | null) => {
  if (!formWidgetSoul || !uid) return [];
  const conditionIds = splitConditionUid(uid);
  if (!conditionIds.length) return [];
  if (conditionIds.length > 1) {
    const subFormSoul = findWidgetSoulByUID([formWidgetSoul], conditionIds[0]);
    return getWidgetSoulVisibleRules(subFormSoul, "sub-fields-visible").filter(rule => {
      return rule.widgetIds?.includes(conditionIds[1]);
    });
  }
  return getWidgetSoulVisibleRules(formWidgetSoul, "fields-visible").filter(rule => {
    return rule.widgetIds?.includes(conditionIds[0]);
  });
}

const isImportConditionMatched = (condition: FormCondition, rowDataMap: Record<string, any>) => {
  if (!condition?.uid || !(condition.uid in rowDataMap)) {
    return false;
  }
  return funcMap[condition.func]?.(rowDataMap[condition.uid], condition.value) ?? false;
}

const isConditionWidgetVisibleInImport = (
  condition: FormCondition,
  rowDataMap: Record<string, any>,
  tableFields: Field[] = [],
  nocodeBody?: NocodeBody,
  tableUID?: string,
  currentField?: Field | null,
  visitedConditionUids: Set<string> = new Set(),
) => {
  if (!condition?.uid) return false;
  if (visitedConditionUids.has(condition.uid)) {
    return true;
  }

  const hasConditionField = !!findFieldByConditionUid(tableFields, condition.uid) || !!findSubFormFieldByConditionUid(tableFields, condition.uid);
  const formWidgetSoul = getFormWidgetSoul(nocodeBody, tableUID, currentField);
  const currentWidgetSoul = getWidgetSoulByConditionUid(formWidgetSoul, condition.uid);

  if (!currentWidgetSoul) {
    return hasConditionField || (condition.uid in rowDataMap);
  }
  if ((currentWidgetSoul.options as Record<string, any> | undefined)?.["is-hidden"]) {
    return true;
  }
  if (isWidgetSoulInTab(formWidgetSoul, currentWidgetSoul.uid)) {
    return true;
  }

  const matchedRules = getConditionWidgetVisibleRules(formWidgetSoul, condition.uid);
  if (!matchedRules.length) {
    return true;
  }

  const nextVisitedConditionUids = new Set(visitedConditionUids);
  nextVisitedConditionUids.add(condition.uid);
  const showRules = matchedRules.filter(rule => rule.visibleType !== "hide");
  const hideRules = matchedRules.filter(rule => rule.visibleType === "hide");
  const isRuleMatched = (rule: ImportVisibleRule) => {
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
    if (!conditions.length) return false;
    const matcher = getRuleMatcher(rule.logic);
    return conditions[matcher]((item: FormCondition) => {
      if (!item?.uid) {
        return false;
      }
      return isConditionWidgetVisibleInImport(
        item,
        rowDataMap,
        tableFields,
        nocodeBody,
        tableUID,
        currentField,
        nextVisitedConditionUids,
      ) && isImportConditionMatched(item, rowDataMap);
    });
  }

  for (const rule of showRules) {
    if (isRuleMatched(rule)) {
      return true;
    }
  }
  for (const rule of hideRules) {
    if (isRuleMatched(rule)) {
      return false;
    }
  }

  return (!showRules.length && hideRules.length) ? true : false;
}

const getFieldRequiredMode = (extra?: FieldExtra | null) => {
  if (extra?.requiredMode) {
    return extra.requiredMode;
  }
  return extra?.isRequired ? STATIC_REQUIRED_MODE : "off";
}

const getFieldRequiredRule = (extra?: FieldExtra | null): FilterRule | null => {
  if (!extra?.requiredRule?.conditions?.length) {
    return null;
  }
  return extra.requiredRule;
}

export const shouldTreatFieldAsRequired = (field?: Field | null) => {
  const mode = getFieldRequiredMode(field?.meta?.extra);
  return mode === STATIC_REQUIRED_MODE || mode === CONDITIONAL_REQUIRED_MODE;
}

export const shouldTreatFieldAsStaticRequired = (field?: Field | null) => {
  return getFieldRequiredMode(field?.meta?.extra) === STATIC_REQUIRED_MODE;
}

const setFieldRowDataValue = (
  rowDataMap: Record<string, any>,
  field?: Field | null,
  value?: any,
  subFormWidgetUid?: string,
) => {
  if (!rowDataMap || !field) return;
  const widgetUid = field.meta?.uid || field.uid;
  if (field.uid) {
    rowDataMap[field.uid] = value;
  }
  if (field.meta?.uid) {
    rowDataMap[field.meta.uid] = value;
  }
  if (subFormWidgetUid && widgetUid) {
    rowDataMap[`${subFormWidgetUid}${CONDITION_WIDGET_SEPARATOR}${widgetUid}`] = value;
  }
}

const shouldValidateImportRequired = (
  field?: Field | null,
  rowDataMap?: Record<string, any>,
  fields: Field[] = [],
  nocodeBody?: NocodeBody,
  tableUID?: string,
) => {
  const extra = field?.meta?.extra;
  const mode = getFieldRequiredMode(extra);
  if (mode === STATIC_REQUIRED_MODE) {
    return true;
  }
  if (mode !== CONDITIONAL_REQUIRED_MODE) {
    return false;
  }
  const rule = getFieldRequiredRule(extra);
  if (!rule) {
    return false;
  }
  const matcher = getRuleMatcher(rule.logic);
  return rule.conditions[matcher]((condition: FormCondition) => {
    if (!condition?.uid) {
      return false;
    }
    if (!isConditionWidgetVisibleInImport(condition, rowDataMap || {}, fields, nocodeBody, tableUID, field)) {
      return false;
    }
    return funcMap[condition.func]?.(rowDataMap?.[condition.uid], condition.value) ?? false;
  });
}

const buildSubFieldRowDataMap = (
  rowDataMap: Record<string, any> = {},
  parentRowDataMap: Record<string, any> = {},
  subFields: Field[] = [],
  subRow: Record<string, any> = {},
  subFormWidgetUid?: string,
) => {
  const nextRowDataMap: Record<string, any> = { ...rowDataMap };
  const currentSubFormUid = subFormWidgetUid;
  for (const [key, value] of Object.entries(parentRowDataMap || {})) {
    if (!key) continue;
    const widgetIds = key.split('.');
    if (currentSubFormUid && widgetIds.length > 1 && widgetIds[0] === currentSubFormUid) {
      continue;
    }
    nextRowDataMap[key] = value;
  }
  subFields.forEach((subField) => {
    const fieldValue = subRow?.[subField.uid];
    setFieldRowDataValue(nextRowDataMap, subField, fieldValue, currentSubFormUid);
  });
  return nextRowDataMap;
}

export const buildImportRowDataMap = (
  mapping: Record<string, FieldUID | "不导入" | undefined> = {},
  sheetData: SheetData,
  rowIndex: number,
  fields: Field[] = [],
  currentFieldId?: FieldUID,
  rowDataMap: Record<string, any> = {},
) => {
  const nextRowDataMap: Record<string, any> = { ...rowDataMap };
  for (const [col, uid] of Object.entries(mapping || {})) {
    if (!uid || uid === "不导入" || (currentFieldId && uid === currentFieldId)) {
      continue;
    }
    const field = fields.find(item => item.uid === uid);
    const colIndex = Number(col.replace("col-", ""));
    setFieldRowDataValue(nextRowDataMap, field, sheetData.rows[rowIndex]?.[colIndex]);
  }
  return nextRowDataMap;
}

export const applyImportFieldValueToRowDataMap = (
  rowDataMap: Record<string, any>,
  field?: Field | null,
  value?: any,
  subFormWidgetUid?: string,
) => {
  setFieldRowDataValue(rowDataMap, field, value, subFormWidgetUid);
}

const parseNumberInputValue = (data: any, field?: Field) => {
  if (typeof data === 'number') {
    return data;
  }

  if (typeof data === 'string') {
    const text = data.trim();
    if (field?.meta?.extra?.isPercent && text.endsWith('%')) {
      const percentValue = Number(text.slice(0, -1).trim());
      if (!Number.isNaN(percentValue)) {
        return percentValue / 100;
      }
    }

    const normalizedNumberText = text.replace(/,/g, '');
    if (normalizedNumberText !== text) {
      const normalizedNumberValue = Number(normalizedNumberText);
      if (!Number.isNaN(normalizedNumberValue)) {
        return normalizedNumberValue;
      }
    }
  }

  return Number(data);
}

const hasSubformRowValue = (row: any[] = [], mapping: Record<string, string> = {}) => {
  return Object.keys(mapping).some((col) => {
    const colIndex = Number(col.replace('col-', ''));
    return !isExcelEmptyValue(row?.[colIndex]);
  });
}

const resolveSubformRowRange = (
  cellLocation: ExcelLocation,
  sheetData: SheetData,
  mapping: Record<string, string> = {},
) => {
  const curRowspanArr: number[] = sheetData.mergeData[cellLocation.r]?.map(item => item?.rowspan ?? 1) ?? [1];
  const startRow = cellLocation.r;
  const maxEndRow = Math.min(sheetData.rows.length - 1, startRow + Math.max(...curRowspanArr) - 1);
  let endRow = startRow;

  for (let rowIndex = startRow; rowIndex <= maxEndRow; rowIndex++) {
    if (hasSubformRowValue(sheetData.rows[rowIndex], mapping)) {
      endRow = rowIndex;
    }
  }

  return { s: startRow, e: endRow };
}

/** 多选、下拉多选、标签文本这类数组字段，导入时按英文逗号拆成数组，与表单填写的存储格式保持一致。 */
const parseMultiValueField: SpecialFieldProcess['processor'] = async ({ data }) => ({
  data: parseExcelArrayValue(data),
  valid: true,
});

const specialFieldProcessArr: SpecialFieldProcess[] = [
  {
    type: 'widget.form.subform',
    processor: async ({ data, cellLocation, field, sheetData, titleRowIndex, subformMappings, nocodeBody, userList, departmentList, rowDataMap, parentRowDataMap, skipRequiredValidation }) => {
      // 如果当前列为子表单列，则整合此字段在当前行的所有子表单数据
      let valid = true;
      const mapping = subformMappings[`col-${cellLocation.c}`];
      if (!mapping || Object.keys(mapping).length === 0) {
        return { data: [], valid: true };
      }
      const rowRange = resolveSubformRowRange(cellLocation, sheetData, mapping);
      const rows: Row[] = [];
      let reason = '';
      const subtableId = field.meta.extra.subTableUID[1];
      const subtable = nocodeBody.formData.tables.find(table => table.uid === subtableId);
      const subFormWidgetUid = field?.meta?.uid || field?.uid;
      const subFields = Object.values(mapping)
        .map(uid => subtable?.fields.find(field => field.uid === uid))
        .filter(Boolean) as Field[];

      rowLoop:
      for (let rowIndex = rowRange.s; rowIndex <= rowRange.e; rowIndex++) {
        const row = sheetData.rows[rowIndex];
        if (!hasSubformRowValue(row, mapping)) {
          continue;
        }
        let newRow: Row = {};
        const subFieldMetaMap = new Map<string, { subField: Field, subCellLocation: ExcelLocation, rawData: any }>();
        for (const [col, uid] of Object.entries(mapping)) {
          const colIndex = Number(col.replace('col-', ''));
          // 子表单字段校验
          const subField: Field = subtable.fields.find(field => field.uid === uid);

          const subCellLocation: ExcelLocation = { c: colIndex, r: rowIndex };
          subFieldMetaMap.set(uid, { subField, subCellLocation, rawData: row[colIndex] });
          const processRes = await processCellData(
            row[colIndex],
            subCellLocation,
            subField,
            sheetData,
            titleRowIndex,
            nocodeBody,
            subformMappings,
            userList,
            departmentList,
            undefined,
            buildSubFieldRowDataMap(rowDataMap, parentRowDataMap, subFields, newRow, subFormWidgetUid),
            parentRowDataMap,
            true,
          );
          if (!processRes.valid) {
            valid = false;
            reason = processRes.reason || getFieldReason(subField, "invalidFieldData");
            break rowLoop;
          }
          newRow[uid] = processRes.data;
        }
        for (const [uid, { subField, subCellLocation, rawData }] of subFieldMetaMap.entries()) {
          const processRes = await processCellData(
            rawData,
            subCellLocation,
            subField,
            sheetData,
            titleRowIndex,
            nocodeBody,
            subformMappings,
            userList,
            departmentList,
            undefined,
            buildSubFieldRowDataMap(rowDataMap, parentRowDataMap, subFields, newRow, subFormWidgetUid),
            parentRowDataMap,
            Boolean(skipRequiredValidation),
          );
          if (!processRes.valid) {
            valid = false;
            reason = processRes.reason || getFieldReason(subField, "invalidFieldData");
            break rowLoop;
          }
          newRow[uid] = processRes.data;
        }
        rows.push(newRow);
      }
      return { data: rows, valid, reason: !valid ? reason || getFieldReason(field, "invalidSubform") : undefined };
    }
  },
  {
    type: 'widget.form.relatedData',
    processor: async ({ data, field, relatedDataImportMap }) => {
      if (isExcelEmptyValue(data)) return { data: [], valid: true };

      const values = parseRelatedDataIds(data);

      const invalidUuid = values.find(item => !RELATED_DATA_ID_REGEX.test(item));
      if (invalidUuid) {
        return {
          data: values,
          valid: false,
          reason: getFieldReason(field, "invalidRelatedDataUuid", { value: invalidUuid }),
        };
      }

      if (field?.meta?.extra?.relatedDataMode === 'single' && values.length > 1) {
        return {
          data: values,
          valid: false,
          reason: getFieldReason(field, "invalidRelatedDataSingle"),
        };
      }

      const relatedTableUID = field?.meta?.extra?.relatedTableUID?.[1];
      const relatedUuidSet = relatedTableUID ? relatedDataImportMap?.[relatedTableUID] : undefined;
      if (relatedUuidSet) {
        const invalidValue = values.find(item => !relatedUuidSet.has(item));
        if (invalidValue) {
          return {
            data: values,
            valid: false,
            reason: getFieldReason(field, "invalidRelatedDataNotFound", { value: invalidValue }),
          };
        }
      }

      return {
        data: values,
        valid: true,
      };
    }
  },
  {
    type: 'widget.form.numberInput',
    processor: async ({ data, field }) => {
      data = parseNumberInputValue(data, field);
      let valid = !isNaN(data);
      return { data, valid, reason: !valid ? getFieldReason(field, "invalidNumber") : undefined };
    }
  },
  {
    type: 'widget.form.amountInput',
    processor: async ({ data, field }) => {
      data = parseNumberInputValue(data, field);
      let valid = !isNaN(data);
      return { data, valid, reason: !valid ? getFieldReason(field, "invalidNumber") : undefined };
    }
  },
  {
    type: 'widget.form.phoneInput',
    processor: async ({ data, field }) => {
      data = String(data);
      let valid = dataRegex.phone.test(data?.trim());
      return { data, valid, reason: !valid ? getFieldReason(field, "invalidPhone") : undefined };
    }
  },
  {
    type: 'widget.form.address',
    processor: async ({ data, field }) => {
      // e.g.河北省/石家庄市/长安区/建北街道 AA小区3栋2单元203
      let valid = dataRegex.address.test(data?.trim());
      return { data, valid, reason: !valid ? getFieldReason(field, "invalidAddress") : undefined };
    }
  },
  {
    type: 'widget.form.datePicker',
    processor: async ({ data, field }) => {
      if (['', null].includes(data)) return { data: '', valid: true };

      let instance: dayjs.Dayjs = customDayjs(data);
      let valid = instance?.isValid();
      if (valid) {
        // data = instance.format(field.meta.extra.format);
        data = instance.format("YYYY-MM-DD HH:mm:ss");
      }
      return { data, valid, reason: !valid ? getFieldReason(field, "invalidDate") : undefined };
    }
  },
  {
    type: 'widget.form.dateRangePicker',
    processor: async ({ data, field }) => {
      if (['', null].includes(data)) return { data: [], valid: true };

      let valid = true;
      let timeArr: any[] = data?.split(',');
      if (!Array.isArray(timeArr) || timeArr.length !== 2) {
        valid = false;
      } else {
        for (const i in timeArr) {
          let time = timeArr[i];
          let instance: dayjs.Dayjs = customDayjs(time);
          valid = instance?.isValid();
          if (!valid) break;
          // time = instance.format(field.meta.extra.format);
          time = instance.format("YYYY-MM-DD HH:mm:ss");
        }
      }
      return { data: timeArr, valid, reason: !valid ? getFieldReason(field, "invalidDateRange") : undefined };
    }
  },
  {
    type: 'widget.form.memberSelect',
    processor: async ({ data, userList, field }) => {
      if (isExcelEmptyValue(data)) return { data: [], valid: true };

      let valid = true;
      let invalidValue = '';
      // 支持逗号分隔的多个成员
      const dataStr = String(data);
      if (dataStr.includes(',')) {
        const names = dataStr.split(',').map(name => name.trim());
        const ids = [];
        for (const name of names) {
          const user: NocodeUser = userList.find(user => user.realname === name);
          if (user) {
            ids.push(user.id);
          } else {
            valid = false;
            invalidValue = name;
            break;
          }
        }
        return {
          data: ids,
          valid,
          reason: !valid ? getFieldReason(field, "invalidMember", { value: invalidValue }) : undefined,
        };
      } else {
        const user: NocodeUser = userList.find(user => user.realname === data);
        if (user) data = [user.id];
        else {
          valid = false;
          invalidValue = String(data ?? '');
        }
        return {
          data,
          valid,
          reason: !valid ? getFieldReason(field, "invalidMember", { value: invalidValue }) : undefined,
        };
      }
    }
  },
  {
    type: 'widget.form.departmentSelect',
    processor: async ({ data, departmentList, field }) => {
      if (isExcelEmptyValue(data)) return { data: [], valid: true };

      let valid = true;
      let invalidValue = '';
      // 支持逗号分隔的多个部门
      const dataStr = String(data);
      if (dataStr.includes(',')) {
        const names = dataStr.split(',').map(name => name.trim());
        const ids = [];
        for (const name of names) {
          const dep: Department = findDepartmentByPath(name, departmentList);
          if (dep) {
            ids.push(dep.id);
          } else {
            valid = false;
            invalidValue = name;
            break;
          }
        }
        return {
          data: ids,
          valid,
          reason: !valid ? getFieldReason(field, "invalidDepartment", { value: invalidValue }) : undefined,
        };
      } else {
        const dep: Department = findDepartmentByPath(String(data), departmentList);
        if (dep) data = [dep.id];
        else {
          valid = false;
          invalidValue = String(data ?? '');
        }
        return {
          data,
          valid,
          reason: !valid ? getFieldReason(field, "invalidDepartment", { value: invalidValue }) : undefined,
        };
      }
    }
  },
  {
    type: "widget.form.checkboxGroup",
    processor: parseMultiValueField
  },
  {
    type: "widget.form.treeMultipleSelect",
    processor: parseMultiValueField
  },
  {
    type: "widget.form.tagInput",
    processor: parseMultiValueField
  },
  {
    type: "widget.form.switch",
    processor: async ({ data, cellLocation, field, sheetData, titleRowIndex, subformMappings, nocodeBody }) => {
      let value: boolean;
      if (typeof data === "boolean") {
        value = data;
      } else if (typeof data === "string") {
        const text = data.trim();
        const lowerText = text.toLowerCase();
        if (lowerText === "true") value = true;
        else if (lowerText === "false") value = false;
        const format = field.meta.extra.format;
        if (value === void 0 && format && Array.isArray(format)) {
          if (text === format[0]) value = true;
          else if (text === format[1]) value = false;
        }
      }
      const valid = value !== void 0;
      return {
        data: value,
        valid,
        reason: !valid ? getFieldReason(field, "invalidSwitch") : undefined,
      }
    }
  }
]

/**
 * 按路径匹配部门，支持 "主部门.子部门" 层级格式。
 * 单段名称时退回按 name 直接匹配，保持向后兼容。
 */
function findDepartmentByPath(path: string, departmentList: Department[]): Department | undefined {
  const parts = path.split('.');
  if (parts.length === 1) {
    return departmentList.find(dep => dep.name === path);
  }
  const depIds = new Set(departmentList.map(d => d.id));
  let currentId: string | undefined = undefined;
  let matched: Department | undefined;
  for (const part of parts) {
    if (currentId === undefined) {
      matched = departmentList.find(d => d.name === part && !depIds.has(d.parent));
    } else {
      matched = departmentList.find(d => d.name === part && d.parent === currentId);
    }
    if (!matched) return undefined;
    currentId = matched.id;
  }
  return matched;
}

export async function processCellData(
  data: any, cellLocation: ExcelLocation, field: Field, sheetData: SheetData, titleRowIndex: number,
  nocodeBody: NocodeBody, subformMappings?: ExcelSubformColMaps, userList?: NocodeUser[], departmentList?: Department[],
  relatedDataImportMap?: Record<string, Set<string>>,
  rowDataMap?: Record<string, any>,
  parentRowDataMap?: Record<string, any>,
  skipRequiredValidation: boolean = false,
) {
  const specialFieldProcess = specialFieldProcessArr.find(item => item.type === field?.meta?.extra?.widgetType);
  let processRes: SpecialFieldProcessRes = { data, valid: true };

  // 检查是否为必填字段且数据为空
  if (!skipRequiredValidation && shouldValidateImportRequired(field, rowDataMap, nocodeBody?.formData?.tables?.find(table => table.uid === field?.meta?.extra?.subTableUID?.[1])?.fields || nocodeBody?.formData?.tables?.find(table => table.fields?.some(item => item.uid === field?.uid))?.fields || [], nocodeBody, field?.meta?.extra?.subTableUID?.[1] || nocodeBody?.formData?.tables?.find(table => table.fields?.some(item => item.uid === field?.uid))?.uid)) {
    if (isExcelEmptyValue(data)) {
      processRes.valid = false;
      processRes.reason = getFieldReason(field, "requiredFieldEmpty");
      return processRes;
    }
  }

  if (specialFieldProcess) {
    processRes = await specialFieldProcess.processor({ data, cellLocation, field, sheetData, titleRowIndex, subformMappings, nocodeBody, userList, departmentList, relatedDataImportMap, rowDataMap, parentRowDataMap, skipRequiredValidation });
  }
  if (!processRes.valid && !processRes.reason) {
    processRes.reason = getFieldReason(field, "invalidFieldData");
  }
  return processRes;
}

const CUSTOM_DATE_FORMATS = [
  // === 完整日期时间格式（优先匹配） ===
  // 冒号分隔（24小时制）
  // 2位表示（优先）
  'YYYY年MM月DD日 HH:mm:ss',
  'YYYY年MM月D日 HH:mm:ss',
  'YYYY年M月DD日 HH:mm:ss',
  'YYYY年M月D日 HH:mm:ss',
  // 新增混合位数格式
  'YYYY年MM月DD日 H:mm:ss',
  'YYYY年MM月D日 H:mm:ss',
  'YYYY年M月DD日 H:mm:ss',
  'YYYY年M月D日 H:mm:ss',
  'YYYY年MM月DD日 HH:m:ss',
  'YYYY年MM月D日 HH:m:ss',
  'YYYY年M月DD日 HH:m:ss',
  'YYYY年M月D日 HH:m:ss',
  'YYYY年MM月DD日 HH:mm:s',
  'YYYY年MM月D日 HH:mm:s',
  'YYYY年M月DD日 HH:mm:s',
  'YYYY年M月D日 HH:mm:s',
  'YYYY年MM月DD日 HH:mm',
  'YYYY年MM月D日 HH:mm',
  'YYYY年M月DD日 HH:mm',
  'YYYY年M月D日 HH:mm',
  // 新增混合位数格式
  'YYYY年MM月DD日 H:mm',
  'YYYY年MM月D日 H:mm',
  'YYYY年M月DD日 H:mm',
  'YYYY年M月D日 H:mm',
  'YYYY年MM月DD日 HH:m',
  'YYYY年MM月D日 HH:m',
  'YYYY年M月DD日 HH:m',
  'YYYY年M月D日 HH:m',
  'YYYY年MM月DD日 HH',
  'YYYY年MM月D日 HH',
  'YYYY年M月DD日 HH',
  'YYYY年M月D日 HH',
  // 新增混合位数格式
  'YYYY年MM月DD日 H',
  'YYYY年MM月D日 H',
  'YYYY年M月DD日 H',
  'YYYY年M月D日 H',
  // 1位表示
  'YYYY年MM月DD日 H:m:s',
  'YYYY年MM月D日 H:m:s',
  'YYYY年M月DD日 H:m:s',
  'YYYY年M月D日 H:m:s',
  'YYYY年MM月DD日 H:m',
  'YYYY年MM月D日 H:m',
  'YYYY年M月DD日 H:m',
  'YYYY年M月D日 H:m',
  'YYYY年MM月DD日 H',
  'YYYY年MM月D日 H',
  'YYYY年M月DD日 H',
  'YYYY年M月D日 H',

  // 中文单位分隔
  // 2位表示（优先）
  'YYYY年MM月DD日 HH时mm分ss秒',
  'YYYY年MM月D日 HH时mm分ss秒',
  'YYYY年M月DD日 HH时mm分ss秒',
  'YYYY年M月D日 HH时mm分ss秒',
  // 新增混合位数格式
  'YYYY年MM月DD日 H时mm分ss秒',
  'YYYY年MM月D日 H时mm分ss秒',
  'YYYY年M月DD日 H时mm分ss秒',
  'YYYY年M月D日 H时mm分ss秒',
  'YYYY年MM月DD日 HH时m分ss秒',
  'YYYY年MM月D日 HH时m分ss秒',
  'YYYY年M月DD日 HH时m分ss秒',
  'YYYY年M月D日 HH时m分ss秒',
  'YYYY年MM月DD日 HH时mm分s秒',
  'YYYY年MM月D日 HH时mm分s秒',
  'YYYY年M月DD日 HH时mm分s秒',
  'YYYY年M月D日 HH时mm分s秒',
  'YYYY年MM月DD日 HH时mm分',
  'YYYY年MM月D日 HH时mm分',
  'YYYY年M月DD日 HH时mm分',
  'YYYY年M月D日 HH时mm分',
  // 新增混合位数格式
  'YYYY年MM月DD日 H时mm分',
  'YYYY年MM月D日 H时mm分',
  'YYYY年M月DD日 H时mm分',
  'YYYY年M月D日 H时mm分',
  'YYYY年MM月DD日 HH时m分',
  'YYYY年MM月D日 HH时m分',
  'YYYY年M月DD日 HH时m分',
  'YYYY年M月D日 HH时m分',
  'YYYY年MM月DD日 HH时',
  'YYYY年MM月D日 HH时',
  'YYYY年M月DD日 HH时',
  'YYYY年M月D日 HH时',
  // 新增混合位数格式
  'YYYY年MM月DD日 H时',
  'YYYY年MM月D日 H时',
  'YYYY年M月DD日 H时',
  'YYYY年M月D日 H时',
  // 1位表示
  'YYYY年MM月DD日 H时m分s秒',
  'YYYY年MM月D日 H时m分s秒',
  'YYYY年M月DD日 H时m分s秒',
  'YYYY年M月D日 H时m分s秒',
  'YYYY年MM月DD日 H时m分',
  'YYYY年MM月D日 H时m分',
  'YYYY年M月DD日 H时m分',
  'YYYY年M月D日 H时m分',
  'YYYY年MM月DD日 H时',
  'YYYY年MM月D日 H时',
  'YYYY年M月DD日 H时',
  'YYYY年M月D日 H时',

  // /分隔
  // 2位表示（优先）
  'YYYY/MM/DD HH:mm:ss',
  'YYYY/MM/D HH:mm:ss',
  'YYYY/M/DD HH:mm:ss',
  'YYYY/M/D HH:mm:ss',
  // 新增混合位数格式
  'YYYY/MM/DD H:mm:ss',
  'YYYY/MM/D H:mm:ss',
  'YYYY/M/DD H:mm:ss',
  'YYYY/M/D H:mm:ss',
  'YYYY/MM/DD HH:m:ss',
  'YYYY/MM/D HH:m:ss',
  'YYYY/M/DD HH:m:ss',
  'YYYY/M/D HH:m:ss',
  'YYYY/MM/DD HH:mm:s',
  'YYYY/MM/D HH:mm:s',
  'YYYY/M/DD HH:mm:s',
  'YYYY/M/D HH:mm:s',
  'YYYY/MM/DD HH:mm',
  'YYYY/MM/D HH:mm',
  'YYYY/M/DD HH:mm',
  'YYYY/M/D HH:mm',
  // 新增混合位数格式
  'YYYY/MM/DD H:mm',
  'YYYY/MM/D H:mm',
  'YYYY/M/DD H:mm',
  'YYYY/M/D H:mm',
  'YYYY/MM/DD HH:m',
  'YYYY/MM/D HH:m',
  'YYYY/M/DD HH:m',
  'YYYY/M/D HH:m',
  'YYYY/MM/DD HH',
  'YYYY/MM/D HH',
  'YYYY/M/DD HH',
  'YYYY/M/D HH',
  // 新增混合位数格式
  'YYYY/MM/DD H',
  'YYYY/MM/D H',
  'YYYY/M/DD H',
  'YYYY/M/D H',
  // 1位表示
  'YYYY/MM/DD H:m:s',
  'YYYY/MM/D H:m:s',
  'YYYY/M/DD H:m:s',
  'YYYY/M/D H:m:s',
  'YYYY/MM/DD H:m',
  'YYYY/MM/D H:m',
  'YYYY/M/DD H:m',
  'YYYY/M/D H:m',
  'YYYY/MM/DD H',
  'YYYY/MM/D H',
  'YYYY/M/DD H',
  'YYYY/M/D H',

  // -分隔
  // 2位表示（优先）
  'YYYY-MM-DD HH:mm:ss',
  'YYYY-MM-D HH:mm:ss',
  'YYYY-M-DD HH:mm:ss',
  'YYYY-M-D HH:mm:ss',
  // 新增混合位数格式
  'YYYY-MM-DD H:mm:ss',
  'YYYY-MM-D H:mm:ss',
  'YYYY-M-DD H:mm:ss',
  'YYYY-M-D H:mm:ss',
  'YYYY-MM-DD HH:m:ss',
  'YYYY-MM-D HH:m:ss',
  'YYYY-M-DD HH:m:ss',
  'YYYY-M-D HH:m:ss',
  'YYYY-MM-DD HH:mm:s',
  'YYYY-MM-D HH:mm:s',
  'YYYY-M-DD HH:mm:s',
  'YYYY-M-D HH:mm:s',
  'YYYY-MM-DD HH:mm',
  'YYYY-MM-D HH:mm',
  'YYYY-M-DD HH:mm',
  'YYYY-M-D HH:mm',
  // 新增混合位数格式
  'YYYY-MM-DD H:mm',
  'YYYY-MM-D H:mm',
  'YYYY-M-DD H:mm',
  'YYYY-M-D H:mm',
  'YYYY-MM-DD HH:m',
  'YYYY-MM-D HH:m',
  'YYYY-M-DD HH:m',
  'YYYY-M-D HH:m',
  'YYYY-MM-DD HH',
  'YYYY-MM-D HH',
  'YYYY-M-DD HH',
  'YYYY-M-D HH',
  // 新增混合位数格式
  'YYYY-MM-DD H',
  'YYYY-MM-D H',
  'YYYY-M-DD H',
  'YYYY-M-D H',
  // 1位表示
  'YYYY-MM-DD H:m:s',
  'YYYY-MM-D H:m:s',
  'YYYY-M-DD H:m:s',
  'YYYY-M-D H:m:s',
  'YYYY-MM-DD H:m',
  'YYYY-MM-D H:m',
  'YYYY-M-DD H:m',
  'YYYY-M-D H:m',
  'YYYY-MM-DD H',
  'YYYY-MM-D H',
  'YYYY-M-DD H',
  'YYYY-M-D H',

  // .分隔
  // 2位表示（优先）
  'YYYY.MM.DD HH:mm:ss',
  'YYYY.MM.D HH:mm:ss',
  'YYYY.M.DD HH:mm:ss',
  'YYYY.M.D HH:mm:ss',
  // 新增混合位数格式
  'YYYY.MM.DD H:mm:ss',
  'YYYY.MM.D H:mm:ss',
  'YYYY.M.DD H:mm:ss',
  'YYYY.M.D H:mm:ss',
  'YYYY.MM.DD HH:m:ss',
  'YYYY.MM.D HH:m:ss',
  'YYYY.M.DD HH:m:ss',
  'YYYY.M.D HH:m:ss',
  'YYYY.MM.DD HH:mm:s',
  'YYYY.MM.D HH:mm:s',
  'YYYY.M.DD HH:mm:s',
  'YYYY.M.D HH:mm:s',
  'YYYY.MM.DD HH:mm',
  'YYYY.MM.D HH:mm',
  'YYYY.M.DD HH:mm',
  'YYYY.M.D HH:mm',
  // 新增混合位数格式
  'YYYY.MM.DD H:mm',
  'YYYY.MM.D H:mm',
  'YYYY.M.DD H:mm',
  'YYYY.M.D H:mm',
  'YYYY.MM.DD HH:m',
  'YYYY.MM.D HH:m',
  'YYYY.M.DD HH:m',
  'YYYY.M.D HH:m',
  'YYYY.MM.DD HH',
  'YYYY.MM.D HH',
  'YYYY.M.DD HH',
  'YYYY.M.D HH',
  // 新增混合位数格式
  'YYYY.MM.DD H',
  'YYYY.MM.D H',
  'YYYY.M.DD H',
  'YYYY.M.D H',
  // 1位表示
  'YYYY.MM.DD H:m:s',
  'YYYY.MM.D H:m:s',
  'YYYY.M.DD H:m:s',
  'YYYY.M.D H:m:s',
  'YYYY.MM.DD H:m',
  'YYYY.MM.D H:m',
  'YYYY.M.DD H:m',
  'YYYY.M.D H:m',
  'YYYY.MM.DD H',
  'YYYY.MM.D H',
  'YYYY.M.DD H',
  'YYYY.M.D H',

  // === 仅日期格式（次优先） ===
  'YYYY年MM月DD日',
  'YYYY年MM月D日',
  'YYYY年M月DD日',
  'YYYY年M月D日',
  'MM月',
  'M月',
  'YYYY年',
  'DD日',
  'D日',

  // === 仅时间格式（最后尝试） ===
  'HH时mm分ss秒',
  'H时m分s秒',
  'HH时mm分',
  'H时m分',
  'mm分ss秒',
  'm分s秒',
  'HH时',
  'H时',
];

export function customDayjs(dateInput: string | Date | dayjs.Dayjs): dayjs.Dayjs | null {
  if (!dateInput) return null;

  let instance: dayjs.Dayjs = dayjs(dateInput);
  if (instance.isValid()) return instance;

  instance = dayjs(dateInput, CUSTOM_DATE_FORMATS, true); // 第三个参数 `true` 表示严格模式
  return instance;
}

export function isStrictCustomDateString(dateInput: string) {
  return !!parseStrictCustomDateInfo(dateInput);
}

const STRICT_DATE_PRECISION_ORDER: StrictDatePrecision[] = ["year", "month", "day", "hour", "minute", "second"];
const STRICT_CUSTOM_DATE_EXTRA_FORMATS = [
  "YYYY",
  "YYYY-MM",
  "YYYY-M",
  "YYYY/MM",
  "YYYY/M",
  "YYYY.MM",
  "YYYY.M",
  "YYYY-MM-DD",
  "YYYY-MM-D",
  "YYYY-M-DD",
  "YYYY-M-D",
  "YYYY/MM/DD",
  "YYYY/MM/D",
  "YYYY/M/DD",
  "YYYY/M/D",
  "YYYY.MM.DD",
  "YYYY.MM.D",
  "YYYY.M.DD",
  "YYYY.M.D",
];

const inferStrictDatePrecisionFromFormat = (format: string): StrictDatePrecision => {
  const formatWithoutMonthToken = format.replace(/M/g, '');
  if (/s/.test(formatWithoutMonthToken)) {
    return "second";
  }
  if (/m/.test(formatWithoutMonthToken)) {
    return "minute";
  }
  if (/[Hh]/.test(formatWithoutMonthToken)) {
    return "hour";
  }
  if (/[Dd]/.test(format)) {
    return "day";
  }
  if (/M/.test(format)) {
    return "month";
  }
  return "year";
}

const normalizeStrictDateByPrecision = (date: dayjs.Dayjs, precision: StrictDatePrecision) => {
  switch (precision) {
    case "year":
      return date.startOf("year");
    case "month":
      return date.startOf("month");
    case "day":
      return date.startOf("day");
    case "hour":
      return date.startOf("hour");
    case "minute":
      return date.startOf("minute");
    default:
      return date;
  }
}

export function parseStrictCustomDateInfo(dateInput: string): StrictDateInfo | null {
  if (typeof dateInput !== "string" || !dateInput) return null;

  for (const format of [...STRICT_CUSTOM_DATE_EXTRA_FORMATS, ...CUSTOM_DATE_FORMATS]) {
    const date = dayjs(dateInput, format, true);
    if (date.isValid()) {
      return {
        date,
        precision: inferStrictDatePrecisionFromFormat(format),
      };
    }
  }

  return null;
}

export function normalizeStrictCustomDate(dateInput: string) {
  const info = parseStrictCustomDateInfo(dateInput);
  if (!info) return null;
  return normalizeStrictDateByPrecision(info.date, info.precision);
}

export function compareStrictCustomDateInfo(dateA: string, dateB: string) {
  const infoA = parseStrictCustomDateInfo(dateA);
  const infoB = parseStrictCustomDateInfo(dateB);
  if (!infoA || !infoB) return null;

  const precision = STRICT_DATE_PRECISION_ORDER[
    Math.min(
      STRICT_DATE_PRECISION_ORDER.indexOf(infoA.precision),
      STRICT_DATE_PRECISION_ORDER.indexOf(infoB.precision)
    )
  ];

  return {
    dateA: normalizeStrictDateByPrecision(infoA.date, precision),
    dateB: normalizeStrictDateByPrecision(infoB.date, precision),
    precision,
  };
}
