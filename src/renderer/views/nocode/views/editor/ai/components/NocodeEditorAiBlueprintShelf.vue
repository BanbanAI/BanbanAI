<template>
  <div class="ai-blueprint-shelf">
    <template v-if="workbench.stageState === 'generating' && !workbench.cards.length">
      <div class="ai-blueprint-shelf__state-shell">
        <div class="ai-blueprint-shelf__state">
          <div class="ai-blueprint-shelf__state-inner">
            <div class="ai-blueprint-shelf__state-icon">
              <el-icon class="is-loading" :size="30"><i-ep-loading /></el-icon>
            </div>
            <div class="ai-blueprint-shelf__state-title">{{ $t('nocodeEditorAiBlueprintShelf.generatingBlueprint') }}</div>
            <div class="ai-blueprint-shelf__state-description">
              {{ loadingMessage || $t('nocodeEditorAiBlueprintShelf.expandingPlanToBlueprint') }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-else-if="workbench.stageState === 'initial'">
      <div class="ai-blueprint-shelf__state-shell">
        <div class="ai-blueprint-shelf__state">
          <div class="ai-blueprint-shelf__state-inner">
            <div class="ai-blueprint-shelf__state-icon">
              <el-icon :size="40"><i-ven-edit-empty /></el-icon>
            </div>
            <div class="ai-blueprint-shelf__state-title">{{ workbench.emptyTitle }}</div>
            <div class="ai-blueprint-shelf__state-description">{{ workbench.emptyDescription }}</div>
          </div>
        </div>
      </div>
    </template>

    <div v-else-if="hasWorkbenchContent" class="ai-blueprint-shelf__body">
      <nocode-editor-ai-blueprint-workbench-header
        :title="headerTitle"
        :description="workbench.header.description"
        :actions="headerActions"
        @action="handleHeaderAction"
      />

      <div v-if="loading && workbench.cards.length" class="ai-blueprint-shelf__banner">
        <el-icon class="is-loading" :size="14"><i-ep-loading /></el-icon>
        <span>{{ loadingMessage || $t('nocodeEditorAiBlueprintShelf.generatingNewBlueprint') }}</span>
      </div>

      <template v-if="workbench.layoutMode === 'grouped'">
        <div class="ai-blueprint-shelf__layout">
          <el-scrollbar class="ai-blueprint-shelf__rail-shell" height="100%">
            <nocode-editor-ai-blueprint-workbench-rail
              :groups="workbench.groups"
              :active-group-key="activeGroupKey"
              @select-group="handleSelectGroup"
            />
          </el-scrollbar>

          <section v-if="activeGroup" class="ai-blueprint-shelf__group-content">
            <div class="ai-blueprint-shelf__group-shell">
              <nocode-editor-ai-blueprint-workbench-group-summary-panel
                :group="activeGroup"
                :show-apply="showApplyGroupAction"
                :loading="activeGroupApplyLoading"
                :disabled="activeGroupApplyDisabled"
                @apply-group="handleApplyGroup"
              />

              <nocode-editor-ai-blueprint-workbench-tabs
                v-if="showWorkbenchTabs"
                :tabs="workbenchTabs"
                :active-key="activeTabKey"
                :summaryTexts="tabSummaryTexts"
                @select="handleSelectTab"
              />

              <div
                :class="[
                  'ai-blueprint-shelf__group-layout',
                  { 'is-single-card': hasSingleCardGroup },
                ]"
              >
                <!-- 共享卡片实际由总览面板承载：<nocode-editor-ai-blueprint-workbench-card /> -->
                <div class="ai-blueprint-shelf__tab-panel">
                  <template v-if="showOverviewPanel">
                    <nocode-editor-ai-blueprint-workbench-overview-panel
                      :cards="activeCards"
                      :selected-card-key="selectedCardKey"
                      :applying-id="applyingId"
                      :allow-apply-action="allowReviewActions"
                      @select="handleSelectCard"
                      @apply="handleApplyCard"
                      @open="handleOpenCard"
                    />
                  </template>

                  <template v-else>
                    <el-scrollbar class="ai-blueprint-shelf__form-panel-shell" height="100%">
                      <nocode-editor-ai-blueprint-workbench-form-panel
                        :card="activeFormCard"
                        :mode="workbench.mode"
                        :flow-artifact-blocks="flowArtifactBlocks"
                        :applying-id="applyingId"
                        :history-entries="historyEntries"
                        :allow-review-actions="allowReviewActions"
                        :response-drafts="resolveConfirmationResponseDrafts(activeFormCard?.item)"
                        :active-input-question-ids="resolveActiveConfirmationInputQuestionIds(activeFormCard?.item)"
                        :inline-note-question-ids="resolveInlineConfirmationNoteQuestionIds(activeFormCard?.item)"
                        :submitting-confirmation="submittingConfirmation"
                        :get-flow-confirmation-response-drafts="resolveFlowConfirmationResponseDrafts"
                        :get-flow-active-confirmation-input-question-ids="resolveFlowActiveConfirmationInputQuestionIds"
                        :get-flow-inline-confirmation-note-question-ids="resolveFlowInlineConfirmationNoteQuestionIds"
                        :can-apply-flow-artifact="resolveCanApplyFlowArtifact"
                        :is-applying-flow-artifact="resolveIsApplyingFlowArtifact"
                        @apply="emit('apply', $event)"
                        @continue="emit('continue', $event)"
                        @apply-flow="emit('apply-flow', $event)"
                        @continue-flow-defaults="emit('continue-flow-defaults', $event)"
                        @select-confirmation-option="emit('select-confirmation-option', $event)"
                        @toggle-note-input="emit('toggle-note-input', $event)"
                        @update-note="emit('update-note', $event)"
                        @submit-confirmation-responses="emit('submit-confirmation-responses', $event)"
                        @toggle-flow-note-input="emit('toggle-flow-note-input', $event)"
                        @update-flow-note="emit('update-flow-note', $event)"
                        @submit-flow-confirmation-responses="emit('submit-flow-confirmation-responses', $event)"
                        @open-generated-page="emit('open-generated-page', $event)"
                        @locate-draft-issue="emit('locate-draft-issue', $event)"
                      />
                    </el-scrollbar>
                  </template>
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>

      <section v-else class="ai-blueprint-shelf__flat-content">
        <div class="ai-blueprint-shelf__flat-shell">
          <nocode-editor-ai-blueprint-workbench-tabs
            v-if="showWorkbenchTabs"
            :tabs="workbenchTabs"
            :active-key="activeTabKey"
            :summaryTexts="tabSummaryTexts"
            @select="handleSelectTab"
          />

          <div
            :class="[
              'ai-blueprint-shelf__tab-panel',
              { 'is-single-card': hasSingleCardGroup },
            ]"
          >
            <template v-if="showOverviewPanel">
              <nocode-editor-ai-blueprint-workbench-overview-panel
                :cards="activeCards"
                :selected-card-key="selectedCardKey"
                :applying-id="applyingId"
                :allow-apply-action="allowReviewActions"
                @select="handleSelectCard"
                @apply="handleApplyCard"
                @open="handleOpenCard"
              />
            </template>

            <template v-else>
              <el-scrollbar class="ai-blueprint-shelf__form-panel-shell" height="100%">
                <nocode-editor-ai-blueprint-workbench-form-panel
                  :card="activeFormCard"
                  :mode="workbench.mode"
                  :flow-artifact-blocks="flowArtifactBlocks"
                  :applying-id="applyingId"
                  :history-entries="historyEntries"
                  :allow-review-actions="allowReviewActions"
                  :response-drafts="resolveConfirmationResponseDrafts(activeFormCard?.item)"
                  :active-input-question-ids="resolveActiveConfirmationInputQuestionIds(activeFormCard?.item)"
                  :inline-note-question-ids="resolveInlineConfirmationNoteQuestionIds(activeFormCard?.item)"
                  :submitting-confirmation="submittingConfirmation"
                  :get-flow-confirmation-response-drafts="resolveFlowConfirmationResponseDrafts"
                  :get-flow-active-confirmation-input-question-ids="resolveFlowActiveConfirmationInputQuestionIds"
                  :get-flow-inline-confirmation-note-question-ids="resolveFlowInlineConfirmationNoteQuestionIds"
                  :can-apply-flow-artifact="resolveCanApplyFlowArtifact"
                  :is-applying-flow-artifact="resolveIsApplyingFlowArtifact"
                  @apply="emit('apply', $event)"
                  @continue="emit('continue', $event)"
                  @apply-flow="emit('apply-flow', $event)"
                  @continue-flow-defaults="emit('continue-flow-defaults', $event)"
                  @select-confirmation-option="emit('select-confirmation-option', $event)"
                  @toggle-note-input="emit('toggle-note-input', $event)"
                  @update-note="emit('update-note', $event)"
                  @submit-confirmation-responses="emit('submit-confirmation-responses', $event)"
                  @toggle-flow-note-input="emit('toggle-flow-note-input', $event)"
                  @update-flow-note="emit('update-flow-note', $event)"
                  @submit-flow-confirmation-responses="emit('submit-flow-confirmation-responses', $event)"
                  @open-generated-page="emit('open-generated-page', $event)"
                  @locate-draft-issue="emit('locate-draft-issue', $event)"
                />
              </el-scrollbar>
            </template>
          </div>
        </div>
      </section>
    </div>

    <template v-else>
      <div class="ai-blueprint-shelf__state-shell">
        <div class="ai-blueprint-shelf__state">
          <div class="ai-blueprint-shelf__state-inner">
            <div class="ai-blueprint-shelf__state-icon">
              <el-icon :size="40"><i-ven-edit-empty /></el-icon>
            </div>
            <div class="ai-blueprint-shelf__state-title">{{ workbench.emptyTitle }}</div>
            <div class="ai-blueprint-shelf__state-description">{{ workbench.emptyDescription }}</div>
          </div>
        </div>
      </div>
    </template>

    <nocode-editor-ai-blueprint-workbench-history-drawer
      v-model="historyDrawerVisible"
      :entries="historyEntries"
      :mode="workbench.mode"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import i18next from 'i18next'
import type { AiAssistantArtifactBlock } from '@common/types/ai'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import {
  isBlueprintAppliedPhase,
  isBlueprintStagedPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import type { AiArtifactConfirmationQuestion } from '@renderer/views/nocode/components/ai/artifactBlock'
import {
  buildBlueprintWorkbenchViewModel,
  type BlueprintWorkbenchCard,
  type BlueprintWorkbenchHeaderActionKey,
  type BlueprintWorkbenchHistoryEntry,
  type BlueprintWorkbenchMode,
  resolveBlueprintWorkbenchMode,
} from '../blueprintWorkbenchViewModel'
import type {
  NocodeEditorAiBlueprintApplyScope,
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiDraftActionIssue,
  NocodeEditorAiGeneratedBlueprintPageTarget,
  NocodeEditorAiStageBlueprintDisplayItem,
} from '../types'
import type { NocodeEditorAiConfirmationResponseDraftMap } from './confirmationInteraction'
import NocodeEditorAiBlueprintWorkbenchFormPanel from './NocodeEditorAiBlueprintWorkbenchFormPanel.vue'
import NocodeEditorAiBlueprintWorkbenchGroupSummaryPanel from './NocodeEditorAiBlueprintWorkbenchGroupSummaryPanel.vue'
import NocodeEditorAiBlueprintWorkbenchHeader from './NocodeEditorAiBlueprintWorkbenchHeader.vue'
import NocodeEditorAiBlueprintWorkbenchHistoryDrawer from './NocodeEditorAiBlueprintWorkbenchHistoryDrawer.vue'
import NocodeEditorAiBlueprintWorkbenchOverviewPanel from './NocodeEditorAiBlueprintWorkbenchOverviewPanel.vue'
import NocodeEditorAiBlueprintWorkbenchRail from './NocodeEditorAiBlueprintWorkbenchRail.vue'
import NocodeEditorAiBlueprintWorkbenchTabs from './NocodeEditorAiBlueprintWorkbenchTabs.vue'

type BlueprintWorkbenchTabOption = { key: string; label: string }

const OVERVIEW_TAB_KEY = 'overview'
const FORM_TAB_PREFIX = 'form:'

const buildFormTabKey = (cardKey: string) => `${FORM_TAB_PREFIX}${cardKey}`
const resolveTabCardKey = (tabKey: string) => (
  tabKey.startsWith(FORM_TAB_PREFIX) ? tabKey.slice(FORM_TAB_PREFIX.length) : ''
)
const resolvePreferredCardKey = (cards: BlueprintWorkbenchCard[], preferredCardKey = '') => (
  cards.find(card => card.key === preferredCardKey)?.key
  || cards[0]?.key
  || ''
)
const resolveDefaultActiveTabKey = (cards: BlueprintWorkbenchCard[], preferredCardKey = '') => {
  if (cards.length > 1) {
    return OVERVIEW_TAB_KEY
  }

  const nextCardKey = resolvePreferredCardKey(cards, preferredCardKey)
  return nextCardKey ? buildFormTabKey(nextCardKey) : OVERVIEW_TAB_KEY
}
const resolveNextActiveTabKey = (
  cards: BlueprintWorkbenchCard[],
  currentTabKey: string,
  preferredCardKey = '',
) => {
  const currentTabCardKey = resolveTabCardKey(currentTabKey)
  if (currentTabCardKey && cards.some(card => card.key === currentTabCardKey)) {
    return currentTabKey
  }

  if (currentTabKey === OVERVIEW_TAB_KEY && cards.length > 1) {
    return OVERVIEW_TAB_KEY
  }

  return resolveDefaultActiveTabKey(cards, preferredCardKey)
}

const isStagedBlueprintItem = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
) => (
  item?.itemKind === 'ai_blueprint'
  && isBlueprintStagedPhase(item.phase)
)

const isGeneratedBlueprintItem = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
) => (
  item?.itemKind === 'current_form_snapshot'
  || (item?.itemKind === 'ai_blueprint' && isBlueprintAppliedPhase(item.phase))
)

const isStagedBlueprintCard = (card?: BlueprintWorkbenchCard | null) => (
  isStagedBlueprintItem(card?.item)
)

const isGeneratedBlueprintCard = (card?: BlueprintWorkbenchCard | null) => (
  isGeneratedBlueprintItem(card?.item)
)

const props = defineProps({
  items: {
    type: Array as PropType<NocodeEditorAiStageBlueprintDisplayItem[]>,
    required: true,
  },
  historyItems: {
    type: Array as PropType<NocodeEditorAiStageBlueprintDisplayItem[]>,
    default: () => [],
  },
  flowArtifactBlocks: {
    type: Array as PropType<NocodeEditorAiArtifactBlock[]>,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  loadingMessage: {
    type: String,
    default: '',
  },
  allowReviewActions: {
    type: Boolean,
    default: true,
  },
  appName: {
    type: String,
    default: '',
  },
  initialFocusCardKey: {
    type: String,
    default: '',
  },
  refreshingApplied: {
    type: Boolean,
    default: false,
  },
  applyingId: {
    type: String,
    default: '',
  },
  getConfirmationResponseDrafts: {
    type: Function as PropType<(item: NocodeEditorAiStageBlueprintDisplayItem) => NocodeEditorAiConfirmationResponseDraftMap>,
    default: undefined,
  },
  getActiveConfirmationInputQuestionIds: {
    type: Function as PropType<(item: NocodeEditorAiStageBlueprintDisplayItem) => string[]>,
    default: undefined,
  },
  getInlineConfirmationNoteQuestionIds: {
    type: Function as PropType<(item: NocodeEditorAiStageBlueprintDisplayItem) => string[]>,
    default: undefined,
  },
  getFlowConfirmationResponseDrafts: {
    type: Function as PropType<(block: NocodeEditorAiArtifactBlock) => NocodeEditorAiConfirmationResponseDraftMap>,
    default: undefined,
  },
  getFlowActiveConfirmationInputQuestionIds: {
    type: Function as PropType<(block: NocodeEditorAiArtifactBlock) => string[]>,
    default: undefined,
  },
  getFlowInlineConfirmationNoteQuestionIds: {
    type: Function as PropType<(block: NocodeEditorAiArtifactBlock) => string[]>,
    default: undefined,
  },
  canApplyFlowArtifact: {
    type: Function as PropType<(block: NocodeEditorAiArtifactBlock) => boolean>,
    default: undefined,
  },
  isApplyingFlowArtifact: {
    type: Function as PropType<(block: NocodeEditorAiArtifactBlock) => boolean>,
    default: undefined,
  },
  submittingConfirmation: {
    type: Boolean,
    default: false,
  },
  previewMode: {
    type: Boolean,
    default: false,
  },
  showAllStatuses: {
    type: Boolean,
    default: false,
  },
  showBatchApplyAction: {
    type: Boolean,
    default: true,
  },
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'refresh-applied'): void
  (event: 'apply', item: NocodeEditorAiStageBlueprintDisplayItem): void
  (event: 'apply-pending-batch', payload: {
    items: NocodeEditorAiStageBlueprintDisplayItem[]
    scope: Exclude<NocodeEditorAiBlueprintApplyScope, 'single'>
  }): void
  (event: 'open-generated-page', payload: NocodeEditorAiGeneratedBlueprintPageTarget): void
  (event: 'continue', item: NocodeEditorAiStageBlueprintDisplayItem): void
  (event: 'apply-flow', block: NocodeEditorAiArtifactBlock): void
  (event: 'continue-flow-defaults', block: NocodeEditorAiArtifactBlock): void
  (event: 'select-confirmation-option', payload: {
    block: AiAssistantArtifactBlock
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }): void
  (event: 'toggle-note-input', payload: {
    item: NocodeEditorAiStageBlueprintDisplayItem
    block: AiAssistantArtifactBlock
    question: AiArtifactConfirmationQuestion
  }): void
  (event: 'update-note', payload: {
    item: NocodeEditorAiStageBlueprintDisplayItem
    block: AiAssistantArtifactBlock
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
  (event: 'submit-confirmation-responses', payload: {
    item: NocodeEditorAiStageBlueprintDisplayItem
    block: AiAssistantArtifactBlock
  }): void
  (event: 'toggle-flow-note-input', payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
  }): void
  (event: 'update-flow-note', payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
  (event: 'submit-flow-confirmation-responses', block: NocodeEditorAiArtifactBlock): void
  (event: 'locate-draft-issue', issue: NocodeEditorAiDraftActionIssue): void
}>()

const selectedCardKey = ref('')
const activeGroupKey = ref('')
const activeTabKey = ref(OVERVIEW_TAB_KEY)
const activeMode = ref<BlueprintWorkbenchMode>(resolveBlueprintWorkbenchMode(props.items))
const historyDrawerVisible = ref(false)
const pendingBatchActionIntent = ref<'' | 'all' | 'group'>('')
const pendingBatchActionGroupKey = ref('')
const appliedInitialFocusCardKey = ref('')

const pendingItemsForBatch = computed(() => (
  props.items.filter(item => isStagedBlueprintItem(item))
))

const isBatchApplying = computed(() => props.applyingId === 'batch')

const workbench = computed(() => buildBlueprintWorkbenchViewModel({
  items: props.items,
  selectedKey: selectedCardKey.value || undefined,
  activeMode: activeMode.value,
  includeAllStatuses: props.showAllStatuses,
  loading: props.loading,
}))

const historyWorkbench = computed(() => (
  props.historyItems.length
    ? buildBlueprintWorkbenchViewModel({
      items: props.historyItems,
      activeMode: workbench.value.mode,
      includeAllStatuses: props.showAllStatuses,
    })
    : null
))

const focusWorkbenchCard = (targetCard: BlueprintWorkbenchCard) => {
  activeMode.value = targetCard.mode
  selectedCardKey.value = targetCard.key
  activeTabKey.value = buildFormTabKey(targetCard.key)

  if (workbench.value.layoutMode === 'grouped') {
    activeGroupKey.value = workbench.value.groups.find(group => group.cards.some(card => card.key === targetCard.key))?.key || activeGroupKey.value
  }
}

const applyInitialFocusCardKey = () => {
  const targetCardKey = String(props.initialFocusCardKey || '').trim()
  if (!targetCardKey || appliedInitialFocusCardKey.value === targetCardKey) {
    return false
  }

  const targetCard = workbench.value.cards.find(card => card.key === targetCardKey)
  if (!targetCard) {
    return false
  }

  focusWorkbenchCard(targetCard)
  appliedInitialFocusCardKey.value = targetCardKey
  return true
}

const hasWorkbenchContent = computed(() => workbench.value.cards.length > 0)
const headerTitle = computed(() => (
  props.appName.trim()
    ? i18next.t('nocodeEditorAiBlueprintShelf.appBlueprintTitle', {
      appName: props.appName.trim(),
      suffix: workbench.value.mode === 'generated'
        ? i18next.t('nocodeEditorAiBlueprintShelf.generatedResultSuffix')
        : i18next.t('nocodeEditorAiBlueprintShelf.blueprintSuffix'),
    })
    : workbench.value.header.title
))

const headerActions = computed(() => (
  workbench.value.header.actions
    .filter(action => action.key !== 'apply-pending-batch' || props.showBatchApplyAction)
    .map((action) => {
      if (action.key !== 'apply-pending-batch') {
        return {
          ...action,
          disabled: Boolean(action.disabled || props.applyingId),
        }
      }

      return {
        ...action,
        loading: isBatchApplying.value && pendingBatchActionIntent.value === 'all',
        disabled: Boolean(action.disabled || props.applyingId),
      }
    })
))

watch(workbench, (nextWorkbench) => {
  activeMode.value = nextWorkbench.mode

  if (nextWorkbench.stageState === 'initial') {
    activeGroupKey.value = ''
    selectedCardKey.value = ''
    activeTabKey.value = OVERVIEW_TAB_KEY
    return
  }

  if (nextWorkbench.stageState === 'generating' && !nextWorkbench.cards.length) {
    activeGroupKey.value = ''
    selectedCardKey.value = ''
    activeTabKey.value = OVERVIEW_TAB_KEY
    return
  }

  const existingSelectedCard = nextWorkbench.visibleCards.find(card => card.key === selectedCardKey.value) || null

  if (nextWorkbench.layoutMode === 'grouped') {
    const nextCurrentActiveGroupKey = nextWorkbench.groups.find(group => group.key === activeGroupKey.value)?.key
      || nextWorkbench.groups[0]?.key
      || ''
    const currentActiveGroupHasSelectedCard = existingSelectedCard
      ? Boolean(
        nextWorkbench.groups.find(group => group.key === nextCurrentActiveGroupKey)?.cards.some(card => card.key === existingSelectedCard.key),
      )
      : false
    const selectedCardGroupKey = existingSelectedCard
      ? nextWorkbench.groups.find(group => group.cards.some(card => card.key === existingSelectedCard.key))?.key || ''
      : ''
    const nextActiveGroupKey = existingSelectedCard && !currentActiveGroupHasSelectedCard
      ? selectedCardGroupKey
      : nextCurrentActiveGroupKey

    activeGroupKey.value = nextActiveGroupKey || ''

    const nextActiveCards = nextWorkbench.groups.find(group => group.key === activeGroupKey.value)?.cards || []
    const nextSelectedCardKey = nextActiveCards.find(card => card.key === selectedCardKey.value)?.key
      || nextActiveCards[0]?.key
      || nextWorkbench.defaultSelectedKey
      || ''

    selectedCardKey.value = nextSelectedCardKey
    activeTabKey.value = resolveNextActiveTabKey(nextActiveCards, activeTabKey.value, nextSelectedCardKey)
    return
  }

  activeGroupKey.value = ''
  const nextSelectedCardKey = existingSelectedCard?.key
    || nextWorkbench.defaultSelectedKey
    || nextWorkbench.visibleCards[0]?.key
    || ''
  selectedCardKey.value = nextSelectedCardKey
  activeTabKey.value = resolveNextActiveTabKey(
    nextWorkbench.visibleCards,
    activeTabKey.value,
    nextSelectedCardKey,
  )
}, {
  immediate: true,
})

watch(workbench, () => {
  applyInitialFocusCardKey()
}, {
  immediate: true,
})

watch(() => props.initialFocusCardKey, (nextCardKey, previousCardKey) => {
  if (nextCardKey !== previousCardKey) {
    appliedInitialFocusCardKey.value = ''
  }
  applyInitialFocusCardKey()
}, {
  immediate: true,
})

watch(() => props.items, (items) => {
  const hasReviewItems = items.some(item => isStagedBlueprintItem(item))
  const hasGeneratedItems = items.some(item => isGeneratedBlueprintItem(item))

  if (activeMode.value === 'review' && hasReviewItems) {
    return
  }

  if (activeMode.value === 'generated' && hasGeneratedItems) {
    return
  }

  if (hasReviewItems) {
    activeMode.value = 'review'
    return
  }

  if (hasGeneratedItems) {
    activeMode.value = 'generated'
    return
  }

  activeMode.value = resolveBlueprintWorkbenchMode(items)
}, {
  immediate: true,
})

watch(() => props.applyingId, (nextApplyingId) => {
  if (!nextApplyingId) {
    pendingBatchActionIntent.value = ''
    pendingBatchActionGroupKey.value = ''
  }
})

const activeGroup = computed(() => (
  workbench.value.layoutMode === 'grouped'
    ? workbench.value.groups.find(group => group.key === activeGroupKey.value)
    : null
))

const activeCards = computed(() => (
  workbench.value.layoutMode === 'grouped'
    ? activeGroup.value?.cards || []
    : workbench.value.visibleCards
))

const activeGroupPendingItems = computed(() => {
  if (!activeGroup.value) {
    return []
  }

  const pendingItems = activeGroup.value.cards
    .filter(card => isStagedBlueprintCard(card))
    .map(card => card.item)
  const seen = new Set<string>()

  return pendingItems.filter((item) => {
    const key = String(item.id || item.identityKey || '')
    if (!key || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
})

const showApplyGroupAction = computed(() => (
  props.allowReviewActions
  && workbench.value.mode === 'review'
  && activeGroupPendingItems.value.length > 0
))

const activeGroupApplyLoading = computed(() => (
  isBatchApplying.value
  && pendingBatchActionIntent.value === 'group'
  && activeGroup.value?.key === pendingBatchActionGroupKey.value
))

const activeGroupApplyDisabled = computed(() => (
  !showApplyGroupAction.value
  || Boolean(props.applyingId)
))

const hasSingleCardGroup = computed(() => activeCards.value.length <= 1)
const hasOverviewTab = computed(() => activeCards.value.length > 1)

const workbenchTabs = computed<BlueprintWorkbenchTabOption[]>(() => (
  (hasOverviewTab.value
    ? [{
      key: OVERVIEW_TAB_KEY,
      label: i18next.t('nocodeEditorAiBlueprintShelf.overview'),
    }]
    : []
  ).concat(activeCards.value.map(card => ({
    key: buildFormTabKey(card.key),
    label: card.title,
  })))
))

const showWorkbenchTabs = computed(() => workbenchTabs.value.length > 1)
const showOverviewPanel = computed(() => hasOverviewTab.value && activeTabKey.value === OVERVIEW_TAB_KEY)

const activeFormCard = computed(() => {
  const tabCardKey = resolveTabCardKey(activeTabKey.value)

  return activeCards.value.find(card => card.key === tabCardKey)
    || activeCards.value.find(card => card.key === selectedCardKey.value)
    || activeCards.value[0]
    || null
})

const resolveConfirmationResponseDrafts = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
): NocodeEditorAiConfirmationResponseDraftMap => {
  if (!item || !props.getConfirmationResponseDrafts) {
    return {}
  }

  return props.getConfirmationResponseDrafts(item)
}

const resolveActiveConfirmationInputQuestionIds = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
): string[] => {
  if (!item || !props.getActiveConfirmationInputQuestionIds) {
    return []
  }

  return props.getActiveConfirmationInputQuestionIds(item)
}

const resolveInlineConfirmationNoteQuestionIds = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
): string[] => {
  if (!item || !props.getInlineConfirmationNoteQuestionIds) {
    return []
  }

  return props.getInlineConfirmationNoteQuestionIds(item)
}

const resolveFlowConfirmationResponseDrafts = (
  block?: NocodeEditorAiArtifactBlock | null,
): NocodeEditorAiConfirmationResponseDraftMap => {
  if (!block || !props.getFlowConfirmationResponseDrafts) {
    return {}
  }

  return props.getFlowConfirmationResponseDrafts(block)
}

const resolveFlowActiveConfirmationInputQuestionIds = (
  block?: NocodeEditorAiArtifactBlock | null,
): string[] => {
  if (!block || !props.getFlowActiveConfirmationInputQuestionIds) {
    return []
  }

  return props.getFlowActiveConfirmationInputQuestionIds(block)
}

const resolveFlowInlineConfirmationNoteQuestionIds = (
  block?: NocodeEditorAiArtifactBlock | null,
): string[] => {
  if (!block || !props.getFlowInlineConfirmationNoteQuestionIds) {
    return []
  }

  return props.getFlowInlineConfirmationNoteQuestionIds(block)
}

const resolveCanApplyFlowArtifact = (
  block?: NocodeEditorAiArtifactBlock | null,
): boolean => {
  if (!block || !props.canApplyFlowArtifact) {
    return false
  }

  return props.canApplyFlowArtifact(block)
}

const resolveIsApplyingFlowArtifact = (
  block?: NocodeEditorAiArtifactBlock | null,
): boolean => {
  if (!block || !props.isApplyingFlowArtifact) {
    return false
  }

  return props.isApplyingFlowArtifact(block)
}

const tabSummaryTexts = computed(() => {
  if (workbench.value.layoutMode === 'grouped') {
    return activeGroup.value?.summaryTexts || []
  }

  const pendingCount = activeCards.value.filter(card => isStagedBlueprintCard(card)).length
  const appliedCount = activeCards.value.filter(card => isGeneratedBlueprintCard(card)).length
  const totalFieldCount = activeCards.value.reduce((total, card) => total + card.fieldCount, 0)
  return [
    i18next.t('nocodeEditorAiBlueprintShelf.generatedCount', { count: appliedCount }),
    i18next.t('nocodeEditorAiBlueprintShelf.pendingCount', { count: pendingCount }),
    i18next.t('nocodeEditorAiBlueprintShelf.fieldCount', { count: totalFieldCount }),
  ]
})

watch(activeCards, (cards) => {
  const availableCardKeys = new Set(cards.map(card => card.key))
  const nextSelectedCardKey = availableCardKeys.has(selectedCardKey.value)
    ? selectedCardKey.value
    : cards[0]?.key || ''
  selectedCardKey.value = nextSelectedCardKey
  activeTabKey.value = resolveNextActiveTabKey(cards, activeTabKey.value, nextSelectedCardKey)
}, {
  immediate: true,
})

const historyEntries = computed<BlueprintWorkbenchHistoryEntry[]>(() => {
  const primaryEntries = workbench.value.historyEntries.filter(entry => entry.mode === workbench.value.mode)
  const extraEntries = historyWorkbench.value
    ? historyWorkbench.value.historyEntries.filter(entry => entry.mode === workbench.value.mode)
    : []
  const seen = new Set<string>()

  return [...primaryEntries, ...extraEntries].filter((entry) => {
    if (seen.has(entry.key)) {
      return false
    }
    seen.add(entry.key)
    return true
  })
})

const handleSelectGroup = (groupKey: string) => {
  activeGroupKey.value = groupKey
  const nextCards = workbench.value.groups.find(group => group.key === groupKey)?.cards || []
  const nextSelectedCardKey = nextCards[0]?.key || ''
  selectedCardKey.value = nextSelectedCardKey
  activeTabKey.value = resolveDefaultActiveTabKey(nextCards, nextSelectedCardKey)
}

const handleApplyGroup = () => {
  if (!props.allowReviewActions || !activeGroupPendingItems.value.length || props.applyingId) {
    return
  }

  pendingBatchActionIntent.value = 'group'
  pendingBatchActionGroupKey.value = activeGroup.value?.key || ''
  emit('apply-pending-batch', {
    items: activeGroupPendingItems.value,
    scope: 'group',
  })
}

const handleSelectCard = (card: BlueprintWorkbenchCard) => {
  selectedCardKey.value = card.key
  activeTabKey.value = buildFormTabKey(card.key)

  if (workbench.value.layoutMode === 'grouped') {
    activeGroupKey.value = workbench.value.groups.find(group => group.cards.some(item => item.key === card.key))?.key || activeGroupKey.value
  }
}

const handleSelectTab = (tabKey: string) => {
  activeTabKey.value = tabKey

  const tabCardKey = resolveTabCardKey(tabKey)
  if (!tabCardKey) {
    return
  }

  selectedCardKey.value = activeCards.value.find(card => card.key === tabCardKey)?.key || selectedCardKey.value
}

const handleApplyCard = (card: BlueprintWorkbenchCard) => {
  if (!props.allowReviewActions || !isStagedBlueprintCard(card) || props.applyingId) {
    return
  }

  selectedCardKey.value = card.key
  emit('apply', card.item)
}

const handleOpenCard = (card: BlueprintWorkbenchCard) => {
  selectedCardKey.value = card.key
  emit('open-generated-page', {
    item: card.item,
    formKey: card.form.formKey,
    tableName: card.form.tableName,
  })
}

const handleHeaderAction = (actionKey: BlueprintWorkbenchHeaderActionKey) => {
  if (actionKey === 'open-history') {
    historyDrawerVisible.value = true
    return
  }

  if (actionKey === 'apply-pending-batch') {
    if (pendingItemsForBatch.value.length && !props.applyingId) {
      pendingBatchActionIntent.value = 'all'
      emit('apply-pending-batch', {
        items: pendingItemsForBatch.value,
        scope: 'all',
      })
    }
    return
  }

  if (actionKey === 'switch-to-review' && workbench.value.hasReviewItems) {
    activeMode.value = 'review'
  }
}
</script>

<style scoped lang="scss">
.ai-blueprint-shelf {
  --blueprint-surface: #ffffff;
  --blueprint-surface-muted: #f7f8fa;
  --blueprint-surface-soft: #edf5ff;
  --blueprint-border: #e5e6eb;
  --blueprint-border-strong: #8ecaff;
  --blueprint-text-primary: #1d2129;
  --blueprint-text-secondary: #4e5969;
  --blueprint-text-tertiary: #86909c;
  --blueprint-brand: #0873ff;
  --blueprint-brand-soft: #e8f6ff;
  --blueprint-brand-strong: #0873ff;
  --blueprint-success: #52c41a;
  --blueprint-success-soft: #f4ffe8;
  --blueprint-warning: #faad14;
  --blueprint-warning-soft: #fffbe8;
  --blueprint-warning-border: #fde492;
  --blueprint-shadow: none;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f2f3f5;
}

.ai-blueprint-shelf__body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-blueprint-shelf__banner {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--blueprint-border);
  border-radius: 8px;
  background: var(--blueprint-surface-muted);
  color: var(--blueprint-brand-strong);
  font-size: 12px;
  line-height: 18px;
}

.ai-blueprint-shelf__layout {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  overflow: hidden;
}

.ai-blueprint-shelf__rail-shell {
  width: 300px;
  flex-shrink: 0;
  min-height: 0;
  padding: 12px;
  border: 1px solid var(--blueprint-border);
  border-radius: 8px;
  background: var(--blueprint-surface);
  box-shadow: var(--blueprint-shadow);
}

.ai-blueprint-shelf__rail-shell :deep(.el-scrollbar__wrap),
.ai-blueprint-shelf__form-panel-shell :deep(.el-scrollbar__wrap) {
  height: 100%;
  overflow-x: hidden;
}

.ai-blueprint-shelf__rail-shell :deep(.el-scrollbar__view),
.ai-blueprint-shelf__form-panel-shell :deep(.el-scrollbar__view) {
  min-height: 100%;
  min-width: 0;
}

.ai-blueprint-shelf__rail-shell :deep(.el-scrollbar__bar.is-horizontal),
.ai-blueprint-shelf__form-panel-shell :deep(.el-scrollbar__bar.is-horizontal) {
  display: none;
}

.ai-blueprint-shelf__group-content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.ai-blueprint-shelf__flat-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-blueprint-shelf__flat-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 12px;
  min-height: 0;
  padding: 12px;
  border: 1px solid var(--blueprint-border);
  border-radius: 8px;
  background: var(--blueprint-surface);
  box-shadow: var(--blueprint-shadow);
  overflow: hidden;
}

.ai-blueprint-shelf__group-shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 12px;
  min-height: 0;
  padding: 12px;
  border: 1px solid var(--blueprint-border);
  border-radius: 8px;
  background: var(--blueprint-surface);
  box-shadow: var(--blueprint-shadow);
  overflow: hidden;
}

.ai-blueprint-shelf__group-layout {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
}

.ai-blueprint-shelf__tab-panel {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  overflow: hidden;
}

.ai-blueprint-shelf__form-panel-shell {
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.ai-blueprint-shelf__state-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 12px;
  border: 1px solid var(--blueprint-border);
  border-radius: 8px;
  background: var(--blueprint-surface);
  box-shadow: var(--blueprint-shadow);
  overflow: hidden;
}

.ai-blueprint-shelf__state {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.ai-blueprint-shelf__state-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 28px 32px;
  border: none;
  border-radius: 20px;
  background: transparent;
  box-shadow: none;
}

.ai-blueprint-shelf__state-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  background: var(--blueprint-brand-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--blueprint-brand);
}

.ai-blueprint-shelf__state-title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-shelf__state-description {
  max-width: 420px;
  text-align: center;
  font-size: 13px;
  line-height: 20px;
  color: var(--blueprint-text-secondary);
}

@media (max-width: 1100px) {
  .ai-blueprint-shelf__layout {
    flex-direction: column;
    overflow: auto;
  }

  .ai-blueprint-shelf__group-shell {
    padding: 16px;
  }

  .ai-blueprint-shelf__rail-shell {
    width: 100%;
  }
}
</style>
