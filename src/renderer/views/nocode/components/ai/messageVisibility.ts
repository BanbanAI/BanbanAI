export const isAiTimelineHiddenMessage = (metadata?: Record<string, any> | null) => {
  return Boolean(metadata?.hiddenFromTimeline)
}
