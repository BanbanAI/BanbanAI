import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionOption,
  NocodeEditorAiConfirmStage,
} from '@common/types/nocodeEditorConfirmation'

export type NocodeEditorBlueprintPlanningResolvedQuestion = {
  id: string
  title: string
  selectedOptionValue?: string
  selectedOptionLabel?: string
}

export type NocodeEditorBlueprintPlanningFieldStrategyHint = {
  sourceQuestionId: string
  sourceQuestionTitle: string
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

const PLANNING_STAGES = new Set<NocodeEditorAiConfirmStage>([
  'app-plan',
  'form-plan',
  'content-plan',
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
  project: [
    'project',
    '\u9879\u76ee',
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

const containsTextFirstTextAlias = (value: unknown) => {
  const normalizedText = normalizeToken(value)
  return Boolean(normalizedText)
    && TEXT_FIRST_TEXT_ALIASES.some(alias => normalizedText.includes(normalizeToken(alias)))
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

const isTextFirstSelection = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
) => {
  const selectedValueToken = normalizeStrategyToken(question.selectedOptionValue)
  if (TEXT_FIRST_OPTION_TOKENS.has(selectedValueToken)) {
    return true
  }

  if (containsTextFirstTextAlias(question.selectedOptionValue)) {
    return true
  }

  if (selectedValueToken) {
    return false
  }

  if (normalizeText(question.selectedOptionLabel)) {
    return containsTextFirstTextAlias(question.selectedOptionLabel)
  }

  return containsTextFirstTextAlias(question.title)
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
  if (!stage || !PLANNING_STAGES.has(stage)) {
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
  return {
    id,
    title,
    selectedOptionValue: selectedOptionValue || undefined,
    selectedOptionLabel: selectedOptionLabel || undefined,
  }
}

const buildTextFirstStrategyHint = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
): NocodeEditorBlueprintPlanningFieldStrategyHint | null => {
  const relationDomain = resolveRelationDomain(question)
  if (!relationDomain) {
    return null
  }

  if (!isTextFirstSelection(question)) {
    return null
  }

  return {
    sourceQuestionId: question.id,
    sourceQuestionTitle: question.title,
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
