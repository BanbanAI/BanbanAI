import assert from 'node:assert/strict'

import {
  NOCODE_EDITOR_BLUEPRINT_REPLACE_NOT_AUTHORIZED,
  NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS,
  NOCODE_EDITOR_BLUEPRINT_SCOPE_INCOMPLETE,
  alignNocodeEditorBlueprintFormIdentities,
  resolveNocodeEditorBlueprintScopePlannedForms,
  validateNocodeEditorBlueprintReplaceScope,
} from '../../src/common/utils/nocodeEditorBlueprintInput'
import {
  resolveBlueprintScopeRecoveryPlanningGuard,
  resolvePlanningContinuationToolGuard,
  resolvePlanningScopeToolGuard,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-planning-convergence.util'

const primaryForm = {
  formKey: 'form_leave',
  tableName: '学生请假申请表',
  fields: [
    {
      fieldKey: 'field_student',
      name: '学生信息',
      widgetType: 'treeSelect',
      source: {
        formKey: 'form_student',
        formName: '学生信息表',
        fieldKey: 'field_name',
        fieldName: '姓名',
      },
    },
  ],
}

const relatedForm = {
  formKey: 'form_student',
  tableName: '学生信息表',
  fields: [
    { fieldKey: 'field_name', name: '姓名', widgetType: 'textInput' },
  ],
}

// 主表字段 source 实际指向额外关联表：允许进入蓝图。
const authorized = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: [{ formKey: 'form_leave', tableName: '学生请假申请表' }],
  proposedForms: [primaryForm, relatedForm],
  currentForms: [],
  hasCurrentBlueprint: false,
})
assert.deepEqual(authorized, { ok: true })

// 只凭表名新增、没有主表 source 指向：拒绝。
const unauthorized = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: [{ formKey: 'form_leave', tableName: '学生请假申请表' }],
  proposedForms: [
    {
      ...primaryForm,
      fields: [{ fieldKey: 'field_student', name: '学生信息', widgetType: 'textInput' }],
    },
    relatedForm,
  ],
  currentForms: [],
  hasCurrentBlueprint: false,
})
assert.equal(unauthorized.ok, false)
if (unauthorized.ok === false) {
  assert.equal(unauthorized.code, NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS)
  assert.deepEqual(unauthorized.unexpectedForms, [
    { formKey: 'form_student', tableName: '学生信息表' },
  ])
  // 范围错误必须把已规划身份带回给模型，否则模型只能重新规划。
  assert.deepEqual(unauthorized.plannedForms, [
    { formKey: 'form_leave', tableName: '学生请假申请表' },
  ])
  assert.match(unauthorized.message, /formKey=form_leave/u)
  assert.match(unauthorized.message, /updateMode=replace/u)
}

// 额外表之间互相引用不算授权：只有已规划主表能作为引用来源。
const chainedReference = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: [{ formKey: 'form_leave', tableName: '学生请假申请表' }],
  proposedForms: [
    primaryForm,
    {
      formKey: 'form_student',
      tableName: '学生信息表',
      fields: [
        { fieldKey: 'field_name', name: '姓名', widgetType: 'textInput' },
        {
          fieldKey: 'field_class',
          name: '班级',
          widgetType: 'treeSelect',
          source: { formKey: 'form_class', formName: '班级表' },
        },
      ],
    },
    {
      formKey: 'form_class',
      tableName: '班级表',
      fields: [{ fieldKey: 'field_class_name', name: '班级名称', widgetType: 'textInput' }],
    },
  ],
  currentForms: [],
  hasCurrentBlueprint: false,
})
assert.equal(chainedReference.ok, false)
if (chainedReference.ok === false) {
  assert.equal(chainedReference.code, NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS)
  assert.deepEqual(chainedReference.unexpectedForms, [
    { formKey: 'form_class', tableName: '班级表' },
  ])
}

const expenseForm = { formKey: 'form-1', tableName: '报销单', fields: [] }
const attachmentForm = { tableName: '报销单附件', fields: [] }

// 同轮“先规划、后蓝图”且用户未确认：规划仍参与范围校验，额外无 source 表单必须被拒。
const sameTurnPlannedForms = resolveNocodeEditorBlueprintScopePlannedForms({
  outlineForms: [expenseForm],
  planningOutlineStagedInCurrentTurn: true,
  sourcePlanningContextKey: null,
  currentPlanningContextKey: 'form-plan:sol-1:form-1:1:1793098405242',
})
assert.equal(sameTurnPlannedForms.length, 1)
const sameTurnScope = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: sameTurnPlannedForms,
  proposedForms: [expenseForm, attachmentForm],
  currentForms: [],
  hasCurrentBlueprint: false,
})
assert.equal(sameTurnScope.ok, false)
if (sameTurnScope.ok === false) {
  assert.equal(sameTurnScope.code, NOCODE_EDITOR_BLUEPRINT_SCOPE_EXTRA_FORMS)
  assert.deepEqual(sameTurnScope.unexpectedForms, [
    { formKey: undefined, tableName: '报销单附件' },
  ])
}

// 历史规划没有确认、续跑或同轮信号：不参与范围校验，避免拦截无关新表单。
assert.deepEqual(
  resolveNocodeEditorBlueprintScopePlannedForms({ outlineForms: [expenseForm] }),
  [],
)

// 规划上下文与当前蓝图不一致：不参与范围校验。
assert.deepEqual(
  resolveNocodeEditorBlueprintScopePlannedForms({
    outlineForms: [expenseForm],
    planningOutlineStagedInCurrentTurn: true,
    sourcePlanningContextKey: 'form-plan:sol-old:form-1:1:1',
    currentPlanningContextKey: 'form-plan:sol-new:form-9:2:2',
  }),
  [],
)

// 原有“确认完成”和“自动续跑”信号保持生效。
assert.equal(
  resolveNocodeEditorBlueprintScopePlannedForms({
    outlineForms: [expenseForm],
    hasCompletedPlanningConfirmation: true,
  }).length,
  1,
)
assert.equal(
  resolveNocodeEditorBlueprintScopePlannedForms({
    outlineForms: [expenseForm],
    hasPlanningContinuationAutoContinue: true,
  }).length,
  1,
)

// patch 模式：当前蓝图主表 source 指向新关联表时允许增量加入。
const patched = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'patch',
  plannedForms: [],
  proposedForms: [primaryForm, relatedForm],
  currentForms: [{ formKey: 'form_leave', tableName: '学生请假申请表' }],
  hasCurrentBlueprint: true,
})
assert.deepEqual(patched, { ok: true })

// patch 模式下只补交新增表：当前暂存主表里已有的 source 同样可以作为关联依据。
const patchedFromCurrentSource = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'patch',
  plannedForms: [],
  proposedForms: [relatedForm],
  currentForms: [primaryForm],
  hasCurrentBlueprint: true,
})
assert.deepEqual(patchedFromCurrentSource, { ok: true })

// 已规划主表被删：仍按范围不完整拒绝。
const missingPrimary = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: [
    { formKey: 'form_leave', tableName: '学生请假申请表' },
    { formKey: 'form_student', tableName: '学生信息表' },
  ],
  proposedForms: [relatedForm],
  currentForms: [],
  hasCurrentBlueprint: false,
})
assert.equal(missingPrimary.ok, false)
if (missingPrimary.ok === false) {
  assert.equal(missingPrimary.code, NOCODE_EDITOR_BLUEPRINT_SCOPE_INCOMPLETE)
}

const stagedExpenseBlueprint = { formKey: 'form_expense', tableName: '报销单' }

// 已有暂存蓝图，但本轮是另一张完全不重叠的新表单：属于新蓝图范围，放行 replace。
const unrelatedNewScope = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: [],
  proposedForms: [{ formKey: 'form_leave', tableName: '学生请假申请表', fields: [] }],
  currentForms: [stagedExpenseBlueprint],
  hasCurrentBlueprint: true,
  currentUserMessage: '帮我创建学生请假申请表',
})
assert.deepEqual(unrelatedNewScope, { ok: true })

// 提案与暂存蓝图同表但换了 formKey：仍算覆盖，要求用户明确重做。
const overlappingNewScope = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: [],
  proposedForms: [{ formKey: 'form_expense_v2', tableName: '报销单', fields: [] }],
  currentForms: [stagedExpenseBlueprint],
  hasCurrentBlueprint: true,
  currentUserMessage: '调整一下报销单',
})
assert.equal(overlappingNewScope.ok, false)
if (overlappingNewScope.ok === false) {
  assert.equal(overlappingNewScope.code, NOCODE_EDITOR_BLUEPRINT_REPLACE_NOT_AUTHORIZED)
}

// 空提案不能用“新范围”绕过覆盖保护。
const emptyProposalWhileStaged = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: [],
  proposedForms: [],
  currentForms: [stagedExpenseBlueprint],
  hasCurrentBlueprint: true,
  currentUserMessage: '帮我创建学生请假申请表',
})
assert.equal(emptyProposalWhileStaged.ok, false)
if (emptyProposalWhileStaged.ok === false) {
  assert.equal(emptyProposalWhileStaged.code, NOCODE_EDITOR_BLUEPRINT_REPLACE_NOT_AUTHORIZED)
}

// 用户明确要求重做同一张表单：允许 replace。
const explicitRebuild = validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: [],
  proposedForms: [{ formKey: 'form_expense', tableName: '报销单', fields: [] }],
  currentForms: [stagedExpenseBlueprint],
  hasCurrentBlueprint: true,
  currentUserMessage: '重做报销单蓝图',
})
assert.deepEqual(explicitRebuild, { ok: true })

// 规划确认完成后，范围守卫必须把模型导向蓝图，而不是死路重试规划。
const completedGuard = resolvePlanningScopeToolGuard({
  planningScope: 'form',
  toolName: 'editor_stage_app_plan',
  planningCompleted: true,
})
assert.equal(completedGuard.blocked, true)
assert.equal(completedGuard.expectedToolName, 'editor_stage_app_blueprint')
assert.match(completedGuard.message, /editor_stage_app_blueprint/u)

// 规划完成后重复暂存同一张已规划表单也必须被拦截，直接导向蓝图。
const completedSingleFormGuard = resolvePlanningScopeToolGuard({
  planningScope: 'form',
  toolName: 'editor_stage_single_form_plan',
  planningCompleted: true,
  completedFormName: '报销单',
  userMessage: '再整理一下报销单',
  toolInput: { outline: { forms: [{ tableName: '报销单' }] } },
})
assert.equal(completedSingleFormGuard.blocked, true)
assert.equal(completedSingleFormGuard.expectedToolName, 'editor_stage_app_blueprint')
assert.match(completedSingleFormGuard.message, /editor_stage_app_blueprint/u)

// 已完成的是另一张表单时属于新需求，不能拦成死路。
const completedOtherFormGuard = resolvePlanningScopeToolGuard({
  planningScope: 'form',
  toolName: 'editor_stage_single_form_plan',
  planningCompleted: true,
  completedFormName: '报销单',
  userMessage: '添加一个合同管理表',
  toolInput: { outline: { forms: [{ tableName: '合同管理表' }] } },
})
assert.equal(completedOtherFormGuard.blocked, false)

// 用户明确要求重新规划时保留重新规划入口。
const completedSingleFormRestartGuard = resolvePlanningScopeToolGuard({
  planningScope: 'form',
  toolName: 'editor_stage_single_form_plan',
  planningCompleted: true,
  userMessage: '这个需求不对，重新规划',
})
assert.equal(completedSingleFormRestartGuard.blocked, false)
assert.equal(completedSingleFormRestartGuard.isExplicitRestart, true)

const pendingSingleFormGuard = resolvePlanningScopeToolGuard({
  planningScope: 'form',
  toolName: 'editor_stage_single_form_plan',
  planningCompleted: false,
})
assert.equal(pendingSingleFormGuard.blocked, false)

const pendingGuard = resolvePlanningScopeToolGuard({
  planningScope: 'form',
  toolName: 'editor_stage_app_plan',
  planningCompleted: false,
})
assert.equal(pendingGuard.blocked, true)
assert.equal(pendingGuard.expectedToolName, 'editor_stage_single_form_plan')

const appScopeGuard = resolvePlanningScopeToolGuard({
  planningScope: 'app',
  toolName: 'editor_stage_app_plan',
  planningCompleted: true,
})
assert.equal(appScopeGuard.blocked, false)

const blueprintToolGuard = resolvePlanningScopeToolGuard({
  planningScope: 'form',
  toolName: 'editor_stage_app_blueprint',
  planningCompleted: true,
})
assert.equal(blueprintToolGuard.blocked, false)

// 规划上下文键只存在于请求侧（渲染层工件生成），摘要未持久化时不能放行重新规划。
const continuationWithMissingSummaryKey = resolvePlanningContinuationToolGuard({
  toolName: 'editor_stage_app_plan',
  userMessage: '当前卡片的问题，我已逐项确认如下：\n1. 客户范围\n答：全部客户',
  confirmationStage: 'app-plan',
  planningContextKey: 'app-plan:sol-1:artifact-1:1:1',
  taskSummary: {
    planningConfirmationStatus: 'completed',
    planningConfirmationContextKey: '',
    planningMode: 'app-plan',
  },
})
assert.equal(continuationWithMissingSummaryKey.blocked, true)

// 摘要里明确是另一条规划链时仍保持保守：不做跨链拦截。
assert.equal(resolvePlanningContinuationToolGuard({
  toolName: 'editor_stage_app_plan',
  userMessage: '当前卡片的问题，我已逐项确认如下：\n1. 客户范围\n答：全部客户',
  confirmationStage: 'app-plan',
  planningContextKey: 'app-plan:sol-2:artifact-9:2:2',
  taskSummary: {
    planningConfirmationStatus: 'completed',
    planningConfirmationContextKey: 'form-plan:sol-1:form-1:1:1',
    planningMode: 'app-plan',
  },
}).blocked, false)

// 蓝图范围错误出现后，本轮禁止用重新规划迁就蓝图，并带回已规划身份。
const recoveryGuard = resolveBlueprintScopeRecoveryPlanningGuard({
  toolName: 'editor_stage_app_plan',
  scopeErrorSeen: true,
  plannedForms: [{ formKey: 'artifact-1', tableName: '客户信息表' }],
})
assert.equal(recoveryGuard.blocked, true)
assert.deepEqual(recoveryGuard.plannedFormLabels, ['客户信息表（formKey=artifact-1）'])
assert.match(recoveryGuard.message, /editor_stage_app_blueprint|updateMode=replace/u)
assert.match(recoveryGuard.message, /formKey=artifact-1/u)

// 未出现范围错误时不拦截规划；非规划工具也不受该守卫影响。
assert.equal(resolveBlueprintScopeRecoveryPlanningGuard({
  toolName: 'editor_stage_app_plan',
  scopeErrorSeen: false,
}).blocked, false)
assert.equal(resolveBlueprintScopeRecoveryPlanningGuard({
  toolName: 'editor_stage_app_blueprint',
  scopeErrorSeen: true,
}).blocked, false)

// 表/表单后缀差异在唯一匹配时作为兜底：先回填规划 formKey，再通过范围校验。
const suffixPlannedForms = [{ formKey: 'artifact-1', tableName: '客户信息表' }]
const suffixProposedForms = [{ tableName: '客户信息', fields: [] }]
assert.deepEqual(
  alignNocodeEditorBlueprintFormIdentities(suffixPlannedForms, suffixProposedForms),
  [{ formKey: 'artifact-1', tableName: '客户信息', fields: [] }],
)
assert.deepEqual(validateNocodeEditorBlueprintReplaceScope({
  updateMode: 'replace',
  plannedForms: suffixPlannedForms,
  proposedForms: suffixProposedForms,
  currentForms: [],
  hasCurrentBlueprint: false,
}), { ok: true })

// 去后缀后不唯一时不能猜身份，保持原样交给严格校验。
assert.deepEqual(
  alignNocodeEditorBlueprintFormIdentities(
    [
      { formKey: 'artifact-1', tableName: '客户信息表' },
      { formKey: 'artifact-2', tableName: '客户信息' },
    ],
    [{ tableName: '客户信息' }],
  ),
  [{ tableName: '客户信息' }],
)

console.log('blueprint-related-form-scope: ok')
