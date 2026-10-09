<template>
  <div class="single-search-form" :class="{'mobile': isMobile(), [showDataStyleClass]: true, 'compact': isCompact}" ref="rootRef">
    <!-- 段落样式 -->
    <div v-if="widget.showDataStyle === ShowDataStyle.PARAGRAPH" class="paragraph-view">
      <div class="single-search-form-item" v-for="item in formItems" :key="item.value">
        <div class="form-content" v-if="!item.children">
          <div class="form-item-label" :title="item.label">{{ item.label }}</div>
          <div class="form-item-content">
            <span v-if="widget.isEditable || !widget.searchData.value || isEmpty(widget.searchData.value[item.value])" class="empty">
              {{ !widget.searchData.value ? $t("noData") : $t("nullValue") }}
            </span>
            <table-cell-format
              v-else
              :key="getCellKey(item.value, widget.searchData.value)"
              :row="widget.searchData.value"
              :value="widget.searchData.value[item.value]"
              :params="getParams(widget.selectSearchFormFields.find(f => f.uid === item.value))"
              :widget="widget"
              style="max-height: initial !important;"
            ></table-cell-format>
          </div>
        </div>

        <div v-else class="subform-content">
          <div class="form-item-label" :title="item.label">{{ item.label }}</div>

          <!-- 子表表格 -->
          <div class="form-item-content"
            :class="{
              'empty': !getSubTableRows(item.value).length,
              'show-x-scroll': showTableXScrollMap[item.value]
            }"
          >
            <span v-if="!getSubTableRows(item.value).length" class="empty">{{ !widget.searchData.value ? $t("noData") : $t("nullValue") }}</span>
            <el-table
              v-else
              :data="getSubTableRows(item.value)"
              style="width: 100%"
              class="custom-sub-table"
              border
              align="left"
              header-align="left"
              :ref="(el) => setTableRef(el, item.value)"
              :header-cell-style="{ background: 'transparent', color: 'var(--text-color-regular)', fontWeight: '400' }"
              :row-style="{ background: '#fff' }"
            >
              <!-- 序号 -->
              <el-table-column type="index" align="center" width="50" :resizable="false"></el-table-column>
              <el-table-column
                v-for="subItem in item.children"
                :key="subItem.value"
                :label="subItem.label"
                min-width="120"
                :resizable="false"
                show-overflow-tooltip
              >
                <template #default="scope">
                  <table-cell-format
                    :key="getCellKey(subItem.value, scope.row, item.value)"
                    :row="scope.row"
                    :value="scope.row[subItem.value]"
                    :params="getParams(getSubTableFormFields(item.value).find(f => f.uid === subItem.value))"
                    :widget="widget"
                    style="max-height: initial !important;"
                  ></table-cell-format>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>

    <!-- 表格样式 -->
    <div v-else-if="widget.showDataStyle === ShowDataStyle.TABLE" class="table-view">
      <el-table
        v-if="widget.isEditable"
        class="custom-table"
        :data="[{prop:'table-empty'}]"
        empty-text=""
        row-key="prop"
        :tree-props="{children:'none', hasChildren:'none'}"
        style="width: 100%"
        :header-cell-style="{ backgroundColor: 'var(--bg-color-overlay)', color: 'var(--text-color-regular)' }"
        border
      >
        <template v-for="(item, index) in columnItems" :key="widget.uid">
          <el-table-column :label="item.label" :resizable="false" :align="'left'">
            <template v-if="!isEmpty(item.children)" #default="{ row, column }">
              <el-table-column v-for="child in item.children" :key="child.value" :label="child.label" :prop="row[child.value]" :resizable="false" :align="'left'"></el-table-column>
            </template>
            <template v-else #default="{ row, column }">
              {{ row[item.value] }}
            </template>
          </el-table-column>
        </template>
      </el-table>
      <nocode-permission-table
        v-else
        class="search-form-result-table"
        permissionMode="data"
        ref="nocodeTableRef"
        :preHiddenColumns="widget.hiddenFieldsUid"
        :nocodeId="widget.nocodeId"
        :tableUID="widget.selectSearchForm[1]"
        :curHiddenColumns="widget.hiddenFieldsUid"
        :singleSort="widget.fieldSortRule"
        :preFilterRule="widget.effectiveFormDataFilter"
        :isShowHeader="false"
        :isShowCheck="false"
        :isMultiple="false"
        :clickRowShowDetail="widget.allowEditRow"
        :isShowPagination="false"
        :prePageSize="1"
        :isShowFooter="false"
        :isShowAggregateRow="false"
        :isFilterEmptyValue="false"
        :rowHeightLevel="rowHeightLevel"
        :tableViewMeta="{}"
        :uid="`single-search-form-${widget.uid}`"
        @submitted="handleSubmitted"
      />
    </div>
  </div>
</template>

<script setup lang='ts'>
import { isSystemField } from '@common/utils/connection';
import { isMobile } from '@renderer/utils/pure';
import { unique } from '@common/utils/unique';
import { useWidget } from '@renderer/b2/types';
import { FormElement } from '@renderer/b2/controllers/form';
import { SearchForm } from './searchForm';
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, toRaw, watch, WatchStopHandle } from 'vue';
import { equals, isEmpty } from '@common/utils/object';
import { TableCellFormat } from "../_common/table";
import { Column, CurrentFieldWrapperOperator, SelectIdOfForm, ShowDataStyle } from './types';
import { FormTableRowHeight } from '@renderer/widgets/form/_common/type';
import i18next, { $t } from "@renderer/widgets/i18next";

type FormItem = {
  label: string,
  value: string,
  subType?: string,
  children?: FormItem[],
}

const getParams = (rowItem) => {
  const subType = rowItem?.meta?.subType || rowItem.subType;
  const extra = rowItem?.meta?.extra;
  const uid = rowItem?.uid;
  return { subType, extra, uid };
};

const normalizeCellKeyPart = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.join(',');
  }
  if (value === undefined || value === null || value === '') {
    return 'empty';
  }
  return String(value);
};

const getCellKey = (fieldUid: string, row?: Record<string, any>, parentUid = 'main') => {
  const rowKey = row?.[widget.uuidKey] ?? row?.id ?? row?.key ?? 'empty';
  const entityValue = row?.[`${fieldUid}_entity`];
  const rawValue = row?.[fieldUid];
  return [
    parentUid,
    fieldUid,
    normalizeCellKeyPart(rowKey),
    normalizeCellKeyPart(entityValue),
    normalizeCellKeyPart(rawValue)
  ].join(':');
};

const nocodeTableRef = ref();
const rowHeightLevel = computed<FormTableRowHeight>({
  get: () => {
    return nocodeTableRef.value?.getRowHeightLevel?.();
  },
  set: (value) => {
    nocodeTableRef.value?.setRowHeightLevel?.(value);
  }
});

const formItems = ref<FormItem[]>([]);
const widget: SearchForm = useWidget() as any;
const columnItems = ref<Column[]>([]);
const allUserList = ref([]);
const rootRef = ref<HTMLElement | null>(null);
const isCompact = ref(false);
let resizeObserver: ResizeObserver | null = null;
let isUnmounted = false;
let stopFormConfigWatch: WatchStopHandle | undefined;
let stopSearchDataWatch: WatchStopHandle | undefined;

const tableRefs = ref<Record<string, any>>({});
const showTableXScrollMap = ref<Record<string, boolean>>({});

const setTableRef = (el: any, uid: string) => {
  if (el) {
    tableRefs.value[uid] = el;
  } else {
    delete tableRefs.value[uid];
  }
};

const showDataStyleClass = computed(() => {
  return `search-form-${widget.showDataStyle}`
})

const initFormItems = () => {
  const cloumns = widget.selectSearchFormFieldsOptions;
  formItems.value = cloumns.map(f => {
    if (widget.showFields?.includes(f.value)) {
      return f
    } else if (!isEmpty(f.children)) {
      const selectedChildren = f.children.filter(sf => widget.showFields?.includes(sf.value))
      if (selectedChildren.length > 0) {
        return {
          label: f.label,
          value: f.value,
          subType: f.subType,
          children: selectedChildren
        }
      }
    }
  }).filter(f => f !== undefined)
}

const initColumns = () => {
  const cloumns = widget.selectSearchFormFieldsOptions;
  columnItems.value = cloumns.map(f => {
    if (widget.showFields?.includes(f.value)) {
      return f
    } else if (!isEmpty(f.children)) {
      const selectedChildren = f.children.filter(sf => widget.showFields?.includes(sf.value))
      if (selectedChildren.length > 0) {
        return {
          label: f.label,
          value: f.value,
          children: selectedChildren
        }
      }
    }
  }).filter(f => f !== undefined)
}

const getSelectedFormWidget = () => {
  const [connectionUID, tableUID] = widget.selectSearchForm;
  const connections = widget.getBoard().getConnections();
  const fromOption = connections[0].formOptions[tableUID]

  return fromOption.widget
}

const getSubTableFormFields = (subformUid: string) => {
  const [connectionUID, tableUID] = widget.selectSearchForm;
  const connections = widget.getBoard().getConnections();
  const connection = connections.find(c => c.uid === connectionUID);
  const subTable = connection.tables.find(t => {
    if (t.meta?.extra?.primaryTable) {
      return t.meta.extra.primaryTable[1] === tableUID
    }
  });

  return subTable.fields
}

// 获取子表数据行
const getSubTableRows = (subFormUid: string) => {
  if (widget.isEditable || !widget.searchData.value) return [];

  const subData = widget.subTableData[subFormUid];
  if (!subData || !subData.rows) return [];

  const subFieldConfig = widget.subFormTableFields.find(f => f.fieldUID === subFormUid);
  if (!subFieldConfig) return [];

  const relationKey = subFieldConfig.relationKey;
  const uuidKey = widget.uuidKey;
  const currentMainRowUUID = widget.searchData.value?.[uuidKey];
  return subData.rows.filter(row => row[relationKey] === currentMainRowUUID)
}

const updateTableScrollStatus = () => {
  Object.keys(tableRefs.value).forEach(uid => {
    requestAnimationFrame(() => {
      if (isUnmounted) return;
      const tableInstance = tableRefs.value[uid];
      if (!tableInstance) return;

      const thumb = tableInstance.$el.querySelector('.el-scrollbar__bar.is-horizontal .el-scrollbar__thumb');
      if (thumb) {
        showTableXScrollMap.value[uid] = window.getComputedStyle(thumb).width !== '0px';
      } else {
        showTableXScrollMap.value[uid] = false;
      }
    });
  });
}

const handleSubmitted = () => {
  widget.markFormulaDataChanged();
}

onMounted(async () => {
  allUserList.value = await widget.getBoard().getOrganizeUsers();
  if (isUnmounted) return;
  resizeObserver = new ResizeObserver(() => {
    if (isUnmounted) return;
    const width = rootRef.value?.clientWidth ?? 0;
    isCompact.value = width > 0 && width < 420;
    if (widget.showDataStyle === ShowDataStyle.PARAGRAPH) {
      updateTableScrollStatus();
    }
  });
  if (rootRef.value) {
    resizeObserver.observe(rootRef.value);
  }
  stopFormConfigWatch = watch(() => ({
    showFields: widget.showFields,
    showDataStyle: widget.showDataStyle
  }),(newVal, oldVal) => {
    if (widget.showDataStyle === ShowDataStyle.PARAGRAPH) {
      initFormItems();
    } else {
      initColumns();
    }
  }, { immediate: true });

  stopSearchDataWatch = watch(() => widget.searchData.value, () => {
    if (widget.showDataStyle === ShowDataStyle.PARAGRAPH) {
      nextTick(() => {
        if (isUnmounted) return;
        updateTableScrollStatus();
      });
    }
  }, { deep: true, immediate: true });

  if (widget.showDataStyle === ShowDataStyle.PARAGRAPH) {
    window.addEventListener('resize', updateTableScrollStatus);
  }
});

onBeforeUnmount(() => {
  isUnmounted = true;
  stopFormConfigWatch?.();
  stopFormConfigWatch = undefined;
  stopSearchDataWatch?.();
  stopSearchDataWatch = undefined;
});

onUnmounted(() => {
  window.removeEventListener('resize', updateTableScrollStatus);
  resizeObserver?.disconnect();
  resizeObserver = null;
})

</script>

<style lang="scss" scoped>
.single-search-form {
  width: 100%;
  // border: 1px solid var(--border-color);
  // border-radius: 4px;
  padding: 8px 0;
  color: var(--text-color-primary);
  background-color: var(--bg-color);
  position: relative;

  &.search-form-table {
    padding: 0;
    background-color: transparent;
    &::before {
      content: '';
      width: 100%;
      height: 100%;
      border: 1px solid var(--border-color);
      border-radius: 4px;
      box-sizing: border-box;
      position: absolute;
      top: 0;
      left: 0;
      background-color: var(--border-color);
    }
  }

  .table-view {
    width: 100%;

    :deep(.el-table.custom-table) {
      --el-table-border-color: var(--border-color);
      --el-table-row-hover-bg-color: transparent;
      --el-table-bg-color: transparent;
      --el-table-tr-bg-color: #fff;

      height: unset;
      max-height: 500px;
      border: var(--el-table-border);
      border-radius: 4px;

      .el-table__header {
        height: 36px;
      }
      .el-table__empty-block {
        display: none;
      }

      thead {
        th {
          font-weight: 100;
        }
      }

      .el-table__body-wrapper {
        .el-scrollbar__view {
          height: 100%;
        }
        .el-table__cell {
          padding: 15px 0;
        }
      }

      &::before, &::after,
      .el-table__inner-wrapper::before,
      .el-table__inner-wrapper::after,
      .el-table__border-left-patch,
      .el-table__border-right-patch {
        display: none;
      }

      .el-table__header {
        tr:first-of-type .el-table__cell:last-of-type {
          border-right: none;
        }
      }
      .el-table__row:last-of-type {
        .el-table__cell {
          border-bottom: none;
        }
        .el-table__cell:last-of-type {
          border-right: none;
        }
      }
    }

  }

  .single-search-form-item {
    width: 100%;
    .form-content, .subform-content {
      height: fit-content;
      min-height: 32px;
      font-size: 14px;
      line-height: 20px;
      padding: 6px 12px;
      display: flex;
      justify-content: flex-start;

      .form-item-label {
        width: 80px;
        color: var(--text-color-regular);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .form-item-content {
        max-width: calc(100% - 80px);
        height: fit-content;
        .empty {
          color: #A1A1A1;
        }
      }
    }

    .subform-content {
      width: 100%;

      :deep(.el-table) {
        --el-table-border-color: var(--border-color);
        --el-table-row-hover-bg-color: transparent;
        --el-table-bg-color: transparent;

        margin: 0;
        border-radius: 2px;
        overflow: hidden;

        .el-table__empty-block {
          display: none !important;
          height: 0 !important;
          min-height: 0 !important;
          padding: 0 !important;
        }

        .el-table__cell {
          padding: 8px 0;
        }

        &::before {
          display: none;
        }
      }

      .show-x-scroll {
        :deep(.el-table) {
          .el-scrollbar__bar.is-horizontal,
          .el-scrollbar__bar.is-vertical {
            display: block !important;
            overflow: visible;
            opacity: 1;
            height: 6px;
            position: relative;
            .el-scrollbar__thumb {
              bottom: -5px;
            }
          }
        }
      }

      > .empty {
        :deep(.el-table) {
          .el-table__body-wrapper {
            display: none !important;
          }
        }
      }
    }

  }

  &.compact {
    .single-search-form-item {
      .form-content,
      .subform-content {
        flex-direction: column;
        row-gap: 6px;

        .form-item-label {
          width: 100%;
        }

        .form-item-content {
          width: 100%;
          max-width: 100%;
        }
      }
    }
  }
}
</style>

