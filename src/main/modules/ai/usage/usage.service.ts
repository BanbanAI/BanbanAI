import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import dayjs from 'dayjs'
import { AiAccountQuota, AiAccountQuotaRepository, AiUsageRecord, AiUsageRecordRepository } from '../entities'

type RecordUsageOptions = {
  accountId: string
  agentId?: string | null
  visitorId?: string | null
  channel?: string
  conversationId?: string
  messageId?: string
  provider: string
  model: string
  scope?: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  quotaCost?: number
  metadata?: Record<string, any>
}

@Injectable()
export class AiUsageService {
  private readonly usageRepository: AiUsageRecordRepository
  private readonly quotaRepository: AiAccountQuotaRepository

  constructor(
    private readonly entityManager: EntityManager,
  ) {
    this.usageRepository = this.entityManager.getRepository(AiUsageRecord)
    this.quotaRepository = this.entityManager.getRepository(AiAccountQuota)
  }

  async getQuota(accountId: string) {
    const quota = await this.getOrCreateQuota(accountId)
    await this.syncQuotaWindow(quota)
    return quota
  }

  /**
   * 当前本地端仍然保留额度校验，便于桌面端第一时间反馈用户。
   * 但真正的计费口径与最终额度判定，后续仍应该以云端 relay 返回为准。
   */
  async assertCanChat(accountId: string) {
    const quota = await this.getQuota(accountId)
    if (quota.disabled) {
      throw new Error(global.i18next.t('aiUsageService.accountDisabled'))
    }
    if (quota.dailyTokenLimit > 0 && quota.dailyUsedTokens >= quota.dailyTokenLimit) {
      throw new Error(global.i18next.t('aiUsageService.dailyTokenLimitReached'))
    }
    if (quota.monthlyTokenLimit > 0 && quota.monthlyUsedTokens >= quota.monthlyTokenLimit) {
      throw new Error(global.i18next.t('aiUsageService.monthlyTokenLimitReached'))
    }
    return quota
  }

  /**
   * 本地 usage 记录更像“镜像账本”：
   * - 方便桌面端快速展示最近消耗
   * - 方便排查某次对话走了多少轮动作
   * - 但如果云端有更精确的 token usage，应以云端结果回写或对账
   */
  async recordUsage(options: RecordUsageOptions) {
    const quota = await this.getQuota(options.accountId)
    const totalTokens = this.normalizeValue(options.totalTokens ?? ((options.inputTokens || 0) + (options.outputTokens || 0)))
    const quotaCost = this.normalizeValue(options.quotaCost ?? totalTokens)

    const usage = new AiUsageRecord()
    usage.accountId = options.accountId
    usage.agentId = options.agentId ?? null
    usage.visitorId = options.visitorId ?? null
    usage.channel = options.channel || 'owner'
    usage.conversationId = options.conversationId ?? null
    usage.messageId = options.messageId ?? null
    usage.scope = options.scope || 'chat'
    usage.provider = options.provider
    usage.model = options.model
    usage.inputTokens = this.normalizeValue(options.inputTokens)
    usage.outputTokens = this.normalizeValue(options.outputTokens)
    usage.totalTokens = totalTokens
    usage.quotaCost = quotaCost
    usage.usageDate = dayjs().format('YYYY-MM-DD')
    usage.usageMonth = dayjs().format('YYYY-MM')
    usage.metadata = options.metadata ?? null
    usage.createTime = Date.now()
    await this.usageRepository.persistAndFlush(usage)

    quota.dailyUsedTokens += quotaCost
    quota.monthlyUsedTokens += quotaCost
    quota.lifetimeUsedTokens += quotaCost
    quota.updateTime = Date.now()
    await this.quotaRepository.persistAndFlush(quota)
    return usage
  }

  async getUsageSummary(accountId: string) {
    const quota = await this.getQuota(accountId)
    const recentRecords = await this.usageRepository.find({
      accountId,
    }, {
      limit: 20,
      orderBy: {
        createTime: 'DESC',
      },
    })

    return {
      quota: {
        dailyTokenLimit: quota.dailyTokenLimit,
        monthlyTokenLimit: quota.monthlyTokenLimit,
        dailyUsedTokens: quota.dailyUsedTokens,
        monthlyUsedTokens: quota.monthlyUsedTokens,
        lifetimeUsedTokens: quota.lifetimeUsedTokens,
        disabled: quota.disabled,
      },
      recentRecords,
    }
  }

  private async getOrCreateQuota(accountId: string) {
    let quota = await this.quotaRepository.findOne({ accountId })
    if (!quota) {
      quota = new AiAccountQuota()
      quota.accountId = accountId
      quota.lastDailyResetAt = dayjs().format('YYYY-MM-DD')
      quota.lastMonthlyResetAt = dayjs().format('YYYY-MM')
      await this.quotaRepository.persistAndFlush(quota)
    }
    return quota
  }

  private async syncQuotaWindow(quota: AiAccountQuota) {
    const today = dayjs().format('YYYY-MM-DD')
    const currentMonth = dayjs().format('YYYY-MM')
    let changed = false

    if (quota.lastDailyResetAt !== today) {
      quota.dailyUsedTokens = 0
      quota.lastDailyResetAt = today
      changed = true
    }
    if (quota.lastMonthlyResetAt !== currentMonth) {
      quota.monthlyUsedTokens = 0
      quota.lastMonthlyResetAt = currentMonth
      changed = true
    }
    if (changed) {
      quota.updateTime = Date.now()
      await this.quotaRepository.persistAndFlush(quota)
    }
  }

  private normalizeValue(value?: number) {
    const normalized = Number(value || 0)
    if (!Number.isFinite(normalized) || normalized < 0) {
      return 0
    }
    return Math.round(normalized)
  }
}
