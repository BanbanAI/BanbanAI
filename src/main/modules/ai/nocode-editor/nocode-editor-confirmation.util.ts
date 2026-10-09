import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmStage,
  NocodeEditorAiConfirmSurface,
} from '@common/types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorConfirmationPayload,
} from '@common/utils/nocodeEditorConfirmationNormalization'

type BuildNocodeEditorConfirmationPayloadOptions = {
  stage: NocodeEditorAiConfirmStage
  confirmation?: unknown
  openQuestions?: unknown
  preferredSurface?: NocodeEditorAiConfirmSurface
  summary?: unknown
  planningQuestionPresentation?: boolean
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

export const buildNocodeEditorConfirmationPayload = (
  options: BuildNocodeEditorConfirmationPayloadOptions,
): NocodeEditorAiConfirmPayload | null => {
  return normalizeNocodeEditorConfirmationPayload({
    stage: options.stage,
    confirmation: options.confirmation,
    openQuestions: Array.from(new Set(normalizeStringList(options.openQuestions))),
    preferredSurface: options.preferredSurface,
    summary: normalizeText(options.summary) || undefined,
    planningQuestionPresentation: options.planningQuestionPresentation,
  })
}
