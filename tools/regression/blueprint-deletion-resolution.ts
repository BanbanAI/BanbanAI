import assert from 'node:assert/strict'

import {
  buildBlueprintFieldDeletionMatcher,
  resolveBlueprintDeletionPlan,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintDeletionIdentity'
import {
  mergeBlueprintFieldsWithExisting,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintFieldMerge'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintForm,
} from '../../src/renderer/views/nocode/views/editor/ai/types'

const createBlueprint = (): NocodeEditorAiAppBlueprint => ({
  id: 'bp-deletion-regression',
  title: '报销',
  forms: [{
    tableName: '报销单',
    fields: [{
      fieldKey: 'reimbursement_details',
      name: '报销明细',
      widgetType: 'subform',
      children: [
        { fieldKey: 'reimbursement_material', name: '报销材料', widgetType: 'input' },
        { fieldKey: 'invoice_attachment', name: '发票附件', widgetType: 'input' },
      ],
    }],
  }],
})

const createDuplicateFormBlueprint = (): NocodeEditorAiAppBlueprint => {
  const blueprint = createBlueprint()
  blueprint.forms.push({
    ...blueprint.forms[0],
    groupName: '另一个分组',
  })
  return blueprint
}

const createDuplicateChildKeyBlueprint = (): NocodeEditorAiAppBlueprint => ({
  id: 'bp-duplicate-child-key',
  title: '重复子字段',
  forms: [{
    tableName: '报销单',
    fields: [
      {
        fieldKey: 'details_a',
        name: '明细A',
        widgetType: 'subform',
        children: [{ fieldKey: 'amount', name: '金额', widgetType: 'input' }],
      },
      {
        fieldKey: 'details_b',
        name: '明细B',
        widgetType: 'subform',
        children: [{ fieldKey: 'amount', name: '金额', widgetType: 'input' }],
      },
    ],
  }],
})

const getForm = (blueprint: NocodeEditorAiAppBlueprint): NocodeEditorAiAppBlueprintForm => (
  blueprint.forms[0]
)

const main = () => {
  // 日志同款：表单没有 formKey，模型用 tableName + 父.子路径删除子字段。
  const logBlueprint = createBlueprint()
  const logForm = getForm(logBlueprint)
  const logPlan = resolveBlueprintDeletionPlan(
    logBlueprint,
    [],
    [{
      formKey: '报销单',
      fieldKeys: ['reimbursement_details.reimbursement_material'],
    }],
  )
  assert.equal(logPlan.issues.length, 0, '无 formKey 的表单应能按 tableName 解析')
  assert.equal(logPlan.fieldKeysByForm.size, 1, '删除字段应归到目标表单')
  const logMatcher = buildBlueprintFieldDeletionMatcher(
    logForm.fields,
    logPlan.fieldKeysByForm.get(logForm),
  )
  const logMergedFields = mergeBlueprintFieldsWithExisting([], logForm.fields, logMatcher)
  assert.deepEqual(
    logMergedFields[0].children?.map(child => child.fieldKey),
    ['invoice_attachment'],
    '父.子路径应只删除目标子字段',
  )

  // 整表删除同样接受 formKey 或唯一 tableName。
  assert.equal(
    resolveBlueprintDeletionPlan(createBlueprint(), ['报销单'], []).deletedForms.size,
    1,
    '整表删除应支持 tableName',
  )
  const keyedBlueprint = createBlueprint()
  keyedBlueprint.forms[0].formKey = 'form-1'
  assert.equal(
    resolveBlueprintDeletionPlan(keyedBlueprint, ['form-1'], []).deletedForms.size,
    1,
    '整表删除应支持稳定 formKey',
  )
  assert.equal(
    resolveBlueprintDeletionPlan(createBlueprint(), ['form-1'], []).issues[0]?.kind,
    'unresolved_form',
    '不存在的 formKey 应显式报错',
  )

  // 同表名多表单必须报歧义，不能批量删除。
  const ambiguousFormPlan = resolveBlueprintDeletionPlan(
    createDuplicateFormBlueprint(),
    ['报销单'],
    [],
  )
  assert.equal(ambiguousFormPlan.issues[0]?.kind, 'ambiguous_form', '同表名应报表单歧义')

  // 未知字段和部分未命中都不能静默通过。
  const unknownFieldPlan = resolveBlueprintDeletionPlan(
    createBlueprint(),
    [],
    [{ formKey: '报销单', fieldKeys: ['ghost'] }],
  )
  assert.equal(unknownFieldPlan.issues[0]?.kind, 'unresolved_field', '未知字段应报错')
  const partialPlan = resolveBlueprintDeletionPlan(
    createBlueprint(),
    [],
    [{
      formKey: '报销单',
      fieldKeys: ['reimbursement_details.reimbursement_material', 'ghost'],
    }],
  )
  assert.equal(
    partialPlan.issues.filter(issue => issue.kind === 'unresolved_field').length,
    1,
    '部分未命中应报错而不是删一半',
  )

  // 同一裸 key 命中多个子表时必须要求父.子路径。
  const duplicateChildKeyPlan = resolveBlueprintDeletionPlan(
    createDuplicateChildKeyBlueprint(),
    [],
    [{ formKey: '报销单', fieldKeys: ['amount'] }],
  )
  assert.equal(
    duplicateChildKeyPlan.issues[0]?.kind,
    'ambiguous_field',
    '重复子字段 key 应报字段歧义',
  )

  // 整表已删除时，冗余的字段删除项不应额外报错。
  const redundantPlan = resolveBlueprintDeletionPlan(
    createBlueprint(),
    ['报销单'],
    [{ formKey: '报销单', fieldKeys: ['ghost'] }],
  )
  assert.equal(redundantPlan.issues.length, 0, '整表删除时冗余字段项不应误报')

  console.log('blueprint deletion resolution regression checks passed')
}

main()
