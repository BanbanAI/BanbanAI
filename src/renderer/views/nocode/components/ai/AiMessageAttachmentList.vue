<template>
  <div class="ai-message-attachments">
    <div
      v-if="imageAttachments.length"
      ref="imageListRef"
      class="ai-message-attachments__images"
    >
      <el-image
        v-for="(attachment, index) in imageAttachments"
        :key="attachment.id"
        class="ai-message-attachments__image"
        :src="resolveContentUrl(attachment)"
        :preview-src-list="imagePreviewUrls"
        :initial-index="index"
        fit="cover"
        hide-on-click-modal
        preview-teleported
      >
        <template #error>
          <div class="ai-message-attachments__image-error">
            <el-icon :size="22"><i-ep-picture /></el-icon>
          </div>
        </template>
      </el-image>
    </div>

    <a
      v-for="attachment in fileAttachments"
      :key="attachment.id"
      class="ai-message-attachments__file"
      :class="{ 'is-disabled': !resolveContentUrl(attachment) }"
      :href="resolveContentUrl(attachment)"
      target="_blank"
      rel="noopener noreferrer"
      @click="!resolveContentUrl(attachment) && $event.preventDefault()"
    >
      <span class="ai-message-attachments__file-icon" aria-hidden="true">
        <el-icon :size="18"><i-ep-document /></el-icon>
      </span>
      <span class="ai-message-attachments__file-main">
        <span class="ai-message-attachments__file-name" :title="attachment.name">{{ attachment.name }}</span>
        <span v-if="getFileMeta(attachment)" class="ai-message-attachments__file-meta">
          {{ getFileMeta(attachment) }}
        </span>
      </span>
      <el-icon v-if="resolveContentUrl(attachment)" class="ai-message-attachments__file-arrow" :size="15">
        <i-ep-arrow-right />
      </el-icon>
    </a>
  </div>
</template>

<script setup lang="ts">
import type { AiAttachmentReference } from '@common/types/aiAttachment'
import { computed, nextTick, ref, watch } from 'vue'

type Props = {
  attachments: AiAttachmentReference[]
  contentUrlResolver: (attachment: AiAttachmentReference) => string | undefined
}

// eslint-disable-next-line vue/valid-define-props
const props = defineProps<Props>()

const imageListRef = ref<HTMLElement | null>(null)

const imageAttachments = computed(() => props.attachments.filter(attachment => (
  attachment.kind === 'image' && Boolean(props.contentUrlResolver(attachment))
)))

const fileAttachments = computed(() => props.attachments.filter(attachment => (
  attachment.kind !== 'image' || !props.contentUrlResolver(attachment)
)))

const imagePreviewUrls = computed(() => imageAttachments.value
  .map(attachment => props.contentUrlResolver(attachment))
  .filter((url): url is string => Boolean(url)))

watch(
  () => imageAttachments.value.map(attachment => attachment.id).join(','),
  async () => {
    await nextTick()
    if (imageListRef.value) {
      imageListRef.value.scrollLeft = imageListRef.value.scrollWidth
    }
  },
  { immediate: true, flush: 'post' },
)

const resolveContentUrl = (attachment: AiAttachmentReference) => (
  props.contentUrlResolver(attachment) || undefined
)

const formatFileSize = (size?: number) => {
  const normalizedSize = Number(size || 0)
  if (!Number.isFinite(normalizedSize) || normalizedSize <= 0) {
    return ''
  }
  if (normalizedSize < 1024) {
    return `${normalizedSize} B`
  }
  if (normalizedSize < 1024 * 1024) {
    return `${Math.round(normalizedSize / 1024)} KB`
  }
  return `${(normalizedSize / (1024 * 1024)).toFixed(1)} MB`
}

const getFileMeta = (attachment: AiAttachmentReference) => {
  const extension = String(attachment.extension || attachment.name.split('.').pop() || '')
    .trim()
    .replace(/^\./, '')
    .toUpperCase()
  return [extension, formatFileSize(attachment.size)].filter(Boolean).join(' · ')
}
</script>

<style scoped lang="scss">
.ai-message-attachments {
  width: min(360px, 100%);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.ai-message-attachments__images {
  width: fit-content;
  max-width: 100%;
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.ai-message-attachments__image {
  flex: 0 0 78px;
  width: 78px;
  height: 78px;
  border: 1px solid rgba(29, 33, 41, 0.1);
  border-radius: 8px;
  overflow: hidden;
  background: #f2f3f5;
  box-shadow: 0 2px 8px rgba(29, 33, 41, 0.08);
  cursor: zoom-in;
}

.ai-message-attachments__image-error {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86909c;
  background: #f2f3f5;
}

.ai-message-attachments__file {
  width: min(300px, 100%);
  min-width: 0;
  min-height: 48px;
  box-sizing: border-box;
  padding: 7px 9px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  color: #1d2129;
  display: flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  box-shadow: 0 1px 3px rgba(29, 33, 41, 0.04);
  transition: border-color 0.16s ease, box-shadow 0.16s ease;

  &:hover:not(.is-disabled) {
    border-color: #94bfff;
    box-shadow: 0 4px 12px rgba(8, 115, 255, 0.1);
  }

  &.is-disabled {
    cursor: default;
    color: #86909c;
    background: #f7f8fa;
  }
}

.ai-message-attachments__file-icon {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0873ff;
  background: #eaf3ff;
}

.ai-message-attachments__file-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-message-attachments__file-name {
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-message-attachments__file-meta {
  color: #86909c;
  font-size: 11px;
  line-height: 14px;
}

.ai-message-attachments__file-arrow {
  flex: 0 0 auto;
  color: #c0c4cc;
}

</style>
