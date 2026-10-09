<template>
  <section v-if="block?.flowPlan" class="ai-flow-decision-panel">
    <div
      :class="[
        'ai-flow-decision-panel__summary-block',
        {
          'is-applied': isAppliedState,
        },
      ]"
    >
      <div class="ai-flow-decision-panel__summary-copy">
        <h3 class="ai-flow-decision-panel__panel-title">{{ $t('nocodeEditorAiFlowDecisionPanel.suggestedNextSteps') }}</h3>
      </div>

      <div
        v-if="(showActions && actionButtons.length) || showOpenGeneratedButton"
        :class="['ai-flow-decision-panel__actions', { 'is-single': visibleActionCount <= 1 }]"
      >
        <el-button
          v-for="action in actionButtons"
          :key="action.key"
          :type="action.primary ? 'primary' : undefined"
          :plain="!action.primary"
          size="large"
          :class="[
            'ai-flow-decision-panel__action-button',
            {
              'is-progress': action.primary && action.disabled,
              'is-secondary': !action.primary,
            },
          ]"
          :loading="action.loading"
          :disabled="action.disabled"
          @click="action.onClick"
        >
          {{ action.label }}
        </el-button>
        <el-button
          v-if="showOpenGeneratedButton"
          plain
          size="large"
          class="ai-flow-decision-panel__action-button is-secondary"
          @click="emit('open-generated-page')"
        >{{ $t('nocodeEditorAiFlowDecisionPanel.viewGeneratedWorkflow') }}</el-button>
      </div>

      <div
        v-if="actionCopyItems.length"
        class="ai-flow-decision-panel__action-copy-card"
      >
        <ul class="ai-flow-decision-panel__action-copy ai-flow-decision-panel__action-copy--inline">
          <li
            v-for="item in actionCopyItems"
            :key="item.key"
            class="ai-flow-decision-panel__action-copy-item"
          >
            {{ item.text }}
          </li>
        </ul>
      </div>
    </div>

    <div v-if="resultItems.length" class="ai-flow-decision-panel__results">
      <div class="ai-flow-decision-panel__question-head">
        <h3 class="ai-flow-decision-panel__panel-title">{{ resultSectionTitle }}</h3>
      </div>
      <div class="ai-flow-decision-panel__result-list">
        <div
          v-for="item in resultItems"
          :key="item.label"
          class="ai-flow-decision-panel__result-item"
        >
          <span class="ai-flow-decision-panel__result-label">{{ item.label }}</span>
          <span class="ai-flow-decision-panel__result-value">{{ item.value }}</span>
        </div>
      </div>
    </div>

    <div v-if="displayQuestions.length || questionEmptyText" class="ai-flow-decision-panel__questions">
      <div class="ai-flow-decision-panel__question-head">
        <h3 class="ai-flow-decision-panel__panel-title">{{ questionSectionTitle }}</h3>
        <span class="ai-flow-decision-panel__question-badge">{{ questionBadgeText }}</span>
      </div>

      <nocode-editor-ai-confirmation-question-list
        v-if="displayQuestions.length"
        class="ai-flow-decision-panel__confirmation-list"
        :questions="displayQuestions"
        :response-drafts="responseDrafts"
        :active-input-question-ids="activeInputQuestionIds"
        :inline-note-question-ids="inlineNoteQuestionIds"
        :show-inline-note-input="!isQuestionReadonly"
        :readonly="isQuestionReadonly"
        :readonly-question-ids="readonlyQuestionIds"
        compact
        :show-supplement-action="!isQuestionReadonly"
        @select-option="handleSelectConfirmationOption"
        @toggle-note-input="handleToggleInlineNoteInput"
        @update-note="handleUpdateInlineNote"
      />

      <p v-if="questionSectionHint" class="ai-flow-decision-panel__section-hint">
        {{ questionSectionHint }}
      </p>
      <div v-else-if="questionEmptyText" class="ai-flow-decision-panel__action-note">
        {{ questionEmptyText }}
      </div>
    </div>

    <section
      v-if="historyEntries.length"
      class="ai-flow-decision-panel__history-card"
    >
      <div class="ai-flow-decision-panel__history-head">
        <h3 class="ai-flow-decision-panel__panel-title">{{ $t('nocodeEditorAiFlowDecisionPanel.recentWorkflowRecords') }}</h3>
        <span class="ai-flow-decision-panel__history-count">
          {{ historyEntries.length }}{{ $t('nocodeEditorAiFlowDecisionPanel.items') }}</span>
      </div>

      <div class="ai-flow-decision-panel__history-divider" />

      <div class="ai-flow-decision-panel__history-list">
        <article
          v-for="entry in historyEntries"
          :key="entry.key"
          :class="[
            'ai-flow-decision-panel__history-item',
            { 'is-active': entry.isActive },
          ]"
        >
          <div class="ai-flow-decision-panel__history-item-top">
            <div class="ai-flow-decision-panel__history-item-main">
              <div class="ai-flow-decision-panel__history-item-title-row">
                <div class="ai-flow-decision-panel__history-item-title">{{ entry.title }}</div>
                <span
                  v-if="entry.versionLabel"
                  class="ai-flow-decision-panel__history-inline-tag"
                >
                  {{ entry.versionLabel }}
                </span>
                <span
                  :class="[
                    'ai-flow-decision-panel__history-inline-tag',
                    'is-status',
                    `is-${entry.statusTone}`,
                  ]"
                >
                  {{ entry.statusLabel }}
                </span>
              </div>
              <div
                v-if="entry.summary"
                class="ai-flow-decision-panel__history-item-summary"
              >
                {{ entry.summary }}
              </div>
            </div>

            <div class="ai-flow-decision-panel__history-item-time">
              {{ entry.timeText }}
            </div>
          </div>
        </article>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import i18next from 'i18next'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import {
  countNocodeEditorFlowPlanBranches,
  countNocodeEditorFlowPlanNodes,
  countNocodeEditorFlowPlanTotalNodes,
  normalizeNocodeEditorFlowPlan,
  type NocodeEditorFlowPlanTriggerBranch,
} from '@common/utils/nocodeEditorFlowPlan'
import {
  type AiArtifactConfirmationQuestion,
  resolveAiArtifactCompletionSummary,
  resolveAiArtifactConfirmationStatus,
  resolveAiArtifactQuestions,
  resolveAiArtifactResultSummary,
  resolveAiArtifactVersionLabel,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import type { NocodeEditorAiArtifactBlock } from '../types'
import {
  countUnansweredConfirmationQuestions,
  type NocodeEditorAiConfirmationResponseDraftMap,
} from './confirmationInteraction'
import NocodeEditorAiConfirmationQuestionList from './NocodeEditorAiConfirmationQuestionList.vue'

type FlowActionButton = {
  key: 'apply' | 'continue-defaults' | 'submit-confirmation'
  label: string
  primary: boolean
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}

type FlowHistoryEntry = {
  key: string
  title: string
  summary: string
  versionLabel: string
  statusLabel: string
  statusTone: 'pending' | 'ready' | 'applying' | 'applied'
  timeText: string
  isActive: boolean
}

type FlowScopeKey = 'overview' | `trigger-branch:${string}`

type FlowTriggerBranchScope = {
  key: FlowScopeKey
  branchKey: string
  label: string
  totalNodeCount: number
  branchCount: number
}

const props = defineProps({
  block: {
    type: Object as PropType<NocodeEditorAiArtifactBlock | null>,
    default: null,
  },
  historyBlocks: {
    type: Array as PropType<NocodeEditorAiArtifactBlock[]>,
    default: () => [],
  },
  canApply: {
    type: Boolean,
    default: false,
  },
  applying: {
    type: Boolean,
    default: false,
  },
  showActions: {
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
  activeScopeKey: {
    type: String,
    default: '',
  },
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'apply-flow'): void
  (event: 'continue-flow-defaults'): void
  (event: 'select-confirmation-option', payload: {
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }): void
  (event: 'toggle-note-input', question: AiArtifactConfirmationQuestion): void
  (event: 'update-note', payload: {
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
  (event: 'submit-confirmation-responses'): void
  (event: 'open-generated-page'): void
}>()

const normalizeText = (value: unknown) => String(value ?? '').trim()
const asArray = <T = unknown,>(value: unknown) => (Array.isArray(value) ? value as T[] : [])

const formatTimeText = (value?: number) => {
  if (!value) {
    return i18next.t('nocodeEditorAiFlowDecisionPanel.timeMissing')
  }

  return new Date(value).toLocaleString(i18next.resolvedLanguage || i18next.language || navigator.language || 'en', {
    hour12: false,
  })
}

const resolveHistoryTime = (block?: NocodeEditorAiArtifactBlock | null) => Number(
  block?.flowApplyResult?.finishedAt || block?.stagedAt || 0,
)
const resolveFlowPlan = (block?: NocodeEditorAiArtifactBlock | null) => normalizeNocodeEditorFlowPlan(block?.flowPlan)
const resolveFlowTriggerBranchCount = (block?: NocodeEditorAiArtifactBlock | null) => (
  asArray<NocodeEditorFlowPlanTriggerBranch>(resolveFlowPlan(block)?.triggerBranches).length
)
const resolveFlowTotalNodeCount = (block?: NocodeEditorAiArtifactBlock | null) => (
  countNocodeEditorFlowPlanTotalNodes(asArray<NocodeEditorFlowPlanTriggerBranch>(resolveFlowPlan(block)?.triggerBranches))
)
const resolveFlowBranchCount = (block?: NocodeEditorAiArtifactBlock | null) => (
  asArray<NocodeEditorFlowPlanTriggerBranch>(resolveFlowPlan(block)?.triggerBranches)
    .reduce((total, triggerBranch) => (
      total + countNocodeEditorFlowPlanBranches(triggerBranch.nodes || [])
    ), 0)
)

const flowPlan = computed(() => resolveFlowPlan(props.block))

const buildTriggerBranchScopeKey = (
  triggerBranch: NocodeEditorFlowPlanTriggerBranch,
  index: number,
): FlowScopeKey => `trigger-branch:${normalizeText(triggerBranch.branchKey) || index + 1}`

const triggerBranchScopes = computed<FlowTriggerBranchScope[]>(() => (
  asArray<NocodeEditorFlowPlanTriggerBranch>(flowPlan.value?.triggerBranches).map((triggerBranch, index) => ({
    key: buildTriggerBranchScopeKey(triggerBranch, index),
    branchKey: normalizeText(triggerBranch.branchKey) || String(index + 1),
    label: normalizeText(triggerBranch.triggerNode?.name)
      || normalizeText(triggerBranch.label)
      || i18next.t('nocodeEditorAiFlowDecisionPanel.triggerBranchWithIndex', { index: index + 1 }),
    totalNodeCount: 1 + countNocodeEditorFlowPlanNodes(triggerBranch.nodes || []),
    branchCount: countNocodeEditorFlowPlanBranches(triggerBranch.nodes || []),
  }))
))

const showTriggerTabs = computed(() => triggerBranchScopes.value.length >= 2)

const normalizeScopeKey = (value: unknown): FlowScopeKey | '' => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return ''
  }
  if (normalized === 'overview') {
    return 'overview'
  }
  return triggerBranchScopes.value.some(item => item.key === normalized)
    ? normalized as FlowScopeKey
    : ''
}

const resolvedActiveScopeKey = computed<FlowScopeKey>(() => {
  if (!showTriggerTabs.value) {
    return 'overview'
  }

  return normalizeScopeKey(props.activeScopeKey) || 'overview'
})

const activeTriggerScope = computed(() => {
  if (!showTriggerTabs.value || resolvedActiveScopeKey.value === 'overview') {
    return null
  }

  return triggerBranchScopes.value.find(item => item.key === resolvedActiveScopeKey.value) || null
})

const isOverviewScope = computed(() => !activeTriggerScope.value)
const scopeTitle = computed(() => activeTriggerScope.value?.label || i18next.t('nocodeEditorAiFlowDecisionPanel.currentWorkflow'))

const isQuestionResolved = (question?: Partial<AiArtifactConfirmationQuestion> | null) => Boolean(
  question?.confirmed
  || normalizeText(question?.selectedOptionValue)
  || normalizeText(question?.answerSummary)
  || normalizeText(question?.answerDetail)
  || asArray(question?.options).some((option: NocodeEditorAiConfirmQuestionOption) => Boolean(option?.selected))
)

const allQuestions = computed(() => resolveAiArtifactQuestions(props.block))
const scopedQuestions = computed(() => allQuestions.value.filter((question) => {
  if (!showTriggerTabs.value) {
    return true
  }

  const questionScopeKind = normalizeText(question.scopeKind)
  const questionBranchKey = normalizeText(question.branchKey)

  if (isOverviewScope.value) {
    return questionScopeKind !== 'trigger-branch' || !questionBranchKey
  }

  return questionScopeKind === 'trigger-branch'
    && Boolean(activeTriggerScope.value)
    && questionBranchKey === activeTriggerScope.value.branchKey
}))

const pendingQuestions = computed(() => scopedQuestions.value.filter(question => !isQuestionResolved(question)))
const displayQuestions = computed(() => (
  isAppliedState.value || confirmationStatus.value === 'completed'
    ? scopedQuestions.value
    : (
      isOverviewScope.value
        ? scopedQuestions.value
        : pendingQuestions.value
    )
))
const readonlyQuestionIds = computed(() => (
  displayQuestions.value
    .filter(question => isQuestionResolved(question))
    .map(question => normalizeText(question.id))
    .filter(Boolean)
))

const pendingQuestionCount = computed(() => (
  pendingQuestions.value.length
))
const confirmationStatus = computed(() => resolveAiArtifactConfirmationStatus(props.block))
const isAppliedState = computed(() => Boolean(props.block?.flowApplyResult))
const triggerBranchCount = computed(() => triggerBranchScopes.value.length)
const totalNodeCount = computed(() => (
  countNocodeEditorFlowPlanTotalNodes(asArray<NocodeEditorFlowPlanTriggerBranch>(flowPlan.value?.triggerBranches))
))
const branchCount = computed(() => (
  asArray<NocodeEditorFlowPlanTriggerBranch>(flowPlan.value?.triggerBranches)
    .reduce((total, triggerBranch) => (
      total + countNocodeEditorFlowPlanBranches(triggerBranch.nodes || [])
    ), 0)
))
const scopeTotalNodeCount = computed(() => activeTriggerScope.value?.totalNodeCount || totalNodeCount.value)
const scopeBranchCount = computed(() => activeTriggerScope.value?.branchCount || branchCount.value)

const remainingDraftQuestionCount = computed(() => (
  countUnansweredConfirmationQuestions(pendingQuestions.value, props.responseDrafts || {})
))
const stagedConfirmedCount = computed(() => Math.max(0, pendingQuestions.value.length - remainingDraftQuestionCount.value))
const hasPendingQuestions = computed(() => pendingQuestionCount.value > 0)
const canSubmitConfirmation = computed(() => (
  props.showActions
  && hasPendingQuestions.value
  && remainingDraftQuestionCount.value === 0
))
const isQuestionReadonly = computed(() => (
  isAppliedState.value
  || !hasPendingQuestions.value
  || !props.showActions
))

const questionSectionTitle = computed(() => (
  hasPendingQuestions.value
    ? (
      isOverviewScope.value
        ? i18next.t('nocodeEditorAiFlowDecisionPanel.flowPendingQuestions')
        : i18next.t('nocodeEditorAiFlowDecisionPanel.currentTriggerBranchPendingQuestions')
    )
    : (
      isOverviewScope.value
        ? i18next.t('nocodeEditorAiFlowDecisionPanel.preApplyConfirmationRecords')
        : i18next.t('nocodeEditorAiFlowDecisionPanel.currentTriggerBranchConfirmationRecords')
    )
))

const showOpenGeneratedButton = computed(() => (
  props.showActions
  && isOverviewScope.value
  && isAppliedState.value
))

const visibleActionCount = computed(() => (
  actionButtons.value.length + (showOpenGeneratedButton.value ? 1 : 0)
))

const questionSectionHint = computed(() => {
  if (isAppliedState.value) {
    return isOverviewScope.value
      ? i18next.t('nocodeEditorAiFlowDecisionPanel.appliedRecordHintOverview')
      : i18next.t('nocodeEditorAiFlowDecisionPanel.appliedRecordHintBranch', { title: scopeTitle.value })
  }

  if (confirmationStatus.value === 'completed') {
    return isOverviewScope.value
      ? i18next.t('nocodeEditorAiFlowDecisionPanel.completedConfirmationHintOverview')
      : i18next.t('nocodeEditorAiFlowDecisionPanel.completedConfirmationHintBranch', { title: scopeTitle.value })
  }

  return ''
})

const questionEmptyText = computed(() => {
  if (isAppliedState.value) {
    return isOverviewScope.value
      ? i18next.t('nocodeEditorAiFlowDecisionPanel.noConfirmationRecordOverview')
      : i18next.t('nocodeEditorAiFlowDecisionPanel.noConfirmationRecordBranch', { title: scopeTitle.value })
  }

  if (!hasPendingQuestions.value) {
    if (!isOverviewScope.value) {
      return i18next.t('nocodeEditorAiFlowDecisionPanel.noPendingBranchQuestionGoOverview', { title: scopeTitle.value })
    }

    return i18next.t('nocodeEditorAiFlowDecisionPanel.noNewConfirmations')
  }

  return ''
})

const questionBadgeText = computed(() => {
  if (hasPendingQuestions.value) {
    return i18next.t('nocodeEditorAiFlowDecisionPanel.pendingQuestionCount', { count: pendingQuestionCount.value })
  }

  return scopedQuestions.value.length
    ? i18next.t('nocodeEditorAiFlowDecisionPanel.confirmationRecordCount', { count: scopedQuestions.value.length })
    : (
      isOverviewScope.value
        ? i18next.t('nocodeEditorAiFlowDecisionPanel.noConfirmationRecordsThisRound')
        : i18next.t('nocodeEditorAiFlowDecisionPanel.noBranchConfirmationRecords')
    )
})

const applyResultSummary = computed(() => props.block?.flowApplyResult?.summary || null)
const applyWarnings = computed(() => asArray<string>(props.block?.flowApplyResult?.warnings).map(item => normalizeText(item)).filter(Boolean))
const completionSummary = computed(() => resolveAiArtifactCompletionSummary(props.block))
const resultSummaryList = computed(() => resolveAiArtifactResultSummary(props.block))
const scopeResultSummaryList = computed(() => (
  scopedQuestions.value
    .filter(question => isQuestionResolved(question))
    .map(question => normalizeText(question.answerSummary) || normalizeText(question.title))
    .filter(Boolean)
))

const resultSectionTitle = computed(() => (
  isOverviewScope.value
    ? i18next.t('nocodeEditorAiFlowDecisionPanel.currentWorkflowResult')
    : i18next.t('nocodeEditorAiFlowDecisionPanel.scopedResultTitle', { title: scopeTitle.value })
))

const resultItems = computed(() => {
  if (isAppliedState.value && applyResultSummary.value) {
    if (!isOverviewScope.value) {
      return [
        {
          label: i18next.t('nocodeEditorAiFlowDecisionPanel.triggerBranch'),
          value: i18next.t('nocodeEditorAiFlowDecisionPanel.branchIncludedInCurrentWorkflow', { title: scopeTitle.value }),
        },
        {
          label: i18next.t('nocodeEditorAiFlowDecisionPanel.nodeScale'),
          value: i18next.t('nocodeEditorAiFlowDecisionPanel.nodeScaleValue', {
            nodeCount: scopeTotalNodeCount.value,
            branchCount: scopeBranchCount.value,
          }),
        },
      ]
    }

    return [
      {
        label: i18next.t('nocodeEditorAiFlowDecisionPanel.workflowApplied'),
        value: i18next.t('nocodeEditorAiFlowDecisionPanel.workflowAppliedValue'),
      },
      {
        label: i18next.t('nocodeEditorAiFlowDecisionPanel.nodeScale'),
        value: i18next.t('nocodeEditorAiFlowDecisionPanel.nodeScaleApplyValue', {
          triggerBranchCount: Number(applyResultSummary.value.triggerBranchCount || 0),
          totalNodeCount: Number(applyResultSummary.value.totalNodeCount || 0),
        }),
      },
      {
        label: i18next.t('nocodeEditorAiFlowDecisionPanel.branchesAndTips'),
        value: applyWarnings.value.length
          ? i18next.t('nocodeEditorAiFlowDecisionPanel.branchesWithWarnings', {
            branchCount: Number(applyResultSummary.value.branchCount || 0),
            warningCount: applyWarnings.value.length,
          })
          : i18next.t('nocodeEditorAiFlowDecisionPanel.branchesWithoutWarnings', {
            branchCount: Number(applyResultSummary.value.branchCount || 0),
          }),
      },
    ]
  }

  if (confirmationStatus.value === 'completed') {
    return [
      {
        label: i18next.t('nocodeEditorAiFlowDecisionPanel.confirmationConclusion'),
        value: completionSummary.value || (
          isOverviewScope.value
            ? i18next.t('nocodeEditorAiFlowDecisionPanel.completedByConfirmationOverview')
            : i18next.t('nocodeEditorAiFlowDecisionPanel.completedByConfirmationBranch', { title: scopeTitle.value })
        ),
      },
      {
        label: i18next.t('nocodeEditorAiFlowDecisionPanel.planSummary'),
        value: (isOverviewScope.value ? resultSummaryList.value : scopeResultSummaryList.value).length
          ? (isOverviewScope.value ? resultSummaryList.value : scopeResultSummaryList.value)
            .slice(0, 2)
            .join(i18next.t('nocodeEditorAiFlowDecisionPanel.semicolonSeparator'))
          : (
            isOverviewScope.value
              ? i18next.t('nocodeEditorAiFlowDecisionPanel.triggerBranchAndBranchCount', {
                triggerBranchCount: triggerBranchCount.value,
                branchCount: branchCount.value,
              })
              : i18next.t('nocodeEditorAiFlowDecisionPanel.nodeAndBranchCount', {
                nodeCount: scopeTotalNodeCount.value,
                branchCount: scopeBranchCount.value,
              })
          ),
      },
    ]
  }

  return []
})

const actionState = computed(() => {
  if (isAppliedState.value) {
    return {
      reason: isOverviewScope.value
        ? i18next.t('nocodeEditorAiFlowDecisionPanel.appliedReasonOverview')
        : i18next.t('nocodeEditorAiFlowDecisionPanel.appliedReasonBranch', { title: scopeTitle.value }),
      notes: [
        applyWarnings.value.length
          ? i18next.t('nocodeEditorAiFlowDecisionPanel.applyWarningsNote', { count: applyWarnings.value.length })
          : (
            isOverviewScope.value
              ? i18next.t('nocodeEditorAiFlowDecisionPanel.reviewRecentVersionNote')
              : i18next.t('nocodeEditorAiFlowDecisionPanel.currentBranchNodeBranchNote', {
                nodeCount: scopeTotalNodeCount.value,
                branchCount: scopeBranchCount.value,
              })
          ),
      ],
      buttons: [] as FlowActionButton[],
    }
  }

  if (canSubmitConfirmation.value) {
    return {
      reason: isOverviewScope.value
        ? i18next.t('nocodeEditorAiFlowDecisionPanel.allQuestionsConfirmedOverview')
        : i18next.t('nocodeEditorAiFlowDecisionPanel.allQuestionsConfirmedBranch', { title: scopeTitle.value }),
      notes: [
        isOverviewScope.value
          ? i18next.t('nocodeEditorAiFlowDecisionPanel.continueUpdateCurrentBlueprint')
          : i18next.t('nocodeEditorAiFlowDecisionPanel.continueAbsorbFlowBlueprint'),
      ],
      buttons: [
        {
          key: 'submit-confirmation',
          label: i18next.t('nocodeEditorAiFlowDecisionPanel.submitConfirmationContinue'),
          primary: true,
          loading: props.submittingConfirmation,
          onClick: () => emit('submit-confirmation-responses'),
        },
        {
          key: 'continue-defaults',
          label: i18next.t('nocodeEditorAiFlowDecisionPanel.continueDefaults'),
          primary: false,
          onClick: () => emit('continue-flow-defaults'),
        },
      ] satisfies FlowActionButton[],
    }
  }

  if (hasPendingQuestions.value) {
    return {
      reason: isOverviewScope.value
        ? i18next.t('nocodeEditorAiFlowDecisionPanel.pendingQuestionReasonOverview')
        : i18next.t('nocodeEditorAiFlowDecisionPanel.pendingQuestionReasonBranch', { title: scopeTitle.value }),
      notes: [
        isOverviewScope.value
          ? i18next.t('nocodeEditorAiFlowDecisionPanel.continueDefaultsNoteOverview')
          : i18next.t('nocodeEditorAiFlowDecisionPanel.continueDefaultsNoteBranch'),
      ],
      buttons: [
        {
          key: 'submit-confirmation',
          label: i18next.t('nocodeEditorAiFlowDecisionPanel.confirmingProgressContinue', {
            confirmedCount: stagedConfirmedCount.value,
            totalCount: pendingQuestions.value.length,
          }),
          primary: true,
          disabled: true,
          onClick: () => undefined,
        },
        {
          key: 'continue-defaults',
          label: i18next.t('nocodeEditorAiFlowDecisionPanel.continueDefaults'),
          primary: false,
          onClick: () => emit('continue-flow-defaults'),
        },
      ] satisfies FlowActionButton[],
    }
  }

  if (isOverviewScope.value && props.canApply) {
    return {
      reason: i18next.t('nocodeEditorAiFlowDecisionPanel.readyToApplyReason'),
      notes: [
        i18next.t('nocodeEditorAiFlowDecisionPanel.applyNoPublishNote'),
      ],
      buttons: [
        {
          key: 'apply',
          label: i18next.t('nocodeEditorAiFlowDecisionPanel.applyFormWorkflow'),
          primary: true,
          loading: props.applying,
          onClick: () => emit('apply-flow'),
        },
      ] satisfies FlowActionButton[],
    }
  }

  if (!isOverviewScope.value) {
    return {
      reason: i18next.t('nocodeEditorAiFlowDecisionPanel.branchNoPendingReason', { title: scopeTitle.value }),
      notes: [
        i18next.t('nocodeEditorAiFlowDecisionPanel.branchNodeBranchSummary', {
          nodeCount: scopeTotalNodeCount.value,
          branchCount: scopeBranchCount.value,
        }),
        i18next.t('nocodeEditorAiFlowDecisionPanel.goOverviewToApplyNote'),
      ],
      buttons: [] as FlowActionButton[],
    }
  }

  return {
    reason: i18next.t('nocodeEditorAiFlowDecisionPanel.reviewBeforeNextActionReason'),
    notes: [
      i18next.t('nocodeEditorAiFlowDecisionPanel.workflowScaleSummary', {
        triggerBranchCount: triggerBranchCount.value,
        totalNodeCount: totalNodeCount.value,
        branchCount: branchCount.value,
      }),
    ],
    buttons: [] as FlowActionButton[],
  }
})

const actionButtons = computed(() => actionState.value.buttons)
const actionCopyItems = computed(() => {
  const items: Array<{ key: string; text: string }> = []

  if (actionState.value.reason) {
    items.push({
      key: 'reason',
      text: actionState.value.reason,
    })
  }

  actionState.value.notes.forEach((note, index) => {
    if (!note) {
      return
    }

    items.push({
      key: `note-${index}`,
      text: note,
    })
  })

  return items
})

const historyEntries = computed<FlowHistoryEntry[]>(() => {
  if (!isOverviewScope.value) {
    return []
  }

  const activeKey = String(props.block?.version || `${props.block?.revision || 0}:${props.block?.stagedAt || 0}`)

  return props.historyBlocks.slice(0, 6).map((block, index) => {
    const pendingCount = resolveAiArtifactQuestions(block).filter(question => !isQuestionResolved(question)).length
    const applySummary = block.flowApplyResult?.summary
    const statusLabel = block.flowApplyResult
      ? i18next.t('nocodeEditorAiFlowDecisionPanel.generated')
      : pendingCount > 0
        ? i18next.t('nocodeEditorAiFlowDecisionPanel.pendingConfirm')
        : i18next.t('nocodeEditorAiFlowDecisionPanel.pendingGenerate')
    const statusTone = block.flowApplyResult
      ? 'applied'
      : pendingCount > 0
        ? 'pending'
        : 'ready'
    const summary = block.flowApplyResult
      ? i18next.t('nocodeEditorAiFlowDecisionPanel.historyAppliedSummary', {
        triggerBranchCount: Number(applySummary?.triggerBranchCount || 0),
        branchCount: Number(applySummary?.branchCount || 0),
      })
      : pendingCount > 0
        ? i18next.t('nocodeEditorAiFlowDecisionPanel.historyPendingSummary', {
          pendingCount,
          triggerBranchCount: resolveFlowTriggerBranchCount(block),
        })
        : i18next.t('nocodeEditorAiFlowDecisionPanel.historyReadySummary', {
          triggerBranchCount: resolveFlowTriggerBranchCount(block),
          totalNodeCount: resolveFlowTotalNodeCount(block),
          branchCount: resolveFlowBranchCount(block),
        })

    const key = String(block.version || `${block.revision || 0}:${block.stagedAt || 0}:${index}`)
    return {
      key,
      title: normalizeText(block.title || block.flowPlan?.title) || i18next.t('nocodeEditorAiFlowDecisionPanel.workflowBlueprint'),
      summary,
      versionLabel: resolveAiArtifactVersionLabel(block),
      statusLabel,
      statusTone,
      timeText: formatTimeText(resolveHistoryTime(block)),
      isActive: key === activeKey || index === 0,
    }
  })
})

const handleSelectConfirmationOption = (payload: {
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  emit('select-confirmation-option', payload)
}

const handleToggleInlineNoteInput = (question: AiArtifactConfirmationQuestion) => {
  emit('toggle-note-input', question)
}

const handleUpdateInlineNote = (payload: {
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  emit('update-note', payload)
}
</script>

<style scoped lang="scss">
.ai-flow-decision-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-flow-decision-panel__panel-title {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: #1d2129;
}

.ai-flow-decision-panel__summary-block {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 144px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--blueprint-border);
  background: var(--blueprint-surface);
}

.ai-flow-decision-panel__summary-block.is-applied {
  border-color: #d8efe2;
  background: linear-gradient(180deg, #ffffff, #f8fcf9);
}

.ai-flow-decision-panel__summary-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-flow-decision-panel__action-copy,
.ai-flow-decision-panel__action-note,
.ai-flow-decision-panel__section-hint {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  color: #86909c;
}

.ai-flow-decision-panel__action-copy-card,
.ai-flow-decision-panel__questions,
.ai-flow-decision-panel__results,
.ai-flow-decision-panel__history-card {
  padding-top: 8px;
  border-top: 1px solid rgba(219, 229, 240, 0.88);
}

.ai-flow-decision-panel__questions,
.ai-flow-decision-panel__history-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-flow-decision-panel__question-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 6px;
  height: 24px;
  border-radius: 4px;
  white-space: nowrap;
  font-size: 14px;
  line-height: 22px;
  font-weight: 400;
  background: #fffbe8;
  color: #fa8c16;
}

.ai-flow-decision-panel__actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  align-items: stretch;
  width: 100%;
}

.ai-flow-decision-panel__actions :deep(.el-button) {
  width: 100%;
  margin-left: 0 !important;
  box-sizing: border-box;
}

.ai-flow-decision-panel__action-button {
  width: 100%;
  min-height: 36px;
  min-width: 0;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-weight: 400;
  font-size: 14px;
  line-height: 22px;
  padding: 7px 12px;
}

.ai-flow-decision-panel__action-button.is-progress {
  border-color: transparent;
  background: var(--blueprint-brand);
  box-shadow: none;
}

.ai-flow-decision-panel__action-button.is-progress.is-disabled,
.ai-flow-decision-panel__action-button.is-progress[disabled],
.ai-flow-decision-panel__action-button.is-progress.el-button.is-disabled,
.ai-flow-decision-panel__action-button.is-progress.el-button[disabled] {
  opacity: 1;
  color: #fff;
  background: #8ecaff;
  box-shadow: none;
  cursor: not-allowed;
  border-color: transparent;
  pointer-events: none;
}

.ai-flow-decision-panel__action-button.is-secondary {
  border-color: #0873ff;
  color: #0873ff;
  background: transparent;
}

.ai-flow-decision-panel__action-button.is-secondary:hover {
  border-color: #0873ff;
  background: rgba(232, 246, 255, 0.3);
  color: #0873ff;
}

.ai-flow-decision-panel__action-copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ai-flow-decision-panel__action-copy-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  line-height: 20px;
  color: #86909c;
}

.ai-flow-decision-panel__action-copy-item::before {
  content: "";
  width: 7px;
  height: 7px;
  margin-top: 6px;
  border-radius: 999px;
  background: rgba(31, 111, 255, 0.28);
}

.ai-flow-decision-panel__question-head,
.ai-flow-decision-panel__history-head,
.ai-flow-decision-panel__history-item-top,
.ai-flow-decision-panel__history-item-title-row,
.ai-flow-decision-panel__result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ai-flow-decision-panel__question-head,
.ai-flow-decision-panel__history-head,
.ai-flow-decision-panel__history-item-top,
.ai-flow-decision-panel__result-item {
  align-items: flex-start;
}

.ai-flow-decision-panel__question-head > .ai-flow-decision-panel__panel-title,
.ai-flow-decision-panel__history-head > .ai-flow-decision-panel__panel-title {
  font-weight: 400;
}

.ai-flow-decision-panel__confirmation-list {
  margin-top: 0;
}

.ai-flow-decision-panel__result-list,
.ai-flow-decision-panel__history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-flow-decision-panel__result-label,
.ai-flow-decision-panel__history-count,
.ai-flow-decision-panel__history-item-time,
.ai-flow-decision-panel__history-item-summary {
  color: #86909c;
}

.ai-flow-decision-panel__result-value,
.ai-flow-decision-panel__history-item-title {
  color: #1d2129;
}

.ai-flow-decision-panel__history-divider {
  width: 100%;
  height: 1px;
  background: var(--blueprint-border);
}

.ai-flow-decision-panel__history-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--blueprint-border);
  background: #fafcff;
}

.ai-flow-decision-panel__history-item.is-active {
  border-color: rgba(8, 115, 255, 0.3);
  background: #f4f9ff;
}

.ai-flow-decision-panel__history-item-main {
  min-width: 0;
  flex: 1;
}

.ai-flow-decision-panel__history-item-title-row {
  justify-content: flex-start;
  flex-wrap: wrap;
}

.ai-flow-decision-panel__history-item-title {
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
}

.ai-flow-decision-panel__history-item-summary {
  margin-top: 4px;
  font-size: 12px;
  line-height: 20px;
}

.ai-flow-decision-panel__history-item-time,
.ai-flow-decision-panel__history-count,
.ai-flow-decision-panel__result-item,
.ai-flow-decision-panel__history-inline-tag {
  font-size: 12px;
  line-height: 20px;
}

.ai-flow-decision-panel__history-inline-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 999px;
  background: #eef6ff;
  color: var(--blueprint-text-secondary);
}

.ai-flow-decision-panel__history-inline-tag.is-status.is-pending {
  background: #fff7e8;
  color: #d48806;
}

.ai-flow-decision-panel__history-inline-tag.is-status.is-ready {
  background: #eef6ff;
  color: #0873ff;
}

.ai-flow-decision-panel__history-inline-tag.is-status.is-applying {
  background: #f1f3ff;
  color: #4857d1;
}

.ai-flow-decision-panel__history-inline-tag.is-status.is-applied {
  background: #eff8e8;
  color: #52c41a;
}

@media (max-width: 900px) {
  .ai-flow-decision-panel__history-item-top,
  .ai-flow-decision-panel__question-head,
  .ai-flow-decision-panel__history-head,
  .ai-flow-decision-panel__result-item {
    flex-direction: column;
  }
}
</style>
