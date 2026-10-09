<template>
  <div class="workbench-ai-permission-manage" v-loading="isLoading">
    <div class="permission-card">


      <div class="permission-table-header">
        <div class="header-title app-title">{{ $t('workbenchAiPermissionManage.app') }}</div>
        <div class="header-title access-title">{{ $t('workbenchAiPermissionManage.aiAccessible') }}</div>
      </div>

      <div v-if="!canEdit" class="permission-readonly-tip">{{ $t('workbenchAiPermissionManage.noAiPermissionManagePermission') }}</div>

      <el-scrollbar class="permission-tree-wrapper">
        <el-tree
          class="permission-tree"
          node-key="key"
          :data="permissionTreeData"
          :props="treeProps"
          :default-expanded-keys="expandedKeys"
          :expand-on-click-node="false"
          :empty-text="$t('workbenchAiPermissionManage.emptyConfigurableApps')"
          @node-click="handleNodeClick"
        >
          <template #default="{ data }">
            <div class="permission-tree-node">
              <div class="node-content">
                <img v-if="data.type === 'app'" src="@renderer/assets/image/workbench/banban-app-icon.png" class="node-icon" />
                <img v-else-if="data.type === 'group'" src="@renderer/assets/image/workbench/banban-folder-icon.png" class="node-icon" />
                <img v-else src="@renderer/assets/image/workbench/banban-form-icon.png" class="node-icon" />
                <span class="node-label">{{ data.label }}</span>
              </div>

              <div class="checkbox-wrapper">
                <el-checkbox
                  class="permission-checkbox"
                  :model-value="checkedKeySet.has(data.key)"
                  :indeterminate="indeterminateKeySet.has(data.key)"
                  :disabled="isLoading || !canEdit"
                  @click.stop
                  @change="value => handleCheckChange(data, value)"
                >
                  <span class="checkbox-placeholder"></span>
                </el-checkbox>
              </div>
            </div>
          </template>
        </el-tree>
      </el-scrollbar>

      <div class="permission-footer">
        <el-button type="primary" :disabled="isLoading || isSaving || !canEdit" :loading="isSaving" @click="handleSave">{{ $t('workbenchAiPermissionManage.save') }}</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NocodeStructure, NocodeStructureType } from '@common/types/nocode';
import type { AiPermissionConfig } from '@common/types/project';
import type { NocodeUser } from '@common/types/account';
import { usePassportStore } from '@renderer/stores';
import axios from 'axios';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { computed, onMounted, ref } from 'vue';

type AiPermissionCatalogItem = {
  meta: {
    id: string,
    name: string,
  },
  body: {
    structure?: NocodeStructure[],
  },
};

type PermissionTreeNode = {
  key: string,
  label: string,
  type: 'app' | 'group' | 'form',
  appId: string,
  formId?: string,
  children?: PermissionTreeNode[],
};

type NormalizedAiPermissionConfig = {
  apps: Record<string, {
    allForms: boolean,
    formIds: string[],
  }>,
  updateTime?: number,
};

const passportState = usePassportStore();
const permissionTreeData = ref<PermissionTreeNode[]>([]);
const checkedKeys = ref<string[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);

const treeProps = {
  children: 'children',
  label: 'label',
};

const canEdit = computed(() => {
  return Boolean((passportState.account as NocodeUser)?.isAdmin);
});

const checkedKeySet = computed(() => new Set(checkedKeys.value));
const indeterminateKeySet = computed(() => {
  const nextIndeterminateKeys = new Set<string>();
  const currentCheckedKeySet = checkedKeySet.value;

  const walk = (node: PermissionTreeNode) => {
    if (!node.children?.length) {
      return {
        checked: currentCheckedKeySet.has(node.key),
        indeterminate: false,
      };
    }

    const childStates = node.children.map(walk);
    const checkedCount = childStates.filter(state => state.checked).length;
    const hasIndeterminateChild = childStates.some(state => state.indeterminate);
    const isChecked = childStates.length > 0 && checkedCount === childStates.length;
    const isIndeterminate = !isChecked && (checkedCount > 0 || hasIndeterminateChild);

    if (isIndeterminate) {
      nextIndeterminateKeys.add(node.key);
    }

    return {
      checked: isChecked,
      indeterminate: isIndeterminate,
    };
  };

  permissionTreeData.value.forEach(walk);
  return nextIndeterminateKeys;
});

const collectNodeKeys = (list: PermissionTreeNode[]) => {
  return list.reduce<string[]>((result, item) => {
    result.push(item.key);
    if (item.children?.length) {
      result.push(...collectNodeKeys(item.children));
    }
    return result;
  }, []);
};

const collectFormNodes = (list: PermissionTreeNode[]) => {
  return list.reduce<PermissionTreeNode[]>((result, item) => {
    if (item.type === 'form') {
      result.push(item);
      return result;
    }

    if (item.children?.length) {
      result.push(...collectFormNodes(item.children));
    }
    return result;
  }, []);
};

const normalizeCheckedKeys = (checkedSet: Set<string>, list: PermissionTreeNode[]) => {
  const walk = (node: PermissionTreeNode) => {
    if (!node.children?.length) {
      return checkedSet.has(node.key);
    }

    const childStates = node.children.map(walk);
    const isAllChildrenChecked = childStates.length > 0 && childStates.every(Boolean);
    if (isAllChildrenChecked) {
      checkedSet.add(node.key);
      return true;
    }

    checkedSet.delete(node.key);
    return false;
  };

  list.forEach(walk);
};

const buildStructureTreeData = (appId: string, structure: NocodeStructure[] = []) => {
  return structure.reduce<PermissionTreeNode[]>((result, item) => {
    if (!item?.id) {
      return result;
    }

    if (item.type === NocodeStructureType.GROUP) {
      const children = buildStructureTreeData(appId, item.children || []);
      if (children.length) {
        result.push({
          key: `group-${appId}-${item.id}`,
          appId,
          label: item.name,
          type: 'group',
          children,
        });
      }
      return result;
    }

    if (item.type === NocodeStructureType.FORM) {
      result.push({
        key: `form-${appId}-${item.id}`,
        appId,
        formId: item.id,
        label: item.name,
        type: 'form',
      });
    }

    return result;
  }, []);
};

const buildPermissionTreeData = (catalog: AiPermissionCatalogItem[]) => {
  return catalog.reduce<PermissionTreeNode[]>((result, item) => {
    const appId = String(item?.meta?.id || '').trim();
    if (!appId) {
      return result;
    }

    const children = buildStructureTreeData(appId, item.body?.structure || []);
    if (!children.length) {
      return result;
    }

    result.push({
      key: `app-${appId}`,
      appId,
      label: item.meta.name,
      type: 'app',
      children,
    });
    return result;
  }, []);
};

const normalizeAiPermissionConfig = (value?: AiPermissionConfig | null): NormalizedAiPermissionConfig => {
  const apps = Object.entries(value?.apps || {}).reduce<NormalizedAiPermissionConfig['apps']>((result, [appId, permission]) => {
    const normalizedAppId = String(appId || '').trim();
    if (!normalizedAppId) {
      return result;
    }

    const allForms = permission?.allForms === true;
    const formIds = Array.from(new Set(
      (Array.isArray(permission?.formIds) ? permission.formIds : [])
        .map(item => String(item || '').trim())
        .filter(Boolean),
    ));

    if (!allForms && !formIds.length) {
      return result;
    }

    result[normalizedAppId] = {
      allForms,
      formIds: allForms ? [] : formIds,
    };
    return result;
  }, {});

  return {
    apps,
    updateTime: Number(value?.updateTime || 0) || undefined,
  };
};

const isAiPermissionConfigured = (config?: Pick<AiPermissionConfig, 'apps' | 'updateTime'> | null) => {
  const updateTime = Number(config?.updateTime || 0);
  const hasExplicitApps = Object.keys(config?.apps || {}).some(appId => Boolean(String(appId || '').trim()));
  return hasExplicitApps || (Number.isFinite(updateTime) && updateTime > 0);
};

const buildCheckedKeysFromConfig = (config: NormalizedAiPermissionConfig, list: PermissionTreeNode[]) => {
  const nextCheckedKeys = new Set<string>();

  if (!isAiPermissionConfigured(config)) {
    collectNodeKeys(list).forEach(key => nextCheckedKeys.add(key));
    return Array.from(nextCheckedKeys);
  }

  list.forEach(appNode => {
    const appPermission = config.apps[appNode.appId];
    if (!appPermission) {
      return;
    }

    if (appPermission.allForms) {
      collectNodeKeys([appNode]).forEach(key => nextCheckedKeys.add(key));
      return;
    }

    const allowedFormIds = new Set(appPermission.formIds);
    collectFormNodes(appNode.children || []).forEach(node => {
      if (node.formId && allowedFormIds.has(node.formId)) {
        nextCheckedKeys.add(node.key);
      }
    });
  });

  normalizeCheckedKeys(nextCheckedKeys, list);
  return Array.from(nextCheckedKeys);
};

const buildAiPermissionConfig = (): AiPermissionConfig => {
  const apps = permissionTreeData.value.reduce<NonNullable<AiPermissionConfig['apps']>>((result, appNode) => {
    const formNodes = collectFormNodes(appNode.children || []);
    if (!formNodes.length) {
      return result;
    }

    const selectedFormIds = formNodes
      .filter(node => node.formId && checkedKeySet.value.has(node.key))
      .map(node => node.formId as string);

    if (!selectedFormIds.length) {
      return result;
    }

    result[appNode.appId] = {
      allForms: selectedFormIds.length === formNodes.length,
      formIds: selectedFormIds.length === formNodes.length ? [] : selectedFormIds,
    };
    return result;
  }, {});

  return {
    apps,
  };
};

const updateNodeCheckedState = (node: PermissionTreeNode, checked: boolean) => {
  const nextCheckedKeys = new Set(checkedKeys.value);
  const keys = collectNodeKeys([node]);

  keys.forEach(key => {
    if (checked) {
      nextCheckedKeys.add(key);
      return;
    }
    nextCheckedKeys.delete(key);
  });

  normalizeCheckedKeys(nextCheckedKeys, permissionTreeData.value);
  checkedKeys.value = Array.from(nextCheckedKeys);
};

const loadPermissionData = async () => {
  if (!canEdit.value) {
    permissionTreeData.value = [];
    checkedKeys.value = [];
    return;
  }

  isLoading.value = true;
  try {
    const [catalog, config] = await Promise.all([
      axios.get('/workbench/get-ai-permission-catalog').then(({ data }) => data as AiPermissionCatalogItem[]),
      axios.get('/workbench/get-ai-permission-config').then(({ data }) => data as AiPermissionConfig),
    ]);

    permissionTreeData.value = buildPermissionTreeData(catalog);
    checkedKeys.value = buildCheckedKeysFromConfig(normalizeAiPermissionConfig(config), permissionTreeData.value);
  } catch ({ response }) {
    ElMessage.error(response?.data?.message || i18next.t('workbenchAiPermissionManage.loadFailed'));
  } finally {
    isLoading.value = false;
  }
};

const handleCheckChange = (data: PermissionTreeNode, value: string | number | boolean) => {
  if (isLoading.value || !canEdit.value) {
    return;
  }
  updateNodeCheckedState(data, Boolean(value));
};

const handleNodeClick = (data: PermissionTreeNode) => {
  if (isLoading.value || !canEdit.value) {
    return;
  }
  updateNodeCheckedState(data, !checkedKeySet.value.has(data.key));
};

const handleSave = async () => {
  if (isLoading.value || isSaving.value || !canEdit.value) {
    return;
  }

  isSaving.value = true;
  try {
    const config = buildAiPermissionConfig();
    const { data } = await axios.post('/workbench/set-ai-permission-config', config);
    checkedKeys.value = buildCheckedKeysFromConfig(normalizeAiPermissionConfig(data as AiPermissionConfig), permissionTreeData.value);
    ElMessage.success(i18next.t('workbenchAiPermissionManage.saveSuccess'));
  } catch ({ response }) {
    ElMessage.error(response?.data?.message || i18next.t('workbenchAiPermissionManage.saveFailed'));
  } finally {
    isSaving.value = false;
  }
};

const expandedKeys = ref<string[]>([]);

onMounted(() => {
  if (!canEdit.value) {
    return;
  }
  void loadPermissionData();
});
</script>

<style scoped lang="scss">
.workbench-ai-permission-manage {
  width: 100%;
  height: 100%;
  
  .permission-card {
    width: 100%;
    height: 100%;
    background: #ffffff;
    padding-top: 12px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .permission-toolbar {
    display: none;
  }

  .permission-footer {
    padding: 16px;
    border-top: 1px solid #f2f3f5;
    display: flex;
    justify-content: flex-start;
    align-items: center;

    .el-button {
      padding: 0 16px;
      height: 36px;
      font-size: 14px;
      border-radius: 4px;
    }
  }

  .permission-table-header {
    height: 40px;
    padding: 0 18px 0 14px;
    margin: 0 16px;
    background: #f7f8fa;
    border-radius: 4px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .permission-readonly-tip {
    margin-top: 12px;
    padding: 10px 12px;
    color: #c45656;
    font-size: 13px;
    line-height: 20px;
    background: #fef0f0;
    border-radius: 4px;
  }

  .header-title {
    color: #4e5969;
    font-size: 14px;
    line-height: 22px;

    &.app-title {
      flex: 1;
    }
  }

  .access-title {
    width: 240px;
    flex-shrink: 0;
    text-align: left;
  }

  .permission-tree-wrapper {
    flex: 1;
    min-height: 0;
    margin: 0 16px;
  }

  :deep(.el-scrollbar__view) {
    min-height: 100%;
  }

  :deep(.permission-tree) {
    background: transparent;
    --el-tree-node-hover-bg-color: transparent;

    .el-tree-node {
      background: transparent;
    }

    .el-tree-node__content {
      height: 40px;
      margin: 0;
      padding-left: 0;
      padding-right: 18px;
      border-radius: 4px;

      &:hover {
        background: #f2f3f5;
      }
    }

    .el-tree-node__expand-icon {
      padding: 6px 0;
      margin-left: 12px;
      margin-right: 4px;
      font-size: 14px;
      color: #86909c;
      transition: transform 0.3s;

      &.expanded {
        transform: rotate(90deg);
      }
    }

    .el-tree-node__expand-icon.is-leaf {
      color: transparent;
    }
  }

  .permission-tree-node {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  .node-content {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .checkbox-wrapper {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .node-icon {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .node-label {
    color: #1d2129;
    font-size: 14px;
    line-height: 22px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :deep(.permission-checkbox.el-checkbox) {
    margin-right: 0;
    height: 16px;
    flex-shrink: 0;

    .el-checkbox__input {
      display: none;
    }

    .el-checkbox__label {
      width: 16px;
      height: 16px;
      padding-left: 0;
      display: inline-block;
      position: relative;
      background-image: url('@renderer/assets/image/checkbox-unselected.png');
      background-repeat: no-repeat;
      background-size: contain;
    }

    &.is-checked .el-checkbox__label {
      background-image: url('@renderer/assets/image/checkbox-selected.png');
    }

    &.is-disabled .el-checkbox__label {
      background-image: url('@renderer/assets/image/checkbox-unselected-disabled.png');
    }

    .el-checkbox__input.is-indeterminate + .el-checkbox__label::after {
      content: '';
      position: absolute;
      top: 7px;
      left: 3px;
      width: 10px;
      height: 2px;
      border-radius: 1px;
      background: #2f6bff;
    }

    .el-checkbox__input.is-indeterminate.is-disabled + .el-checkbox__label::after {
      background: #c0c4cc;
    }

    &.is-checked.is-disabled .el-checkbox__label {
      background-image: url('@renderer/assets/image/checkbox-selected-disabled.png');
    }
  }

  .checkbox-placeholder {
    display: block;
    width: 16px;
    height: 16px;
  }
}
</style>
