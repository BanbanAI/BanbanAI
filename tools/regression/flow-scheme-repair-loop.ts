import assert from 'node:assert/strict'

import { projectModelActionableFlowDecisionDiagnostics } from '../../src/common/utils/nocodeEditorFlowDecisionGraph'
import {
  buildFlowSchemeTextSalvageRetryMessage,
  extractFlowSchemeFromAssistantText,
  FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS,
  FLOW_STRUCTURE_ASSUMPTION_STOP_LOSS_MESSAGE,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-scheme-repair.util'
import { resolveRepeatedFlowSchemeError } from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-output-contract'

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

console.log('flow-scheme-repair-loop: ok')
