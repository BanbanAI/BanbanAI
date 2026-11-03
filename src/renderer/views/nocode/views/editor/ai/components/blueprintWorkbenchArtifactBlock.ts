import i18next from 'i18next'
import type { AiAssistantBlueprintArtifactBlock } from '@common/types/ai'
import { buildBlueprintArtifactVersionFromParts } from '../blueprintArtifactIdentity'
import type { BlueprintWorkbenchCard } from '../blueprintWorkbenchViewModel'

export const buildBlueprintArtifactBlockFromWorkbenchCard = (
  card?: BlueprintWorkbenchCard | null,
): AiAssistantBlueprintArtifactBlock | null => {
  if (!card) {
    return null
  }
  const { item } = card

  return {
    type: 'artifact',
    kind: 'blueprint',
    status: 'ready',
    version: buildBlueprintArtifactVersionFromParts(item),
    displayRevision: item.displayRevision,
    displayVersionLabel: item.displayVersionLabel,
    revision: item.revision,
    stagedAt: item.stagedAt,
    phase: item.phase || undefined,
    title: item.blueprint.title
      || card.title
      || i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.blueprintDraft'),
    summary: item.blueprint.summary || card.summary,
    blueprint: item.blueprint,
    confirmation: item.blueprint.confirmation || undefined,
    applyResult: item.applyResult || null,
    draftPersistenceState: item.draftPersistenceState || null,
  }
}
