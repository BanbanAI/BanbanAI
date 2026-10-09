import { compareBlueprintPhase } from './nocodeEditorBlueprintLifecycle'

type NocodeEditorArtifactBlockLike = {
  type?: unknown
  kind?: unknown
  status?: unknown
  revision?: unknown
  stagedAt?: unknown
  phase?: unknown
  title?: unknown
  sourcePlanningContextKey?: unknown
  blueprint?: unknown
  applyResult?: {
    finishedAt?: unknown
  } | null
  confirmation?: unknown
  confirmationCardPresentation?: unknown
  applicationStructurePreview?: unknown
  appPlan?: unknown
  outline?: unknown
  formPlanPresentation?: unknown
  plan?: unknown
  draftPersistenceState?: unknown
  industrySkeletonContext?: unknown
  flowApplyResult?: {
    finishedAt?: unknown
  } | null
}

const ARTIFACT_STATUS_PRIORITY: Record<string, number> = {
  ready: 3,
  error: 2,
  loading: 1,
}

const toSafeNumber = (value: unknown) => {
  const normalized = Number(value || 0)
  return Number.isFinite(normalized) ? normalized : 0
}

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeBlueprintLineageToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')
  .replace(/[^\p{Letter}\p{Number}]/gu, '')

const getArtifactStatusPriority = (value: unknown) => {
  const key = normalizeText(value)
  return ARTIFACT_STATUS_PRIORITY[key] || 0
}

const isResolvedDraftPersistenceState = (value: unknown) => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && (value as Record<string, unknown>).resolved === true
)

const hasResolvedIssues = (value: unknown) => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && Array.isArray((value as Record<string, unknown>).resolvedIssues)
  && ((value as Record<string, unknown>).resolvedIssues as unknown[]).length > 0
)

const getBlueprintRecord = (block: NocodeEditorArtifactBlockLike) => (
  block && typeof block.blueprint === 'object' && !Array.isArray(block.blueprint)
    ? block.blueprint as Record<string, unknown>
    : null
)

const getRecord = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
)

const getBlueprintFormsRecord = (block: NocodeEditorArtifactBlockLike) => {
  const blueprint = getBlueprintRecord(block)
  const forms = Array.isArray(blueprint?.forms) ? blueprint.forms : []
  return forms.filter(item => item && typeof item === 'object') as Array<Record<string, any>>
}

const buildBlueprintFieldLineageSignature = (field: unknown): string => {
  const fieldRecord = getRecord(field) || {}
  const token = normalizeBlueprintLineageToken(fieldRecord.fieldKey || fieldRecord.key || fieldRecord.name)
  const children = Array.isArray(fieldRecord.children)
    ? fieldRecord.children
      .map(buildBlueprintFieldLineageSignature)
      .filter(Boolean)
      .sort()
    : []
  if (!token && !children.length) {
    return ''
  }
  return children.length ? `${token || 'field'}(${children.join('|')})` : token
}

const collectBlueprintFieldLineageTokens = (fields: unknown): string[] => {
  if (!Array.isArray(fields)) {
    return []
  }

  return fields
    .map(buildBlueprintFieldLineageSignature)
    .filter(Boolean)
}

export const getNocodeEditorBlueprintArtifactIdentityKey = (block: NocodeEditorArtifactBlockLike) => {
  const blueprint = getBlueprintRecord(block)
  const blueprintId = normalizeText(blueprint?.id)
  if (blueprintId) {
    return `id:${blueprintId}`
  }

  const title = normalizeText(block.title || blueprint?.title)
  return title ? `title:${title}` : ''
}

export const getNocodeEditorBlueprintArtifactVersionKey = (block: NocodeEditorArtifactBlockLike) => {
  const revision = toSafeNumber(block.revision)
  const stagedAt = toSafeNumber(block.stagedAt)
  if (revision > 0 || stagedAt > 0) {
    return `version:${revision}:${stagedAt}`
  }

  return ''
}

export const getNocodeEditorBlueprintArtifactPlanningContextKey = (
  block: NocodeEditorArtifactBlockLike,
) => {
  const confirmation = getRecord(block.confirmation)
  const blueprint = getBlueprintRecord(block)
  const blueprintConfirmation = getRecord(blueprint?.confirmation)
  return normalizeText(
    block.sourcePlanningContextKey
    || blueprint?.sourcePlanningContextKey
    || confirmation?.planningContextKey
    || blueprintConfirmation?.planningContextKey,
  )
}

export const getNocodeEditorBlueprintArtifactLineageKey = (
  block: NocodeEditorArtifactBlockLike,
) => {
  const forms = getBlueprintFormsRecord(block)
  if (!forms.length) {
    return ''
  }

  const formSignatures = forms
    .map((form) => {
      const formKey = normalizeBlueprintLineageToken(form.formKey)
      const groupName = normalizeBlueprintLineageToken(form.groupName)
      const tableName = normalizeBlueprintLineageToken(form.tableName || form.name)
      const fields = Array.isArray(form.fields)
        ? collectBlueprintFieldLineageTokens(form.fields).sort()
        : []
      return [
        formKey,
        groupName || 'nogroup',
        tableName || 'noname',
        fields.join('|'),
      ].join('::')
    })
    .sort()

  const duplicateCounts = new Map<string, number>()
  return formSignatures
    .map((signature) => {
      const nextCount = (duplicateCounts.get(signature) || 0) + 1
      duplicateCounts.set(signature, nextCount)
      return nextCount > 1 ? `${signature}#${nextCount}` : signature
    })
    .join('||')
}

export const getNocodeEditorBlueprintArtifactScopedIdentityKey = (
  block: NocodeEditorArtifactBlockLike,
) => {
  const identityKey = getNocodeEditorBlueprintArtifactIdentityKey(block)
  if (!identityKey) {
    return ''
  }

  const planningContextKey = getNocodeEditorBlueprintArtifactPlanningContextKey(block)
  const lineageKey = getNocodeEditorBlueprintArtifactLineageKey(block)
  return [
    identityKey,
    `planning:${planningContextKey || 'global'}`,
    `lineage:${lineageKey || 'global'}`,
  ].join(':')
}

export const isNocodeEditorArtifactBlock = (value: unknown): value is Record<string, any> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
  && normalizeText((value as Record<string, any>).type) === 'artifact'
  && Boolean(normalizeText((value as Record<string, any>).kind))
)

export const getNocodeEditorArtifactBlockMergeKey = (block: unknown) => {
  if (!isNocodeEditorArtifactBlock(block)) {
    return ''
  }

  const kind = normalizeText((block as Record<string, unknown>).kind)
  if (kind === 'blueprint') {
    const identityKey = getNocodeEditorBlueprintArtifactScopedIdentityKey(block as NocodeEditorArtifactBlockLike)
    const versionKey = getNocodeEditorBlueprintArtifactVersionKey(block as NocodeEditorArtifactBlockLike)
    if (identityKey && versionKey) {
      return `artifact:blueprint:${identityKey}:${versionKey}`
    }
    return identityKey ? `artifact:blueprint:${identityKey}` : ''
  }

  return kind ? `artifact:${kind}` : ''
}

export const findNocodeEditorArtifactBlockMergeIndex = (
  blocks: Array<Record<string, any>>,
  block: Record<string, any>,
) => {
  if (!isNocodeEditorArtifactBlock(block)) {
    return -1
  }

  const blockKind = normalizeText(block.kind)
  const blockMergeKey = getNocodeEditorArtifactBlockMergeKey(block)
  if (blockKind === 'blueprint' && blockMergeKey) {
    const exactIndex = blocks.findIndex(item => (
      isNocodeEditorArtifactBlock(item)
      && getNocodeEditorArtifactBlockMergeKey(item) === blockMergeKey
    ))
    if (exactIndex >= 0) {
      return exactIndex
    }

    return blocks.findIndex(item => (
      isNocodeEditorArtifactBlock(item)
      && normalizeText(item.kind) === blockKind
      && !getNocodeEditorArtifactBlockMergeKey(item)
    ))
  }

  return blocks.findIndex(item => (
    isNocodeEditorArtifactBlock(item)
    && normalizeText(item.kind) === blockKind
  ))
}

const getArtifactFinishedAt = (block: NocodeEditorArtifactBlockLike) => (
  toSafeNumber(block.flowApplyResult?.finishedAt ?? block.applyResult?.finishedAt)
)

const compareArtifactBlocks = (
  left: NocodeEditorArtifactBlockLike,
  right: NocodeEditorArtifactBlockLike,
) => {
  const leftRevision = toSafeNumber(left.revision)
  const rightRevision = toSafeNumber(right.revision)
  if (leftRevision !== rightRevision) {
    return leftRevision - rightRevision
  }

  const leftStagedAt = toSafeNumber(left.stagedAt)
  const rightStagedAt = toSafeNumber(right.stagedAt)
  if (leftStagedAt !== rightStagedAt) {
    return leftStagedAt - rightStagedAt
  }

  if (normalizeText(left.kind) === 'blueprint' && normalizeText(right.kind) === 'blueprint') {
    const phaseComparison = compareBlueprintPhase(left.phase, right.phase)
    if (phaseComparison !== 0) {
      return phaseComparison
    }

    const leftResolved = isResolvedDraftPersistenceState(left.draftPersistenceState)
    const rightResolved = isResolvedDraftPersistenceState(right.draftPersistenceState)
    if (leftResolved !== rightResolved) {
      return leftResolved ? 1 : -1
    }
  }

  const leftFinishedAt = getArtifactFinishedAt(left)
  const rightFinishedAt = getArtifactFinishedAt(right)
  if (leftFinishedAt !== rightFinishedAt) {
    return leftFinishedAt - rightFinishedAt
  }

  return getArtifactStatusPriority(left.status) - getArtifactStatusPriority(right.status)
}

export const compareNocodeEditorArtifactBlocks = compareArtifactBlocks

const isMissingArtifactFieldValue = (value: unknown) => (
  value === undefined
  || value === null
  || value === ''
)

const isNonEmptyValue = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return false
  }
  if (Array.isArray(value)) {
    return value.length > 0
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length > 0
  }
  return true
}

const mergeDraftPersistenceState = (preferred: unknown, fallback: unknown) => {
  if (!isNonEmptyValue(preferred)) {
    return fallback
  }
  if (!isNonEmptyValue(fallback)) {
    return preferred
  }
  if (
    isResolvedDraftPersistenceState(fallback)
    && !isResolvedDraftPersistenceState(preferred)
  ) {
    return fallback
  }
  if (!isResolvedDraftPersistenceState(preferred)) {
    return preferred
  }

  return {
    ...(fallback as Record<string, unknown>),
    ...(preferred as Record<string, unknown>),
    actionIssues: [],
    resolvedIssues: hasResolvedIssues(preferred)
      ? (preferred as Record<string, unknown>).resolvedIssues
      : (fallback as Record<string, unknown>).resolvedIssues,
  }
}

const mergeArtifactDetail = <T extends Record<string, any>>(preferred: T, fallback: T): T => ({
  ...fallback,
  ...preferred,
  title: normalizeText(preferred.title) || normalizeText(fallback.title) || undefined,
  summary: normalizeText(preferred.summary) || normalizeText(fallback.summary) || undefined,
  sourcePlanningContextKey: isNonEmptyValue(preferred.sourcePlanningContextKey)
    ? preferred.sourcePlanningContextKey
    : fallback.sourcePlanningContextKey,
  confirmation: isNonEmptyValue(preferred.confirmation) ? preferred.confirmation : fallback.confirmation,
  confirmationCardPresentation: isNonEmptyValue(preferred.confirmationCardPresentation)
    ? preferred.confirmationCardPresentation
    : fallback.confirmationCardPresentation,
  applicationStructurePreview: isNonEmptyValue(preferred.applicationStructurePreview)
    ? preferred.applicationStructurePreview
    : fallback.applicationStructurePreview,
  industrySkeletonContext: isNonEmptyValue(preferred.industrySkeletonContext)
    ? preferred.industrySkeletonContext
    : fallback.industrySkeletonContext,
  appPlan: isNonEmptyValue(preferred.appPlan) ? preferred.appPlan : fallback.appPlan,
  outline: isNonEmptyValue(preferred.outline) ? preferred.outline : fallback.outline,
  formPlanPresentation: isNonEmptyValue(preferred.formPlanPresentation)
    ? preferred.formPlanPresentation
    : fallback.formPlanPresentation,
  plan: isNonEmptyValue(preferred.plan) ? preferred.plan : fallback.plan,
  blueprint: isNonEmptyValue(preferred.blueprint) ? preferred.blueprint : fallback.blueprint,
  applyResult: isNonEmptyValue(preferred.applyResult) ? preferred.applyResult : fallback.applyResult,
  flowApplyResult: isNonEmptyValue(preferred.flowApplyResult) ? preferred.flowApplyResult : fallback.flowApplyResult,
  draftPersistenceState: mergeDraftPersistenceState(
    preferred.draftPersistenceState,
    fallback.draftPersistenceState,
  ),
}) as T

export const mergeNocodeEditorArtifactBlocks = <T extends Record<string, any>>(
  left?: T,
  right?: T,
) => {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }

  const preferred = compareArtifactBlocks(left, right) > 0 ? left : right
  const fallback = preferred === left ? right : left
  const merged = mergeArtifactDetail(preferred, fallback)

  for (const [key, value] of Object.entries(fallback)) {
    if (!isMissingArtifactFieldValue(value) && isMissingArtifactFieldValue(merged[key])) {
      merged[key as keyof T] = value as T[keyof T]
    }
  }

  return merged
}

export type NocodeEditorArtifactBlockSelection<T extends Record<string, any>> = {
  key: string
  block: T
  source: T
}

export const normalizeNocodeEditorArtifactBlockSelections = <T extends Record<string, any>>(blocks: T[]) => {
  const latestByKey = new Map<string, NocodeEditorArtifactBlockSelection<T>>()
  const versionedBlueprintIdentityKeys = new Set<string>()
  let legacyBlueprintIndex = 0

  for (const block of Array.isArray(blocks) ? blocks : []) {
    if (!isNocodeEditorArtifactBlock(block)) {
      continue
    }

    const kind = normalizeText(block.kind)
    const blueprintIdentityKey = kind === 'blueprint'
      ? getNocodeEditorBlueprintArtifactScopedIdentityKey(block)
      : ''
    const blueprintVersionKey = kind === 'blueprint'
      ? getNocodeEditorBlueprintArtifactVersionKey(block)
      : ''
    const mergeKey = kind === 'blueprint'
      ? (
        blueprintIdentityKey && blueprintVersionKey
          ? `artifact:blueprint:${blueprintIdentityKey}:${blueprintVersionKey}`
          : (blueprintIdentityKey ? `artifact:blueprint:${blueprintIdentityKey}` : '')
      )
      : (kind ? `artifact:${kind}` : '')
    const key = mergeKey || (
      kind === 'blueprint'
        ? `legacy-blueprint:${legacyBlueprintIndex++}`
        : kind
    )
    const previous = latestByKey.get(key)
    if (!previous) {
      latestByKey.set(key, {
        key,
        block,
        source: block,
      })
    } else if (compareArtifactBlocks(block, previous.block) >= 0) {
      latestByKey.set(key, {
        key,
        block: mergeArtifactDetail(block, previous.block),
        source: block,
      })
    } else {
      latestByKey.set(key, {
        key,
        block: mergeArtifactDetail(previous.block, block),
        source: previous.source,
      })
    }

    if (kind === 'blueprint') {
      if (blueprintIdentityKey && blueprintVersionKey) {
        versionedBlueprintIdentityKeys.add(blueprintIdentityKey)
      }
    }
  }

  for (const identityKey of versionedBlueprintIdentityKeys) {
    latestByKey.delete(`artifact:blueprint:${identityKey}`)
  }

  return Array.from(latestByKey.values())
}

export const normalizeNocodeEditorArtifactBlocks = <T extends Record<string, any>>(blocks: T[]) => (
  normalizeNocodeEditorArtifactBlockSelections(blocks).map(item => item.block)
)
