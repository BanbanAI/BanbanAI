import {
  buildBlueprintArtifactVersionFromParts,
  getNocodeEditorAiBlueprintArtifactIdentityKey,
  getNocodeEditorAiBlueprintContentSignatureKey,
  getNocodeEditorAiBlueprintPlanningContextKey,
  getNocodeEditorAiBlueprintPrimaryFormFamilyKey,
} from './blueprintArtifactIdentity'
import {
  isBlueprintStagedPhase,
  normalizeBlueprintPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import {
  normalizeNocodeEditorPlanningScopeValue,
} from '@common/utils/nocodeEditorPostFormFlowScope'
import {
  getNocodeEditorBlueprintFormApplyTargetIdentity,
} from '@common/utils/nocodeEditorBlueprintFormNormalization'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiMessage,
  NocodeEditorAiStageBlueprintDisplayItem,
  NocodeEditorAiStagedAppBlueprint,
} from './types'
import i18next from 'i18next'

export type NocodeEditorAiPendingBlueprintWorkspace = {
  currentItems: NocodeEditorAiStageBlueprintDisplayItem[]
  historyItems: NocodeEditorAiStageBlueprintDisplayItem[]
}

type PendingBlueprintVersionBatch = {
  workspaceKey: string
  versionKey: string
  identityKey: string
  revision: number
  stagedAt: number
  updatedAt: number
  items: NocodeEditorAiStageBlueprintDisplayItem[]
}

export type NocodeEditorAiPendingBlueprintApplyBatch = {
  key: string
  updatedAt: number
  revision: number
  stagedAt: number
  items: NocodeEditorAiStageBlueprintDisplayItem[]
  item: NocodeEditorAiStageBlueprintDisplayItem
}

const cloneBlueprintValue = <T,>(value: T): T => (
  value == null ? value : JSON.parse(JSON.stringify(value))
)

const normalizeBlueprintDisplayToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')
  .replace(/[^\p{Letter}\p{Number}]/gu, '')

const getBlueprintFormDisplayKey = (
  form: { formKey?: string; groupName?: string; tableName?: string } | null | undefined,
  index = 0,
) => {
  const formKey = String(form?.formKey || '').trim()
  if (formKey) {
    return formKey
  }

  const groupName = normalizeBlueprintDisplayToken(form?.groupName)
  const tableName = normalizeBlueprintDisplayToken(form?.tableName)
  if (groupName || tableName) {
    return [groupName || 'nogroup', tableName || 'noname'].join('::')
  }

  return `form-${index + 1}`
}

const getBlueprintIdentityKey = (input: {
  blueprint?: NocodeEditorAiAppBlueprint | null
  revision?: number
  stagedAt?: number
}) => {
  const blueprintId = String(input?.blueprint?.id || '').trim()
  if (blueprintId) {
    return blueprintId
  }
  const revision = Number(input?.revision || 0)
  const stagedAt = Number(input?.stagedAt || 0)
  if (revision > 0 || stagedAt > 0) {
    return `${revision}:${stagedAt}`
  }
  return ''
}

const getBlueprintSourcePlanningContextKey = (
  block: NocodeEditorAiArtifactBlock,
) => getNocodeEditorAiBlueprintPlanningContextKey({
  block,
  blueprint: block.blueprint,
  sourcePlanningContextKey: block.sourcePlanningContextKey,
})

const getPendingBlueprintDisplayIdentityKey = (input: {
  workspaceKey: string
  versionKey: string
  formDisplayKey: string
  contentSignatureKey: string
}) => [
  input.workspaceKey,
  `version:${input.versionKey || 'unknown'}`,
  `form:${input.formDisplayKey || 'unknown'}`,
  `content:${input.contentSignatureKey || 'unknown'}`,
].join('|')

const shouldPreferPendingBlueprintBatch = (
  nextBatch: PendingBlueprintVersionBatch,
  currentBatch?: PendingBlueprintVersionBatch,
) => {
  if (!currentBatch) {
    return true
  }

  const nextResolved = nextBatch.items.some(item => isResolvedDraftPersistenceState(item.draftPersistenceState))
  const currentResolved = currentBatch.items.some(item => isResolvedDraftPersistenceState(item.draftPersistenceState))
  if (nextResolved !== currentResolved) {
    return nextResolved
  }

  if (nextBatch.updatedAt !== currentBatch.updatedAt) {
    return nextBatch.updatedAt > currentBatch.updatedAt
  }

  if (nextBatch.revision !== currentBatch.revision) {
    return nextBatch.revision > currentBatch.revision
  }

  if (nextBatch.stagedAt !== currentBatch.stagedAt) {
    return nextBatch.stagedAt > currentBatch.stagedAt
  }

  return nextBatch.versionKey.localeCompare(currentBatch.versionKey) > 0
}

const isResolvedDraftPersistenceState = (value: unknown) => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && (value as Record<string, unknown>).resolved === true
)

const shouldPreferPendingBlueprintItem = (
  nextItem: NocodeEditorAiStageBlueprintDisplayItem,
  currentItem?: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  if (!currentItem) {
    return true
  }

  const nextResolved = isResolvedDraftPersistenceState(nextItem.draftPersistenceState)
  const currentResolved = isResolvedDraftPersistenceState(currentItem.draftPersistenceState)
  if (nextResolved !== currentResolved) {
    return nextResolved
  }

  return Number(nextItem.updatedAt || 0) >= Number(currentItem.updatedAt || 0)
}

const isSamePendingBlueprintBatch = (
  left: PendingBlueprintVersionBatch,
  right: PendingBlueprintVersionBatch,
) => (
  left.workspaceKey === right.workspaceKey
  && left.versionKey === right.versionKey
  && left.identityKey === right.identityKey
)

const mergeSameVersionPendingBlueprintBatches = (
  left: PendingBlueprintVersionBatch,
  right: PendingBlueprintVersionBatch,
): PendingBlueprintVersionBatch => {
  const items = dedupePendingBlueprintItems([...left.items, ...right.items]).sort(compareItems)
  const identityKey = items
    .map(getPendingBlueprintItemDedupKey)
    .sort()
    .join('||')

  return {
    workspaceKey: left.workspaceKey,
    versionKey: left.versionKey,
    identityKey: identityKey || left.identityKey || right.identityKey,
    revision: Math.max(left.revision, right.revision),
    stagedAt: Math.max(left.stagedAt, right.stagedAt),
    updatedAt: Math.max(left.updatedAt, right.updatedAt),
    items,
  }
}

const compareItems = (
  left: NocodeEditorAiStageBlueprintDisplayItem,
  right: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  const timeDiff = Number(right.updatedAt || 0) - Number(left.updatedAt || 0)
  if (timeDiff !== 0) {
    return timeDiff
  }

  return String(right.id || '').localeCompare(String(left.id || ''))
}

const compareBatches = (
  left: PendingBlueprintVersionBatch,
  right: PendingBlueprintVersionBatch,
) => {
  const timeDiff = right.updatedAt - left.updatedAt
  if (timeDiff !== 0) {
    return timeDiff
  }

  if (right.revision !== left.revision) {
    return right.revision - left.revision
  }

  if (right.stagedAt !== left.stagedAt) {
    return right.stagedAt - left.stagedAt
  }

  return right.versionKey.localeCompare(left.versionKey)
}

const getPendingBlueprintItemDedupKey = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  const form = Array.isArray(item.blueprint?.forms) ? item.blueprint.forms[0] : null
  const formDisplayKey = getBlueprintFormDisplayKey(form, 0)
  const workspaceKey = getPendingBlueprintWorkspaceKey({
    item,
    blueprint: item.blueprint,
    revision: Number(item.revision || 0),
    stagedAt: Number(item.stagedAt || 0),
    sourcePlanningContextKey: item.sourcePlanningContextKey,
    identityKey: item.identityKey,
    itemId: item.id,
  })
  const versionKey = buildBlueprintArtifactVersionFromParts({
    revision: Number(item.revision || 0),
    stagedAt: Number(item.stagedAt || 0),
    phase: item.phase,
    applyResult: item.applyResult || null,
  })
  const contentSignatureKey = item.itemKind === 'ai_blueprint'
    ? (item.contentSignatureKey || getNocodeEditorAiBlueprintContentSignatureKey(item.blueprint))
    : getNocodeEditorAiBlueprintContentSignatureKey(item.blueprint)

  return [
    workspaceKey,
    `version:${versionKey || 'unknown'}`,
    `form:${formDisplayKey || 'unknown'}`,
    `content:${contentSignatureKey || 'unknown'}`,
  ].join('|')
}

const dedupePendingBlueprintItems = (
  items: NocodeEditorAiStageBlueprintDisplayItem[],
) => {
  const deduped = new Map<string, NocodeEditorAiStageBlueprintDisplayItem>()
  for (const item of items) {
    const key = getPendingBlueprintItemDedupKey(item)
    const current = deduped.get(key)
    if (shouldPreferPendingBlueprintItem(item, current)) {
      deduped.set(key, item)
    }
  }
  return Array.from(deduped.values())
}

const getPendingBlueprintWorkspaceKey = (input: {
  item?: Pick<NocodeEditorAiStageBlueprintDisplayItem, 'sourcePlanningContextKey' | 'identityKey' | 'id' | 'revision' | 'stagedAt' | 'blueprint' | 'title'> | null
  blueprint?: NocodeEditorAiAppBlueprint | null
  revision?: number
  stagedAt?: number
  sourcePlanningContextKey?: string | null
  title?: string | null
  identityKey?: string
  itemId?: string
}) => {
  const blueprint = input?.blueprint || input?.item?.blueprint
  const planningContextKey = getNocodeEditorAiBlueprintPlanningContextKey({
    blueprint,
    sourcePlanningContextKey: input?.sourcePlanningContextKey || input?.item?.sourcePlanningContextKey,
  })
  if (planningContextKey) {
    return `planning:${planningContextKey}`
  }

  const title = String(input?.title || input?.item?.title || blueprint?.title || '').trim()
  const primaryFormFamilyKey = getNocodeEditorAiBlueprintPrimaryFormFamilyKey(blueprint)
  if (title || primaryFormFamilyKey) {
    return [
      `title:${title || 'unknown'}`,
      `primary:${primaryFormFamilyKey || 'unknown'}`,
    ].join('|')
  }

  const blueprintId = String(blueprint?.id || '').trim()
  if (blueprintId) {
    return `blueprint:${blueprintId}`
  }

  const artifactIdentityKey = getNocodeEditorAiBlueprintArtifactIdentityKey({
    blueprint,
    title,
  })
  if (artifactIdentityKey) {
    return `artifact:${artifactIdentityKey}`
  }

  const identityKey = String(input?.identityKey || input?.item?.identityKey || '').trim()
  if (identityKey) {
    return `identity:${identityKey}`
  }

  return `item:${String(input?.itemId || input?.item?.id || '').trim()}`
}

const normalizeTargetFormKeys = (targetFormKeys?: string[] | null) => (
  Array.isArray(targetFormKeys)
    ? targetFormKeys
      .map(value => String(value || '').trim())
      .filter(Boolean)
    : []
)

const collectBlueprintTargetFormKeys = (
  blueprint?: NocodeEditorAiAppBlueprint | null,
  targetFormKeys?: string[] | null,
) => {
  const normalizedTargetFormKeys = normalizeTargetFormKeys(targetFormKeys)
  if (normalizedTargetFormKeys.length) {
    return normalizedTargetFormKeys
  }

  return (Array.isArray(blueprint?.forms) ? blueprint.forms : [])
    .map(form => getNocodeEditorBlueprintFormApplyTargetIdentity(form))
    .filter(Boolean)
}

const getPendingBlueprintItemApplyTargetIdentity = (
  item?: Pick<NocodeEditorAiStageBlueprintDisplayItem, 'blueprint'> | null,
) => getNocodeEditorBlueprintFormApplyTargetIdentity(
  Array.isArray(item?.blueprint?.forms) ? item?.blueprint?.forms?.[0] : null,
)

export const collectPendingBlueprintIdentityKeysByTargetFormKeys = (
  items: NocodeEditorAiStageBlueprintDisplayItem[],
  input: {
    blueprint?: NocodeEditorAiAppBlueprint | null
    revision?: number
    stagedAt?: number
    sourcePlanningContextKey?: string | null
    title?: string | null
    targetFormKeys?: string[] | null
  },
) => {
  const workspaceKey = getPendingBlueprintWorkspaceKey({
    blueprint: input.blueprint,
    revision: Number(input.revision || 0),
    stagedAt: Number(input.stagedAt || 0),
    sourcePlanningContextKey: input.sourcePlanningContextKey || null,
    title: input.title || undefined,
  })
  const targetFormKeySet = new Set(
    collectBlueprintTargetFormKeys(input.blueprint, input.targetFormKeys),
  )

  if (!workspaceKey || !targetFormKeySet.size) {
    return []
  }

  const expectedRevision = Number(input.revision || 0)
  const expectedStagedAt = Number(input.stagedAt || 0)

  return Array.from(new Set(
    (Array.isArray(items) ? items : [])
      .filter((item) => {
        if (item.itemKind !== 'ai_blueprint') {
          return false
        }

        const itemWorkspaceKey = getPendingBlueprintWorkspaceKey({
          item,
          blueprint: item.blueprint,
          revision: Number(item.revision || 0),
          stagedAt: Number(item.stagedAt || 0),
          sourcePlanningContextKey: item.sourcePlanningContextKey,
          identityKey: item.identityKey,
          itemId: item.id,
        })
        if (itemWorkspaceKey !== workspaceKey) {
          return false
        }

        if (expectedRevision > 0 && Number(item.revision || 0) !== expectedRevision) {
          return false
        }

        if (expectedStagedAt > 0 && Number(item.stagedAt || 0) !== expectedStagedAt) {
          return false
        }

        const targetFormKey = getPendingBlueprintItemApplyTargetIdentity(item)
        return Boolean(targetFormKey && targetFormKeySet.has(targetFormKey))
      })
      .map(item => String(item.identityKey || '').trim())
      .filter(Boolean),
  ))
}

const getBlueprintBlockSortTime = (
  block: NocodeEditorAiArtifactBlock,
  createTime?: number,
) => (
  Number(block.applyResult?.finishedAt || 0)
  || Number(block.stagedAt || 0)
  || Number(createTime || 0)
)

export const buildPendingBlueprintDisplayItems = (
  block: NocodeEditorAiArtifactBlock,
  createTime?: number,
  traceId?: string | null,
): NocodeEditorAiStageBlueprintDisplayItem[] => {
  if (block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint) {
    return []
  }

  const revision = Number(block.revision || 0)
  const stagedAt = Number(block.stagedAt || 0)
  const sourcePlanningContextKey = getBlueprintSourcePlanningContextKey(block)
  const workspaceKey = getPendingBlueprintWorkspaceKey({
    blueprint: block.blueprint,
    revision,
    stagedAt,
    sourcePlanningContextKey,
    title: block.title,
    itemId: traceId || String(createTime || ''),
  })
  const versionKey = buildBlueprintArtifactVersionFromParts({
    revision,
    stagedAt,
    phase: block.phase,
    applyResult: block.applyResult || null,
  })
  const contentSignatureKey = getNocodeEditorAiBlueprintContentSignatureKey(block.blueprint)

  if (!workspaceKey) {
    return []
  }

  const forms = Array.isArray(block.blueprint.forms) ? block.blueprint.forms : []
  if (!forms.length) {
    return []
  }

  const blockSortTime = getBlueprintBlockSortTime(block, createTime)
  const phase = normalizeBlueprintPhase(block.phase)

  return forms.map((form, index) => {
    const formDisplayKey = getBlueprintFormDisplayKey(form, index)
    const identityKey = getPendingBlueprintDisplayIdentityKey({
      workspaceKey,
      versionKey,
      formDisplayKey,
      contentSignatureKey,
    })
    return {
      itemKind: 'ai_blueprint',
      id: `pending:${identityKey}`,
      identityKey,
      contentSignatureKey,
      planningScope: normalizeNocodeEditorPlanningScopeValue(block.planningScope),
      phase,
      status: phase,
      source: phase === 'staged' ? 'ai-staged' : 'ai-apply',
      title: String(form.tableName || block.title || block.blueprint?.title || i18next.t('pendingBlueprintWorkspace.blueprintDraft')).trim() || i18next.t('pendingBlueprintWorkspace.blueprintDraft'),
      summary: String(form.description || block.summary || block.blueprint?.summary || '').trim() || undefined,
      createdAt: Number(block.stagedAt || block.applyResult?.finishedAt || createTime || 0) || undefined,
      updatedAt: blockSortTime || Number(createTime || 0) || Date.now(),
      revision: revision || undefined,
      stagedAt: stagedAt || undefined,
      traceId: traceId || null,
      sourcePlanningContextKey,
      applyResult: phase === 'staged' ? null : block.applyResult || null,
      draftPersistenceState: block.draftPersistenceState || null,
      blueprint: {
        ...cloneBlueprintValue(block.blueprint),
        forms: [cloneBlueprintValue(form)],
      },
    }
  })
}

const isPendingBlueprintApplyItem = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
) => (
  item?.itemKind === 'ai_blueprint'
  && isBlueprintStagedPhase(item.phase)
  && Boolean(item.blueprint)
)

const getPendingBlueprintApplyBatchKey = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  const revision = Number(item.revision || 0)
  const stagedAt = Number(item.stagedAt || 0)
  const blueprintIdentityKey = getBlueprintIdentityKey({
    blueprint: item.blueprint,
    revision,
    stagedAt,
  }) || String(item.identityKey || '').trim()
  const workspaceKey = getPendingBlueprintWorkspaceKey({
    item,
    blueprint: item.blueprint,
    revision,
    stagedAt,
    sourcePlanningContextKey: item.sourcePlanningContextKey,
    identityKey: blueprintIdentityKey,
    itemId: item.id,
  })
  const versionKey = buildBlueprintArtifactVersionFromParts({
    revision,
    stagedAt,
    phase: item.phase,
    applyResult: item.applyResult || null,
  })

  return [
    workspaceKey,
    `blueprint:${blueprintIdentityKey || 'unknown'}`,
    `version:${versionKey}`,
  ].join('|')
}

const mergePendingBlueprintApplyForms = (
  items: NocodeEditorAiStageBlueprintDisplayItem[],
) => {
  const seen = new Set<string>()
  const forms: NocodeEditorAiAppBlueprint['forms'] = []

  for (const item of items) {
    const itemForms = Array.isArray(item.blueprint?.forms) ? item.blueprint.forms : []
    for (const form of itemForms) {
      const key = getBlueprintFormDisplayKey(form, forms.length)
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      forms.push(cloneBlueprintValue(form))
    }
  }

  return forms
}

const buildPendingBlueprintApplyBatchItem = (
  key: string,
  items: NocodeEditorAiStageBlueprintDisplayItem[],
) => {
  const representative = items[0]
  const forms = mergePendingBlueprintApplyForms(items)
  const baseBlueprint = cloneBlueprintValue(representative.blueprint)

  return {
    ...representative,
    id: `pending-batch:${key}`,
    identityKey: key,
    title: String(baseBlueprint?.title || representative.title || '').trim() || representative.title,
    summary: String(baseBlueprint?.summary || representative.summary || '').trim() || representative.summary,
    blueprint: baseBlueprint
      ? {
        ...baseBlueprint,
        forms,
      }
      : representative.blueprint,
  } as NocodeEditorAiStageBlueprintDisplayItem
}

export const collectPendingBlueprintApplyBatches = (
  items: NocodeEditorAiStageBlueprintDisplayItem[],
): NocodeEditorAiPendingBlueprintApplyBatch[] => {
  const grouped = new Map<string, NocodeEditorAiStageBlueprintDisplayItem[]>()

  for (const item of Array.isArray(items) ? items : []) {
    if (!isPendingBlueprintApplyItem(item)) {
      continue
    }

    const key = getPendingBlueprintApplyBatchKey(item)
    const current = grouped.get(key) || []
    current.push(item)
    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .map(([key, batchItems]) => {
      const sortedItems = [...batchItems].sort(compareItems)
      const representative = sortedItems[0]
      return {
        key,
        updatedAt: Number(representative.updatedAt || representative.stagedAt || representative.createdAt || 0),
        revision: Number(representative.revision || 0),
        stagedAt: Number(representative.stagedAt || 0),
        items: sortedItems,
        item: buildPendingBlueprintApplyBatchItem(key, batchItems),
      }
    })
    .sort((left, right) => {
      const timeDiff = right.updatedAt - left.updatedAt
      if (timeDiff !== 0) {
        return timeDiff
      }

      if (right.revision !== left.revision) {
        return right.revision - left.revision
      }

      if (right.stagedAt !== left.stagedAt) {
        return right.stagedAt - left.stagedAt
      }

      return right.key.localeCompare(left.key)
    })
}

const buildPendingBlueprintVersionBatchFromBlock = (
  block: NocodeEditorAiArtifactBlock,
  createTime?: number,
  traceId?: string | null,
): PendingBlueprintVersionBatch | null => {
  const items = dedupePendingBlueprintItems(buildPendingBlueprintDisplayItems(block, createTime, traceId))
  if (!items.length) {
    return null
  }

  const firstItem = items[0]
  const revision = Number(block.revision || firstItem.revision || 0)
  const stagedAt = Number(block.stagedAt || firstItem.stagedAt || 0)
  const updatedAt = getBlueprintBlockSortTime(block, createTime)
    || Number(firstItem.updatedAt || 0)
    || Date.now()
  const workspaceKey = getPendingBlueprintWorkspaceKey({
    item: firstItem,
    blueprint: block.blueprint,
    revision,
    stagedAt,
    sourcePlanningContextKey: firstItem.sourcePlanningContextKey,
    identityKey: firstItem.identityKey,
    itemId: firstItem.id,
    title: block.title,
  })
  const identityKey = items
    .map(getPendingBlueprintItemDedupKey)
    .sort()
    .join('||') || workspaceKey

  return {
    workspaceKey,
    versionKey: buildBlueprintArtifactVersionFromParts({
      revision,
      stagedAt,
      phase: block.phase,
      applyResult: block.applyResult || null,
    }),
    identityKey,
    revision,
    stagedAt,
    updatedAt,
    items,
  }
}

const buildPendingBlueprintVersionBatchFromCurrent = (
  currentBlueprint: NocodeEditorAiStagedAppBlueprint,
): PendingBlueprintVersionBatch | null => {
  if (!currentBlueprint.blueprint || !isBlueprintStagedPhase(currentBlueprint.phase)) {
    return null
  }

  const currentBlock: NocodeEditorAiArtifactBlock = {
    type: 'artifact',
    kind: 'blueprint',
    status: 'ready',
    phase: 'staged',
    revision: Number(currentBlueprint.revision || 0),
    stagedAt: Number(currentBlueprint.stagedAt || 0) || undefined,
    title: currentBlueprint.blueprint.title,
    summary: currentBlueprint.blueprint.summary,
    confirmation: currentBlueprint.sourcePlanningContextKey
      ? {
        ...(((currentBlueprint.blueprint as any)?.confirmation || {}) as Record<string, unknown>),
        planningContextKey: currentBlueprint.sourcePlanningContextKey,
      }
      : (currentBlueprint.blueprint as any)?.confirmation,
    blueprint: currentBlueprint.blueprint,
    applyResult: null,
    draftPersistenceState: currentBlueprint.draftPersistenceState || null,
  }

  return buildPendingBlueprintVersionBatchFromBlock(
    currentBlock,
    Number(currentBlueprint.stagedAt || 0) || undefined,
    null,
  )
}

const pruneAppliedItemsFromPendingBatch = (
  batch: PendingBlueprintVersionBatch,
  input: {
    blueprint?: NocodeEditorAiAppBlueprint | null
    revision?: number
    stagedAt?: number
    sourcePlanningContextKey?: string | null
    title?: string | null
    targetFormKeys?: string[] | null
  },
): PendingBlueprintVersionBatch | null => {
  const appliedIdentityKeySet = new Set(
    collectPendingBlueprintIdentityKeysByTargetFormKeys(batch.items, input),
  )
  if (!appliedIdentityKeySet.size) {
    return batch
  }

  const nextItems = batch.items.filter(item => !appliedIdentityKeySet.has(item.identityKey))
  if (!nextItems.length) {
    return null
  }

  return {
    ...batch,
    identityKey: nextItems
      .map(getPendingBlueprintItemDedupKey)
      .sort()
      .join('||') || batch.workspaceKey,
    items: nextItems,
  }
}

type ArtifactBlockCollector = (message: NocodeEditorAiMessage) => NocodeEditorAiArtifactBlock[]

const defaultGetAllArtifactBlocks: ArtifactBlockCollector = (message) => {
  const blocks = Array.isArray(message?.metadata?.blocks)
    ? message.metadata?.blocks
    : []

  return blocks.filter((block): block is NocodeEditorAiArtifactBlock => (
    Boolean(block)
    && typeof block === 'object'
    && (block as NocodeEditorAiArtifactBlock).type === 'artifact'
  ))
}

export const collectPendingBlueprintWorkspace = (
  messageList: NocodeEditorAiMessage[],
  currentBlueprint: NocodeEditorAiStagedAppBlueprint,
  options: {
    getAllArtifactBlocks?: ArtifactBlockCollector
  } = {},
): NocodeEditorAiPendingBlueprintWorkspace => {
  const getAllArtifactBlocks = options.getAllArtifactBlocks || defaultGetAllArtifactBlocks
  const latestBatchByWorkspaceKey = new Map<string, PendingBlueprintVersionBatch>()
  const historyBatchByWorkspaceKey = new Map<string, PendingBlueprintVersionBatch[]>()

  const registerPendingBatch = (batch: PendingBlueprintVersionBatch) => {
    if (!batch.workspaceKey) {
      return
    }

    const currentLatestBatch = latestBatchByWorkspaceKey.get(batch.workspaceKey)
    if (!currentLatestBatch) {
      latestBatchByWorkspaceKey.set(batch.workspaceKey, batch)
      return
    }

    if (isSamePendingBlueprintBatch(batch, currentLatestBatch)) {
      latestBatchByWorkspaceKey.set(
        batch.workspaceKey,
        mergeSameVersionPendingBlueprintBatches(currentLatestBatch, batch),
      )
      return
    }

    if (batch.versionKey === currentLatestBatch.versionKey) {
      latestBatchByWorkspaceKey.set(
        batch.workspaceKey,
        mergeSameVersionPendingBlueprintBatches(currentLatestBatch, batch),
      )
      return
    }

    if (shouldPreferPendingBlueprintBatch(batch, currentLatestBatch)) {
      const historyItems = historyBatchByWorkspaceKey.get(batch.workspaceKey) || []
      historyItems.push(currentLatestBatch)
      historyBatchByWorkspaceKey.set(batch.workspaceKey, historyItems)
      latestBatchByWorkspaceKey.set(batch.workspaceKey, batch)
      return
    }

    const historyItems = historyBatchByWorkspaceKey.get(batch.workspaceKey) || []
    historyItems.push(batch)
    historyBatchByWorkspaceKey.set(batch.workspaceKey, historyItems)
  }

  const registerAppliedBatch = (block: NocodeEditorAiArtifactBlock, createTime?: number, traceId?: string | null) => {
    const batch = buildPendingBlueprintVersionBatchFromBlock(block, createTime, traceId)
    if (!batch?.workspaceKey) {
      return
    }

    const sourcePlanningContextKey = getBlueprintSourcePlanningContextKey(block)
    const targetFormKeys = Array.isArray(block.blueprint?.forms)
      ? block.blueprint.forms
        .map(form => getNocodeEditorBlueprintFormApplyTargetIdentity(form))
        .filter(Boolean)
      : []
    const pruneInput = {
      blueprint: block.blueprint,
      revision: batch.revision,
      stagedAt: batch.stagedAt,
      sourcePlanningContextKey,
      title: block.title,
      targetFormKeys,
    }

    const latestBatch = latestBatchByWorkspaceKey.get(batch.workspaceKey)
    if (latestBatch) {
      const nextLatestBatch = pruneAppliedItemsFromPendingBatch(latestBatch, pruneInput)
      if (nextLatestBatch) {
        latestBatchByWorkspaceKey.set(batch.workspaceKey, nextLatestBatch)
      } else {
        latestBatchByWorkspaceKey.delete(batch.workspaceKey)
      }
    }

    const historyItems = historyBatchByWorkspaceKey.get(batch.workspaceKey) || []
    if (!historyItems.length) {
      historyBatchByWorkspaceKey.delete(batch.workspaceKey)
      return
    }

    const nextHistoryItems = historyItems
      .map(item => pruneAppliedItemsFromPendingBatch(item, pruneInput))
      .filter((item): item is PendingBlueprintVersionBatch => Boolean(item))
    if (nextHistoryItems.length) {
      historyBatchByWorkspaceKey.set(batch.workspaceKey, nextHistoryItems)
    } else {
      historyBatchByWorkspaceKey.delete(batch.workspaceKey)
    }
  }

  for (const message of Array.isArray(messageList) ? messageList : []) {
    const traceId = String(message.traceId || message.metadata?.traceId || '').trim() || null
    for (const block of getAllArtifactBlocks(message)) {
      if (block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint) {
        continue
      }

      if (block.phase === 'applied_saved') {
        registerAppliedBatch(block, message.createTime, traceId)
        continue
      }

      if (isBlueprintStagedPhase(block.phase) || block.phase === 'applied_draft') {
        const batch = buildPendingBlueprintVersionBatchFromBlock(block, message.createTime, traceId)
        if (batch) {
          registerPendingBatch(batch)
        }
      }
    }
  }

  const currentBlueprintBlock = currentBlueprint.blueprint
    ? {
      type: 'artifact',
      kind: 'blueprint',
      status: 'ready',
      phase: currentBlueprint.phase,
      revision: Number(currentBlueprint.revision || 0),
      stagedAt: currentBlueprint.stagedAt,
      title: currentBlueprint.blueprint.title,
      summary: currentBlueprint.blueprint.summary,
      confirmation: currentBlueprint.sourcePlanningContextKey
        ? {
          ...(((currentBlueprint.blueprint as any)?.confirmation || {}) as Record<string, unknown>),
          planningContextKey: currentBlueprint.sourcePlanningContextKey,
        }
        : (currentBlueprint.blueprint as any)?.confirmation,
      blueprint: currentBlueprint.blueprint,
      applyResult: currentBlueprint.applyResult,
      draftPersistenceState: currentBlueprint.draftPersistenceState || null,
    } as NocodeEditorAiArtifactBlock
    : null

  if (currentBlueprint.phase === 'applied_saved' && currentBlueprintBlock) {
    registerAppliedBatch(currentBlueprintBlock, currentBlueprint.stagedAt, null)
  } else if (currentBlueprint.phase === 'applied_draft' && currentBlueprintBlock) {
    const currentBatch = buildPendingBlueprintVersionBatchFromBlock(
      currentBlueprintBlock,
      currentBlueprint.stagedAt,
      null,
    )
    if (currentBatch) {
      registerPendingBatch(currentBatch)
    }
  } else {
    const currentBatch = buildPendingBlueprintVersionBatchFromCurrent(currentBlueprint)
    if (currentBatch) {
      registerPendingBatch(currentBatch)
    }
  }

  const currentItems = Array.from(latestBatchByWorkspaceKey.values())
    .sort(compareBatches)
    .flatMap(batch => [...batch.items].sort(compareItems))

  const historyItems = Array.from(historyBatchByWorkspaceKey.entries())
    .flatMap(([, batches]) => batches)
    .sort(compareBatches)
    .flatMap(batch => [...batch.items].sort(compareItems))

  return {
    currentItems,
    historyItems,
  }
}
