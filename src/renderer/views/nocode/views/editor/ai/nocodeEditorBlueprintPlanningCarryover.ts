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
    formName?: string
    fieldKey: string
    fieldName?: string
  }
  selectedOptionValue?: string
  selectedOptionLabel?: string
  // 蓝图阶段的待确认项是纯文本问题（没有可选项），用户只能通过补充说明作答，
  // 因此答案文本必须一并带上，否则"已决策"无法被识别。
  answerText?: string
}

export type NocodeEditorBlueprintPlanningFieldStrategyScope =
  | 'relation-domain'
  | 'all-master-data'

export type NocodeEditorBlueprintPlanningFieldStrategyHint = {
  sourceQuestionId: string
  sourceQuestionTitle: string
  targetFieldKey?: string
  // 全局默认（all-master-data）没有具体域名，允许为空串。
  relationDomain: string
  scope?: NocodeEditorBlueprintPlanningFieldStrategyScope
  strategyKey: 'text-first'
  selectedOptionValue?: string
  selectedOptionLabel?: string
  suppressSourceClarification: boolean
  keepWidgetType: 'widget.form.textInput'
  deferSourceBinding: boolean
  upgradeableToRelation: boolean
}

export type NocodeEditorBlueprintPlanningRelationBinding = {
  sourceQuestionId: string
  sourceQuestionTitle: string
  // 只接受能解析出“X表/X表单/X列表”的答案；没有表名时仍走确认卡。
  tableName: string
  displayFieldName?: string
  // 能识别出主数据域时用于批量匹配字段；为空时只能靠 targetFieldKey 绑定。
  relationDomain: string
  targetFieldKey?: string
  // 作答时那张表单；为空表示应用级答复，仍按旧行为作用于全部表单。
  ownerFormKey?: string
  ownerFormName?: string
}

export type NocodeEditorBlueprintPlanningOwnerForm = {
  formKey?: string
  formName?: string
}

export type NocodeEditorBlueprintPlanningCarryover = {
  sourceStage?: NocodeEditorAiConfirmStage
  resolvedQuestionIds: string[]
  resolvedQuestions: NocodeEditorBlueprintPlanningResolvedQuestion[]
  fieldStrategyHints: NocodeEditorBlueprintPlanningFieldStrategyHint[]
  relationBindings: NocodeEditorBlueprintPlanningRelationBinding[]
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
  relationBindings: [],
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

const RELATION_NEGATED_LEAD_IN_PATTERN = /[不别没未无]/

// “不要关联/不想选表”这类否定表述里的关联词不能当作“要关联”的指认：
// 命中别名前 3 个字符窗口内出现否定标记即视为否定，交由调用方落安全态。
const hasNegatedRelationSignal = (value: unknown) => {
  const normalizedText = normalizeToken(value)
  if (!normalizedText) {
    return false
  }
  return RELATION_TARGET_SIGNAL_ALIASES.some((alias) => {
    const normalizedAlias = normalizeToken(alias)
    if (!normalizedAlias) {
      return false
    }
    let index = normalizedText.indexOf(normalizedAlias)
    while (index >= 0) {
      const leadIn = normalizedText.slice(Math.max(0, index - 3), index)
      if (RELATION_NEGATED_LEAD_IN_PATTERN.test(leadIn)) {
        return true
      }
      index = normalizedText.indexOf(normalizedAlias, index + 1)
    }
    return false
  })
}

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
    return hasNegatedRelationSignal(value) ? 'text' : 'relation'
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
    // 蓝图阶段的自由文本答案只存在于 answerText，关联目标经常只写在这里。
    question.answerText,
  ].filter(Boolean).join(' '))

  for (const [domain, aliases] of Object.entries(RELATION_DOMAIN_ALIASES)) {
    if (aliases.some(alias => normalizedText.includes(normalizeToken(alias)))) {
      return domain
    }
  }

  return ''
}

const GLOBAL_RELATION_QUESTION_PATTERN =
  /(是否|需不需要|要不要|有没有).{0,6}(关联|引用|使用).{0,6}(其他|其它|别的)?(表单|表|主数据)/

const MASTER_DATA_ALIAS_TOKENS = Array.from(new Set(
  Object.values(RELATION_DOMAIN_ALIASES)
    .flat()
    .map(alias => normalizeToken(alias))
    .filter(Boolean),
))

// 全局关联问题没有域名、没有字段目标，但它的否定答复应当约束所有主数据字段。
// 题面一旦点名了具体主数据对象（客户/项目/班级…），就仍按字段级问题处理。
const isGlobalRelationStrategyQuestion = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
) => {
  if (question.decisionTarget) {
    return false
  }
  const title = normalizeText(question.title)
  if (!GLOBAL_RELATION_QUESTION_PATTERN.test(title)) {
    return false
  }
  if (resolveRelationDomain(question)) {
    return false
  }
  const normalizedTitle = normalizeToken(title)
  return !MASTER_DATA_ALIAS_TOKENS.some(alias => normalizedTitle.includes(alias))
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

const isRelationSelection = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
) => [
  question.selectedOptionValue,
  question.selectedOptionLabel,
  question.answerText,
].map(normalizeText).filter(Boolean).some(value => (
  resolveSourceAnswerKind(question, value) === 'relation'
))

type ConfirmedFieldDecisionInput = {
  carryover?: NocodeEditorBlueprintPlanningCarryover | null
  formKey?: string
  fieldKey?: string
  fieldName: string
  formCount: number
  fieldNameOccurrenceCount: number
}

const questionTargetsField = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
  input: ConfirmedFieldDecisionInput,
) => {
  const fieldKey = normalizeToken(input.fieldKey)
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
  const fieldName = normalizeToken(input.fieldName)
  return input.formCount === 1
    && input.fieldNameOccurrenceCount === 1
    && fieldName.length >= 2
    && normalizeToken(question.title).includes(fieldName)
    && /关联|其他表|手填|来源|选择|relation|source/i.test(question.title)
}

export const resolveConfirmedTextFirstFieldDecision = (
  input: ConfirmedFieldDecisionInput,
) => input.carryover?.resolvedQuestions.find(question => (
  isTextFirstSelection(question) && questionTargetsField(question, input)
)) || null

// 字段级已确认“要关联”时，任何全局默认都不能再把它降级成文本。
export const resolveConfirmedRelationFieldDecision = (
  input: ConfirmedFieldDecisionInput,
) => input.carryover?.resolvedQuestions.find(question => (
  isRelationSelection(question) && questionTargetsField(question, input)
)) || null

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
  if (!isTextFirstSelection(question)) {
    return null
  }

  const relationDomain = resolveRelationDomain(question)
  const targetFieldKey = normalizeText(question.decisionTarget?.fieldKey)
  if (relationDomain || targetFieldKey) {
    return {
      sourceQuestionId: question.id,
      sourceQuestionTitle: question.title,
      targetFieldKey: question.decisionTarget?.fieldKey,
      relationDomain,
      scope: 'relation-domain',
      strategyKey: 'text-first',
      selectedOptionValue: question.selectedOptionValue,
      selectedOptionLabel: question.selectedOptionLabel,
      suppressSourceClarification: true,
      keepWidgetType: 'widget.form.textInput',
      deferSourceBinding: true,
      upgradeableToRelation: true,
    }
  }

  if (!isGlobalRelationStrategyQuestion(question)) {
    return null
  }

  return {
    sourceQuestionId: question.id,
    sourceQuestionTitle: question.title,
    relationDomain: '',
    scope: 'all-master-data',
    strategyKey: 'text-first',
    selectedOptionValue: question.selectedOptionValue,
    selectedOptionLabel: question.selectedOptionLabel,
    suppressSourceClarification: true,
    keepWidgetType: 'widget.form.textInput',
    deferSourceBinding: true,
    upgradeableToRelation: true,
  }
}

const appendUnique = (values: string[], value: string) => {
  if (value && !values.includes(value)) {
    values.push(value)
  }
}

const RELATION_TABLE_SUFFIXES = ['表单', '列表', '台账', '表']
// “是否需要关联其他表单”里的“其他表单”不是表名，必须排除。
const GENERIC_RELATION_TABLE_NAMES = new Set([
  '表单', '表', '列表', '台账',
  '其他表单', '其它表单', '别的表单',
  '其他表', '其它表', '别的表',
])
const RELATION_BINDING_VERB_PATTERN =
  /(?:关联|绑定|引用|来源|改用|使用|选择|选用|连接(?:到|至)?)(?:到|为|至|：|:)?\s*/g
const RELATION_TABLE_TOKEN_PATTERN =
  /[^，。；、\s“”"「」（）()]{2,24}?(?:表单|列表|台账|表)/g
const RELATION_DISPLAY_FIELD_PATTERN =
  /(?:显示字段|显示名称|展示字段|展示名称)(?:为|用|：|:)?\s*[“"「]?([^“”"「」，。；、\s]{1,20})/

const resolveRelationTableNames = (value: unknown) => {
  const names: string[] = []
  const text = normalizeText(value)
  if (!text) {
    return names
  }

  for (const verbMatch of text.matchAll(RELATION_BINDING_VERB_PATTERN)) {
    // 只看动词之后、第一个逗号/句号之前的片段；多表用“和/与/及”并列。
    const segment = text
      .slice((verbMatch.index || 0) + verbMatch[0].length)
      .split(/[，。；]/)[0]
    for (const tableMatch of segment.matchAll(RELATION_TABLE_TOKEN_PATTERN)) {
      const candidate = tableMatch[0]
        .replace(/^[和与及、]+/, '')
        .replace(/[“”"「」]/g, '')
      // 少于 3 个字（如“A表”）容易误判，按未知处理。
      if (candidate.length < 3 || GENERIC_RELATION_TABLE_NAMES.has(candidate)) {
        continue
      }
      if (RELATION_TABLE_SUFFIXES.some(suffix => candidate.endsWith(suffix))) {
        appendUnique(names, candidate)
      }
    }
  }
  return names
}

const resolveRelationDisplayFieldName = (value: unknown) => (
  RELATION_DISPLAY_FIELD_PATTERN.exec(normalizeText(value))?.[1]
    ?.replace(/[“”"「」]/g, '')
    .trim() || ''
)

const resolveBindingOwnerForm = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
  planningOwnerForm?: NocodeEditorBlueprintPlanningOwnerForm | null,
): NocodeEditorBlueprintPlanningOwnerForm | null => {
  const target = question.decisionTarget
  if (
    target?.kind === 'field-source'
    && (normalizeText(target.formKey) || normalizeText(target.formName))
  ) {
    return {
      formKey: normalizeText(target.formKey) || undefined,
      formName: normalizeText(target.formName) || undefined,
    }
  }
  return planningOwnerForm || null
}

const buildRelationBindings = (
  question: NocodeEditorBlueprintPlanningResolvedQuestion,
  planningOwnerForm?: NocodeEditorBlueprintPlanningOwnerForm | null,
): NocodeEditorBlueprintPlanningRelationBinding[] => {
  if (!isRelationSelection(question)) {
    return []
  }

  const answerText = [
    question.answerText,
    question.selectedOptionLabel,
    question.selectedOptionValue,
  ].map(normalizeText).filter(Boolean).join(' ')
  const tableNames = resolveRelationTableNames(answerText)
  if (!tableNames.length) {
    return []
  }
  // “客户表或项目表”“客户表还是项目表”是在给备选，不是同时关联；不猜，交给确认卡。
  if (tableNames.length > 1 && /还是|或者|或/.test(answerText)) {
    return []
  }

  const displayFieldName = resolveRelationDisplayFieldName(answerText)
  const questionDomain = resolveRelationDomain(question)
  const targetFieldKey = normalizeText(question.decisionTarget?.fieldKey)
  const resolveTableDomain = (tableName: string) => (
    resolveRelationDomain({ id: '', title: tableName }) || questionDomain
  )
  const ownerForm = resolveBindingOwnerForm(question, planningOwnerForm)

  return tableNames.map((tableName) => {
    const relationDomain = resolveTableDomain(tableName)
    // 没有域名也没有字段目标时，无法判断这条绑定该落给哪些字段，交给逐字段确认。
    if (!relationDomain && !targetFieldKey) {
      return null
    }
    return {
      sourceQuestionId: question.id,
      sourceQuestionTitle: question.title,
      tableName,
      ...(displayFieldName ? { displayFieldName } : {}),
      relationDomain,
      ...(targetFieldKey ? { targetFieldKey } : {}),
      ...(ownerForm?.formKey ? { ownerFormKey: ownerForm.formKey } : {}),
      ...(ownerForm?.formName ? { ownerFormName: ownerForm.formName } : {}),
    }
  }).filter(Boolean) as NocodeEditorBlueprintPlanningRelationBinding[]
}

export const resolveNocodeEditorBlueprintPlanningCarryover = (
  confirmation?: NocodeEditorAiConfirmPayload | null,
  options: {
    // 作答时那张表单；只在单表单规划里由调用方提供。
    ownerForm?: NocodeEditorBlueprintPlanningOwnerForm | null
  } = {},
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
  // 应用级规划（app-plan）的题面本身就是全应用，显式忽略 owner。
  // 蓝图阶段会把已答的规划题原样回填，所以不能按 stage === 'form-plan' 过滤，
  // 否则回填副本会退化成全局绑定，问题原样复现。
  const planningOwnerForm = confirmation?.stage === 'app-plan'
    ? null
    : (options.ownerForm || null)
  const relationBindings = resolvedQuestions
    .flatMap(question => buildRelationBindings(question, planningOwnerForm))

  return {
    sourceStage: confirmation?.stage,
    resolvedQuestionIds,
    resolvedQuestions,
    fieldStrategyHints,
    relationBindings,
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
    || (carryover.relationBindings || []).length
  ),
)

export const mergeNocodeEditorBlueprintPlanningCarryovers = (
  ...values: Array<NocodeEditorBlueprintPlanningCarryover | null | undefined>
): NocodeEditorBlueprintPlanningCarryover => {
  const resolvedQuestionIds = new Set<string>()
  const resolvedQuestionKeys = new Set<string>()
  const fieldStrategyHintKeys = new Set<string>()
  const relationBindingIndexes = new Map<string, number>()
  const resolvedQuestions: NocodeEditorBlueprintPlanningResolvedQuestion[] = []
  const fieldStrategyHints: NocodeEditorBlueprintPlanningFieldStrategyHint[] = []
  const relationBindings: NocodeEditorBlueprintPlanningRelationBinding[] = []
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
    ;(carryover.relationBindings || []).forEach((binding) => {
      // 去重键仍是“同一道题 + 同一张目标表”。
      const key = `${normalizeText(binding.sourceQuestionId)}::${normalizeText(binding.tableName)}`
      if (!key) {
        return
      }
      const existingIndex = relationBindingIndexes.get(key)
      if (existingIndex === undefined) {
        relationBindingIndexes.set(key, relationBindings.length)
        relationBindings.push(binding)
        return
      }
      // 作答归属优先：规划阶段的绑定带 owner，蓝图阶段的回填副本可能不带。
      // 不把 owner 塞进去重键——那样两条都会留下，无 owner 的那条按“全局答复”生效。
      const existing = relationBindings[existingIndex]
      const existingHasOwner = Boolean(
        normalizeText(existing.ownerFormKey) || normalizeText(existing.ownerFormName),
      )
      const incomingHasOwner = Boolean(
        normalizeText(binding.ownerFormKey) || normalizeText(binding.ownerFormName),
      )
      if (incomingHasOwner && !existingHasOwner) {
        relationBindings[existingIndex] = binding
      }
    })
  })

  return {
    sourceStage,
    resolvedQuestionIds: Array.from(resolvedQuestionIds),
    resolvedQuestions,
    fieldStrategyHints,
    relationBindings,
  }
}
