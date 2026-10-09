<template>
  <section class="ai-confirmation-card">
    <div class="ai-confirmation-card__head is-pending">
      <div class="ai-confirmation-card__title-wrap">
        <div class="ai-confirmation-card__title">{{ title }}</div>
        <span
          v-if="versionTagText"
          class="ai-confirmation-card__version"
        >
          {{ versionTagText }}
        </span>
      </div>
      <span
        v-if="statusBadgeText"
        class="ai-confirmation-card__badge"
      >
        {{ statusBadgeText }}
      </span>
    </div>

    <div
      v-if="showStateSummary"
      class="ai-confirmation-card__section-card"
    >
      <div class="ai-confirmation-card__section-title">{{ stateSummaryTitle }}</div>
      <p class="ai-confirmation-card__section-copy">{{ stateSummaryText }}</p>
    </div>

    <div
      v-if="showReadyBody && goalText"
      class="ai-confirmation-card__section-card"
    >
      <div class="ai-confirmation-card__section-title">{{ $t('nocodeEditorAiConfirmationCard.goalDescription') }}</div>
      <p class="ai-confirmation-card__section-copy">{{ goalText }}</p>
    </div>

    <div
      v-if="showReadyBody && coreObjects.length"
      class="ai-confirmation-card__section-card"
    >
      <div class="ai-confirmation-card__section-title">{{ $t('nocodeEditorAiConfirmationCard.coreObjects') }}</div>
      <ul class="ai-confirmation-card__compact-list">
        <li
          v-for="(item, index) in coreObjects"
          :key="`core-object-${index}-${item}`"
        >
          {{ item }}
        </li>
      </ul>
    </div>

    <div
      v-if="showReadyBody && (planningItems.length || showPreviewAction)"
      class="ai-confirmation-card__section-card"
    >
      <div class="ai-confirmation-card__section-title-row">
        <div class="ai-confirmation-card__section-title">{{ planningItemsTitle }}</div>
        <button
          v-if="false && showPreviewAction"
          type="button"
          class="ai-confirmation-card__review-link ai-confirmation-card__section-preview-link"
          @click="handlePreviewAction"
        >
          {{ previewActionText }}
        </button>
      </div>
      <ul class="ai-confirmation-card__compact-list">
        <li
          v-for="(item, index) in planningItems"
          :key="`planning-item-${index}-${item}`"
        >
          {{ item }}
        </li>
      </ul>
    </div>

    <div
      v-if="showReadyBody && scopeText"
      class="ai-confirmation-card__section-card"
    >
      <div class="ai-confirmation-card__section-title">{{ $t('nocodeEditorAiConfirmationCard.currentRoundScope') }}</div>
      <p class="ai-confirmation-card__section-copy">{{ scopeText }}</p>
    </div>

    <div
      v-if="showQuestionSection"
      class="ai-confirmation-card__section ai-confirmation-card__section--questions"
    >
      <div class="ai-confirmation-card__section-title-row ai-confirmation-card__question-title-row">
        <div class="ai-confirmation-card__section-title">{{ questionSectionTitle }}</div>
        <button
          v-if="showReviewAction"
          type="button"
          class="ai-confirmation-card__review-link ai-confirmation-card__section-review-link"
          @click="handleReviewAction"
        >
          {{ reviewActionText }}
        </button>
      </div>
      <nocode-editor-ai-confirmation-question-list
        class="ai-confirmation-card__questions"
        :questions="displayQuestions"
        :response-drafts="responseDrafts"
        :active-input-question-ids="activeInputQuestionIds || []"
        :readonly="isQuestionReadonly"
        compact
        show-supplement-action
        @select-option="handleSelectOption"
        @focus-input="handleFocusInput"
      />
      <p v-if="questionSectionHint" class="ai-confirmation-card__section-hint">{{ questionSectionHint }}</p>
    </div>

    <div v-if="showActionsSection" class="ai-confirmation-card__section ai-confirmation-card__section--actions">
      <div class="ai-confirmation-card__section-title">{{ $t('nocodeEditorAiConfirmationCard.suggestedNextSteps') }}</div>
      <div class="ai-confirmation-card__actions is-pending-stacked">
        <el-button
          v-if="showPrimaryAction"
          type="primary"
          class="ai-confirmation-card__primary"
          :class="{
            'is-ready': inlineBatchConfirmLabel && !isCompleted,
          }"
          :disabled="isPrimaryDisabled"
          @click="handlePrimaryAction"
        >
          {{ primaryActionLabel }}
        </el-button>
        <el-button
          v-if="showSecondaryAction"
          plain
          class="ai-confirmation-card__secondary"
          :disabled="isSecondaryDisabled"
          @click="handleSecondaryAction"
        >
          {{ secondaryActionText }}
        </el-button>
      </div>
      <p
        v-if="readonlyActionsHint"
        class="ai-confirmation-card__actions-hint"
      >
        {{ readonlyActionsHint }}
      </p>
    </div>

    <div
      v-if="statusSummaryText"
      class="ai-confirmation-card__section-card is-soft ai-confirmation-card__section-card--ai-handling"
    >
      <div class="ai-confirmation-card__section-title">{{ statusSummaryTitle }}</div>
      <p v-if="statusSummaryText" class="ai-confirmation-card__section-copy">{{ statusSummaryText }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AiAssistantArtifactBlock } from '@common/types/ai'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import {
  getNocodeEditorCompletedDefaultsContinueLabel,
  getNocodeEditorPendingContinueLabel,
} from '@common/utils/nocodeEditorConfirmationCopy'
import {
  canPreviewAiArtifact,
  resolveAiArtifactConfirmation,
  resolveAiArtifactConfirmationQuestionCount,
  resolveAiArtifactConfirmationSummary,
  resolveAiArtifactConfirmationStatus,
  resolveAiArtifactContinueLabel,
  resolveAiArtifactPendingQuestions,
  resolveAiArtifactQuestions,
  resolveAiArtifactTitle,
  resolveAiArtifactViewLabel,
  type AiArtifactConfirmationQuestion,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import i18next from 'i18next'
import { computed } from 'vue'
import {
  deriveConfirmationPresentationFromArtifactBlock,
  mergeConfirmationPresentation,
  resolveConfirmationAiHandlingText,
  type NocodeEditorAiConfirmationPresentation,
} from './confirmationPresentation'
import type { PlanningCardPhase } from '../planningCardPhase'
import NocodeEditorAiConfirmationQuestionList from './NocodeEditorAiConfirmationQuestionList.vue'
import {
  buildStagedConfirmationResponses,
  countUnansweredConfirmationQuestions,
  type NocodeEditorAiConfirmationResponseDraftMap,
} from './confirmationInteraction'

// eslint-disable-next-line vue/valid-define-props
const props = defineProps<{
  block: AiAssistantArtifactBlock
  phase?: PlanningCardPhase | ''
  stateMessage?: string
  presentation?: NocodeEditorAiConfirmationPresentation | null
  responseDrafts?: NocodeEditorAiConfirmationResponseDraftMap
  activeInputQuestionIds?: string[]
  statusTagText?: string
  readonlyVersion?: boolean
  versionTagText?: string
  actionDisabled?: boolean
}>()

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'open', block: AiAssistantArtifactBlock): void
  (event: 'preview', block: AiAssistantArtifactBlock): void
  (event: 'continue-defaults', block: AiAssistantArtifactBlock): void
  (event: 'submit-staged-responses', block: AiAssistantArtifactBlock): void
  (event: 'focus-input', payload: {
    block: AiAssistantArtifactBlock
    question: AiArtifactConfirmationQuestion
  }): void
  (event: 'select-option', payload: {
    block: AiAssistantArtifactBlock
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }): void
}>()

const resolveLegacyConfirmationCardPhase = (
  block: AiAssistantArtifactBlock,
): PlanningCardPhase => {
  if (block.status === 'error') {
    return 'error'
  }

  if (block.status === 'loading') {
    return 'next-stage-loading'
  }

  const confirmation = resolveAiArtifactConfirmation(block)
  const confirmationStatus = resolveAiArtifactConfirmationStatus(block)
  const questionCount = resolveAiArtifactConfirmationQuestionCount(block)

  if (block.kind === 'app-plan' && !confirmation && questionCount <= 0) {
    return 'ready-no-confirmation'
  }

  if (confirmationStatus === 'completed') {
    return 'completed'
  }

  return 'pending'
}

const resolvedPhase = computed(() => (
  props.phase || resolveLegacyConfirmationCardPhase(props.block)
))
const isLoadingPhase = computed(() => resolvedPhase.value === 'next-stage-loading')
const isErrorPhase = computed(() => resolvedPhase.value === 'error')
const isCompleted = computed(() => (
  resolvedPhase.value === 'completed'
  || resolvedPhase.value === 'next-stage-loading'
  || resolvedPhase.value === 'error'
))
const readonlyVersion = computed(() => Boolean(props.readonlyVersion))
const versionTagText = computed(() => String(props.versionTagText || '').trim())
const isQuestionReadonly = computed(() => isCompleted.value || readonlyVersion.value)
const isCompletedActionPhase = computed(() => resolvedPhase.value === 'completed')
const readonlyActionsHint = computed(() => (
  readonlyVersion.value && !isCompletedActionPhase.value
    ? i18next.t('nocodeEditorAiConfirmationCard.readonlyVersionHint')
    : ''
))
const title = computed(() => resolveAiArtifactTitle(props.block))
const summary = computed(() => resolveAiArtifactConfirmationSummary(props.block) || props.block.summary || '')
const confirmation = computed(() => resolveAiArtifactConfirmation(props.block))
const continueLabel = computed(() => resolveAiArtifactContinueLabel(props.block))
const allQuestions = computed(() => resolveAiArtifactQuestions(props.block))
const pendingQuestions = computed(() => resolveAiArtifactPendingQuestions(props.block))
const shouldLockFlowSchemeQuestionsToCurrentRound = computed(() => (
  props.block.kind === 'flow-scheme' && !isCompleted.value
))
const displayQuestions = computed(() => (
  shouldLockFlowSchemeQuestionsToCurrentRound.value
    ? pendingQuestions.value
    : (isCompleted.value ? allQuestions.value : pendingQuestions.value)
))
const stagedResponses = computed(() => (
  buildStagedConfirmationResponses(pendingQuestions.value, props.responseDrafts || {})
))
const remainingDraftQuestionCount = computed(() => (
  countUnansweredConfirmationQuestions(pendingQuestions.value, props.responseDrafts || {})
))
const pendingCount = computed(() => pendingQuestions.value.length)
const normalizedPresentation = computed(() => mergeConfirmationPresentation(
  props.presentation,
  deriveConfirmationPresentationFromArtifactBlock(props.block),
))
const goalText = computed(() => normalizedPresentation.value?.goal || summary.value)
const coreObjects = computed(() => normalizedPresentation.value?.coreObjects || [])
const planningItems = computed(() => normalizedPresentation.value?.planningItems || [])
const planningItemsTitle = computed(() => (
  props.block.kind === 'form-plan'
    ? i18next.t('nocodeEditorAiConfirmationCard.fieldScope')
    : i18next.t('nocodeEditorAiConfirmationCard.planningChecklist')
))
const scopeText = computed(() => (
  props.block.kind === 'form-plan'
    ? ''
    : (normalizedPresentation.value?.scope || '')
))
const progressConfirmedCount = computed(() => (
  Math.max(0, pendingQuestions.value.length - remainingDraftQuestionCount.value)
))
const pendingBadgeText = computed(() => (
  pendingCount.value > 0
    ? i18next.t('nocodeEditorAiConfirmationCard.pendingConfirmationCount', { count: pendingCount.value })
    : ''
))
const isReadyWithoutConfirmation = computed(() => (
  resolvedPhase.value === 'ready-no-confirmation'
))
const showReadyBody = computed(() => Boolean(resolvedPhase.value))
const isGenericPendingCountTitle = (value: string) => (
  /^待确认\s*\d+\s*项$/.test(value)
  || /^\d+\s*项待确认$/.test(value)
)
const fallbackPendingTitle = computed(() => (
  pendingCount.value > 0
    ? i18next.t('nocodeEditorAiConfirmationCard.pendingConfirmationCount', { count: pendingCount.value })
    : i18next.t('nocodeEditorAiConfirmationCard.pendingConfirmation')
))
const pendingTitle = computed(() => {
  const presentationPendingTitle = String(normalizedPresentation.value?.pendingTitle || '').trim()
  if (!presentationPendingTitle || isGenericPendingCountTitle(presentationPendingTitle)) {
    return fallbackPendingTitle.value
  }

  return presentationPendingTitle
})
const completedPrimaryLabel = computed(() => (
  continueLabel.value === getNocodeEditorCompletedDefaultsContinueLabel()
    ? i18next.t('nocodeEditorAiConfirmationCard.continuedWithDefaults')
    : (continueLabel.value || i18next.t('nocodeEditorAiConfirmationCard.generateFromConfirmations'))
))
const isCompletedContinuationActionable = computed(() => (
  isCompletedActionPhase.value
  && continueLabel.value !== getNocodeEditorCompletedDefaultsContinueLabel()
))
const pendingReviewLabel = computed(() => (
  i18next.t('nocodeEditorAiConfirmationCard.viewFullConfirmation')
))
const shouldHidePendingSecondaryAction = computed(() => (
  props.block.kind === 'flow-scheme' || props.block.kind === 'flow-plan'
))
const pendingSecondaryLabel = computed(() => {
  if (shouldHidePendingSecondaryAction.value) {
    return ''
  }

  const secondaryActionLabel = String(confirmation.value?.secondaryActionLabel || '').trim()
  if (secondaryActionLabel === getNocodeEditorPendingContinueLabel()) {
    return i18next.t('nocodeEditorAiConfirmationCard.continueWithDefaults')
  }

  return secondaryActionLabel || i18next.t('nocodeEditorAiConfirmationCard.continueWithDefaults')
})
const filteredPresentationNextSteps = computed(() => (
  (normalizedPresentation.value?.nextSteps || []).filter((step) => {
    const normalizedStep = String(step || '').replace(/\s+/g, '')
    return (
      !normalizedStep.includes('按序号逐项确认')
      && !normalizedStep.includes('回复“忽略待确认，按默认方案继续”')
      && !normalizedStep.includes('回复"忽略待确认，按默认方案继续"')
    )
  })
))
const nextStepHint = computed(() => {
  if (filteredPresentationNextSteps.value.length) {
    return filteredPresentationNextSteps.value.join('；')
  }

  if (isCompleted.value) {
    return i18next.t('nocodeEditorAiConfirmationCard.defaultNextBlueprintHint')
  }

  return ''
})
const inlineBatchConfirmLabel = computed(() => {
  if (
    isCompleted.value
    || !pendingQuestions.value.length
    || remainingDraftQuestionCount.value > 0
    || !stagedResponses.value.length
  ) {
    return ''
  }

  return i18next.t('nocodeEditorAiConfirmationCard.continueWithConfirmedPlan')
})
const pendingPrimaryLabel = computed(() => {
  if (inlineBatchConfirmLabel.value) {
    return ''
  }

  return pendingQuestions.value.length > 0
    ? i18next.t('nocodeEditorAiConfirmationCard.confirmingProgress', {
      confirmed: progressConfirmedCount.value,
      total: pendingQuestions.value.length,
    })
    : ''
})
const isPendingPrimaryDisabled = computed(() => (
  Boolean(pendingPrimaryLabel.value)
))
const pendingDraftHint = computed(() => {
  if (isCompleted.value || !pendingQuestions.value.length) {
    return ''
  }

  if (!stagedResponses.value.length) {
    return nextStepHint.value
  }

  if (inlineBatchConfirmLabel.value) {
    return i18next.t('nocodeEditorAiConfirmationCard.allConfirmationsReadyHint')
  }

  return i18next.t('nocodeEditorAiConfirmationCard.remainingConfirmationsHint', {
    count: remainingDraftQuestionCount.value,
  })
})
const completedStatusTagText = computed(() => (
  continueLabel.value === getNocodeEditorCompletedDefaultsContinueLabel()
    ? i18next.t('nocodeEditorAiConfirmationCard.continuedWithDefaults')
    : i18next.t('nocodeEditorAiConfirmationCard.confirmedComplete')
))
const defaultStatusBadgeText = computed(() => {
  if (isLoadingPhase.value) {
    return i18next.t('nocodeEditorAiConfirmationCard.processing')
  }
  if (isErrorPhase.value) {
    return i18next.t('nocodeEditorAiConfirmationCard.processingFailed')
  }
  if (isCompletedActionPhase.value) {
    return completedStatusTagText.value
  }
  return pendingBadgeText.value
})
const statusBadgeText = computed(() => (
  props.statusTagText
  || defaultStatusBadgeText.value
))
const questionSectionTitle = computed(() => (
  isCompleted.value ? i18next.t('nocodeEditorAiConfirmationCard.confirmedResults') : pendingTitle.value
))
const questionSectionHint = computed(() => (
  isCompleted.value ? '' : pendingDraftHint.value
))
const showQuestionSection = computed(() => (
  showReadyBody.value && displayQuestions.value.length > 0
))
const primaryActionLabel = computed(() => {
  if (isCompletedActionPhase.value) {
    return completedPrimaryLabel.value
  }

  if (isLoadingPhase.value || isErrorPhase.value) {
    return ''
  }

  return inlineBatchConfirmLabel.value || pendingPrimaryLabel.value
})
const secondaryActionText = computed(() => (
  isCompleted.value ? '' : pendingSecondaryLabel.value
))
const showActionsSection = computed(() => (
  showReadyBody.value
  && !isReadyWithoutConfirmation.value
  && !isLoadingPhase.value
  && !isErrorPhase.value
  && (
    readonlyVersion.value
      ? (isCompletedActionPhase.value && Boolean(primaryActionLabel.value))
      : (
        Boolean(primaryActionLabel.value)
        || Boolean(secondaryActionText.value)
        || Boolean(readonlyActionsHint.value)
      )
  )
))
const showPrimaryAction = computed(() => (
  showActionsSection.value && Boolean(primaryActionLabel.value)
))
const showSecondaryAction = computed(() => (
  showActionsSection.value
  && (
    readonlyVersion.value
      ? false
      : Boolean(secondaryActionText.value)
  )
))
const reviewActionText = computed(() => (
  pendingReviewLabel.value
))
const showReviewAction = computed(() => (
  Boolean(reviewActionText.value)
))
const previewActionText = computed(() => {
  if (props.block.kind !== 'app-plan' && props.block.kind !== 'form-plan') {
    return ''
  }
  if (!canPreviewAiArtifact(props.block)) {
    return ''
  }
  return resolveAiArtifactViewLabel(props.block)
})
const showPreviewAction = computed(() => Boolean(previewActionText.value))
const isPrimaryDisabled = computed(() => (
  readonlyVersion.value
  || props.actionDisabled
  || (isCompletedActionPhase.value && !isCompletedContinuationActionable.value)
  || (!inlineBatchConfirmLabel.value && isPendingPrimaryDisabled.value)
))
const isSecondaryDisabled = computed(() => (
  readonlyVersion.value
  || props.actionDisabled
  || isCompletedActionPhase.value
))
const aiHandlingText = computed(() => {
  return resolveConfirmationAiHandlingText({
    block: props.block,
    presentation: normalizedPresentation.value,
    summary: summary.value,
    goalText: goalText.value,
    phase: resolvedPhase.value,
  })
})
const statusSummaryTitle = computed(() => (
  i18next.t('nocodeEditorAiConfirmationCard.aiHandling')
))
const statusSummaryText = computed(() => (
  aiHandlingText.value
))
const stateSummaryTitle = computed(() => (
  isLoadingPhase.value
    ? i18next.t('nocodeEditorAiConfirmationCard.processing')
    : i18next.t('nocodeEditorAiConfirmationCard.errorDetails')
))
const stateSummaryText = computed(() => {
  if (isLoadingPhase.value) {
    return String(props.stateMessage || props.block.message || i18next.t('nocodeEditorAiConfirmationCard.generatingBlueprint')).trim()
      || i18next.t('nocodeEditorAiConfirmationCard.generatingBlueprint')
  }
  if (isErrorPhase.value) {
    return String(props.stateMessage || props.block.error || props.block.message || i18next.t('nocodeEditorAiConfirmationCard.blueprintGenerationFailed')).trim()
      || i18next.t('nocodeEditorAiConfirmationCard.blueprintGenerationFailed')
  }
  return ''
})
const showStateSummary = computed(() => Boolean(isLoadingPhase.value || isErrorPhase.value))

const handleSelectOption = (payload: {
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  if (props.readonlyVersion) {
    return
  }

  emit('select-option', {
    block: props.block,
    question: payload.question,
    option: payload.option,
  })
}

const handlePendingPrimaryAction = () => {
  if (props.readonlyVersion || props.actionDisabled) {
    return
  }

  emit('continue-defaults', props.block)
}

const handlePrimaryAction = () => {
  if (
    props.readonlyVersion
    || props.actionDisabled
    || isLoadingPhase.value
    || isErrorPhase.value
    || (isCompletedActionPhase.value && !isCompletedContinuationActionable.value)
  ) {
    return
  }

  if (inlineBatchConfirmLabel.value) {
    emit('submit-staged-responses', props.block)
    return
  }

  handlePendingPrimaryAction()
}

const handleSecondaryAction = () => {
  if (props.readonlyVersion || props.actionDisabled || isCompletedActionPhase.value || isLoadingPhase.value || isErrorPhase.value) {
    return
  }

  emit('continue-defaults', props.block)
}

const handleFocusInput = (question: AiArtifactConfirmationQuestion) => {
  if (props.readonlyVersion) {
    return
  }

  emit('focus-input', {
    block: props.block,
    question,
  })
}

const handleReviewAction = () => {
  emit('open', props.block)
}

const handlePreviewAction = () => {
  emit('preview', props.block)
}
</script>

<style scoped lang="scss">
.ai-confirmation-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  border-radius: 24px;
  border: 1px solid #dce8f6;
  box-shadow: 0 6px 14px rgba(36, 77, 134, 0.05);
  margin-bottom: 6px;
}

.ai-confirmation-card__head {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
}

.ai-confirmation-card__head.is-pending {
  align-items: flex-start;
}

.ai-confirmation-card__title-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.ai-confirmation-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.4;
  white-space: nowrap;
}

.ai-confirmation-card__badge {
  background: rgba(255, 190, 92, 0.16);
  color: #b67310;
}

.ai-confirmation-card__title {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 800;
  color: #173150;
}

.ai-confirmation-card__version {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: #eef3f9;
  color: #607791;
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
  white-space: nowrap;
}

.ai-confirmation-card__head.is-pending .ai-confirmation-card__title {
  flex: 1;
}

.ai-confirmation-card__section,
.ai-confirmation-card__section-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-confirmation-card__section-card {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #f2f3f5;
  background: #f7f8fa;
}

.ai-confirmation-card__section-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
  color: #1d2129;
}

.ai-confirmation-card__section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-confirmation-card__section--questions,
.ai-confirmation-card__section--actions {
  gap: 12px;
}

.ai-confirmation-card__section--questions > .ai-confirmation-card__section-title,
.ai-confirmation-card__section--actions > .ai-confirmation-card__section-title {
  font-size: 16px;
  line-height: 24px;
}

.ai-confirmation-card__question-title-row > .ai-confirmation-card__section-title {
  font-size: 16px;
  line-height: 24px;
}

.ai-confirmation-card__section-copy,
.ai-confirmation-card__section-hint {
  margin: 0;
  font-size: 14px;
  line-height: 22px;
  color: #4e5969;
}

.ai-confirmation-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ai-confirmation-card__actions.is-pending-stacked {
  grid-template-columns: 1fr;
}

.ai-confirmation-card__actions.is-pending-stacked :deep(.el-button) {
  width: 100%;
  min-height: 52px;
}

.ai-confirmation-card__actions.is-pending-stacked :deep(.el-button + .el-button) {
  margin-left: 0;
}

.ai-confirmation-card__primary,
.ai-confirmation-card__secondary {
  min-height: 40px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}

.ai-confirmation-card__primary.is-ready {
  border-color: transparent;
  background: #0089ff;
  box-shadow: 0 12px 24px rgba(20, 103, 216, 0.24);
}

.ai-confirmation-card__actions.is-pending-stacked :deep(.ai-confirmation-card__primary.el-button.is-disabled),
.ai-confirmation-card__actions.is-pending-stacked :deep(.ai-confirmation-card__primary.el-button[disabled]) {
  opacity: 1;
  color: #ffffff;
  border-color: transparent;
  background: #8ecaff;
  box-shadow: none;
}

.ai-confirmation-card__actions.is-pending-stacked :deep(.ai-confirmation-card__secondary.el-button) {
  color: #4e5969;
  border-color: #d9dde4;
  background: #ffffff;
}

.ai-confirmation-card__actions-hint {
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f7f8fa;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.ai-confirmation-card__link-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ai-confirmation-card__review-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: #1d63cf;
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  cursor: pointer;
}

.ai-confirmation-card__link-line.is-pending-review {
  justify-content: flex-start;
}

.ai-confirmation-card__section-preview-link {
  flex-shrink: 0;
}

.ai-confirmation-card__section-review-link {
  flex-shrink: 0;
}

.ai-confirmation-card__compact-list {
  margin: 0;
  color: #4e5969;
  font-size: 14px;
  line-height: 22px;
}

.ai-confirmation-card__questions {
  :deep(.ai-confirmation-question-list__item) {
    border-radius: 18px;
  }
}

.ai-confirmation-card__section-card--ai-handling {
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  border-color: #dce8f6;
  background: #f6fbff;
}

@media (max-width: 768px) {
  .ai-confirmation-card__actions {
    grid-template-columns: 1fr;
  }

  .ai-confirmation-card__link-line {
    flex-direction: column;
    align-items: flex-start;
  }

  .ai-confirmation-card__section-title-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
