import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { unique } from '@common/utils/unique'
import type { AiDefaultModelSelections, AiProviderConfig, AiProviderModel, AiSettings } from '@common/types/ai-provider'
import { FIXED_BANBAN_AI_PROVIDERS, isFixedBanbanAiProviderId } from '@common/utils/aiProvider'
import {
  AiConfigEntity,
  AiProviderCredentialEntity,
  AiProviderEntity,
  AiProviderModelEntity,
} from '../entities'
import { AiProviderCredentialStore } from './ai-provider-credential.store'

export type AiConfigSnapshotOptions = {
  platformAccountId?: string | null
  includeSecrets?: boolean
  includePersistedBuiltinManagedModels?: boolean
}

@Injectable()
export class AiConfigStore {
  private initialization: Promise<void> | null = null

  constructor(
    private readonly entityManager: EntityManager,
    private readonly credentialStore: AiProviderCredentialStore,
  ) {}

  async ensureInitialized() {
    if (!this.initialization) {
      this.initialization = this.withTransaction(async em => {
        await this.ensureConfig(em)
        await this.ensureFixedBanbanAiProviders(em)
      }).catch(error => {
        this.initialization = null
        throw error
      })
    }
    await this.initialization
  }

  async ensureConfig(em: EntityManager = this.entityManager.fork()) {
    let config = await em.findOne(AiConfigEntity, { id: 'default' })
    if (!config) {
      config = new AiConfigEntity()
      await em.persistAndFlush(config)
    }
    return config
  }

  async ensureFixedBanbanAiProviders(em: EntityManager = this.entityManager.fork()) {
    for (const definition of FIXED_BANBAN_AI_PROVIDERS) {
      let provider = await em.findOne(AiProviderEntity, { id: definition.id })
      if (!provider) {
        provider = new AiProviderEntity()
        provider.id = definition.id
        provider.enabled = true
        em.persist(provider)
      }
      provider.name = definition.name
      provider.type = 'builtin-cloud'
      provider.managementMode = 'fixed'
      provider.presetKey = definition.presetKey
      provider.requiresPlatformLogin = true
      if (!provider.createTime) provider.createTime = Date.now()
      if (provider.sortOrder === null || provider.sortOrder === undefined) provider.sortOrder = definition.sortOrder
      provider.updateTime = Date.now()
    }
    await em.flush()
  }

  async loadSnapshot(options: AiConfigSnapshotOptions = {}): Promise<AiSettings> {
    await this.ensureInitialized()
    const em = this.entityManager.fork()
    const config = await this.ensureConfig(em)
    const providers = await em.find(AiProviderEntity, {}, { orderBy: { sortOrder: 'ASC', createTime: 'ASC' } })
    const models = await em.find(AiProviderModelEntity, {}, {
      populate: ['provider'],
      orderBy: { sortOrder: 'ASC', createTime: 'ASC' },
    })
    const credentials = await em.find(AiProviderCredentialEntity, {}, {
      populate: ['provider'],
      orderBy: { sortOrder: 'ASC', createTime: 'ASC' },
    })
    const modelsByProvider = this.groupByProvider(models)
    const credentialsByProvider = this.groupByProvider(credentials)
    const platformAccountId = String(options.platformAccountId || '').trim() || null

    return {
      enabled: config.enabled,
      autoTaskEnabled: config.autoTaskEnabled,
      allowModelSelection: config.allowModelSelection,
      defaultSelections: this.clone(config.defaultSelections) || { fast: null, balanced: null, deep: null },
      featureFlags: this.clone(config.featureFlags),
      migrations: this.clone(config.migrations),
      providers: providers.map(provider => {
        const providerModels = modelsByProvider.get(provider.id) || []
        const accountMatches = !provider.requiresPlatformLogin
          || Boolean(platformAccountId && provider.lastSyncedAccountId === platformAccountId)
        const availableModels = accountMatches
          ? providerModels.filter(model => model.available).map(model => this.toModel(model))
          : []
        const visibleModels = provider.type === 'builtin-cloud'
          ? (accountMatches
            ? availableModels
            : (options.includePersistedBuiltinManagedModels
              ? providerModels.filter(model => model.enabled).map(model => this.toModel(model))
              : []))
          : (accountMatches
            ? providerModels.filter(model => model.source === 'manual').map(model => this.toModel(model))
            : [])
        const credentialEntities = credentialsByProvider.get(provider.id) || []
        const summaries = credentialEntities.map(credential => {
          let masked = '********'
          try {
            masked = this.maskCredential(this.credentialStore.decrypt(credential.encryptedValue))
          } catch {
            // Keep public configuration readable; runtime access still reports the credential error.
          }
          return {
            id: credential.id,
            label: credential.label,
            enabled: credential.enabled,
            masked,
            lastUsedAt: credential.lastUsedAt,
          }
        })
        const credential = credentialEntities.find(item => item.enabled)
        const apiKey = options.includeSecrets
          ? this.decryptFirstEnabledCredential(credentialEntities)
          : (credential?.encryptedValue || null)
        return this.toProvider(provider, visibleModels, summaries, apiKey, credential?.encryptedValue || null, availableModels)
      }),
    }
  }

  async saveGlobalConfig(patch: Partial<Pick<AiSettings,
    'enabled' | 'autoTaskEnabled' | 'allowModelSelection' | 'defaultSelections' | 'featureFlags' | 'migrations'
  >>) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      const config = await this.ensureConfig(em)
      for (const key of ['enabled', 'autoTaskEnabled', 'allowModelSelection', 'defaultSelections', 'featureFlags', 'migrations'] as const) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) {
          ;(config as any)[key] = this.clone((patch as any)[key])
        }
      }
      config.updateTime = Date.now()
      await em.flush()
    })
  }

  async createProvider(provider: AiProviderConfig) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      const id = String(provider.id || '').trim() || unique(20)
      if (await em.findOne(AiProviderEntity, { id })) this.throwCode('AI_PROVIDER_ID_CONFLICT')
      if (isFixedBanbanAiProviderId(id) || provider.type === 'builtin-cloud') this.throwCode('AI_FIXED_PROVIDER_IMMUTABLE')
      const entity = this.createProviderEntity({ ...provider, id })
      em.persist(entity)
      if (provider.apiKey) await this.credentialStore.replaceLegacyValue(entity, provider.apiKey, em)
      await this.upsertModelRows(entity, provider.models || [], em, { deleteMissing: false })
      await em.flush()
      return id
    })
  }

  async updateProvider(
    providerId: string,
    patch: Partial<AiProviderConfig> & {
      addApiKeys?: Array<{ value: string; label?: string | null }>
    },
  ) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      const provider = await this.requireProvider(providerId, em)
      this.assertProviderPatchMutable(provider, patch)
      for (const key of ['name', 'type', 'enabled', 'baseUrl', 'defaultModelId'] as const) {
        if (Object.prototype.hasOwnProperty.call(patch, key)) (provider as any)[key] = (patch as any)[key]
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'apiKey')) {
        await this.credentialStore.replaceLegacyValue(provider, patch.apiKey || '', em)
      }
      if (patch.addApiKeys?.length) await this.credentialStore.add(provider, patch.addApiKeys, em)
      provider.updateTime = Date.now()
      await em.flush()
    })
  }

  async deleteProvider(providerId: string) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      const provider = await this.requireProvider(providerId, em)
      if (provider.managementMode === 'fixed') this.throwCode('AI_FIXED_PROVIDER_IMMUTABLE')
      const config = await this.ensureConfig(em)
      if (this.isProviderInDefaults(config.defaultSelections, providerId)) this.throwCode('AI_MODEL_IN_USE_AS_DEFAULT')
      await em.removeAndFlush(provider)
    })
  }

  async createModel(providerId: string, model: AiProviderModel) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      const provider = await this.requireProvider(providerId, em)
      if (await em.findOne(AiProviderModelEntity, { provider, modelId: model.id })) this.throwCode('AI_MODEL_ID_CONFLICT')
      const entity = this.createModelEntity(provider, model)
      const existing = await em.find(AiProviderModelEntity, { provider })
      entity.sortOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1
      em.persist(entity)
      await em.flush()
    })
  }

  async updateModel(providerId: string, modelId: string, patch: Partial<AiProviderModel>) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      const model = await this.requireModel(providerId, modelId, em)
      if (patch.enabled === false) {
        const config = await this.ensureConfig(em)
        if (this.isModelInDefaults(config.defaultSelections, providerId, modelId)) this.throwCode('AI_MODEL_IN_USE_AS_DEFAULT')
      }
      this.assignModel(model, { ...this.toModel(model), ...patch, id: modelId })
      model.updateTime = Date.now()
      await em.flush()
    })
  }

  async deleteModel(providerId: string, modelId: string) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      const model = await this.requireModel(providerId, modelId, em)
      const config = await this.ensureConfig(em)
      if (this.isModelInDefaults(config.defaultSelections, providerId, modelId)) this.throwCode('AI_MODEL_IN_USE_AS_DEFAULT')
      await em.removeAndFlush(model)
    })
  }

  async saveProviderSnapshot(providerConfig: AiProviderConfig) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      let provider = await em.findOne(AiProviderEntity, { id: providerConfig.id })
      if (!provider) {
        provider = this.createProviderEntity(providerConfig)
        em.persist(provider)
      } else {
        this.assignProviderRuntime(provider, providerConfig)
      }
      if (providerConfig.apiKey) await this.credentialStore.replaceLegacyValue(provider, providerConfig.apiKey, em)
      const models = this.collectProviderModels(providerConfig)
      await this.upsertModelRows(provider, models, em, { deleteMissing: false })
      const discoveredIds = new Set<string>()
      for (const model of providerConfig.availableModels || []) {
        for (const value of [
          model.id,
          model.model,
          model.meta?.builtin?.apiModelId,
        ]) {
          const normalized = String(value || '').trim()
          if (normalized) discoveredIds.add(normalized)
        }
      }
      const existingModels = await em.find(AiProviderModelEntity, { provider })
      existingModels.forEach(model => {
        const modelIdentityValues = [
          model.modelId,
          model.model,
          model.meta?.builtin?.apiModelId,
        ].map(value => String(value || '').trim())
        if (model.source !== 'manual' && !modelIdentityValues.some(value => discoveredIds.has(value))) {
          model.available = false
          model.updateTime = Date.now()
        }
      })
      await em.flush()
    })
  }

  async replaceSettings(settings: AiSettings) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      const config = await this.ensureConfig(em)
      config.enabled = settings.enabled !== false
      config.autoTaskEnabled = settings.autoTaskEnabled === true
      config.allowModelSelection = settings.allowModelSelection !== false
      config.defaultSelections = this.clone(settings.defaultSelections) || { fast: null, balanced: null, deep: null }
      config.featureFlags = this.clone(settings.featureFlags)
      config.migrations = this.clone(settings.migrations)
      config.updateTime = Date.now()

      const incomingIds = new Set<string>()
      for (const providerConfig of settings.providers || []) {
        incomingIds.add(providerConfig.id)
        let provider = await em.findOne(AiProviderEntity, { id: providerConfig.id })
        if (!provider) {
          provider = this.createProviderEntity(providerConfig)
          em.persist(provider)
        } else {
          this.assignProviderRuntime(provider, providerConfig)
        }
        if (providerConfig.apiKey) await this.credentialStore.replaceLegacyValue(provider, providerConfig.apiKey, em)
        await this.upsertModelRows(provider, this.collectProviderModels(providerConfig), em, {
          deleteMissing: provider.managementMode !== 'fixed' && provider.type !== 'builtin-cloud',
        })
      }
      const customProviders = await em.find(AiProviderEntity, { managementMode: 'custom' })
      for (const provider of customProviders) {
        if (!incomingIds.has(provider.id)) em.remove(provider)
      }
      await em.flush()
    })
  }

  async markFixedProviderSync(providerId: string, accountId: string, models: AiProviderModel[]) {
    await this.ensureInitialized()
    return this.withTransaction(async em => {
      const provider = await this.requireProvider(providerId, em)
      if (provider.managementMode !== 'fixed') this.throwCode('AI_FIXED_PROVIDER_PROTOCOL_INVALID')
      const discoveredIds = new Set(models.map(model => this.getModelIdentity(model, true)))
      const existing = await em.find(AiProviderModelEntity, { provider })
      for (const model of existing) {
        if (model.source !== 'manual' && !discoveredIds.has(this.getModelIdentity(model, true))) model.available = false
      }
      await this.upsertModelRows(provider, models.map(model => ({ ...model, available: true })), em, {
        deleteMissing: false,
        preserveUserFields: true,
      })
      provider.lastSyncedAccountId = accountId
      provider.lastModelsSyncedAt = Date.now()
      provider.updateTime = Date.now()
      await em.flush()
    })
  }

  async withTransaction<T>(callback: (em: EntityManager) => Promise<T>): Promise<T> {
    const em = this.entityManager.fork()
    return em.transactional(callback)
  }

  private createProviderEntity(provider: AiProviderConfig) {
    const entity = new AiProviderEntity()
    entity.id = provider.id || unique(20)
    entity.managementMode = isFixedBanbanAiProviderId(entity.id) ? 'fixed' : 'custom'
    this.assignProviderRuntime(entity, provider)
    if (entity.managementMode === 'fixed') {
      const definition = FIXED_BANBAN_AI_PROVIDERS.find(item => item.id === entity.id)
      entity.name = definition.name
      entity.type = 'builtin-cloud'
      entity.presetKey = definition.presetKey
      entity.requiresPlatformLogin = true
      entity.sortOrder = definition.sortOrder
    }
    return entity
  }

  private assignProviderRuntime(entity: AiProviderEntity, provider: AiProviderConfig) {
    if (entity.managementMode !== 'fixed') {
      entity.name = String(provider.name || '').trim()
      entity.type = provider.type
      entity.baseUrl = provider.baseUrl || null
    }
    entity.enabled = provider.enabled !== false
    entity.defaultModelId = provider.defaultModelId || null
    entity.health = {
      checkedAt: provider.lastHealthCheckAt || null,
      status: provider.lastHealthStatus || 'unknown',
      message: provider.lastHealthMessage || null,
    }
    entity.builtinRuntime = provider.type === 'builtin-cloud' ? {
      status: provider.builtinRouteStatus || 'unknown',
      checkedAt: provider.builtinRouteCheckedAt || null,
      message: provider.builtinRouteMessage || null,
      effectiveModel: provider.builtinEffectiveModel || null,
      capabilities: this.clone(provider.builtinCapabilities),
      checks: this.clone(provider.builtinChecks),
    } : null
    if (provider.lastSyncedAccountId !== undefined) entity.lastSyncedAccountId = provider.lastSyncedAccountId || null
    entity.lastModelsSyncedAt = provider.builtinModelsSyncedAt || entity.lastModelsSyncedAt || null
    entity.updateTime = Date.now()
  }

  private async upsertModelRows(
    provider: AiProviderEntity,
    models: AiProviderModel[],
    em: EntityManager,
    options: { deleteMissing: boolean; preserveUserFields?: boolean },
  ) {
    const existing = await em.find(AiProviderModelEntity, { provider })
    const existingById = new Map(existing.map(model => [model.modelId, model]))
    const incomingIds = new Set<string>()
    // 行顺序跟随传入列表：同步时传入的是服务端目录顺序，管理页直接沿用，不做本地排序。
    let nextSortOrder = 0
    for (const input of models) {
      const modelId = String(input.id || '').trim()
      if (!modelId || incomingIds.has(modelId)) continue
      incomingIds.add(modelId)
      const entity = existingById.get(modelId) || this.createModelEntity(provider, input)
      if (!existingById.has(modelId)) em.persist(entity)
      const userFields = options.preserveUserFields && existingById.has(modelId)
        ? {
          enabled: entity.enabled,
          allowInWorkbenchAgent: entity.allowInWorkbenchAgent,
          remark: entity.remark,
        }
        : null
      this.assignModel(entity, input)
      if (userFields) {
        Object.assign(entity, userFields)
      } else {
        entity.sortOrder = nextSortOrder
      }
      nextSortOrder += 1
      entity.available = input.available !== false
      entity.updateTime = Date.now()
    }
    const untouched = existing
      .filter(entity => !incomingIds.has(entity.modelId))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.createTime - right.createTime)
    if (options.deleteMissing) {
      untouched.forEach(entity => em.remove(entity))
      return
    }
    // 未出现在传入列表里的旧行顺延到末尾，保持它们原有的相对顺序。
    untouched.forEach(entity => {
      entity.sortOrder = nextSortOrder
      nextSortOrder += 1
      entity.updateTime = Date.now()
    })
  }

  private createModelEntity(provider: AiProviderEntity, model: AiProviderModel) {
    const entity = new AiProviderModelEntity()
    entity.provider = provider
    this.assignModel(entity, model)
    return entity
  }

  private assignModel(entity: AiProviderModelEntity, model: AiProviderModel) {
    entity.modelId = String(model.id || '').trim()
    entity.model = String(model.model || model.id || '').trim()
    entity.displayName = String(model.displayName || model.model || model.id || '').trim()
    entity.tier = model.tier || null
    entity.enabled = model.enabled !== false
    entity.available = model.available !== false
    entity.allowInWorkbenchAgent = model.allowInWorkbenchAgent !== false
    entity.supportsTools = Boolean(model.supportsTools)
    entity.toolCapabilities = this.clone(model.toolCapabilities)
    entity.capabilities = this.clone(model.capabilities) || []
    entity.inputModalities = this.clone(model.inputModalities) || []
    entity.outputModalities = this.clone(model.outputModalities) || []
    entity.endpointTypes = this.clone(model.endpointTypes) || []
    entity.limits = {
      maxInputTokens: model.maxInputTokens ?? null,
      maxOutputTokens: model.maxOutputTokens ?? null,
      contextWindow: model.contextWindow ?? null,
      supportsStreaming: model.supportsStreaming !== false,
    }
    entity.source = model.source || 'manual'
    entity.validationStatus = model.validationStatus || 'unverified'
    entity.validation = {
      message: model.validationMessage || null,
      checks: this.clone(model.validationChecks),
      checkedAt: model.lastValidatedAt || null,
    }
    entity.meta = this.clone(model.meta)
    entity.remark = model.remark || null
  }

  private toProvider(
    provider: AiProviderEntity,
    models: AiProviderModel[],
    credentials: any[],
    apiKey: string | null,
    apiKeyEncrypted: string | null,
    availableModels: AiProviderModel[],
  ): AiProviderConfig {
    const health = provider.health || {}
    const runtime = provider.builtinRuntime || {}
    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      managementMode: provider.managementMode,
      presetKey: provider.presetKey,
      requiresPlatformLogin: provider.requiresPlatformLogin,
      lastSyncedAccountId: provider.lastSyncedAccountId,
      enabled: provider.enabled,
      baseUrl: provider.baseUrl,
      apiKey,
      apiKeyEncrypted,
      credentials,
      defaultModelId: provider.defaultModelId,
      models,
      availableModels,
      builtinManagedModels: provider.type === 'builtin-cloud' ? models.filter(model => model.enabled) : undefined,
      lastHealthCheckAt: health.checkedAt || null,
      lastHealthStatus: health.status || 'unknown',
      lastHealthMessage: health.message || null,
      builtinRouteStatus: runtime.status || 'unknown',
      builtinRouteCheckedAt: runtime.checkedAt || null,
      builtinRouteMessage: runtime.message || null,
      builtinEffectiveModel: runtime.effectiveModel || null,
      builtinModelsSyncedAt: provider.lastModelsSyncedAt,
      builtinCapabilities: this.clone(runtime.capabilities),
      builtinChecks: this.clone(runtime.checks),
    }
  }

  private toModel(entity: AiProviderModelEntity): AiProviderModel {
    return {
      id: entity.modelId,
      model: entity.model,
      displayName: entity.displayName,
      tier: entity.tier,
      enabled: entity.enabled,
      available: entity.available,
      allowInWorkbenchAgent: entity.allowInWorkbenchAgent,
      supportsTools: entity.supportsTools,
      toolCapabilities: this.clone(entity.toolCapabilities),
      capabilities: this.clone(entity.capabilities) || [],
      inputModalities: this.clone(entity.inputModalities) || [],
      outputModalities: this.clone(entity.outputModalities) || [],
      endpointTypes: this.clone(entity.endpointTypes) || [],
      maxInputTokens: entity.limits?.maxInputTokens ?? null,
      maxOutputTokens: entity.limits?.maxOutputTokens ?? null,
      contextWindow: entity.limits?.contextWindow ?? null,
      supportsStreaming: entity.limits?.supportsStreaming !== false,
      source: entity.source,
      validationStatus: entity.validationStatus,
      validationMessage: entity.validation?.message || null,
      validationChecks: this.clone(entity.validation?.checks),
      lastValidatedAt: entity.validation?.checkedAt || null,
      remark: entity.remark,
      meta: this.clone(entity.meta),
    }
  }

  private collectProviderModels(provider: AiProviderConfig) {
    const models = [...(provider.availableModels || []), ...(provider.models || []), ...(provider.builtinManagedModels || [])]
    const byId = new Map<string, AiProviderModel>()
    for (const model of models) {
      const identity = this.getModelIdentity(model, provider.type === 'builtin-cloud')
      if (identity) byId.set(identity, { ...(byId.get(identity) || {} as AiProviderModel), ...model })
    }
    return [...byId.values()]
  }

  private getModelIdentity(model: Pick<AiProviderModel, 'id' | 'model' | 'meta'> | AiProviderModelEntity, builtin = false) {
    const apiModelId = builtin && (model as AiProviderModel).meta?.builtin?.apiModelId
    return String(apiModelId || (builtin ? model.model : model.id) || '').trim()
  }

  private async requireProvider(providerId: string, em: EntityManager) {
    const provider = await em.findOne(AiProviderEntity, { id: providerId })
    if (!provider) this.throwCode('AI_PROVIDER_NOT_FOUND')
    return provider
  }

  private async requireModel(providerId: string, modelId: string, em: EntityManager) {
    const model = await em.findOne(AiProviderModelEntity, { provider: providerId, modelId })
    if (!model) this.throwCode('AI_MODEL_NOT_FOUND')
    return model
  }

  private assertProviderPatchMutable(provider: AiProviderEntity, patch: Partial<AiProviderConfig>) {
    if (provider.managementMode !== 'fixed') return
    const protectedFields = ['name', 'type', 'baseUrl', 'apiKey']
    if (protectedFields.some(key => Object.prototype.hasOwnProperty.call(patch, key))) {
      this.throwCode('AI_FIXED_PROVIDER_IMMUTABLE')
    }
  }

  private isProviderInDefaults(defaults: AiDefaultModelSelections, providerId: string) {
    return Object.values(defaults || {}).some(selection => selection?.providerId === providerId)
  }

  private isModelInDefaults(defaults: AiDefaultModelSelections, providerId: string, modelId: string) {
    return Object.values(defaults || {}).some(selection => selection?.providerId === providerId && selection?.modelId === modelId)
  }

  private groupByProvider<T extends { provider: AiProviderEntity }>(entities: T[]) {
    const result = new Map<string, T[]>()
    for (const entity of entities) {
      const providerId = typeof entity.provider === 'string' ? entity.provider : entity.provider.id
      result.set(providerId, [...(result.get(providerId) || []), entity])
    }
    return result
  }

  private decryptFirstEnabledCredential(credentials: AiProviderCredentialEntity[]) {
    const credential = credentials.find(item => item.enabled)
    return credential ? this.credentialStore.decrypt(credential.encryptedValue) : null
  }

  private maskCredential(_value: string) {
    return '********'
  }

  private clone<T>(value: T): T {
    return value === undefined || value === null ? value : JSON.parse(JSON.stringify(value))
  }

  private throwCode(code: string): never {
    const error = new Error(code) as Error & { code: string }
    error.code = code
    throw error
  }
}
