import { Injectable } from '@nestjs/common'
import { unique } from '@common/utils/unique'
import { AiNocodeEditorConversationEntity } from '../entities'
import { AiAgentLogService } from '../logging/agent-log.service'
import { AiOpenAiService } from '../openai/ai-openai.service'
import { AiAttachmentService } from '../thread/ai-attachment.service'
import {
  AI_READ_ATTACHMENT_TOOL_NAME,
  type AiAttachmentReadBudget,
  collectAiAttachmentReferences,
  withAiReadAttachmentTool,
} from '../thread/ai-attachment-tool'
import { AiProviderStreamTimeoutError } from '../openai/ai-provider-stream-lifecycle'
import { AiUsageService } from '../usage/usage.service'
import { resolveCurrentAiLanguage } from '../utils/ai-output-language-prompt.util'
import {
  AiActionCall,
  AiActionDefinition,
  AiActionResult,
  AiChatRequest,
  AiChatStreamPayload,
  AiContextSnapshot,
  AiModelToolExchangeCall,
  AiModelToolExchangeResult,
  AiMessageRole,
  AiProviderMessage,
  AiRelayStreamEvent,
  AiStreamEventType,
  AiTokenUsage,
  AiToolExecutionContext,
} from '../ai.types'
import { AiClientToolBridgeService } from './client-tool-bridge.service'
import { AiNocodeEditorConversationService } from './nocode-editor-conversation.service'
import { nocodeEditorToolDefinitions } from './nocode-editor-tool-definitions'
import { AiNocodeEditorPromptService } from './nocode-editor-prompt.service'
import { normalizeNocodeEditorAiMessageHistory } from '@common/utils/nocodeEditorAiMessageHistory'
import { normalizeNocodeEditorArtifactBlocks } from '@common/utils/nocodeEditorArtifactBlocks'
import {
  normalizeNocodeEditorFlowScheme,
  normalizeNocodeEditorFlowSchemeReviewResult,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  isSamePlanningConfirmationContext,
} from '@common/utils/nocodeEditorPlanningConfirmationIdentity'
import {
  normalizeFlowIssueRoutingResult,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import {
  DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_REMINDER_BUDGET,
  createFlowBlueprintPreflightState,
  updateFlowBlueprintPreflightProgress,
  type FlowBlueprintPreflightState,
} from '@common/utils/nocodeEditorFlowBlueprintPreflight'
import {
  isNocodeEditorHiddenTimelineTool,
  shouldHideNocodeEditorIntermediateAssistantNarration,
} from '@common/utils/nocodeEditorAiToolVisibility'
import {
  buildNocodeEditorDoneStreamMetadata,
  buildNocodeEditorToolResultStreamMetadata,
  filterNocodeEditorToolResultsPendingStreamEmit,
  mergeNocodeEditorFormulaToolResultsForStream,
} from './nocode-editor-stream-payload'
import {
  buildNocodeEditorToolLoopFinalAssistantText,
  sanitizeNocodeEditorAssistantText,
} from './nocode-editor-loop-fallback'
import {
  MAX_UNSUPPORTED_BLUEPRINT_REPAIR_ATTEMPTS,
  getNocodeEditorUnsupportedBlueprintProtocolRepairFailedMessage,
  resolveUnsupportedBlueprintAutoRepairDecision,
} from './nocode-editor-blueprint-auto-repair.util'
import {
  projectFlowBlueprintPreflightActions,
  restoreFlowBlueprintPreflightStateFromHistory,
  resolveFlowBlueprintPreflightStopDecision,
  resolveFlowBlueprintPreflightToolDecision,
} from './nocode-editor-flow-blueprint-preflight.util'
import {
  normalizeNocodeEditorStreamError,
  shouldRetryNocodeEditorFirstEventTimeout,
} from './nocode-editor-stream-error'
import {
  buildNocodeEditorMergedFormulaResultAssistantMessage,
  buildNocodeEditorToolResultArtifactBlocks,
  buildNocodeEditorToolResultAssistantMessage,
  resolveNocodeEditorToolResultSummaryStage,
} from './nocode-editor-tool-result-messages'
import {
  getLatestPendingBlueprintApplyGate,
  resolveBlueprintApplyGateForStage,
  shouldBlockAgentBlueprintApply,
} from './nocode-editor-blueprint-confirmation.util'
import {
  buildNocodeEditorAppContextSnapshot,
  buildNocodeEditorContinuityHints,
  deriveNocodeEditorTaskSummaryFromExternalAssistantMessage,
  buildNocodeEditorTaskHistoryForProvider,
  buildNocodeEditorTaskSummary,
  reconcileNocodeEditorScenePayloadWithTaskSummary,
  resolveNocodeEditorTaskSummaryForIncomingUserMessage,
  shouldSuppressNocodeEditorStagedFlowSummaryForIncomingUserMessage,
} from './nocode-editor-task-context.util'
import {
  normalizeNocodeEditorPendingFlowIntent,
  type NocodeEditorPendingFlowIntent,
} from '@common/utils/nocodeEditorPendingFlowIntent'
import {
  normalizeNocodeEditorPostFormFlowFollowUp,
  type NocodeEditorPostFormFlowFollowUp,
} from '@common/utils/nocodeEditorPostFormFlowFollowUp'
import {
  normalizeNocodeEditorPostFormFlowRelease,
  type NocodeEditorPostFormFlowRelease,
} from '@common/utils/nocodeEditorPostFormFlowRelease'
import {
  applyNocodeEditorToolResultVisibilityMetadata,
  isCompletedNocodeEditorAppPlanResult,
} from './nocode-editor-tool-result-visibility'
import type { NocodeEditorContinuityHint } from './nocode-editor-task-context.util'
import {
  parseNocodeEditorAppBuilderPlanning,
} from './nocode-editor-app-builder-planning.util'
import {
  getLatestCompletedPlanningResult,
  getLatestPendingPlanningResult,
  getLatestPlanningConvergenceLateQuestions,
  markPlanningConvergenceLateQuestionsOnRoundResults,
  resolvePlanningConvergenceTaskSummary,
  resolvePlanningScopeToolGuard,
  shouldBlockBlueprintApplyForPlanningConvergence,
  shouldStopAfterCompletedPlanningRound,
  shouldStopAfterPendingAppPlanRound,
  shouldStopAfterPlanningConvergenceRound,
} from './nocode-editor-planning-convergence.util'
import {
  shouldBlockRestagingPendingBlueprintAfterApplyGate,
  buildNocodeEditorIndustrySkeletonCarryover,
  matchNocodeEditorIndustrySkeletons,
  resolveNocodeEditorIndustrySkeletonCarryover,
  resolveNocodeEditorIndustrySkeletonPlanningContext,
  resolveNocodeEditorPlanningScope,
  isNocodeEditorPostFormFlowEnabledForScope,
  normalizeNocodeEditorPlanningScopeValue,
} from '@common/utils'
import {
  resolveNocodeEditorFormulaStageBatchAction,
} from '@common/utils/nocodeEditorFormulaDomain'
import {
  hasNocodeEditorSuppressCrossConversationContext,
} from '@common/utils/nocodeEditorAiCrossConversationContext'
import { resolveNocodeEditorUnsupportedBlueprintProtocolState } from '@common/utils/nocodeEditorUnsupportedBlueprintProtocol'
import { normalizeNocodeEditorBlueprintToolInput } from '@common/utils/nocodeEditorBlueprintInput'
import {
  projectNocodeEditorProviderMessagesForContext,
  projectNocodeEditorTaskSummaryForProvider,
} from './nocode-editor-provider-context-projection.util'
import {
  isDefaultContinueReplyMessage,
} from '@common/utils/nocodeEditorPlanningConfirmationReply'
import {
  nocodeEditorFlowConditionReferenceGuide,
  nocodeEditorFlowNodeExamples,
} from './nocode-editor-flow-node-examples'
import type { NocodeEditorFlowPlanNodeType } from '@common/utils/nocodeEditorFlowPlan'
import { normalizeNocodeEditorFlowInternalContinuation } from '@common/utils/nocodeEditorFlowInternalContinuation'

type StreamChatOptions = {
  accountId: string
  accountName?: string
  accountUser?: string
  accountIsAdmin?: boolean
  request: AiChatRequest
  signal?: AbortSignal
  emit?: (payload: AiChatStreamPayload) => void
}

type DeferredNocodeEditorToolResultSummary = {
  result: AiActionResult
  content: string
  metadata: Record<string, unknown>
}

const hasVisibleAssistantNarrationBeforeSummaryReplacement = (value: string) => Boolean(
  sanitizeNocodeEditorAssistantText(String(value || '').trim()),
)

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const sanitizeInternalContinuationRequestMetadata = (
  value: unknown,
): UnknownRecord => {
  const sanitized = isRecord(value) ? { ...value } : {}
  delete sanitized.hiddenFromTimeline
  delete sanitized.internalContinuation
  delete sanitized.internalContinuationCompleted
  delete sanitized.internalContinuationDeduplicated
  delete sanitized.hideInternalContinuationUserMessage
  delete sanitized.nocodeEditorInternalContinuation
  return sanitized
}

const toErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error)
)

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

const FLOW_BLUEPRINT_OWNER_DIAGNOSTIC_PATH = (
  /^triggerBranches\[\d+\]\.nodes\[\d+\](?:\.branches\[\d+\]\.nodes\[\d+\])*\.options\.(?:approver|transactor|notifier|reporter)$/
)

const MODEL_VISIBLE_FLOW_BLUEPRINT_REPAIR_PATHS: Readonly<Record<string, RegExp>> = {
  flow_trigger_change_type_must_be_array: (
    /^triggerBranches\[\d+\]\.triggerNode\.options\.changeType$/
  ),
  flow_trigger_change_type_invalid: (
    /^triggerBranches\[\d+\]\.triggerNode\.options\.changeType$/
  ),
  flow_owner_type_unsupported: FLOW_BLUEPRINT_OWNER_DIAGNOSTIC_PATH,
  flow_owner_sources_conflict: FLOW_BLUEPRINT_OWNER_DIAGNOSTIC_PATH,
  flow_notify_receivers_unsupported: (
    /^triggerBranches\[\d+\]\.nodes\[\d+\](?:\.branches\[\d+\]\.nodes\[\d+\])*\.options\.receivers$/
  ),
  flow_notify_recipients_unsupported: (
    /^triggerBranches\[\d+\]\.nodes\[\d+\](?:\.branches\[\d+\]\.nodes\[\d+\])*\.options\.recipients$/
  ),
}

export const buildFlowSchemeConfirmationContextForClientToolCall = (input: {
  latestTaskSummary?: Record<string, unknown> | null
  activeFormId?: unknown
  activeFormName?: unknown
  continuationPlanningContextKey?: unknown
}) => {
  const summary = input.latestTaskSummary || null
  const planningContextKey = normalizeText(summary?.flowConfirmationContextKey)
  const continuationPlanningContextKey = normalizeText(input.continuationPlanningContextKey)
  const confirmationTargetFormId = normalizeText(summary?.flowConfirmationTargetFormId)
  const activeFormId = normalizeText(input.activeFormId)
  if (
    !planningContextKey
    || !continuationPlanningContextKey
    || !confirmationTargetFormId
    || !activeFormId
    || confirmationTargetFormId !== activeFormId
    || !isSamePlanningConfirmationContext(
      planningContextKey,
      continuationPlanningContextKey,
    )
  ) {
    return null
  }

  const flowConfirmationDecisions = Array.isArray(summary?.flowConfirmationDecisions)
    ? summary.flowConfirmationDecisions.filter((item) => {
      if (!isRecord(item)) {
        return false
      }
      return isSamePlanningConfirmationContext(
        normalizeText(item.planningContextKey),
        planningContextKey,
      )
    })
    : []
  if (!flowConfirmationDecisions.length) {
    return null
  }

  return {
    planningContextKey,
    continuationPlanningContextKey,
    targetFormId: confirmationTargetFormId,
    targetFormName: normalizeText(summary?.flowConfirmationTargetFormName)
      || normalizeText(input.activeFormName)
      || undefined,
    flowConfirmationDecisions,
  }
}

const buildPostBlueprintFlowContinuationSystemMessage = (intent: NocodeEditorPendingFlowIntent) => [
  '当前表单和字段已经生成完成。',
  '用户最初明确要求建表后继续创建流程；pendingFlowIntent 表示显式未完成用户任务，不是系统推荐。',
  'Runtime 不会自动调用工具，不会改写你的 toolCall.input，也不会返回推荐下一步。',
  '如果 targetFormId 或 targetFormName 能唯一定位目标表单，你可以自行调用 editor_open_form 并传入 tab=process-setting，再继续读取流程摘要。',
  '如果目标表单无法唯一确定，先向用户确认具体哪张表单需要继续生成流程。',
  intent.targetFormId || intent.targetFormName
    ? `pendingFlowIntent=${JSON.stringify({
      status: intent.status,
      targetFormId: intent.targetFormId,
      targetFormName: intent.targetFormName,
      evidence: intent.evidence,
    })}`
    : `pendingFlowIntent=${JSON.stringify({
      status: intent.status,
      evidence: intent.evidence,
    })}`,
].join('\n')

const buildPostFormFlowReleaseSystemLines = (
  release: NocodeEditorPostFormFlowRelease | null,
) => release
  ? [
    `表单后流程就绪度：status=${release.status}，canPlan=${release.canPlan}，canApply=${release.canApply}。`,
    release.status === 'needs_fix'
      ? `表单还有 ${release.issueCount} 项待完善；可以先规划流程，不要把这些问题解释成“没有检测到流程特征”。`
      : '',
    release.status === 'blocked_related'
      ? `有 ${release.relatedIssueCount} 项问题与当前流程依赖直接相关；可以继续规划，但不得声称已经生成成功。`
      : '',
    '该状态只提供边界信息，不代表 Runtime 已选择下一步，也不授权自动调用任何流程工具。',
  ].filter(Boolean)
  : []

const buildAvailablePostFormFlowFollowUpSystemMessage = (
  followUp: NocodeEditorPostFormFlowFollowUp,
) => {
  if (followUp.kind === 'explicit_flow_clarification') {
    return [
      '最近一次表单生成成功后，已经向用户展示了流程续接建议，并等待补充触发方式或明确要求继续。',
      '当前 follow-up.kind=explicit_flow_clarification；前端会在 20 秒后自动补发默认继续消息。',
      '只有用户补充触发方式、明确要求继续，或收到默认继续消息后，才可进入流程主链。',
      `postFormFlowFollowUp=${JSON.stringify({
        kind: followUp.kind,
        status: followUp.status,
        questionText: followUp.questionText,
        autoContinueDelaySeconds: followUp.autoContinueDelaySeconds,
        autoContinueMessage: followUp.autoContinueMessage,
        targetFormId: followUp.targetFormId,
        targetFormName: followUp.targetFormName,
      })}`,
    ].join('\n')
  }

  return [
    '当前 follow-up.kind=flow_recommendation。',
    '最近一次表单生成成功后，已经向用户展示了建议创建、可考虑创建或暂不建议创建流程的结论。',
    '只有用户明确接受建议、明确要求继续，或重新说明要建流程时，才可进入流程主链。',
    '不要因为 suggested 或 consider 自动继续。',
    `postFormFlowFollowUp=${JSON.stringify({
      kind: followUp.kind,
      status: followUp.status,
      recommendation: followUp.recommendation,
      reasonSummary: followUp.reasonSummary,
      targetFormId: followUp.targetFormId,
      targetFormName: followUp.targetFormName,
    })}`,
  ].join('\n')
}

const NOCODE_EDITOR_FLOW_NODE_EXAMPLE_TOOL_NAME = 'editor_get_flow_node_examples'

const FLOW_DIRECT_APPLY_KEYWORDS = [
  '直接应用',
  '直接写入',
  '直接落地',
  '直接生成流程',
  '直接生成表单流程',
  '按蓝图生成表单流程',
  '生成到当前流程',
  '生成到当前表单流程',
  '不用先给我确认',
  '不用确认',
]

const FLOW_EXPLICIT_APPLY_TEXTS = new Set([
  '可以生成',
  '继续生成',
  '确认生成',
  '可以应用',
  '继续应用',
  '确认应用',
  '应用',
  '可以生成表单流程',
  '继续生成表单流程',
  '确认生成表单流程',
  '按蓝图生成当前流程',
  '生成到当前流程',
  '生成到当前表单流程',
  '按当前流程蓝图生成',
  '按当前流程生成',
  '按这个流程蓝图生成',
  '按该流程蓝图生成',
  '按蓝图生成',
  '按蓝图生成表单流程',
])

const normalizeFlowApplyIntentText = (value: unknown) => normalizeText(value)
  .replace(/[，。！？、；：,.!?;:"'“”‘’（）()[\]{}]/g, '')
  .replace(/\s+/g, '')
  .toLowerCase()

const includesAnyFlowApplyKeyword = (text: string, keywords: string[]) => (
  keywords.some(keyword => text.includes(normalizeFlowApplyIntentText(keyword)))
)

const isStructuredFlowConfirmationReply = (value: unknown) => (
  String(value || '').trim().startsWith('我补充确认这几项')
)

const isFlowDefaultContinueReply = (value: unknown) => (
  isDefaultContinueReplyMessage(String(value || '').trim())
)

const isExplicitFlowApplyConfirmation = (value: unknown) => {
  const normalized = normalizeFlowApplyIntentText(value)
  if (!normalized) {
    return false
  }
  return FLOW_EXPLICIT_APPLY_TEXTS.has(normalized)
}

const isDirectFlowApplyIntent = (value: unknown) => {
  const normalized = normalizeFlowApplyIntentText(value)
  if (!normalized) {
    return false
  }
  return includesAnyFlowApplyKeyword(normalized, FLOW_DIRECT_APPLY_KEYWORDS)
}

const hasPendingFlowQuestionsInTaskSummary = (taskSummary?: Record<string, unknown> | null) => {
  const normalizedTaskSummary = isRecord(taskSummary) ? taskSummary : null
  if (!normalizedTaskSummary) {
    return false
  }

  const flowBusinessStatus = normalizeText(normalizedTaskSummary.flowBusinessStatus)
  const flowDependencyStatus = normalizeText(normalizedTaskSummary.flowDependencyStatus)
  const confirmationStatus = normalizeText(normalizedTaskSummary.flowConfirmationStatus)
  const openQuestions = Array.isArray(normalizedTaskSummary.flowOpenQuestions)
    ? normalizedTaskSummary.flowOpenQuestions.map(item => normalizeText(item)).filter(Boolean)
    : []
  const confirmationQuestions = Array.isArray(normalizedTaskSummary.flowConfirmationQuestions)
    ? normalizedTaskSummary.flowConfirmationQuestions.map(item => normalizeText(item)).filter(Boolean)
    : []

  if (flowBusinessStatus === 'pending' || flowDependencyStatus === 'pending') {
    return true
  }

  if (openQuestions.length > 0) {
    return true
  }

  return confirmationStatus !== 'completed' && confirmationQuestions.length > 0
}

const hasStagedFlowAwaitingApplyInTaskSummary = (taskSummary?: Record<string, unknown> | null) => {
  const normalizedTaskSummary = isRecord(taskSummary) ? taskSummary : null
  if (!normalizedTaskSummary) {
    return false
  }

  if (hasPendingFlowQuestionsInTaskSummary(normalizedTaskSummary)) {
    return false
  }

  return (
    normalizeText(normalizedTaskSummary.latestAction) === 'editor_stage_flow_blueprint'
  )
    && Boolean(
      normalizeText(normalizedTaskSummary.currentFlowTitle)
      || normalizeText(normalizedTaskSummary.flowSummary),
    )
}

const hasSuccessfulFlowStageWithoutPendingQuestions = (results: AiActionResult[]) => (
  (results || []).some((result) => {
    const toolName = String(result?.name || '').trim()
    if (!result?.ok || toolName !== 'editor_stage_flow_blueprint') {
      return false
    }
    return true
  })
)

const hasPendingFlowSchemeConvergence = (
  scheme?: ReturnType<typeof normalizeNocodeEditorFlowScheme> | null,
) => (
  scheme?.convergence?.businessStatus === 'pending'
  || scheme?.convergence?.dependencyStatus === 'pending'
)

const resolveFlowIssueRoutingFromResult = (result: AiActionResult) => {
  const output = isRecord(result.output) ? result.output : null
  return normalizeFlowIssueRoutingResult(result.metadata?.flowIssueRouting)
    || normalizeFlowIssueRoutingResult(output?.flowIssueRouting)
}

// 只需判断是否存在等待确认的 flow-scheme 结果，如果是则返回该轮结果，否则返回 null
const getLatestFlowSchemeWaitingResult = (results: AiActionResult[]) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index]
    const routing = resolveFlowIssueRoutingFromResult(result)
    if (routing) {
      if (routing.outcome === 'return_to_flow_scheme') {
        return result
      }
      if (
        routing.outcome === 'execution_blocker'
        || routing.outcome === 'system_error'
        || routing.outcome === 'auto_continue'
      ) {
        return null
      }
    }

    const toolName = normalizeText(result?.name)
    if (!result?.ok || toolName !== 'editor_plan_flow_scheme') {
      continue
    }

    const scheme = normalizeNocodeEditorFlowScheme(
      isRecord(result.output) ? result.output.scheme : null,
    )
    const confirmationQuestions = Array.isArray(scheme?.confirmation?.questions)
      ? scheme.confirmation.questions.filter(Boolean)
      : []
    const openQuestions = Array.isArray(scheme?.openQuestions)
      ? scheme.openQuestions.filter(Boolean)
      : []
    const planningStatus = normalizeText(isRecord(result.output) ? result.output.planningStatus : '')

    if (
      hasPendingFlowSchemeConvergence(scheme)
      || planningStatus === 'needs_confirmation'
      || openQuestions.length > 0
      || confirmationQuestions.some(question => !question.confirmed)
    ) {
      return result
    }

    return null
  }

  return null
}

const hasSuccessfulFlowSchemeReadyForReview = (results: AiActionResult[]) => (
  (results || []).some((result) => {
    if (!result?.ok || String(result?.name || '').trim() !== 'editor_plan_flow_scheme') {
      return false
    }

    const routing = resolveFlowIssueRoutingFromResult(result)
    if (routing) {
      return routing.outcome === 'auto_continue'
    }

    const output = isRecord(result.output) ? result.output : null
    const scheme = normalizeNocodeEditorFlowScheme(output?.scheme)
    if (!scheme) {
      return false
    }
    const confirmationQuestions = Array.isArray(scheme.confirmation?.questions)
      ? scheme.confirmation.questions.filter(Boolean)
      : []
    const planningStatus = normalizeText(output?.planningStatus)

    if (
      hasPendingFlowSchemeConvergence(scheme)
      || planningStatus === 'needs_confirmation'
      || (Array.isArray(scheme.openQuestions) && scheme.openQuestions.length > 0)
      || confirmationQuestions.some(question => !question.confirmed)
    ) {
      return false
    }

    return planningStatus === 'ready_for_review'
      || Array.isArray(scheme.confirmation?.questions)
  })
)

const buildFlowSchemeReviewContinuationSystemMessage = () => [
  '你刚刚已经更新了当前流程方案，接下来进入内部方案复核阶段。',
  '这一轮不要调用任何工具，不要输出给用户看的解释，也不要输出 markdown；你只能输出一个合法 JSON 对象。',
  'JSON 结构必须严格满足：{"failed": boolean, "failureReasons": string[], "summary": string, "questions": Array<{ key: string, title: string, reason: string, scopeKind?: "global" | "step" | "branch", scopeKey?: string }> }。',
  'failed=true 时，failureReasons 必须至少包含 1 个，并且只能使用：main_path_missing、critical_config_missing、semantic_conflict、constraint_not_grounded。',
  'failed=false 时，failureReasons 必须为空数组，questions 也必须为空数组。',
  '节点数量少本身不是失败原因；只有节点虽少但没有形成有效主链路，才属于 main_path_missing。',
].join('\n')

const stringifyFlowSchemeReviewResult = (value: unknown) => JSON.stringify(value, null, 2)

const shouldBlockAgentFlowApply = (options: {
  latestUserMessage?: unknown
  latestTaskSummary?: Record<string, unknown> | null
  roundResults?: AiActionResult[]
}) => {
  const latestUserMessage = String(options.latestUserMessage || '').trim()
  const normalizedReply = normalizeFlowApplyIntentText(latestUserMessage)
  const isConfirmationReply = isStructuredFlowConfirmationReply(latestUserMessage)
    || isFlowDefaultContinueReply(latestUserMessage)
  const hasPendingFlowQuestions = hasPendingFlowQuestionsInTaskSummary(options.latestTaskSummary)
    || (options.roundResults || []).some((result) => (
      !result?.ok
        ? false
        : ['editor_plan_flow_scheme', 'editor_stage_flow_blueprint'].includes(String(result?.name || '').trim())
          && !hasSuccessfulFlowStageWithoutPendingQuestions([result])
    ))
  const hasFlowAwaitingApply = hasSuccessfulFlowStageWithoutPendingQuestions(options.roundResults || [])
    || hasStagedFlowAwaitingApplyInTaskSummary(options.latestTaskSummary)
  const hasDirectApplyIntent = isDirectFlowApplyIntent(latestUserMessage)
  const hasApplyConfirmation = isExplicitFlowApplyConfirmation(latestUserMessage)
  const userExpressedApplyIntent = hasDirectApplyIntent || (hasFlowAwaitingApply && hasApplyConfirmation)

  if (isConfirmationReply) {
    return {
      blocked: true,
      reason: 'confirmation_reply_only' as const,
      normalizedReply,
      userExpressedApplyIntent,
    }
  }

  if (hasPendingFlowQuestions) {
    return {
      blocked: true,
      reason: 'pending_flow_confirmation' as const,
      normalizedReply,
      userExpressedApplyIntent,
    }
  }

  if (hasDirectApplyIntent) {
    return {
      blocked: false,
      reason: 'direct_apply_requested' as const,
      normalizedReply,
      userExpressedApplyIntent,
    }
  }

  if (hasFlowAwaitingApply && hasApplyConfirmation) {
    return {
      blocked: false,
      reason: 'explicit_apply_confirmation' as const,
      normalizedReply,
      userExpressedApplyIntent,
    }
  }

  return {
    blocked: true,
    reason: hasFlowAwaitingApply ? 'awaiting_explicit_apply' as const : 'no_staged_flow' as const,
    normalizedReply,
    userExpressedApplyIntent,
  }
}

const MUTATING_EDITOR_TOOL_NAMES = new Set([
  'editor_stage_app_plan',
  'editor_stage_single_form_plan',
  'editor_stage_content_plan',
  'editor_plan_flow_scheme',
  'editor_stage_flow_blueprint',
  'editor_apply_staged_flow',
  'editor_patch_flow',
  'editor_create_form',
  'editor_stage_app_blueprint',
  'editor_clear_staged_app_blueprint',
  'editor_apply_staged_app_blueprint',
  'editor_add_fields',
  'editor_delete_field',
  'editor_replace_field',
  'editor_bind_field_source',
  'editor_set_field_formulas',
  'editor_set_field_options',
  'editor_set_enum_options',
])

const FORMULA_FIELD_TOOL_NAMES = new Set([
  'editor_set_field_formulas',
  'editor_set_field_options',
])
const FORMULA_STAGE_TOOL_NAME = 'editor_stage_formula_plan'
const FORMULA_EXECUTOR_TOOL_NAME = 'editor_set_field_formulas'
const FORMULA_SETTING_PATHS = new Set([
  'default-formula',
  'compute-formula',
])

const isFormulaFieldToolName = (value: unknown) => (
  FORMULA_FIELD_TOOL_NAMES.has(String(value || '').trim())
)

const hasFormulaSettingChanges = (value: unknown) => {
  if (!isRecord(value)) {
    return false
  }
  const changes = Array.isArray(value.changes) ? value.changes : []
  return changes.some(change => {
    if (!isRecord(change)) {
      return false
    }
    const path = Array.isArray(change.path) && change.path.length
      ? change.path.map(part => String(part || '').trim()).filter(Boolean)
      : [String(change.key || '').trim()].filter(Boolean)
    return path.some(part => FORMULA_SETTING_PATHS.has(part))
      || FORMULA_SETTING_PATHS.has(path.join('.'))
  })
}

const isFormulaResultToolResult = (result: AiActionResult) => {
  if (!isFormulaFieldToolName(result?.name)) {
    return false
  }
  return (
    (Array.isArray(result?.output?.formulaUpdates) && result.output.formulaUpdates.length > 0)
    || (Array.isArray(result?.output?.formulaTargetResults) && result.output.formulaTargetResults.length > 0)
  )
}

const hasFormulaResultToolResult = (results: AiActionResult[]) => (
  (results || []).some(result => isFormulaResultToolResult(result))
)

const hasFormulaUpdateToolResult = (results: AiActionResult[]) => (
  (results || []).some(result => (
    isFormulaFieldToolName(result?.name)
    && Array.isArray(result?.output?.formulaUpdates)
    && result.output.formulaUpdates.length > 0
  ))
)

const hasFormulaFieldToolResult = (results: AiActionResult[]) => (
  (results || []).some(result => isFormulaFieldToolName(result?.name))
)

const hasFormulaSuggestionInAssistantText = (value: string) => {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return false
  }
  return /(已为.*生成.*公式|生成以下字段公式|字段公式[:：]|：\s*(TODAY|SUM|SUMIF|SUMIFS|PRODUCT|COUNT|AVERAGE|IF)\s*\()/i.test(normalized)
}

export const shouldRetryMissingFormulaToolCall = (options: {
  userMessage?: unknown
  assistantText?: unknown
  actionResults?: AiActionResult[]
  retryCount?: number
}) => {
  const retryCount = Number(options.retryCount || 0)
  const userMessage = String(options.userMessage || '').trim()
  const assistantText = String(options.assistantText || '').trim()
  if (retryCount > 0) {
    return false
  }

  const combinedText = [userMessage, assistantText].filter(Boolean).join('\n')
  if (!combinedText || !/(公式|计算公式|默认值|TODAY\(|SUM\(|PRODUCT\(|SUMIFS\()/i.test(combinedText)) {
    return false
  }

  const userWantsExecution = /(生成|配置|设置|写入|更新|修改|填入|全部帮|都帮|帮我对|帮我把|直接|配置好)/.test(userMessage)
  const userOnlyAsksForAnalysis = /(判断|哪些|适合|可以使用|建议|分析|梳理|列出)/.test(userMessage)
    && !userWantsExecution

  if (!userWantsExecution || userOnlyAsksForAnalysis) {
    return false
  }

  const actionResults = options.actionResults || []
  if (hasFormulaUpdateToolResult(actionResults)) {
    return false
  }

  if (hasFormulaFieldToolResult(actionResults)) {
    return hasFormulaSuggestionInAssistantText(assistantText)
  }

  return true
}

const UNSUPPORTED_BLUEPRINT_PROTOCOL_FENCE_START = '```banban-app-builder-blueprint'

const resolvePlanningResultIndustrySkeletonScope = (options: {
  toolName?: unknown
  userMessage?: unknown
  scenePayload?: UnknownRecord | null
}) => {
  const toolName = String(options?.toolName || '').trim()
  if (toolName === 'editor_stage_app_plan') {
    return 'app' as const
  }
  if (toolName === 'editor_stage_single_form_plan') {
    return 'form' as const
  }
  if (toolName !== 'editor_stage_app_blueprint') {
    return null
  }

  const inheritedCarryover = resolveNocodeEditorIndustrySkeletonCarryover(
    options?.scenePayload?.industrySkeletonContext,
  )
  if (inheritedCarryover?.planningScope) {
    return inheritedCarryover.planningScope
  }

  const fallbackScope = resolveNocodeEditorPlanningScope(options?.userMessage).scope
  return fallbackScope === 'app' || fallbackScope === 'form'
    ? fallbackScope
    : 'form'
}

@Injectable()
export class AiNocodeEditorChatService {
  private readonly internalContinuationLocks = new Map<string, Promise<void>>()

  constructor(
    private readonly conversationService: AiNocodeEditorConversationService,
    private readonly usageService: AiUsageService,
    private readonly promptService: AiNocodeEditorPromptService,
    private readonly agentLogService: AiAgentLogService,
    private readonly openAiService: AiOpenAiService,
    private readonly clientToolBridge: AiClientToolBridgeService,
    private readonly attachmentService?: AiAttachmentService,
  ) {
  }

  private async acquireInternalContinuationLock(
    lockKey: string,
  ): Promise<() => void> {
    const previous = this.internalContinuationLocks.get(lockKey) || Promise.resolve()
    let release: () => void = () => undefined
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    this.internalContinuationLocks.set(lockKey, current)
    await previous

    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      release()
      if (this.internalContinuationLocks.get(lockKey) === current) {
        this.internalContinuationLocks.delete(lockKey)
      }
    }
  }

  private parseFlowSchemeReviewResult(value: unknown) {
    const rawText = String(value || '').trim()
    if (!rawText) {
      return null
    }

    const candidates = [
      rawText,
      rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim(),
    ]
    const firstBraceIndex = rawText.indexOf('{')
    const lastBraceIndex = rawText.lastIndexOf('}')
    if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
      candidates.push(rawText.slice(firstBraceIndex, lastBraceIndex + 1).trim())
    }

    for (const candidate of candidates) {
      if (!candidate) {
        continue
      }
      try {
        const parsed = JSON.parse(candidate)
        const normalized = normalizeNocodeEditorFlowSchemeReviewResult(parsed)
        if (normalized) {
          return normalized
        }
      } catch {
        continue
      }
    }

    return null
  }

  async streamChat(options: StreamChatOptions) {
    let conversationId = options.request.conversationId
    let traceId = ''
    let conversation: AiNocodeEditorConversationEntity | null = null
    let userMessagePersisted = false
    let releaseInternalContinuationLock: (() => void) | null = null
    try {
      await this.usageService.assertCanChat(options.accountId)

      const requestWithScene: AiChatRequest = {
        ...options.request,
        scene: 'nocode-editor',
      }
      const hasUserFacingContent = Object.prototype.hasOwnProperty.call(
        requestWithScene.metadata || {},
        'userFacingContent',
      )
      const userFacingMessageContent = String(
        hasUserFacingContent
          ? requestWithScene.metadata?.userFacingContent || ''
          : requestWithScene.message || '',
      ).trim()
      const importedHandoffContext = requestWithScene.scenePayload?.importedHandoffContext
      const taskBoundaryUserMessage = String(
        importedHandoffContext?.originalGoal || userFacingMessageContent,
      ).trim() || userFacingMessageContent
      const providerPromptMessageContent = String(
        requestWithScene.metadata?.providerPromptContent || requestWithScene.message || '',
      ).trim() || userFacingMessageContent
      const isAutoBuilderRequirementKickoff = Boolean(requestWithScene.metadata?.autoBuilderRequirementKickoff)
      traceId = this.normalizeTraceId(requestWithScene.traceId || requestWithScene.metadata?.traceId)
        || this.createTurnTraceId()
      conversation = await this.ensureConversation(options.accountId, requestWithScene, false)
      conversationId = conversation.id
      const hasRequestedModelSelection = this.hasRequestedModelSelection(requestWithScene)
      const resolvedModelSelection = await this.openAiService.resolveModelSelection(requestWithScene.model, {
        providerId: requestWithScene.providerId,
        modelId: requestWithScene.modelId,
        modelSelectionSource: requestWithScene.modelSelectionSource,
      })
      const providerId = resolvedModelSelection.providerId
      const modelId = resolvedModelSelection.modelId
      const model = resolvedModelSelection.model
      const attachmentReferences = requestWithScene.metadata?.attachments
      if (Array.isArray(attachmentReferences) && attachmentReferences.length) {
        await this.openAiService.prepareAttachmentsForModel({
          accountId: options.accountId,
          accountName: options.accountName,
          conversationId: conversation.id,
          providerId,
          modelId,
          model,
          attachments: attachmentReferences,
        })
      }
      const editMetadata = await this.conversationService.supersedeOwnerMessageTurn({
        ownerAccountId: options.accountId,
        conversationId: conversation.id,
        messageId: String(requestWithScene.metadata?.editedFromMessageId || '').trim(),
        supersededByTraceId: traceId,
      })

      const internalContinuation = normalizeNocodeEditorFlowInternalContinuation(
        requestWithScene.metadata?.nocodeEditorInternalContinuation,
      )
      if (internalContinuation) {
        releaseInternalContinuationLock = await this.acquireInternalContinuationLock(
          `${conversation.id}:${internalContinuation.key}`,
        )
      }
      const shouldHideInternalContinuationUserMessage = Boolean(
        internalContinuation
        && requestWithScene.metadata?.hideInternalContinuationUserMessage === true
      )
      const normalizedRequestMetadata = {
        ...sanitizeInternalContinuationRequestMetadata(requestWithScene.metadata),
        ...(internalContinuation
          ? { nocodeEditorInternalContinuation: internalContinuation }
          : {}),
      }
      const appendUserMessage = () => this.conversationService.appendMessage(conversation, {
        role: AiMessageRole.USER,
        traceId,
        content: userFacingMessageContent,
        metadata: {
          ...normalizedRequestMetadata,
          ...(editMetadata || {}),
          traceId,
          scene: 'nocode-editor',
          scenePayload: requestWithScene.scenePayload || null,
          ...(shouldHideInternalContinuationUserMessage
            ? {
              hiddenFromTimeline: true,
              internalContinuation: true,
            }
            : {}),
        },
      })
      const alreadyPersisted = internalContinuation
        ? await this.conversationService.hasInternalContinuationKey(
          options.accountId,
          conversation.id,
          internalContinuation.key,
        )
        : false
      const userMessage = alreadyPersisted ? null : await appendUserMessage()
      if (!userMessage) {
        this.emit(options.emit, {
          conversationId: conversation.id,
          event: AiStreamEventType.START,
          metadata: {
            scene: 'nocode-editor',
            traceId,
            internalContinuationDeduplicated: true,
          },
        })
        this.emit(options.emit, {
          conversationId: conversation.id,
          event: AiStreamEventType.DONE,
          finishReason: 'internal_continuation_deduplicated',
          metadata: {
            scene: 'nocode-editor',
            traceId,
            finalContent: '',
            internalContinuationDeduplicated: true,
          },
        })
        return
      }
      userMessagePersisted = true
      if (Array.isArray(attachmentReferences) && attachmentReferences.length) {
        if (!this.attachmentService) {
          throw new Error('AI_ATTACHMENT_PARSE_FAILED')
        }
        await this.attachmentService.bind(
          options.accountId,
          conversation.id,
          attachmentReferences,
          userMessage.id,
        )
      }

      if (hasRequestedModelSelection) {
        conversation = await this.ensureConversation(options.accountId, {
          ...requestWithScene,
          providerId,
          modelId,
          model,
          modelSelectionSource: resolvedModelSelection.modelSelectionSource,
        }, true)
      }
      const providerName = this.openAiService.getProviderName()
      const promptVersion = options.request.promptVersion || 'v1'
      const currentUserProviderMessage: AiProviderMessage = {
        role: AiMessageRole.USER,
        content: providerPromptMessageContent,
        metadata: {
          ...(requestWithScene.metadata || {}),
          traceId,
          scene: 'nocode-editor',
          scenePayload: requestWithScene.scenePayload || null,
        },
      }

      const maxHistoryMessages = this.normalizeHistoryWindow(requestWithScene.maxHistoryMessages)
      const rawHistoryResult = await this.conversationService.listMessagesForConversation(
        options.accountId,
        conversation.id,
        maxHistoryMessages,
        0,
        {
          includeToolMessages: true,
        },
      )
      const rawHistory = Array.isArray(rawHistoryResult)
        ? rawHistoryResult
        : []
      const rawHistoryMessages = rawHistory
      const normalizedHistory = normalizeNocodeEditorAiMessageHistory(rawHistoryMessages)
      const chronologicalHistory = [...normalizedHistory].reverse()
      const latestAppConversation = await this.conversationService.findLatestConversationForApp(
        options.accountId,
        String(requestWithScene.scenePayload?.nocodeId || '').trim(),
        conversation.id,
      )
      const allowCrossConversationContext = !hasNocodeEditorSuppressCrossConversationContext(requestWithScene.metadata)
      const latestAppConversationForCarryover = allowCrossConversationContext ? latestAppConversation : null
      const latestTaskSummary = resolvePlanningConvergenceTaskSummary({
        currentConversationTaskSummary: conversation.taskSummary || null,
        latestAppConversationTaskSummary: latestAppConversationForCarryover?.taskSummary || null,
      }).taskSummary
      const effectiveLatestTaskSummary = resolveNocodeEditorTaskSummaryForIncomingUserMessage({
        latestTaskSummary,
        userMessage: taskBoundaryUserMessage,
        updatedAt: Date.now(),
        validateFormulaPlanContext: true,
        taskId: String(requestWithScene.metadata?.taskId || '').trim(),
        taskScopeKey: String(
          requestWithScene.metadata?.taskScopeKey
          || requestWithScene.scenePayload?.taskScopeKey
          || requestWithScene.scenePayload?.scopeKey
          || '',
        ).trim(),
        activeFormId: String(requestWithScene.scenePayload?.activeFormId || '').trim(),
      })
      const shouldSuppressStagedFlowSummary = shouldSuppressNocodeEditorStagedFlowSummaryForIncomingUserMessage({
        latestTaskSummary: effectiveLatestTaskSummary,
        userMessage: userFacingMessageContent,
      })
      const effectiveStagedFlowSummary = shouldSuppressStagedFlowSummary
        ? ''
        : String(requestWithScene.scenePayload?.stagedFlowSummary || '').trim()
      const effectiveScenePayload = {
        ...reconcileNocodeEditorScenePayloadWithTaskSummary({
          scenePayload: requestWithScene.scenePayload || null,
          taskSummary: effectiveLatestTaskSummary,
        }),
        stagedFlowSummary: effectiveStagedFlowSummary,
      }
      const requestWithEffectiveFlowSummary = {
        ...requestWithScene,
        scenePayload: effectiveScenePayload,
      }
      const latestAppConversationCarryover = latestAppConversationForCarryover
        ? {
          id: latestAppConversationForCarryover.id,
          taskId: latestAppConversationForCarryover.taskId || '',
          taskSummary: effectiveLatestTaskSummary || latestAppConversationForCarryover.taskSummary || null,
        }
        : null
      const appContextSnapshot = buildNocodeEditorAppContextSnapshot({
        latestTaskSummary: effectiveLatestTaskSummary,
        stagedPlanningSummary: String(requestWithScene.scenePayload?.stagedPlanningSummary || '').trim(),
        stagedFlowSummary: effectiveStagedFlowSummary,
        stagedBlueprintSummary: String(requestWithScene.scenePayload?.stagedBlueprintSummary || '').trim(),
      })
      const continuityHints = buildNocodeEditorContinuityHints({
        currentConversationId: conversation.id,
        latestAppConversation: latestAppConversationCarryover,
        summaryReplacesAssistantContent: false,
      })
      const taskHistoryMessages = buildNocodeEditorTaskHistoryForProvider({
        messages: chronologicalHistory.map(item => ({
          role: item.role,
          content: item.content,
          metadata: item.metadata,
        })),
        maxVisibleMessages: maxHistoryMessages,
        latestTaskSummary: effectiveLatestTaskSummary,
      })
      const providerHistoryMessages = taskHistoryMessages.filter((item) => {
        if (item.role !== AiMessageRole.USER) {
          return true
        }
        return this.normalizeTraceId(item.metadata?.traceId) !== traceId
      })
      const historicalAttachmentReferences = collectAiAttachmentReferences(providerHistoryMessages)
      const accessibleHistoricalAttachments = this.attachmentService && historicalAttachmentReferences.length
        ? await this.attachmentService.listAccessibleReferences(
          options.accountId,
          conversation.id,
          historicalAttachmentReferences,
        )
        : []
      const actionDefinitions = requestWithScene.metadata?.disableNocodeEditorTools === true
        ? []
        : withAiReadAttachmentTool(
          nocodeEditorToolDefinitions,
          accessibleHistoricalAttachments.length > 0,
        )
      const restoredFlowBlueprintPreflightState = actionDefinitions.length
        ? restoreFlowBlueprintPreflightStateFromHistory({
          messages: chronologicalHistory,
          userMessage: [userFacingMessageContent, providerPromptMessageContent]
            .filter(Boolean)
            .join('\n'),
          latestTaskSummary: effectiveLatestTaskSummary,
          now: Date.now(),
        })
        : null
      const systemPrompt = this.promptService.buildSystemPrompt({
        request: requestWithEffectiveFlowSummary,
        actions: actionDefinitions,
      })
      const context = this.buildContextSnapshot(options, requestWithEffectiveFlowSummary, actionDefinitions)
      const pendingFlowIntent = normalizeNocodeEditorPendingFlowIntent(
        (effectiveLatestTaskSummary as UnknownRecord | null)?.pendingFlowIntent,
      )
      const planningScope = normalizeNocodeEditorPlanningScopeValue(
        (effectiveLatestTaskSummary as UnknownRecord | null)?.planningScope,
      )
      const canInjectPostFormFlow = isNocodeEditorPostFormFlowEnabledForScope(
        planningScope,
      )
      const postFormFlowFollowUp = normalizeNocodeEditorPostFormFlowFollowUp(
        (effectiveLatestTaskSummary as UnknownRecord | null)?.postFormFlowFollowUp,
      )
      const postFormFlowRelease = normalizeNocodeEditorPostFormFlowRelease(
        (effectiveLatestTaskSummary as UnknownRecord | null)?.postFormFlowRelease,
      )
      const postFormFlowReleaseSystemLines = buildPostFormFlowReleaseSystemLines(
        postFormFlowRelease,
      )
      const turnMessages: AiProviderMessage[] = [
        appContextSnapshot
          ? {
            role: AiMessageRole.SYSTEM,
            content: `轻量应用背景（仅作为应用状态背景，不代表当前任务默认下一步）：\n${appContextSnapshot}`,
            metadata: {
              scene: 'nocode-editor',
              appContextSnapshot: true,
            },
          }
          : null,
        canInjectPostFormFlow && postFormFlowReleaseSystemLines.length
          ? {
            role: AiMessageRole.SYSTEM,
            content: postFormFlowReleaseSystemLines.join('\n'),
            metadata: {
              scene: 'nocode-editor',
              postFormFlowRelease: true,
            },
          }
          : null,
        canInjectPostFormFlow && postFormFlowFollowUp?.status === 'available'
          ? {
            role: AiMessageRole.SYSTEM,
            content: buildAvailablePostFormFlowFollowUpSystemMessage(postFormFlowFollowUp),
            metadata: {
              scene: 'nocode-editor',
              postFormFlowFollowUp: true,
            },
          }
          : null,
        canInjectPostFormFlow
          && !postFormFlowFollowUp
          && pendingFlowIntent
          && pendingFlowIntent.status !== 'completed'
          ? {
            role: AiMessageRole.SYSTEM,
            content: buildPostBlueprintFlowContinuationSystemMessage(pendingFlowIntent),
            metadata: {
              scene: 'nocode-editor',
              pendingFlowIntent: true,
            },
          }
          : null,
        ...this.normalizeHistoryForProvider(providerHistoryMessages, providerName),
        restoredFlowBlueprintPreflightState
          ? {
            role: AiMessageRole.DEVELOPER,
            content: [
              '上一次生成在 blueprint_preflight 阶段中断，已从持久化工具历史恢复预检进度。',
              restoredFlowBlueprintPreflightState.nodeExampleFetchCount > 0
                ? '流程节点示例已经读取完成，不要重复读取。'
                : '已有预检证据可以复用，不要回到流程方案规划。',
              '请基于已确认并已保存的流程方案直接调用 editor_stage_flow_blueprint，不要重复提问或重复提交确认。',
            ].join('\n'),
            metadata: {
              scene: 'nocode-editor',
              flowBlueprintPreflightRestored: true,
              flowBlueprintPreflight: restoredFlowBlueprintPreflightState,
            },
          }
          : null,
        currentUserProviderMessage,
      ].filter(Boolean) as AiProviderMessage[]
      const latestUserMessageContent = String(userMessage?.content || '').trim()
      const providerTaskSummary = projectNocodeEditorTaskSummaryForProvider(effectiveLatestTaskSummary)
      const taskSummaryDiagnostics = {
        sourceJsonChars: JSON.stringify(effectiveLatestTaskSummary || '').length,
        providerJsonChars: JSON.stringify(providerTaskSummary || '').length,
      }

      let assistantText = ''
      let latestRoundAssistantText = ''
      let usage = this.normalizeUsage()
      let finishReason = 'stop'
      const actionResults: AiActionResult[] = []
      const successfulMutationSignatures = new Set<string>()
      const maxActionRounds = this.normalizeActionRounds(requestWithScene.maxActionRounds)
      let visibleToolResultSummaryMessageCount = 0
      const visibleToolResultSummaryContents: string[] = []
      const deferredToolResultSummaries: DeferredNocodeEditorToolResultSummary[] = []
      let lastRoundHadToolCalls = false
      let lastRoundResponseMetadata: Record<string, unknown> | null = null
      let toolIntentRetryCount = 0
      let formulaToolIntentRetryCount = 0
      const formulaStageGate = { ready: false }
      const attachmentReadBudget: AiAttachmentReadBudget = { totalTextLength: 0 }
      let flowSchemeReviewContinuationRetryCount = 0
      let expectingFlowSchemeReviewResult = false
      let flowSchemeReviewResultRepairRetryCount = 0
      let unsupportedBlueprintRepairAttempts = 0
      let flowBlueprintPreflightState: FlowBlueprintPreflightState | null = (
        restoredFlowBlueprintPreflightState
      )
      const maxSupportedActionRounds = maxActionRounds + MAX_UNSUPPORTED_BLUEPRINT_REPAIR_ATTEMPTS

      this.emit(options.emit, {
        conversationId: conversation.id,
        event: AiStreamEventType.START,
        metadata: {
          scene: 'nocode-editor',
          userMessageId: userMessage.id,
          traceId,
          providerId,
          modelId,
          model,
          modelSelectionSource: resolvedModelSelection.modelSelectionSource,
          promptVersion,
          maxActionRounds,
          actionCount: actionDefinitions.length,
          relayArchitecture: providerName,
        },
      })

      let maxRoundReached = false
      let maxLoopRounds = maxActionRounds
      for (let round = 0; round < maxLoopRounds; round += 1) {
        const isFlowSchemeReviewRound = expectingFlowSchemeReviewResult
        expectingFlowSchemeReviewResult = false
        const pendingCalls: AiActionCall[] = []
        let roundRawText = ''
        let roundVisibleText = ''
        let roundContainsUnsupportedBlueprintProtocol = false
        let roundVisibleForwardedLength = 0
        let roundFinishReason = 'stop'
        let roundResponseMetadata: Record<string, unknown> | null = null
        const roundActionDefinitions = projectFlowBlueprintPreflightActions(
          actionDefinitions,
          flowBlueprintPreflightState,
        )
        const roundSystemPrompt = roundActionDefinitions === actionDefinitions
          ? systemPrompt
          : this.promptService.buildSystemPrompt({
            request: requestWithEffectiveFlowSummary,
            actions: roundActionDefinitions,
          })
        const roundContext = roundActionDefinitions === actionDefinitions
          ? context
          : this.buildContextSnapshot(
            options,
            requestWithEffectiveFlowSummary,
            roundActionDefinitions,
          )
        const providerRoundProjection = projectNocodeEditorProviderMessagesForContext(turnMessages)
        const providerRoundMessages = providerRoundProjection.messages
        let firstEventRetryCount = 0
        while (true) {
          try {
            for await (const chunk of this.openAiService.streamTurn({
              accountId: options.accountId,
              accountName: options.accountName,
              conversationId: conversation.id,
              providerId,
              modelId,
              model,
              promptVersion,
              systemPrompt: roundSystemPrompt,
              messages: providerRoundMessages,
              actions: roundActionDefinitions,
              actionResults: [],
              context: roundContext,
              metadata: {
                scene: 'nocode-editor',
                round: round + 1,
                traceId,
                providerDiagnostics: {
                  scene: 'nocode-editor',
                  contextProjection: {
                    compacted: providerRoundProjection.compacted,
                    estimatedBytes: providerRoundProjection.estimatedBytes,
                    taskSummary: taskSummaryDiagnostics,
                    projections: providerRoundProjection.projections.map(item => ({
                      ...item,
                    })),
                  },
                },
              },
              signal: options.signal,
            })) {
              this.handleRelayChunk({
                chunk,
                conversationId: conversation.id,
                traceId,
                emit: options.emit,
                onDelta: (text) => {
                  roundRawText += text
                  if (isFlowSchemeReviewRound) {
                    roundVisibleText = roundRawText
                    return null
                  }
                  const unsupportedProtocolState = resolveNocodeEditorUnsupportedBlueprintProtocolState(roundRawText)
                  roundContainsUnsupportedBlueprintProtocol = unsupportedProtocolState.containsUnsupportedProtocol
                  if (roundContainsUnsupportedBlueprintProtocol) {
                    roundVisibleText = unsupportedProtocolState.visibleContent
                    return null
                  }

                  roundVisibleText = roundRawText
                  const visibleTailBufferLength = this.getUnsupportedBlueprintVisibleTailBufferLength(
                    roundVisibleText,
                  )
                  const safeVisibleLength = Math.max(0, roundVisibleText.length - visibleTailBufferLength)
                  if (safeVisibleLength <= roundVisibleForwardedLength) {
                    return null
                  }

                  const visibleDelta = roundVisibleText.slice(roundVisibleForwardedLength, safeVisibleLength)
                  roundVisibleForwardedLength = safeVisibleLength
                  assistantText += visibleDelta
                  return visibleDelta
                },
                onActionCall: (call) => {
                  pendingCalls.push(call)
                },
                onUsage: (value) => {
                  usage = this.mergeUsage(usage, value)
                },
                onFinishReason: (value) => {
                  roundFinishReason = value
                },
                onResponseMetadata: (value) => {
                  roundResponseMetadata = value
                  lastRoundResponseMetadata = value
                },
              })
            }
            break
          } catch (error) {
            const shouldRetryFirstEventTimeout = shouldRetryNocodeEditorFirstEventTimeout({
              error,
              retryCount: firstEventRetryCount,
              hasRoundOutput: Boolean(roundRawText || pendingCalls.length || roundResponseMetadata),
              aborted: options.signal?.aborted === true,
            })
            await this.agentLogService.logError(conversation.id, {
              stage: 'nocode_editor_provider_round',
              round: round + 1,
              provider: providerName,
              model,
              error: error instanceof Error ? error.message : String(error),
              timeoutPhase: error instanceof AiProviderStreamTimeoutError ? error.phase : undefined,
              timeoutMs: error instanceof AiProviderStreamTimeoutError ? error.timeoutMs : undefined,
              firstEventRetryCount,
              retrying: shouldRetryFirstEventTimeout,
            })
            if (!shouldRetryFirstEventTimeout) {
              throw error
            }
            firstEventRetryCount += 1
          }
        }

        if (
          !isFlowSchemeReviewRound
          && !roundContainsUnsupportedBlueprintProtocol
          && roundVisibleForwardedLength < roundVisibleText.length
        ) {
          const pendingVisibleTail = roundVisibleText.slice(roundVisibleForwardedLength)
          if (pendingVisibleTail) {
            assistantText += pendingVisibleTail
            roundVisibleForwardedLength = roundVisibleText.length
            this.emit(options.emit, {
              conversationId: conversation.id,
              event: AiStreamEventType.DELTA,
              text: pendingVisibleTail,
              metadata: {
                scene: 'nocode-editor',
                traceId,
              },
            })
          }
        }

        latestRoundAssistantText = roundVisibleText.trim()

        finishReason = roundFinishReason || finishReason
        if (isFlowSchemeReviewRound) {
          if (pendingCalls.length > 0) {
            if (flowSchemeReviewResultRepairRetryCount < 1 && round < maxLoopRounds - 1) {
              flowSchemeReviewResultRepairRetryCount += 1
              expectingFlowSchemeReviewResult = true
              turnMessages.push({
                role: AiMessageRole.DEVELOPER,
                content: [
                  '上一轮内部方案复核错误地调用了工具。',
                  '内部方案复核阶段不允许调用任何工具；请重新只输出一个合法 JSON 对象，不要输出 markdown，不要输出解释文本。',
                  buildFlowSchemeReviewContinuationSystemMessage(),
                ].join('\n'),
                metadata: {
                  round: round + 1,
                  scene: 'nocode-editor',
                  flowSchemeReviewContinuation: true,
                  flowSchemeReviewRepair: true,
                },
              })
              continue
            }

            finishReason = 'flow_scheme_review_invalid'
            latestRoundAssistantText = ''
            assistantText = ''
            break
          }

          const reviewResult = this.parseFlowSchemeReviewResult(roundVisibleText)
          if (!reviewResult) {
            if (flowSchemeReviewResultRepairRetryCount < 1 && round < maxLoopRounds - 1) {
              flowSchemeReviewResultRepairRetryCount += 1
              expectingFlowSchemeReviewResult = true
              turnMessages.push({
                role: AiMessageRole.DEVELOPER,
                content: [
                  '上一轮内部方案复核没有返回合法 JSON。',
                  '请重新只输出一个合法 JSON 对象，不要输出 markdown，不要输出解释文本。',
                  buildFlowSchemeReviewContinuationSystemMessage(),
                ].join('\n'),
                metadata: {
                  round: round + 1,
                  scene: 'nocode-editor',
                  flowSchemeReviewContinuation: true,
                  flowSchemeReviewRepair: true,
                },
              })
              continue
            }

            finishReason = 'flow_scheme_review_invalid'
            latestRoundAssistantText = global.i18next.t('nocodeEditorChatService.flowSchemeReviewFailed')
            assistantText = ''
            break
          }

          flowSchemeReviewResultRepairRetryCount = 0
          if (reviewResult.failed) {
            turnMessages.push({
              role: AiMessageRole.DEVELOPER,
              content: [
                '上一轮内部方案复核失败。以下结构化结果仅供你本轮继续规划使用，不要原样展示给用户：',
                '```json',
                stringifyFlowSchemeReviewResult(reviewResult),
                '```',
                '你必须吸收 review.summary、failureReasons 和 questions；如果仍需用户确认，把真正缺失的 1 到 3 个问题写回 openQuestions。',
                '这一轮不要输出复核卡，不要调用 editor_stage_flow_blueprint，也不要调用 editor_apply_staged_flow。',
                '请继续调用 editor_plan_flow_scheme，输出新的流程方案。',
              ].join('\n'),
              metadata: {
                round: round + 1,
                scene: 'nocode-editor',
                flowSchemeReviewFailed: true,
              },
            })
            continue
          }

          const latestReadyFlowSchemeResult = [...actionResults]
            .reverse()
            .find(result => (
              result?.ok
              && normalizeText(result?.name) === 'editor_plan_flow_scheme'
            ))
          const readyFlowOutput = isRecord(latestReadyFlowSchemeResult?.output)
            ? latestReadyFlowSchemeResult.output
            : null
          const readyFlowScheme = isRecord(readyFlowOutput?.scheme)
            ? readyFlowOutput.scheme
            : null
          const readyFlowConfirmation = isRecord(readyFlowScheme?.confirmation)
            ? readyFlowScheme.confirmation
            : null
          flowBlueprintPreflightState = createFlowBlueprintPreflightState({
            planningContextKey: normalizeText(
              readyFlowOutput?.planningContextKey
              || readyFlowConfirmation?.planningContextKey,
            ),
            schemeRevision: Number(readyFlowOutput?.revision || 0),
            now: Date.now(),
            phase: 'summary',
          })
          turnMessages.push({
            role: AiMessageRole.DEVELOPER,
            content: [
              '上一轮内部方案复核通过，当前进入 blueprint_preflight。以下结构化结果仅供你本轮继续生成蓝图使用，不要原样展示给用户：',
              '```json',
              stringifyFlowSchemeReviewResult(reviewResult),
              '```',
              '这一轮不要回到 editor_plan_flow_scheme，不要再提问，也不要直接调用 editor_apply_staged_flow。',
              '如果已有可复用的 flow summary 证据，不要重复读取；如果某类节点示例已经在本轮拿到，也不要重复 editor_get_flow_node_examples。',
              '这一轮只允许三类动作：按需补一次 editor_get_flow_summary、按需补一次 editor_get_flow_node_examples、最终调用 editor_stage_flow_blueprint。',
              '补读后必须继续 editor_stage_flow_blueprint，不要停在普通思考正文。',
              '请直接调用 editor_stage_flow_blueprint，基于当前已暂存的流程方案输出最终流程蓝图。蓝图应在完整覆盖业务语义和关键节点配置的前提下，尽量减少节点数量、分支数量和重复链路；能提到外层复用的公共节点，不要在各分支内重复展开。条件分支能由其他分支兜底覆盖时，不要额外新建分支；不要生成分支内无节点的空分支，若某个条件分支没有实际后续处理节点，应直接去除该分支。不要为了简化结构而省略任何节点的关键语义配置；已经决定生成的节点，应尽量按节点示例补齐关键 options 字段，不要只写骨架。',
            ].join('\n'),
            metadata: {
              round: round + 1,
              scene: 'nocode-editor',
              flowSchemeReviewPassed: true,
              flowBlueprintPreflight: flowBlueprintPreflightState,
            },
          })
          continue
        }

        const lostToolIntent = this.shouldTreatAsLostToolIntent({
          finishReason,
          pendingCalls,
          responseMetadata: roundResponseMetadata,
          latestRoundAssistantText,
          actionResults,
        })
        const hasPendingBlueprintToolCall = pendingCalls.some(call => (
          String(call?.name || '').trim() === 'editor_stage_app_blueprint'
        ))
        const unsupportedBlueprintRepairDecision = resolveUnsupportedBlueprintAutoRepairDecision({
          repairAttempts: unsupportedBlueprintRepairAttempts,
          containsUnsupportedProtocol: roundContainsUnsupportedBlueprintProtocol,
          hasPendingBlueprintToolCall,
          executedToolNames: [],
        })
        if (unsupportedBlueprintRepairDecision.kind === 'retry') {
          unsupportedBlueprintRepairAttempts = unsupportedBlueprintRepairDecision.repairAttempts
          maxLoopRounds = Math.min(
            maxSupportedActionRounds,
            maxActionRounds + unsupportedBlueprintRepairAttempts,
          )
          lastRoundHadToolCalls = false
          turnMessages.push({
            role: AiMessageRole.SYSTEM,
            content: unsupportedBlueprintRepairDecision.systemMessage,
            metadata: {
              round: round + 1,
              scene: 'nocode-editor',
              unsupportedBlueprintProtocolRepair: true,
              unsupportedBlueprintProtocolRepairAttempt: unsupportedBlueprintRepairAttempts,
              maxUnsupportedBlueprintProtocolRepairAttempts: MAX_UNSUPPORTED_BLUEPRINT_REPAIR_ATTEMPTS,
            },
          })
          continue
        }
        if (unsupportedBlueprintRepairDecision.kind === 'fail') {
          finishReason = unsupportedBlueprintRepairDecision.finishReason
          latestRoundAssistantText = unsupportedBlueprintRepairDecision.assistantMessage
          lastRoundHadToolCalls = false
          break
        }

        if (!pendingCalls.length) {
          const hasRetryRoundAvailable = round < maxLoopRounds - 1
          if (flowBlueprintPreflightState) {
            const hasPreflightReminderBudget = (
              Number(flowBlueprintPreflightState.reminderCount || 0)
              < DEFAULT_FLOW_BLUEPRINT_PREFLIGHT_REMINDER_BUDGET
            )
            if (hasRetryRoundAvailable && hasPreflightReminderBudget) {
              flowBlueprintPreflightState = {
                ...flowBlueprintPreflightState,
                reminderCount: Number(flowBlueprintPreflightState.reminderCount || 0) + 1,
              }
              turnMessages.push({
                role: AiMessageRole.SYSTEM,
                content: [
                  '当前仍处于 blueprint_preflight，不要停在普通思考正文。',
                  '这一轮只允许按需补 editor_get_flow_summary、按需补 editor_get_flow_node_examples，或继续 editor_stage_flow_blueprint。',
                  '如果当前证据已经足够，请直接调用 editor_stage_flow_blueprint。',
                ].join('\n'),
                metadata: {
                  round: round + 1,
                  scene: 'nocode-editor',
                  flowBlueprintPreflight: flowBlueprintPreflightState,
                  flowBlueprintPreflightReminder: true,
                },
              })
              continue
            }

            finishReason = 'blueprint_preflight_no_progress'
            latestRoundAssistantText = global.i18next.t('nocodeEditorChatService.flowBlueprintPreparationStopped')
            lastRoundHadToolCalls = false
            break
          }

          const recentFormulaContextText = turnMessages
            .slice(-6)
            .map(message => String(message?.content || '').trim())
            .filter(Boolean)
            .join('\n')
          if (hasRetryRoundAvailable && shouldRetryMissingFormulaToolCall({
            userMessage: latestUserMessageContent,
            assistantText: [recentFormulaContextText, roundVisibleText].filter(Boolean).join('\n'),
            actionResults,
            retryCount: formulaToolIntentRetryCount,
          })) {
            formulaToolIntentRetryCount += 1
            turnMessages.push({
              role: AiMessageRole.SYSTEM,
              content: [
                '用户当前是在要求生成或配置字段公式，需要通过 editor_get_form_summary、editor_get_widget_option_schema、editor_set_field_formulas 等工具真正写入字段设置。',
                '单字段和多字段公式都必须使用 editor_set_field_formulas；如果是多个字段，请把本轮所有目标字段都放入 items，不要只处理其中一部分。',
                '如果某个目标字段能生成公式，必须作为 status=updated 的 item 写入 widgetId、changes 和 explanation；只有确实不能写入的目标字段才作为 status=skipped 写入 reason。',
                '不要把“已为以下字段生成公式”只写在自然语言正文里；这些公式必须进入 editor_set_field_formulas.items 并真正执行写入。',
              ].filter(Boolean).join('\n'),
              metadata: {
                round: round + 1,
                scene: 'nocode-editor',
                formulaToolIntentRetry: true,
              },
            })
            continue
          }

          if (lostToolIntent && toolIntentRetryCount < 1 && hasRetryRoundAvailable) {
            toolIntentRetryCount += 1
            turnMessages.push({
              role: AiMessageRole.SYSTEM,
              content: '上一轮没有形成有效的可执行结果，可能是工具调用损坏，也可能是模型空响应。请重新输出同一意图的有效工具调用或明确答复，不要只重复准备性文案，也不要返回空内容。',
              metadata: {
                round: round + 1,
                scene: 'nocode-editor',
                toolIntentLostRetry: true,
              },
            })
            continue
          }

          lastRoundHadToolCalls = false
          if (lostToolIntent) {
            finishReason = 'tool_intent_lost_after_invalid_tool_call'
          }
          break
        }
        lastRoundHadToolCalls = true

        const roundExecution = await this.executeClientToolCalls(
          pendingCalls,
          conversation,
          traceId,
          options.emit,
          round + 1,
          successfulMutationSignatures,
          turnMessages,
          latestAppConversationCarryover,
          effectiveLatestTaskSummary,
          currentUserProviderMessage,
          roundVisibleText,
          {
            accountId: options.accountId,
            accountName: options.accountName,
            providerId: providerId || undefined,
            modelId: modelId || undefined,
            model,
          },
          Boolean(flowBlueprintPreflightState),
          options.signal,
          formulaStageGate,
          attachmentReadBudget,
        )
        const roundResults = roundExecution.results
        const shouldRestartFlowSchemeReviewAfterPreflight = Boolean(
          flowBlueprintPreflightState
          && hasSuccessfulFlowSchemeReadyForReview(roundResults)
        )
        if (shouldRestartFlowSchemeReviewAfterPreflight) {
          flowBlueprintPreflightState = null
          flowSchemeReviewContinuationRetryCount = 0
        }
        this.suppressIntermediateFlowStageSummaries(roundResults)
        this.suppressIntermediateFlowSchemeSummaries(
          roundResults,
          flowSchemeReviewContinuationRetryCount < 1 && round < maxLoopRounds - 1,
        )
        actionResults.push(...roundResults)
        markPlanningConvergenceLateQuestionsOnRoundResults({
          results: roundResults,
          latestTaskSummary: effectiveLatestTaskSummary,
        })
        this.markDeferredIntermediateAppPlanSummaries(roundResults)
        applyNocodeEditorToolResultVisibilityMetadata(roundResults)
        this.emitToolResultStreamMetadata({
          results: filterNocodeEditorToolResultsPendingStreamEmit(
            roundResults,
            roundExecution.streamEmittedCallIds,
          ),
          conversationId: conversation.id,
          traceId,
          emit: options.emit,
        })
        const toolResultSummaryAppendResult = await this.appendToolResultAssistantMessages({
          results: roundResults,
          conversation,
          traceId,
          round: round + 1,
          turnMessages,
        })
        visibleToolResultSummaryMessageCount += toolResultSummaryAppendResult.visibleCount
        visibleToolResultSummaryContents.push(...toolResultSummaryAppendResult.visibleContents)
        deferredToolResultSummaries.push(...toolResultSummaryAppendResult.deferredSummaries)
        if (roundVisibleText.trim() && !toolResultSummaryAppendResult.count) {
          turnMessages.push({
            role: AiMessageRole.ASSISTANT,
            content: roundVisibleText.trim(),
            metadata: {
              round: round + 1,
              scene: 'nocode-editor',
            },
          })
        }

        let madeFlowBlueprintPreflightProgressThisRound = false
        let latestFlowBlueprintPreflightProgressToolName = ''
        for (const result of roundResults) {
          const toolName = normalizeText(result?.name)
          if (
            !flowBlueprintPreflightState
            || !result?.ok
            || ![
              'editor_get_flow_summary',
              'editor_get_flow_node_examples',
              'editor_stage_flow_blueprint',
            ].includes(toolName)
          ) {
            continue
          }

          madeFlowBlueprintPreflightProgressThisRound = true
          flowBlueprintPreflightState = updateFlowBlueprintPreflightProgress(
            flowBlueprintPreflightState,
            {
              toolName,
              now: Date.now(),
            },
          )
          result.metadata = {
            ...(result.metadata || {}),
            flowBlueprintPreflight: flowBlueprintPreflightState,
          }
          latestFlowBlueprintPreflightProgressToolName = toolName
        }
        if (
          madeFlowBlueprintPreflightProgressThisRound
          && flowBlueprintPreflightState
        ) {
          await this.persistFlowBlueprintPreflightCheckpoint({
            accountId: options.accountId,
            conversation,
            latestTaskSummary: effectiveLatestTaskSummary,
            latestAction: latestFlowBlueprintPreflightProgressToolName,
            state: flowBlueprintPreflightState,
          })
        }

        const hasSuccessfulFlowBlueprintResult = roundResults.some(result => (
          result?.ok
          && normalizeText(result?.name) === 'editor_stage_flow_blueprint'
        ))
        const preflightStopDecision = resolveFlowBlueprintPreflightStopDecision({
          state: flowBlueprintPreflightState,
          now: Date.now(),
          hasSuccessfulBlueprintCall: hasSuccessfulFlowBlueprintResult,
          madeProgressThisRound: madeFlowBlueprintPreflightProgressThisRound,
        })

        if (preflightStopDecision.kind === 'remind') {
          flowBlueprintPreflightState = preflightStopDecision.nextState
          turnMessages.push({
            role: AiMessageRole.SYSTEM,
            content: preflightStopDecision.systemMessage,
            metadata: {
              round: round + 1,
              scene: 'nocode-editor',
              flowBlueprintPreflight: flowBlueprintPreflightState,
              flowBlueprintPreflightReminder: true,
            },
          })
          continue
        }

        if (preflightStopDecision.kind === 'finish') {
          finishReason = 'blueprint_preflight_no_progress'
          latestRoundAssistantText = preflightStopDecision.assistantMessage
          lastRoundHadToolCalls = false
          break
        }

        if (shouldStopAfterPendingAppPlanRound({
          results: roundResults,
        })) {
          finishReason = 'app_plan_waiting_for_confirmation'
          break
        }

        if (shouldStopAfterCompletedPlanningRound({
          results: roundResults,
          autoContinueWithoutConfirmation: isAutoBuilderRequirementKickoff,
        })) {
          finishReason = 'planning_waiting_for_confirmation'
          break
        }

        if (shouldStopAfterPlanningConvergenceRound({
          results: roundResults,
          latestTaskSummary: effectiveLatestTaskSummary,
        })) {
          finishReason = 'single_form_plan_waiting_for_confirmation'
          break
        }

        if (getLatestFlowSchemeWaitingResult(roundResults)) {
          finishReason = 'flow_scheme_waiting_for_confirmation'
          break
        }

        const shouldContinueFlowSchemeReview = (
          flowSchemeReviewContinuationRetryCount < 1
          && round < maxLoopRounds - 1
          && hasSuccessfulFlowSchemeReadyForReview(roundResults)
        )
        if (shouldContinueFlowSchemeReview) {
          flowSchemeReviewContinuationRetryCount += 1
          expectingFlowSchemeReviewResult = true
          turnMessages.push({
            role: AiMessageRole.SYSTEM,
            content: buildFlowSchemeReviewContinuationSystemMessage(),
            metadata: {
              round: round + 1,
              scene: 'nocode-editor',
              flowSchemeReviewContinuation: true,
            },
          })
          continue
        }

        if (this.shouldStopAfterFlowPatchRound(roundResults)) {
          finishReason = 'flow_patched_waiting_for_followup'
          break
        }

        if (this.shouldStopAfterRepeatedInvalidFlowPatch(actionResults)) {
          finishReason = 'flow_patch_invalid_input_stop_loss'
          break
        }

        if (this.shouldStopAfterFlowStageRound(roundResults)) {
          finishReason = 'flow_staged_waiting_for_apply'
          break
        }

        if (this.shouldStopAfterBlueprintStageRound(roundResults)) {
          finishReason = 'blueprint_staged_waiting_for_confirmation'
          break
        }

        if (this.shouldStopAfterFlowApplyRound(roundResults)) {
          finishReason = 'flow_applied_waiting_for_followup'
          break
        }

        if (this.shouldStopAfterBlueprintApplyRound(roundResults)) {
          finishReason = 'blueprint_applied_waiting_for_followup'
          break
        }

        if (this.shouldStopAfterDuplicateOnlyRound(roundResults)) {
          finishReason = 'duplicate_guard_stopped'
          break
        }

        if (roundResults.some(result => Boolean(result.metadata?.duplicateBlocked))) {
          turnMessages.push({
            role: AiMessageRole.SYSTEM,
            content: '同一项修改在本轮里已经成功执行过，不要再次调用相同修改；如果用户当前要求已经满足，请直接回复结果。',
            metadata: {
              round: round + 1,
              scene: 'nocode-editor',
              duplicateGuard: true,
            },
          })
        }

        if (round === maxLoopRounds - 1) {
          maxRoundReached = true
        }
      }

      if (maxRoundReached) {
        finishReason = 'max_action_rounds'
      }

      applyNocodeEditorToolResultVisibilityMetadata(actionResults)
      const materializedDeferredSummaryResult = await this.materializeDeferredToolResultAssistantSummaries({
        summaries: deferredToolResultSummaries,
        conversation,
        traceId,
      })
      visibleToolResultSummaryMessageCount += materializedDeferredSummaryResult.visibleCount
      visibleToolResultSummaryContents.push(...materializedDeferredSummaryResult.visibleContents)

      const rawFinalAssistantText = this.buildToolLoopFinalAssistantText({
        latestRoundAssistantText,
        assistantText,
        finishReason,
        actionResults,
      })
      const sanitizedFinalAssistantText = sanitizeNocodeEditorAssistantText(rawFinalAssistantText)
      const hasExplicitFinalAssistantText = Boolean(
        sanitizeNocodeEditorAssistantText(String(latestRoundAssistantText || '').trim()),
      )
      const shouldSuppressToolRoundNarration = Boolean(
        visibleToolResultSummaryMessageCount > 0
        && lastRoundHadToolCalls,
      )
      const shouldSuppressDuplicateToolResultNarration = Boolean(
        sanitizedFinalAssistantText
        && visibleToolResultSummaryContents.some(content => this.isEquivalentAssistantNarration(
          content,
          sanitizedFinalAssistantText,
        )),
      )
      const shouldSuppressFormulaResultNarration = Boolean(
        visibleToolResultSummaryMessageCount > 0
        && hasFormulaResultToolResult(actionResults)
      )
      let finalAssistantText = rawFinalAssistantText
      if (
        shouldSuppressToolRoundNarration
        || shouldSuppressFormulaResultNarration
        || (visibleToolResultSummaryMessageCount > 0 && !hasExplicitFinalAssistantText)
        || shouldSuppressDuplicateToolResultNarration
      ) {
        finalAssistantText = ''
      }

      const lostToolIntentFallbackMessage = global.i18next.t('nocodeEditorChatService.aiEditingFailed')
      const unsupportedBlueprintAutoRepairFailed = finishReason === 'unsupported_blueprint_protocol_after_repair'
      const lostToolIntentFallback = finishReason === 'tool_intent_lost_after_invalid_tool_call'
        ? this.buildLostToolIntentFallback({ responseMetadata: lastRoundResponseMetadata })
        : null
      const clientRenderedFlowApplyResult = [...actionResults]
        .reverse()
        .find(result => (
          String(result?.name || '').trim() === 'editor_apply_staged_flow'
          && result?.metadata?.clientRenderedToolResult === true
        ))
      const clientRenderedFlowApplyContent = sanitizeNocodeEditorAssistantText(String(
        clientRenderedFlowApplyResult?.metadata?.clientRenderedAssistantContent || '',
      ).trim())
      const clientRenderedFlowApplyMetadata = isRecord(clientRenderedFlowApplyResult?.metadata?.clientRenderedAssistantMetadata)
        ? clientRenderedFlowApplyResult?.metadata?.clientRenderedAssistantMetadata as Record<string, unknown>
        : null
      if (lostToolIntentFallback) {
        finalAssistantText = lostToolIntentFallback.assistantText
      }
      if (unsupportedBlueprintAutoRepairFailed) {
        finalAssistantText = getNocodeEditorUnsupportedBlueprintProtocolRepairFailedMessage()
      }
      if (clientRenderedFlowApplyContent) {
        finalAssistantText = clientRenderedFlowApplyContent
      }

      if (!assistantText.trim() || unsupportedBlueprintAutoRepairFailed) {
        this.emit(options.emit, {
          conversationId: conversation.id,
          event: AiStreamEventType.DELTA,
          text: finalAssistantText,
          metadata: {
            scene: 'nocode-editor',
            traceId,
          },
        })
      }

      const hasStructuredAppPlan = actionResults.some(result => (
        result.ok && String(result.name || '').trim() === 'editor_stage_app_plan'
      ))
      const planningPresentation = hasStructuredAppPlan
        ? parseNocodeEditorAppBuilderPlanning('')
        : parseNocodeEditorAppBuilderPlanning(finalAssistantText)
      finalAssistantText = planningPresentation.assistantContent || finalAssistantText
      const shouldPersistPlanningMetadata = !hasStructuredAppPlan && !planningPresentation.invalid
      const flowSchemeFallbackBlocks = finishReason === 'blueprint_preflight_no_progress'
        ? this.collectLatestFlowSchemeFallbackBlocks(actionResults)
        : []
      const toolResultAssistantBlocks = flowSchemeFallbackBlocks.length
        ? flowSchemeFallbackBlocks
        : visibleToolResultSummaryMessageCount > 0
          ? []
          : this.collectAssistantBlocks(actionResults)
      const assistantBlocks = (
        finishReason === 'tool_intent_lost_after_invalid_tool_call'
        || unsupportedBlueprintAutoRepairFailed
      )
        ? []
        : [
          ...toolResultAssistantBlocks,
          ...(shouldPersistPlanningMetadata && planningPresentation.planBlock ? [planningPresentation.planBlock] : []),
        ]
      const finalAssistantBlocks = clientRenderedFlowApplyMetadata?.blocks && Array.isArray(clientRenderedFlowApplyMetadata.blocks)
        ? clientRenderedFlowApplyMetadata.blocks
        : assistantBlocks
      const taskSummary = buildNocodeEditorTaskSummary({
        latestTaskSummary: effectiveLatestTaskSummary,
        userMessage: taskBoundaryUserMessage,
        finishReason,
        scenePayload: requestWithScene.scenePayload || {},
        actionResults,
        assistantBlocks: finalAssistantBlocks,
        planningSummary: shouldPersistPlanningMetadata ? (planningPresentation.compactSummary || '') : '',
        planningMode: shouldPersistPlanningMetadata ? (planningPresentation.plan?.mode || '') : '',
        planningOpenQuestions: shouldPersistPlanningMetadata ? (planningPresentation.plan?.openQuestions || []) : [],
        updatedAt: Date.now(),
      })
      const persistedTaskSummary = projectNocodeEditorTaskSummaryForProvider(taskSummary) as typeof taskSummary
      const shouldAppendFinalAssistant = Boolean(finalAssistantText || finalAssistantBlocks.length)
      let assistantMessage = null
      if (shouldAppendFinalAssistant) {
        assistantMessage = await this.conversationService.appendMessage(conversation, {
          role: AiMessageRole.ASSISTANT,
          traceId,
          content: sanitizeNocodeEditorAssistantText(finalAssistantText),
          metadata: {
            ...(clientRenderedFlowApplyMetadata || {}),
            traceId,
            finishReason,
            provider: providerName,
            model,
            usage,
            promptVersion,
            scene: 'nocode-editor',
            ...(internalContinuation
              ? {
                hiddenFromTimeline: false,
                internalContinuationCompleted: true,
                nocodeEditorInternalContinuation: internalContinuation,
              }
              : {
                internalContinuationCompleted: undefined,
                nocodeEditorInternalContinuation: undefined,
              }),
            autoBuilderRequirementKickoff: isAutoBuilderRequirementKickoff || undefined,
            toolIntentLost: finishReason === 'tool_intent_lost_after_invalid_tool_call' || undefined,
            toolIntentLostReason: finishReason === 'tool_intent_lost_after_invalid_tool_call'
              ? 'tool_call_repair_failed_after_retry'
              : undefined,
            toolIntentLostToolName: lostToolIntentFallback?.metadata.toolIntentLostToolName || undefined,
            toolIntentRetryCount: toolIntentRetryCount || undefined,
            unsupportedBlueprintAutoRepairAttempts: unsupportedBlueprintRepairAttempts || undefined,
            unsupportedBlueprintAutoRepairFailed: (
              unsupportedBlueprintRepairAttempts > 0
              || unsupportedBlueprintAutoRepairFailed
            )
              ? unsupportedBlueprintAutoRepairFailed
              : undefined,
            blocks: finalAssistantBlocks.length ? finalAssistantBlocks : undefined,
            appBuilderPlanningInvalid: planningPresentation.invalid || undefined,
            appBuilderPlanningInvalidReason: planningPresentation.invalidReason || undefined,
            appBuilderPlanningSummary: shouldPersistPlanningMetadata ? (planningPresentation.compactSummary || undefined) : undefined,
            appBuilderPlanningArtifacts: shouldPersistPlanningMetadata && planningPresentation.plan?.artifacts?.length
              ? planningPresentation.plan.artifacts
              : undefined,
            appBuilderPlanningOutline: shouldPersistPlanningMetadata ? (planningPresentation.plan?.outline || undefined) : undefined,
            taskSummary: persistedTaskSummary,
            blueprintApplyGate: persistedTaskSummary.blueprintApplyGate || undefined,
            actionResults: actionResults.map(item => ({
              callId: item.callId,
              name: item.name,
              kind: item.kind,
              ok: item.ok,
            })),
          },
        })
      }
      await this.conversationService.updateConversationTaskSummary(
        options.accountId,
        conversation.id,
        persistedTaskSummary,
      )

      await this.usageService.recordUsage({
        accountId: options.accountId,
        visitorId: requestWithScene.visitorId || null,
        channel: requestWithScene.visitorId ? 'public' : 'owner',
        conversationId: conversation.id,
        messageId: assistantMessage?.id || userMessage.id,
        provider: providerName,
        model,
        scope: 'nocode-editor',
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        metadata: {
          promptVersion,
          scene: 'nocode-editor',
          traceId,
          nocodeId: requestWithScene.scenePayload?.nocodeId || null,
          actionCount: actionResults.length,
          finishReason,
          toolIntentRetryCount,
        },
      })

      this.emit(options.emit, {
        conversationId: conversation.id,
        event: AiStreamEventType.DONE,
        usage,
        finishReason,
        metadata: buildNocodeEditorDoneStreamMetadata({
          assistantMessageId: assistantMessage?.id || '',
          traceId,
          actionCount: actionResults.length,
          finalContent: finalAssistantText,
          actionResults,
          unsupportedBlueprintAutoRepairAttempts: unsupportedBlueprintRepairAttempts,
          unsupportedBlueprintAutoRepairFailed,
          continuityHints,
          blocks: assistantBlocks,
          appBuilderPlanningSummary: shouldPersistPlanningMetadata ? (planningPresentation.compactSummary || '') : '',
          appBuilderPlanningArtifacts: shouldPersistPlanningMetadata ? (planningPresentation.plan?.artifacts || []) : [],
          appBuilderPlanningOutline: shouldPersistPlanningMetadata ? (planningPresentation.plan?.outline || undefined) : undefined,
        }),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (options.signal?.aborted) {
        if (conversationId) {
          this.clientToolBridge.rejectConversation(conversationId, 'AI request aborted')
        }
        throw error
      }
      const normalizedError = normalizeNocodeEditorStreamError({
        error,
        traceId: traceId || undefined,
        userMessagePersisted,
      })
      const streamErrorMetadata = {
        ...normalizedError.metadata,
        persistedError: Boolean(conversation),
      }
      if (conversationId) {
        await this.agentLogService.logError(conversationId, {
          stage: 'nocode_editor_stream_chat',
          error: normalizedError.diagnostic,
        })
        this.clientToolBridge.rejectConversation(conversationId, normalizedError.userMessage)
      }
      if (conversation) {
        await this.conversationService.appendMessage(conversation, {
          role: AiMessageRole.ASSISTANT,
          traceId: traceId || undefined,
          content: normalizedError.userMessage,
          metadata: {
            ...streamErrorMetadata,
            hiddenFromTimeline: false,
          },
        })
      }
      this.emit(options.emit, {
        conversationId,
        event: AiStreamEventType.ERROR,
        error: normalizedError.userMessage,
        metadata: streamErrorMetadata,
      })
      throw error
    } finally {
      releaseInternalContinuationLock?.()
    }
  }

  async resolveClientToolResult(payload: {
    body: {
      conversationId: string
      callId: string
      toolName: string
      ok: boolean
      output?: unknown
      error?: string
      metadata?: Record<string, unknown>
    }
  }) {
    return this.clientToolBridge.resolveResult(payload.body)
  }

  async appendExternalConversationMessage(options: {
    accountId: string
    conversationId: string
    role?: AiMessageRole | string
    nocodeId?: string
    taskId?: string
    scopeKey?: string
    source?: string
    content: string
    traceId?: string
    metadata?: Record<string, unknown> | null
  }) {
    let conversation = await this.conversationService.getOwnerConversation(
      options.accountId,
      options.conversationId,
    )

    if (!conversation) {
      const nocodeId = String(options.nocodeId || '').trim()
      if (!nocodeId) {
        throw new Error(global.i18next.t('nocodeEditorChatService.appendMessageMissingApp'))
      }
      conversation = await this.conversationService.ensureConversation({
        ownerAccountId: options.accountId,
        nocodeId,
        conversationId: options.conversationId,
        taskId: options.taskId,
        scopeKey: options.scopeKey,
        source: options.source,
        title: global.i18next.t('nocodeEditorChatService.defaultTitle'),
      })
    }

    const updatedAt = Date.now()
    const derivedTaskSummary = deriveNocodeEditorTaskSummaryFromExternalAssistantMessage({
      latestTaskSummary: conversation.taskSummary || null,
      metadata: options.metadata || null,
      updatedAt,
    })
    const persistedDerivedTaskSummary = derivedTaskSummary
      ? projectNocodeEditorTaskSummaryForProvider(derivedTaskSummary) as typeof derivedTaskSummary
      : null
    const role = this.normalizeExternalConversationMessageRole(options.role)
    const shouldAlignExternalAssistantMetadata = (
      role === AiMessageRole.ASSISTANT
      && Boolean(persistedDerivedTaskSummary)
    )
    const alignedPostFormMetadata = shouldAlignExternalAssistantMetadata && persistedDerivedTaskSummary
      ? {
        planningScope: persistedDerivedTaskSummary.planningScope ?? 'unknown',
        pendingFlowIntent: persistedDerivedTaskSummary.pendingFlowIntent ?? null,
        postFormFlowSignals: persistedDerivedTaskSummary.postFormFlowSignals ?? null,
        postFormFlowOpportunity: persistedDerivedTaskSummary.postFormFlowOpportunity ?? null,
        postFormFlowFollowUp: persistedDerivedTaskSummary.postFormFlowFollowUp ?? null,
        postFormFlowRelease: persistedDerivedTaskSummary.postFormFlowRelease ?? null,
      }
      : undefined
    const metadata = {
      scene: 'nocode-editor',
      taskId: options.taskId,
      taskScopeKey: options.scopeKey,
      taskSource: options.source,
      ...(options.metadata || {}),
      ...alignedPostFormMetadata,
      ...(persistedDerivedTaskSummary
        ? {
          taskSummary: persistedDerivedTaskSummary,
          blueprintApplyGate: persistedDerivedTaskSummary.blueprintApplyGate || undefined,
        }
        : {}),
    }
    const message = await this.conversationService.appendMessage(conversation, {
      role,
      traceId: options.traceId,
      content: String(options.content || '').trim(),
      metadata,
    })

    if (persistedDerivedTaskSummary) {
      await this.conversationService.updateConversationTaskSummary(
        options.accountId,
        conversation.id,
        persistedDerivedTaskSummary,
      )
    }

    return message
  }

  async appendExternalAssistantMessage(options: {
    accountId: string
    conversationId: string
    nocodeId?: string
    taskId?: string
    scopeKey?: string
    source?: string
    content: string
    traceId?: string
    metadata?: Record<string, unknown> | null
  }) {
    return await this.appendExternalConversationMessage({
      ...options,
      role: AiMessageRole.ASSISTANT,
    })
  }

  private normalizeExternalConversationMessageRole(value: unknown): AiMessageRole {
    return value === AiMessageRole.USER
      ? AiMessageRole.USER
      : AiMessageRole.ASSISTANT
  }

  private shouldAllowSameRoundBlueprintAfterCompletedPlanning(options: {
    call: AiActionCall
    latestUserMessage?: AiProviderMessage | null
    completedPlanningKind?: 'app-plan' | 'form-plan'
  }) {
    const input = options.call?.input && typeof options.call.input === 'object' && !Array.isArray(options.call.input)
      ? options.call.input as Record<string, unknown>
      : {}
    const metadata = options.latestUserMessage?.metadata && typeof options.latestUserMessage.metadata === 'object'
      ? options.latestUserMessage.metadata as Record<string, unknown>
      : {}
    const scenePayload = metadata.scenePayload && typeof metadata.scenePayload === 'object' && !Array.isArray(metadata.scenePayload)
      ? metadata.scenePayload as Record<string, unknown>
      : {}
    const planningContinuation = input.planningContinuation && typeof input.planningContinuation === 'object' && !Array.isArray(input.planningContinuation)
      ? input.planningContinuation as Record<string, unknown>
      : null

    if (options.completedPlanningKind === 'form-plan') {
      return true
    }
    if (metadata.autoBuilderRequirementKickoff === true) {
      return true
    }
    if (scenePayload.autoBuilderRequirementKickoff === true) {
      return true
    }
    if (input.latestCompletedPlanningConfirmation) {
      return true
    }
    if (
      planningContinuation?.autoContinueWithoutConfirmation === true
      && metadata.autoBuilderRequirementKickoff === true
    ) {
      return true
    }
    return false
  }

  private async executeClientToolCalls(
    calls: AiActionCall[],
    conversation: Pick<AiNocodeEditorConversationEntity, 'id' | 'ownerAccountId' | 'nocodeId' | 'title'>,
    traceId: string,
    emit: StreamChatOptions['emit'],
    round: number,
    successfulMutationSignatures: Set<string>,
    turnMessages: AiProviderMessage[],
    latestAppConversation: {
      id: string
      taskId?: string | null
      taskSummary?: Record<string, unknown> | null
    } | null,
    latestTaskSummary?: Record<string, unknown> | null,
    currentUserMessage?: AiProviderMessage | null,
    preToolAssistantText?: string,
    runtimeContext?: {
      accountId?: string
      accountName?: string
      providerId?: string
      modelId?: string
      model?: string
    },
    flowBlueprintPreflightActive = false,
    signal?: AbortSignal,
    formulaStageGate?: { ready: boolean },
    attachmentReadBudget: AiAttachmentReadBudget = { totalTextLength: 0 },
  ) {
    const results: AiActionResult[] = []
    const streamEmittedCallIds = new Set<string>()
    let remainingAssistantText = sanitizeNocodeEditorAssistantText(String(preToolAssistantText || '').trim())
    const latestUserMessage = currentUserMessage || [...turnMessages]
      .reverse()
      .find(item => item.role === AiMessageRole.USER)
    const recentUserMessages = [
      ...turnMessages,
      ...(currentUserMessage ? [currentUserMessage] : []),
    ]
      .filter(item => item.role === AiMessageRole.USER)
      .map(item => item.content)
    const latestScenePayload = latestUserMessage?.metadata?.scenePayload || {}
    const latestRequestMetadata = isRecord(latestUserMessage?.metadata?.requestMetadata)
      ? latestUserMessage.metadata.requestMetadata
      : {}
    const hasFlowPatchInBatch = (calls || []).some(call => (
      String(call?.name || '').trim() === 'editor_patch_flow'
    ))
    const hasFormulaStageInBatch = (calls || []).some(call => (
      String(call?.name || '').trim() === FORMULA_STAGE_TOOL_NAME
    ))
    const activeFormulaStageGate = formulaStageGate || { ready: false }
    let formulaStageAccepted = false
    let formulaStageOpenedThisBatch = false
    let formulaExecutorConsumedThisBatch = false
    for (const call of calls || []) {
      const toolName = String(call.name || '').trim()
      if (toolName === AI_READ_ATTACHMENT_TOOL_NAME) {
        let result: AiActionResult
        try {
          if (!this.attachmentService) throw new Error('AI_ATTACHMENT_PARSE_FAILED')
          result = {
            callId: call.id,
            name: call.name,
            kind: call.kind,
            ok: true,
            output: await this.attachmentService.readForModel(
              conversation.ownerAccountId,
              conversation.id,
              call.input,
              attachmentReadBudget,
            ),
            metadata: {
              executor: 'main-tool',
              scene: 'nocode-editor',
              round,
              input: call.input,
            },
          }
        } catch (error) {
          result = {
            callId: call.id,
            name: call.name,
            kind: call.kind,
            ok: false,
            error: error instanceof Error ? error.message : 'AI_ATTACHMENT_PARSE_FAILED',
            metadata: {
              executor: 'main-tool',
              scene: 'nocode-editor',
              round,
              input: call.input,
            },
          }
        }
        results.push(result)
        remainingAssistantText = await this.finalizeEarlyToolResult({
          call,
          result,
          conversation,
          traceId,
          round,
          turnMessages,
          emit,
          remainingAssistantText,
        })
        streamEmittedCallIds.add(result.callId)
        continue
      }
      const planningScopeToolGuard = resolvePlanningScopeToolGuard({
        planningScope: latestScenePayload?.planningScope,
        toolName,
      })
      if (planningScopeToolGuard.blocked) {
        const blockedResult = this.attachActionResultRound([{
          callId: call.id,
          name: call.name,
          kind: call.kind,
          ok: false,
          error: '当前需求的规划范围是单表单（form），不能调用 editor_stage_app_plan。请保留原需求中的 flowIntent 并重试正确的单表单规划工具；不要把新建应用容器理解为应用级规划。',
          metadata: {
            executor: 'server-guard',
            scene: 'nocode-editor',
            round,
            input: call.input,
            planningScope: planningScopeToolGuard.planningScope,
            blockedByPlanningScope: true,
            suppressPersistedSummary: true,
            suppressSummaryContent: true,
            suppressStreamBlocks: true,
          },
        }], round)[0]
        results.push(blockedResult)
        remainingAssistantText = await this.finalizeEarlyToolResult({
          call,
          result: blockedResult,
          conversation,
          traceId,
          round,
          turnMessages,
          emit,
          remainingAssistantText,
        })
        streamEmittedCallIds.add(blockedResult.callId)
        continue
      }
      const isMutatingEditorTool = (
        MUTATING_EDITOR_TOOL_NAMES.has(toolName)
        || toolName === FORMULA_STAGE_TOOL_NAME
      )
      if (
        toolName === 'editor_set_field_options'
        && hasFormulaSettingChanges(call.input)
      ) {
        const blockedResult = this.attachActionResultRound([{
          callId: call.id,
          name: call.name,
          kind: call.kind,
          ok: false,
          error: 'FORMULA_PLAN_REQUIRED',
          metadata: {
            executor: 'server-guard',
            scene: 'nocode-editor',
            round,
            formulaPlanRequired: true,
            suppressPersistedSummary: true,
            suppressSummaryContent: true,
            suppressStreamBlocks: true,
          },
        }], round)[0]
        results.push(blockedResult)
        remainingAssistantText = await this.finalizeEarlyToolResult({
          call,
          result: blockedResult,
          conversation,
          traceId,
          round,
          turnMessages,
          emit,
          remainingAssistantText,
        })
        streamEmittedCallIds.add(blockedResult.callId)
        continue
      }
      const formulaBatchAction = resolveNocodeEditorFormulaStageBatchAction({
        hasFormulaStage: hasFormulaStageInBatch,
        toolName,
        formulaStageAccepted,
        formulaStageGateReady: activeFormulaStageGate.ready,
        formulaStageOpenedThisBatch,
        formulaExecutorConsumedThisBatch,
        isMutatingEditorTool,
      })
      if (
        formulaBatchAction !== 'allow'
        && formulaBatchAction !== 'consume_formula_executor'
      ) {
        const blockedResult = this.attachActionResultRound([{
          callId: call.id,
          name: call.name,
          kind: call.kind,
          ok: false,
          error: formulaBatchAction === 'block_duplicate_stage'
            ? '同一轮只能暂存一次公式计划。'
            : formulaBatchAction === 'block_duplicate_executor'
              ? '当前批次已经调用过 editor_set_field_formulas，请在下一轮基于执行结果继续。'
            : formulaBatchAction === 'block_gate_mutation'
              ? '公式计划已就绪，请先调用 editor_set_field_formulas 完成唯一公式写入。'
            : '公式计划已进入预检执行链路，本轮不要调用字段新增、替换或设置工具。',
          metadata: {
            executor: 'server-guard',
            scene: 'nocode-editor',
            round,
            formulaStageBatchAction: formulaBatchAction,
            suppressPersistedSummary: true,
            suppressSummaryContent: true,
            suppressStreamBlocks: true,
          },
        }], round)[0]
        results.push(blockedResult)
        remainingAssistantText = await this.finalizeEarlyToolResult({
          call,
          result: blockedResult,
          conversation,
          traceId,
          round,
          turnMessages,
          emit,
          remainingAssistantText,
        })
        streamEmittedCallIds.add(blockedResult.callId)
        continue
      }
      if (toolName === FORMULA_STAGE_TOOL_NAME) {
        formulaStageAccepted = true
      }
      if (
        toolName === FORMULA_EXECUTOR_TOOL_NAME
        && !activeFormulaStageGate.ready
      ) {
        const blockedResult = this.attachActionResultRound([{
          callId: call.id,
          name: call.name,
          kind: call.kind,
          ok: false,
          error: '当前没有可执行的公式计划。请先调用 editor_stage_formula_plan，等待下一轮再调用 editor_set_field_formulas。',
          metadata: {
            executor: 'server-guard',
            scene: 'nocode-editor',
            round,
            formulaPlanRequired: true,
            suppressPersistedSummary: true,
            suppressSummaryContent: true,
            suppressStreamBlocks: true,
          },
        }], round)[0]
        results.push(blockedResult)
        remainingAssistantText = await this.finalizeEarlyToolResult({
          call,
          result: blockedResult,
          conversation,
          traceId,
          round,
          turnMessages,
          emit,
          remainingAssistantText,
        })
        streamEmittedCallIds.add(blockedResult.callId)
        continue
      }
      if (formulaBatchAction === 'consume_formula_executor') {
        formulaExecutorConsumedThisBatch = true
      }
      const preflightToolDecision = resolveFlowBlueprintPreflightToolDecision({
        active: flowBlueprintPreflightActive,
        toolName: String(call.name || '').trim(),
      })
      if (preflightToolDecision.kind === 'block') {
        const blockedResult = this.attachActionResultRound([{
          callId: call.id,
          name: call.name,
          kind: call.kind,
          ok: false,
          error: preflightToolDecision.error,
          metadata: {
            executor: 'server-guard',
            scene: 'nocode-editor',
            round,
            flowBlueprintPreflightBlocked: true,
            suppressPersistedSummary: true,
            suppressSummaryContent: true,
            suppressStreamBlocks: true,
          },
        }], round)[0]
        results.push(blockedResult)
        remainingAssistantText = await this.finalizeEarlyToolResult({
          call,
          result: blockedResult,
          conversation,
          traceId,
          round,
          turnMessages,
          emit,
          remainingAssistantText,
        })
        streamEmittedCallIds.add(blockedResult.callId)
        continue
      }

      const hasSuccessfulFlowPatch = results.some(result => (
        result?.ok && String(result?.name || '').trim() === 'editor_patch_flow'
      ))
      if (
        hasFlowPatchInBatch
        && [
          'editor_plan_flow_scheme',
          'editor_stage_flow_blueprint',
          'editor_apply_staged_flow',
        ].includes(String(call.name || '').trim())
      ) {
        const blockedResult = this.attachActionResultRound([{
          callId: call.id,
          name: call.name,
          kind: call.kind,
          ok: false,
          error: hasSuccessfulFlowPatch
            ? '本轮流程局部修改已经完成，不再继续生成或应用完整流程蓝图。'
            : '本批次同时包含流程局部修改，完整流程调用已延后；请先处理局部修改结果，并在需要时由下一轮重新调用。',
          metadata: {
            executor: 'server-guard',
            blockedAfterFlowPatchSuccess: hasSuccessfulFlowPatch || undefined,
            deferredForFlowPatchBatch: hasSuccessfulFlowPatch ? undefined : true,
            suppressPersistedSummary: true,
            suppressSummaryContent: true,
            suppressStreamBlocks: true,
          },
        }], round)[0]
        results.push(blockedResult)
        remainingAssistantText = await this.finalizeEarlyToolResult({
          call,
          result: blockedResult,
          conversation,
          traceId,
          round,
          turnMessages,
          emit,
          remainingAssistantText,
        })
        streamEmittedCallIds.add(blockedResult.callId)
        continue
      }

      // 这里单独拦截 editor_get_flow_node_examples。
      // 这个工具的数据完全在 main 侧，本质上只是把后端维护的节点示例喂给模型，
      // 不需要也不应该再走 client bridge。
      if (String(call.name || '').trim() === NOCODE_EDITOR_FLOW_NODE_EXAMPLE_TOOL_NAME) {
        const callMetadata = isRecord((call as any).metadata) ? (call as any).metadata : {}
        const flowBlueprintPreflightPhase = (
          (flowBlueprintPreflightActive
            ? this.resolveFlowBlueprintPreflightPhaseForToolCall(String(call.name || '').trim())
            : '')
          || normalizeText(callMetadata.flowBlueprintPreflightPhase)
        )
        // 虽然这个工具不走 client，但流事件里仍然补一条 TOOL_CALL，
        // 这样时间线、日志和后续调试视角仍然能看到“模型确实发起过这次工具调用”。
        this.emit(emit, {
          conversationId: conversation.id,
          event: AiStreamEventType.TOOL_CALL,
          metadata: {
            // 标记当前仍是 nocode-editor 场景。
            scene: 'nocode-editor',
            // 明确告诉上层：这次工具执行目标不是 client，而是 main。
            target: 'main',
            // 保留 actionId，和统一工具协议字段保持一致。
            actionId: call.id,
            // 保留 actionName，便于前端或日志侧直接识别工具名。
            actionName: call.name,
            // 透传工具 kind。
            kind: call.kind,
            // 透传模型这次传入的原始 input，方便排查 nodeTypes 请求内容。
            input: call.input,
            // 透传模型给出的调用理由。
            reason: call.reason,
            // 再补一份 toolName，兼容现有元数据消费方。
            toolName: call.name,
            // 再补一份 callId，兼容现有元数据消费方。
            callId: call.id,
            // 保留 traceId，把这次 main 工具调用串回当前对话链路。
            traceId,
            // 如果 call 上已经挂了额外 metadata，也一并透传，避免丢上下文。
            ...callMetadata,
            ...(flowBlueprintPreflightPhase
              ? { flowBlueprintPreflightPhase }
              : {}),
          },
        })

        // 判断当前 assistant 口播是否会被后续工具摘要替换。
        // 这会影响 continuity hint 的描述方式。
        const shouldShowSummaryReplacementNotice = hasVisibleAssistantNarrationBeforeSummaryReplacement(remainingAssistantText)
        // 构建 continuity hints，保持这次 main 工具结果和现有工具链在同一套承接语义里。
        const toolResultContinuityHints = buildNocodeEditorContinuityHints({
          // 当前会话 id。
          currentConversationId: conversation.id,
          // 如果存在最近应用会话，就把它带进 continuity hints，保持跨轮承接能力一致。
          latestAppConversation: latestAppConversation
            ? {
              // 最近应用会话 id。
              id: latestAppConversation.id,
              // 最近应用会话 taskId。
              taskId: latestAppConversation.taskId || '',
              // 最近应用会话 taskSummary。
              taskSummary: latestAppConversation.taskSummary || null,
            }
            : null,
          // 这里只是正常工具结果，不是“用摘要替换已有 assistant 正文”的特殊场景。
          summaryReplacesAssistantContent: false,
          // 把上面算出的提示位带进去。
          summaryReplacementNoticeVisible: shouldShowSummaryReplacementNotice,
        })
        // 直接在 main 侧执行这个工具，不再等待 client 返回。
        const toolResult = this.executeMainFlowNodeExamplesToolCall(call)
        // 把 main 侧返回结果包装成统一的 AiActionResult，
        // 这样下面的摘要生成、持久化、provider 上下文注入都可以复用原有链路。
        const result: AiActionResult = {
          // 当前工具调用 id。
          callId: call.id,
          // 当前工具名。
          name: call.name,
          // 当前工具 kind。
          kind: call.kind,
          // main 执行结果是否成功。
          ok: toolResult.ok,
          // main 执行返回的 output。
          output: toolResult.output,
          // main 执行失败时的错误信息。
          error: toolResult.error,
          metadata: {
            // 标记这次执行器来自 main，而不是 client。
            executor: 'main-tool',
            // 保持场景标签一致。
            scene: 'nocode-editor',
            // 记录轮次。
            round,
            // 原样挂回本次工具输入，方便后续摘要和调试。
            input: call.input,
            // 挂回 continuity hints。
            continuityHints: toolResultContinuityHints,
            // 透传 call 上原有 metadata。
            ...(isRecord((call as any).metadata) ? (call as any).metadata : {}),
            // 再并入 main 工具自身返回的 metadata。
            ...(toolResult.metadata || {}),
          },
        }
        // 把这次结果加入当前轮 results，后续 stop 条件和摘要生成都要依赖它。
        results.push(result)
        // 立刻走统一的 finalizeEarlyToolResult，
        // 让 tool message、隐藏 exchange message、stream tool result 都按既有规范写入。
        remainingAssistantText = await this.finalizeEarlyToolResult({
          // 当前调用。
          call,
          // 当前结果。
          result,
          // 当前会话对象。
          conversation,
          // 当前 traceId。
          traceId,
          // 当前轮次。
          round,
          // 当前轮 provider messages 容器。
          turnMessages,
          // stream emit 函数。
          emit,
          // 当前尚未消费的 assistant 文本。
          remainingAssistantText,
          // 显式传入 continuity hints，避免 finalizeEarlyToolResult 再自己兜底生成一次。
          continuityHints: toolResultContinuityHints,
        })
        // 标记这次 callId 已经发过结果，避免后续重复补发。
        streamEmittedCallIds.add(result.callId)
        // 这个调用已经在 main 侧完成，直接进入下一次 call。
        continue
      }

      if (String(call.name || '').trim() === 'editor_stage_app_blueprint') {
        const normalizedBlueprintInput = normalizeNocodeEditorBlueprintToolInput(call.input)
        if ('message' in normalizedBlueprintInput) {
          const blockedResult = this.attachActionResultRound([
            {
              callId: call.id,
              name: call.name,
              kind: call.kind,
              ok: false,
              error: normalizedBlueprintInput.message,
              metadata: {
                executor: 'server-guard',
                scene: 'nocode-editor',
                round,
                input: call.input,
                blueprintInputErrorCode: normalizedBlueprintInput.code,
              },
            },
          ], round)[0]
          results.push(blockedResult)
          remainingAssistantText = await this.finalizeEarlyToolResult({
            call,
            result: blockedResult,
            conversation,
            traceId,
            round,
            turnMessages,
            emit,
            remainingAssistantText,
          })
          streamEmittedCallIds.add(blockedResult.callId)
          continue
        }
        call.input = normalizedBlueprintInput.input
      }

      const duplicateSignature = this.buildMutationDuplicateSignature(call.name, call.input)
      if (String(call.name || '').trim() === 'editor_stage_app_blueprint') {
        const pendingPlanning = getLatestPendingPlanningResult(results)
        if (pendingPlanning) {
          const blockedResult = this.attachActionResultRound([
            {
              callId: call.id,
              name: call.name,
              kind: call.kind,
              ok: false,
              error: pendingPlanning.kind === 'form-plan'
                ? global.i18next.t('nocodeEditorChatService.formPlanPendingBeforeBlueprint')
                : global.i18next.t('nocodeEditorChatService.appPlanPendingBeforeBlueprint'),
              metadata: {
                executor: 'server-guard',
                scene: 'nocode-editor',
                round,
                input: call.input,
                blockedByPlanningConfirmation: true,
                blockedPlanningKind: pendingPlanning.kind,
              },
            },
          ], round)[0]
          results.push(blockedResult)
          remainingAssistantText = await this.finalizeEarlyToolResult({
            call,
            result: blockedResult,
            conversation,
            traceId,
            round,
            turnMessages,
            emit,
            remainingAssistantText,
          })
          streamEmittedCallIds.add(blockedResult.callId)
          continue
        }

        const completedPlanning = getLatestCompletedPlanningResult(results)
        if (
          completedPlanning
          && !this.shouldAllowSameRoundBlueprintAfterCompletedPlanning({
            call,
            latestUserMessage,
            completedPlanningKind: completedPlanning.kind,
          })
        ) {
          const blockedResult = this.attachActionResultRound([
            {
              callId: call.id,
              name: call.name,
              kind: call.kind,
              ok: false,
              error: completedPlanning.kind === 'form-plan'
                ? global.i18next.t('nocodeEditorChatService.formPlanConfirmBeforeBlueprint')
                : global.i18next.t('nocodeEditorChatService.appPlanConfirmBeforeBlueprint'),
              metadata: {
                executor: 'server-guard',
                scene: 'nocode-editor',
                round,
                input: call.input,
                blockedByPlanningConfirmation: true,
                blockedPlanningKind: completedPlanning.kind,
                blockedCompletedPlanning: true,
              },
            },
          ], round)[0]
          results.push(blockedResult)
          remainingAssistantText = await this.finalizeEarlyToolResult({
            call,
            result: blockedResult,
            conversation,
            traceId,
            round,
            turnMessages,
            emit,
            remainingAssistantText,
          })
          streamEmittedCallIds.add(blockedResult.callId)
          continue
        }

        const blockedBlueprintId = String(latestScenePayload?.pendingBlueprintBlockedBlueprintId || '').trim()
        const clarificationKind = String(latestScenePayload?.pendingBlueprintClarificationKind || '').trim()
        if (shouldBlockRestagingPendingBlueprintAfterApplyGate({
          userMessage: latestUserMessage?.content || '',
          recentUserMessages,
          blockedBlueprintId,
          currentBlueprintId: blockedBlueprintId,
          clarificationKind,
        })) {
          const blockedResult = this.attachActionResultRound([
            {
              callId: call.id,
              name: call.name,
              kind: call.kind,
              ok: false,
              error: global.i18next.t('nocodeEditorChatService.blueprintClarificationBeforeRefresh'),
              metadata: {
                executor: 'server-guard',
                scene: 'nocode-editor',
                round,
                input: call.input,
                blueprintClarificationRequired: true,
                blueprintClarificationKind: clarificationKind || 'planning-question',
                blockedBlueprintId,
                planningConvergenceLateQuestions: clarificationKind === 'planning-question'
                  ? getLatestPlanningConvergenceLateQuestions(results)
                  : [],
              },
            },
          ], round)[0]
          results.push(blockedResult)
          remainingAssistantText = await this.finalizeEarlyToolResult({
            call,
            result: blockedResult,
            conversation,
            traceId,
            round,
            turnMessages,
            emit,
            remainingAssistantText,
          })
          streamEmittedCallIds.add(blockedResult.callId)
          continue
        }
      }
      if (String(call.name || '').trim() === 'editor_apply_staged_app_blueprint') {
        const pendingPlanning = getLatestPendingPlanningResult(results)
        if (pendingPlanning) {
          const blockedResult = this.attachActionResultRound([
            {
              callId: call.id,
              name: call.name,
              kind: call.kind,
              ok: false,
              error: pendingPlanning.kind === 'form-plan'
                ? global.i18next.t('nocodeEditorChatService.formPlanPendingBeforeApply')
                : global.i18next.t('nocodeEditorChatService.appPlanPendingBeforeApply'),
              metadata: {
                executor: 'server-guard',
                scene: 'nocode-editor',
                round,
                input: call.input,
                blockedByPlanningConfirmation: true,
                blockedPlanningKind: pendingPlanning.kind,
              },
            },
          ], round)[0]
          results.push(blockedResult)
          remainingAssistantText = await this.finalizeEarlyToolResult({
            call,
            result: blockedResult,
            conversation,
            traceId,
            round,
            turnMessages,
            emit,
            remainingAssistantText,
          })
          streamEmittedCallIds.add(blockedResult.callId)
          continue
        }

        if (shouldBlockBlueprintApplyForPlanningConvergence(results)) {
          const planningConvergenceLateQuestions = getLatestPlanningConvergenceLateQuestions(results)
          const blockedResult = this.attachActionResultRound([
            {
              callId: call.id,
              name: call.name,
              kind: call.kind,
              ok: false,
              error: global.i18next.t('nocodeEditorChatService.planPendingBeforeApply'),
              metadata: {
                executor: 'server-guard',
                scene: 'nocode-editor',
                round,
                input: call.input,
                planningConvergenceLateQuestions,
                blockedByPlanningConvergence: true,
              },
            },
          ], round)[0]
          results.push(blockedResult)
          remainingAssistantText = await this.finalizeEarlyToolResult({
            call,
            result: blockedResult,
            conversation,
            traceId,
            round,
            turnMessages,
            emit,
            remainingAssistantText,
          })
          streamEmittedCallIds.add(blockedResult.callId)
          continue
        }

        const gateDecision = shouldBlockAgentBlueprintApply({
          history: turnMessages,
          roundResults: results,
        })
        if (gateDecision.blocked) {
          const blockedResult = this.attachActionResultRound([
            {
              callId: call.id,
              name: call.name,
              kind: call.kind,
              ok: false,
              error: global.i18next.t('nocodeEditorChatService.blueprintCannotApply'),
              metadata: {
                executor: 'server-guard',
                scene: 'nocode-editor',
                round,
                input: call.input,
                blueprintApplyGate: gateDecision.gate,
              },
            },
          ], round)[0]
          results.push(blockedResult)
          remainingAssistantText = await this.finalizeEarlyToolResult({
            call,
            result: blockedResult,
            conversation,
            traceId,
            round,
            turnMessages,
            emit,
            remainingAssistantText,
          })
          streamEmittedCallIds.add(blockedResult.callId)
          continue
        }
      }
      if (String(call.name || '').trim() === 'editor_apply_staged_flow') {
        const flowApplyDecision = shouldBlockAgentFlowApply({
          latestUserMessage: latestUserMessage?.content || '',
          latestTaskSummary,
          roundResults: results,
        })
        if (flowApplyDecision.blocked) {
          const shouldSuppressBlockedFlowApplySummary = !flowApplyDecision.userExpressedApplyIntent
          const blockedResult = this.attachActionResultRound([
            {
              callId: call.id,
              name: call.name,
              kind: call.kind,
              ok: false,
              error: flowApplyDecision.reason === 'pending_flow_confirmation'
                ? global.i18next.t('nocodeEditorChatService.flowPendingBeforeApply')
                : flowApplyDecision.reason === 'confirmation_reply_only'
                  ? global.i18next.t('nocodeEditorChatService.flowConfirmationOnly')
                  : flowApplyDecision.reason === 'no_staged_flow'
                    ? global.i18next.t('nocodeEditorChatService.noFlowBlueprintToApply')
                    : global.i18next.t('nocodeEditorChatService.flowBlueprintCannotApply'),
              metadata: {
                executor: 'server-guard',
                scene: 'nocode-editor',
                round,
                input: call.input,
                blockedByFlowApplyAuthorization: true,
                flowApplyBlockedReason: flowApplyDecision.reason,
                suppressPersistedSummary: shouldSuppressBlockedFlowApplySummary || undefined,
                suppressSummaryContent: shouldSuppressBlockedFlowApplySummary || undefined,
                suppressStreamBlocks: shouldSuppressBlockedFlowApplySummary || undefined,
                suppressedIntermediateSummary: shouldSuppressBlockedFlowApplySummary || undefined,
              },
            },
          ], round)[0]
          results.push(blockedResult)
          remainingAssistantText = await this.finalizeEarlyToolResult({
            call,
            result: blockedResult,
            conversation,
            traceId,
            round,
            turnMessages,
            emit,
            remainingAssistantText,
          })
          streamEmittedCallIds.add(blockedResult.callId)
          continue
        }
      }

      if (duplicateSignature && successfulMutationSignatures.has(duplicateSignature)) {
        const duplicateResult = this.attachActionResultRound([
          {
            callId: call.id,
            name: call.name,
            kind: call.kind,
            ok: false,
            error: '当前轮次里同一项修改已经成功执行过。不要再次执行；请直接基于已完成结果回复用户。',
            metadata: {
              executor: 'client-tool',
              scene: 'nocode-editor',
              duplicateBlocked: true,
              duplicateSignature,
              input: call.input,
            },
          },
        ], round)[0]
        results.push(duplicateResult)
        remainingAssistantText = await this.finalizeEarlyToolResult({
          call,
          result: duplicateResult,
          conversation,
          traceId,
          round,
          turnMessages,
          emit,
          remainingAssistantText,
        })
        streamEmittedCallIds.add(duplicateResult.callId)
        continue
      }

      const callMetadata = isRecord((call as any).metadata) ? (call as any).metadata : {}
      const flowSchemeConfirmationContext = String(call.name || '').trim() === 'editor_plan_flow_scheme'
        ? buildFlowSchemeConfirmationContextForClientToolCall({
          latestTaskSummary,
          activeFormId: latestScenePayload?.activeFormId,
          activeFormName: latestScenePayload?.activeFormName,
          continuationPlanningContextKey: latestRequestMetadata.flowPlanningContextKey,
        })
        : null
      const flowBlueprintPreflightPhase = (
        (flowBlueprintPreflightActive
          ? this.resolveFlowBlueprintPreflightPhaseForToolCall(String(call.name || '').trim())
          : '')
        || normalizeText(callMetadata.flowBlueprintPreflightPhase)
      )
      this.emit(emit, {
        conversationId: conversation.id,
        event: AiStreamEventType.TOOL_CALL,
        metadata: {
          scene: 'nocode-editor',
          target: 'client',
          actionId: call.id,
          actionName: call.name,
          kind: call.kind,
          input: call.input,
          reason: call.reason,
          toolName: call.name,
          callId: call.id,
          traceId,
          ...callMetadata,
          ...(flowSchemeConfirmationContext
            ? { flowSchemeConfirmationContext }
            : {}),
          ...(flowBlueprintPreflightPhase
            ? { flowBlueprintPreflightPhase }
            : {}),
        },
      })

      const toolResult = await this.clientToolBridge.waitForResult(conversation.id, call.id, {
        signal,
      })
      const shouldShowSummaryReplacementNotice = hasVisibleAssistantNarrationBeforeSummaryReplacement(remainingAssistantText)
      const toolResultContinuityHints = buildNocodeEditorContinuityHints({
        currentConversationId: conversation.id,
        latestAppConversation: latestAppConversation
          ? {
            id: latestAppConversation.id,
            taskId: latestAppConversation.taskId || '',
            taskSummary: latestAppConversation.taskSummary || null,
          }
          : null,
        summaryReplacesAssistantContent: false,
        summaryReplacementNoticeVisible: shouldShowSummaryReplacementNotice,
      })
      const result: AiActionResult = {
        callId: call.id,
        name: call.name,
        kind: call.kind,
        ok: toolResult.ok,
        output: toolResult.output,
        error: toolResult.error,
        metadata: {
          executor: 'client-tool',
          scene: 'nocode-editor',
          round,
          input: call.input,
          continuityHints: toolResultContinuityHints,
          ...(isRecord((call as any).metadata) ? (call as any).metadata : {}),
          ...(toolResult.metadata || {}),
        },
      }
      if (!result.ok) {
        result.metadata = {
          ...(result.metadata || {}),
          editorMode: latestScenePayload?.mode,
          activeFormId: String(latestScenePayload?.activeFormId || '').trim() || undefined,
          activeFormName: String(latestScenePayload?.activeFormName || '').trim() || undefined,
        }
        if (normalizeText(result.error).toLowerCase() === 'formula_context_stale') {
          result.error = 'FORMULA_CONTEXT_STALE'
          result.metadata = {
            ...(result.metadata || {}),
            formulaContextRefreshRequired: true,
            requiredContextTools: [
              'editor_get_current_task_context',
              'editor_get_form_summary',
            ],
          }
        }
      }

      if (result.ok) {
        const planningScope = resolvePlanningResultIndustrySkeletonScope({
          toolName: result.name,
          userMessage: latestUserMessage?.content || '',
          scenePayload: latestScenePayload as UnknownRecord,
        })
        if (planningScope) {
          const inheritedCarryover = resolveNocodeEditorIndustrySkeletonCarryover(
            latestScenePayload?.industrySkeletonContext,
          )
          const planningContext = resolveNocodeEditorIndustrySkeletonPlanningContext({
            userMessage: latestUserMessage?.content || '',
            scope: planningScope,
            carryover: inheritedCarryover,
          })

          let nextCarryover = planningContext.carryover
          if (!nextCarryover) {
            const nextMatch = matchNocodeEditorIndustrySkeletons(latestUserMessage?.content || '')[0]
            nextCarryover = buildNocodeEditorIndustrySkeletonCarryover({
              match: nextMatch,
              scope: planningScope,
            })
          }

          if (nextCarryover) {
            result.metadata = {
              ...(result.metadata || {}),
              industrySkeletonContext: nextCarryover,
            }
          }
        }
      }

      if (result.ok && result.name === 'editor_stage_app_blueprint') {
        const scenePayload = latestUserMessage?.metadata?.scenePayload || {}
        const previousGate = getLatestPendingBlueprintApplyGate({
          history: turnMessages,
          roundResults: results,
        })
        const blueprintApplyGate = resolveBlueprintApplyGateForStage({
          userMessage: latestUserMessage?.content || '',
          recentUserMessages,
          editorMode: scenePayload?.mode,
          activeFormId: String(scenePayload?.activeFormId || '').trim() || undefined,
          previousGate,
          stageOutput: {
            revision: result.output?.revision,
            stagedAt: result.output?.stagedAt,
          },
        })
        if (blueprintApplyGate) {
          result.metadata = {
            ...(result.metadata || {}),
            blueprintApplyGate,
          }
        }
        markPlanningConvergenceLateQuestionsOnRoundResults({
          results: [...results, result],
          latestTaskSummary,
        })
      }

      if (result.ok && result.name === 'editor_apply_staged_app_blueprint') {
        const pendingGate = getLatestPendingBlueprintApplyGate({
          history: turnMessages,
          roundResults: results,
        })
        if (pendingGate) {
          result.metadata = {
            ...(result.metadata || {}),
            blueprintApplyGate: {
              ...pendingGate,
              status: 'consumed',
              consumedBy: 'ai_apply_success',
            },
          }
        }
      }

      await this.conversationService.appendMessage(conversation, {
        role: AiMessageRole.TOOL,
        traceId,
        content: this.buildToolMessageContent(result),
        metadata: {
          actionId: result.callId,
          kind: result.kind,
          ok: result.ok,
          error: result.error,
          round,
          scene: 'nocode-editor',
          traceId,
        },
      })

      const hiddenToolExchangeMessages = this.buildModelToolExchangeMessages(
        call,
        result,
        round,
        traceId,
        remainingAssistantText,
      )
      for (const hiddenMessage of hiddenToolExchangeMessages) {
        await this.conversationService.appendMessage(conversation, {
          role: hiddenMessage.role,
          traceId,
          content: hiddenMessage.content,
          metadata: hiddenMessage.metadata || null,
        })
      }
      remainingAssistantText = ''
      results.push(result)
      if (result.ok && duplicateSignature) {
        successfulMutationSignatures.add(duplicateSignature)
      }
      hiddenToolExchangeMessages.forEach(message => {
        turnMessages.push(message)
      })

      if (result.ok && result.name === FORMULA_STAGE_TOOL_NAME) {
        formulaStageOpenedThisBatch = true
        activeFormulaStageGate.ready = result.output?.formulaAdvance === 'continue_apply'
      }

    }
    if (formulaExecutorConsumedThisBatch) {
      activeFormulaStageGate.ready = false
    }
    return {
      results: this.attachActionResultRound(results, round),
      streamEmittedCallIds,
    }
  }

  private resolveFlowBlueprintPreflightPhaseForToolCall(toolName: string) {
    if (toolName === 'editor_get_flow_summary') {
      return 'summary'
    }
    if (toolName === NOCODE_EDITOR_FLOW_NODE_EXAMPLE_TOOL_NAME) {
      return 'examples'
    }
    if (toolName === 'editor_stage_flow_blueprint') {
      return 'waiting_blueprint'
    }
    return ''
  }

  private async persistFlowBlueprintPreflightCheckpoint(options: {
    accountId: string
    conversation: AiNocodeEditorConversationEntity
    latestTaskSummary?: Record<string, unknown> | null
    latestAction: string
    state: FlowBlueprintPreflightState
  }) {
    const currentTaskSummary = isRecord(options.conversation.taskSummary)
      ? options.conversation.taskSummary
      : {}
    const latestTaskSummary = isRecord(options.latestTaskSummary)
      ? options.latestTaskSummary
      : {}
    const updatedAt = Date.now()
    const persistedConversation = await this.conversationService.updateConversationTaskSummary(
      options.accountId,
      options.conversation.id,
      {
        ...currentTaskSummary,
        ...latestTaskSummary,
        flowBlueprintPreflightActive: true,
        flowBlueprintPreflightPhase: options.state.phase,
        flowBlueprintPreflightSchemeRevision: options.state.schemeRevision,
        flowBlueprintPreflightSummaryRefreshCount: options.state.summaryRefreshCount,
        flowBlueprintPreflightNodeExampleFetchCount: options.state.nodeExampleFetchCount,
        flowBlueprintPreflightUpdatedAt: options.state.lastProgressAt,
        latestAction: options.latestAction,
        updatedAt,
      },
    )
    if (persistedConversation) {
      options.conversation.taskSummary = persistedConversation.taskSummary
    }
  }

  private async finalizeEarlyToolResult(options: {
    call: AiActionCall
    result: AiActionResult
    conversation: Pick<AiNocodeEditorConversationEntity, 'id' | 'ownerAccountId' | 'nocodeId' | 'title'>
    traceId: string
    round: number
    turnMessages: AiProviderMessage[]
    emit: StreamChatOptions['emit']
    remainingAssistantText: string
    continuityHints?: NocodeEditorContinuityHint[]
  }) {
    const persistedResult = this.toPersistedToolResult(options.result)
    await this.conversationService.appendMessage(options.conversation, {
      role: AiMessageRole.TOOL,
      traceId: options.traceId,
      content: this.buildToolMessageContent(persistedResult),
      metadata: {
        actionId: persistedResult.callId,
        kind: persistedResult.kind,
        ok: persistedResult.ok,
        error: persistedResult.error,
        round: options.round,
        scene: 'nocode-editor',
        traceId: options.traceId,
      },
    })

    const hiddenMessages = this.buildModelToolExchangeMessages(
      options.call,
      options.result,
      options.round,
      options.traceId,
      options.remainingAssistantText,
    )
    const persistedHiddenMessages = this.buildModelToolExchangeMessages(
      options.call,
      persistedResult,
      options.round,
      options.traceId,
      options.remainingAssistantText,
    )
    for (const hiddenMessage of persistedHiddenMessages) {
      await this.conversationService.appendMessage(options.conversation, {
        role: hiddenMessage.role,
        traceId: options.traceId,
        content: hiddenMessage.content,
        metadata: hiddenMessage.metadata || null,
      })
    }

    hiddenMessages.forEach(message => {
      options.turnMessages.push(message)
    })

    this.emit(options.emit, {
      conversationId: options.conversation.id,
      event: AiStreamEventType.TOOL_RESULT,
      metadata: buildNocodeEditorToolResultStreamMetadata({
        result: persistedResult,
        traceId: options.traceId,
        continuityHints: Array.isArray(options.continuityHints)
          ? options.continuityHints
          : buildNocodeEditorContinuityHints({
            currentConversationId: options.conversation.id,
            latestAppConversation: null,
            summaryReplacesAssistantContent: false,
          }),
      }),
    })

    return ''
  }

  private toPersistedToolResult(result: AiActionResult): AiActionResult {
    if (result.name !== AI_READ_ATTACHMENT_TOOL_NAME || !result.output || typeof result.output !== 'object') {
      return result
    }
    const reference = { ...(result.output as Record<string, unknown>) }
    delete reference.content
    return {
      ...result,
      output: {
        ...reference,
        historical: true,
        contentOmitted: true,
      },
    }
  }

  private async appendToolResultAssistantMessages(options: {
    results: AiActionResult[]
    conversation: Pick<AiNocodeEditorConversationEntity, 'id' | 'ownerAccountId' | 'nocodeId' | 'title'>
    traceId: string
    round: number
    turnMessages: AiProviderMessage[]
  }) {
    type PersistedToolResultSummaryEntry = {
      sourceResult: AiActionResult
      summary: NonNullable<ReturnType<typeof buildNocodeEditorToolResultAssistantMessage>>
      actionIds: string[]
    }

    let count = 0
    let visibleCount = 0
    const visibleContents: string[] = []
    const summaryEntries: PersistedToolResultSummaryEntry[] = []
    let pendingFormulaResults: AiActionResult[] = []

    const flushPendingFormulaResults = () => {
      if (!pendingFormulaResults.length) {
        return
      }

      const mergedSummary = buildNocodeEditorMergedFormulaResultAssistantMessage(pendingFormulaResults)
      if (mergedSummary) {
        summaryEntries.push({
          sourceResult: pendingFormulaResults[0],
          summary: mergedSummary as PersistedToolResultSummaryEntry['summary'],
          actionIds: pendingFormulaResults
            .map(item => String(item?.callId || '').trim())
            .filter(Boolean),
        })
      }
      pendingFormulaResults = []
    }

    const deferredSummaries: DeferredNocodeEditorToolResultSummary[] = []
    for (const result of options.results || []) {
      if (result?.metadata?.suppressPersistedSummary) {
        continue
      }
      if (
        String(result?.name || '').trim() === 'editor_apply_staged_flow'
        && result?.metadata?.clientRenderedToolResult === true
      ) {
        continue
      }
      if (isFormulaResultToolResult(result)) {
        pendingFormulaResults.push(result)
        continue
      }
      const toolResultContinuityHints = Array.isArray(result?.metadata?.continuityHints)
        ? result.metadata.continuityHints as NocodeEditorContinuityHint[]
        : []
      const summary = buildNocodeEditorToolResultAssistantMessage(result, {
        continuityHints: toolResultContinuityHints,
      })
      if (!summary) {
        continue
      }

      if (!summary.metadata?.hiddenFromTimeline) {
        flushPendingFormulaResults()
      }

      summaryEntries.push({
        sourceResult: result,
        summary,
        actionIds: [String(result?.callId || '').trim()].filter(Boolean),
      })
    }

    flushPendingFormulaResults()

    for (const entry of summaryEntries) {
      const result = entry.sourceResult
      const summary = entry.summary
      const metadata: Record<string, unknown> = {
        ...(summary.metadata || {}),
        round: options.round,
        scene: 'nocode-editor',
        traceId: options.traceId,
        actionId: result.callId,
        ...(entry.actionIds.length > 1 ? { actionIds: entry.actionIds } : {}),
        kind: result.kind,
        summaryStage: summary.metadata?.summaryStage || resolveNocodeEditorToolResultSummaryStage(result),
      }

      if (result?.metadata?.deferredIntermediateSummary) {
        const hiddenMetadata = {
          ...metadata,
          hiddenFromTimeline: true,
          deferredIntermediateSummary: true,
        }
        options.turnMessages.push({
          role: AiMessageRole.ASSISTANT,
          content: summary.content,
          metadata: hiddenMetadata,
        })
        deferredSummaries.push({
          result,
          content: summary.content,
          metadata,
        })
        count += 1
        continue
      }

      await this.conversationService.appendMessage(options.conversation, {
        role: AiMessageRole.ASSISTANT,
        traceId: options.traceId,
        content: summary.content,
        metadata,
      })

      options.turnMessages.push({
        role: AiMessageRole.ASSISTANT,
        content: summary.content,
        metadata,
      })
      count += 1
      if (!metadata.hiddenFromTimeline) {
        visibleCount += 1
        visibleContents.push(summary.content)
      }
    }
    return {
      count,
      visibleCount,
      visibleContents,
      deferredSummaries,
    }
  }

  private markDeferredIntermediateAppPlanSummaries(results: AiActionResult[]) {
    for (const result of results || []) {
      if (!isCompletedNocodeEditorAppPlanResult(result)) {
        continue
      }
      result.metadata = {
        ...(result.metadata || {}),
        deferredIntermediateSummary: true,
      }
    }
  }

  private suppressIntermediateFlowStageSummaries(results: AiActionResult[]) {
    if (!Array.isArray(results) || !results.length) {
      return
    }

    const hasSuccessfulFlowApply = results.some(result => (
      result?.ok
      && String(result?.name || '').trim() === 'editor_apply_staged_flow'
    ))
    if (!hasSuccessfulFlowApply) {
      return
    }

    for (const result of results) {
      if (!result?.ok || String(result?.name || '').trim() !== 'editor_stage_flow_blueprint') {
        continue
      }

      result.metadata = {
        ...(result.metadata || {}),
        suppressPersistedSummary: true,
        suppressSummaryContent: true,
        suppressStreamBlocks: true,
        suppressedIntermediateSummary: true,
      }
    }
  }

  private suppressIntermediateFlowSchemeSummaries(results: AiActionResult[], enabled: boolean) {
    if (!Array.isArray(results) || !results.length) {
      return
    }

    if (!enabled || !hasSuccessfulFlowSchemeReadyForReview(results)) {
      return
    }

    for (const result of results) {
      if (!result?.ok || String(result?.name || '').trim() !== 'editor_plan_flow_scheme') {
        continue
      }

      result.metadata = {
        ...(result.metadata || {}),
        suppressPersistedSummary: true,
        suppressSummaryContent: true,
        suppressStreamBlocks: true,
        suppressedIntermediateSummary: true,
      }
    }
  }

  private async materializeDeferredToolResultAssistantSummaries(options: {
    summaries: DeferredNocodeEditorToolResultSummary[]
    conversation: Pick<AiNocodeEditorConversationEntity, 'id' | 'ownerAccountId' | 'nocodeId' | 'title'>
    traceId: string
  }) {
    let visibleCount = 0
    const visibleContents: string[] = []
    for (const summary of options.summaries || []) {
      if (summary.result?.metadata?.suppressPersistedSummary) {
        continue
      }

      const metadata = {
        ...(summary.metadata || {}),
      } as Record<string, unknown>
      delete metadata.hiddenFromTimeline
      delete metadata.deferredIntermediateSummary

      await this.conversationService.appendMessage(options.conversation, {
        role: AiMessageRole.ASSISTANT,
        traceId: options.traceId,
        content: summary.content,
        metadata,
      })
      visibleCount += 1
      visibleContents.push(summary.content)
    }

    return {
      visibleCount,
      visibleContents,
    }
  }

  private isEquivalentAssistantNarration(left: string, right: string) {
    const normalize = (value: string) => sanitizeNocodeEditorAssistantText(String(value || '').trim())
      .replace(/\s+/g, ' ')
      .trim()

    const normalizedLeft = normalize(left)
    const normalizedRight = normalize(right)
    return Boolean(normalizedLeft) && normalizedLeft === normalizedRight
  }

  private emitToolResultStreamMetadata(options: {
    results: AiActionResult[]
    conversationId: string
    traceId: string
    emit: StreamChatOptions['emit']
  }) {
    for (const result of mergeNocodeEditorFormulaToolResultsForStream(options.results || [])) {
      const toolResultContinuityHints = Array.isArray(result?.metadata?.continuityHints)
        ? result.metadata.continuityHints as NocodeEditorContinuityHint[]
        : []
      this.emit(options.emit, {
        conversationId: options.conversationId,
        event: AiStreamEventType.TOOL_RESULT,
        metadata: buildNocodeEditorToolResultStreamMetadata({
          result,
          traceId: options.traceId,
          continuityHints: toolResultContinuityHints,
        }),
      })
    }
  }

  private handleRelayChunk(options: {
    chunk: AiRelayStreamEvent
    conversationId: string
    traceId: string
    emit: StreamChatOptions['emit']
    onDelta: (text: string) => string | null | undefined
    onActionCall: (call: AiActionCall) => void
    onUsage: (usage: AiTokenUsage) => void
    onFinishReason: (reason: string) => void
    onResponseMetadata?: (metadata: Record<string, unknown> | null) => void
  }) {
    const { chunk, conversationId, traceId, emit, onDelta, onActionCall, onUsage, onFinishReason, onResponseMetadata } = options

    if (chunk.type === AiStreamEventType.DELTA) {
      const visibleText = onDelta(chunk.text)
      if (visibleText) {
        this.emit(emit, {
          conversationId,
          event: AiStreamEventType.DELTA,
          text: visibleText,
          metadata: {
            scene: 'nocode-editor',
            traceId,
          },
        })
      }
      return
    }

    if (chunk.type === AiStreamEventType.ACTION_CALL) {
      onActionCall(chunk.action)
      return
    }

    if (chunk.type === AiStreamEventType.ERROR) {
      throw new Error(chunk.error)
    }

    if (chunk.type === AiStreamEventType.DONE) {
      onUsage(this.normalizeUsage(chunk.usage))
      onFinishReason(chunk.finishReason || 'stop')
      onResponseMetadata?.(chunk.raw && typeof chunk.raw === 'object' ? chunk.raw : null)
    }
  }

  private buildLostToolIntentFallback(options: {
    responseMetadata?: Record<string, any> | null
  }) {
    const invalidToolCalls = Array.isArray(options.responseMetadata?.invalidToolCalls)
      ? options.responseMetadata?.invalidToolCalls
      : []
    const toolName = String(invalidToolCalls[0]?.name || invalidToolCalls[0]?.function?.name || '').trim()

    const assistantText = (() => {
      if (toolName === 'editor_stage_single_form_plan') {
        return [
          global.i18next.t('nocodeEditorChatService.formPlanStructureFailed'),
          global.i18next.t('nocodeEditorChatService.formPlanRetryHint'),
        ].join('\n')
      }
      if (toolName === 'editor_stage_app_plan') {
        return [
          global.i18next.t('nocodeEditorChatService.appPlanStructureFailed'),
          global.i18next.t('nocodeEditorChatService.appPlanRetryHint'),
        ].join('\n')
      }
      if (toolName === 'editor_stage_app_blueprint') {
        return [
          global.i18next.t('nocodeEditorChatService.blueprintStructureFailed'),
          global.i18next.t('nocodeEditorChatService.blueprintRetryHint'),
        ].join('\n')
      }
      return global.i18next.t('nocodeEditorChatService.executableStructureMissing')
    })()

    return {
      finishReason: 'tool_intent_lost_after_invalid_tool_call',
      assistantText,
      blocks: [],
      metadata: {
        toolIntentLost: true,
        toolIntentLostReason: 'tool_call_repair_failed_after_retry',
        toolIntentLostToolName: toolName || undefined,
      },
    }
  }

  private shouldTreatAsLostToolIntent(options: {
    finishReason: string
    pendingCalls: AiActionCall[]
    responseMetadata?: Record<string, unknown> | null
    latestRoundAssistantText?: string
    actionResults?: AiActionResult[]
  }) {
    if (Array.isArray(options.pendingCalls) && options.pendingCalls.length > 0) {
      return false
    }

    const finishReason = String(options.finishReason || '').trim().toLowerCase()
    const latestRoundAssistantText = sanitizeNocodeEditorAssistantText(
      String(options.latestRoundAssistantText || '').trim(),
    )
    const invalidToolCallCount = Number(options.responseMetadata?.invalidToolCallCount || 0)
    const toolCallRepairAttempted = options.responseMetadata?.toolCallRepairAttempted === true
    const hasVisibleText = Boolean(latestRoundAssistantText)
    const hasMeaningfulResolvedResult = (options.actionResults || []).some((result) => {
      if (!result?.ok) {
        return false
      }
      const toolName = String(result.name || '').trim()
      return MUTATING_EDITOR_TOOL_NAMES.has(toolName) || !isNocodeEditorHiddenTimelineTool(toolName)
    })

    if (finishReason === 'tool_calls') {
      return invalidToolCallCount > 0 || toolCallRepairAttempted || !hasVisibleText
    }

    if (hasVisibleText) {
      return false
    }

    if (invalidToolCallCount > 0 || toolCallRepairAttempted) {
      return true
    }

    if (finishReason !== 'stop') {
      return true
    }

    return !hasMeaningfulResolvedResult
  }

  private getUnsupportedBlueprintVisibleTailBufferLength(value: string) {
    const normalizedValue = String(value || '')
    const maxPrefixLength = Math.min(
      normalizedValue.length,
      UNSUPPORTED_BLUEPRINT_PROTOCOL_FENCE_START.length - 1,
    )

    for (let prefixLength = maxPrefixLength; prefixLength > 0; prefixLength -= 1) {
      if (
        normalizedValue.endsWith(UNSUPPORTED_BLUEPRINT_PROTOCOL_FENCE_START.slice(0, prefixLength))
      ) {
        return prefixLength
      }
    }

    return 0
  }

  private buildContextSnapshot(
    options: StreamChatOptions,
    request: AiChatRequest,
    actions: AiActionDefinition[],
  ): AiContextSnapshot {
    const appOverview = request.scenePayload?.nocodeId
      ? {
        id: request.scenePayload.nocodeId,
        name: request.scenePayload.nocodeId,
      }
      : null

    return {
      accountId: options.accountId,
      accountName: options.accountName,
      nocodeId: request.scenePayload?.nocodeId,
      promptVersion: request.promptVersion || 'v1',
      appOverview,
      formSummaries: [],
      actionSummary: actions.map(item => ({
        name: item.name,
        kind: item.kind,
        description: item.description,
      })),
      conversationHints: {
        preferredLanguage: resolveCurrentAiLanguage(),
        scene: 'nocode-editor',
      },
      metadata: {
        scenePayload: request.scenePayload || null,
      },
    }
  }

  private attachActionResultRound(
    results: AiActionResult[],
    round: number,
  ): AiActionResult[] {
    return results.map(result => ({
      ...result,
      metadata: {
        ...(result.metadata || {}),
        round,
      },
    }))
  }

  private shouldStopAfterDuplicateOnlyRound(results: AiActionResult[]) {
    return Array.isArray(results)
      && results.length > 0
      && results.every(result => Boolean(result?.metadata?.duplicateBlocked))
  }

  private shouldStopAfterBlueprintStageRound(results: AiActionResult[]) {
    if (!Array.isArray(results) || !results.length) {
      return false
    }

    const hasSuccessfulBlueprintStage = results.some(result => (
      result?.ok
      && String(result?.name || '').trim() === 'editor_stage_app_blueprint'
    ))
    if (!hasSuccessfulBlueprintStage) {
      return false
    }

    const hasApplyActionInSameRound = results.some(result => (
      String(result?.name || '').trim() === 'editor_apply_staged_app_blueprint'
    ))

    return !hasApplyActionInSameRound
  }

  private shouldStopAfterFlowStageRound(results: AiActionResult[]) {
    if (!Array.isArray(results) || !results.length) {
      return false
    }

    const hasSuccessfulFlowStage = results.some(result => (
      result?.ok
      && String(result?.name || '').trim() === 'editor_stage_flow_blueprint'
    ))
    if (!hasSuccessfulFlowStage) {
      return false
    }

    const hasSuccessfulApplyActionInSameRound = results.some(result => (
      result?.ok
      && String(result?.name || '').trim() === 'editor_apply_staged_flow'
    ))

    return !hasSuccessfulApplyActionInSameRound
  }

  private shouldStopAfterFlowPatchRound(results: AiActionResult[]) {
    return Array.isArray(results)
      && results.some(result => (
        result?.ok
        && String(result?.name || '').trim() === 'editor_patch_flow'
      ))
  }

  private shouldStopAfterRepeatedInvalidFlowPatch(results: AiActionResult[]) {
    return Array.isArray(results)
      && results.filter(result => (
        result?.ok === false
        && String(result?.name || '').trim() === 'editor_patch_flow'
        && String(result?.metadata?.flowPatchErrorCode || '').trim() === 'flow_patch_invalid_input'
      )).length >= 2
  }

  private shouldStopAfterBlueprintApplyRound(results: AiActionResult[]) {
    return Array.isArray(results)
      && results.some(result => (
        result?.ok
        && String(result?.name || '').trim() === 'editor_apply_staged_app_blueprint'
      ))
  }

  private shouldStopAfterFlowApplyRound(results: AiActionResult[]) {
    return Array.isArray(results)
      && results.some(result => (
        result?.ok
        && String(result?.name || '').trim() === 'editor_apply_staged_flow'
      ))
  }

  private buildMutationDuplicateSignature(name: string, input: Record<string, unknown>) {
    if (!MUTATING_EDITOR_TOOL_NAMES.has(String(name || '').trim())) {
      return ''
    }

    const normalizedInput = this.normalizeMutationInputForDuplicateGuard(name, input)
    return `${name}:${this.stableStringify(normalizedInput)}`
  }

  private normalizeMutationInputForDuplicateGuard(name: string, input: Record<string, unknown>) {
    const normalizedName = String(name || '').trim()
    const normalizedInput = this.normalizeDuplicateGuardValue(input)
    if (normalizedName !== 'editor_add_fields') {
      return normalizedInput
    }

    const fields = Array.isArray(input?.fields)
      ? input.fields.map((field) => ({
        name: String(field?.name || '').trim(),
        widgetType: this.normalizeWidgetTypeToken(field?.widgetType),
        afterWidgetId: String(field?.afterWidgetId || '').trim(),
        containerWidgetId: String(field?.containerWidgetId || '').trim(),
      }))
      : []

    return {
      fields,
    }
  }

  private normalizeDuplicateGuardValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map(item => this.normalizeDuplicateGuardValue(item))
    }
    if (!value || typeof value !== 'object') {
      return typeof value === 'string' ? String(value).trim() : value
    }

    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = this.normalizeDuplicateGuardValue((value as Record<string, unknown>)[key])
        return result
      }, {})
  }

  private normalizeWidgetTypeToken(value: unknown) {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^widget\.form\./, '')
      .replace(/[\s._-]+/g, '')

    if (['singlelinetext', 'textinput', 'textfield', 'text'].includes(normalized)) {
      return 'textinput'
    }

    return normalized
  }

  private stableStringify(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null'
    }
    if (Array.isArray(value)) {
      return `[${value.map(item => this.stableStringify(item)).join(',')}]`
    }
    if (typeof value !== 'object') {
      return JSON.stringify(value)
    }
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${this.stableStringify(item)}`)
      .join(',')}}`
  }

  private createTurnTraceId() {
    return `ai-turn-${unique(16)}`
  }

  private normalizeTraceId(value?: unknown) {
    const normalized = String(value || '').trim()
    return normalized || ''
  }

  private buildToolMessageContent(result: AiActionResult) {
    const repair = this.resolveModelVisibleFlowBlueprintRepair(result)
    return JSON.stringify({
      callId: result.callId,
      name: result.name,
      kind: result.kind,
      ok: result.ok,
      output: result.output,
      error: result.error,
      ...(repair ? { repair } : {}),
    })
  }

  private resolveModelVisibleFlowBlueprintRepair(result: AiActionResult) {
    if (
      result.ok
      || String(result.name || '').trim() !== 'editor_stage_flow_blueprint'
    ) {
      return undefined
    }
    const issues = Array.isArray(result.metadata?.flowUnifiedIssues)
      ? result.metadata.flowUnifiedIssues
      : []
    const issue = issues.find(item => (
      isRecord(item)
      && String(item.issueId || '').trim() === 'flow-blueprint-contract-invalid'
    ))
    if (!isRecord(issue)) {
      return undefined
    }
    const diagnostic = Array.isArray(issue.diagnostics)
      ? issue.diagnostics.find(isRecord)
      : undefined
    if (!diagnostic) {
      return undefined
    }
    const code = String(diagnostic.code || '').trim()
    const path = String(diagnostic.path || '').trim()
    if (!Object.hasOwn(MODEL_VISIBLE_FLOW_BLUEPRINT_REPAIR_PATHS, code)) {
      return undefined
    }
    const allowedPath = MODEL_VISIBLE_FLOW_BLUEPRINT_REPAIR_PATHS[code]
    return allowedPath instanceof RegExp && allowedPath.test(path)
      ? { code, path }
      : undefined
  }

  private buildModelToolExchangeMessages(
    call: AiActionCall,
    result: AiActionResult,
    round: number,
    traceId: string,
    assistantContent = '',
  ): AiProviderMessage[] {
    const normalizedAssistantContent = sanitizeNocodeEditorAssistantText(String(assistantContent || '').trim())
    const shouldHideNarration = shouldHideNocodeEditorIntermediateAssistantNarration(call.name)
    const exchangeCall: AiModelToolExchangeCall = {
      id: call.id,
      name: call.name,
      kind: call.kind,
      input: call.input,
      reason: call.reason,
    }
    const exchangeResult: AiModelToolExchangeResult = {
      callId: result.callId,
      name: result.name,
      ok: result.ok,
      output: result.output,
      error: result.error,
      metadata: result.metadata || undefined,
    }
    const repair = this.resolveModelVisibleFlowBlueprintRepair(result)

    return [
      {
        role: AiMessageRole.ASSISTANT,
        content: normalizedAssistantContent,
        metadata: {
          scene: 'nocode-editor',
          traceId,
          round,
          hiddenFromTimeline: shouldHideNarration || !normalizedAssistantContent,
          modelToolExchangeCall: exchangeCall,
        },
      },
      {
        role: AiMessageRole.TOOL,
        content: this.stringifyModelToolExchangeResult(exchangeResult, repair),
        toolCallId: call.id,
        metadata: {
          scene: 'nocode-editor',
          traceId,
          round,
          hiddenFromTimeline: true,
          modelToolExchangeResult: exchangeResult,
        },
      },
    ]
  }

  private stringifyModelToolExchangeResult(
    result: AiModelToolExchangeResult,
    repair?: { code: string; path: string },
  ) {
    return JSON.stringify({
      ok: result.ok,
      output: result.output,
      error: result.error,
      ...(repair ? { repair } : {}),
    })
  }

  private buildToolLoopFinalAssistantText(options: {
    latestRoundAssistantText: string
    assistantText: string
    finishReason: string
    actionResults: AiActionResult[]
  }) {
    return buildNocodeEditorToolLoopFinalAssistantText(options)
  }

  private collectAssistantBlocks(results: AiActionResult[]) {
    const blocks: Record<string, unknown>[] = []

    for (const result of results) {
      if (result?.metadata?.suppressStreamBlocks) {
        continue
      }
      for (const block of buildNocodeEditorToolResultArtifactBlocks(result)) {
        blocks.push(block as Record<string, unknown>)
      }
    }

    return normalizeNocodeEditorArtifactBlocks(blocks)
  }

  private collectLatestFlowSchemeFallbackBlocks(results: AiActionResult[]) {
    const latest = [...results].reverse().find(result => (
      result?.ok && String(result?.name || '').trim() === 'editor_plan_flow_scheme'
    ))
    return latest
      ? normalizeNocodeEditorArtifactBlocks(buildNocodeEditorToolResultArtifactBlocks(latest))
      : []
  }

  private normalizeHistoryForProvider(messages: AiProviderMessage[], providerName: string) {
    if (!providerName.startsWith('openai/')) {
      return messages
    }
    return messages.filter((item) => {
      if (item.role !== AiMessageRole.TOOL) {
        return true
      }
      return Boolean(item?.metadata?.modelToolExchangeResult)
    })
  }

  private mergeUsage(current: AiTokenUsage, incoming?: Partial<AiTokenUsage>) {
    return this.normalizeUsage({
      inputTokens: (current.inputTokens || 0) + Number(incoming?.inputTokens || 0),
      outputTokens: (current.outputTokens || 0) + Number(incoming?.outputTokens || 0),
      totalTokens: (current.totalTokens || 0) + Number(incoming?.totalTokens || 0),
    })
  }

  private normalizeUsage(usage?: Partial<AiTokenUsage>): AiTokenUsage {
    const inputTokens = Math.max(0, Math.round(Number(usage?.inputTokens || 0)))
    const outputTokens = Math.max(0, Math.round(Number(usage?.outputTokens || 0)))
    const totalTokens = Math.max(0, Math.round(Number(usage?.totalTokens || (inputTokens + outputTokens))))
    return {
      inputTokens,
      outputTokens,
      totalTokens,
    }
  }

  private normalizeActionRounds(value?: number) {
    const normalized = Number(value || 16)
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return 16
    }
    return Math.min(Math.round(normalized), 24)
  }

  private normalizeHistoryWindow(value?: number) {
    const normalized = Number(value || 12)
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return 12
    }
    return Math.min(Math.round(normalized), 24)
  }

  private buildConversationTitle(content: string) {
    const text = String(content || '').replace(/\s+/g, ' ').trim()
    if (!text) {
      return global.i18next.t('nocodeEditorChatService.defaultTitle')
    }
    return text.slice(0, 24)
  }

  private emit(handler: StreamChatOptions['emit'], payload: AiChatStreamPayload) {
    if (handler) {
      handler(payload)
    }
  }

  private async ensureConversation(accountId: string, request: AiChatRequest, includeModelSelection = true) {
    const nocodeId = String(request.scenePayload?.nocodeId || '').trim()
    if (!nocodeId) {
      throw new Error(global.i18next.t('nocodeEditorChatService.initializeMissingApp'))
    }
    return await this.conversationService.ensureConversation({
      ownerAccountId: accountId,
      nocodeId,
      conversationId: request.conversationId,
      ...(includeModelSelection
        ? {
          providerId: request.providerId,
          modelId: request.modelId,
          model: request.model,
          modelSelectionSource: request.modelSelectionSource,
        }
        : {}),
      taskId: String(request.metadata?.taskId || '').trim() || undefined,
      scopeKey: String(request.metadata?.taskScopeKey || '').trim() || undefined,
      source: String(request.metadata?.taskSource || '').trim() || undefined,
      title: this.buildConversationTitle(request.message),
    })
  }

  private hasRequestedModelSelection(request: AiChatRequest) {
    return request.providerId !== undefined
      || request.modelId !== undefined
      || request.model !== undefined
      || request.modelSelectionSource !== undefined
  }

  // 这个方法专门负责在 main 侧执行 editor_get_flow_node_examples。
  // 它不做任何 client 交互，只从 main 侧维护的节点示例表里取数并组装统一返回结构。
  private executeMainFlowNodeExamplesToolCall(call: AiActionCall) {
    try {
      // 先把 input 收敛成对象；如果模型传错了类型，这里直接降级成空对象处理。
      const input = isRecord(call.input) ? call.input : {}
      // 归一化 nodeTypes：过滤非法值、去重，只保留当前后端支持的节点类型。
      const nodeTypes = this.normalizeFlowNodeExampleToolNodeTypes(input.nodeTypes)
      // 读取是否需要额外返回通用条件 operator 说明。
      const includeConditionOperatorGuide = input.includeConditionOperatorGuide === true
      // requestedNodeTypes 直接等于归一化后的 nodeTypes，
      // 这样返回给模型和日志看的就是后端实际认下来的请求集合。
      // 按请求顺序从示例表里取出每个节点对应的结构示例。
      const examples = nodeTypes
        .map((nodeType) => nocodeEditorFlowNodeExamples[nodeType])
        .filter(Boolean)
      // 再反向收集一遍真正命中的 nodeType，后面要拿它算 missingNodeTypes。
      const foundNodeTypes = new Set(
        examples.map(item => String(item?.nodeType || '').trim()).filter(Boolean),
      )
      // requested 里有、但 examples 里没命中的节点类型，统一回到 missingNodeTypes。
      const missingNodeTypes = nodeTypes.filter(nodeType => !foundNodeTypes.has(nodeType))

      // 成功时返回统一工具结果结构。
      return {
        // 显式标记成功。
        ok: true,
        output: {
          // 回显实际被受理的节点类型列表。
          requestedNodeTypes: nodeTypes,
          // 返回命中的节点示例数组。
          examples,
          // 返回未命中的节点类型列表，便于模型知道哪些没拿到。
          missingNodeTypes,
          // 只有模型明确要条件 operator 参考时，才返回这块公共说明，避免无谓增大上下文。
          conditionOperatorGuide: includeConditionOperatorGuide
            ? nocodeEditorFlowConditionReferenceGuide
            : undefined,
        },
        metadata: {
          // 标记这次数据由 main 直接提供。
          servedBy: 'main',
          // 顺手把这个开关回写到 metadata，便于日志排查。
          includeConditionOperatorGuide,
        },
      }
    } catch (error) {
      // 出错时同样走统一结果结构，只是 ok=false。
      return {
        // 显式标记失败。
        ok: false,
        // 尽量返回可读错误信息。
        error: toErrorMessage(error)
          || global.i18next.t('nocodeEditorChatService.readFlowNodeExamplesFailed'),
        metadata: {
          // 即使失败，也保留 servedBy，说明报错发生在 main 侧。
          servedBy: 'main',
        },
      }
    }
  }

  // 这个方法专门把模型传进来的 nodeTypes 归一化成后端真正接受的节点类型数组。
  private normalizeFlowNodeExampleToolNodeTypes(value: unknown): NocodeEditorFlowPlanNodeType[] {
    // 如果模型传的不是数组，直接返回空数组，不抛异常。
    if (!Array.isArray(value)) {
      return []
    }

    // 最终的合法节点类型结果。
    const result: NocodeEditorFlowPlanNodeType[] = []
    // 用于去重，避免模型重复传同一个节点类型。
    const seen = new Set<string>()
    // 以当前 main 侧示例表为准，构建一份受支持节点类型集合。
    const supportedNodeTypes = new Set(
      Object.keys(nocodeEditorFlowNodeExamples) as NocodeEditorFlowPlanNodeType[],
    )

    // 逐个扫描模型传入的节点类型。
    for (const item of value) {
      // 先转成字符串并裁掉空白。
      const nodeType = String(item || '').trim() as NocodeEditorFlowPlanNodeType
      // 空值、重复值、或当前后端不支持的节点类型，全部跳过。
      if (!nodeType || seen.has(nodeType) || !supportedNodeTypes.has(nodeType)) {
        continue
      }
      // 记录这个节点类型已经见过，防止后面重复加入。
      seen.add(nodeType)
      // 把合法节点类型按原顺序压入结果。
      result.push(nodeType)
    }

    // 返回归一化后的节点类型数组。
    return result
  }

}
