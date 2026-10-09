import dayjs from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import weekOfYear from "dayjs/plugin/weekOfYear";
import isoWeek from "dayjs/plugin/isoWeek";
import advancedFormat from "dayjs/plugin/advancedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { reactive, watch } from "vue";
import { formatNumberWithSeparator } from "@common/utils/amount";
import { OptionFieldUID } from "@common/types/project";
import { DefinedOptions, OptionFieldValue, WidgetMetaData } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { Widget } from "@renderer/b2/controllers/widget";
import { WidgetSoul } from "@common/types/project";
import resource from "./locales";
import i18next from "@renderer/widgets/i18next";
import { formatFloat } from "@common/utils/math";
import {
  evaluateBucketStageTableAggregateField,
  evaluateRowStageTableAggregateField,
  expandTableAggregateDataUids,
  getTableAggregateFieldMeta,
  resolveTableAggregateSingleFieldDependencyPath,
  shouldBypassSecondarySummary,
} from "../../basic/_common/tableAggregateField";
import {
  formatPivotIndicatorValueByExtra,
  resolvePivotIndicatorFieldFormat,
  type PivotIndicatorFieldFormat,
} from "./pivot-format";

type PivotIndicatorSide = "top" | "left";
type PivotMultiValueMode = "split" | "join";
type PivotOptionFieldValue = OptionFieldValue & {
  multiValueMode?: PivotMultiValueMode;
};

export const PIVOT_TABLE_WIDGET_HEADER_HEIGHT = 34;
export const PIVOT_TABLE_WIDGET_DIMENSION_WIDTH = 120;
export const PIVOT_TABLE_WIDGET_DEFAULT_COLUMN_WIDTH = 100;
const PIVOT_TABLE_WIDGET_MIN_COLUMN_WIDTH = 100;

dayjs.extend(quarterOfYear);
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);

type PivotIndicatorRuntime = {
  key: string;
  field: PivotOptionFieldValue;
  fieldUID: string;
  dependencyFieldUIDs: string[];
  subFormFieldUIDs: string[];
  alias: string;
  summary: string;
  bucketStage: boolean;
  dataFormat?: string;
  fieldFormat?: PivotIndicatorFieldFormat;
};

type PivotRuntimeRecord = Record<string, any> & {
  __pivotRowIndex: number;
  __pivotSourceRow: Record<string, any>;
  __pivotParentRow: Record<string, any>;
  __pivotParentRowIndex: number;
};

type PivotDimensionRuntime = {
  key: string;
  field: PivotOptionFieldValue;
  alias: string;
  summary: string;
  dataFormat?: string;
  multiValueMode: PivotMultiValueMode;
};

type PivotRuntimeSourceRow = {
  row: Record<string, any>;
  parentRow: Record<string, any>;
  parentRowIndex: number;
  isFirstSubRow: boolean;
};

type PivotAggregateParentRow = {
  parentRow: Record<string, any>;
  parentRowIndex: number;
};

const PIVOT_AGGREGATE_SOURCE_ROWS_KEY = "__pivotAggregateSourceRows";
const PIVOT_AGGREGATE_PARENT_ROWS_KEY = "__pivotAggregateParentRows";

const SUMMARY_TIME_FORMATTERS: Record<string, (date: dayjs.Dayjs) => string> = {
  YYYY_Y: (date) => i18next.t("yearFormat", { year: date.format("YYYY") }),
  YYYY: (date) => date.format("YYYY"),
  YY_Y: (date) => i18next.t("yearFormat", { year: date.format("YY") }),
  YY: (date) => date.format("YY"),
  YYYY_Q: (date) => i18next.t("yearQuarterFormat", { year: date.format("YYYY"), quarter: date.quarter() }),
  "YYYY/Q": (date) => `${date.format("YYYY")}/Q${date.quarter()}`,
  "YY/Q": (date) => `${date.format("YY")}/Q${date.quarter()}`,
  YYYY_Y_MM_M: (date) => i18next.t("yearMonthFormat", { year: date.format("YYYY"), month: date.format("MM") }),
  "YYYY/MM_M": (date) => i18next.t("yearSlashMonthFormat", { year: date.format("YYYY"), month: date.format("MM") }),
  "YYYY/MM": (date) => date.format("YYYY/MM"),
  "YY/MM": (date) => date.format("YY/MM"),
  YYYY_Y_WW_W: (date) => i18next.t("yearWeekFormat", { year: date.format("YYYY"), week: date.isoWeek() }),
  "YYYY/WW_W": (date) => i18next.t("yearSlashWeekFormat", { year: date.format("YYYY"), week: date.isoWeek() }),
  "YY/WW_W": (date) => i18next.t("yearSlashWeekFormat", { year: date.format("YY"), week: date.isoWeek() }),
  YYYY_Y_MM_M_DD_D: (date) => i18next.t("yearMonthDayFormat", { year: date.format("YYYY"), month: date.format("MM"), day: date.format("DD") }),
  "YYYY/MM/DD": (date) => date.format("YYYY/MM/DD"),
  "YY/MM/DD": (date) => date.format("YY/MM/DD"),
  MM_M_DD_D: (date) => i18next.t("monthDayFormat", { month: date.format("MM"), day: date.format("DD") }),
  "MM/DD": (date) => date.format("MM/DD"),
};

const normalizeOptionUIDKey = (uid?: OptionFieldUID | null) => {
  if (!Array.isArray(uid)) return "";
  return uid.join(".");
};

const normalizeFieldCode = (field?: OptionFieldValue | null, index = 0) => {
  if (!field?.uid?.length) return `field_${index}`;
  return normalizeOptionUIDKey(field.uid).replace(/[^\w.-]/g, "_");
};

const resolveRawFieldUID = (field?: OptionFieldValue | null) => {
  if (!field?.uid?.length) return "";
  return field.uid[field.uid.length - 1] || "";
};

const resolveFieldUID = (field?: OptionFieldValue | null) => {
  return field?.uid?.[2] || "";
};

const normalizeDependencyFieldUID = (dependency?: string, tableUID?: string) => {
  const ids = String(dependency || "")
    .split(".")
    .filter(Boolean);
  if (tableUID && ids[0] === tableUID) {
    ids.shift();
  }
  return ids.join(".");
};

const splitFieldUID = (fieldUID?: string) => {
  return String(fieldUID || "")
    .split(".")
    .filter(Boolean);
};

const resolveSubFormFieldUIDByFieldUID = (fieldUID?: string) => {
  const ids = splitFieldUID(fieldUID);
  return ids.length > 1 ? ids[0] || "" : "";
};

const resolveSubFieldUIDByFieldUID = (fieldUID?: string) => {
  const ids = splitFieldUID(fieldUID);
  return ids.length > 1 ? ids[1] || "" : "";
};

const resolveSubFormFieldUID = (field?: PivotOptionFieldValue | null) => {
  return resolveSubFormFieldUIDByFieldUID(resolveFieldUID(field));
};

const isSubFormFieldUID = (fieldUID?: string) => {
  return Boolean(resolveSubFormFieldUIDByFieldUID(fieldUID));
};

const isEntityField = (field: any) => {
  return field?.meta?.subType === "account" || field?.meta?.subType === "department";
};

const isEntityDisplayField = (field?: OptionFieldValue | null) => {
  return resolveRawFieldUID(field).endsWith("_entity");
};

const resolveBaseEntityFieldUID = (field?: OptionFieldValue | null) => {
  const fieldUID = resolveFieldUID(field);
  if (!fieldUID) return "";
  return fieldUID.endsWith("_entity") ? fieldUID.replace(/_entity$/, "") : fieldUID;
};

const resolveFieldAlias = (widget: Widget, field?: OptionFieldValue | null, fallback = "") => {
  if (!field?.uid?.length) return fallback;
  const rawFieldAlias = widget.getFieldAlias(field.uid) || field.alias || field.uid?.[2] || fallback;
  const fieldInfo = widget.getField(field.uid);
  const subFormFieldUID = resolveSubFormFieldUID(field);
  const subFormFieldAlias = subFormFieldUID && field.uid.length >= 3
    ? widget.getFieldAlias([...field.uid.slice(0, 2), subFormFieldUID])
    : "";
  const baseFieldUID = resolveBaseEntityFieldUID(field);
  const baseField = baseFieldUID && field.uid.length >= 3
    ? widget.getField([...field.uid.slice(0, 2), baseFieldUID])
    : undefined;
  const formatFieldAlias = (fieldAlias: string) => {
    if (!subFormFieldAlias || !fieldAlias) return fieldAlias;
    return fieldAlias.startsWith(`${subFormFieldAlias}.`) ? fieldAlias : `${subFormFieldAlias}.${fieldAlias}`;
  };

  if (isEntityField(fieldInfo) && !isEntityDisplayField(field)) {
    return formatFieldAlias(`${rawFieldAlias}(ID)`);
  }

  if (isEntityDisplayField(field) && isEntityField(baseField)) {
    return formatFieldAlias(
      widget.getFieldAlias([...field.uid.slice(0, 2), baseFieldUID]) || rawFieldAlias.replace(/_entity$/, "")
    );
  }

  if (isEntityField(baseField) && !isEntityDisplayField(field)) {
    return formatFieldAlias(`${rawFieldAlias}(ID)`);
  }

  return formatFieldAlias(rawFieldAlias);
};

const resolveFieldValue = (row: Record<string, any>, fieldUID?: string) => {
  if (!fieldUID) return undefined;
  return row?.[fieldUID];
};

const resolveAggregateSliceRows = (slice: Record<string, any>[]) => {
  const sourceRows: Record<string, any>[] = [];
  const parentRowMap = new Map<number, Record<string, any>>();

  slice.forEach((item) => {
    const aggregateSourceRows = Array.isArray(item?.[PIVOT_AGGREGATE_SOURCE_ROWS_KEY])
      ? item[PIVOT_AGGREGATE_SOURCE_ROWS_KEY]
      : [];
    if (aggregateSourceRows.length) {
      sourceRows.push(...aggregateSourceRows);
    } else if (item?.__pivotSourceRow) {
      sourceRows.push(item.__pivotSourceRow);
    }

    const aggregateParentRows = Array.isArray(item?.[PIVOT_AGGREGATE_PARENT_ROWS_KEY])
      ? item[PIVOT_AGGREGATE_PARENT_ROWS_KEY]
      : [];
    if (aggregateParentRows.length) {
      aggregateParentRows.forEach((parentItem: PivotAggregateParentRow) => {
        if (
          Number.isInteger(parentItem?.parentRowIndex)
          && parentItem?.parentRow
          && !parentRowMap.has(parentItem.parentRowIndex)
        ) {
          parentRowMap.set(parentItem.parentRowIndex, parentItem.parentRow);
        }
      });
      return;
    }

    if (Number.isInteger(item?.__pivotParentRowIndex) && item?.__pivotParentRow && !parentRowMap.has(item.__pivotParentRowIndex)) {
      parentRowMap.set(item.__pivotParentRowIndex, item.__pivotParentRow);
    }
  });

  return {
    sourceRows,
    parentRows: Array.from(parentRowMap.entries()).map(([parentRowIndex, parentRow]) => ({
      parentRowIndex,
      parentRow,
    })),
  };
};

const resolveSubFormFieldValues = (row: Record<string, any>, fieldUID?: string) => {
  const subFormFieldUID = resolveSubFormFieldUIDByFieldUID(fieldUID);
  const subFieldUID = resolveSubFieldUIDByFieldUID(fieldUID);
  if (!subFormFieldUID || !subFieldUID) return [];

  const subRows = Array.isArray(row?.[subFormFieldUID]) ? row[subFormFieldUID] : [];
  return subRows
    .map((subRow) => subRow?.[subFieldUID])
    .filter((value) => value !== undefined);
};

const resolveFieldDependencyFieldUIDs = (
  widget: Widget,
  field?: PivotOptionFieldValue | null,
) => {
  const fieldUID = resolveFieldUID(field);
  if (!field?.uid?.length || !fieldUID) return [];

  const meta = getTableAggregateFieldMeta(widget, field.uid);
  if (!meta) return [fieldUID];

  const dependencyFieldUIDs = (meta.dependencies || [])
    .map(dependency => normalizeDependencyFieldUID(dependency, field.uid?.[1]))
    .filter(Boolean);
  const expandedUIDs = expandTableAggregateDataUids(widget, [field.uid])
    .map(uid => normalizeDependencyFieldUID(uid?.[2], field.uid?.[1]))
    .filter(Boolean);
  const singleFieldDependencyFieldUID = normalizeDependencyFieldUID(
    resolveTableAggregateSingleFieldDependencyPath(widget, field.uid, meta.singleFieldConfig),
    field.uid?.[1],
  );
  if (
    dependencyFieldUIDs.length
    && dependencyFieldUIDs.every(dependencyFieldUID => dependencyFieldUID === "_count")
    && singleFieldDependencyFieldUID
  ) {
    return [singleFieldDependencyFieldUID];
  }
  if (dependencyFieldUIDs.length) {
    return Array.from(new Set(dependencyFieldUIDs));
  }

  if (singleFieldDependencyFieldUID) {
    return [singleFieldDependencyFieldUID];
  }

  if (meta.singleFieldConfig?.fieldUID || meta.singleFieldConfig?.subFieldUID) {
    const fallbackSingleFieldDependencyFieldUID = [
      meta.singleFieldConfig?.fieldUID,
      meta.singleFieldConfig?.subFieldUID,
    ].filter(Boolean).join(".");
    if (fallbackSingleFieldDependencyFieldUID) {
      return [fallbackSingleFieldDependencyFieldUID];
    }
  }

  if (expandedUIDs.length) {
    return Array.from(new Set(expandedUIDs));
  }

  return [fieldUID];
};

const resolveFieldSubFormFieldUIDs = (
  widget: Widget,
  field?: PivotOptionFieldValue | null,
) => {
  const subFormFieldUIDs = new Set<string>();
  resolveFieldDependencyFieldUIDs(widget, field).forEach((fieldUID) => {
    const subFormFieldUID = resolveSubFormFieldUIDByFieldUID(fieldUID);
    if (subFormFieldUID) {
      subFormFieldUIDs.add(subFormFieldUID);
    }
  });
  return Array.from(subFormFieldUIDs);
};

const normalizeFieldValue = (value: any) => {
  if (Array.isArray(value)) {
    return value.filter(item => item !== undefined && item !== null && item !== "");
  }

  if (typeof value === "string" && value.includes(",")) {
    return value
      .split(",")
      .map(item => item.trim())
      .filter(item => item !== "");
  }

  if (value === undefined || value === null || value === "") {
    return [];
  }

  return [value];
};

const getOrganizeItemName = (item: any) => {
  return item?.realname || item?.name || item?.label || item?.id || "";
};

const getOrganizeItemValue = (item: any) => {
  if (typeof item !== "object" || item === null) {
    return item;
  }
  return item?.id || item?.uid || item?.value || getOrganizeItemName(item);
};

const uniqueValues = (values: any[]) => {
  const result: any[] = [];
  const usedValues = new Set<string>();

  values.forEach((value) => {
    const normalizedValue = value ?? "";
    const cacheKey = typeof normalizedValue === "object"
      ? JSON.stringify(normalizedValue)
      : String(normalizedValue);

    if (usedValues.has(cacheKey)) return;
    usedValues.add(cacheKey);
    result.push(normalizedValue);
  });

  return result;
};

const resolveEntityDisplayValues = (value: any) => {
  return uniqueValues(normalizeFieldValue(value)
    .map((item) => {
      if (typeof item === "object") {
        return getOrganizeItemName(item);
      }
      return String(item ?? "");
    })
    .filter(Boolean));
};

const resolveEntityFieldValues = (value: any) => {
  return uniqueValues(normalizeFieldValue(value)
    .map((item) => getOrganizeItemValue(item))
    .filter((item) => item !== undefined && item !== null && item !== ""));
};

const resolveDimensionFieldValues = (
  widget: Widget,
  row: Record<string, any>,
  field?: PivotOptionFieldValue | null,
) => {
  const fieldUID = resolveFieldUID(field);
  if (!fieldUID) return [""];

  const rawValue = resolveFieldValue(row, fieldUID);
  const fieldInfo = field?.uid?.length ? widget.getField(field.uid) : undefined;
  const fieldType = fieldInfo?.revisedType || fieldInfo?.type;
  const baseFieldUID = resolveBaseEntityFieldUID(field);
  const baseField = baseFieldUID && field?.uid?.length
    ? widget.getField([...field.uid.slice(0, 2), baseFieldUID])
    : undefined;
  const resolvedEntityField = isEntityField(fieldInfo)
    ? fieldInfo
    : (isEntityDisplayField(field) && isEntityField(baseField) ? baseField : undefined);

  if (!resolvedEntityField) {
    if (fieldType === "array") {
      const multipleValues = uniqueValues(normalizeFieldValue(rawValue));
      return multipleValues.length ? multipleValues : [rawValue ?? ""];
    }
    return [rawValue ?? ""];
  }

  if (isEntityDisplayField(field)) {
    const formattedEntityValues = resolveEntityDisplayValues(rawValue);
    if (formattedEntityValues.length) {
      return formattedEntityValues;
    }

    const extraEntityValue = resolveFieldValue(row, `${baseFieldUID}_entity`);
    const formattedExtraEntityValues = resolveEntityDisplayValues(extraEntityValue);
    if (formattedExtraEntityValues.length) {
      return formattedExtraEntityValues;
    }
  }

  const entityValues = resolveEntityFieldValues(rawValue);
  return entityValues.length ? entityValues : [rawValue ?? ""];
};

const resolveMultiValueMode = (field?: PivotOptionFieldValue | null): PivotMultiValueMode => {
  return field?.multiValueMode === "join" ? "join" : "split";
};

const joinDimensionValues = (values: any[]) => {
  const normalizedValues = uniqueValues(values)
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  if (!normalizedValues.length) {
    return [""];
  }
  return [normalizedValues.sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).join(" / ")];
};

const resolveDateDimensionValue = (
  rawValue: any,
  fieldInfo: any,
  summary: string,
  dataFormat?: string,
) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return "";
  }

  const date = dayjs(rawValue, fieldInfo?.meta?.extra?.format);
  if (!date.isValid()) {
    return rawValue;
  }

  if (dataFormat && SUMMARY_TIME_FORMATTERS[dataFormat]) {
    return SUMMARY_TIME_FORMATTERS[dataFormat](date);
  }

  switch (summary) {
    case "year":
      return date.format("YYYY");
    case "year-quarter":
      return `${date.year()}-Q${date.quarter()}`;
    case "year-month":
      return date.format("YYYY-MM");
    case "year-week":
      return `${date.year()}-W${date.isoWeek()}`;
    case "year-month-day":
      return date.format("YYYY-MM-DD");
    default:
      return rawValue;
  }
};

const resolveRuntimeDimensionValues = (
  widget: Widget,
  row: Record<string, any>,
  dimension: PivotDimensionRuntime,
) => {
  const fieldInfo = dimension.field?.uid?.length ? widget.getField(dimension.field.uid) : undefined;
  const rawValues = resolveDimensionFieldValues(widget, row, dimension.field);
  if (
    fieldInfo?.meta?.subType === "date"
    || ["year", "year-quarter", "year-month", "year-week", "year-month-day"].includes(dimension.summary)
  ) {
    const values = uniqueValues(rawValues.map((rawValue) => (
      resolveDateDimensionValue(rawValue, fieldInfo, dimension.summary, dimension.dataFormat)
    )));
    return dimension.multiValueMode === "join" ? joinDimensionValues(values) : values;
  }
  const values = uniqueValues(rawValues);
  return dimension.multiValueMode === "join" ? joinDimensionValues(values) : values;
};

const toNumber = (value: any) => {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
};

const isEmptyValue = (value: any) => {
  return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
};

const aggregateValues = (values: any[], summary: string) => {
  switch (summary) {
    case "sum":
      return values.reduce((sum, value) => sum + toNumber(value), 0);
    case "mean":
      return values.length ? values.reduce((sum, value) => sum + toNumber(value), 0) / values.length : 0;
    case "max":
      return values.length ? Math.max(...values.map(value => toNumber(value))) : 0;
    case "min":
      return values.length ? Math.min(...values.map(value => toNumber(value))) : 0;
    case "count":
      return values.filter(value => !isEmptyValue(value)).length;
    case "distinct":
      return Array.from(new Set(values.filter(value => !isEmptyValue(value)).map(value => JSON.stringify(value)))).length;
    case "none":
    default:
      return values[0];
  }
};

const formatIndicatorValue = (value: any, indicator: PivotIndicatorRuntime) => {
  if (value === null || value === undefined || value === "") return value;

  const formattedValue = formatPivotIndicatorValueByExtra(value, indicator.fieldFormat);
  if (formattedValue !== value) {
    return formattedValue;
  }

  // const dataFormat = String(indicator.dataFormat || "").trim();
  // if (!dataFormat) return value;

  // const numericValue = Number(value);
  // if (!Number.isFinite(numericValue)) return value;

  // if (dataFormat === "percent") {
  //   return `${formatFloat(numericValue * 100, 2, false)}%`;
  // }

  // if (dataFormat === "thousandSeparator") {
  //   return formatNumberWithSeparator(numericValue, {
  //     decimalPlaces: 2,
  //     completeZero: false,
  //     thousandSeparator: ",",
  //   });
  // }

  return value;
};

const encodeDrillKey = (path: string[]) => {
  if (!path.length) {
    return "key:@total@";
  }
  return `key:${path.join(" ")}`;
};

const collectExpandKeys = (records: Record<string, any>[], dimCodes: string[]) => {
  if (!dimCodes.length) return [];
  const keySet = new Set<string>();

  records.forEach((record) => {
    const path: string[] = [];
    dimCodes.forEach((code, index) => {
      path.push(String(record?.[code] ?? ""));
      if (index < dimCodes.length - 1) {
        keySet.add(encodeDrillKey(path));
      }
    });
  });

  return Array.from(keySet);
};

const filterExpandKeys = (currentKeys: string[], availableKeys: string[]) => {
  if (!currentKeys.length || !availableKeys.length) {
    return [];
  }
  const keySet = new Set(availableKeys);
  return currentKeys.filter((key) => keySet.has(key));
};

const normalizePivotTableSize = (value: unknown, fallback: number, minValue: number) => {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return fallback;
  }
  return Math.max(minValue, Math.round(nextValue));
};

export class PivotTableWidget extends Widget {
  static resource = resource;

  constructor(soul: WidgetSoul, parent: Widget | Board) {
    super(soul, parent);
    this.initRuntimeState();
  }

  get defaultName() {
    return i18next.t("defaultName");
  }

  static defineOptions(): DefinedOptions[] {
    return [{
      data: {
        fields: {
          alias: i18next.t("fieldSetting"),
          fold: "unfold",
          children: [
            {
              name: "row-fields",
              alias: i18next.t("rowFields"),
              type: "field(multiValueModes=split|join)",
            },
            {
              name: "column-fields",
              alias: i18next.t("columnFields"),
              type: "field(multiValueModes=split|join)",
            },
            {
              name: "indicator-fields",
              alias: i18next.t("indicatorFields"),
              type: "field(aggs=sum|none|max|min|mean|count|distinct)",
            },
          ],
        },
      },
      style: {
        basic: {
          alias: i18next.t("basicSetting"),
          children: [
            {
              name: "grid-width",
              default: 60,
            },
            {
              name: "grid-height",
              default: 30,
            },
            {
              name: "indicator-side",
              alias: i18next.t("indicatorSide"),
              type: "select(radioGroup)",
              default: "top",
              selectChoices: [
                { label: i18next.t("topSide"), value: "top" },
                { label: i18next.t("leftSide"), value: "left" },
              ],
            },
            {
              name: "show-subtotal",
              alias: i18next.t("showSubtotalRow"),
              type: "boolean",
              default: true,
            },
            {
              name: "subtotal-position",
              alias: i18next.t("subtotalRowPosition"),
              type: "select(radioGroup)",
              default: "top",
              selectChoices: [
                { label: i18next.t("topSide"), value: "top" },
                { label: i18next.t("bottomSide"), value: "bottom" },
              ],
              visible: (element: Widget) => element.getOption<boolean>("show-subtotal") !== false,
            },
            {
              name: "show-subtotal-column",
              alias: i18next.t("showSubtotalColumn"),
              type: "boolean",
              default: false,
            },
            {
              name: "subtotal-column-position",
              alias: i18next.t("subtotalColumnPosition"),
              type: "select(radioGroup)",
              default: "top",
              selectChoices: [
                { label: i18next.t("leftSide"), value: "top" },
                { label: i18next.t("rightSide"), value: "bottom" },
              ],
              visible: (element: Widget) => element.getOption<boolean>("show-subtotal-column") === true,
            },
            {
              name: "show-grand-total-row",
              alias: i18next.t("showGrandTotalRow"),
              type: "boolean",
              default: false,
            },
            {
              name: "grand-total-row-position",
              alias: i18next.t("grandTotalRowPosition"),
              type: "select(radioGroup)",
              default: "bottom",
              selectChoices: [
                { label: i18next.t("topSide"), value: "top" },
                { label: i18next.t("bottomSide"), value: "bottom" },
              ],
              visible: (element: Widget) => element.getOption<boolean>("show-grand-total-row") === true,
            },
            {
              name: "show-grand-total-column",
              alias: i18next.t("showGrandTotalColumn"),
              type: "boolean",
              default: false,
            },
            {
              name: "grand-total-column-position",
              alias: i18next.t("grandTotalColumnPosition"),
              type: "select(radioGroup)",
              default: "right",
              selectChoices: [
                { label: i18next.t("leftSide"), value: "left" },
                { label: i18next.t("rightSide"), value: "right" },
              ],
              visible: (element: Widget) => element.getOption<boolean>("show-grand-total-column") === true,
            },
            {
              name: "supports-expand",
              alias: i18next.t("supportsExpand"),
              type: "boolean",
              default: false,
            },
          ],
        },
      },
    }, ...super.defineOptions()];
  }

  get rowFields() {
    return this.getOption<OptionFieldValue[]>("row-fields") || [];
  }

  get columnFields() {
    return this.getOption<OptionFieldValue[]>("column-fields") || [];
  }

  get indicatorFields() {
    return this.getOption<OptionFieldValue[]>("indicator-fields") || [];
  }

  get indicatorSide() {
    return this.getOption<PivotIndicatorSide>("indicator-side") || "top";
  }

  get showSubtotalRow() {
    return this.getOption<boolean>("show-subtotal") !== false;
  }

  get showSubtotal() {
    return this.showSubtotalRow;
  }

  get showSubtotalColumn() {
    return this.getOption<boolean>("show-subtotal-column") === true;
  }

  get subtotalRowPosition() {
    return String(this.getOption("subtotal-position") || "top");
  }

  get subtotalColumnPosition() {
    return String(this.getOption("subtotal-column-position") || "top");
  }

  get subtotalPosition() {
    return this.subtotalRowPosition;
  }

  get showGrandTotalRow() {
    return this.getOption<boolean>("show-grand-total-row") === true;
  }

  get grandTotalRowPosition() {
    return String(this.getOption("grand-total-row-position") || "bottom");
  }

  get showGrandTotalColumn() {
    return this.getOption<boolean>("show-grand-total-column") === true;
  }

  get grandTotalColumnPosition() {
    return String(this.getOption("grand-total-column-position") || "right");
  }

  get supportsExpand() {
    return this.getOption<boolean>("supports-expand") === true;
  }

  get columnWidthMap() {
    const widthMap = this.getOption<Record<string, unknown>>("column-width-map");
    if (!widthMap || typeof widthMap !== "object") {
      return {};
    }
    return Object.entries(widthMap).reduce((result, [key, value]) => {
      const width = normalizePivotTableSize(value, 0, PIVOT_TABLE_WIDGET_MIN_COLUMN_WIDTH);
      if (width > 0) {
        result[key] = width;
      }
      return result;
    }, {} as Record<string, number>);
  }

  resolveColumnWidth(code: string, fallbackWidth: number) {
    const storedWidth = this.columnWidthMap[code];
    if (typeof storedWidth === "number" && storedWidth > 0) {
      return storedWidth;
    }
    return fallbackWidth;
  }

  private _runtimeState = reactive({
    leftExpandKeys: [] as string[],
    topExpandKeys: [] as string[],
  });

  get runtimeState() {
    return this._runtimeState;
  }

  get allFieldOptions() {
    return [
      ...this.rowFields,
      ...this.columnFields,
      ...this.indicatorFields,
    ].filter(field => field?.uid?.length);
  }

  get sourceTableUID() {
    const field = this.allFieldOptions[0];
    return field?.uid?.slice(0, 2) || [];
  }

  get sameSourceTable() {
    const [connectionUID, tableUID] = this.sourceTableUID;
    if (!connectionUID || !tableUID) return true;
    return this.allFieldOptions.every(field => field.uid?.[0] === connectionUID && field.uid?.[1] === tableUID);
  }

  get dataErrorText() {
    if (!this.sameSourceTable) return i18next.t("invalidDataSource");
    if ([...this.rowFields, ...this.columnFields].some(field => field?.uid?.[2]?.startsWith("table_aggregate_field_"))) {
      return i18next.t("dimensionAggregateUnsupported");
    }
    if (!this.indicatorFields.length) return i18next.t("indicatorRequired");
    if (!this.rowFields.length && !this.columnFields.length) return i18next.t("dimensionRequired");
    if (this.selectedSubFormFieldUIDs.length > 1) return i18next.t("multipleSubFormUnsupported");
    if (
      this.hasSubFormDimension
      && this.runtimeIndicators.some(indicator => (
        !indicator.dependencyFieldUIDs.length
        || indicator.dependencyFieldUIDs.some(fieldUID => resolveSubFormFieldUIDByFieldUID(fieldUID) !== this.activeSubFormFieldUID)
      ))
    ) {
      return i18next.t("subFormDimensionIndicatorUnsupported");
    }
    return "";
  }

  get runtimeIndicators(): PivotIndicatorRuntime[] {
    return this.indicatorFields
      .filter(field => field?.uid?.length)
      .map((field, index) => {
        const dependencyFieldUIDs = resolveFieldDependencyFieldUIDs(this, field);
        return {
          key: normalizeFieldCode(field, index),
          field,
          fieldUID: resolveFieldUID(field),
          dependencyFieldUIDs,
          subFormFieldUIDs: Array.from(new Set(dependencyFieldUIDs
            .map(dependencyFieldUID => resolveSubFormFieldUIDByFieldUID(dependencyFieldUID))
            .filter(Boolean))),
          alias: resolveFieldAlias(this, field, `指标${index + 1}`),
          summary: String(field.summary || "sum").toLowerCase(),
          bucketStage: shouldBypassSecondarySummary(this, field),
          dataFormat: typeof field.dataFormat === "string" ? field.dataFormat : "",
          fieldFormat: resolvePivotIndicatorFieldFormat(
            field?.uid?.length ? this.getField(field.uid) : undefined,
            String(field.summary || "sum").toLowerCase(),
          ),
        };
      });
  }

  get dataUIDs() {
    const uidMap = new Map<string, OptionFieldUID>();
    this.allFieldOptions.forEach(field => {
      if (!field?.uid?.length) return;
      const expandedUIDs = expandTableAggregateDataUids(this, [field.uid]);
      const finalUIDs = expandedUIDs.length ? expandedUIDs : [field.uid];
      finalUIDs.forEach(uid => {
        const key = normalizeOptionUIDKey(uid);
        if (!uidMap.has(key)) {
          uidMap.set(key, uid);
        }
      });
    });
    return Array.from(uidMap.values());
  }

  get selectedSubFormFieldUIDs() {
    const subFormFieldUIDs = new Set<string>();
    this.allFieldOptions.forEach((field) => {
      resolveFieldSubFormFieldUIDs(this, field).forEach(subFormFieldUID => subFormFieldUIDs.add(subFormFieldUID));
    });
    return Array.from(subFormFieldUIDs);
  }

  get dimensionSubFormFieldUIDs() {
    const subFormFieldUIDs = new Set<string>();
    [...this.rowFields, ...this.columnFields].forEach((field) => {
      resolveFieldSubFormFieldUIDs(this, field).forEach(subFormFieldUID => subFormFieldUIDs.add(subFormFieldUID));
    });
    return Array.from(subFormFieldUIDs);
  }

  get activeSubFormFieldUID() {
    return this.dimensionSubFormFieldUIDs[0] || "";
  }

  get hasSubFormDimension() {
    return this.dimensionSubFormFieldUIDs.length > 0;
  }

  get flattenedSubFormFieldUIDs() {
    const subFormFieldUID = this.activeSubFormFieldUID;
    if (!subFormFieldUID) return [];

    const fieldUIDSet = new Set<string>();
    this.dataUIDs.forEach((uid) => {
      if (resolveSubFormFieldUIDByFieldUID(uid?.[2]) === subFormFieldUID) {
        fieldUIDSet.add(uid[2]);
      }
    });
    this.allFieldOptions.forEach((field) => {
      const fieldUID = resolveFieldUID(field);
      if (resolveSubFormFieldUIDByFieldUID(fieldUID) === subFormFieldUID) {
        fieldUIDSet.add(fieldUID);
      }
    });
    return Array.from(fieldUIDSet);
  }

  get sourceRows(): PivotRuntimeSourceRow[] {
    const subFormFieldUID = this.activeSubFormFieldUID;
    if (!subFormFieldUID) {
      return this.rawRows.map((row, index) => ({
        row,
        parentRow: row,
        parentRowIndex: index,
        isFirstSubRow: true,
      }));
    }

    const flattenedFieldUIDs = this.flattenedSubFormFieldUIDs;
    return this.rawRows.flatMap((parentRow, parentRowIndex) => {
      const subRows = Array.isArray(parentRow?.[subFormFieldUID]) ? parentRow[subFormFieldUID] : [];
      if (!subRows.length) {
        return [];
      }

      return subRows.map((subRow, subRowIndex) => {
        const flattenedRow: Record<string, any> = {
          ...parentRow,
          ...subRow,
          [subFormFieldUID]: [subRow],
        };

        flattenedFieldUIDs.forEach((fieldUID) => {
          const subFieldUID = resolveSubFieldUIDByFieldUID(fieldUID);
          if (!subFieldUID) return;
          flattenedRow[fieldUID] = subRow?.[subFieldUID];
        });

        return {
          row: flattenedRow,
          parentRow,
          parentRowIndex,
          isFirstSubRow: subRowIndex === 0,
        };
      });
    });
  }

  get rawRows() {
    if (this.dataErrorText || !this.dataUIDs.length) return [];
    return this.getData().getRows(this.dataUIDs) || [];
  }

  get records(): PivotRuntimeRecord[] {
    const activeSubFormFieldUID = this.activeSubFormFieldUID;
    return this.sourceRows.flatMap(({ row, parentRow, parentRowIndex, isFirstSubRow }, index) => {
      const baseRow: PivotRuntimeRecord = {
        __pivotRowIndex: index,
        __pivotSourceRow: row,
        __pivotParentRow: parentRow,
        __pivotParentRowIndex: parentRowIndex,
      };

      let expandedRows: PivotRuntimeRecord[] = [baseRow];
      this.runtimeDimensions.forEach((dimension) => {
        const dimensionValues = resolveRuntimeDimensionValues(this, row, dimension);
        const nextValues = dimensionValues.length ? dimensionValues : [""];
        expandedRows = expandedRows.flatMap((record) => nextValues.map((value) => ({
          ...record,
          [dimension.key]: value,
        })));
      });

      const indicatorValues: Record<string, any> = {};
      this.runtimeIndicators.forEach((indicator) => {
        if (indicator.bucketStage) return;
        if (indicator.fieldUID) {
          const isDirectSubFormIndicator = isSubFormFieldUID(indicator.fieldUID);
          const dependsOnActiveSubForm = Boolean(activeSubFormFieldUID)
            && indicator.subFormFieldUIDs.includes(activeSubFormFieldUID);
          if (!activeSubFormFieldUID && isDirectSubFormIndicator) {
            indicatorValues[indicator.key] = aggregateValues(
              resolveSubFormFieldValues(parentRow, indicator.fieldUID),
              indicator.summary,
            );
            return;
          }

          const shouldUseExpandedRow = dependsOnActiveSubForm;
          if (!shouldUseExpandedRow && activeSubFormFieldUID && !isFirstSubRow) return;

          const indicatorSourceRow = shouldUseExpandedRow ? row : parentRow;
          if (indicator.field?.uid && indicator.field.uid[2] && indicator.field.uid[2].startsWith("table_aggregate_field_")) {
            indicatorValues[indicator.key] = evaluateRowStageTableAggregateField(
              this,
              indicator.field,
              indicatorSourceRow,
              shouldUseExpandedRow ? activeSubFormFieldUID : undefined,
            );
          } else {
            indicatorValues[indicator.key] = resolveFieldValue(indicatorSourceRow, indicator.fieldUID);
          }
        }
      });

      return expandedRows.map((record) => ({
        ...record,
        ...indicatorValues,
      }));
    });
  }

  get dimensions() {
    const fieldMap = new Map<string, PivotDimensionRuntime>();
    [...this.rowFields, ...this.columnFields].forEach((field, index) => {
      if (!field?.uid?.length) return;
      fieldMap.set(normalizeFieldCode(field, index), {
        key: normalizeFieldCode(field, index),
        field,
        alias: resolveFieldAlias(this, field, normalizeFieldCode(field, index)),
        summary: String(field.summary || "none").toLowerCase(),
        dataFormat: typeof field.dataFormat === "string" ? field.dataFormat : "",
        multiValueMode: resolveMultiValueMode(field),
      });
    });
    return Array.from(fieldMap.entries()).map(([code, field]) => ({
      code,
      name: field.alias,
      width: this.resolveColumnWidth(code, PIVOT_TABLE_WIDGET_DIMENSION_WIDTH),
      minWidth: PIVOT_TABLE_WIDGET_MIN_COLUMN_WIDTH,
    }));
  }

  get runtimeDimensions(): PivotDimensionRuntime[] {
    const fieldMap = new Map<string, PivotDimensionRuntime>();
    [...this.rowFields, ...this.columnFields].forEach((field, index) => {
      if (!field?.uid?.length) return;
      const key = normalizeFieldCode(field, index);
      fieldMap.set(key, {
        key,
        field,
        alias: resolveFieldAlias(this, field, key),
        summary: String(field.summary || "none").toLowerCase(),
        dataFormat: typeof field.dataFormat === "string" ? field.dataFormat : "",
        multiValueMode: resolveMultiValueMode(field),
      });
    });
    return Array.from(fieldMap.values());
  }

  get leftCodes() {
    return this.rowFields.map((field, index) => normalizeFieldCode(field, index)).filter(Boolean);
  }

  get topCodes() {
    return this.columnFields.map((field, index) => normalizeFieldCode(field, index)).filter(Boolean);
  }

  initRuntimeState() {
    this._runtimeState.leftExpandKeys = [];
    this._runtimeState.topExpandKeys = [];

    this.effectScope.run(() => {
      watch(() => [
        this.rowFields,
        this.columnFields,
        this.indicatorFields,
        this.rawRows.length,
      ], () => {
        const shouldFilterLeftExpandKeys = this._runtimeState.leftExpandKeys.length > 0 && this.leftCodes.length > 0;
        const shouldFilterTopExpandKeys = this._runtimeState.topExpandKeys.length > 0 && this.topCodes.length > 0;
        if (!shouldFilterLeftExpandKeys && !shouldFilterTopExpandKeys) {
          return;
        }

        const records = this.records;
        if (shouldFilterLeftExpandKeys) {
          const availableLeftExpandKeys = collectExpandKeys(records, this.leftCodes);
          this._runtimeState.leftExpandKeys = filterExpandKeys(this._runtimeState.leftExpandKeys, availableLeftExpandKeys);
        }
        if (shouldFilterTopExpandKeys) {
          const availableTopExpandKeys = collectExpandKeys(records, this.topCodes);
          this._runtimeState.topExpandKeys = filterExpandKeys(this._runtimeState.topExpandKeys, availableTopExpandKeys);
        }
      }, { deep: true, immediate: true });
    });
  }

  buildAggregate = (slice: PivotRuntimeRecord[]) => {
    const aggregateSliceRows = resolveAggregateSliceRows(slice);
    const rawRows = aggregateSliceRows.sourceRows;
    const parentRows = aggregateSliceRows.parentRows.map(item => item.parentRow);
    const result: Record<string, any> = {};
    this.runtimeIndicators.forEach((indicator) => {
      if (indicator.bucketStage) {
        const bucketRows = this.activeSubFormFieldUID && !indicator.subFormFieldUIDs.includes(this.activeSubFormFieldUID)
          ? parentRows
          : rawRows;
        result[indicator.key] = evaluateBucketStageTableAggregateField(this, indicator.field, bucketRows);
        return;
      }
      if (!this.activeSubFormFieldUID && isSubFormFieldUID(indicator.fieldUID)) {
        result[indicator.key] = aggregateValues(
          rawRows.flatMap(row => resolveSubFormFieldValues(row, indicator.fieldUID)),
          indicator.summary,
        );
        return;
      }
      const values = slice.map(item => item[indicator.key]);
      result[indicator.key] = aggregateValues(values, indicator.summary);
    });
    result[PIVOT_AGGREGATE_SOURCE_ROWS_KEY] = rawRows;
    result[PIVOT_AGGREGATE_PARENT_ROWS_KEY] = aggregateSliceRows.parentRows;
    return result;
  };

  get indicatorConfigs() {
    return this.runtimeIndicators.map((indicator) => ({
      code: indicator.key,
      name: indicator.alias,
      title: indicator.alias,
      ...(this.indicatorSide === "left"
        ? {
          width: this.resolveColumnWidth(indicator.key, PIVOT_TABLE_WIDGET_DEFAULT_COLUMN_WIDTH),
          minWidth: PIVOT_TABLE_WIDGET_MIN_COLUMN_WIDTH,
        }
        : {}),
      align: "right" as const,
      headerAlign: "center" as const,
      getValue(record: Record<string, any> | undefined) {
        return record?.[indicator.key];
      },
      render(value: any) {
        return formatIndicatorValue(value, indicator);
      },
    }));
  }

  get headerHeight() {
    return PIVOT_TABLE_WIDGET_HEADER_HEIGHT;
  }

  get defaultColumnWidth() {
    return PIVOT_TABLE_WIDGET_DEFAULT_COLUMN_WIDTH;
  }

  override getMetaData() {
    return {
      ...super.getMetaData(),
      axisValue: this.dataUIDs.map(uid => ({
        uid,
        __opt_type: "field",
      })),
    } as WidgetMetaData;
  }
}
