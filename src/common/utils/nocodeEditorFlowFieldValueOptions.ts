export type FlowFieldValueOptionDiagnostic = {
  code: 'field_value_option_not_in_enum'
  message: string
  questionId?: string
  questionTitle?: string
  decisionKey?: string
  fieldId?: string
  fieldName?: string
  invalidOptions: string[]
  validOptions: string[]
}

type UnknownRecord = Record<string, unknown>

type SummaryEnumField = {
  fieldId: string
  fieldName: string
  optionTokens: Set<string>
  optionLabels: string[]
}

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const text = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => text(value)
  .normalize('NFKC')
  .replace(/[\s\p{P}\p{S}]+/gu, '')
  .toLowerCase()

const normalizeMentionText = (value: unknown) => text(value)
  .normalize('NFKC')
  .replace(/\s+/g, '')

// 只对“问某字段该取什么值”的题做校验；“用哪个字段”这类字段选择题的选项是字段名，不属于枚举值。
const FIELD_VALUE_INTENT_REGEXP = /(值|状态|设置为|更新为|改为|写成|填什么|成什么|写入|回写)/
const FIELD_SELECTION_REGEXP = /(哪个字段|哪些字段|用哪个|字段作为|字段来源|来源字段|绑定字段)/
const FIELD_SELECTION_DECISION_KEY_REGEXP = /^flow\.(source|condition)\.field:/u

const collectSummaryEnumFields = (value: unknown): SummaryEnumField[] => {
  if (!isRecord(value)) {
    return []
  }
  const fieldId = text(value.fieldId)
  const fieldName = text(value.fieldName)
  const optionLabels: string[] = []
  const optionTokens = new Set<string>()
  if (Array.isArray(value.enumOptionsPreview)) {
    value.enumOptionsPreview.forEach((item) => {
      if (typeof item === 'string') {
        const normalized = item.trim()
        if (normalized) {
          optionLabels.push(normalized)
          optionTokens.add(normalizeToken(normalized))
        }
        return
      }
      if (!isRecord(item)) {
        return
      }
      const label = text(item.label) || text(item.value)
      const optionValue = text(item.value) || text(item.label)
      if (label) {
        optionLabels.push(label)
        optionTokens.add(normalizeToken(label))
      }
      if (optionValue) {
        optionTokens.add(normalizeToken(optionValue))
      }
    })
  }
  const current = fieldId && fieldName && optionTokens.size
    ? [{ fieldId, fieldName, optionTokens, optionLabels }]
    : []
  return [
    ...current,
    ...(Array.isArray(value.subFields) ? value.subFields.flatMap(collectSummaryEnumFields) : []),
  ]
}

const collectCurrentFormFields = (flowSummary: unknown): SummaryEnumField[] => {
  const forms = isRecord(flowSummary) && isRecord(flowSummary.forms) ? flowSummary.forms : null
  const currentForm = forms && isRecord(forms.currentForm) ? forms.currentForm : null
  return currentForm && Array.isArray(currentForm.fields)
    ? currentForm.fields.flatMap(collectSummaryEnumFields)
    : []
}

const isAnsweredQuestion = (question: UnknownRecord) => {
  if (question.confirmed === true || text(question.selectedOptionValue)) {
    return true
  }
  return Array.isArray(question.options)
    && question.options.some(option => isRecord(option) && option.selected === true)
}

const hasOptionsChange = (question: UnknownRecord) => (
  Array.isArray(question.changes)
  && question.changes.some(change => text(change) === 'options')
)

const collectQuestionOptionLabels = (question: UnknownRecord) => (
  (Array.isArray(question.options) ? question.options : [])
    .map((option) => {
      if (!isRecord(option)) {
        return ''
      }
      return text(option.value) || text(option.label)
    })
    .filter(Boolean)
)

const collectPendingValueQuestions = (scheme: unknown): UnknownRecord[] => {
  const record = isRecord(scheme) ? scheme : {}
  const confirmation = isRecord(record.confirmation) ? record.confirmation : {}
  return (Array.isArray(confirmation.questions) ? confirmation.questions : [])
    .filter((question): question is UnknownRecord => (
      isRecord(question)
      && question.questionKind !== 'binary'
      && question.questionKind !== 'note_only'
      && !isAnsweredQuestion(question)
      && hasOptionsChange(question)
    ))
}

export const hasFlowFieldValueOptionQuestions = (scheme: unknown) => (
  collectPendingValueQuestions(scheme).length > 0
)

const resolveTargetField = (input: {
  question: UnknownRecord
  enumFields: SummaryEnumField[]
  allFieldNameTokens: Set<string>
}): SummaryEnumField | null => {
  const question = input.question
  const mentionText = normalizeMentionText(`${text(question.title)} ${text(question.description)}`)
  if (!mentionText) {
    return null
  }
  if (FIELD_SELECTION_REGEXP.test(mentionText)) {
    return null
  }
  if (!FIELD_VALUE_INTENT_REGEXP.test(mentionText)) {
    return null
  }
  const matched = input.enumFields.filter(field => (
    field.fieldName.length >= 2 && mentionText.includes(normalizeMentionText(field.fieldName))
  ))
  if (matched.length !== 1) {
    return null
  }
  const [field] = matched
  // 选项本身全是字段名时，这题是在选字段而不是选值。
  const optionLabels = collectQuestionOptionLabels(question)
  if (
    optionLabels.length
    && optionLabels.every(option => input.allFieldNameTokens.has(normalizeToken(option)))
  ) {
    return null
  }
  return field
}

const collectAllFieldNameTokens = (value: unknown, tokens = new Set<string>()): Set<string> => {
  if (!isRecord(value)) {
    return tokens
  }
  const fieldName = text(value.fieldName)
  if (fieldName) {
    tokens.add(normalizeToken(fieldName))
  }
  if (Array.isArray(value.subFields)) {
    value.subFields.forEach(child => collectAllFieldNameTokens(child, tokens))
  }
  return tokens
}

const readAllFieldNameTokens = (flowSummary: unknown) => {
  const forms = isRecord(flowSummary) && isRecord(flowSummary.forms) ? flowSummary.forms : null
  const currentForm = forms && isRecord(forms.currentForm) ? forms.currentForm : null
  const tokens = new Set<string>()
  if (currentForm && Array.isArray(currentForm.fields)) {
    currentForm.fields.forEach(field => collectAllFieldNameTokens(field, tokens))
  }
  return tokens
}

export const validateFlowFieldValueOptions = (input: {
  scheme: unknown
  flowSummary: unknown
}): FlowFieldValueOptionDiagnostic[] => {
  const enumFields = collectCurrentFormFields(input.flowSummary)
  if (!enumFields.length) {
    return []
  }
  const allFieldNameTokens = readAllFieldNameTokens(input.flowSummary)
  const diagnostics: FlowFieldValueOptionDiagnostic[] = []
  collectPendingValueQuestions(input.scheme).forEach((question) => {
    if (isRecord(question.personnelDecision)) {
      return
    }
    const decisionTarget = isRecord(question.decisionTarget) ? question.decisionTarget : null
    if (text(decisionTarget?.kind) === 'field-source') {
      return
    }
    const decisionKey = text(question.decisionKey) || text(question.id)
    if (FIELD_SELECTION_DECISION_KEY_REGEXP.test(decisionKey)) {
      return
    }
    const field = resolveTargetField({ question, enumFields, allFieldNameTokens })
    if (!field) {
      return
    }
    const optionLabels = collectQuestionOptionLabels(question)
    if (!optionLabels.length) {
      return
    }
    const invalidOptions = optionLabels.filter(option => !field.optionTokens.has(normalizeToken(option)))
    if (!invalidOptions.length) {
      return
    }
    const questionTitle = text(question.title) || '未命名确认题'
    const validOptions = field.optionLabels
    diagnostics.push({
      code: 'field_value_option_not_in_enum',
      message: `确认题“${questionTitle}”的选项（${invalidOptions.join('、')}）不在字段「${field.fieldName}」的现有选项里；该字段现有选项是：${validOptions.join('、')}。请只使用字段已有选项，不要新增近义写法或英文变体。`,
      questionId: text(question.id) || undefined,
      questionTitle,
      decisionKey: decisionKey || undefined,
      fieldId: field.fieldId,
      fieldName: field.fieldName,
      invalidOptions,
      validOptions,
    })
  })
  return diagnostics
}
