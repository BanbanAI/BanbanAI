import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmStage,
} from '@common/types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorConfirmationPayload,
} from './nocodeEditorConfirmationNormalization'
import {
  resolveNocodeEditorPlanningQuestionProjection,
  type NocodeEditorLegacyOpenQuestionsMode,
} from './nocodeEditorPlanningQuestionProjection'
import i18next from 'i18next'
import {
  normalizeNocodeEditorFlowIntentSignal,
  type NocodeEditorFlowIntentSignal,
} from './nocodeEditorFlowIntentSignal'
import {
  isNocodeEditorQuestionAllowedForStage,
} from './nocodeEditorQuestionStagePolicy'

type UnknownRecord = Record<string, unknown>
type NormalizedPlanningOutlineForm = {
  formKey: string
  tableName: string
  groupName?: string
  groupNameExplicit?: boolean
  description?: string
}
type NormalizedPlanningOutlineModule = {
  moduleKey: string
  name: string
  description?: string
  color?: string
  formKeys?: string[]
}
type NormalizedPlanningOutlineFlow = {
  from: string
  to: string
  label?: string
}
const isPresent = <T>(value: T | null | undefined): value is T => value != null

export type NocodeEditorPlanningOutlineForm = {
  formKey?: string
  tableName: string
  groupName?: string
  groupNameExplicit?: boolean
  description?: string
}

export type NocodeEditorPlanningOutlineModule = {
  moduleKey?: string
  name: string
  description?: string
  color?: string
  formKeys?: string[]
}

export type NocodeEditorPlanningOutlineFlow = {
  from: string
  to: string
  label?: string
}

export type NocodeEditorPlanningOutline = {
  id?: string
  title?: string
  summary?: string
  forms: NocodeEditorPlanningOutlineForm[]
  modules: NocodeEditorPlanningOutlineModule[]
  flows?: NocodeEditorPlanningOutlineFlow[]
  assumptions?: string[]
  openQuestions?: string[]
  confirmation?: NocodeEditorAiConfirmPayload | null
  flowIntent?: NocodeEditorFlowIntentSignal | null
}

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const FORM_PLAN_FLOW_SUMMARY_PATTERNS = [
  /(?:并|且)?(?:走|进入|发起|接入).{0,8}(?:审批流|审批流程|流程|workflow)/iu,
  /(?:审批流|审批流程|流程|workflow).{0,12}(?:待确认|触发方式|触发|发起|自动|手动)/iu,
  /(?:提交后|提交时|通过后|驳回后|归档后).{0,12}(?:审批|审核|办理|流程|workflow)/iu,
]

const normalizeConfirmationQuestionTitle = (value: unknown) => {
  if (typeof value === 'string') {
    return normalizeText(value)
  }
  if (!isRecord(value)) {
    return ''
  }
  return normalizeText(value.title)
    || normalizeText(value.question)
    || normalizeText(value.name)
}

const isNocodeEditorFormPlanFlowSummaryClause = (value: unknown) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }
  return (
    !isNocodeEditorQuestionAllowedForStage(text, 'form-plan')
    || FORM_PLAN_FLOW_SUMMARY_PATTERNS.some(pattern => pattern.test(text))
  )
}

const stripFormPlanFlowLeakageText = (value: unknown) => {
  const text = normalizeText(value)
  if (!text) {
    return ''
  }

  const segments = text.match(/[^，。；;!?！？]+[，。；;!?！？]?/gu) || [text]
  const sentenceEnd = text.match(/[。！？!?]$/u)?.[0] || ''
  const sanitized = segments
    .map(segment => normalizeText(segment))
    .filter(segment => segment && !isNocodeEditorFormPlanFlowSummaryClause(segment))
    .join('')
    .replace(/^[，。；;、\s]+/u, '')
    .replace(/[，；;、\s]+([。！？!?])/gu, '$1')
    .replace(/[，；;、]{2,}/gu, '，')
    .replace(/[，；;、\s]+$/u, '')
    .trim()

  if (sanitized && sentenceEnd && !/[。！？!?]$/u.test(sanitized)) {
    return `${sanitized}${sentenceEnd}`
  }

  return sanitized
}

const hasFormPlanFlowLeakage = (value: unknown) => {
  if (!isRecord(value)) {
    return false
  }

  const summary = normalizeText(value.summary)
  if (isNocodeEditorFormPlanFlowSummaryClause(summary)) {
    return true
  }

  if (
    Array.isArray(value.forms)
    && value.forms.some(item => (
      isNocodeEditorFormPlanFlowSummaryClause((item as UnknownRecord)?.description)
    ))
  ) {
    return true
  }

  if (normalizeStringList(value.openQuestions).some(question => (
    !isNocodeEditorQuestionAllowedForStage(question, 'form-plan')
  ))) {
    return true
  }

  const confirmation = isRecord(value.confirmation) ? value.confirmation : null
  if (!confirmation) {
    return false
  }

  if (
    Array.isArray(confirmation.questions)
    && confirmation.questions.some(question => (
      !isNocodeEditorQuestionAllowedForStage(question, 'form-plan')
    ))
  ) {
    return true
  }

  return [
    confirmation.summary,
    confirmation.completionSummary,
    confirmation.completion_summary,
    ...(Array.isArray(confirmation.resultSummary) ? confirmation.resultSummary : []),
    ...(Array.isArray(confirmation.result_summary) ? confirmation.result_summary : []),
  ].some(item => isNocodeEditorFormPlanFlowSummaryClause(item))
}

const sanitizeFormPlanConfirmation = (value: unknown) => {
  if (!isRecord(value)) {
    return value
  }

  const hasExplicitEmptyQuestions = Array.isArray(value.questions)
    && value.questions.length === 0
  const rawQuestions = Array.isArray(value.questions) ? value.questions : []
  const questions = rawQuestions.filter(question => (
    isNocodeEditorQuestionAllowedForStage(question, 'form-plan')
  ))
  const questionTitles = questions
    .map(item => normalizeConfirmationQuestionTitle(item))
    .filter(Boolean)
  const rawResultSummary = normalizeStringList(value.resultSummary ?? value.result_summary)
  const resultSummary = rawResultSummary.filter(item => (
    isNocodeEditorQuestionAllowedForStage(item, 'form-plan')
  ))
  const droppedQuestions = questions.length !== rawQuestions.length
  const droppedResultSummary = resultSummary.length !== rawResultSummary.length
  const status = normalizeText(value.status)

  let summary = normalizeText(value.summary)
  if (droppedQuestions && status !== 'completed') {
    summary = questionTitles.length ? `需要确认${questionTitles.join('、')}。` : ''
  } else if (
    !questionTitles.length
    && !isNocodeEditorQuestionAllowedForStage(summary, 'form-plan')
  ) {
    summary = ''
  }

  let completionSummary = normalizeText(
    value.completionSummary ?? value.completion_summary,
  )
  if (droppedResultSummary) {
    completionSummary = resultSummary.length ? resultSummary.join('；') : ''
  } else if (
    !questionTitles.length
    && !isNocodeEditorQuestionAllowedForStage(completionSummary, 'form-plan')
  ) {
    completionSummary = ''
  }

  if (
    !questionTitles.length
    && !completionSummary
    && resultSummary.length === 0
    && !hasExplicitEmptyQuestions
  ) {
    return null
  }

  const nextStatus = status || undefined

  return {
    ...value,
    status: nextStatus,
    summary: summary || undefined,
    completionSummary: completionSummary || undefined,
    completion_summary: completionSummary || undefined,
    resultSummary: resultSummary.length ? resultSummary : undefined,
    result_summary: resultSummary.length ? resultSummary : undefined,
    questions,
  }
}

export const normalizeNocodeEditorPlanningOutline = (
  value: unknown,
  options: {
    titleFallback?: string
    confirmationStage?: NocodeEditorAiConfirmStage
    legacyConfirmation?: unknown
    legacyOpenQuestions?: unknown
    legacyOpenQuestionsMode?: NocodeEditorLegacyOpenQuestionsMode
  } = {},
): NocodeEditorPlanningOutline | null => {
  if (!isRecord(value)) {
    return null
  }

  const confirmationStage = options.confirmationStage || 'form-plan'
  const normalizedFlowIntent = normalizeNocodeEditorFlowIntentSignal(value.flowIntent)
  const shouldStripFormPlanFlowDetails = (
    confirmationStage === 'form-plan'
    && (
      normalizedFlowIntent?.state === 'explicit_positive'
      || (
        normalizedFlowIntent?.state !== 'explicit_negative'
        && hasFormPlanFlowLeakage(value)
      )
    )
  )

  const forms = Array.isArray(value.forms)
    ? value.forms
      .map((item, index) => {
        const tableName = normalizeText(item?.tableName ?? item?.name)
        if (!tableName) {
          return null
        }

        return {
          formKey: normalizeText(item?.formKey) || `artifact-${index + 1}`,
          tableName,
          groupName: normalizeText(item?.groupName) || undefined,
          groupNameExplicit: typeof item?.groupNameExplicit === 'boolean'
            ? item.groupNameExplicit
            : typeof item?.group_name_explicit === 'boolean'
              ? item.group_name_explicit
              : undefined,
          description: (
            shouldStripFormPlanFlowDetails
              ? stripFormPlanFlowLeakageText(item?.description)
              : normalizeText(item?.description)
          ) || undefined,
        }
      })
      .filter(isPresent)
    : []

  if (!forms.length) {
    return null
  }
  const flowIntent = normalizedFlowIntent && forms.length === 1
    ? {
      ...normalizedFlowIntent,
      targetFormName: normalizedFlowIntent.targetFormName || forms[0].tableName,
    }
    : normalizedFlowIntent
  const rawOpenQuestions = [
    ...normalizeStringList(options.legacyOpenQuestions),
    ...normalizeStringList(value.openQuestions),
  ]
  const openQuestions = confirmationStage === 'form-plan'
    ? rawOpenQuestions.filter(question => (
      isNocodeEditorQuestionAllowedForStage(question, 'form-plan')
    ))
    : rawOpenQuestions
  const summary = (
    shouldStripFormPlanFlowDetails
      ? stripFormPlanFlowLeakageText(value.summary)
      : normalizeText(value.summary)
  ) || undefined
  const usesPlanningQuestionContract = (
    confirmationStage === 'app-plan'
    || confirmationStage === 'form-plan'
  )
  const isValidRawConfirmationCandidate = (candidate: unknown) => Boolean(
    normalizeNocodeEditorConfirmationPayload({
      stage: confirmationStage,
      confirmation: candidate,
      openQuestions: [],
      summary,
    })
  )
  const rawStructuredConfirmation = isValidRawConfirmationCandidate(value.confirmation)
    ? value.confirmation
    : null
  const sanitizedStructuredConfirmation = (
    confirmationStage === 'form-plan'
    && rawStructuredConfirmation
  )
    ? sanitizeFormPlanConfirmation(rawStructuredConfirmation)
    : rawStructuredConfirmation
  const structuredConfirmation = isValidRawConfirmationCandidate(sanitizedStructuredConfirmation)
    ? sanitizedStructuredConfirmation
    : null
  const rawLegacyConfirmation = !rawStructuredConfirmation
    && isValidRawConfirmationCandidate(options.legacyConfirmation)
    ? options.legacyConfirmation
    : null
  const sanitizedLegacyConfirmation = (
    confirmationStage === 'form-plan'
    && rawLegacyConfirmation
  )
    ? sanitizeFormPlanConfirmation(rawLegacyConfirmation)
    : rawLegacyConfirmation
  const legacyConfirmation = isValidRawConfirmationCandidate(sanitizedLegacyConfirmation)
    ? sanitizedLegacyConfirmation
    : null
  const selectedConfirmation = structuredConfirmation || legacyConfirmation
  const planningLegacyOpenQuestions = (
    options.legacyOpenQuestionsMode === 'fallback-only'
    && rawStructuredConfirmation
  )
    ? []
    : openQuestions
  const planningProjection = usesPlanningQuestionContract
    ? resolveNocodeEditorPlanningQuestionProjection({
      stage: confirmationStage,
      structuredConfirmation,
      legacyConfirmation,
      legacyOpenQuestions: planningLegacyOpenQuestions,
      legacyOpenQuestionsMode: options.legacyOpenQuestionsMode,
      summary,
    })
    : null
  const normalizedConfirmation = planningProjection?.confirmation
    || normalizeNocodeEditorConfirmationPayload({
      stage: confirmationStage,
      confirmation: selectedConfirmation,
      openQuestions: planningLegacyOpenQuestions,
      summary,
    })
  const projectedOpenQuestions = planningProjection?.openQuestions || openQuestions

  return {
    id: normalizeText(value.id) || undefined,
    title: normalizeText(value.title) || options.titleFallback || i18next.t('nocodeEditorPlanningOutline.appStructurePreview'),
    summary,
    forms,
    modules: Array.isArray(value.modules)
      ? value.modules
        .map((item, index) => {
          const name = normalizeText(item?.name)
          if (!name) {
            return null
          }

          const formKeys = normalizeStringList(item?.formKeys)

          return {
            moduleKey: normalizeText(item?.moduleKey) || `module-${index + 1}`,
            name,
            description: normalizeText(item?.description) || undefined,
            color: normalizeText(item?.color) || undefined,
            formKeys: formKeys.length ? formKeys : undefined,
          }
        })
        .filter(isPresent)
      : [],
    flows: Array.isArray(value.flows)
      ? value.flows
        .map((item) => {
          const from = normalizeText(item?.from)
          const to = normalizeText(item?.to)
          if (!from || !to) {
            return null
          }

          return {
            from,
            to,
            label: normalizeText(item?.label) || undefined,
          }
        })
        .filter(isPresent)
      : [],
    assumptions: normalizeStringList(value.assumptions),
    openQuestions: projectedOpenQuestions,
    confirmation: normalizedConfirmation,
    flowIntent,
  }
}
