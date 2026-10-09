import type { AiThreadModelSelection } from '@common/types/ai-provider'

const pendingSelections = new Map<string, AiThreadModelSelection>()
const storageKeyPrefix = 'NOCODE_CREATION_BUILDER_MODEL_SELECTION'

const normalizeNocodeId = (value: unknown) => String(value || '').trim()
const getStorageKey = (nocodeId: string) => `${storageKeyPrefix}:${nocodeId}`

const readStoredSelection = (nocodeId: string) => {
  if (typeof window === 'undefined') return null
  try {
    const value = window.sessionStorage.getItem(getStorageKey(nocodeId))
    return value ? JSON.parse(value) as AiThreadModelSelection : null
  } catch {
    return null
  }
}

export const stageNocodeEditorBuilderModelSelection = (
  nocodeId: unknown,
  selection: AiThreadModelSelection,
) => {
  const key = normalizeNocodeId(nocodeId)
  if (!key) return
  const value = { ...selection }
  pendingSelections.set(key, value)
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(getStorageKey(key), JSON.stringify(value))
  } catch {
    // Keep the in-memory handoff when session storage is unavailable.
  }
}

export const peekNocodeEditorBuilderModelSelection = (nocodeId: unknown) => {
  const key = normalizeNocodeId(nocodeId)
  if (!key) return null
  const selection = pendingSelections.get(key) || readStoredSelection(key)
  return selection ? { ...selection } : null
}

export const takeNocodeEditorBuilderModelSelection = (nocodeId: unknown) => {
  const key = normalizeNocodeId(nocodeId)
  if (!key) return null
  const selection = peekNocodeEditorBuilderModelSelection(key)
  clearNocodeEditorBuilderModelSelection(key)
  return selection
}

export const clearNocodeEditorBuilderModelSelection = (nocodeId: unknown) => {
  const key = normalizeNocodeId(nocodeId)
  if (!key) return
  pendingSelections.delete(key)
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(getStorageKey(key))
  } catch {
    // Nothing else to clear if session storage is unavailable.
  }
}
