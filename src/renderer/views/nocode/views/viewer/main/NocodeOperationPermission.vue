<template>
  <div class="nocode-operation-permission">
    <div class="content">
      <div class="aside">
        <el-input
          v-model="searchVal"
          :placeholder="$t('NocodeViewPermission.searchKeyword')"
          :prefix-icon="Search"
        />
        <el-scrollbar class="scrollbar">
          <el-tree
            ref="treeRef"
            :data="filterFormTree"
            :filter-node-method="filterTree"
            :empty-text="$t('NocodeViewPermission.noContent')"
            :icon="ArrowDownBold"
            :indent="24"
            @node-click="handleNodeClick"
          >
            <template #default="{ node, data }">
              <div class="custom-tree-node" :class="{ active: activePageId === data.id }">
                <div :class="['node-icon', data.type]">
                  <el-icon size="20" v-if="!node.expanded && data.type === NocodeStructureType.GROUP">
                    <i-ven-global-page-folder />
                  </el-icon>
                  <el-icon size="20" v-else-if="node.expanded && data.type === NocodeStructureType.GROUP">
                    <i-ven-global-page-folder-open />
                  </el-icon>
                  <el-icon size="20" v-else>
                    <i-ven-global-page-form />
                  </el-icon>
                </div>
                <span :title="data.name">{{ data.name }}</span>
              </div>
            </template>
          </el-tree>
        </el-scrollbar>
      </div>

      <div class="line"></div>

      <div class="main" v-if="activePageId">
        <div class="main-aside">
          <div
            v-for="item in currentActions"
            :key="item.id"
            class="operation-item"
            :class="{ active: activeActionId === item.id }"
            @click="handleSelectAction(item.id)"
          >
            <div class="title" :title="item.display?.label || item.name">
              {{ item.display?.label || item.name }}
            </div>
            <div class="meta" :title="item.viewName">
              {{ item.viewName }}
            </div>
          </div>
        </div>

        <div class="line"></div>

        <div class="main-container" v-if="currentAction && currentPermission">
          <div class="title">{{ currentAction.name }}</div>
          <div v-if="currentAction.description?.trim()" class="description">{{ currentAction.description }}</div>
          <div class="permission-box">
            <member-range :data="currentPermission"></member-range>
          </div>
          <div class="tips">
            <el-icon><i-ep-warning /></el-icon>
            <span>{{ $t('NocodeOperationPermission.permissionTip') }}</span>
          </div>
        </div>

        <div v-else class="empty-box">
          {{ $t('NocodeViewPermission.noContent') }}
        </div>
      </div>

      <div v-else class="empty-box">
        {{ $t('NocodeViewPermission.noContent') }}
      </div>
    </div>
    <hr>
    <el-button class="save-button" @click="savePermissions" type="primary">
      {{ $t('NocodePagePermission.save') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, Ref, ref, toRaw, watch } from "vue";
import { ArrowDownBold, Search } from "@element-plus/icons-vue";
import { NOCODE, NOCODE_SIGN_IS_LATEST } from "@renderer/types";
import {
  NocodeStructureType,
  PermissionRangeType,
} from "@common/types/nocode";
import type {
  MemberRange as OperationMemberRange,
  NocodeStructure,
  ViewAction,
} from "@common/types/nocode";
import { deepClone, isEmpty } from "@common/utils/object";
import { debounce } from "lodash";
import { ElMessage } from "element-plus";
import axios from "axios";
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from "@renderer/utils/nocodeSyncMessage";
import i18next from "i18next";

type ActionWithView = ViewAction & {
  viewName: string,
  viewId: string,
}

const nocode = inject(NOCODE);
const isChanged = inject<Ref<boolean>>("isChanged");
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);

const operationPermissions = ref<Record<string, Record<string, OperationMemberRange>>>(
  deepClone(nocode.value.body.permissions?.operation || {})
);
const searchVal = ref("");
const treeRef = ref();
const activePageId = ref<string>("");
const activeActionId = ref<string>("");
const currentPermission = ref<OperationMemberRange | null>(null);
const isHydratingCurrentPermission = ref(false);

const createDefaultPermissionRange = (): OperationMemberRange => ({
  rangeType: PermissionRangeType.ALL,
  range: {
    departments: [],
    roles: [],
    users: [],
  },
});

const getStoredPermissionRange = (tableId: string, actionId: string) => {
  return operationPermissions.value[tableId]?.[actionId] || null;
};

const setStoredPermissionRange = (tableId: string, actionId: string, permission: OperationMemberRange) => {
  if (permission.rangeType !== PermissionRangeType.CUSTOM) {
    if (operationPermissions.value[tableId]?.[actionId]) {
      delete operationPermissions.value[tableId][actionId];
      if (isEmpty(operationPermissions.value[tableId])) {
        delete operationPermissions.value[tableId];
      }
    }
    return;
  }

  if (!operationPermissions.value[tableId]) {
    operationPermissions.value[tableId] = {};
  }
  operationPermissions.value[tableId][actionId] = deepClone(permission);
};

const getFormActions = (tableId: string) => {
  const actions = (nocode.value.body.views?.[tableId] || []).flatMap((view) => {
    return (view.actions || []).map((action) => ({
      ...action,
      viewName: view.name,
      viewId: view.uid,
    }));
  }) as ActionWithView[];

  const dedupedMap = new Map<string, ActionWithView>();
  for (const action of actions) {
    if (!action?.id) continue;
    if (!dedupedMap.has(action.id)) {
      dedupedMap.set(action.id, action);
    }
  }
  return Array.from(dedupedMap.values()).sort((left, right) => (left.order || 0) - (right.order || 0));
};

const filterFormTree = computed(() => {
  const structure = nocode.value.body.structure || [];

  function filterNode(node: NocodeStructure): NocodeStructure | null {
    const nextNode = { ...node, children: [] as NocodeStructure[] };
    let hasVisibleChild = false;

    if (node.children?.length) {
      for (const child of node.children) {
        const filteredChild = filterNode(child);
        if (filteredChild) {
          nextNode.children.push(filteredChild);
          hasVisibleChild = true;
        }
      }
    }

    if (node.type === NocodeStructureType.FORM) {
      return getFormActions(node.id).length > 0 ? nextNode : null;
    }

    if (hasVisibleChild) {
      return nextNode;
    }

    return null;
  }

  return structure.map(filterNode).filter(Boolean) as NocodeStructure[];
});

const findFirstFormNode = (tree: NocodeStructure[] = []): string => {
  for (const node of tree) {
    if (node.type === NocodeStructureType.FORM) {
      return node.id;
    }
    if (node.children?.length) {
      const childId = findFirstFormNode(node.children);
      if (childId) return childId;
    }
  }
  return "";
};

const hasFormNode = (tree: NocodeStructure[] = [], formId = ""): boolean => {
  if (!formId) {
    return false;
  }

  for (const node of tree) {
    if (node.type === NocodeStructureType.FORM && node.id === formId) {
      return true;
    }
    if (node.children?.length && hasFormNode(node.children, formId)) {
      return true;
    }
  }

  return false;
};

const currentActions = computed(() => {
  if (!activePageId.value) return [];
  return getFormActions(activePageId.value);
});

const currentAction = computed(() => {
  return currentActions.value.find((item) => item.id === activeActionId.value) || currentActions.value[0] || null;
});

const handleSelectAction = (actionId: string) => {
  activeActionId.value = actionId;
};

const handleNodeClick = (data: NocodeStructure) => {
  if (data.type !== NocodeStructureType.FORM) return;
  activePageId.value = data.id;
};

const filterTree = (value: string, data: Record<string, any>) => {
  if (!value) return true;
  return String(data.name || "").includes(value);
};

const debouncedFilter = debounce((value: string) => {
  treeRef.value?.filter(value);
}, 300);

watch(searchVal, (value) => {
  debouncedFilter(value);
});

watch(currentActions, (value) => {
  if (!value.length) {
    activeActionId.value = "";
    return;
  }
  if (!value.some((item) => item.id === activeActionId.value)) {
    activeActionId.value = value[0].id;
  }
}, { immediate: true, deep: true });

watch(filterFormTree, (value) => {
  if (!activePageId.value || !hasFormNode(value, activePageId.value)) {
    activePageId.value = findFirstFormNode(value);
  }
}, { immediate: true, deep: true });

watch(
  [activePageId, () => currentAction.value?.id],
  ([tableId, actionId]) => {
    isHydratingCurrentPermission.value = true;
    currentPermission.value = tableId && actionId
      ? deepClone(getStoredPermissionRange(tableId, actionId) || createDefaultPermissionRange())
      : null;
    isHydratingCurrentPermission.value = false;
  },
  { immediate: true }
);

watch(
  currentPermission,
  (value) => {
    if (isHydratingCurrentPermission.value || !value || !activePageId.value || !currentAction.value?.id) {
      return;
    }
    setStoredPermissionRange(activePageId.value, currentAction.value.id, value);
  },
  { deep: true, flush: "sync" }
);

watch(
  () => operationPermissions.value,
  () => {
    isChanged.value = true;
  },
  { deep: true, immediate: false }
);

const savePermissions = debounce(async () => {
  if (!isChanged.value) return;
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;

  nocode.value.body.permissions.operation = deepClone(toRaw(operationPermissions.value));

  const res = await axios.post("/project/save-nocode-permissions", {
    nocodeId: toRaw(nocode.value.meta.id),
    permissions: nocode.value.body.permissions.operation,
    permissionType: "operation",
  }, {
    headers: {
      "x-sign": nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });

  if (res) {
    ElMessage.success(i18next.t('NocodeOperationPermission.saveSuccess'));
    const mainSign = Array.isArray(res.headers?.["x-sign"]) ? res.headers["x-sign"][0] : res.headers?.["x-sign"];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
    isChanged.value = false;
  }
}, 500);

defineExpose({
  savePermissions,
});
</script>

<style lang="scss" scoped>
.nocode-operation-permission {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .content {
    width: 100%;
    height: 100%;
    display: flex;
    min-height: 0;
  }

  .aside {
    width: 300px;
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 16px;
    min-height: 0;

    :deep(.el-input) {
      height: 32px;

      .el-input__wrapper {
        background-color: var(--bg-color-overlay);
        box-shadow: unset;
        border-radius: 4px;
      }
    }

    .scrollbar {
      flex: 1;
      margin-top: 8px;
    }

    :deep(.el-tree) {
      .el-tree-node__content {
        height: 44px;

        &:hover {
          background-color: var(--bg-color-overlay) !important;
        }

        &:has(> .custom-tree-node.active) {
          background-color: var(--bg-color-overlay) !important;
        }
      }
    }

    .custom-tree-node {
      width: calc(100% - 16px);
      display: flex;
      align-items: center;

      .node-icon {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 8px;
        margin-left: 16px;
      }

      span {
        width: calc(100% - 44px);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
  }

  .line {
    height: 100%;
    border-left: 1px solid var(--border-color);
  }

  .main {
    flex: 1;
    display: flex;
    min-width: 0;
  }

  .main-aside {
    width: 220px;
    padding: 12px;
    overflow-y: auto;
    flex-shrink: 0;

    .operation-item {
      padding: 10px 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover,
      &.active {
        background-color: var(--bg-color-overlay);
      }

      .title {
        font-size: 14px;
        line-height: 20px;
        color: var(--text-color-regular);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .meta {
        margin-top: 4px;
        font-size: 12px;
        line-height: 18px;
        color: var(--text-color-secondary);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
    }
  }

  .main-container {
    flex: 1;
    padding: 16px;
    min-width: 0;

    .title {
      font-size: 16px;
      line-height: 24px;
      color: var(--text-color-regular);
      font-weight: 500;
    }

    .description {
      margin-top: 8px;
      font-size: 14px;
      line-height: 20px;
      color: var(--text-color-secondary);
    }

    .permission-box {
      margin-top: 24px;
    }

    .tips {
      margin-top: 16px;
      display: flex;
      align-items: center;
      font-size: 14px;
      line-height: 20px;
      color: var(--text-color-secondary);

      .el-icon {
        margin-right: 4px;
      }
    }
  }

  .empty-box {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-color-secondary);
    font-size: 14px;
  }

  hr {
    margin-top: auto;
    border: 0;
    border-top: 1px solid var(--border-color);
  }

  .save-button {
    margin: 16px;
    width: 60px;
    height: 32px;
    border-radius: 4px;
  }
}
</style>
