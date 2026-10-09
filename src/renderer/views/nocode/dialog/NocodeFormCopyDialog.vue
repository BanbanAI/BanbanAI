<template>
  <div class="nocode-form-copy-dialog">
    <el-dialog 
      :modelValue="modelValue" 
      @update:modelValue="emit('update:modelValue', $event)" 
      draggable
      :title="title" 
      width="400px" 
      destroy-on-close 
      ref="dialogRef"
      :close-on-click-modal="false" 
      align-center 
      @opened="handleOpened"
    >
      <div class="content" v-if="props.copyType === 'form'">
        <el-form label-width="auto">
          <div class="label">{{ $t('nocodeFormCopyDialog.formLabel') }}{{ getI18nLabelColon() }}</div>
          <el-form-item>
            <el-input v-model="newFormName" autocomplete="off" ref="inputRef" @keydown.enter="handleConfirm" />
          </el-form-item>
        </el-form>
      </div>
      <div class="content" v-if="props.copyType === 'page'">
        <el-form label-width="auto">
          <div class="label">{{ $t('nocodeFormCopyDialog.pageLabel') }}{{ getI18nLabelColon() }}</div>
          <el-form-item>
            <el-input v-model="newPageName" autocomplete="off" ref="inputRef" @keydown.enter="handleConfirm" />
          </el-form-item>
        </el-form>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="handleCancel" style="margin-right: 10px;">{{ $t('nocodeFormCopyDialog.cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm">{{ $t('nocodeFormCopyDialog.confirm') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { ElMessage, InputInstance } from 'element-plus';
import i18next from 'i18next';
import { ref, computed } from 'vue';
import { getI18nLabelColon } from '@common/utils/i18n';

const props = defineProps<{
  modelValue: boolean,
  tableName: string,
  pageName: string,
  copyType: string,
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
  (event: 'confirmCopyForm', value: string)
  (event: 'confirmCopyPage', value: string)
}>();

const inputRef = ref<InputInstance>();
const newFormName = ref("");
const newPageName = ref("");

const title = computed(() => {
  return props.copyType === 'form' ? i18next.t('nocodeFormCopyDialog.formTitle') : i18next.t('nocodeFormCopyDialog.pageTitle');
})

const handleOpened = () => {
  newFormName.value = `${props.tableName}(${i18next.t('nocodeFormCopyDialog.duplicate')})`;
  newPageName.value = `${props.pageName}(${i18next.t('nocodeFormCopyDialog.duplicate')})`;
  inputRef.value?.focus()
}
const handleCancel = () => {
  emit('update:modelValue', false);
}
const handleConfirm = () => {
  if(props.copyType === 'form') {
    if (!newFormName.value) {
      ElMessage.error(i18next.t('nocodeFormCopyDialog.emptyFormError'));
      return inputRef.value?.focus();
    }

    emit('confirmCopyForm', newFormName.value);
  } else if(props.copyType === 'page') {
    if (!newPageName.value) {
      ElMessage.error(i18next.t('nocodeFormCopyDialog.emptyPageError'));
      return inputRef.value?.focus();
    }

    emit('confirmCopyPage', newPageName.value);
  }

  emit('update:modelValue', false);
}

</script>

<style lang='scss' scoped>

.nocode-form-copy-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    background-color: var(--bg-color-page);
    padding: 0;
    .el-dialog__header{
      height: 40px;
      text-align: center;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
      margin-bottom: 20px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }
    .el-dialog__footer {
      display: flex;
      align-items: center;
      justify-content: end;
      height: 50px;
      border-top: 1px solid var(--border-color);
      padding: 14px;
      .el-button {
        margin: 0;
        border-radius: 4px;
      }
    }
  }

  .content {
    padding: 0 16px 16px;
    .label{
      font-size: 14px;
      font-weight: 400;
      margin-bottom: 10px;
    }
    :deep(.el-input) {
      .el-input__wrapper {
        border-radius: 4px;
      }
    }
  }

  .footer {
    display: flex;
    justify-content: flex-end;
    padding: 5px;
    :deep(.el-button) {
      border-radius: 4px;
    }
  }
}
</style>
