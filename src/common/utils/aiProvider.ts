import type {
  AiDefaultModelSelections,
  AiModelTier,
  AiModelCatalogItem,
  AiProviderType,
  AiTierDefaultSelection,
  AiThreadModelSelection,
  AiThreadModelSelectionSource,
} from '@common/types/ai-provider'
import i18next from 'i18next'

export const BUILTIN_AI_PROVIDER_ID = 'banbanai'
export const BUILTIN_AI_MODEL_PUBLIC_ID = 'banban-ai'
export const BUILTIN_AI_MODEL_PUBLIC_NAME = 'BanbanAI'

export type FixedBanbanAiProviderDefinition = {
  id: string
  presetKey: string
  name: string
  sortOrder: number
  requiresPlatformLogin: true
}

export const FIXED_BANBAN_AI_PROVIDERS: FixedBanbanAiProviderDefinition[] = [
  {
    id: BUILTIN_AI_PROVIDER_ID,
    presetKey: BUILTIN_AI_PROVIDER_ID,
    name: BUILTIN_AI_MODEL_PUBLIC_NAME,
    sortOrder: 0,
    requiresPlatformLogin: true,
  },
]

const FIXED_BANBAN_AI_PROVIDER_IDS = new Set(FIXED_BANBAN_AI_PROVIDERS.map(provider => provider.id))

export const isFixedBanbanAiProviderId = (providerId?: string | null) => (
  FIXED_BANBAN_AI_PROVIDER_IDS.has(String(providerId || '').trim())
)

export type AiThreadModelOption = {
  value: string
  label: string
  providerId?: string
  modelId?: string
  model?: string
  modelSelectionSource: AiThreadModelSelectionSource
}

export const isBuiltinAiProviderType = (providerType?: AiProviderType | string | null) => providerType === 'builtin-cloud'

export const getAiModelTierLabel = (tier?: AiModelTier | string | null) => {
  if (tier === 'fast') return i18next.t('aiProvider.fastTier')
  if (tier === 'balanced') return i18next.t('aiProvider.balancedTier')
  if (tier === 'deep') return i18next.t('aiProvider.deepTier')
  return i18next.t('aiProvider.notSet')
}

export const getAiModelTierDefaultBadgeLabel = (tier?: AiModelTier | string | null) => (
  i18next.t('aiProvider.defaultTierBadge', { tier: getAiModelTierLabel(normalizeAiModelTier(tier)) })
)

export const getAiModelTierDefaultSummaryLabel = (tier?: AiModelTier | string | null) => (
  i18next.t('aiProvider.defaultTierModel', { tier: getAiModelTierDefaultBadgeLabel(tier) })
)

export const normalizeAiModelTier = (
  tier?: AiModelTier | string | null,
  fallback: AiModelTier = 'deep',
): AiModelTier => {
  if (tier === 'fast' || tier === 'balanced' || tier === 'deep') return tier
  return fallback
}

export const getAiTierDefaultSelection = (
  defaultSelections?: AiDefaultModelSelections | null,
  tier?: AiModelTier | string | null,
) => defaultSelections?.[normalizeAiModelTier(tier)] || null

export const setAiTierDefaultSelection = (
  defaultSelections: AiDefaultModelSelections | null | undefined,
  tier: AiModelTier | string | null | undefined,
  selection?: AiTierDefaultSelection | null,
): AiDefaultModelSelections => {
  const normalizedProviderId = String(selection?.providerId || '').trim()
  const normalizedModelId = String(selection?.modelId || '').trim()
  const normalizedSelection = normalizedProviderId && normalizedModelId
    ? {
      providerId: normalizedProviderId,
      modelId: normalizedModelId,
    }
    : null

  return {
    fast: defaultSelections?.fast || null,
    balanced: defaultSelections?.balanced || null,
    deep: defaultSelections?.deep || null,
    [normalizeAiModelTier(tier)]: normalizedSelection,
  }
}

export const serializeAiTierSelectionValue = (selection?: AiTierDefaultSelection | null) => {
  const providerId = String(selection?.providerId || '').trim()
  const modelId = String(selection?.modelId || '').trim()
  return providerId && modelId ? `${providerId}::${modelId}` : ''
}

export const getAiModelDisplayName = (
  displayName?: string | null,
  _providerType?: AiProviderType | string | null,
  fallbackModel?: string | null,
) => {
  return String(displayName || fallbackModel || '').trim()
}

export const shouldExposeAiModelRawName = (
  displayName?: string | null,
  model?: string | null,
  providerType?: AiProviderType | string | null,
) => {
  const rawName = String(model || '').trim()
  if (!rawName || isBuiltinAiProviderType(providerType)) {
    return false
  }
  return getAiModelDisplayName(displayName, providerType, model) !== rawName
}

export const isAiModelDefaultSelection = (
  current?: Pick<AiThreadModelSelection, 'providerId' | 'modelId'> | null,
  candidate?: Pick<AiThreadModelSelection, 'providerId' | 'modelId'> | null,
) => {
  const currentProviderId = String(current?.providerId || '').trim()
  const currentModelId = String(current?.modelId || '').trim()
  const candidateProviderId = String(candidate?.providerId || '').trim()
  const candidateModelId = String(candidate?.modelId || '').trim()
  return Boolean(
    currentProviderId
    && currentModelId
    && currentProviderId === candidateProviderId
    && currentModelId === candidateModelId,
  )
}

export const isAiModelTierDefaultSelection = (
  defaultSelections?: AiDefaultModelSelections | null,
  tier?: AiModelTier | string | null,
  candidate?: Pick<AiThreadModelSelection, 'providerId' | 'modelId'> | null,
) => isAiModelDefaultSelection(
  getAiTierDefaultSelection(defaultSelections, tier),
  candidate,
)

export const buildAiThreadModelOptions = (
  items: AiModelCatalogItem[],
  getCatalogItemLabel: (item?: Pick<AiModelCatalogItem, 'label' | 'providerName' | 'providerType'> | null) => string,
): AiThreadModelOption[] => {
  return items.map(item => ({
    value: `${item.providerId}::${item.modelId}`,
    label: getCatalogItemLabel(item),
    providerId: item.providerId,
    modelId: item.modelId,
    model: item.model,
    modelSelectionSource: 'explicit' as const,
  }))
}

export const resolveThreadModelSelectorValue = (
  source?: AiThreadModelSelectionSource | null,
  selection?: Pick<AiThreadModelSelection, 'providerId' | 'modelId'> | null,
) => {
  if (source !== 'explicit') {
    return ''
  }

  const providerId = String(selection?.providerId || '').trim()
  const modelId = String(selection?.modelId || '').trim()
  return providerId && modelId
    ? `${providerId}::${modelId}`
    : ''
}
