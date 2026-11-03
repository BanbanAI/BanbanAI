import type { NocodeEditorFlowScheme } from './nocodeEditorFlowScheme'

type DeferredCapability = {
  stepKind: string
  category: string
  settingPath: string
}

const DEFERRED_CAPABILITIES: DeferredCapability[] = [
  { stepKind: 'approval', category: 'owner_binding', settingPath: 'options.approver' },
  // The scheme may describe the approver-source sub-configuration explicitly;
  // it is still materialized through the approval owner contract.
  { stepKind: 'approval', category: 'owner_binding', settingPath: 'options.approver.assignee' },
  { stepKind: 'approval', category: 'owner_binding', settingPath: 'options.approver.form-member' },
  { stepKind: 'approval', category: 'owner_binding', settingPath: 'options.approver.form-department' },
  { stepKind: 'approval', category: 'owner_binding', settingPath: 'options.approver.department-manager' },
  { stepKind: 'transact', category: 'owner_binding', settingPath: 'options.transactor' },
  { stepKind: 'notify', category: 'owner_binding', settingPath: 'options.notifier' },
  { stepKind: 'report-data', category: 'owner_binding', settingPath: 'options.reporter' },
  { stepKind: 'approval', category: 'advanced_option', settingPath: 'options.approverSameAsSubmitter' },
  { stepKind: 'approval', category: 'fallback_handler', settingPath: 'options.emptyHandler' },
  { stepKind: 'transact', category: 'fallback_handler', settingPath: 'options.emptyHandler' },
  { stepKind: 'report-data', category: 'fallback_handler', settingPath: 'options.emptyHandler' },
  { stepKind: 'approval', category: 'notification_detail', settingPath: 'options.messagePush' },
  { stepKind: 'transact', category: 'notification_detail', settingPath: 'options.messagePush' },
  { stepKind: 'notify', category: 'notification_detail', settingPath: 'options.messagePush' },
  { stepKind: 'report-data', category: 'notification_detail', settingPath: 'options.messagePush' },
]

// 前缀兜底白名单：settingPath 精确未登记时，若它扩展自某个已登记三元组
// （stepKind/category 一致），且扩展出的第一段路径片段在白名单内，则视为能力成立。
const DEFERRED_CAPABILITY_SUBPATH_WHITELIST: Record<string, string[]> = {
  'options.approver': [
    'assignee', 'form-member', 'form_member', 'form-department', 'form_department',
    'member', 'department', 'department-manager', 'department_manager', 'departmentManager',
    'submitter_manager', 'submitter-manager', 'level', 'levels', 'multi-level', 'multi_level',
  ],
  'options.transactor': [
    'assignee', 'form-member', 'form_member', 'member',
    'fixed-users', 'fixed_users', 'fixed-roles', 'fixed_roles',
  ],
  'options.notifier': ['assignee', 'form-member', 'form_member', 'member', 'fixed-users', 'fixed_users'],
  'options.reporter': ['assignee', 'form-member', 'form_member', 'member', 'fixed-users', 'fixed_users'],
  'options.emptyHandler': ['admin', 'fixed-users', 'fixed_users'],
}

const getSteps = (scheme: NocodeEditorFlowScheme) => [
  ...(scheme.mainPath || []),
  ...(scheme.branches || []).flatMap(branch => branch.steps || []),
]

const findExactDeferredCapability = (input: {
  stepKind: string
  category: string
  settingPath: string
}) => DEFERRED_CAPABILITIES.find(capability => (
  capability.stepKind === input.stepKind
  && capability.category === input.category
  && capability.settingPath === input.settingPath
)) || null

const findPrefixWhitelistedDeferredCapability = (input: {
  stepKind: string
  category: string
  settingPath: string
}) => {
  const base = DEFERRED_CAPABILITIES.find(capability => (
    capability.stepKind === input.stepKind
    && capability.category === input.category
    && input.settingPath.startsWith(`${capability.settingPath}.`)
  ))
  if (!base) {
    return null
  }
  const firstSegment = input.settingPath.slice(base.settingPath.length + 1).split('.')[0]
  const whitelist = DEFERRED_CAPABILITY_SUBPATH_WHITELIST[base.settingPath] || []
  if (!whitelist.includes(firstSegment)) {
    return null
  }
  console.warn('[flow-deferred-capability] settingPath 未精确登记，按前缀+白名单放行', {
    stepKind: input.stepKind,
    category: input.category,
    settingPath: input.settingPath,
    basePath: base.settingPath,
  })
  return { ...base, settingPath: input.settingPath }
}

export const findFlowDeferredCapability = (input: {
  scheme: NocodeEditorFlowScheme
  nodeKey?: string
  category: string
  settingPath?: string
}) => {
  const nodeKey = String(input.nodeKey || '').trim()
  const settingPath = String(input.settingPath || '').trim()
  if (!nodeKey || !settingPath) return null
  const step = getSteps(input.scheme).find(item => item.key === nodeKey)
  if (!step) return null
  const capabilityInput = {
    stepKind: step.kind,
    category: input.category,
    settingPath,
  }
  return findExactDeferredCapability(capabilityInput)
    || findPrefixWhitelistedDeferredCapability(capabilityInput)
    || null
}
