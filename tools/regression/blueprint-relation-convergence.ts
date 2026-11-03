import assert from 'node:assert/strict'

import type { NocodeEditorAiConfirmPayload } from '../../src/common/types/nocodeEditorConfirmation'
import {
  resolveConfirmedRelationFieldDecision,
  resolveNocodeEditorBlueprintPlanningCarryover,
  type NocodeEditorBlueprintPlanningCarryover,
} from '../../src/renderer/views/nocode/views/editor/ai/nocodeEditorBlueprintPlanningCarryover'
import { inferBlueprintFieldIntent } from '../../src/renderer/views/nocode/views/editor/ai/blueprintFieldIntent'
import { downgradeBlueprintConfirmationResolvedSourceQuestions } from '../../src/renderer/views/nocode/views/editor/ai/blueprintConfirmationDecisionOverride'
import {
  applyPlanningRelationBindings,
  completePartialBlueprintSources,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintPlanningRelationBindings'
import { completeNocodeEditorBlueprintSourceTargets } from '../../src/common/utils/nocodeEditorBlueprintSourceTargets'
import type { NocodeEditorAiAppBlueprint } from '../../src/renderer/views/nocode/views/editor/ai/types'

const buildCarryover = (
  questions: NocodeEditorAiConfirmPayload['questions'],
  stage: NocodeEditorAiConfirmPayload['stage'] = 'app-plan',
): NocodeEditorBlueprintPlanningCarryover => resolveNocodeEditorBlueprintPlanningCarryover({
  stage,
  status: 'completed',
  questions,
})

const infer = (overrides: Record<string, unknown>, carryover?: NocodeEditorBlueprintPlanningCarryover) => (
  inferBlueprintFieldIntent({
    formName: '费用报销申请',
    fieldName: '费用项目',
    hasSource: false,
    canResolveRelationSource: false,
    hasChildren: false,
    enumOptionsCount: 0,
    planningCarryover: carryover,
    ...overrides,
  } as Parameters<typeof inferBlueprintFieldIntent>[0])
)

// 1. 全局“不需要关联”产出表单级默认提示。
const globalNegative = buildCarryover([{
  id: 'q-relation',
  title: '是否需要关联其他表单？',
  answerDetail: '不需要关联',
}])
assert.equal(globalNegative.fieldStrategyHints.length, 1)
assert.equal(globalNegative.fieldStrategyHints[0].scope, 'all-master-data')
assert.equal(globalNegative.fieldStrategyHints[0].relationDomain, '')

// 2. 命中全局默认的主数据字段不再逐字段追问。
const textDefault = infer({}, globalNegative)
assert.equal(textDefault.requiresClarification, false)
assert.equal(textDefault.widgetType, 'widget.form.textInput')
assert.ok(textDefault.matchedSignals.includes('planning-scope:all-master-data'))

// 3. 字段里有显式关联措辞时，全局默认不生效。
const explicitRelation = infer({
  fieldName: '客户',
  description: '从客户表选择',
}, globalNegative)
assert.equal(explicitRelation.requiresClarification, true)
assert.equal(explicitRelation.intent, 'ambiguous-relation')

// 4. 字段级“要关联”压过全局默认。
const fieldRelationCarryover = buildCarryover([{
  id: 'q-relation',
  title: '是否需要关联其他表单？',
  answerDetail: '不需要关联',
}, {
  id: 'q-fee',
  title: '费用项目需要关联哪个表单？',
  answerDetail: '关联项目管理表',
}])
assert.ok(resolveConfirmedRelationFieldDecision({
  carryover: fieldRelationCarryover,
  fieldName: '费用项目',
  formKey: 'form-expense',
  fieldKey: 'f-fee',
  formCount: 1,
  fieldNameOccurrenceCount: 1,
}))
const relationConfirmedField = infer({ relationConfirmed: true }, fieldRelationCarryover)
assert.equal(relationConfirmedField.requiresClarification, true)
assert.equal(relationConfirmedField.intent, 'ambiguous-relation')

// 5. 已答过来源的字段题降级为默认处理说明。
const blueprint: NocodeEditorAiAppBlueprint = {
  forms: [{
    formKey: 'form-expense',
    tableName: '费用报销申请',
    fields: [
      { fieldKey: 'f-fee', name: '费用项目' },
      { fieldKey: 'f-customer', name: '客户' },
    ],
  }],
}
const confirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  questions: [
    { id: 'q-fee', title: '费用项目需要关联哪个表单？', required: true },
    { id: 'q-customer', title: '客户需要关联哪个表单？', required: true },
    { id: 'q-flow', title: '报销后是否需要审批？', required: true },
    {
      id: 'q-answered',
      title: '费用项目使用哪个显示字段？',
      required: true,
      confirmed: true,
      selectedOptionValue: '名称',
    },
  ],
}
const downgraded = downgradeBlueprintConfirmationResolvedSourceQuestions({
  confirmation,
  forms: blueprint.forms,
  resolveFieldSourceDecision: (form, field) => {
    if (field.name === '费用项目') {
      return { title: '已按规划阶段的答复，按文本字段处理。', reasonCode: 'planning_text_first_default' }
    }
    if (field.name === '客户') {
      return { title: '已按规划阶段的答复，关联到“客户表”。', reasonCode: 'planning_relation_binding' }
    }
    return null
  },
})
assert.ok(downgraded)
const findQuestion = (id: string) => downgraded!.questions.find(question => question.id === id)
const downgradedFee = findQuestion('q-fee')
assert.equal(downgradedFee?.questionKind, 'note_only')
assert.equal(downgradedFee?.required, false)
assert.equal(downgradedFee?.uncertainty?.category, 'safe_default')
assert.equal(downgradedFee?.uncertainty?.reasonCode, 'planning_text_first_default')
assert.equal(findQuestion('q-customer')?.uncertainty?.reasonCode, 'planning_relation_binding')
assert.equal(findQuestion('q-flow')?.questionKind, undefined)
assert.equal(findQuestion('q-flow')?.required, true)
assert.equal(findQuestion('q-answered')?.questionKind, undefined)

// 6. 题面兜底必须命中更长的字段名：“项目”不能抢走“费用项目”。
const ambiguousBlueprint: NocodeEditorAiAppBlueprint = {
  forms: [{
    formKey: 'form-expense',
    tableName: '费用报销申请',
    fields: [
      { fieldKey: 'f-project', name: '项目' },
      { fieldKey: 'f-fee', name: '费用项目' },
    ],
  }],
}
const ambiguousDowngraded = downgradeBlueprintConfirmationResolvedSourceQuestions({
  confirmation: {
    stage: 'blueprint',
    questions: [{ id: 'q-ambiguous', title: '费用项目要关联哪个表单？', required: true }],
  },
  forms: ambiguousBlueprint.forms,
  resolveFieldSourceDecision: (form, field) => (
    field.name === '费用项目'
      ? { title: '已按规划阶段的答复，按文本字段处理。', reasonCode: 'planning_text_first_default' }
      : null
  ),
})
assert.equal(ambiguousDowngraded?.questions[0].questionKind, 'note_only')

// 8. 正向“关联 X 表”解析为关系绑定。
const positiveCarryover = buildCarryover([{
  id: 'q-relation',
  title: '是否需要关联其他表单？',
  answerDetail: '需要，关联项目管理表',
}])
assert.equal(positiveCarryover.relationBindings.length, 1)
assert.equal(positiveCarryover.relationBindings[0].tableName, '项目管理表')
assert.equal(positiveCarryover.relationBindings[0].relationDomain, 'project')

// 9. 多表答案各自生成绑定。
const multiCarryover = buildCarryover([{
  id: 'q-relation',
  title: '是否需要关联其他表单？',
  answerDetail: '需要，关联客户表和项目表',
}])
assert.deepEqual(
  multiCarryover.relationBindings.map(binding => [binding.tableName, binding.relationDomain]),
  [['客户表', 'customer'], ['项目表', 'project']],
)

// 10. 没有表后缀 / 泛称 / 带后续动词的答案。
const noSuffix = buildCarryover([{
  id: 'q-relation',
  title: '是否需要关联其他表单？',
  answerDetail: '需要，关联客户',
}])
assert.equal(noSuffix.relationBindings.length, 0)
const genericName = buildCarryover([{
  id: 'q-relation',
  title: '是否需要关联其他表单？',
  answerDetail: '需要关联其他表单',
}])
assert.equal(genericName.relationBindings.length, 0)
const trailingVerb = buildCarryover([{
  id: 'q-student',
  title: '学生信息管理表需要关联哪个字段？',
  answerDetail: '关联学生信息管理表来处理',
  decisionTarget: {
    kind: 'field-source',
    formKey: 'form-leave',
    fieldKey: 'f-student',
  },
}])
assert.equal(trailingVerb.relationBindings.length, 1)
assert.equal(trailingVerb.relationBindings[0].tableName, '学生信息管理表')
assert.equal(trailingVerb.relationBindings[0].targetFieldKey, 'f-student')

// 11. 部分 source 用绑定补全；无绑定时保持 unresolved。
const partialBlueprint: NocodeEditorAiAppBlueprint = {
  forms: [{
    formKey: 'form-expense',
    tableName: '费用报销申请',
    fields: [{
      fieldKey: 'f-fee',
      name: '费用项目',
      source: { formName: '项目管理表' },
    }],
  }],
}
assert.equal(
  completeNocodeEditorBlueprintSourceTargets({ forms: partialBlueprint.forms }).unresolved.length,
  1,
)
const completedFields = completePartialBlueprintSources(
  partialBlueprint,
  positiveCarryover.relationBindings.map(binding => ({ ...binding, displayFieldName: '项目名称' })),
)
assert.deepEqual(completedFields, ['费用报销申请.费用项目'])
assert.equal(partialBlueprint.forms[0].fields[0].source?.fieldName, '项目名称')
const completedTargets = completeNocodeEditorBlueprintSourceTargets({ forms: partialBlueprint.forms })
assert.equal(completedTargets.unresolved.length, 0)
assert.equal(completedTargets.synthesizedForms[0].tableName, '项目管理表')
assert.deepEqual(completedTargets.synthesizedForms[0].fields, [{ name: '项目名称' }])

// 12. 字段级 targetFieldKey 绑定优先于域名绑定；完整 source 不被覆盖。
const targetedCarryover = buildCarryover([{
  id: 'q-fee',
  title: '费用项目需要关联哪个表单？',
  answerDetail: '关联项目管理表',
  decisionTarget: {
    kind: 'field-source',
    formKey: 'form-expense',
    fieldKey: 'f-fee',
  },
}])
const bindingBlueprint: NocodeEditorAiAppBlueprint = {
  forms: [{
    formKey: 'form-expense',
    tableName: '费用报销申请',
    fields: [
      { fieldKey: 'f-fee', name: '费用项目' },
      { fieldKey: 'f-project', name: '项目', source: { formName: '项目台账', fieldName: '编号' } },
    ],
  }],
}
const bound = applyPlanningRelationBindings(
  bindingBlueprint,
  [
    { ...targetedCarryover.relationBindings[0], targetFieldKey: undefined, tableName: '项目总表' },
    ...targetedCarryover.relationBindings,
  ],
)
assert.deepEqual(bound.map(item => item.fieldLabel), ['费用报销申请.费用项目'])
assert.equal(bindingBlueprint.forms[0].fields[0].source?.formName, '项目管理表')
assert.deepEqual(bindingBlueprint.forms[0].fields[1].source, { formName: '项目台账', fieldName: '编号' })

// 13. 补 source 幂等：再跑一次不重复、不改写已有 source。
const reapplied = applyPlanningRelationBindings(bindingBlueprint, targetedCarryover.relationBindings)
assert.equal(reapplied.length, 0)
assert.deepEqual(bindingBlueprint.forms[0].fields[0].source, {
  formName: '项目管理表',
  fieldName: '费用项目',
})

// 14. 规划阶段的批量关联答复只补“字段名即关系”的字段，不能把主数据表自身的属性字段绑成来源。
const projectCarryover = buildCarryover([{
  id: 'form-plan-question-1eu8qk1',
  title: '是否需要关联其他表单（如项目、客户）作为报销对象？',
  answerDetail: '关联项目管理表',
}])
assert.equal(projectCarryover.relationBindings.length, 1)
assert.equal(projectCarryover.relationBindings[0].relationDomain, 'project')
assert.equal(projectCarryover.relationBindings[0].targetFieldKey, undefined)

const projectBlueprint: NocodeEditorAiAppBlueprint = {
  forms: [
    {
      formKey: 'reimbursement',
      tableName: '报销单',
      fields: [
        {
          fieldKey: 'relatedProject',
          name: '关联项目',
          source: {
            formKey: 'projectManagement',
            formName: '项目管理表',
            fieldKey: 'projectName',
            fieldName: '项目名称',
          },
        },
        { fieldKey: 'projectName', name: '项目名称' },
        { fieldKey: 'amount', name: '报销金额' },
      ],
    },
    {
      formKey: 'projectManagement',
      tableName: '项目管理表',
      fields: [
        { fieldKey: 'projectName', name: '项目名称' },
        { fieldKey: 'projectCode', name: '项目编号' },
        { fieldKey: 'projectStatus', name: '项目状态' },
        { fieldKey: 'projectManager', name: '项目负责人' },
        { fieldKey: 'projectDescription', name: '项目描述' },
      ],
    },
  ],
}
const projectBound = applyPlanningRelationBindings(projectBlueprint, projectCarryover.relationBindings)
assert.deepEqual(projectBound, [])
assert.equal(projectBlueprint.forms[0].fields[0].source?.fieldKey, 'projectName')
assert.equal(projectBlueprint.forms[0].fields[1].source, undefined)
assert.equal(projectBlueprint.forms[1].fields.some(field => Boolean(field.source)), false)

// 15. 字段名本身就是关系时，也不能指向字段所在表；换成别的表仍然可以绑定。
const selfTargetBlueprint: NocodeEditorAiAppBlueprint = {
  forms: [{
    formKey: 'projectManagement',
    tableName: '项目管理表',
    fields: [{ fieldKey: 'project', name: '项目' }],
  }],
}
assert.deepEqual(
  applyPlanningRelationBindings(selfTargetBlueprint, projectCarryover.relationBindings),
  [],
)
assert.equal(selfTargetBlueprint.forms[0].fields[0].source, undefined)

const externalTargetBlueprint: NocodeEditorAiAppBlueprint = {
  forms: [
    {
      formKey: 'projectManagement',
      tableName: '项目管理表',
      fields: [{ fieldKey: 'project', name: '项目' }],
    },
    {
      formKey: 'contract',
      tableName: '合同表',
      fields: [{ fieldKey: 'project', name: '项目' }],
    },
  ],
}
const ledgerBinding = [{ ...projectCarryover.relationBindings[0], tableName: '项目台账' }]
assert.deepEqual(
  applyPlanningRelationBindings(externalTargetBlueprint, ledgerBinding).map(item => item.fieldLabel),
  ['项目管理表.项目', '合同表.项目'],
)
assert.equal(externalTargetBlueprint.forms[0].fields[0].source?.formName, '项目台账')

console.log('blueprint-relation-convergence: ok')
