import {
  getNocodeEditorPendingContinueLabel,
} from '@common/utils/nocodeEditorConfirmationCopy'
import type { AppBuilderHandoff } from '@common/types/appBuilderHandoff'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import { normalizeAppBuilderHandoff } from '@common/utils/appBuilderHandoff'
import { resolveNocodeEditorFlowEntryIntentWithSignal } from '@common/utils/nocodeEditorFlowIntentSignal'
import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiMessage,
} from './types'
import i18next from 'i18next'

export type ImportedHandoffPlanningStage = 'app-plan' | 'form-plan'

type ImportedHandoffMetadataBase = {
  handoffImported: true
  suppressImportedHandoffArtifacts: true
  handoffId: string
  handoffSourceThreadId: string
  handoffDraft: AppBuilderHandoff['draft']
  handoffReferences: AppBuilderHandoff['references']
}

export type ImportedHandoffAppPlanMetadata = ImportedHandoffMetadataBase & {
  summaryStage: 'app-plan'
  appBuilderPlanningSummary: string
  appBuilderPlanningOutline: NonNullable<NocodeEditorAiArtifactBlock['outline']>
  appBuilderPlanningArtifacts: Array<{
    type: string
    name: string
    purpose?: string
    executionLevel: string
  }>
}

export type ImportedHandoffFormPlanMetadata = ImportedHandoffMetadataBase & {
  summaryStage: 'form-plan'
  blocks: NocodeEditorAiArtifactBlock[]
}

export type ImportedHandoffMetadataResult =
  | {
    stage: 'app-plan'
    metadata: ImportedHandoffAppPlanMetadata
  }
  | {
    stage: 'form-plan'
    metadata: ImportedHandoffFormPlanMetadata
  }

type HandoffMessageLike = Pick<NocodeEditorAiMessage, 'metadata'> | {
  metadata?: Record<string, unknown> | null
}
type NormalizedSolutionOutlineForm = {
  formKey: string
  tableName: string
  description?: string
}
type NocodeEditorAiSolutionOutlineWithConfirmation = NonNullable<NocodeEditorAiArtifactBlock['outline']> & {
  confirmation?: NocodeEditorAiConfirmPayload | null
}
const isPresent = <T>(value: T | null | undefined): value is T => value != null

type MeaningfulConversationStateOptions<TMessage extends HandoffMessageLike> = {
  isHidden: (metadata: Record<string, unknown> | null) => boolean
  getArtifactBlocks: (message: TMessage) => unknown[]
}

export type ImportedHandoffImportState = 'none' | 'in_progress' | 'imported'

const normalizeText = (value: unknown) => String(value || '').trim()

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeTextList = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const CREATION_MODE_OPEN_QUESTION_PATTERNS = [
  /新建独立应用/u,
  /加到现有应用里/u,
  /添加到已有应用/u,
  /新建应用还是加到已有应用/u,
  /新建应用还是添加到已有应用/u,
  /新建还是加到现有应用/u,
  /新建还是添加到已有应用/u,
]

const isCreationModeOpenQuestion = (value: unknown) => {
  const text = normalizeText(value)
  return Boolean(text) && CREATION_MODE_OPEN_QUESTION_PATTERNS.some(pattern => pattern.test(text))
}

const resolveImportedHandoffOpenQuestions = (handoff: AppBuilderHandoff) => (
  normalizeTextList(handoff.draft?.openQuestions).filter(question => (
    handoff.scope.creationMode === 'undecided'
      ? true
      : !isCreationModeOpenQuestion(question)
  ))
)

export const resolveFetchedAppBuilderHandoffResponse = (value: unknown): AppBuilderHandoff | null => {
  const directHandoff = normalizeAppBuilderHandoff(value)
  if (directHandoff) {
    return directHandoff
  }

  if (!isRecord(value) || !('handoff' in value)) {
    return null
  }

  return normalizeAppBuilderHandoff(value.handoff)
}

export const hasImportedHandoffInMessages = (
  messages: HandoffMessageLike[],
  handoffId: string,
) => messages.some(message => (
  Boolean(isRecord(message.metadata) && message.metadata.handoffImported)
  && normalizeText(isRecord(message.metadata) ? message.metadata.handoffId : '') === handoffId
))

export const hasMeaningfulHandoffConversationState = <TMessage extends HandoffMessageLike>(
  messages: TMessage[],
  options: MeaningfulConversationStateOptions<TMessage>,
) => messages.some(message => (
  !options.isHidden(message.metadata || null)
  || options.getArtifactBlocks(message).length > 0
))

export const shouldReuseConversationForImportedHandoff = (
  messages: HandoffMessageLike[],
  handoffId: string,
) => (
  // Only detects whether the same handoff already exists in this conversation
  // to avoid duplicate import. New-handoff conversation selection belongs to NocodeEditorAiPanel.
  hasImportedHandoffInMessages(messages, handoffId)
)

export const resolveImportedHandoffImportState = (input: {
  handoffId: string
  importingHandoffIds: Set<string>
  messages: HandoffMessageLike[]
}): ImportedHandoffImportState => {
  if (hasImportedHandoffInMessages(input.messages, input.handoffId)) {
    return 'imported'
  }
  if (input.importingHandoffIds.has(input.handoffId)) {
    return 'in_progress'
  }
  return 'none'
}

export const isImportedHandoffConversationSnapshotCurrent = (input: {
  snapshotConversationId: unknown
  currentConversationId: unknown
}) => (
  Boolean(normalizeText(input.snapshotConversationId))
  && normalizeText(input.snapshotConversationId) === normalizeText(input.currentConversationId)
)

export const shouldSuppressImportedHandoffArtifacts = (input: {
  metadata?: Record<string, unknown> | null
}) => Boolean(input.metadata?.suppressImportedHandoffArtifacts)

export const suppressImportedHandoffArtifactBlocks = <TBlock>(input: {
  metadata?: Record<string, unknown> | null
  blocks: TBlock[]
}) => (
  shouldSuppressImportedHandoffArtifacts({ metadata: input.metadata || null })
    ? []
    : input.blocks
)

export const resolveImportedHandoffPlanningStage = (
  handoff: AppBuilderHandoff,
): ImportedHandoffPlanningStage => {
  if (handoff.intent?.kind === 'create_form') {
    const validForms = (Array.isArray(handoff.draft?.candidateForms) ? handoff.draft.candidateForms : [])
      .filter(form => normalizeText(form?.name))
    if (validForms.length === 1) {
      return 'form-plan'
    }
  }
  return 'app-plan'
}

const resolveImportedHandoffTitle = (handoff: AppBuilderHandoff) => (
  normalizeText(handoff.draft?.appName)
  || normalizeText(handoff.intent?.entryTitle)
  || normalizeText(handoff.draft?.candidateForms?.[0]?.name)
  || i18next.t('appBuilderHandoffImport.importedPlan')
)

const buildImportedFormPlanOutline = (
  handoff: AppBuilderHandoff,
): NonNullable<NocodeEditorAiArtifactBlock['outline']> => {
  const candidateForm = handoff.draft?.candidateForms?.[0]
  const tableName = normalizeText(candidateForm?.name)
    || resolveImportedHandoffTitle(handoff)
  const summary = normalizeText(candidateForm?.purpose)
    || normalizeText(handoff.draft?.summary)
    || normalizeText(handoff.draft?.goal)
  const candidateFlows = normalizeTextList(handoff.draft?.candidateFlows)
  const flowIntent = candidateFlows.length
    ? resolveNocodeEditorFlowEntryIntentWithSignal({
      userMessage: handoff.draft?.goal,
      activeFormName: tableName,
      modelSignal: {
        state: 'explicit_positive',
        confidence: 'high',
        evidence: [normalizeText(handoff.draft?.goal)],
        targetFormName: tableName,
      },
    })
    : null

  return {
    id: `imported-handoff-${normalizeText(handoff.handoffId) || Date.now()}`,
    title: tableName,
    summary,
    forms: [{
      formKey: 'imported-form-1',
      tableName,
      description: summary || undefined,
    }],
    modules: [],
    flows: [],
    assumptions: normalizeTextList(handoff.draft?.assumptions),
    ...(flowIntent?.state === 'explicit_positive'
      ? {
        flowIntent: {
          state: flowIntent.state,
          confidence: 'high',
          evidence: flowIntent.evidence,
          targetFormName: flowIntent.targetFormName,
        },
      }
      : {}),
    openQuestions: [
      ...resolveImportedHandoffOpenQuestions(handoff),
      ...normalizeTextList(handoff.references?.map(item => item?.text)),
    ],
  }
}

const buildImportedAppPlanOutline = (
  handoff: AppBuilderHandoff,
): NonNullable<NocodeEditorAiArtifactBlock['outline']> => {
  const forms = (Array.isArray(handoff.draft?.candidateForms) ? handoff.draft.candidateForms : [])
    .map((form, index) => {
      const tableName = normalizeText(form?.name)
      if (!tableName) {
        return null
      }
      return {
        formKey: `imported-form-${index + 1}`,
        tableName,
        description: normalizeText(form?.purpose) || undefined,
      }
    })
    .filter(isPresent)
  const fallbackTitle = resolveImportedHandoffTitle(handoff)

  return {
    id: `imported-handoff-${normalizeText(handoff.handoffId) || Date.now()}`,
    title: fallbackTitle,
    summary: normalizeText(handoff.draft?.summary)
      || normalizeText(handoff.draft?.goal)
      || undefined,
    forms: forms.length
      ? forms
      : [{
        formKey: 'imported-form-1',
        tableName: fallbackTitle,
        description: normalizeText(handoff.draft?.goal) || undefined,
      }],
    modules: [{
      moduleKey: 'imported-module-1',
      name: fallbackTitle,
      description: normalizeText(handoff.draft?.goal) || undefined,
      formKeys: forms.map(form => form.formKey || '').filter(Boolean),
    }],
    flows: normalizeTextList(handoff.draft?.candidateFlows).map((flow, index) => ({
      from: `imported-flow-${index + 1}-start`,
      to: `imported-flow-${index + 1}-end`,
      label: flow,
    })),
    assumptions: normalizeTextList(handoff.draft?.assumptions),
    openQuestions: resolveImportedHandoffOpenQuestions(handoff),
  }
}

const buildImportedPlanningArtifacts = (handoff: AppBuilderHandoff) => [
  ...(Array.isArray(handoff.draft?.candidateForms) ? handoff.draft.candidateForms : []).map(form => ({
    type: 'form',
    name: normalizeText(form?.name),
    purpose: normalizeText(form?.purpose) || undefined,
    executionLevel: 'need_confirm',
  })).filter(item => item.name),
  ...normalizeTextList(handoff.draft?.candidateFlows).map((flow, index) => ({
    type: 'flow',
    name: i18next.t('appBuilderHandoffImport.flowName', { index: index + 1 }),
    purpose: flow,
    executionLevel: 'need_confirm',
  })),
]

const buildFormPlanPresentation = (
  outline: NonNullable<NocodeEditorAiArtifactBlock['outline']>,
) => {
  const forms = Array.isArray(outline.forms) ? outline.forms : []
  const modules = Array.isArray(outline.modules) ? outline.modules : []
  return {
    moduleCount: modules.length || (forms.length ? 1 : 0),
    formCount: forms.length,
    planningItemCount: 0,
    nodes: forms.map(form => ({
      name: normalizeText(form.tableName),
      normalizedName: normalizeText(form.tableName).replace(/\s+/g, '').toLowerCase(),
      displayCategory: 'form',
      artifactType: 'form',
      executionLevel: 'need_confirm',
    })),
  }
}

const buildImportedFormPlanConfirmation = (handoff: AppBuilderHandoff): NocodeEditorAiConfirmPayload => {
  const openQuestions = resolveImportedHandoffOpenQuestions(handoff)
  const candidateForms = Array.isArray(handoff.draft?.candidateForms) ? handoff.draft.candidateForms : []
  const fieldDraftQuestions = candidateForms
    .map((form, formIndex) => {
      const fieldNames = Array.isArray(form?.fields)
        ? form.fields
          .map(field => normalizeText(field?.name))
          .filter(Boolean)
        : []
      if (!fieldNames.length) {
        return null
      }
      const formName = normalizeText(form?.name) || i18next.t('appBuilderHandoffImport.formName', { index: formIndex + 1 })
      return {
        id: `imported-field-draft-${formIndex + 1}`,
        title: i18next.t('appBuilderHandoffImport.confirmFieldDraftTitle', { formName, fields: fieldNames.join('、') }),
        questionKind: 'note_only' as const,
        description: i18next.t('appBuilderHandoffImport.confirmFieldDraftDescription'),
        required: false,
        allowFreeText: true,
      }
    })
    .filter(isPresent)
  const questions: NocodeEditorAiConfirmQuestion[] = [
    ...openQuestions.map((question, index) => ({
      id: `imported-open-question-${index + 1}`,
      title: question,
      questionKind: 'note_only' as const,
      required: false,
      allowFreeText: true,
    })),
    ...fieldDraftQuestions,
  ]

  return {
    stage: 'form-plan',
    preferredSurface: 'inline',
    status: questions.length ? 'pending' : 'completed',
    summary: normalizeText(handoff.draft?.summary)
      || normalizeText(handoff.draft?.goal)
      || undefined,
    questions,
    allowContinueWithDefaults: questions.length ? true : undefined,
    continueLabel: questions.length ? getNocodeEditorPendingContinueLabel() : undefined,
    reviewLabel: i18next.t('appBuilderHandoffImport.reviewFormPlan'),
  }
}

const buildImportedFormPlanArtifactBlock = (
  handoff: AppBuilderHandoff,
): NocodeEditorAiArtifactBlock => {
  const outline = buildImportedFormPlanOutline(handoff)
  const confirmation = buildImportedFormPlanConfirmation(handoff)
  return {
    type: 'artifact',
    kind: 'form-plan',
    status: 'ready',
    version: `imported-handoff:${normalizeText(handoff.handoffId) || Date.now()}`,
    revision: 1,
    stagedAt: Date.now(),
    title: normalizeText(outline.title) || i18next.t('appBuilderHandoffImport.formPlan'),
    summary: outline.summary,
    confirmation,
    outline: {
      ...outline,
      confirmation,
    } as NocodeEditorAiSolutionOutlineWithConfirmation,
    formPlanPresentation: buildFormPlanPresentation(outline),
    applicationStructurePreview: {
      enabled: true,
      previewMode: 'form-plan',
      focusFormKey: normalizeText(outline.forms?.[0]?.formKey) || undefined,
      focusFormName: normalizeText(outline.forms?.[0]?.tableName) || undefined,
      highlightModuleKeys: [],
    },
  }
}

export const buildImportedHandoffAssistantMetadata = (input: {
  handoff: AppBuilderHandoff
  handoffId: string
  handoffSourceThreadId: string
}): ImportedHandoffMetadataResult => {
  const stage = resolveImportedHandoffPlanningStage(input.handoff)
  if (stage === 'app-plan') {
    return {
      stage,
      metadata: {
        summaryStage: 'app-plan',
        handoffImported: true,
        suppressImportedHandoffArtifacts: true,
        handoffId: input.handoffId,
        handoffSourceThreadId: input.handoffSourceThreadId,
        handoffDraft: input.handoff.draft,
        handoffReferences: input.handoff.references,
        appBuilderPlanningSummary: input.handoff.draft.summary || '',
        appBuilderPlanningOutline: buildImportedAppPlanOutline(input.handoff),
        appBuilderPlanningArtifacts: buildImportedPlanningArtifacts(input.handoff),
      },
    }
  }

  return {
    stage,
      metadata: {
        summaryStage: 'form-plan',
        handoffImported: true,
        suppressImportedHandoffArtifacts: true,
        handoffId: input.handoffId,
        handoffSourceThreadId: input.handoffSourceThreadId,
        handoffDraft: input.handoff.draft,
        handoffReferences: input.handoff.references,
      blocks: [
        buildImportedFormPlanArtifactBlock(input.handoff),
      ],
    },
  }
}

export const buildImportedHandoffAssistantSummary = (_handoff: AppBuilderHandoff) => {
  return ''
}
