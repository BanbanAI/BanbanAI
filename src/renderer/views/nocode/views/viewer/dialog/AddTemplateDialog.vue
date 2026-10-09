<template>
  <div class="add-template-dialog">
    <el-dialog :model-value="visible" :title="dialogTitle" :width="1008" draggable align-center :close-on-click-modal="false" destroy-on-close @open="handleOpen" @close="hanldeClose">
      <template #default>
        <div class="dialog-container">
          <div class="template-title">
            <div class="template-ability-eara">
              <span>{{ $t('AddTemplateDialog.printTemplateName') }}</span>
              <el-space class="btn-group" :size="8" spacer="|">
                <el-button link @click="printSettingRef.show()">{{ $t('AddTemplateDialog.printSetting') }}</el-button>
                <el-button type="primary" link :loading="previewLoading" @click="handlePreview">
                  <el-icon :size="16" style="margin-right: 4px;"><i-ven-print-preview></i-ven-print-preview></el-icon>
                  {{ $t('AddTemplateDialog.preview') }}
                </el-button>
              </el-space>
            </div>
            <div class="template-name-input">
              <el-input v-model="printTemplateData.name"></el-input>
            </div>
          </div>

          <div class="body-line"></div>

          <div class="template-step">
            <div class="step1">
              <div class="step-title"><span>①</span>{{ $t('AddTemplateDialog.createLocal') }} {{ templateType }} {{ $t('AddTemplateDialog.template') }}</div>
              <div class="step-container">
                <p><el-icon><i-ven-dot></i-ven-dot></el-icon>{{$t('AddTemplateDialog.stepOne')}}{{ templateType }}{{ $t('AddTemplateDialog.fillFieldAndFormat') }}</p>
                <p><el-icon><i-ven-dot></i-ven-dot></el-icon>{{$t('AddTemplateDialog.stepTwo')}}{{ templateType }}{{ $t('AddTemplateDialog.pasteToTemplate') }}</p>
              </div>
              <el-button @click="compareTableRef.show()" >{{ $t('AddTemplateDialog.fieldCodeTable') }}</el-button>
            </div>
            <div class="step2">
              <div class="step-title"><span>②</span>{{ $t('AddTemplateDialog.upload') }} {{ templateType }} {{ $t('AddTemplateDialog.template') }}</div>
              <div class="step-container">
                <p><el-icon><i-ven-dot></i-ven-dot></el-icon>{{$t('AddTemplateDialog.supportUploadTip')}}{{ staticTemplateSuffixText }}{{ $t('AddTemplateDialog.formatFile') }}</p>
              </div>
              <div class="step2-upload-container">
                <el-upload ref="uploadRef" drag :accept="`.${staticTemplateSuffixText}`" :auto-upload="false" :show-file-list="false" @change="handleChangeFile">
                  <div class="el-upload__text">
                    <el-icon color="var(--primary-color)" :size="24"><i-workbench-upload-cloud></i-workbench-upload-cloud></el-icon>
                    {{$t('AddTemplateDialog.clickOrDragUpload')}}{{ templateType }}{{ $t('AddTemplateDialog.template') }}
                  </div>
                </el-upload>
                <div class="list-file-preview" v-if="fileList.length > 0">
                  <div class="preview-file-list" v-for="file in fileList" v-loading="file?.loading" element-loading-background="transparent" @click="handlePreviewFile(file)">
                    <img v-if="templateType === PrintTemplateType.EXCEL" class="file-thumbnail" :src="ExcelPng" />
                    <img v-else class="file-thumbnail" :src="WordPng" />
                    <div class="file-data">
                      <div class="file-name">
                        <span class="file-name-val">{{ file?.name?.substring(0, file.name.lastIndexOf(".")) }}</span>
                        <span class="file-suffix">{{ file?.name?.substring(file.name.lastIndexOf(".")) }}</span>
                      </div>
                      <div class="file-size">
                        {{ formatFileSize(file?.size) }}
                      </div>
                    </div>
                    <el-button class="btn-download" link type="primary" @click.stop="handleDownloadFile(file)">
                      <el-icon :size="14"><Download /></el-icon>
                    </el-button>
                    <el-button class="btn-delete" link @click.stop="handleDeleteFile(file)">
                      <el-icon :size="14" color="var(--el-color-danger)"><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
            <div class="step3">
              <div class="step-title"><span>③</span>{{ $t('AddTemplateDialog.previewAndPrintSet') }}</div>
              <div class="step-container">
                <p><el-icon><i-ven-dot></i-ven-dot></el-icon>{{ $t('AddTemplateDialog.previewDesc') }}</p>
                <p><el-icon><i-ven-dot></i-ven-dot></el-icon>{{ $t('AddTemplateDialog.printSetDesc') }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <el-button @click="visible = false">{{ $t('AddTemplateDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">{{ $t('AddTemplateDialog.save') }}</el-button>
      </template>
    </el-dialog>
    <office-print-preview 
      v-model="visibleOfPreview"
      :uploadTemplateName="uploadTemplateName" 
      :nocodeId="nocode.meta.id"
      :tableId="tableUID"
      :recordId="templateRecord?.uid"
      :isTemporary="templateRecord?.isTemporary ?? false"
      :preViewPath="previewPath" 
      @download="downloadPrintTemplate" 
      @closed="closePreviewDialog"
    ></office-print-preview>
    <word-print-preview 
      v-model="visibleOfWordPreview" 
      :uploadTemplateName="uploadTemplateName" 
      :preViewPath="previewPath" 
      :nocodeId="nocode.meta.id"
      :tableId="tableUID"
      :recordId="templateRecord?.uid"
      :isTemporary="templateRecord?.isTemporary ?? false"
      @download="downloadPrintTemplate" 
      @closed="closePreviewDialog"
    ></word-print-preview>
  </div>
  <compare-table-dialog
    ref="compareTableRef"
    :templateType="templateType"
    :activePageId="activePageId"
    :printTemplate="printTemplateData"
    @update="handleFlowCommentRuleChange"
  ></compare-table-dialog>
  <print-setting-dialog ref="printSettingRef" :printTemplateData="printTemplateData" :templateType="templateType" :fields="fields" @confirm="handleConformModeSetting"></print-setting-dialog>
</template>

<script setup lang='ts'>
import { computed, inject, onMounted, reactive, Ref, ref, watch } from 'vue';
import { Delete, Download } from "@element-plus/icons-vue";
import ExcelPng from "@renderer/assets/image/fileTypeImg/excel.png";
import WordPng from "@renderer/assets/image/fileTypeImg/word.png";
import { ElMessage, UploadFile, UploadProps } from 'element-plus';
import { NOCODE, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { unique } from '@common/utils/unique';
import { PrintedTemplateRecord, PrintFlowCommentRule, PrintTemplate, PrintTemplateExportNameMode, PrintTemplateMode, PrintTemplateType } from '@common/types/nocode';
import { TableUID } from '@common/types/project';
import axios from 'axios';
import { deepClone, isEmpty } from '@common/utils/object';
import { isSystemField } from '@common/utils';
import { fetchPathAsArrayBuffer } from '@common/utils/print/shared';
import type { ImageMap } from '@common/utils/print/shared';
import { usePassportStore } from '@renderer/stores';
import { doDownload } from "@renderer/utils";
import { loadExcelhasImage } from '@common/utils/formUtil/excelUtil';
import { projectApi } from '@renderer/utils/api/project';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import i18next from 'i18next';

const nocode = inject(NOCODE);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);
const props = defineProps<{
  tableUID: TableUID,
  isEditable: boolean
  activePageId: string,
  templateType: PrintTemplateType,
  template: PrintTemplate,
}>()
const emit = defineEmits(["update"]);

const passportState = usePassportStore();
passportState.init()
const previewRow = ref(null);
const visible = ref(false);
const dialogTitle = computed(() => {
  if (props.isEditable) {
    if (props.templateType === PrintTemplateType.EXCEL) {
      return i18next.t('AddTemplateDialog.editTableTemp')
    } else {
      return i18next.t('AddTemplateDialog.editDocTemp')
    }
  } else {
    if (props.templateType === PrintTemplateType.EXCEL) {
      return i18next.t('AddTemplateDialog.newTableTemp')
    } else {
      return i18next.t('AddTemplateDialog.newDocTemp')
    }
  }
})
const getEmptyTemplateName = () => i18next.t('AddTemplateDialog.unnamedTemp')
const templateName = ref(getEmptyTemplateName());
const uploadTemplateName = ref('');
const printSettingRef = ref();
const compareTableRef = ref();
const previewLoading = ref(false);
const fileList = ref([]);
const uploadRef = ref();
let formData = null;
const editTemplate = ref()
const staticTemplateSuffixText = computed(() => {
  return props.templateType === PrintTemplateType.EXCEL ? 'xlsx' : 'docx';
});
const fields = computed(() => {
  const activeTable = nocode.value.body.formData.tables.find(table => table.uid === props.activePageId)
  return (activeTable?.fields || []).filter(field => !isSystemField(field))
})

const defaultTemplateData = { 
  uid: unique(),
  get name() { return i18next.t('AddTemplateDialog.unnamedTemp') },
  type: props.templateType,
  range: {
    departments: [],
    roles: [],
    users: []
  },
  enabled: true,
  file: null,
  mode: PrintTemplateMode.SINGLE,
  exportNameMode: PrintTemplateExportNameMode.DEFAULT,
  exportNameValue: '',
  exportNameSegments: [],
};
const printTemplateData = reactive<PrintTemplate>(deepClone(defaultTemplateData));

// 监听 fileList.value 的变化，同步文件信息
watch(
  () => fileList.value[0],
  (newFile) => {
    if (newFile?.status === 'success' && formData) {
      printTemplateData.file = newFile;
    }
  },
  {
    immediate: true,
    deep: true,
  }
);

const excelExtenstions = [
  "xlsx",
]

const wordExtenstions = [
  "docx",
]
const visibleOfPreview = ref(false);
const templateRecord: Ref<PrintedTemplateRecord> = ref();
const visibleOfWordPreview = ref(false);
const previewArrayBuffer = ref<ArrayBuffer | Blob | null>(null);
const previewPathStr = ref<string | null>(null);
const previewPath = computed(() => {
  if (previewArrayBuffer.value) {
    return previewArrayBuffer.value;
  }
  return previewPathStr.value ? previewPathStr.value : printTemplateData.file?.path;
})
const handleSave = async () => {
  if (fileList.value.length === 0) {
    if (props.templateType === PrintTemplateType.EXCEL) ElMessage.error(i18next.t('AddTemplateDialog.uploadExcelTemp'));
    if (props.templateType === PrintTemplateType.WORD) ElMessage.error(i18next.t('AddTemplateDialog.uploadWordTemp'));
    return;
  }

  try {
    if (isChangeFile.value) {
      await uploadTempFile();
      isChangeFile.value = false;
    }
    await saveTempTabData();
    visible.value = false;
    if (props.isEditable) {
      ElMessage.success(i18next.t('AddTemplateDialog.updateSuccess'));
    } else {
      ElMessage.success(i18next.t('AddTemplateDialog.createSuccess'));
    }
  } catch (error) {
    nocode.value.body.printTemplate[props.tableUID].filter(item => item.uid !== printTemplateData.uid)
    ElMessage.error(error.message);
  }
}

// 新增打印模板
const saveTempTabData = async () => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  if (props.isEditable) {
    const templateIndex = nocode.value.body.printTemplate[props.tableUID].findIndex(item => item.uid === editTemplate.value.uid);
    nocode.value.body.printTemplate[props.tableUID].splice(templateIndex, 1, printTemplateData);
  } else {
    if (!isEmpty(nocode.value.body.printTemplate)) {
      if (!nocode.value.body.printTemplate[props.tableUID]) {
        nocode.value.body.printTemplate[props.tableUID] = []
      }
      nocode.value.body.printTemplate[props.tableUID].push(printTemplateData);
    } else {
      nocode.value.body.printTemplate = {
        [props.tableUID]: [printTemplateData]
      }
    }
  }
  const res = await axios.post("/project/update-nocode-print-template", {
    nocodeId: nocode.value.meta.id,
    tableId: props.tableUID,
    printTemplate: printTemplateData,
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).then(({headers}) => {
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
  })
  .catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });

  emit("update")
}

const getTemplateRender = async () => {
  if (isChangeFile.value || !(fileList.value[0]?.path || printTemplateData.file?.path)) {
    await uploadTempFile()
    isChangeFile.value = false;
  }

  const templateFile = fileList.value[0] || printTemplateData.file;
  const previewTemplate: PrintTemplate = {
    ...deepClone(printTemplateData),
    type: props.templateType,
    file: {
      path: templateFile?.path,
      name: templateFile?.name,
      size: templateFile?.size,
    },
  };

  const res = await projectApi.getTemplateRender({
    nocodeId: nocode.value.meta.id,
    tableId: props.tableUID,
    printTemplate: previewTemplate,
  })
  return res;
}
const uploadTempFile = async () => {
  let body;
  let url = '/project/upload-nocode-print-template';
  formData = new FormData();
  formData.append("file", fileList.value[0].raw ? fileList.value[0].raw : fileList.value[0]);
  formData.append("nocodeId", nocode.value.meta.id);
  formData.append("oldFilePath", editTemplate.value?.file?.path);
  formData.append('fileName', fileList.value[0]?.name);
  body = formData;

  const res: any = await axios.post(url, body).catch(err => {
    ElMessage.error(err.message);
  });

  fileList.value[0] = {
    name: fileList.value[0]?.name,
    path: res.data.path,
    size: fileList.value[0]?.size,
    status: 'success',
  };
}

const handlePreviewFile = async(file) => {
  uploadTemplateName.value = file.name;
  if (file.raw instanceof File) {
    if (props.templateType === PrintTemplateType.EXCEL) {
      const workbook = await loadExcelhasImage(await file.raw.arrayBuffer());
      const newBuffer = await workbook.xlsx.writeBuffer() as ArrayBuffer;
      previewArrayBuffer.value = new Blob([newBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    } else {
      previewArrayBuffer.value = await file.raw.arrayBuffer();
    }
  } else if (file.path) {
    const arrayBuffer = await fetchPathAsArrayBuffer(file.path)
    if (arrayBuffer instanceof ArrayBuffer) {
      if (props.templateType === PrintTemplateType.EXCEL) {
        const workbook = await loadExcelhasImage(arrayBuffer);
        const newBuffer =  await workbook.xlsx.writeBuffer() as ArrayBuffer;
        previewArrayBuffer.value = new Blob([newBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
      } else {
        previewArrayBuffer.value = arrayBuffer;
      }
    }
  }
  if (props.templateType === PrintTemplateType.EXCEL) {
    visibleOfPreview.value = true;
  } else {
    visibleOfWordPreview.value = true;
  }
}
const handlePreview = async () => {
  previewLoading.value = true;
  try {
    if (fileList.value.length <= 0) {
      return ElMessage.error(i18next.t('AddTemplateDialog.uploadTemplateFile'));
    }
    const res = await getTemplateRender()
    if (!res.url) {
      throw new Error('Not find preview url')
    }
    previewPathStr.value = `${window.location.origin}${res.url}`;
    templateRecord.value = res.record
    uploadTemplateName.value = res.record?.name || uploadTemplateName.value || templateName.value;
    if (props.templateType === PrintTemplateType.EXCEL) {
      visibleOfPreview.value = true;
    } else {
      visibleOfWordPreview.value = true;
    }
  } catch (error) {
    ElMessage.error(error.message);
    previewArrayBuffer.value = null
  } finally {
    previewLoading.value = false;
  }
}

const handleDownloadFile = (file) => {
  doDownload({
    url: file.path,
    name: file.name,
  });
}
const handleDeleteFile = (file) => {
  fileList.value = fileList.value.filter(item => item.uid !== file.uid);
}

const formatFileSize = (size: number): string => {
  return `${(size / 1024).toFixed(2)}KB`;
};

const isChangeFile = ref(false);
const handleChangeFile = (uploadFile: UploadFile) => {
  isChangeFile.value = false;
  const fileName = uploadFile.name || "";
  const fileExtension = fileName.split(".").pop().toLowerCase();
  if (!excelExtenstions.includes(fileExtension) && props.templateType === PrintTemplateType.EXCEL) {
    ElMessage.error(i18next.t('AddTemplateDialog.uploadXlsxFile'));
    handleDeleteFile(uploadFile);
    return;
  }
  if (!wordExtenstions.includes(fileExtension) && props.templateType === PrintTemplateType.WORD) {
    ElMessage.error(i18next.t('AddTemplateDialog.uploadDocxFile'));
    handleDeleteFile(uploadFile);
    return;
  }
  if (uploadFile.size > 1024 * 1024 * 10) {
    ElMessage.error(i18next.t('AddTemplateDialog.fileSizeLimit'));
    handleDeleteFile(uploadFile);
    return;
  }
  isChangeFile.value = true;
  if (fileName && (templateName.value === getEmptyTemplateName() || templateName.value === '')) {
    templateName.value = fileName;
  }
  fileList.value = [uploadFile];
  
  printTemplateData.file = {
    name: uploadFile.name,
    size: uploadFile.size,
    raw: uploadFile.raw,
  };
}

const handleOpen = () => {
  printTemplateData.flowCommentRule = undefined;
  if(props.isEditable){
    Object.assign(printTemplateData, props.template);
  } else {
    Object.assign(printTemplateData, {
      ...defaultTemplateData,
      uid: unique(), // 每次都更新uid
      type: props.templateType  // 每次都更新type
    });
  }
}

const hanldeClose = () => {
  visible.value = false;
  fileList.value = [];
  templateName.value = getEmptyTemplateName();
  editTemplate.value = null;
  uploadRef.value?.clearFiles?.();
}

const handleConformModeSetting = (value) => {
  printTemplateData.range = value.range;
  printTemplateData.exportNameMode = value.exportNameMode;
  printTemplateData.exportNameValue = value.exportNameValue;
  printTemplateData.exportNameSegments = value.exportNameSegments || [];
  printTemplateData.mode = value.mode;
}

const handleFlowCommentRuleChange = (value: PrintFlowCommentRule) => {
  printTemplateData.flowCommentRule = value;
}

const downloadPrintTemplate = async(downloadSrc) => { 
  if(typeof downloadSrc === 'string') {  // 如果是字符串url
    doDownload({
      url: downloadSrc,
      name: uploadTemplateName.value ? uploadTemplateName.value : templateName.value,
    })
  } else if (downloadSrc instanceof Blob || downloadSrc instanceof ArrayBuffer) {  // 如果是Blob或者Arraybuffer
    const blob = new Blob([downloadSrc], {type: props.templateType === PrintTemplateType.EXCEL ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const url = URL.createObjectURL(blob);
    doDownload({
      url: url,
      name: uploadTemplateName.value ? uploadTemplateName.value : templateName.value,
    })
  } else {  // 如果是File对象
    const url = URL.createObjectURL(downloadSrc);
    doDownload({
      url: url,
      name: uploadTemplateName.value ? uploadTemplateName.value : templateName.value,
    })
  }
}

const closePreviewDialog = () => {
  previewArrayBuffer.value = null;
  previewPathStr.value = null;
  uploadTemplateName.value = '';
}

defineExpose({
  show: (printTemplate?: PrintTemplate) => {
    if (printTemplate) {
      templateName.value = printTemplate.name;
      editTemplate.value = printTemplate;
      fileList.value[0] = printTemplate.file;
    }
    visible.value = true;
  },
  hide: () => {
    hanldeClose();
  }
})
</script>
  
<style scoped lang="scss">
.add-template-dialog {
  :deep(.el-dialog) {
    padding: 0px;
    border-radius: 4px;
    background-color: var(--color-white);
    
    .el-dialog__header {
      padding: 10px 0px;
      height: 40px;
      border-bottom: 1px solid var(--border-color);
      font-weight: 400;
      display: flex;
      justify-content: center;
      align-items: center;
      .el-dialog__title {
        font-size: 14px;
        line-height: 20px;
      }
      
      .el-dialog__headerbtn {
        height: 40px;
      }
    }

    .el-dialog__body {
      padding: 16px;
      display: flex;

      .dialog-container {
        width: 100%;
        height: 100%;
        padding: 8px 0;
        display: flex;
        flex-direction: column;
        gap: 24px;

        .template-title {
          width: 100%;
          height: 76px;

          .template-ability-eara {
            height: 32px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .template-name-input {
            width: 360px;
            margin-top: 8px;
            
            .el-input__wrapper {
              background-color: var(--bg-color-overlay);
              box-shadow: unset;
              border-radius: 4px;
            }
          }
        }

        .body-line {
          height: 0;
          border-top: 1px solid var(--border-color);
        }
        
        .template-step {
          display: flex;
          flex-direction: column;
          gap: 32px;
          .step1, .step2, .step3 {
            .step-title {
              font-size: 14px;
              line-height: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              gap: 4px;
            }

            .step-container {
              margin-top: 12px;
              font-size: 12px;
              line-height: 20px;
              color: #727272;
              margin-bottom: 16px;
              p {
                display: flex;
                align-items: center;
              }
            }
          }

          .step1 {
            .el-button {
              border-radius: 4px;
              color: var(--primary-color);
              border-color: var(--color-primary);
            }
          }

          .step2 {
            .step2-upload-container {
              width: 360px;
              .el-upload {
                .el-upload-dragger {
                  padding: 24px 10px;
                  .el-upload__text {
                    color: #a1a1a1;
                    font-size: 14px;
                    line-height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                  }
                }
              }
              .list-file-preview {
                .preview-file-list {
                  display: flex;
                  justify-content: flex-start;
                  align-items: center;
                  position: relative;
                  overflow: hidden;
                  height: 56px;
                  padding: 8px;
                  background-color: var(--bg-color-overlay);
                  border: 1px solid var(--border-color);
                  border-radius: 4px;
                  margin-top: 8px;
                  &:hover .file-name {
                    color: var(--color-primary);
                  }
                  :deep(.el-loading-mask) {
                    height: 100%;
                    .el-loading-spinner {
                      top: calc(50% + 5px);
                      .circular {
                        width: 20px;
                        height: 20px;
                      }
                    }
                  }
                  .loading-progress {
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.4);
                    position: absolute;
                    top: 0;
                    left: 0;
                    z-index: 10;
                    transition: height 0.5s ease;
                    span {
                      position: absolute;
                      left: calc(50% - 10px);
                      top: 34px;
                      color: var(--color-primary);
                    }
                  }
                  .file-thumbnail {
                    width: 40px;
                    height: 40px;
                    object-fit: cover;
                    margin-right: 16px;
                    border-radius: 2px;
                  }
                  &:hover .file-data {
                    width: calc(100% - 70px);
                  }
                  .file-data {
                    height: 100%;
                    width: calc(100% - 56px);
                    .file-name {
                      width: 100%;
                      // white-space: nowrap;
                      // overflow: hidden;
                      // text-overflow: ellipsis;
                      line-height: 20px;
                      margin-bottom: 4px;
                      display: flex;
                      align-items: center;
                      justify-content: flex-start;
                      .file-name-val{
                        max-width: calc(100% - 30px);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        display: inline-block;
                      }
                      .file-suffix {
                        display: inline-block;
                      }
                    }
                    .file-size {
                      color: var(--el-color-info);
                      font-size: 12px;
                      line-height: 16px;
                    }
                  }
                  &:hover .btn-download{
                    display: block;
                  }
                  .btn-download {
                    display: none;
                    position: absolute;
                    right: 30px;
                  }
                  &:hover .btn-delete {
                    display: block;
                  }
                  .btn-delete {
                    display: none;
                    position: absolute;
                    right: 10px;
                  }
                }
              }
            }
          }
        }
      }
    }
    
    .el-dialog__footer {
      border-top: 1px solid var(--border-color);
      height: 64px;
      padding: 0px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 16px;

      .el-button {
        border-radius: 4px;
      }
    }
  }
}
</style>
