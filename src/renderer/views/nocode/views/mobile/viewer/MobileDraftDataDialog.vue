<template>
  <div class="mobile-draft-data-dialog">
    <el-dialog
      class="table-form-dialog"
      :title="title"
      :fullscreen="true"
      :modelValue="modelValue"
      @update:model-value="emit('update:modelValue',
      $event)"
      :close-on-click-modal="false"
      :destroy-on-close="true"
      :show-close="false"
      align-center>
      <template #header>
        <div class="title" @click="handleCancel">
          <el-icon class="back-button"><i-ep-arrow-left /></el-icon>
          <span>{{ title }}</span>
        </div>
      </template>
      <template #default>
        <div class="content">
          <div class="left">
            <div class="form-container">
              <div class="form-wrap">
                <nocode-form ref="editingFormRef" v-bind="nocodeFormProps"></nocode-form>
              </div>
              <div class="footer">
                <el-button @click="handleSaveDraft">{{ $t('MobileDraftDataDialog.saveDraft') }}</el-button>
                <el-button type="primary" @click="handleSubmit">{{ $t('MobileDraftDataDialog.submit') }}</el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { Row, Table } from '@common/types/project';
import { FormDataStage, SystemField } from '@common/utils';
import { NOCODE } from '@renderer/types';
import { storeFactory } from '@renderer/utils';
import { formDataApi } from '@renderer/views/nocode/utils';
import { ElLoading, ElMessage } from 'element-plus';
import { computed, onMounted, ref, inject } from 'vue';
import i18next from 'i18next';


const props = defineProps<{
  modelValue: boolean,
  title: string,
  table: Table,
  row: Row,
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'submitted', value: Row): void,
  (event: 'updated', value: Row): void,
}>();

const nocode = inject(NOCODE);
const updateNocodeMainSign = (sign: string) => {
  nocode.value.body.sign = sign;
};

const editingFormRef = ref();
const nocodeFormProps = computed(() => {
  return {
    nocodeId: nocode.value?.meta?.id,
    tableUID: [ "", props.table?.uid],
    row: props.row,
  }
});
const handleSubmit = async ()=>{
  if(!editingFormRef.value) return;
  const _row = await editingFormRef.value.prepareSubmitRow();
  if (!_row) {
    return;
  }
  const confirmed = await editingFormRef.value.confirmSubmitBeforeMutation?.({
    onSignSyncConflict: saveDraftBeforeRefresh,
  });
  if (!confirmed) {
    editingFormRef.value?.clearSubmitValidationNotice?.();
    return;
  }
  const loading = ElLoading.service({
    target: ".form-wrap",
    text: i18next.t('MobileDraftDataDialog.formSubmitting'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  const row = { ...props.row, ..._row };
  const formData = nocode.value.body.formData;
  await formDataApi.updateDraft({
    formData,
    nocodeId: nocode.value.meta.id,
    tableUID: props.table.uid,
    rows: [ row ],
    stage: FormDataStage.NORMAL,
    sign: nocode.value.body.sign,
    onMainSign: updateNocodeMainSign,
  }).then(() =>{
    editingFormRef.value?.notifySubmitValidationMessages?.();
    editingFormRef.value?.clearSubmitValidationNotice?.();
    ElMessage.success(i18next.t('MobileDraftDataDialog.submitSuccess'));
    emit('submitted', row);
    emit('update:modelValue', false);
  }).catch((err) =>{
    editingFormRef.value?.clearSubmitValidationNotice?.();
    ElMessage.error(err.message || i18next.t('MobileDraftDataDialog.submitFail'));
  }).finally(() => loading.close());
}

async function saveDraftBeforeRefresh() {
  if(!editingFormRef.value) return false;
  const loading = ElLoading.service({
    target: ".form-wrap",
    text: i18next.t('MobileDraftDataDialog.savingDraft'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  const _row = editingFormRef.value.serialize();
  const row = { ...props.row, ..._row };
  const formData = nocode.value.body.formData;
  const uuidField = props.table.fields.find(field => field.meta.name === SystemField.UUID);
  const notLocal = row[uuidField.uid];
  try {
    if(notLocal){
      await formDataApi.updateDraft({
        formData,
        nocodeId: nocode.value.meta.id,
        tableUID: props.table.uid,
        rows: [ row ],
        stage: FormDataStage.DRAFT,
        sign: nocode.value.body.sign,
        onMainSign: updateNocodeMainSign,
      });
    } else {
      await formDataApi.addDraft({
        formData,
        nocodeId: nocode.value.meta.id,
        tableUID: props.table.uid,
        rows: [ row ],
        sign: nocode.value.body.sign,
        onMainSign: updateNocodeMainSign,
      });
    }
    return true;
  } catch (err) {
    ElMessage.error(err.message || i18next.t('MobileDraftDataDialog.saveFail'));
    return false;
  } finally {
    loading.close();
  }
}

const handleSaveDraft = async () => {
  if(!editingFormRef.value) return;
  const loading = ElLoading.service({
    target: ".form-wrap",
    text: i18next.t('MobileDraftDataDialog.savingDraft'),
    background: "rgba(0, 0, 0, 0.2)"
  });
  const _row = editingFormRef.value.serialize();
  const row = { ...props.row, ..._row };
  const formData = nocode.value.body.formData;
  const uuidField = props.table.fields.find(field => field.meta.name === SystemField.UUID);
  const notLocal = row[uuidField.uid];
  if(notLocal){
    await formDataApi.updateDraft({
      formData,
      nocodeId: nocode.value.meta.id,
      tableUID: props.table.uid,
      rows: [ row ],
      stage: FormDataStage.DRAFT,
      sign: nocode.value.body.sign,
      onMainSign: updateNocodeMainSign,
    }).then(() =>{
      ElMessage.success(i18next.t('MobileDraftDataDialog.saveSuccess'));
      emit('updated', row);
      emit('update:modelValue', false);
    }).catch((err) =>{
      ElMessage.error(err.message || i18next.t('MobileDraftDataDialog.saveFail'));
    }).finally(() => loading.close());
  } else {
    const storage = storeFactory(`TABLE_DRAFT_${props.table.uid}`);
    const rows = storage.get() || [];
    const index = rows.findIndex(r => r[SystemField.UUID] === row[SystemField.UUID]);
    if(index > -1){
      rows[index] = row;
    }
    storage.set(rows);
    loading.close()
    ElMessage.success(i18next.t('MobileDraftDataDialog.saveSuccess'));
    emit('updated', row);
    emit('update:modelValue', false);
  }
}

const handleCancel = () => {
  emit('update:modelValue', false);
}
</script>

<style lang='scss' scoped>
.mobile-draft-data-dialog{
  pointer-events: all;

  :deep(.table-form-dialog){
    --close-button-size: 16px;
    --el-message-close-size: 24px;
    width: 100%;
    height: 100%;
    pointer-events: all;
    padding: 0;
    background-color: var(--bg-color-page);

    .el-dialog__header {
      padding: 16px;
      padding-bottom: 0;
      background-color: var(--el-bg-color-overlay);
      .title {
        height: 44px;
        display: flex;
        align-items: center;
        padding-right: 12px;
        gap: 8px;

        .back-button {
          color: var(--text-color-primary);
          font-size: 16px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        span {
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: 0px;
        }
      }
    }

    .el-dialog__body{
      height: calc(100% - 62px);
    }

    .el-dialog__footer{
      text-align: left;
    }
  }

  .content {
    height: 100%;
    display: flex;

    .left {
      width: 100%;//700px
      height: 100%;

      .form-container {
        height: 100%;
        display: flex;
        flex-direction: column;
        .form-wrap {
          flex: 1;
          min-height: 0px;
          padding: 16px;
          background-color: var(--el-bg-color-overlay);
          
          .nocode-form {
            width: 100%;
            height: auto;
            max-height: 100%;
            padding: 4px 2px;
            padding-top: 0;
            border-radius: 8px;
            overflow-y: auto;
            background-color: #fff;

            &::-webkit-scrollbar {
              display: none;
            }
            scrollbar-width: none;
            -ms-overflow-style: none;

          }
        }

        .form-wrap.viewing {
          background-color: var(--el-bg-color-overlay);
          padding: 16px;
          height: 100%;
          min-height: 0px;
          overflow: auto;
          .nocode-form {
            height: unset;
            min-height: 100%;
            background-color: #fff;
            border-radius: 4px;
            overflow: hidden;
            :deep(.board) {
              .axis {
                position: unset;
                .board-container {
                  position: unset;
                }
              }
            }
          }

          &::-webkit-scrollbar {
            width: 4px;
          }
        }

        .footer {
          background-color: var(--bg-color-page);
          padding: 12px 16px;
          border-top: 1px solid var(--border-color);
          display: flex;
          gap: 8px;
          .el-button {
            flex: 1;
            margin: 0;
            height: 40px;
            border-radius: 4px;
            font-size: 14px;
          }
        }
      }
    }

    .right {
      width: 300px;
      height: 100%;
      border-left: 1px solid var(--border-color);

      :deep(.el-tabs) {
        .el-tabs__nav {
          margin-left: 24px;
        }
        .el-tabs__nav-wrap::after {
          height: 1px;
        }
      }
    }
  }
}
</style>
