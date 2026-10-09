import i18next from 'i18next'

export type NocodeEditorAppBuilderPlanningModeToken = 'greenfield' | 'delta-extension'

export type NocodeEditorAppBuilderExecutionLevelToken =
  | 'executable_now'
  | 'need_confirm'
  | 'planning_only'

const normalizeArtifactTypeToken = (value: unknown) => {
  const normalized = String(value ?? 'artifact')
    .trim()
    .toLowerCase()

  return normalized || 'artifact'
}

export const normalizeNocodeEditorAppBuilderPlanningModeToken = (
  value: unknown,
): NocodeEditorAppBuilderPlanningModeToken => {
  const normalized = String(value ?? '')
    .trim()

  return normalized === 'delta-extension'
    ? 'delta-extension'
    : 'greenfield'
}

export const normalizeNocodeEditorAppBuilderExecutionLevelToken = (
  value: unknown,
): NocodeEditorAppBuilderExecutionLevelToken => {
  const normalized = String(value ?? '')
    .trim()

  if (normalized === 'need_confirm' || normalized === 'planning_only') {
    return normalized
  }
  return 'executable_now'
}

export const resolveNocodeEditorAppBuilderPlanningModeLabel = (value: unknown) => {
  const normalized = normalizeNocodeEditorAppBuilderPlanningModeToken(value)
  return normalized === 'delta-extension'
    ? i18next.t('nocodeEditorAppBuilderPlanningLabels.extendExistingApp')
    : i18next.t('nocodeEditorAppBuilderPlanningLabels.buildFromScratch')
}

export const resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel = (value: unknown) => {
  const normalized = normalizeArtifactTypeToken(value)

  switch (normalized) {
    case 'form':
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.form')
    case 'field-group':
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.fieldGroup')
    case 'process':
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.flow')
    case 'board':
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.board')
    case 'formula':
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.formula')
    case 'page-view':
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.pageView')
    default:
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.planItem')
  }
}

export const resolveNocodeEditorAppBuilderExecutionLevelLabel = (value: unknown) => {
  const normalized = normalizeNocodeEditorAppBuilderExecutionLevelToken(value)

  switch (normalized) {
    case 'need_confirm':
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.confirmBeforeContinue')
    case 'planning_only':
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.planOnly')
    default:
      return i18next.t('nocodeEditorAppBuilderPlanningLabels.readyToGenerate')
  }
}
