import type {
  AiAssistantApplicationStructurePreview,
  AiAssistantConfirmationCardPresentation,
} from '@common/types/ai'
import type {
  NocodeEditorAiConfirmPayload,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorSingleFormPlanOutlineLike,
  NocodeEditorSingleFormPlanPresentationLike,
  NocodeEditorSingleFormPlanSummaryResult,
} from '@common/utils/nocodeEditorSingleFormPlan'
import {
  resolveNocodeEditorSingleFormPlanSummary,
} from '@common/utils/nocodeEditorSingleFormPlan'
import {
  projectPendingPlanningQuestionTitles,
} from '@common/utils/nocodeEditorPlanningQuestionContract'
import {
  normalizeNocodeEditorConfirmationPayload,
} from '@common/utils/nocodeEditorConfirmationNormalization'
import {
  resolveNocodeEditorAppBuilderExecutionLevelLabel,
  resolveNocodeEditorAppBuilderPlanningModeLabel,
  resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel,
} from '@common/utils/nocodeEditorAppBuilderPlanningLabels'
import i18next from 'i18next'

type UnknownRecord = Record<string, unknown>

type SharedFormPlanInput = {
  outline?: (NocodeEditorSingleFormPlanOutlineLike & {
    confirmation?: unknown
  }) | null
  solutionPresentation?: NocodeEditorSingleFormPlanPresentationLike | null
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeStringList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const toRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
)

const toUnknownArray = (value: unknown): unknown[] => (
  Array.isArray(value) ? value : []
)

const buildGoalSectionText = (summary: NocodeEditorSingleFormPlanSummaryResult) => {
  const goalText = normalizeText(summary.goalText)
  const contentText = normalizeText(summary.contentText)

  return goalText || contentText
}

const buildFieldScopeItems = (summary: NocodeEditorSingleFormPlanSummaryResult) => {
  const goalText = normalizeText(summary.goalText)
  const contentText = normalizeText(summary.contentText)

  if (
    !contentText
    || contentText === goalText
    || goalText.includes(contentText)
    || contentText.includes(goalText)
  ) {
    return []
  }

  return [contentText]
}

const buildNextStepLines = (summary: NocodeEditorSingleFormPlanSummaryResult) => (
  summary.openQuestions.length
    ? [
      i18next.t('nocodeEditorConfirmationCardPresentation.confirmItemsInOrder'),
      i18next.t('nocodeEditorConfirmationCardPresentation.replyToContinue', {
        label: i18next.t('nocodeEditorConfirmationCopy.pendingContinueLabel'),
      }),
    ]
    : [
      i18next.t('nocodeEditorConfirmationCardPresentation.confirmDirection'),
      i18next.t('nocodeEditorConfirmationCardPresentation.addQuestions'),
    ]
)

const isSummaryResult = (
  value: unknown,
): value is NocodeEditorSingleFormPlanSummaryResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return (
    'eligible' in value
    && 'formName' in value
    && 'goalText' in value
    && 'contentText' in value
    && 'scopeText' in value
    && 'openQuestions' in value
  )
}

const resolveFormPlanSummary = (
  input: SharedFormPlanInput | NocodeEditorSingleFormPlanSummaryResult,
) => (
  isSummaryResult(input)
    ? input
    : resolveNocodeEditorSingleFormPlanSummary(input)
)

const buildPlanningItems = (artifacts: unknown): string[] => (
  toUnknownArray(artifacts)
    .map((item) => {
      const artifact = toRecord(item)
      const name = normalizeText(artifact.name)
      if (!name) {
        return ''
      }
      return i18next.t('nocodeEditorConfirmationCardPresentation.planningItem', {
        level: resolveNocodeEditorAppBuilderExecutionLevelLabel(artifact.executionLevel ?? artifact.execution_level),
        name,
        type: resolveNocodeEditorAppBuilderPlanningArtifactTypeLabel(artifact.type),
      })
    })
    .filter(Boolean)
)

const buildPlanningScopeText = (artifacts: unknown) => {
  const executionLevelGroups = toUnknownArray(artifacts).reduce<Record<string, string[]>>((summary, item) => {
    const artifact = toRecord(item)
    const name = normalizeText(artifact.name)
    if (!name) {
      return summary
    }
    const label = resolveNocodeEditorAppBuilderExecutionLevelLabel(artifact.executionLevel ?? artifact.execution_level)
    summary[label] = [...(summary[label] || []), name]
    return summary
  }, {})

  return Object.entries(executionLevelGroups)
    .map(([label, names]) => i18next.t('nocodeEditorConfirmationCardPresentation.scopeGroup', {
      label,
      names: names.join(i18next.t('nocodeEditorConfirmationCardPresentation.listSeparator')),
    }))
    .join('\n')
}

export const buildSharedAppPlanConfirmationCardPresentation = (input: {
  summary?: string
  goal?: string
  mode?: unknown
  objects?: unknown
  artifacts?: unknown
  openQuestions?: string[]
  confirmation?: NocodeEditorAiConfirmPayload | null
}): AiAssistantConfirmationCardPresentation | null => {
  const confirmation = normalizeNocodeEditorConfirmationPayload({
    stage: 'app-plan',
    confirmation: input.confirmation,
    openQuestions: input.openQuestions,
    summary: input.summary || input.goal,
    planningQuestionPresentation: true,
  })
  const pendingQuestions = projectPendingPlanningQuestionTitles(
    confirmation?.questions || [],
    confirmation?.status,
  )
  const goal = normalizeText(input.goal)
  const planningModeLabel = resolveNocodeEditorAppBuilderPlanningModeLabel(input.mode)
  const goalText = [
    planningModeLabel ? i18next.t('nocodeEditorConfirmationCardPresentation.buildMode', { mode: planningModeLabel }) : '',
    goal ? i18next.t('nocodeEditorConfirmationCardPresentation.goal', { goal }) : normalizeText(input.summary),
  ].filter(Boolean).join('\n')
  const coreObjects = normalizeStringList(input.objects)
  const planningItems = buildPlanningItems(input.artifacts)
  const scope = buildPlanningScopeText(input.artifacts)
  const nextSteps = pendingQuestions.length
    ? [
      i18next.t('nocodeEditorConfirmationCardPresentation.confirmInOrder'),
      i18next.t('nocodeEditorConfirmationCardPresentation.replyContinue', {
        label: i18next.t('nocodeEditorConfirmationCopy.pendingContinueLabel'),
      }),
    ]
    : [
      i18next.t('nocodeEditorConfirmationCardPresentation.viewAppStructure'),
      i18next.t('nocodeEditorConfirmationCardPresentation.confirmAndGenerate'),
    ]

  if (!goalText && !coreObjects.length && !planningItems.length && !scope) {
    return null
  }

  return {
    goal: goalText || undefined,
    coreObjects: coreObjects.length ? coreObjects : undefined,
    planningItems: planningItems.length ? planningItems : undefined,
    scope: scope || undefined,
    nextSteps,
    aiHandling: i18next.t('nocodeEditorConfirmationCardPresentation.appPlanHandling', {
      label: i18next.t('nocodeEditorConfirmationCopy.pendingContinueLabel'),
    }),
    pendingTitle: pendingQuestions.length
      ? i18next.t('nocodeEditorConfirmationCardPresentation.pendingItems', { count: pendingQuestions.length })
      : undefined,
  }
}

export const buildSharedFormPlanConfirmationCardPresentation = (
  input: SharedFormPlanInput | NocodeEditorSingleFormPlanSummaryResult,
): AiAssistantConfirmationCardPresentation | null => {
  const summary = resolveFormPlanSummary(input)
  if (!summary.eligible) {
    return null
  }

  const pendingTitle = summary.openQuestions.length
    ? i18next.t('nocodeEditorConfirmationCardPresentation.pendingItems', { count: summary.openQuestions.length })
    : i18next.t('nocodeEditorConfirmationCardPresentation.currentPlan')
  const fieldScopeItems = buildFieldScopeItems(summary)

  return {
    goal: buildGoalSectionText(summary),
    planningItems: fieldScopeItems.length ? fieldScopeItems : undefined,
    nextSteps: buildNextStepLines(summary),
    aiHandling: summary.directContinueRiskText
      || (
        summary.openQuestions.length
          ? i18next.t('nocodeEditorConfirmationCardPresentation.formPlanHandling', {
            label: i18next.t('nocodeEditorConfirmationCopy.pendingContinueLabel'),
          })
          : i18next.t('nocodeEditorConfirmationCardPresentation.formPlanReadyHandling')
      ),
    pendingTitle,
  }
}

export const buildSharedApplicationStructurePreview = (input: {
  previewMode: 'app-plan' | 'form-plan'
  outline?: unknown
  presentation?: UnknownRecord | null
}): AiAssistantApplicationStructurePreview | null => {
  const outline = input.outline && typeof input.outline === 'object' && !Array.isArray(input.outline)
    ? input.outline as UnknownRecord
    : null
  if (!outline) {
    return null
  }

  const forms = Array.isArray(outline.forms) ? outline.forms : []
  if (!forms.length) {
    return null
  }
  const modules = Array.isArray(outline.modules) ? outline.modules : []
  const presentation = input.presentation || {}
  const formCount = Number(presentation.formCount || forms.length || 0)
  const moduleCount = Number(presentation.moduleCount || modules.length || 0)
  const firstForm = toRecord(forms[0])
  const focusFormKey = normalizeText(firstForm.formKey)
  const focusFormName = normalizeText(firstForm.tableName)
  const highlightModuleKeys = modules
    .map(item => normalizeText(toRecord(item).moduleKey))
    .filter(Boolean)

  if (input.previewMode === 'form-plan' && formCount <= 1 && moduleCount <= 1) {
    return null
  }

  return {
    enabled: true,
    previewMode: input.previewMode,
    focusFormKey: focusFormKey || undefined,
    focusFormName: focusFormName || undefined,
    highlightModuleKeys: highlightModuleKeys.length ? highlightModuleKeys : undefined,
  }
}
