<template>
  <section class="ai-blueprint-workbench-detail-dock">
    <div class="ai-blueprint-workbench-detail-dock__head">
      <div class="ai-blueprint-workbench-detail-dock__head-copy">
        <h3 class="ai-blueprint-workbench-detail-dock__title">{{ detailTitle }}</h3>
        <div v-if="card" class="ai-blueprint-workbench-detail-dock__subtitle-row">
          <span class="ai-blueprint-workbench-detail-dock__subtitle">{{ card.title }}</span>
          <span class="ai-blueprint-workbench-detail-dock__status-tag">{{ card.statusLabel }}</span>
        </div>
        <p
          v-if="card?.summary"
          class="ai-blueprint-workbench-detail-dock__description"
        >
          {{ card.summary }}
        </p>
        <p
          v-else
          class="ai-blueprint-workbench-detail-dock__description"
        >
          {{ headDescription }}
        </p>
      </div>
      <div v-if="card" class="ai-blueprint-workbench-detail-dock__head-actions">
        <el-button
          text
          size="small"
          class="ai-blueprint-workbench-detail-dock__preview-button"
          :disabled="!fullPreviewBlock"
          @click="fullPreviewVisible = true"
        >
          {{ previewButtonText }}
        </el-button>
      </div>
    </div>

    <div v-if="card" class="ai-blueprint-workbench-detail-dock__body">
      <nocode-editor-ai-blueprint-detail-sections
        :forms="card.item.blueprint.forms || []"
        :formula-apply-forms="card.item.applyResult?.forms || []"
        :selected-form-key="card.formKey"
        anchor-prefix="blueprint-workbench-detail-form"
        :focus-selected-only="true"
      />

      <nocode-editor-ai-blueprint-decision-panel
        :block="fullPreviewBlock"
        :can-apply="canReviewBlueprintActions"
        :can-continue="canReviewBlueprintActions"
        :applying="applying"
        :show-actions="false"
        :response-drafts="responseDrafts"
        :active-input-question-ids="activeInputQuestionIds"
        :inline-note-question-ids="inlineNoteQuestionIds"
        :submitting-confirmation="submittingConfirmation"
        :draft-persistence-state="card.item.draftPersistenceState || null"
        :show-generated-open-action="true"
        @open-generated-page="handleOpenGeneratedPage"
        @locate-draft-issue="emit('locate-draft-issue', $event)"
      />
    </div>

    <div v-else class="ai-blueprint-workbench-detail-dock__empty">{{ $t('nocodeEditorAiBlueprintWorkbenchDetailDock.selectBlueprintCardTip') }}</div>

    <ai-artifact-preview-dialog
      v-model="fullPreviewVisible"
      :block="fullPreviewBlock"
      :app-name="appName"
      :can-apply-blueprint="canReviewBlueprintActions"
      :can-continue-blueprint="canReviewBlueprintActions"
      :applying-blueprint="applying"
      :confirmation-response-drafts="responseDrafts"
      :active-confirmation-input-question-ids="activeInputQuestionIds"
      :inline-confirmation-note-question-ids="inlineNoteQuestionIds"
      :submitting-confirmation="submittingConfirmation"
      @apply-blueprint="handlePreviewApply"
      @continue-blueprint-adjustment="handlePreviewContinue"
      @select-confirmation-option="handlePreviewSelectConfirmationOption"
      @toggle-note-input="handlePreviewToggleNoteInput"
      @update-note="handlePreviewUpdateNote"
      @submit-confirmation-responses="handlePreviewSubmitConfirmationResponses"
    />
  </section>
</template>

<script setup lang="ts">
import i18next from 'i18next'
import { computed, ref, type PropType } from 'vue'
import type { AiAssistantArtifactBlock, AiAssistantBlueprintArtifactBlock } from '@common/types/ai'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import { isBlueprintStagedPhase } from '@common/utils/nocodeEditorBlueprintLifecycle'
import AiArtifactPreviewDialog from '@renderer/views/nocode/components/ai/AiArtifactPreviewDialog.vue'
import type { AiArtifactConfirmationQuestion } from '@renderer/views/nocode/components/ai/artifactBlock'
import type {
  BlueprintWorkbenchCard,
  BlueprintWorkbenchMode,
} from '../blueprintWorkbenchViewModel'
import type {
  NocodeEditorAiDraftActionIssue,
  NocodeEditorAiGeneratedBlueprintPageTarget,
} from '../types'
import { buildBlueprintArtifactVersionFromParts } from '../blueprintArtifactIdentity'
import type { NocodeEditorAiConfirmationResponseDraftMap } from './confirmationInteraction'
import NocodeEditorAiBlueprintDecisionPanel from './NocodeEditorAiBlueprintDecisionPanel.vue'
import NocodeEditorAiBlueprintDetailSections from './NocodeEditorAiBlueprintDetailSections.vue'

const props = defineProps({
  card: {
    type: Object as PropType<BlueprintWorkbenchCard | null>,
    default: null,
  },
  mode: {
    type: String as PropType<BlueprintWorkbenchMode>,
    required: true,
  },
  appName: {
    type: String,
    default: '',
  },
  applyingId: {
    type: String,
    default: '',
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
  (event: 'open-generated-page', payload: NocodeEditorAiGeneratedBlueprintPageTarget): void
  (event: 'locate-draft-issue', issue: NocodeEditorAiDraftActionIssue): void
}>()

const fullPreviewVisible = ref(false)
const fullPreviewBlock = computed<AiAssistantArtifactBlock | null>(() => (
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
      title: props.card.item.blueprint.title || props.card.title || i18next.t('nocodeEditorAiBlueprintWorkbenchDetailDock.blueprintDraft'),
      summary: props.card.item.blueprint.summary || props.card.summary,
      blueprint: props.card.item.blueprint,
      confirmation: (props.card.item.blueprint as { confirmation?: AiAssistantBlueprintArtifactBlock['confirmation'] })?.confirmation || undefined,
      applyResult: props.card.item.applyResult || null,
      draftPersistenceState: props.card.item.draftPersistenceState || null,
    }
))

const canReviewBlueprintActions = computed(() => (
  props.mode === 'review'
  && Boolean(props.card)
  && isBlueprintStagedPhase(props.card.item.phase)
))

const applying = computed(() => Boolean(
  props.card
  && isBlueprintStagedPhase(props.card.item.phase)
  && (props.applyingId === props.card.item.id || props.applyingId === 'batch'),
))

const handlePreviewApply = () => {
  if (props.card) {
    emit('apply', props.card.item)
  }
}

const handlePreviewContinue = () => {
  if (props.card) {
    emit('continue', props.card.item)
  }
}

const handlePreviewSelectConfirmationOption = (payload: {
  question: AiArtifactConfirmationQuestion
  option: NocodeEditorAiConfirmQuestionOption
}) => {
  const block = fullPreviewBlock.value
  if (!block) {
    return
  }

  emit('select-confirmation-option', {
    block,
    question: payload.question,
    option: payload.option,
  })
}

const handlePreviewToggleNoteInput = (question: AiArtifactConfirmationQuestion) => {
  const block = fullPreviewBlock.value
  if (!props.card || !block) {
    return
  }

  emit('toggle-note-input', {
    item: props.card.item,
    block,
    question,
  })
}

const handlePreviewUpdateNote = (payload: {
  question: AiArtifactConfirmationQuestion
  note: string
}) => {
  const block = fullPreviewBlock.value
  if (!props.card || !block) {
    return
  }

  emit('update-note', {
    item: props.card.item,
    block,
    question: payload.question,
    note: payload.note,
  })
}

const handlePreviewSubmitConfirmationResponses = () => {
  const block = fullPreviewBlock.value
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

  emit('open-generated-page', {
    item: props.card.item,
    formKey: props.card.form.formKey,
    tableName: props.card.form.tableName,
  })
}

const detailTitle = computed(() => (
  props.mode === 'generated'
    ? i18next.t('nocodeEditorAiBlueprintWorkbenchDetailDock.generatedResultDetails')
    : i18next.t('nocodeEditorAiBlueprintWorkbenchDetailDock.blueprintDetails')
))

const previewButtonText = computed(() => (
  props.mode === 'generated'
    ? i18next.t('nocodeEditorAiBlueprintWorkbenchDetailDock.viewGeneratedSnapshot')
    : i18next.t('nocodeEditorAiBlueprintWorkbenchDetailDock.viewFullBlueprint')
))

const headDescription = computed(() => {
  if (props.mode === 'generated') {
    return i18next.t('nocodeEditorAiBlueprintWorkbenchDetailDock.generatedHeadDescription')
  }

  return i18next.t('nocodeEditorAiBlueprintWorkbenchDetailDock.reviewHeadDescription')
})
</script>

<style scoped lang="scss">
.ai-blueprint-workbench-detail-dock {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 20px;
  border: 1px solid #dbe5f0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.98)),
    linear-gradient(140deg, rgba(31, 111, 255, 0.04), transparent 58%);
  box-shadow: 0 12px 28px rgba(27, 57, 92, 0.06);
}

.ai-blueprint-workbench-detail-dock__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ai-blueprint-workbench-detail-dock__head-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-blueprint-workbench-detail-dock__head-actions {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

.ai-blueprint-workbench-detail-dock__title {
  margin: 0;
  color: #1c2b3f;
  font-size: 18px;
  line-height: 1.4;
  font-weight: 800;
}

.ai-blueprint-workbench-detail-dock__subtitle-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.ai-blueprint-workbench-detail-dock__subtitle {
  font-size: 14px;
  line-height: 1.6;
  font-weight: 700;
  color: #203149;
}

.ai-blueprint-workbench-detail-dock__status-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 999px;
  background: #eef5ff;
  border: 1px solid #d7e4f5;
  color: #58708d;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 700;
}

.ai-blueprint-workbench-detail-dock__preview-button {
  padding: 6px 0;
  font-weight: 700;
}

.ai-blueprint-workbench-detail-dock__description,
.ai-blueprint-workbench-detail-dock__empty {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: #5f6f84;
}

.ai-blueprint-workbench-detail-dock__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
