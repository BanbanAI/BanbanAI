import type {
  FormDataFindResponse,
  FormDataFindFilterNode,
  FormDataFindFilterCondition,
  FormDataRelatedRef,
} from "@common/types/form-data-find";
import type { Field, FieldUID, OptionTableUID, Row, Table } from "@common/types/project";
import { getUUIDSystemField, SystemField } from "@common/utils";

type ConversionResult = {
  supported: boolean;
  filter?: FormDataFindFilterNode;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value && typeof value === "object" && !Array.isArray(value))
);

const combine = (logic: "and" | "or", filters: Array<FormDataFindFilterNode | undefined>) => {
  const conditions = filters.filter(Boolean) as FormDataFindFilterNode[];
  if (!conditions.length) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { kind: "group", logic, conditions } as FormDataFindFilterNode;
};

const resolveFieldType = (field: Field) => {
  const widgetType = String(field.meta?.extra?.widgetType || field.meta?.subType || "").toLowerCase();
  if (widgetType.includes("date") || widgetType.includes("time")) return "datetime";
  // 自动编号是字符串（如 HZ-2026-09-10-135），不能被子串 "number" 误判为数字
  if (widgetType.includes("serialnumber")) return field.type;
  if (widgetType.includes("number") || widgetType.includes("amount") || widgetType.includes("rate") || widgetType.includes("compute")) return "number";
  if (widgetType.includes("department")) return "department";
  if (widgetType.includes("member") || widgetType.includes("user") || field.meta?.subType === "account") return "user";
  if (widgetType.includes("multiple") || widgetType.includes("checkbox") || widgetType.includes("tag")) return "multiSelect";
  if (widgetType.includes("select") || widgetType.includes("radio")) return "select";
  return field.type;
};

const normalizeNumberValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeNumberValue);
  if (value === "" || value === null || value === undefined || typeof value === "number") return value;
  if (typeof value !== "string") return value;
  const normalized = Number(value);
  return Number.isNaN(normalized) ? value : normalized;
};

const buildCondition = (
  path: [FieldUID] | [FieldUID, FieldUID],
  field: Field,
  method: FormDataFindFilterCondition["method"],
  value: unknown,
): FormDataFindFilterCondition => ({
  kind: "condition",
  path,
  type: resolveFieldType(field),
  method,
  value: resolveFieldType(field) === "number" ? normalizeNumberValue(value) : value,
});

const convertFieldValue = (
  value: unknown,
  path: [FieldUID] | [FieldUID, FieldUID],
  field: Field,
): ConversionResult => {
  if (!isRecord(value)) return { supported: true, filter: buildCondition(path, field, "eq", value) };
  const filters: FormDataFindFilterNode[] = [];
  for (const [operator, operatorValue] of Object.entries(value)) {
    const method = ({
      $eq: "eq",
      $ne: "ne",
      $gt: "gt",
      $gte: "gte",
      $lt: "lt",
      $lte: "lte",
      $in: "in",
      $nin: "nin",
      $all: "all",
      $size: "size",
      $exists: "exists",
      $regex: "regex",
    } as Record<string, FormDataFindFilterCondition["method"]>)[operator];
    if (!method) return { supported: false };
    if (operator === "$in" && Array.isArray(operatorValue) && operatorValue.includes(undefined)) {
      const values = operatorValue.filter(item => item !== undefined);
      filters.push(combine("or", [
        values.length ? buildCondition(path, field, "in", values) : undefined,
        buildCondition(path, field, "exists", false),
      ])!);
      continue;
    }
    filters.push(buildCondition(path, field, method, operatorValue));
  }
  return { supported: true, filter: combine("and", filters) };
};

const convertNode = (
  value: unknown,
  path: [FieldUID] | [FieldUID, FieldUID],
  field: Field,
): ConversionResult => {
  if (!isRecord(value)) return { supported: false };
  const filters: FormDataFindFilterNode[] = [];
  for (const [key, item] of Object.entries(value)) {
    if (key === "$and" || key === "$or") {
      if (!Array.isArray(item)) return { supported: false };
      const converted = item.map(child => convertNode(child, path, field));
      if (converted.some(child => !child.supported)) return { supported: false };
      const filter = combine(key === "$and" ? "and" : "or", converted.map(child => child.filter));
      if (filter) filters.push(filter);
      continue;
    }
    if (key === "$not") {
      const converted = convertNode(item, path, field);
      if (!converted.supported) return converted;
      return converted.filter
        ? { supported: true, filter: { kind: "not", condition: converted.filter } }
        : { supported: false };
    }
    if (key !== field.uid) return { supported: false };
    const converted = convertFieldValue(item, path, field);
    if (!converted.supported) return converted;
    if (converted.filter) filters.push(converted.filter);
  }
  return { supported: true, filter: combine("and", filters) };
};

export const convertWhereConditionToFormDataFindFilter = (
  where: unknown,
  path: [FieldUID] | [FieldUID, FieldUID],
  field: Field,
) => convertNode(where, path, field);

export const combineFormDataFindFilters = combine;

export const isFormDataFindCapabilityError = (error: unknown) => {
  const response = isRecord(error) && isRecord(error.response) ? error.response : undefined;
  const data = response && isRecord(response.data) ? response.data : undefined;
  return data?.code === "FIND_FILTER_NOT_SUPPORTED" || data?.code === "FIND_SOURCE_NOT_SUPPORTED";
};

export const normalizeFormDataFindResponse = (
  response: FormDataFindResponse,
  options: {
    rootTable?: Table;
    subTableUIDs: Map<FieldUID, OptionTableUID>;
    getTable: (tableUID: string) => Table | undefined;
    relatedTableFields: Map<FieldUID, Field[]>;
  },
) => {
  const rows = (response?.data || []).map(row => ({ ...row }));
  const subTableData: Record<FieldUID, { rows: Row[]; total: number }> = {};
  const relatedTableData: Record<FieldUID, { rows: Row[]; total: number }> = {};
  const relatedTableIdSets = new Map<FieldUID, Set<string>>();
  const appendRelatedRefs = (field: Field, value: unknown) => {
    const relatedTableUID = field.meta?.extra?.relatedTableUID?.[1];
    if (!relatedTableUID || !Array.isArray(value)) return value;
    const relatedFields = options.relatedTableFields.get(field.uid) || [];
    const uuidField = getUUIDSystemField(relatedFields);
    const titleField = relatedFields.find(item => item.meta?.name === SystemField.DATA_TITLE);
    const relatedRows = relatedTableData[field.uid]?.rows || [];
    const existing = relatedTableIdSets.get(field.uid) || new Set<string>();
    value.forEach((ref: FormDataRelatedRef) => {
      if (!ref?.id || !uuidField?.uid || existing.has(String(ref.id))) return;
      relatedRows.push({
        [uuidField.uid]: ref.id,
        ...(titleField?.uid ? { [titleField.uid]: ref.title } : {}),
      });
      existing.add(String(ref.id));
    });
    relatedTableIdSets.set(field.uid, existing);
    relatedTableData[field.uid] = { rows: relatedRows, total: relatedRows.length };
    return value.map((ref: FormDataRelatedRef) => ref?.id).filter(Boolean);
  };
  const normalizeSubRows = (parentFieldUID: FieldUID, parentRow: Row) => {
    const subTableUID = options.subTableUIDs.get(parentFieldUID)?.[1];
    const subTable = subTableUID ? options.getTable(subTableUID) : undefined;
    const subRows = Array.isArray(parentRow[parentFieldUID]) ? parentRow[parentFieldUID] as Row[] : [];
    if (!subTable) return;
    subRows.forEach(subRow => subTable.fields.forEach(field => {
      if (field.meta?.extra?.relatedTableUID) {
        subRow[field.uid] = appendRelatedRefs(field, subRow[field.uid]);
      }
    }));
    const normalizedRows = subRows.map(subRow => ({ ...subRow }));
    const current = subTableData[parentFieldUID]?.rows || [];
    current.push(...normalizedRows);
    subTableData[parentFieldUID] = { rows: current, total: current.length };
    parentRow[parentFieldUID] = normalizedRows;
  };
  rows.forEach(row => {
    options.rootTable?.fields.forEach(field => {
      if (field.meta?.extra?.relatedTableUID) row[field.uid] = appendRelatedRefs(field, row[field.uid]);
    });
    for (const parentFieldUID of options.subTableUIDs.keys()) {
      if (response.fields?.some(field => field.uid === parentFieldUID)) normalizeSubRows(parentFieldUID, row);
    }
  });
  return { rows, subTableData, relatedTableData };
};
