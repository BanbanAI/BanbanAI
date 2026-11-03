import assert from 'node:assert/strict'

import {
  resolveNocodeEditorAppliedPrimaryForm,
} from '../../src/common/utils/nocodeEditorAppliedFlowTarget'
import {
  buildNocodeEditorPendingFlowIntentFromEntryFlowIntent,
  resolveNocodeEditorPendingFlowIntentAfterBlueprintApply,
  shouldBlockNocodeEditorPendingFlowIntentRebind,
} from '../../src/common/utils/nocodeEditorPendingFlowIntent'
import { decideNocodeEditorPostFormFlowFollowUp } from '../../src/common/utils/nocodeEditorPostFormFlowFollowUp'
import { resolveNocodeEditorPostFormFlowRelease } from '../../src/common/utils/nocodeEditorPostFormFlowRelease'

// 真实会话形状：模型声明的请假申请表 + 归一化补进来的来源表
const leaveApplyForms = [
  {
    applyTargetKey: 'form-1',
    formKey: 'form-1',
    tableId: 't_63hioldt2wfc',
    tableName: '学生请假申请表',
  },
  {
    applyTargetKey: 'group:|table:学生信息管理表',
    formKey: '学生信息管理表',
    tableId: 't_fmnpy15v982w',
    tableName: '学生信息管理表',
  },
]

assert.deepEqual(
  resolveNocodeEditorAppliedPrimaryForm(leaveApplyForms),
  { targetFormId: 't_63hioldt2wfc', targetFormName: '学生请假申请表' },
)

// 单表批次（模型没给 formKey 也要认）
assert.deepEqual(
  resolveNocodeEditorAppliedPrimaryForm([
    { applyTargetKey: 'group:|table:报销单', formKey: '报销单', tableId: 't_reimbursement', tableName: '报销单' },
  ]),
  { targetFormId: 't_reimbursement', targetFormName: '报销单' },
)

// 多表都是模型声明（应用级蓝图）→ 认不出主表单，不猜
assert.deepEqual(
  resolveNocodeEditorAppliedPrimaryForm([
    { applyTargetKey: 'form-1', formKey: 'form-1', tableId: 't_a', tableName: 'A' },
    { applyTargetKey: 'form-2', formKey: 'form-2', tableId: 't_b', tableName: 'B' },
  ]),
  {},
)

// 表单规划会把当前表单关联到的来源表一起生成；流程推荐只针对当前规划的表单。
// 真实会话形状：蓝图声明了请假申请表 + 学生信息管理表，规划上下文的 primaryFormKey 指向请假申请表。
const multiDeclaredLeaveForms = [
  { applyTargetKey: 'form-leave', formKey: 'form-leave', tableId: 't_leave', tableName: '学生请假申请表' },
  { applyTargetKey: 'form-student', formKey: 'form-student', tableId: 't_student', tableName: '学生信息管理表' },
]
assert.deepEqual(
  resolveNocodeEditorAppliedPrimaryForm(multiDeclaredLeaveForms, { primaryFormKey: 'form-leave' }),
  { targetFormId: 't_leave', targetFormName: '学生请假申请表' },
)
// primaryFormKey 退化成表名时也要认
assert.deepEqual(
  resolveNocodeEditorAppliedPrimaryForm(multiDeclaredLeaveForms, { primaryFormKey: '学生请假申请表' }),
  { targetFormId: 't_leave', targetFormName: '学生请假申请表' },
)
// 没有 primaryFormKey 时用蓝图标题兜底
assert.deepEqual(
  resolveNocodeEditorAppliedPrimaryForm(multiDeclaredLeaveForms, { primaryFormName: '学生请假申请表' }),
  { targetFormId: 't_leave', targetFormName: '学生请假申请表' },
)
// 提示对不上任何一张表单 → 仍不猜
assert.deepEqual(
  resolveNocodeEditorAppliedPrimaryForm(multiDeclaredLeaveForms, {
    primaryFormKey: 'form-other',
    primaryFormName: '报销单',
  }),
  {},
)
// 多表都没有 formKey → 同样认不出
assert.deepEqual(
  resolveNocodeEditorAppliedPrimaryForm([
    { applyTargetKey: 'group:|table:A', formKey: 'A', tableId: 't_a', tableName: 'A' },
    { applyTargetKey: 'group:|table:B', formKey: 'B', tableId: 't_b', tableName: 'B' },
  ]),
  {},
)
// 脏输入 / 空批次
assert.deepEqual(resolveNocodeEditorAppliedPrimaryForm(null), {})
assert.deepEqual(resolveNocodeEditorAppliedPrimaryForm([null, {}, { tableId: '   ' }]), {})
// 同一张表出现两次只算一张
assert.deepEqual(
  resolveNocodeEditorAppliedPrimaryForm([leaveApplyForms[1], leaveApplyForms[1]]),
  { targetFormId: 't_fmnpy15v982w', targetFormName: '学生信息管理表' },
)

// 旧需求：入口意图还写着报销单，本次落地的是请假申请表 → 不建挂账
const staleReimbursementEntryIntent = {
  state: 'explicit_positive' as const,
  sourceUserMessage: '创建一个报销单，需要有审批流程',
  evidence: ['需要有审批流程'],
  targetFormName: '报销单',
}
assert.equal(
  resolveNocodeEditorPendingFlowIntentAfterBlueprintApply({
    entryFlowIntent: staleReimbursementEntryIntent,
    appliedForms: leaveApplyForms,
    now: 1,
  }),
  null,
)
// 同一句话里要求的是请假申请表 → 建挂账，且带 id+name
const leaveEntryIntent = {
  state: 'explicit_positive' as const,
  sourceUserMessage: '创建一个学生请假申请表，需要有审批流程',
  evidence: ['需要有审批流程'],
  targetFormName: '学生请假申请表',
}
assert.deepEqual(
  resolveNocodeEditorPendingFlowIntentAfterBlueprintApply({
    entryFlowIntent: leaveEntryIntent,
    appliedForms: leaveApplyForms,
    now: 2,
  }),
  {
    status: 'pending_after_form_apply',
    sourceUserMessage: '创建一个学生请假申请表，需要有审批流程',
    evidence: ['需要有审批流程'],
    targetFormId: 't_63hioldt2wfc',
    targetFormName: '学生请假申请表',
    createdAt: 2,
    updatedAt: 2,
  },
)
// 认不出主表单 → 一律不建挂账（即使入口意图是正向）
assert.equal(
  resolveNocodeEditorPendingFlowIntentAfterBlueprintApply({
    entryFlowIntent: leaveEntryIntent,
    appliedForms: [
      { applyTargetKey: 'form-1', formKey: 'form-1', tableId: 't_a', tableName: 'A' },
      { applyTargetKey: 'form-2', formKey: 'form-2', tableId: 't_b', tableName: 'B' },
    ],
    now: 3,
  }),
  null,
)
// 多表批次带规划上下文提示 → 挂账绑到当前规划表单，不绑来源表
assert.deepEqual(
  resolveNocodeEditorPendingFlowIntentAfterBlueprintApply({
    entryFlowIntent: leaveEntryIntent,
    appliedForms: multiDeclaredLeaveForms,
    primaryFormKey: 'form-leave',
    now: 6,
  }),
  {
    status: 'pending_after_form_apply',
    sourceUserMessage: '创建一个学生请假申请表，需要有审批流程',
    evidence: ['需要有审批流程'],
    targetFormId: 't_leave',
    targetFormName: '学生请假申请表',
    createdAt: 6,
    updatedAt: 6,
  },
)
// 入场意图点名的是另一张表 → 阻断重绑，不建挂账
assert.equal(
  resolveNocodeEditorPendingFlowIntentAfterBlueprintApply({
    entryFlowIntent: staleReimbursementEntryIntent,
    appliedForms: multiDeclaredLeaveForms,
    primaryFormKey: 'form-student',
    now: 7,
  }),
  null,
)

// 面板组合：旧入口意图 + 请假申请表批次 → 不拦截重绑但也不复活挂账
const primary = resolveNocodeEditorAppliedPrimaryForm(leaveApplyForms)
const completedReimbursementPending = {
  status: 'completed' as const,
  sourceUserMessage: '创建一个报销单，需要有审批流程',
  evidence: ['需要有审批流程'],
  targetFormId: 't_fhany4z9xjo0',
  targetFormName: '报销单',
  createdAt: 1,
  updatedAt: 2,
  completedByTool: 'editor_apply_staged_flow' as const,
}
assert.equal(
  shouldBlockNocodeEditorPendingFlowIntentRebind({
    entryFlowIntent: staleReimbursementEntryIntent,
    existingPendingFlowIntent: completedReimbursementPending,
    candidateTargetFormId: primary.targetFormId,
    candidateTargetFormName: primary.targetFormName,
  }),
  true,
)

// 卡片必须带本次落地表单的目标；不是 explicit_flow_clarification，也不自动续跑
const recommendationFollowUp = decideNocodeEditorPostFormFlowFollowUp({
  planningScope: 'form',
  entryFlowIntent: null,
  pendingFlowIntent: null,
  postFormFlowOpportunity: null,
  postFormFlowSignals: null,
  targetFormId: primary.targetFormId,
  targetFormName: primary.targetFormName,
})
assert.notEqual(recommendationFollowUp?.kind, 'explicit_flow_clarification')
assert.equal(recommendationFollowUp?.targetFormId, 't_63hioldt2wfc')
assert.equal(recommendationFollowUp?.targetFormName, '学生请假申请表')
assert.equal(
  resolveNocodeEditorPostFormFlowRelease({
    planningScope: 'form',
    persistenceMode: 'saved',
    pendingFlowIntent: null,
    targetFormId: primary.targetFormId,
    targetFormName: primary.targetFormName,
  }).shouldAutoContinue,
  false,
)

// 同一张表上仍有显式需求时，显式澄清照旧成立（不放宽判定）
const sameFormPending = {
  ...buildNocodeEditorPendingFlowIntentFromEntryFlowIntent({
    entryFlowIntent: leaveEntryIntent,
    targetFormId: primary.targetFormId,
    targetFormName: primary.targetFormName,
    now: 4,
  })!,
}
assert.equal(
  decideNocodeEditorPostFormFlowFollowUp({
    planningScope: 'form',
    entryFlowIntent: leaveEntryIntent,
    pendingFlowIntent: sameFormPending,
    targetFormId: primary.targetFormId,
    targetFormName: primary.targetFormName,
  })?.kind,
  'explicit_flow_clarification',
)

// 多表批次（当前表 + 来源表）走同一套提示：卡片按钮能说出当前表单名，而不是“当前表单”
const multiDeclaredPrimary = resolveNocodeEditorAppliedPrimaryForm(
  multiDeclaredLeaveForms,
  { primaryFormKey: 'form-leave' },
)
const multiDeclaredFollowUp = decideNocodeEditorPostFormFlowFollowUp({
  planningScope: 'form',
  entryFlowIntent: null,
  pendingFlowIntent: null,
  postFormFlowOpportunity: null,
  postFormFlowSignals: null,
  targetFormId: multiDeclaredPrimary.targetFormId,
  targetFormName: multiDeclaredPrimary.targetFormName,
})
assert.equal(multiDeclaredFollowUp?.targetFormId, 't_leave')
assert.equal(multiDeclaredFollowUp?.targetFormName, '学生请假申请表')

console.log('post-form-flow applied target binding passed')
