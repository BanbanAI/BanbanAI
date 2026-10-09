export type FormSaveLoadingTargetLike = {
  closest?: (selector: string) => FormSaveLoadingTargetLike | null
}

const FORM_SAVE_LOADING_TARGET_SELECTORS = [
  '.selection-stage-shell',
  '.nocode-stage-shell',
  '.nocode-stage-body',
] as const

export function resolveFormSaveLoadingTarget<T extends FormSaveLoadingTargetLike>(
  root: T | null | undefined,
): T | undefined {
  if (!root) {
    return undefined
  }

  for (const selector of FORM_SAVE_LOADING_TARGET_SELECTORS) {
    const resolved = root.closest?.(selector)
    if (resolved) {
      return resolved as T
    }
  }

  return root
}
