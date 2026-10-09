import { isNocodeEditorCompleteNewFormIntent } from './nocodeEditorSingleFormPlan'

export type NocodeEditorRepeatBlueprintClarificationKind = 'planning-question' | 'explicit-confirmation'

export type NocodeEditorRepeatBlueprintClarificationDecision = {
  repeatIntent: boolean
  mode: 'blueprint-update' | 'clarification'
  clarificationKind?: NocodeEditorRepeatBlueprintClarificationKind
  clarificationSummary?: string
  blockedBlueprintId?: string
}

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeComparableIntentText = (value: unknown) => normalizeText(value)
  .replace(/\s+/g, '')
  .replace(/[，。！？、；：,.!?;:'"“”‘’（）()\[\]{}]/g, '')

const findLatestPreviousCompleteNewFormMessage = (
  currentMessage: string,
  recentUserMessages: unknown[],
) => {
  const normalizedCurrentMessage = normalizeComparableIntentText(currentMessage)
  if (!normalizedCurrentMessage) {
    return ''
  }

  const messages = Array.isArray(recentUserMessages) ? recentUserMessages : []
  let searchEnd = messages.length
  if (
    searchEnd > 0
    && normalizeComparableIntentText(messages[searchEnd - 1]) === normalizedCurrentMessage
  ) {
    searchEnd -= 1
  }

  for (let index = searchEnd - 1; index >= 0; index -= 1) {
    const candidate = normalizeText(messages[index])
    if (!candidate) {
      continue
    }
    if (!isNocodeEditorCompleteNewFormIntent({ userMessage: candidate })) {
      continue
    }
    return candidate
  }

  return ''
}

export const resolveNocodeEditorRepeatBlueprintClarification = (options: {
  userMessage?: unknown
  recentUserMessages?: unknown[]
  hasPendingBlueprint?: unknown
  pendingBlueprintId?: unknown
  pendingQuestionCount?: unknown
  clarificationSummary?: unknown
}): NocodeEditorRepeatBlueprintClarificationDecision => {
  const userMessage = normalizeText(options.userMessage)
  const pendingBlueprintId = normalizeText(options.pendingBlueprintId)
  const hasPendingBlueprint = Boolean(options.hasPendingBlueprint) && Boolean(pendingBlueprintId)
  if (!userMessage || !hasPendingBlueprint) {
    return {
      repeatIntent: false,
      mode: 'blueprint-update',
    }
  }

  if (!isNocodeEditorCompleteNewFormIntent({ userMessage })) {
    return {
      repeatIntent: false,
      mode: 'blueprint-update',
    }
  }

  const previousCreateMessage = findLatestPreviousCompleteNewFormMessage(
    userMessage,
    Array.isArray(options.recentUserMessages) ? options.recentUserMessages : [],
  )
  const repeatIntent = Boolean(previousCreateMessage)
    && normalizeComparableIntentText(previousCreateMessage) === normalizeComparableIntentText(userMessage)

  if (!repeatIntent) {
    return {
      repeatIntent: false,
      mode: 'blueprint-update',
    }
  }

  const pendingQuestionCount = Math.max(0, Number(options.pendingQuestionCount || 0) || 0)
  return {
    repeatIntent: true,
    mode: 'clarification',
    clarificationKind: pendingQuestionCount > 0 ? 'planning-question' : 'explicit-confirmation',
    clarificationSummary: normalizeText(options.clarificationSummary) || undefined,
    blockedBlueprintId: pendingBlueprintId,
  }
}

export const shouldBlockRestagingPendingBlueprintAfterApplyGate = (options: {
  userMessage?: unknown
  recentUserMessages?: unknown[]
  blockedBlueprintId?: unknown
  currentBlueprintId?: unknown
  clarificationKind?: unknown
}) => {
  const blockedBlueprintId = normalizeText(options.blockedBlueprintId)
  if (!blockedBlueprintId) {
    return false
  }

  const currentBlueprintId = normalizeText(options.currentBlueprintId)
  if (currentBlueprintId && currentBlueprintId !== blockedBlueprintId) {
    return false
  }

  const clarificationKind = normalizeText(options.clarificationKind)
  const decision = resolveNocodeEditorRepeatBlueprintClarification({
    userMessage: options.userMessage,
    recentUserMessages: options.recentUserMessages,
    hasPendingBlueprint: true,
    pendingBlueprintId: blockedBlueprintId,
    pendingQuestionCount: clarificationKind === 'planning-question' ? 1 : 0,
  })

  return decision.repeatIntent && decision.mode === 'clarification'
}
