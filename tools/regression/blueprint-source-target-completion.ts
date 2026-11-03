import assert from 'node:assert/strict'

import {
  completeNocodeEditorBlueprintSourceTargets,
  downgradeNocodeEditorBlueprintResolvedSourceQuestions,
  filterNocodeEditorBlueprintResolvedSourceOpenQuestions,
} from '../../src/common/utils/nocodeEditorBlueprintSourceTargets'
import type { NocodeEditorAiConfirmPayload } from '../../src/common/types/nocodeEditorConfirmation'

const leaveForm = {
  formKey: 'form-leave',
  tableName: '学生请假申请表',
  fields: [
    { fieldKey: 'f-name', name: '姓名', source: { formName: '学生信息管理表', fieldName: '姓名' } },
    { fieldKey: 'f-no', name: '学号', source: { formName: '学生信息管理表', fieldName: '学号' } },
    { fieldKey: 'f-class', name: '班级', source: { formName: '学生信息管理表', fieldName: '班级' } },
  ],
}

// source 指向的表不在蓝图/应用里时，按“新建关联表”补全并合并被引用字段。
{
  const completion = completeNocodeEditorBlueprintSourceTargets({ forms: [leaveForm] })
  assert.equal(completion.unresolved.length, 0)
  assert.equal(completion.synthesizedForms.length, 1)
  assert.equal(completion.synthesizedForms[0].tableName, '学生信息管理表')
  assert.deepEqual(
    completion.synthesizedForms[0].fields.map(field => field.name),
    ['姓名', '学号', '班级'],
  )
  assert.equal(completion.forms.length, 2)
  assert.equal((completion.forms[1] as any).tableName, '学生信息管理表')
  assert.equal(leaveForm.fields.length, 3, '补全不能修改入参蓝图')
}

// 同一关联表被多个字段引用时只补一张表，字段去重并保留 fieldKey。
{
  const completion = completeNocodeEditorBlueprintSourceTargets({
    forms: [{
      formKey: 'form-leave',
      tableName: '学生请假申请表',
      fields: [
        { fieldKey: 'f-name', name: '姓名', source: { formKey: 'ext-student', formName: '学生信息管理表', fieldKey: 'ext-name', fieldName: '姓名' } },
        { fieldKey: 'f-name-2', name: '备用姓名', source: { formKey: 'ext-student', formName: '学生信息管理表', fieldKey: 'ext-name', fieldName: '姓名' } },
        { fieldKey: 'f-class', name: '班级', source: { formKey: 'ext-student', formName: '学生信息管理表', fieldKey: 'ext-class', fieldName: '班级' } },
      ],
    }],
  })
  assert.equal(completion.synthesizedForms.length, 1)
  assert.deepEqual(
    completion.synthesizedForms[0].fields,
    [
      { name: '姓名', fieldKey: 'ext-name' },
      { name: '班级', fieldKey: 'ext-class' },
    ],
  )
}

// 关联表已经在蓝图里时不重复补全，也不产生待处理问题归属。
{
  const completion = completeNocodeEditorBlueprintSourceTargets({
    forms: [
      leaveForm,
      {
        formKey: 'form-student',
        tableName: '学生信息管理表',
        fields: [{ fieldKey: 'f-name', name: '姓名' }],
      },
    ],
  })
  assert.equal(completion.synthesizedForms.length, 0)
  assert.equal(completion.unresolved.length, 0)
  assert.equal(completion.resolvedSourceFields.length, 0)
  assert.equal(completion.forms.length, 2)
}

// 应用里已有同义表名（带/不带“表”等后缀）时不应再新建一张重复表。
{
  const completion = completeNocodeEditorBlueprintSourceTargets({
    forms: [leaveForm],
    existingForms: [{ tableId: 'table-student', tableName: '学生信息管理' }],
  })
  assert.equal(completion.synthesizedForms.length, 0)
  assert.equal(completion.unresolved.length, 0)
  assert.equal(completion.forms.length, 1)
}

// source.formKey 命中应用表的 tableId 时同样视为已存在。
{
  const completion = completeNocodeEditorBlueprintSourceTargets({
    forms: [{
      formKey: 'form-leave',
      tableName: '学生请假申请表',
      fields: [{
        fieldKey: 'f-name',
        name: '姓名',
        source: { formKey: 'table-student', fieldName: '姓名' },
      }],
    }],
    existingForms: [{ tableId: 'table-student', tableName: '学生信息管理' }],
  })
  assert.equal(completion.synthesizedForms.length, 0)
  assert.equal(completion.unresolved.length, 0)
}

// 只有 formKey、缺少关联表名或显示字段时无法安全自动建表，必须报未解析。
{
  const completion = completeNocodeEditorBlueprintSourceTargets({
    forms: [{
      formKey: 'form-leave',
      tableName: '学生请假申请表',
      fields: [
        { fieldKey: 'f-a', name: '学生', source: { formKey: 'missing-table' } },
        { fieldKey: 'f-b', name: '部门', source: { formName: '部门表' } },
      ],
    }],
  })
  assert.equal(completion.synthesizedForms.length, 0)
  assert.equal(completion.forms.length, 1)
  assert.equal(completion.unresolved.length, 2)
  const keyOnly = completion.unresolved.find(item => item.formKey === 'missing-table')
  assert.ok(keyOnly)
  assert.deepEqual(keyOnly.fieldNames, [])
  assert.deepEqual(keyOnly.owners, ['学生请假申请表.学生'])
  const nameOnly = completion.unresolved.find(item => item.formName === '部门表')
  assert.ok(nameOnly)
  assert.deepEqual(nameOnly.fieldNames, [])
}

// 子字段里的 source 也要参与补全。
{
  const completion = completeNocodeEditorBlueprintSourceTargets({
    forms: [{
      formKey: 'form-leave',
      tableName: '学生请假申请表',
      fields: [{
        fieldKey: 'f-detail',
        name: '明细',
        children: [{
          fieldKey: 'f-student',
          name: '学生',
          source: { formName: '学生信息管理表', fieldName: '姓名' },
        }],
      }],
    }],
  })
  assert.equal(completion.synthesizedForms.length, 1)
  assert.deepEqual(completion.synthesizedForms[0].fields, [{ name: '姓名' }])
  assert.equal(completion.resolvedSourceFields[0].ownerFieldKey, 'f-student')
}

// 补全后，引用该表的问题应被过滤掉，无关问题保留。
{
  const openQuestions = [
    '学生信息管理表在当前应用中未找到，请确认该表是否已存在，或提供正确的表名和关联显示字段。',
    '是否需要审批流程？',
  ]
  const filtered = filterNocodeEditorBlueprintResolvedSourceOpenQuestions(openQuestions, [
    { tableName: '学生信息管理表', fields: [{ name: '姓名' }] },
  ])
  assert.deepEqual(filtered, ['是否需要审批流程？'])

  const untouched = filterNocodeEditorBlueprintResolvedSourceOpenQuestions(['学生表是否已存在？'], [])
  assert.deepEqual(untouched, ['学生表是否已存在？'])
}

// 补全后 confirmation 里的阻塞问题降级为默认处理说明，无关问题保持原样。
{
  const confirmation: NocodeEditorAiConfirmPayload = {
    stage: 'blueprint',
    questions: [
      {
        id: 'q-related',
        title: '学生信息管理表在当前应用中未找到，请确认该表是否已存在。',
        required: true,
        options: [
          { value: 'existing', label: '更换已有表单' },
          { value: 'none', label: '不要关联' },
        ],
      },
      {
        id: 'q-flow',
        title: '请假后是否需要审批？',
        required: true,
      },
      {
        id: 'q-answered',
        title: '学生信息管理表使用哪个显示字段？',
        required: true,
        confirmed: true,
        selectedOptionValue: '姓名',
      },
    ],
  }
  const downgraded = downgradeNocodeEditorBlueprintResolvedSourceQuestions(
    confirmation,
    [{ tableName: '学生信息管理表', fields: [{ name: '姓名' }] }],
    [],
  )
  assert.ok(downgraded)
  const related = downgraded!.questions.find(question => question.id === 'q-related')
  assert.ok(related)
  assert.equal(related.questionKind, 'note_only')
  assert.equal(related.required, false)
  assert.equal(related.options, undefined)
  assert.equal(related.uncertainty?.category, 'safe_default')
  assert.equal(related.uncertainty?.reasonCode, 'related_form_auto_created')
  assert.match(related.title, /学生信息管理表/)
  const flow = downgraded!.questions.find(question => question.id === 'q-flow')
  assert.equal(flow?.questionKind, undefined)
  assert.equal(flow?.required, true)
  const answered = downgraded!.questions.find(question => question.id === 'q-answered')
  assert.equal(answered?.questionKind, undefined)
  assert.equal(answered?.selectedOptionValue, '姓名')
}

// decisionTarget 命中的字段来源问题同样降级（问题文案不含表名时也能归属）。
{
  const confirmation = {
    stage: 'blueprint',
    questions: [{
      id: 'q-source',
      title: '请确认字段来自哪张表',
      required: true,
      decisionTarget: {
        kind: 'field-source',
        formKey: 'form-leave',
        fieldKey: 'f-student',
        fieldName: '学生',
      },
    }],
  } as NocodeEditorAiConfirmPayload
  const downgraded = downgradeNocodeEditorBlueprintResolvedSourceQuestions(
    confirmation,
    [{ tableName: '学生信息管理表', fields: [{ name: '姓名' }] }],
    [{
      ownerFormKey: 'form-leave',
      ownerFormName: '学生请假申请表',
      ownerFieldKey: 'f-student',
      ownerFieldName: '学生',
    }],
  )
  assert.equal(downgraded?.questions[0].questionKind, 'note_only')
  assert.equal(downgraded?.questions[0].required, false)
}

console.log('blueprint-source-target-completion: ok')
