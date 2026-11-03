import type {
  NocodeEditorAiConfirmQuestion,
} from '../types/nocodeEditorConfirmation'

type QuestionLike = {
  title?: unknown
  options?: unknown
  decisionKey?: unknown
  personnelDecision?: unknown
}

type ApprovalOwnerSourceQuestionLike = QuestionLike & {
  decisionKey?: unknown
  description?: unknown
  reason?: unknown
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const isDefaultSameApproverQuestion = (question: QuestionLike) => {
  const title = normalizeText(question.title)
  const decisionKey = normalizeText(question.decisionKey)
  const decision = question.personnelDecision && typeof question.personnelDecision === 'object'
    ? question.personnelDecision as Record<string, unknown>
    : null
  const asksDefaultHandling = /(如何处理|怎么处理|处理方式|怎么办|如何配置|怎么配置)/u.test(title)
  return normalizeText(decision?.slot) === 'same_as_submitter'
    || /same[_\-.]?as[_\-.]?submitter/i.test(decisionKey)
    || (asksDefaultHandling
      && (/(审批人|审核人).*(提交人|报销人|申请人).*(同一人|同人|本人)/u.test(title)
        || /(提交人|报销人|申请人).*(审批人|审核人).*(同一人|同人|本人)/u.test(title)))
}

// 多人审批/办理方式、审批/办理/填报人为空时都沿用节点默认设置（多人审批默认会签、多人办理默认或签；
// 审批人为空默认自动通过、办理人为空默认转交管理员、填报人为空默认指定人员），
// 非默认值由方案直接配置并经生成后风险提醒说明，不再作为确认题抛出。
const isDefaultPersonnelSettingQuestion = (question: QuestionLike) => {
  const decision = question.personnelDecision && typeof question.personnelDecision === 'object'
    ? question.personnelDecision as Record<string, unknown>
    : null
  const slot = normalizeText(decision?.slot)
  if (slot === 'multi_person' || slot === 'empty_handler') {
    return true
  }
  return /^flow\.[a-z-]+\.owner\.empty_handler(?:\.|$)/iu.test(normalizeText(question.decisionKey))
}

const DEFAULT_OPERATION_PERMISSION_PATTERNS = [
  /^(?:(?:审批|办理|填报)节点)?(?:是否需要|是否|需不需要|要不要|允许|是否允许)(?:开启|允许)?(?:转交|退回|驳回|拒绝|暂存|直接结束流程|填写审批意见|填写办理意见|填写填报意见)[？?。]?$/u,
  /^(?:(?:审批|办理|填报)节点)?(?:审批意见|办理意见|填报意见)(?:是否需要|是否|需不需要|要不要)(?:必须|必填)[？?。]?$/u,
  /^(?:是否需要|是否|需不需要|要不要)(?:允许)?(?:审批|办理|填报)节点(?:转交|退回|驳回|拒绝|暂存|直接结束流程)[？?。]?$/u,
  /^(?:是否需要|是否|需不需要|要不要)(?:允许)?(?:转交|退回|驳回|拒绝|暂存)(?:审批|办理|填报)?[？?。]?$/u,
]

// 转交/退回/驳回等操作权限与驳回后处理沿用节点默认设置，非默认行为由方案直接配置并经生成后风险提醒说明，不再作为确认题抛出。
const REJECT_HANDLING_QUESTION_PATTERNS = [
  /(?:驳回|拒绝|退回|转交)(?:后|之后).*(?:如何处理|怎么处理|怎样处理|如何走|怎么办|如何配置|怎么配置|处理方式)/u,
  /(?:驳回|拒绝)(?:后|之后).*(?:继续执行|继续流转|继续处理|继续通知|继续归档|继续回写|后续节点|后续流程|自动跳过|跳过哪些|跳过以下|退回修改|退回给|退回到)/u,
  /(?:转交|退回)(?:的)?(?:目标|对象|范围|给谁|到哪个节点|至哪个节点)/u,
  /continueAfterReject/i,
]

// “审批通过后是否需要回写审批状态”这类“是否执行回写”的确认题不再抛出：用户已明确提到的后续动作直接写入方案，
// 未提及时按既定默认行为处理；只有“回写到哪个字段/是否需要新增回写字段”这类字段证据缺口仍按原规则提问。
const APPROVAL_WRITEBACK_QUESTION_PATTERNS = [
  /(?:是否需要|是否|需不需要|要不要).{0,12}(?:自动)?回写(?!字段).{0,8}(?:审批|流程|业务|节点)?(?:状态|结果)(?:信息)?(?:吗|么|呢)?[？?。]?$/u,
  /(?:审批|流程|节点)(?:通过|驳回|拒绝|完成|结束)(?:后|之后).{0,16}(?:是否|需不需要|要不要|需要).{0,8}(?:自动)?回写(?!字段).{0,8}(?:审批|流程|业务|节点)?(?:状态|结果)(?:信息)?(?:吗|么|呢)?[？?。]?$/u,
]

const DEFAULT_PERSONNEL_SETTING_QUESTION_PATTERNS = [
  /(?:审批人|办理人|填报人|审批人员|办理人员|填报人员)(?:字段)?(?:为空|缺失|不存在|找不到)(?:时|后).{0,12}(?:如何处理|怎么处理|怎样处理|处理方式|怎么办|如何配置|怎么配置|如何设置|怎么设置|什么方式|什么策略|自动通过|转交管理员|指定人员)/u,
  /(?:多人|多个人).{0,6}(?:审批|办理).{0,8}(?:方式|会签|或签|依次|全部通过|任一通过|都通过)/u,
  /(?:会签|或签|依次审批).{0,6}(?:还是|或者|或)(?:会签|或签|依次审批)/u,
]

const PARTICIPANT_NOTIFICATION_QUESTION_PATTERNS = [
  /(?:是否|需不需要|要不要).{0,24}(?:通知|发送(?:消息|通知)|消息推送).{0,12}(?:发起人|提交人|申请人|报销人|审批人|办理人|填报人|参与人)[？?。]?$/u,
  /(?:是否|需不需要|要不要).{0,24}(?:给|向).{0,8}(?:发起人|提交人|申请人|报销人|审批人|办理人|填报人|参与人).{0,8}(?:通知|发送(?:消息|通知)|消息推送)[？?。]?$/u,
]

const isRedundantParticipantNotificationQuestion = (value: unknown) => {
  const title = normalizeText(value)
  if (/(?:短信|邮件|微信|钉钉|站外|外部|催办|超时|定时|提醒)/u.test(title)) {
    return false
  }
  return PARTICIPANT_NOTIFICATION_QUESTION_PATTERNS.some(pattern => pattern.test(title))
}

const hasConfirmedQuestionAnswer = (
  question?: Partial<NocodeEditorAiConfirmQuestion> | null,
) => Boolean(
  question?.confirmed
  || normalizeText(question?.selectedOptionValue)
  || normalizeText(question?.answerSummary)
  || normalizeText(question?.answerDetail)
  || (
    Array.isArray(question?.options)
    && question.options.some(option => option?.selected)
  ),
)

const buildQuestionSearchText = (
  question?: QuestionLike | Partial<NocodeEditorAiConfirmQuestion> | null,
) => {
  if (!question) {
    return ''
  }

  const options = Array.isArray(question.options)
    ? question.options
      .map((option) => {
        if (!option || typeof option !== 'object') {
          return ''
        }
        return [
          normalizeText((option as Record<string, unknown>).label),
          normalizeText((option as Record<string, unknown>).value),
        ].filter(Boolean).join(' ')
      })
      .filter(Boolean)
    : []

  return [
    normalizeText(question.title),
    ...options,
  ].filter(Boolean).join(' ')
}

export const isNocodeEditorFlowApprovalOwnerSourceQuestion = (
  question?: ApprovalOwnerSourceQuestionLike | Partial<NocodeEditorAiConfirmQuestion> | null,
) => {
  if (!question) {
    return false
  }

  const decisionKey = normalizeText(question.decisionKey)
  if (/^flow\.approval\.owner\.empty_handler(?:\.|$)/u.test(decisionKey)) {
    return false
  }

  const title = normalizeText(question.title)
  const options = Array.isArray(question.options) ? question.options : []
  const text = [
    title,
    normalizeText(question.description),
    normalizeText('reason' in question ? question.reason : ''),
    ...options.flatMap((option) => {
      if (!option || typeof option !== 'object') {
        return []
      }
      const record = option as Record<string, unknown>
      return [
        normalizeText(record.value),
        normalizeText(record.label),
        normalizeText(record.description),
      ].filter(Boolean)
    }),
  ].filter(Boolean).join(' ')
  const hasLegacySourceOption = /\b(?:confirm-owner-source|choose-another-owner-source|adjust-owner-design)\b/i.test(text)
  const hasNonFieldSourceOption = /固定(?:人员|成员)|(?:固定|指定).{0,12}(?:人员|成员|角色)|部门负责人|部门主管|提交人上级|直属(?:领导|上级)|(?:^|\s)角色(?:\s|$)/u.test(text)
  const asksOwnerSource = /审批(?:人|人员|对象).{0,8}来源|来源.{0,8}审批(?:人|人员|对象)/u.test(title)
  const asksWhoOwnsApproval = /(?:审批|审核|复核|办理|处理).{0,8}(?:由谁|谁来|谁负责|负责人是谁)|(?:由谁|谁来|谁负责).{0,8}(?:审批|审核|复核|办理|处理)/u.test(title)
  const asksHowToDetermineApprovalOwner = /审批(?:人|人员|对象).{0,8}(?:如何|怎么|怎样).{0,4}(?:确定|指定|配置)|(?:如何|怎么|怎样).{0,4}(?:确定|指定|配置).{0,16}审批(?:人|人员|对象)/u.test(title)
  return hasLegacySourceOption
    || hasNonFieldSourceOption
    || asksOwnerSource
    || asksWhoOwnsApproval
    || asksHowToDetermineApprovalOwner
}

const isNocodeEditorFlowRejectHandlingQuestion = (
  value: unknown,
) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  return REJECT_HANDLING_QUESTION_PATTERNS.some(pattern => pattern.test(text))
}

export const shouldSkipPendingNocodeEditorFlowQuestion = (
  value: unknown,
) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  if (isRedundantParticipantNotificationQuestion(text)) {
    return true
  }

  if (isNocodeEditorFlowRejectHandlingQuestion(text)) {
    return true
  }

  if (APPROVAL_WRITEBACK_QUESTION_PATTERNS.some(pattern => pattern.test(text))) {
    return true
  }

  if (DEFAULT_PERSONNEL_SETTING_QUESTION_PATTERNS.some(pattern => pattern.test(text))) {
    return true
  }

  return DEFAULT_OPERATION_PERMISSION_PATTERNS.some(pattern => pattern.test(text))
}

type PrunableFlowDecisionQuestion = {
  dependsOn?: unknown
  prerequisites?: unknown
}

// 只剪被策略过滤掉的题目的引用；模型凭空引用的未知键保留，仍照常触发诊断。
export const pruneDanglingFlowDecisionReferences = <TQuestion extends PrunableFlowDecisionQuestion>(
  questions: TQuestion[],
  droppedKeys: Iterable<string>,
): TQuestion[] => {
  const dropped = new Set<string>()
  for (const key of droppedKeys) {
    const normalized = normalizeText(key)
    if (normalized) {
      dropped.add(normalized)
    }
  }
  if (!dropped.size) {
    return questions
  }

  return questions.map((question) => {
    const dependsOn = Array.isArray(question.dependsOn) ? question.dependsOn : null
    const prerequisites = Array.isArray(question.prerequisites) ? question.prerequisites : null
    const retainedDependsOn = dependsOn
      ? dependsOn.filter(key => !dropped.has(normalizeText(key)))
      : null
    const retainedPrerequisites = prerequisites
      ? prerequisites.filter(condition => (
        !condition
        || typeof condition !== 'object'
        || !dropped.has(normalizeText((condition as Record<string, unknown>).decisionKey))
      ))
      : null
    const dependsOnChanged = Boolean(
      dependsOn && retainedDependsOn && retainedDependsOn.length !== dependsOn.length,
    )
    const prerequisitesChanged = Boolean(
      prerequisites && retainedPrerequisites && retainedPrerequisites.length !== prerequisites.length,
    )
    if (!dependsOnChanged && !prerequisitesChanged) {
      return question
    }
    return {
      ...question,
      ...(dependsOnChanged ? { dependsOn: retainedDependsOn } : {}),
      ...(prerequisitesChanged ? { prerequisites: retainedPrerequisites } : {}),
    } as TQuestion
  })
}

export const filterPendingNocodeEditorFlowQuestionTitles = <TTitle extends string>(
  titles: TTitle[],
) => titles.filter(title => (
    !isDefaultSameApproverQuestion({ title })
    && !shouldSkipPendingNocodeEditorFlowQuestion(title)
  ))

export const filterPendingNocodeEditorFlowQuestionRecords = <TQuestion extends QuestionLike>(
  questions: TQuestion[],
) => questions.filter(question => (
    !isDefaultSameApproverQuestion(question)
    && !isDefaultPersonnelSettingQuestion(question)
    && !isRedundantParticipantNotificationQuestion(question.title)
    && !shouldSkipPendingNocodeEditorFlowQuestion(question.title)
    && !shouldSkipPendingNocodeEditorFlowQuestion(buildQuestionSearchText(question))
  ))

export const filterPendingNocodeEditorFlowConfirmationQuestions = (
  questions: NocodeEditorAiConfirmQuestion[],
) => questions.filter((question) => {
  if (hasConfirmedQuestionAnswer(question)) {
    return true
  }
  return !isDefaultSameApproverQuestion(question)
    && !isDefaultPersonnelSettingQuestion(question)
    && !isRedundantParticipantNotificationQuestion(question.title)
    && !shouldSkipPendingNocodeEditorFlowQuestion(question.title)
    && !shouldSkipPendingNocodeEditorFlowQuestion(buildQuestionSearchText(question))
})
