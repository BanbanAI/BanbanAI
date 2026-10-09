import type { AiSettings } from '@common/types/ai-provider'

export type WorkbenchAiSettingsMutationState = {
  draft: AiSettings
  activeProviderId: string
  providerDialogVisible: boolean
  modelPickerDialogVisible: boolean
  activeModelProviderId: string
  modelPickerKeyword: string
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))

export const createWorkbenchAiSettingsMutationSnapshot = (
  state: WorkbenchAiSettingsMutationState,
): WorkbenchAiSettingsMutationState => clone(state)

export const restoreWorkbenchAiSettingsMutationSnapshot = (
  target: WorkbenchAiSettingsMutationState,
  snapshot: WorkbenchAiSettingsMutationState,
) => {
  const restored = clone(snapshot)
  target.draft = restored.draft
  target.activeProviderId = restored.activeProviderId
  target.providerDialogVisible = restored.providerDialogVisible
  target.modelPickerDialogVisible = restored.modelPickerDialogVisible
  target.activeModelProviderId = restored.activeModelProviderId
  target.modelPickerKeyword = restored.modelPickerKeyword
}

export const withRollbackOnSaveFailure = async <TSnapshot, TSaved>(options: {
  capture: () => TSnapshot
  mutate: () => void
  save: () => Promise<TSaved | null>
  restore: (snapshot: TSnapshot) => void
}) => {
  const snapshot = options.capture()
  options.mutate()
  const saved = await options.save()
  if (!saved) {
    options.restore(snapshot)
  }
  return saved
}
