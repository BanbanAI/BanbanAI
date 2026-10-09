<template>
  <div class="table-delete-data-dialog" :class="isMobile() ? 'mobile' : ''">
    <el-dialog custom-class="table-delete-dialog" :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)"
    align-center>
      <template #header>
        <div class="dialog-header">{{ title }}</div>
      </template>
      <div class="dialog-body">
        <div class="delete-dialog-tip">
          <el-icon :size="24"><i-table-delete-tip /></el-icon>
          <span>{{ deleteTip || $t('TableDeleteDataDialog.isDelete') }}</span>
        </div>
        <div class="delete-dialog-summary" v-if="!isNoneSummary">{{ $t('TableDeleteDataDialog.willDelete') }} <span class="data">
          {{ deleteDataText }}
        </span></div>
        <div class="delete-dialog-process-tip" v-if="unfinishedProcessCount > 0">
          {{ $t('TableDeleteDataDialog.unfinishedProcessTip', { count: unfinishedProcessCount }) }}
        </div>
        <div class="delete-dialog-warning">{{ deleteWarningText || $t('TableDeleteDataDialog.deleteWarning') }}</div>
      </div>
      <template #footer>
        <div class="btns">
          <el-button class="cancel" @click="emit('update:modelValue', false)">{{ $t('TableDeleteDataDialog.cancel') }}</el-button>
          <el-button class="confirm" :type="props.confirmType || 'danger'" @click="handleConfirm">{{ props.confirmText || $t('TableDeleteDataDialog.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { isMobile } from '@renderer/utils';
import i18next from 'i18next';

const props = defineProps<{
  modelValue: boolean;
  dataText?: string | string[];
  title?: string;
  deleteTip?: string;
  isNoneSummary?: boolean;
  deleteWarningText?: string;
  confirmText?: string;
  confirmType?: string;
  unfinishedProcessCount?: number;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'deleteTableData'): void;
  (event: 'confirm'): void;
}>();

const handleConfirm = () => {
  emit('deleteTableData');
  emit('confirm');
  emit('update:modelValue', false);
}

const formatArray = (arr) => {
  if (!Array.isArray(arr)) return '';
  const len = arr.length;

  if (len === 0) return '';
  if (len === 1) return String(arr[0]);
  if (len === 2) {
    return i18next.t('TableDeleteDataDialog.twoItemList', { first: arr[0], second: arr[1] });
  }
  return i18next.t('TableDeleteDataDialog.multiItemList', {
    items: arr.slice(0, -1).join(i18next.t('TableDeleteDataDialog.listSeparator')),
    last: arr[len - 1],
  });
}

const deleteDataText = computed(() => {
  if(Array.isArray(props.dataText)) {
    return formatArray(props.dataText);
  }
  return props.dataText
})
</script>

<style scoped lang='scss'>
.table-delete-data-dialog {
  :deep(.el-dialog) {
    padding: 0;
    width: 400px;
    height: fit-content;
    border-radius: 8px;

    .el-dialog__header {
      width: 100%;
      height: 40px;
      padding: 8px 0;
      display: flex;
      align-items: center;
      border-bottom: 1px solid var(--border-color);

      .dialog-header {
        flex: 1;
        text-align: center;
        font-size: 14px;
      }

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
      }
    }

    .dialog-body {
      padding: 24px;

      .delete-dialog-tip {
        display: flex;
        align-items: center;
        justify-content: start;
        column-gap: 8px;
        font-size: 16px;
      }

      .delete-dialog-summary {
        margin-top: 32px;
        font-size: 14px;
        .data {
          color: #FF4D4F;
          font-weight: 600;
        }
      }

      .delete-dialog-process-tip {
        margin-top: 16px;
        background-color: #fff7e6;
        border-radius: 4px;
        padding: 8px;
        font-size: 14px;
        line-height: 20px;
        color: #d46b08;
      }

      .delete-dialog-warning {
        margin-top: 16px;
        background-color: #FAAD1426;
        border-radius: 4px;
        padding: 8px;
        font-size: 14px;
        line-height: 20px;
        color: #FF4D4F;
      }
    }

    .el-dialog__footer {
      padding: 0 24px 24px 0;

      .btns {
        .el-button {
          border-radius: 4px;
          padding: 6px 16px;
        }
      }
    }
  }

  &.mobile:deep(.el-dialog) {
    width: 82%;
    height: auto;
    border-radius: 8px;
    .delete-dialog-summary {
      margin-top: 16px;
    }
    .el-dialog__footer {
      padding: 0 16px;
      padding-bottom: 16px;
    }
  }
}

</style>
