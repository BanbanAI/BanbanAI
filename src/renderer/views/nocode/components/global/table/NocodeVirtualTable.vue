<template>
  <virtual-table
    ref="virtualTableRef"
    class="nocode-virtual-table"
    :style="virtualTableStyle"
    :columns="virtualColumns"
    :rows="rows"
    :row-key="getVirtualRowKey"
    :loading="loading"
    :estimated-row-height="estimatedRowHeight"
    :min-row-height="minRowHeight"
    :cell-vertical-align="cellVerticalAlign"
    :body-height-mode="bodyHeightMode"
    :row-class-name="getRowClassName"
    :show-footer="showAggregateFooter"
    :enable-column-resize="true"
    :get-cell-span="getCellSpan"
    :get-row-span-boundary="getRowSpanBoundary"
    :editable="props.active"
    edit-trigger="manual"
    :editor-registry="nocodeEditing.editorRegistry"
    :resolve-cell-editor="nocodeEditing.resolveCellEditor"
    :commit-cell-edit="nocodeEditing.commitCellEdit"
    :should-ignore-edit-outside-click="nocodeEditing.shouldIgnoreEditOutsideClick"
    @cell-click="handleCellClick"
    @cell-dblclick="handleCellDblClick"
    @cell-edit-start="emit('update-cell-edit', true)"
    @cell-edit-commit="emit('update-cell-edit', false)"
    @cell-edit-cancel="emit('update-cell-edit', false)"
    @column-width-change="handleColumnWidthChange"
  >
    <template #header-cell="{ column, isLeaf }">
      <button
        v-if="column.meta?.kind === 'selection' && isMultiple"
        class="selection-button selection-button--header"
        type="button"
        @click.stop="toggleAllSelection"
      >
        <span
          class="selection-button__box"
          :class="{
            checked: checkAllState.checked,
            indeterminate: checkAllState.indeterminate,
          }"
        >
          <span v-if="checkAllState.indeterminate" class="selection-button__indeterminate"></span>
          <template v-else-if="checkAllState.checked">✓</template>
        </span>
      </button>
      <nocode-virtual-header-cell
        v-else-if="resolveHeaderDescriptor(column, isLeaf)"
        :descriptor="resolveHeaderDescriptor(column, isLeaf)"
        :show-menu="showHeaderMenu(column, isLeaf)"
        :single-line="shouldUseSingleLineHeaderTitle(column, isLeaf)"
        @action="handleHeaderAction($event, column)"
        @menu-open="handleHeaderMenuOpen(column, isLeaf)"
        @menu-close="handleHeaderMenuClose(column, isLeaf)"
      >
        <template #menu-extra>
          <div class="filter" v-if="shouldShowHeaderFilterPanel(column, isLeaf)">
            <div class="filter-content">
              <div class="filter-func">
                <div class="filter-left">
                  <el-icon :size="16"><i-table-filter></i-table-filter></el-icon>
                  <span>{{ $t('NocodeTable.filter') }}</span>
                </div>
                <el-dropdown class="filter-right" trigger="click" :persistent="false" popper-class="table-filter-dropdown-popper" :teleported="false">
                  <span class="el-dropdown-link">
                    {{ RuleFuncTextMapping[headerFilterInfo.func] }}
                    <el-icon class="el-icon--right">
                      <i-table-drop-down />
                    </el-icon>
                  </span>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="menu in resolveHeaderFilterMenus(column, isLeaf)"
                        :key="menu.title"
                        @click="menu.click"
                      >
                        {{ menu.title }}
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <el-button link type="danger" @click="emit('header-filter-clear')" v-if="isHeaderFilterValueNotEmpty">
                {{ $t('NocodeTable.clear') }}
              </el-button>
            </div>
            <div class="filter-wrap">
              <el-config-provider :locale="locale">
                <filter-value-format
                  v-if="shouldShowHeaderFilterValue(headerFilterInfo)"
                  v-model="headerFilterInfo.value"
                  class="filter-input"
                  :teleported="false"
                  :element="resolveHeaderFilterInstance(column, isLeaf)"
                  :fieldId="resolveHeaderFilterFieldId(column, isLeaf)"
                  :type="resolveHeaderFilterValueType(column, isLeaf)"
                  style="flex: 1"
                  :placeholder="$t('NocodeTable.input')"
                />
              </el-config-provider>
            </div>
          </div>
        </template>
      </nocode-virtual-header-cell>
      <span v-else>{{ column.title }}</span>
    </template>

    <template #footer-cell="{ column }">
      <table-footer-cell
        v-if="showAggregateFooter && column.meta?.kind === 'data'"
        :widget="widget"
        :params="column.meta?.sourceColumn"
        :subTableUID="resolveFooterSubTableUID(column)"
      />
    </template>

    <template #cell="{ row, column, rowIndex, editable, isEditing, startEdit }">
      <template v-if="column.meta?.kind === 'selection'">
        <button
          :class="[
            'selection-button',
            'selection-button--body',
            {
              'selection-button--indexed': !props.showIndexColumn,
              'selection-button--sequence': shouldShowSelectionSequence(row),
            },
          ]"
          type="button"
          @click.stop="commitSelection(row, column)"
        >
          <span
            :class="[
              'selection-button__content',
              { 'selection-button__content--indexed': !props.showIndexColumn },
            ]"
          >
            <template v-if="isMultiple && shouldShowSelectionSequence(row)">
              <span class="selection-button__sequence-toggle">
                <span class="selection-button__box selection-button__box--hover" aria-hidden="true"></span>
                <span class="selection-button__box selection-button__box--sequence is-sequence">
                  {{ getRowSequence(row, rowIndex) }}
                </span>
              </span>
            </template>
            <span
              v-else
              class="selection-button__box"
              :class="{
                checked: isRowChecked(row),
                'is-radio': !isMultiple,
                'is-sequence': shouldShowSelectionSequence(row),
              }"
            >
              <template v-if="isMultiple">
                {{ isRowChecked(row) ? "✓" : (shouldShowSelectionSequence(row) ? getRowSequence(row, rowIndex) : "") }}
              </template>
              <template v-else>
                <span class="selection-button__radio-dot"></span>
              </template>
            </span>
          </span>
        </button>
      </template>

      <template v-else-if="column.meta?.kind === 'index'">
        <span class="row-order-index-wrap">
          <span class="row-order-index">{{ getRowSequence(row, rowIndex) }}</span>
        </span>
      </template>

      <template v-else-if="column.meta?.kind === 'action'">
        <div class="row-action-wrap">
          <view-action-button-group
            :items="getActionItems(row)"
            :maxVisible="3"
            :buttonWidth="76"
            :overflowTakesSlot="true"
            size="small"
            @execute="emit('execute-view-action', { payload: $event, row })"
          />
        </div>
      </template>

      <template v-else-if="column.meta?.kind === 'share-link'">
        <div class="share-link-wrap">
          <el-dropdown
            placement="bottom"
            trigger="click"
            :persistent="false"
            teleported
            popper-class="share-link-menu-popper"
          >
            <el-button
              class="icon-btn"
              link
              :title="$t('NocodeTable.shareUrl')"
              @click.stop
            >
              <el-icon><i-ven-copy-link /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu class="share-link-menu" @click.stop>
                <el-dropdown-item
                  v-if="props.canCopyInternalRowShare"
                  class="share-link-menu__item-wrap"
                  @click.stop="void props.copyInternalRowShareLink?.(row as Row)"
                >
                  {{ $t('NocodeTable.internalShareLink') }}
                </el-dropdown-item>
                <el-dropdown-item
                  v-if="props.canCopyPublicRowShare"
                  class="share-link-menu__item-wrap"
                  @click.stop="void props.copyPublicRowShareLink?.(row as Row)"
                >
                  {{ $t('NocodeTable.publicShareLink') }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </template>

      <table-cell-format
        v-else
        :value="row[column.dataIndex || column.key]"
        :params="column.meta?.sourceColumn"
        :widget="widget"
        :row="row"
        :rowHeightLevel="rowHeightLevel"
        :cellVerticalAlign="cellVerticalAlign"
        :isMergedAnchorCell="isMergedAnchorCell(row, rowIndex, column)"
        :isEditAble="shouldShowCellEditTrigger(row, column, editable, isEditing)"
        :isPreparingEdit="nocodeEditing.isDisplayCellPreparing(row, column)"
        :isTableCellEditable="Boolean(tableProps?.isTableCellEditable)"
        @edit-click="void nocodeEditing.handleDisplayEditClick({ row, column, startEdit })"
        @show-related-form="handleShowRelatedFormEvent"
        @show-link-form="handleShowLinkFormEvent"
        @show-related-sub-form="handleShowRelatedSubFormEvent"
      />
    </template>
  </virtual-table>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, PropType, ref, toRaw, toRef, watch } from "vue";
import { FormTableRowHeight, ViewActionPlacement } from "@common/types/nocode";
import { Field, OptionTableUID, Row, TableUID } from "@common/types/project";
import { FormCondition, RuleFunc, RuleFuncTextMapping, RuleFuncValue } from "@common/types/nocode";
import { SystemField } from "@common/utils/connection";
import { usePassportStore } from "@renderer/stores";
import { isAutoComputeColumn } from "./column-capability";
import { useTableProps } from "./hooks";
import { Column, Table } from "./table";
import {
  buildNocodeHeaderDescriptors,
  buildNocodeVirtualColumns,
  buildNocodeRowSpanBoundaries,
  createNocodeDelayedSelectionController,
  getNocodeRowSequence,
  getNocodeVirtualRowKey,
  isNocodeRowChecked,
  normalizeNocodeSelectionRows,
  reconcileNocodeSelectionRows,
  resolveNocodeCheckAllState,
  resolveNocodeDetailTrigger,
  resolveNocodeCellSpan,
  resolveNocodeRowClassName,
  shouldShowNocodeSelectionSequence,
  shouldDelayNocodeSelectionOnDblclick,
  shouldSyncNocodeSelectedRowOnRowActivate,
  toggleNocodeSelectionState,
  VirtualTable,
  VirtualTableBodyHeightMode,
  VirtualTableColumn,
  VirtualTableVerticalAlign,
} from "@renderer/components/virtual-table";
import {
  NocodeHeaderActionKey,
  NocodeHeaderDescriptor,
  NocodeHeaderMenuMode,
} from "@renderer/components/virtual-table/nocode-header-contract";
import TableCellFormat from "./components/cell/TableCellFormat.vue";
import TableFooterCell from "./components/cell/TableFooterCell.vue";
import FilterValueFormat from "./components/FilterValueFormat.vue";
import NocodeVirtualHeaderCell from "./components/NocodeVirtualHeaderCell.vue";
import ViewActionButtonGroup from "./components/ViewActionButtonGroup.vue";
import { useNocodeTableEditing } from "./nocode-editing/useNocodeTableEditing";
import i18next from "i18next";

type ActionItem = {
  action: any;
  disabled?: boolean;
  tip?: string;
};

type HeaderActionPayload = {
  actionKey: NocodeHeaderActionKey;
  column: Column;
  parentColumn?: Column;
};

const props = defineProps({
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
  cellVerticalAlign: {
    type: String as PropType<VirtualTableVerticalAlign>,
    default: "top",
  },
  bodyHeightMode: {
    type: String as PropType<VirtualTableBodyHeightMode>,
    default: "fill",
  },
  loading: {
    type: Boolean,
    default: false,
  },
  isCellEdit: {
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
    type: Function as PropType<(placement: ViewActionPlacement, row?: Row) => ActionItem[]>,
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
  (event: "show-related-form", payload: any): void;
  (event: "show-link-form", payload: any): void;
  (event: "show-related-sub-form", payload: any): void;
  (event: "update-cell-edit", value: boolean): void;
  (event: "execute-view-action", payload: { payload: any; row: Row }): void;
  (event: "cell-click", payload: { row: Row; column: VirtualTableColumn; event: MouseEvent }): void;
  (event: "row-activate", payload: { row: Row; column: VirtualTableColumn; event: MouseEvent; syncSelectedRow: boolean }): void;
  (event: "header-action", payload: HeaderActionPayload): void;
  (event: "column-width-change", payload: { column: Column; width: number }): void;
  (event: "header-filter-menu-open", payload: { column: Column; parentColumn?: Column }): void;
  (event: "header-filter-menu-close", payload: { column: Column; parentColumn?: Column }): void;
  (event: "header-filter-clear"): void;
  (event: "toggle-checkbox-row", row: Row): void;
  (event: "toggle-check-all", payload: { rows: Row[]; isChecked: boolean }): void;
}>();

const virtualTableRef = ref<InstanceType<typeof VirtualTable> | null>(null);

const CELL_DBLCLICK_SELECTION_DELAY = 220;
const delayedSelectionController = createNocodeDelayedSelectionController<Row>({
  delayMs: CELL_DBLCLICK_SELECTION_DELAY,
  getRowKey: (row) => row?.[props.widget.rowKey],
  schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
  cancel: (timer) => window.clearTimeout(timer),
});

const tableProps = useTableProps();
const passportState = usePassportStore();

const rows = computed(() => props.widget.showRows || []);
const rowSpanBoundaries = computed(() => buildNocodeRowSpanBoundaries(rows.value as Row[]));

const fixedRowContentHeight = computed(() => {
  if (props.rowHeightLevel === FormTableRowHeight.SMALL) {
    return 32;
  }
  if (props.rowHeightLevel === FormTableRowHeight.MEDIUM) {
    return 66;
  }
  if (props.rowHeightLevel === FormTableRowHeight.LARGE) {
    return 110;
  }
  return 66;
});

const estimatedRowHeight = computed(() => {
  if (props.rowHeightLevel === FormTableRowHeight.AUTO) {
    return 32;
  }
  // Fixed-height rows always render with a bottom grid line, so the
  // virtualization estimate needs to include that extra pixel.
  return fixedRowContentHeight.value + 1;
});

const minRowHeight = computed(() => {
  if (props.rowHeightLevel === FormTableRowHeight.AUTO) {
    return 0;
  }
  return fixedRowContentHeight.value;
});

const selectionSequenceLineHeight = computed(() => {
  if (props.rowHeightLevel === FormTableRowHeight.MEDIUM || props.rowHeightLevel === FormTableRowHeight.LARGE) {
    return 22;
  }
  return 32;
});

const virtualTableStyle = computed(() => {
  return {
    "--nocode-selection-sequence-line-height": `${selectionSequenceLineHeight.value}px`,
  };
});

const normalizedFixedColumnCount = computed(() => {
  return Math.max(0, Math.min(4, Math.floor(Number(props.fixedColumnCount) || 0)));
});

const hasPresetFixedColumn = computed(() => normalizedFixedColumnCount.value > 0);

const presetFixedColumnId = computed(() => {
  if (normalizedFixedColumnCount.value <= 0) {
    return null;
  }
  return (props.displayColumns as Column[] || [])[normalizedFixedColumnCount.value - 1]?.uid || null;
});

const manualFixedColumnId = computed(() => {
  return props.widget.hasFixedColumnIdSetting ? props.widget.fixedColumnId : null;
});

const effectiveFixedColumnId = computed(() => {
  return manualFixedColumnId.value ?? presetFixedColumnId.value;
});

const effectiveFixedColumnUidSet = computed(() => {
  const fixedColumnId = effectiveFixedColumnId.value;
  if (!fixedColumnId) {
    return new Set<Field["uid"]>();
  }
  const displayColumns = props.displayColumns as Column[] || [];
  const fixedIndex = displayColumns.findIndex((column) => column.uid === fixedColumnId);
  return new Set(
    fixedIndex >= 0
      ? displayColumns.slice(0, fixedIndex + 1).map((column) => column.uid)
      : [],
  );
});

const resolveFixedColumn = (uid: Field["uid"]) => {
  return effectiveFixedColumnUidSet.value.has(uid) ? "left" : "";
};

const virtualColumns = computed(() => {
  return buildNocodeVirtualColumns({
    displayColumns: props.displayColumns as Column[],
    tableWidthData: props.tableWidthData,
    isShowCheck: props.isShowCheck,
    showIndexColumn: props.showIndexColumn,
    showTableActionPanel: props.showTableActionPanel,
    tableActionColumnWidth: props.tableActionColumnWidth,
    isFixedColumn: resolveFixedColumn,
    appendColumns: props.enableShareLinkColumn && props.showShareLinkColumn ? [{
      key: "__share_link__",
      title: i18next.t("NocodeTable.shareUrl"),
      width: 110,
      resizable: false,
      align: "center",
      headerAlign: "center",
      meta: {
        kind: "share-link",
        allowUtilitySpan: true,
      },
    }] : [],
  });
});

const nocodeEditing = useNocodeTableEditing({
  widget: props.widget,
  rowHeightLevel: props.rowHeightLevel,
  isCellEdit: toRef(props, "isCellEdit"),
  tableProps: tableProps || {},
  isAdmin: computed(() => Boolean(passportState.account?.isAdmin)),
});

const shouldShowCellEditTrigger = (
  row: Row,
  column: VirtualTableColumn,
  editable: boolean,
  isEditing: boolean,
) => {
  if (!props.active || isEditing) {
    return false;
  }
  return editable || nocodeEditing.isDisplayCellEditable(row, column);
};

const headerDescriptorMap = computed(() => {
  return new Map<string, NocodeHeaderDescriptor>(
    buildNocodeHeaderDescriptors({
      displayColumns: props.displayColumns as Column[],
      tableWidthData: props.tableWidthData,
      sortFieldsMap: props.sortFieldsMap,
      filterConditions: props.filterConditions,
      sortable: props.sortable,
      hideColumnsAble: props.hideColumnsAble,
      updateColumnDataAble: props.updateColumnDataAble,
      headerMenuMode: props.headerMenuMode,
      enableHeaderFilterPanel: props.enableHeaderFilterPanel,
      isFixedColumn: resolveFixedColumn,
      isPresetFreezeActive: hasPresetFixedColumn.value && !manualFixedColumnId.value,
      isPresetFixedColumn: (uid) => {
        if (!hasPresetFixedColumn.value) {
          return false;
        }
        const presetFixedId = presetFixedColumnId.value;
        if (!presetFixedId) {
          return false;
        }
        const displayColumns = props.displayColumns as Column[] || [];
        const fixedIndex = displayColumns.findIndex((column) => column.uid === presetFixedId);
        return fixedIndex >= 0 && displayColumns.slice(0, fixedIndex + 1).some((column) => column.uid === uid);
      },
      fixedColumnId: effectiveFixedColumnId.value,
      isAutoComputeColumn: (column) => isAutoComputeColumn(column as Column),
      isSystemColumnWithoutSortAndFilter: (column) => isSystemColumnWithoutSortAndFilter(column as Column),
      canUpdateColumnData: (column) => props.canUpdateColumnData(column as Column),
    }).map((descriptor) => [descriptor.key, descriptor] as const),
  );
});

const getActionItems = (row: Row) => {
  return props.getRecordActionItems(ViewActionPlacement.TABLE_ACTION_COLUMN, row) || [];
};

const resolveFooterSubTableUID = (column: VirtualTableColumn) => {
  const sourceColumn = column.meta?.sourceColumn as Column | undefined;
  if (sourceColumn?.isSubColumn) {
    return sourceColumn.tableUID;
  }
  return sourceColumn?.extra?.subTableUID?.[1];
};

const getVirtualRowKey = (row: Row, rowIndex: number) => {
  return getNocodeVirtualRowKey({
    row,
    rowKey: props.widget.rowKey,
    rowIndex,
  });
};

const getRowKey = (row: Row) => {
  return row?.[props.widget.rowKey];
};

const resolveSelectedRowColumn = (column?: VirtualTableColumn | Column | null) => {
  const rawColumn = column ? toRaw(column) : null;
  return rawColumn
    ? ((rawColumn as any).meta?.sourceColumn || rawColumn)
    : props.widget.allColumns?.[0] || null;
};

const getRowSequence = (row: Row, rowIndex: number) => {
  return getNocodeRowSequence({
    rows: props.widget.rows as Row[],
    row,
    rowKey: props.widget.rowKey,
    rowIndex,
    currentPage: props.widget.currentPage,
    pageSize: props.widget.pageSize,
  });
};

const createSelectionRow = (row?: Row | null) => {
  if (!row) {
    return null;
  }

  const nextRow = {
    ...toRaw(row),
  } as Row;

  for (const { fieldUID, relationKey } of props.widget.subTableFieldUIDs || []) {
    const subRows = props.widget.subTableData?.[fieldUID]?.rows?.filter((subRow) => {
      return subRow?.[relationKey] === nextRow?.[props.widget.rowKey];
    }) || [];
    if (subRows.length > 0) {
      (nextRow as any)[fieldUID] = subRows;
    }
  }

  return nextRow;
};

const setSelectedRow = (row?: Row | null, column?: VirtualTableColumn | Column | null) => {
  props.widget.setSelectedRow(
    createSelectionRow(row) || null,
    row ? resolveSelectedRowColumn(column) : null,
  );
};

const allSelectableRows = computed(() => {
  return normalizeNocodeSelectionRows({
    rows: rows.value as Row[],
    rowKey: props.widget.rowKey,
    mapRow: (row) => createSelectionRow(row as Row),
  });
});

watch(rows, (nextRows) => {
  if (!props.isShowCheck) {
    return;
  }

  props.widget.setCheckboxRow(reconcileNocodeSelectionRows({
    availableRows: nextRows as Row[],
    checkedRows: props.widget.checkboxRow || [],
    rowKey: props.widget.rowKey,
    mapRow: (row) => createSelectionRow(row as Row),
  }));
}, { immediate: true });

const checkAllState = computed(() => {
  return resolveNocodeCheckAllState({
    rows: allSelectableRows.value as Row[],
    checkedRows: props.widget.checkboxRow || [],
    rowKey: props.widget.rowKey,
  });
});

const toggleAllSelection = () => {
  if (!props.isShowCheck || !props.isMultiple) {
    return;
  }

  const nextChecked = !checkAllState.value.checked;
  props.widget.setCheckboxRow(nextChecked ? allSelectableRows.value : []);

  if (!nextChecked) {
    setSelectedRow(null, null);
  }

  emit("toggle-check-all", {
    rows: allSelectableRows.value,
    isChecked: nextChecked,
  });
};

const getHeaderDescriptorKey = (column: VirtualTableColumn, isLeaf: boolean) => {
  const sourceColumn = column.meta?.sourceColumn as Column | undefined;
  const parentColumn = column.meta?.parentColumn as Column | undefined;
  if (!sourceColumn) {
    return null;
  }
  if (isLeaf && parentColumn?.uid) {
    return `${parentColumn.uid}.${sourceColumn.uid}`;
  }
  return sourceColumn.uid;
};

const resolveHeaderDescriptor = (column: VirtualTableColumn, isLeaf: boolean) => {
  const key = getHeaderDescriptorKey(column, isLeaf);
  if (!key) {
    return null;
  }
  return headerDescriptorMap.value.get(key) || null;
};

const resolveHeaderSourceColumn = (column: VirtualTableColumn) => {
  return column.meta?.sourceColumn as Column | undefined;
};

const resolveHeaderParentColumn = (column: VirtualTableColumn) => {
  return column.meta?.parentColumn as Column | undefined;
};

const isSystemColumnWithoutSortAndFilter = (column: Column) => {
  return [
    SystemField.DATA_TITLE,
    SystemField.UUID,
    SystemField.CURRENT_OWNER,
  ].includes(column.name as SystemField);
};

const shouldShowHeaderFilterPanel = (column: VirtualTableColumn, isLeaf: boolean) => {
  if (!props.enableHeaderFilterPanel || !isLeaf) {
    return false;
  }
  const sourceColumn = resolveHeaderSourceColumn(column);
  if (!sourceColumn) {
    return false;
  }
  return !isSystemColumnWithoutSortAndFilter(sourceColumn) && !isAutoComputeColumn(sourceColumn);
};

const showHeaderMenu = (column: VirtualTableColumn, isLeaf: boolean) => {
  if (!props.isShowTableHeaderMenu) {
    return false;
  }
  const descriptor = resolveHeaderDescriptor(column, isLeaf);
  if (!descriptor) {
    return false;
  }
  return descriptor.actionKeys.length > 0 || shouldShowHeaderFilterPanel(column, isLeaf);
};

const shouldUseSingleLineHeaderTitle = (column: VirtualTableColumn, isLeaf: boolean) => {
  if (!isLeaf) {
    return true;
  }
  return Boolean(resolveHeaderParentColumn(column));
};

const resolveHeaderFilterFieldId = (column: VirtualTableColumn, isLeaf: boolean) => {
  const descriptor = resolveHeaderDescriptor(column, isLeaf);
  return descriptor?.filterKey || "";
};

const resolveHeaderFilterMenus = (column: VirtualTableColumn, _isLeaf: boolean) => {
  const sourceColumn = resolveHeaderSourceColumn(column);
  if (!sourceColumn) {
    return [];
  }
  return props.getHeaderFilterMenus(sourceColumn, resolveHeaderParentColumn(column)) || [];
};

const resolveHeaderFilterInstance = (column: VirtualTableColumn, _isLeaf: boolean) => {
  const sourceColumn = resolveHeaderSourceColumn(column);
  if (!sourceColumn) {
    return undefined;
  }
  return props.getHeaderFilterInstance(sourceColumn, resolveHeaderParentColumn(column));
};

const resolveHeaderFilterValueType = (column: VirtualTableColumn, _isLeaf: boolean) => {
  const sourceColumn = resolveHeaderSourceColumn(column);
  if (!sourceColumn) {
    return undefined;
  }
  return props.getHeaderFilterValueType(
    props.headerFilterInfo.func as RuleFunc,
    sourceColumn,
    resolveHeaderParentColumn(column),
  );
};

const handleHeaderMenuOpen = (column: VirtualTableColumn, isLeaf: boolean) => {
  if (!shouldShowHeaderFilterPanel(column, isLeaf)) {
    return;
  }
  const sourceColumn = resolveHeaderSourceColumn(column);
  if (!sourceColumn) {
    return;
  }
  emit("header-filter-menu-open", {
    column: sourceColumn,
    parentColumn: resolveHeaderParentColumn(column),
  });
};

const handleHeaderMenuClose = (column: VirtualTableColumn, isLeaf: boolean) => {
  if (!shouldShowHeaderFilterPanel(column, isLeaf)) {
    return;
  }
  const sourceColumn = resolveHeaderSourceColumn(column);
  if (!sourceColumn) {
    return;
  }
  emit("header-filter-menu-close", {
    column: sourceColumn,
    parentColumn: resolveHeaderParentColumn(column),
  });
};

const getCellSpan = (row: Row, rowIndex: number, column: VirtualTableColumn) => {
  return resolveNocodeCellSpan({
    row,
    rowIndex,
    column,
    rowSpanBoundaries: rowSpanBoundaries.value,
  });
};

const isMergedAnchorCell = (row: Row, rowIndex: number, column: VirtualTableColumn) => {
  const span = getCellSpan(row, rowIndex, column);
  return span.rowSpan > 1 || span.colSpan > 1;
};

const getRowSpanBoundary = (_row: Row, rowIndex: number) => {
  return rowSpanBoundaries.value.get(rowIndex);
};

const isRowChecked = (row: Row) => {
  return isNocodeRowChecked({
    currentRows: props.widget.checkboxRow || [],
    row,
    rowKey: props.widget.rowKey,
  });
};

const shouldShowSelectionSequence = (row: Row) => {
  if (!props.showSelectionSequence) {
    return false;
  }
  return shouldShowNocodeSelectionSequence({
    isMultiple: props.isMultiple,
    checked: isRowChecked(row),
    showIndexColumn: props.showIndexColumn,
  });
};

const commitSelection = (
  row: Row,
  column?: VirtualTableColumn,
  options: { preserveDelayedSequence?: boolean } = {},
) => {
  if (props.isCellEdit) {
    return null;
  }

  const rowKey = getRowKey(row);
  delayedSelectionController.clearPending(rowKey);
  if (!options.preserveDelayedSequence) {
    delayedSelectionController.clearSequence(rowKey);
    delayedSelectionController.clearCommitted(rowKey);
  }

  if (!props.isShowCheck) {
    setSelectedRow(row, column || null);
    return {
      checked: true,
      nextRows: props.widget.checkboxRow || [],
      nextSelectedRow: row,
      selectedRowChanged: true,
    };
  }

  const result = toggleNocodeSelectionState({
    currentRows: props.widget.checkboxRow || [],
    currentSelectedRow: props.widget.selectedRow || null,
    row,
    rowKey: props.widget.rowKey,
    isMultiple: props.isMultiple,
  });

  props.widget.setCheckboxRow(normalizeNocodeSelectionRows({
    rows: result.nextRows,
    rowKey: props.widget.rowKey,
    mapRow: (nextRow) => createSelectionRow(nextRow as Row),
  }));

  if (result.selectedRowChanged) {
    setSelectedRow(result.nextSelectedRow as Row | null, result.nextSelectedRow ? column || null : null);
  }

  emit("toggle-checkbox-row", createSelectionRow(row) as Row);

  return result;
};

const getRowClassName = (row: Row) => {
  return resolveNocodeRowClassName({
    checkedRows: props.widget.checkboxRow || [],
    selectedRow: props.widget.selectedRow || null,
    row,
    rowKey: props.widget.rowKey,
    isShowCheck: props.isShowCheck,
    openedRowKey: props.openedRowKey,
  });
};

const detailTrigger = computed(() => resolveNocodeDetailTrigger({
  rowDetailTrigger: props.rowDetailTrigger,
  isMobile: props.isMobileDevice,
}));

const shouldDelaySelectionOnDblclick = computed(() => shouldDelayNocodeSelectionOnDblclick({
  clickRowChecked: props.clickRowChecked,
  clickRowShowDetail: props.clickRowShowDetail,
  detailTrigger: detailTrigger.value,
  isShowCheck: props.isShowCheck,
  isMobile: props.isMobileDevice,
}));

const queueDelayedSelection = (row: Row, column: VirtualTableColumn, event?: MouseEvent) => {
  if (!shouldDelaySelectionOnDblclick.value) {
    return false;
  }
  if ((event?.detail ?? 1) !== 1) {
    return false;
  }

  const rowKey = getRowKey(row);
  if (rowKey === undefined || rowKey === null) {
    return false;
  }

  return delayedSelectionController.queue(row, () => {
    commitSelection(row, column, { preserveDelayedSequence: true });
  });
};

const handleCellClick = (payload: { row: Row; column: VirtualTableColumn; event: MouseEvent }) => {
  if (props.isCellEdit) {
    return;
  }

  if (payload.column.meta?.kind === "selection") {
    commitSelection(payload.row, payload.column);
    return;
  }

  if (payload.column.meta?.kind === "action") {
    return;
  }

  if (shouldDelaySelectionOnDblclick.value && (payload.event?.detail ?? 1) > 1) {
    return;
  }

  if (props.clickRowChecked && !props.isMobileDevice) {
    const handledByDelay = queueDelayedSelection(payload.row, payload.column, payload.event);
    if (!handledByDelay) {
      commitSelection(payload.row, payload.column);
    }
  } else if (props.clickRowShowDetail && detailTrigger.value === "click") {
    delayedSelectionController.clearCommitted(getRowKey(payload.row));
    setSelectedRow(payload.row, payload.column);
  }

  emit("cell-click", payload);

  if (props.clickRowShowDetail && detailTrigger.value === "click") {
    emit("row-activate", {
      ...payload,
      syncSelectedRow: shouldSyncNocodeSelectedRowOnRowActivate({
        activationTrigger: "click",
        clickRowChecked: props.clickRowChecked,
        isShowCheck: props.isShowCheck,
        isMobile: props.isMobileDevice,
      }),
    });
  }
};

const handleCellDblClick = (payload: { row: Row; column: VirtualTableColumn; event: MouseEvent }) => {
  if (props.isCellEdit) {
    return;
  }
  if (payload.column.meta?.kind === "selection" || payload.column.meta?.kind === "action") {
    return;
  }

  const rowKey = getRowKey(payload.row);
  const shouldRevertCommittedSelection = shouldDelaySelectionOnDblclick.value
    && delayedSelectionController.getCommitted(rowKey)?.sequenceId === delayedSelectionController.getSequence(rowKey);

  delayedSelectionController.clearAll(rowKey);

  if (shouldRevertCommittedSelection) {
    commitSelection(payload.row, payload.column);
  }

  if (!props.clickRowShowDetail || detailTrigger.value !== "dblclick") {
    return;
  }
  emit("row-activate", {
    ...payload,
    syncSelectedRow: shouldSyncNocodeSelectedRowOnRowActivate({
      activationTrigger: "dblclick",
      clickRowChecked: props.clickRowChecked,
      isShowCheck: props.isShowCheck,
      isMobile: props.isMobileDevice,
    }),
  });
};

const handleHeaderAction = (actionKey: NocodeHeaderActionKey, column: VirtualTableColumn) => {
  const sourceColumn = column.meta?.sourceColumn as Column | undefined;
  if (!sourceColumn) {
    return;
  }
  emit("header-action", {
    actionKey,
    column: sourceColumn,
    parentColumn: column.meta?.parentColumn as Column | undefined,
  });
};

const handleColumnWidthChange = (payload: { column: VirtualTableColumn; width: number }) => {
  const sourceColumn = payload.column.meta?.sourceColumn as Column | undefined;
  if (!sourceColumn?.uid) {
    return;
  }
  emit("column-width-change", {
    column: sourceColumn,
    width: payload.width,
  });
};

const handleShowRelatedFormEvent = (payload: { relatedTableUID: OptionTableUID; uuid: string; row?: Row; fieldUID?: string }) => {
  emit("show-related-form", payload);
};

const handleShowLinkFormEvent = (tableId: string, filterPath: string, nocodeId?: string) => {
  emit("show-link-form", {
    tableId,
    filterPath,
    nocodeId,
  });
};

const handleShowRelatedSubFormEvent = (row: Row, value: { uid: TableUID; name: string; fields: Field[] }) => {
  emit("show-related-sub-form", {
    row,
    value,
  });
};

onBeforeUnmount(() => {
  delayedSelectionController.clearAll();
});

defineExpose({
  getInnerTable: () => virtualTableRef.value,
});
</script>

<style scoped lang="scss">
.nocode-virtual-table {
  --nocode-table-cell-font-size: 13px;

  :deep(.virtual-table__row:hover .virtual-table__cell),
  :deep(.virtual-table__row.is-row-hovered .virtual-table__cell) {
    --virtual-table-row-background: #f5f7fa;
    background: #f5f7fa;
  }

  :deep(.virtual-table__cell:hover .edit-button) {
    display: flex;
  }

  :deep(.virtual-table__row:hover .selection-button__sequence-toggle .selection-button__box--hover),
  :deep(.virtual-table__row.is-row-hovered .selection-button__sequence-toggle .selection-button__box--hover) {
    opacity: 1;
  }

  :deep(.virtual-table__row:hover .selection-button__sequence-toggle .selection-button__box--sequence),
  :deep(.virtual-table__row.is-row-hovered .selection-button__sequence-toggle .selection-button__box--sequence) {
    opacity: 0;
  }

  :deep(.virtual-table__footer-cell) {
    padding: 0;
  }

  :deep(.is-row-checked .virtual-table__cell),
  :deep(.is-row-selected .virtual-table__cell) {
    --virtual-table-row-background: #f5f9ff;
    background: #f5f9ff;
  }

  :deep(.is-row-checked:hover .virtual-table__cell),
  :deep(.is-row-selected:hover .virtual-table__cell),
  :deep(.is-row-checked.is-row-hovered .virtual-table__cell),
  :deep(.is-row-selected.is-row-hovered .virtual-table__cell) {
    --virtual-table-row-background: #f5f9ff;
    background: #f5f9ff;
  }

  :deep(.is-row-opened .virtual-table__cell) {
    --virtual-table-row-background: #eef5ff;
    background: #eef5ff;
  }

  :deep(.is-row-opened:hover .virtual-table__cell),
  :deep(.is-row-opened.is-row-hovered .virtual-table__cell) {
    --virtual-table-row-background: #e8f1ff;
    background: #e8f1ff;
  }
}

.selection-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.selection-button--header {
  width: 100%;
  height: 100%;
}

.selection-button--body {
  align-items: var(--virtual-table-cell-align-items, center);
  box-sizing: border-box;
}

.selection-button--body:not(.selection-button--indexed) {
  padding: 4px 0;
}

.selection-button--indexed {
  padding: 0;
}

.selection-button__content {
  display: inline-flex;
  align-items: var(--virtual-table-cell-align-items, center);
  justify-content: center;
  width: 100%;
  min-width: 0;
}

.selection-button__content--indexed {
  height: var(--nocode-selection-sequence-line-height, 32px);
  min-height: var(--nocode-selection-sequence-line-height, 32px);
  align-items: center;
}

.selection-button__sequence-toggle {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: var(--nocode-selection-sequence-line-height, 32px);
  min-height: var(--nocode-selection-sequence-line-height, 32px);
}

.row-order-index-wrap,
.row-action-wrap {
  display: flex;
  align-items: var(--virtual-table-cell-align-items, center);
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}

.row-action-wrap {
  padding: 4px 0;
}

.share-link-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  color: #7a8599;
}

:global(.share-link-menu-popper.el-popper) {
  padding: 4px;
  background-color: #fff !important;
  border: 1px solid #e6eaf2;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.share-link-menu {
  padding: 0;
  background-color: #fff;
}

:deep(.share-link-menu__item-wrap) {
  border-radius: 4px;
}

.selection-button__box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid #c0c4cc;
  border-radius: 4px;
  color: transparent;
  font-size: 12px;
  line-height: 1;

  &.is-sequence {
    width: auto;
    min-width: 16px;
    height: var(--nocode-selection-sequence-line-height, 32px);
    min-height: var(--nocode-selection-sequence-line-height, 32px);
    line-height: var(--nocode-selection-sequence-line-height, 32px);
    align-items: flex-start;
    border: none;
    background: transparent;
    color: #909399;
    font-size: 12px;
    font-weight: 500;
  }

  &.is-radio {
    border-radius: 999px;
  }

  &.checked {
    border-color: #409eff;
    background: #409eff;
    color: #fff;
  }

  &.indeterminate {
    border-color: #409eff;
    background: #409eff;
    color: #fff;
  }
}

.selection-button__box--sequence,
.selection-button__box--hover {
  transition: opacity 0.12s ease;
}

.selection-button__box--hover {
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  pointer-events: none;
}

.selection-button__radio-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.selection-button__indeterminate {
  width: 8px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

.row-order-index {
  color: #909399;
  font-size: 12px;
  line-height: 1;
}
</style>

<style lang="scss">
.widget-table-menu-popper {
  .el-menu {
    .filter-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      column-gap: 8px;
      padding: 8px 10px;

      .filter-left {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 14px;
        column-gap: 5px;
        color: #111;
      }

      .el-dropdown-link {
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: var(--el-menu-hover-text-color);
        cursor: pointer;

        &:focus-visible {
          outline: unset;
        }
      }

      .table-filter-dropdown-popper {
        width: 200px;
        max-height: 220px;
        border-radius: 4px;
        padding: 2px;

        .el-scrollbar,
        .el-scrollbar__wrap {
          max-height: 220px;

          .el-scrollbar__view {
            width: 100%;
            height: 100%;
          }
        }

        .el-dropdown-menu {
          width: 100%;
          height: 100%;
          background-color: var(--bg-color-page);
          padding: 0;

          .el-dropdown-menu__item {
            height: 36px;
          }
        }

        .el-popper__arrow {
          display: none;
        }
      }

      .filter-func {
        display: flex;
        align-items: center;

        .filter-left {
          margin-right: 15px;
        }
      }
    }

    .filter-wrap {
      padding: 8px 10px;

      .el-input {
        .el-input__wrapper {
          padding: 8px;
          border-radius: 4px;
          height: 32px;
        }
      }
    }
  }
}
</style>
