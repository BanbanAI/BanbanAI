import { Injectable } from '@nestjs/common'
import {
  AiActionResult,
  AiConversationProfile,
  AiReasoningDecision,
  AiReasoningLevel,
  AiThreadRuntimeState,
} from '../ai.types'

type ResolveDecisionOptions = {
  userMessage?: string
  conversationProfile?: AiConversationProfile
  runtimeState?: AiThreadRuntimeState | null
  round?: number
  actionResults?: AiActionResult[]
}

@Injectable()
export class AiReasoningPolicyService {
  resolveDecision(options: ResolveDecisionOptions): AiReasoningDecision {
    const userMessage = this.normalizeText(options.userMessage)
    const runtimeState = options.runtimeState || null
    const profile = this.normalizeProfile(options.conversationProfile || runtimeState?.currentProfile)
    const round = Math.max(1, Math.round(Number(options.round || 1)))
    const actionResults = Array.isArray(options.actionResults) ? options.actionResults : []
    const reasonCodes: string[] = []

    let score = this.baseScoreForProfile(profile, reasonCodes)

    if (this.isDesignHeavyMessage(userMessage)) {
      score = 3
      reasonCodes.push('message-design-heavy')
    } else if (this.isAnalysisHeavyMessage(userMessage)) {
      score = Math.max(score, 3)
      reasonCodes.push('message-analysis-heavy')
    } else if (this.isSummaryHeavyMessage(userMessage)) {
      score = Math.max(score, 2)
      reasonCodes.push('message-summary-heavy')
    }

    if (runtimeState?.currentIntent === 'aggregation') {
      score = Math.max(score, 3)
      reasonCodes.push('runtime-aggregation')
    } else if (runtimeState?.currentIntent === 'clarify') {
      score = Math.max(score, 1)
      reasonCodes.push('runtime-clarify')
    }

    if (runtimeState?.currentContextKind === 'comparison') {
      score = Math.max(score, 2)
      reasonCodes.push('runtime-comparison')
    }

    const verifiedTargets = Array.isArray(runtimeState?.verifiedTargets)
      ? runtimeState.verifiedTargets
      : []
    if (verifiedTargets.length >= 2) {
      score = Math.max(score, 2)
      reasonCodes.push('verified-multi-target')
    } else if (
      verifiedTargets.length === 1
      && runtimeState?.currentContextKind !== 'comparison'
      && (runtimeState?.currentIntent === 'records' || runtimeState?.currentIntent === 'clarify' || !runtimeState?.currentIntent)
      && !this.isAnalysisHeavyMessage(userMessage)
      && !this.isDesignHeavyMessage(userMessage)
    ) {
      score = Math.min(score, 1)
      reasonCodes.push('verified-single-target-fast-path')
    }

    const successfulReadResults = actionResults.filter(item => item?.ok && item.name === 'read_app_data')
    const successfulMemoryResults = actionResults.filter(item => item?.ok && item.name === 'get_app_memory')
    if (successfulReadResults.length >= 2) {
      score = Math.max(score, 3)
      reasonCodes.push('history-multi-read')
    } else if (successfulMemoryResults.length >= 2) {
      score = Math.max(score, 2)
      reasonCodes.push('history-multi-memory-compare')
    }

    const convergence = this.normalizeSearchConvergence(runtimeState?.currentSearchConvergence)
    const stableRounds = Number.isFinite(Number(runtimeState?.currentTopCandidateStableRounds))
      ? Math.max(0, Number(runtimeState?.currentTopCandidateStableRounds))
      : 0
    if (round >= 2) {
      if (!verifiedTargets.length) {
        score = Math.min(3, score + 1)
        reasonCodes.push('round-escalation-unverified')
      }
      if (convergence !== 'clear') {
        score = Math.min(3, score + 1)
        reasonCodes.push('search-unresolved')
      }
      if (stableRounds < 1 && runtimeState?.currentContextKind !== 'comparison') {
        score = Math.min(3, score + 1)
        reasonCodes.push('top-candidate-unstable')
      }
    }

    if (round >= 3 && !verifiedTargets.length) {
      score = Math.max(score, 3)
      reasonCodes.push('deep-round-escalation')
    }

    return {
      level: this.scoreToLevel(score),
      source: 'auto',
      reasonCodes: [...new Set(reasonCodes)],
    }
  }

  private baseScoreForProfile(profile: AiConversationProfile | undefined, reasonCodes: string[]) {
    if (profile === 'cross_app_compare') {
      reasonCodes.push('profile-compare-base')
      return 2
    }
    if (profile === 'cross_app_merge') {
      reasonCodes.push('profile-merge-base')
      return 2
    }
    if (profile === 'cross_app_unresolved') {
      reasonCodes.push('profile-unresolved-base')
      return 2
    }
    if (profile === 'records_query') {
      reasonCodes.push('profile-records-base')
      return 1
    }
    reasonCodes.push('profile-neutral-base')
    return 1
  }

  private scoreToLevel(score: number): AiReasoningLevel {
    if (score >= 3) return 'high'
    if (score >= 2) return 'medium'
    return 'low'
  }

  private isAnalysisHeavyMessage(message: string) {
    if (!message) return false
    return /(分析|异常|原因|趋势|洞察|归因|建议|评估|决策|对比|比较|综合|归纳|总结成因|why|analysis|compare|comparison|insight|recommend|evaluate)/i.test(message)
  }

  private isDesignHeavyMessage(message: string) {
    if (!message) return false
    return /(设计|搭建|生成业务系统|生成系统|字段设计|表单设计|流程设计|审批流|权限设计|数据模型|数据库设计|低代码|应用生成|系统生成|架构方案|workflow|schema|design|architecture|generate.*system|form design)/i.test(message)
  }

  private isSummaryHeavyMessage(message: string) {
    if (!message) return false
    return /(报告|汇报|纪要|总结|文档|方案稿|ppt|幻灯|presentation|report|summary|briefing)/i.test(message)
  }

  private normalizeProfile(value?: string | null): AiConversationProfile | undefined {
    const normalized = this.normalizeText(value)
    return ['records_query', 'cross_app_compare', 'cross_app_merge', 'cross_app_unresolved'].includes(normalized)
      ? normalized as AiConversationProfile
      : undefined
  }

  private normalizeText(value?: string | null) {
    return String(value || '').trim()
  }

  private normalizeSearchConvergence(value?: string | null) {
    const normalized = this.normalizeText(value).toLowerCase()
    return normalized === 'clear' || normalized === 'weak'
      ? normalized
      : 'none'
  }
}
