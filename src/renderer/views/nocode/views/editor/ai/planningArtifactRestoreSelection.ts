import type { AiAssistantArtifactBlock } from '@common/types/ai'

type RestorableArtifactBlock = AiAssistantArtifactBlock & {
  revision?: number
  stagedAt?: number
}

export type PlanningRestoreCandidate = {
  block: AiAssistantArtifactBlock | null | undefined
  index: number
}

export type PreferredPlanningRestoreCandidate = {
  block: RestorableArtifactBlock
  index: number
  source: 'explicit' | 'merged'
}

type PlanningRestoreSelectionInput = {
  explicit?: PlanningRestoreCandidate | null
  merged?: PlanningRestoreCandidate | null
}

const normalizePositiveNumber = (value: unknown) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0
}

const compareCandidateRecency = (
  left: PreferredPlanningRestoreCandidate,
  right: PreferredPlanningRestoreCandidate,
) => {
  const leftStagedAt = normalizePositiveNumber(left.block?.stagedAt)
  const rightStagedAt = normalizePositiveNumber(right.block?.stagedAt)
  if (leftStagedAt > 0 && rightStagedAt > 0 && leftStagedAt !== rightStagedAt) {
    return leftStagedAt - rightStagedAt
  }

  const leftRevision = normalizePositiveNumber(left.block?.revision)
  const rightRevision = normalizePositiveNumber(right.block?.revision)
  if (leftRevision > 0 && rightRevision > 0 && leftRevision !== rightRevision) {
    return leftRevision - rightRevision
  }

  if (leftStagedAt !== rightStagedAt) {
    return leftStagedAt - rightStagedAt
  }

  if (leftRevision !== rightRevision) {
    return leftRevision - rightRevision
  }

  if (left.index !== right.index) {
    return left.index - right.index
  }

  return left.source === 'explicit' ? 1 : -1
}

export const pickPreferredPlanningRestoreCandidate = (
  input: PlanningRestoreSelectionInput,
): PreferredPlanningRestoreCandidate | null => {
  const candidates = [
    input.explicit?.block
      ? {
        block: input.explicit.block as RestorableArtifactBlock,
        index: input.explicit.index,
        source: 'explicit' as const,
      }
      : null,
    input.merged?.block
      ? {
        block: input.merged.block as RestorableArtifactBlock,
        index: input.merged.index,
        source: 'merged' as const,
      }
      : null,
  ].filter((item): item is PreferredPlanningRestoreCandidate => Boolean(item))

  if (!candidates.length) {
    return null
  }

  let preferred = candidates[0]
  for (const candidate of candidates.slice(1)) {
    if (compareCandidateRecency(candidate, preferred) > 0) {
      preferred = candidate
    }
  }

  return preferred
}
