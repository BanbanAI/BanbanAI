<template>
  <div v-loading="isLoading" class="cross-app-setting">
    <div class="selection-panel" :class="{ 'is-empty': !selectedFormsForDisplay.length }">
      <template v-if="selectedFormsForDisplay.length">
        <el-scrollbar>
          <div class="selected-form-list">
            <div v-for="item in selectedFormsForDisplay" :key="item.key" class="selected-form-tag">
              <div class="selected-form-tag__content">
                <img class="tag-icon" src="@renderer/assets/image/report-default-cover.png" alt="">
                <span :title="item.label">{{ item.label }}</span>
              </div>
              <el-icon class="tag-remove" @click="removeSelection(item.key)">
                <i-ep-close />
              </el-icon>
            </div>
          </div>
        </el-scrollbar>
      </template>
      <div v-else class="empty-selection-tip">
        {{ $t('CrossAppSetting.emptySelectionTip') }}
      </div>
    </div>

    <div class="search-box">
      <el-icon class="search-icon"><i-ep-search /></el-icon>
      <el-input v-model="keyword" :placeholder="$t('CrossAppSetting.searchPlaceholder')" clearable />
    </div>

    <div class="content-panel">
      <div class="app-panel">
        <el-scrollbar>
          <div v-if="filteredApps.length" class="app-list">
            <div
              v-for="app in filteredApps"
              :key="app.id"
              class="app-item"
              :class="{ active: activeAppId === app.id }"
              @click="activeAppId = app.id"
            >
              <div class="app-icon" :style="app.icon ? { background: app.color } : undefined">
                <el-icon v-if="app.icon">
                  <component :is="app.icon" />
                </el-icon>
                <el-image v-else loading="lazy" :src="getCoverImageURL(app.id)">
                  <template #error>
                    <img src="@renderer/assets/image/report-default-cover.png" alt="">
                  </template>
                </el-image>
              </div>
              <span :title="app.name">{{ app.name }}</span>
            </div>
          </div>
          <div v-else class="panel-empty">
            {{ $t('CrossAppSetting.noApps') }}
          </div>
        </el-scrollbar>
      </div>

      <div class="form-panel">
        <el-scrollbar>
          <div v-if="activeVisibleNodes.length" class="form-tree">
            <div
              v-for="node in activeVisibleNodes"
              :key="node.key"
              class="tree-row"
              :class="{
                'group-row': node.type === 'group',
                'form-row': node.type === 'form',
                checked: isNodeChecked(node),
              }"
              @click="handleNodeClick(node)"
            >
              <div class="tree-row__main">
                <div
                  class="tree-row__content"
                  :style="{ paddingLeft: `${12 + node.level * 28}px` }"
                >
                  <el-icon class="tree-icon" :size="20">
                    <i-nocode-page-folder v-if="node.type === 'group'" />
                    <i-nocode-page-form v-else />
                  </el-icon>
                  <span :title="node.label">{{ node.label }}</span>
                </div>
              </div>
              <div class="tree-row__check">
                <el-checkbox
                  :model-value="isNodeChecked(node)"
                  :indeterminate="isNodeIndeterminate(node)"
                  @click.stop
                  @change="(value: boolean) => handleNodeChange(node, value)"
                />
              </div>
            </div>
          </div>
          <div v-else class="panel-empty">
            {{ activeApp ? $t('CrossAppSetting.noForms') : $t('CrossAppSetting.noApps') }}
          </div>
        </el-scrollbar>
      </div>
    </div>

    <div class="bottom-container">
      <el-button type="primary" class="save-btn" @click="handleSave">
        {{ $t('CrossAppSetting.save') }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CrossAppFormSetting, CrossAppSettings, Nocode, NocodeBody, NocodeMeta, NocodeStructure, NocodeStructureType } from '@common/types/nocode';
import { Table, TableUID } from '@common/types/project';
import { useShareNocodeCacheStore } from '@renderer/stores';
import { NOCODE, NOCODE_ID, NOCODE_SIGN_IS_LATEST, ORGANIZE_UTIL } from '@renderer/types';
import { canReadNocodeTableDataByBody } from '@renderer/views/nocode/utils/data-permission';
import { ElMessage } from 'element-plus';
import axios from 'axios';
import i18next from 'i18next';
import { computed, inject, Ref, ref, watch } from 'vue';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';

type ShareNocode = {
  meta: NocodeMeta,
  body: NocodeBody,
};

type CrossAppFormNode = {
  key: string,
  type: 'form',
  label: string,
  level: number,
  nocodeId: string,
  tableUID: TableUID,
  descendantFormKeys: string[],
};

type CrossAppGroupNode = {
  key: string,
  type: 'group',
  label: string,
  level: number,
  children: CrossAppTreeNode[],
  descendantFormKeys: string[],
};

type CrossAppTreeNode = CrossAppGroupNode | CrossAppFormNode;
type CrossAppVisibleNode = CrossAppTreeNode;

type CrossAppApp = {
  id: string,
  name: string,
  color: string,
  icon?: string,
  nodes: CrossAppTreeNode[],
  formMap: Map<string, CrossAppFormNode>,
  searchText: string,
};

const APP_COLORS = [
  'linear-gradient(180deg, #4c8dff 0%, #2c6bff 100%)',
  'linear-gradient(180deg, #83d95a 0%, #47b548 100%)',
  'linear-gradient(180deg, #ffcc62 0%, #ff9f1a 100%)',
  'linear-gradient(180deg, #5ad7c4 0%, #14b8a6 100%)',
];

const emit = defineEmits<{
  (event: 'update-nocode'): void,
}>();

const nocode = inject<Ref<Nocode>>(NOCODE);
const nocodeId = inject<string>(NOCODE_ID)!;
const isChanged = inject<Ref<boolean>>('isChanged')!;
const organizeUtil = inject(ORGANIZE_UTIL, null);
const shareNocodeCacheStore = useShareNocodeCacheStore();

const isLoading = ref(false);
const keyword = ref('');
const activeAppId = ref('');
const apps = ref<CrossAppApp[]>([]);
const selectedKeys = ref<string[]>([]);
const savedKeys = ref<string[]>([]);
const isReady = ref(false);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null)

const formOptionMap = computed(() => {
  const map = new Map<string, CrossAppFormNode>();
  apps.value.forEach(app => {
    app.formMap.forEach((value, key) => {
      map.set(key, value);
    });
  });
  return map;
});

const filteredApps = computed(() => {
  const search = keyword.value.trim().toLowerCase();
  if (!search) {
    return apps.value;
  }
  return apps.value.filter(app => app.searchText.includes(search));
});

const activeApp = computed(() => {
  return filteredApps.value.find(app => app.id === activeAppId.value) || filteredApps.value[0];
});

const activeVisibleNodes = computed<CrossAppVisibleNode[]>(() => {
  if (!activeApp.value) {
    return [];
  }
  const search = keyword.value.trim().toLowerCase();
  const nodes = search ? filterTreeNodes(activeApp.value.nodes, search) : activeApp.value.nodes;
  return flattenTreeNodes(nodes);
});

const selectedFormsForDisplay = computed(() => {
  return selectedKeys.value.map(key => formOptionMap.value.get(key)).filter(Boolean) as CrossAppFormNode[];
});

const normalizedSelectedKeys = computed(() => {
  return [...selectedKeys.value].sort();
});

const getStoredCrossAppSettings = (): CrossAppSettings => {
  return nocode?.value?.body?.settings?.crossApp || {
    forms: [],
  };
};

const buildFormKey = (currentNocodeId: string, tableUID: TableUID) => {
  return `${currentNocodeId}:${tableUID}`;
};

const getStoredKeys = () => {
  return (getStoredCrossAppSettings().forms || []).map(item => buildFormKey(item.nocodeId, item.tableUID));
};

const flattenTreeNodes = (nodes: CrossAppTreeNode[]): CrossAppVisibleNode[] => {
  return nodes.reduce<CrossAppVisibleNode[]>((result, node) => {
    result.push(node);
    if (node.type === 'group') {
      result.push(...flattenTreeNodes(node.children));
    }
    return result;
  }, []);
};

const createFormNode = (appId: string, table: Table, level: number): CrossAppFormNode => {
  const key = buildFormKey(appId, table.uid);
  return {
    key,
    type: 'form',
    label: table.alias,
    level,
    nocodeId: appId,
    tableUID: table.uid,
    descendantFormKeys: [key],
  };
};

const createGroupNode = (key: string, label: string, level: number, children: CrossAppTreeNode[]): CrossAppGroupNode => {
  return {
    key,
    type: 'group',
    label,
    level,
    children,
    descendantFormKeys: children.flatMap(item => item.descendantFormKeys),
  };
};

const buildAppTree = (appId: string, structure: NocodeStructure[] = [], tables: Table[] = []) => {
  const formTables = tables.filter(table => !table.meta?.extra?.primaryTable);
  const formTableMap = new Map(formTables.map(table => [table.uid, table]));
  const visitedTableUIDs = new Set<TableUID>();

  const walk = (nodes: NocodeStructure[], level = 0, path = 'root'): CrossAppTreeNode[] => {
    return nodes.reduce<CrossAppTreeNode[]>((result, node, index) => {
      if (node.type === NocodeStructureType.PAGE) {
        result.push(...walk(node.children || [], level, `${path}-page-${index}`));
        return result;
      }

      if (node.type === NocodeStructureType.GROUP) {
        const children = walk(node.children || [], level + 1, `${path}-group-${index}`);
        if (children.length) {
          result.push(createGroupNode(`${appId}:group:${path}:${index}`, node.name, level, children));
        }
        return result;
      }

      if (node.type === NocodeStructureType.FORM) {
        const table = formTableMap.get(node.id);
        if (table) {
          visitedTableUIDs.add(table.uid);
          result.push(createFormNode(appId, table, level));
        }
      }

      return result;
    }, []);
  };

  const nodes = walk(structure);

  formTables.filter(table => !visitedTableUIDs.has(table.uid)).forEach(table => {
    nodes.push(createFormNode(appId, table, 0));
  });

  return nodes;
};

const filterTreeNodes = (nodes: CrossAppTreeNode[], search: string): CrossAppTreeNode[] => {
  return nodes.reduce<CrossAppTreeNode[]>((result, node) => {
    const labelMatched = node.label.toLowerCase().includes(search);
    if (node.type === 'form') {
      if (labelMatched) {
        result.push(node);
      }
      return result;
    }

    const filteredChildren = labelMatched ? node.children : filterTreeNodes(node.children, search);
    if (labelMatched || filteredChildren.length) {
      result.push(createGroupNode(node.key, node.label, node.level, filteredChildren));
    }
    return result;
  }, []);
};

const normalizeApp = (app: ShareNocode, index: number): CrossAppApp | null => {
  const tables = (app.body?.formData?.tables || []).filter(table => {
    if (table.meta?.extra?.primaryTable) {
      return false;
    }
    return canReadNocodeTableDataByBody(app.body, table.uid, organizeUtil?.departments || []);
  });
  const nodes = buildAppTree(app.meta.id, app.body?.structure || [], tables);
  if (!nodes.length) {
    return null;
  }

  const formMap = new Map<string, CrossAppFormNode>();
  flattenTreeNodes(nodes).forEach(node => {
    if (node.type === 'form') {
      formMap.set(node.key, node);
    }
  });

  const searchText = [
    app.meta.name,
    ...Array.from(formMap.values()).map(item => item.label),
  ].join(' ').toLowerCase();

  return {
    id: app.meta.id,
    name: app.meta.name,
    color: app.body?.snapshot?.color || APP_COLORS[index % APP_COLORS.length],
    icon: app.body?.snapshot?.icon,
    nodes,
    formMap,
    searchText,
  };
};

const getCoverImageURL = (currentNocodeId: string) => {
  return `project/get-nocode-snapshot/${currentNocodeId}`;
};

const syncSelectionState = () => {
  if (!isReady.value) {
    return;
  }
  isChanged.value = JSON.stringify(normalizedSelectedKeys.value) !== JSON.stringify(savedKeys.value);
};

const ensureActiveApp = () => {
  if (!filteredApps.value.length) {
    activeAppId.value = '';
    return;
  }
  if (!filteredApps.value.some(app => app.id === activeAppId.value)) {
    activeAppId.value = filteredApps.value[0].id;
  }
};

const isSelected = (key: string) => {
  return selectedKeys.value.includes(key);
};

const isNodeChecked = (node: CrossAppVisibleNode) => {
  return node.type === 'group' ? isGroupChecked(node) : isSelected(node.key);
};

const isNodeIndeterminate = (node: CrossAppVisibleNode) => {
  return node.type === 'group' ? isGroupIndeterminate(node) : false;
};

const updateSelectedKeys = (nextKeys: string[]) => {
  selectedKeys.value = [...new Set(nextKeys)];
};

const toggleForm = (node: CrossAppFormNode, force?: boolean) => {
  const shouldSelect = force ?? !isSelected(node.key);
  if (shouldSelect) {
    updateSelectedKeys([...selectedKeys.value, node.key]);
  } else {
    updateSelectedKeys(selectedKeys.value.filter(key => key !== node.key));
  }
};

const isGroupChecked = (node: CrossAppGroupNode) => {
  return node.descendantFormKeys.length > 0 && node.descendantFormKeys.every(key => selectedKeys.value.includes(key));
};

const isGroupIndeterminate = (node: CrossAppGroupNode) => {
  const checkedCount = node.descendantFormKeys.filter(key => selectedKeys.value.includes(key)).length;
  return checkedCount > 0 && checkedCount < node.descendantFormKeys.length;
};

const toggleGroup = (node: CrossAppGroupNode, force?: boolean) => {
  const shouldSelect = force ?? !isGroupChecked(node);
  if (shouldSelect) {
    updateSelectedKeys([...selectedKeys.value, ...node.descendantFormKeys]);
  } else {
    updateSelectedKeys(selectedKeys.value.filter(key => !node.descendantFormKeys.includes(key)));
  }
};

const removeSelection = (key: string) => {
  updateSelectedKeys(selectedKeys.value.filter(item => item !== key));
};

const handleNodeClick = (node: CrossAppVisibleNode) => {
  if (node.type === 'group') {
    toggleGroup(node);
  } else {
    toggleForm(node);
  }
};

const handleNodeChange = (node: CrossAppVisibleNode, value: boolean) => {
  if (node.type === 'group') {
    toggleGroup(node, value);
  } else {
    toggleForm(node, value);
  }
};

const handleSave = async () => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;

  const buildSettingsByType = () => {
    return normalizedSelectedKeys.value.map((key): CrossAppFormSetting => {
      const [currentNocodeId, tableUID] = key.split(':');
      return {
        nocodeId: currentNocodeId,
        tableUID: tableUID as TableUID,
      };
    });
  };

  const settings = {
    ...(nocode?.value?.body?.settings || {}),
    crossApp: {
      ...(getStoredCrossAppSettings() || {}),
      forms: buildSettingsByType(),
    },
  };

  const res = await axios.post('/project/save-nocode-settings', {
    nocodeId,
    settings,
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).then(data => {
    const { headers } = data
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
    return data;
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });

  if (!res) {
    return;
  }

  if (nocode?.value) {
    nocode.value.body.settings = settings;
  }
  savedKeys.value = [...normalizedSelectedKeys.value];
  isChanged.value = false;
  emit('update-nocode');
  ElMessage.success(i18next.t('CrossAppSetting.saveSuccess'));
};

const loadManageableApps = async () => {
  if (!nocodeId) {
    return;
  }

  isLoading.value = true;
  try {
    const response = await shareNocodeCacheStore.getShareNocodes().catch(() => []);

    apps.value = response
      .filter(item => item.meta?.id && item.meta.id !== nocodeId)
      .map((item, index) => normalizeApp(item, index))
      .filter(Boolean) as CrossAppApp[];

    const validKeySet = new Set(formOptionMap.value.keys());
    const storedKeys = getStoredKeys().filter(key => validKeySet.has(key));
    updateSelectedKeys(storedKeys);
    savedKeys.value = [...storedKeys].sort();
    ensureActiveApp();
    isReady.value = true;
    syncSelectionState();
  } finally {
    isLoading.value = false;
  }
};

watch(filteredApps, ensureActiveApp, {
  deep: true,
});

watch(normalizedSelectedKeys, syncSelectionState, {
  deep: true,
});

watch(() => nocode?.value?.meta?.id, async (value) => {
  if (!value) {
    return;
  }
  isReady.value = false;
  await loadManageableApps();
}, {
  immediate: true,
});

defineExpose({
  savePermissions: handleSave,
});
</script>

<style scoped lang="scss">
.cross-app-setting {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px;
  color: var(--text-color-primary);
}

.selection-panel {
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  background-color: var(--color-white);
  height: 128px;
  padding: 12px;
  margin-bottom: 12px;
  overflow: hidden;

  &.is-empty {
    min-height: 128px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :deep(.el-scrollbar) {
    height: 70px;
  }
}

.empty-selection-tip {
  font-size: 14px;
  line-height: 22px;
  color: var(--text-color-placeholder);
}

.selected-form-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
  padding-right: 4px;
}

.selected-form-tag {
  height: 28px;
  padding: 0 8px;
  border-radius: 4px;
  background-color: var(--bg-color-overlay);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 220px;

  &__content {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;

    span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      line-height: 22px;
    }
  }

  .tag-icon {
    width: 20px;
    height: 20px;
  }

  .tag-remove {
    color: var(--text-color-placeholder);
    cursor: pointer;
    flex-shrink: 0;
  }
}

.search-box {
  height: 36px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-radius: 4px;
  background-color: var(--bg-color-overlay);
  margin-bottom: 12px;

  .search-icon {
    color: var(--text-color-placeholder);
    margin-right: 8px;
    flex-shrink: 0;
  }

  :deep(.el-input) {
    .el-input__wrapper {
      box-shadow: none;
      padding: 0;
      background-color: transparent;
    }

    .el-input__inner {
      height: 22px;
      font-size: 14px;
      color: var(--text-color-primary);
    }
  }
}

.content-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--color-white);
}

.app-panel,
.form-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;

  :deep(.el-scrollbar) {
    height: 100%;
  }
}

.app-panel {
  border-right: 1px solid var(--border-color);
}

.app-list,
.form-tree {
  padding: 8px 0;
}

.app-item,
.tree-row {
  height: 36px;
  display: flex;
  align-items: center;
  padding-right: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: var(--bg-color-overlay);
  }

  &.active,
  &.checked {
    background-color: var(--bg-color-overlay);
  }
}

.app-item {
  padding-left: 12px;
  gap: 8px;

  .app-icon {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    color: var(--color-white);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    flex-shrink: 0;

    :deep(.el-image) {
      width: 100%;
      height: 100%;
      border-radius: 4px;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        border-radius: 4px;
        object-fit: cover;
      }
    }

    :deep(img) {
      width: 100%;
      height: 100%;
      border-radius: 4px;
      object-fit: cover;
    }
  }

  span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    line-height: 22px;
  }
}

.tree-row {
  gap: 12px;
  padding-right: 12px;

  &__main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  &__content {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
    gap: 8px;
    box-sizing: border-box;

    span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      line-height: 22px;
    }
  }

  &__check {
    width: 24px;
    flex: 0 0 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :deep(.el-checkbox) {
    flex-shrink: 0;
  }

  .tree-icon {
    flex-shrink: 0;
  }

  &.group-row {
    .tree-icon {
      color: #7ac943;
    }
  }

  &.form-row {
    .tree-icon {
      color: var(--color-primary);
    }
  }
}

.panel-empty {
  min-height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-color-placeholder);
  font-size: 14px;
  line-height: 22px;
}

.bottom-container {
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
  margin-top: 12px;
}
</style>
