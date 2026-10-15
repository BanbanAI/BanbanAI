import type {
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorConfirmationDecision,
} from './nocodeEditorConfirmationDecisionProjection'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDeferredConfigItem,
  NocodeEditorFlowSchemeDependency,
  NocodeEditorFlowSchemeQuestion,
  NocodeEditorFlowSchemeStep,
} from './nocodeEditorFlowScheme'
import type {
  SchemeRestageBlueprintDiagnosticLike,
  UnifiedFlowIssue,
} from './nocodeEditorFlowUnifiedIssue'
import {
  buildUnifiedFlowIssuesFromSchemeRestageDiagnostics,
} from './nocodeEditorFlowUnifiedIssue'
import {
  isNocodeEditorFlowApprovalOwnerSourceQuestion,
} from './nocodeEditorFlowQuestionPolicy'
import {
  collectFlowSchemeApprovalSteps,
  flattenFlowApprovalOwnerSummaryFields,
  hasFlowApprovalOwnerTargetContextMismatch,
  isApplicantRoleFieldName,
  normalizeFlowApprovalOwnerText,
  resolveFlowApprovalOwnerSummaryTarget,
  resolveFlowSchemeDependencyState,
  type FlowApprovalOwnerSummaryField,
} from './nocodeEditorFlowApprovalOwnerRules'

type FlowSummaryMemberField = FlowApprovalOwnerSummaryField

export type FlowSchemeApprovalOwnerConvergenceResult = {
  hasConfirmedFormMemberSource: boolean
  issues: UnifiedFlowIssue[]
  scheme: NocodeEditorFlowScheme
  unverifiedDependencyIds: string[]
}

const FORM_MEMBER_FIELD_OPTION_PREFIX = 'use-existing-owner-field:'

const normalizeText = normalizeFlowApprovalOwnerText
const flattenSummaryFields = flattenFlowApprovalOwnerSummaryFields
const resolveCurrentTarget = resolveFlowApprovalOwnerSummaryTarget

export { collectFlowSchemeApprovalSteps }

const hasFormMemberSourceDecision = (
  decisions: NocodeEditorConfirmationDecision[] | undefined,
) => (decisions || []).some((decision) => {
  const decisionKey = normalizeText(decision?.decisionKey)
  if (decisionKey === 'flow.approval.owner.source') {
    return normalizeText(decision.selectedOptionValue) === 'form_member_field'
      || decision.approvalOwnerSource === 'form_member_field'
  }
  if (!decisionKey) {
    return decision?.approvalOwnerSource === 'form_member_field'
  }
  return decision.decisionKeySource === 'legacy_question_id'
    && decision.approvalOwnerSource === 'form_member_field'
})

const hasQuestionAnswer = (question: NocodeEditorAiConfirmQuestion) => (
  question.confirmed === true
  || Boolean(
    normalizeText(question.selectedOptionValue)
    || normalizeText(question.answerSummary)
    || normalizeText(question.answerDetail)
    || question.options?.some(option => option.selected),
  )
)

const isNarrowApprovalOwnerFieldQuestion = (
  question: NocodeEditorFlowSchemeQuestion,
) => /(?:使用|选择|指定).{0,12}(?:哪个|哪一个|哪位).{0,12}(?:成员|人员).{0,8}字段.{0,12}审批(?:人|人员|对象)|(?:哪个|哪一个).{0,12}(?:成员|人员).{0,8}字段.{0,12}作为.{0,8}审批/u.test(
  `${normalizeText(question.title)} ${normalizeText(question.reason)}`,
)

const findPendingConfirmationQuestion = (
  scheme: NocodeEditorFlowScheme,
  openQuestion: NocodeEditorFlowSchemeQuestion,
) => (scheme.confirmation?.questions || []).find(question => (
  !hasQuestionAnswer(question)
  && (
    normalizeText(question.id) === normalizeText(openQuestion.key)
    || normalizeText(question.title) === normalizeText(openQuestion.title)
  )
)) || null

const getConcreteMemberFieldOptions = (
  question: NocodeEditorAiConfirmQuestion | null,
  memberFieldsById: Map<string, FlowSummaryMemberField>,
) => {
  if (!question || question.questionKind !== 'single_select') {
    return null
  }
  const options = question.options || []
  if (options.length < 2) {
    return null
  }

  const fieldIds = options.map((option) => {
    const value = normalizeText(option.value)
    if (!value.toLowerCase().startsWith(FORM_MEMBER_FIELD_OPTION_PREFIX)) {
      return ''
    }
    return value.slice(FORM_MEMBER_FIELD_OPTION_PREFIX.length)
  })
  if (fieldIds.some(fieldId => !fieldId)) {
    return null
  }
  if (new Set(fieldIds).size !== fieldIds.length) {
    return null
  }
  if (fieldIds.some(fieldId => memberFieldsById.get(fieldId)?.ownerPolicy !== 'member')) {
    return null
  }
  return fieldIds
}

const buildInternalInconsistencyIssue = (input: {
  diagnostics: Array<Record<string, unknown>>
  planningContextKey?: string
}) => [{
  issueId: 'flow-scheme-approval-owner-convergence-inconsistent',
  sourceStage: 'flow-scheme' as const,
  category: 'system_error' as const,
  severity: 'blocking' as const,
  userActionRequired: false,
  planningContextKey: normalizeText(input.planningContextKey) || undefined,
  returnToStage: null,
  blockedNextAction: 'editor_stage_flow_blueprint' as const,
  userMessage: '已确认的审批人来源与当前流程方案字段收敛不一致，请基于当前表单字段证据修订方案。',
  questionPayload: null,
  diagnostics: input.diagnostics,
}] satisfies UnifiedFlowIssue[]

const buildConvergenceResult = (input: {
  scheme: NocodeEditorFlowScheme
  hasConfirmedFormMemberSource: boolean
  issues: UnifiedFlowIssue[]
  unverifiedDependencyIds?: string[]
}): FlowSchemeApprovalOwnerConvergenceResult => ({
  hasConfirmedFormMemberSource: input.hasConfirmedFormMemberSource,
  issues: input.issues,
  scheme: input.scheme,
  unverifiedDependencyIds: input.unverifiedDependencyIds || [],
})

const buildApprovalOwnerEvidenceDeferredItem = (
  step: NocodeEditorFlowSchemeStep,
): NocodeEditorFlowSchemeDeferredConfigItem => ({
  id: `flow-deferred:approval-owner:${step.key}:evidence`,
  lifecycleStatus: 'pending',
  nodeKey: step.key,
  nodeTitle: step.title,
  settingPath: 'options.approver',
  category: 'owner_binding',
  requirementLevel: 'required',
  supportStatus: 'runtime_supported',
  summary: `${step.title}的审批人字段暂无法与当前表单核对，将在流程生成后补齐`,
  fillTiming: 'after_generation',
  severity: 'high',
  relatedIssueCodes: ['approval_owner_form_evidence_unavailable'],
})

const getDeferredItemSemanticKey = (
  item: NocodeEditorFlowSchemeDeferredConfigItem,
) => [
  normalizeText(item.nodeKey),
  normalizeText(item.settingPath),
  normalizeText(item.category),
].join('|')

const mergeApprovalOwnerDeferredItems = (input: {
  existingItems?: NocodeEditorFlowSchemeDeferredConfigItem[] | null
  incomingItems: NocodeEditorFlowSchemeDeferredConfigItem[]
}) => {
  const existingItems = Array.isArray(input.existingItems) ? input.existingItems : []
  const existingKeys = new Set(existingItems.map(getDeferredItemSemanticKey))
  return [
    ...existingItems,
    ...input.incomingItems.filter(item => !existingKeys.has(getDeferredItemSemanticKey(item))),
  ]
}

const markDependenciesUnverified = (input: {
  scheme: NocodeEditorFlowScheme
  dependencyIds: Set<string>
}): NocodeEditorFlowScheme => {
  if (!input.dependencyIds.size) {
    return input.scheme
  }
  return {
    ...input.scheme,
    dependencies: (input.scheme.dependencies || []).map(dependency => (
      input.dependencyIds.has(dependency.id)
        ? { ...dependency, unverifiedReason: 'form_evidence_unavailable' as const }
        : dependency
    )),
  }
}

const convergeApprovalOwnersWithoutFieldEvidence = (input: {
  scheme: NocodeEditorFlowScheme
  approvalSteps: NocodeEditorFlowSchemeStep[]
  planningContextKey?: string
}): FlowSchemeApprovalOwnerConvergenceResult => {
  const dependencies = (input.scheme.dependencies || []).filter(dependency => (
    dependency.requiredFor === 'approval_owner'
  ))
  const diagnostics: Array<Record<string, unknown>> = []
  const unverifiedDependencyIds = new Set<string>()
  const incomingDeferredItems: NocodeEditorFlowSchemeDeferredConfigItem[] = []

  input.approvalSteps.forEach((step) => {
    const scopedDependencies = dependencies.filter(dependency => (
      dependency.scopeKind === 'step'
      && normalizeText(dependency.scopeKey) === normalizeText(step.key)
    ))
    const narrowQuestions = (input.scheme.openQuestions || []).filter(question => (
      normalizeText(question.scopeKey) === normalizeText(step.key)
      && isNarrowApprovalOwnerFieldQuestion(question)
    ))
    const resolutionCount = scopedDependencies.length + narrowQuestions.length
    if (resolutionCount !== 1) {
      diagnostics.push({
        code: resolutionCount > 1
          ? 'approval_owner_resolution_duplicate'
          : 'approval_owner_resolution_missing',
        message: '每个审批节点必须收敛为已有成员字段、计划新增成员字段或具体成员字段问题之一。',
        nodeKey: step.key,
        nodeName: step.title,
      })
      return
    }

    if (narrowQuestions.length === 1) {
      return
    }

    const dependency = scopedDependencies[0] as NocodeEditorFlowSchemeDependency
    const { isPlanned } = resolveFlowSchemeDependencyState(dependency)
    if (isPlanned) {
      const fieldName = normalizeText(dependency.fieldRef?.fieldName)
      const expectedType = normalizeText(dependency.fieldRef?.expectedType)
      if (!fieldName || expectedType !== 'memberSelect') {
        diagnostics.push({
          code: 'approval_owner_planned_field_incomplete',
          message: '计划新增的审批人字段必须明确字段名和成员组件类型。',
          nodeKey: step.key,
          nodeName: step.title,
          fieldName,
          expectedType,
        })
      }
      return
    }

    const { isExisting } = resolveFlowSchemeDependencyState(dependency)
    if (isExisting) {
      unverifiedDependencyIds.add(dependency.id)
      incomingDeferredItems.push(buildApprovalOwnerEvidenceDeferredItem(step))
      return
    }

    diagnostics.push({
      code: 'approval_owner_resolution_invalid',
      message: '审批人字段依赖未使用已确认的成员字段收敛方式。',
      nodeKey: step.key,
      nodeName: step.title,
      resolutionStatus: dependency.resolutionStatus,
      resolutionMode: dependency.resolutionMode,
      materializationStatus: dependency.materializationStatus,
    })
  })

  const markedScheme = markDependenciesUnverified({
    scheme: input.scheme,
    dependencyIds: unverifiedDependencyIds,
  })
  return {
    hasConfirmedFormMemberSource: true,
    issues: diagnostics.length
      ? buildInternalInconsistencyIssue({
        planningContextKey: input.planningContextKey,
        diagnostics,
      })
      : [],
    scheme: incomingDeferredItems.length
      ? {
        ...markedScheme,
        deferredConfigItems: mergeApprovalOwnerDeferredItems({
          existingItems: markedScheme.deferredConfigItems,
          incomingItems: incomingDeferredItems,
        }),
      }
      : markedScheme,
    unverifiedDependencyIds: [...unverifiedDependencyIds],
  }
}

export const convergeNocodeEditorFlowSchemeApprovalOwners = (input: {
  scheme: NocodeEditorFlowScheme
  flowSummary?: unknown
  flowConfirmationDecisions?: NocodeEditorConfirmationDecision[]
  planningContextKey?: string
}): FlowSchemeApprovalOwnerConvergenceResult => {
  const planningContextKey = normalizeText(input.planningContextKey)
    || input.scheme.confirmation?.planningContextKey
  const hasConfirmedFormMemberSource = hasFormMemberSourceDecision(input.flowConfirmationDecisions)
  if (!hasConfirmedFormMemberSource) {
    return buildConvergenceResult({
      scheme: input.scheme,
      hasConfirmedFormMemberSource: false,
      issues: [],
    })
  }

  const approvalSteps = collectFlowSchemeApprovalSteps(input.scheme)
  if (!approvalSteps.length) {
    return buildConvergenceResult({
      scheme: input.scheme,
      hasConfirmedFormMemberSource: true,
      issues: [],
    })
  }

  const pendingSourceQuestions = [
    ...(input.scheme.openQuestions || []).filter(question => isNocodeEditorFlowApprovalOwnerSourceQuestion(question)),
    ...(input.scheme.confirmation?.questions || []).filter(question => (
      !hasQuestionAnswer(question) && isNocodeEditorFlowApprovalOwnerSourceQuestion(question)
    )),
  ]
  const buildRepeatedSourceIssues = () => buildInternalInconsistencyIssue({
    planningContextKey,
    diagnostics: pendingSourceQuestions.map(question => ({
      code: 'owner_source_question_repeated',
      message: '审批人来源已经确认，方案不能再次询问来源类型。',
      questionId: 'id' in question ? normalizeText(question.id) : normalizeText(question.key),
      questionTitle: normalizeText(question.title),
    })),
  })

  const target = resolveCurrentTarget(input.flowSummary)
  const targetFormId = normalizeText(input.scheme.target?.formId)
  const targetFormName = normalizeText(input.scheme.target?.formName)
  if (!target) {
    if (pendingSourceQuestions.length) {
      return buildConvergenceResult({
        scheme: input.scheme,
        hasConfirmedFormMemberSource: true,
        issues: buildRepeatedSourceIssues(),
      })
    }
    return convergeApprovalOwnersWithoutFieldEvidence({
      scheme: input.scheme,
      approvalSteps,
      planningContextKey,
    })
  }

  if (hasFlowApprovalOwnerTargetContextMismatch({ scheme: input.scheme, target })) {
    return buildConvergenceResult({
      scheme: input.scheme,
      hasConfirmedFormMemberSource: true,
      issues: buildUnifiedFlowIssuesFromSchemeRestageDiagnostics({
        diagnostics: [{
          code: 'target_context_mismatch',
          message: '当前字段证据不属于流程方案指定的目标表单。',
          targetFormId,
          targetFormName,
          evidenceTableId: target.tableId,
          evidenceTableName: target.tableName,
        }],
        sourceStage: 'flow-scheme',
        planningContextKey,
      }),
    })
  }

  const fields = flattenSummaryFields(target.fields)
  const memberFieldsById = new Map<string, FlowSummaryMemberField>(
    fields
      .filter(field => field.ownerPolicy === 'member')
      .map((field): [string, FlowSummaryMemberField] => [field.fieldId, field]),
  )
  if (pendingSourceQuestions.length) {
    return buildConvergenceResult({
      scheme: input.scheme,
      hasConfirmedFormMemberSource: true,
      issues: buildRepeatedSourceIssues(),
    })
  }

  const dependencies = (input.scheme.dependencies || []).filter(dependency => (
    dependency.requiredFor === 'approval_owner'
  ))
  const diagnostics: Array<Record<string, unknown>> = []
  const restageDiagnostics: SchemeRestageBlueprintDiagnosticLike[] = []
  const compatibleOwnerFields = [...memberFieldsById.values()]
    .filter(field => !isApplicantRoleFieldName(field.fieldName))
    .map(field => ({ fieldId: field.fieldId, fieldName: field.fieldName }))

  approvalSteps.forEach((step) => {
    const scopedDependencies = dependencies.filter(dependency => (
      dependency.scopeKind === 'step'
      && normalizeText(dependency.scopeKey) === normalizeText(step.key)
    ))
    const narrowQuestions = (input.scheme.openQuestions || []).filter(question => (
      normalizeText(question.scopeKey) === normalizeText(step.key)
      && isNarrowApprovalOwnerFieldQuestion(question)
    ))

    if (scopedDependencies.length + narrowQuestions.length !== 1) {
      diagnostics.push({
        code: scopedDependencies.length + narrowQuestions.length > 1
          ? 'approval_owner_resolution_duplicate'
          : 'approval_owner_resolution_missing',
        message: '每个审批节点必须收敛为已有成员字段、计划新增成员字段或具体成员字段问题之一。',
        nodeKey: step.key,
        nodeName: step.title,
      })
      return
    }

    if (narrowQuestions.length === 1) {
      const confirmationQuestion = findPendingConfirmationQuestion(input.scheme, narrowQuestions[0])
      const concreteFieldIds = getConcreteMemberFieldOptions(confirmationQuestion, memberFieldsById)
      if (!concreteFieldIds) {
        diagnostics.push({
          code: 'approval_owner_field_question_invalid',
          message: '审批人字段问题只能列出当前目标表单的成员字段。',
          nodeKey: step.key,
          nodeName: step.title,
          questionKey: narrowQuestions[0].key,
        })
      }
      return
    }

    const dependency = scopedDependencies[0] as NocodeEditorFlowSchemeDependency
    const { isExisting, isPlanned } = resolveFlowSchemeDependencyState(dependency)
    if (isExisting) {
      const fieldId = normalizeText(dependency.fieldRef?.fieldId)
      const fieldName = normalizeText(dependency.fieldRef?.fieldName)
      const currentField = memberFieldsById.get(fieldId)
      const isApplicantRole = Boolean(currentField && isApplicantRoleFieldName(currentField.fieldName))
      if (
        !fieldId
        || !fieldName
        || !currentField
        || currentField.fieldName !== fieldName
        || isApplicantRole
      ) {
        restageDiagnostics.push({
          code: 'approval_owner_existing_field_invalid',
          message: isApplicantRole
            ? '审批人不能是申请人角色字段，需要重新确认审批人字段绑定。'
            : '复用的审批人字段必须是当前目标表单中真实存在的成员字段，需要重新确认审批人字段绑定。',
          nodeKey: step.key,
          nodeName: step.title,
          fieldId,
          fieldName,
          targetFormId: target.tableId,
          targetFormName: target.tableName,
          compatibleFields: compatibleOwnerFields,
        })
      }
      return
    }

    if (isPlanned) {
      const fieldName = normalizeText(dependency.fieldRef?.fieldName)
      const expectedType = normalizeText(dependency.fieldRef?.expectedType)
      if (!fieldName || expectedType !== 'memberSelect') {
        diagnostics.push({
          code: 'approval_owner_planned_field_incomplete',
          message: '计划新增的审批人字段必须明确字段名和成员组件类型。',
          nodeKey: step.key,
          nodeName: step.title,
          fieldName,
          expectedType,
        })
      }
      return
    }

    diagnostics.push({
      code: 'approval_owner_resolution_invalid',
      message: '审批人字段依赖未使用已确认的成员字段收敛方式。',
      nodeKey: step.key,
      nodeName: step.title,
      resolutionStatus: dependency.resolutionStatus,
      resolutionMode: dependency.resolutionMode,
      materializationStatus: dependency.materializationStatus,
    })
  })

  const restageIssues = buildUnifiedFlowIssuesFromSchemeRestageDiagnostics({
    diagnostics: restageDiagnostics,
    sourceStage: 'flow-scheme',
    planningContextKey,
  })
  return buildConvergenceResult({
    scheme: input.scheme,
    hasConfirmedFormMemberSource: true,
    issues: [
      ...(diagnostics.length
        ? buildInternalInconsistencyIssue({
          planningContextKey,
          diagnostics,
        })
        : []),
      ...restageIssues,
    ],
  })
}
