import {
  getNocodeEditorBlueprintArtifactIdentityKey,
  getNocodeEditorBlueprintArtifactLineageKey,
  getNocodeEditorBlueprintArtifactPlanningContextKey,
} from '../../../../../../common/utils/nocodeEditorArtifactBlocks'
import {
  resolveBlueprintVersionKeyFromPhase,
} from '../../../../../../common/utils/nocodeEditorBlueprintLifecycle'

import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiStagedAppBlueprint,
} from './types'

const normalizeText = (value: unknown) => String(value || '').trim()

export const buildBlueprintArtifactVersionFromParts = (value: {
  revision?: number | null
  stagedAt?: number | null
  phase?: unknown
  applyResult?: { finishedAt?: number | null } | null
}) => resolveBlueprintVersionKeyFromPhase(value)

export const getNocodeEditorAiBlueprintLineageKey = (
  blueprint: NocodeEditorAiAppBlueprint | null | undefined,
) => {
  if (!blueprint) {
    return ''
  }
  return getNocodeEditorBlueprintArtifactLineageKey({
    type: 'artifact',
    kind: 'blueprint',
    blueprint,
  })
}

export const getNocodeEditorAiBlueprintContentSignatureKey = (
  blueprint: NocodeEditorAiAppBlueprint | null | undefined,
) => getNocodeEditorAiBlueprintLineageKey(blueprint)

export const getNocodeEditorAiBlueprintArtifactIdentityKey = (input: {
  blueprint?: NocodeEditorAiAppBlueprint | null
  title?: string | null
}) => getNocodeEditorBlueprintArtifactIdentityKey({
  type: 'artifact',
  kind: 'blueprint',
  title: input.title || input.blueprint?.title,
  blueprint: input.blueprint,
})

export const getNocodeEditorAiBlueprintPlanningContextKey = (input: {
  block?: NocodeEditorAiArtifactBlock | null
  blueprint?: NocodeEditorAiAppBlueprint | null
  sourcePlanningContextKey?: string | null
}) => normalizeText(
  input.sourcePlanningContextKey
  || (input.blueprint as any)?.sourcePlanningContextKey
  || (input.blueprint as any)?.confirmation?.planningContextKey
  || (input.block ? getNocodeEditorBlueprintArtifactPlanningContextKey(input.block as any) : ''),
) || null

export const getNocodeEditorAiBlueprintPrimaryFormFamilyKey = (
  blueprint: NocodeEditorAiAppBlueprint | null | undefined,
) => {
  const forms = Array.isArray(blueprint?.forms) ? blueprint.forms : []
  const primaryForm = forms[0]
  return normalizeText(
    primaryForm?.formKey
    || primaryForm?.tableName
    || (primaryForm as any)?.name
    || blueprint?.title,
  )
}

export const getNocodeEditorAiBlueprintArtifactPlanningContextKey = (
  block: NocodeEditorAiArtifactBlock,
) => getNocodeEditorBlueprintArtifactPlanningContextKey(block)

export const getNocodeEditorAiBlueprintIdentityKey = (input: {
  blueprint?: NocodeEditorAiArtifactBlock['blueprint'] | NocodeEditorAiStagedAppBlueprint['blueprint'] | null
  revision?: number
  stagedAt?: number
  sourcePlanningContextKey?: string | null
}) => {
  const planningContextKey = String(
    input?.sourcePlanningContextKey
    || (input?.blueprint as any)?.sourcePlanningContextKey
    || (input?.blueprint as any)?.confirmation?.planningContextKey
    || '',
  ).trim()
  const lineageKey = getNocodeEditorAiBlueprintLineageKey(
    input?.blueprint as NocodeEditorAiAppBlueprint | null | undefined,
  )
  const scopeKey = [
    planningContextKey ? `planning:${planningContextKey}` : '',
    lineageKey ? `lineage:${lineageKey}` : '',
  ].filter(Boolean).join('::')

  const blueprintId = String(input?.blueprint?.id || '').trim()
  if (blueprintId) {
    return [blueprintId, scopeKey].filter(Boolean).join('::')
  }

  const revision = Number(input?.revision || 0)
  const stagedAt = Number(input?.stagedAt || 0)
  if (revision > 0 || stagedAt > 0) {
    return `${revision}:${stagedAt}`
  }
  return ''
}
