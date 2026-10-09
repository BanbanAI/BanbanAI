import type {
  NocodeEditorFlowPlan,
  NocodeEditorFlowPlanNode,
} from '@common/utils/nocodeEditorFlowPlan'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
  NocodeEditorFlowSchemeStep,
} from '@common/utils/nocodeEditorFlowScheme'
import type { NocodeEditorFlowPersonnelSourceType } from '@common/utils/nocodeEditorFlowPersonnel'
import {
  validateFlowBlueprintApprovalOwnerDependencies,
  type FlowBlueprintApprovalOwnerPreflightDiagnostic,
} from './flowBlueprintApprovalOwnerPreflight'

type UnknownRecord = Record<string, unknown>

type PersonnelNodeType = 'approval' | 'transact' | 'notify' | 'report-data'

type PersonnelFieldSourceType = Extract<
  NocodeEditorFlowPersonnelSourceType,
  'form_member' | 'form_department'
>

type SummaryField = {
  fieldId: string
  fieldName: string
  ownerPolicy: string
  subFields: SummaryField[]
}

type SummaryForm = {
  tableId: string
  tableName: string
  fields: SummaryField[]
}

type BlueprintPersonnelOwner = {
  sources: NocodeEditorFlowPersonnelSourceType[]
  genericFormField: boolean
  fieldIds: string[]
  fieldName: string
}

const PERSONNEL_NODE_METADATA: Record<PersonnelNodeType, {
  stepKind: NocodeEditorFlowSchemeStep['kind']
  optionKey: 'approver' | 'transactor' | 'notifier' | 'reporter'
  requiredFor: 'approval_owner' | 'owner_binding' | 'notify_target'
}> = {
  approval: {
    stepKind: 'approval',
    optionKey: 'approver',
    requiredFor: 'approval_owner',
  },
  transact: {
    stepKind: 'transact',
    optionKey: 'transactor',
    requiredFor: 'owner_binding',
  },
  notify: {
    stepKind: 'notify',
    optionKey: 'notifier',
    requiredFor: 'notify_target',
  },
  'report-data': {
    stepKind: 'report-data',
    optionKey: 'reporter',
    requiredFor: 'owner_binding',
  },
}

export type FlowPersonnelBlueprintDiagnostic = {
  code:
    | 'flow_personnel_source_mismatch'
    | 'flow_personnel_field_invalid'
    | 'flow_personnel_target_context_mismatch'
  message: string
  nodeKey?: string
  nodeName?: string
  expectedSourceType?: NocodeEditorFlowPersonnelSourceType
  actualSourceType?: NocodeEditorFlowPersonnelSourceType
  expectedFieldId?: string
  expectedFieldName?: string
  actualFieldId?: string
  actualFieldName?: string
}

export type FlowPersonnelBlueprintPreflightResult = {
  diagnostics: Array<
    FlowPersonnelBlueprintDiagnostic
    | FlowBlueprintApprovalOwnerPreflightDiagnostic
  >
  requiresBlueprintRegeneration: boolean
  requiresUserConfirmation: false
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLocaleLowerCase()
  .replace(/[\s\-_/\\]+/g, '')

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const isSameToken = (left: unknown, right: unknown) => {
  const normalizedLeft = normalizeToken(left)
  const normalizedRight = normalizeToken(right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

const hasOwn = (value: UnknownRecord, key: string) => (
  Object.prototype.hasOwnProperty.call(value, key)
)

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(normalizeText).filter(Boolean)
    : []
)

const collectSummaryFields = (value: unknown): SummaryField[] => {
  if (!isRecord(value)) {
    return []
  }
  const fieldId = normalizeText(value.fieldId || value.uid || value.id)
  const fieldName = normalizeText(value.fieldName || value.name || value.label)
  if (!fieldId && !fieldName) {
    return []
  }
  return [{
    fieldId,
    fieldName,
    ownerPolicy: normalizeText(value.ownerPolicy),
    subFields: Array.isArray(value.subFields)
      ? value.subFields.flatMap(collectSummaryFields)
      : [],
  }]
}

const flattenSummaryFields = (fields: SummaryField[]): SummaryField[] => fields.flatMap(field => [
  field,
  ...flattenSummaryFields(field.subFields),
])

const normalizeSummaryForm = (value: unknown): SummaryForm | null => {
  if (!isRecord(value)) {
    return null
  }
  const tableId = normalizeText(value.tableId || value.uid || value.id)
  const tableName = normalizeText(value.tableName || value.name || value.alias)
  if (!tableId && !tableName) {
    return null
  }
  const fieldValues = [
    ...(Array.isArray(value.fields) ? value.fields : []),
    ...(Array.isArray(value.memberFields) ? value.memberFields : []),
    ...(Array.isArray(value.departmentFields) ? value.departmentFields : []),
  ]
  return {
    tableId,
    tableName,
    fields: fieldValues.flatMap(collectSummaryFields),
  }
}

const resolveSummaryForms = (flowSummary: unknown) => {
  const summary = isRecord(flowSummary) ? flowSummary : {}
  const formsRecord = isRecord(summary.forms) ? summary.forms : {}
  const currentForm = normalizeSummaryForm(formsRecord.currentForm)
  const availableForms = Array.isArray(formsRecord.availableForms)
    ? formsRecord.availableForms
      .map(normalizeSummaryForm)
      .filter((form): form is SummaryForm => Boolean(form))
    : []
  return {
    currentForm,
    forms: [
      ...(currentForm ? [currentForm] : []),
      ...availableForms,
    ],
  }
}

const isSameFormIdentity = (input: {
  leftId?: unknown
  leftName?: unknown
  rightId?: unknown
  rightName?: unknown
}) => {
  const leftId = normalizeText(input.leftId)
  const rightId = normalizeText(input.rightId)
  if (leftId && rightId) {
    return leftId === rightId
  }
  const leftName = normalizeText(input.leftName)
  const rightName = normalizeText(input.rightName)
  return !leftName || !rightName || isSameToken(leftName, rightName)
}

const hasTargetContextMismatch = (input: {
  plan: NocodeEditorFlowPlan
  scheme: NocodeEditorFlowScheme
  currentForm: SummaryForm | null
}) => {
  if (!isSameFormIdentity({
    leftId: input.plan.target?.formId,
    leftName: input.plan.target?.formName,
    rightId: input.scheme.target?.formId,
    rightName: input.scheme.target?.formName,
  })) {
    return true
  }
  if (!input.currentForm) {
    return false
  }
  return !isSameFormIdentity({
    leftId: input.scheme.target?.formId,
    leftName: input.scheme.target?.formName,
    rightId: input.currentForm.tableId,
    rightName: input.currentForm.tableName,
  })
}

const isPersonnelNodeType = (value: NocodeEditorFlowPlanNode['type']): value is PersonnelNodeType => (
  Object.prototype.hasOwnProperty.call(PERSONNEL_NODE_METADATA, value)
)

const collectPersonnelNodes = (nodes: NocodeEditorFlowPlanNode[]): NocodeEditorFlowPlanNode[] => (
  nodes.flatMap(node => [
    ...(isPersonnelNodeType(node.type) ? [node] : []),
    ...(node.branches || []).flatMap(branch => collectPersonnelNodes(branch.nodes || [])),
  ])
)

const getSchemeSteps = (scheme: NocodeEditorFlowScheme) => [
  ...(scheme.mainPath || []),
  ...(scheme.branches || []).flatMap(branch => branch.steps || []),
]

const resolvePersonnelStepNodeType = (
  step: NocodeEditorFlowSchemeStep,
): PersonnelNodeType | null => {
  const entry = Object.entries(PERSONNEL_NODE_METADATA).find(([, metadata]) => (
    metadata.stepKind === step.kind
  ))
  return entry?.[0] as PersonnelNodeType || null
}

const matchPersonnelNodesToSchemeSteps = (input: {
  scheme: NocodeEditorFlowScheme
  nodes: NocodeEditorFlowPlanNode[]
}) => {
  const schemeSteps = getSchemeSteps(input.scheme)
  const steps = schemeSteps.filter(step => (
    Boolean(step.personnelRequirement)
    && Boolean(resolvePersonnelStepNodeType(step))
  ))
  const hasApprovalPersonnelContract = steps.some(step => step.kind === 'approval')
  const legacyApprovalStepKeys = new Set(
    schemeSteps
      .filter(step => step.kind === 'approval' && !step.personnelRequirement)
      .map(step => normalizeText(step.key))
      .filter(Boolean),
  )
  const nodes = collectPersonnelNodes(input.nodes).filter(node => (
    node.type !== 'approval'
    || (
      !legacyApprovalStepKeys.has(normalizeText(node.nodeKey))
      && hasApprovalPersonnelContract
    )
  ))
  const matchedNodeIndexes = new Set<number>()
  const matchedStepIndexes = new Set<number>()
  const matches: Array<{
    nodeIndex: number
    node: NocodeEditorFlowPlanNode
    step: NocodeEditorFlowSchemeStep
  }> = []

  const addMatch = (nodeIndex: number, stepIndex: number) => {
    matchedNodeIndexes.add(nodeIndex)
    matchedStepIndexes.add(stepIndex)
    matches.push({ nodeIndex, node: nodes[nodeIndex], step: steps[stepIndex] })
  }

  nodes.forEach((node, nodeIndex) => {
    const exactStepIndexes = steps.flatMap((step, stepIndex) => (
      !matchedStepIndexes.has(stepIndex)
      && resolvePersonnelStepNodeType(step) === node.type
      && normalizeText(step.key) === normalizeText(node.nodeKey)
        ? [stepIndex]
        : []
    ))
    if (exactStepIndexes.length === 1) {
      addMatch(nodeIndex, exactStepIndexes[0])
    }
  })

  nodes.forEach((node, nodeIndex) => {
    if (matchedNodeIndexes.has(nodeIndex)) {
      return
    }
    const compatibleStepIndexes = steps.flatMap((step, stepIndex) => (
      !matchedStepIndexes.has(stepIndex)
      && resolvePersonnelStepNodeType(step) === node.type
        ? [stepIndex]
        : []
    ))
    if (compatibleStepIndexes.length === 1) {
      addMatch(nodeIndex, compatibleStepIndexes[0])
    }
  })

  return {
    matches: matches.sort((left, right) => left.nodeIndex - right.nodeIndex),
    unmatchedNodes: nodes.filter((_, index) => !matchedNodeIndexes.has(index)),
    unmatchedSteps: steps.filter((_, index) => !matchedStepIndexes.has(index)),
  }
}

const resolveFieldByReference = (
  fields: SummaryField[],
  fieldId: string,
  fieldName: string,
) => {
  const flattenedFields = flattenSummaryFields(fields)
  return flattenedFields.find(field => Boolean(fieldId) && field.fieldId === fieldId)
    || flattenedFields.find(field => !fieldId && Boolean(fieldName) && isSameToken(field.fieldName, fieldName))
    || null
}

const resolveOwnerFieldReference = (owner: UnknownRecord) => {
  const runtimeMemberIds = hasOwn(owner, 'form-member')
    ? normalizeStringList(owner['form-member'])
    : []
  const runtimeDepartment = owner['form-department']
  const runtimeDepartmentId = isRecord(runtimeDepartment)
    ? normalizeText(runtimeDepartment.value || runtimeDepartment.fieldId || runtimeDepartment.fieldName)
    : normalizeText(runtimeDepartment)
  return {
    fieldIds: runtimeMemberIds.length
      ? runtimeMemberIds
      : [runtimeDepartmentId || normalizeText(owner.fieldId || owner.fieldUID || owner.uid || owner.id)]
        .filter(Boolean),
    fieldName: normalizeText(owner.fieldName || owner.name || owner.alias || owner.label),
  }
}

const resolveBlueprintPersonnelOwner = (
  value: unknown,
  targetForm: SummaryForm | null,
): BlueprintPersonnelOwner => {
  const owner = isRecord(value) ? value : {}
  const type = normalizeToken(owner.type || owner.ownerType)
  const sources = new Set<NocodeEditorFlowPersonnelSourceType>()
  let genericFormField = false

  if (owner.submitter === true || type === 'submitter') {
    sources.add('submitter')
  }
  if (type === 'submittermanager') {
    sources.add('submitter_manager')
  }
  if (
    hasOwn(owner, 'department-manager')
    || hasOwn(owner, 'multi-level-department-manager')
    || type === 'departmentmanager'
    || type === 'multileveldepartmentmanager'
  ) {
    sources.add('department_manager')
  }

  const assignee = isRecord(owner.assignee) ? owner.assignee : {}
  const hasUserValues = [assignee.users, owner.users, owner.userIds]
    .some(candidate => Array.isArray(candidate) && candidate.length > 0)
  const hasRoleValues = [assignee.roles, owner.roles, owner.roleIds]
    .some(candidate => Array.isArray(candidate) && candidate.length > 0)
  const hasUserSignal = hasOwn(assignee, 'users')
    || hasOwn(owner, 'users')
    || hasOwn(owner, 'userIds')
  const hasRoleSignal = hasOwn(assignee, 'roles')
    || hasOwn(owner, 'roles')
    || hasOwn(owner, 'roleIds')
  if (
    hasUserValues
    || (!hasRoleValues && hasUserSignal && !hasRoleSignal)
    || ['fixedusers', 'user', 'users', 'member'].includes(type)
  ) {
    sources.add('fixed_users')
  }
  if (
    hasRoleValues
    || (!hasUserValues && hasRoleSignal && !hasUserSignal)
    || ['fixedroles', 'role', 'roles'].includes(type)
  ) {
    sources.add('fixed_roles')
  }

  if (hasOwn(owner, 'form-member') || type === 'formmember') {
    sources.add('form_member')
  }
  if (hasOwn(owner, 'form-department') || type === 'formdepartment') {
    sources.add('form_department')
  }
  if (['field', 'formfield', 'currentformfield'].includes(type)) {
    genericFormField = true
    const reference = resolveOwnerFieldReference(owner)
    const field = resolveFieldByReference(
      targetForm?.fields || [],
      reference.fieldIds[0] || '',
      reference.fieldName,
    )
    if (field?.ownerPolicy === 'member') {
      sources.add('form_member')
    } else if (field?.ownerPolicy === 'department') {
      sources.add('form_department')
    }
  }

  const reference = resolveOwnerFieldReference(owner)
  return {
    sources: [...sources],
    genericFormField,
    ...reference,
  }
}

const resolvePersonnelDependency = (input: {
  scheme: NocodeEditorFlowScheme
  node: NocodeEditorFlowPlanNode
  scopeKey?: string
}) => {
  if (!isPersonnelNodeType(input.node.type)) {
    return null
  }
  const requiredFor = PERSONNEL_NODE_METADATA[input.node.type].requiredFor
  const dependencies = (input.scheme.dependencies || []).filter(dependency => (
    dependency.requiredFor === requiredFor
  ))
  const stepDependencies = dependencies.filter(dependency => (
    dependency.scopeKind === 'step'
    && normalizeText(dependency.scopeKey) === normalizeText(input.scopeKey || input.node.nodeKey)
  ))
  if (stepDependencies.length === 1) {
    return stepDependencies[0]
  }
  const globalDependencies = dependencies.filter(dependency => dependency.scopeKind === 'global')
  return stepDependencies.length === 0 && globalDependencies.length === 1
    ? globalDependencies[0]
    : null
}

const resolveTargetForm = (
  scheme: NocodeEditorFlowScheme,
  forms: SummaryForm[],
) => forms.find(form => (
  normalizeText(scheme.target?.formId)
  && form.tableId === normalizeText(scheme.target?.formId)
)) || forms.find(form => (
  normalizeText(scheme.target?.formName)
  && isSameToken(form.tableName, scheme.target?.formName)
)) || null

const isExpectedFieldType = (
  value: unknown,
  sourceType: PersonnelFieldSourceType,
) => normalizeToken(value) === (
  sourceType === 'form_member' ? 'memberselect' : 'departmentselect'
)

const isDependencyTargetMismatch = (input: {
  dependency: NocodeEditorFlowSchemeDependency
  scheme: NocodeEditorFlowScheme
  targetForm: SummaryForm | null
}) => {
  const targetId = normalizeText(input.dependency.targetFormId)
  const targetName = normalizeText(input.dependency.targetFormName)
  if (!targetId && !targetName) {
    return false
  }
  if (!isSameFormIdentity({
    leftId: targetId,
    leftName: targetName,
    rightId: input.scheme.target?.formId,
    rightName: input.scheme.target?.formName,
  })) {
    return true
  }
  return Boolean(input.targetForm && !isSameFormIdentity({
    leftId: targetId,
    leftName: targetName,
    rightId: input.targetForm.tableId,
    rightName: input.targetForm.tableName,
  }))
}

const validatePersonnelField = (input: {
  node: NocodeEditorFlowPlanNode
  step: NocodeEditorFlowSchemeStep
  scheme: NocodeEditorFlowScheme
  sourceType: PersonnelFieldSourceType
  owner: BlueprintPersonnelOwner
  targetForm: SummaryForm | null
}): FlowPersonnelBlueprintDiagnostic | null => {
  const dependency = resolvePersonnelDependency({
    scheme: input.scheme,
    node: input.node,
    scopeKey: input.step.key,
  })
  const expectedFieldId = normalizeText(input.step.personnelRequirement?.fieldRef?.fieldId)
  const expectedFieldName = normalizeText(input.step.personnelRequirement?.fieldRef?.fieldName)
  const baseDiagnostic = {
    nodeKey: normalizeText(input.node.nodeKey) || undefined,
    nodeName: normalizeText(input.node.name) || normalizeText(input.step.title) || undefined,
    expectedSourceType: input.sourceType,
    expectedFieldId: expectedFieldId || undefined,
    expectedFieldName: expectedFieldName || undefined,
    actualFieldId: input.owner.fieldIds[0] || undefined,
    actualFieldName: input.owner.fieldName || undefined,
  }
  if (!dependency) {
    return {
      ...baseDiagnostic,
      code: 'flow_personnel_field_invalid',
      message: '表单人员来源缺少与当前节点对应的已收敛字段依赖。',
    }
  }
  if (isDependencyTargetMismatch({
    dependency,
    scheme: input.scheme,
    targetForm: input.targetForm,
  })) {
    return {
      ...baseDiagnostic,
      code: 'flow_personnel_target_context_mismatch',
      message: '人员字段依赖不属于当前流程目标表单。',
    }
  }

  const dependencyFieldId = normalizeText(dependency.fieldRef?.fieldId)
  const dependencyFieldName = normalizeText(dependency.fieldRef?.fieldName)
  const requirementMatchesDependency = Boolean(
    isExpectedFieldType(dependency.fieldRef?.expectedType, input.sourceType)
    && (!expectedFieldId || expectedFieldId === dependencyFieldId)
    && (!expectedFieldName || isSameToken(expectedFieldName, dependencyFieldName))
  )
  const isExisting = (
    dependency.resolutionStatus === 'resolved'
    && dependency.resolutionMode === 'use_existing'
    && dependency.materializationStatus === 'existing'
  )
  const isPlanned = (
    dependency.resolutionStatus === 'resolved'
    && dependency.resolutionMode === 'create_later'
    && dependency.materializationStatus === 'planned'
  )
  if (!requirementMatchesDependency || (!isExisting && !isPlanned)) {
    return {
      ...baseDiagnostic,
      code: 'flow_personnel_field_invalid',
      message: '人员字段依赖的字段类型或物化状态与流程方案不一致。',
    }
  }

  if (isPlanned) {
    if (
      input.owner.fieldIds.length > 0
      || !dependencyFieldName
      || !isSameToken(input.owner.fieldName, dependencyFieldName)
    ) {
      return {
        ...baseDiagnostic,
        code: 'flow_personnel_field_invalid',
        message: '计划新增的人员字段尚未物化，蓝图只能引用已收敛的字段名。',
      }
    }
    return null
  }

  if (input.owner.fieldIds.length > 1 || !input.targetForm) {
    return {
      ...baseDiagnostic,
      code: 'flow_personnel_field_invalid',
      message: '复用人员字段时缺少当前目标表单的唯一字段证据。',
    }
  }
  const field = resolveFieldByReference(
    input.targetForm.fields,
    input.owner.fieldIds[0] || '',
    input.owner.fieldName,
  )
  const expectedPolicy = input.sourceType === 'form_member' ? 'member' : 'department'
  const matchesDependency = Boolean(
    field
    && field.ownerPolicy === expectedPolicy
    && (!dependencyFieldId || field.fieldId === dependencyFieldId)
    && (!dependencyFieldName || isSameToken(field.fieldName, dependencyFieldName))
  )
  if (!matchesDependency) {
    return {
      ...baseDiagnostic,
      code: 'flow_personnel_field_invalid',
      message: '蓝图引用的人员字段不具备方案要求的人员字段能力。',
    }
  }
  return null
}

export const validateFlowBlueprintPersonnelRequirements = (input: {
  plan: NocodeEditorFlowPlan
  scheme: NocodeEditorFlowScheme
  flowSummary?: unknown
}): FlowPersonnelBlueprintPreflightResult => {
  const approvalPreflight = validateFlowBlueprintApprovalOwnerDependencies(input)
  const diagnostics: FlowPersonnelBlueprintPreflightResult['diagnostics'] = []
  const validatedPlannedDepartmentApprovalNodeKeys = new Set<string>()
  const validatedRenamedApprovalOwnerNodeKeys = new Set<string>()
  const summaryForms = resolveSummaryForms(input.flowSummary)
  if (hasTargetContextMismatch({
    plan: input.plan,
    scheme: input.scheme,
    currentForm: summaryForms.currentForm,
  })) {
    diagnostics.push(...approvalPreflight.diagnostics)
    diagnostics.push({
      code: 'flow_personnel_target_context_mismatch',
      message: '流程蓝图、流程方案与当前目标表单上下文不一致。',
    })
    return {
      diagnostics,
      requiresBlueprintRegeneration: true,
      requiresUserConfirmation: false,
    }
  }

  const targetForm = resolveTargetForm(input.scheme, summaryForms.forms)
  const personnelMatches = matchPersonnelNodesToSchemeSteps({
    scheme: input.scheme,
    nodes: input.plan.triggerBranches.flatMap(branch => branch.nodes || []),
  })
  personnelMatches.matches.forEach(({ node, step }) => {
    const expectedSourceType = step.personnelRequirement!.sourceType
    const metadata = PERSONNEL_NODE_METADATA[node.type as PersonnelNodeType]
    const owner = resolveBlueprintPersonnelOwner(node.options?.[metadata.optionKey], targetForm)
    const actualSources = owner.sources.length
      ? owner.sources
      : owner.genericFormField && (
        expectedSourceType === 'form_member' || expectedSourceType === 'form_department'
      )
        ? [expectedSourceType]
        : []
    if (actualSources.length !== 1 || actualSources[0] !== expectedSourceType) {
      diagnostics.push({
        code: 'flow_personnel_source_mismatch',
        message: '流程蓝图中的人员来源与已收敛流程方案不一致。',
        nodeKey: normalizeText(node.nodeKey) || undefined,
        nodeName: normalizeText(node.name) || normalizeText(step.title) || undefined,
        expectedSourceType,
        actualSourceType: actualSources.length === 1 ? actualSources[0] : 'unresolved',
      })
      return
    }
    if (expectedSourceType === 'form_member' || expectedSourceType === 'form_department') {
      const fieldDiagnostic = validatePersonnelField({
        node,
        step,
        scheme: input.scheme,
        sourceType: expectedSourceType,
        owner,
        targetForm,
      })
      if (fieldDiagnostic) {
        diagnostics.push(fieldDiagnostic)
        return
      }
      if (node.type === 'approval') {
        if (normalizeText(node.nodeKey) !== normalizeText(step.key)) {
          validatedRenamedApprovalOwnerNodeKeys.add(normalizeText(node.nodeKey))
        }
        if (expectedSourceType === 'form_department') {
          const dependency = resolvePersonnelDependency({
            scheme: input.scheme,
            node,
            scopeKey: step.key,
          })
          if (
            dependency?.resolutionStatus === 'resolved'
            && dependency.resolutionMode === 'create_later'
            && dependency.materializationStatus === 'planned'
          ) {
            validatedPlannedDepartmentApprovalNodeKeys.add(normalizeText(node.nodeKey))
          }
        }
      }
    }
  })

  personnelMatches.unmatchedNodes.forEach((node) => {
    const metadata = PERSONNEL_NODE_METADATA[node.type as PersonnelNodeType]
    const owner = resolveBlueprintPersonnelOwner(node.options?.[metadata.optionKey], targetForm)
    diagnostics.push({
      code: 'flow_personnel_source_mismatch',
      message: '流程蓝图中的人员节点没有唯一对应的已收敛方案步骤。',
      nodeKey: normalizeText(node.nodeKey) || undefined,
      nodeName: normalizeText(node.name) || undefined,
      actualSourceType: owner.sources.length === 1 ? owner.sources[0] : 'unresolved',
    })
  })

  personnelMatches.unmatchedSteps.forEach((step) => {
    diagnostics.push({
      code: 'flow_personnel_source_mismatch',
      message: '已收敛流程方案中的人员步骤在流程蓝图中缺失。',
      nodeKey: normalizeText(step.key) || undefined,
      nodeName: normalizeText(step.title) || undefined,
      expectedSourceType: step.personnelRequirement!.sourceType,
      actualSourceType: 'unresolved',
    })
  })

  diagnostics.unshift(...approvalPreflight.diagnostics.filter(diagnostic => !(
    (
      diagnostic.code === 'blueprint_approval_owner_dependency_invalid'
      && validatedPlannedDepartmentApprovalNodeKeys.has(normalizeText(diagnostic.nodeKey))
    )
    || (
      diagnostic.code === 'blueprint_approval_owner_dependency_missing'
      && validatedRenamedApprovalOwnerNodeKeys.has(normalizeText(diagnostic.nodeKey))
    )
  )))

  return {
    diagnostics,
    requiresBlueprintRegeneration: diagnostics.length > 0,
    requiresUserConfirmation: false,
  }
}
