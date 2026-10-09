<template>
  <div class="office-print-preview-dialog">
    <el-dialog ref="previewDialog" :class="isLessenOfDialog ? 'isLessen' : ''" :fullscreen="!isLessenOfDialog" :model-value="modelValue" @update:model-value="handleUpdateModelValue($event)" :title="$t('officePrintPreview.preview')" align-center :close-on-click-modal="false" @open="handleOpenDialog" @close="handleCloseDialog">
      <template #header>
        <div class="title">
          {{ $t('OfficePrintPreview.preview') }}
        </div>
        <div class="preview-screen-btn">
          <el-button v-if="isLessenOfDialog" link @click="changeIsLessen">
            <el-icon size="16"><i-ven-magnify /></el-icon>
          </el-button>
          <el-button v-else link @click="changeIsLessen">
            <el-icon size="16"><i-ven-lessen /></el-icon>
          </el-button>
        </div>
      </template>

      <div class="office-scrollbar">
        <div class="office-show-title">
          <div class="title">{{ uploadTemplateName }}</div>
          <div class="excel-btn-group">
            <el-button plain @click="handleDownload">
              <el-icon :size="16"><i-table-download /></el-icon>
              {{ $t('OfficePrintPreview.download') }}
            </el-button>
            <el-button class="print" @click="handleClickPrint">
              <el-icon :size="16"><i-ep-printer /></el-icon>
              {{ $t('OfficePrintPreview.print') }}
            </el-button>
          </div>
        </div>
        <vue-office-excel ref="vueOfficeExcelRef" :key="componentKey" :src="excel" :options="options" @rendered="renderedHandler" @error="errorHandler" />
      </div>
    </el-dialog>
    <xlsx-print-dialog ref="xlsxPrintDialogRef" @confirm="handleConfirmPrint" />
  </div>
  <install-print-plugin-dialog ref="installPrintPluginRef"></install-print-plugin-dialog>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import VueOfficeExcel from '@vue-office/excel'
//引入相关样式
import '@vue-office/excel/lib/index.css'
import {  printPDF } from '@renderer/utils/print';
import { fetchPathAsArrayBuffer } from '@common/utils/print/shared';
import { ElMessage } from 'element-plus';
import { officeApi } from '@renderer/utils/api/office'
import { projectApi } from '@renderer/utils/api/project';
import { TableUID } from '@common/types/project';
import i18next from 'i18next';

const props = withDefaults(defineProps<{
  modelValue: boolean,
  uploadTemplateName: string,
  preViewPath: string | ArrayBuffer | Blob,
  nocodeId: string,
  tableId: TableUID,
  recordId?: string,
  isTemporary: boolean,
}>(), {
  isTemporary: false,
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
  (enent: 'download', value),
  (event: 'closed'),
}>();

const previewDialog = ref();
const isLessenOfDialog = ref(false);
const installPrintPluginRef = ref()
const xlsxPrintDialogRef = ref()
const vueOfficeExcelRef = ref()
const excel = computed(() => {
  return props.preViewPath;
}) //设置文档地址

const options = computed(() => {
  return {}
})
const componentKey = ref(0)
const changeIsLessen = () => {
  isLessenOfDialog.value = !isLessenOfDialog.value;
  componentKey.value += 1;
}

const handleDownload = async() => {
  emit('download', excel.value);
}

const renderedHandler = () => {
  console.log("渲染完成 链接：", excel.value)
}
const errorHandler = () => {
  console.log("渲染失败 链接：", excel.value)
}

const handleUpdateModelValue = (value) => {
  if (!value) isLessenOfDialog.value = false;
  emit('update:modelValue', value);
}
const handleOpenDialog = async() => {
  componentKey.value += 1;
}
const handleCloseDialog = () => {
  emit('closed');
}
const handleClickPrint = async () => {
  // 发送网络请求检测是否已经安装打印插件
  const status = await officeApi.ensureOfficePluginReady();
  if (!status.installed) {
    installPrintPluginRef.value.show()
    return
  }
  if (!status.running) {
    const messageKey = status.startupType === 'dll'
      ? 'CommonSetting.installPluginBeforeStart'
      : 'CommonSetting.startServiceFailed'
    ElMessage.error(i18next.t(messageKey))
    return
  }
  xlsxPrintDialogRef.value.show()
}
const handleConfirmPrint = async (printRange: string) => {
  let printValue = excel.value
  if (typeof printValue === 'string') {
    printValue = await fetchPathAsArrayBuffer(printValue);
  }
  if (printRange === 'content') {
    const activeSheet = vueOfficeExcelRef.value?.rootRef?.querySelector('.x-spreadsheet-menu')?.querySelector('.active')
    if (activeSheet?.textContent) {
      if (props.recordId) {
        const res = await projectApi.generatePrintFileUrl({
          nocodeId: props.nocodeId,
          tableId: props.tableId,
          recordId: props.recordId,
          isTemporary: props.isTemporary,
          excelPrintSheetName: activeSheet?.textContent,
        }).catch(({ response }) => {
          ElMessage.error(response?.data?.message);
          return null;
        });
        if (res) {
          printPDF(res.url);
        };
      }
    };
  } else {
    if (props.recordId) {
      const res = await projectApi.generatePrintFileUrl({
        nocodeId: props.nocodeId,
        tableId: props.tableId,
        recordId: props.recordId,
        isTemporary: props.isTemporary,
      }).catch(({ response }) => {
        ElMessage.error(response?.data?.message);
        return null;
      });
      if (res) {
        printPDF(res.url);
      }
    }
  }
  xlsxPrintDialogRef.value?.close();
}
</script>

<style scoped lang="scss">
.office-print-preview-dialog {
  :deep(.el-dialog) {
    --dialog-margin: 32px;
    --header-height: 40px;

    padding: 0px;
    border-radius: 4px;
    background-color: var(--color-white);
    width: calc(100vw - 64px);
    height: calc(100vh - 64px);
    margin: var(--dialog-margin);

    .el-dialog__header {
      padding: 8px 0px;
      height: 40px;
      border-bottom: 1px solid var(--border-color);
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;

      .el-dialog__headerbtn {
        height: 40px;
      }
      
      .preview-screen-btn {
        position: absolute;
        right: 40px;
        .el-button {
          width: 40px;
          height: 40px;
        }
        .el-icon:hover {
          color: var(--color-primary);
        }
      }
    }

    .el-dialog__body {
      padding: 16px;
      display: flex;
      height: calc(100% - 40px);

      .office-scrollbar {
        width: 100%;
        height: 100%;
        display: flex;
        overflow: hidden;
        flex-direction: column;
        gap: 16px;
        .office-show-title {
          height: 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          .title {
            font-size: 14px;
            line-height: 20px;
            color: #141414;
          }

          .excel-btn-group {
            .el-button {
              border-radius: 4px;
              .el-icon {
                margin-right: 8px;
              }

              &.print {
                color: var(--color-primary);
              }
            }
          }
        }
        .vue-office-excel {
          width: 100% !important;
          height: 100% !important;
          .vue-office-excel-main .x-spreadsheet {
            .x-spreadsheet-bottombar .x-spreadsheet-menu {
              overflow-y: hidden;
            }
          }
        }
      }
    }

    &.isLessen {
      width: 1008px;
      height: 724px;
      min-height: 724px;
      min-width: 1008px;
      margin: auto auto;

      .el-dialog__body {
        height: auto;
        padding: 16px;
        
        .vue-office-excel {
          width: 976px !important;
          height: 588px !important;
          .vue-office-excel-main .x-spreadsheet {
            .x-spreadsheet-bottombar .x-spreadsheet-menu {
              overflow-y: hidden;
            }
          }
        }
      }
    }
  }
}
</style>
