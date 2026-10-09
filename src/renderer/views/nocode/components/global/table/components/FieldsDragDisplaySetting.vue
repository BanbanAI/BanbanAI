<template>
  <div class="fields-drag-display-setting">
    <!-- <el-input
      class="search-fields"
      v-model="searchValue"
      :placeholder="$t('FieldsDragDisplaySetting.searchField')"
    /> -->

    <div class="fields-drag-display-container">
      <el-scrollbar class="fields-scrollbar" noresize>
        <div v-if="displayColumns.length" class="fields-drag-display-list">
          <template v-if="isSearching || props.allowReorder === false">
            <div v-for="column in displayColumns" :key="column.uid" class="fields-drag-display-group">
              <div class="fields-drag-display-item" :class="{ hidden: isRootColumnHidden(column) }">
                <div class="prefix-icon" v-if="props.allowReorder">
                  <el-icon color="var(--text-color-secondary)" :size="16">
                    <i-icon-park-outline-drag />
                  </el-icon>
                </div>
                <div class="field-label">{{ column.alias }}</div>
                <div class="suffix-icon" @click.stop="toggleRootColumn(column)">
                  <el-icon v-if="isRootColumnHidden(column)" color="var(--text-color-secondary)" :size="16">
                    <i-ep-hide />
                  </el-icon>
                  <el-icon v-else color="var(--text-color-secondary)" :size="16">
                    <i-ep-view />
                  </el-icon>
                </div>
              </div>

              <div v-if="column.subColumns?.length" class="fields-sub-list">
                <div
                  v-for="subColumn in column.subColumns"
                  :key="subColumn.uid"
                  class="fields-drag-display-item sub-item"
                  :class="{ hidden: isColumnHidden(subColumn.uid) }"
                >
                  <div class="prefix-icon" v-if="props.allowReorder">
                    <el-icon color="var(--text-color-secondary)" :size="16">
                      <i-icon-park-outline-drag />
                    </el-icon>
                  </div>
                  <div class="field-label">{{ subColumn.alias }}</div>
                  <div class="suffix-icon" @click.stop="toggleSubColumn(column, subColumn)">
                    <el-icon v-if="isColumnHidden(subColumn.uid)" color="var(--text-color-secondary)" :size="16">
                      <i-ep-hide />
                    </el-icon>
                    <el-icon v-else color="var(--text-color-secondary)" :size="16">
                      <i-ep-view />
                    </el-icon>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <VueDraggable
            v-else
            v-model="draftColumns"
            item-key="uid"
            handle=".prefix-icon"
            animation="200"
            ghost-class="drag-ghost"
          >
            <template #item="{ element: group }">
              <div class="fields-drag-display-group">
                <div class="fields-drag-display-item" :class="{ hidden: isRootColumnHidden(group) }">
                  <div class="prefix-icon">
                    <el-icon color="var(--text-color-secondary)" :size="16">
                      <i-icon-park-outline-drag />
                    </el-icon>
                  </div>
                  <div class="field-label">{{ group.alias }}</div>
                  <div class="suffix-icon" @click.stop="toggleRootColumn(group)">
                    <el-icon v-if="isRootColumnHidden(group)" color="var(--text-color-secondary)" :size="16">
                      <i-ep-hide />
                    </el-icon>
                    <el-icon v-else color="var(--text-color-secondary)" :size="16">
                      <i-ep-view />
                    </el-icon>
                  </div>
                </div>

                <VueDraggable
                  v-if="group.subColumns?.length"
                  v-model="group.subColumns"
                  item-key="uid"
                  handle=".prefix-icon"
                  animation="200"
                  ghost-class="drag-ghost"
                  class="fields-sub-list"
                >
                  <template #item="{ element: subColumn }">
                    <div
                      class="fields-drag-display-item sub-item"
                      :class="{ hidden: isColumnHidden(subColumn.uid) }"
                    >
                      <div class="prefix-icon">
                        <el-icon color="var(--text-color-secondary)" :size="16">
                          <i-icon-park-outline-drag />
                        </el-icon>
                      </div>
                      <div class="field-label">{{ subColumn.alias }}</div>
                      <div class="suffix-icon" @click.stop="toggleSubColumn(group, subColumn)">
                        <el-icon v-if="isColumnHidden(subColumn.uid)" color="var(--text-color-secondary)" :size="16">
                          <i-ep-hide />
                        </el-icon>
                        <el-icon v-else color="var(--text-color-secondary)" :size="16">
                          <i-ep-view />
                        </el-icon>
                      </div>
                    </div>
                  </template>
                </VueDraggable>
              </div>
            </template>
          </VueDraggable>
        </div>

        <div v-else class="fields-empty">{{ $t('FieldsDragDisplaySetting.noData') }}</div>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang='ts'>
import type { FormTableColumnOrder } from '@common/types/nocode';
import type { FieldUID, TableUID } from '@common/types/project';
import type { Column } from '../table';
import VueDraggable from 'vuedraggable';
import { computed, ref, watch } from 'vue';

const ROOT_GROUP_KEY = '__root__';

type DisplayColumn = Pick<Column, 'uid' | 'alias'> & {
  subColumns?: DisplayColumn[];
};

const props = defineProps<{
  active?: boolean,
  tableUid: TableUID,
  columns: Column[],
  allowReorder?: boolean,
}>();

const searchValue = ref('');
const draftColumns = ref<DisplayColumn[]>([]);
const hiddenColumnIds = ref<FieldUID[]>([]);

const buildDraftColumns = (columns: Column[]): DisplayColumn[] => {
  return columns.map((column) => ({
    uid: column.uid,
    alias: column.alias,
    subColumns: column.subColumns ? buildDraftColumns(column.subColumns) : undefined,
  }));
};

const isColumnHidden = (uid: FieldUID) => {
  return hiddenColumnIds.value.includes(uid);
};

const syncParentHiddenState = (parent: DisplayColumn) => {
  if (!parent.subColumns?.length) return;
  const allHidden = parent.subColumns.every((item) => isColumnHidden(item.uid));
  const hiddenSet = new Set(hiddenColumnIds.value);
  if (allHidden) {
    hiddenSet.add(parent.uid);
  } else {
    hiddenSet.delete(parent.uid);
  }
  hiddenColumnIds.value = Array.from(hiddenSet);
};

const isRootColumnHidden = (column: DisplayColumn) => {
  if (!column.subColumns?.length) {
    return isColumnHidden(column.uid);
  }
  return column.subColumns.every((item) => isColumnHidden(item.uid));
};

const toggleRootColumn = (column: DisplayColumn) => {
  const nextHidden = !isRootColumnHidden(column);
  const hiddenSet = new Set(hiddenColumnIds.value);
  if (!column.subColumns?.length) {
    if (nextHidden) {
      hiddenSet.add(column.uid);
    } else {
      hiddenSet.delete(column.uid);
    }
    hiddenColumnIds.value = Array.from(hiddenSet);
    return;
  }

  if (nextHidden) {
    hiddenSet.add(column.uid);
    column.subColumns.forEach((item) => hiddenSet.add(item.uid));
  } else {
    hiddenSet.delete(column.uid);
    column.subColumns.forEach((item) => hiddenSet.delete(item.uid));
  }
  hiddenColumnIds.value = Array.from(hiddenSet);
};

const toggleSubColumn = (parent: DisplayColumn, column: DisplayColumn) => {
  const hiddenSet = new Set(hiddenColumnIds.value);
  if (hiddenSet.has(column.uid)) {
    hiddenSet.delete(column.uid);
  } else {
    hiddenSet.add(column.uid);
  }
  hiddenColumnIds.value = Array.from(hiddenSet);
  syncParentHiddenState(parent);
};

const isSearching = computed(() => {
  return !!searchValue.value.trim();
});

const displayColumns = computed(() => {
  const keyword = searchValue.value.trim();
  if (!keyword) return draftColumns.value;

  return draftColumns.value.reduce<DisplayColumn[]>((result, column) => {
    if (column.alias?.includes(keyword)) {
      result.push(column);
      return result;
    }

    const matchedSubColumns = column.subColumns?.filter((item) => item.alias?.includes(keyword)) || [];
    if (matchedSubColumns.length) {
      result.push({
        ...column,
        subColumns: matchedSubColumns,
      });
    }

    return result;
  }, []);
});

const buildColumnOrders = (): FormTableColumnOrder => {
  const result: FormTableColumnOrder = {};
  result[ROOT_GROUP_KEY] = draftColumns.value.reduce<Record<FieldUID, number>>((prev, item, index) => {
    prev[item.uid] = index;
    return prev;
  }, {});

  for (const column of draftColumns.value) {
    if (!column.subColumns?.length) continue;
    result[column.uid] = column.subColumns.reduce<Record<FieldUID, number>>((prev, item, index) => {
      prev[item.uid] = index;
      return prev;
    }, {});
  }

  return result;
};

const getHiddenColumnIds = (): FieldUID[] => {
  const hiddenSet = new Set(hiddenColumnIds.value);
  for (const column of draftColumns.value) {
    if (!column.subColumns?.length) continue;
    const allHidden = column.subColumns.every((item) => hiddenSet.has(item.uid));
    if (allHidden) {
      hiddenSet.add(column.uid);
    } else {
      hiddenSet.delete(column.uid);
    }
  }
  return Array.from(hiddenSet);
};

const initValue = (nextHiddenColumnIds: FieldUID[] = []) => {
  draftColumns.value = buildDraftColumns(props.columns || []);
  hiddenColumnIds.value = [...nextHiddenColumnIds];
  for (const column of draftColumns.value) {
    syncParentHiddenState(column);
  }
};

const getValue = () => {
  return {
    hiddenColumnIds: getHiddenColumnIds(),
    columnOrders: buildColumnOrders(),
  };
};

watch(
  [() => props.columns, () => props.active],
  ([, active]) => {
    if (!active) return;
    initValue(hiddenColumnIds.value);
  },
  { immediate: true }
);

defineExpose({
  initValue,
  getValue,
});
</script>

<style lang="scss" scoped>
.fields-drag-display-setting {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;

  .search-fields {
    background-color: var(--bg-color-page);
    width: 100%;
    height: 32px;

    :deep(.el-input__wrapper) {
      box-shadow: unset;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }
  }

  .fields-drag-display-container {
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .fields-scrollbar {
    flex: 1;
    height: 100%;
    min-height: 0;
    margin-right: calc(var(--table-display-fields-popover-padding, 16px) * -1);

    :deep(.el-scrollbar__wrap) {
      overflow-x: hidden;
    }

    :deep(.el-scrollbar__view) {
      padding-right: calc(var(--table-display-fields-popover-padding, 16px) + 4px);
      box-sizing: border-box;
    }

    :deep(.el-scrollbar__bar.is-vertical) {
      right: 4px;
    }
  }

  .fields-drag-display-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fields-drag-display-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fields-sub-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-left: 20px;
  }

  .fields-drag-display-item {
    width: 100%;
    padding: 8px 4px;
    display: flex;
    align-items: center;
    min-height: 36px;
    border-radius: 4px;
    gap: 8px;
    box-sizing: border-box;

    &:hover {
      background-color: #f2f3f5;
    }

    &.sub-item {
      padding-left: 8px;
    }

    &.hidden {
      color: var(--text-color-secondary);
    }
  }

  .prefix-icon {
    cursor: move;
    display: flex;
    align-items: center;

    &.placeholder {
      width: 16px;
      cursor: default;
    }
  }

  .field-label {
    flex: 1;
    min-width: 0;
    word-break: break-all;
  }

  .suffix-icon {
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .fields-empty {
    width: 100%;
    display: flex;
    justify-content: center;
    color: var(--text-color-secondary);
    font-size: 13px;
    line-height: 20px;
  }

  :deep(.drag-ghost) {
    opacity: 0.5;
  }
}
</style>
