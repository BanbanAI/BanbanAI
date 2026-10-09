import type { InjectionKey, Ref } from 'vue'
import { computed, shallowRef } from 'vue'
import i18next from 'i18next'
import type {
  WorkbenchAiFormFillContextSnapshot,
  WorkbenchAiFormFillResult,
  WorkbenchAiFormFillToolInput,
  WorkbenchAiFormFillUndoResult,
} from '@common/utils/workbenchAiFormFill'

export type WorkbenchAiFormFillHost = {
  contextId: string
  getSnapshot: () => WorkbenchAiFormFillContextSnapshot | null
  applyFill: (input: WorkbenchAiFormFillToolInput) => Promise<WorkbenchAiFormFillResult>
  undoFill: (operationId: string) => Promise<WorkbenchAiFormFillUndoResult>
}

export type WorkbenchAiFormFillContext = {
  activeHost: Readonly<Ref<WorkbenchAiFormFillHost | null>>
  overlayHost: Ref<HTMLElement | null>
  registerForm: (host: WorkbenchAiFormFillHost) => () => void
  getSnapshot: () => WorkbenchAiFormFillContextSnapshot | null
  applyFill: (input: WorkbenchAiFormFillToolInput) => Promise<WorkbenchAiFormFillResult>
  undoLatestFill: (operationId: string) => Promise<WorkbenchAiFormFillUndoResult>
}

export type WorkbenchAiFormFillScope = {
  contextId: Readonly<Ref<string>>
  active: Readonly<Ref<boolean>>
}

export const WORKBENCH_AI_FORM_FILL_CONTEXT: InjectionKey<WorkbenchAiFormFillContext> = Symbol('workbenchAiFormFillContext')
export const WORKBENCH_AI_FORM_FILL_SCOPE: InjectionKey<WorkbenchAiFormFillScope> = Symbol('workbenchAiFormFillScope')

export const createWorkbenchAiFormFillContext = (
  overlayHost: Ref<HTMLElement | null>,
): WorkbenchAiFormFillContext => {
  const hosts = shallowRef<WorkbenchAiFormFillHost[]>([])
  const activeHost = computed(() => hosts.value[hosts.value.length - 1] || null)

  const registerForm = (host: WorkbenchAiFormFillHost) => {
    hosts.value = [...hosts.value.filter(item => item.contextId !== host.contextId), host]
    return () => {
      hosts.value = hosts.value.filter(item => item !== host)
    }
  }

  const unavailableResult = (): WorkbenchAiFormFillResult => ({
    tool: 'fill_current_form',
    status: 'not_applied',
    contextId: '',
    appliedFieldIds: [],
    appliedFieldNames: [],
    skipped: [],
    unresolved: [{ reason: i18next.t('workbenchAiFormFillContext.formUnavailableReason') }],
    requiresUserSubmit: true,
    summary: i18next.t('workbenchAiFormFillContext.formUnavailableSummary'),
  })

  return {
    activeHost,
    overlayHost,
    registerForm,
    getSnapshot: () => activeHost.value?.getSnapshot() || null,
    applyFill: async (input) => {
      const host = activeHost.value
      if (!host || (input.contextId && input.contextId !== host.contextId)) {
        return unavailableResult()
      }
      return await host.applyFill(input)
    },
    undoLatestFill: async (operationId) => {
      const host = activeHost.value
      if (!host) {
        return {
          status: 'not_available',
          operationId,
          restoredFieldNames: [],
          preservedFieldNames: [],
          summary: i18next.t('workbenchAiFormFillContext.formClosedUndoUnavailable'),
        }
      }
      return await host.undoFill(operationId)
    },
  }
}
