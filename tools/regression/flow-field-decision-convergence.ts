import assert from 'node:assert/strict'

import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import {
  normalizeNocodeEditorFlowScheme,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import {
  buildFlowSchemeDependencyFromGroundingDiagnostic,
  type NocodeEditorFlowSchemeGroundingDiagnostic,
} from '../../src/common/utils/nocodeEditorFlowSchemeGrounding'
import {
  convergeNocodeEditorFlowFieldDecisions,
} from '../../src/common/utils/nocodeEditorFlowFieldDecisionConvergence'
import {
  parseFlowGroundingFieldOptionDecision,
} from '../../src/common/utils/nocodeEditorFlowGroundingPresentation'
import type { NocodeEditorConfirmationDecision } from '../../src/common/utils/nocodeEditorConfirmationDecisionProjection'
import type { NocodeEditorFlowPlan } from '../../src/common/utils/nocodeEditorFlowPlan'
import {
  convergeFlowPlanFieldDecisions,
} from '../../src/renderer/views/nocode/views/editor/form/flowFieldDecisionPlanRewrite'
import { RuleFunc } from '../../src/common/types/nocode'

const summary = {
  forms: {
    currentForm: {
      tableId: 'form-expense',
      tableName: '报销单',
      fields: [
        { fieldId: 'field-amount', fieldName: '报销金额', conditionPolicy: 'usable' },
        { fieldId: 'field-user', fieldName: '报销人', conditionPolicy: 'usable' },
        { fieldId: 'field-quantity', fieldName: '数量', conditionPolicy: 'usable' },
        { fieldId: 'field-dept', fieldName: '报销部门', conditionPolicy: 'forbidden' },
        {
          fieldId: 'group',
          fieldName: '明细',
          conditionPolicy: 'forbidden',
          subFields: [
            { fieldId: 'group.amount', fieldName: '明细.金额', conditionPolicy: 'usable' },
          ],
        },
      ],
    },
  },
}

const makeScheme = (
  overrides: Partial<NocodeEditorFlowScheme> = {},
): NocodeEditorFlowScheme => ({
  title: '报销流程',
  summary: '提交后按金额审批',
  target: { formId: 'form-expense', formName: '报销单' },
  trigger: { type: 'submit', description: '提交时触发' },
  mainPath: [{ key: 'step-approval', kind: 'approval', title: '审批', intent: '审批报销' }],
  branches: [{ key: 'branch-1', title: '金额较大', when: '金额大于1000', steps: [] }],
  confirmedFacts: [],
  assumptions: [],
  openQuestions: [],
  dependencies: [],
  ...overrides,
})

const makeDecision = (input: {
  selectedOptionValue: string
  decisionKey?: string
  questionId?: string
  decisionTarget?: NocodeEditorConfirmationDecision['decisionTarget']
}): NocodeEditorConfirmationDecision => ({
  questionId: input.questionId || 'flow-grounding-condition-field-missing:branch-1',
  questionTitle: '条件判断字段选择',
  decisionKey: input.decisionKey || 'flow.condition.field:branch-1',
  selectedOptionValue: input.selectedOptionValue,
  decisionTarget: input.decisionTarget,
  planningContextKey: 'ctx-expense',
})

const buildGroundingDependency = (
  diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic,
) => {
  const dependency = buildFlowSchemeDependencyFromGroundingDiagnostic(diagnostic)
  assert.ok(dependency)
  return dependency
}

const buildConditionDependency = (
  input: Partial<NocodeEditorFlowSchemeGroundingDiagnostic> = {},
) => buildGroundingDependency({
  code: 'grounding_condition_field_missing',
  fieldRef: { fieldId: 'missing-condition', fieldName: '缺失条件字段' },
  targetFormId: 'form-expense',
  targetFormName: '报销单',
  ...input,
})

const buildSourceDependency = (
  input: Partial<NocodeEditorFlowSchemeGroundingDiagnostic> = {},
) => buildGroundingDependency({
  code: 'grounding_source_field_missing',
  fieldRef: { fieldId: 'missing-source', fieldName: '缺失来源字段' },
  targetFormId: 'form-expense',
  targetFormName: '报销单',
  ...input,
})

const buildSourceTableDependency = (
  input: Partial<NocodeEditorFlowSchemeGroundingDiagnostic> = {},
) => buildGroundingDependency({
  code: 'grounding_source_table_missing',
  targetFormId: 'form-expense',
  targetFormName: '报销单',
  ...input,
})

const resolvedDependency = (input: {
  id: string
  capability: 'condition' | 'source'
  scopeKey: string
  fieldId: string
  fieldName: string
  scopeKind?: 'global' | 'step' | 'branch'
  branchKey?: string
}): NocodeEditorFlowSchemeDependency => ({
  id: input.id,
  decisionKey: `${input.capability === 'condition' ? 'flow.condition.field' : 'flow.source.field'}:${input.scopeKey}`,
  kind: 'field_missing',
  requiredFor: input.capability === 'condition' ? 'condition' : 'source_mapping',
  scopeKind: input.scopeKind || 'branch',
  scopeKey: input.scopeKey,
  ...(input.branchKey ? { branchKey: input.branchKey } : {}),
  riskLevel: 'high',
  resolutionStatus: 'resolved',
  resolutionMode: 'use_existing',
  materializationStatus: 'existing',
  fieldRef: { fieldId: input.fieldId, fieldName: input.fieldName },
  summary: '已改用现有字段',
})

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
)

const getPath = (value: unknown, path: Array<string | number>): unknown => (
  path.reduce<unknown>((current, key) => {
    if (Array.isArray(current)) {
      return typeof key === 'number' ? current[key] : undefined
    }
    return asRecord(current)[String(key)]
  }, value)
)

const firstCondition = (plan: NocodeEditorFlowPlan) => asRecord(
  getPath(plan, ['triggerBranches', 0, 'nodes', 0, 'options', 'finishCondition', 'conditions', 0])
    ?? getPath(plan, ['triggerBranches', 0, 'nodes', 0, 'options', 'conditions', 0])
    ?? getPath(plan, ['triggerBranches', 0, 'triggerNode', 'options', 'conditions', 0]),
)

// ---------------- P1a：依赖携带分支身份 ----------------

const branchConditionDependency = buildConditionDependency({
  nodeKey: 'node-a',
  branchKey: 'branch-1',
})
assert.equal(branchConditionDependency.scopeKey, 'node-a')
assert.equal(branchConditionDependency.branchKey, 'branch-1')

const branchSourceTableDependency = buildSourceTableDependency({ branchKey: 'branch-1' })
assert.equal(branchSourceTableDependency.scopeKey, 'branch-1')
assert.equal(branchSourceTableDependency.branchKey, 'branch-1')

const ownerDependency = buildGroundingDependency({
  code: 'grounding_owner_field_missing',
  branchKey: 'branch-1',
  ownerUsage: 'approval_owner',
  fieldRef: { fieldId: 'field-owner', fieldName: '审批人' },
})
assert.equal(ownerDependency.branchKey, undefined)

const normalizedScheme = normalizeNocodeEditorFlowScheme(makeScheme({
  dependencies: [branchConditionDependency],
}))
assert.ok(normalizedScheme)
assert.equal(normalizedScheme.dependencies?.[0]?.branchKey, 'branch-1')
assert.equal(normalizedScheme.dependencies?.[0]?.scopeKey, 'node-a')

// ---------------- 选项解析器 ----------------

assert.deepEqual(
  parseFlowGroundingFieldOptionDecision('use-existing-condition-field:field-user'),
  { capability: 'condition', fieldId: 'field-user' },
)
assert.deepEqual(
  parseFlowGroundingFieldOptionDecision('  use-existing-source-field:field-amount  '),
  { capability: 'source', fieldId: 'field-amount' },
)
assert.equal(parseFlowGroundingFieldOptionDecision('use-existing-condition-field:'), null)
assert.equal(parseFlowGroundingFieldOptionDecision('补充说明：报销总额'), null)
assert.equal(parseFlowGroundingFieldOptionDecision(undefined), null)

// ---------------- Phase A ----------------

// 1. 同一分支两条节点级条件依赖被一次分支决策同时命中。
const sameBranchScheme = makeScheme({
  dependencies: [
    buildConditionDependency({ nodeKey: 'node-a', branchKey: 'branch-1' }),
    buildConditionDependency({ nodeKey: 'node-b', branchKey: 'branch-1' }),
  ],
  openQuestions: [{
    key: 'flow.condition.field:branch-1',
    title: '条件判断字段选择',
    reason: '需要确认条件字段',
  }],
  confirmation: {
    stage: 'flow-scheme',
    status: 'pending',
    questions: [{
      id: 'flow-grounding-condition-field-missing:branch-1',
      decisionKey: 'flow.condition.field:branch-1',
      title: 'AI 规划的条件判断还缺少字段',
      questionKind: 'single_select',
      required: true,
      options: [{ value: 'choose-another-condition-field', label: '改用其他判断字段' }],
    }],
  },
})
const sameBranchDecision = makeDecision({
  selectedOptionValue: 'use-existing-condition-field:field-user',
  decisionTarget: { kind: 'field-source', fieldKey: 'missing-condition', fieldName: '缺失条件字段' },
})
const sameBranchResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: sameBranchScheme,
  flowSummary: summary,
  flowConfirmationDecisions: [sameBranchDecision],
})
assert.equal(sameBranchResult.applied.length, 1)
assert.equal(sameBranchResult.skipped.length, 0)
assert.equal(sameBranchResult.scheme.dependencies?.length, 2)
sameBranchResult.scheme.dependencies?.forEach((dependency) => {
  assert.equal(dependency.resolutionStatus, 'resolved')
  assert.equal(dependency.resolutionMode, 'use_existing')
  assert.equal(dependency.materializationStatus, 'existing')
  assert.equal(dependency.decisionKey, 'flow.condition.field:branch-1')
  assert.equal(dependency.fieldRef?.fieldId, 'field-user')
  assert.equal(dependency.branchKey, 'branch-1')
})
const closedQuestion = sameBranchResult.scheme.confirmation?.questions[0]
assert.equal(closedQuestion?.confirmed, true)
assert.equal(closedQuestion?.selectedOptionValue, 'use-existing-condition-field:field-user')
assert.equal(closedQuestion?.options?.some(option => option.value === 'use-existing-condition-field:field-user'), true)
assert.equal(sameBranchResult.scheme.openQuestions.length, 0)
assert.deepEqual(sameBranchResult.scheme.confirmedFacts, [
  'AI 规划原引用的条件字段“缺失条件字段”不可用，已确认改用现有字段“报销人”作为判断依据。',
])
assert.deepEqual(sameBranchResult.applied[0].closedQuestionIds, [
  'flow-grounding-condition-field-missing:branch-1',
])
assert.ok(sameBranchResult.consumedDecisionKeys.includes('flow.condition.field:branch-1'))
assert.ok(sameBranchResult.consumedDecisionKeys.includes('flow-grounding-condition-field-missing:branch-1'))

const repeatedResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: sameBranchResult.scheme,
  flowSummary: summary,
  flowConfirmationDecisions: [sameBranchDecision],
})
assert.equal(repeatedResult.scheme.dependencies?.length, 2)
assert.equal(repeatedResult.scheme.confirmedFacts.length, 1)

// 2. 旧决策键 + 全局依赖 → 规范 global 键。
const legacyScheme = makeScheme({
  dependencies: [buildConditionDependency()],
})
const legacyResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: legacyScheme,
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-amount',
    decisionKey: 'flow-grounding-condition-field-missing',
    questionId: 'flow-grounding-condition-field-missing',
  })],
})
assert.equal(legacyResult.applied.length, 1)
assert.equal(legacyResult.scheme.dependencies?.[0]?.decisionKey, 'flow.condition.field:global')
assert.equal(legacyResult.scheme.dependencies?.[0]?.resolutionStatus, 'resolved')

// 3 / 4. 字段不存在或不可用于条件：跳过且不改依赖。
const missingFieldResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: sameBranchScheme,
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-unknown',
  })],
})
assert.equal(missingFieldResult.applied.length, 0)
assert.equal(missingFieldResult.skipped[0]?.reason, 'field_not_found')
assert.deepEqual(missingFieldResult.scheme.dependencies, sameBranchScheme.dependencies)

const forbiddenFieldResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: sameBranchScheme,
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-dept',
  })],
})
assert.equal(forbiddenFieldResult.skipped[0]?.reason, 'field_not_usable_for_condition')
assert.deepEqual(forbiddenFieldResult.scheme.dependencies, sameBranchScheme.dependencies)

// 5. 同一决策改选另一个字段：依赖 id 与数量不变，最后一次选择生效。
const reselectionResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: sameBranchResult.scheme,
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-amount',
  })],
})
assert.equal(reselectionResult.scheme.dependencies?.length, 2)
assert.deepEqual(
  reselectionResult.scheme.dependencies?.map(item => item.id),
  sameBranchResult.scheme.dependencies?.map(item => item.id),
)
reselectionResult.scheme.dependencies?.forEach((dependency) => {
  assert.equal(dependency.fieldRef?.fieldId, 'field-amount')
})

// 6. 分支决策只命中同分支；全局决策只回退到唯一未解析候选，不覆盖已确认分支。
const twoBranchScheme = makeScheme({
  branches: [
    { key: 'branch-1', title: '金额较大', when: '金额大于1000', steps: [] },
    { key: 'branch-2', title: '金额较小', when: '金额不大于1000', steps: [] },
  ],
  dependencies: [
    buildConditionDependency({ branchKey: 'branch-1' }),
    buildConditionDependency({ branchKey: 'branch-2' }),
  ],
})
const branchOnlyResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: twoBranchScheme,
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-user',
    decisionKey: 'flow.condition.field:branch-1',
    questionId: 'flow-grounding-condition-field-missing:branch-1',
  })],
})
assert.equal(branchOnlyResult.scheme.dependencies?.[0]?.resolutionStatus, 'resolved')
assert.equal(branchOnlyResult.scheme.dependencies?.[1]?.resolutionStatus, 'unresolved')

const globalFallbackResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: branchOnlyResult.scheme,
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-amount',
    decisionKey: 'flow.condition.field:global',
    questionId: 'flow-grounding-condition-field-missing',
  })],
})
assert.equal(globalFallbackResult.scheme.dependencies?.[0]?.fieldRef?.fieldId, 'field-user')
assert.equal(globalFallbackResult.scheme.dependencies?.[1]?.fieldRef?.fieldId, 'field-amount')
assert.equal(globalFallbackResult.scheme.dependencies?.[1]?.decisionKey, 'flow.condition.field:global')
assert.equal(globalFallbackResult.scheme.dependencies?.length, 2)

const globalOverrideResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: globalFallbackResult.scheme,
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-quantity',
    decisionKey: 'flow.condition.field:global',
    questionId: 'flow-grounding-condition-field-missing',
  })],
})
assert.equal(globalOverrideResult.scheme.dependencies?.length, 2)
assert.equal(globalOverrideResult.scheme.dependencies?.[1]?.fieldRef?.fieldId, 'field-quantity')

// 6b. 已解析分支 + 全局决策且无未解析候选 → 追加全局依赖，不覆盖已确认分支。
const appendGlobalResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: sameBranchResult.scheme,
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-quantity',
    decisionKey: 'flow.condition.field:global',
    questionId: 'flow-grounding-condition-field-missing',
  })],
})
assert.equal(appendGlobalResult.scheme.dependencies?.length, 3)
assert.equal(appendGlobalResult.scheme.dependencies?.[2]?.id, 'flow-dependency:field-decision:condition:global')
assert.equal(appendGlobalResult.scheme.dependencies?.[2]?.scopeKind, 'global')
assert.equal(appendGlobalResult.scheme.dependencies?.[0]?.fieldRef?.fieldId, 'field-user')

// 6c. 无匹配依赖时按方案真实键归类 scopeKind。
const appendBranchResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: makeScheme(),
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-user',
    decisionKey: 'flow.condition.field:branch-1',
    questionId: 'flow-grounding-condition-field-missing:branch-1',
  })],
})
const appendedBranchDependency = appendBranchResult.scheme.dependencies?.[0]
assert.equal(appendedBranchDependency?.scopeKind, 'branch')
assert.equal(appendedBranchDependency?.branchKey, 'branch-1')
assert.equal(appendedBranchDependency?.scopeKey, 'branch-1')

const appendStepResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: makeScheme({
    mainPath: [
      { key: 'node-a', kind: 'approval', title: '审批', intent: '审批报销' },
    ],
  }),
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-user',
    decisionKey: 'flow.condition.field:node-a',
    questionId: 'flow-grounding-condition-field-missing:node-a',
  })],
})
const appendedStepDependency = appendStepResult.scheme.dependencies?.[0]
assert.equal(appendedStepDependency?.scopeKind, 'step')
assert.equal(appendedStepDependency?.scopeKey, 'node-a')
assert.equal(appendedStepDependency?.branchKey, undefined)

// 7. 无 flow summary / 目标表单不一致：全部跳过。
const noEvidenceResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: sameBranchScheme,
  flowConfirmationDecisions: [sameBranchDecision],
})
assert.equal(noEvidenceResult.skipped[0]?.reason, 'form_evidence_unavailable')
const mismatchResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: makeScheme({
    target: { formId: 'form-other', formName: '其他表单' },
    dependencies: sameBranchScheme.dependencies,
  }),
  flowSummary: summary,
  flowConfirmationDecisions: [sameBranchDecision],
})
assert.equal(mismatchResult.skipped[0]?.reason, 'target_form_mismatch')

// 8. 来源表单未解析时阻止来源字段决策。
const sourceBlockedScheme = makeScheme({
  dependencies: [
    buildSourceTableDependency({ branchKey: 'branch-1' }),
    buildSourceDependency({ branchKey: 'branch-1' }),
  ],
})
const sourceBlockedResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: sourceBlockedScheme,
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-source-field:field-amount',
    decisionKey: 'flow.source.field:branch-1',
    questionId: 'flow-grounding-source-field-missing:branch-1',
  })],
})
assert.equal(sourceBlockedResult.skipped[0]?.reason, 'source_table_unresolved')
assert.equal(sourceBlockedResult.scheme.dependencies?.[1]?.resolutionStatus, 'unresolved')

const sourceAllowedResult = convergeNocodeEditorFlowFieldDecisions({
  scheme: makeScheme({
    dependencies: [buildSourceDependency({ branchKey: 'branch-1' })],
  }),
  flowSummary: summary,
  flowConfirmationDecisions: [makeDecision({
    selectedOptionValue: 'use-existing-source-field:field-amount',
    decisionKey: 'flow.source.field:branch-1',
    questionId: 'flow-grounding-source-field-missing:branch-1',
  })],
})
assert.equal(sourceAllowedResult.applied.length, 1)
assert.equal(sourceAllowedResult.scheme.dependencies?.[0]?.requiredFor, 'source_mapping')
assert.equal(sourceAllowedResult.scheme.dependencies?.[0]?.fieldRef?.fieldId, 'field-amount')

// ---------------- Phase B ----------------

const makePlanNode = (
  condition: Record<string, unknown>,
  nodeKey = 'node-a',
): NocodeEditorFlowPlan['triggerBranches'][number]['nodes'][number] => ({
  nodeKey,
  type: 'transact',
  name: '提交处理',
  options: { finishCondition: { conditions: [condition] } },
})

const makePlan = (
  nodes: NocodeEditorFlowPlan['triggerBranches'][number]['nodes'],
  options: { triggerConditions?: Record<string, unknown>[] } = {},
): NocodeEditorFlowPlan => ({
  title: '报销流程',
  summary: '提交后审批',
  openQuestions: [],
  triggerBranches: [{
    branchKey: 'branch-1',
    label: '金额较大',
    triggerNode: {
      type: 'trigger-data-change',
      nodeKey: 'node-trigger',
      name: '数据变化',
      options: options.triggerConditions ? { conditions: options.triggerConditions } : {},
    },
    nodes,
  }],
})

const conditionDecisionDependency = resolvedDependency({
  id: 'dep-condition-branch-1',
  capability: 'condition',
  scopeKey: 'branch-1',
  fieldId: 'field-user',
  fieldName: '报销人',
  branchKey: 'branch-1',
})
const sourceDecisionDependency = resolvedDependency({
  id: 'dep-source-branch-1',
  capability: 'source',
  scopeKey: 'branch-1',
  fieldId: 'field-quantity',
  fieldName: '数量',
  branchKey: 'branch-1',
})

// 11. 条件主体引用不存在字段 → 改写成决策字段并清掉旧身份键。
const invalidConditionPlan = makePlan([
  makePlanNode({
    fieldUID: 'missing-condition',
    fieldId: 'missing-condition',
    fieldName: '缺失条件字段',
    func: 'gt',
    type: 'NUMBER',
    value: 100,
  }),
])
const invalidConditionResult = convergeFlowPlanFieldDecisions({
  plan: invalidConditionPlan,
  scheme: makeScheme({ dependencies: [conditionDecisionDependency] }),
  flowSummary: summary,
})
const rewrittenCondition = firstCondition(invalidConditionResult.plan)
assert.equal(rewrittenCondition.uid, 'field-user')
assert.equal(rewrittenCondition.fieldUID, undefined)
assert.equal(rewrittenCondition.fieldId, undefined)
assert.equal(rewrittenCondition.fieldName, undefined)
assert.equal(rewrittenCondition.func, 'gt')
assert.equal(rewrittenCondition.value, 100)
assert.equal(invalidConditionResult.rewrittenSites, 1)

// 12. 已引用可用字段 → 不动。
const validConditionPlan = makePlan([
  makePlanNode({ fieldUID: 'field-amount', fieldName: '报销金额', func: 'gt', value: 100 }),
])
const validConditionResult = convergeFlowPlanFieldDecisions({
  plan: validConditionPlan,
  scheme: makeScheme({ dependencies: [conditionDecisionDependency] }),
  flowSummary: summary,
})
assert.deepEqual(firstCondition(validConditionResult.plan), firstCondition(validConditionPlan))
assert.equal(validConditionResult.rewrittenSites, 0)

// 13. 字段存在但不可用于条件 → 改写。
const forbiddenConditionPlan = makePlan([
  makePlanNode({ fieldUID: 'field-dept', fieldName: '报销部门', func: 'eq', value: '销售部' }),
])
const forbiddenConditionResult = convergeFlowPlanFieldDecisions({
  plan: forbiddenConditionPlan,
  scheme: makeScheme({ dependencies: [conditionDecisionDependency] }),
  flowSummary: summary,
})
assert.equal(firstCondition(forbiddenConditionResult.plan).uid, 'field-user')

// 14. 条件里的取值来源失效 → type=FORM / value=决策字段 / 清 valueField*。
const invalidSourcePlan = makePlan([
  makePlanNode({
    fieldUID: 'field-amount',
    fieldName: '报销金额',
    func: 'eq',
    type: 'FORM',
    value: 'missing-source',
    valueFieldId: 'missing-source',
    valueFieldName: '缺失来源字段',
  }),
])
const invalidSourceResult = convergeFlowPlanFieldDecisions({
  plan: invalidSourcePlan,
  scheme: makeScheme({ dependencies: [sourceDecisionDependency] }),
  flowSummary: summary,
})
const rewrittenSourceCondition = firstCondition(invalidSourceResult.plan)
assert.equal(rewrittenSourceCondition.type, 'FORM')
assert.equal(rewrittenSourceCondition.value, 'field-quantity')
assert.equal(rewrittenSourceCondition.valueFieldId, undefined)
assert.equal(rewrittenSourceCondition.valueFieldName, undefined)
assert.equal(rewrittenSourceCondition.uid, undefined)
assert.equal(rewrittenSourceCondition.fieldUID, 'field-amount')

// 15. 映射 source 与 valueField* 冲突 → 统一为决策字段。
const mappingConflictPlan = makePlan([{
  nodeKey: 'node-add',
  type: 'add-data',
  name: '写入明细',
  options: {
    mapping: [{
      targetFieldId: 'target-amount',
      source: { fieldUID: 'field-user' },
      valueFieldUID: 'field-amount',
    }],
  },
}])
const mappingConflictResult = convergeFlowPlanFieldDecisions({
  plan: mappingConflictPlan,
  scheme: makeScheme({ dependencies: [sourceDecisionDependency] }),
  flowSummary: summary,
})
const conflictMapping = asRecord(
  getPath(mappingConflictResult.plan, ['triggerBranches', 0, 'nodes', 0, 'options', 'mapping', 0]),
)
assert.deepEqual(conflictMapping.source, { fieldUID: 'field-quantity' })
assert.equal(conflictMapping.valueFieldUID, undefined)
assert.equal(conflictMapping.targetFieldId, 'target-amount')

// 15b. batch 映射同样改写。
const batchMappingPlan = makePlan([{
  nodeKey: 'node-batch',
  type: 'add-data',
  name: '批量写入',
  options: {
    batch: {
      batchMappings: [{
        targetFieldId: 'target-amount',
        source: { fieldUID: 'missing-source' },
      }],
    },
  },
}])
const batchMappingResult = convergeFlowPlanFieldDecisions({
  plan: batchMappingPlan,
  scheme: makeScheme({ dependencies: [sourceDecisionDependency] }),
  flowSummary: summary,
})
const batchMapping = asRecord(
  getPath(batchMappingResult.plan, ['triggerBranches', 0, 'nodes', 0, 'options', 'batch', 'batchMappings', 0]),
)
assert.deepEqual(batchMapping.source, { fieldUID: 'field-quantity' })

// 16. 映射自带 value 字面量 → 不改写。
const literalMappingPlan = makePlan([{
  nodeKey: 'node-add',
  type: 'add-data',
  name: '写入明细',
  options: {
    mappings: [{ targetFieldId: 'target-amount', value: '固定值', source: { fieldUID: 'missing-source' } }],
  },
}])
const literalMappingResult = convergeFlowPlanFieldDecisions({
  plan: literalMappingPlan,
  scheme: makeScheme({ dependencies: [sourceDecisionDependency] }),
  flowSummary: summary,
})
assert.deepEqual(literalMappingResult.plan, literalMappingPlan)

// 17. 同一优先级两个不同字段决策 → 歧义，不改写。
const ambiguousResult = convergeFlowPlanFieldDecisions({
  plan: mappingConflictPlan,
  scheme: makeScheme({
    dependencies: [
      resolvedDependency({
        id: 'dep-source-1',
        capability: 'source',
        scopeKey: 'branch-1',
        fieldId: 'field-user',
        fieldName: '报销人',
        branchKey: 'branch-1',
      }),
      resolvedDependency({
        id: 'dep-source-2',
        capability: 'source',
        scopeKey: 'branch-1',
        fieldId: 'field-amount',
        fieldName: '报销金额',
        branchKey: 'branch-1',
      }),
    ],
  }),
  flowSummary: summary,
})
assert.equal(ambiguousResult.skipped.some(item => item.reason === 'scope_ambiguous'), true)
assert.deepEqual(ambiguousResult.plan, mappingConflictPlan)

// 18. 节点级决策覆盖分支级；分支级作用于同分支其他节点。
const nodeOverridePlan = makePlan([{
  nodeKey: 'node-a',
  type: 'add-data',
  name: '写入A',
  options: { mapping: [{ targetFieldId: 't1', source: { fieldUID: 'missing-a' } }] },
}, {
  nodeKey: 'node-b',
  type: 'add-data',
  name: '写入B',
  options: { mapping: [{ targetFieldId: 't2', source: { fieldUID: 'missing-b' } }] },
}])
const nodeOverrideResult = convergeFlowPlanFieldDecisions({
  plan: nodeOverridePlan,
  scheme: makeScheme({
    dependencies: [
      resolvedDependency({
        id: 'dep-source-branch',
        capability: 'source',
        scopeKey: 'branch-1',
        fieldId: 'field-amount',
        fieldName: '报销金额',
        branchKey: 'branch-1',
      }),
      resolvedDependency({
        id: 'dep-source-node-b',
        capability: 'source',
        scopeKey: 'node-b',
        fieldId: 'field-user',
        fieldName: '报销人',
        scopeKind: 'step',
      }),
    ],
  }),
  flowSummary: summary,
})
const nodeAMapping = asRecord(
  getPath(nodeOverrideResult.plan, ['triggerBranches', 0, 'nodes', 0, 'options', 'mapping', 0]),
)
const nodeBMapping = asRecord(
  getPath(nodeOverrideResult.plan, ['triggerBranches', 0, 'nodes', 1, 'options', 'mapping', 0]),
)
assert.deepEqual(nodeAMapping.source, { fieldUID: 'field-amount' })
assert.deepEqual(nodeBMapping.source, { fieldUID: 'field-user' })

// 19. condition-branch 自身条件使用节点上下文；内层分支决策只作用于嵌套节点。
const conditionBranchPlan = makePlan([{
  nodeKey: 'node-cond',
  type: 'condition-branch',
  name: '金额判断',
  branches: [{
    branchKey: 'inner-branch',
    label: '是',
    conditions: [[{
      uid: 'missing-own',
      func: RuleFunc.EQUAL,
      value: '1',
    }]],
    nodes: [{
      nodeKey: 'node-inner',
      type: 'transact',
      name: '内层处理',
      options: {
        finishCondition: {
          conditions: [{
            fieldId: 'missing-nested',
            fieldName: '缺失嵌套条件',
            func: 'eq',
            value: '1',
          }],
        },
      },
    }],
  }],
}])
const conditionBranchResult = convergeFlowPlanFieldDecisions({
  plan: conditionBranchPlan,
  scheme: makeScheme({
    dependencies: [resolvedDependency({
      id: 'dep-condition-inner',
      capability: 'condition',
      scopeKey: 'inner-branch',
      fieldId: 'field-user',
      fieldName: '报销人',
      branchKey: 'inner-branch',
    })],
  }),
  flowSummary: summary,
})
const ownCondition = asRecord(
  getPath(conditionBranchResult.plan, ['triggerBranches', 0, 'nodes', 0, 'branches', 0, 'conditions', 0, 0]),
)
const nestedCondition = asRecord(
  getPath(
    conditionBranchResult.plan,
    ['triggerBranches', 0, 'nodes', 0, 'branches', 0, 'nodes', 0, 'options', 'finishCondition', 'conditions', 0],
  ),
)
assert.equal(ownCondition.uid, 'missing-own')
assert.equal(nestedCondition.uid, 'field-user')

// 20. 依赖字段不在当前表单 → 不消费，计划原样返回。
const missingCatalogFieldPlan = makePlan([
  makePlanNode({ fieldId: 'missing-condition', fieldName: '缺失条件字段', func: 'eq', value: '1' }),
])
const missingCatalogFieldResult = convergeFlowPlanFieldDecisions({
  plan: missingCatalogFieldPlan,
  scheme: makeScheme({
    dependencies: [resolvedDependency({
      id: 'dep-condition-unknown',
      capability: 'condition',
      scopeKey: 'branch-1',
      fieldId: 'field-unknown',
      fieldName: '不存在字段',
      branchKey: 'branch-1',
    })],
  }),
  flowSummary: summary,
})
assert.deepEqual(missingCatalogFieldResult.plan, missingCatalogFieldPlan)
assert.equal(missingCatalogFieldResult.rewrittenSites, 0)

// 21. 同分支仍有未解析来源表单 → 来源决策不消费。
const sourceTableUnresolvedPlan = mappingConflictPlan
const sourceTableUnresolvedResult = convergeFlowPlanFieldDecisions({
  plan: sourceTableUnresolvedPlan,
  scheme: makeScheme({
    dependencies: [
      sourceDecisionDependency,
      buildSourceTableDependency({ branchKey: 'branch-1' }),
    ],
  }),
  flowSummary: summary,
})
assert.deepEqual(sourceTableUnresolvedResult.plan, sourceTableUnresolvedPlan)
assert.equal(sourceTableUnresolvedResult.rewrittenSites, 0)

// 22. 触发节点条件同样改写。
const triggerConditionPlan = makePlan([], {
  triggerConditions: [{ fieldId: 'missing-trigger', fieldName: '缺失触发条件', func: 'eq', value: '1' }],
})
const triggerConditionResult = convergeFlowPlanFieldDecisions({
  plan: triggerConditionPlan,
  scheme: makeScheme({ dependencies: [conditionDecisionDependency] }),
  flowSummary: summary,
})
assert.equal(
  asRecord(
    getPath(triggerConditionResult.plan, ['triggerBranches', 0, 'triggerNode', 'options', 'conditions', 0]),
  ).uid,
  'field-user',
)

console.log('flow field decision convergence: ok')
