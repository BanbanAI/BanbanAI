<template>
  <div
    class="ai-confirmation-question-list"
    :class="{ 'is-compact': compact, 'is-readonly': readonly }"
  >
    <article
      v-for="(question, index) in questions"
      :key="question.id || `${index}-${question.title}`"
      :class="[
        'ai-confirmation-question-list__item',
        { 'is-readonly': isQuestionInteractionReadonly(question) },
      ]"
    >
      <div class="ai-confirmation-question-list__head">
        <span class="ai-confirmation-question-list__index">{{ String(index + 1).padStart(2, '0') }}</span>
        <div class="ai-confirmation-question-list__copy">
          <div class="ai-confirmation-question-list__title">{{ question.title }}</div>
          <p v-if="getQuestionDescription(question)" class="ai-confirmation-question-list__description">
            {{ getQuestionDescription(question) }}
          </p>
          <p v-if="getQuestionNote(question)" class="ai-confirmation-question-list__note">
            {{ getQuestionNote(question) }}
          </p>
        </div>
      </div>

      <div
        v-if="getQuestionActions(question).length"
        class="ai-confirmation-question-list__options"
      >
        <el-button
          v-for="action in getQuestionActions(question)"
          :key="action.key"
          class="ai-confirmation-question-list__option"
          :title="action.title"
          :class="{
            'is-selected': action.kind === 'option' && isSelectedAction(question, action),
            'is-note-selected': action.kind === 'focus-input' && isSelectedAction(question, action),
            'is-focus': action.kind === 'focus-input',
          }"
          plain
          size="small"
          :disabled="isQuestionInteractionReadonly(question)"
          :tabindex="isQuestionInteractionReadonly(question) ? -1 : undefined"
          @click="handleAction(question, action)"
        >
          {{ action.displayLabel }}
        </el-button>
      </div>

      <div
        v-if="showInlineNoteInput && isInlineNoteOpen(question.id) && !isQuestionInteractionReadonly(question)"
        class="ai-confirmation-question-list__inline-note"
      >
        <el-input
          :model-value="responseDrafts?.[question.id]?.note || ''"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 5 }"
          resize="none"
          :disabled="readonly"
          :placeholder="$t('nocodeEditorAiConfirmationQuestionList.additionalNotesPlaceholder')"
          @update:model-value="handleInlineNoteInput(question, $event)"
        />
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import {
  resolveAiArtifactQuestionAnswerDetail,
  resolveAiArtifactQuestionSelectedOption,
  type AiArtifactConfirmationQuestion,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import {
  inferNocodeEditorConfirmationQuestionOptions,
  resolveNocodeEditorConfirmationQuestionDisplayOptions,
  resolveNocodeEditorConfirmationOptionDisplayLabel,
} from '@common/utils/nocodeEditorConfirmationOptions'
import {
  normalizeNocodeEditorConfirmationVisibleDescription,
} from '@common/utils/nocodeEditorConfirmationNormalization'
import { computed } from 'vue'
import i18next from 'i18next'
import {
  hasConfirmationResponseDraftNote,
  type NocodeEditorAiConfirmationResponseDraftMap,
} from './confirmationInteraction'

type ConfirmationQuestionAction =
  | {
    key: string
    kind: 'option'
    label: string
    displayLabel: string
    title: string
    option: NocodeEditorAiConfirmQuestionOption
  }
  | {
    key: string
    kind: 'focus-input'
    label: string
    displayLabel: string
    title: string
  }

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  questions: AiArtifactConfirmationQuestion[]
  compact?: boolean
  maxVisibleActions?: number
  responseDrafts?: NocodeEditorAiConfirmationResponseDraftMap
  showSupplementAction?: boolean
  activeInputQuestionIds?: string[]
  inlineNoteQuestionIds?: string[]
  showInlineNoteInput?: boolean
  readonly?: boolean
  readonlyQuestionIds?: string[]
}>(), {
  compact: false,
  maxVisibleActions: 0,
  responseDrafts: () => ({}),
  showSupplementAction: false,
  activeInputQuestionIds: () => [],
  inlineNoteQuestionIds: () => [],
  showInlineNoteInput: false,
  readonly: false,
  readonlyQuestionIds: () => [],
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'select-option', payload: {
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }): void
  (event: 'focus-input', question: AiArtifactConfirmationQuestion): void
  (event: 'toggle-note-input', question: AiArtifactConfirmationQuestion): void
  (event: 'update-note', payload: {
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
}>()

const fallbackInputLabel = computed(() => i18next.t('nocodeEditorAiConfirmationQuestionList.additionalNotes'))
const normalizeQuestionId = (value: unknown) => String(value ?? '').trim()
const readonlyQuestionIdSet = computed(() => new Set(
  props.readonlyQuestionIds
    .map(questionId => normalizeQuestionId(questionId))
    .filter(Boolean),
))

const isQuestionInteractionReadonly = (question: AiArtifactConfirmationQuestion) => (
  props.readonly || readonlyQuestionIdSet.value.has(normalizeQuestionId(question.id))
)

const buildQuestionActions = (question: AiArtifactConfirmationQuestion): ConfirmationQuestionAction[] => {
  const questionKind = question.questionKind
  const displayOptions = questionKind === 'note_only'
    ? []
    : resolveNocodeEditorConfirmationQuestionDisplayOptions(question)
  const options = displayOptions.length
    ? displayOptions
    : (inferNocodeEditorConfirmationQuestionOptions(question) || []).map((option) => ({
      option,
      displayLabel: resolveNocodeEditorConfirmationOptionDisplayLabel(question, option) || option.label,
      title: option.description || option.label,
    }))

  const actions: ConfirmationQuestionAction[] = options.map((displayOption) => {
    return {
      key: `${question.id}-${displayOption.option.value}`,
      kind: 'option' as const,
      label: displayOption.option.label,
      displayLabel: displayOption.displayLabel,
      title: displayOption.title,
      option: displayOption.option,
    }
  })

  if (props.showSupplementAction || !options.length) {
    actions.push({
      key: `${question.id}-focus`,
      kind: 'focus-input',
      label: fallbackInputLabel.value,
      displayLabel: fallbackInputLabel.value,
      title: fallbackInputLabel.value,
    })
  }

  if (actions.length) {
    return actions
  }

  return [{
    key: `${question.id}-focus`,
    kind: 'focus-input',
    label: fallbackInputLabel.value,
    displayLabel: fallbackInputLabel.value,
    title: fallbackInputLabel.value,
  }]
}

const getQuestionActions = (question: AiArtifactConfirmationQuestion) => {
  const actions = buildQuestionActions(question)
  if (!props.maxVisibleActions || actions.length <= props.maxVisibleActions) {
    return actions
  }

  const focusAction = actions.find(action => action.kind === 'focus-input')
  if (!focusAction || props.maxVisibleActions <= 1) {
    return actions.slice(0, props.maxVisibleActions)
  }

  const optionActions = actions.filter(action => action.kind === 'option')
  return [
    ...optionActions.slice(0, Math.max(0, props.maxVisibleActions - 1)),
    focusAction,
  ]
}

const normalizeQuestionNoteText = (value: unknown) => (
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[。；;，,]+$/g, '')
    .trim()
)

const getQuestionDescription = (question: AiArtifactConfirmationQuestion) => (
  normalizeNocodeEditorConfirmationVisibleDescription(question.description)
)

const getQuestionNote = (question: AiArtifactConfirmationQuestion) => {
  const draftNote = normalizeQuestionNoteText(props.responseDrafts?.[question.id]?.note)
  if (draftNote) {
    return draftNote
  }

  const descriptionText = normalizeQuestionNoteText(getQuestionDescription(question))
  const detailText = normalizeQuestionNoteText(
    normalizeNocodeEditorConfirmationVisibleDescription(
      resolveAiArtifactQuestionAnswerDetail(question),
    ),
  )
  return detailText && detailText !== descriptionText ? detailText : ''
}

const isInlineNoteOpen = (questionId: string) => (
  props.inlineNoteQuestionIds.includes(questionId)
)

const isSelectedAction = (
  question: AiArtifactConfirmationQuestion,
  action: ConfirmationQuestionAction,
) => {
  if (action.kind === 'focus-input') {
    if (props.showInlineNoteInput && props.inlineNoteQuestionIds.includes(question.id)) {
      return true
    }
    return props.activeInputQuestionIds.includes(question.id)
      || hasConfirmationResponseDraftNote(props.responseDrafts?.[question.id])
  }
  const draftOptionValue = String(props.responseDrafts?.[question.id]?.option?.value || '').trim()
  if (draftOptionValue) {
    return draftOptionValue === action.option.value
  }
  return resolveAiArtifactQuestionSelectedOption(question)?.value === action.option.value
}

const handleAction = (
  question: AiArtifactConfirmationQuestion,
  action: ConfirmationQuestionAction,
) => {
  if (isQuestionInteractionReadonly(question)) {
    return
  }

  if (action.kind === 'option') {
    emit('select-option', { question, option: action.option })
    return
  }
  if (props.showInlineNoteInput) {
    emit('toggle-note-input', question)
    return
  }
  emit('focus-input', question)
}

const handleInlineNoteInput = (
  question: AiArtifactConfirmationQuestion,
  value: string,
) => {
  if (isQuestionInteractionReadonly(question)) {
    return
  }

  emit('update-note', {
    question,
    note: String(value || ''),
  })
}
</script>

<style scoped lang="scss">
.ai-confirmation-question-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-confirmation-question-list__item {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #f2f3f5;
  background: #f6fbff;
  box-shadow: none;
}

.ai-confirmation-question-list.is-compact .ai-confirmation-question-list__item {
  padding: 12px;
  border-radius: 8px;
}

.ai-confirmation-question-list__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.ai-confirmation-question-list__index {
  flex-shrink: 0;
  color: #0873ff;
  font-size: 14px;
  line-height: 22px;
  font-weight: 600;
}

.ai-confirmation-question-list__copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-confirmation-question-list__title {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: #1d2129;
}

.ai-confirmation-question-list__description,
.ai-confirmation-question-list__note {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
}

.ai-confirmation-question-list__description {
  color: #86909c;
}

.ai-confirmation-question-list__note {
  color: #4e5969;
}

.ai-confirmation-question-list__options {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ai-confirmation-question-list__option {
  min-height: 32px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  padding: 5px 12px;
  border-radius: 4px;
  border-color: #e5e6eb;
  background: #ffffff;
  color: #1d2129;
  font-weight: 400;
}

.ai-confirmation-question-list__option + .ai-confirmation-question-list__option {
  margin-left: 0;
}

.ai-confirmation-question-list__option :deep(span) {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-confirmation-question-list__option:not(.is-disabled):not(.is-selected):not(.is-note-selected):hover {
  border-color: #bfd4f8;
  background: #f6faff;
  color: #0873ff;
}

.ai-confirmation-question-list__option.is-selected {
  border-color: #0873ff;
  background: #e8f6ff;
  color: #0873ff;
  box-shadow: none;
}

.ai-confirmation-question-list__option.is-focus {
  border-style: dashed;
  border-color: #c9cdd4;
  color: #1d2129;
  background: #ffffff;
}

.ai-confirmation-question-list__option.is-note-selected {
  background: #f2f3f5;
  box-shadow: none;
}

.ai-confirmation-question-list.is-compact .ai-confirmation-question-list__options {
  margin-top: 10px;
  gap: 8px;
}

.ai-confirmation-question-list.is-compact .ai-confirmation-question-list__option {
  min-height: 32px;
}

.ai-confirmation-question-list__inline-note {
  margin-top: 10px;
}

.ai-confirmation-question-list__inline-note :deep(.el-textarea__inner) {
  min-height: 82px;
  border-radius: 4px;
  border-color: #e5e6eb;
  line-height: 20px;
  box-shadow: none;
}

.ai-confirmation-question-list.is-readonly .ai-confirmation-question-list__options {
  pointer-events: none;
}

.ai-confirmation-question-list.is-readonly .ai-confirmation-question-list__option {
  cursor: not-allowed;
  pointer-events: none;
  user-select: none;
  transition: none;
}

.ai-confirmation-question-list.is-readonly .ai-confirmation-question-list__option.is-disabled,
.ai-confirmation-question-list.is-readonly .ai-confirmation-question-list__option[disabled],
.ai-confirmation-question-list.is-readonly .ai-confirmation-question-list__option.el-button.is-disabled,
.ai-confirmation-question-list.is-readonly .ai-confirmation-question-list__option.el-button[disabled] {
  opacity: 0.78;
}
</style>
