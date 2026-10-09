export type FlowchartPortSide = 'left' | 'right' | 'top' | 'bottom'

export type FlowchartRect = {
  x: number
  y: number
  width: number
  height: number
}

const ALL_SIDES: FlowchartPortSide[] = ['left', 'right', 'top', 'bottom']

const getRectCenter = (rect: FlowchartRect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
})

const getSideCenter = (rect: FlowchartRect, side: FlowchartPortSide) => {
  if (side === 'left') {
    return {
      x: rect.x,
      y: rect.y + rect.height / 2,
    }
  }

  if (side === 'right') {
    return {
      x: rect.x + rect.width,
      y: rect.y + rect.height / 2,
    }
  }

  if (side === 'top') {
    return {
      x: rect.x + rect.width / 2,
      y: rect.y,
    }
  }

  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height,
  }
}

const getPreferredSourceSides = (dx: number, dy: number) => {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return [
      dx >= 0 ? 'right' : 'left',
      dy >= 0 ? 'bottom' : 'top',
      dy >= 0 ? 'top' : 'bottom',
      dx >= 0 ? 'left' : 'right',
    ] as FlowchartPortSide[]
  }

  return [
    dy >= 0 ? 'bottom' : 'top',
    dx >= 0 ? 'right' : 'left',
    dx >= 0 ? 'left' : 'right',
    dy >= 0 ? 'top' : 'bottom',
  ] as FlowchartPortSide[]
}

const getPreferredTargetSides = (dx: number, dy: number) => {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return [
      dx >= 0 ? 'left' : 'right',
      dy >= 0 ? 'top' : 'bottom',
      dy >= 0 ? 'bottom' : 'top',
      dx >= 0 ? 'right' : 'left',
    ] as FlowchartPortSide[]
  }

  return [
    dy >= 0 ? 'top' : 'bottom',
    dx >= 0 ? 'left' : 'right',
    dx >= 0 ? 'right' : 'left',
    dy >= 0 ? 'bottom' : 'top',
  ] as FlowchartPortSide[]
}

const getSideOrder = (preferredSides: FlowchartPortSide[], side: FlowchartPortSide) => {
  const index = preferredSides.indexOf(side)
  return index >= 0 ? index : preferredSides.length
}

const isHorizontalPair = (fromSide: FlowchartPortSide, toSide: FlowchartPortSide) => (
  (fromSide === 'left' || fromSide === 'right')
  && (toSide === 'left' || toSide === 'right')
)

const isVerticalPair = (fromSide: FlowchartPortSide, toSide: FlowchartPortSide) => (
  (fromSide === 'top' || fromSide === 'bottom')
  && (toSide === 'top' || toSide === 'bottom')
)

const isOpposingPair = (fromSide: FlowchartPortSide, toSide: FlowchartPortSide) => (
  (fromSide === 'left' && toSide === 'right')
  || (fromSide === 'right' && toSide === 'left')
  || (fromSide === 'top' && toSide === 'bottom')
  || (fromSide === 'bottom' && toSide === 'top')
)

export const resolveFlowEdgeSidesByDistance = ({
  fromRect,
  toRect,
  sameModule,
  sceneMidX,
}: {
  fromRect: FlowchartRect
  toRect: FlowchartRect
  sameModule: boolean
  sceneMidX: number
}): { fromSide: FlowchartPortSide; toSide: FlowchartPortSide } => {
  if (sameModule) {
    const side = fromRect.x + fromRect.width / 2 <= sceneMidX ? 'right' : 'left'
    return {
      fromSide: side,
      toSide: side,
    }
  }

  const fromCenter = getRectCenter(fromRect)
  const toCenter = getRectCenter(toRect)
  const dx = toCenter.x - fromCenter.x
  const dy = toCenter.y - fromCenter.y
  const sourcePreferredSides = getPreferredSourceSides(dx, dy)
  const targetPreferredSides = getPreferredTargetSides(dx, dy)
  const sameColumn = Math.abs(dx) < Math.min(fromRect.width, toRect.width) * 0.35
  const sameRow = Math.abs(dy) < Math.min(fromRect.height, toRect.height) * 0.35

  let bestCandidate: null | {
    fromSide: FlowchartPortSide
    toSide: FlowchartPortSide
    score: number
  } = null

  ALL_SIDES.forEach((fromSide) => {
    ALL_SIDES.forEach((toSide) => {
      const fromPoint = getSideCenter(fromRect, fromSide)
      const toPoint = getSideCenter(toRect, toSide)
      let score = Math.abs(toPoint.x - fromPoint.x) + Math.abs(toPoint.y - fromPoint.y)

      score += getSideOrder(sourcePreferredSides, fromSide) * 90
      score += getSideOrder(targetPreferredSides, toSide) * 90

      if (isOpposingPair(fromSide, toSide)) {
        score -= 24
      }

      if (sameColumn && isVerticalPair(fromSide, toSide)) {
        score -= 42
      }

      if (sameRow && isHorizontalPair(fromSide, toSide)) {
        score -= 42
      }

      if (fromSide === toSide) {
        score += 46
      }

      if (Math.abs(dx) >= Math.abs(dy) && isVerticalPair(fromSide, toSide)) {
        score += 18
      }

      if (Math.abs(dy) > Math.abs(dx) && isHorizontalPair(fromSide, toSide)) {
        score += 18
      }

      if (!bestCandidate || score < bestCandidate.score) {
        bestCandidate = {
          fromSide,
          toSide,
          score,
        }
      }
    })
  })

  return {
    fromSide: bestCandidate?.fromSide || 'right',
    toSide: bestCandidate?.toSide || 'left',
  }
}

export const resolveNextFlowchartActiveModuleId = (currentId: string, nextId: string) => (
  currentId === nextId ? '' : nextId
)
