import assert from 'node:assert/strict'

import {
  applyNocodeEditorFlowConfirmationTrust,
} from '../../src/common/utils/nocodeEditorFlowConfirmationTrust'
import {
  normalizeNocodeEditorFlowScheme,
  type NocodeEditorFlowScheme,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import {
  buildUnifiedFlowIssuesFromFlowScheme,
} from '../../src/common/utils/nocodeEditorFlowUnifiedIssue'
import {
  projectFlowIssueRouteToLegacyFields,
  routeUnifiedFlowIssues,
} from '../../src/common/utils/nocodeEditorFlowIssueRouter'
import {
  resolveFlowConfirmationPendingQuestionProjection,
} from '../../src/common/utils/nocodeEditorFlowConfirmationPendingQuestions'

// 2026-10-28 真实会话 editor_b39gvfqji2n6_..._fc8t83 的模型原始 payload：
// 用户用聊天消息给出金额分流规则后，模型把规则写进 branches，
// 同时自建一道 note_only 结构题并自答 confirmed:true，openQuestions 为空。
const PLANNING_CONTEXT_KEY = 'flow-scheme:scheme_1793151052169:t_xj5ehxyy00os'
const capturedRawScheme = {
  target: { formId: 't_xj5ehxyy00os', formName: '报销单' },
  title: '报销单审批流程',
  summary: '提交报销单后按合计金额分流：1000元以内由财务审批；1000元以上先由财务审批，再由部门主管审批。',
  trigger: { type: 'submit', description: '提交报销单后自动发起审批' },
  mainPath: [],
  branches: [{
    key: 'branch_under_1000',
    title: '1000元以内',
    when: '合计金额 ≤ 1000元',
    steps: [{
      key: 'finance_approval_under',
      kind: 'approval',
      title: '财务审批',
      intent: '由财务角色审批报销单',
      personnelRequirement: {
        sourceType: 'fixed_roles',
        roleRefs: [{ id: '7r9rfhv36n1650969rns', name: '财务' }],
      },
    }],
  }, {
    key: 'branch_over_1000',
    title: '1000元以上',
    when: '合计金额 > 1000元',
    steps: [{
      key: 'finance_approval_over',
      kind: 'approval',
      title: '财务审批',
      intent: '由财务角色审批报销单',
      personnelRequirement: {
        sourceType: 'fixed_roles',
        roleRefs: [{ id: '7r9rfhv36n1650969rns', name: '财务' }],
      },
    }, {
      key: 'dept_manager_approval',
      kind: 'approval',
      title: '部门主管审批',
      intent: '由提交人的部门主管审批',
      personnelRequirement: {
        sourceType: 'department_manager',
        departmentManager: { mode: 'up', level: 1 },
      },
    }],
  }],
  confirmedFacts: [
    '触发方式：提交报销单后自动发起审批',
    '条件字段：合计金额（f_bkdzsere0baz）',
    '分流阈值：1000元',
    '财务审批人：财务角色',
    '部门主管审批人：提交人的部门主管（向上1级）',
  ],
  assumptions: [],
  openQuestions: [],
  confirmation: {
    status: 'completed',
    summary: '流程结构已按金额分流确认完成',
    completionSummary: '已确认按合计金额分流：1000元以内仅财务审批；1000元以上先财务审批再部门主管审批。',
    resultSummary: ['将按当前方案生成流程蓝图'],
    questions: [{
      id: 'flow-structure-confirmed',
      decisionKey: 'flow.structure.amount_split',
      title: '按报销总金额分流审批',
      questionKind: 'note_only',
      dependsOn: [],
      confirmed: true,
      answerSummary: '1000元以内：财务审批；1000元以上：财务审批 → 部门主管审批',
      decisionScope: { kind: 'flow', id: 't_xj5ehxyy00os' },
      requiresFacts: [],
      producesFacts: ['flow.structure.amount_split'],
      changes: ['topology', 'scope', 'cardinality'],
    }],
    decisionContractVersion: 2,
    factSnapshot: {},
  },
} satisfies Record<string, unknown>

const pendingQuestionKeys = (scheme: NocodeEditorFlowScheme) => (
  resolveFlowConfirmationPendingQuestionProjection({
    questions: scheme.confirmation?.questions || [],
    factSnapshot: scheme.confirmation?.factSnapshot || {},
    requireReady: true,
  }).pendingQuestions.map(question => (
    String(question.decisionKey || question.id || '').trim()
  )).filter(Boolean)
)

const projectStagedQuestion = (scheme: NocodeEditorFlowScheme) => {
  const planningContextKey = String(scheme.confirmation?.planningContextKey || '').trim() || undefined
  const issues = buildUnifiedFlowIssuesFromFlowScheme({ scheme, planningContextKey })
  const routing = routeUnifiedFlowIssues(issues)
  return {
    issueIds: issues.map(issue => issue.issueId),
    routing,
    projection: projectFlowIssueRouteToLegacyFields({
      issues,
      routing,
      planningContextKey,
    }),
  }
}

// 旧顺序：先按模型自答归一化，再在收尾剥离自答。
const oldOrderScheme = normalizeNocodeEditorFlowScheme(capturedRawScheme)
assert.ok(oldOrderScheme)
assert.equal(oldOrderScheme.confirmation?.status, 'completed')
assert.deepEqual(oldOrderScheme.openQuestions, [])

const oldOrderStrippedConfirmation = applyNocodeEditorFlowConfirmationTrust({
  confirmation: oldOrderScheme.confirmation,
  planningContextKey: PLANNING_CONTEXT_KEY,
}).confirmation
assert.equal(oldOrderStrippedConfirmation?.status, 'pending')
// 错位：confirmation 已经 pending，openQuestions 还是空的，
// 待答题只能由问题路由的白名单投影重建（重问题的 key 落成模型自造的题目 id）。
const oldOrderSchemeAfterStrip: NocodeEditorFlowScheme = {
  ...oldOrderScheme,
  confirmation: oldOrderStrippedConfirmation,
}
assert.deepEqual(oldOrderSchemeAfterStrip.openQuestions, [])
assert.deepEqual(pendingQuestionKeys(oldOrderSchemeAfterStrip), ['flow.structure.amount_split'])
const oldOrderStaged = projectStagedQuestion(oldOrderSchemeAfterStrip)
assert.equal(oldOrderStaged.routing.outcome, 'return_to_flow_scheme')
// #4a 后 issue 身份与作答键同源：即使题只在 confirmation 里，issueId 也取 decisionKey。
assert.deepEqual(oldOrderStaged.issueIds, ['flow.structure.amount_split'])
assert.deepEqual(
  oldOrderStaged.projection.confirmation?.questions.map(question => question.decisionKey),
  ['flow.structure.amount_split'],
)

// 新顺序：剥离/回填发生在决策图投影之前，openQuestions/status 与答案集同源。
const trustAppliedScheme = normalizeNocodeEditorFlowScheme(capturedRawScheme, {
  trustedAnswers: {
    planningContextKey: PLANNING_CONTEXT_KEY,
    decisions: [],
  },
})
assert.ok(trustAppliedScheme)
assert.equal(trustAppliedScheme.confirmation?.status, 'pending')
assert.equal(trustAppliedScheme.confirmation?.planningContextKey, PLANNING_CONTEXT_KEY)
assert.equal(trustAppliedScheme.confirmation?.completionSummary, undefined)
assert.equal(trustAppliedScheme.confirmation?.resultSummary, undefined)
assert.deepEqual(
  trustAppliedScheme.openQuestions.map(question => question.key),
  ['flow.structure.amount_split'],
)
// 待答题与 openQuestions 是同一份投影：不会再出现「pending 但没有 openQuestion」。
assert.deepEqual(pendingQuestionKeys(trustAppliedScheme), ['flow.structure.amount_split'])
const trustAppliedQuestion = trustAppliedScheme.confirmation?.questions
  .find(question => question.decisionKey === 'flow.structure.amount_split')
assert.ok(trustAppliedQuestion)
assert.equal(trustAppliedQuestion.confirmed, false)
assert.equal(trustAppliedQuestion.decisionScope?.kind, 'flow')
assert.equal(trustAppliedQuestion.decisionScope?.id, 't_xj5ehxyy00os')

// 重问的题来自原始题：issue 身份用决策键，而不是模型自造的题目 id。
const trustAppliedStaged = projectStagedQuestion(trustAppliedScheme)
assert.equal(trustAppliedStaged.routing.outcome, 'return_to_flow_scheme')
assert.deepEqual(trustAppliedStaged.issueIds, ['flow.structure.amount_split'])
assert.deepEqual(
  trustAppliedStaged.projection.openQuestions?.map(question => question.key),
  ['flow.structure.amount_split'],
)
assert.deepEqual(
  trustAppliedStaged.projection.confirmation?.questions.map(question => question.decisionKey),
  ['flow.structure.amount_split'],
)

// 用户答复回传后（本轮可信决策）同一入口直接收敛，不再重问。
const answeredScheme = normalizeNocodeEditorFlowScheme(capturedRawScheme, {
  trustedAnswers: {
    planningContextKey: PLANNING_CONTEXT_KEY,
    decisions: [{
      decisionKey: 'flow.structure.amount_split',
      answerSummary: '1000元以内：财务审批；1000元以上：财务审批 → 部门主管审批',
    }],
  },
})
assert.ok(answeredScheme)
assert.equal(answeredScheme.confirmation?.status, 'completed')
assert.deepEqual(answeredScheme.openQuestions, [])
assert.deepEqual(pendingQuestionKeys(answeredScheme), [])
assert.equal(projectStagedQuestion(answeredScheme).routing.outcome, 'auto_continue')

// #4a 决策身份统一：题只存在于 confirmation、openQuestions 为空时，
// issueId 取 decisionKey（而不是模型自造的题目 id）。
const confirmationOnlyScheme: NocodeEditorFlowScheme = {
  ...trustAppliedScheme,
  openQuestions: [],
}
const confirmationOnlyIssueIds = (scheme: NocodeEditorFlowScheme) => (
  buildUnifiedFlowIssuesFromFlowScheme({
    scheme,
    planningContextKey: PLANNING_CONTEXT_KEY,
  }).map(issue => issue.issueId)
)
const firstIssueIds = confirmationOnlyIssueIds(confirmationOnlyScheme)
assert.deepEqual(firstIssueIds, ['flow.structure.amount_split'])
// 同一方案二次构建 issueId 不变：issue 每次从方案重建，不依赖持久化迁移。
assert.deepEqual(confirmationOnlyIssueIds(confirmationOnlyScheme), firstIssueIds)

console.log('flow-scheme-trusted-answer-order: ok')
console.log('  旧顺序 issue:', oldOrderStaged.issueIds.join(','), '| openQuestions:', oldOrderScheme.openQuestions.length)
console.log('  新顺序 issue:', trustAppliedStaged.issueIds.join(','), '| openQuestions:', trustAppliedScheme.openQuestions.map(question => question.key).join(','))
console.log('  回传答案后:', answeredScheme.confirmation?.status)
