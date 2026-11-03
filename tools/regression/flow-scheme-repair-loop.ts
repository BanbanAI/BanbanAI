import assert from 'node:assert/strict'

import { projectModelActionableFlowDecisionDiagnostics } from '../../src/common/utils/nocodeEditorFlowDecisionGraph'
import {
  buildFlowSchemeTextSalvageRetryMessage,
  extractFlowSchemeFromAssistantText,
  FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS,
  FLOW_STRUCTURE_ASSUMPTION_STOP_LOSS_MESSAGE,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-scheme-repair.util'
import { resolveRepeatedFlowSchemeError } from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-output-contract'
import {
  buildRestoredFlowBlueprintPreflightPrompt,
  restoreFlowBlueprintPreflightStateFromHistory,
  resolveFlowBlueprintPreflightStopDecision,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-blueprint-preflight.util'
import { initTestI18n } from './test-i18n'

initTestI18n()

// 1) 结构假设失败属于模型可自修的问题，必须回传诊断
assert.equal(FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS.has('flow-structure-assumption-unconfirmed'), true)

// 2) 回传的诊断保留可读原因与定位键
assert.deepEqual(
  projectModelActionableFlowDecisionDiagnostics([{
    code: 'structure_assumption_question_missing',
    message: '结构假设“按金额分流”引用的确认题「flow.approval.structure」不在方案里',
    decisionKey: 'flow.approval.structure',
    dependencyKey: 'amount_threshold',
  }]),
  [{
    code: 'structure_assumption_question_missing',
    message: '结构假设“按金额分流”引用的确认题「flow.approval.structure」不在方案里',
    decisionKey: 'flow.approval.structure',
    dependencyKey: 'amount_threshold',
  }],
)

const failedSchemeResult = (
  code: string,
  message: string,
  decisionKey: string,
) => ({
  name: 'editor_plan_flow_scheme',
  ok: false,
  metadata: {
    flowUnifiedIssues: [{
      issueId: 'flow-structure-assumption-unconfirmed',
      userMessage: '流程方案把一部分结构选择当成了默认假设',
      diagnostics: [{ code, message, decisionKey }],
    }],
  },
})

// 3) 两条不同的结构诊断连续出现 → 停止盲试，给出业务语言
assert.equal(
  resolveRepeatedFlowSchemeError([
    failedSchemeResult(
      'structure_assumption_question_missing',
      '结构假设引用的确认题缺失',
      'flow.approval.structure',
    ),
    failedSchemeResult(
      'structure_assumption_dependent_missing',
      '下游确认题引用了不存在的问题',
      'flow.approval.level',
    ),
  ]),
  FLOW_STRUCTURE_ASSUMPTION_STOP_LOSS_MESSAGE,
)

// 4) 中间有一次成功提交 → 计数清零，不误报
assert.equal(
  resolveRepeatedFlowSchemeError([
    failedSchemeResult('structure_assumption_question_missing', '缺结构题', 'flow.approval.structure'),
    { name: 'editor_plan_flow_scheme', ok: true, metadata: {} },
    failedSchemeResult('structure_assumption_dependent_missing', '下游题缺失', 'flow.approval.level'),
  ]),
  '',
)

// 5) 其它流程方案问题仍按原指纹收敛，不被结构类聚合吞掉
assert.equal(
  resolveRepeatedFlowSchemeError([
    {
      name: 'editor_plan_flow_scheme',
      ok: false,
      metadata: {
        flowUnifiedIssues: [{
          issueId: 'flow-personnel-step-reference-missing',
          userMessage: '审批人指向的节点不存在',
          diagnostics: [{ code: 'flow_personnel_step_reference_missing', message: '审批人指向的节点不存在' }],
        }],
      },
    },
    {
      name: 'editor_plan_flow_scheme',
      ok: false,
      metadata: {
        flowUnifiedIssues: [{
          issueId: 'flow-personnel-step-reference-missing',
          userMessage: '审批人指向的节点不存在',
          diagnostics: [{ code: 'flow_personnel_step_reference_missing', message: '审批人指向的节点不存在' }],
        }],
      },
    },
  ]),
  '审批人指向的节点不存在',
)

const salvagedScheme = {
  title: '报销申请审批流程方案',
  summary: '员工提交报销申请后，按金额分流',
  mainPath: [{ key: 'submit', type: 'start', title: '提交报销申请' }],
  assumptions: [{ text: '采用金额分流模式', impact: 'structure', decisionKey: 'flow.split_basis' }],
  openQuestions: [],
  confirmation: { status: 'pending', questions: [] },
}

// 6) 复刻第 2 轮：正文里是解释 + 完整方案 JSON，必须能原样提取
const roundTwoText = [
  '好的，我按金额分流来设计报销审批流程：',
  '```json',
  JSON.stringify({ scheme: salvagedScheme }, null, 2),
  '```',
  '如果金额阈值需要调整，告诉我即可。',
].join('\n')
assert.equal(
  extractFlowSchemeFromAssistantText(roundTwoText)?.scheme.title,
  '报销申请审批流程方案',
)

// 7) 截断的 arguments / 没有 scheme 包裹的对象都不能猜
assert.equal(
  extractFlowSchemeFromAssistantText('{"scheme": {"title": "报销申请审批流程'),
  null,
)
assert.equal(extractFlowSchemeFromAssistantText('{"title": "报销申请审批流程方案"}'), null)

// 8) 字符串里带花括号不影响配对
assert.equal(
  extractFlowSchemeFromAssistantText(JSON.stringify({
    scheme: { ...salvagedScheme, summary: '金额 } 与 { 都要按原样保留' },
  }))?.scheme.summary,
  '金额 } 与 { 都要按原样保留',
)

// 9) 回收提示要指明工具和原方案，避免模型重新规划
const salvageMessage = buildFlowSchemeTextSalvageRetryMessage(salvagedScheme)
assert.equal(salvageMessage.includes('editor_plan_flow_scheme'), true)
assert.equal(salvageMessage.includes('"title": "报销申请审批流程方案"'), true)
assert.equal(salvageMessage.includes('不要重新规划'), true)

// 10) 蓝图续跑恢复：失败原因要带回去；人员来源类失败不能再要求沿用失败蓝图骨架
const completedSchemeExchange = {
  name: 'editor_plan_flow_scheme',
  ok: true,
  output: {
    // 现场结构：模型为绕过契约报错把方案压扁成一个审批步骤
    scheme: {
      id: 'flow-scheme-project-001',
      title: '项目管理表流程',
      confirmation: { status: 'completed' },
      openQuestions: [],
    },
    planningStatus: 'ready_for_review',
  },
  metadata: {},
}
const failedBlueprintExchange = (code: string) => ({
  name: 'editor_stage_flow_blueprint',
  ok: false,
  error: '流程蓝图中的人员来源与已收敛流程方案不一致。',
  metadata: {
    input: {
      blueprint: {
        triggerBranches: [
          { branchKey: 'branch-setup', nodes: [{ nodeKey: 'step-approval-setup', type: 'approval' }] },
          { branchKey: 'branch-close', nodes: [{ nodeKey: 'step-approval-close', type: 'approval' }] },
        ],
      },
    },
    flowUnifiedIssues: [{
      issueId: 'flow-blueprint-personnel-reference-inconsistent',
      diagnostics: [{ code }],
    }],
  },
})
const preflightHistory = (code: string) => [
  { metadata: { modelToolExchangeResult: completedSchemeExchange } },
  { metadata: { modelToolExchangeResult: failedBlueprintExchange(code) } },
]
const restorePreflight = (code: string) => restoreFlowBlueprintPreflightStateFromHistory({
  messages: preflightHistory(code),
  userMessage: '继续生成流程蓝图',
  now: 1_790_000_000_000,
})

const personnelRestoreState = restorePreflight('flow_personnel_source_mismatch')
assert.equal(personnelRestoreState?.lastFailureCode, 'flow_personnel_source_mismatch')
const personnelRestorePrompt = buildRestoredFlowBlueprintPreflightPrompt(personnelRestoreState!)
assert.equal(personnelRestorePrompt.includes('人员来源与已确认方案不一致'), true)
assert.equal(personnelRestorePrompt.includes('沿用其中的 nodeKey/branchKey'), false)
assert.equal(personnelRestorePrompt.includes('step-approval-setup'), false)

const otherRestoreState = restorePreflight('blueprint_approval_owner_dependency_missing')
assert.equal(otherRestoreState?.lastFailureCode, 'blueprint_approval_owner_dependency_missing')
const otherRestorePrompt = buildRestoredFlowBlueprintPreflightPrompt(otherRestoreState!)
assert.equal(otherRestorePrompt.includes('blueprint_approval_owner_dependency_missing'), true)
assert.equal(otherRestorePrompt.includes('沿用其中的 nodeKey/branchKey'), true)

// 11) 收口文案要给出可执行下一步，而不是“请重新继续”
const stopDecision = resolveFlowBlueprintPreflightStopDecision({
  state: {
    ...personnelRestoreState!,
    reminderCount: 1,
  },
  now: 1_790_000_001_000,
  hasSuccessfulBlueprintCall: false,
})
assert.equal(stopDecision.kind, 'finish')
assert.equal(
  stopDecision.kind === 'finish' && stopDecision.assistantMessage.includes('继续生成流程蓝图'),
  true,
)
assert.equal(stopDecision.kind === 'finish' && stopDecision.assistantMessage.includes('请重新继续'), false)

console.log('flow-scheme-repair-loop: ok')
