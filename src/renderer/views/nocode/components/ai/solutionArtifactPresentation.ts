import yaml from 'js-yaml'
import {
  normalizeNocodeEditorAppBuilderExecutionLevelToken,
  resolveNocodeEditorAppBuilderExecutionLevelLabel,
  resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel,
} from '@common/utils/nocodeEditorAppBuilderPlanningLabels'
import type { NocodeEditorAiSolutionOutline } from '@renderer/views/nocode/views/editor/ai/types'

export type NocodeEditorAiPlanningArtifact = {
  type?: string
  name?: string
  purpose?: string
  executionLevel?: string
}

export type NocodeEditorAiSolutionPresentationNode = {
  name: string
  normalizedName: string
  displayCategory: 'form' | 'planning-item'
  artifactType: string
  executionLevel: string
}

export type NocodeEditorAiSolutionPresentation = {
  moduleCount: number
  formCount: number
  planningItemCount: number
  nodes: NocodeEditorAiSolutionPresentationNode[]
}

const PLAN_FENCE_PATTERN = /```banban-app-builder-plan\s*([\s\S]*?)```/i

const normalizeText = (value: unknown) => String(value || '').trim()

export const normalizeNocodeEditorAiPlanningArtifactName = (value: unknown) => (
  normalizeText(value)
    .replace(/\s+/g, '')
    .toLowerCase()
)

const normalizeArtifactType = (value: unknown) => normalizeText(value).toLowerCase() || 'artifact'

const normalizeExecutionLevel = (value: unknown) => (
  normalizeNocodeEditorAppBuilderExecutionLevelToken(value)
)

const normalizePlanningArtifact = (value: unknown): NocodeEditorAiPlanningArtifact | null => {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
  const name = normalizeText(record?.name)
  if (!name) {
    return null
  }
  return {
    type: normalizeArtifactType(record?.type),
    name,
    purpose: normalizeText(record?.purpose) || undefined,
    executionLevel: normalizeExecutionLevel(record?.executionLevel ?? record?.execution_level),
  }
}

export const normalizeNocodeEditorAiPlanningArtifacts = (
  value: unknown,
): NocodeEditorAiPlanningArtifact[] => (
  Array.isArray(value)
    ? value
      .map(item => normalizePlanningArtifact(item))
      .filter((item): item is NocodeEditorAiPlanningArtifact => Boolean(item))
    : []
)

export const extractNocodeEditorPlanningArtifactsFromContent = (
  content: string,
): NocodeEditorAiPlanningArtifact[] => {
  const match = String(content || '').match(PLAN_FENCE_PATTERN)
  if (!match) {
    return []
  }

  let parsed: unknown = null
  try {
    parsed = yaml.load(match[1])
  } catch {
    parsed = null
  }

  const record = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null

  return normalizeNocodeEditorAiPlanningArtifacts(record?.artifacts)
}

const countSolutionModules = (outline: NocodeEditorAiSolutionOutline) => {
  const modules = Array.isArray(outline?.modules) ? outline.modules : []
  if (modules.length) {
    return modules.length
  }

  const forms = Array.isArray(outline?.forms) ? outline.forms : []
  const groupNames = Array.from(new Set(
    forms
      .map(form => normalizeText(form?.groupName))
      .filter(Boolean),
  ))

  if (groupNames.length) {
    return groupNames.length
  }

  return forms.length || outline?.title ? 1 : 0
}

export const buildNocodeEditorAiSolutionPresentation = (
  outline: NocodeEditorAiSolutionOutline,
  planningArtifacts: NocodeEditorAiPlanningArtifact[] = [],
): NocodeEditorAiSolutionPresentation => {
  const artifactLookup = new Map<string, NocodeEditorAiPlanningArtifact>()

  normalizeNocodeEditorAiPlanningArtifacts(planningArtifacts).forEach((item) => {
    const key = normalizeNocodeEditorAiPlanningArtifactName(item.name)
    if (key && !artifactLookup.has(key)) {
      artifactLookup.set(key, item)
    }
  })

  const forms = Array.isArray(outline?.forms) ? outline.forms : []
  const nodes = forms.map((form) => {
    const name = normalizeText(form?.tableName) || normalizeText(form?.formKey)
    const normalizedName = normalizeNocodeEditorAiPlanningArtifactName(name)
    const matchedArtifact = artifactLookup.get(normalizedName)
    const artifactType = matchedArtifact
      ? normalizeArtifactType(matchedArtifact.type)
      : 'form'
    const displayCategory = matchedArtifact && artifactType !== 'form'
      ? 'planning-item' as const
      : 'form' as const

    return {
      name,
      normalizedName,
      displayCategory,
      artifactType,
      executionLevel: normalizeExecutionLevel(matchedArtifact?.executionLevel),
    }
  })

  return {
    moduleCount: countSolutionModules(outline),
    formCount: nodes.filter(item => item.displayCategory === 'form').length,
    planningItemCount: nodes.filter(item => item.displayCategory === 'planning-item').length,
    nodes,
  }
}

export const resolveNocodeEditorAiArtifactTypeLabel = (value: unknown) => (
  resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel(value)
)

export const resolveNocodeEditorAiExecutionLevelLabel = (value: unknown) => (
  resolveNocodeEditorAppBuilderExecutionLevelLabel(value)
)
