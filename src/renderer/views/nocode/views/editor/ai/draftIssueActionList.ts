import {
  resolveFormDesignValidationIssueHighlightTarget,
  type FormDesignValidationIssue,
} from '../form/designValidation'
import i18next from 'i18next'
import type {
  NocodeEditorAiDraftActionIssue,
  NocodeEditorAiDraftIssueGroup,
  NocodeEditorAiDraftIssueTargetKind,
  NocodeEditorAiDraftPersistenceState,
  NocodeEditorAiDraftSaveResult,
} from './types'

type FormIssueNormalizeContext = {
  formId?: string
  formLabel?: string
}

const targetKindGroupLabels: Record<NocodeEditorAiDraftIssueTargetKind, string> = {
  get form_field() { return i18next.t('draftIssueActionList.fieldConfig') },
  get process_node() { return i18next.t('draftIssueActionList.workflowNode') },
  get page() { return i18next.t('draftIssueActionList.pageSettings') },
  get app_setting() { return i18next.t('draftIssueActionList.appSettings') },
}

const normalizeIssueIdPart = (value: unknown) => (
  String(value || '').trim().replace(/[:\s]+/g, '-') || 'unknown'
)

export const buildDraftActionIssueId = (issue: {
  source: string
  targetKind: string
  formId?: string
  targetId: string
  code: string
}) => [
  normalizeIssueIdPart(issue.source),
  normalizeIssueIdPart(issue.targetKind),
  normalizeIssueIdPart(issue.formId),
  normalizeIssueIdPart(issue.targetId),
  normalizeIssueIdPart(issue.code),
].join(':')

export const normalizeFormDesignValidationIssuesToActionIssues = (
  issues: FormDesignValidationIssue[],
  context: FormIssueNormalizeContext = {},
): NocodeEditorAiDraftActionIssue[] => issues.map((issue) => {
  const targetId = String(issue.widgetId || '').trim()
  const targetLabel = String(issue.fieldName || issue.widgetId || i18next.t('draftIssueActionList.unnamedField')).trim()
  const highlightTarget = resolveFormDesignValidationIssueHighlightTarget(issue)
  return {
    id: buildDraftActionIssueId({
      source: 'form_design_validation',
      targetKind: 'form_field',
      formId: context.formId,
      targetId,
      code: issue.code,
    }),
    targetKind: 'form_field',
    targetId,
    targetLabel,
    groupKey: 'form_field',
    groupLabel: targetKindGroupLabels.form_field,
    code: issue.code,
    message: issue.message,
    blockingSave: issue.blockingSave,
    source: 'form_design_validation',
    locator: {
      tab: 'form-design',
      formId: context.formId,
      formLabel: context.formLabel,
      widgetId: targetId,
      optionPath: highlightTarget.optionPath,
    },
    formDesignIssue: issue,
  }
})

export const groupDraftActionIssues = (
  issues: NocodeEditorAiDraftActionIssue[],
): NocodeEditorAiDraftIssueGroup[] => {
  const groups = new Map<string, NocodeEditorAiDraftIssueGroup>()
  for (const issue of issues) {
    const key = issue.groupKey || issue.targetKind
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: issue.groupLabel || targetKindGroupLabels[issue.targetKind],
        issues: [],
      })
    }
    groups.get(key)!.issues.push(issue)
  }
  return [...groups.values()]
}

export type BuildResolvedDraftPersistenceStateOptions = {
  resolvedAt: number
  resolvedSummary?: string
  sourceTraceId?: string
  sourceBlueprintIdentityKey?: string
  sourceBlueprintVersionKey?: string
  sourceFormId?: string
}

const normalizeActionIssues = (
  state: NocodeEditorAiDraftPersistenceState,
) => Array.isArray(state.actionIssues)
  ? state.actionIssues
  : normalizeFormDesignValidationIssuesToActionIssues(state.issues || [])

export const isDraftPersistenceStateDraftOnly = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => state?.mode === 'draft_only'

export const isDraftPersistenceStateResolved = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => (
  isDraftPersistenceStateDraftOnly(state)
  && state.resolved === true
  && getDraftPersistenceActionIssueCount(state) === 0
)

export const getDraftPersistenceActionIssueCount = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => (
  isDraftPersistenceStateDraftOnly(state)
    ? normalizeActionIssues(state).length
    : 0
)

export const hasDraftPersistenceBlockingActionIssues = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => {
  if (!isDraftPersistenceStateDraftOnly(state)) {
    return false
  }

  const actionIssues = normalizeActionIssues(state)
  if (actionIssues.some(issue => issue.blockingSave)) {
    return true
  }

  return state.resolved !== true && Number(state.issueCount || 0) > 0
}

export const shouldBlockNavigationForDraftPersistenceState = (
  state?: NocodeEditorAiDraftPersistenceState | null,
) => (
  isDraftPersistenceStateDraftOnly(state)
  && state?.dirty !== false
  && hasDraftPersistenceBlockingActionIssues(state)
)

export const normalizeDraftPersistenceState = (
  state?: NocodeEditorAiDraftPersistenceState | null,
): NocodeEditorAiDraftPersistenceState | null => {
  if (!state || state.mode !== 'draft_only') {
    return null
  }

  const actionIssues = normalizeActionIssues(state)
  if (state.resolved === true && actionIssues.length === 0) {
    return {
      ...state,
      actionIssues,
      resolvedIssues: Array.isArray(state.resolvedIssues)
        ? state.resolvedIssues
        : actionIssues,
    }
  }

  return {
    ...state,
    actionIssues,
  }
}

export const buildResolvedDraftPersistenceState = (
  state: NocodeEditorAiDraftPersistenceState,
  options: BuildResolvedDraftPersistenceStateOptions,
): NocodeEditorAiDraftPersistenceState => {
  const normalizedState = normalizeDraftPersistenceState(state) || state
  const actionIssues = normalizeActionIssues(normalizedState)
  const resolvedIssues = Array.isArray(normalizedState.resolvedIssues) && normalizedState.resolvedIssues.length > 0
    ? normalizedState.resolvedIssues
    : actionIssues
  const resolvedSummary = options.resolvedSummary
    ?? normalizedState.resolvedSummary
    ?? i18next.t('draftIssueActionList.draftIssuesCompleted')

  return {
    ...normalizedState,
    issues: [],
    actionIssues: [],
    dirty: false,
    resolved: true,
    resolvedAt: options.resolvedAt,
    summary: resolvedSummary,
    updatedAt: options.resolvedAt,
    resolvedSummary,
    resolvedIssues,
    sourceTraceId: options.sourceTraceId ?? normalizedState.sourceTraceId,
    sourceBlueprintIdentityKey: options.sourceBlueprintIdentityKey ?? normalizedState.sourceBlueprintIdentityKey,
    sourceBlueprintVersionKey: options.sourceBlueprintVersionKey ?? normalizedState.sourceBlueprintVersionKey,
    sourceFormId: options.sourceFormId ?? normalizedState.sourceFormId,
  }
}

const isDraftPersistenceStateForSameBlueprint = (
  left?: NocodeEditorAiDraftPersistenceState | null,
  right?: NocodeEditorAiDraftPersistenceState | null,
) => {
  const leftVersionKey = String(left?.sourceBlueprintVersionKey || '').trim()
  const rightVersionKey = String(right?.sourceBlueprintVersionKey || '').trim()
  if (leftVersionKey && rightVersionKey) {
    return leftVersionKey === rightVersionKey
  }
  const leftIdentityKey = String(left?.sourceBlueprintIdentityKey || '').trim()
  const rightIdentityKey = String(right?.sourceBlueprintIdentityKey || '').trim()
  return Boolean(leftIdentityKey && rightIdentityKey && leftIdentityKey === rightIdentityKey)
}

// “已完成”一旦被错误固化，后续重新校验必须能把它打回未补齐：
// 仅当实时草稿与该已完成卡片属于同表单同一蓝图身份、且实时草稿晚于完成时刻仍有待补项时才回退。
export const shouldRevertResolvedDraftPersistenceStateForLiveDraftIssues = (input: {
  resolvedState?: NocodeEditorAiDraftPersistenceState | null
  liveState?: NocodeEditorAiDraftPersistenceState | null
}) => {
  const resolvedState = normalizeDraftPersistenceState(input.resolvedState)
  if (!resolvedState || !isDraftPersistenceStateResolved(resolvedState)) {
    return false
  }
  if (!Array.isArray(resolvedState.resolvedIssues) || resolvedState.resolvedIssues.length === 0) {
    return false
  }

  const liveState = normalizeDraftPersistenceState(input.liveState)
  if (!liveState || isDraftPersistenceStateResolved(liveState)) {
    return false
  }
  if (!Array.isArray(liveState.actionIssues) || liveState.actionIssues.length === 0) {
    return false
  }

  const resolvedFormId = String(resolvedState.sourceFormId || '').trim()
  const liveFormId = String(liveState.sourceFormId || '').trim()
  if (!resolvedFormId || !liveFormId || resolvedFormId !== liveFormId) {
    return false
  }
  if (!isDraftPersistenceStateForSameBlueprint(resolvedState, liveState)) {
    return false
  }

  const resolvedAt = Number(resolvedState.resolvedAt || 0)
  const liveUpdatedAt = Number(liveState.updatedAt || 0)
  if (!resolvedAt || !liveUpdatedAt || liveUpdatedAt <= resolvedAt) {
    return false
  }

  return true
}

export const resolveRefreshedDraftPersistenceState = (input: {
  currentState?: NocodeEditorAiDraftPersistenceState | null
  draftResult: NocodeEditorAiDraftSaveResult
  resolvedAt: number
  sourceTraceId?: string
  sourceBlueprintIdentityKey?: string
  sourceBlueprintVersionKey?: string
  sourceFormId?: string
}): NocodeEditorAiDraftPersistenceState | null => {
  const {
    currentState,
    draftResult,
    resolvedAt,
    sourceTraceId,
    sourceBlueprintIdentityKey,
    sourceBlueprintVersionKey,
    sourceFormId,
  } = input

  const currentDraftFormId = String(currentState?.sourceFormId || '').trim()
  const refreshedFormId = String(draftResult.formId || '').trim()
  if (currentDraftFormId && refreshedFormId && currentDraftFormId !== refreshedFormId) {
    // 刷新发生在另一张表上，不能拿来判定当前草稿的补齐状态（否则会出现异表“已补齐”误判）
    return currentState || null
  }

  if (!draftResult.hasBlockingIssues && isDraftPersistenceStateResolved(currentState)) {
    // 已完成且重新校验通过：保持原状态，避免生成新的 resolvedAt 造成完成态反复写入
    return currentState
  }

  if (draftResult.hasBlockingIssues) {
    const actionIssues = normalizeFormDesignValidationIssuesToActionIssues(draftResult.issues, {
      formId: draftResult.formId,
      formLabel: draftResult.formLabel,
    })

    return {
      mode: 'draft_only',
      issueCount: actionIssues.length,
      summary: draftResult.summary || i18next.t('draftIssueActionList.formDraftIncompleteFields', { count: actionIssues.length }),
      issues: draftResult.issues,
      actionIssues,
      updatedAt: resolvedAt,
      dirty: true,
      sourceTraceId: sourceTraceId ?? currentState?.sourceTraceId,
      sourceBlueprintIdentityKey: sourceBlueprintIdentityKey ?? currentState?.sourceBlueprintIdentityKey,
      sourceBlueprintVersionKey: sourceBlueprintVersionKey ?? currentState?.sourceBlueprintVersionKey,
      sourceFormId: sourceFormId ?? currentState?.sourceFormId,
    }
  }

  if (!isDraftPersistenceStateDraftOnly(currentState)) {
    return null
  }

  return buildResolvedDraftPersistenceState(currentState, {
    resolvedAt,
    resolvedSummary: draftResult.summary || currentState.resolvedSummary,
    sourceTraceId: sourceTraceId ?? currentState.sourceTraceId,
    sourceBlueprintIdentityKey: sourceBlueprintIdentityKey ?? currentState.sourceBlueprintIdentityKey,
    sourceBlueprintVersionKey: sourceBlueprintVersionKey ?? currentState.sourceBlueprintVersionKey,
    sourceFormId: sourceFormId ?? currentState.sourceFormId,
  })
}
