import assert from 'node:assert/strict'

import {
  buildPendingBlueprintDisplayItems,
  collectPendingBlueprintApplyBatches,
  expandPendingBlueprintTargetFormKeys,
} from '../../src/renderer/views/nocode/views/editor/ai/pendingBlueprintWorkspace'

const projectForm = {
  formKey: 'artifact-2',
  tableName: '项目管理表',
  fields: [
    { fieldKey: 'projectName', name: '项目名称', widgetType: 'textInput' },
  ],
}

const reportForm = {
  formKey: 'form-1',
  tableName: '报销单',
  fields: [
    {
      fieldKey: 'project',
      name: '所属项目',
      widgetType: 'treeSelect',
      source: {
        formKey: 'artifact-2',
        formName: '项目管理表',
        fieldKey: 'projectName',
        fieldName: '项目名称',
      },
    },
    {
      fieldKey: 'expenseDetails',
      name: '报销明细',
      widgetType: 'subform',
      children: [
        {
          fieldKey: 'expenseType',
          name: '费用类型',
          widgetType: 'treeSelect',
          source: {
            formKey: 'artifact-3',
            formName: '费用类型表',
            fieldKey: 'typeName',
            fieldName: '类型名称',
          },
        },
      ],
    },
  ],
}

const expenseTypeForm = {
  formKey: 'artifact-3',
  tableName: '费用类型表',
  fields: [
    { fieldKey: 'typeName', name: '类型名称', widgetType: 'textInput' },
  ],
}

const auditForm = {
  formKey: 'artifact-4',
  tableName: '审批记录表',
  fields: [
    { fieldKey: 'auditNote', name: '审批意见', widgetType: 'textarea' },
  ],
}

const blueprint = {
  id: 'bp-dependency-closure',
  title: '报销管理',
  summary: '',
  forms: [reportForm, projectForm, expenseTypeForm, auditForm],
}

const block = {
  type: 'artifact',
  kind: 'blueprint',
  status: 'ready',
  phase: 'staged',
  planningScope: 'form',
  revision: 4,
  stagedAt: 1793027875949,
  title: blueprint.title,
  summary: '',
  blueprint,
}

const items = buildPendingBlueprintDisplayItems(block as any, 1793027880000, 'trace-dependency-closure')
assert.equal(items.length, 4)
assert.deepEqual(
  items.map(item => (item.blueprint?.forms || []).map(form => form.tableName)),
  [['报销单'], ['项目管理表'], ['费用类型表'], ['审批记录表']],
)

// 单卡投影的四张卡仍属于同一暂存版本，批量合并后能还原整份蓝图。
const batches = collectPendingBlueprintApplyBatches(items)
assert.equal(batches.length, 1)
assert.deepEqual(
  (batches[0].item.blueprint?.forms || []).map(form => form.tableName),
  ['报销单', '项目管理表', '费用类型表', '审批记录表'],
)

// 点“报销单”卡时，按字段 source 递归补齐项目管理表与子字段引用的费用类型表；
// 没有被引用的审批记录表不进入本次应用，保持单卡应用语义。
const expandedKeys = expandPendingBlueprintTargetFormKeys(
  batches[0].item.blueprint?.forms,
  ['form-1'],
)
assert.deepEqual(expandedKeys, ['form-1', 'artifact-2', 'artifact-3'])

// 被引用表单自身没有反向依赖时，不额外扩展。
assert.deepEqual(
  expandPendingBlueprintTargetFormKeys(batches[0].item.blueprint?.forms, ['artifact-2']),
  ['artifact-2'],
)

// 没有可用候选表单时保持原目标集合，避免影响非暂存版本的应用路径。
assert.deepEqual(expandPendingBlueprintTargetFormKeys(null, ['form-1']), ['form-1'])
