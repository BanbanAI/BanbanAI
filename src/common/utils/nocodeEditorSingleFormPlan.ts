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

// 表单对象：出现在新增动作后面的“表单/表/单”类名词，而不是字段、选项这些表单内部的构件。
const FORM_OBJECT_TOKEN_PATTERN = /(表单|问卷|台账|清单|报表|申请表|登记表|报名表|审批表|统计表|记录表|明细表|花名册|.{0,8}[表单])/u
const FIELD_COMPONENT_TOKEN_PATTERN = /(字段|控件|选项|按钮|默认值|公式|校验|权限|视图|列宽|子表单字段)/u
const NEW_FORM_VERB_PATTERN = /(创建|新建|搭建|建立|添加|新增|增加|加|做|生成|来一|要一|设计|建|落地)/u
// “给/对/把 + 现有表单”是给已有对象做改动，不构成新建表单。
const EXISTING_OBJECT_LEAD_PATTERN = /^(?:先|然后|再|顺便|同时)?(?:给|对|把|在)/u
const EDIT_ONLY_VERB_PATTERN = /(修改|调整|改成|改为|删除|删掉|去掉|重命名|隐藏|显示|排序)/u

const splitIntentClauses = (text: string) => (
  text.split(/[，。；！？!?;,\n]/u).map(item => item.trim()).filter(Boolean)
)

const isNewFormCreationClause = (clause: string) => {
  if (!clause || EXISTING_OBJECT_LEAD_PATTERN.test(clause)) {
    return false
  }
  const verbIndex = clause.search(NEW_FORM_VERB_PATTERN)
  if (verbIndex < 0) {
    return false
  }
  // 表单对象必须出现在新增动作之后：先点名表单再“加一个流程”是在改已有表单。
  const objectAfterVerb = FORM_OBJECT_TOKEN_PATTERN.test(clause.slice(verbIndex))
  if (!objectAfterVerb) {
    return false
  }
  // 同一个分句里出现字段、选项等构件，说明是在改已有表单，而不是新建表单。
  return !FIELD_COMPONENT_TOKEN_PATTERN.test(clause)
}

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

  const clauses = splitIntentClauses(text)
  const hasExplicitNewFormHint = (
    includesAny(text, COMPLETE_NEW_FORM_EXPLICIT_HINTS)
    || includesAny(text, COMPLETE_NEW_FORM_RESTART_HINTS)
  )
  if (clauses.some(isNewFormCreationClause)) {
    return 'positive'
  }
  if (
    hasExplicitNewFormHint
    && clauses.some(clause => FORM_OBJECT_TOKEN_PATTERN.test(clause))
  ) {
    return 'positive'
  }

  const hasObject = (
    includesAny(text, COMPLETE_NEW_FORM_OBJECT_KEYWORDS)
    || FORM_OBJECT_TOKEN_PATTERN.test(text)
  )
  if (!hasObject) {
    return includesAny(text, INCREMENTAL_EDIT_HINTS) ? 'negative' : 'unknown'
  }

  // 有表单对象，但动作只落在字段/选项/已有表单上：这是修改现有表单，不是新建。
  if (
    includesAny(text, INCREMENTAL_EDIT_HINTS)
    || FIELD_COMPONENT_TOKEN_PATTERN.test(text)
    || EDIT_ONLY_VERB_PATTERN.test(text)
    || clauses.every(clause => EXISTING_OBJECT_LEAD_PATTERN.test(clause))
  ) {
    return 'negative'
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
