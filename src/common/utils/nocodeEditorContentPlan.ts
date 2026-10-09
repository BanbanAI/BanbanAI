export type NocodeEditorContentPlanScope =
  | 'board'
  | 'workflow'
  | 'formula'
  | 'form-local'
  | 'local'

export type NocodeEditorContentPlanExecutionLevel =
  | 'executable_now'
  | 'need_confirm'
  | 'planning_only'

export type NocodeEditorContentPlanItem = {
  type: string
  name: string
  purpose?: string
  executionLevel: NocodeEditorContentPlanExecutionLevel
}

export type NocodeEditorContentPlan = {
  scope: NocodeEditorContentPlanScope
  title: string
  target: {
    kind: string
    name: string
    formName?: string
  }
  summary: string
  items: NocodeEditorContentPlanItem[]
  openQuestions: string[]
}

type UnknownRecord = Record<string, unknown>

const CONTENT_PLAN_SCOPES = new Set<NocodeEditorContentPlanScope>([
  'board',
  'workflow',
  'formula',
  'form-local',
  'local',
])

const NEW_CONTENT_PLAN_SCOPES = new Set<NocodeEditorContentPlanScope>([
  'board',
  'form-local',
  'local',
])

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeString = (value: unknown) => (value == null ? '' : String(value).trim())

const normalizeStringList = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map(normalizeString).filter(Boolean)
    : []
)

const normalizeScope = (value: unknown): NocodeEditorContentPlanScope | null => {
  const scope = normalizeString(value)
  if (scope === 'form_local') {
    return 'form-local'
  }
  return CONTENT_PLAN_SCOPES.has(scope as NocodeEditorContentPlanScope)
    ? scope as NocodeEditorContentPlanScope
    : null
}

const normalizeExecutionLevel = (
  value: unknown,
): NocodeEditorContentPlanExecutionLevel => {
  const level = normalizeString(value)
  if (level === 'executable_now' || level === 'planning_only') {
    return level
  }
  return 'need_confirm'
}

const normalizeTarget = (
  value: unknown,
  scope: NocodeEditorContentPlanScope,
) => {
  const target = isRecord(value) ? value : {}
  const name = normalizeString(target.name)
  if (!name) {
    return null
  }

  const kind = normalizeString(target.kind) || scope
  const formName = normalizeString(target.formName)
  return {
    kind,
    name,
    formName: formName || undefined,
  }
}

const normalizeItem = (value: unknown): NocodeEditorContentPlanItem | null => {
  if (!isRecord(value)) {
    return null
  }

  const name = normalizeString(value.name)
  if (!name) {
    return null
  }

  const purpose = normalizeString(value.purpose)
  return {
    type: normalizeString(value.type) || 'item',
    name,
    purpose: purpose || undefined,
    executionLevel: normalizeExecutionLevel(value.executionLevel || value.execution_level),
  }
}

export const normalizeNocodeEditorContentPlan = (
  value: unknown,
  options: { forNewStage?: boolean } = {},
): NocodeEditorContentPlan | null => {
  if (!isRecord(value)) {
    return null
  }

  const scope = normalizeScope(value.scope)
  if (!scope) {
    return null
  }
  if (options.forNewStage === true && !NEW_CONTENT_PLAN_SCOPES.has(scope)) {
    return null
  }

  const target = normalizeTarget(value.target, scope)
  const title = normalizeString(value.title)
  const summary = normalizeString(value.summary)
  if (!title || !summary || !target) {
    return null
  }

  const items = Array.isArray(value.items)
    ? value.items.flatMap((item): NocodeEditorContentPlanItem[] => {
      const normalized = normalizeItem(item)
      return normalized ? [normalized] : []
    })
    : []

  const normalizedOpenQuestions = normalizeStringList(value.openQuestions)
  const openQuestions = normalizedOpenQuestions.length
    ? normalizedOpenQuestions
    : normalizeStringList(value.open_questions)

  return {
    scope,
    title,
    target,
    summary,
    items,
    openQuestions,
  }
}

export const buildNocodeEditorContentPlanPromptSummary = (
  plan: NocodeEditorContentPlan | null | undefined,
) => {
  if (!plan) {
    return ''
  }

  const itemLines = plan.items.map((item, index) => {
    const detail = [
      item.type ? `类型=${item.type}` : '',
      item.purpose ? `用途=${item.purpose}` : '',
      `执行层级=${item.executionLevel}`,
    ].filter(Boolean).join('，')
    return `${index + 1}. ${item.name}${detail ? `（${detail}）` : ''}`
  })

  return [
    `内容规划：${plan.title}`,
    `规划层级：${plan.scope}`,
    `目标对象：${plan.target.name}`,
    `摘要：${plan.summary}`,
    itemLines.length ? `规划清单：\n${itemLines.join('\n')}` : '',
    plan.openQuestions.length ? `待确认：${plan.openQuestions.join('；')}` : '',
  ].filter(Boolean).join('\n')
}
