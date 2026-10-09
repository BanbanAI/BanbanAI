import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import zhCnLang from '../../src/locales/zh-CN/lang.json'
import {
  analyzeNocodeEditorWidgetCapabilityDrift,
} from '../../src/common/utils/nocodeEditorWidgetCapabilityDrift'
import {
  mergeNocodeEditorWidgetCapabilityCatalog,
  type NocodeEditorWidgetCapabilityFamily,
  type NocodeEditorWidgetCapabilityPriority,
  type NocodeEditorWidgetCapabilityRequirement,
} from '../../src/common/utils/nocodeEditorWidgetCapabilityCatalog'
import {
  nocodeEditorWidgetCapabilityBaseGenerated,
} from '../../src/common/utils/nocodeEditorWidgetCapabilityBase.generated'
import {
  resolveBlueprintWidgetTypeLabel,
} from '../../src/common/utils/nocodeEditorBlueprintWidgetLabel'
import {
  nocodeEditorWidgetCapabilityOverlay,
} from '../../src/common/utils/nocodeEditorWidgetCapabilityOverlay'
import {
  formFieldTypeCatalog,
  type FormFieldTypeCatalogItem,
} from '../../src/renderer/b2/formFieldTypeCatalog'
import {
  buildAiAvailableWidgetTypes,
} from '../../src/renderer/views/nocode/views/editor/form/aiAvailableWidgetTypes'

type BaseWidgetLike = {
  type: string
  name: string
  aliases: string[]
  family: NocodeEditorWidgetCapabilityFamily
  planningPriority: NocodeEditorWidgetCapabilityPriority
  promptVisible: boolean
  requires: NocodeEditorWidgetCapabilityRequirement[]
}

type RuntimeCatalogItem = FormFieldTypeCatalogItem & {
  categoryKey: string
}

const args = new Set(process.argv.slice(2))
const isCheckOnly = args.has('--check')

const baseFilePath = path.resolve(__dirname, '../../src/common/utils/nocodeEditorWidgetCapabilityBase.generated.ts')
const overlayFilePath = path.resolve(__dirname, '../../src/common/utils/nocodeEditorWidgetCapabilityOverlay.ts')

const formFieldTypeLocale = (
  zhCnLang as {
    formFieldTypes?: Record<string, string>
  }
).formFieldTypes || {}

const normalizeList = (value: unknown): string[] => (
  Array.isArray(value)
    ? Array.from(new Set(
      value.map(item => String(item || '').trim()).filter(Boolean),
    ))
    : []
)

const quote = (value: string) => `'${String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/'/g, '\\\'')}'`

const renderStringArray = (value: string[]) => `[${value.map(quote).join(', ')}]`

const renderBaseWidget = (widget: BaseWidgetLike) => [
  '    {',
  `      type: ${quote(widget.type)},`,
  `      name: ${quote(widget.name)},`,
  `      aliases: ${renderStringArray(widget.aliases)},`,
  `      family: ${quote(widget.family)},`,
  `      planningPriority: ${quote(widget.planningPriority)},`,
  `      promptVisible: ${widget.promptVisible ? 'true' : 'false'},`,
  `      requires: ${renderStringArray(widget.requires)},`,
  '    },',
].join('\n')

const renderBaseSource = (input: {
  version: string
  widgets: BaseWidgetLike[]
}) => [
  'export const nocodeEditorWidgetCapabilityBaseGenerated = {',
  `  version: ${quote(input.version)},`,
  '  widgets: [',
  input.widgets.map(renderBaseWidget).join('\n'),
  '  ],',
  '} as const',
  '',
  'export type NocodeEditorWidgetCapabilityBaseGenerated = typeof nocodeEditorWidgetCapabilityBaseGenerated',
  '',
].join('\n')

const renderOverlayStub = (widgetType: string) => [
  '    {',
  `      type: ${quote(widgetType)},`,
  '      useWhen: [],',
  '      avoidWhen: [],',
  '      clarificationTriggers: [],',
  `      fallbackTypes: ${renderStringArray(['widget.form.textInput'])},`,
  '    },',
].join('\n')

const getLocaleFieldName = (item: RuntimeCatalogItem) => {
  const key = String(item.nameKey || '').split('.').pop() || ''
  return String(formFieldTypeLocale[key] || '').trim()
}

const humanizeWidgetSuffix = (widgetType: string) => {
  const suffix = String(widgetType || '').split('.').pop() || ''
  return suffix
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .trim() || widgetType
}

const inferFamily = (item: RuntimeCatalogItem): NocodeEditorWidgetCapabilityFamily => {
  const type = String(item.type || '')

  if (/treeMultipleSelect|treeSelect/.test(type)) return 'relation'
  if (/memberSelect|departmentSelect/.test(type)) return 'organization'
  if (/radioGroup|checkboxGroup|switch/.test(type)) return 'enum'
  if (/dateRangePicker|datePicker|timePicker/.test(type)) return 'date'
  if (/amountInput|numberInput/.test(type)) return 'number'
  if (/image-uploader|file-uploader/.test(type)) return 'media'
  if (/subform/.test(type)) return 'subform'
  if (item.categoryKey === 'formFieldTypes.layoutField') return 'display'
  if (item.categoryKey === 'formFieldTypes.relationField') return 'display'
  if (item.categoryKey === 'formFieldTypes.advancedField') return 'advanced'

  return 'text'
}

const inferRequires = (widgetType: string): NocodeEditorWidgetCapabilityRequirement[] => {
  if (/treeMultipleSelect|treeSelect/.test(widgetType)) return ['source']
  if (/radioGroup|checkboxGroup/.test(widgetType)) return ['enumOptions']
  if (/subform/.test(widgetType)) return ['children']
  return ['none']
}

const buildDefaultBaseWidget = (
  item: RuntimeCatalogItem,
  runtimeAliasesByType: Map<string, string[]>,
): BaseWidgetLike => {
  const localizedName = getLocaleFieldName(item)
  const fallbackName = resolveBlueprintWidgetTypeLabel(item.type) || humanizeWidgetSuffix(item.type)

  return {
    type: item.type,
    name: localizedName || fallbackName,
    aliases: normalizeList(runtimeAliasesByType.get(item.type) || []),
    family: inferFamily(item),
    planningPriority: 'low',
    promptVisible: false,
    requires: inferRequires(item.type),
  }
}

const buildRuntimeCatalogItems = (): RuntimeCatalogItem[] => {
  return formFieldTypeCatalog.flatMap(group => group.children.map(item => ({
    ...item,
    categoryKey: group.categoryKey,
  })))
}

const buildGeneratedBase = (): {
  version: string
  widgets: BaseWidgetLike[]
} => {
  const runtimeCatalogItems = buildRuntimeCatalogItems()
  const runtimeWidgetTypes = buildAiAvailableWidgetTypes()

  const runtimeAliasesByType = new Map(
    runtimeWidgetTypes.map(item => [
      String(item.type || '').trim(),
      normalizeList(item.aliases),
    ] as const),
  )
  const currentBaseByType = new Map(
    nocodeEditorWidgetCapabilityBaseGenerated.widgets.map(item => [
      String(item.type || '').trim(),
      {
        type: String(item.type || '').trim(),
        name: String(item.name || '').trim(),
        aliases: normalizeList(item.aliases),
        family: item.family,
        planningPriority: item.planningPriority,
        promptVisible: item.promptVisible !== false,
        requires: normalizeList(item.requires) as NocodeEditorWidgetCapabilityRequirement[],
      },
    ] as const),
  )

  return {
    version: String(nocodeEditorWidgetCapabilityBaseGenerated.version || '').trim() || '2026-05-23',
    widgets: runtimeCatalogItems.map(item => currentBaseByType.get(item.type) || buildDefaultBaseWidget(item, runtimeAliasesByType)),
  }
}

const ensureOverlayStubs = () => {
  const runtimeTypes = new Set(buildRuntimeCatalogItems().map(item => String(item.type || '').trim()).filter(Boolean))
  const overlayTypes = new Set(
    nocodeEditorWidgetCapabilityOverlay.widgets.map(item => String(item.type || '').trim()).filter(Boolean),
  )
  const missingTypes = Array.from(runtimeTypes).filter(type => !overlayTypes.has(type))
  const orphanTypes = Array.from(overlayTypes).filter(type => !runtimeTypes.has(type))

  orphanTypes.forEach(type => {
    console.warn(`[dev-sync] orphan overlay widget kept for manual review: ${type}`)
  })

  if (!missingTypes.length) {
    return
  }

  if (isCheckOnly) {
    throw new Error(`overlay stubs missing for widget types: ${missingTypes.join(', ')}`)
  }

  const overlaySource = fs.readFileSync(overlayFilePath, 'utf8')
  const lineEnding = overlaySource.includes('\r\n') ? '\r\n' : '\n'
  const marker = `${lineEnding}  ],${lineEnding}} as const`
  const insertAt = overlaySource.lastIndexOf(marker)

  assert.notEqual(
    insertAt,
    -1,
    'overlay file format changed: unable to locate widgets array tail for stub insertion',
  )

  const stubBlock = `\n${missingTypes.map(renderOverlayStub).join('\n')}`
  const nextOverlaySource = `${overlaySource.slice(0, insertAt)}${stubBlock}${overlaySource.slice(insertAt)}`

  if (nextOverlaySource !== overlaySource) {
    fs.writeFileSync(overlayFilePath, nextOverlaySource, 'utf8')
    console.log(`[dev-sync] appended overlay stubs for: ${missingTypes.join(', ')}`)
  }
}

const runDriftReport = (nextBase: {
  version: string
  widgets: BaseWidgetLike[]
}) => {
  const runtimeWidgetTypes = buildAiAvailableWidgetTypes()
  const nextCatalog = mergeNocodeEditorWidgetCapabilityCatalog({
    base: nextBase,
    overlay: nocodeEditorWidgetCapabilityOverlay,
  })
  const drift = analyzeNocodeEditorWidgetCapabilityDrift({
    catalog: nextCatalog,
    runtimeWidgetTypes,
  })

  if (drift.duplicateCatalogTypes.length) {
    console.warn(`[dev-sync] duplicate catalog types: ${drift.duplicateCatalogTypes.join(', ')}`)
  }
  if (drift.missingRuntimeTypes.length) {
    console.warn(`[dev-sync] catalog types missing from runtime: ${drift.missingRuntimeTypes.join(', ')}`)
  }
  if (drift.unexpectedRuntimeOnlyTypes.length) {
    console.warn(`[dev-sync] runtime-only widget types not yet covered: ${drift.unexpectedRuntimeOnlyTypes.join(', ')}`)
  }
  if (drift.conflictingAliases.length) {
    console.warn(`[dev-sync] conflicting aliases detected: ${JSON.stringify(drift.conflictingAliases)}`)
  }
}

const nextBase = buildGeneratedBase()
const nextBaseSource = renderBaseSource(nextBase)
const currentBaseSource = fs.readFileSync(baseFilePath, 'utf8')

if (isCheckOnly) {
  assert.equal(
    currentBaseSource,
    nextBaseSource,
    'nocodeEditorWidgetCapabilityBase.generated.ts is out of sync with runtime widget catalog',
  )
  ensureOverlayStubs()
  runDriftReport(nextBase)
  console.log('[dev-sync] nocode widget capability catalog is up to date')
  process.exit(0)
}

if (currentBaseSource !== nextBaseSource) {
  fs.writeFileSync(baseFilePath, nextBaseSource, 'utf8')
  console.log('[dev-sync] updated nocodeEditorWidgetCapabilityBase.generated.ts')
}

ensureOverlayStubs()
runDriftReport(nextBase)
console.log('[dev-sync] nocode widget capability catalog sync complete')
