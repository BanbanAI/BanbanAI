import assert from 'node:assert/strict'

import {
  buildBlueprintFieldIdentityPathTokens,
  createBlueprintFieldIdentityIndex,
  findBlueprintFieldInIdentityIndex,
  getBlueprintFieldStableIdentityKey,
  resolveBlueprintFieldIdentity,
  resolveBlueprintFieldPath,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintFieldIdentity'
import {
  buildBlueprintFieldDeletionMatcher,
  isBlueprintFieldMarkedDeleted,
  resolveBlueprintDeletionPlan,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintDeletionIdentity'
import {
  mergeBlueprintFormWithExisting,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintFieldMerge'
import {
  normalizeNocodeEditorBlueprintToolInput,
} from '../../src/common/utils/nocodeEditorBlueprintInput'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
} from '../../src/renderer/views/nocode/views/editor/ai/types'

const createCurrentForm = (): NocodeEditorAiAppBlueprintForm => ({
  formKey: 'form-1',
  tableName: '报销单',
  fields: [
    {
      fieldKey: 'field-detail',
      name: '报销明细',
      widgetType: 'subform',
      children: [
        { fieldKey: 'field-material', name: '报销材料', widgetType: 'input' },
        { fieldKey: 'field-amount', name: '金额', widgetType: 'input' },
      ],
    },
    { fieldKey: 'field-material-top', name: '报销材料', widgetType: 'input' },
    { fieldKey: 'field-remark', name: '备注', widgetType: 'textarea' },
  ],
})

const main = () => {
  const currentForm = createCurrentForm()
  const detailField = currentForm.fields[0] as NocodeEditorAiAppBlueprintField
  const materialField = detailField.children?.[0] as NocodeEditorAiAppBlueprintField

  const index = createBlueprintFieldIdentityIndex(currentForm.fields)
  assert.equal(
    findBlueprintFieldInIdentityIndex('field-remark', index)?.fieldKey,
    'field-remark',
    '真实 fieldKey 应直接命中',
  )
  assert.equal(
    findBlueprintFieldInIdentityIndex('field remark', index)?.fieldKey,
    'field-remark',
    '归一化 fieldKey 应命中（空格/连字符差异）',
  )
  assert.equal(
    findBlueprintFieldInIdentityIndex('备注', index)?.fieldKey,
    'field-remark',
    '字段名应作为兜底标识命中',
  )
  assert.equal(
    resolveBlueprintFieldIdentity({ fieldKey: 'field detail', name: '错误名称' }, index)?.fieldKey,
    'field-detail',
    '字段对象携带归一化 fieldKey 时应优先按 fieldKey 解析',
  )

  const childPath = resolveBlueprintFieldPath('报销明细.报销材料', currentForm.fields)
  assert.equal(childPath?.kind, 'existing', '父名.子名路径应解析到已有子字段')
  if (childPath?.kind === 'existing') {
    assert.equal(getBlueprintFieldStableIdentityKey(childPath.leafField), 'field-material')
  }
  assert.equal(
    resolveBlueprintFieldPath('field-detail.报销材料', currentForm.fields)?.kind,
    'existing',
    '父 key + 子名路径应解析到已有子字段',
  )
  assert.deepEqual(
    buildBlueprintFieldIdentityPathTokens([detailField, materialField]),
    buildBlueprintFieldIdentityPathTokens(
      (resolveBlueprintFieldPath('报销明细.报销材料', currentForm.fields) as {
        fieldChain: NocodeEditorAiAppBlueprintField[]
      }).fieldChain,
    ),
    '路径引用与真实字段链应生成一致的路径 token',
  )

  const pathMatcher = buildBlueprintFieldDeletionMatcher(
    currentForm.fields,
    ['报销明细.报销材料'],
  )
  const materialPath = [detailField, materialField]
  assert.equal(
    isBlueprintFieldMarkedDeleted(materialField, pathMatcher, materialPath),
    true,
    '父.子路径应命中目标子字段',
  )
  assert.equal(
    isBlueprintFieldMarkedDeleted(
      currentForm.fields[1],
      pathMatcher,
      [currentForm.fields[1]],
    ),
    false,
    '路径删除不得命中其他位置同名字段',
  )

  const blueprint: NocodeEditorAiAppBlueprint = {
    id: 'bp-regression',
    title: '报销',
    forms: [currentForm],
  }
  const pathDeletionPlan = resolveBlueprintDeletionPlan(
    blueprint,
    [],
    [{ formKey: 'form-1', fieldKeys: ['报销明细.报销材料'] }],
  )
  assert.equal(pathDeletionPlan.issues.length, 0, '删除清单的路径标识应能唯一解析')
  assert.deepEqual(
    pathDeletionPlan.fieldKeysByForm.get(currentForm),
    ['报销明细.报销材料'],
    '删除清单的路径标识应归到目标表单',
  )
  const combinedDeletionPlan = resolveBlueprintDeletionPlan(
    blueprint,
    [],
    [
      { formKey: 'form-1', fieldKeys: ['报销明细.报销材料'] },
      { formKey: 'form-1', fieldKeys: ['field-remark'] },
    ],
  )
  assert.equal(combinedDeletionPlan.issues.length, 0, '同一表单的多条删除记录应全部可解析')
  assert.deepEqual(
    combinedDeletionPlan.fieldKeysByForm.get(currentForm),
    ['报销明细.报销材料', 'field-remark'],
    '同一表单的多条删除记录应合并而非互相覆盖',
  )

  const mergedByPath = mergeBlueprintFormWithExisting(
    { formKey: 'form-1', tableName: '报销单', fields: [] },
    currentForm,
    { updateMode: 'patch', deletionMatcher: pathMatcher },
  )
  const mergedDetail = mergedByPath.fields[0]
  assert.deepEqual(
    mergedDetail.children?.map(child => child.fieldKey),
    ['field-amount'],
    '路径删除应移除指定子字段并保留其他子字段',
  )
  assert.equal(
    mergedByPath.fields.filter(field => field.name === '报销材料').length,
    1,
    '路径删除不得误删其他位置同名字段',
  )

  const mergedByPathWithParentPatch = mergeBlueprintFormWithExisting(
    {
      formKey: 'form-1',
      tableName: '报销单',
      fields: [{
        fieldKey: 'field-detail',
        name: '报销明细',
        children: [{
          fieldKey: 'field-amount',
          name: '金额',
          description: '含税金额',
        }],
      }],
    },
    currentForm,
    { updateMode: 'patch', deletionMatcher: pathMatcher },
  )
  assert.deepEqual(
    mergedByPathWithParentPatch.fields[0].children?.map(child => child.fieldKey),
    ['field-amount'],
    '父字段同时被 patch 时，路径删除仍应命中其子字段',
  )
  assert.equal(
    mergedByPathWithParentPatch.fields[0].children?.[0].description,
    '含税金额',
    '父字段 patch 应与其他子字段合并保留',
  )

  const bareMatcher = buildBlueprintFieldDeletionMatcher(
    currentForm.fields,
    ['field-material'],
  )
  const mergedByBareKey = mergeBlueprintFormWithExisting(
    { formKey: 'form-1', tableName: '报销单', fields: [] },
    currentForm,
    { updateMode: 'patch', deletionMatcher: bareMatcher },
  )
  assert.deepEqual(
    mergedByBareKey.fields[0].children?.map(child => child.fieldKey),
    ['field-amount'],
    '子字段裸 key 删除仍应递归命中',
  )
  assert.equal(
    mergedByBareKey.fields.some(field => field.fieldKey === 'field-material-top'),
    true,
    '子字段裸 key 不得误删顶层同名字段',
  )

  const mergedByPathUpdate = mergeBlueprintFormWithExisting(
    {
      formKey: 'form-1',
      tableName: '报销单',
      fields: [{
        fieldKey: '报销明细.报销材料',
        name: '报销材料',
        description: '请上传发票',
      }],
    },
    currentForm,
    { updateMode: 'patch' },
  )
  assert.equal(
    mergedByPathUpdate.fields.length,
    currentForm.fields.length,
    '点路径更新不得沉淀出顶层重复字段',
  )
  assert.equal(
    mergedByPathUpdate.fields[0].children?.[0].description,
    '请上传发票',
    '点路径更新应原位修改子字段',
  )

  const deletionOnlyPatch = normalizeNocodeEditorBlueprintToolInput({
    updateMode: 'patch',
    blueprint: { id: 'bp-regression' },
    deletedFields: [{ formKey: 'form-1', fieldKeys: ['报销明细.报销材料'] }],
  })
  assert.equal(deletionOnlyPatch.ok, true, '仅删除 patch 应允许省略 blueprint.forms')
  if (deletionOnlyPatch.ok) {
    assert.deepEqual(
      (deletionOnlyPatch.input.blueprint as Record<string, unknown>).forms,
      [],
      '仅删除 patch 应补出空 forms 供合并链路保留既有表单',
    )
  }

  assert.equal(
    normalizeNocodeEditorBlueprintToolInput({
      updateMode: 'patch',
      deletedFormKeys: ['form-1'],
    }).ok,
    true,
    '仅传 deletedFormKeys 的 patch 应被接受',
  )
  assert.equal(
    normalizeNocodeEditorBlueprintToolInput({
      updateMode: 'patch',
      blueprint: { id: 'bp-regression' },
    }).ok,
    false,
    '没有删除清单时 patch 仍必须提供 blueprint.forms',
  )
  assert.equal(
    normalizeNocodeEditorBlueprintToolInput({
      updateMode: 'replace',
      blueprint: { id: 'bp-regression' },
      deletedFormKeys: ['form-1'],
    }).ok,
    false,
    'replace 省略 forms 仍应失败',
  )

  console.log('blueprint field identity regression checks passed')
}

main()
