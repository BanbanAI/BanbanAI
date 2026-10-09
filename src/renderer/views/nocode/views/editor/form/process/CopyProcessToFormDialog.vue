<template>
  <div class="copy-process-to-form-dialog">
    <el-dialog
      :model-value="modelValue"
      :title="$t('CopyProcessToFormDialog.title')"
      width="400px"
      align-center
      destroy-on-close
      @update:model-value="emit('update:modelValue', $event)"
      @close="emit('close')"
    >
      <p class="copy-process-to-form-dialog__tip">
        {{ $t('CopyProcessToFormDialog.tip') }}
      </p>
  
      <div class="copy-process-to-form-dialog__label">
        {{ $t('CopyProcessToFormDialog.selectTargetForm') }}
      </div>
  
      <el-input
        :model-value="keyword"
        class="copy-process-to-form-dialog__search"
        :placeholder="$t('CopyProcessToFormDialog.pleaseInput')"
        @update:model-value="emit('update:keyword', $event)"
      >
        <template #prefix>
          <el-icon :size="16">
            <i-ep-search />
          </el-icon>
        </template>
      </el-input>
  
      <div class="copy-process-to-form-dialog__tree">
        <el-scrollbar v-if="filteredTreeData.length" max-height="240px">
          <el-tree
            ref="treeRef"
            :data="filteredTreeData"
            node-key="id"
            :props="treeProps"
            :expand-on-click-node="false"
            :default-expand-all="true"
            :highlight-current="true"
            :current-node-key="selectedFormId || undefined"
            empty-text=""
            @node-click="handleNodeClick"
          >
            <template #default="{ data }">
              <div
                class="copy-process-to-form-dialog__tree-node"
                :class="[
                  `is-${data.nodeType}`,
                  {
                    'is-leaf': !data.children?.length,
                    'is-selected': selectedFormId === data.id,
                  },
                ]"
              >
                <span
                  class="copy-process-to-form-dialog__tree-icon"
                  :class="`is-${data.nodeType}`"
                  :style="getTreeIconStyle(data)"
                >
                  <template v-if="data.nodeType === 'app'">
                    <el-icon :size="16" v-if="data.snapshot?.icon">
                      <component :is="data.snapshot.icon" />
                    </el-icon>
                    <el-icon :size="16" v-else>
                      <i-ven-nocode-default-logo />
                    </el-icon>
                  </template>
                  <el-icon :size="20" v-else-if="data.nodeType === NocodeStructureType.GROUP">
                    <i-ven-global-page-folder />
                  </el-icon>
                  <el-icon :size="20" v-else>
                    <i-ven-global-page-form />
                  </el-icon>
                </span>
                <span class="copy-process-to-form-dialog__tree-label">{{ data.label }}</span>
              </div>
            </template>
          </el-tree>
        </el-scrollbar>
  
        <div v-else class="copy-process-to-form-dialog__empty">
          {{ $t('CopyProcessToFormDialog.noTargetForm') }}
        </div>
      </div>
  
      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ $t('CopyProcessToFormDialog.cancel') }}</el-button>
        <el-button type="primary" :loading="loading" @click="emit('confirm')">
          {{ $t('CopyProcessToFormDialog.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElTree } from 'element-plus';
import { NocodeStructureType, type NocodeBody, type NocodeStructure } from '@common/types/nocode';
import { computed, nextTick, ref, watch, type PropType } from 'vue';

type TargetFormOption = {
  id: string,
  name: string,
  nocodeId?: string,
  nocodeName?: string,
  table?: {
    uid?: string,
  },
  nocodeStructure?: NocodeStructure[],
  nocodeSnapshot?: NocodeBody['snapshot'],
};

type TreeNode = {
  id: string,
  label: string,
  keyword: string,
  nodeType: 'app' | 'group' | 'form',
  children?: TreeNode[],
  isLeaf?: boolean,
  snapshot?: NocodeBody['snapshot'],
};

defineOptions({
  name: 'CopyProcessToFormDialog',
});

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  keyword: {
    type: String,
    default: '',
  },
  loading: {
    type: Boolean,
    default: false,
  },
  selectedFormId: {
    type: String,
    default: '',
  },
  targetForms: {
    type: Array as PropType<TargetFormOption[]>,
    default: () => [],
  },
});

const emit = defineEmits([
  'update:modelValue',
  'update:keyword',
  'update:selected-form-id',
  'confirm',
  'close',
]);

const treeRef = ref<InstanceType<typeof ElTree> | null>(null);

const treeProps = {
  label: 'label',
  children: 'children',
};

const normalizedKeyword = computed(() => props.keyword.trim().toLowerCase());

const getTargetFormTableUID = (item: TargetFormOption) => {
  if (item.table?.uid) {
    return item.table.uid;
  }
  const idParts = String(item.id || '').split(':');
  return idParts.length > 1 ? idParts.slice(1).join(':') : item.id;
};

const createFormTreeNode = (item: TargetFormOption, appName: string): TreeNode => ({
  id: item.id,
  label: item.name,
  keyword: `${appName} ${item.name}`.toLowerCase(),
  nodeType: 'form',
  isLeaf: true,
});

const buildGroupTreeNodes = (
  structures: NocodeStructure[] = [],
  formMap: Map<string, TargetFormOption>,
  appId: string,
  appName: string,
  usedFormIdSet: Set<string>,
) => {
  return structures.reduce<TreeNode[]>((result, item) => {
    if (item.type === NocodeStructureType.PAGE) {
      result.push(...buildGroupTreeNodes(item.children || [], formMap, appId, appName, usedFormIdSet));
      return result;
    }

    if (item.type === NocodeStructureType.GROUP) {
      const children = buildGroupTreeNodes(item.children || [], formMap, appId, appName, usedFormIdSet);
      if (children.length) {
        result.push({
          id: `group:${appId}:${item.id}`,
          label: item.name,
          keyword: `${appName} ${item.name}`.toLowerCase(),
          nodeType: NocodeStructureType.GROUP,
          children,
        });
      }
      return result;
    }

    if (item.type === NocodeStructureType.FORM) {
      const targetForm = formMap.get(item.id);
      if (!targetForm) {
        return result;
      }
      usedFormIdSet.add(targetForm.id);
      result.push(createFormTreeNode(targetForm, appName));
    }
    return result;
  }, []);
};

const filterTreeNodes = (nodes: TreeNode[], keyword: string): TreeNode[] => {
  return nodes.reduce<TreeNode[]>((result, node) => {
    const matchedSelf = node.keyword.includes(keyword);
    if (!node.children?.length) {
      if (matchedSelf) {
        result.push(node);
      }
      return result;
    }

    const filteredChildren = filterTreeNodes(node.children, keyword);
    if (matchedSelf) {
      result.push({
        ...node,
        children: node.children,
      });
      return result;
    }

    if (filteredChildren.length) {
      result.push({
        ...node,
        children: filteredChildren,
      });
    }
    return result;
  }, []);
};

const collectLeafNodeIds = (nodes: TreeNode[], idSet = new Set<string>()) => {
  nodes.forEach((node) => {
    if (!node.children?.length) {
      idSet.add(node.id);
      return;
    }
    collectLeafNodeIds(node.children, idSet);
  });
  return idSet;
};

const treeData = computed<TreeNode[]>(() => {
  const nocodeMap = new Map<string, {
    appName: string,
    structure?: NocodeStructure[],
    forms: TargetFormOption[],
    snapshot?: NocodeBody['snapshot'],
  }>();

  props.targetForms.forEach((item) => {
    const appId = item.nocodeId || 'current';
    const appName = item.nocodeName || item.nocodeId || '';
    if (!nocodeMap.has(appId)) {
      nocodeMap.set(appId, {
        appName,
        structure: item.nocodeStructure,
        forms: [],
        snapshot: item.nocodeSnapshot,
      });
    }
    nocodeMap.get(appId)?.forms.push(item);
  });

  return Array.from(nocodeMap.entries()).reduce<TreeNode[]>((result, [appId, appData]) => {
    const formMap = new Map<string, TargetFormOption>();
    appData.forms.forEach((item) => {
      const tableUID = getTargetFormTableUID(item);
      if (tableUID) {
        formMap.set(tableUID, item);
      }
    });

    const usedFormIdSet = new Set<string>();
    const children = buildGroupTreeNodes(appData.structure || [], formMap, appId, appData.appName, usedFormIdSet);
    const remainingForms = appData.forms
      .filter(item => !usedFormIdSet.has(item.id))
      .map(item => createFormTreeNode(item, appData.appName));
    const treeChildren = [...children, ...remainingForms];

    if (!treeChildren.length) {
      return result;
    }

    result.push({
      id: `nocode:${appId}`,
      label: appData.appName,
      keyword: appData.appName.toLowerCase(),
      nodeType: 'app',
      children: treeChildren,
      snapshot: appData.snapshot,
    });
    return result;
  }, []);
});

const filteredTreeData = computed<TreeNode[]>(() => {
  const keyword = normalizedKeyword.value;
  if (!keyword) {
    return treeData.value;
  }

  return filterTreeNodes(treeData.value, keyword);
});

const visibleLeafNodeIdSet = computed(() => collectLeafNodeIds(filteredTreeData.value));

const syncCurrentKey = () => {
  treeRef.value?.setCurrentKey(props.selectedFormId || null);
};

const handleNodeClick = (data: TreeNode) => {
  if (!data.isLeaf) {
    nextTick(syncCurrentKey);
    return;
  }
  emit('update:selected-form-id', data.id);
};

const getTreeIconStyle = (data: TreeNode) => {
  if (data.nodeType === 'app' && data.snapshot?.color) {
    return {
      background: data.snapshot.color,
    };
  }
  return undefined;
};

watch(() => props.selectedFormId, () => nextTick(syncCurrentKey), { immediate: true });
watch(filteredTreeData, () => nextTick(syncCurrentKey));
watch(visibleLeafNodeIdSet, (currentVisibleLeafNodeIdSet) => {
  if (!props.selectedFormId || currentVisibleLeafNodeIdSet.has(props.selectedFormId)) {
    return;
  }
  emit('update:selected-form-id', '');
});
</script>

<style scoped lang="scss">
.copy-process-to-form-dialog  {
  :deep(.el-dialog) {
    background-color: #fff;
    border-radius: 8px;
    padding: 0;

    .el-dialog__header {
      padding: 12px 20px;
      border-bottom: 1px solid #edf1f6;
      text-align: center;

      .el-dialog__title {
        font-size: 16px;
        line-height: 24px;
      }
    }

    .el-dialog__body {
      padding: 20px 24px;
    }

    .el-dialog__footer {
      padding: 16px 20px;
      border-top: 1px solid #edf1f6;

      .el-button {
        border-radius: 4px;
      }
    }
  }
}

.copy-process-to-form-dialog__tip {
  margin: 0 0 24px;
  font-size: 14px;
  line-height: 22px;
  color: #86909c;
}

.copy-process-to-form-dialog__label {
  margin-bottom: 8px;
  font-size: 14px;
  line-height: 22px;
  color: #1d2129;
}

.copy-process-to-form-dialog__search {
  margin-bottom: 8px;

  :deep(.el-input__wrapper) {
    border-radius: 4px;
    background: #f2f3f5;
    box-shadow: none;
  }
}

.copy-process-to-form-dialog__tree {
  min-height: 240px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
}

.copy-process-to-form-dialog__tree-node {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 12px;

  &.is-app {
    font-weight: 500;
  }

  &.is-selected {
    background: #f2f3f5;
    border-radius: 4px;
  }
}

.copy-process-to-form-dialog__tree-icon {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #fff;

  &.is-app {
    background: linear-gradient(180deg, #69b1ff 0%, #2f7fff 100%);
  }
}

.copy-process-to-form-dialog__tree-label {
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  color: #1d2129;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copy-process-to-form-dialog__empty {
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #86909c;
  font-size: 14px;
  line-height: 22px;
}

:deep(.el-tree) {
  padding: 8px 0;
  background: transparent;
}

:deep(.el-tree-node__content) {
  height: 32px;
  border-radius: 4px;
  padding-right: 8px;
}

:deep(.el-tree-node__content:hover) {
  background: #f2f3f5;
}

:deep(.el-tree-node__expand-icon) {
  color: #86909c;
  font-size: 12px;
}

:deep(.el-tree--highlight-current .el-tree-node.is-current > .el-tree-node__content) {
  background: #f2f3f5;
}

:deep(.el-tree-node__children) {
  overflow: visible;
}
</style>
