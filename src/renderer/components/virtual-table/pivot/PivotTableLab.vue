<template>
  <div class="pivot-table-lab">
    <div class="pivot-table-lab__toolbar">
      <div class="pivot-table-lab__toolbar-left">
        <strong>Pivot Table Lab</strong>
        <span>用于验证 cross-table / cross-tree-table、维度配置、筛选和展开行为</span>
      </div>
      <div class="pivot-table-lab__toolbar-right">
        <button
          type="button"
          class="pivot-table-lab__mode-button"
          :class="{ active: mode === 'cross' }"
          @click="mode = 'cross'"
        >
          Cross
        </button>
        <button
          type="button"
          class="pivot-table-lab__mode-button"
          :class="{ active: mode === 'tree' }"
          @click="mode = 'tree'"
        >
          Tree
        </button>
        <button
          type="button"
          class="pivot-table-lab__ghost-button"
          @click="toggleDimensionPanel"
        >
          配置维度
        </button>
        <button
          type="button"
          class="pivot-table-lab__ghost-button"
          @click="toggleTopDimensionPanel"
        >
          顶部维度
        </button>
        <span>records: {{ records.length }}</span>
        <span>filtered: {{ snapshot.filteredRecords.length }}</span>
        <span>dims: {{ leftDimCodes.length }}</span>
      </div>
    </div>

    <div class="pivot-table-lab__summary">
      <span>active dims: {{ activeDimensionNames }}</span>
      <span>top dims: {{ activeTopDimensionNames }}</span>
      <span>indicators: {{ indicatorSide }}</span>
      <span>subtotal: {{ showSubtotal ? "on" : "off" }}</span>
      <span>subtotal-position: {{ subtotalPosition }}</span>
      <span>grand-row: {{ showGrandTotalRow ? grandTotalRowPosition : "off" }}</span>
      <span>grand-column: {{ showGrandTotalColumn ? grandTotalColumnPosition : "off" }}</span>
      <span>expand: {{ supportsExpand ? "on" : "off" }}</span>
      <span>cross roots: {{ snapshot.cross.leftTree.length }}</span>
      <span>tree roots: {{ snapshot.tree.leftTree.length }}</span>
      <span>tree open: {{ treeOpenKeys.length ? treeOpenKeys.join(", ") : "-" }}</span>
      <span>left open: {{ crossLeftExpandKeys.length ? crossLeftExpandKeys.join(", ") : "-" }}</span>
      <span>top open: {{ crossTopExpandKeys.length ? crossTopExpandKeys.join(", ") : "-" }}</span>
    </div>

    <div class="pivot-table-lab__dimension-tags">
      <button
        v-for="dimension in activeDimensions"
        :key="dimension.code"
        type="button"
        class="pivot-table-lab__tag"
        :class="{
          'is-active': isDimensionFilterActive(dimension.code),
          'is-empty': isDimensionFilterEmpty(dimension.code),
          'is-current': activeFilterDimCode === dimension.code,
        }"
        @click="toggleFilterPanel(dimension.code)"
      >
        <span>{{ dimension.name }}</span>
        <small>{{ resolveSelectedCount(dimension.code) }}/{{ resolveTotalCount(dimension.code) }}</small>
      </button>
    </div>

    <div v-if="activeFilterDimension" class="pivot-table-lab__panel">
      <div class="pivot-table-lab__panel-header">
        <strong>{{ activeFilterDimension.name }}筛选</strong>
        <div class="pivot-table-lab__panel-actions">
          <button type="button" class="pivot-table-lab__ghost-button" @click="selectAllFilterValues(activeFilterDimension.code)">全选</button>
          <button type="button" class="pivot-table-lab__ghost-button" @click="clearFilterValues(activeFilterDimension.code)">清空</button>
          <button type="button" class="pivot-table-lab__ghost-button" @click="activeFilterDimCode = null">关闭</button>
        </div>
      </div>
      <div class="pivot-table-lab__filter-values">
        <label
          v-for="value in resolveDimensionValues(activeFilterDimension.code)"
          :key="value"
          class="pivot-table-lab__checkbox"
        >
          <input
            type="checkbox"
            :checked="isFilterValueSelected(activeFilterDimension.code, value)"
            @change="handleFilterValueInputChange(activeFilterDimension.code, value, $event)"
          >
          <span>{{ value }}</span>
        </label>
      </div>
    </div>

    <div v-if="dimensionPanelVisible" class="pivot-table-lab__panel">
      <div class="pivot-table-lab__panel-header">
        <strong>维度配置</strong>
        <div class="pivot-table-lab__panel-actions">
          <button type="button" class="pivot-table-lab__ghost-button" @click="dimensionPanelVisible = false">关闭</button>
        </div>
      </div>
      <div class="pivot-table-lab__dimension-grid">
        <div class="pivot-table-lab__dimension-section">
          <strong>可选维度</strong>
          <label
            v-for="dimension in allDimensions"
            :key="dimension.code"
            class="pivot-table-lab__checkbox"
          >
            <input
              type="checkbox"
              :checked="leftDimCodes.includes(dimension.code)"
              @change="handleDimensionEnabledInputChange(dimension.code, $event)"
            >
            <span>{{ dimension.name }}</span>
          </label>
        </div>
        <div class="pivot-table-lab__dimension-section">
          <strong>已选顺序</strong>
          <div
            v-for="(code, index) in leftDimCodes"
            :key="code"
            class="pivot-table-lab__dimension-item"
          >
            <span>{{ resolveDimensionName(code) }}</span>
            <div class="pivot-table-lab__dimension-actions">
              <button
                type="button"
                class="pivot-table-lab__ghost-button"
                :disabled="index === 0"
                @click="moveDimension(index, index - 1)"
              >
                上移
              </button>
              <button
                type="button"
                class="pivot-table-lab__ghost-button"
                :disabled="index === leftDimCodes.length - 1"
                @click="moveDimension(index, index + 1)"
              >
                下移
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="topDimensionPanelVisible" class="pivot-table-lab__panel">
      <div class="pivot-table-lab__panel-header">
        <strong>顶部维度与指标配置</strong>
        <div class="pivot-table-lab__panel-actions">
          <button type="button" class="pivot-table-lab__ghost-button" @click="topDimensionPanelVisible = false">关闭</button>
        </div>
      </div>
      <div class="pivot-table-lab__dimension-grid">
        <div class="pivot-table-lab__dimension-section">
          <strong>顶部维度</strong>
          <label
            v-for="dimension in topDimensions"
            :key="dimension.code"
            class="pivot-table-lab__checkbox"
          >
            <input
              type="checkbox"
              :checked="topDimCodes.includes(String(dimension.code))"
              @change="handleTopDimensionEnabledInputChange(String(dimension.code), $event)"
            >
            <span>{{ dimension.name }}</span>
          </label>
        </div>
        <div class="pivot-table-lab__dimension-section">
          <strong>顶部顺序</strong>
          <div
            v-for="(code, index) in topDimCodes"
            :key="code"
            class="pivot-table-lab__dimension-item"
          >
            <span>{{ resolveTopDimensionName(code) }}</span>
            <div class="pivot-table-lab__dimension-actions">
              <button
                type="button"
                class="pivot-table-lab__ghost-button"
                :disabled="index === 0"
                @click="moveTopDimension(index, index - 1)"
              >
                上移
              </button>
              <button
                type="button"
                class="pivot-table-lab__ghost-button"
                :disabled="index === topDimCodes.length - 1"
                @click="moveTopDimension(index, index + 1)"
              >
                下移
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="pivot-table-lab__config-grid">
        <div class="pivot-table-lab__config-section">
          <strong>指标位置</strong>
          <div class="pivot-table-lab__radio-group">
            <label class="pivot-table-lab__checkbox">
              <input type="radio" :checked="indicatorSide === 'top'" @change="indicatorSide = 'top'">
              <span>顶部</span>
            </label>
            <label class="pivot-table-lab__checkbox">
              <input type="radio" :checked="indicatorSide === 'left'" @change="indicatorSide = 'left'">
              <span>左侧</span>
            </label>
          </div>
        </div>
        <div class="pivot-table-lab__config-section">
          <strong>行为开关</strong>
          <label class="pivot-table-lab__checkbox">
            <input type="checkbox" :checked="showSubtotal" @change="showSubtotal = !showSubtotal">
            <span>显示小计</span>
          </label>
          <label class="pivot-table-lab__checkbox">
            <input type="checkbox" :checked="showGrandTotalRow" @change="showGrandTotalRow = !showGrandTotalRow">
            <span>显示总计行</span>
          </label>
          <label class="pivot-table-lab__checkbox">
            <input type="checkbox" :checked="showGrandTotalColumn" @change="showGrandTotalColumn = !showGrandTotalColumn">
            <span>显示总计列</span>
          </label>
          <label class="pivot-table-lab__checkbox">
            <input type="checkbox" :checked="supportsExpand" @change="handleSupportsExpandToggle">
            <span>支持展开</span>
          </label>
        </div>
        <div class="pivot-table-lab__config-section">
          <strong>小计位置</strong>
          <div class="pivot-table-lab__radio-group">
            <label class="pivot-table-lab__checkbox">
              <input type="radio" :checked="subtotalPosition === 'top'" @change="subtotalPosition = 'top'">
              <span>小计置顶</span>
            </label>
            <label class="pivot-table-lab__checkbox">
              <input type="radio" :checked="subtotalPosition === 'bottom'" @change="subtotalPosition = 'bottom'">
              <span>小计置底</span>
            </label>
          </div>
        </div>
        <div class="pivot-table-lab__config-section">
          <strong>总计行位置</strong>
          <div class="pivot-table-lab__radio-group">
            <label class="pivot-table-lab__checkbox">
              <input type="radio" :checked="grandTotalRowPosition === 'top'" @change="grandTotalRowPosition = 'top'">
              <span>总计行置顶</span>
            </label>
            <label class="pivot-table-lab__checkbox">
              <input type="radio" :checked="grandTotalRowPosition === 'bottom'" @change="grandTotalRowPosition = 'bottom'">
              <span>总计行置底</span>
            </label>
          </div>
        </div>
        <div class="pivot-table-lab__config-section">
          <strong>总计列位置</strong>
          <div class="pivot-table-lab__radio-group">
            <label class="pivot-table-lab__checkbox">
              <input type="radio" :checked="grandTotalColumnPosition === 'left'" @change="grandTotalColumnPosition = 'left'">
              <span>总计列居左</span>
            </label>
            <label class="pivot-table-lab__checkbox">
              <input type="radio" :checked="grandTotalColumnPosition === 'right'" @change="grandTotalColumnPosition = 'right'">
              <span>总计列居右</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div class="pivot-table-lab__table-shell">
      <pivot-table
        class="pivot-table-lab__table"
        :mode="mode"
        :records="records"
        :dimensions="resolvedDimensions"
        :left-codes="leftDimCodes"
        :top-codes="topDimCodes"
        :tree-top-codes="treeTopCodes"
        :indicators="pivotTableLabIndicators"
        :aggregate="aggregatePivotTableLabRecords"
        :filters="filters"
        :indicator-side="indicatorSide"
        :show-subtotal="showSubtotal"
        :subtotal-position="subtotalPosition"
        :show-grand-total-row="showGrandTotalRow"
        :grand-total-row-position="grandTotalRowPosition"
        :show-grand-total-column="showGrandTotalColumn"
        :grand-total-column-position="grandTotalColumnPosition"
        :show-corner-dimension-header="true"
        :supports-expand="supportsExpand"
        :left-expand-keys="crossLeftExpandKeys"
        :top-expand-keys="crossTopExpandKeys"
        :tree-open-keys="treeOpenKeys"
        :tree-primary-column="treePrimaryColumn"
        :container-width="'100%'"
        :container-height="'100%'"
        :estimated-row-height="40"
        :min-row-height="36"
        :header-height="tableHeaderHeight"
        :default-column-width="120"
        @change-left-expand-keys="handlePivotLeftExpand"
        @change-top-expand-keys="handlePivotTopExpand"
        @change-tree-open-keys="handleTreeOpenKeys"
      >
        <template #cell="{ value, displayValue, leftNode, topNode }">
          <span
            class="pivot-table-lab__cell"
            :class="{
              'is-right': isNumericValue(value),
              'is-summary': isSummaryNode(leftNode) || isSummaryNode(topNode),
            }"
          >
            {{ displayValue }}
          </span>
        </template>
      </pivot-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PivotTable } from "./index";
import {
  createPivotTableLabRecords,
  PIVOT_TABLE_LAB_DEFAULT_LEFT_CODES,
  PIVOT_TABLE_LAB_DEFAULT_TOP_CODES,
  PIVOT_TABLE_LAB_DIMENSIONS,
  PIVOT_TABLE_LAB_TREE_TOP_CODES,
  PIVOT_TABLE_LAB_TOP_DIMENSIONS,
  pivotTableLabIndicators,
  type PivotTableLabIndicatorSide,
  type PivotTableLabDimension,
} from "./lab/mock-data";
import {
  aggregatePivotTableLabRecords,
} from "./lab/playground-model";
import {
  applyPivotDesignerFilterValues,
  applyPivotDesignerFilterValueToggle,
  reorderPivotDesignerLeftAxisDimensions,
  reorderPivotDesignerTopAxisDimensions,
  resolvePivotDesignerActiveFilterDimCode,
  samePivotDesignerStringArray,
  syncPivotDesignerExpandKeys,
  syncPivotDesignerOpenKeys,
  togglePivotDesignerLeftAxisDimension,
  togglePivotDesignerTopAxisDimension,
} from "./designer";
import {
  buildPivotTableModel,
  collectPivotTableDrillTreeKeys,
  createPivotTableDimensionValueMap,
  createPivotTableFilters,
} from "./model";

const records = createPivotTableLabRecords();
const mode = ref<"cross" | "tree">("cross");
const allDimensions = PIVOT_TABLE_LAB_DIMENSIONS;
const topDimensions = PIVOT_TABLE_LAB_TOP_DIMENSIONS;
const dimensionNameMap = new Map(allDimensions.map((dimension) => [dimension.code, dimension.name] as const));
const topDimensionNameMap = new Map(topDimensions.map((dimension) => [String(dimension.code), dimension.name] as const));
const dimensionValueMap = createPivotTableDimensionValueMap(records, allDimensions);
const leftDimCodes = ref<string[]>([...PIVOT_TABLE_LAB_DEFAULT_LEFT_CODES]);
const topDimCodes = ref<string[]>([...PIVOT_TABLE_LAB_DEFAULT_TOP_CODES]);
const filters = ref(createPivotTableFilters(dimensionValueMap));
const treeOpenKeys = ref<string[]>([]);
const crossLeftExpandKeys = ref<string[]>([]);
const crossTopExpandKeys = ref<string[]>([]);
const treeOpenKeysTouched = ref(false);
const activeFilterDimCode = ref<string | null>(leftDimCodes.value[0] || null);
const dimensionPanelVisible = ref(false);
const topDimensionPanelVisible = ref(false);
const indicatorSide = ref<PivotTableLabIndicatorSide>("top");
const showSubtotal = ref(true);
const subtotalPosition = ref<"top" | "bottom">("top");
const showGrandTotalRow = ref(false);
const grandTotalRowPosition = ref<"top" | "bottom">("bottom");
const showGrandTotalColumn = ref(false);
const grandTotalColumnPosition = ref<"left" | "right">("right");
const supportsExpand = ref(false);
const tableHeaderHeight = 40;

const snapshot = computed(() => {
  return buildPivotTableModel({
    records,
    dimensions: resolvedDimensions.value,
    leftCodes: leftDimCodes.value,
    topCodes: topDimCodes.value,
    treeTopCodes: treeTopCodes.value,
    indicators: pivotTableLabIndicators,
    aggregate: aggregatePivotTableLabRecords,
    filters: filters.value,
    treeOpenKeys: treeOpenKeys.value,
    leftExpandKeys: crossLeftExpandKeys.value,
    topExpandKeys: crossTopExpandKeys.value,
    indicatorSide: indicatorSide.value,
    showSubtotal: showSubtotal.value,
    subtotalPosition: subtotalPosition.value,
    showGrandTotalRow: showGrandTotalRow.value,
    grandTotalRowPosition: grandTotalRowPosition.value,
    showGrandTotalColumn: showGrandTotalColumn.value,
    grandTotalColumnPosition: grandTotalColumnPosition.value,
    supportsExpand: supportsExpand.value,
  });
});

const resolvedDimensions = computed(() => {
  return [...allDimensions, ...topDimensions];
});

const treeTopCodes = computed(() => {
  return [...PIVOT_TABLE_LAB_TREE_TOP_CODES];
});

const activeDimensions = computed(() => {
  return leftDimCodes.value
    .map((code) => allDimensions.find((dimension) => dimension.code === code))
    .filter(Boolean) as PivotTableLabDimension[];
});

const activeDimensionNames = computed(() => {
  return activeDimensions.value.map((dimension) => dimension.name).join(" / ");
});

const activeTopDimensionNames = computed(() => {
  return topDimCodes.value.map((code) => resolveTopDimensionName(code)).join(" / ");
});

const activeFilterDimension = computed(() => {
  if (!activeFilterDimCode.value) {
    return null;
  }
  return allDimensions.find((dimension) => dimension.code === activeFilterDimCode.value) || null;
});

const treePrimaryColumn = computed(() => {
  return {
    name: activeDimensionNames.value ? `数据维度（${activeDimensionNames.value}）` : "数据维度",
    width: 220,
  };
});

const validLeftTreeKeys = computed(() => {
  return collectPivotTableDrillTreeKeys(snapshot.value.filteredRecords, leftDimCodes.value);
});

const validTopTreeKeys = computed(() => {
  return collectPivotTableDrillTreeKeys(snapshot.value.filteredRecords, topDimCodes.value);
});

watch(
  () => ({
    keys: validLeftTreeKeys.value,
    defaultKeys: snapshot.value.tree.defaultOpenKeys,
  }),
  ({ keys, defaultKeys }) => {
    const nextOpenKeys = syncPivotDesignerOpenKeys({
      openKeys: treeOpenKeys.value,
      validKeys: keys,
      defaultKeys,
      touched: treeOpenKeysTouched.value,
    });

    if (!samePivotDesignerStringArray(nextOpenKeys, treeOpenKeys.value)) {
      treeOpenKeys.value = nextOpenKeys;
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => validLeftTreeKeys.value,
  (keys) => {
    const nextKeys = syncPivotDesignerExpandKeys(crossLeftExpandKeys.value, keys);
    if (!samePivotDesignerStringArray(nextKeys, crossLeftExpandKeys.value)) {
      crossLeftExpandKeys.value = nextKeys;
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => validTopTreeKeys.value,
  (keys) => {
    const nextKeys = syncPivotDesignerExpandKeys(crossTopExpandKeys.value, keys);
    if (!samePivotDesignerStringArray(nextKeys, crossTopExpandKeys.value)) {
      crossTopExpandKeys.value = nextKeys;
    }
  },
  {
    immediate: true,
  },
);

watch(
  () => leftDimCodes.value.join("|"),
  () => {
    activeFilterDimCode.value = resolvePivotDesignerActiveFilterDimCode(
      activeFilterDimCode.value,
      leftDimCodes.value,
    );
  },
);

const resolveDimensionValues = (code: string) => {
  return dimensionValueMap[code] || [];
};

const resolveDimensionName = (code: string) => {
  return dimensionNameMap.get(code as any) || code;
};

const resolveTopDimensionName = (code: string) => {
  return topDimensionNameMap.get(code) || code;
};

const resolveSelectedCount = (code: string) => {
  return filters.value[code]?.length || 0;
};

const resolveTotalCount = (code: string) => {
  return resolveDimensionValues(code).length;
};

const isDimensionFilterActive = (code: string) => {
  return resolveSelectedCount(code) < resolveTotalCount(code);
};

const isDimensionFilterEmpty = (code: string) => {
  return resolveSelectedCount(code) === 0;
};

const isFilterValueSelected = (code: string, value: string) => {
  return Boolean(filters.value[code]?.includes(value));
};

const updateFilterValues = (code: string, values: string[]) => {
  const nextState = applyPivotDesignerFilterValues(filters.value, code, values);
  filters.value = nextState.filters;
  treeOpenKeysTouched.value = nextState.treeOpenKeysTouched;
};

const handleFilterValueChange = (code: string, value: string, checked: boolean) => {
  const nextState = applyPivotDesignerFilterValueToggle(filters.value, code, value, checked);
  filters.value = nextState.filters;
  treeOpenKeysTouched.value = nextState.treeOpenKeysTouched;
};

const handleFilterValueInputChange = (code: string, value: string, event: Event) => {
  const checked = (event.target as HTMLInputElement | null)?.checked || false;
  handleFilterValueChange(code, value, checked);
};

const selectAllFilterValues = (code: string) => {
  updateFilterValues(code, [...resolveDimensionValues(code)]);
};

const clearFilterValues = (code: string) => {
  updateFilterValues(code, []);
};

const toggleFilterPanel = (code: string) => {
  dimensionPanelVisible.value = false;
  topDimensionPanelVisible.value = false;
  activeFilterDimCode.value = activeFilterDimCode.value === code ? null : code;
};

const toggleDimensionPanel = () => {
  activeFilterDimCode.value = null;
  topDimensionPanelVisible.value = false;
  dimensionPanelVisible.value = !dimensionPanelVisible.value;
};

const toggleTopDimensionPanel = () => {
  activeFilterDimCode.value = null;
  dimensionPanelVisible.value = false;
  topDimensionPanelVisible.value = !topDimensionPanelVisible.value;
};

const handleDimensionEnabledChange = (code: string, checked: boolean) => {
  const nextState = togglePivotDesignerLeftAxisDimension(
    leftDimCodes.value,
    code,
    checked,
    activeFilterDimCode.value,
  );
  leftDimCodes.value = nextState.dimCodes;
  activeFilterDimCode.value = nextState.activeFilterDimCode;
  treeOpenKeysTouched.value = nextState.treeOpenKeysTouched;
  crossLeftExpandKeys.value = nextState.expandKeys;
};

const handleDimensionEnabledInputChange = (code: string, event: Event) => {
  const checked = (event.target as HTMLInputElement | null)?.checked || false;
  handleDimensionEnabledChange(code, checked);
};

const moveDimension = (fromIndex: number, toIndex: number) => {
  const nextState = reorderPivotDesignerLeftAxisDimensions(
    leftDimCodes.value,
    fromIndex,
    toIndex,
    activeFilterDimCode.value,
  );
  leftDimCodes.value = nextState.dimCodes;
  activeFilterDimCode.value = nextState.activeFilterDimCode;
  treeOpenKeysTouched.value = nextState.treeOpenKeysTouched;
  crossLeftExpandKeys.value = nextState.expandKeys;
};

const handleTopDimensionEnabledChange = (code: string, checked: boolean) => {
  const nextState = togglePivotDesignerTopAxisDimension(topDimCodes.value, code, checked);
  topDimCodes.value = nextState.dimCodes;
  crossTopExpandKeys.value = nextState.expandKeys;
};

const handleTopDimensionEnabledInputChange = (code: string, event: Event) => {
  const checked = (event.target as HTMLInputElement | null)?.checked || false;
  handleTopDimensionEnabledChange(code, checked);
};

const moveTopDimension = (fromIndex: number, toIndex: number) => {
  const nextState = reorderPivotDesignerTopAxisDimensions(topDimCodes.value, fromIndex, toIndex);
  topDimCodes.value = nextState.dimCodes;
  crossTopExpandKeys.value = nextState.expandKeys;
};

const handleTreeOpenKeys = (payload: { nextOpenKeys: string[] }) => {
  treeOpenKeysTouched.value = true;
  treeOpenKeys.value = payload.nextOpenKeys;
};

const handlePivotLeftExpand = (payload: { nextKeys: string[] }) => {
  crossLeftExpandKeys.value = [...payload.nextKeys];
};

const handlePivotTopExpand = (payload: { nextKeys: string[] }) => {
  crossTopExpandKeys.value = [...payload.nextKeys];
};

const handleSupportsExpandToggle = () => {
  supportsExpand.value = !supportsExpand.value;
  if (!supportsExpand.value) {
    crossLeftExpandKeys.value = [];
    crossTopExpandKeys.value = [];
  }
};

const isNumericValue = (value: any) => {
  return typeof value === "number";
};

const isSummaryNode = (node: any) => {
  return node?.value === "小计" || node?.value === "总计";
};
</script>

<style scoped lang="scss">
.pivot-table-lab {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pivot-table-lab__toolbar,
.pivot-table-lab__summary,
.pivot-table-lab__dimension-tags {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.pivot-table-lab__toolbar-left,
.pivot-table-lab__toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #303133;
  flex-wrap: wrap;
}

.pivot-table-lab__toolbar-left span,
.pivot-table-lab__toolbar-right,
.pivot-table-lab__summary {
  font-size: 12px;
  color: #909399;
}

.pivot-table-lab__table {
  flex: 1;
  min-height: 0;
}

.pivot-table-lab__table-shell {
  position: relative;
  flex: 1;
  min-height: 0;
}

.pivot-table-lab__mode-button,
.pivot-table-lab__ghost-button,
.pivot-table-lab__tag {
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #303133;
  border-radius: 8px;
  padding: 4px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.pivot-table-lab__mode-button.active {
  background: #2f7df4;
  color: #fff;
  border-color: #2f7df4;
}

.pivot-table-lab__tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;

  small {
    color: inherit;
    opacity: 0.8;
  }

  &.is-active {
    border-color: #2f7df4;
    color: #2f7df4;
  }

  &.is-empty {
    border-color: #e25454;
    color: #e25454;
  }

  &.is-current {
    background: #f3f8ff;
  }
}

.pivot-table-lab__panel {
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  background: #fff;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pivot-table-lab__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pivot-table-lab__panel-actions,
.pivot-table-lab__dimension-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pivot-table-lab__filter-values,
.pivot-table-lab__dimension-section {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
}

.pivot-table-lab__checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #303133;
  font-size: 13px;
}

.pivot-table-lab__dimension-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.pivot-table-lab__config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.pivot-table-lab__dimension-section {
  align-items: flex-start;
  flex-direction: column;
}

.pivot-table-lab__config-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pivot-table-lab__radio-group {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.pivot-table-lab__dimension-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f7f9fc;
  border: 1px solid #edf1f7;
  box-sizing: border-box;
}

.pivot-table-lab__cell {
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;

  &.is-right {
    justify-content: flex-end;
  }

  &.is-summary {
    font-weight: 600;
  }
}
</style>
