import type {
  NocodeEditorAiBlueprintApplyResult,
  NocodeEditorAiGeneratedBlueprintPageTarget,
} from './types'

const normalizeToken = (value: unknown) => String(value || '').trim()

const pickMatchedAppliedForm = (payload: NocodeEditorAiGeneratedBlueprintPageTarget) => {
  const resultForms = Array.isArray(payload.item.applyResult?.forms)
    ? payload.item.applyResult.forms
    : []
  const targetFormKey = normalizeToken(payload.formKey)
  const targetTableName = normalizeToken(payload.tableName)

  return resultForms.find(form => (
    targetFormKey
    && targetTableName
    && normalizeToken(form.formKey) === targetFormKey
    && normalizeToken(form.tableName) === targetTableName
  )) || resultForms.find(form => (
    targetFormKey
    && normalizeToken(form.formKey) === targetFormKey
  )) || resultForms.find(form => (
    targetTableName
    && normalizeToken(form.tableName) === targetTableName
  )) || null
}

export const resolveGeneratedBlueprintOpenTarget = (
  payload: NocodeEditorAiGeneratedBlueprintPageTarget,
) => {
  const matchedAppliedForm = pickMatchedAppliedForm(payload)
  if (matchedAppliedForm) {
    const tableId = normalizeToken(matchedAppliedForm.tableId)
    const tableName = normalizeToken(matchedAppliedForm.tableName)

    if (tableId || tableName) {
      return {
        tableId: tableId || undefined,
        tableName: tableName || undefined,
      }
    }
  }

  const fallbackTableId = normalizeToken(payload.formKey)
  const fallbackTableName = normalizeToken(payload.tableName)
  if (!fallbackTableId && !fallbackTableName) {
    return null
  }

  return {
    tableId: fallbackTableId || undefined,
    tableName: fallbackTableName || undefined,
  }
}

export const shouldStopPendingBlueprintBatch = (
  result: NocodeEditorAiBlueprintApplyResult | undefined | null,
) => result == null || result.persistenceMode === 'draft_only'
