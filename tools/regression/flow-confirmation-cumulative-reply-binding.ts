import assert from 'node:assert/strict'
import i18next from 'i18next'

import {
  buildNocodeEditorTaskHistoryForProvider,
  resolveNocodeEditorTaskSummaryForIncomingUserMessage,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-task-context.util'
import {
  deriveCompletedConfirmationFromReplyMessage,
} from '../../src/renderer/views/nocode/views/editor/ai/components/confirmationInteraction'

// 2026-10-28 真实会话 editor_2a2dk4mhcvkx_...：卡片两题，用户只答了第 1 题，
// 第 2 题（写入值）仍待答，但注入模型的摘要里第 2 题被写成了第 1 题的结论。
const PLANNING_CONTEXT_KEY = 'logical:flow-scheme:nlrrl6cdjhm0:t_1lhaumzhrei9'
const OWNER_TITLE = '班主任审批人的来源'
const STATUS_TITLE = '请假状态更新为什么值'
const OWNER_ANSWER = '表单内成员字段'

const OWNER_OPTIONS = [
  { value: 'form_member_field', label: OWNER_ANSWER },
  { value: 'department_manager', label: '部门主管' },
]
const STATUS_OPTIONS = [
  { value: '已通过', label: '已通过' },
  { value: '已批准', label: '已批准' },
  { value: 'approved', label: 'approved' },
]

const ownerRecord = (confirmed: boolean) => ({
  id: 'flow-approval-owner',
  decisionKey: 'flow.approval.owner.source',
  title: OWNER_TITLE,
  questionKind: 'single_select',
  required: true,
  allowFreeText: true,
  personnelDecision: { stepKey: 'approval_teacher', slot: 'source' },
  options: OWNER_OPTIONS,
  ...(confirmed
    ? {
      confirmed: true,
      selectedOptionValue: 'form_member_field',
      answerSummary: OWNER_ANSWER,
      answerDetail: '班主任',
    }
    : { confirmed: false }),
})

const statusRecord = (confirmed: boolean) => ({
  id: 'flow-write-status-value',
  decisionKey: 'flow.write.field:update_status_approved',
  title: STATUS_TITLE,
  questionKind: 'single_select',
  required: true,
  allowFreeText: true,
  options: STATUS_OPTIONS,
  ...(confirmed ? { confirmed: true } : { confirmed: false }),
})

const ownerDecision = {
  questionId: 'flow-approval-owner',
  questionTitle: OWNER_TITLE,
  decisionKey: 'flow.approval.owner.source',
  decisionKeySource: 'explicit',
  selectedOptionValue: 'form_member_field',
  answerSummary: OWNER_ANSWER,
  answerDetail: '班主任',
  planningContextKey: PLANNING_CONTEXT_KEY,
}

const structuredReply = [
  '当前卡片的问题，我已逐项确认如下：',
  `1. ${OWNER_TITLE}`,
  `   回答： ${OWNER_ANSWER}`,
  '   说明： 班主任',
].join('\n')

const buildFlowSummary = (input: {
  ownerConfirmed: boolean
  decisions: unknown[]
  resultSummary: string[]
  openQuestions: string[]
}) => ({
  userGoal: '继续生成',
  latestAction: 'editor_plan_flow_scheme',
  flowConfirmationContextKey: PLANNING_CONTEXT_KEY,
  flowConfirmationSchemeRevision: 4,
  flowConfirmationStatus: 'pending',
  flowConfirmationQuestions: [OWNER_TITLE, STATUS_TITLE],
  flowConfirmationQuestionRecords: [
    ownerRecord(input.ownerConfirmed),
    statusRecord(false),
  ],
  flowConfirmationDecisions: input.decisions,
  flowConfirmationResultSummary: input.resultSummary,
  flowOpenQuestions: input.openQuestions,
  openQuestions: input.openQuestions,
  updatedAt: 1793192269000,
})

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
)

const pickFlowState = (summary: unknown) => {
  const record = asRecord(summary)
  const records = Array.isArray(record.flowConfirmationQuestionRecords)
    ? record.flowConfirmationQuestionRecords.map(item => asRecord(item))
    : []
  return {
    status: typeof record.flowConfirmationStatus === 'string' ? record.flowConfirmationStatus : undefined,
    openQuestions: Array.isArray(record.flowOpenQuestions)
      ? record.flowOpenQuestions as string[]
      : [],
    resultSummary: Array.isArray(record.flowConfirmationResultSummary)
      ? record.flowConfirmationResultSummary as string[]
      : [],
    records: records.map(question => ({
      id: typeof question.id === 'string' ? question.id : undefined,
      confirmed: question.confirmed === true,
      selectedOptionValue: typeof question.selectedOptionValue === 'string'
        ? question.selectedOptionValue
        : undefined,
      answerSummary: typeof question.answerSummary === 'string' ? question.answerSummary : undefined,
    })),
  }
}

const assertStatusQuestionStaysPending = (state: ReturnType<typeof pickFlowState>) => {
  const statusState = state.records.find(record => record.id === 'flow-write-status-value')
  assert.ok(statusState, '状态题必须保留在记录里')
  assert.notEqual(statusState!.confirmed, true, '状态题不能被写成已确认')
  assert.equal(statusState!.answerSummary, undefined, '状态题不能带上第 1 题的结论')
  assert.equal(state.status, 'pending')
  assert.deepEqual(state.openQuestions, [STATUS_TITLE])
  assert.deepEqual(
    (state.resultSummary || []).filter(value => value === OWNER_ANSWER),
    [OWNER_ANSWER],
    '确认结论只能出现一次，不能被复制到状态题',
  )
}

// 1. 请求注入摘要：本轮答案已合并进摘要后，组装 prompt 历史时又拿同一句结构化回复补全，
//    不能把回复里“上一题”的答案按顺序塞给仍待答的状态题。
const mergedSummary = buildFlowSummary({
  ownerConfirmed: true,
  decisions: [ownerDecision],
  resultSummary: [OWNER_ANSWER],
  openQuestions: [STATUS_TITLE],
})
const providerMessages = buildNocodeEditorTaskHistoryForProvider({
  messages: [
    { role: 'user', content: '继续生成', metadata: { traceId: 'trace-turn-1' } },
    { role: 'assistant', content: '流程方案已暂存成功。', metadata: { traceId: 'trace-turn-1' } },
    { role: 'user', content: structuredReply, metadata: { traceId: 'trace-turn-2' } },
  ],
  maxVisibleMessages: 20,
  latestTaskSummary: mergedSummary,
})
const injectedSummaryMessage = providerMessages.find(message => (
  String(message.content || '').startsWith('当前任务摘要：')
))
assert.ok(injectedSummaryMessage, '必须注入任务摘要')
const injectedSummary = JSON.parse(
  String(injectedSummaryMessage!.content).replace('当前任务摘要：', ''),
)
assertStatusQuestionStaysPending(pickFlowState(injectedSummary))

// 2. 首次合并路径仍然要把本轮答案写进第 1 题，且不影响第 2 题。
const beforeReplySummary = buildFlowSummary({
  ownerConfirmed: false,
  decisions: [],
  resultSummary: [],
  openQuestions: [OWNER_TITLE, STATUS_TITLE],
})
const afterMergeSummary = resolveNocodeEditorTaskSummaryForIncomingUserMessage({
  latestTaskSummary: beforeReplySummary,
  userMessage: structuredReply,
  updatedAt: 1793192270000,
  confirmationDecisions: {
    stage: 'flow-scheme',
    planningContextKey: PLANNING_CONTEXT_KEY,
    schemeRevision: 4,
    decisions: [ownerDecision],
  },
})
const mergedState = pickFlowState(afterMergeSummary)
assert.deepEqual(
  mergedState.records.find(record => record.id === 'flow-approval-owner'),
  {
    id: 'flow-approval-owner',
    confirmed: true,
    selectedOptionValue: 'form_member_field',
    answerSummary: OWNER_ANSWER,
  },
)
assertStatusQuestionStaysPending(mergedState)

// 3. 渲染层从回复反推确认结果时，同样不能按下标兜底：回复里只有已答题的条目时，
//    不得用它坐实仍待答的另一题。
i18next.init({
  lng: 'zh-CN',
  initImmediate: false,
  resources: {
    'zh-CN': {
      translation: {
        confirmationInteraction: {
          replyLead: '当前卡片的问题，我已逐项确认如下：',
          selectedOptionPrefix: '回答：',
          additionalNotePrefix: '说明：',
          pendingQuestion: '待确认问题 {{index}}',
          viewFullConfirmationRecord: '查看完整确认记录',
        },
      },
    },
  },
})

const derivedConfirmation = deriveCompletedConfirmationFromReplyMessage(
  {
    stage: 'flow-scheme',
    status: 'pending',
    planningContextKey: PLANNING_CONTEXT_KEY,
    schemeRevision: 4,
    questions: [
      { ...statusRecord(false), id: 'flow-write-status-value' },
      {
        ...ownerRecord(true),
        options: OWNER_OPTIONS.map(option => ({
          ...option,
          selected: option.value === 'form_member_field',
        })),
      },
    ],
  } as unknown as Parameters<typeof deriveCompletedConfirmationFromReplyMessage>[0],
  structuredReply,
)
assert.equal(
  derivedConfirmation,
  null,
  '回复条目对不上待答题时不能按顺序兜底确认',
)

// 4. 蓝图确认题的回复行带 “[表单 · 字段]” 前缀，去掉前缀后仍要按题面对上号。
const scopedReply = [
  '当前卡片的问题，我已逐项确认如下：',
  `1. [请假单 · 审批人] ${OWNER_TITLE}`,
  `   回答： ${OWNER_ANSWER}`,
  '   说明： 班主任',
  `2. [请假单 · 状态] ${STATUS_TITLE}`,
  '   回答： 已通过',
].join('\n')
const derivedScopedConfirmation = deriveCompletedConfirmationFromReplyMessage(
  {
    stage: 'form-blueprint',
    status: 'pending',
    questions: [
      { ...ownerRecord(false), id: 'flow-approval-owner' },
      { ...statusRecord(false), id: 'flow-write-status-value' },
    ],
  } as unknown as Parameters<typeof deriveCompletedConfirmationFromReplyMessage>[0],
  scopedReply,
)
assert.deepEqual(
  derivedScopedConfirmation?.questions.map(question => (
    question.confirmed === true ? question.answerSummary : null
  )),
  [OWNER_ANSWER, '已通过'],
  '带作用域前缀的回复仍要按题面结算到对应题目',
)

console.log('flow confirmation cumulative reply binding regression passed')
