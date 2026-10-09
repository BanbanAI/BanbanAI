import { computed } from "vue";
import { buildFilterOptions } from "../filter";
import { buildNocodeVirtualColumns } from "@renderer/components/virtual-table/nocode-virtual-utils";
import { DataManagementDisplayStateOptions } from "./types";

export const useDataManagementDisplayState = (options: DataManagementDisplayStateOptions) => {
  const virtualColumns = computed(() => {
    return buildNocodeVirtualColumns({
      displayColumns: options.displayColumns.value,
      tableWidthData: options.tableWidthData.value,
      isShowCheck: options.props.isShowCheck,
      showIndexColumn: options.props.isShowIndex,
      showTableActionPanel: false,
      isFixedColumn: (uid) => options.widget.isFixedColumn(uid),
    });
  });

  const filterColumns = computed(() => {
    return buildFilterOptions(options.widget.allColumns, {
      excludeTopLevelRelated: true,
      excludeCurrentOwner: true,
    });
  });

  const hiddenColumnIds = computed(() => options.widget.hiddenColumnIds || []);
  const columnOrders = computed(() => options.widget.columnOrders || {});
  const rowHeightLevel = computed(() => options.widget.rowHeightLevel);
  const filterDisplayMode = computed(() => options.widget.filterDisplayMode);

  return {
    virtualColumns,
    displayColumns: options.displayColumns,
    filterColumns,
    hiddenColumnIds,
    columnOrders,
    rowHeightLevel,
    tableWidthData: options.tableWidthData,
    sortFieldsMap: options.sortFieldsMap,
    filterConditions: options.filterConditions,
    columnFilterInfo: options.columnFilterInfo,
    isFilterValueNotEmpty: options.isFilterValueNotEmpty,
    filterDisplayMode,
  };
};
