import { resolveBlueprintWidgetTypeLabel } from '@common/utils/nocodeEditorBlueprintWidgetLabel'
import { mergeSingleFormBlueprintFragments } from '@common/utils/nocodeEditorBlueprintFormNormalization'
import { buildNocodeEditorVersionLabel } from '@common/utils/nocodeEditorVersionLabel'
import {
  buildBlueprintArtifactVersionFromParts,
  getNocodeEditorAiBlueprintContentSignatureKey,
  getNocodeEditorAiBlueprintPlanningContextKey,
  getNocodeEditorAiBlueprintPrimaryFormFamilyKey,
} from './blueprintArtifactIdentity'
import {
  isBlueprintAppliedDraftPhase,
  isBlueprintAppliedPhase,
  isBlueprintStagedPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import {
  getDraftPersistenceActionIssueCount,
  hasDraftPersistenceBlockingActionIssues,
  isDraftPersistenceStateResolved,
} from './draftIssueActionList'
import i18next from 'i18next'
import type {
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiBlueprintDisplayStatus,
  NocodeEditorAiStageBlueprintDisplayItem,
} from './types'

export type BlueprintWorkbenchMode = 'review' | 'generated'

export type BlueprintWorkbenchStageState = 'initial' | 'review' | 'generating' | 'generated'

export type BlueprintWorkbenchLayoutMode = 'flat' | 'grouped'

export type BlueprintWorkbenchHeaderActionKey =
  | 'apply-pending-batch'
  | 'switch-to-review'
  | 'open-history'

export type BlueprintWorkbenchHeaderAction = {
  key: BlueprintWorkbenchHeaderActionKey
  label: string
  tone: 'primary' | 'secondary' | 'ghost'
  loading?: boolean
  disabled?: boolean
}

export type BlueprintWorkbenchFieldPreview = {
  name: string
  typeLabel: string
}

export type BlueprintWorkbenchCard = {
  key: string
  itemKey: string
  formKey: string
  mode: BlueprintWorkbenchMode
  role: 'primary' | 'secondary'
  status: NocodeEditorAiBlueprintDisplayStatus
  title: string
  summary?: string
  groupName: string
  formName: string
  titleMeta: string
  fieldCount: number
  updatedAt?: number
  meta: string[]
  statusText: string
  statusLabel: string
  statusNote: string
  sourceText?: string
  versionText?: string
  fieldsPreview: BlueprintWorkbenchFieldPreview[]
  item: NocodeEditorAiStageBlueprintDisplayItem
  form: NocodeEditorAiAppBlueprintForm
}

export type BlueprintWorkbenchGroup = {
  key: string
  name: string
  title: string
  subtitle?: string
  summaryText: string
  description?: string
  stripText: string
  mode: BlueprintWorkbenchMode
  totalCount: number
  pendingCount: number
  appliedCount: number
  totalFieldCount: number
  primaryCardTitle: string
  statusLabel: string
  statusTone: 'pending' | 'applied'
  summaryTexts: string[]
  metaPills: string[]
  metaLines: string[]
  previewTitles: string[]
  action?: {
    loading?: boolean
    disabled?: boolean
  }
  cards: BlueprintWorkbenchCard[]
}

export type BlueprintWorkbenchHistoryEntry = {
  key: string
  title: string
  summary?: string
  mode: BlueprintWorkbenchMode
  timeText: string
  selected: boolean
  sourceText?: string
  cardKey?: string
  item: NocodeEditorAiStageBlueprintDisplayItem
  generatedCount?: number
}

export type BlueprintWorkbenchViewModelInput = {
  items: NocodeEditorAiStageBlueprintDisplayItem[]
  selectedKey?: string | null
  activeMode?: BlueprintWorkbenchMode
  includeAllStatuses?: boolean
  loading?: boolean
  applyingId?: string | null
}

export type BlueprintWorkbenchViewModel = {
  mode: BlueprintWorkbenchMode
  stageState: BlueprintWorkbenchStageState
  layoutMode: BlueprintWorkbenchLayoutMode
  hasExplicitGroups: boolean
  hasReviewItems: boolean
  hasGeneratedItems: boolean
  header: {
    title: string
    description: string
    actions: BlueprintWorkbenchHeaderAction[]
  }
  groups: BlueprintWorkbenchGroup[]
  cards: BlueprintWorkbenchCard[]
  visibleCards: BlueprintWorkbenchCard[]
  historyEntries: BlueprintWorkbenchHistoryEntry[]
  defaultSelectedKey?: string
  selectedCard?: BlueprintWorkbenchCard
  emptyTitle: string
  emptyDescription: string
}

type BlueprintWorkbenchDraftCard = BlueprintWorkbenchCard & {
  rawGroupName: string
  hasExplicitGroupName: boolean
}

const getUngroupedGroupName = () => i18next.t('blueprintWorkbenchViewModel.ungrouped')

const normalizeText = (value: unknown, fallback = '') => {
  const text = String(value || '').trim()
  return text || fallback
}

const hasExplicitGroupName = (value: unknown) => normalizeText(value).length > 0
const normalizeApplyingId = (value: unknown) => normalizeText(value)
const isBatchApplyingId = (value: unknown) => normalizeApplyingId(value) === 'batch'

const normalizeWorkbenchItem = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
): NocodeEditorAiStageBlueprintDisplayItem => {
  const forms = Array.isArray(item.blueprint?.forms) ? item.blueprint.forms : []
  if (!forms.length) {
    return item
  }

  return {
    ...item,
    blueprint: {
      ...item.blueprint,
      forms: mergeSingleFormBlueprintFragments(forms) as NocodeEditorAiAppBlueprintForm[],
    },
  }
}

const flattenFields = (
  fields: NocodeEditorAiAppBlueprintField[] | undefined,
): NocodeEditorAiAppBlueprintField[] => {
  const source = Array.isArray(fields) ? fields : []
  return source.flatMap((field) => {
    const children = flattenFields(field.children)
    return [field, ...children]
  })
}

const countFields = (form?: NocodeEditorAiAppBlueprintForm) => flattenFields(form?.fields).length

const resolveItemStatus = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
): NocodeEditorAiBlueprintDisplayStatus => (
  item.itemKind === 'current_form_snapshot' ? 'current_form_snapshot' : item.phase
)

const isReviewItem = (item: NocodeEditorAiStageBlueprintDisplayItem) => (
  item.itemKind === 'ai_blueprint' && isBlueprintStagedPhase(item.phase)
)

const getDraftActionIssueCount = (item: NocodeEditorAiStageBlueprintDisplayItem) => (
  getDraftPersistenceActionIssueCount(item.draftPersistenceState)
)

const hasBlockingDraftIssues = (item: NocodeEditorAiStageBlueprintDisplayItem) => (
  isBlueprintAppliedDraftPhase(item.phase)
  && hasDraftPersistenceBlockingActionIssues(item.draftPersistenceState)
)

const isResolvedAppliedDraft = (item: NocodeEditorAiStageBlueprintDisplayItem) => (
  isBlueprintAppliedDraftPhase(item.phase)
  && isDraftPersistenceStateResolved(item.draftPersistenceState)
)

const resolveItemMode = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
): BlueprintWorkbenchMode => (isReviewItem(item) ? 'review' : 'generated')

const isPendingCardStatus = (status: BlueprintWorkbenchCard['status']) => status === 'staged'

const isGeneratedCardStatus = (status: BlueprintWorkbenchCard['status']) => status !== 'staged'

const formatTimeText = (value?: number) => {
  if (!value) {
    return i18next.t('blueprintWorkbenchViewModel.timeMissing')
  }

  return new Date(value).toLocaleString(i18next.resolvedLanguage || i18next.language || 'en', {
    hour12: false,
  })
}

const buildSourceText = (item: NocodeEditorAiStageBlueprintDisplayItem) => {
  if (isReviewItem(item)) {
    return i18next.t('blueprintWorkbenchViewModel.pendingBlueprint')
  }

  if (item.itemKind === 'current_form_snapshot') {
    return i18next.t('blueprintWorkbenchViewModel.currentGeneratedPage')
  }

  if (item.itemKind === 'ai_blueprint' && hasBlockingDraftIssues(item)) {
    return i18next.t('blueprintWorkbenchViewModel.draftIncomplete')
  }

  if (item.itemKind === 'ai_blueprint' && isResolvedAppliedDraft(item)) {
    return i18next.t('blueprintWorkbenchViewModel.draftPendingSave')
  }

  return i18next.t('blueprintWorkbenchViewModel.generatedFromBlueprint')
}

const buildVersionText = (item: NocodeEditorAiStageBlueprintDisplayItem) => {
  const explicitLabel = String(item.displayVersionLabel || '').trim()
  if (explicitLabel) {
    return explicitLabel
  }

  const label = buildNocodeEditorVersionLabel(Number(item.displayRevision || item.revision || 0))
  if (label) {
    return label
  }

  return isReviewItem(item)
    ? i18next.t('blueprintWorkbenchViewModel.pendingGeneration')
    : i18next.t('blueprintWorkbenchViewModel.generated')
}

const pickItemTimestamp = (item: NocodeEditorAiStageBlueprintDisplayItem) => Number(
  item.updatedAt || item.appliedAt || item.stagedAt || item.createdAt || 0,
)

const compareItems = (
  left: NocodeEditorAiStageBlueprintDisplayItem,
  right: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  const timeDiff = pickItemTimestamp(right) - pickItemTimestamp(left)
  if (timeDiff !== 0) {
    return timeDiff
  }

  return normalizeText(right.id).localeCompare(normalizeText(left.id))
}

const compareCards = (left: BlueprintWorkbenchCard, right: BlueprintWorkbenchCard) => {
  const timeDiff = (right.updatedAt || 0) - (left.updatedAt || 0)
  if (timeDiff !== 0) {
    return timeDiff
  }

  const itemDiff = right.itemKey.localeCompare(left.itemKey, 'zh-CN')
  if (itemDiff !== 0) {
    return itemDiff
  }

  return left.title.localeCompare(right.title, 'zh-CN')
}

export const resolveBlueprintWorkbenchMode = (
  items: NocodeEditorAiStageBlueprintDisplayItem[],
): BlueprintWorkbenchMode => {
  if (items.some(item => resolveItemMode(item) === 'review')) {
    return 'review'
  }

  if (items.some(item => resolveItemMode(item) === 'generated')) {
    return 'generated'
  }

  return 'review'
}

const resolveActualMode = (
  preferredMode: BlueprintWorkbenchMode | undefined,
  hasReviewItems: boolean,
  hasGeneratedItems: boolean,
  includeAllStatuses?: boolean,
) => {
  if (includeAllStatuses && hasReviewItems && hasGeneratedItems) {
    return 'review'
  }

  if (preferredMode === 'review' && hasReviewItems) {
    return 'review'
  }

  if (preferredMode === 'generated' && hasGeneratedItems) {
    return 'generated'
  }

  if (hasReviewItems) {
    return 'review'
  }

  if (hasGeneratedItems) {
    return 'generated'
  }

  return preferredMode || 'review'
}

const resolveStageState = (input: {
  loading?: boolean
  hasCards: boolean
  isReviewMode: boolean
  isGeneratedMode: boolean
}): BlueprintWorkbenchStageState => {
  if (input.loading && !input.hasCards) {
    return 'generating'
  }

  if (input.hasCards && input.isReviewMode) {
    return 'review'
  }

  if (input.hasCards && input.isGeneratedMode) {
    return 'generated'
  }

  return 'initial'
}

const buildHeaderTitle = (
  mode: BlueprintWorkbenchMode,
  stageState: BlueprintWorkbenchStageState,
) => {
  if (stageState === 'initial') {
    return i18next.t('blueprintWorkbenchViewModel.appBlueprintWorkbench')
  }

  if (stageState === 'generating') {
    return i18next.t('blueprintWorkbenchViewModel.appBlueprintGenerating')
  }

  if (stageState === 'review') {
    return i18next.t('blueprintWorkbenchViewModel.appBlueprintReview')
  }

  return mode === 'generated'
    ? i18next.t('blueprintWorkbenchViewModel.appGeneratedResult')
    : i18next.t('blueprintWorkbenchViewModel.appBlueprintReview')
}

const buildHeaderDescription = (input: {
  mode: BlueprintWorkbenchMode
  stageState: BlueprintWorkbenchStageState
  layoutMode: BlueprintWorkbenchLayoutMode
  includeAllStatuses?: boolean
  hasReviewItems: boolean
  hasGeneratedItems: boolean
  hasSelectableCard: boolean
  visibleGroupCount: number
  visibleCardCount: number
}) => {
  const {
    stageState,
    layoutMode,
    visibleGroupCount,
    visibleCardCount,
  } = input

  if (stageState === 'generating') {
    return i18next.t('blueprintWorkbenchViewModel.generatingDescription')
  }

  if (stageState === 'initial') {
    return i18next.t('blueprintWorkbenchViewModel.initialDescription')
  }

  if (stageState === 'review') {
    if (layoutMode === 'grouped') {
      if (input.includeAllStatuses && input.hasReviewItems && input.hasGeneratedItems) {
        return i18next.t('blueprintWorkbenchViewModel.mixedGroupedReviewDescription', {
          groupCount: visibleGroupCount,
          cardCount: visibleCardCount,
        })
      }

      return i18next.t('blueprintWorkbenchViewModel.groupedReviewDescription', {
        groupCount: visibleGroupCount,
        cardCount: visibleCardCount,
      })
    }

    if (input.includeAllStatuses && input.hasReviewItems && input.hasGeneratedItems) {
      return i18next.t('blueprintWorkbenchViewModel.mixedFlatReviewDescription', { cardCount: visibleCardCount })
    }

    return i18next.t('blueprintWorkbenchViewModel.flatReviewDescription', { cardCount: visibleCardCount })
  }

  if (layoutMode === 'grouped') {
    return i18next.t('blueprintWorkbenchViewModel.groupedGeneratedDescription', {
      groupCount: visibleGroupCount,
      cardCount: visibleCardCount,
    })
  }

  return i18next.t('blueprintWorkbenchViewModel.flatGeneratedDescription', { cardCount: visibleCardCount })
}

const buildHeaderActions = (input: {
  mode: BlueprintWorkbenchMode
  stageState: BlueprintWorkbenchStageState
  hasSelectableCard: boolean
  hasReviewItems: boolean
  hasGeneratedItems: boolean
  includeAllStatuses?: boolean
  applyingId?: string | null
}) => {
  const {
    mode,
    stageState,
    hasSelectableCard,
    hasReviewItems,
    hasGeneratedItems,
    applyingId,
  } = input
  const normalizedApplyingId = normalizeApplyingId(applyingId)
  const isApplying = Boolean(normalizedApplyingId)
  const isBatchApplying = isBatchApplyingId(normalizedApplyingId)
  const isMixedStatusWorkspace = Boolean(
    input.includeAllStatuses
    && hasReviewItems
    && hasGeneratedItems,
  )

  if (isMixedStatusWorkspace) {
    return [
      {
        key: 'apply-pending-batch' as const,
        label: i18next.t('blueprintWorkbenchViewModel.generateAll'),
        tone: 'primary' as const,
        loading: isBatchApplying,
        disabled: stageState !== 'review' || !hasReviewItems || !hasSelectableCard || isApplying,
      },
    ]
  }

  if (mode === 'review') {
    return [
      {
        key: 'apply-pending-batch' as const,
        label: i18next.t('blueprintWorkbenchViewModel.generateAll'),
        tone: 'primary' as const,
        loading: isBatchApplying,
        disabled: stageState !== 'review' || !hasReviewItems || !hasSelectableCard || isApplying,
      },
    ]
  }

  return [
    {
      key: 'open-history' as const,
      label: i18next.t('blueprintWorkbenchViewModel.viewBackgroundRecords'),
      tone: 'secondary' as const,
      disabled: isApplying,
    },
    {
      key: 'switch-to-review' as const,
      label: i18next.t('blueprintWorkbenchViewModel.viewPendingGeneration'),
      tone: 'ghost' as const,
      disabled: !hasReviewItems || isApplying,
    },
  ]
}

const buildHeader = (input: {
  mode: BlueprintWorkbenchMode
  stageState: BlueprintWorkbenchStageState
  layoutMode: BlueprintWorkbenchLayoutMode
  includeAllStatuses?: boolean
  hasSelectableCard: boolean
  hasReviewItems: boolean
  hasGeneratedItems: boolean
  visibleGroupCount: number
  visibleCardCount: number
  applyingId?: string | null
}): BlueprintWorkbenchViewModel['header'] => {
  return {
    title: buildHeaderTitle(input.mode, input.stageState),
    description: buildHeaderDescription(input),
    actions: buildHeaderActions(input),
  }
}

const buildEmptyState = (input: {
  stageState: BlueprintWorkbenchStageState
  layoutMode: BlueprintWorkbenchLayoutMode
}) => {
  const { stageState, layoutMode } = input

  if (stageState === 'generating') {
    return {
      emptyTitle: i18next.t('blueprintWorkbenchViewModel.blueprintGenerating'),
      emptyDescription: i18next.t('blueprintWorkbenchViewModel.emptyGeneratingDescription'),
    }
  }

  if (stageState === 'initial') {
    return {
      emptyTitle: i18next.t('blueprintWorkbenchViewModel.noBlueprint'),
      emptyDescription: i18next.t('blueprintWorkbenchViewModel.initialDescription'),
    }
  }

  if (stageState === 'review') {
    return {
      emptyTitle: layoutMode === 'grouped'
        ? i18next.t('blueprintWorkbenchViewModel.emptyGroupedPendingPages')
        : i18next.t('blueprintWorkbenchViewModel.emptyPendingPages'),
      emptyDescription: layoutMode === 'grouped'
        ? i18next.t('blueprintWorkbenchViewModel.emptyGroupedPendingDescription')
        : i18next.t('blueprintWorkbenchViewModel.emptyPendingDescription'),
    }
  }

  return {
    emptyTitle: layoutMode === 'grouped'
      ? i18next.t('blueprintWorkbenchViewModel.emptyGroupedGeneratedPages')
      : i18next.t('blueprintWorkbenchViewModel.emptyGeneratedPages'),
    emptyDescription: layoutMode === 'grouped'
      ? i18next.t('blueprintWorkbenchViewModel.emptyGroupedGeneratedDescription')
      : i18next.t('blueprintWorkbenchViewModel.emptyGeneratedDescription'),
  }
}

const buildFieldPreview = (
  form: NocodeEditorAiAppBlueprintForm,
): BlueprintWorkbenchFieldPreview[] => {
  return flattenFields(form.fields)
    .filter(field => normalizeText(field.name).length > 0)
    .map(field => ({
      name: normalizeText(field.name, i18next.t('blueprintWorkbenchViewModel.unnamedField')),
      typeLabel: resolveBlueprintWidgetTypeLabel(field.widgetType) || i18next.t('blueprintWorkbenchViewModel.unlabeledType'),
    }))
}

const buildCardStatusText = (
  status: BlueprintWorkbenchCard['status'],
  item?: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  if (status === 'staged') return i18next.t('blueprintWorkbenchViewModel.pendingGeneration')
  if (status === 'applied_draft') return i18next.t('blueprintWorkbenchViewModel.generated')
  if (status === 'applied_saved') return i18next.t('blueprintWorkbenchViewModel.generated')
  if (status === 'current_form_snapshot') return i18next.t('blueprintWorkbenchViewModel.currentGeneratedPage')
  return i18next.t('blueprintWorkbenchViewModel.generated')
}

const buildGroupedCardStatusLabel = (
  status: BlueprintWorkbenchCard['status'],
  item?: NocodeEditorAiStageBlueprintDisplayItem,
) => buildCardStatusText(status, item)

const buildFlatCardStatusLabel = (
  status: BlueprintWorkbenchCard['status'],
  item?: NocodeEditorAiStageBlueprintDisplayItem,
) => buildCardStatusText(status, item)

const buildGroupedCardStatusNote = () => ''

const buildFlatCardStatusNote = () => ''

const createDraftCard = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
  form: NocodeEditorAiAppBlueprintForm,
): BlueprintWorkbenchDraftCard => {
  const rawGroupName = normalizeText(form.groupName)
  const formName = normalizeText(form.tableName, i18next.t('blueprintWorkbenchViewModel.unnamedPage'))
  const stableItemKey = normalizeText(item.id)
  const stableFormKey = normalizeText(form.formKey || formName, formName)
  const cardKey = `${stableItemKey}::${stableFormKey}`
  const summary = normalizeText(
    form.description || item.summary || item.blueprint?.summary,
    '',
  ) || undefined
  const status = resolveItemStatus(item)
  const updatedAt = pickItemTimestamp(item) || undefined
  const fieldCount = countFields(form)

  return {
    key: cardKey,
    itemKey: stableItemKey,
    formKey: stableFormKey,
    mode: resolveItemMode(item),
    role: 'secondary',
    status,
    title: formName,
    summary,
    groupName: rawGroupName,
    formName,
    titleMeta: '',
    fieldCount,
    updatedAt,
    meta: [i18next.t('blueprintWorkbenchViewModel.fieldCount', { count: fieldCount })],
    statusText: buildCardStatusText(status, item),
    statusLabel: '',
    statusNote: '',
    sourceText: buildSourceText(item),
    versionText: buildVersionText(item),
    fieldsPreview: buildFieldPreview(form),
    item,
    form,
    rawGroupName,
    hasExplicitGroupName: hasExplicitGroupName(form.groupName),
  }
}

const buildWorkbenchCardWorkspaceKey = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  const planningContextKey = getNocodeEditorAiBlueprintPlanningContextKey({
    blueprint: item.blueprint,
    sourcePlanningContextKey: item.sourcePlanningContextKey,
  })
  if (planningContextKey) {
    return `planning:${planningContextKey}`
  }

  const title = normalizeText(item.title || item.blueprint?.title)
  const primaryFormFamilyKey = getNocodeEditorAiBlueprintPrimaryFormFamilyKey(item.blueprint)
  if (title || primaryFormFamilyKey) {
    return [
      `title:${title || 'unknown'}`,
      `primary:${primaryFormFamilyKey || 'unknown'}`,
    ].join('|')
  }

  const blueprintId = normalizeText(item.blueprint?.id)
  if (blueprintId) {
    return `blueprint:${blueprintId}`
  }

  return normalizeText(item.identityKey, 'unknown-item')
}

const buildWorkbenchCardDedupKey = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
  form: NocodeEditorAiAppBlueprintForm,
) => {
  const versionKey = buildBlueprintArtifactVersionFromParts({
    revision: Number(item.revision || 0),
    stagedAt: Number(item.stagedAt || 0),
    phase: item.phase,
    applyResult: item.applyResult || null,
  })
  const formKey = normalizeText(form.formKey || form.tableName, 'unknown-form')
  const contentSignatureKey = item.itemKind === 'ai_blueprint'
    ? (item.contentSignatureKey || getNocodeEditorAiBlueprintContentSignatureKey(item.blueprint))
    : getNocodeEditorAiBlueprintContentSignatureKey(item.blueprint)

  return [
    buildWorkbenchCardWorkspaceKey(item),
    versionKey || 'unknown-version',
    formKey,
    contentSignatureKey || 'unknown-content',
  ].join('|')
}

const dedupeWorkbenchCards = (
  cards: BlueprintWorkbenchDraftCard[],
) => {
  const deduped = new Map<string, BlueprintWorkbenchDraftCard>()
  for (const card of cards) {
    const key = buildWorkbenchCardDedupKey(card.item, card.form)
    const current = deduped.get(key)
    if (!current || (card.updatedAt || 0) >= (current.updatedAt || 0)) {
      deduped.set(key, card)
    }
  }
  return Array.from(deduped.values())
}

const buildGroupedVisibleGroups = (
  cardsInMode: BlueprintWorkbenchDraftCard[],
  applyingId?: string | null,
  includeAllStatuses = false,
): BlueprintWorkbenchGroup[] => {
  const groupsMap = new Map<string, BlueprintWorkbenchGroup>()
  const normalizedApplyingId = normalizeApplyingId(applyingId)
  const isAnyApplying = Boolean(normalizedApplyingId)
  const isBatchApplying = isBatchApplyingId(normalizedApplyingId)

  for (const card of cardsInMode) {
    const groupName = card.hasExplicitGroupName ? card.rawGroupName : getUngroupedGroupName()
    const groupKey = includeAllStatuses ? groupName : `${card.mode}::${groupName}`
    const cardInGroup: BlueprintWorkbenchCard = {
      ...card,
      groupName,
    }
    const existingGroup = groupsMap.get(groupKey)

    if (existingGroup) {
      existingGroup.cards.push(cardInGroup)
      continue
    }

    groupsMap.set(groupKey, {
      key: groupKey,
      name: groupName,
      title: groupName,
      subtitle: '',
      summaryText: '',
      description: card.mode === 'review'
        ? i18next.t('blueprintWorkbenchViewModel.groupPendingDescription')
        : i18next.t('blueprintWorkbenchViewModel.groupGeneratedDescription'),
      stripText: '',
      mode: card.mode,
      totalCount: 0,
      pendingCount: 0,
      appliedCount: 0,
      totalFieldCount: 0,
      primaryCardTitle: '',
      statusLabel: '',
      statusTone: 'pending',
      summaryTexts: [],
      metaPills: [],
      metaLines: [],
      previewTitles: [],
      cards: [cardInGroup],
    })
  }

  return Array.from(groupsMap.values())
    .map((group): BlueprintWorkbenchGroup => {
      const sortedCards = [...group.cards].sort(compareCards).map((card, index, list) => {
        const role = index === 0 ? 'primary' as const : 'secondary' as const
        const relatedCount = Math.max(list.length - 1, 0)
        return {
          ...card,
          role,
          titleMeta: role === 'primary' && relatedCount > 0
            ? i18next.t('blueprintWorkbenchViewModel.relatedPageCount', { count: relatedCount })
            : i18next.t('blueprintWorkbenchViewModel.fieldCountCompact', { count: card.fieldCount }),
          statusLabel: buildGroupedCardStatusLabel(card.status, card.item),
          statusNote: buildGroupedCardStatusNote(),
        }
      })

      const pendingCount = sortedCards.filter(card => isPendingCardStatus(card.status)).length
      const appliedCount = sortedCards.filter(card => isGeneratedCardStatus(card.status)).length
      const totalFieldCount = sortedCards.reduce((total, card) => total + card.fieldCount, 0)
      const groupMode: BlueprintWorkbenchMode = pendingCount > 0 ? 'review' : 'generated'
      const isMixedStatusGroup = pendingCount > 0 && appliedCount > 0
      const isApplyingCurrentGroup = !isBatchApplying && sortedCards.some(
        card => normalizeText(card.item.id) === normalizedApplyingId,
      )
      const primaryTitle = sortedCards[0]?.title || group.name
      const otherTitles = sortedCards.slice(1).map(card => card.title)
      const orderedTitles = sortedCards.map(card => card.title)
      const subtitle = orderedTitles.slice(0, 5).join(i18next.t('blueprintWorkbenchViewModel.listSeparator'))
      const firstSummary = sortedCards.find(card => normalizeText(card.summary).length)?.summary
      const fallbackSummaryText = otherTitles.length
        ? i18next.t('blueprintWorkbenchViewModel.groupSummaryWithOtherPages', {
          primaryTitle,
          otherTitles: otherTitles.join(i18next.t('blueprintWorkbenchViewModel.listSeparator')),
        })
        : i18next.t('blueprintWorkbenchViewModel.groupSummarySinglePage', { primaryTitle })
      const summaryText = firstSummary || fallbackSummaryText
      const metaPills = [
        i18next.t('blueprintWorkbenchViewModel.pendingCountPill', { count: pendingCount }),
        i18next.t('blueprintWorkbenchViewModel.generatedCountPill', { count: appliedCount }),
        sortedCards.length > 1
          ? i18next.t('blueprintWorkbenchViewModel.primaryPagePill', { title: primaryTitle })
          : i18next.t('blueprintWorkbenchViewModel.singlePageGroup'),
      ]
      const stripText = groupMode === 'review'
        ? (isMixedStatusGroup
          ? i18next.t('blueprintWorkbenchViewModel.groupMixedPendingStrip', { pendingCount, appliedCount })
          : (sortedCards.length > 1
            ? i18next.t('blueprintWorkbenchViewModel.groupSequentialStrip', {
              orderedTitles: orderedTitles.join(i18next.t('blueprintWorkbenchViewModel.arrowSeparator')),
            })
            : i18next.t('blueprintWorkbenchViewModel.groupSinglePendingStrip', { primaryTitle })))
        : (sortedCards.length > 1
          ? i18next.t('blueprintWorkbenchViewModel.groupGeneratedStrip', {
            appliedCount,
            orderedTitles: orderedTitles.join(i18next.t('blueprintWorkbenchViewModel.arrowSeparator')),
          })
          : i18next.t('blueprintWorkbenchViewModel.groupSingleGeneratedStrip', { primaryTitle }))
      const metaLines = sortedCards.length > 1
        ? [
          i18next.t('blueprintWorkbenchViewModel.blueprintCountCompact', { count: sortedCards.length }),
          i18next.t('blueprintWorkbenchViewModel.fieldCountCompact', { count: totalFieldCount }),
          i18next.t('blueprintWorkbenchViewModel.mainBlueprintName', { title: primaryTitle }),
        ]
        : [
          i18next.t('blueprintWorkbenchViewModel.blueprintCountCompact', { count: sortedCards.length }),
          i18next.t('blueprintWorkbenchViewModel.fieldCountCompact', { count: totalFieldCount }),
          i18next.t('blueprintWorkbenchViewModel.singleFormBlueprint'),
        ]
      const summaryTexts = [
        i18next.t('blueprintWorkbenchViewModel.generatedCountCompact', { count: appliedCount }),
        i18next.t('blueprintWorkbenchViewModel.pendingCountCompact', { count: pendingCount }),
        i18next.t('blueprintWorkbenchViewModel.fieldCountNoSpace', { count: totalFieldCount }),
      ]

      return {
        ...group,
        cards: sortedCards,
        subtitle,
        summaryText,
        description: isMixedStatusGroup
          ? i18next.t('blueprintWorkbenchViewModel.groupMixedDescription', { appliedCount, pendingCount })
          : summaryText,
        stripText,
        mode: groupMode,
        totalCount: sortedCards.length,
        pendingCount,
        appliedCount,
        totalFieldCount,
        primaryCardTitle: primaryTitle,
        statusLabel: pendingCount > 0
          ? (appliedCount > 0
            ? i18next.t('blueprintWorkbenchViewModel.mixedStatusLabel', { appliedCount, pendingCount })
            : i18next.t('blueprintWorkbenchViewModel.pendingStatusLabel', {
              pendingCount,
              totalCount: sortedCards.length,
            }))
          : i18next.t('blueprintWorkbenchViewModel.generatedStatusLabel', { appliedCount }),
        statusTone: pendingCount > 0 ? 'pending' as const : 'applied' as const,
        summaryTexts,
        metaPills,
        metaLines,
        previewTitles: sortedCards.slice(0, 3).map(card => card.title),
        action: {
          loading: isApplyingCurrentGroup,
          disabled: groupMode !== 'review' || pendingCount <= 0 || isAnyApplying,
        },
      }
    })
    .sort((left, right) => {
      const countDiff = right.totalCount - left.totalCount
      if (countDiff !== 0) {
        return countDiff
      }
      return left.name.localeCompare(right.name, 'zh-CN')
    })
}

const buildFlatVisibleCards = (
  cardsInMode: BlueprintWorkbenchDraftCard[],
): BlueprintWorkbenchCard[] => {
  return cardsInMode.map(card => ({
    ...card,
    role: 'primary',
    groupName: card.rawGroupName,
    titleMeta: i18next.t('blueprintWorkbenchViewModel.fieldCountCompact', { count: card.fieldCount }),
    statusLabel: buildFlatCardStatusLabel(card.status, card.item),
    statusNote: buildFlatCardStatusNote(),
  }))
}

const resolveGroupedVisibleCards = (input: {
  groups: BlueprintWorkbenchGroup[]
  selectedKey?: string | null
}) => {
  const matchedGroup = input.groups.find(
    group => group.cards.some(card => card.key === input.selectedKey),
  )
  return matchedGroup?.cards || input.groups[0]?.cards || []
}

export const buildBlueprintWorkbenchViewModel = (
  input: BlueprintWorkbenchViewModelInput,
): BlueprintWorkbenchViewModel => {
  const items = Array.isArray(input.items)
    ? input.items.map(normalizeWorkbenchItem).sort(compareItems)
    : []
  const autoMode = resolveBlueprintWorkbenchMode(items)
  const hasReviewItems = items.some(item => resolveItemMode(item) === 'review')
  const hasGeneratedItems = items.some(item => resolveItemMode(item) === 'generated')
  const includeAllStatuses = Boolean(input.includeAllStatuses)
  const mode = resolveActualMode(
    input.activeMode || autoMode,
    hasReviewItems,
    hasGeneratedItems,
    includeAllStatuses,
  )
  const allCards = items
    .flatMap((item) => (item.blueprint?.forms || []).map(form => createDraftCard(item, form)))
    .sort(compareCards)
  const shouldCombineStatuses = includeAllStatuses && hasReviewItems && hasGeneratedItems

  const cardsInMode = dedupeWorkbenchCards(
    shouldCombineStatuses
      ? allCards
      : allCards.filter(card => card.mode === mode),
  )

  // A form destination group is not enough to make a single-form blueprint an app-level grouped workspace.
  const hasMultipleForms = cardsInMode.length > 1
  const hasExplicitGroups = hasMultipleForms && cardsInMode.some(card => card.hasExplicitGroupName)
  const layoutMode: BlueprintWorkbenchLayoutMode = hasExplicitGroups ? 'grouped' : 'flat'
  const groups = layoutMode === 'grouped'
    ? buildGroupedVisibleGroups(cardsInMode, input.applyingId, shouldCombineStatuses)
    : []
  const cards = layoutMode === 'grouped'
    ? groups.flatMap(group => group.cards)
    : buildFlatVisibleCards(cardsInMode)
  const visibleCards = layoutMode === 'grouped'
    ? resolveGroupedVisibleCards({
      groups,
      selectedKey: input.selectedKey,
    })
    : cards

  const stageState = resolveStageState({
    loading: input.loading,
    hasCards: cards.length > 0,
    isReviewMode: mode === 'review',
    isGeneratedMode: mode === 'generated',
  })

  const defaultSelectedKey = visibleCards.find(card => card.key === input.selectedKey)?.key
    || visibleCards[0]?.key

  const selectedCard = visibleCards.find(card => card.key === defaultSelectedKey)
  const historyEntries = cardsInMode
    .map((card) => ({
      key: card.itemKey,
      title: normalizeText(
        card.item.title || card.item.blueprint?.title,
        i18next.t('blueprintWorkbenchViewModel.blueprintRecord'),
      ),
      summary: normalizeText(card.item.summary || card.item.blueprint?.summary, '') || undefined,
      mode: resolveItemMode(card.item),
      timeText: formatTimeText(pickItemTimestamp(card.item) || undefined),
      selected: card.key === defaultSelectedKey,
      sourceText: buildSourceText(card.item),
      cardKey: card.key,
      item: card.item,
      generatedCount: card.item.itemKind === 'current_form_snapshot'
        ? (Array.isArray(card.item.blueprint?.forms) ? card.item.blueprint.forms.length : undefined)
        : (isBlueprintAppliedPhase(card.item.phase) && Array.isArray(card.item.applyResult?.forms) ? card.item.applyResult.forms.length : undefined),
    }))
    .filter((entry, index, list) => (
      list.findIndex(item => item.key === entry.key && item.cardKey === entry.cardKey) === index
    ))

  const emptyState = buildEmptyState({
    stageState,
    layoutMode,
  })

  return {
    mode,
    stageState,
    layoutMode,
    hasExplicitGroups,
    hasReviewItems,
    hasGeneratedItems,
    header: buildHeader({
      mode,
      stageState,
      layoutMode,
      includeAllStatuses,
      hasSelectableCard: Boolean(defaultSelectedKey),
      hasReviewItems,
      hasGeneratedItems,
      visibleGroupCount: groups.length,
      visibleCardCount: cards.length,
      applyingId: input.applyingId,
    }),
    groups,
    cards,
    visibleCards,
    historyEntries,
    defaultSelectedKey,
    selectedCard,
    emptyTitle: emptyState.emptyTitle,
    emptyDescription: emptyState.emptyDescription,
  }
}
