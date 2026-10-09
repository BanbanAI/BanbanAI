import { Inject, Injectable } from '@nestjs/common'
import { NOCODES_DIR } from '@main/constants'
import { mergeSingleFormBlueprintFragments } from '@common/utils/nocodeEditorBlueprintFormNormalization'
import {
  normalizeAppliedBlueprintPhase,
  type NocodeEditorAiBlueprintAppliedPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { resolveNocodeEditorAppPath } from './nocode-editor-app-id.util'

type NocodeEditorAppliedBlueprintApplyResult = Record<string, any>
type NocodeEditorAppliedBlueprintItemKind = 'ai_blueprint' | 'current_form_snapshot'

export type NocodeEditorAppliedBlueprintRecord = {
  recordId: string
  blueprintId: string
  itemKind: NocodeEditorAppliedBlueprintItemKind
  status: NocodeEditorAiBlueprintAppliedPhase | 'current_form_snapshot'
  phase: NocodeEditorAiBlueprintAppliedPhase | null
  source?: string
  title?: string
  summary?: string
  sortIndex?: number
  revision?: number
  stagedAt?: number
  createdAt: number
  updatedAt: number
  appliedAt?: number
  applyResult?: NocodeEditorAppliedBlueprintApplyResult | null
  blueprint: Record<string, any>
}

type NocodeEditorAppliedBlueprintStore = {
  version: number
  items: NocodeEditorAppliedBlueprintRecord[]
}

const BLUEPRINT_RENAME_RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES'])
const BLUEPRINT_RENAME_RETRY_DELAYS = [20, 50, 100, 200]

@Injectable()
export class NocodeEditorBlueprintStoreService {
  constructor(
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
  ) {}

  async listAppliedBlueprints(nocodeId: string) {
    return this.normalizeStore(await this.readStore(nocodeId)).items
  }

  async upsertAppliedBlueprint(
    nocodeId: string,
    input: {
      recordId?: string
      blueprintId?: string
      source?: string
      title?: string
      summary?: string
      sortIndex?: number
      revision?: number
      stagedAt?: number
      appliedAt?: number
      itemKind?: NocodeEditorAppliedBlueprintItemKind
      phase?: NocodeEditorAiBlueprintAppliedPhase | null
      applyResult?: NocodeEditorAppliedBlueprintApplyResult | null
      blueprint: Record<string, any>
    },
  ) {
    const store = this.normalizeStore(await this.readStore(nocodeId))
    const blueprint = this.normalizeBlueprint(input.blueprint)
    const blueprintId = String(input.blueprintId || blueprint.id || '').trim()
    if (!blueprintId) {
      throw new Error(global.i18next.t('nocodeEditorBlueprintStore.blueprintIdRequired'))
    }

    blueprint.id = blueprintId

    const now = Date.now()
    const recordId = String(input.recordId || blueprintId).trim() || blueprintId
    const itemKind = this.normalizeItemKind(input.itemKind, input.source)
    const phase = itemKind === 'current_form_snapshot'
      ? null
      : normalizeAppliedBlueprintPhase(input.phase) || 'applied_saved'
    const nextRecord: NocodeEditorAppliedBlueprintRecord = {
      recordId,
      blueprintId,
      itemKind,
      status: phase || 'current_form_snapshot',
      phase,
      source: String(input.source || 'ai-apply').trim() || 'ai-apply',
      title: String(input.title || blueprint.title || '').trim() || undefined,
      summary: String(input.summary || blueprint.summary || '').trim() || undefined,
      sortIndex: this.normalizeSortIndex(input.sortIndex),
      revision: this.normalizeNumber(input.revision),
      stagedAt: this.normalizeNumber(input.stagedAt),
      createdAt: now,
      updatedAt: now,
      appliedAt: input.appliedAt || now,
      applyResult: itemKind === 'ai_blueprint' && input.applyResult ? this.cloneValue(input.applyResult) : null,
      blueprint,
    }

    const recordIndex = store.items.findIndex(item => (
      String(item.recordId || '').trim() === recordId
      || String(item.blueprintId || '').trim() === blueprintId
    ))

    if (recordIndex === -1) {
      store.items.push(nextRecord)
    } else {
      const current = store.items[recordIndex]
      store.items[recordIndex] = {
        ...current,
        ...nextRecord,
        createdAt: current.createdAt || nextRecord.createdAt,
        updatedAt: now,
      }
    }

    store.items = this.sortRecords(store.items)
    await this.writeStore(nocodeId, store)
    return this.cloneValue(store.items.find(item => item.blueprintId === blueprintId) || nextRecord)
  }

  async replaceAppliedBlueprints(
    nocodeId: string,
    inputs: Array<{
      recordId?: string
      blueprintId?: string
      source?: string
      title?: string
      summary?: string
      sortIndex?: number
      revision?: number
      stagedAt?: number
      createdAt?: number
      updatedAt?: number
      appliedAt?: number
      itemKind?: NocodeEditorAppliedBlueprintItemKind
      phase?: NocodeEditorAiBlueprintAppliedPhase | null
      applyResult?: NocodeEditorAppliedBlueprintApplyResult | null
      blueprint: Record<string, any>
    }>,
  ) {
    const currentStore = this.normalizeStore(await this.readStore(nocodeId))
    const currentRecordMap = new Map<string, NocodeEditorAppliedBlueprintRecord>()
    for (const item of currentStore.items) {
      const identityKeys = [
        String(item.recordId || '').trim(),
        String(item.blueprintId || '').trim(),
      ].filter(Boolean)
      identityKeys.forEach(key => currentRecordMap.set(key, item))
    }

    const now = Date.now()
    const nextItems = inputs
      .map((input, index) => {
        const blueprint = this.normalizeBlueprint(input.blueprint)
        const blueprintId = String(input.blueprintId || blueprint.id || '').trim()
        if (!blueprintId) {
          return null
        }

        blueprint.id = blueprintId
        const recordId = String(input.recordId || blueprintId).trim() || blueprintId
        const current = currentRecordMap.get(recordId) || currentRecordMap.get(blueprintId) || null
        const updatedAt = Number(input.updatedAt || input.appliedAt || now) || now
        const appliedAt = Number(input.appliedAt || updatedAt || now) || now
        const source = String(input.source || current?.source || 'current-forms').trim() || 'current-forms'
        const itemKind = this.normalizeItemKind(input.itemKind, source)
        const phase = itemKind === 'current_form_snapshot'
          ? null
          : normalizeAppliedBlueprintPhase(input.phase) || 'applied_saved'

        return {
          recordId,
          blueprintId,
          itemKind,
          status: phase || 'current_form_snapshot',
          phase,
          source,
          title: String(input.title || blueprint.title || current?.title || '').trim() || undefined,
          summary: String(input.summary || blueprint.summary || current?.summary || '').trim() || undefined,
          sortIndex: this.normalizeSortIndex(input.sortIndex) ?? index,
          revision: this.normalizeNumber(input.revision) ?? this.normalizeNumber(current?.revision),
          stagedAt: this.normalizeNumber(input.stagedAt) ?? this.normalizeNumber(current?.stagedAt),
          createdAt: Number(input.createdAt || current?.createdAt || now) || now,
          updatedAt,
          appliedAt,
          applyResult: itemKind === 'ai_blueprint' && input.applyResult ? this.cloneValue(input.applyResult) : null,
          blueprint,
        }
      })
      .filter(Boolean) as NocodeEditorAppliedBlueprintRecord[]

    const store = this.normalizeStore({
      version: 1,
      items: nextItems,
    })
    await this.writeStore(nocodeId, store)
    return this.cloneValue(store.items)
  }

  private getStorePath(nocodeId: string) {
    return resolveNocodeEditorAppPath(
      this.nocodesDir,
      nocodeId,
      'ai',
      'applied-blueprints.json',
    )
  }

  private async readStore(nocodeId: string) {
    const filePath = this.getStorePath(nocodeId)
    try {
      const text = await readFile(filePath, 'utf8')
      return JSON.parse(text) as NocodeEditorAppliedBlueprintStore
    } catch {
      return null
    }
  }

  private normalizeStore(value: NocodeEditorAppliedBlueprintStore | null): NocodeEditorAppliedBlueprintStore {
    const items = Array.isArray(value?.items) ? value.items : []
    return {
      version: 1,
      items: this.sortRecords(
        items
          .map(item => this.normalizeRecord(item))
          .filter(Boolean) as NocodeEditorAppliedBlueprintRecord[],
      ),
    }
  }

  private normalizeRecord(value: Partial<NocodeEditorAppliedBlueprintRecord> | null): NocodeEditorAppliedBlueprintRecord | null {
    if (!value) {
      return null
    }

    const blueprint = this.normalizeBlueprint(value.blueprint)
    const blueprintId = String(value.blueprintId || blueprint.id || '').trim()
    if (!blueprintId) {
      return null
    }

    blueprint.id = blueprintId

    const now = Date.now()
    const itemKind = this.normalizeItemKind(value.itemKind, value.source)
    const phase = itemKind === 'current_form_snapshot'
      ? null
      : normalizeAppliedBlueprintPhase(value.phase) || 'applied_saved'
    return {
      recordId: String(value.recordId || blueprintId).trim() || blueprintId,
      blueprintId,
      itemKind,
      status: phase || 'current_form_snapshot',
      phase,
      source: String(value.source || 'ai-apply').trim() || 'ai-apply',
      title: String(value.title || blueprint.title || '').trim() || undefined,
      summary: String(value.summary || blueprint.summary || '').trim() || undefined,
      sortIndex: this.normalizeSortIndex(value.sortIndex),
      revision: this.normalizeNumber(value.revision),
      stagedAt: this.normalizeNumber(value.stagedAt),
      createdAt: Number(value.createdAt || now),
      updatedAt: Number(value.updatedAt || value.appliedAt || value.createdAt || now),
      appliedAt: Number(value.appliedAt || value.updatedAt || value.createdAt || now),
      applyResult: itemKind === 'ai_blueprint' && value.applyResult ? this.cloneValue(value.applyResult) : null,
      blueprint,
    }
  }

  private normalizeItemKind(value: unknown, source?: unknown): NocodeEditorAppliedBlueprintItemKind {
    if (value === 'current_form_snapshot' || String(source || '').trim() === 'current-forms') {
      return 'current_form_snapshot'
    }
    return 'ai_blueprint'
  }

  private normalizeBlueprint(value: Record<string, any> | null | undefined) {
    const blueprint = this.cloneValue(value || {})
    if (Array.isArray(blueprint.forms)) {
      blueprint.forms = mergeSingleFormBlueprintFragments(blueprint.forms)
    }
    if (!blueprint.id) {
      blueprint.id = `blueprint-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
    }
    return blueprint
  }

  private sortRecords(items: NocodeEditorAppliedBlueprintRecord[]) {
    return [...items].sort((left, right) => {
      const leftSortIndex = this.normalizeSortIndex(left?.sortIndex)
      const rightSortIndex = this.normalizeSortIndex(right?.sortIndex)
      if (leftSortIndex !== undefined || rightSortIndex !== undefined) {
        if (leftSortIndex === undefined) {
          return 1
        }
        if (rightSortIndex === undefined) {
          return -1
        }
        if (leftSortIndex !== rightSortIndex) {
          return leftSortIndex - rightSortIndex
        }
      }

      const leftTime = Number(left?.updatedAt || left?.appliedAt || left?.createdAt || 0)
      const rightTime = Number(right?.updatedAt || right?.appliedAt || right?.createdAt || 0)
      return rightTime - leftTime
    })
  }

  private normalizeSortIndex(value: unknown) {
    const normalized = Number(value)
    if (!Number.isFinite(normalized)) {
      return undefined
    }
    return Math.max(0, Math.round(normalized))
  }

  private normalizeNumber(value: unknown) {
    const normalized = Number(value)
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return undefined
    }
    return normalized
  }

  private async writeStore(nocodeId: string, store: NocodeEditorAppliedBlueprintStore) {
    const filePath = this.getStorePath(nocodeId)
    await mkdir(dirname(filePath), { recursive: true })
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    await writeFile(tempPath, JSON.stringify(store, null, 2), 'utf8')
    try {
      await this.renameStoreWithRetry(tempPath, filePath)
    } catch (error) {
      await rm(tempPath, { force: true }).catch(() => {})
      throw error
    }
  }

  private cloneValue<T>(value: T): T {
    return value == null ? value : JSON.parse(JSON.stringify(value))
  }

  private async renameStoreWithRetry(tempPath: string, filePath: string) {
    let lastError: unknown = null
    for (let attempt = 0; attempt <= BLUEPRINT_RENAME_RETRY_DELAYS.length; attempt += 1) {
      try {
        await rename(tempPath, filePath)
        return
      } catch (error) {
        lastError = error
        const errorCode = String((error as any)?.code || '')
        if (!BLUEPRINT_RENAME_RETRY_CODES.has(errorCode) || attempt === BLUEPRINT_RENAME_RETRY_DELAYS.length) {
          throw error
        }
        await new Promise(resolve => setTimeout(resolve, BLUEPRINT_RENAME_RETRY_DELAYS[attempt]))
      }
    }
    throw lastError
  }
}
