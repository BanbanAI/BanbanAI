import type {
  NocodeEditorFormulaApplyResult,
  NocodeEditorFormulaTargetResult,
} from '@common/types/nocodeEditorFormula'
import type { NocodeEditorFlowScheme } from '@common/utils/nocodeEditorFlowScheme'
import type { NocodeEditorPlanningScope } from '@common/utils/nocodeEditorPlanningScope'
import type {
  NocodeEditorPostFormFlowReleaseDependency,
  NocodeEditorPostFormFlowReleaseIssue,
} from '@common/utils/nocodeEditorPostFormFlowRelease'

import type {
  NocodeEditorAiBlueprintFieldBinding,
  NocodeEditorAiBlueprintFormulaSummary,
  NocodeEditorAiDraftPersistenceState,
} from './types'

export type FormulaTargetResultLike = Partial<NocodeEditorFormulaTargetResult> & {
  status?: NocodeEditorFormulaTargetResult['status'] | string
}

const normalizeText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/[\s\-_/\\]+/g, '')
  .replace(/[^\p{Letter}\p{Number}]/gu, '')

const buildFormulaTargetIdentityKeys = (value: {
  targetFormId?: unknown
  targetFormName?: unknown
  targetFieldId?: unknown
  targetFieldKey?: unknown
  targetFieldName?: unknown
  tableId?: unknown
  tableName?: unknown
  widgetId?: unknown
  fieldKey?: unknown
  fieldName?: unknown
}) => {
  const formIdentity = normalizeToken(
    value.targetFormId || value.tableId || value.targetFormName || value.tableName || 'form',
  )
  const fieldId = normalizeText(value.targetFieldId || value.widgetId)
  const fieldKey = normalizeToken(value.targetFieldKey || value.fieldKey)
  const fieldName = normalizeToken(value.targetFieldName || value.fieldName)
  return [
    fieldId ? `${formIdentity}:id:${fieldId}` : '',
    fieldKey ? `${formIdentity}:key:${fieldKey}` : '',
    fieldName ? `${formIdentity}:name:${fieldName}` : '',
  ].filter(Boolean)
}

const buildFormulaTargetPrimaryIdentity = (value: FormulaTargetResultLike) => (
  buildFormulaTargetIdentityKeys(value)[0]
  || `item:${normalizeText(value.itemKey)}`
)

export const normalizeLatestFormulaTargetResults = (
  values: FormulaTargetResultLike[],
) => {
  const latestByIdentity = new Map<string, FormulaTargetResultLike>()
  values.forEach((value, index) => {
    const status = normalizeText(value.status)
    if (!['updated', 'draft', 'skipped', 'failed'].includes(status)) {
      return
    }
    const normalized = {
      ...value,
      status,
      tableId: normalizeText(value.tableId) || undefined,
      tableName: normalizeText(value.tableName) || undefined,
      widgetId: normalizeText(value.widgetId) || undefined,
      fieldName: normalizeText(value.fieldName) || undefined,
      reason: normalizeText(value.reason) || undefined,
    }
    const identity = buildFormulaTargetPrimaryIdentity(normalized) || `formula-target:${index}`
    latestByIdentity.set(identity, normalized)
  })
  return [...latestByIdentity.values()]
}

const buildUniqueBindingByFieldKey = (
  bindings: NocodeEditorAiBlueprintFieldBinding[] = [],
) => {
  const candidatesByFieldKey = new Map<string, NocodeEditorAiBlueprintFieldBinding[]>()
  bindings.forEach((binding) => {
    const fieldKey = normalizeText(binding.fieldKey)
    if (!fieldKey) {
      return
    }
    candidatesByFieldKey.set(fieldKey, [
      ...(candidatesByFieldKey.get(fieldKey) || []),
      binding,
    ])
  })
  const uniqueBindings = new Map<string, NocodeEditorAiBlueprintFieldBinding>()
  candidatesByFieldKey.forEach((candidates, fieldKey) => {
    if (candidates.length === 1) {
      uniqueBindings.set(fieldKey, candidates[0])
    }
  })
  return uniqueBindings
}

const dedupeReleaseIssues = (
  issues: NocodeEditorPostFormFlowReleaseIssue[],
) => {
  const issueByIdentity = new Map<string, NocodeEditorPostFormFlowReleaseIssue>()
  issues.forEach((issue) => {
    const formulaIdentity = issue.source === 'formula'
      ? buildFormulaTargetIdentityKeys(issue)[0]
      : ''
    const identity = formulaIdentity || issue.key
    issueByIdentity.set(identity, issue)
  })
  return [...issueByIdentity.values()]
}

const reconcileFormulaSummary = (input: {
  formulaSummary?: NocodeEditorAiBlueprintFormulaSummary | null
  formulaTargetResults: FormulaTargetResultLike[]
  uniqueBindingByFieldKey: Map<string, NocodeEditorAiBlueprintFieldBinding>
}) => {
  const formulaSummary = input.formulaSummary
  if (!formulaSummary) {
    return null
  }

  const successfulTargetKeys = new Set(
    input.formulaTargetResults
      .filter(result => result.status === 'updated' || result.status === 'draft')
      .flatMap(result => buildFormulaTargetIdentityKeys(result)),
  )
  const issues = (formulaSummary.issues || []).filter((issue) => {
    const binding = issue.target.fieldKey
      ? input.uniqueBindingByFieldKey.get(issue.target.fieldKey)
      : undefined
    const issueKeys = buildFormulaTargetIdentityKeys({
      targetFormId: binding?.tableId,
      targetFormName: issue.target.formName,
      targetFieldId: binding?.widgetId,
      targetFieldKey: issue.target.fieldKey,
      targetFieldName: issue.target.fieldName,
    })
    return !issueKeys.some(key => successfulTargetKeys.has(key))
  })
  const updated = input.formulaTargetResults.filter(result => (
    result.status === 'updated' || result.status === 'draft'
  )).length
  const skipped = input.formulaTargetResults.filter(result => result.status === 'skipped').length
  const failed = input.formulaTargetResults.filter(result => result.status === 'failed').length
  const hasFailures = skipped > 0 || failed > 0 || issues.length > 0
  const status = input.formulaTargetResults.length > 0
    ? hasFailures
      ? updated > 0 ? 'partial' as const : 'failed' as const
      : 'completed' as const
    : formulaSummary.status

  return {
    status,
    updated,
    skipped,
    failed,
    ...(issues.length ? { issues } : {}),
  } satisfies NocodeEditorAiBlueprintFormulaSummary
}

export const buildNocodeEditorPostFormFlowReleaseContext = (input: {
  planningScope: NocodeEditorPlanningScope
  persistenceMode?: 'saved' | 'draft_only'
  draftPersistenceState?: NocodeEditorAiDraftPersistenceState | null
  formulaSummary?: NocodeEditorAiBlueprintFormulaSummary | null
  formulaApplyResults?: NocodeEditorFormulaApplyResult[]
  formulaTargetResults?: FormulaTargetResultLike[]
  fieldBindings?: NocodeEditorAiBlueprintFieldBinding[]
  flowScheme?: NocodeEditorFlowScheme | null
}) => {
  const fieldBindings = input.fieldBindings || []
  const uniqueBindingByFieldKey = buildUniqueBindingByFieldKey(fieldBindings)
  const latestFormulaTargetResults = normalizeLatestFormulaTargetResults([
    ...(input.formulaApplyResults || []).flatMap(result => result.targetResults || []),
    ...(input.formulaTargetResults || []),
  ])
  const formulaSummary = reconcileFormulaSummary({
    formulaSummary: input.formulaSummary,
    formulaTargetResults: latestFormulaTargetResults,
    uniqueBindingByFieldKey,
  })
  const successfulFormulaTargetKeys = new Set(
    latestFormulaTargetResults
      .filter(result => result.status === 'updated' || result.status === 'draft')
      .flatMap(result => buildFormulaTargetIdentityKeys(result)),
  )
  const draftIssues = (input.draftPersistenceState?.actionIssues || [])
    .filter(issue => issue.targetKind === 'form_field')
    .map(issue => ({
      key: issue.id,
      source: 'draft' as const,
      code: issue.code,
      targetFormId: issue.locator.formId,
      targetFormName: issue.locator.formLabel,
      targetFieldId: issue.locator.widgetId || issue.targetId,
      targetFieldName: issue.targetLabel,
      message: issue.message,
    } satisfies NocodeEditorPostFormFlowReleaseIssue))
  const formulaSummaryIssues = (formulaSummary?.issues || []).flatMap((issue) => {
    const binding = issue.target.fieldKey
      ? uniqueBindingByFieldKey.get(issue.target.fieldKey)
      : undefined
    const releaseIssue = {
      key: `formula:${issue.itemKey}:${issue.code}`,
      source: 'formula' as const,
      code: issue.code,
      targetFormId: binding?.tableId,
      targetFormName: issue.target.formName,
      targetFieldId: binding?.widgetId,
      targetFieldKey: issue.target.fieldKey,
      targetFieldName: issue.target.fieldName,
      message: issue.message,
    } satisfies NocodeEditorPostFormFlowReleaseIssue
    return buildFormulaTargetIdentityKeys(releaseIssue)
      .some(key => successfulFormulaTargetKeys.has(key))
      ? []
      : [releaseIssue]
  })
  const formulaTargetIssues = latestFormulaTargetResults
    .filter(result => result.status === 'failed' || result.status === 'skipped')
    .map((result, index) => ({
      key: `formula-target:${result.tableId || 'form'}:${result.widgetId || result.fieldName || index}:${result.status}`,
      source: 'formula' as const,
      code: `formula_target_${result.status}`,
      targetFormId: result.tableId,
      targetFormName: result.tableName,
      targetFieldId: result.widgetId,
      targetFieldName: result.fieldName,
      message: result.reason || '公式目标未成功更新',
    } satisfies NocodeEditorPostFormFlowReleaseIssue))
  const dependencies = (input.flowScheme?.dependencies || []).map(dependency => ({
    id: dependency.id,
    requiredFor: dependency.requiredFor,
    targetFormId: dependency.targetFormId,
    targetFormName: dependency.targetFormName,
    targetFieldId: dependency.fieldRef?.fieldId,
    targetFieldName: dependency.fieldRef?.fieldName,
  } satisfies NocodeEditorPostFormFlowReleaseDependency))

  return {
    planningScope: input.planningScope,
    persistenceMode: input.persistenceMode,
    formulaSummary,
    issues: dedupeReleaseIssues([
      ...draftIssues,
      ...formulaSummaryIssues,
      ...formulaTargetIssues,
    ]),
    dependencies,
  }
}
