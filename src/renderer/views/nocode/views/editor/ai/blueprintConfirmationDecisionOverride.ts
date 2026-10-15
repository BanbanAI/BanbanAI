import type {
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import { isSameNocodeEditorBlueprintForm } from '@common/utils/nocodeEditorBlueprintFormNormalization'
import {
  isGenericBlueprintWidgetType,
  resolveBlueprintExplicitWidgetType,
} from './blueprintFieldIntent'
import { normalizeBlueprintIdentityToken } from './blueprintDeletionIdentity'
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

const BLUEPRINT_UPLOADER_ANSWER_PATTERN_BY_WIDGET_TYPE: Record<string, RegExp> = {
  'widget.form.image-uploader': /(图片|照片|截图|图像|image)/u,
  'widget.form.file-uploader': /(通用文件|文件附件|上传文件|附件文件|file|attachment)/u,
}

const BLUEPRINT_UPLOADER_ANSWER_LABEL_BY_WIDGET_TYPE: Record<string, string> = {
  'widget.form.image-uploader': '图片',
  'widget.form.file-uploader': '通用文件',
}

// 用户改口后，把已完成的决定答案改写为新选择，使答案推导值与字段现状保持一致，
// 后续回合不会再按旧答案把字段钉回去。
export const supersedeBlueprintConfirmationDecisionAnswer = (
  question: NocodeEditorAiConfirmQuestion,
  widgetType: string,
): NocodeEditorAiConfirmQuestion => {
  const answerPattern = BLUEPRINT_UPLOADER_ANSWER_PATTERN_BY_WIDGET_TYPE[widgetType]
  const options = Array.isArray(question.options) ? question.options : undefined
  const matchedOption = answerPattern && options
    ? options.find(option => answerPattern.test(`${option.value || ''} ${option.label || ''}`))
    : undefined

  if (matchedOption) {
    return {
      ...question,
      selectedOptionValue: matchedOption.value,
      answerSummary: matchedOption.label,
      answerDetail: undefined,
      options: (options || []).map(option => ({
        ...option,
        selected: option.value === matchedOption.value,
      })),
    }
  }

  return {
    ...question,
    selectedOptionValue: undefined,
    answerSummary: BLUEPRINT_UPLOADER_ANSWER_LABEL_BY_WIDGET_TYPE[widgetType],
    answerDetail: undefined,
    options: options?.map(option => ({
      ...option,
      selected: false,
    })),
  }
}

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
      confirmation.questions[index] = supersedeBlueprintConfirmationDecisionAnswer(question, widgetType)
    })
  }
}
