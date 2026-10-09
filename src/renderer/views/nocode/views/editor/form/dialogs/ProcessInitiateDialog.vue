<template>
  <div class="form-init-dialog">
    <el-dialog
      :model-value="modelValue"
      :close-on-click-modal="false"
      :close-on-press-escape="!submitting && !savingDraft"
      :before-close="handleBeforeClose"
      @close="emit('close')"
      @closed="handleClosed"
      align-center
      class="table-form-dialog"
      width="700px"
      :fullscreen="isFullscreen"
      :show-close="false"
    >
      <template #header>
        <div class="dialog-header">
          <div class="title" :title="tableName">
            {{ tableName }}
          </div>
          <div class="menus">
            <el-button
              link
              :disabled="submitting || savingDraft"
              :title="isFullscreen ? $t('ProcessInitiateDialog.exitFullscreen') : $t('ProcessInitiateDialog.fullscreen')"
              @click="isFullscreen = !isFullscreen"
            >
              <el-icon :size="16">
                <i-ven-icon-shrink-screen v-if="isFullscreen" />
                <i-ven-icon-full-screen v-else />
              </el-icon>
            </el-button>
            <el-button link :disabled="submitting || savingDraft" @click="handleClose">
              <el-icon :size="16"><i-ep-close /></el-icon>
            </el-button>
          </div>
        </div>
      </template>
      <div class="dialog-body">
        <el-scrollbar>
          <nocode-form v-bind="nocodeFormProps" :isViewing="false" ref="nocodeFormRef" :row="row" v-if="props.modelValue"/>
        </el-scrollbar>
      </div>
      <template #footer>
        <el-button type="primary" :loading="submitting" :disabled="submitting || savingDraft" @click="confirmClick">{{ $t('ProcessInitiateDialog.submit') }}</el-button>
        <el-button v-if="enableSaveDraft" :loading="savingDraft" :disabled="submitting || savingDraft" @click="saveDraftClick">{{ $t('ProcessInitiateDialog.saveDraft') }}</el-button>
        <el-button :disabled="submitting || savingDraft" @click="handleClose">{{ $t('ProcessInitiateDialog.cancel') }}</el-button>
      </template>

    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import type { OptionTableUID } from '@common/types/project';
import { ElMessage } from 'element-plus';
import { computed, ref } from 'vue';
import i18next from 'i18next';

const props = defineProps<{
  modelValue: boolean,
  tableUID: OptionTableUID,
  nocodeID: string,
  tableName: string,
  row?: Record<string, any>,
  message?: string,
  enableSaveDraft?: boolean,
}>()

const nocodeFormProps = computed(() => ({
  nocodeId: props.nocodeID,
  tableUID: props.tableUID,
}))

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'submitted'): void
  (event: 'draft-saved'): void
}>();

const nocodeFormRef = ref()
const submitting = ref(false);
const savingDraft = ref(false);
const isFullscreen = ref(false);

const handleClose = () => {
  if (submitting.value || savingDraft.value) {
    return;
  }
  emit('close');
}

const handleBeforeClose = (done: () => void) => {
  if (submitting.value || savingDraft.value) {
    return;
  }
  done();
}

const handleClosed = () => {
  isFullscreen.value = false;
}

const confirmClick = async () => {
  if (submitting.value || savingDraft.value) {
    return;
  }

  submitting.value = true;
  try {
    const result = await nocodeFormRef.value?.submit();
    if (result) {
      ElMessage.success(props.message || i18next.t('ProcessInitiateDialog.initiateSuccess'));
      emit('submitted')
      emit('close')
    }
  } finally {
    submitting.value = false;
  }
}

const saveDraftClick = async () => {
  if (submitting.value || savingDraft.value) {
    return;
  }

  savingDraft.value = true;
  try {
    await nocodeFormRef.value?.saveDraft();
    ElMessage.success(i18next.t('ProcessInitiateDialog.saveDraftSuccess'));
    emit('draft-saved');
    emit('close');
  } catch (err: unknown) {
    ElMessage.error(err instanceof Error ? err.message : i18next.t('ProcessInitiateDialog.saveDraftFail'));
  } finally {
    savingDraft.value = false;
  }
}
</script>

<style lang='scss' scoped>
.form-init-dialog {
  .dialog-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .title {
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
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }
  }

  .dialog-body {
    height: 100%;

    .el-scrollbar {
      height: 100%;
      background-color: #fff;
      border-radius: 4px;
    }
  }

  :deep(.table-form-dialog) {
    display: flex;
    flex-direction: column;
    padding: 0px;
    border-radius: 4px;
    overflow: hidden;
    background-color: var(--bg-color-page);
    min-height: 240px;
    height: calc(100% - 100px);

    &.is-fullscreen {
      height: 100% !important;
      border-radius: 0;
    }

    .el-dialog__header {
      padding: 0 16px;
      height: 40px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      background-color: var(--bg-color-page);
    }

    .el-dialog__body {
      padding: 0 16px 16px;
      flex: 1;
      min-height: 0;
      box-sizing: border-box;
    }

    .el-dialog__footer {
      padding: 10px 24px;
      background-color: var(--bg-color-page);
      display: flex;
      justify-content: flex-start;
      gap: 8px;
      border-top: 1px solid var(--border-color);

      .el-button {
        border-radius: 4px;
      }
    }
  }
}
</style>
