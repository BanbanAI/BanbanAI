import {
  isNocodeEditorCompleteNewFormIntent,
} from './nocodeEditorSingleFormPlan'
import {
  getNocodeEditorDefaultContinueReplyAliases,
} from './nocodeEditorConfirmationCopy'
import {
  isDefaultContinueReplyMessage,
  normalizeReplyQuestionToken,
} from './nocodeEditorPlanningConfirmationReply'

const normalizeText = (value: unknown) => String(value ?? '').trim()

const STRUCTURED_CONFIRMATION_REPLY_PREFIXES = [
  '当前卡片的问题，我已逐项确认如下：',
  '目前卡片中的問題，我已逐項確認如下：',
  "I have confirmed the current card's questions as follows:",
  '我补充确认这几项',
  '我補充確認這幾項',
  'I am confirming these items:',
]

export const isNocodeEditorStructuredConfirmationReplyMessage = (value: unknown) => {
  const content = normalizeText(value)
  return Boolean(content) && STRUCTURED_CONFIRMATION_REPLY_PREFIXES.some(prefix => (
    content.startsWith(prefix)
  ))
}

const isStructuredConfirmationReplyMessage = isNocodeEditorStructuredConfirmationReplyMessage

const isDefaultConfirmationContinueReplyMessage = (content: string) => {
  if (isDefaultContinueReplyMessage(content, null)) {
    return true
  }

  const normalizedContent = normalizeReplyQuestionToken(content)
  if (!normalizedContent) {
    return false
  }

  return getNocodeEditorDefaultContinueReplyAliases()
    .map(candidate => normalizeReplyQuestionToken(candidate))
    .filter(Boolean)
    .some(candidate => normalizedContent.startsWith(candidate))
}

export const isNocodeEditorConfirmationContinueReplyMessage = (
  value: unknown,
) => {
  const content = normalizeText(value)
  if (!content) {
    return false
  }

  return (
    isStructuredConfirmationReplyMessage(content)
    || isDefaultConfirmationContinueReplyMessage(content)
  )
}

export const shouldResolveNocodeEditorTaskContextForMessage = (input: {
  userMessage?: unknown
  editorMode?: unknown
  activeFormId?: unknown
  hasSettingContext?: unknown
  hasSettingTargetContext?: unknown
}) => {
  if (input.hasSettingContext || input.hasSettingTargetContext) {
    return true
  }

  if (isNocodeEditorConfirmationContinueReplyMessage(input.userMessage)) {
    return false
  }

  if (normalizeText(input.editorMode) === 'process-setting') {
    return false
  }

  return !isNocodeEditorCompleteNewFormIntent({
    userMessage: input.userMessage,
    editorMode: input.editorMode,
    activeFormId: input.activeFormId,
  })
}
