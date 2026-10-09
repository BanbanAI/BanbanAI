export type ExcelCreateFormFinalizationResult =
  | { status: 'skipped'; reason: 'missing_target' | 'target_mismatch' }
  | { status: 'unchanged' }
  | { status: 'saved' }
  | { status: 'failed'; reason: 'save_failed' | 'still_dirty' | 'save_error' }

const normalizeFormId = (value: unknown) => String(value || '').trim()

const isFailedSaveResult = (value: unknown) => (
  value === false
  || value === 'blocked'
  || value === 'failed'
)

export const finalizeExcelCreatedFormState = async (input: {
  completedFormId: string
  currentFormId: string
  hasLocalChanges: () => boolean
  save: () => Promise<boolean | string>
}): Promise<ExcelCreateFormFinalizationResult> => {
  const completedFormId = normalizeFormId(input.completedFormId)
  const currentFormId = normalizeFormId(input.currentFormId)
  if (!completedFormId || !currentFormId) {
    return { status: 'skipped', reason: 'missing_target' }
  }
  if (completedFormId !== currentFormId) {
    return { status: 'skipped', reason: 'target_mismatch' }
  }
  if (!input.hasLocalChanges()) {
    return { status: 'unchanged' }
  }

  try {
    const saveResult = await input.save()
    if (isFailedSaveResult(saveResult)) {
      return { status: 'failed', reason: 'save_failed' }
    }
  } catch {
    return { status: 'failed', reason: 'save_error' }
  }

  return input.hasLocalChanges()
    ? { status: 'failed', reason: 'still_dirty' }
    : { status: 'saved' }
}
