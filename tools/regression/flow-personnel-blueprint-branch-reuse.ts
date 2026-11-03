import assert from 'node:assert/strict'

import type { NocodeEditorFlowPlan } from '../../src/common/utils/nocodeEditorFlowPlan'
import type { NocodeEditorFlowScheme } from '../../src/common/utils/nocodeEditorFlowScheme'
import {
  validateFlowBlueprintPersonnelRequirements,
} from '../../src/renderer/views/nocode/views/editor/ai/flowPersonnelBlueprintPreflight'

const asScheme = (value: Record<string, unknown>) => value as unknown as NocodeEditorFlowScheme
const asPlan = (value: Record<string, unknown>) => value as unknown as NocodeEditorFlowPlan

const departmentApprovalNode = (nodeKey: string, name = '部门主管审批') => ({
  nodeKey,
  type: 'approval',
  name,
  options: {
    approver: {
      'department-manager': { mode: 'up', level: 1 },
    },
  },
})

// 方案只有一个审批步骤，但蓝图按业务事实拆成两条触发分支，各放一个同来源审批节点：
// 同一条方案步骤允许被不同分支复用。
const singleApprovalScheme = asScheme({
  id: 'flow-scheme-project-001',
  title: '项目管理表流程',
  summary: '立项与结项都要部门主管审批',
  trigger: { type: 'submit', description: '提交后自动发起' },
  mainPath: [{
    key: 'step-approval',
    kind: 'approval',
    title: '部门主管审批',
    intent: '部门主管审批',
    personnelRequirement: {
      sourceType: 'department_manager',
      departmentManager: { mode: 'up', level: 1 },
    },
  }],
  branches: [],
  confirmation: { stage: 'flow-scheme', status: 'completed', questions: [] },
})

const crossBranchPlan = asPlan({
  id: 'flow-plan-project-001',
  title: '项目管理表流程',
  summary: '立项与结项都要部门主管审批',
  target: { formId: 'tbl_project', formName: '项目管理表' },
  triggerBranches: [
    {
      branchKey: 'branch-setup',
      label: '立项',
      triggerNode: { nodeKey: 'trigger-setup', type: 'trigger-operation', name: '立项' },
      nodes: [departmentApprovalNode('step-approval-setup')],
    },
    {
      branchKey: 'branch-close',
      label: '结项',
      triggerNode: { nodeKey: 'trigger-close', type: 'trigger-operation', name: '结项' },
      nodes: [departmentApprovalNode('step-approval-close')],
    },
  ],
  openQuestions: [],
})

const crossBranchResult = validateFlowBlueprintPersonnelRequirements({
  plan: crossBranchPlan,
  scheme: singleApprovalScheme,
})
assert.deepEqual(crossBranchResult.diagnostics, [])

// 同一分支内出现两个审批节点仍然是重复节点：只有跨分支才允许复用。
const sameBranchPlan = asPlan({
  id: 'flow-plan-project-002',
  title: '项目管理表流程',
  summary: '立项同一分支两个审批',
  target: { formId: 'tbl_project', formName: '项目管理表' },
  triggerBranches: [
    {
      branchKey: 'branch-setup',
      label: '立项',
      triggerNode: { nodeKey: 'trigger-setup', type: 'trigger-operation', name: '立项' },
      nodes: [
        departmentApprovalNode('step-approval-setup-a'),
        departmentApprovalNode('step-approval-setup-b'),
      ],
    },
  ],
  openQuestions: [],
})

const sameBranchResult = validateFlowBlueprintPersonnelRequirements({
  plan: sameBranchPlan,
  scheme: singleApprovalScheme,
})
assert.equal(
  sameBranchResult.diagnostics.some(item => item.code === 'flow_personnel_source_mismatch'),
  true,
)

console.log('flow-personnel-blueprint-branch-reuse: ok')
