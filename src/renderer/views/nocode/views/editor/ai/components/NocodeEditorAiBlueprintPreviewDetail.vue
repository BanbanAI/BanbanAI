<template>
  <div v-if="blueprint" class="ai-blueprint-preview-detail">
    <section class="ai-blueprint-preview-detail__hero">
      <div class="ai-blueprint-preview-detail__hero-main">
        <div class="ai-blueprint-preview-detail__title-row">
          <h2 class="ai-blueprint-preview-detail__title">{{ blueprintTitle }}</h2>
          <span v-if="versionLabel" class="ai-blueprint-preview-detail__version-tag">{{ versionLabel }}</span>
          <span
            v-if="statusTag"
            :class="['ai-blueprint-preview-detail__status', statusTagTone && `is-${statusTagTone}`]"
          >
            {{ statusTag }}
          </span>
        </div>
        <p v-if="blueprintSummary" class="ai-blueprint-preview-detail__summary">{{ blueprintSummary }}</p>
        <div class="ai-blueprint-preview-detail__meta">
          <span
            v-for="pill in heroMetaPills"
            :key="pill"
            class="ai-blueprint-preview-detail__meta-pill"
          >
            {{ pill }}
          </span>
        </div>
      </div>
    </section>

    <div :class="layoutClass">
      <aside v-if="showStructurePanel" class="ai-blueprint-preview-detail__rail">
        <section class="ai-blueprint-preview-detail__panel">
          <h3 class="ai-blueprint-preview-detail__panel-title">{{ $t('nocodeEditorAiBlueprintPreviewDetail.blueprintStructure') }}</h3>
          <div class="ai-blueprint-preview-detail__structure-list">
            <button
              v-for="(entry, index) in formEntries"
              :key="entry.anchorId"
              type="button"
              class="ai-blueprint-preview-detail__structure-item"
              @click="scrollToForm(entry.anchorId)"
            >
              <span class="ai-blueprint-preview-detail__structure-item-leading">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="ai-blueprint-preview-detail__structure-item-body">
                <span class="ai-blueprint-preview-detail__structure-item-label">{{ entry.form.tableName }}</span>
                <span class="ai-blueprint-preview-detail__structure-item-note">
                  {{ entry.form.groupName || $t('nocodeEditorAiBlueprintPreviewDetail.formStructure') }}
                </span>
              </span>
              <span class="ai-blueprint-preview-detail__structure-item-count">{{ getFieldCount(entry.form) }}{{ $t('nocodeEditorAiBlueprintPreviewDetail.itemCountSuffix') }}</span>
            </button>
          </div>
        </section>
      </aside>

      <main class="ai-blueprint-preview-detail__content">
        <nocode-editor-ai-blueprint-detail-sections
          :forms="forms"
          :formula-apply-forms="block.applyResult?.forms || []"
          anchor-prefix="blueprint-preview-form"
        />
      </main>

      <aside class="ai-blueprint-preview-detail__side">
        <div class="ai-blueprint-preview-detail__decision-panel-shell">
          <nocode-editor-ai-blueprint-decision-panel
            :block="block"
            :can-apply="canApply"
            :can-continue="canContinue"
            :applying="applying"
            :response-drafts="responseDrafts"
            :active-input-question-ids="activeInputQuestionIds"
            :inline-note-question-ids="inlineNoteQuestionIds"
            :submitting-confirmation="submittingConfirmation"
            @apply-blueprint="emit('apply-blueprint')"
            @continue-blueprint-adjustment="emit('continue-blueprint-adjustment')"
            @select-confirmation-option="emit('select-confirmation-option', $event)"
            @toggle-note-input="emit('toggle-note-input', $event)"
            @update-note="emit('update-note', $event)"
            @submit-confirmation-responses="emit('submit-confirmation-responses')"
          />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import i18next from 'i18next'
import type { AiAssistantArtifactBlock } from '@common/types/ai'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import {
  isBlueprintAppliedDraftPhase,
  isBlueprintAppliedPhase,
  normalizeBlueprintPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import {
  type AiArtifactConfirmationQuestion,
  resolveAiArtifactPendingQuestionCount,
  resolveAiArtifactVersionLabel,
  resolveBlueprintStatusTag,
  resolveBlueprintStatusTagTone,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import {
  getDraftPersistenceActionIssueCount,
  isDraftPersistenceStateResolved,
} from '../draftIssueActionList'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintForm,
} from '../types'
import type { NocodeEditorAiConfirmationResponseDraftMap } from './confirmationInteraction'
import NocodeEditorAiBlueprintDecisionPanel from './NocodeEditorAiBlueprintDecisionPanel.vue'
import NocodeEditorAiBlueprintDetailSections from './NocodeEditorAiBlueprintDetailSections.vue'

type BlueprintFormEntry = {
  anchorId: string
  form: NocodeEditorAiAppBlueprintForm
}

const props = defineProps({
  block: {
    type: Object as PropType<AiAssistantArtifactBlock>,
    required: true,
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
}>()

const blueprint = computed(() => {
  if (props.block.kind !== 'blueprint' || !props.block.blueprint) {
    return null
  }
  return props.block.blueprint as unknown as NocodeEditorAiAppBlueprint
})

const blueprintTitle = computed(() => (
  String(props.block.title || blueprint.value?.title || i18next.t('nocodeEditorAiBlueprintPreviewDetail.blueprintDraft')).trim()
  || i18next.t('nocodeEditorAiBlueprintPreviewDetail.blueprintDraft')
))

const versionLabel = computed(() => resolveAiArtifactVersionLabel(props.block))
const blueprintPhase = computed(() => normalizeBlueprintPhase(
  props.block.kind === 'blueprint' ? props.block.phase : null,
))
const statusTag = computed(() => resolveBlueprintStatusTag(props.block, {
  applying: props.applying,
}))
const statusTagTone = computed(() => resolveBlueprintStatusTagTone(statusTag.value))

const blueprintSummary = computed(() => (
  String(props.block.summary || blueprint.value?.summary || '').trim()
))

const draftIssueCount = computed(() => {
  const state = props.block.kind === 'blueprint' ? props.block.draftPersistenceState : null
  return getDraftPersistenceActionIssueCount(state)
})

const draftIssueResolved = computed(() => {
  const state = props.block.kind === 'blueprint' ? props.block.draftPersistenceState : null
  return isDraftPersistenceStateResolved(state)
})

const heroMetaPills = computed(() => {
  if (isBlueprintAppliedDraftPhase(blueprintPhase.value)) {
    return [
      i18next.t('nocodeEditorAiBlueprintPreviewDetail.formCount', { count: formCount.value }),
      i18next.t('nocodeEditorAiBlueprintPreviewDetail.fieldCount', { count: totalFieldCount.value }),
      draftIssueCount.value > 0
        ? i18next.t('nocodeEditorAiBlueprintPreviewDetail.draftIssueCount', { count: draftIssueCount.value })
        : i18next.t('nocodeEditorAiBlueprintPreviewDetail.draftPendingSave'),
      draftIssueResolved.value
        ? i18next.t('nocodeEditorAiBlueprintPreviewDetail.draftIssuesCompleted')
        : i18next.t('nocodeEditorAiBlueprintPreviewDetail.notSavedYet'),
    ]
  }

  if (isBlueprintAppliedPhase(blueprintPhase.value) && props.block.applyResult) {
    const result = props.block.applyResult
    return [
      i18next.t('nocodeEditorAiBlueprintPreviewDetail.formCount', { count: formCount.value }),
      i18next.t('nocodeEditorAiBlueprintPreviewDetail.fieldCount', { count: totalFieldCount.value }),
      i18next.t('nocodeEditorAiBlueprintPreviewDetail.createdReusedForms', {
        created: result.summary.formsCreated,
        reused: result.summary.formsReused,
      }),
      i18next.t('nocodeEditorAiBlueprintPreviewDetail.updatedFields', { count: result.summary.fieldsUpdated }),
    ]
  }

  if (hasOpenQuestions.value) {
    return [
      i18next.t('nocodeEditorAiBlueprintPreviewDetail.formCount', { count: formCount.value }),
      i18next.t('nocodeEditorAiBlueprintPreviewDetail.fieldCount', { count: totalFieldCount.value }),
      i18next.t('nocodeEditorAiBlueprintPreviewDetail.pendingQuestionCount', { count: pendingQuestionCount.value }),
    ]
  }

  return [
    i18next.t('nocodeEditorAiBlueprintPreviewDetail.formCount', { count: formCount.value }),
    i18next.t('nocodeEditorAiBlueprintPreviewDetail.fieldCount', { count: totalFieldCount.value }),
    props.canApply
      ? i18next.t('nocodeEditorAiBlueprintPreviewDetail.readyToGenerate')
      : i18next.t('nocodeEditorAiBlueprintPreviewDetail.detailsOnly'),
  ]
})

const pendingQuestionCount = computed(() => resolveAiArtifactPendingQuestionCount(props.block))

const hasOpenQuestions = computed(() => pendingQuestionCount.value > 0)

const forms = computed(() => (
  Array.isArray(blueprint.value?.forms) ? blueprint.value.forms : []
))

const formEntries = computed<BlueprintFormEntry[]>(() => (
  forms.value.map((form, index) => ({
    anchorId: `blueprint-preview-form-${index}`,
    form,
  }))
))

const getFieldCount = (form: NocodeEditorAiAppBlueprintForm) => form.fields?.length || 0

const totalFieldCount = computed(() => (
  forms.value.reduce((total, form) => total + getFieldCount(form), 0)
))

const formCount = computed(() => forms.value.length)
const showStructurePanel = computed(() => formCount.value > 1)
const layoutClass = computed(() => (
  showStructurePanel.value
    ? 'ai-blueprint-preview-detail__layout'
    : 'ai-blueprint-preview-detail__layout ai-blueprint-preview-detail__layout--without-rail'
))

const scrollToForm = (anchorId: string) => {
  document.getElementById(anchorId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}
</script>

<style scoped lang="scss">
.ai-blueprint-preview-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ai-blueprint-preview-detail__hero,
.ai-blueprint-preview-detail__panel {
  border-radius: 18px;
  border: 1px solid #dbe5f0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.98)),
    linear-gradient(140deg, rgba(31, 111, 255, 0.04), transparent 56%);
  box-shadow: 0 12px 28px rgba(27, 57, 92, 0.06);
}

.ai-blueprint-preview-detail__hero {
  padding: 20px 22px;
}

.ai-blueprint-preview-detail__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.ai-blueprint-preview-detail__title {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 800;
  color: #18293d;
}

.ai-blueprint-preview-detail__status,
.ai-blueprint-preview-detail__version-tag,
.ai-blueprint-preview-detail__meta-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  white-space: nowrap;
}

.ai-blueprint-preview-detail__status {
  padding: 6px 12px;
  background: rgba(31, 111, 255, 0.1);
  color: #2463d6;
  font-size: 12px;
  font-weight: 700;
}

.ai-blueprint-preview-detail__status.is-pending {
  background: rgba(255, 210, 122, 0.16);
  color: #c98c16;
}

.ai-blueprint-preview-detail__status.is-ready {
  background: rgba(31, 111, 255, 0.1);
  color: #2463d6;
}

.ai-blueprint-preview-detail__status.is-applying {
  background: rgba(92, 107, 255, 0.12);
  color: #4857d1;
}

.ai-blueprint-preview-detail__status.is-applied {
  background: rgba(83, 179, 126, 0.14);
  color: #2f8e57;
}

.ai-blueprint-preview-detail__version-tag {
  padding: 6px 12px;
  background: rgba(55, 60, 70, 0.08);
  color: #465468;
  font-size: 12px;
  font-weight: 700;
}

.ai-blueprint-preview-detail__summary {
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.8;
  color: #5d6e84;
}

.ai-blueprint-preview-detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
}

.ai-blueprint-preview-detail__meta-pill {
  padding: 7px 12px;
  background: #edf4ff;
  border: 1px solid #d7e4f5;
  color: #506883;
  font-size: 12px;
  font-weight: 600;
}

.ai-blueprint-preview-detail__layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 300px;
  gap: 18px;
  min-height: 0;
}

.ai-blueprint-preview-detail__layout--without-rail {
  grid-template-columns: minmax(0, 1fr) 300px;
}

.ai-blueprint-preview-detail__rail,
.ai-blueprint-preview-detail__content,
.ai-blueprint-preview-detail__side {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.ai-blueprint-preview-detail__content {
  overflow: auto;
}

.ai-blueprint-preview-detail__panel {
  padding: 18px;
}

.ai-blueprint-preview-detail__decision-panel-shell {
  position: sticky;
  top: 0;
}

.ai-blueprint-preview-detail__panel-title {
  margin: 0;
  font-size: 16px;
  line-height: 1.4;
  font-weight: 800;
  color: #1c2b3f;
}

.ai-blueprint-preview-detail__structure-list {
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 12px;
  margin-top: 14px;
}

.ai-blueprint-preview-detail__structure-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #dce7f3;
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 250, 255, 0.96)),
    linear-gradient(140deg, rgba(31, 111, 255, 0.03), transparent 58%);
  color: #1f2d40;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(27, 57, 92, 0.04);
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.ai-blueprint-preview-detail__structure-item:hover {
  border-color: #9fbbde;
  transform: translateX(2px);
  box-shadow: 0 14px 26px rgba(27, 57, 92, 0.08);
}

.ai-blueprint-preview-detail__structure-item:focus-visible {
  outline: none;
  border-color: #2463d6;
  box-shadow:
    0 0 0 3px rgba(36, 99, 214, 0.18),
    0 14px 26px rgba(27, 57, 92, 0.08);
  transform: translateX(2px);
}

.ai-blueprint-preview-detail__structure-item-leading {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(233, 240, 249, 0.96);
  color: #5f6f84;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.ai-blueprint-preview-detail__structure-item-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ai-blueprint-preview-detail__structure-item-label {
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
}

.ai-blueprint-preview-detail__structure-item-note {
  font-size: 11px;
  line-height: 1.5;
  color: #8a98ab;
  font-weight: 600;
}

.ai-blueprint-preview-detail__structure-item-count {
  color: #7b8ba0;
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 1280px) {
  .ai-blueprint-preview-detail__layout {
    grid-template-columns: 240px minmax(0, 1fr);
  }

  .ai-blueprint-preview-detail__side {
    grid-column: 1 / -1;
  }

  .ai-blueprint-preview-detail__decision-panel-shell {
    position: static;
  }
}

@media (max-width: 900px) {
  .ai-blueprint-preview-detail__layout {
    grid-template-columns: 1fr;
  }

  .ai-blueprint-preview-detail__title {
    font-size: 24px;
  }
}
</style>
