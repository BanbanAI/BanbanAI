import assert from 'node:assert/strict'

import {
  buildFlowGroundingConfirmationQuestions,
  containsFlowGroundingIdentifierText,
  isFlowGroundingIdentifierText,
  normalizeVisibleFlowGroundingQuestions,
  normalizeVisibleQuestion,
} from '../../src/common/utils/nocodeEditorFlowGroundingPresentation'
import type {
  NocodeEditorFlowSchemeGroundingDiagnostic,
} from '../../src/common/utils/nocodeEditorFlowSchemeGrounding'

const buildDiagnostic = (
  input: Partial<NocodeEditorFlowSchemeGroundingDiagnostic> & { code: string },
): NocodeEditorFlowSchemeGroundingDiagnostic => ({
  message: 'grounding diagnostic',
  ...input,
})

// 1. 字段编码识别：表单引擎编码算编码，业务 snake_case 不算。
assert.equal(isFlowGroundingIdentifierText('fld_qv5i0t8v39t6'), true)
assert.equal(isFlowGroundingIdentifierText('t_d8f3a2'), true)
assert.equal(isFlowGroundingIdentifierText('f_abc123'), true)
assert.equal(isFlowGroundingIdentifierText('owner_name'), false)
assert.equal(isFlowGroundingIdentifierText('报销总金额'), false)
assert.equal(isFlowGroundingIdentifierText(''), false)
assert.equal(containsFlowGroundingIdentifierText('涉及字段：“fld_qv5i0t8v39t6”。'), true)
assert.equal(containsFlowGroundingIdentifierText('涉及字段：“报销总金额”。'), false)

// 2. 模型把字段编码当成字段名引用时，确认题不把编码抛给用户，只描述业务影响。
// 同一处问题被两个校验入口各报一次时，也不能算成“2 处”。
const identifierConditionDiagnostic = buildDiagnostic({
  code: 'grounding_condition_field_missing',
  nodeKey: 'condition_amount',
  nodeName: '按报销金额分流',
  targetFormId: 'tbl_expense',
  targetFormName: '报销申请单',
  fieldRef: { fieldName: 'fld_qv5i0t8v39t6' },
  compatibleFields: [
    { fieldId: 'fld_owner', fieldName: '归属人' },
    { fieldId: 'fld_reporter', fieldName: '报销人' },
  ],
  candidateCount: 8,
})
const identifierQuestions = buildFlowGroundingConfirmationQuestions([
  identifierConditionDiagnostic,
  { ...identifierConditionDiagnostic },
])
assert.equal(identifierQuestions.length, 1)
const [identifierQuestion] = identifierQuestions
assert.equal(identifierQuestion.title, 'AI 规划在“按报销金额分流”使用的条件字段已不存在')
assert.equal(
  identifierQuestion.description.startsWith('这个字段在当前表单里找不到'),
  true,
)
assert.equal(identifierQuestion.title.includes('2 处'), false)
assert.equal(identifierQuestion.description.includes('fld_'), false)
assert.equal(containsFlowGroundingIdentifierText(identifierQuestion.title), false)
assert.equal(containsFlowGroundingIdentifierText(identifierQuestion.description), false)
assert.deepEqual(
  identifierQuestion.options.map(option => option.label),
  [
    '改用现有字段“归属人”',
    '改用现有字段“报销人”',
    '改用其他判断字段',
    '调整条件设计',
  ],
)

// 3. 业务字段名照旧进入文案，单条诊断保持原有措辞。
const [namedQuestion] = buildFlowGroundingConfirmationQuestions([
  buildDiagnostic({
    code: 'grounding_condition_field_missing',
    nodeName: '按报销金额分流',
    targetFormId: 'tbl_expense',
    targetFormName: '报销申请单',
    fieldRef: { fieldId: 'fld_amount', fieldName: '报销总金额' },
  }),
])
assert.equal(
  namedQuestion.title,
  'AI 规划的条件判断引用了表单“报销申请单”中没有的字段“报销总金额”',
)
assert.equal(namedQuestion.description.includes('fld_'), false)

// 4. 数据来源也要按同样的口径收敛编码。
const [sourceQuestion] = buildFlowGroundingConfirmationQuestions([
  buildDiagnostic({
    code: 'grounding_source_field_missing',
    nodeName: '写入所属项目',
    targetFormName: '报销申请单',
    fieldRef: { fieldName: 'fld_project_ref' },
    message: '未找到来源字段“fld_project_ref”。',
  }),
])
assert.equal(sourceQuestion.title, 'AI 规划在“写入所属项目”使用的来源字段已不存在')
assert.equal(sourceQuestion.description.includes('fld_'), false)

// 5. 写入类问题本来就用模板文案，确认模板里不会带出编码。
const [writeQuestion] = buildFlowGroundingConfirmationQuestions([
  buildDiagnostic({
    code: 'grounding_write_field_missing',
    nodeName: '回写项目状态',
    fieldRef: { fieldName: 'fld_project_status' },
  }),
])
assert.equal(writeQuestion.title, 'AI 规划的流程写入还缺少目标字段')
assert.equal(writeQuestion.description.includes('fld_'), false)

// 6. 模型直接吐出来的带编码问题在展示前会被业务文案替换。
const visibleQuestion = normalizeVisibleQuestion({
  id: 'flow-grounding-condition-field-missing',
  title: 'AI 规划的条件判断引用了不存在的字段“fld_qv5i0t8v39t6”',
  description: '涉及字段：“fld_qv5i0t8v39t6”。涉及节点：“按报销金额分流”。',
  options: [{ value: 'choose-another-condition-field', label: '改用其他判断字段' }],
})
assert.equal(visibleQuestion?.title, '流程方案还需要补充确认')

const replacedQuestions = normalizeVisibleFlowGroundingQuestions({
  questions: [{
    id: 'flow-grounding-condition-field-missing',
    title: 'AI 规划的条件判断引用了不存在的字段“fld_qv5i0t8v39t6”',
    description: '涉及字段：“fld_qv5i0t8v39t6”。',
  }],
  diagnostics: [identifierConditionDiagnostic, { ...identifierConditionDiagnostic }],
})
assert.equal(replacedQuestions.length, 1)
assert.equal(
  replacedQuestions[0].title,
  'AI 规划在“按报销金额分流”使用的条件字段已不存在',
)
assert.equal(replacedQuestions[0].description.includes('fld_'), false)

console.log('flow grounding business copy: ok')
