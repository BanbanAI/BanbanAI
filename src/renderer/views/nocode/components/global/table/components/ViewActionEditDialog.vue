<template>
  <div class="view-action-edit-dialog">
    <el-dialog
      class="action-edit-dialog"
      :modelValue="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      @closed="handleClear"
      :close-on-click-modal="false"
      :destroy-on-close="true"
      :show-close="false"
      :fullscreen="isMobileDevice"
      :width="isMobileDevice ? '100%' : '720px'"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <div class="dialog-title">{{ title }}</div>
          <el-button link @click="handleClose">
            <el-icon :size="16"><i-ep-close /></el-icon>
          </el-button>
        </div>
      </template>

      <div class="dialog-content">
        <nocode-form
          v-if="isShowForm && modelValue"
          ref="editingFormRef"
          v-bind="nocodeFormProps"
          :visibleFieldIds="visibleFieldIds"
        />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleClose">{{ $t('MobileDataFormDialog.cancel') }}</el-button>
          <el-button type="primary" :loading="isSubmitting" @click="handleSubmit">
            {{ $t('MobileDataFormDialog.submit') }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <form-save-tip-dialog ref="saveTipDialogRef" :title="$t('DataFormDialog.isSave')" />
  </div>
</template>

<script setup lang="ts">
import { ElLoading, ElMessage } from "element-plus";
import { computed, ref } from "vue";
import i18next from "i18next";
import { ViewActionFieldId } from "@common/types/nocode";
import NocodeForm from "@renderer/views/nocode/components/NocodeForm.vue";
import { isMobile } from "@renderer/utils";
import { provideFormMode } from "../hooks";
import { FormMode } from "../types";

const props = defineProps<{
  modelValue: boolean,
  title: string,
  nocodeFormProps: any,
  visibleFieldIds?: ViewActionFieldId[],
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void,
  (e: "submitted"): void,
}>();

const isMobileDevice = isMobile();
const saveTipDialogRef = ref();
const editingFormRef = ref();
const isSubmitting = ref(false);
const isShowForm = ref(true);

const formMode = computed(() => FormMode.Edit);
provideFormMode(formMode);

const handleSubmit = async () => {
  if (!editingFormRef.value) return;
  const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.();
  if (!confirmed) {
    editingFormRef.value?.clearSubmitValidationNotice?.();
    return;
  }
  isSubmitting.value = true;
  const loadingInstance = ElLoading.service({
    target: ".action-edit-dialog",
    text: i18next.t('DataFormDialog.submiting'),
    background: "rgba(0, 0, 0, 0.2)",
  });

  try {
    const result = await editingFormRef.value.submit({ skipSubmitValidationNoticeConfirm: true, skipSubmitSignSyncConfirm: true });
    if (!result) {
      return;
    }
    ElMessage.success(i18next.t('DataFormDialog.editSuccess'));
    emit("submitted");
    emit("update:modelValue", false);
  } finally {
    loadingInstance.close();
    isSubmitting.value = false;
  }
}

const handleClose = async () => {
  const isModified = editingFormRef.value?.isModified?.();
  if (isModified) {
    const isSave = await saveTipDialogRef.value?.confirm();
    if (isSave) {
      await handleSubmit();
      return;
    }
  }
  emit("update:modelValue", false);
}

const handleClear = () => {
  isShowForm.value = true;
  isSubmitting.value = false;
}
</script>

<style scoped lang="scss">
.view-action-edit-dialog {
  :deep(.el-dialog) {
    background-color: #fff;
    border-radius: 4px;
    padding: 0;

    .el-dialog__header {
      padding: 8px 16px;
      border-bottom: 1px solid #ebeef5;
    }

    .el-dialog__body {
      max-height: min(70vh, 720px);
      overflow: auto;
      padding-top: 16px;
    }

    .el-dialog__footer {
      border-top: 1px solid #ebeef5;
      padding: 16px 24px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    }

    .dialog-title {
      font-size: 16px;
      font-weight: 500;
      line-height: 24px;
      color: var(--text-color-primary);
    }

    .dialog-content {
      min-height: 120px;
    }

    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;

      .el-button {
        border-radius: 4px;
      }
    }
  }
}
</style>
