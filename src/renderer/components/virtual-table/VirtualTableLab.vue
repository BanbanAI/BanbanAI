<template>
  <div class="virtual-table-lab">
    <div class="virtual-table-lab__toolbar">
      <div class="virtual-table-lab__toolbar-left">
        <strong>Virtual Table Lab</strong>
        <span>用于验证 merge / frozen / overscan / fast scroll 行为</span>
      </div>
      <div class="virtual-table-lab__toolbar-actions">
        <button type="button" class="virtual-table-lab__button ghost" @click="scrollToTop">回到顶部</button>
        <button type="button" class="virtual-table-lab__button ghost" @click="scrollToStressMergeStart">定位大合并块</button>
        <button type="button" class="virtual-table-lab__button ghost" @click="scrollToStressMergeTail">定位合并块尾部</button>
        <button type="button" class="virtual-table-lab__button ghost" @click="scrollToMiddle">滚到中段</button>
        <button type="button" class="virtual-table-lab__button primary" @click="scrollToBottom">滚到底部</button>
      </div>
    </div>

    <div class="virtual-table-lab__summary">
      <span>rows: {{ rows.length }}</span>
      <span>merged roots: {{ mergedRootCount }}</span>
      <span>checked rows: {{ checkedCount }}</span>
      <span>utility mirror: {{ mirrorUtilitySpans ? "on" : "off" }}</span>
      <span>popup editors: 区域 / 负责人 / 状态</span>
      <span>stress merge: {{ VIRTUAL_TABLE_LAB_STRESS_MERGE.startIndex + 1 }} - {{ VIRTUAL_TABLE_LAB_STRESS_MERGE.startIndex + VIRTUAL_TABLE_LAB_STRESS_MERGE.rowSpan }}</span>
      <span v-if="virtualState">window: {{ virtualState.virtualWindow.start }} - {{ virtualState.virtualWindow.end }}</span>
      <span v-if="virtualState">scrollTop: {{ virtualState.scrollTop }}</span>
      <span v-if="virtualState">visible cols: {{ virtualState.visibleColumnKeys.length }}</span>
      <span v-if="virtualState">boundary cols: {{ virtualState.virtualWindowBoundaryColumnKeys?.join(", ") || "-" }}</span>
    </div>

    <virtual-table
      ref="tableRef"
      class="virtual-table-lab__table"
      :columns="columns"
      :rows="rows"
      row-key="id"
      :estimated-row-height="44"
      :min-row-height="32"
      :overscan="6"
      :header-height="42"
      :container-height="'100%'"
      :container-width="'100%'"
      :row-class-name="rowClassName"
      :get-cell-span="getCellSpan"
      :editable="true"
      edit-trigger="manual"
      :editor-registry="editorRegistry"
      :resolve-cell-editor="resolveCellEditor"
      :commit-cell-edit="commitCellEdit"
      @cell-click="handleCellClick"
      @cell-dblclick="handleCellDblClick"
      @column-width-change="handleColumnWidthChange"
    >
      <template #header-cell="{ column, isLeaf }">
        <template v-if="column.meta?.kind === 'selection' && isLeaf">
          <span class="virtual-table-lab__header-indicator">选择</span>
        </template>
        <template v-else-if="column.meta?.kind === 'action' && isLeaf">
          <span class="virtual-table-lab__header-indicator">动作区</span>
        </template>
        <template v-else>
          <div class="virtual-table-lab__header">
            <span>{{ column.title }}</span>
            <small v-if="isLeaf">{{ column.key }}</small>
          </div>
        </template>
      </template>

      <template #cell="{ row, column, rowIndex, editable, isEditing, startEdit, value }">
        <template v-if="column.meta?.kind === 'selection'">
          <button type="button" class="virtual-table-lab__check" @click.stop="toggleChecked(row)">
            <span class="virtual-table-lab__check-box" :class="{ checked: row.checked }">{{ row.checked ? "✓" : "" }}</span>
          </button>
        </template>

        <template v-else-if="column.meta?.kind === 'index'">
          <span class="virtual-table-lab__index">{{ rowIndex + 1 }}</span>
        </template>

        <template v-else-if="column.meta?.kind === 'action'">
          <div class="virtual-table-lab__actions">
            <button type="button" class="virtual-table-lab__button ghost" @click.stop="toggleChecked(row)">切换选中</button>
            <button type="button" class="virtual-table-lab__button ghost" @click.stop="duplicateRow(row)">复制</button>
          </div>
        </template>

        <template v-else>
          <button
            v-if="editable && !isEditing"
            type="button"
            class="virtual-table-lab__cell-button"
            @click.stop="startEdit()"
          >
            <span class="virtual-table-lab__cell-value">{{ value }}</span>
          </button>
          <div v-else class="virtual-table-lab__cell-content">
            <span class="virtual-table-lab__cell-value">{{ value }}</span>
          </div>
        </template>
      </template>
    </virtual-table>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import VirtualTable from "./VirtualTable.vue";
import { flattenVirtualColumns } from "./column-utils";
import {
  VIRTUAL_TABLE_LAB_STRESS_MERGE,
  createVirtualTableLabColumns,
  createVirtualTableLabRows,
  resolveVirtualTableLabCellEditor,
  resolveVirtualTableLabCellSpan,
  resolveVirtualTableLabRowClassName,
  virtualTableLabEditorRegistry,
  type VirtualTableLabRow,
} from "./VirtualTableLab.data";
import type { VirtualTableColumn } from "./types";

const columns = ref(createVirtualTableLabColumns());
const rows = ref(createVirtualTableLabRows());
const tableRef = ref<InstanceType<typeof VirtualTable> | null>(null);
const leafColumns = computed(() => flattenVirtualColumns(columns.value));
const virtualState = ref<any>(null);
const mirrorUtilitySpans = (() => {
  if (typeof window === "undefined") {
    return false;
  }
  const locationCandidates = [
    String(window.location.href || ""),
    String(window.location.hash || ""),
    String(window.location.search || ""),
  ];
  for (const candidate of locationCandidates) {
    if (/(?:[?&#]|&)labUtilityMirrorSpans=1(?:&|$)/.test(candidate)) {
      return true;
    }
  }
  return false;
})();
let scrollerElement: HTMLElement | null = null;
let bindScrollerTimer: number | null = null;
let syncVirtualStateFrame: number | null = null;

const checkedCount = computed(() => rows.value.filter((row) => row.checked).length);
const mergedRootCount = computed(() => {
  return rows.value.reduce((count, row, rowIndex) => {
    return count + leafColumns.value.reduce((columnCount, column) => {
      const span = resolveVirtualTableLabCellSpan(row, rowIndex, column, {
        mirrorUtilitySpans,
      });
      return columnCount + ((span.rowSpan > 1 || span.colSpan > 1) ? 1 : 0);
    }, 0);
  }, 0);
});

const rowClassName = (row: Record<string, any>) => {
  return resolveVirtualTableLabRowClassName(row as VirtualTableLabRow);
};

const getCellSpan = (
  row: Record<string, any>,
  rowIndex: number,
  column: VirtualTableColumn,
) => {
  return resolveVirtualTableLabCellSpan(row as VirtualTableLabRow, rowIndex, column, {
    mirrorUtilitySpans,
  });
};

const resolveCellEditor = (
  row: Record<string, any>,
  column: VirtualTableColumn,
) => {
  return resolveVirtualTableLabCellEditor(row as VirtualTableLabRow, column);
};

const commitCellEdit = async (payload: {
  row: Record<string, any>;
  column: VirtualTableColumn;
  nextValue: any;
}) => {
  const rowId = payload.row.id;
  const dataIndex = payload.column.dataIndex || payload.column.key;
  rows.value = rows.value.map((row) => {
    if (row.id !== rowId) {
      return row;
    }
    return {
      ...row,
      [dataIndex]: payload.nextValue,
    };
  });
  return {
    status: "patched" as const,
    row: rows.value.find((row) => row.id === rowId)!,
  };
};

const syncVirtualState = () => {
  virtualState.value = tableRef.value?.getVirtualState?.() || null;
};

const cancelQueuedVirtualStateSync = () => {
  if (syncVirtualStateFrame !== null) {
    window.cancelAnimationFrame(syncVirtualStateFrame);
    syncVirtualStateFrame = null;
  }
};

const queueVirtualStateSync = () => {
  syncVirtualState();
  cancelQueuedVirtualStateSync();
  syncVirtualStateFrame = window.requestAnimationFrame(() => {
    syncVirtualStateFrame = null;
    syncVirtualState();
    void nextTick().then(() => {
      syncVirtualState();
    });
  });
};

const bindScroller = () => {
  const nextScroller = tableRef.value?.getScroller?.() || null;
  if (!nextScroller) {
    if (bindScrollerTimer !== null) {
      window.clearTimeout(bindScrollerTimer);
    }
    bindScrollerTimer = window.setTimeout(() => {
      bindScrollerTimer = null;
      bindScroller();
    }, 120);
    return;
  }
  if (scrollerElement === nextScroller) {
    queueVirtualStateSync();
    return;
  }
  if (scrollerElement) {
    scrollerElement.removeEventListener("scroll", queueVirtualStateSync);
  }
  scrollerElement = nextScroller;
  if (scrollerElement) {
    scrollerElement.addEventListener("scroll", queueVirtualStateSync, { passive: true });
  }
  queueVirtualStateSync();
};

const toggleChecked = (targetRow: Record<string, any>) => {
  const nextTargetRow = targetRow as VirtualTableLabRow;
  rows.value = rows.value.map((row) => {
    if (row.id !== nextTargetRow.id) {
      return row;
    }
    return {
      ...row,
      checked: !row.checked,
    };
  });
};

const duplicateRow = (targetRow: Record<string, any>) => {
  const nextTargetRow = targetRow as VirtualTableLabRow;
  const cloneIndex = rows.value.findIndex((row) => row.id === nextTargetRow.id);
  if (cloneIndex < 0) {
    return;
  }
  const clone: VirtualTableLabRow = {
    ...nextTargetRow,
    id: `${nextTargetRow.id}-copy-${Date.now()}`,
    index: rows.value.length + 1,
    note: `${nextTargetRow.note} / 复制行`,
  };
  const nextRows = [...rows.value];
  nextRows.splice(cloneIndex + 1, 0, clone);
  rows.value = nextRows.map((row, index) => ({
    ...row,
    index: index + 1,
  }));
};

const scrollToTop = () => {
  const scroller = tableRef.value?.getScroller?.();
  scroller?.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

const scrollToMiddle = () => {
  const scroller = tableRef.value?.getScroller?.();
  if (!scroller) {
    return;
  }
  scroller.scrollTo({
    top: Math.max(0, Math.floor(scroller.scrollHeight * 0.45)),
    behavior: "smooth",
  });
};

const scrollToStressMergeStart = () => {
  tableRef.value?.scrollToRowIndex?.(VIRTUAL_TABLE_LAB_STRESS_MERGE.startIndex, {
    align: "start",
    behavior: "smooth",
  });
};

const scrollToStressMergeTail = () => {
  tableRef.value?.scrollToRowIndex?.(
    VIRTUAL_TABLE_LAB_STRESS_MERGE.startIndex + VIRTUAL_TABLE_LAB_STRESS_MERGE.rowSpan - 2,
    {
      align: "end",
      behavior: "smooth",
    },
  );
};

const scrollToBottom = () => {
  const scroller = tableRef.value?.getScroller?.();
  if (!scroller) {
    return;
  }
  scroller.scrollTo({
    top: scroller.scrollHeight,
    behavior: "smooth",
  });
};

const handleCellClick = (payload: { rowIndex: number; column: VirtualTableColumn }) => {
  if (payload.column.meta?.kind === "selection" || payload.column.meta?.kind === "action") {
    return;
  }
};

const handleCellDblClick = (payload: { row: Record<string, any> }) => {
  toggleChecked(payload.row as VirtualTableLabRow);
};

const handleColumnWidthChange = (payload: { column: VirtualTableColumn; width: number }) => {
  columns.value = columns.value.map((column) => {
    if (column.key === payload.column.key) {
      return {
        ...column,
        width: payload.width,
      };
    }
    if (!column.children?.length) {
      return column;
    }
    return {
      ...column,
      children: column.children.map((child) => {
        if (child.key !== payload.column.key) {
          return child;
        }
        return {
          ...child,
          width: payload.width,
        };
      }),
    };
  });
};

watch([rows, columns], () => {
  void nextTick().then(() => {
    bindScroller();
  });
}, { flush: "post" });

onMounted(() => {
  void nextTick().then(() => {
    bindScroller();
  });
});

onBeforeUnmount(() => {
  if (bindScrollerTimer !== null) {
    window.clearTimeout(bindScrollerTimer);
  }
  cancelQueuedVirtualStateSync();
  if (scrollerElement) {
    scrollerElement.removeEventListener("scroll", queueVirtualStateSync);
  }
});

defineExpose({
  getScroller: () => tableRef.value?.getScroller?.() || null,
  getVirtualState: () => tableRef.value?.getVirtualState?.() || null,
  scrollToTop,
  scrollToMiddle,
  scrollToBottom,
});

const editorRegistry = virtualTableLabEditorRegistry;
</script>

<style scoped lang="scss">
.virtual-table-lab {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.virtual-table-lab__toolbar,
.virtual-table-lab__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.virtual-table-lab__toolbar-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
  color: #303133;

  span {
    font-size: 12px;
    color: #909399;
  }
}

.virtual-table-lab__toolbar-actions,
.virtual-table-lab__summary,
.virtual-table-lab__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.virtual-table-lab__summary {
  flex-wrap: wrap;
  font-size: 12px;
  color: #606266;
}

.virtual-table-lab__table {
  flex: 1;
  min-height: 0;
}

.virtual-table-lab__header {
  display: flex;
  flex-direction: column;
  gap: 2px;

  small {
    color: #909399;
    font-size: 11px;
    font-weight: 400;
  }
}

.virtual-table-lab__header-indicator,
.virtual-table-lab__index,
.virtual-table-lab__cell-content,
.virtual-table-lab__cell-button,
.virtual-table-lab__check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100%;
}

.virtual-table-lab__cell-button,
.virtual-table-lab__check {
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.virtual-table-lab__cell-button {
  justify-content: flex-start;
}

.virtual-table-lab__cell-value {
  min-width: 0;
  text-align: left;
  white-space: normal;
  line-height: 1.5;
  word-break: break-word;
}

.virtual-table-lab__check-box {
  width: 16px;
  height: 16px;
  border: 1px solid #c0c4cc;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: transparent;
  font-size: 12px;

  &.checked {
    border-color: #409eff;
    background: #409eff;
    color: #fff;
  }
}

.virtual-table-lab__button {
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #303133;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;

  &.primary {
    border-color: #409eff;
    background: #409eff;
    color: #fff;
  }

  &.ghost {
    background: #fff;
  }
}

:deep(.is-row-checked .virtual-table__cell) {
  --virtual-table-row-background: #f5f9ff;
}

:deep(.is-row-opened .virtual-table__cell) {
  --virtual-table-row-background: #eef5ff;
}

:deep(.virtual-table-lab__textarea),
:deep(.virtual-table-lab__input),
:deep(.virtual-table-lab__select) {
  width: 100%;
  font: inherit;
  color: inherit;
  border: 1px solid #409eff;
  border-radius: 8px;
  padding: 6px 8px;
  background: #fff;
  outline: none;
}

:deep(.virtual-table-lab__textarea) {
  resize: vertical;
  min-height: 36px;
}

:deep(.virtual-table-lab__popup-editor) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 180px;
  padding: 8px;
  border: 1px solid #dcdfe6;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}

:deep(.virtual-table-lab__popup-actions) {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
