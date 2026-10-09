<template>
  <div class="draft-data-dialog">
    <el-dialog :title="title" :modelValue="modelValue" @update:model-value="emit('update:modelValue', $event)" @opened="handleOpened" @closed="handleClear"
      :close-on-click-modal="false" :destroy-on-close="true" align-center class="table-form-dialog"
      :show-close="false" :fullscreen="isFullscreen">
      <template #header="{ close }">
        <div class="title" :title="title">{{ title }}</div>
        <div class="menus">
          <el-button
            link
            :title="isFullscreen ? $t('DraftDataDialog.exitFullscreen') : $t('DraftDataDialog.fullscreen')"
            @click="isFullscreen = !isFullscreen"
          >
            <el-icon :size="16">
              <i-ven-icon-shrink-screen v-if="isFullscreen" />
              <i-ven-icon-full-screen v-else />
            </el-icon>
          </el-button>
          <el-button
            link
            :title="$t('DraftDataDialog.close')"
            :aria-label="$t('DraftDataDialog.close')"
            @click="close"
          >
            <el-icon :size="16"><i-ep-close /></el-icon>
          </el-button>
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
                <el-button type="primary" @click="handleSubmit">{{ $t('DraftDataDialog.submit') }}</el-button>
                <el-button @click="handleSaveDraft">{{ $t('DraftDataDialog.saveDraft') }}</el-button>
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
const isFullscreen = ref(false);
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
    text: i18next.t('DraftDataDialog.submitting'),
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
    ElMessage.success(i18next.t('DraftDataDialog.submitSuccess'));
    emit('submitted', row);
    emit('update:modelValue', false);
  }).catch((err) =>{
    editingFormRef.value?.clearSubmitValidationNotice?.();
    ElMessage.error(err.message || i18next.t('DraftDataDialog.submitFail'));
  }).finally(() => loading.close());
}

async function saveDraftBeforeRefresh() {
  if(!editingFormRef.value) return false;
  const loading = ElLoading.service({
    target: ".form-wrap",
    text: i18next.t('DraftDataDialog.savingDraft'),
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
    ElMessage.error(err.message || i18next.t('DraftDataDialog.saveFail'));
    return false;
  } finally {
    loading.close();
  }
}

const handleSaveDraft = async () => {
  if(!editingFormRef.value) return;
  const loading = ElLoading.service({
    target: ".form-wrap",
    text: i18next.t('DraftDataDialog.savingDraft'),
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
      ElMessage.success(i18next.t('DraftDataDialog.saveSuccess'));
      emit('updated', row);
      emit('update:modelValue', false);
    }).catch((err) =>{
      ElMessage.error(err.message || i18next.t('DraftDataDialog.saveFail'));
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
    ElMessage.success(i18next.t('DraftDataDialog.saveSuccess'));
    emit('updated', row);
    emit('update:modelValue', false);
  }
}

const handleClear = () => {
  isFullscreen.value = false;
}

const handleOpened = () => {
}
</script>

<style lang='scss' scoped>
.draft-data-dialog{
  pointer-events: all;

  :deep(.table-form-dialog){
    --close-button-size: 16px;
    --el-message-close-size: 24px;
    width: 780px;
    height: calc(100% - 100px);
    pointer-events: all;
    padding: 0;
    border-radius: 4px;
    background-color: var(--bg-color-page);

    .el-dialog__header{
      padding: 0 16px;
      height: 40px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;

      .title{
        min-width: 0;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 14px;
        color: #444444;
        line-height: 40px;
      }

      .menus {
        flex-shrink: 0;
        height: 100%;
        display: flex;
        align-items: center;
      }
    }

    .el-dialog__body{
      height: calc(100% - 40px);
    }

    .el-dialog__footer{
      text-align: left;
    }

    &.is-fullscreen {
      width: 100% !important;
      height: 100% !important;
      border-radius: 0;
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
          padding: 10px 24px;
          border-top: 1px solid var(--border-color);
          .el-button {
            margin-right: 8px;
            border-radius: 4px;
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
