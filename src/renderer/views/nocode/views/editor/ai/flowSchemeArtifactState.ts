import {
  buildLogicalPlanningConfirmationContextKey,
  isSamePlanningConfirmationContext,
} from '@common/utils/nocodeEditorPlanningConfirmationIdentity'

export type FlowSchemeArtifactLike = {
  kind?: string | null
  status?: string | null
  title?: string | null
  summary?: string | null
  version?: string | null
  revision?: number | null
  stagedAt?: number | null
  scheme?: {
    id?: string | null
    title?: string | null
    revision?: number | null
    target?: {
      formId?: string | null
      formName?: string | null
    } | null
    mainPath?: unknown[] | null
    branches?: unknown[] | null
    openQuestions?: unknown[] | null
  } | null
  confirmation?: {
    status?: string | null
    planningContextKey?: string | null
    requiredNextAction?: string | null
    blockedNextAction?: string | null
    questions?: Array<{
      id?: string | null
      title?: string | null
    } | null> | null
  } | null
  flowPlan?: {
    id?: string | null
    title?: string | null
    target?: {
      formId?: string | null
      formName?: string | null
    } | null
    confirmation?: {
      planningContextKey?: string | null
    } | null
  } | null
}

export type FlowPlanApplyContextInput = {
  flowPlan?: FlowSchemeArtifactLike['flowPlan']
  flowPlanPlanningContextKey?: string | null
  sourceSchemeRevision?: number | null
  flowScheme?: FlowSchemeArtifactLike['scheme'] & {
    confirmation?: {
      planningContextKey?: string | null
    } | null
  }
  flowSchemePlanningContextKey?: string | null
  flowSchemeRevision?: number | null
}

export type FlowSchemeArtifactSyncDecision = {
  shouldSync: boolean
  reason:
    | 'current_flow_scheme_artifact'
    | 'stale_flow_scheme_artifact'
    | 'non_pending_flow_scheme_artifact'
}

const normalizePositiveNumber = (value: unknown) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0
    ? normalized
    : 0
}

const normalizePlanningContextKey = (value?: string | null) => {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return ''
  }

  const parts = normalized.split(':')
  if (parts.length < 4) {
    return normalized
  }

  const revision = normalizePositiveNumber(parts[parts.length - 2])
  const stagedAt = normalizePositiveNumber(parts[parts.length - 1])
  if (!revision || !stagedAt) {
    return normalized
  }

  return parts.slice(0, -2).join(':') || normalized
}

const parsePlanningContextScope = (value?: string | null) => {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return {
      outlineId: '',
      primaryFormKey: '',
    }
  }

  const parts = normalized.split(':')
  if (parts[0] === 'logical') {
    return {
      outlineId: parts[2] || '',
      primaryFormKey: parts.slice(3).join(':') || '',
    }
  }

  return {
    outlineId: parts[1] || '',
    primaryFormKey: parts[2] || '',
  }
}

const isPendingFlowSchemeArtifact = (
  block?: FlowSchemeArtifactLike | null,
) => (
  block?.kind === 'flow-scheme'
  && block.status === 'ready'
  && block.confirmation?.status === 'pending'
)

const resolveFlowSchemeComparablePlanningContextKey = (
  block?: FlowSchemeArtifactLike | null,
) => {
  const explicitPlanningContextKey = String(block?.confirmation?.planningContextKey || '').trim()
  if (explicitPlanningContextKey) {
    return explicitPlanningContextKey
  }
  if (block?.kind !== 'flow-scheme') {
    return ''
  }

  const outlineId = String(
    block?.scheme?.id
    || block?.scheme?.title
    || block?.title
    || '',
  ).trim()
  const primaryFormKey = String(
    block?.scheme?.target?.formId
    || block?.scheme?.target?.formName
    || '',
  ).trim()
  if (!outlineId || !primaryFormKey) {
    return ''
  }

  return buildLogicalPlanningConfirmationContextKey({
    stage: 'flow-scheme',
    outlineId,
    primaryFormKey,
  })
}

const resolveFlowArtifactComparableScopeKey = (
  block?: FlowSchemeArtifactLike | null,
) => {
  const parsedScope = parsePlanningContextScope(block?.confirmation?.planningContextKey)
  const outlineId = String(
    parsedScope.outlineId
    || block?.scheme?.id
    || block?.scheme?.title
    || block?.flowPlan?.id
    || block?.flowPlan?.title
    || block?.title
    || '',
  ).trim()
  const primaryFormKey = String(
    parsedScope.primaryFormKey
    || block?.scheme?.target?.formId
    || block?.scheme?.target?.formName
    || block?.flowPlan?.target?.formId
    || block?.flowPlan?.target?.formName
    || '',
  ).trim()
  if (!outlineId || !primaryFormKey) {
    return ''
  }

  return `${outlineId}::${primaryFormKey}`
}

export const requiresFlowSchemeForFlowPlan = (
  input: FlowPlanApplyContextInput,
) => Boolean(
  input.flowPlan
  && (
    normalizePositiveNumber(input.sourceSchemeRevision)
    || String(
      input.flowPlanPlanningContextKey
      || input.flowPlan.confirmation?.planningContextKey
      || '',
    ).trim()
  ),
)

export const isFlowPlanApplyContextReady = (
  input: FlowPlanApplyContextInput,
) => {
  if (!input.flowPlan) {
    return false
  }

  if (!input.flowScheme) {
    return !requiresFlowSchemeForFlowPlan(input)
  }

  const sourceSchemeRevision = normalizePositiveNumber(input.sourceSchemeRevision)
  const flowSchemeRevision = normalizePositiveNumber(input.flowSchemeRevision)
  if (
    sourceSchemeRevision
    && sourceSchemeRevision !== flowSchemeRevision
  ) {
    return false
  }

  const flowPlanTargetId = String(input.flowPlan.target?.formId || '').trim()
  const flowSchemeTargetId = String(input.flowScheme.target?.formId || '').trim()
  const flowPlanTargetName = String(input.flowPlan.target?.formName || '').replace(/\s+/g, '').toLowerCase()
  const flowSchemeTargetName = String(input.flowScheme.target?.formName || '').replace(/\s+/g, '').toLowerCase()
  if (
    (flowPlanTargetId && flowSchemeTargetId && flowPlanTargetId !== flowSchemeTargetId)
    || (
      !flowPlanTargetId
      && !flowSchemeTargetId
      && flowPlanTargetName
      && flowSchemeTargetName
      && flowPlanTargetName !== flowSchemeTargetName
    )
  ) {
    return false
  }

  const flowPlanPlanningContextKey = String(
    input.flowPlanPlanningContextKey
    || input.flowPlan.confirmation?.planningContextKey
    || '',
  ).trim()
  const flowSchemePlanningContextKey = String(
    input.flowSchemePlanningContextKey
    || input.flowScheme.confirmation?.planningContextKey
    || '',
  ).trim()

  const flowPlanBlock: FlowSchemeArtifactLike = {
    kind: 'flow-plan',
    confirmation: {
      planningContextKey: flowPlanPlanningContextKey,
    },
    flowPlan: input.flowPlan,
  }
  const flowSchemeBlock: FlowSchemeArtifactLike = {
    kind: 'flow-scheme',
    confirmation: {
      planningContextKey: flowSchemePlanningContextKey,
    },
    scheme: input.flowScheme,
  }
  const flowPlanScopeKey = resolveFlowArtifactComparableScopeKey(flowPlanBlock)
  const flowSchemeScopeKey = resolveFlowArtifactComparableScopeKey(flowSchemeBlock)

  if (flowPlanPlanningContextKey && flowSchemePlanningContextKey) {
    return Boolean(
      flowPlanScopeKey
      && flowSchemeScopeKey
      && flowPlanScopeKey === flowSchemeScopeKey,
    )
  }

  if (sourceSchemeRevision) {
    return true
  }

  return Boolean(
    flowPlanScopeKey
    && flowSchemeScopeKey
    && flowPlanScopeKey === flowSchemeScopeKey,
  )
}

const isReadyFlowPlanArtifact = (
  block?: FlowSchemeArtifactLike | null,
) => (
  block?.kind === 'flow-plan'
  && block.status === 'ready'
)

const isLowContextPlaceholderFlowSchemeArtifact = (
  block?: FlowSchemeArtifactLike | null,
) => {
  if (!isPendingFlowSchemeArtifact(block)) {
    return false
  }

  const normalizedTitle = String(
    block?.scheme?.title
    || block?.title
    || '',
  ).trim()
  const explicitTargetFormKey = String(
    block?.scheme?.target?.formId
    || block?.scheme?.target?.formName
    || '',
  ).trim()
  const explicitSchemeId = String(block?.scheme?.id || '').trim()
  const parsedScope = parsePlanningContextScope(block?.confirmation?.planningContextKey)

  return (
    !explicitTargetFormKey
    && !explicitSchemeId
    && !parsedScope.primaryFormKey
    && (!normalizedTitle || normalizedTitle === '流程方案')
  )
}

export const isLegacyFlowSchemeGuardPlaceholderArtifact = (
  block?: FlowSchemeArtifactLike | null,
) => {
  if (!isPendingFlowSchemeArtifact(block)) {
    return false
  }
  if (
    String(block?.version || '').trim()
    || normalizePositiveNumber(block?.revision)
    || normalizePositiveNumber(block?.scheme?.revision)
    || String(block?.confirmation?.planningContextKey || '').trim()
    || (Array.isArray(block?.confirmation?.questions) && block.confirmation.questions.length > 0)
    || (Array.isArray(block?.scheme?.openQuestions) && block.scheme.openQuestions.length > 0)
  ) {
    return false
  }

  return (
    String(block?.confirmation?.requiredNextAction || '').trim() === 'editor_plan_flow_scheme'
    && String(block?.confirmation?.blockedNextAction || '').trim() === 'editor_stage_flow_blueprint'
    && !String(block?.scheme?.id || '').trim()
    && !String(block?.scheme?.target?.formId || block?.scheme?.target?.formName || '').trim()
    && Array.isArray(block?.scheme?.mainPath)
    && block.scheme?.mainPath?.length === 0
    && Array.isArray(block?.scheme?.branches)
    && block.scheme?.branches?.length === 0
  )
}

export const isSameFlowSchemePlanningContext = (
  left?: string | null,
  right?: string | null,
) => isSamePlanningConfirmationContext(
  normalizePlanningContextKey(left),
  normalizePlanningContextKey(right),
)

const resolveFlowSchemeArtifactRank = (
  block?: FlowSchemeArtifactLike | null,
) => {
  const planningContextKey = String(block?.confirmation?.planningContextKey || '').trim()
  const parts = planningContextKey.split(':')

  return {
    stagedAt: normalizePositiveNumber(block?.stagedAt) || normalizePositiveNumber(parts[parts.length - 1]),
    revision: normalizePositiveNumber(block?.revision) || normalizePositiveNumber(block?.scheme?.revision) || normalizePositiveNumber(parts[parts.length - 2]),
  }
}

const isHigherPriorityFlowSchemeArtifact = (
  candidate: FlowSchemeArtifactLike,
  current: FlowSchemeArtifactLike,
) => {
  const candidateRank = resolveFlowSchemeArtifactRank(candidate)
  const currentRank = resolveFlowSchemeArtifactRank(current)

  if (candidateRank.stagedAt !== currentRank.stagedAt) {
    return candidateRank.stagedAt > currentRank.stagedAt
  }

  return candidateRank.revision > currentRank.revision
}

const resolveFlowSchemeArtifactIdentityKey = (
  block?: FlowSchemeArtifactLike | null,
) => {
  if (block?.kind !== 'flow-scheme') {
    return ''
  }

  const questionIdentity = Array.isArray(block?.confirmation?.questions)
    ? block.confirmation.questions
      .map(question => `${String(question?.id || '').trim()}::${String(question?.title || '').trim()}`)
      .filter(Boolean)
      .join('|')
    : ''

  return [
    String(block.kind || '').trim(),
    String(block.status || '').trim(),
    String(block.title || '').trim(),
    String(block.summary || '').trim(),
    String(block.confirmation?.status || '').trim(),
    String(block.confirmation?.requiredNextAction || '').trim(),
    String(block.confirmation?.blockedNextAction || '').trim(),
    resolveFlowSchemeComparablePlanningContextKey(block),
    String(block.scheme?.title || '').trim(),
    String(block.scheme?.target?.formId || '').trim(),
    String(block.scheme?.target?.formName || '').trim(),
    String(Array.isArray(block.scheme?.mainPath) ? block.scheme?.mainPath.length : ''),
    String(Array.isArray(block.scheme?.branches) ? block.scheme?.branches.length : ''),
    questionIdentity,
  ].join('||')
}

const findLastFlowSchemeArtifactIndex = (
  blocks?: Array<FlowSchemeArtifactLike | null | undefined> | null,
) => {
  for (let index = (blocks || []).length - 1; index >= 0; index -= 1) {
    if (blocks?.[index]?.kind === 'flow-scheme') {
      return index
    }
  }
  return -1
}

const findFlowSchemeArtifactIndexByReference = (input: {
  block?: FlowSchemeArtifactLike | null
  blocks?: Array<FlowSchemeArtifactLike | null | undefined> | null
}) => {
  for (let index = (input.blocks || []).length - 1; index >= 0; index -= 1) {
    if (input.blocks?.[index] === input.block) {
      return index
    }
  }

  const identityKey = resolveFlowSchemeArtifactIdentityKey(input.block)
  if (!identityKey) {
    return -1
  }

  for (let index = 0; index < (input.blocks || []).length; index += 1) {
    if (resolveFlowSchemeArtifactIdentityKey(input.blocks?.[index]) === identityKey) {
      return index
    }
  }

  return -1
}

const findCanonicalPendingFlowSchemeArtifactIndex = (input: {
  block?: FlowSchemeArtifactLike | null
  blocks?: Array<FlowSchemeArtifactLike | null | undefined> | null
}) => {
  const currentBlock = input.block
  if (!isPendingFlowSchemeArtifact(currentBlock)) {
    return -1
  }

  let canonicalIndex = -1
  for (let index = 0; index < (input.blocks || []).length; index += 1) {
    const candidate = input.blocks?.[index]
    if (
      !isPendingFlowSchemeArtifact(candidate)
      || !isSameFlowSchemePlanningContext(
        resolveFlowSchemeComparablePlanningContextKey(candidate),
        resolveFlowSchemeComparablePlanningContextKey(currentBlock),
      )
    ) {
      continue
    }

    if (canonicalIndex < 0) {
      canonicalIndex = index
      continue
    }

    const canonicalBlock = input.blocks?.[canonicalIndex]
    if (
      canonicalBlock
      && (
        isHigherPriorityFlowSchemeArtifact(candidate, canonicalBlock)
        || (
          !isHigherPriorityFlowSchemeArtifact(canonicalBlock, candidate)
          && !isHigherPriorityFlowSchemeArtifact(candidate, canonicalBlock)
        )
      )
    ) {
      canonicalIndex = index
    }
  }

  return canonicalIndex
}

const hasReadyFlowPlanSuccessor = (input: {
  block?: FlowSchemeArtifactLike | null
  blocks?: Array<FlowSchemeArtifactLike | null | undefined> | null
}) => {
  const currentBlock = input.block
  if (!isPendingFlowSchemeArtifact(currentBlock)) {
    return false
  }

  const currentBlockIndex = findFlowSchemeArtifactIndexByReference(input)
  if (currentBlockIndex < 0) {
    return false
  }

  const laterReadyFlowPlanCandidates = (input.blocks || []).slice(currentBlockIndex + 1)
    .filter((candidate): candidate is FlowSchemeArtifactLike => isReadyFlowPlanArtifact(candidate))
  if (!laterReadyFlowPlanCandidates.length) {
    return false
  }

  if (isLowContextPlaceholderFlowSchemeArtifact(currentBlock)) {
    return true
  }

  const currentComparablePlanningContextKey = resolveFlowSchemeComparablePlanningContextKey(currentBlock)
  const currentComparableScopeKey = resolveFlowArtifactComparableScopeKey(currentBlock)
  if (!currentComparablePlanningContextKey && !currentComparableScopeKey) {
    return false
  }

  for (const candidate of laterReadyFlowPlanCandidates) {
    const candidateComparablePlanningContextKey = normalizePlanningContextKey(candidate?.confirmation?.planningContextKey)
    const candidateComparableScopeKey = resolveFlowArtifactComparableScopeKey(candidate)

    if (
      (
        currentComparablePlanningContextKey
        && candidateComparablePlanningContextKey
        && isSameFlowSchemePlanningContext(
          currentComparablePlanningContextKey,
          candidateComparablePlanningContextKey,
        )
      )
      || (
        currentComparableScopeKey
        && candidateComparableScopeKey
        && currentComparableScopeKey === candidateComparableScopeKey
      )
    ) {
      return true
    }
  }

  return false
}

export const findFlowSchemeArtifactIndexForPlanningContext = (input: {
  blocks?: Array<FlowSchemeArtifactLike | null | undefined> | null
  planningContextKey?: string | null
}) => {
  if (String(input.planningContextKey || '').trim()) {
    for (let index = (input.blocks || []).length - 1; index >= 0; index -= 1) {
      const candidate = input.blocks?.[index]
      if (
        candidate?.kind === 'flow-scheme'
        && isSameFlowSchemePlanningContext(
          candidate.confirmation?.planningContextKey,
          input.planningContextKey,
        )
      ) {
        return index
      }
    }
  }

  return findLastFlowSchemeArtifactIndex(input.blocks)
}

export const resolveFlowSchemeArtifactSyncDecision = (input: {
  block?: FlowSchemeArtifactLike | null
  blocks?: Array<FlowSchemeArtifactLike | null | undefined> | null
}): FlowSchemeArtifactSyncDecision => {
  const currentBlock = input.block
  if (!isPendingFlowSchemeArtifact(currentBlock)) {
    return {
      shouldSync: true,
      reason: 'non_pending_flow_scheme_artifact',
    }
  }

  const currentBlockIndex = findFlowSchemeArtifactIndexByReference(input)
  const canonicalIndex = findCanonicalPendingFlowSchemeArtifactIndex(input)
  const lastFlowSchemeArtifactIndex = findLastFlowSchemeArtifactIndex(input.blocks)

  if (
    isLegacyFlowSchemeGuardPlaceholderArtifact(currentBlock)
    && currentBlockIndex >= 0
    && lastFlowSchemeArtifactIndex >= 0
    && currentBlockIndex !== lastFlowSchemeArtifactIndex
  ) {
    return {
      shouldSync: false,
      reason: 'stale_flow_scheme_artifact',
    }
  }

  if (hasReadyFlowPlanSuccessor(input)) {
    return {
      shouldSync: false,
      reason: 'stale_flow_scheme_artifact',
    }
  }

  return currentBlockIndex >= 0 && canonicalIndex >= 0 && currentBlockIndex !== canonicalIndex
    ? {
      shouldSync: false,
      reason: 'stale_flow_scheme_artifact',
    }
    : {
      shouldSync: true,
      reason: 'current_flow_scheme_artifact',
    }
}
