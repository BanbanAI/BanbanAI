import assert from 'node:assert/strict'

import { resolveBlueprintFieldInterpretation } from '../../src/renderer/views/nocode/views/editor/ai/blueprintFieldInterpretation'

const interpret = (overrides: Record<string, unknown>) => resolveBlueprintFieldInterpretation({
  formName: '员工费用报销申请表单',
  name: '',
  explicitWidgetType: '',
  description: '',
  notes: [],
  hasSource: false,
  canResolveRelationSource: false,
  hasChildren: false,
  enumOptionsCount: 0,
  hasBlueprint: true,
  textFirstConfirmed: false,
  ...overrides,
} as Parameters<typeof resolveBlueprintFieldInterpretation>[0])

// 蓝图已声明具体组件时即定稿：不再用名称启发式重开来源追问
const declaredEnumField = interpret({
  name: '费用项目',
  explicitWidgetType: 'widget.form.radioGroup',
  enumOptionsCount: 6,
})
assert.equal(declaredEnumField.widgetType, 'widget.form.radioGroup')
assert.equal(declaredEnumField.requiresClarification, false)
assert.equal(declaredEnumField.clarificationQuestion, undefined)

const declaredDateField = interpret({
  name: '费用项目',
  explicitWidgetType: 'widget.form.datePicker',
})
assert.equal(declaredDateField.widgetType, 'widget.form.datePicker')
assert.equal(declaredDateField.requiresClarification, false)

const declaredAmountField = interpret({
  name: '报销总金额',
})
assert.equal(declaredAmountField.widgetType, 'widget.form.amountInput')
assert.equal(declaredAmountField.requiresClarification, false)

// 同一规则覆盖非枚举组件：附件/时间这类过去会被重复追问的字段
const declaredUploadField = interpret({
  name: '附件',
  explicitWidgetType: 'widget.form.image-uploader',
})
assert.equal(declaredUploadField.widgetType, 'widget.form.image-uploader')
assert.equal(declaredUploadField.requiresClarification, false)

const declaredTimeField = interpret({
  name: '时间',
  explicitWidgetType: 'widget.form.timePicker',
})
assert.equal(declaredTimeField.widgetType, 'widget.form.timePicker')
assert.equal(declaredTimeField.requiresClarification, false)

// 未声明组件类型时仍按启发式追问，避免把“没定稿”误判成定稿
const undeclaredMasterDataField = interpret({
  name: '客户',
  explicitWidgetType: 'widget.form.textInput',
})
assert.equal(undeclaredMasterDataField.requiresClarification, true)
assert.ok(String(undeclaredMasterDataField.clarificationQuestion).includes('客户'))

// 声明了关联组件但没有来源：属于真正未定稿，继续追问
const relationWithoutSource = interpret({
  name: '客户',
  explicitWidgetType: 'widget.form.treeSelect',
})
assert.equal(relationWithoutSource.requiresClarification, true)

// 来源/手填答复属于已有定稿结论，不再追问
const relationWithSource = interpret({
  name: '客户',
  explicitWidgetType: 'widget.form.treeSelect',
  hasSource: true,
  canResolveRelationSource: true,
})
assert.equal(relationWithSource.widgetType, 'widget.form.treeSelect')
assert.equal(relationWithSource.requiresClarification, false)

const genericWithSource = interpret({ name: '客户', hasSource: true })
assert.equal(genericWithSource.widgetType, 'widget.form.treeSelect')
assert.equal(genericWithSource.requiresClarification, false)

const textFirstConfirmed = interpret({ name: '客户', textFirstConfirmed: true })
assert.equal(textFirstConfirmed.widgetType, 'widget.form.textInput')
assert.equal(textFirstConfirmed.requiresClarification, false)

const subformField = interpret({ name: '费用明细', hasChildren: true })
assert.equal(subformField.widgetType, 'widget.form.subform')
assert.equal(subformField.requiresClarification, false)

console.log('blueprint-field-declaration-finality: ok')
