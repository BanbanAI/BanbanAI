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

const isStructuredConfirmationReplyMessage = (content: string) => (
  normalizeText(content).startsWith('我补充确认这几项')
)

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
