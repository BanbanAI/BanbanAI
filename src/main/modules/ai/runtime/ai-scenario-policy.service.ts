import { Injectable } from '@nestjs/common'
import {
  AiConversationProfile,
  AiCrossAppScopeTransition,
  AiFeatureFlags,
  AiPendingCrossAppResolutionState,
  AiThreadRuntimeDiagnostics,
  AiThreadRecordAnalysisSnapshot,
  AiThreadRuntimeState,
} from '../ai.types'
import { AiConfigService } from '../config/ai-config.service'

export type AiScenarioCapabilities = {
  allowsBatchReadAppData: boolean
  allowsDynamicToolParallel: boolean
  allowsCrossAppCompare: boolean
}

export type AiScenarioPolicy = {
  profile?: AiConversationProfile
  featureFlags: AiFeatureFlags
  capabilities: AiScenarioCapabilities
}

@Injectable()
export class AiScenarioPolicyService {
  constructor(
    private readonly aiConfigService: AiConfigService,
  ) {}

  async resolvePolicy(options: {
    userMessage?: string
    runtimeState?: AiThreadRuntimeState | null
  }): Promise<AiScenarioPolicy> {
    const baseFeatureFlags = await this.aiConfigService.getFeatureFlags()
    const profile = this.resolveProfile({
      ...options,
      featureFlags: baseFeatureFlags,
    })
    const featureFlags = profile
      ? await this.aiConfigService.getFeatureFlags(profile)
      : baseFeatureFlags
    return {
      profile,
      featureFlags,
      capabilities: this.buildCapabilities(profile),
    }
  }

  resolveProfile(options: {
    userMessage?: string
    runtimeState?: AiThreadRuntimeState | null
    featureFlags?: AiFeatureFlags | null
  }): AiConversationProfile | undefined {
    const message = this.normalizeText(options.userMessage)
    const runtimeState = options.runtimeState
    const featureFlags = options.featureFlags || null
    const currentProfile = this.normalizeProfile(runtimeState?.currentProfile)

    const pendingResolutionProfile = this.resolvePendingCrossAppResolutionProfile(message, runtimeState)
    if (pendingResolutionProfile) {
      return pendingResolutionProfile
    }

    if (runtimeState && this.isSingleAppNarrowScopeMessage(message, runtimeState)) {
      return 'records_query'
    }

    const hasPendingCrossAppResolution = Boolean(
      this.normalizePendingCrossAppResolution(runtimeState?.pendingCrossAppResolution),
    )
    if (hasPendingCrossAppResolution) {
      return currentProfile || 'cross_app_unresolved'
    }

    const crossAppProfileFromMessage = this.resolveCrossAppProfileFromMessage(message)
    if (crossAppProfileFromMessage) {
      return crossAppProfileFromMessage
    }

    if (runtimeState?.currentContextKind === 'comparison') {
      const comparisonFollowupProfile = this.resolveComparisonFollowupProfileFromMessage(message)
      if (comparisonFollowupProfile) {
        return comparisonFollowupProfile
      }
      if (this.isSingleAppNarrowScopeMessage(message, runtimeState)) {
        return 'records_query'
      }
      return currentProfile || 'cross_app_unresolved'
    }

    if (currentProfile && currentProfile !== 'records_query') {
      return currentProfile
    }

    if (this.looksLikeRecordsQuery(message)) {
      return 'records_query'
    }

    if (currentProfile) {
      return currentProfile
    }

    if (
      runtimeState?.currentIntent === 'records'
      || runtimeState?.currentIntent === 'aggregation'
      || this.normalizeText(runtimeState?.currentSourceId)
    ) {
      return 'records_query'
    }

    if (!featureFlags?.neutralColdStartProfileEnabled) {
      return 'records_query'
    }

    return undefined
  }

  attachProfile(
    runtimeState?: AiThreadRuntimeState | null,
    profile?: AiConversationProfile | null,
  ): AiThreadRuntimeState | undefined {
    const normalizedProfile = this.normalizeProfile(profile)
    const shouldBypassUnresolvedAlignmentOverride = this.shouldBypassUnresolvedAlignmentOverride(
      runtimeState,
      normalizedProfile,
    )
    const forcedProfileFromAlignment = runtimeState?.latestCrossAppAlignmentState?.status === 'unresolved'
      && !shouldBypassUnresolvedAlignmentOverride
      ? 'cross_app_unresolved'
      : undefined
    if (!runtimeState && !normalizedProfile) {
      return undefined
    }

    const nextState: AiThreadRuntimeState = {
      ...(runtimeState || {}),
      currentProfile: forcedProfileFromAlignment || normalizedProfile || undefined,
    }
    const diagnostics = this.buildDiagnostics(nextState, runtimeState?.diagnostics)
    if (diagnostics) {
      nextState.diagnostics = diagnostics
    }
    return nextState
  }

  syncPendingCrossAppResolution(
    runtimeState?: AiThreadRuntimeState | null,
    options: {
      profile?: AiConversationProfile | null
      assistantContent?: string | null
    } = {},
  ): AiThreadRuntimeState | undefined {
    const normalizedProfile = this.normalizeProfile(options.profile)
    const nextState = runtimeState
      ? { ...runtimeState }
      : undefined
    const preservedPendingResolution = this.normalizePendingCrossAppResolution(
      runtimeState?.pendingCrossAppResolution,
    )

    if (normalizedProfile !== 'cross_app_unresolved') {
      return this.withPendingCrossAppResolution(nextState, undefined)
    }

    if (this.shouldAttachCompareMergeChoiceState(options.assistantContent, normalizedProfile)) {
      return this.withPendingCrossAppResolution(
        nextState,
        this.buildPendingCrossAppResolutionState(),
      )
    }

    return this.withPendingCrossAppResolution(nextState, preservedPendingResolution)
  }

  consumesPendingCrossAppResolution(
    userMessage?: string | null,
    runtimeState?: AiThreadRuntimeState | null,
    nextProfile?: AiConversationProfile | null,
  ) {
    if (!runtimeState) {
      return false
    }

    return this.isPendingCrossAppResolutionSelection(
      this.normalizeText(userMessage),
      runtimeState,
      this.normalizeProfile(nextProfile),
    )
  }

  applyScopeTransition(
    runtimeState?: AiThreadRuntimeState | null,
    options: {
      userMessage?: string
      profile?: AiConversationProfile | null
    } = {},
  ): AiThreadRuntimeState | undefined {
    const transition = this.resolveScopeTransition({
      userMessage: options.userMessage,
      runtimeState,
      profile: options.profile,
    })
    if (!runtimeState) {
      return undefined
    }
    if (!transition) {
      return runtimeState
    }

    if (transition === 'inherit') {
      return {
        ...runtimeState,
        latestCrossAppScopeTransition: transition,
      }
    }

    if (transition === 'narrow') {
      const retainedAppIds = this.resolveMentionedAppIds(
        this.normalizeText(options.userMessage),
        runtimeState,
      )
      const retainedTargetAppIdSet = new Set(retainedAppIds)
      const retainedVerifiedTargets = (Array.isArray(runtimeState.verifiedTargets) ? runtimeState.verifiedTargets : [])
        .filter(item => retainedTargetAppIdSet.has(this.normalizeText(item?.appId)))
      const retainedActiveSnapshots = this.filterSnapshotsByAppIds(
        runtimeState,
        retainedAppIds,
      )
      const firstVerifiedTarget = retainedVerifiedTargets[0]

      return {
        ...runtimeState,
        currentContextKind: retainedAppIds.length <= 1 ? 'single_target' : runtimeState.currentContextKind,
        currentAppId: retainedAppIds.length === 1 ? this.normalizeText(firstVerifiedTarget?.appId) || undefined : undefined,
        currentAppName: retainedAppIds.length === 1 ? this.normalizeText(firstVerifiedTarget?.appName) || undefined : undefined,
        currentSourceId: retainedAppIds.length === 1 ? this.normalizeText(firstVerifiedTarget?.targetId) || undefined : undefined,
        currentSourceName: retainedAppIds.length === 1 ? this.normalizeText(firstVerifiedTarget?.targetName) || undefined : undefined,
        currentBatchAppId: undefined,
        currentBatchTargetIds: [],
        verifiedTargets: retainedVerifiedTargets,
        activeRecordAnalysisSnapshots: retainedActiveSnapshots,
        latestCrossAppScopeTransition: transition,
        latestCrossAppAlignmentState: undefined,
        latestCrossAppAnalysisBundle: undefined,
      }
    }

    return {
      ...runtimeState,
      currentContextKind: 'comparison',
      currentAppId: undefined,
      currentAppName: undefined,
      currentSourceId: undefined,
      currentSourceName: undefined,
      currentBatchAppId: undefined,
      currentBatchTargetIds: [],
      activeRecordAnalysisSnapshots: [],
      latestCrossAppScopeTransition: transition,
      latestCrossAppAlignmentState: undefined,
      latestCrossAppAnalysisBundle: undefined,
    }
  }

  private buildCapabilities(profile?: AiConversationProfile): AiScenarioCapabilities {
    switch (profile) {
    case 'cross_app_compare':
    case 'cross_app_merge':
    case 'cross_app_unresolved':
      return {
        allowsBatchReadAppData: false,
        allowsDynamicToolParallel: true,
        allowsCrossAppCompare: true,
      }
    case 'records_query':
      return {
        allowsBatchReadAppData: true,
        allowsDynamicToolParallel: true,
        allowsCrossAppCompare: false,
      }
    default:
      return {
        allowsBatchReadAppData: true,
        allowsDynamicToolParallel: true,
        allowsCrossAppCompare: true,
      }
    }
  }

  private resolveCrossAppProfileFromMessage(message: string): AiConversationProfile | undefined {
    if (!this.hasCrossAppScopeSignal(message)) {
      return undefined
    }

    return this.resolveComparisonFollowupProfileFromMessage(message) || 'cross_app_unresolved'
  }

  private resolveComparisonFollowupProfileFromMessage(message: string): AiConversationProfile | undefined {
    if (!message) {
      return undefined
    }

    if (this.hasCrossAppCompareKeyword(message)) {
      return 'cross_app_compare'
    }

    if (this.hasCrossAppMergeKeyword(message)) {
      return 'cross_app_merge'
    }

    return undefined
  }

  private resolvePendingCrossAppResolutionProfile(
    message: string,
    runtimeState?: AiThreadRuntimeState | null,
  ): AiConversationProfile | undefined {
    const pendingResolution = this.normalizePendingCrossAppResolution(runtimeState?.pendingCrossAppResolution)
    if (!pendingResolution || !message) {
      return undefined
    }

    const explicitChoiceProfile = this.resolvePendingCrossAppResolutionChoiceProfile(
      message,
      pendingResolution,
    )
    if (explicitChoiceProfile) {
      return explicitChoiceProfile
    }

    // Intentionally re-check narrow scope here so pending compare/merge fallback does not consume single-app messages.
    if (runtimeState && this.isSingleAppNarrowScopeMessage(message, runtimeState)) {
      return undefined
    }

    const hasCompareKeyword = this.hasCrossAppCompareKeyword(message)
    const hasMergeKeyword = this.hasCrossAppMergeKeyword(message)

    if (hasCompareKeyword && hasMergeKeyword) {
      return undefined
    }

    if (hasCompareKeyword) {
      return this.hasNegatedPendingCrossAppCompareKeyword(message)
        ? undefined
        : 'cross_app_compare'
    }

    if (hasMergeKeyword) {
      return this.hasNegatedPendingCrossAppMergeKeyword(message)
        ? undefined
        : 'cross_app_merge'
    }

    return undefined
  }

  private resolvePendingCrossAppResolutionChoiceProfile(
    message: string,
    pendingResolution: AiPendingCrossAppResolutionState,
  ) {
    return pendingResolution.choices.find(item =>
      item.aliases.some(alias => this.matchesPendingChoiceReplyPrefix(message, alias)),
    )?.profile
  }

  private matchesPendingChoiceReplyPrefix(message: string, alias: string) {
    const normalizedAlias = this.normalizePendingChoiceAlias(alias)
    if (!message || !normalizedAlias) {
      return false
    }

    const escapedChars = normalizedAlias
      .split('')
      .map(char => this.escapeRegExp(char))
      .join('\\s*')
    const pattern = new RegExp(
      `^\\s*${escapedChars}(?:$|[\\s,，。.;；:：、)）])`,
      'i',
    )
    return pattern.test(message)
  }

  private resolveScopeTransition(options: {
    userMessage?: string
    runtimeState?: AiThreadRuntimeState | null
    profile?: AiConversationProfile | null
  }): AiCrossAppScopeTransition | undefined {
    const runtimeState = options.runtimeState
    const message = this.normalizeText(options.userMessage)
    const nextProfile = this.normalizeProfile(options.profile)
    if (!runtimeState || !this.hasCrossAppRuntimeState(runtimeState)) {
      return undefined
    }

    if (this.isNarrowScopeMessage(message, runtimeState, nextProfile)) {
      return 'narrow'
    }

    if (this.isExpandScopeMessage(message)) {
      return 'expand'
    }

    if (this.isPendingCrossAppResolutionSelection(message, runtimeState, nextProfile)) {
      return 'inherit'
    }

    if (this.isInvalidateScopeMessage(runtimeState, nextProfile)) {
      return 'invalidate'
    }

    if (this.isDisplayOnlyFollowupMessage(message) && this.isReusableCrossAppProfile(nextProfile)) {
      return 'inherit'
    }

    return undefined
  }

  private buildDiagnostics(
    runtimeState: AiThreadRuntimeState,
    diagnostics?: AiThreadRuntimeDiagnostics | null,
  ): AiThreadRuntimeDiagnostics | undefined {
    const nextDiagnostics: AiThreadRuntimeDiagnostics = {
      currentTopCandidateStableRounds: this.normalizeFiniteNumber(
        diagnostics?.currentTopCandidateStableRounds ?? runtimeState.currentTopCandidateStableRounds,
      ),
      lastExecutionStrategy: diagnostics?.lastExecutionStrategy ?? runtimeState.lastExecutionStrategy,
      lastBatchPartial: this.normalizeOptionalBoolean(
        diagnostics?.lastBatchPartial ?? runtimeState.lastBatchPartial,
      ),
    }

    if (!Object.values(nextDiagnostics).some(value => value !== undefined && value !== null)) {
      return undefined
    }

    return nextDiagnostics
  }

  private hasCrossAppRuntimeState(runtimeState?: AiThreadRuntimeState | null) {
    const currentProfile = this.normalizeProfile(runtimeState?.currentProfile)
    if (
      currentProfile === 'cross_app_compare'
      || currentProfile === 'cross_app_merge'
      || currentProfile === 'cross_app_unresolved'
    ) {
      return true
    }

    if (runtimeState?.currentContextKind === 'comparison') {
      return true
    }

    const distinctAppIds = [...new Set(
      (Array.isArray(runtimeState?.verifiedTargets) ? runtimeState.verifiedTargets : [])
        .map(item => this.normalizeText(item?.appId))
        .filter(Boolean),
    )]

    return distinctAppIds.length >= 2 || Boolean(runtimeState?.latestCrossAppAnalysisBundle)
  }

  private isReusableCrossAppProfile(profile?: AiConversationProfile) {
    return profile === 'cross_app_compare'
      || profile === 'cross_app_merge'
      || profile === 'cross_app_unresolved'
  }

  private isDisplayOnlyFollowupMessage(message: string) {
    if (!message) {
      return false
    }

    return [
      '表格',
      '图表',
      '柱状图',
      '折线图',
      '饼图',
      '横向柱状图',
      'bar chart',
      'line chart',
      'table',
      'chart',
    ].some(keyword => message.toLowerCase().includes(keyword.toLowerCase()))
  }

  private isExpandScopeMessage(message: string) {
    if (!message) {
      return false
    }

    return [
      '加进来',
      '也加',
      '加上',
      '再加',
      '加入',
      'include',
      'add',
    ].some(keyword => message.toLowerCase().includes(keyword.toLowerCase()))
  }

  private isInvalidateScopeMessage(
    runtimeState: AiThreadRuntimeState,
    nextProfile?: AiConversationProfile,
  ) {
    const previousProfile = this.normalizeProfile(runtimeState?.currentProfile)
    return Boolean(
      previousProfile
      && nextProfile
      && previousProfile !== nextProfile
      && this.isReusableCrossAppProfile(previousProfile)
      && this.isReusableCrossAppProfile(nextProfile),
    )
  }

  private isPendingCrossAppResolutionSelection(
    message: string,
    runtimeState: AiThreadRuntimeState,
    nextProfile?: AiConversationProfile,
  ) {
    if (nextProfile !== 'cross_app_compare' && nextProfile !== 'cross_app_merge') {
      return false
    }

    const pendingResolution = this.normalizePendingCrossAppResolution(runtimeState?.pendingCrossAppResolution)
    if (!pendingResolution) {
      return false
    }

    return this.resolvePendingCrossAppResolutionProfile(message, runtimeState) === nextProfile
  }

  private isSingleAppNarrowScopeMessage(
    message: string,
    runtimeState: AiThreadRuntimeState,
  ) {
    if (!message) {
      return false
    }

    const hasNarrowKeyword = [
      '只看',
      '只保留',
      '仅看',
      'only',
    ].some(keyword => message.toLowerCase().includes(keyword.toLowerCase()))
    if (!hasNarrowKeyword) {
      return false
    }

    return this.resolveMentionedAppIds(message, runtimeState).length === 1
  }

  private isNarrowScopeMessage(
    message: string,
    runtimeState: AiThreadRuntimeState,
    nextProfile?: AiConversationProfile,
  ) {
    if (nextProfile !== 'records_query' || !message) {
      return false
    }

    const hasNarrowKeyword = [
      '只看',
      '只保留',
      '仅看',
      'only',
    ].some(keyword => message.toLowerCase().includes(keyword.toLowerCase()))
    if (!hasNarrowKeyword) {
      return false
    }

    return this.resolveMentionedAppIds(message, runtimeState).length === 1
  }

  private resolveMentionedAppIds(
    message: string,
    runtimeState: AiThreadRuntimeState,
  ) {
    const candidates = new Map<string, string>()

    ;(Array.isArray(runtimeState?.verifiedTargets) ? runtimeState.verifiedTargets : []).forEach(item => {
      const appId = this.normalizeText(item?.appId)
      const appName = this.normalizeText(item?.appName)
      if (appId) {
        candidates.set(appId, appId)
      }
      if (appId && appName) {
        candidates.set(appName, appId)
      }
    })

    return [...new Set(
      [...candidates.entries()]
        .filter(([candidate]) => candidate && message.includes(candidate))
        .map(([, appId]) => appId),
    )]
  }

  private filterSnapshotsByAppIds(
    runtimeState: AiThreadRuntimeState,
    appIds: string[],
  ): AiThreadRecordAnalysisSnapshot[] {
    const appIdSet = new Set(appIds.map(item => this.normalizeText(item)).filter(Boolean))
    const sourceSnapshots = Array.isArray(runtimeState?.activeRecordAnalysisSnapshots)
      ? runtimeState.activeRecordAnalysisSnapshots
      : runtimeState?.recordAnalysisSnapshots
    return (Array.isArray(sourceSnapshots) ? sourceSnapshots : [])
      .filter(item => appIdSet.has(this.normalizeText(item?.appId)))
  }

  private looksLikeRecordsQuery(message: string) {
    if (!message) {
      return false
    }

    const keywords = [
      '记录',
      '数据',
      '表单',
      '列表',
      '明细',
      '筛选',
      '查询',
      '统计',
      '汇总',
      '聚合',
      '趋势',
      '多少',
      '总数',
      '数量',
      '金额',
      '销售额',
      '按月',
      '按部门',
      '近两个月',
      '状态',
      '本月',
      '上月',
      '审批',
      '报销',
    ]

    return keywords.some(keyword => message.includes(keyword))
  }

  private hasCrossAppScopeSignal(message: string) {
    if (!message) {
      return false
    }

    const explicitCrossAppAnchors = [
      '跨应用',
      '多应用',
      '多个应用',
      '两个应用',
      '应用之间',
      '跨系统',
      '多系统',
      '多个系统',
      '两个系统',
      '系统之间',
      '哪个应用',
      '哪个系统',
    ]

    return explicitCrossAppAnchors.some(keyword => message.includes(keyword))
      || this.hasMultipleAppOrSystemObjects(message)
  }

  private hasCrossAppCompareKeyword(message: string) {
    if (!message) {
      return false
    }

    return [
      '对比',
      '比较',
      '相比',
      '差异',
      '高低',
      '谁更高',
      '谁更低',
      '谁更多',
      '谁更少',
    ].some(keyword => message.includes(keyword))
  }

  private hasCrossAppMergeKeyword(message: string) {
    if (!message) {
      return false
    }

    return [
      '合并',
      '汇总',
      '联合',
      '一起看',
      '同时看',
      '综合分析',
      '拼接',
      '整合',
    ].some(keyword => message.includes(keyword))
  }

  private hasNegatedPendingCrossAppCompareKeyword(message: string) {
    if (!message) {
      return false
    }

    return [
      '不对比',
      '别对比',
      '不要对比',
      '先别对比',
      '先不要对比',
      '不用对比',
      '不需要对比',
      '不比较',
      '别比较',
      '不要比较',
      '先别比较',
      '先不要比较',
      '不用比较',
      '不需要比较',
    ].some(keyword => message.includes(keyword))
  }

  private hasNegatedPendingCrossAppMergeKeyword(message: string) {
    if (!message) {
      return false
    }

    return [
      '不合并',
      '别合并',
      '不要合并',
      '先别合并',
      '先不要合并',
      '不用合并',
      '不需要合并',
      '不汇总',
      '别汇总',
      '不要汇总',
      '先别汇总',
      '先不要汇总',
      '不用汇总',
      '不需要汇总',
      '不联合',
      '别联合',
      '不要联合',
      '先别联合',
      '先不要联合',
      '不用联合',
      '不需要联合',
      '不整合',
      '别整合',
      '不要整合',
      '先别整合',
      '先不要整合',
      '不用整合',
      '不需要整合',
    ].some(keyword => message.includes(keyword))
  }

  private hasMultipleAppOrSystemObjects(message: string) {
    const objectReferenceMatches = message.match(/(?:应用|系统)\s*(?:“[^”]*”|"[^"]*")|应用|系统/g)
    return Array.isArray(objectReferenceMatches) && objectReferenceMatches.length >= 2
  }

  private shouldAttachCompareMergeChoiceState(
    assistantContent?: string | null,
    profile?: AiConversationProfile,
  ) {
    if (profile !== 'cross_app_unresolved') {
      return false
    }

    const normalized = this.normalizeText(assistantContent)
    if (!normalized) {
      return false
    }

    return this.hasNumberedChoiceWithKeywords(normalized, '1', [
      '对比',
      '比较',
      '相比',
      '差异',
    ]) && this.hasNumberedChoiceWithKeywords(normalized, '2', [
      '合并',
      '汇总',
      '联合',
      '整合',
    ])
  }

  private hasNumberedChoiceWithKeywords(
    content: string,
    key: '1' | '2',
    keywords: string[],
  ) {
    const escapedKeywords = keywords.map(keyword => this.escapeRegExp(keyword)).join('|')
    const pattern = new RegExp(
      `(?:^|[\\s\\n\\r。；;：:])${key}[\\.、:：\\)）]?[^\\n\\r]{0,32}(?:${escapedKeywords})`,
      'i',
    )
    return pattern.test(content)
  }

  private buildPendingCrossAppResolutionState(): AiPendingCrossAppResolutionState {
    return {
      kind: 'compare_merge_choice',
      choices: [
        {
          key: '1',
          profile: 'cross_app_compare',
          aliases: ['1', '1.', '1、', '选1', '选 1', '第一个', '第一种'],
        },
        {
          key: '2',
          profile: 'cross_app_merge',
          aliases: ['2', '2.', '2、', '选2', '选 2', '第二个', '第二种'],
        },
      ],
    }
  }

  private normalizePendingCrossAppResolution(
    value?: AiPendingCrossAppResolutionState | null,
  ): AiPendingCrossAppResolutionState | undefined {
    if (value?.kind !== 'compare_merge_choice') {
      return undefined
    }

    const normalizedChoices = (Array.isArray(value?.choices) ? value.choices : [])
      .map(item => {
        const key = item?.key === '1' || item?.key === '2'
          ? item.key
          : undefined
        const profile = item?.profile === 'cross_app_compare' || item?.profile === 'cross_app_merge'
          ? item.profile
          : undefined
        if (!key || !profile) {
          return null
        }

        return {
          key,
          profile,
          aliases: [...new Set(
            (Array.isArray(item?.aliases) ? item.aliases : [])
              .map(alias => this.normalizePendingChoiceAlias(alias))
              .filter(Boolean),
          )] as string[],
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))

    const compareChoice = normalizedChoices.find(item =>
      item.key === '1' && item.profile === 'cross_app_compare',
    )
    const mergeChoice = normalizedChoices.find(item =>
      item.key === '2' && item.profile === 'cross_app_merge',
    )

    if (!compareChoice || !mergeChoice || normalizedChoices.length !== 2) {
      return undefined
    }

    return {
      kind: 'compare_merge_choice',
      choices: [compareChoice, mergeChoice],
    }
  }

  private normalizeProfile(value?: string | null): AiConversationProfile | undefined {
    const normalized = String(value || '').trim()
    return [
      'records_query',
      'cross_app_compare',
      'cross_app_merge',
      'cross_app_unresolved',
    ].includes(normalized)
      ? normalized as AiConversationProfile
      : undefined
  }

  private normalizeText(value?: string | null) {
    return String(value || '').trim()
  }

  private normalizePendingChoiceAlias(value?: string | null) {
    const normalized = this.normalizeText(value)
      .replace(/\s+/g, '')
      .toLowerCase()
    return normalized || undefined
  }

  private shouldBypassUnresolvedAlignmentOverride(
    runtimeState?: AiThreadRuntimeState | null,
    nextProfile?: AiConversationProfile,
  ) {
    if (nextProfile !== 'cross_app_compare' && nextProfile !== 'cross_app_merge') {
      return false
    }

    if (this.normalizeProfile(runtimeState?.currentProfile) !== 'cross_app_unresolved') {
      return false
    }

    return Boolean(
      this.normalizePendingCrossAppResolution(runtimeState?.pendingCrossAppResolution),
    )
  }

  private withPendingCrossAppResolution(
    runtimeState?: AiThreadRuntimeState,
    pendingCrossAppResolution?: AiPendingCrossAppResolutionState,
  ) {
    if (!runtimeState && !pendingCrossAppResolution) {
      return undefined
    }

    const nextState: AiThreadRuntimeState = {
      ...(runtimeState || {}),
    }

    if (pendingCrossAppResolution) {
      nextState.pendingCrossAppResolution = pendingCrossAppResolution
    } else {
      delete nextState.pendingCrossAppResolution
    }

    return nextState
  }

  private escapeRegExp(value: string) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private normalizeOptionalBoolean(value?: boolean | null) {
    return typeof value === 'boolean' ? value : undefined
  }

  private normalizeFiniteNumber(value?: number | null) {
    return Number.isFinite(Number(value))
      ? Math.max(0, Number(value))
      : undefined
  }
}
