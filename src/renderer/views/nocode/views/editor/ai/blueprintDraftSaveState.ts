import {
  filterNocodeEditorDraftIssueOpenQuestions,
  getNocodeEditorDraftIssueOpenQuestionParts,
} from '../../../../../../common/utils/nocodeEditorDraftIssueOpenQuestions'
import type { FormDesignValidationIssue } from '../form/designValidation'
import { normalizeFormDesignValidationIssuesToActionIssues } from './draftIssueActionList'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiDraftPersistenceState,
  NocodeEditorAiDraftSaveResult,
} from './types'
import i18next from 'i18next'

const {
  prefix: DRAFT_ISSUE_OPEN_QUESTION_PREFIX,
  marker: DRAFT_ISSUE_OPEN_QUESTION_MARKER,
} = getNocodeEditorDraftIssueOpenQuestionParts()

export const buildBlueprintDraftPersistenceState = (
  result: NocodeEditorAiDraftSaveResult,
  options: {
    dirty?: boolean
    sourceTraceId?: string
    sourceBlueprintIdentityKey?: string
    sourceBlueprintVersionKey?: string
    sourceFormId?: string
  } = {},
): NocodeEditorAiDraftPersistenceState | null => {
  if (!result.hasBlockingIssues) return null

  const actionIssues = normalizeFormDesignValidationIssuesToActionIssues(result.issues, {
    formId: result.formId,
    formLabel: result.formLabel,
  })

  return {
    mode: 'draft_only',
    issueCount: actionIssues.length,
    summary: result.summary || i18next.t('draftIssueActionList.formDraftIncompleteFields', { count: actionIssues.length }),
    issues: result.issues,
    actionIssues,
    updatedAt: Date.now(),
    persistedToApp: result.persistedToApp === true,
    dirty: options.dirty ?? true,
    sourceTraceId: options.sourceTraceId,
    sourceBlueprintIdentityKey: options.sourceBlueprintIdentityKey,
    sourceBlueprintVersionKey: options.sourceBlueprintVersionKey,
    sourceFormId: options.sourceFormId,
  }
}

const formatDraftIssueOpenQuestion = (issue: FormDesignValidationIssue) => {
  const fieldName = String(issue.fieldName || issue.widgetId || '').trim() || i18next.t('draftIssueActionList.unnamedField')
  return `${DRAFT_ISSUE_OPEN_QUESTION_PREFIX}${fieldName}${DRAFT_ISSUE_OPEN_QUESTION_MARKER}${issue.message}`
}

export const mergeDraftIssuesIntoBlueprintOpenQuestions = (
  blueprint: NocodeEditorAiAppBlueprint,
  issues: FormDesignValidationIssue[],
) => {
  const stableQuestions = filterNocodeEditorDraftIssueOpenQuestions(blueprint.openQuestions)
  const issueQuestions = issues.map(formatDraftIssueOpenQuestion)

  return {
    ...blueprint,
    openQuestions: Array.from(new Set([
      ...stableQuestions,
      ...issueQuestions,
    ])),
  }
}
