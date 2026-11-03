import assert from 'node:assert/strict'

import { validateFlowSchemeSubmissionSteps } from '../../src/common/utils/nocodeEditorFlowSchemeSubmissionStep'
import { FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS } from '../../src/main/modules/ai/nocode-editor/nocode-editor-flow-scheme-repair.util'

const trigger = {
  type: 'submit',
  description: '提交人填写报销单并提交后，自动发起审批流程。',
}

const observedScheme = {
  trigger,
  mainPath: [{
    key: 'step-submit',
    kind: 'approval',
    title: '提交报销单',
    intent: '提交人填写并提交报销单，启动审批流程。',
    personnelRequirement: { sourceType: 'submitter' },
  }, {
    key: 'step-dept-manager-approval',
    kind: 'approval',
    title: '部门主管审批',
    intent: '提交人的直属部门主管审核报销申请的合理性。',
    personnelRequirement: { sourceType: 'department_manager' },
  }],
  branches: [],
}

const observedDiagnostics = validateFlowSchemeSubmissionSteps({ scheme: observedScheme })
assert.equal(observedDiagnostics.length, 1)
assert.equal(observedDiagnostics[0].code, 'submission_action_as_approval_step')
assert.equal(observedDiagnostics[0].stepKey, 'step-submit')
assert.equal(observedDiagnostics[0].stepTitle, '提交报销单')

const branchDiagnostics = validateFlowSchemeSubmissionSteps({
  trigger,
  mainPath: [],
  branches: [{
    key: 'branch-a',
    title: '直接提交',
    when: '金额小于 5000',
    steps: [{
      key: 'branch-submit',
      kind: 'approval',
      title: '填写并提交',
      intent: '提交人补充说明后提交。',
      personnelRequirement: { sourceType: 'submitter' },
    }],
  }],
})
assert.equal(branchDiagnostics.length, 1)
assert.equal(branchDiagnostics[0].stepKey, 'branch-submit')

const departmentManagerDiagnostics = validateFlowSchemeSubmissionSteps({
  trigger,
  mainPath: [{
    key: 'step-dept-manager-approval',
    kind: 'approval',
    title: '提交报销单',
    intent: '部门主管审批。',
    personnelRequirement: { sourceType: 'department_manager' },
  }],
})
assert.equal(departmentManagerDiagnostics.length, 0)

const explicitSelfConfirmDiagnostics = validateFlowSchemeSubmissionSteps({
  trigger,
  mainPath: [{
    key: 'step-self-confirm',
    kind: 'approval',
    title: '本人确认',
    intent: '提交人确认报销金额无误。',
    personnelRequirement: { sourceType: 'submitter' },
  }],
})
assert.equal(explicitSelfConfirmDiagnostics.length, 0)

const submitterRoleTitleDiagnostics = validateFlowSchemeSubmissionSteps({
  trigger,
  mainPath: [{
    key: 'step-submitter-confirm',
    kind: 'approval',
    title: '提交人确认',
    intent: '提交人二次确认。',
    personnelRequirement: { sourceType: 'submitter' },
  }],
})
assert.equal(submitterRoleTitleDiagnostics.length, 0)

const submitTriggerWithoutDescriptionDiagnostics = validateFlowSchemeSubmissionSteps({
  trigger: { type: 'submit', description: '' },
  mainPath: [{
    key: 'step-submit',
    kind: 'approval',
    title: '提交报销单',
    intent: '提交人填写并提交报销单。',
    personnelRequirement: { sourceType: 'submitter' },
  }],
})
assert.equal(submitTriggerWithoutDescriptionDiagnostics.length, 1)

assert.equal(
  FLOW_SCHEME_DECISION_CONTRACT_ISSUE_IDS.has('flow-scheme-submission-step-invalid'),
  true,
)

console.log('flow-scheme-submission-step: ok')
