import type {
  NocodeEditorFlowPlan,
  NocodeEditorFlowPlanNode,
} from '@common/utils/nocodeEditorFlowPlan'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
} from '@common/utils/nocodeEditorFlowScheme'

type UnknownRecord = Record<string, unknown>

type FlowSummaryOwnerField = {
  fieldId: string
  fieldName: string
  ownerPolicy: string
  subFields?: FlowSummaryOwnerField[]
}

type FlowSummaryTarget = {
  tableId: string
  tableName: string
  fields: FlowSummaryOwnerField[]
}

type ApprovalOwnerReferenceKind =
  | 'form_member'
  | 'form_department'
  | 'non_field'
  | 'missing'

type ApprovalOwnerFieldKind = 'member' | 'department'

export type FlowBlueprintApprovalOwnerPreflightDiagnostic = {
  code:
    | 'blueprint_approval_owner_target_context_mismatch'
    | 'blueprint_approval_owner_dependency_missing'
    | 'blueprint_approval_owner_dependency_invalid'
    | 'blueprint_approval_owner_dependency_mismatch'
    | 'blueprint_approval_owner_existing_field_invalid'
    | 'blueprint_approval_owner_planned_field_id_forbidden'
    | 'blueprint_contains_confirmation_semantics'
  message: string
  nodeKey?: string
  nodeName?: string
  expectedFieldId?: string
  expectedFieldName?: string
  actualFieldId?: string
  actualFieldName?: string
}

export type FlowBlueprintApprovalOwnerPreflightResult = {
  diagnostics: FlowBlueprintApprovalOwnerPreflightDiagnostic[]
  requiresBlueprintRegeneration: boolean
  requiresUserConfirmation: false
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
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

const collectSummaryFields = (value: unknown): FlowSummaryOwnerField[] => {
  if (!isRecord(value)) {
    return []
  }
  const fieldId = normalizeText(value.fieldId)
  const fieldName = normalizeText(value.fieldName)
  if (!fieldId || !fieldName) {
    return []
  }
  const subFields = Array.isArray(value.subFields)
    ? value.subFields.flatMap(collectSummaryFields)
    : []
  return [{
    fieldId,
    fieldName,
    ownerPolicy: normalizeText(value.ownerPolicy),
    ...(subFields.length ? { subFields } : {}),
  }]
}

const flattenFields = (fields: FlowSummaryOwnerField[]) => fields.flatMap(field => [
  field,
  ...flattenFields(field.subFields || []),
])

const resolveCurrentTarget = (flowSummary: unknown): FlowSummaryTarget | null => {
  if (!isRecord(flowSummary) || !isRecord(flowSummary.forms) || !isRecord(flowSummary.forms.currentForm)) {
    return null
  }
  const currentForm = flowSummary.forms.currentForm
  const tableId = normalizeText(currentForm.tableId)
  const tableName = normalizeText(currentForm.tableName)
  if (!tableId && !tableName) {
    return null
  }
  return {
    tableId,
    tableName,
    fields: Array.isArray(currentForm.fields)
      ? currentForm.fields.flatMap(collectSummaryFields)
      : [],
  }
}

const collectApprovalNodes = (nodes: NocodeEditorFlowPlanNode[]) => nodes.flatMap((node) => [
  ...(node.type === 'approval' ? [node] : []),
  ...(node.branches || []).flatMap(branch => collectApprovalNodes(branch.nodes || [])),
])

const resolveApprovalOwnerReference = (
  node: NocodeEditorFlowPlanNode,
  target: FlowSummaryTarget | null = null,
) => {
  const approver = isRecord(node.options?.approver)
    ? node.options!.approver
    : {}
  const type = normalizeToken(approver.type || approver.ownerType)
  const runtimeMemberFieldValue = approver['form-member']
  const runtimeMemberFieldIds = Array.isArray(runtimeMemberFieldValue)
    ? runtimeMemberFieldValue.map(normalizeText)
    : null
  const hasRuntimeMemberFieldIds = runtimeMemberFieldIds !== null
  const runtimeDepartmentField = isRecord(approver['form-department'])
    ? normalizeText(
      approver['form-department'].value
      || approver['form-department'].fieldId
      || approver['form-department'].fieldName,
    )
    : normalizeText(approver['form-department'])
  const directFieldId = normalizeText(approver.fieldId || approver.fieldUID || approver.uid || approver.id)
  const directFieldName = normalizeText(approver.fieldName || approver.name || approver.alias || approver.label)
  const directField = flattenFields(target?.fields || []).find(field => (
    (directFieldId && field.fieldId === directFieldId)
    || (!directFieldId && directFieldName && isSameToken(field.fieldName, directFieldName))
  ))
  const isFormMember = [
    'field',
    'formfield',
    'currentformfield',
    'formmember',
  ].includes(type) || hasRuntimeMemberFieldIds
  const isFormDepartment = type === 'formdepartment' || Boolean(runtimeDepartmentField)
  const hasDirectDepartmentField = (
    Boolean(directFieldId || directFieldName)
    && (
      type === 'formdepartment'
      || (
        ['field', 'formfield', 'currentformfield'].includes(type)
        && directField?.ownerPolicy === 'department'
      )
    )
  )
  return {
    kind: (
      isFormMember
        ? 'form_member'
        : isFormDepartment
          ? 'form_department'
          : Object.keys(approver).length
            ? 'non_field'
            : 'missing'
    ) as ApprovalOwnerReferenceKind,
    fieldId: runtimeMemberFieldIds !== null
      ? runtimeMemberFieldIds.find(Boolean) || ''
      : runtimeDepartmentField || directFieldId,
    fieldName: directFieldName,
    runtimeMemberFieldIds,
    hasMixedFieldSources: (
      hasRuntimeMemberFieldIds
      && (Boolean(runtimeDepartmentField) || hasDirectDepartmentField)
    ),
  }
}

const hasInvalidRuntimeMemberFields = (
  reference: ReturnType<typeof resolveApprovalOwnerReference>,
) => (
  reference.runtimeMemberFieldIds !== null
  && (
    reference.runtimeMemberFieldIds.length !== 1
    || !reference.runtimeMemberFieldIds[0]
  )
)

const isMemberComponentType = (value: unknown) => {
  const normalized = normalizeToken(value)
  return normalized === 'memberselect' || normalized === 'member'
}

const isDepartmentComponentType = (value: unknown) => {
  const normalized = normalizeToken(value)
  return normalized === 'departmentselect' || normalized === 'department'
}

const isApplicantRoleFieldName = (value: unknown) => (
  ['报销人', '申请人'].includes(normalizeText(value))
)

const resolveApprovalOwnerDependency = (
  scheme: NocodeEditorFlowScheme,
  node: NocodeEditorFlowPlanNode,
) => {
  const dependencies = (scheme.dependencies || []).filter(dependency => (
    dependency.requiredFor === 'approval_owner'
  ))
  const stepDependencies = dependencies.filter(dependency => (
    dependency.scopeKind === 'step'
    && normalizeText(dependency.scopeKey) === normalizeText(node.nodeKey)
  ))
  if (stepDependencies.length === 1) {
    return stepDependencies[0] as NocodeEditorFlowSchemeDependency
  }
  const globalDependencies = dependencies.filter(dependency => dependency.scopeKind === 'global')
  return stepDependencies.length === 0 && globalDependencies.length === 1
    ? globalDependencies[0] as NocodeEditorFlowSchemeDependency
    : null
}

const isLegacyApprovalOwnerReferenceConsistent = (input: {
  scheme: NocodeEditorFlowScheme
  node: NocodeEditorFlowPlanNode
  reference: ReturnType<typeof resolveApprovalOwnerReference>
  target: FlowSummaryTarget | null
}) => {
  if (input.reference.kind !== 'form_member' || !input.target) {
    return false
  }

  const approvalStep = [
    ...(input.scheme.mainPath || []),
    ...(input.scheme.branches || []).flatMap(branch => branch.steps || []),
  ].find(step => (
    step.kind === 'approval'
    && normalizeText(step.key) === normalizeText(input.node.nodeKey)
  ))
  if (!approvalStep) {
    return false
  }

  const matchingFields = flattenFields(input.target.fields)
    .filter(field => field.ownerPolicy === 'member')
    .filter(field => !input.reference.fieldId || field.fieldId === input.reference.fieldId)
    .filter(field => !input.reference.fieldName || isSameToken(field.fieldName, input.reference.fieldName))
  if (matchingFields.length !== 1) {
    return false
  }

  const fieldNameToken = normalizeToken(matchingFields[0].fieldName)
  if (fieldNameToken.length < 2) {
    return false
  }
  return [
    approvalStep.title,
    approvalStep.intent,
    approvalStep.actorHint,
  ].some(value => normalizeToken(value).includes(fieldNameToken))
}

const resolveDependencyState = (dependency: NocodeEditorFlowSchemeDependency) => {
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
  return { isExisting, isPlanned }
}

const resolveDependencyFieldKind = (input: {
  dependency: NocodeEditorFlowSchemeDependency
  target: FlowSummaryTarget | null
}): ApprovalOwnerFieldKind | null => {
  if (isMemberComponentType(input.dependency.fieldRef?.expectedType)) {
    return 'member'
  }
  if (isDepartmentComponentType(input.dependency.fieldRef?.expectedType)) {
    return 'department'
  }
  const expectedFieldId = normalizeText(input.dependency.fieldRef?.fieldId)
  const expectedFieldName = normalizeText(input.dependency.fieldRef?.fieldName)
  const resolvedField = flattenFields(input.target?.fields || []).find(field => (
    (expectedFieldId && field.fieldId === expectedFieldId)
    || (!expectedFieldId && expectedFieldName && isSameToken(field.fieldName, expectedFieldName))
  ))
  return resolvedField?.ownerPolicy === 'member' || resolvedField?.ownerPolicy === 'department'
    ? resolvedField.ownerPolicy
    : null
}

const hasTargetMismatch = (input: {
  plan: NocodeEditorFlowPlan
  scheme: NocodeEditorFlowScheme
  target: FlowSummaryTarget | null
}) => {
  const planFormId = normalizeText(input.plan.target?.formId)
  const planFormName = normalizeText(input.plan.target?.formName)
  const schemeFormId = normalizeText(input.scheme.target?.formId)
  const schemeFormName = normalizeText(input.scheme.target?.formName)
  if (
    (planFormId && schemeFormId && planFormId !== schemeFormId)
    || (!planFormId && !schemeFormId && planFormName && schemeFormName && !isSameToken(planFormName, schemeFormName))
  ) {
    return true
  }
  if (!input.target) {
    return false
  }
  return Boolean(
    (schemeFormId && schemeFormId !== input.target.tableId)
    || (!schemeFormId && schemeFormName && !isSameToken(schemeFormName, input.target.tableName)),
  )
}

export const validateFlowBlueprintApprovalOwnerDependencies = (input: {
  plan: NocodeEditorFlowPlan
  scheme: NocodeEditorFlowScheme
  flowSummary?: unknown
}): FlowBlueprintApprovalOwnerPreflightResult => {
  const diagnostics: FlowBlueprintApprovalOwnerPreflightDiagnostic[] = []
  if (input.plan.openQuestions.length || input.plan.confirmation) {
    diagnostics.push({
      code: 'blueprint_contains_confirmation_semantics',
      message: '流程蓝图不能携带待确认问题或确认信息进入应用阶段。',
    })
    return {
      diagnostics,
      requiresBlueprintRegeneration: true,
      requiresUserConfirmation: false,
    }
  }
  const target = resolveCurrentTarget(input.flowSummary)
  if (hasTargetMismatch({ ...input, target })) {
    diagnostics.push({
      code: 'blueprint_approval_owner_target_context_mismatch',
      message: '当前流程蓝图、流程方案与表单上下文不一致，不能复用旧的审批人字段依赖。',
    })
    return {
      diagnostics,
      requiresBlueprintRegeneration: true,
      requiresUserConfirmation: false,
    }
  }

  collectApprovalNodes(input.plan.triggerBranches.flatMap(branch => branch.nodes || []))
    .forEach((node) => {
      const dependency = resolveApprovalOwnerDependency(input.scheme, node)
      const reference = resolveApprovalOwnerReference(node, target)
      const nodeKey = normalizeText(node.nodeKey) || undefined
      const nodeName = normalizeText(node.name) || undefined
      if (!dependency) {
        if (reference.kind === 'non_field' || reference.kind === 'missing') {
          return
        }
        if (
          reference.kind === 'form_member'
          && !reference.hasMixedFieldSources
          && !hasInvalidRuntimeMemberFields(reference)
          && isLegacyApprovalOwnerReferenceConsistent({
            scheme: input.scheme,
            node,
            reference,
            target,
          })
        ) {
          return
        }
        diagnostics.push({
          code: 'blueprint_approval_owner_dependency_missing',
          message: '审批节点没有对应的已收敛审批人字段依赖。',
          nodeKey,
          nodeName,
        })
        return
      }

      const expectedFieldId = normalizeText(dependency.fieldRef?.fieldId)
      const expectedFieldName = normalizeText(dependency.fieldRef?.fieldName)
      const { isExisting, isPlanned } = resolveDependencyState(dependency)
      const expectedFieldKind = resolveDependencyFieldKind({ dependency, target })
      if (!expectedFieldKind) {
        diagnostics.push({
          code: 'blueprint_approval_owner_dependency_invalid',
          message: '审批人字段依赖缺少可识别的成员或部门字段类型。',
          nodeKey,
          nodeName,
          expectedFieldId: expectedFieldId || undefined,
          expectedFieldName: expectedFieldName || undefined,
        })
        return
      }
      const expectedReferenceKind: ApprovalOwnerReferenceKind = expectedFieldKind === 'member'
        ? 'form_member'
        : 'form_department'
      const hasInvalidMemberFields = (
        expectedFieldKind === 'member'
        && hasInvalidRuntimeMemberFields(reference)
      )
      if (
        reference.kind !== expectedReferenceKind
        || (!reference.fieldId && !reference.fieldName)
        || hasInvalidMemberFields
        || reference.hasMixedFieldSources
      ) {
        diagnostics.push({
          code: 'blueprint_approval_owner_dependency_mismatch',
          message: expectedFieldKind === 'member'
            ? '审批节点必须引用已收敛的表单成员字段，不能改用其他审批人来源。'
            : '审批节点必须引用已收敛的表单部门字段，不能改用其他审批人来源。',
          nodeKey,
          nodeName,
          expectedFieldId: expectedFieldId || undefined,
          expectedFieldName: expectedFieldName || undefined,
          actualFieldId: reference.fieldId || undefined,
          actualFieldName: reference.fieldName || undefined,
        })
        return
      }

      if (isExisting) {
        if (expectedFieldKind === 'member' && isApplicantRoleFieldName(expectedFieldName)) {
          diagnostics.push({
            code: 'blueprint_approval_owner_existing_field_invalid',
            message: '申请角色字段不能复用为审批人字段。',
            nodeKey,
            nodeName,
            expectedFieldId: expectedFieldId || undefined,
            expectedFieldName: expectedFieldName || undefined,
            actualFieldId: reference.fieldId || undefined,
            actualFieldName: reference.fieldName || undefined,
          })
          return
        }
        const compatibleFields = flattenFields(target?.fields || [])
          .filter(field => field.ownerPolicy === expectedFieldKind)
        const resolvedField = expectedFieldId
          ? compatibleFields.find(field => field.fieldId === expectedFieldId)
          : compatibleFields.find(field => isSameToken(field.fieldName, expectedFieldName))
        const matchesDependency = Boolean(
          resolvedField
          && (!expectedFieldId || resolvedField.fieldId === expectedFieldId)
          && isSameToken(resolvedField.fieldName, expectedFieldName)
          && (
            (!reference.fieldId || reference.fieldId === resolvedField.fieldId)
            && (!reference.fieldName || isSameToken(reference.fieldName, resolvedField.fieldName))
          ),
        )
        if (!matchesDependency) {
          diagnostics.push({
            code: target
              ? 'blueprint_approval_owner_dependency_mismatch'
              : 'blueprint_approval_owner_existing_field_invalid',
            message: target
              ? `审批节点引用的${expectedFieldKind === 'member' ? '成员' : '部门'}字段与已收敛审批人字段不一致。`
              : `复用审批人字段时必须有当前目标表单的${expectedFieldKind === 'member' ? '成员' : '部门'}字段证据。`,
            nodeKey,
            nodeName,
            expectedFieldId: expectedFieldId || undefined,
            expectedFieldName: expectedFieldName || undefined,
            actualFieldId: reference.fieldId || undefined,
            actualFieldName: reference.fieldName || undefined,
          })
        }
        return
      }

      if (isPlanned) {
        if (expectedFieldKind !== 'member' || !expectedFieldName || !isMemberComponentType(dependency.fieldRef?.expectedType)) {
          diagnostics.push({
            code: 'blueprint_approval_owner_dependency_invalid',
            message: '计划新增的审批人字段缺少成员组件或字段名。',
            nodeKey,
            nodeName,
          })
          return
        }
        if (reference.fieldId) {
          diagnostics.push({
            code: 'blueprint_approval_owner_planned_field_id_forbidden',
            message: '计划新增的审批人字段尚未物化，蓝图不能编造字段 ID。',
            nodeKey,
            nodeName,
            expectedFieldName,
            actualFieldId: reference.fieldId,
            actualFieldName: reference.fieldName || undefined,
          })
          return
        }
        if (!isSameToken(reference.fieldName, expectedFieldName)) {
          diagnostics.push({
            code: 'blueprint_approval_owner_dependency_mismatch',
            message: '审批节点引用的计划成员字段与已收敛依赖不一致。',
            nodeKey,
            nodeName,
            expectedFieldName,
            actualFieldName: reference.fieldName || undefined,
          })
        }
        return
      }

      diagnostics.push({
        code: 'blueprint_approval_owner_dependency_invalid',
        message: '审批人字段依赖不是已验证的既有字段或待物化成员字段。',
        nodeKey,
        nodeName,
        expectedFieldId: expectedFieldId || undefined,
        expectedFieldName: expectedFieldName || undefined,
      })
    })

  return {
    diagnostics,
    requiresBlueprintRegeneration: diagnostics.length > 0,
    requiresUserConfirmation: false,
  }
}
