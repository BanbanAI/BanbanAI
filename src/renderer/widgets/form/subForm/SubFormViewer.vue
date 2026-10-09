<template>
  <div class="subform-empty" v-if="!subForm.children?.length && !subForm.isLoading">
    {{ $t('noAvailableFields') }}
  </div>
  <div class="subform-viewer" ref="subformViewerRef" v-else v-loading="subForm.isLoading" element-loading-custom-class="detail-loading-mask" :element-loading-text="i18next.t('loading')">
    <div class="table" :id="tableId">
      <div v-if="!subForm.isReadonly" class="table-editor">
        <div class="table-editor-left">
          <template v-if="!isBatchOperation">
            <el-button  class="btn-add-row" type="primary" link :icon="IEpPlus" @click="addRow()">{{ $t('add') }}</el-button>
            <el-button  class="btn-import" type="default" link :icon="IVenIconImportButton" @click="handleImport">{{ $t('import') }}</el-button>
            <el-button  class="btn-quick-fill" type="default" link @click="handleQuickFill">
              <el-icon :size="14" style="margin-right: 6px;"><IVenIconEdit style="fill: currentColor;" /></el-icon>
              {{ $t('quickFill') }}
            </el-button>
          </template>
          <template v-else>
            <el-button class="btn-hover-primary" :disabled="selectedRows && !selectedRows?.length" link @click="handleEdit()">{{ i18next.t('edit') }}</el-button>
            <el-button class="btn-hover-primary" :disabled="selectedRows && !selectedRows?.length" link @click="handleCopy(selectedRows)">{{ i18next.t('copy') }}</el-button>
            <el-button class="btn-hover-danger" :disabled="selectedRows && !selectedRows?.length" link @click="handleDelete">{{ i18next.t('delete') }}</el-button>
          </template>
        </div>
        <div class="table-editor-right">
          <el-button v-if="!isBatchOperation" type="primary" link @click="handleBatch(true)">{{ i18next.t('batchOperation') }}</el-button>
          <el-button v-else type="primary" link @click="handleBatch(false)">{{ i18next.t('exitBatchOperation') }}</el-button>
        </div>
      </div>
      <el-scrollbar style="width: 100%; border: 1px solid var(--border-color);" v-if="isUseTableV2">
        <el-auto-resizer>
          <template #default="{ height, width }">
            <el-table-v2
              ref="tableV2Ref"
              :row-height="lineHeight"
              :data="tableV2Data"
              :columns="columns"
              :width="computedWidth"
              :height="computedHeight"
              :row-key="tableV2RowKey"
              :key="columns.length"
            >
            <template #header-cell="scope">
              <div class="column-header">
                <span class="required" v-if="scope.column.isRequired">*</span>
                <span class="column-title" :title="scope.column.title">{{ scope.column.title }}</span>
                <span class="header-description-tooltip" v-if="scope.column.widget?.showDescription && scope.column.widget?.descriptionLayout === 'tooltip'">
                  <el-tooltip
                    :content="scope.column.widget?.descriptionContent" raw-content effect="light" :disabled="!scope.column.widget?.descriptionContent"
                    show-arrow placement="top" trigger="hover"
                    popper-class="header-description-tooltip-popper"
                  >
                    <el-icon size="14"><i-ven-icon-widget-form-sub-form-data-source-form-question/></el-icon>
                  </el-tooltip>
                </span>
              </div>
            </template>
            </el-table-v2>
          </template>
        </el-auto-resizer>
      </el-scrollbar>
      <el-table
        ref="tableRef"
        :class="{ editable: !subForm.isReadonly }"
        :data="subForm.tableData"
        empty-text=""
        row-key="uid"
        :tree-props="{children: 'none', hasChildren: 'none'}"
        @selection-change="handleSelectionChange"
        v-else
      >
        <el-table-column v-if="isBatchOperation" type="selection" width="80" :resizable="false" />
        <el-table-column v-else type="index" label=""  width="80" :resizable="false" >
          <template #default="scope">
            <div class="wrapper-row-editor">
              <span :class="['row-index', !subForm.isReadonly ? 'editable' : '']">{{ scope.$index + 1 }}</span>
              <div :class="['row-editor', !subForm.isReadonly ? 'editable' : '']">
                <el-button class="danger" link @click="subForm.deleteRow(scope.$index)">
                  <el-icon :size="14"><i-ep-delete /></el-icon>
                </el-button>
                <el-button link>
                  <el-icon :size="14" @click="rowEditDrawerRef?.show(scope.$index)"><i-ven-icon-widget-form-sub-form-open-form /></el-icon>
                </el-button>
                <el-dropdown trigger="click">
                  <el-button link>
                    <el-icon :size="14" :color="'var(--text-color-regular)'"><i-ven-icon-widget-form-sub-form-more /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="handleCopy([scope.row], scope.$index + 1)">{{ i18next.t('copyToNextRow') }}</el-dropdown-item>
                      <el-dropdown-item @click="handleCopy([scope.row], subForm.rows.length)">{{ i18next.t('copyToLastRow') }}</el-dropdown-item>
                      <el-dropdown-item @click="insertRow(scope.$index)">{{ i18next.t('insertRowAbove') }}</el-dropdown-item>
                      <el-dropdown-item @click="insertRow(scope.$index + 1)">{{ i18next.t('insertRowBelow') }}</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </div>
          </template>
        </el-table-column>
        <template v-for="(widget, index) in showColumns" :key="widget.uid">
          <el-table-column v-if="widget.isCreateField() || !subForm.isReadonly" :label="widget.title" :resizable="false" :align="'left'" :width="widget.widthInSubForm">
            <template #header>
              <div class="column-header">
                <span class="required" v-if="isColumnRequired(widget)">*</span>
                <span class="column-title" :title="widget.title">{{ widget.title }}</span>
                <span class="header-description-tooltip" v-if="widget.showDescription && widget.descriptionLayout === 'tooltip'">
                  <el-tooltip
                    :content="widget.descriptionContent" raw-content effect="light" :disabled="!widget.descriptionContent"
                    show-arrow placement="top" trigger="hover"
                    popper-class="header-description-tooltip-popper"
                  >
                    <el-icon size="14"><i-ven-icon-widget-form-sub-form-data-source-form-question/></el-icon>
                  </el-tooltip>
                </span>
              </div>
            </template>
            <template #default="{ row, column }">
              <template v-if="findWidget(row?.children, widget)">
                <x-widget
                  v-if="!subForm.isReadonly"
                  :widget="findWidget(row?.children, widget)"
                  :style="{padding: '0px'}"
                />
                <table-cell-format v-else @show-link-form="showLinkForm" :row="row.row" :value="findWidget(row?.children, widget)?.inputValue" :params="getParams(widget)" :widget="subForm as any"/>
              </template>
            </template>
          </el-table-column>
        </template>
      </el-table>
    </div>
    <div class="btn-list" v-if="!subForm.isReadonly">
      <el-button v-if="false" class="del-btn" type="danger" size="small" plain :icon="IEpDelete" @click="">批量删除</el-button>
    </div>
    <!-- 这里是为了让子组件mount，影响组件的isReady -->
    <b2-container v-show="false" :container="subForm.container"></b2-container>
    <sub-form-batch-edit-dialog v-model="editVisible" :subForm="subForm" :selectedRows="selectedRows"></sub-form-batch-edit-dialog>
    <sub-form-row-edit-drawer ref="rowEditDrawerRef" :subForm="subForm"  @copy-row="handleCopyByDrawer" @create-row="handleCreateByDrawer"></sub-form-row-edit-drawer>
    <teleport to="body">
      <data-view-dialog
        v-model="dataViewDialogVisible"
        v-bind="linkTableInfo"
        v-if="dataViewDialogVisible"
      />
    </teleport>
  </div>
</template>

<script lang="ts" setup>
import { SubForm, UUID } from './subForm';
import IEpPlus from "~icons/ep/plus";
import IEpDelete from "~icons/ep/delete";
import IVenIconOpenForm from "~icons/ven-icon/widget-form-sub-form-open-form";
import IVenIconMore from "~icons/ven-icon/widget-form-sub-form-more";
import IVenIconImportButton from "~icons/ven-icon/widget-form-sub-form-import-button";
import IVenIconEdit from "~icons/ven-icon/widget-form-sub-form-edit"
import { unique } from '@common/utils/unique';
import { FormElement } from '@renderer/b2/controllers/form';
import { TableCellFormat } from "../_common/table";
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch, provide, onBeforeUnmount } from 'vue';
import type { TableInstance } from 'element-plus'
import SubFormBatchEditDialog from './SubFormBatchEditDialog.vue';
import SubFormRowEditDrawer from './SubformRowEditDrawer.vue';
import { ElButton, ElIcon, ElDropdown, ElDropdownItem, ElDropdownMenu, ElCheckbox, ElMessage } from 'element-plus'
import { deepClone } from '@common/utils/object';
import { provideEnterPress } from './utils';
import i18next, { $t } from "@renderer/widgets/i18next";
import XWidget from "@renderer/b2/XWidget.vue";

const props = defineProps<{
  subForm: SubForm;
}>();

const emit = defineEmits(['importExcel', 'quickFill']);

const isBatchOperation = ref(false);
const tableRef = ref<TableInstance>();
const tableV2Ref = ref();
const selectedRows = ref<any[]>([]);
const editVisible = ref(false);
const rowEditDrawerRef = ref();
const subformViewerRef = ref();
let resizeObserver: ResizeObserver | null = null;
const handleSelectionChange = (rows: any[]) => {
  selectedRows.value = rows;
}

const enterNewlineInput = computed(() => props.subForm.enterNewlineInput);
const showColumns = computed(() => {
  return props.subForm.getTableVisibleChildren()
})

const findWidget = (widgets: FormElement[], sourceWidget: FormElement) => {
  if (!widgets) return null;
  return widgets.find(w => w['originId'] === sourceWidget?.uid);
}

const isColumnRequired = (widget: FormElement) => {
  return props.subForm.isColumnRequired(widget);
}

const getCopiedRowValue = (child: FormElement, row: Record<string, any>) => {
  const fieldId = child.fieldId;
  if (!fieldId) return undefined;
  if (child.type === 'widget.form.serialNumber') {
    return null;
  }
  return row[fieldId];
}

const isFormulaCalculatedField = (child: FormElement) => {
  const formulaChild = child as FormElement & {
    computeType?: string;
    formulaValue?: unknown;
    defaultType?: string;
    defaultFormulaValue?: unknown;
  };
  return (
    (formulaChild.computeType === 'formula' && !!formulaChild.formulaValue)
    || (formulaChild.defaultType === 'formula' && !!formulaChild.defaultFormulaValue)
  );
}

const resolveOriginalRowData = (row: any) => {
  if (typeof row === 'number') {
    return props.subForm.rows[row];
  }
  return props.subForm.rows.find(r => (r as any)[UUID] === row?.uid);
}

const handleCopy = async(rows: any[], index: number | undefined = undefined) => {
  const rowsToCopy = rows.map(row => {
    const originalRowData = resolveOriginalRowData(row);
    if (originalRowData) {
      const copiedRow = {};
      props.subForm.children.forEach((child) => {
        if (!child.fieldId || isFormulaCalculatedField(child)) return;
        copiedRow[child.fieldId] = getCopiedRowValue(child, originalRowData);
      });
      delete copiedRow[UUID];
      return copiedRow;
    }
    return {};
  });

  for (const row of rowsToCopy) {
    props.subForm.addRow(index, row, true);
    if (index !== undefined) index++;
  }
}

const handleImport = () => {
  emit('importExcel');
}

const handleQuickFill = () => {
  emit('quickFill');
}

const handleEdit = () => {
  editVisible.value = true;
}

const handleBatch = (bool: boolean) => {
  if (!bool) {
    clearBatchSelection();
  }

  isBatchOperation.value = bool;
}

const handleDelete = () => {
  if (!isUseTableV2) {
    const selectedIndices: number[] = [];
    selectedRows.value.forEach(row => {
      const index = props.subForm.tableData.indexOf(row);
      if (index !== -1) {
        selectedIndices.push(index);
      }
    });

    selectedIndices.sort((a, b) => b - a);
    selectedIndices.forEach(index => props.subForm.deleteRow(index));

    clearBatchSelection();
  } else {
    // selectedRows.value.forEach(index => props.subForm.deleteRow(index));
    props.subForm.deleteRows(selectedRows.value)
    clearBatchSelection();
  }
}

const clearBatchSelection = () => {
  selectedRows.value = [];
  tableRef.value?.clearSelection?.();
  tableV2Ref.value?.clearSelection?.();
}

const handleCopyByDrawer = (index: number) => {
  handleCopy([props.subForm.tableData[index]])
}

const handleCreateByDrawer = () => {
  props.subForm.addRow(undefined, {}, true);
}

const insertRow = (index: number) => {
  props.subForm.addRow(index, {}, true);
}

const getParams = (widget: FormElement)=>{
  const subType = widget.field?.meta?.subType;
  const extra = widget.field?.meta?.extra;
  const uid = widget.field?.uid;
  return { subType, extra, uid };
};

const tableV2RowKey = Symbol('tableV2RowKey');

const setTableV2RowKey = (row: any, visibleKey: string) => {
  Object.defineProperty(row, tableV2RowKey, {
    value: visibleKey,
    configurable: true,
    writable: true,
    enumerable: false,
  });
}

const tableV2Data = computed(() => {
  return props.subForm.tableData.map(row => {
    setTableV2RowKey(row, `${row.uid}:${props.subForm.getRowVisibilitySignature(row, showColumns.value)}`);
    return row;
  });
});

const handleResize = () => {
  nextTick(() => {
    // tableRef.value?.doLayout();
    fixScrollbar();
  });
};

const fixScrollbar = () => {
  const tableWrapper = tableRef.value?.$el;
  if (!tableWrapper) return;

  const scrollbar = tableWrapper.querySelector('.el-scrollbar__bar');
  const scrollbarWrap = tableWrapper.querySelector('.el-scrollbar__wrap');

  if (scrollbarWrap) {
    const scrollLeft = scrollbarWrap.scrollLeft;

    // 临时滚动一下触发更新
    scrollbarWrap.scrollLeft = scrollLeft + 1;
    scrollbarWrap.scrollLeft = scrollLeft;
  }
};

const tableWidth = ref(0);
const tableId = ref(unique())

let observer;

onMounted(async () => {
  await nextTick();

  const table = document.getElementById(tableId.value);
  if (!table) return;

  const updateWidth = () => {
    tableWidth.value = table.getBoundingClientRect().width;
  };

  updateWidth();

  observer = new ResizeObserver(updateWidth);
  observer.observe(table);
  const stop = watch(() =>subformViewerRef.value, () => {
    if (subformViewerRef.value) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(subformViewerRef.value);
    }
    stop()
  })
});

onBeforeUnmount(() => {
  observer?.disconnect();
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

const addRow = () => {
  props.subForm.addRow(undefined, {}, true);
  if(tableV2Ref.value) {
    tableV2Ref.value.scrollToRow(props.subForm.tableData.length - 1);
  }
}

const linkTableInfo = ref({});
const dataViewDialogVisible = ref(false);
const showLinkForm = async (tableId: string) => {
  const canView = await (props.subForm.topForm as any).canReadLayerData(tableId);
  if (!canView) {
    ElMessage.error(i18next.t('linkFormNoPermission'));
    return;
  }

  linkTableInfo.value = {
    nocodeId: props.subForm.getBoard().nocodeId,
    tableId,
  }
  dataViewDialogVisible.value = true;
}

// 回车处理
const handleEnterPress = async (currentUid: string) => {
  if (!enterNewlineInput.value) return;

  const tableData = props.subForm.tableData;
  if (!tableData) return;

  let currentRowIndex = -1;
  let columnIndex = -1;
  // 获取当前行/列
  for (let i = 0; i < tableData.length; i++) {
    const row = tableData[i];
    const found = row.children?.find((child: FormElement, index) => {
      if (child.uid === currentUid) {
        currentRowIndex = i;
        columnIndex = index;
        return true;
      };
    });
    if (found) break;
  }

  if (currentRowIndex === -1) return;

  let nextRowIndex = currentRowIndex + 1;

  // 新增一行
  if (nextRowIndex >= tableData.length) {
    await props.subForm.addRowAsync(undefined, {}, true);
    await nextTick();
    if(tableV2Ref.value) {
      tableV2Ref.value.scrollToRow(props.subForm.tableData.length - 1);
    }
  }

  // 检查行数
  if (nextRowIndex < props.subForm.tableData.length) {
    const nextRow = props.subForm.tableData[nextRowIndex];
    if (!nextRow || !nextRow.children) return;

    const targetWidget = nextRow.children[columnIndex];

    if (targetWidget && targetWidget.command) {
      await nextTick();
      targetWidget.command("focus");
      targetWidget.command("select");
    }
  }
};

provideEnterPress(handleEnterPress);

/**
 * ——————TableV2函数和方法——————
 */

const isUseTableV2 = true
const isScrolling = ref(false);
const scrollTimer = ref(null)

const handleWindowWheel = () => {
  isScrolling.value = true;
  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value);
  }
  scrollTimer.value = setTimeout(() => {
    isScrolling.value = false;
  }, 300);
};
window.addEventListener('wheel', handleWindowWheel);

onUnmounted(() => {
  window.removeEventListener('wheel', handleWindowWheel);
  if (scrollTimer.value) {
    clearTimeout(scrollTimer.value);
    scrollTimer.value = null;
  }
});

// 动态计算行高
const lineHeight = computed(() => {
  const hasTextarea = showColumns.value.some(w => w.type === 'widget.form.textarea');
  if (hasTextarea) {
    return 100;
  }
  return 50;
});

// 动态计算高度
const computedHeight = computed(() => {
  let height = Math.min(props.subForm.tableData.length * lineHeight.value + 50, 500)
  if (height === 100) height = 101;
  return height; // +50 用于header高度
})

// 动态计算宽度
const computedWidth = computed(() => {
  const childrenWidth = props.subForm.children.reduce(
    (acc, cur) => acc + (cur.widthInSubForm || 200),
    80
  );
  return Math.max(childrenWidth, tableWidth.value - 5);
});

// index操作列单元格渲染函数
const renderActionCell = ({ rowIndex, rowData }) => {
  if (isBatchOperation.value) {
    return h('div', { class: 'batch-checkbox-wrapper' }, [
      h(ElCheckbox, {
        modelValue: selectedRows.value.includes(rowIndex),
        onChange: (val) => {
          let rowData = deepClone(selectedRows.value)
          if (val) {
            rowData.push(rowIndex);
          } else {
            rowData = rowData.filter(index => index !== rowIndex);
          }
          handleSelectionChange(rowData);
        },
      }),
    ])
  }
  return h('div', { class: 'wrapper-row-editor' }, [
    h('span', { class: [isScrolling.value ? 'scroll-index' : 'row-index', !props.subForm.isReadonly ? 'editable' : ''] }, rowIndex + 1),
    h('div', { class: [isScrolling.value ? 'scroll-editor' : 'row-editor', !props.subForm.isReadonly ? 'editable' : ''] }, [
      h(
        ElButton,
        { class: 'danger', link: true, onClick: () => props.subForm.deleteRow(rowIndex) },
        { default: () => h(ElIcon, { size: 14 }, () => h(IEpDelete)) },
      ),
      h(
        ElButton,
        {
          link: true,
          onClick: () => rowEditDrawerRef?.value.show(rowIndex),
        },
        { default: () => h(ElIcon, { size: 14 }, () => h(IVenIconOpenForm)) },
      ),
      h(
        ElDropdown,
        { trigger: 'click' },
        {
          default: () =>
            h(
              ElButton,
              { link: true },
              { default: () => h(ElIcon, { size: 14 }, () => h(IVenIconMore)) },
            ),
          dropdown: () =>
            h(ElDropdownMenu, null, [
              h(ElDropdownItem, { onClick: () => handleCopy([rowData], rowIndex + 1) }, () => i18next.t('copyToNextRow')),
              h(ElDropdownItem, { onClick: () => handleCopy([rowData], props.subForm.rows.length) }, () => i18next.t('copyToLastRow')),
              h(ElDropdownItem, { onClick: () => insertRow(rowIndex) }, () => i18next.t('insertRowAbove')),
              h(ElDropdownItem, { onClick: () => insertRow(rowIndex + 1) }, () => i18next.t('insertRowBelow')),
            ]),
        },
      ),
    ]),
  ])
}

// 批量操作模式下的表头全选复选框渲染函数
const renderHeaderCell = ({ column }) => {
  if (isBatchOperation.value) {
    return h('div', { class: 'batch-checkbox-wrapper' }, [
      h(ElCheckbox, {
        modelValue: selectedRows.value.length === props.subForm.tableData.length,
        indeterminate: selectedRows.value.length > 0 && selectedRows.value.length < props.subForm.tableData.length,
        onChange: (val) => {
          if (val) {
            selectedRows.value = props.subForm.tableData.map((_, index) => index);
          } else {
            selectedRows.value = [];
          }
          handleSelectionChange(selectedRows.value);
        },
      }),
    ]);
  }
  return h('span', column.title);
};

// 动态生成列配置
const columns = computed(() => {
  return [
    // 操作列
    {
      key: 'index',
      title: '',
      width: 80,
      minWidth: 80,
      cellRenderer: renderActionCell,
      headerCellRenderer: renderHeaderCell,
    },
    // 动态列
    ...showColumns.value.map((widget) => ({
      key: widget.uid,
      dataKey: widget.uid,
      title: widget.title,
      widget: widget,
      isRequired: isColumnRequired(widget),
      width: widget.widthInSubForm || 200,
      minWidth: widget.widthInSubForm || 200,
      class: props.subForm.isReadonly ? 'readonly' : '',
      cellRenderer: ({ rowData }) => {
        const field = findWidget(rowData?.children, widget)
        if(!field) return ""
        const visibilitySignature = props.subForm.getRowChildVisibilitySignature(rowData, widget);
        const isChildShow = visibilitySignature === '1';
        if (!isChildShow) return "";
        if (!props.subForm.isReadonly) {
          // 编辑态
          return h(XWidget, {
            key: `${field.uid}:${visibilitySignature}`,
            widget: field,
            style: { padding: '0px' },
          })
        }
        // 只读态
        return h(TableCellFormat, {
          value: field?.inputValue,
          params: getParams(widget),
          widget: props.subForm,
          row: (props.subForm.topForm as any).getRow(),
          subRow: rowData.row,
          subFormRow: rowData,
          onShowLinkForm: (tableId: string) => {
            showLinkForm(tableId)
          }
        })
      },
    })),
  ]
})
</script>

<style lang="scss" scoped>
.subform-viewer {
  display: flex;
  width: 100%;
  flex-wrap: wrap;

  .column-header {
    display: flex;
    align-items: center;
    min-width: 0;
    width: 100%;

    .column-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .header-description-tooltip {
    display: inline-flex;
    align-items: center;
    margin-left: 5px;
    vertical-align: middle;
    color: var(--text-color-secondary);
    cursor: pointer;

    :deep(.el-icon) {
      vertical-align: middle;
    }
  }

  .table-editor {
    height: 36px;
    width: 100%;
    padding: 6px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid var(--border-color);
    border-bottom: 0;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;

    .table-editor-left {
      display: flex;
      gap: 8px;

      .btn-add-row {
        padding: 2px 8px 2px 2px;

        :deep(span) {
          margin-left: 4px;
        }
      }

      .el-button {
        cursor: var(--cursor-pointer);

        &.is-disabled {
          cursor: not-allowed;
        }

        &.btn-hover-primary:hover :deep(span) {
          color: var(--color-primary);
        }

        &.btn-hover-danger:hover :deep(span) {
          color: var(--color-danger);
        }
      }
    }

    .table-editor-right {
      display: flex;
      gap: 8px;

      .el-button {
        cursor: var(--cursor-pointer);
      }
    }
  }

  .table {
    display: flex;
    flex-direction: column;
    width: 100%;

    .wrapper-row-editor {
      position: relative;
      height: 100%;

      .row-index, .row-editor  {
        position: absolute;
        left: 50%;
        top:50%;
        transform: translate(-50%, -50%);
      }

      .row-index {
        opacity: 1;
        z-index: 1;

        &.editable {
          opacity: 1;
        }
      }

      .row-editor {
        display: flex;
        opacity: 0;
        z-index: 2;
        width: 100%;
        gap: 4px;

        :deep(.el-button) {
          margin-left: 0px;
          i {
            color: var(--text-color-regular);
            cursor: var(--cursor-pointer);
          }

          &:hover i {
            color: var(--color-primary);
          }

          &.danger:hover i {
            color: var(--color-danger);
          }
        }
      }
    }
  }
  :deep(.el-scrollbar) {
    .el-scrollbar__view {
      padding-bottom: 15px;
    }

    .el-scrollbar__bar {
      margin-bottom: 4px;
    }

    .el-scrollbar__thumb {
      height: 10px;
    }
  }

  .el-table-v2 {
    --el-table-header-text-color: #000;
    --el-table-header-bg-color: #F7F7FA;
    --el-table-tr-bg-color: #fff;
    --el-table-border-color: var(--el-border-color);

    width: unset;
    height: unset;
    max-height: 500px;
    // border: var(--el-table-border);
    // border-radius: 4px;
    overflow: hidden;
    background-color: var(--el-table-tr-bg-color);

    :deep(.el-table-v2__header) {
      background-color: var(--el-table-header-bg-color);
      color: var(--el-table-header-text-color);
      font-weight: 400;
      height: 36px;

      th {
        border-bottom: 1px solid var(--el-table-border-color);
        font-weight: 100;
      }
    }

    .el-table-v2__main {
      position: relative;
    }

    :deep(.el-table-v2__body) {
      border-bottom: 1px solid rgb(220, 223, 230);

      .el-virtual-scrollbar.el-vl__horizontal {
        display: none;
      }
    }

    :deep(.el-table-v2__empty) {
      display: none;
    }

    :deep(.el-table-v2__row) {
      background-color: var(--el-table-tr-bg-color);
      transition: background-color 0.2s ease;

      &:hover {
        background-color: #f9f9fb;

        .row-index.editable {
          display: none;
        }

        .row-editor.editable {
          /* display: block; */
          z-index: 1;
        }
      }

      .wrapper-row-editor {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
      }
      .row-index, .row-editor  {
        position: absolute;
        left: 50%;
        top:50%;
        transform: translate(-50%, -50%);
      }

      .row-index {
        /* width: 66px; */
        display: block;
        /* text-align: center; */

        &.editable {
          display: block;
        }
      }

      .row-editor {
        /* display: none; */
        display: flex;
        z-index: -1;

        button {
          margin-left: 0px;
        }
      }

      .scroll-index {
        width: 66px;
        display: block;
        text-align: center;

        &.editable {
          display: block;
        }
      }

      .scroll-editor {
        display: none;
      }

      .cell:has(.wrapper-row-editor) {
        height: 40px;
      }
    }

    :deep(.el-table-v2__cell) {
      border-right: var(--el-table-border);
      padding: 0px;

      &:last-of-type {
        border-right: none;
      }

      .cell {
        padding: 4px;

        .b2widget-body .rotate-layer .content-container .content .content-container {
          width: 100% !important;
        }
      }
    }

    :deep(.el-table-v2__row-cell) {
      border-right: 1px solid var(--border-color);

      &.readonly {
        flex: 1;
        flex-direction: column;
        justify-content: center;
        align-items: flex-start;
      }
      &:has(.validation-error) {
        background-color: var(--el-color-error-light-9);
      }
    }

    :deep(.el-table-v2__header-cell) {
      border-right: 1px solid var(--border-color);
    }

    .required {
      color: #eb5050;
      font-size: 14px;
      margin-right: 4px;
      font-family: "Segoe UI";
    }
    :deep(.el-table-v2__row:last-of-type) {
      .el-table-v2__cell {
        border-bottom: none;
      }
    }
    &.editable {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
  }

  .el-table {
    --el-table-header-text-color: #000;
    --el-table-header-bg-color: #F7F7FA;
    --el-table-tr-bg-color: #fff;
    --el-table-border-color: var(--el-border-color);

    width: unset;
    height: unset;
    max-height: 500px;
    border: var(--el-table-border);
    border-radius: 4px;

    :deep(.el-table__body) {
      border-bottom: 1px solid rgb(220, 223, 230);
    }

    :deep(.el-table__header) {
      height: 36px;
    }
    :deep(.el-table__empty-block) {
      display: none;
    }
    :deep(tr) {
      &:hover {
        .row-index.editable {
          opacity: 0;
        }

        .row-editor.editable {
          opacity: 1;
        }
      }

      .cell:has(.wrapper-row-editor) {
        height: 40px;
      }
    }

    .required{
      color: #eb5050;
      font-size: 14px;
      margin-right: 4px;
      font-family: "Segoe UI";
    }

    :deep(thead) {
      th {
        font-weight: 100;
      }
    }

    :deep(.el-table__inner-wrapper::before) {
      display: none;
    }
    :deep(.el-table__row:last-of-type) {
      .el-table__cell {
        border-bottom: none;
      }
    }
    :deep(.el-table__cell) {
      border-right: var(--el-table-border);
      &:last-of-type {
        border-right: none;
      }
      padding: 0px;
      .cell {
        padding: 4px;

        .b2widget-body .rotate-layer .content-container .content .content-container {
          width: 100% !important;
        }
      }
    }

    &.editable {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
  }

  .btn-list {
    margin-top: 6px;
    .el-button {
      border-radius: 2px;
    }
  }
}

.subform-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 360px;
  height: 92px;
  background-color: var(--bg-color-overlay);
  border-radius: 4px;
}
</style>
