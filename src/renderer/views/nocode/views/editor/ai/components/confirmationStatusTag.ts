import type { AiAssistantArtifactBlock } from '@common/types/ai'
import { isSamePlanningConfirmationContext } from '@common/utils/nocodeEditorPlanningConfirmationIdentity'
import {
  resolveAiArtifactConfirmationStatus,
  resolveAiArtifactStatusTag,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import i18next from 'i18next'

export const getBlueprintGeneratedStatusTag = () => i18next.t('confirmationStatusTag.blueprintGenerated')

type ResolveConfirmationStatusTagInput = {
  hasGeneratedBlueprint?: boolean
  planningContextKeys?: Array<string | null | undefined>
}

const normalizePlanningContextKeys = (
  keys?: Array<string | null | undefined>,
) => (
  (Array.isArray(keys) ? keys : [])
    .map(item => String(item || '').trim())
    .filter(Boolean)
)

export const shouldUseBlueprintGeneratedStatusTag = (
  block?: AiAssistantArtifactBlock | null,
  input: ResolveConfirmationStatusTagInput = {},
) => {
  if (!block || !input.hasGeneratedBlueprint) {
    return false
  }

  if (
    block.kind !== 'app-plan'
    && block.kind !== 'form-plan'
    && block.kind !== 'content-plan'
  ) {
    return false
  }

  if (resolveAiArtifactConfirmationStatus(block) !== 'completed') {
    return false
  }

  const planningContextKey = String(block.confirmation?.planningContextKey || '').trim()
  if (!planningContextKey) {
    return false
  }

  return normalizePlanningContextKeys(input.planningContextKeys)
    .some(item => isSamePlanningConfirmationContext(planningContextKey, item))
}

export const resolveConfirmationStatusTagText = (
  block?: AiAssistantArtifactBlock | null,
  input: ResolveConfirmationStatusTagInput = {},
) => {
  if (shouldUseBlueprintGeneratedStatusTag(block, input)) {
    return getBlueprintGeneratedStatusTag()
  }

  const artifactStatusTag = resolveAiArtifactStatusTag(block)
  return artifactStatusTag === i18next.t('artifactBlock.pendingValidation')
    ? artifactStatusTag
    : ''
}
