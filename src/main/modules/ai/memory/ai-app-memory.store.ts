import { Inject, Injectable } from '@nestjs/common'
import { NOCODES_DIR } from '@main/constants'
import { mkdir, readFile, readdir, rm, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { AiAppMemoryManifest, AiAppMemoryWarmupLedger, AiAppMemoryWarmupTrace, AiSourceMemory } from '../ai.types'

@Injectable()
export class AiAppMemoryStore {
  constructor(
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
  ) {}

  async readManifest(appId: string) {
    return await this.readJson<AiAppMemoryManifest>(this.getManifestPath(appId))
  }

  async writeManifest(appId: string, manifest: AiAppMemoryManifest) {
    await this.writeJson(this.getManifestPath(appId), manifest)
  }

  async readSourceMemory(appId: string, sourceId: string) {
    return await this.readJsonWithFallback<AiSourceMemory>([
      this.getSourcePath(appId, sourceId),
      this.getLegacySourcePath(appId, sourceId),
    ])
  }

  async writeSourceMemory(appId: string, memory: AiSourceMemory) {
    await this.writeJson(this.getSourcePath(appId, memory.sourceId), memory)
  }

  async removeSourceMemories(appId: string, sourceIds: string[]) {
    await Promise.all(
      sourceIds.map(async sourceId => {
        await this.removeFile(this.getSourcePath(appId, sourceId))
        await this.removeFile(this.getLegacySourcePath(appId, sourceId))
      }),
    )
  }

  async clearAppMemory(appId: string) {
    await Promise.all([
      this.removeFile(this.getManifestPath(appId)),
      rm(this.getSourcesDir(appId), {
        recursive: true,
        force: true,
      }).catch(() => {}),
    ])
  }

  async clearWarmupArtifacts() {
    await Promise.all([
      rm(this.getWarmupLedgerPath(), {
        force: true,
      }).catch(() => {}),
      rm(this.getWarmupTracePath(), {
        force: true,
      }).catch(() => {}),
      rm(join(this.nocodesDir, '_ai'), {
        recursive: true,
        force: true,
      }).catch(() => {}),
    ])
  }

  async readWarmupLedger() {
    return await this.readJson<AiAppMemoryWarmupLedger>(this.getWarmupLedgerPath())
  }

  async writeWarmupLedger(ledger: AiAppMemoryWarmupLedger) {
    await this.writeJson(this.getWarmupLedgerPath(), ledger)
  }

  async readWarmupTraces() {
    return await this.readJson<AiAppMemoryWarmupTrace[]>(this.getWarmupTracePath())
  }

  async writeWarmupTraces(traces: AiAppMemoryWarmupTrace[]) {
    await this.writeJson(this.getWarmupTracePath(), traces)
  }

  getWarmupLedgerFilePath() {
    return this.getWarmupLedgerPath()
  }

  getManifestFilePath(appId: string) {
    return this.getManifestPath(appId)
  }

  getWarmupTraceFilePath() {
    return this.getWarmupTracePath()
  }

  async listManifestAppIds() {
    try {
      const entries = await readdir(this.nocodesDir, {
        withFileTypes: true,
      })
      const appIds: string[] = []
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue
        }
        const manifest = await this.readJson<AiAppMemoryManifest>(this.getManifestPath(entry.name))
        if (manifest) {
          appIds.push(entry.name)
        }
      }
      return appIds.sort((left, right) => left.localeCompare(right, 'zh-CN'))
    } catch {
      return []
    }
  }

  async listAiDirectoryAppIds() {
    try {
      const entries = await readdir(this.nocodesDir, {
        withFileTypes: true,
      })
      const appIds: string[] = []
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue
        }
        const aiEntries = await readdir(this.getAiDir(entry.name), { withFileTypes: true }).catch(() => null)
        if (!aiEntries?.some(item => item.name === 'manifest.json' || item.name === 'sources')) {
          continue
        }
        appIds.push(entry.name)
      }
      return appIds.sort((left, right) => left.localeCompare(right, 'zh-CN'))
    } catch {
      return []
    }
  }

  private getAiDir(appId: string) {
    return join(this.nocodesDir, appId, 'ai')
  }

  private getManifestPath(appId: string) {
    return join(this.getAiDir(appId), 'manifest.json')
  }

  private getSourcesDir(appId: string) {
    return join(this.getAiDir(appId), 'sources')
  }

  private getWarmupLedgerPath() {
    return join(this.nocodesDir, '_ai', 'warmup-status.json')
  }

  private getWarmupTracePath() {
    return join(this.nocodesDir, '_ai', 'warmup-traces.json')
  }

  private getSourcePath(appId: string, sourceId: string) {
    return join(this.getSourcesDir(appId), `${this.toSafeFileId(sourceId)}.json`)
  }

  private getLegacySourcePath(appId: string, sourceId: string) {
    return join(this.getSourcesDir(appId), `${sourceId}.json`)
  }

  private async readJson<T>(filePath: string) {
    try {
      const text = await readFile(filePath, 'utf8')
      return JSON.parse(text) as T
    } catch {
      return null
    }
  }

  private async readJsonWithFallback<T>(filePaths: string[]) {
    for (const filePath of [...new Set(filePaths.filter(Boolean))]) {
      const value = await this.readJson<T>(filePath)
      if (value) {
        return value
      }
    }
    return null
  }

  private async writeJson(filePath: string, value: unknown) {
    await mkdir(dirname(filePath), {
      recursive: true,
    })
    await writeFile(filePath, JSON.stringify(value, null, 2), 'utf8')
  }

  private async removeFile(filePath: string) {
    await unlink(filePath).catch(() => {})
  }

  private toSafeFileId(value: string) {
    return encodeURIComponent(String(value || '').trim())
  }
}
