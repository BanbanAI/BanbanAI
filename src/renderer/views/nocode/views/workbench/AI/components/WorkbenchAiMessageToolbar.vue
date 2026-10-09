<template>
  <div
    class="workbench-ai-message-toolbar-container"
    :class="{
      'is-visible': toolbarVisible,
      'left': role === AiMessageRole.ASSISTANT,
      'right': role === AiMessageRole.USER,
    }"
  >
    <div class="ai-message-toolbar__content">
      <span
        v-if="formattedCreateTime && role === AiMessageRole.USER"
        class="ai-message-toolbar__time"
        :class="{ 'is-visible': timeVisible }"
      >
        {{ formattedCreateTime }}
      </span>
      <button
        type="button"
        class="ai-message-toolbar__button is-copy"
        :class="{ 'is-copied': isCopied }"
        :aria-label="$t('WorkbenchAiMessageToolbar.copy')"
        :title="$t('WorkbenchAiMessageToolbar.copy')"
        @click="handleCopy"
      >
        <el-icon :size="14">
          <i-ep-check v-if="isCopied" />
          <i-ven-ai-copy v-else />
        </el-icon>
      </button>
      <button
        v-if="canEdit"
        type="button"
        class="ai-message-toolbar__button is-edit"
        :aria-label="$t('WorkbenchAiMessageToolbar.edit')"
        :title="$t('WorkbenchAiMessageToolbar.edit')"
        @click="emit('edit')"
      >
        <el-icon :size="14">
          <i-ep-edit />
        </el-icon>
      </button>
      <template v-if="role === AiMessageRole.ASSISTANT">
        <button
          v-if="false"
          type="button"
          class="ai-message-toolbar__button"
          :class="{ 'is-active': feedbackValue === 'like' }"
          :aria-label="$t('WorkbenchAiMessageToolbar.like')"
          @click="emit('feedback', 'like')"
        >
          <el-icon :size="20">
            <i-ven-ai-praise />
          </el-icon>
        </button>
        <button
          v-if="false"
          type="button"
          class="ai-message-toolbar__button"
          :class="{ 'is-active': feedbackValue === 'dislike' }"
          :aria-label="$t('WorkbenchAiMessageToolbar.dislike')"
          @click="emit('feedback', 'dislike')"
        >
          <el-icon :size="20">
            <i-ven-ai-dislike />
          </el-icon>
        </button>
      </template>
      <span
        v-if="formattedCreateTime && role === AiMessageRole.ASSISTANT"
        class="ai-message-toolbar__time"
        :class="{ 'is-visible': timeVisible }"
      >
        {{ formattedCreateTime }}
      </span>
    </div>
  </div>
</template>

<script setup lang='ts'>
import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';
import { useClipboard } from '@vueuse/core';
import { computed, onBeforeUnmount } from 'vue';
import { AiMessageRole } from '../types';
import i18next from 'i18next';
import { createCopyFeedbackState } from './workbenchAiCopyButtonState';

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  content: string;
  copyContent?: string;
  loading?: boolean;
  role: AiMessageRole.USER | AiMessageRole.ASSISTANT;
  createTime?: number;
  hovered?: boolean;
  feedbackValue?: '' | 'like' | 'dislike';
  alwaysShowTime?: boolean;
  showOnHoverOnly?: boolean;
  canEdit?: boolean;
}>(), {
  copyContent: '',
  loading: false,
  createTime: undefined,
  hovered: false,
  feedbackValue: '',
  alwaysShowTime: false,
  showOnHoverOnly: false,
  canEdit: false,
});

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'feedback', value: 'like' | 'dislike'): void;
  (event: 'edit'): void;
}>();

const resolvedCopyContent = computed(() => (
  String(props.copyContent || props.content || '').trim()
))

const toolbarVisible = computed(() => {
  if (props.loading) {
    return false;
  }

  return props.hovered ||
    (!props.showOnHoverOnly && (
      props.canEdit ||
      (props.role === AiMessageRole.ASSISTANT && resolvedCopyContent.value.length > 0)
    ));
});

const timeVisible = computed(() => (
  props.alwaysShowTime || props.hovered || props.role === AiMessageRole.USER || toolbarVisible.value
))

const formattedCreateTime = computed(() => {
  if (!props.createTime) {
    return ''
  }
  const createTime = dayjs(props.createTime)
  if (createTime.isSame(dayjs(), 'day')) {
    return createTime.format('HH:mm')
  }
  return createTime.format(i18next.t('WorkbenchAiMessageToolbar.dateTimeFormat'))
});

const { copy } = useClipboard({ legacy: true });
const { isCopied, markCopied, dispose } = createCopyFeedbackState();

onBeforeUnmount(dispose);

const handleCopy = async () => {
  try {
    await copy(resolvedCopyContent.value);
    markCopied();
    ElMessage.success(i18next.t('WorkbenchAiMessageToolbar.copySuccess'));
  } catch (error) {
    console.error('复制消息失败:', error);
    ElMessage.error(i18next.t('WorkbenchAiMessageToolbar.copyFail'));
  }
};
</script>

<style scoped lang='scss'>
.workbench-ai-message-toolbar-container {
  width: 100%;
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  display: flex;
  transition: opacity 0.2s ease;
  margin-top: 4px;

  &.left {
    justify-content: flex-start;
  }

  &.right {
    justify-content: flex-end;
  }
  
  &.is-visible {
    pointer-events: auto;
    opacity: 1;
  }

  &:hover {
    .ai-message-toolbar__time {
      opacity: 1;
    }
  }
  
  .ai-message-toolbar__content {
    height: 18px;
    line-height: 18px;
    display: flex;
    align-items: center;
    gap: 4px;
    color: #8a8f98;
  }

  .ai-message-toolbar__button {
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: 4px;
    padding: 0;
    background: transparent;
    color: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    cursor: var(--cursor-pointer);
    transition: color 0.2s ease;

    &:hover {
      background-color: #F2F3F5;
      color: #4E5969;
    }

    &.is-active {
      color: #0873ff;
    }
  }

  .ai-message-toolbar__time {
    color: inherit;
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;
    transition: opacity 0.2s ease;
    opacity: 0;

    &.is-visible {
      opacity: 1;
    }
  }
}
</style>
