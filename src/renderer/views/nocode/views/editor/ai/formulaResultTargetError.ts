export const normalizeFormulaResultTargetErrorReason = (error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : String(error || '')

  if (message.includes('未找到字段')) {
    return 'widget_not_found'
  }

  return null
}
