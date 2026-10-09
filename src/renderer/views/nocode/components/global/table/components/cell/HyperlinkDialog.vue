<template>
  <div class="hyperlink-open-link-dialog">
    <el-dialog v-model="visible" :title="title" :fullscreen="isFullscreen" :close-on-click-modal="false" destroy-on-close align-center>
      <template #header>
        <el-button
          link
          class="hyperlink-dialog__fullscreen"
          :title="fullscreenLabel"
          :aria-label="fullscreenLabel"
          @click="isFullscreen = !isFullscreen"
        >
          <el-icon :size="14">
            <i-ven-icon-shrink-screen v-if="isFullscreen" />
            <i-ven-icon-full-screen v-else />
          </el-icon>  
        </el-button>
      </template>
      <video
        v-if="contentType === 'video'"
        class="hyperlink-dialog__frame"
        :src="url"
        :aria-label="title"
        controls
        preload="metadata"
        playsinline
      />
      <iframe v-else-if="contentType === 'iframe'" class="hyperlink-dialog__frame" :src="url" :title="title" />
      <div v-else class="hyperlink-dialog__loading">
        <span class="hyperlink-dialog__spinner" />
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import axios from "axios";
import i18next from "i18next";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  url: string;
  title: string;
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
}>();

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});
const isFullscreen = ref(false);
const contentType = ref<"video" | "iframe" | null>(null);
let contentTypeRequest: AbortController | undefined;

async function checkContentType(url: string) {
  contentTypeRequest?.abort();
  contentType.value = null;

  const controller = new AbortController();
  contentTypeRequest = controller;

  try {
    const response = await axios.head("/proxy", {
      params: { url },
      signal: controller.signal,
      validateStatus: () => true,
    });
    if (!controller.signal.aborted) {
      contentType.value = response.status >= 200
        && response.status < 400
        && `${response.headers['content-type'] || ""}`.toLowerCase().startsWith("video/")
        ? "video"
        : "iframe";
    }
  } catch {
    if (!controller.signal.aborted) {
      contentType.value = "iframe";
    }
  }
}

watch([visible, () => props.url], ([isVisible, url]) => {
  if (isVisible && url) {
    checkContentType(url);
    return;
  }

  contentTypeRequest?.abort();
  contentType.value = null;
}, { immediate: true });

onBeforeUnmount(() => contentTypeRequest?.abort());

const fullscreenLabel = computed(() => {
  return i18next.t(isFullscreen.value ? "HyperlinkDialog.exitFullscreen" : "HyperlinkDialog.fullscreen");
});
</script>

<style lang="scss" scoped>
.hyperlink-open-link-dialog {
  :deep(.el-dialog) {
    width: 90%;
    height: 90%;
    padding: 0;
    border-radius: 8px;
    background-color: var(--color-white);

    &.is-fullscreen {
      width: 100%;
      height: 100%;
    }

    .el-dialog__header {
      padding: 12px 24px;
      height: 48px;
    }

    .hyperlink-dialog__fullscreen {
      position: absolute;
      top: 0; 
      right: 48px;
      width: 48px;
      height: 48px;
    }

    .el-dialog__body {
      height: calc(100% - 48px);
      padding: 16px;

      .hyperlink-dialog__loading {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;

        .hyperlink-dialog__spinner {
          box-sizing: border-box;
          width: 64px;
          height: 64px;
          border: 4px solid var(--el-color-primary-light-8);
          border-top-color: var(--el-color-primary);
          border-right-color: var(--el-color-primary);
          border-radius: 50%;
          animation: hyperlink-dialog-loading 0.8s linear infinite;
        }
      }
      
      .hyperlink-dialog__frame {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
      }
    }
  }
}

@keyframes hyperlink-dialog-loading {
  to {
    transform: rotate(360deg);
  }
}
</style>
