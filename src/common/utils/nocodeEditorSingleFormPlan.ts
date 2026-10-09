export type NocodeEditorSingleFormPlanOutlineLike = {
  title?: unknown
  summary?: unknown
  forms?: Array<{
    formKey?: unknown
    tableName?: unknown
    groupName?: unknown
    groupNameExplicit?: unknown
    description?: unknown
  }> | null
  modules?: Array<{ name?: unknown }> | null
  flows?: Array<Record<string, unknown>> | null
  openQuestions?: unknown
  confirmation?: {
    status?: unknown
    completionSummary?: unknown
    resultSummary?: unknown
    questions?: unknown
  } | null
}

export type NocodeEditorSingleFormPlanPresentationLike = {
  formCount?: unknown
  planningItemCount?: unknown
  moduleCount?: unknown
}

export type NocodeEditorSingleFormPlanSummaryResult = {
  eligible: boolean
  formName: string
  goalText: string
  contentText: string
  scopeText: string
  openQuestions: string[]
  compactSummary: string
  directContinueHintText: string
  directContinueRiskText: string
}

import i18next from 'i18next'
import {
  normalizeNocodeEditorPlanningOutline,
} from './nocodeEditorPlanningOutline'

const normalizeText = (value: unknown) => String(value ?? '').trim()
const normalizeIntentText = (value: unknown) => normalizeText(value).replace(/\s+/g, '')
const endsWithSentencePunctuation = (value: string) => /[。！？!?]$/.test(value)
const mergeDisplayText = (primary: string, secondary: string) => {
  if (!primary) {
    return secondary
  }
  if (!secondary) {
    return primary
  }
  if (primary === secondary || primary.includes(secondary)) {
    return primary
  }
  if (secondary.includes(primary)) {
    return secondary
  }
  return `${primary}${endsWithSentencePunctuation(primary) ? '' : '。'}${secondary}`
}

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const COMPLETE_NEW_FORM_ACTION_KEYWORDS = [
  '创建',
  '新建',
  '搭建',
  '做一个',
  '做个',
  '生成一个',
  '搭一个',
  '来一个',
  '来一张',
  '要一个',
  '要一张',
  '落地',
]

const COMPLETE_NEW_FORM_OBJECT_KEYWORDS = [
  '问卷',
  '登记表',
  '申请单',
  '台账',
  '表单',
]

const EMPTY_SHELL_KEYWORDS = [
  '空白表单',
  '表单壳子',
  '搭个壳子',
  '先开一个表单',
  '空表',
]

const INCREMENTAL_EDIT_HINTS = [
  '当前表单',
  '这个表单',
  '当前字段',
  '这个字段',
  '新增字段',
  '加字段',
  '补一个字段',
  '删字段',
  '调整字段',
  '改成',
  '改为',
  '继续改',
]

const COMPLETE_NEW_FORM_EXPLICIT_HINTS = [
  '从零',
  '完整新表单',
  '完整表单',
  '完整问卷',
  '完整登记表',
  '完整申请单',
  '完整台账',
]

const includesAny = (text: string, keywords: string[]) => (
  keywords.some(keyword => text.includes(keyword))
)

const COMPLETE_NEW_FORM_RESTART_HINTS = [
  '\u4ece\u5934',
  '\u4ece\u5934\u91cd\u65b0',
  '\u91cd\u65b0\u89c4\u5212',
  '\u4ece\u5934\u91cd\u65b0\u89c4\u5212',
  '\u91cd\u65b0\u5f00\u59cb',
  '\u91cd\u65b0\u505a\u4e00\u4e2a',
  '\u65b0\u7684\u89c4\u5212',
  '\u65b0\u7684\u9700\u6c42\u6bb5\u843d',
  '\u65b0\u4efb\u52a1',
]

type NocodeEditorCompleteNewFormIntentSignal = 'positive' | 'negative' | 'unknown'

const resolveNocodeEditorCompleteNewFormIntentSignal = (options: {
  userMessage?: unknown
  editorMode?: unknown
  activeFormId?: unknown
}): NocodeEditorCompleteNewFormIntentSignal => {
  const text = normalizeIntentText(options.userMessage)
  if (!text) {
    return 'unknown'
  }
  if (includesAny(text, EMPTY_SHELL_KEYWORDS)) {
    return 'negative'
  }

  const hasBareFormObject = /(?:创建|新建|搭建|做一个|做个|生成一个|搭一个|来一个|来一张|要一个|要一张)[^，。！？!?]{0,16}表(?:$|[，。！？!?])/.test(text)
  const hasObject = includesAny(text, COMPLETE_NEW_FORM_OBJECT_KEYWORDS) || hasBareFormObject
  if (!hasObject) {
    return includesAny(text, INCREMENTAL_EDIT_HINTS) ? 'negative' : 'unknown'
  }

  const hasNewFormAction = includesAny(text, COMPLETE_NEW_FORM_ACTION_KEYWORDS)
  const hasExplicitNewFormHint = (
    includesAny(text, COMPLETE_NEW_FORM_EXPLICIT_HINTS)
    || includesAny(text, COMPLETE_NEW_FORM_RESTART_HINTS)
  )
  const looksLikeIncrementalEdit = includesAny(text, INCREMENTAL_EDIT_HINTS)
  if (looksLikeIncrementalEdit && !hasNewFormAction) {
    return 'negative'
  }

  if (hasNewFormAction || hasExplicitNewFormHint) {
    return 'positive'
  }

  void options.editorMode
  void options.activeFormId
  return 'unknown'
}

export const resolveNocodeEditorCompleteNewFormIntentFromMessages = (options: {
  userMessages?: unknown[]
  editorMode?: unknown
  activeFormId?: unknown
}) => {
  const userMessages = Array.isArray(options.userMessages) ? options.userMessages : []
  for (let index = userMessages.length - 1; index >= 0; index -= 1) {
    const signal = resolveNocodeEditorCompleteNewFormIntentSignal({
      userMessage: userMessages[index],
      editorMode: options.editorMode,
      activeFormId: options.activeFormId,
    })
    if (signal === 'positive') {
      return true
    }
    if (signal === 'negative') {
      return false
    }
  }
  return false
}

export const isNocodeEditorCompleteNewFormIntent = (options: {
  userMessage?: unknown
  editorMode?: unknown
  activeFormId?: unknown
}) => resolveNocodeEditorCompleteNewFormIntentFromMessages({
  userMessages: [options.userMessage],
  editorMode: options.editorMode,
  activeFormId: options.activeFormId,
})

export const resolveNocodeEditorSingleFormPlanSummary = (input: {
  outline?: NocodeEditorSingleFormPlanOutlineLike | null
  solutionPresentation?: NocodeEditorSingleFormPlanPresentationLike | null
}): NocodeEditorSingleFormPlanSummaryResult => {
  const outline = normalizeNocodeEditorPlanningOutline(input?.outline, {
    confirmationStage: 'form-plan',
  }) || input?.outline || null
  const solutionPresentation = input?.solutionPresentation || null
  const forms = Array.isArray(outline?.forms) ? outline.forms : []
  const form = forms[0] || null
  const formName = normalizeText(form?.tableName)
  const goalText = normalizeText(outline?.summary) || formName
  const contentText = normalizeText(form?.description) || formName
  const goalDisplayText = mergeDisplayText(goalText, contentText)
  const normalizedConfirmation = outline?.confirmation
  const confirmationStatus = normalizeText(normalizedConfirmation?.status)
  const openQuestions = normalizeStringList(outline?.openQuestions)
  const completionSummary = normalizeText(normalizedConfirmation?.completionSummary)
  const resultSummary = normalizeStringList(normalizedConfirmation?.resultSummary)
  const eligible = (
    forms.length === 1
    && Number(solutionPresentation?.formCount) === 1
    && Number(solutionPresentation?.planningItemCount) === 0
    && Number(solutionPresentation?.moduleCount) <= 1
    && Boolean(formName)
  )

  if (!eligible) {
    return {
      eligible: false,
      formName: '',
      goalText: '',
      contentText: '',
      scopeText: '',
      openQuestions: [],
      compactSummary: '',
      directContinueHintText: '',
      directContinueRiskText: '',
    }
  }

  const scopeText = openQuestions.length
    ? i18next.t('nocodeEditorSingleFormPlan.scopePending')
    : i18next.t('nocodeEditorSingleFormPlan.scopeReady')
  const directContinueHintText = openQuestions.length
    ? i18next.t('nocodeEditorSingleFormPlan.continueHint', {
      label: i18next.t('nocodeEditorConfirmationCopy.pendingContinueLabel'),
    })
    : i18next.t('nocodeEditorSingleFormPlan.readyHint')
  const directContinueRiskText = openQuestions.length
    ? i18next.t('nocodeEditorSingleFormPlan.continueRisk', {
      label: i18next.t('nocodeEditorConfirmationCopy.pendingContinueLabel'),
    })
    : i18next.t('nocodeEditorSingleFormPlan.readyRisk')

  return {
    eligible: true,
    formName,
    goalText,
    contentText,
    scopeText,
    openQuestions,
    directContinueHintText,
    directContinueRiskText,
    compactSummary: [
      i18next.t('nocodeEditorSingleFormPlan.formPlan', { formName }),
      i18next.t('nocodeEditorSingleFormPlan.goal', { goal: goalDisplayText }),
      confirmationStatus === 'completed' && completionSummary
        ? i18next.t('nocodeEditorSingleFormPlan.confirmedConclusion', { conclusion: completionSummary })
        : '',
      confirmationStatus === 'completed' && resultSummary.length
        ? i18next.t('nocodeEditorSingleFormPlan.confirmationResult', {
          result: resultSummary.join(i18next.t('nocodeEditorSingleFormPlan.listSeparator')),
        })
        : '',
      i18next.t('nocodeEditorSingleFormPlan.scope', { scope: scopeText }),
      i18next.t('nocodeEditorSingleFormPlan.aiHandling', { handling: directContinueRiskText }),
      openQuestions.length
        ? i18next.t('nocodeEditorSingleFormPlan.pendingQuestions', {
          questions: openQuestions.join(i18next.t('nocodeEditorSingleFormPlan.listSeparator')),
        })
        : '',
    ].filter(Boolean).join('\n'),
  }
}

export const buildNocodeEditorSingleFormPlanPromptSummary = (input: {
  outline?: NocodeEditorSingleFormPlanOutlineLike | null
  solutionPresentation?: NocodeEditorSingleFormPlanPresentationLike | null
}) => {
  const summary = resolveNocodeEditorSingleFormPlanSummary(input)
  return summary.eligible ? summary.compactSummary : ''
}
