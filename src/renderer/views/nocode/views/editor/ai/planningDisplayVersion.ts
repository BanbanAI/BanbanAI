import {
  buildLogicalPlanningConfirmationContextKey,
  buildPlanningConfirmationContextKey,
} from '@common/utils/nocodeEditorPlanningConfirmationIdentity'
import {
  buildNocodeEditorVersionLabel,
} from '@common/utils/nocodeEditorVersionLabel'
import {
  getNocodeEditorBlueprintArtifactIdentityKey,
  getNocodeEditorBlueprintArtifactLineageKey,
  getNocodeEditorBlueprintArtifactPlanningContextKey,
  getNocodeEditorBlueprintArtifactVersionKey,
} from '@common/utils/nocodeEditorArtifactBlocks'
import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiMessage,
  NocodeEditorAiStagedAppBlueprint,
  NocodeEditorAiStagedAppPlan,
  NocodeEditorAiStagedFormPlan,
} from './types'

export type PlanningDisplayVersionIndex = {
  versionByContextKey: Map<string, number>
  versionByLogicalContextKey: Map<string, number>
}

export type BlueprintSourcePlanningContextKeyIndex = Map<string, string>

export type BlueprintDisplayVersionIndex = {
  versionByBlueprintKey: Map<string, number>
}

export type BuildPlanningDisplayVersionIndexInput = {
  messages: NocodeEditorAiMessage[]
  artifactBlocks?: NocodeEditorAiArtifactBlock[]
  stagedFormPlan?: NocodeEditorAiStagedFormPlan | null
  stagedAppPlan?: NocodeEditorAiStagedAppPlan | null
  stagedBlueprint?: NocodeEditorAiStagedAppBlueprint | null
}

export type BuildBlueprintDisplayVersionIndexInput = {
  messages: NocodeEditorAiMessage[]
  artifactBlocks?: NocodeEditorAiArtifactBlock[]
  stagedBlueprint?: NocodeEditorAiStagedAppBlueprint | null
}

const normalizeText = (value: unknown) => String(value || '').trim()

const resolveVersionLabelRevision = (label: string) => {
  const match = normalizeText(label).match(/第\s*(\d+)\s*版/)
  return match ? Number(match[1] || 0) : 0
}

const isPlanningArtifact = (block?: NocodeEditorAiArtifactBlock | null) => (
  block?.kind === 'app-plan' || block?.kind === 'form-plan'
)

const isBlueprintArtifact = (block?: NocodeEditorAiArtifactBlock | null) => (
  block?.kind === 'blueprint'
)

const getPlanningArtifactOutline = (block?: NocodeEditorAiArtifactBlock | null) => (
  block?.kind === 'app-plan'
    ? (block.appPlan?.outline || block.outline)
    : block?.outline
)

const getPlanningArtifactContextKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const explicitKey = normalizeText(block?.confirmation?.planningContextKey)
  if (explicitKey) {
    return explicitKey
  }

  if (!isPlanningArtifact(block)) {
    return ''
  }

  const outline = getPlanningArtifactOutline(block)
  return buildPlanningConfirmationContextKey({
    stage: block.kind,
    outlineId: outline?.id || block.appPlan?.id,
    primaryFormKey: outline?.forms?.[0]?.formKey
      || outline?.forms?.[0]?.tableName
      || block.appPlan?.goal,
    revision: Number(block.revision || 0),
    stagedAt: Number(block.stagedAt || 0),
  })
}

const getPlanningArtifactLogicalContextKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!isPlanningArtifact(block)) {
    return ''
  }

  const outline = getPlanningArtifactOutline(block)
  return buildLogicalPlanningConfirmationContextKey({
    stage: block.kind,
    outlineId: outline?.id || block.appPlan?.id,
    primaryFormKey: outline?.forms?.[0]?.formKey
      || outline?.forms?.[0]?.tableName
      || block.appPlan?.goal,
  })
}

const comparePlanningBlocks = (
  left: NocodeEditorAiArtifactBlock,
  right: NocodeEditorAiArtifactBlock,
) => {
  const stagedAtDiff = Number(left.stagedAt || 0) - Number(right.stagedAt || 0)
  if (stagedAtDiff !== 0) {
    return stagedAtDiff
  }

  const revisionDiff = Number(left.revision || 0) - Number(right.revision || 0)
  if (revisionDiff !== 0) {
    return revisionDiff
  }

  return getPlanningArtifactContextKey(left).localeCompare(getPlanningArtifactContextKey(right))
}

const collectMessageArtifactBlocks = (messages: NocodeEditorAiMessage[]) => {
  return (Array.isArray(messages) ? messages : [])
    .flatMap((message) => {
      const blocks = Array.isArray(message?.metadata?.blocks)
        ? message.metadata.blocks
        : []
      return blocks.filter((block): block is NocodeEditorAiArtifactBlock => (
        Boolean(block)
        && typeof block === 'object'
        && (block as NocodeEditorAiArtifactBlock).type === 'artifact'
      ))
    })
}

const resolveDisplayRevisionByPlanningContextKey = (
  planningContextKey: string,
  index?: PlanningDisplayVersionIndex | null,
) => {
  const normalizedContextKey = normalizeText(planningContextKey)
  if (!normalizedContextKey) {
    return undefined
  }

  return index?.versionByContextKey.get(normalizedContextKey)
}

const getBlueprintSourcePlanningContextKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => normalizeText(getNocodeEditorBlueprintArtifactPlanningContextKey(block as any))

const getRecord = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : null
)

const stripPlanningContextVersionSuffix = (value: unknown) => (
  normalizeText(value).replace(/:\d+:\d+$/, '')
)

const getBlueprintPrimaryFormKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!isBlueprintArtifact(block)) {
    return ''
  }

  const blueprint = getRecord(block?.blueprint)
  const primaryForm = Array.isArray(blueprint?.forms)
    ? getRecord(blueprint.forms[0])
    : null
  return normalizeText(
    primaryForm?.formKey
    || primaryForm?.tableName
    || primaryForm?.name
    || block?.title
    || blueprint?.title,
  )
}

const getBlueprintFamilyKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!isBlueprintArtifact(block)) {
    return ''
  }

  const blueprint = getRecord(block?.blueprint)
  const blueprintId = normalizeText(blueprint?.id)
  const sourceLogicalKey = stripPlanningContextVersionSuffix(getBlueprintSourcePlanningContextKey(block))
  const primaryFormKey = getBlueprintPrimaryFormKey(block)
  if (!blueprintId && !sourceLogicalKey && !primaryFormKey) {
    return ''
  }

  return [
    blueprintId ? `id:${blueprintId}` : 'id:unknown',
    `source:${sourceLogicalKey || 'global'}`,
    `primary:${primaryFormKey || 'unknown'}`,
  ].join(':')
}

const getBlueprintDisplayBlockKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const familyKey = getBlueprintFamilyKey(block)
  if (!familyKey) {
    return ''
  }

  const versionKey = normalizeText(getNocodeEditorBlueprintArtifactVersionKey(block as any))
  return versionKey ? `${familyKey}:${versionKey}` : ''
}

const buildBlueprintSourcePlanningContextLookupKeys = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!isBlueprintArtifact(block)) {
    return []
  }

  const identityKey = normalizeText(getNocodeEditorBlueprintArtifactIdentityKey(block as any))
  if (!identityKey) {
    return []
  }

  const versionKey = normalizeText(getNocodeEditorBlueprintArtifactVersionKey(block as any))
  if (!versionKey) {
    return []
  }

  const lineageKey = normalizeText(getNocodeEditorBlueprintArtifactLineageKey(block as any)) || 'global'
  return [
    `identity:${identityKey}:version:${versionKey}:lineage:${lineageKey}`,
  ]
}

export const buildBlueprintSourcePlanningContextKeyIndex = (
  blocks: Array<NocodeEditorAiArtifactBlock | null | undefined>,
): BlueprintSourcePlanningContextKeyIndex => {
  const index: BlueprintSourcePlanningContextKeyIndex = new Map()

  for (const block of Array.isArray(blocks) ? blocks : []) {
    const sourcePlanningContextKey = getBlueprintSourcePlanningContextKey(block)
    if (!sourcePlanningContextKey) {
      continue
    }

    for (const key of buildBlueprintSourcePlanningContextLookupKeys(block)) {
      index.set(key, sourcePlanningContextKey)
    }
  }

  return index
}

export const collectBlueprintDisplayBlocks = (
  input: BuildBlueprintDisplayVersionIndexInput,
) => {
  const candidates = (
    Array.isArray(input.artifactBlocks) && input.artifactBlocks.length
      ? input.artifactBlocks
      : collectMessageArtifactBlocks(input.messages)
  ).filter(isBlueprintArtifact)

  const stagedBlueprint = input.stagedBlueprint
  if (stagedBlueprint?.blueprint) {
    candidates.push({
      type: 'artifact',
      kind: 'blueprint',
      status: 'ready',
      revision: stagedBlueprint.revision,
      stagedAt: stagedBlueprint.stagedAt,
      sourcePlanningContextKey: stagedBlueprint.sourcePlanningContextKey || null,
      blueprint: stagedBlueprint.blueprint,
      phase: stagedBlueprint.phase,
      applyResult: stagedBlueprint.applyResult || null,
      draftPersistenceState: stagedBlueprint.draftPersistenceState || null,
    })
  }

  return candidates
}

export const compareBlueprintDisplayBlocks = (
  left: NocodeEditorAiArtifactBlock,
  right: NocodeEditorAiArtifactBlock,
) => {
  const stagedAtDiff = Number(left.stagedAt || 0) - Number(right.stagedAt || 0)
  if (stagedAtDiff !== 0) {
    return stagedAtDiff
  }

  const revisionDiff = Number(left.revision || 0) - Number(right.revision || 0)
  if (revisionDiff !== 0) {
    return revisionDiff
  }

  return getBlueprintFamilyKey(left).localeCompare(getBlueprintFamilyKey(right))
}

export const buildBlueprintDisplayVersionIndex = (
  input: BuildBlueprintDisplayVersionIndexInput,
): BlueprintDisplayVersionIndex => {
  const blocksByFamilyKey = new Map<string, NocodeEditorAiArtifactBlock[]>()
  const seenBlockKeys = new Set<string>()
  for (const block of collectBlueprintDisplayBlocks(input)) {
    const familyKey = getBlueprintFamilyKey(block)
    if (!familyKey) {
      continue
    }
    const blockKey = getBlueprintDisplayBlockKey(block)
    const dedupeKey = blockKey || familyKey
    if (seenBlockKeys.has(dedupeKey)) {
      continue
    }
    seenBlockKeys.add(dedupeKey)

    const groupedBlocks = blocksByFamilyKey.get(familyKey) || []
    groupedBlocks.push(block)
    blocksByFamilyKey.set(familyKey, groupedBlocks)
  }

  const versionByBlueprintKey = new Map<string, number>()
  for (const [familyKey, groupedBlocks] of blocksByFamilyKey.entries()) {
    const orderedBlocks = [...groupedBlocks].sort(compareBlueprintDisplayBlocks)
    orderedBlocks.forEach((block, index) => {
      const displayRevision = index + 1
      const blockKey = getBlueprintDisplayBlockKey(block)
      if (blockKey) {
        versionByBlueprintKey.set(blockKey, displayRevision)
      } else {
        versionByBlueprintKey.set(familyKey, displayRevision)
      }
    })
  }

  return { versionByBlueprintKey }
}

export const resolveBlueprintSourcePlanningContextKey = (
  block?: NocodeEditorAiArtifactBlock | null,
  index?: BlueprintSourcePlanningContextKeyIndex | null,
) => {
  const sourcePlanningContextKey = getBlueprintSourcePlanningContextKey(block)
  if (sourcePlanningContextKey) {
    return sourcePlanningContextKey
  }

  if (!index?.size) {
    return ''
  }

  for (const key of buildBlueprintSourcePlanningContextLookupKeys(block)) {
    const indexedContextKey = normalizeText(index.get(key))
    if (indexedContextKey) {
      return indexedContextKey
    }
  }

  return ''
}

export const withBlueprintSourcePlanningContext = (
  block?: NocodeEditorAiArtifactBlock | null,
  index?: BlueprintSourcePlanningContextKeyIndex | null,
) => {
  if (!isBlueprintArtifact(block)) {
    return block
  }

  const sourcePlanningContextKey = resolveBlueprintSourcePlanningContextKey(block, index)
  if (!sourcePlanningContextKey || sourcePlanningContextKey === getBlueprintSourcePlanningContextKey(block)) {
    return block
  }

  return {
    ...block,
    sourcePlanningContextKey,
  }
}

export const buildPlanningDisplayVersionIndex = (
  input: BuildPlanningDisplayVersionIndexInput,
): PlanningDisplayVersionIndex => {
  const candidates = (
    Array.isArray(input.artifactBlocks) && input.artifactBlocks.length
      ? input.artifactBlocks
      : collectMessageArtifactBlocks(input.messages)
  ).filter(isPlanningArtifact)

  const blocksByLogicalContextKey = new Map<string, NocodeEditorAiArtifactBlock[]>()
  for (const block of candidates) {
    const logicalContextKey = getPlanningArtifactLogicalContextKey(block)
    if (!logicalContextKey) {
      continue
    }

    const groupedBlocks = blocksByLogicalContextKey.get(logicalContextKey) || []
    groupedBlocks.push(block)
    blocksByLogicalContextKey.set(logicalContextKey, groupedBlocks)
  }

  const versionByContextKey = new Map<string, number>()
  const versionByLogicalContextKey = new Map<string, number>()

  for (const [logicalContextKey, groupedBlocks] of blocksByLogicalContextKey.entries()) {
    const orderedBlocks = [...groupedBlocks].sort(comparePlanningBlocks)
    orderedBlocks.forEach((block, index) => {
      const displayRevision = index + 1
      const contextKey = getPlanningArtifactContextKey(block)
      if (contextKey) {
        versionByContextKey.set(contextKey, displayRevision)
      }
      versionByLogicalContextKey.set(logicalContextKey, displayRevision)
    })
  }

  return {
    versionByContextKey,
    versionByLogicalContextKey,
  }
}

export const resolvePlanningArtifactDisplayRevision = (
  block?: NocodeEditorAiArtifactBlock | null,
  index?: PlanningDisplayVersionIndex | null,
) => {
  const contextKey = getPlanningArtifactContextKey(block)
  return resolveDisplayRevisionByPlanningContextKey(contextKey, index)
}

export const resolveBlueprintDisplayRevision = (
  block?: NocodeEditorAiArtifactBlock | null,
  index?: BlueprintDisplayVersionIndex | null,
) => {
  return resolveIndependentBlueprintDisplayRevision(block, index)
}

export const resolveIndependentBlueprintDisplayRevision = (
  block?: NocodeEditorAiArtifactBlock | null,
  index?: BlueprintDisplayVersionIndex | null,
) => {
  if (!isBlueprintArtifact(block) || !index?.versionByBlueprintKey?.size) {
    return undefined
  }

  const blockKey = getBlueprintDisplayBlockKey(block)
  if (blockKey) {
    return index.versionByBlueprintKey.get(blockKey)
  }

  const familyKey = getBlueprintFamilyKey(block)
  return familyKey ? index.versionByBlueprintKey.get(familyKey) : undefined
}

export const resolvePlanningArtifactDisplayVersionLabel = (
  block?: NocodeEditorAiArtifactBlock | null,
  index?: PlanningDisplayVersionIndex | null,
) => {
  const displayRevision = resolvePlanningArtifactDisplayRevision(block, index)
  return buildNocodeEditorVersionLabel(displayRevision)
}

export const resolveBlueprintDisplayVersionLabel = (
  block?: NocodeEditorAiArtifactBlock | null,
  index?: BlueprintDisplayVersionIndex | null,
) => {
  return resolveIndependentBlueprintDisplayVersionLabel(block, index)
}

export const resolveIndependentBlueprintDisplayVersionLabel = (
  block?: NocodeEditorAiArtifactBlock | null,
  index?: BlueprintDisplayVersionIndex | null,
) => {
  const displayRevision = resolveIndependentBlueprintDisplayRevision(block, index)
  return buildNocodeEditorVersionLabel(displayRevision)
}

const replaceCurrentVersionLabel = (
  content: string,
  nextVersionLabel: string,
) => {
  const normalizedContent = String(content || '')
  const normalizedVersionLabel = normalizeText(nextVersionLabel)
  if (!normalizedContent || !normalizedVersionLabel) {
    return normalizedContent
  }

  return normalizedContent
    .replace(/当前为第\s*\d+\s*版/g, `当前为${normalizedVersionLabel}`)
    .replace(/（当前为第\s*\d+\s*版）/g, `（当前为${normalizedVersionLabel}）`)
}

const resolveArtifactDisplayVersionLabel = (
  block?: NocodeEditorAiArtifactBlock | null,
  planningIndex?: PlanningDisplayVersionIndex | null,
  blueprintIndex?: BlueprintDisplayVersionIndex | null,
) => {
  if (!block) {
    return ''
  }

  if (block.kind === 'app-plan' || block.kind === 'form-plan') {
    return resolvePlanningArtifactDisplayVersionLabel(block, planningIndex)
      || resolveExplicitArtifactDisplayVersionLabel(block)
  }

  if (block.kind === 'blueprint') {
    return resolveBlueprintDisplayVersionLabel(block, blueprintIndex)
      || resolveExplicitArtifactDisplayVersionLabel(block)
  }

  if (block.kind === 'formula-plan') {
    return resolveFormulaPlanDisplayVersionLabel(block)
  }

  return resolveExplicitArtifactDisplayVersionLabel(block)
}

const resolveExplicitArtifactDisplayVersionLabel = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const displayVersionLabel = normalizeText((block as any)?.displayVersionLabel)
  if (displayVersionLabel) {
    return displayVersionLabel
  }

  return buildNocodeEditorVersionLabel(Number((block as any)?.displayRevision || 0))
}

export const resolveFormulaPlanDisplayVersionLabel = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (block?.kind !== 'formula-plan') {
    return ''
  }

  return resolveExplicitArtifactDisplayVersionLabel(block)
    || buildNocodeEditorVersionLabel(Number(block.revision || 0))
}

const getSummaryArtifactTitleCandidates = (
  block?: NocodeEditorAiArtifactBlock | null,
) => [
  block?.title,
  block?.blueprint?.title,
  block?.outline?.title,
  block?.appPlan?.goal,
].map(value => normalizeText(value)).filter(Boolean)

const doesSummaryReferenceArtifactTitle = (
  content: string,
  block?: NocodeEditorAiArtifactBlock | null,
) => getSummaryArtifactTitleCandidates(block).some(title => content.includes(title))

const compareReferencedSummaryCandidate = (
  left: {
    block: NocodeEditorAiArtifactBlock
    displayVersionLabel: string
    order: number
  },
  right: {
    block: NocodeEditorAiArtifactBlock
    displayVersionLabel: string
    order: number
  },
) => {
  const displayRevisionDiff = resolveVersionLabelRevision(right.displayVersionLabel)
    - resolveVersionLabelRevision(left.displayVersionLabel)
  if (displayRevisionDiff !== 0) {
    return displayRevisionDiff
  }

  const stagedAtDiff = Number(right.block.stagedAt || 0) - Number(left.block.stagedAt || 0)
  if (stagedAtDiff !== 0) {
    return stagedAtDiff
  }

  const revisionDiff = Number(right.block.revision || 0) - Number(left.block.revision || 0)
  if (revisionDiff !== 0) {
    return revisionDiff
  }

  return left.order - right.order
}

export const rewriteArtifactSummaryDisplayVersionText = (
  content: string,
  blocks: Array<NocodeEditorAiArtifactBlock | null | undefined>,
  planningIndex?: PlanningDisplayVersionIndex | null,
  blueprintIndex?: BlueprintDisplayVersionIndex | null,
) => {
  const normalizedContent = String(content || '')
  if (!normalizedContent) {
    return normalizedContent
  }

  const artifactBlocks = Array.isArray(blocks)
    ? blocks.filter((block): block is NocodeEditorAiArtifactBlock => Boolean(block))
    : []
  const displayCandidates = artifactBlocks
    .map((block, order) => ({
      block,
      displayVersionLabel: resolveArtifactDisplayVersionLabel(block, planningIndex, blueprintIndex),
      order,
    }))
    .filter(candidate => Boolean(candidate.displayVersionLabel))

  const titleMatchedCandidates = displayCandidates
    .filter(candidate => doesSummaryReferenceArtifactTitle(normalizedContent, candidate.block))
    .sort(compareReferencedSummaryCandidate)

  if (titleMatchedCandidates.length) {
    return replaceCurrentVersionLabel(
      normalizedContent,
      titleMatchedCandidates[0].displayVersionLabel,
    )
  }

  for (const candidate of displayCandidates) {
    const nextContent = replaceCurrentVersionLabel(normalizedContent, candidate.displayVersionLabel)
    if (nextContent !== normalizedContent) {
      return nextContent
    }
  }

  return normalizedContent
}
