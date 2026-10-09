<template>
  <nocode-virtual-table
    ref="virtualTableRef"
    :active="active"
    :widget="widget"
    :displayColumns="displayColumns"
    :rowHeightLevel="rowHeightLevel"
    :bodyHeightMode="bodyHeightMode"
    :loading="loading"
    :isMobileDevice="isMobileDevice"
    :isShowCheck="isShowCheck"
    :showIndexColumn="showIndexColumn"
    :showSelectionSequence="showSelectionSequence"
    :isMultiple="isMultiple"
    :isCellEdit="isCellEdit"
    :showTableActionPanel="showTableActionPanel"
    :tableActionColumnWidth="tableActionColumnWidth"
    :tableWidthData="tableWidthData"
    :getRecordActionItems="getRecordActionItems"
    :clickRowShowDetail="clickRowShowDetail"
    :rowDetailTrigger="rowDetailTrigger"
    :clickRowChecked="clickRowChecked"
    :showAggregateFooter="showAggregateFooter"
    :openedRowKey="openedRowKey"
    :sortable="sortable"
    :hideColumnsAble="hideColumnsAble"
    :updateColumnDataAble="updateColumnDataAble"
    :isShowTableHeaderMenu="isShowTableHeaderMenu"
    :headerMenuMode="headerMenuMode"
    :enableHeaderFilterPanel="enableHeaderFilterPanel"
    :sortFieldsMap="sortFieldsMap"
    :filterConditions="filterConditions"
    :canUpdateColumnData="canUpdateColumnData"
    :locale="locale"
    :headerFilterInfo="headerFilterInfo"
    :isHeaderFilterValueNotEmpty="isHeaderFilterValueNotEmpty"
    :getHeaderFilterMenus="getHeaderFilterMenus"
    :getHeaderFilterInstance="getHeaderFilterInstance"
    :getHeaderFilterValueType="getHeaderFilterValueType"
    :shouldShowHeaderFilterValue="shouldShowHeaderFilterValue"
    :fixedColumnCount="fixedColumnCount"
    :enableShareLinkColumn="enableShareLinkColumn"
    :showShareLinkColumn="showShareLinkColumn"
    :canCopyInternalRowShare="canCopyInternalRowShare"
    :canCopyPublicRowShare="canCopyPublicRowShare"
    :copyInternalRowShareLink="copyInternalRowShareLink"
    :copyPublicRowShareLink="copyPublicRowShareLink"
    @show-related-form="emit('show-related-form', $event)"
    @show-link-form="emit('show-link-form', $event)"
    @show-related-sub-form="emit('show-related-sub-form', $event)"
    @update-cell-edit="emit('update-cell-edit', $event)"
    @execute-view-action="emit('execute-view-action', $event)"
    @cell-click="emit('cell-click', $event)"
    @row-activate="emit('row-activate', $event)"
    @header-action="emit('header-action', $event)"
    @column-width-change="emit('column-width-change', $event)"
    @header-filter-menu-open="emit('header-filter-menu-open', $event)"
    @header-filter-menu-close="emit('header-filter-menu-close', $event)"
    @header-filter-clear="emit('header-filter-clear')"
    @toggle-checkbox-row="emit('toggle-checkbox-row', $event)"
    @toggle-check-all="emit('toggle-check-all', $event)"
  />
</template>

<script setup lang="ts">
import { PropType, ref } from "vue";
import { FormCondition, RuleFunc, RuleFuncValue } from "@common/types/nocode";
import { FormTableRowHeight, ViewActionPlacement } from "@common/types/nocode";
import { OptionTableUID, Row } from "@common/types/project";
import { Column, Table } from "./table";
import NocodeVirtualTable from "./NocodeVirtualTable.vue";
import { VirtualTableBodyHeightMode } from "@renderer/components/virtual-table";
import { NocodeHeaderMenuMode } from "@renderer/components/virtual-table/nocode-header-contract";

defineProps({
  active: {
    type: Boolean,
    default: true,
  },
  widget: {
    type: Object as PropType<Table>,
    required: true,
  },
  displayColumns: {
    type: Array as PropType<Column[]>,
    default: () => [],
  },
  rowHeightLevel: {
    type: String as PropType<FormTableRowHeight>,
    default: FormTableRowHeight.SMALL,
  },
  bodyHeightMode: {
    type: String as PropType<VirtualTableBodyHeightMode>,
    default: "fill",
  },
  loading: {
    type: Boolean,
    default: false,
  },
  isMobileDevice: {
    type: Boolean,
    default: false,
  },
  isShowCheck: {
    type: Boolean,
    default: false,
  },
  showIndexColumn: {
    type: Boolean,
    default: false,
  },
  showSelectionSequence: {
    type: Boolean,
    default: true,
  },
  isMultiple: {
    type: Boolean,
    default: true,
  },
  isCellEdit: {
    type: Boolean,
    default: false,
  },
  showTableActionPanel: {
    type: Boolean,
    default: false,
  },
  tableActionColumnWidth: {
    type: Number,
    default: 180,
  },
  tableWidthData: {
    type: Object as PropType<Record<string, number>>,
    default: () => ({}),
  },
  getRecordActionItems: {
    type: Function as PropType<(placement: ViewActionPlacement, row?: Row) => any[]>,
    default: () => [],
  },
  clickRowShowDetail: {
    type: Boolean,
    default: true,
  },
  rowDetailTrigger: {
    type: String as PropType<"click" | "dblclick">,
    default: "click",
  },
  clickRowChecked: {
    type: Boolean,
    default: false,
  },
  showAggregateFooter: {
    type: Boolean,
    default: false,
  },
  openedRowKey: {
    type: [String, Number] as PropType<string | number | null>,
    default: null,
  },
  sortable: {
    type: Boolean,
    default: true,
  },
  hideColumnsAble: {
    type: Boolean,
    default: true,
  },
  updateColumnDataAble: {
    type: Boolean,
    default: false,
  },
  isShowTableHeaderMenu: {
    type: Boolean,
    default: true,
  },
  headerMenuMode: {
    type: String as PropType<NocodeHeaderMenuMode>,
    default: "full",
  },
  enableHeaderFilterPanel: {
    type: Boolean,
    default: true,
  },
  sortFieldsMap: {
    type: Object as PropType<Record<string, number | undefined>>,
    default: () => ({}),
  },
  filterConditions: {
    type: Array as PropType<Array<{ uid?: string | null; value?: any }>>,
    default: () => [],
  },
  canUpdateColumnData: {
    type: Function as PropType<(column: Column) => boolean>,
    default: () => false,
  },
  locale: {
    type: Object as PropType<any>,
    default: undefined,
  },
  headerFilterInfo: {
    type: Object as PropType<FormCondition>,
    default: () => ({
      uid: null,
      func: RuleFunc.EQUAL,
      value: "",
    }),
  },
  isHeaderFilterValueNotEmpty: {
    type: Boolean,
    default: false,
  },
  getHeaderFilterMenus: {
    type: Function as PropType<(column: Column, parentColumn?: Column) => Array<{ title: string; click: () => void }>>,
    default: () => [],
  },
  getHeaderFilterInstance: {
    type: Function as PropType<(column: Column, parentColumn?: Column) => any>,
    default: () => undefined,
  },
  getHeaderFilterValueType: {
    type: Function as PropType<(func: RuleFunc, column: Column, parentColumn?: Column) => RuleFuncValue>,
    default: () => undefined,
  },
  shouldShowHeaderFilterValue: {
    type: Function as PropType<(condition: FormCondition) => boolean>,
    default: () => false,
  },
  fixedColumnCount: {
    type: Number as PropType<0 | 1 | 2 | 3 | 4>,
    default: 0,
  },
  enableShareLinkColumn: {
    type: Boolean,
    default: false,
  },
  showShareLinkColumn: {
    type: Boolean,
    default: false,
  },
  canCopyInternalRowShare: {
    type: Boolean,
    default: false,
  },
  canCopyPublicRowShare: {
    type: Boolean,
    default: false,
  },
  copyInternalRowShareLink: {
    type: Function as PropType<(row: Row) => void | Promise<void>>,
    default: undefined,
  },
  copyPublicRowShareLink: {
    type: Function as PropType<(row: Row) => void | Promise<void>>,
    default: undefined,
  },
});

const emit = defineEmits<{
  (event: "show-related-form", payload: { relatedTableUID: OptionTableUID; uuid: string; row?: Row; fieldUID?: string }): void;
  (event: "show-link-form", payload: { tableId: string; filterPath: string; nocodeId?: string }): void;
  (event: "show-related-sub-form", payload: { row: Row; value: any }): void;
  (event: "update-cell-edit", value: boolean): void;
  (event: "execute-view-action", payload: { payload: any; row: Row }): void;
  (event: "cell-click", payload: any): void;
  (event: "row-activate", payload: any): void;
  (event: "header-action", payload: any): void;
  (event: "column-width-change", payload: any): void;
  (event: "header-filter-menu-open", payload: any): void;
  (event: "header-filter-menu-close", payload: any): void;
  (event: "header-filter-clear"): void;
  (event: "toggle-checkbox-row", row: Row): void;
  (event: "toggle-check-all", payload: any): void;
}>();

const virtualTableRef = ref<InstanceType<typeof NocodeVirtualTable> | null>(null);

defineExpose({
  getInnerTable: () => virtualTableRef.value?.getInnerTable?.() || null,
  getOuterTable: () => virtualTableRef.value,
});
</script>
