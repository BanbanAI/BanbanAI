import type { NocodeProcess, ProcessFlow } from '@common/types/project'
import { ProcessVersionStatus } from '@common/types/project'
import {
  getEnabledProcessVersion,
  getMaxProcessVersion,
  getProcessVersionKey,
  getProcessVersionStatus,
  setProcessVersionStatus,
} from '@common/utils'
import { deepClone } from '@common/utils/object'

export type NocodeEditorFlowPatchVersionMutationSnapshot = {
  process: NocodeProcess
  editingVersion: number
  canvasChanged: boolean
  structureChanged: boolean
  processMetaChanged: boolean
}

export const createNocodeEditorFlowPatchMutationSnapshot = (
  input: NocodeEditorFlowPatchVersionMutationSnapshot,
): NocodeEditorFlowPatchVersionMutationSnapshot => ({
  ...input,
  process: deepClone(input.process),
})

export const restoreNocodeEditorFlowPatchMutationSnapshot = (
  snapshot: NocodeEditorFlowPatchVersionMutationSnapshot,
): NocodeEditorFlowPatchVersionMutationSnapshot => ({
  ...snapshot,
  process: deepClone(snapshot.process),
})

export const prepareNocodeEditorFlowPatchVersionMutation = (input: {
  process: NocodeProcess
  sourceVersion: number
  patchedFlows: ProcessFlow[]
}) => {
  const nextProcess = deepClone(input.process)
  const sourceStatus = getProcessVersionStatus(nextProcess, input.sourceVersion)
    || ProcessVersionStatus.DESIGNING
  const createdDraftVersion = sourceStatus !== ProcessVersionStatus.DESIGNING
  const draftVersion = createdDraftVersion
    ? getMaxProcessVersion(nextProcess) + 1
    : input.sourceVersion
  const activeVersion = getEnabledProcessVersion(nextProcess) ?? undefined

  nextProcess.flowsByVersion[getProcessVersionKey(draftVersion)] = deepClone(input.patchedFlows)
  setProcessVersionStatus(nextProcess, draftVersion, ProcessVersionStatus.DESIGNING)

  return {
    process: nextProcess,
    sourceVersion: input.sourceVersion,
    sourceStatus,
    draftVersion,
    createdDraftVersion,
    activeVersion,
    activeVersionUnchanged: true as const,
  }
}
