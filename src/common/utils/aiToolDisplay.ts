import i18next from 'i18next'

type AiToolDisplayStatus = 'running' | 'success' | 'error' | 'skipped'

type AiReadAppDataDisplayVariant = 'records' | 'aggregate'

const READ_APP_DATA_DISPLAY_TEXT = {
  records: {
    get name() { return i18next.t('aiToolDisplay.readRecords') },
    get pending() { return i18next.t('aiToolDisplay.readingRecords') },
    get success() { return i18next.t('aiToolDisplay.recordsRead') },
    get error() { return i18next.t('aiToolDisplay.recordsReadFailed') },
  },
  aggregate: {
    get name() { return i18next.t('aiToolDisplay.readAggregates') },
    get pending() { return i18next.t('aiToolDisplay.readingAggregates') },
    get success() { return i18next.t('aiToolDisplay.aggregatesRead') },
    get error() { return i18next.t('aiToolDisplay.aggregatesReadFailed') },
  },
}

const normalizeReadAppDataVariant = (input?: Record<string, any> | null): AiReadAppDataDisplayVariant => {
  const mode = String(input?.mode || '').trim().toLowerCase()
  return mode === 'aggregate' ? 'aggregate' : 'records'
}

export const resolveReadAppDataDisplayName = (input?: Record<string, any> | null) => (
  READ_APP_DATA_DISPLAY_TEXT[normalizeReadAppDataVariant(input)].name
)

export const resolveReadAppDataDisplaySummaryFallback = (
  status: AiToolDisplayStatus,
  input?: Record<string, any> | null,
) => {
  const variant = READ_APP_DATA_DISPLAY_TEXT[normalizeReadAppDataVariant(input)]
  if (status === 'success') {
    return variant.success
  }
  if (status === 'error') {
    return variant.error
  }
  return variant.pending
}
