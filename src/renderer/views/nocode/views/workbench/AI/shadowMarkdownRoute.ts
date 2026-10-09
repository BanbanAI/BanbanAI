export type ShadowMarkdownRouteTarget =
  | {
      kind: 'internal_route'
      routePath: string
      displayTitle?: string
    }
  | {
      kind: 'app_table'
      routePath: string
      appId: string
      tableId: string
      filterPath: string
      displayTitle?: string
    }

const RESERVED_APP_ROUTE_SEGMENTS = new Set([
  'edit',
  'setting',
])

export const resolveInnerRoutePath = (href: string | null) => {
  const normalizedHref = String(href || '').trim()
  if (!normalizedHref.startsWith('#/')) return ''
  return normalizedHref.slice(1)
}

export const resolveShadowMarkdownRouteTarget = (
  href: string | null,
): ShadowMarkdownRouteTarget | null => {
  const routePath = resolveInnerRoutePath(href)
  if (!routePath) {
    return null
  }

  const [pathname, search = ''] = routePath.split('?')
  const segments = pathname.split('/').filter(Boolean)
  if (
    segments[0] === 'app'
    && segments.length === 3
    && !RESERVED_APP_ROUTE_SEGMENTS.has(segments[2])
  ) {
    const params = new URLSearchParams(search)
    return {
      kind: 'app_table',
      routePath,
      appId: decodeURIComponent(segments[1]),
      tableId: decodeURIComponent(segments[2]),
      filterPath: params.get('filter') || '',
    }
  }

  return {
    kind: 'internal_route',
    routePath,
  }
}
