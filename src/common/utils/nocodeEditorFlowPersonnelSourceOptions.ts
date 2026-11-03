import type {
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionOption,
} from '@common/types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorConfirmationQuestion,
} from './nocodeEditorConfirmationNormalization'

export type NocodeEditorFlowPersonnelSourceOptionValue =
  | 'submitter'
  | 'assignee'
  | 'department_manager'
  | 'form_member_field'
  | 'form_department_field'

// 与流程节点“人员设置”面板的五个设置项逐字一致，提问选项直接复用这套选项。
export const NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS: ReadonlyArray<{
  value: NocodeEditorFlowPersonnelSourceOptionValue
  label: string
}> = [
  { value: 'submitter', label: '提交人自己' },
  { value: 'assignee', label: '指定成员/角色' },
  { value: 'department_manager', label: '部门主管' },
  { value: 'form_member_field', label: '表单内成员字段' },
  { value: 'form_department_field', label: '表单内部门字段' },
]

const CANONICAL_VALUE_BY_CANDIDATE_SOURCE_TYPE: Record<string, NocodeEditorFlowPersonnelSourceOptionValue> = {
  submitter: 'submitter',
  submitter_manager: 'department_manager',
  fixed_users: 'assignee',
  fixed_roles: 'assignee',
  department_manager: 'department_manager',
  form_member: 'form_member_field',
  form_department: 'form_department_field',
}

const TEXT_MATCHERS: Array<{
  value: NocodeEditorFlowPersonnelSourceOptionValue
  pattern: RegExp
}> = [
  { value: 'submitter', pattern: /提交人自己|提交人本人|提交者自己|submitting[\s_-]*user/i },
  { value: 'form_member_field', pattern: /表单(?:内)?(?:成员|人员)字段|(?:成员|人员)字段|form[\s_-]*member[\s_-]*field/i },
  { value: 'form_department_field', pattern: /表单(?:内)?(?:部门|组织)字段|部门字段|form[\s_-]*department[\s_-]*field/i },
  { value: 'department_manager', pattern: /部门主管|部门负责人|部门经理|直属(?:主管|上级|领导)|直接上级|上级(?:审批|领导|主管)|提交人(?:的)?(?:直属|直接)?(?:上级|主管)|department[\s_-]*manager|submitter[\s_-]*manager/i },
  { value: 'assignee', pattern: /指定(?:成员|角色|人员|用户)|固定(?:成员|角色|人员|用户)|成员\/角色|fixed[\s_-]*(?:users?|roles?)|assignee/i },
]

const normalizeText = (value: unknown) => String(value ?? '').trim()

// 文本 → 规范来源值的映射供来源锚定复用，避免规范短语表出现第二份漂移实现；
// 收集式返回同一文本命中的全部来源，供“多来源线索歧义”判定使用。
export const collectNocodeEditorFlowPersonnelSourceValuesFromText = (
  text: unknown,
): Array<{ value: NocodeEditorFlowPersonnelSourceOptionValue; matchedText: string }> => {
  const normalized = normalizeText(text)
  if (!normalized) {
    return []
  }
  return TEXT_MATCHERS.flatMap((matcher) => {
    const match = matcher.pattern.exec(normalized)
    return match?.[0] ? [{ value: matcher.value, matchedText: match[0] }] : []
  })
}

const hasQuestionAnswer = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  question.confirmed === true
  || normalizeText(question.selectedOptionValue)
  || normalizeText(question.answerSummary)
  || normalizeText(question.answerDetail)
  || question.options?.some(option => option.selected === true),
)

// 已绑定真实对象的选项题（具体字段、成员、角色或 planned 待补对象）不是来源类型选择题，
// 规范化会丢掉这些真实候选，因此整题保持原样。
const hasObjectBoundOptions = (question: NocodeEditorAiConfirmQuestion) => (
  question.options || []
).some((option) => {
  const candidate = option.personnelCandidate
  return Boolean(
    candidate?.refId
    || candidate?.refName
    || candidate?.status === 'existing'
    || /^use-existing-owner-field\b/i.test(normalizeText(option.value)),
  )
})

export const resolveNocodeEditorFlowPersonnelSourceOptionValue = (
  option: NonNullable<NocodeEditorAiConfirmQuestion['options']>[number],
): NocodeEditorFlowPersonnelSourceOptionValue | null => {
  const candidateSourceType = normalizeText(option.personnelCandidate?.sourceType)
  const byCandidate = CANONICAL_VALUE_BY_CANDIDATE_SOURCE_TYPE[candidateSourceType]
  if (byCandidate) {
    return byCandidate
  }
  const text = `${normalizeText(option.value)} ${normalizeText(option.label)}`
  const matched = TEXT_MATCHERS.find(item => item.pattern.test(text))
  return matched ? matched.value : null
}

const isCanonicalOptionList = (
  question: NocodeEditorAiConfirmQuestion,
) => {
  const options = question.options || []
  return options.length === NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS.length
    && options.every((option, index) => {
      const spec = NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS[index]
      return normalizeText(option.value) === spec.value
        && normalizeText(option.label) === spec.label
    })
}

export const isCanonicalizableNocodeEditorFlowPersonnelSourceQuestion = (
  question: NocodeEditorAiConfirmQuestion,
) => {
  if (question.personnelDecision?.slot !== 'source') {
    return false
  }
  if (question.questionKind === 'binary' || question.questionKind === 'note_only') {
    return false
  }
  if (!Array.isArray(question.options) || !question.options.length) {
    return false
  }
  return !hasQuestionAnswer(question) && !hasObjectBoundOptions(question)
}

export const canonicalizeNocodeEditorFlowPersonnelSourceQuestion = <
  TQuestion extends NocodeEditorAiConfirmQuestion,
>(question: TQuestion): TQuestion => {
  if (!isCanonicalizableNocodeEditorFlowPersonnelSourceQuestion(question) || isCanonicalOptionList(question)) {
    return question
  }
  const descriptionByValue = new Map<NocodeEditorFlowPersonnelSourceOptionValue, string>()
  ;(question.options || []).forEach((option) => {
    const canonicalValue = resolveNocodeEditorFlowPersonnelSourceOptionValue(option)
    const description = normalizeText(option.description)
    if (canonicalValue && description && !descriptionByValue.has(canonicalValue)) {
      descriptionByValue.set(canonicalValue, description)
    }
  })
  return {
    ...question,
    questionKind: 'single_select',
    options: NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS.map(spec => ({
      value: spec.value,
      label: spec.label,
      ...(descriptionByValue.has(spec.value)
        ? { description: descriptionByValue.get(spec.value) }
        : {}),
    })),
  }
}

export const canonicalizeNocodeEditorFlowPersonnelSourceQuestions = <
  TQuestion extends NocodeEditorAiConfirmQuestion,
>(questions: TQuestion[]): TQuestion[] => (
  questions.map(question => canonicalizeNocodeEditorFlowPersonnelSourceQuestion(question))
)

const CANDIDATE_SOURCE_TYPE_BY_CANONICAL_VALUE: Record<
  NocodeEditorFlowPersonnelSourceOptionValue,
  'submitter' | 'fixed_roles' | 'department_manager' | 'form_member' | 'form_department'
> = {
  submitter: 'submitter',
  assignee: 'fixed_roles',
  department_manager: 'department_manager',
  form_member_field: 'form_member',
  form_department_field: 'form_department',
}

// 依赖收敛派生的人员来源题没有模型给出的答案空间；按模型来源题契约补齐同一套选项，
// 否则运行时会按“可选题型无选项”降级为纯补充说明，答复也无法以标准来源值进入信任链。
export const buildNocodeEditorFlowPersonnelSourceOptions = (): NocodeEditorAiConfirmQuestionOption[] => (
  NOCODE_EDITOR_FLOW_PERSONNEL_SOURCE_OPTIONS.map(spec => ({
    value: spec.value,
    label: spec.label,
    personnelCandidate: {
      sourceType: CANDIDATE_SOURCE_TYPE_BY_CANONICAL_VALUE[spec.value],
      status: 'supported' as const,
    },
  }))
)

// 卡片规范选项与信任链回传只保留展示字段，选项的 personnelCandidate 会在回传后丢失；
// 暂存校验前按规范来源值回填来源类型候选，来源类型选择本身不绑定具体对象。
// 模型把规范来源值标成 planned 但未给出对象名时同样不携带对象声明，按类型级归一。
export const backfillNocodeEditorFlowPersonnelSourceCandidates = (
  question: NocodeEditorAiConfirmQuestion,
): NocodeEditorAiConfirmQuestion => {
  if (question.personnelDecision?.slot !== 'source') {
    return question
  }
  if (!Array.isArray(question.options) || !question.options.length) {
    return question
  }
  let changed = false
  const options = question.options.map((option) => {
    const canonicalValue = hasObjectBoundOptions({ ...question, options: [option] })
      ? null
      : resolveNocodeEditorFlowPersonnelSourceOptionValue(option)
    const sourceType = canonicalValue ? CANDIDATE_SOURCE_TYPE_BY_CANONICAL_VALUE[canonicalValue] : null
    if (!sourceType) {
      return option
    }
    if (option.personnelCandidate && option.personnelCandidate.status !== 'planned') {
      return option
    }
    changed = true
    return {
      ...option,
      personnelCandidate: {
        sourceType: option.personnelCandidate?.sourceType || sourceType,
        status: 'supported' as const,
      },
    }
  })
  return changed ? { ...question, options } : question
}

// 展示型投影（可见问题白名单、历史方案确认题）常丢失 personnelDecision / 选项 personnelCandidate，
// 规范化守卫因此失效。这里从保留原字段的问题按选项值对账回挂，并复用确认题规范化做字段校验。
export const carryOverNocodeEditorFlowPersonnelProjectionFields = <
  TQuestion extends NocodeEditorAiConfirmQuestion,
>(
  sourceQuestion: NocodeEditorAiConfirmQuestion | null | undefined,
  question: TQuestion,
): TQuestion => {
  if (!sourceQuestion) {
    return question
  }
  const validatedSource = normalizeNocodeEditorConfirmationQuestion(sourceQuestion, 0, 'flow-scheme')
  const candidatesByValue = new Map<
    string,
    NonNullable<NocodeEditorAiConfirmQuestion['options']>[number]['personnelCandidate']
  >()
  for (const option of validatedSource?.options || []) {
    const value = normalizeText(option?.value)
    if (value && option.personnelCandidate) {
      candidatesByValue.set(value, option.personnelCandidate)
    }
  }
  const personnelDecision = validatedSource?.personnelDecision
  if (!personnelDecision && !candidatesByValue.size) {
    return question
  }
  const options = question.options?.map((option) => {
    const personnelCandidate = candidatesByValue.get(normalizeText(option.value))
    return personnelCandidate ? { ...option, personnelCandidate } : option
  })
  return {
    ...question,
    ...(options ? { options } : {}),
    ...(personnelDecision ? { personnelDecision } : {}),
  }
}
