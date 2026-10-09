import axios from 'axios'
import i18next from 'i18next'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  AiModelCatalog,
  AiModelCatalogItem,
  AiProviderConfig,
  AiProviderModel,
  AiSettings,
  AiThreadModelSelection,
} from '@common/types/ai-provider'
import {
  buildAiThreadModelOptions,
  BUILTIN_AI_PROVIDER_ID,
  getAiModelDisplayName,
} from '@common/utils/aiProvider'

const createEmptySettings = (): AiSettings => ({
  enabled: true,
  autoTaskEnabled: false,
  allowModelSelection: false,
  defaultSelections: {
    fast: null,
    balanced: null,
    deep: null,
  },
  defaultProviderId: null,
  defaultModelId: null,
  providers: [],
})

const createEmptyCatalog = (): AiModelCatalog => ({
  enabled: false,
  allowModelSelection: false,
  defaultProviderId: null,
  defaultModelId: null,
  items: [],
})

export const useAiConfigStore = defineStore('aiConfig', () => {
  const config = ref<AiSettings | null>(null)
  const catalog = ref<AiModelCatalog>(createEmptyCatalog())
  const configLoading = ref(false)
  const catalogLoading = ref(false)
  const configPermissionDenied = ref(false)
  const catalogLoaded = ref(false)
  let catalogRequest: Promise<AiModelCatalog> | null = null
  const getCatalogItemLabel = (item?: Pick<AiModelCatalogItem, 'label' | 'providerName' | 'providerType'> | null) => (
    item?.label || ''
  )

  const loadConfig = async (force = false) => {
    if (config.value && !force) {
      return config.value
    }

    configLoading.value = true
    try {
      const response = await axios.get<AiSettings>('/ai/config', {
        silentForbidden: true,
      } as any)
      if (!response?.data) {
        config.value = createEmptySettings()
        return config.value
      }
      configPermissionDenied.value = false
      const { data } = response
      config.value = data
      return config.value
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        configPermissionDenied.value = true
        config.value = null
        return null
      }
      throw error
    } finally {
      configLoading.value = false
    }
  }

  const applyConfigResponse = (data?: AiSettings | null) => {
    if (!data) return null
    configPermissionDenied.value = false
    config.value = data
    return data
  }

  const updateGlobalConfig = async (patch: Partial<AiSettings>) => {
    configLoading.value = true
    try {
      const response = await axios.patch<AiSettings>('/ai/config', patch, {
        silentForbidden: true,
      } as any)
      return applyConfigResponse(response?.data)
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        configPermissionDenied.value = true
        config.value = null
        return null
      }
      throw error
    } finally {
      configLoading.value = false
    }
  }

  const createProvider = async (input: AiProviderConfig) => {
    const { data } = await axios.post<AiSettings>('/ai/providers', input, { silentForbidden: true } as any)
    return applyConfigResponse(data)
  }

  const updateProvider = async (providerId: string, patch: Partial<AiProviderConfig>) => {
    const { data } = await axios.patch<AiSettings>(`/ai/providers/${providerId}`, patch, { silentForbidden: true } as any)
    // 服务商启停会改变聊天里可选的模型集合，写入后立刻回源，避免聊天列表停留在旧快照
    if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) void loadCatalog(true).catch(() => null)
    return applyConfigResponse(data)
  }

  const deleteProvider = async (providerId: string) => {
    const { data } = await axios.delete<AiSettings>(`/ai/providers/${providerId}`, { silentForbidden: true } as any)
    return applyConfigResponse(data)
  }

  const createModel = async (providerId: string, input: AiProviderModel) => {
    const { data } = await axios.post<AiSettings>(`/ai/providers/${providerId}/models`, input, { silentForbidden: true } as any)
    return applyConfigResponse(data)
  }

  const updateModel = async (providerId: string, modelId: string, patch: Partial<AiProviderModel>) => {
    const { data } = await axios.patch<AiSettings>(`/ai/providers/${providerId}/models/${modelId}`, patch, { silentForbidden: true } as any)
    return applyConfigResponse(data)
  }

  const deleteModel = async (providerId: string, modelId: string) => {
    const { data } = await axios.delete<AiSettings>(`/ai/providers/${providerId}/models/${modelId}`, { silentForbidden: true } as any)
    return applyConfigResponse(data)
  }

  const syncProviderModels = async (providerId: string) => {
    const { data } = await axios.post<AiSettings>(`/ai/providers/${providerId}/sync-models`, undefined, { silentForbidden: true } as any)
    return applyConfigResponse(data)
  }

  // The settings panel still edits a local draft. Diff it into row-level requests;
  // no API receives a complete AiSettings snapshot.
  const saveConfig = async (nextConfig: AiSettings) => {
    const current = config.value || await loadConfig()
    const globalPatch: Partial<AiSettings> = {}
    for (const key of ['enabled', 'autoTaskEnabled', 'allowModelSelection', 'defaultSelections', 'featureFlags', 'migrations'] as const) {
      if (JSON.stringify(current?.[key]) !== JSON.stringify(nextConfig[key])) globalPatch[key] = nextConfig[key] as any
    }
    let saved = current
    if (Object.keys(globalPatch).length) saved = await updateGlobalConfig(globalPatch)

    const currentProviders = new Map((current?.providers || []).map(provider => [provider.id, provider]))
    const nextProviders = new Map((nextConfig.providers || []).map(provider => [provider.id, provider]))
    for (const provider of currentProviders.values()) {
      if (!nextProviders.has(provider.id) && provider.managementMode !== 'fixed' && provider.type !== 'builtin-cloud') {
        saved = await deleteProvider(provider.id)
      }
    }
    for (const nextProvider of nextProviders.values()) {
      const previousProvider = currentProviders.get(nextProvider.id)
      if (!previousProvider) {
        if (nextProvider.managementMode !== 'fixed' && nextProvider.type !== 'builtin-cloud') saved = await createProvider(nextProvider)
        continue
      }
      const providerPatch: Partial<AiProviderConfig> = {}
      for (const key of ['name', 'type', 'enabled', 'baseUrl'] as const) {
        if (previousProvider[key] !== nextProvider[key]) Object.assign(providerPatch, { [key]: nextProvider[key] })
      }
      const apiKey = String(nextProvider.apiKey || '').trim()
      const previousApiKey = previousProvider.apiKey == null ? null : String(previousProvider.apiKey).trim()
      const nextApiKey = nextProvider.apiKey == null ? null : apiKey
      if (Object.prototype.hasOwnProperty.call(nextProvider, 'apiKey')
        && nextApiKey !== previousApiKey) providerPatch.apiKey = apiKey
      if (Object.keys(providerPatch).length) saved = await updateProvider(nextProvider.id, providerPatch)

      const previousModels = new Map((previousProvider.models || []).map(model => [model.id, model]))
      const previousAvailableModels = new Map((previousProvider.availableModels || []).map(model => [model.id, model]))
      const nextModels = new Map((nextProvider.models || []).map(model => [model.id, model]))
      for (const model of previousModels.values()) {
        if (!nextModels.has(model.id)) {
          if (nextProvider.managementMode === 'fixed' || nextProvider.type === 'builtin-cloud') {
            saved = await updateModel(nextProvider.id, model.id, { enabled: false })
          } else if (previousAvailableModels.has(model.id)) {
            saved = await updateModel(nextProvider.id, model.id, { source: 'sync' })
          } else {
            saved = await deleteModel(nextProvider.id, model.id)
          }
        }
      }
      for (const model of nextModels.values()) {
        const previousModel = previousModels.get(model.id) || previousAvailableModels.get(model.id)
        if (!previousModel) {
          saved = await createModel(nextProvider.id, model)
        } else if (JSON.stringify(previousModel) !== JSON.stringify(model)) {
          const modelPatch: Partial<AiProviderModel> = {}
          for (const key of [
            'model',
            'displayName',
            'tier',
            'enabled',
            'available',
            'allowInWorkbenchAgent',
            'supportsTools',
            'toolCapabilities',
            'supportsVision',
            'capabilities',
            'inputModalities',
            'outputModalities',
            'endpointTypes',
            'maxInputTokens',
            'maxOutputTokens',
            'supportsStreaming',
            'contextWindow',
            'source',
            'validationStatus',
            'validationMessage',
            'validationChecks',
            'lastValidatedAt',
            'remark',
            'meta',
          ] as const) {
            if (JSON.stringify(previousModel[key]) !== JSON.stringify(model[key])) {
              Object.assign(modelPatch, { [key]: model[key] })
            }
          }
          if (Object.keys(modelPatch).length) saved = await updateModel(nextProvider.id, model.id, modelPatch)
        }
      }
    }
    return saved || config.value
  }

  const loadCatalog = async (force = false) => {
    if (catalogRequest) {
      return await catalogRequest
    }

    if (catalogLoaded.value && !force) {
      return catalog.value
    }

    catalogLoading.value = true
    catalogRequest = (async () => {
      try {
        const { data } = await axios.get<AiModelCatalog>('/ai/models/catalog')
        catalog.value = data || createEmptyCatalog()
        catalogLoaded.value = true
        return catalog.value
      } finally {
        catalogLoading.value = false
        catalogRequest = null
      }
    })()

    return await catalogRequest
  }

  const refreshAll = async () => {
    await Promise.all([
      loadConfig(true).catch(() => null),
      loadCatalog(true).catch(() => null),
    ])
  }

  const findCatalogItem = (selection?: AiThreadModelSelection | null) => {
    const providerId = String(selection?.providerId || '').trim()
    const modelId = String(selection?.modelId || '').trim()
    const model = String(selection?.model || '').trim()

    return catalog.value.items.find(item => {
      const providerMatched = !providerId || item.providerId === providerId
      const modelIdMatched = !modelId || item.modelId === modelId
      const modelMatched = !model || item.model === model
      return providerMatched && modelIdMatched && modelMatched
    }) || null
  }

  const getSelectionLabel = (selection?: AiThreadModelSelection | null) => {
    const catalogItem = findCatalogItem(selection)
    if (catalogItem) {
      return getCatalogItemLabel(catalogItem)
    }

    const providerId = String(selection?.providerId || '').trim()
    const modelId = String(selection?.modelId || '').trim()
    const model = String(selection?.model || '').trim()
    if (!providerId && !modelId && !model) {
      return ''
    }
    const provider = config.value?.providers.find(item => item.id === providerId) || null
    const providerType = provider?.type || (providerId === BUILTIN_AI_PROVIDER_ID ? 'builtin-cloud' : undefined)
    if (providerType === 'builtin-cloud') {
      const modelEntry = provider?.models.find(item => item.id === modelId || item.model === model)
      const modelName = modelEntry?.displayName || modelEntry?.model || modelEntry?.id || model || modelId
      return [i18next.t('aiConfig.builtinProviderName'), modelName].filter(Boolean).join(' / ')
    }
    const displayName = getAiModelDisplayName(model || modelId, providerType, modelId) || model || modelId || '-'
    return [provider?.name || providerId || '-', displayName].join(' / ')
  }

  const modelOptions = computed(() => buildAiThreadModelOptions(
    catalog.value.items,
    getCatalogItemLabel,
  ))

  return {
    catalog,
    catalogLoading,
    config,
    configLoading,
    configPermissionDenied,
    findCatalogItem,
    createModel,
    createProvider,
    deleteModel,
    deleteProvider,
    getSelectionLabel,
    loadCatalog,
    loadConfig,
    modelOptions,
    refreshAll,
    saveConfig,
    syncProviderModels,
    updateGlobalConfig,
    updateModel,
    updateProvider,
  }
})
