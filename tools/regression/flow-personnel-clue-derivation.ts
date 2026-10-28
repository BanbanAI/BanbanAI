import assert from 'node:assert/strict'

import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeStep,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import {
  deriveFlowSchemePersonnelRequirementsFromClues,
  resolveFlowPersonnelRequirementFromClues,
} from '../../src/common/utils/nocodeEditorFlowPersonnelClueDerivation'
import type {
  NocodeEditorFlowPersonnelSourceEvidence,
} from '../../src/common/utils/nocodeEditorFlowPersonnelSourceAnchor'

const FINANCE_STEP_KEY = 'finance_approval'
const DEPT_STEP_KEY = 'dept_approval'

const evidence: NocodeEditorFlowPersonnelSourceEvidence = {
  roles: [{ id: '7r9rfhv36n1650969rns', name: '财务' }],
  users: [{ id: 'u_zhangsan', name: '张三' }],
  memberFieldNames: ['申请人'],
  departmentFieldNames: ['所属部门'],
}

const USER_MESSAGE = '调整为按照报销总金额分流审批，1000 元以内由财务审批，1000 元以上先由财务审批，然后由部门主管审批'

const approvalStep = (input: {
  key: string
  title: string
  actorHint?: string
  intent?: string
}): Pick<NocodeEditorFlowSchemeStep, 'key' | 'kind' | 'title' | 'intent' | 'actorHint'> => ({
  key: input.key,
  kind: 'approval',
  title: input.title,
  intent: input.intent || '',
  actorHint: input.actorHint || '',
})

// 1. 用户点名“财务”，组织里有角色“财务” → 直接落位固定角色，不需要再问。
const financeDerivation = resolveFlowPersonnelRequirementFromClues({
  step: approvalStep({
    key: FINANCE_STEP_KEY,
    title: '财务审批',
    actorHint: '财务角色',
  }),
  supportTexts: [USER_MESSAGE],
  evidence,
})
assert.deepEqual(financeDerivation, {
  requirement: {
    sourceType: 'fixed_roles',
    roleRefs: [{ id: '7r9rfhv36n1650969rns', name: '财务' }],
  },
  sourceType: 'fixed_roles',
  matchedText: '财务',
  needsLevel: false,
})

// 2. 用户点名“部门主管”但没说层级 → 来源已定，只差层级。
const managerDerivation = resolveFlowPersonnelRequirementFromClues({
  step: approvalStep({
    key: DEPT_STEP_KEY,
    title: '部门主管审批',
    actorHint: '提交人的部门主管',
  }),
  supportTexts: [USER_MESSAGE],
  evidence,
})
assert.deepEqual(managerDerivation, {
  requirement: { sourceType: 'department_manager' },
  sourceType: 'department_manager',
  matchedText: '部门主管',
  needsLevel: true,
})

// 3. 只有节点自己叫“财务审批”，用户原话没提财务 → 那是模型起名的回声，不算证据。
const echoDerivation = resolveFlowPersonnelRequirementFromClues({
  step: approvalStep({
    key: FINANCE_STEP_KEY,
    title: '财务审批',
    actorHint: '财务角色',
  }),
  supportTexts: ['帮我搭一个报销审批流程'],
  evidence,
})
assert.equal(echoDerivation, null)

// 4. 线索同时命中角色与部门字段 → 对象多义，仍出来源题。
const ambiguousDerivation = resolveFlowPersonnelRequirementFromClues({
  step: approvalStep({
    key: 'finance_approval',
    title: '财务审批',
    intent: '按财务角色与财务部门字段决定',
  }),
  supportTexts: ['按财务角色与财务部门字段决定'],
  evidence: {
    roles: [{ id: '7r9rfhv36n1650969rns', name: '财务' }],
    users: [],
    memberFieldNames: [],
    departmentFieldNames: ['财务部门'],
  },
})
assert.equal(ambiguousDerivation, null)

// 5. 方案写回只补空位：已落位的节点原样保留。
const scheme: NocodeEditorFlowScheme = {
  title: '报销审批流程',
  summary: '报销单按金额分流审批',
  target: { formId: 't_expense', formName: '报销申请' },
  trigger: { type: 'submit', description: '员工提交报销申请后触发审批流程' },
  mainPath: [
    {
      key: 'submitter_approval',
      kind: 'approval',
      title: '提交人确认',
      intent: '',
      actorHint: '提交人自己',
      personnelRequirement: { sourceType: 'submitter' },
    },
    {
      key: FINANCE_STEP_KEY,
      kind: 'approval',
      title: '财务审批',
      intent: '',
      actorHint: '财务角色',
    },
    {
      key: DEPT_STEP_KEY,
      kind: 'approval',
      title: '部门主管审批',
      intent: '',
      actorHint: '提交人的部门主管',
    },
    {
      key: 'archive',
      kind: 'report-data',
      title: '归档',
      intent: '',
      actorHint: '财务角色',
    },
  ],
  branches: [],
  confirmedFacts: [],
  assumptions: [],
  openQuestions: [],
}
const derived = deriveFlowSchemePersonnelRequirementsFromClues({
  scheme,
  evidence,
  userMessage: USER_MESSAGE,
})
assert.deepEqual(
  derived.derived.map(item => `${item.stepKey}:${item.sourceType}:${item.needsLevel}`),
  [
    `${FINANCE_STEP_KEY}:fixed_roles:false`,
    `${DEPT_STEP_KEY}:department_manager:true`,
    'archive:fixed_roles:false',
  ],
)
assert.deepEqual(
  derived.scheme.mainPath.map(step => step.personnelRequirement?.sourceType),
  ['submitter', 'fixed_roles', 'department_manager', 'fixed_roles'],
)
assert.equal(derived.scheme.mainPath[0], scheme.mainPath[0])
assert.notEqual(derived.scheme, scheme)

// 没有用户原话与已确认结论时一律不派生，退回来源题。
const withoutSupport = deriveFlowSchemePersonnelRequirementsFromClues({
  scheme,
  evidence,
  userMessage: null,
})
assert.deepEqual(withoutSupport.derived, [])
assert.equal(withoutSupport.scheme, scheme)

console.log('flow personnel clue derivation: ok')
