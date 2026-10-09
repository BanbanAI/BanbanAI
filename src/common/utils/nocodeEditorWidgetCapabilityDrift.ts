import {
  nocodeEditorWidgetCapabilityCatalog,
  type NocodeEditorWidgetCapabilityCatalog,
} from './nocodeEditorWidgetCapabilityCatalog'

export type NocodeEditorWidgetCapabilityRuntimeWidgetType = {
  type?: string
  name?: string
  aliases?: string[]
}

export type NocodeEditorWidgetCapabilityAliasConflict = {
  widgetType: string
  alias: string
  runtimeResolvedType: string
}

export type NocodeEditorWidgetCapabilityDriftReport = {
  duplicateCatalogTypes: string[]
  missingRuntimeTypes: string[]
  conflictingAliases: NocodeEditorWidgetCapabilityAliasConflict[]
  unexpectedRuntimeOnlyTypes: string[]
}

const normalizeToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s._-]+/g, '')

const uniqueSorted = (value: string[]) => Array.from(new Set(value.filter(Boolean))).sort()

const buildRuntimeAliasLookup = (runtimeWidgetTypes: NocodeEditorWidgetCapabilityRuntimeWidgetType[]) => {
  const lookup = new Map<string, string>()
  for (const item of runtimeWidgetTypes) {
    const type = String(item?.type || '').trim()
    if (!type) {
      continue
    }
    const suffix = type.split('.').pop() || ''
    const candidates = [
      type,
      suffix,
      item?.name,
      ...(Array.isArray(item?.aliases) ? item.aliases : []),
    ]
    for (const candidate of candidates) {
      const normalized = normalizeToken(candidate)
      if (normalized && !lookup.has(normalized)) {
        lookup.set(normalized, type)
      }
    }
  }
  return lookup
}

export const analyzeNocodeEditorWidgetCapabilityDrift = (input?: {
  catalog?: NocodeEditorWidgetCapabilityCatalog
  runtimeWidgetTypes?: NocodeEditorWidgetCapabilityRuntimeWidgetType[]
  allowedRuntimeOnlyTypes?: string[]
}): NocodeEditorWidgetCapabilityDriftReport => {
  const catalog = input?.catalog || nocodeEditorWidgetCapabilityCatalog
  const runtimeWidgetTypes = Array.isArray(input?.runtimeWidgetTypes) ? input.runtimeWidgetTypes : []
  const allowedRuntimeOnlyTypes = new Set(
    (Array.isArray(input?.allowedRuntimeOnlyTypes) ? input.allowedRuntimeOnlyTypes : [])
      .map(item => String(item || '').trim())
      .filter(Boolean),
  )

  const catalogTypes = catalog.widgets.map(item => String(item.type || '').trim()).filter(Boolean)
  const runtimeTypes = runtimeWidgetTypes.map(item => String(item?.type || '').trim()).filter(Boolean)
  const runtimeTypeSet = new Set(runtimeTypes)
  const runtimeAliasLookup = buildRuntimeAliasLookup(runtimeWidgetTypes)

  const duplicateCatalogTypes = uniqueSorted(
    catalogTypes.filter((type, index) => catalogTypes.indexOf(type) !== index),
  )

  const missingRuntimeTypes = uniqueSorted(
    catalogTypes.filter(type => !runtimeTypeSet.has(type)),
  )

  const conflictingAliases = catalog.widgets.flatMap(widget => {
    const suffix = String(widget.type || '').split('.').pop() || ''
    const candidates = Array.from(new Set([
      suffix,
      ...(Array.isArray(widget.aliases) ? widget.aliases : []),
    ]))
    return candidates.flatMap(alias => {
      const normalized = normalizeToken(alias)
      const runtimeResolvedType = normalized ? runtimeAliasLookup.get(normalized) : ''
      if (!runtimeResolvedType || runtimeResolvedType === widget.type) {
        return []
      }
      return [{
        widgetType: widget.type,
        alias,
        runtimeResolvedType,
      }]
    })
  })

  const unexpectedRuntimeOnlyTypes = uniqueSorted(
    runtimeTypes.filter(type => !catalogTypes.includes(type) && !allowedRuntimeOnlyTypes.has(type)),
  )

  return {
    duplicateCatalogTypes,
    missingRuntimeTypes,
    conflictingAliases,
    unexpectedRuntimeOnlyTypes,
  }
}
