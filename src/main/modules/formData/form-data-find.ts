import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  FormDataFindFilterCondition,
  FormDataFindFilterNode,
  FormDataFindRequest,
  FormDataFindResponse,
  FormDataFindWarning,
  FormDataRelatedRef,
} from "@common/types/form-data-find";
import {
  Bucket,
  Field,
  FieldUID,
  QueryOptions,
  Row,
  SortType,
  Table,
  TableUID,
  WhereCondition,
} from "@common/types/project";
import { FormDataStage, getUUIDSystemField, SystemField } from "@common/utils";

const MAX_PAGE_SIZE = 200;
const MAX_FILTER_NODES = 200;
const MAX_FILTER_DEPTH = 20;
const MAX_CANDIDATE_PARENT_IDS = 100_000;
const MAX_RELATED_IDS = 50_000;
const READ_TABLE_BATCH_SIZE = 8;
const CHILD_ROW_WARNING = 50_000;
const CHILD_ROW_LIMIT = 100_000;
const RESPONSE_SIZE_WARNING = 16 * 1024 * 1024;
const RESPONSE_SIZE_LIMIT = 32 * 1024 * 1024;
const FILTER_METHODS = new Set(["eq", "ne", "gt", "gte", "lt", "lte", "in", "nin", "all", "size", "exists", "regex"]);
const REQUEST_KEYS = new Set(["nocodeId", "tableUID", "pagination", "select", "filter", "sort", "stage", "scope", "context"]);

type ResolvedCondition = Omit<FormDataFindFilterCondition, "path"> & {
  scope: "main" | "child";
  fieldUID: FieldUID;
  subFormFieldUID?: FieldUID;
};

type ResolvedFilterNode =
  | ResolvedCondition
  | { kind: "group"; logic: "and" | "or"; conditions: ResolvedFilterNode[] }
  | { kind: "not"; condition: ResolvedFilterNode };

type SubFormContext = {
  parentField: Field;
  table: Table;
  relationField: Field;
};

export type FormDataFindMetrics = {
  filterPlan: "none" | "main" | "child" | "mixed";
  candidateParentCount: number;
  mainReadRows: number;
  childReadRows: number;
  uniqueRelatedIds: number;
  relatedReadRows: number;
  estimatedResponseBytes: number;
  phaseDurationMs: Partial<Record<"filter" | "main" | "child" | "related" | "serialize", number>>;
  abortedAtPhase?: string;
};

export const createFormDataFindMetrics = (): FormDataFindMetrics => ({
  filterPlan: "none",
  candidateParentCount: 0,
  mainReadRows: 0,
  childReadRows: 0,
  uniqueRelatedIds: 0,
  relatedReadRows: 0,
  estimatedResponseBytes: 0,
  phaseDurationMs: {},
});

export type FormDataFindExecutionContext = {
  rootTable: Table;
  tables: Map<TableUID, Table>;
  readableFieldUIDs?: Map<TableUID, Set<FieldUID> | null>;
  read: (
    tableUIDs: TableUID[],
    options: QueryOptions,
    fieldUIDsMap: Record<TableUID, FieldUID[]>,
  ) => Promise<Bucket[]>;
  distinct: (
    tableUID: TableUID,
    fieldUID: FieldUID,
    condition: WhereCondition,
    options: Pick<QueryOptions, "stage" | "scope">,
  ) => Promise<unknown[]>;
  expandReadFieldDependencies?: (table: Table, fieldUIDs: FieldUID[]) => FieldUID[];
  isAborted?: () => boolean;
  metrics?: FormDataFindMetrics;
};

const badRequest = (message: string): never => {
  throw new BadRequestException({ code: "FIND_INVALID_REQUEST", message });
};

const forbidden = (message: string): never => {
  throw new ForbiddenException({ code: "FIND_FORBIDDEN", message });
};

const notFound = (message: string): never => {
  throw new NotFoundException({ code: "FIND_TABLE_NOT_FOUND", message });
};

const unsupported = (message: string): never => {
  throw new UnprocessableEntityException({ code: "FIND_FILTER_NOT_SUPPORTED", message });
};

const responseTooLarge = (message: string): never => {
  throw new PayloadTooLargeException({ code: "FIND_RESPONSE_TOO_LARGE", message });
};

const assertNotAborted = (context: FormDataFindExecutionContext, phase: string) => {
  if (context.isAborted?.()) {
    if (context.metrics) context.metrics.abortedAtPhase = phase;
    throw new HttpException({ code: "FIND_ABORTED", message: "request aborted" }, 499);
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value && typeof value === "object" && !Array.isArray(value))
);

const assertOnlyKeys = (value: Record<string, unknown>, allowed: Set<string>, label: string) => {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) badRequest(`${label} contains unknown field: ${key}`);
  }
};

const unique = <T>(values: T[]) => Array.from(new Set(values));

const readInBatches = async (
  context: FormDataFindExecutionContext,
  tableUIDs: TableUID[],
  options: QueryOptions,
  fieldUIDsMap: Record<TableUID, FieldUID[]>,
  phase: string,
) => {
  const buckets: Bucket[] = [];
  for (let index = 0; index < tableUIDs.length; index += READ_TABLE_BATCH_SIZE) {
    assertNotAborted(context, phase);
    const batch = tableUIDs.slice(index, index + READ_TABLE_BATCH_SIZE);
    const batchSet = new Set(batch);
    const batchFields = Object.fromEntries(
      Object.entries(fieldUIDsMap).filter(([tableUID]) => batchSet.has(tableUID as TableUID)),
    ) as Record<TableUID, FieldUID[]>;
    const filters = options.filters
      ? Object.fromEntries(Object.entries(options.filters).filter(([tableUID]) => batchSet.has(tableUID as TableUID)))
      : undefined;
    buckets.push(...await context.read(batch, { ...options, filters }, batchFields));
  }
  return buckets;
};

const normalizeBusinessType = (field: Field) => {
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

const isFieldReadable = (
  context: FormDataFindExecutionContext,
  tableUID: TableUID,
  fieldUID: FieldUID,
) => {
  const readable = context.readableFieldUIDs?.get(tableUID);
  return !readable || readable.has(fieldUID);
};

const validateStage = (stage: FormDataFindRequest["stage"]) => {
  if (stage === undefined) return;
  const values = new Set(Object.values(FormDataStage));
  if (typeof stage === "string") {
    if (!values.has(stage as FormDataStage)) badRequest("stage is invalid");
    return;
  }
  if (!isRecord(stage)) badRequest("stage must be an object or enum value");
  assertOnlyKeys(stage, new Set(["$eq", "$ne", "$in", "$nin", "$exists"]), "stage");
  if (!Object.keys(stage).length) badRequest("stage cannot be empty");
  for (const [operator, value] of Object.entries(stage)) {
    if (operator === "$exists") {
      if (typeof value !== "boolean") badRequest("stage.$exists must be boolean");
    } else if (operator === "$in" || operator === "$nin") {
      if (!Array.isArray(value) || value.some(item => !values.has(item as FormDataStage))) badRequest(`stage.${operator} is invalid`);
    } else if (!values.has(value as FormDataStage)) {
      badRequest(`stage.${operator} is invalid`);
    }
  }
};

const buildSubFormContexts = (context: FormDataFindExecutionContext) => {
  const result = new Map<FieldUID, SubFormContext>();
  for (const parentField of context.rootTable.fields || []) {
    const subTableUID = parentField.meta?.extra?.subTableUID?.[1];
    if (!subTableUID) continue;
    const table = context.tables.get(subTableUID);
    const relationField = table?.fields?.find(field => field.meta?.name === SystemField.KEY);
    if (!table || !relationField) notFound(`subform relation is invalid: ${parentField.uid}`);
    result.set(parentField.uid, { parentField, table, relationField });
  }
  return result;
};

const validateConditionValue = (condition: FormDataFindFilterCondition, field: Field) => {
  if (!FILTER_METHODS.has(condition.method)) badRequest(`filter method is invalid: ${condition.method}`);
  if (condition.type !== field.type && condition.type !== normalizeBusinessType(field)) {
    badRequest(`filter type does not match field: ${field.uid}`);
  }
  if (["in", "nin", "all"].includes(condition.method) && !Array.isArray(condition.value)) {
    badRequest(`${condition.method} value must be an array`);
  }
  if (condition.method === "exists" && typeof condition.value !== "boolean") {
    badRequest("exists value must be boolean");
  }
  if (condition.method === "size" && (!Number.isInteger(condition.value) || Number(condition.value) < 0)) {
    badRequest("size value must be a non-negative integer");
  }
  if (condition.method === "regex") {
    const regex = condition.value;
    if (typeof regex !== "string") badRequest("regex value is invalid");
    const regexValue = regex as string;
    if (regexValue.length > 1_000) badRequest("regex value is invalid");
    try {
      new RegExp(regexValue, "i");
    } catch {
      badRequest("regex value is invalid");
    }
  }
  if (normalizeBusinessType(field) === "number" && !["in", "nin", "all", "exists", "size", "regex"].includes(condition.method)) {
    if (typeof condition.value !== "number") badRequest(`filter value must be a number: ${field.uid}`);
  }
};

const resolveFilter = (
  node: FormDataFindFilterNode,
  context: FormDataFindExecutionContext,
  subForms: Map<FieldUID, SubFormContext>,
  state = { count: 0 },
  depth = 1,
): ResolvedFilterNode => {
  state.count += 1;
  if (state.count > MAX_FILTER_NODES) badRequest(`filter cannot contain more than ${MAX_FILTER_NODES} nodes`);
  if (depth > MAX_FILTER_DEPTH) badRequest(`filter cannot exceed ${MAX_FILTER_DEPTH} levels`);
  if (!isRecord(node)) badRequest("filter node must be an object");
  if (node.kind === "condition") {
    assertOnlyKeys(node, new Set(["kind", "path", "type", "method", "value"]), "filter condition");
    if (!Array.isArray(node.path) || (node.path.length !== 1 && node.path.length !== 2)) badRequest("filter path must contain one or two fields");
    if (node.path.length === 1) {
      const field = context.rootTable.fields.find(item => item.uid === node.path[0]);
      if (!field) badRequest(`filter field does not exist: ${node.path[0]}`);
      if (!isFieldReadable(context, context.rootTable.uid, field.uid)) forbidden(`filter field is not readable: ${field.uid}`);
      validateConditionValue(node, field);
      return { ...node, scope: "main", fieldUID: field.uid, path: undefined } as unknown as ResolvedCondition;
    }
    const subForm = subForms.get(node.path[0]);
    const field = subForm?.table.fields.find(item => item.uid === node.path[1]);
    if (!subForm || !field) badRequest(`subform filter path does not exist: ${node.path.join(".")}`);
    if (!isFieldReadable(context, context.rootTable.uid, subForm.parentField.uid)
      || !isFieldReadable(context, subForm.table.uid, field.uid)) {
      forbidden(`filter field is not readable: ${node.path.join(".")}`);
    }
    validateConditionValue(node, field);
    return {
      ...node,
      scope: "child",
      fieldUID: field.uid,
      subFormFieldUID: subForm.parentField.uid,
      path: undefined,
    } as unknown as ResolvedCondition;
  }
  if (node.kind === "group") {
    assertOnlyKeys(node, new Set(["kind", "logic", "conditions"]), "filter group");
    if ((node.logic !== "and" && node.logic !== "or") || !Array.isArray(node.conditions) || !node.conditions.length) {
      badRequest("filter group is invalid");
    }
    return {
      kind: "group",
      logic: node.logic,
      conditions: node.conditions.map(item => resolveFilter(item, context, subForms, state, depth + 1)),
    };
  }
  if (node.kind === "not") {
    assertOnlyKeys(node, new Set(["kind", "condition"]), "filter not");
    if (!node.condition) badRequest("filter not condition is missing");
    const resolved = resolveFilter(node.condition, context, subForms, state, depth + 1);
    const scopes = collectScopes(resolved);
    if (scopes.size !== 1 || Array.from(scopes).some(scope => scope.startsWith("child:"))) {
      unsupported("subform or cross-table NOT filter is not supported");
    }
    return { kind: "not", condition: resolved };
  }
  badRequest("filter node kind is invalid");
};

const collectScopes = (node: ResolvedFilterNode, result = new Set<string>()) => {
  if (node.kind === "condition") {
    result.add(node.scope === "main" ? "main" : `child:${node.subFormFieldUID}`);
  } else if (node.kind === "group") {
    node.conditions.forEach(item => collectScopes(item, result));
  } else {
    collectScopes(node.condition, result);
  }
  return result;
};

const onlyChildScope = (node: ResolvedFilterNode) => {
  const scopes = collectScopes(node);
  if (scopes.size !== 1) return undefined;
  const [scope] = Array.from(scopes);
  return scope.startsWith("child:") ? scope.slice("child:".length) as FieldUID : undefined;
};

const conditionToWhere = (condition: ResolvedCondition): WhereCondition => {
  const operator = condition.method === "regex" ? "$regex" : `$${condition.method}`;
  return {
    [condition.fieldUID]: {
      [operator]: condition.value,
    },
  } as WhereCondition;
};

const filterToWhere = (node: ResolvedFilterNode): WhereCondition => {
  if (node.kind === "condition") return conditionToWhere(node);
  if (node.kind === "not") return { $not: filterToWhere(node.condition) };
  const conditions = node.conditions.map(filterToWhere);
  if (conditions.length === 1) return conditions[0];
  return { [node.logic === "and" ? "$and" : "$or"]: conditions } as WhereCondition;
};

const pruneToChild = (node: ResolvedFilterNode, subFormFieldUID: FieldUID): ResolvedFilterNode | undefined => {
  if (node.kind === "condition") {
    return node.scope === "child" && node.subFormFieldUID === subFormFieldUID ? node : undefined;
  }
  if (node.kind === "not") {
    const condition = pruneToChild(node.condition, subFormFieldUID);
    return condition ? { kind: "not", condition } : undefined;
  }
  const conditions = node.conditions.map(item => pruneToChild(item, subFormFieldUID)).filter(Boolean) as ResolvedFilterNode[];
  if (!conditions.length) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { kind: "group", logic: node.logic, conditions };
};

const getMainOnlySufficientFilter = (node: ResolvedFilterNode): ResolvedFilterNode | undefined => {
  if (node.kind === "condition") return node.scope === "main" ? node : undefined;
  if (node.kind === "not") {
    const condition = getMainOnlySufficientFilter(node.condition);
    return condition ? { kind: "not", condition } : undefined;
  }
  const resolved = node.conditions.map(getMainOnlySufficientFilter);
  if (node.logic === "and" && resolved.some(condition => !condition)) return undefined;
  const conditions = resolved.filter(Boolean) as ResolvedFilterNode[];
  if (!conditions.length) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { kind: "group", logic: node.logic, conditions };
};

const mergeWhere = (logic: "and" | "or", conditions: WhereCondition[]) => {
  const valid = conditions.filter(Boolean);
  if (valid.length === 1) return valid[0];
  return { [logic === "and" ? "$and" : "$or"]: valid } as WhereCondition;
};

const projectRow = (row: Row, fieldUIDs: FieldUID[]) => fieldUIDs.reduce<Row>((result, fieldUID) => {
  if (Object.prototype.hasOwnProperty.call(row, fieldUID)) result[fieldUID] = row[fieldUID];
  return result;
}, {});

const normalizeRelatedIds = (value: unknown) => {
  const values = Array.isArray(value) ? value : (value === undefined || value === null || value === "" ? [] : [value]);
  return values.map(item => {
    if (isRecord(item)) return item.id ?? item.value ?? item.uuid;
    return item;
  }).filter(item => item !== undefined && item !== null && item !== "");
};

const getPagination = (request: FormDataFindRequest) => {
  const pagination = request.pagination as Record<string, unknown>;
  if (!isRecord(pagination)) badRequest("pagination must be an object");
  assertOnlyKeys(pagination, new Set(["pageNumber", "pageSize", "start", "limit"]), "pagination");
  const hasPage = pagination.pageNumber !== undefined || pagination.pageSize !== undefined;
  const hasOffset = pagination.start !== undefined || pagination.limit !== undefined;
  if (hasPage === hasOffset) badRequest("pagination modes are mutually exclusive");
  if (hasPage) {
    if (!Number.isInteger(pagination.pageNumber) || Number(pagination.pageNumber) < 1) badRequest("pageNumber must be a positive integer");
    if (!Number.isInteger(pagination.pageSize) || Number(pagination.pageSize) < 1 || Number(pagination.pageSize) > MAX_PAGE_SIZE) badRequest(`pageSize must be between 1 and ${MAX_PAGE_SIZE}`);
    const pageNumber = Number(pagination.pageNumber);
    const pageSize = Number(pagination.pageSize);
    return { pageNumber, pageSize, start: (pageNumber - 1) * pageSize, limit: pageSize };
  }
  if (!Number.isInteger(pagination.start) || Number(pagination.start) < 0) badRequest("start must be a non-negative integer");
  if (!Number.isInteger(pagination.limit) || Number(pagination.limit) < 1 || Number(pagination.limit) > MAX_PAGE_SIZE) badRequest(`limit must be between 1 and ${MAX_PAGE_SIZE}`);
  return { start: Number(pagination.start), limit: Number(pagination.limit) };
};

export async function executeFormDataFind(
  request: FormDataFindRequest,
  context: FormDataFindExecutionContext,
): Promise<FormDataFindResponse> {
  const metrics = context.metrics;
  if (!isRecord(request)) badRequest("request body must be an object");
  assertOnlyKeys(request, REQUEST_KEYS, "request");
  if (typeof request.nocodeId !== "string" || !request.nocodeId.trim()) badRequest("nocodeId is required");
  if (typeof request.tableUID !== "string" || !request.tableUID) badRequest("tableUID is required");
  if (request.tableUID !== context.rootTable.uid) badRequest("tableUID does not match resolved table");
  if (context.rootTable.meta?.extra?.primaryTable?.[1]) badRequest("root table cannot be a subtable");
  if (request.scope !== undefined && request.scope !== "main" && request.scope !== "draft") badRequest("scope is invalid");
  if (request.context !== undefined) {
    if (!isRecord(request.context)) badRequest("context must be an object");
    assertOnlyKeys(request.context, new Set(["widgetNocodeId", "widgetUID"]), "context");
    if (typeof request.context.widgetNocodeId !== "string" || !request.context.widgetNocodeId
      || typeof request.context.widgetUID !== "string" || !request.context.widgetUID) {
      badRequest("managed view context is invalid");
    }
  }
  validateStage(request.stage);
  const pagination = getPagination(request);
  const uuidField = getUUIDSystemField(context.rootTable.fields);
  if (!uuidField) notFound("root table UUID field is missing");
  const subForms = buildSubFormContexts(context);

  if (!isRecord(request.select) || !Array.isArray(request.select.fields)) badRequest("select.fields must be an array");
  assertOnlyKeys(request.select, new Set(["fields", "subForms"]), "select");
  const selectedMainFields = unique(request.select.fields).filter(fieldUID => {
    const field = context.rootTable.fields.find(item => item.uid === fieldUID);
    if (!field) badRequest(`selected field does not exist: ${fieldUID}`);
    return isFieldReadable(context, context.rootTable.uid, fieldUID);
  });
  const selectedSubForms = new Map<FieldUID, FieldUID[]>();
  if (request.select.subForms !== undefined) {
    if (!isRecord(request.select.subForms)) badRequest("select.subForms must be an object");
    for (const [parentFieldUID, fieldUIDs] of Object.entries(request.select.subForms)) {
      const subForm = subForms.get(parentFieldUID as FieldUID);
      if (!subForm) badRequest(`selected subform does not exist: ${parentFieldUID}`);
      if (!Array.isArray(fieldUIDs)) badRequest(`selected subform fields must be an array: ${parentFieldUID}`);
      if (!isFieldReadable(context, context.rootTable.uid, subForm.parentField.uid)) continue;
      const selected = unique(fieldUIDs as FieldUID[]).filter(fieldUID => {
        if (!subForm.table.fields.some(field => field.uid === fieldUID)) badRequest(`selected subform field does not exist: ${parentFieldUID}.${fieldUID}`);
        return isFieldReadable(context, subForm.table.uid, fieldUID);
      });
      selectedSubForms.set(subForm.parentField.uid, selected);
    }
  }

  const sortEntries = request.sort || [];
  if (!Array.isArray(sortEntries)) badRequest("sort must be an array");
  const orderBy: Record<FieldUID, SortType> = {};
  for (const item of sortEntries) {
    if (!isRecord(item)) badRequest("sort item must be an object");
    assertOnlyKeys(item, new Set(["fieldUID", "direction"]), "sort item");
    const field = context.rootTable.fields.find(candidate => candidate.uid === item.fieldUID);
    if (!field || field.meta?.extra?.subTableUID || field.type === "array" || field.type === "object") badRequest(`sort field is invalid: ${item.fieldUID}`);
    if (!isFieldReadable(context, context.rootTable.uid, field.uid)) forbidden(`sort field is not readable: ${field.uid}`);
    if (item.direction !== 1 && item.direction !== -1) badRequest(`sort direction is invalid: ${field.uid}`);
    orderBy[field.uid] = item.direction;
  }

  const resolvedFilter = request.filter ? resolveFilter(request.filter, context, subForms) : undefined;
  if (metrics && resolvedFilter) {
    const scopes = collectScopes(resolvedFilter);
    const hasMain = scopes.has("main");
    const hasChild = Array.from(scopes).some(scope => scope.startsWith("child:"));
    metrics.filterPlan = hasMain && hasChild ? "mixed" : (hasChild ? "child" : "main");
  }
  const mainFilterFields = new Set<FieldUID>();
  let candidateParentCount = 0;
  const collectMainFields = (node?: ResolvedFilterNode) => {
    if (!node) return;
    if (node.kind === "condition" && node.scope === "main") mainFilterFields.add(node.fieldUID);
    else if (node.kind === "group") node.conditions.forEach(collectMainFields);
    else if (node.kind === "not") collectMainFields(node.condition);
  };
  collectMainFields(resolvedFilter);

  const compileRootFilter = async (node: ResolvedFilterNode): Promise<WhereCondition> => {
    const childScope = onlyChildScope(node);
    if (childScope) {
      const subForm = subForms.get(childScope);
      if (!subForm) badRequest(`subform filter is invalid: ${childScope}`);
      const parentIds = await context.distinct(subForm.table.uid, subForm.relationField.uid, filterToWhere(node), {
        stage: request.stage,
        scope: request.scope,
      });
      const parentSet = new Set(parentIds.map(String));
      candidateParentCount += parentSet.size;
      if (metrics) metrics.candidateParentCount = candidateParentCount;
      if (candidateParentCount > MAX_CANDIDATE_PARENT_IDS) {
        responseTooLarge(`candidate parent ids exceed ${MAX_CANDIDATE_PARENT_IDS}`);
      }
      return { [uuidField.uid]: { $in: Array.from(parentSet) } } as WhereCondition;
    }
    if (node.kind === "condition" || node.kind === "not") return filterToWhere(node);
    return mergeWhere(node.logic, await Promise.all(node.conditions.map(compileRootFilter)));
  };

  assertNotAborted(context, "filter");
  const filterStartedAt = Date.now();
  const rootWhere = resolvedFilter ? await compileRootFilter(resolvedFilter) : undefined;
  if (metrics) metrics.phaseDurationMs.filter = Date.now() - filterStartedAt;
  assertNotAborted(context, "main");
  const mainReadFields = unique([
    ...selectedMainFields,
    ...Array.from(selectedSubForms.keys()),
    ...Array.from(mainFilterFields),
    uuidField.uid,
  ]);
  const expandedMainReadFields = context.expandReadFieldDependencies?.(context.rootTable, mainReadFields) || mainReadFields;
  const mainStartedAt = Date.now();
  const rootBuckets = await context.read([context.rootTable.uid], {
    ...(pagination.pageNumber ? { pageNumber: pagination.pageNumber, pageSize: pagination.pageSize } : { start: pagination.start, limit: pagination.limit }),
    filters: rootWhere ? { [context.rootTable.uid]: [rootWhere] } : undefined,
    orderBy,
    stage: request.stage,
    scope: request.scope,
    formatData: true,
  }, {
    [context.rootTable.uid]: expandedMainReadFields,
  });
  const rootBucket = rootBuckets.find(bucket => bucket.tableId === context.rootTable.uid);
  if (!rootBucket) forbidden("root table is not readable");
  if (metrics) {
    metrics.phaseDurationMs.main = Date.now() - mainStartedAt;
    metrics.mainReadRows = rootBucket.rows?.length || 0;
  }
  assertNotAborted(context, "main");

  const rootRows = (rootBucket.rows || []).map(row => ({ ...row }));
  const rootIds = rootRows.map(row => row[uuidField.uid]).filter(value => value !== undefined && value !== null && value !== "").map(String);
  const hasFilteredSubForm = resolvedFilter && Array.from(selectedSubForms.keys()).some(parentFieldUID => (
    Boolean(pruneToChild(resolvedFilter, parentFieldUID))
  ));
  const mainOnlyFilter = hasFilteredSubForm ? getMainOnlySufficientFilter(resolvedFilter) : undefined;
  const mainMatchedParentIds = new Set<string>();
  if (mainOnlyFilter && rootIds.length) {
    const parentIds = await context.distinct(context.rootTable.uid, uuidField.uid, mergeWhere("and", [
      { [uuidField.uid]: { $in: rootIds } } as WhereCondition,
      filterToWhere(mainOnlyFilter),
    ]), {
      stage: request.stage,
      scope: request.scope,
    });
    parentIds.forEach(parentId => mainMatchedParentIds.add(String(parentId)));
  }
  assertNotAborted(context, "child");
  const childFieldUIDsMap: Record<TableUID, FieldUID[]> = {};
  const childFilters: Record<TableUID, WhereCondition[]> = {};
  for (const [parentFieldUID, selectedFields] of selectedSubForms) {
    const subForm = subForms.get(parentFieldUID)!;
    const childUUID = getUUIDSystemField(subForm.table.fields);
    const childFields = unique([
      ...selectedFields,
      subForm.relationField.uid,
      ...(childUUID ? [childUUID.uid] : []),
    ]);
    childFieldUIDsMap[subForm.table.uid] = context.expandReadFieldDependencies?.(subForm.table, childFields) || childFields;
    if (!rootIds.length) continue;
    const localFilter = resolvedFilter ? pruneToChild(resolvedFilter, parentFieldUID) : undefined;
    if (!localFilter) {
      childFilters[subForm.table.uid] = [{ [subForm.relationField.uid]: { $in: rootIds } } as WhereCondition];
      continue;
    }
    const allParentIds: string[] = [];
    const filteredParentIds: string[] = [];
    rootRows.forEach(row => {
      const rowId = String(row[uuidField.uid]);
      if (mainMatchedParentIds.has(rowId)) allParentIds.push(rowId);
      else filteredParentIds.push(rowId);
    });
    const conditions: WhereCondition[] = [];
    if (allParentIds.length) conditions.push({ [subForm.relationField.uid]: { $in: allParentIds } } as WhereCondition);
    if (filteredParentIds.length) {
      conditions.push(mergeWhere("and", [
        { [subForm.relationField.uid]: { $in: filteredParentIds } } as WhereCondition,
        filterToWhere(localFilter),
      ]));
    }
    childFilters[subForm.table.uid] = [mergeWhere("or", conditions)];
  }

  let childRows: Row[] = [];
  const childBucketMap = new Map<TableUID, Bucket>();
  if (rootIds.length && selectedSubForms.size) {
    const childTableUIDs = Array.from(selectedSubForms.keys()).map(fieldUID => subForms.get(fieldUID)!.table.uid);
    const childStartedAt = Date.now();
    const buckets = await readInBatches(context, childTableUIDs, {
      filters: childFilters,
      orderBy: SortType.ASC,
      stage: request.stage,
      scope: request.scope,
      formatData: true,
    }, childFieldUIDsMap, "child");
    buckets.forEach(bucket => childBucketMap.set(bucket.tableId as TableUID, bucket));
    childRows = buckets.flatMap(bucket => bucket.rows || []);
    if (metrics) metrics.phaseDurationMs.child = Date.now() - childStartedAt;
  }
  if (childRows.length > CHILD_ROW_LIMIT) responseTooLarge(`subform rows exceed ${CHILD_ROW_LIMIT}`);
  if (metrics) metrics.childReadRows = childRows.length;
  assertNotAborted(context, "child");

  const warnings: FormDataFindWarning[] = [];
  const assembledRows = rootRows.map(row => ({ ...row }));
  for (const [parentFieldUID, selectedFields] of selectedSubForms) {
    const subForm = subForms.get(parentFieldUID)!;
    const grouped = new Map<string, Row[]>();
    for (const row of childBucketMap.get(subForm.table.uid)?.rows || []) {
      const parentId = row[subForm.relationField.uid];
      if (parentId === undefined || parentId === null || parentId === "") continue;
      const rows = grouped.get(String(parentId)) || [];
      rows.push({ ...row });
      grouped.set(String(parentId), rows);
    }
    for (const row of assembledRows) {
      const parentId = String(row[uuidField.uid]);
      const rows = grouped.get(parentId) || [];
      if (rows.length > 200) {
        warnings.push({ code: "SUBFORM_ROW_OVERFLOW", fieldUID: parentFieldUID, parentId, actual: rows.length, expectedMax: 200 });
      }
      row[parentFieldUID] = rows.map(childRow => projectRow(childRow, unique([...selectedFields, subForm.relationField.uid])));
    }
  }
  if (childRows.length > CHILD_ROW_WARNING) {
    warnings.push({ code: "FIND_RESPONSE_LARGE", estimatedBytes: 0 });
  }

  const relatedGroups = new Map<TableUID, {
    table: Table;
    uuidField: Field;
    titleField?: Field;
    ids: Set<string>;
    sources: Array<{ rows: Row[]; field: Field }>;
  }>();
  const collectRelated = (table: Table, rows: Row[], fieldUIDs: FieldUID[]) => {
    for (const fieldUID of fieldUIDs) {
      const field = table.fields.find(item => item.uid === fieldUID);
      const targetTableUID = field?.meta?.extra?.relatedTableUID?.[1];
      if (!field || !targetTableUID) continue;
      const targetTable = context.tables.get(targetTableUID);
      const targetUUID = targetTable && getUUIDSystemField(targetTable.fields);
      if (!targetTable || !targetUUID) notFound(`related table is invalid: ${field.uid}`);
      const current = relatedGroups.get(targetTableUID) || {
        table: targetTable,
        uuidField: targetUUID,
        titleField: targetTable.fields.find(item => item.meta?.name === SystemField.DATA_TITLE),
        ids: new Set<string>(),
        sources: [],
      };
      rows.forEach(row => normalizeRelatedIds(row[field.uid]).forEach(id => current.ids.add(String(id))));
      current.sources.push({ rows, field });
      relatedGroups.set(targetTableUID, current);
    }
  };
  collectRelated(context.rootTable, assembledRows, selectedMainFields);
  for (const [parentFieldUID, selectedFields] of selectedSubForms) {
    const subForm = subForms.get(parentFieldUID)!;
    const rows = assembledRows.flatMap(row => Array.isArray(row[parentFieldUID]) ? row[parentFieldUID] as Row[] : []);
    collectRelated(subForm.table, rows, selectedFields);
  }

  for (const [tableUID, group] of relatedGroups) {
    if (!group.ids.size) relatedGroups.delete(tableUID);
  }
  const uniqueRelatedIds = Array.from(relatedGroups.values()).reduce((total, group) => total + group.ids.size, 0);
  if (metrics) metrics.uniqueRelatedIds = uniqueRelatedIds;
  if (uniqueRelatedIds > MAX_RELATED_IDS) responseTooLarge(`unique related ids exceed ${MAX_RELATED_IDS}`);

  if (relatedGroups.size) {
    const relatedFilters: Record<TableUID, WhereCondition[]> = {};
    const relatedFieldsMap: Record<TableUID, FieldUID[]> = {};
    for (const [tableUID, group] of relatedGroups) {
      relatedFilters[tableUID] = [{ [group.uuidField.uid]: { $in: Array.from(group.ids) } } as WhereCondition];
      const fields = unique([group.uuidField.uid, ...(group.titleField ? [group.titleField.uid] : [])]);
      relatedFieldsMap[tableUID] = context.expandReadFieldDependencies?.(group.table, fields) || fields;
    }
    const relatedStartedAt = Date.now();
    const relatedBuckets = await readInBatches(context, Array.from(relatedGroups.keys()), {
      filters: relatedFilters,
      stage: request.stage,
      scope: request.scope,
      formatData: true,
    }, relatedFieldsMap, "related");
    if (metrics) {
      metrics.phaseDurationMs.related = Date.now() - relatedStartedAt;
      metrics.relatedReadRows = relatedBuckets.reduce((total, bucket) => total + (bucket.rows?.length || 0), 0);
    }
    const bucketMap = new Map(relatedBuckets.map(bucket => [bucket.tableId as TableUID, bucket]));
    for (const [tableUID, group] of relatedGroups) {
      const titleMap = new Map<string, unknown>();
      for (const row of bucketMap.get(tableUID)?.rows || []) {
        titleMap.set(String(row[group.uuidField.uid]), group.titleField ? row[group.titleField.uid] : null);
      }
      for (const source of group.sources) {
        for (const row of source.rows) {
          row[source.field.uid] = normalizeRelatedIds(row[source.field.uid]).map<FormDataRelatedRef>(id => ({
            id: String(id),
            title: titleMap.has(String(id)) ? (titleMap.get(String(id)) ?? null) : null,
          }));
        }
      }
    }
  }
  assertNotAborted(context, "serialize");

  const outputMainFields = unique([...selectedMainFields, ...Array.from(selectedSubForms.keys())]);
  const serializeStartedAt = Date.now();
  let estimatedBytes = 0;
  const outputRows = assembledRows.map(row => {
    const projected = projectRow(row, outputMainFields);
    estimatedBytes += Buffer.byteLength(JSON.stringify(projected), "utf8");
    if (estimatedBytes > RESPONSE_SIZE_LIMIT) responseTooLarge(`response exceeds ${RESPONSE_SIZE_LIMIT} bytes`);
    return projected;
  });
  const fields = outputMainFields.map(fieldUID => {
    const field = context.rootTable.fields.find(item => item.uid === fieldUID)!;
    const childFields = selectedSubForms.get(fieldUID);
    return childFields
      ? { ...field, subTableFields: childFields.map(childFieldUID => subForms.get(fieldUID)!.table.fields.find(item => item.uid === childFieldUID)!).filter(Boolean) }
      : { ...field, subTableFields: undefined };
  });
  const total = rootBucket.count ?? rootRows.length;
  const response: FormDataFindResponse = {
    table: { uid: context.rootTable.uid, name: context.rootTable.alias },
    fields,
    data: outputRows,
    pagination: {
      ...(pagination.pageNumber ? {
        pageNumber: pagination.pageNumber,
        pageSize: pagination.pageSize,
        pageCount: Math.ceil(total / pagination.pageSize!),
      } : {}),
      start: pagination.start,
      limit: pagination.limit,
      total,
    },
  };
  estimatedBytes += Buffer.byteLength(JSON.stringify({ table: response.table, fields: response.fields, pagination: response.pagination }), "utf8");
  if (metrics) {
    metrics.phaseDurationMs.serialize = Date.now() - serializeStartedAt;
    metrics.estimatedResponseBytes = estimatedBytes;
  }
  if (estimatedBytes > RESPONSE_SIZE_LIMIT) responseTooLarge(`response exceeds ${RESPONSE_SIZE_LIMIT} bytes`);
  if (estimatedBytes > RESPONSE_SIZE_WARNING || childRows.length > CHILD_ROW_WARNING) {
    const sizeWarning = warnings.find(item => item.code === "FIND_RESPONSE_LARGE") as Extract<FormDataFindWarning, { code: "FIND_RESPONSE_LARGE" }> | undefined;
    if (sizeWarning) sizeWarning.estimatedBytes = estimatedBytes;
    else warnings.push({ code: "FIND_RESPONSE_LARGE", estimatedBytes });
  }
  if (warnings.length) response.warnings = warnings;
  return response;
}
