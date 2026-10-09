<template>
  <div class="nocode-save-as">
    <div class="export-container">
      <div class="export-settings">
        <div class="option-item">
          <div class="option-title">{{ $t("nocodeSaveAs.exportFormData") }}</div>
          <div class="is-export-data">
            <el-radio-group v-model="exportData">
              <el-radio :label="false">{{ $t("ReportSaveAs.radioFalse") }}</el-radio>
              <el-radio :label="true">{{ $t("ReportSaveAs.radioTrue") }}</el-radio>
            </el-radio-group>
            <div class="export-data" v-if="exportData">
              <el-select class="export-type" v-model="exportDataType" placeholder="Select">
                <el-option
                  v-for="item in exportOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <div v-if="exportDataType === 'some'" class="export-count-wrapper">
                <el-input type="number" class="export-count" v-model.number="rowCount" placeholder="Select" :min="1" @change="() => rowCount = Math.max(1, Number(rowCount) || 1)" />{{ $t("nocodeSaveAs.row") }}
              </div>
            </div>
          </div>
        </div>
        <div class="option-item">
          <div class="option-title">{{ $t("nocodeSaveAs.selectPages") }}</div>
          <div class="table-setting">
            <div class="table-empty" v-if="!tableTreeData.length">{{ $t("nocodeSaveAs.noTableAvailable") }}</div>
            <el-tree-select
              v-else
              v-model="selectedNodeValues"
              class="table-tree-select"
              :data="tableTreeData"
              multiple
              show-checkbox
              :check-strictly="false"
              filterable
              fit-input-width
              node-key="value"
              collapse-tags
              collapse-tags-tooltip
              :max-collapse-tags="1"
              :render-after-expand="false"
              :default-expand-all="true"
              :placeholder="$t('nocodeSaveAs.selectPages')"
              popper-class="custom-select-tree-popper nocode-save-as-table-popper"
              :props="{ class: (data) => data.isGroup ? 'is-group-node' : '' }"
            >
              <template #header>
                <div class="tree-select-header" v-if="allNodeValues.length > 0" @click="isAllSelected = !isAllSelected">
                  <el-checkbox
                    v-model="isAllSelected"
                    :indeterminate="isIndeterminate"
                    @click.stop
                  />
                  <span class="header-label">{{ $t("nocodeSaveAs.all") }}</span>
                </div>
              </template>
            </el-tree-select>
          </div>
        </div>
        <div class="option-item" v-if="showReadonlyAfterImport">
          <div class="option-title">{{ $t("nocodeSaveAs.isAllowEdit") }}</div>
          <el-radio-group v-model="disableEdit">
            <el-radio :label="false">{{ $t("ReportSaveAs.radioTrue") }}</el-radio>
            <el-radio :label="true">{{ $t("ReportSaveAs.radioFalse") }}</el-radio>
          </el-radio-group>
        </div>
        <div class="option-item" v-if="showImportValidity">
          <div class="option-title">{{ $t("nocodeSaveAs.appValidity") }}</div>
          <div class="expire-setting">
            <el-radio-group v-model="expireType">
              <el-radio label="forever">{{ $t("nocodeSaveAs.forever") }}</el-radio>
              <el-radio label="limited">{{ $t("nocodeSaveAs.limited") }}</el-radio>
            </el-radio-group>
            <el-config-provider v-if="expireType === 'limited'" :locale="elementPlusLocale">
              <el-date-picker
                v-model="expireAt"
                class="expire-picker"
                type="datetime"
                format="YYYY.MM.DD HH:mm:ss"
                value-format="x"
                prefix-icon=""
                :suffix-icon="ArrowDown"
                :show-arrow="false"
                popper-class="nocode-save-as-expire-at-popper"
                :placeholder="$t('nocodeSaveAs.expireAtPlaceholder')"
              />
            </el-config-provider>
          </div>
        </div>
        <!-- <div class="option-item">
          <div class="option-title option-title-with-tip">
            <el-text>
              {{ $t("nocodeSaveAs.convertStaticData") }}
              <el-tooltip popper-class="save-as-option-title-tip" :content="titleTip" placement="bottom-end" effect="light">
                <el-icon size="16" color="#A1A1A1"><i-ant-design-question-circle-outlined /></el-icon>
              </el-tooltip>
            </el-text>
          </div>
          <el-radio-group v-model="exportToJson">
            <el-radio :label="false">{{ $t("ReportSaveAs.radioFalse") }}</el-radio>
            <el-radio :label="true">{{ $t("ReportSaveAs.radioTrue") }}</el-radio>
          </el-radio-group>
        </div> -->
      </div>
    </div>
    <div class="footer">
      <el-button class="footer-btn cancel-btn" @click="handleClose">{{ $t("nocodeSaveAs.cancel") }}</el-button>
      <el-button type="primary" class="footer-btn confirm-btn" @click="handleConfirm"
        :loading="btnLoading">{{ $t("ReportSaveAs.confirm") }}</el-button>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { ref, onMounted, watch, computed } from "vue";
import axios from "axios";
import { ElMessage } from "element-plus";
import { ArrowDown } from "@element-plus/icons-vue";
import { elementPlusLocale } from "@renderer/utils/elementPlusLocale";
import { NocodeBody, NocodeImportRestriction } from "@common/types/nocode";
import { TableUID } from "@common/types/project";
import { doDownload } from "@renderer/utils";
import i18next from "i18next";
import { buildNocodeSaveAsImportRestriction, getExportPageIdFromNodeValue, getExportTableOptions, getNocodeSaveAsOptionVisibleState, type ExportTableTreeNode } from "./nocodeSaveAs.helper";

const nocodeId = ref("");

const props = defineProps<{
  nocodeId: string,
}>();

const emit = defineEmits<{
  (event: "close"),
}>();

const exportToJson = ref(false);
const exportData = ref(false);
const btnLoading = ref(false);
const rowCount = ref(100)
const exportDataType = ref<"all" | "some">('some')
const tableTreeData = ref<ExportTableTreeNode[]>([]);
const selectedNodeValues = ref<string[]>([]);
const allNodeValues = ref<string[]>([]);
const disableEdit = ref(false);
const selectedTableUIDs = ref<TableUID[]>([]);
const selectedPageIDs = ref<string[]>([]);
const availableTableUIDs = ref<TableUID[]>([]);
const currentImportRestriction = ref<NocodeImportRestriction>();

const isAllSelected = computed({
  get() {
    return allNodeValues.value.length > 0 && selectedNodeValues.value.length === allNodeValues.value.length;
  },
  set(val) {
    if (val) {
      selectedNodeValues.value = [...allNodeValues.value];
    } else {
      selectedNodeValues.value = [];
    }
  },
});

const isIndeterminate = computed(() => {
  return selectedNodeValues.value.length > 0 && selectedNodeValues.value.length < allNodeValues.value.length;
});

const showReadonlyAfterImport = ref(true);
const showImportValidity = ref(true);
const expireType = ref<"forever" | "limited">("forever");
const expireAt = ref("");
const exportOptions = [
  {
    value: 'all',
    get label() { return i18next.t("nocodeSaveAs.allData") },
  },
  {
    value: 'some',
    get label() { return i18next.t("nocodeSaveAs.partData") },
  },
]

const getImportRestriction = (): NocodeImportRestriction | undefined => {
  return buildNocodeSaveAsImportRestriction({
    currentImportRestriction: currentImportRestriction.value,
    showReadonlyAfterImport: showReadonlyAfterImport.value,
    showImportValidity: showImportValidity.value,
    disableEdit: disableEdit.value,
    expireType: expireType.value,
    expireAt: expireAt.value,
  });
}

const loadTableOptions = async () => {
  const nocodeBody = await axios.get(`/project/get-nocode-body/${nocodeId.value}`).then(({ data }) => data as NocodeBody).catch((error) => {
    ElMessage.error(error?.response?.data?.message);
    return null;
  });
  if (!nocodeBody) return;

  currentImportRestriction.value = nocodeBody.importRestriction;
  const optionVisibleState = getNocodeSaveAsOptionVisibleState(nocodeBody.importRestriction);
  showReadonlyAfterImport.value = optionVisibleState.showReadonlyAfterImport;
  showImportValidity.value = optionVisibleState.showImportValidity;
  if (!showReadonlyAfterImport.value) {
    disableEdit.value = false;
  }
  if (!showImportValidity.value) {
    expireType.value = "forever";
    expireAt.value = "";
  }

  const { treeData, tableUIDs, selectedNodeValues: defaultSelectedNodeValues } = getExportTableOptions(nocodeBody);
  tableTreeData.value = treeData;
  availableTableUIDs.value = tableUIDs;
  allNodeValues.value = [...defaultSelectedNodeValues];
  selectedNodeValues.value = [...defaultSelectedNodeValues];
  selectedTableUIDs.value = [...tableUIDs];
  selectedPageIDs.value = defaultSelectedNodeValues.map(getExportPageIdFromNodeValue).filter(Boolean);
}

const doExport = async () => {
  const res = await axios.post("/project/export-nocode", {
    nocodeId: nocodeId.value,
    toJson: exportToJson.value,
    exportData: exportData.value,
    exportDataType: exportDataType.value,
    rowCount: rowCount.value,
    selectedTableUIDs: tableTreeData.value.length ? selectedTableUIDs.value : undefined,
    selectedPageIDs: tableTreeData.value.length ? selectedPageIDs.value : undefined,
    importRestriction: getImportRestriction(),
  }).catch(reason => {
    let message = reason?.response?.data?.message || reason?.message || i18next.t("projectEditor.exportProjectFailed");
    if (message.indexOf("ENOSPC:") > -1) message = i18next.t("ReportSaveAs.diskSpaceTip");
    ElMessage.error(message);
    return null;
  });
  if (res && res.data) {
    doDownload(res.data);
    handleClose()
  }
}

const handleConfirm = async () => {
  if (tableTreeData.value.length && !selectedNodeValues.value.length) {
    ElMessage.warning(i18next.t("nocodeSaveAs.selectTableRequired"));
    return;
  }
  if (exportData.value) {
    if (exportDataType.value === "some") {
      rowCount.value = Math.max(1, Number(rowCount.value) || 1);
    }
  }
  if (expireType.value === "limited") {
    const currentExpireAt = Number(expireAt.value || 0);
    if (!currentExpireAt) {
      ElMessage.warning(i18next.t("nocodeSaveAs.expireAtRequired"));
      return;
    }
    if (currentExpireAt <= Date.now()) {
      ElMessage.warning(i18next.t("nocodeSaveAs.expireAtFuture"));
      return;
    }
  }
  btnLoading.value = true;
  await doExport();
  btnLoading.value = false;
};

const handleClose = () => {
  btnLoading.value = false;
  emit('close');
}

watch(selectedNodeValues, (newVal) => {
  const filtered = newVal.filter(id => availableTableUIDs.value.includes(id as TableUID));
  if (filtered.length !== selectedTableUIDs.value.length || filtered.some((id, index) => id !== selectedTableUIDs.value[index])) {
    selectedTableUIDs.value = filtered as TableUID[];
  }
  const filteredPageIDs = newVal.map(getExportPageIdFromNodeValue).filter(Boolean);
  if (filteredPageIDs.length !== selectedPageIDs.value.length || filteredPageIDs.some((id, index) => id !== selectedPageIDs.value[index])) {
    selectedPageIDs.value = filteredPageIDs;
  }
}, { deep: true });

onMounted(async () => {
  nocodeId.value = props.nocodeId;
  await loadTableOptions();
})
</script>

<style scoped lang='scss'>
.nocode-save-as {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;

  .export-container {
    flex: 1;
    padding: 16px;
    overflow-y: auto;

    .export-settings {
      display: flex;
      flex-direction: column;
      row-gap: 24px;

      .option-item .option-title-with-tip {
        .el-text {
          line-height: 20px;
          .el-icon {
            margin-left: 2px;
            :hover {
              cursor: var(--cursor-pointer);
            }
          }
        }
      }

      .option-title {
        margin-bottom: 8px;
        font-size: 14px;
        color: #333;
        font-weight: 400;
      }

      .is-export-data {
        display: flex;
        flex-direction: row;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;

        :deep(.el-radio-group) {
          .el-radio {
            margin-right: 24px;
            height: 32px;
          }
        }

        :deep(.export-data) {
          display: flex;
          align-items: center;
          gap: 8px;

          .export-type {
            width: 90px;
            height: 32px;
            .el-select__wrapper{
              border-radius: 4px;
              background-color: #F5F6F7;
              box-shadow: none !important;
              padding: 0 8px;
            }
          }
          .export-count-wrapper {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 14px;
            color: #7A7A7A;
          }
          .export-count {
            width: 72px;
            height: 32px;
            .el-input__wrapper {
              border-radius: 4px;
              background-color: #F5F6F7;
              box-shadow: none !important;
            }

            .el-input__inner::-webkit-inner-spin-button {
              all: unset;
            }
          }
        }
      }

      .table-setting {
        width: 100%;
        display: flex;
        flex-direction: column;

        .table-tip,
        .table-empty {
          font-size: 12px;
          line-height: 20px;
          color: #7A7A7A;
        }

        .table-tree-select {
          width: 100%;
          :deep(.el-select__wrapper) {
            min-height: 36px;
            border-radius: 4px;
            background-color: #F5F6F7;
            box-shadow: none !important;
          }

          :deep(.el-select__selection) {
            .el-tag {
              background-color: #fff;
              border-radius: 4px;
              color: #333;
              height: 24px;
              line-height: 24px;
              padding: 8px;
              
              .el-tag__close {
                color: #999;
                font-size: 10px;
                &:hover {
                  background-color: transparent;
                  color: #666;
                }
              }
            }

            .el-select__collapse-tag {
              background-color: #F5F6F7;
              border: 1px solid #EAEAEA;
              border-radius: 4px;
              height: 22px;
              padding: 0 6px;
              margin: 2px;
              
              .el-tag__content {
                display: block;
                color: #666;
                font-size: 11px;
              }
            }
          }
        }
      }

      .expire-setting {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 12px;

        :deep(.el-radio-group) {
          display: flex;
          align-items: center;
          flex-wrap: nowrap;

          .el-radio {
            margin-right: 12px;
            height: 32px;

            &:last-child {
              margin-right: 0;
            }
          }
        }

        .expire-picker {
          width: 190px;
          height: 32px;

        }
        :deep(.el-input),
        :deep(.el-date-editor) {
          .el-input__wrapper {
            border-radius: 4px !important;
            background-color: #F5F6F7 !important;
            box-shadow: none !important;
            padding: 0 8px !important;
            
            .el-input__prefix {
              display: none !important;
            }

            .el-input__inner {
              color: #333 !important;
              font-size: 13px !important;
              &::placeholder {
                color: #A8ABB2 !important;
              }
            }

            .el-input__suffix {
              color: #999 !important;
              font-size: 14px !important;
            }
          }
        }
      }

      :deep(.el-radio-group) {
        display: flex;
        align-items: center;
        flex-wrap: wrap;

        .el-radio {
          --el-radio-font-weight: 400;
          --el-radio-text-color: #333;
          --el-color-primary: #007AFF;
          margin-right: 24px;
          display: inline-flex;
          align-items: center;
          
          &.is-checked {
            .el-radio__label {
              color: #333;
            }
            .el-radio__inner {
              border-color: #007AFF;
              background: #007AFF;
            }
          }
        }
      }
    }
  }

  .footer {
    height: 72px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 0 24px;
    border-top: 1px solid #F0F0F0;

    .footer-btn {
      width: 80px;
      height: 36px;
      font-size: 14px;
      border-radius: 4px;
      transition: all 0.3s;
    }

    .cancel-btn {
      background-color: #F5F6F7;
      border: none;
      color: #333;
      
      &:hover {
        background-color: #e8e9ea;
        color: #333;
      }
    }

    .confirm-btn {
      margin-left: 12px;
      background-color: #007AFF;
      border-color: #007AFF;
      
      &:hover {
        background-color: #0066D6;
        border-color: #0066D6;
      }
    }
  }
}
</style>

<style lang='scss'>
.nocode-save-as-expire-at-popper.el-popper {
  background: #fff !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
  
  .el-popper__arrow {
    display: none !important;
  }

  .el-picker-panel {
    background: transparent !important;
  }
}

.save-as-option-title-tip {
  --el-bg-color-overlay: #fff;
  width: 200px;
  font-size: 12px;
  line-height: 16px;
  padding: 8px;
  color: #3F3F3F;
}

.el-popper.nocode-save-as-table-popper {
  border-radius: 8px !important;
  padding: 4px 0 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
  background-color: #fff;

  .el-select-dropdown__header {
    padding: 0;
    border-bottom: 0;
  }

  .el-select__selection {
    max-width: 480px;
    padding: 0 4px;
  }

  .el-select-dropdown__list {
    padding: 0 4px !important;
  }

  .el-tree-select__input-wrapper {
    padding: 8px;
    .el-input__wrapper {
      background-color: #F5F6F7 !important;
      border-radius: 6px !important;
      box-shadow: none !important;
      height: 32px;
    }
  }

  .el-select-dropdown {
    display: flex;
    flex-direction: column;
    max-height: 360px !important;
    overflow-y: auto !important;
  }

  .el-select-dropdown__header {
    padding: 0 4px;
    border-bottom: 0;
  }

  .el-scrollbar {
    height: auto !important;
    flex: none !important;
    overflow: visible !important;
    
    .el-scrollbar__wrap {
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
    }
  }

  .tree-select-header {
    height: 32px;
    display: flex;
    align-items: center;
    padding: 0 12px 0 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
    
    &:hover {
      background-color: #F5F6F7;
    }

    .el-checkbox {
      margin-right: 8px;
      height: 32px;
    }

    .header-label {
      font-size: 13px;
      color: #333;
    }
  }

  .el-tree-node__content {
    height: 32px !important;
    border-radius: 4px;
    margin: 1px 0;
    position: relative;
    padding-right: 12px;
    
    &:hover {
      background-color: #F5F6F7;
    }

    .el-select-dropdown__item.is-selected::after,
    .el-tree-node__content-checkmark,
    .selected-icon,
    .el-icon-check {
      display: none !important;
    }
  }

  .el-tree-node__expand-icon {
    font-size: 12px;
    padding: 4px;
  }

  .el-tree-node.is-current > .el-tree-node__content {
    background-color: #F5F6F7 !important;
    color: #333 !important;
    font-weight: 500;
  }

  .el-tree-node__label {
    white-space: normal;
    line-height: 20px;
    font-size: 13px;
    color: #333 !important;
  }

  .el-checkbox {
    margin-right: 8px;
    display: flex;
    align-items: center;
  }

  .el-checkbox__inner {
    border-radius: 3px;
  }

  .el-tree-node__expand-icon {
    color: #999;
    &.is-leaf {
      color: transparent;
    }
  }

  .el-select-dropdown__item {
    &.is-selected {
      &::after {
        display: none !important;
      }
    }
  }
}

.el-popper.nocode-save-as-expire-at-popper {
  border-radius: 8px !important;
  padding: 0 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
  background-color: #fff;
  .el-picker-panel__footer {
    background-color: #fff;
    border-radius: 0 0 8px 8px;
  }
}
</style>
