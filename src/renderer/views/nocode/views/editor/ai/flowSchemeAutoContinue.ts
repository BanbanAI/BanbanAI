import {
  type NocodeEditorFlowSchemePlanningStatus,
  normalizeNocodeEditorFlowScheme,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  normalizeFlowIssueRoutingResult,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import {
  resolveAiArtifactPendingQuestionCount,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import type { NocodeEditorAiArtifactBlock } from './types'

export const FLOW_BLUEPRINT_AUTO_CONTINUE_MESSAGE = '请继续基于当前已确认的流程方案生成流程蓝图，不需要再停留在流程方案确认阶段。'

const normalizeFlowSchemePlanningStatus = (value: unknown): NocodeEditorFlowSchemePlanningStatus | '' => {
  const normalized = String(value || '').trim()
  return normalized === 'needs_confirmation' || normalized === 'ready_for_review'
    ? normalized
    : ''
}

const resolveFlowIssueRoutingFromBlock = (
  block?: NocodeEditorAiArtifactBlock | null,
) => normalizeFlowIssueRoutingResult((block as any)?.flowIssueRouting)

export const resolveFlowSchemePlanningStatusForAutoContinue = (
  block?: NocodeEditorAiArtifactBlock | null,
): NocodeEditorFlowSchemePlanningStatus | '' => {
  if (!block || block.kind !== 'flow-scheme' || block.status !== 'ready') {
    return ''
  }

  const flowIssueRouting = resolveFlowIssueRoutingFromBlock(block)
  if (flowIssueRouting) {
    return flowIssueRouting.outcome === 'return_to_flow_scheme'
      ? 'needs_confirmation'
      : 'ready_for_review'
  }

  const explicitPlanningStatus = normalizeFlowSchemePlanningStatus((block as any).planningStatus)
  if (explicitPlanningStatus) {
    return explicitPlanningStatus
  }

  const pendingQuestionCount = resolveAiArtifactPendingQuestionCount(block)
  const scheme = normalizeNocodeEditorFlowScheme(block.scheme)
  if (!scheme) {
    return pendingQuestionCount <= 0 ? 'ready_for_review' : ''
  }

  if (
    pendingQuestionCount <= 0
    && scheme.openQuestions.length <= 0
  ) {
    return 'ready_for_review'
  }

  if (
    scheme.convergence?.businessStatus === 'pending'
    || scheme.convergence?.dependencyStatus === 'pending'
    || scheme.openQuestions.length > 0
  ) {
    return 'needs_confirmation'
  }

  return 'ready_for_review'
}

export const shouldAutoContinueFlowBlueprintFromScheme = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!block || block.kind !== 'flow-scheme' || block.status !== 'ready') {
    return false
  }

  const flowIssueRouting = resolveFlowIssueRoutingFromBlock(block)
  if (flowIssueRouting) {
    return flowIssueRouting.outcome === 'auto_continue'
  }

  if (resolveAiArtifactPendingQuestionCount(block) > 0) {
    return false
  }

  return resolveFlowSchemePlanningStatusForAutoContinue(block) === 'ready_for_review'
}
