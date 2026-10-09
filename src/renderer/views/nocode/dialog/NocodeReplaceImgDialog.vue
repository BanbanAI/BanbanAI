<template>
  <div class="report-replace-img-dialog">
    <el-dialog :model-value="modelValue"
      :title="$t('reportReplaceImgDialog.title')"
      @update:model-value="emit('update:modelValue', $event)" destroy-on-close
      @close="handleClose" @closed="handleClosed" :close-on-click-modal="false" draggable align-center width="348">
      <nocode-img-core ref="nocodeImgCoreRef" :nocode="nocode"></nocode-img-core>
      <template #footer>
        <el-button @click="handleClose">{{ $t("reportReplaceImgDialog.cancel") }}</el-button>
        <el-button type="primary" @click="handleConfirm">{{ $t("reportReplaceImgDialog.confirm") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue';
import { NocodeBody, NocodeCoverSummary, NocodeMeta } from '@common/types/nocode';
import { NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { projectApi } from '@renderer/utils/api/project';

const props = defineProps<{
  modelValue: boolean;
  nocode?: NocodeMeta;
  nocodeBody?: NocodeBody
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'updateNocodeCoverImage', nocodeId: string, cover?: NocodeCoverSummary, snapshot?: NocodeBody['snapshot']): void;
}>();

const nocodeImgCoreRef = ref(null)
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null)

const handleConfirm = async () => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  const formData = await nocodeImgCoreRef.value.getFormData()
  if (!formData || !props.nocode?.id) return;

  const result = await projectApi.uploadNocodeSnapshot({
    nocodeId: props.nocode.id,
    formData,
    sign: props.nocodeBody?.sign,
  }).catch((err) => {
    handleNocodeSyncConflictError(err, nocodeSignIsLatest)
    console.log('snapshot save failed: ', err);
  });
  if (result) {
    nocodeImgCoreRef.value.handleAddVersion()
    const mainSign = result.sign;
    if (props.nocodeBody && mainSign) props.nocodeBody.sign = mainSign;
    handleClose();
    emit('updateNocodeCoverImage', props.nocode.id, result.cover, result.snapshot);
  }
};

const handleClose = () => {
  emit('update:modelValue', false);
}
const handleClosed = () => {
  nocodeImgCoreRef.value.closeClear()
}
</script>

<style scoped lang='scss'>
.report-replace-img-dialog {
  :deep(.el-dialog) {
    background-color: var(--bg-color-page);
    padding: 0;
    border-radius: 4px;

    .el-dialog__header {
      padding: 8px 0;
      text-align: center;
      border-bottom: 1px solid var(--border-color);

      &>span {
        font-size: 14px;
      }

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }

      .el-dialog__close {
        font-size: 16px;
      }
    }

    .title {
      font-size: 14px;
    }

    .el-dialog__body {
      padding: 24px;
    }

    .vn-stack {
      margin-top: 2px;

      .el-radio-group {
        margin-bottom: 12px;
      }
    }

    .el-dialog__footer {
      padding: 0 24px 24px 0;
      .el-button {
        width: 60px;
        height: 32px;
        border-radius: 4px;
        cursor: var(--cursor-pointer);
      }
    }
  }
}
</style>
