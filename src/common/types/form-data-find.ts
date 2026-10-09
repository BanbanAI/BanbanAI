import type {
  Field,
  FieldUID,
  FormDataStageWhereCondition,
  FormDataStoreScope,
  Row,
  SortType,
  TableUID,
} from "./project";

export type FormDataFindConditionMethod =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "nin"
  | "all"
  | "size"
  | "exists"
  | "regex";

export type FormDataFindFilterCondition = {
  kind: "condition";
  path: [FieldUID] | [FieldUID, FieldUID];
  type: string;
  method: FormDataFindConditionMethod;
  value: unknown;
};

export type FormDataFindFilterGroup = {
  kind: "group";
  logic: "and" | "or";
  conditions: FormDataFindFilterNode[];
};

export type FormDataFindFilterNot = {
  kind: "not";
  condition: FormDataFindFilterNode;
};

export type FormDataFindFilterNode =
  | FormDataFindFilterCondition
  | FormDataFindFilterGroup
  | FormDataFindFilterNot;

export type FormDataFindSelect = {
  fields: FieldUID[];
  subForms?: Record<FieldUID, FieldUID[]>;
};

export type FormDataFindRequest = {
  nocodeId: string;
  tableUID: TableUID;
  pagination:
    | { pageNumber: number; pageSize: number }
    | { start: number; limit: number };
  select: FormDataFindSelect;
  filter?: FormDataFindFilterNode;
  sort?: Array<{
    fieldUID: FieldUID;
    direction: SortType;
  }>;
  stage?: FormDataStageWhereCondition;
  scope?: FormDataStoreScope;
  context?: {
    widgetNocodeId: string;
    widgetUID: string;
  };
};

export type FormDataRelatedRef = {
  id: string;
  title: unknown | null;
};

export type FormDataFindWarning =
  | {
    code: "SUBFORM_ROW_OVERFLOW";
    fieldUID: FieldUID;
    parentId: string;
    actual: number;
    expectedMax: 200;
  }
  | {
    code: "FIND_RESPONSE_LARGE";
    estimatedBytes: number;
  };

export type FormDataFindResponse = {
  table: {
    uid: TableUID;
    name: string;
  };
  fields: Field[];
  data: Row[];
  pagination: {
    pageNumber?: number;
    pageSize?: number;
    start: number;
    limit: number;
    total: number;
    pageCount?: number;
  };
  warnings?: FormDataFindWarning[];
};
