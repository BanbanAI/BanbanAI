const sanitizeSeriesStyle = (style: unknown) => {
  if (!style || typeof style !== 'object' || Array.isArray(style)) {
    return style
  }

  const nextStyle = { ...(style as Record<string, unknown>) }
  delete nextStyle.color
  return nextStyle
}

const sanitizeSeriesData = (data: unknown) => {
  if (!Array.isArray(data)) {
    return data
  }

  return data.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return item
    }

    const nextItem = { ...(item as Record<string, unknown>) }
    nextItem.itemStyle = sanitizeSeriesStyle(nextItem.itemStyle)
    return nextItem
  })
}

const sanitizeSeries = (series: unknown) => {
  if (!Array.isArray(series)) {
    return series
  }

  return series.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return item
    }

    const nextSeries = { ...(item as Record<string, unknown>) }
    nextSeries.data = sanitizeSeriesData(nextSeries.data)
    nextSeries.itemStyle = sanitizeSeriesStyle(nextSeries.itemStyle)
    nextSeries.lineStyle = sanitizeSeriesStyle(nextSeries.lineStyle)
    nextSeries.areaStyle = sanitizeSeriesStyle(nextSeries.areaStyle)
    return nextSeries
  })
}

export const sanitizeLegacyBanbanChartOption = (option: unknown) => {
  if (!option || typeof option !== 'object' || Array.isArray(option)) {
    return option
  }

  const nextOption = { ...(option as Record<string, unknown>) }
  delete nextOption.color
  delete nextOption.visualMap
  nextOption.series = sanitizeSeries(nextOption.series)
  return nextOption
}
