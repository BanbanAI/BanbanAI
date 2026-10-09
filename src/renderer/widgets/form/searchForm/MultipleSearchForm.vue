<template>
  <div :class="['multiple-search-form', {'mobile': isMobileDevice}]">
    <div class="multiple-table-main" :class="{'mobile': isMobileDevice}">
      <el-button class="editable-show-add-btn" v-if="widget.isEditable && widget.allowAddNewRow" type="primary">
        <el-icon>
          <i-ep-plus></i-ep-plus>
        </el-icon>
        {{ $t("addData") }}
      </el-button>
      <div class="table-header" v-if="showTableHeaderActions">
        <template v-if="!isMobileDevice">
          <el-button text @click="handleOpenDialog" v-if="!isShowFullScreen">
            <el-icon color="#111111" :size="16">
              <i-ven-icon-widget-form-search-form-full-screen fill="#111111" />
            </el-icon>
          </el-button>
          <el-button text @click="handleCloseDialog" v-else>
            <el-icon color="#111111" :size="16">
              <i-ven-icon-widget-form-search-form-exit-fullscreen fill="#111111" />
            </el-icon>
          </el-button>
        </template>
      </div>
      <el-table
        v-if="widget.isEditable"
        :data="[{prop:'table-empty'}]"
        empty-text=""
        row-key="prop"
        :tree-props="{children:'none', hasChildren: 'none'}"
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
        :preHiddenColumns="widget.hiddenFieldsUid"
        ref="nocodeTableRef"
        :isAddDataAble="widget.allowAddNewRow"
        :preSortFields="widget.fieldSortRule"
        :addNewRowData="addNewRowData"
        :uid="`multiple-search-form-${widget.uid}`"
        :isImportDataAble="false"
        :isExportDataAble="false"
        :preFilterRule="widget.effectiveFormDataFilter"
        :changeRowHeightAble="false"
        :isShowMoreMenu="false"
        :hideColumnsAble="false"
        :nocodeId="widget.nocodeId"
        :tableUID="widget.selectSearchForm[1]"
        :isShowCheck="false"
        :clickRowShowDetail="widget.allowEditRow"
        :searchable="false"
        :filterable="false"
        :sortable="false"
        :isShowTableHeaderMenu="false"
        :isFilterEmptyValue="false"
        :isShowFooter="false"
        :isShowAggregateRow="false"
        :tableViewMeta="{}"
        @closeDialog="handleClosedAddDialog"
        @submitted="handleSubmitted"
      />
      <div class="search-form-pagination-wrap" v-if="showRowHeightControl">
        <template v-if="isMobileDevice">
          <div class="resize-button" :title="i18next.t('rowHeight')" @click="rowHeightDrawerVisible = true">
            <el-icon>
              <i-icon-park-outline-row-height />
            </el-icon>
          </div>
          <mobile-row-height-drawer @update:modelValue="rowHeightDrawerVisible = $event" @changeRowHeight="changeRowHeight" :rowHeightLevel="rowHeightLevel" :modelValue="rowHeightDrawerVisible" />
        </template>
        <el-dropdown v-else placement="bottom-start" popper-class="search-form-row-height-dropdown" :teleported="true" trigger="click" ref="rowHeightDropdownRef">
          <div class="resize-button" :title="i18next.t('rowHeight')">
            <el-icon>
              <i-icon-park-outline-row-height />
            </el-icon>
          </div>
          <template #dropdown>
            <ul class="menu">
              <li class="menu-item"
                @click="changeRowHeight(FormTableRowHeight.LARGE)"
                :class="{active: rowHeightLevel === FormTableRowHeight.LARGE}"
              >
                {{ i18next.t("rowHeightLarge") }}
              </li>
              <li class="menu-item"
                @click="changeRowHeight(FormTableRowHeight.MEDIUM)"
                :class="{active: rowHeightLevel === FormTableRowHeight.MEDIUM}"
              >
                {{ i18next.t("rowHeightMedium") }}
              </li>
              <li class="menu-item"
                @click="changeRowHeight(FormTableRowHeight.SMALL)"
                :class="{active: rowHeightLevel === FormTableRowHeight.SMALL}"
              >
                {{ i18next.t("rowHeightSmall") }}
              </li>
              <li class="menu-item"
                @click="changeRowHeight(FormTableRowHeight.AUTO)"
                :class="{active: rowHeightLevel === FormTableRowHeight.AUTO}"
              >
                {{ i18next.t("rowHeightAuto") }}
              </li>
            </ul>
          </template>
        </el-dropdown>
      </div>
    </div>
    <teleport to="body">
      <multiple-search-dialog v-model="isFullScreen"></multiple-search-dialog>
    </teleport>
  </div>
</template>

<script setup lang='ts'>
import { useRuntime } from '@renderer/utils/other';
import { isMobile } from '@renderer/utils/pure';
import { unique } from '@common/utils/unique';
import { useWidget } from '@renderer/b2/types';
import { SearchForm } from './searchForm';
import { computed, onBeforeUnmount, onMounted, ref, watch, WatchStopHandle } from 'vue';
import { isEmpty } from '@common/utils/object';
import IIconParkOutlineRowHeight from "~icons/icon-park-outline/row-height";
import IVenIconFullScreen from '~icons/ven-icon/widget-form-search-form-full-screen';
import IVenIconExitFullScreen from '~icons/ven-icon/widget-form-search-form-exit-fullscreen';
import { Column, FormTableRowHeight } from './types';
import IEpPlus from "~icons/ep/plus";
import MultipleSearchDialog from './MultipleSearchDialog.vue';
import MobileRowHeightDrawer from './MobileRowHeightDrawer.vue';
import { ElMessage } from 'element-plus';
import { useSearchFormStore } from './store';
import IVenIconEmptyIcon2 from "~icons/ven-icon/widget-form-search-form-empty-icon-2";
import { FormMode } from "../_common/type";
import { getCurrentRowData } from '../_common/utils';
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const props = withDefaults(defineProps<{
  isShowFullScreen?: boolean,
}>(), {
  isShowFullScreen: false,
})

const emit = defineEmits<{ ( event: "closeFullscreenDialog"): void }>();
const widget: SearchForm = useWidget() as any;
const columnItems = ref<Column[]>([]);
const pageNumber = ref(1);
const pageSize = ref(10);
const total = ref(0);
const searchDatas = computed(() => widget.showRows)
const searchFormStore = useSearchFormStore();
const isShowAdd = ref(false);
const rowHeightDropdownRef = ref();
const rowHeightLevel = computed<FormTableRowHeight>({
  get: () => {
    return nocodeTableRef.value?.getRowHeightLevel?.();
  },
  set: (value) => {
    nocodeTableRef.value?.setRowHeightLevel?.(value);
  }
});
const nocodeTableRef = ref();
const isFullScreen = ref(false);
const rowHeightDrawerVisible = ref(false);
let isUnmounted = false;
let stopShowFieldsWatch: WatchStopHandle | undefined;
const hasSelectedFormViewPermission = computed(() => {
  return widget.hasSelectedFormViewPermission;
});
const showTableHeaderActions = computed(() => {
  return !widget.isEditable && hasSelectedFormViewPermission.value;
});
const showRowHeightControl = computed(() => {
  return !widget.isEditable && hasSelectedFormViewPermission.value;
});

if (!searchFormStore[widget.uid]) {
  isShowAdd.value = true;
}

const initColumns = () => {
  const showFields = widget.showFields;
  const cloumns = widget.selectSearchFormFieldsOptions;
  columnItems.value = cloumns.map(f => {
    if (showFields?.includes(f.value)) {
      return f
    } else if (!isEmpty(f.children)) {
      const selectedChildren = f.children.filter(sf => showFields?.includes(sf.value))
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

const getData = async () => {
  if (isUnmounted) return;
  const res = await widget.getRows({
    pageSize: pageSize.value,
    pageNumber: pageNumber.value,
  });
  if (isUnmounted) return;
  total.value = res.count;
}

const handleSubmitted = () => {
  widget.markFormulaDataChanged();
}
const handleClosedAddDialog = () => {
  searchFormStore.close(widget.uid);
}

const runtime = useRuntime();
const isSharePage = ref(false)
onMounted(async () => {
  if (!widget.isEditable) {
    await getData();
    if (isUnmounted) return;
    isSharePage.value = window.location.href.includes('share')
  }

  if (isUnmounted) return;
  stopShowFieldsWatch = watch(() => widget.showFields, () => {
    initColumns();
  }, { immediate: true });
})

onBeforeUnmount(() => {
  isUnmounted = true;
  stopShowFieldsWatch?.();
  stopShowFieldsWatch = undefined;
});

const addNewRowData = computed(() => {
  if (isEmpty(widget.addCurrentRowToLinkageForm)) return null;
  return getCurrentRowData(widget.topForm.allFormInputs, widget.addCurrentRowToLinkageForm);
})

const changeRowHeight = (type: FormTableRowHeight) => {
  rowHeightLevel.value = type;
  rowHeightDropdownRef.value?.handleClose();
}

const handleOpenDialog = ()  => {
  isFullScreen.value = true;
}

const handleCloseDialog = () => {
  isFullScreen.value = false;
  emit("closeFullscreenDialog");
}
</script>

<style lang="scss" scoped>
.multiple-search-form {
  width: 100%;
  background-color: #fff;
  display: flex;
  flex-wrap: wrap;
  position: relative;

  .multiple-table-main {
    width: 100%;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    height: fit-content;
    position: relative;
    padding: 6px 8px;
    :deep(.editable-show-add-btn) {
      height: 32px;
      position: absolute;
      display: flex;
      align-items: center;
      left: 8px;
      top: 6px;
      border-radius: 4px;
      z-index: 10000;
    }
    .table-header {
      width: 100%;
      height: 32px;
      display: flex;
      justify-content: end;
      align-items: center;
      position: absolute;
      top: 6px;
      left: 0;
      padding: 0 8px;
      pointer-events: none;
      :deep(.el-button) {
        width: 32px;
        height: 32px;
        border-radius: 4px;
        z-index: 10000;
        background-color: #fff;
        padding: 0;
        pointer-events: auto;
        &:hover {
          background-color: var(--bg-color-overlay);
        }
      }
    }

    .el-table {
      margin-top: 36px;
    }

    .table {
      display: flex;
      width: 100%;
    }

  }

  .search-form-pagination-wrap {
    width: 32px;
    position: absolute;
    bottom: 8px;
    left: 8px;
    z-index: 10000;

    .resize-button {
      width: 32px;
      height: 32px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: var(--text-color-regular);

      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }
  }

  :deep(.el-table) {
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

  .multiple-table-main.mobile {
    border: none;
    .table-header {
      height: auto;
    }
    .search-form-pagination-wrap {
      width: 32px;
      position: absolute;
      bottom: 4px;
      left: 8px;
    }
  }
}
</style>

<style lang="scss">
.el-popper.search-form-row-height-dropdown {
  z-index: 10000 !important;

  .menu {
    padding: 2px;
    border-radius: 8px;
    background-color: var(--color-white);
    display: flex;
    flex-direction: column;

    .menu-item {
      transition: all 0.3s ease;
      width: 96px;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 8px 12px;
      font-family: Noto Sans SC;
      font-weight: 400;
      font-style: Regular;
      font-size: 14px;

      .el-icon {
        margin-right: 8px;
      }

      &:hover {
        background-color: var(--bg-color-overlay);
        color: unset;
      }

      &.active {
        background-color: var(--color-primary-light-9);
        color: var(--color-primary);
      }
    }
  }
}
</style>
