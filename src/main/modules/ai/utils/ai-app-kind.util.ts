import type { AiAppKind } from '../ai.types'

type ResolveAiAppKindInput = {
  appKind?: AiAppKind | null
  sourceIndex?: Array<{
    sourceId?: string | null
    kind?: string | null
  }> | null
  viewProfile?: {
    documentViews?: Array<{
      sourceId?: string | null
      contract?: {
        directorySourceId?: string | null
      } | null
    }> | null
    formViewSourceIds?: Array<string | null | undefined> | null
    tableViewSourceIds?: Array<string | null | undefined> | null
  } | null
}

const AI_APP_KINDS = ['document', 'form', 'mixed'] as const

function normalizeId(value: unknown) {
  return String(value || '').trim()
}

function isAiAppKind(value: unknown): value is AiAppKind {
  return typeof value === 'string' && (AI_APP_KINDS as readonly string[]).includes(value)
}

function normalizeIdSet(values: Array<unknown> | null | undefined) {
  return new Set(
    (Array.isArray(values) ? values : [])
      .map(item => normalizeId(item))
      .filter(Boolean),
  )
}

export function resolveAiAppKind(input: ResolveAiAppKindInput): AiAppKind {
  if (isAiAppKind(input.appKind)) {
    return input.appKind
  }

  const sourceIndex = Array.isArray(input.sourceIndex) ? input.sourceIndex : []
  const recordSources = sourceIndex.filter(item => {
    const kind = String(item?.kind || '').trim()
    return kind === 'table' || kind === 'document-table'
  })
  const documentViews = Array.isArray(input.viewProfile?.documentViews)
    ? input.viewProfile.documentViews
    : []
  const formViewSourceIds = normalizeIdSet(input.viewProfile?.formViewSourceIds)
  const tableViewSourceIds = normalizeIdSet(input.viewProfile?.tableViewSourceIds)

  const documentLinkedSourceIds = new Set<string>()
  for (const view of documentViews) {
    const sourceId = normalizeId(view?.sourceId)
    const directorySourceId = normalizeId(view?.contract?.directorySourceId)
    if (!sourceId || !directorySourceId) {
      continue
    }
    documentLinkedSourceIds.add(sourceId)
    documentLinkedSourceIds.add(directorySourceId)
  }

  if (documentLinkedSourceIds.size > 0) {
    const hasNonDocumentTables = recordSources.some(item => !documentLinkedSourceIds.has(normalizeId(item?.sourceId)))
    return hasNonDocumentTables ? 'mixed' : 'document'
  }

  const documentViewSourceIds = normalizeIdSet(documentViews.map(view => view?.sourceId))
  if (documentViewSourceIds.size > 0) {
    const legacyDocumentLinkedSourceIds = new Set([
      ...documentViewSourceIds,
      ...tableViewSourceIds,
    ])
    const hasExtraFormSources = [...formViewSourceIds].some(sourceId => !documentViewSourceIds.has(sourceId))
    const hasExpectedDirectoryCount = tableViewSourceIds.size === documentViewSourceIds.size
    const hasOnlyDocumentLinkedRecordSources = recordSources.length > 0
      && recordSources.every(item => legacyDocumentLinkedSourceIds.has(normalizeId(item?.sourceId)))

    if (!hasExtraFormSources && hasExpectedDirectoryCount && hasOnlyDocumentLinkedRecordSources) {
      return 'document'
    }
  }

  const hasDocumentTables = sourceIndex.some(item => item?.kind === 'document-table')
  const hasPlainTables = sourceIndex.some(item => item?.kind === 'table')

  if (hasDocumentTables && hasPlainTables) {
    return 'mixed'
  }
  if (hasDocumentTables) {
    return 'document'
  }
  return 'form'
}
