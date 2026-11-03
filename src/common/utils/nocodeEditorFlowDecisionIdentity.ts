import type {
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
  NocodeEditorFlowSchemeQuestion,
  NocodeEditorFlowSchemeStep,
} from './nocodeEditorFlowScheme'
import {
  NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS,
  resolveNocodeEditorFlowPersonnelSourceOptionValue,
} from './nocodeEditorFlowPersonnelSourceOptions'

export type FlowPersonnelDecisionSlot = NonNullable<
  NocodeEditorAiConfirmQuestion['personnelDecision']
>['slot']

export type FlowPersonnelDecision = {
  stepKey: string
  slot: FlowPersonnelDecisionSlot
}

export type FlowDecisionPointRef = {
  key: string
  kind: 'personnel' | 'decision'
  stepKey?: string
  slot?: FlowPersonnelDecisionSlot
}

export type FlowDecisionStepLookup = Map<string, Pick<NocodeEditorFlowSchemeStep, 'key' | 'kind'>>

export type FlowPersonnelQuestionContractDiagnostic = {
  code: 'personnel_decision_missing'
  message: string
  questionId: string
  decisionKey?: string
  stepKey: string
  slot: FlowPersonnelDecisionSlot
}

export type FlowPersonnelSlotDiagnostic = {
  code: 'personnel_decision_question_kind_invalid' | 'personnel_decision_slot_options_invalid'
  message: string
  decisionKey?: string
}

const PERSONNEL_STEP_KINDS = new Set<NocodeEditorFlowSchemeStep['kind']>([
  'approval',
  'transact',
  'notify',
  'report-data',
])

const APPROVAL_ONLY_SLOTS = new Set<FlowPersonnelDecisionSlot>([
  'approval_level',
  'multi_person',
  'same_as_submitter',
])

const PERSONNEL_DECISION_SLOTS = new Set<FlowPersonnelDecisionSlot>([
  'source',
  'binding',
  'approval_level',
  'multi_person',
  'empty_handler',
  'same_as_submitter',
])

const LEVEL_OPTION_VALUE_PATTERN = /^(?:up|down)[_\-\s]*(?:level[_\-\s]*)?\d+$/iu
const LEVEL_OPTION_LABEL_PATTERN = /(?:向上|向下|上级|下级).{0,6}\d{1,2}\s*(?:级|层)/u

const normalizeText = (value: unknown) => String(value ?? '').trim()

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

export const buildFlowDecisionStepLookup = (
  scheme?: NocodeEditorFlowScheme | null,
): FlowDecisionStepLookup => {
  const steps: NocodeEditorFlowSchemeStep[] = [
    ...(Array.isArray(scheme?.mainPath) ? scheme!.mainPath : []),
    ...(Array.isArray(scheme?.branches)
      ? scheme!.branches.flatMap(branch => Array.isArray(branch.steps) ? branch.steps : [])
      : []),
  ]
  return new Map(steps.flatMap((step) => {
    const key = normalizeText(step.key)
    return key ? [[key, { key, kind: step.kind }] as const] : []
  }))
}

export const isFlowPersonnelStepKind = (
  kind?: NocodeEditorFlowSchemeStep['kind'],
) => Boolean(kind && PERSONNEL_STEP_KINDS.has(kind))

export const isFlowPersonnelDecisionSlotApplicable = (
  slot: FlowPersonnelDecisionSlot,
  kind?: NocodeEditorFlowSchemeStep['kind'],
) => {
  if (!isFlowPersonnelStepKind(kind)) {
    return false
  }
  return APPROVAL_ONLY_SLOTS.has(slot) ? kind === 'approval' : true
}

export const resolveStructuredPersonnelDecision = (
  decisionKey: unknown,
): Partial<FlowPersonnelDecision> | null => {
  const key = normalizeText(decisionKey)
  if (!key) {
    return null
  }
  if (key === 'flow.approval.owner' || key === 'flow.approval.owner.source') {
    return { slot: 'source' }
  }
  // 派生来源题按节点区分身份：flow.approval.owner.source:<stepKey>。
  const ownerSourcePointMatch = /^flow\.approval\.owner\.source:(.+)$/u.exec(key)
  if (ownerSourcePointMatch?.[1]) {
    return { stepKey: normalizeText(ownerSourcePointMatch[1]), slot: 'source' }
  }
  // 模型会按 <业务域>.owner.source.<stepKey> 写来源题；不识别会漏掉已确定来源的冗余题。
  const ownerSourceStepMatch = /^flow\.[a-z-]+\.owner\.source\.(.+)$/u.exec(key)
  if (ownerSourceStepMatch?.[1]) {
    return { stepKey: normalizeText(ownerSourceStepMatch[1]), slot: 'source' }
  }
  const emptyHandlerMatch = /^flow\.[a-z-]+\.owner\.empty_handler\.(.+)$/u.exec(key)
  if (emptyHandlerMatch?.[1]) {
    return { stepKey: normalizeText(emptyHandlerMatch[1]), slot: 'empty_handler' }
  }
  const fieldRefMatch = /^flow\.[a-z-]+\.owner\.field_ref\.(.+)$/u.exec(key)
  if (fieldRefMatch?.[1]) {
    return { stepKey: normalizeText(fieldRefMatch[1]), slot: 'binding' }
  }
  const personnelMatch = /^flow\.personnel:(.+):(source|binding|approval_level|multi_person|empty_handler|same_as_submitter)$/u.exec(key)
  if (personnelMatch?.[1] && PERSONNEL_DECISION_SLOTS.has(personnelMatch[2] as FlowPersonnelDecisionSlot)) {
    return {
      stepKey: normalizeText(personnelMatch[1]),
      slot: personnelMatch[2] as FlowPersonnelDecisionSlot,
    }
  }
  return null
}

const resolveQuestionScopeStepKey = (
  question: NocodeEditorAiConfirmQuestion,
) => (
  question.decisionScope?.kind === 'step'
    ? normalizeText(question.decisionScope.id)
    : ''
)

const withFallbackQuestionStep = (
  question: NocodeEditorAiConfirmQuestion,
  stepKey: string,
): NocodeEditorAiConfirmQuestion => (
  stepKey && !resolveQuestionScopeStepKey(question)
    ? { ...question, decisionScope: { kind: 'step', id: stepKey } }
    : question
)

const isLevelOption = (
  option: NonNullable<NocodeEditorAiConfirmQuestion['options']>[number],
) => (
  LEVEL_OPTION_VALUE_PATTERN.test(normalizeText(option.value))
  || LEVEL_OPTION_LABEL_PATTERN.test(`${normalizeText(option.label)} ${normalizeText(option.description)}`)
)

const isConcreteOwnerFieldOption = (
  option: NonNullable<NocodeEditorAiConfirmQuestion['options']>[number],
) => {
  if (/^use-existing-owner-field:/iu.test(normalizeText(option.value))) {
    return true
  }
  const candidate = option.personnelCandidate
  if (!candidate) {
    return false
  }
  return (candidate.sourceType === 'form_member' || candidate.sourceType === 'form_department')
    && Boolean(normalizeText(candidate.refId) || normalizeText(candidate.refName))
}

// 只按选项结构识别人员槽位：来源五选项、方向+级数选项、已绑定成员字段选项。
// 不按标题措辞兜底，避免文案漂移把普通业务题误判为人员决策。
export const inferFlowPersonnelSlotFromQuestionOptions = (
  question: NocodeEditorAiConfirmQuestion,
): FlowPersonnelDecisionSlot | null => {
  if (question.questionKind === 'note_only' || question.questionKind === 'binary') {
    return null
  }
  const options = Array.isArray(question.options) ? question.options : []
  if (options.length < 2 || options.some(option => !option)) {
    return null
  }

  const sourceValues = new Set(options.map(option => (
    resolveNocodeEditorFlowPersonnelSourceOptionValue(option)
  )))
  if (
    !sourceValues.has(null)
    && sourceValues.size >= 2
  ) {
    return 'source'
  }

  if (options.every(isLevelOption)) {
    return 'approval_level'
  }

  if (options.every(isConcreteOwnerFieldOption)) {
    return 'binding'
  }

  return null
}

export const inferFlowPersonnelDecision = (
  question: NocodeEditorAiConfirmQuestion,
  steps?: FlowDecisionStepLookup,
): FlowPersonnelDecision | null => {
  const explicit = question.personnelDecision
  if (explicit?.stepKey && PERSONNEL_DECISION_SLOTS.has(explicit.slot)) {
    return { stepKey: explicit.stepKey, slot: explicit.slot }
  }

  const structured = resolveStructuredPersonnelDecision(question.decisionKey)
  const stepKey = normalizeText(structured?.stepKey) || resolveQuestionScopeStepKey(question)
  const slot = structured?.slot || inferFlowPersonnelSlotFromQuestionOptions(question)
  if (!stepKey || !slot) {
    return null
  }
  if (steps) {
    const step = steps.get(stepKey)
    if (!step || !isFlowPersonnelDecisionSlotApplicable(slot, step.kind)) {
      return null
    }
  }
  return { stepKey, slot }
}

const resolvePersonnelStepKind = (input: {
  stepKey: string
  steps?: FlowDecisionStepLookup
  approvalOwner?: boolean
}) => {
  const stepKind = input.steps?.get(input.stepKey)?.kind
  if (stepKind) {
    return stepKind
  }
  return input.approvalOwner ? 'approval' as const : undefined
}

const APPROVAL_OWNER_DECISION_KEY = 'flow.approval.owner'

export const isApprovalOwnerDecision = (
  decision: FlowPersonnelDecision,
  input: {
    decisionKey?: unknown
    steps?: FlowDecisionStepLookup
  } = {},
) => {
  const decisionKey = normalizeText(input.decisionKey)
  if (
    decisionKey === APPROVAL_OWNER_DECISION_KEY
    || decisionKey === `${APPROVAL_OWNER_DECISION_KEY}.source`
    || decisionKey.startsWith(`${APPROVAL_OWNER_DECISION_KEY}.source:`)
  ) {
    return true
  }
  const stepKey = normalizeText(decision.stepKey)
  return Boolean(stepKey && input.steps?.get(stepKey)?.kind === 'approval')
}

export const resolveFlowPersonnelDecisionPointKey = (input: {
  decision: FlowPersonnelDecision
  steps?: FlowDecisionStepLookup
  approvalOwner?: boolean
}): string => {
  const stepKey = normalizeText(input.decision.stepKey)
  if (!stepKey) {
    return ''
  }
  const stepKind = resolvePersonnelStepKind({
    stepKey,
    steps: input.steps,
    approvalOwner: input.approvalOwner,
  })
  return input.decision.slot === 'source' && stepKind === 'approval'
    ? `flow.approval.owner.source:${stepKey}`
    : `flow.personnel:${stepKey}:${input.decision.slot}`
}

const buildDecisionPointRef = (
  key: string,
  personnel?: FlowPersonnelDecision,
): FlowDecisionPointRef => (
  personnel
    ? {
      key,
      kind: 'personnel',
      stepKey: personnel.stepKey,
      slot: personnel.slot,
    }
    : { key, kind: 'decision' }
)

const canonicalizeFlowDecisionKey = (value: unknown) => {
  const key = normalizeText(value)
  return key === 'flow.approval.owner.source' ? 'flow.approval.owner' : key
}

const resolveOpenQuestionStepKey = (
  openQuestion?: NocodeEditorFlowSchemeQuestion | null,
) => (
  openQuestion?.scopeKind === 'step' ? normalizeText(openQuestion.scopeKey) : ''
)

export const resolveFlowQuestionDecisionPointRef = (input: {
  question?: NocodeEditorAiConfirmQuestion | null
  openQuestion?: NocodeEditorFlowSchemeQuestion | null
  steps?: FlowDecisionStepLookup
}): FlowDecisionPointRef | null => {
  const question = input.question || null
  if (question) {
    const personnelDecision = inferFlowPersonnelDecision(
      withFallbackQuestionStep(question, resolveOpenQuestionStepKey(input.openQuestion)),
      input.steps,
    )
    if (personnelDecision) {
      const key = resolveFlowPersonnelDecisionPointKey({
        decision: personnelDecision,
        steps: input.steps,
        approvalOwner: isApprovalOwnerDecision(personnelDecision, {
          decisionKey: question.decisionKey,
          steps: input.steps,
        }),
      })
      if (key) {
        return buildDecisionPointRef(key, personnelDecision)
      }
    }
  }

  const structured = resolveStructuredPersonnelDecision(question?.decisionKey)
  if (structured?.slot === 'source') {
    const stepKey = resolveQuestionScopeStepKey(question!)
      || resolveOpenQuestionStepKey(input.openQuestion)
    if (stepKey) {
      const decision = { stepKey, slot: structured.slot }
      return buildDecisionPointRef(
        resolveFlowPersonnelDecisionPointKey({
          decision,
          steps: input.steps,
          approvalOwner: isApprovalOwnerDecision(decision, {
            decisionKey: question?.decisionKey,
            steps: input.steps,
          }),
        }),
        decision,
      )
    }
    // 没有步骤键时不产出伪全局人员键，交给下面的原文本键分支。
  }

  const decisionKey = canonicalizeFlowDecisionKey(question?.decisionKey)
    || normalizeText(input.openQuestion?.key)
    || normalizeText(question?.id)
  return decisionKey
    ? buildDecisionPointRef(`decision:${decisionKey}`)
    : null
}

export const resolveFlowDependencyPersonnelDecision = (
  dependency: NocodeEditorFlowSchemeDependency,
): FlowPersonnelDecision | null => {
  const explicit = dependency.personnelDecision
  if (explicit?.stepKey && PERSONNEL_DECISION_SLOTS.has(explicit.slot)) {
    return { stepKey: explicit.stepKey, slot: explicit.slot }
  }
  const structured = resolveStructuredPersonnelDecision(dependency.decisionKey)
  if (structured?.slot) {
    const stepKey = normalizeText(structured.stepKey)
      || (dependency.scopeKind === 'step' ? normalizeText(dependency.scopeKey) : '')
    if (stepKey) {
      return { stepKey, slot: structured.slot }
    }
  }
  const suffix = normalizeText(dependency.id).split(':').pop()
  const slot = suffix === 'source' ? 'source'
    : suffix === 'level' ? 'approval_level'
      : suffix === 'field' ? 'binding'
        : suffix === 'fallback' ? 'empty_handler'
          : null
  const stepKey = dependency.scopeKind === 'step'
    ? normalizeText(dependency.scopeKey)
    : ''
  return slot && stepKey ? { stepKey, slot } : null
}

export const resolveFlowDependencyDecisionPointRef = (
  dependency: NocodeEditorFlowSchemeDependency,
  steps?: FlowDecisionStepLookup,
): FlowDecisionPointRef | null => {
  const personnelDecision = resolveFlowDependencyPersonnelDecision(dependency)
  if (personnelDecision) {
    const key = resolveFlowPersonnelDecisionPointKey({
      decision: personnelDecision,
      steps,
      approvalOwner: dependency.requiredFor === 'approval_owner',
    })
    if (key) {
      return buildDecisionPointRef(key, personnelDecision)
    }
  }

  const decisionKey = canonicalizeFlowDecisionKey(dependency.decisionKey)
  return decisionKey
    ? buildDecisionPointRef(`decision:${decisionKey}`)
    : normalizeText(dependency.id)
      ? buildDecisionPointRef(`dependency:${normalizeText(dependency.id)}`)
      : null
}

const hasQuestionAnswer = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  question.confirmed === true
  || normalizeText(question.selectedOptionValue)
  || normalizeText(question.answerSummary)
  || normalizeText(question.answerDetail)
  || question.options?.some(option => option.selected === true),
)

// 只有一个步骤能承载该槽位时才用它补 stepKey；多个候选只能由模型自己声明，不能替它猜。
const resolveSoleApplicablePersonnelStepKey = (
  steps: FlowDecisionStepLookup,
  slot: FlowPersonnelDecisionSlot,
) => {
  const applicable = [...steps.values()].filter(step => (
    isFlowPersonnelDecisionSlotApplicable(slot, step.kind)
  ))
  return applicable.length === 1 ? normalizeText(applicable[0].key) : ''
}

export const validateFlowPersonnelQuestionContracts = (
  scheme: NocodeEditorFlowScheme,
): FlowPersonnelQuestionContractDiagnostic[] => {
  const steps = buildFlowDecisionStepLookup(scheme)
  const stepKeyByOpenQuestionKey = new Map(
    (scheme.openQuestions || []).flatMap((question) => {
      const key = normalizeText(question.key)
      const stepKey = resolveOpenQuestionStepKey(question)
      return key && stepKey ? [[key, stepKey] as const] : []
    }),
  )
  return (scheme.confirmation?.questions || []).flatMap((question) => {
    if (hasQuestionAnswer(question)) {
      return []
    }
    const openQuestionStepKey = stepKeyByOpenQuestionKey.get(normalizeText(question.decisionKey))
      || stepKeyByOpenQuestionKey.get(normalizeText(question.id))
      || ''
    const scopedQuestion = withFallbackQuestionStep(question, openQuestionStepKey)
    if (question.personnelDecision) {
      return []
    }
    const inferred = inferFlowPersonnelDecision(scopedQuestion, steps)
    if (inferred) {
      return [{
        code: 'personnel_decision_missing' as const,
        message: `确认题“${question.title}”属于人员决策题，但未声明 personnelDecision.stepKey 与 personnelDecision.slot。`,
        questionId: normalizeText(question.id),
        decisionKey: normalizeText(question.decisionKey) || undefined,
        stepKey: inferred.stepKey,
        slot: inferred.slot,
      }]
    }
    if (
      resolveQuestionScopeStepKey(scopedQuestion)
      || resolveStructuredPersonnelDecision(question.decisionKey)?.stepKey
    ) {
      return []
    }
    // 模型常见写法：人员来源题只写标题和来源选项，既没标 personnelDecision，也没给
    // decisionScope/结构化 decisionKey。槽位仍能从选项结构认出来，不能因 stepKey 缺失整条作废。
    const inferredSlot = inferFlowPersonnelSlotFromQuestionOptions(question)
    if (!inferredSlot) {
      return []
    }
    return [{
      code: 'personnel_decision_missing' as const,
      message: `确认题“${question.title}”属于人员决策题，但未声明 personnelDecision.stepKey 与 personnelDecision.slot。${
        inferredSlot === 'source'
          ? '请补上所属审批步骤与 slot=source，并把选项改成规范的人员来源五选项。'
          : `请补上所属审批步骤与 slot=${inferredSlot}。`
      }`,
      questionId: normalizeText(question.id),
      decisionKey: normalizeText(question.decisionKey) || undefined,
      stepKey: resolveSoleApplicablePersonnelStepKey(steps, inferredSlot),
      slot: inferredSlot,
    }]
  })
}

export const readFlowPersonnelDependencyDecision = (
  value: unknown,
): FlowPersonnelDecision | undefined => {
  if (!isRecord(value)) {
    return undefined
  }
  const stepKey = normalizeText(value.stepKey)
  const slot = normalizeText(value.slot) as FlowPersonnelDecisionSlot
  return stepKey && PERSONNEL_DECISION_SLOTS.has(slot)
    ? { stepKey, slot }
    : undefined
}

const CANONICAL_SOURCE_OPTION_VALUES = new Set<string>(
  NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS.map(option => option.value),
)

const resolveRawSourceOptionValue = (option: unknown) => {
  if (!isRecord(option)) {
    return null
  }
  const value = normalizeText(option.value)
  if (CANONICAL_SOURCE_OPTION_VALUES.has(value)) {
    return value
  }
  return resolveNocodeEditorFlowPersonnelSourceOptionValue(
    option as Parameters<typeof resolveNocodeEditorFlowPersonnelSourceOptionValue>[0],
  )
}

const isRawObjectBoundOption = (option: unknown) => {
  if (!isRecord(option)) {
    return false
  }
  const candidate = isRecord(option.personnelCandidate) ? option.personnelCandidate : null
  return Boolean(
    normalizeText(candidate?.refId)
    || normalizeText(candidate?.refName)
    || normalizeText(candidate?.status) === 'existing'
    || /^use-existing-owner-field\b/iu.test(normalizeText(option.value)),
  )
}

const hasRawQuestionAnswer = (question: Record<string, unknown>) => (
  question.confirmed === true
  || ['selectedOptionValue', 'answerSummary', 'answerDetail']
    .some(field => Boolean(normalizeText(question[field])))
  || (Array.isArray(question.options) ? question.options : [])
    .some(option => isRecord(option) && option.selected === true)
)

const readRawPersonnelDecision = (question: Record<string, unknown>) => {
  const raw = question.personnelDecision
  if (!isRecord(raw)) {
    return null
  }
  const stepKey = normalizeText(raw.stepKey)
  const slot = normalizeText(raw.slot) as FlowPersonnelDecisionSlot
  return stepKey && PERSONNEL_DECISION_SLOTS.has(slot) ? { stepKey, slot } : null
}

/**
 * 人员决策只能挂在真正询问人员来源/绑定的题上。二选一、补充说明题挂 personnelDecision 后，
 * 决策图会把触发方式这类业务结构题当成人员决策的产出方，真正的人员来源题因此被判成重复或已确定。
 * 只校验原始入参：归一化会保留 personnelDecision 却丢掉无法识别的题型/选项，模型真实写法必须在这里拦。
 */
export const validateRawFlowPersonnelDecisionSlots = (
  value: unknown,
): FlowPersonnelSlotDiagnostic[] => {
  const scheme = isRecord(value) && isRecord(value.scheme) ? value.scheme : value
  if (!isRecord(scheme)) return []
  const confirmation = isRecord(scheme.confirmation) ? scheme.confirmation : null
  const questions = (Array.isArray(confirmation?.questions) ? confirmation.questions : [])
    .filter(isRecord)
  return questions.flatMap((question): FlowPersonnelSlotDiagnostic[] => {
    // 已作答的题属于历史结论，再判题型会把用户已答内容打回重问。
    if (hasRawQuestionAnswer(question)) return []
    const decision = readRawPersonnelDecision(question)
    if (!decision) return []
    const questionTitle = normalizeText(question.title) || '未命名确认题'
    const decisionKey = normalizeText(question.decisionKey)
      || normalizeText(question.id)
      || undefined
    const questionKind = normalizeText(question.questionKind)
    if (questionKind === 'binary' || questionKind === 'note_only') {
      return [{
        code: 'personnel_decision_question_kind_invalid' as const,
        message: `确认题“${questionTitle}”问的不是人员，却带着人员决策标记。人员决策只能写在询问人员来源或绑定对象的单选题上，请把这题恢复成普通业务确认题，并为对应步骤单独提出人员题。`,
        decisionKey,
      }]
    }
    if (decision.slot !== 'source') return []
    const options = Array.isArray(question.options) ? question.options : []
    const isPersonnelSourceQuestion = options.some(option => (
      resolveRawSourceOptionValue(option) || isRawObjectBoundOption(option)
    ))
    if (isPersonnelSourceQuestion) return []
    return [{
      code: 'personnel_decision_slot_options_invalid' as const,
      message: `确认题“${questionTitle}”标记为人员来源决策，但选项不是人员来源选项（提交人自己、指定成员/角色、部门主管、表单内成员字段、表单内部门字段）。请改成这五个来源选项，或去掉该题的人员决策标记。`,
      decisionKey,
    }]
  })
}
