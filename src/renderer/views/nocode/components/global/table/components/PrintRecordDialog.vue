<template>
  <div class="print-record-dialog">
    <el-dialog :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" width="680px" :close-on-click-modal="false"
      draggable :title="title" align-center destroy-on-close @open="handleOpen">
      <div class="dialog-body">
        <div class="print-record-list" v-if="printRecordList.length > 0">
          <div class="search-record">
            <div class="search-input">
              <el-input
                v-model="searchVal"
                :placeholder="$t('PrintRecordDialog.searchRecord')"
                :prefix-icon="Search"
              />
            </div>
            <div class="clear-record">
              <el-button link @click="handleClearRecord"><el-icon size="16"><i-ant-design-clear-outlined /></el-icon><span class="clear-text">{{ $t('PrintRecordDialog.clearRecord') }}</span></el-button>
            </div>
          </div>
          <div class="record-list"> 
            <div class="print-record-item" v-for="item in filteredPrintRecordList" :key="item.uid">
              <div class="record-item">
                <div class="record-zip-icon" v-if="item.name.endsWith('.zip')">
                  <img src="@renderer/assets/image/fileTypeImg/zip.png">
                </div>
                <div class="record-excel-icon" v-else-if="item.type === PrintTemplateType.EXCEL">
                  <img src="@renderer/assets/icons/table/excel.svg">
                </div>
                <div class="record-word-icon" v-else-if="item.type === PrintTemplateType.WORD">
                  <img src="@renderer/assets/icons/table/word.svg">
                </div>
                <div class="record-name">
                  {{ item.name }}
                </div>
              </div>
              <div class="operate">
                <img class="download" src="@renderer/assets/icons/table/download.svg" @click="handleDownload(item)">
                <el-icon class="delete" @click="handleDelete(item)">
                  <i-ep-delete></i-ep-delete>
                </el-icon>
              </div>
            </div>
          </div>
        </div>
        <div class="no-record" v-if="printRecordList.length === 0">
          <div class="print-icon-wrapper">
            <img class="print-icon" src="@renderer/assets/icons/table/print.svg">
          </div>
          <div class="text">
            {{ $t('PrintRecordDialog.noRecord') }}
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
  <delete-confirm-dialog :text="deleteConfirmContext.text" :tip="deleteConfirmContext.tip" v-model="deleteConfirmContext.visible" @confirm="handleConfirmDelete" />
  <delete-confirm-dialog :title="clearConfirmContext.title" :text="clearConfirmContext.text" :tip="clearConfirmContext.tip" :confirmText="clearConfirmContext.confirmText" v-model="clearConfirmContext.visible" @confirm="handleConfirmClear" />
</template>

<script setup lang='ts'>
import { ref, reactive, computed } from 'vue';
import { ElMessage } from "element-plus";
import { Table } from '@common/types/project';
import { PrintedTemplateRecord, PrintTemplateType } from '@common/types/nocode';
import { Search } from '@element-plus/icons-vue';
import { doDownload } from "@renderer/utils";
import axios from 'axios';
import i18next from 'i18next';

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  nocodeId: string;
  table: Table;
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();

const printRecordList = ref<PrintedTemplateRecord[]>([])
const searchVal = ref('');
const printRecordUID = ref('');

export type DeleteConfirmContext = {
  title?: string,
  text: string,
  tip: string,
  visible: boolean,
  confirmText?: string,
}
const deleteConfirmContext = reactive<DeleteConfirmContext>({
  get text() { return i18next.t('PrintRecordDialog.isDelete') },
  get tip() { return i18next.t('PrintRecordDialog.deleteWarning') },
  visible: false,
})
const clearConfirmContext = reactive<DeleteConfirmContext>({
  get title() { return i18next.t('PrintRecordDialog.clearTip') },
  get text() { return i18next.t('PrintRecordDialog.isClear') },
  get tip() { return i18next.t('PrintRecordDialog.clearWarning') },
  get confirmText() { return i18next.t('PrintRecordDialog.confirmClear') },
  visible: false,
})

// 搜索打印记录
const filteredPrintRecordList = computed(() => {
  if (!searchVal.value) {
    return printRecordList.value;
  }
  const searchLower = searchVal.value.toLowerCase();
  return printRecordList.value.filter(item => 
    item.name.toLowerCase().includes(searchLower)
  );
});

const handleClearRecord = async() => {
  clearConfirmContext.visible = true;
}
const handleDownload = async (item) => {
  doDownload({
    url: item.url,
    name: item.name,
  });
}

const handleDelete = async (item) => {
  printRecordUID.value = item.uid;
  deleteConfirmContext.visible = true;
}

const handleConfirmDelete = async() => {
  await deletePrintRecord()
}

const handleConfirmClear = async() => { 
  await clearPrintRecord()
}

const getTemplateList = async() => { 
  await axios.get('/project/get-form-export-template-list',{
    params: {
      nocodeId: props.nocodeId,
      tableUID: props.table.uid,
    }
  }).then(res => {
    if (Array.isArray(res.data)) {
      printRecordList.value = res.data.toReversed();
    }
  }).catch(err => {
    ElMessage.error(err);
  })
}
const deletePrintRecord = async() => { 
  await axios.post('/project/delete-print-record',{
    nocodeId: props.nocodeId,
    tableId: props.table.uid,
    printRecordUID: printRecordUID.value,
  }).then(res => {
    ElMessage.success(i18next.t('PrintRecordDialog.deleteSuccess'));
    getTemplateList();
  }).catch(err => {
    ElMessage.error(err);
  })
}

const clearPrintRecord = async() => { 
  await axios.post('/project/clear-print-record',{
    nocodeId: props.nocodeId,
    tableId: props.table.uid,
  }).then(res => {
    ElMessage.success(i18next.t('PrintRecordDialog.clearSuccess'));
    getTemplateList();
  }).catch(err => {
    ElMessage.error(err);
  })
}

const handleOpen = async() => {
  await getTemplateList();
}
</script>

<style scoped lang='scss'>
.print-record-dialog {
  :deep(.el-dialog) {
    height: 488px;
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
      height: calc(100% - 40px);
      padding: 24px 16px 16px 16px;
      border-radius: 4px;

      .dialog-body {
        height: 100%;
        display: flex;
        flex-direction: column;

        .print-record-list {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;

          .search-record {
            width: 100%;
            display: flex;
            align-items: center;
            margin-bottom: 16px;

            .search-input {
              flex: 1;
              .el-input {
                --el-input-bg-color: var(--bg-color-overlay);
                --el-input-focus-border-color: unset;
                width: 100%;
                height: 32px;
                .el-input__wrapper {
                  border-radius: 4px;
                  box-shadow: none;
                  .el-input__prefix {
                    color: var(--icon-default-color);
                    font-size: 16px;
                  }
                }
              }
            }
            .clear-record { 
              margin-left: 16px;
              margin-right: 8px;
              .clear-text {
                margin-left: 2px;
                font-size: 14px;
                font-weight: 400;
                line-height: 20px;
              }
            }
          }
          .record-list {
            width: 100%;
            overflow-y: auto;
            .print-record-item {
              width: 100%;
              min-height: 48px;
              border-top: 1px solid #D9D9D9;
              border-left: 1px solid #D9D9D9;
              border-right: 1px solid #D9D9D9;
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 0px 16px;

              .record-item {
                display: flex;
                align-items: center;
                .record-zip-icon {
                  img {
                    width: 24px;
                    height: 24px;
                  }
                }
                .record-excel-icon {
                  img {
                    width: 24px;
                    height: 24px;
                  }
                }
                .record-word-icon {
                  img {
                    width: 24px;
                    height: 24px;
                  }
                }
                .record-name {
                  font-size: 14px;
                  font-weight: 400;
                  color: #373737;
                  margin-left: 8px;
                }
              }

              .operate {
                display: flex;
                align-items: center;

                .download {
                  width: 16px;
                  height: 16px;
                  margin-right: 16px;
                  cursor: pointer;
                }
                .delete {
                  width: 16px;
                  height: 16px;
                  cursor: pointer;
                  padding-top: 2px;
                }
              }
            }
            .print-record-item:last-child {
              border-bottom: 1px solid #D9D9D9;
            }
          }
        }

        .no-record {
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          margin-top: 64px;
          margin-bottom: 64px;

          .print-icon-wrapper {
            width: 64px;
            height: 64px;
            background-color: #F5F6F7;
            border-radius: 16px;
            display: flex;
            justify-content: center;
            align-items: center;
            .print-icon {
              height: 40px;
              width: 40px;
              // color: #A1A1A1;
              // fill: #A1A1A1;
            }
          }
          .text {
            font-size: 14px;
            font-weight: 400;
            color: #A1A1A1;
            margin-top: 12px;
          }
        }
      }
    }
  }
}
</style>
