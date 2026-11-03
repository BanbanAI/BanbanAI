import assert from 'node:assert/strict'

import { resolvePlanningScopeToolGuard } from '../../src/main/modules/ai/nocode-editor/nocode-editor-planning-convergence.util'

const completedPlanBasis = {
  planningScope: 'form',
  toolName: 'editor_stage_single_form_plan',
  planningCompleted: true,
  completedFormName: '学生请假申请表',
}

// 已确认的是另一张表单：新表单需求必须放行，否则模型只能重复暂存规划并触发同因失败止损。
assert.equal(resolvePlanningScopeToolGuard({
  ...completedPlanBasis,
  userMessage: '添加一个合同管理表',
  toolInput: { outline: { forms: [{ tableName: '合同管理表' }] } },
}).blocked, false)

// 仍要暂存同一张已规划表单时继续拦截。
const sameTarget = resolvePlanningScopeToolGuard({
  ...completedPlanBasis,
  userMessage: '再整理一下请假审批',
  toolInput: { outline: { forms: [{ tableName: '学生请假申请表' }] } },
})
assert.equal(sameTarget.blocked, true)
assert.equal(sameTarget.code, 'planning_scope_completed_guard')

// 提示词里的显式续接措辞等同于确认答复，不能重新开启规划。
assert.equal(resolvePlanningScopeToolGuard({
  ...completedPlanBasis,
  userMessage: '继续',
  toolInput: { outline: { forms: [{ tableName: '合同管理表' }] } },
}).blocked, true)

// 结构化确认答复同样视为续接。
assert.equal(resolvePlanningScopeToolGuard({
  ...completedPlanBasis,
  userMessage: '当前卡片的问题，我已逐项确认如下：\n1. 合同类型\n答：采购合同',
  toolInput: { outline: { forms: [{ tableName: '合同管理表' }] } },
}).blocked, true)

// 用户明确要求重新规划时放行。
assert.equal(resolvePlanningScopeToolGuard({
  ...completedPlanBasis,
  userMessage: '重新规划请假申请表',
  toolInput: { outline: { forms: [{ tableName: '学生请假申请表' }] } },
}).blocked, false)

// 入参给不出表单名时按放行处理，交给工具自身校验兜底。
assert.equal(resolvePlanningScopeToolGuard({
  ...completedPlanBasis,
  userMessage: '添加一个合同管理表',
  toolInput: {},
}).blocked, false)

// 顶层 forms 数组同样能识别目标表单。
assert.equal(resolvePlanningScopeToolGuard({
  ...completedPlanBasis,
  userMessage: '再整理一下请假审批',
  toolInput: { forms: [{ tableName: '学生请假申请表' }] },
}).blocked, true)

// form 范围内的应用级规划仍然拦截，并带上稳定的守卫 code。
const appPlan = resolvePlanningScopeToolGuard({
  planningScope: 'form',
  toolName: 'editor_stage_app_plan',
  planningCompleted: false,
  userMessage: '做一个报销系统',
})
assert.equal(appPlan.blocked, true)
assert.equal(appPlan.code, 'planning_scope_mismatch_guard')

// 规划尚未确认时不得误拦单表单规划。
assert.equal(resolvePlanningScopeToolGuard({
  ...completedPlanBasis,
  planningCompleted: false,
  userMessage: '添加一个合同管理表',
  toolInput: { outline: { forms: [{ tableName: '合同管理表' }] } },
}).blocked, false)

console.log('planning-scope-guard-ownership: ok')
