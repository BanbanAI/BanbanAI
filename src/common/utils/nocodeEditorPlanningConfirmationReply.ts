import type { NocodeEditorAiConfirmPayload } from '@common/types/nocodeEditorConfirmation'
import {
  getNocodeEditorDefaultContinueReplyAliases,
} from './nocodeEditorConfirmationCopy'

const normalizeText = (value: unknown) => String(value ?? '').trim()

export const normalizeReplyQuestionToken = (value: unknown) => (
  normalizeText(value)
    .replace(/[\s\u3000]/g, '')
    .replace(/[[\]：:，,。、“”"'‘’（）()【】；;！!？?]/g, '')
    .toLowerCase()
)

export const isDefaultContinueReplyMessage = (
  content: string,
  confirmation?: Pick<NocodeEditorAiConfirmPayload, 'continueLabel'> | null,
) => {
  const normalizedContent = normalizeReplyQuestionToken(content)
  if (!normalizedContent) {
    return false
  }

  const candidates = Array.from(new Set([
    ...getNocodeEditorDefaultContinueReplyAliases(),
    normalizeText(confirmation?.continueLabel),
  ]))
    .map(candidate => normalizeReplyQuestionToken(candidate))
    .filter(Boolean)

  return candidates.includes(normalizedContent)
}
