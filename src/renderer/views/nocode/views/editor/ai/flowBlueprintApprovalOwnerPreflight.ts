import type {
  NocodeEditorFlowPlan,
  NocodeEditorFlowPlanNode,
} from '@common/utils/nocodeEditorFlowPlan'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  flattenFlowApprovalOwnerSummaryFields,
  hasFlowApprovalOwnerTargetContextMismatch,
  hasFlowApprovalOwnerUnverifiedFieldConflict,
  isApplicantRoleFieldName,
  isFlowApprovalOwnerRecord,
  isSameFlowApprovalOwnerToken,
  normalizeFlowApprovalOwnerText,
  normalizeFlowApprovalOwnerToken,
  resolveFlowApprovalOwnerSummaryTarget,
  resolveFlowSchemeDependencyState,
  resolveFlowSchemeSingleDependency,
  type FlowApprovalOwnerSummaryTarget,
} from '@common/utils/nocodeEditorFlowApprovalOwnerRules'

type FlowSummaryTarget = FlowApprovalOwnerSummaryTarget

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
    | 'blueprint_approval_owner_evidence_unverified'
    | 'blueprint_contains_confirmation_semantics'
  message: string
  severity?: 'blocking' | 'config_gap'
  routeToScheme?: boolean
  nodeKey?: string
  nodeName?: string
  expectedFieldId?: string
  expectedFieldName?: string
  actualFieldId?: string
  actualFieldName?: string
  compatibleFields?: Array<{ fieldId: string; fieldName: string }>
}

export type FlowBlueprintApprovalOwnerPreflightResult = {
  diagnostics: FlowBlueprintApprovalOwnerPreflightDiagnostic[]
  requiresBlueprintRegeneration: boolean
  requiresUserConfirmation: false
}

export const hasBlockingFlowBlueprintApprovalOwnerDiagnostic = (
  diagnostics: Array<{ severity?: 'blocking' | 'config_gap' }>,
) => diagnostics.some(diagnostic => (diagnostic.severity || 'blocking') === 'blocking')

const normalizeText = normalizeFlowApprovalOwnerText
const normalizeToken = normalizeFlowApprovalOwnerToken
const isSameToken = isSameFlowApprovalOwnerToken
const isRecord = isFlowApprovalOwnerRecord
const flattenFields = flattenFlowApprovalOwnerSummaryFields
const resolveCurrentTarget = resolveFlowApprovalOwnerSummaryTarget

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

const resolveApprovalOwnerDependency = (
  scheme: NocodeEditorFlowScheme,
  node: NocodeEditorFlowPlanNode,
) => resolveFlowSchemeSingleDependency({
  dependencies: scheme.dependencies,
  requiredFor: 'approval_owner',
  scopeKey: node.nodeKey,
})

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

const resolveDependencyState = resolveFlowSchemeDependencyState

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
  if (hasFlowApprovalOwnerTargetContextMismatch({ plan: input.plan, scheme: input.scheme, target })) {
    diagnostics.push({
      code: 'blueprint_approval_owner_target_context_mismatch',
      message: '当前流程蓝图、流程方案与表单上下文不一致，不能复用旧的审批人字段依赖。',
      routeToScheme: true,
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
        const compatibleFields = flattenFields(target?.fields || [])
          .filter(field => field.ownerPolicy === expectedFieldKind)
        const compatibleFieldOptions = compatibleFields
          .filter(field => !isApplicantRoleFieldName(field.fieldName))
          .map(field => ({ fieldId: field.fieldId, fieldName: field.fieldName }))
        if (expectedFieldKind === 'member' && isApplicantRoleFieldName(expectedFieldName)) {
          diagnostics.push({
            code: 'blueprint_approval_owner_existing_field_invalid',
            message: '申请角色字段不能复用为审批人字段。',
            routeToScheme: true,
            nodeKey,
            nodeName,
            expectedFieldId: expectedFieldId || undefined,
            expectedFieldName: expectedFieldName || undefined,
            actualFieldId: reference.fieldId || undefined,
            actualFieldName: reference.fieldName || undefined,
            compatibleFields: compatibleFieldOptions.slice(0, 6),
          })
          return
        }
        const isUnverified = dependency.unverifiedReason === 'form_evidence_unavailable'
        if (isUnverified && hasFlowApprovalOwnerUnverifiedFieldConflict({
          dependency,
          actualFieldId: reference.fieldId,
          actualFieldName: reference.fieldName,
        })) {
          diagnostics.push({
            code: 'blueprint_approval_owner_dependency_mismatch',
            message: '审批节点引用的字段与已收敛审批人字段不一致。',
            nodeKey,
            nodeName,
            expectedFieldId: expectedFieldId || undefined,
            expectedFieldName: expectedFieldName || undefined,
            actualFieldId: reference.fieldId || undefined,
            actualFieldName: reference.fieldName || undefined,
          })
          return
        }
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
          if (isUnverified && !target) {
            diagnostics.push({
              code: 'blueprint_approval_owner_evidence_unverified',
              message: '该审批人字段依赖尚未与当前表单证据核对，将在流程生成后补齐配置。',
              severity: 'config_gap',
              nodeKey,
              nodeName,
              expectedFieldId: expectedFieldId || undefined,
              expectedFieldName: expectedFieldName || undefined,
            })
            return
          }
          if (isUnverified) {
            diagnostics.push({
              code: 'blueprint_approval_owner_existing_field_invalid',
              message: expectedFieldKind === 'member'
                ? '已确认复用的成员字段与当前表单证据不一致，需要重新确认审批人字段绑定。'
                : '已确认复用的部门字段与当前表单证据不一致，需要重新确认审批人字段绑定。',
              routeToScheme: true,
              nodeKey,
              nodeName,
              expectedFieldId: expectedFieldId || undefined,
              expectedFieldName: expectedFieldName || undefined,
              actualFieldId: reference.fieldId || undefined,
              actualFieldName: reference.fieldName || undefined,
              compatibleFields: expectedFieldKind === 'member'
                ? compatibleFieldOptions.slice(0, 6)
                : undefined,
            })
            return
          }
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
    requiresBlueprintRegeneration: hasBlockingFlowBlueprintApprovalOwnerDiagnostic(diagnostics),
    requiresUserConfirmation: false,
  }
}
