import type { AppBuilderHandoff } from '@common/types/appBuilderHandoff'
import type { NocodeEditorAiContinuityHint } from './types'
import i18next from 'i18next'

export type WorkbenchHandoffBootstrapPhase = 'idle' | 'importing' | 'replaying' | 'failed'

const resolveHandoffDisplayTitle = (handoff?: AppBuilderHandoff | null) => {
  const title = String(
    handoff?.draft?.appName
    || handoff?.intent?.entryTitle
    || '',
  ).trim()
  return title
    ? i18next.t('appBuilderHandoffOpenExperience.quotedTitle', { title })
    : i18next.t('appBuilderHandoffOpenExperience.currentCreationRequest')
}

export const buildWorkbenchHandoffContinuityHint = (input: {
  phase: WorkbenchHandoffBootstrapPhase
  handoff?: AppBuilderHandoff | null
}): NocodeEditorAiContinuityHint | null => {
  if (input.phase === 'failed') {
    const title = resolveHandoffDisplayTitle(input.handoff)
    return {
      kind: 'workbench-handoff',
      text: i18next.t('appBuilderHandoffOpenExperience.continuityHintFailed', { title }),
    }
  }
  return null
}

export const resolveWorkbenchHandoffLiveStatus = (input: {
  phase: WorkbenchHandoffBootstrapPhase
}) => {
  if (input.phase === 'importing') {
    return {
      title: i18next.t('appBuilderHandoffOpenExperience.importingTitle'),
      description: i18next.t('appBuilderHandoffOpenExperience.importingDescription'),
    }
  }
  if (input.phase === 'replaying') {
    return {
      title: i18next.t('appBuilderHandoffOpenExperience.replayingTitle'),
      description: i18next.t('appBuilderHandoffOpenExperience.replayingDescription'),
    }
  }
  return null
}
