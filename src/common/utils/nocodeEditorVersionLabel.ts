import i18next from 'i18next'

export const buildNocodeEditorVersionLabel = (revision?: number | null) => {
  const normalizedRevision = Number(revision || 0)
  if (!Number.isFinite(normalizedRevision) || normalizedRevision <= 0) {
    return ''
  }

  return i18next.t('nocodeEditorVersionLabel.version', { version: Math.round(normalizedRevision) })
}
