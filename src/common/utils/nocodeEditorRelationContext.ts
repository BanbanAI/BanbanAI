import type { Field, FieldExtra, OptionFieldUID, OptionTableUID, Table, TableUID } from '@common/types/project'
import i18next from 'i18next'

export type NocodeEditorRelationSignalLevel = 'none' | 'weak' | 'strong'

export type NocodeEditorRelationContextFieldRelation = {
  targetFormKey?: string
  targetFormName?: string
  targetFieldKey?: string
  targetFieldName?: string
  source?: 'selectLinkForm' | 'relatedTableUID' | 'otherTableFieldUID'
}

export type NocodeEditorRelationContextField = {
  fieldKey: string
  fieldName: string
  widgetType?: string
  semanticRole?: string
  enumSourceType?: string
  explicitRelation?: NocodeEditorRelationContextFieldRelation | null
  subformTarget?: {
    targetFormKey?: string
    targetFormName?: string
  } | null
}

export type NocodeEditorRelationContextForm = {
  formKey: string
  tableId?: string
  tableName: string
  aliases: string[]
  entityTokens: string[]
  fields: NocodeEditorRelationContextField[]
}

export type NocodeEditorRelationEntityIndexItem = {
  token: string
  formKeys: string[]
  formNames: string[]
  evidence: string[]
}

export type NocodeEditorRelationCandidateLink = {
  sourceFormKey: string
  sourceFormName: string
  sourceFieldKey: string
  sourceFieldName: string
  targetFormKey?: string
  targetFormName?: string
  targetFieldKey?: string
  targetFieldName?: string
  reason: string
  confidence: number
  confidenceLabel?: 'low' | 'medium' | 'high'
  linkType: 'explicit_relation' | 'subform'
  evidence: string[]
}

export type NocodeEditorRelationContextFingerprint = {
  relationHash: string
  formCount: number
  fieldCount: number
}

export type NocodeEditorRelationContext = {
  version: 1
  appId: string
  appName?: string
  generatedAt: number
  updatedAt: number
  fingerprint: NocodeEditorRelationContextFingerprint
  forms: NocodeEditorRelationContextForm[]
  entityIndex: NocodeEditorRelationEntityIndexItem[]
  candidateLinks: NocodeEditorRelationCandidateLink[]
}

export type BuildNocodeEditorRelationContextFromTablesInput = {
  appId: string
  appName?: string
  tables?: Table[] | null
  structure?: unknown
}

export type MergeNocodeEditorRelationContextsInput = {
  persisted?: NocodeEditorRelationContext | null
  overlay?: NocodeEditorRelationContext | null
}

export type NocodeEditorRelationCandidateTarget = {
  formKey: string
  tableId?: string
  tableName: string
  score: number
  reasons: string[]
}

export type AnalyzeNocodeEditorRelationSignalsInput = {
  userMessage?: string
  draftFormName?: string
  context?: NocodeEditorRelationContext | null
}

export type NocodeEditorRelationSignalAnalysis = {
  signalLevel: NocodeEditorRelationSignalLevel
  candidateTargets: NocodeEditorRelationCandidateTarget[]
  reasons: string[]
  openQuestions: string[]
}

const RELATION_WIDGET_TYPES = new Set([
  'widget.form.treeSelect',
  'widget.form.subform',
  'widget.form.autoCompute',
])

const RELATION_HINT_PATTERNS = [
  '从',
  '选择',
  '关联',
  '关联到',
  '复用',
  '复用来源',
  '来源',
  '来自',
  '来自表',
  '链接',
  '引用',
]

const TABLE_ID_PATTERN = /\bt_[a-z0-9_]+\b/i
const CHINESE_TOKEN_PATTERN = /[\u4e00-\u9fa5]{2,}/g
const EN_TOKEN_PATTERN = /[a-z0-9_]{2,}/gi

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeComparableText = (value: unknown) => normalizeText(value).toLowerCase()

const uniqueTexts = (values: unknown[]) => Array.from(new Set(
  values
    .map(item => normalizeText(item))
    .filter(Boolean),
))

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

const createRelationHash = (value: unknown) => {
  const text = stableSerialize(value)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `rel_${(hash >>> 0).toString(16).padStart(8, '0')}`
}

const getFieldExtra = (field?: Field | null): FieldExtra & Record<string, any> => {
  const extra = field?.meta?.extra
  return extra && typeof extra === 'object' ? extra as FieldExtra & Record<string, any> : {}
}

const isVisibleTable = (table?: Table | null) => !Boolean(table?.meta?.extra?.primaryTable)

const isRelationContextFieldVisible = (field?: Field | null) => !Boolean(field?.meta?.isSystem)

const getOptionTableId = (value?: OptionTableUID | TableUID | string | null) => {
  if (Array.isArray(value)) {
    return normalizeText(value[1])
  }
  return normalizeText(value)
}

const getOptionFieldKey = (value?: OptionFieldUID | string | null) => {
  if (Array.isArray(value)) {
    return normalizeText(value[2])
  }
  return normalizeText(value)
}

const getOptionFieldTableId = (value?: OptionFieldUID | string | null) => {
  if (Array.isArray(value)) {
    return normalizeText(value[1])
  }
  return ''
}

const getSelectLinkFormTableId = (value?: OptionTableUID | TableUID | string | null) => {
  if (Array.isArray(value)) {
    return normalizeText(value[1])
  }

  const normalized = normalizeText(value)
  if (!normalized) {
    return ''
  }

  const matchedTableId = normalized.match(TABLE_ID_PATTERN)?.[0]
  return normalizeText(matchedTableId || normalized)
}

const splitEntityTokens = (value: unknown) => {
  const text = normalizeText(value)
  if (!text) return []

  const tokens = [
    ...(text.match(CHINESE_TOKEN_PATTERN) || []),
    ...(text.match(EN_TOKEN_PATTERN) || []),
  ]

  const derived = tokens.flatMap((token) => {
    const normalized = normalizeText(token)
    if (!normalized) return []
    const simplified = normalized
      .replace(/(表单|表格|列表|明细|记录|登记|档案|信息|数据|来源)$/g, '')
      .trim()
    return uniqueTexts([normalized, simplified])
  })

  return uniqueTexts(derived).filter(token => token.length >= 2)
}

const detectSemanticRole = (fieldName: string, widgetType?: string, hasExplicitRelation?: boolean, hasSubformTarget?: boolean) => {
  if (hasSubformTarget) return 'subform_relation'
  if (hasExplicitRelation) return 'explicit_relation'
  if (widgetType === 'widget.form.autoCompute') return 'computed_relation'
  const comparableName = normalizeComparableText(fieldName)
  if (comparableName.includes('关联') || comparableName.includes('来源') || comparableName.includes('选择')) {
    return 'relation_hint'
  }
  return undefined
}

const sortForms = (forms: NocodeEditorRelationContextForm[]) => [...forms].sort((left, right) => {
  const nameCompare = normalizeComparableText(left.tableName).localeCompare(normalizeComparableText(right.tableName))
  if (nameCompare !== 0) return nameCompare
  return normalizeComparableText(left.formKey).localeCompare(normalizeComparableText(right.formKey))
})

const sortFields = (fields: NocodeEditorRelationContextField[]) => [...fields].sort((left, right) => {
  const nameCompare = normalizeComparableText(left.fieldName).localeCompare(normalizeComparableText(right.fieldName))
  if (nameCompare !== 0) return nameCompare
  return normalizeComparableText(left.fieldKey).localeCompare(normalizeComparableText(right.fieldKey))
})

const sortCandidateLinks = (links: NocodeEditorRelationCandidateLink[]) => [...links].sort((left, right) => {
  const sourceCompare = normalizeComparableText(left.sourceFormName).localeCompare(normalizeComparableText(right.sourceFormName))
  if (sourceCompare !== 0) return sourceCompare
  const targetCompare = normalizeComparableText(left.targetFormName).localeCompare(normalizeComparableText(right.targetFormName))
  if (targetCompare !== 0) return targetCompare
  return normalizeComparableText(left.sourceFieldName).localeCompare(normalizeComparableText(right.sourceFieldName))
})

const buildEntityIndex = (forms: NocodeEditorRelationContextForm[]) => {
  const tokenMap = new Map<string, { formKeys: Set<string>, formNames: Set<string>, evidence: Set<string> }>()

  for (const form of forms) {
    const tokenSources = [
      { value: form.tableName, evidence: `tableName:${form.tableName}` },
      ...form.aliases.map(alias => ({ value: alias, evidence: `alias:${alias}` })),
      ...form.entityTokens.map(token => ({ value: token, evidence: `entityToken:${token}` })),
    ]

    for (const tokenSource of tokenSources) {
      const comparableToken = normalizeText(tokenSource.value)
      if (!comparableToken) continue
      const current = tokenMap.get(comparableToken) || {
        formKeys: new Set<string>(),
        formNames: new Set<string>(),
        evidence: new Set<string>(),
      }
      current.formKeys.add(form.formKey)
      current.formNames.add(form.tableName)
      current.evidence.add(tokenSource.evidence)
      tokenMap.set(comparableToken, current)
    }
  }

  return [...tokenMap.entries()]
    .map(([token, value]) => ({
      token,
      formKeys: [...value.formKeys],
      formNames: [...value.formNames],
      evidence: [...value.evidence],
    }))
    .sort((left, right) => normalizeComparableText(left.token).localeCompare(normalizeComparableText(right.token)))
}

const buildCandidateLinks = (forms: NocodeEditorRelationContextForm[]) => {
  const links: NocodeEditorRelationCandidateLink[] = []

  for (const form of forms) {
    for (const field of form.fields) {
      if (field.explicitRelation) {
        const evidence = uniqueTexts([
          field.widgetType ? `widgetType=${field.widgetType}` : '',
          field.enumSourceType ? `enumSourceType=${field.enumSourceType}` : '',
          field.explicitRelation.targetFormName ? `explicitRelation->${field.explicitRelation.targetFormName}` : '',
        ])
        links.push({
          sourceFormKey: form.formKey,
          sourceFormName: form.tableName,
          sourceFieldKey: field.fieldKey,
          sourceFieldName: field.fieldName,
          targetFormKey: field.explicitRelation.targetFormKey,
          targetFormName: field.explicitRelation.targetFormName,
          targetFieldKey: field.explicitRelation.targetFieldKey,
          targetFieldName: field.explicitRelation.targetFieldName,
          ...getExplicitRelationConfidence(field.explicitRelation.source, field.enumSourceType),
          linkType: 'explicit_relation',
          evidence,
        })
      }
      if (field.subformTarget) {
        const evidence = uniqueTexts([
          field.widgetType ? `widgetType=${field.widgetType}` : '',
          field.subformTarget.targetFormName ? `subformTarget->${field.subformTarget.targetFormName}` : '',
        ])
        links.push({
          sourceFormKey: form.formKey,
          sourceFormName: form.tableName,
          sourceFieldKey: field.fieldKey,
          sourceFieldName: field.fieldName,
          targetFormKey: field.subformTarget.targetFormKey,
          targetFormName: field.subformTarget.targetFormName,
          reason: 'subform field points to target form',
          confidence: 3,
          confidenceLabel: 'high',
          linkType: 'subform',
          evidence,
        })
      }
    }
  }

  return sortCandidateLinks(links)
}

const finalizeContext = (
  context: Omit<NocodeEditorRelationContext, 'version' | 'fingerprint' | 'entityIndex' | 'candidateLinks'>,
): NocodeEditorRelationContext => {
  const forms = sortForms(context.forms).map(form => ({
    ...form,
    aliases: uniqueTexts(form.aliases),
    entityTokens: uniqueTexts(form.entityTokens),
    fields: sortFields(form.fields),
  }))
  const candidateLinks = buildCandidateLinks(forms)
  const entityIndex = buildEntityIndex(forms)
  const fieldCount = forms.reduce((total, form) => total + form.fields.length, 0)
  const relationHash = createRelationHash({
    appId: context.appId,
    appName: context.appName || '',
    forms,
    candidateLinks,
  })

  return {
    version: 1,
    appId: context.appId,
    appName: context.appName,
    generatedAt: context.generatedAt,
    updatedAt: context.updatedAt,
    fingerprint: {
      relationHash,
      formCount: forms.length,
      fieldCount,
    },
    forms,
    entityIndex,
    candidateLinks,
  }
}

const getTargetFormByTableId = (tables: Table[], tableId?: string) => {
  const normalizedTableId = normalizeText(tableId)
  if (!normalizedTableId) return null
  return tables.find(table => normalizeText(table.uid) === normalizedTableId) || null
}

const getTargetFieldByKey = (table: Table | null, fieldKey?: string) => {
  const normalizedFieldKey = normalizeText(fieldKey)
  if (!table || !normalizedFieldKey) return null
  return table.fields.find(field => normalizeText(field.uid) === normalizedFieldKey) || null
}

const resolveExplicitRelationSource = (extra: FieldExtra & Record<string, any>) => {
  if (getSelectLinkFormTableId(extra.selectLinkForm)) return 'selectLinkForm' as const
  if (getOptionTableId(extra.relatedTableUID)) return 'relatedTableUID' as const
  if (getOptionFieldTableId(extra.otherTableFieldUID)) return 'otherTableFieldUID' as const
  return undefined
}

const getExplicitRelationConfidence = (
  source?: 'selectLinkForm' | 'relatedTableUID' | 'otherTableFieldUID',
  enumSourceType?: string,
) => {
  if (source === 'selectLinkForm' && enumSourceType === 'from-table') {
    return {
      reason: 'selectLinkForm with from-table source',
      confidence: 3,
      confidenceLabel: 'high' as const,
    }
  }
  if (source === 'selectLinkForm') {
    return {
      reason: 'selectLinkForm points to target form',
      confidence: 3,
      confidenceLabel: 'high' as const,
    }
  }
  if (source === 'relatedTableUID') {
    return {
      reason: 'relatedTableUID points to target form',
      confidence: 3,
      confidenceLabel: 'high' as const,
    }
  }
  if (source === 'otherTableFieldUID') {
    return {
      reason: 'otherTableFieldUID points to target field',
      confidence: 3,
      confidenceLabel: 'high' as const,
    }
  }
  return {
    reason: 'relation evidence detected',
    confidence: 1,
    confidenceLabel: 'low' as const,
  }
}

const buildFieldProjection = (field: Field, tables: Table[]): NocodeEditorRelationContextField | null => {
  const extra = getFieldExtra(field)
  const widgetType = normalizeText(extra.widgetType)
  const selectChoicesType = normalizeText(extra['select-choices-type'])
  const enumSourceType = normalizeText(extra.enumSourceType || selectChoicesType)
  const selectLinkForm = getSelectLinkFormTableId(extra.selectLinkForm)
  const subTableUID = getOptionTableId(extra.subTableUID)
  const relatedTableUID = getOptionTableId(extra.relatedTableUID)
  const otherTableFieldTableId = getOptionFieldTableId(extra.otherTableFieldUID)
  const otherTableFieldKey = getOptionFieldKey(extra.otherTableFieldUID)
  const explicitRelationSource = resolveExplicitRelationSource(extra)

  const explicitTargetTableId = selectLinkForm || relatedTableUID || otherTableFieldTableId
  const explicitTargetTable = getTargetFormByTableId(tables, explicitTargetTableId)
  const explicitTargetField = getTargetFieldByKey(explicitTargetTable, otherTableFieldKey)
  const subformTargetTable = getTargetFormByTableId(tables, subTableUID)

  const explicitRelation = explicitTargetTableId
    ? {
      targetFormKey: explicitTargetTable ? normalizeText(explicitTargetTable.uid) : explicitTargetTableId,
      targetFormName: normalizeText(explicitTargetTable?.alias) || explicitTargetTableId,
      targetFieldKey: normalizeText(explicitTargetField?.uid) || undefined,
      targetFieldName: normalizeText(explicitTargetField?.alias) || undefined,
      source: explicitRelationSource,
    }
    : null

  const subformTarget = subTableUID
    ? {
      targetFormKey: subformTargetTable ? normalizeText(subformTargetTable.uid) : subTableUID,
      targetFormName: normalizeText(subformTargetTable?.alias) || subTableUID,
    }
    : null

  const hasRelationSignal = Boolean(
    RELATION_WIDGET_TYPES.has(widgetType)
    || enumSourceType
    || explicitRelation
    || subformTarget,
  )

  if (!hasRelationSignal) {
    return null
  }

  return {
    fieldKey: normalizeText(field.uid),
    fieldName: normalizeText(field.alias),
    widgetType: widgetType || undefined,
    semanticRole: detectSemanticRole(
      normalizeText(field.alias),
      widgetType || undefined,
      Boolean(explicitRelation),
      Boolean(subformTarget),
    ),
    enumSourceType: enumSourceType || undefined,
    explicitRelation,
    subformTarget,
  }
}

const buildFormProjection = (table: Table, tables: Table[]): NocodeEditorRelationContextForm => {
  const tableId = normalizeText(table.uid)
  const tableName = normalizeText(table.alias) || tableId
  const aliases = uniqueTexts([
    tableName,
    normalizeText(table.meta?.name),
    normalizeText(table.meta?.title),
  ])
  const entityTokens = uniqueTexts([
    ...aliases,
    ...aliases.flatMap(item => splitEntityTokens(item)),
  ])
  const fields = Array.isArray(table.fields)
    ? table.fields
      .filter(field => isRelationContextFieldVisible(field))
      .map(field => buildFieldProjection(field, tables))
      .filter((field): field is NocodeEditorRelationContextField => Boolean(field))
    : []

  return {
    formKey: tableId || tableName,
    tableId: tableId || undefined,
    tableName,
    aliases,
    entityTokens,
    fields,
  }
}

const normalizeForm = (form: NocodeEditorRelationContextForm): NocodeEditorRelationContextForm => ({
  formKey: normalizeText(form.formKey || form.tableId || form.tableName),
  tableId: normalizeText(form.tableId) || undefined,
  tableName: normalizeText(form.tableName || form.formKey),
  aliases: uniqueTexts(form.aliases || [form.tableName]),
  entityTokens: uniqueTexts(form.entityTokens || []),
  fields: sortFields(Array.isArray(form.fields) ? form.fields.map(field => ({
    fieldKey: normalizeText(field.fieldKey),
    fieldName: normalizeText(field.fieldName),
    widgetType: normalizeText(field.widgetType) || undefined,
    semanticRole: normalizeText(field.semanticRole) || undefined,
    enumSourceType: normalizeText(field.enumSourceType) || undefined,
    explicitRelation: field.explicitRelation
      ? {
        targetFormKey: normalizeText(field.explicitRelation.targetFormKey) || undefined,
        targetFormName: normalizeText(field.explicitRelation.targetFormName) || undefined,
        targetFieldKey: normalizeText(field.explicitRelation.targetFieldKey) || undefined,
        targetFieldName: normalizeText(field.explicitRelation.targetFieldName) || undefined,
        source: field.explicitRelation.source,
      }
      : null,
    subformTarget: field.subformTarget
      ? {
        targetFormKey: normalizeText(field.subformTarget.targetFormKey) || undefined,
        targetFormName: normalizeText(field.subformTarget.targetFormName) || undefined,
      }
      : null,
  })) : []),
})

export function buildNocodeEditorRelationContextFromTables(
  input: BuildNocodeEditorRelationContextFromTablesInput,
): NocodeEditorRelationContext {
  const now = Date.now()
  const tables = (Array.isArray(input.tables) ? input.tables : []).filter(table => isVisibleTable(table))
  const forms = tables.map(table => buildFormProjection(table, tables))

  return finalizeContext({
    appId: normalizeText(input.appId),
    appName: normalizeText(input.appName) || undefined,
    generatedAt: now,
    updatedAt: now,
    forms,
  })
}

export function mergeNocodeEditorRelationContexts(
  input: MergeNocodeEditorRelationContextsInput,
): NocodeEditorRelationContext {
  const persisted = input.persisted
  const overlay = input.overlay

  if (overlay && persisted && normalizeText(overlay.appId) !== normalizeText(persisted.appId)) {
    return finalizeContext({
      appId: normalizeText(overlay.appId),
      appName: normalizeText(overlay.appName) || undefined,
      generatedAt: Number(overlay.generatedAt) || Date.now(),
      updatedAt: Number(overlay.updatedAt) || Date.now(),
      forms: Array.isArray(overlay.forms) ? overlay.forms.map(normalizeForm) : [],
    })
  }

  if (!overlay && persisted) {
    return finalizeContext({
      appId: normalizeText(persisted.appId),
      appName: normalizeText(persisted.appName) || undefined,
      generatedAt: Number(persisted.generatedAt) || Date.now(),
      updatedAt: Number(persisted.updatedAt) || Date.now(),
      forms: Array.isArray(persisted.forms) ? persisted.forms.map(normalizeForm) : [],
    })
  }

  if (!persisted && overlay) {
    return finalizeContext({
      appId: normalizeText(overlay.appId),
      appName: normalizeText(overlay.appName) || undefined,
      generatedAt: Number(overlay.generatedAt) || Date.now(),
      updatedAt: Number(overlay.updatedAt) || Date.now(),
      forms: Array.isArray(overlay.forms) ? overlay.forms.map(normalizeForm) : [],
    })
  }

  const now = Date.now()
  const appId = normalizeText(overlay?.appId || persisted?.appId)
  const appName = normalizeText(overlay?.appName || persisted?.appName) || undefined
  const formMap = new Map<string, NocodeEditorRelationContextForm>()

  for (const source of [persisted, overlay]) {
    for (const form of Array.isArray(source?.forms) ? source!.forms : []) {
      const normalizedForm = normalizeForm(form)
      const formIdentity = normalizedForm.formKey || normalizedForm.tableId || normalizedForm.tableName
      if (!formIdentity) continue
      formMap.set(formIdentity, normalizedForm)
    }
  }

  return finalizeContext({
    appId,
    appName,
    generatedAt: Number(persisted?.generatedAt || overlay?.generatedAt) || now,
    updatedAt: now,
    forms: Array.from(formMap.values()),
  })
}

const scoreTextHit = (text: string, token: string) => {
  if (!text || !token) return 0
  const comparableToken = normalizeComparableText(token)
  if (!comparableToken || !text.includes(comparableToken)) return 0
  return Math.max(2, comparableToken.length)
}

const pickBestSimilarForm = (forms: NocodeEditorRelationContextForm[], text: string, draftFormName: string) => {
  const comparableText = normalizeComparableText(text)
  const comparableDraftName = normalizeComparableText(draftFormName)

  const candidates = forms.map((form) => {
    const comparableName = normalizeComparableText(form.tableName)
    const aliasHits = form.aliases.map(alias => normalizeComparableText(alias)).filter(Boolean)
    const tokenHits = form.entityTokens.map(token => normalizeComparableText(token)).filter(Boolean)
    let score = 0

    if (comparableDraftName && comparableName === comparableDraftName) {
      score += 100
    }
    if (comparableDraftName && comparableName && comparableDraftName.includes(comparableName)) {
      score += comparableName.length * 4
    }
    if (comparableName && comparableText.includes(comparableName)) {
      score += comparableName.length * 3
    }
    for (const alias of aliasHits) {
      if (alias && comparableDraftName.includes(alias)) score += alias.length * 2
      if (alias && comparableText.includes(alias)) score += alias.length
    }
    for (const token of tokenHits) {
      if (token && comparableDraftName.includes(token)) score += Math.max(1, token.length - 1)
    }

    return { form, score, exactNameMatch: comparableName === comparableDraftName, nameLength: comparableName.length }
  }).filter(item => item.score > 0)

  return candidates.sort((left, right) => (
    right.score - left.score
    || Number(right.exactNameMatch) - Number(left.exactNameMatch)
    || right.nameLength - left.nameLength
    || normalizeComparableText(left.form.tableName).localeCompare(normalizeComparableText(right.form.tableName))
  ))[0]?.form
}

const buildFormLookupMaps = (forms: NocodeEditorRelationContextForm[]) => {
  const byFormKey = new Map<string, NocodeEditorRelationContextForm>()
  const byTableId = new Map<string, NocodeEditorRelationContextForm>()

  for (const form of forms) {
    if (form.formKey) byFormKey.set(form.formKey, form)
    if (form.tableId) byTableId.set(form.tableId, form)
  }

  return {
    byFormKey,
    byTableId,
  }
}

const addCandidateScore = (
  candidateMap: Map<string, NocodeEditorRelationCandidateTarget>,
  form: NocodeEditorRelationContextForm,
  score: number,
  reasons: string[],
) => {
  if (!score) return

  const current = candidateMap.get(form.formKey)
  candidateMap.set(form.formKey, {
    formKey: form.formKey,
    tableId: form.tableId,
    tableName: form.tableName,
    score: (current?.score || 0) + score,
    reasons: uniqueTexts([...(current?.reasons || []), ...reasons]),
  })
}

const getLinkStructuralScore = (link: NocodeEditorRelationCandidateLink) => {
  return Math.max(0, Number(link.confidence) || 0)
}

const getExplicitTargetPhraseMatch = (
  analysisText: string,
  form: NocodeEditorRelationContextForm,
) => {
  const candidateNames = uniqueTexts([form.tableName, ...form.aliases]).filter(name => name.length >= 2)
  const patterns = [
    { prefix: '从', suffixes: ['里选择', '中选择', '里选', '中选', '选择', '选'], score: 8 },
    { prefix: '来自', suffixes: [''], score: 7 },
    { prefix: '关联到', suffixes: [''], score: 7 },
    { prefix: '关联', suffixes: [''], score: 6 },
    { prefix: '引用', suffixes: [''], score: 6 },
    { prefix: '复用', suffixes: [''], score: 6 },
    { prefix: '绑定', suffixes: [''], score: 6 },
  ]

  let bestScore = 0
  let bestReason = ''

  for (const name of candidateNames) {
    const comparableName = normalizeComparableText(name)
    if (!comparableName) continue

    for (const pattern of patterns) {
      for (const suffix of pattern.suffixes) {
        if (analysisText.includes(`${pattern.prefix}${comparableName}${suffix}`)) {
          if (pattern.score > bestScore) {
            bestScore = pattern.score
            bestReason = `explicit_relation_phrase:${pattern.prefix}${name}${suffix || ''}`
          }
        }
      }
    }
  }

  return {
    score: bestScore,
    reason: bestReason,
  }
}

export function analyzeNocodeEditorRelationSignals(
  input: AnalyzeNocodeEditorRelationSignalsInput,
): NocodeEditorRelationSignalAnalysis {
  const context = input.context
  const forms = Array.isArray(context?.forms) ? context!.forms : []
  const userMessage = normalizeText(input.userMessage)
  const draftFormName = normalizeText(input.draftFormName)
  const analysisText = normalizeComparableText([userMessage, draftFormName].filter(Boolean).join(' '))

  if (!forms.length || !analysisText) {
    return {
      signalLevel: 'none',
      candidateTargets: [],
      reasons: [],
      openQuestions: draftFormName || userMessage
        ? [i18next.t('nocodeEditorRelationContext.preferredRelatedFormQuestion')]
        : [],
    }
  }

  const candidateMap = new Map<string, NocodeEditorRelationCandidateTarget>()
  const candidateStructureScore = new Map<string, number>()
  const globalReasons: string[] = []
  const relationHintDetected = RELATION_HINT_PATTERNS.some(pattern => analysisText.includes(normalizeComparableText(pattern)))
  const similarForm = pickBestSimilarForm(forms, userMessage, draftFormName)
  const lookup = buildFormLookupMaps(forms)

  for (const form of forms) {
    const matchedTokens = uniqueTexts([
      ...form.aliases.filter(alias => scoreTextHit(analysisText, alias) > 0),
      ...form.entityTokens.filter(token => scoreTextHit(analysisText, token) > 0),
      scoreTextHit(analysisText, form.tableName) > 0 ? form.tableName : '',
    ])

    if (!matchedTokens.length) {
      continue
    }

    const textScore = matchedTokens.reduce((total, token) => total + scoreTextHit(analysisText, token), 0)
    const reasons = matchedTokens.map(token => `text_match:${token}->${form.tableName}`)

    addCandidateScore(
      candidateMap,
      form,
      textScore + (relationHintDetected ? 3 : 0),
      relationHintDetected
        ? [...reasons, `relation_phrase->${form.tableName}`]
        : reasons,
    )
    globalReasons.push(...reasons)
    if (relationHintDetected) {
      globalReasons.push(`relation_phrase->${form.tableName}`)
    }

    const explicitTargetPhrase = getExplicitTargetPhraseMatch(analysisText, form)
    if (explicitTargetPhrase.score > 0) {
      addCandidateScore(
        candidateMap,
        form,
        explicitTargetPhrase.score,
        [explicitTargetPhrase.reason],
      )
      candidateStructureScore.set(
        form.formKey,
        Math.max(candidateStructureScore.get(form.formKey) || 0, 3),
      )
      globalReasons.push(explicitTargetPhrase.reason)
    }
  }

  for (const link of Array.isArray(context?.candidateLinks) ? context!.candidateLinks : []) {
    const targetForm = (link.targetFormKey && lookup.byFormKey.get(link.targetFormKey))
      || (link.targetFormKey && lookup.byTableId.get(link.targetFormKey))
      || null
    if (!targetForm) continue

    const sourceForm = link.sourceFormKey ? lookup.byFormKey.get(link.sourceFormKey) : null
    const sourceMatch = sourceForm && similarForm && sourceForm.formKey === similarForm.formKey
    const sourceNameHit = scoreTextHit(analysisText, link.sourceFormName) > 0
    const targetNameHit = scoreTextHit(analysisText, link.targetFormName) > 0

    if (!sourceMatch && !sourceNameHit && !targetNameHit) {
      continue
    }

    const linkReasons = uniqueTexts([
      sourceMatch ? `similar_form:${similarForm?.tableName}->${link.sourceFormName}` : '',
      sourceNameHit ? `source_form_match:${link.sourceFormName}` : '',
      targetNameHit ? `target_form_match:${link.targetFormName}` : '',
      `link_reason:${link.reason}`,
      `link_confidence:${link.confidence}`,
      ...link.evidence.map(item => `${link.linkType}:${item}`),
    ])

    const structuralScore = getLinkStructuralScore(link) + (relationHintDetected ? 1 : 0)
    addCandidateScore(
      candidateMap,
      targetForm,
      (sourceMatch ? 6 : 0) + (sourceNameHit ? 3 : 0) + (targetNameHit ? 4 : 0) + (relationHintDetected ? 2 : 0),
      linkReasons,
    )
    candidateStructureScore.set(
      targetForm.formKey,
      (candidateStructureScore.get(targetForm.formKey) || 0) + structuralScore,
    )
    globalReasons.push(...linkReasons)
  }

  const candidateTargets = [...candidateMap.values()]
    .sort((left, right) => right.score - left.score || normalizeComparableText(left.tableName).localeCompare(normalizeComparableText(right.tableName)))

  const topScore = candidateTargets[0]?.score || 0
  const secondScore = candidateTargets[1]?.score || 0
  const topGap = topScore - secondScore
  const topStructureScore = candidateTargets[0] ? (candidateStructureScore.get(candidateTargets[0].formKey) || 0) : 0
  const hasStrongStructuralEvidence = topStructureScore >= 3
  const signalLevel: NocodeEditorRelationSignalLevel = topScore >= 8 && topGap >= 3 && hasStrongStructuralEvidence
    ? 'strong'
    : topScore > 0
      ? 'weak'
      : 'none'

  const openQuestions = signalLevel === 'weak'
    ? [
      candidateTargets.length > 1
        ? i18next.t('nocodeEditorRelationContext.chooseRelatedFormQuestion', {
          forms: candidateTargets.slice(0, 2).map(item => item.tableName).join(' / '),
        })
        : i18next.t('nocodeEditorRelationContext.relatedDataTypeQuestion', {
          form: candidateTargets[0]?.tableName || i18next.t('nocodeEditorRelationContext.existingForm'),
        }),
    ]
    : []

  if (signalLevel === 'none' && relationHintDetected) {
    openQuestions.push(i18next.t('nocodeEditorRelationContext.relatedFormNameRequired'))
  }

  return {
    signalLevel,
    candidateTargets,
    reasons: uniqueTexts(globalReasons),
    openQuestions,
  }
}
