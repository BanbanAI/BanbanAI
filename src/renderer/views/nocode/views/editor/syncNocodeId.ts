type NocodeMetaLike = {
  meta?: {
    id?: string | null
  } | null
} | null | undefined

export function resolveNocodeEditorSyncNocodeId(
  nocode: NocodeMetaLike,
  routeNocodeId: string,
) {
  const metaNocodeId = String(nocode?.meta?.id || '').trim()
  if (metaNocodeId) {
    return metaNocodeId
  }
  return String(routeNocodeId || '').trim()
}
