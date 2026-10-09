import { BadRequestException, Inject, Injectable, NotFoundException, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common'
import { EntityManager } from '@mikro-orm/core'
import { createHash } from 'crypto'
import { TextDecoder } from 'util'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { basename, extname, join, resolve, sep } from 'path'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import pdf from 'pdf-parse'
import { createWorker } from 'tesseract.js'
import { UPLOADS_DIR } from '@main/constants'
import { AiAttachmentReference } from '@common/types/aiAttachment'
import {
  AI_ATTACHMENT_AUDIO_EXTENSIONS,
  AI_ATTACHMENT_IMAGE_EXTENSIONS,
  AI_ATTACHMENT_TEXT_EXTENSIONS,
  AI_ATTACHMENT_UPLOAD_EXTENSIONS,
} from '@common/utils/aiAttachmentFormats'
import { NocodeService } from '../../nocode/nocode.service'
import { AiThreadEntity } from '../entities'
import {
  AiThreadAttachmentClassification,
  AiThreadAttachmentEntity,
  AiThreadAttachmentKind,
} from '../entities/ai-thread-attachment.entity'
import {
  AI_ATTACHMENT_READ_DEFAULT_LIMIT,
  AI_ATTACHMENT_READ_MAX_LIMIT,
  type AiAttachmentReadBudget,
} from './ai-attachment-tool'

type UploadFile = {
  buffer?: Buffer
  originalname?: string
  mimetype?: string
  size?: number
}

type AttachmentStorageScope = {
  nocodeId?: string
}

type ProviderPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }

type AiOcrEngine = 'system' | 'tesseract'

const MAX_FILE_SIZE = 100 * 1024 * 1024
const MAX_ZIP_UNCOMPRESSED_SIZE = 200 * 1024 * 1024
const MAX_ZIP_ENTRIES = 200
const MAX_TEXT_LENGTH = 120_000
const MAX_ATTACHMENTS_PER_TURN = 5
const MAX_TURN_FILE_SIZE = 100 * 1024 * 1024
const STALE_UPLOAD_TTL = 24 * 60 * 60 * 1000
const CLEANUP_INTERVAL = 60 * 60 * 1000
const ALLOWED_EXTENSIONS = new Set(AI_ATTACHMENT_UPLOAD_EXTENSIONS)
const TEXT_EXTENSIONS = new Set(AI_ATTACHMENT_TEXT_EXTENSIONS)
const IMAGE_EXTENSIONS = new Set(AI_ATTACHMENT_IMAGE_EXTENSIONS)
const AUDIO_EXTENSIONS = new Set(AI_ATTACHMENT_AUDIO_EXTENSIONS)

@Injectable()
export class AiAttachmentService implements OnApplicationBootstrap, OnApplicationShutdown {
  private cleanupTimer?: ReturnType<typeof setInterval>
  private tesseractWorkerPromise?: ReturnType<typeof createWorker>
  private tesseractQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly entityManager: EntityManager,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
    private readonly nocodeService: NocodeService,
  ) {}

  onApplicationBootstrap() {
    void this.cleanupStaleUploads()
    this.cleanupTimer = setInterval(() => void this.cleanupStaleUploads(), CLEANUP_INTERVAL)
    ;(this.cleanupTimer as unknown as { unref?: () => void }).unref?.()
  }

  async onApplicationShutdown() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    await this.tesseractQueue.catch(() => undefined)
    await this.disposeTesseractWorker()
  }

  async upload(ownerAccountId: string, threadId: string, file: UploadFile, storageScope?: AttachmentStorageScope) {
    const buffer = file?.buffer
    if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
      throw new BadRequestException('AI_ATTACHMENT_UPLOAD_FAILED')
    }

    const originalName = this.normalizeName(file.originalname)
    const extension = this.resolveExtension(originalName)
    const size = buffer.length
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    }
    if (size > this.resolveMaxFileSize(extension)) {
      throw new BadRequestException('AI_ATTACHMENT_LIMIT_EXCEEDED')
    }
    this.assertDeclaredMimeType(extension, file.mimetype)
    this.assertFileSignature(extension, buffer)
    await this.assertOpenXmlPackage(extension, buffer)

    const classification = extension === 'zip'
      ? await this.classifyZip(buffer)
      : extension === 'xls' || extension === 'xlsx'
        ? 'excel'
        : null
    const id = `att_${createHash('sha256').update(`${threadId}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 20)}`
    const threadRoot = this.resolveThreadRoot(threadId, storageScope?.nocodeId)
    const storageKey = storageScope?.nocodeId
      ? join(this.normalizeStorageSegment(storageScope.nocodeId), '_ai', this.normalizeStorageSegment(threadId), `${id}.${extension}`)
      : join('_ai', this.normalizeStorageSegment(threadId), `${id}.${extension}`)
    const filePath = this.resolveStoragePath(storageKey, threadId)
    await mkdir(threadRoot, { recursive: true })
    await writeFile(filePath, buffer, { flag: 'wx' })

    const entity = new AiThreadAttachmentEntity()
    entity.id = id
    entity.threadId = threadId
    entity.ownerAccountId = ownerAccountId
    entity.originalName = originalName
    entity.extension = extension
    entity.mimeType = this.resolveMimeType(extension)
    entity.size = size
    entity.kind = this.resolveKind(extension)
    entity.classification = classification
    entity.storageKey = storageKey.replace(/\\/g, '/')
    entity.status = 'uploaded'
    entity.createTime = Date.now()
    entity.updateTime = entity.createTime
    try {
      await this.entityManager.persistAndFlush(entity)
    } catch (error) {
      await rm(filePath, { force: true }).catch(() => undefined)
      throw error
    }
    return this.toReference(entity)
  }

  async delete(ownerAccountId: string, threadId: string, attachmentId: string) {
    const entity = await this.getOwnerAttachment(ownerAccountId, threadId, attachmentId)
    if (entity.status === 'bound') {
      throw new BadRequestException('AI_ATTACHMENT_ACCESS_DENIED')
    }
    await rm(this.resolveStoragePath(entity.storageKey, threadId), { force: true })
    await rm(join(this.resolveEntityRoot(entity), '_derived', `${entity.id}.txt`), { force: true })
      .catch(() => undefined)
    await this.entityManager.getRepository(AiThreadAttachmentEntity).nativeDelete({ id: entity.id })
    return { id: entity.id, deleted: true }
  }

  async read(ownerAccountId: string, threadId: string, attachmentId: string) {
    const entity = await this.getOwnerAttachment(ownerAccountId, threadId, attachmentId)
    if (entity.status === 'deleted') {
      throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    }
    const path = this.resolveStoragePath(entity.storageKey, threadId)
    const buffer = await readFile(path).catch(() => null)
    if (!buffer) {
      throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    }
    return { entity, buffer }
  }

  async listAccessibleReferences(ownerAccountId: string, threadId: string, references: unknown) {
    const ids = [...new Set((Array.isArray(references) ? references : [])
      .map(item => this.resolveReferenceId(item))
      .filter(Boolean))]
    if (!ids.length) return []

    const entities = await this.entityManager.getRepository(AiThreadAttachmentEntity).find({
      id: { $in: ids },
      threadId,
      ownerAccountId,
      status: { $in: ['uploaded', 'bound'] },
    })
    const entitiesById = new Map(entities.map(entity => [entity.id, entity]))
    return ids
      .map(id => entitiesById.get(id))
      .filter((entity): entity is AiThreadAttachmentEntity => Boolean(entity))
      .map(entity => this.toReference(entity))
  }

  async readForModel(
    ownerAccountId: string,
    threadId: string,
    input: Record<string, unknown>,
    budget: AiAttachmentReadBudget,
  ) {
    const attachmentId = String(input?.attachmentId || '').trim()
    if (!attachmentId) {
      throw new BadRequestException('AI_ATTACHMENT_NOT_FOUND')
    }
    const offset = this.normalizeReadOffset(input?.offset)
    const requestedLimit = this.normalizeReadLimit(input?.limit)
    const remainingBudget = Math.max(0, MAX_TEXT_LENGTH - budget.totalTextLength)
    if (!remainingBudget) {
      throw new BadRequestException('AI_ATTACHMENT_CONTEXT_LIMIT_EXCEEDED')
    }

    const { entity, buffer } = await this.read(ownerAccountId, threadId, attachmentId)
    if (entity.kind === 'audio') {
      throw new BadRequestException('AI_ATTACHMENT_MODEL_UNSUPPORTED')
    }
    const text = entity.kind === 'image'
      ? await this.readOrCreateOcrText(entity)
      : await this.readOrCreateDerivedText(entity, buffer)
    const limit = Math.min(requestedLimit, remainingBudget)
    const content = text.slice(offset, offset + limit)
    budget.totalTextLength += content.length
    const nextOffset = offset + content.length
    const truncated = nextOffset < text.length

    return {
      attachmentId: entity.id,
      name: entity.originalName,
      content,
      totalTextLength: text.length,
      offset,
      nextOffset: truncated ? nextOffset : null,
      truncated,
      untrusted: true,
    }
  }

  async prepareProviderParts(
    ownerAccountId: string,
    threadId: string,
    references: unknown,
    useNativeImageInput: boolean,
    requestBudget: { totalSize: number; totalTextLength: number } = {
      totalSize: 0,
      totalTextLength: 0,
    },
  ): Promise<ProviderPart[]> {
    const refs = Array.isArray(references) ? references : []
    if (!refs.length || refs.length > MAX_ATTACHMENTS_PER_TURN) {
      throw new BadRequestException('AI_ATTACHMENT_LIMIT_EXCEEDED')
    }
    const parts: ProviderPart[] = []
    for (const ref of refs) {
      const attachmentId = this.resolveReferenceId(ref)
      if (!attachmentId) {
        throw new BadRequestException('AI_ATTACHMENT_NOT_FOUND')
      }
      const { entity, buffer } = await this.read(ownerAccountId, threadId, attachmentId)
      requestBudget.totalSize += entity.size
      if (requestBudget.totalSize > MAX_TURN_FILE_SIZE) {
        throw new BadRequestException('AI_ATTACHMENT_LIMIT_EXCEEDED')
      }
      const extracted = await this.prepareAttachment(entity, buffer, useNativeImageInput)
      requestBudget.totalTextLength += extracted.reduce((total, part) => (
        part.type === 'text' ? total + part.text.length : total
      ), 0)
      if (requestBudget.totalTextLength > MAX_TEXT_LENGTH) {
        throw new BadRequestException('AI_ATTACHMENT_CONTEXT_LIMIT_EXCEEDED')
      }
      parts.push(...extracted)
    }
    return parts
  }

  async bind(ownerAccountId: string, threadId: string, references: unknown, messageId: string) {
    const ids = [...new Set((Array.isArray(references) ? references : [])
      .map(item => this.resolveReferenceId(item))
      .filter(Boolean))]
    if (!ids.length) return
    const repository = this.entityManager.getRepository(AiThreadAttachmentEntity)
    const entities = await repository.find({
      id: { $in: ids },
      threadId,
      ownerAccountId,
      status: { $in: ['uploaded', 'bound'] },
    })
    if (entities.length !== ids.length) {
      throw new BadRequestException('AI_ATTACHMENT_NOT_FOUND')
    }
    const now = Date.now()
    entities.filter(entity => entity.status === 'uploaded').forEach(entity => {
      entity.status = 'bound'
      entity.boundMessageId = messageId
      entity.updateTime = now
    })
    await this.entityManager.persistAndFlush(entities)
  }

  toReference(entity: AiThreadAttachmentEntity): AiAttachmentReference {
    return {
      id: entity.id,
      name: entity.originalName,
      kind: entity.kind === 'spreadsheet'
        ? 'excel'
        : entity.kind === 'archive' && entity.classification === 'zip_excel_import_candidate'
          ? 'excel'
          : entity.kind,
      mimeType: entity.mimeType,
      size: entity.size,
      extension: entity.extension,
      ...(entity.classification ? { classification: entity.classification } : {}),
      remoteHandle: { attachmentId: entity.id },
    }
  }

  async createImportSession(ownerAccountId: string, threadId: string, attachmentId: string) {
    const entity = await this.getOwnerAttachment(ownerAccountId, threadId, attachmentId)
    if (!['excel', 'zip_excel_import_candidate'].includes(String(entity.classification || ''))) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    }
    return await this.nocodeService.createImportSessionFromTrustedSource(
      this.resolveStoragePath(entity.storageKey, threadId),
      { filename: entity.originalName },
    )
  }

  async cleanupThread(ownerAccountId: string, threadId: string) {
    const repository = this.entityManager.getRepository(AiThreadAttachmentEntity)
    const entities = await repository.find({ ownerAccountId, threadId })
    const roots = new Set(entities.map(entity => this.resolveEntityRoot(entity)))
    if (!roots.size) roots.add(this.resolveThreadRoot(threadId))
    const removed = (await Promise.all([...roots].map(root => (
      rm(root, { recursive: true, force: true }).then(() => true).catch(() => false)
    )))).every(Boolean)
    if (!removed) return { cleaned: false }
    if (entities.length) {
      await repository.nativeDelete({ id: { $in: entities.map(entity => entity.id) } })
    }
    return { cleaned: true }
  }

  async cleanupNocodeEditorAppStorage(nocodeId: string) {
    const normalizedNocodeId = this.normalizeStorageSegment(nocodeId)
    const appRoot = resolve(this.uploadsDir, normalizedNocodeId)
    const aiRoot = resolve(appRoot, '_ai')
    if (!aiRoot.startsWith(`${appRoot}${sep}`)) {
      throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    }
    return await rm(aiRoot, { recursive: true, force: true })
      .then(() => ({ cleaned: true }))
      .catch(() => ({ cleaned: false }))
  }

  private async prepareAttachment(
    entity: AiThreadAttachmentEntity,
    buffer: Buffer,
    useNativeImageInput: boolean,
  ): Promise<ProviderPart[]> {
    if (entity.kind === 'image') {
      if (useNativeImageInput) {
        return [{
          type: 'image_url',
          image_url: {
            url: `data:${entity.mimeType};base64,${buffer.toString('base64')}`,
            detail: 'auto',
          },
        }]
      }
      const text = await this.readOrCreateOcrText(entity)
      return [{ type: 'text', text: this.wrapAttachmentText(entity, text) }]
    }

    if (entity.kind === 'audio') {
      throw new BadRequestException('AI_ATTACHMENT_MODEL_UNSUPPORTED')
    }

    if (entity.extension === 'zip') {
      return [{ type: 'text', text: this.wrapAttachmentText(entity, await this.readOrCreateDerivedText(entity, buffer)) }]
    }

    const text = await this.readOrCreateDerivedText(entity, buffer)
    return [{ type: 'text', text: this.wrapAttachmentText(entity, text) }]
  }

  private async extractZipText(buffer: Buffer) {
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: false }).catch(() => {
      throw new BadRequestException('AI_ATTACHMENT_ARCHIVE_UNSAFE')
    })
    const entries = this.assertSafeZipEntries(zip)
    const readable: string[] = []
    let totalSize = 0
    for (const entry of entries) {
      const name = String(entry.name || '').replace(/\\/g, '/')
      if (entry.dir) continue
      if (name.toLowerCase().endsWith('.zip')) continue
      const ext = this.resolveExtension(name)
      const data = await entry.async('nodebuffer').catch(() => {
        throw new BadRequestException('AI_ATTACHMENT_ARCHIVE_UNSAFE')
      })
      totalSize += data.length
      if (totalSize > MAX_ZIP_UNCOMPRESSED_SIZE) {
        throw new BadRequestException('AI_ATTACHMENT_ARCHIVE_UNSAFE')
      }
      if (!ext || (!TEXT_EXTENSIONS.has(ext) && !['xls', 'xlsx', 'docx', 'pptx', 'pdf'].includes(ext))) continue
      this.assertFileSignature(ext, data)
      await this.assertOpenXmlPackage(ext, data)
      const text = await this.extractText(ext, data)
      if (text.trim()) readable.push(`文件：${name}\n${text}`)
    }
    if (!readable.length) {
      throw new BadRequestException('AI_ATTACHMENT_PARSE_FAILED')
    }
    return readable.join('\n\n')
  }

  private async extractText(extension: string, buffer: Buffer): Promise<string> {
    const isXlsxContent = extension === 'xlsx'
      || (extension === 'csv' && buffer.subarray(0, 4).toString('ascii') === 'PK\u0003\u0004')
    if (extension === 'xls' || isXlsxContent) {
      if (extension === 'csv') await this.assertOpenXmlPackage('xlsx', buffer)
      if (isXlsxContent) await this.assertSafeOfficeArchive(buffer)
      const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
      const sheets = workbook.SheetNames.map(name => {
        const sheet = workbook.Sheets[name]
        return `工作表：${name}\n${XLSX.utils.sheet_to_csv(sheet)}`
      })
      return this.assertTextLength(sheets.join('\n\n'))
    }
    if (TEXT_EXTENSIONS.has(extension)) {
      return this.assertTextLength(this.decodeText(buffer))
    }
    if (extension === 'docx') {
      const zip = await JSZip.loadAsync(buffer, { checkCRC32: false })
      this.assertSafeZipEntries(zip)
      const names = Object.keys(zip.files).filter(name => (
        name === 'word/document.xml'
        || /^word\/(header|footer)\d+\.xml$/i.test(name)
      ))
      const xml = (await Promise.all(names.map(name => zip.files[name].async('text')))).join('\n')
      const text = this.stripXml(xml)
      if (!text) throw new BadRequestException('AI_ATTACHMENT_PARSE_FAILED')
      return this.assertTextLength(text)
    }
    if (extension === 'pptx') {
      const zip = await JSZip.loadAsync(buffer, { checkCRC32: false })
      this.assertSafeZipEntries(zip)
      const names = Object.keys(zip.files)
        .filter(name => /^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/i.test(name))
        .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
      const pages = await Promise.all(names.map(async name => `${name}\n${this.stripXml(await zip.files[name].async('text'))}`))
      const text = pages.filter(Boolean).join('\n\n')
      if (!text.trim()) throw new BadRequestException('AI_ATTACHMENT_PARSE_FAILED')
      return this.assertTextLength(text)
    }
    if (extension === 'pdf') {
      const result = await pdf(buffer).catch(() => null)
      const text = String(result?.text || '').trim()
      if (!text.trim()) throw new BadRequestException('AI_ATTACHMENT_PARSE_FAILED')
      return this.assertTextLength(text)
    }
    if (extension === 'doc' || extension === 'ppt') {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    }
    throw new BadRequestException('AI_ATTACHMENT_PARSE_FAILED')
  }

  private async ocrImage(entity: AiThreadAttachmentEntity) {
    const filePath = this.resolveStoragePath(entity.storageKey, entity.threadId)
    for (const engine of this.resolveOcrEngineOrder()) {
      let text = ''
      try {
        text = engine === 'system'
          ? await this.runSystemOcr(filePath)
          : await this.runTesseractOcr(filePath)
      } catch {
        continue
      }
      if (text.trim()) {
        return this.assertTextLength(text)
      }
    }
    throw new BadRequestException('AI_ATTACHMENT_OCR_UNAVAILABLE')
  }

  private resolveOcrEngineOrder(): AiOcrEngine[] {
    return process.platform === 'win32' || process.platform === 'darwin'
      ? ['system', 'tesseract']
      : ['tesseract']
  }

  private async runSystemOcr(filePath: string) {
    const { OcrAccuracy, recognize } = await import('@napi-rs/system-ocr')
    const preferredLanguages = process.platform === 'win32'
      ? ['zh-CN', 'en-US']
      : ['zh-Hans', 'zh-Hant', 'en-US']
    const result = await recognize(filePath, OcrAccuracy.Accurate, preferredLanguages)
    return String(result.text || '').trim()
  }

  private async runTesseractOcr(filePath: string) {
    const task = this.tesseractQueue.then(async () => {
      const worker = await this.getTesseractWorker()
      try {
        const result = await worker.recognize(filePath)
        return String(result.data.text || '').trim()
      } catch (error) {
        await this.disposeTesseractWorker()
        throw error
      }
    })
    this.tesseractQueue = task.then(() => undefined, () => undefined)
    return await task
  }

  private async getTesseractWorker() {
    if (!this.tesseractWorkerPromise) {
      const cachePath = join(this.uploadsDir, '_ai', '_ocr-cache')
      await mkdir(cachePath, { recursive: true })
      const workerPromise = createWorker(['chi_sim', 'chi_tra', 'eng'], undefined, { cachePath })
      this.tesseractWorkerPromise = workerPromise
      void workerPromise.catch(() => {
        if (this.tesseractWorkerPromise === workerPromise) {
          this.tesseractWorkerPromise = undefined
        }
      })
    }
    return await this.tesseractWorkerPromise
  }

  private async disposeTesseractWorker() {
    const workerPromise = this.tesseractWorkerPromise
    this.tesseractWorkerPromise = undefined
    if (!workerPromise) return
    const worker = await workerPromise.catch(() => null)
    await worker?.terminate().catch(() => undefined)
  }

  private async readOrCreateOcrText(entity: AiThreadAttachmentEntity) {
    const root = this.resolveEntityRoot(entity)
    const derivedPath = join(root, '_derived', `${entity.id}.txt`)
    const cached = await readFile(derivedPath, 'utf8').catch(() => '')
    if (cached) return this.assertTextLength(cached)
    const text = await this.ocrImage(entity)
    await mkdir(join(root, '_derived'), { recursive: true })
    await writeFile(derivedPath, text, { flag: 'wx' }).catch(() => undefined)
    return text
  }

  private async assertSafeOfficeArchive(buffer: Buffer) {
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: false }).catch(() => {
      throw new BadRequestException('AI_ATTACHMENT_ARCHIVE_UNSAFE')
    })
    this.assertSafeZipEntries(zip)
  }

  private async assertOpenXmlPackage(extension: string, buffer: Buffer) {
    const requiredEntryByExtension: Record<string, string> = {
      docx: 'word/document.xml',
      xlsx: 'xl/workbook.xml',
      pptx: 'ppt/presentation.xml',
    }
    const requiredEntry = requiredEntryByExtension[extension]
    if (!requiredEntry) return

    const zip = await JSZip.loadAsync(buffer, { checkCRC32: false }).catch(() => null)
    if (!zip || !zip.file(requiredEntry)) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    }
  }

  private async classifyZip(buffer: Buffer): Promise<AiThreadAttachmentClassification> {
    const zip = await JSZip.loadAsync(buffer, { checkCRC32: false }).catch(() => {
      throw new BadRequestException('AI_ATTACHMENT_ARCHIVE_UNSAFE')
    })
    const files = this.assertSafeZipEntries(zip)
      .filter(item => !item.dir)
      .map(item => String(item.name || '').replace(/\\/g, '/'))
    const excelFiles = files.filter(name => ['xls', 'xlsx'].includes(this.resolveExtension(name)))
    if (excelFiles.length === 1 || (excelFiles.length > 1 && excelFiles.filter(name => !name.includes('/')).length === 1)) {
      return 'zip_excel_import_candidate'
    }
    return 'generic_zip'
  }

  private resolveStoragePath(storageKey: string, threadId: string) {
    const root = this.resolveStorageRoot(storageKey, threadId)
    const target = resolve(this.uploadsDir, storageKey)
    const prefix = `${root}${sep}`
    if (!target.startsWith(prefix)) {
      throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    }
    return target
  }

  private resolveStorageRoot(storageKey: string, threadId: string) {
    const normalizedThreadId = this.normalizeStorageSegment(threadId)
    const parts = String(storageKey || '').replace(/\\/g, '/').split('/').filter(Boolean)
    const isWorkbenchPath = parts.length === 3
      && parts[0] === '_ai'
      && parts[1] === normalizedThreadId
    const isNocodePath = parts.length === 4
      && parts[1] === '_ai'
      && parts[2] === normalizedThreadId
    if (!isWorkbenchPath && !isNocodePath) {
      throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    }
    const rootParts = isWorkbenchPath ? parts.slice(0, 2) : parts.slice(0, 3)
    rootParts.forEach(part => this.normalizeStorageSegment(part))
    const uploadsRoot = resolve(this.uploadsDir)
    const root = resolve(uploadsRoot, ...rootParts)
    if (!root.startsWith(`${uploadsRoot}${sep}`)) {
      throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    }
    return root
  }

  private resolveEntityRoot(entity: AiThreadAttachmentEntity) {
    return this.resolveStorageRoot(entity.storageKey, entity.threadId)
  }

  private async getOwnerAttachment(ownerAccountId: string, threadId: string, attachmentId: string) {
    const entity = await this.entityManager.getRepository(AiThreadAttachmentEntity).findOne({
      id: String(attachmentId || '').trim(),
      threadId,
      ownerAccountId,
    })
    if (!entity) throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    return entity
  }

  private resolveExtension(name: string) {
    return extname(name).slice(1).toLowerCase()
  }

  private normalizeName(name?: string) {
    const rawName = String(name || '').trim()
    const utf8Name = Buffer.from(rawName, 'latin1').toString('utf8')
    const decodedName = utf8Name.includes('\uFFFD') ? rawName : utf8Name
    const value = [...basename(decodedName)]
      .filter(character => character.charCodeAt(0) >= 32)
      .join('')
    return value.slice(0, 255) || 'attachment'
  }

  private resolveKind(extension: string): AiThreadAttachmentKind {
    if (IMAGE_EXTENSIONS.has(extension)) return 'image'
    if (AUDIO_EXTENSIONS.has(extension)) return 'audio'
    if (extension === 'zip') return 'archive'
    if (extension === 'xls' || extension === 'xlsx') return 'spreadsheet'
    if (TEXT_EXTENSIONS.has(extension)) return 'text'
    return 'document'
  }

  private resolveMimeType(extension: string) {
    const values: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp',
      pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown',
      csv: 'text/csv', json: 'application/json', xml: 'application/xml', yaml: 'text/yaml', yml: 'text/yaml', log: 'text/plain', html: 'text/html',
      doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac', ogg: 'audio/ogg',
    }
    return values[extension] || 'application/octet-stream'
  }

  private assertFileSignature(extension: string, buffer: Buffer) {
    const isZip = buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'PK\u0003\u0004'
    const isPdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    const isJpeg = buffer.subarray(0, 2).toString('hex') === 'ffd8'
    const isPng = buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a'
    const imageHeader = buffer.subarray(0, 12).toString('ascii')
    const isGif = imageHeader.startsWith('GIF87a') || imageHeader.startsWith('GIF89a')
    const isWebp = imageHeader.startsWith('RIFF') && imageHeader.slice(8, 12) === 'WEBP'
    const isBmp = imageHeader.startsWith('BM')
    const isOle = buffer.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1'
    const audioHeader = buffer.subarray(0, 12).toString('ascii')
    const isMp3 = audioHeader.startsWith('ID3') || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
    const isWav = audioHeader.startsWith('RIFF') && audioHeader.slice(8, 12) === 'WAVE'
    const isMp4Audio = buffer.length >= 12 && audioHeader.slice(4, 8) === 'ftyp'
    const isAac = audioHeader.startsWith('ADIF') || (buffer[0] === 0xff && (buffer[1] & 0xf6) === 0xf0)
    const isFlac = audioHeader.startsWith('fLaC')
    const isOgg = audioHeader.startsWith('OggS')
    if (extension === 'zip' || ['docx', 'xlsx', 'pptx'].includes(extension)) {
      if (!isZip) throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'pdf' && !isPdf) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (['jpg', 'jpeg'].includes(extension) && !isJpeg) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'png' && !isPng) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'gif' && !isGif) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'webp' && !isWebp) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'bmp' && !isBmp) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (['doc', 'xls', 'ppt'].includes(extension) && !isOle) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'mp3' && !isMp3) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'wav' && !isWav) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'm4a' && !isMp4Audio) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'aac' && !isAac && !isMp4Audio) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'flac' && !isFlac) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    } else if (extension === 'ogg' && !isOgg) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    }
  }

  private assertDeclaredMimeType(extension: string, mimeType?: string) {
    const normalizedMimeType = String(mimeType || '').split(';')[0].trim().toLowerCase()
    if (!normalizedMimeType || normalizedMimeType === 'application/octet-stream') return

    const aliases: Record<string, string[]> = {
      jpg: ['image/pjpeg'],
      jpeg: ['image/pjpeg'],
      bmp: ['image/x-ms-bmp'],
      md: ['text/plain', 'text/x-markdown'],
      markdown: ['text/plain', 'text/x-markdown'],
      csv: ['text/plain', 'application/csv', 'application/vnd.ms-excel'],
      json: ['text/plain'],
      xml: ['text/plain', 'text/xml'],
      yaml: ['text/plain', 'text/x-yaml', 'application/yaml', 'application/x-yaml'],
      yml: ['text/plain', 'text/x-yaml', 'application/yaml', 'application/x-yaml'],
      html: ['application/xhtml+xml'],
      zip: ['application/x-zip-compressed', 'multipart/x-zip'],
      doc: ['application/vnd.ms-word'],
      ppt: ['application/mspowerpoint', 'application/x-mspowerpoint'],
      wav: ['audio/x-wav'],
      m4a: ['audio/x-m4a'],
      flac: ['audio/x-flac'],
    }
    const allowedMimeTypes = new Set([
      this.resolveMimeType(extension),
      ...(aliases[extension] || []),
    ])
    if (!allowedMimeTypes.has(normalizedMimeType)) {
      throw new BadRequestException('AI_ATTACHMENT_TYPE_UNSUPPORTED')
    }
  }

  private wrapAttachmentText(entity: AiThreadAttachmentEntity, text: string) {
    return [`--- 附件开始：${entity.originalName} ---`, this.assertTextLength(text), `--- 附件结束：${entity.originalName} ---`].join('\n')
  }

  private assertTextLength(text: string) {
    const normalized = String(text || '').split(String.fromCharCode(0)).join('').trim()
    if (normalized.length > MAX_TEXT_LENGTH) {
      throw new BadRequestException('AI_ATTACHMENT_CONTEXT_LIMIT_EXCEEDED')
    }
    return normalized
  }

  private stripXml(xml: string) {
    return String(xml || '')
      .replace(/<w:tab\s*\/?/gi, '\t')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private resolveReferenceId(value: unknown) {
    const raw = value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {}
    const remoteHandle = raw.remoteHandle && typeof raw.remoteHandle === 'object' && !Array.isArray(raw.remoteHandle)
      ? raw.remoteHandle as Record<string, unknown>
      : {}
    return String(remoteHandle.attachmentId || raw.id || '').trim()
  }

  private normalizeReadOffset(value: unknown) {
    const offset = Number(value ?? 0)
    if (!Number.isFinite(offset) || offset < 0 || !Number.isInteger(offset)) {
      throw new BadRequestException('AI_ATTACHMENT_READ_RANGE_INVALID')
    }
    return offset
  }

  private normalizeReadLimit(value: unknown) {
    const limit = Number(value ?? AI_ATTACHMENT_READ_DEFAULT_LIMIT)
    if (!Number.isFinite(limit) || limit < 1 || !Number.isInteger(limit)) {
      throw new BadRequestException('AI_ATTACHMENT_READ_RANGE_INVALID')
    }
    return Math.min(limit, AI_ATTACHMENT_READ_MAX_LIMIT)
  }

  private resolveMaxFileSize(extension: string) {
    if (extension === 'zip') return MAX_FILE_SIZE
    if (IMAGE_EXTENSIONS.has(extension)) return 20 * 1024 * 1024
    return 50 * 1024 * 1024
  }

  private resolveThreadRoot(threadId: string, nocodeId?: string) {
    const normalizedThreadId = this.normalizeStorageSegment(threadId)
    const aiRoot = nocodeId
      ? resolve(this.uploadsDir, this.normalizeStorageSegment(nocodeId), '_ai')
      : resolve(this.uploadsDir, '_ai')
    const root = resolve(aiRoot, normalizedThreadId)
    if (!root.startsWith(`${aiRoot}${sep}`)) {
      throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    }
    return root
  }

  private normalizeStorageSegment(value: string) {
    const normalized = String(value || '').trim()
    if (
      !normalized
      || normalized === '.'
      || normalized === '..'
      || normalized.includes('/')
      || normalized.includes('\\')
      || [...normalized].some(character => character.charCodeAt(0) < 32)
    ) {
      throw new NotFoundException('AI_ATTACHMENT_NOT_FOUND')
    }
    return normalized
  }

  private assertSafeZipEntries(zip: JSZip) {
    const entries = Object.values(zip.files)
    if (entries.length > MAX_ZIP_ENTRIES) {
      throw new BadRequestException('AI_ATTACHMENT_ARCHIVE_UNSAFE')
    }
    let totalUncompressedSize = 0
    for (const entry of entries) {
      const originalName = String((entry as unknown as { unsafeOriginalName?: string }).unsafeOriginalName || entry.name || '')
        .replace(/\\/g, '/')
      const name = String(entry.name || '').replace(/\\/g, '/')
      const unixPermissions = typeof entry.unixPermissions === 'number'
        ? entry.unixPermissions
        : Number.parseInt(String(entry.unixPermissions || ''), 8)
      if (
        !name
        || originalName.startsWith('/')
        || /^[a-z]:\//i.test(originalName)
        || originalName.split('/').includes('..')
        || (Number.isFinite(unixPermissions) && (unixPermissions & 0o170000) !== 0 && (unixPermissions & 0o170000) !== 0o100000 && (unixPermissions & 0o170000) !== 0o040000)
      ) {
        throw new BadRequestException('AI_ATTACHMENT_ARCHIVE_UNSAFE')
      }
      const internalData = (entry as unknown as {
        _data?: { compressedSize?: number; uncompressedSize?: number }
      })._data
      const compressedSize = Number(internalData?.compressedSize || 0)
      const uncompressedSize = Number(internalData?.uncompressedSize || 0)
      totalUncompressedSize += uncompressedSize
      if (totalUncompressedSize > MAX_ZIP_UNCOMPRESSED_SIZE) {
        throw new BadRequestException('AI_ATTACHMENT_ARCHIVE_UNSAFE')
      }
      if (compressedSize > 0 && uncompressedSize / compressedSize > 100) {
        throw new BadRequestException('AI_ATTACHMENT_ARCHIVE_UNSAFE')
      }
    }
    return entries
  }

  private decodeText(buffer: Buffer) {
    if (!buffer.length) throw new BadRequestException('AI_ATTACHMENT_PARSE_FAILED')
    const sample = buffer.subarray(0, Math.min(buffer.length, 8192))
    const controlBytes = [...sample].filter(value => value === 0 || (value < 9) || (value > 13 && value < 32)).length
    if (controlBytes / sample.length > 0.1) {
      const isUtf16 = buffer[0] === 0xff && buffer[1] === 0xfe
      const isUtf16Be = buffer[0] === 0xfe && buffer[1] === 0xff
      if (!isUtf16 && !isUtf16Be) throw new BadRequestException('AI_ATTACHMENT_PARSE_FAILED')
    }
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le')
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      const content = Buffer.from(buffer.subarray(2))
      for (let index = 0; index + 1 < content.length; index += 2) {
        const first = content[index]
        content[index] = content[index + 1]
        content[index + 1] = first
      }
      return content.toString('utf16le')
    }
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '')
    } catch {
      try {
        return new TextDecoder('gb18030', { fatal: true }).decode(buffer)
      } catch {
        throw new BadRequestException('AI_ATTACHMENT_PARSE_FAILED')
      }
    }
  }

  private async readOrCreateDerivedText(entity: AiThreadAttachmentEntity, buffer: Buffer) {
    const root = this.resolveEntityRoot(entity)
    const derivedPath = join(root, '_derived', `${entity.id}.txt`)
    const cached = await readFile(derivedPath, 'utf8').catch(() => '')
    if (cached) return this.assertTextLength(cached)
    const text = entity.extension === 'zip'
      ? await this.extractZipText(buffer)
      : await this.extractText(entity.extension, buffer)
    await mkdir(join(root, '_derived'), { recursive: true })
    await writeFile(derivedPath, text, { flag: 'wx' }).catch(() => undefined)
    return text
  }

  private async cleanupStaleUploads() {
    const repository = this.entityManager.getRepository(AiThreadAttachmentEntity)
    const cleanupCandidates = await repository.find({
      status: { $ne: 'deleted' },
    }).catch(() => [])
    const candidateThreadIds = [...new Set(cleanupCandidates.map(entity => entity.threadId))]
    const deletedThreads = candidateThreadIds.length
      ? await this.entityManager.getRepository(AiThreadEntity).find({
        id: { $in: candidateThreadIds },
        deleteTime: { $ne: null },
      }).catch(() => [])
      : []
    for (const thread of deletedThreads) {
      await this.cleanupThread(thread.ownerAccountId, thread.id)
    }

    const stale = await repository.find({
      status: 'uploaded',
      updateTime: { $lt: Date.now() - STALE_UPLOAD_TTL },
    }).catch(() => [])
    if (!stale.length) return
    const removedIds: string[] = []
    for (const entity of stale) {
      const removed = await rm(this.resolveStoragePath(entity.storageKey, entity.threadId), { force: true })
        .then(() => true)
        .catch(() => false)
      if (removed) {
        await rm(join(this.resolveEntityRoot(entity), '_derived', `${entity.id}.txt`), { force: true })
          .catch(() => undefined)
        removedIds.push(entity.id)
      }
    }
    if (removedIds.length) await repository.nativeDelete({ id: { $in: removedIds } })
  }
}
