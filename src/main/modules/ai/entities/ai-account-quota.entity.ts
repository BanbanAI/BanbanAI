import { Entity, EntityRepository, Property } from '@mikro-orm/core'
import { unique } from '@common/utils/unique'
import { PrimaryKey } from '@main/decorators/primary-key'

@Entity({
  tableName: 'ai_account_quota',
  customRepository: () => AiAccountQuotaRepository,
})
export class AiAccountQuota {
  @PrimaryKey({ mongoLike: global.mongoLike, length: 20 })
  id: string = unique(20)

  @Property({ nullable: true, type: 'string' })
  accountId: string

  @Property({ type: 'number', default: 0 })
  dailyTokenLimit: number = 0

  @Property({ type: 'number', default: 0 })
  monthlyTokenLimit: number = 0

  @Property({ type: 'number', default: 0 })
  dailyUsedTokens: number = 0

  @Property({ type: 'number', default: 0 })
  monthlyUsedTokens: number = 0

  @Property({ type: 'number', default: 0 })
  lifetimeUsedTokens: number = 0

  @Property({ nullable: true, type: 'string' })
  lastDailyResetAt: string = ''

  @Property({ nullable: true, type: 'string' })
  lastMonthlyResetAt: string = ''

  @Property({ nullable: true, type: 'boolean' })
  disabled: boolean = false

  @Property({ nullable: true, type: 'json' })
  metadata: Record<string, any> = null

  @Property({ type: 'number', columnType: 'bigint' })
  createTime: number = Date.now()

  @Property({ type: 'number', columnType: 'bigint' })
  updateTime: number = Date.now()
}

export class AiAccountQuotaRepository extends EntityRepository<AiAccountQuota> {
}
