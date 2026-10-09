<template>
  <div class="workbench-add-user-dialog">
    <el-dialog :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" width="360px" :close-on-click-modal="false"
      :title="title" align-center destroy-on-close>
      <div class="dialog-body">
        <div class="print-title">
          <div class="text">
            {{ $t('SystemPrintDialog.printTitle') }}
          </div>
          <div class="input">
            <el-input v-model="printTitle" :placeholder="$t('SystemPrintDialog.inputTitle')" />
          </div>
        </div>
        <div class="description-information">
          <div class="text">
            {{ $t('SystemPrintDialog.descInfo') }}
            <el-tooltip
              class="box-item"
              effect="light"
              :content="$t('SystemPrintDialog.content')"
              placement="top"
              raw-content
            >
              <el-icon size="16"><i-ant-design-question-circle-outlined /></el-icon>
            </el-tooltip>
          </div>
          <div class="textarea">
            <el-input
              v-model="describeInfo"
              :rows="4"
              type="textarea"
              :placeholder="$t('SystemPrintDialog.placeholder')"
            />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button class="cancel" @click="emit('update:modelValue', false)">{{ $t('SystemPrintDialog.cancel') }}</el-button>
        <el-button type="primary" class="confirm" :loading="isLoading" @click="handleConfirm">{{ $t('SystemPrintDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { useTable } from '../hooks';
import { printDataReplace, systemPrint, type SystemPrintMode } from '@renderer/utils/print';
import { collectPrintCurrentOwnerIds, fillPrintProcessSystemFieldValues, getUUIDSystemField } from '@common/utils';
import { formDataApi } from '@renderer/utils';
import { Row } from '@common/types/project';

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  rows?: Row[];
  mode?: SystemPrintMode;
  hideColumns?: string[];
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();
const widget = useTable();
const checkRows = computed(() => {
  return widget.checkboxRow || []
});
const loadBuckets = async (tableUIDs: string[], options) => {
  if (widget.tableProps?.dataPermissionMode === "all") {
    return await formDataApi.getManagedViewTableData({
      nocodeId: widget.nocodeId,
      tableUIDs,
      options,
      widgetUID: widget.uid,
      widgetNocodeId: widget.tableProps?.widgetNocodeId || widget.tableProps?.nocodeId || widget.nocodeId,
    });
  }
  return await formDataApi.getData({
    nocodeId: widget.nocodeId,
    tableUIDs,
    options,
  });
};

const loadBucket = async (tableUID: string, options) => {
  const buckets = await loadBuckets([tableUID], options);
  return buckets[0];
};
const printTitle = ref('');
const describeInfo = ref('');
const isLoading = ref(false);
const handleConfirm = async () => {
  isLoading.value = true;
  const uuidField = getUUIDSystemField(widget.table.fields);
  let uuids;
  if (props.rows?.length) {
    uuids = props.rows.map((item: Row) => item[uuidField.uid]);
  } else {
    uuids = checkRows.value.map((item: any) => item[uuidField.uid]);
  }
  const buckets = await loadBuckets([widget.formTableUID], {
    fillSubTable: true,
    transformFormData: true,
    formatData: true,
    filters: {
      [widget.formTableUID]: [{
        [uuidField.uid]: {
          $in: uuids
        }
      }]
    }
  });
  let rows = buckets[0]?.rows;

  const replacedRows = await printDataReplace(
    rows,
    widget.allColumns,
    {
      nocodeId: widget.nocodeId,
      loadBucket,
    }
  )
  const ownerIds = collectPrintCurrentOwnerIds(replacedRows, widget.table.fields);
  await widget.prefetchAccounts(ownerIds);
  const ownerNameMap = Object.fromEntries(await Promise.all(ownerIds.map(async id => {
    const account = await widget.getOrganizationAccount(id);
    return [id, account?.realname || id];
  })));
  const newRows = fillPrintProcessSystemFieldValues(replacedRows, widget.table.fields, {
    process: widget.formData?.formOptions?.[widget.formTableUID]?.process,
    ownerNameMap,
  });
  emit('update:modelValue', false)
  isLoading.value = false;
  systemPrint({
    title: printTitle.value,
    describeInfo: describeInfo.value,
    columns: widget.allColumns,
    rows: newRows,
    hideColumns: props.hideColumns || widget.hiddenColumnIds,
    mode: props.mode,
  })
}
</script>

<style scoped lang='scss'>
.workbench-add-user-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;
    }

    .el-dialog__body {
      padding: 24px 16px 16px 16px;
      border-bottom: 1px solid var(--border-color);

      .dialog-body {
        display: flex;
        flex-direction: column;

        .print-title {
          .text {
            font-size: 14px;
            font-weight: 400;
            color: var(--color-text-primary);
            margin-bottom: 12px;
          }
          .input {
            .el-input {
              width: 100%;
              .el-input__wrapper {
                border-radius: 4px;
                background-color: #F5F6F7;
                box-shadow: none;
              }
            }
          }
        }

        .description-information {
          margin-top: 28px;
          .text {
            display: flex;
            align-items: center;
            font-size: 14px;
            font-weight: 400;
            color: var(--color-text-primary);
            margin-bottom: 12px;
            .el-icon {
              margin-left: 4px;
            }
          }
          .textarea {
            .el-textarea {
              width: 100%;
              .el-textarea__inner {
                border-radius: 4px;
                background-color: #F5F6F7;
                resize: none;
                box-shadow: none;
              }
            }
          }
        }
      }
    }

    .el-dialog__footer {
      padding: 16px;

      .el-button { 
        height: 32px;
        width: 60px;
        border-radius: 4px;
      }
    }
  }
}
</style>
