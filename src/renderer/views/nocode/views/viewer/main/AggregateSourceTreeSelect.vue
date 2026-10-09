<template>
  <el-popover
    v-model:visible="popoverVisible"
    placement="bottom-start"
    trigger="click"
    :width="240"
    :offset="8"
    :show-arrow="false"
    popper-class="aggregate-source-tree-select-popper"
  >
    <template #reference>
      <div class="aggregate-source-tree-select__reference">
        <slot>
          <button class="aggregate-source-tree-select__trigger" type="button" :disabled="disabled">
            <el-icon><i-ep-plus /></el-icon>
            {{ buttonText || $t('AggregateSourceTreeSelect.addSource') }}
          </button>
        </slot>
      </div>
    </template>

    <div class="aggregate-source-tree-select">
      <div class="aggregate-source-tree-select__search">
        <el-input
          v-model="searchValue"
          clearable
          :placeholder="$t('AggregateSourceTreeSelect.searchPlaceholder')"
        >
          <template #prefix>
            <el-icon><i-ep-search /></el-icon>
          </template>
        </el-input>
      </div>

      <el-scrollbar class="aggregate-source-tree-select__scroll">
        <el-tree
          ref="treeRef"
          :data="treeData"
          node-key="key"
          :props="treeProps"
          :indent="28"
          :filter-node-method="filterTreeNode"
          :expand-on-click-node="false"
          :default-expand-all="true"
          :empty-text="$t('AggregateSourceTreeSelect.emptyText')"
          class="aggregate-source-tree-select__tree"
        >
          <template #default="{ data }">
            <div
              class="aggregate-source-tree-node"
              :class="{
                'is-group': data.type === 'group',
                'is-table': data.type === 'table',
                'is-sub-table': data.type === 'subTable',
                'is-checked': isNodeChecked(data),
                'is-disabled': isNodeDisabled(data),
                'has-children': Boolean(data.children?.length),
              }"
            >
              <el-checkbox
                v-if="isSelectableNode(data)"
                :model-value="isNodeChecked(data)"
                :disabled="isNodeDisabled(data)"
                @update:model-value="value => handleNodeCheckChange(data, value)"
                @click.stop
              />
              <span v-else class="aggregate-source-tree-node__checkbox-placeholder"></span>

              <span class="aggregate-source-tree-node__label" :title="data.label">
                {{ data.label }}
              </span>
            </div>
          </template>
        </el-tree>
      </el-scrollbar>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { AggregateSourceTable } from '@common/types/nocode';
import { deepClone } from '@common/utils/object';
import type { TreeInstance } from 'element-plus';
import { computed, nextTick, ref, watch } from 'vue';
import type { AggregateSourceTreeNode } from './aggregateTableSettingContext';

const props = withDefaults(defineProps<{
  value?: AggregateSourceTable[],
  treeData?: AggregateSourceTreeNode[],
  buttonText?: string,
  disabled?: boolean,
}>(), {
  value: () => [],
  treeData: () => [],
  disabled: false,
});

const emit = defineEmits<{
  (event: 'update', value: AggregateSourceTable[]): void,
}>();

const treeRef = ref<TreeInstance>();
const popoverVisible = ref(false);
const searchValue = ref('');
const draftSourceTables = ref<AggregateSourceTable[]>([]);
const treeProps = {
  children: 'children',
  label: 'label',
};

const createId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const isSelectableNode = (node: AggregateSourceTreeNode) => node.type === 'table' || node.type === 'subTable';
const buildSourceKey = (connectionUID?: string | null, tableUID?: string | null) => `${connectionUID || ''}::${tableUID || ''}`;
const flattenSelectableNodes = (nodes: AggregateSourceTreeNode[]) => nodes.reduce((result, item) => {
  if (isSelectableNode(item)) result.push(item);
  if (item.children?.length) result.push(...flattenSelectableNodes(item.children));
  return result;
}, [] as AggregateSourceTreeNode[]);
const matchesKeyword = (node: AggregateSourceTreeNode, keyword: string): boolean => {
  if (node.label.toLowerCase().includes(keyword)) return true;
  return Boolean(node.children?.some(child => matchesKeyword(child, keyword)));
};

const selectableNodes = computed(() => flattenSelectableNodes(props.treeData || []));
const tableNodes = computed(() => selectableNodes.value.filter(item => item.type === 'table'));
const selectedSourceMap = computed(() => draftSourceTables.value.reduce<Record<string, AggregateSourceTable>>((result, item) => {
  if (!item.connectionUID || !item.tableUID) return result;
  const sourceKey = buildSourceKey(item.connectionUID, item.tableUID);
  const currentItem = result[sourceKey];
  if (!currentItem || item.subTableUID) result[sourceKey] = item;
  return result;
}, {}));

const filterTreeNode = (value: string, data: AggregateSourceTreeNode) => {
  const keyword = value.trim().toLowerCase();
  if (!keyword) return true;
  return matchesKeyword(data, keyword);
};
const isNodeChecked = (node: AggregateSourceTreeNode) => {
  if (!node.connectionUID || !node.tableUID) return false;
  const selectedSource = selectedSourceMap.value[buildSourceKey(node.connectionUID, node.tableUID)];
  if (!selectedSource) return false;
  if (node.type === 'table') return true;
  if (node.type === 'subTable') return selectedSource.subTableUID === node.subTableUID;
  return false;
};
const isNodeDisabled = (node: AggregateSourceTreeNode) => {
  if (node.type !== 'subTable' || !node.connectionUID || !node.tableUID) return false;
  const selectedSource = selectedSourceMap.value[buildSourceKey(node.connectionUID, node.tableUID)];
  if (!selectedSource) return true;
  return Boolean(selectedSource.subTableUID && selectedSource.subTableUID !== node.subTableUID);
};
const buildSourceTablesByMap = (sourceMap: Record<string, AggregateSourceTable>) => tableNodes.value
  .map(item => (item.connectionUID && item.tableUID) ? sourceMap[buildSourceKey(item.connectionUID, item.tableUID)] : null)
  .filter((item): item is AggregateSourceTable => !!item)
  .map(item => ({
    uid: item.uid,
    connectionUID: item.connectionUID || null,
    tableUID: item.tableUID || null,
    subTableUID: item.subTableUID || null,
    filterRule: item.filterRule ? deepClone(item.filterRule) : undefined,
  }));

const handleNodeCheckChange = (node: AggregateSourceTreeNode, value: unknown) => {
  if (!isSelectableNode(node) || isNodeDisabled(node) || !node.connectionUID || !node.tableUID) return;
  const nextSourceMap = draftSourceTables.value.reduce<Record<string, AggregateSourceTable>>((result, item) => {
    if (!item.connectionUID || !item.tableUID) return result;
    const nextItem = {
      ...item,
      connectionUID: item.connectionUID || null,
      tableUID: item.tableUID || null,
      subTableUID: item.subTableUID || null,
    };
    const sourceKey = buildSourceKey(item.connectionUID, item.tableUID);
    const currentItem = result[sourceKey];
    if (!currentItem || item.subTableUID) result[sourceKey] = nextItem;
    return result;
  }, {});
  const sourceKey = buildSourceKey(node.connectionUID, node.tableUID);
  const currentSource = nextSourceMap[sourceKey];

  if (node.type === 'table') {
    if (value) {
      nextSourceMap[sourceKey] = currentSource || {
        uid: createId('source'),
        connectionUID: node.connectionUID,
        tableUID: node.tableUID,
        subTableUID: null,
      };
    } else {
      delete nextSourceMap[sourceKey];
    }
  } else {
    if (!currentSource) return;
    nextSourceMap[sourceKey] = {
      ...currentSource,
      subTableUID: value ? (node.subTableUID || null) : null,
    };
  }

  draftSourceTables.value = buildSourceTablesByMap(nextSourceMap);
  emit('update', deepClone(draftSourceTables.value));
};

watch(() => props.value, value => {
  draftSourceTables.value = deepClone(value || []);
}, { deep: true, immediate: true });

watch(searchValue, value => {
  treeRef.value?.filter(value);
});

watch(popoverVisible, visible => {
  if (visible) {
    nextTick(() => {
      treeRef.value?.filter(searchValue.value);
    });
    return;
  }
  searchValue.value = '';
});
</script>

<style scoped lang="scss">
.aggregate-source-tree-select__reference {
  display: inline-flex;
}

.aggregate-source-tree-select__trigger {
  padding: 0;
  border: none;
  background: transparent;
  color: #1677ff;
  font-size: 13px;
  line-height: 20px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.aggregate-source-tree-select__trigger:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}

.aggregate-source-tree-select {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.aggregate-source-tree-select__search {
  padding: 0 5px;
}

.aggregate-source-tree-select__scroll {
  flex: 1;
  min-height: 0;
  height: 0;
}

.aggregate-source-tree-node {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  width: 100%;
  min-height: 36px;
  padding: 0 12px 0 8px;
  box-sizing: border-box;
  transition: color 0.2s ease;
}

.aggregate-source-tree-node.is-group {
  padding-left: 4px;
}

.aggregate-source-tree-node.is-group .aggregate-source-tree-node__label {
  color: #303133;
  font-weight: 600;
}

.aggregate-source-tree-node.is-table .aggregate-source-tree-node__label,
.aggregate-source-tree-node.is-sub-table .aggregate-source-tree-node__label {
  font-weight: 500;
}

.aggregate-source-tree-node.is-disabled .aggregate-source-tree-node__label {
  color: #c5ccda;
}

.aggregate-source-tree-node__checkbox-placeholder {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}

.aggregate-source-tree-node__label {
  min-width: 0;
  color: #303133;
  font-size: 15px;
  line-height: 22px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<style lang="scss">
.aggregate-source-tree-select-popper {
  height: 410px !important;
  box-sizing: border-box;
  padding: 5px 0 5px !important;
  border: 1px solid #e8edf5 !important;
  border-radius: 8px !important;
  background: #ffffff !important;
  box-shadow: 0 8px 24px rgba(31, 35, 41, 0.12) !important;
  overflow: hidden;

  .el-input__wrapper {
    height: 36px;
    padding: 0 12px;
    border-radius: 4px;
    background: #f5f7fb;
    box-shadow: none;

    &:hover {
      box-shadow: none;
    }

    &.is-focus {
      box-shadow: 0 0 0 1px #1677ff inset !important;
    }
  }

  .el-input__prefix-inner {
    color: #98a2b3;
    font-size: 16px;
  }

  .el-input__inner {
    font-size: 14px;
    color: #303133;

    &::placeholder {
      color: #b8bfcc;
    }
  }

  .el-scrollbar__view {
    padding: 5px;
  }

  .el-scrollbar {
    height: 100%;
  }

  .el-scrollbar__wrap {
    overflow-x: hidden;
    margin-top: 4px;
  }

  .el-tree {
    background: transparent;
    --el-tree-node-hover-bg-color: transparent;
  }

  .el-tree-node {
    width: 100%;
  }

  .el-tree-node:focus > .el-tree-node__content,
  .el-tree-node.is-current > .el-tree-node__content {
    background: transparent;
  }

  .el-tree-node__content {
    height: 36px;
    padding: 0 4px 0 0;
    border-radius: 4px;
    width: 100%;
    box-sizing: border-box;

    &:hover {
      background: #f5f7fb;
    }
  }

  .el-tree-node__expand-icon {
    margin-right: 2px;
    color: #c0c7d4;
    font-size: 12px;
  }

  .el-scrollbar__bar.is-vertical {
    width: 6px;
    right: 2px;
  }

  .el-scrollbar__thumb {
    background-color: rgba(143, 149, 163, 0.35);
  }

  .el-checkbox {
    --el-checkbox-input-width: 16px;
    --el-checkbox-input-height: 16px;
    --el-checkbox-border-radius: 4px;
    --el-checkbox-checked-bg-color: #1677ff;
    --el-checkbox-checked-input-border-color: #1677ff;
    --el-checkbox-input-border-color: #cfd6e4;
    margin-right: 0;
  }

  .el-checkbox__label {
    display: none;
  }

  .el-checkbox__inner {
    border-radius: 4px;
  }

  .el-checkbox__input.is-disabled .el-checkbox__inner {
    background: #f0f3f8;
    border-color: #e2e7f0;
  }

  .el-checkbox__input.is-disabled + .el-checkbox__label {
    display: none;
  }
}
</style>
