import { APPROVAL_NODE_PERSONNEL_DEFAULTS } from './processNodePersonnelDefaults'

export type FlowSafeDefaultRule = {
  nodeType: 'approval' | 'transact' | 'report-data'
  settingPath: string
  defaultValue: boolean | string
  label?: string
  displayValue?: string
  impact: string
  ruleSource: 'process node default'
  canCreateDraft: true
  canEnable: true
}

export const FLOW_SAFE_DEFAULT_RULES: FlowSafeDefaultRule[] = [
  { nodeType: 'approval', settingPath: 'options.approverSameAsSubmitter', defaultValue: APPROVAL_NODE_PERSONNEL_DEFAULTS.approverSameAsSubmitter, label: '审批人与提交人为同一人时', displayValue: '由提交人自己审批', impact: '可在流程设计的审批节点设置中修改', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'approval', settingPath: 'options.allowTransfer', defaultValue: true, impact: '允许转交审批', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'approval', settingPath: 'options.allowRevert', defaultValue: true, impact: '允许退回审批', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'approval', settingPath: 'options.allowReject', defaultValue: true, impact: '允许驳回审批', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'approval', settingPath: 'options.continueAfterReject', defaultValue: false, impact: '驳回后不继续执行后续节点', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'approval', settingPath: 'options.rollbackDataBeforeReject', defaultValue: false, impact: '驳回前不回滚数据', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'approval', settingPath: 'options.allowStash', defaultValue: false, impact: '不允许暂存审批', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'approval', settingPath: 'options.allowFinishFlow', defaultValue: false, impact: '不允许直接结束流程', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'approval', settingPath: 'options.requireApprovalComments', defaultValue: false, impact: '审批意见可选填', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'transact', settingPath: 'options.allowTransfer', defaultValue: true, impact: '允许转交办理', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'transact', settingPath: 'options.allowRevert', defaultValue: true, impact: '允许退回办理', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'transact', settingPath: 'options.allowStash', defaultValue: false, impact: '不允许暂存办理', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'transact', settingPath: 'options.allowFinishFlow', defaultValue: false, impact: '不允许直接结束流程', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'transact', settingPath: 'options.requireTransactComments', defaultValue: false, impact: '办理意见可选填', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'transact', settingPath: 'options.requireSatisfyCondition', defaultValue: false, impact: '办理完成不要求额外条件', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'report-data', settingPath: 'options.allowStash', defaultValue: false, impact: '不允许暂存填报', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'report-data', settingPath: 'options.allowFinishFlow', defaultValue: false, impact: '不允许从填报节点直接结束流程', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'report-data', settingPath: 'options.requireTransactComments', defaultValue: true, impact: '填报意见必填', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
  { nodeType: 'report-data', settingPath: 'options.requireSatisfyCondition', defaultValue: false, impact: '填报完成不要求额外条件', ruleSource: 'process node default', canCreateDraft: true, canEnable: true },
]

export const findFlowSafeDefaultRule = (nodeType: string, settingPath: string) => (
  FLOW_SAFE_DEFAULT_RULES.find(rule => rule.nodeType === nodeType && rule.settingPath === settingPath)
)
