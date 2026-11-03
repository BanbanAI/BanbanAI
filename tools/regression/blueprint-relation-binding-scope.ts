import assert from 'node:assert/strict'

import type { NocodeEditorAiConfirmPayload } from '../../src/common/types/nocodeEditorConfirmation'
import {
  mergeNocodeEditorBlueprintPlanningCarryovers,
  resolveNocodeEditorBlueprintPlanningCarryover,
} from '../../src/renderer/views/nocode/views/editor/ai/nocodeEditorBlueprintPlanningCarryover'
import {
  applyPlanningRelationBindings,
  stripSelfReferentialBlueprintSources,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintPlanningRelationBindings'
import { isSameNocodeEditorBlueprintFormName } from '../../src/common/utils/nocodeEditorBlueprintFormNormalization'
import type { NocodeEditorAiAppBlueprint } from '../../src/renderer/views/nocode/views/editor/ai/types'

// 现场答复：单表规划卡里的“学生信息（姓名、学号、班级）是手填还是需要从其他表关联？”
const studentPlanConfirmation: NocodeEditorAiConfirmPayload = {
  stage: 'form-plan',
  status: 'completed',
  questions: [{
    id: 'form-plan-question-c6ilvm',
    title: '学生信息（姓名、学号、班级）是手填还是需要从其他表关联？当前应用没有学生表，默认按手填处理，后续可升级为关联字段。',
    answerDetail: '关联学生信息表',
  }],
}

const buildBlueprint = (): NocodeEditorAiAppBlueprint => ({
  forms: [
    {
      formKey: 'student_info',
      tableName: '学生信息',
      fields: [
        { fieldKey: 'name', name: '姓名' },
        { fieldKey: 'studentNo', name: '学号' },
        { fieldKey: 'class', name: '班级' },
        { fieldKey: 'phone', name: '联系电话' },
      ],
    },
    {
      formKey: 'student_leave',
      tableName: '学生请假申请表',
      fields: [
        {
          fieldKey: 'studentName',
          name: '学生姓名',
          source: { formKey: 'student_info', formName: '学生信息', fieldKey: 'name', fieldName: '姓名' },
        },
        {
          fieldKey: 'studentNo',
          name: '学号',
          source: { formKey: 'student_info', formName: '学生信息', fieldKey: 'studentNo', fieldName: '学号' },
        },
        {
          fieldKey: 'class',
          name: '班级',
          source: { formKey: 'student_info', formName: '学生信息', fieldKey: 'class', fieldName: '班级' },
        },
        { fieldKey: 'leaveType', name: '请假类型' },
      ],
    },
  ],
})

// 1. 单表规划的关联答复只覆盖作答的那张表：学生信息.班级 不能被补成“取自学生信息表”。
const scopedCarryover = resolveNocodeEditorBlueprintPlanningCarryover(studentPlanConfirmation, {
  ownerForm: { formKey: 'student_leave', formName: '学生请假申请表' },
})
assert.equal(scopedCarryover.relationBindings.length, 1)
assert.equal(scopedCarryover.relationBindings[0].tableName, '学生信息表')
assert.equal(scopedCarryover.relationBindings[0].relationDomain, 'class')
assert.equal(scopedCarryover.relationBindings[0].ownerFormName, '学生请假申请表')

const scopedBlueprint = buildBlueprint()
assert.deepEqual(applyPlanningRelationBindings(scopedBlueprint, scopedCarryover.relationBindings), [])
assert.equal(scopedBlueprint.forms[0].fields[2].source, undefined)
assert.equal(scopedBlueprint.forms[1].fields[2].source?.formKey, 'student_info')

// 2. 作答表单里的同名字段没有来源时，仍按答复补关联；其他表单不受影响。
const ownerBlueprint = buildBlueprint()
ownerBlueprint.forms[1].fields[2].source = undefined
const ownerApplied = applyPlanningRelationBindings(ownerBlueprint, scopedCarryover.relationBindings)
assert.deepEqual(ownerApplied.map(item => item.fieldLabel), ['学生请假申请表.班级'])
assert.equal(ownerBlueprint.forms[0].fields[2].source, undefined)
assert.equal(ownerBlueprint.forms[1].fields[2].source?.formName, '学生信息表')

// 3. 指向真正外部表（班级表）时同样只落到作答表单。
const externalBindings = [{ ...scopedCarryover.relationBindings[0], tableName: '班级表' }]
const externalBlueprint = buildBlueprint()
externalBlueprint.forms[1].fields[2].source = undefined
assert.deepEqual(
  applyPlanningRelationBindings(externalBlueprint, externalBindings).map(item => item.fieldLabel),
  ['学生请假申请表.班级'],
)
assert.equal(externalBlueprint.forms[0].fields[2].source, undefined)

// 4. 应用级规划（app-plan）保持旧行为：答复作用于全部表单，但自表仍然不绑。
// 题面与现场同题（含“班级”，才能抽出 class 域），只是阶段换成 app-plan。
const globalCarryover = resolveNocodeEditorBlueprintPlanningCarryover({
  stage: 'app-plan',
  status: 'completed',
  questions: [{
    id: 'app-plan-question-c6ilvm',
    title: studentPlanConfirmation.questions[0].title,
    answerDetail: '关联学生信息表',
  }],
}, {
  ownerForm: { formKey: 'student_leave', formName: '学生请假申请表' },
})
assert.equal(globalCarryover.relationBindings[0].ownerFormName, undefined)
const globalBlueprint = buildBlueprint()
globalBlueprint.forms[0].fields[2].source = undefined
globalBlueprint.forms[1].fields[2].source = undefined
assert.deepEqual(
  applyPlanningRelationBindings(globalBlueprint, globalCarryover.relationBindings).map(item => item.fieldLabel),
  ['学生请假申请表.班级'],
)
assert.equal(globalBlueprint.forms[0].fields[2].source, undefined)

// 5. 字段级确认自带表单身份：没有 ownerForm 也只覆盖 decisionTarget 指向的表单。
const fieldTargetCarryover = resolveNocodeEditorBlueprintPlanningCarryover({
  stage: 'blueprint',
  status: 'completed',
  questions: [{
    id: 'q-class',
    title: '班级需要关联哪个表单？',
    answerDetail: '关联学生信息表',
    decisionTarget: { kind: 'field-source', formKey: 'student_leave', fieldKey: 'class' },
  }],
})
assert.equal(fieldTargetCarryover.relationBindings[0].ownerFormKey, 'student_leave')
const fieldTargetBlueprint = buildBlueprint()
fieldTargetBlueprint.forms[1].fields[2].source = undefined
assert.deepEqual(
  applyPlanningRelationBindings(fieldTargetBlueprint, fieldTargetCarryover.relationBindings)
    .map(item => item.fieldLabel),
  ['学生请假申请表.班级'],
)
assert.equal(fieldTargetBlueprint.forms[0].fields[2].source, undefined)

// 6. “取自本表”的脏来源要剥掉；指向其他表的来源保留；重复执行幂等。
const dirtyBlueprint = buildBlueprint()
dirtyBlueprint.forms[0].fields[2].source = { formName: '学生信息表', fieldName: '班级' }
assert.deepEqual(stripSelfReferentialBlueprintSources(dirtyBlueprint), ['学生信息.班级'])
assert.equal(dirtyBlueprint.forms[0].fields[2].source, undefined)
assert.equal(dirtyBlueprint.forms[1].fields[2].source?.formName, '学生信息')
assert.deepEqual(stripSelfReferentialBlueprintSources(dirtyBlueprint), [])

// 7. 同一张表的身份：只允许“长名逐层剥后缀等于短名”。
assert.equal(isSameNocodeEditorBlueprintFormName('学生信息', '学生信息表'), true)
assert.equal(isSameNocodeEditorBlueprintFormName('学生信息表', '学生信息'), true)
assert.equal(isSameNocodeEditorBlueprintFormName('项目管理表', '项目管理'), true)
assert.equal(isSameNocodeEditorBlueprintFormName('项目管理表', '项目台账'), false)
assert.equal(isSameNocodeEditorBlueprintFormName('项目台账', '项目管理表'), false)
assert.equal(isSameNocodeEditorBlueprintFormName('学生信息', '合同表'), false)
assert.equal(isSameNocodeEditorBlueprintFormName('项目', '项目管理表'), true)
assert.equal(isSameNocodeEditorBlueprintFormName('学生', '学生信息'), true)
assert.equal(isSameNocodeEditorBlueprintFormName('', '学生信息'), false)

// 8. 蓝图阶段会原样回填同一道题：回填副本也要带上作答表单，合并时 owner 优先、与顺序无关。
const blueprintEchoConfirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'completed',
  questions: [{
    id: 'form-plan-question-c6ilvm',
    decisionKey: 'student_info_source',
    title: '学生信息（姓名、学号、班级）是手填还是需要从其他表关联？当前应用没有学生表，默认按手填处理，后续可升级为关联字段。',
    answerDetail: '关联学生信息表',
    confirmed: true,
  }],
}
const legacyEchoCarryover = resolveNocodeEditorBlueprintPlanningCarryover(blueprintEchoConfirmation)
assert.equal(legacyEchoCarryover.relationBindings.length, 1)
assert.equal(legacyEchoCarryover.relationBindings[0].ownerFormName, undefined)

// 运行时会把这个副本也解析成“作答：学生请假申请表”。
const scopedEchoCarryover = resolveNocodeEditorBlueprintPlanningCarryover(blueprintEchoConfirmation, {
  ownerForm: { formKey: 'student_leave', formName: '学生请假申请表' },
})
assert.equal(scopedEchoCarryover.relationBindings[0].ownerFormName, '学生请假申请表')

// 兜底：副本没带 owner 时，合并结果仍以带 owner 的那条为准，且与合并顺序无关。
const mergedEchoFirst = mergeNocodeEditorBlueprintPlanningCarryovers(
  legacyEchoCarryover,
  scopedCarryover,
)
assert.equal(mergedEchoFirst.relationBindings.length, 1)
assert.equal(mergedEchoFirst.relationBindings[0].ownerFormName, '学生请假申请表')
const mergedOwnerFirst = mergeNocodeEditorBlueprintPlanningCarryovers(
  scopedCarryover,
  legacyEchoCarryover,
)
assert.equal(mergedOwnerFirst.relationBindings.length, 1)
assert.equal(mergedOwnerFirst.relationBindings[0].ownerFormName, '学生请假申请表')

// 合并后的绑定同样不会落到别的表单上。
const mergedBlueprint = buildBlueprint()
assert.deepEqual(applyPlanningRelationBindings(mergedBlueprint, mergedEchoFirst.relationBindings), [])
assert.equal(mergedBlueprint.forms[0].fields[2].source, undefined)

console.log('blueprint-relation-binding-scope: ok')
