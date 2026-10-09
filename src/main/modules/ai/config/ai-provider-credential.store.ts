import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { AiProviderCredentialSummary } from '@common/types/ai-provider'
import { AiProviderCredentialEntity, AiProviderEntity } from '../entities'

const CREDENTIAL_CIPHER_VERSION = 'v1'
const CREDENTIAL_KEY = createHash('sha256')
  .update('banban:ai-provider-credential:v1')
  .digest()

@Injectable()
export class AiProviderCredentialStore {
  constructor(private readonly entityManager: EntityManager) {}

  encrypt(value: string) {
    const normalized = String(value || '').trim()
    if (!normalized) this.throwInvalidCredential()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', CREDENTIAL_KEY, iv)
    const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return [CREDENTIAL_CIPHER_VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':')
  }

  decrypt(encryptedValue: string) {
    try {
      const [version, iv, tag, encrypted] = String(encryptedValue || '').split(':')
      if (version !== CREDENTIAL_CIPHER_VERSION || !iv || !tag || !encrypted) {
        this.throwInvalidCredential()
      }
      const decipher = createDecipheriv('aes-256-gcm', CREDENTIAL_KEY, Buffer.from(iv, 'base64'))
      decipher.setAuthTag(Buffer.from(tag, 'base64'))
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64')),
        decipher.final(),
      ]).toString('utf8')
    } catch (error) {
      if ((error as any)?.code === 'AI_PROVIDER_CREDENTIAL_INVALID') throw error
      this.throwInvalidCredential()
    }
  }

  async list(providerId: string, em: EntityManager = this.entityManager.fork()): Promise<AiProviderCredentialSummary[]> {
    const credentials = await em.find(AiProviderCredentialEntity, { provider: providerId }, {
      orderBy: { sortOrder: 'ASC', createTime: 'ASC' },
    })
    return credentials.map(credential => this.toSummary(credential))
  }

  async getEnabledValues(providerId: string, em: EntityManager = this.entityManager.fork()) {
    const credentials = await em.find(AiProviderCredentialEntity, {
      provider: providerId,
      enabled: true,
    }, {
      orderBy: { sortOrder: 'ASC', createTime: 'ASC' },
    })
    return credentials.map(credential => this.decrypt(credential.encryptedValue))
  }

  async getPreferredValue(providerId: string, em?: EntityManager) {
    return (await this.getEnabledValues(providerId, em))[0] || null
  }

  async add(
    provider: AiProviderEntity,
    values: Array<{ value: string; label?: string | null }>,
    em: EntityManager,
  ) {
    const normalized = values
      .map(item => ({ value: String(item?.value || '').trim(), label: String(item?.label || '').trim() || null }))
      .filter(item => item.value)
    if (!normalized.length) return
    const existingCount = await em.count(AiProviderCredentialEntity, { provider })
    normalized.forEach((item, index) => {
      const credential = new AiProviderCredentialEntity()
      credential.provider = provider
      credential.encryptedValue = this.encrypt(item.value)
      credential.label = item.label
      credential.sortOrder = existingCount + index
      em.persist(credential)
    })
  }

  async replaceLegacyValue(provider: AiProviderEntity, value: string, em: EntityManager) {
    const normalized = String(value || '').trim()
    await em.nativeDelete(AiProviderCredentialEntity, { provider })
    if (!normalized) return
    await this.add(provider, normalized.split(/[,，]/).map(item => ({ value: item })), em)
  }

  private toSummary(credential: AiProviderCredentialEntity): AiProviderCredentialSummary {
    const value = this.decrypt(credential.encryptedValue)
    return {
      id: credential.id,
      label: credential.label,
      enabled: credential.enabled,
      masked: this.mask(value),
      lastUsedAt: credential.lastUsedAt,
    }
  }

  private mask(_value: string) {
    return '********'
  }

  private throwInvalidCredential(): never {
    const error = new Error('AI provider credential is invalid') as Error & { code: string }
    error.code = 'AI_PROVIDER_CREDENTIAL_INVALID'
    throw error
  }
}
