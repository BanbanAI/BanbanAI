<template>
  <section class="workbench-ai-handoff-card" :aria-label="$t('workbenchAiAppBuilderHandoffCard.appCreationCard')">
    <div class="workbench-ai-handoff-card__header">
      <div class="workbench-ai-handoff-card__eyebrow">
        <span class="workbench-ai-handoff-card__dot" aria-hidden="true"></span>
        <span>{{ creationModeLabel }}</span>
      </div>
    </div>

    <div class="workbench-ai-handoff-card__body">
      <h3 class="workbench-ai-handoff-card__title">{{ handoff.title }}</h3>
      <p v-if="displaySummary" class="workbench-ai-handoff-card__summary">{{ displaySummary }}</p>

      <div
        v-if="handoff.materialsSummary"
        class="workbench-ai-handoff-card__meta workbench-ai-handoff-card__meta--attachment"
      >
        <span class="workbench-ai-handoff-card__pill is-muted workbench-ai-handoff-card__attachment-pill">
          {{ handoff.materialsSummary }}
        </span>
        <button
          v-if="showAddAttachmentAction"
          type="button"
          class="workbench-ai-handoff-card__attachment-action"
          :disabled="attachmentActionDisabled"
          @click="handleAddAttachmentToComposer"
        >{{ $t('workbenchAiAppBuilderHandoffCard.addToInput') }}</button>
      </div>

      <div v-if="recognizedTargetSummary" class="workbench-ai-handoff-card__meta">
        <span class="workbench-ai-handoff-card__pill is-muted">
          {{ recognizedTargetSummary }}
        </span>
      </div>

      <div v-if="statusHint" class="workbench-ai-handoff-card__meta">
        <span class="workbench-ai-handoff-card__pill is-status">
          {{ statusHint }}
        </span>
      </div>

      <div v-if="resolveHint" class="workbench-ai-handoff-card__meta">
        <span class="workbench-ai-handoff-card__hint">{{ resolveHint }}</span>
      </div>
    </div>

    <div
      v-if="showFooter"
      class="workbench-ai-handoff-card__footer"
    >
      <div
        class="workbench-ai-handoff-card__footer-actions"
        :class="{ 'workbench-ai-handoff-card__footer-actions--split': footerActionCount > 1 }"
      >
        <template v-if="showClarification">
          <button
            v-for="option in clarificationOptions"
            :key="option.value"
            type="button"
            class="workbench-ai-handoff-card__cta"
            :class="resolveFooterActionClass(option.value)"
            :disabled="actionDisabled"
            @click="handleResolve(option.value)"
          >
            <span>{{ option.label }}</span>
          </button>
        </template>
        <button
          v-else-if="showPrimaryAction"
          type="button"
          class="workbench-ai-handoff-card__cta workbench-ai-handoff-card__cta--primary"
          :disabled="actionDisabled"
          @click="handlePrimaryAction"
        >
          <span>{{ primaryActionLabel }}</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { AppBuilderCreationMode } from '@common/types/appBuilderHandoff'
import { computed, ref, watch } from 'vue'
import i18next from 'i18next'
import {
  buildWorkbenchAppBuilderHandoffResolvePayload,
  resolveWorkbenchAppBuilderHandoffCandidateKey,
  shouldShowWorkbenchAppBuilderHandoffClarification,
} from '../workbenchAiInsightPanelModel'
import type {
  WorkbenchAiAppBuilderHandoffPreview,
  WorkbenchAiAppBuilderHandoffResolvePayload,
} from '../workbenchAiInsightPanelModel'

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  handoff: WorkbenchAiAppBuilderHandoffPreview
  submitting?: boolean
  clarifying?: boolean
  readonly?: boolean
}>(), {
  submitting: false,
  clarifying: false,
  readonly: false,
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'continue-create', handoff: WorkbenchAiAppBuilderHandoffPreview): void
  (event: 'add-attachment-to-composer', attachment: NonNullable<WorkbenchAiAppBuilderHandoffPreview['excelAttachment']>): void
  (event: 'resolve-creation-mode', payload: WorkbenchAiAppBuilderHandoffResolvePayload): void
  (event: 'request-target-app-selection', payload: {
    handoff: WorkbenchAiAppBuilderHandoffPreview
    creationMode: Exclude<AppBuilderCreationMode, 'undecided'>
    targetAppId?: string
    targetAppName?: string
  }): void
}>()

const getInvalidResolveHint = () => i18next.t('workbenchAiAppBuilderHandoffCard.invalidResolveHint')
const defaultOptions = computed(() => [
  { value: 'create_new_app' as const, label: i18next.t('workbenchAiAppBuilderHandoffCard.createNewApp') },
  { value: 'extend_existing_app' as const, label: i18next.t('workbenchAiAppBuilderHandoffCard.selectExistingApp') },
])

const selectedCandidateKey = ref('')
const resolveHint = ref('')
const summarySnapshot = ref('')

const candidateApps = computed(() => props.handoff.candidateApps || [])
const actionDisabled = computed(() => (
  props.readonly
  || props.submitting
  || (props.handoff.status && props.handoff.status !== 'ready')
))
const attachmentActionDisabled = computed(() => (
  props.readonly
  || props.submitting
))
const showAddAttachmentAction = computed(() => Boolean(props.handoff.excelAttachment))
const showClarification = computed(() => (
  !statusHint.value
  && shouldShowWorkbenchAppBuilderHandoffClarification(props.handoff, props.clarifying)
))
const showPrimaryAction = computed(() => !showClarification.value)

const targetAppLabel = computed(() => (
  props.handoff.targetApp?.appName
  || props.handoff.targetApp?.appId
  || ''
))

const recognizedTargetSummary = computed(() => {
  if (targetAppLabel.value) {
    return i18next.t('workbenchAiAppBuilderHandoffCard.recognizedTargetApp', { app: targetAppLabel.value })
  }
  if (candidateApps.value.length > 0) {
    return i18next.t('workbenchAiAppBuilderHandoffCard.recognizedTargetCandidates', {
      apps: candidateApps.value.map(item => item.appName).join(' / '),
    })
  }
  return ''
})

const statusHint = computed(() => {
  if (props.handoff.status === 'continuing') {
    return i18next.t('workbenchAiAppBuilderHandoffCard.continuedElsewhere')
  }
  if (props.handoff.status === 'abandoned') {
    return i18next.t('workbenchAiAppBuilderHandoffCard.expired')
  }
  return ''
})

const creationModeLabel = computed(() => {
  if (props.handoff.creationMode === 'create_new_app') {
    return i18next.t('workbenchAiAppBuilderHandoffCard.createNewApp')
  }
  if (props.handoff.creationMode === 'extend_existing_app') {
    return i18next.t('workbenchAiAppBuilderHandoffCard.addToExistingApp')
  }
  return i18next.t('workbenchAiAppBuilderHandoffCard.pendingCreationMode')
})

const needsTargetAppSelection = computed(() => (
  props.handoff.creationMode === 'extend_existing_app'
  && !props.handoff.targetApp?.appId
  && !props.handoff.clarification?.options?.length
))

const clarificationOptions = computed(() => (
  props.handoff.clarification?.options?.length
    ? props.handoff.clarification.options
    : needsTargetAppSelection.value
      ? [{ value: 'extend_existing_app' as const, label: i18next.t('workbenchAiAppBuilderHandoffCard.selectExistingApp') }]
      : defaultOptions.value
))

const footerActionCount = computed(() => (
  showClarification.value ? clarificationOptions.value.length : (showPrimaryAction.value ? 1 : 0)
))

const showFooter = computed(() => (
  !props.readonly
  && footerActionCount.value > 0
))

const primaryActionLabel = computed(() => {
  if (props.submitting || props.handoff.status === 'continuing') {
    return i18next.t('workbenchAiAppBuilderHandoffCard.processing')
  }
  if (props.handoff.status === 'consumed') {
    if (props.handoff.creationMode === 'create_new_app') {
      return i18next.t('workbenchAiAppBuilderHandoffCard.createdApp')
    }
    if (props.handoff.creationMode === 'extend_existing_app') {
      return i18next.t('workbenchAiAppBuilderHandoffCard.addedToExistingApp')
    }
    return i18next.t('workbenchAiAppBuilderHandoffCard.processed')
  }
  if (props.handoff.status === 'abandoned') {
    return i18next.t('workbenchAiAppBuilderHandoffCard.expired')
  }
  return i18next.t('workbenchAiAppBuilderHandoffCard.continueCreate')
})

const displaySummary = computed(() => {
  if (summarySnapshot.value) {
    return summarySnapshot.value
  }
  if (!showClarification.value) {
    return props.handoff.summary || ''
  }

  if (props.handoff.clarification?.question) {
    return props.handoff.clarification.question
  }

  if (needsTargetAppSelection.value) {
    return i18next.t('workbenchAiAppBuilderHandoffCard.selectTargetBeforeContinue')
  }

  return i18next.t('workbenchAiAppBuilderHandoffCard.confirmCreationMode')
})

watch(
  () => props.handoff.handoffId,
  () => {
    selectedCandidateKey.value = ''
    resolveHint.value = ''
    summarySnapshot.value = props.handoff.clarification?.question
      || (needsTargetAppSelection.value
        ? i18next.t('workbenchAiAppBuilderHandoffCard.selectTargetBeforeContinue')
        : props.handoff.summary || '')
  },
  { immediate: true },
)

const requestTargetAppSelection = (creationMode: Exclude<AppBuilderCreationMode, 'undecided'>) => {
  const selectedPayload = buildWorkbenchAppBuilderHandoffResolvePayload({
    handoff: props.handoff,
    creationMode,
    selectedCandidateKey: selectedCandidateKey.value,
  })
  emit('request-target-app-selection', {
    handoff: props.handoff,
    creationMode,
    ...(selectedPayload?.targetAppId ? { targetAppId: selectedPayload.targetAppId } : {}),
    ...(selectedPayload?.targetAppName ? { targetAppName: selectedPayload.targetAppName } : {}),
  })
}

const handleResolve = (creationMode: Exclude<AppBuilderCreationMode, 'undecided'>) => {
  if (creationMode === 'extend_existing_app' && !props.handoff.targetApp?.appId) {
    requestTargetAppSelection(creationMode)
    return
  }

  const payload = buildWorkbenchAppBuilderHandoffResolvePayload({
    handoff: props.handoff,
    creationMode,
    selectedCandidateKey: selectedCandidateKey.value,
  })
  if (!payload) {
    resolveHint.value = getInvalidResolveHint()
    return
  }

  emit('resolve-creation-mode', payload)
}

const handlePrimaryAction = () => {
  if (needsTargetAppSelection.value) {
    requestTargetAppSelection('extend_existing_app')
    return
  }

  emit('continue-create', props.handoff)
}

const handleAddAttachmentToComposer = () => {
  if (!props.handoff.excelAttachment) {
    return
  }

  emit('add-attachment-to-composer', props.handoff.excelAttachment)
}

const resolveFooterActionClass = (creationMode: Exclude<AppBuilderCreationMode, 'undecided'>) => (
  creationMode === 'create_new_app'
    ? 'workbench-ai-handoff-card__cta--primary'
    : 'workbench-ai-handoff-card__cta--secondary'
)

void resolveWorkbenchAppBuilderHandoffCandidateKey
</script>

<style scoped lang="scss">
.workbench-ai-handoff-card {
  width: 100%;
  border: 1px solid rgba(40, 92, 141, 0.18);
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(69, 142, 196, 0.16), transparent 36%),
    linear-gradient(180deg, #f9fcff 0%, #ffffff 100%);
  box-shadow: 0 16px 36px rgba(22, 57, 89, 0.08);
  color: #1d2129;
  overflow: hidden;
}

.workbench-ai-handoff-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 0;
}

.workbench-ai-handoff-card__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #28608f;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.workbench-ai-handoff-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #2f8ac8;
  box-shadow: 0 0 0 4px rgba(47, 138, 200, 0.12);
}

.workbench-ai-handoff-card__body {
  padding: 10px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.workbench-ai-handoff-card__title {
  margin: 0;
  color: #17233d;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.workbench-ai-handoff-card__summary {
  margin: 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
}

.workbench-ai-handoff-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.workbench-ai-handoff-card__meta--attachment {
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.workbench-ai-handoff-card__pill {
  border: 0;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(47, 138, 200, 0.1);
  color: #28608f;
  font-size: 12px;
  line-height: 18px;
}

.workbench-ai-handoff-card__pill.is-muted {
  background: rgba(78, 89, 105, 0.08);
  color: #4e5969;
}

.workbench-ai-handoff-card__attachment-pill {
  min-width: 0;
  flex: 1;
}

.workbench-ai-handoff-card__attachment-action {
  border: 0;
  background: transparent;
  color: #5b6b82;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  padding: 0;
  cursor: var(--cursor-pointer);
  flex-shrink: 0;
}

.workbench-ai-handoff-card__attachment-action:hover:not(:disabled) {
  color: #1677ff;
}

.workbench-ai-handoff-card__pill.is-status {
  background: rgba(217, 119, 6, 0.12);
  color: #9a6700;
}

.workbench-ai-handoff-card__hint {
  color: #c45656;
  font-size: 12px;
  line-height: 18px;
}

.workbench-ai-handoff-card__footer {
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.workbench-ai-handoff-card__footer-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.workbench-ai-handoff-card__footer-actions--split {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.workbench-ai-handoff-card__cta {
  border: 1px solid transparent;
  min-height: 36px;
  padding: 8px 12px;
  width: 100%;
  border-radius: 10px;
  cursor: var(--cursor-pointer);
  transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.workbench-ai-handoff-card__cta--primary {
  background: linear-gradient(135deg, #256c9f 0%, #2f8ac8 100%);
  color: #ffffff;
  box-shadow: 0 10px 18px rgba(47, 138, 200, 0.2);
}

.workbench-ai-handoff-card__cta--secondary {
  background: #ffffff;
  border-color: rgba(47, 138, 200, 0.3);
  color: #28608f;
  box-shadow: none;
}

.workbench-ai-handoff-card__cta--primary:hover:not(:disabled),
.workbench-ai-handoff-card__cta--secondary:hover:not(:disabled) {
  transform: translateY(-1px);
}

.workbench-ai-handoff-card__cta--secondary:hover:not(:disabled) {
  background: rgba(47, 138, 200, 0.06);
  border-color: rgba(47, 138, 200, 0.42);
}

.workbench-ai-handoff-card__cta:disabled,
.workbench-ai-handoff-card__attachment-action:disabled {
  cursor: not-allowed;
  opacity: 1;
}

.workbench-ai-handoff-card__cta:disabled {
  background: #e5e6eb;
  color: #86909c;
  border-color: #e5e6eb;
  box-shadow: none;
  transform: none;
}

.workbench-ai-handoff-card__attachment-action:disabled {
  color: #b0b8c4;
}
</style>
