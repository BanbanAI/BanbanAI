import { doesBlueprintArtifactShareDraftIdentity } from '@renderer/views/nocode/components/ai/artifactBlock'
import {
  getNocodeEditorAiBlueprintArtifactPlanningContextKey,
  getNocodeEditorAiBlueprintLineageKey,
} from './blueprintArtifactIdentity'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiStageBlueprintDisplayItem,
  NocodeEditorAiStagedAppBlueprint,
} from './types'

const normalizeText = (value: unknown) => String(value || '').trim()

const collectBlueprintLineageKeys = (
  blueprint?: NocodeEditorAiAppBlueprint | null,
) => {
  const lineageKeys = new Set<string>()
  if (!blueprint) {
    return lineageKeys
  }

  const forms = Array.isArray(blueprint.forms) ? blueprint.forms : []
  if (!forms.length) {
    const lineageKey = getNocodeEditorAiBlueprintLineageKey(blueprint)
    if (lineageKey) {
      lineageKeys.add(lineageKey)
    }
    return lineageKeys
  }

  for (const form of forms) {
    const lineageKey = getNocodeEditorAiBlueprintLineageKey({
      ...blueprint,
      forms: [form],
    } as NocodeEditorAiAppBlueprint)
    if (lineageKey) {
      lineageKeys.add(lineageKey)
    }
  }

  return lineageKeys
}

export const shouldUseSharedBlueprintPreviewWorkbench = (input: {
  block?: NocodeEditorAiArtifactBlock | null
  currentBlueprint?: NocodeEditorAiStagedAppBlueprint | null
  workbenchItems?: NocodeEditorAiStageBlueprintDisplayItem[]
  workbenchHistoryItems?: NocodeEditorAiStageBlueprintDisplayItem[]
}) => {
  const block = input.block
  if (!block || block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint) {
    return false
  }

  if (doesBlueprintArtifactShareDraftIdentity(block, input.currentBlueprint)) {
    return true
  }

  const blockPlanningContextKey = normalizeText(
    getNocodeEditorAiBlueprintArtifactPlanningContextKey(block),
  )
  const blockLineageKeys = collectBlueprintLineageKeys(block.blueprint)
  if (!blockPlanningContextKey && !blockLineageKeys.size) {
    return false
  }

  const sharedItems = [
    ...(Array.isArray(input.workbenchItems) ? input.workbenchItems : []),
    ...(Array.isArray(input.workbenchHistoryItems) ? input.workbenchHistoryItems : []),
  ]

  return sharedItems.some((item) => {
    const itemPlanningContextKey = normalizeText(item.sourcePlanningContextKey)
    if (
      blockPlanningContextKey
      && itemPlanningContextKey
      && blockPlanningContextKey === itemPlanningContextKey
    ) {
      return true
    }

    const itemLineageKey = getNocodeEditorAiBlueprintLineageKey(item.blueprint)
    return Boolean(itemLineageKey && blockLineageKeys.has(itemLineageKey))
  })
}
