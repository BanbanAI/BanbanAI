import type {
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorConfirmationDecision,
} from './nocodeEditorConfirmationDecisionProjection'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
  NocodeEditorFlowSchemeQuestion,
  NocodeEditorFlowSchemeStep,
} from './nocodeEditorFlowScheme'
import type {
  UnifiedFlowIssue,
} from './nocodeEditorFlowUnifiedIssue'
import {
  isNocodeEditorFlowApprovalOwnerSourceQuestion,
} from './nocodeEditorFlowQuestionPolicy'

type UnknownRecord = Record<string, unknown>

type FlowSummaryMemberField = {
  fieldId: string
  fieldName: string
  ownerPolicy: string
  subFields?: FlowSummaryMemberField[]
}

type FlowSummaryTarget = {
  tableId: string
  tableName: string
  fields: FlowSummaryMemberField[]
}

export type FlowSchemeApprovalOwnerConvergenceResult = {
  hasConfirmedFormMemberSource: boolean
  issues: UnifiedFlowIssue[]
}

const FORM_MEMBER_FIELD_OPTION_PREFIX = 'use-existing-owner-field:'

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

const isApplicantRoleFieldName = (value: unknown) => (
  ['报销人', '申请人'].includes(normalizeText(value))
)

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

const collectSummaryFields = (value: unknown): FlowSummaryMemberField[] => {
  if (!isRecord(value)) {
    return []
  }

  const fieldId = normalizeText(value.fieldId)
  const fieldName = normalizeText(value.fieldName)
  const ownerPolicy = normalizeText(value.ownerPolicy)
  if (!fieldId || !fieldName) {
    return []
  }

  const subFields = Array.isArray(value.subFields)
    ? value.subFields.flatMap(collectSummaryFields)
    : []
  return [{
    fieldId,
    fieldName,
    ownerPolicy,
    ...(subFields.length ? { subFields } : {}),
  }]
}

const flattenSummaryFields = (fields: FlowSummaryMemberField[]) => (
  fields.flatMap(field => [
    field,
    ...flattenSummaryFields(field.subFields || []),
  ])
)

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

const collectApprovalSteps = (scheme: NocodeEditorFlowScheme) => {
  const allSteps: NocodeEditorFlowSchemeStep[] = [
    ...(scheme.mainPath || []),
    ...(scheme.branches || []).flatMap(branch => branch.steps || []),
  ]
  return allSteps.filter(step => step.kind === 'approval')
}

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
    return {
      hasConfirmedFormMemberSource: false,
      issues: [],
    }
  }

  const approvalSteps = collectApprovalSteps(input.scheme)
  if (!approvalSteps.length) {
    return {
      hasConfirmedFormMemberSource: true,
      issues: [],
    }
  }

  const target = resolveCurrentTarget(input.flowSummary)
  const targetFormId = normalizeText(input.scheme.target?.formId)
  const targetFormName = normalizeText(input.scheme.target?.formName)
  if (!target) {
    return {
      hasConfirmedFormMemberSource: true,
      issues: buildInternalInconsistencyIssue({
        planningContextKey,
        diagnostics: [{
          code: 'target_field_evidence_unavailable',
          message: '当前目标表单没有可用于审批人收敛的字段证据。',
          targetFormId,
          targetFormName,
        }],
      }),
    }
  }

  if (
    (targetFormId && !isSameToken(targetFormId, target.tableId))
    || (targetFormName && !isSameToken(targetFormName, target.tableName))
  ) {
    return {
      hasConfirmedFormMemberSource: true,
      issues: buildInternalInconsistencyIssue({
        planningContextKey,
        diagnostics: [{
          code: 'target_context_mismatch',
          message: '当前字段证据不属于流程方案指定的目标表单。',
          targetFormId,
          targetFormName,
          evidenceTableId: target.tableId,
          evidenceTableName: target.tableName,
        }],
      }),
    }
  }

  const fields = flattenSummaryFields(target.fields)
  const memberFieldsById = new Map<string, FlowSummaryMemberField>(
    fields
      .filter(field => field.ownerPolicy === 'member')
      .map((field): [string, FlowSummaryMemberField] => [field.fieldId, field]),
  )
  const pendingSourceQuestions = [
    ...(input.scheme.openQuestions || []).filter(question => isNocodeEditorFlowApprovalOwnerSourceQuestion(question)),
    ...(input.scheme.confirmation?.questions || []).filter(question => (
      !hasQuestionAnswer(question) && isNocodeEditorFlowApprovalOwnerSourceQuestion(question)
    )),
  ]
  if (pendingSourceQuestions.length) {
    return {
      hasConfirmedFormMemberSource: true,
      issues: buildInternalInconsistencyIssue({
        planningContextKey,
        diagnostics: pendingSourceQuestions.map(question => ({
          code: 'owner_source_question_repeated',
          message: '审批人来源已经确认，方案不能再次询问来源类型。',
          questionId: 'id' in question ? normalizeText(question.id) : normalizeText(question.key),
          questionTitle: normalizeText(question.title),
        })),
      }),
    }
  }

  const dependencies = (input.scheme.dependencies || []).filter(dependency => (
    dependency.requiredFor === 'approval_owner'
  ))
  const diagnostics: Array<Record<string, unknown>> = []

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
    if (isExisting) {
      const fieldId = normalizeText(dependency.fieldRef?.fieldId)
      const fieldName = normalizeText(dependency.fieldRef?.fieldName)
      const currentField = memberFieldsById.get(fieldId)
      if (
        !fieldId
        || !fieldName
        || !currentField
        || currentField.fieldName !== fieldName
        || isApplicantRoleFieldName(currentField.fieldName)
      ) {
        diagnostics.push({
          code: 'approval_owner_existing_field_invalid',
          message: '复用的审批人字段必须是当前目标表单中真实存在的成员字段。',
          nodeKey: step.key,
          nodeName: step.title,
          fieldId,
          fieldName,
          targetFormId: target.tableId,
          targetFormName: target.tableName,
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

  return {
    hasConfirmedFormMemberSource: true,
    issues: diagnostics.length
      ? buildInternalInconsistencyIssue({
        planningContextKey,
        diagnostics,
      })
      : [],
  }
}
