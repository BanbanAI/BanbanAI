import assert from 'node:assert/strict'

import { projectModelActionableFlowDecisionDiagnostics } from '../../src/common/utils/nocodeEditorFlowDecisionGraph'
import {
  hasFlowFieldValueOptionQuestions,
  validateFlowFieldValueOptions,
} from '../../src/common/utils/nocodeEditorFlowFieldValueOptions'
import {
  resolveNocodeEditorFieldEnumOptions,
  resolveNocodeEditorFieldEnumSourceType,
} from '../../src/common/utils/nocodeEditorFieldEnumOptions'
import {
  FLOW_FIELD_VALUE_OPTION_DIAGNOSTIC_CODES,
  FLOW_FIELD_VALUE_OPTION_STOP_LOSS_MESSAGE,
  FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-scheme-repair.util'
import { resolveRepeatedFlowSchemeError } from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-output-contract'

// 单选/多选/下拉的真实选项存在 extra.choices，只读 options/enumOptions 会看不到。
const radioField = {
  meta: {
    extra: {
      widgetType: 'widget.form.radioGroup',
      choices: [
        { label: '待审批', value: '待审批' },
        { label: '审批中', value: '审批中' },
        { label: '已通过', value: '已通过' },
        { label: '已驳回', value: '已驳回' },
      ],
    },
  },
}
assert.deepEqual(
  resolveNocodeEditorFieldEnumOptions(radioField).map(item => item.value),
  ['待审批', '审批中', '已通过', '已驳回'],
)
assert.equal(resolveNocodeEditorFieldEnumSourceType(radioField), 'custom')
assert.deepEqual(
  resolveNocodeEditorFieldEnumOptions({
    meta: {
      extra: {
        'radiogroup-value-text-color-option': {
          options: [{ label: '甲', value: 'A' }, { label: '乙', value: 'B' }],
        },
      },
    },
  }).map(item => item.value),
  ['A', 'B'],
)
assert.deepEqual(
  resolveNocodeEditorFieldEnumOptions({ meta: { extra: { 'select-choices-type': 'from-table' } } }),
  [],
)

const currentFormFields = [
  {
    fieldId: 'f_hmb3h8zyayck',
    fieldName: '请假状态',
    widgetType: 'widget.form.radioGroup',
    enumSourceType: 'custom',
    enumOptionCount: 4,
    enumOptionsPreview: [
      { label: '待审批', value: '待审批' },
      { label: '审批中', value: '审批中' },
      { label: '已通过', value: '已通过' },
      { label: '已驳回', value: '已驳回' },
    ],
  },
  {
    fieldId: 'f_leave_type',
    fieldName: '请假类型',
    widgetType: 'widget.form.radioGroup',
    enumSourceType: 'custom',
    enumOptionCount: 2,
    enumOptionsPreview: [
      { label: '事假', value: '事假' },
      { label: '病假', value: '病假' },
    ],
  },
  {
    fieldId: 'f_remark',
    fieldName: '备注',
    widgetType: 'widget.form.textInput',
  },
]
const flowSummary = {
  forms: {
    currentForm: {
      tableId: 't_leave',
      tableName: '学生请假申请表',
      fields: currentFormFields,
    },
  },
}
const schemeWith = (questions: unknown[]) => ({
  confirmation: { status: 'pending', questions },
})
const statusValueQuestion = (options: unknown[], overrides: Record<string, unknown> = {}) => ({
  id: 'flow-write-status-value',
  decisionKey: 'flow.write.field:update_status_approved',
  title: '请假状态更新为什么值',
  questionKind: 'single_select',
  description: '审批通过后，请假状态应更新为什么值？',
  changes: ['options'],
  decisionScope: { kind: 'step', id: 'update_status_approved' },
  options,
  ...overrides,
})

// 1) 复刻线上场景：字段只有 待审批/审批中/已通过/已驳回，题目自造了 已批准 与 approved
const inventedDiagnostics = validateFlowFieldValueOptions({
  scheme: schemeWith([statusValueQuestion([
    { value: '已通过', label: '已通过' },
    { value: '已批准', label: '已批准' },
    { value: 'approved', label: 'approved' },
  ])]),
  flowSummary,
})
assert.equal(inventedDiagnostics.length, 1)
assert.equal(inventedDiagnostics[0].code, 'field_value_option_not_in_enum')
assert.deepEqual(inventedDiagnostics[0].invalidOptions, ['已批准', 'approved'])
assert.deepEqual(inventedDiagnostics[0].validOptions, ['待审批', '审批中', '已通过', '已驳回'])
assert.equal(inventedDiagnostics[0].fieldName, '请假状态')
assert.match(inventedDiagnostics[0].message, /请假状态/)
assert.match(inventedDiagnostics[0].message, /已批准、approved/)

// 2) 子集合法：只列字段已有的值（含单个值）不报
assert.deepEqual(validateFlowFieldValueOptions({
  scheme: schemeWith([statusValueQuestion([
    { value: '已通过', label: '已通过' },
    { value: '已驳回', label: '已驳回' },
  ])]),
  flowSummary,
}), [])

// 3) 字段选择题（问哪个字段）的选项是字段名，不按枚举值校验
assert.deepEqual(validateFlowFieldValueOptions({
  scheme: schemeWith([{
    id: 'q_write_field',
    decisionKey: 'flow.write.field:update_status_approved',
    title: '审批通过后写入哪个字段',
    questionKind: 'single_select',
    changes: ['binding'],
    options: [{ value: '请假状态', label: '请假状态' }, { value: '备注', label: '备注' }],
  }]),
  flowSummary,
}), [])
assert.deepEqual(validateFlowFieldValueOptions({
  scheme: schemeWith([{
    id: 'q_write_field_value',
    decisionKey: 'flow.write.field:update_status_approved',
    title: '请假状态更新为什么值',
    questionKind: 'single_select',
    changes: ['options'],
    options: [{ value: '请假状态', label: '请假状态' }, { value: '备注', label: '备注' }],
  }]),
  flowSummary,
}), [])

// 4) 人员题、已答题、非 options 变更题都不在本次校验范围
assert.deepEqual(validateFlowFieldValueOptions({
  scheme: schemeWith([{
    ...statusValueQuestion([{ value: '已批准', label: '已批准' }]),
    personnelDecision: { stepKey: 'update_status_approved', slot: 'source' },
  }]),
  flowSummary,
}), [])
assert.deepEqual(validateFlowFieldValueOptions({
  scheme: schemeWith([statusValueQuestion(
    [{ value: '已批准', label: '已批准' }],
    { confirmed: true, selectedOptionValue: '已批准' },
  )]),
  flowSummary,
}), [])
assert.deepEqual(validateFlowFieldValueOptions({
  scheme: schemeWith([statusValueQuestion(
    [{ value: '已批准', label: '已批准' }],
    { changes: ['topology'] },
  )]),
  flowSummary,
}), [])

// 5) 多个枚举字段同时被提及时按字段全名匹配，不会拿“请假类型”的选项去校验“请假状态”
assert.deepEqual(validateFlowFieldValueOptions({
  scheme: schemeWith([{
    id: 'q_leave_type_value',
    decisionKey: 'flow.write.field:update_leave_type',
    title: '请假类型应该记成什么值',
    questionKind: 'single_select',
    changes: ['options'],
    options: [{ value: '事假', label: '事假' }, { value: '年假', label: '年假' }],
  }]),
  flowSummary,
}), [{
  code: 'field_value_option_not_in_enum',
  message: '确认题“请假类型应该记成什么值”的选项（年假）不在字段「请假类型」的现有选项里；该字段现有选项是：事假、病假。请只使用字段已有选项，不要新增近义写法或英文变体。',
  questionId: 'q_leave_type_value',
  questionTitle: '请假类型应该记成什么值',
  decisionKey: 'flow.write.field:update_leave_type',
  fieldId: 'f_leave_type',
  fieldName: '请假类型',
  invalidOptions: ['年假'],
  validOptions: ['事假', '病假'],
}])

// 6) 汇总里没有字段选项时（证据缺失）不误报
assert.deepEqual(validateFlowFieldValueOptions({
  scheme: schemeWith([statusValueQuestion([{ value: '已批准', label: '已批准' }])]),
  flowSummary: { forms: { currentForm: { tableId: 't_leave', fields: [] } } },
}), [])
assert.deepEqual(validateFlowFieldValueOptions({
  scheme: schemeWith([statusValueQuestion([{ value: '已批准', label: '已批准' }])]),
  flowSummary: null,
}), [])

// 7) 只要存在待答的 options 变更题，流程方案阶段就必须补齐 flow summary 证据
assert.equal(hasFlowFieldValueOptionQuestions(schemeWith([
  statusValueQuestion([{ value: '已通过', label: '已通过' }]),
])), true)
assert.equal(hasFlowFieldValueOptionQuestions(schemeWith([
  statusValueQuestion([{ value: '已通过', label: '已通过' }], { confirmed: true }),
])), false)

// 8) 可自修：诊断投影保留 code / message / decisionKey，模型能看到字段与合法值
assert.deepEqual(
  projectModelActionableFlowDecisionDiagnostics([{
    code: 'field_value_option_not_in_enum',
    message: '确认题“请假状态更新为什么值”的选项（已批准、approved）不在字段「请假状态」的现有选项里；该字段现有选项是：待审批、审批中、已通过、已驳回。请只使用字段已有选项，不要新增近义写法或英文变体。',
    decisionKey: 'flow.write.field:update_status_approved',
  }]),
  [{
    code: 'field_value_option_not_in_enum',
    message: '确认题“请假状态更新为什么值”的选项（已批准、approved）不在字段「请假状态」的现有选项里；该字段现有选项是：待审批、审批中、已通过、已驳回。请只使用字段已有选项，不要新增近义写法或英文变体。',
    decisionKey: 'flow.write.field:update_status_approved',
  }],
)

// 9) 失败回传通道：issueId 进入模型可修清单，诊断 code 按类聚合止损
assert.equal(FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS.has('flow-field-value-options-invalid'), true)
assert.equal(FLOW_FIELD_VALUE_OPTION_DIAGNOSTIC_CODES.has('field_value_option_not_in_enum'), true)
const failedOptionResult = (title: string) => ({
  name: 'editor_plan_flow_scheme',
  ok: false,
  metadata: {
    flowUnifiedIssues: [{
      issueId: 'flow-field-value-options-invalid',
      userMessage: '流程方案里有确认题的选项和对应字段的现有选项对不上。',
      diagnostics: [{
        code: 'field_value_option_not_in_enum',
        message: `确认题“${title}”的选项不在字段现有选项里`,
        decisionKey: `flow.write.field:${title}`,
      }],
    }],
  },
})
assert.equal(
  resolveRepeatedFlowSchemeError([failedOptionResult('请假状态'), failedOptionResult('请假类型')]),
  FLOW_FIELD_VALUE_OPTION_STOP_LOSS_MESSAGE,
)
assert.equal(
  resolveRepeatedFlowSchemeError([
    failedOptionResult('请假状态'),
    { name: 'editor_plan_flow_scheme', ok: true, metadata: {} },
    failedOptionResult('请假类型'),
  ]),
  '',
)

console.log('flow-field-value-options-contract: ok')
