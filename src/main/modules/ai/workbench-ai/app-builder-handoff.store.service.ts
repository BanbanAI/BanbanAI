import { normalizeAppBuilderHandoff } from '@common/utils/appBuilderHandoff'
import type { AppBuilderHandoff } from '@common/types/appBuilderHandoff'
import { Inject, Injectable } from '@nestjs/common'
import { NOCODES_DIR } from '@main/constants'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'path'

export type AppBuilderHandoffStoreStatus = 'ready' | 'continuing' | 'consumed' | 'abandoned'

export type AppBuilderHandoffStoreRecord = AppBuilderHandoff & {
  accountId: string
  createdAt: number
  updatedAt: number
  status: AppBuilderHandoffStoreStatus
}

const APP_BUILDER_HANDOFF_RENAME_RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const APP_BUILDER_HANDOFF_RENAME_RETRY_DELAYS = [20, 50, 100, 200]

@Injectable()
export class AppBuilderHandoffStoreService {
  constructor(
    @Inject(NOCODES_DIR) private readonly rootDir: string,
  ) {}

  async createOrReplace(record: AppBuilderHandoffStoreRecord) {
    const normalized = this.normalizeRecord(record)
    if (!normalized) {
      throw new Error('Invalid app builder handoff record')
    }

    const now = Date.now()
    const nextRecord: AppBuilderHandoffStoreRecord = {
      ...normalized,
      createdAt: Number(normalized.createdAt || now),
      updatedAt: now,
      status: normalized.status || 'ready',
    }
    await this.writeStore(nextRecord)
    return nextRecord
  }

  async getByHandoffId(accountId: string, handoffId: string) {
    const records = await this.readAllStoresForAccount(accountId)
    return records.find(item => item.handoffId === handoffId) || null
  }

  async markConsumed(accountId: string, handoffId: string) {
    const current = await this.getByHandoffId(accountId, handoffId)
    if (!current) return null
    return await this.createOrReplace({
      ...current,
      status: 'consumed',
    })
  }

  async markContinuing(accountId: string, handoffId: string) {
    const current = await this.getByHandoffId(accountId, handoffId)
    if (!current) return null
    return await this.createOrReplace({
      ...current,
      status: 'continuing',
    })
  }

  async markReady(accountId: string, handoffId: string) {
    const current = await this.getByHandoffId(accountId, handoffId)
    if (!current) return null
    return await this.createOrReplace({
      ...current,
      status: 'ready',
    })
  }

  private async readAllStoresForAccount(accountId: string) {
    const normalizedAccountId = String(accountId || '').trim()
    const accountDir = this.getAccountDir(normalizedAccountId)
    if (!accountDir) {
      return []
    }

    let files: string[] = []
    try {
      files = await readdir(accountDir)
    } catch {
      return []
    }

    const records: AppBuilderHandoffStoreRecord[] = []
    for (const entryName of files) {
      const entryPath = this.resolveInside(accountDir, entryName)
      if (entryName.endsWith('.json')) {
        const record = await this.readStore(entryPath, normalizedAccountId)
        if (record) {
          records.push(record)
        }
        continue
      }

      let handoffFiles: string[] = []
      try {
        handoffFiles = await readdir(entryPath)
      } catch {
        continue
      }
      for (const fileName of handoffFiles) {
        if (!fileName.endsWith('.json')) {
          continue
        }
        const filePath = this.resolveInside(entryPath, fileName)
        const record = await this.readStore(filePath, normalizedAccountId)
        if (record) {
          records.push(record)
        }
      }
    }
    return records
  }

  private async readStore(filePath: string, accountId: string) {
    try {
      const text = await readFile(filePath, 'utf8')
      return this.normalizeRecord({
        ...JSON.parse(text),
        accountId,
      })
    } catch {
      return null
    }
  }

  private normalizeRecord(value: unknown): AppBuilderHandoffStoreRecord | null {
    const handoff = normalizeAppBuilderHandoff(value)
    if (!handoff) {
      return null
    }

    const raw = value as Partial<AppBuilderHandoffStoreRecord> & Record<string, unknown>
    const accountId = String(raw.accountId || '').trim()
    const threadId = String(handoff.source.threadId || '').trim()
    const handoffId = String(handoff.handoffId || '').trim()
    if (!accountId || !threadId || !handoffId) {
      return null
    }

    return {
      ...handoff,
      accountId,
      createdAt: this.normalizePositiveTimestamp(raw.createdAt),
      updatedAt: this.normalizePositiveTimestamp(raw.updatedAt),
      status: this.normalizeStatus(raw.status),
    }
  }

  private normalizeStatus(value: unknown): AppBuilderHandoffStoreStatus {
    if (value === 'continuing' || value === 'consumed' || value === 'abandoned') {
      return value
    }
    return 'ready'
  }

  private normalizePositiveTimestamp(value: unknown) {
    const normalized = Number(value)
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return 0
    }
    return normalized
  }

  private async writeStore(record: AppBuilderHandoffStoreRecord) {
    const filePath = this.getStorePath(record.accountId, record.source.threadId, record.handoffId)
    await mkdir(dirname(filePath), { recursive: true })
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    await writeFile(tempPath, JSON.stringify(record, null, 2), 'utf8')
    try {
      await this.renameWithRetry(tempPath, filePath)
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => {})
      throw error
    }
  }

  private getStoreRoot() {
    return resolve(this.rootDir, 'ai', 'handoffs')
  }

  private getAccountDir(accountId: string) {
    const accountSegment = this.toSafePathSegment(accountId)
    if (!accountSegment) {
      return null
    }
    return this.resolveInside(this.getStoreRoot(), accountSegment)
  }

  private getStorePath(accountId: string, threadId: string, handoffId: string) {
    const accountDir = this.getAccountDir(accountId)
    const threadSegment = this.toSafePathSegment(threadId)
    const handoffSegment = this.toSafePathSegment(handoffId)
    if (!accountDir || !threadSegment || !handoffSegment) {
      throw new Error('Invalid app builder handoff store path identity')
    }
    return this.resolveInside(accountDir, threadSegment, `${handoffSegment}.json`)
  }

  private toSafePathSegment(value: unknown) {
    const raw = String(value || '').trim()
    if (!raw) {
      return null
    }
    return Buffer.from(raw, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
  }

  private resolveInside(baseDir: string, ...segments: string[]) {
    const base = resolve(baseDir)
    const target = resolve(base, ...segments)
    const relativePath = relative(base, target)
    if (relativePath && (relativePath.startsWith('..') || isAbsolute(relativePath))) {
      throw new Error('Resolved app builder handoff store path escapes its root')
    }
    return target
  }

  private async renameWithRetry(tempPath: string, filePath: string) {
    let lastError: unknown = null
    for (let attempt = 0; attempt <= APP_BUILDER_HANDOFF_RENAME_RETRY_DELAYS.length; attempt += 1) {
      try {
        await rename(tempPath, filePath)
        return
      } catch (error) {
        lastError = error
        const errorCode = String((error as any)?.code || '')
        if (
          !APP_BUILDER_HANDOFF_RENAME_RETRY_CODES.has(errorCode)
          || attempt === APP_BUILDER_HANDOFF_RENAME_RETRY_DELAYS.length
        ) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, APP_BUILDER_HANDOFF_RENAME_RETRY_DELAYS[attempt]))
      }
    }
    throw lastError
  }
}
