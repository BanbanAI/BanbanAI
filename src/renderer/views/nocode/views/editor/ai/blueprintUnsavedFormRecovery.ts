export const CURRENT_FORM_UNSAVED_BLUEPRINT_ERROR = '当前表单存在未保存变更，请先处理后再按蓝图生成'

export type BlueprintUnsavedFormRecoveryResult<T> =
  | { status: 'applied'; result: T; retried: boolean }
  | { status: 'cancelled' }

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error || '')
)

export const applyBlueprintWithUnsavedFormRecovery = async <T>(input: {
  apply: () => Promise<T>
  confirmSaveAndContinue: () => Promise<boolean>
  saveCurrentForm: () => Promise<{ ok: boolean; message?: string }>
}): Promise<BlueprintUnsavedFormRecoveryResult<T>> => {
  try {
    return {
      status: 'applied',
      result: await input.apply(),
      retried: false,
    }
  } catch (error) {
    if (getErrorMessage(error) !== CURRENT_FORM_UNSAVED_BLUEPRINT_ERROR) {
      throw error
    }

    if (!await input.confirmSaveAndContinue()) {
      return { status: 'cancelled' }
    }

    const saveResult = await input.saveCurrentForm()
    if (!saveResult.ok) {
      throw new Error(saveResult.message || '当前表单保存失败，请处理表单配置后再重试按蓝图生成')
    }

    return {
      status: 'applied',
      result: await input.apply(),
      retried: true,
    }
  }
}
