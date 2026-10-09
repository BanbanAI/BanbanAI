import type { PlanningCardPhase } from '../planningCardPhase'

export const resolveConfirmationActionState = (input: {
  phase: PlanningCardPhase | ''
  readonly: boolean
  primaryActionLabel: string
  secondaryActionText: string
  readonlyHint: string
}) => {
  const isReadyWithoutConfirmation = input.phase === 'ready-no-confirmation'
  const isLoadingPhase = input.phase === 'next-stage-loading'
  const isErrorPhase = input.phase === 'error'
  const hasPrimary = Boolean(input.primaryActionLabel)
  const hasSecondary = Boolean(input.secondaryActionText)
  const hasReadonlyHint = Boolean(input.readonlyHint)

  const showActionsSection = Boolean(
    input.phase
    && !isReadyWithoutConfirmation
    && !isLoadingPhase
    && !isErrorPhase
    && (hasPrimary || hasSecondary || (input.readonly && hasReadonlyHint))
  )

  return {
    showActionsSection,
    showPrimaryAction: showActionsSection && hasPrimary,
    showSecondaryAction: showActionsSection && hasSecondary,
  }
}
