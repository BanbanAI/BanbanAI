import {
  resolveBlueprintWidgetTypeLabelFromAny,
} from './nocodeEditorBlueprintWidgetLabel'

export type NocodeEditorPostFormFlowSignalsSource = 'post_form_structure'

export type NocodeEditorPostFormFlowSignalCategory =
  | 'scenario'
  | 'participant'
  | 'lifecycle'
  | 'evidence'
  | 'schedule'
  | 'collaboration'

export type NocodeEditorPostFormFlowSignalFeature =
  | 'flow_context'
  | 'member_field'
  | 'department_field'
  | 'owner_field'
  | 'short_enum_field'
  | 'status_like_role'
  | 'attachment_field'
  | 'multiline_text_field'
  | 'date_field'
  | 'relation_field'
  | 'subtable_field'

export type NocodeEditorPostFormFlowSignalStats = {
  formCount: number
  evidenceCount: number
  categories: NocodeEditorPostFormFlowSignalCategory[]
  featureCounts: Partial<Record<NocodeEditorPostFormFlowSignalFeature, number>>
}

export type NocodeEditorPostFormFlowSignals = {
  hasEvidence: boolean
  evidence: string[]
  summary: string
  source: NocodeEditorPostFormFlowSignalsSource
  stats: NocodeEditorPostFormFlowSignalStats
}

type NocodeEditorPostFormFlowSignalFieldBindingLike = {
  fieldName?: unknown
  name?: unknown
  widgetType?: unknown
}

type NocodeEditorPostFormFlowSignalFormLike = {
  tableName?: unknown
  formName?: unknown
  description?: unknown
  fieldBindings?: NocodeEditorPostFormFlowSignalFieldBindingLike[] | null
  fields?: NocodeEditorPostFormFlowSignalFieldBindingLike[] | null
}

type NocodeEditorPostFormFlowSignalInput = {
  userGoal?: unknown
  blueprintTitle?: unknown
  blueprintSummary?: unknown
  planningSummary?: unknown
  formName?: unknown
  formDescription?: unknown
  description?: unknown
  fields?: NocodeEditorPostFormFlowSignalFieldBindingLike[] | null
  forms?: NocodeEditorPostFormFlowSignalFormLike[] | null
} | null | undefined

type NocodeEditorPostFormFlowEvidenceItem = {
  text: string
  formName?: string
  features: NocodeEditorPostFormFlowSignalFeature[]
}

const POST_FORM_FLOW_SIGNAL_SOURCE: NocodeEditorPostFormFlowSignalsSource = 'post_form_structure'
const POST_FORM_SIGNAL_CATEGORY_ORDER: NocodeEditorPostFormFlowSignalCategory[] = [
  'scenario',
  'participant',
  'evidence',
  'lifecycle',
  'schedule',
  'collaboration',
]
const POST_FORM_SIGNAL_FEATURE_CATEGORY_MAP: Partial<Record<
  NocodeEditorPostFormFlowSignalFeature,
  NocodeEditorPostFormFlowSignalCategory
>> = {
  flow_context: 'scenario',
  member_field: 'participant',
  department_field: 'participant',
  owner_field: 'participant',
  status_like_role: 'lifecycle',
  attachment_field: 'evidence',
  multiline_text_field: 'evidence',
  date_field: 'schedule',
  relation_field: 'collaboration',
  subtable_field: 'collaboration',
}
const POST_FORM_SIGNAL_FEATURES: NocodeEditorPostFormFlowSignalFeature[] = [
  'flow_context',
  'member_field',
  'department_field',
  'owner_field',
  'short_enum_field',
  'status_like_role',
  'attachment_field',
  'multiline_text_field',
  'date_field',
  'relation_field',
  'subtable_field',
]

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

const uniqueTexts = (values: unknown[]) => Array.from(new Set(
  values
    .map(item => normalizeText(item))
    .filter(Boolean),
))

const normalizePostFormFlowSignalsSource = (
  value: unknown,
): NocodeEditorPostFormFlowSignalsSource => {
  const source = normalizeText(value)
  if (source === POST_FORM_FLOW_SIGNAL_SOURCE) {
    return POST_FORM_FLOW_SIGNAL_SOURCE
  }
  return POST_FORM_FLOW_SIGNAL_SOURCE
}

const formatWidgetTypeEvidence = (value: unknown) => {
  const rawWidgetType = normalizeText(value)
  const widgetTypeLabel = normalizeText(resolveBlueprintWidgetTypeLabelFromAny(value))
  return uniqueTexts([widgetTypeLabel, rawWidgetType]).join(' / ')
}

const normalizeWidgetType = (value: unknown) => normalizeText(value).toLowerCase()

const matchesAnyPattern = (value: string, patterns: RegExp[]) => patterns.some(pattern => pattern.test(value))

const isMemberWidgetType = (widgetType: string) => /member|user|account/.test(widgetType)

const isDepartmentWidgetType = (widgetType: string) => /department|dept/.test(widgetType)

const isAttachmentWidgetType = (widgetType: string) => /attachment|upload/.test(widgetType)

const isMultilineWidgetType = (widgetType: string) => /textarea|text-area|multiline/.test(widgetType)

const isDateWidgetType = (widgetType: string) => /date|time/.test(widgetType)

const isRelationWidgetType = (widgetType: string) => (
  /relation|related|associated/.test(widgetType)
  || /selectdata|relateddata|relationselect/.test(widgetType)
)

const isSubtableWidgetType = (widgetType: string) => /subtable|sub-table/.test(widgetType)

const hasFlowScenarioText = (value: string) => matchesAnyPattern(value, [
  /申请/u,
  /提交/u,
  /审核/u,
  /审批/u,
  /确认/u,
  /办理/u,
  /流转/u,
  /处理/u,
  /跟进/u,
  /派发/u,
  /指派/u,
  /驳回/u,
  /通过/u,
  /抄送/u,
  /归档/u,
  /\brequest\b/i,
  /\bsubmit\b/i,
  /\breview\b/i,
  /\bapprove\b/i,
  /\bconfirm\b/i,
  /\bprocess\b/i,
  /\bhandoff\b/i,
])

const isShortEnumWidgetType = (widgetType: string) => (
  /select|radio|segment|enum/.test(widgetType)
  && !isMemberWidgetType(widgetType)
  && !isDepartmentWidgetType(widgetType)
  && !isRelationWidgetType(widgetType)
)

const isOwnerFieldName = (fieldName: string) => matchesAnyPattern(fieldName, [
  /负责人/u,
  /owner/i,
])

const isStatusLikeRoleFieldName = (fieldName: string) => matchesAnyPattern(fieldName, [
  /状态/u,
  /阶段/u,
  /角色/u,
  /role/i,
  /status/i,
])

const detectFieldFeatures = (input: {
  fieldName: string
  widgetType: unknown
}): NocodeEditorPostFormFlowSignalFeature[] => {
  const fieldName = normalizeText(input.fieldName)
  const widgetType = normalizeWidgetType(input.widgetType)
  const features = new Set<NocodeEditorPostFormFlowSignalFeature>()

  if (isMemberWidgetType(widgetType)) {
    features.add('member_field')
  }
  if (isDepartmentWidgetType(widgetType)) {
    features.add('department_field')
  }
  if (isOwnerFieldName(fieldName)) {
    features.add('owner_field')
  }
  if (isShortEnumWidgetType(widgetType)) {
    features.add('short_enum_field')
  }
  if (isStatusLikeRoleFieldName(fieldName)) {
    features.add('status_like_role')
  }
  if (isAttachmentWidgetType(widgetType)) {
    features.add('attachment_field')
  }
  if (isMultilineWidgetType(widgetType)) {
    features.add('multiline_text_field')
  }
  if (isDateWidgetType(widgetType)) {
    features.add('date_field')
  }
  if (isRelationWidgetType(widgetType)) {
    features.add('relation_field')
  }
  if (isSubtableWidgetType(widgetType)) {
    features.add('subtable_field')
  }

  return Array.from(features)
}

const buildEmptyPostFormFlowSignalStats = (): NocodeEditorPostFormFlowSignalStats => ({
  formCount: 0,
  evidenceCount: 0,
  categories: [],
  featureCounts: {},
})

const normalizeFeatureCounts = (
  value: unknown,
  evidenceCount = Number.POSITIVE_INFINITY,
): Partial<Record<NocodeEditorPostFormFlowSignalFeature, number>> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const featureCounts: Partial<Record<NocodeEditorPostFormFlowSignalFeature, number>> = {}
  POST_FORM_SIGNAL_FEATURES.forEach((feature) => {
    const count = Number((value as Record<string, unknown>)[feature])
    if (count > 0) {
      featureCounts[feature] = Math.min(count, evidenceCount)
    }
  })

  return featureCounts
}

const buildCategoriesFromFeatureCounts = (
  featureCounts: Partial<Record<NocodeEditorPostFormFlowSignalFeature, number>>,
): NocodeEditorPostFormFlowSignalCategory[] => POST_FORM_SIGNAL_CATEGORY_ORDER.filter(category => Object.entries(featureCounts)
  .some(([feature, count]) => count && POST_FORM_SIGNAL_FEATURE_CATEGORY_MAP[feature as NocodeEditorPostFormFlowSignalFeature] === category))

const normalizeCategories = (
  value: unknown,
  featureCounts: Partial<Record<NocodeEditorPostFormFlowSignalFeature, number>>,
): NocodeEditorPostFormFlowSignalCategory[] => {
  const categorySet = new Set<NocodeEditorPostFormFlowSignalCategory>(
    buildCategoriesFromFeatureCounts(featureCounts),
  )

  if (Array.isArray(value)) {
    value.forEach((item) => {
      const category = normalizeText(item) as NocodeEditorPostFormFlowSignalCategory
      if (POST_FORM_SIGNAL_CATEGORY_ORDER.includes(category)) {
        categorySet.add(category)
      }
    })
  }

  return POST_FORM_SIGNAL_CATEGORY_ORDER.filter(category => categorySet.has(category))
}

const normalizeStatsFormCount = (value: unknown, evidenceCount: number) => {
  if (evidenceCount <= 0) {
    return 0
  }

  const formCount = Number(value)
  if (!Number.isFinite(formCount) || formCount <= 0) {
    return 1
  }

  return Math.min(formCount, evidenceCount)
}

const buildPostFormFieldEvidence = (input: {
  formName: string
  fieldName: string
  widgetType?: unknown
}) => {
  const widgetTypeEvidence = formatWidgetTypeEvidence(input.widgetType)
  return `表单“${input.formName}”包含字段“${input.fieldName}”${widgetTypeEvidence ? `（${widgetTypeEvidence}）` : ''}`
}

const buildPostFormScenarioEvidence = (input: {
  label: string
  text: string
}) => `场景证据：${input.label}包含用途/流程语义“${input.text}”`

const uniqueEvidenceItems = (
  items: NocodeEditorPostFormFlowEvidenceItem[],
): NocodeEditorPostFormFlowEvidenceItem[] => {
  const itemMap = new Map<string, NocodeEditorPostFormFlowEvidenceItem>()

  items.forEach((item) => {
    const text = normalizeText(item.text)
    if (!text) {
      return
    }

    const existingItem = itemMap.get(text)
    if (existingItem) {
      existingItem.features = Array.from(new Set([
        ...existingItem.features,
        ...item.features,
      ]))
      existingItem.formName = existingItem.formName || item.formName
      return
    }

    itemMap.set(text, {
      text,
      formName: normalizeText(item.formName),
      features: Array.from(new Set(item.features)),
    })
  })

  return Array.from(itemMap.values())
}

const buildEmptyPostFormFlowSignals = (): NocodeEditorPostFormFlowSignals => ({
  hasEvidence: false,
  evidence: [],
  summary: '当前没有可复用的表单结构与场景证据；这不是系统推荐结论。',
  source: POST_FORM_FLOW_SIGNAL_SOURCE,
  stats: buildEmptyPostFormFlowSignalStats(),
})

const collectFormsFromInput = (
  input: NocodeEditorPostFormFlowSignalInput,
): NocodeEditorPostFormFlowSignalFormLike[] => {
  const forms = Array.isArray(input?.forms) ? input.forms : []
  const rootFormName = normalizeText(input?.formName)
  const rootFormDescription = normalizeText(input?.formDescription) || normalizeText(input?.description)
  const rootFields = Array.isArray(input?.fields) ? input.fields : []

  if (!rootFormName || (!rootFields.length && !rootFormDescription)) {
    return forms
  }

  return [
    ...forms,
    {
      formName: rootFormName,
      description: rootFormDescription,
      fields: rootFields,
    },
  ]
}

const collectRootScenarioEvidence = (
  input: NocodeEditorPostFormFlowSignalInput,
): NocodeEditorPostFormFlowEvidenceItem[] => {
  const rootFormName = normalizeText(input?.formName)
  const entries: Array<{ label: string; value: unknown; formName?: string }> = [
    { label: '用户目标', value: input?.userGoal },
    { label: '蓝图标题', value: input?.blueprintTitle },
    { label: '蓝图摘要', value: input?.blueprintSummary },
    { label: '规划摘要', value: input?.planningSummary },
    { label: '根级表单名称', value: input?.formName, formName: rootFormName },
    { label: '根级表单描述', value: input?.formDescription, formName: rootFormName },
    { label: '根级表单描述', value: input?.description, formName: rootFormName },
  ]

  return entries.flatMap((entry) => {
    const { label, value, formName } = entry
    const text = normalizeText(value)
    if (!text || !hasFlowScenarioText(text)) {
      return []
    }

    return [{
      text: buildPostFormScenarioEvidence({ label, text }),
      formName,
      features: ['flow_context'],
    }]
  })
}

const collectFormScenarioEvidence = (
  form: NocodeEditorPostFormFlowSignalFormLike,
): NocodeEditorPostFormFlowEvidenceItem[] => {
  const formName = normalizeText(form?.tableName) || normalizeText(form?.formName)
  const description = normalizeText(form?.description)
  const scenarioText = uniqueTexts([formName, description]).join('；')
  if (!scenarioText || !hasFlowScenarioText(scenarioText)) {
    return []
  }

  return [{
    text: buildPostFormScenarioEvidence({
      label: formName ? `表单“${formName}”` : '表单',
      text: scenarioText,
    }),
    formName,
    features: ['flow_context'],
  }]
}

export const collectNocodeEditorPostFormFlowSignals = (
  input: NocodeEditorPostFormFlowSignalInput,
): NocodeEditorPostFormFlowSignals => {
  const forms = collectFormsFromInput(input)
  const rootScenarioEvidence = collectRootScenarioEvidence(input)
  const evidenceItems = uniqueEvidenceItems([
    ...rootScenarioEvidence,
    ...forms.flatMap((form) => {
      return collectFormScenarioEvidence(form)
    }),
    ...forms.flatMap((form) => {
      const formName = normalizeText(form?.tableName) || normalizeText(form?.formName)
      if (!formName) {
        return []
      }

      const fieldBindings = [
        ...(Array.isArray(form?.fieldBindings) ? form.fieldBindings : []),
        ...(Array.isArray(form?.fields) ? form.fields : []),
      ]
      const fieldEvidence = fieldBindings.flatMap((fieldBinding) => {
        const fieldName = normalizeText(fieldBinding?.fieldName) || normalizeText(fieldBinding?.name)
        if (!fieldName) {
          return []
        }

        const features = detectFieldFeatures({
          fieldName,
          widgetType: fieldBinding?.widgetType,
        })
        return [{
          text: buildPostFormFieldEvidence({
            formName,
            fieldName,
            widgetType: fieldBinding?.widgetType,
          }),
          formName,
          features,
        }]
      })

      return fieldEvidence
    }),
  ])
  const evidence = evidenceItems.map(item => item.text)
  const hasEvidence = evidence.length > 0
  if (!hasEvidence) {
    return buildEmptyPostFormFlowSignals()
  }

  const formNamesWithEvidence = new Set(evidenceItems.map(item => normalizeText(item.formName)).filter(Boolean))
  const featureCounts: Partial<Record<NocodeEditorPostFormFlowSignalFeature, number>> = {}
  evidenceItems.forEach((item) => {
    item.features.forEach((feature) => {
      featureCounts[feature] = (featureCounts[feature] || 0) + 1
    })
  })

  const categories = buildCategoriesFromFeatureCounts(featureCounts)
  const stats: NocodeEditorPostFormFlowSignalStats = {
    formCount: formNamesWithEvidence.size,
    evidenceCount: evidence.length,
    categories,
    featureCounts,
  }

  return {
    hasEvidence: true,
    evidence,
    summary: `已记录 ${formNamesWithEvidence.size} 个表单、${evidence.length} 条表单结构与场景证据；这不是系统推荐结论，只表示当前输入和已生成表单里出现了这些字段、组件类型、场景用途与通用能力类目。`,
    source: POST_FORM_FLOW_SIGNAL_SOURCE,
    stats,
  }
}

export const normalizeNocodeEditorPostFormFlowSignals = (
  value: unknown,
): NocodeEditorPostFormFlowSignals | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const evidence = Array.isArray((value as NocodeEditorPostFormFlowSignals).evidence)
    ? uniqueTexts((value as NocodeEditorPostFormFlowSignals).evidence)
    : []
  const summary = normalizeText((value as NocodeEditorPostFormFlowSignals).summary)
  const source = normalizePostFormFlowSignalsSource(
    (value as NocodeEditorPostFormFlowSignals).source,
  )
  const normalizedHasEvidence = evidence.length > 0
  const rawStats = (value as NocodeEditorPostFormFlowSignals).stats
  const stats = normalizedHasEvidence && rawStats && typeof rawStats === 'object' && !Array.isArray(rawStats)
    ? (() => {
      const evidenceCount = evidence.length
      const formCount = normalizeStatsFormCount(
        (rawStats as NocodeEditorPostFormFlowSignalStats).formCount,
        evidenceCount,
      )
      const featureCounts = normalizeFeatureCounts(
        (rawStats as NocodeEditorPostFormFlowSignalStats).featureCounts,
        evidenceCount,
      )
      const categories = normalizeCategories(
        (rawStats as NocodeEditorPostFormFlowSignalStats).categories,
        featureCounts,
      )

      return {
        formCount,
        evidenceCount,
        categories,
        featureCounts,
      }
    })()
    : buildEmptyPostFormFlowSignalStats()

  if (!summary) {
    return null
  }

  return {
    hasEvidence: normalizedHasEvidence,
    evidence,
    summary,
    source,
    stats,
  }
}
