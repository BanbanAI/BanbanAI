
import { ColumnDefinition, FieldAdapter, CellReadContext, CompiledFormula } from "../column-definition";
import { AggregateDefinition } from "../aggregate-index";
import { LinkageRule } from "../linkage-engine";
import { Field } from "./types";
import { compileValidateRules, validateFieldValue, type RuntimeValidateRules } from "./field-validation";
import type { DynamicOptionDescriptor } from "../option-service";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export type { Field };


export type DataFillOptionRule = {
  readonly ruleId: string;
  readonly sourceFields: readonly string[];
};

export type RuntimeCondition = {
  readonly uid: string;
  readonly func: string;
  readonly value: unknown;
};

export type RuntimeConditionRule = {
  readonly logic: "AND" | "OR";
  readonly conditions: readonly RuntimeCondition[];
};

export type RuntimeVisibleRule = RuntimeConditionRule & {
  readonly visibleType: "show" | "hide";
};

type RawConditionRule = {
  logic?: string;
  conditions?: readonly { uid?: string; func?: string; value?: unknown }[];
};

type RawVisibleRule = RawConditionRule & {
  widgetIds?: readonly string[];
  visibleType?: string;
};

export type SubFormSchemaAdapterOptions = {
  children: readonly any[];
  subTableFields: readonly Field[];
  services?: unknown;
  resolveFieldExtra?: (widget: any) => Record<string, unknown> | undefined;
  subFormId?: string;
  compileFormula?: (formulaStr: string, widgetUid: string, fieldId: string, widgetUidToFieldId: Map<string, string>) => CompiledFormula | undefined;
  resolveDataFillRule?: (widgetUid: string) => DataFillOptionRule | undefined;
  subFieldVisibleRules?: readonly RawVisibleRule[];
  resolveExternalConditionValue?: (widgetUid: string) => unknown;
  isConditionTargetVisible?: (uid: string) => boolean;
  compareCondition?: (func: string, value: unknown, expected: unknown) => boolean | undefined;
  translate?: (key: string, params?: Record<string, unknown>, namespace?: string) => string;
  appendRuntimeCustomOption?: (widgetUid: string, value: string) => { value: string; label: string } | null;
};

export type SubFormSchema = {
  columns: ColumnDefinition[];
  aggregates: AggregateDefinition[];
  linkageRules: LinkageRule[];
  columnIndex: Map<string, number>;
  externalDependencies: readonly string[];
};


type MinimalField = {
  uid: string;
  meta?: {
    uid?: string;
    extra?: Record<string, unknown>;
  };
};

const isEmptyValue = (value: unknown) => value === undefined || value === null || value === "";

export const sanitizeDateRangeCellValue = (value: unknown) => {
  if (!Array.isArray(value) || !value.includes("Invalid Date")) {
    return value;
  }
  return value.map(item => item === "Invalid Date" ? "" : item);
};

function getNumberFormat(widget: any, extra: Record<string, unknown>) {
  const amount = (extra.amount || {}) as Record<string, unknown>;
  const decimalValue = Number(widget.decimal ?? extra.decimalPlaces ?? extra.decimal ?? 0);
  const decimal = Number.isFinite(decimalValue) ? Math.max(0, Math.min(100, Math.trunc(decimalValue))) : 0;
  const thousandSeparatorValue = widget.thousandSeparator
    ?? extra.thousandSeparator
    ?? amount.thousandSeparator;
  const thousandSeparator = thousandSeparatorValue === true
    ? ","
    : typeof thousandSeparatorValue === "string" ? thousandSeparatorValue : "";
  return {
    amount,
    decimal,
    decimalPadding: Boolean(widget.isDecimalPadding ?? extra.completeZero ?? extra.isDecimalPadding),
    decimalRoundingRule: widget.decimalRoundingRule ?? extra.decimalRoundingRule ?? "round",
    decimalSeparator: String(widget.decimalSeparator ?? amount.decimalSeparator ?? extra.decimalSeparator ?? "."),
    numberType: widget.numberType ?? (extra.isPercent ? "percent" : extra.numberType),
    thousandSeparator,
    useSeparator: Boolean(widget.isThousandSeparator ?? thousandSeparator),
    prefix: typeof widget.prefixValue === "string"
      ? widget.prefixValue
      : typeof amount.prefix === "string" ? amount.prefix : "",
    suffix: typeof widget.suffixValue === "string"
      ? widget.suffixValue
      : typeof amount.suffix === "string" ? amount.suffix : "",
    unit: typeof widget.unit === "string" ? widget.unit : typeof extra.unit === "string" ? extra.unit : "",
    unitPosition: widget.unitPosition ?? extra.unitPosition,
  };
}

function normalizeDisplayNumber(value: number, decimal: number, roundingRule: unknown) {
  if (roundingRule !== "truncate") return Number(value.toFixed(decimal));
  const factor = 10 ** decimal;
  const sign = value < 0 ? -1 : 1;
  return Math.trunc((Math.abs(value) + Number.EPSILON) * factor) / factor * sign;
}

function formatNumberValue(widget: any, extra: Record<string, unknown>, value: unknown, editor = false): unknown {
  if (isEmptyValue(value)) return value;

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";
  const format = getNumberFormat(widget, extra);
  const normalizedValue = format.numberType === "percent" ? numericValue * 100 : numericValue;
  const normalizedNumber = normalizeDisplayNumber(normalizedValue, format.decimal, format.decimalRoundingRule);
  const rounded = format.decimalPadding
    ? normalizedNumber.toFixed(format.decimal)
    : String(normalizedNumber);
  const [integer, fraction] = rounded.split(".");
  const groupedInteger = !editor && format.useSeparator && format.thousandSeparator
    ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousandSeparator)
    : integer;
  const displayValue = fraction
    ? `${groupedInteger}${format.decimalSeparator}${fraction}`
    : groupedInteger;
  if (editor) return displayValue;
  const unitPrefix = format.unit && format.unitPosition === "prefix" ? format.unit : "";
  const unitSuffix = format.unit && format.unitPosition !== "prefix" ? format.unit : "";
  return `${unitPrefix}${format.prefix}${format.numberType === "percent" ? `${displayValue}%` : displayValue}${format.suffix}${unitSuffix}`;
}

function parseNumberValue(widget: any, extra: Record<string, unknown>, value: unknown) {
  if (isEmptyValue(value)) return null;
  const format = getNumberFormat(widget, extra);
  let normalized = String(value).trim();
  for (const token of [format.prefix, format.suffix, format.unit, "%"]) {
    if (token) normalized = normalized.replaceAll(token, "");
  }
  if (format.thousandSeparator && format.thousandSeparator !== format.decimalSeparator) {
    normalized = normalized.replaceAll(format.thousandSeparator, "");
  }
  if (format.decimalSeparator !== ".") {
    normalized = normalized.replace(format.decimalSeparator, ".");
  }
  normalized = normalized.replace(/\s/g, "");
  const number = Number(normalized);
  if (!Number.isFinite(number)) return null;
  return format.numberType === "percent" ? number / 100 : number;
}

function formatTimeValue(widget: any, extra: Record<string, unknown>, value: unknown): unknown {
  if (isEmptyValue(value)) return value;
  if (typeof widget.formatTimeValue === "function") {
    try {
      return widget.formatTimeValue(value);
    } catch {
    }
  }
  const format = typeof widget.format === "string"
    ? widget.format
    : typeof extra.format === "string" ? extra.format : "HH:mm";
  const parsed = dayjs(value as any).isValid()
    ? dayjs(value as any)
    : dayjs(String(value), ["HH:mm:ss", "HH:mm"], true);
  return parsed.isValid() ? parsed.format(format) : value;
}

function formatSwitchValue(widget: any, extra: Record<string, unknown>, value: unknown, translate?: (key: string, params?: Record<string, unknown>, namespace?: string) => string,): string {
  const labels = Array.isArray(extra.format) ? extra.format : [
    widget.activeText || extra.activeText || translate?.("activeStateText", undefined, widget.type) || "",
    widget.inactiveText || extra.inactiveText || translate?.("inactiveStateText", undefined, widget.type) || "",
  ];
  const enabled = value === true || value === "true" || value === labels[0];
  return String(labels[enabled ? 0 : 1]);
}

function getFieldId(widget: any, subTableFields: readonly MinimalField[]): string {
  return widget.fieldId || subTableFields.find(f => f.meta?.uid === widget.uid)?.uid || widget.uid;
}

const readWidgetProperty = <T = unknown>(widget: any, key: string, fallback?: T): T | undefined => {
  try {
    const value = widget?.[key];
    return (value === undefined || value === null ? fallback : value) as T | undefined;
  } catch {
    return fallback;
  }
};

const readWidgetOption = <T = unknown>(widget: any, key: string, fallback?: T): T | undefined => {
  try {
    const value = typeof widget?.getOption === "function" ? widget.getOption(key) : undefined;
    return (value === undefined || value === null ? fallback : value) as T | undefined;
  } catch {
    return fallback;
  }
};

const cloneConfiguration = <T>(value: T): T => {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const deepFreezeConfiguration = <T>(value: T): T => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value as Record<string, unknown>)) deepFreezeConfiguration(item);
  return Object.freeze(value);
};

function compileDynamicOptions(
  widget: any,
  resolveDataFillRule?: (widgetUid: string) => DataFillOptionRule | undefined,
): DynamicOptionDescriptor | undefined {
  if (widget.type !== "widget.form.treeSelect" && widget.type !== "widget.form.treeMultipleSelect") return undefined;
  const choicesType = readWidgetProperty<string>(widget, "choicesType", readWidgetOption<string>(widget, "select-choices-type"));
  if (choicesType === "data-fill") {
    const rule = resolveDataFillRule?.(String(widget.uid));
    if (!rule) return undefined;
    return Object.freeze({
      source: "data-fill",
      widgetId: String(widget.uid),
      ruleId: rule.ruleId,
      sourceField: Object.freeze([]),
      filter: deepFreezeConfiguration({}),
      sort: Object.freeze([]),
      rowDependencies: Object.freeze([...rule.sourceFields]),
      formDependencies: Object.freeze([]),
      revision: JSON.stringify({ source: "data-fill", ruleId: rule.ruleId, sourceFields: rule.sourceFields }),
    });
  }
  if (choicesType !== "from-table") return undefined;
  const rawSource = readWidgetProperty<unknown>(widget, "otherTableFieldUID", readWidgetOption(widget, "other-table-field"));
  const sourceField = (Array.isArray(rawSource) ? rawSource : String(rawSource || "").split("."))
    .map(String)
    .filter(Boolean);
  if (sourceField.length < 3) return undefined;
  const filter = cloneConfiguration(readWidgetProperty<Record<string, unknown>>(
    widget,
    "optionFilter",
    readWidgetOption<Record<string, unknown>>(widget, "option-filter", { logic: "AND", conditions: [] }),
  ) || { logic: "AND", conditions: [] });
  const sort = cloneConfiguration(readWidgetProperty<Readonly<Record<string, unknown>>[]>(widget, "fieldSortRule", []) || []);
  const rowDependencies = new Set<string>();
  const formDependencies = new Set<string>();
  const conditions = Array.isArray((filter as any).conditions) ? (filter as any).conditions : [];
  for (const condition of conditions) {
    if (condition?.type !== "FORM" || !condition.comparisonUid) continue;
    const ids = String(condition.comparisonUid).split(".").filter(Boolean);
    if (ids.length > 1) rowDependencies.add(ids[1]);
    else if (ids[0]) formDependencies.add(ids[0]);
  }
  const revision = JSON.stringify({ sourceField, filter, sort });
  return Object.freeze({
    source: "from-table",
    widgetId: String(widget.uid),
    sourceField: Object.freeze(sourceField),
    filter: deepFreezeConfiguration(filter),
    sort: deepFreezeConfiguration(sort),
    rowDependencies: Object.freeze([...rowDependencies]),
    formDependencies: Object.freeze([...formDependencies]),
    revision,
  });
}

export type FieldConditionContext = {
  readonly subFormId?: string;
  readonly widgetUidToFieldId: Map<string, string>;
  readonly resolveExternalValue?: (widgetUid: string) => unknown;
  readonly isTargetVisible?: (uid: string) => boolean;
  readonly compare?: (func: string, value: unknown, expected: unknown) => boolean | undefined;
};

function compileConditionRule(rule: RawConditionRule | undefined | null): RuntimeConditionRule | undefined {
  if (!rule || !Array.isArray(rule.conditions)) return undefined;
  const conditions = rule.conditions
    .filter(condition => !!condition?.uid && !!condition?.func)
    .map(condition => Object.freeze({
      uid: String(condition.uid),
      func: String(condition.func),
      value: condition.value,
    }));
  if (!conditions.length) return undefined;
  return Object.freeze({
    logic: rule.logic === "OR" ? "OR" as const : "AND" as const,
    conditions: Object.freeze(conditions),
  });
}

function compileVisibleRules(
  widgetUid: string,
  rules: readonly RawVisibleRule[] | undefined,
): readonly RuntimeVisibleRule[] {
  if (!rules?.length) return [];
  const compiled: RuntimeVisibleRule[] = [];
  for (const rule of rules) {
    if (!rule?.widgetIds?.includes(widgetUid)) continue;
    const conditionRule = compileConditionRule(rule);
    if (!conditionRule) continue;
    compiled.push(Object.freeze({
      ...conditionRule,
      visibleType: rule.visibleType === "hide" ? "hide" as const : "show" as const,
    }));
  }
  return Object.freeze(compiled);
}

function resolveConditionReference(uid: string, ctx: CellReadContext, context: FieldConditionContext): unknown {
  if (!ctx?.row) return undefined;
  const segments = uid.split(".").filter(Boolean);
  const childUid = segments[segments.length - 1];
  const owner = segments.length > 1 ? segments[0] : undefined;
  if (!owner || owner === context.subFormId) {
    const fieldId = childUid ? context.widgetUidToFieldId.get(childUid) : undefined;
    if (fieldId) return ctx.row.data[fieldId];
  }
  return context.resolveExternalValue?.(uid);
}

function collectExternalConditionUid(
  uid: string,
  subFormId: string | undefined,
  widgetUidToFieldId: Map<string, string>,
): string | undefined {
  const segments = uid.split(".").filter(Boolean);
  const childUid = segments[segments.length - 1];
  const owner = segments.length > 1 ? segments[0] : undefined;
  if (!owner || owner === subFormId) {
    if (childUid && widgetUidToFieldId.has(childUid)) return undefined;
  }
  return childUid;
}

function matchConditionRule(rule: RuntimeConditionRule, ctx: CellReadContext, context: FieldConditionContext): boolean {
  const matcher = rule.logic === "OR" ? "some" : "every";
  return rule.conditions[matcher](condition => {
    if (context.isTargetVisible && !context.isTargetVisible(condition.uid)) return false;
    const value = resolveConditionReference(condition.uid, ctx, context);
    return context.compare?.(condition.func, value, condition.value) === true;
  });
}

function matchVisibleRules(
  rules: readonly RuntimeVisibleRule[],
  ctx: CellReadContext,
  context: FieldConditionContext,
): boolean {
  const showRules = rules.filter(rule => rule.visibleType !== "hide");
  const hideRules = rules.filter(rule => rule.visibleType === "hide");
  for (const rule of showRules) {
    if (matchConditionRule(rule, ctx, context)) return true;
  }
  for (const rule of hideRules) {
    if (matchConditionRule(rule, ctx, context)) return false;
  }
  return hideRules.length > 0;
}

export type CompiledFieldRules = {
  readonly extra: Record<string, unknown>;
  readonly readonlyMode?: string;
  readonly readonlyRule?: RuntimeConditionRule;
  readonly requiredMode?: string;
  readonly requiredRule?: RuntimeConditionRule;
  readonly visibleRules: readonly RuntimeVisibleRule[];
  readonly validateRules: RuntimeValidateRules;
  readonly translate?: (key: string, params?: Record<string, unknown>, namespace?: string) => string;
  readonly conditionContext: FieldConditionContext;
};

function createFieldAdapter(
  widget: any,
  subTableFields: readonly MinimalField[],
  fieldRules: CompiledFieldRules,
): FieldAdapter {
  const { extra, readonlyMode, readonlyRule, requiredMode, requiredRule, visibleRules, validateRules, conditionContext } = fieldRules;
  const options = getRuntimeOptions(widget, extra);
  const optionLabels = new Map(options.map(option => [option.value, option.label]));
  const organizationLabels = () => {
    if (widget.type === "widget.form.memberSelect") {
      return new Map((widget.allUserList || []).map((item: any) => [String(item.id), String(item.realname || item.user || item.name || item.id)]));
    }
    if (widget.type === "widget.form.departmentSelect") {
      return new Map((widget.allDepartmentsList || []).map((item: any) => [String(item.id), String(item.name || item.id)]));
    }
    return optionLabels;
  };
  const labelForValue = (value: unknown, labels: Map<string, string>): string => {
    if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      const directLabel = item.realname ?? item.name ?? item.label ?? item.title ?? item.user;
      if (directLabel !== undefined && directLabel !== null && String(directLabel) !== "") {
        return String(directLabel);
      }
      const identity = item.id ?? item.uid ?? item.value;
      if (identity !== undefined && identity !== null) {
        return labels.get(String(identity)) || String(identity);
      }
    }
    const normalized = String(value);
    return labels.get(normalized) || normalized;
  };
  const normalizeIdentity = (value: unknown): string => {
    if (value && typeof value === "object") {
      const item = value as Record<string, unknown>;
      const identity = item.value ?? item.id ?? item.uid;
      return identity === undefined || identity === null ? "" : String(identity);
    }
    return value === undefined || value === null ? "" : String(value);
  };
  const normalizeIdentities = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(normalizeIdentity).filter(Boolean);
    if (value === undefined || value === null || value === "") return [];
    return String(value).split(",").map(item => item.trim()).filter(Boolean);
  };
  const dateFormat = String(widget.format || extra.format || "YYYY-MM-DD");
  const parseDate = (value: unknown) => {
    if (value === '' || value === null || value === undefined) return value;
    if (typeof value === 'number') return dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : value;
    const parsed = dayjs(value as any).isValid()
      ? dayjs(value as any)
      : dayjs(String(value), [dateFormat, 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'], true);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
  };
  const parseDateRange = (value: unknown) => {
    if (!Array.isArray(value)) {
      if (value === '' || value === null || value === undefined) return [];
      value = String(value).split(',').map(item => item.trim()).filter(Boolean);
    }
    return (value as unknown[]).slice(0, 2).map(item => {
      if (item === '' || item === null || item === undefined) return '';
      if (typeof item === 'number') return item;
      if (typeof item === 'string' && /^-?\d{10,}$/.test(item)) {
        const epoch = Number(item);
        if (Number.isFinite(epoch) && dayjs(epoch).isValid()) return epoch;
      }
      const parsed = dayjs(item as any).isValid()
        ? dayjs(item as any)
        : dayjs(String(item), [dateFormat, 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'], true);
      return parsed.isValid() ? parsed.valueOf() : item === 'Invalid Date' ? '' : item;
    });
  };
  const parse = (value: unknown) => {
    if (widget.type === 'widget.form.numberInput'
      || widget.type === 'widget.form.amountInput'
      || widget.type === 'widget.form.rate') {
      return parseNumberValue(widget, extra, value);
    }
    if (widget.type === 'widget.form.switch') {
      return value === true || value === 'true';
    }
    if (widget.type === 'widget.form.checkboxGroup' || widget.type === 'widget.form.treeMultipleSelect'
      || widget.type === 'widget.form.memberSelect' || widget.type === 'widget.form.departmentSelect') {
      return normalizeIdentities(value);
    }
    if (widget.type === 'widget.form.radioGroup' || widget.type === 'widget.form.treeSelect') {
      return normalizeIdentity(value);
    }
    if (widget.type === 'widget.form.datePicker') {
      return parseDate(value);
    }
    if (widget.type === 'widget.form.dateRangePicker') {
      return parseDateRange(value);
    }
    if (widget.type === 'widget.form.tagInput') {
      if (Array.isArray(value)) return value.map(String);
      if (value === '' || value === null || value === undefined) return [];
      return String(value).split(',').map(item => item.trim()).filter(Boolean);
    }
    return value;
  };

  return {
    format: (ctx: CellReadContext): unknown => {
      const value = ctx.row.data[ctx.address.fieldId];
      if (widget.type === "widget.form.numberInput"
        || widget.type === "widget.form.amountInput"
        || widget.type === "widget.form.rate"
        || (widget.type === "widget.form.autoCompute"
          && (widget.resultFormat ?? extra.resultFormat) === "number")) {
        return formatNumberValue(widget, extra, value);
      }
      if (widget.type === "widget.form.timePicker") {
        return formatTimeValue(widget, extra, value);
      }
      if (widget.type === "widget.form.switch") {
        return formatSwitchValue(widget, extra, value, fieldRules.translate);
      }
      if (widget.type === "widget.form.serialNumber" && typeof value === "number"
        && typeof widget.formatSubSerialNumber === "function") {
        try {
          return widget.formatSubSerialNumber(value, ctx.row.data);
        } catch {
          return value;
        }
      }
      if (widget.type === 'widget.form.datePicker') {
        if (value === null || value === undefined || value === '') return value;
        const parsed = dayjs(value as any).isValid()
          ? dayjs(value as any)
          : dayjs(String(value), [dateFormat, 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'], true);
        return parsed.isValid() ? parsed.format(dateFormat) : value;
      }
      if (widget.type === 'widget.form.dateRangePicker') {
        if (!Array.isArray(value)) return value;
        return value.map(item => {
          if (item === null || item === undefined || item === '') return '';
          const parsed = dayjs(item as any).isValid()
            ? dayjs(item as any)
            : dayjs(String(item), [dateFormat, 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss'], true);
          return parsed.isValid() ? parsed.format(dateFormat) : String(item);
        }).filter(Boolean).join(' - ');
      }
      if (widget.type === 'widget.form.hyperlink') {
        if (value === null || value === undefined || value === '') return value;
        const hyperlink = (extra.hyperlink || {}) as Record<string, unknown>;
        const linkType = widget.linkType || hyperlink.linkType;
        if (linkType === 'form') {
          const options = Array.isArray(widget.tableChoices)
            ? widget.tableChoices as Array<{ value: string; label: string }>
            : Array.isArray(extra.hyperlinkOptions)
              ? extra.hyperlinkOptions as Array<{ value: string; label: string }>
              : [];
          return options.find(option => option.value === String(value))?.label || value;
        }
        return hyperlink.linkText || widget.linkText || value;
      }
      if (Array.isArray(value)) {
        if (widget.type === "widget.form.file-uploader" || widget.type === "widget.form.image-uploader") {
          return value.map(item => typeof item === "object" && item ? item.name || item.url : item).filter(Boolean).join(", ");
        }
        const labels = organizationLabels();
        return value.map(item => labelForValue(item, labels)).join(', ');
      }
      if (value === null || value === undefined || value === '') return value;
      return labelForValue(value, organizationLabels());
      },
    formatEditor: (ctx: CellReadContext): unknown => {
      const value = ctx.row.data[ctx.address.fieldId];
      if (widget.type === "widget.form.numberInput" || widget.type === "widget.form.amountInput") {
        return formatNumberValue(widget, extra, value, true);
      }
      return value;
    },
    parse,
    isVisible: (ctx: CellReadContext): boolean => {
      if (widget.isHidden) return false;
      if (!visibleRules.length || !ctx?.row) return true;
      return matchVisibleRules(visibleRules, ctx, conditionContext);
    },
    isReadonly: (ctx: CellReadContext): boolean => {
      if (widget.isReadonly === true) return true;
      if (readonlyMode !== "condition" || !readonlyRule || !ctx?.row) return false;
      return matchConditionRule(readonlyRule, ctx, conditionContext);
    },
    isRequired: (ctx: CellReadContext): boolean => {
      if (extra.isRequired) return true;
      if (requiredMode === 'on') return true;
      if (requiredMode !== "condition" || !requiredRule || !ctx?.row) return false;
      return matchConditionRule(requiredRule, ctx, conditionContext);
    },
    validate: (ctx: CellReadContext) => {
      const translate = fieldRules.translate
        ? (key: string, params?: Record<string, unknown>) => fieldRules.translate!(key, params, widget.type)
        : undefined;
      const message = validateFieldValue(widget, validateRules, ctx?.row?.data?.[ctx.address.fieldId], translate);
      return message ? { valid: false, message } : { valid: true };
    },
    emptyRequiredMessage: () => {
      if (!validateRules.organizeCurrentDepartmentDefault || !fieldRules.translate) return undefined;
      return fieldRules.translate("currentMemberUnassignedDepartment", undefined, widget.type) || undefined;
    },
  };
}


export function compileSubFormSchema(options: SubFormSchemaAdapterOptions): SubFormSchema {
  const {
    children,
    subTableFields,
    compileFormula,
    resolveDataFillRule,
    resolveFieldExtra,
    subFormId,
    subFieldVisibleRules,
    resolveExternalConditionValue,
    isConditionTargetVisible,
    compareCondition,
    translate,
  } = options;
  const typedFields = subTableFields as unknown as readonly MinimalField[];
  const widgetUidToFieldId = new Map<string, string>();
  const columns: ColumnDefinition[] = [];
  const aggregates: AggregateDefinition[] = [];
  const columnIndex = new Map<string, number>();
  const externalDependencies = new Set<string>();
  const conditionContext: FieldConditionContext = {
    subFormId,
    widgetUidToFieldId,
    resolveExternalValue: resolveExternalConditionValue,
    isTargetVisible: isConditionTargetVisible,
    compare: compareCondition,
  };
  let aggregateSeq = 0;

  for (const widget of children) {
    const fieldId = getFieldId(widget, typedFields);
    widgetUidToFieldId.set(widget.uid, fieldId);
  }

  for (const widget of children) {
    const fieldId = getFieldId(widget, typedFields);
    const fieldMeta = typedFields.find(f => f.meta?.uid === widget.uid);
    const extra = {
      ...((fieldMeta?.meta?.extra || {}) as Record<string, unknown>),
      ...(resolveFieldExtra?.(widget) || {}),
    };

    const canDriveDefaultFormula = !!widget.handleFormatValue
      || widget.type === 'widget.form.datePicker'
      || widget.type === 'widget.form.timePicker';
    const isFormula = widget.type === 'widget.form.autoCompute'
      ? (widget.computeType === 'formula' && !!widget.formulaValue)
      : (canDriveDefaultFormula && widget.defaultType === 'formula' && !!widget.defaultFormulaValueStr);

    const isQuickCompute = widget.type === 'widget.form.autoCompute'
      ? (widget.computeType === 'quickCompute' && widget.otherTableFieldUID?.length >= 3)
      : (widget.defaultComputeType === 'quickCompute' && widget.defaultOtherTableFieldUID?.length >= 3);

    let formula: CompiledFormula | undefined;
    if (isFormula && !widget.isEditable && compileFormula) {
      const formulaStr = widget.type === 'widget.form.autoCompute'
        ? widget.formulaValueStr
        : widget.defaultFormulaValueStr;
      if (formulaStr) {
        formula = compileFormula(formulaStr, widget.uid, fieldId, widgetUidToFieldId);
      }
    }
    for (const externalUid of formula?.externalDependencies || []) {
      externalDependencies.add(externalUid);
    }

    const readonlyMode = extra.readonlyMode as string | undefined;
    const readonlyRule = compileConditionRule(extra.readonlyRule as RawConditionRule | undefined);
    const requiredMode = extra.requiredMode as string | undefined;
    const requiredRule = compileConditionRule(extra.requiredRule as RawConditionRule | undefined);
    const visibleRules = compileVisibleRules(widget.uid, subFieldVisibleRules);
    const validateRules = compileValidateRules(widget, extra);
    for (const condition of [
      ...(readonlyRule?.conditions || []),
      ...(requiredRule?.conditions || []),
      ...visibleRules.flatMap(rule => rule.conditions),
    ]) {
      const externalUid = collectExternalConditionUid(condition.uid, subFormId, widgetUidToFieldId);
      if (externalUid) externalDependencies.add(externalUid);
    }

    const isUnique = extra.isUnique || extra.isGlobalUnique;

    const column: ColumnDefinition = {
      id: widget.uid,
      fieldId,
      type: widget.type || 'string',
      schema: Object.freeze({
        ...extra,
        options: getRuntimeOptions(widget, extra),
        dynamicOptions: compileDynamicOptions(widget, resolveDataFillRule),
        readonlyMode,
        readonlyConditionRule: readonlyRule ?? null,
        requiredMode,
        requiredConditionRule: requiredRule ?? null,
        visibleRules,
        validateRules,
        allowCustom: Boolean(getOtherLabel(widget, extra)),
        otherLabel: getOtherLabel(widget, extra),
        allowAddCustomOption: widget.canAddCustomOptionInRuntime === true,
        appendCustomOption: typeof options.appendRuntimeCustomOption === "function"
          ? (value: string) => options.appendRuntimeCustomOption!(String(widget.uid), String(value))
          : undefined,
        title: widget.title,
        widthInSubForm: widget.widthInSubForm,
        placeholder: readWidgetProperty<string>(widget, "placeholder", readWidgetOption<string>(widget, "placeholder", extra.placeholder as string | undefined)),
        selectorPlaceholder: readWidgetProperty<string>(widget, "selectorPlaceholder", readWidgetOption<string>(widget, "selector-placeholder", extra.selectorPlaceholder as string | undefined)),
        inputPlaceholder: readWidgetProperty<string>(widget, "inputPlaceholder", readWidgetOption<string>(widget, "input-placeholder", extra.inputPlaceholder as string | undefined)),
        addressDetail: readWidgetProperty<boolean>(widget, "isAddressDetail", readWidgetOption<boolean>(widget, "address-detail", extra.addressDetail as boolean | undefined)),
        addressPrecision: readWidgetProperty<number>(widget, "addressPrecision", readWidgetOption<number>(widget, "address-precision", extra.addressPrecision as number | undefined)),
        mapKey: readWidgetOption<string>(widget, "map-key", readWidgetProperty<string>(widget, "mapKey", extra.mapKey as string | undefined)),
        clearButton: readWidgetProperty<boolean>(widget, "clearable", readWidgetOption<boolean>(widget, "clear-button", extra.clearButton as boolean | undefined)),
        showCoordinates: readWidgetOption<boolean>(widget, "show-coordinates", extra.showCoordinates as boolean | undefined),
        autoPosition: readWidgetOption<boolean>(widget, "auto-position", extra.autoPosition as boolean | undefined),
        numberType: readWidgetProperty<string>(widget, "numberType", extra.numberType as string | undefined),
        unit: readWidgetProperty<string>(widget, "unit", extra.unit as string | undefined),
        unitPosition: readWidgetProperty<string>(widget, "unitPosition", extra.unitPosition as string | undefined),
        activeText: readWidgetProperty<string>(widget, "activeText", readWidgetOption<string>(widget, "active-text", extra.activeText as string | undefined)),
        inactiveText: readWidgetProperty<string>(widget, "inactiveText", readWidgetOption<string>(widget, "inactive-text", extra.inactiveText as string | undefined)),
        inlinePrompt: readWidgetProperty<boolean>(widget, "inlinePrompt", readWidgetOption<boolean>(widget, "inline-prompt", extra.inlinePrompt as boolean | undefined)),
        isMultiple: readWidgetProperty<boolean>(widget, "isMultiple", extra.isMultiple as boolean | undefined),
        calendarType: widget.calendarType ?? widget.precision ?? extra.calendarType ?? extra.precision,
        precision: widget.precision ?? extra.precision,
        format: widget.format ?? extra.format,
        dateFormat: widget.dateFormat ?? extra.dateFormat,
        timeFormat: widget.timeFormat
          ?? (widget.type === "widget.form.timePicker" ? widget.format : undefined)
          ?? extra.timeFormat,
        startPlaceholder: widget.placeholders?.[0] ?? extra.startPlaceholder,
        endPlaceholder: widget.placeholders?.[1] ?? extra.endPlaceholder,
        maxRate: widget.maxRate ?? extra.maxRate,
        allowHalf: widget.allowHalf ?? extra.allowHalf,
        rateColor: widget.rateColor ?? extra.rateColor,
        runtimeAction: widget.type === "widget.form.selectData",
        buttonText: widget.buttonText,
        selectedButtonText: widget.selectedButtonText,
        relatedTableUID: widget.type === "widget.form.relatedData" ? widget.connectionTable : undefined,
        relatedUuidFieldId: widget.type === "widget.form.relatedData" ? widget.uuidField?.uid : undefined,
        relatedTitleFieldId: widget.type === "widget.form.relatedData" ? widget.titleField?.uid : undefined,
        hyperlinkOptions: widget.type === "widget.form.hyperlink"
          ? (widget.tableChoices || []).map((option: any) => ({ value: String(option.value), label: String(option.label) }))
          : undefined,
        linkType: widget.type === "widget.form.hyperlink"
          ? widget.linkType || (extra.hyperlink as Record<string, unknown> | undefined)?.linkType
          : undefined,
        organizeDisplay: (widget.type === "widget.form.memberSelect" || widget.type === "widget.form.departmentSelect")
          ? {
            currentType: widget.type === "widget.form.memberSelect" ? "member" as const : "department" as const,
            showInfo: Array.isArray(extra.showInfo) ? extra.showInfo as string[] : [],
            autoFill: extra.autoFill === "fill" && !!extra.fillField,
          }
          : undefined,
      }),
      adapter: createFieldAdapter(widget, typedFields, {
        extra,
        readonlyMode,
        readonlyRule,
        requiredMode,
        requiredRule,
        visibleRules,
        validateRules,
        translate,
        conditionContext,
      }),
      dependencies: formula?.dependencies || [],
      formula,
      unique: !!isUnique,
    };

    columns.push(column);
    columnIndex.set(fieldId, columns.length - 1);
    columnIndex.set(widget.uid, columns.length - 1);

    if (isQuickCompute) {
      aggregateSeq += 1;
      const aggId = "agg-" + aggregateSeq;
      aggregates.push({
        id: aggId,
        fieldId,
        type: (widget.type === 'widget.form.autoCompute'
          ? (widget.aggregateType || 'SUM')
          : (widget.defaultAggregateType || 'SUM')) as "SUM" | "COUNT" | "AVG" | "MAX" | "MIN",
      });
    }
  }

  return { columns, aggregates, linkageRules: [], columnIndex, externalDependencies: [...externalDependencies] };
}

type RuntimeOption = { value: string; label: string; depth?: number };

function getRuntimeOptions(widget: any, extra: Record<string, unknown>): readonly RuntimeOption[] {
  const choicesType = readWidgetProperty<string>(
    widget,
    "choicesType",
    readWidgetOption<string>(widget, "select-choices-type"),
  );
  if (choicesType === "data-fill") return [];
  const fromField = extra.choices;
  let widgetSource: unknown;
  try {
    widgetSource = widget.type === 'widget.form.radioGroup'
      ? widget.radioList
      : widget.type === 'widget.form.checkboxGroup'
        ? widget.checkboxList
        : (widget.type === 'widget.form.treeSelect' || widget.type === 'widget.form.treeMultipleSelect')
          ? widget.treeList
          : undefined;
  } catch {
    widgetSource = undefined;
  }
  const source = Array.isArray(widgetSource) && widgetSource.length > 0
    ? widgetSource
    : Array.isArray(fromField)
      ? fromField
      : widgetSource;
  if (!Array.isArray(source)) return [];
  const useWidgetValueAsLabel = source === widgetSource
    && choicesType === "custom"
    && (widget.type === 'widget.form.treeSelect' || widget.type === 'widget.form.treeMultipleSelect');
  const normalized: RuntimeOption[] = [];
  const seen = new Set<string>();
  const visit = (items: unknown[], depth = 0) => {
    for (const item of items) {
      if (item === null || item === undefined) continue;
      if (typeof item === 'string' || typeof item === 'number') {
        const value = String(item);
        if (!seen.has(value)) {
          seen.add(value);
          normalized.push({ value, label: value, depth });
        }
        continue;
      }
      if (typeof item !== 'object') continue;
      const option = item as Record<string, unknown>;
      const value = option.value ?? option.id;
      if (value !== undefined && value !== null) {
        const normalizedValue = String(value);
        if (!seen.has(normalizedValue)) {
          seen.add(normalizedValue);
          normalized.push({
            value: normalizedValue,
            label: useWidgetValueAsLabel
              ? normalizedValue
              : String(option.label ?? option.name ?? option.realname ?? option.user ?? value),
            depth,
          });
        }
      }
      if (Array.isArray(option.children)) visit(option.children, depth + 1);
    }
  };
  visit(source);
  return Object.freeze(normalized.map(item => Object.freeze(item)));
}

function getOtherLabel(widget: any, extra: Record<string, unknown>) {
  if (typeof extra.otherLabel === 'string') return extra.otherLabel;
  try {
    const other = widget?.customOption?.otherOptions?.value
      ?? widget?.checkboxOption?.otherOptions?.value;
    return typeof other === 'string' ? other : '';
  } catch {
    return '';
  }
}

export function rowsToPatches(
  rows: readonly Record<string, any>[],
  subTableFields: readonly MinimalField[],
): Array<{ rowId: string; values: Record<string, unknown> }> {
  return rows.map((row, index) => {
    const uuid = row['__uuid__'] || row['__UUID__'] || row['uuid'] || ("row-" + Date.now() + "-" + index);
    const values: Record<string, unknown> = {};
    for (const field of subTableFields) {
      if (Object.prototype.hasOwnProperty.call(row, field.uid)) {
        values[field.uid] = row[field.uid];
      }
    }
    for (const key of Object.keys(row)) {
      if (!key.startsWith('__') && !(key in values)) {
        values[key] = row[key];
      }
    }
    return { rowId: uuid, values: Object.freeze(values) };
  });
}
