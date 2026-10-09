import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'

type BuildNocodeEditorRouteOptions = {
  query?: LocationQueryRaw
  returnTo?: string
}

const normalizeInternalPath = (value?: string | null) => {
  const text = String(value || '').trim()
  if (!text.startsWith('/')) {
    return ''
  }
  if (text.startsWith('//')) {
    return ''
  }
  return text
}

export const resolveNocodeEditorReturnTo = (
  value?: string | null,
  fallback = '/',
) => {
  const normalized = normalizeInternalPath(value)
  if (normalized) {
    return normalized
  }
  return normalizeInternalPath(fallback) || '/'
}

export const buildNocodeEditorRoute = (
  nocodeId: string,
  options: BuildNocodeEditorRouteOptions = {},
): RouteLocationRaw => {
  const query: LocationQueryRaw = {
    ...(options.query || {}),
  }
  const returnTo = normalizeInternalPath(options.returnTo)
  if (returnTo) {
    query.returnTo = returnTo
  }

  return {
    path: `/app/${nocodeId}/edit/`,
    ...(Object.keys(query).length > 0 ? { query } : {}),
  }
}
