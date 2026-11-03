import assert from 'node:assert/strict'

import { validateNocodeEditorBlueprintReplaceScope } from '../../src/common/utils/nocodeEditorBlueprintInput'
import { isNocodeEditorPlanningFormArtifact } from '../../src/common/utils/nocodeEditorAppBuilderPlanningLabels'
import { buildNocodeEditorPlanningFallbackForms } from '../../src/common/utils/nocodeEditorPlanningArtifactForms'
import { parseNocodeEditorAppBuilderPlanning } from '../../src/main/modules/ai/nocode-editor/nocode-editor-app-builder-planning.util'

;(global as Record<string, unknown>).i18next = {
  t: (key: string) => key,
}

const formNames = [
  '部门信息表',
  '岗位信息表',
  '员工档案表',
  '入职登记表',
  '转正申请表',
  '调岗申请表',
  '离职申请表',
]
const hrArtifacts = [
  ...formNames.map(name => ({ type: 'form', name, purpose: `${name}用途` })),
  { type: 'process', name: '入转调离审批流程', purpose: '入职、转正、调岗、离职的审批流程' },
]

// 7 个 form + 1 个 process：只有表单进入已规划身份，且 formKey 按表单顺序生成。
{
  const forms = buildNocodeEditorPlanningFallbackForms(hrArtifacts)
  assert.equal(forms.length, 7)
  assert.deepEqual(forms.map(form => form.formKey), formNames.map((_, index) => `artifact-${index + 1}`))
  assert.equal(forms.some(form => form.tableName.includes('审批流程')), false)
}

// 非表单类型（含 type 缺失/未知）都不补成表单；type 大小写不敏感。
{
  const mixed = [
    { type: 'form', name: '员工档案表' },
    { type: 'board', name: '招聘看板' },
    { type: 'page-view', name: '人事看板' },
    { type: 'formula', name: '工龄计算' },
    { type: 'field-group', name: '教育经历' },
    { type: 'process', name: '入转调离审批流程' },
    { name: '无类型产物' },
  ]
  assert.deepEqual(
    buildNocodeEditorPlanningFallbackForms(mixed).map(form => form.tableName),
    ['员工档案表'],
  )
  assert.equal(isNocodeEditorPlanningFormArtifact({ type: 'FORM' }), true)
  assert.equal(isNocodeEditorPlanningFormArtifact({ type: ' process ' }), false)
  assert.equal(isNocodeEditorPlanningFormArtifact({}), false)
  assert.equal(isNocodeEditorPlanningFormArtifact(null), false)
}

// 主进程文本兜底解析同口径：outline.forms 只含 7 张表，artifacts 仍保留 8 项。
{
  const parsed = parseNocodeEditorAppBuilderPlanning([
    '说明。',
    '',
    '```banban-app-builder-plan',
    'mode: greenfield',
    'goal: 搭建人事管理系统',
    'objects: [员工, 部门]',
    'artifacts:',
    ...formNames.flatMap(name => [
      '  - type: form',
      `    name: ${name}`,
      '    execution_level: executable_now',
    ]),
    '  - type: process',
    '    name: 入转调离审批流程',
    '    execution_level: need_confirm',
    'open_questions: []',
    '```',
  ].join('\n'))
  assert.equal(parsed.invalid, undefined)
  assert.equal(parsed.plan?.artifacts.length, 8)
  assert.deepEqual(
    parsed.plan?.outline.forms.map(form => form.tableName),
    formNames,
  )
}

// 显式 outline.forms 已包含全部表单时，process 产物不会追加成第 8 张表。
{
  const parsed = parseNocodeEditorAppBuilderPlanning([
    '```banban-app-builder-plan',
    'mode: greenfield',
    'goal: 搭建人事管理系统',
    'objects: [员工, 部门]',
    'artifacts:',
    ...formNames.flatMap(name => [
      '  - type: form',
      `    name: ${name}`,
      '    execution_level: executable_now',
    ]),
    '  - type: process',
    '    name: 入转调离审批流程',
    '    execution_level: need_confirm',
    'open_questions: []',
    'outline:',
    '  forms:',
    ...formNames.map(name => `    - tableName: ${name}`),
    '```',
  ].join('\n'))
  assert.equal(parsed.plan?.outline.forms.length, 7)
}

// 用户可见效果：7 张表的 replace 蓝图可通过范围校验；把 process 当已规划表单时会失败。
{
  const plannedForms = buildNocodeEditorPlanningFallbackForms(hrArtifacts)
  const proposedForms = formNames.map(name => ({ tableName: name }))
  const okValidation = validateNocodeEditorBlueprintReplaceScope({
    updateMode: 'replace',
    plannedForms,
    proposedForms,
    hasCurrentBlueprint: false,
  })
  assert.equal(okValidation.ok, true)

  const failedValidation = validateNocodeEditorBlueprintReplaceScope({
    updateMode: 'replace',
    plannedForms: [...plannedForms, { formKey: 'artifact-8', tableName: '入转调离审批流程' }],
    proposedForms,
    hasCurrentBlueprint: false,
  })
  assert.equal(failedValidation.ok, false)
}

console.log('planning-artifact-form-identity: ok')
