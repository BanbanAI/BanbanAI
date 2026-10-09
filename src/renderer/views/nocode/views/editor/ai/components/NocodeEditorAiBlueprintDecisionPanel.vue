<template>
  <section v-if="blueprint" class="ai-blueprint-decision-panel">
    <div
      :class="[
        'ai-blueprint-decision-panel__summary-block',
        { 'is-applied': isAppliedState },
      ]"
    >
      <div class="ai-blueprint-decision-panel__summary-copy">
        <h3 class="ai-blueprint-decision-panel__panel-title">{{ $t('nocodeEditorAiBlueprintDecisionPanel.suggestedNextSteps') }}</h3>
      </div>
      <div
        v-if="(showActions && actionState.buttons.length) || showOpenGeneratedButton"
        :class="['ai-blueprint-decision-panel__actions', { 'is-single': visibleActionCount <= 1 }]"
      >
        <el-button
          v-for="action in actionState.buttons"
          :key="action.key"
          :type="action.primary ? 'primary' : undefined"
          :plain="!action.primary"
          size="large"
          :class="[
            'ai-blueprint-decision-panel__action-button',
            {
              'is-progress': action.primary && action.disabled,
              'is-secondary': !action.primary,
            },
          ]"
          :loading="action.loading || (action.key === 'apply' ? applying : false)"
          :disabled="action.disabled || (action.key === 'apply' ? applyDisabled : false)"
          @click="action.onClick"
        >
          {{ action.label }}
        </el-button>
        <el-button
          v-if="showOpenGeneratedButton"
          plain
          size="large"
          class="ai-blueprint-decision-panel__action-button is-secondary"
          @click="emit('open-generated-page')"
        >{{ $t('nocodeEditorAiBlueprintDecisionPanel.viewGeneratedApp') }}</el-button>
      </div>
      <div
        v-if="actionCopyItems.length"
        class="ai-blueprint-decision-panel__action-copy-card"
      >
        <ul
          class="ai-blueprint-decision-panel__action-copy ai-blueprint-decision-panel__action-copy--inline"
        >
          <li
            v-for="item in actionCopyItems"
            :key="item.key"
            class="ai-blueprint-decision-panel__action-copy-item"
          >
            {{ item.text }}
          </li>
        </ul>
      </div>
    </div>
    <nocode-editor-ai-draft-issue-action-list
      v-if="showDraftIssueList && (draftIssueCount || draftIssueResolved)"
      class="ai-blueprint-decision-panel__draft-issues"
      compact
      :issues="draftActionIssues"
      :summary="draftPersistenceState?.summary"
      :resolved="draftIssueResolved"
      @locate="emit('locate-draft-issue', $event)"
    />
    <div v-if="isAppliedState" class="ai-blueprint-decision-panel__results">
      <div class="ai-blueprint-decision-panel__question-head">
        <h3 class="ai-blueprint-decision-panel__panel-title">{{ resultSectionTitle }}</h3>
      </div>
      <div class="ai-blueprint-decision-panel__result-list">
        <div
          v-for="item in generatedResultItems"
          :key="item.label"
          class="ai-blueprint-decision-panel__result-item"
        >
          <span class="ai-blueprint-decision-panel__result-label">{{ item.label }}</span>
          <span class="ai-blueprint-decision-panel__result-value">{{ item.value }}</span>
        </div>
      </div>
    </div>
    <div v-if="questions.length || !isAppliedState" class="ai-blueprint-decision-panel__questions">
      <div class="ai-blueprint-decision-panel__question-head">
        <h3 class="ai-blueprint-decision-panel__panel-title">{{ appliedQuestionSectionTitle }}</h3>
        <span class="ai-blueprint-decision-panel__question-badge">{{ questionBadgeText }}</span>
      </div>
      <nocode-editor-ai-confirmation-question-list
        v-if="questions.length"
        class="ai-blueprint-decision-panel__confirmation-list"
        :questions="questions"
        :response-drafts="responseDrafts"
        :active-input-question-ids="activeInputQuestionIds"
        :inline-note-question-ids="inlineNoteQuestionIds"
        :show-inline-note-input="!isQuestionReadonly"
        :readonly="isQuestionReadonly"
        compact
        :show-supplement-action="!isQuestionReadonly"
        @select-option="handleSelectConfirmationOption"
        @toggle-note-input="handleToggleInlineNoteInput"
        @update-note="handleUpdateInlineNote"
      />
      <p v-if="appliedQuestionSectionHint" class="ai-blueprint-decision-panel__section-hint">
        {{ appliedQuestionSectionHint }}
      </p>
      <div v-else-if="questionEmptyText" class="ai-blueprint-decision-panel__action-note">
        {{ questionEmptyText }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import i18next from 'i18next'
import type { AiAssistantArtifactBlock, AiAssistantBlueprintArtifactBlock } from '@common/types/ai'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import {
  isBlueprintAppliedDraftPhase,
  isBlueprintAppliedPhase,
  isBlueprintAppliedSavedPhase,
  normalizeBlueprintPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import {
  resolveAiArtifactPendingQuestionCount,
  resolveAiArtifactQuestions,
  type AiArtifactConfirmationQuestion,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import {
  getDraftPersistenceActionIssueCount,
  isDraftPersistenceStateResolved,
} from '../draftIssueActionList'
import {
  countUnansweredConfirmationQuestions,
  type NocodeEditorAiConfirmationResponseDraftMap,
} from './confirmationInteraction'
import NocodeEditorAiConfirmationQuestionList from './NocodeEditorAiConfirmationQuestionList.vue'
import NocodeEditorAiDraftIssueActionList from './NocodeEditorAiDraftIssueActionList.vue'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiDraftActionIssue,
  NocodeEditorAiDraftPersistenceState,
} from '../types'

type BlueprintActionButton = {
  key: 'apply' | 'continue' | 'submit-confirmation'
  label: string
  primary: boolean
  loading?: boolean
  disabled?: boolean
  onClick: () => void
}

type BlueprintActionState = {
  reason: string
  supportNotes: string[]
  buttons: BlueprintActionButton[]
  note: string
}

const props = defineProps({
  block: {
    type: Object as PropType<AiAssistantArtifactBlock | null>,
    default: null,
  },
  canApply: {
    type: Boolean,
    default: false,
  },
  canContinue: {
    type: Boolean,
    default: false,
  },
  applying: {
    type: Boolean,
    default: false,
  },
  applyDisabled: {
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
  draftPersistenceState: {
    type: Object as PropType<NocodeEditorAiDraftPersistenceState | null>,
    default: null,
  },
  showDraftIssueList: {
    type: Boolean,
    default: true,
  },
  showGeneratedOpenAction: {
    type: Boolean,
    default: false,
  },
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'apply-blueprint'): void
  (event: 'continue-blueprint-adjustment'): void
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
  (event: 'locate-draft-issue', issue: NocodeEditorAiDraftActionIssue): void
}>()

const blueprint = computed(() => {
  if (props.block?.kind !== 'blueprint' || !props.block.blueprint) {
    return null
  }
  return props.block.blueprint as unknown as NocodeEditorAiAppBlueprint
})

const blueprintBlock = computed(() => (
  props.block?.kind === 'blueprint'
    ? props.block as AiAssistantBlueprintArtifactBlock
    : null
))
const blueprintPhase = computed(() => normalizeBlueprintPhase(blueprintBlock.value?.phase))
const isAppliedDraftState = computed(() => isBlueprintAppliedDraftPhase(blueprintPhase.value))
const isAppliedSavedState = computed(() => isBlueprintAppliedSavedPhase(blueprintPhase.value))
const isAppliedState = computed(() => isBlueprintAppliedPhase(blueprintPhase.value))
const showOpenGeneratedButton = computed(() => (
  props.showGeneratedOpenAction
  && isAppliedState.value
))

const questions = computed(() => resolveAiArtifactQuestions(props.block))

const pendingQuestionCount = computed(() => resolveAiArtifactPendingQuestionCount(props.block))

const hasOpenQuestions = computed(() => pendingQuestionCount.value > 0)
const draftPersistenceState = computed(() => (
  props.draftPersistenceState || blueprintBlock.value?.draftPersistenceState || null
))
const draftActionIssues = computed(() => draftPersistenceState.value?.actionIssues || [])
const draftIssueCount = computed(() => getDraftPersistenceActionIssueCount(draftPersistenceState.value))
const draftIssueResolved = computed(() => isDraftPersistenceStateResolved(draftPersistenceState.value))

const remainingDraftQuestionCount = computed(() => (
  countUnansweredConfirmationQuestions(questions.value, props.responseDrafts || {})
))

const hasCompleteDraftResponses = computed(() => (
  hasOpenQuestions.value && remainingDraftQuestionCount.value === 0
))

const canSubmitConfirmation = computed(() => (
  props.showActions && props.canContinue && hasCompleteDraftResponses.value
))

const stagedConfirmedCount = computed(() => (
  Math.max(0, questions.value.length - remainingDraftQuestionCount.value)
))

const resultSectionTitle = computed(() => (
  isAppliedDraftState.value
    ? i18next.t('nocodeEditorAiBlueprintDecisionPanel.draftWriteSummary')
    : i18next.t('nocodeEditorAiBlueprintDecisionPanel.generatedResultSummary')
))

const appliedQuestionSectionTitle = computed(() => {
  if (isAppliedDraftState.value) return i18next.t('nocodeEditorAiBlueprintDecisionPanel.preDraftConfirmationRecords')
  if (isAppliedSavedState.value) return i18next.t('nocodeEditorAiBlueprintDecisionPanel.preGenerationConfirmationRecords')
  return i18next.t('nocodeEditorAiBlueprintDecisionPanel.blueprintPendingQuestions')
})

const appliedQuestionSectionHint = computed(() => {
  if (isAppliedDraftState.value) {
    if (draftIssueResolved.value) {
      return i18next.t('nocodeEditorAiBlueprintDecisionPanel.preDraftRecordsResolvedHint')
    }
    return i18next.t('nocodeEditorAiBlueprintDecisionPanel.preDraftRecordsPendingHint')
  }
  if (isAppliedSavedState.value) {
    return i18next.t('nocodeEditorAiBlueprintDecisionPanel.preGenerationRecordsHint')
  }
  return ''
})

const questionEmptyText = computed(() => {
  if (isAppliedDraftState.value) {
    if (draftIssueResolved.value) {
      return i18next.t('nocodeEditorAiBlueprintDecisionPanel.noDraftRecordsResolved')
    }
    return i18next.t('nocodeEditorAiBlueprintDecisionPanel.noDraftRecordsPending')
  }
  if (isAppliedSavedState.value) {
    return i18next.t('nocodeEditorAiBlueprintDecisionPanel.noGeneratedRecords')
  }
  return ''
})

const isQuestionReadonly = computed(() => (
  isAppliedState.value
  || !props.showActions
  || (!props.canApply && !props.canContinue)
))

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

const recommendedAction = computed<'apply' | 'continue' | 'view'>(() => {
  if (hasOpenQuestions.value && props.canContinue) {
    return 'continue'
  }
  if (props.canApply) {
    return 'apply'
  }
  if (props.canContinue) {
    return 'continue'
  }
  return 'view'
})

const buildContinueReason = () => (
  props.showActions
    ? i18next.t('nocodeEditorAiBlueprintDecisionPanel.continueReasonWithActions')
    : i18next.t('nocodeEditorAiBlueprintDecisionPanel.continueReasonReadonly')
)

const buildContinueSupportNotes = () => (
  props.showActions
    ? [
      i18next.t('nocodeEditorAiBlueprintDecisionPanel.continueSupportApplyCurrent'),
    ]
    : [
      i18next.t('nocodeEditorAiBlueprintDecisionPanel.incrementalFieldAdjustNote'),
      i18next.t('nocodeEditorAiBlueprintDecisionPanel.continueSupportApplyCurrent'),
    ]
)

const buildApplyReadyReason = () => (
  props.showActions
    ? i18next.t('nocodeEditorAiBlueprintDecisionPanel.applyReadyReason')
    : i18next.t('nocodeEditorAiBlueprintDecisionPanel.continueReasonReadonly')
)

const actionState = computed<BlueprintActionState>(() => {
  if (draftIssueCount.value > 0) {
    return {
      reason: i18next.t('nocodeEditorAiBlueprintDecisionPanel.draftHasIssuesReason'),
      supportNotes: [
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.completeDraftIssuesBeforeSave'),
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.locateOnlyNote'),
      ],
      buttons: [],
      note: '',
    }
  }

  if (isAppliedDraftState.value) {
    return {
      reason: draftIssueResolved.value
        ? i18next.t('nocodeEditorAiBlueprintDecisionPanel.draftResolvedReason')
        : i18next.t('nocodeEditorAiBlueprintDecisionPanel.draftNoIssueReason'),
      supportNotes: [
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.returnToDraftChatNote'),
      ],
      buttons: [],
      note: '',
    }
  }

  if (isAppliedSavedState.value) {
    return {
      reason: i18next.t('nocodeEditorAiBlueprintDecisionPanel.savedBlueprintReviewReason'),
      supportNotes: [
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.detailsReadonly'),
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.returnToDraftChatForAdjustNote'),
      ],
      buttons: [],
      note: '',
    }
  }

  const buttons: BlueprintActionButton[] = []
  if (props.canContinue) {
    buttons.push({
      key: 'continue',
      label: i18next.t('nocodeEditorAiBlueprintDecisionPanel.continueAdjustBlueprint'),
      primary: recommendedAction.value === 'continue',
      onClick: () => emit('continue-blueprint-adjustment'),
    })
  }
  if (props.canApply) {
    buttons.push({
      key: 'apply',
      label: hasOpenQuestions.value
        ? i18next.t('nocodeEditorAiBlueprintDecisionPanel.applyCurrentIgnoringQuestions')
        : i18next.t('nocodeEditorAiBlueprintDecisionPanel.generateFromBlueprint'),
      primary: recommendedAction.value === 'apply',
      onClick: () => emit('apply-blueprint'),
    })
  }

  const sortedButtons = buttons.sort((left, right) => Number(right.primary) - Number(left.primary))

  if (canSubmitConfirmation.value) {
    const submitButton: BlueprintActionButton = {
      key: 'submit-confirmation',
      label: i18next.t('nocodeEditorAiBlueprintDecisionPanel.submitConfirmationAdjustBlueprint'),
      primary: true,
      loading: props.submittingConfirmation,
      onClick: () => emit('submit-confirmation-responses'),
    }

    return {
      reason: i18next.t('nocodeEditorAiBlueprintDecisionPanel.readyToSubmitConfirmationReason'),
      supportNotes: [
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.submitConfirmationSupportNote'),
      ],
      buttons: [
        submitButton,
        ...sortedButtons
          .filter(button => button.key !== 'continue')
          .map(button => ({ ...button, primary: false })),
      ],
      note: '',
    }
  }

  if (!props.canApply && !props.canContinue) {
    return {
      reason: i18next.t('nocodeEditorAiBlueprintDecisionPanel.generatedReviewReason'),
      supportNotes: [
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.incrementalFieldAdjustNote'),
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.returnToDraftChatNote'),
      ],
      buttons: [],
      note: i18next.t('nocodeEditorAiBlueprintDecisionPanel.returnToDraftSessionNote'),
    }
  }

  if (hasOpenQuestions.value) {
    return {
      reason: buildContinueReason(),
      supportNotes: buildContinueSupportNotes(),
      buttons: [
        {
          key: 'continue',
          label: i18next.t('nocodeEditorAiBlueprintDecisionPanel.confirmingProgressAdjustBlueprint', {
            confirmedCount: stagedConfirmedCount.value,
            totalCount: questions.value.length,
          }),
          primary: true,
          disabled: true,
          onClick: () => undefined,
        },
        ...(props.canApply
          ? [{
            key: 'apply' as const,
            label: i18next.t('nocodeEditorAiBlueprintDecisionPanel.applyCurrentIgnoringQuestions'),
            primary: false,
            onClick: () => emit('apply-blueprint'),
          }]
          : []),
      ],
      note: '',
    }
  }

  if (props.canApply) {
    return {
      reason: buildApplyReadyReason(),
      supportNotes: [
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.keyQuestionsCleared'),
        i18next.t('nocodeEditorAiBlueprintDecisionPanel.keyQuestionsCleared'),
      ],
      buttons: sortedButtons,
      note: '',
    }
  }

  return {
    reason: i18next.t('nocodeEditorAiBlueprintDecisionPanel.adjustBeforeGenerateReason'),
    supportNotes: [
      i18next.t('nocodeEditorAiBlueprintDecisionPanel.completeDraftIssuesBeforeSave'),
    ],
    buttons: sortedButtons,
    note: '',
  }
})

const actionCopyItems = computed(() => {
  const items: Array<{ key: string, text: string }> = []

  if (actionState.value.reason) {
    items.push({
      key: 'reason',
      text: actionState.value.reason,
    })
  }

  if (actionState.value.note) {
    items.push({
      key: 'note',
      text: actionState.value.note,
    })
  }

  actionState.value.supportNotes.forEach((note, index) => {
    items.push({
      key: `support-${index}`,
      text: note,
    })
  })

  return items
})

const generatedResultItems = computed(() => {
  const result = isAppliedState.value ? blueprintBlock.value?.applyResult : null
  if (!result) {
    return []
  }

  return [
    {
      label: i18next.t('nocodeEditorAiBlueprintDecisionPanel.formProcessing'),
      value: i18next.t('nocodeEditorAiBlueprintDecisionPanel.formCreateReuseCount', {
        created: result.summary.formsCreated,
        reused: result.summary.formsReused,
      }),
    },
    {
      label: i18next.t('nocodeEditorAiBlueprintDecisionPanel.fieldProcessing'),
      value: i18next.t('nocodeEditorAiBlueprintDecisionPanel.fieldCreateReuseUpdateCount', {
        created: result.summary.fieldsCreated,
        reused: result.summary.fieldsReused,
        updated: result.summary.fieldsUpdated,
      }),
    },
    {
      label: i18next.t('nocodeEditorAiBlueprintDecisionPanel.tips'),
      value: result.warnings.length
        ? i18next.t('nocodeEditorAiBlueprintDecisionPanel.warningCount', { count: result.warnings.length })
        : i18next.t('nocodeEditorAiBlueprintDecisionPanel.noExtraTips'),
    },
  ]
})

const visibleActionCount = computed(() => (
  (props.showActions ? actionState.value.buttons.length : 0)
  + (showOpenGeneratedButton.value ? 1 : 0)
))

const questionBadgeText = computed(() => (
  isAppliedDraftState.value
    ? (
      questions.value.length
        ? i18next.t('nocodeEditorAiBlueprintDecisionPanel.preDraftRecordCount', { count: questions.value.length })
        : i18next.t('nocodeEditorAiBlueprintDecisionPanel.noConfirmationRecordsThisRound')
    )
    : isAppliedSavedState.value
      ? (
        questions.value.length
          ? i18next.t('nocodeEditorAiBlueprintDecisionPanel.preGenerationRecordCount', { count: questions.value.length })
          : i18next.t('nocodeEditorAiBlueprintDecisionPanel.noConfirmationRecordsThisRound')
      )
      : (
        hasOpenQuestions.value
          ? i18next.t('nocodeEditorAiBlueprintDecisionPanel.pendingQuestionCount', { count: questions.value.length })
          : i18next.t('nocodeEditorAiBlueprintDecisionPanel.noNewConfirmation')
      )
))
</script>

<style scoped lang="scss">
.ai-blueprint-decision-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-blueprint-decision-panel__panel-title {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  color: #1d2129;
}

.ai-blueprint-decision-panel__summary-block {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 144px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--blueprint-border);
  background: var(--blueprint-surface);
}

.ai-blueprint-decision-panel__summary-block.is-applied {
  min-height: 144px;
}

.ai-blueprint-decision-panel__summary-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-blueprint-decision-panel__action-copy,
.ai-blueprint-decision-panel__action-note,
.ai-blueprint-decision-panel__section-hint {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  color: #86909c;
}

.ai-blueprint-decision-panel__action-copy-card,
.ai-blueprint-decision-panel__questions,
.ai-blueprint-decision-panel__results {
  padding-top: 8px;
  border-top: 1px solid rgba(219, 229, 240, 0.88);
}

.ai-blueprint-decision-panel__questions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-blueprint-decision-panel__draft-issues {
  margin-top: -2px;
}

.ai-blueprint-decision-panel__question-badge,
.ai-blueprint-decision-panel__action-copy-item::before {
  flex-shrink: 0;
}

.ai-blueprint-decision-panel__question-badge {
  display: inline-flex;
  align-items: center;
}

.ai-blueprint-decision-panel__question-badge {
  justify-content: center;
  padding: 1px 6px;
  height: 24px;
  border-radius: 4px;
  white-space: nowrap;
  font-size: 14px;
  line-height: 22px;
  font-weight: 400;
  background: #fffbe8;
  border: 0;
  color: #fa8c16;
}

.ai-blueprint-decision-panel__actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  align-items: stretch;
  width: 100%;
}

.ai-blueprint-decision-panel__actions.is-single {
  grid-template-columns: 1fr;
}

.ai-blueprint-decision-panel__actions :deep(.el-button) {
  width: 100%;
  margin-left: 0 !important;
  box-sizing: border-box;
}

.ai-blueprint-decision-panel__actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.ai-blueprint-decision-panel__action-button {
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

.ai-blueprint-decision-panel__action-button.is-progress {
  border-color: transparent;
  background: var(--blueprint-brand);
  box-shadow: none;
}

.ai-blueprint-decision-panel__action-button.is-progress.is-disabled,
.ai-blueprint-decision-panel__action-button.is-progress[disabled],
.ai-blueprint-decision-panel__action-button.is-progress.el-button.is-disabled,
.ai-blueprint-decision-panel__action-button.is-progress.el-button[disabled] {
  opacity: 1;
  color: #fff;
  background: #8ecaff;
  box-shadow: none;
  cursor: not-allowed;
  border-color: transparent;
  pointer-events: none;
}

.ai-blueprint-decision-panel__action-button.is-progress.is-disabled :deep(span),
.ai-blueprint-decision-panel__action-button.is-progress[disabled] :deep(span),
.ai-blueprint-decision-panel__action-button.is-progress.el-button.is-disabled :deep(span),
.ai-blueprint-decision-panel__action-button.is-progress.el-button[disabled] :deep(span) {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
}

.ai-blueprint-decision-panel__action-button.is-secondary {
  border-color: #0873ff;
  color: #0873ff;
  background: transparent;
}

.ai-blueprint-decision-panel__action-button.is-secondary:hover {
  border-color: #0873ff;
  background: rgba(232, 246, 255, 0.3);
  color: #0873ff;
}

.ai-blueprint-decision-panel__action-copy {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ai-blueprint-decision-panel__action-copy--inline {
  padding-top: 0;
}

.ai-blueprint-decision-panel__action-copy-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  line-height: 20px;
  color: #86909c;
}

.ai-blueprint-decision-panel__action-copy-item::before {
  content: "";
  width: 7px;
  height: 7px;
  margin-top: 6px;
  border-radius: 999px;
  background: rgba(31, 111, 255, 0.28);
}

.ai-blueprint-decision-panel__question-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: nowrap;
}

.ai-blueprint-decision-panel__question-head > .ai-blueprint-decision-panel__panel-title {
  font-weight: 400;
}

.ai-blueprint-decision-panel__confirmation-list {
  margin-top: 0;
}

.ai-blueprint-decision-panel__section-hint {
  margin-top: 0;
}

.ai-blueprint-decision-panel__result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-blueprint-decision-panel__result-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  line-height: 20px;
}

.ai-blueprint-decision-panel__result-label {
  color: #86909c;
}

.ai-blueprint-decision-panel__result-value {
  min-width: 0;
  text-align: right;
  color: #1d2129;
}

@media (max-width: 900px) {
  .ai-blueprint-decision-panel__actions {
    grid-template-columns: 1fr;
  }
}
</style>
