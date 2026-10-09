<template>
  <section class="ai-blueprint-workbench-form-panel">
    <template v-if="card">
      <section class="ai-blueprint-workbench-form-panel__hero">
        <div class="ai-blueprint-workbench-form-panel__hero-top">
          <div class="ai-blueprint-workbench-form-panel__hero-main">
            <div class="ai-blueprint-workbench-form-panel__title-row">
              <h2 class="ai-blueprint-workbench-form-panel__title">{{ activeTitle }}</h2>
              <span
                v-if="activeVersionLabel"
                class="ai-blueprint-workbench-form-panel__version-tag"
              >
                {{ activeVersionLabel }}
              </span>
              <span
                v-if="activeStatusTag"
                :class="['ai-blueprint-workbench-form-panel__status', activeStatusTagTone && `is-${activeStatusTagTone}`]"
              >
                {{ activeStatusTag }}
              </span>
            </div>
            <p
              v-if="activeSummary"
              class="ai-blueprint-workbench-form-panel__summary"
            >
              {{ activeSummary }}
            </p>

            <div
              v-if="showDetailTabs"
              class="ai-blueprint-workbench-form-panel__detail-tabs"
              role="tablist"
              :aria-label="$t('nocodeEditorAiBlueprintWorkbenchFormPanel.formDetailViewSwitch')"
            >
              <button
                v-for="tab in detailTabs"
                :key="tab.key"
                type="button"
                class="ai-blueprint-workbench-form-panel__detail-tab"
                :class="{ 'is-active': detailTabKey === tab.key }"
                :aria-selected="detailTabKey === tab.key"
                @click="detailTabKey = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>

          <div
            v-if="displayHeroMetaPills.length"
            class="ai-blueprint-workbench-form-panel__hero-stats"
          >
            <span
              v-for="pill in displayHeroMetaPills"
              :key="pill"
              class="ai-blueprint-workbench-form-panel__hero-stat"
            >
              {{ pill }}
            </span>
          </div>
        </div>
      </section>

      <div :class="layoutClass">
        <main class="ai-blueprint-workbench-form-panel__content">
          <nocode-editor-ai-draft-issue-action-list
            v-if="detailTabKey === 'form' && (draftIssueCount || draftIssueResolved)"
            class="ai-blueprint-workbench-form-panel__draft-issues"
            compact
            :issues="draftActionIssues"
            :summary="draftPersistenceState?.summary"
            :resolved="draftIssueResolved"
            @locate="emit('locate-draft-issue', $event)"
          />
          <nocode-editor-ai-blueprint-detail-sections
            v-if="detailTabKey === 'form'"
            :forms="forms"
            :formula-apply-forms="card.item.applyResult?.forms || []"
            :selected-form-key="card.formKey"
            anchor-prefix="blueprint-workbench-tab-form"
            :focus-selected-only="true"
          />
          <nocode-editor-ai-flow-plan-preview
            v-else-if="matchedFlowArtifactBlock"
            class="ai-blueprint-workbench-form-panel__flow-preview"
            :block="matchedFlowArtifactBlock"
            mode="embedded"
            :embedded-title="$t('nocodeEditorAiBlueprintWorkbenchFormPanel.currentFormFlowBlueprint')"
            :can-apply="false"
            :active-scope-key="activeFlowScopeKey"
            @update:active-scope-key="handleUpdateFlowScopeKey"
          />
        </main>

        <aside class="ai-blueprint-workbench-form-panel__side">
          <div class="ai-blueprint-workbench-form-panel__decision-panel-shell">
            <nocode-editor-ai-flow-decision-panel
              v-if="isFlowDetailActive && matchedFlowArtifactBlock"
              :block="matchedFlowArtifactBlock"
              :history-blocks="matchedFlowHistoryBlocks"
              :can-apply="canApplyCurrentFlow"
              :applying="applyingCurrentFlow"
              :response-drafts="resolveFlowConfirmationResponseDrafts(matchedFlowArtifactBlock)"
              :active-input-question-ids="resolveFlowActiveConfirmationInputQuestionIds(matchedFlowArtifactBlock)"
              :inline-note-question-ids="resolveFlowInlineConfirmationNoteQuestionIds(matchedFlowArtifactBlock)"
              :submitting-confirmation="submittingConfirmation"
              :active-scope-key="activeFlowScopeKey"
              @apply-flow="handleApplyFlow"
              @continue-flow-defaults="handleContinueFlowDefaults"
              @select-confirmation-option="handleSelectFlowConfirmationOption"
              @toggle-note-input="handleToggleFlowNoteInput"
              @update-note="handleUpdateFlowNote"
              @submit-confirmation-responses="handleSubmitFlowConfirmationResponses"
              @open-generated-page="handleOpenGeneratedFlowPage"
            />

            <template v-else>
              <nocode-editor-ai-blueprint-decision-panel
                :block="blueprintBlock"
                :can-apply="canReviewBlueprintActions"
                :can-continue="canReviewBlueprintActions"
                :applying="applying"
                :apply-disabled="reviewApplyDisabled"
              :response-drafts="responseDrafts"
                :active-input-question-ids="activeInputQuestionIds"
                :inline-note-question-ids="inlineNoteQuestionIds"
                :submitting-confirmation="submittingConfirmation"
                :draft-persistence-state="draftPersistenceState"
                :show-draft-issue-list="false"
                :show-generated-open-action="true"
                @apply-blueprint="handleApply"
                @continue-blueprint-adjustment="handleContinue"
                @select-confirmation-option="handleSelectConfirmationOption"
                @toggle-note-input="handleToggleNoteInput"
                @update-note="handleUpdateNote"
                @submit-confirmation-responses="handleSubmitConfirmationResponses"
                @open-generated-page="handleOpenGeneratedPage"
              />

              <section
                v-if="generatedHistoryEntries.length"
                class="ai-blueprint-workbench-form-panel__generated-history-card"
              >
                <div class="ai-blueprint-workbench-form-panel__generated-history-head">
                  <h3 class="ai-blueprint-workbench-form-panel__generated-history-title">{{ $t('nocodeEditorAiBlueprintWorkbenchFormPanel.recentGenerationRecords') }}</h3>
                  <span class="ai-blueprint-workbench-form-panel__generated-history-count">{{ $t('nocodeEditorAiBlueprintWorkbenchFormPanel.generatedLabel') }}{{ generatedHistoryCount }}
                  </span>
                </div>

                <div class="ai-blueprint-workbench-form-panel__generated-history-divider" />

                <div class="ai-blueprint-workbench-form-panel__generated-history-list">
                  <article
                    v-for="entry in generatedHistoryEntries"
                    :key="entry.key"
                    class="ai-blueprint-workbench-form-panel__generated-history-item"
                  >
                    <div class="ai-blueprint-workbench-form-panel__generated-history-item-top">
                      <div class="ai-blueprint-workbench-form-panel__generated-history-item-title">
                        {{ entry.title }}
                      </div>
                      <div class="ai-blueprint-workbench-form-panel__generated-history-item-time">
                        {{ entry.timeText }}
                      </div>
                    </div>

                    <div
                      v-if="entry.summary"
                      class="ai-blueprint-workbench-form-panel__generated-history-item-summary"
                    >
                      {{ entry.summary }}
                    </div>
                  </article>
                </div>
              </section>
            </template>
          </div>
        </aside>
      </div>
    </template>

    <div v-else class="ai-blueprint-workbench-form-panel__empty">{{ $t('nocodeEditorAiBlueprintWorkbenchFormPanel.selectFormTabTip') }}</div>
  </section>
</template>

<script setup lang="ts">
import i18next from 'i18next'
import { computed, ref, watch, type PropType } from 'vue'
import type { AiAssistantArtifactBlock, AiAssistantFlowPlanArtifactBlock } from '@common/types/ai'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import type { NocodeEditorFlowPlanTriggerBranch } from '@common/utils/nocodeEditorFlowPlan'
import {
  countNocodeEditorFlowPlanBranches,
  countNocodeEditorFlowPlanTotalNodes,
  normalizeNocodeEditorFlowPlan,
} from '@common/utils/nocodeEditorFlowPlan'
import {
  isBlueprintAppliedDraftPhase,
  isBlueprintAppliedPhase,
  isBlueprintStagedPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import {
  type AiArtifactConfirmationQuestion,
  resolveAiArtifactPendingQuestionCount,
  resolveAiArtifactTitle,
  resolveAiArtifactVersionLabel,
  resolveBlueprintStatusTag,
  resolveBlueprintStatusTagTone,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import { resolveBlueprintFormFlowArtifactContext } from '../blueprintFlowArtifactMatcher'
import {
  getDraftPersistenceActionIssueCount,
  isDraftPersistenceStateResolved,
} from '../draftIssueActionList'
import { resolveGeneratedBlueprintOpenTarget } from '../blueprintWorkbenchActions'
import type {
  BlueprintWorkbenchCard,
  BlueprintWorkbenchHistoryEntry,
  BlueprintWorkbenchMode,
} from '../blueprintWorkbenchViewModel'
import { buildBlueprintArtifactVersionFromParts } from '../blueprintArtifactIdentity'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiDraftActionIssue,
  NocodeEditorAiGeneratedBlueprintPageTarget,
} from '../types'
import type { NocodeEditorAiConfirmationResponseDraftMap } from './confirmationInteraction'
import NocodeEditorAiBlueprintDecisionPanel from './NocodeEditorAiBlueprintDecisionPanel.vue'
import NocodeEditorAiBlueprintDetailSections from './NocodeEditorAiBlueprintDetailSections.vue'
import NocodeEditorAiDraftIssueActionList from './NocodeEditorAiDraftIssueActionList.vue'
import NocodeEditorAiFlowDecisionPanel from './NocodeEditorAiFlowDecisionPanel.vue'
import NocodeEditorAiFlowPlanPreview from './NocodeEditorAiFlowPlanPreview.vue'

const props = defineProps({
  card: {
    type: Object as PropType<BlueprintWorkbenchCard | null>,
    default: null,
  },
  mode: {
    type: String as PropType<BlueprintWorkbenchMode>,
    required: true,
  },
  applyingId: {
    type: String,
    default: '',
  },
  historyEntries: {
    type: Array as PropType<BlueprintWorkbenchHistoryEntry[]>,
    default: () => [],
  },
  flowArtifactBlocks: {
    type: Array as PropType<NocodeEditorAiArtifactBlock[]>,
    default: () => [],
  },
  allowReviewActions: {
    type: Boolean,
    default: true,
  },
  responseDrafts: {
    type: Object as PropType<NocodeEditorAiConfirmationResponseDraftMap>,
    default: () => ({}),
  },
  activeInputQuestionIds: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  inlineNoteQuestionIds: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  submittingConfirmation: {
    type: Boolean,
    default: false,
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
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'apply', item: BlueprintWorkbenchCard['item']): void
  (event: 'continue', item: BlueprintWorkbenchCard['item']): void
  (event: 'select-confirmation-option', payload: {
    block: AiAssistantArtifactBlock
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }): void
  (event: 'toggle-note-input', payload: {
    item: BlueprintWorkbenchCard['item']
    block: AiAssistantArtifactBlock
    question: AiArtifactConfirmationQuestion
  }): void
  (event: 'update-note', payload: {
    item: BlueprintWorkbenchCard['item']
    block: AiAssistantArtifactBlock
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
  (event: 'submit-confirmation-responses', payload: {
    item: BlueprintWorkbenchCard['item']
    block: AiAssistantArtifactBlock
  }): void
  (event: 'apply-flow', block: NocodeEditorAiArtifactBlock): void
  (event: 'continue-flow-defaults', block: NocodeEditorAiArtifactBlock): void
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
  (event: 'open-generated-page', payload: NocodeEditorAiGeneratedBlueprintPageTarget): void
  (event: 'locate-draft-issue', issue: NocodeEditorAiDraftActionIssue): void
}>()

const detailTabKey = ref<'form' | 'flow'>('form')
const activeFlowScopeKey = ref('')

const normalizeText = (value: unknown) => String(value || '').trim()
const asArray = <T = unknown,>(value: unknown) => (Array.isArray(value) ? value as T[] : [])

const countFields = (fields: NocodeEditorAiAppBlueprintField[] | undefined): number => {
  const source = Array.isArray(fields) ? fields : []
  return source.reduce((total, field) => total + 1 + countFields(field.children), 0)
}

const blueprintBlock = computed<AiAssistantArtifactBlock | null>(() => (
  !props.card
    ? null
    : {
      type: 'artifact',
      kind: 'blueprint',
      status: 'ready',
      version: buildBlueprintArtifactVersionFromParts(props.card.item),
      displayRevision: props.card.item.displayRevision,
      displayVersionLabel: props.card.item.displayVersionLabel,
      revision: props.card.item.revision,
      stagedAt: props.card.item.stagedAt,
      phase: props.card.item.phase || undefined,
      title: props.card.item.blueprint.title || props.card.title || i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.blueprintDraft'),
      summary: props.card.item.blueprint.summary || props.card.summary,
      blueprint: props.card.item.blueprint,
      confirmation: (
        props.card.item.blueprint as (NocodeEditorAiAppBlueprint & {
          confirmation?: AiAssistantFlowPlanArtifactBlock['confirmation']
        })
      ).confirmation || undefined,
      applyResult: props.card.item.applyResult || null,
      draftPersistenceState: props.card.item.draftPersistenceState || null,
    }
))

const canReviewBlueprintActions = computed(() => (
  props.allowReviewActions
  && props.mode === 'review'
  && Boolean(props.card)
  && isBlueprintStagedPhase(props.card.item.phase)
))

const applying = computed(() => Boolean(
  props.card
  && isBlueprintStagedPhase(props.card.item.phase)
  && props.applyingId === props.card.item.id,
))

const reviewApplyDisabled = computed(() => Boolean(
  props.card
  && isBlueprintStagedPhase(props.card.item.phase)
  && props.applyingId,
))

const forms = computed<NocodeEditorAiAppBlueprintForm[]>(() => (
  props.card?.item.blueprint.forms || []
))

const flowArtifactContext = computed(() => resolveBlueprintFormFlowArtifactContext({
  item: props.card?.item,
  form: props.card?.form,
  flowArtifactBlocks: props.flowArtifactBlocks,
}))

const matchedFlowArtifact = computed(() => flowArtifactContext.value.activeFlowArtifact)
const matchedFlowArtifactBlock = computed<NocodeEditorAiArtifactBlock | null>(() => (
  matchedFlowArtifact.value?.block || null
))
const matchedFlowHistoryBlocks = computed<NocodeEditorAiArtifactBlock[]>(() => (
  flowArtifactContext.value.flowHistoryArtifacts.map(item => item.block)
))

const detailTabs = computed(() => (
  matchedFlowArtifactBlock.value
    ? [
      { key: 'form' as const, label: i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.formTab') },
      { key: 'flow' as const, label: i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.flowTab') },
    ]
    : [{ key: 'form' as const, label: i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.formTab') }]
))

const showDetailTabs = computed(() => detailTabs.value.length > 1)
const isFlowDetailActive = computed(() => detailTabKey.value === 'flow' && Boolean(matchedFlowArtifactBlock.value))

const blueprintTitle = computed(() => (
  String(props.card?.title || props.card?.form.tableName || i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.formBlueprint')).trim()
  || i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.formBlueprint')
))

const blueprintSummary = computed(() => (
  String(props.card?.summary || props.card?.item.blueprint.summary || '').trim()
))

const blueprintVersionLabel = computed(() => resolveAiArtifactVersionLabel(blueprintBlock.value))
const draftPersistenceState = computed(() => props.card?.item.draftPersistenceState || null)
const draftActionIssues = computed(() => draftPersistenceState.value?.actionIssues || [])
const draftIssueCount = computed(() => getDraftPersistenceActionIssueCount(draftPersistenceState.value))
const draftIssueResolved = computed(() => isDraftPersistenceStateResolved(draftPersistenceState.value))
const blueprintStatusTag = computed(() => (
  draftIssueCount.value > 0
    ? i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.draftIncomplete')
    : resolveBlueprintStatusTag(blueprintBlock.value, { applying: applying.value })
))
const blueprintStatusTagTone = computed(() => (
  draftIssueCount.value > 0
    ? 'pending'
    : resolveBlueprintStatusTagTone(blueprintStatusTag.value)
))

const blueprintPendingQuestionCount = computed(() => resolveAiArtifactPendingQuestionCount(blueprintBlock.value))
const currentFlowPendingQuestionCount = computed(() => resolveAiArtifactPendingQuestionCount(matchedFlowArtifactBlock.value))

const currentFormLabel = computed(() => (
  props.card
    ? i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.currentFormLabel', { name: props.card.form.tableName })
    : ''
))
const currentFieldCount = computed(() => (
  props.card ? countFields(props.card.form.fields) : 0
))
const formCount = computed(() => forms.value.length)
const totalFieldCount = computed(() => (
  forms.value.reduce((total, form) => total + countFields(form.fields), 0)
))

const flowPlan = computed(() => normalizeNocodeEditorFlowPlan(matchedFlowArtifactBlock.value?.flowPlan))
const flowTriggerBranches = computed(() => asArray<NocodeEditorFlowPlanTriggerBranch>(flowPlan.value?.triggerBranches))
const flowTriggerBranchCount = computed(() => flowTriggerBranches.value.length)
const flowTotalNodeCount = computed(() => countNocodeEditorFlowPlanTotalNodes(flowTriggerBranches.value))
const flowBranchCount = computed(() => (
  flowTriggerBranches.value.reduce((total, triggerBranch) => (
    total + countNocodeEditorFlowPlanBranches(triggerBranch.nodes || [])
  ), 0)
))
const canApplyCurrentFlow = computed(() => (
  matchedFlowArtifactBlock.value
    ? Boolean(props.canApplyFlowArtifact?.(matchedFlowArtifactBlock.value))
    : false
))
const applyingCurrentFlow = computed(() => (
  matchedFlowArtifactBlock.value
    ? Boolean(props.isApplyingFlowArtifact?.(matchedFlowArtifactBlock.value))
    : false
))

const resolveFlowSummary = () => {
  const block = matchedFlowArtifactBlock.value
  if (!block) {
    return ''
  }

  const summary = normalizeText(block.summary || block.flowPlan?.summary)
  if (summary) {
    return summary
  }

  if (block.flowApplyResult?.summary) {
    const applySummary = block.flowApplyResult.summary
    return i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.flowGeneratedSummary', {
      triggerBranchCount: Number(applySummary.triggerBranchCount || 0),
      totalNodeCount: Number(applySummary.totalNodeCount || 0),
      branchCount: Number(applySummary.branchCount || 0),
    })
  }

  if (currentFlowPendingQuestionCount.value > 0) {
    return i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.flowPendingQuestionsSummary', {
      count: currentFlowPendingQuestionCount.value,
    })
  }

  return i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.flowReadySummary')
}

const flowStatusKey = computed(() => {
  const block = matchedFlowArtifactBlock.value
  if (!block) {
    return ''
  }

  if (applyingCurrentFlow.value) {
    return 'applying'
  }

  if (block.flowApplyResult) {
    return 'applied'
  }

  if (currentFlowPendingQuestionCount.value > 0) {
    return 'pending'
  }

  if (canApplyCurrentFlow.value) {
    return 'ready'
  }

  return 'confirmed'
})

const flowStatusTag = computed(() => {
  if (flowStatusKey.value === 'applying') return i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.generating')
  if (flowStatusKey.value === 'applied') return i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.generated')
  if (flowStatusKey.value === 'pending') return i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.pendingConfirmation')
  if (flowStatusKey.value === 'ready') return i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.pendingGeneration')
  if (flowStatusKey.value === 'confirmed') return i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.confirmed')
  return ''
})

const flowStatusTagTone = computed(() => {
  if (flowStatusKey.value === 'pending') return 'pending'
  if (flowStatusKey.value === 'ready') return 'ready'
  if (flowStatusKey.value === 'applying') return 'applying'
  if (flowStatusKey.value === 'applied') return 'applied'
  if (flowStatusKey.value === 'confirmed') return 'ready'
  return ''
})

const heroMetaPills = computed(() => {
  if (!props.card) {
    return []
  }

  if (isBlueprintAppliedDraftPhase(props.card.item.phase) || draftIssueCount.value > 0) {
    return [
      currentFormLabel.value,
      draftIssueCount.value > 0
        ? i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.draftIssueCount', { count: draftIssueCount.value })
        : i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.draftUnsaved'),
      draftIssueResolved.value
        ? i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.draftIssuesCompleted')
        : i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.notSaved'),
    ]
  }

  if (isBlueprintAppliedPhase(props.card.item.phase) && props.card.item.applyResult) {
    const result = props.card.item.applyResult
    return [
      currentFormLabel.value,
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.fieldCount', { count: currentFieldCount.value }),
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.formCreateReuseCount', {
        created: result.summary.formsCreated,
        reused: result.summary.formsReused,
      }),
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.fieldUpdateCount', { count: result.summary.fieldsUpdated }),
    ]
  }

  if (blueprintPendingQuestionCount.value > 0) {
    return [
      currentFormLabel.value,
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.fieldCount', { count: currentFieldCount.value }),
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.pendingQuestionCount', { count: blueprintPendingQuestionCount.value }),
      formCount.value > 1
        ? i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.formCount', { count: formCount.value })
        : i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.singleFormBlueprint'),
    ]
  }

  return [
    currentFormLabel.value,
    i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.fieldCount', { count: currentFieldCount.value }),
    formCount.value > 1
      ? i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.formAndTotalFieldCount', {
        formCount: formCount.value,
        fieldCount: totalFieldCount.value,
      })
      : i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.singleFormBlueprintDetails'),
    canReviewBlueprintActions.value
      ? i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.readyToGenerate')
      : i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.viewDetails'),
  ]
})

const flowHeroMetaPills = computed(() => {
  if (!matchedFlowArtifactBlock.value) {
    return []
  }

  if (matchedFlowArtifactBlock.value.flowApplyResult) {
    return [
      currentFormLabel.value,
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.triggerBranchCount', { count: flowTriggerBranchCount.value }),
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.branchCount', { count: flowBranchCount.value }),
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.generatedFromBlueprint'),
    ]
  }

  if (currentFlowPendingQuestionCount.value > 0) {
    return [
      currentFormLabel.value,
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.triggerBranchCount', { count: flowTriggerBranchCount.value }),
      i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.pendingQuestionCount', { count: currentFlowPendingQuestionCount.value }),
      flowBranchCount.value > 0
        ? i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.branchCount', { count: flowBranchCount.value })
        : i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.flowPendingConfirmation'),
    ]
  }

  return [
    currentFormLabel.value,
    i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.triggerBranchCount', { count: flowTriggerBranchCount.value }),
    i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.totalNodeCount', { count: flowTotalNodeCount.value }),
    canApplyCurrentFlow.value
      ? i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.readyToGenerateFromBlueprint')
      : i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.flowBlueprintDetails'),
  ]
})

const activeTitle = computed(() => {
  if (isFlowDetailActive.value) {
    return normalizeText(resolveAiArtifactTitle(matchedFlowArtifactBlock.value || undefined))
      || normalizeText(flowPlan.value?.title)
      || i18next.t('nocodeEditorAiBlueprintWorkbenchFormPanel.currentFormFlowBlueprint')
  }

  return blueprintTitle.value
})

const activeSummary = computed(() => (
  isFlowDetailActive.value ? resolveFlowSummary() : blueprintSummary.value
))

const activeVersionLabel = computed(() => (
  isFlowDetailActive.value
    ? resolveAiArtifactVersionLabel(matchedFlowArtifactBlock.value)
    : blueprintVersionLabel.value
))

const activeStatusTag = computed(() => (
  isFlowDetailActive.value ? flowStatusTag.value : blueprintStatusTag.value
))

const activeStatusTagTone = computed(() => (
  isFlowDetailActive.value ? flowStatusTagTone.value : blueprintStatusTagTone.value
))

const displayHeroMetaPills = computed(() => (
  isFlowDetailActive.value ? flowHeroMetaPills.value : heroMetaPills.value
))

const layoutClass = computed(() => (
  'ai-blueprint-workbench-form-panel__layout ai-blueprint-workbench-form-panel__layout--without-rail'
))

const generatedHistoryEntries = computed<BlueprintWorkbenchHistoryEntry[]>(() => {
  if (props.mode !== 'generated' || !props.card) {
    return []
  }

  return props.historyEntries.slice(0, 3)
})

const generatedHistoryCount = computed(() => generatedHistoryEntries.value.length)

watch(() => props.card?.key || '', () => {
  detailTabKey.value = 'form'
  activeFlowScopeKey.value = ''
}, {
  immediate: true,
})

watch(matchedFlowArtifact, (value) => {
  if (!value && detailTabKey.value === 'flow') {
    detailTabKey.value = 'form'
  }
  activeFlowScopeKey.value = ''
})

const handleUpdateFlowScopeKey = (value: string) => {
  activeFlowScopeKey.value = value
}

const handleApply = () => {
  if (props.card && !reviewApplyDisabled.value) {
    emit('apply', props.card.item)
  }
}

const handleContinue = () => {
  if (props.card) {
    emit('continue', props.card.item)
  }
}

const handleSelectConfirmationOption = (payload: {
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  const block = blueprintBlock.value
  if (!block) {
    return
  }

  emit('select-confirmation-option', {
    block,
    question: payload.question,
    option: payload.option,
  })
}

const handleToggleNoteInput = (question: AiArtifactConfirmationQuestion) => {
  const block = blueprintBlock.value
  if (!block) {
    return
  }

  emit('toggle-note-input', {
    item: props.card.item,
    block,
    question,
  })
}

const handleUpdateNote = (payload: {
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  const block = blueprintBlock.value
  if (!block) {
    return
  }

  emit('update-note', {
    item: props.card.item,
    block,
    question: payload.question,
    note: payload.note,
  })
}

const handleSubmitConfirmationResponses = () => {
  const block = blueprintBlock.value
  if (!block) {
    return
  }

  if (!props.card) {
    return
  }

  emit('submit-confirmation-responses', {
    item: props.card.item,
    block,
  })
}

const handleOpenGeneratedPage = () => {
  if (!props.card) {
    return
  }

  const openTarget = resolveGeneratedBlueprintOpenTarget({
    item: props.card.item,
    formKey: props.card.form.formKey,
    tableName: props.card.form.tableName,
  })

  emit('open-generated-page', {
    item: props.card.item,
    formKey: openTarget?.tableId || props.card.form.formKey,
    tableName: openTarget?.tableName || props.card.form.tableName,
  })
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

const handleApplyFlow = () => {
  if (matchedFlowArtifactBlock.value) {
    emit('apply-flow', matchedFlowArtifactBlock.value)
  }
}

const handleContinueFlowDefaults = () => {
  if (matchedFlowArtifactBlock.value) {
    emit('continue-flow-defaults', matchedFlowArtifactBlock.value)
  }
}

const handleOpenGeneratedFlowPage = () => {
  if (!props.card) {
    return
  }

  const targetFormId = normalizeText(
    matchedFlowArtifactBlock.value?.flowPlan?.target?.formId,
  ) || props.card.form.formKey
  const targetTableName = normalizeText(
    matchedFlowArtifactBlock.value?.flowPlan?.target?.formName,
  ) || props.card.form.tableName

  emit('open-generated-page', {
    item: props.card.item,
    formKey: targetFormId,
    tableName: targetTableName,
    tab: 'process-setting',
  })
}

const handleSelectFlowConfirmationOption = (payload: {
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  if (!matchedFlowArtifactBlock.value) {
    return
  }

  emit('select-confirmation-option', {
    block: matchedFlowArtifactBlock.value,
    question: payload.question,
    option: payload.option,
  })
}

const handleToggleFlowNoteInput = (question: AiArtifactConfirmationQuestion) => {
  if (!matchedFlowArtifactBlock.value) {
    return
  }

  emit('toggle-flow-note-input', {
    block: matchedFlowArtifactBlock.value,
    question,
  })
}

const handleUpdateFlowNote = (payload: {
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  if (!matchedFlowArtifactBlock.value) {
    return
  }

  emit('update-flow-note', {
    block: matchedFlowArtifactBlock.value,
    question: payload.question,
    note: payload.note,
  })
}

const handleSubmitFlowConfirmationResponses = () => {
  if (matchedFlowArtifactBlock.value) {
    emit('submit-flow-confirmation-responses', matchedFlowArtifactBlock.value)
  }
}
</script>

<style scoped lang="scss">
.ai-blueprint-workbench-form-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.ai-blueprint-workbench-form-panel__hero {
  padding: 0 0 12px;
  border-radius: 0;
  border: 0;
  border-bottom: 1px solid var(--blueprint-border);
  background: transparent;
  box-shadow: none;
}

.ai-blueprint-workbench-form-panel__hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-blueprint-workbench-form-panel__hero-main {
  min-width: 0;
  flex: 1;
}

.ai-blueprint-workbench-form-panel__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-blueprint-workbench-form-panel__title {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-workbench-form-panel__status,
.ai-blueprint-workbench-form-panel__version-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  white-space: nowrap;
}

.ai-blueprint-workbench-form-panel__status {
  padding: 0 6px;
  color: var(--blueprint-brand);
  background: #eef6ff;
  font-size: 12px;
  line-height: 20px;
  font-weight: 600;
}

.ai-blueprint-workbench-form-panel__status.is-pending {
  background: #eef6ff;
  color: var(--blueprint-warning);
}

.ai-blueprint-workbench-form-panel__status.is-ready {
  background: #eef6ff;
  color: var(--blueprint-brand);
}

.ai-blueprint-workbench-form-panel__status.is-applying {
  background: #f1f3ff;
  color: #4857d1;
}

.ai-blueprint-workbench-form-panel__status.is-applied {
  background: #eff8e8;
  color: var(--blueprint-success);
}

.ai-blueprint-workbench-form-panel__version-tag {
  padding: 0 6px;
  background: #eef6ff;
  color: var(--blueprint-text-secondary);
  font-size: 12px;
  line-height: 20px;
  font-weight: 600;
}

.ai-blueprint-workbench-form-panel__summary {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-form-panel__detail-tabs {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 4px;
  border-radius: 999px;
  background: #f4f7fb;
  border: 1px solid var(--blueprint-border);
}

.ai-blueprint-workbench-form-panel__detail-tab {
  min-width: 64px;
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--blueprint-text-secondary);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.ai-blueprint-workbench-form-panel__detail-tab.is-active {
  background: #ffffff;
  color: var(--blueprint-brand);
  box-shadow: 0 4px 10px rgba(8, 115, 255, 0.12);
}

.ai-blueprint-workbench-form-panel__hero-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.ai-blueprint-workbench-form-panel__hero-stat {
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-tertiary);
  white-space: nowrap;
}

.ai-blueprint-workbench-form-panel__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  min-height: 0;
}

.ai-blueprint-workbench-form-panel__layout--without-rail {
  grid-template-columns: minmax(0, 1fr) 300px;
}

.ai-blueprint-workbench-form-panel__content,
.ai-blueprint-workbench-form-panel__side {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.ai-blueprint-workbench-form-panel__content {
  min-width: 0;
}

.ai-blueprint-workbench-form-panel__flow-preview {
  min-width: 0;
}

.ai-blueprint-workbench-form-panel__draft-issues {
  margin-bottom: 2px;
}

.ai-blueprint-workbench-form-panel__decision-panel-shell {
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 300px;
}

.ai-blueprint-workbench-form-panel__generated-history-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--blueprint-border);
  background: var(--blueprint-surface);
}

.ai-blueprint-workbench-form-panel__generated-history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-blueprint-workbench-form-panel__generated-history-title {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-workbench-form-panel__generated-history-count {
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-tertiary);
}

.ai-blueprint-workbench-form-panel__generated-history-divider {
  width: 100%;
  height: 1px;
  background: var(--blueprint-border);
}

.ai-blueprint-workbench-form-panel__generated-history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-blueprint-workbench-form-panel__generated-history-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-blueprint-workbench-form-panel__generated-history-item-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-blueprint-workbench-form-panel__generated-history-item-title {
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-form-panel__generated-history-item-time,
.ai-blueprint-workbench-form-panel__generated-history-item-summary {
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-tertiary);
}

.ai-blueprint-workbench-form-panel__empty {
  padding: 16px;
  margin: 0;
  border-radius: 8px;
  border: 1px dashed var(--blueprint-border);
  background: var(--blueprint-surface-muted);
  font-size: 13px;
  line-height: 1.8;
  color: var(--blueprint-text-secondary);
}

@media (max-width: 1500px) {
  .ai-blueprint-workbench-form-panel__layout,
  .ai-blueprint-workbench-form-panel__layout--without-rail {
    grid-template-columns: 1fr;
  }

  .ai-blueprint-workbench-form-panel__hero-top {
    flex-direction: column;
  }

  .ai-blueprint-workbench-form-panel__hero-stats {
    justify-content: flex-start;
  }

  .ai-blueprint-workbench-form-panel__title {
    font-size: 18px;
  }
}
</style>
