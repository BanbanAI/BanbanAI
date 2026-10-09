import { Entity, EntityRepository, Property } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import { PrimaryKey } from '@main/decorators/primary-key'

export type AiThreadAttachmentKind = 'image' | 'document' | 'spreadsheet' | 'archive' | 'audio' | 'text'
export type AiThreadAttachmentClassification = 'excel' | 'zip_excel_import_candidate' | 'generic_zip'
export type AiThreadAttachmentStatus = 'uploaded' | 'bound' | 'deleted'

@Entity({
  tableName: 'ai_thread_attachment',
  customRepository: () => AiThreadAttachmentRepository,
})
export class AiThreadAttachmentEntity {
  @PrimaryKey({ mongoLike: global.mongoLike, length: 24 })
    id: string = `att_${unique(20)}`

  @Property({ type: 'string' })
    threadId: string

  @Property({ type: 'string' })
    ownerAccountId: string

  @Property({ type: 'string' })
    originalName: string

  @Property({ type: 'string' })
    extension: string

  @Property({ type: 'string' })
    mimeType: string

  @Property({ type: 'number' })
    size: number

  @Property({ type: 'string' })
    kind: AiThreadAttachmentKind

  @Property({ nullable: true, type: 'string' })
    classification: AiThreadAttachmentClassification = null

  @Property({ type: 'string' })
    storageKey: string

  @Property({ type: 'string' })
    status: AiThreadAttachmentStatus = 'uploaded'

  @Property({ nullable: true, type: 'string' })
    boundMessageId: string = null

  @Property({ type: 'number', columnType: 'bigint' })
    createTime: number = Date.now()

  @Property({ type: 'number', columnType: 'bigint' })
    updateTime: number = Date.now()
}

export class AiThreadAttachmentRepository extends EntityRepository<AiThreadAttachmentEntity> {}
