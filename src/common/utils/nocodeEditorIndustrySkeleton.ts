// @ts-ignore
import skeletonCatalog from '@common/ai/app-builder/industry-skeletons/catalog.json'
// @ts-ignore
import administrativeOperationsSkeleton from '@common/ai/app-builder/industry-skeletons/administrative-operations.json'
// @ts-ignore
import crmSkeleton from '@common/ai/app-builder/industry-skeletons/crm.json'
// @ts-ignore
import ehsSafetySkeleton from '@common/ai/app-builder/industry-skeletons/ehs-safety.json'
// @ts-ignore
import equipmentMaintenanceManagementSkeleton from '@common/ai/app-builder/industry-skeletons/equipment-maintenance-management.json'
// @ts-ignore
import engineeringProjectManagementSkeleton from '@common/ai/app-builder/industry-skeletons/engineering-project-management.json'
// @ts-ignore
import expenseControlSkeleton from '@common/ai/app-builder/industry-skeletons/expense-control.json'
// @ts-ignore
import financialOperationsSkeleton from '@common/ai/app-builder/industry-skeletons/financial-operations.json'
// @ts-ignore
import hrmSkeleton from '@common/ai/app-builder/industry-skeletons/hrm.json'
// @ts-ignore
import inventorySkeleton from '@common/ai/app-builder/industry-skeletons/inventory.json'
// @ts-ignore
import projectManagementSkeleton from '@common/ai/app-builder/industry-skeletons/project-management.json'
// @ts-ignore
import workOrderManagementSkeleton from '@common/ai/app-builder/industry-skeletons/work-order-management.json'
import type { NocodeEditorPlanningScope } from './nocodeEditorPlanningScope'
import { resolveNocodeEditorPlanningScope } from './nocodeEditorPlanningScope'

type IndustrySkeletonCatalogEntry = {
  key: string
  name: string
  path: string
  version: string
}

type IndustrySkeletonModule = {
  key: string
  name: string
  purpose: string
}

type IndustrySkeletonField = {
  name: string
  semanticRole: string
  suggestedWidget: string
  requiredByDefault: boolean
  notes?: string
}

type IndustrySkeletonRelationHint = {
  fieldName: string
  targetFormKey: string
  targetFieldName?: string
  reason: string
}

type IndustrySkeletonForm = {
  key: string
  name: string
  moduleKey: string
  purpose: string
  commonality: 'foundation' | 'common-enhancement'
  coreFields: IndustrySkeletonField[]
  relationHints: IndustrySkeletonRelationHint[]
}

type IndustrySkeletonFlow = {
  from: string
  to: string
  label: string
}

type IndustrySkeletonDeferredCapability = {
  name: string
  reason: string
}

type IndustrySkeletonValidationPrompt = {
  userPrompt: string
  expectedBehavior: string
}

export type NocodeEditorIndustrySkeleton = {
  key: string
  name: string
  version: string
  aliases: string[]
  beginnerSummary: string
  intentExamples: string[]
  modules: IndustrySkeletonModule[]
  forms: IndustrySkeletonForm[]
  flows: IndustrySkeletonFlow[]
  deferredCapabilities: IndustrySkeletonDeferredCapability[]
  validationPrompts: IndustrySkeletonValidationPrompt[]
}

export type NocodeEditorIndustrySkeletonRegistryEntry = IndustrySkeletonCatalogEntry & {
  skeleton: NocodeEditorIndustrySkeleton
}

export type NocodeEditorIndustrySkeletonMatch = {
  key: string
  name: string
  score: number
  reasons: string[]
  skeleton: NocodeEditorIndustrySkeleton
  entry: NocodeEditorIndustrySkeletonRegistryEntry
}

export type NocodeEditorIndustrySkeletonCarryover = {
  skeletonKey: string
  skeletonName: string
  version?: string
  planningScope: 'app' | 'form'
  matchReasons: string[]
  sliceHints: string[]
  foundationFormKeys: string[]
  commonEnhancementFormKeys: string[]
  deferredCapabilityNames: string[]
}

export type NocodeEditorIndustrySkeletonPlanningContext = {
  scope: NocodeEditorPlanningScope | 'unknown'
  source: 'none' | 'carryover' | 'user-message'
  carryover: NocodeEditorIndustrySkeletonCarryover | null
}

const skeletonDataByPath: Record<string, NocodeEditorIndustrySkeleton> = {
  'administrative-operations.json': administrativeOperationsSkeleton as NocodeEditorIndustrySkeleton,
  'crm.json': crmSkeleton as NocodeEditorIndustrySkeleton,
  'ehs-safety.json': ehsSafetySkeleton as NocodeEditorIndustrySkeleton,
  'equipment-maintenance-management.json': equipmentMaintenanceManagementSkeleton as NocodeEditorIndustrySkeleton,
  'engineering-project-management.json': engineeringProjectManagementSkeleton as NocodeEditorIndustrySkeleton,
  'expense-control.json': expenseControlSkeleton as NocodeEditorIndustrySkeleton,
  'financial-operations.json': financialOperationsSkeleton as NocodeEditorIndustrySkeleton,
  'hrm.json': hrmSkeleton as NocodeEditorIndustrySkeleton,
  'inventory.json': inventorySkeleton as NocodeEditorIndustrySkeleton,
  'project-management.json': projectManagementSkeleton as NocodeEditorIndustrySkeleton,
  'work-order-management.json': workOrderManagementSkeleton as NocodeEditorIndustrySkeleton,
}

const normalizeText = (value: unknown) => String(value ?? '').trim()
const normalizeMatchText = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[，。、“”‘’"'`·,.!?！？:：;；()（）[\]【】/\\|_-]+/g, '')

const uniqueStrings = (items: string[]) => items.filter((item, index) => items.indexOf(item) === index)

const limitList = (items: string[], limit: number) => uniqueStrings(
  items.map(item => normalizeText(item)).filter(Boolean),
).slice(0, limit)

const includesPhrase = (source: string, phrase: string) => (
  Boolean(source)
  && Boolean(phrase)
  && (
    source.includes(phrase)
    || (phrase.length >= 4 && phrase.includes(source))
  )
)

const buildSliceHints = (skeleton: NocodeEditorIndustrySkeleton) => {
  const hints = [
    { label: '无库存', pattern: /无库存/ },
    { label: '现结', pattern: /现结/ },
    { label: '赊销', pattern: /赊销/ },
  ]

  const aliasTextList = [skeleton.name, ...skeleton.aliases].map(item => normalizeText(item))
  return hints
    .filter(item => aliasTextList.some(alias => item.pattern.test(alias)))
    .map(item => item.label)
}

const buildMatchPhrases = (skeleton: NocodeEditorIndustrySkeleton) => uniqueStrings([
  skeleton.name,
  ...skeleton.aliases,
  ...skeleton.intentExamples,
].map(item => normalizeText(item)).filter(Boolean))

const CONTINUATION_PHRASES = [
  '继续',
  '接着',
  '补进去',
  '补充',
  '也补',
  '加上',
  '可以',
  '就按这个',
  '照这个',
]

const getSkeletonKeywordSignals = (skeleton: NocodeEditorIndustrySkeleton) => uniqueStrings([
  ...skeleton.modules.map(item => item.name),
  ...skeleton.forms.map(item => item.name),
].map(item => normalizeText(item)).filter(item => item.length >= 2))

const scoreIndustrySkeleton = (
  userMessage: string,
  entry: NocodeEditorIndustrySkeletonRegistryEntry,
): NocodeEditorIndustrySkeletonMatch | null => {
  const normalizedUserMessage = normalizeMatchText(userMessage)
  if (!normalizedUserMessage) {
    return null
  }

  let score = 0
  const reasons: string[] = []
  const namePhrase = normalizeMatchText(entry.name)
  if (includesPhrase(normalizedUserMessage, namePhrase)) {
    score += 12
    reasons.push(`命中骨架名称：${entry.name}`)
  }

  for (const alias of entry.skeleton.aliases) {
    const normalizedAlias = normalizeMatchText(alias)
    if (!includesPhrase(normalizedUserMessage, normalizedAlias)) {
      continue
    }
    score += 8
    reasons.push(`命中别名：${alias}`)
  }

  for (const example of entry.skeleton.intentExamples) {
    const normalizedExample = normalizeMatchText(example)
    if (!includesPhrase(normalizedUserMessage, normalizedExample)) {
      continue
    }
    score += 6
    reasons.push(`命中意图示例：${example}`)
  }

  const keywordHits = getSkeletonKeywordSignals(entry.skeleton)
    .filter(keyword => includesPhrase(normalizedUserMessage, normalizeMatchText(keyword)))
    .slice(0, 6)
  if (keywordHits.length >= 2) {
    score += Math.min(keywordHits.length, 4)
    reasons.push(`命中关键对象：${keywordHits.join('、')}`)
  }

  if (score <= 0) {
    return null
  }

  return {
    key: entry.key,
    name: entry.name,
    score,
    reasons: uniqueStrings(reasons),
    skeleton: entry.skeleton,
    entry,
  }
}

export const getNocodeEditorIndustrySkeletonRegistry = (): NocodeEditorIndustrySkeletonRegistryEntry[] => (
  ((skeletonCatalog as { skeletons?: IndustrySkeletonCatalogEntry[] })?.skeletons || [])
    .map((entry) => {
      const skeleton = skeletonDataByPath[String(entry?.path || '').trim()]
      if (!skeleton) {
        return null
      }
      return {
        key: String(entry.key || '').trim(),
        name: String(entry.name || '').trim(),
        path: String(entry.path || '').trim(),
        version: String(entry.version || '').trim(),
        skeleton,
      }
    })
    .filter(Boolean) as NocodeEditorIndustrySkeletonRegistryEntry[]
)

export const matchNocodeEditorIndustrySkeletons = (
  userMessage: unknown,
): NocodeEditorIndustrySkeletonMatch[] => {
  const text = normalizeText(userMessage)
  if (!text) {
    return []
  }

  return getNocodeEditorIndustrySkeletonRegistry()
    .map(entry => scoreIndustrySkeleton(text, entry))
    .filter(Boolean)
    .sort((left, right) => {
      const scoreGap = Number(right?.score || 0) - Number(left?.score || 0)
      if (scoreGap !== 0) {
        return scoreGap
      }
      return String(left?.key || '').localeCompare(String(right?.key || ''))
    }) as NocodeEditorIndustrySkeletonMatch[]
}

export const shouldInjectNocodeEditorIndustrySkeletonSummary = (
  scope: NocodeEditorPlanningScope | string,
) => {
  const normalizedScope = normalizeText(scope)
  return normalizedScope === 'app' || normalizedScope === 'form'
}

const toPlanningScope = (value: unknown): 'app' | 'form' | null => {
  const normalizedScope = normalizeText(value)
  if (normalizedScope === 'app' || normalizedScope === 'form') {
    return normalizedScope
  }
  return null
}

const isRecord = (value: unknown): value is Record<string, any> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const buildCarryoverFromMatch = (
  match: NocodeEditorIndustrySkeletonMatch,
  planningScope: 'app' | 'form',
): NocodeEditorIndustrySkeletonCarryover => ({
  skeletonKey: match.key,
  skeletonName: match.name,
  version: normalizeText(match.entry.version) || normalizeText(match.skeleton.version) || undefined,
  planningScope,
  matchReasons: limitList(match.reasons, 8),
  sliceHints: limitList(buildSliceHints(match.skeleton), 6),
  foundationFormKeys: limitList(
    match.skeleton.forms
      .filter(item => item.commonality === 'foundation')
      .map(item => item.key),
    12,
  ),
  commonEnhancementFormKeys: limitList(
    match.skeleton.forms
      .filter(item => item.commonality === 'common-enhancement')
      .map(item => item.key),
    12,
  ),
  deferredCapabilityNames: limitList(
    match.skeleton.deferredCapabilities.map(item => item.name),
    12,
  ),
})

export const buildNocodeEditorIndustrySkeletonCarryover = (options: {
  match?: NocodeEditorIndustrySkeletonMatch | null
  scope?: NocodeEditorPlanningScope | string
}): NocodeEditorIndustrySkeletonCarryover | null => {
  const planningScope = toPlanningScope(options?.scope)
  if (!planningScope || !options?.match) {
    return null
  }
  return buildCarryoverFromMatch(options.match, planningScope)
}

export const resolveNocodeEditorIndustrySkeletonCarryover = (
  value: unknown,
): NocodeEditorIndustrySkeletonCarryover | null => {
  if (!isRecord(value)) {
    return null
  }

  const skeletonKey = normalizeText(value.skeletonKey)
  const skeletonName = normalizeText(value.skeletonName)
  const planningScope = toPlanningScope(value.planningScope)
  if (!skeletonKey || !skeletonName || !planningScope) {
    return null
  }

  const registryEntry = getNocodeEditorIndustrySkeletonRegistry()
    .find(entry => normalizeText(entry.key) === skeletonKey)
  if (!registryEntry) {
    return null
  }

  return {
    skeletonKey,
    skeletonName,
    version: normalizeText(value.version) || normalizeText(registryEntry.version) || undefined,
    planningScope,
    matchReasons: limitList(
      Array.isArray(value.matchReasons) ? value.matchReasons as string[] : [],
      8,
    ),
    sliceHints: limitList(
      Array.isArray(value.sliceHints) ? value.sliceHints as string[] : buildSliceHints(registryEntry.skeleton),
      6,
    ),
    foundationFormKeys: limitList(
      Array.isArray(value.foundationFormKeys) ? value.foundationFormKeys as string[] : registryEntry.skeleton.forms
        .filter(item => item.commonality === 'foundation')
        .map(item => item.key),
      12,
    ),
    commonEnhancementFormKeys: limitList(
      Array.isArray(value.commonEnhancementFormKeys) ? value.commonEnhancementFormKeys as string[] : registryEntry.skeleton.forms
        .filter(item => item.commonality === 'common-enhancement')
        .map(item => item.key),
      12,
    ),
    deferredCapabilityNames: limitList(
      Array.isArray(value.deferredCapabilityNames) ? value.deferredCapabilityNames as string[] : registryEntry.skeleton.deferredCapabilities
        .map(item => item.name),
      12,
    ),
  }
}

const shouldReuseCarryoverForMessage = (userMessage: string) => {
  const normalizedMessage = normalizeText(userMessage)
  if (!normalizedMessage) {
    return true
  }
  return CONTINUATION_PHRASES.some(phrase => normalizedMessage.includes(phrase))
}

export const resolveNocodeEditorIndustrySkeletonPlanningContext = (options: {
  userMessage?: unknown
  scope?: NocodeEditorPlanningScope | string
  carryover?: unknown
}): NocodeEditorIndustrySkeletonPlanningContext => {
  const userMessage = normalizeText(options?.userMessage)
  const carryover = resolveNocodeEditorIndustrySkeletonCarryover(options?.carryover)
  const explicitScope = normalizeText(options?.scope)
  const stableExplicitScope = explicitScope && explicitScope !== 'unknown'
    ? explicitScope
    : ''
  const fallbackScope = userMessage
    ? resolveNocodeEditorPlanningScope(userMessage).scope
    : 'unknown'
  const scope = (
    stableExplicitScope
    || (fallbackScope !== 'unknown' ? fallbackScope : '')
    || carryover?.planningScope
    || fallbackScope
  ) as NocodeEditorPlanningScope | 'unknown'
  if (!shouldInjectNocodeEditorIndustrySkeletonSummary(scope)) {
    return {
      scope,
      source: 'none',
      carryover: null,
    }
  }

  const matches = matchNocodeEditorIndustrySkeletons(userMessage)
  const nextMatch = matches[0]
  const nextCarryover = buildNocodeEditorIndustrySkeletonCarryover({
    match: nextMatch,
    scope,
  })

  if (nextCarryover) {
    if (
      carryover
      && carryover.skeletonKey === nextCarryover.skeletonKey
      && shouldReuseCarryoverForMessage(userMessage)
    ) {
      return {
        scope,
        source: 'carryover',
        carryover: {
          ...carryover,
          ...nextCarryover,
          planningScope: nextCarryover.planningScope,
        },
      }
    }

    if (!carryover || carryover.skeletonKey !== nextCarryover.skeletonKey) {
      return {
        scope,
        source: 'user-message',
        carryover: nextCarryover,
      }
    }

    return {
      scope,
      source: 'user-message',
      carryover: {
        ...carryover,
        ...nextCarryover,
        planningScope: nextCarryover.planningScope,
      },
    }
  }

  if (carryover && shouldReuseCarryoverForMessage(userMessage)) {
    return {
      scope,
      source: 'carryover',
      carryover: carryover.planningScope === scope
        ? carryover
        : {
            ...carryover,
            planningScope: toPlanningScope(scope) || carryover.planningScope,
          },
    }
  }

  return {
    scope,
    source: 'none',
    carryover: null,
  }
}

const buildSkeletonSummaryBlock = (match: NocodeEditorIndustrySkeletonMatch) => {
  const foundationForms = limitList(
    match.skeleton.forms
      .filter(item => item.commonality === 'foundation')
      .map(item => item.name),
    8,
  )
  const enhancementForms = limitList(
    match.skeleton.forms
      .filter(item => item.commonality === 'common-enhancement')
      .map(item => item.name),
    7,
  )
  const deferredCapabilities = limitList(
    match.skeleton.deferredCapabilities.map(item => item.name),
    6,
  )
  const intentHints = limitList([
    match.name,
    ...match.skeleton.aliases,
  ], 6)
  const sliceHints = buildSliceHints(match.skeleton)

  return [
    `- 命中骨架：${match.name}`,
    `- 一句话说明：${match.skeleton.beginnerSummary}`,
    intentHints.length ? `- 常见叫法：${intentHints.join('、')}` : '',
    foundationForms.length ? `- 基础必备：${foundationForms.join('、')}` : '',
    enhancementForms.length ? `- 常用增强：${enhancementForms.join('、')}` : '',
    deferredCapabilities.length ? `- 后续扩展：${deferredCapabilities.join('、')}` : '',
    sliceHints.length ? `- 切片提示：${sliceHints.join('、')} 只是同一个骨架的意图切片，不要拆成新的行业骨架。` : '',
  ].filter(Boolean).join('\n')
}

export const buildNocodeEditorIndustrySkeletonPromptSummary = (options: {
  userMessage?: unknown
  scope?: NocodeEditorPlanningScope | string
  maxCandidates?: number
  carryover?: unknown
}) => {
  const userMessage = normalizeText(options?.userMessage)
  const planningContext = resolveNocodeEditorIndustrySkeletonPlanningContext({
    userMessage,
    scope: options?.scope,
    carryover: options?.carryover,
  })
  if (!shouldInjectNocodeEditorIndustrySkeletonSummary(planningContext.scope)) {
    return ''
  }

  const activeCarryover = planningContext.carryover
  if (!activeCarryover?.skeletonKey) {
    return ''
  }

  const activeEntry = getNocodeEditorIndustrySkeletonRegistry()
    .find(entry => entry.key === activeCarryover.skeletonKey)
  if (!activeEntry) {
    return ''
  }

  const activeMatch: NocodeEditorIndustrySkeletonMatch = {
    key: activeEntry.key,
    name: activeEntry.name,
    score: 0,
    reasons: activeCarryover.matchReasons,
    skeleton: activeEntry.skeleton,
    entry: activeEntry,
  }

  return [
    '候选行业骨架摘要（仅供参考，不替你强制决定结构，也不表示后端替你选择骨架）：',
    buildSkeletonSummaryBlock(activeMatch),
  ].join('\n')
}
