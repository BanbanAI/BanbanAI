<template>
  <div
    class="mobile-select-data-dialog"
    :style="{ '--dialog-footer-height': widget.isMultiple ? '49px' : '0px' }"
  >
    <el-dialog
      :modelValue="modelValue"
      @update:modelValue="emit('update:modelValue', $event)"
      :title="$t('selectDataTitle')"
      width="100%"
      height="100%"
      align-center
      :show-close="false"
      :close-on-click-modal="false"
      @open="onOpen"
      :fullscreen="isFullscreen"
      :close-on-press-escape="!isLoading"
    >
      <template #header>
        <div class="title" @click="handleClose">
          <el-icon class="back-button"><i-ep-arrow-left /></el-icon>
          <span>{{ $t("selectDataTitle") }}</span>
        </div>
      </template>

      <div class="content" v-loading="isLoading" element-loading-custom-class="select-data-loading" :element-loading-text="$t('mergeDataLoading')">
        <!-- <el-button
          class="add-data-btn"
          v-if="widget.allowAddNewRow && hasOpenAddDialog() && !isSharePage"
          type="primary"
          @click="addsearchFormData"
        >
          <el-icon>
            <i-ep-plus></i-ep-plus>
          </el-icon>
          添加
        </el-button> -->
        <nocode-permission-table
          :nocodeId="widget.nocodeId"
          ref="nocodeTableRef"
          permissionMode="data"
          :tableUID="widget.connectionTable[1]"
          :click-row-checked="!widget.allowEditRow"
          v-if="widget"
          @toggleCheckboxRow="handleSelectRow"
          @toggleCheckAll="handleSelectAll"
          @changeRows="handleChangeRows"
          @submitted="handleSubmitted"
          :isMultiple="widget.isMultiple"
          :preHiddenColumns="preHiddenColumns"
          :isAddDataAble="widget.allowAddNewRow"
          :isEditDataAble="widget.allowEditRow"
          :isImportDataAble="false"
          :isExportDataAble="false"
          :clickRowShowDetail="widget.allowEditRow"
          :isShowMoreMenu="false"
          :hideColumnsAble="false"
          :preFilterRule="widget.formDataFilter"
          :isInitialSearchVisible="true"
          :addNewRowData="addNewRowData"
          :isFilterEmptyValue="false"
          :tableViewMeta="{}"
        >
          <template #checkbox="{ row, checked }">
            <el-checkbox
              :modelValue="isSelected(row)"
              :value="true"
              style="height: 22px; width: 18px"
            />
          </template>
          <template #radio="{ row, checked }">
            <el-radio
              :modelValue="isSelected(row)"
              :value="true"
              style="height: 22px; width: 18px"
            ></el-radio>
          </template>
        </nocode-permission-table>
      </div>
      <template #footer v-if="widget.isMultiple">
        <el-button type="default" class="cancel" :disabled="isLoading" @click="handleClose">{{ i18next.t("cancel") }}</el-button>
        <el-button type="primary" class="confirm" :loading="isLoading" :disabled="isLoading" @click="handleConfirm">{{ i18next.t("confirm") }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, toRaw, watch } from "vue";
import { useRuntime } from "@renderer/utils/other";
import { useWidget } from "@renderer/b2/types";
import { FormElement } from "@renderer/b2/controllers/form";
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { getSelectDataPreHiddenColumns, SelectData } from "./selectData";
import { ElMessage } from "element-plus";
import IEpPlus from "~icons/ep/plus";
import IVenIconFullScreen from "~icons/ven-icon/widget-form-select-data-full-screen";
import IVenIconExitFullScreen from "~icons/ven-icon/widget-form-select-data-exit-fullscreen";
import IEpArrowLeft from "~icons/ep/arrow-left";
import { debounce } from "lodash";
import { CurrentFieldWrapperOperator, SelectIdOfForm } from "./types";
import { getCurrentRowData } from '../_common/utils';
import i18next, { $t } from "@renderer/widgets/i18next";
import { FormMode } from "../_common/type";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "select", value: typeof selectedRows.value);
}>();

const widget = useWidget<SelectData>();
const pageNumber = ref(1);
const pageSize = ref(20);
const total = ref(0);
const nocodeTableRef = ref();
const isFullscreen = ref(false);
const shouldRefreshAfterSubmit = ref(false);
const lastSubmittedMode = ref<FormMode | null>(null);
const isLoading = ref(false);

const selectedRows = ref<Record<string, any[]>>({});
const preHiddenColumns = computed(() => getSelectDataPreHiddenColumns(widget));

const isSelected = (row) => {
  return Object.keys(selectedRows.value).some(
    (key) => key === row[widget.uuidKey]
  );
};

const addNewRowData = computed(() => {
  if (isEmpty(widget.addCurrentRowToLinkageForm)) return null;
  return getCurrentRowData(widget.topForm.allFormInputs, widget.addCurrentRowToLinkageForm);
})

const handleClose = () => {
  if (isLoading.value) return;
  emit("update:modelValue", false);
};

const handleSelectRow = (row) => {
  const _isSelected = isSelected(row);
  if (_isSelected) {
    delete selectedRows.value[row[widget.uuidKey]];
  } else {
    const selectRow = [row];
    if (widget.isMultiple) {
      selectedRows.value[row[widget.uuidKey]] = selectRow;
    } else {
      selectedRows.value = {
        [row[widget.uuidKey]]: selectRow,
      };
    }
  }
  if (!widget.isMultiple) void handleConfirm();
};

const handleSelectAll = (rows: any[], checked: boolean) => {
  for (const row of rows) {
    if (checked && !isSelected(row)) {
      handleSelectRow(row);
    } else if (!checked && isSelected(row)) {
      handleSelectRow(row);
    }
  }
};

const enrichSelectedRows = async () => {
  const targetFieldUIDs = widget.getFillRuleSourceSubTableFieldUIDs();
  if (!targetFieldUIDs.length || !nocodeTableRef.value?.getFullRow) {
    return selectedRows.value;
  }

  const nextSelectedRows: Record<string, any[]> = {};
  for (const [key, rows] of Object.entries(selectedRows.value || {})) {
    const currentRow = deepClone(rows?.[0]);
    const rowUUID = currentRow?.[widget.uuidKey];
    if (!currentRow || !rowUUID) {
      nextSelectedRows[key] = deepClone(rows || []);
      continue;
    }

    const fullRow = await nocodeTableRef.value.getFullRow(rowUUID, undefined, true);
    if (!fullRow) {
      nextSelectedRows[key] = [currentRow];
      continue;
    }

    targetFieldUIDs.forEach(fieldUID => {
      if (Object.prototype.hasOwnProperty.call(fullRow, fieldUID)) {
        currentRow[fieldUID] = deepClone(fullRow[fieldUID]);
      }
    });

    nextSelectedRows[key] = [currentRow];
  }

  return nextSelectedRows;
};

const handleConfirm = async () => {
  if (isLoading.value) return;
  isLoading.value = true;
  try {
    selectedRows.value = await enrichSelectedRows();
    syncWidgetSelectedRows();
    emit("update:modelValue", false);
    emit("select", toRaw(selectedRows.value));
  } finally {
    isLoading.value = false;
  }
};

const syncTableCheckedRows = () => {
  const rows = Object.values(selectedRows.value || {}).flat().filter(Boolean);
  nocodeTableRef.value?.setCheckedRows?.(rows);
}

const handleSubmitted = (submitType?: FormMode) => {
  shouldRefreshAfterSubmit.value = true;
  lastSubmittedMode.value = submitType ?? null;
};

const handleChangeRows = async () => {
  syncTableCheckedRows();
  if (!shouldRefreshAfterSubmit.value) return;
  shouldRefreshAfterSubmit.value = false;
  const shouldTriggerFillRules = lastSubmittedMode.value === FormMode.Add;
  lastSubmittedMode.value = null;
  await refreshSelectData(shouldTriggerFillRules);
};

const isSharePage = ref(false);
const onOpen = async () => {
  selectedRows.value = deepClone(widget.selectedRows);
  syncTableCheckedRows();
  shouldRefreshAfterSubmit.value = false;
  handleFilterRulesFieldsValue();
  isSharePage.value = window.location.href.includes("share");
  if (widget.shouldShowSubTableAddDisabledTip) {
    ElMessage.warning(i18next.t("subTableAddDisabledTip"));
  }
};

// 有打开的添加弹窗不显示添加按钮
const hasOpenAddDialog = () => {
  const dialogs = document.querySelectorAll(".data-form-dialog");
  for (let dialog of dialogs) {
    const overlay = dialog.querySelector(".el-overlay");

    if (overlay) {
      const style = window.getComputedStyle(overlay);

      if (style.display !== "none") {
        return false;
      }
    }
  }

  return true;
};


// 监听筛选中所选的当前表单的字段值变化
const handleFilterRulesFieldsValue = () => {
  widget.formDataFilter.conditions.forEach(condition => {
    if (condition.fieldType === CurrentFieldWrapperOperator.FIELD && condition.comparisonUid) {
      if (condition.comparisonOfForm && condition.comparisonOfForm === SelectIdOfForm.LINKAGE) {
        // 获取所有与当前查询表单所关联的表单不同的关联表单
        let allRelatedForms = widget.topForm.children.filter(child => child.getSoul().type === "widget.form.relatedData").filter((r: any) => {
          const relatedTable = widget.getTable(r.connectionTable);
          if (relatedTable.fields.find(f => f.uid === condition.comparisonUid)) return r;
        });

        const relatedValues = ref([])
        for(const [index, relatedData] of allRelatedForms.entries()) {
          // 只会与关联表单的主表字段值进行筛选
          watch(() => (relatedData as any).getValue(condition.comparisonUid), (value) => {
            relatedValues.value[index] = value;
            if (relatedValues.value.length > 0) {
              debounce(() => {
                condition.value = [...new Set(relatedValues.value.flat())];
              }, 500)();
            }
          }, { immediate: true })
        }
      } else {
        const comparisonForm = computed(() => widget.getComparisonFormElement(condition.comparisonUid))

        if (comparisonForm.value) {
          watch(() => (comparisonForm.value as FormElement | undefined)?.inputValue, (value) => {
            condition.value = value;
          }, { immediate: true })
        }
      }
    }
  })
}

const syncWidgetSelectedRows = () => {
  if (isEmpty(selectedRows.value)) return;
  if (equals(widget.selectedRows, selectedRows.value)) return;

  widget.selectedRows = deepClone(selectedRows.value);
  widget.updateLastChangeTime();
}

const applySelectedRowsAfterRefresh = async (shouldTriggerFillRules = false) => {
  syncWidgetSelectedRows();

  if (!shouldTriggerFillRules || isEmpty(selectedRows.value)) return;

  await widget.onFillData(toRaw(selectedRows.value));
}

const refreshSelectData = async (shouldTriggerFillRules = false) => {
  const showRows = nocodeTableRef.value?.getShowRows();
  if (widget.isMultiple) {
    const rows = {}
    showRows.forEach(row => {
      if (isSelected(row)) {
        rows[row[widget.uuidKey]] = [row];
      }
    })
    if (Object.keys(selectedRows.value) && Object.keys(rows).length) {
      selectedRows.value = deepClone(rows);
    }
  } else {
    const row = showRows.find(row => isSelected(row));
    if (row) {
      selectedRows.value = {
        [row[widget.uuidKey]]: [deepClone(row)],
      };
    }
  }

  if (shouldTriggerFillRules && !isEmpty(selectedRows.value)) {
    selectedRows.value = await enrichSelectedRows();
  }

  await applySelectedRowsAfterRefresh(shouldTriggerFillRules);
}

const runtime = useRuntime();
const addsearchFormData = () => {
  if (runtime !== "form-viewer") {
    ElMessage({
      message: i18next.t("previewCannotAdd"),
      type: "warning",
    });
    return;
  }
  nocodeTableRef.value.showFormRowDialog("add");
};
</script>

<style lang="scss" scoped>
.mobile-select-data-dialog {
  --dialog-header-height: 40px;
  --dialog-footer-height: 0px;
  :deep(.el-dialog) {
    width: 100%;
    height: 100%;
    padding: 16px;
    padding-top: 24px;
    background-color: var(--color-white);
    display: flex;
    flex-direction: column;

    .el-dialog__header {
      padding-bottom: 0;
      .title {
        height: 44px;
        display: inline-flex;
        align-items: center;
        padding-right: 12px;
        gap: 8px;

        .back-button {
          color: var(--text-color-regular);
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

    .el-dialog__body {
      position: relative;
      padding: 0;
      margin-top: 8px;
      overflow: hidden;
      display: flex;
      max-height: calc(
        100% - var(--dialog-header-height) - var(--dialog-footer-height)
      );
      height: calc(
        100% - var(--dialog-header-height) - var(--dialog-footer-height)
      );

      .b2table {
        padding: 0;
        .table-header {
          height: 40px;
          display: flex;
          align-items: center;
        }
      }

      .add-data-btn {
        border-radius: 4px;
        position: absolute;
        top: 6px;
        left: 12px;
      }

      .content {
        width: 100%;
      }


    }

    .el-dialog__footer {
      padding: 16px 0;
      display: flex;
      gap: 8px;
      .el-button {
        flex: 1;
        height: 40px;
        border-radius: 4px;
        margin-left: 0;
        font-size: 14px;
        padding: 0 24px;
      }
    }
  }

  .pagination-cntainer {
    display: flex;
    align-items: center;
  }
}
</style>
