import type {
  NocodeEditorAiDraftPersistenceState,
  NocodeEditorNavigationPersistenceIntent,
  NocodeEditorNavigationPersistenceResult,
} from './ai/types'
import i18next from 'i18next'
import {
  isDraftPersistenceStateDraftOnly,
  shouldBlockNavigationForDraftPersistenceState,
} from './ai/draftIssueActionList'

export const canContinueAfterNavigationPersistence = (
  result: NocodeEditorNavigationPersistenceResult | null | undefined,
) => result?.mode === 'saved'
  || result?.mode === 'unchanged'
  || result?.mode === 'draft_only'

export const resolveNavigationPersistenceWithoutLocalChanges = (input: {
  draftPersistenceState?: NocodeEditorAiDraftPersistenceState | null
  intent?: NocodeEditorNavigationPersistenceIntent
}): NocodeEditorNavigationPersistenceResult => {
  if (!isDraftPersistenceStateDraftOnly(input.draftPersistenceState)) {
    return {
      mode: 'unchanged',
      draftPersistenceState: null,
    }
  }

  if (!shouldBlockNavigationForDraftPersistenceState(input.draftPersistenceState)) {
    return {
      mode: 'unchanged',
      draftPersistenceState: input.draftPersistenceState,
    }
  }

  if (input.intent === 'internal_switch') {
    return {
      mode: 'unchanged',
      draftPersistenceState: input.draftPersistenceState,
    }
  }

  return {
    mode: 'draft_only',
    draftPersistenceState: input.draftPersistenceState,
  }
}

export const resolveNavigationPersistenceFeedback = (
  result: NocodeEditorNavigationPersistenceResult | null | undefined,
) => {
  if (!result || result.mode === 'unchanged') {
    return { toastType: 'none', message: '' } as const
  }
  if (result.mode === 'saved') {
    return { toastType: 'success', message: i18next.t('navigationPersistence.autoSavedChanges') } as const
  }
  if (result.mode === 'draft_only') {
    return {
      toastType: 'warning',
      message: result.draftPersistenceState?.summary || i18next.t('navigationPersistence.draftSavedWithIncompleteConfig'),
    } as const
  }

  return {
    toastType: 'error',
    message: result.message || i18next.t('navigationPersistence.stashFailedBeforeSwitch'),
  } as const
}
