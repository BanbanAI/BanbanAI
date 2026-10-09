type StageArtifactSupersessionInput = {
  planningRevision?: unknown
  planningStagedAt?: unknown
  planningMessageIndex?: unknown
  blueprintRevision?: unknown
  blueprintStagedAt?: unknown
  blueprintMessageIndex?: unknown
}

const toPositiveNumber = (value: unknown) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0
}

const toIndex = (value: unknown) => {
  const normalized = Number(value)
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : -1
}

export const shouldPlanningSupersedeBlueprint = (
  input: StageArtifactSupersessionInput,
) => {
  const planningStagedAt = toPositiveNumber(input.planningStagedAt)
  const blueprintStagedAt = toPositiveNumber(input.blueprintStagedAt)
  if (planningStagedAt > 0 && blueprintStagedAt > 0 && planningStagedAt !== blueprintStagedAt) {
    return planningStagedAt > blueprintStagedAt
  }

  const planningRevision = toPositiveNumber(input.planningRevision)
  const blueprintRevision = toPositiveNumber(input.blueprintRevision)
  if (planningRevision > 0 && blueprintRevision > 0 && planningRevision !== blueprintRevision) {
    return planningRevision > blueprintRevision
  }

  const planningMessageIndex = toIndex(input.planningMessageIndex)
  const blueprintMessageIndex = toIndex(input.blueprintMessageIndex)
  if (planningMessageIndex >= 0 && blueprintMessageIndex >= 0 && planningMessageIndex !== blueprintMessageIndex) {
    return planningMessageIndex > blueprintMessageIndex
  }

  return false
}
