<template>
  <div class="mobile-subform-viewer" ref="subformViewerRef"
    v-if="subForm.children?.length || subForm.isLoading"
    v-loading="subForm.isLoading"
    element-loading-custom-class="detail-loading-mask"
    :element-loading-text="i18next.t('loading')"
  >
    <div v-if="!subForm.isReadonly" class="table-editor">
      <div class="add-btn-wrapper" @click="subForm.addRow(undefined, {}, true)">
        <el-icon class="add-btn" :size="20"><CirclePlusFilled /></el-icon>
      </div>
    </div>

    <div class="collapse" :class="{'empty': !subForm.tableData?.length}">
      <div v-show="!subForm.tableData?.length" class="empty-show">
        <el-empty :image-size="64" :description="$t('noData')">
          <template #image>
            <i-ven-icon-widget-form-sub-form-empty-icon fill="#F5F6F7"></i-ven-icon-widget-form-sub-form-empty-icon>
          </template>
        </el-empty>
      </div>

      <el-collapse class="collapse-container" v-show="showColumns.length > 0" v-model="activeNames" @change="handleSelectionChange">
        <div class="collapse-item" v-for="(row, rowIndex) in subForm.tableData" :key="row.uid">
          <el-collapse-item :name="row.uid">
            <template #title="{ isActive }">
              <div :class="['title-wrapper', { 'is-active': isActive }]">
                {{ (rowIndex + 1).toString().padStart(2, '0') }}
                <el-icon class="header-icon">
                  <info-filled />
                </el-icon>
              </div>
            </template>

            <template #icon="{ isActive }">
              <span class="icon-ele">
                {{ isActive ? i18next.t('collapse') : i18next.t('expand') }}
                <el-icon><ArrowUp /></el-icon>
              </span>
            </template>

            <template #default>
              <template v-for="(widget, index) in showColumns" :key="widget.uid">
                <div class="widget"
                  v-if="widget.isCreateField() || !subForm.isReadonly"
                  :title="widget.title"
                  :width="widget.widthInSubForm"
                >
                  <div class="header-title">
                    <span class="header-required" v-if="isColumnRequired(widget) && !widget.isReadonly">*</span>
                    <div class="header-title-text" v-if="widget.showTitle" :title="widget.title">{{ widget.title }}</div>
                    <span class="header-description-tooltip" v-if="widget.showDescription && widget.descriptionLayout === 'tooltip'">
                      <el-tooltip
                        :content="widget.descriptionContent" raw-content effect="light" :disabled="!widget.descriptionContent"
                        show-arrow placement="top" trigger="click"
                        popper-class="header-description-tooltip-popper"
                      >
                        <el-icon size="14"><i-ven-icon-widget-form-sub-form-data-source-form-question/></el-icon>
                      </el-tooltip>
                    </span>
                  </div>

                  <x-widget
                    :widget="findWidget(row?.children, widget)"
                    :style="{ padding: '0px' }"
                  ></x-widget>
                  <!-- <div class="readonly-content" :class="{ [getWidgetClassName(widget)]: true}" v-else>
                    <table-cell-format
                      :value="findWidget(row?.children,
                      widget)?.inputValue"
                      :params="getParams(widget)"
                      :widget="subForm"
                    />
                  </div> -->
                </div>
              </template>
            </template>

          </el-collapse-item>
          <div class="subform-row-preview" @click.stop="rowPreviewClick(row, rowIndex)">
            <table-cell-format v-if="showColumns[0]" :row="row.row" :value="findWidget(row?.children, showColumns[0])?.inputValue" :params="getParams(showColumns[0])" :widget="subForm" @show-link-form="showLinkForm" />
            <span v-else class="empty">{{ i18next.t('noData') }}</span>
            <div class="widget-editor" v-if="!subForm.isReadonly" v-show="widgetEditorVisible && clickWidgetEditorIndex === rowIndex">
              <el-icon class="del-btn" :size="16" @click="subForm.deleteRow(rowIndex)"><i-ep-delete /></el-icon>
            </div>
          </div>
        </div>
      </el-collapse>
    </div>

    <el-button
      v-if="!subForm.isReadonly"
      class="bottom-add-button"
      type="primary"
      plain
      @click="subForm.addRow(undefined, {}, true)"
      >
      {{ $t('add') }}
    </el-button>
  
    <!-- 这里是为了让子组件mount，影响组件的isReady -->
    <b2-container v-show="false" :container="subForm.container"></b2-container>
  </div>
  <div class="subform-empty" v-else>
    <el-empty :image-size="64" :description="i18next.t('noAvailableFields')">
      <template #image>
        <i-ven-icon-widget-form-sub-form-empty-icon fill="#F5F6F7"></i-ven-icon-widget-form-sub-form-empty-icon>
      </template>
    </el-empty>
  </div>
</template>

<script lang="ts" setup>
import { SubForm } from './subForm';
import IEpPlus from "~icons/ep/plus";
import { FormElement } from '@renderer/b2/controllers/form';
import { TableCellFormat } from "../_common/table";
import { computed, ref, watch, provide, nextTick } from 'vue';
import { ArrowUp, CirclePlusFilled } from "@element-plus/icons-vue";
import IEpDelete from "~icons/ep/delete";
import IVenIconEmptyIcon from "~icons/ven-icon/widget-form-sub-form-empty-icon";
import IVenIconDataSourceFormQuestion from "~icons/ven-icon/widget-form-sub-form-data-source-form-question";
import { ElMessage } from 'element-plus';
import i18next, { $t } from "@renderer/widgets/i18next";

const props = defineProps<{
  subForm: SubForm;
}>();

const selectedRows = ref<any[]>([]);
const subformViewerRef = ref();
const clickWidgetEditorIndex = ref(null);
const widgetEditorVisible = ref(null);
const showColumns = computed(() => {
  return props.subForm.children.filter(item => !item.isHidden)
})

const activeNames = ref([]);
const isInitialized = ref(false);

const findWidget = (widgets: FormElement[], sourceWidget: FormElement) => {
  if (!widgets || !sourceWidget) return null;
  return widgets.find(w => w['originId'] === sourceWidget?.uid);
}

const isColumnRequired = (widget: FormElement) => {
  return props.subForm.isColumnRequired(widget);
}

const getParams = (widget: FormElement)=>{
  const subType = widget.field?.meta?.subType;
  const extra = widget.field?.meta?.extra;
  const uid = widget.field?.uid;
  return { subType, extra, uid };
};

const getWidgetClassName = (widget: FormElement) => {
  let widgetType = widget.field.meta?.extra?.widgetType || widget.type || 'TextInput';
  widgetType = widgetType.split('.').pop();
  return `widget-${widgetType}`;
}

const linkTableInfo = ref({});
const dataViewDialogVisible = ref(false);
const showLinkForm = async (tableId: string, filterPath: string) => {
  const canView = await props.subForm.topForm.canReadLayerData(tableId);
  if (!canView) {
    ElMessage.error(i18next.t('linkFormNoPermission'));
    return;
  }

  linkTableInfo.value = {
    nocodeId: props.subForm.getBoard().nocodeId,
    tableId,
    filterPath,
  }
  dataViewDialogVisible.value = true;
}


const handleSelectionChange = (rows: any[]) => {
  selectedRows.value = rows;
  widgetEditorVisible.value = false;
}

const rowPreviewClick = (row: any, index: number) => {
  const lastIndex = clickWidgetEditorIndex.value;
  clickWidgetEditorIndex.value = index;
  if (index === lastIndex) {
    widgetEditorVisible.value = !widgetEditorVisible.value;
    return;
  }
  widgetEditorVisible.value = true;
}

watch(() => !!props.subForm.tableData?.length, () => {
  if (!isInitialized.value && props.subForm.children?.length && props.subForm.tableData?.length) {
    activeNames.value = [props.subForm.tableData[0].uid];
    isInitialized.value = true;
  }
});

// 连续扫码

const scannerRegistry = new Map<string, () => Promise<void>>();

const registerScanner = (uid: string, handler: () => Promise<void>) => {
  scannerRegistry.set(uid, handler);
};

const unregisterScanner = (uid: string) => {
  scannerRegistry.delete(uid);
};

// 连续扫码的处理函数
const handleNextScanCode = async (currentWidgetUid: string) => {
  const tableData = props.subForm.tableData;
  if (!tableData) return;

  let currentRowIndex = -1;
  let columnIndex = -1;

  for (let i = 0; i < tableData.length; i++) {
    const row = tableData[i];
    const found = row.children?.find((child: FormElement, index) => {
      if (child.uid === currentWidgetUid) {
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
  }

  if (nextRowIndex < props.subForm.tableData.length) {
    const nextRow = props.subForm.tableData[nextRowIndex];

    // 展开下一行
    if (!activeNames.value.includes(nextRow.uid)) {
      activeNames.value = [nextRow.uid];
    }

    const targetWidget = nextRow.children?.[columnIndex];

    const handler = scannerRegistry.get(targetWidget.uid);
    if (targetWidget && handler) {
      handler();
    }
  }
};

// 提供给B2TextInput
provide('subform-scanner-registry', {
  registerScanner,
  unregisterScanner,
  onNextScanCode: handleNextScanCode
});

</script>

<style lang="scss" scoped>
.mobile-subform-viewer {
  width: 100%;
  position: relative;

  .collapse {
    display: flex;
    flex-direction: column;
    width: 100%;
    border-radius: 4px;
    border: 1px solid var(--border-color);
    overflow: hidden;
    &.empty {
      border: none;
    }
  }

  .empty-show {
    width: 100%;
    height: 128px;
    display: flex;
    justify-content: center;
    align-items: center;

    .el-empty {
      padding: 0;
      .el-empty__description {
        margin-top: 4px;
        font-size: 14px;
      }
    }
  }

  .table-editor {
    height: 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    top: -28px;
    box-sizing: border-box;
    right: 0;
    gap: 8px;

    .add-btn-wrapper {
      height: 100%;
      width: auto;
      aspect-ratio: 1 / 1;
      display: flex;
      align-items: center;
      justify-content: center;

      .add-btn {
        font-size: 20px;
        padding: 2px;
        color: var(--color-primary);
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
  }

  .bottom-add-button {
    width: 100%;
    height: 32px;
    margin-top: 8px;
    border-radius: 4px;
    cursor: var(--cursor-pointer);
  }

  :deep(.collapse-container) {
    border: none;

    .collapse-item:first-child {
      .el-collapse-item__header {
        border-top: none;
      }
    }
    .el-collapse-item__header {
      height: 32px;
      min-height: 0;
      background-color: var(--bg-color);
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
      padding: 0 12px;
      -webkit-tap-highlight-color: transparent;

      .icon-ele {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        .el-icon {
          transition: transform 0.3s;
          margin-top: -2px;
          transform-origin: center 60%;
        }
      }

      &.is-active {
        .icon-ele {
          color: var(--color-primary);
          .el-icon {
            transform: rotate(180deg);
          }
        }
      }

      .title-wrapper {
        font-size: 14px;
        color: var(--color-primary);
        letter-spacing: 1.5px;
      }
    }

    .collapse-item {
      .el-collapse-item__wrap {
        padding: 12px;
        border: none;
        .el-collapse-item__content {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 0;
        }
      }

      .widget {
        position: relative;

        .header-title {
          display: flex;
          align-items: center;
          min-width: 0;
          margin-bottom: 4px;

          .header-required {
            position: absolute;
            left: -6px;
            color: #eb5050;
            font-size: 14px;
            font-family: "Segoe UI";
          }

          .header-title-text {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 14px;
            color: var(--text-color-primary);
          }

          .header-description-tooltip {
            display: inline-flex;
            align-items: center;
            margin-left: 5px;
            color: var(--text-color-secondary);
            cursor: pointer;
          }
        }

        .readonly-content {
          min-height: 40px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          > div {
            width: 100%;
          }

          &.widget-richTextEditor {
            min-height: 120px;
            max-height: 320px;
            padding: 8px;
            overflow-y: auto;
            .cell-content-value {
              max-height: auto;
            }
          }
        }
      }

      .subform-row-preview {
        height: 40px;
        display: flex;
        align-items: center;
        padding-right: 28px;
        margin: 0 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: height 0.3s;
        opacity: 1;
        position: relative;

        > div {
          overflow-y: visible;
        }

        .widget-editor {
          height: 100%;
          display: flex;
          gap: 4px;
          position: absolute;
          right: -12px;

          .el-icon {
            width: auto;
            height: 100%;
            aspect-ratio: 1 / 1;
          }
          .del-btn {
            color: var(--color-danger);
          }
        }
      }

      .is-active + .subform-row-preview {
        height: 0;
        opacity: 0;
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

  .btn-list {
    margin-top: 6px;
    .el-button {
      border-radius: 2px;
    }
  }
}

.subform-empty {
  max-width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 360px;
  height: 128px;
  background-color: var(--bg-color-overlay);
  border-radius: 4px;

  :deep(.el-empty) {
    padding: 0;
    .el-empty__description {
      margin-top: 4px;
      font-size: 14px;
    }
  }
}
</style>

<style lang="scss">
.header-description-tooltip-popper {
  --el-bg-color-overlay: var(--bg-color);
  color: var(--text-color-regular);
  font-size: 14px;
  max-width: 80vw;
}
</style>
