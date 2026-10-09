<template>
  <div class="view-action-field-value-input">
    <div
      v-if="[FormWidgetType.DEPARTMENT_SELECT, FormWidgetType.MEMBER_SELECT].includes(widgetType)"
      class="organize-trigger"
      :class="{ active: hasOrganizeValue }"
      @click="handleOpenOrganize"
    >
      {{
        hasOrganizeValue
          ? (widgetType === FormWidgetType.DEPARTMENT_SELECT ? $t("ViewActionFieldValueInput.selectedDepartment") : $t("ViewActionFieldValueInput.selectedMember"))
          : (widgetType === FormWidgetType.DEPARTMENT_SELECT ? $t("ViewActionFieldValueInput.selectDepartment") : $t("ViewActionFieldValueInput.selectMember"))
      }}
    </div>

    <div v-else-if="isUploadWidget" class="upload-value-wrapper">
      <div v-if="uploadFiles.length" class="upload-file-list">
        <div
          v-for="(file, index) in uploadFiles"
          :key="file.uid || `${file.url}-${index}`"
          class="upload-file-item"
        >
          <el-image
            v-if="widgetType === FormWidgetType.IMAGE_UPLOADER"
            class="upload-image-preview"
            :src="file.url"
            fit="cover"
            :preview-src-list="uploadPreviewUrls"
            :initial-index="index"
            preview-teleported
          />
          <div v-else class="upload-file-icon">
            <el-icon><Document /></el-icon>
          </div>

          <div class="upload-file-meta">
            <div class="upload-file-name" :title="file.name">{{ file.name }}</div>
            <div v-if="file.size" class="upload-file-size">{{ diskSize(file.size) }}</div>
          </div>

          <el-button link type="danger" @click="handleRemoveUploadFile(index)">{{ $t("ViewActionFieldValueInput.delete") }}</el-button>
        </div>
      </div>

      <el-upload
        ref="uploadRef"
        class="upload-trigger"
        :auto-upload="true"
        :show-file-list="false"
        :multiple="isUploadMultiple"
        :accept="uploadAccept"
        :http-request="handleUploadRequest"
      >
        <el-button type="primary" plain :loading="isUploading">
          {{ uploadButtonText }}
        </el-button>
      </el-upload>
    </div>

    <el-config-provider v-else-if="widgetType === FormWidgetType.DATE_PICKER" :locale="elementPlusLocale">
      <el-date-picker
        class="value-input"
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        :type="datePickerType"
        :format="datePickerFormat"
        value-format="YYYY-MM-DD HH:mm:ss"
        :placeholder="$t('ViewActionFieldValueInput.pleaseSelect')"
      />
    </el-config-provider>

    <el-config-provider v-else-if="widgetType === FormWidgetType.TIME_PICKER" :locale="elementPlusLocale">
      <el-time-picker
        class="value-input"
        :model-value="modelValue"
        @update:model-value="emit('update:modelValue', $event)"
        format="HH:mm:ss"
        value-format="HH:mm:ss"
        :placeholder="$t('ViewActionFieldValueInput.pleaseSelect')"
      />
    </el-config-provider>

    <el-select
      v-else-if="isChoiceWidget"
      class="value-input"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :multiple="isMultipleChoiceWidget"
      collapse-tags
      clearable
      :placeholder="$t('ViewActionFieldValueInput.pleaseSelect')"
    >
      <el-option
        v-for="item in choiceOptions"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>

    <el-input-tag
      v-else-if="widgetType === FormWidgetType.TAG_INPUT"
      class="value-input"
      :model-value="Array.isArray(modelValue) ? modelValue : []"
      @update:model-value="emit('update:modelValue', $event)"
      collapse-tags
      collapse-tags-tooltip
      :placeholder="$t('ViewActionFieldValueInput.pleaseInput')"
    />

    <el-tree-select
      v-else-if="widgetType === FormWidgetType.ADDRESS"
      class="value-input"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      lazy
      :load="loadNode"
      node-key="value"
      :render-after-expand="false"
      clearable
      filterable
      check-strictly
      :highlight-current="true"
      :show-path="true"
      :empty-text="$t('ViewActionFieldValueInput.noData')"
      :props="{
        label: 'label',
        value: 'value',
        children: 'children',
        isLeaf: 'isLeaf',
      }"
      :placeholder="$t('ViewActionFieldValueInput.pleaseSelect')"
    />

    <el-rate
      v-else-if="widgetType === FormWidgetType.RATE"
      class="value-rate"
      :model-value="Number(modelValue || 0)"
      @update:model-value="emit('update:modelValue', $event)"
      allow-half
      show-score
    />

    <el-switch
      v-else-if="widgetType === FormWidgetType.SWITCH"
      :model-value="!!modelValue"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <el-input
      v-else-if="isNumberWidget"
      class="value-input"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      type="number"
      :placeholder="$t('ViewActionFieldValueInput.pleaseInput')"
      @blur="handleNumberBlur"
    />

    <el-input
      v-else-if="isTextareaWidget"
      class="value-input"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      type="textarea"
      :rows="3"
      :placeholder="$t('ViewActionFieldValueInput.pleaseInput')"
    />

    <el-input
      v-else
      class="value-input"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :placeholder="$t('ViewActionFieldValueInput.pleaseInput')"
      clearable
    />

    <teleport to="body">
      <organize-manager-dialog
        ref="organizeManageDialogRef"
        :isInWidget="false"
        :multiple="organizeDialogMultiple"
        :currentType="organizeDialogType"
        :dialogTitle="organizeDialogTitle"
        :tableList="organizeDialogTableList"
        @confirm="handleOrganizeConfirm"
      />
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import i18next from "i18next";
import { Document } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import type { UploadInstance, UploadRequestOptions } from "element-plus";
import { elementPlusLocale } from "@renderer/utils/elementPlusLocale";
import { unique } from "@common/utils/unique";
import { formatFloat } from "@common/utils/math";
import { diskSize } from "@common/utils";
import { isViewActionUploadField, isViewActionUploadFieldMultiple } from "@common/utils/viewAction";
import { FormWidgetType } from "@common/types/nocode";
import { Field, FlowOpinionFile } from "@common/types/project";
import { normalizeFlowOpinionFile, uploadFlowOpinionFile } from "@renderer/views/nocode/utils/flow-opinion";
import { getChinaAddressData } from "@renderer/utils/township";
import { ORGANIZE_UTIL } from "@renderer/types";

const props = defineProps<{
  modelValue: any,
  field?: Field | null,
  nocodeId?: string,
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: any): void,
}>();

const organizeUtil = inject(ORGANIZE_UTIL);
const organizeManageDialogRef = ref();
const uploadRef = ref<UploadInstance>();
const uploadingCount = ref(0);
const currentUploadFiles = ref<FlowOpinionFile[]>([]);

const widgetType = computed<FormWidgetType>(() => {
  return (props.field?.meta?.extra?.widgetType as FormWidgetType);
});

const choiceWidgetTypes = [
  FormWidgetType.TREE_MULTIPLE_SELECT,
  FormWidgetType.CHECKBOX_GROUP,
  FormWidgetType.TREE_SELECT,
  FormWidgetType.RADIO_GROUP,
];

const multipleChoiceWidgetTypes = [
  FormWidgetType.TREE_MULTIPLE_SELECT,
  FormWidgetType.CHECKBOX_GROUP,
];

const numberWidgetTypes = [
  FormWidgetType.NUMBER_INPUT,
  FormWidgetType.AMOUNT_INPUT,
  FormWidgetType.AUTO_COMPUTE,
];

const textareaWidgetTypes = [
  FormWidgetType.TEXTAREA,
  FormWidgetType.RICH_TEXT_EDITOR,
  FormWidgetType.MARKDOWN_EDITOR,
];

const isChoiceWidget = computed(() => choiceWidgetTypes.includes(widgetType.value));
const isMultipleChoiceWidget = computed(() => multipleChoiceWidgetTypes.includes(widgetType.value));
const isNumberWidget = computed(() => numberWidgetTypes.includes(widgetType.value));
const isTextareaWidget = computed(() => textareaWidgetTypes.includes(widgetType.value));
const isUploadWidget = computed(() => isViewActionUploadField(props.field));
const isUploadMultiple = computed(() => isViewActionUploadFieldMultiple(props.field));
const isUploading = computed(() => uploadingCount.value > 0);

const getUploadFallbackName = (url = "") => {
  const cleanValue = url.split("?")[0]?.split("#")[0] || "";
  const fileName = cleanValue.split("/").pop() || "unnamed-file";
  try {
    return decodeURIComponent(fileName);
  } catch (_error) {
    return fileName;
  }
};

const normalizeUploadFiles = (value: any): FlowOpinionFile[] => {
  const candidates = Array.isArray(value)
    ? value
    : [value].filter(Boolean);

  return candidates
    .map((item) => {
      if (typeof item === "string") {
        return normalizeFlowOpinionFile({
          uid: unique(),
          name: getUploadFallbackName(item),
          status: "success",
          url: item,
        });
      }
      return normalizeFlowOpinionFile(item);
    })
    .filter(Boolean) as FlowOpinionFile[];
};

const uploadFiles = computed(() => {
  return normalizeUploadFiles(props.modelValue);
});

watch(uploadFiles, (value) => {
  currentUploadFiles.value = value;
}, { immediate: true, deep: true });

const uploadPreviewUrls = computed(() => uploadFiles.value.map(file => file.url));

const uploadAccept = computed(() => (
  widgetType.value === FormWidgetType.IMAGE_UPLOADER ? "image/*" : undefined
));

const uploadButtonText = computed(() => {
  if (widgetType.value === FormWidgetType.IMAGE_UPLOADER) {
    return isUploadMultiple.value
      ? i18next.t("ViewActionFieldValueInput.uploadImage")
      : i18next.t("ViewActionFieldValueInput.selectImage");
  }
  return isUploadMultiple.value
    ? i18next.t("ViewActionFieldValueInput.uploadFile")
    : i18next.t("ViewActionFieldValueInput.selectFile");
});

const emitUploadFiles = (files: FlowOpinionFile[]) => {
  currentUploadFiles.value = files;
  emit("update:modelValue", isUploadMultiple.value ? files : (files[0] || null));
};

const handleRemoveUploadFile = (index: number) => {
  const nextFiles = currentUploadFiles.value.filter((_, currentIndex) => currentIndex !== index);
  emitUploadFiles(nextFiles);
};

const handleUploadRequest = async (options: UploadRequestOptions) => {
  if (!props.nocodeId) {
    const error = new Error(i18next.t("ViewActionFieldValueInput.missingNocodeContext"));
    ElMessage.error(error.message);
    options.onError?.(error as any);
    return;
  }

  uploadingCount.value += 1;
  try {
    const uploadedFile = await uploadFlowOpinionFile(props.nocodeId, options.file as File);
    if (!uploadedFile) {
      throw new Error(i18next.t("ViewActionFieldValueInput.uploadFailed"));
    }

    const nextFiles = isUploadMultiple.value
      ? [...currentUploadFiles.value, uploadedFile]
      : [uploadedFile];
    emitUploadFiles(nextFiles);
    options.onSuccess?.(uploadedFile as any);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : i18next.t("ViewActionFieldValueInput.uploadFailed");
    ElMessage.error(message);
    options.onError?.(error as any);
  } finally {
    uploadingCount.value = Math.max(uploadingCount.value - 1, 0);
    uploadRef.value?.clearFiles();
  }
};

const datePickerType = computed(() => {
  const subType = props.field?.meta?.subType;
  if (["date", "dates", "week", "month", "year"].includes(subType || "")) {
    return subType as "date" | "dates" | "week" | "month" | "year";
  }
  return "datetime";
});

const datePickerFormat = computed(() => {
  switch (datePickerType.value) {
    case "date":
    case "dates":
      return "YYYY-MM-DD";
    case "month":
      return "YYYY-MM";
    case "year":
      return "YYYY";
    default:
      return "YYYY-MM-DD HH:mm:ss";
  }
});

const choiceOptions = computed(() => {
  const normalize = (items: any[] = [], prefix = ""): Array<{ label: string, value: any }> => {
    return items.flatMap((item) => {
      if (!item) return [];
      const label = prefix ? `${prefix} / ${item.label}` : item.label;
      if (Array.isArray(item.children) && item.children.length) {
        return normalize(item.children, label);
      }
      return [{
        label,
        value: item.value,
      }];
    });
  };

  return normalize(props.field?.meta?.extra?.choices || []);
});

const hasOrganizeValue = computed(() => {
  return Array.isArray(props.modelValue) ? props.modelValue.length > 0 : !!props.modelValue;
});

const organizeDialogType = computed(() => (
  widgetType.value === FormWidgetType.DEPARTMENT_SELECT ? "department" : "member"
));

const organizeDialogTitle = computed(() => (
  widgetType.value === FormWidgetType.DEPARTMENT_SELECT
    ? i18next.t("ViewActionFieldValueInput.selectDepartment")
    : i18next.t("ViewActionFieldValueInput.selectMember")
));

const organizeDialogMultiple = computed(() => !!props.field?.meta?.extra?.isMultiple);

const buildDebugUsersByIds = (stage: string, userIds: any[] = []) => {
  const normalizedUserIds = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
  const organizeUsers = organizeUtil?.allUsers?.length ? organizeUtil.allUsers : (organizeUtil?.users || []);
  const matchedUsers = normalizedUserIds
    .map(id => organizeUsers.find(user => user.id === id))
    .filter(Boolean);

  return matchedUsers;
}

const organizeDialogTableList = computed(() => {
  const ids = Array.isArray(props.modelValue)
    ? props.modelValue
    : [props.modelValue].filter(Boolean);

  return {
    departments: organizeDialogType.value === "department"
      ? ids.map(id => organizeUtil?.departments?.find(item => item.id === id)).filter(Boolean)
      : [],
    roles: [],
    users: organizeDialogType.value === "member"
      ? buildDebugUsersByIds('organizeDialogTableList.users', ids)
      : [],
    dynamic: [],
  };
});

const handleOpenOrganize = () => {
  if (organizeDialogType.value === 'member') {
    const ids = Array.isArray(props.modelValue)
      ? props.modelValue
      : [props.modelValue].filter(Boolean);
    buildDebugUsersByIds('handleOpenOrganize', ids);
  }
  organizeManageDialogRef.value?.show();
};

const handleOrganizeConfirm = (data: any) => {
  if (organizeDialogType.value === "department") {
    emit("update:modelValue", data.departments?.map(item => item.id) || []);
    return;
  }
  emit("update:modelValue", data.users?.map(item => item.id) || []);
};

const handleNumberBlur = () => {
  if (!props.field) return;
  if (props.modelValue === "" || props.modelValue === null || props.modelValue === undefined) {
    return;
  }
  const { decimalPlaces, completeZero } = props.field.meta?.extra || {};
  emit("update:modelValue", formatFloat(Number(props.modelValue), decimalPlaces, completeZero));
};

const chinaAddressData = getChinaAddressData();

const findNodeByValue = (data: any[], value: any): any => {
  for (const node of data) {
    if (node.value === value) {
      return node;
    }
    if (Array.isArray(node.children) && node.children.length) {
      const found = findNodeByValue(node.children, value);
      if (found) return found;
    }
  }
  return null;
};

const loadNode = (node: any, resolve: (data: any[]) => void) => {
  if (!node?.label) {
    resolve(chinaAddressData.map(({ children, ...rest }) => ({
      ...rest,
      isLeaf: !children || children.length === 0,
    })));
    return;
  }

  if (!node.data?.value) {
    resolve([]);
    return;
  }

  const match = findNodeByValue(chinaAddressData, node.data.value);
  if (!match?.children) {
    resolve([]);
    return;
  }

  resolve(match.children.map(({ children, ...rest }) => ({
    ...rest,
    isLeaf: !children || children.length === 0,
  })));
};
</script>

<style scoped lang="scss">
.view-action-field-value-input {
  width: 100%;
}

.value-input {
  width: 100%;
}

.value-rate {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
}

.organize-trigger {
  width: 100%;
  min-height: 32px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background-color: #fff;
  color: var(--el-text-color-placeholder);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover,
  &.active {
    border-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }
}

.upload-value-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.upload-file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.upload-file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: #fff;
}

.upload-image-preview {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.upload-file-icon {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  background-color: var(--el-fill-color-light);
  color: var(--el-color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.upload-file-meta {
  min-width: 0;
  flex: 1;
}

.upload-file-name {
  color: var(--text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-file-size {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.upload-trigger {
  width: fit-content;
}

:deep(.el-textarea__inner) {
  min-height: 72px;
}
</style>
