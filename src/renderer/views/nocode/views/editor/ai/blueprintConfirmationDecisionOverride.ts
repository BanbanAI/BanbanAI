import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import { isSameNocodeEditorBlueprintForm } from '@common/utils/nocodeEditorBlueprintFormNormalization'
import {
  isGenericBlueprintWidgetType,
  resolveBlueprintExplicitWidgetType,
} from './blueprintFieldIntent'
import { normalizeBlueprintIdentityToken } from './blueprintFieldIdentity'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
} from './types'

const normalizeDecisionText = (value: unknown) => String(value || '').trim()

const normalizeQuestionTextToken = (value: unknown) => (
  normalizeDecisionText(value)
    .toLowerCase()
    .replace(/[\s\u3000，。！？、；：,.!?;:"'“”‘’（）()[\]{}]/g, '')
)

export const isCompletedBlueprintConfirmationQuestion = (
  question: NocodeEditorAiConfirmQuestion,
) => (
  question.confirmed === true
  || Boolean(
    normalizeDecisionText(question.selectedOptionValue)
    || normalizeDecisionText(question.answerSummary)
    || normalizeDecisionText(question.answerDetail)
    || question.options?.some(option => option.selected),
  )
)

const getBlueprintConfirmationQuestionAnswerText = (
  question: NocodeEditorAiConfirmQuestion,
) => [
  question.selectedOptionValue,
  question.answerSummary,
  question.answerDetail,
  ...(question.options || []).filter(option => option.selected).map(option => option.value),
  ...(question.options || []).filter(option => option.selected).map(option => option.label),
].map(normalizeDecisionText).filter(Boolean).join(' ')

export const doesBlueprintConfirmationQuestionTargetField = (options: {
  question: NocodeEditorAiConfirmQuestion
  form: NocodeEditorAiAppBlueprintForm
  field: NocodeEditorAiAppBlueprintField
}) => {
  const target = options.question.decisionTarget
  if (
    target?.kind === 'field-source'
    && normalizeDecisionText(target.fieldKey)
    && normalizeDecisionText(target.fieldKey) === normalizeDecisionText(options.field.fieldKey)
  ) {
    const targetFormKey = normalizeDecisionText(target.formKey)
    return !targetFormKey || targetFormKey === normalizeDecisionText(options.form.formKey)
  }

  const fieldName = normalizeQuestionTextToken(options.field.name)
  const questionTitle = normalizeQuestionTextToken(options.question.title)
  return Boolean(fieldName && questionTitle && questionTitle.includes(fieldName))
}

export const resolveBlueprintConfirmationWidgetType = (
  question: NocodeEditorAiConfirmQuestion,
) => {
  const supersededWidgetType = normalizeDecisionText(question.supersededByWidgetType)
  if (supersededWidgetType) {
    return supersededWidgetType
  }
  const answerText = getBlueprintConfirmationQuestionAnswerText(question).toLowerCase()
  if (/(图片|照片|截图|图像|image)/u.test(answerText)) {
    return 'widget.form.image-uploader'
  }
  if (/(通用文件|文件附件|上传文件|附件文件|file|attachment)/u.test(answerText)) {
    return 'widget.form.file-uploader'
  }
  return undefined
}

export const hasConfirmedBlueprintFieldClarification = (options: {
  blueprint: NocodeEditorAiAppBlueprint
  form: NocodeEditorAiAppBlueprintForm
  field: NocodeEditorAiAppBlueprintField
}) => (
  Array.isArray(options.blueprint.confirmation?.questions)
  && options.blueprint.confirmation.questions.some(question => (
    isCompletedBlueprintConfirmationQuestion(question)
    && doesBlueprintConfirmationQuestionTargetField({
      question,
      form: options.form,
      field: options.field,
    })
  ))
)

const findBlueprintField = (
  fields: NocodeEditorAiAppBlueprintField[],
  predicate: (field: NocodeEditorAiAppBlueprintField) => boolean,
): NocodeEditorAiAppBlueprintField | undefined => {
  for (const field of fields) {
    if (predicate(field)) {
      return field
    }
    const nested = findBlueprintField(
      Array.isArray(field.children) ? field.children : [],
      predicate,
    )
    if (nested) {
      return nested
    }
  }
  return undefined
}

type QuestionFieldCandidate = {
  form: NocodeEditorAiAppBlueprintForm
  field: NocodeEditorAiAppBlueprintField
  length: number
}

const collectQuestionFieldCandidates = (
  form: NocodeEditorAiAppBlueprintForm,
  fields: NocodeEditorAiAppBlueprintField[],
  title: string,
  result: QuestionFieldCandidate[],
) => {
  fields.forEach((field) => {
    const name = normalizeQuestionTextToken(field.name)
    if (name && title.includes(name)) {
      result.push({ form, field, length: name.length })
    }
    collectQuestionFieldCandidates(
      form,
      Array.isArray(field.children) ? field.children : [],
      title,
      result,
    )
  })
}

const resolveQuestionFieldTarget = (
  question: NocodeEditorAiConfirmQuestion,
  forms: NocodeEditorAiAppBlueprintForm[],
) => {
  const targetFieldKey = normalizeDecisionText(question.decisionTarget?.fieldKey)
  if (targetFieldKey) {
    for (const form of forms) {
      const field = findBlueprintField(
        Array.isArray(form.fields) ? form.fields : [],
        candidate => normalizeDecisionText(candidate.fieldKey) === targetFieldKey,
      )
      if (field) {
        return { form, field }
      }
    }
  }

  const title = normalizeQuestionTextToken(question.title)
  const candidates: QuestionFieldCandidate[] = []
  forms.forEach((form) => {
    collectQuestionFieldCandidates(
      form,
      Array.isArray(form.fields) ? form.fields : [],
      title,
      candidates,
    )
  })
  // “项目”会命中“费用项目”，题面兜底必须取最长字段名。
  const best = candidates.sort((left, right) => right.length - left.length)[0]
  return best ? { form: best.form, field: best.field } : undefined
}

export type BlueprintResolvedFieldSourceDecision = {
  title: string
  reasonCode: string
}

/**
 * 规划阶段已经对字段来源做过决策（选文本，或已指定关联表）时，
 * 字段级来源题失去前提。不删除，降级为默认处理说明：用户仍能看到 AI 采用的方案，也不阻塞生成。
 */
export const downgradeBlueprintConfirmationResolvedSourceQuestions = (options: {
  confirmation: NocodeEditorAiConfirmPayload | null | undefined
  forms: NocodeEditorAiAppBlueprintForm[]
  resolveFieldSourceDecision: (
    form: NocodeEditorAiAppBlueprintForm,
    field: NocodeEditorAiAppBlueprintField,
  ) => BlueprintResolvedFieldSourceDecision | null
}) => {
  const questions = Array.isArray(options.confirmation?.questions)
    ? options.confirmation.questions
    : []
  if (!options.confirmation || !questions.length) {
    return options.confirmation
  }

  let changed = false
  const nextQuestions = questions.map((question) => {
    if (
      isCompletedBlueprintConfirmationQuestion(question)
      || question.questionKind === 'note_only'
    ) {
      return question
    }
    const target = resolveQuestionFieldTarget(question, options.forms)
    const decision = target
      ? options.resolveFieldSourceDecision(target.form, target.field)
      : null
    if (!target || !decision) {
      return question
    }
    changed = true
    return {
      ...question,
      title: decision.title,
      questionKind: 'note_only' as const,
      description: undefined,
      options: undefined,
      selectedOptionValue: undefined,
      required: false,
      uncertainty: {
        category: 'safe_default' as const,
        reasonCode: decision.reasonCode,
      },
    }
  })

  return changed
    ? { ...options.confirmation, questions: nextQuestions }
    : options.confirmation
}

export const BLUEPRINT_FIELD_KEEP_AS_TEXT_OPTION_VALUE = 'keep-as-text'

// “先不关联”只把问题收口为已确认，不写 source、不改组件类型：
// 结果与今天“一直不答”完全一致，只是让用户一键说清楚。
export const attachBlueprintFieldKeepAsTextOptions = (options: {
  confirmation: NocodeEditorAiConfirmPayload | null | undefined
  relationQuestionTitles: Set<string>
}) => {
  const questions = Array.isArray(options.confirmation?.questions)
    ? options.confirmation.questions
    : []
  if (!options.confirmation || !questions.length || !options.relationQuestionTitles.size) {
    return options.confirmation
  }
  let changed = false
  const nextQuestions = questions.map((question) => {
    const title = normalizeDecisionText(question.title)
    if (
      !options.relationQuestionTitles.has(title)
      || isCompletedBlueprintConfirmationQuestion(question)
      || question.questionKind === 'note_only'
      || (Array.isArray(question.options) && question.options.length > 0)
    ) {
      return question
    }
    changed = true
    return {
      ...question,
      questionKind: 'single_select' as const,
      description: question.description
        || '要关联其他表单，可点“补充说明”写明表单和字段。',
      options: [{
        value: BLUEPRINT_FIELD_KEEP_AS_TEXT_OPTION_VALUE,
        label: '先不关联',
        description: '按普通文本字段保留，之后仍可再补充关联。',
      }],
    }
  })
  return changed ? { ...options.confirmation, questions: nextQuestions } : options.confirmation
}

// 用户改口后只打标记、不改写答案：答案字段保持用户原始表述，
// 后续回合按标记优先推导字段类型，不再把旧答案钉回去，也不伪造“图片/通用文件”结论。
export const markBlueprintConfirmationDecisionSuperseded = (
  question: NocodeEditorAiConfirmQuestion,
  widgetType: string,
): NocodeEditorAiConfirmQuestion => ({
  ...question,
  supersededByWidgetType: normalizeDecisionText(widgetType) || undefined,
})

// 从本回合原始 patch 里收集字段显式声明的 widgetType（按表单+字段身份绑定，含子字段），
// 只保留非泛化的显式值——泛化值（textInput/numberInput/空）按既有口径视为“未声明”。
export const collectRawBlueprintFieldWidgetTypeMap = (options: {
  forms: NocodeEditorAiAppBlueprintForm[]
  rawForms: unknown
}) => {
  const result = new Map<NocodeEditorAiAppBlueprintField, string>()
  const rawForms = (Array.isArray(options.rawForms) ? options.rawForms : [])
    .filter((form): form is Record<string, any> => Boolean(form && typeof form === 'object' && !Array.isArray(form)))
  if (!rawForms.length) {
    return result
  }

  const resolveRawField = (
    field: NocodeEditorAiAppBlueprintField,
    rawFields: Array<Record<string, any>>,
  ) => {
    const fieldKey = normalizeDecisionText(field?.fieldKey)
    if (fieldKey) {
      const matchedByFieldKey = rawFields.find(candidate => normalizeDecisionText(candidate?.fieldKey) === fieldKey)
      if (matchedByFieldKey) {
        return matchedByFieldKey
      }
    }
    const nameToken = normalizeBlueprintIdentityToken(field?.name)
    if (!nameToken) {
      return undefined
    }
    return rawFields.find(candidate => normalizeBlueprintIdentityToken(candidate?.name) === nameToken)
  }

  const collectFieldWidgetTypes = (
    fields: NocodeEditorAiAppBlueprintField[],
    rawFields: Array<Record<string, any>>,
  ) => {
    fields.forEach((field) => {
      const rawField = resolveRawField(field, rawFields)
      if (!rawField) {
        return
      }
      const rawWidgetType = resolveBlueprintExplicitWidgetType(rawField.widgetType)
      if (rawWidgetType && !isGenericBlueprintWidgetType(rawWidgetType)) {
        result.set(field, rawWidgetType)
      }
      const rawChildren = Array.isArray(rawField.children)
        ? rawField.children.filter((child: unknown): child is Record<string, any> => Boolean(child && typeof child === 'object'))
        : []
      const children = Array.isArray(field.children) ? field.children : []
      if (rawChildren.length && children.length) {
        collectFieldWidgetTypes(children, rawChildren)
      }
    })
  }

  const forms = Array.isArray(options.forms) ? options.forms : []
  forms.forEach((form) => {
    const rawForm = rawForms.find(candidate => isSameNocodeEditorBlueprintForm(candidate, form))
    if (!rawForm) {
      return
    }
    const rawFields = Array.isArray(rawForm.fields)
      ? rawForm.fields.filter((field: unknown): field is Record<string, any> => Boolean(field && typeof field === 'object'))
      : []
    collectFieldWidgetTypes(Array.isArray(form.fields) ? form.fields : [], rawFields)
  })

  return result
}

export const applyBlueprintConfirmationFieldDecisions = (
  blueprint: NocodeEditorAiAppBlueprint,
  options: {
    rawFieldWidgetTypeMap?: Map<NocodeEditorAiAppBlueprintField, string>
  } = {},
) => {
  const confirmation = blueprint.confirmation
  const questions = Array.isArray(confirmation?.questions)
    ? confirmation.questions.filter(isCompletedBlueprintConfirmationQuestion)
    : []
  if (!questions.length) {
    return
  }

  const conflictingDecisions: Array<{
    question: NocodeEditorAiConfirmQuestion
    widgetType: string
  }> = []
  const visitedConflicts = new Set<NocodeEditorAiConfirmQuestion>()

  const visitFields = (
    form: NocodeEditorAiAppBlueprintForm,
    fields: NocodeEditorAiAppBlueprintField[],
  ) => {
    fields.forEach((field) => {
      const decision = questions.find(question => (
        doesBlueprintConfirmationQuestionTargetField({ question, form, field })
      ))
      const decisionWidgetType = decision ? resolveBlueprintConfirmationWidgetType(decision) : undefined
      const explicitPatchWidgetType = options.rawFieldWidgetTypeMap?.get(field)
      if (
        decision
        && decisionWidgetType
        && explicitPatchWidgetType
        && explicitPatchWidgetType !== decisionWidgetType
      ) {
        if (!visitedConflicts.has(decision)) {
          visitedConflicts.add(decision)
          conflictingDecisions.push({ question: decision, widgetType: explicitPatchWidgetType })
        }
      } else if (decisionWidgetType) {
        field.widgetType = decisionWidgetType
      }
      if (Array.isArray(field.children) && field.children.length) {
        visitFields(form, field.children)
      }
    })
  }

  blueprint.forms.forEach(form => visitFields(form, form.fields))

  if (conflictingDecisions.length && Array.isArray(confirmation?.questions)) {
    conflictingDecisions.forEach(({ question, widgetType }) => {
      const index = confirmation.questions.indexOf(question)
      if (index < 0) {
        return
      }
      confirmation.questions[index] = markBlueprintConfirmationDecisionSuperseded(question, widgetType)
    })
  }
}
