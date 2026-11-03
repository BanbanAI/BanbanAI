import assert from 'node:assert/strict'

import {
  alignPlannedEnumDefaultValue,
  normalizePlannedEnumOptions,
} from '../../src/common/utils/nocodeEditorPlannedEnumOptions'
import type { NocodeEditorFlowPlan } from '../../src/common/utils/nocodeEditorFlowPlan'
import {
  convergeFlowPlanFieldDecisions,
} from '../../src/renderer/views/nocode/views/editor/form/flowFieldDecisionPlanRewrite'

// ---------------- 枚举归一 ----------------

// 1. 中文 label + 英文键 value → value 收敛为 label。
assert.deepEqual(
  normalizePlannedEnumOptions([{ label: '已通过', value: 'approved' }]),
  [{ label: '已通过', value: '已通过' }],
)

// 2. label 与 value 已一致 → 不变。
assert.deepEqual(
  normalizePlannedEnumOptions([{ label: '已通过', value: '已通过' }]),
  [{ label: '已通过', value: '已通过' }],
)

// 3. 字符串选项、纯英文选项 → 原样。
assert.deepEqual(
  normalizePlannedEnumOptions(['A', 'B']),
  [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }],
)

// 4. 没有中文 label 的 label/value 分离 → 不擅自合并。
assert.deepEqual(
  normalizePlannedEnumOptions([{ label: 'Project', value: 'project' }]),
  [{ label: 'Project', value: 'project' }],
)

// 5. 默认值跟随合并后的 value。
const rawOptions = [
  { label: '待审批', value: 'pending' },
  { label: '已通过', value: 'approved' },
]
const mergedOptions = normalizePlannedEnumOptions(rawOptions)
assert.equal(alignPlannedEnumDefaultValue('approved', rawOptions, mergedOptions), '已通过')
assert.equal(alignPlannedEnumDefaultValue('待审批', rawOptions, mergedOptions), '待审批')

// ---------------- 固定值回写自愈 ----------------

const buildSummary = (statusOptions: Array<{ label: string; value: string }>) => ({
  forms: {
    currentForm: {
      tableId: 'form-expense',
      tableName: '报销单',
      fields: [
        { fieldId: 'field-user', fieldName: '报销人', conditionPolicy: 'usable' },
        {
          fieldId: 'field-status',
          fieldName: '审批状态',
          conditionPolicy: 'usable',
          enumOptionsPreview: statusOptions,
        },
      ],
    },
  },
})

const chineseSummary = buildSummary([
  { label: '待审批', value: '待审批' },
  { label: '已通过', value: '已通过' },
])
const englishSummary = buildSummary([
  { label: '待审批', value: 'pending' },
  { label: '已通过', value: 'approved' },
])

const makePlan = (
  mapping: Record<string, unknown>,
): NocodeEditorFlowPlan => ({
  title: '报销流程',
  summary: '审批通过后回写状态',
  openQuestions: [],
  triggerBranches: [{
    branchKey: 'branch-1',
    label: '默认路径',
    nodes: [{
      nodeKey: 'write-approved-status',
      type: 'edit-data',
      name: '回写审批状态为已通过',
      options: {
        target: { formName: '报销单' },
        mapping: [mapping],
      },
    }],
  }],
})

const readMapping = (plan: NocodeEditorFlowPlan) => {
  const options = plan.triggerBranches[0].nodes[0].options as Record<string, unknown>
  const mapping = options.mapping as Array<Record<string, unknown>>
  return mapping[0]
}

// 6. 新表单（选项已归一为中文）：模型按选项文字回写 → 改写为固定值。
const chineseResult = convergeFlowPlanFieldDecisions({
  plan: makePlan({ targetFieldName: '审批状态', valueFieldName: '已通过' }),
  scheme: null,
  flowSummary: chineseSummary,
})
assert.deepEqual(readMapping(chineseResult.plan), { targetFieldName: '审批状态', value: '已通过' })
assert.equal(chineseResult.rewrittenSites, 1)

// 7. 存量英文选项表单：approved 命中已有取值 → 写入表单里真正存储的 value。
const englishResult = convergeFlowPlanFieldDecisions({
  plan: makePlan({ targetFieldName: '审批状态', valueFieldName: 'approved' }),
  scheme: null,
  flowSummary: englishSummary,
})
assert.deepEqual(readMapping(englishResult.plan), { targetFieldName: '审批状态', value: 'approved' })
assert.equal(englishResult.rewrittenSites, 1)

// 7b. 存量英文选项表单 + 模型写了中文 label → 按标签命中，仍写入存储值。
const englishLabelResult = convergeFlowPlanFieldDecisions({
  plan: makePlan({ targetFieldName: '审批状态', valueFieldName: '已通过' }),
  scheme: null,
  flowSummary: englishSummary,
})
assert.deepEqual(readMapping(englishLabelResult.plan), { targetFieldName: '审批状态', value: 'approved' })
assert.equal(englishLabelResult.rewrittenSites, 1)

// 8. 没有命中任何选项 → 保持原样，留给 grounding。
const noMatchResult = convergeFlowPlanFieldDecisions({
  plan: makePlan({ targetFieldName: '审批状态', valueFieldName: 'owner_name' }),
  scheme: null,
  flowSummary: chineseSummary,
})
assert.deepEqual(readMapping(noMatchResult.plan), {
  targetFieldName: '审批状态',
  valueFieldName: 'owner_name',
})
assert.equal(noMatchResult.rewrittenSites, 0)

// 9. 目标字段不存在 → 保持原样。
const missingTargetResult = convergeFlowPlanFieldDecisions({
  plan: makePlan({ targetFieldName: '不存在的字段', valueFieldName: 'approved' }),
  scheme: null,
  flowSummary: chineseSummary,
})
assert.deepEqual(readMapping(missingTargetResult.plan), {
  targetFieldName: '不存在的字段',
  valueFieldName: 'approved',
})
assert.equal(missingTargetResult.rewrittenSites, 0)

// 10. source 合法、valueFieldName 非法 → 不改写（模型本意是取字段值）。
const validSourceResult = convergeFlowPlanFieldDecisions({
  plan: makePlan({
    targetFieldName: '审批状态',
    source: { fieldName: '报销人' },
    valueFieldName: 'approved',
  }),
  scheme: null,
  flowSummary: chineseSummary,
})
assert.deepEqual(readMapping(validSourceResult.plan), {
  targetFieldName: '审批状态',
  source: { fieldName: '报销人' },
  valueFieldName: 'approved',
})
assert.equal(validSourceResult.rewrittenSites, 0)

console.log('chinese form planning enum: ok')
