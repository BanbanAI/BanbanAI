export const NOCODE_EDITOR_TRANSIENT_FAILED_STAGE_SUMMARY_REASON = 'transient_failed_stage_followed_by_success'
export const LEGACY_NOCODE_EDITOR_TRANSIENT_FAILED_STAGE_SUMMARY_REASON = 'transient_failed_app_plan_followed_by_success'
export const NOCODE_EDITOR_DEFERRED_FAILED_STAGE_SUMMARY_REASON = 'deferred_failed_stage_summary'

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
)
