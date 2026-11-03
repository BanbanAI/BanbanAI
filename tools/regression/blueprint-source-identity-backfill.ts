import assert from 'node:assert/strict'

import { backfillNocodeEditorBlueprintSourceIdentities } from '../../src/common/utils/nocodeEditorBlueprintSourceIdentity'
import { buildPendingBlueprintDisplayItems } from '../../src/renderer/views/nocode/views/editor/ai/pendingBlueprintWorkspace'

// 只带 formKey 的 source 应从蓝图表单补全表名和字段名，避免界面把内部键当表名展示。
{
  const blueprint = {
    forms: [
      {
        formKey: 'form-1',
        tableName: '客户',
        fields: [{ fieldKey: 'customer_name', name: '客户名称', widgetType: 'textInput' }],
      },
      {
        formKey: 'form-4',
        tableName: '商机',
        fields: [
          {
            fieldKey: 'opportunity_name',
            name: '商机名称',
            widgetType: 'textInput',
          },
        ],
      },
      {
        formKey: 'form-5',
        tableName: '销售订单',
        fields: [
          {
            fieldKey: 'customer',
            name: '关联客户',
            widgetType: 'select',
            source: { formKey: 'form-1', fieldKey: 'customer_name' },
          },
          {
            fieldKey: 'opportunity',
            name: '关联商机',
            widgetType: 'select',
            source: { formKey: 'form-4', fieldName: '商机名称' },
          },
        ],
      },
    ],
  }
  const result = backfillNocodeEditorBlueprintSourceIdentities(blueprint) as typeof blueprint
  const orderForm = result.forms[2]
  assert.deepEqual(orderForm.fields[0].source, {
    formKey: 'form-1',
    fieldKey: 'customer_name',
    formName: '客户',
    fieldName: '客户名称',
  })
  assert.deepEqual(orderForm.fields[1].source, {
    formKey: 'form-4',
    fieldName: '商机名称',
    formName: '商机',
    fieldKey: 'opportunity_name',
  })
  assert.equal(blueprint.forms[2].fields[0].source.formName, undefined, '不能修改入参蓝图')
}

// 只有表名时补 formKey；“客户信息表 / 客户信息”按同一张表处理。
{
  const blueprint = {
    forms: [
      { formKey: 'artifact-1', tableName: '客户信息', fields: [{ fieldKey: 'name', name: '客户名称' }] },
      {
        formKey: 'form-2',
        tableName: '联系人',
        fields: [
          {
            fieldKey: 'customer',
            name: '所属客户',
            source: { formName: '客户信息表', fieldKey: 'name' },
          },
        ],
      },
    ],
  }
  const result = backfillNocodeEditorBlueprintSourceIdentities(blueprint) as typeof blueprint
  assert.deepEqual(result.forms[1].fields[0].source, {
    formName: '客户信息表',
    fieldKey: 'name',
    formKey: 'artifact-1',
    fieldName: '客户名称',
  })
}

// 指向蓝图外的表单或字段时保持原样，不能凭空补一个错误身份。
{
  const source = { formKey: 'ext-customer', fieldKey: 'ext-name' }
  const blueprint = {
    forms: [
      {
        formKey: 'form-1',
        tableName: '销售订单',
        fields: [{ fieldKey: 'customer', name: '关联客户', source }],
      },
    ],
  }
  const result = backfillNocodeEditorBlueprintSourceIdentities(blueprint)
  assert.equal(result, blueprint)
}

// 工作台按表单切片展示前应补全来源身份：单卡里也能显示“客户.客户名称”。
{
  const block = {
    kind: 'blueprint' as const,
    status: 'ready' as const,
    phase: 'staged',
    revision: 1,
    stagedAt: 1000,
    title: 'CRM 蓝图',
    blueprint: {
      id: 'bp-1',
      title: 'CRM 蓝图',
      forms: [
        { formKey: 'form-1', tableName: '客户', fields: [{ fieldKey: 'customer_name', name: '客户名称' }] },
        {
          formKey: 'form-5',
          tableName: '销售订单',
          fields: [
            {
              fieldKey: 'customer',
              name: '关联客户',
              source: { formKey: 'form-1', fieldKey: 'customer_name' },
            },
          ],
        },
      ],
    },
  }
  const items = buildPendingBlueprintDisplayItems(block as unknown as Parameters<typeof buildPendingBlueprintDisplayItems>[0])
  assert.equal(items.length, 2)
  const orderItem = items.find(item => item.blueprint?.forms[0]?.tableName === '销售订单')
  assert.ok(orderItem)
  assert.equal(items.length > 1, true)
  const source = orderItem!.blueprint!.forms[0].fields[0].source
  assert.equal(source?.formName, '客户')
  assert.equal(source?.fieldName, '客户名称')
}

console.log('blueprint-source-identity-backfill: ok')
