import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
} from './nocodeEditorFlowScheme'

export type NocodeEditorFlowGroundingOwnerUsage =
  | 'approval_owner'
  | 'notify_target'
  | 'handler'
  | 'reporter'
  | 'generic_owner'

export const isNocodeEditorFlowGroundingOwnerUsage = (
  value: unknown,
): value is NocodeEditorFlowGroundingOwnerUsage => (
  value === 'approval_owner'
  || value === 'notify_target'
  || value === 'handler'
  || value === 'reporter'
  || value === 'generic_owner'
)

export type CompatibleField = {
  fieldId: string
  fieldName: string
  ownerPolicy?: string
  matchReason?: string
}

export type NocodeEditorFlowGroundingCompatibleField = CompatibleField

export type NocodeEditorFlowSchemeGroundingDiagnostic = {
  code: string
  message?: string
  nodeKey?: string
  nodeName?: string
  branchKey?: string
  branchLabel?: string
  targetFormId?: string
  targetFormName?: string
  fieldRef?: {
    fieldId?: string
    fieldName?: string
    expectedType?: string
  }
  ownerUsage?: NocodeEditorFlowGroundingOwnerUsage
  compatibleFields?: CompatibleField[]
  candidateCount?: number
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

export const isPlannedFlowSchemeDependency = (
  dependency?: Pick<NocodeEditorFlowSchemeDependency, 'resolutionStatus' | 'resolutionMode' | 'materializationStatus'> | null,
) => (
  dependency?.resolutionStatus === 'resolved'
  && dependency?.resolutionMode === 'create_later'
  && dependency?.materializationStatus === 'planned'
)

export const resolveFlowSchemeGroundingDependencyScope = (
  diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic,
): Pick<NocodeEditorFlowSchemeDependency, 'scopeKind' | 'scopeKey' | 'scopeTitle'> => {
  const nodeKey = normalizeText(diagnostic.nodeKey)
  if (nodeKey) {
    return {
      scopeKind: 'step',
      scopeKey: nodeKey,
      scopeTitle: normalizeText(diagnostic.nodeName) || undefined,
    }
  }

  const branchKey = normalizeText(diagnostic.branchKey)
  if (branchKey) {
    return {
      scopeKind: 'branch',
      scopeKey: branchKey,
      scopeTitle: normalizeText(diagnostic.branchLabel) || undefined,
    }
  }

  return {
    scopeKind: 'global',
    scopeKey: undefined,
    scopeTitle: undefined,
  }
}

export const resolveFlowSchemeGroundingOwnerUsageLabel = (
  diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic,
) => {
  const message = normalizeText(diagnostic.message)
  const missingMatch = message.match(/可作为(.+?)的字段/u)
  if (missingMatch?.[1]) {
    return missingMatch[1]
  }

  const forbiddenMatch = message.match(/不能作为(.+?)（/u)
  if (forbiddenMatch?.[1]) {
    return forbiddenMatch[1]
  }

  return ''
}

const buildOwnerGroundingDependency = (
  diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic,
  base: Omit<NocodeEditorFlowSchemeDependency, 'kind' | 'requiredFor' | 'summary'>,
  code: string,
): NocodeEditorFlowSchemeDependency => {
  const kind = code.includes('forbidden') ? 'field_policy_mismatch' : 'field_missing'
  switch (diagnostic.ownerUsage) {
  case 'approval_owner':
    return {
      ...base,
      kind,
      requiredFor: 'approval_owner',
      summary: '审批人来源字段',
    }
  case 'notify_target':
    return {
      ...base,
      kind,
      requiredFor: 'notify_target',
      summary: '通知对象来源字段',
    }
  case 'handler':
    return {
      ...base,
      kind,
      requiredFor: 'owner_binding',
      summary: '办理人来源字段',
    }
  case 'reporter':
    return {
      ...base,
      kind,
      requiredFor: 'owner_binding',
      summary: '填报人来源字段',
    }
  case 'generic_owner':
    return {
      ...base,
      kind,
      requiredFor: 'owner_binding',
      summary: '处理人来源字段',
    }
  default:
    break
  }

  const usageLabel = resolveFlowSchemeGroundingOwnerUsageLabel(diagnostic)
  if (usageLabel.includes('审批人')) {
    return {
      ...base,
      kind,
      requiredFor: 'approval_owner',
      summary: '审批人来源字段',
    }
  }

  if (usageLabel.includes('通知对象')) {
    return {
      ...base,
      kind,
      requiredFor: 'notify_target',
      summary: '通知对象来源字段',
    }
  }

  if (usageLabel.includes('办理人')) {
    return {
      ...base,
      kind,
      requiredFor: 'owner_binding',
      summary: '办理人来源字段',
    }
  }

  if (usageLabel.includes('填报人')) {
    return {
      ...base,
      kind,
      requiredFor: 'owner_binding',
      summary: '填报人来源字段',
    }
  }

  return {
    ...base,
    kind,
    requiredFor: 'owner_binding',
    summary: '负责人来源字段',
  }
}

export const buildFlowSchemeDependencyFromGroundingDiagnostic = (
  diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic,
): NocodeEditorFlowSchemeDependency | null => {
  const code = normalizeText(diagnostic.code)
  if (!code) {
    return null
  }

  const scope = resolveFlowSchemeGroundingDependencyScope(diagnostic)
  const fieldIdentity = normalizeText(
    diagnostic.fieldRef?.fieldId || diagnostic.fieldRef?.fieldName,
  ).toLowerCase()
  const targetFormIdentity = normalizeText(
    diagnostic.targetFormId || diagnostic.targetFormName,
  ).toLowerCase()
  const base = {
    id: `flow-dependency:${code}:${scope.scopeKey || 'global'}:${encodeURIComponent(targetFormIdentity || 'form')}:${encodeURIComponent(fieldIdentity || 'field')}`,
    scopeKind: scope.scopeKind,
    scopeKey: scope.scopeKey,
    scopeTitle: scope.scopeTitle,
    targetFormId: normalizeText(diagnostic.targetFormId) || undefined,
    targetFormName: normalizeText(diagnostic.targetFormName) || undefined,
    riskLevel: 'high' as const,
    resolutionStatus: 'unresolved' as const,
    materializationStatus: 'not_available' as const,
    fieldRef: diagnostic.fieldRef,
  }

  if (code.includes('owner')) {
    return buildOwnerGroundingDependency(diagnostic, base, code)
  }

  if (code.includes('condition')) {
    return {
      ...base,
      kind: code.includes('forbidden') ? 'field_policy_mismatch' : 'field_missing',
      requiredFor: 'condition',
      summary: '流程条件字段或条件能力',
    }
  }

  if (code.includes('source_table')) {
    return {
      ...base,
      kind: 'source_table_missing',
      requiredFor: 'source_mapping',
      summary: '来源表单映射',
    }
  }

  if (code.includes('source_field')) {
    return {
      ...base,
      kind: code.includes('conflict') ? 'mapping_conflict' : 'field_missing',
      requiredFor: 'source_mapping',
      summary: '来源字段映射',
    }
  }

  if (code.includes('write')) {
    return {
      ...base,
      kind: code.includes('forbidden') ? 'field_policy_mismatch' : 'field_missing',
      requiredFor: 'writeback',
      summary: '流程回写字段',
    }
  }

  return null
}

export const buildFlowGroundingConvergenceResultSummary = (input: {
  dependencies?: Array<Pick<NocodeEditorFlowSchemeDependency, 'summary' | 'resolutionStatus' | 'resolutionMode' | 'materializationStatus'>>
  requiredDeferredConfigItems?: Array<Pick<NonNullable<NocodeEditorFlowScheme['deferredConfigItems']>[number], 'nodeTitle' | 'summary'>>
  optionalDeferredConfigItems?: Array<Pick<NonNullable<NocodeEditorFlowScheme['deferredConfigItems']>[number], 'nodeTitle' | 'summary'>>
  deferredConfigItemCount?: number
  resolved?: boolean
}) => {
  const lines: string[] = []
  const dependencies = Array.isArray(input.dependencies) ? input.dependencies : []
  const unresolvedDependencies = dependencies.filter(item => item.resolutionStatus !== 'resolved')
  const plannedDependencies = dependencies.filter(item => isPlannedFlowSchemeDependency(item))
  const requiredDeferred = Array.isArray(input.requiredDeferredConfigItems)
    ? input.requiredDeferredConfigItems
    : []
  const optionalDeferred = Array.isArray(input.optionalDeferredConfigItems)
    ? input.optionalDeferredConfigItems
    : []

  if (unresolvedDependencies.length > 0) {
    lines.push(`已识别 ${unresolvedDependencies.length} 项待收敛依赖：${unresolvedDependencies.slice(0, 2).map(item => item.summary).join('、')}`)
  }

  if (plannedDependencies.length > 0) {
    lines.push(`已确认 ${plannedDependencies.length} 项依赖将在后续补齐后落地：${plannedDependencies.slice(0, 2).map(item => item.summary).join('、')}`)
  }

  if (requiredDeferred.length > 0) {
    lines.push(`生成后必须补齐 ${requiredDeferred.length} 项配置：${requiredDeferred.slice(0, 3).map(item => item.nodeTitle || item.summary).join('、')}`)
  }

  if (optionalDeferred.length > 0) {
    lines.push(`生成后可继续完善 ${optionalDeferred.length} 项配置：${optionalDeferred.slice(0, 3).map(item => item.nodeTitle || item.summary).join('、')}`)
  }

  const deferredConfigItemCount = Number(input.deferredConfigItemCount || 0)
  if (!requiredDeferred.length && !optionalDeferred.length && deferredConfigItemCount > 0) {
    lines.push(`生成后还需补齐 ${deferredConfigItemCount} 项配置。`)
  }

  if (!lines.length && input.resolved) {
    lines.push('当前流程规划的业务问题与依赖问题都已收敛。')
  }

  return lines
}
