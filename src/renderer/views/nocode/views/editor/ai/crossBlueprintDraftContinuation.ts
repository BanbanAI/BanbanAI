import type { NocodeEditorAiDraftSaveResult } from './types'

type CrossBlueprintDraftSaveState = Pick<
  NocodeEditorAiDraftSaveResult,
  'ok' | 'persistedToSession' | 'persistedToApp' | 'hasBlockingIssues' | 'flowIssueState'
>

export type CrossBlueprintDraftContinuationDecision =
  | {
      kind: 'continue'
      retainDraftIssues: boolean
    }
  | {
      kind: 'block'
      reason: 'draft_not_persisted' | 'same_target_incomplete'
    }

export const hasCrossBlueprintDraftBlockingIssues = (
  saveResult: CrossBlueprintDraftSaveState,
) => Boolean(
  saveResult.hasBlockingIssues
  || saveResult.flowIssueState?.mode === 'flow_issue',
)

export const resolveCrossBlueprintDraftContinuation = (input: {
  saveResult: CrossBlueprintDraftSaveState
  targetsSourceForm: boolean
}): CrossBlueprintDraftContinuationDecision => {
  if (
    !input.saveResult.ok
    || !input.saveResult.persistedToSession
    || input.saveResult.persistedToApp !== true
  ) {
    return {
      kind: 'block',
      reason: 'draft_not_persisted',
    }
  }

  const hasBlockingIssues = hasCrossBlueprintDraftBlockingIssues(input.saveResult)
  if (hasBlockingIssues && input.targetsSourceForm) {
    return {
      kind: 'block',
      reason: 'same_target_incomplete',
    }
  }

  return {
    kind: 'continue',
    retainDraftIssues: hasBlockingIssues,
  }
}
