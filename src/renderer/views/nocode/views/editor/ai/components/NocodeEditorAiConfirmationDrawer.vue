<template>
  <teleport to="body">
    <transition name="ai-confirmation-floating">
      <div
        v-if="modelValue && block"
        class="ai-confirmation-drawer-layer"
      >
        <div
          v-if="scrimStyle"
          class="ai-confirmation-drawer__scrim"
          :style="scrimStyle"
        ></div>

        <section
          class="ai-confirmation-drawer"
          :class="{ 'is-completed': isCompleted }"
          :style="panelStyle"
        >
          <header class="ai-confirmation-drawer__header">
            <div
              v-if="headerStatusTagText"
              class="ai-confirmation-drawer__badge"
            >
              {{ headerStatusTagText }}
            </div>

            <el-button
              text
              class="ai-confirmation-drawer__close"
              @click="emit('update:modelValue', false)"
            >
              <el-icon :size="16"><i-ep-close /></el-icon>
            </el-button>

            <div class="ai-confirmation-drawer__title">{{ drawerTitle }}</div>
            <p v-if="drawerSummary" class="ai-confirmation-drawer__summary">{{ drawerSummary }}</p>
          </header>

          <div class="ai-confirmation-drawer__body">
            <template v-if="isCompleted">
              <div
                v-for="question in completedQuestions"
                :key="question.id"
                class="ai-confirmation-drawer__outline-item"
              >
                <div class="ai-confirmation-drawer__outline-copy">
                  <strong>{{ question.title }}</strong>
                  <span>{{ getCompletedQuestionCopy(question) }}</span>
                </div>
                <div class="ai-confirmation-drawer__outline-tag">{{ $t('nocodeEditorAiConfirmationDrawer.confirmed') }}</div>
              </div>
            </template>

            <template v-else>
              <article
                v-for="(question, index) in questions"
                :key="question.id || `${index}-${question.title}`"
                class="ai-confirmation-drawer__question-card"
                :class="{
                  'is-focused': focusQuestionId === question.id,
                  'has-answer': hasDraftResponse(question),
                }"
                :data-question-id="question.id"
              >
                <div class="ai-confirmation-drawer__question-head">
                  <div class="ai-confirmation-drawer__question-main">
                    <span class="ai-confirmation-drawer__question-index">{{ String(index + 1).padStart(2, '0') }}</span>
                    <div class="ai-confirmation-drawer__question-copy">
                      <div class="ai-confirmation-drawer__question-title">{{ question.title }}</div>
                      <p
                        v-if="getQuestionDraft(question).note"
                        class="ai-confirmation-drawer__question-description"
                      >
                        {{ getQuestionDraft(question).note }}
                      </p>
                    </div>
                  </div>
                </div>

                <div class="ai-confirmation-drawer__question-actions">
                  <div
                    v-for="option in getQuestionOptions(question)"
                    :key="`${question.id}-${option.value}`"
                    class="ai-confirmation-drawer__question-action-card"
                    :class="{ 'is-selected': isSelectedDraftOption(question, option) }"
                  >
                    <el-button
                      class="ai-confirmation-drawer__question-option"
                      :class="{ 'is-selected': isSelectedDraftOption(question, option) }"
                      :title="getQuestionOptionTitle(option)"
                      plain
                      size="small"
                      :disabled="isInteractionDisabled"
                      @click="selectDraftOption(question, option)"
                    >
                      {{ getQuestionOptionDisplayLabel(question, option) }}
                    </el-button>
                  </div>
                  <div
                    class="ai-confirmation-drawer__question-action-card is-note"
                  >
                    <el-button
                      class="ai-confirmation-drawer__question-option is-note"
                      :class="{ 'is-note-selected': isQuestionNoteActive(question.id) }"
                      :title="$t('nocodeEditorAiConfirmationDrawer.additionalNotes')"
                      plain
                      size="small"
                      :disabled="isInteractionDisabled"
                      @click="toggleQuestionNote(question.id)"
                    >{{ $t('nocodeEditorAiConfirmationDrawer.additionalNotes') }}</el-button>
                  </div>
                </div>

                <div
                  v-if="isQuestionNoteOpen(question.id)"
                  class="ai-confirmation-drawer__question-note-wrap"
                >
                  <el-input
                    :ref="(el: InstanceType<typeof ElInput>) => setQuestionInputRef(question.id, el)"
                    :model-value="getQuestionDraft(question).note"
                    type="textarea"
                    :autosize="{ minRows: 3, maxRows: 5 }"
                    resize="none"
                    :disabled="isInteractionDisabled"
                    :placeholder="$t('nocodeEditorAiConfirmationDrawer.additionalNotesPlaceholder')"
                    @update:model-value="updateQuestionNote(question, $event)"
                  />
                </div>
              </article>
            </template>
          </div>

          <footer class="ai-confirmation-drawer__footer">
            <template v-if="isCompleted">
              <el-button type="primary" @click="handleResumeChat">{{ $t('nocodeEditorAiConfirmationDrawer.backToChat') }}</el-button>
            </template>

            <template v-else>
              <div class="ai-confirmation-drawer__footer-actions">
                <el-button :disabled="submitting" @click="emit('update:modelValue', false)">{{ $t('nocodeEditorAiConfirmationDrawer.closeForNow') }}</el-button>
                <el-button
                  v-if="!isReadonly"
                  type="primary"
                  :disabled="isInteractionDisabled || !canSubmitResponses"
                  @click="handleSubmitResponses"
                >
                  {{ submitButtonLabel }}
                </el-button>
              </div>
            </template>
          </footer>
        </section>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { AiAssistantArtifactBlock } from '@common/types/ai'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import {
  getNocodeEditorCompletedDefaultsContinueLabel,
} from '@common/utils/nocodeEditorConfirmationCopy'
import {
  inferNocodeEditorConfirmationQuestionOptions,
  resolveNocodeEditorConfirmationQuestionDisplayOptions,
  resolveNocodeEditorConfirmationOptionDisplayLabel,
} from '@common/utils/nocodeEditorConfirmationOptions'
import {
  resolveAiArtifactCompletionSummary,
  resolveAiArtifactConfirmation,
  resolveAiArtifactConfirmationStatus,
  resolveAiArtifactConfirmationSummary,
  resolveAiArtifactPendingQuestions,
  resolveAiArtifactQuestionAnswerDetail,
  resolveAiArtifactQuestionAnswerSummary,
  resolveAiArtifactQuestionSelectedOption,
  resolveAiArtifactQuestions,
  resolveAiArtifactTitle,
  type AiArtifactConfirmationQuestion,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import {
  buildConfirmationResponseAnswerDetail,
  buildConfirmationResponseFromDraft,
  buildInitialConfirmationResponseDraft,
  buildStagedConfirmationResponses,
  countUnansweredConfirmationQuestions,
  hasConfirmationResponseDraftNote,
  hasMeaningfulConfirmationResponse,
  type NocodeEditorAiConfirmationResponseDraftMap,
  type NocodeEditorAiConfirmationResponse,
} from './confirmationInteraction'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import i18next from 'i18next'
import { ElInput } from "element-plus";

// eslint-disable-next-line vue/valid-define-props
const props = defineProps<{
  modelValue: boolean
  block: AiAssistantArtifactBlock | null
  focusQuestionId?: string | null
  submitting?: boolean
  readonly?: boolean
  responseDrafts?: NocodeEditorAiConfirmationResponseDraftMap
  statusTagText?: string
}>()

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'resume-chat', block: AiAssistantArtifactBlock): void
  (event: 'submit-responses', payload: {
    block: AiAssistantArtifactBlock
    responses: NocodeEditorAiConfirmationResponse[]
  }): void
  (event: 'select-option', payload: {
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }): void
  (event: 'update-note', payload: {
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
  (event: 'update-note-active', payload: {
    questionId: string
    active: boolean
  }): void
}>()

const confirmationStatus = computed(() => resolveAiArtifactConfirmationStatus(props.block))
const isCompleted = computed(() => confirmationStatus.value === 'completed')
const isReadonly = computed(() => Boolean(props.readonly))
const isInteractionDisabled = computed(() => isReadonly.value || Boolean(props.submitting))
const title = computed(() => (props.block ? resolveAiArtifactTitle(props.block) : i18next.t('nocodeEditorAiConfirmationDrawer.fullConfirmation')))
const summary = computed(() => (
  props.block
    ? (resolveAiArtifactConfirmationSummary(props.block) || props.block.summary || '')
    : ''
))
const completionSummary = computed(() => resolveAiArtifactCompletionSummary(props.block))
const completedWithDefaults = computed(() => (
  resolveAiArtifactConfirmation(props.block)?.continueLabel === getNocodeEditorCompletedDefaultsContinueLabel()
))
const drawerTitle = computed(() => (
  isCompleted.value ? i18next.t('nocodeEditorAiConfirmationDrawer.fullConfirmationRecord') : title.value
))
const drawerSummary = computed(() => (
  isCompleted.value
    ? completionSummary.value || summary.value
    : summary.value || i18next.t('nocodeEditorAiConfirmationDrawer.confirmationDrawerTip')
))
const allQuestions = computed(() => resolveAiArtifactQuestions(props.block))
const questions = computed(() => resolveAiArtifactPendingQuestions(props.block))
const completedQuestions = computed(() => (
  allQuestions.value.filter(question => (
    Boolean(question.confirmed)
    || Boolean(question.selectedOptionValue)
    || Boolean(question.answerSummary)
  ))
))
const pendingBadgeText = computed(() => {
  const pendingCount = questions.value.length
  return pendingCount > 0 ? i18next.t('nocodeEditorAiConfirmationDrawer.pendingCount', { count: pendingCount }) : ''
})
const completedBadgeText = computed(() => (
  completedQuestions.value.length > 0
    ? i18next.t('nocodeEditorAiConfirmationDrawer.confirmedCount', { count: completedQuestions.value.length })
    : i18next.t('nocodeEditorAiConfirmationDrawer.confirmed')
))
const headerStatusTagText = computed(() => (
  props.statusTagText || (isCompleted.value ? completedBadgeText.value : pendingBadgeText.value)
))

const panelStyle = ref<CSSProperties>({
  top: '124px',
  left: '430px',
  width: '548px',
  height: '720px',
})
const scrimStyle = ref<CSSProperties | null>(null)
const openNoteQuestionIds = ref<string[]>([])
const questionInputRefs = new Map<string, InstanceType<typeof ElInput>>()

const setQuestionInputRef = (questionId: string, instance: InstanceType<typeof ElInput>) => {
  if (!questionId) {
    return
  }
  questionInputRefs.set(questionId, instance)
}

const getQuestionDraft = (question: AiArtifactConfirmationQuestion) => (
  props.responseDrafts?.[question.id]
  || buildInitialConfirmationResponseDraft(question)
)

const syncOpenNoteQuestionIds = (
  options: {
    includeDraftNotes?: boolean
  } = {},
) => {
  const questionIdSet = new Set(
    questions.value
      .map(question => question.id)
      .filter(Boolean),
  )
  const nextOpenNoteQuestionIds = openNoteQuestionIds.value.filter(questionId => questionIdSet.has(questionId))

  if (options.includeDraftNotes) {
    questions.value.forEach((question) => {
      if (
        question.id
        && hasConfirmationResponseDraftNote(getQuestionDraft(question))
        && !nextOpenNoteQuestionIds.includes(question.id)
      ) {
        nextOpenNoteQuestionIds.push(question.id)
      }
    })
  }

  openNoteQuestionIds.value = nextOpenNoteQuestionIds
}

const getQuestionOptions = (question: AiArtifactConfirmationQuestion) => (
  question.questionKind === 'note_only'
    ? []
    : (
      resolveNocodeEditorConfirmationQuestionDisplayOptions(question)
        .map(item => item.option)
      || inferNocodeEditorConfirmationQuestionOptions(question)
      || []
    )
)

const getQuestionOptionDisplayLabel = (
  question: AiArtifactConfirmationQuestion,
  option: NocodeEditorAiConfirmQuestionOption,
) => (
  resolveNocodeEditorConfirmationQuestionDisplayOptions(question)
    .find(item => item.option.value === option.value)?.displayLabel
  || resolveNocodeEditorConfirmationOptionDisplayLabel(question, option)
  || option.label
)

const getQuestionOptionTitle = (option: NocodeEditorAiConfirmQuestionOption) => (
  option.description || option.label
)

const isSelectedDraftOption = (
  question: AiArtifactConfirmationQuestion,
  option: NocodeEditorAiConfirmQuestionOption,
) => (
  getQuestionDraft(question)?.option?.value === option.value
)

const isQuestionNoteOpen = (questionId: string) => (
  openNoteQuestionIds.value.includes(questionId)
)

const isQuestionNoteActive = (questionId: string) => {
  const question = questions.value.find(item => item.id === questionId)
  return isQuestionNoteOpen(questionId)
    || hasConfirmationResponseDraftNote(question ? getQuestionDraft(question) : null)
}

const focusQuestionEditor = async (questionId: string) => {
  if (!questionId) {
    return
  }

  await nextTick()

  const questionCard = document.querySelector(
    `.ai-confirmation-drawer__question-card[data-question-id="${questionId}"]`,
  ) as HTMLElement | null
  questionCard?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  })

  await nextTick()
  questionInputRefs.get(questionId)?.focus?.()
}

const openQuestionNote = async (questionId: string) => {
  if (!openNoteQuestionIds.value.includes(questionId)) {
    openNoteQuestionIds.value = [...openNoteQuestionIds.value, questionId]
  }
  await focusQuestionEditor(questionId)
}

const closeQuestionNote = (questionId: string) => {
  openNoteQuestionIds.value = openNoteQuestionIds.value.filter(item => item !== questionId)
}

// Keep supplement-note toggling local to the drawer so note collapse does not mutate staged content.
const toggleQuestionNote = async (questionId: string) => {
  if (isInteractionDisabled.value) {
    return
  }

  if (isQuestionNoteOpen(questionId)) {
    closeQuestionNote(questionId)
    emit('update-note-active', { questionId, active: false })
    return
  }

  await openQuestionNote(questionId)
  emit('update-note-active', { questionId, active: true })
}

const selectDraftOption = (
  question: AiArtifactConfirmationQuestion,
  option: NocodeEditorAiConfirmQuestionOption,
) => {
  if (isInteractionDisabled.value) {
    return
  }

  emit('select-option', { question, option })
}

const buildQuestionResponse = (question: AiArtifactConfirmationQuestion): NocodeEditorAiConfirmationResponse => {
  const draft = getQuestionDraft(question)
  return buildConfirmationResponseFromDraft(question, draft)
}

const updateQuestionNote = (
  question: AiArtifactConfirmationQuestion,
  value: string,
) => {
  if (isInteractionDisabled.value) {
    return
  }

  emit('update-note', {
    question,
    note: value,
  })
}

const hasDraftResponse = (question: AiArtifactConfirmationQuestion) => (
  hasMeaningfulConfirmationResponse(buildQuestionResponse(question))
)

const stagedResponses = computed(() => (
  buildStagedConfirmationResponses(questions.value, props.responseDrafts || {})
))

const remainingUnansweredCount = computed(() => (
  countUnansweredConfirmationQuestions(questions.value, props.responseDrafts || {})
))

const canSubmitResponses = computed(() => (
  questions.value.length > 0
  && remainingUnansweredCount.value <= 0
))

const answeredCount = computed(() => (
  Math.max(0, questions.value.length - remainingUnansweredCount.value)
))

const submitButtonLabel = computed(() => (
  i18next.t('nocodeEditorAiConfirmationDrawer.confirmSelectedItems', {
    answered: answeredCount.value,
    total: questions.value.length,
  })
))
const handleSubmitResponses = () => {
  if (
    isInteractionDisabled.value
    || !props.block
    || !stagedResponses.value.length
    || remainingUnansweredCount.value > 0
  ) {
    return
  }

  emit('submit-responses', {
    block: props.block,
    responses: stagedResponses.value,
  })
}

const handleResumeChat = () => {
  if (!props.block) {
    return
  }

  emit('update:modelValue', false)
  emit('resume-chat', props.block)
}

const normalizeCompletedQuestionCopyPart = (value: unknown) => (
  String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/[。；;，,]+$/g, '')
    .trim()
)

const buildCompletedQuestionCopyKey = (value: string) => (
  value
    .replace(/[….]+$/g, '')
    .replace(/[。；;，,\s]/g, '')
    .toLowerCase()
)

const hasCompletedQuestionCopyOverlap = (leftKey: string, rightKey: string) => {
  if (!leftKey || !rightKey) {
    return false
  }
  if (leftKey === rightKey) {
    return true
  }

  const overlapMinLength = 3
  return Math.min(leftKey.length, rightKey.length) >= overlapMinLength
    && (leftKey.startsWith(rightKey) || rightKey.startsWith(leftKey))
}

const appendCompletedQuestionCopyPart = (
  copyParts: string[],
  copyPartKeys: string[],
  part: string,
) => {
  const partKey = buildCompletedQuestionCopyKey(part)
  const duplicateIndex = copyPartKeys.findIndex(key => (
    hasCompletedQuestionCopyOverlap(key, partKey)
  ))

  if (duplicateIndex >= 0) {
    if (partKey.length > copyPartKeys[duplicateIndex].length) {
      copyParts[duplicateIndex] = part
      copyPartKeys[duplicateIndex] = partKey
    }
    return
  }

  copyParts.push(part)
  copyPartKeys.push(partKey)
}

const dedupeCompletedQuestionCopySentences = (value: string) => {
  const sentenceParts = value
    .split(/[。；;]+/)
    .map(normalizeCompletedQuestionCopyPart)
    .filter(Boolean)
  if (sentenceParts.length <= 1) {
    return value
  }

  const copyParts: string[] = []
  const copyPartKeys: string[] = []
  sentenceParts.forEach(part => appendCompletedQuestionCopyPart(copyParts, copyPartKeys, part))
  return copyParts.join('。')
}

const dedupeCompletedQuestionCopyParts = (parts: unknown[]) => {
  const copyParts: string[] = []
  const copyPartKeys: string[] = []

  parts
    .map(part => dedupeCompletedQuestionCopySentences(normalizeCompletedQuestionCopyPart(part)))
    .filter(Boolean)
    .forEach(part => appendCompletedQuestionCopyPart(copyParts, copyPartKeys, part))

  return copyParts
}

const getCompletedQuestionCopy = (question: AiArtifactConfirmationQuestion) => {
  const response: NocodeEditorAiConfirmationResponse = {
    question,
    option: resolveAiArtifactQuestionSelectedOption(question),
    note: buildInitialConfirmationResponseDraft(question).note,
  }

  const summaryText = resolveAiArtifactQuestionAnswerSummary(question)
  const detailText = resolveAiArtifactQuestionAnswerDetail(question)
  const derivedDetailText = buildConfirmationResponseAnswerDetail(response)
  const copyParts = dedupeCompletedQuestionCopyParts([
    summaryText,
    detailText,
    derivedDetailText,
  ])

  if (copyParts.length) {
    return copyParts.join('。')
  }

  return completedWithDefaults.value
    ? i18next.t('nocodeEditorAiConfirmationDrawer.confirmedWithDefaults')
    : i18next.t('nocodeEditorAiConfirmationDrawer.confirmedWithCurrentSelection')
}

const updateFloatingLayout = () => {
  if (!props.modelValue) {
    return
  }

  const panelWrap = document.querySelector('.nocode-ai-panel-wrap') as HTMLElement | null
  const mainStage = document.querySelector('.nocode-main-stage') as HTMLElement | null
  const stageBody = (
    mainStage?.querySelector('.nocode-stage-body')
    || mainStage?.querySelector('.selection-stage-body')
  ) as HTMLElement | null
  const panelRect = panelWrap?.getBoundingClientRect()
  const stageRect = (stageBody || mainStage)?.getBoundingClientRect()

  const defaultWidth = 548
  const maxWidth = 560
  const minWidth = 420
  const minFallbackWidth = 360
  const stagePadding = 12
  const gap = 12

  if (stageRect) {
    const stagePreferredWidth = Math.min(
      maxWidth,
      Math.max(minWidth, stageRect.width * 0.42),
    )
    const width = Math.max(
      minFallbackWidth,
      Math.min(defaultWidth, stagePreferredWidth, stageRect.width - stagePadding * 2),
    )
    const left = panelRect
      ? Math.max(stageRect.left, panelRect.right + gap)
      : stageRect.left + stagePadding
    const height = Math.max(520, stageRect.height)
    const alignedTop = stageRect.top

    panelStyle.value = {
      top: `${Math.round(alignedTop)}px`,
      left: `${Math.round(left)}px`,
      width: `${Math.round(width)}px`,
      height: `${Math.round(height)}px`,
    }

    scrimStyle.value = {
      top: `${Math.round(stageRect.top)}px`,
      left: `${Math.round(stageRect.left)}px`,
      width: `${Math.round(Math.max(320, stageRect.width))}px`,
      height: `${Math.round(Math.max(320, stageRect.height))}px`,
    }
    return
  }

  const top = Math.max((panelRect?.top || 72) + 16, 96)
  const width = defaultWidth
  const left = Math.max(24, (panelRect?.left || 520) - width - gap)
  const height = Math.max(520, Math.min(760, window.innerHeight - top - 24))

  panelStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    height: `${Math.round(height)}px`,
  }
  scrimStyle.value = null
}

const handleViewportChange = () => {
  updateFloatingLayout()
}

watch(
  () => [props.modelValue, props.block] as const,
  async ([visible]) => {
    if (!visible) {
      return
    }

    syncOpenNoteQuestionIds({ includeDraftNotes: true })
    await nextTick()
    if (props.focusQuestionId && !isCompleted.value) {
      await openQuestionNote(props.focusQuestionId)
    }
    updateFloatingLayout()
  },
  { deep: false },
)

watch(
  () => props.responseDrafts,
  () => {
    syncOpenNoteQuestionIds()
  },
  { deep: true },
)

watch(
  () => props.focusQuestionId,
  async (questionId) => {
    if (!props.modelValue || !questionId || isCompleted.value) {
      return
    }
    await openQuestionNote(questionId)
  },
)

onMounted(() => {
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})
</script>

<style scoped lang="scss">
.ai-confirmation-drawer-layer {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: none;
}

.ai-confirmation-drawer__scrim {
  position: fixed;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(16, 35, 63, 0.08) 0%, rgba(16, 35, 63, 0.03) 28%, rgba(16, 35, 63, 0) 74%);
  pointer-events: none;
}

.ai-confirmation-drawer {
  position: fixed;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(29, 33, 41, 0.12);
  overflow: hidden;
  pointer-events: auto;
}

.ai-confirmation-drawer.is-completed {
  border-color: #d9f0c7;
  box-shadow: 0 8px 24px rgba(29, 33, 41, 0.1);
}

.ai-confirmation-drawer__header {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e6eb;
  background: #ffffff;
}

.ai-confirmation-drawer.is-completed .ai-confirmation-drawer__header {
  background: #ffffff;
}

.ai-confirmation-drawer__close {
  position: absolute;
  top: 8px;
  right: 8px;
}

.ai-confirmation-drawer__badge,
.ai-confirmation-drawer__outline-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 400;
  line-height: 20px;
}

.ai-confirmation-drawer__badge {
  background: #fff7e8;
  color: #faad14;
  border: 1px solid #fde8b2;
}

.ai-confirmation-drawer.is-completed .ai-confirmation-drawer__badge {
  color: #52c41a;
  background: #f4ffe8;
  border-color: #d9f0c7;
}

.ai-confirmation-drawer__title {
  font-size: 20px;
  line-height: 32px;
  font-weight: 500;
  color: #1d2129;
  padding-right: 36px;
}

.ai-confirmation-drawer__summary {
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  color: #86909c;
  padding-right: 12px;
}

.ai-confirmation-drawer__body {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
}

.ai-confirmation-drawer__outline-item {
  border-radius: 8px;
  border: 1px solid #f2f3f5;
  background: #f6fbff;
  box-shadow: none;
}

.ai-confirmation-drawer__question-card {
  border-radius: 8px;
  border: 1px solid #f2f3f5;
  background: #f6fbff;
  box-shadow: none;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-confirmation-drawer__question-card.is-focused {
  border-color: #87bfff;
  box-shadow: 0 0 0 2px rgba(8, 115, 255, 0.12);
}

.ai-confirmation-drawer__question-card.has-answer {
  border-color: #bfd4f8;
}

.ai-confirmation-drawer__question-head,
.ai-confirmation-drawer__question-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.ai-confirmation-drawer__question-head {
  justify-content: space-between;
}

.ai-confirmation-drawer__question-main {
  flex: 1;
  min-width: 0;
}

.ai-confirmation-drawer__question-index {
  flex-shrink: 0;
  color: #0873ff;
  font-size: 14px;
  line-height: 22px;
  font-weight: 600;
}

.ai-confirmation-drawer__question-copy {
  min-width: 0;
}

.ai-confirmation-drawer__question-title {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  color: #1d2129;
}

.ai-confirmation-drawer__question-description {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: #86909c;
}

.ai-confirmation-drawer__question-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.ai-confirmation-drawer__question-action-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  min-width: 0;
}

.ai-confirmation-drawer__question-option {
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

.ai-confirmation-drawer__question-option + .ai-confirmation-drawer__question-option,
.ai-confirmation-drawer__question-action-card + .ai-confirmation-drawer__question-action-card :deep(.el-button) {
  margin-left: 0;
}

.ai-confirmation-drawer__question-option :deep(span) {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-confirmation-drawer__question-option:not(.is-disabled):not(.is-selected):not(.is-note-selected):hover {
  border-color: #bfd4f8;
  background: #f6faff;
  color: #0873ff;
}

.ai-confirmation-drawer__question-action-card.is-selected .ai-confirmation-drawer__question-option {
  border-color: #0873ff;
  background: #e8f6ff;
  color: #0873ff;
  box-shadow: none;
}

.ai-confirmation-drawer__question-option.is-note {
  border-style: dashed;
  border-spacing: 2px;
  border-color: #c9cdd4;
  color: #1d2129;
  background: #ffffff;
}

.ai-confirmation-drawer__question-option.is-note.is-note-selected {
  background: #f2f3f5;
  box-shadow: none;
}

.ai-confirmation-drawer__question-note-wrap {
  padding-top: 2px;

  :deep(.el-textarea__inner) {
    min-height: 82px !important;
    border-radius: 4px;
    border-color: #e5e6eb;
    box-shadow: none;
    line-height: 20px;
  }
}

.ai-confirmation-drawer__outline-item {
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-confirmation-drawer__outline-copy {
  min-width: 0;
}

.ai-confirmation-drawer__outline-copy strong {
  display: block;
  font-size: 14px;
  margin-bottom: 4px;
  color: #1d2129;
}

.ai-confirmation-drawer__outline-copy span {
  font-size: 12px;
  color: #86909c;
  line-height: 20px;
}

.ai-confirmation-drawer__outline-tag {
  color: #52c41a;
  background: #f4ffe8;
  border: 1px solid #d9f0c7;
  white-space: nowrap;
}

.ai-confirmation-drawer__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e5e6eb;
  background: #ffffff;
}

.ai-confirmation-drawer__footer-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
}

.ai-confirmation-drawer__footer-actions > :deep(.el-button) {
  width: 100%;
  min-height: 48px;
  border-radius: 4px;
}

.ai-confirmation-drawer__footer-actions > :deep(.el-button + .el-button) {
  margin-left: 0;
}

.ai-confirmation-floating-enter-active,
.ai-confirmation-floating-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.ai-confirmation-floating-enter-from,
.ai-confirmation-floating-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

@media (max-width: 1200px) {
  .ai-confirmation-drawer__footer {
    flex-direction: column;
    align-items: stretch;
  }

  .ai-confirmation-drawer__footer-actions {
    grid-template-columns: 1fr;
  }
}
</style>
