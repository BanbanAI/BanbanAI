import { NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS } from '@common/utils/nocodeEditorBlueprintInput'

export type NocodeEditorStageOutputContract = {
  id: string
  applicable: boolean
  prerequisiteToolNames: string[]
  satisfyingOutputToolNames: string[]
  retryLimit: number
  validateOutcome?: (result: StageToolResult) => boolean
}

export type NocodeEditorStageOutputContractDecision =
  | { kind: 'not_applicable' }
  | { kind: 'satisfied' }
  | { kind: 'retry'; contractId: string; retryCount: number }
  | { kind: 'exhausted'; contractId: string }

type StageToolResult = {
  name?: unknown
  ok?: unknown
  output?: unknown
}

export const resolveNocodeEditorStageOutputContract = (options: {
  contract: NocodeEditorStageOutputContract
  results: StageToolResult[]
  retryCount: number
  hasRetryRoundAvailable?: boolean
}): NocodeEditorStageOutputContractDecision => {
  const { contract } = options
  if (!contract.applicable) {
    return { kind: 'not_applicable' }
  }

  const hasValidOutput = (options.results || []).some(result => (
    result?.ok === true
    && contract.satisfyingOutputToolNames.includes(String(result?.name || '').trim())
    && (!contract.validateOutcome || contract.validateOutcome(result))
  ))
  if (hasValidOutput) {
    return { kind: 'satisfied' }
  }

  const retryCount = Math.max(0, Math.floor(Number(options.retryCount) || 0))
  if (
    retryCount < Math.max(0, Math.floor(Number(contract.retryLimit) || 0))
    && options.hasRetryRoundAvailable !== false
  ) {
    return {
      kind: 'retry',
      contractId: contract.id,
      retryCount: retryCount + 1,
    }
  }

  return { kind: 'exhausted', contractId: contract.id }
}

const FLOW_PLANNING_NEGATION_PATTERN = /不(要|用|需要|想|打算|准备|考虑|做|搞|弄).{0,8}(新建|创建|设计|规划|生成|搭建|新增|增加|添加|补充|完善|修改|调整|改动|变更|改成|改为|换成|替换|删除|去掉|去除|移除|取消|优化|简化|精简|重做|重来|重新|设置|配置|流程|审批|审批人|办理人|节点|分支|流转|分流|抄送)|别(把|再|去|乱|瞎)?(新建|创建|设计|规划|生成|搭建|新增|增加|添加|修改|调整|改动|变更|改|换|删除|去掉|去除|移除|取消|优化|简化|精简|重做|重来|重新|设置|配置|动|碰|弄|搞|操作|执行|做)/

const FLOW_STATE_QUESTION_PATTERN = /(怎么|如何)(设计|规划|做|弄|实现|改|调整|搭建|设置|配置)(的|了)/

const FLOW_DOMAIN_PATTERN = /(流程|审批|审批人|办理人|节点|分支|流转|分流|抄送)/

const FLOW_CHANGE_ACTION_PATTERN = /(新建|创建|设计|规划|生成|搭建|新增|增加|添加|补充|完善|修改|调整|改动|变更|改成|改为|换成|替换|删除|去掉|去除|移除|取消|优化|简化|精简|重做|重来|重新(创建|新建|设计|规划|生成|搭建|调整|修改|编排|设置|配置|做|来)|设置|配置|改|换|加一下|加个|加一个|加一条|加一级|加一层|加上|加入|加进)/

/**
 * 流程意图识别采用“极性 + 流程域对象”判定，不再枚举完整句式：先排除明确的放弃、否定
 * 和描述现状表达，再要求流程域对象与创建、改写类动作共现。改写类指令（例如
 * “报销审批改为按金额分流”）曾被漏判，模型读完流程摘要即停轮，只输出正文而没有方案。
 */
export const isExplicitNocodeEditorFlowPlanningIntent = (value: unknown) => {
  const normalized = String(value || '')
    .replace(/[，。！？、；：,.!?;:"'“”‘’（）()[\]{}\s]/g, '')
    .toLowerCase()
  if (!normalized) {
    return false
  }

  if (FLOW_PLANNING_NEGATION_PATTERN.test(normalized) || FLOW_STATE_QUESTION_PATTERN.test(normalized)) {
    return false
  }

  if (FLOW_DOMAIN_PATTERN.test(normalized) && FLOW_CHANGE_ACTION_PATTERN.test(normalized)) {
    return true
  }

  return /(新建|创建|设计|规划|生成)(当前|这个|该)?(表单)?(审批)?流程/.test(normalized)
    || /(新增|加)(一个|一条)?审批流/.test(normalized)
    || /(需要|要)(有|带|包含|配置)?(一个|一条)?(审批)?流程/.test(normalized)
    || /(带有|包含|配有)(一个|一条)?(审批)?流程/.test(normalized)
}

/**
 * 上一轮存在无效工具调用时，模型的动作意图还没完成，必须先走参数修复重试，
 * 不能被 stage 输出契约的重试提醒抢先（契约提醒会把模型拽向另一个阶段）。
 */
export const shouldPreferNocodeEditorLostToolIntentRepair = (input: {
  lostToolIntent: boolean
  toolIntentRetryCount: number
  hasRetryRoundAvailable: boolean
}) => Boolean(
  input.lostToolIntent
  && input.toolIntentRetryCount < 1
  && input.hasRetryRoundAvailable,
)

/**
 * 从零创建应用的流水线还没产出可用表单（只暂存了规划、没有任何蓝图证据、
 * 也没有打开的表单）时，流程方案契约不得启用：此时流程意图只作为 flowIntent
 * 记录，读流程摘要/规划流程都会打在还不存在的表单上。
 */
export const shouldDeferNocodeEditorFlowSchemeContractForCreationPipeline = (input: {
  hasPlanningSummary: boolean
  hasBlueprintEvidence: boolean
  hasOpenForm: boolean
}) => Boolean(
  input.hasPlanningSummary
  && !input.hasBlueprintEvidence
  && !input.hasOpenForm,
)

export const resolveRepeatedFlowSchemeError = (results: Array<{
  name?: unknown
  ok?: unknown
  metadata?: Record<string, unknown> | null
}>) => {
  const codes = new Set([
    'flow_personnel_step_reference_missing',
    'flow_dependency_scope_reference_missing',
    'flow_confirmed_step_removed',
    'flow_scheme_empty_after_revision',
  ])
  const counts = new Map<string, number>()
  for (const result of results) {
    if (String(result?.name || '').trim() !== 'editor_plan_flow_scheme') continue
    if (result.ok === true) {
      counts.clear()
      continue
    }
    const issues = Array.isArray(result.metadata?.flowUnifiedIssues)
      ? result.metadata.flowUnifiedIssues : []
    const issue = issues.find(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown> | undefined
    if (!issue) continue
    const diagnostic = Array.isArray(issue.diagnostics)
      ? issue.diagnostics.find(item => item && typeof item === 'object' && !Array.isArray(item)) as Record<string, unknown> | undefined
      : undefined
    const code = String(diagnostic?.code || '').trim()
    if (!codes.has(code)) continue
    const fingerprint = [
      issue.issueId, code, diagnostic?.questionId, diagnostic?.decisionKey,
      diagnostic?.stepKey, diagnostic?.optionValue,
    ].map(value => String(value || '').trim()).join('|')
    const count = (counts.get(fingerprint) || 0) + 1
    counts.set(fingerprint, count)
    if (count >= 2) {
      return String(diagnostic?.message || issue.userMessage || '流程方案结构校验重复失败').trim()
    }
  }
  return ''
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const buildBlueprintScopeErrorFingerprint = (result: {
  metadata?: Record<string, unknown> | null
}) => {
  const forms = Array.isArray(result.metadata?.blueprintScopeUnexpectedForms)
    ? result.metadata.blueprintScopeUnexpectedForms
    : []
  return JSON.stringify(forms
    .filter(isRecord)
    .map((form) => {
      const tableName = String(form.tableName || form.name || '')
        .trim().toLowerCase().replace(/[\s\-_/\\]+/g, '')
      return tableName || String(form.formKey || '').trim()
    })
    .filter(Boolean)
    .sort())
}

/**
 * 连续相同的蓝图范围错误说明模型没有获得新的可执行信息；达到止损阈值
 * 后交给上层结束本轮，避免继续消耗完整蓝图上下文并重复输出准备性文案。
 */
export const resolveRepeatedBlueprintScopeError = (results: Array<{
  name?: unknown
  ok?: unknown
  error?: unknown
  metadata?: Record<string, unknown> | null
}>) => {
  let previousFingerprint = ''
  let repeatedCount = 0

  for (const result of results || []) {
    if (String(result?.name || '').trim() !== 'editor_stage_app_blueprint') {
      continue
    }

    if (result.ok === true) {
      previousFingerprint = ''
      repeatedCount = 0
      continue
    }

    const errorCode = String(result.metadata?.blueprintScopeErrorCode || '').trim()
    if (errorCode !== NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS) {
      previousFingerprint = ''
      repeatedCount = 0
      continue
    }

    const fingerprint = buildBlueprintScopeErrorFingerprint(result)
    if (fingerprint && fingerprint === previousFingerprint) {
      repeatedCount += 1
    } else {
      previousFingerprint = fingerprint
      repeatedCount = 1
    }

    if (repeatedCount < 2) {
      continue
    }

    const labels = (Array.isArray(result.metadata?.blueprintScopeUnexpectedForms)
      ? result.metadata.blueprintScopeUnexpectedForms
      : [])
      .filter(isRecord)
      .map(form => String(form.tableName || form.name || form.formKey || '').trim())
      .filter(Boolean)

    return `蓝图生成已停止：连续两次检测到相同的表单范围错误${labels.length ? `（${Array.from(new Set(labels)).join('、')}）` : ''}。请先更新表单规划范围或统一表单身份后重试。`
  }

  return ''
}

export type NocodeEditorToolFailureEscalation = {
  toolName: string
  code: string
  planningContextKey?: string
  count: number
  firstRound: number
  lastRound: number
  signature: string
  message: string
}

const TOOL_FAILURE_ESCALATION_THRESHOLD = 3
const TOOL_FAILURE_CODE_FALLBACK_LIMIT = 160

type ToolFailureResultLike = {
  name?: unknown
  ok?: unknown
  error?: unknown
  metadata?: Record<string, unknown> | null
}

const resolveToolFailureDiagnostic = (result: ToolFailureResultLike) => {
  const metadata = isRecord(result?.metadata) ? result.metadata : {}
  const issues = Array.isArray(metadata.flowUnifiedIssues) ? metadata.flowUnifiedIssues : []
  const issue = issues.find(isRecord)
  const diagnostic = issue && Array.isArray(issue.diagnostics)
    ? issue.diagnostics.find(isRecord)
    : undefined
  const code = String(
    diagnostic?.code
    || metadata.blueprintScopeErrorCode
    || metadata.blueprintInputErrorCode
    || metadata.flowPatchErrorCode
    || '',
  ).trim() || String(result?.error || '').trim().slice(0, TOOL_FAILURE_CODE_FALLBACK_LIMIT)
  const planningContextKey = String(
    metadata.planningContextKey || issue?.planningContextKey || '',
  ).trim()
  return { code, planningContextKey }
}

/**
 * 轮内同因失败升级闸：按 (toolName + 失败 code + planningContextKey) 统计本回合内
 * 连续相同原因的失败，同工具成功即清零。达到阈值说明模型没有获得新的可执行信息，
 * 交给上层结束轮次，避免未知新循环在轮内反复盲试、烧穿整轮预算。
 */
export const createNocodeEditorToolFailureTracker = () => {
  const streaks = new Map<string, {
    signature: string
    code: string
    planningContextKey?: string
    count: number
    firstRound: number
    lastRound: number
  }>()

  const observe = (
    results: ToolFailureResultLike[] | null | undefined,
    round: number,
  ): NocodeEditorToolFailureEscalation | null => {
    for (const result of results || []) {
      const toolName = String(result?.name || '').trim()
      if (!toolName) {
        continue
      }
      if (result.ok === true) {
        streaks.delete(toolName)
        continue
      }
      const { code, planningContextKey } = resolveToolFailureDiagnostic(result)
      const signature = [toolName, code || 'unknown_failure', planningContextKey].join('|')
      const previous = streaks.get(toolName)
      const streak = previous && previous.signature === signature
        ? { ...previous, count: previous.count + 1, lastRound: round }
        : {
          signature,
          code: code || 'unknown_failure',
          planningContextKey: planningContextKey || undefined,
          count: 1,
          firstRound: round,
          lastRound: round,
        }
      streaks.set(toolName, streak)
      if (streak.count >= TOOL_FAILURE_ESCALATION_THRESHOLD) {
        return {
          toolName,
          code: streak.code,
          planningContextKey: streak.planningContextKey,
          count: streak.count,
          firstRound: streak.firstRound,
          lastRound: streak.lastRound,
          signature,
          message: `流程执行已停止：连续 ${streak.count} 次因同一原因失败（${toolName} / ${streak.code}）。请调整内容或补充必要信息后重试。`,
        }
      }
    }
    return null
  }

  const snapshot = () => Array.from(streaks.values()).map(streak => ({
    signature: streak.signature,
    code: streak.code,
    planningContextKey: streak.planningContextKey,
    count: streak.count,
    firstRound: streak.firstRound,
    lastRound: streak.lastRound,
  }))

  return { observe, snapshot }
}
