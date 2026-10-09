type FormulaFieldToken = {
  title?: unknown
  token?: unknown
  sourceType?: unknown
}

export const buildCurrentRowFormulaTokenByTitle = (
  fieldList: FormulaFieldToken[] | null | undefined,
) => {
  const fields = Array.isArray(fieldList) ? fieldList : []
  const currentRowFields = fields.filter(field => field?.sourceType === 'current-row')
  return new Map(
    (currentRowFields.length ? currentRowFields : fields)
      .map(field => [String(field?.title || '').trim(), String(field?.token || '').trim()] as const)
      .filter(([title, token]) => Boolean(title) && Boolean(token)),
  )
}
