export const NOCODE_EDITOR_TRANSIENT_FAILED_STAGE_SUMMARY_REASON = 'transient_failed_stage_followed_by_success'
export const LEGACY_NOCODE_EDITOR_TRANSIENT_FAILED_STAGE_SUMMARY_REASON = 'transient_failed_app_plan_followed_by_success'
export const NOCODE_EDITOR_DEFERRED_FAILED_STAGE_SUMMARY_REASON = 'deferred_failed_stage_summary'
/** 模型入参契约问题：同一轮由模型自己修，用户不该看到失败卡。 */
export const NOCODE_EDITOR_MODEL_CONTRACT_REPAIR_SUMMARY_REASON = 'model_contract_repair'

const STAGE_SUMMARY_STAGES = new Set([
  'app-plan',
  'form-plan',
  'content-plan',
  'formula-plan',
  'blueprint',
  'flow-scheme',
  'flow-plan',
])

export const normalizeNocodeEditorStageSummaryStage = (value: unknown) => {
  const stage = String(value || '').trim().toLowerCase()
  return STAGE_SUMMARY_STAGES.has(stage) ? stage : ''
}

export const isNocodeEditorFailedStageSummaryMetadata = (
  metadata?: Record<string, unknown> | null,
) => (
  Boolean(metadata?.toolResultSummary)
  && metadata?.ok === false
  && Boolean(normalizeNocodeEditorStageSummaryStage(metadata?.summaryStage))
)

export const isNocodeEditorTransientFailedStageSummaryReason = (reason: unknown) => {
  const normalized = String(reason || '').trim()
  return Boolean(normalized)
    && (
      normalized === NOCODE_EDITOR_TRANSIENT_FAILED_STAGE_SUMMARY_REASON
      || normalized === LEGACY_NOCODE_EDITOR_TRANSIENT_FAILED_STAGE_SUMMARY_REASON
    )
}

export const isNocodeEditorSuppressedFailedStageSummaryReason = (reason: unknown) => (
  isNocodeEditorTransientFailedStageSummaryReason(reason)
  || String(reason || '').trim() === NOCODE_EDITOR_DEFERRED_FAILED_STAGE_SUMMARY_REASON
  || String(reason || '').trim() === NOCODE_EDITOR_MODEL_CONTRACT_REPAIR_SUMMARY_REASON
)

/**
 * 只有“显式标记 + 已知 reason”才算模型契约自修失败。
 * 不要从 suppressPersistedSummary / suppressSummaryContent / suppressStreamBlocks 的组合推断：
 * 那三个字段同时被前置缺失等其它路径使用，推断会把不相关失败也隐藏掉。
 */
export const isNocodeEditorModelContractRepairFailure = (
  metadata?: Record<string, unknown> | null,
) => (
  Boolean(metadata?.suppressedIntermediateSummary)
  && String(metadata?.summarySuppressionReason || '').trim()
    === NOCODE_EDITOR_MODEL_CONTRACT_REPAIR_SUMMARY_REASON
)

/**
 * 守卫拒绝只是模型可见的纠偏反馈：服务端同时抑制摘要/流块，渲染端必须跳过失败卡。
 * 新增守卫标记时在此登记；不要用 suppress* 组合推断，避免把普通失败一起藏掉。
 */
export const isNocodeEditorGuardFailureStreamMetadata = (
  metadata?: Record<string, unknown> | null,
) => Boolean(
  metadata?.duplicateBlocked
  || metadata?.toolPolicyViolation
  || metadata?.blockedByPlanningScope
  || metadata?.blockedByCompletedPlanningContinuation
  || metadata?.blockedByBlueprintScopeRecovery
  || (metadata?.blockedByFlowApplyAuthorization && metadata?.suppressedIntermediateSummary)
  || (
    metadata?.suppressedIntermediateSummary
    && isNocodeEditorSuppressedFailedStageSummaryReason(metadata?.summarySuppressionReason)
  ),
)

/**
 * 面板 callback 的“模型契约自修”抑制元数据：可修返回五件套，否则 null。
 * 面板与回归共用同一个函数，回归断言的就是线上真正写进 callback 的那份对象。
 */
export const buildNocodeEditorModelContractRepairStreamMetadata = (
  error: unknown,
) => {
  const record = error && typeof error === 'object' && !Array.isArray(error)
    ? error as Record<string, unknown>
    : null
  if (record?.modelSelfRepairable !== true) {
    return null
  }
  return {
    suppressPersistedSummary: true,
    suppressSummaryContent: true,
    suppressStreamBlocks: true,
    suppressedIntermediateSummary: true,
    summarySuppressionReason: NOCODE_EDITOR_MODEL_CONTRACT_REPAIR_SUMMARY_REASON,
  }
}

/**
 * 阶段失败卡是否该出现在用户面前。
 * 模型可自修 → 不展示；当前消息已有待作答的流程确认卡 → 不展示，避免错误卡顶掉确认卡。
 */
export const shouldShowNocodeEditorFailedStageArtifact = (input: {
  metadata?: Record<string, unknown> | null
  hasPendingConfirmation?: boolean
} = {}) => (
  !isNocodeEditorModelContractRepairFailure(input?.metadata)
  && !input?.hasPendingConfirmation
)
