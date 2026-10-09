import type {
  NocodeEditorFlowPlanBranch,
  NocodeEditorFlowPlanNode,
  NocodeEditorFlowPlan,
  NocodeEditorFlowPlanTriggerBranch,
  NocodeEditorFlowPlanTriggerNode,
} from './nocodeEditorFlowPlan'
import {
  isNocodeEditorFlowDataChangeType,
  normalizeNocodeEditorFlowPlan,
} from './nocodeEditorFlowPlan'

export type NocodeEditorFlowBlueprintBranch = NocodeEditorFlowPlanBranch
export type NocodeEditorFlowBlueprintNode = NocodeEditorFlowPlanNode
export type NocodeEditorFlowBlueprintTriggerNode = NocodeEditorFlowPlanTriggerNode
export type NocodeEditorFlowBlueprintTriggerBranch = NocodeEditorFlowPlanTriggerBranch

export type NocodeEditorFlowBlueprint = {
  id?: string
  title: string
  summary: string
  target?: {
    formId?: string
    formName?: string
  } | null
  triggerBranches: NocodeEditorFlowBlueprintTriggerBranch[]
}

export type NocodeEditorFlowBlueprintMismatchReason =
  | 'source_scheme_revision_mismatch'
  | 'target_mismatch'
  | 'main_path_drift'
  | 'unexpected_scope_expansion'
  | 'contains_confirmation_semantics'

export type NocodeEditorFlowBlueprintStageResult = {
  revision: number
  stagedAt: number
  sourceSchemeRevision: number
  blueprint: NocodeEditorFlowBlueprint
  mismatchReasons?: NocodeEditorFlowBlueprintMismatchReason[]
}

export type NocodeEditorFlowBlueprintContractDiagnosticCode =
  | 'flow_trigger_change_type_must_be_array'
  | 'flow_trigger_change_type_invalid'
  | 'flow_owner_type_unsupported'
  | 'flow_owner_sources_conflict'
  | 'flow_notify_receivers_unsupported'
  | 'flow_notify_recipients_unsupported'

export type NocodeEditorFlowBlueprintContractDiagnostic = {
  code: NocodeEditorFlowBlueprintContractDiagnosticCode
  message: string
  path: string
  nodeKey?: string
  nodeType?: string
  repairable?: true
}

export type NocodeEditorFlowBlueprintContractValidationResult = {
  valid: boolean
  diagnostics: NocodeEditorFlowBlueprintContractDiagnostic[]
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value ?? '').trim()

const hasOwn = (value: UnknownRecord, key: string) => (
  Object.prototype.hasOwnProperty.call(value, key)
)

const PERSONNEL_OWNER_OPTION_KEYS: Record<string, string> = {
  approval: 'approver',
  transact: 'transactor',
  notify: 'notifier',
  'report-data': 'reporter',
}

const SUPPORTED_DIRECT_OWNER_TYPES = new Set([
  'submitter',
  'user',
  'member',
  'role',
  'department',
  'dept',
  'departmentmanager',
  'multileveldepartmentmanager',
  'formmember',
  'formdepartment',
  'field',
  'formfield',
  'currentformfield',
])

const USER_ARRAY_OWNER_TYPES = new Set([
  'users',
  'fixeduser',
  'fixedusers',
])

const ROLE_ARRAY_OWNER_TYPES = new Set([
  'roles',
  'fixedrole',
  'fixedroles',
])

const normalizeOwnerType = (value: unknown) => (
  normalizeText(value).toLowerCase().replace(/[\s_-]+/g, '')
)

const hasArrayValues = (value: unknown) => (
  Array.isArray(value) && value.length > 0
)

const hasRecordValues = (value: unknown) => (
  isRecord(value) && Object.keys(value).length > 0
)

const isSupportedDirectOwnerType = (
  directType: string,
  owner: UnknownRecord,
) => (
  SUPPORTED_DIRECT_OWNER_TYPES.has(directType)
  || (
    USER_ARRAY_OWNER_TYPES.has(directType)
    && hasArrayValues(owner.users)
  )
  || (
    ROLE_ARRAY_OWNER_TYPES.has(directType)
    && (
      hasArrayValues(owner.roles)
      || hasArrayValues(owner.roleIds)
      || hasArrayValues(owner.roleNames)
    )
  )
)

const collectOwnerSources = (owner: UnknownRecord) => {
  const sources = new Set<string>()
  const directType = normalizeOwnerType(owner.type || owner.ownerType)
  const assignee = isRecord(owner.assignee) ? owner.assignee : {}
  if (owner.submitter === true || directType === 'submitter') {
    sources.add('submitter')
  }
  if (
    hasArrayValues(assignee.users)
    || hasArrayValues(assignee.roles)
    || hasArrayValues(assignee.departments)
    || hasArrayValues(owner.users)
    || hasArrayValues(owner.roles)
    || hasArrayValues(owner.roleIds)
    || hasArrayValues(owner.roleNames)
    || hasArrayValues(owner.departments)
    || ['user', 'member', 'role', 'department', 'dept'].includes(directType)
  ) {
    sources.add('assignee')
  }
  if (
    isRecord(owner['department-manager'])
    || isRecord(owner['multi-level-department-manager'])
    || directType === 'departmentmanager'
    || directType === 'multileveldepartmentmanager'
  ) {
    sources.add('department-manager')
  }
  if (hasArrayValues(owner['form-member']) || directType === 'formmember') {
    sources.add('form-member')
  }
  if (
    hasRecordValues(owner['form-department'])
    || (!isRecord(owner['form-department']) && Boolean(normalizeText(owner['form-department'])))
    || directType === 'formdepartment'
  ) {
    sources.add('form-department')
  }
  if (['field', 'formfield', 'currentformfield'].includes(directType)) {
    sources.add('form-field')
  }
  return {
    directType,
    sources: [...sources],
  }
}

const validateOwnerContract = (input: {
  owner: unknown
  path: string
  node: UnknownRecord
  diagnostics: NocodeEditorFlowBlueprintContractDiagnostic[]
}) => {
  if (!isRecord(input.owner)) {
    return
  }
  const { directType, sources } = collectOwnerSources(input.owner)
  const diagnosticBase = {
    path: input.path,
    nodeKey: normalizeText(input.node.nodeKey) || undefined,
    nodeType: normalizeText(input.node.type) || undefined,
  }
  if (directType && !isSupportedDirectOwnerType(directType, input.owner)) {
    input.diagnostics.push({
      ...diagnosticBase,
      code: 'flow_owner_type_unsupported',
      message: '人员来源 type 不是运行时支持的 owner token。',
      repairable: true,
    })
    return
  }
  if (sources.length > 1) {
    input.diagnostics.push({
      ...diagnosticBase,
      code: 'flow_owner_sources_conflict',
      message: '同一人员 owner 不能同时指定多种人员来源。',
      repairable: true,
    })
  }
}

const validateFlowNodes = (input: {
  nodes: unknown
  path: string
  diagnostics: NocodeEditorFlowBlueprintContractDiagnostic[]
}) => {
  if (!Array.isArray(input.nodes)) {
    return
  }
  input.nodes.forEach((value, index) => {
    if (!isRecord(value)) {
      return
    }
    const nodePath = `${input.path}[${index}]`
    const nodeType = normalizeText(value.type)
    const options = isRecord(value.options) ? value.options : {}
    const ownerOptionKey = PERSONNEL_OWNER_OPTION_KEYS[nodeType]
    if (ownerOptionKey) {
      validateOwnerContract({
        owner: options[ownerOptionKey],
        path: `${nodePath}.options.${ownerOptionKey}`,
        node: value,
        diagnostics: input.diagnostics,
      })
    }
    if (nodeType === 'notify') {
      if (hasOwn(options, 'receivers')) {
        input.diagnostics.push({
          code: 'flow_notify_receivers_unsupported',
          message: '通知节点的正式接收人字段是 notifier，receivers 需要修复。',
          path: `${nodePath}.options.receivers`,
          nodeKey: normalizeText(value.nodeKey) || undefined,
          nodeType,
          repairable: true,
        })
      }
      if (
        hasOwn(options, 'recipients')
        && (
          !Array.isArray(options.recipients)
          || options.recipients.length === 0
          || options.recipients.some(item => typeof item !== 'string' || !item.trim())
        )
      ) {
        input.diagnostics.push({
          code: 'flow_notify_recipients_unsupported',
          message: '通知节点仅兼容表示固定角色 ID 的 recipients:string[]，其他结构请改用 notifier。',
          path: `${nodePath}.options.recipients`,
          nodeKey: normalizeText(value.nodeKey) || undefined,
          nodeType,
          repairable: true,
        })
      }
    }
    if (Array.isArray(value.branches)) {
      value.branches.forEach((branch, branchIndex) => {
        if (!isRecord(branch)) {
          return
        }
        validateFlowNodes({
          nodes: branch.nodes,
          path: `${nodePath}.branches[${branchIndex}].nodes`,
          diagnostics: input.diagnostics,
        })
      })
    }
  })
}

export const validateNocodeEditorFlowBlueprintContract = (
  value: unknown,
): NocodeEditorFlowBlueprintContractValidationResult => {
  const container = isRecord(value) ? value : {}
  const blueprint = isRecord(container.blueprint)
    ? container.blueprint
    : isRecord(container.flowPlan)
      ? container.flowPlan
      : container
  const diagnostics: NocodeEditorFlowBlueprintContractDiagnostic[] = []
  const triggerBranches = Array.isArray(blueprint.triggerBranches)
    ? blueprint.triggerBranches
    : []
  triggerBranches.forEach((branch, branchIndex) => {
    if (!isRecord(branch)) {
      return
    }
    const triggerNode = isRecord(branch.triggerNode) ? branch.triggerNode : {}
    const triggerPath = `triggerBranches[${branchIndex}].triggerNode`
    if (normalizeText(triggerNode.type) === 'trigger-data-change') {
      const options = isRecord(triggerNode.options) ? triggerNode.options : {}
      if (hasOwn(options, 'changeType')) {
        const diagnosticBase = {
          path: `${triggerPath}.options.changeType`,
          nodeKey: normalizeText(triggerNode.nodeKey) || undefined,
          nodeType: 'trigger-data-change',
          repairable: true as const,
        }
        if (!Array.isArray(options.changeType)) {
          diagnostics.push({
            ...diagnosticBase,
            code: 'flow_trigger_change_type_must_be_array',
            message: '数据变化触发器的 changeType 必须是数组，例如 ["add"]。',
          })
        } else if (
          options.changeType.length === 0
          || !options.changeType.every(isNocodeEditorFlowDataChangeType)
        ) {
          diagnostics.push({
            ...diagnosticBase,
            code: 'flow_trigger_change_type_invalid',
            message: '显式 changeType 必须是仅包含 add、edit 或 delete 的非空数组；需要历史新增默认值时请省略该字段。',
          })
        }
      }
    }
    validateFlowNodes({
      nodes: branch.nodes,
      path: `triggerBranches[${branchIndex}].nodes`,
      diagnostics,
    })
  })
  return {
    valid: diagnostics.length === 0,
    diagnostics,
  }
}

export const normalizeNocodeEditorFlowBlueprint = (
  value: unknown,
): NocodeEditorFlowBlueprint | null => {
  if (!isRecord(value)) {
    return null
  }

  const nestedBlueprint = isRecord(value.blueprint)
    ? {
      ...(value.blueprint || {}),
      id: value.blueprint.id || value.id,
      title: value.blueprint.title || value.title,
      summary: value.blueprint.summary || value.summary,
      target: value.blueprint.target || value.target,
      triggerBranches: Array.isArray(value.blueprint.triggerBranches)
        ? value.blueprint.triggerBranches
        : value.triggerBranches,
    }
    : isRecord(value.flowPlan)
      ? {
        ...(value.flowPlan || {}),
        id: value.flowPlan.id || value.id,
        title: value.flowPlan.title || value.title,
        summary: value.flowPlan.summary || value.summary,
        target: value.flowPlan.target || value.target,
        triggerBranches: Array.isArray(value.flowPlan.triggerBranches)
          ? value.flowPlan.triggerBranches
          : value.triggerBranches,
      }
      : value

  const normalizedPlan = normalizeNocodeEditorFlowPlan({
    ...nestedBlueprint,
    openQuestions: [],
  })
  if (!normalizedPlan) {
    return null
  }

  return {
    id: normalizeText(normalizedPlan.id) || undefined,
    title: normalizedPlan.title,
    summary: normalizedPlan.summary,
    target: normalizedPlan.target || null,
    triggerBranches: normalizedPlan.triggerBranches,
  }
}

export const convertNocodeEditorFlowBlueprintToFlowPlan = (
  blueprint: NocodeEditorFlowBlueprint | null | undefined,
): NocodeEditorFlowPlan | null => {
  if (!blueprint) {
    return null
  }

  return normalizeNocodeEditorFlowPlan({
    ...blueprint,
    openQuestions: [],
  })
}
