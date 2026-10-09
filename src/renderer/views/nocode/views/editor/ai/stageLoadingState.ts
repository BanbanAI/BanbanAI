import type { NocodeEditorAiArtifactBlock, NocodeEditorAiMessage } from './types'
import i18next from 'i18next'

const ASSISTANT_ROLE = 'assistant'

export type NocodeEditorStageLoadingState = {
  frameLoading: boolean
  blueprintLoading: boolean
  frameMessage?: string
  blueprintMessage?: string
}

const getDefaultAppPlanLoadingMessage = () => i18next.t('stageLoadingState.organizingAppPlan')
const getDefaultFormPlanLoadingMessage = () => i18next.t('stageLoadingState.organizingFormPlan')
const getDefaultContentPlanLoadingMessage = () => i18next.t('stageLoadingState.organizingContentPlan')
const getDefaultFormulaPlanLoadingMessage = () => i18next.t('formulaPlanPresentation.loading')
const getDefaultFlowPlanLoadingMessage = () => i18next.t('stageLoadingState.organizingFlowPlan')
const getDefaultBlueprintLoadingMessage = () => i18next.t('stageLoadingState.generatingBlueprint')

const getArtifactBlocks = (message: NocodeEditorAiMessage) => {
  const rawBlocks = Array.isArray(message.metadata?.blocks) ? message.metadata.blocks : []
  return rawBlocks.filter((block): block is NocodeEditorAiArtifactBlock => (
    Boolean(block)
    && typeof block === 'object'
    && !Array.isArray(block)
    && block.type === 'artifact'
  ))
}

export const resolveNocodeEditorStageLoadingState = (
  messages: NocodeEditorAiMessage[],
): NocodeEditorStageLoadingState => {
  const latestAssistant = [...messages]
    .reverse()
    .find(message => message.role === ASSISTANT_ROLE)

  if (!latestAssistant) {
    return {
      frameLoading: false,
      blueprintLoading: false,
    }
  }

  const loadingBlock = getArtifactBlocks(latestAssistant).find(block => block.status === 'loading')
  if (!loadingBlock) {
    return {
      frameLoading: false,
      blueprintLoading: false,
    }
  }

  if (loadingBlock.kind === 'app-plan') {
    return {
      frameLoading: true,
      blueprintLoading: false,
      frameMessage: String(loadingBlock.message || '').trim() || getDefaultAppPlanLoadingMessage(),
    }
  }

  if (loadingBlock.kind === 'form-plan') {
    return {
      frameLoading: true,
      blueprintLoading: false,
      frameMessage: String(loadingBlock.message || '').trim() || getDefaultFormPlanLoadingMessage(),
    }
  }

  if (loadingBlock.kind === 'content-plan') {
    return {
      frameLoading: true,
      blueprintLoading: false,
      frameMessage: String(loadingBlock.message || '').trim() || getDefaultContentPlanLoadingMessage(),
    }
  }

  if (loadingBlock.kind === 'formula-plan') {
    return {
      frameLoading: true,
      blueprintLoading: false,
      frameMessage: String(loadingBlock.message || '').trim() || getDefaultFormulaPlanLoadingMessage(),
    }
  }

  if (loadingBlock.kind === 'flow-plan') {
    return {
      frameLoading: true,
      blueprintLoading: false,
      frameMessage: String(loadingBlock.message || '').trim() || getDefaultFlowPlanLoadingMessage(),
    }
  }

  if (loadingBlock.kind === 'blueprint') {
    return {
      frameLoading: false,
      blueprintLoading: true,
      blueprintMessage: String(loadingBlock.message || '').trim() || getDefaultBlueprintLoadingMessage(),
    }
  }

  return {
    frameLoading: false,
    blueprintLoading: false,
  }
}
