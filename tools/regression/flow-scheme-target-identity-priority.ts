import assert from 'node:assert/strict'

import {
  resolveFlowSchemeTargetIdentity,
} from '../../src/common/utils/nocodeEditorFlowTargetFormExistence'

// 18:12 会话回放：方案第 5 版目标原本是学生请假申请表，用户切回报销单后重新确认人员题，
// 模型重提方案时没有带 target。旧逻辑用“当前打开的表单”兜底，目标漂移成了报销单，
// 于是既不会提示切表单，还会把“学生请假申请审批流程”生成到报销单上。
const leaveForm = { formId: 't_pc5qjde1rsen', formName: '学生请假申请表' }
const reimbursementForm = { formId: 't_nhtia472arwi', formName: '报销单' }
const leaveSchemeTitle = '学生请假申请审批流程'

const inherited = resolveFlowSchemeTargetIdentity({
  declaredFormId: '',
  declaredFormName: '',
  trustedFormId: '',
  trustedFormName: '',
  previousFormId: leaveForm.formId,
  previousFormName: leaveForm.formName,
  previousTitle: leaveSchemeTitle,
  currentTitle: leaveSchemeTitle,
  activeFormId: reimbursementForm.formId,
  activeFormName: reimbursementForm.formName,
})
assert.deepEqual(
  { formId: inherited.formId, formName: inherited.formName, source: inherited.source },
  { formId: leaveForm.formId, formName: leaveForm.formName, source: 'previous' },
)
assert.equal(inherited.inheritedFromPrevious, true)

// 标题只差空白/分隔符仍算同一个方案；标题不同说明是当前表单上的新流程，不能继承。
assert.equal(
  resolveFlowSchemeTargetIdentity({
    previousFormId: leaveForm.formId,
    previousFormName: leaveForm.formName,
    previousTitle: '学生 请假申请-审批流程',
    currentTitle: leaveSchemeTitle,
    activeFormId: reimbursementForm.formId,
    activeFormName: reimbursementForm.formName,
  }).formId,
  leaveForm.formId,
)
const newFlowOnActiveForm = resolveFlowSchemeTargetIdentity({
  previousFormId: leaveForm.formId,
  previousFormName: leaveForm.formName,
  previousTitle: leaveSchemeTitle,
  currentTitle: '报销单审批流程',
  activeFormId: reimbursementForm.formId,
  activeFormName: reimbursementForm.formName,
})
assert.deepEqual(
  { formId: newFlowOnActiveForm.formId, formName: newFlowOnActiveForm.formName, source: newFlowOnActiveForm.source },
  { formId: reimbursementForm.formId, formName: reimbursementForm.formName, source: 'active' },
)

// 模型显式声明优先于上一版方案。
const declared = resolveFlowSchemeTargetIdentity({
  declaredFormId: reimbursementForm.formId,
  declaredFormName: reimbursementForm.formName,
  previousFormId: leaveForm.formId,
  previousFormName: leaveForm.formName,
  previousTitle: leaveSchemeTitle,
  currentTitle: leaveSchemeTitle,
  activeFormId: leaveForm.formId,
  activeFormName: leaveForm.formName,
})
assert.equal(declared.source, 'declared')
assert.equal(declared.formId, reimbursementForm.formId)

// 确认卡可信上下文优先于上一版方案：回答卡片时方案目标跟卡片走，不跟当前浏览的表单走。
const trusted = resolveFlowSchemeTargetIdentity({
  trustedFormId: leaveForm.formId,
  trustedFormName: leaveForm.formName,
  previousFormId: reimbursementForm.formId,
  previousFormName: reimbursementForm.formName,
  previousTitle: leaveSchemeTitle,
  currentTitle: leaveSchemeTitle,
  activeFormId: reimbursementForm.formId,
  activeFormName: reimbursementForm.formName,
})
assert.equal(trusted.source, 'trusted')
assert.equal(trusted.formId, leaveForm.formId)

// 声明与可信上下文冲突时，可信目标的 id 不能覆盖声明；这里只标记冲突，声明值生效。
const conflicting = resolveFlowSchemeTargetIdentity({
  declaredFormId: reimbursementForm.formId,
  declaredFormName: reimbursementForm.formName,
  trustedFormId: leaveForm.formId,
  trustedFormName: leaveForm.formName,
  activeFormId: leaveForm.formId,
  activeFormName: leaveForm.formName,
})
assert.equal(conflicting.declaredConflictsWithTrusted, true)
assert.equal(conflicting.formId, reimbursementForm.formId)

// 没有任何声明、可信上下文和上一版方案时，才兜底当前打开的表单。
const activeOnly = resolveFlowSchemeTargetIdentity({
  activeFormId: reimbursementForm.formId,
  activeFormName: reimbursementForm.formName,
})
assert.equal(activeOnly.source, 'active')
assert.equal(activeOnly.formId, reimbursementForm.formId)

console.log('flow scheme target identity priority: ok')
