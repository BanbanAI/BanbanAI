import assert from 'node:assert/strict'

import {
  buildBlueprintFieldDeletionMatcher,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintDeletionIdentity'
import {
  mergeBlueprintFormWithExisting,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintFieldMerge'
import type {
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
        { fieldKey: 'field-amount', name: '金额', widgetType: 'input' },
        { fieldKey: 'field-material', name: '报销材料', widgetType: 'input' },
      ],
    },
    {
      fieldKey: 'field-purchase',
      name: '采购明细',
      widgetType: 'subform',
      children: [
        { fieldKey: 'field-amount', name: '金额', widgetType: 'input' },
        { fieldKey: 'field-qty', name: '数量', widgetType: 'input' },
      ],
    },
    { fieldKey: 'field-remark', name: '备注', widgetType: 'textarea' },
  ],
})

const createAmbiguousParentForm = (): NocodeEditorAiAppBlueprintForm => ({
  formKey: 'form-2',
  tableName: '同名父字段测试',
  fields: [
    {
      fieldKey: 'parent-a',
      name: '明细',
      widgetType: 'subform',
      children: [{ fieldKey: 'amount-a', name: '金额', widgetType: 'input' }],
    },
    {
      fieldKey: 'parent-b',
      name: '明细',
      widgetType: 'subform',
      children: [{ fieldKey: 'amount-b', name: '金额', widgetType: 'input' }],
    },
  ],
})

const createDuplicateSiblingKeyForm = (): NocodeEditorAiAppBlueprintForm => ({
  formKey: 'form-3',
  tableName: '重复子 key 测试',
  fields: [{
    fieldKey: 'parent-x',
    name: '父表',
    widgetType: 'subform',
    children: [
      { fieldKey: 'dup-key', name: '甲字段', widgetType: 'input' },
      { fieldKey: 'dup-key', name: '乙字段', widgetType: 'input' },
    ],
  }],
})

const createNestedContainerForm = (): NocodeEditorAiAppBlueprintForm => ({
  formKey: 'form-4',
  tableName: '嵌套容器测试',
  fields: [{
    fieldKey: 'outer',
    name: '外层',
    widgetType: 'subform',
    children: [{
      fieldKey: 'inner',
      name: '费用',
      widgetType: 'subform',
      children: [{ fieldKey: 'amount', name: '金额', widgetType: 'input' }],
    }],
  }],
})

const patchForm = (fields: NocodeEditorAiAppBlueprintField[]): NocodeEditorAiAppBlueprintForm => ({
  formKey: 'form-1',
  tableName: '报销单',
  fields,
})

const findTopLevelField = (form: NocodeEditorAiAppBlueprintForm, fieldKey: string) => (
  form.fields.find(field => field.fieldKey === fieldKey)
)

const findChildField = (
  form: NocodeEditorAiAppBlueprintForm,
  parentFieldKey: string,
  childFieldKey: string,
) => findTopLevelField(form, parentFieldKey)?.children?.find(
  child => child.fieldKey === childFieldKey,
)

const assertThrowsWith = (
  run: () => unknown,
  patterns: RegExp[],
) => {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof Error)
    patterns.forEach(pattern => assert.match(error.message, pattern))
    return true
  })
}

const main = () => {
  // P0: 裸 key 在多个子表重复时显式失败，不再更新第一个命中的子字段
  assertThrowsWith(
    () => mergeBlueprintFormWithExisting(
      patchForm([{ fieldKey: 'field-amount', name: '金额', description: '含税' }]),
      createCurrentForm(),
      { updateMode: 'patch' },
    ),
    [/field-amount/, /报销明细\.金额/, /采购明细\.金额/],
  )

  // P0: 完整路径可以精确定位重复 key 中的目标子字段
  const mergedByDuplicateKeyPath = mergeBlueprintFormWithExisting(
    patchForm([{ fieldKey: 'field-purchase.field-amount', name: '金额', description: '采购含税' }]),
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    findChildField(mergedByDuplicateKeyPath, 'field-purchase', 'field-amount')?.description,
    '采购含税',
    '重复 key 下路径更新应命中指定子表',
  )
  assert.equal(
    findChildField(mergedByDuplicateKeyPath, 'field-detail', 'field-amount')?.description,
    undefined,
    '路径更新不得误改另一个子表的同 key 字段',
  )
  assert.equal(mergedByDuplicateKeyPath.fields.length, 3, '路径更新不得新增顶层重复字段')

  // P0: 唯一子字段 key 仍支持裸 key 更新
  const mergedByUniqueKey = mergeBlueprintFormWithExisting(
    patchForm([{ fieldKey: 'field-qty', name: '数量', description: '采购数量' }]),
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    findChildField(mergedByUniqueKey, 'field-purchase', 'field-qty')?.description,
    '采购数量',
    '唯一子字段裸 key 应继续原位更新',
  )

  // P0: 同一父字段下重复子 key 时，名称路径只更新指定子字段
  const mergedBySiblingKeyPath = mergeBlueprintFormWithExisting(
    {
      formKey: 'form-3',
      tableName: '重复子 key 测试',
      fields: [{ fieldKey: '父表.乙字段', name: '乙字段', description: '乙更新' }],
    },
    createDuplicateSiblingKeyForm(),
    { updateMode: 'patch' },
  )
  const duplicateSiblingParent = mergedBySiblingKeyPath.fields[0]
  assert.equal(
    duplicateSiblingParent?.children?.[0].description,
    undefined,
    '名称路径不得命中共用 key 的另一个兄弟字段',
  )
  assert.equal(
    duplicateSiblingParent?.children?.[1].description,
    '乙更新',
    '名称路径应精确命中指定兄弟字段',
  )

  // P0: 路径中的父字段同名歧义必须显式失败
  assertThrowsWith(
    () => mergeBlueprintFormWithExisting(
      patchForm([{ fieldKey: '明细.金额', name: '金额', description: '含税' }]),
      createAmbiguousParentForm(),
      { updateMode: 'patch' },
    ),
    [/明细\.金额/, /存在多个匹配/],
  )

  // P0: 删除清单的歧义路径同样不得静默匹配多个字段
  assertThrowsWith(
    () => buildBlueprintFieldDeletionMatcher(createAmbiguousParentForm().fields, ['明细.金额']),
    [/删除字段路径/, /存在多个匹配/],
  )

  // P0: 嵌套容器同时收到「子字段追加」与「容器更新」时，两种片段顺序都应合并落地
  const nestedChildAddition: NocodeEditorAiAppBlueprintField = {
    fieldKey: '外层.费用.新增项',
    name: '新增项',
    widgetType: 'input',
  }
  const nestedContainerUpdate: NocodeEditorAiAppBlueprintField = {
    fieldKey: '外层.费用',
    description: '费用更新',
  }
  const nestedPatchOrders = [
    [nestedChildAddition, nestedContainerUpdate],
    [nestedContainerUpdate, nestedChildAddition],
  ]
  nestedPatchOrders.forEach((fragments, orderIndex) => {
    const orderLabel = `第 ${orderIndex + 1} 种片段顺序`
    const mergedNested = mergeBlueprintFormWithExisting(
      {
        formKey: 'form-4',
        tableName: '嵌套容器测试',
        fields: fragments,
      },
      createNestedContainerForm(),
      { updateMode: 'patch' },
    )
    assert.equal(mergedNested.fields.length, 1, `${orderLabel}不应新增顶层字段`)
    const outerField = mergedNested.fields[0]
    assert.equal(outerField.fieldKey, 'outer', `${orderLabel}应保留外层容器 key`)
    assert.equal(outerField.children?.length, 1, `${orderLabel}不应新增外层子字段`)
    const innerField = outerField.children?.[0]
    assert.equal(innerField?.fieldKey, 'inner', `${orderLabel}应保留内层容器 key`)
    assert.equal(innerField?.description, '费用更新', `${orderLabel}应合并容器更新`)
    assert.deepEqual(
      innerField?.children?.map(child => child.fieldKey),
      ['amount', '新增项'],
      `${orderLabel}应同时保留既有子字段并追加新子字段`,
    )
  })

  // P0: 同一目标被两个片段重复 patch 时显式失败
  assertThrowsWith(
    () => mergeBlueprintFormWithExisting(
      patchForm([
        { fieldKey: 'field-qty', name: '数量', description: '第一次' },
        { name: '数量', description: '第二次' },
      ]),
      createCurrentForm(),
      { updateMode: 'patch' },
    ),
    [/多个字段片段指向同一个字段/, /采购明细\.数量/],
  )

  // P1: patch 按名称兜底命中时保留既有 fieldKey
  const mergedByNameFallback = mergeBlueprintFormWithExisting(
    patchForm([{ fieldKey: 'field-remark-new', name: '备注', description: '更新备注' }]),
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    findTopLevelField(mergedByNameFallback, 'field-remark')?.description,
    '更新备注',
    '按名称兜底时应更新既有字段',
  )
  assert.equal(
    findTopLevelField(mergedByNameFallback, 'field-remark-new'),
    undefined,
    '按名称兜底时不得新增同名字段',
  )

  // P1: 归一化 key 命中也保留规范 fieldKey
  const mergedByNormalizedKey = mergeBlueprintFormWithExisting(
    patchForm([{ fieldKey: 'field remark', name: '备注', description: '归一化命中' }]),
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    findTopLevelField(mergedByNormalizedKey, 'field-remark')?.description,
    '归一化命中',
    '归一化 key 应命中既有字段',
  )
  assert.equal(
    mergedByNormalizedKey.fields.some(field => field.fieldKey === 'field remark'),
    false,
    'patch 不得用归一化 key 覆盖既有 fieldKey',
  )

  // P1: 子字段按名称兜底更新时同样保留既有 fieldKey
  const mergedChildByNameFallback = mergeBlueprintFormWithExisting(
    patchForm([{
      fieldKey: 'field-detail',
      name: '报销明细',
      children: [{ fieldKey: 'field-amount-new', name: '金额', description: '含税' }],
    }]),
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    findChildField(mergedChildByNameFallback, 'field-detail', 'field-amount')?.description,
    '含税',
    '子字段按名称兜底时应更新既有子字段',
  )
  assert.equal(
    findChildField(mergedChildByNameFallback, 'field-detail', 'field-amount-new'),
    undefined,
    '子字段按名称兜底时不得改写既有 fieldKey',
  )

  // P1: replace 模式仍以快照 key 为准
  const replacedForm = mergeBlueprintFormWithExisting(
    patchForm([{ fieldKey: 'field-remark-new', name: '备注', widgetType: 'textarea' }]),
    createCurrentForm(),
    { updateMode: 'replace' },
  )
  assert.equal(
    findTopLevelField(replacedForm, 'field-remark-new')?.name,
    '备注',
    'replace 模式应允许使用快照中的新 fieldKey',
  )

  // P1: 真正的新字段保留自己的 key
  const mergedWithNewField = mergeBlueprintFormWithExisting(
    patchForm([{ fieldKey: 'field-new', name: '新字段', widgetType: 'input' }]),
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    findTopLevelField(mergedWithNewField, 'field-new')?.description,
    undefined,
    '新增字段不应被误判为更新',
  )
  assert.equal(mergedWithNewField.fields.length, 4, '新增字段应正常落地')

  // P2: 无 key 且唯一同名时原位更新子字段
  const mergedByUniqueChildName = mergeBlueprintFormWithExisting(
    patchForm([{ name: '数量', description: '采购数量' }]),
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    findChildField(mergedByUniqueChildName, 'field-purchase', 'field-qty')?.description,
    '采购数量',
    '唯一同名子字段应原位更新',
  )
  assert.equal(mergedByUniqueChildName.fields.length, 3, '唯一同名子字段更新不得新增顶层字段')

  // P2: 无 key 且多个同名子字段时显式失败
  assertThrowsWith(
    () => mergeBlueprintFormWithExisting(
      patchForm([{ name: '金额', description: '含税' }]),
      createCurrentForm(),
      { updateMode: 'patch' },
    ),
    [/「金额」/, /报销明细\.金额/, /采购明细\.金额/],
  )

  // P2: 顶层同名字段优先于子字段
  const mergedTopLevelNameFirst = mergeBlueprintFormWithExisting(
    patchForm([{ name: '备注', description: '顶层优先' }]),
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    findTopLevelField(mergedTopLevelNameFirst, 'field-remark')?.description,
    '顶层优先',
    '顶层同名字段应优先更新',
  )
  assert.equal(mergedTopLevelNameFirst.fields.length, 3, '顶层更新不得新增字段')

  // P2: 没有任何同名目标时仍按新增字段处理
  const mergedWithUnknownName = mergeBlueprintFormWithExisting(
    patchForm([{ name: '全新字段', description: '新增' }]),
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    mergedWithUnknownName.fields.some(field => field.name === '全新字段'),
    true,
    '无匹配名称的片段应作为新字段落地',
  )

  // P0: formKey-only patch 片段不得清空既有表名，子字段必须落在父字段 children 内
  const mergedByFormKeyOnlyPatch = mergeBlueprintFormWithExisting(
    {
      formKey: 'form-1',
      tableName: '',
      fields: [{
        fieldKey: 'field-detail',
        children: [{
          fieldKey: 'field-reimbursement-voucher',
          name: '报销凭证照片',
          widgetType: 'widget.form.image-uploader',
        }],
      }],
    },
    createCurrentForm(),
    { updateMode: 'patch' },
  )
  assert.equal(
    mergedByFormKeyOnlyPatch.tableName,
    '报销单',
    'formKey-only patch 应沿用既有表名',
  )
  assert.equal(
    mergedByFormKeyOnlyPatch.formKey,
    'form-1',
    'formKey-only patch 应沿用既有 formKey',
  )
  assert.deepEqual(
    findTopLevelField(mergedByFormKeyOnlyPatch, 'field-detail')?.children?.map(child => child.fieldKey),
    ['field-amount', 'field-material', 'field-reimbursement-voucher'],
    '子字段应追加到父字段 children 末尾',
  )
  assert.equal(
    mergedByFormKeyOnlyPatch.fields.some(field => field.fieldKey === 'field-reimbursement-voucher'),
    false,
    '子字段不得沉淀到 form.fields 顶层',
  )
  assert.equal(
    mergedByFormKeyOnlyPatch.fields.filter(field => field.name === '报销凭证照片').length,
    0,
    '父字段内新增的子字段不得以同名顶层字段重复出现',
  )

  console.log('blueprint field merge safety regression checks passed')
}

main()
