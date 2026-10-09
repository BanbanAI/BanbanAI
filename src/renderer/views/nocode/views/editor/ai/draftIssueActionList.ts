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
