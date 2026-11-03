import {
  buildLogicalPlanningConfirmationContextKey,
  buildPlanningConfirmationContextKey,
  parsePlanningConfirmationContextKey,
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

export type FlowSchemeDisplayVersionIndex = {
  versionByBlockKey: Map<string, number>
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

export type BuildFlowSchemeDisplayVersionIndexInput = {
  messages: NocodeEditorAiMessage[]
  artifactBlocks?: NocodeEditorAiArtifactBlock[]
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
  const primaryFormKey = outline?.forms?.[0]?.formKey
    || outline?.forms?.[0]?.tableName
    || block.appPlan?.goal
  return buildLogicalPlanningConfirmationContextKey({
    stage: block.kind,
    // 同一表单的多次规划暂存需归入同一展示家族，outlineId 每次重铸会导致版本号各自从 1 计起
    outlineId: primaryFormKey ? '' : (outline?.id || block.appPlan?.id),
    primaryFormKey,
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

  const familyIdentity = sourceLogicalKey
    ? `source:${sourceLogicalKey}`
    : `id:${blueprintId || 'unknown'}`
  return [
    familyIdentity,
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

const isFlowSchemeArtifact = (block?: NocodeEditorAiArtifactBlock | null) => (
  block?.kind === 'flow-scheme'
)

// 展示版本按「方案 + 目标表单」归族：revision 是编辑器会话级暂存计数器，
// 直接透出会让新方案的第一个版本显示成「第 7 版」。
const getFlowSchemeFamilyKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!isFlowSchemeArtifact(block)) {
    return ''
  }

  const parsed = parsePlanningConfirmationContextKey(
    stripPlanningContextVersionSuffix(block?.confirmation?.planningContextKey),
  )
  const outlineId = normalizeText(
    parsed.outlineId
    || block?.scheme?.id
    || block?.scheme?.title
    || block?.title,
  )
  const primaryFormKey = normalizeText(
    parsed.primaryFormKey
    || block?.scheme?.target?.formId
    || block?.scheme?.target?.formName,
  )
  if (!outlineId || !primaryFormKey) {
    return ''
  }

  return buildLogicalPlanningConfirmationContextKey({
    stage: 'flow-scheme',
    outlineId,
    primaryFormKey,
  })
}

const getFlowSchemeDisplayBlockKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const familyKey = getFlowSchemeFamilyKey(block)
  if (!familyKey) {
    return ''
  }

  return [
    familyKey,
    Number(block?.revision || 0),
    Number(block?.stagedAt || 0),
  ].join('::')
}

// 兜底/恢复卡可能没有 stagedAt：不能当 0（族内最早）排，否则它会抢走真实首版的位置。
// 两边都有时间才按时间排，否则退回会话级 revision（同一族内随暂存单调递增）。
const compareFlowSchemeBlocks = (
  left: NocodeEditorAiArtifactBlock,
  right: NocodeEditorAiArtifactBlock,
) => {
  const leftStagedAt = Number(left.stagedAt || 0)
  const rightStagedAt = Number(right.stagedAt || 0)
  if (leftStagedAt > 0 && rightStagedAt > 0 && leftStagedAt !== rightStagedAt) {
    return leftStagedAt - rightStagedAt
  }

  const revisionDiff = Number(left.revision || 0) - Number(right.revision || 0)
  if (revisionDiff !== 0) {
    return revisionDiff
  }

  return leftStagedAt - rightStagedAt
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

export const buildFlowSchemeDisplayVersionIndex = (
  input: BuildFlowSchemeDisplayVersionIndexInput,
): FlowSchemeDisplayVersionIndex => {
  const candidates = (
    Array.isArray(input.artifactBlocks) && input.artifactBlocks.length
      ? input.artifactBlocks
      : collectMessageArtifactBlocks(input.messages)
  ).filter(isFlowSchemeArtifact)

  const blocksByFamilyKey = new Map<string, NocodeEditorAiArtifactBlock[]>()
  const seenBlockKeys = new Set<string>()
  for (const block of candidates) {
    const blockKey = getFlowSchemeDisplayBlockKey(block)
    if (!blockKey || seenBlockKeys.has(blockKey)) {
      continue
    }
    seenBlockKeys.add(blockKey)

    const familyKey = getFlowSchemeFamilyKey(block)
    const groupedBlocks = blocksByFamilyKey.get(familyKey) || []
    groupedBlocks.push(block)
    blocksByFamilyKey.set(familyKey, groupedBlocks)
  }

  const versionByBlockKey = new Map<string, number>()
  for (const groupedBlocks of blocksByFamilyKey.values()) {
    const orderedBlocks = [...groupedBlocks].sort(compareFlowSchemeBlocks)
    orderedBlocks.forEach((block, index) => {
      const blockKey = getFlowSchemeDisplayBlockKey(block)
      if (blockKey) {
        versionByBlockKey.set(blockKey, index + 1)
      }
    })
  }

  return { versionByBlockKey }
}

export const resolveFlowSchemeDisplayVersionLabel = (
  block?: NocodeEditorAiArtifactBlock | null,
  index?: FlowSchemeDisplayVersionIndex | null,
) => {
  const blockKey = getFlowSchemeDisplayBlockKey(block)
  if (!blockKey || !index?.versionByBlockKey?.size) {
    return ''
  }

  return buildNocodeEditorVersionLabel(index.versionByBlockKey.get(blockKey))
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
  flowSchemeIndex?: FlowSchemeDisplayVersionIndex | null,
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

  if (block.kind === 'flow-scheme') {
    return resolveFlowSchemeDisplayVersionLabel(block, flowSchemeIndex)
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

const resolveSummaryCurrentVersionNumber = (content: string) => {
  const match = String(content || '').match(/当前为第\s*(\d+)\s*版/)
  return match ? Number(match[1] || 0) : 0
}

export const rewriteArtifactSummaryDisplayVersionText = (
  content: string,
  blocks: Array<NocodeEditorAiArtifactBlock | null | undefined>,
  planningIndex?: PlanningDisplayVersionIndex | null,
  blueprintIndex?: BlueprintDisplayVersionIndex | null,
  flowSchemeIndex?: FlowSchemeDisplayVersionIndex | null,
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
      displayVersionLabel: resolveArtifactDisplayVersionLabel(
        block,
        planningIndex,
        blueprintIndex,
        flowSchemeIndex,
      ),
      order,
    }))
    .filter(candidate => Boolean(candidate.displayVersionLabel))

  const titleMatchedCandidates = displayCandidates
    .filter(candidate => doesSummaryReferenceArtifactTitle(normalizedContent, candidate.block))
    .sort(compareReferencedSummaryCandidate)

  // 文案里的「当前为第 N 版」N 是暂存时刻的真实 revision，重写只用于对齐该 revision 对应卡片的
  // 展示版本号；若直接取标题匹配中最新的展示版本，会把旧文案误写成新版本（4b7315iw80l4 事故形态）。
  const rawVersion = resolveSummaryCurrentVersionNumber(normalizedContent)
  const pickRevisionAnchoredCandidates = (
    candidates: typeof displayCandidates,
  ) => (
    rawVersion > 0
      ? candidates.filter(candidate => Number(candidate.block.revision || 0) === rawVersion)
      : []
  )

  const anchoredTitleMatchedCandidates = pickRevisionAnchoredCandidates(titleMatchedCandidates)
  if (anchoredTitleMatchedCandidates.length) {
    return replaceCurrentVersionLabel(
      normalizedContent,
      anchoredTitleMatchedCandidates[0].displayVersionLabel,
    )
  }

  if (titleMatchedCandidates.length) {
    return replaceCurrentVersionLabel(
      normalizedContent,
      titleMatchedCandidates[0].displayVersionLabel,
    )
  }

  const anchoredCandidates = pickRevisionAnchoredCandidates(displayCandidates)
  if (anchoredCandidates.length) {
    return replaceCurrentVersionLabel(
      normalizedContent,
      anchoredCandidates[0].displayVersionLabel,
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
