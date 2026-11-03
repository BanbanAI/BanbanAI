import { isRecord } from '@common/utils/nocodeEditorFlowPlan'
import {
  buildStablePlanningQuestionId,
  hashQuestionSeed,
} from '@common/utils/nocodeEditorPlanningQuestionContract'

// 模型可自修的流程方案入参问题：诊断必须回到模型，否则模型只能盲试。
export const FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS: ReadonlySet<string> = new Set([
  'flow-decision-contract-invalid',
  'flow-decision-graph-invalid',
  'flow-structure-assumption-unconfirmed',
  'flow-personnel-decision-slot-invalid',
  'flow-personnel-question-contract-invalid',
  'flow-field-value-options-invalid',
  'flow-scheme-submission-step-invalid',
])

// 结构假设校验的细分 code：同一份方案可能换着键位反复失败，止损要按类聚合。
export const FLOW_STRUCTURE_ASSUMPTION_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  'assumption_impact_missing',
  'structure_assumption_decision_missing',
  'structure_assumption_question_missing',
  'structure_assumption_question_not_structural',
  'structure_assumption_dependent_missing',
  'structure_assumption_dependent_without_prerequisite',
])

// 人员决策题的细分 code（挂错题、少声明 stepKey/slot）：同样按类聚合，避免模型在不同题之间来回搬标记。
export const FLOW_PERSONNEL_SLOT_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  'personnel_decision_question_kind_invalid',
  'personnel_decision_slot_options_invalid',
  'personnel_decision_missing',
])

// 写入值选项与字段实际选项不一致：模型常换一套近义值重试，按类聚合止损。
export const FLOW_FIELD_VALUE_OPTION_DIAGNOSTIC_CODES: ReadonlySet<string> = new Set([
  'field_value_option_not_in_enum',
])

const MAX_SCAN_LENGTH = 80_000
const MAX_JSON_CANDIDATES = 8

const findBalancedJsonEnd = (text: string, start: number, limit: number) => {
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < limit; index += 1) {
    const char = text[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') { inString = true; continue }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  return -1
}

/** 只认顶层带 scheme 的对象；容忍代码围栏和前后解释文本。 */
export const extractFlowSchemeFromAssistantText = (value: unknown) => {
  const text = String(value ?? '')
  const limit = Math.min(text.length, MAX_SCAN_LENGTH)
  let cursor = 0
  let candidates = 0
  while (cursor < limit && candidates < MAX_JSON_CANDIDATES) {
    const start = text.indexOf('{', cursor)
    if (start < 0 || start >= limit) return null
    candidates += 1
    cursor = start + 1
    const end = findBalancedJsonEnd(text, start, limit)
    if (end < 0) continue
    try {
      const parsed = JSON.parse(text.slice(start, end + 1))
      if (isRecord(parsed) && isRecord(parsed.scheme)) return { scheme: parsed.scheme }
    } catch {
      // 不是完整 JSON，继续找下一个候选
    }
  }
  return null
}

export const buildFlowSchemeTextSalvageRetryMessage = (scheme: Record<string, unknown>) => [
  '上一轮你已经在正文里给出了完整的流程方案 JSON，但它没有作为工具调用提交，宿主没有校验也没有暂存。',
  '请把下面这份方案原样作为 editor_plan_flow_scheme 的入参提交：不要重新规划，不要改写节点、决策键和选项，也不要只输出正文。',
  '```json',
  JSON.stringify({ scheme }, null, 2),
  '```',
].join('\n')

export const FLOW_STRUCTURE_ASSUMPTION_STOP_LOSS_MESSAGE = '这个流程方案的审批结构和待确认问题对不上，自动修订没有通过。请告诉我审批要分几级、每级由谁审批、是否按金额分流，我再重新生成方案。'

export const FLOW_PERSONNEL_SLOT_STOP_LOSS_MESSAGE = '这个流程方案的确认题和人员设置对不上，自动修订没有通过。请告诉我每个审批节点由谁审批，我再重新生成方案。'

export const FLOW_FIELD_VALUE_OPTION_STOP_LOSS_MESSAGE = '这个流程方案的确认题选项和表单字段的实际选项对不上，自动修订没有通过。请告诉我这些字段当前可选的业务值，我再重新生成方案。'

export type FlowSchemeStopLossQuestion = {
  id: string
  decisionKey?: string
  title: string
  description?: string
  allowFreeText: boolean
  options: Array<{ value: string; label: string }>
}

const MAX_STOP_LOSS_QUESTIONS = 3
const MAX_STOP_LOSS_ASSUMPTION_LENGTH = 60

const normalizeStopLossAssumptionText = (value: unknown) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > MAX_STOP_LOSS_ASSUMPTION_LENGTH
    ? `${text.slice(0, MAX_STOP_LOSS_ASSUMPTION_LENGTH)}...`
    : text
}

/**
 * 收口时问什么：只问失败轮次里模型自己提出、但没能落成确认题的假设。
 * 宿主不解释业务语义，选项固定为“按这个来 / 我说一下具体规则”（文案随应用语言）。
 */
export const buildFlowSchemeStopLossQuestions = (
  results: Array<{ name?: unknown; ok?: unknown; metadata?: Record<string, unknown> | null }>,
  options: {
    /** 已在确认快照里结算的决策键：用过的事实不再重复问 */
    answeredDecisionKeys?: ReadonlyArray<string>
    /** 已结算的题目标题：无 decisionKey 的假设靠标题识别 */
    answeredQuestionTitles?: ReadonlyArray<string>
    /** 历史收口卡里问过的目标题标题 → 次数；同一题问过两轮仍无解就不再弹卡 */
    askedQuestionCounts?: Readonly<Record<string, number>>
  } = {},
): FlowSchemeStopLossQuestion[] => {
  const answeredDecisionKeys = new Set(
    (options.answeredDecisionKeys || []).map(value => String(value || '').trim()).filter(Boolean),
  )
  const answeredQuestionTitles = new Set(
    (options.answeredQuestionTitles || []).map(value => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  )
  const askedQuestionCounts = options.askedQuestionCounts || {}
  const questions: FlowSchemeStopLossQuestion[] = []
  const seenAssumptionTexts = new Set<string>()
  // 止损在触发的那一轮立即结束，最后一次失败的方案提交才是当前仍未落实的假设；
  // 扫描更早的失败会把已经修好的假设重新问一遍。
  const latestFailedResult = [...(results || [])].reverse().find(result => (
    String(result?.name || '').trim() === 'editor_plan_flow_scheme'
    && result.ok !== true
  ))

  for (const result of latestFailedResult ? [latestFailedResult] : []) {
    const issues = Array.isArray(result.metadata?.flowUnifiedIssues)
      ? result.metadata?.flowUnifiedIssues as unknown[] : []
    const issue = issues.find(isRecord)
    const diagnostics = Array.isArray(issue?.diagnostics) ? issue.diagnostics as unknown[] : []
    for (const item of diagnostics) {
      if (!isRecord(item)) continue
      const code = String(item.code || '').trim()
      if (
        !FLOW_STRUCTURE_ASSUMPTION_DIAGNOSTIC_CODES.has(code)
        && !FLOW_PERSONNEL_SLOT_DIAGNOSTIC_CODES.has(code)
      ) continue
      const assumptionText = normalizeStopLossAssumptionText(item.assumptionText)
      if (!assumptionText || seenAssumptionTexts.has(assumptionText)) continue
      const decisionKey = String(item.decisionKey || '').trim()
      if (decisionKey && answeredDecisionKeys.has(decisionKey)) continue
      const title = global.i18next.t('nocodeEditorChatService.flowSchemeStopLossTitle', {
        assumption: assumptionText,
        interpolation: { escapeValue: false },
      })
      if (answeredQuestionTitles.has(title)) continue
      if (Number(askedQuestionCounts[title] || 0) >= 2) continue
      seenAssumptionTexts.add(assumptionText)
      questions.push({
        // 位置型 id 会被上一轮答案按 questionId 认领（见决策对账），换一道题就错绑；
        // 有决策键按决策键出 id，没有则按题干出稳定 id。
        id: decisionKey
          ? `stop-loss-${hashQuestionSeed(decisionKey)}`
          : buildStablePlanningQuestionId({ stage: 'flow-plan', title }),
        ...(decisionKey ? { decisionKey } : {}),
        title,
        description: global.i18next.t('nocodeEditorChatService.flowSchemeStopLossDescription'),
        allowFreeText: true,
        options: [
          {
            value: 'accept-assumption',
            label: global.i18next.t('nocodeEditorChatService.flowSchemeStopLossAcceptOption'),
          },
          {
            value: 'describe-myself',
            label: global.i18next.t('nocodeEditorChatService.flowSchemeStopLossDescribeOption'),
          },
        ],
      })
      if (questions.length >= MAX_STOP_LOSS_QUESTIONS) return questions
    }
  }
  return questions
}

export const buildFlowSchemeStopLossMessage = (questions: FlowSchemeStopLossQuestion[]) => (
  questions.length
    ? global.i18next.t('nocodeEditorChatService.flowSchemeStopLossIntro')
    : ''
)
