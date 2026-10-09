import type { AiAssistantMarkdownBlock } from '@common/types/ai'
import {
  normalizeNocodeEditorAppBuilderExecutionLevelToken,
  normalizeNocodeEditorAppBuilderPlanningModeToken,
  resolveNocodeEditorAppBuilderExecutionLevelLabel,
  resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel,
  resolveNocodeEditorAppBuilderPlanningModeLabel,
} from '@common/utils/nocodeEditorAppBuilderPlanningLabels'
import { extractNocodeEditorAppBuilderPlanningNarrationLead } from '@common/utils/nocodeEditorAppBuilderPlanningStreamGuard'
import {
  getNocodeEditorAppPlanningAiHandlingText,
  getNocodeEditorPendingContinueLabel,
} from '@common/utils/nocodeEditorConfirmationCopy'
import {
  resolveNocodeEditorPlanningQuestionProjection,
} from '@common/utils/nocodeEditorPlanningQuestionProjection'
import {
  buildNocodeEditorPlanningFormReferenceIndex,
  resolveNocodeEditorPlanningCanonicalFormKey,
  resolveNocodeEditorPlanningFormAlias,
  resolveNocodeEditorPlanningGenericFormReference,
  type NocodeEditorPlanningFormReferenceIndex,
} from '@common/utils/nocodeEditorPlanningFormReference'
import type { NocodeEditorAiConfirmPayload } from '@common/types/nocodeEditorConfirmation'
import yaml from 'js-yaml'

export type NocodeEditorAppBuilderPlanningMode = 'greenfield' | 'delta-extension'
export type NocodeEditorAppBuilderExecutionLevel = 'executable_now' | 'need_confirm' | 'planning_only'

export type NocodeEditorAppBuilderPlanningArtifact = {
  type: string
  name: string
  purpose?: string
  executionLevel: NocodeEditorAppBuilderExecutionLevel
}

export type NocodeEditorAppBuilderPlanningOutlineForm = {
  formKey?: string
  tableName: string
  groupName?: string
  description?: string
}

export type NocodeEditorAppBuilderPlanningOutlineModule = {
  moduleKey?: string
  name: string
  description?: string
  formKeys?: string[]
}

export type NocodeEditorAppBuilderPlanningOutlineFlow = {
  from: string
  to: string
  label?: string
}

export type NocodeEditorAppBuilderPlanningOutline = {
  title?: string
  summary?: string
  forms: NocodeEditorAppBuilderPlanningOutlineForm[]
  modules: NocodeEditorAppBuilderPlanningOutlineModule[]
  flows: NocodeEditorAppBuilderPlanningOutlineFlow[]
  assumptions: string[]
  openQuestions: string[]
  confirmation?: NocodeEditorAiConfirmPayload | null
}

export type NocodeEditorAppBuilderPlanningState = {
  mode: NocodeEditorAppBuilderPlanningMode
  goalSummary?: string
  objects: string[]
  artifacts: NocodeEditorAppBuilderPlanningArtifact[]
  openQuestions: string[]
  outline: NocodeEditorAppBuilderPlanningOutline
}

type NocodeEditorAppBuilderPlanningInvalidReason =
  | 'yaml_parse_failed'
  | 'legacy_protocol_fields'
  | 'missing_required_fields'

type NocodeEditorAppBuilderPlanningParseResult = {
  plan: NocodeEditorAppBuilderPlanningState | null
  planBlock: AiAssistantMarkdownBlock | null
  assistantContent: string
  compactSummary: string
  invalid?: boolean
  invalidReason?: NocodeEditorAppBuilderPlanningInvalidReason
}

const PLAN_FENCE_PATTERN = /```banban-app-builder-plan\s*([\s\S]*?)```/i

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeMatchText = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/[\s"'`“”‘’：:，,。！？!？；;（）()【】\-_/\\]/g, '')
  .replace(/[[\]]/g, '')

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const resolvePlanningSummaryState = (plan: NocodeEditorAppBuilderPlanningState) => {
  const projection = resolveNocodeEditorPlanningQuestionProjection({
    stage: 'app-plan',
    structuredConfirmation: plan.outline?.confirmation,
    legacyOpenQuestions: [
      ...normalizeStringList(plan.openQuestions),
      ...normalizeStringList(plan.outline?.openQuestions),
    ],
    legacyOpenQuestionsMode: 'fallback-only',
    summary: normalizeText(plan.outline?.summary) || plan.goalSummary,
  })

  return {
    confirmation: projection.confirmation,
    confirmationStatus: projection.confirmation?.status,
    openQuestions: projection.openQuestions,
  }
}

const normalizePlanningArtifacts = (value: unknown): NocodeEditorAppBuilderPlanningArtifact[] => (
  Array.isArray(value)
    ? value
      .map<NocodeEditorAppBuilderPlanningArtifact | null>((item) => {
        const record = item && typeof item === 'object' && !Array.isArray(item)
          ? item as Record<string, unknown>
          : null
        const name = normalizeText(record?.name)
        if (!name) {
          return null
        }
        return {
          type: normalizeText(record?.type) || 'artifact',
          name,
          purpose: normalizeText(record?.purpose) || undefined,
          executionLevel: normalizeNocodeEditorAppBuilderExecutionLevelToken(
            record?.execution_level ?? record?.executionLevel,
          ),
        }
      })
      .filter((item): item is NocodeEditorAppBuilderPlanningArtifact => item !== null)
    : []
)

const normalizeOutlineForm = (
  value: unknown,
  index: number,
): NocodeEditorAppBuilderPlanningOutlineForm | null => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  const tableName = normalizeText(record?.tableName ?? record?.name)
  if (!tableName) {
    return null
  }

  return {
    formKey: normalizeText(record?.formKey) || `artifact-${index + 1}`,
    tableName,
    groupName: normalizeText(record?.groupName ?? record?.moduleName ?? record?.group) || undefined,
    description: normalizeText(record?.description ?? record?.purpose) || undefined,
  }
}

const buildOutlineFormLookup = (forms: NocodeEditorAppBuilderPlanningOutlineForm[]) => {
  return buildNocodeEditorPlanningFormReferenceIndex(forms)
}

const appendMissingArtifactForms = (
  forms: NocodeEditorAppBuilderPlanningOutlineForm[],
  artifacts: NocodeEditorAppBuilderPlanningArtifact[],
) => {
  const existingNames = new Set(
    forms.map(item => normalizeMatchText(item.tableName)).filter(Boolean),
  )

  artifacts.forEach((artifact, index) => {
    const key = normalizeMatchText(artifact.name)
    if (!key || existingNames.has(key)) {
      return
    }
    forms.push({
      formKey: `artifact-${forms.length + index + 1}`,
      tableName: artifact.name,
      description: artifact.purpose,
    })
    existingNames.add(key)
  })

  return forms
}

const normalizeOutlineForms = (
  value: unknown,
  artifacts: NocodeEditorAppBuilderPlanningArtifact[],
): NocodeEditorAppBuilderPlanningOutlineForm[] => {
  const rawForms = Array.isArray(value)
    ? value
    : []
  const normalizedForms = rawForms
    .map((item, index) => normalizeOutlineForm(item, index))
    .filter((item): item is NocodeEditorAppBuilderPlanningOutlineForm => Boolean(item))

  if (!normalizedForms.length) {
    return artifacts.map((artifact, index) => ({
      formKey: `artifact-${index + 1}`,
      tableName: artifact.name,
      description: artifact.purpose,
    }))
  }

  return appendMissingArtifactForms(normalizedForms, artifacts)
}

const normalizeOutlineModule = (
  value: unknown,
  index: number,
  formLookup: NocodeEditorPlanningFormReferenceIndex,
): NocodeEditorAppBuilderPlanningOutlineModule | null => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  const name = normalizeText(record?.name ?? record?.groupName)
  if (!name) {
    return null
  }

  const usesCanonicalKeys = Array.isArray(record?.formKeys)
  const rawRefs = usesCanonicalKeys
    ? record?.formKeys as unknown[]
    : Array.isArray(record?.formNames)
      ? record.formNames
      : Array.isArray(record?.artifactNames)
        ? record.artifactNames
        : Array.isArray(record?.artifacts)
          ? record.artifacts
          : []
  const resolveFormReference = usesCanonicalKeys
    ? resolveNocodeEditorPlanningCanonicalFormKey
    : resolveNocodeEditorPlanningFormAlias

  const formKeys = rawRefs
    .map(item => resolveFormReference(formLookup, item))
    .filter(Boolean)

  return {
    moduleKey: normalizeText(record?.moduleKey) || `module-${index + 1}`,
    name,
    description: normalizeText(record?.description) || undefined,
    formKeys: formKeys.length ? Array.from(new Set(formKeys)) : undefined,
  }
}

const buildFallbackOutlineModules = (
  forms: NocodeEditorAppBuilderPlanningOutlineForm[],
  plan: {
    goalSummary?: string
    objects: string[]
  },
): NocodeEditorAppBuilderPlanningOutlineModule[] => {
  if (!forms.length) {
    return []
  }

  return [{
    moduleKey: 'module-1',
    name: plan.goalSummary || global.i18next.t('nocodeEditorAppBuilderPlanning.overallStructure'),
    description: plan.objects.length
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.structureDescription', {
        objects: plan.objects.slice(0, 4).join(global.i18next.t('nocodeEditorAppBuilderPlanning.listSeparator')),
      })
      : undefined,
    formKeys: forms.map(form => normalizeText(form.formKey)).filter(Boolean),
  }]
}

const appendSupplementModules = (
  modules: NocodeEditorAppBuilderPlanningOutlineModule[],
  forms: NocodeEditorAppBuilderPlanningOutlineForm[],
) => {
  const assignedFormKeys = new Set(
    modules.flatMap(item => Array.isArray(item.formKeys) ? item.formKeys : []),
  )
  const unassignedForms = forms.filter((form) => {
    const formKey = normalizeText(form.formKey)
    return formKey && !assignedFormKeys.has(formKey)
  })

  if (!unassignedForms.length) {
    return modules
  }

  const grouped = new Map<string, NocodeEditorAppBuilderPlanningOutlineForm[]>()
  unassignedForms.forEach((form) => {
    const groupName = normalizeText(form.groupName)
      || global.i18next.t('nocodeEditorAppBuilderPlanning.supplementalItems')
    if (!grouped.has(groupName)) {
      grouped.set(groupName, [])
    }
    grouped.get(groupName)?.push(form)
  })

  Array.from(grouped.entries()).forEach(([name, groupForms], index) => {
    modules.push({
      moduleKey: `supplement-${index + 1}`,
      name,
      formKeys: groupForms
        .map(item => normalizeText(item.formKey))
        .filter(Boolean),
    })
  })

  return modules
}

const normalizeOutlineModules = (
  value: unknown,
  forms: NocodeEditorAppBuilderPlanningOutlineForm[],
  plan: {
    goalSummary?: string
    objects: string[]
  },
): NocodeEditorAppBuilderPlanningOutlineModule[] => {
  const formLookup = buildOutlineFormLookup(forms)
  const rawModules = Array.isArray(value)
    ? value
    : []
  const normalizedModules = rawModules
    .map((item, index) => normalizeOutlineModule(item, index, formLookup))
    .filter((item): item is NocodeEditorAppBuilderPlanningOutlineModule => Boolean(item))

  if (!normalizedModules.length) {
    return buildFallbackOutlineModules(forms, plan)
  }

  return appendSupplementModules(normalizedModules, forms)
}

const normalizeOutlineFlow = (
  value: unknown,
  formLookup: NocodeEditorPlanningFormReferenceIndex,
): NocodeEditorAppBuilderPlanningOutlineFlow | null => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  const from = resolveNocodeEditorPlanningGenericFormReference(formLookup, record?.from)
  const to = resolveNocodeEditorPlanningGenericFormReference(formLookup, record?.to)
  if (!from || !to || from === to) {
    return null
  }

  return {
    from,
    to,
    label: normalizeText(record?.label) || undefined,
  }
}

const normalizeOutlineFlows = (
  value: unknown,
  forms: NocodeEditorAppBuilderPlanningOutlineForm[],
): NocodeEditorAppBuilderPlanningOutlineFlow[] => {
  const formLookup = buildOutlineFormLookup(forms)
  return (Array.isArray(value) ? value : [])
    .map(item => normalizeOutlineFlow(item, formLookup))
    .filter((item): item is NocodeEditorAppBuilderPlanningOutlineFlow => Boolean(item))
}

const normalizePlanningOutline = (
  value: unknown,
  plan: {
    goalSummary?: string
    objects: string[]
    artifacts: NocodeEditorAppBuilderPlanningArtifact[]
    openQuestions: string[]
  },
  legacyConfirmation?: unknown,
): NocodeEditorAppBuilderPlanningOutline => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const forms = normalizeOutlineForms(record.forms, plan.artifacts)
  const modules = normalizeOutlineModules(
    record.modules ?? record.groups,
    forms,
    {
      goalSummary: plan.goalSummary,
      objects: plan.objects,
    },
  )
  const projection = resolveNocodeEditorPlanningQuestionProjection({
    stage: 'app-plan',
    structuredConfirmation: record.confirmation,
    legacyConfirmation,
    legacyOpenQuestions: [
      ...plan.openQuestions,
      ...normalizeStringList(record.openQuestions),
    ],
    legacyOpenQuestionsMode: 'fallback-only',
    summary: normalizeText(record.summary) || plan.goalSummary,
  })

  return {
    title: normalizeText(record.title) || (plan.goalSummary
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.structureTitle', { goal: plan.goalSummary })
      : global.i18next.t('nocodeEditorAppBuilderPlanning.structurePreview')),
    summary: normalizeText(record.summary)
      || (plan.objects.length
        ? global.i18next.t('nocodeEditorAppBuilderPlanning.structureSummary', {
          objects: plan.objects.slice(0, 4).join(global.i18next.t('nocodeEditorAppBuilderPlanning.listSeparator')),
        })
        : undefined),
    forms,
    modules,
    flows: normalizeOutlineFlows(record.flows ?? record.links ?? record.relations, forms),
    assumptions: normalizeStringList(record.assumptions),
    openQuestions: projection.openQuestions,
    confirmation: projection.confirmation,
  }
}

const normalizeNocodeEditorAppBuilderPlanningState = (value: unknown): NocodeEditorAppBuilderPlanningState | null => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  if (!record) {
    return null
  }

  const artifacts = normalizePlanningArtifacts(record.artifacts)

  const normalizedPlan = {
    mode: normalizeNocodeEditorAppBuilderPlanningModeToken(record.mode),
    goalSummary: normalizeText(record.goal ?? record.goal_summary) || undefined,
    objects: normalizeStringList(record.objects),
    artifacts,
    openQuestions: normalizeStringList(record.open_questions ?? record.openQuestions),
  }
  const outline = normalizePlanningOutline(
    record.outline,
    normalizedPlan,
    record.confirmation,
  )

  return {
    ...normalizedPlan,
    openQuestions: outline.openQuestions,
    outline,
  }
}

const hasLegacyPlanningProtocolFields = (value: unknown) => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  if (!record) {
    return false
  }

  return [
    'coreObjects',
    'core_objects',
    'artifactMatrix',
    'artifact_matrix',
    'executionLevels',
    'execution_levels',
  ].some(key => Object.prototype.hasOwnProperty.call(record, key))
}

const hasRequiredPlanningProtocolFields = (value: unknown) => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  if (!record) {
    return false
  }

  const goal = normalizeText(record.goal)
  const objects = normalizeStringList(record.objects)
  const artifacts = normalizePlanningArtifacts(record.artifacts)
  const hasOpenQuestionsKey = (
    Object.prototype.hasOwnProperty.call(record, 'open_questions')
    || Object.prototype.hasOwnProperty.call(record, 'openQuestions')
  )
  const rawOpenQuestions = Object.prototype.hasOwnProperty.call(record, 'open_questions')
    ? record.open_questions
    : record.openQuestions

  return Boolean(goal)
    && objects.length > 0
    && artifacts.length > 0
    && hasOpenQuestionsKey
    && Array.isArray(rawOpenQuestions)
}

const buildInvalidPlanningParseResult = (
  assistantContent: string,
  invalidReason: NocodeEditorAppBuilderPlanningInvalidReason,
): NocodeEditorAppBuilderPlanningParseResult => ({
  plan: null,
  planBlock: null,
  assistantContent,
  compactSummary: '',
  invalid: true,
  invalidReason,
})

export const buildNocodeEditorAppBuilderPlanningSummary = (plan: NocodeEditorAppBuilderPlanningState | null) => {
  if (!plan) {
    return ''
  }
  const { openQuestions } = resolvePlanningSummaryState(plan)

  return [
    global.i18next.t('nocodeEditorAppBuilderPlanning.buildModeSummary', {
      mode: resolveNocodeEditorAppBuilderPlanningModeLabel(plan.mode),
    }),
    plan.goalSummary
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.goalSummary', { goal: plan.goalSummary })
      : '',
    plan.objects.length
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.objectsSummary', {
        objects: plan.objects.slice(0, 4).join(global.i18next.t('nocodeEditorAppBuilderPlanning.listSeparator')),
      })
      : '',
    plan.artifacts.length
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.artifactsSummary', {
        artifacts: plan.artifacts
          .slice(0, 4)
          .map(item => global.i18next.t('nocodeEditorAppBuilderPlanning.artifactWithExecutionLevel', {
            name: item.name,
            level: resolveNocodeEditorAppBuilderExecutionLevelLabel(item.executionLevel),
          }))
          .join(global.i18next.t('nocodeEditorAppBuilderPlanning.listSeparator')),
      })
      : '',
    openQuestions.length
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.openQuestionsSummary', {
        questions: openQuestions.slice(0, 3).join(global.i18next.t('nocodeEditorAppBuilderPlanning.sectionSeparator')),
      })
      : '',
  ].filter(Boolean).join('\n')
}

const buildPlanningExecutionLevelSummary = (artifacts: NocodeEditorAppBuilderPlanningArtifact[]) => {
  const grouped = artifacts.reduce<Record<NocodeEditorAppBuilderExecutionLevel, string[]>>((result, item) => {
    result[item.executionLevel].push(item.name)
    return result
  }, {
    executable_now: [],
    need_confirm: [],
    planning_only: [],
  })

  return [
    grouped.executable_now.length
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.executableNowSummary', {
        artifacts: grouped.executable_now.slice(0, 4).join(global.i18next.t('nocodeEditorAppBuilderPlanning.listSeparator')),
      })
      : '',
    grouped.need_confirm.length
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.needConfirmSummary', {
        artifacts: grouped.need_confirm.slice(0, 4).join(global.i18next.t('nocodeEditorAppBuilderPlanning.listSeparator')),
      })
      : '',
    grouped.planning_only.length
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.planningOnlySummary', {
        artifacts: grouped.planning_only.slice(0, 4).join(global.i18next.t('nocodeEditorAppBuilderPlanning.listSeparator')),
      })
      : '',
  ].filter(Boolean)
}

const buildPlanningArtifactsSummary = (artifacts: NocodeEditorAppBuilderPlanningArtifact[]) => (
  artifacts
    .slice(0, 6)
    .map(item => global.i18next.t('nocodeEditorAppBuilderPlanning.artifactSummaryItem', {
      name: item.name,
      type: resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel(item.type),
      level: resolveNocodeEditorAppBuilderExecutionLevelLabel(item.executionLevel),
    }))
)

const buildPlanningNextStepLines = (plan: NocodeEditorAppBuilderPlanningState) => (
  resolvePlanningSummaryState(plan).openQuestions.length
    ? [
      global.i18next.t('nocodeEditorAppBuilderPlanning.confirmItemsStep'),
      global.i18next.t('nocodeEditorAppBuilderPlanning.continueReplyStep', {
        label: getNocodeEditorPendingContinueLabel(),
      }),
    ]
    : [
      global.i18next.t('nocodeEditorAppBuilderPlanning.confirmDirectionStep'),
      global.i18next.t('nocodeEditorAppBuilderPlanning.addConstraintsStep'),
    ]
)

const buildPlanningHandlingText = () => (
  getNocodeEditorAppPlanningAiHandlingText()
)

export const buildNocodeEditorAppBuilderPlanningMarkdownBlock = (
  plan: NocodeEditorAppBuilderPlanningState | null,
): AiAssistantMarkdownBlock | null => {
  if (!plan) {
    return null
  }
  const { openQuestions } = resolvePlanningSummaryState(plan)

  const lines: string[] = [
    global.i18next.t('nocodeEditorAppBuilderPlanning.planHeading'),
    '',
    openQuestions.length
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.pendingPlanHeading')
      : global.i18next.t('nocodeEditorAppBuilderPlanning.currentPlanHeading'),
    '',
    openQuestions.length
      ? global.i18next.t('nocodeEditorAppBuilderPlanning.pendingCount', { count: openQuestions.length })
      : global.i18next.t('nocodeEditorAppBuilderPlanning.readyToProceed'),
    '',
    global.i18next.t('nocodeEditorAppBuilderPlanning.goalHeading'),
    '',
    global.i18next.t('nocodeEditorAppBuilderPlanning.buildModeItem', {
      mode: resolveNocodeEditorAppBuilderPlanningModeLabel(plan.mode),
    }),
  ]

  if (plan.goalSummary) {
    lines.push(global.i18next.t('nocodeEditorAppBuilderPlanning.goalItem', { goal: plan.goalSummary }))
  }

  if (plan.objects.length) {
    lines.push(
      '',
      global.i18next.t('nocodeEditorAppBuilderPlanning.objectsHeading'),
      '',
      ...plan.objects.map(item => `- ${item}`),
    )
  }

  if (plan.artifacts.length) {
    lines.push(
      '',
      global.i18next.t('nocodeEditorAppBuilderPlanning.artifactsHeading'),
      '',
      ...buildPlanningArtifactsSummary(plan.artifacts),
      '',
      global.i18next.t('nocodeEditorAppBuilderPlanning.scopeHeading'),
      '',
      ...buildPlanningExecutionLevelSummary(plan.artifacts),
    )
  }

  if (openQuestions.length) {
    lines.push(
      '',
      global.i18next.t('nocodeEditorAppBuilderPlanning.openQuestionsHeading'),
      '',
      ...openQuestions.map((item, index) => `${index + 1}. ${item}`),
    )
  }

  lines.push(
    '',
    global.i18next.t('nocodeEditorAppBuilderPlanning.nextStepsHeading'),
    '',
    ...buildPlanningNextStepLines(plan),
    '',
    global.i18next.t('nocodeEditorAppBuilderPlanning.aiHandlingHeading'),
    '',
    buildPlanningHandlingText(),
  )

  return {
    type: 'markdown',
    text: lines.filter(Boolean).join('\n'),
  }
}

export const parseNocodeEditorAppBuilderPlanning = (content: string): NocodeEditorAppBuilderPlanningParseResult => {
  const rawContent = String(content || '')
  const match = rawContent.match(PLAN_FENCE_PATTERN)
  if (!match) {
    return {
      plan: null,
      planBlock: null,
      assistantContent: rawContent.trim(),
      compactSummary: '',
    }
  }

  let parsedPlan: unknown = null
  try {
    parsedPlan = yaml.load(match[1])
  } catch {
    return buildInvalidPlanningParseResult(
      global.i18next.t('nocodeEditorAppBuilderPlanning.generationFailed'),
      'yaml_parse_failed',
    )
  }

  if (hasLegacyPlanningProtocolFields(parsedPlan)) {
    return buildInvalidPlanningParseResult(
      global.i18next.t('nocodeEditorAppBuilderPlanning.generationFailed'),
      'legacy_protocol_fields',
    )
  }

  if (!hasRequiredPlanningProtocolFields(parsedPlan)) {
    return buildInvalidPlanningParseResult(
      global.i18next.t('nocodeEditorAppBuilderPlanning.generationFailed'),
      'missing_required_fields',
    )
  }

  const plan = normalizeNocodeEditorAppBuilderPlanningState(parsedPlan)
  const assistantContent = extractNocodeEditorAppBuilderPlanningNarrationLead(rawContent
    .replace(PLAN_FENCE_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim())

  return {
    plan,
    planBlock: buildNocodeEditorAppBuilderPlanningMarkdownBlock(plan),
    assistantContent,
    compactSummary: buildNocodeEditorAppBuilderPlanningSummary(plan),
  }
}
