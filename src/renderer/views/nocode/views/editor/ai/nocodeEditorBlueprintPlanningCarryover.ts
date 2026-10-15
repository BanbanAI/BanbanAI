import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionOption,
  NocodeEditorAiConfirmStage,
} from '@common/types/nocodeEditorConfirmation'

export type NocodeEditorBlueprintPlanningResolvedQuestion = {
  id: string
  title: string
  decisionKey?: string
  decisionTarget?: {
    kind: 'field-source'
    formKey?: string
    fieldKey: string
  }
  selectedOptionValue?: string
  selectedOptionLabel?: string
  // 蓝图阶段的待确认项是纯文本问题（没有可选项），用户只能通过补充说明作答，
  // 因此答案文本必须一并带上，否则"已决策"无法被识别。
  answerText?: string
}

export type NocodeEditorBlueprintPlanningFieldStrategyHint = {
  sourceQuestionId: string
  sourceQuestionTitle: string
  targetFieldKey?: string
  relationDomain: string
  strategyKey: 'text-first'
  selectedOptionValue?: string
  selectedOptionLabel?: string
  suppressSourceClarification: boolean
  keepWidgetType: 'widget.form.textInput'
  deferSourceBinding: boolean
  upgradeableToRelation: boolean
}

export type NocodeEditorBlueprintPlanningCarryover = {
  sourceStage?: NocodeEditorAiConfirmStage
  resolvedQuestionIds: string[]
  resolvedQuestions: NocodeEditorBlueprintPlanningResolvedQuestion[]
  fieldStrategyHints: NocodeEditorBlueprintPlanningFieldStrategyHint[]
}

const CARRYOVER_STAGES = new Set<NocodeEditorAiConfirmStage>([
  'app-plan',
  'form-plan',
  'content-plan',
  // 蓝图阶段自身确认过的待确认项同样属于已决策范围，否则下一版蓝图会重新推导同一问题。
  'blueprint',
])

const EMPTY_CARRYOVER = (): NocodeEditorBlueprintPlanningCarryover => ({
  resolvedQuestionIds: [],
  resolvedQuestions: [],
  fieldStrategyHints: [],
})

const normalizeText = (value: unknown) => (
  value == null ? '' : String(value).trim()
)

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

const normalizeStrategyToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-/\\]/g, '')

const RELATION_DOMAIN_ALIASES: Record<string, string[]> = {
  customer: [
    'customer',
    'client',
    '\u5ba2\u6237',
    '\u5ba2\u6237\u540d\u79f0',
  ],
  supplier: [
    'supplier',
    'vendor',
    '\u4f9b\u5e94\u5546',
  ],
  warehouse: [
    'warehouse',
    '\u4ed3\u5e93',
  ],
  store: [
    'store',
    'shop',
    '\u95e8\u5e97',
    '\u5e97\u94fa',
  ],
  class: [
    'class',
    '\u73ed\u7ea7',
  ],
  course: [
    'course',
    '\u8bfe\u7a0b',
  ],
  project: [
    'project',
    '\u9879\u76ee',
  ],
  contract: [
    'contract',
    '\u5408\u540c',
  ],
  material: [
    'material',
    '\u7269\u6599',
  ],
  product: [
    'product',
    '\u4ea7\u54c1',
    '\u5546\u54c1',
  ],
}

const TEXT_FIRST_OPTION_TOKENS = new Set([
  'textfirst',
  'manual',
  'manualentry',
  'textinput',
  'freeinput',
])

const TEXT_FIRST_TEXT_ALIASES = [
  '\u624b\u586b',
  '\u624b\u52a8',
  '\u624b\u5de5',
  '\u6587\u672c',
  '\u76f4\u63a5\u8f93\u5165',
  '\u81ea\u7531\u5f55\u5165',
]

// “先留空 / 暂不关联 / 不需要”这类否定或延后答复属于封闭词类，同样意味着先按文本处理。
const DEFERRED_BINDING_TEXT_ALIASES = [
  '\u7559\u7a7a',
  '\u6682\u4e0d',
  '\u5148\u4e0d',
  '\u4e0d\u5173\u8054',
  '\u4e0d\u9700\u8981',
  '\u4e0d\u7528',
  '\u65e0\u9700',
  '\u4e0d\u5fc5',
  '\u4e0d\u662f',
  '\u6ca1\u5fc5\u8981',
  '\u7b97\u4e86',
  '\u5c31\u8fd9\u6837',
]

const TEXT_FIRST_SELECTION_ALIASES = [
  ...TEXT_FIRST_TEXT_ALIASES,
  ...DEFERRED_BINDING_TEXT_ALIASES,
]

const NEGATIVE_ANSWER_TOKENS = new Set([
  '\u5426',
  '\u4e0d',
  '\u6ca1\u6709',
])

const AFFIRMATIVE_ANSWER_TOKENS = [
  '\u662f',
  '\u662f\u7684',
  '\u5bf9',
  '\u5bf9\u7684',
  '\u8981',
  '\u9700\u8981',
  '\u597d',
  '\u597d\u7684',
  '\u53ef\u4ee5',
  '\u884c',
  '\u6ca1\u95ee\u9898',
  'ok',
  'yes',
]

// 回答指认了具体关联目标或绑定动作时按“要关联”处理。这里只认目标词与
// 绑定动作这类有界信号，避免回答复述字段名（如“费用项目”）被误判为要关联。
const RELATION_TARGET_SIGNAL_ALIASES = [
  '\u8868',
  '\u8868\u5355',
  '\u5217\u8868',
  '\u4e3b\u6570\u636e',
  '\u53f0\u8d26',
  '\u5173\u8054',
  '\u7ed1\u5b9a',
  '\u5f15\u7528',
  '\u6765\u81ea',
  '\u6765\u6e90',
  '\u9009\u7528',
  '\u9009\u53d6',
  '\u6311\u9009',
  '\u9009\u62e9',
  '\u9009',
  '\u6311',
  'table',
  'form',
  'lookup',
  'relation',
  'source',
  'select',
  'choose',
  'pick',
  'bind',
  'link',
  'relate',
]

const containsAlias = (value: unknown, aliases: string[]) => {
  const normalizedText = normalizeToken(value)
  return Boolean(normalizedText)
    && aliases.some(alias => normalizedText.includes(normalizeToken(alias)))
}

const containsTextFirstTextAlias = (value: unknown) => (
  containsAlias(value, TEXT_FIRST_SELECTION_ALIASES)
)

const containsRelationTargetSignal = (value: unknown) => (
  containsAlias(value, RELATION_TARGET_SIGNAL_ALIASES)
)

const isNegativeAnswerToken = (value: unknown) => NEGATIVE_ANSWER_TOKENS.has(normalizeToken(value))

const isAffirmativeAnswer = (value: unknown) => {
  const normalizedText = normalizeToken(value)
  return Boolean(normalizedText) && AFFIRMATIVE_ANSWER_TOKENS.some((token) => {
    const normalizedToken = normalizeToken(token)
    return normalizedText === normalizedToken
      || (normalizedToken.length >= 2 && normalizedText.startsWith(normalizedToken))
  })
}

// 字段来源题的回答归宿只有“文本优先/关联”两种。先判否定与文本类措辞，
// 再判关联指认与肯定答复；都不命中时调用方按延后态（先文本、可升级）处理。
const classifyBlueprintSourceAnswer = (value: unknown): 'text' | 'relation' | 'affirmative' | '' => {
  if (containsTextFirstTextAlias(value)) {
    return 'text'
  }
  if (isNegativeAnswerToken(value)) {
    return 'text'
  }
  if (containsRelationTargetSignal(value)) {
    return 'relation'
  }
  if (isAffirmativeAnswer(value)) {
    return 'affirmative'
  }
  return ''
}

const resolveRelationDomain = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
) => {
  const idMatch = /^([a-z0-9]+)-source$/i.exec(question.id)
  if (idMatch) {
    return normalizeToken(idMatch[1])
  }

  const normalizedText = normalizeToken([
    question.id,
    question.title,
    question.selectedOptionValue,
    question.selectedOptionLabel,
  ].filter(Boolean).join(' '))

  for (const [domain, aliases] of Object.entries(RELATION_DOMAIN_ALIASES)) {
    if (aliases.some(alias => normalizedText.includes(normalizeToken(alias)))) {
      return domain
    }
  }

  return ''
}

// 题目把“手填”当作是/否待定项提问时（如“是否手填？”），肯定答复指向文本优先；
// “从其他表选择，还是手填？”这类并列选项题的肯定答复不构成手填决策。
const isTextFirstBinaryQuestion = (question: NocodeEditorBlueprintPlanningResolvedQuestion) => (
  containsTextFirstTextAlias(question.title)
  && !/(还是|或者)/.test(question.title)
)

const resolveSourceAnswerKind = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
  value: unknown,
): 'text' | 'relation' | 'affirmative' | '' => {
  const answerKind = classifyBlueprintSourceAnswer(value)
  if (answerKind === 'affirmative' && isTextFirstBinaryQuestion(question)) {
    return 'text'
  }
  return answerKind
}

const isTextFirstSelection = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
) => {
  const selectedValueToken = normalizeStrategyToken(question.selectedOptionValue)
  if (TEXT_FIRST_OPTION_TOKENS.has(selectedValueToken)) {
    return true
  }

  // 结构化选择逐字段判定，避免 value 与 label 拼接后破坏“否”这类短词匹配。
  const structuredAnswerValues = [
    question.selectedOptionValue,
    question.selectedOptionLabel,
  ].filter(value => Boolean(normalizeText(value)))
  if (structuredAnswerValues.length) {
    return structuredAnswerValues
      .map(value => resolveSourceAnswerKind(question, value))
      .includes('text')
  }

  // 蓝图阶段的待确认项没有可选项，只能靠补充说明作答，此时答案文本就是决策依据。
  const answerText = normalizeText(question.answerText)
  if (answerText) {
    const answerKind = resolveSourceAnswerKind(question, answerText)
    if (answerKind) {
      return answerKind === 'text'
    }
    // 未识别出明确措辞的回答按“先文本、可升级”的延后态处理，避免静默无决策。
    return true
  }

  return containsTextFirstTextAlias(question.title)
}

export const resolveConfirmedTextFirstFieldDecision = (input: {
  carryover?: NocodeEditorBlueprintPlanningCarryover | null
  formKey?: string
  fieldKey?: string
  fieldName: string
  formCount: number
  fieldNameOccurrenceCount: number
}) => {
  const fieldKey = normalizeToken(input.fieldKey)
  const fieldName = normalizeToken(input.fieldName)
  return input.carryover?.resolvedQuestions.find(question => {
    if (!isTextFirstSelection(question)) {
      return false
    }
    const target = question.decisionTarget
    if (target) {
      const targetFieldKey = normalizeToken(target.fieldKey.split(/[./]/).pop())
      const sameForm = !target.formKey
        || normalizeToken(target.formKey) === normalizeToken(input.formKey)
        || (input.formCount === 1 && input.fieldNameOccurrenceCount === 1)
      return target.kind === 'field-source'
        && targetFieldKey === fieldKey
        && sameForm
    }
    const title = normalizeToken(question.title)
    return input.formCount === 1
      && input.fieldNameOccurrenceCount === 1
      && fieldName.length >= 2
      && title.includes(fieldName)
      && /关联|其他表|手填|来源|选择|relation|source/i.test(question.title)
  }) || null
}

const resolveSelectedOptionValue = (
  question?: NocodeEditorAiConfirmQuestion | null,
) => {
  const explicitValue = normalizeText(question?.selectedOptionValue)
  if (explicitValue) {
    return explicitValue
  }

  const options = Array.isArray(question?.options) ? question.options : []
  return normalizeText(options.find(option => option?.selected)?.value)
}

const resolveSelectedOption = (
  question?: NocodeEditorAiConfirmQuestion | null,
): NocodeEditorAiConfirmQuestionOption | null => {
  const selectedOptionValue = resolveSelectedOptionValue(question)
  const options = Array.isArray(question?.options) ? question.options : []
  return options.find((option) => (
    Boolean(option?.selected)
    || (
      Boolean(selectedOptionValue)
      && normalizeText(option?.value) === selectedOptionValue
    )
  )) || null
}

const isCompletedPlanningConfirmation = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
) => {
  const stage = confirmation?.stage
  if (!stage || !CARRYOVER_STAGES.has(stage)) {
    return false
  }

  return normalizeText(confirmation?.status) === 'completed'
}

const buildResolvedQuestion = (
  question: NocodeEditorAiConfirmQuestion,
): NocodeEditorBlueprintPlanningResolvedQuestion | null => {
  const id = normalizeText(question.id)
  const title = normalizeText(question.title)
  if (!id && !title) {
    return null
  }

  const selectedOptionValue = resolveSelectedOptionValue(question)
  const selectedOptionLabel = normalizeText(resolveSelectedOption(question)?.label)
  const answerText = normalizeText(question.answerDetail) || normalizeText(question.answerSummary)
  return {
    id,
    title,
    decisionKey: normalizeText(question.decisionKey) || undefined,
    decisionTarget: question.decisionTarget,
    selectedOptionValue: selectedOptionValue || undefined,
    selectedOptionLabel: selectedOptionLabel || undefined,
    answerText: answerText || undefined,
  }
}

const buildTextFirstStrategyHint = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
): NocodeEditorBlueprintPlanningFieldStrategyHint | null => {
  const relationDomain = resolveRelationDomain(question)
  const targetFieldKey = normalizeText(question.decisionTarget?.fieldKey)
  // 已带字段来源决策目标的题目不再要求从题面识别关联域，按字段身份绑定即可。
  if (!relationDomain && !targetFieldKey) {
    return null
  }

  if (!isTextFirstSelection(question)) {
    return null
  }

  return {
    sourceQuestionId: question.id,
    sourceQuestionTitle: question.title,
    targetFieldKey: question.decisionTarget?.fieldKey,
    relationDomain,
    strategyKey: 'text-first',
    selectedOptionValue: question.selectedOptionValue,
    selectedOptionLabel: question.selectedOptionLabel,
    suppressSourceClarification: true,
    keepWidgetType: 'widget.form.textInput',
    deferSourceBinding: true,
    upgradeableToRelation: true,
  }
}

export const resolveNocodeEditorBlueprintPlanningCarryover = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
): NocodeEditorBlueprintPlanningCarryover => {
  if (!isCompletedPlanningConfirmation(confirmation)) {
    return EMPTY_CARRYOVER()
  }

  const questions = Array.isArray(confirmation?.questions)
    ? confirmation.questions
    : []
  const resolvedQuestions = questions
    .map(buildResolvedQuestion)
    .filter(Boolean) as NocodeEditorBlueprintPlanningResolvedQuestion[]
  const resolvedQuestionIds = Array.from(new Set(
    resolvedQuestions
      .map(question => question.id)
      .filter(Boolean),
  ))
  const fieldStrategyHints = resolvedQuestions
    .map(buildTextFirstStrategyHint)
    .filter(Boolean) as NocodeEditorBlueprintPlanningFieldStrategyHint[]

  return {
    sourceStage: confirmation?.stage,
    resolvedQuestionIds,
    resolvedQuestions,
    fieldStrategyHints,
  }
}

export const hasNocodeEditorBlueprintPlanningCarryoverEntries = (
  carryover?: NocodeEditorBlueprintPlanningCarryover | null,
) => Boolean(
  carryover
  && (
    carryover.resolvedQuestionIds.length
    || carryover.resolvedQuestions.length
    || carryover.fieldStrategyHints.length
  ),
)

export const mergeNocodeEditorBlueprintPlanningCarryovers = (
  ...values: Array<NocodeEditorBlueprintPlanningCarryover | null | undefined>
): NocodeEditorBlueprintPlanningCarryover => {
  const resolvedQuestionIds = new Set<string>()
  const resolvedQuestionKeys = new Set<string>()
  const fieldStrategyHintKeys = new Set<string>()
  const resolvedQuestions: NocodeEditorBlueprintPlanningResolvedQuestion[] = []
  const fieldStrategyHints: NocodeEditorBlueprintPlanningFieldStrategyHint[] = []
  let sourceStage: NocodeEditorAiConfirmStage | undefined

  values.forEach((carryover) => {
    if (!carryover) {
      return
    }
    if (!sourceStage) {
      sourceStage = carryover.sourceStage
    }

    carryover.resolvedQuestionIds.forEach((id) => {
      const normalizedId = normalizeText(id)
      if (normalizedId) {
        resolvedQuestionIds.add(normalizedId)
      }
    })
    carryover.resolvedQuestions.forEach((question) => {
      const questionKey = normalizeText(question.id) || normalizeText(question.title)
      if (!questionKey || resolvedQuestionKeys.has(questionKey)) {
        return
      }
      resolvedQuestionKeys.add(questionKey)
      resolvedQuestions.push(question)
    })
    carryover.fieldStrategyHints.forEach((hint) => {
      const hintKey = [
        normalizeToken(hint.sourceQuestionId),
        normalizeToken(hint.relationDomain),
        normalizeText(hint.strategyKey),
      ].join(':')
      if (fieldStrategyHintKeys.has(hintKey)) {
        return
      }
      fieldStrategyHintKeys.add(hintKey)
      fieldStrategyHints.push(hint)
    })
  })

  return {
    sourceStage,
    resolvedQuestionIds: Array.from(resolvedQuestionIds),
    resolvedQuestions,
    fieldStrategyHints,
  }
}
