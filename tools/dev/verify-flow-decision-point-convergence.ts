import assert from 'node:assert/strict'
import {
  normalizeNocodeEditorFlowScheme,
  type NocodeEditorFlowScheme,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  validateRawFlowPersonnelRequirementShapes,
} from '@common/utils/nocodeEditorFlowPersonnel'
import {
  buildFlowDecisionStepLookup,
  resolveFlowDependencyDecisionPointRef,
  validateFlowPersonnelQuestionContracts,
} from '@common/utils/nocodeEditorFlowDecisionIdentity'
import {
  buildUnifiedFlowIssuesFromFlowScheme,
  normalizeUnifiedFlowIssues,
} from '@common/utils/nocodeEditorFlowUnifiedIssue'
import {
  projectFlowIssueRouteToLegacyFields,
  routeUnifiedFlowIssues,
} from '@common/utils/nocodeEditorFlowIssueRouter'
import {
  assessAndDecorateFlowSchemePersonnelDependencies,
} from '@renderer/views/nocode/views/editor/ai/flowPersonnelDependencyAssessment'

type UnknownRecord = Record<string, unknown>

const levelQuestion = (overrides: UnknownRecord = {}) => ({
  id: 'q_dept_level',
  decisionKey: 'dept_manager_level',
  title: '部门主管审批的部门主管层级尚未确定',
  questionKind: 'single_select',
  options: [
    { value: 'up_1', label: '向上1级' },
    { value: 'up_2', label: '向上2级' },
    { value: 'down_1', label: '向下1级' },
  ],
  decisionScope: { kind: 'step', id: 'step_dept_manager' },
  producesFacts: ['dept_manager_config'],
  ...overrides,
})

const buildRawScheme = (input: {
  personnelRequirement?: UnknownRecord
  includeQuestion?: boolean
  question?: UnknownRecord
} = {}): UnknownRecord => ({
  title: '报销申请审批流程',
  summary: '员工提交报销申请后由部门主管审批',
  trigger: { type: 'submit', description: '员工提交报销申请时触发' },
  mainPath: [
    {
      key: 'step_submit',
      kind: 'add-data',
      title: '提交报销申请',
      intent: '员工填写并提交报销单',
    },
    {
      key: 'step_dept_manager',
      kind: 'approval',
      title: '部门主管审批',
      intent: '由部门主管审批报销申请',
      ...(input.personnelRequirement
        ? { personnelRequirement: input.personnelRequirement }
        : {}),
    },
  ],
  branches: [],
  confirmedFacts: [],
  assumptions: [],
  openQuestions: input.includeQuestion === false
    ? []
    : [{
      key: 'dept_manager_level',
      title: '部门主管层级',
      reason: '需要确认取哪一级部门主管',
      scopeKind: 'step',
      scopeKey: 'step_dept_manager',
    }],
  dependencies: [],
  confirmation: input.includeQuestion === false
    ? null
    : {
      stage: 'flow-scheme',
      status: 'pending',
      questions: [levelQuestion(input.question)],
    },
})

const normalizeScheme = (raw: UnknownRecord): NocodeEditorFlowScheme => {
  const scheme = normalizeNocodeEditorFlowScheme(raw)
  assert.ok(scheme, 'fixture scheme should normalize')
  return scheme
}

const findDependency = (
  scheme: NocodeEditorFlowScheme,
  id: string,
) => (scheme.dependencies || []).find(dependency => dependency.id === id)

const run = () => {
  const assertions: string[] = []
  const check = (name: string, fn: () => void) => {
    fn()
    assertions.push(name)
  }

  check('顶层 mode/level 被原始结构校验拦截', () => {
    const diagnostics = validateRawFlowPersonnelRequirementShapes(buildRawScheme({
      personnelRequirement: {
        sourceType: 'department_manager',
        mode: 'up',
        level: 1,
      },
    }))
    assert.equal(diagnostics.length, 1)
    assert.equal(diagnostics[0].code, 'personnel_department_manager_shape_invalid')
    assert.equal(diagnostics[0].stepKey, 'step_dept_manager')
    assert.equal(diagnostics[0].path, 'mainPath[1].personnelRequirement.departmentManager')
  })

  check('嵌套 departmentManager 通过原始结构校验', () => {
    const diagnostics = validateRawFlowPersonnelRequirementShapes(buildRawScheme({
      personnelRequirement: {
        sourceType: 'department_manager',
        departmentManager: { mode: 'up', level: 1 },
      },
    }))
    assert.deepEqual(diagnostics, [])
  })

  check('顶层 mode/level 与嵌套 departmentManager 并存被判冲突', () => {
    const diagnostics = validateRawFlowPersonnelRequirementShapes(buildRawScheme({
      personnelRequirement: {
        sourceType: 'department_manager',
        mode: 'up',
        level: 1,
        departmentManager: { mode: 'down', level: 2 },
      },
    }))
    assert.equal(diagnostics.length, 1)
    assert.equal(diagnostics[0].code, 'personnel_department_manager_shape_invalid')
    assert.equal(diagnostics[0].path, 'mainPath[1].personnelRequirement')
  })

  check('表单人员字段写在顶层会被拦截', () => {
    const diagnostics = validateRawFlowPersonnelRequirementShapes(buildRawScheme({
      personnelRequirement: {
        sourceType: 'form_member',
        fieldId: 'field_owner',
        expectedType: 'memberSelect',
      },
    }))
    assert.equal(diagnostics.length, 1)
    assert.equal(diagnostics[0].code, 'personnel_field_ref_shape_invalid')
  })

  const rawLevelMissingScheme = buildRawScheme({
    personnelRequirement: { sourceType: 'department_manager' },
  })

  check('人员确认题缺少 personnelDecision 触发契约错误', () => {
    const scheme = normalizeScheme(rawLevelMissingScheme)
    const diagnostics = validateFlowPersonnelQuestionContracts(scheme)
    assert.equal(diagnostics.length, 1)
    assert.equal(diagnostics[0].code, 'personnel_decision_missing')
    assert.equal(diagnostics[0].questionId, 'q_dept_level')
    assert.equal(diagnostics[0].stepKey, 'step_dept_manager')
    assert.equal(diagnostics[0].slot, 'approval_level')
  })

  check('人员确认题补齐 personnelDecision 后通过契约校验', () => {
    const scheme = normalizeScheme(buildRawScheme({
      personnelRequirement: { sourceType: 'department_manager' },
      question: {
        personnelDecision: { stepKey: 'step_dept_manager', slot: 'approval_level' },
      },
    }))
    assert.deepEqual(scheme.confirmation?.questions[0]?.personnelDecision, {
      stepKey: 'step_dept_manager',
      slot: 'approval_level',
    })
    assert.deepEqual(validateFlowPersonnelQuestionContracts(scheme), [])
  })

  let levelDependencyScheme: NocodeEditorFlowScheme
  check('层级依赖带上 personnelDecision 与稳定 decisionKey', () => {
    levelDependencyScheme = assessAndDecorateFlowSchemePersonnelDependencies({
      scheme: normalizeScheme(rawLevelMissingScheme),
    })
    const dependency = findDependency(levelDependencyScheme, 'flow-personnel:step_dept_manager:level')
    assert.ok(dependency, 'level dependency should be generated')
    assert.deepEqual(dependency.personnelDecision, {
      stepKey: 'step_dept_manager',
      slot: 'approval_level',
    })
    assert.equal(dependency.decisionKey, 'flow.personnel:step_dept_manager:approval_level')
  })

  check('层级题与层级依赖收敛为一张交互卡片', () => {
    const scheme = normalizeScheme(rawLevelMissingScheme)
    const assessed = assessAndDecorateFlowSchemePersonnelDependencies({ scheme })
    const issues = buildUnifiedFlowIssuesFromFlowScheme({ scheme: assessed })
    assert.equal(issues.length, 1, `expected one merged issue, got ${issues.length}: ${issues.map(issue => issue.issueId).join(', ')}`)
    const [issue] = issues
    assert.equal(issue.decisionPointKey, 'flow.personnel:step_dept_manager:approval_level')
    assert.equal(issue.severity, 'blocking')
    assert.equal(issue.questionPayload?.questionKind, 'single_select')
    assert.deepEqual(
      issue.questionPayload?.options?.map(option => option.value),
      ['up_1', 'up_2', 'down_1'],
    )
    assert.ok(
      issue.diagnostics?.some(diagnostic => diagnostic.code === 'org_anchor_missing'),
      'dependency diagnostic should be merged into the card',
    )
  })

  check('投影到确认卡片后只保留一张层级题', () => {
    const scheme = normalizeScheme(rawLevelMissingScheme)
    const assessed = assessAndDecorateFlowSchemePersonnelDependencies({ scheme })
    const issues = buildUnifiedFlowIssuesFromFlowScheme({ scheme: assessed })
    const projection = projectFlowIssueRouteToLegacyFields({
      issues,
      routing: routeUnifiedFlowIssues(issues),
      stage: 'flow-scheme',
    })
    assert.equal(projection.confirmation?.questions.length, 1)
    const [question] = projection.confirmation!.questions
    assert.equal(question.questionKind, 'single_select')
    assert.deepEqual(question.options?.map(option => option.value), ['up_1', 'up_2', 'down_1'])
    assert.equal(projection.openQuestions.length, 1)
  })

  check('审批来源依赖与来源题共享同一决策点', () => {
    const scheme = normalizeScheme(buildRawScheme({ includeQuestion: false }))
    const assessed = assessAndDecorateFlowSchemePersonnelDependencies({ scheme })
    const issues = buildUnifiedFlowIssuesFromFlowScheme({ scheme: assessed })
    const sourceIssue = issues.find(issue => issue.issueId === 'flow-personnel:step_dept_manager:source')
    assert.ok(sourceIssue, 'source dependency issue should exist')
    assert.equal(sourceIssue.decisionPointKey, 'flow.approval.owner.source:step_dept_manager')
    assert.equal(sourceIssue.questionPayload?.personnelDecision?.slot, 'source')
  })

  check('确认题缺少 decisionScope 时按 openQuestion 的步骤作用域收敛', () => {
    const raw = buildRawScheme({
      personnelRequirement: { sourceType: 'department_manager' },
    })
    raw.confirmation = {
      stage: 'flow-scheme',
      status: 'pending',
      questions: [levelQuestion({ decisionScope: undefined })],
    }
    const scheme = normalizeScheme(raw)
    // 缺 scope 时按 openQuestion 的步骤作用域补全，而不是把 scope 留在缺失态。
    assert.equal(scheme.confirmation?.questions[0]?.decisionScope?.kind, 'step')
    assert.equal(scheme.confirmation?.questions[0]?.decisionScope?.id, 'step_dept_manager')
    assert.equal(validateFlowPersonnelQuestionContracts(scheme).length, 1)
    const assessed = assessAndDecorateFlowSchemePersonnelDependencies({ scheme })
    const issues = buildUnifiedFlowIssuesFromFlowScheme({ scheme: assessed })
    assert.equal(issues.length, 1)
    assert.equal(issues[0].decisionPointKey, 'flow.personnel:step_dept_manager:approval_level')
  })

  check('依赖决策键只声明槽位时按依赖步骤作用域补全人员身份', () => {
    const scheme = normalizeScheme(buildRawScheme({ includeQuestion: false }))
    const steps = buildFlowDecisionStepLookup(scheme)
    const ref = resolveFlowDependencyDecisionPointRef({
      id: 'legacy-approval-owner',
      decisionKey: 'flow.approval.owner',
      kind: 'org_anchor_missing',
      requiredFor: 'approval_owner',
      scopeKind: 'step',
      scopeKey: 'step_dept_manager',
      riskLevel: 'high',
      resolutionStatus: 'unresolved',
      materializationStatus: 'not_available',
      summary: '审批人来源尚未确定',
    }, steps)
    assert.ok(ref)
    assert.equal(ref.key, 'flow.approval.owner.source:step_dept_manager')
    assert.equal(ref.kind, 'personnel')
  })

  check('非审批节点的来源依赖也生成交互式来源题', () => {
    const raw = buildRawScheme({ includeQuestion: false })
    raw.mainPath = [
      ...(raw.mainPath as UnknownRecord[]),
      {
        key: 'step_handle',
        kind: 'transact',
        title: '财务办理',
        intent: '由财务人员办理报销',
      },
    ]
    const scheme = normalizeScheme(raw)
    const assessed = assessAndDecorateFlowSchemePersonnelDependencies({ scheme })
    const issues = buildUnifiedFlowIssuesFromFlowScheme({ scheme: assessed })
    const sourceIssue = issues.find(issue => (
      issue.decisionPointKey === 'flow.personnel:step_handle:source'
    ))
    assert.ok(sourceIssue, 'transact source issue should exist')
    assert.equal(sourceIssue.questionPayload?.questionKind, 'single_select')
    assert.equal(sourceIssue.questionPayload?.personnelDecision?.stepKey, 'step_handle')
  })

  check('同一决策点的重复问题只保留一次', () => {
    const scheme = normalizeScheme(buildRawScheme({
      personnelRequirement: { sourceType: 'department_manager' },
    }))
    const assessed = assessAndDecorateFlowSchemePersonnelDependencies({ scheme })
    assessed.confirmation!.questions = [
      ...assessed.confirmation!.questions,
      levelQuestion({
        id: 'q_dept_level_duplicate',
        decisionKey: 'dept_manager_level_duplicate',
        title: '部门主管层级（重复）',
        personnelDecision: { stepKey: 'step_dept_manager', slot: 'approval_level' },
      }),
    ] as typeof assessed.confirmation.questions
    const issues = buildUnifiedFlowIssuesFromFlowScheme({ scheme: assessed })
    const levelIssues = issues.filter(issue => (
      issue.decisionPointKey === 'flow.personnel:step_dept_manager:approval_level'
    ))
    assert.equal(levelIssues.length, 1)
  })

  check('已持久化的旧版重复问题在加载时按决策点合并', () => {
    const merged = normalizeUnifiedFlowIssues([
      {
        issueId: 'dept_manager_level',
        sourceStage: 'flow-scheme',
        category: 'business_gap',
        severity: 'blocking',
        userActionRequired: true,
        userMessage: '部门主管层级',
        questionPayload: levelQuestion(),
        diagnostics: [{ code: 'dept_manager_level', message: '部门主管层级', kind: 'open_question' }],
      },
      {
        issueId: 'flow-personnel:step_dept_manager:level',
        sourceStage: 'flow-scheme',
        category: 'config_gap',
        severity: 'blocking',
        userActionRequired: true,
        userMessage: '部门主管审批的部门主管层级尚未确定',
        questionPayload: {
          id: 'flow-personnel:step_dept_manager:level',
          title: '部门主管审批的部门主管层级尚未确定',
          questionKind: 'note_only',
          description: '请补充或确认：部门主管审批的部门主管层级尚未确定',
        },
        diagnostics: [{
          id: 'flow-personnel:step_dept_manager:level',
          code: 'org_anchor_missing',
          kind: 'org_anchor_missing',
          scopeKind: 'step',
          scopeKey: 'step_dept_manager',
          requiredFor: 'approval_owner',
          message: '部门主管审批的部门主管层级尚未确定',
        }],
      },
    ])
    assert.equal(merged.length, 1)
    assert.equal(merged[0].decisionPointKey, 'flow.personnel:step_dept_manager:approval_level')
    assert.equal(merged[0].questionPayload?.questionKind, 'single_select')
    assert.ok(merged[0].diagnostics?.some(diagnostic => diagnostic.code === 'org_anchor_missing'))
  })

  assertions.forEach(name => console.log(`PASS ${name}`))
  console.log(`\n${assertions.length} checks passed.`)
}

run()
