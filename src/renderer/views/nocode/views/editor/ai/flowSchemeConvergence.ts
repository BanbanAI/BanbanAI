import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeConvergence,
  NocodeEditorFlowSchemeDeferredConfigItem,
  NocodeEditorFlowSchemeDependency,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  buildFlowGroundingConvergenceResultSummary,
  buildFlowSchemeDependencyFromGroundingDiagnostic as buildSharedFlowSchemeDependencyFromGroundingDiagnostic,
  isPlannedFlowSchemeDependency,
  type NocodeEditorFlowSchemeGroundingDiagnostic,
} from '@common/utils/nocodeEditorFlowSchemeGrounding'
import type {
  NocodeEditorAiFlowActionIssue,
  NocodeEditorAiFlowIssueState,
} from './types'

type DeferredIssueCatalogItem = {
  category: NocodeEditorFlowSchemeDeferredConfigItem['category']
  severity: NocodeEditorFlowSchemeDeferredConfigItem['severity']
  summary: (issue: NocodeEditorAiFlowActionIssue) => string
}

export type FlowSchemeConvergenceGroundingDiagnostic = NocodeEditorFlowSchemeGroundingDiagnostic

const normalizeText = (value: unknown) => String(value ?? '').trim()

const REQUIRED_DEFERRED_ISSUE_CATALOG: Record<string, DeferredIssueCatalogItem> = {
  approval_approver_missing: {
    category: 'owner_binding',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '审批节点'}的审批人待补齐`,
  },
  approval_same_as_submitter_missing: {
    category: 'advanced_option',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '审批节点'}的同人处理策略待补齐`,
  },
  approval_empty_handler_user_missing: {
    category: 'fallback_handler',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '审批节点'}的空审批人兜底对象待补齐`,
  },
  approval_empty_handler_admin_missing: {
    category: 'fallback_handler',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '审批节点'}的空审批人管理员待补齐`,
  },
  approval_revert_range_missing: {
    category: 'advanced_option',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '审批节点'}的退回范围待补齐`,
  },
  transact_transactor_missing: {
    category: 'owner_binding',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '办理节点'}的办理人待补齐`,
  },
  transact_empty_handler_missing: {
    category: 'fallback_handler',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '办理节点'}的空办理人处理待补齐`,
  },
  transact_empty_handler_user_missing: {
    category: 'fallback_handler',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '办理节点'}的空办理人兜底对象待补齐`,
  },
  transact_empty_handler_admin_missing: {
    category: 'fallback_handler',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '办理节点'}的空办理人管理员待补齐`,
  },
  transact_revert_range_missing: {
    category: 'advanced_option',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '办理节点'}的退回范围待补齐`,
  },
  transact_finish_condition_missing: {
    category: 'condition_detail',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '办理节点'}的完成条件待补齐`,
  },
  notify_notifier_missing: {
    category: 'owner_binding',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '通知节点'}的通知对象待补齐`,
  },
  report_data_target_form_missing: {
    category: 'data_target',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '填报节点'}的目标表单待补齐`,
  },
  report_data_reporter_missing: {
    category: 'owner_binding',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '填报节点'}的填报人待补齐`,
  },
  report_data_reporter_empty_user_missing: {
    category: 'fallback_handler',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '填报节点'}的空填报人兜底对象待补齐`,
  },
  report_data_reporter_empty_admin_missing: {
    category: 'fallback_handler',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '填报节点'}的空填报人管理员待补齐`,
  },
  report_data_finish_condition_missing: {
    category: 'condition_detail',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '填报节点'}的完成条件待补齐`,
  },
  add_data_target_form_missing: {
    category: 'data_target',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '新增数据节点'}的目标表单待补齐`,
  },
  add_data_mapping_missing: {
    category: 'field_mapping',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '新增数据节点'}的字段映射待补齐`,
  },
  add_data_batch_count_missing: {
    category: 'advanced_option',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '新增数据节点'}的批量数量待补齐`,
  },
  edit_data_target_form_missing: {
    category: 'data_target',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '更新数据节点'}的目标表单待补齐`,
  },
  edit_data_mapping_missing: {
    category: 'field_mapping',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '更新数据节点'}的字段映射待补齐`,
  },
  delete_data_target_form_missing: {
    category: 'data_target',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '删除数据节点'}的目标表单待补齐`,
  },
  delete_data_filter_missing: {
    category: 'condition_detail',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '删除数据节点'}的删除条件待补齐`,
  },
  branch_condition_missing: {
    category: 'condition_detail',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '条件分支'}的分支条件待补齐`,
  },
  trigger_data_change_event_missing: {
    category: 'advanced_option',
    severity: 'medium',
    summary: issue => `${issue.targetLabel || '触发节点'}的数据变化类型待补齐`,
  },
  trigger_time_task_schedule_missing: {
    category: 'schedule_detail',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '定时触发'}的定时规则待补齐`,
  },
  trigger_time_task_basic_incomplete: {
    category: 'schedule_detail',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '定时触发'}的基础定时规则待补齐`,
  },
  trigger_time_task_advanced_incomplete: {
    category: 'schedule_detail',
    severity: 'high',
    summary: issue => `${issue.targetLabel || '定时触发'}的高级定时规则待补齐`,
  },
}

const NEEDS_RUNTIME_SUPPORT_ISSUE_CODES = new Set([
  'approval_revert_range_missing',
  'transact_revert_range_missing',
  'transact_finish_condition_missing',
  'report_data_finish_condition_missing',
])

const dedupeBy = <T,>(items: T[], getKey: (item: T) => string) => {
  const result: T[] = []
  const seen = new Set<string>()
  items.forEach((item) => {
    const key = getKey(item)
    if (!key || seen.has(key)) {
      return
    }
    seen.add(key)
    result.push(item)
  })
  return result
}

const getDependencyDedupeKey = (
  item: NocodeEditorFlowSchemeDependency,
) => [
  normalizeText(item.kind),
  normalizeText(item.requiredFor),
  normalizeText(item.scopeKind),
  normalizeText(item.scopeKey),
  normalizeText(item.targetFormId),
  normalizeText(item.targetFormName),
  normalizeText(item.fieldRef?.fieldId),
  normalizeText(item.fieldRef?.fieldName),
  normalizeText(item.summary),
].join('|')

const isPersonnelAssessmentDependency = (
  item: NocodeEditorFlowSchemeDependency,
) => normalizeText(item.id).startsWith('flow-personnel:')

const mergeDerivedDependenciesWithPreservedPlanned = (input: {
  scheme: NocodeEditorFlowScheme
  derivedDependencies: NocodeEditorFlowSchemeDependency[]
}) => {
  const existingDependencies = Array.isArray(input.scheme.dependencies)
    ? input.scheme.dependencies
    : []
  const preservedDependencies = existingDependencies.filter(item => (
    isPlannedFlowSchemeDependency(item)
    || isPersonnelAssessmentDependency(item)
  ))

  return dedupeBy(
    [...preservedDependencies, ...input.derivedDependencies],
    getDependencyDedupeKey,
  )
}

const normalizeRelatedIssueCodes = (values?: string[] | null) => Array.from(new Set(
  (values || []).map(item => normalizeText(item)).filter(Boolean),
)).sort()

const getDeferredConfigDedupeKey = (
  item: NocodeEditorFlowSchemeDeferredConfigItem,
) => [
  normalizeText(item.nodeKey),
  normalizeRelatedIssueCodes(item.relatedIssueCodes).join(','),
  normalizeText(item.category),
].join('|')

const isPersonnelAssessmentDeferredConfigItem = (
  item: NocodeEditorFlowSchemeDeferredConfigItem,
) => normalizeText(item.id).startsWith('flow-deferred:personnel:')

const isRuntimeDerivedDeferredConfigItem = (
  item: NocodeEditorFlowSchemeDeferredConfigItem,
) => (
  !isPersonnelAssessmentDeferredConfigItem(item)
  && normalizeRelatedIssueCodes(item.relatedIssueCodes).some(code => (
    Boolean(REQUIRED_DEFERRED_ISSUE_CATALOG[normalizeText(code)])
  ))
)

export const mergeDeferredConfigItems = (input: {
  existingItems?: NocodeEditorFlowSchemeDeferredConfigItem[] | null
  incomingItems?: NocodeEditorFlowSchemeDeferredConfigItem[] | null
  mode?: 'preserve' | 'runtime-reconcile'
}) => {
  const existingItems = Array.isArray(input.existingItems) ? input.existingItems : []
  const incomingItems = Array.isArray(input.incomingItems) ? input.incomingItems : []
  const incomingKeys = new Set(incomingItems.map(item => getDeferredConfigDedupeKey(item)))
  const preservedItems = input.mode === 'runtime-reconcile'
    ? existingItems.filter((item) => {
      if (isPersonnelAssessmentDeferredConfigItem(item)) {
        return incomingKeys.has(getDeferredConfigDedupeKey(item))
      }
      return !isRuntimeDerivedDeferredConfigItem(item)
    })
    : existingItems
  const result: NocodeEditorFlowSchemeDeferredConfigItem[] = []
  const indexesByKey = new Map<string, number>()
  const mergedItems = [...preservedItems, ...incomingItems]

  mergedItems.forEach((item) => {
    const normalizedItem = Array.isArray(item.relatedIssueCodes)
      ? { ...item, relatedIssueCodes: normalizeRelatedIssueCodes(item.relatedIssueCodes) }
      : item
    const key = getDeferredConfigDedupeKey(normalizedItem)
    const existingIndex = indexesByKey.get(key)
    if (existingIndex == null) {
      indexesByKey.set(key, result.length)
      result.push(normalizedItem)
      return
    }

    const existingItem = result[existingIndex]
    if (
      isPersonnelAssessmentDeferredConfigItem(existingItem)
      && !isPersonnelAssessmentDeferredConfigItem(normalizedItem)
    ) {
      return
    }
    result[existingIndex] = {
      ...normalizedItem,
      relatedIssueCodes: normalizeRelatedIssueCodes([
        ...(existingItem.relatedIssueCodes || []),
        ...(normalizedItem.relatedIssueCodes || []),
      ]),
    }
  })

  return result
}

export const buildFlowSchemeDeferredConfigItemFromIssue = (
  issue: NocodeEditorAiFlowActionIssue,
): NocodeEditorFlowSchemeDeferredConfigItem | null => {
  const code = normalizeText(issue.code)
  const catalog = REQUIRED_DEFERRED_ISSUE_CATALOG[code]
  if (!catalog) {
    return null
  }

  return {
    id: `flow-deferred:${normalizeText(issue.id) || code}`,
    nodeKey: normalizeText(issue.schemeNodeKey || issue.targetId) || undefined,
    nodeTitle: normalizeText(issue.fieldLabel || issue.displayMessage || issue.targetLabel) || undefined,
    category: catalog.category,
    requirementLevel: 'required',
    supportStatus: NEEDS_RUNTIME_SUPPORT_ISSUE_CODES.has(code)
      ? 'needs_runtime_support'
      : 'runtime_supported',
    summary: normalizeText(issue.displayMessage) || catalog.summary(issue),
    fillTiming: 'after_generation',
    severity: catalog.severity,
    relatedIssueCodes: [code],
  }
}

export const buildFlowSchemeDependencyFromGroundingDiagnostic = buildSharedFlowSchemeDependencyFromGroundingDiagnostic

const countPendingConfirmationQuestions = (scheme: NocodeEditorFlowScheme) => {
  const questions = Array.isArray(scheme.confirmation?.questions)
    ? scheme.confirmation?.questions || []
    : []
  return questions.filter(question => question && question.confirmed !== true).length
}

const buildConvergence = (
  scheme: NocodeEditorFlowScheme,
  dependencies: NocodeEditorFlowSchemeDependency[] | undefined,
  deferredConfigItems: NocodeEditorFlowSchemeDeferredConfigItem[] | undefined,
): NocodeEditorFlowSchemeConvergence => {
  const dependencyList = Array.isArray(dependencies) ? dependencies : []
  const deferredList = Array.isArray(deferredConfigItems) ? deferredConfigItems : []
  const unresolvedQuestionCount = Math.max(
    Array.isArray(scheme.openQuestions) ? scheme.openQuestions.length : 0,
    countPendingConfirmationQuestions(scheme),
  )
  const unresolvedDependencyCount = dependencyList.filter(item => item.resolutionStatus !== 'resolved').length
  const plannedDependencyCount = dependencyList.filter(item => isPlannedFlowSchemeDependency(item)).length
  const requiredDeferredConfigCount = deferredList.filter(item => item.requirementLevel === 'required').length
  const optionalDeferredConfigCount = deferredList.filter(item => item.requirementLevel === 'optional').length

  return {
    businessStatus: unresolvedQuestionCount > 0 ? 'pending' : 'resolved',
    dependencyStatus: unresolvedDependencyCount > 0 ? 'pending' : 'resolved',
    materializationStatus: dependencyList.some(item => isPlannedFlowSchemeDependency(item))
      ? 'has_planned_dependencies'
      : 'all_existing',
    unresolvedQuestionCount,
    unresolvedDependencyCount,
    plannedDependencyCount,
    requiredDeferredConfigCount,
    optionalDeferredConfigCount,
    deferredConfigItemCount: deferredList.length,
  }
}

export const decorateFlowSchemeWithConvergence = (input: {
  scheme: NocodeEditorFlowScheme
  flowIssueState?: NocodeEditorAiFlowIssueState | null
  groundingDiagnostics?: FlowSchemeConvergenceGroundingDiagnostic[]
  deriveDependencies?: boolean
  deriveDeferredConfigItems?: boolean
}) => {
  const shouldDeriveDependencies = input.deriveDependencies ?? input.groundingDiagnostics !== undefined
  const shouldDeriveDeferredConfigItems = input.deriveDeferredConfigItems ?? input.flowIssueState !== undefined

  const derivedDeferredConfigItems = dedupeBy(
    ((input.flowIssueState?.actionIssues || []) as NocodeEditorAiFlowActionIssue[])
      .flatMap((issue) => {
        const normalized = buildFlowSchemeDeferredConfigItemFromIssue(issue)
        return normalized ? [normalized] : []
      }),
    item => [
      normalizeText(item.relatedIssueCodes?.[0]),
      normalizeText(item.nodeKey),
      normalizeText(item.nodeTitle),
      normalizeText(item.summary),
    ].join('|'),
  )

  const derivedDependencies = dedupeBy(
    ((input.groundingDiagnostics || []) as FlowSchemeConvergenceGroundingDiagnostic[])
      .flatMap((diagnostic) => {
        const normalized = buildFlowSchemeDependencyFromGroundingDiagnostic(diagnostic)
        return normalized ? [normalized] : []
      }),
    getDependencyDedupeKey,
  )

  const dependencies = shouldDeriveDependencies
    ? mergeDerivedDependenciesWithPreservedPlanned({
      scheme: input.scheme,
      derivedDependencies,
    })
    : input.scheme.dependencies
  const deferredConfigItems = shouldDeriveDeferredConfigItems
    ? mergeDeferredConfigItems({
      existingItems: input.scheme.deferredConfigItems,
      incomingItems: derivedDeferredConfigItems,
      mode: 'runtime-reconcile',
    })
    : input.scheme.deferredConfigItems
  const convergence = shouldDeriveDependencies
    || shouldDeriveDeferredConfigItems
    || input.scheme.convergence == null
    ? buildConvergence(input.scheme, dependencies, deferredConfigItems)
    : input.scheme.convergence

  return {
    ...input.scheme,
    dependencies,
    deferredConfigItems,
    convergence,
  }
}

export const buildFlowSchemeConvergenceResultSummary = (
  scheme: NocodeEditorFlowScheme,
) => {
  const dependencies = Array.isArray(scheme.dependencies) ? scheme.dependencies : []
  const requiredDeferred = Array.isArray(scheme.deferredConfigItems)
    ? scheme.deferredConfigItems.filter(item => item.requirementLevel === 'required')
    : []
  const optionalDeferred = Array.isArray(scheme.deferredConfigItems)
    ? scheme.deferredConfigItems.filter(item => item.requirementLevel === 'optional')
    : []

  return buildFlowGroundingConvergenceResultSummary({
    dependencies,
    requiredDeferredConfigItems: requiredDeferred,
    optionalDeferredConfigItems: optionalDeferred,
    resolved: scheme.convergence?.businessStatus === 'resolved' && scheme.convergence?.dependencyStatus === 'resolved',
  })
}
