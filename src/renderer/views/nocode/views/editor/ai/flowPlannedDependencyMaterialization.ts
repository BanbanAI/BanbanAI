import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeConvergence,
  NocodeEditorFlowSchemeDependency,
} from '@common/utils/nocodeEditorFlowScheme'
import type {
  NocodeEditorFlowPlan,
  NocodeEditorFlowPlanBranch,
  NocodeEditorFlowPlanNode,
} from '@common/utils/nocodeEditorFlowPlan'
import { isPlannedFlowSchemeDependency } from '@common/utils/nocodeEditorFlowSchemeGrounding'
import type { NocodeEditorFlowSchemeGroundingDiagnostic } from '@common/utils/nocodeEditorFlowSchemeGrounding'

export type PlannedFlowFieldMaterializationRequest = {
  dependencyId: string
  fieldName: string
  expectedType: string
  targetFormId?: string
  targetFormName?: string
}

export type PlannedFlowFieldMaterializationPlan = {
  requests: PlannedFlowFieldMaterializationRequest[]
  errors: string[]
}

export type PlannedFlowFieldNameConflictResolution = {
  requests: PlannedFlowFieldMaterializationRequest[]
  renamedDependencies: Array<{
    dependencyId: string
    previousFieldName: string
    fieldName: string
  }>
  errors: string[]
}

type AddFieldsResult = {
  created?: Array<Record<string, unknown>>
  failed?: Array<Record<string, unknown>>
} | null | undefined

export type PlannedFlowFieldMaterializationResult = {
  materializedDependencyIds: string[]
  fieldsCreated: string[]
  fieldsReused: string[]
  errors: string[]
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/[\s\-_/\\]+/g, '')

const isSameWidgetType = (left: unknown, right: unknown) => (
  normalizeToken(left) === normalizeToken(right)
)

const isSameTargetForm = (input: {
  dependency: NocodeEditorFlowSchemeDependency
  targetFormId?: string
  targetFormName?: string
}) => {
  const dependencyFormId = normalizeText(input.dependency.targetFormId)
  const dependencyFormName = normalizeText(input.dependency.targetFormName)
  const targetFormId = normalizeText(input.targetFormId)
  const targetFormName = normalizeText(input.targetFormName)

  if (dependencyFormId && targetFormId) {
    return dependencyFormId === targetFormId
  }
  if (dependencyFormName && targetFormName) {
    return normalizeToken(dependencyFormName) === normalizeToken(targetFormName)
  }
  return true
}

const resolveGroundingRequiredFor = (
  diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic,
) => {
  const code = normalizeText(diagnostic.code)
  if (code.includes('write')) return 'writeback'
  if (code.includes('condition')) return 'condition'
  if (code.includes('source_field')) return 'source_mapping'
  if (code.includes('owner')) {
    if (diagnostic.ownerUsage === 'notify_target') return 'notify_target'
    if (diagnostic.ownerUsage === 'approval_owner') return 'approval_owner'
    return 'owner_binding'
  }
  return ''
}

export const partitionFlowGroundingDiagnosticsByPlannedDependencies = <T extends NocodeEditorFlowSchemeGroundingDiagnostic>(input: {
  diagnostics: T[]
  dependencies: NocodeEditorFlowSchemeDependency[]
  targetFormId?: string
  targetFormName?: string
}) => {
  const covered: T[] = []
  const blocking: T[] = []

  input.diagnostics.forEach((diagnostic) => {
    const requiredFor = resolveGroundingRequiredFor(diagnostic)
    const diagnosticFieldName = normalizeText(diagnostic.fieldRef?.fieldName)
    const diagnosticScopeKey = normalizeText(diagnostic.nodeKey || diagnostic.branchKey)
    const diagnosticTargetFormId = normalizeText(diagnostic.targetFormId || input.targetFormId)
    const diagnosticTargetFormName = normalizeText(diagnostic.targetFormName || input.targetFormName)
    const matchingDependencies = input.dependencies.filter((dependency) => {
      if (
        !isPlannedFlowSchemeDependency(dependency)
        || dependency.requiredFor !== requiredFor
        || !isSameTargetForm({
          dependency: {
            ...dependency,
            targetFormId: dependency.targetFormId || input.targetFormId,
            targetFormName: dependency.targetFormName || input.targetFormName,
          },
          targetFormId: diagnosticTargetFormId,
          targetFormName: diagnosticTargetFormName,
        })
      ) {
        return false
      }
      const dependencyFieldName = normalizeText(dependency.fieldRef?.fieldName)
      return Boolean(
        dependencyFieldName
        && diagnosticFieldName
        && normalizeToken(dependencyFieldName) === normalizeToken(diagnosticFieldName)
      )
    })
    const hasExactScopeMatch = matchingDependencies.some((dependency) => {
      const dependencyScopeKey = normalizeText(dependency.scopeKey)
      return !dependencyScopeKey || dependencyScopeKey === diagnosticScopeKey
    })
    // Blueprint generation may rename a node key; only fall back when the semantic dependency is unambiguous.
    const matched = hasExactScopeMatch || matchingDependencies.length === 1
    ;(matched ? covered : blocking).push(diagnostic)
  })

  return { covered, blocking }
}

export const buildPlannedFlowFieldMaterializationPlan = (input: {
  scheme: NocodeEditorFlowScheme
  targetFormId?: string
  targetFormName?: string
}): PlannedFlowFieldMaterializationPlan => {
  const requests: PlannedFlowFieldMaterializationRequest[] = []
  const errors: string[] = []

  ;(input.scheme.dependencies || []).forEach((dependency) => {
    if (
      !isPlannedFlowSchemeDependency(dependency)
      || !['field_missing', 'field_policy_mismatch'].includes(dependency.kind)
    ) {
      return
    }

    if (!isSameTargetForm({
      dependency,
      targetFormId: input.targetFormId,
      targetFormName: input.targetFormName,
    })) {
      errors.push(`依赖「${dependency.summary}」不属于当前流程表单，暂不能自动创建字段`)
      return
    }

    const fieldName = normalizeText(dependency.fieldRef?.fieldName)
    const expectedType = normalizeText(dependency.fieldRef?.expectedType)
    if (!fieldName) {
      errors.push(`依赖「${dependency.summary}」缺少明确的字段名称`)
      return
    }
    if (!expectedType) {
      errors.push(`依赖「${dependency.summary}」缺少明确的组件类型`)
      return
    }

    requests.push({
      dependencyId: dependency.id,
      fieldName,
      expectedType,
      targetFormId: normalizeText(dependency.targetFormId || input.targetFormId) || undefined,
      targetFormName: normalizeText(dependency.targetFormName || input.targetFormName) || undefined,
    })
  })

  return { requests, errors }
}

export const resolvePlannedFlowFieldNameConflicts = (input: {
  requests: PlannedFlowFieldMaterializationRequest[]
  existingFields: Array<{ name: string, widgetType?: string }>
}): PlannedFlowFieldNameConflictResolution => {
  const existingFieldTypeByToken = new Map<string, string>()
  input.existingFields.forEach((field) => {
    const token = normalizeToken(field.name)
    if (token) {
      existingFieldTypeByToken.set(token, normalizeText(field.widgetType))
    }
  })
  const requestGroups = new Map<string, PlannedFlowFieldMaterializationRequest[]>()
  input.requests.forEach((request) => {
    const fieldToken = normalizeToken(request.fieldName)
    requestGroups.set(fieldToken, [
      ...(requestGroups.get(fieldToken) || []),
      request,
    ])
  })
  const errors: string[] = []
  requestGroups.forEach((requests) => {
    const expectedTypes = [...new Set(
      requests.map(request => normalizeToken(request.expectedType)).filter(Boolean),
    )]
    if (expectedTypes.length > 1) {
      errors.push(
        `流程依赖字段「${requests[0].fieldName}」规划了不一致的组件类型：${requests.map(request => request.expectedType).join('、')}`,
      )
    }
  })
  if (errors.length) {
    return {
      requests: input.requests,
      renamedDependencies: [],
      errors,
    }
  }

  const reservedTokens = new Set(input.requests.map(request => normalizeToken(request.fieldName)))
  const renamedDependencies: PlannedFlowFieldNameConflictResolution['renamedDependencies'] = []
  const resolvedFieldNameByToken = new Map<string, string>()
  requestGroups.forEach((requests, requestToken) => {
    const request = requests[0]
    const existingWidgetType = existingFieldTypeByToken.get(requestToken)
    if (!existingWidgetType || isSameWidgetType(existingWidgetType, request.expectedType)) {
      return
    }

    const baseFieldName = `流程${request.fieldName}`
    let suffix = 1
    let fieldName = baseFieldName
    for (;;) {
      const fieldToken = normalizeToken(fieldName)
      const candidateWidgetType = existingFieldTypeByToken.get(fieldToken)
      const isReservedByAnotherRequest = reservedTokens.has(fieldToken)
        && fieldToken !== normalizeToken(request.fieldName)
      if (!candidateWidgetType && !isReservedByAnotherRequest) {
        break
      }
      if (candidateWidgetType && isSameWidgetType(candidateWidgetType, request.expectedType)) {
        break
      }
      suffix += 1
      fieldName = `${baseFieldName}${suffix}`
    }

    reservedTokens.add(normalizeToken(fieldName))
    resolvedFieldNameByToken.set(requestToken, fieldName)
  })
  const requests = input.requests.map((request) => {
    const fieldName = resolvedFieldNameByToken.get(normalizeToken(request.fieldName))
    if (!fieldName) {
      return request
    }
    renamedDependencies.push({
      dependencyId: request.dependencyId,
      previousFieldName: request.fieldName,
      fieldName,
    })
    return { ...request, fieldName }
  })

  return {
    requests,
    renamedDependencies,
    errors,
  }
}

export const PERSONNEL_NODE_OPTION_KEY = {
  approval: 'approver',
  transact: 'transactor',
  notify: 'notifier',
  'report-data': 'reporter',
} as const

type PersonnelNodeType = keyof typeof PERSONNEL_NODE_OPTION_KEY

type PlannedPersonnelFieldBinding = {
  fieldName: string
  ownerType: 'formMember' | 'formDepartment'
  requiredFor: 'approval_owner' | 'notify_target' | 'owner_binding'
}

export type PlannedFlowPersonnelFieldRebaseResult = {
  plan: NocodeEditorFlowPlan
  errors: string[]
}

const PERSONNEL_REQUIRED_NODE_TYPES: Record<PlannedPersonnelFieldBinding['requiredFor'], PersonnelNodeType[]> = {
  approval_owner: ['approval'],
  notify_target: ['notify'],
  owner_binding: ['transact', 'report-data'],
}

const isFormPersonnelOwner = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const owner = value as Record<string, unknown>
  return [
    'field',
    'formfield',
    'currentformfield',
    'formmember',
    'formdepartment',
  ].includes(normalizeToken(owner.type || owner.ownerType))
}

const isPersonnelNodeType = (value: NocodeEditorFlowPlanNode['type']): value is PersonnelNodeType => (
  Object.prototype.hasOwnProperty.call(PERSONNEL_NODE_OPTION_KEY, value)
)

const isNodeTypeRequiredFor = (
  nodeType: NocodeEditorFlowPlanNode['type'],
  requiredFor: PlannedPersonnelFieldBinding['requiredFor'],
) => PERSONNEL_REQUIRED_NODE_TYPES[requiredFor].includes(nodeType as PersonnelNodeType)

const collectPersonnelFieldOwnerNodes = (
  nodes: NocodeEditorFlowPlanNode[],
): NocodeEditorFlowPlanNode[] => nodes.flatMap((node) => {
  const nested = (node.branches || []).flatMap(branch => (
    collectPersonnelFieldOwnerNodes(branch.nodes || [])
  ))
  if (!isPersonnelNodeType(node.type)) {
    return nested
  }
  const owner = node.options?.[PERSONNEL_NODE_OPTION_KEY[node.type]]
  return isFormPersonnelOwner(owner) ? [node, ...nested] : nested
})

const rebasePlannedPersonnelOwnerNodes = (
  nodes: NocodeEditorFlowPlanNode[],
  bindingByNodeKey: Map<string, PlannedPersonnelFieldBinding>,
): NocodeEditorFlowPlanNode[] => nodes.map((node) => {
  const binding = bindingByNodeKey.get(normalizeText(node.nodeKey))
  const optionKey = isPersonnelNodeType(node.type)
    ? PERSONNEL_NODE_OPTION_KEY[node.type]
    : null
  const owner = optionKey ? node.options?.[optionKey] : null
  const ownerRecord = isFormPersonnelOwner(owner)
    ? owner as Record<string, unknown>
    : null
  const ownerWithoutPlannedIds = { ...(ownerRecord || {}) }
  delete ownerWithoutPlannedIds.fieldId
  delete ownerWithoutPlannedIds.fieldUID
  delete ownerWithoutPlannedIds.ownerType
  const options = (
    binding
    && optionKey
    && isNodeTypeRequiredFor(node.type, binding.requiredFor)
    && ownerRecord
  )
    ? {
      ...node.options,
      [optionKey]: {
        ...ownerWithoutPlannedIds,
        type: binding.ownerType,
        fieldName: binding.fieldName,
      },
    }
    : node.options
  const branches = Array.isArray(node.branches)
    ? node.branches.map((branch): NocodeEditorFlowPlanBranch => ({
      ...branch,
      nodes: rebasePlannedPersonnelOwnerNodes(branch.nodes || [], bindingByNodeKey),
    }))
    : node.branches
  return {
    ...node,
    ...(options ? { options } : {}),
    ...(branches ? { branches } : {}),
  }
})

export const rebaseFlowPlanPlannedPersonnelFields = (input: {
  plan: NocodeEditorFlowPlan
  scheme: NocodeEditorFlowScheme
  renamedDependencies: PlannedFlowFieldNameConflictResolution['renamedDependencies']
}): PlannedFlowPersonnelFieldRebaseResult => {
  const renamedFieldNameByDependencyId = new Map(
    input.renamedDependencies.map(item => [normalizeText(item.dependencyId), item.fieldName]),
  )
  const personnelOwnerNodes = collectPersonnelFieldOwnerNodes(
    input.plan.triggerBranches.flatMap(branch => branch.nodes || []),
  )
  const bindingByNodeKey = new Map<string, PlannedPersonnelFieldBinding>()
  const errors: string[] = []
  ;(input.scheme.dependencies || []).forEach((dependency) => {
    if (
      !isPlannedFlowSchemeDependency(dependency)
      || !['approval_owner', 'notify_target', 'owner_binding'].includes(dependency.requiredFor)
    ) {
      return
    }
    const requiredFor = dependency.requiredFor as PlannedPersonnelFieldBinding['requiredFor']
    const fieldName = renamedFieldNameByDependencyId.get(normalizeText(dependency.id))
      || normalizeText(dependency.fieldRef?.fieldName)
    const expectedType = normalizeToken(dependency.fieldRef?.expectedType)
    if (!fieldName || !['memberselect', 'departmentselect'].includes(expectedType)) {
      return
    }
    const binding: PlannedPersonnelFieldBinding = {
      fieldName,
      ownerType: expectedType === 'departmentselect' ? 'formDepartment' : 'formMember',
      requiredFor,
    }
    const nodeKey = normalizeText(dependency.scopeKey)
    if (nodeKey) {
      bindingByNodeKey.set(nodeKey, binding)
      return
    }

    const candidates = personnelOwnerNodes.filter(node => (
      isNodeTypeRequiredFor(node.type, requiredFor)
    ))
    if (candidates.length === 1) {
      bindingByNodeKey.set(normalizeText(candidates[0].nodeKey), binding)
      return
    }
    if (candidates.length > 1) {
      errors.push(`流程依赖「${dependency.summary}」缺少 scopeKey，无法唯一确定人员节点范围`)
    }
  })
  return {
    plan: bindingByNodeKey.size
      ? {
        ...input.plan,
        triggerBranches: input.plan.triggerBranches.map(branch => ({
          ...branch,
          nodes: rebasePlannedPersonnelOwnerNodes(branch.nodes || [], bindingByNodeKey),
        })),
      }
      : input.plan,
    errors,
  }
}

export const rebaseFlowPlanPlannedApprovalOwnerFields = (input: {
  plan: NocodeEditorFlowPlan
  scheme: NocodeEditorFlowScheme
  renamedDependencies: PlannedFlowFieldNameConflictResolution['renamedDependencies']
}): NocodeEditorFlowPlan => rebaseFlowPlanPlannedPersonnelFields({
  ...input,
  scheme: {
    ...input.scheme,
    dependencies: (input.scheme.dependencies || []).filter(dependency => (
      dependency.requiredFor === 'approval_owner'
    )),
  },
}).plan

export const materializePlannedFlowFieldRequests = async (input: {
  requests: PlannedFlowFieldMaterializationRequest[]
  existingFieldNames?: string[]
  existingFields?: Array<{ name: string, widgetType?: string }>
  createFields: (fields: Array<Record<string, unknown>>) => Promise<AddFieldsResult> | AddFieldsResult
}): Promise<PlannedFlowFieldMaterializationResult> => {
  const existingFieldTypeByToken = new Map<string, string>()
  ;(input.existingFieldNames || []).forEach((fieldName) => {
    existingFieldTypeByToken.set(normalizeToken(fieldName), '')
  })
  ;(input.existingFields || []).forEach((field) => {
    existingFieldTypeByToken.set(normalizeToken(field.name), normalizeText(field.widgetType))
  })
  const materializedDependencyIds: string[] = []
  const fieldsCreated: string[] = []
  const fieldsReused: string[] = []
  const errors: string[] = []
  const pendingByFieldToken = new Map<string, PlannedFlowFieldMaterializationRequest[]>()

  const requestsByFieldToken = new Map<string, PlannedFlowFieldMaterializationRequest[]>()
  input.requests.forEach((request) => {
    const fieldToken = normalizeToken(request.fieldName)
    requestsByFieldToken.set(fieldToken, [
      ...(requestsByFieldToken.get(fieldToken) || []),
      request,
    ])
  })
  requestsByFieldToken.forEach((requests) => {
    const expectedTypes = [...new Set(
      requests.map(request => normalizeToken(request.expectedType)).filter(Boolean),
    )]
    if (expectedTypes.length > 1) {
      throw new Error(
        `流程依赖字段「${requests[0].fieldName}」规划了不一致的组件类型：${requests.map(request => request.expectedType).join('、')}`,
      )
    }
  })

  input.requests.forEach((request) => {
    const fieldToken = normalizeToken(request.fieldName)
    if (existingFieldTypeByToken.has(fieldToken)) {
      const existingWidgetType = existingFieldTypeByToken.get(fieldToken) || ''
      if (
        existingWidgetType
        && normalizeToken(existingWidgetType) !== normalizeToken(request.expectedType)
      ) {
        throw new Error(
          `流程依赖字段「${request.fieldName}」已存在，但组件类型「${existingWidgetType}」与期望类型「${request.expectedType}」不兼容`,
        )
      }
      materializedDependencyIds.push(request.dependencyId)
      if (!fieldsReused.includes(request.fieldName)) {
        fieldsReused.push(request.fieldName)
      }
      return
    }
    pendingByFieldToken.set(fieldToken, [
      ...(pendingByFieldToken.get(fieldToken) || []),
      request,
    ])
  })

  const pendingRequests = [...pendingByFieldToken.values()].map(requests => requests[0])
  if (!pendingRequests.length) {
    return {
      materializedDependencyIds,
      fieldsCreated,
      fieldsReused,
      errors,
    }
  }

  const createResult = await input.createFields(pendingRequests.map(request => ({
    requestId: request.dependencyId,
    widgetType: request.expectedType,
    name: request.fieldName,
  })))
  const createdTokens = new Set(
    (createResult?.created || [])
      .map(item => normalizeToken(item.name))
      .filter(Boolean),
  )
  const failed = Array.isArray(createResult?.failed) ? createResult.failed : []
  pendingByFieldToken.forEach((requests, fieldToken) => {
    if (createdTokens.has(fieldToken)) {
      requests.forEach(request => materializedDependencyIds.push(request.dependencyId))
      fieldsCreated.push(requests[0].fieldName)
      return
    }

    const dependencyIds = new Set(requests.map(request => normalizeText(request.dependencyId)))
    const failure = failed.find(item => (
      normalizeToken(item.name) === fieldToken
      || dependencyIds.has(normalizeText(item.requestId))
    ))
    if (failure) {
      const fieldName = normalizeText(failure.name) || requests[0].fieldName
      const reason = normalizeText(failure.error) || '未知错误'
      errors.push(`流程依赖字段「${fieldName}」创建失败：${reason}`)
      return
    }
    errors.push(`流程依赖字段「${requests[0].fieldName}」创建后未返回有效结果`)
  })

  return {
    materializedDependencyIds,
    fieldsCreated,
    fieldsReused,
    errors,
  }
}

const buildConvergence = (
  scheme: NocodeEditorFlowScheme,
  dependencies: NocodeEditorFlowSchemeDependency[],
): NocodeEditorFlowSchemeConvergence => {
  const deferredConfigItems = scheme.deferredConfigItems || []
  const pendingConfirmationCount = (scheme.confirmation?.questions || [])
    .filter(question => question.confirmed !== true)
    .length
  const unresolvedQuestionCount = Math.max(
    scheme.openQuestions.length,
    pendingConfirmationCount,
  )
  const unresolvedDependencyCount = dependencies
    .filter(dependency => dependency.resolutionStatus !== 'resolved')
    .length
  const plannedDependencyCount = dependencies
    .filter(dependency => isPlannedFlowSchemeDependency(dependency))
    .length

  return {
    businessStatus: unresolvedQuestionCount > 0 ? 'pending' : 'resolved',
    dependencyStatus: unresolvedDependencyCount > 0 ? 'pending' : 'resolved',
    materializationStatus: plannedDependencyCount > 0
      ? 'has_planned_dependencies'
      : 'all_existing',
    unresolvedQuestionCount,
    unresolvedDependencyCount,
    plannedDependencyCount,
    requiredDeferredConfigCount: deferredConfigItems
      .filter(item => item.requirementLevel === 'required')
      .length,
    optionalDeferredConfigCount: deferredConfigItems
      .filter(item => item.requirementLevel === 'optional')
      .length,
    deferredConfigItemCount: deferredConfigItems.length,
  }
}

export const markFlowDependenciesMaterialized = (
  scheme: NocodeEditorFlowScheme,
  dependencyIds: string[],
): NocodeEditorFlowScheme => {
  const materializedIds = new Set(dependencyIds.map(normalizeText).filter(Boolean))
  const dependencies = (scheme.dependencies || []).map(dependency => (
    materializedIds.has(normalizeText(dependency.id))
      ? {
        ...dependency,
        resolutionMode: dependency.resolutionMode === 'create_later'
          ? 'use_existing' as const
          : dependency.resolutionMode,
        materializationStatus: 'existing' as const,
      }
      : dependency
  ))

  return {
    ...scheme,
    dependencies,
    convergence: buildConvergence(scheme, dependencies),
  }
}
