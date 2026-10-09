import i18next from 'i18next'

const LEGACY_PENDING_CONTINUE_LABEL = '忽略待确认，按默认方案继续'

export const getNocodeEditorPendingContinueLabel = () => (
  i18next.t('nocodeEditorConfirmationCopy.pendingContinueLabel')
)

export const getNocodeEditorDefaultContinueReplyAliases = () => Array.from(new Set([
  getNocodeEditorPendingContinueLabel(),
  LEGACY_PENDING_CONTINUE_LABEL,
]))

export const getNocodeEditorCompletedDefaultsContinueLabel = () => (
  i18next.t('nocodeEditorConfirmationCopy.completedDefaultsContinueLabel')
)

export const getNocodeEditorCompletedDefaultsSummary = () => (
  i18next.t('nocodeEditorConfirmationCopy.completedDefaultsSummary')
)

export const getNocodeEditorCompletedDefaultsResultSummary = () => (
  i18next.t('nocodeEditorConfirmationCopy.completedDefaultsResultSummary')
)

export const getNocodeEditorAppPlanningAiHandlingText = () => (
  i18next.t('nocodeEditorConfirmationCopy.appPlanningAiHandling', {
    label: getNocodeEditorPendingContinueLabel(),
  })
)
