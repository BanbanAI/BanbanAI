import assert from 'node:assert/strict'

import {
  collectNocodeEditorBlueprintAutoComputeDesignGaps,
  collectNocodeEditorBlueprintEnumDesignGaps,
} from '../../src/common/utils/nocodeEditorBlueprintDesignGaps'
import { readNocodeEditorBlueprintDesignGaps } from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-output-contract'
import type { NocodeEditorBlueprintFieldLike } from '../../src/common/utils/nocodeEditorBlueprintFormNormalization'

const buildForm = (fields: NocodeEditorBlueprintFieldLike[]) => (
  [{ formKey: 'expense-type', tableName: '费用类型', fields }]
)

// 单选没有选项 -> 缺口
assert.deepEqual(
  collectNocodeEditorBlueprintEnumDesignGaps(buildForm([
    { fieldKey: 'type-name', name: '类型名称', widgetType: 'widget.form.radioGroup' },
  ])).map(gap => `${gap.tableName}.${gap.fieldName}`),
  ['费用类型.类型名称'],
)

// 有选项 -> 不报
assert.equal(
  collectNocodeEditorBlueprintEnumDesignGaps(buildForm([
    { fieldKey: 'type-name', name: '类型名称', widgetType: 'widget.form.radioGroup', enumOptions: ['差旅费', '招待费'] },
  ])).length,
  0,
)

// 有 source 的关系字段 -> 不报
assert.equal(
  collectNocodeEditorBlueprintEnumDesignGaps(buildForm([
    {
      fieldKey: 'type-name',
      name: '类型名称',
      widgetType: 'widget.form.radioGroup',
      source: { formName: '费用类型', fieldName: '类型名称' },
    },
  ])).length,
  0,
)

// 显式声明生成后补充 -> 不报
assert.equal(
  collectNocodeEditorBlueprintEnumDesignGaps(buildForm([
    {
      fieldKey: 'type-name',
      name: '类型名称',
      widgetType: 'widget.form.radioGroup',
      description: '生成后补充选项',
    },
  ])).length,
  0,
)

// treeSelect 无 source 可能是待补关系来源 -> 不报
assert.equal(
  collectNocodeEditorBlueprintEnumDesignGaps(buildForm([
    { fieldKey: 'owner', name: '负责人', widgetType: 'widget.form.treeSelect' },
  ])).length,
  0,
)

// 子字段同样检查
assert.equal(
  collectNocodeEditorBlueprintEnumDesignGaps(buildForm([
    {
      fieldKey: 'items',
      name: '明细',
      widgetType: 'widget.form.subform',
      children: [{ fieldKey: 'level', name: '等级', widgetType: 'widget.form.radioGroup' }],
    },
  ])).length,
  1,
)

// 实时计算字段没有公式 -> 缺口
assert.deepEqual(
  collectNocodeEditorBlueprintAutoComputeDesignGaps(buildForm([
    { fieldKey: 'total-amount', name: '合计金额', widgetType: 'widget.form.autoCompute' },
  ])).map(gap => `${gap.reason}:${gap.tableName}.${gap.fieldName}`),
  ['auto-compute-formula-missing:费用类型.合计金额'],
)

// 带 compute-formula 且公式非空 -> 不报
assert.equal(
  collectNocodeEditorBlueprintAutoComputeDesignGaps(buildForm([
    {
      fieldKey: 'total-amount',
      name: '合计金额',
      widgetType: 'widget.form.autoCompute',
      formulaSettings: [{
        formulaPath: 'compute-formula',
        formula: 'SUM([[field:items.amount,金额]])',
      }],
    },
  ])).length,
  0,
)

// 只有 default-formula 或公式为空 -> 仍算缺计算公式
assert.equal(
  collectNocodeEditorBlueprintAutoComputeDesignGaps(buildForm([
    {
      fieldKey: 'total-amount',
      name: '合计金额',
      widgetType: 'widget.form.autoCompute',
      formulaSettings: [{ formulaPath: 'default-formula', formula: '0' }],
    },
    {
      fieldKey: 'balance',
      name: '余额',
      widgetType: 'widget.form.autoCompute',
      formulaSettings: [{ formulaPath: 'compute-formula', formula: '   ' }],
    },
  ])).length,
  2,
)

// 非实时计算字段不受这条规则约束
assert.equal(
  collectNocodeEditorBlueprintAutoComputeDesignGaps(buildForm([
    { fieldKey: 'amount', name: '金额', widgetType: 'widget.form.amountInput' },
  ])).length,
  0,
)

// 子表单里的实时计算字段同样检查
assert.deepEqual(
  collectNocodeEditorBlueprintAutoComputeDesignGaps(buildForm([
    {
      fieldKey: 'items',
      name: '明细',
      widgetType: 'widget.form.subform',
      children: [{ fieldKey: 'subtotal', name: '小计', widgetType: 'widget.form.autoCompute' }],
    },
  ])).map(gap => `${gap.tableName}.${gap.fieldName}`),
  ['费用类型.小计'],
)

// 主进程读取缺口时保留新原因，未知原因丢弃
assert.deepEqual(
  readNocodeEditorBlueprintDesignGaps({
    designGaps: [
      { tableName: '费用类型', fieldName: '合计金额', reason: 'auto-compute-formula-missing' },
      { tableName: '费用类型', fieldName: '类型名称', reason: 'enum-options-missing' },
      { tableName: '费用类型', fieldName: '未知', reason: 'unknown-reason' },
    ],
  }).map(gap => `${gap.fieldName}:${gap.reason || 'none'}`),
  ['合计金额:auto-compute-formula-missing', '类型名称:enum-options-missing', '未知:none'],
)

console.log('blueprint-design-gaps: ok')
