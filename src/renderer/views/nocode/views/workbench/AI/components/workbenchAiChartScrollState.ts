type ResolveChartHorizontalRestoreOffsetInput = {
  previousScrollLeft: number
  rememberedScrollLeft?: number
  shouldResetHorizontalScroll: boolean
  didScrollContainerRemount: boolean
}

const normalizeScrollLeft = (offset: number | undefined) => {
  if (offset === undefined) {
    return undefined
  }
  return Math.max(0, Number(offset || 0))
}

export const resolveChartHorizontalRestoreOffset = ({
  previousScrollLeft,
  rememberedScrollLeft,
  shouldResetHorizontalScroll,
  didScrollContainerRemount,
}: ResolveChartHorizontalRestoreOffsetInput) => {
  const normalizedPreviousScrollLeft = normalizeScrollLeft(previousScrollLeft) || 0
  const normalizedRememberedScrollLeft = normalizeScrollLeft(rememberedScrollLeft)

  if (!shouldResetHorizontalScroll) {
    if (didScrollContainerRemount && normalizedRememberedScrollLeft !== undefined) {
      return normalizedRememberedScrollLeft
    }
    return normalizedPreviousScrollLeft
  }

  if (normalizedRememberedScrollLeft !== undefined) {
    return normalizedRememberedScrollLeft
  }

  return 0
}
