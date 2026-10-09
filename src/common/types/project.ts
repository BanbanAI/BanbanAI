import type { FormDataStage } from "@common/types/system-field";
import type { FieldAuthValue, FilterRule, FormCondition, FormConditionValueType, FormWidgetType, LogicalOperator, RuleFunc } from "./nocode";
import { SaasPlan } from "./user";

export type Project = {
  body: ProjectBody,
  limited?: boolean,
  valid?: boolean,
  publishUserValid?: boolean,
  isExpire?: boolean,
};

export type FolderMeta = {
  id: string,
  name: string,
  parent?: string,
  report?: string,
  children?: any[]
}

export type PublishRenderType = "web" | "streaming";

export type ProjectType = "project" | "deploy";

export type ProjectParams = Record<string, string>;

export type ConcurrentSettings = Record<string, number>;

export type ElementDiff = {
  uid: string,
  diff?: any,
  type: 'element' | 'element-add' | 'element-remove',
}

export type ProjectDiff = {
  name: string,
  uid: string,
  updateTime: number,
  diff: ElementDiff[],
}

export enum ProjectPreviewPlatform {
  PC = "pc",
  Mobile = "mobile",
  APP= "app",
}

export type ProjectBody = {
  /** id、name不存在于main.json中  */
  id?: string,
  typography?: "board" | "page",
  boards: BoardSoul[],
  foreboard?: Omit<BoardSoul, "type"> & {
    type: "foreboard",
  },//前景看板
  backboard?: Omit<BoardSoul, "type"> & {
    type: "backboard",
  },//背景看板
  version: number,
  traceId: string,//项目追踪码 (导出导入不变)
  userId?: number,
  
  platform?: ProjectPreviewPlatform,
  sharing?: boolean,
  isPublicShare?: boolean,
  shareExpireTime?: number,
  manualChanged?: boolean,
  isNeedPassword?: boolean,
  encrypted?: boolean,
  password?:string,
}

const All3DWidgets = [
  "widget.3d.city-builder"
];
function is3DWidget(id: string) {
  return All3DWidgets.includes(id);
}
function isWidgetEnabled(enabled: boolean) {
  return enabled !== false;
}
function has3DWidgets(element: BoardSoul | WidgetSoul) {
  if (is3DWidget(element?.type) && isWidgetEnabled(element?.enabled)) {
    return true;
  }
  for (const widget of element?.widgets || []) {
    if (has3DWidgets(widget)) {
      return true;
    }
  }
  return false;
}
/** 是否是三维项目 */
export function is3DProject(projectBody: ProjectBody) {
  if (has3DWidgets(projectBody?.backboard)) {
    return true;
  }
  for (const board of projectBody?.boards || []) {
    if (has3DWidgets(board)) {
      return true;
    }
  }
  if (has3DWidgets(projectBody?.foreboard)) {
    return true;
  }
  return false;
}

/** 项目是否受限（有过期时间） */
export function isLimitedProject(theExpireTime: number) {
  if (theExpireTime) {
    //过期时间超过30年，认为是永久项目
    let restYear = (theExpireTime - Date.now()) / 1000 / 60 / 60 / 24 / 365;
    return restYear < 30;
  }
  return false;
}

export type AiBoardBlueprintBinding = {
  kind: 'board-blueprint',
  blockKey: string,
  blueprintId?: string,
  templateId?: string,
  componentType?: string,
}

export type Soul = {
  type: string,
  uid?: string,
  isNew?: boolean,
  name?: string,
  enabled?: boolean,
  locked?: boolean,
  /**用于区分新旧组件锁定后操作行为上的区分 */
  preventLockEvent?: boolean,
  groupStatus?: { [key: string]: GroupStatus },
  options?: Options,
  isSnap?: boolean,
  privateData?: PrivateData,
  plan?: SaasPlan,
  aiBlueprintBinding?: AiBoardBlueprintBinding,
}
export type BoardSoul = Soul & {
  type: "board",
  widgets?: WidgetSoul[],
}
export type WidgetSoul = Soul & {
  widgets?: WidgetSoul[],
}

export type Placement = "left-start" | "left-end";
export type OptionValue = string | boolean | number | object | (string | boolean | number | object)[]
export type ClusterMapValue = {
  [key: string]: {
    [key: string]: OptionValue,
  }
}
export type ClusterArrayIndex = `idx-${string}`
export type ClusterArrayValue = {
  indexes: string[],
  [key: ClusterArrayIndex]: {
    [key: string]: OptionValue,
  }
}
export type Options = {
  [key: string]: OptionValue | ClusterMapValue | ClusterArrayValue,
}

export type GroupStatus = {
  fold?: "fold" | "unfold" | "always-unfold",
  locked?: boolean | "locked" | "unLocked" | "always-locked",
}

export enum ProcessNodeType {
  START = "start",
  END = "end",
  /** 数据变化 */
  TRIGGER_DATA_CHANGE = "trigger-data-change",
  /** 定时任务 */
  TRIGGER_TIME_TASK = "trigger-time-task",
  /** 手动触发 */
  TRIGGER_MANUAL = "trigger-manual",
  /** 操作触发 */
  TRIGGER_OPERATION = "trigger-operation",
  /** 条件分支 */
  CONDITION_BRANCH = "condition-branch",
  /** 分支设置 */
  BRANCH_SETTING = "branch-setting",
  /** 并行分支 */
  PARALLEL_BRANCH = "parallel-branch",
  /** 办理节点 */
  TRANSACT = "transact",
  /** 审批节点 */
  APPROVAL = "approval",
  /** 抄送节点 */
  NOTIFY = "notify",
  /** 数据填报节点 */
  REPORT_DATA = "report-data",
  /** 汇合节点 */
  JUNCTION = "junction",
  /** 添加数据 */
  ADD_DATA = "add-data",
  /** 修改数据 */
  EDIT_DATA = "edit-data",
  /** 删除数据 */
  DELETE_DATA = "delete-data",
  /** 插件节点 */
}
export enum ProcessNodeStatus {
  /** 未开始 */
  NOT_STARTED = "not-started",
  /** 排队中 */
  QUEUED = "queued",
  /** 进行中 */
  IN_PROGRESS = "in-progress",
  /** 提交 */
  FINISHED = "finished",
  /** 已拒绝 */
  REJECTED = "rejected",
  /** 已转交 */
  TRANSFERED = "transfered",
  /** 回退 */
  BACK = "back",
  /** 已取消 */
  CANCELED = "canceled",
  /** 已跳过 */
  SKIPPED = "skipped",
  /** 抄送 */
  CC = "cc"
}

export type TransfersRecord = {
  from: string,
  to: string,
  time: number,
}

export type FlowOpinionFile = {
  uid: string,
  name: string,
  status?: string,
  size?: number,
  url: string,
}

export type SubmitRecord = {
  userId: string,
  comment?: string,
  commentImages?: FlowOpinionFile[],
  commentFiles?: FlowOpinionFile[],
  satisfy?: boolean,
  time: number,
}

export type TodoDataId = [ConnectionUID, TableUID, string];
export type OrganizeOptionValue = {
  departments?: string[],
  roles?: string[],
  users?: string[],
};

export type ProcessFlowOptions = {
  name?: string,
  crossTableExecutionMode?: CrossTableExecutionMode,
  allowCancel?: boolean,
  /** @deprecated 由相应节点自己控制 */ 
  owner?: OrganizeOptionValue,
  /** 表单权限 */
  fieldAuth?: "all" | Record<string, FieldAuthValue>,
  requiredFieldAuth?: Record<string, boolean>,
} & (DataChangeOptions & TimeTaskOptions & ConditionBranchOptions & ApprovalOptions & NotifyOptions & OperationTriggerNodeOptions & TransactOptions & ReportDataOptions & AddDataOptions & EditDataOptions & DeleteDataOptions);

export enum CrossTableExecutionMode {
  POST_FINISH = "post_finish",
  IMMEDIATE = "immediate",
}

export const getCrossTableExecutionMode = (options?: Pick<ProcessFlowOptions, "crossTableExecutionMode"> | null) => {
  return options?.crossTableExecutionMode === CrossTableExecutionMode.POST_FINISH
    ? CrossTableExecutionMode.POST_FINISH
    : CrossTableExecutionMode.IMMEDIATE;
}

export const getWaitCrossTableFlowCompletion = (
  options?: Pick<ProcessFlowOptions, "waitCrossTableFlowCompletion"> | null,
) => options?.waitCrossTableFlowCompletion === true;

export const getAllowCancel = (options?: Pick<ProcessFlowOptions, "allowCancel"> | null) => {
  return typeof options?.allowCancel === "boolean" ? options.allowCancel : false;
}

export enum DataChangeType {
  ADD = "add",
  EDIT = "edit",
  DELETE = "delete",
}
export enum TODOTriggerType {
  /** 新增 */
  ADD = DataChangeType.ADD,
  /** 修改 */
  EDIT = DataChangeType.EDIT,
  /** 删除 */
  DELETE = DataChangeType.DELETE,
  /** 定时 */
  TIME = "time",
  /** 视图操作 */
  OPERATION = "operation",
}

export const PROCESS_TARGET_SOURCE_UID = "__process_target_source__";
export const FLOW_DATA_OWNER_SOURCE_SUBMITTER = "__flow_submitter__";

export const getProcessTargetSourceUID = (
  targetTableUID?: string | null,
  currentTableUID?: string | null,
) => {
  if (!targetTableUID) return targetTableUID;
  return (currentTableUID && targetTableUID === currentTableUID)
    ? PROCESS_TARGET_SOURCE_UID
    : targetTableUID;
}

export type DataChangeOptions = {
  /** 变化类型 */
  changeType?: DataChangeType[],
  allowStash?: boolean,
  allowFinishFlow?: boolean,
  enableTriggerConditions?: boolean,
  sourceTables?: SourceTable[],
  conditions?: ConditionBranchConditionGroup[],
  waitCrossTableFlowCompletion?: boolean,
}

export enum TimeTaskMethod {
  /** 基础定时 */
  BASIC_TASK = "basic-task",
  /** 高级定时 */
  ADVANCED_TASK = "advanced-task",
}

export enum TimeTaskRepeat {
  /** 只触发一次 */
  ONECE = "onece",
  /** 每天 */
  EVERY_DAY = "every-day",
  /** 每周 */
  EVERY_WEEK = "every-week",
  /** 每两周 */
  EVERY_TWO_WEEKS = "every-two-weeks",
  /** 每月 */
  EVERY_MONTH = "every-month",
  /** 每季度 */
  EVERY_QUARTER = "every-quarter",
  /** 每年 */
  EVERY_YEAR = "every-year",
  /** 法定工作日 */
  EVERY_WORK_DAY = "every-work-day",
  /** 法定节假日 */
  EVERY_HOLIDAY = "every-holiday",
  /** 周一到周五 */
  EVERY_WORK_DAY_OF_WEEK = "every-work-day-of-week",
}

export enum TimeTaskDateType {
  /**字段 */
  FIELD = "field",
  /** 自定义 */
  CUSTOM = "custom",
  /** 无 */
  NONE = "none",
}

export type TimeTaskDate = {
  type: TimeTaskDateType,
  value?: string,
}

export enum TimeTaskDatePoint {
  BEFORE = "before",
  TODAY = "today",
  AFTER = "after",
}
export type TimeTaskTriggerTimePoint = {
  type: TimeTaskDatePoint,
  value: number,
}

export enum TriggerMode {
  /** 多条触发模式 - 默认 */
  MULTI = "multi",
  /** 单条触发模式 */
  SINGLE = "single",
}

export enum OperationTriggerMode {
  EACH_RECORD = "each_record",
  VIEW_CONTEXT_ONCE = "view_context_once",
}

export type TimeTaskOptions = {
  method?: TimeTaskMethod,
  triggerDate?: string,
  triggerTime?: string, 
  enableTriggerConditions?: boolean,
  /** 触发模式 */
  triggerMode?: TriggerMode,
  repeat?: TimeTaskRepeat,
  /** 起始日期 */
  startDate?: TimeTaskDate, 
  /** 结束日期 */
  endDate?: TimeTaskDate, 
  /** 触发时间点 */
  triggerTimePoint?: TimeTaskTriggerTimePoint,
  sourceTables?: SourceTable[],
  conditions?: ConditionBranchConditionGroup[],
}

export const isDataChangeTriggerConditionsEnabled = (
  options?: Pick<DataChangeOptions, "enableTriggerConditions" | "sourceTables" | "conditions"> | null,
) => {
  if (!options) return false;
  if (typeof options.enableTriggerConditions === "boolean") {
    return options.enableTriggerConditions;
  }
  return Boolean(options.sourceTables?.length || options.conditions?.length);
}

export const isTimeTaskTriggerConditionsEnabled = (
  options?: Pick<TimeTaskOptions, "enableTriggerConditions" | "sourceTables" | "conditions" | "triggerMode"> | null,
) => {
  if (!options) return false;
  if (typeof options.enableTriggerConditions === "boolean") {
    return options.enableTriggerConditions;
  }
  return Boolean(
    options.sourceTables?.length ||
    options.conditions?.length ||
    options.triggerMode === TriggerMode.SINGLE
  );
}

export const isTimeTaskSingleTriggerMode = (
  options?: Pick<TimeTaskOptions, "enableTriggerConditions" | "sourceTables" | "conditions" | "triggerMode"> | null,
) => {
  return isTimeTaskTriggerConditionsEnabled(options) && options?.triggerMode === TriggerMode.SINGLE;
}

export enum SubformConditionMatchMode {
  ANY = 'any',
  ALL = 'all',
}

export type ConditionBranchCondition = Partial<FormCondition> & {
  formula?: string,
  errorTip?: string,
  subformMatchMode?: SubformConditionMatchMode,
};
export type ConditionBranchConditionGroup = ConditionBranchCondition[];
export type ConditionBranchOptions = {
  sourceTables?: SourceTable[],
  conditions?: ConditionBranchConditionGroup[],
  /** 优先级 */
  priority?: number,
}


export enum ApprovalCategory {
  /** 自动同意 */
  AUTO_APPROVE = "auto-approve",
  /** 自动拒绝 */
  AUTO_REJECT = "auto-reject",
  /** 人工审批 */
  MANUAL = "manual",
}
export enum ApprovalCategoryRule {
  /** 常规审批 */
  NORMAL = "normal",
  /** 逐级审批 */
  STEP_BY_STEP = "step-by-step",
}

export enum ProcessNodeOwnerType {
  /** 提交人自己 */
  SUBMITTER = "submitter",
  /** 指定成员/角色 */
  ASSIGNEE = "assignee",
  /** 部门主管 */
  DEPARTMENT_MANAGER = "department-manager",
  /** 表单内成员字段 */
  FORM_MEMBER = "form-member",
  /** 表单内部门字段 */
  FORM_DEPARTMENT = "form-department",
  /** 连续多级部门主管 */
  MULTI_LEVEL_DEPARTMENT_MANAGER = "multi-level-department-manager",
}
/** 审批层级模式 */
export type OrganizeLevelMode = "up" | "down";
/** 审批层级选项 */
export type OrganizeLevelOption = { mode: OrganizeLevelMode, value: number, };
export type ProcessNodeOwner = {
  ownerOrder?: ProcessNodeOwnerType[],
  [ProcessNodeOwnerType.SUBMITTER]?: boolean,
  [ProcessNodeOwnerType.ASSIGNEE]?: {
    roles?: string[],
    users?: string[],
  },
  [ProcessNodeOwnerType.DEPARTMENT_MANAGER]?: OrganizeLevelOption,
  [ProcessNodeOwnerType.FORM_MEMBER]?: string[],
  [ProcessNodeOwnerType.FORM_DEPARTMENT]?: {
    value: string,
    level: 0, // 方便扩展
  },
  [ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]?: OrganizeLevelOption,
}
export enum ApproverType {
  /** 会签 */
  AND = "and",
  /** 或签 */
  OR = "or",
  /** 依次审批 */
  SEQUENTIAL = "sequential",
}
export enum OwnerEmptyHandle {
  /** 自动通过 */
  AUTO_APPROVE = "auto-approve",
  /** 指定人员审批 */
  ASSIGNEE = "assignee",
  /** 转交给管理员 */
  ADMIN = "admin",
}
export enum ApproverSameAsSubmitter {
  /** 由提交人对自己审批 */
  SELF = "self",
  /** 转交给部门负责人审批 */
  DEPARTMENT_MANAGER = "department-manager",
  /** 自动跳过 */
  AUTO_SKIP = "auto-skip",
}

export enum ProcessTimeoutUnit {
  MINUTE = "minute",
  HOUR = "hour",
  DAY = "day",
}

export enum ProcessTimeoutDeadlineType {
  FIELD = "field",
  CUSTOM = "custom",
}

export enum ProcessTimeoutRelativePoint {
  BEFORE_DEADLINE = "before-deadline",
  AT_DEADLINE = "at-deadline",
  AFTER_DEADLINE = "after-deadline",
  AFTER_NODE_ARRIVAL = "after-node-arrival",
}

export enum ProcessTimeoutActionType {
  REMIND = "remind",
  SUBMIT = "submit",
  BACK = "back",
}

export type ProcessTimeoutRelativeTime = {
  point: ProcessTimeoutRelativePoint,
  delay: number,
  unit: ProcessTimeoutUnit,
}

export type ProcessTimeoutFieldDeadlineValue = {
  fieldId: FieldUID | null,
  time?: string | null,
}

export type ProcessTimeoutDeadline = {
  type: ProcessTimeoutDeadlineType,
  value?: FieldUID | ProcessTimeoutFieldDeadlineValue | ProcessTimeoutRelativeTime | null,
}

export type ProcessTimeoutRule = {
  uid: string,
  action: ProcessTimeoutActionType,
  trigger: ProcessTimeoutRelativeTime,
  backNodeId?: string | null,
}

export type ProcessTimeoutConfig = {
  enabled?: boolean,
  deadline?: ProcessTimeoutDeadline | null,
  deadlineFieldId?: FieldUID | null,
  rules?: ProcessTimeoutRule[],
}

export type ApprovalOptions = {
  category?: ApprovalCategory;
  categoryRule?: ApprovalCategoryRule;
  /** 审批人 */
  approver?: ProcessNodeOwner; 
  /** 多人审批时的审批方式 */ 
  approverType?: ApproverType;
  /** 审批人为空时 */
  approverEmpty?: OwnerEmptyHandle,
  approverEmptyUsers?: string[],
  approverEmptyAdmin?: string,
  /** 审批人与提交人为同一人时 */
  approverSameAsSubmitter?: ApproverSameAsSubmitter,
  /** 是否允许转交 */
  allowTransfer?: boolean,
  allowStash?: boolean,
  allowFinishFlow?: boolean,
  transferRange?: OrganizeOptionValue,
  /** 允许退回 */
  allowRevert?: boolean,
  /** 允许拒绝 */
  allowReject?: boolean,
  continueAfterReject?: boolean,
  rollbackDataBeforeReject?: boolean,
  rejectSkipNodeIds?: string[],
  revertRange?: string[], /**节点的id */
  /** 是否需要审批意见 */
  requireApprovalComments?: boolean,
  /** 节点限时处理 */
  timeout?: ProcessTimeoutConfig,
}

export enum NotifyNotifierType {
  /** 上级 */
  SUPERIOR = "superior",
  /** 部门负责人 */
  DEPARTMENT_MANAGER = "department-manager",
  /** 角色 */
  ROLE = "role",
  /** 用户组 */
  USER_GROUP = "user-group",
  /** 指定成员 */
  USERS = "users",
  /** 提交人自选 */
  SUBMITTER_OPTION = "submitter-option",
  /** 提交人本人 */
  SUBMITTER = "submitter",
  /** 节点抄送人 */
  RELATED_NODE = "related-node",
  /** 表单内联系他 */
  FORM_MEMBER = "form-member",
  /** 表单内部门 */
  FORM_DEPARTMENT = "form-department"
}

// export type NotifyNotifier = {
//   [NotifyNotifierType.SUPERIOR]?: OrganizeLevelOption,
//   [NotifyNotifierType.DEPARTMENT_MANAGER]?: OrganizeLevelOption,
//   [NotifyNotifierType.ROLE]?: string[],
//   [NotifyNotifierType.USER_GROUP]?: string[],
//   [NotifyNotifierType.USERS]?: string[],
//   [NotifyNotifierType.RELATED_NODE]?: string, // 节点的id
//   [NotifyNotifierType.FORM_MEMBER]?: string[],
//   [NotifyNotifierType.FORM_DEPARTMENT]?: {
//     value: string,
//     level: 0, // 方便扩展
//   },
// }
export type NotifyOptions = {
  /** 抄送人 */
  notifier?: ProcessNodeOwner,
}

export type OperationTriggerNodeOptions = {
  triggerMode?: OperationTriggerMode,
  allowViewContextOnce?: boolean,
}

export const getOperationTriggerMode = (
  options?: Pick<OperationTriggerNodeOptions, "triggerMode" | "allowViewContextOnce"> | null,
) => {
  if (options?.triggerMode === OperationTriggerMode.VIEW_CONTEXT_ONCE) {
    return OperationTriggerMode.VIEW_CONTEXT_ONCE;
  }
  if (options?.triggerMode === OperationTriggerMode.EACH_RECORD) {
    return OperationTriggerMode.EACH_RECORD;
  }
  return options?.allowViewContextOnce
    ? OperationTriggerMode.VIEW_CONTEXT_ONCE
    : OperationTriggerMode.EACH_RECORD;
}

export type TransactOptions = {
  /** 办理人 */
  transactor?: ProcessNodeOwner,
  /** 办理人为空时 */
  transactorEmpty?: Exclude<OwnerEmptyHandle, OwnerEmptyHandle.AUTO_APPROVE>,
  transactorEmptyUsers?: string[],
  transactorEmptyAdmin?: string,
  /** 多人审批时的审批方式 */ 
  transactorType?: ApproverType;
  /** 是否允许转交 */
  allowTransfer?: boolean,
  allowStash?: boolean,
  allowFinishFlow?: boolean,
  transferRange?: OrganizeOptionValue,
  /** 是否允许退回 */
  allowRevert?: boolean,
  /** 退回范围 */
  revertRange?: string[],
  /** 是否开启办理意见弹窗 */
  enableTransactCommentDialog?: boolean,
  /** 是否需要办理意见 */
  requireTransactComments?: boolean,
  /** 是否满足条件时才结束 */
  requireSatisfyCondition?: boolean,
  finishCondition?: {
    sourceTables?: SourceTable[],
    conditions?: ConditionBranchConditionGroup[],
  },
  /** 节点限时处理 */
  timeout?: ProcessTimeoutConfig,
}

export type ReportDataOptions = {
  targetTableUID?: TableUID,
  /** 填报人 */
  reporter?: ProcessNodeOwner,
  /** 填报人为空时 */
  reporterEmpty?: Exclude<OwnerEmptyHandle, OwnerEmptyHandle.AUTO_APPROVE>,
  reporterEmptyUser?: string,
  reporterEmptyAdmin?: string,
  /** 是否允许转交 */
  allowTransfer?: boolean,
  allowStash?: boolean,
  allowFinishFlow?: boolean,
  /** 是否需要办理意见 */
  requireTransactComments?: boolean,
  /** 是否满足条件时才结束 */
  requireSatisfyCondition?: boolean,
  finishCondition?: {
    sourceTables?: SourceTable[],
    conditions?: ConditionBranchConditionGroup[],
  },
  /** 节点限时处理 */
  timeout?: ProcessTimeoutConfig,
}

export type SourceTable = {
  uid: string,
  name: string,
  tableUID: TableUID,
  filterRule: FilterRule,
  alias?: string,
  sourceType?: "table" | "current-subform",
  currentSubTableFieldUID?: FieldUID,
}
export type TableWithSource = Table & {
  name: TableUID,
}
export enum TargetFieldFillType {
  FIELD = "field",
  CUSTOM = "custom",
  EMPTY = "empty",
  DEFAULT = "default",
  FORMULA = "formula",
  AUTO_RELATED = "auto-related",
}
export type TargetFieldFillRule = {
  fieldUID: FieldUID | `${FieldUID}.${FieldUID}`,
  type: TargetFieldFillType;
  value?: any,
}
export type DefaultFormInfoItem = {
  title: string;
  tipContent: string;
  description: string;
}
export type AddDataOptions = {
  targetTableUID?: TableUID,
  /** 是否允许流程节点触发目标表单的联动填充 */
  allowLinkageFill?: boolean,
  /** 是否触发目标表单流程 */
  triggerTargetProcess?: boolean,
  sourceTables?: SourceTable[],
  primarySourceTable?: SourceTable,
  targetFields?: TargetFieldFillRule[],
  batchEnabled?: boolean,
  batchNumber?: Pick<TargetFieldFillRule, "type"> & {
    value: number | string,
  },
  batchFields?: TargetFieldFillRule[],
}

export type CurrentSubTableFilter = {
  /** 当前表单中子表字段 uid */
  fieldUID?: FieldUID,
  /** 当前表单子表对应的数据表 uid */
  tableUID?: TableUID,
  filterRule?: FilterRule,
}

export enum EditDataTargetScope {
  CURRENT = "current",
  HISTORY = "history",
}

export type EditDataOptions = AddDataOptions & {
  targetTableFilterRule?: FilterRule,
  targetTableDataScope?: EditDataTargetScope,
  currentSubTableFilters?: CurrentSubTableFilter[],
  currentSubTableFilter?: CurrentSubTableFilter | null,
}

export type DeleteDataOptions = {
  targetTableUID?: TableUID,
  /** 是否触发目标表单流程 */
  triggerTargetProcess?: boolean,
  targetTableFilterRule?: FilterRule,
  primarySourceTable?: SourceTable,
}

export type ProcessBranch = {
  uid: string,
  type: string,
  flows: ProcessFlow[],
}
export type ProcessFlow<T extends unknown = any> = {
  uid: string,
  nocodeId?: string,
  type: ProcessNodeType,   // 节点的类型
  options?: ProcessFlowOptions,
  branches?: ProcessBranch[],
  meta?: T,
  x?: number,
  y?: number,
}
export enum ProcessVersionStatus {
  DESIGNING = "designing",
  ENABLED = "enabled",
  HISTORY = "history",
}
export type NocodeProcess = {
  enabled: boolean,
  /** @deprecated */
  flows?: ProcessFlow[],
  flowsByVersion: {
    [version: `v${number}`]: ProcessFlow[]
  },
  versionStatusByVersion?: {
    [version: `v${number}`]: ProcessVersionStatus
  },
  version: number,
}
export type DeletedWidgetSoul = WidgetSoul & {
  recycleInfo: {
    operateTime: number;
    operator: string;
    tableUID: TableUID,
    tableMetaUID: string,
    fieldId: FieldUID,
    widgetUID: string,
  };
}
export type FormOption = {
  widget: WidgetSoul; // form
  process?: NocodeProcess;
  deletedWidgets?: DeletedWidgetSoul[];
}
export type FormOptions = Record<TableUID, FormOption>;
export type ConnectionFrom = "report" | "project" | "nocode";
export type Connection = {
  uid: ConnectionUID,
  name: string,
  createTime: number,
  updateTime: number,
  options: Record<string, any>,
  refreshInterval?: number,
  refreshIntervals?: Record<TableUID, number>,
  formOptions?: FormOptions,
  nameFilters?: string[],
  tables?: Table[],
  from?: ConnectionFrom,
}

export type ConnectorMeta = {
  name: string,
  version: string,
  displayName: string,
  browser: string,
  icon?: string,
  editType?: "none" | "edit" | "view",
  virtualPath: string,
  extraMeta?: object,
}

export const PROJECT_PARAMS_UID = 'projectParams';

export type TableSettingsTip = {
  enabled?: boolean,
  text?: string,
}
export type TableSettings = {
  addSuccessTip?: TableSettingsTip,
  addFailedTip?: TableSettingsTip,
  updateSuccessTip?: TableSettingsTip,
  updateFailedTip?: TableSettingsTip,
  removeSuccessTip?: TableSettingsTip,
  removeFailedTip?: TableSettingsTip,
}

export type TablePublicQuery = {
  enabled?: boolean,
  conditionFieldUIDs?: string[],
  displayFieldUIDs?: string[],
  shareExpireTime?: number | null,
  isNeedPassword?: boolean,
  password?: string,
  encrypted?: boolean,
}

export type RowShareAccessScope = "internal" | "public"

export type RowShareAccessPublishConfig = {
  passwordEnabled?: boolean,
  expireEnabled?: boolean,
}

export type RowShareAccessConfig = {
  isNeedPassword?: boolean,
  shareExpireTime?: number | null,
  password?: string,
  passwordHash?: string,
  encrypted?: boolean,
}

export type FormShareConfig = {
  baseConfig?: import("./nocode").FormViewConfig,
}

export type TablePublish = {
  updateMethod?: PublishUpdateMethod,
  sharing?: boolean, // 发布
  isPublicShare?: boolean, // 公开发布
  shareExpireTime?: number,
  manualChanged?: boolean,
  isNeedPassword?: boolean,
  password?:string,
  encrypted?: boolean,
  rowShareEnabled?: boolean,
  rowSharePublicEnabled?: boolean,
  rowShareInternalAccess?: RowShareAccessPublishConfig,
  rowSharePublicAccess?: RowShareAccessPublishConfig,
  rowShareFieldsAuth?: Record<string, FieldAuthValue>,
  publicQuery?: TablePublicQuery,
  innerFormShareConfig?: FormShareConfig,
  publicFormShareConfig?: FormShareConfig,
}

export type RowShareRecord = {
  id: string,
  token?: string,
  internalToken?: string,
  publicToken?: string,
  nocodeId: string,
  tableUID: TableUID,
  rowUUID: string,
  internalAccess?: RowShareAccessConfig,
  publicAccess?: RowShareAccessConfig,
  createdBy: string,
  createdAt: number,
  updatedAt: number,
  disabled?: boolean,
}

export type Table = {
  uid: TableUID,
  alias: string, //修改后的名字
  meta: Record<string, any>, //一些额外的信息,每个数据源都不一样
  fields: Field[],
  isLost?: boolean,
  settings?: TableSettings,
  publish?: TablePublish,
}

export enum PublishScope {
  INNER = "inner",
  PUBLIC = "public",
}
export type FieldType = "string" | "number" | "array" | "object"
export type FieldSubType = "image" | "radio" | "url" | string; //用到了再补充
export type Field = {
  uid: FieldUID,
  alias: string,//别名，修改名字时覆盖
  meta?: FieldMeta,//一些额外的信息,每个数据源都不一样
  type: FieldType,
  revisedType?: FieldType,
  random?: number,

  /** 子表的字段 */
  subTableFields?: Field[],

  /** 关联表单字段 */
  relatedTableFields?: Field[],
}
export type TableColumn = {
  uid: string,
  name: string,
  alias?: string,
  type: FieldType,
  subType?: FieldSubType,
  extra?: FieldExtra,
}
export enum DataMode {
  SINGLE = "single",
  MULTIPLE = "multiple",
}
export type FieldExtra = {
  internalField?: boolean,
  widgetType?: string,
  format?: any,
  subTableUID?: OptionTableUID,
  relatedTableUID?: OptionTableUID,
  relatedDataMode?: DataMode,
  isUnique?: boolean,
  isGlobalUnique?: boolean,
  isRequired?: boolean,
  requiredMode?: "off" | "on" | "condition",
  requiredRule?: FilterRule,
  defaultValueType?: string,
  defaultValue?: string | string[] | number | boolean,
  formula?: string,
  scanInput?: boolean,

  encryption?: any,
  serialNumber?: any,
  amount?: any,

  isPercent?: boolean,
  completeZero?: boolean,
  decimalPlaces?: number,
  decimalRoundingRule?: "round" | "truncate",
  unitPosition?: "suffix" | "prefix",
  unit?: string,
  thousandSeparator?: string,
  decimalSeparator?: string,

  wordLimit?: boolean, // 启用限定字数
  wordRange?: number[], // 字数范围
  validationFormat?: string, // 限定格式
  numberRange?: boolean, // 启用数值范围
  range?: number[], // 数值范围
  submitValid?: FormValidRule, // 子表单提交校验
  limitCount?: boolean, // 启用限制文件数量
  limitCountRange?: number[], // 文件数量范围
  limitSize?: boolean, // 启用限制文件大小
  limitSizeRange?: number, // 文件大小范围
  limitType?: boolean, // 限定文件格式
  limitTypeText?: string, // 文件格式
  onlyCamera?: boolean, // 仅允许拍照上传

  isLinkForm?: boolean, // 是否链接他表
  selectLinkForm?: string, // 链接他表表单
  linkFormFilter?: FilterRule, // 链接他表数据筛选规则
  openFormType?: "dialog" | "blank", // 链接他表 🔗表单打开方式

  dateLocale?: 'en' | 'zh-cn', // 日期语言

  otherTableFieldUID?: OptionFieldUID, // 实时计算的链接他表字段
  dataFilter?: FilterRule, // 实时计算的字段筛选条件
} & Record<string, any>
export type FieldMeta = {
  name: string,
  uid?: string,
  subType?: FieldSubType,
  extra?: FieldExtra,
  isSystem?: boolean,
}
export type FromSetting = {
  subType?: FieldSubType,
  extra?: any,
}

export type AppUID = string;
export type ConnectionUID = `c_${string}`;
export type TableUID = `t_${string}`;
export type FieldUID = `f_${string}`;

export type ConditionRuleMethod = "first" | "last" | "some" | "every" | "custom"

export type ConditionRuleMethodOption = {
  label: string;
  value: ConditionRuleMethod;
};

export type ConditionRule = {
  connection: ConnectionUID,
  table: TableUID, // 选择工作簿
  field: FieldUID | "row" | "reverseRow" | "count", // 选择字段
  method: ConditionRuleMethod,
  order: number,
  func: string, // 条件
  args: string | string[]  // 值
}

export type ConditionGroup = ConditionRule[]

export type DataCondition = {
  uid: string,
  name: string,
  rules: ConditionGroup[],
}

export type Presenter = {
  uid: string,
  name: string,
  sheets: string[],
}

export type Visitor = {
  nickname: string,
  user: string,
  hidePassword: boolean,
  password: string,
  boards: string[],
  lastUpdate: number,
  params?: VisitorParam[],
}

export type VisitorInfo = {
  nickname: string,
  user: string,
  boards: string[],
  params?: VisitorParam[],
}

export type VisitorParam = {
  key: string,
  value: string,
  disabledModify: boolean,
}

export enum OrganizeCategory {
  USER = "user",
  ROLE = "role",
  DEPARTMENT = "department",
}
export { OrganizeCategory as VisitorOrganizeCategory };
export enum ManageCategory {
  USER = "user",
  ORGANIZE = "organize",
  PERMISSION = "permission",
}

export type Permission = {
  enabled?: boolean;
  editable?: boolean;
  deletable?: boolean;
};

export type AiPermissionApp = {
  allForms?: boolean;
  formIds?: string[];
};

export type AiPermissionConfig = {
  apps?: Record<string, AiPermissionApp>;
  updateTime?: number;
};

export type Row = {
  [prop: FieldUID]: any
}

export type Bucket = {
  tableId: string,
  tableName: string,
  fields: Field[]
  rows: Row[],
  count?: number,
}

export type CategoryRule = ConditionGroup[]

export type ConnectionData = Record<string, Bucket[]>

export type CoEditingAccount = {
  id: string,
  username: string,
  nickname: string,
  editModule?: 'board' | 'project' | 'all',
  boardUIDs?: string[],
};

export type CoEditingAccounts = Record<string, CoEditingAccount>;

export type UseThemeOptions = {
  thumbnailUrl?: string,
  templateUrl?: string,
  plan: SaasPlan,
  /** 模板来源 */
  from?: "theme" | "project",
}
export enum ProjectCodeStatus {
  NORMAL = "NORMAL",
  UNUSED = "UNUSED",
  DELETED = "DELETED",
  EXPIRED = "EXPIRED",
  USED = "USED",
  LOGGEDOUT = "LOGGEDOUT"
}

export const PrivateDataConnectionUID: ConnectionUID = "c_private";
export const PrivateDataTableUID: TableUID = "t_private";

export type PrivateData = {
  fields: Field[],
  rows: Row[],
}
export enum PublishUpdateMethod {
  LIVE = "live",
  MANUAL = "manual",
}
export enum PublishCategory {
  PAGE = "page",
  FORM = "form",
}
export type StartPublishOptions = {
  releaseUpdateMethod?: PublishUpdateMethod, // 发布更新方式
  renderType?: PublishRenderType,
  showPlayer?: boolean,
  sharing?: boolean,

  isCloudRenderLimit?: boolean,
  cloudRenderConcurrency?: number,
  cloudRenderRedirectLink?: string,

  isNeedLogin?: boolean,

  /** 访问安全：可直接访问（免费版可用） */
  directAccess?: boolean,
  /** 访问安全：可内嵌入网页（基础版可用） */
  embedWeb?: boolean,
  /** 访问安全：白名单列表（基础版可用） */
  embedIpWhiteList?: string[],
  /** 自定义链接（基础版可用） */
  projectAlias?: string,
  /** 访客模式（专业版可用） */
  visitorMode?: boolean,
  /** 备案号（专业版可用） */
  recordNumber?: string,
  /** APP控制（专业版可用） */
  appControl?: boolean,

  /** @deprecated 4.1.6移除 */
  publishExpireTime?: number,
}

export type CloudRenderChangeOptions = {
  cloudRendering?: boolean,
}
export type PackType = "last" | "d1" | "m3" | "y1" | "permanent" | "custom";
export type PartOfCheckCoinOptions = {
  projectId: string,
  projectCode: string,
  projectCodeHistoryList: string[],
  type?: PackType,
  time: number,
  couponCode?: string,
  isCloudRender?: boolean,
  isAppControl?: boolean,
  isWebLink?: boolean,
  isPackBySaasEnd?: boolean,
  isAdvancedDataSource?: boolean,
}
export type CheckCoinOptions = PartOfCheckCoinOptions & {
  projectName: string,
  traceId: string,
  is3D: boolean,
}

export type Coupon = {
  code: string,   // 优惠券代码，唯一字符
  description: string,    //优惠券描述
  amount: number,     // 优惠券面值
  unit: string,   // 优惠券面值单位
  overlayUsage: boolean,  // 是否可叠加使用
  expireTime: number, //  过期时间
  minPayment?: number,    // 最低消费金额
  usageType: "plan" | "coin" | "general" | "deploy", // 私有云套餐 | 鲸币 | 通用
}

export type WidgetTemplateSoul = {
  uid: string, // 打包前的uid 用于组件交互内uid的替换
  name: string,
  type: string // 模板对应的组件type
  options: Options, // 模板配置项
  privateData: PrivateData, // 模板私有数据
  widgets?: WidgetTemplateSoul[], // 模板子组件
  groupStatus?: { [key: string]: GroupStatus },
};

export type WidgetTemplate = {
  id?: string,
  alias: string, // 模板名称
  tags?: string[], // 模板用于搜索的tag
  image: string, // 模板的样例图
  url?: string, // 模板对应的存储路径 本地/线上
  category: string, // 模板对应的类型
  version?: number, // 模板版本
  isAlpha?: boolean,
  hasCopy?: boolean, // 模板内资源是否已经复制到项目内
  soul?: WidgetTemplateSoul, // 模板包含的数据
  categoryTags?: string[],  // 模板分类中的标签
  typeLabel?: string,
  categoryLabel?: string,
  series?: string,
  notSupport?: boolean,
  meta?: WidgetTemplateMeta;
  snapshotPath?: string,

  type?: string,
};

export type WidgetTemplateMeta = {
  widgets: MetaWidget[]
}
export type MetaWidget = {
  type: string
}

export type WidgetTemplateType = {
  type: string,
  label: string,
  image?: string,
  children: WidgetTemplate[],
}

export type WidgetTemplateCategory = {
  type: string,
  label?: string,
  img?: string,
  series?: string,
  children: WidgetTemplateType[],
}

export type StartCloudMeta = {
  allowZooming: boolean,
  directAccess: boolean,
  embedWeb: boolean,
  showPlayer: boolean,
  visitorMode: boolean,
}

export type WidgetTemplateList = WidgetTemplateCategory[];
export type WidgetTemplateLibraryType = "dark" | "light";
export type WidgetTemplateLibraryList = {
  type: string,
  label: string,
  children: WidgetTemplateList,
}[];

export type ProjectCodeItem = {
  code: string,
  createTime: number,
  destroyed: boolean,
  id: string,
  projectId: string,
  projectName: string,
  projectStatus: ProjectCodeStatus,
  status: ProjectCodeStatus,
  traceId: string,
  valid: boolean,
}
export type PageOptions = {
  pageSize?: number,
  pageNumber?: number,
  start?: number,
  limit?: number,
}
export enum SortType {
  ASC = 1,
  DESC = -1,
}
export type FormDataStageWhereCondition = FormDataStage | {
  $eq?: FormDataStage;
  $ne?: FormDataStage;
  $in?: FormDataStage[];
  $nin?: FormDataStage[];
  $exists?: boolean;
}

export type WhereCondition = {
  [fieldId: string]: string | number | Array<string | number>
  | {
    $eq?: string | number;
    $ne?: string | number;
    $gt?: number;
    $gte?: number;
    $lt?: number;
    $lte?: number;
    $in?: Array<string | number>;
    $nin?: Array<string | number>;
    $all?: Array<string | number>;
    $size?: number;
    $like?: string;
    $exists?: boolean;
  };
} | {
  $and?: WhereCondition[];
  $or?: WhereCondition[];
  $not?: WhereCondition;
};
export type Filter = {
  id?: string,
  uid: [ConnectionUID, TableUID],
  value: WhereCondition,
}

export type QueryOptions = PageOptions & {
  orderBy?: Record<string, SortType> | SortType,
  filters?: Record<string, WhereCondition | WhereCondition[]>,
  stage?: FormDataStageWhereCondition,
  enabledStage?: boolean,
  useEditorSources?: boolean,
  scope?: FormDataStoreScope,
  searchValue?: string,
  transformFormData?: boolean,
  formatData?: boolean,
  fillSubTable?: boolean,
  subTableFilters?: Record<string, WhereCondition[]>,
  transformRelated?: boolean,
  transformRelatedResultObject?: boolean,
}

export type FormDataStoreScope = 'main' | 'draft';
export type DraftStorageStatus = 'legacy' | 'migrating' | 'separated';

export type DraftStorageStateFile = {
  version: 1,
  tables: Record<string, {
    status: DraftStorageStatus,
    updatedAt: string,
    lastError?: string | null,
  }>,
}
export type ApplyStatus = {
  projectId: string,
  requestId?: string,
  status?: "通过" | "未通过" | "申请中",
}

export type OptionFieldUID = [connectionUID: ConnectionUID, tableUID: TableUID, fieldUID: FieldUID];
export type OptionTableUID = [connectionUID: ConnectionUID, tableUID: TableUID];

export enum SettingTab {
  BASIC = 'basic',
  PUBLISH = 'publish',
  APPLICATION = 'application',
  PAGE = 'page',
  VIEW = 'view',
  OPERATION = 'operation',
  FIELD = 'field',
  DATA = 'data',
  API = 'api',
  CROSS_APP = 'cross-app',
  AGGREGATE = 'aggregate',
  PRINTER = 'printer',
  INNER = 'publish-inner',
  PUBLIC = 'publish-public',
}
export type ValidConditionalRule = {
  type: FormConditionValueType;
  uid?: string,
  func?: RuleFunc,
  formula?: any,
  value?: any,
}

export type ConditionalGroup = {
  errorText: string;
  conditions: ValidConditionalRule[],
  submitMode?: FormSubmitValidMode,
  allowNoticeMode?: FormSubmitAllowNoticeMode,
}

export enum FormSubmitValidMode {
  BLOCK = "block",
  ALLOW = "allow",
}

export enum FormSubmitAllowNoticeMode {
  DIALOG = "dialog",
  TOAST = "toast",
}

export type FormValidRule = {
  id: string;
  targetTableUID: TableUID,
  sourceTables?: SourceTable[],
  validConditions?: ConditionalGroup[],
  // Deprecated: keep for backward compatibility with old saved rules.
  submitMode?: FormSubmitValidMode,
  // Deprecated: keep for backward compatibility with old saved rules.
  allowNoticeMode?: FormSubmitAllowNoticeMode,
}
