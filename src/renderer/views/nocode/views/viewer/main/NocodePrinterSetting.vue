<template>
  <div class="nocode-printer-setting">
    <div class="container">
      <div class="aside">
        <div class="project">
          <el-input
            v-model="searchVal"
            :placeholder="$t('NocodePrinterSetting.searchKeyword')"
            :prefix-icon="Search"
          />

          <el-scrollbar class="scrollbar">
            <el-tree
              style="max-width: 600px"
              :data="printTemplateFormStructure"
              @node-click="handleNodeClick"
              ref="treeRef"
              :filter-node-method="filterTree"
              :empty-text="$t('NocodePrinterSetting.noContent')"
              :icon="ArrowDownBold"
              :indent="24"
            >
              <template #default="{ node, data }">
                <div class="custom-tree-node" :class="{'active': activePageId === data.id}">
                  <div :class="['node-icon', data.type]">
                    <el-icon size="20" v-if="!node.expanded && data.type === NocodeStructureType.GROUP">
                      <i-ven-global-page-folder />
                    </el-icon>
                    <el-icon size="20" v-else-if="node.expanded && data.type === NocodeStructureType.GROUP">
                      <i-ven-global-page-folder-open />
                    </el-icon>
                    <el-icon size="20" v-else-if="data.type === NocodeStructureType.PAGE">
                      <i-ven-global-page-document />
                    </el-icon>
                    <el-icon size="20" v-else-if="data.type === NocodeStructureType.FORM">
                      <i-ven-global-page-form />
                    </el-icon>
                  </div>
                  <span :title="data.name">{{ data.name }}</span>
                </div>
              </template>
            </el-tree>
          </el-scrollbar>
        </div>
      </div>

      <div class="line"></div>

      <div class="main" v-if="activePageId">
        <div class="title">
          <div class="left">
            <span>
              <el-icon :size="14" color="var(--text-color-placeholder)"><i-ep-warning></i-ep-warning></el-icon>
              <span class="tip">{{ $t('NocodePrinterSetting.printTempTip') }}</span>
              <a target="_blank" href="https://www.banban.work/docs/v1/bk4s8253fe5c/">{{ $t('NocodePrinterSetting.helpDoc') }}</a>
            </span>
          </div>
          <div class="right">
            <el-button class="add-document-temp-btn" @click="handleAddDocxTemplate">
              <el-icon :size="16" style="margin-right: 4px;">
                <i-ep-plus></i-ep-plus>
              </el-icon>
              {{ $t('NocodePrinterSetting.newDocTemp') }}
            </el-button>
            <el-button type="primary" @click="handleAddPrintTemplate">
              <el-icon :size="16" style="margin-right: 4px;">
                <i-ep-plus></i-ep-plus>
              </el-icon>
              {{ $t('NocodePrinterSetting.newTableTemp') }}
            </el-button>
          </div>
        </div>
        <div class="table-box">
          <el-table ref="tableRef" :data="printTableData || []" :empty-text="$t('NocodePrinterSetting.noData')">
            <el-table-column min-width="180" prop="name" :label="$t('NocodePrinterSetting.tempName')">
              <template #default="scope">
                <span>
                  {{ scope.row?.name }}
                </span>
              </template>
            </el-table-column>
            <el-table-column min-width="180" prop="range" :label="$t('NocodePrinterSetting.useRange')">
              <template #default="scope">
                <span>
                  {{ getRangeText(scope.row?.range) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column min-width="180" prop="enabled" :label="$t('NocodePrinterSetting.status')">
              <template #default="scope">
                <el-switch size="small" :modelValue="scope.row?.enabled" @update:modelValue="changeSatus(scope.row, $event)" />
              </template>
            </el-table-column>
            <el-table-column min-width="180" :label="$t('NocodePrinterSetting.operate')">
              <template #default="scope">
                <el-space :size="12" spacer="|" style="color: #d9d9d9;">
                  <el-button link @click="handlePreviewPrintTemplate(scope.row)">{{ $t('NocodePrinterSetting.preview') }}</el-button>
                  <el-button link @click="handleEditPrintTemplate(scope.row)">{{ $t('NocodePrinterSetting.edit') }}</el-button>
                  <el-dropdown 
                    trigger="click" 
                    placement="bottom"
                    @command="handleMoreCommand"
                  >
                    <el-button link>
                      {{ $t('NocodePrinterSetting.more') }}<el-icon class="el-icon--right"><arrow-down /></el-icon>
                    </el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item :command="{ action: 'copy', row: scope.row }">
                          {{ $t('NocodePrinterSetting.copy') }}
                        </el-dropdown-item>
                        <el-dropdown-item :command="{ action: 'delete', row: scope.row }" style="color: var(--color-danger);">
                          {{ $t('NocodePrinterSetting.delete') }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </el-space>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div v-else class="empty-box">
        {{ $t('NocodePrinterSetting.noContent') }}
      </div>
    </div>
  </div>

  <add-template-dialog ref="addPrintTemplateRef" :tableUID="activePageId" :activePageId="activePageId" :isEditable="printTemplateIsEditable" :templateType="printTemplateType" :template="template" @update="updateTableData"></add-template-dialog>
  <office-print-preview 
    v-model="visibleOfPreview"
    :uploadTemplateName="uploadTemplateName" 
    :nocodeId="nocode.meta.id"
    :tableId="activePageId"
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
    :tableId="activePageId"
    :recordId="templateRecord?.uid"
    :isTemporary="templateRecord?.isTemporary ?? false"
    @download="downloadPrintTemplate" 
    @closed="closePreviewDialog"
  ></word-print-preview>
</template>
  
<script setup lang='ts'>
import { ArrowDownBold, Search } from '@element-plus/icons-vue';
import { computed, inject, onMounted, Ref, ref, watch } from 'vue';
import { debounce } from 'lodash';
import { NOCODE, ORGANIZE_UTIL, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { NocodeStructureType, PrintedTemplateRecord, PrintTemplate, PrintTemplateType } from '@common/types/nocode';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import { ArrowDown } from '@element-plus/icons-vue';
import { isSystemField } from '@common/utils';
import { fetchPathAsArrayBuffer } from '@common/utils/print/shared';
import type { ImageMap } from '@common/utils/print/shared';
import { usePassportStore } from '@renderer/stores';
import { doDownload } from "@renderer/utils";
import { projectApi } from '@renderer/utils/api/project';
import i18next from 'i18next';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { filterPrintTemplateFormStructure, findFirstPrintTemplateFormNodeId } from './printTemplateSettingTree';

const organizeUtil = inject(ORGANIZE_UTIL)
const nocode = inject(NOCODE);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);
const searchVal = ref('');
const treeRef = ref(null);
const activePageId = ref();
const tableRef = ref();
const printTableData = ref();
const printTemplateFormStructure = computed(() => filterPrintTemplateFormStructure(nocode.value.body.structure || []));

const visibleOfPreview = ref(false);
const visibleOfWordPreview = ref(false);
const previewArrayBuffer = ref<ArrayBuffer | Blob | null>(null);
const previewPathStr = ref<string | null>(null);
const previewPath = computed(()=>{
  if (previewArrayBuffer.value) {
    return previewArrayBuffer.value;
  }
  return previewPathStr.value ? previewPathStr.value : '';
});
const templateRecord: Ref<PrintedTemplateRecord> = ref();
const fields = computed(() => {
  const activeTable = nocode.value.body.formData.tables.find(table => table.uid === activePageId.value)
  return (activeTable?.fields || []).filter(field => !isSystemField(field))
})
const uploadTemplateName = ref('');
const passportState = usePassportStore();
passportState.init();

const getRangeText = (range) => {
  if (!range || !organizeUtil) return '';
  
  const names = [];
  for (const key in range) {
    if (!Array.isArray(range[key])) continue;
    for (const itemId of range[key]) {
      const item = organizeUtil[key]?.find(d => d.id === itemId);
      if (item) {
        const label = item.realname || item.name || i18next.t('NocodePrinterSetting.unnamed');
        names.push(label);
      }
    }
  }
  
  return names.join(',') || '';
}
const updateTableData = async() => {
  await getAllPrintTemplate();
}
const getAllPrintTemplate = async () => { 
  if (!activePageId.value) {
    printTableData.value = [];
    return;
  }
  const res = await axios.get('project/get-all-print-template', {
    params: {
      nocodeId: nocode.value.meta.id,
      tableId: activePageId.value,
    }
  }).catch(err => {
    ElMessage.error(err.message);
  });
  if(res) {
    printTableData.value = res.data;
  }
}
const addPrintTemplateRef = ref();
const printTemplateIsEditable = ref(false);
const printTemplateType = ref<PrintTemplateType>()
const template = ref();

activePageId.value = findFirstPrintTemplateFormNodeId(nocode.value.body.structure || []);
onMounted(() => {
  getAllPrintTemplate();
})
const handleNodeClick = (data) => {
  if (data.type !== NocodeStructureType.FORM) return;
  activePageId.value = data.id;
  getAllPrintTemplate()
}

const handleAddDocxTemplate = () => {
  printTemplateIsEditable.value = false;
  printTemplateType.value = PrintTemplateType.WORD;
  setTimeout(() => {
    addPrintTemplateRef.value.show()
  }, 1);
}

const handleAddPrintTemplate = () => {
  printTemplateIsEditable.value = false;
  printTemplateType.value = PrintTemplateType.EXCEL;
  setTimeout(() => {
    addPrintTemplateRef.value.show()
  }, 1);
}
const getTemplateRender = async (option: { printTemplateUID: string }) => {
  const res = await projectApi.getTemplateRender({
    nocodeId: nocode.value.meta.id,
    tableId: activePageId.value,
    printTemplateUID: option.printTemplateUID,
  }).catch((error) => {
    ElMessage.error(error?.response?.data?.message || error?.message);
    return null;
  });
  return res;
}
const handlePreviewPrintTemplate = async (row: PrintTemplate) => {
  const res = await getTemplateRender({ printTemplateUID: row.uid })
  if (!res?.url) {
    return;
  }
  previewPathStr.value = `${window.location.origin}${res.url}`;
  templateRecord.value = res.record
  uploadTemplateName.value = res.record?.name || row.name;
  printTemplateType.value = row.type;
  if (row.type === PrintTemplateType.EXCEL) {
    visibleOfPreview.value = true;
  } else {
    visibleOfWordPreview.value = true;
  }
}


const closePreviewDialog = () => {
  previewArrayBuffer.value = null;
  previewPathStr.value = null;
  uploadTemplateName.value = '';
};

const downloadPrintTemplate = async(downloadSrc) => { 
  if(typeof downloadSrc === 'string') {  // 如果是字符串url
    doDownload({
      url: downloadSrc,
      name: uploadTemplateName.value,
    })
  } else if (downloadSrc instanceof Blob || downloadSrc instanceof ArrayBuffer) {  // 如果是Blob或者Arraybuffer
    const blob = new Blob([downloadSrc], {type: printTemplateType.value === PrintTemplateType.EXCEL ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
    const url = URL.createObjectURL(blob);
    doDownload({
      url: url,
      name: uploadTemplateName.value,
    })
  } else {  // 如果是File对象
    const url = URL.createObjectURL(downloadSrc);
    doDownload({
      url: url,
      name: uploadTemplateName.value,
    })
  }
};

const handleEditPrintTemplate = (row) => {
  printTemplateIsEditable.value = true;
  printTemplateType.value = row.type;
  template.value = row;
  setTimeout(() => {
    addPrintTemplateRef.value.show(nocode.value.body.printTemplate[activePageId.value].find(item => item.uid === row.uid))
  }, 1);
}

interface Tree {
  [key: string]: any;
}

const filterTree = (value: string, data: Tree) => {
  if (!value) return true;
  return data.name.includes(value);
}

const debouncedFilter = debounce((val: string) => {
  treeRef.value?.filter(val);
}, 300);

watch(searchVal, (val) => {
  debouncedFilter(val);
});

const changeSatus = (row, val) => {
  row.enabled = val;
  saveTempTabData(row);
}

const handleMoreCommand = (value) => {
  switch (value.action) {
    case 'copy':
      handleCopy(value.row)
      break
    case 'delete':
      handleDelete(value.row)
      break
  }
}

const handleCopy = (row) => {
  copyTempTabData(row)
}
const handleDelete = (row) => {
  deleteTempTabData(row);
}

const copyTempTabData = async (row) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  const res = await axios.post("/project/copy-nocode-print-template", {
    nocodeId: nocode.value.meta.id,
    tableId: activePageId.value,
    printTemplateUID: row.uid,
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
  if (res) {
    const mainSign = Array.isArray(res.headers?.['x-sign']) ? res.headers['x-sign'][0] : res.headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
    ElMessage.success(i18next.t('NocodePrinterSetting.copySuccess'));
    getAllPrintTemplate();
  }
}

const deleteTempTabData = async (row) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  const res = await axios.post("/project/delete-nocode-print-template", {
    nocodeId: nocode.value.meta.id,
    tableId: activePageId.value,
    printTemplateUID: row.uid,
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
  if (res) {
    const mainSign = Array.isArray(res.headers?.['x-sign']) ? res.headers['x-sign'][0] : res.headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
    ElMessage.success(i18next.t('NocodePrinterSetting.deleteSuccess'));
    getAllPrintTemplate();
  }
}

const saveTempTabData = async (row) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  const res = await axios.post("/project/update-nocode-print-template", {
    nocodeId: nocode.value.meta.id,
    tableId: activePageId.value,
    printTemplate: nocode.value.body.printTemplate[activePageId.value].find(item => item.uid === row.uid),
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).then(({headers}) => {
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
    ElMessage.success(i18next.t('NocodePrinterSetting.updateSuccess'));
  })
  .catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
}
</script>
  
<style scoped lang="scss">
.nocode-printer-setting {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .container {
    height: 100%;
    display: flex;
    min-height: 0;

    .aside {
      width: 300px;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 16px;
      min-height: 0;

      .project {
        flex: 1;
        display: flex;
        flex-direction: column;
        row-gap: 8px;
        overflow: hidden;
        min-height: 0;

        :deep(.el-input) {
          height: 32px;
          
          .el-input__wrapper {
            background-color: var(--bg-color-overlay);
            box-shadow: unset;
            border-radius: 4px;
          }
        }

        :deep(.el-tree) {
          .el-tree-node__content {
            width: 100%;
            height: 44px;
            line-height: 44px;
            transition: all 0.3s ease;

            .el-tree-node__expand-icon {
              position: absolute;
              right: 8px;

              &.expanded {
                transform: rotate(180deg);
              }
            }

            &:hover {
              background-color: var(--bg-color-overlay) !important;
            }

            &:has(> .custom-tree-node.active) {
              background-color: var(--bg-color-overlay) !important;
            }

            .el-tree-node__expand-icon.is-leaf {
              padding: 0;
              margin-right: 4px
            }

            .custom-tree-node {
              width: calc(100% - 16px);
              height: 100%;
              display: flex;
              align-items: center; 
              position: relative;

              .node-icon {
                width: 20px;
                height: 20px;
                border-radius: 4px;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-right: 8px;
                margin-left: 16px;
              }

              span {
                width: calc(100% - 80px);
                z-index: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .more-button {
                margin-right: 18px;
                color: var(--text-color-secondary);
                opacity: 0;
                transition: all 0.3s ease;
              }

              &:hover {
                .more-button {
                  opacity: 1;
                }
              }
            }

          }

          .el-tree-node:focus,
          .el-tree-node:focus-visible,
          .el-tree-node.is-focusable {
            .el-tree-node__content {
              background-color: unset;
            }
          }

        }

        .scrollbar {
          flex: 1;
        }
      }
    }

    .line {
      height: 100%;
      border-left: 1px solid var(--border-color);
    }

    .main {
      width: 100%;
      height: 100%; /* 让容器有高度 */
      display: flex;
      flex-direction: column; /* 纵向排列 */
      padding: 16px;
      gap: 16px;
      min-width: 0;

      .title {
        width: 100%;
        height: 32px;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0;
        gap: 8px;
        .left {
          min-width: 30%;
          span {
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--text-color-placeholder);
          }
          .tip {
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: inline-block;
          }

          a {
            color: var(--color-primary);
            width: fit-content;
            white-space: nowrap;
          }
        }

        .right {
          display: flex;
          .add-document-temp-btn {
            color: var(--color-primary);
            border-color: var(--color-primary);
          }
        }

        :deep(.el-button){
          border-radius: 4px;
        }
      }

      .table-box {
        border-radius: 4px;
        overflow: hidden;
        height: 100%;
        width: 100%;

        :deep(.el-table) {
          --el-table-border: 0px;
          width: 100%;
          height: 100%;
          th {
            background-color: var(--color-white);
            color: var(--text-color-regular);
            font-size: 16px;
            line-height: 24px;
          }

          tr {
            background-color: var(--color-white);
            color: var(--text-color-regular);
            font-size: 14px;
            cursor: pointer;

            th {
              padding: 8px 8px;
            }
            td {
              padding: 8px 8px;
            }
          }
          .el-table__body-wrapper {
            border-top: 1px solid var(--text-color-placeholder);
            margin-top: 8px;
            padding-top: 8px;

            .el-scrollbar {
  
              .el-scrollbar__view {
                height: 100%;
              }
            }
          }

          .el-table__empty-block {
            width: 100% !important;
          }

          .cell {
            padding: 0;
          }

          .el-table__inner-wrapper::before {
            display: none;
          }

          .table-box-operation-popover {
            
          }
        }
      }
    }
  }
}
</style>
