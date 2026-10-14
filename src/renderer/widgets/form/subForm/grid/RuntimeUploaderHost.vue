<template>
  <el-popover
    :visible="modelValue"
    :virtual-ref="anchor || undefined"
    virtual-triggering
    placement="bottom-start"
    :width="isImage ? '392px' : '400px'"
    :teleported="true"
    :show-arrow="false"
    :offset="2"
    :popper-style="popperStyle"
    popper-class="runtime-uploader-popover"
    :trigger="noTrigger"
  >
    <div
      ref="hostRef"
      class="runtime-uploader-host"
      tabindex="-1"
      @click.stop
      @paste.stop="handlePaste"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <input
        ref="inputRef"
        class="runtime-uploader-host__input"
        type="file"
        :multiple="multiple"
        :accept="accept"
        :disabled="loading"
        @change="handleFiles"
      />
      <button
        v-if="!readonly && isImage"
        type="button"
        class="runtime-uploader-host__trigger"
        :disabled="loading"
        @click="openFilePicker"
      >
        <el-icon class="runtime-uploader-host__trigger-icon" :size="16"><Upload /></el-icon>
        <span>{{ uploadText }}</span>
        <span class="runtime-uploader-host__trigger-hint">{{ i18next.t("subFormUploadHint") }}</span>
      </button>
      <el-button
        v-else-if="!readonly"
        class="runtime-uploader-host__upload-button"
        type="primary"
        :disabled="loading"
        @click="openFilePicker"
      >
        <el-icon :size="16"><Upload /></el-icon>
        {{ uploadText }}
      </el-button>
      <el-scrollbar v-if="items.length" class="runtime-uploader-host__scroll" :max-height="scrollMaxHeight">
        <div
          v-if="isImage"
          class="runtime-uploader-host__grid"
          :class="{ 'runtime-uploader-host__grid--list': !asCards }"
        >
          <div v-for="(item, index) in items" :key="item.uid" class="runtime-uploader-host__card">
            <el-image class="runtime-uploader-host__card-image" :src="item.url" fit="cover" @click.stop="openViewer(index)">
              <template #error>
                <span class="runtime-uploader-host__card-fallback"><el-icon :size="18" color="#fff"><Picture /></el-icon></span>
              </template>
            </el-image>
            <div class="runtime-uploader-host__meta">
              <span class="runtime-uploader-host__name" :title="item.name">{{ item.name }}</span>
              <span class="runtime-uploader-host__size">{{ formatUploadSize(item.size) }}</span>
            </div>
            <div v-if="item.pending" class="runtime-uploader-host__options runtime-uploader-host__options--visible">
              <el-button link :title="i18next.t('subFormCancelUpload')" @click.stop="cancelUpload(item)">
                <el-icon :size="16" color="var(--el-color-info)"><Close /></el-icon>
              </el-button>
            </div>
            <div v-else class="runtime-uploader-host__options">
              <el-button link @click.stop="downloadFile(item)">
                <el-icon :size="16" color="var(--el-color-info)"><Download /></el-icon>
              </el-button>
              <el-button v-if="!readonly" link @click.stop="removeFile(index)">
                <el-icon :size="16" color="var(--el-color-danger)"><Delete /></el-icon>
              </el-button>
            </div>
            <el-progress
              v-if="item.pending"
              class="runtime-uploader-host__progress"
              :percentage="pendingPercent(item)"
              :indeterminate="!item.percent"
              :duration="1.2"
              color="#4ba0fc"
              :show-text="false"
            />
          </div>
        </div>

        <div v-else class="runtime-uploader-host__grid runtime-uploader-host__grid--file">
          <div v-for="(item, index) in items" :key="item.uid" class="runtime-uploader-host__file-item">
            <img
              class="runtime-uploader-host__file-thumb"
              :src="getUploadFileIcon(item.name, item.url)"
              alt=""
              @click.stop="previewMedia(item)"
            />
            <div class="runtime-uploader-host__file-meta">
              <span class="runtime-uploader-host__name" :title="item.name">{{ item.name }}</span>
              <span class="runtime-uploader-host__file-size">
                {{ item.pending && item.percent ? `${item.percent}%` : formatUploadSize(item.size) }}
                <el-button v-if="readonly && !item.pending" type="primary" link @click.stop="downloadFile(item)">
                  {{ i18next.t("subFormDownload") }}
                </el-button>
              </span>
            </div>
            <div v-if="item.pending" class="runtime-uploader-host__options">
              <el-button link :title="i18next.t('subFormCancelUpload')" @click.stop="cancelUpload(item)">
                <el-icon :size="16" color="var(--el-color-info)"><Close /></el-icon>
              </el-button>
            </div>
            <div v-else-if="!readonly" class="runtime-uploader-host__options">
              <el-button link @click.stop="removeFile(index)">
                <el-icon :size="16" color="var(--el-color-danger)"><Delete /></el-icon>
              </el-button>
            </div>
            <el-progress
              v-if="item.pending"
              class="runtime-uploader-host__progress"
              :percentage="pendingPercent(item)"
              :indeterminate="!item.percent"
              :duration="1.2"
              color="#4ba0fc"
              :show-text="false"
            />
          </div>
        </div>
      </el-scrollbar>
    </div>

    <el-image-viewer
      v-if="viewerIndex !== null"
      :initial-index="viewerIndex"
      :url-list="imageUrls"
      show-progress
      teleported
      @close="viewerIndex = null"
    />
    <teleport to="body">
      <table-media-viewer
        v-if="mediaVisible"
        :z-index="9000"
        :initial-index="mediaIndex"
        :url-list="mediaUrls"
        :hide-on-click-modal="true"
        :infinite="true"
        :autoplay="false"
        @close="mediaVisible = false"
      />
    </teleport>
  </el-popover>
</template>

<script lang="ts" setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Close, Delete, Download, Picture, Upload } from "@element-plus/icons-vue";
import type { CellAddress } from "../runtime/types";
import type { RuntimeUploadItem } from "../runtime/uploader-service";
import type { Uploader } from "../../uploader/uploader";
import i18next from "@renderer/widgets/i18next";
import { ElMessage } from "element-plus";
import {
  downloadUploadItem,
  formatUploadSize,
  getUploadFileIcon,
  isImageUploadFile,
  normalizeUploadItems,
  type RuntimeUploadDisplayItem,
} from "./runtime-upload-utils";
import { RUNTIME_PENDING_UPLOADS, type RuntimePendingUploads } from "./runtime-pending-uploads";

const props = defineProps<{
  modelValue: boolean;
  widget: Uploader | null;
  address: CellAddress;
  value: unknown;
  anchor?: HTMLElement | null;
  readonly?: boolean;
  applyValue?: (address: CellAddress, value: RuntimeUploadItem[]) => void;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
}>();

const pendingUploads = inject<RuntimePendingUploads | null>(RUNTIME_PENDING_UPLOADS, null);

type RuntimeUploaderWidget = Uploader & {
  fileListType?: string;
  fileSelectMode?: "select-single" | "select-mulitple";
  fileAccept?: string;
};

const noTrigger: string[] = [];

const hostRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const viewerIndex = ref<number | null>(null);
const mediaVisible = ref(false);
const mediaIndex = ref(0);

const uploaderWidget = computed(() => props.widget as RuntimeUploaderWidget | null);
const isImage = computed(() => props.widget?.type === "widget.form.image-uploader");
const multiple = computed(() => uploaderWidget.value?.fileSelectMode === "select-mulitple");
const accept = computed(() => {
  const widget = uploaderWidget.value;
  const configured = widget?.fileAccept || (widget?.fileFormatList || []).join(",");
  return configured || (isImage.value ? "image/*" : "");
});
const asCards = computed(() => isImage.value && uploaderWidget.value?.fileListType === "text");
const uploadText = computed(() => i18next.t(isImage.value ? "subFormUploadImage" : "subFormUploadFile"));
const popperStyle = computed(() => (isImage.value
  ? { background: "var(--el-color-white)", padding: "14px 0 14px 14px" }
  : { background: "var(--el-color-white)" }));
const maxCount = computed(() => {
  const widget = props.widget;
  if (!widget?.getOption("limit-count")) return undefined;
  const range = widget.getOption<unknown>("limit-count-range");
  return Array.isArray(range) && typeof range[1] === "number" ? range[1] : undefined;
});

const scrollMaxHeight = computed(() => {
  const padding = 4;
  if (!isImage.value) return 54 * 5 + 12 * 4 + padding;
  return asCards.value ? 166 * 2 + 8 + padding : 66 * 2 + 12 + padding;
});

const files = computed<RuntimeUploadItem[]>(() => (Array.isArray(props.value)
  ? props.value.filter(Boolean).map(item => ({ ...(item as RuntimeUploadItem), status: "success" as const }))
  : []));
const pending = computed<RuntimeUploadDisplayItem[]>(() => pendingUploads?.list(props.address) || []);
const loading = computed(() => pending.value.length > 0);

const items = computed<RuntimeUploadDisplayItem[]>(() => [
  ...normalizeUploadItems(files.value),
  ...pending.value,
]);
const imageUrls = computed(() => items.value.map(item => item.url).filter(Boolean));
const mediaUrls = computed(() => items.value.filter(item => item.isMedia && item.url).map(item => item.url));

watch(() => props.modelValue, visible => {
  if (!visible) return;
  void nextTick(() => hostRef.value?.focus());
  if (inputRef.value) inputRef.value.value = "";
});

const pendingPercent = (item: RuntimeUploadDisplayItem) => item.percent || 30;

const openViewer = (index: number) => {
  viewerIndex.value = index;
};

const previewMedia = (item: { isMedia: boolean; url: string }) => {
  if (!item.isMedia || !item.url) return;
  const index = mediaUrls.value.indexOf(item.url);
  if (index === -1) return;
  mediaIndex.value = index;
  mediaVisible.value = true;
};

const downloadFile = (item: { url: string; name: string }) => downloadUploadItem(item);

const cancelUpload = (item: RuntimeUploadDisplayItem) => {
  pendingUploads?.cancel(props.address, item.uid);
};

const removeFile = (index: number) => {
  if (props.readonly || index >= files.value.length) return;
  const next = files.value.filter((_, currentIndex) => currentIndex !== index);
  props.applyValue?.(props.address, next);
};

const openFilePicker = () => inputRef.value?.click();

const closePopover = () => emit("update:modelValue", false);

const handleDocumentPointerDown = (event: PointerEvent) => {
  if (!props.modelValue) return;
  if (viewerIndex.value !== null || mediaVisible.value) return;
  const target = event.target as Node | null;
  if (hostRef.value?.contains(target)) return;
  if (props.anchor?.contains(target)) return;
  closePopover();
};

onMounted(() => window.addEventListener("pointerdown", handleDocumentPointerDown, true));
onBeforeUnmount(() => window.removeEventListener("pointerdown", handleDocumentPointerDown, true));

const processFiles = (selected: File[]) => {
  if (props.readonly || !pendingUploads || loading.value || !selected.length) return;
  const acceptable = isImage.value ? selected.filter(isImageUploadFile) : selected;
  if (acceptable.length !== selected.length) ElMessage.error(i18next.t("subFormUploadImageOnly"));
  if (!acceptable.length) return;
  const maxFiles = maxCount.value;
  if (maxFiles !== undefined && files.value.length + acceptable.length > maxFiles) {
    ElMessage.error(i18next.t(
      isImage.value ? "subFormMaxImageCountError" : "subFormMaxFileCountError",
      { count: maxFiles },
    ));
    return;
  }
  pendingUploads.start(props.address, acceptable);
};

const handleFiles = (event: Event) => {
  const input = event.target as HTMLInputElement;
  processFiles([...(input.files || [])]);
  input.value = "";
};

const handleDrop = (event: DragEvent) => {
  if (loading.value) return;
  processFiles([...(event.dataTransfer?.files || [])]);
};

const handlePaste = (event: ClipboardEvent) => {
  if (loading.value) return;
  const pasted = [...(event.clipboardData?.files || [])];
  if (!pasted.length) return;
  event.preventDefault();
  processFiles(pasted);
};

</script>

<style lang="scss" scoped>
.runtime-uploader-host {
  max-width: min(370px, calc(100vw - 48px));
  color: var(--el-text-color-regular, var(--text-color-primary));
  outline: none;
}

.runtime-uploader-host__input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.runtime-uploader-host__trigger {
  display: inline-flex;
  width: 100%;
  min-height: 32px;
  align-items: center;
  justify-content: center;
  gap: 3px;
  box-sizing: border-box;
  margin-bottom: 12px;
  border: 1px dashed var(--el-border-color, var(--border-color));
  border-radius: 4px;
  padding: 0 12px;
  background: transparent;
  color: #4e5969;
  cursor: pointer;
  font: inherit;

  &:hover:not(:disabled) {
    border-color: var(--el-color-primary, var(--color-primary));
    color: var(--el-color-primary, var(--color-primary));
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
}

.runtime-uploader-host__trigger-icon {
  color: #4e5969;
}

.runtime-uploader-host__trigger-hint {
  color: var(--text-color-secondary);
  text-wrap: nowrap;
}

.runtime-uploader-host__upload-button {
  margin-bottom: 12px;
}

.runtime-uploader-host__scroll {
  max-width: 100%;
}

.runtime-uploader-host__grid {
  display: grid;
  grid-template-columns: repeat(3, 112px);
  gap: 8px;
  padding: 0 4px 4px 0;
}

.runtime-uploader-host__grid--list,
.runtime-uploader-host__grid--file {
  grid-template-columns: minmax(0, 1fr);
  row-gap: 12px;
}

.runtime-uploader-host__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 114px;
  height: 166px;
  overflow: hidden;
  border: 1px solid var(--el-border-color, var(--border-color));
  border-radius: 4px;

  &:hover {
    border-color: var(--el-border-color-hover, var(--cell-border-hover));
  }
}

.runtime-uploader-host__card-image {
  display: flex;
  width: 110px;
  height: 110px;
  align-items: center;
  justify-content: center;
  background: var(--el-bg-color-overlay);
  cursor: pointer;

  :deep(.el-image__inner) {
    max-width: 110px;
    max-height: 110px;
    width: auto;
    height: auto;
    object-fit: contain;
  }
}

.runtime-uploader-host__card-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: #f5f5f7;
}

.runtime-uploader-host__meta {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  padding: 4px 8px 8px;
  overflow: hidden;
}

.runtime-uploader-host__name {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  color: var(--text-color-regular);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.runtime-uploader-host__size,
.runtime-uploader-host__file-size {
  color: var(--text-color-secondary);
  font-size: 12px;
  line-height: 16px;
}

.runtime-uploader-host__options {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: none;
  align-items: center;
  height: 24px;

  :deep(.el-button) {
    width: 24px;
    height: 24px;
    margin-left: 4px;
    border-radius: 4px;

    &:hover {
      background-color: #f2f3f5;
    }
  }
}

.runtime-uploader-host__options--visible {
  display: flex;
}

.runtime-uploader-host__card:hover .runtime-uploader-host__options {
  display: flex;
}

.runtime-uploader-host__card:not(:hover) .runtime-uploader-host__options {
  display: none;
}

.runtime-uploader-host__file-item {
  position: relative;
  display: flex;
  align-items: center;
  width: 336px;
  max-width: 100%;
  height: 54px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 1px solid var(--el-border-color, var(--border-color));
  border-radius: 4px;
  background-color: var(--el-bg-color-overlay, var(--bg-color-overlay));
}

.runtime-uploader-host__file-thumb {
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  border-radius: 2px;
  object-fit: cover;
  cursor: pointer;
}

.runtime-uploader-host__file-meta {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  margin-left: 16px;
  overflow: hidden;
}

.runtime-uploader-host__file-size {
  display: flex;
  justify-content: space-between;
}

.runtime-uploader-host__file-item .runtime-uploader-host__options {
  position: static;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
}

.runtime-uploader-host__progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 6px;
}

.runtime-uploader-host__grid--list .runtime-uploader-host__card {
  flex-direction: row;
  width: 100%;
  height: 66px;
  padding: 8px;
}

.runtime-uploader-host__grid--list .runtime-uploader-host__card-image {
  width: 48px;
  height: 48px;
  margin-right: 16px;

  :deep(.el-image__inner) {
    max-width: 48px;
    max-height: 48px;
  }
}

.runtime-uploader-host__grid--list .runtime-uploader-host__meta {
  height: 48px;
  padding: 0;
}

.runtime-uploader-host__grid--list .runtime-uploader-host__options {
  right: 8px;
  bottom: 8px;
}
</style>
