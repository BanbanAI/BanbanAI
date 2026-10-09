import type { Account } from "../../../../common/types/account";
import { Dynamic } from "../../../../common/types/account";
import { FormWidgetType } from "../../../../common/types/nocode";

type OrganizeDefaultValue = {
  departments?: unknown[];
  roles?: unknown[];
  users?: unknown[];
  dynamic?: unknown[];
};

type OrganizeRuntimeDefaultField = {
  uid?: string;
  meta?: {
    extra?: {
      widgetType?: string;
      isMultiple?: boolean;
    };
  };
} | null;

export type ResolveOrganizeFieldSubmitDefaultValueOptions = {
  defaultValue: unknown;
  widgetType?: string;
  account?: Partial<Account> | null;
  isMultiple?: boolean;
};

export type ResolveOrganizeFieldRuntimeDefaultValueOptions = Omit<ResolveOrganizeFieldSubmitDefaultValueOptions, "widgetType" | "isMultiple"> & {
  field?: OrganizeRuntimeDefaultField;
  widgetType?: string;
  isMultiple?: boolean;
};

export type HasOrganizeFieldRuntimeDefaultValueOptions = {
  defaultValue: unknown;
  field?: OrganizeRuntimeDefaultField;
  widgetType?: string;
};

export type ApplyOrganizeFieldRuntimeDefaultToRowOptions = ResolveOrganizeFieldRuntimeDefaultValueOptions & {
  row: Record<string, unknown>;
  field: Exclude<OrganizeRuntimeDefaultField, null>;
  fieldId?: string;
};

export type ResolveOrganizeFieldSubmitDefaultValueResult = {
  isOrganizeDefaultValue: boolean;
  value?: string | string[];
};

const ORGANIZE_WIDGET_TYPES = new Set<string>([
  FormWidgetType.MEMBER_SELECT,
  FormWidgetType.DEPARTMENT_SELECT,
]);

const getItemId = (item: unknown) => {
  if (typeof item === "string" || typeof item === "number") {
    return String(item);
  }
  if (!item || typeof item !== "object") {
    return "";
  }

  const value = item as Record<string, unknown>;
  const id = value.id ?? value.uid ?? value.value;
  return typeof id === "string" || typeof id === "number" ? String(id) : "";
};

const collectIds = (items: unknown[] = []) => {
  return items.map(getItemId).filter(Boolean);
};

const appendUnique = (target: string[], value: unknown) => {
  const id = getItemId(value);
  if (!id || target.includes(id)) {
    return;
  }
  target.push(id);
};

const isOrganizeDefaultValue = (value: unknown): value is OrganizeDefaultValue => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as OrganizeDefaultValue;
  return Array.isArray(data.departments)
    || Array.isArray(data.roles)
    || Array.isArray(data.users)
    || Array.isArray(data.dynamic);
};

const isRuntimeDefaultTargetValueEmpty = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return value === undefined || value === null || value === "";
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const cloneValue = <T = unknown>(value: T): T => {
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(item => cloneValue(item)) as T;
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((prev, [key, item]) => {
    prev[key] = cloneValue(item);
    return prev;
  }, {}) as T;
};

const setRuntimeDefaultValueToRow = (row: Record<string, unknown>, fieldId: string, value: string | string[]) => {
  if (!fieldId) {
    return false;
  }

  const fieldPath = fieldId.split(".");
  if (fieldPath.length === 1) {
    if (!isRuntimeDefaultTargetValueEmpty(row?.[fieldId])) {
      return false;
    }
    row[fieldId] = cloneValue(value);
    return true;
  }

  if (fieldPath.length !== 2) {
    return false;
  }

  const [parentFieldId, subFieldId] = fieldPath;
  const subRows = Array.isArray(row?.[parentFieldId]) ? row[parentFieldId] as unknown[] : [];
  let changed = false;
  subRows.forEach((subRow) => {
    if (!isRecord(subRow)) {
      return;
    }
    if (!isRuntimeDefaultTargetValueEmpty(subRow?.[subFieldId])) {
      return;
    }
    subRow[subFieldId] = cloneValue(value);
    changed = true;
  });
  return changed;
};

export const hasOrganizeFieldRuntimeDefaultValue = ({
  defaultValue,
  field,
  widgetType,
}: HasOrganizeFieldRuntimeDefaultValueOptions) => {
  const extra = field?.meta?.extra || {};
  return ORGANIZE_WIDGET_TYPES.has(String(widgetType || extra.widgetType || ""))
    && isOrganizeDefaultValue(defaultValue);
};

export const resolveOrganizeFieldSubmitDefaultValue = ({
  defaultValue,
  widgetType,
  account,
  isMultiple,
}: ResolveOrganizeFieldSubmitDefaultValueOptions): ResolveOrganizeFieldSubmitDefaultValueResult => {
  if (!ORGANIZE_WIDGET_TYPES.has(String(widgetType || "")) || !isOrganizeDefaultValue(defaultValue)) {
    return { isOrganizeDefaultValue: false };
  }

  const dynamic = defaultValue.dynamic || [];
  const value: string[] = [];

  if (widgetType === FormWidgetType.MEMBER_SELECT) {
    collectIds(defaultValue.users).forEach(item => appendUnique(value, item));
    if (dynamic.includes(Dynamic.CURRENT_USER)) {
      appendUnique(value, account?.id);
    }
  }

  if (widgetType === FormWidgetType.DEPARTMENT_SELECT) {
    collectIds(defaultValue.departments).forEach(item => appendUnique(value, item));
    if (dynamic.includes(Dynamic.CURRENT_DEPARTMENT)) {
      (account?.departments || []).forEach(item => appendUnique(value, item));
    }
  }

  return {
    isOrganizeDefaultValue: true,
    value: isMultiple ? value : value[0],
  };
};

export const resolveOrganizeFieldRuntimeDefaultValue = ({
  defaultValue,
  field,
  widgetType,
  account,
  isMultiple,
}: ResolveOrganizeFieldRuntimeDefaultValueOptions): ResolveOrganizeFieldSubmitDefaultValueResult => {
  const extra = field?.meta?.extra || {};
  return resolveOrganizeFieldSubmitDefaultValue({
    defaultValue,
    widgetType: widgetType || extra.widgetType,
    account,
    isMultiple: isMultiple ?? !!extra.isMultiple,
  });
};

export const applyOrganizeFieldRuntimeDefaultToRow = ({
  row,
  field,
  fieldId,
  defaultValue,
  widgetType,
  account,
  isMultiple,
}: ApplyOrganizeFieldRuntimeDefaultToRowOptions) => {
  const resolvedDefaultValue = resolveOrganizeFieldRuntimeDefaultValue({
    defaultValue,
    field,
    widgetType,
    account,
    isMultiple,
  });
  if (!resolvedDefaultValue.isOrganizeDefaultValue || isRuntimeDefaultTargetValueEmpty(resolvedDefaultValue.value)) {
    return false;
  }

  return setRuntimeDefaultValueToRow(
    row,
    fieldId || String(field?.uid || ""),
    resolvedDefaultValue.value as string | string[],
  );
};
