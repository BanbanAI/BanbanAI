import type { AiAssistantSupportingData } from '@common/types/ai'
import { computed, type Ref } from 'vue'
import { deriveAiAnalysisSupportingData } from './workbenchAiInsightPanelModel'

export const useAiInsightMetaAnchor = (payload: {
  structuredSupportingData: Ref<AiAssistantSupportingData | null>
  analysisConclusionItems: Ref<string[]>
}) => {
  const supportingData = computed(() => deriveAiAnalysisSupportingData({
    structuredSupportingData: payload.structuredSupportingData.value,
    analysisConclusionItems: payload.analysisConclusionItems.value,
  }))

  const hasSupportingContent = computed(() => Boolean(
    payload.analysisConclusionItems.value.length || supportingData.value,
  ))

  return {
    supportingData,
    hasSupportingContent,
  }
}
