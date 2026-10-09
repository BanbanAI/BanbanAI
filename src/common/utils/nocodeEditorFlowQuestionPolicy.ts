import type {
  NocodeEditorAiConfirmQuestion,
} from '../types/nocodeEditorConfirmation'

type QuestionLike = {
  title?: unknown
  options?: unknown
}

type ApprovalOwnerSourceQuestionLike = QuestionLike & {
  decisionKey?: unknown
  description?: unknown
  reason?: unknown
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const DEFAULT_OPERATION_PERMISSION_PATTERNS = [
  /(是否|需不需要|要不要|是否允许|允许|怎么配置|如何配置).*(转交|退回|拒绝|限时|审批意见|办理意见)/,
  /(转交|退回|拒绝|限时|审批意见|办理意见).*(是否|需不需要|要不要|是否允许|允许|怎么配置|如何配置)/,
  /(操作权限|节点权限).*(转交|退回|拒绝|限时|审批意见|办理意见)/,
  /(转交范围|可转交范围|转交给谁|允许转交给谁)/,
  /(退回范围|可退回节点范围|退回到哪个节点|退回至哪个节点|允许退回到哪个节点)/,
  /(限时处理|超时处理|审批意见|办理意见).*(是否|需不需要|要不要|必须|必填)/,
  /(驳回|拒绝)后.*(处理方式|处理策略|处理规则)/,
  /(驳回|拒绝)后.*(怎么处理|如何处理|直接结束|退回修改|修改重提|重新提交|重提)/,
  /(退回|驳回)后.*(修改|重提|重新提交)/,
]

const CONTINUE_AFTER_REJECT_PATTERNS = [
  /(驳回|拒绝)后.*(继续执行|继续流转|继续处理|后续节点|后续流程|自动跳过|跳过哪些|跳过以下)/,
  /(驳回|拒绝)后.*((继续|还要).*(通知|归档|回写|同步|执行|处理))/,
  /continueAfterReject/i,
]

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

export const isNocodeEditorFlowContinueAfterRejectQuestion = (
  value: unknown,
) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  return CONTINUE_AFTER_REJECT_PATTERNS.some(pattern => pattern.test(text))
}

export const shouldSkipPendingNocodeEditorFlowQuestion = (
  value: unknown,
) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }

  if (isNocodeEditorFlowContinueAfterRejectQuestion(text)) {
    return false
  }

  return DEFAULT_OPERATION_PERMISSION_PATTERNS.some(pattern => pattern.test(text))
}

export const filterPendingNocodeEditorFlowQuestionTitles = <TTitle extends string>(
  titles: TTitle[],
) => titles.filter(title => !shouldSkipPendingNocodeEditorFlowQuestion(title))

export const filterPendingNocodeEditorFlowQuestionRecords = <TQuestion extends QuestionLike>(
  questions: TQuestion[],
) => questions.filter(question => !shouldSkipPendingNocodeEditorFlowQuestion(
    buildQuestionSearchText(question),
  ))

export const filterPendingNocodeEditorFlowConfirmationQuestions = (
  questions: NocodeEditorAiConfirmQuestion[],
) => questions.filter((question) => {
  if (hasConfirmedQuestionAnswer(question)) {
    return true
  }
  return !shouldSkipPendingNocodeEditorFlowQuestion(buildQuestionSearchText(question))
})
