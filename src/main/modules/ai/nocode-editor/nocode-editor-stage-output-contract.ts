import { NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS } from '@common/utils/nocodeEditorBlueprintInput'
import {
  FLOW_FIELD_VALUE_OPTION_DIAGNOSTIC_CODES,
  FLOW_FIELD_VALUE_OPTION_STOP_LOSS_MESSAGE,
  FLOW_PERSONNEL_SLOT_DIAGNOSTIC_CODES,
  FLOW_PERSONNEL_SLOT_STOP_LOSS_MESSAGE,
  FLOW_STRUCTURE_ASSUMPTION_DIAGNOSTIC_CODES,
  FLOW_STRUCTURE_ASSUMPTION_STOP_LOSS_MESSAGE,
} from './nocode-editor-flow-scheme-repair.util'

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

/**
 * 用户刚回答规划确认题、且规划已完成时，本轮必须真正产出蓝图；
 * 只输出正文或重新暂存规划都不算完成。重新暂存规划时交给新规划卡承载下一步。
 */
export const isNocodeEditorBlueprintExpectedAfterPlanningConfirmation = (input: {
  confirmationStage?: unknown
  planningConfirmationStatus?: unknown
  results?: StageToolResult[]
}) => {
  const stage = String(input.confirmationStage || '').trim()
  if (stage !== 'form-plan' && stage !== 'app-plan') {
    return false
  }
  if (String(input.planningConfirmationStatus || '').trim() !== 'completed') {
    return false
  }
  const hasPlanningMutation = (input.results || []).some(result => (
    result?.ok === true
    && (
      String(result?.name || '').trim() === 'editor_stage_single_form_plan'
      || String(result?.name || '').trim() === 'editor_stage_app_plan'
    )
  ))
  return !hasPlanningMutation
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
    const isStructureAssumptionIssue = FLOW_STRUCTURE_ASSUMPTION_DIAGNOSTIC_CODES.has(code)
    const isPersonnelSlotIssue = FLOW_PERSONNEL_SLOT_DIAGNOSTIC_CODES.has(code)
    const isFieldValueOptionIssue = FLOW_FIELD_VALUE_OPTION_DIAGNOSTIC_CODES.has(code)
    if (
      !codes.has(code)
      && !isStructureAssumptionIssue
      && !isPersonnelSlotIssue
      && !isFieldValueOptionIssue
    ) continue
    // 结构假设、人员挂错题、写入值选项对不上都会在不同键位间来回变，按类聚合才能真正止损。
    const fingerprint = isStructureAssumptionIssue
      ? 'flow-structure-assumption-unconfirmed'
      : isPersonnelSlotIssue
        ? 'flow-personnel-decision-slot-invalid'
        : isFieldValueOptionIssue
          ? 'flow-field-value-options-invalid'
          : [
            issue.issueId, code, diagnostic?.questionId, diagnostic?.decisionKey,
            diagnostic?.stepKey, diagnostic?.optionValue,
          ].map(value => String(value || '').trim()).join('|')
    const count = (counts.get(fingerprint) || 0) + 1
    counts.set(fingerprint, count)
    if (count >= 2) {
      if (isStructureAssumptionIssue) return FLOW_STRUCTURE_ASSUMPTION_STOP_LOSS_MESSAGE
      if (isPersonnelSlotIssue) return FLOW_PERSONNEL_SLOT_STOP_LOSS_MESSAGE
      if (isFieldValueOptionIssue) return FLOW_FIELD_VALUE_OPTION_STOP_LOSS_MESSAGE
      return String(diagnostic?.message || issue.userMessage || '流程方案结构校验重复失败').trim()
    }
  }
  return ''
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

/**
 * 用户刚回答流程方案确认题时，本轮必须重新暂存方案：确认结论只会回填到任务摘要，
 * 暂存方案本身不会自动更新；只输出正文不算完成。
 */
export const buildFlowSchemeRestageAfterConfirmationContract = (input: {
  confirmationStage?: unknown
  hasStagedFlowScheme?: boolean
  previousSchemeRevision?: unknown
}): NocodeEditorStageOutputContract => {
  const previousRevision = Math.max(
    0,
    Math.floor(Number(input.previousSchemeRevision) || 0),
  )
  return {
    id: 'flow-scheme-after-confirmation',
    applicable: String(input.confirmationStage || '').trim() === 'flow-scheme'
      && input.hasStagedFlowScheme !== false,
    prerequisiteToolNames: [],
    satisfyingOutputToolNames: ['editor_plan_flow_scheme'],
    retryLimit: 1,
    validateOutcome: (result) => {
      const output = isRecord(result.output) ? result.output : null
      const scheme = isRecord(output?.scheme) ? output.scheme : null
      const nextRevision = Math.max(0, Math.floor(Number(output?.revision) || 0))
      return Boolean(
        nextRevision > previousRevision
        && String(scheme?.title || '').trim()
        && Array.isArray(scheme?.openQuestions)
        && isRecord(scheme?.confirmation),
      )
    },
  }
}

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

    return `蓝图生成已停止：AI 规划连续两次检测到相同的表单范围错误${labels.length ? `（${Array.from(new Set(labels)).join('、')}）` : ''}。请先更新表单规划范围或统一表单身份后重试。`
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
    || metadata.blueprintSourceTargetErrorCode
    || metadata.flowPatchErrorCode
    || metadata.guardCode
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
          message: `执行已停止：AI 规划连续 ${streak.count} 次因同一原因失败。请调整内容或补充必要信息后重试。`,
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

export type NocodeEditorBlueprintDesignGapOutput = {
  tableName?: string
  fieldName?: string
  widgetType?: string
  reason?: 'enum-options-missing' | 'auto-compute-formula-missing' | 'related-form-needs-design'
}

const BLUEPRINT_DESIGN_GAP_REASONS: ReadonlySet<string> = new Set([
  'enum-options-missing',
  'auto-compute-formula-missing',
  'related-form-needs-design',
])

const readBlueprintDesignGapReason = (
  value: unknown,
): NocodeEditorBlueprintDesignGapOutput['reason'] => {
  const reason = String(value || '').trim()
  return BLUEPRINT_DESIGN_GAP_REASONS.has(reason)
    ? reason as NocodeEditorBlueprintDesignGapOutput['reason']
    : undefined
}

export const readNocodeEditorBlueprintDesignGaps = (
  output: unknown,
): NocodeEditorBlueprintDesignGapOutput[] => {
  const record = isRecord(output) ? output : null
  if (!record || !Array.isArray(record.designGaps)) {
    return []
  }
  return record.designGaps
    .filter(isRecord)
    .map(item => ({
      tableName: String(item.tableName || '').trim() || undefined,
      fieldName: String(item.fieldName || '').trim() || undefined,
      widgetType: String(item.widgetType || '').trim() || undefined,
      reason: readBlueprintDesignGapReason(item.reason),
    }))
    .filter(item => Boolean(item.tableName))
}

const MAX_BLUEPRINT_GAP_LABELS = 3

const buildBlueprintDesignGapLabel = (gap: NocodeEditorBlueprintDesignGapOutput) => {
  if (gap.reason === 'related-form-needs-design') {
    return global.i18next.t('nocodeEditorToolResultMessages.blueprintDesignGapRelatedForm', {
      tableName: gap.tableName || '',
    })
  }
  if (!gap.fieldName) {
    return global.i18next.t(
      gap.reason === 'auto-compute-formula-missing'
        ? 'nocodeEditorToolResultMessages.blueprintDesignGapAutoComputeMissingFormLevel'
        : 'nocodeEditorToolResultMessages.blueprintDesignGapEnumMissingFormLevel',
      { formName: gap.tableName || '' },
    )
  }
  return global.i18next.t(
    gap.reason === 'auto-compute-formula-missing'
      ? 'nocodeEditorToolResultMessages.blueprintDesignGapAutoComputeMissing'
      : 'nocodeEditorToolResultMessages.blueprintDesignGapEnumMissing',
    { formName: gap.tableName || '', fieldName: gap.fieldName || '' },
  )
}

/**
 * 设计缺口是“工具成功但内容不完整”，不经过同因失败闸，需要单独的收口文案。
 * 只写业务名称（表名/字段名），不出现 designGaps、fieldKey 等实现词。
 */
export const buildBlueprintDesignGapStopLossMessage = (
  gaps: NocodeEditorBlueprintDesignGapOutput[],
) => {
  const labels = (gaps || [])
    .slice(0, MAX_BLUEPRINT_GAP_LABELS)
    .map(buildBlueprintDesignGapLabel)
    .filter(Boolean)
  if (!labels.length) {
    return global.i18next.t('nocodeEditorChatService.blueprintDesignGapStopLossEmpty')
  }
  return global.i18next.t('nocodeEditorChatService.blueprintDesignGapStopLossWithCount', {
    count: gaps.length,
    gaps: labels.join(global.i18next.t('nocodeEditorToolResultMessages.listSeparator')),
    interpolation: { escapeValue: false },
  })
}
