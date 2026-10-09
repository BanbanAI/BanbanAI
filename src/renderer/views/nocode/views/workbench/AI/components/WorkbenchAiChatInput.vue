<template>
  <div
    class="workbench-ai-chat-input"
    :class="{
      'is-floating': floating,
      'is-entry': entry,
      'is-mini-ball': miniBall,
      'is-file-dragging': isFileDragActive,
    }"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <transition name="workbench-ai-chat-input-drop">
      <div
        v-if="isFileDragActive"
        class="workbench-ai-chat-input__drop-overlay"
        aria-hidden="true"
      >
        <div class="workbench-ai-chat-input__drop-icon">
          <el-icon :size="22"><i-ep-document-add /></el-icon>
        </div>
        <div class="workbench-ai-chat-input__drop-copy">
          <div class="workbench-ai-chat-input__drop-title">
            {{ $t('WorkbenchAiChatInput.dropFilesTitle') }}
          </div>
          <div class="workbench-ai-chat-input__drop-description">
            {{ $t('WorkbenchAiChatInput.dropFilesDescription') }}
          </div>
        </div>
      </div>
    </transition>
    <div
      v-if="resolvedAttachments.length > 0"
      class="workbench-ai-chat-input__attachment-list"
    >
      <div
        v-for="attachment in resolvedAttachments"
        :key="attachment.id"
        class="workbench-ai-chat-input__attachment-chip"
        :class="{
          'is-image': attachment.kind === 'image',
          'is-error': attachment.status === 'error',
        }"
      >
        <div
          v-if="showAttachmentThumbnail(attachment)"
          class="workbench-ai-chat-input__attachment-preview"
        >
          <img
            :src="attachment.previewUrl || attachment.url"
            :alt="attachment.name"
            class="workbench-ai-chat-input__attachment-preview-image"
          />
        </div>
        <div v-else class="workbench-ai-chat-input__attachment-icon">
          <el-icon :size="16">
            <i-ep-paperclip />
          </el-icon>
        </div>
        <div class="workbench-ai-chat-input__attachment-meta">
          <div class="workbench-ai-chat-input__attachment-name" :title="attachment.name">
            {{ attachment.name }}
          </div>
          <div
            v-if="resolveAttachmentCaption(attachment)"
            class="workbench-ai-chat-input__attachment-caption"
          >
            {{ resolveAttachmentCaption(attachment) }}
          </div>
        </div>
        <button
          type="button"
          class="workbench-ai-chat-input__attachment-remove"
          :aria-label="`${$t('WorkbenchAiNavChatDropdown.delete')} ${attachment.name}`"
          @click="handleRemoveAttachment(attachment)"
        >
          <el-icon :size="14">
            <i-ep-close />
          </el-icon>
        </button>
      </div>
    </div>
    <div v-if="!entry" class="workbench-ai-chat-input__editor">
      <div
        aria-hidden="true"
        class="workbench-ai-chat-input__textarea workbench-ai-chat-input__textarea--mirror"
      >{{ textareaMirrorValue }}</div>
      <textarea
        ref="textareaRef"
        :value="inputValue"
        class="workbench-ai-chat-input__textarea workbench-ai-chat-input__textarea--field"
        :placeholder="placeholder"
        :rows="textareaRow"
        :disabled="disabled"
        @input="handleInput"
        @keydown="handleKeydown"
        @focus="handleFocus"
      ></textarea>
    </div>
    <div v-else class="workbench-ai-chat-input__placeholder">{{ placeholder }}</div>
    <div
      class="workbench-ai-chat-input__actions"
      :class="{ 'is-only-action': !showAppSelector }"
    >
      <div class="workbench-ai-chat-input__tools">
        <div v-if="showModelSelector" class="workbench-ai-chat-input__model">
          <el-popover
            v-if="allowModelSelection"
            v-model:visible="modelSelectorVisible"
            placement="top-start"
            :width="256"
            :offset="10"
            :show-arrow="false"
            popper-class="workbench-ai-chat-input__model-popper"
            trigger="click"
          >
            <template #reference>
              <button
                type="button"
                class="workbench-ai-chat-input__model-trigger"
                :class="{ 'is-open': modelSelectorVisible }"
                :disabled="modelSelectionLoading"
              >
                <span class="workbench-ai-chat-input__model-trigger-label">
                  {{ modelLabel || $t('WorkbenchAiChatInput.currentModelNotSet') }}
                </span>
                <el-icon :size="14" class="workbench-ai-chat-input__model-trigger-arrow">
                  <i-ep-arrow-down />
                </el-icon>
              </button>
            </template>
            <div class="workbench-ai-chat-input__model-menu">
              <div class="workbench-ai-chat-input__model-search">
                <el-icon :size="17"><i-ep-search /></el-icon>
                <input
                  v-model="modelSearchValue"
                  type="text"
                  :placeholder="$t('WorkbenchAiChatInput.searchModel')"
                />
              </div>
              <div class="workbench-ai-chat-input__model-list">
                <template v-for="group in filteredModelGroups" :key="group.key">
                  <button
                    type="button"
                    class="workbench-ai-chat-input__model-group"
                    @click="toggleModelGroup(group.key)"
                  >
                    <el-icon :size="14" :class="{ 'is-collapsed': isModelGroupCollapsed(group.key) }">
                      <i-ep-arrow-down />
                    </el-icon>
                    <span>{{ group.label }}</span>
                  </button>
                  <div v-if="!isModelGroupCollapsed(group.key)" class="workbench-ai-chat-input__model-group-options">
                    <button
                      v-for="option in group.options"
                      :key="option.value"
                      type="button"
                      class="workbench-ai-chat-input__model-option"
                      :class="{ 'is-selected': option.value === selectedModelValue }"
                      @click="handleModelSelect(option.value)"
                    >
                      <span class="workbench-ai-chat-input__model-option-dot"></span>
                      <span class="workbench-ai-chat-input__model-option-label">{{ option.label }}</span>
                    </button>
                  </div>
                </template>
                <div v-if="filteredModelGroups.length === 0" class="workbench-ai-chat-input__model-empty">
                  {{ modelSearchValue.trim()
                    ? $t('WorkbenchAiChatInput.noMatchingModels')
                    : $t('WorkbenchAiChatInput.noAvailableModel') }}
                </div>
              </div>
            </div>
          </el-popover>
          <div v-else class="workbench-ai-chat-input__model-label" :title="modelLabel">
            {{ modelLabel || $t('WorkbenchAiChatInput.currentModelNotSet') }}
          </div>
        </div>
        <workbench-ai-app-selector
          v-if="showAppSelector && !entry"
          :app-ids="appIds"
          @panel-close="emit('app-selector-close', $event)"
        />
        <button
          v-if="showAttachmentButton"
          type="button"
          class="workbench-ai-chat-input__button is-ghost"
          :aria-label="$t('WorkbenchAiChatInput.uploadAttachment')"
          @click="handleSelectAttachment"
        >
          <el-icon :size="20">
            <i-ep-paperclip />
          </el-icon>
        </button>
      </div>
      <button
        type="button"
        class="workbench-ai-chat-input__button is-primary"
        :class="{ 'is-active': hasDraft || loading || submitting, 'is-mini-ball': miniBall }"
        :disabled="disabled"
        :aria-label="submitting
          ? $t('WorkbenchAiChatInput.uploading')
          : loading
            ? $t('WorkbenchAiChatInput.stopGenerating')
            : $t('WorkbenchAiChatInput.sendMessage')"
        @click="handleSubmit"
      >
        <el-icon v-if="submitting" :size="20" class="is-loading">
          <i-ep-loading />
        </el-icon>
        <el-icon :size="20" v-else-if="loading">
          <i-ven-ai-square />
        </el-icon>
        <div class="workbench-ai-ball-content" v-else-if="miniBall">
          <!-- <i-ven-mini-logo /> -->
          <el-icon :size="20" color="#fff">
            <i-ven-ai-score-icon />
          </el-icon>
          AI
        </div>
        <el-icon :size="20" v-else>
          <i-ven-send-top-arrow />
        </el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "axios";
import { ElMessage } from "element-plus";
import { computed, nextTick, onBeforeUnmount, ref, watch, type PropType } from "vue";
import WorkbenchAiAppSelector from "./WorkbenchAiAppSelector.vue";
import i18next from "i18next";
import type {
  AiAttachment,
  AiAttachmentSelectionEventPayload,
} from "@common/types/aiAttachment";
import {
  formatAiAttachmentKindLabel,
  inferAiAttachmentKind,
  replaceCurrentExcelAttachment,
  resolveAiAttachmentIntent,
} from "@common/utils/aiAttachmentIntent";
import { matchesAiAttachmentAccept } from "@common/utils/aiAttachmentFormats";
import { BUILTIN_AI_PROVIDER_ID } from "@common/utils/aiProvider";

type WorkbenchAiModelOption = {
  value: string;
  label: string;
  groupLabel?: string;
  groupKey?: string;
  providerId?: string;
  modelSelectionSource?: string;
};

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
  emitModelValueOnInput: {
    type: Boolean,
    default: true,
  },
  placeholder: {
    type: String,
    default: () => i18next.t("WorkbenchAiChatInput.inputTip"),
  },
  showAppSelector: {
    type: Boolean,
    default: true,
  },
  showModelSelector: {
    type: Boolean,
    default: false,
  },
  appIds: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
  selectedModelValue: {
    type: String,
    default: "",
  },
  modelLabel: {
    type: String,
    default: "",
  },
  modelOptions: {
    type: Array as PropType<WorkbenchAiModelOption[]>,
    default: () => [],
  },
  allowModelSelection: {
    type: Boolean,
    default: true,
  },
  modelSelectionLoading: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  attachmentUploadNocodeId: {
    type: String,
    default: "",
  },
  floating: {
    type: Boolean,
    default: false,
  },
  entry: {
    type: Boolean,
    default: false,
  },
  miniBall: {
    type: Boolean,
    default: false,
  },
  attachments: {
    type: Array as PropType<AiAttachment[] | undefined>,
    default: undefined,
  },
  showAttachmentButton: {
    type: Boolean,
    default: true,
  },
  attachmentAccept: {
    type: String,
    default: "",
  },
  deferAttachmentUpload: {
    type: Boolean,
    default: false,
  },
  textareaRow: {
    type: Number,
    default: 1,
  }
});

const emit = defineEmits({
  "update:modelValue": (value: string) => typeof value === "string",
  "submit": (value: string) => typeof value === "string",
  "app-selector-close": (appIds: string[]) => Array.isArray(appIds),
  "model-change": (value: string) => typeof value === "string",
  "focus": () => true,
  "select-attachment": (payload: AiAttachmentSelectionEventPayload) => Boolean(payload),
  "remove-attachment": (payload: AiAttachmentSelectionEventPayload) => Boolean(payload),
});

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const inputValue = ref(props.modelValue);
const localAttachments = ref<AiAttachment[]>([]);
const localAttachmentUrls = new Set<string>();
const isFileDragActive = ref(false);
const fileDragDepth = ref(0);
const modelSelectorVisible = ref(false);
const modelSearchValue = ref("");
const collapsedModelGroups = ref<string[]>([]);
const resolvedAttachments = computed(() => (
  Array.isArray(props.attachments)
    ? props.attachments
    : localAttachments.value
));
const hasDraft = computed(() => inputValue.value.trim().length > 0 || resolvedAttachments.value.length > 0);
const textareaMirrorValue = computed(() => inputValue.value ? `${inputValue.value}\u200b` : " ");
const modelGroups = computed(() => {
  const groups = new Map<string, { key: string; label: string; options: WorkbenchAiModelOption[] }>();
  props.modelOptions.forEach((option) => {
    const groupLabel = option.groupLabel || i18next.t("WorkbenchAiChatInput.otherModelGroup");
    const groupKey = option.groupKey || groupLabel;
    const group = groups.get(groupKey) || { key: groupKey, label: groupLabel, options: [] };
    group.options.push(option);
    groups.set(groupKey, group);
  });
  return Array.from(groups.values()).sort((left, right) => {
    const leftIsBuiltin = left.options.some(option => option.providerId === BUILTIN_AI_PROVIDER_ID);
    const rightIsBuiltin = right.options.some(option => option.providerId === BUILTIN_AI_PROVIDER_ID);
    if (leftIsBuiltin === rightIsBuiltin) return 0;
    return leftIsBuiltin ? -1 : 1;
  });
});
const filteredModelGroups = computed(() => {
  const keyword = modelSearchValue.value.trim().toLowerCase();
  if (!keyword) return modelGroups.value;
  return modelGroups.value
    .map(group => ({
      ...group,
      options: group.options.filter(option => option.label.toLowerCase().includes(keyword)),
    }))
    .filter(group => group.options.length > 0);
});

watch(() => props.modelValue, (value) => {
  inputValue.value = value;
});

watch(modelSelectorVisible, (visible) => {
  if (!visible) modelSearchValue.value = "";
});

const isModelGroupCollapsed = (groupKey: string) => collapsedModelGroups.value.includes(groupKey);

const toggleModelGroup = (groupKey: string) => {
  collapsedModelGroups.value = isModelGroupCollapsed(groupKey)
    ? collapsedModelGroups.value.filter(item => item !== groupKey)
    : [...collapsedModelGroups.value, groupKey];
};

const handleModelSelect = (value: string) => {
  emit("model-change", value);
  modelSelectorVisible.value = false;
};

const resolveFileExtension = (fileName: string) => {
  const segments = fileName.split(".");
  return segments.length > 1 ? segments[segments.length - 1].toLowerCase() : undefined;
};

const resolveFilePath = (file: File) => {
  const maybePath = (file as File & { path?: string }).path;
  return typeof maybePath === "string" && maybePath.trim().length > 0 ? maybePath : undefined;
};

const buildRejectedFilesMessage = (files: File[]) => {
  const fileNames = files.map(file => file.name).filter(Boolean);
  const previewNames = fileNames.slice(0, 3).join("、");
  return fileNames.length <= 3
    ? i18next.t('WorkbenchAiChatInput.rejectedFiles', { count: fileNames.length, names: previewNames })
    : i18next.t('WorkbenchAiChatInput.rejectedFilesMore', { count: fileNames.length, names: previewNames });
};

const handleInput = (event: Event) => {
  if (props.disabled) return;
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;

  inputValue.value = target.value;
  if (props.emitModelValueOnInput) {
    emit("update:modelValue", target.value);
  }
};

const handleSubmit = () => {
  if (props.disabled || props.submitting) return;
  emit("submit", inputValue.value);
};

const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return;
  if (event.key !== "Enter" || event.isComposing) return;

  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
    if (event.shiftKey) return;

    event.preventDefault();
    const target = event.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const value = target.value;
    const newValue = value.substring(0, start) + "\n" + value.substring(end);

    inputValue.value = newValue;
    if (props.emitModelValueOnInput) {
      emit("update:modelValue", newValue);
    }
    nextTick(() => {
      target.setSelectionRange(start + 1, start + 1);
    });
    return;
  }

  event.preventDefault();
  handleSubmit();
};

const handleFocus = () => {
  emit("focus");
};

const createObjectUrl = (file: File) => {
  const url = URL.createObjectURL(file);
  localAttachmentUrls.add(url);
  return url;
};

const revokeLocalAttachmentUrls = () => {
  localAttachmentUrls.forEach((url) => {
    URL.revokeObjectURL(url);
  });
  localAttachmentUrls.clear();
};

const revokeAttachmentUrl = (attachment: AiAttachment) => {
  const urls = [attachment.previewUrl, attachment.url].filter(Boolean) as string[];
  urls.forEach((url) => {
    if (!localAttachmentUrls.has(url)) return;
    URL.revokeObjectURL(url);
    localAttachmentUrls.delete(url);
  });
};

watch(() => (Array.isArray(props.attachments) ? props.attachments : []).flatMap(attachment => (
  [attachment.previewUrl, attachment.url].filter(Boolean) as string[]
)), (activeUrls) => {
  const activeUrlSet = new Set(activeUrls);
  [...localAttachmentUrls].forEach((url) => {
    if (activeUrlSet.has(url)) return;
    URL.revokeObjectURL(url);
    localAttachmentUrls.delete(url);
  });
});

const buildLocalAttachment = (file: File): AiAttachment => {
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const objectUrl = createObjectUrl(file);
  const filePath = resolveFilePath(file);
  const extension = resolveFileExtension(file.name);
  return {
    id,
    name: file.name,
    mimeType: file.type || undefined,
    size: file.size,
    extension,
    source: "local",
    status: "ready",
    kind: props.deferAttachmentUpload && extension === "zip"
      ? "archive"
      : inferAiAttachmentKind({
        mimeType: file.type,
        fileName: file.name,
      }),
    url: objectUrl,
    previewUrl: file.type.startsWith("image/") ? objectUrl : undefined,
    file,
    ...(filePath
      ? {
        uploadHandle: {
          id,
          fullPath: filePath,
          originFilePath: filePath,
        },
      }
      : {}),
  };
};

const resolveExcelAttachmentUploadSourceType = (file: File) => (
  resolveFileExtension(file.name) === "zip" ? "zip" : "excel"
);

const resolveUploadAttachmentErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    return String(error.response?.data?.message || error.message || "").trim();
  }
  if (error instanceof Error) {
    return String(error.message || "").trim();
  }
  return String(error || "").trim();
};

const uploadExcelAttachment = async (attachment: AiAttachment, file: File): Promise<AiAttachment | null> => {
  if (attachment.kind !== "excel" || attachment.uploadHandle?.fullPath) {
    return attachment;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("filename", file.name);
  if (props.attachmentUploadNocodeId) {
    formData.append("nocodeId", props.attachmentUploadNocodeId);
  }
  formData.append("sourceType", resolveExcelAttachmentUploadSourceType(file));

  try {
    const response = await axios.post("/nocode/upload-file", formData);
    const fullPath = String(response?.data?.data?.fullPath || "").trim();
    if (!fullPath) {
      revokeAttachmentUrl(attachment);
      ElMessage.error(i18next.t('WorkbenchAiChatInput.uploadFailedRetry'));
      return null;
    }

    const sessionId = String(response?.data?.data?.sessionId || "").trim() || undefined;
    const originFilePath = String(
      attachment.uploadHandle?.originFilePath
      || attachment.uploadHandle?.fullPath
      || response?.data?.data?.originFilePath
      || "",
    ).trim();
    return {
      ...attachment,
      source: "uploaded",
      uploadHandle: {
        id: attachment.id,
        fullPath,
        ...(sessionId ? { sessionId } : {}),
        ...(originFilePath ? { originFilePath } : {}),
      },
    };
  } catch (error) {
    revokeAttachmentUrl(attachment);
    ElMessage.error(resolveUploadAttachmentErrorMessage(error) || i18next.t('WorkbenchAiChatInput.uploadFailedRetry'));
    return null;
  }
};

const showAttachmentThumbnail = (attachment: AiAttachment) => (
  attachment.kind === "image" && Boolean(attachment.previewUrl || attachment.url)
);

const resolveAttachmentCaption = (attachment: AiAttachment) => {
  if (attachment.status === "uploading") {
    return i18next.t('WorkbenchAiChatInput.uploading');
  }
  if (attachment.status === "error") {
    return i18next.t('WorkbenchAiChatInput.uploadFailed');
  }
  if (typeof attachment.size === "number" && attachment.size > 0) {
    if (attachment.size < 1024) {
      return `${attachment.size} B`;
    }
    if (attachment.size < 1024 * 1024) {
      return `${(attachment.size / 1024).toFixed(1)} KB`;
    }
    return `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return formatAiAttachmentKindLabel(attachment.kind);
};

const buildAttachmentIntent = (attachments: AiAttachment[]) => resolveAiAttachmentIntent({
  text: inputValue.value,
  attachments,
  generalAttachmentsDefaultToAnalyze: props.deferAttachmentUpload,
});

const emitAttachmentChange = (
  eventName: "select-attachment" | "remove-attachment",
  attachment: AiAttachment,
  attachments: AiAttachment[],
) => {
  emit(eventName, {
    attachment,
    attachments,
    attachmentIntent: buildAttachmentIntent(attachments),
  });
};

const replaceExcelAttachment = (attachments: AiAttachment[]) => (
  replaceCurrentExcelAttachment(
    attachments,
    attachments.filter(item => item.kind === "excel").slice(-1)[0] || null,
  )
);

const handleSelectedFiles = async (files: File[]) => {
  if (!files.length) return;

  const acceptedFiles = files.filter(file => matchesAiAttachmentAccept(file, props.attachmentAccept));
  const rejectedFiles = files.filter(file => !matchesAiAttachmentAccept(file, props.attachmentAccept));

  if (rejectedFiles.length) {
    ElMessage.warning(buildRejectedFilesMessage(rejectedFiles));
  }

  if (!acceptedFiles.length) return;

  const attachments = (await Promise.all(acceptedFiles.map(async (file) => {
    const attachment = buildLocalAttachment(file);
    if (!props.deferAttachmentUpload && attachment.kind === "excel") {
      return await uploadExcelAttachment(attachment, file);
    }
    return attachment;
  }))).filter(Boolean) as AiAttachment[];
  const mergedAttachments = props.deferAttachmentUpload
    ? [...resolvedAttachments.value, ...attachments].slice(0, 5)
    : replaceExcelAttachment([...resolvedAttachments.value, ...attachments]);
  const nextAttachments = mergedAttachments.slice(0, 5);
  if (resolvedAttachments.value.length + attachments.length > 5) {
    ElMessage.warning(i18next.t('WorkbenchAiChatInput.attachmentLimit', {
      defaultValue: '每次最多上传 5 个附件',
    }));
  }
  if (!Array.isArray(props.attachments)) {
    localAttachments.value = nextAttachments;
  }
  attachments.forEach((attachment) => {
    emitAttachmentChange("select-attachment", attachment, nextAttachments);
  });
};

const hasDraggedFiles = (event: DragEvent) => (
  Array.from(event.dataTransfer?.types || []).includes("Files")
);

const resetFileDrag = () => {
  fileDragDepth.value = 0;
  isFileDragActive.value = false;
};

const handleDragEnter = (event: DragEvent) => {
  if (!props.showAttachmentButton || props.submitting || !hasDraggedFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  fileDragDepth.value += 1;
  isFileDragActive.value = true;
};

const handleDragOver = (event: DragEvent) => {
  if (!props.showAttachmentButton || props.submitting || !hasDraggedFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
};

const handleDragLeave = (event: DragEvent) => {
  if (!isFileDragActive.value) return;
  event.preventDefault();
  event.stopPropagation();
  fileDragDepth.value = Math.max(0, fileDragDepth.value - 1);
  if (fileDragDepth.value === 0) isFileDragActive.value = false;
};

const handleDrop = async (event: DragEvent) => {
  if (!hasDraggedFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  const files = Array.from(event.dataTransfer?.files || []);
  const canAddFiles = props.showAttachmentButton && !props.submitting;
  resetFileDrag();
  if (canAddFiles) await handleSelectedFiles(files);
};

const ensureFileInput = () => {
  if (fileInputRef.value) {
    return fileInputRef.value;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.style.display = "none";
  input.accept = props.attachmentAccept;
  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    await handleSelectedFiles(files);
    input.value = "";
  });
  document.body.appendChild(input);
  fileInputRef.value = input;
  return input;
};

const handleSelectAttachment = () => {
  if (props.submitting) return;
  ensureFileInput().click();
};

const handleRemoveAttachment = (attachment: AiAttachment) => {
  if (props.submitting) return;
  const nextAttachments = resolvedAttachments.value.filter(item => item.id !== attachment.id);
  if (!Array.isArray(props.attachments)) {
    localAttachments.value = nextAttachments;
  }
  revokeAttachmentUrl(attachment);
  emitAttachmentChange("remove-attachment", attachment, nextAttachments);
};

const focusTextarea = async () => {
  await nextTick();
  textareaRef.value?.focus();
};

const setValue = (value: string) => {
  inputValue.value = value;
};

onBeforeUnmount(() => {
  resetFileDrag();
  if (fileInputRef.value?.parentNode) {
    fileInputRef.value.parentNode.removeChild(fileInputRef.value);
  }
  fileInputRef.value = null;
  revokeLocalAttachmentUrls();
});

defineExpose({
  focusTextarea,
  setValue,
});
</script>

<style scoped lang="scss">
.workbench-ai-chat-input {
  position: relative;
  width: 100%;
  max-width: var(--workbench-ai-chat-content-max-width, 800px);
  border: 1px solid #e5e6eb;
  border-radius: 16px;
  background-color: #ffffff;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
  // 不作用于border-color
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, padding 0.2s ease, gap 0.2s ease, width 0.2s ease, max-width 0.2s ease, height 0.2s ease;

  &.is-file-dragging {
    border-color: #0873ff;
    box-shadow: 0 0 0 3px rgba(8, 115, 255, 0.1), 0 12px 30px rgba(29, 33, 41, 0.12);
  }

  .workbench-ai-chat-input__drop-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    box-sizing: border-box;
    border: 1px dashed rgba(8, 115, 255, 0.72);
    border-radius: inherit;
    background: rgba(248, 251, 255, 0.96);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    color: #1d2129;
    pointer-events: none;
  }

  .workbench-ai-chat-input__drop-icon {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: #0873ff;
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 18px rgba(8, 115, 255, 0.22);
  }

  .workbench-ai-chat-input__drop-copy {
    min-width: 0;
    text-align: center;
  }

  .workbench-ai-chat-input__drop-title {
    font-size: 14px;
    font-weight: 600;
    line-height: 22px;
  }

  .workbench-ai-chat-input__drop-description {
    margin-top: 2px;
    color: #86909c;
    font-size: 12px;
    line-height: 18px;
  }

  &.is-floating {
    box-shadow: 0px 8px 20px 0px #0000001a;

    .workbench-ai-chat-input__editor {
      animation: workbench-ai-chat-input-editor-fade-in 0.2s ease;
    }
  }

  &.is-entry {
    max-width: 320px;
    height: 56px;
    padding: 0;
    padding-left: 20px;
    padding-right: 10px;
    border-radius: 28px;
    gap: 16px;
    box-shadow: 0px 8px 20px 0px #0000001a;
    cursor: var(--cursor-pointer);

    &:hover {
      border-color: #0873ff;
    }

    .workbench-ai-chat-input__drop-overlay {
      flex-direction: row;
      gap: 8px;
    }

    .workbench-ai-chat-input__drop-icon {
      width: 30px;
      height: 30px;
      border-radius: 9px;
    }

    .workbench-ai-chat-input__drop-title {
      font-size: 13px;
      line-height: 20px;
    }

    .workbench-ai-chat-input__drop-description {
      display: none;
    }
  }

  .workbench-ai-chat-input__editor {
    display: grid;
    box-sizing: border-box;
    min-height: 32px;
    max-height: 184px;
    overflow-y: hidden;
  }

  .workbench-ai-chat-input__attachment-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .workbench-ai-chat-input__attachment-chip {
    min-width: 0;
    padding: 8px 10px;
    border-radius: 16px;
    background: #f7f8fa;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid transparent;

    &.is-error {
      border-color: #ffccc7;
      background: #fff2f0;
    }
  }

  .workbench-ai-chat-input__attachment-preview,
  .workbench-ai-chat-input__attachment-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #ffffff;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    color: #4e5969;
  }

  .workbench-ai-chat-input__attachment-preview-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .workbench-ai-chat-input__attachment-meta {
    min-width: 0;
    flex: 1;
  }

  .workbench-ai-chat-input__attachment-name {
    color: #1d2129;
    font-size: 13px;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workbench-ai-chat-input__attachment-caption {
    color: #86909c;
    font-size: 12px;
    line-height: 18px;
  }

  .workbench-ai-chat-input__attachment-remove {
    width: 24px;
    min-width: 24px;
    height: 24px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #86909c;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: var(--cursor-pointer);
    transition: background-color 0.2s ease, color 0.2s ease;

    &:hover {
      background: #e5e6eb;
      color: #1d2129;
    }
  }

  .workbench-ai-chat-input__textarea {
    grid-area: 1 / 1;
    box-sizing: border-box;
    width: 100%;
    min-height: 32px;
    max-height: 184px;
    padding: 4px;
    font-size: 16px;
    line-height: 24px;
    white-space: pre-wrap;
    word-break: break-word;

    &::placeholder {
      color: #c9cdd4;
      font-size: 16px;
      line-height: 24px;
    }
  }

  .workbench-ai-chat-input__textarea--field {
    border: 0;
    resize: none;
    background: transparent;
    color: #1d2129;
    outline: none;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: #c9cdd4 transparent;
    transition: all 0.2s ease;
  }

  .workbench-ai-chat-input__textarea--field::-webkit-scrollbar {
    width: 6px;
  }

  .workbench-ai-chat-input__textarea--field::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #c9cdd4;
  }

  .workbench-ai-chat-input__textarea--field::-webkit-scrollbar-track {
    background: transparent;
  }

  .workbench-ai-chat-input__textarea--mirror {
    visibility: hidden;
    pointer-events: none;
  }

  .workbench-ai-chat-input__placeholder {
    min-width: 0;
    font-size: 16px;
    line-height: 24px;
    color: var(--text-color-secondary);
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .workbench-ai-chat-input__actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 28px;
  }

  .workbench-ai-chat-input__tools {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .workbench-ai-chat-input__model {
    max-width: 170px;
    min-width: 100px;
    height: 32px;
    flex: 0 1 auto;
  }

  .workbench-ai-chat-input__model-trigger {
    width: 100%;
    max-width: 170px;
    min-width: 100px;
    height: 32px;
    padding: 0 12px 0 14px;
    border: 1px solid #c9cdd4;
    border-radius: 18px;
    background: #ffffff;
    color: #4e5969;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: var(--cursor-pointer);
    transition: border-color 0.2s ease, background-color 0.2s ease;

    &:hover,
    &.is-open {
      border-color: #86909c;
      background: #f7f8fa;
    }

    &:disabled {
      cursor: default;
      opacity: 0.6;
    }
  }

  .workbench-ai-chat-input__model-trigger-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    line-height: 20px;
  }

  .workbench-ai-chat-input__model-trigger-arrow {
    flex-shrink: 0;
    transition: transform 0.2s ease;
  }

  .workbench-ai-chat-input__model-trigger.is-open .workbench-ai-chat-input__model-trigger-arrow {
    transform: rotate(180deg);
  }

  .workbench-ai-chat-input__model-label {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    background: #f5f5f3;
    box-shadow: inset 0 0 0 1px #ebe9e4;
    color: #3d3d3a;
    font-size: 12px;
    line-height: 34px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .workbench-ai-chat-input__button {
    width: 28px;
    min-width: 28px;
    height: 28px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #4e5969;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease, color 0.2s ease;
    cursor: var(--cursor-pointer);

    &.is-ghost:hover {
      background-color: #f2f3f5;
      color: #1d2129;
    }

    &.is-primary {
      background: var(--Primary-primary-4, #8ecaff);
      color: #ffffff;

      &.is-active {
        background-color: #0873ff;

        &:hover {
          background-color: #2d88ff;
        }
      }

      &:disabled {
        cursor: default;
        opacity: 0.6;
      }
    }

    .workbench-ai-ball-content {
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 20px;
      column-gap: 7px;
    }
  }

  &.is-entry {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16px;

    .workbench-ai-chat-input__placeholder {
      flex: 1;
      opacity: 1;
    }

    .workbench-ai-chat-input__actions {
      margin-left: auto;
    }

    .workbench-ai-chat-input__attachment-list {
      display: none;
    }

    .workbench-ai-chat-input__button.is-primary {
      background: #0873ff;

      &:hover {
        background: #0873ff;
      }

      &.is-mini-ball {
        width: 68px;
        min-width: 68px;
        height: 36px;
        border-radius: 20px;
        background: linear-gradient(180deg, #3593FF 0%, #0873FF 100%);
      }
    }
  }
}

:global(.workbench-ai-chat-input__model-popper.el-popover) {
  padding: 0;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(29, 33, 41, 0.16);
  overflow: hidden;
}

.workbench-ai-chat-input__model-menu {
  width: 100%;
}

.workbench-ai-chat-input__model-search {
  height: 54px;
  padding: 0 16px;
  border-bottom: 1px solid #e5e6eb;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #86909c;

  input {
    min-width: 0;
    flex: 1;
    border: 0;
    outline: 0;
    background: transparent;
    color: #1d2129;
    font-size: 14px;
    line-height: 22px;

    &::placeholder {
      color: #86909c;
    }
  }
}

.workbench-ai-chat-input__model-list {
  max-height: 280px;
  padding: 8px;
  overflow-y: auto;
}

.workbench-ai-chat-input__model-group {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: #86909c;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: var(--cursor-pointer);

  .el-icon {
    transition: transform 0.2s ease;
  }

  .el-icon.is-collapsed {
    transform: rotate(-90deg);
  }
}

.workbench-ai-chat-input__model-group-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.workbench-ai-chat-input__model-option {
  width: 100%;
  height: 40px;
  padding: 0 12px 0 16px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #1d2129;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  text-align: left;
  cursor: var(--cursor-pointer);

  &:hover {
    background: #f2f3f5;
  }

  &.is-selected {
    background: #e8f3ff;
    color: #0873ff;
  }
}

.workbench-ai-chat-input__model-option-dot {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #c9cdd4;
}

.workbench-ai-chat-input__model-option.is-selected .workbench-ai-chat-input__model-option-dot {
  background: #8ecaff;
}

.workbench-ai-chat-input__model-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-ai-chat-input__model-empty {
  padding: 32px 12px;
  color: #86909c;
  font-size: 13px;
  text-align: center;
}

@keyframes workbench-ai-chat-input-editor-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.workbench-ai-chat-input-drop-enter-active,
.workbench-ai-chat-input-drop-leave-active {
  transition: opacity 0.16s ease;
}

.workbench-ai-chat-input-drop-enter-from,
.workbench-ai-chat-input-drop-leave-to {
  opacity: 0;
}
</style>
