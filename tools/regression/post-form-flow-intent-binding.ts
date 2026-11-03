import assert from 'node:assert/strict'

import {
  bindNocodeEditorFlowEntryIntentTarget,
  buildNocodeEditorPendingFlowIntentFromEntryFlowIntent,
  isNocodeEditorPendingFlowIntentForTarget,
  normalizeNocodeEditorPendingFlowIntent,
  shouldBlockNocodeEditorPendingFlowIntentRebind,
} from '../../src/common/utils/nocodeEditorPendingFlowIntent'
import { isNocodeEditorCompleteNewFormIntent } from '../../src/common/utils/nocodeEditorSingleFormPlan'
import { resolveNocodeEditorFlowEntryIntent } from '../../src/common/utils/nocodeEditorFlowEntryIntent'
import { decideNocodeEditorPostFormFlowFollowUp } from '../../src/common/utils/nocodeEditorPostFormFlowFollowUp'
import { resolveNocodeEditorPostFormFlowRelease } from '../../src/common/utils/nocodeEditorPostFormFlowRelease'

const reimbursementMessage = '创建一个报销表单，需要有审批流程'

// 报销单的显式流程需求在历史里没有 targetFormName，但它的挂账已经绑定过“报销单”
const carriedEntryFlowIntent = {
  state: 'explicit_positive' as const,
  evidence: ['需要有审批流程'],
  sourceUserMessage: reimbursementMessage,
}

const completedReimbursementPending = {
  status: 'completed' as const,
  sourceUserMessage: reimbursementMessage,
  evidence: ['需要有审批流程'],
  targetFormId: 't_reimbursement',
  targetFormName: '报销单',
  createdAt: 1,
  updatedAt: 2,
  completedByTool: 'editor_apply_staged_flow' as const,
}

// 层一：搬运过来的无绑定拷贝要补回原绑定
const reboundIntent = bindNocodeEditorFlowEntryIntentTarget({
  entryFlowIntent: carriedEntryFlowIntent,
  pendingFlowIntent: completedReimbursementPending,
})
assert.equal(reboundIntent?.targetFormName, '报销单')

// 已完成挂账不作为后续应用新表单的续跑目标
assert.equal(
  buildNocodeEditorPendingFlowIntentFromEntryFlowIntent({
    entryFlowIntent: reboundIntent,
    targetFormId: 't_leave',
    targetFormName: '学生请假申请表',
    now: 3,
  }),
  null,
)

// 源消息不同说明是另一条显式需求，不能被旧挂账绑定
const newRequirementIntent = {
  state: 'explicit_positive' as const,
  evidence: ['需要有审批流程'],
  sourceUserMessage: '学生请假申请表也要有审批流程',
}
assert.equal(
  bindNocodeEditorFlowEntryIntentTarget({
    entryFlowIntent: newRequirementIntent,
    pendingFlowIntent: completedReimbursementPending,
  })?.targetFormName,
  undefined,
)

// 已绑定的意图保持不变
assert.equal(
  bindNocodeEditorFlowEntryIntentTarget({
    entryFlowIntent: { ...carriedEntryFlowIntent, targetFormName: '报销单' },
    pendingFlowIntent: { ...completedReimbursementPending, targetFormName: '学生请假申请表' },
  })?.targetFormName,
  '报销单',
)

// 层二：重绑判定必须看到已完成挂账
assert.equal(
  shouldBlockNocodeEditorPendingFlowIntentRebind({
    entryFlowIntent: carriedEntryFlowIntent,
    existingPendingFlowIntent: completedReimbursementPending,
    candidateTargetFormId: 't_leave',
    candidateTargetFormName: '学生请假申请表',
  }),
  true,
)

// 同一张表单的续跑不受影响
assert.equal(
  shouldBlockNocodeEditorPendingFlowIntentRebind({
    entryFlowIntent: carriedEntryFlowIntent,
    existingPendingFlowIntent: completedReimbursementPending,
    candidateTargetFormId: 't_reimbursement',
    candidateTargetFormName: '报销单',
  }),
  false,
)

// 用户明确对新表单提出流程需求时允许重建挂账
assert.equal(
  shouldBlockNocodeEditorPendingFlowIntentRebind({
    entryFlowIntent: newRequirementIntent,
    existingPendingFlowIntent: completedReimbursementPending,
    candidateTargetFormId: 't_leave',
    candidateTargetFormName: '学生请假申请表',
  }),
  false,
)

// completed 挂账不会触发自动续跑
assert.deepEqual(
  {
    shouldRender: resolveNocodeEditorPostFormFlowRelease({
      planningScope: 'form',
      persistenceMode: 'saved',
      pendingFlowIntent: normalizeNocodeEditorPendingFlowIntent(completedReimbursementPending),
    }).shouldAutoContinue,
    activeShouldAutoContinue: resolveNocodeEditorPostFormFlowRelease({
      planningScope: 'form',
      persistenceMode: 'saved',
      pendingFlowIntent: {
        ...completedReimbursementPending,
        status: 'pending_after_form_apply',
        completedByTool: undefined,
      },
      targetFormId: 't_reimbursement',
      targetFormName: '报销单',
    }).shouldAutoContinue,
  },
  { shouldRender: false, activeShouldAutoContinue: true },
)

// 旧需求被拦下后只能回落到中性建议，不能复述“原始需求里的流程部分还没有落地”
const blockedFollowUp = decideNocodeEditorPostFormFlowFollowUp({
  planningScope: 'form',
  entryFlowIntent: carriedEntryFlowIntent,
  pendingFlowIntent: null,
  postFormFlowOpportunity: null,
  postFormFlowSignals: null,
  targetFormId: 't_leave',
  targetFormName: '学生请假申请表',
})
assert.notEqual(blockedFollowUp?.kind, 'explicit_flow_clarification')

// 同一张表单上待补的挂账仍然保留显式澄清文案
const activeFollowUp = decideNocodeEditorPostFormFlowFollowUp({
  planningScope: 'form',
  entryFlowIntent: { ...carriedEntryFlowIntent, targetFormName: '报销单' },
  pendingFlowIntent: {
    status: 'pending_after_form_apply',
    sourceUserMessage: reimbursementMessage,
    evidence: ['需要有审批流程'],
    targetFormId: 't_reimbursement',
    targetFormName: '报销单',
    createdAt: 1,
    updatedAt: 2,
  },
  targetFormId: 't_reimbursement',
  targetFormName: '报销单',
})
assert.equal(activeFollowUp?.kind, 'explicit_flow_clarification')

// 旧挂账即使还停留在待落地状态，也不能续跑到另一张表单上
const staleActivePending = {
  ...completedReimbursementPending,
  status: 'pending_after_form_apply' as const,
  completedByTool: undefined,
}
assert.equal(
  isNocodeEditorPendingFlowIntentForTarget({
    pendingFlowIntent: staleActivePending,
    targetFormId: 't_leave',
    targetFormName: '学生请假申请表',
  }),
  false,
)
assert.equal(
  resolveNocodeEditorPostFormFlowRelease({
    planningScope: 'form',
    persistenceMode: 'saved',
    pendingFlowIntent: staleActivePending,
    targetFormId: 't_leave',
    targetFormName: '学生请假申请表',
  }).shouldAutoContinue,
  false,
)
assert.notEqual(
  decideNocodeEditorPostFormFlowFollowUp({
    planningScope: 'form',
    entryFlowIntent: carriedEntryFlowIntent,
    pendingFlowIntent: staleActivePending,
    targetFormId: 't_leave',
    targetFormName: '学生请假申请表',
  })?.kind,
  'explicit_flow_clarification',
)
// 回到挂账原本绑定的表单时仍然可以续跑
assert.equal(
  resolveNocodeEditorPostFormFlowRelease({
    planningScope: 'form',
    persistenceMode: 'saved',
    pendingFlowIntent: staleActivePending,
    targetFormId: 't_reimbursement',
    targetFormName: '报销单',
  }).shouldAutoContinue,
  true,
)

// “添加/新增/加 + 表单名”同样是新表单边界，不能被当成补字段或在现有表单上加流程
assert.equal(
  isNocodeEditorCompleteNewFormIntent({ userMessage: '添加一个学生请假申请表' }),
  true,
)
assert.equal(
  isNocodeEditorCompleteNewFormIntent({ userMessage: '新增一个学生请假申请表' }),
  true,
)
assert.equal(
  isNocodeEditorCompleteNewFormIntent({ userMessage: '给报销申请表加一个审批流程' }),
  false,
)
assert.equal(
  isNocodeEditorCompleteNewFormIntent({ userMessage: '给当前表单加一个审批字段' }),
  false,
)

// 入口意图不携带“当时打开的表单”，否则旧表单名会被当成新需求的目标
const freshRequestEntryIntent = resolveNocodeEditorFlowEntryIntent({
  userMessage: '添加一个学生请假申请表',
  activeFormName: '报销申请表',
})
assert.equal(freshRequestEntryIntent.state, 'none')
assert.equal(freshRequestEntryIntent.targetFormName, undefined)

console.log('post-form-flow intent binding passed')
