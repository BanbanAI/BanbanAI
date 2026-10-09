import {
  mergeNocodeEditorRelationContexts,
  type NocodeEditorRelationContext,
} from '@common/utils/nocodeEditorRelationContext'
import { Inject, Injectable } from '@nestjs/common'
import { NOCODES_DIR } from '@main/constants'
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { resolveNocodeEditorAppPath } from './nocode-editor-app-id.util'

const RELATION_CONTEXT_RENAME_RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const RELATION_CONTEXT_RENAME_RETRY_DELAYS = [20, 50, 100, 200]

@Injectable()
export class NocodeEditorRelationContextStoreService {
  constructor(
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
  ) {}

  async readContext(nocodeId: string) {
    const raw = await this.readJson<unknown>(this.getContextPath(nocodeId))
    return this.normalizePersistedContext(raw)
  }

  async upsertContext(nocodeId: string, context: NocodeEditorRelationContext) {
    const nextContext = this.normalizeIncomingContext(context)
    const current = await this.readContext(nocodeId)

    if (
      current?.fingerprint?.relationHash
      && current.fingerprint.relationHash === nextContext.fingerprint.relationHash
    ) {
      return {
        changed: false,
        context: current,
      }
    }

    const now = Date.now()
    const persistedContext: NocodeEditorRelationContext = {
      ...nextContext,
      generatedAt: Number(nextContext.generatedAt || current?.generatedAt || now) || now,
      updatedAt: now,
    }

    await this.writeJson(this.getContextPath(nocodeId), persistedContext)
    return {
      changed: true,
      context: persistedContext,
    }
  }

  private getContextPath(nocodeId: string) {
    return resolveNocodeEditorAppPath(
      this.nocodesDir,
      nocodeId,
      'ai',
      'relation-context.json',
    )
  }

  private normalizeIncomingContext(value: NocodeEditorRelationContext | null) {
    return this.normalizeContext(value, { strictPersistedShape: false })
  }

  private normalizePersistedContext(value: unknown) {
    try {
      return this.normalizeContext(value, { strictPersistedShape: true })
    } catch {
      return null
    }
  }

  private normalizeContext(
    value: unknown,
    options: {
      strictPersistedShape: boolean
    },
  ): NocodeEditorRelationContext | null {
    if (!value) {
      return null
    }

    if (typeof value !== 'object') {
      return null
    }

    if (options.strictPersistedShape && !this.isPersistedContextShape(value)) {
      return null
    }

    const source = value as Partial<NocodeEditorRelationContext> & Record<string, unknown>
    const appId = String(source.appId || '').trim()
    if (!appId) {
      throw new Error(global.i18next.t('nocodeEditorRelationContextStore.appIdRequired'))
    }

    const now = Date.now()
    return mergeNocodeEditorRelationContexts({
      overlay: {
        version: 1,
        appId,
        appName: String(source.appName || '').trim() || undefined,
        generatedAt: Number(source.generatedAt || now) || now,
        updatedAt: Number(source.updatedAt || source.generatedAt || now) || now,
        fingerprint: {
          relationHash: String(source.fingerprint?.relationHash || '').trim(),
          formCount: Number(source.fingerprint?.formCount || 0) || 0,
          fieldCount: Number(source.fingerprint?.fieldCount || 0) || 0,
        },
        forms: Array.isArray(source.forms) ? source.forms : [],
        entityIndex: Array.isArray(source.entityIndex) ? source.entityIndex : [],
        candidateLinks: Array.isArray(source.candidateLinks) ? source.candidateLinks : [],
      },
    })
  }

  private isPersistedContextShape(value: unknown) {
    if (!value || typeof value !== 'object') {
      return false
    }

    const source = value as Record<string, unknown>
    return (
      Array.isArray(source.forms)
      && Array.isArray(source.entityIndex)
      && Array.isArray(source.candidateLinks)
      && Boolean(source.fingerprint && typeof source.fingerprint === 'object')
      && String(source.appId || '').trim().length > 0
    )
  }

  private async readJson<T>(filePath: string) {
    try {
      const text = await readFile(filePath, 'utf8')
      return JSON.parse(text) as T
    } catch {
      return null
    }
  }

  private async writeJson(filePath: string, value: unknown) {
    await mkdir(dirname(filePath), { recursive: true })
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    await writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8')
    try {
      await this.renameWithRetry(tempPath, filePath)
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => {})
      throw error
    }
  }

  private async renameWithRetry(tempPath: string, filePath: string) {
    let lastError: unknown = null
    for (let attempt = 0; attempt <= RELATION_CONTEXT_RENAME_RETRY_DELAYS.length; attempt += 1) {
      try {
        await rename(tempPath, filePath)
        return
      } catch (error) {
        lastError = error
        const errorCode = String((error as any)?.code || '')
        if (
          !RELATION_CONTEXT_RENAME_RETRY_CODES.has(errorCode)
          || attempt === RELATION_CONTEXT_RENAME_RETRY_DELAYS.length
        ) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, RELATION_CONTEXT_RENAME_RETRY_DELAYS[attempt]))
      }
    }
    throw lastError
  }
}
