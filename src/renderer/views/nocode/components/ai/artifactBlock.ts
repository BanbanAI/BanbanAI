import type { AiAssistantArtifactBlock } from '@common/types/ai'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionOption,
  NocodeEditorAiConfirmStatus,
  NocodeEditorAiConfirmStage,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFormulaPath,
} from '@common/types/nocodeEditorFormula'
import {
  resolveNocodeEditorBlueprintDisplayTitle,
} from '@common/utils/nocodeEditorBlueprintTitle'
import {
  resolveSingleFormPlanningDisplayTitle,
} from '@common/utils/nocodeEditorPlanningTitle'
import {
  normalizeNocodeEditorPlanningOutline,
} from '@common/utils/nocodeEditorPlanningOutline'
import {
  normalizeNocodeEditorContentPlan,
} from '@common/utils/nocodeEditorContentPlan'
import {
  normalizeNocodeEditorFormulaPlan,
} from '@common/utils/nocodeEditorFormulaDomain'
import {
  normalizeNocodeEditorFlowScheme,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  countNocodeEditorFlowPlanTotalNodes,
  normalizeNocodeEditorFlowPlan,
} from '@common/utils/nocodeEditorFlowPlan'
import {
  getNocodeEditorCompletedDefaultsContinueLabel,
  getNocodeEditorDefaultContinueReplyAliases,
  getNocodeEditorPendingContinueLabel,
} from '@common/utils/nocodeEditorConfirmationCopy'
import {
  normalizeNocodeEditorConfirmationQuestion,
} from '@common/utils/nocodeEditorConfirmationNormalization'
import {
  resolveNocodeEditorPlanningQuestionProjection,
} from '@common/utils/nocodeEditorPlanningQuestionProjection'
import {
  projectBlueprintConfirmation,
} from '@common/utils/nocodeEditorBlueprintConfirmationProjection'
import {
  buildNocodeEditorVersionLabel,
} from '@common/utils/nocodeEditorVersionLabel'
import {
  isBlueprintAppliedDraftPhase,
  isBlueprintAppliedPhase,
  resolveBlueprintVersionKeyFromPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import {
  getDraftPersistenceActionIssueCount,
  hasDraftPersistenceBlockingActionIssues,
  isDraftPersistenceStateResolved,
} from '../../views/editor/ai/draftIssueActionList'
import {
  resolveNocodeEditorBlueprintFormulaSummaryLabels,
} from '../../views/editor/ai/formulaPlanPresentation'
import i18next from 'i18next'

type BlueprintStagedStateLike = {
  revision?: number
  stagedAt?: number
  phase?: unknown
  blueprint?: unknown | null
  sourcePlanningContextKey?: string | null
  applyResult?: {
    finishedAt?: number
  } | null
}

const formatTime = (value?: number) => {
  if (!value) return ''
  return new Date(value).toLocaleString(i18next.resolvedLanguage || i18next.language || navigator.language || 'en', {
    hour12: false,
  })
}

const toRecord = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
)

const isRecord = (value: unknown): value is Record<string, any> => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
)

const normalizeText = (value: unknown) => (
  value == null ? '' : String(value).trim()
)

const normalizeTextList = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const normalizeBlueprintLineageToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')
  .replace(/[^\p{Letter}\p{Number}]/gu, '')

const getBlueprintPlanningContextKey = (
  blockOrStagedState?: AiAssistantArtifactBlock | BlueprintStagedStateLike | null,
) => {
  const blockConfirmation = toRecord((blockOrStagedState as any)?.confirmation)
  const blueprintConfirmation = toRecord((blockOrStagedState as any)?.blueprint?.confirmation)
  return normalizeText(
    (blockOrStagedState as any)?.sourcePlanningContextKey
    || (blockOrStagedState as any)?.blueprint?.sourcePlanningContextKey
    || blockConfirmation.planningContextKey
    || blueprintConfirmation.planningContextKey
    || (blockOrStagedState as any)?.sourcePlanningContextKey,
  )
}

const buildBlueprintFieldLineageSignature = (field: unknown): string => {
  const fieldRecord = toRecord(field)
  const token = normalizeBlueprintLineageToken(fieldRecord.fieldKey || fieldRecord.key || fieldRecord.name)
  const children = Array.isArray(fieldRecord.children)
    ? fieldRecord.children
      .map(buildBlueprintFieldLineageSignature)
      .filter(Boolean)
      .sort()
    : []
  if (!token && !children.length) {
    return ''
  }
  return children.length ? `${token || 'field'}(${children.join('|')})` : token
}

const collectBlueprintFieldLineageTokens = (fields: unknown): string[] => {
  if (!Array.isArray(fields)) {
    return []
  }

  return fields
    .map(buildBlueprintFieldLineageSignature)
    .filter(Boolean)
}

const getBlueprintLineageKeyFromValue = (value?: unknown) => {
  const blueprint = toRecord(value)
  const forms = Array.isArray(blueprint.forms)
    ? blueprint.forms.filter(form => isRecord(form))
    : []

  if (!forms.length) {
    return ''
  }

  const formSignatures = forms
    .map((form) => {
      const formKey = normalizeBlueprintLineageToken(form.formKey)
      const groupName = normalizeBlueprintLineageToken(form.groupName)
      const tableName = normalizeBlueprintLineageToken(form.tableName || form.name)
      const fields = collectBlueprintFieldLineageTokens(form.fields).sort()
      return [
        formKey,
        groupName || 'nogroup',
        tableName || 'noname',
        fields.join('|'),
      ].join('::')
    })
    .sort()

  const duplicateCounts = new Map<string, number>()
  return formSignatures
    .map((signature) => {
      const nextCount = (duplicateCounts.get(signature) || 0) + 1
      duplicateCounts.set(signature, nextCount)
      return nextCount > 1 ? `${signature}#${nextCount}` : signature
    })
    .join('||')
}

const getFormPlanPresentation = (block: AiAssistantArtifactBlock) => (
  toRecord((block as any).formPlanPresentation)
)

const getApplicationStructurePreview = (block?: AiAssistantArtifactBlock | null) => (
  toRecord((block as any)?.applicationStructurePreview)
)

const hasRenderableOutline = (outline: unknown) => (
  Boolean(
    outline
    && typeof outline === 'object'
    && Array.isArray((outline as any).forms)
    && (outline as any).forms.length > 0,
  )
)

const hasApplicationStructurePreview = (block?: AiAssistantArtifactBlock | null) => (
  Boolean(
    getApplicationStructurePreview(block).enabled
    && hasRenderableOutline((block as any)?.outline),
  )
)

const hasRenderableAppPlanStructure = (block?: AiAssistantArtifactBlock | null) => (
  hasRenderableOutline((block as any)?.appPlan?.outline)
)

const getContentPlan = (block?: AiAssistantArtifactBlock | null) => (
  normalizeNocodeEditorContentPlan((block as any)?.plan)
)

const getFormulaPlan = (block?: AiAssistantArtifactBlock | null) => (
  normalizeNocodeEditorFormulaPlan((block as any)?.formulaPlan)
)

export type AiArtifactFormulaPlanItem = {
  key: string
  target: string
  formulaPath: NocodeEditorFormulaPath
  formula: string
  explanation: string
}

export const resolveAiArtifactFormulaPlanItems = (
  block?: AiAssistantArtifactBlock | null,
): AiArtifactFormulaPlanItem[] => {
  const plan = getFormulaPlan(block)
  if (!plan) {
    return []
  }

  return plan.items.flatMap(item => (
    item.formulaSettings.map(setting => ({
      key: `${item.itemKey}-${setting.formulaPath}`,
      target: [item.target.formName, item.target.fieldName].filter(Boolean).join(' / '),
      formulaPath: setting.formulaPath,
      formula: setting.formula,
      explanation: setting.explanation || '',
    }))
  ))
}

const getFlowPlan = (block?: AiAssistantArtifactBlock | null) => (
  normalizeNocodeEditorFlowPlan((block as any)?.flowPlan)
)

const getFlowScheme = (block?: AiAssistantArtifactBlock | null) => (
  normalizeNocodeEditorFlowScheme((block as any)?.scheme)
)

const buildSyntheticFormPlanOutline = (
  block?: AiAssistantArtifactBlock | null,
) => {
  const record = toRecord(block)
  const confirmation = isRecord(record.confirmation) ? record.confirmation : null
  const confirmationQuestionTitles = Array.isArray(confirmation?.questions)
    ? confirmation.questions
      .map((question) => normalizeText((question as Record<string, unknown>)?.title))
      .filter(Boolean)
    : []
  const fallbackTableName = normalizeText(record.title) || '表单规划'
  return normalizeNocodeEditorPlanningOutline({
    title: record.title,
    summary: record.summary,
    forms: [{
      tableName: fallbackTableName,
      description: record.summary,
    }],
    openQuestions: confirmationQuestionTitles,
    confirmation,
  }, {
    confirmationStage: 'form-plan',
  })
}

const getNormalizedFormPlanOutline = (block?: AiAssistantArtifactBlock | null) => (
  block?.kind === 'form-plan'
    ? (
      normalizeNocodeEditorPlanningOutline((block as any)?.outline, {
        confirmationStage: 'form-plan',
        legacyConfirmation: (block as any)?.confirmation,
      })
      || buildSyntheticFormPlanOutline(block)
    )
    : null
)

const getBlueprintFormCount = (block: AiAssistantArtifactBlock) => (
  Array.isArray((block as any).blueprint?.forms)
    ? (block as any).blueprint.forms.length
    : 0
)

const countBlueprintFieldList = (fields: unknown): number => {
  if (!Array.isArray(fields)) {
    return 0
  }

  return fields.reduce((total, field) => {
    return total + 1 + countBlueprintFieldList((field as any)?.children)
  }, 0)
}

const getBlueprintFieldCount = (block: AiAssistantArtifactBlock) => {
  const forms = Array.isArray((block as any).blueprint?.forms)
    ? (block as any).blueprint.forms
    : []
  return forms.reduce((total: number, form: any) => {
    return total + countBlueprintFieldList(form?.fields)
  }, 0)
}

export const isAiArtifactBlock = (value: unknown): value is AiAssistantArtifactBlock => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const rawBlock = value as Record<string, any>
  const kind = String(rawBlock.kind || '').trim()
  return rawBlock.type === 'artifact' && ['nocode-app', 'app-plan', 'form-plan', 'content-plan', 'formula-plan', 'flow-scheme', 'flow-plan', 'blueprint'].includes(kind)
}

export const resolveAiArtifactNocodeId = (block?: AiAssistantArtifactBlock | null) => (
  String((block as any)?.app?.nocodeId || '').trim()
)

export const resolveAiArtifactVersionLabel = (block?: AiAssistantArtifactBlock | null) => {
  const displayVersionLabel = String((block as any)?.displayVersionLabel || '').trim()
  if (displayVersionLabel) {
    return displayVersionLabel
  }

  const displayRevisionLabel = buildNocodeEditorVersionLabel(Number((block as any)?.displayRevision || 0))
  if (displayRevisionLabel) {
    return displayRevisionLabel
  }

  const label = buildNocodeEditorVersionLabel(Number((block as any)?.revision || 0))
  if (label) {
    return label
  }

  const version = String((block as any)?.version || '').trim()
  if (version) {
    return version
  }

  return ''
}

export const canPreviewAiArtifact = (block?: AiAssistantArtifactBlock | null) => {
  if (!block || block.status !== 'ready') {
    return false
  }

  if (block.kind === 'app-plan') {
    return Boolean(hasRenderableAppPlanStructure(block))
  }

  if (block.kind === 'form-plan') {
    return Boolean(hasApplicationStructurePreview(block) && (block as any).outline)
  }

  if (block.kind === 'content-plan') {
    return Boolean(getContentPlan(block))
  }

  if (block.kind === 'formula-plan') {
    return Boolean(getFormulaPlan(block))
  }

  if (block.kind === 'flow-scheme') {
    return false
  }

  if (block.kind === 'flow-plan') {
    return Boolean(getFlowPlan(block))
  }

  if (block.kind === 'blueprint') {
    return Boolean((block as any).blueprint)
  }

  return false
}

export const canOpenAiArtifact = (block?: AiAssistantArtifactBlock | null) => {
  return Boolean(canPreviewAiArtifact(block) || resolveAiArtifactNocodeId(block))
}

export type AiArtifactConfirmationQuestion = NocodeEditorAiConfirmQuestion
export type AiArtifactConfirmationQuestionOption = NocodeEditorAiConfirmQuestionOption

const resolveAiArtifactConfirmationStage = (
  block?: AiAssistantArtifactBlock | null,
): NocodeEditorAiConfirmStage | null => {
  if (!block) {
    return null
  }

  if (block.kind === 'formula-plan') {
    return 'form-plan'
  }

  if (block.kind === 'app-plan'
    || block.kind === 'form-plan'
    || block.kind === 'content-plan'
    || block.kind === 'flow-scheme'
    || block.kind === 'flow-plan'
    || block.kind === 'blueprint') {
    return block.kind
  }

  return null
}

const resolveAiArtifactLegacyQuestionTitles = (
  block?: AiAssistantArtifactBlock | null,
) => {
  if (!block) {
    return []
  }

  if (block.kind === 'app-plan') {
    return normalizeTextList((block as any).appPlan?.openQuestions)
  }

  if (block.kind === 'form-plan') {
    return normalizeTextList(getNormalizedFormPlanOutline(block)?.openQuestions)
  }

  if (block.kind === 'content-plan') {
    return normalizeTextList(getContentPlan(block)?.openQuestions)
  }

  if (block.kind === 'formula-plan') {
    return normalizeTextList(getFormulaPlan(block)?.openQuestions)
  }

  if (block.kind === 'flow-scheme') {
    return normalizeTextList(getFlowScheme(block)?.openQuestions?.map(question => question.title))
  }

  if (block.kind === 'blueprint') {
    return normalizeTextList((block as any).blueprint?.openQuestions)
  }

  return []
}

const resolveAiArtifactOpenQuestionIds = (
  block?: AiAssistantArtifactBlock | null,
) => {
  if (!block) {
    return []
  }

  if (block.kind === 'flow-scheme') {
    const scheme = getFlowScheme(block)
    if (!scheme) {
      return []
    }

    return Array.from(new Set(
      scheme.openQuestions.flatMap(question => (
        [question.key].map(item => normalizeText(item)).filter(Boolean)
      )),
    ))
  }

  return []
}

const resolveAiArtifactOpenQuestionTitles = (
  block?: AiAssistantArtifactBlock | null,
) => {
  if (!block) {
    return []
  }

  if (block.kind === 'app-plan') {
    const appPlan = toRecord((block as any).appPlan)
    const outline = toRecord(appPlan.outline)
    return normalizeTextList(appPlan.openQuestions).length
      ? normalizeTextList(appPlan.openQuestions)
      : normalizeTextList(outline.openQuestions)
  }

  if (block.kind === 'form-plan') {
    return normalizeTextList(getNormalizedFormPlanOutline(block)?.openQuestions)
  }

  if (block.kind === 'content-plan') {
    return normalizeTextList(getContentPlan(block)?.openQuestions)
  }

  if (block.kind === 'formula-plan') {
    return normalizeTextList(getFormulaPlan(block)?.openQuestions)
  }

  if (block.kind === 'blueprint') {
    return normalizeTextList((block as any).blueprint?.openQuestions)
  }

  return []
}

const normalizeConfirmationStatus = (value: unknown): NocodeEditorAiConfirmStatus | '' => {
  const status = normalizeText(value)
  if (status === 'pending' || status === 'completed') {
    return status as NocodeEditorAiConfirmStatus
  }
  return ''
}

const resolveAiArtifactRawConfirmation = (
  block?: AiAssistantArtifactBlock | null,
): NocodeEditorAiConfirmPayload | null => {
  if (!block) {
    return null
  }

  if (block.kind === 'form-plan') {
    const outline = toRecord(getNormalizedFormPlanOutline(block))
    if (isRecord(outline.confirmation)) {
      return outline.confirmation as NocodeEditorAiConfirmPayload
    }
  }

  if (isRecord((block as any).confirmation)) {
    return (block as any).confirmation as NocodeEditorAiConfirmPayload
  }

  if (block.kind === 'app-plan') {
    const appPlan = toRecord((block as any).appPlan)
    const outline = toRecord(appPlan.outline)
    if (isRecord(appPlan.confirmation)) {
      return appPlan.confirmation as NocodeEditorAiConfirmPayload
    }
    if (isRecord(outline.confirmation)) {
      return outline.confirmation as NocodeEditorAiConfirmPayload
    }
  }

  if (block.kind === 'content-plan') {
    const plan = toRecord(getContentPlan(block))
    if (isRecord(plan.confirmation)) {
      return plan.confirmation as NocodeEditorAiConfirmPayload
    }
  }

  if (block.kind === 'formula-plan') {
    const plan = toRecord(getFormulaPlan(block))
    if (isRecord(plan.confirmation)) {
      return plan.confirmation as NocodeEditorAiConfirmPayload
    }
  }

  if (block.kind === 'flow-scheme') {
    const scheme = toRecord(getFlowScheme(block))
    if (isRecord(scheme.confirmation)) {
      return scheme.confirmation as NocodeEditorAiConfirmPayload
    }
  }

  if (block.kind === 'blueprint') {
    const blueprint = toRecord((block as any).blueprint)
    if (isRecord(blueprint.confirmation)) {
      return blueprint.confirmation as NocodeEditorAiConfirmPayload
    }
  }

  return null
}

const resolveAiArtifactPlanningProjection = (
  block?: AiAssistantArtifactBlock | null,
) => {
  if (block?.kind !== 'app-plan' && block?.kind !== 'form-plan') {
    return null
  }

  const stage = block.kind
  const blockRecord = toRecord(block)
  const appPlan = stage === 'app-plan'
    ? toRecord(blockRecord.appPlan)
    : {}
  const rawOutline = stage === 'app-plan'
    ? toRecord(appPlan.outline)
    : toRecord(getNormalizedFormPlanOutline(block))
  const outerConfirmation = isRecord(blockRecord.confirmation)
    ? blockRecord.confirmation
    : null
  const legacyConfirmation = outerConfirmation
    || (isRecord(appPlan.confirmation) ? appPlan.confirmation : null)

  return resolveNocodeEditorPlanningQuestionProjection({
    stage,
    structuredConfirmation: rawOutline.confirmation,
    legacyConfirmation,
    legacyOpenQuestions: [
      ...(Array.isArray(appPlan.openQuestions) ? appPlan.openQuestions : []),
      ...(Array.isArray(rawOutline.openQuestions) ? rawOutline.openQuestions : []),
    ],
    summary: stage === 'form-plan'
      ? rawOutline.summary
      : rawOutline.summary || blockRecord.summary,
  })
}

const resolveQuestionSelectedOptionValue = (
  question?: Partial<AiArtifactConfirmationQuestion> | null,
) => {
  const explicitValue = normalizeText(question?.selectedOptionValue)
  if (explicitValue) {
    return explicitValue
  }

  const options = Array.isArray(question?.options) ? question.options : []
  return normalizeText(options.find(option => option?.selected)?.value)
}

const isConfirmedQuestion = (
  question?: Partial<AiArtifactConfirmationQuestion> | null,
) => (
  Boolean(
    question?.confirmed
    || resolveQuestionSelectedOptionValue(question)
    || normalizeText(question?.answerSummary),
  )
)

const normalizeAiArtifactConfirmationQuestions = (
  block?: AiAssistantArtifactBlock | null,
) => {
  const stage = resolveAiArtifactConfirmationStage(block)
  const confirmation = resolveAiArtifactRawConfirmation(block)
  if (!stage || !confirmation || !Array.isArray(confirmation.questions)) {
    return []
  }

  // Reuse shared normalization so historical artifact questions keep questionKind semantics.
  return confirmation.questions
    .map((question, index) => normalizeNocodeEditorConfirmationQuestion(question, index, stage))
    .filter((question): question is AiArtifactConfirmationQuestion => Boolean(question))
}

export const resolveAiArtifactConfirmation = (
  block?: AiAssistantArtifactBlock | null,
): NocodeEditorAiConfirmPayload | null => {
  const planningProjection = resolveAiArtifactPlanningProjection(block)
  if (planningProjection) {
    return planningProjection.confirmation
  }

  const confirmation = resolveAiArtifactRawConfirmation(block)
  if (block?.kind === 'blueprint') {
    const blueprint = toRecord((block as any).blueprint)
    const projection = projectBlueprintConfirmation({
      confirmation,
      openQuestions: blueprint.openQuestions,
      summary: blueprint.summary || (block as any).summary,
    })
    if (projection.confirmation) {
      return projection.confirmation
    }

    const rawConfirmation = toRecord(confirmation)
    const isEmptyBlueprintGate = (
      rawConfirmation.preferredSurface === 'gate'
      && Array.isArray(rawConfirmation.questions)
      && rawConfirmation.questions.length === 0
    )
    return isEmptyBlueprintGate ? confirmation : null
  }

  const questions = normalizeAiArtifactConfirmationQuestions(block)
  if (confirmation && Array.isArray(confirmation.questions)) {
    const summary = normalizeText(confirmation.summary)
    const completionSummary = normalizeText(confirmation.completionSummary)
    const resultSummary = normalizeTextList(confirmation.resultSummary)
    return {
      ...confirmation,
      stage: confirmation.stage || resolveAiArtifactConfirmationStage(block) || undefined,
      status: normalizeConfirmationStatus(confirmation.status) || undefined,
      summary: summary || undefined,
      completionSummary: completionSummary || undefined,
      resultSummary: resultSummary.length ? resultSummary : undefined,
      secondaryActionLabel: normalizeText(confirmation.secondaryActionLabel) || undefined,
      reviewLabel: normalizeText(confirmation.reviewLabel) || undefined,
      questions,
    }
  }

  const stage = resolveAiArtifactConfirmationStage(block)
  const legacyQuestions = resolveAiArtifactLegacyQuestionTitles(block)
  if (!stage || !legacyQuestions.length) {
    return null
  }

  const summary = normalizeText((block as any)?.summary)
  const legacyArtifactQuestions = legacyQuestions.map((title, index) => {
    return {
      id: `${stage}-legacy-question-${index + 1}`,
      title,
    }
  })

  return {
    stage,
    status: 'pending',
    summary: summary || undefined,
    questions: legacyArtifactQuestions,
  }
}

export const resolveAiArtifactQuestions = (
  block?: AiAssistantArtifactBlock | null,
): AiArtifactConfirmationQuestion[] => (
  resolveAiArtifactConfirmation(block)?.questions || []
)

export const resolveAiArtifactPendingQuestions = (
  block?: AiAssistantArtifactBlock | null,
): AiArtifactConfirmationQuestion[] => {
  const allQuestions = resolveAiArtifactQuestions(block)
  if (block?.kind === 'flow-scheme') {
    const openQuestionIds = new Set(resolveAiArtifactOpenQuestionIds(block))
    if (openQuestionIds.size > 0) {
      return allQuestions.filter((question) => {
        const decisionKey = normalizeText(question.decisionKey) || normalizeText(question.id)
        return openQuestionIds.has(decisionKey)
      })
    }
  }
  return allQuestions.filter(question => question.confirmed !== true)
}

export const resolveAiArtifactConfirmationQuestionCount = (
  block?: AiAssistantArtifactBlock | null,
) => (
  resolveAiArtifactQuestions(block).length
)

export const resolveAiArtifactConfirmedQuestionCount = (
  block?: AiAssistantArtifactBlock | null,
) => (
  resolveAiArtifactQuestions(block).reduce((total, question) => (
    total + (isConfirmedQuestion(question) ? 1 : 0)
  ), 0)
)

export const resolveAiArtifactQuestionTitles = (
  block?: AiAssistantArtifactBlock | null,
) => (
  resolveAiArtifactQuestions(block).map(question => question.title)
)

export const resolveAiArtifactConfirmationStatus = (
  block?: AiAssistantArtifactBlock | null,
): NocodeEditorAiConfirmStatus | '' => {
  const confirmation = resolveAiArtifactConfirmation(block)
  const questionCount = resolveAiArtifactConfirmationQuestionCount(block)
  const explicitStatus = normalizeConfirmationStatus(confirmation?.status)
  if (
    explicitStatus === 'completed'
    && questionCount <= 0
    && block?.kind !== 'blueprint'
  ) {
    return ''
  }
  if (explicitStatus) {
    return explicitStatus
  }

  if (questionCount > 0 && resolveAiArtifactConfirmedQuestionCount(block) >= questionCount) {
    return 'completed'
  }

  return questionCount > 0 ? 'pending' : ''
}

export const resolveAiArtifactPendingQuestionCount = (
  block?: AiAssistantArtifactBlock | null,
) => (
  resolveAiArtifactPendingQuestions(block).length
)

export const resolveAiArtifactConfirmationSummary = (
  block?: AiAssistantArtifactBlock | null,
) => {
  const summary = normalizeText(resolveAiArtifactConfirmation(block)?.summary)
  return summary || ''
}

export const resolveAiArtifactCompletionSummary = (
  block?: AiAssistantArtifactBlock | null,
) => {
  const confirmation = resolveAiArtifactConfirmation(block)
  const explicitSummary = normalizeText(confirmation?.completionSummary)
  if (explicitSummary) {
    return explicitSummary
  }

  if (resolveAiArtifactConfirmationStatus(block) !== 'completed') {
    return ''
  }

  if (block?.kind === 'app-plan') {
    return i18next.t('artifactBlock.appPlanConfirmationCompleted')
  }

  if (block?.kind === 'form-plan' || block?.kind === 'content-plan') {
    return i18next.t('artifactBlock.planConfirmationCompleted')
  }

  if (block?.kind === 'flow-scheme') {
    return i18next.t('artifactBlock.flowSchemeConfirmationCompleted')
  }

  if (block?.kind === 'flow-plan') {
    return i18next.t('artifactBlock.flowPlanConfirmationCompleted')
  }

  return i18next.t('artifactBlock.confirmationCompleted')
}

export const resolveAiArtifactResultSummary = (
  block?: AiAssistantArtifactBlock | null,
) => {
  const explicitSummary = normalizeTextList(resolveAiArtifactConfirmation(block)?.resultSummary)
  if (explicitSummary.length) {
    return explicitSummary
  }

  return resolveAiArtifactQuestions(block)
    .filter(question => isConfirmedQuestion(question))
    .map((question) => {
      const answerSummary = resolveAiArtifactQuestionAnswerSummary(question)
      return answerSummary || question.title
    })
    .filter(Boolean)
}

export const resolveAiArtifactQuestionSelectedOption = (
  question?: AiArtifactConfirmationQuestion | null,
) => {
  const selectedOptionValue = resolveQuestionSelectedOptionValue(question)
  const options = Array.isArray(question?.options) ? question.options : []
  return options.find((option) => (
    Boolean(option?.selected)
    || (selectedOptionValue && normalizeText(option?.value) === selectedOptionValue)
  )) || null
}

export const resolveAiArtifactQuestionAnswerSummary = (
  question?: AiArtifactConfirmationQuestion | null,
) => {
  const explicitSummary = normalizeText(question?.answerSummary)
  if (explicitSummary) {
    return explicitSummary
  }

  return normalizeText(resolveAiArtifactQuestionSelectedOption(question)?.label)
}

export const resolveAiArtifactQuestionAnswerDetail = (
  question?: AiArtifactConfirmationQuestion | null,
) => {
  const explicitDetail = normalizeText(question?.answerDetail)
  if (explicitDetail) {
    return explicitDetail
  }

  const selectedOptionDescription = normalizeText(
    resolveAiArtifactQuestionSelectedOption(question)?.description,
  )
  if (selectedOptionDescription) {
    return selectedOptionDescription
  }

  return normalizeText(question?.description)
}

export const resolveAiArtifactContinueLabel = (
  block?: AiAssistantArtifactBlock | null,
) => {
  const questionCount = resolveAiArtifactConfirmationQuestionCount(block)
  if (!block) {
    return ''
  }

  const confirmationStatus = resolveAiArtifactConfirmationStatus(block)
  if (block.kind !== 'blueprint' && questionCount <= 0 && confirmationStatus !== 'completed') {
    return ''
  }

  const explicitLabel = normalizeText(resolveAiArtifactConfirmation(block)?.continueLabel)
  const hasExplicitConfirmedAnswers = resolveAiArtifactQuestions(block)
    .some(question => isConfirmedQuestion(question))
  const isPendingDefaultContinueAlias = (label: string) => (
    getNocodeEditorDefaultContinueReplyAliases().includes(label)
  )
  if (explicitLabel) {
    if (
      block?.kind !== 'blueprint'
      && confirmationStatus === 'completed'
      && explicitLabel === getNocodeEditorCompletedDefaultsContinueLabel()
    ) {
      return explicitLabel
    }
    if (
      block?.kind !== 'blueprint'
      && confirmationStatus === 'completed'
      && explicitLabel === '按确认结果生成'
    ) {
      return i18next.t('artifactBlock.continuedWithConfirmedPlan')
    }
    if (
      block?.kind !== 'blueprint'
      && confirmationStatus !== 'completed'
      && isPendingDefaultContinueAlias(explicitLabel)
    ) {
      return getNocodeEditorPendingContinueLabel()
    }
    if (explicitLabel.startsWith('已')) {
      return explicitLabel
    }
    return explicitLabel
  }

  if (block.kind === 'blueprint') {
    return i18next.t('artifactBlock.generateFromBlueprint')
  }

  if (block.kind === 'app-plan' && !confirmationStatus && questionCount <= 0) {
    return ''
  }

  if (block.kind === 'app-plan' || block.kind === 'form-plan' || block.kind === 'content-plan' || block.kind === 'formula-plan' || block.kind === 'flow-scheme') {
    if (confirmationStatus === 'completed') {
      return hasExplicitConfirmedAnswers
        ? i18next.t('artifactBlock.continuedWithConfirmedPlan')
        : getNocodeEditorCompletedDefaultsContinueLabel()
    }
    return getNocodeEditorPendingContinueLabel()
  }

  if (block.kind === 'flow-plan') {
    return confirmationStatus === 'completed'
      ? (hasExplicitConfirmedAnswers
        ? i18next.t('artifactBlock.continuedWithConfirmedPlan')
        : getNocodeEditorCompletedDefaultsContinueLabel())
      : getNocodeEditorPendingContinueLabel()
  }

  return ''
}

export const resolveAiArtifactConfirmationStageLabel = (
  block?: AiAssistantArtifactBlock | null,
) => {
  if (!block) {
    return ''
  }

  if (block.kind === 'app-plan') {
    return i18next.t('artifactBlock.appPlanConfirmation')
  }

  if (block.kind === 'form-plan') {
    return i18next.t('artifactBlock.formConfirmation')
  }

  if (block.kind === 'content-plan') {
    return i18next.t('artifactBlock.contentConfirmation')
  }

  if (block.kind === 'formula-plan') {
    return i18next.t('formulaPlanPresentation.title')
  }

  if (block.kind === 'flow-scheme') {
    return i18next.t('artifactBlock.flowSchemeConfirmation')
  }

  if (block.kind === 'flow-plan') {
    return i18next.t('artifactBlock.flowConfirmation')
  }

  if (block.kind === 'blueprint') {
    return i18next.t('artifactBlock.blueprintConfirmation')
  }

  return ''
}

export const resolveAiArtifactConfirmationBadge = (
  block?: AiAssistantArtifactBlock | null,
) => {
  const count = resolveAiArtifactPendingQuestionCount(block)
  if (count <= 0) {
    return ''
  }

  if (block?.kind === 'blueprint' && isBlueprintAppliedArtifact(block)) {
    return i18next.t('artifactBlock.preGenerationRecordCount', { count })
  }

  return i18next.t('artifactBlock.pendingConfirmationCount', { count })
}

export const shouldRenderAiArtifactInlineConfirmation = (
  block?: AiAssistantArtifactBlock | null,
) => {
  if (!block || block.status !== 'ready') {
    return false
  }

  if (block.kind === 'blueprint') {
    return false
  }

  if (block.kind !== 'app-plan' && block.kind !== 'form-plan' && block.kind !== 'content-plan' && block.kind !== 'formula-plan' && block.kind !== 'flow-scheme' && block.kind !== 'flow-plan') {
    return false
  }

  if (block.kind === 'flow-scheme') {
    return resolveAiArtifactPendingQuestionCount(block) > 0
  }

  const confirmation = resolveAiArtifactConfirmation(block)
  if (!confirmation) {
    return false
  }

  if (block.kind === 'flow-plan') {
    return resolveAiArtifactPendingQuestionCount(block) > 0
  }

  return resolveAiArtifactConfirmationQuestionCount(block) > 0
    || resolveAiArtifactConfirmationStatus(block) === 'completed'
    || Boolean(resolveAiArtifactCompletionSummary(block))
    || resolveAiArtifactResultSummary(block).length > 0
}

const getBlueprintOpenQuestionCount = (block?: AiAssistantArtifactBlock | null) => {
  return resolveAiArtifactPendingQuestionCount(block)
}

const isBlueprintAppliedArtifact = (block?: AiAssistantArtifactBlock | null) => (
  isBlueprintAppliedPhase((block as any)?.phase)
)

const getBlueprintDraftPersistenceState = (block?: AiAssistantArtifactBlock | null) => (
  toRecord((block as any)?.draftPersistenceState)
)

const isBlueprintDraftPersistenceResolved = (block?: AiAssistantArtifactBlock | null) => (
  isDraftPersistenceStateResolved(getBlueprintDraftPersistenceState(block) as any)
)

const hasBlueprintBlockingDraftIssues = (block?: AiAssistantArtifactBlock | null) => (
  hasDraftPersistenceBlockingActionIssues(getBlueprintDraftPersistenceState(block) as any)
)

const getBlueprintDraftIssueCount = (block?: AiAssistantArtifactBlock | null) => (
  getDraftPersistenceActionIssueCount(getBlueprintDraftPersistenceState(block) as any)
)

const buildBlueprintDraftIdentityKeyFromBlock = (block?: AiAssistantArtifactBlock | null) => {
  const blueprintId = String((block as any)?.blueprint?.id || '').trim()
  if (blueprintId) {
    return blueprintId
  }

  const revision = Number((block as any)?.revision || 0)
  const stagedAt = Number((block as any)?.stagedAt || 0)
  if (revision > 0 || stagedAt > 0) {
    return `${revision}:${stagedAt}`
  }

  return ''
}

const buildBlueprintDraftIdentityKeyFromStagedState = (value?: BlueprintStagedStateLike | null) => {
  const blueprintId = String((value?.blueprint as any)?.id || '').trim()
  if (blueprintId) {
    return blueprintId
  }

  const revision = Number(value?.revision || 0)
  const stagedAt = Number(value?.stagedAt || 0)
  if (revision > 0 || stagedAt > 0) {
    return `${revision}:${stagedAt}`
  }

  return ''
}

const buildBlueprintVersionKeyFromBlock = (block?: AiAssistantArtifactBlock | null) => resolveBlueprintVersionKeyFromPhase({
  revision: (block as any)?.revision,
  stagedAt: (block as any)?.stagedAt,
  phase: (block as any)?.phase,
  applyResult: (block as any)?.applyResult || null,
})

const buildBlueprintVersionKeyFromStagedState = (value?: BlueprintStagedStateLike | null) => resolveBlueprintVersionKeyFromPhase({
  revision: value?.revision,
  stagedAt: value?.stagedAt,
  phase: value?.phase,
  applyResult: value?.applyResult || null,
})

export const doesBlueprintArtifactShareDraftIdentity = (
  block?: AiAssistantArtifactBlock | null,
  value?: BlueprintStagedStateLike | null,
) => {
  if (!block || block.kind !== 'blueprint' || block.status !== 'ready') {
    return false
  }

  if (!value?.blueprint) {
    return false
  }

  const blockIdentityKey = buildBlueprintDraftIdentityKeyFromBlock(block)
  const stagedIdentityKey = buildBlueprintDraftIdentityKeyFromStagedState(value)
  if (!blockIdentityKey || !stagedIdentityKey || blockIdentityKey !== stagedIdentityKey) {
    return false
  }

  const blockPlanningContextKey = getBlueprintPlanningContextKey(block)
  const stagedPlanningContextKey = getBlueprintPlanningContextKey(value)
  if (
    blockPlanningContextKey
    && stagedPlanningContextKey
    && blockPlanningContextKey !== stagedPlanningContextKey
  ) {
    return false
  }

  const blockLineageKey = getBlueprintLineageKeyFromValue((block as any).blueprint)
  const stagedLineageKey = getBlueprintLineageKeyFromValue(value.blueprint)
  if (blockLineageKey && stagedLineageKey && blockLineageKey !== stagedLineageKey) {
    return false
  }

  return true
}

export const doesBlueprintArtifactMatchStagedState = (
  block?: AiAssistantArtifactBlock | null,
  value?: BlueprintStagedStateLike | null,
) => {
  return doesBlueprintArtifactShareDraftIdentity(block, value)
    && buildBlueprintVersionKeyFromBlock(block) === buildBlueprintVersionKeyFromStagedState(value)
}

export type BlueprintStatusTag = string
export type AiArtifactStatusTag = string

export type AiArtifactFormPlanStructuredView = null

type ResolveArtifactStatusTagInput = {
  applying?: boolean
}

const resolveFlowArtifactStatusTag = (
  block?: AiAssistantArtifactBlock | null,
  input: ResolveArtifactStatusTagInput = {},
): AiArtifactStatusTag | '' => {
  if (!block || block.kind !== 'flow-plan' || block.status !== 'ready') {
    return ''
  }

  if ((block as any).flowApplyResult) {
    return i18next.t('artifactBlock.generated')
  }

  if (input.applying) {
    return i18next.t('artifactBlock.generating')
  }

  if (resolveAiArtifactPendingQuestionCount(block) > 0) {
    return i18next.t('artifactBlock.pendingConfirmation')
  }

  return i18next.t('artifactBlock.pendingGeneration')
}

export const resolveAiArtifactStatusTag = (
  block?: AiAssistantArtifactBlock | null,
  input: ResolveArtifactStatusTagInput = {},
): AiArtifactStatusTag | '' => {
  if (!block || block.status !== 'ready') {
    return ''
  }

  if (block.kind === 'flow-scheme') {
    return resolveAiArtifactPendingQuestionCount(block) > 0
      ? i18next.t('artifactBlock.pendingConfirmation')
      : i18next.t('artifactBlock.pendingValidation')
  }

  if (block.kind === 'flow-plan') {
    return resolveFlowArtifactStatusTag(block, input)
  }

  if (block.kind !== 'blueprint') {
    return ''
  }

  const phase = (block as any).phase
  if (isBlueprintAppliedPhase(phase)) {
    return i18next.t('artifactBlock.generated')
  }

  if (input.applying) {
    return i18next.t('artifactBlock.generating')
  }

  const openQuestionCount = getBlueprintOpenQuestionCount(block)
  if (openQuestionCount > 0) {
    return i18next.t('artifactBlock.pendingConfirmation')
  }

  return i18next.t('artifactBlock.pendingGeneration')
}

export type BlueprintStatusTagTone = 'pending' | 'ready' | 'applying' | 'applied'

export const resolveAiArtifactStatusTagTone = (
  label: AiArtifactStatusTag | '',
): BlueprintStatusTagTone | '' => {
  if (label === i18next.t('artifactBlock.pendingConfirmation')) return 'pending'
  if (label === i18next.t('artifactBlock.pendingValidation')) return 'pending'
  if (label === i18next.t('artifactBlock.pendingGeneration')) return 'ready'
  if (label === i18next.t('artifactBlock.generating')) return 'applying'
  if (label === i18next.t('artifactBlock.generated')) return 'applied'
  if (label === i18next.t('artifactBlock.draftIncomplete')) return 'pending'
  return ''
}

export const resolveBlueprintStatusTag = (
  block?: AiAssistantArtifactBlock | null,
  input: ResolveArtifactStatusTagInput = {},
): BlueprintStatusTag | '' => {
  if (!block || block.kind !== 'blueprint') {
    return ''
  }

  return resolveAiArtifactStatusTag(block, input) as BlueprintStatusTag | ''
}

export const resolveBlueprintStatusTagTone = (
  label: BlueprintStatusTag | '',
): BlueprintStatusTagTone | '' => (
  resolveAiArtifactStatusTagTone(label)
)

export const resolveAiArtifactFormPlanStructuredView = (
  block?: AiAssistantArtifactBlock | null,
): AiArtifactFormPlanStructuredView | null => {
  void block
  return null
}

export const resolveAiArtifactCaption = (block: AiAssistantArtifactBlock) => {
  if (block.status === 'loading') {
    if (block.kind === 'nocode-app') {
      return i18next.t('artifactBlock.appCreating')
    }
    if (block.kind === 'app-plan') {
      return i18next.t('artifactBlock.appPlanGenerating')
    }
    if (block.kind === 'form-plan') {
      return i18next.t('artifactBlock.formPlanGenerating')
    }
    if (block.kind === 'content-plan') {
      return i18next.t('artifactBlock.contentPlanGenerating')
    }
    if (block.kind === 'formula-plan') {
      return i18next.t('formulaPlanPresentation.loading')
    }
    if (block.kind === 'flow-scheme') {
      return i18next.t('artifactBlock.flowSchemeGenerating')
    }
    if (block.kind === 'flow-plan') {
      return i18next.t('artifactBlock.flowBlueprintGenerating')
    }
    return i18next.t('artifactBlock.blueprintGenerating')
  }

  if (block.status === 'error') {
    if (block.kind === 'nocode-app') {
      return i18next.t('artifactBlock.appCreateFailed')
    }
    if (block.kind === 'app-plan') {
      return i18next.t('artifactBlock.appPlanGenerationFailed')
    }
    if (block.kind === 'form-plan') {
      return i18next.t('artifactBlock.formPlanGenerationFailed')
    }
    if (block.kind === 'content-plan') {
      return i18next.t('artifactBlock.contentPlanGenerationFailed')
    }
    if (block.kind === 'formula-plan') {
      return i18next.t('formulaPlanPresentation.failed')
    }
    if (block.kind === 'flow-scheme') {
      return i18next.t('artifactBlock.flowSchemeGenerationFailed')
    }
    if (block.kind === 'flow-plan') {
      return i18next.t('artifactBlock.flowBlueprintGenerationFailed')
    }
    return i18next.t('artifactBlock.blueprintGenerationFailed')
  }

  if (block.kind === 'nocode-app') {
    return i18next.t('artifactBlock.appCreated')
  }

  if (block.kind === 'app-plan') {
    return i18next.t('artifactBlock.appPlanStaged')
  }
  if (block.kind === 'form-plan') {
    return i18next.t('artifactBlock.formPlanStaged')
  }
  if (block.kind === 'content-plan') {
    return i18next.t('artifactBlock.contentPlanStaged')
  }
  if (block.kind === 'formula-plan') {
    return i18next.t('formulaPlanPresentation.title')
  }
  if (block.kind === 'flow-scheme') {
    return i18next.t('artifactBlock.flowSchemeStaged')
  }
  if (block.kind === 'flow-plan') {
    return (block as any).flowApplyResult
      ? i18next.t('artifactBlock.generatedFromBlueprint')
      : i18next.t('artifactBlock.flowBlueprintStaged')
  }

  if (isBlueprintAppliedPhase((block as any).phase)) {
    return i18next.t('artifactBlock.generatedFromBlueprint')
  }

  return getBlueprintOpenQuestionCount(block) > 0
    ? i18next.t('artifactBlock.blueprintPendingConfirmation')
    : i18next.t('artifactBlock.blueprintReady')
}

export const resolveAiArtifactTitle = (block: AiAssistantArtifactBlock) => {
  if (block.kind === 'nocode-app') {
    return block.title || (block as any).app?.name || i18next.t('artifactBlock.newApp')
  }
  if (block.kind === 'app-plan') {
    return block.title || (block as any).appPlan?.goal || i18next.t('artifactBlock.appPlan')
  }
  if (block.kind === 'form-plan') {
    return resolveSingleFormPlanningDisplayTitle({
      outline: (block as any).outline,
    })
  }
  if (block.kind === 'content-plan') {
    const plan = getContentPlan(block)
    return block.title || String(plan?.title || '').trim() || i18next.t('artifactBlock.contentPlan')
  }
  if (block.kind === 'formula-plan') {
    const plan = getFormulaPlan(block)
    return block.title || String(plan?.title || '').trim() || i18next.t('formulaPlanPresentation.title')
  }
  if (block.kind === 'flow-scheme') {
    const scheme = getFlowScheme(block)
    return block.title || String(scheme?.title || '').trim() || i18next.t('artifactBlock.flowScheme')
  }
  if (block.kind === 'flow-plan') {
    const flowPlan = getFlowPlan(block)
    return block.title || String(flowPlan?.title || '').trim() || i18next.t('artifactBlock.flowBlueprint')
  }

  return resolveNocodeEditorBlueprintDisplayTitle({
    title: block.title || (block as any).blueprint?.title,
    forms: (block as any).blueprint?.forms,
    fallback: i18next.t('artifactBlock.blueprintDraft'),
  }) || i18next.t('artifactBlock.blueprintDraft')
}

export const resolveAiArtifactSubtitle = (block: AiAssistantArtifactBlock) => {
  if (block.status === 'loading') {
    return block.message || i18next.t('artifactBlock.processingViewLater')
  }

  if (block.status === 'error') {
    return block.error || block.message || i18next.t('artifactBlock.processingFailedRetry')
  }

  if (block.kind === 'nocode-app') {
    return ''
  }

  if (block.kind === 'app-plan') {
    const appPlan = (block as any).appPlan
    const openQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    return block.summary
      || appPlan?.goal
      || resolveAiArtifactConfirmationSummary(block)
      || (openQuestionCount > 0
        ? i18next.t('artifactBlock.appPlanPendingQuestionsSubtitle', { count: openQuestionCount })
        : i18next.t('artifactBlock.appPlanReadySubtitle'))
  }

  if (block.kind === 'form-plan') {
    const normalizedOutline = getNormalizedFormPlanOutline(block)
    const outline = normalizedOutline || (block as any).outline
    const previewEnabled = hasApplicationStructurePreview(block)
    const openQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    const normalizedSummary = normalizeText(normalizedOutline?.summary)
    return (
      normalizedSummary
      || (
        normalizedOutline
          ? ''
          : normalizeText(block.summary || outline?.summary)
      )
      || resolveAiArtifactConfirmationSummary(block)
      || (openQuestionCount > 0
        ? i18next.t('artifactBlock.formPlanPendingQuestionsSubtitle', {
          count: openQuestionCount,
          continueLabel: getNocodeEditorPendingContinueLabel(),
        })
        : previewEnabled
          ? i18next.t('artifactBlock.formPlanReadyWithStructureSubtitle')
          : i18next.t('artifactBlock.formPlanReadySubtitle'))
    )
  }

  if (block.kind === 'content-plan') {
    const plan = getContentPlan(block)
    const pendingQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    return block.summary
      || String(plan?.summary || '').trim()
      || resolveAiArtifactConfirmationSummary(block)
      || (pendingQuestionCount > 0
        ? i18next.t('artifactBlock.contentPlanPendingQuestionsSubtitle', { count: pendingQuestionCount })
        : i18next.t('artifactBlock.contentPlanReadySubtitle'))
  }

  if (block.kind === 'formula-plan') {
    const plan = getFormulaPlan(block)
    const pendingQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    return block.summary
      || String(plan?.summary || '').trim()
      || resolveAiArtifactConfirmationSummary(block)
      || (pendingQuestionCount > 0
        ? i18next.t('formulaPlanPresentation.pendingTitle', { count: pendingQuestionCount })
        : i18next.t('formulaPlanPresentation.title'))
  }

  if (block.kind === 'flow-scheme') {
    const scheme = getFlowScheme(block)
    const pendingQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    const planningStatus = normalizeText((block as any).planningStatus)
    return block.summary
      || String(scheme?.summary || '').trim()
      || resolveAiArtifactConfirmationSummary(block)
      || (pendingQuestionCount > 0
        ? i18next.t('artifactBlock.flowSchemePendingQuestionsSubtitle', { count: pendingQuestionCount })
        : planningStatus === 'ready_for_review'
          ? i18next.t('artifactBlock.flowSchemeReadyForReviewSubtitle')
          : i18next.t('artifactBlock.flowSchemeStagedSubtitle'))
  }

  if (block.kind === 'flow-plan') {
    const flowPlan = getFlowPlan(block)
    const applySummary = (block as any).flowApplyResult?.summary
    const pendingQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    return block.summary
      || String(flowPlan?.summary || '').trim()
      || resolveAiArtifactConfirmationSummary(block)
      || (applySummary
        ? i18next.t('artifactBlock.flowPlanAppliedSubtitle', {
          triggerBranchCount: Number(applySummary.triggerBranchCount || 0),
          branchCount: Number(applySummary.branchCount || 0),
        })
        : pendingQuestionCount > 0
          ? i18next.t('artifactBlock.flowPlanPendingQuestionsSubtitle', { count: pendingQuestionCount })
          : i18next.t('artifactBlock.flowPlanReadySubtitle'))
  }

  if (isBlueprintAppliedDraftPhase((block as any).phase)) {
    const draftIssueCount = getBlueprintDraftIssueCount(block)
    if (isBlueprintDraftPersistenceResolved(block) && draftIssueCount <= 0) {
      return i18next.t('artifactBlock.blueprintDraftIssuesResolvedSubtitle')
    }
    return draftIssueCount > 0
      ? i18next.t('artifactBlock.blueprintDraftHasIssuesSubtitle', { count: draftIssueCount })
      : i18next.t('artifactBlock.blueprintDraftSavedSubtitle')
  }

  const lastApplySummary = (block as any).applyResult?.summary
  if (lastApplySummary) {
    return i18next.t('artifactBlock.blueprintLastApplySubtitle', {
      formsCreated: Number(lastApplySummary.formsCreated || 0),
      fieldsUpdated: Number(lastApplySummary.fieldsUpdated || 0),
    })
  }

  const openQuestionCount = getBlueprintOpenQuestionCount(block)
  return openQuestionCount > 0
    ? i18next.t('artifactBlock.blueprintPendingQuestionsSubtitle', { count: openQuestionCount })
    : i18next.t('artifactBlock.blueprintReadySubtitle')
}

export const resolveAiArtifactViewLabel = (block?: AiAssistantArtifactBlock | null) => {
  if (!block) {
    return i18next.t('artifactBlock.view')
  }

  if (block.kind === 'nocode-app') {
    return i18next.t('artifactBlock.openApp')
  }

  if (block.kind === 'app-plan') {
    return hasRenderableAppPlanStructure(block) ? i18next.t('artifactBlock.appStructurePreview') : ''
  }

  if (block.kind === 'form-plan') {
    return hasApplicationStructurePreview(block) ? i18next.t('artifactBlock.appStructurePreview') : ''
  }

  if (block.kind === 'content-plan') {
    return i18next.t('artifactBlock.viewPlan')
  }

  if (block.kind === 'formula-plan') {
    return i18next.t('artifactBlock.viewPlan')
  }

  if (block.kind === 'flow-scheme') {
    return ''
  }

  if (block.kind === 'flow-plan') {
    return (block as any).flowApplyResult
      ? i18next.t('artifactBlock.viewResult')
      : i18next.t('artifactBlock.viewFlowBlueprint')
  }

  if (
    block.kind === 'blueprint'
    && isBlueprintAppliedDraftPhase((block as any).phase)
    && hasBlueprintBlockingDraftIssues(block)
  ) {
    return i18next.t('artifactBlock.completeDraft')
  }

  if (
    block.kind === 'blueprint'
    && isBlueprintAppliedDraftPhase((block as any).phase)
    && isBlueprintDraftPersistenceResolved(block)
  ) {
    return i18next.t('artifactBlock.viewDraft')
  }

  return isBlueprintAppliedArtifact(block)
    ? i18next.t('artifactBlock.viewResult')
    : i18next.t('artifactBlock.viewBlueprint')
}

export const resolveAiArtifactMeta = (block: AiAssistantArtifactBlock) => {
  const items: string[] = []

  if (block.kind === 'nocode-app') {
    const app = (block as any).app
    if (app?.nocodeId) {
      items.push(i18next.t('artifactBlock.appIdMeta', { id: app.nocodeId }))
    }
  }

  if (block.kind === 'app-plan') {
    const appPlan = (block as any).appPlan || {}
    const objects = Array.isArray(appPlan.objects) ? appPlan.objects : []
    const artifacts = Array.isArray(appPlan.artifacts) ? appPlan.artifacts : []
    const openQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    if (objects.length > 0) {
      items.push(i18next.t('artifactBlock.objectCount', { count: objects.length }))
    }
    if (artifacts.length > 0) {
      items.push(i18next.t('artifactBlock.artifactCount', { count: artifacts.length }))
    }
    if (openQuestionCount > 0) {
      items.push(i18next.t('artifactBlock.pendingConfirmationMetaCount', { count: openQuestionCount }))
    }
  }

  if (block.kind === 'form-plan') {
    const presentation = getFormPlanPresentation(block)
    const moduleCount = Number(presentation.moduleCount || 0)
    const formCount = Number(presentation.formCount || 0)
    const planningItemCount = Number(presentation.planningItemCount || 0)
    const openQuestionCount = resolveAiArtifactPendingQuestionCount(block)

    if (moduleCount > 0) {
      items.push(i18next.t('artifactBlock.moduleCount', { count: moduleCount }))
    }
    if (formCount > 0) {
      items.push(i18next.t('artifactBlock.formCount', { count: formCount }))
    }
    if (planningItemCount > 0) {
      items.push(i18next.t('artifactBlock.planningItemCount', { count: planningItemCount }))
    }
    if (openQuestionCount > 0) {
      items.push(i18next.t('artifactBlock.pendingConfirmationMetaCount', { count: openQuestionCount }))
    }
  }

  if (block.kind === 'content-plan') {
    const plan = getContentPlan(block)
    const planItems = Array.isArray(plan?.items) ? plan.items : []
    const openQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    if (planItems.length > 0) {
      items.push(i18next.t('artifactBlock.planningItemCount', { count: planItems.length }))
    }
    if (openQuestionCount > 0) {
      items.push(i18next.t('artifactBlock.pendingConfirmationMetaCount', { count: openQuestionCount }))
    }
  }

  if (block.kind === 'formula-plan') {
    const plan = getFormulaPlan(block)
    const formulaCount = Array.isArray(plan?.items)
      ? plan.items.reduce((count, item) => count + item.formulaSettings.length, 0)
      : 0
    const openQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    if (formulaCount > 0) {
      items.push(i18next.t('artifactBlock.planningItemCount', { count: formulaCount }))
    }
    if (openQuestionCount > 0) {
      items.push(i18next.t('artifactBlock.pendingConfirmationMetaCount', { count: openQuestionCount }))
    }
  }

  if (block.kind === 'flow-scheme') {
    const scheme = getFlowScheme(block)
    const openQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    if (Array.isArray(scheme?.mainPath) && scheme.mainPath.length > 0) {
      items.push(i18next.t('artifactBlock.mainPathStepCount', { count: scheme.mainPath.length }))
    }
    if (Array.isArray(scheme?.branches) && scheme.branches.length > 0) {
      items.push(i18next.t('artifactBlock.branchCount', { count: scheme.branches.length }))
    }
    if (openQuestionCount > 0) {
      items.push(i18next.t('artifactBlock.pendingConfirmationMetaCount', { count: openQuestionCount }))
    }
  }

  if (block.kind === 'flow-plan') {
    const flowPlan = getFlowPlan(block)
    const applySummary = (block as any).flowApplyResult?.summary
    const openQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    if (Array.isArray(flowPlan?.triggerBranches) && flowPlan.triggerBranches.length > 0) {
      items.push(i18next.t('artifactBlock.triggerBranchCount', { count: flowPlan.triggerBranches.length }))
    }
    if (Number(applySummary?.branchCount || 0) > 0) {
      items.push(i18next.t('artifactBlock.branchCount', { count: Number(applySummary.branchCount || 0) }))
    }
    if (Number(applySummary?.totalNodeCount || 0) > 0) {
      items.push(i18next.t('artifactBlock.totalNodeCount', { count: Number(applySummary.totalNodeCount || 0) }))
    } else if (Array.isArray(flowPlan?.triggerBranches) && flowPlan.triggerBranches.length > 0) {
      items.push(i18next.t('artifactBlock.totalNodeCount', { count: countNocodeEditorFlowPlanTotalNodes(flowPlan.triggerBranches) }))
    }
    if (openQuestionCount > 0) {
      items.push(i18next.t('artifactBlock.pendingConfirmationMetaCount', { count: openQuestionCount }))
    }
  }

  if (block.kind === 'blueprint') {
    const formCount = getBlueprintFormCount(block)
    const fieldCount = getBlueprintFieldCount(block)
    const formulaSummary = (block as any).applyResult?.formulaSummary || null
    const formulaCount = Math.max(0, Number(formulaSummary?.updated || 0))
    const formulaSkippedCount = Math.max(0, Number(formulaSummary?.skipped || 0))
    const formulaFailedCount = Math.max(0, Number(formulaSummary?.failed || 0))
    const formulaBlockingCount = Array.isArray(formulaSummary?.issues)
      ? formulaSummary.issues.filter((issue: Record<string, unknown>) => issue?.severity === 'blocking').length
      : 0
    const openQuestionCount = resolveAiArtifactPendingQuestionCount(block)
    const draftIssueCount = getBlueprintDraftIssueCount(block)
    if (formCount > 0) {
      items.push(i18next.t('artifactBlock.formCount', { count: formCount }))
    }
    if (fieldCount > 0) {
      items.push(i18next.t('artifactBlock.fieldCount', { count: fieldCount }))
    }
    items.push(...resolveNocodeEditorBlueprintFormulaSummaryLabels({
      updated: formulaCount,
      skipped: formulaSkippedCount,
      failed: formulaFailedCount,
      blocking: formulaBlockingCount,
    }))
    if (draftIssueCount > 0) {
      items.push(i18next.t('artifactBlock.draftIssueCount', { count: draftIssueCount }))
    } else if (openQuestionCount > 0) {
      items.push(
        isBlueprintAppliedArtifact(block)
          ? i18next.t('artifactBlock.preGenerationRecordMetaCount', { count: openQuestionCount })
          : i18next.t('artifactBlock.pendingConfirmationMetaCount', { count: openQuestionCount }),
      )
    }
  }

  if ((block as any).stagedAt) {
    items.push(i18next.t('artifactBlock.stagedAt', { time: formatTime((block as any).stagedAt) }))
  }

  return items
}
