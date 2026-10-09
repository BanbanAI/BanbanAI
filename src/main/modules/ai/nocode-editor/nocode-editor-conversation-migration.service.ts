import { EntityManager } from '@mikro-orm/core'
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { dirname, join, resolve, sep } from 'path'
import JSZip from 'jszip'
import { unique } from '@common/utils/unique'
import { UPLOADS_DIR } from '@main/constants'
import { buildNocodeEditorAiConversationId } from '@common/utils/nocodeEditorAiConversation'
import { AiMessageRole } from '../ai.types'
import {
  AiNocodeEditorConversationEntity,
  AiNocodeEditorMessageEntity,
  AiThreadAttachmentEntity,
} from '../entities'
import { AiAgentLogService } from '../logging/agent-log.service'
import { AiAttachmentService } from '../thread/ai-attachment.service'
import {
  NocodeEditorBlueprintStoreService,
  type NocodeEditorAppliedBlueprintRecord,
} from './nocode-editor-blueprint-store.service'

const PACKAGE_FORMAT = 'banban-nocode-editor-ai-conversation'
const PACKAGE_VERSION = 2
const MAX_PACKAGE_ENTRIES = 2000
const MAX_PACKAGE_SIZE = 500 * 1024 * 1024

type ExportManifest = {
  format: string
  version: number
  exportedAt: number
  source: { accountId: string; nocodeId: string; conversationId: string }
  counts: { messages: number; attachments: number; appliedBlueprints?: number }
  files: Record<string, string>
}
type JsonRecord = Record<string, unknown>

@Injectable()
export class NocodeEditorConversationMigrationService {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly attachmentService: AiAttachmentService,
    private readonly agentLogService: AiAgentLogService,
    private readonly blueprintStoreService: NocodeEditorBlueprintStoreService,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
  ) {}

  async exportConversation(ownerAccountId: string, conversationId: string) {
    const em = this.entityManager.fork()
    const conversation = await em.getRepository(AiNocodeEditorConversationEntity).findOne({
      id: String(conversationId || '').trim(),
      ownerAccountId: String(ownerAccountId || '').trim(),
    })
    if (!conversation) throw new NotFoundException('AI_CONVERSATION_NOT_FOUND')

    const messages = await em.getRepository(AiNocodeEditorMessageEntity).find({
      conversationId: conversation.id,
      ownerAccountId: conversation.ownerAccountId,
    }, { orderBy: { sequence: 'ASC', id: 'ASC' } })
    const attachments = await em.getRepository(AiThreadAttachmentEntity).find({
      threadId: conversation.id,
      ownerAccountId: conversation.ownerAccountId,
    }, { orderBy: { createTime: 'ASC', id: 'ASC' } })
    const appliedBlueprints = await this.blueprintStoreService.listAppliedBlueprints(conversation.nocodeId)

    const zip = new JSZip()
    const fileHashes: Record<string, string> = {}
    const add = async (path: string, data: string | Buffer) => {
      zip.file(path, data)
      fileHashes[path] = createHash('sha256').update(data).digest('hex')
    }
    await add('source-conversation.json', JSON.stringify(conversation))
    await add('source-messages.json', JSON.stringify(messages))
    await add('application/applied-blueprints.json', JSON.stringify(appliedBlueprints))
    for (const attachment of attachments) {
      const base = `attachments/${attachment.id}`
      await add(`${base}/record.json`, JSON.stringify(attachment))
      const original = await this.readAttachmentFile(attachment).catch(() => null)
      if (original) await add(`${base}/original.bin`, original)
      const derived = await this.readDerivedFile(attachment).catch(() => null)
      if (derived) await add(`${base}/derived.txt`, derived)
    }
    const log = await readFile(await this.agentLogService.getConversationLogPath(conversation.id)).catch(() => null)
    if (log) await add(`logs/${conversation.id}.log`, log)
    const manifest: ExportManifest = {
      format: PACKAGE_FORMAT,
      version: PACKAGE_VERSION,
      exportedAt: Date.now(),
      source: {
        accountId: conversation.ownerAccountId,
        nocodeId: conversation.nocodeId,
        conversationId: conversation.id,
      },
      counts: {
        messages: messages.length,
        attachments: attachments.length,
        appliedBlueprints: appliedBlueprints.length,
      },
      files: fileHashes,
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))
    return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  }

  async importConversation(ownerAccountId: string, nocodeId: string, packageBuffer: Buffer) {
    if (!Buffer.isBuffer(packageBuffer) || !packageBuffer.length || packageBuffer.length > MAX_PACKAGE_SIZE) {
      throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
    }
    const zip = await JSZip.loadAsync(packageBuffer, { checkCRC32: false }).catch(() => null)
    if (!zip || Object.keys(zip.files).length > MAX_PACKAGE_ENTRIES) {
      throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
    }
    this.assertSafeEntries(zip)
    const manifest = await this.readJson<ExportManifest>(zip, 'manifest.json')
    if (manifest?.format !== PACKAGE_FORMAT || ![1, PACKAGE_VERSION].includes(manifest.version)) {
      throw new BadRequestException('AI_CONVERSATION_PACKAGE_VERSION_UNSUPPORTED')
    }
    for (const [path, expectedHash] of Object.entries(manifest.files || {})) {
      const actualHash = createHash('sha256').update(await this.readZipFile(zip, path)).digest('hex')
      if (actualHash !== expectedHash) throw new BadRequestException('AI_CONVERSATION_PACKAGE_CHECKSUM_INVALID')
    }
    const sourceConversation = await this.readJson<JsonRecord>(zip, 'source-conversation.json')
    const sourceMessages = await this.readJson<JsonRecord[]>(zip, 'source-messages.json')
    const hasAppliedBlueprintSnapshot = manifest.version >= 2
    const sourceAppliedBlueprints = hasAppliedBlueprintSnapshot
      ? await this.readJson<NocodeEditorAppliedBlueprintRecord[]>(zip, 'application/applied-blueprints.json')
      : []
    if (!sourceConversation?.id || !Array.isArray(sourceMessages)) {
      throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
    }
    const sourceAttachments = await this.readAttachmentRecords(zip)
    if (manifest.counts?.messages !== sourceMessages.length || manifest.counts?.attachments !== sourceAttachments.length) {
      throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
    }
    if (
      hasAppliedBlueprintSnapshot
      && (!Array.isArray(sourceAppliedBlueprints) || Number(manifest.counts?.appliedBlueprints || 0) !== sourceAppliedBlueprints.length)
    ) {
      throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
    }

    const targetOwner = String(ownerAccountId || '').trim()
    const targetApp = String(nocodeId || '').trim()
    const taskId = String(sourceConversation.taskId || '').trim() || `task_import_${Date.now()}_${unique(8)}`
    const targetConversationId = buildNocodeEditorAiConversationId({ accountId: targetOwner, nocodeId: targetApp, taskId })
    if (!targetOwner || !targetApp || !targetConversationId) throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
    const repo = this.entityManager.getRepository(AiNocodeEditorConversationEntity)
    if (await repo.findOne({ id: targetConversationId })) throw new ConflictException('AI_CONVERSATION_ALREADY_EXISTS')

    const messageIdMap = new Map<string, string>()
    sourceMessages.forEach(message => messageIdMap.set(String(message.id), unique(20)))
    const attachmentIdMap = new Map<string, string>()
    sourceAttachments.forEach(record => attachmentIdMap.set(String(record.record.id), `att_${unique(20)}`))
    const writtenPaths: string[] = []
    let importedConversationId = ''
    let importedLogPath = ''
    const previousAppliedBlueprints = await this.blueprintStoreService.listAppliedBlueprints(targetApp)
    let appliedBlueprintsReplaced = false
    try {
      const imported = await this.entityManager.transactional(async em => {
        const conversation = new AiNocodeEditorConversationEntity()
        Object.assign(conversation, sourceConversation)
        conversation.id = targetConversationId
        conversation.ownerAccountId = targetOwner
        conversation.nocodeId = targetApp
        conversation.taskId = taskId
        conversation.scopeKey = String(sourceConversation.scopeKey || '')
        conversation.createTime = Number(sourceConversation.createTime) || Date.now()
        conversation.updateTime = Number(sourceConversation.updateTime) || conversation.createTime
        conversation.lastActiveTime = Number(sourceConversation.lastActiveTime) || conversation.updateTime
        await em.persistAndFlush(conversation)

        for (const messageData of sourceMessages) {
          const message = new AiNocodeEditorMessageEntity()
          Object.assign(message, messageData)
          message.id = messageIdMap.get(String(messageData.id)) || unique(20)
          message.conversationId = targetConversationId
          message.ownerAccountId = targetOwner
          message.role = messageData.role as AiMessageRole
          message.metadata = this.mapAttachmentReferences(messageData.metadata, attachmentIdMap) as AiNocodeEditorMessageEntity['metadata']
          await em.persist(message)
        }

        for (const item of sourceAttachments) {
          const source = item.record
          const targetId = attachmentIdMap.get(String(source.id))!
          const targetStorageKey = join(this.safeSegment(targetApp), '_ai', this.safeSegment(targetConversationId), `${targetId}.${this.safeSegment(source.extension)}`).replace(/\\/g, '/')
          const targetPath = resolve(this.uploadsDir, targetStorageKey)
          const appRoot = resolve(this.uploadsDir, this.safeSegment(targetApp))
          if (!targetPath.startsWith(`${appRoot}${sep}`)) throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
          const original = item.original
          if (!original && source.status !== 'deleted') {
            throw new BadRequestException('AI_CONVERSATION_ATTACHMENT_FILE_MISSING')
          }
          if (original) {
            await mkdir(dirname(targetPath), { recursive: true })
            await writeFile(targetPath, original, { flag: 'wx' })
            writtenPaths.push(targetPath)
          }
          if (item.derived) {
            const derivedPath = join(dirname(targetPath), '_derived', `${targetId}.txt`)
            await mkdir(dirname(derivedPath), { recursive: true })
            await writeFile(derivedPath, item.derived, { flag: 'wx' })
            writtenPaths.push(derivedPath)
          }
          const attachment = new AiThreadAttachmentEntity()
          Object.assign(attachment, source)
          attachment.id = targetId
          attachment.threadId = targetConversationId
          attachment.ownerAccountId = targetOwner
          attachment.boundMessageId = source.boundMessageId
            ? messageIdMap.get(String(source.boundMessageId)) || null
            : null
          attachment.storageKey = targetStorageKey
          await em.persist(attachment)
        }
        await em.flush()
        return conversation
      })
      importedConversationId = imported.id
      const sourceLog = await this.readZipFile(zip, `logs/${sourceConversation.id}.log`).catch(() => null)
      if (sourceLog) {
        const logPath = await this.agentLogService.getConversationLogPath(imported.id)
        importedLogPath = logPath
        await mkdir(dirname(logPath), { recursive: true })
        await writeFile(logPath, sourceLog)
      }
      if (hasAppliedBlueprintSnapshot) {
        await this.blueprintStoreService.replaceAppliedBlueprints(targetApp, sourceAppliedBlueprints)
        appliedBlueprintsReplaced = true
      }
      return {
        conversationId: imported.id,
        taskId: imported.taskId,
        scopeKey: imported.scopeKey || '',
        source: 'resume',
        appliedBlueprintCount: sourceAppliedBlueprints.length,
      }
    } catch (error) {
      if (appliedBlueprintsReplaced) {
        await this.blueprintStoreService.replaceAppliedBlueprints(targetApp, previousAppliedBlueprints).catch(() => undefined)
      }
      if (importedConversationId) {
        await this.attachmentService.cleanupThread(targetOwner, importedConversationId).catch(() => undefined)
        await this.entityManager.getRepository(AiNocodeEditorMessageEntity).nativeDelete({ conversationId: importedConversationId }).catch(() => undefined)
        await this.entityManager.getRepository(AiNocodeEditorConversationEntity).nativeDelete({ id: importedConversationId }).catch(() => undefined)
      }
      await Promise.all(writtenPaths.map(path => rm(path, { force: true }).catch(() => undefined)))
      if (importedLogPath) await rm(importedLogPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  private async readAttachmentFile(attachment: AiThreadAttachmentEntity) {
    return (await this.attachmentService.read(attachment.ownerAccountId, attachment.threadId, attachment.id)).buffer
  }

  private async readDerivedFile(attachment: AiThreadAttachmentEntity) {
    const uploadsRoot = resolve(this.uploadsDir)
    const storagePath = resolve(uploadsRoot, attachment.storageKey)
    if (!storagePath.startsWith(`${uploadsRoot}${sep}`)) throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    const path = join(dirname(storagePath), '_derived', `${attachment.id}.txt`)
    return await readFile(path)
  }

  private async readAttachmentRecords(zip: JSZip) {
    const records: Array<{ record: JsonRecord; original: Buffer | null; derived: Buffer | null }> = []
    for (const name of Object.keys(zip.files)) {
      const match = name.match(/^attachments\/([^/]+)\/record\.json$/)
      if (!match) continue
      const record = await this.readJson<JsonRecord>(zip, name)
      const base = `attachments/${match[1]}`
      records.push({
        record,
        original: await this.readZipFile(zip, `${base}/original.bin`).catch(() => null),
        derived: await this.readZipFile(zip, `${base}/derived.txt`).catch(() => null),
      })
    }
    return records
  }

  private async readJson<T>(zip: JSZip, path: string) {
    const buffer = await this.readZipFile(zip, path)
    try { return JSON.parse(buffer.toString('utf8')) as T } catch { throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID') }
  }

  private async readZipFile(zip: JSZip, path: string) {
    const entry = zip.files[path]
    if (!entry || entry.dir) throw new NotFoundException('AI_CONVERSATION_PACKAGE_FILE_MISSING')
    return await entry.async('nodebuffer')
  }

  private assertSafeEntries(zip: JSZip) {
    let totalUncompressedSize = 0
    for (const name of Object.keys(zip.files)) {
      const normalized = name.replace(/\\/g, '/')
      const original = String((zip.files[name] as unknown as { unsafeOriginalName?: string }).unsafeOriginalName || normalized).replace(/\\/g, '/')
      if (
        !normalized
        || normalized.startsWith('/')
        || normalized.split('/').includes('..')
        || original.startsWith('/')
        || original.split('/').includes('..')
        || /^[a-z]:\//i.test(normalized)
        || /^[a-z]:\//i.test(original)
      ) {
        throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
      }
      const size = Number((zip.files[name] as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0)
      totalUncompressedSize += size
      if (totalUncompressedSize > MAX_PACKAGE_SIZE) throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
    }
  }

  private safeSegment(value: unknown) {
    const segment = String(value || '').trim()
    if (!segment || segment === '.' || segment === '..' || segment.includes('/') || segment.includes('\\')) {
      throw new BadRequestException('AI_CONVERSATION_PACKAGE_INVALID')
    }
    return segment
  }

  private mapAttachmentReferences(value: unknown, ids: Map<string, string>, attachmentContext = false): unknown {
    if (Array.isArray(value)) return value.map(item => this.mapAttachmentReferences(item, ids, attachmentContext))
    if (!value || typeof value !== 'object') {
      return attachmentContext && typeof value === 'string' ? ids.get(value) || value : value
    }
    const source = value as Record<string, unknown>
    const output: JsonRecord = {}
    for (const [key, item] of Object.entries(source)) {
      const nextContext = attachmentContext || /attachment/i.test(key) || key === 'remoteHandle'
      if (typeof item === 'string' && nextContext) {
        output[key] = ids.get(item) || item
      } else {
        output[key] = this.mapAttachmentReferences(item, ids, nextContext)
      }
    }
    return output
  }
}
