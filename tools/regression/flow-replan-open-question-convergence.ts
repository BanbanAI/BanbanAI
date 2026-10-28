import assert from 'node:assert/strict'

import {
  convergeNocodeEditorFlowReplanQuestions,
  hasFlowReplanCapabilityDecisions,
  isFlowReplanSequentialWriteConfirmed,
  parseFlowReplanQuestionIdentity,
} from '../../src/common/utils/nocodeEditorFlowReplanQuestionConvergence'
import type { NocodeEditorConfirmationDecision } from '../../src/common/utils/nocodeEditorConfirmationDecisionProjection'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import {
  buildFlowGroundingConfirmationQuestions,
} from '../../src/common/utils/nocodeEditorFlowGroundingPresentation'
import type {
  NocodeEditorFlowSchemeGroundingDiagnostic,
} from '../../src/common/utils/nocodeEditorFlowSchemeGrounding'
import {
  buildFlowSchemeDependencyFromGroundingDiagnostic,
} from '../../src/common/utils/nocodeEditorFlowSchemeGrounding'

const summary = {
  forms: {
    currentForm: {
      tableId: 'form-expense',
      tableName: '报销单',
      fields: [
        { fieldId: 'field-amount', fieldName: '报销总金额', conditionPolicy: 'usable', writePolicy: 'writable' },
        { fieldId: 'field-dept', fieldName: '报销部门', conditionPolicy: 'forbidden', writePolicy: 'writable' },
        { fieldId: 'field-status', fieldName: '状态', conditionPolicy: 'usable', writePolicy: 'readonly' },
      ],
    },
    availableForms: [{
      tableId: 'form-detail',
      tableName: '报销明细',
      fields: [{ fieldId: 'field-detail-amount', fieldName: '明细金额' }],
    }],
  },
}

const makeScheme = (input: Partial<NocodeEditorFlowScheme> = {}): NocodeEditorFlowScheme => ({
  id: 'scheme-expense',
  title: '报销审批',
  summary: '报销审批流程',
  target: { formId: 'form-expense', formName: '报销单' },
  trigger: { type: 'submit', description: '提交报销单' },
  mainPath: [],
  branches: [],
  confirmedFacts: [],
  assumptions: [],
  openQuestions: [],
  dependencies: [],
  ...input,
})

const makeDependency = (
  input: Partial<NocodeEditorFlowSchemeDependency> = {},
): NocodeEditorFlowSchemeDependency => ({
  id: 'flow-dependency:grounding_condition_field_missing:branch-1:form-expense:fieldamount',
  kind: 'field_missing',
  requiredFor: 'condition',
  scopeKind: 'branch',
  scopeKey: 'branch-1',
  branchKey: 'branch-1',
  targetFormId: 'form-expense',
  targetFormName: '报销单',
  fieldRef: { fieldId: 'field-amount', fieldName: '报销总金额' },
  riskLevel: 'high',
  resolutionStatus: 'unresolved',
  materializationStatus: 'not_available',
  summary: '流程条件字段或条件能力',
  ...input,
} as NocodeEditorFlowSchemeDependency)

const makeDecision = (
  input: Partial<NocodeEditorConfirmationDecision> = {},
): NocodeEditorConfirmationDecision => ({
  questionId: 'flow-grounding-condition-field-missing:branch-1',
  questionTitle: '条件判断字段选择',
  decisionKey: 'flow.condition.field:branch-1',
  selectedOptionValue: 'use-existing-condition-field:field-amount',
  answerSummary: '使用现有字段“报销总金额”',
  planningContextKey: 'ctx-expense',
  ...input,
})

// 1. legacy openQuestion + canonical 可信决策 → 关闭，系统依赖转 resolved。
const conditionScheme = makeScheme({
  openQuestions: [{
    key: 'flow-grounding-condition-field-missing:branch-1',
    title: '条件判断字段选择',
    reason: '条件判断字段选择',
    scopeKind: 'branch',
    scopeKey: 'branch-1',
  }],
  dependencies: [makeDependency()],
})
const conditionResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: conditionScheme,
  decisions: [makeDecision()],
  flowSummary: summary,
})
assert.equal(conditionResult.scheme.openQuestions.length, 0)
assert.equal(conditionResult.scheme.dependencies?.[0]?.resolutionStatus, 'resolved')
assert.equal(conditionResult.scheme.dependencies?.[0]?.resolutionMode, 'use_existing')
assert.equal(conditionResult.scheme.dependencies?.[0]?.materializationStatus, 'existing')
assert.equal(conditionResult.scheme.dependencies?.[0]?.fieldRef?.fieldId, 'field-amount')
assert.equal(conditionResult.diagnostics[0]?.code, 'flow_replan_question_closed')
assert.deepEqual(
  conditionResult.consumedDecisionKeys.sort(),
  ['flow-grounding-condition-field-missing:branch-1', 'flow.condition.field:branch-1'].sort(),
)

// 2. canonical openQuestion 同样命中。
const canonicalResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: makeScheme({
    openQuestions: [{
      key: 'flow.condition.field:branch-1',
      title: '条件判断字段选择',
      reason: '条件判断字段选择',
    }],
    dependencies: [makeDependency()],
  }),
  decisions: [makeDecision()],
  flowSummary: summary,
})
assert.equal(canonicalResult.scheme.openQuestions.length, 0)

// 3. 显式字段已不可用于条件 → 保留问题，依赖不动。
const forbiddenResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: conditionScheme,
  decisions: [makeDecision({
    selectedOptionValue: 'use-existing-condition-field:field-dept',
    answerSummary: '使用现有字段“报销部门”',
  })],
  flowSummary: summary,
})
assert.equal(forbiddenResult.scheme.openQuestions.length, 1)
assert.equal(forbiddenResult.scheme.dependencies?.[0]?.resolutionStatus, 'unresolved')
assert.equal(forbiddenResult.diagnostics[0]?.code, 'flow_replan_question_kept')
assert.equal(forbiddenResult.diagnostics[0]?.reason, 'decision_evidence_invalid')

// 4. 没有 flow summary 时，显式字段选择不关闭。
const unavailableResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: conditionScheme,
  decisions: [makeDecision()],
  flowSummary: null,
})
assert.equal(unavailableResult.scheme.openQuestions.length, 1)
assert.equal(unavailableResult.diagnostics[0]?.reason, 'form_evidence_unavailable')

// 5. 不同作用域不误关。
const otherBranchResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: makeScheme({
    openQuestions: [{
      key: 'flow.condition.field:branch-2',
      title: '条件判断字段选择',
      reason: '条件判断字段选择',
    }],
    dependencies: [makeDependency({ scopeKey: 'branch-2', branchKey: 'branch-2' })],
  }),
  decisions: [makeDecision()],
  flowSummary: summary,
})
assert.equal(otherBranchResult.scheme.openQuestions.length, 1)

// 6. 自由文本答案 + 系统遗留依赖 → 关闭，依赖 switch_strategy。
const freeTextResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: conditionScheme,
  decisions: [makeDecision({
    selectedOptionValue: 'choose-another-condition-field',
    answerSummary: '改用其他判断字段',
    answerDetail: '报销总额',
  })],
  flowSummary: summary,
})
assert.equal(freeTextResult.scheme.openQuestions.length, 0)
assert.equal(freeTextResult.scheme.dependencies?.[0]?.resolutionMode, 'switch_strategy')

// 7. 模型自建的同槽位未解决依赖 → 保留。
const modelDependencyResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: makeScheme({
    openQuestions: conditionScheme.openQuestions,
    dependencies: [makeDependency({
      id: 'model-dependency-condition-branch-1',
      fieldRef: { fieldName: '报销总金额' },
    })],
  }),
  decisions: [makeDecision()],
  flowSummary: summary,
})
assert.equal(modelDependencyResult.scheme.openQuestions.length, 1)
assert.equal(modelDependencyResult.diagnostics[0]?.reason, 'residual_dependency')

// 8. 顺序写入确认：关闭问题、补依赖、allow 生效。
const sequentialScheme = makeScheme({
  openQuestions: [{
    key: 'flow-grounding-sequential-write-conflict',
    title: '多个顺序步骤会改写同一字段',
    reason: '多个顺序步骤会改写同一字段',
  }],
})
const sequentialResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: sequentialScheme,
  decisions: [makeDecision({
    questionId: 'flow-grounding-sequential-write-conflict',
    decisionKey: 'flow.write.sequential:global',
    selectedOptionValue: 'confirm-sequential-updates',
    answerSummary: '确认按顺序更新',
  })],
  flowSummary: summary,
})
assert.equal(sequentialResult.scheme.openQuestions.length, 0)
assert.equal(isFlowReplanSequentialWriteConfirmed(sequentialResult.scheme), true)

// 9. 未答确认题按身份标 confirmed。
const confirmationResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: makeScheme({
    confirmation: {
      stage: 'flow-scheme',
      status: 'pending',
      planningContextKey: 'ctx-expense',
      questions: [{
        id: 'flow-grounding-condition-field-missing:branch-1:replanned',
        decisionKey: 'flow.condition.field:branch-1',
        title: '重写后的条件字段问题',
        questionKind: 'single_select',
        required: true,
        options: [{ value: 'choose-another-condition-field', label: '改用其他判断字段' }],
      }],
    },
    dependencies: [makeDependency()],
  }),
  decisions: [makeDecision()],
  flowSummary: summary,
})
assert.equal(confirmationResult.scheme.confirmation?.questions[0]?.confirmed, true)
assert.equal(
  confirmationResult.scheme.confirmation?.questions[0]?.selectedOptionValue,
  'use-existing-condition-field:field-amount',
)
assert.equal(
  confirmationResult.scheme.confirmation?.questions[0]?.options?.some(option => (
    option.value === 'use-existing-condition-field:field-amount' && option.selected === true
  )),
  true,
)
assert.equal(confirmationResult.scheme.confirmation?.status, 'completed')

// 10. 身份解析覆盖所有能力，canonical / legacy 归一。
assert.deepEqual(parseFlowReplanQuestionIdentity('flow.condition.field:BRANCH-1'), {
  capability: 'condition',
  scopeKey: 'branch-1',
  decisionKey: 'flow.condition.field:branch-1',
})
assert.deepEqual(parseFlowReplanQuestionIdentity('flow-grounding-source-field-conflict:branch-1'), {
  capability: 'source_field',
  scopeKey: 'branch-1',
  decisionKey: 'flow.source.field:branch-1',
})
assert.equal(
  parseFlowReplanQuestionIdentity('flow-grounding-sequential-write-conflict')?.decisionKey,
  'flow.write.sequential:global',
)
assert.equal(parseFlowReplanQuestionIdentity('flow-grounding-owner-field'), null)
assert.equal(parseFlowReplanQuestionIdentity('flow.condition.field'), null)

// 11. 没有可信决策 / 只有无答案决策时不动。
assert.equal(hasFlowReplanCapabilityDecisions([]), false)
assert.equal(hasFlowReplanCapabilityDecisions([{
  ...makeDecision(),
  selectedOptionValue: '',
  answerSummary: '',
  answerDetail: '',
}]), false)

// 12. 合成题生成的身份与本文常量保持一致，防止前缀漂移。
const syntheticDiagnostics: Array<{
  code: string
  expected: string
}> = [
  { code: 'grounding_condition_field_missing', expected: 'flow.condition.field:branch-1' },
  { code: 'grounding_source_field_missing', expected: 'flow.source.field:branch-1' },
  { code: 'grounding_source_table_missing', expected: 'flow.source.table:branch-1' },
  { code: 'grounding_write_field_missing', expected: 'flow.write.field:branch-1' },
  { code: 'grounding_sequential_write_conflict', expected: 'flow.write.sequential:global' },
]
syntheticDiagnostics.forEach(({ code, expected }) => {
  const diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic = {
    code,
    message: '',
    branchKey: 'branch-1',
    branchLabel: '分支 1',
  }
  const [question] = buildFlowGroundingConfirmationQuestions([diagnostic])
  assert.equal(parseFlowReplanQuestionIdentity(question?.decisionKey)?.decisionKey, expected)
})

// 13. 节点级写回依赖带分支身份：分支级写回问题仍能匹配并收敛。
const writeFieldScheme = makeScheme({
  openQuestions: [{
    key: 'flow.write.field:branch-1',
    title: '回写字段选择',
    reason: '回写字段选择',
  }],
  dependencies: [makeDependency({
    id: 'flow-dependency:grounding_write_field_missing:node-1:form-expense:fieldamount',
    kind: 'field_missing',
    requiredFor: 'writeback',
    scopeKind: 'step',
    scopeKey: 'node-1',
    branchKey: 'branch-1',
    fieldRef: { fieldId: 'field-amount', fieldName: '报销总金额' },
  })],
})
const writeFieldResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: writeFieldScheme,
  decisions: [makeDecision({
    questionId: 'flow-grounding-write-field-missing:branch-1',
    decisionKey: 'flow.write.field:branch-1',
    selectedOptionValue: 'choose-another-write-field',
    answerSummary: '报销总金额',
    answerDetail: '',
  })],
  flowSummary: summary,
})
assert.equal(writeFieldResult.scheme.openQuestions.length, 0)
assert.equal(writeFieldResult.scheme.dependencies?.[0]?.resolutionStatus, 'resolved')
assert.equal(writeFieldResult.scheme.dependencies?.[0]?.resolutionMode, 'use_existing')
assert.equal(writeFieldResult.scheme.dependencies?.[0]?.fieldRef?.fieldId, 'field-amount')

// 14. 来源表单证据成立：关闭问题并指向证据表单。
const sourceTableResult = convergeNocodeEditorFlowReplanQuestions({
  scheme: makeScheme({
    openQuestions: [{
      key: 'flow-grounding-source-table-missing:branch-1',
      title: '数据来源表单选择',
      reason: '数据来源表单选择',
    }],
    dependencies: [makeDependency({
      id: 'flow-dependency:grounding_source_table_missing:branch-1:form-missing:field',
      kind: 'source_table_missing',
      requiredFor: 'source_mapping',
      targetFormId: undefined,
      targetFormName: undefined,
      fieldRef: undefined,
      summary: '来源表单映射',
    })],
  }),
  decisions: [makeDecision({
    questionId: 'flow-grounding-source-table-missing:branch-1',
    decisionKey: 'flow.source.table:branch-1',
    selectedOptionValue: 'choose-another-source-form',
    answerSummary: '报销明细',
    answerDetail: '',
  })],
  flowSummary: summary,
})
assert.equal(sourceTableResult.scheme.openQuestions.length, 0)
assert.equal(sourceTableResult.scheme.dependencies?.[0]?.resolutionStatus, 'resolved')
assert.equal(sourceTableResult.scheme.dependencies?.[0]?.targetFormId, 'form-detail')

// 15. 写回类 grounding 依赖同样携带分支身份，供分支级决策匹配。
const writeDependency = buildFlowSchemeDependencyFromGroundingDiagnostic({
  code: 'grounding_write_field_missing',
  nodeKey: 'node-1',
  branchKey: 'branch-1',
  targetFormId: 'form-expense',
  fieldRef: { fieldName: '报销总金额' },
})
assert.equal(writeDependency?.branchKey, 'branch-1')

console.log('flow replan open question convergence: ok')
