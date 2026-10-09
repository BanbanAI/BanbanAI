import { Inject, Injectable } from '@nestjs/common'
import md5 from 'md5'
import { unique } from '@common/utils/unique'
import { SERVER_ENDPOINT } from '@main/constants'
import { RequestStorage } from '@main/middleware'
import type {
  AiDefaultModelSelections,
  AiBuiltinPreflightResult,
  AiBuiltinRouteChecks,
  AiBuiltinRouteStatus,
  AiFeatureFlags,
  AiModelCatalog,
  AiModelCatalogItem,
  AiModelTier,
  AiModelToolCapabilities,
  AiModelValidationChecks,
  AiModelHealthCheckResult,
  AiModelHealthCheckKeyResult,
  AiModelValidationResult,
  AiModelValidationStatus,
  AiProviderConfig,
  AiProviderHealthStatus,
  AiProviderModel,
  AiProviderTestResult,
  AiProviderType,
  AiSettings,
  AiSettingsMigrations,
  AiTierDefaultSelection,
  AiThreadModelSelection,
  AiThreadModelSelectionSource,
} from '@common/types/ai-provider'
import {
  BUILTIN_AI_MODEL_PUBLIC_ID,
  BUILTIN_AI_PROVIDER_ID,
  getAiModelTierLabel,
  getAiModelDisplayName,
} from '@common/utils/aiProvider'
import { AIRest } from '../../client'
import { UserService } from '../../user/user.service'
import { AiConfigStore } from './ai-config.store'
import { AiProviderCredentialStore } from './ai-provider-credential.store'
import type { AiConversationProfile, AiReasoningLevel, AiReasoningMode, AiResolvedModelSelection, AiRuntimePurpose } from '../ai.types'
import { AiRuntimeUserActionableError } from '../errors/ai-runtime-error'
import { normalizeAiFeatureFlags } from './ai-feature-flags.util'
import {
  AI_MODEL_CAPABILITIES,
  AI_MODEL_ENDPOINT_TYPES,
  AI_MODEL_MODALITIES,
  aiModelSupportsImageInput,
  normalizeAiModelCapabilities,
  normalizeAiModelEndpointTypes,
  normalizeAiModelModalities,
  resolveKnownAiModelCapabilities,
} from '@common/utils/aiModelCapabilities'

type AiRuntimeConfig = {
  providerId: string
  providerName: string
  providerType: AiProviderType
  modelId: string
  model: string
  publicModelId?: string
  publicModel?: string
  effectiveModelId?: string
  effectiveModel?: string
  routePolicyId?: string
  routeVersion?: string
  fallbackHit?: boolean
  requestedReasoningLevel?: AiReasoningLevel
  effectiveReasoningLevel?: AiReasoningLevel
  reasoningMode?: AiReasoningMode
  supportsParallelToolCalls?: boolean
  capabilities: AiProviderModel['capabilities']
  inputModalities: AiProviderModel['inputModalities']
  outputModalities: AiProviderModel['outputModalities']
  endpointTypes: AiProviderModel['endpointTypes']
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
  contextWindow?: number | null
  supportsStreaming: boolean
  modelKwargs?: Record<string, any>
  baseUrl?: string
  apiKey?: string
  requiresApiKey: boolean
  shouldSendAuthorization: boolean
}

type AiRuntimeAccountContext = {
  id?: string | null
  realname?: string | null
  user?: string | null
}

type DiscoverModelOptions = {
  providerType: AiProviderType
  source: AiProviderModel['source']
  enabled?: boolean
  allowInWorkbenchAgent?: boolean
  supportsTools?: boolean
  supportsVision?: boolean
  capabilities?: AiProviderModel['capabilities']
  inputModalities?: AiProviderModel['inputModalities']
  outputModalities?: AiProviderModel['outputModalities']
  endpointTypes?: AiProviderModel['endpointTypes']
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
  contextWindow?: number | null
  supportsStreaming?: boolean
  validationStatus?: AiModelValidationStatus
}

type ValidationCheckResult = {
  ok: boolean
  message: string
  skipped?: boolean
}

type ToolValidationMode = 'auto' | 'require-any' | 'require-specific' | 'parallel'

const AI_MODEL_VALIDATION_TIMEOUT = Symbol('ai-model-validation-timeout')
type AiProviderValidationRuntime = AiProviderConfig & {
  [AI_MODEL_VALIDATION_TIMEOUT]?: number
}

@Injectable()
export class AiConfigService {
  static readonly BUILTIN_PROVIDER_ID = BUILTIN_AI_PROVIDER_ID
  static readonly BUILTIN_MODEL_PUBLIC_ID = BUILTIN_AI_MODEL_PUBLIC_ID
  static readonly BUILTIN_PROVIDER_NAME = 'BanbanAI'
  static readonly BUILTIN_REMOVED_MODELS = ['gpt-5.4']
  private static readonly API_KEY_CIPHERTEXT_DISPLAY_LENGTH = 67
  private static readonly READONLY_SETTINGS_CACHE_TTL_MS = 5_000
  private static readonly BUILTIN_MODELS_CACHE_TTL_MS = 5_000
  private static readonly BUILTIN_MODELS_SYNC_TTL_MS = 24 * 60 * 60 * 1000
  private static readonly EXTERNAL_PARALLEL_MIGRATION_VERSION = 2
  private static readonly EXTERNAL_PARALLEL_MIGRATION_RETRY_TTL_MS = 5 * 60 * 1000

  private readonlySettingsCache: { settings: AiSettings; expiresAt: number; platformAccountId: string | null } | null = null
  private settingsLoadInFlight: { platformAccountId: string | null; promise: Promise<AiSettings> } | null = null
  private settingsRevision = 0
  private builtinModelsCache: { models: AiProviderModel[]; expiresAt: number; platformAccountId: string | null } | null = null
  private builtinModelsInFlight: { accountId: string | null; promise: Promise<AiProviderModel[]> } | null = null

  constructor(
    @Inject(SERVER_ENDPOINT) private readonly serverHost: string,
    private readonly aiRest: AIRest,
    private readonly userService: UserService,
    private readonly aiConfigStore: AiConfigStore,
    private readonly credentialStore: AiProviderCredentialStore,
  ) {}

  async getConfig() {
    const platformAccountId = this.getCurrentPlatformAccountId()
    const settings = platformAccountId
      ? await this.loadSettings(false)
      : this.normalizeSettings(await this.aiConfigStore.loadSnapshot({
        platformAccountId,
        includeSecrets: true,
        includePersistedBuiltinManagedModels: true,
      }))
    return this.toPublicSettings(settings)
  }

  async getFeatureFlags(profile?: AiConversationProfile | null): Promise<AiFeatureFlags> {
    const settings = await this.loadSettings(false)
    const featureFlags = this.normalizeFeatureFlags(settings.featureFlags)
    return this.applyFeatureFlagsProfile(
      settings.autoTaskEnabled ? featureFlags : {
        ...featureFlags,
        semanticWarmupEnabled: false,
      },
      profile,
    )
  }

  async saveConfig(input: Partial<AiSettings> | AiSettings) {
    if (Array.isArray(input?.providers)) {
      throw this.createAiConfigError(
        'AI_CONFIG_SNAPSHOT_UNSUPPORTED',
        'AI provider settings must be updated through provider and model APIs.',
      )
    }
    const current = await this.loadSettings(false)
    const hasDefaultSelectionsPatch = Boolean(input && Object.prototype.hasOwnProperty.call(input, 'defaultSelections'))
    const hasDefaultProviderPatch = Boolean(input && Object.prototype.hasOwnProperty.call(input, 'defaultProviderId'))
    const hasDefaultModelPatch = Boolean(input && Object.prototype.hasOwnProperty.call(input, 'defaultModelId'))
    const interactiveDefaultTier = this.getInteractiveDefaultTier()
    const mergedDefaultSelections = (hasDefaultProviderPatch || hasDefaultModelPatch) && !hasDefaultSelectionsPatch
      ? this.normalizeDefaultSelections({
        ...(current.defaultSelections || {}),
        [interactiveDefaultTier]: {
          providerId: hasDefaultProviderPatch ? input?.defaultProviderId : current.defaultProviderId,
          modelId: hasDefaultModelPatch ? input?.defaultModelId : current.defaultModelId,
        },
      })
      : (hasDefaultSelectionsPatch ? input?.defaultSelections : current.defaultSelections)
    const nextSettings = this.applyBuiltinLegacyModelMigration(this.normalizeSettings({
      ...current,
      ...input,
      defaultSelections: mergedDefaultSelections,
      providers: current.providers,
    }))
    if (hasDefaultSelectionsPatch || hasDefaultProviderPatch || hasDefaultModelPatch) {
      this.assertDefaultSelectionsValid(nextSettings)
    }
    if (this.isSameSettings(current, nextSettings)) {
      this.setReadonlySettingsCache(current)
      return this.toPublicSettings(current)
    }
    await this.aiConfigStore.saveGlobalConfig({
      enabled: nextSettings.enabled,
      autoTaskEnabled: nextSettings.autoTaskEnabled,
      allowModelSelection: nextSettings.allowModelSelection,
      defaultSelections: nextSettings.defaultSelections,
      featureFlags: nextSettings.featureFlags,
      migrations: nextSettings.migrations,
    })
    this.clearReadonlySettingsCache()
    return await this.getConfig()
  }

  async createProvider(input: AiProviderConfig) {
    await this.aiConfigStore.createProvider(input)
    this.clearReadonlySettingsCache()
    return await this.getConfig()
  }

  async updateProvider(providerId: string, input: Partial<AiProviderConfig> & {
    addApiKeys?: Array<{ value: string; label?: string | null }>
  }) {
    await this.aiConfigStore.updateProvider(providerId, input)
    this.clearReadonlySettingsCache()
    return await this.getConfig()
  }

  async deleteProvider(providerId: string) {
    await this.aiConfigStore.deleteProvider(providerId)
    this.clearReadonlySettingsCache()
    return await this.getConfig()
  }

  async createProviderModel(providerId: string, input: AiProviderModel) {
    await this.aiConfigStore.createModel(providerId, input)
    this.clearReadonlySettingsCache()
    return await this.getConfig()
  }

  async updateProviderModel(providerId: string, modelId: string, input: Partial<AiProviderModel>) {
    await this.aiConfigStore.updateModel(providerId, modelId, input)
    this.clearReadonlySettingsCache()
    return await this.getConfig()
  }

  async deleteProviderModel(providerId: string, modelId: string) {
    await this.aiConfigStore.deleteModel(providerId, modelId)
    this.clearReadonlySettingsCache()
    return await this.getConfig()
  }

  async getCatalog(options?: { includeRestrictedItems?: boolean }): Promise<AiModelCatalog> {
    const settings = await this.loadSettings(false)
    const allowModelSelection = this.isModelSelectionAllowedForCurrentUser(settings)
    const includeRestrictedItems = options?.includeRestrictedItems === true
    return {
      enabled: settings.enabled,
      allowModelSelection,
      defaultProviderId: settings.defaultProviderId || null,
      defaultModelId: settings.defaultModelId || null,
      featureFlags: settings.autoTaskEnabled
        ? this.normalizeFeatureFlags(settings.featureFlags)
        : {
          ...this.normalizeFeatureFlags(settings.featureFlags),
          semanticWarmupEnabled: false,
        },
      items: settings.enabled && (allowModelSelection || includeRestrictedItems)
        ? this.buildCatalogItems(settings)
        : [],
    }
  }


  async syncProviderModels(providerId: string) {
    const platformAccountId = this.getCurrentPlatformAccountId()
    const settings = await this.loadSettings(false)
    const provider = this.assertProvider(settings, providerId)
    const selectAllBuiltinModels = this.shouldSelectAllBuiltinModelsOnBootstrap(settings, provider)
    const discoveredModels = await this.discoverProviderModels(provider)
    const mergedProvider = this.normalizeProvider({
      ...this.mergeDiscoveredModels(provider, discoveredModels, {
        selectNewBuiltinModels: selectAllBuiltinModels,
      }),
      ...(provider.requiresPlatformLogin
        ? { lastSyncedAccountId: platformAccountId }
        : {}),
      builtinModelsSyncedAt: Date.now(),
    }, provider)
    if (provider.type === 'builtin-cloud') {
      const nextSettings = this.applyBuiltinLegacyModelMigration(this.normalizeSettings({
        ...settings,
        providers: settings.providers.map(item => item.id === provider.id ? mergedProvider : item),
      }), {
        selectAllBuiltinModels,
      })
      await this.persistSettings(nextSettings)
    } else {
      await this.aiConfigStore.saveProviderSnapshot(mergedProvider)
    }
    this.clearReadonlySettingsCache()
    return await this.getConfig()
  }

  async resolveModelSelection(
    currentSelection?: AiThreadModelSelection | null,
    requestedSelection?: AiThreadModelSelection | null,
  ): Promise<AiResolvedModelSelection> {
    const settings = await this.loadSettings(false)
    if (!settings.enabled) {
      throw new AiRuntimeUserActionableError(
        'AI_CONFIG_DISABLED',
        global.i18next.t('aiConfigService.aiDisabledContactAdmin'),
        'configuration',
      )
    }

    if (!this.isModelSelectionAllowedForCurrentUser(settings)) {
      const defaultSelection = this.resolveDefaultSelection(settings)
      if (!defaultSelection) {
        throw new AiRuntimeUserActionableError(
          'AI_MODEL_UNAVAILABLE',
          global.i18next.t('aiConfigService.noAvailableModel'),
          'configuration',
        )
      }
      return defaultSelection
    }

    const normalizedCurrent = this.normalizeSelection(currentSelection)
    const normalizedRequested = this.normalizeSelection(requestedSelection)
    const currentSelectionSource = this.resolveSelectionSource(currentSelection, {
      fallbackToDefaultWhenSelectionExists: true,
    })
    const requestedSelectionSource = this.resolveSelectionSource(requestedSelection)
    const hasCurrentSelection = this.hasSelection(normalizedCurrent)
    const hasRequestedSelection = this.hasSelection(normalizedRequested)
    const hasRequestedSelectionPatch = this.hasSelectionPatch(requestedSelection)
    const shouldFollowDefault = requestedSelectionSource === 'default'
      || (hasRequestedSelectionPatch && !hasRequestedSelection)
      || (!hasRequestedSelectionPatch && currentSelectionSource === 'default')
    const defaultSelection = this.resolveDefaultSelection(settings)
    if (shouldFollowDefault) {
      if (!defaultSelection) {
        throw new AiRuntimeUserActionableError(
          'AI_MODEL_UNAVAILABLE',
          global.i18next.t('aiConfigService.noAvailableModel'),
          'configuration',
        )
      }
      return defaultSelection
    }

    const mergedSelection = this.mergeSelection(
      currentSelectionSource === 'default'
        ? this.normalizeSelection(defaultSelection)
        : normalizedCurrent,
      normalizedRequested,
      requestedSelection,
    )
    const finalSelectionSource = this.resolveFinalSelectionSource({
      currentSelectionSource,
      requestedSelectionSource,
      hasRequestedSelection,
      hasRequestedSelectionPatch,
    })

    const resolved = this.resolveSelectionFromSettings(settings, mergedSelection, finalSelectionSource, {
      requiredBuiltinTier: this.getInteractiveDefaultTier(),
    })
    if (resolved) {
      return resolved
    }

    if (hasCurrentSelection || hasRequestedSelection || hasRequestedSelectionPatch) {
      throw new AiRuntimeUserActionableError(
        'AI_MODEL_SELECTION_INVALID',
        this.buildSelectionInvalidMessage(settings, mergedSelection),
        'selection',
      )
    }

    if (!defaultSelection) {
      throw new AiRuntimeUserActionableError(
        'AI_MODEL_UNAVAILABLE',
        global.i18next.t('aiConfigService.noAvailableModel'),
        'configuration',
      )
    }

    return defaultSelection
  }

  async resolveRuntimeConfig(
    currentSelection?: AiThreadModelSelection | null,
    requestedSelection?: AiThreadModelSelection | null,
    options?: {
      reasoningLevel?: AiReasoningLevel | null
      purpose?: AiRuntimePurpose | null
      account?: AiRuntimeAccountContext | null
    } | null,
  ): Promise<AiRuntimeConfig> {
    const loadedSettings = await this.loadSettings(false)
    if (!loadedSettings.enabled) {
      throw new AiRuntimeUserActionableError(
        'AI_CONFIG_DISABLED',
        global.i18next.t('aiConfigService.aiDisabledEnableFirst'),
        'configuration',
      )
    }
    const runtimePurpose = this.normalizeRuntimePurpose(options?.purpose)
    if (runtimePurpose === 'ai-semantic-warmup' && !loadedSettings.autoTaskEnabled) {
      throw new AiRuntimeUserActionableError(
        'AI_RUNTIME_PURPOSE_UNAVAILABLE',
        global.i18next.t('aiConfigService.autoTaskDisabled'),
        'configuration',
      )
    }
    const selection = this.resolveRuntimeSelectionForPurpose(
      loadedSettings,
      currentSelection,
      requestedSelection,
      runtimePurpose,
    )
    const runtimeResolved = await this.ensureExternalModelParallelCapabilityForRuntime(
      loadedSettings,
      selection,
    )
    const provider = runtimeResolved.provider
    const requestedReasoningLevel = this.normalizeReasoningLevel(options?.reasoningLevel)

    if (provider.type === 'builtin-cloud') {
      const routeResolution = this.resolveBuiltinEffectiveModel(
        provider,
        currentSelection,
        requestedSelection,
        requestedReasoningLevel,
        runtimePurpose,
      )
      const builtinRuntime = this.buildBuiltinRuntimeConfig(
        routeResolution.model,
        this.resolveBuiltinRuntimeAccount(options?.account),
      )
      return {
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.type,
        modelId: routeResolution.model.id,
        model: routeResolution.model.model,
        publicModelId: selection.modelId,
        publicModel: selection.model,
        effectiveModelId: routeResolution.model.id,
        effectiveModel: routeResolution.model.model,
        routePolicyId: routeResolution.routePolicyId,
        routeVersion: routeResolution.routeVersion,
        fallbackHit: routeResolution.fallbackHit,
        requestedReasoningLevel,
        effectiveReasoningLevel: routeResolution.effectiveReasoningLevel,
        reasoningMode: routeResolution.reasoningMode,
        supportsParallelToolCalls: Boolean(routeResolution.model.toolCapabilities?.parallel),
        capabilities: routeResolution.model.capabilities,
        inputModalities: routeResolution.model.inputModalities,
        outputModalities: routeResolution.model.outputModalities,
        endpointTypes: routeResolution.model.endpointTypes,
        maxInputTokens: routeResolution.model.maxInputTokens,
        maxOutputTokens: routeResolution.model.maxOutputTokens,
        contextWindow: routeResolution.model.contextWindow,
        supportsStreaming: routeResolution.model.supportsStreaming,
        modelKwargs: routeResolution.modelKwargs,
        baseUrl: builtinRuntime.baseUrl,
        apiKey: builtinRuntime.apiKey,
        requiresApiKey: true,
        shouldSendAuthorization: true,
      }
    }

    const model = runtimeResolved.model || this.assertModel(provider, selection.modelId)
    const externalReasoningConfig = this.resolveExternalReasoningRuntimeConfig(
      provider,
      model,
      requestedReasoningLevel,
      runtimePurpose,
    )
    const baseUrl = this.normalizeProviderBaseUrl(provider.baseUrl, provider.type)
    if (!baseUrl) {
      throw this.createProviderBaseUrlMissingError(provider)
    }
    const auth = await this.resolveExternalProviderRuntimeAuth(provider)

    return {
      providerId: provider.id,
      providerName: provider.name,
      providerType: provider.type,
      modelId: externalReasoningConfig.model.id,
      model: externalReasoningConfig.model.model,
      publicModelId: selection.modelId,
      publicModel: selection.model,
      effectiveModelId: externalReasoningConfig.model.id,
      effectiveModel: externalReasoningConfig.model.model,
      routePolicyId: externalReasoningConfig.routePolicyId,
      routeVersion: externalReasoningConfig.routeVersion,
      fallbackHit: externalReasoningConfig.fallbackHit,
      requestedReasoningLevel,
      effectiveReasoningLevel: externalReasoningConfig.effectiveReasoningLevel,
      reasoningMode: externalReasoningConfig.reasoningMode,
      supportsParallelToolCalls: Boolean(externalReasoningConfig.model.toolCapabilities?.parallel),
      capabilities: externalReasoningConfig.model.capabilities,
      inputModalities: externalReasoningConfig.model.inputModalities,
      outputModalities: externalReasoningConfig.model.outputModalities,
      endpointTypes: externalReasoningConfig.model.endpointTypes,
      maxInputTokens: externalReasoningConfig.model.maxInputTokens,
      maxOutputTokens: externalReasoningConfig.model.maxOutputTokens,
      contextWindow: externalReasoningConfig.model.contextWindow,
      supportsStreaming: externalReasoningConfig.model.supportsStreaming,
      modelKwargs: externalReasoningConfig.modelKwargs,
      baseUrl,
      apiKey: auth.apiKey,
      requiresApiKey: auth.requiresApiKey,
      shouldSendAuthorization: auth.shouldSendAuthorization,
    }
  }

  getBuiltinProviderId() {
    return AiConfigService.BUILTIN_PROVIDER_ID
  }

  async toPublicSelection(selection?: AiThreadModelSelection | null): Promise<AiThreadModelSelection> {
    const settings = await this.loadSettings(false)
    return this.toPublicSelectionFromSettings(settings, selection)
  }

  async createPublicSelectionResolver(): Promise<(selection?: AiThreadModelSelection | null) => AiThreadModelSelection> {
    const settings = await this.loadSettings(false)
    return (selection?: AiThreadModelSelection | null) => this.toPublicSelectionFromSettings(settings, selection)
  }

  private async resolveExternalProviderRuntimeAuth(provider: AiProviderConfig) {
    const apiKey = this.normalizeText(provider.apiKey)
      || this.normalizeText(await this.credentialStore.getPreferredValue(provider.id))
      || undefined
    const allowsAnonymousAccess = provider.type === 'ollama' || provider.type === 'openai-compatible'

    return {
      apiKey,
      requiresApiKey: !allowsAnonymousAccess,
      shouldSendAuthorization: Boolean(apiKey),
    }
  }

  private async patchProvider(providerId: string, updater: (provider: AiProviderConfig) => AiProviderConfig) {
    const settings = await this.loadSettings(false)
    const nextSettings = this.updateProviderInSettings(settings, providerId, updater)
    await this.persistSettings(nextSettings)
    return nextSettings
  }

  private async loadSettings(refreshBuiltinModels: boolean) {
    const platformAccountId = this.getCurrentPlatformAccountId()
    if (!refreshBuiltinModels) {
      const cachedSettings = this.getReadonlySettingsCache(platformAccountId)
      if (cachedSettings) {
        return cachedSettings
      }
    }
    if (this.settingsLoadInFlight?.platformAccountId === platformAccountId) {
      return await this.settingsLoadInFlight.promise
    }

    const loadTask = (async () => {
      let revision = this.settingsRevision
      let refreshed: AiSettings
      do {
        revision = this.settingsRevision
        const snapshot = await this.aiConfigStore.loadSnapshot({
          platformAccountId,
          includeSecrets: true,
        })
        const normalized = this.normalizeSettings(snapshot)
        refreshed = platformAccountId
          ? await this.refreshBuiltinProviderModels(normalized, refreshBuiltinModels, revision, platformAccountId)
          : normalized
      } while (revision !== this.settingsRevision)
      if (!refreshBuiltinModels) this.setReadonlySettingsCache(refreshed, platformAccountId)
      return refreshed
    })()
    this.settingsLoadInFlight = { platformAccountId, promise: loadTask }
    void loadTask.finally(() => {
      if (this.settingsLoadInFlight?.promise === loadTask) this.settingsLoadInFlight = null
    }).catch(() => undefined)
    return await loadTask
  }

  private updateProviderInSettings(
    settings: AiSettings,
    providerId: string,
    updater: (provider: AiProviderConfig) => AiProviderConfig,
  ) {
    const nextProviders = settings.providers.map(provider => {
      if (provider.id !== providerId) {
        return provider
      }
      return this.normalizeProvider(updater(provider), provider)
    })

    return this.normalizeSettings({
      ...settings,
      providers: nextProviders,
    })
  }

  private async refreshBuiltinProviderModels(
    settings: AiSettings,
    force: boolean,
    revision = this.settingsRevision,
    platformAccountId = this.getCurrentPlatformAccountId(),
  ) {
    const builtinProvider = this.findProvider(settings, AiConfigService.BUILTIN_PROVIDER_ID)
    if (!builtinProvider) {
      return settings
    }

    const syncedAt = this.normalizeTimestamp(builtinProvider.builtinModelsSyncedAt)
    const hasFreshCatalog = Boolean(
      platformAccountId
      && this.normalizeText(builtinProvider.lastSyncedAccountId) === platformAccountId
      && syncedAt
      && Date.now() - syncedAt < AiConfigService.BUILTIN_MODELS_SYNC_TTL_MS,
    )
    if (!force && hasFreshCatalog) {
      const nextSettings = this.applyBuiltinLegacyModelMigration(settings)
      if (nextSettings !== settings && revision === this.settingsRevision) {
        await this.persistSettings(nextSettings)
      }
      return nextSettings
    }

    try {
      const selectAllBuiltinModels = this.shouldSelectAllBuiltinModelsOnBootstrap(settings, builtinProvider)
      const discoveredModels = await this.loadBuiltinModels(force)
      const mergedBuiltinProvider = this.normalizeProvider({
        ...this.mergeDiscoveredModels(builtinProvider, discoveredModels, {
          selectNewBuiltinModels: selectAllBuiltinModels,
        }),
        lastSyncedAccountId: platformAccountId,
        builtinModelsSyncedAt: Date.now(),
      }, builtinProvider)

      if (revision !== this.settingsRevision) return settings
      const nextSettings = this.applyBuiltinLegacyModelMigration(this.normalizeSettings({
        ...settings,
        providers: settings.providers.map(provider =>
          provider.id === builtinProvider.id ? mergedBuiltinProvider : provider,
        ),
      }), {
        selectAllBuiltinModels,
      })
      await this.persistSettings(nextSettings)
      return nextSettings
    } catch (error) {
      const message = this.normalizeText(error instanceof Error ? error.message : String(error))
        || global.i18next.t('aiConfigService.builtinModelsUnavailable')
      if (builtinProvider.availableModels?.length) {
        if (revision !== this.settingsRevision) return settings
        const nextSettings = this.applyBuiltinLegacyModelMigration(this.normalizeSettings({
          ...settings,
          providers: settings.providers.map(provider => provider.id === builtinProvider.id
            ? this.normalizeProvider({
              ...provider,
              lastHealthCheckAt: Date.now(),
              lastHealthStatus: 'unhealthy',
              lastHealthMessage: message,
            }, provider)
            : provider),
        }))
        await this.persistSettings(nextSettings)
        return nextSettings
      }
      const nextBuiltinProvider = this.buildUnavailableBuiltinProviderState(
        this.normalizeProvider({
          ...builtinProvider,
          lastHealthMessage: message,
        }, builtinProvider),
        Date.now(),
        message,
      )
      if (revision !== this.settingsRevision) return settings
      const nextSettings = this.applyBuiltinLegacyModelMigration(this.normalizeSettings({
        ...settings,
        providers: settings.providers.map(provider =>
          provider.id === builtinProvider.id ? nextBuiltinProvider : provider,
        ),
      }))
      if (nextSettings !== settings) {
        await this.persistSettings(nextSettings)
      }
      return nextSettings
    }
  }

  private async refreshBuiltinProviderRuntimeState(provider: AiProviderConfig) {
    const checkedAt = Date.now()
    return await this.refreshBuiltinProviderRuntimeStateByTier(provider, checkedAt)
    /*
    if (!routeCandidates.length) {
      return this.normalizeProvider({
        ...provider,
        builtinRouteStatus: 'unavailable',
        builtinRouteCheckedAt: checkedAt,
        builtinRouteMessage: provider.lastHealthMessage || '未获取到可用的 BanbanAI 模型能力',
        builtinEffectiveModel: null,
        builtinCapabilities: this.getEmptyBuiltinCapabilities(),
        builtinChecks: this.getEmptyBuiltinChecks(),
      }, provider)
    }

    const routeCandidate = this.pickBuiltinBootstrapRouteCandidate(provider)
    if (!routeCandidate) {
      return this.normalizeProvider({
        ...provider,
        builtinRouteStatus: 'unavailable',
        builtinRouteCheckedAt: checkedAt,
        builtinRouteMessage: provider.lastHealthMessage || '未获取到可用的 BanbanAI 模型能力',
        builtinEffectiveModel: null,
        builtinCapabilities: this.getEmptyBuiltinCapabilities(),
        builtinChecks: this.getEmptyBuiltinChecks(),
      }, provider)
    }

    const validation = await this.runProviderModelValidation(
      provider,
      routeCandidate,
      routeCandidate,
    )
    const validatedModel = validation.model || routeCandidate
    const nextProvider = this.normalizeProvider({
      ...this.replaceModelInProvider(provider, validatedModel),
      builtinRouteStatus: validation.success
        ? 'ready'
        : (validation.checks.connection ? 'degraded' : 'unavailable'),
      builtinRouteCheckedAt: validation.checkedAt,
      builtinRouteMessage: validation.message || null,
      builtinEffectiveModel: validatedModel.model,
      builtinCapabilities: {
        auto: validation.checks.toolAuto,
        requireAny: Boolean(validatedModel.toolCapabilities?.requireAny),
        requireSpecific: Boolean(validatedModel.toolCapabilities?.requireSpecific),
        parallel: Boolean(validatedModel.toolCapabilities?.parallel),
      },
      builtinChecks: {
        connection: validation.checks.connection,
        generation: validation.checks.generation,
        toolAuto: validation.checks.toolAuto,
      },
    }, provider)

    return nextProvider
    */
  }

  private async refreshBuiltinProviderRuntimeStateByTier(provider: AiProviderConfig, checkedAt: number) {
    const routeCandidates = this.getBuiltinRouteCandidates(provider)
    if (!routeCandidates.length) {
      return this.buildUnavailableBuiltinProviderState(
        provider,
        checkedAt,
        provider.lastHealthMessage || global.i18next.t('aiConfigService.banbanAiCapabilitiesUnavailable'),
      )
    }

    const tierCandidates = this.getBuiltinTierValidationCandidates(provider)
    if (!tierCandidates.length) {
      const routeCandidate = this.pickBuiltinPreferredRouteCandidate(routeCandidates)
      const validation = await this.runProviderModelValidation(
        provider,
        routeCandidate,
        routeCandidate,
        'interactive-default',
      )
      const validatedModel = validation.model || routeCandidate
      return this.normalizeProvider({
        ...this.replaceModelInProvider(provider, validatedModel),
        lastHealthCheckAt: validation.checkedAt,
        lastHealthStatus: validation.success ? 'healthy' : 'unhealthy',
        lastHealthMessage: validation.message || null,
        builtinRouteStatus: validation.success
          ? 'ready'
          : (validation.checks.connection ? 'degraded' : 'unavailable'),
        builtinRouteCheckedAt: validation.checkedAt,
        builtinRouteMessage: validation.message || null,
        builtinEffectiveModel: validatedModel.model,
        builtinCapabilities: this.getBuiltinCapabilitiesFromModel(validatedModel),
        builtinChecks: {
          connection: validation.checks.connection,
          generation: validation.checks.generation,
          toolAuto: validation.checks.toolAuto,
        },
      }, provider)
    }

    let nextProvider = provider
    const tierValidations: Array<{
      tier: AiModelTier
      purpose: AiRuntimePurpose
      model: AiProviderModel
      validation: AiModelValidationResult
    }> = []

    for (const tierCandidate of tierCandidates) {
      const validation = await this.runProviderModelValidation(
        provider,
        tierCandidate.model,
        tierCandidate.model,
        tierCandidate.purpose,
      )
      const validatedModel = validation.model || tierCandidate.model
      nextProvider = this.normalizeProvider({
        ...this.replaceModelInProvider(nextProvider, validatedModel),
      }, nextProvider)
      tierValidations.push({
        ...tierCandidate,
        model: validatedModel,
        validation,
      })
    }

    return this.buildBuiltinProviderStateFromTierValidations(
      nextProvider,
      tierValidations,
      checkedAt,
    )
  }

  private buildUnavailableBuiltinProviderState(
    provider: AiProviderConfig,
    checkedAt: number,
    message?: string | null,
  ) {
    const nextMessage = this.normalizeText(message)
      || global.i18next.t('aiConfigService.banbanAiCapabilitiesUnavailable')
    return this.normalizeProvider({
      ...provider,
      lastHealthCheckAt: checkedAt,
      lastHealthStatus: 'unhealthy',
      lastHealthMessage: nextMessage,
      builtinRouteStatus: 'unavailable',
      builtinRouteCheckedAt: checkedAt,
      builtinRouteMessage: nextMessage,
      builtinEffectiveModel: null,
      builtinCapabilities: this.getEmptyBuiltinCapabilities(),
      builtinChecks: this.getEmptyBuiltinChecks(),
    }, provider)
  }

  private getBuiltinTierValidationCandidates(provider: AiProviderConfig) {
    const candidates = this.getBuiltinRouteCandidates(provider)
      .filter(model => this.isBuiltinWorkbenchRouteCandidate(model))

    return (['deep', 'balanced', 'fast'] as AiModelTier[])
      .map(tier => {
        const model = this.pickBuiltinPreferredRouteCandidate(
          candidates.filter(candidate => this.getModelTier(candidate) === tier),
        )
        if (!model) {
          return null
        }
        return {
          tier,
          model,
          purpose: (tier === 'fast'
            ? 'ai-semantic-warmup'
            : 'interactive-default') as AiRuntimePurpose,
        }
      })
      .filter((item): item is {
        tier: AiModelTier
        purpose: AiRuntimePurpose
        model: AiProviderModel
      } => Boolean(item))
  }

  private buildBuiltinProviderStateFromTierValidations(
    provider: AiProviderConfig,
    tierValidations: Array<{
      tier: AiModelTier
      purpose: AiRuntimePurpose
      model: AiProviderModel
      validation: AiModelValidationResult
    }>,
    checkedAt: number,
  ) {
    const successfulTierValidations = tierValidations.filter(item => item.validation.success)
    if (!successfulTierValidations.length) {
      return this.buildUnavailableBuiltinProviderState(
        provider,
        Math.max(
          checkedAt,
          ...tierValidations.map(item => this.normalizeTimestamp(item.validation.checkedAt)),
        ),
        this.buildBuiltinTierValidationSummaryMessage(tierValidations)
          || provider.lastHealthMessage
          || global.i18next.t('aiConfigService.banbanAiCapabilitiesUnavailable'),
      )
    }

    const interactiveTier = this.getInteractiveDefaultTier()
    const warmupTier = this.getWarmupDefaultTier()
    const preferredSuccessfulTier = this.pickBuiltinPreferredTierValidation(successfulTierValidations)
    const interactiveSuccessfulTier = successfulTierValidations.find(item => item.tier === interactiveTier) || null
    const warmupSuccessfulTier = successfulTierValidations.find(item => item.tier === warmupTier) || null
    const representativeTier = interactiveSuccessfulTier || preferredSuccessfulTier
    const builtinRouteStatus: AiBuiltinRouteStatus = interactiveSuccessfulTier && warmupSuccessfulTier
      ? 'ready'
      : 'degraded'
    const allTierValidationsPassed = successfulTierValidations.length === tierValidations.length
    const nextCheckedAt = Math.max(
      checkedAt,
      ...tierValidations.map(item => this.normalizeTimestamp(item.validation.checkedAt)),
    )
    const nextRouteMessage = allTierValidationsPassed
      ? null
      : this.buildBuiltinTierValidationSummaryMessage(tierValidations)

    return this.normalizeProvider({
      ...provider,
      lastHealthCheckAt: nextCheckedAt,
      lastHealthStatus: 'healthy',
      lastHealthMessage: nextRouteMessage,
      builtinRouteStatus,
      builtinRouteCheckedAt: nextCheckedAt,
      builtinRouteMessage: nextRouteMessage,
      builtinEffectiveModel: (interactiveSuccessfulTier || preferredSuccessfulTier)?.model.model || null,
      builtinCapabilities: interactiveSuccessfulTier
        ? this.getBuiltinCapabilitiesFromModel(interactiveSuccessfulTier.model)
        : this.getEmptyBuiltinCapabilities(),
      builtinChecks: representativeTier
        ? {
          connection: Boolean(representativeTier.validation.checks.connection),
          generation: Boolean(representativeTier.validation.checks.generation),
          toolAuto: Boolean(interactiveSuccessfulTier?.validation.checks.toolAuto),
        }
        : this.getEmptyBuiltinChecks(),
    }, provider)
  }

  private pickBuiltinPreferredTierValidation<T extends { tier: AiModelTier }>(items: T[]) {
    for (const tier of [this.getInteractiveDefaultTier(), 'deep', this.getWarmupDefaultTier()] as AiModelTier[]) {
      const matched = items.find(item => item.tier === tier)
      if (matched) {
        return matched
      }
    }
    return items[0] || null
  }

  private getBuiltinCapabilitiesFromModel(model?: AiProviderModel | null): AiModelToolCapabilities {
    return {
      auto: this.modelSupportsToolAuto(model),
      requireAny: Boolean(model?.toolCapabilities?.requireAny),
      requireSpecific: Boolean(model?.toolCapabilities?.requireSpecific),
      parallel: Boolean(model?.toolCapabilities?.parallel),
    }
  }

  private buildBuiltinTierValidationSummaryMessage(
    tierValidations: Array<{
      tier: AiModelTier
      validation: AiModelValidationResult
    }>,
  ) {
    const availableTiers = tierValidations
      .filter(item => item.validation.success)
      .map(item => getAiModelTierLabel(item.tier))
    const failedSegments = tierValidations
      .filter(item => !item.validation.success)
      .map(item => global.i18next.t('aiConfigService.tierValidationFailed', {
        message: this.normalizeText(item.validation.message) || global.i18next.t('aiConfigService.validationFailed'),
        tier: getAiModelTierLabel(item.tier),
      }))

    if (!failedSegments.length) {
      return null
    }

    if (!availableTiers.length) {
      return failedSegments.join(global.i18next.t('aiConfigService.sectionSeparator'))
    }

    return [
      global.i18next.t('aiConfigService.availableTiers', {
        tiers: availableTiers.join(global.i18next.t('aiConfigService.listSeparator')),
      }),
      ...failedSegments,
    ].join(global.i18next.t('aiConfigService.sectionSeparator'))
  }

  private async persistSettings(settings: AiSettings) {
    await this.aiConfigStore.replaceSettings(settings)
    this.setReadonlySettingsCache(settings, this.getCurrentPlatformAccountId())
  }

  private getReadonlySettingsCache(platformAccountId: string | null) {
    if (!this.readonlySettingsCache) {
      return null
    }
    if (this.readonlySettingsCache.platformAccountId !== platformAccountId) {
      this.readonlySettingsCache = null
      return null
    }
    if (this.readonlySettingsCache.expiresAt <= Date.now()) {
      this.readonlySettingsCache = null
      return null
    }
    return this.cloneSettings(this.readonlySettingsCache.settings)
  }

  private setReadonlySettingsCache(settings: AiSettings, platformAccountId = this.getCurrentPlatformAccountId()) {
    this.readonlySettingsCache = {
      settings: this.cloneSettings(settings),
      expiresAt: Date.now() + AiConfigService.READONLY_SETTINGS_CACHE_TTL_MS,
      platformAccountId,
    }
  }

  private clearReadonlySettingsCache() {
    this.settingsRevision += 1
    this.readonlySettingsCache = null
    this.builtinModelsCache = null
  }

  private getCurrentPlatformAccountId() {
    const user = this.userService.user
    return user?.isLogin() ? this.normalizeText(String(user.get('id') || '')) || null : null
  }

  private createAiConfigError(code: string, message: string) {
    const error = new Error(message) as Error & { code: string }
    error.code = code
    return error
  }

  private cloneSettings(settings: AiSettings) {
    return this.normalizeSettings(settings)
  }

  private isSameSettings(left: AiSettings, right: AiSettings) {
    return JSON.stringify(left) === JSON.stringify(right)
  }

  private async loadBuiltinModels(force: boolean) {
    const now = Date.now()
    const platformAccountId = this.getCurrentPlatformAccountId()
    if (!force && this.builtinModelsCache
      && this.builtinModelsCache.platformAccountId === platformAccountId
      && this.builtinModelsCache.expiresAt > now) {
      return this.cloneBuiltinModels(this.builtinModelsCache.models)
    }

    if (this.builtinModelsInFlight && this.builtinModelsInFlight.accountId === platformAccountId) {
      return await this.builtinModelsInFlight.promise
    }

    const discoveryTask = this.discoverBuiltinModels()
      .then(models => {
        this.builtinModelsCache = {
          models: this.cloneBuiltinModels(models),
          expiresAt: Date.now() + AiConfigService.BUILTIN_MODELS_CACHE_TTL_MS,
          platformAccountId,
        }
        return this.cloneBuiltinModels(models)
      })
      .finally(() => {
        if (this.builtinModelsInFlight?.promise === discoveryTask) {
          this.builtinModelsInFlight = null
        }
      })
    this.builtinModelsInFlight = { accountId: platformAccountId, promise: discoveryTask }
    return await discoveryTask
  }

  private cloneBuiltinModels(models: AiProviderModel[]) {
    return models.map(model => this.normalizeModel(model, 'builtin-cloud'))
  }

  private getInteractiveDefaultTier(): AiModelTier {
    return 'balanced'
  }

  private getWarmupDefaultTier(): AiModelTier {
    return 'fast'
  }

  private getRequiredBuiltinTierForPurpose(purpose: AiRuntimePurpose): AiModelTier {
    return purpose === 'ai-semantic-warmup'
      ? this.getWarmupDefaultTier()
      : this.getInteractiveDefaultTier()
  }

  private buildPurposeUnavailableMessage(purpose: AiRuntimePurpose): string {
    if (purpose === 'ai-semantic-warmup') {
      return global.i18next.t('aiConfigService.semanticWarmupModelUnavailable')
    }

    return global.i18next.t('aiConfigService.defaultChatModelUnavailable', {
      tier: getAiModelTierLabel(this.getRequiredBuiltinTierForPurpose(purpose)),
    })
  }

  private normalizeSettings(input?: Partial<AiSettings> | null): AiSettings {
    const legacyDefaultSelection = this.normalizeTierDefaultSelection({
      providerId: input?.defaultProviderId,
      modelId: input?.defaultModelId,
    })
    const defaultSelections = this.normalizeDefaultSelections(input?.defaultSelections, legacyDefaultSelection)
    const interactiveDefaultTier = this.getInteractiveDefaultTier()
    const interactiveDefaultSelection = defaultSelections[interactiveDefaultTier]
    const shouldApplyLegacyInteractiveTierMigration = Boolean(
      this.normalizeTierDefaultSelection(legacyDefaultSelection)
      && !this.normalizeTierDefaultSelection(input?.defaultSelections?.[interactiveDefaultTier]),
    )
    const providersInput = Array.isArray(input?.providers) ? input.providers : []
    const migrations = this.normalizeSettingsMigrations(input?.migrations)
    const providers = providersInput
      .map(provider => this.normalizeProvider(
        shouldApplyLegacyInteractiveTierMigration
          ? this.applyLegacyInteractiveDefaultTierToProviderModels(provider, interactiveDefaultSelection, interactiveDefaultTier)
          : provider,
      ))
      .filter((provider, index, array) => array.findIndex(item => item.id === provider.id) === index)

    const builtinProviderIndex = providers.findIndex(provider => provider.id === AiConfigService.BUILTIN_PROVIDER_ID)
    const builtinProvider = builtinProviderIndex >= 0
      ? this.normalizeProvider(providers[builtinProviderIndex], providers[builtinProviderIndex])
      : this.createBuiltinProvider()

    const normalizedProviders = (builtinProviderIndex >= 0
      ? providers.map((provider, index) => index === builtinProviderIndex ? builtinProvider : provider)
      : [builtinProvider, ...providers])
      .map(provider => this.migrateLegacyProviderModels(provider, {
        providerId: interactiveDefaultSelection?.providerId || null,
        modelId: interactiveDefaultSelection?.modelId || null,
      }))

    const nextSettings: AiSettings = {
      enabled: true,
      autoTaskEnabled: input?.autoTaskEnabled === true,
      allowModelSelection: true,
      defaultSelections,
      defaultProviderId: interactiveDefaultSelection?.providerId || null,
      defaultModelId: interactiveDefaultSelection?.modelId || null,
      featureFlags: this.normalizeFeatureFlags(input?.featureFlags),
      migrations,
      providers: normalizedProviders,
    }

    const hasConfiguredDefault = Boolean(nextSettings.defaultProviderId && nextSettings.defaultModelId)
    const defaultSelection = this.resolveDefaultSelection(nextSettings)
    if (!defaultSelection) {
      if (hasConfiguredDefault) {
        return nextSettings
      }
      nextSettings.defaultSelections = this.normalizeDefaultSelections({
        ...nextSettings.defaultSelections,
        [interactiveDefaultTier]: null,
      })
      nextSettings.defaultProviderId = null
      nextSettings.defaultModelId = null
      return nextSettings
    }

    if (!this.findCatalogItem(nextSettings, {
      providerId: nextSettings.defaultProviderId,
      modelId: nextSettings.defaultModelId,
    })) {
      if (hasConfiguredDefault) {
        return nextSettings
      }
      nextSettings.defaultSelections = this.normalizeDefaultSelections({
        ...nextSettings.defaultSelections,
        [interactiveDefaultTier]: {
          providerId: defaultSelection.providerId,
          modelId: defaultSelection.modelId,
        },
      })
      nextSettings.defaultProviderId = defaultSelection.providerId
      nextSettings.defaultModelId = defaultSelection.modelId
    }

    return nextSettings
  }

  private mergeProvidersForSave(currentProviders: AiProviderConfig[], inputProviders: Partial<AiProviderConfig>[]): AiProviderConfig[] {
    const currentProviderMap = new Map(currentProviders.map(provider => [provider.id, provider]))
    return inputProviders.map(provider => {
      const providerId = this.normalizeText(provider?.id)
      const currentProvider = providerId ? (currentProviderMap.get(providerId) || null) : null
      if (providerId !== AiConfigService.BUILTIN_PROVIDER_ID) {
        return this.normalizeProvider(provider, currentProvider || undefined)
      }

      const currentBuiltinProvider = currentProvider
      if (!currentBuiltinProvider) {
        return this.normalizeProvider(provider, currentProvider || undefined)
      }

      const nextBuiltinModels = currentBuiltinProvider.models.length
        ? currentBuiltinProvider.models
        : (Array.isArray(provider.models) ? provider.models : currentBuiltinProvider.models)
      const nextBuiltinAvailableModels = currentBuiltinProvider.availableModels?.length
        ? currentBuiltinProvider.availableModels
        : (Array.isArray(provider.availableModels) ? provider.availableModels : currentBuiltinProvider.availableModels)
      const nextBuiltinManagedModels = Array.isArray(provider.builtinManagedModels)
        ? provider.builtinManagedModels
        : currentBuiltinProvider.builtinManagedModels

      return this.normalizeProvider({
        ...currentBuiltinProvider,
        ...provider,
        models: nextBuiltinModels,
        availableModels: nextBuiltinAvailableModels,
        builtinManagedModels: nextBuiltinManagedModels,
      }, currentBuiltinProvider)
    })
  }

  private toPublicSettings(settings: AiSettings): AiSettings {
    return {
      ...settings,
      defaultSelections: this.normalizeDefaultSelections(settings.defaultSelections, {
        providerId: settings.defaultProviderId,
        modelId: settings.defaultModelId,
      }),
      defaultProviderId: settings.defaultProviderId || null,
      defaultModelId: settings.defaultModelId || null,
      providers: settings.providers.map(provider => this.toPublicProvider(provider)),
    }
  }

  private toPublicProvider(provider: AiProviderConfig): AiProviderConfig {
    const normalized = provider.type === 'builtin-cloud'
      ? this.toPublicBuiltinProvider(provider)
      : this.normalizeProvider(provider, provider)
    return {
      ...normalized,
      apiKey: this.toApiKeyCiphertextDisplayValue(normalized.apiKeyEncrypted),
      apiKeyEncrypted: undefined,
    }
  }

  private toApiKeyCiphertextDisplayValue(value?: string | null) {
    const ciphertext = this.normalizeText(value)
    return ciphertext ? ciphertext.slice(0, AiConfigService.API_KEY_CIPHERTEXT_DISPLAY_LENGTH) : null
  }

  private toPublicBuiltinProvider(provider: AiProviderConfig): AiProviderConfig {
    const managedModels = provider.builtinManagedModels || []
    return this.normalizeProvider({
      ...provider,
      id: provider.id,
      name: provider.name || AiConfigService.BUILTIN_PROVIDER_NAME,
      models: managedModels,
      availableModels: provider.availableModels,
      builtinManagedModels: managedModels,
    }, provider)
  }

  async validateProviderModelHealth(
    providerId: string,
    modelId: string,
    requestedTimeoutMs?: number,
  ): Promise<AiModelHealthCheckResult> {
    const settings = await this.loadSettings(false)
    const provider = this.assertProvider(settings, providerId)
    const model = this.assertModel(provider, modelId, true)
    const timeoutMs = Math.min(60_000, Math.max(5_000, Math.round(Number(requestedTimeoutMs) || 15_000)))
    const storedApiKeys = provider.type === 'ollama'
      ? ['']
      : await this.credentialStore.getEnabledValues(provider.id)
    const normalizedApiKeys = storedApiKeys.length ? storedApiKeys : ['']
    const checkedAt = Date.now()
    const keyResults = await Promise.all(normalizedApiKeys.map(async (apiKey, keyIndex): Promise<AiModelHealthCheckKeyResult> => {
      const startedAt = Date.now()
      const runtimeProvider = {
        ...provider,
        apiKey: apiKey || null,
        [AI_MODEL_VALIDATION_TIMEOUT]: timeoutMs,
      } as AiProviderValidationRuntime
      try {
        const probe = await this.runModelHealthProbe(runtimeProvider, model, timeoutMs)
        return {
          keyIndex,
          success: probe.ok,
          checkedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          message: probe.message || null,
        }
      } catch (error) {
        return {
          keyIndex,
          success: false,
          checkedAt: Date.now(),
          durationMs: Date.now() - startedAt,
          message: this.getHealthCheckErrorMessage(error),
        }
      }
    }))
    const allPassed = keyResults.every(result => result.success)
    const failedMessages = keyResults
      .filter(result => !result.success)
      .map(result => result.message)
      .filter(Boolean)
    return {
      success: allPassed,
      checkedAt,
      durationMs: Date.now() - checkedAt,
      message: failedMessages.length ? failedMessages.join('；') : null,
      keyResults,
    }
  }

  private normalizeProvider(input?: Partial<AiProviderConfig> | null, previousValue?: AiProviderConfig | null): AiProviderConfig {
    const fallbackId = previousValue?.id || unique(12)
    const id = this.normalizeText(input?.id) || fallbackId
    const type = this.normalizeProviderType(
      input?.type,
      id === AiConfigService.BUILTIN_PROVIDER_ID ? 'builtin-cloud' : (previousValue?.type || 'openai-compatible'),
    )
    const previousModels = previousValue?.models || []
    const modelsInput = Array.isArray(input?.models) ? input.models : previousModels
    const normalizeModelIdentity = (model: AiProviderModel) => type === 'builtin-cloud'
      ? this.normalizeText(model.meta?.builtin?.apiModelId) || this.normalizeText(model.model) || this.normalizeText(model.id)
      : this.normalizeText(model.id)
    const dedupeModels = (items: AiProviderModel[]) => {
      const byIdentity = new Map<string, AiProviderModel>()
      items.forEach(model => {
        const identity = normalizeModelIdentity(model)
        const previous = byIdentity.get(identity)
        if (!previous || (model.id === identity && previous.id !== identity)) {
          byIdentity.set(identity, model)
        }
      })
      return [...byIdentity.values()]
    }
    const models = dedupeModels(modelsInput
      .map(model => this.normalizeModel(model, type, this.findPreviousModel(previousModels, model)))
      .filter(model => type !== 'builtin-cloud' || (!this.isRemovedBuiltinModel(model.id) && !this.isRemovedBuiltinModel(model.model))))
    const previousAvailableModels = previousValue?.availableModels || []
    const availableModelsInput = Array.isArray(input?.availableModels) ? input.availableModels : previousAvailableModels
    const availableModels = dedupeModels(availableModelsInput
      .map(model => this.normalizeModel(model, type, this.findPreviousModel(previousAvailableModels, model)))
      .filter(model => type !== 'builtin-cloud' || (!this.isRemovedBuiltinModel(model.id) && !this.isRemovedBuiltinModel(model.model))))
    const previousBuiltinManagedModels = previousValue?.builtinManagedModels || []
    const builtinManagedModelsInput = Array.isArray(input?.builtinManagedModels)
      ? input.builtinManagedModels
      : previousBuiltinManagedModels
    const builtinManagedModels = type === 'builtin-cloud'
      ? dedupeModels(builtinManagedModelsInput
        .map(model => this.normalizeModel(model, type, this.findPreviousModel(previousBuiltinManagedModels, model)))
        .filter(model => model.id !== AiConfigService.BUILTIN_MODEL_PUBLIC_ID)
        .filter(model => !this.isRemovedBuiltinModel(model.id) && !this.isRemovedBuiltinModel(model.model)))
      : undefined
    const providerBaseUrl = this.resolveProviderFieldValue(input, previousValue, 'baseUrl')

    const provider: AiProviderConfig = {
      id,
      name: this.normalizeText(input?.name)
        || this.normalizeText(previousValue?.name)
        || this.getDefaultProviderName(type),
      type,
      managementMode: input?.managementMode || previousValue?.managementMode || 'custom',
      presetKey: input?.presetKey || previousValue?.presetKey || null,
      requiresPlatformLogin: input?.requiresPlatformLogin === undefined
        ? Boolean(previousValue?.requiresPlatformLogin)
        : Boolean(input.requiresPlatformLogin),
      lastSyncedAccountId: input?.lastSyncedAccountId === undefined
        ? previousValue?.lastSyncedAccountId || null
        : input.lastSyncedAccountId || null,
      enabled: input?.enabled === undefined ? previousValue?.enabled !== false : Boolean(input?.enabled),
      baseUrl: type === 'builtin-cloud'
        ? null
        : this.normalizeProviderBaseUrl(providerBaseUrl, type) || null,
      apiKey: type === 'builtin-cloud'
        ? null
        : this.normalizeNullableProviderTextField(input, previousValue, 'apiKey'),
      apiKeyEncrypted: type === 'builtin-cloud'
        ? null
        : this.normalizeNullableProviderTextField(input, previousValue, 'apiKeyEncrypted'),
      credentials: Array.isArray(input?.credentials)
        ? input.credentials
        : (previousValue?.credentials || []),
      defaultModelId: null,
      models,
      availableModels,
      builtinManagedModels,
      lastHealthCheckAt: this.normalizeTimestamp(input?.lastHealthCheckAt) || this.normalizeTimestamp(previousValue?.lastHealthCheckAt) || null,
      lastHealthStatus: this.normalizeHealthStatus(input?.lastHealthStatus || previousValue?.lastHealthStatus),
      lastHealthMessage: this.normalizeNullableProviderTextField(input, previousValue, 'lastHealthMessage'),
      builtinRouteStatus: this.normalizeBuiltinRouteStatus(input?.builtinRouteStatus || previousValue?.builtinRouteStatus),
      builtinRouteCheckedAt: this.normalizeTimestamp(input?.builtinRouteCheckedAt) || this.normalizeTimestamp(previousValue?.builtinRouteCheckedAt) || null,
      builtinRouteMessage: this.normalizeNullableProviderTextField(input, previousValue, 'builtinRouteMessage'),
      builtinEffectiveModel: this.normalizeNullableProviderTextField(input, previousValue, 'builtinEffectiveModel'),
      builtinModelsSyncedAt: this.normalizeTimestamp(input?.builtinModelsSyncedAt) || this.normalizeTimestamp(previousValue?.builtinModelsSyncedAt) || null,
      builtinCapabilities: this.normalizeBuiltinCapabilities(input?.builtinCapabilities, previousValue?.builtinCapabilities),
      builtinChecks: this.normalizeBuiltinChecks(input?.builtinChecks, previousValue?.builtinChecks),
    }

    return provider
  }

  private resolveProviderFieldValue<Key extends keyof AiProviderConfig>(
    input: Partial<AiProviderConfig> | null | undefined,
    previousValue: AiProviderConfig | null | undefined,
    key: Key,
  ): AiProviderConfig[Key] | undefined {
    if (input && Object.prototype.hasOwnProperty.call(input, key) && input[key] !== undefined) {
      return input[key] as AiProviderConfig[Key]
    }
    return previousValue?.[key]
  }

  private normalizeNullableProviderTextField(
    input: Partial<AiProviderConfig> | null | undefined,
    previousValue: AiProviderConfig | null | undefined,
    key: 'apiKey' | 'apiKeyEncrypted' | 'lastHealthMessage' | 'builtinRouteMessage' | 'builtinEffectiveModel',
  ) {
    return this.normalizeText(this.resolveProviderFieldValue(input, previousValue, key) as string | null | undefined) || null
  }

  private normalizeFeatureFlags(value?: Partial<AiFeatureFlags> | null): AiFeatureFlags {
    return normalizeAiFeatureFlags(value)
  }

  private normalizeModelTier(value?: string | null): AiModelTier | null {
    const normalized = this.normalizeText(value).toLowerCase()
    if (normalized === 'fast' || normalized === 'balanced' || normalized === 'deep') {
      return normalized
    }
    return null
  }

  private applyFeatureFlagsProfile(
    value: AiFeatureFlags,
    profile?: AiConversationProfile | null,
  ): AiFeatureFlags {
    switch (profile) {
      case 'records_query':
      case 'cross_app_compare':
      case 'cross_app_merge':
      case 'cross_app_unresolved':
      default:
        return {
          ...value,
        }
    }
  }

  private normalizeSettingsMigrations(value?: Partial<AiSettingsMigrations> | null): AiSettingsMigrations {
    return {
      builtinModelBootstrapCompletedAt: this.normalizeTimestamp(value?.builtinModelBootstrapCompletedAt) || null,
    }
  }

  private normalizeBuiltinRouteStatus(value?: string | null): AiBuiltinRouteStatus {
    const normalized = this.normalizeText(value).toLowerCase()
    if (
      normalized === 'ready'
      || normalized === 'degraded'
      || normalized === 'unavailable'
    ) {
      return normalized
    }
    return 'unknown'
  }

  private normalizeBuiltinCapabilities(
    value?: Partial<AiModelToolCapabilities> | null,
    fallback?: Partial<AiModelToolCapabilities> | null,
  ): AiModelToolCapabilities {
    return this.normalizeToolCapabilities(value, fallback, 'builtin-cloud')
  }

  private normalizeBuiltinChecks(
    value?: Partial<AiBuiltinRouteChecks> | null,
    fallback?: Partial<AiBuiltinRouteChecks> | null,
  ): AiBuiltinRouteChecks {
    const merged = {
      ...(fallback || {}),
      ...(value || {}),
    }
    return {
      connection: Boolean(merged.connection),
      generation: Boolean(merged.generation),
      toolAuto: Boolean(merged.toolAuto),
    }
  }

  private getEmptyBuiltinCapabilities(): AiModelToolCapabilities {
    return {
      auto: false,
      requireAny: false,
      requireSpecific: false,
      parallel: false,
    }
  }

  private getEmptyBuiltinChecks(): AiBuiltinRouteChecks {
    return {
      connection: false,
      generation: false,
      toolAuto: false,
    }
  }

  private isBuiltinProviderReady(provider?: AiProviderConfig | null) {
    return Boolean(
      provider
      && provider.enabled
      && this.getBuiltinAvailableTiers(provider).length,
    )
  }

  private isBuiltinInteractiveModelAvailable(provider?: AiProviderConfig | null) {
    return Boolean(
      provider
      && provider.enabled
      && this.hasBuiltinRouteCandidateForTier(provider, this.getInteractiveDefaultTier()),
    )
  }

  private normalizeTierDefaultSelection(value?: Partial<AiTierDefaultSelection> | null): AiTierDefaultSelection | null {
    const providerId = this.normalizeText(value?.providerId)
    const modelId = this.normalizeText(value?.modelId)
    if (!providerId || !modelId) {
      return null
    }
    return {
      providerId,
      modelId,
    }
  }

  private normalizeDefaultSelections(
    value?: Partial<AiDefaultModelSelections> | null,
    legacyDefaultSelection?: Partial<AiTierDefaultSelection> | null,
  ): AiDefaultModelSelections {
    const hasBalancedSelection = Boolean(value && Object.prototype.hasOwnProperty.call(value, 'balanced'))
    return {
      fast: this.normalizeTierDefaultSelection(value?.fast),
      balanced: this.normalizeTierDefaultSelection(value?.balanced)
        || (hasBalancedSelection ? null : this.normalizeTierDefaultSelection(legacyDefaultSelection)),
      deep: this.normalizeTierDefaultSelection(value?.deep),
    }
  }

  private applyLegacyInteractiveDefaultTierToProviderModels(
    provider?: Partial<AiProviderConfig> | null,
    interactiveDefaultSelection?: AiTierDefaultSelection | null,
    interactiveDefaultTier: AiModelTier = this.getInteractiveDefaultTier(),
  ) {
    if (!provider || provider.type === 'builtin-cloud') {
      return provider
    }

    const providerId = this.normalizeText(provider.id)
    const matchedModelId = providerId && interactiveDefaultSelection?.providerId === providerId
      ? this.normalizeText(interactiveDefaultSelection.modelId)
      : ''
    if (!matchedModelId) {
      return provider
    }

    const normalizeModels = <Model extends Partial<AiProviderModel>>(models?: Model[] | null) => {
      if (!Array.isArray(models)) {
        return models
      }

      return models.map(model => {
        const normalizedId = this.normalizeText(model?.id)
        const normalizedModel = this.normalizeText(model?.model)
        if (normalizedId !== matchedModelId && normalizedModel !== matchedModelId) {
          return model
        }

        const currentTier = this.normalizeModelTier(model?.tier)
        if (currentTier && currentTier !== 'deep') {
          return model
        }

        return {
          ...model,
          tier: interactiveDefaultTier,
        }
      })
    }

    return {
      ...provider,
      models: normalizeModels(provider.models),
      availableModels: normalizeModels(provider.availableModels),
    }
  }

  private assertDefaultSelectionsValid(settings: AiSettings) {
    ;(['fast', 'balanced', 'deep'] as AiModelTier[]).forEach(tier => {
      const selection = settings.defaultSelections?.[tier]
      if (!selection) {
        return
      }

      const resolved = this.resolveTierDefaultSelection(settings, tier)
      if (resolved) {
        return
      }

      throw new AiRuntimeUserActionableError(
        'AI_MODEL_SELECTION_INVALID',
        this.buildTierDefaultSelectionInvalidMessage(settings, tier, selection),
        'configuration',
      )
    })
  }

  private buildTierDefaultSelectionInvalidMessage(
    settings: AiSettings,
    tier: AiModelTier,
    selection: AiTierDefaultSelection,
  ) {
    const tierLabel = getAiModelTierLabel(tier)
    const provider = this.findProvider(settings, selection.providerId)
    if (!provider) {
      return global.i18next.t('aiConfigService.defaultModelExpired', { tier: tierLabel })
    }

    if (
      provider.type === 'builtin-cloud'
      && this.isLegacyBuiltinSelection(provider, selection)
      && !this.hasBuiltinRouteCandidateForTier(provider, tier)
    ) {
      return global.i18next.t('aiConfigService.tierRouteUnavailable', { tier: tierLabel })
    }

    return global.i18next.t('aiConfigService.defaultModelUnavailable', { tier: tierLabel })
  }

  private findPreviousModel(models: AiProviderModel[], input?: Partial<AiProviderModel> | null) {
    const normalizedId = this.normalizeText(input?.id)
    const normalizedModel = this.normalizeText(input?.model)
    return models.find(model =>
      (normalizedId && model.id === normalizedId)
      || (normalizedModel && model.model === normalizedModel),
    ) || null
  }

  private normalizeModel(
    input?: Partial<AiProviderModel> | null,
    providerType?: AiProviderType,
    previousValue?: AiProviderModel | null,
  ): AiProviderModel {
    const fallbackModel = this.normalizeText(input?.model)
    const id = this.normalizeText(input?.id) || fallbackModel || unique(12)
    const modelName = fallbackModel || id
    const tier = providerType === 'builtin-cloud'
      ? this.normalizeModelTier(
        input?.tier
        || input?.meta?.builtin?.level,
      )
      : (
          this.normalizeModelTier(input?.tier)
          || this.normalizeModelTier(previousValue?.tier)
          || 'deep'
        )
    const validationStatus = this.normalizeValidationStatus(
      input?.validationStatus,
      'unverified',
    )
    const toolCapabilities = this.normalizeToolCapabilities(input?.toolCapabilities, {
      auto: input?.supportsTools,
      requireAny: undefined,
      requireSpecific: undefined,
      parallel: undefined,
    }, providerType)
    const validationChecks = this.normalizeValidationChecks(input?.validationChecks, {
      connection: validationStatus === 'passed',
      generation: validationStatus === 'passed',
      toolAuto: validationStatus === 'passed' && toolCapabilities.auto,
      toolRequireAny: validationStatus === 'passed' && toolCapabilities.requireAny,
      toolRequireSpecific: validationStatus === 'passed' && toolCapabilities.requireSpecific,
      toolParallel: validationStatus === 'passed' && toolCapabilities.parallel,
    }, providerType)
    const supportsTools = toolCapabilities.auto
    const hasCapabilities = Object.prototype.hasOwnProperty.call(input || {}, 'capabilities')
    const hasInputModalities = Object.prototype.hasOwnProperty.call(input || {}, 'inputModalities')
    const hasOutputModalities = Object.prototype.hasOwnProperty.call(input || {}, 'outputModalities')
    const hasEndpointTypes = Object.prototype.hasOwnProperty.call(input || {}, 'endpointTypes')
    const knownCapabilities = resolveKnownAiModelCapabilities(modelName)
    const legacyVision = input?.supportsVision === true
    const capabilities = normalizeAiModelCapabilities(
      hasCapabilities
        ? input?.capabilities
        : (legacyVision ? [AI_MODEL_CAPABILITIES.IMAGE_RECOGNITION] : knownCapabilities?.capabilities),
    )
    const inputModalities = normalizeAiModelModalities(
      hasInputModalities
        ? input?.inputModalities
        : (legacyVision ? [AI_MODEL_MODALITIES.TEXT, AI_MODEL_MODALITIES.IMAGE] : knownCapabilities?.inputModalities),
      [AI_MODEL_MODALITIES.TEXT],
    )
    const outputModalities = normalizeAiModelModalities(
      hasOutputModalities ? input?.outputModalities : knownCapabilities?.outputModalities,
      [AI_MODEL_MODALITIES.TEXT],
    )
    const endpointTypes = normalizeAiModelEndpointTypes(
      hasEndpointTypes ? input?.endpointTypes : knownCapabilities?.endpointTypes,
      [AI_MODEL_ENDPOINT_TYPES.OPENAI_CHAT_COMPLETIONS],
    )

    const model: AiProviderModel = {
      id,
      model: modelName,
      displayName: this.normalizeText(input?.displayName) || modelName,
      tier,
      enabled: input?.enabled === undefined ? true : Boolean(input?.enabled),
      available: input?.available === undefined ? previousValue?.available !== false : Boolean(input.available),
      allowInWorkbenchAgent: input?.allowInWorkbenchAgent === undefined
        ? (validationStatus === 'passed' && supportsTools)
        : Boolean(input?.allowInWorkbenchAgent),
      supportsTools,
      toolCapabilities,
      supportsVision: aiModelSupportsImageInput({ capabilities, inputModalities }),
      capabilities: supportsTools && !capabilities.includes(AI_MODEL_CAPABILITIES.FUNCTION_CALL)
        ? [...capabilities, AI_MODEL_CAPABILITIES.FUNCTION_CALL]
        : capabilities,
      inputModalities,
      outputModalities,
      endpointTypes,
      maxInputTokens: this.normalizeOptionalNumber(input?.maxInputTokens),
      maxOutputTokens: this.normalizeOptionalNumber(input?.maxOutputTokens),
      supportsStreaming: input?.supportsStreaming !== false,
      contextWindow: this.normalizeOptionalNumber(input?.contextWindow),
      source: this.normalizeModelSource(input?.source, providerType === 'builtin-cloud' ? 'builtin' : 'manual'),
      validationStatus,
      validationMessage: this.normalizeText(input?.validationMessage) || null,
      validationChecks,
      lastValidatedAt: this.normalizeTimestamp(input?.lastValidatedAt) || null,
      remark: this.normalizeText(input?.remark) || null,
      meta: this.normalizeRecord(input?.meta),
    }

    if (model.validationStatus !== 'passed' || !this.modelSupportsToolAuto(model)) {
      model.allowInWorkbenchAgent = false
    }

    return model
  }

  private normalizeToolCapabilities(
    value?: Partial<AiModelToolCapabilities> | null,
    fallback?: Partial<AiModelToolCapabilities> | null,
    providerType?: AiProviderType,
  ): AiModelToolCapabilities {
    const merged = {
      ...(fallback || {}),
      ...(value || {}),
    }
    return {
      auto: Boolean(merged.auto),
      requireAny: Boolean(merged.requireAny),
      requireSpecific: Boolean(merged.requireSpecific),
      parallel: merged.parallel === undefined
        ? (providerType === 'builtin-cloud' ? Boolean(merged.auto) : false)
        : Boolean(merged.parallel),
    }
  }

  private normalizeValidationChecks(
    value?: Partial<AiModelValidationChecks> | null,
    fallback?: Partial<AiModelValidationChecks> | null,
    providerType?: AiProviderType,
  ): AiModelValidationChecks {
    const merged = {
      ...(fallback || {}),
      ...(value || {}),
    }
    return {
      connection: Boolean(merged.connection),
      generation: Boolean(merged.generation),
      toolAuto: Boolean(merged.toolAuto),
      toolRequireAny: Boolean(merged.toolRequireAny),
      toolRequireSpecific: Boolean(merged.toolRequireSpecific),
      toolParallel: merged.toolParallel === undefined
        ? (providerType === 'builtin-cloud' ? Boolean(merged.toolAuto) : false)
        : Boolean(merged.toolParallel),
    }
  }

  private modelSupportsToolAuto(model?: Pick<AiProviderModel, 'supportsTools' | 'toolCapabilities'> | null) {
    if (!model) return false
    if (model.toolCapabilities) {
      return Boolean(model.toolCapabilities.auto)
    }
    return Boolean(model.supportsTools)
  }

  private isWorkbenchCatalogModelCandidate(model?: AiProviderModel | null) {
    return Boolean(model?.enabled && model?.available !== false)
  }

  private resolveProviderTypeLabel(type: AiProviderType) {
    if (type === 'ollama') return 'Ollama'
    if (type === 'openai-compatible') return global.i18next.t('aiConfigService.openAiCompatibleService')
    return 'BanbanAI'
  }

  private getDefaultProviderName(type: AiProviderType) {
    return this.resolveProviderTypeLabel(type)
  }

  private createBuiltinProvider(): AiProviderConfig {
    return {
      id: AiConfigService.BUILTIN_PROVIDER_ID,
      name: AiConfigService.BUILTIN_PROVIDER_NAME,
      type: 'builtin-cloud',
      managementMode: 'fixed',
      presetKey: BUILTIN_AI_PROVIDER_ID,
      requiresPlatformLogin: true,
      enabled: true,
      baseUrl: null,
      apiKey: null,
      defaultModelId: null,
      models: [],
      availableModels: [],
      builtinManagedModels: [],
      lastHealthCheckAt: null,
      lastHealthStatus: 'unknown',
      lastHealthMessage: null,
      builtinRouteStatus: 'unknown',
      builtinRouteCheckedAt: null,
      builtinRouteMessage: null,
      builtinEffectiveModel: null,
      builtinModelsSyncedAt: null,
      builtinCapabilities: this.getEmptyBuiltinCapabilities(),
      builtinChecks: this.getEmptyBuiltinChecks(),
    }
  }

  private shouldSelectAllBuiltinModelsOnBootstrap(settings: AiSettings, provider: AiProviderConfig) {
    return Boolean(
      provider.type === 'builtin-cloud'
      && !settings.migrations?.builtinModelBootstrapCompletedAt
      && !provider.models.length
      && !provider.availableModels?.length
      && !provider.builtinManagedModels?.length,
    )
  }

  private buildCatalogItems(settings: AiSettings): AiModelCatalogItem[] {
    const items = settings.providers.flatMap(provider => {
      if (!provider.enabled) {
        return [] as AiModelCatalogItem[]
      }

      if (provider.type === 'builtin-cloud') {
        return (provider.builtinManagedModels || [])
          .filter(model => this.isWorkbenchCatalogModelCandidate(model))
          .map(model => this.buildCatalogItem(provider, model, settings))
      }

      return provider.models
        .filter(model => this.isWorkbenchCatalogModelCandidate(model))
        .map(model => this.buildCatalogItem(provider, model, settings))
    })

    return items
  }

  private buildCatalogItem(provider: AiProviderConfig, model: AiProviderModel, settings: AiSettings): AiModelCatalogItem {
    const displayName = getAiModelDisplayName(model.displayName, provider.type, model.model)
    const providerName = provider.type === 'builtin-cloud'
      ? global.i18next.t('aiConfigService.builtinProviderName')
      : provider.name
    return {
      providerId: provider.id,
      providerName,
      providerType: provider.type,
      modelId: model.id,
      model: model.model,
      displayName,
      label: `${providerName} / ${displayName}`,
      supportsTools: this.modelSupportsToolAuto(model),
      capabilities: model.capabilities,
      inputModalities: model.inputModalities,
      outputModalities: model.outputModalities,
      endpointTypes: model.endpointTypes,
      maxInputTokens: model.maxInputTokens,
      maxOutputTokens: model.maxOutputTokens,
      supportsStreaming: model.supportsStreaming,
      supportsVision: aiModelSupportsImageInput(model),
      contextWindow: model.contextWindow ?? null,
      isDefault: settings.defaultProviderId === provider.id && settings.defaultModelId === model.id,
    }
  }

  private resolveDefaultSelection(settings: AiSettings): AiResolvedModelSelection | null {
    const interactiveDefaultTier = this.getInteractiveDefaultTier()
    return this.resolveTierDefaultSelection(settings, interactiveDefaultTier)
  }

  private resolveRuntimeSelectionForPurpose(
    settings: AiSettings,
    currentSelection?: AiThreadModelSelection | null,
    requestedSelection?: AiThreadModelSelection | null,
    purpose: AiRuntimePurpose = 'interactive-default',
  ): AiResolvedModelSelection {
    const requiredBuiltinTier = this.getRequiredBuiltinTierForPurpose(purpose)
    const defaultSelection = this.resolveRuntimeDefaultSelection(settings, purpose)
    if (!this.isModelSelectionAllowedForCurrentUser(settings)) {
      if (!defaultSelection) {
        throw new AiRuntimeUserActionableError(
          'AI_RUNTIME_PURPOSE_UNAVAILABLE',
          this.buildPurposeUnavailableMessage(purpose),
          'configuration',
        )
      }
      return defaultSelection
    }

    const normalizedCurrent = this.normalizeSelection(currentSelection)
    const normalizedRequested = this.normalizeSelection(requestedSelection)
    const currentSelectionSource = this.resolveSelectionSource(currentSelection, {
      fallbackToDefaultWhenSelectionExists: true,
    })
    const requestedSelectionSource = this.resolveSelectionSource(requestedSelection)
    const hasCurrentSelection = this.hasSelection(normalizedCurrent)
    const hasRequestedSelection = this.hasSelection(normalizedRequested)
    const hasRequestedSelectionPatch = this.hasSelectionPatch(requestedSelection)
    const shouldFollowDefault = requestedSelectionSource === 'default'
      || (hasRequestedSelectionPatch && !hasRequestedSelection)
      || (!hasRequestedSelectionPatch && currentSelectionSource === 'default')
    if (shouldFollowDefault) {
      if (!defaultSelection) {
        throw new AiRuntimeUserActionableError(
          'AI_RUNTIME_PURPOSE_UNAVAILABLE',
          this.buildPurposeUnavailableMessage(purpose),
          'configuration',
        )
      }
      return defaultSelection
    }

    const mergedSelection = this.mergeSelection(
      currentSelectionSource === 'default'
        ? this.normalizeSelection(defaultSelection)
        : normalizedCurrent,
      normalizedRequested,
      requestedSelection,
    )
    const finalSelectionSource = this.resolveFinalSelectionSource({
      currentSelectionSource,
      requestedSelectionSource,
      hasRequestedSelection,
      hasRequestedSelectionPatch,
    })

    const resolved = this.resolveSelectionFromSettings(settings, mergedSelection, finalSelectionSource, {
      requiredBuiltinTier,
    })
    if (resolved) {
      return resolved
    }

    if (hasCurrentSelection || hasRequestedSelection || hasRequestedSelectionPatch) {
      throw new AiRuntimeUserActionableError(
        'AI_MODEL_SELECTION_INVALID',
        this.buildSelectionInvalidMessage(settings, mergedSelection),
        'selection',
      )
    }

    if (!defaultSelection) {
      throw new AiRuntimeUserActionableError(
        'AI_RUNTIME_PURPOSE_UNAVAILABLE',
        this.buildPurposeUnavailableMessage(purpose),
        'configuration',
      )
    }

    return defaultSelection
  }

  private resolveRuntimeDefaultSelection(
    settings: AiSettings,
    purpose: AiRuntimePurpose,
  ): AiResolvedModelSelection | null {
    if (purpose !== 'ai-semantic-warmup') {
      return this.resolveDefaultSelection(settings)
    }

    const fastDefault = this.resolveTierDefaultSelection(settings, 'fast')
    if (fastDefault) {
      return fastDefault
    }

    const builtinProvider = this.findProvider(settings, AiConfigService.BUILTIN_PROVIDER_ID)
    if (builtinProvider?.enabled) {
      const builtinModel = this.pickBuiltinTierRouteCandidate(builtinProvider, 'fast')
        || this.pickBuiltinRepresentativeRouteCandidate(builtinProvider)
      if (builtinModel) {
        return {
          providerId: builtinProvider.id,
          modelId: builtinModel.id,
          model: builtinModel.model,
          modelSelectionSource: 'default',
        }
      }
    }

    return null
  }

  private resolveTierDefaultSelection(settings: AiSettings, tier: AiModelTier): AiResolvedModelSelection | null {
    const configuredSelection = settings.defaultSelections?.[tier]
    if (!configuredSelection?.providerId || !configuredSelection?.modelId) {
      return null
    }

    return this.resolveSelectionFromSettings(settings, {
      providerId: configuredSelection.providerId,
      modelId: configuredSelection.modelId,
    }, 'default', {
      requiredBuiltinTier: tier,
    })
  }

  private resolveSelectionFromSettings(
    settings: AiSettings,
    selection: AiThreadModelSelection,
    modelSelectionSource: AiThreadModelSelectionSource,
    options?: {
      requiredBuiltinTier?: AiModelTier | null
    },
  ) {
    const requiredBuiltinTier = options?.requiredBuiltinTier || null
    const exactItem = this.findCatalogItem(settings, selection)
    if (exactItem) {
      return this.toResolvedSelection(exactItem, modelSelectionSource)
    }

    const provider = selection.providerId ? this.findProvider(settings, selection.providerId) : null
    if (provider) {
      const legacyBuiltinSelection = this.resolveLegacyBuiltinSelection(
        provider,
        modelSelectionSource,
        selection,
        requiredBuiltinTier,
      )
      if (legacyBuiltinSelection) {
        return legacyBuiltinSelection
      }

      const matchedBuiltinRouteCandidate = provider.type === 'builtin-cloud'
        ? this.matchBuiltinRouteCandidate(provider, selection)
        : null
      if (provider.type === 'builtin-cloud') {
        if (this.isLegacyBuiltinSelection(provider, selection)) {
          return null
        }
        if (matchedBuiltinRouteCandidate) {
          return {
            providerId: provider.id,
            modelId: matchedBuiltinRouteCandidate.id,
            model: matchedBuiltinRouteCandidate.model,
            modelSelectionSource,
          }
        }
      }

      const providerItems = this.buildCatalogItems(settings).filter(item => item.providerId === provider.id)
      const modelItem = providerItems.find(item => item.modelId === selection.modelId || item.model === selection.model)
      if (modelItem) {
        return this.toResolvedSelection(modelItem, modelSelectionSource)
      }

      if (providerItems.length && !selection.modelId && !selection.model) {
        return this.toResolvedSelection(providerItems[0], modelSelectionSource)
      }
    }

    if (!selection.providerId && (selection.modelId || selection.model)) {
      const builtinProvider = this.findProvider(settings, AiConfigService.BUILTIN_PROVIDER_ID)
      if (builtinProvider?.enabled && this.matchBuiltinRouteCandidate(builtinProvider, selection)) {
        const matched = this.matchBuiltinRouteCandidate(builtinProvider, selection)
        if (matched) return {
          providerId: builtinProvider.id,
          modelId: matched.id,
          model: matched.model,
          modelSelectionSource,
        }
      }
      const matched = this.buildCatalogItems(settings).find(item =>
        item.modelId === selection.modelId || item.model === selection.model,
      )
      if (matched) {
        return this.toResolvedSelection(matched, modelSelectionSource)
      }
    }

    return null
  }

  private resolveLegacyBuiltinSelection(
    provider: AiProviderConfig | null | undefined,
    modelSelectionSource: AiThreadModelSelectionSource,
    selection?: AiThreadModelSelection | null,
    requiredTier?: AiModelTier | null,
  ): AiResolvedModelSelection | null {
    if (provider?.type !== 'builtin-cloud' || !provider.enabled) {
      return null
    }

    if (!this.isLegacyBuiltinSelection(provider, selection)) {
      return null
    }

    if (requiredTier && !this.hasBuiltinRouteCandidateForTier(provider, requiredTier)) {
      return null
    }

    const tier = requiredTier || this.getInteractiveDefaultTier()
    const builtinModel = this.pickBuiltinTierRouteCandidate(provider, tier)
      || this.pickBuiltinRepresentativeRouteCandidate(provider)
    if (!builtinModel) {
      return null
    }
    return {
      providerId: provider.id,
      modelId: builtinModel.id,
      model: builtinModel.model,
      modelSelectionSource,
    }
  }

  private isLegacyBuiltinSelection(
    provider: AiProviderConfig | null | undefined,
    selection?: Partial<AiThreadModelSelection> | null,
  ) {
    if (provider?.type !== 'builtin-cloud') {
      return false
    }

    const normalizedSelection = this.normalizeSelection(selection)
    if (normalizedSelection.providerId && normalizedSelection.providerId !== provider.id) {
      return false
    }

    const modelId = this.normalizeText(normalizedSelection.modelId)
    const model = this.normalizeText(normalizedSelection.model)
    if (!modelId && !model) {
      return false
    }

    return (
      modelId === AiConfigService.BUILTIN_MODEL_PUBLIC_ID
      || model === AiConfigService.BUILTIN_MODEL_PUBLIC_ID
    )
  }

  private findCatalogItem(settings: AiSettings, selection?: AiThreadModelSelection | null) {
    const normalizedSelection = this.normalizeSelection(selection)
    if (!normalizedSelection.providerId && !normalizedSelection.modelId && !normalizedSelection.model) {
      return null
    }

    return this.buildCatalogItems(settings).find(item => {
      const providerMatched = !normalizedSelection.providerId || item.providerId === normalizedSelection.providerId
      const modelIdMatched = !normalizedSelection.modelId || item.modelId === normalizedSelection.modelId
      const modelMatched = !normalizedSelection.model || item.model === normalizedSelection.model
      return providerMatched && modelIdMatched && modelMatched
    }) || null
  }

  private toResolvedSelection(
    item: AiModelCatalogItem,
    modelSelectionSource: AiThreadModelSelectionSource,
  ): AiResolvedModelSelection {
    return {
      providerId: item.providerId,
      modelId: item.modelId,
      model: item.model,
      modelSelectionSource,
    }
  }

  private isModelSelectionAllowedForCurrentUser(settings: AiSettings) {
    return Boolean(settings.allowModelSelection)
  }

  private toPublicSelectionFromSettings(settings: AiSettings, selection?: AiThreadModelSelection | null): AiThreadModelSelection {
    const selectionSource = this.normalizeSelectionSource(selection?.modelSelectionSource)
    if (selectionSource === 'default') {
      const defaultSelection = this.resolveDefaultSelection(settings)
      if (defaultSelection) {
        return this.toPublicSelectionFromSettings(settings, this.normalizeSelection(defaultSelection))
      }
    }

    const normalizedSelection = this.normalizeSelection(selection)
    if (!this.hasSelection(normalizedSelection)) {
      return normalizedSelection
    }

    const provider = normalizedSelection.providerId
      ? this.findProvider(settings, normalizedSelection.providerId)
      : null
    const builtinProvider = provider?.type === 'builtin-cloud'
      ? provider
      : this.findProvider(settings, AiConfigService.BUILTIN_PROVIDER_ID)
    if (builtinProvider) {
      const legacySelection = this.resolveLegacyBuiltinSelection(
        builtinProvider,
        selectionSource || 'explicit',
        normalizedSelection,
      )
      const matchedBuiltinModel = legacySelection
        || (() => {
          const model = this.matchBuiltinRouteCandidate(builtinProvider, normalizedSelection)
          return model
            ? {
              providerId: builtinProvider.id,
              modelId: model.id,
              model: model.model,
            }
            : null
        })()
      if (matchedBuiltinModel) {
        return {
          providerId: matchedBuiltinModel.providerId,
          modelId: matchedBuiltinModel.modelId,
          model: matchedBuiltinModel.model,
        }
      }
    }

    const matchedModel = provider?.models.find(item =>
      item.id === normalizedSelection.modelId
      || item.model === normalizedSelection.model
      || item.id === normalizedSelection.model
      || item.model === normalizedSelection.modelId,
    )
    if (provider && matchedModel) {
      return {
        providerId: provider.id,
        modelId: matchedModel.id,
        model: matchedModel.model,
      }
    }

    return normalizedSelection
  }

  private buildSelectionInvalidMessage(settings: AiSettings, selection?: AiThreadModelSelection | null) {
    const normalizedSelection = this.normalizeSelection(selection)
    const provider = normalizedSelection.providerId ? this.findProvider(settings, normalizedSelection.providerId) : null
    if (!provider) {
      return global.i18next.t('aiConfigService.threadProviderExpired', {
        provider: normalizedSelection.providerId || global.i18next.t('aiConfigService.notSet'),
      })
    }

    if (provider.type === 'builtin-cloud') {
      const model = this.matchBuiltinRouteCandidate(provider, normalizedSelection)
      const modelDisplayName = model
        ? getAiModelDisplayName(model.displayName, provider.type, model.model)
        : normalizedSelection.model || normalizedSelection.modelId || provider.name
      if (!provider.enabled) {
        return global.i18next.t('aiConfigService.threadProviderDisabled', { provider: provider.name })
      }
      if (!this.isBuiltinProviderReady(provider)) {
        const reason = this.normalizeText(provider.builtinRouteMessage) || this.normalizeText(provider.lastHealthMessage)
        return reason
          ? global.i18next.t('aiConfigService.threadModelUnavailableWithReason', {
            model: modelDisplayName,
            reason,
          })
          : global.i18next.t('aiConfigService.threadModelUnavailable', {
            model: modelDisplayName,
          })
      }
      return global.i18next.t('aiConfigService.threadModelUnavailable', {
        model: modelDisplayName,
      })
    }

    const model = provider.models.find(item => item.id === normalizedSelection.modelId || item.model === normalizedSelection.model)
    if (!model) {
      const modelDisplayName = normalizedSelection.model
        || normalizedSelection.modelId
        || global.i18next.t('aiConfigService.notSet')
      return global.i18next.t('aiConfigService.threadModelMissing', { model: modelDisplayName })
    }
    const modelDisplayName = getAiModelDisplayName(model.displayName, provider.type, model.model)
    if (!provider.enabled) {
      return global.i18next.t('aiConfigService.threadProviderDisabled', { provider: provider.name })
    }
    if (!model.enabled) {
      return global.i18next.t('aiConfigService.threadModelDisabled', { model: modelDisplayName })
    }
    if (model.validationStatus !== 'passed' || !this.modelSupportsToolAuto(model)) {
      return global.i18next.t('aiConfigService.threadModelNotApproved', { model: modelDisplayName })
    }
    return global.i18next.t('aiConfigService.threadModelUnavailable', { model: modelDisplayName })
  }

  private getBuiltinRouteCandidates(provider?: AiProviderConfig | null) {
    const modelMap = new Map<string, AiProviderModel>()
    const append = (models?: AiProviderModel[] | null) => {
      (models || []).forEach(model => {
        const normalizedId = this.normalizeText(model?.id)
        const normalizedModel = this.normalizeText(model?.model)
        if (!normalizedId || !normalizedModel) return
        if (normalizedId === AiConfigService.BUILTIN_MODEL_PUBLIC_ID || normalizedModel === AiConfigService.BUILTIN_MODEL_PUBLIC_ID) {
          return
        }
        if (this.isRemovedBuiltinModel(normalizedId) || this.isRemovedBuiltinModel(normalizedModel)) {
          return
        }
        if (!modelMap.has(normalizedId)) {
          modelMap.set(normalizedId, this.normalizeModel(model, 'builtin-cloud'))
        }
      })
    }

    append(provider?.builtinManagedModels)
    append(provider?.models)
    append(provider?.availableModels)
    return [...modelMap.values()]
  }

  private getBuiltinAvailableTiers(provider: AiProviderConfig): AiModelTier[] {
    return (['fast', 'balanced', 'deep'] as AiModelTier[]).filter(tier =>
      this.hasBuiltinRouteCandidateForTier(provider, tier),
    )
  }

  private buildBuiltinPreflightPurposeReadiness(provider?: AiProviderConfig | null): AiBuiltinPreflightResult['readiness'] {
    const interactiveTier = this.getInteractiveDefaultTier()
    const warmupTier = this.getWarmupDefaultTier()
    const interactiveTierLabel = getAiModelTierLabel(interactiveTier)
    const warmupTierLabel = getAiModelTierLabel(warmupTier)
    const interactiveCandidate = provider ? this.pickBuiltinTierRouteCandidate(provider, interactiveTier) : null
    const warmupCandidate = provider ? this.pickBuiltinTierRouteCandidate(provider, warmupTier) : null

    return {
      interactiveDefault: {
        ready: Boolean(interactiveCandidate),
        requiredTier: interactiveTier,
        effectiveModel: interactiveCandidate?.model || null,
        message: interactiveCandidate
          ? global.i18next.t('aiConfigService.defaultChatAvailable')
          : global.i18next.t('aiConfigService.defaultChatTierUnavailable', { tier: interactiveTierLabel }),
      },
      semanticWarmup: {
        ready: Boolean(warmupCandidate),
        requiredTier: warmupTier,
        effectiveModel: warmupCandidate?.model || null,
        message: warmupCandidate
          ? global.i18next.t('aiConfigService.semanticWarmupAvailable')
          : global.i18next.t('aiConfigService.semanticWarmupTierUnavailable', { tier: warmupTierLabel }),
      },
    }
  }

  private buildBuiltinPreflightMessage(
    provider: AiProviderConfig,
    readiness: AiBuiltinPreflightResult['readiness'],
  ) {
    const routeMessage = this.normalizeText(provider.builtinRouteMessage)

    if (!readiness.interactiveDefault.ready && !readiness.semanticWarmup.ready) {
      return routeMessage || global.i18next.t('aiConfigService.banbanAiUnavailable')
    }

    const segments: string[] = []

    if (readiness.interactiveDefault.ready && readiness.semanticWarmup.ready) {
      return routeMessage || global.i18next.t('aiConfigService.defaultChatAndWarmupAvailable')
    }

    if (readiness.interactiveDefault.ready) {
      segments.push(global.i18next.t('aiConfigService.defaultChatAvailable'))
    } else {
      segments.push(global.i18next.t('aiConfigService.defaultChatUnavailable'))
    }

    if (readiness.semanticWarmup.ready) {
      segments.push(global.i18next.t('aiConfigService.semanticWarmupAvailable'))
    } else {
      segments.push(global.i18next.t('aiConfigService.semanticWarmupUnavailable'))
    }

    if (routeMessage) {
      segments.push(routeMessage)
    }

    return segments.join(global.i18next.t('aiConfigService.sectionSeparator'))
      || routeMessage
      || global.i18next.t('aiConfigService.banbanAiUnavailable')
  }

  private getModelTier(model?: Pick<AiProviderModel, 'tier' | 'meta'> | null) {
    return this.normalizeModelTier(
      model?.tier
      || model?.meta?.builtin?.level,
    )
  }

  private hasBuiltinRouteCandidateForTier(provider: AiProviderConfig, tier: AiModelTier) {
    return this.getBuiltinRouteCandidates(provider).some(model =>
      this.isBuiltinWorkbenchRouteCandidate(model)
      && model.validationStatus === 'passed'
      && this.getModelTier(model) === tier,
    )
  }

  private isBuiltinWorkbenchRouteCandidate(model?: AiProviderModel | null) {
    return Boolean(model && model.enabled)
  }

  private matchBuiltinRouteCandidate(provider: AiProviderConfig, selection?: AiThreadModelSelection | null) {
    const normalizedSelection = this.normalizeSelection(selection)
    if (!normalizedSelection.modelId && !normalizedSelection.model) {
      return null
    }
    return this.getBuiltinRouteCandidates(provider).find(model =>
      model.id === normalizedSelection.modelId
      || model.model === normalizedSelection.model
      || model.id === normalizedSelection.model
      || model.model === normalizedSelection.modelId,
    ) || null
  }

  private resolveBuiltinEffectiveModel(
    provider: AiProviderConfig,
    currentSelection?: AiThreadModelSelection | null,
    requestedSelection?: AiThreadModelSelection | null,
    requestedReasoningLevel?: AiReasoningLevel,
    purpose: AiRuntimePurpose = 'interactive-default',
  ) {
    const legacyMatched = this.matchBuiltinRouteCandidate(provider, requestedSelection)
      || this.matchBuiltinRouteCandidate(provider, currentSelection)
    if (legacyMatched) {
      return this.resolveBuiltinReasoningRuntimeConfig(
        provider,
        legacyMatched,
        requestedReasoningLevel,
        'builtin-legacy-model-selection-v4',
      )
    }

    const tier = purpose === 'ai-semantic-warmup'
      ? this.getWarmupDefaultTier()
      : this.getInteractiveDefaultTier()
    const tierCandidate = this.pickBuiltinTierRouteCandidate(provider, tier)
    const routeCandidate = tierCandidate || this.pickBuiltinRepresentativeRouteCandidate(provider)
    if (!routeCandidate) {
      throw new AiRuntimeUserActionableError(
        'AI_RUNTIME_PURPOSE_UNAVAILABLE',
        this.buildPurposeUnavailableMessage(purpose),
        'configuration',
      )
    }

    return this.resolveBuiltinReasoningRuntimeConfig(
      provider,
      routeCandidate,
      purpose === 'ai-semantic-warmup' ? undefined : requestedReasoningLevel,
      (purpose === 'ai-semantic-warmup')
        ? 'builtin-purpose-fast-v1'
        : 'builtin-purpose-balanced-v1',
    )
  }

  private pickBuiltinTierRouteCandidate(provider: AiProviderConfig, tier: AiModelTier) {
    const candidates = this.getBuiltinRouteCandidates(provider)
      .filter(model =>
        this.isBuiltinWorkbenchRouteCandidate(model)
        && model.validationStatus === 'passed'
        && this.getModelTier(model) === tier,
      )

    return this.pickBuiltinPreferredRouteCandidate(candidates)
  }

  private resolveBuiltinReasoningRuntimeConfig(
    provider: AiProviderConfig,
    model: AiProviderModel,
    requestedReasoningLevel: AiReasoningLevel | null | undefined,
    routePolicyId: string,
  ) {
    const normalizedRequestedLevel = this.normalizeReasoningLevel(requestedReasoningLevel)
    const baseResult = {
      model,
      routePolicyId,
      routeVersion: '1',
      fallbackHit: false,
      effectiveReasoningLevel: undefined as AiReasoningLevel | undefined,
      reasoningMode: 'builtin-route' as AiReasoningMode,
      modelKwargs: undefined as Record<string, any> | undefined,
    }

    if (!normalizedRequestedLevel || this.getModelTier(model) === 'fast') {
      return baseResult
    }

    const reasoningMeta = this.normalizeReasoningMeta(model.meta?.reasoning)
    if (reasoningMeta.mode === 'model-map') {
      const mappedModel = this.resolveMappedBuiltinReasoningModel(
        provider,
        normalizedRequestedLevel,
        reasoningMeta.modelMap,
        this.getModelTier(model),
      )
      if (mappedModel) {
        return {
          ...baseResult,
          model: mappedModel,
          routePolicyId: `${routePolicyId}-model-map-v1`,
          effectiveReasoningLevel: normalizedRequestedLevel,
          reasoningMode: 'model-map' as AiReasoningMode,
        }
      }

      return {
        ...baseResult,
        routePolicyId: `${routePolicyId}-model-map-fallback-v1`,
        fallbackHit: true,
      }
    }

    if (reasoningMeta.mode === 'parameter') {
      const parameterName = reasoningMeta.parameterName || 'reasoning_effort'
      return {
        ...baseResult,
        routePolicyId: `${routePolicyId}-parameter-v1`,
        effectiveReasoningLevel: normalizedRequestedLevel,
        reasoningMode: 'parameter' as AiReasoningMode,
        modelKwargs: {
          [parameterName]: normalizedRequestedLevel,
        },
      }
    }

    return {
      ...baseResult,
      routePolicyId: `${routePolicyId}-reasoning-fallback-v1`,
      fallbackHit: true,
    }
  }

  private resolveMappedBuiltinReasoningModel(
    provider: AiProviderConfig,
    requestedReasoningLevel: AiReasoningLevel,
    modelMap?: Partial<Record<AiReasoningLevel, string>>,
    requiredTier?: AiModelTier | null,
  ) {
    const preferred = String(modelMap?.[requestedReasoningLevel] || '').trim()
    if (!preferred) {
      return null
    }

    const matched = this.getBuiltinRouteCandidates(provider).find(item =>
      (item.id === preferred || item.model === preferred)
      && this.isBuiltinWorkbenchRouteCandidate(item)
      && (!requiredTier || this.getModelTier(item) === requiredTier),
    )
    if (!matched) {
      return null
    }

    return this.normalizeModel(matched, provider.type)
  }

  private pickBuiltinPreferredRouteCandidate(models: AiProviderModel[]) {
    if (!models.length) {
      return null
    }

    return models[0] || null
  }

  private pickBuiltinRepresentativeRouteCandidate(provider?: AiProviderConfig | null) {
    const candidates = this.getBuiltinRouteCandidates(provider)
      .filter(model =>
        this.isBuiltinWorkbenchRouteCandidate(model)
        && model.validationStatus === 'passed',
      )
    if (!candidates.length) {
      return null
    }

    for (const tier of [this.getInteractiveDefaultTier(), 'deep', this.getWarmupDefaultTier()] as AiModelTier[]) {
      const matched = this.pickBuiltinPreferredRouteCandidate(
        candidates.filter(model => this.getModelTier(model) === tier),
      )
      if (matched) {
        return matched
      }
    }

    return this.pickBuiltinPreferredRouteCandidate(candidates)
  }

  private pickBuiltinBootstrapRouteCandidate(provider: AiProviderConfig) {
    const candidates = this.getBuiltinRouteCandidates(provider)
      .filter(model => this.isBuiltinWorkbenchRouteCandidate(model))
    if (!candidates.length) {
      return null
    }

    for (const tier of ['deep', 'balanced', 'fast'] as AiModelTier[]) {
      const matched = this.pickBuiltinPreferredRouteCandidate(
        candidates.filter(model => this.getModelTier(model) === tier),
      )
      if (matched) {
        return matched
      }
    }

    return this.pickBuiltinPreferredRouteCandidate(candidates)
  }

  private pickBuiltinRouteCandidateForReasoning(models: AiProviderModel[], requestedLevel: AiReasoningLevel) {
    if (!models.length) {
      return null
    }

    const grouped = {
      low: models.filter(model => this.inferBuiltinReasoningLevel(model) === 'low'),
      medium: models.filter(model => this.inferBuiltinReasoningLevel(model) === 'medium'),
      high: models.filter(model => this.inferBuiltinReasoningLevel(model) === 'high'),
    }

    if (requestedLevel === 'low') {
      const lowCandidate = this.pickBuiltinLowestCostCandidate(grouped.low)
      if (lowCandidate) {
        return {
          model: lowCandidate,
          effectiveReasoningLevel: 'low' as AiReasoningLevel,
          fallbackHit: false,
        }
      }
      const mediumCandidate = this.pickBuiltinLowestCostCandidate(grouped.medium)
      if (mediumCandidate) {
        return {
          model: mediumCandidate,
          effectiveReasoningLevel: 'medium' as AiReasoningLevel,
          fallbackHit: true,
        }
      }
      const highCandidate = this.pickBuiltinLowestCostCandidate(grouped.high)
      if (highCandidate) {
        return {
          model: highCandidate,
          effectiveReasoningLevel: 'high' as AiReasoningLevel,
          fallbackHit: true,
        }
      }
      return null
    }

    if (requestedLevel === 'high') {
      const highCandidate = this.pickBuiltinStrongestCandidate(grouped.high)
      if (highCandidate) {
        return {
          model: highCandidate,
          effectiveReasoningLevel: 'high' as AiReasoningLevel,
          fallbackHit: false,
        }
      }
      const mediumCandidate = this.pickBuiltinStrongestCandidate(grouped.medium)
      if (mediumCandidate) {
        return {
          model: mediumCandidate,
          effectiveReasoningLevel: 'medium' as AiReasoningLevel,
          fallbackHit: true,
        }
      }
      const lowCandidate = this.pickBuiltinStrongestCandidate(grouped.low)
      if (lowCandidate) {
        return {
          model: lowCandidate,
          effectiveReasoningLevel: 'low' as AiReasoningLevel,
          fallbackHit: true,
        }
      }
      return null
    }

    const mediumCandidate = this.pickBuiltinPreferredRouteCandidate(grouped.medium)
    if (mediumCandidate) {
      return {
        model: mediumCandidate,
        effectiveReasoningLevel: 'medium' as AiReasoningLevel,
        fallbackHit: false,
      }
    }

    const higherFallbackCandidate = this.pickBuiltinStrongestCandidate(grouped.high)
    if (higherFallbackCandidate) {
      return {
        model: higherFallbackCandidate,
        effectiveReasoningLevel: 'high' as AiReasoningLevel,
        fallbackHit: true,
      }
    }

    const lowerFallbackCandidate = this.pickBuiltinStrongestCandidate(grouped.low)
      || this.pickBuiltinPreferredRouteCandidate(models)
    if (!lowerFallbackCandidate) {
      return null
    }

    return {
      model: lowerFallbackCandidate,
      effectiveReasoningLevel: this.inferBuiltinReasoningLevel(lowerFallbackCandidate),
      fallbackHit: this.inferBuiltinReasoningLevel(lowerFallbackCandidate) !== 'medium',
    }
  }

  private pickBuiltinLowestCostCandidate(models: AiProviderModel[]) {
    return [...models].sort((left, right) => this.scoreBuiltinModel(left) - this.scoreBuiltinModel(right))[0] || null
  }

  private pickBuiltinStrongestCandidate(models: AiProviderModel[]) {
    return [...models].sort((left, right) => this.scoreBuiltinModel(right) - this.scoreBuiltinModel(left))[0] || null
  }

  private scoreBuiltinModel(model?: Pick<AiProviderModel, 'model' | 'displayName' | 'contextWindow' | 'meta'> | null) {
    if (!model) {
      return 0
    }
    const tierScore = this.inferBuiltinReasoningLevel(model) === 'high'
      ? 300
      : this.inferBuiltinReasoningLevel(model) === 'medium'
        ? 200
        : 100
    const windowScore = Math.min(80, Math.max(0, Math.round(Number(model.contextWindow || 0) / 16000)))
    const name = `${String(model.model || '')} ${String(model.displayName || '')}`.toLowerCase()
    const keywordBoost = /(pro|reasoner|r1|397b|405b|671b|235b|gpt-5|o3|o4|opus|sonnet)/i.test(name)
      ? 18
      : /(turbo|plus|max)/i.test(name)
        ? 10
        : /(mini|small|lite|flash|nano|haiku|8b|7b|14b|32b)/i.test(name)
          ? -18
          : 0
    return tierScore + windowScore + keywordBoost
  }

  private inferBuiltinReasoningLevel(model?: Pick<AiProviderModel, 'model' | 'displayName' | 'meta'> | null): AiReasoningLevel {
    const name = `${String(model?.model || '')} ${String(model?.displayName || '')}`.toLowerCase()
    const inferredFromName = this.inferBuiltinReasoningLevelFromName(name)
    const explicit = this.normalizeReasoningLevel(
      model?.meta?.reasoning?.tier
      || model?.meta?.reasoningTier,
    )
    if (!explicit) {
      return inferredFromName
    }

    // Builtin availableModels may retain stale tier metadata from older releases.
    // When the model name itself carries a clear size/tier signal, trust the name.
    return this.hasStrongBuiltinReasoningNameSignal(name)
      ? inferredFromName
      : explicit
  }

  private inferBuiltinReasoningLevelFromName(name: string): AiReasoningLevel {
    if (this.isBuiltinHighReasoningName(name)) {
      return 'high'
    }
    if (this.isBuiltinLowReasoningName(name)) {
      return 'low'
    }
    return 'medium'
  }

  private hasStrongBuiltinReasoningNameSignal(name: string) {
    return this.isBuiltinHighReasoningName(name) || this.isBuiltinLowReasoningName(name)
  }

  private isBuiltinHighReasoningName(name: string) {
    return /(pro|reasoner|r1|397b|405b|671b|235b|gpt-5|o3|o4|opus|sonnet)/i.test(name)
  }

  private isBuiltinLowReasoningName(name: string) {
    return /(mini|small|lite|flash|nano|haiku)/i.test(name)
      // Require a non-digit boundary so 397b will not be misread as 7b.
      || /(?:^|[^0-9])(8b|7b|14b|32b)(?:$|[^0-9])/i.test(name)
  }

  private resolveExternalReasoningRuntimeConfig(
    provider: AiProviderConfig,
    model: AiProviderModel,
    requestedReasoningLevel?: AiReasoningLevel,
    purpose: AiRuntimePurpose = 'interactive-default',
  ) {
    const normalizedRequestedLevel = this.normalizeReasoningLevel(requestedReasoningLevel)
    const reasoningMeta = this.normalizeReasoningMeta(model.meta?.reasoning)
    const baseResult = {
      model,
      routePolicyId: 'external-provider-default-v1',
      routeVersion: '1',
      fallbackHit: false,
      effectiveReasoningLevel: undefined as AiReasoningLevel | undefined,
      reasoningMode: 'provider-default' as AiReasoningMode,
      modelKwargs: undefined as Record<string, any> | undefined,
    }

    if (purpose === 'ai-semantic-warmup') {
      return {
        ...baseResult,
        routePolicyId: 'external-provider-warmup-default-v1',
      }
    }

    if (!normalizedRequestedLevel || this.getModelTier(model) === 'fast') {
      return baseResult
    }

    if (reasoningMeta.mode === 'model-map') {
      const mappedModel = this.resolveMappedReasoningModel(provider, normalizedRequestedLevel, reasoningMeta.modelMap)
      if (mappedModel) {
        return {
          model: mappedModel,
          routePolicyId: 'external-model-map-reasoning-v1',
          routeVersion: '1',
          fallbackHit: false,
          effectiveReasoningLevel: normalizedRequestedLevel,
          reasoningMode: 'model-map' as AiReasoningMode,
          modelKwargs: undefined,
        }
      }
      return {
        ...baseResult,
        routePolicyId: 'external-model-map-reasoning-fallback-v1',
        fallbackHit: true,
      }
    }

    if (reasoningMeta.mode === 'parameter') {
      const parameterName = reasoningMeta.parameterName || 'reasoning_effort'
      return {
        model,
        routePolicyId: 'external-parameter-reasoning-v1',
        routeVersion: '1',
        fallbackHit: false,
        effectiveReasoningLevel: normalizedRequestedLevel,
        reasoningMode: 'parameter' as AiReasoningMode,
        modelKwargs: {
          [parameterName]: normalizedRequestedLevel,
        },
      }
    }

    return {
      ...baseResult,
      routePolicyId: 'external-provider-default-reasoning-fallback-v1',
      fallbackHit: true,
    }
  }

  private resolveMappedReasoningModel(
    provider: AiProviderConfig,
    requestedReasoningLevel: AiReasoningLevel,
    modelMap?: Partial<Record<AiReasoningLevel, string>>,
  ) {
    const preferred = String(modelMap?.[requestedReasoningLevel] || '').trim()
    if (!preferred) {
      return null
    }

    const matched = provider.models.find(item =>
      (item.id === preferred || item.model === preferred)
      && this.isWorkbenchCatalogModelCandidate(item),
    )
    if (!matched) {
      return null
    }

    return this.normalizeModel(matched, provider.type)
  }

  private normalizeReasoningMeta(value?: any): {
    mode?: 'parameter' | 'model-map' | 'unsupported'
    parameterName?: string
    modelMap?: Partial<Record<AiReasoningLevel, string>>
  } {
    const mode = String(value?.mode || '').trim().toLowerCase()
    const parameterName = String(value?.parameterName || value?.parameter || '').trim() || undefined
    const rawModelMap = value?.levelModelMap || value?.modelMap
    const modelMap: Partial<Record<AiReasoningLevel, string>> = {}
    if (rawModelMap && typeof rawModelMap === 'object') {
      ;(['low', 'medium', 'high'] as AiReasoningLevel[]).forEach(level => {
        const normalized = String(rawModelMap?.[level] || '').trim()
        if (normalized) {
          modelMap[level] = normalized
        }
      })
    }

    return {
      mode: mode === 'parameter' || mode === 'model-map' || mode === 'unsupported'
        ? mode
        : undefined,
      parameterName,
      modelMap: Object.keys(modelMap).length ? modelMap : undefined,
    }
  }

  private resolveProviderForTesting(settings: AiSettings, input?: Partial<AiProviderConfig> & { id?: string | null }) {
    if (!input) {
      return this.assertProvider(settings, AiConfigService.BUILTIN_PROVIDER_ID)
    }

    const existingProvider = input.id ? this.findProvider(settings, input.id) : null
    return this.normalizeProvider({
      ...(existingProvider || {}),
      ...input,
    }, existingProvider || undefined)
  }

  private async runProviderConnectionTest(provider: AiProviderConfig): Promise<AiProviderTestResult> {
    const checkedAt = Date.now()

    try {
      if (provider.type === 'builtin-cloud') {
        const models = await this.discoverBuiltinModels()
        const builtinProvider = this.normalizeProvider({
          ...provider,
          availableModels: models,
          builtinModelsSyncedAt: checkedAt,
          lastHealthCheckAt: checkedAt,
          lastHealthStatus: models.length ? 'healthy' : 'unhealthy',
          lastHealthMessage: models.length ? null : global.i18next.t('aiConfigService.builtinModelsUnavailable'),
        }, provider)
        const runtimeProvider = await this.refreshBuiltinProviderRuntimeState(builtinProvider)
        return {
          success: runtimeProvider.builtinRouteStatus !== 'unavailable',
          checkedAt: runtimeProvider.lastHealthCheckAt || runtimeProvider.builtinRouteCheckedAt || checkedAt,
          healthStatus: runtimeProvider.lastHealthStatus || (models.length ? 'healthy' : 'unhealthy'),
          message: runtimeProvider.lastHealthMessage || runtimeProvider.builtinRouteMessage || null,
          models: runtimeProvider.availableModels || models,
          provider: runtimeProvider,
        }
      }

      if (provider.type === 'ollama') {
        const rootBaseUrl = this.stripOpenAiVersionSuffix(provider.baseUrl)
        const version = await this.fetchJson(`${rootBaseUrl}/api/version`)
        const tags = await this.fetchJson(`${rootBaseUrl}/api/tags`)
        return {
          success: true,
          checkedAt,
          healthStatus: 'healthy',
          message: version?.version
            ? global.i18next.t('aiConfigService.ollamaConnected', { version: version.version })
            : global.i18next.t('aiConfigService.connectionSuccessful'),
          models: await this.mapOllamaModels(tags, rootBaseUrl),
        }
      }

      const models = await this.discoverOpenAiCompatibleModels(provider)
      return {
        success: true,
        checkedAt,
        healthStatus: 'healthy',
        message: models.length
          ? global.i18next.t('aiConfigService.modelsFound', { count: models.length })
          : global.i18next.t('aiConfigService.connectedNoModels'),
        models,
      }
    } catch (error) {
      return {
        success: false,
        checkedAt,
        healthStatus: 'unhealthy',
        message: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async discoverProviderModels(provider: AiProviderConfig) {
    if (provider.type === 'builtin-cloud') {
      return await this.discoverBuiltinModels()
    }
    if (provider.type === 'ollama') {
      const rootBaseUrl = this.stripOpenAiVersionSuffix(provider.baseUrl)
      const tags = await this.fetchJson(`${rootBaseUrl}/api/tags`)
      return await this.mapOllamaModels(tags, rootBaseUrl)
    }
    return await this.discoverOpenAiCompatibleModels(provider)
  }

  private async discoverBuiltinModels() {
    const items = this.normalizeBuiltinModelsV4Items(await this.aiRest.getModelsV4())
    return items
      .map(item => {
        const model = this.normalizeText(item?.model || item?.id)
        const tier = this.normalizeModelTier(item?.level)
        if (!model) {
          return null
        }

        const builtinMeta = {
          ...this.normalizeRecord(item?.meta),
          builtin: {
            ...this.normalizeRecord(item?.meta?.builtin),
            ...(tier ? { level: tier } : {}),
            routeId: this.normalizeText(item?.routeId) || null,
            apiModelId: this.normalizeText(item?.apiModelId) || model,
          },
        }

        return this.discoverModel({
          id: this.normalizeText(item?.id) || model,
          model,
          displayName: this.normalizeText(item?.displayName) || model,
          contextWindow: Number.isFinite(Number(item?.contextWindow)) ? Number(item?.contextWindow) : null,
          capabilities: normalizeAiModelCapabilities(item?.capabilities),
          inputModalities: normalizeAiModelModalities(item?.inputModalities),
          outputModalities: normalizeAiModelModalities(item?.outputModalities),
          endpointTypes: normalizeAiModelEndpointTypes(item?.endpointTypes),
          maxInputTokens: Number.isFinite(Number(item?.maxInputTokens)) ? Number(item?.maxInputTokens) : null,
          maxOutputTokens: Number.isFinite(Number(item?.maxOutputTokens)) ? Number(item?.maxOutputTokens) : null,
          supportsStreaming: item?.supportsStreaming !== false,
          toolCapabilities: this.normalizeToolCapabilities(item?.toolCapabilities, null, 'builtin-cloud'),
          meta: builtinMeta,
        }, {
          providerType: 'builtin-cloud',
          source: 'builtin',
          enabled: false,
          allowInWorkbenchAgent: tier !== 'fast',
          supportsTools: normalizeAiModelCapabilities(item?.capabilities).includes(AI_MODEL_CAPABILITIES.FUNCTION_CALL),
          capabilities: normalizeAiModelCapabilities(item?.capabilities),
          inputModalities: normalizeAiModelModalities(item?.inputModalities),
          outputModalities: normalizeAiModelModalities(item?.outputModalities),
          endpointTypes: normalizeAiModelEndpointTypes(item?.endpointTypes),
          maxInputTokens: Number.isFinite(Number(item?.maxInputTokens)) ? Number(item?.maxInputTokens) : null,
          maxOutputTokens: Number.isFinite(Number(item?.maxOutputTokens)) ? Number(item?.maxOutputTokens) : null,
          supportsStreaming: item?.supportsStreaming !== false,
          validationStatus: 'unverified',
        })
      })
      .filter((model): model is AiProviderModel => Boolean(
        model
        && model.model
        && !this.isRemovedBuiltinModel(model.id)
        && !this.isRemovedBuiltinModel(model.model)
      ))
  }

  private normalizeBuiltinModelsV4Items(input: unknown) {
    const rawItems = Array.isArray(input)
      ? input
      : (Array.isArray((input as { data?: unknown } | null)?.data)
        ? (input as { data: unknown[] }).data
        : null)
    if (!rawItems) {
      throw this.createBuiltinModelsProtocolError(global.i18next.t('aiConfigService.builtinModelsV3ResponseInvalid'))
    }

    return rawItems.map((rawItem, index) => {
      const item = typeof rawItem === 'string'
        ? { model: rawItem }
        : (this.normalizeRecord(rawItem) || {})
      const model = this.normalizeText(item?.model || item?.id || item?.apiModelId || item?.name || item?.displayName)
      const level = this.normalizeModelTier(item?.level)
      if (!model) {
        throw this.createBuiltinModelsProtocolError(global.i18next.t('aiConfigService.builtinModelsV3ItemInvalid', { index: index + 1 }))
      }
      return {
        ...item,
        id: this.normalizeText(item.apiModelId || item.id || item.routeId) || model,
        model,
        displayName: this.normalizeText(item.displayName) || model,
        ...(level ? { level } : {}),
      }
    }).filter((item, index, array) => array.findIndex(candidate => candidate.id === item.id) === index)
  }

  private async discoverOpenAiCompatibleModels(provider: AiProviderConfig) {
    const baseUrl = this.normalizeProviderBaseUrl(provider.baseUrl, provider.type)
    if (!baseUrl) {
      throw this.createProviderBaseUrlMissingError(provider)
    }

    const payload = await this.fetchJson(`${baseUrl}/models`, {
      apiKey: provider.apiKey || undefined,
    })
    const modelList = Array.isArray(payload?.data) ? payload.data : []
    return modelList
      .map(item => this.discoverModel({
        id: String(item?.id || '').trim(),
        model: String(item?.id || '').trim(),
        displayName: String(item?.id || '').trim(),
        contextWindow: this.extractOpenAiCompatibleContextWindow(item),
        meta: this.normalizeRecord(item),
      }, {
        providerType: provider.type,
        source: 'sync',
      }))
      .filter(model => Boolean(model.model))
  }

  private async mapOllamaModels(payload: any, baseUrl?: string) {
    const models = Array.isArray(payload?.models) ? payload.models : []
    const contextWindowMap = baseUrl
      ? await this.fetchOllamaContextWindows(models, baseUrl)
      : new Map<string, number | null>()
    return models
      .map(item => {
        const modelName = String(item?.name || '').trim()
        return this.discoverModel({
          id: modelName,
          model: modelName,
          displayName: modelName,
          contextWindow: contextWindowMap.get(modelName) ?? null,
          meta: this.normalizeRecord({
            modifiedAt: item?.modified_at,
            size: item?.size,
            digest: item?.digest,
            details: item?.details,
          }),
        }, {
          providerType: 'ollama',
          source: 'sync',
        })
      })
      .filter(model => Boolean(model.model))
  }

  private async fetchOllamaContextWindows(models: any[], baseUrl: string) {
    const contextWindowMap = new Map<string, number | null>()
    await Promise.all(models.map(async item => {
      const modelName = String(item?.name || '').trim()
      if (!modelName) return
      try {
        const payload = await this.fetchJson(`${baseUrl}/api/show`, {
          method: 'POST',
          body: {
            model: modelName,
          },
        })
        contextWindowMap.set(modelName, this.extractOllamaContextWindow(payload))
      } catch {
        contextWindowMap.set(modelName, null)
      }
    }))
    return contextWindowMap
  }

  private async refreshModelContextWindow(provider: AiProviderConfig, model: AiProviderModel) {
    if (provider.type === 'builtin-cloud') {
      return model.contextWindow ?? null
    }

    if (provider.type === 'ollama') {
      try {
        const payload = await this.fetchJson(`${this.stripOpenAiVersionSuffix(provider.baseUrl)}/api/show`, {
          method: 'POST',
          timeoutMs: (provider as AiProviderValidationRuntime)[AI_MODEL_VALIDATION_TIMEOUT],
          body: {
            model: model.model,
          },
        })
        return this.extractOllamaContextWindow(payload) ?? model.contextWindow ?? null
      } catch {
        return model.contextWindow ?? null
      }
    }

    try {
      const baseUrl = this.normalizeProviderBaseUrl(provider.baseUrl, provider.type)
      if (!baseUrl) return model.contextWindow ?? null
      const payload = await this.fetchJson(`${baseUrl}/models`, {
        apiKey: provider.apiKey || undefined,
        timeoutMs: (provider as AiProviderValidationRuntime)[AI_MODEL_VALIDATION_TIMEOUT],
      })
      const modelList = Array.isArray(payload?.data) ? payload.data : []
      const matchedModel = modelList.find(item => {
        const itemId = String(item?.id || '').trim()
        return itemId === model.id || itemId === model.model
      })
      return this.extractOpenAiCompatibleContextWindow(matchedModel) ?? model.contextWindow ?? null
    } catch {
      return model.contextWindow ?? null
    }
  }

  private discoverModel(
    input: Pick<AiProviderModel, 'id' | 'model' | 'displayName' | 'meta'> & Partial<AiProviderModel>,
    options: DiscoverModelOptions,
  ) {
    return this.normalizeModel({
      id: input.id,
      model: input.model,
      displayName: input.displayName,
      enabled: options.enabled ?? true,
      allowInWorkbenchAgent: options.allowInWorkbenchAgent ?? false,
      supportsTools: options.supportsTools ?? false,
      toolCapabilities: {
        auto: options.supportsTools ?? false,
        requireAny: false,
        requireSpecific: false,
        parallel: false,
      },
      supportsVision: options.supportsVision ?? false,
      ...(Array.isArray(options.capabilities ?? input.capabilities)
        ? { capabilities: options.capabilities ?? input.capabilities }
        : {}),
      ...(Array.isArray(options.inputModalities ?? input.inputModalities)
        ? { inputModalities: options.inputModalities ?? input.inputModalities }
        : {}),
      ...(Array.isArray(options.outputModalities ?? input.outputModalities)
        ? { outputModalities: options.outputModalities ?? input.outputModalities }
        : {}),
      ...(Array.isArray(options.endpointTypes ?? input.endpointTypes)
        ? { endpointTypes: options.endpointTypes ?? input.endpointTypes }
        : {}),
      maxInputTokens: options.maxInputTokens ?? input.maxInputTokens,
      maxOutputTokens: options.maxOutputTokens ?? input.maxOutputTokens,
      supportsStreaming: options.supportsStreaming ?? input.supportsStreaming ?? true,
      contextWindow: input.contextWindow ?? null,
      source: options.source,
      validationStatus: options.validationStatus ?? 'unverified',
      validationMessage: input.validationMessage || null,
      lastValidatedAt: input.lastValidatedAt || null,
      remark: input.remark || null,
      meta: input.meta || null,
    }, options.providerType)
  }

  private applyBuiltinLegacyModelMigration(
    settings: AiSettings,
    options?: { selectAllBuiltinModels?: boolean },
  ) {
    const builtinProvider = this.findProvider(settings, AiConfigService.BUILTIN_PROVIDER_ID)
    if (!builtinProvider) {
      return settings
    }

    const migrationCompleted = Boolean(settings.migrations?.builtinModelBootstrapCompletedAt)
    let changed = false
    const migratedSelections = (['fast', 'balanced', 'deep'] as AiModelTier[]).reduce<AiDefaultModelSelections>((result, tier) => {
      const selection = settings.defaultSelections?.[tier] || null
      if (!this.isLegacyBuiltinSelection(builtinProvider, selection)) {
        result[tier] = selection
        return result
      }

      const model = this.pickBuiltinTierRouteCandidate(builtinProvider, tier)
        || this.pickBuiltinPreferredRouteCandidate(
          this.getBuiltinRouteCandidates(builtinProvider).filter(candidate =>
            this.isBuiltinWorkbenchRouteCandidate(candidate)
            && this.getModelTier(candidate) === tier,
          ),
        )
      result[tier] = model
        ? { providerId: builtinProvider.id, modelId: model.id }
        : null
      changed = true
      return result
    }, {
      fast: null,
      balanced: null,
      deep: null,
    })

    const interactiveTier = this.getInteractiveDefaultTier()
    const legacyDefaultSelection = this.isLegacyBuiltinSelection(builtinProvider, {
      providerId: settings.defaultProviderId,
      modelId: settings.defaultModelId,
    })
    const nextInteractiveSelection = legacyDefaultSelection
      ? migratedSelections[interactiveTier]
      : {
          providerId: settings.defaultProviderId,
          modelId: settings.defaultModelId,
        }
    if (legacyDefaultSelection) {
      changed = true
    }

    const migratedModelIds = new Set(
      Object.values(migratedSelections)
        .filter((selection): selection is AiTierDefaultSelection => selection?.providerId === builtinProvider.id)
        .map(selection => selection.modelId),
    )
    const shouldSelectAllBuiltinModels = Boolean(
      options?.selectAllBuiltinModels
      && !migrationCompleted
      && builtinProvider.availableModels?.length,
    )
    const managedModels = shouldSelectAllBuiltinModels
      ? (builtinProvider.availableModels || []).map(model => ({ ...model, enabled: true }))
      : [...(builtinProvider.builtinManagedModels || [])]
    if (shouldSelectAllBuiltinModels) {
      changed = true
    }
    migratedModelIds.forEach(modelId => {
      if (managedModels.some(model => model.id === modelId || model.model === modelId)) {
        return
      }
      const model = this.getBuiltinRouteCandidates(builtinProvider).find(candidate =>
        candidate.id === modelId || candidate.model === modelId,
      )
      if (model) {
        managedModels.push(model)
        changed = true
      }
    })

    const hasBuiltinModels = Boolean(
      builtinProvider.models.length
      || builtinProvider.availableModels?.length
      || builtinProvider.builtinManagedModels?.length,
    )
    if (!changed && (migrationCompleted || !hasBuiltinModels)) {
      return settings
    }

    return {
      ...settings,
      defaultSelections: migratedSelections,
      defaultProviderId: nextInteractiveSelection?.providerId || null,
      defaultModelId: nextInteractiveSelection?.modelId || null,
      providers: settings.providers.map(provider => provider.id === builtinProvider.id
        ? {
            ...provider,
            builtinManagedModels: managedModels,
          }
        : provider),
      migrations: {
        ...(settings.migrations || {}),
        builtinModelBootstrapCompletedAt: settings.migrations?.builtinModelBootstrapCompletedAt || Date.now(),
      },
    }
  }

  private migrateLegacyProviderModels(
    provider: AiProviderConfig,
    defaultSelection?: Pick<AiThreadModelSelection, 'providerId' | 'modelId'>,
  ) {
    if (provider.availableModels?.length || !provider.models.length) {
      return provider
    }

    const keepIds = new Set<string>()
    const defaultMatched = (
      this.normalizeText(defaultSelection?.providerId) === provider.id
        ? this.normalizeText(defaultSelection?.modelId)
        : ''
    )

    provider.models.forEach(model => {
      if (model.source === 'manual') {
        keepIds.add(model.id)
      }
    })

    if (defaultMatched && provider.models.some(model => model.id === defaultMatched)) {
      keepIds.add(defaultMatched)
    }

    return this.normalizeProvider({
      ...provider,
      models: provider.models.filter(model => keepIds.has(model.id)),
      availableModels: provider.models,
    }, provider)
  }

  private mergeModelWithDiscovered(
    currentModel: AiProviderModel | undefined,
    discoveredModel: AiProviderModel,
    providerType: AiProviderType,
    options?: {
      preserveManagedState?: boolean
    },
  ) {
    if (!currentModel) {
      return this.normalizeModel(discoveredModel, providerType)
    }

    const preserveManagedState = options?.preserveManagedState !== false
    const currentCapabilities = this.normalizeToolCapabilities(currentModel.toolCapabilities, {
      auto: currentModel.supportsTools,
      requireAny: false,
      requireSpecific: false,
      parallel: false,
    }, providerType)
    const discoveredCapabilities = this.normalizeToolCapabilities(discoveredModel.toolCapabilities, {
      auto: discoveredModel.supportsTools,
      requireAny: false,
      requireSpecific: false,
      parallel: false,
    }, providerType)
    const nextModel = this.normalizeModel({
      ...currentModel,
      ...discoveredModel,
      displayName: preserveManagedState ? currentModel.displayName : discoveredModel.displayName,
      enabled: preserveManagedState ? currentModel.enabled : discoveredModel.enabled,
      allowInWorkbenchAgent: preserveManagedState ? currentModel.allowInWorkbenchAgent : discoveredModel.allowInWorkbenchAgent,
      supportsTools: preserveManagedState ? this.modelSupportsToolAuto(currentModel) : this.modelSupportsToolAuto(discoveredModel),
      toolCapabilities: preserveManagedState ? currentCapabilities : discoveredCapabilities,
      supportsVision: preserveManagedState ? currentModel.supportsVision : discoveredModel.supportsVision,
      capabilities: preserveManagedState ? currentModel.capabilities : discoveredModel.capabilities,
      inputModalities: preserveManagedState ? currentModel.inputModalities : discoveredModel.inputModalities,
      outputModalities: preserveManagedState ? currentModel.outputModalities : discoveredModel.outputModalities,
      endpointTypes: preserveManagedState ? currentModel.endpointTypes : discoveredModel.endpointTypes,
      maxInputTokens: discoveredModel.maxInputTokens ?? currentModel.maxInputTokens ?? null,
      maxOutputTokens: discoveredModel.maxOutputTokens ?? currentModel.maxOutputTokens ?? null,
      supportsStreaming: discoveredModel.supportsStreaming,
      contextWindow: discoveredModel.contextWindow ?? currentModel.contextWindow ?? null,
      source: preserveManagedState ? currentModel.source : discoveredModel.source,
      validationStatus: preserveManagedState ? (currentModel.validationStatus || discoveredModel.validationStatus) : discoveredModel.validationStatus,
      validationMessage: preserveManagedState ? (currentModel.validationMessage || discoveredModel.validationMessage) : discoveredModel.validationMessage,
      validationChecks: preserveManagedState ? (currentModel.validationChecks || discoveredModel.validationChecks) : discoveredModel.validationChecks,
      lastValidatedAt: preserveManagedState ? (currentModel.lastValidatedAt || discoveredModel.lastValidatedAt) : discoveredModel.lastValidatedAt,
      remark: currentModel.remark || discoveredModel.remark,
      meta: {
        ...(this.normalizeRecord(currentModel.meta) || {}),
        ...(this.normalizeRecord(discoveredModel.meta) || {}),
        ...(preserveManagedState && this.normalizeText(currentModel.meta?.group)
          ? { group: this.normalizeText(currentModel.meta?.group) }
          : {}),
      },
    }, providerType)

    if (preserveManagedState && (nextModel.validationStatus !== 'passed' || !this.modelSupportsToolAuto(nextModel))) {
      nextModel.allowInWorkbenchAgent = false
    }

    return nextModel
  }

  private mergeDiscoveredModels(
    provider: AiProviderConfig,
    discoveredModels: AiProviderModel[],
    options?: { selectNewBuiltinModels?: boolean },
  ) {
    const getIdentity = (model: AiProviderModel) => provider.type === 'builtin-cloud'
      ? this.normalizeText(model.meta?.builtin?.apiModelId) || this.normalizeText(model.model) || this.normalizeText(model.id)
      : this.normalizeText(model.id)
    const existingManagedModelMap = new Map(provider.models.map(model => [getIdentity(model), model]))
    const existingAvailableModelMap = new Map((provider.availableModels || []).map(model => [getIdentity(model), model]))
    const discoveredModelMap = new Map(discoveredModels.map(model => [getIdentity(model), model]))

    const nextAvailableModels = discoveredModels.map(discoveredModel => {
      const identity = getIdentity(discoveredModel)
      const currentModel = existingAvailableModelMap.get(identity) || existingManagedModelMap.get(identity)
      const mergedModel = this.mergeModelWithDiscovered(currentModel, discoveredModel, provider.type, {
        preserveManagedState: false,
      })
      return provider.type === 'builtin-cloud'
        ? { ...mergedModel, enabled: currentModel?.enabled ?? Boolean(options?.selectNewBuiltinModels) }
        : mergedModel
    })

    const nextModels = provider.models.map(model => {
      const discoveredModel = discoveredModelMap.get(getIdentity(model))
      return discoveredModel
        ? this.mergeModelWithDiscovered(model, discoveredModel, provider.type, {
          preserveManagedState: true,
        })
        : this.normalizeModel({
          ...model,
          ...(provider.type === 'builtin-cloud'
            ? { available: false }
            : {}),
        }, provider.type, model)
    })

    return this.normalizeProvider({
      ...provider,
      models: nextModels,
      availableModels: nextAvailableModels,
    }, provider)
  }

  private async runModelConnectionCheck(provider: AiProviderConfig, model: AiProviderModel): Promise<ValidationCheckResult> {
    try {
      if (provider.type === 'builtin-cloud') {
        await this.fetchBuiltinCompletion({
          model: model.model,
          messages: [{ role: 'user', content: 'Reply OK only.' }],
          max_tokens: 8,
          temperature: 0,
          stream: false,
        })
      } else {
        await this.fetchProviderCompletion(provider, {
          model: model.model,
          messages: [{ role: 'user', content: 'Reply OK only.' }],
          max_tokens: 8,
          temperature: 0,
          stream: false,
        })
      }
      return { ok: true, message: global.i18next.t('aiConfigService.connectionTestPassed') }
    } catch (error) {
      return {
        ok: false,
        message: global.i18next.t('aiConfigService.connectionTestFailed', {
          error: this.describeValidationError(error, 'connection'),
        }),
      }
    }
  }

  private async runModelGenerationCheck(provider: AiProviderConfig, model: AiProviderModel): Promise<ValidationCheckResult> {
    try {
      const requestBody = {
        model: model.model,
        messages: [
          { role: 'system', content: 'Directly answer with the final reply only. Do not expose reasoning.' },
          { role: 'user', content: 'Reply with OK only.' },
        ],
        max_tokens: 128,
        temperature: 0,
        stream: false,
      }
      let response = provider.type === 'builtin-cloud'
        ? await this.fetchBuiltinCompletion(requestBody)
        : await this.fetchProviderCompletion(provider, requestBody)

      if (this.shouldRetryForReasoningOnlyResponse(response)) {
        const retryBody = {
          ...requestBody,
          max_tokens: 256,
        }
        response = provider.type === 'builtin-cloud'
          ? await this.fetchBuiltinCompletion(retryBody)
          : await this.fetchProviderCompletion(provider, retryBody)
      }

      const text = this.extractAssistantText(response)
      if (!text.trim()) {
        if (this.extractAssistantReasoning(response)) {
          return { ok: false, message: global.i18next.t('aiConfigService.generationTestReasoningOnly') }
        }
        return { ok: false, message: global.i18next.t('aiConfigService.generationTestNoContent') }
      }

      return { ok: true, message: global.i18next.t('aiConfigService.generationTestPassed') }
    } catch (error) {
      return {
        ok: false,
        message: global.i18next.t('aiConfigService.generationTestFailed', {
          error: this.describeValidationError(error, 'generation'),
        }),
      }
    }
  }

  private async runModelHealthProbe(
    provider: AiProviderValidationRuntime,
    model: AiProviderModel,
    timeoutMs: number,
  ): Promise<ValidationCheckResult> {
    const requestBody = {
      model: model.model,
      messages: [
        { role: 'system', content: 'test' },
        { role: 'user', content: 'hi' },
      ],
      max_tokens: 8,
      temperature: 0,
      stream: false,
    }
    const response = provider.type === 'builtin-cloud'
      ? await this.fetchBuiltinCompletion(requestBody, { timeoutMs })
      : await this.fetchProviderCompletion(provider, requestBody)
    if (!this.extractAssistantText(response).trim()) {
      return { ok: false, message: global.i18next.t('aiConfigService.generationTestNoContent') }
    }
    return { ok: true, message: global.i18next.t('aiConfigService.generationTestPassed') }
  }

  private async runModelStructuredJsonCheck(provider: AiProviderConfig, model: AiProviderModel): Promise<ValidationCheckResult> {
    try {
      const requestBody = {
        model: model.model,
        messages: [
          { role: 'system', content: 'Return valid JSON only. Do not include markdown fences.' },
          { role: 'user', content: 'Return {"ok":true,"mode":"json"} only.' },
        ],
        max_tokens: 128,
        temperature: 0,
        stream: false,
      }
      let response = provider.type === 'builtin-cloud'
        ? await this.fetchBuiltinCompletion(requestBody)
        : await this.fetchProviderCompletion(provider, requestBody)

      if (this.shouldRetryForReasoningOnlyResponse(response)) {
        const retryBody = {
          ...requestBody,
          max_tokens: 256,
        }
        response = provider.type === 'builtin-cloud'
          ? await this.fetchBuiltinCompletion(retryBody)
          : await this.fetchProviderCompletion(provider, retryBody)
      }

      const text = this.extractAssistantText(response)
      const parsed = this.parseStructuredJsonValidationResponse(text)
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, message: global.i18next.t('aiConfigService.jsonTestInvalidObject') }
      }
      if (parsed.ok !== true) {
        return { ok: false, message: global.i18next.t('aiConfigService.jsonTestUnexpectedShape') }
      }
      return { ok: true, message: global.i18next.t('aiConfigService.jsonTestPassed') }
    } catch (error) {
      return {
        ok: false,
        message: global.i18next.t('aiConfigService.jsonTestFailed', {
          error: this.describeValidationError(error, 'generation'),
        }),
      }
    }
  }

  private async detectReasoningCapability(
    provider: AiProviderConfig,
    runtimeModel: AiProviderModel,
    sourceModel: AiProviderModel,
  ) {
    if (provider.type === 'builtin-cloud') {
      return {
        mode: 'builtin-route',
        levels: ['low', 'medium', 'high'],
        tier: this.inferBuiltinReasoningLevel(runtimeModel),
      }
    }

    const existingReasoningMeta = this.normalizeReasoningMeta(sourceModel.meta?.reasoning)
    if (existingReasoningMeta.mode === 'model-map' && existingReasoningMeta.modelMap) {
      return {
        mode: 'model-map',
        levels: ['low', 'medium', 'high'],
        modelMap: existingReasoningMeta.modelMap,
        validatedAt: Date.now(),
      }
    }

    const reasoningCheck = await this.runModelReasoningCapabilityCheck(provider, runtimeModel)
    return reasoningCheck.ok
      ? {
          mode: 'parameter',
          levels: ['low', 'medium', 'high'],
          parameterName: 'reasoning_effort',
          validatedAt: Date.now(),
        }
      : {
          mode: 'unsupported',
          levels: [],
          validatedAt: Date.now(),
          error: reasoningCheck.message,
        }
  }

  private resolveReasoningMetaForValidation(provider: AiProviderConfig, model: AiProviderModel, checkedAt: number) {
    if (provider.type === 'builtin-cloud') {
      return {
        mode: 'builtin-route',
        levels: ['low', 'medium', 'high'],
        validatedAt: checkedAt,
      }
    }

    const existingReasoningMeta = this.normalizeReasoningMeta(model.meta?.reasoning)
    if (existingReasoningMeta.mode === 'model-map' && existingReasoningMeta.modelMap) {
      return {
        mode: 'model-map',
        levels: ['low', 'medium', 'high'],
        modelMap: existingReasoningMeta.modelMap,
        validatedAt: checkedAt,
      }
    }

    return {
      mode: existingReasoningMeta.mode || 'unsupported',
      levels: existingReasoningMeta.mode === 'parameter' ? ['low', 'medium', 'high'] : [],
      parameterName: existingReasoningMeta.parameterName,
      modelMap: existingReasoningMeta.modelMap,
      validatedAt: checkedAt,
    }
  }

  private mergeModelMeta(current?: Record<string, any> | null, patch?: Record<string, any> | null) {
    return this.normalizeRecord({
      ...(this.normalizeRecord(current) || {}),
      ...(this.normalizeRecord(patch) || {}),
    })
  }

  private async runProviderModelValidation(
    provider: AiProviderConfig,
    model: AiProviderModel,
    runtimeModel: AiProviderModel,
    purpose: AiRuntimePurpose = 'interactive-default',
  ): Promise<AiModelValidationResult> {
    const checkedAt = Date.now()
    return await this.runProviderModelValidationByPurpose(
      provider,
      model,
      runtimeModel,
      checkedAt,
      purpose,
    )
  }

  private async runProviderModelValidationByPurpose(
    provider: AiProviderConfig,
    model: AiProviderModel,
    runtimeModel: AiProviderModel,
    checkedAt: number,
    purpose: AiRuntimePurpose,
  ): Promise<AiModelValidationResult> {
    const connection = await this.runModelConnectionCheck(provider, runtimeModel)
    const generation = connection.ok
      ? await this.runModelGenerationCheck(provider, runtimeModel)
      : { ok: false, skipped: true, message: global.i18next.t('aiConfigService.generationTestSkippedConnection') }
    const isStructuredJsonPurpose = purpose === 'ai-semantic-warmup'
    const structuredJson = isStructuredJsonPurpose
      ? (generation.ok
          ? await this.runModelStructuredJsonCheck(provider, runtimeModel)
          : { ok: false, skipped: true, message: global.i18next.t('aiConfigService.jsonTestSkippedGeneration') })
      : null
    const toolAuto = isStructuredJsonPurpose
      ? { ok: false, skipped: true, message: '' }
      : (generation.ok
          ? await this.runModelToolAutoCheck(provider, runtimeModel)
          : {
              ok: false,
              skipped: true,
              message: connection.ok
                ? global.i18next.t('aiConfigService.toolTestSkippedGeneration')
                : global.i18next.t('aiConfigService.toolTestSkippedConnection'),
            })
    const toolRequireAny = isStructuredJsonPurpose
      ? { ok: false, skipped: true, message: '' }
      : (toolAuto.ok
          ? await this.runModelToolRequireAnyCheck(provider, runtimeModel)
          : {
              ok: false,
              skipped: true,
              message: generation.ok
                ? global.i18next.t('aiConfigService.requiredToolTestSkippedTool')
                : global.i18next.t('aiConfigService.requiredToolTestSkippedGeneration'),
            })
    const toolRequireSpecific = isStructuredJsonPurpose
      ? { ok: false, skipped: true, message: '' }
      : (toolAuto.ok
          ? await this.runModelToolRequireSpecificCheck(provider, runtimeModel)
          : {
              ok: false,
              skipped: true,
              message: generation.ok
                ? global.i18next.t('aiConfigService.specificToolTestSkippedTool')
                : global.i18next.t('aiConfigService.specificToolTestSkippedGeneration'),
            })
    const toolParallel = isStructuredJsonPurpose
      ? { ok: false, skipped: true, message: '' }
      : (toolAuto.ok
          ? await this.runModelToolParallelCheck(provider, runtimeModel)
          : {
              ok: false,
              skipped: true,
              message: generation.ok
                ? global.i18next.t('aiConfigService.parallelToolTestSkippedTool')
                : global.i18next.t('aiConfigService.parallelToolTestSkippedGeneration'),
            })

    const contextWindow = await this.refreshModelContextWindow(provider, runtimeModel)
    const success = isStructuredJsonPurpose
      ? (connection.ok && generation.ok && Boolean(structuredJson?.ok))
      : (connection.ok && generation.ok && toolAuto.ok)
    const reasoningCapability = success
      ? await this.detectReasoningCapability(provider, runtimeModel, model)
      : this.resolveReasoningMetaForValidation(provider, model, checkedAt)
    const nextModel = this.normalizeModel({
      ...model,
      supportsTools: isStructuredJsonPurpose ? false : toolAuto.ok,
      toolCapabilities: isStructuredJsonPurpose
        ? {
            auto: false,
            requireAny: false,
            requireSpecific: false,
            parallel: false,
          }
        : {
            auto: toolAuto.ok,
            requireAny: toolRequireAny.ok,
            requireSpecific: toolRequireSpecific.ok,
            parallel: toolParallel.ok,
          },
      validationChecks: {
        connection: connection.ok,
        generation: generation.ok,
        toolAuto: isStructuredJsonPurpose ? false : toolAuto.ok,
        toolRequireAny: isStructuredJsonPurpose ? false : toolRequireAny.ok,
        toolRequireSpecific: isStructuredJsonPurpose ? false : toolRequireSpecific.ok,
        toolParallel: isStructuredJsonPurpose ? false : toolParallel.ok,
      },
      validationStatus: success ? 'passed' : 'failed',
      validationMessage: this.buildValidationSummaryMessage({
        connection,
        generation,
        structuredJson: structuredJson || undefined,
        toolAuto,
        toolParallel,
      }),
      lastValidatedAt: checkedAt,
      allowInWorkbenchAgent: isStructuredJsonPurpose
        ? false
        : (success ? model.allowInWorkbenchAgent : false),
      contextWindow: contextWindow ?? model.contextWindow ?? null,
      meta: this.mergeModelMeta(model.meta, {
        reasoning: reasoningCapability,
      }),
    }, provider.type)

    return {
      success,
      checkedAt,
      status: nextModel.validationStatus,
      checks: {
        connection: connection.ok,
        generation: generation.ok,
        tools: isStructuredJsonPurpose ? Boolean(structuredJson?.ok) : toolAuto.ok,
        toolAuto: isStructuredJsonPurpose ? false : toolAuto.ok,
        toolRequireAny: isStructuredJsonPurpose ? false : toolRequireAny.ok,
        toolRequireSpecific: isStructuredJsonPurpose ? false : toolRequireSpecific.ok,
        toolParallel: isStructuredJsonPurpose ? false : toolParallel.ok,
      },
      message: nextModel.validationMessage || null,
      model: nextModel,
    }
  }

  private async applyExternalParallelCapabilityMigration(settings: AiSettings) {
    let nextSettings = settings
    let changed = false

    for (const provider of settings.providers) {
      for (const model of provider.models) {
        if (!this.shouldAutoRevalidateExternalModelParallelCapability(provider, model)) {
          continue
        }

        const migratedModel = await this.revalidateExternalModelParallelCapability(
          provider,
          model,
          'settings-load',
        )
        if (!migratedModel) {
          continue
        }

        nextSettings = this.replaceProviderModelInSettings(nextSettings, provider.id, migratedModel)
        changed = true
      }
    }

    return {
      settings: changed ? nextSettings : settings,
      changed,
    }
  }

  private async ensureExternalModelParallelCapabilityForRuntime(
    settings: AiSettings,
    selection: AiResolvedModelSelection,
  ): Promise<{
    settings: AiSettings
    provider: AiProviderConfig
    model?: AiProviderModel
  }> {
    let nextSettings = settings
    let provider = this.assertProvider(nextSettings, selection.providerId)
    if (provider.type === 'builtin-cloud') {
      return {
        settings: nextSettings,
        provider,
      }
    }

    let model = this.assertModel(provider, selection.modelId)
    if (!this.shouldAutoRevalidateExternalModelParallelCapability(provider, model)) {
      return {
        settings: nextSettings,
        provider,
        model,
      }
    }

    const migratedModel = await this.revalidateExternalModelParallelCapability(
      provider,
      model,
      'runtime-selection',
    )
    if (!migratedModel) {
      return {
        settings: nextSettings,
        provider,
        model,
      }
    }

    nextSettings = this.replaceProviderModelInSettings(nextSettings, provider.id, migratedModel)
    await this.persistSettings(nextSettings)
    provider = this.assertProvider(nextSettings, selection.providerId)
    model = this.assertModel(provider, selection.modelId)
    return {
      settings: nextSettings,
      provider,
      model,
    }
  }

  private async revalidateExternalModelParallelCapability(
    provider: AiProviderConfig,
    model: AiProviderModel,
    trigger: 'settings-load' | 'runtime-selection',
  ) {
    const validation = await this.runProviderModelValidation(provider, model, model)
    if (validation.checks.toolAuto) {
      return this.markExternalParallelCapabilityMigrationCompleted(
        validation.model,
        provider.type,
        validation.checkedAt,
        trigger,
        true,
      )
    }

    return this.markExternalParallelCapabilityMigrationAttempt(
      model,
      provider.type,
      validation.checkedAt,
      trigger,
      validation.message,
    )
  }

  private shouldAutoRevalidateExternalModelParallelCapability(
    provider: AiProviderConfig,
    model: AiProviderModel,
  ) {
    if (provider.type === 'builtin-cloud') {
      return false
    }
    if (model.validationStatus !== 'passed' || !this.modelSupportsToolAuto(model)) {
      return false
    }

    const migration = this.readExternalParallelCapabilityMigration(model)
    if (
      migration.version === AiConfigService.EXTERNAL_PARALLEL_MIGRATION_VERSION
      && migration.completedAt
    ) {
      return false
    }

    return !migration.lastAttemptAt
      || migration.lastAttemptAt <= Date.now() - AiConfigService.EXTERNAL_PARALLEL_MIGRATION_RETRY_TTL_MS
  }

  private readExternalParallelCapabilityMigration(model: AiProviderModel) {
    const migration = this.normalizeRecord(this.normalizeRecord(model.meta)?.parallelCapabilityMigration)
    return {
      version: Number.isFinite(Number(migration?.version))
        ? Math.max(0, Math.round(Number(migration?.version)))
        : 0,
      completedAt: this.normalizeTimestamp(migration?.completedAt) || null,
      lastAttemptAt: this.normalizeTimestamp(migration?.lastAttemptAt) || null,
    }
  }

  private markExternalParallelCapabilityMigrationCompleted(
    model: AiProviderModel,
    providerType: AiProviderType,
    checkedAt: number,
    source: 'manual-validation' | 'settings-load' | 'runtime-selection',
    toolAutoPassed: boolean,
  ) {
    if (providerType === 'builtin-cloud' || !toolAutoPassed) {
      return model
    }

    return this.normalizeModel({
      ...model,
      meta: this.mergeModelMeta(model.meta, {
        parallelCapabilityMigration: {
          version: AiConfigService.EXTERNAL_PARALLEL_MIGRATION_VERSION,
          source,
          lastAttemptAt: checkedAt,
          completedAt: checkedAt,
          parallel: Boolean(model.toolCapabilities?.parallel),
          toolParallel: Boolean(model.validationChecks?.toolParallel),
          lastError: null,
        },
      }),
    }, providerType)
  }

  private markExternalParallelCapabilityMigrationAttempt(
    model: AiProviderModel,
    providerType: AiProviderType,
    checkedAt: number,
    source: 'settings-load' | 'runtime-selection',
    message?: string | null,
  ) {
    if (providerType === 'builtin-cloud') {
      return model
    }

    return this.normalizeModel({
      ...model,
      meta: this.mergeModelMeta(model.meta, {
        parallelCapabilityMigration: {
          version: AiConfigService.EXTERNAL_PARALLEL_MIGRATION_VERSION,
          source,
          lastAttemptAt: checkedAt,
          completedAt: null,
          lastError: this.normalizeText(message) || null,
        },
      }),
    }, providerType)
  }

  private replaceProviderModelInSettings(
    settings: AiSettings,
    providerId: string,
    nextModel: AiProviderModel,
  ) {
    return this.updateProviderInSettings(settings, providerId, provider =>
      this.replaceModelInProvider(provider, nextModel))
  }

  private replaceModelInProvider(provider: AiProviderConfig, nextModel: AiProviderModel) {
    const matches = (model: AiProviderModel) =>
      model.id === nextModel.id
      || model.model === nextModel.model

    return {
      ...provider,
      models: provider.models.map(model => matches(model) ? nextModel : model),
      availableModels: provider.availableModels?.map(model => matches(model)
        ? this.mergeModelWithDiscovered(model, nextModel, provider.type, {
            preserveManagedState: false,
          })
        : model),
      builtinManagedModels: provider.builtinManagedModels?.map(model => matches(model) ? nextModel : model),
    }
  }

  private async runModelReasoningCapabilityCheck(provider: AiProviderConfig, model: AiProviderModel): Promise<ValidationCheckResult> {
    if (provider.type === 'builtin-cloud') {
      return { ok: true, message: global.i18next.t('aiConfigService.reasoningTestPassed') }
    }

    try {
      await this.fetchProviderCompletion(provider, {
        model: model.model,
        messages: [{ role: 'user', content: 'Reply OK only.' }],
        max_tokens: 16,
        temperature: 0,
        stream: false,
        reasoning_effort: 'low',
      })
      return { ok: true, message: global.i18next.t('aiConfigService.reasoningTestPassed') }
    } catch (error) {
      return {
        ok: false,
        message: global.i18next.t('aiConfigService.reasoningTestFailed', {
          error: this.describeValidationError(error, 'reasoning'),
        }),
      }
    }
  }

  private async runModelToolAutoCheck(provider: AiProviderConfig, model: AiProviderModel): Promise<ValidationCheckResult> {
    return await this.runModelToolCheck(provider, model, 'auto')
  }

  private async runModelToolRequireAnyCheck(provider: AiProviderConfig, model: AiProviderModel): Promise<ValidationCheckResult> {
    return await this.runModelToolCheck(provider, model, 'require-any')
  }

  private async runModelToolRequireSpecificCheck(provider: AiProviderConfig, model: AiProviderModel): Promise<ValidationCheckResult> {
    return await this.runModelToolCheck(provider, model, 'require-specific')
  }

  private async runModelToolParallelCheck(provider: AiProviderConfig, model: AiProviderModel): Promise<ValidationCheckResult> {
    return await this.runModelToolCheck(provider, model, 'parallel')
  }

  private async runModelToolCheck(
    provider: AiProviderConfig,
    model: AiProviderModel,
    mode: ToolValidationMode,
  ): Promise<ValidationCheckResult> {
    const label = this.getToolValidationLabel(mode)
    try {
      const requestBody = {
        model: model.model,
        messages: [
          { role: 'system', content: 'When a tool is available and the user asks for a tool call, respond with the tool call instead of plain text.' },
          { role: 'user', content: 'Call the echo_status tool with status="ok".' },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'echo_status',
            description: 'Return a short status.',
            parameters: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                },
              },
              required: ['status'],
            },
          },
        }],
        tool_choice: this.resolveToolChoiceValue(mode),
        temperature: 0,
        max_tokens: 256,
        stream: false,
        ...(mode === 'parallel' ? { parallel_tool_calls: true } : {}),
      }

      let response = provider.type === 'builtin-cloud'
        ? await this.fetchBuiltinCompletion(requestBody)
        : await this.fetchProviderCompletion(provider, requestBody)
      if (!this.extractToolCalls(response).length && this.shouldRetryForReasoningOnlyResponse(response)) {
        const retryBody = {
          ...requestBody,
          max_tokens: 512,
        }
        response = provider.type === 'builtin-cloud'
          ? await this.fetchBuiltinCompletion(retryBody)
          : await this.fetchProviderCompletion(provider, retryBody)
      }
      const toolCalls = this.extractToolCalls(response)
      if (!this.hasExpectedEchoStatusToolCall(toolCalls)) {
        if (mode === 'parallel') {
          return { ok: false, message: global.i18next.t('aiConfigService.parallelToolCallMissing', { label }) }
        }
        return { ok: false, message: global.i18next.t('aiConfigService.toolCallMissing', { label }) }
      }
      return { ok: true, message: global.i18next.t('aiConfigService.testPassed', { label }) }
    } catch (error) {
      if (mode === 'require-any' && this.isUnsupportedRequiredToolChoiceError(error)) {
        return { ok: false, skipped: true, message: global.i18next.t('aiConfigService.requiredToolUnsupported', { label }) }
      }
      if (mode === 'require-specific' && this.isUnsupportedSpecificToolChoiceError(error)) {
        return { ok: false, skipped: true, message: global.i18next.t('aiConfigService.specificToolUnsupported', { label }) }
      }
      return {
        ok: false,
        message: global.i18next.t('aiConfigService.testFailed', {
          error: this.describeValidationError(error, mode === 'parallel' ? 'parallel' : 'tools'),
          label,
        }),
      }
    }
  }

  private getToolValidationLabel(mode: ToolValidationMode) {
    if (mode === 'auto') return global.i18next.t('aiConfigService.toolCallTest')
    if (mode === 'require-any') return global.i18next.t('aiConfigService.requiredToolCallTest')
    if (mode === 'parallel') return global.i18next.t('aiConfigService.parallelToolCallTest')
    return global.i18next.t('aiConfigService.specificToolCallTest')
  }

  private resolveToolChoiceValue(mode: ToolValidationMode) {
    if (mode === 'auto' || mode === 'parallel') return 'auto'
    if (mode === 'require-any') return 'required'
    return {
      type: 'function',
      function: {
        name: 'echo_status',
      },
    }
  }

  private shouldRetryForReasoningOnlyResponse(payload: any) {
    const text = this.extractAssistantText(payload)
    const reasoning = this.extractAssistantReasoning(payload)
    const finishReason = this.extractResponseFinishReason(payload)
    return !text.trim() && Boolean(reasoning) && finishReason === 'length'
  }

  private extractAssistantReasoning(payload: any) {
    const reasoning = payload?.choices?.[0]?.message?.reasoning
    if (typeof reasoning === 'string') return reasoning.trim()
    if (Array.isArray(reasoning)) {
      return reasoning
        .map(item => String(item?.text || item?.content || item?.reasoning || '').trim())
        .filter(Boolean)
        .join('')
    }
    return ''
  }

  private extractResponseFinishReason(payload: any) {
    return String(payload?.choices?.[0]?.finish_reason || '').trim().toLowerCase()
  }

  private isUnsupportedRequiredToolChoiceError(error: unknown) {
    const normalized = this.normalizeText(error instanceof Error ? error.message : String(error)).toLowerCase()
    return normalized.includes('tool_choice')
      || normalized.includes('does not support being set to required')
      || normalized.includes('invalidparameter')
  }

  private isUnsupportedSpecificToolChoiceError(error: unknown) {
    const normalized = this.normalizeText(error instanceof Error ? error.message : String(error)).toLowerCase()
    return normalized.includes('tool_choice')
      || normalized.includes('named tool')
      || normalized.includes('specific tool')
      || normalized.includes('invalidparameter')
  }

  private isUnsupportedParallelToolCallError(error: unknown) {
    const normalized = this.normalizeText(error instanceof Error ? error.message : String(error)).toLowerCase()
    if (
      normalized.includes('parallel_tool_calls')
      || normalized.includes('parallel tool calls')
      || normalized.includes('paralleltoolcalls')
    ) {
      return true
    }
    return (
      (normalized.includes('invalidparameter') || normalized.includes('invalid parameter') || normalized.includes('unknown parameter'))
      && normalized.includes('parallel')
    )
  }

  private async fetchProviderCompletion(provider: AiProviderConfig, body: Record<string, any>) {
    const baseUrl = this.normalizeProviderBaseUrl(provider.baseUrl, provider.type)
    if (!baseUrl) {
      throw this.createProviderBaseUrlMissingError(provider)
    }
    return await this.fetchJson(`${baseUrl}/chat/completions`, {
      method: 'POST',
      apiKey: provider.apiKey || undefined,
      timeoutMs: (provider as AiProviderValidationRuntime)[AI_MODEL_VALIDATION_TIMEOUT],
      body,
    })
  }

  private async fetchBuiltinCompletion(
    body: Record<string, any>,
    options?: { account?: AiRuntimeAccountContext | null; timeoutMs?: number },
  ) {
    const resolvedModel = String(body.model || '').trim()
    if (!resolvedModel) {
      throw new Error('Builtin completion requires an explicit resolved model.')
    }
    const runtimeConfig = this.buildBuiltinRuntimeConfig(
      {
        model: resolvedModel,
      },
      this.resolveBuiltinRuntimeAccount(options?.account),
    )
    return await this.fetchJson(`${runtimeConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      apiKey: runtimeConfig.apiKey,
      body,
      timeoutMs: options?.timeoutMs,
    })
  }

  private buildBuiltinRuntimeConfig(
    model: Pick<AiProviderModel, 'model'>,
    account: AiRuntimeAccountContext,
  ) {
    const timestamp = Math.floor(Date.now() / 1000)
    const user = this.userService.getUser()
    const accountName = this.normalizeText(account.realname) || this.normalizeText(account.user) || 'anonymous'
    const accountId = this.normalizeText(account.id) || '0'
    const sign = md5(user.key + timestamp + user.secret).toLowerCase()
    const raw = [user.key, user.secret, timestamp, accountName, accountId, sign].join('_')
    return {
      baseUrl: this.normalizeBuiltinBaseUrl(this.serverHost),
      apiKey: Buffer.from(raw, 'utf8').toString('base64'),
      model: model.model,
    }
  }

  private resolveBuiltinRuntimeAccount(account?: AiRuntimeAccountContext | null): AiRuntimeAccountContext {
    const explicitAccount = this.normalizeBuiltinRuntimeAccount(account)
    if (explicitAccount) {
      return explicitAccount
    }

    const requestAccount = this.normalizeBuiltinRuntimeAccount(RequestStorage.current?.req?.account)
    if (requestAccount) {
      return requestAccount
    }

    throw new Error(
      'Builtin runtime config requires account context. Pass options.account when resolving builtin-cloud models outside an HTTP request.',
    )
  }

  private normalizeBuiltinRuntimeAccount(account?: AiRuntimeAccountContext | null): AiRuntimeAccountContext | null {
    const accountId = this.normalizeText(account?.id)
    const accountName = this.normalizeText(account?.realname) || this.normalizeText(account?.user)
    if (!accountId && !accountName) {
      return null
    }
    return {
      id: accountId || undefined,
      realname: accountName || undefined,
    }
  }

  private normalizeBuiltinBaseUrl(baseUrl?: string | null) {
    const normalized = this.normalizeText(baseUrl).replace(/\/+$/, '')
    if (!normalized) return ''
    if (/\/ai\/v\d+$/i.test(normalized)) return normalized
    return `${normalized}/ai/v1`
  }

  private normalizeProviderBaseUrl(baseUrl?: string | null, providerType?: AiProviderType) {
    const normalized = this.normalizeText(baseUrl).replace(/\/+$/, '')
    if (!normalized || providerType === 'builtin-cloud') return ''
    if (providerType === 'ollama') return normalized
    if (/\/v\d+$/i.test(normalized)) return normalized
    if (/\/chat\/completions$/i.test(normalized)) return normalized.replace(/\/chat\/completions$/i, '')
    return `${normalized}/v1`
  }

  private stripOpenAiVersionSuffix(baseUrl?: string | null) {
    return this.normalizeText(baseUrl).replace(/\/+$/, '').replace(/\/v\d+$/i, '')
  }

  private async fetchJson(url: string, options?: { method?: string; apiKey?: string; body?: Record<string, any>; timeoutMs?: number }) {
    const headers = new Headers()
    if (options?.apiKey) headers.set('authorization', `Bearer ${options.apiKey}`)
    if (options?.body) headers.set('content-type', 'application/json')

    const timeoutMs = Number(options?.timeoutMs) > 0 ? Number(options?.timeoutMs) : 0
    const controller = timeoutMs ? new AbortController() : null
    const timeoutHandle = controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null
    try {
      const response = await globalThis.fetch(url, {
        method: options?.method || (options?.body ? 'POST' : 'GET'),
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller?.signal,
      })
      const text = await response.text()
      const normalizedText = this.normalizeJsonLikeResponseText(text)
      const payload = normalizedText ? this.tryParseJson(normalizedText) : null

      if (!response.ok) {
        throw new Error(
          this.normalizeText(payload?.error?.message)
          || this.normalizeText(payload?.message)
          || this.normalizeText(text)
          || global.i18next.t('aiConfigService.requestFailed', { status: response.status }),
        )
      }

      return payload
    } catch (error) {
      if (controller?.signal.aborted) {
        throw new Error(global.i18next.t('aiConfigService.requestTimedOut', { timeoutMs }))
      }
      throw error
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
  }

  private extractAssistantText(payload: any) {
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map(item => String(item?.text || item?.content || '').trim())
        .filter(Boolean)
        .join('')
    }
    return ''
  }

  private extractToolCalls(payload: any) {
    const toolCalls = payload?.choices?.[0]?.message?.tool_calls
    return Array.isArray(toolCalls) ? toolCalls : []
  }

  private hasExpectedEchoStatusToolCall(toolCalls: unknown[]) {
    return toolCalls.some(call => {
      if (!call || typeof call !== 'object') {
        return false
      }
      const record = call as { name?: unknown; function?: { name?: unknown } }
      const name = String(record.function?.name || record.name || '').trim()
      return name === 'echo_status'
    })
  }

  private normalizeJsonLikeResponseText(text: string) {
    const normalized = this.normalizeText(text)
    if (!normalized) return ''
    if (this.looksLikeJson(normalized)) return normalized
    if (!/^data:/mi.test(normalized)) return ''

    const dataBlocks = normalized
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .filter(line => line && line !== '[DONE]')

    if (!dataBlocks.length) return ''
    const merged = dataBlocks.join('')
    return this.looksLikeJson(merged) ? merged : ''
  }

  private parseStructuredJsonValidationResponse(text: string) {
    const normalized = this.normalizeText(text)
    if (!normalized) {
      return null
    }

    const direct = this.tryParseJson(normalized)
    if (direct && typeof direct === 'object') {
      return direct
    }

    const fencedMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(normalized)
    if (fencedMatch?.[1]) {
      const fenced = this.tryParseJson(fencedMatch[1].trim())
      if (fenced && typeof fenced === 'object') {
        return fenced
      }
    }

    const objectMatch = /\{[\s\S]*\}/.exec(normalized)
    if (objectMatch?.[0]) {
      const extracted = this.tryParseJson(objectMatch[0].trim())
      if (extracted && typeof extracted === 'object') {
        return extracted
      }
    }

    return null
  }

  private looksLikeJson(value: string) {
    return (value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))
  }

  private tryParseJson(text?: string | null) {
    try {
      return text ? JSON.parse(text) : null
    } catch {
      return null
    }
  }

  private findProvider(settings: AiSettings, providerId?: string | null) {
    const normalizedProviderId = this.normalizeText(providerId)
    if (!normalizedProviderId) return null
    return settings.providers.find(provider => provider.id === normalizedProviderId) || null
  }

  private assertProvider(settings: AiSettings, providerId?: string | null) {
    const provider = this.findProvider(settings, providerId)
    if (!provider) {
      throw new AiRuntimeUserActionableError(
        'AI_PROVIDER_NOT_FOUND',
        global.i18next.t('aiConfigService.providerNotFound', {
          provider: providerId || global.i18next.t('aiConfigService.emptyValue'),
        }),
        'selection',
      )
    }
    return provider
  }

  private assertModel(provider: AiProviderConfig, modelId?: string | null, includeAvailableModels = false) {
    const normalizedModelId = this.normalizeText(modelId)
    const model = provider.models.find(item => item.id === normalizedModelId)
      || provider.builtinManagedModels?.find(item => item.id === normalizedModelId)
      || (includeAvailableModels
        ? provider.availableModels?.find(item => item.id === normalizedModelId)
        : undefined)
    if (!model) {
      throw new AiRuntimeUserActionableError(
        'AI_MODEL_NOT_FOUND',
        global.i18next.t('aiConfigService.modelNotFound', {
          model: normalizedModelId || global.i18next.t('aiConfigService.emptyValue'),
        }),
        'selection',
      )
    }
    return model
  }

  private createProviderBaseUrlMissingError(provider: AiProviderConfig) {
    return new AiRuntimeUserActionableError(
      'AI_PROVIDER_BASE_URL_MISSING',
      global.i18next.t('aiConfigService.providerBaseUrlMissing', { provider: provider.name }),
      'configuration',
    )
  }

  private createBuiltinModelsProtocolError(detail: string) {
    return new Error(
      global.i18next.t('aiConfigService.modelsProtocolIncompatible', { detail }),
    )
  }

  private normalizeProviderType(value?: string | null, fallback: AiProviderType = 'openai-compatible'): AiProviderType {
    const normalized = this.normalizeText(value).toLowerCase()
    if (normalized === 'builtin-cloud' || normalized === 'builtin' || normalized === 'cloud') return 'builtin-cloud'
    if (normalized === 'ollama') return 'ollama'
    if (normalized === 'openai-compatible' || normalized === 'openai' || normalized === 'compatible') return 'openai-compatible'
    return fallback
  }

  private normalizeHealthStatus(value?: string | null): AiProviderHealthStatus {
    const normalized = this.normalizeText(value).toLowerCase()
    if (normalized === 'healthy' || normalized === 'unhealthy') return normalized
    return 'unknown'
  }

  private normalizeValidationStatus(value?: string | null, fallback: AiModelValidationStatus = 'unverified'): AiModelValidationStatus {
    const normalized = this.normalizeText(value).toLowerCase()
    if (normalized === 'unverified' || normalized === 'passed' || normalized === 'failed' || normalized === 'manual-disabled') {
      return normalized
    }
    return fallback
  }

  private normalizeModelSource(value?: string | null, fallback: AiProviderModel['source'] = 'manual'): AiProviderModel['source'] {
    const normalized = this.normalizeText(value).toLowerCase()
    if (normalized === 'builtin' || normalized === 'sync' || normalized === 'manual') return normalized
    return fallback
  }

  private normalizeSelection(value?: AiThreadModelSelection | null) {
    return {
      providerId: this.normalizeText(value?.providerId) || null,
      modelId: this.normalizeText(value?.modelId) || null,
      model: this.normalizeText(value?.model) || null,
    }
  }

  private mergeSelection(
    baseSelection?: AiThreadModelSelection | null,
    patchSelection?: AiThreadModelSelection | null,
    rawPatchSelection?: AiThreadModelSelection | null,
  ) {
    const normalizedBase = this.normalizeSelection(baseSelection)
    const normalizedPatch = this.normalizeSelection(patchSelection)
    return this.normalizeSelection({
      providerId: this.hasSelectionField(rawPatchSelection, 'providerId')
        ? normalizedPatch.providerId
        : normalizedBase.providerId,
      modelId: this.hasSelectionField(rawPatchSelection, 'modelId')
        ? normalizedPatch.modelId
        : normalizedBase.modelId,
      model: this.hasSelectionField(rawPatchSelection, 'model')
        ? normalizedPatch.model
        : normalizedBase.model,
    })
  }

  private hasSelectionField(selection: AiThreadModelSelection | null | undefined, key: keyof Pick<AiThreadModelSelection, 'providerId' | 'modelId' | 'model'>) {
    return Boolean(selection && Object.prototype.hasOwnProperty.call(selection, key))
  }

  private hasSelectionPatch(value?: AiThreadModelSelection | null) {
    return this.hasSelectionField(value, 'providerId')
      || this.hasSelectionField(value, 'modelId')
      || this.hasSelectionField(value, 'model')
  }

  private normalizeSelectionSource(value?: string | null): AiThreadModelSelectionSource | null {
    const normalized = this.normalizeText(value).toLowerCase()
    if (normalized === 'default' || normalized === 'explicit') {
      return normalized
    }
    return null
  }

  private resolveSelectionSource(
    selection?: AiThreadModelSelection | null,
    options?: {
      fallbackToDefaultWhenSelectionExists?: boolean
    } | null,
  ): AiThreadModelSelectionSource | null {
    const normalized = this.normalizeSelectionSource(selection?.modelSelectionSource)
    if (normalized) {
      return normalized
    }

    if (options?.fallbackToDefaultWhenSelectionExists && this.hasSelection(selection)) {
      return 'default'
    }

    return null
  }

  private hasSelection(value?: AiThreadModelSelection | null) {
    const normalized = this.normalizeSelection(value)
    return Boolean(normalized.providerId || normalized.modelId || normalized.model)
  }

  private resolveFinalSelectionSource(options: {
    currentSelectionSource?: AiThreadModelSelectionSource | null
    requestedSelectionSource?: AiThreadModelSelectionSource | null
    hasRequestedSelectionPatch: boolean
    hasRequestedSelection: boolean
  }): AiThreadModelSelectionSource {
    if (options.requestedSelectionSource === 'default') {
      return 'default'
    }
    if (options.hasRequestedSelectionPatch) {
      return options.hasRequestedSelection ? 'explicit' : 'default'
    }
    return options.currentSelectionSource === 'explicit'
      ? 'explicit'
      : 'default'
  }

  private normalizeText(value?: string | null) {
    return String(value || '').trim()
  }

  private isRemovedBuiltinModel(value?: string | null) {
    const normalized = this.normalizeText(value)
    return Boolean(normalized && AiConfigService.BUILTIN_REMOVED_MODELS.includes(normalized))
  }

  private hasRemovedBuiltinModelState(input?: Partial<AiSettings> | null) {
    const defaultProviderId = this.normalizeText(input?.defaultProviderId)
    const defaultModelId = this.normalizeText(input?.defaultModelId)
    if (defaultProviderId === AiConfigService.BUILTIN_PROVIDER_ID && this.isRemovedBuiltinModel(defaultModelId)) {
      return true
    }

    const providers = Array.isArray(input?.providers) ? input.providers : []
    return providers.some(provider => {
      const providerType = this.normalizeProviderType(
        provider?.type,
        this.normalizeText(provider?.id) === AiConfigService.BUILTIN_PROVIDER_ID ? 'builtin-cloud' : 'openai-compatible',
      )
      if (providerType !== 'builtin-cloud') {
        return false
      }

      const models = [
        ...(Array.isArray(provider?.models) ? provider.models : []),
        ...(Array.isArray(provider?.availableModels) ? provider.availableModels : []),
      ]
      return models.some(model =>
        this.isRemovedBuiltinModel(String(model?.id || '').trim())
        || this.isRemovedBuiltinModel(String(model?.model || '').trim()),
      )
    })
  }

  private normalizeReasoningLevel(value?: string | null) {
    const normalized = this.normalizeText(value).toLowerCase()
    return normalized === 'low' || normalized === 'medium' || normalized === 'high'
      ? normalized as AiReasoningLevel
      : undefined
  }

  private normalizeRuntimePurpose(value?: string | null): AiRuntimePurpose {
    const normalized = this.normalizeText(value)
    if (normalized === 'ai-semantic-warmup') {
      return 'ai-semantic-warmup'
    }
    return 'interactive-default'
  }

  private normalizeTimestamp(value?: number | null) {
    const normalized = Number(value || 0)
    if (!Number.isFinite(normalized) || normalized <= 0) return 0
    return Math.round(normalized)
  }

  private normalizeOptionalNumber(value?: number | null) {
    const normalized = Number(value)
    return Number.isFinite(normalized) && normalized > 0 ? Math.round(normalized) : null
  }

  private extractOpenAiCompatibleContextWindow(payload: any) {
    return this.pickFirstPositiveNumber(payload, [
      'context_window',
      'contextWindow',
      'context_length',
      'contextLength',
      'max_context_tokens',
      'maxContextTokens',
      'max_input_tokens',
      'maxInputTokens',
      'input_token_limit',
      'inputTokenLimit',
      'max_model_len',
      'maxModelLen',
      'limits.context_window',
      'limits.contextWindow',
      'limits.context_length',
      'limits.contextLength',
      'limits.max_context_tokens',
      'limits.maxContextTokens',
      'limits.max_input_tokens',
      'limits.maxInputTokens',
      'limits.input_token_limit',
      'limits.inputTokenLimit',
      'limits.max_model_len',
      'limits.maxModelLen',
      'capabilities.context_window',
      'capabilities.contextWindow',
      'capabilities.context_length',
      'capabilities.contextLength',
      'capabilities.max_context_tokens',
      'capabilities.maxContextTokens',
      'capabilities.max_input_tokens',
      'capabilities.maxInputTokens',
      'capabilities.input_token_limit',
      'capabilities.inputTokenLimit',
      'capabilities.max_model_len',
      'capabilities.maxModelLen',
    ])
  }

  private extractOllamaContextWindow(payload: any) {
    const directValue = this.pickFirstPositiveNumber(payload, [
      'context_window',
      'contextWindow',
      'context_length',
      'contextLength',
    ])
    if (directValue) return directValue

    const modelInfo = this.normalizeRecord(payload?.model_info)
    if (!modelInfo) return null

    for (const [key, value] of Object.entries(modelInfo)) {
      if (!/(^|\.)(context_length|contextwindow|context_window|contextlength)$/i.test(key)) {
        continue
      }
      const normalizedValue = this.normalizeOptionalNumber(value as number | null)
      if (normalizedValue) return normalizedValue
    }

    return null
  }

  private pickFirstPositiveNumber(payload: any, paths: string[]) {
    for (const path of paths) {
      const normalizedValue = this.normalizeOptionalNumber(this.readObjectPath(payload, path))
      if (normalizedValue) {
        return normalizedValue
      }
    }
    return null
  }

  private readObjectPath(payload: any, path: string) {
    return path
      .split('.')
      .reduce((current, segment) => (current && typeof current === 'object') ? current[segment] : undefined, payload)
  }

  private normalizeRecord(value: any) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  }

  private buildValidationSummaryMessage(results: {
    connection: ValidationCheckResult
    generation: ValidationCheckResult
    structuredJson?: ValidationCheckResult
    toolAuto: ValidationCheckResult
    toolParallel: ValidationCheckResult
  }) {
    return [
      this.normalizeText(results.connection.message),
      this.normalizeText(results.generation.message),
      this.normalizeText(results.structuredJson?.message),
      this.normalizeText(results.toolAuto.message),
      this.normalizeText(results.toolParallel.message),
    ]
      .filter(Boolean)
      .filter((message, index, list) => list.indexOf(message) === index)
      .join(global.i18next.t('aiConfigService.sectionSeparator'))
  }

  private describeValidationError(error: unknown, stage: 'connection' | 'generation' | 'tools' | 'parallel' | 'reasoning') {
    const rawMessage = this.normalizeText(error instanceof Error ? error.message : String(error))
    const normalized = rawMessage.toLowerCase()

    if (
      normalized.includes('insufficient points')
      || normalized.includes('user_overdue')
      || normalized.includes('insufficient balance')
      || normalized.includes('积分余额不足')
      || normalized.includes('余额不足')
    ) {
      return global.i18next.t('aiConfigService.insufficientBalance')
    }

    if (stage === 'tools') {
      if (normalized.includes('does not support being set to required')) {
        return global.i18next.t('aiConfigService.requiredToolUnsupportedByModel')
      }
      if (normalized.includes('tool_choice') || normalized.includes('tool_calls') || normalized.includes('invalidparameter')) {
        return global.i18next.t('aiConfigService.toolParametersUnsupported')
      }
    }
    if (stage === 'parallel' && this.isUnsupportedParallelToolCallError(error)) {
      return global.i18next.t('aiConfigService.parallelToolCallsUnsupported')
    }

    if (normalized.includes('unauthorized') || normalized.includes('invalid api key') || normalized.includes('incorrect api key')) {
      return global.i18next.t('aiConfigService.authenticationFailed')
    }
    if (normalized.includes('forbidden')) {
      return global.i18next.t('aiConfigService.accessDenied')
    }
    if (normalized.includes('timed out') || normalized.includes('timeout')) {
      return global.i18next.t('aiConfigService.requestTimeout')
    }
    if (normalized.includes('connection refused') || normalized.includes('fetch failed') || normalized.includes('econnrefused')) {
      return stage === 'connection'
        ? global.i18next.t('aiConfigService.modelServiceConnectionFailed')
        : global.i18next.t('aiConfigService.modelServiceRequestFailed')
    }
    if (normalized.includes('not found') || normalized.includes('404')) {
      return global.i18next.t('aiConfigService.modelOrEndpointNotFound')
    }
    if (stage === 'tools') {
      return global.i18next.t('aiConfigService.toolCallTestFailed')
    }
    if (stage === 'parallel') {
      return global.i18next.t('aiConfigService.parallelToolTestFailed')
    }
    if (stage === 'generation') {
      return global.i18next.t('aiConfigService.generationFailed')
    }
    if (stage === 'reasoning') {
      return global.i18next.t('aiConfigService.reasoningValidationFailed')
    }
    return global.i18next.t('aiConfigService.connectionError')
  }

  private getHealthCheckErrorMessage(error: unknown) {
    const message = this.normalizeText(error instanceof Error ? error.message : String(error))
    return message || global.i18next.t('aiConfigService.connectionError')
  }
}
