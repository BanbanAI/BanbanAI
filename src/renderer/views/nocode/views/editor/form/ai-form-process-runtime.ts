import i18next from 'i18next'
import { unique } from '@common/utils/unique'
import { deepClone } from '@common/utils/object'
import { ADMIN_USERNAME } from '@common/types/account'
import {
  type AddDataOptions,
  ApprovalCategory,
  type ApprovalOptions,
  ApproverSameAsSubmitter,
  ApproverType,
  type ConditionBranchCondition,
  type ConditionBranchConditionGroup,
  type ConditionBranchOptions,
  type DataChangeOptions,
  DataChangeType,
  type DeleteDataOptions,
  EditDataTargetScope,
  type EditDataOptions,
  getOperationTriggerMode,
  getProcessTargetSourceUID,
  type NotifyOptions,
  OperationTriggerMode,
  OwnerEmptyHandle,
  type ProcessBranch,
  type ProcessFlow,
  type ProcessFlowOptions,
  type ProcessNodeOwner,
  ProcessNodeOwnerType,
  ProcessNodeStatus,
  ProcessNodeType,
  type ReportDataOptions,
  type SourceTable,
  SubformConditionMatchMode,
  type Table,
  type TargetFieldFillRule,
  TargetFieldFillType,
  type TimeTaskOptions,
  TimeTaskDatePoint,
  TimeTaskDateType,
  TimeTaskMethod,
  TimeTaskRepeat,
  TriggerMode,
  type TransactOptions,
  type Field,
} from '@common/types/project'
import {
  type FilterRule,
  type FormCondition,
  FormConditionValueType,
  LogicalOperator,
  type OrganizeData,
  type ProcessContext,
  RuleFunc,
} from '@common/types/nocode'
import {
  countNocodeEditorFlowPlanBranches,
  countNocodeEditorFlowPlanNodes,
  countNocodeEditorFlowPlanTotalNodes,
  countNocodeEditorFlowPlanTriggerBranches,
  type NocodeEditorFlowPlanNodeType,
  isNocodeEditorFlowPlanBranchNodeType,
  isNocodeEditorFlowPlanTriggerNodeType,
  normalizeNocodeEditorFlowPlan,
  type NocodeEditorFlowPlan,
  type NocodeEditorFlowPlanBranch,
  type NocodeEditorFlowPlanNode,
  type NocodeEditorFlowPlanTriggerBranch,
  type NocodeEditorFlowPlanTriggerNode,
} from '@common/utils/nocodeEditorFlowPlan'
import { buildNocodeEditorFlowFingerprint } from '@common/utils/nocodeEditorFlowPatch'
import type {
  NocodeEditorAiFlowActionIssue,
  NocodeEditorAiFlowIssueState,
} from '../ai/types'
import {
  getFlowFieldConditionPolicy,
  getFlowFieldOwnerPolicy,
  getFlowFieldWritePolicy,
  type FlowFieldConditionPolicy,
  type FlowFieldOwnerPolicy,
  type FlowFieldPolicyContext,
  type FlowFieldWritePolicy,
} from './process/flowFieldPolicy'
import {
  buildFlowMappingSourceConflictMessage,
  getFlowBatchCountFieldReferenceInput,
  getFlowFieldReferenceCandidate,
  getFlowMappingSourceReferenceInput,
  getFlowMappingTargetFieldCandidate,
  getFlowTimeTaskBoundaryFieldCandidate,
  getFlowTimeTaskTriggerDateCandidate,
} from './ai-flow-plan-grounding'
import { normalizeFlowReferenceOptions } from './process/flow-rules'
import { Branch, BranchNode, ProcessNode } from './process/process'

export type FlowRuntimeFieldSummary = {
  fieldId: string
  fieldName: string
  fieldType?: string
  widgetType?: string
  isSystemField?: boolean
  enumSourceType?: string
  enumOptionCount?: number
  enumOptionsPreview?: Array<{
    label: string
    value: string
  }>
  isMemberField?: boolean
  isDepartmentField?: boolean
  writePolicy: FlowFieldWritePolicy
  conditionPolicy: FlowFieldConditionPolicy
  ownerPolicy: FlowFieldOwnerPolicy
  subFields?: FlowRuntimeFieldSummary[]
}

export type FlowRuntimeTableSummary = {
  tableId: string
  tableName: string
  isCurrentForm?: boolean
  fields: FlowRuntimeFieldSummary[]
}

export type FlowRuntimeAvailableNodeSettingSummary = {
  key: string
  label: string
  description: string
}

export type FlowRuntimeAvailableNodeSummary = {
  type: string
  category: string
  label: string
  purpose: string
  keySettings: FlowRuntimeAvailableNodeSettingSummary[]
}

export type BuildAiFlowSummaryInput = {
  currentTable?: Table | null
  tables?: Table[] | null
  formFields?: Field[] | null
  currentFlows?: ProcessFlow[] | null
  organizeData?: OrganizeData | null
  editingVersion?: number
  currentVersionStatus?: string
  resolveTableFields?: (table: Table) => Field[]
  isEditableSystemField?: (table: Table, field: Field) => boolean
  isFieldRendered?: (table: Table, field: Field) => boolean
}

export type ApplyAiFlowPlanInput = {
  plan: unknown
  currentTable?: Table | null
  tables?: Table[] | null
  formFields?: Field[] | null
  organizeData?: OrganizeData | null
  isEditableSystemField?: (table: Table, field: Field) => boolean
  isFieldRendered?: (table: Table, field: Field) => boolean
}

export type ApplyAiFlowPlanResult = {
  plan: NocodeEditorFlowPlan
  flows: ProcessFlow[]
  warnings: string[]
  flowIssues: NocodeEditorAiFlowActionIssue[]
  flowIssueState: NocodeEditorAiFlowIssueState | null
  summary: {
    triggerBranchCount: number
    totalNodeCount: number
    branchCount: number
  }
}

type NocodeEditorFlowPlanDiagnosticLevel =
  | 'error'
  | 'warning'

type NocodeEditorFlowPlanDiagnostic = {
  id: string
  code: string
  level: NocodeEditorFlowPlanDiagnosticLevel
  message: string
  runtimeNodeId?: string
  location?: string
  nodeKey?: string
  nodeName?: string
  nodeType?: NocodeEditorFlowPlanNodeType
  fieldKey?: string
  fieldLabel?: string
  scopeKind?: 'overview' | 'trigger-branch'
  branchKey?: string
  branchLabel?: string
}

type FlowPlanCompileResult = {
  status: 'passed' | 'failed'
  compilable: boolean
  summary?: string
  validatedAt?: number
  diagnostics: NocodeEditorFlowPlanDiagnostic[]
}

type FlowPlanNodeCompileContext = {
  location: string
  nodeKey?: string
  nodeName?: string
  nodeType: NocodeEditorFlowPlanNodeType
  branchKey?: string
  branchLabel?: string
}

type FlowApplyContext = {
  plan: NocodeEditorFlowPlan
  currentTable: Table | null
  tables: Table[]
  formFields: Field[]
  organizeData: OrganizeData
  getFieldPolicyContext: (table?: Table | null) => FlowFieldPolicyContext
  warnings: string[]
  nodeUidByNodeKey: Map<string, string>
  nodeUidByNameToken: Map<string, string>
  flowToPlanNodeKey: Map<ProcessFlow, string>
  flowNodeContextByUid: Map<string, FlowPlanNodeCompileContext>
}

type FlowPlanValidationError = Error & {
  flowPlanCompileResult?: FlowPlanCompileResult
}

type BuildFlowPlanDiagnosticInput = {
  code: string
  message: string
  runtimeNodeId?: string
  location?: string
  nodeKey?: string
  nodeName?: string
  nodeType?: NocodeEditorFlowPlanNodeType
  fieldKey?: string
  fieldLabel?: string
  scopeKind?: 'overview' | 'trigger-branch'
  branchKey?: string
  branchLabel?: string
}

type ResolveSemanticConditionOptions = {
  upstreamNode?: ProcessFlow | null
  comparisonTable?: Table | null
  fieldPolicyContext?: FlowFieldPolicyContext
}

export type AiFlowPatchCompilableNodeType =
  | 'trigger-data-change'
  | 'trigger-time-task'
  | 'trigger-operation'
  | 'approval'
  | 'transact'
  | 'notify'
  | 'report-data'
  | 'add-data'
  | 'edit-data'
  | 'delete-data'

export type CompileAiFlowPatchNodeInput = Omit<ApplyAiFlowPlanInput, 'plan'> & {
  node: {
    type: AiFlowPatchCompilableNodeType
    name?: string
    options?: Record<string, unknown>
  }
  existingFlow?: ProcessFlow
  nodeUidByNodeKey: ReadonlyMap<string, string>
  triggerBranch: {
    branchKey: string
    label?: string
  }
  previousFlow?: ProcessFlow | null
  location?: string
}

const FLOW_PLAN_NODE_TYPE_TO_PROCESS_TYPE: Record<string, ProcessNodeType> = {
  'trigger-data-change': ProcessNodeType.TRIGGER_DATA_CHANGE,
  'trigger-time-task': ProcessNodeType.TRIGGER_TIME_TASK,
  'trigger-operation': ProcessNodeType.TRIGGER_OPERATION,
  approval: ProcessNodeType.APPROVAL,
  transact: ProcessNodeType.TRANSACT,
  notify: ProcessNodeType.NOTIFY,
  'report-data': ProcessNodeType.REPORT_DATA,
  'add-data': ProcessNodeType.ADD_DATA,
  'edit-data': ProcessNodeType.EDIT_DATA,
  'delete-data': ProcessNodeType.DELETE_DATA,
  'condition-branch': ProcessNodeType.CONDITION_BRANCH,
  'parallel-branch': ProcessNodeType.PARALLEL_BRANCH,
}

const FLOW_INTERNAL_NODE_TYPES = new Set<ProcessNodeType>([
  ProcessNodeType.START,
  ProcessNodeType.END,
  ProcessNodeType.BRANCH_SETTING,
  ProcessNodeType.JUNCTION,
])

const SOFT_FLOW_ISSUE_DIAGNOSTIC_CODES = new Set([
  'approval_approver_missing',
  'approval_same_as_submitter_missing',
  'approval_empty_handler_user_missing',
  'approval_empty_handler_admin_missing',
  'approval_revert_range_missing',
  'transact_transactor_missing',
  'transact_empty_handler_missing',
  'transact_empty_handler_user_missing',
  'transact_empty_handler_admin_missing',
  'transact_revert_range_missing',
  'transact_finish_condition_missing',
  'notify_notifier_missing',
  'report_data_target_form_missing',
  'report_data_reporter_missing',
  'report_data_reporter_empty_user_missing',
  'report_data_reporter_empty_admin_missing',
  'report_data_finish_condition_missing',
  'add_data_target_form_missing',
  'add_data_mapping_missing',
  'add_data_batch_count_missing',
  'edit_data_target_form_missing',
  'edit_data_mapping_missing',
  'delete_data_target_form_missing',
  'delete_data_filter_missing',
  'branch_condition_missing',
  'trigger_data_change_event_missing',
  'trigger_time_task_schedule_missing',
  'trigger_time_task_basic_incomplete',
  'trigger_time_task_advanced_incomplete',
])

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

const normalizeIssueIdPart = (value: unknown) => (
  normalizeText(value).replace(/[:\s]+/g, '-') || 'unknown'
)

const cloneValue = <T,>(value: T): T => (
  value == null ? value : JSON.parse(JSON.stringify(value))
)

const isPlainObject = (value: unknown): value is Record<string, any> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

export const asRecord = (value: unknown): Record<string, any> => (
  isPlainObject(value) ? value : {}
)

export const asArray = <T = unknown>(value: unknown): T[] => (
  Array.isArray(value) ? value as T[] : []
)

const toPublicFlowPlanNodeType = (
  value: unknown,
): NocodeEditorFlowPlanNodeType | null => {
  if (value === ProcessNodeType.TRIGGER_MANUAL) {
    return 'trigger-data-change'
  }
  if (
    value === ProcessNodeType.TRIGGER_DATA_CHANGE
    || value === ProcessNodeType.TRIGGER_TIME_TASK
    || value === ProcessNodeType.TRIGGER_OPERATION
    || value === ProcessNodeType.APPROVAL
    || value === ProcessNodeType.TRANSACT
    || value === ProcessNodeType.NOTIFY
    || value === ProcessNodeType.REPORT_DATA
    || value === ProcessNodeType.ADD_DATA
    || value === ProcessNodeType.EDIT_DATA
    || value === ProcessNodeType.DELETE_DATA
    || value === ProcessNodeType.CONDITION_BRANCH
    || value === ProcessNodeType.PARALLEL_BRANCH
  ) {
    return value
  }
  return null
}

const isMemberField = (field?: Field | null) => getFlowFieldOwnerPolicy(field) === 'member'
const isDepartmentField = (field?: Field | null) => getFlowFieldOwnerPolicy(field) === 'department'

const normalizeFlowFieldEnumOptions = (value: unknown) => (
  Array.isArray(value)
    ? value
      .map((item) => {
        if (typeof item === 'string') {
          const normalized = item.trim()
          return normalized
            ? {
              label: normalized,
              value: normalized,
            }
            : null
        }
        if (!item || typeof item !== 'object') {
          return null
        }
        const label = String((item as Record<string, unknown>).label || (item as Record<string, unknown>).value || '').trim()
        const optionValue = String((item as Record<string, unknown>).value || (item as Record<string, unknown>).label || '').trim()
        if (!label || !optionValue) {
          return null
        }
        return {
          label,
          value: optionValue,
        }
      })
      .filter((item): item is { label: string, value: string } => Boolean(item))
    : []
)

const resolveFlowFieldEnumSourceType = (field: Field) => {
  const sourceType = String(
    field?.meta?.extra?.enumSourceType
      || field?.meta?.extra?.['select-choices-type']
      || '',
  ).trim()
  if (sourceType) {
    return sourceType
  }

  const enumOptions = normalizeFlowFieldEnumOptions(field?.meta?.extra?.options || field?.meta?.extra?.enumOptions)
  return enumOptions.length ? 'custom' : ''
}

const buildFieldSummary = (
  field: Field,
  policyContext?: FlowFieldPolicyContext,
  parentPath?: {
    fieldId: string
    fieldName: string
  },
): FlowRuntimeFieldSummary => {
  const enumOptionsPreview = normalizeFlowFieldEnumOptions(
    field?.meta?.extra?.options || field?.meta?.extra?.enumOptions,
  ).slice(0, 8)
  const enumSourceType = resolveFlowFieldEnumSourceType(field)
  const ownerPolicy = getFlowFieldOwnerPolicy(field)
  const currentFieldId = String(field.uid || '').trim()
  const currentFieldName = String(field.alias || field.meta?.name || field.uid || '').trim()
  const fieldId = parentPath?.fieldId
    ? `${parentPath.fieldId}.${currentFieldId}`
    : currentFieldId
  const fieldName = parentPath?.fieldName
    ? `${parentPath.fieldName}.${currentFieldName}`
    : currentFieldName

  return {
    fieldId,
    fieldName,
    fieldType: String(field.type || '').trim() || undefined,
    widgetType: String(field.meta?.extra?.widgetType || '').trim() || undefined,
    isSystemField: field?.meta?.isSystem || undefined,
    enumSourceType: enumSourceType || undefined,
    enumOptionCount: enumSourceType ? enumOptionsPreview.length : undefined,
    enumOptionsPreview: enumSourceType === 'custom' && enumOptionsPreview.length
      ? enumOptionsPreview
      : undefined,
    isMemberField: ownerPolicy === 'member' || undefined,
    isDepartmentField: ownerPolicy === 'department' || undefined,
    writePolicy: getFlowFieldWritePolicy(field, policyContext),
    conditionPolicy: getFlowFieldConditionPolicy(field, policyContext),
    ownerPolicy,
    subFields: Array.isArray(field.subTableFields)
      ? field.subTableFields.map(item => buildFieldSummary(item, policyContext, {
        fieldId,
        fieldName,
      }))
      : undefined,
  }
}

const collectTableFields = (
  fields: Field[],
  policyContext?: FlowFieldPolicyContext,
) => (
  asArray<Field>(fields).map(item => buildFieldSummary(item, policyContext))
)

type FlowFieldPolicyRuntimeOptions = {
  currentTableId: string
  isEditableSystemField?: (table: Table, field: Field) => boolean
  isFieldRendered?: (table: Table, field: Field) => boolean
}

const createFlowFieldPolicyContext = (
  options: FlowFieldPolicyRuntimeOptions,
  table?: Table | null,
): FlowFieldPolicyContext => ({
  isEditableSystemField: (field) => (
    table
      ? Boolean(options.isEditableSystemField?.(table, field))
      : false
  ),
  isRenderedField: (field) => (
    table
      ? options.isFieldRendered?.(table, field) ?? true
      : true
  ),
  isRelatedCurrentTableField: (field) => String(field?.meta?.extra?.relatedTableUID?.[1] || '').trim() === options.currentTableId,
})

const createFlowApplyContext = (
  input: Omit<ApplyAiFlowPlanInput, 'plan'> & {
    plan: NocodeEditorFlowPlan
    nodeUidByNodeKey?: ReadonlyMap<string, string>
  },
): FlowApplyContext => {
  const currentTable = input.currentTable || null
  const flowFieldPolicyOptions: FlowFieldPolicyRuntimeOptions = {
    currentTableId: String(currentTable?.uid || '').trim(),
    isEditableSystemField: input.isEditableSystemField,
    isFieldRendered: input.isFieldRendered,
  }
  return {
    plan: input.plan,
    currentTable,
    tables: asArray<Table>(input.tables),
    formFields: asArray<Field>(input.formFields),
    organizeData: input.organizeData || {
      users: [],
      roles: [],
      departments: [],
    },
    getFieldPolicyContext: table => createFlowFieldPolicyContext(flowFieldPolicyOptions, table),
    warnings: [],
    nodeUidByNodeKey: new Map(input.nodeUidByNodeKey || []),
    nodeUidByNameToken: new Map<string, string>(),
    flowToPlanNodeKey: new Map<ProcessFlow, string>(),
    flowNodeContextByUid: new Map<string, FlowPlanNodeCompileContext>(),
  }
}

const serializeExistingPlanNode = (
  flow: ProcessFlow,
): NocodeEditorFlowPlanNode | null => {
  const publicNodeType = toPublicFlowPlanNodeType(flow.type)
  if (!publicNodeType) {
    return null
  }

  const node: NocodeEditorFlowPlanNode = {
    nodeKey: flow.uid,
    type: publicNodeType,
    name: normalizeText(flow.options?.name) || undefined,
    options: cloneValue(flow.options) || undefined,
  }

  if (flow.type === ProcessNodeType.CONDITION_BRANCH || flow.type === ProcessNodeType.PARALLEL_BRANCH) {
    node.branches = asArray<ProcessBranch>(flow.branches).map((branch) => {
      const branchFlows = asArray<ProcessFlow>(branch.flows)
      const branchSetting = branchFlows.find(item => item.type === ProcessNodeType.BRANCH_SETTING)
      return {
        branchKey: branch.uid,
        label: normalizeText(branchSetting?.options?.name) || undefined,
        conditions: Array.isArray(branchSetting?.options?.conditions)
          ? cloneValue(branchSetting?.options?.conditions)
          : undefined,
        nodes: serializeExistingPlanNodes(branchFlows),
      }
    })
  }

  return node
}

const serializeExistingPlanNodes = (
  flows: ProcessFlow[],
): NocodeEditorFlowPlanNode[] => (
  asArray<ProcessFlow>(flows).flatMap((flow) => {
    if (flow.type === ProcessNodeType.START || flow.type === ProcessNodeType.END || flow.type === ProcessNodeType.JUNCTION) {
      return serializeExistingPlanNodes(
        asArray<ProcessBranch>(flow.branches).flatMap(branch => asArray<ProcessFlow>(branch.flows)),
      )
    }

    if (flow.type === ProcessNodeType.BRANCH_SETTING) {
      return []
    }

    const serialized = serializeExistingPlanNode(flow)
    return serialized ? [serialized] : []
  })
)

const serializeExistingTriggerBranches = (
  flows: ProcessFlow[],
): NocodeEditorFlowPlanTriggerBranch[] => {
  const startFlow = asArray<ProcessFlow>(flows).find(item => item.type === ProcessNodeType.START)
  const startBranches = asArray<ProcessBranch>(startFlow?.branches)
  return startBranches.flatMap((branch, index): NocodeEditorFlowPlanTriggerBranch[] => {
    const serializedNodes = serializeExistingPlanNodes(branch.flows)
    if (!serializedNodes.length) {
      return []
    }

    const [triggerNode, ...nodes] = serializedNodes
    if (!triggerNode || !isNocodeEditorFlowPlanTriggerNodeType(triggerNode.type)) {
      return []
    }

    const triggerBranchLabel = normalizeText(triggerNode.name)
      || `触发分支 ${index + 1}`
    const normalizedTriggerNode: NocodeEditorFlowPlanTriggerNode = {
      ...triggerNode,
      type: triggerNode.type,
    }

    return [{
      branchKey: branch.uid,
      label: triggerBranchLabel,
      triggerNode: normalizedTriggerNode,
      nodes,
    }]
  })
}

const countRenderedFlowNodes = (flows: ProcessFlow[]): number => (
  asArray<ProcessFlow>(flows).reduce((total, flow) => {
    if (FLOW_INTERNAL_NODE_TYPES.has(flow.type)) {
      return total + asArray<ProcessBranch>(flow.branches).reduce((branchTotal, branch) => branchTotal + countRenderedFlowNodes(branch.flows), 0)
    }
    return total + 1 + asArray<ProcessBranch>(flow.branches).reduce((branchTotal, branch) => branchTotal + countRenderedFlowNodes(branch.flows), 0)
  }, 0)
)

const countRenderedBranches = (flows: ProcessFlow[]): number => (
  asArray<ProcessFlow>(flows).reduce((total, flow) => {
    const current = FLOW_INTERNAL_NODE_TYPES.has(flow.type)
      ? 0
      : asArray<ProcessBranch>(flow.branches).length
    return total + current + asArray<ProcessBranch>(flow.branches).reduce((branchTotal, branch) => branchTotal + countRenderedBranches(branch.flows), 0)
  }, 0)
)

const buildAvailableNodeTypes = (): FlowRuntimeAvailableNodeSummary[] => [
  {
    type: 'trigger-data-change',
    category: 'trigger',
    label: '数据变化触发',
    purpose: '在提交、新增、修改、删除等数据变化时启动流程。',
    keySettings: [
      { key: 'changeType', label: '数据变化类型', description: '指定 add / edit / delete 等会触发流程的数据变化类型。' },
      { key: 'sourceTables', label: '来源表单', description: '启用触发条件时，可补充条件中要引用的来源表单。' },
      { key: 'conditions', label: '触发条件', description: '需要限制哪些记录会触发时补充条件表达式。' },
    ],
  },
  {
    type: 'trigger-time-task',
    category: 'trigger',
    label: '定时触发',
    purpose: '按固定时间或日期字段规则定时启动流程。',
    keySettings: [
      { key: 'schedule', label: '定时规则', description: '定义每天、每周、一次性或高级日期字段偏移的触发规则。' },
      { key: 'sourceTables', label: '扫描表单', description: '启用触发条件时，可补充条件中要引用的来源表单。' },
      { key: 'conditions', label: '筛选条件', description: '只处理满足条件的记录时补充条件。' },
    ],
  },
  {
    type: 'trigger-operation',
    category: 'trigger',
    label: '操作触发',
    purpose: '通过按钮、批量操作或视图动作等交互启动流程。',
    keySettings: [
      { key: 'triggerMode', label: '触发模式', description: '区分逐条记录触发还是进入页面上下文后只触发一次。' },
    ],
  },
  {
    type: 'approval',
    category: 'human',
    label: '审批节点',
    purpose: '让指定审批人按规则完成审批，并决定通过、驳回、退回等后续动作。',
    keySettings: [
      { key: 'approver', label: '审批人', description: '定义提交人本人、指定成员/角色、部门主管、表单成员字段等审批对象。' },
      { key: 'approverType', label: '审批方式', description: '定义会签、或签、依次审批等多人审批规则。' },
      { key: 'approverEmpty', label: '审批人为空处理', description: '定义审批人解析为空时自动通过、转管理员或改为指定人员审批。' },
      { key: 'approverSameAsSubmitter', label: '与提交人同人处理', description: '定义审批人与提交人为同一人时如何处理。' },
      { key: 'operationPermissions', label: '操作权限', description: '关注转交、退回、拒绝、审批意见等关键权限配置。' },
    ],
  },
  {
    type: 'transact',
    category: 'human',
    label: '办理节点',
    purpose: '让指定办理人执行处理动作，而不是做审批结论。',
    keySettings: [
      { key: 'transactor', label: '办理人', description: '定义提交人本人、指定成员/角色、表单成员字段等办理对象。' },
      { key: 'operationPermissions', label: '操作权限', description: '关注转交、退回等办理过程中的关键权限配置。' },
    ],
  },
  {
    type: 'notify',
    category: 'human',
    label: '抄送节点',
    purpose: '把流程消息同步给指定成员或角色，不要求其审批或办理。',
    keySettings: [
      { key: 'notifier', label: '抄送对象', description: '定义提交人本人、指定成员/角色、表单成员字段等接收对象。' },
    ],
  },
  {
    type: 'report-data',
    category: 'human',
    label: '数据填报节点',
    purpose: '要求指定填报人去目标表单补录或更新数据，并按完成条件结束该节点。',
    keySettings: [
      { key: 'targetTableUID', label: '目标填报表单', description: '指定要去填报的目标表单 ID。' },
      { key: 'reporter', label: '填报人', description: '定义由谁去完成填报。' },
      { key: 'finishCondition', label: '完成条件', description: '定义什么情况下视为填报完成。' },
    ],
  },
  {
    type: 'add-data',
    category: 'cross-table',
    label: '新增数据节点',
    purpose: '向当前表单或其他表单新增一条或多条记录。',
    keySettings: [
      { key: 'target', label: '目标表单', description: '指定新增记录要写入哪张表。' },
      { key: 'sourceTables', label: '来源表单', description: '跨表取值时指定映射里要引用的来源表单。' },
      { key: 'mapping', label: '字段映射', description: '定义目标字段如何从来源字段或常量填充。' },
      { key: 'batch', label: '批量新增', description: '需要一次新增多条记录时配置数量或批量映射。' },
    ],
  },
  {
    type: 'edit-data',
    category: 'cross-table',
    label: '修改数据节点',
    purpose: '按筛选条件修改当前表单或其他表单中的已有记录。',
    keySettings: [
      { key: 'target', label: '目标表单', description: '指定要修改哪张表。' },
      { key: 'filter', label: '筛选条件', description: '定义哪些记录会被命中并执行修改。' },
      { key: 'mapping', label: '字段映射', description: '定义命中记录后要更新哪些字段以及如何赋值。' },
    ],
  },
  {
    type: 'delete-data',
    category: 'cross-table',
    label: '删除数据节点',
    purpose: '按筛选条件删除当前表单或其他表单中的记录。',
    keySettings: [
      { key: 'target', label: '目标表单', description: '指定要删除哪张表中的记录。' },
      { key: 'filter', label: '筛选条件', description: '定义哪些记录会被命中并执行删除。' },
    ],
  },
  {
    type: 'condition-branch',
    category: 'branch',
    label: '条件分支',
    purpose: '按字段条件或上游节点结果把流程分流到不同路径。',
    keySettings: [
      { key: 'branches', label: '分支列表', description: '为每条条件路径定义名称、条件和后续节点。' },
      { key: 'conditions', label: '分支条件', description: '每个条件分支要明确命中条件；兜底路径不要重复创建。' },
    ],
  },
  {
    type: 'parallel-branch',
    category: 'branch',
    label: '并行分支',
    purpose: '让多条流程路径并行执行，再由运行时自动汇合。',
    keySettings: [
      { key: 'branches', label: '并行泳道', description: '至少定义两个并行分支，并为每个泳道补齐自己的后续节点。' },
    ],
  },
]

const normalizePositiveProcessVersion = (value: unknown) => (
  typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : undefined
)

export const buildAiFlowSummary = (input: BuildAiFlowSummaryInput) => {
  const currentTable = input.currentTable || null
  const tables = asArray<Table>(input.tables)
  const formFields = asArray<Field>(input.formFields)
  const currentFlows = asArray<ProcessFlow>(input.currentFlows)
  const processVersion = normalizePositiveProcessVersion(input.editingVersion)
  const currentTriggerBranches = serializeExistingTriggerBranches(currentFlows)
  const currentTableId = String(currentTable?.uid || '').trim()
  const flowFieldPolicyOptions: FlowFieldPolicyRuntimeOptions = {
    currentTableId,
    isEditableSystemField: input.isEditableSystemField,
    isFieldRendered: input.isFieldRendered,
  }
  const resolveSummaryTableFields = (table?: Table | null) => {
    if (!table) {
      return [] as Field[]
    }
    if (input.resolveTableFields) {
      return asArray<Field>(input.resolveTableFields(table))
    }
    if (table.uid === currentTableId) {
      return formFields
    }
    return asArray<Field>(table.fields)
  }
  const currentTableFields = resolveSummaryTableFields(currentTable)
  const currentFieldPolicyContext = createFlowFieldPolicyContext(flowFieldPolicyOptions, currentTable)
  const currentFormFields = currentTableFields.map(item => buildFieldSummary(item, currentFieldPolicyContext))
  const memberFields = currentTableFields.filter(item => isMemberField(item)).map(item => buildFieldSummary(item, currentFieldPolicyContext))
  const departmentFields = currentTableFields.filter(item => isDepartmentField(item)).map(item => buildFieldSummary(item, currentFieldPolicyContext))

  return {
    organization: {
      users: asArray<OrganizeData['users'][number]>(input.organizeData?.users).map((user) => ({
        id: String(user?.id || '').trim(),
        name: String(user?.realname || user?.user || '').trim(),
        roles: asArray<string>(user?.roles).map(item => String(item || '').trim()).filter(Boolean),
        departments: asArray<string>(user?.departments).map(item => String(item || '').trim()).filter(Boolean),
      })).filter(item => item.id && item.name),
      roles: asArray<OrganizeData['roles'][number]>(input.organizeData?.roles).map((role) => ({
        id: String(role?.id || '').trim(),
        name: String(role?.name || '').trim(),
      })).filter(item => item.id && item.name),
      departments: asArray<OrganizeData['departments'][number]>(input.organizeData?.departments).map((department) => ({
        id: String(department?.id || '').trim(),
        name: String(department?.name || '').trim(),
        parentId: String(department?.parent || '').trim() || undefined,
      })).filter(item => item.id && item.name),
    },
    forms: {
      currentForm: {
        tableId: currentTableId,
        tableName: String(currentTable?.alias || '').trim(),
        currentFlow: {
          version: processVersion,
          processVersion,
          ...(processVersion
            ? { flowFingerprint: buildNocodeEditorFlowFingerprint({ processVersion, flows: currentFlows }) }
            : {}),
          versionStatus: normalizeText(input.currentVersionStatus) || undefined,
          triggerBranchCount: currentTriggerBranches.length,
          totalNodeCount: countRenderedFlowNodes(currentFlows),
          branchCount: countRenderedBranches(currentFlows),
          triggerBranches: currentTriggerBranches,
        },
        fields: currentFormFields,
        memberFields,
        departmentFields,
      },
      availableForms: tables
        .filter(item => !item?.meta?.extra?.primaryTable && item.uid !== currentTableId)
        .map((table) => ({
          tableId: table.uid,
          tableName: table.alias,
          fields: collectTableFields(
            resolveSummaryTableFields(table),
            createFlowFieldPolicyContext(flowFieldPolicyOptions, table),
          ),
        }) satisfies FlowRuntimeTableSummary),
    },
    availableFlowNodes: {
      nodeTypes: buildAvailableNodeTypes(),
    },
  }
}

const matchTableByAny = (tables: Table[], candidate: unknown) => {
  const tableId = normalizeText(isPlainObject(candidate)
    ? candidate.tableUID || candidate.tableId || candidate.uid || candidate.id
    : '')
  const tableName = normalizeText(isPlainObject(candidate)
    ? candidate.tableName || candidate.name || candidate.alias || candidate.label || candidate.value
    : candidate)
  const tableToken = normalizeToken(tableName)
  if (!tableId && !tableToken) {
    return null
  }

  return (tableId ? tables.find(item => String(item.uid || '').trim() === tableId) : null)
    || (tableToken ? tables.find(item => normalizeToken(item.alias) === tableToken) : null)
    || (tableToken ? tables.find(item => normalizeToken(item.meta?.name) === tableToken) : null)
    || null
}

const findFieldDirectly = (fields: Field[], candidate: string) => {
  const normalizedCandidate = normalizeText(candidate)
  const candidateToken = normalizeToken(candidate)
  return fields.find(item => String(item.uid || '').trim() === normalizedCandidate)
    || fields.find(item => normalizeToken(item.alias) === candidateToken)
    || fields.find(item => normalizeToken(item.meta?.name) === candidateToken)
    || null
}

const buildFieldWithPath = (
  field: Field,
  parentField?: Field | null,
): Field => {
  if (!parentField) {
    return field
  }
  return {
    ...field,
    uid: `${parentField.uid}.${field.uid}` as Field['uid'],
    alias: `${parentField.alias}.${field.alias}`,
  }
}

const collectFieldMatchesRecursively = (
  fields: Field[],
  candidate: string,
  parentField?: Field | null,
): Field[] => {
  const normalizedCandidate = normalizeText(candidate)
  const candidateToken = normalizeToken(candidate)
  const shouldMatchLeafOnly = !candidate.includes('.')
  const matches: Field[] = []

  fields.forEach((field) => {
    const resolvedField = buildFieldWithPath(field, parentField)
    const leafUid = String(field.uid || '').trim()
    const leafAliasToken = normalizeToken(field.alias)
    const leafMetaNameToken = normalizeToken(field.meta?.name)
    if (
      String(resolvedField.uid || '').trim() === normalizedCandidate
      || normalizeToken(resolvedField.alias) === candidateToken
      || (
        shouldMatchLeafOnly
        && (
          leafUid === normalizedCandidate
          || leafAliasToken === candidateToken
          || leafMetaNameToken === candidateToken
        )
      )
    ) {
      matches.push(resolvedField)
    }
    matches.push(
      ...collectFieldMatchesRecursively(
        asArray(field.subTableFields),
        candidate,
        resolvedField,
      ),
    )
  })

  return matches
}

const findFieldByUniqueLeafFallback = (
  fields: Field[],
  candidate: string,
) => {
  if (!candidate || candidate.includes('.')) {
    return null
  }
  const matches = collectFieldMatchesRecursively(fields, candidate)
  return matches.length === 1 ? matches[0] : null
}

const findFieldByAny = (
  table: Table | null | undefined,
  candidate: unknown,
): Field | null => {
  if (!table) {
    return null
  }
  const candidateText = normalizeText(isPlainObject(candidate)
    ? candidate.fieldUID || candidate.fieldId || candidate.uid || candidate.id || candidate.fieldName || candidate.name || candidate.alias
    : candidate)
  if (!candidateText) {
    return null
  }

  const [parentRef, subRef] = candidateText.split('.', 2)
  const parentField = findFieldDirectly(asArray(table.fields), parentRef)
  if (!parentField) {
    return findFieldByUniqueLeafFallback(asArray(table.fields), candidateText)
  }
  if (!subRef) {
    return parentField
  }
  const subField = findFieldDirectly(asArray(parentField.subTableFields), subRef)
  if (!subField) {
    return findFieldByUniqueLeafFallback(asArray(parentField.subTableFields), subRef)
  }
  return buildFieldWithPath(subField, parentField)
}

const resolveFieldUid = (
  table: Table | null | undefined,
  candidate: unknown,
) => {
  const candidateText = normalizeText(isPlainObject(candidate)
    ? candidate.fieldUID || candidate.fieldId || candidate.uid || candidate.id || candidate.fieldName || candidate.name || candidate.alias
    : candidate)
  if (!candidateText) {
    return ''
  }
  if (!table) {
    return candidateText
  }
  const field = findFieldByAny(table, candidateText)
  return String(field?.uid || candidateText).trim()
}

type StrictFieldResolutionSlot =
  | 'write'
  | 'condition'
  | 'source'

const FLOW_GROUNDING_RECOVERY_HINT = '请先回到流程方案补齐可用字段，或改成 flow summary 里允许当前用途的字段。'

const resolveStrictFieldCandidateText = (
  candidate: unknown,
) => normalizeText(isPlainObject(candidate)
  ? getFlowFieldReferenceCandidate(candidate)
  : candidate)

const buildStrictFieldResolutionError = (
  slot: StrictFieldResolutionSlot,
  fieldName: string,
  detail?: string,
) => {
  const slotLabel = slot === 'write'
    ? '可回写字段'
    : slot === 'condition'
      ? '条件字段'
      : '字段取值来源'
  const base = detail
    ? `字段“${fieldName}”${detail}`
    : `未找到${slotLabel}“${fieldName}”。`
  return new Error(`${base} ${FLOW_GROUNDING_RECOVERY_HINT}`)
}

const resolveFieldUidStrict = (
  table: Table | null | undefined,
  candidate: unknown,
  slot: StrictFieldResolutionSlot,
  policyContext?: FlowFieldPolicyContext,
) => {
  const candidateText = resolveStrictFieldCandidateText(candidate)
  if (!candidateText) {
    return ''
  }
  if (!table) {
    throw buildStrictFieldResolutionError(slot, candidateText)
  }
  const field = findFieldByAny(table, candidateText)
  if (!field) {
    throw buildStrictFieldResolutionError(slot, candidateText)
  }

  if (slot === 'write') {
    const writePolicy = getFlowFieldWritePolicy(field, policyContext)
    if (writePolicy !== 'writable') {
      throw buildStrictFieldResolutionError(
        slot,
        normalizeText(field.alias || field.meta?.name || field.uid || candidateText) || candidateText,
        `当前不可回写（writePolicy=${writePolicy || 'unknown'}）。`,
      )
    }
  }

  if (slot === 'condition') {
    const conditionPolicy = getFlowFieldConditionPolicy(field, policyContext)
    if (conditionPolicy !== 'usable') {
      throw buildStrictFieldResolutionError(
        slot,
        normalizeText(field.alias || field.meta?.name || field.uid || candidateText) || candidateText,
        `当前不可用于条件（conditionPolicy=${conditionPolicy || 'unknown'}）。`,
      )
    }
  }

  return String(field.uid || '').trim()
}

const normalizeOrganizeValueList = (
  source: unknown,
  candidates: Array<Record<string, any>>,
  key: 'id' | 'name',
) => {
  const list = asArray(source)
  const results: string[] = []
  const appended = new Set<string>()
  for (const item of list) {
    const record = asRecord(item)
    const text = normalizeText(
      record.id
      || record[key]
      || record.name
      || record.realname
      || record.user
      || record.label
      || record.value
      || item,
    )
    const token = normalizeToken(text)
    const matched = candidates.find(candidate => (
      normalizeText(candidate.id) === text
      || normalizeToken(candidate.name) === token
    ))
    const resolved = normalizeText(matched?.id)
    if (!resolved || appended.has(resolved)) {
      continue
    }
    appended.add(resolved)
    results.push(resolved)
  }
  return results
}

const resolveFormMemberFieldIds = (
  fields: Field[],
  source: unknown,
) => {
  const candidates = asArray(source)
  const results: string[] = []
  const appended = new Set<string>()
  for (const item of candidates) {
    const field = fields.find(candidate => isMemberField(candidate) && (
      String(candidate.uid || '').trim() === normalizeText(item)
      || normalizeToken(candidate.alias) === normalizeToken(item)
      || normalizeToken(candidate.meta?.name) === normalizeToken(item)
    ))
    const resolved = String(field?.uid || normalizeText(item)).trim()
    if (!resolved || appended.has(resolved)) {
      continue
    }
    appended.add(resolved)
    results.push(resolved)
  }
  return results
}

const resolveFormDepartmentField = (
  fields: Field[],
  source: unknown,
) => {
  const field = fields.find(candidate => isDepartmentField(candidate) && (
    String(candidate.uid || '').trim() === normalizeText(isPlainObject(source) ? source.value || source.uid || source.id : source)
    || normalizeToken(candidate.alias) === normalizeToken(isPlainObject(source) ? source.value || source.name || source.alias : source)
    || normalizeToken(candidate.meta?.name) === normalizeToken(isPlainObject(source) ? source.value || source.name || source.alias : source)
  ))
  return field
    ? {
      value: String(field.uid || '').trim(),
      level: 0 as const,
    }
    : undefined
}

const resolveDepartmentAssigneeUserIds = (
  source: unknown,
  organizeData: OrganizeData,
) => {
  const departments = asArray<OrganizeData['departments'][number]>(organizeData.departments).map(item => ({
    id: item.id,
    name: item.name,
  }))
  const users = asArray<OrganizeData['users'][number]>(organizeData.users).map(item => ({
    id: item.id,
    name: item.realname || item.user,
    departments: asArray(item.departments),
  }))
  const departmentIds = normalizeOrganizeValueList(source, departments, 'id')
  const results: string[] = []
  const appended = new Set<string>()

  departmentIds.forEach((departmentId) => {
    users
      .filter(item => item.departments.includes(departmentId))
      .forEach((user) => {
        if (!user.id || appended.has(user.id)) {
          return
        }
        appended.add(user.id)
        results.push(user.id)
      })
  })

  return results
}

const resolveProcessNodeOwner = (
  value: unknown,
  fields: Field[],
  organizeData: OrganizeData,
) => {
  if (!isPlainObject(value)) {
    return undefined
  }

  const users = asArray<OrganizeData['users'][number]>(organizeData.users).map(item => ({
    id: item.id,
    name: item.realname || item.user,
  }))
  const roles = asArray<OrganizeData['roles'][number]>(organizeData.roles).map(item => ({
    id: item.id,
    name: item.name,
  }))
  const directType = normalizeToken(value.type || value.ownerType)
  const owner: ProcessNodeOwner = {}
  if (value[ProcessNodeOwnerType.SUBMITTER] === true || directType === 'submitter') {
    owner[ProcessNodeOwnerType.SUBMITTER] = true
  }

  const assigneeRecord = isPlainObject(value[ProcessNodeOwnerType.ASSIGNEE])
    ? asRecord(value[ProcessNodeOwnerType.ASSIGNEE])
    : (
      asArray(value.users).length
      || asArray(value.roles).length
      || asArray(value.roleIds).length
      || asArray(value.roleNames).length
      || asArray(value.departments).length
      ? {
        users: value.users,
        roles: [
          ...asArray(value.roles),
          ...asArray(value.roleIds),
          ...asArray(value.roleNames),
        ],
        departments: value.departments,
      }
      : null
    )
  const directUserCandidate = normalizeText(value.id || value.userId || value.user || value.userName || value.name || value.label)
  const directRoleCandidate = normalizeText(value.roleId || value.roleName || value.name || value.label)
  const directDepartmentCandidate = normalizeText(
    value.departmentId
    || value.departmentName
    || value.department
    || value.deptId
    || value.deptName
    || value.name
    || value.label
  )
  const assigneeUsers = normalizeOrganizeValueList(
    [
      ...asArray(assigneeRecord?.users),
      ...(directType === 'user' || directType === 'member' ? [directUserCandidate] : []),
    ],
    users,
    'id',
  )
  const assigneeRoles = normalizeOrganizeValueList(
    [
      ...asArray(assigneeRecord?.roles),
      ...(directType === 'role' ? [directRoleCandidate] : []),
    ],
    roles,
    'id',
  )
  const assigneeDepartmentUsers = resolveDepartmentAssigneeUserIds(
    [
      ...asArray(assigneeRecord?.departments),
      ...(directType === 'department' || directType === 'dept' ? [directDepartmentCandidate] : []),
    ],
    organizeData,
  )
  const normalizedAssigneeUsers = Array.from(new Set([
    ...assigneeUsers,
    ...assigneeDepartmentUsers,
  ]))
  if (normalizedAssigneeUsers.length || assigneeRoles.length) {
    owner[ProcessNodeOwnerType.ASSIGNEE] = {
      users: normalizedAssigneeUsers,
      roles: assigneeRoles,
    }
  }

  for (const key of [ProcessNodeOwnerType.DEPARTMENT_MANAGER, ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER] as const) {
    if (isPlainObject(value[key])) {
      owner[key] = {
        mode: normalizeText(value[key].mode) === 'up' ? 'up' : 'down',
        value: Math.max(0, Number(value[key].value || 0) || 0),
      }
    }
  }
  if (
    !owner[ProcessNodeOwnerType.DEPARTMENT_MANAGER]
    && directType === 'departmentmanager'
  ) {
    owner[ProcessNodeOwnerType.DEPARTMENT_MANAGER] = {
      mode: normalizeText(value.mode) === 'up' ? 'up' : 'down',
      value: Math.max(0, Number(value.value || value.level || 0) || 0),
    }
  }
  if (
    !owner[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER]
    && (directType === 'multileveldepartmentmanager' || directType === 'multi-level-department-manager')
  ) {
    owner[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER] = {
      mode: normalizeText(value.mode) === 'up' ? 'up' : 'down',
      value: Math.max(0, Number(value.value || value.level || 0) || 0),
    }
  }

  const memberFieldIds = resolveFormMemberFieldIds(fields, value[ProcessNodeOwnerType.FORM_MEMBER])
  if (memberFieldIds.length) {
    owner[ProcessNodeOwnerType.FORM_MEMBER] = memberFieldIds
  }
  if (!owner[ProcessNodeOwnerType.FORM_MEMBER] && (
    directType === 'field'
    || directType === 'formfield'
    || directType === 'currentformfield'
    || directType === 'formmember'
    || directType === 'form-member'
  )) {
    const directFieldCandidate = normalizeText(
      value.fieldId
      || value.fieldUID
      || value.fieldName
      || value.name
      || value.label,
    )
    const directMemberFieldIds = resolveFormMemberFieldIds(fields, [directFieldCandidate])
    if (directMemberFieldIds.length) {
      owner[ProcessNodeOwnerType.FORM_MEMBER] = directMemberFieldIds
    }
  }

  const departmentField = resolveFormDepartmentField(fields, value[ProcessNodeOwnerType.FORM_DEPARTMENT])
  if (departmentField) {
    owner[ProcessNodeOwnerType.FORM_DEPARTMENT] = departmentField
  }
  if (!owner[ProcessNodeOwnerType.FORM_DEPARTMENT] && (
    directType === 'field'
    || directType === 'formfield'
    || directType === 'currentformfield'
    || directType === 'formdepartment'
    || directType === 'form-department'
  )) {
    const directFieldCandidate = normalizeText(
      value.fieldId
      || value.fieldUID
      || value.fieldName
      || value.name
      || value.label,
    )
    const directDepartmentField = resolveFormDepartmentField(fields, directFieldCandidate)
    if (directDepartmentField) {
      owner[ProcessNodeOwnerType.FORM_DEPARTMENT] = directDepartmentField
    }
  }

  return Object.keys(owner).length ? owner : undefined
}

const hasResolvedProcessNodeOwner = (
  value: unknown,
  options: {
    formFields?: Field[]
    organizeData?: OrganizeData
  } = {},
) => {
  if (!isPlainObject(value)) {
    return false
  }
  const formFields = Array.isArray(options.formFields)
    ? options.formFields
    : []
  const organizeUsers = asArray<OrganizeData['users'][number]>(options.organizeData?.users)
  const organizeRoles = asArray<OrganizeData['roles'][number]>(options.organizeData?.roles)
  if (value[ProcessNodeOwnerType.SUBMITTER] === true) {
    return true
  }
  const assignee = asRecord(value[ProcessNodeOwnerType.ASSIGNEE])
  const hasValidAssigneeUser = asArray(assignee.users).some(userId => (
    organizeUsers.some(user => normalizeText(user.id) === normalizeText(userId))
  ))
  const hasValidAssigneeRole = asArray(assignee.roles).some(roleId => (
    organizeRoles.some(role => normalizeText(role.id) === normalizeText(roleId))
  ))
  if (hasValidAssigneeUser || hasValidAssigneeRole) {
    return true
  }
  if (isPlainObject(value[ProcessNodeOwnerType.DEPARTMENT_MANAGER]) || isPlainObject(value[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER])) {
    return true
  }
  if (asArray(value[ProcessNodeOwnerType.FORM_MEMBER]).some(fieldId => (
    formFields.some(field => String(field.uid || '').trim() === normalizeText(fieldId))
  ))) {
    return true
  }
  const formDepartmentFieldId = normalizeText(asRecord(value[ProcessNodeOwnerType.FORM_DEPARTMENT]).value)
  return formFields.some(field => String(field.uid || '').trim() === formDepartmentFieldId)
}

const resolveOrganizeRange = (
  value: unknown,
  organizeData: OrganizeData,
) => {
  if (!isPlainObject(value)) {
    return undefined
  }
  return {
    users: normalizeOrganizeValueList(
      value.users,
      asArray<OrganizeData['users'][number]>(organizeData.users).map(item => ({ id: item.id, name: item.realname || item.user })),
      'id',
    ),
    roles: normalizeOrganizeValueList(
      value.roles,
      asArray<OrganizeData['roles'][number]>(organizeData.roles).map(item => ({ id: item.id, name: item.name })),
      'id',
    ),
    departments: normalizeOrganizeValueList(
      value.departments,
      asArray<OrganizeData['departments'][number]>(organizeData.departments).map(item => ({ id: item.id, name: item.name })),
      'id',
    ),
  }
}

const resolveSourceTables = (
  value: unknown,
  context: FlowApplyContext,
): SourceTable[] => {
  const inputs = asArray(value)
  const sourceTables: SourceTable[] = []

  for (const item of inputs) {
    const table = matchTableByAny(context.tables, item)
    const record = asRecord(item)
    if (!table) {
      throw new Error(`未找到来源表单：${normalizeText(record.tableName || record.name || item)}`)
    }
    const filterRule = record.filterRule
      || record.filter
      || record.sourceFilter
      || (Array.isArray(record.conditions) ? { conditions: record.conditions } : undefined)
    sourceTables.push({
      uid: normalizeText(record.uid) || getProcessTargetSourceUID(table.uid, context.currentTable?.uid || null) || unique(),
      name: normalizeText(record.name) || normalizeText(record.alias) || String(table.alias || '').trim(),
      alias: normalizeText(record.alias) || undefined,
      tableUID: table.uid,
      filterRule: resolveFilterRule(filterRule, table, {
        comparisonTable: context.currentTable,
        fieldPolicyContext: context.getFieldPolicyContext(table),
      }),
    })
  }

  return sourceTables
}

const resolveSemanticSourceTableInputs = (
  rawValue: unknown,
  normalizedSourceTables: unknown,
) => {
  const sourceTables = asArray(normalizedSourceTables)
  if (sourceTables.length) {
    return sourceTables
  }
  const rawRecord = asRecord(rawValue)
  const sourceForm = asRecord(rawRecord.sourceForm || rawRecord.sourceTable)
  const directTableUID = rawRecord.sourceTableUID || rawRecord.sourceTableId
  const directTableName = rawRecord.sourceTableName || rawRecord.sourceFormName
  if (!Object.keys(sourceForm).length && !directTableUID && !directTableName) {
    return normalizedSourceTables
  }
  return [{
    uid: sourceForm.uid,
    tableUID: sourceForm.tableUID || sourceForm.formId || sourceForm.uid || sourceForm.id || directTableUID,
    tableId: sourceForm.tableId || sourceForm.formId || sourceForm.uid || sourceForm.id || directTableUID,
    tableName: sourceForm.tableName || sourceForm.formName || sourceForm.name || sourceForm.alias || directTableName,
    name: sourceForm.name || sourceForm.formName || sourceForm.alias,
    alias: sourceForm.alias,
    filterRule: sourceForm.filterRule,
    filter: sourceForm.filter,
    sourceFilter: sourceForm.sourceFilter,
    conditions: sourceForm.conditions,
  }]
}

const resolveSemanticDataChangeTypes = (
  value: Record<string, any>,
) => {
  return asArray<DataChangeType>(value.changeType)
    .filter(item => (
      item === DataChangeType.ADD
      || item === DataChangeType.EDIT
      || item === DataChangeType.DELETE
    ))
}

const resolveSemanticTriggerMode = (
  value: unknown,
) => {
  const normalized = normalizeToken(value)
  if (['single', 'one', 'once', 'current', 'currentrecord', 'one_record', 'onerecord'].includes(normalized)) {
    return TriggerMode.SINGLE
  }
  if (['multi', 'multiple', 'all', 'batch', 'records', 'allrecords'].includes(normalized)) {
    return TriggerMode.MULTI
  }
  return undefined
}

const resolveSemanticTimeTaskRepeat = (
  value: unknown,
) => {
  const normalized = normalizeToken(value)
  if (!normalized) {
    return undefined
  }
  if (['once', 'onece', 'single', 'onetime', 'oneoff'].includes(normalized)) {
    return TimeTaskRepeat.ONECE
  }
  if (['daily', 'everyday', 'day'].includes(normalized)) {
    return TimeTaskRepeat.EVERY_DAY
  }
  if (['weekly', 'everyweek', 'week'].includes(normalized)) {
    return TimeTaskRepeat.EVERY_WEEK
  }
  if (['biweekly', 'everytwoweeks', 'twoweeks'].includes(normalized)) {
    return TimeTaskRepeat.EVERY_TWO_WEEKS
  }
  if (['monthly', 'everymonth', 'month'].includes(normalized)) {
    return TimeTaskRepeat.EVERY_MONTH
  }
  if (['quarterly', 'everyquarter', 'quarter'].includes(normalized)) {
    return TimeTaskRepeat.EVERY_QUARTER
  }
  if (['yearly', 'everyyear', 'annual', 'annually', 'year'].includes(normalized)) {
    return TimeTaskRepeat.EVERY_YEAR
  }
  if (['workday', 'workdays', 'everyworkday', 'legalworkday'].includes(normalized)) {
    return TimeTaskRepeat.EVERY_WORK_DAY
  }
  if (['weekday', 'weekdays', 'mondaytofriday', 'workdayofweek'].includes(normalized)) {
    return TimeTaskRepeat.EVERY_WORK_DAY_OF_WEEK
  }
  if (['holiday', 'holidays', 'everyholiday'].includes(normalized)) {
    return TimeTaskRepeat.EVERY_HOLIDAY
  }
  return undefined
}

const resolveSemanticTimeTaskMethod = (
  value: unknown,
) => {
  const normalized = normalizeToken(value)
  if (!normalized) {
    return undefined
  }
  if (['advanced', 'advancedtask', 'fielddate', 'datefield', 'relative'].includes(normalized)) {
    return TimeTaskMethod.ADVANCED_TASK
  }
  if (['basic', 'basictask', 'fixed', 'fixedtime', 'schedule'].includes(normalized)) {
    return TimeTaskMethod.BASIC_TASK
  }
  return undefined
}

const resolveSemanticTimeTaskDatePointType = (
  value: unknown,
) => {
  const normalized = normalizeToken(value)
  if (!normalized) {
    return undefined
  }
  if (['before', '提前', '提前触发'].includes(normalized)) {
    return TimeTaskDatePoint.BEFORE
  }
  if (['today', 'same', 'same-day', 'currentday', '当天', '当日'].includes(normalized)) {
    return TimeTaskDatePoint.TODAY
  }
  if (['after', 'delay', 'delayed', 'later', '延后', '之后'].includes(normalized)) {
    return TimeTaskDatePoint.AFTER
  }
  return undefined
}

const resolveSemanticTimeTaskTriggerTimePoint = (
  value: unknown,
) => {
  const record = asRecord(value)
  const type = resolveSemanticTimeTaskDatePointType(
    record.type
    || record.point
    || record.direction
    || record.when
    || value,
  )
  if (!type) {
    return undefined
  }
  const rawValue = record.value ?? record.days ?? record.day ?? record.offset ?? record.count
  const offset = type === TimeTaskDatePoint.TODAY
    ? 0
    : Math.max(1, Number(rawValue || 1) || 1)
  return {
    type,
    value: offset,
  }
}

const resolveSemanticTimeTaskDateBoundary = (
  value: unknown,
  table: Table | null | undefined,
) => {
  if (value === undefined || value === null || normalizeText(value) === '') {
    return undefined
  }
  const record = asRecord(value)
  const typeToken = normalizeToken(record.type || record.mode || record.kind)
  const fieldCandidate = getFlowTimeTaskBoundaryFieldCandidate(record)
  if (typeToken === 'none' || value === false) {
    return {
      type: TimeTaskDateType.NONE,
    }
  }
  if (typeToken === 'field' || normalizeText(fieldCandidate)) {
    return {
      type: TimeTaskDateType.FIELD,
      value: resolveFieldUidStrict(table, fieldCandidate, 'source'),
    }
  }
  const customValue = normalizeText(record.value || record.date || record.datetime || value)
  if (!customValue) {
    return undefined
  }
  return {
    type: TimeTaskDateType.CUSTOM,
    value: customValue,
  }
}

const resolveSemanticTimeTaskOptions = (
  value: Record<string, any>,
  nextValue: TimeTaskOptions,
  context: FlowApplyContext,
) => {
  const schedule = asRecord(value.schedule)
  const method = resolveSemanticTimeTaskMethod(
    nextValue.method
    || schedule.method,
  )
  if (method) {
    nextValue.method = method
  } else if (
    nextValue.repeat
    || nextValue.triggerTime
    || schedule.repeat
    || schedule.triggerTime
    || schedule.time
  ) {
    nextValue.method = TimeTaskMethod.BASIC_TASK
  }

  const repeat = resolveSemanticTimeTaskRepeat(
    nextValue.repeat
    || schedule.repeat
  )
  if (repeat) {
    nextValue.repeat = repeat
  }

  const triggerTime = normalizeText(
    nextValue.triggerTime
    || schedule.triggerTime
    || schedule.time
  )
  if (triggerTime) {
    nextValue.triggerTime = triggerTime
  }

  const triggerDateCandidate = (
    getFlowTimeTaskTriggerDateCandidate(nextValue)
    || getFlowTimeTaskTriggerDateCandidate(schedule)
  )
  const shouldResolveTriggerDateField = nextValue.method === TimeTaskMethod.ADVANCED_TASK
    || Boolean(
      triggerDateCandidate,
    )
  const triggerDate = shouldResolveTriggerDateField
    ? resolveFieldUidStrict(context.currentTable, triggerDateCandidate, 'source')
    : normalizeText(triggerDateCandidate)
  if (triggerDate) {
    nextValue.triggerDate = triggerDate
  }

  const triggerTimePoint = resolveSemanticTimeTaskTriggerTimePoint(
    nextValue.triggerTimePoint
    || schedule.triggerTimePoint
  )
  if (triggerTimePoint) {
    nextValue.triggerTimePoint = triggerTimePoint
  }

  const startDate = resolveSemanticTimeTaskDateBoundary(
    nextValue.startDate
    || schedule.startDate,
    context.currentTable,
  )
  if (startDate) {
    nextValue.startDate = startDate
  }

  const endDate = resolveSemanticTimeTaskDateBoundary(
    nextValue.endDate
    || schedule.endDate,
    context.currentTable,
  )
  if (endDate) {
    nextValue.endDate = endDate
  }

  const triggerMode = resolveSemanticTriggerMode(
    nextValue.triggerMode
    || schedule.triggerMode
  )
  if (triggerMode) {
    nextValue.triggerMode = triggerMode
  }

  return nextValue
}

const SEMANTIC_APPROVAL_RESULT_FIELD_TOKENS = new Set([
  '审批结果',
  '审批状态',
  '节点结果',
  '审核结果',
  'result',
  'status',
].map(item => normalizeToken(item)))

const SEMANTIC_CONDITION_OPERATOR_TO_RULE_FUNC: Record<string, RuleFunc> = {
  equals: RuleFunc.EQUAL,
  equal: RuleFunc.EQUAL,
  eq: RuleFunc.EQUAL,
  '==': RuleFunc.EQUAL,
  '===': RuleFunc.EQUAL,
  notequals: RuleFunc.NOT_EQUAL,
  notequal: RuleFunc.NOT_EQUAL,
  ne: RuleFunc.NOT_EQUAL,
  neq: RuleFunc.NOT_EQUAL,
  '!=': RuleFunc.NOT_EQUAL,
  '!==': RuleFunc.NOT_EQUAL,
  gt: RuleFunc.GT,
  sumgt: RuleFunc.GT,
  '>': RuleFunc.GT,
  gte: RuleFunc.GTE,
  sumgte: RuleFunc.GTE,
  '>=': RuleFunc.GTE,
  lt: RuleFunc.LT,
  sumlt: RuleFunc.LT,
  '<': RuleFunc.LT,
  lte: RuleFunc.LTE,
  sumlte: RuleFunc.LTE,
  '<=': RuleFunc.LTE,
  contains: RuleFunc.CONTAIN,
  contain: RuleFunc.CONTAIN,
  notcontains: RuleFunc.NOT_CONTAIN,
  notcontain: RuleFunc.NOT_CONTAIN,
  empty: RuleFunc.EMPTY,
  isempty: RuleFunc.EMPTY,
  notempty: RuleFunc.NOT_EMPTY,
  isnotempty: RuleFunc.NOT_EMPTY,
  in: RuleFunc.IN,
  notin: RuleFunc.NOT_IN,
}

const resolveSemanticNodeStatusValue = (value: unknown) => {
  const normalized = normalizeToken(value)
  if (!normalized) {
    return value
  }
  if (normalized === 'approved' || normalized === 'approve' || normalized === 'finished' || normalized === 'pass' || normalized === 'passed') {
    return ProcessNodeStatus.FINISHED
  }
  if (normalized === 'rejected' || normalized === 'reject') {
    return ProcessNodeStatus.REJECTED
  }
  return value
}

const resolveSemanticConditionOperator = (value: unknown) => {
  const normalized = normalizeToken(value)
  if (normalized) {
    return normalized
  }
  return normalizeToken(String(value || '').replace(/_/g, ''))
}

const getConditionValueFieldCandidate = (
  value: unknown,
) => {
  const record = asRecord(value)
  return getFlowFieldReferenceCandidate({
    fieldUID: record.valueFieldUID,
    fieldId: record.valueFieldId,
    fieldName: record.valueFieldName,
    alias: record.valueFieldAlias,
  })
}

const resolveAdminFallbackUserId = (
  organizeData: OrganizeData,
) => {
  const users = asArray<OrganizeData['users'][number]>(organizeData.users)
  const admin = users.find(item => (
    Boolean(normalizeText(item.id))
    && (item.isAdmin === true || item.user === ADMIN_USERNAME)
  ))
  return normalizeText(admin?.id) || undefined
}

const resolveSemanticCondition = (
  value: unknown,
  table: Table | null | undefined,
  options: ResolveSemanticConditionOptions = {},
): FormCondition | null => {
  const record = asRecord(value)
  const left = asRecord(record.left)
  const leftType = normalizeToken(left.type || left.kind)
  if (leftType === 'noderesult' || leftType === 'node') {
    const nodeKey = normalizeText(left.nodeKey || left.uid || left.id || left.nodeId)
    if (!nodeKey) {
      return null
    }
    return {
      uid: nodeKey,
      func: SEMANTIC_CONDITION_OPERATOR_TO_RULE_FUNC[resolveSemanticConditionOperator(record.func || record.operator)] || RuleFunc.EQUAL,
      value: resolveSemanticNodeStatusValue(record.value),
      type: FormConditionValueType.NODE,
    }
  }
  const valueFieldCandidate = getConditionValueFieldCandidate(record)
  const fieldUid = resolveFieldUidStrict(
    table,
    getFlowFieldReferenceCandidate(record),
    'condition',
    options.fieldPolicyContext,
  )
  if (!fieldUid) {
    return null
  }

  const nextValue: FormCondition & ConditionBranchCondition = {
    uid: fieldUid,
    func: SEMANTIC_CONDITION_OPERATOR_TO_RULE_FUNC[resolveSemanticConditionOperator(record.func || record.operator)] || RuleFunc.EQUAL,
    value: cloneValue(record.value),
    type: FormConditionValueType.FORM,
  }
  if (
    record.subformMatchMode === SubformConditionMatchMode.ANY
    || record.subformMatchMode === SubformConditionMatchMode.ALL
  ) {
    nextValue.subformMatchMode = record.subformMatchMode
  }
  if (valueFieldCandidate) {
    nextValue.type = FormConditionValueType.FORM
    nextValue.value = resolveFieldUidStrict(
      options.comparisonTable || table,
      valueFieldCandidate,
      'source',
    )
  } else if (record.type === FormConditionValueType.NODE) {
    nextValue.type = FormConditionValueType.NODE
    nextValue.value = resolveSemanticNodeStatusValue(record.value)
  } else if (record.type === FormConditionValueType.FORM) {
    nextValue.value = resolveFieldUidStrict(options.comparisonTable || table, record.value, 'source')
  }
  return nextValue
}

const resolveCondition = (
  value: unknown,
  table: Table | null | undefined,
  options: ResolveSemanticConditionOptions = {},
): FormCondition | null => {
  if (!isPlainObject(value)) {
    return null
  }
  const semanticCondition = resolveSemanticCondition(value, table, options)
  if (semanticCondition) {
    return semanticCondition
  }

  const nextValue = cloneValue(value) as FormCondition
  const conditionFieldCandidate = getFlowFieldReferenceCandidate(nextValue)
  const valueFieldCandidate = getConditionValueFieldCandidate(nextValue)
  if (!normalizeText(nextValue.uid) && !conditionFieldCandidate) {
    return null
  }
  if (!nextValue.func && (nextValue as any).operator) {
    nextValue.func = SEMANTIC_CONDITION_OPERATOR_TO_RULE_FUNC[
      resolveSemanticConditionOperator((nextValue as any).operator)
    ] || RuleFunc.EQUAL
  }
  if (typeof nextValue.uid === 'string' || typeof nextValue.uid === 'number') {
    if (String(nextValue.type || '').trim() !== FormConditionValueType.NODE) {
      nextValue.uid = resolveFieldUidStrict(table, nextValue.uid, 'condition', options.fieldPolicyContext) as FormCondition['uid']
    }
  }
  if (!nextValue.uid && conditionFieldCandidate) {
    nextValue.uid = resolveFieldUidStrict(
      table,
      conditionFieldCandidate,
      'condition',
      options.fieldPolicyContext,
    ) as FormCondition['uid']
  }
  if (valueFieldCandidate) {
    nextValue.type = FormConditionValueType.FORM
    nextValue.value = resolveFieldUidStrict(options.comparisonTable || table, valueFieldCandidate, 'source')
  } else if (nextValue.type === FormConditionValueType.FORM) {
    nextValue.value = resolveFieldUidStrict(options.comparisonTable || table, nextValue.value, 'source')
  }
  if (nextValue.type === FormConditionValueType.NODE) {
    nextValue.value = resolveSemanticNodeStatusValue(nextValue.value)
  }
  return nextValue
}

const normalizeConditionGroupInputs = (value: unknown): unknown[][] => {
  if (!value) {
    return []
  }
  if (isPlainObject(value)) {
    if (Array.isArray(value.conditions)) {
      return normalizeConditionGroupInputs(value.conditions)
    }
    return [[value]]
  }

  const items = asArray(value)
  if (!items.length) {
    return []
  }
  if (items.some(item => Array.isArray(item))) {
    return items.map(group => asArray(group)).filter(group => group.length > 0)
  }
  return [items]
}

const resolveConditionGroups = (
  value: unknown,
  table: Table | null | undefined,
  options: ResolveSemanticConditionOptions = {},
) => (
  normalizeConditionGroupInputs(value)
    .map(group => group
      .map(item => resolveCondition(item, table, options))
      .filter((item): item is FormCondition => Boolean(item)))
    .filter(group => group.length > 0) as ConditionBranchConditionGroup[]
)

const resolveFilterRule = (
  value: unknown,
  table: Table | null | undefined,
  options: ResolveSemanticConditionOptions = {},
): FilterRule => {
  const raw = asRecord(value)
  const conditions = Array.isArray(value)
    ? value
    : (raw.conditions || raw.filters || raw.rules)
  return {
    logic: normalizeText(raw.logic) === LogicalOperator.OR ? LogicalOperator.OR : LogicalOperator.AND,
    conditions: asArray(conditions)
      .map(item => resolveCondition(item, table, options))
      .filter((item): item is FormCondition => Boolean(item)),
  }
}

const resolveTargetFieldRules = (
  value: unknown,
  table: Table | null | undefined,
  policyContext?: FlowFieldPolicyContext,
) => {
  return asArray<TargetFieldFillRule>(value)
    .map((item) => {
      const nextItem = cloneValue(item)
      nextItem.fieldUID = resolveFieldUidStrict(
        table,
        nextItem.fieldUID,
        'write',
        policyContext,
      ) as TargetFieldFillRule['fieldUID']
      return nextItem
    })
}

const resolveTargetTableCandidate = (
  value: unknown,
  fallback: {
    tableUID?: string
    tableId?: string
    tableName?: string
  } = {},
) => {
  const record = asRecord(value)
  const target = asRecord(record.target)
  const targetForm = asRecord(record.targetForm)
  const explicitTableUID = normalizeText(
    record.targetTableUID
    || target.formId
    || target.tableUID
    || targetForm.formId
    || targetForm.tableUID,
  )
  const explicitTableId = normalizeText(
    target.formId
    || target.tableUID
    || targetForm.formId
    || targetForm.tableUID,
  )
  const explicitTableName = normalizeText(
    target.formName
    || target.name
    || targetForm.formName
    || targetForm.name,
  )
  const hasExplicitTarget = Boolean(explicitTableUID || explicitTableId || explicitTableName)
  return {
    tableUID: explicitTableUID || (!hasExplicitTarget ? normalizeText(fallback.tableUID) : ''),
    tableId: explicitTableId || (!hasExplicitTarget ? normalizeText(fallback.tableId) : ''),
    tableName: explicitTableName || (!hasExplicitTarget ? normalizeText(fallback.tableName) : ''),
  }
}

const resolveSemanticFieldMappingValue = (
  source: unknown,
  context: FlowApplyContext,
) => {
  const sourceRecord = asRecord(source)
  const sourceType = normalizeToken(sourceRecord.type || sourceRecord.valueType)
  if (sourceType === 'constant' || sourceType === 'custom') {
    return {
      type: TargetFieldFillType.CUSTOM,
      value: cloneValue(sourceRecord.value),
    }
  }

  const sourceFieldCandidate = getFlowFieldReferenceCandidate(sourceRecord)

  if (
    sourceType === 'currentform'
    || sourceType === 'current'
    || normalizeText(sourceFieldCandidate)
  ) {
    const sourceFieldUid = resolveFieldUidStrict(context.currentTable, sourceFieldCandidate, 'source')
    const currentTableUid = normalizeText(context.currentTable?.uid)
    return {
      type: TargetFieldFillType.FIELD,
      value: currentTableUid && sourceFieldUid ? `${currentTableUid}.${sourceFieldUid}` : sourceFieldUid,
    }
  }

  return {
    type: TargetFieldFillType.EMPTY,
    value: null,
  }
}

const resolveSemanticTargetFieldRules = (
  mappings: unknown,
  targetTable: Table | null | undefined,
  context: FlowApplyContext,
) => {
  return asArray(mappings)
    .map((item): TargetFieldFillRule | null => {
      const record = asRecord(item)
      const targetFieldUID = resolveFieldUidStrict(
        targetTable,
        getFlowMappingTargetFieldCandidate(record),
        'write',
        context.getFieldPolicyContext(targetTable),
      )
      if (!targetFieldUID) {
        return null
      }

      const sourceReference = getFlowMappingSourceReferenceInput(record)
      if (!Object.prototype.hasOwnProperty.call(record, 'value')) {
        const sourceFieldUid = sourceReference.sourceFieldInput
          ? resolveFieldUidStrict(context.currentTable, sourceReference.sourceFieldInput, 'source')
          : ''
        const valueFieldUid = sourceReference.valueFieldInput
          ? resolveFieldUidStrict(context.currentTable, sourceReference.valueFieldInput, 'source')
          : ''
        if (sourceFieldUid && valueFieldUid && sourceFieldUid !== valueFieldUid) {
          throw new Error(`${buildFlowMappingSourceConflictMessage(
            getFlowFieldReferenceCandidate(sourceReference.sourceFieldInput) || sourceFieldUid,
            getFlowFieldReferenceCandidate(sourceReference.valueFieldInput) || valueFieldUid,
          )} ${FLOW_GROUNDING_RECOVERY_HINT}`)
        }
      }
      const sourceInput = Object.prototype.hasOwnProperty.call(record, 'value')
        ? {
          type: 'constant',
          value: record.value,
        }
        : sourceReference.sourceInput
      const sourceValue = resolveSemanticFieldMappingValue(
        sourceInput,
        context,
      )

      return {
        fieldUID: targetFieldUID as TargetFieldFillRule['fieldUID'],
        type: sourceValue.type,
        value: sourceValue.value,
      }
    })
    .filter((item): item is TargetFieldFillRule => Boolean(item))
}

const resolveSemanticBatchNumber = (
  batch: Record<string, any>,
  context: FlowApplyContext,
) => {
  const countFieldReference = getFlowBatchCountFieldReferenceInput(batch)
  if (countFieldReference) {
    const fieldValue = resolveSemanticFieldMappingValue(countFieldReference, context)
    if (fieldValue.type === TargetFieldFillType.FIELD && fieldValue.value) {
      return {
        type: TargetFieldFillType.FIELD,
        value: fieldValue.value,
      }
    }
  }

  const numberValue = batch.number ?? batch.count
  if (typeof numberValue === 'string' && normalizeText(numberValue)) {
    const fieldValue = resolveSemanticFieldMappingValue({
      fieldName: numberValue,
    }, context)
    if (fieldValue.type === TargetFieldFillType.FIELD && fieldValue.value) {
      return {
        type: TargetFieldFillType.FIELD,
        value: fieldValue.value,
      }
    }
  }

  if (numberValue !== undefined && numberValue !== null && normalizeText(numberValue) !== '') {
    return {
      type: TargetFieldFillType.CUSTOM,
      value: typeof numberValue === 'number' ? numberValue : Number(numberValue) || numberValue,
    }
  }

  return null
}

const resolveSemanticAddDataBatchOptions = (
  value: ProcessFlowOptions,
  nextValue: AddDataOptions,
  targetTable: Table | null | undefined,
  context: FlowApplyContext,
) => {
  const batchInput = (value as any).batch
  const batch = asRecord(batchInput)
  const batchMappings = asArray(batch.mappings).length ? batch.mappings : batch.batchMappings
  const batchNumber = resolveSemanticBatchNumber(batch, context)
  const hasSemanticBatch = isPlainObject(batchInput)
    || asArray(batchMappings).length > 0

  if (!hasSemanticBatch) {
    return
  }

  nextValue.batchEnabled = typeof batch.enabled === 'boolean'
    ? batch.enabled
    : true

  if (batchNumber) {
    nextValue.batchNumber = batchNumber
  }

  if (!asArray(nextValue.batchFields).length) {
    const batchFields = resolveSemanticTargetFieldRules(batchMappings, targetTable, context)
    if (batchFields.length) {
      nextValue.batchFields = batchFields
    }
  }
}

const resolveApprovalOptions = (
  value: ProcessFlowOptions,
  context: FlowApplyContext,
) => {
  const nodeName = normalizeText(value.name) || '审批节点'
  const nextValue = value as ApprovalOptions
  if (!nextValue.category) {
    nextValue.category = ApprovalCategory.MANUAL
  }
  if (nextValue.approver) {
    nextValue.approver = resolveProcessNodeOwner(nextValue.approver, context.formFields, context.organizeData)
  }
  const emptyHandler = asRecord((nextValue as Record<string, any>).emptyHandler)
  const emptyHandlerType = normalizeToken(emptyHandler.type || emptyHandler.mode || emptyHandler.action)
  if (!nextValue.approverEmpty && emptyHandlerType) {
    if (['assignee', 'user', 'users', '指定人员'].includes(emptyHandlerType)) {
      nextValue.approverEmpty = OwnerEmptyHandle.ASSIGNEE
    } else if (['admin', 'administrator', '管理员'].includes(emptyHandlerType)) {
      nextValue.approverEmpty = OwnerEmptyHandle.ADMIN
    } else if (['autoapprove', 'approve', 'pass', '自动通过'].includes(emptyHandlerType)) {
      nextValue.approverEmpty = OwnerEmptyHandle.AUTO_APPROVE
    }
  }
  if (!asArray(nextValue.approverEmptyUsers).length && asArray(emptyHandler.users).length) {
    nextValue.approverEmptyUsers = normalizeOrganizeValueList(
      emptyHandler.users,
      asArray<OrganizeData['users'][number]>(context.organizeData.users).map(item => ({ id: item.id, name: item.realname || item.user })),
      'id',
    )
  }
  const sameAsSubmitter = normalizeToken((nextValue as Record<string, any>).sameAsSubmitter)
  if (!nextValue.approverSameAsSubmitter && sameAsSubmitter) {
    if (['autoskip', 'skip', '自动跳过'].includes(sameAsSubmitter)) {
      nextValue.approverSameAsSubmitter = ApproverSameAsSubmitter.AUTO_SKIP
    } else if (['departmentmanager', 'deptmanager', 'manager', '部门负责人'].includes(sameAsSubmitter)) {
      nextValue.approverSameAsSubmitter = ApproverSameAsSubmitter.DEPARTMENT_MANAGER
    } else if (['self', 'submitter', '本人'].includes(sameAsSubmitter)) {
      nextValue.approverSameAsSubmitter = ApproverSameAsSubmitter.SELF
    }
  }
  const reject = asRecord((nextValue as Record<string, any>).reject)
  if (Object.keys(reject).length) {
    if (typeof reject.enabled === 'boolean') {
      nextValue.allowReject = reject.enabled
    }
    if (typeof reject.continue === 'boolean') {
      nextValue.continueAfterReject = reject.continue
    }
    if (!asArray(nextValue.rejectSkipNodeIds).length && asArray(reject.skipNodeKeys).length) {
      nextValue.rejectSkipNodeIds = asArray<string>(reject.skipNodeKeys)
        .map(item => normalizeText(item))
        .filter(Boolean)
    }
  }
  const revert = asRecord((nextValue as Record<string, any>).revert)
  if (Object.keys(revert).length) {
    if (typeof revert.enabled === 'boolean') {
      nextValue.allowRevert = revert.enabled
    }
    if (!asArray(nextValue.revertRange).length && asArray(revert.rangeNodeKeys).length) {
      nextValue.revertRange = asArray<string>(revert.rangeNodeKeys)
        .map(item => normalizeText(item))
        .filter(Boolean)
    }
  }
  const comments = asRecord((nextValue as Record<string, any>).comments)
  if (typeof comments.required === 'boolean') {
    nextValue.requireApprovalComments = comments.required
  }
  const approvalMode = normalizeToken((nextValue as Record<string, any>).approvalMode || (nextValue as Record<string, any>).mode)
  if (!nextValue.approverType && approvalMode) {
    if (['sequential', 'sequence', 'ordered', 'inorder'].includes(approvalMode)) {
      nextValue.approverType = ApproverType.SEQUENTIAL
    } else if (['anyone', 'any', 'or', 'one'].includes(approvalMode)) {
      nextValue.approverType = ApproverType.OR
    } else if (['all', 'and', 'countersign'].includes(approvalMode)) {
      nextValue.approverType = ApproverType.AND
    }
  }
  nextValue.approverType = nextValue.approverType || ApproverType.AND
  if (!nextValue.categoryRule) {
    nextValue.categoryRule = 'normal' as ApprovalOptions['categoryRule']
  }
  if (nextValue.approverEmpty === OwnerEmptyHandle.ADMIN && !nextValue.approverEmptyAdmin) {
    const adminUserId = resolveAdminFallbackUserId(context.organizeData)
      if (adminUserId) {
        nextValue.approverEmptyAdmin = adminUserId
      } else {
        nextValue.approverEmpty = OwnerEmptyHandle.AUTO_APPROVE
        context.warnings.push(`${nodeName}未找到可兜底的管理员，已回退为自动通过`)
      }
  }
  nextValue.approver = resolveProcessNodeOwner(nextValue.approver, context.formFields, context.organizeData)
  nextValue.transferRange = resolveOrganizeRange(nextValue.transferRange, context.organizeData)
  nextValue.approverEmptyUsers = normalizeOrganizeValueList(
    nextValue.approverEmptyUsers,
    asArray<OrganizeData['users'][number]>(context.organizeData.users).map(item => ({ id: item.id, name: item.realname || item.user })),
    'id',
  )
  nextValue.approverEmptyAdmin = normalizeText(nextValue.approverEmptyAdmin) || undefined
  return nextValue
}

const resolveTransactOptions = (
  value: ProcessFlowOptions,
  context: FlowApplyContext,
) => {
  const nextValue = value as TransactOptions
  if (nextValue.transactorEmpty === OwnerEmptyHandle.ADMIN && !nextValue.transactorEmptyAdmin) {
    const users = asArray<OrganizeData['users'][number]>(context.organizeData.users)
    const adminUserId = normalizeText(
      users.find(item => normalizeToken(item.user) === 'admin')?.id,
    ) || resolveAdminFallbackUserId(context.organizeData)
    if (adminUserId) {
      nextValue.transactorEmptyAdmin = adminUserId
    }
  }
  nextValue.transactor = resolveProcessNodeOwner(nextValue.transactor, context.formFields, context.organizeData)
  nextValue.transferRange = resolveOrganizeRange(nextValue.transferRange, context.organizeData)
  nextValue.transactorEmptyUsers = normalizeOrganizeValueList(
    nextValue.transactorEmptyUsers,
    asArray<OrganizeData['users'][number]>(context.organizeData.users).map(item => ({ id: item.id, name: item.realname || item.user })),
    'id',
  )
  nextValue.transactorEmptyAdmin = normalizeText(nextValue.transactorEmptyAdmin) || undefined
  if (isPlainObject(nextValue.finishCondition)) {
    nextValue.finishCondition = {
      sourceTables: resolveSourceTables(
        resolveSemanticSourceTableInputs(nextValue.finishCondition, nextValue.finishCondition.sourceTables),
        context,
      ),
      conditions: resolveConditionGroups(nextValue.finishCondition.conditions, context.currentTable, {
        fieldPolicyContext: context.getFieldPolicyContext(context.currentTable),
      }),
    }
  }
  return nextValue
}

const resolveNotifyOptions = (
  value: ProcessFlowOptions,
  context: FlowApplyContext,
) => {
  const nextValue = value as NotifyOptions
  if (!nextValue.notifier && asArray((nextValue as Record<string, any>).recipients).length) {
    nextValue.notifier = {
      roles: asArray((nextValue as Record<string, any>).recipients),
    } as ProcessNodeOwner
  }
  nextValue.notifier = resolveProcessNodeOwner(nextValue.notifier, context.formFields, context.organizeData)
  return nextValue
}

const resolveReportDataOptions = (
  value: ProcessFlowOptions,
  context: FlowApplyContext,
) => {
  const nextValue = value as ReportDataOptions
  const targetCandidate = resolveTargetTableCandidate(value, {
    tableUID: nextValue.targetTableUID,
  })
  if (targetCandidate.tableUID || targetCandidate.tableId || targetCandidate.tableName) {
    const table = matchTableByAny(context.tables, targetCandidate)
    if (!table) {
      throw new Error(`未找到填报目标表单：${normalizeText(targetCandidate.tableName || targetCandidate.tableId || targetCandidate.tableUID)}`)
    }
    nextValue.targetTableUID = table.uid
  }
  nextValue.reporter = resolveProcessNodeOwner(nextValue.reporter, context.formFields, context.organizeData)
  nextValue.reporterEmptyUser = normalizeText(nextValue.reporterEmptyUser) || undefined
  nextValue.reporterEmptyAdmin = normalizeText(nextValue.reporterEmptyAdmin) || undefined
  if (isPlainObject(nextValue.finishCondition)) {
    nextValue.finishCondition = {
      sourceTables: resolveSourceTables(
        resolveSemanticSourceTableInputs(nextValue.finishCondition, nextValue.finishCondition.sourceTables),
        context,
      ),
      conditions: resolveConditionGroups(nextValue.finishCondition.conditions, context.currentTable, {
        fieldPolicyContext: context.getFieldPolicyContext(context.currentTable),
      }),
    }
  }
  return nextValue
}

const resolveTriggerOptions = (
  value: ProcessFlowOptions,
  context: FlowApplyContext,
  processNodeType: ProcessNodeType,
) => {
  const nextValue = value as DataChangeOptions & TimeTaskOptions
  if (processNodeType === ProcessNodeType.TRIGGER_DATA_CHANGE) {
    const changeTypes = resolveSemanticDataChangeTypes(value as Record<string, any>)
    if (changeTypes.length) {
      nextValue.changeType = changeTypes
    }
    const semanticSourceTableInputs = resolveSemanticSourceTableInputs(value, nextValue.sourceTables)
    nextValue.sourceTables = resolveSourceTables(
      asArray(semanticSourceTableInputs).length
        ? semanticSourceTableInputs
        : context.currentTable
          ? [{
              tableUID: context.currentTable.uid,
              tableId: context.currentTable.uid,
              tableName: context.currentTable.alias,
            }]
          : semanticSourceTableInputs,
      context,
    )
  } else if (processNodeType === ProcessNodeType.TRIGGER_TIME_TASK) {
    resolveSemanticTimeTaskOptions(value as Record<string, any>, nextValue as TimeTaskOptions, context)
    nextValue.sourceTables = resolveSourceTables(
      resolveSemanticSourceTableInputs(value, nextValue.sourceTables),
      context,
    )
  } else if ('sourceTables' in nextValue) {
    nextValue.sourceTables = resolveSourceTables(
      resolveSemanticSourceTableInputs(value, nextValue.sourceTables),
      context,
    )
  }
  if ('conditions' in nextValue) {
    nextValue.conditions = resolveConditionGroups(nextValue.conditions, context.currentTable, {
      fieldPolicyContext: context.getFieldPolicyContext(context.currentTable),
    })
  }
  return nextValue as ProcessFlowOptions
}

const resolveSemanticOperationTriggerMode = (
  value: unknown,
) => {
  const normalized = normalizeToken(value)
  if (['viewonce', 'viewcontextonce', 'current', 'currentrecord', 'once'].includes(normalized)) {
    return OperationTriggerMode.VIEW_CONTEXT_ONCE
  }
  if (['eachrecord', 'each', 'record', 'records', 'everyrecord'].includes(normalized)) {
    return OperationTriggerMode.EACH_RECORD
  }
  return undefined
}

const resolveOperationTriggerOptions = (value: ProcessFlowOptions) => {
  const nextValue = value as any
  const semanticMode = resolveSemanticOperationTriggerMode(
    nextValue.operationMode
    || nextValue.mode
    || nextValue.triggerMode,
  )
  if (semanticMode) {
    nextValue.triggerMode = semanticMode
  }
  nextValue.triggerMode = getOperationTriggerMode(nextValue)
  nextValue.allowViewContextOnce = nextValue.triggerMode === OperationTriggerMode.VIEW_CONTEXT_ONCE
  return nextValue
}

const resolveSemanticEditDataTargetScope = (value: unknown) => {
  const normalized = normalizeToken(value)
  if (['history', 'historical', 'matched', 'allmatched'].includes(normalized)) {
    return EditDataTargetScope.HISTORY
  }
  if (['current', 'currentrecord', 'currentdata'].includes(normalized)) {
    return EditDataTargetScope.CURRENT
  }
  return undefined
}

const resolveDataWriteOptions = (
  value: ProcessFlowOptions,
  context: FlowApplyContext,
  mode: 'add' | 'edit' | 'delete',
) => {
  const nextValue = value as AddDataOptions & EditDataOptions & DeleteDataOptions
  const fallbackTargetTable = (
    mode === 'edit' && context.currentTable
      ? {
        tableUID: context.currentTable.uid,
        tableId: context.currentTable.uid,
        tableName: context.currentTable.alias,
      }
      : {}
  )
  const targetTable = matchTableByAny(context.tables, {
    ...resolveTargetTableCandidate(value, fallbackTargetTable as any),
    tableUID: nextValue.targetTableUID || resolveTargetTableCandidate(value, fallbackTargetTable as any).tableUID,
  })
  if (!targetTable) {
    return nextValue
  }
  nextValue.targetTableUID = targetTable.uid

  if (mode !== 'delete') {
    if (!asArray(nextValue.targetFields).length) {
      const semanticMappings = (value as any).mapping || (value as any).mappings
      const targetFields = resolveSemanticTargetFieldRules(semanticMappings, targetTable, context)
      if (targetFields.length) {
        nextValue.targetFields = targetFields
      }
    }
    nextValue.sourceTables = resolveSourceTables(
      resolveSemanticSourceTableInputs(value, nextValue.sourceTables),
      context,
    )
    if (nextValue.primarySourceTable) {
      const primaryTable = matchTableByAny(context.tables, nextValue.primarySourceTable)
      if (!primaryTable) {
        throw new Error(`未找到主来源表单：${normalizeText(nextValue.primarySourceTable?.name || nextValue.primarySourceTable?.tableUID)}`)
      }
      nextValue.primarySourceTable = {
        uid: normalizeText(nextValue.primarySourceTable.uid) || getProcessTargetSourceUID(primaryTable.uid, context.currentTable?.uid || null) || unique(),
        name: normalizeText(nextValue.primarySourceTable.name) || primaryTable.alias,
        alias: normalizeText(nextValue.primarySourceTable.alias) || undefined,
        tableUID: primaryTable.uid,
        filterRule: resolveFilterRule(nextValue.primarySourceTable.filterRule, primaryTable, {
          comparisonTable: context.currentTable,
          fieldPolicyContext: context.getFieldPolicyContext(primaryTable),
        }),
      }
    }
    if (mode === 'add') {
      resolveSemanticAddDataBatchOptions(value, nextValue, targetTable, context)
    } else if (mode === 'edit') {
      const semanticTargetScope = resolveSemanticEditDataTargetScope(
        (value as any).targetScope || nextValue.targetTableDataScope,
      )
      if (semanticTargetScope) {
        nextValue.targetTableDataScope = semanticTargetScope
      }
    }
    const targetFieldPolicyContext = context.getFieldPolicyContext(targetTable)
    nextValue.targetFields = resolveTargetFieldRules(nextValue.targetFields, targetTable, targetFieldPolicyContext)
    nextValue.batchFields = resolveTargetFieldRules(nextValue.batchFields, targetTable, targetFieldPolicyContext)
  } else if (nextValue.primarySourceTable) {
    const primaryTable = matchTableByAny(context.tables, nextValue.primarySourceTable)
    if (!primaryTable) {
      throw new Error(`未找到删除条件来源表单：${normalizeText(nextValue.primarySourceTable?.name || nextValue.primarySourceTable?.tableUID)}`)
    }
    nextValue.primarySourceTable = {
      uid: normalizeText(nextValue.primarySourceTable.uid) || getProcessTargetSourceUID(primaryTable.uid, context.currentTable?.uid || null) || unique(),
      name: normalizeText(nextValue.primarySourceTable.name) || primaryTable.alias,
      alias: normalizeText(nextValue.primarySourceTable.alias) || undefined,
      tableUID: primaryTable.uid,
      filterRule: resolveFilterRule(nextValue.primarySourceTable.filterRule, primaryTable, {
        comparisonTable: context.currentTable,
        fieldPolicyContext: context.getFieldPolicyContext(primaryTable),
      }),
    }
  }

  const semanticTargetFilter = (value as any).filter
  if (semanticTargetFilter || 'targetTableFilterRule' in nextValue) {
    nextValue.targetTableFilterRule = resolveFilterRule(semanticTargetFilter, targetTable, {
      comparisonTable: context.currentTable,
      fieldPolicyContext: context.getFieldPolicyContext(targetTable),
    })
  }
  return nextValue
}

const hasCompiledTargetFieldRules = (
  value: unknown,
  allowEmpty = false,
) => asArray<TargetFieldFillRule>(value).some((item) => {
  if (!normalizeText(item?.fieldUID)) {
    return false
  }
  if (
    item?.type === TargetFieldFillType.EMPTY
    || item?.type === TargetFieldFillType.DEFAULT
  ) {
    return allowEmpty
  }
  if (item?.value === 0 || item?.value === false) {
    return true
  }
  if (Array.isArray(item?.value)) {
    return item.value.length > 0
  }
  return item?.value !== undefined
    && item?.value !== null
    && normalizeText(item.value) !== ''
})

const hasFilterRuleConditions = (value: unknown) => (
  asArray<FormCondition>(asRecord(value).conditions).length > 0
)

const hasConfiguredNodeIdList = (value: unknown) => (
  Array.isArray(value)
  && value.some(item => normalizeText(item))
)

const hasResolvedFinishCondition = (value: unknown) => (
  asArray(asRecord(value).conditions).some(group => asArray(group).length > 0)
)

const hasTimeTaskBasicSchedule = (options: TimeTaskOptions) => (
  Boolean(options.repeat && normalizeText(options.triggerTime))
)

const hasTimeTaskAdvancedSchedule = (options: TimeTaskOptions) => (
  Boolean(
    normalizeText(options.triggerDate)
    && options.triggerTimePoint
    && normalizeText(options.triggerTimePoint.type),
  )
)

type FlowOptionCheckRule = {
  type: ProcessNodeType
  code: string
  fieldKey: string
  fieldLabel: string
  shouldCheck?: (options: Record<string, any>) => boolean
  isMissing: (options: Record<string, any>, context: FlowApplyContext) => boolean
  messageBuilder?: (location: string) => string
}

const DEFAULT_FLOW_OPTION_RULE_MESSAGE = (
  location: string,
  fieldLabel: string,
) => `${location} 配置不完整：请补充${fieldLabel}`

const FLOW_OPTION_CHECK_RULES: FlowOptionCheckRule[] = [
  {
    type: ProcessNodeType.APPROVAL,
    code: 'approval_approver_missing',
    fieldKey: 'approver',
    fieldLabel: '审批人',
    shouldCheck: options => (
      (options as ApprovalOptions).category !== ApprovalCategory.AUTO_APPROVE
      && (options as ApprovalOptions).category !== ApprovalCategory.AUTO_REJECT
    ),
    isMissing: (options, context) => !hasResolvedProcessNodeOwner((options as ApprovalOptions).approver, {
      formFields: context.formFields,
      organizeData: context.organizeData,
    }),
  },
  {
    type: ProcessNodeType.APPROVAL,
    code: 'approval_same_as_submitter_missing',
    fieldKey: 'approverSameAsSubmitter',
    fieldLabel: '审批人与提交人为同一人时',
    isMissing: options => !normalizeText((options as ApprovalOptions).approverSameAsSubmitter),
  },
  {
    type: ProcessNodeType.APPROVAL,
    code: 'approval_empty_handler_user_missing',
    fieldKey: 'approverEmptyUsers',
    fieldLabel: '审批人为空时指定人员',
    shouldCheck: options => (options as ApprovalOptions).approverEmpty === OwnerEmptyHandle.ASSIGNEE,
    isMissing: options => !asArray((options as ApprovalOptions).approverEmptyUsers).length,
  },
  {
    type: ProcessNodeType.APPROVAL,
    code: 'approval_empty_handler_admin_missing',
    fieldKey: 'approverEmptyAdmin',
    fieldLabel: '审批人为空时管理员',
    shouldCheck: options => (options as ApprovalOptions).approverEmpty === OwnerEmptyHandle.ADMIN,
    isMissing: options => !normalizeText((options as ApprovalOptions).approverEmptyAdmin),
  },
  {
    type: ProcessNodeType.APPROVAL,
    code: 'approval_revert_range_missing',
    fieldKey: 'revertRange',
    fieldLabel: '退回范围',
    shouldCheck: options => (
      (options as ApprovalOptions).allowRevert !== false
      && Object.prototype.hasOwnProperty.call(options, 'revertRange')
    ),
    isMissing: options => !hasConfiguredNodeIdList((options as ApprovalOptions).revertRange),
  },
  {
    type: ProcessNodeType.TRANSACT,
    code: 'transact_transactor_missing',
    fieldKey: 'transactor',
    fieldLabel: '办理人',
    isMissing: (options, context) => !hasResolvedProcessNodeOwner((options as TransactOptions).transactor, {
      formFields: context.formFields,
      organizeData: context.organizeData,
    }),
  },
  {
    type: ProcessNodeType.NOTIFY,
    code: 'notify_notifier_missing',
    fieldKey: 'notifier',
    fieldLabel: '通知对象',
    isMissing: (options, context) => !hasResolvedProcessNodeOwner((options as NotifyOptions).notifier, {
      formFields: context.formFields,
      organizeData: context.organizeData,
    }),
  },
  {
    type: ProcessNodeType.REPORT_DATA,
    code: 'report_data_target_form_missing',
    fieldKey: 'targetTableUID',
    fieldLabel: '目标表单',
    isMissing: options => !normalizeText((options as ReportDataOptions).targetTableUID),
  },
  {
    type: ProcessNodeType.REPORT_DATA,
    code: 'report_data_reporter_missing',
    fieldKey: 'reporter',
    fieldLabel: '填报人',
    isMissing: (options, context) => !hasResolvedProcessNodeOwner((options as ReportDataOptions).reporter, {
      formFields: context.formFields,
      organizeData: context.organizeData,
    }),
  },
  {
    type: ProcessNodeType.ADD_DATA,
    code: 'add_data_target_form_missing',
    fieldKey: 'target',
    fieldLabel: '目标表单',
    isMissing: options => !normalizeText((options as AddDataOptions).targetTableUID),
  },
  {
    type: ProcessNodeType.ADD_DATA,
    code: 'add_data_mapping_missing',
    fieldKey: 'mapping',
    fieldLabel: '新增字段映射',
    isMissing: options => {
      const addDataOptions = options as AddDataOptions
      return !hasCompiledTargetFieldRules(addDataOptions.targetFields) && !hasCompiledTargetFieldRules(addDataOptions.batchFields)
    },
  },
  {
    type: ProcessNodeType.ADD_DATA,
    code: 'add_data_batch_count_missing',
    fieldKey: 'batch',
    fieldLabel: '批量新增设置',
    isMissing: options => {
      const addDataOptions = options as AddDataOptions
      return Boolean(addDataOptions.batchEnabled && !normalizeText(addDataOptions.batchNumber?.value))
    },
    messageBuilder: location => `${location} 配置不完整：请补充批量新增数量或数量字段`,
  },
  {
    type: ProcessNodeType.EDIT_DATA,
    code: 'edit_data_target_form_missing',
    fieldKey: 'target',
    fieldLabel: '目标表单',
    isMissing: options => !normalizeText((options as EditDataOptions).targetTableUID),
  },
  {
    type: ProcessNodeType.EDIT_DATA,
    code: 'edit_data_mapping_missing',
    fieldKey: 'mapping',
    fieldLabel: '更新字段映射',
    isMissing: options => !hasCompiledTargetFieldRules((options as EditDataOptions).targetFields, true),
  },
  {
    type: ProcessNodeType.DELETE_DATA,
    code: 'delete_data_target_form_missing',
    fieldKey: 'target',
    fieldLabel: '目标表单',
    isMissing: options => !normalizeText((options as DeleteDataOptions).targetTableUID),
  },
  {
    type: ProcessNodeType.DELETE_DATA,
    code: 'delete_data_filter_missing',
    fieldKey: 'filter',
    fieldLabel: '删除条件',
    isMissing: options => !hasFilterRuleConditions((options as DeleteDataOptions).targetTableFilterRule),
    messageBuilder: location => `${location} 配置不完整：请补充删除条件，避免整表删除`,
  },
  {
    type: ProcessNodeType.TRIGGER_DATA_CHANGE,
    code: 'trigger_data_change_event_missing',
    fieldKey: 'changeType',
    fieldLabel: '数据变化类型',
    isMissing: options => !asArray((options as DataChangeOptions).changeType).length,
  },
  {
    type: ProcessNodeType.TRIGGER_TIME_TASK,
    code: 'trigger_time_task_schedule_missing',
    fieldKey: 'schedule',
    fieldLabel: '定时规则',
    isMissing: options => !(options as TimeTaskOptions).method,
  },
  {
    type: ProcessNodeType.TRIGGER_TIME_TASK,
    code: 'trigger_time_task_basic_incomplete',
    fieldKey: 'schedule',
    fieldLabel: '定时规则',
    shouldCheck: options => (options as TimeTaskOptions).method === TimeTaskMethod.BASIC_TASK,
    isMissing: options => !hasTimeTaskBasicSchedule(options as TimeTaskOptions),
    messageBuilder: location => `${location} 配置不完整：请补充触发频率和时间`,
  },
  {
    type: ProcessNodeType.TRANSACT,
    code: 'transact_empty_handler_user_missing',
    fieldKey: 'transactorEmptyUsers',
    fieldLabel: '办理人为空时指定人员',
    shouldCheck: options => (options as TransactOptions).transactorEmpty === OwnerEmptyHandle.ASSIGNEE,
    isMissing: options => !asArray((options as TransactOptions).transactorEmptyUsers).length,
  },
  {
    type: ProcessNodeType.TRANSACT,
    code: 'transact_empty_handler_admin_missing',
    fieldKey: 'transactorEmptyAdmin',
    fieldLabel: '办理人为空时管理员',
    shouldCheck: options => (options as TransactOptions).transactorEmpty === OwnerEmptyHandle.ADMIN,
    isMissing: options => !normalizeText((options as TransactOptions).transactorEmptyAdmin),
  },
  {
    type: ProcessNodeType.TRANSACT,
    code: 'transact_revert_range_missing',
    fieldKey: 'revertRange',
    fieldLabel: '退回范围',
    shouldCheck: options => (
      (options as TransactOptions).allowRevert !== false
      && Object.prototype.hasOwnProperty.call(options, 'revertRange')
    ),
    isMissing: options => !hasConfiguredNodeIdList((options as TransactOptions).revertRange),
  },
  {
    type: ProcessNodeType.TRANSACT,
    code: 'transact_finish_condition_missing',
    fieldKey: 'finishCondition',
    fieldLabel: '完成条件',
    shouldCheck: options => (options as TransactOptions).requireSatisfyCondition === true,
    isMissing: options => !hasResolvedFinishCondition((options as TransactOptions).finishCondition),
  },
  {
    type: ProcessNodeType.REPORT_DATA,
    code: 'report_data_reporter_empty_user_missing',
    fieldKey: 'reporterEmptyUser',
    fieldLabel: '填报人为空时指定人员',
    shouldCheck: options => (options as ReportDataOptions).reporterEmpty === OwnerEmptyHandle.ASSIGNEE,
    isMissing: options => !normalizeText((options as ReportDataOptions).reporterEmptyUser),
  },
  {
    type: ProcessNodeType.REPORT_DATA,
    code: 'report_data_reporter_empty_admin_missing',
    fieldKey: 'reporterEmptyAdmin',
    fieldLabel: '填报人为空时管理员',
    shouldCheck: options => (options as ReportDataOptions).reporterEmpty === OwnerEmptyHandle.ADMIN,
    isMissing: options => !normalizeText((options as ReportDataOptions).reporterEmptyAdmin),
  },
  {
    type: ProcessNodeType.REPORT_DATA,
    code: 'report_data_finish_condition_missing',
    fieldKey: 'finishCondition',
    fieldLabel: '完成条件',
    shouldCheck: options => (options as ReportDataOptions).requireSatisfyCondition === true,
    isMissing: options => !hasResolvedFinishCondition((options as ReportDataOptions).finishCondition),
  },
  {
    type: ProcessNodeType.TRIGGER_TIME_TASK,
    code: 'trigger_time_task_advanced_incomplete',
    fieldKey: 'schedule',
    fieldLabel: '高级定时规则',
    shouldCheck: options => (options as TimeTaskOptions).method === TimeTaskMethod.ADVANCED_TASK,
    isMissing: options => !hasTimeTaskAdvancedSchedule(options as TimeTaskOptions),
    messageBuilder: location => `${location} 配置不完整：请补充触发日期字段和触发时间点`,
  },
]

const validateCompiledAiFlowOptions = (
  flows: ProcessFlow[],
  context: FlowApplyContext,
) => {
  const diagnostics: NocodeEditorFlowPlanDiagnostic[] = []
  const pushDiagnostic = (
    flow: ProcessFlow,
    compileContext: FlowPlanNodeCompileContext | undefined,
    input: {
      code: string
      message: string
      fieldKey?: string
      fieldLabel?: string
    },
  ) => {
    diagnostics.push(buildFlowPlanDiagnostic({
      code: input.code,
      message: input.message,
      runtimeNodeId: String(flow.uid || '').trim() || undefined,
      location: compileContext?.location,
      nodeKey: compileContext?.nodeKey,
      nodeName: compileContext?.nodeName,
      nodeType: compileContext?.nodeType,
      fieldKey: input.fieldKey,
      fieldLabel: input.fieldLabel,
      branchKey: compileContext?.branchKey,
      branchLabel: compileContext?.branchLabel,
    }))
  }

  const visit = (items: ProcessFlow[]) => {
    items.forEach((flow) => {
      const options = asRecord(flow.options)
      const compileContext = context.flowNodeContextByUid.get(String(flow.uid || ''))
      const location = compileContext
        ? formatFlowPlanNodeCompileLocation(compileContext)
        : normalizeText(flow.options?.name || flow.type)
      FLOW_OPTION_CHECK_RULES
        .filter(rule => rule.type === flow.type)
        .forEach((rule) => {
          if (rule.shouldCheck && !rule.shouldCheck(options)) {
            return
          }
          if (!rule.isMissing(options, context)) {
            return
          }
          pushDiagnostic(flow, compileContext, {
            code: rule.code,
            message: rule.messageBuilder
              ? rule.messageBuilder(location)
              : DEFAULT_FLOW_OPTION_RULE_MESSAGE(location, rule.fieldLabel),
            fieldKey: rule.fieldKey,
            fieldLabel: rule.fieldLabel,
          })
        })

      asArray<ProcessBranch>(flow.branches).forEach((branch) => {
        visit(branch.flows)
      })
    })
  }

  visit(flows)
  if (diagnostics.length) {
    throwFlowPlanCompileError(diagnostics)
  }
}

const resolveNodeOptions = (
  node: NocodeEditorFlowPlanNode,
  context: FlowApplyContext,
): ProcessFlowOptions => {
  const options = cloneValue(asRecord(node.options))
  if (node.name) {
    options.name = node.name
  }

  const processNodeType = FLOW_PLAN_NODE_TYPE_TO_PROCESS_TYPE[node.type]
  if (!processNodeType) {
    throw new Error(`不支持的流程节点类型：${node.type}`)
  }

  if (processNodeType === ProcessNodeType.TRIGGER_DATA_CHANGE || processNodeType === ProcessNodeType.TRIGGER_TIME_TASK) {
    return resolveTriggerOptions(options as ProcessFlowOptions, context, processNodeType)
  }
  if (processNodeType === ProcessNodeType.TRIGGER_OPERATION) {
    return resolveOperationTriggerOptions(options as ProcessFlowOptions)
  }
  if (processNodeType === ProcessNodeType.APPROVAL) {
    return resolveApprovalOptions(options as ProcessFlowOptions, context)
  }
  if (processNodeType === ProcessNodeType.TRANSACT) {
    return resolveTransactOptions(options as ProcessFlowOptions, context)
  }
  if (processNodeType === ProcessNodeType.NOTIFY) {
    return resolveNotifyOptions(options as ProcessFlowOptions, context)
  }
  if (processNodeType === ProcessNodeType.REPORT_DATA) {
    return resolveReportDataOptions(options as ProcessFlowOptions, context)
  }
  if (processNodeType === ProcessNodeType.ADD_DATA) {
    return resolveDataWriteOptions(options as ProcessFlowOptions, context, 'add')
  }
  if (processNodeType === ProcessNodeType.EDIT_DATA) {
    return resolveDataWriteOptions(options as ProcessFlowOptions, context, 'edit')
  }
  if (processNodeType === ProcessNodeType.DELETE_DATA) {
    return resolveDataWriteOptions(options as ProcessFlowOptions, context, 'delete')
  }

  return options as ProcessFlowOptions
}

const registerNodeIdentity = (
  flow: ProcessFlow,
  node: NocodeEditorFlowPlanNode,
  context: FlowApplyContext,
  location: string,
  triggerBranch?: Pick<NocodeEditorFlowPlanTriggerBranch, 'branchKey' | 'label'> | null,
) => {
  const nodeKey = normalizeText(node.nodeKey)
  if (nodeKey) {
    flow.meta = {
      ...asRecord(flow.meta),
      schemeNodeKey: nodeKey,
    }
    context.nodeUidByNodeKey.set(nodeKey, flow.uid)
    context.flowToPlanNodeKey.set(flow, nodeKey)
  }
  const nameToken = normalizeToken(node.name || flow.options?.name)
  if (nameToken && !context.nodeUidByNameToken.has(nameToken)) {
    context.nodeUidByNameToken.set(nameToken, flow.uid)
  }
  context.flowNodeContextByUid.set(flow.uid, {
    location,
    nodeKey: nodeKey || undefined,
    nodeName: normalizeText(node.name || flow.options?.name) || undefined,
    nodeType: node.type,
    branchKey: normalizeText(triggerBranch?.branchKey) || undefined,
    branchLabel: normalizeText(triggerBranch?.label) || undefined,
  })
}

const formatFlowPlanNodeCompileLocation = (
  context: FlowPlanNodeCompileContext,
) => {
  const parts = [
    context.location,
    context.branchLabel ? `触发分支=${context.branchLabel}` : '',
    context.nodeKey ? `nodeKey=${context.nodeKey}` : '',
    context.nodeName ? `节点=${context.nodeName}` : '',
    `类型=${context.nodeType}`,
  ].filter(Boolean)
  return parts.join('，')
}

const buildFlowPlanDiagnostic = (
  input: BuildFlowPlanDiagnosticInput,
): NocodeEditorFlowPlanDiagnostic => {
  const scopeKind = input.scopeKind || (input.branchKey ? 'trigger-branch' : 'overview')
  const normalizedFieldIdentity = normalizeText(input.fieldKey)
    || normalizeText(input.fieldLabel)
  const normalizedNodeIdentity = normalizeText(input.nodeKey)
    || normalizeText(input.nodeType)
    || normalizeText(input.nodeName)
  const idSeed = [
    input.code,
    scopeKind,
    input.branchKey,
    normalizedNodeIdentity,
    normalizedFieldIdentity,
    !input.branchKey && !normalizedNodeIdentity && !normalizedFieldIdentity
      ? input.location
      : '',
  ].filter(Boolean).join(':')

  return {
    id: idSeed || unique(),
    code: input.code,
    level: 'error',
    message: input.message,
    runtimeNodeId: normalizeText(input.runtimeNodeId) || undefined,
    location: normalizeText(input.location) || undefined,
    nodeKey: normalizeText(input.nodeKey) || undefined,
    nodeName: normalizeText(input.nodeName) || undefined,
    nodeType: input.nodeType,
    fieldKey: normalizeText(input.fieldKey) || undefined,
    fieldLabel: normalizeText(input.fieldLabel) || undefined,
    scopeKind,
    branchKey: normalizeText(input.branchKey) || undefined,
    branchLabel: normalizeText(input.branchLabel) || undefined,
  }
}

const buildFlowPlanValidationSummary = (
  diagnostics: NocodeEditorFlowPlanDiagnostic[],
  fallback: string,
) => {
  if (!diagnostics.length) {
    return fallback
  }
  if (diagnostics.length === 1) {
    return diagnostics[0].message
  }
  return `当前流程蓝图还有 ${diagnostics.length} 项节点配置待补充，先确认后再生成。`
}

const isSoftFlowIssueDiagnostic = (
  diagnostic?: Pick<NocodeEditorFlowPlanDiagnostic, 'code'> | null,
) => SOFT_FLOW_ISSUE_DIAGNOSTIC_CODES.has(String(diagnostic?.code || '').trim())

export const preferSpecificFlowDiagnostics = <T extends Pick<
NocodeEditorFlowPlanDiagnostic,
'code' | 'runtimeNodeId' | 'nodeKey'
>>(diagnostics: T[]): T[] => {
  const getNodeIdentity = (diagnostic: T) => {
    const runtimeNodeId = normalizeText(diagnostic.runtimeNodeId)
    if (runtimeNodeId) {
      return `runtime:${runtimeNodeId}`
    }
    const nodeKey = normalizeText(diagnostic.nodeKey)
    return nodeKey ? `scheme:${nodeKey}` : ''
  }
  const nodesWithSpecificDiagnostics = new Set(
    diagnostics
      .filter(item => normalizeText(item.code) !== 'runtime_flow_validate_failed')
      .map(getNodeIdentity)
      .filter(Boolean),
  )

  return diagnostics.filter((item) => {
    if (normalizeText(item.code) !== 'runtime_flow_validate_failed') {
      return true
    }
    const nodeIdentity = getNodeIdentity(item)
    return !nodeIdentity || !nodesWithSpecificDiagnostics.has(nodeIdentity)
  })
}

const registerPersistedNodeIdentities = (
  flows: ProcessFlow[],
  context: FlowApplyContext,
) => {
  const visit = (items: ProcessFlow[]) => {
    items.forEach((flow) => {
      const schemeNodeKey = normalizeText(asRecord(flow.meta).schemeNodeKey)
      const nodeType = toPublicFlowPlanNodeType(flow.type)
      if (schemeNodeKey) {
        context.nodeUidByNodeKey.set(schemeNodeKey, flow.uid)
        context.flowToPlanNodeKey.set(flow, schemeNodeKey)
        if (nodeType) {
          context.flowNodeContextByUid.set(flow.uid, {
            location: normalizeText(flow.options?.name || flow.type),
            nodeKey: schemeNodeKey,
            nodeName: normalizeText(flow.options?.name) || undefined,
            nodeType,
          })
        }
      }
      asArray<ProcessBranch>(flow.branches).forEach(branch => visit(branch.flows))
    })
  }
  visit(flows)
}

const splitFlowPlanDiagnostics = (
  diagnostics: NocodeEditorFlowPlanDiagnostic[],
) => {
  const flowIssues: NocodeEditorFlowPlanDiagnostic[] = []
  const blocking: NocodeEditorFlowPlanDiagnostic[] = []
  diagnostics.forEach((diagnostic) => {
    if (isSoftFlowIssueDiagnostic(diagnostic)) {
      flowIssues.push(diagnostic)
      return
    }
    blocking.push(diagnostic)
  })
  return {
    flowIssues,
    blocking,
  }
}

const buildFlowActionIssue = (
  diagnostic: NocodeEditorFlowPlanDiagnostic,
  context: FlowApplyContext,
): NocodeEditorAiFlowActionIssue => {
  const processNodeId = normalizeText(diagnostic.runtimeNodeId)
    || (normalizeText(diagnostic.nodeKey)
      ? context.nodeUidByNodeKey.get(normalizeText(diagnostic.nodeKey)) || ''
      : '')
  const targetId = processNodeId
    || normalizeText(diagnostic.nodeKey)
    || normalizeText(diagnostic.id)
    || unique()
  const targetLabel = normalizeText(diagnostic.nodeName)
    || normalizeText(diagnostic.nodeKey)
    || '未命名节点'
  return {
    id: [
      'flow-issue',
      normalizeIssueIdPart(diagnostic.code),
      normalizeIssueIdPart(processNodeId || diagnostic.nodeKey),
      normalizeIssueIdPart(diagnostic.fieldKey || diagnostic.fieldLabel),
    ].join(':'),
    targetKind: 'process_node',
    targetId,
    schemeNodeKey: normalizeText(diagnostic.nodeKey) || undefined,
    targetLabel,
    groupKey: 'process_node',
    groupLabel: '流程节点',
    code: diagnostic.code,
    message: diagnostic.message,
    fieldKey: normalizeText(diagnostic.fieldKey) || undefined,
    fieldLabel: normalizeText(diagnostic.fieldLabel) || undefined,
    displayMessage: `${normalizeText(diagnostic.fieldLabel) || '配置项'}配置不完整`,
    locator: {
      tab: 'process-setting',
      formId: normalizeText(context.currentTable?.uid) || undefined,
      formLabel: normalizeText(context.currentTable?.alias) || undefined,
      processNodeId: processNodeId || undefined,
    },
  }
}

const buildFlowIssueSummary = (
  issues: NocodeEditorAiFlowActionIssue[],
) => {
  if (!issues.length) {
    return ''
  }
  const issueNodeCount = new Set(
    issues.map(issue => normalizeText(issue.targetId) || normalizeText(issue.targetLabel)),
  ).size
  return `流程草稿已经生成，但还有 ${issueNodeCount} 个节点的生成后必补配置未补齐，请继续处理`
}

const buildFlowIssueState = (
  diagnostics: NocodeEditorFlowPlanDiagnostic[],
  context: FlowApplyContext,
): NocodeEditorAiFlowIssueState | null => {
  if (!diagnostics.length) {
    return null
  }
  const actionIssues = diagnostics.map(item => buildFlowActionIssue(item, context))
  const issueNodeCount = new Set(
    actionIssues.map(issue => normalizeText(issue.targetId) || normalizeText(issue.targetLabel)),
  ).size
  return {
    mode: 'flow_issue',
    issueCount: issueNodeCount,
    summary: buildFlowIssueSummary(actionIssues),
    actionIssues,
    updatedAt: Date.now(),
  }
}

const dedupeFlowDiagnostics = (
  diagnostics: NocodeEditorFlowPlanDiagnostic[],
) => {
  const seen = new Set<string>()
  return diagnostics.filter((item) => {
    const key = item.id || [
      item.code,
      item.runtimeNodeId,
      item.nodeKey,
      item.fieldKey,
      item.fieldLabel,
    ].filter(Boolean).join(':')
    if (!key || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

const buildFailedFlowPlanCompileResult = (
  diagnostics: NocodeEditorFlowPlanDiagnostic[],
  fallback = '当前流程规划未通过流程校验',
): FlowPlanCompileResult => ({
  status: 'failed',
  compilable: false,
  summary: buildFlowPlanValidationSummary(diagnostics, fallback),
  validatedAt: Date.now(),
  diagnostics,
})

const createFlowPlanCompileError = (
  diagnostics: NocodeEditorFlowPlanDiagnostic[],
  fallback?: string,
) => {
  const { blocking } = splitFlowPlanDiagnostics(diagnostics)
  const compileResult = buildFailedFlowPlanCompileResult(
    blocking.length ? blocking : diagnostics,
    fallback,
  )
  const error = new Error(compileResult.summary || fallback || '当前流程规划未通过流程校验') as FlowPlanValidationError
  error.flowPlanCompileResult = compileResult
  return error
}

const throwFlowPlanCompileError = (
  diagnostics: NocodeEditorFlowPlanDiagnostic[],
  fallback?: string,
): never => {
  throw createFlowPlanCompileError(diagnostics, fallback)
}

const buildFlowPlanNodeCompileError = (
  node: NocodeEditorFlowPlanNode,
  location: string,
  error: unknown,
  triggerBranch?: Pick<NocodeEditorFlowPlanTriggerBranch, 'branchKey' | 'label'> | null,
) => {
  const existingCompileResult = (error as FlowPlanValidationError | null | undefined)?.flowPlanCompileResult
  if (existingCompileResult?.diagnostics?.length) {
    return createFlowPlanCompileError(existingCompileResult.diagnostics, existingCompileResult.summary)
  }

  const nodeContext: FlowPlanNodeCompileContext = {
    location,
    nodeKey: normalizeText(node.nodeKey) || undefined,
    nodeName: normalizeText(node.name) || undefined,
    nodeType: node.type,
    branchKey: normalizeText(triggerBranch?.branchKey) || undefined,
    branchLabel: normalizeText(triggerBranch?.label) || undefined,
  }
  const message = error instanceof Error ? error.message : String(error || '')
  return createFlowPlanCompileError([
    buildFlowPlanDiagnostic({
      code: 'node_compile_failed',
      message: `${formatFlowPlanNodeCompileLocation(nodeContext)} 配置不完整：${message || '当前节点无法编译'}`,
      location,
      nodeKey: nodeContext.nodeKey,
      nodeName: nodeContext.nodeName,
      nodeType: node.type,
      branchKey: nodeContext.branchKey,
      branchLabel: nodeContext.branchLabel,
    }),
  ])
}

const resolveNodeReferenceId = (
  context: FlowApplyContext,
  candidate: unknown,
) => {
  const text = normalizeText(candidate)
  if (!text) {
    return ''
  }
  return context.nodeUidByNodeKey.get(text)
    || context.nodeUidByNameToken.get(normalizeToken(text))
    || text
}

const normalizeNodeReferencesInConditions = (
  groups: ConditionBranchConditionGroup[] | undefined,
  context: FlowApplyContext,
) => {
  if (!Array.isArray(groups)) {
    return groups
  }
  groups.forEach((group) => {
    group.forEach((item) => {
      if (String(item?.type || '').trim() === FormConditionValueType.NODE && item?.uid) {
        item.uid = resolveNodeReferenceId(context, item.uid)
      }
    })
  })
  return groups
}

const normalizeTimeoutBackNodeReferences = (
  value: unknown,
  context: FlowApplyContext,
) => {
  if (Array.isArray(value)) {
    value.forEach(item => normalizeTimeoutBackNodeReferences(item, context))
    return
  }
  if (!isPlainObject(value)) return
  Object.entries(value).forEach(([key, item]) => {
    if (key === 'backNodeId') {
      value[key] = resolveNodeReferenceId(context, item)
      return
    }
    normalizeTimeoutBackNodeReferences(item, context)
  })
}

const normalizeNodeReferenceOptions = (
  flows: ProcessFlow[],
  context: FlowApplyContext,
) => {
  const visit = (items: ProcessFlow[]) => {
    items.forEach((flow) => {
      const options = asRecord(flow.options)
      if (flow.type === ProcessNodeType.APPROVAL) {
        if (Array.isArray(options.rejectSkipNodeIds)) {
          options.rejectSkipNodeIds = options.rejectSkipNodeIds
            .map((item: unknown) => resolveNodeReferenceId(context, item))
            .filter(Boolean)
        }
      }
      if (
        (flow.type === ProcessNodeType.APPROVAL || flow.type === ProcessNodeType.TRANSACT)
        && Array.isArray(options.revertRange)
      ) {
        options.revertRange = options.revertRange
          .map((item: unknown) => resolveNodeReferenceId(context, item))
          .filter(Boolean)
      }
      normalizeTimeoutBackNodeReferences(options.timeout, context)

      normalizeNodeReferencesInConditions(options.conditions as ConditionBranchConditionGroup[] | undefined, context)
      normalizeNodeReferencesInConditions(asRecord(options.finishCondition).conditions as ConditionBranchConditionGroup[] | undefined, context)
      asArray<ProcessBranch>(flow.branches).forEach((branch) => {
        const branchSetting = asArray<ProcessFlow>(branch.flows).find(item => item.type === ProcessNodeType.BRANCH_SETTING)
        normalizeNodeReferencesInConditions(
          asRecord(branchSetting?.options).conditions as ConditionBranchConditionGroup[] | undefined,
          context,
        )
        visit(branch.flows)
      })
    })
  }
  visit(flows)
}

const containsTriggerNode = (nodes: NocodeEditorFlowPlanNode[]) => (
  nodes.some((node) => (
    isNocodeEditorFlowPlanTriggerNodeType(node.type)
    || asArray<NocodeEditorFlowPlanBranch>(node.branches).some(branch => containsTriggerNode(branch.nodes))
  ))
)

const collectPlanNodeTypes = (nodes: NocodeEditorFlowPlanNode[]): string[] => {
  const results: string[] = []
  const visit = (items: NocodeEditorFlowPlanNode[]) => {
    items.forEach((node) => {
      results.push(node.type)
      asArray<NocodeEditorFlowPlanBranch>(node.branches).forEach(branch => visit(branch.nodes))
    })
  }
  visit(nodes)
  return results
}

const ensureSupportedPlan = (
  plan: NocodeEditorFlowPlan,
  currentTable: Table | null,
) => {
  const diagnostics: NocodeEditorFlowPlanDiagnostic[] = []
  const pushOverviewDiagnostic = (
    code: string,
    message: string,
    branch?: Pick<NocodeEditorFlowPlanTriggerBranch, 'branchKey' | 'label'> | null,
  ) => {
    diagnostics.push(buildFlowPlanDiagnostic({
      code,
      message,
      scopeKind: branch?.branchKey ? 'trigger-branch' : 'overview',
      branchKey: normalizeText(branch?.branchKey) || undefined,
      branchLabel: normalizeText(branch?.label) || undefined,
    }))
  }

  if (asArray(plan.openQuestions).length) {
    pushOverviewDiagnostic('flow_plan_pending_questions', '当前流程规划仍有待确认问题，暂不能直接按蓝图生成表单流程')
  }

  if (!plan.triggerBranches.length) {
    pushOverviewDiagnostic('flow_plan_trigger_branch_missing', '流程规划至少需要一个触发分支')
  }

  if (
    currentTable
    && (
      (plan.target?.formId && plan.target.formId !== currentTable.uid)
      || (plan.target?.formName && normalizeToken(plan.target.formName) !== normalizeToken(currentTable.alias))
    )
  ) {
    pushOverviewDiagnostic('flow_plan_target_mismatch', '当前流程蓝图只能生成到当前打开表单的表单流程中，请先切换到目标表单后再执行')
  }

  plan.triggerBranches.forEach((triggerBranch, index) => {
    if (!isNocodeEditorFlowPlanTriggerNodeType(triggerBranch.triggerNode.type)) {
      pushOverviewDiagnostic('trigger_branch_type_invalid', `触发分支 ${index + 1} 的触发节点类型不合法`, triggerBranch)
    }

    if (!triggerBranch.nodes.length) {
      pushOverviewDiagnostic('trigger_branch_nodes_missing', `触发分支 ${index + 1} 至少需要一个后续处理节点`, triggerBranch)
    }

    if (containsTriggerNode(triggerBranch.nodes)) {
      pushOverviewDiagnostic('trigger_branch_nested_trigger_invalid', '触发节点只能出现在 triggerNode 中，不能出现在后续节点或分支里', triggerBranch)
    }

    if (
      triggerBranch.triggerNode.type === 'trigger-time-task'
      && normalizeText(asRecord(triggerBranch.triggerNode.options).triggerMode) === TriggerMode.SINGLE
    ) {
      const downstreamNodeTypes = collectPlanNodeTypes(triggerBranch.nodes)
      if (downstreamNodeTypes.some(type => type === 'approval' || type === 'transact')) {
        pushOverviewDiagnostic('trigger_time_task_single_human_invalid', '定时触发节点在单条触发模式下，后续不能直接接审批或办理节点', triggerBranch)
      }
    }
  })

  if (diagnostics.length) {
    throwFlowPlanCompileError(diagnostics)
  }
}

const isFallbackBranchLabel = (value: unknown) => /^(其他|兜底|默认|else|otherwise)$/i.test(normalizeText(value))

const hasBranchConditionDefinitions = (value: unknown) => (
  normalizeConditionGroupInputs(value).some(group => group.some(item => isPlainObject(item)))
)

const buildBranchSettingFlow = (
  node: NocodeEditorFlowPlanNode,
  branch: NocodeEditorFlowPlanBranch,
  context: FlowApplyContext,
  isFallback = false,
  upstreamNode: ProcessFlow | null = null,
): ProcessFlow => {
  const branchNodeOptions = asRecord(node.options)
  return {
    uid: unique(),
    type: ProcessNodeType.BRANCH_SETTING,
    options: {
      name: normalizeText(branch.label) || (isFallback ? i18next.t('process.otherBranch') : ''),
      sourceTables: resolveSourceTables(branchNodeOptions.sourceTables, context),
      conditions: isFallback ? [] : resolveConditionGroups(branch.conditions, context.currentTable, {
        upstreamNode,
        fieldPolicyContext: context.getFieldPolicyContext(context.currentTable),
      }),
    } as ConditionBranchOptions,
  }
}

const buildPlanNodeFlow = (
  node: NocodeEditorFlowPlanNode,
  context: FlowApplyContext,
  location: string,
  triggerBranch: Pick<NocodeEditorFlowPlanTriggerBranch, 'branchKey' | 'label'>,
  upstreamNode: ProcessFlow | null = null,
): ProcessFlow => {
  const processNodeType = FLOW_PLAN_NODE_TYPE_TO_PROCESS_TYPE[node.type]
  if (!processNodeType) {
    throwFlowPlanCompileError([
      buildFlowPlanDiagnostic({
        code: 'flow_node_type_unsupported',
        message: `不支持的流程节点类型：${node.type}`,
        location,
        nodeKey: normalizeText(node.nodeKey) || undefined,
        nodeName: normalizeText(node.name) || undefined,
        nodeType: node.type,
        branchKey: normalizeText(triggerBranch.branchKey) || undefined,
        branchLabel: normalizeText(triggerBranch.label) || undefined,
      }),
    ])
  }

  let options: ProcessFlowOptions
  try {
    options = resolveNodeOptions(node, context)
  } catch (error) {
    throw buildFlowPlanNodeCompileError(node, location, error, triggerBranch)
  }

  const flow: ProcessFlow = {
    uid: unique(),
    type: processNodeType,
    options,
  }

  registerNodeIdentity(flow, node, context, location, triggerBranch)

  if (processNodeType === ProcessNodeType.CONDITION_BRANCH || processNodeType === ProcessNodeType.PARALLEL_BRANCH) {
    const rawBranches = asArray<NocodeEditorFlowPlanBranch>(node.branches)
    if (!rawBranches.length) {
      throwFlowPlanCompileError([
        buildFlowPlanDiagnostic({
          code: 'branch_definition_missing',
          message: `${location} 缺少分支定义`,
          location,
          nodeKey: normalizeText(node.nodeKey) || undefined,
          nodeName: normalizeText(node.name) || undefined,
          nodeType: node.type,
          branchKey: normalizeText(triggerBranch.branchKey) || undefined,
          branchLabel: normalizeText(triggerBranch.label) || undefined,
        }),
      ])
    }

    const normalizedBranches = rawBranches.map(item => ({
      ...item,
      nodes: asArray<NocodeEditorFlowPlanNode>(item.nodes),
      conditions: asArray<ConditionBranchConditionGroup>(item.conditions),
    }))

    if (processNodeType === ProcessNodeType.CONDITION_BRANCH) {
      const fallbackBranches = normalizedBranches.filter(item => !hasBranchConditionDefinitions(item.conditions) || isFallbackBranchLabel(item.label))
      if (fallbackBranches.length > 1) {
        throwFlowPlanCompileError([
          buildFlowPlanDiagnostic({
            code: 'condition_branch_fallback_duplicate',
            message: `${location} 只能有一个兜底分支`,
            location,
            nodeKey: normalizeText(node.nodeKey) || undefined,
            nodeName: normalizeText(node.name) || undefined,
            nodeType: node.type,
            branchKey: normalizeText(triggerBranch.branchKey) || undefined,
            branchLabel: normalizeText(triggerBranch.label) || undefined,
          }),
        ])
      }
      const explicitBranches = normalizedBranches.filter(item => !fallbackBranches.includes(item))
      const fallbackBranch = fallbackBranches[0] || null
      const orderedBranches = [
        ...explicitBranches,
        ...(fallbackBranch ? [fallbackBranch] : []),
      ]

      if (!fallbackBranch) {
        orderedBranches.push({
          branchKey: `${normalizeText(node.nodeKey) || flow.uid}-fallback`,
          label: i18next.t('process.otherBranch'),
          conditions: [],
          nodes: [],
        })
        // context.warnings.push(`${normalizeText(node.name) || '条件分支'}缺少兜底分支，已自动补齐“其他分支”`)
      }

      flow.branches = orderedBranches.map((branch, branchIndex) => ({
        uid: unique(),
        type: flow.type,
        flows: [
          buildBranchSettingFlow(node, branch, context, branchIndex === orderedBranches.length - 1, upstreamNode),
          ...(() => {
            let previousChildFlow: ProcessFlow | null = null
            return branch.nodes.map((child, childIndex) => {
              const childFlow = buildPlanNodeFlow(
                child,
                context,
                `${location} / ${normalizeText(branch.label) || `分支 ${branchIndex + 1}`} / 节点 ${childIndex + 1}`,
                triggerBranch,
                previousChildFlow,
              )
              previousChildFlow = childFlow
              return childFlow
            })
          })(),
        ],
      }))
    } else {
      if (normalizedBranches.length < 2) {
        throwFlowPlanCompileError([
          buildFlowPlanDiagnostic({
            code: 'parallel_branch_insufficient',
            message: `${location} 至少需要两个并行分支`,
            location,
            nodeKey: normalizeText(node.nodeKey) || undefined,
            nodeName: normalizeText(node.name) || undefined,
            nodeType: node.type,
            branchKey: normalizeText(triggerBranch.branchKey) || undefined,
            branchLabel: normalizeText(triggerBranch.label) || undefined,
          }),
        ])
      }
      flow.branches = normalizedBranches.map((branch, branchIndex) => ({
        uid: unique(),
        type: flow.type,
        flows: [
          buildBranchSettingFlow(node, branch, context, false, upstreamNode),
          ...(() => {
            let previousChildFlow: ProcessFlow | null = null
            return branch.nodes.map((child, childIndex) => {
              const childFlow = buildPlanNodeFlow(
                child,
                context,
                `${location} / ${normalizeText(branch.label) || `并行分支 ${branchIndex + 1}`} / 节点 ${childIndex + 1}`,
                triggerBranch,
                previousChildFlow,
              )
              previousChildFlow = childFlow
              return childFlow
            })
          })(),
        ],
      }))
    }
  }

  return flow
}

export const compileAiFlowPatchNode = (
  input: CompileAiFlowPatchNodeInput,
): ProcessFlow => {
  const existingNode = input.existingFlow
    ? serializeExistingPlanNode(input.existingFlow)
    : null
  if (input.existingFlow && !existingNode) {
    throw new Error(`节点类型 ${input.existingFlow.type} 不支持局部编译`)
  }

  const node: NocodeEditorFlowPlanNode = {
    ...(existingNode || {}),
    ...input.node,
    nodeKey: normalizeText(asRecord(input.existingFlow?.meta).schemeNodeKey)
      || input.existingFlow?.uid,
    options: {
      ...asRecord(existingNode?.options),
      ...asRecord(input.node.options),
    },
  }
  const context = createFlowApplyContext({
    ...input,
    plan: {} as NocodeEditorFlowPlan,
  })
  const flow = buildPlanNodeFlow(
    node,
    context,
    input.location || `局部节点 / ${normalizeText(node.name) || node.type}`,
    input.triggerBranch,
    input.previousFlow || null,
  )

  normalizeNodeReferenceOptions([flow], context)
  validateCompiledAiFlowOptions([flow], context)

  if (!input.existingFlow) return flow
  return {
    ...input.existingFlow,
    ...flow,
    uid: input.existingFlow.uid,
    type: input.existingFlow.type,
    branches: input.existingFlow.branches,
  }
}

const createValidationBranch = (
  flows: ProcessFlow[],
  input: ApplyAiFlowPlanInput,
) => {
  const formFields = asArray<Field>(input.formFields)
  const tables = asArray<Table>(input.tables)
  const organizeData = input.organizeData || {
    users: [],
    roles: [],
    departments: [],
  }
  const validationFlows = deepClone(flows)
  const context: ProcessContext = {
    updateHistory: () => {},
    allowStructureEdit: false,
    normalizeFlowOptions: () => {
      normalizeFlowReferenceOptions(validationFlows)
    },
    organizeData,
    tables,
    formFields,
    formElementsInfo: [],
  }
  return new Branch({
    uid: 'root',
    type: 'root',
    flows: validationFlows,
  }, null as any, context)
}

const buildRuntimeRootFlows = (
  startBranches: ProcessBranch[],
): ProcessFlow[] => {
  const normalizedStartBranches = startBranches.length > 0
    ? startBranches
    : []

  return [
    {
      uid: 'start',
      type: ProcessNodeType.START,
      options: {
        name: i18next.t('FormProcess.processStartNode'),
        fieldAuth: 'all',
      },
      branches: normalizedStartBranches,
    },
    {
      uid: 'end',
      type: ProcessNodeType.END,
      options: {
        name: i18next.t('FormProcess.processEnd'),
      },
    },
  ]
}

const collectFirstValidationError = (
  branch: Branch,
  flowNodeContextByUid: Map<string, FlowPlanNodeCompileContext> = new Map(),
): string => {
  const visit = (currentBranch: Branch): string => {
    for (const node of currentBranch.nodes) {
      if ((node as ProcessNode).valid === false) {
        const nodeContext = flowNodeContextByUid.get(String((node as ProcessNode).uid || ''))
        const error = (node as ProcessNode).errorMsg || `${node.title || node.type} 配置不完整`
        return nodeContext
          ? `${formatFlowPlanNodeCompileLocation(nodeContext)} 配置不完整：${error}`
          : error
      }
      if (node instanceof BranchNode) {
        for (const childBranch of node.branches) {
          const nested = visit(childBranch)
          if (nested) {
            return nested
          }
        }
      }
    }
    return ''
  }
  return visit(branch)
}

const buildRuntimeValidationDiagnostic = (
  node: ProcessNode,
  flowNodeContextByUid: Map<string, FlowPlanNodeCompileContext>,
): NocodeEditorFlowPlanDiagnostic | null => {
  const ownerNode = node.type === ProcessNodeType.BRANCH_SETTING
    ? node.parent?.getOwner?.() || null
    : null
  const runtimeNodeId = normalizeText(
    node.type === ProcessNodeType.BRANCH_SETTING
      ? ownerNode?.uid
      : node.uid,
  ) || undefined
  const compileContext = runtimeNodeId
    ? flowNodeContextByUid.get(runtimeNodeId)
    : undefined
  const runtimeNodeName = normalizeText(
    node.type === ProcessNodeType.BRANCH_SETTING
      ? ownerNode?.title
      : node.title,
  ) || undefined
  const message = normalizeText(node.errorMsg)
  if (!message) {
    return null
  }

  if (node.type === ProcessNodeType.BRANCH_SETTING && message === i18next.t('process.setConditionTips')) {
    return buildFlowPlanDiagnostic({
      code: 'branch_condition_missing',
      message: `${formatFlowPlanNodeCompileLocation(compileContext || {
        location: '分支条件',
        nodeType: ProcessNodeType.CONDITION_BRANCH as unknown as NocodeEditorFlowPlanNodeType,
      })} 配置不完整：请补充分支条件`,
      runtimeNodeId,
      location: compileContext?.location,
      nodeKey: compileContext?.nodeKey,
      nodeName: compileContext?.nodeName || runtimeNodeName,
      nodeType: compileContext?.nodeType,
      branchKey: compileContext?.branchKey,
      branchLabel: compileContext?.branchLabel,
      fieldKey: 'conditions',
      fieldLabel: '分支条件',
    })
  }

  if (node.type === ProcessNodeType.NOTIFY && message === i18next.t('process.completeSettingsTips')) {
    return buildFlowPlanDiagnostic({
      code: 'notify_notifier_missing',
      message: `${formatFlowPlanNodeCompileLocation(compileContext || {
        location: '通知节点',
        nodeType: ProcessNodeType.NOTIFY as unknown as NocodeEditorFlowPlanNodeType,
      })} 配置不完整：请补充通知对象`,
      runtimeNodeId,
      location: compileContext?.location,
      nodeKey: compileContext?.nodeKey,
      nodeName: compileContext?.nodeName || runtimeNodeName,
      nodeType: compileContext?.nodeType,
      branchKey: compileContext?.branchKey,
      branchLabel: compileContext?.branchLabel,
      fieldKey: 'notifier',
      fieldLabel: '通知对象',
    })
  }

  if (node.type === ProcessNodeType.TRANSACT && message === i18next.t('process.completeSettingsTips')) {
    return buildFlowPlanDiagnostic({
      code: 'transact_empty_handler_missing',
      message: `${formatFlowPlanNodeCompileLocation(compileContext || {
        location: '办理节点',
        nodeType: ProcessNodeType.TRANSACT as unknown as NocodeEditorFlowPlanNodeType,
      })} 配置不完整：请补充空办理人处理方式`,
      runtimeNodeId,
      location: compileContext?.location,
      nodeKey: compileContext?.nodeKey,
      nodeName: compileContext?.nodeName || runtimeNodeName,
      nodeType: compileContext?.nodeType,
      branchKey: compileContext?.branchKey,
      branchLabel: compileContext?.branchLabel,
      fieldKey: 'transactorEmpty',
      fieldLabel: '空办理人处理',
    })
  }

  if (
    (
      node.type === ProcessNodeType.REPORT_DATA
      || node.type === ProcessNodeType.ADD_DATA
      || node.type === ProcessNodeType.EDIT_DATA
      || node.type === ProcessNodeType.DELETE_DATA
    )
    && message === i18next.t('process.setTargetFormTips')
  ) {
    return buildFlowPlanDiagnostic({
      code: node.type === ProcessNodeType.REPORT_DATA
        ? 'report_data_target_form_missing'
        : node.type === ProcessNodeType.ADD_DATA
          ? 'add_data_target_form_missing'
          : node.type === ProcessNodeType.EDIT_DATA
            ? 'edit_data_target_form_missing'
            : 'delete_data_target_form_missing',
      message: `${formatFlowPlanNodeCompileLocation(compileContext || {
        location: normalizeText(node.title) || normalizeText(node.type) || '流程节点',
        nodeType: node.type as unknown as NocodeEditorFlowPlanNodeType,
      })} 配置不完整：请补充目标表单`,
      runtimeNodeId,
      location: compileContext?.location,
      nodeKey: compileContext?.nodeKey,
      nodeName: compileContext?.nodeName || runtimeNodeName,
      nodeType: compileContext?.nodeType,
      branchKey: compileContext?.branchKey,
      branchLabel: compileContext?.branchLabel,
      fieldKey: node.type === ProcessNodeType.REPORT_DATA ? 'targetTableUID' : 'target',
      fieldLabel: '目标表单',
    })
  }

  return buildFlowPlanDiagnostic({
    code: 'runtime_flow_validate_failed',
    message,
    runtimeNodeId,
    location: compileContext?.location,
    nodeKey: compileContext?.nodeKey,
    nodeName: compileContext?.nodeName || runtimeNodeName,
    nodeType: compileContext?.nodeType,
    branchKey: compileContext?.branchKey,
    branchLabel: compileContext?.branchLabel,
  })
}

const buildUnknownMemberRuntimeDiagnostic = (
  node: ProcessNode,
  flowNodeContextByUid: Map<string, FlowPlanNodeCompileContext>,
): NocodeEditorFlowPlanDiagnostic | null => {
  const unknownMemberText = i18next.t('other.unknowMember')
  const content = normalizeText(node.content)
  if (!unknownMemberText || !content.includes(unknownMemberText)) {
    return null
  }

  const runtimeNodeId = normalizeText(node.uid) || undefined
  const compileContext = runtimeNodeId
    ? flowNodeContextByUid.get(runtimeNodeId)
    : undefined
  const runtimeNodeName = normalizeText(node.title) || undefined
  const location = formatFlowPlanNodeCompileLocation(compileContext || {
    location: normalizeText(node.title) || normalizeText(node.type) || '流程节点',
    nodeType: node.type as unknown as NocodeEditorFlowPlanNodeType,
  })

  if (node.type === ProcessNodeType.APPROVAL) {
    return buildFlowPlanDiagnostic({
      code: 'approval_approver_missing',
      message: `${location} 配置不完整：请补充审批人`,
      runtimeNodeId,
      location: compileContext?.location,
      nodeKey: compileContext?.nodeKey,
      nodeName: compileContext?.nodeName || runtimeNodeName,
      nodeType: compileContext?.nodeType,
      branchKey: compileContext?.branchKey,
      branchLabel: compileContext?.branchLabel,
      fieldKey: 'approver',
      fieldLabel: '审批人',
    })
  }

  if (node.type === ProcessNodeType.TRANSACT) {
    return buildFlowPlanDiagnostic({
      code: 'transact_transactor_missing',
      message: `${location} 配置不完整：请补充办理人`,
      runtimeNodeId,
      location: compileContext?.location,
      nodeKey: compileContext?.nodeKey,
      nodeName: compileContext?.nodeName || runtimeNodeName,
      nodeType: compileContext?.nodeType,
      branchKey: compileContext?.branchKey,
      branchLabel: compileContext?.branchLabel,
      fieldKey: 'transactor',
      fieldLabel: '办理人',
    })
  }

  if (node.type === ProcessNodeType.NOTIFY) {
    return buildFlowPlanDiagnostic({
      code: 'notify_notifier_missing',
      message: `${location} 配置不完整：请补充通知对象`,
      runtimeNodeId,
      location: compileContext?.location,
      nodeKey: compileContext?.nodeKey,
      nodeName: compileContext?.nodeName || runtimeNodeName,
      nodeType: compileContext?.nodeType,
      branchKey: compileContext?.branchKey,
      branchLabel: compileContext?.branchLabel,
      fieldKey: 'notifier',
      fieldLabel: '通知对象',
    })
  }

  if (node.type === ProcessNodeType.REPORT_DATA) {
    return buildFlowPlanDiagnostic({
      code: 'report_data_reporter_missing',
      message: `${location} 配置不完整：请补充填报人`,
      runtimeNodeId,
      location: compileContext?.location,
      nodeKey: compileContext?.nodeKey,
      nodeName: compileContext?.nodeName || runtimeNodeName,
      nodeType: compileContext?.nodeType,
      branchKey: compileContext?.branchKey,
      branchLabel: compileContext?.branchLabel,
      fieldKey: 'reporter',
      fieldLabel: '填报人',
    })
  }

  return null
}

const collectValidationDiagnostics = (
  branch: Branch,
  flowNodeContextByUid: Map<string, FlowPlanNodeCompileContext> = new Map(),
) => {
  const diagnostics: NocodeEditorFlowPlanDiagnostic[] = []
  const visit = (currentBranch: Branch) => {
    currentBranch.nodes.forEach((node) => {
      const unknownMemberDiagnostic = buildUnknownMemberRuntimeDiagnostic(node as ProcessNode, flowNodeContextByUid)
      if (unknownMemberDiagnostic) {
        diagnostics.push(unknownMemberDiagnostic)
      }
      if ((node as ProcessNode).valid === false) {
        const diagnostic = buildRuntimeValidationDiagnostic(node as ProcessNode, flowNodeContextByUid)
        if (diagnostic) {
          diagnostics.push(diagnostic)
        }
      }
      if (node instanceof BranchNode) {
        node.branches.forEach(childBranch => visit(childBranch))
      }
    })
  }
  visit(branch)
  return dedupeFlowDiagnostics(diagnostics)
}

export const applyAiFlowPlan = (
  input: ApplyAiFlowPlanInput,
): ApplyAiFlowPlanResult => {
  const plan = normalizeNocodeEditorFlowPlan((input.plan as Record<string, any>)?.flowPlan || input.plan)
  if (!plan) {
    throw new Error('流程规划缺少标题、摘要或节点结构')
  }

  const currentTable = input.currentTable || null
  ensureSupportedPlan(plan, currentTable)

  const context = createFlowApplyContext({
    ...input,
    plan,
  })

  const startBranches = plan.triggerBranches.map((triggerBranch, index) => ({
    uid: unique(),
    type: ProcessNodeType.START,
    flows: (() => {
      const triggerFlow = buildPlanNodeFlow(
        triggerBranch.triggerNode,
        context,
        `触发分支 ${index + 1} / 触发节点`,
        triggerBranch,
      )
      let previousFlow: ProcessFlow | null = triggerFlow
      return [
        triggerFlow,
        ...triggerBranch.nodes.map((node, nodeIndex) => {
          const flow = buildPlanNodeFlow(
            node,
            context,
            `触发分支 ${index + 1} / 节点 ${nodeIndex + 1}`,
            triggerBranch,
            previousFlow,
          )
          previousFlow = flow
          return flow
        }),
      ]
    })(),
  } satisfies ProcessBranch))

  const flows = buildRuntimeRootFlows(startBranches)

  normalizeNodeReferenceOptions(flows, context)
  normalizeFlowReferenceOptions(flows)
  let optionDiagnostics: NocodeEditorFlowPlanDiagnostic[] = []
  let flowIssueDiagnostics: NocodeEditorFlowPlanDiagnostic[] = []
  try {
    validateCompiledAiFlowOptions(flows, context)
  } catch (error) {
    const compileResult = (error as FlowPlanValidationError | null | undefined)?.flowPlanCompileResult
    const diagnostics = Array.isArray(compileResult?.diagnostics)
      ? compileResult!.diagnostics
      : []
    optionDiagnostics = dedupeFlowDiagnostics(diagnostics)
    const { blocking } = splitFlowPlanDiagnostics(optionDiagnostics)
    if (blocking.length) {
      throw createFlowPlanCompileError(blocking, compileResult?.summary)
    }
  }

  const validationBranch = createValidationBranch(flows, input)
  try {
    const valid = validationBranch.validate()
    const diagnostics = preferSpecificFlowDiagnostics(dedupeFlowDiagnostics([
      ...optionDiagnostics,
      ...collectValidationDiagnostics(validationBranch, context.flowNodeContextByUid),
    ]))
    const { flowIssues, blocking } = splitFlowPlanDiagnostics(diagnostics)
    flowIssueDiagnostics = dedupeFlowDiagnostics(flowIssues)
    if (!valid && blocking.length) {
        const error = collectFirstValidationError(validationBranch, context.flowNodeContextByUid)
        throwFlowPlanCompileError(
          blocking,
          error || blocking[0]?.message || '当前流程规划未通过流程校验',
        )
    }
  } finally {
    validationBranch.destroy()
  }

  return {
    plan,
    flows,
    warnings: context.warnings,
    flowIssues: flowIssueDiagnostics.map(item => buildFlowActionIssue(item, context)),
    flowIssueState: buildFlowIssueState(flowIssueDiagnostics, context),
    summary: {
      triggerBranchCount: countNocodeEditorFlowPlanTriggerBranches(plan.triggerBranches),
      totalNodeCount: countRenderedFlowNodes(flows),
      branchCount: countRenderedBranches(flows),
    },
  }
}

export const inspectRuntimeFlowIssueState = (input: {
  currentFlows?: ProcessFlow[] | null
  currentTable?: Table | null
  tables?: Table[] | null
  formFields?: Field[] | null
  organizeData?: OrganizeData | null
  isEditableSystemField?: (table: Table, field: Field) => boolean
  isFieldRendered?: (table: Table, field: Field) => boolean
}): NocodeEditorAiFlowIssueState | null => {
  const flows = deepClone(asArray<ProcessFlow>(input.currentFlows))
  if (!flows.length) {
    return null
  }

  const context = createFlowApplyContext({
    ...input,
    plan: {} as NocodeEditorFlowPlan,
  })
  registerPersistedNodeIdentities(flows, context)
  let optionDiagnostics: NocodeEditorFlowPlanDiagnostic[] = []

  try {
    validateCompiledAiFlowOptions(flows, context)
  } catch (error) {
    const compileResult = (error as FlowPlanValidationError | null | undefined)?.flowPlanCompileResult
    const diagnostics = Array.isArray(compileResult?.diagnostics)
      ? compileResult!.diagnostics
      : []
    optionDiagnostics = dedupeFlowDiagnostics(diagnostics)
  }

  const validationBranch = createValidationBranch(flows, {
    plan: {},
    currentTable: input.currentTable || null,
    tables: input.tables || [],
    formFields: input.formFields || [],
    organizeData: input.organizeData || null,
  })
  try {
    validationBranch.validate()
    const diagnostics = preferSpecificFlowDiagnostics(dedupeFlowDiagnostics([
      ...optionDiagnostics,
      ...collectValidationDiagnostics(validationBranch, context.flowNodeContextByUid),
    ]))
    const { flowIssues } = splitFlowPlanDiagnostics(diagnostics)
    return buildFlowIssueState(dedupeFlowDiagnostics(flowIssues), context)
  } finally {
    validationBranch.destroy()
  }
}
