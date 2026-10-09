<template>
  <div class="ai-blueprint-preview-workbench">
    <nocode-editor-ai-blueprint-shelf
      v-if="resolvedWorkbenchItems.length"
      :items="resolvedWorkbenchItems"
      :history-items="resolvedWorkbenchHistoryItems"
      show-all-statuses
      :app-name="resolvedAppName"
      :initial-focus-card-key="previewFocusCardKey"
      :flow-artifact-blocks="flowArtifactBlocks"
      :applying-id="applyingId"
      :allow-review-actions="canReviewBlueprintActions"
      :show-batch-apply-action="canApply"
      :get-confirmation-response-drafts="resolveResponseDrafts"
      :get-active-confirmation-input-question-ids="resolveActiveInputQuestionIds"
      :get-inline-confirmation-note-question-ids="resolveInlineNoteQuestionIds"
      :get-flow-confirmation-response-drafts="resolveFlowResponseDrafts"
      :get-flow-active-confirmation-input-question-ids="resolveFlowActiveInputQuestionIds"
      :get-flow-inline-confirmation-note-question-ids="resolveFlowInlineNoteQuestionIds"
      :can-apply-flow-artifact="resolveCanApplyFlowArtifact"
      :is-applying-flow-artifact="resolveIsApplyingFlowArtifact"
      :submitting-confirmation="submittingConfirmation"
      preview-mode
      @apply="emit('apply-blueprint')"
      @apply-pending-batch="emit('apply-blueprint')"
      @continue="emit('continue-blueprint-adjustment')"
      @apply-flow="emit('apply-flow', $event)"
      @continue-flow-defaults="emit('continue-flow-defaults', $event)"
      @select-confirmation-option="emit('select-confirmation-option', $event)"
      @toggle-note-input="handleToggleNoteInput"
      @update-note="handleUpdateNote"
      @submit-confirmation-responses="handleSubmitConfirmationResponses"
      @toggle-flow-note-input="emit('toggle-flow-note-input', $event)"
      @update-flow-note="emit('update-flow-note', $event)"
      @submit-flow-confirmation-responses="emit('submit-flow-confirmation-responses', $event)"
      @open-generated-page="emit('open-generated-page', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import type { AiAssistantArtifactBlock } from '@common/types/ai'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import { isBlueprintAppliedPhase } from '@common/utils/nocodeEditorBlueprintLifecycle'
import { type BlueprintWorkbenchMode } from '../blueprintWorkbenchViewModel'
import {
  buildBlueprintPreviewSnapshot,
  resolveBlueprintPreviewInitialFocusCardKey,
} from '../blueprintPreviewArtifactAdapter'
import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiGeneratedBlueprintPageTarget,
  NocodeEditorAiStageBlueprintDisplayItem,
} from '../types'
import type { NocodeEditorAiConfirmationResponseDraftMap } from './confirmationInteraction'
import type { AiArtifactConfirmationQuestion } from '@renderer/views/nocode/components/ai/artifactBlock'
import NocodeEditorAiBlueprintShelf from './NocodeEditorAiBlueprintShelf.vue'

const props = defineProps({
  block: {
    type: Object as PropType<AiAssistantArtifactBlock | null>,
    default: null,
  },
  appName: {
    type: String,
    default: '',
  },
  workbenchItems: {
    type: Array as PropType<NocodeEditorAiStageBlueprintDisplayItem[]>,
    default: () => [],
  },
  workbenchHistoryItems: {
    type: Array as PropType<NocodeEditorAiStageBlueprintDisplayItem[]>,
    default: () => [],
  },
  blueprintPreviewFocusCardKey: {
    type: String,
    default: '',
  },
  flowArtifactBlocks: {
    type: Array as PropType<NocodeEditorAiArtifactBlock[]>,
    default: () => [],
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
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'apply-blueprint'): void
  (event: 'apply-flow', block: NocodeEditorAiArtifactBlock): void
  (event: 'continue-blueprint-adjustment'): void
  (event: 'continue-flow-defaults', block: NocodeEditorAiArtifactBlock): void
  (event: 'select-confirmation-option', payload: {
    block: AiAssistantArtifactBlock
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }): void
  (event: 'toggle-note-input', question: AiArtifactConfirmationQuestion): void
  (event: 'toggle-flow-note-input', payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
  }): void
  (event: 'update-note', payload: {
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
  (event: 'update-flow-note', payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
  (event: 'submit-confirmation-responses'): void
  (event: 'submit-flow-confirmation-responses', block: NocodeEditorAiArtifactBlock): void
  (event: 'open-generated-page', payload: NocodeEditorAiGeneratedBlueprintPageTarget): void
}>()

const snapshot = computed(() => buildBlueprintPreviewSnapshot({
  block: props.block,
  appName: props.appName,
}))

const resolvedWorkbenchItems = computed(() => (
  props.workbenchItems.length
    ? props.workbenchItems
    : snapshot.value
      ? [snapshot.value.item]
      : []
))
const resolvedWorkbenchHistoryItems = computed(() => (
  props.workbenchItems.length
    ? props.workbenchHistoryItems
    : []
))
const resolvedAppName = computed(() => (
  props.workbenchItems.length
    ? props.appName
    : snapshot.value?.appName || props.appName
))
const previewFocusCardKey = computed(() => {
  const explicitFocusCardKey = String(props.blueprintPreviewFocusCardKey || '').trim()
  if (explicitFocusCardKey) {
    return explicitFocusCardKey
  }

  return props.workbenchItems.length
    ? resolveBlueprintPreviewInitialFocusCardKey({
      block: props.block,
      appName: props.appName,
      workbenchItems: props.workbenchItems,
    })
    : ''
})
const previewMode = computed<BlueprintWorkbenchMode>(() => (
  isBlueprintAppliedPhase(snapshot.value?.item.phase) ? 'generated' : 'review'
 ))
const canReviewBlueprintActions = computed(() => Boolean(props.canApply || props.canContinue))
const applyingId = computed(() => {
  if (!props.applying || !resolvedWorkbenchItems.value.length) {
    return ''
  }

  const pendingItems = resolvedWorkbenchItems.value.filter(item => (
    item.itemKind === 'ai_blueprint' && !isBlueprintAppliedPhase(item.phase)
  ))
  if (pendingItems.length > 1) {
    return 'batch'
  }

  return pendingItems[0]?.id || resolvedWorkbenchItems.value[0]?.id || ''
})
const flowArtifactBlocks = computed(() => props.flowArtifactBlocks || [])

const resolveResponseDrafts = () => props.responseDrafts
const resolveActiveInputQuestionIds = () => props.activeInputQuestionIds
const resolveInlineNoteQuestionIds = () => props.inlineNoteQuestionIds
const resolveFlowResponseDrafts = (block: NocodeEditorAiArtifactBlock) => (
  props.getFlowConfirmationResponseDrafts?.(block) || {}
)
const resolveFlowActiveInputQuestionIds = (block: NocodeEditorAiArtifactBlock) => (
  props.getFlowActiveConfirmationInputQuestionIds?.(block) || []
)
const resolveFlowInlineNoteQuestionIds = (block: NocodeEditorAiArtifactBlock) => (
  props.getFlowInlineConfirmationNoteQuestionIds?.(block) || []
)
const resolveCanApplyFlowArtifact = (block: NocodeEditorAiArtifactBlock) => (
  Boolean(props.canApplyFlowArtifact?.(block))
)
const resolveIsApplyingFlowArtifact = (block: NocodeEditorAiArtifactBlock) => (
  Boolean(props.isApplyingFlowArtifact?.(block))
)

const handleToggleNoteInput = (payload: {
  question: AiArtifactConfirmationQuestion
}) => {
  emit('toggle-note-input', payload.question)
}

const handleUpdateNote = (payload: {
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  emit('update-note', payload)
}

const handleSubmitConfirmationResponses = () => {
  emit('submit-confirmation-responses')
}
</script>

<style scoped lang="scss">
.ai-blueprint-preview-workbench {
  width: 100%;
  min-height: 0;
}
</style>
