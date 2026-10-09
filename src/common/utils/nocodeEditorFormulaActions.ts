import type {
  AiAssistantFormulaResultItem,
  AiAssistantFormulaTargetResultItem,
} from '@common/types/ai'
import { normalizeFormulaText } from './formula'

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

export const normalizeNocodeEditorFormulaActions = (
  value: unknown,
): AiAssistantFormulaResultItem[] => {
  const items = Array.isArray(value) ? value : []
  return items
    .map((item) => {
      if (!isPlainObject(item)) {
        return null
      }

      const tableId = String(item.tableId || '').trim()
      const tableName = String(item.tableName || '').trim()
      const widgetId = String(item.widgetId || '').trim()
      const fieldName = String(item.fieldName || '').trim()
      const formula = normalizeFormulaText(item.formula)
      const displayFormula = String(item.displayFormula || '').trim()
      const formulaPath = String(item.formulaPath || '').trim()
      const explanation = String(item.explanation || '').trim()

      if (!tableId || !widgetId || !fieldName || !formula) {
        return null
      }

      return {
        tableId,
        ...(tableName ? { tableName } : {}),
        widgetId,
        fieldName,
        formula,
        ...(displayFormula ? { displayFormula } : {}),
        ...(explanation ? { explanation } : {}),
        ...(
          formulaPath === 'default-formula' || formulaPath === 'compute-formula'
            ? { formulaPath: formulaPath as AiAssistantFormulaResultItem['formulaPath'] }
            : {}
        ),
      }
    })
    .filter(Boolean) as AiAssistantFormulaResultItem[]
}

const normalizeFormulaTargetSkippedResult = (
  item: Record<string, unknown>,
): AiAssistantFormulaTargetResultItem | null => {
  const tableId = String(item.tableId || '').trim()
  const tableName = String(item.tableName || '').trim()
  const widgetId = String(item.widgetId || '').trim()
  const fieldName = String(item.fieldName || item.name || '').trim()
  const reason = String(item.reason || item.explanation || '').trim()

  if (!fieldName || !reason) {
    return null
  }

  return {
    status: 'skipped',
    ...(tableId ? { tableId } : {}),
    ...(tableName ? { tableName } : {}),
    ...(widgetId ? { widgetId } : {}),
    fieldName,
    reason,
  }
}

export const normalizeNocodeEditorFormulaTargetResults = (
  value: unknown,
): AiAssistantFormulaTargetResultItem[] => {
  const items = Array.isArray(value) ? value : []
  return items
    .map((item) => {
      if (!isPlainObject(item)) {
        return null
      }

      const status = String(item.status || '').trim()
      if (status === 'skipped') {
        return normalizeFormulaTargetSkippedResult(item)
      }

      if (status !== 'updated' && status !== 'draft' && status !== 'failed') {
        return null
      }

      const [updatedItem] = normalizeNocodeEditorFormulaActions([item])
      if (!updatedItem) {
        return null
      }
      if (status === 'draft') {
        return {
          ...updatedItem,
          status: 'draft' as const,
          draftOnly: true,
          overlayDraft: true,
        }
      }
      if (status === 'failed') {
        const reason = String(item.reason || item.explanation || '').trim()
        if (!reason) {
          return null
        }
        return {
          ...updatedItem,
          status: 'failed' as const,
          reason,
        }
      }
      return { ...updatedItem, status: 'updated' as const }
    })
    .filter(Boolean) as AiAssistantFormulaTargetResultItem[]
}

const getFormulaTargetResultKey = (item: AiAssistantFormulaTargetResultItem) => [
  String('tableId' in item ? item.tableId || '' : '').trim(),
  String('widgetId' in item ? item.widgetId || '' : '').trim(),
  String(item.fieldName || '').trim(),
  String(item.status !== 'skipped' ? item.formulaPath || '' : '').trim(),
].join(':')

export const mergeNocodeEditorFormulaTargetResults = (
  ...resultGroups: unknown[]
): AiAssistantFormulaTargetResultItem[] => {
  const merged: AiAssistantFormulaTargetResultItem[] = []
  const indexByKey = new Map<string, number>()

  for (const group of resultGroups) {
    for (const item of normalizeNocodeEditorFormulaTargetResults(group)) {
      const key = getFormulaTargetResultKey(item)
      const existingIndex = indexByKey.get(key)
      if (existingIndex === undefined) {
        indexByKey.set(key, merged.length)
        merged.push(item)
        continue
      }

      merged[existingIndex] = item
    }
  }

  return merged
}

const getFormulaActionKey = (item: AiAssistantFormulaResultItem) => [
  String(item.tableId || '').trim(),
  String(item.widgetId || '').trim(),
  String(item.formulaPath || '').trim(),
].join(':')

export const mergeNocodeEditorFormulaActions = (
  ...actionGroups: unknown[]
): AiAssistantFormulaResultItem[] => {
  const merged: AiAssistantFormulaResultItem[] = []
  const indexByKey = new Map<string, number>()

  for (const group of actionGroups) {
    for (const item of normalizeNocodeEditorFormulaActions(group)) {
      const key = getFormulaActionKey(item)
      const existingIndex = indexByKey.get(key)
      if (existingIndex === undefined) {
        indexByKey.set(key, merged.length)
        merged.push(item)
        continue
      }

      merged[existingIndex] = item
    }
  }

  return merged
}
