export const POST_FORM_FLOW_TAIL_CARD_VIEWPORT_TOLERANCE_PX = 8
export const POST_FORM_FLOW_TAIL_CARD_VIEWPORT_INSET_PX = 12

type PostFormFlowTailCardViewportAdjustmentInput = {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
  containerBottom: number
  tailCardBottom: number
  tolerancePx?: number
  insetPx?: number
}

export type PostFormFlowTailCardViewportAdjustment = {
  hiddenBottomPx: number
  maxScrollTop: number
  nextScrollTop: number
  shouldScroll: boolean
}

const clampNonNegative = (value: number) => (
  Number.isFinite(value) && value > 0 ? value : 0
)

export const computePostFormFlowTailCardViewportAdjustment = (
  input: PostFormFlowTailCardViewportAdjustmentInput,
): PostFormFlowTailCardViewportAdjustment => {
  const scrollTop = clampNonNegative(input.scrollTop)
  const scrollHeight = clampNonNegative(input.scrollHeight)
  const clientHeight = clampNonNegative(input.clientHeight)
  const tolerancePx = clampNonNegative(input.tolerancePx ?? POST_FORM_FLOW_TAIL_CARD_VIEWPORT_TOLERANCE_PX)
  const insetPx = clampNonNegative(input.insetPx ?? POST_FORM_FLOW_TAIL_CARD_VIEWPORT_INSET_PX)
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)
  const hiddenBottomPx = Math.max(0, Number(input.tailCardBottom || 0) - Number(input.containerBottom || 0))

  if (hiddenBottomPx <= tolerancePx || scrollTop >= maxScrollTop) {
    return {
      hiddenBottomPx,
      maxScrollTop,
      nextScrollTop: Math.min(scrollTop, maxScrollTop),
      shouldScroll: false,
    }
  }

  const nextScrollTop = Math.min(
    maxScrollTop,
    Math.ceil(scrollTop + hiddenBottomPx + insetPx),
  )

  return {
    hiddenBottomPx,
    maxScrollTop,
    nextScrollTop,
    shouldScroll: nextScrollTop > scrollTop,
  }
}
