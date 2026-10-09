import type { ClientTheme } from "@renderer/types/base";
import { Account, Department, NocodeUser, Role } from "./account";
import { 
  Connection,
  ConnectionUID,
  Field,
  FieldType,
  FieldUID,
  FolderMeta,
  FormOptions,
  OrganizeOptionValue,
  ProcessFlow,
  ProcessNodeStatus,
  ProcessNodeType,
  ProcessVersionStatus,
  ProjectBody,
  PublishUpdateMethod,
  Row,
  SortType,
  Table,
  TableUID,
  TodoDataId,
  ProcessFlowOptions,
  DataChangeType,
  FlowOpinionFile,
  WidgetSoul,
  TODOTriggerType,
  FormValidRule,
  FormSubmitAllowNoticeMode,
  FormSubmitValidMode,
  FieldExtra,
  WhereCondition
} from "./project";
import { SaasPlan } from "./user";
import { SystemField } from "@common/types/system-field";
import i18next from "i18next";

export type Nocode = {
  meta: NocodeMeta,
  body: NocodeBody,
  pageBodies?: ProjectBody[],
  projectsInfo?: {
    id: string,
    name: string,
  }
}

export enum NocodeStructureType {
  PAGE = "page",
  GROUP = "group",
  FORM = "form",
}
export type NocodeStructure = {
  id: string,
  name: string,
  type: NocodeStructureType,
  disable?: boolean,
  children?: NocodeStructure[],
}

export type NocodeHomePageSetting = {
  enabled: boolean,
  nodeId?: string,
}

export enum FormTableRowHeight {
  AUTO = "auto",
  SMALL = "small",
  MEDIUM = "medium",
  LARGE = "large",
}

export enum LogicalOperator {
  AND = "AND",
  OR = "OR",
}

export enum RuleFunc {
  /** 等于 */
  EQUAL = "=",
  /** 不等于 */
  NOT_EQUAL = "!=",
  /** 为空 */
  EMPTY = "∅",
  /** 不为空 */
  NOT_EMPTY = "!∅",
  /** 包含 */
  CONTAIN = "⊃",
  /** 不包含 */
  NOT_CONTAIN = "!⊃",
  /** 属于 */
  BELONG = "∋",
  /** 不属于 */
  NOT_BELONG = "!∋",
  /** 大于 */
  GT = ">",
  /** 小于 */
  LT = "<",
  /** 大于等于 */
  GTE = ">=",
  /** 小于等于 */
  LTE = "<=",
  /** 等于任意一个 */
  IN = "∈",
  /** 不等于任意一个 */
  NOT_IN = "!∈",
  /** 包含任意一个*/
  CONTAIN_ANY = "⊃∃",
  /** 同时包含 */
  CONTAIN_ALL = "⊃∀",
  /** 时间等于*/
  TIME_EQUAL = "T=",
  /** 时间不等于*/
  TIME_NOT_EQUAL = "T!=",
  /** 时间小于等于 */
  TIME_LTE = "T<=",
  /** 时间选择范围 */
  TIME_BETWEEN = "T~",
  /** 选择范围 */
  BETWEEN = "~",
  /** 动态筛选 */
  DYNAMIC = "DYNAMIC",
  /** 开启 */
  TRUE = "TRUE",
  /** 关闭 */
  FALSE = "FALSE",
}

export const RuleFuncTextMapping = {
  get[RuleFunc.EQUAL](){return i18next.t('commonNocode.equal')},
  get[RuleFunc.NOT_EQUAL](){return i18next.t('commonNocode.notEqual')},
  get[RuleFunc.TIME_EQUAL](){return i18next.t('commonNocode.equal')},
  get[RuleFunc.TIME_NOT_EQUAL](){return i18next.t('commonNocode.notEqual')},
  get[RuleFunc.TIME_LTE](){return i18next.t('commonNocode.lte')},
  get[RuleFunc.TIME_BETWEEN](){return i18next.t('commonNocode.selectRange')},
  get[RuleFunc.EMPTY](){return i18next.t('commonNocode.isEmpty')},
  get[RuleFunc.NOT_EMPTY](){return i18next.t('commonNocode.isNotEmpty')},
  get[RuleFunc.CONTAIN](){return i18next.t('commonNocode.contain')},
  get[RuleFunc.NOT_CONTAIN](){return i18next.t('commonNocode.notContain')},
  get[RuleFunc.BELONG](){return i18next.t('commonNocode.belongTo')},
  get[RuleFunc.NOT_BELONG](){return i18next.t('commonNocode.notBelongTo')},
  get[RuleFunc.GT](){return i18next.t('commonNocode.greater')},
  get[RuleFunc.LT](){return i18next.t('commonNocode.less')},
  get[RuleFunc.GTE](){return i18next.t('commonNocode.gte')},
  get[RuleFunc.LTE](){return i18next.t('commonNocode.lte')},
  get[RuleFunc.IN](){return i18next.t('commonNocode.equalAny')},
  get[RuleFunc.NOT_IN](){return i18next.t('commonNocode.notEqualAny')},
  get[RuleFunc.CONTAIN_ANY](){return i18next.t('commonNocode.containAny')},
  get[RuleFunc.CONTAIN_ALL](){return i18next.t('commonNocode.containAll')},
  get[RuleFunc.BETWEEN](){return i18next.t('commonNocode.selectRange')},
  get[RuleFunc.DYNAMIC](){return i18next.t('commonNocode.dynamicFilter')},
  get[RuleFunc.TRUE](){return i18next.t('commonNocode.enable')},
  get[RuleFunc.FALSE](){return i18next.t('commonNocode.disable')}
}

export enum RuleFuncValue {
  STRING = "string",
  NUMBER = "number",
  SELECT = "select",
  SELECT_MULTIPLE = "selectMultiple",
  TREE_SELECT = "treeSelect",
  TAGS = "tags",
  RANGE = "range",
  DATE = "date",
  TIME = "time",
  ADDRESS = "address",
  NULL = "null",
}

export enum DateDynamicRuleType {
  TODAY = "today",
  YESTERDAY = "yesterday",
  TOMORROW = "tomorrow",
  THIS_WEEK = "thisWeek",
  LAST_WEEK = "lastWeek",
  NEXT_WEEK = "nextWeek",
  THIS_MONTH = "thisMonth",
  LAST_MONTH = "lastMonth",
  NEXT_MONTH = "nextMonth",
  THIS_QUARTER = "thisQuarter",
  LAST_QUARTER = "lastQuarter",
  NEXT_QUARTER = "nextQuarter",
  THIS_YEAR = "thisYear",
  LAST_YEAR = "lastYear",
  NEXT_YEAR = "nextYear",
  LAST_7_DAYS = "last7Days",
  LAST_30_DAYS = "last30Days",
  LAST_90_DAYS = "last90Days",
  CUSTOM = "custom",
}

export const DateDynamicRuleTypeMapping = {
  get[DateDynamicRuleType.TODAY](){return i18next.t('commonNocode.today')},
  get[DateDynamicRuleType.YESTERDAY](){return i18next.t('commonNocode.yesterday')},
  get[DateDynamicRuleType.TOMORROW](){return i18next.t('commonNocode.tomorrow')},
  get[DateDynamicRuleType.THIS_WEEK](){return i18next.t('commonNocode.thisWeek')},
  get[DateDynamicRuleType.LAST_WEEK](){return i18next.t('commonNocode.lastWeek')},
  get[DateDynamicRuleType.NEXT_WEEK](){return i18next.t('commonNocode.nextWeek')},
  get[DateDynamicRuleType.THIS_MONTH](){return i18next.t('commonNocode.thisMonth')},
  get[DateDynamicRuleType.LAST_MONTH](){return i18next.t('commonNocode.lastMonth')},
  get[DateDynamicRuleType.NEXT_MONTH](){return i18next.t('commonNocode.nextMonth')},
  get[DateDynamicRuleType.THIS_QUARTER](){return i18next.t('commonNocode.thisQuarter')},
  get[DateDynamicRuleType.LAST_QUARTER](){return i18next.t('commonNocode.lastQuarter')},
  get[DateDynamicRuleType.NEXT_QUARTER](){return i18next.t('commonNocode.nextQuarter')},
  get[DateDynamicRuleType.THIS_YEAR](){return i18next.t('commonNocode.thisYear')},
  get[DateDynamicRuleType.LAST_YEAR](){return i18next.t('commonNocode.lastYear')},
  get[DateDynamicRuleType.NEXT_YEAR](){return i18next.t('commonNocode.nextYear')},
  get[DateDynamicRuleType.LAST_7_DAYS](){return i18next.t('commonNocode.last7Days')},
  get[DateDynamicRuleType.LAST_30_DAYS](){return i18next.t('commonNocode.last30Days')},
  get[DateDynamicRuleType.LAST_90_DAYS](){return i18next.t('commonNocode.last90Days')},
  get[DateDynamicRuleType.CUSTOM](){return i18next.t('commonNocode.custom')},
}

export enum AggregationType {
  NOT_SHOW = 'not-show',
  COUNT = 'count',
  SUM = 'summation',
  AVE = 'average',
  MAX = 'maximum',
  MIN = 'minimum',
  FILLED = 'filled',
  UNFILLED = 'unfilled',
}

export type FormElementConfiguration = {
  subType?: string,
  funcInfo?: Partial<Record<RuleFunc, RuleFuncValue>>;
  editFuncInfo?: Partial<Record<RuleFunc, RuleFuncValue>>;
  editFuncInfoText?: Partial<Record<RuleFunc, string>>;
  aggregationInfo?: AggregationType[],
}

export enum FormConditionValueType {
  FORM = "FORM",
  CUSTOM = "CUSTOM",
  FORMULA = "formula",
  NODE = "NODE",
  FILTER_ROW = 'FILTER_ROW'
}

export type FormCondition = {
  uid: string,
  func: RuleFunc,
  value: any,
  formula?: string;
  fixedValue?: any,
  type?: FormConditionValueType,
  tFormat?: any,
  datePrecision?: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second',
}

export type FilterRule = {
  logic: LogicalOperator;
  conditions: FormCondition[];
}
export type FilterDisplayMode = "popover" | "fixed";
export type FormSortField = { field: FieldUID, value: SortType };
export type FormTableColumnOrder = Record<string, Record<FieldUID, number>>;
export type FormTablePermissionMode = "form" | "all";
export type FormTableOperationSettings = {
  export?: boolean,
  print?: boolean,
}
export type FormTableCarouselSettings = {
  mode?: "none" | "scroll" | "page",
  scrollSpeed?: "slow" | "medium" | "fast",
  pageInterval?: number,
}
export type FormTableViewMeta = {
  columnWidths?: Record<FieldUID, number>,
  rowHeight?: FormTableRowHeight,
  filterRules?: FilterRule,
  hiddenColumns?: FieldUID[],
  columnOrders?: FormTableColumnOrder,
  sort?: FormSortField[],
  fixedColumn?: FieldUID | null,
  manualFixedColumn?: FieldUID | null,
  pageSize?: number,
  dataAggregation?: Record<FieldUID, AggregationType>,
  filterDisplayMode?: FilterDisplayMode,
  searchFieldIds?: FieldUID[],
  aggregateFields?: TableAggregateField[],
  processInfoFolded?: boolean,
  permissionMode?: FormTablePermissionMode,
  operationSettings?: FormTableOperationSettings,
  topLimit?: number,
  showIndex?: boolean,
  fixedColumnCount?: 0 | 1 | 2 | 3 | 4,
  carouselSettings?: FormTableCarouselSettings,
}
export type AggregateMetricFormat = {
  isPercent?: boolean,
  completeZero?: boolean,
  decimalPlaces?: number,
  thousandSeparator?: string,
  decimalSeparator?: string,
}
export type AggregateFieldReference = {
  sourceUID: string,
  fieldUID?: FieldUID | "_count" | null,
  subFieldUID?: FieldUID | "_count" | null,
}
export type AggregateSourceTable = {
  uid: string,
  connectionUID?: ConnectionUID | null,
  tableUID?: TableUID | null,
  subTableUID?: TableUID | null,
  filterRule?: FilterRule | null,
}
export type AggregateDimensionItem = AggregateFieldReference & {
  uid: string,
}
export type AggregateDimensionDateFormat =
  | "year"
  | "year-quarter"
  | "year-month"
  | "year-week"
  | "year-month-day";
export type AggregateDimension = {
  uid: string,
  name?: string,
  dateFormat?: AggregateDimensionDateFormat | null,
  items?: AggregateDimensionItem[],
}
export type AggregateVariableAggregate = "SUM" | "AVERAGE" | "COUNT" | "MAX" | "MIN";
export type AggregateVariable = AggregateFieldReference & {
  uid: string,
  name: string,
  aggregate: AggregateVariableAggregate,
}
export type AggregateMetricVariable = AggregateVariable & {
  sourceVariableUID?: string,
  filterRule?: FilterRule | null,
}
export type AggregateMetricMode = "formula" | "singleField";
export type AggregateMetric = {
  uid: string,
  name: string,
  mode?: AggregateMetricMode,
  formula: string,
  format?: AggregateMetricFormat,
  variables?: AggregateMetricVariable[],
  singleFieldConfig?: AggregateMetricVariable | null,
}
export type TableAggregateFieldMode = "formula" | "singleField";
export type TableAggregateField = {
  uid: string,
  name: string,
  mode?: TableAggregateFieldMode,
  formula?: string,
  format?: AggregateMetricFormat,
  singleFieldConfig?: AggregateMetricVariable | null,
  filterRules?: Record<string, Record<TableUID, FilterRule>>,
}
export type AggregateSubmitValidateRule = {
  uid: string,
  errorText: string,
  formula: string,
  conditions?: FormCondition[],
}
export type AggregateSubmitValidateConfig = {
  enabled?: boolean,
  rules?: AggregateSubmitValidateRule[],
}
export type AggregateTable = {
  uid: string,
  name: string,
  description?: string,
  dimensionFilterEmpty?: boolean,
  sourceTables?: AggregateSourceTable[],
  dimensions?: AggregateDimension[],
  variables?: AggregateVariable[],
  metrics?: AggregateMetric[],
  submitValidate?: AggregateSubmitValidateConfig,
}
export type NocodeFormData = {
  uid: ConnectionUID,
  options: FormDataOptions,
  formOptions: FormOptions,
  metas?: Record<TableUID, FormTableViewMeta>,
  tables?: Table[],
  aggregateTables?: AggregateTable[],
}

export type NocodeImportOriginalAuthor = {
  uid: string,
  identifier?: string,
  accountId?: string,
  username?: string,
  realname?: string,
}

export type NocodeImportRestriction = {
  disableEdit?: boolean,
  lockable?: boolean,
  expireAt?: number,
  originalAuthor?: NocodeImportOriginalAuthor,
}

export type NocodeImportState = {
  disableEdit: boolean,
  expired: boolean,
  expireAt: number | null,
  canClearReadonly: boolean,
  canManageReadonly: boolean,
  canManageExpireAt: boolean,
}

export enum PermissionFilterMode {
  BLACK = "blacklist",
  WHITE = "whitelist",
}

export type ApplicationPermission = Record<
Exclude<PermissionCategory, PermissionCategory.ADD>, 
{
  rangeType: PermissionFilterMode,
  [PermissionFilterMode.BLACK]: PermissionRange,
  [PermissionFilterMode.WHITE]: PermissionRange,
}>;


export enum PermissionRangeType {
  ALL = "all",
  CUSTOM = "custom",
}
export type PermissionRange = OrganizeOptionValue;
export type PagePermission = Record<string, {
  [PermissionCategory.GET]: {
    rangeType: PermissionRangeType,
    range?: PermissionRange,
  }
}>;

export enum PermissionCategory {
  ADD = "add",
  GET = "get",
  UPDATE = "update",
  DELETE = "delete",
}

export type DataPermissionDataRange = {
  all: boolean,
  self: boolean,
  currentDepartment: boolean,
  siblingDepartment: boolean,
  subDepartment: boolean,
  anonymous: boolean,
  customDepartment: {
    enabled: boolean,
    departments?: string[],
  },
  fromFormField: {
    enabled: boolean,
    field?: FieldUID | FieldUID[] | null,
  }
}

export type DataPermissionDataStatus = {
  processing: boolean,
  finished: boolean,
  noProcess: boolean,
}
export type MemberRange = {
  rangeType: PermissionRangeType,
  range?: PermissionRange,
}
export type OperationPermission = Record<string, Record<string, MemberRange>>;
export type DataPermissionOther = {
  title: string,
  description: string,
  memberRange: MemberRange,
  dataRange: DataPermissionDataRange,
  dataStatus: DataPermissionDataStatus,
  handleRange: {
    [PermissionCategory.GET]: boolean,
    [PermissionCategory.UPDATE]: boolean,
    [PermissionCategory.DELETE]: boolean,
  },
}
export type DataPermissionContent = {
  [PermissionCategory.ADD]: MemberRange,
  other: Array<DataPermissionOther>,
}
export type DataPermission = Record<string, DataPermissionContent>;

export enum ViewOperationPermissionKey {
  IMPORT = "import",
  EXPORT = "export",
  BATCH_PRINT = "batchPrint",
  BATCH_UPDATE = "batchUpdate",
  BATCH_DELETE = "batchDelete",
}

export type ViewOperationPermissionGroup = {
  title: string,
  description: string,
  memberRange: MemberRange,
  handleRange: Record<ViewOperationPermissionKey, boolean>,
}

export enum ViewPermissionCategory {
  FORM = 'form',
  TABLE = 'table',
  DOCUMENT = 'document',
  CATEGORY = 'category',
  ALBUM = 'album'
}
export type ViewPermissionItem = {
  [PermissionCategory.GET]: {
    rangeType: PermissionRangeType,
    range?: PermissionRange,
  },
  operationGroups?: ViewOperationPermissionGroup[],
}
export type ViewPermission = Record<string, Record<string, ViewPermissionItem>>; // 表单id, 视图id

export type FieldPermissionRange = {
  rangeType: PermissionRangeType,
  range: Record<string, FieldAuthValue>,
}

export type FieldPermissionGroupItemType = {
  title: string,
  description: string,
  memberRange: MemberRange,
  fieldRange: FieldPermissionRange,
  externalVisitorEnabled?: boolean,
}
export type FieldPermission = Record<string, {
  [PermissionCategory.GET]: FieldPermissionGroupItemType[]
}>

export enum ViewActionType {
  BUTTON = "button",
}

export enum ViewActionTarget {
  VIEW_ALL = "view_all",
  VIEW_SELECTED = "view_selected",
  RECORD = "record",
}

export enum ViewActionButtonStyle {
  SOLID = "solid",
  OUTLINE = "outline",
}

export enum ViewActionPlacement {
  VIEW_TOOLBAR = "table_toolbar",
  TABLE_ACTION_COLUMN = "table_action_column",
  DETAIL_HEADER = "detail_header",
}

export enum ViewActionBehaviorType {
  CREATE_RECORD = "create_record",
  EDIT_RECORD = "edit_record",
  TRIGGER_PROCESS = "trigger_process",
}

export enum ViewActionFieldValueType {
  FIELD = "field",
  CUSTOM = "custom",
  FORMULA = "formula",
  EMPTY = "empty",
}

export enum ViewActionConditionScope {
  VIEW = "view",
  RECORD = "record",
}

export enum ViewActionViewConditionMode {
  ALWAYS = "always",
  HAS_DATA = "has_data",
  NO_DATA = "no_data",
}

export enum ViewActionRecordConditionMode {
  ALL = "all",
  ANY = "any",
}

export enum ViewActionTriggerMode {
  EACH_RECORD = "each_record",
  VIEW_CONTEXT_ONCE = "view_context_once",
}

export enum ViewActionLabelSyncMode {
  AUTO = "auto",
  MANUAL = "manual",
}

export type ViewActionDisplay = {
  label: string,
  labelSyncMode?: ViewActionLabelSyncMode,
  style: ViewActionButtonStyle,
  color?: string,
  icon?: string,
  placement?: ViewActionPlacement,
}

export type ViewActionFieldId = FieldUID | `${FieldUID}.${FieldUID}`;

export type ViewActionFieldValue = {
  valueType: ViewActionFieldValueType,
  value: any,
}

export type ViewActionFieldMapping = {
  fieldId: ViewActionFieldId,
  valueType: ViewActionFieldValueType,
  value: any,
}

export type ViewActionCreateRecordConfig = {
  targetFormId: TableUID,
  fieldMappings: ViewActionFieldMapping[],
}

export enum ViewActionEditFieldMode {
  CURRENT = "current",
  CUSTOM = "custom",
}

export type ViewActionEditField = {
  fieldId: ViewActionFieldId,
  mode: ViewActionEditFieldMode,
  customValue?: any,
}

export type ViewActionEditRecordConfig = {
  fields: ViewActionEditField[],
}

export type ViewActionTriggerProcessConfig = {
  processId: string,
  triggerNodeId: string,
  triggerMode: ViewActionTriggerMode,
}

export type ViewActionBehavior =
  | {
      type: ViewActionBehaviorType.CREATE_RECORD,
      config: ViewActionCreateRecordConfig,
    }
  | {
      type: ViewActionBehaviorType.EDIT_RECORD,
      config: ViewActionEditRecordConfig,
    }
  | {
      type: ViewActionBehaviorType.TRIGGER_PROCESS,
      config: ViewActionTriggerProcessConfig,
    };

export type ViewActionViewExecuteCondition = {
  enabled: boolean,
  scope: ViewActionConditionScope.VIEW,
  mode: ViewActionViewConditionMode,
  conditions?: never[],
  tip?: string,
}

export type ViewActionRecordExecuteCondition = {
  enabled: boolean,
  scope: ViewActionConditionScope.RECORD,
  mode: ViewActionRecordConditionMode,
  conditions: FormCondition[],
  tip?: string,
}

export type ViewActionExecuteCondition =
  | ViewActionViewExecuteCondition
  | ViewActionRecordExecuteCondition;

export type ViewAction = {
  id: string,
  name: string,
  code: string,
  type: ViewActionType,
  description?: string,
  target: ViewActionTarget,
  display: ViewActionDisplay,
  behavior: ViewActionBehavior,
  executeCondition: ViewActionExecuteCondition,
  order: number,
}

export type ExecuteViewActionEditContext = {
  viewId: string,
  actionId: string,
  uuid: string,
}

export type ViewActionTriggerContext = {
  tableUID: TableUID,
  viewId: string,
  actionId: string,
  target: ViewActionTarget,
  triggerNodeId: string,
  triggerMode: ViewActionTriggerMode,
  matchedCount: number,
  targetUUIDs?: string[],
  filterRule?: FilterRule,
  searchValue?: FormCondition[],
  filters?: Record<TableUID, WhereCondition[]>,
}

export type PrepareEditViewActionResult = {
  row: Row,
  fields: ViewActionFieldId[],
  context?: ExecuteViewActionEditContext,
}

export type ExecuteViewActionRequest = {
  nocodeId: string,
  tableUID: TableUID,
  viewId: string,
  actionId: string,
  uuid?: string,
  targetUUIDs?: string[],
  filterRule?: FilterRule,
  searchValue?: FormCondition[],
  filters?: Record<TableUID, WhereCondition[]>,
  previewOnly?: boolean,
  confirmed?: boolean,
  expectedAffectedCount?: number,
  expectedAffectedRowsDigest?: string,
}

export type ExecuteViewActionFailedItem = {
  index: number,
  uuid: string,
  dataTitle: string,
  message: string,
  suggestion: string,
}

export type ExecuteViewActionResult = {
  type: ViewActionBehaviorType,
  message?: string,
  affectedCount?: number,
  affectedRowsDigest?: string,
  executionMode?: "row_batch" | "view_once",
  matchedCount?: number,
  triggeredCount?: number,
  attemptedCount?: number,
  successCount?: number,
  failedCount?: number,
  partialSuccess?: boolean,
  failedItems?: ExecuteViewActionFailedItem[],
  requiresConfirm?: boolean,
  blockedByLimit?: boolean,
  prepareEditResult?: PrepareEditViewActionResult,
}

export type ViewActionTriggerPrecheckItem = {
  index: number,
  uuid: string,
  dataTitle: string,
  executable: boolean,
  reasonCode?: string,
  message?: string,
}

export type ViewActionTriggerPrecheckResult = {
  type: ViewActionBehaviorType.TRIGGER_PROCESS,
  executionMode: "row_batch",
  attemptedCount: number,
  executableCount: number,
  blockedCount: number,
  items: ViewActionTriggerPrecheckItem[],
}

export type EnqueueViewActionTriggerRequest = ExecuteViewActionRequest & {
  targetUUIDs: string[],
  idempotencyKey: string,
}

export type EnqueueViewActionTriggerBlockedItem = {
  uuid: string,
  reasonCode: string,
  message: string,
}

export type EnqueueViewActionTriggerResult = {
  batchId: string,
  acceptedCount: number,
  blockedCount: number,
  blockedItems: EnqueueViewActionTriggerBlockedItem[],
}

export enum PrintTemplateExportNameMode {
  DEFAULT = "default",
  DATA_TITLE = "dataTitle",
  CUSTOM = "custom",
}
export enum PrintTemplateType {
  WORD = "Word",
  EXCEL = "Excel",
}
export enum PrintTemplateMode {
  /** 合并成一个文件打印 */
  SINGLE = "single",
  /** 拆分成多个文件打印 */
  MULTIPLE = "multiple",
}
export type PrintTemplateExportNameSegment =
  | { type: "text", value: string }
  | { type: "field", fieldUid: string };
export enum PrintFlowCommentOrder {
  /** 按提交先后逆序打印 */
  DESC = "desc",
  /** 按提交先后顺序打印 */
  ASC = "asc",
}
export enum PrintFlowCommentNodeScope {
  /** 有审批意见的全部节点 */
  ALL = "all",
  /** 自定义节点 */
  CUSTOM = "custom",
}
export type PrintFlowCommentRule = {
  order?: PrintFlowCommentOrder,
  nodeScope?: PrintFlowCommentNodeScope,
  nodeIds?: string[],
  /** 只打印提交/后加签这类完成操作的审批意见 */
  onlySubmitOperation?: boolean,
  /** 只打印非空审批意见 */
  onlyNonEmptyComment?: boolean,
}
export type PrintTemplate = {
  uid: string,
  type: PrintTemplateType,
  name: string,
  range: OrganizeOptionValue,
  enabled: boolean,
  file?: {
    path?: string,
    name: string,
    size: number,   
    raw?: File,
  },
  mode: PrintTemplateMode,
  exportNameMode: PrintTemplateExportNameMode, 
  exportNameValue?: string,
  exportNameSegments?: PrintTemplateExportNameSegment[],
  flowCommentRule?: PrintFlowCommentRule,
}

export type PrintedTemplateRecord = {
  uid: string,
  name: string,
  url: string,
  size: number,
  createTime: number,
  type: PrintTemplateType,
  isTemporary?: boolean,
}

export type CrossAppFormSetting = {
  nocodeId: string,
  tableUID: TableUID,
}

export type CrossAppSettings = {
  forms: CrossAppFormSetting[],
}

export type OtherDataSource = {
  nocodeId: string,
  uid: ConnectionUID, // formData.uid
  name: string,
  options?: FormDataOptions,
  formOptions?: FormOptions,
  metas?: Record<TableUID, FormTableViewMeta>,
  tables: Table[], // 包括子表单
  aggregateTables?: AggregateTable[],
}

export type NocodeBody = {
  settings: {
    crossApp?: CrossAppSettings,
    homePage?: NocodeHomePageSetting,
  } & Record<string, any>,
  permissions?: {
    application: ApplicationPermission,
    page: PagePermission,
    data: DataPermission,
    view: ViewPermission, // 视图权限
    operation: OperationPermission, // 操作权限
    field: FieldPermission, // 字段权限
  },
  connections: Connection[],
  formData?: NocodeFormData,
  otherDataSources?: OtherDataSource[], // 跨应用的数据源信息，这个是在获取body的时候根据跨应用设置的信息来实时生成
  otherDataSourceSchemas?: OtherDataSource[], // 仅用于已保存跨应用引用的 schema 回显，不参与可选列表
  snapshot?: {
    color: string,
    icon :string,
  },
  structure?: NocodeStructure[],
  themeColor?:string,
  theme?: ClientTheme,
  exportVersion?: string,
  exportId?: string,
  identifier?: string,
  importRestriction?: NocodeImportRestriction,
  views?: TOC,
  printTemplate?: Record<TableUID, PrintTemplate[]>,
  isEditTableCell?: boolean,
  sign?: string
}

export type NocodeCoverSummary = {
  type: 'icon' | 'image' | 'default',
  imageUrl?: string,
}

export type TOC = Record<TableUID, ViewSetting[]>

export type FormAutoSubmitTriggerType = "fieldEnter" | "mobileScan";

export type FormAutoSubmitFieldScope = "mainForm";

export type FormAutoSubmitRule = {
  id: string,
  enabled?: boolean,
  fieldUid?: FieldUID,
  fieldScope?: FormAutoSubmitFieldScope,
  fieldEnterSubmit?: boolean,
  mobileScanSubmit?: boolean,
  requireChanged?: boolean,
  requireNonEmpty?: boolean,
  blockWhenUploading?: boolean,
  blockWhenInvalid?: boolean,
}

export type FormViewButtonConfig = {
  visible?: boolean,
  label?: string,
  defaultChecked?: boolean,
}

export type FormViewConfig = {
  buttons?: {
    submit?: FormViewButtonConfig,
    saveDraft?: FormViewButtonConfig,
    stash?: FormViewButtonConfig,
    continuousSubmit?: FormViewButtonConfig,
    saveCurrentContent?: FormViewButtonConfig,
    viewDataAfterSubmit?: FormViewButtonConfig,
  },
  submitBehavior?: {
    successMode?: "successPage" | "resetForm" | "keepCurrentContent",
    successText?: string,
  },
  autoSubmit?: {
    enabled?: boolean,
    rules?: FormAutoSubmitRule[],
  },
}

export interface ViewSetting {
  uid: string,
  name: string,
  type: 'form' | 'table' | 'document' | 'category' | 'album',
  hiddenColumns?: FieldUID[],
  columnOrders?: FormTableColumnOrder,
  viewFilterRules?: FilterRule,
  actions?: ViewAction[],
  formViewConfig?: FormViewConfig,
}

export interface CatalogViewSetting extends ViewSetting {
  catalogFieldUID: FieldUID,
  catalogTitleFieldUID?: FieldUID,
  titleFieldUID?: FieldUID,
  contentFieldUID?: FieldUID,
}

export type TOCTreeNode = {
  id: string,
  title: string,
  type: 'category' | 'document' | null,
  createTime?: number,
  updateTime?: number,
  sort?: number,
  children?: TOCTreeNode[]
}

export type NocodeMeta = {
  id: string;
  name: string;
  description?: string;
  createTime: number;
  deleteTime: number;
  deleted?: boolean;
  parent: string;
  groupId?: string;
  isPublish?: boolean;
  manualChanged?: boolean;
  updateMethod?: PublishUpdateMethod;
  innerUpdateMethod?: PublishUpdateMethod;
  publicUpdateMethod?: PublishUpdateMethod;
  importRestriction?: NocodeImportRestriction;
  sort?: number;
  userId?: string;
  user?: string;
  realname?: string;
}

export type NocodeMenu = NocodeMenuItem[];

export type NocodeMenuItem = {
  name: string,//唯一标识 注意不是ID
  path: string,//页面中显示的地址
  component: string,//前端vue component
  meta: {
    title: string,//页面中显示的标题
    isLink: string,//如果是链接 填入链接
    isHide: boolean,//是否隐藏
    isKeepAlive: boolean,//是否保持状态的
    isAffix: boolean,//是否是固定的
    isIframe: boolean,//是否是iframe
    icon: string,
    templateId?: string,//模板id
    type?: "homepage" | "folder" | "link" | "menu",
    id: string,
  },
  children?:NocodeMenuItem[]
}

export type ImportNocodeOptions = {
  transformData?: boolean,
  filename: string,
  parentId?: string,
  groupId?: string,
  thumbnailUrl?: string,
  isLocal?: boolean,
  isTemplate?: boolean,
  plan?: SaasPlan,
  importDataStages?: ImportNocodeDataStages,
}

export type NocodeImportDataFailureItem = {
  tableId: string,
  tableName: string,
  rowIndex: number,
  rowUUID?: string,
  reason: string,
}

export type NocodeImportDataSummary = {
  totalCount: number,
  successCount: number,
  failedCount: number,
  failures?: NocodeImportDataFailureItem[],
}

export type ImportNocodeResult = {
  meta?: NocodeMeta,
  reason?: string,
  importData?: NocodeImportDataSummary,
}
export type ExportNocodeDataStages = {
  submitted?: boolean,
  recycle?: boolean,
  draft?: boolean,
}

export type ImportNocodeDataStages = {
  submitted?: boolean,
  recycle?: boolean,
  draft?: boolean,
}

export type ExportNocodeOptions = {
  toJson?: boolean,
  exportUser?: boolean,
  exportData?: boolean,
  exportDataType?: "all" | "some",
  rowCount?: number,
  selectedTableUIDs?: TableUID[],
  selectedPageIDs?: string[],
  importRestriction?: NocodeImportRestriction,
  exportDataStages?: ExportNocodeDataStages,
}

export type PrivateItem = {
  enable: string[],
  disabled: string[],
}
export type UserPrivate = {
  menu?: PrivateItem,
  systemMenu?: PrivateItem,
  manageDept?: PrivateItem,
  manageRole?: PrivateItem,
}

export type BaseTodoOptions = {
  nocodeId: string,
  tableId: TableUID,
  uuid: string,
  todoId?: string,
  importTaskId?: string,
  skipNodeIds?: string[],
}
export type FlowTriggerSkipReason =
  | "no-process"
  | "permission-denied"
  | "depth-limit"
  | "visited-target"
  | "target-invalid";
export type FlowTriggerContext = {
  originNocodeId: string,
  originTableId: TableUID,
  originTodoId: string,
  importTaskId?: string,
  triggerDepth: number,
  triggerPath: string[],
  visitedTargets: string[],
}
export type AddTodoOptions = BaseTodoOptions & {
  source: TODOTriggerType,
  entryId: string,
  stashRequested?: boolean,
  operationId?: string,
  triggerRowSnapshot?: Row,
  triggerContext?: FlowTriggerContext,
}

export type SubmitTodoOptions = BaseTodoOptions & {
  flowId: string,
  id: string,
  row: Row,
  comment?: string,
  commentImages?: FlowOpinionFile[],
  commentFiles?: FlowOpinionFile[],
  stashFlow?: boolean,
}
export type StashTodoOptions = SubmitTodoOptions;

export type BackTodoOptions = SubmitTodoOptions & {
  backId: string,
};

export type RejectTodoOptions = Omit<SubmitTodoOptions, "row">;
export type CancelTodoOptions = Omit<SubmitTodoOptions, "row" | "comment">;
export type FinishTodoOptions = CancelTodoOptions;
export type TransferTodoOptions = CancelTodoOptions & {
  transferOwner: string,
}
export type DeleteTodoOptions = BaseTodoOptions & {
  flowId: string,
  id: string,
}
export type GetTransferTodoUsersOptions = DeleteTodoOptions;

export type DeleteTodosOptions = {
  options: DeleteTodoOptions[],
}

export type FormValidateSubmitOptions = {
  nocodeId: string;
  connectionUID?: string;
  tableUID?: TableUID;
  formValidRule?: FormValidRule | null;
} & (
  | { type: 'form'; row: Row; originRow?: Row | null; }
  | { type: 'subform'; rows: Row[]; tableId?: TableUID; fullReplace?: boolean; fullReplaceRelationValue?: string | number; }
);

export type FormValidateDuplicateIssue = {
  fieldId: FieldUID;
  fieldTitle: string;
  rowIndex: number;
  rowUUID?: string;
}

export type FormValidateSubmitResult = {
  valid: boolean;
  error?: string;
  messages?: string[];
  submitMode?: FormSubmitValidMode;
  allowNoticeMode?: FormSubmitAllowNoticeMode;
  duplicateIssues?: FormValidateDuplicateIssue[];
}

export type OrganizeData = {
  departments: Department[],
  roles: Role[],
  users: NocodeUser[],
}

export enum MemberShowField {
  NAME = "name",
  STAFF_NO = "staffNo",
  PHONE = "phone",
  EMAIL = "email",
  DEPARTMENT = "department",
  ROLE = "role",
}

export type MemberShowInfo = MemberShowField[];

export enum FieldAuthValue {
  HIDDEN = 0,
  VISIBLE = 1,
  VISIBLE_EDITABLE = 3,
}

export type ProcessContext = {
  updateHistory: (changeType?: "settings" | "structure") => void,
  allowStructureEdit?: boolean,
  normalizeFlowOptions?: () => void,
  organizeData: OrganizeData,
  tables: Table[],
  formFields: Field[],
  formElementsInfo: FormElementInfo[],
}

export enum TodoCategory {
  /** 我的待办 */
  MY_TODO = "my_todo",
  /** 我发起的 */
  MY_INITIATED = "my_initiated",
  /** 我处理的 */
  MY_PROCESSED = "my_processed",
  /** 抄送我的 */
  CC_ME = "cc_me",
  /** 发起流程 */
  INITIATE_PROCESS = "initiate_process",
};

export enum TodoSubCategory {
  /** 即将超时 */
  ABOUT_TO_EXPIRE = "about_to_expire",
  /** 已超时 */
  EXPIRED = "expired",
}

export enum ExportType {
  /** 导出筛选后的数据 */
  FilteredData = "filteredData",
  /** 导出选中的数据 */
  SelectedData = "selectedData",
  /** 导出全部数据 */
  AllData = "allData"
}

export type GetTodoParams = {
  nocodeId: string,
  tableUID: TableUID,
  uuid: string,
  todoId?: string,
  id?: string,
}

export type GetTodosParams = {
  nocodeId?: string,
  category: TodoCategory,
  page?: number,
  pageSize?: number,
  orderBy?: "ASC" | "DESC",
  filter?: (
    Partial<Record<"operators" | "startTime" | "status", WhereCondition>>
    & {
      isStashed?: boolean,
    }
  ) | string,
  searchValue?: string,
  todoPendingFilter?: "all" | "overtime",
}
export type GetTodosResult = {
  todos: TODO[],
  count: number,
  page: number,
  pageSize: number,
}

export type GetAllProcessParams = {
  nocodeId?: string,
}

export type GetAllCategoryTodoCountParams = {
  [key: string]: unknown,
  nocodeId?: string,
  categories?: TodoCategory[],
  includeTodoPendingCategories?: string | boolean,
}

export type GetFlowRecordsParams = {
  nocodeId: string,
  tableId: TableUID,
  uuid: string,
  todoId: string,
}

export type CheckProcessVersionDeletableParams = {
  nocodeId: string,
  tableId: TableUID,
  version: number,
}

export type CheckProcessVersionDeletableResult = {
  canDelete: boolean,
  hasData: boolean,
  versionStatus: ProcessVersionStatus | null,
}

export type TODO = {
  id: string, 
  type: ProcessNodeType,
  flowName?: string,
  formName?: string,
  flowStartTime?: number,
  flowStartOperator?: string,
  allowCancel?: boolean,
  operationTriggerActionName?: string,
  nocodeId: string,
  tableId: TableUID,
  isStashed?: boolean,
  stashTime?: number,
  stashOperatorId?: string,
  paddingOperators?: string[],
  operators?: string[],
  uuid: string,
  todoId: string,
  processVersion?: number,
  flowId: string,
  requireComments?: boolean,
  flows?: ProcessFlow[],
  currentFlowId?: string,
  startTime: number,
  endTime?: number,
  status: ProcessNodeStatus,
  data?: Record<string, any>,
  reportData?: Record<string, any>,
  reportTargetNocodeId?: string,
  reportTargetTableId?: TableUID,
  reportTargetUUID?: string,
  fields?: Field[],
  canViewCurrentData?: boolean,
  singleOnceTimeTask?: boolean,
  deleted?: boolean,
  processingTime?: {
    deadlineAt?: number | null,
  },
  upstream?: {
    todoId: string,
    termination?: "canceled" | "rejected",
  },
}
export type TodoProcess = {
  id: string,
  type: ProcessNodeType,
  flowId: string,
  status: ProcessNodeStatus,
  flowName: string,
  nocodeId: string,
  tableId: string,
  uuid: string,
  operators?: string[],
  paddingOperators?: string[],
  startTime: number,
  endTime?: number,
  options?: ProcessFlowOptions,
}
export const ProcessNodeStatusMapping = {
  get[ProcessNodeStatus.BACK](){return i18next.t('commonNocode.back')},
  get[ProcessNodeStatus.CANCELED](){return i18next.t('commonNocode.canceled')},
  get[ProcessNodeStatus.CC](){return i18next.t('commonNocode.cc')},
  get[ProcessNodeStatus.FINISHED](){return i18next.t('commonNocode.finished')},
  get[ProcessNodeStatus.IN_PROGRESS](){return i18next.t('commonNocode.inProgress')},
  get[ProcessNodeStatus.NOT_STARTED](){return i18next.t('commonNocode.notStarted')},
  get[ProcessNodeStatus.QUEUED](){return i18next.t('commonNocode.queued')},
  get[ProcessNodeStatus.REJECTED](){return i18next.t('commonNocode.rejected')},
  get[ProcessNodeStatus.SKIPPED](){return i18next.t('commonNocode.skipped')},
  get[ProcessNodeStatus.TRANSFERED](){return i18next.t('commonNocode.transfered')},
}

export type NocodeProjectPublishOptions = {
  updateMethod?: PublishUpdateMethod,
  isNeedLogin?: boolean,
  isPublicShare?: boolean,
  shareExpireTime?: number,
}

export type ProjectNode = {
  id: string,
  name: string,
  type: "project" | "folder" | NocodeStructureType,
  children?: ProjectNode[],
}

export type NocodeProcessItem = {
  id: string,
  name: string,
  connectionId: ConnectionUID,
  tables: Table[],
}

export type KeyValue = {
  key: string,
  value: string | number,
}

export type FormDataColumn = {
  uid: string,
  name: string | SystemField,
  alias?: string,
  type: FieldType,
  isSystem?: boolean,
  subType?: string,
  extra?: FieldExtra,
};

export type FormDataWhere = {
  enabled: boolean,
  value: Record<string, any> | string,
}

export type FormDataTableMeta = {
  name: string,
  uid: string,
  extra?: FormDataTableExtra,
};

export type FormDataTableExtra = {
  dataTitle?: {
    value?: string,
  }
}

export type FormDataTable = {
  uid: string,
  tableName: string,
  columns: FormDataColumn[],
  where?: FormDataWhere,
  extra?: FormDataTableExtra,
}

export interface FormDataOptions {
  tables: FormDataTable[],
  projectId?: string,
}

export type KeySecret = {
  key: string,
  secret: string
}

export enum FormTableRuntime {
  FORM_EDITOR = "form-editor",
  FORM_VIEWER = "form-viewer",
  BOARD_EDITOR = "board-editor",
  BOARD_VIEWER = "board-viewer",
}

export type FormElementInfo = Pick<WidgetSoul, "name" | "uid" | "type"> & {
  path?: string[];
};

export enum FormDatabaseType {
  EMBEDDED = "embedded",
  MONGODB = "mongodb",
  MYSQL = "mysql",
}

export type FormDatabaseConfig = {
  host: string,
  port: number,
  username: string,
  password: string,
  authDatabase?: string,
}

export type DBInfo = Partial<FormDatabaseConfig> & {
  type?: FormDatabaseType,
}

export interface CurrencyInfo {
  label: string; // 货币名
  value: string; // 货币代码
  symbol: string; // 货币符号
  precision: number; // 小数位数精度
}

export type AmountShowLang = "zh-CN" | "en-US" | "ja-JP";
export type AmountShowFormat = "simplified" | "traditional" | "fraction" | "cents" | "points" | "japanese";

export interface DisplayAmountOptions {
  isUppercase: boolean;
  currencyType: string;
  uppercaseLanguage: AmountShowLang;
  uppercaseShowFormat: AmountShowFormat | null;
  decimalPlaces?: number;
  decimalPadding?: boolean;
  thousandSeparator?: string;
  decimalSeparator?: string;
  prefix?: string;
  suffix?: string;
}

export interface NumberFormatOptions {
  decimalPlaces?: number;
  thousandSeparator?: string;
  decimalSeparator?: string;
  decimalPadding?: boolean;
}

export enum FormWidgetType {
  ADDRESS = "widget.form.address", // 地址
  CAPTCHA = "widget.form.captcha", // 二维码
  CHECKBOX_GROUP = "widget.form.checkboxGroup", // 多选
  DATE_PICKER = "widget.form.datePicker", // 日期时间
  DATE_RANGE_PICKER = "widget.form.dateRangePicker", // 时间范围
  DEPARTMENT_SELECT = "widget.form.departmentSelect", // 部门
  FILE_UPLOADER = "widget.form.file-uploader", // 上传附件
  FILTER = "widget.form.filter", // 表单筛选
  FORM = "widget.form.form", // 表单
  HYPERLINK = "widget.form.hyperlink", // 超链接
  IMAGE_TEXT_SHOW = "widget.form.imageTextShow", // 图文展示
  IMAGE_UPLOADER = "widget.form.image-uploader", // 上传图片
  TEXT_INPUT = "widget.form.textInput", // 单行文本
  MEMBER_SELECT = "widget.form.memberSelect", // 成员
  MENU_FILTER = "widget.form.menu-filter", // 筛选菜单
  MULTIPLE_TABS = "widget.form.multipleTabs", // 选项卡
  NUMBER_INPUT = "widget.form.numberInput", // 数字
  PHONE_INPUT = "widget.form.phoneInput", // 手机
  POSITION = "widget.form.position", // 定位
  RADIO_GROUP = "widget.form.radioGroup", // 单选
  RATE = "widget.form.rate", // 评分
  RELATED_DATA = "widget.form.relatedData", // 关联表单
  RICH_TEXT_EDITOR = "widget.form.richTextEditor", // 富文本
  MARKDOWN_EDITOR = "widget.form.markdownEditor", // Markdown
  SEARCH_FORM = "widget.form.searchForm", // 查询表单
  SELECT_DATA = "widget.form.selectData", // 选择数据
  SERIAL_NUMBER = "widget.form.serialNumber", // 表单自动编号
  SPLIT_LINE = "widget.form.splitLine", // 分隔线
  SUBFORM = "widget.form.subform", // 子表单
  SUBMIT_FORM = "widget.form.submitform", // 填报表单
  SWITCH = "widget.form.switch", // 开关
  TABLE = "widget.form.table", // 数据管理表
  TAB_PANEL = "widget.form.tabPanel", // 多标签面板
  TAG_INPUT = "widget.form.tagInput", // 标签文本
  TEXTAREA = "widget.form.textarea", // 多行文本
  TIME_PICKER = "widget.form.timePicker", // 时间
  TITLE_BAR = "widget.form.titleBar", // 标题栏
  TREE_MULTIPLE_SELECT = "widget.form.treeMultipleSelect", // 下拉多选
  TREE_SELECT = "widget.form.treeSelect", // 下拉单选
  UPLOADER = "widget.form.uploader", // 表单上传组件
  VIEW_TABLE = "widget.form.viewtable", // 数据明细表
  AMOUNT_INPUT = "widget.form.amountInput", // 金额
  AUTO_COMPUTE = "widget.form.autoCompute", // 实时计算
  HANDWRITTEN_SIGNATURE = "widget.form.handwrittenSignature", // 手写签名
}

export enum SelectIdOfForm {
  CURRENT = "current",
  LINKAGE = "linkage",
}

export type FormLinkageCondition = FormCondition & {
  id?: string,
  comparisonUid?: string, // 筛选弹窗中关联的表单字段的uid
  comparisonOfForm?: SelectIdOfForm, // 筛选弹窗中关联表单与当前表单值比较还是关联表单值比较
}

// 联动填充的筛选需要选填的属性，筛选弹窗组件则不需要
export type FormLinkageRule = {
  id?: string,
  linkageTable?: OptionTableUID,
  logic: LogicalOperator,
  conditions: FormLinkageCondition[],
  fillWidgets?: {
    fillWidget: string,
    linkageField: string,
    linkageSubFields?: {
      fillWidget?: string,
      linkageField?: string,
    }[],
  }[],
  subTableSetting?: {
    logic: LogicalOperator,
    conditions: FormLinkageCondition[],
  }
}

export type OptionTableUID = [connectionUID: ConnectionUID, tableUID: TableUID];
