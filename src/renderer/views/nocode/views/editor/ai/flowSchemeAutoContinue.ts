import {
  type NocodeEditorFlowSchemePlanningStatus,
  normalizeNocodeEditorFlowScheme,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  isSamePlanningConfirmationContext,
} from '@common/utils/nocodeEditorPlanningConfirmationIdentity'
import {
  normalizeFlowIssueRoutingResult,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import {
  resolveAiArtifactPendingQuestionCount,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import type { NocodeEditorAiArtifactBlock } from './types'

export const FLOW_BLUEPRINT_AUTO_CONTINUE_MESSAGE = '请继续基于当前已确认的流程方案生成流程蓝图，不需要再停留在流程方案确认阶段。'

// 蓝图阶段连续同一原因失败时停止自动续跑，避免「自动续跑 → 同样被拒」的死循环。
export const FLOW_BLUEPRINT_AUTO_CONTINUE_MAX_SAME_CAUSE_FAILURES = 3

export type FlowBlueprintStageFailureStateLike = {
  planningContextKey?: string
  code?: string
  count?: number
} | null | undefined

export const shouldSuppressFlowBlueprintAutoContinueForRepeatedFailure = (input: {
  failureState?: FlowBlueprintStageFailureStateLike
  planningContextKey?: string
}) => {
  const failureState = input.failureState
  if (!failureState?.code) {
    return false
  }
  if (Number(failureState.count || 0) < FLOW_BLUEPRINT_AUTO_CONTINUE_MAX_SAME_CAUSE_FAILURES) {
    return false
  }
  const failurePlanningContextKey = String(failureState.planningContextKey || '').trim()
  const candidatePlanningContextKey = String(input.planningContextKey || '').trim()
  if (!failurePlanningContextKey || !candidatePlanningContextKey) {
    return true
  }
  return isSamePlanningConfirmationContext(
    failurePlanningContextKey,
    candidatePlanningContextKey,
  )
}

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

// system_error 是模型内部自纠类问题（如重暂存时选项取值与已确认结论漂移），不需要用户处理：
// 宿主已把这类暂存方案的确认题收尾（清空或标记完成）。这种中途态重暂存不应再渲染成「流程方案已暂存」卡片，
// 否则用户会看到一张既无待确认题、又声称方案与已确认结论冲突、且无法操作的方案卡。
export const shouldHideNonUserActionableFlowSchemeSystemError = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!block || block.kind !== 'flow-scheme' || block.status !== 'ready') {
    return false
  }

  const flowIssueRouting = resolveFlowIssueRoutingFromBlock(block)
  if (!flowIssueRouting || flowIssueRouting.outcome !== 'system_error') {
    return false
  }

  if (resolveAiArtifactPendingQuestionCount(block) > 0) {
    return false
  }

  return flowIssueRouting.activeIssues.every(issue => issue.userActionRequired !== true)
}
