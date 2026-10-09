<template>
  <div class="nocode-view-permission">
    <div class="content">
      <div class="aside">
        <div class="project">
          <el-input
            v-model="searchVal"
            :placeholder="$t('NocodeViewPermission.searchKeyword')"
            :prefix-icon="Search"
          />

          <el-scrollbar class="scrollbar">
            <el-tree
              ref="treeRef"
              style="max-width: 600px"
              :data="filterFormTree"
              @node-click="handleNodeClick"
              :filter-node-method="filterTree"
              :empty-text="$t('NocodeViewPermission.noContent')"
              :icon="ArrowDownBold"
              :indent="24"
            >
              <template #default="{ node, data }">
                <div class="custom-tree-node" :class="{'active': activePageId === data.id}">
                  <div :class="['node-icon', data.type]">
                    <el-icon size="20" v-if="!node.expanded && data.type === NocodeStructureType.GROUP">
                      <i-ven-global-page-folder />
                    </el-icon>
                    <el-icon size="20" v-else-if="node.expanded && data.type === NocodeStructureType.GROUP">
                      <i-ven-global-page-folder-open />
                    </el-icon>
                    <el-icon size="20" v-else-if="data.type === NocodeStructureType.PAGE">
                      <i-ven-global-page-document />
                    </el-icon>
                    <el-icon size="20" v-else-if="data.type === NocodeStructureType.FORM">
                      <i-ven-global-page-form />
                    </el-icon>
                  </div>
                  <span :title="data.name">{{ data.name }}</span>
                </div>
              </template>
            </el-tree>
          </el-scrollbar>
        </div>
      </div>

      <div class="line"></div>

      <div class="main" v-if="activePageId && !isEmpty(viewPermissions[activePageId]) && !isEmpty(dataViewMenu)">
        <div class="main-aside">
          <div v-for="item in dataViewMenu" :key="item.uid" class="data-view-item" :title="item.name" :class="{'active': activeSettingView === item.uid}" @click="handleSettingView(item)">
            <el-icon :size="16">
              <i-ven-global-page-form v-if="item.type === ViewPermissionCategory.FORM"/>
              <i-workbench-table v-if="item.type === ViewPermissionCategory.TABLE"/>
              <i-ven-nocode-view-document v-if="item.type === ViewPermissionCategory.DOCUMENT"></i-ven-nocode-view-document>
              <i-icon-park-outline-category-management v-if="item.type === ViewPermissionCategory.CATEGORY"></i-icon-park-outline-category-management>
              <i-ven-nocode-setting-permission-view v-if="item.type === ViewPermissionCategory.ALBUM"></i-ven-nocode-setting-permission-view>
            </el-icon>
            <span>
              {{ item.name }}
            </span>
          </div>
        </div>

        <div class="line"></div>

        <div class="main-container">
          <div class="tab">
            <span :class="{ active: activeTab === 'view' }" @click="activeTab = 'view'">{{ $t('NocodeViewPermission.view') }}</span>
            <span v-if="isTableView" :class="{ active: activeTab === 'operation' }" @click="activeTab = 'operation'">{{ $t('NocodeViewPermission.operation') }}</span>
          </div>
          <div v-show="activeTab === 'view'">
            <div class="title">
              {{ $t('NocodeViewPermission.permissionRange') }}
            </div>
            <div class="button-box">
              <div class="radio">
                <el-radio-group v-model="currentViewPermission.get.rangeType">
                  <el-radio :value="PermissionRangeType.ALL" size="small">{{ $t('NocodeViewPermission.allViewMember') }}</el-radio>
                  <el-radio :value="PermissionRangeType.CUSTOM" size="small">{{ $t('NocodeViewPermission.custom') }} </el-radio>
                </el-radio-group>
              </div>
              <div
                class="clear-button"
                v-if="currentViewPermission.get.rangeType === PermissionRangeType.CUSTOM"
                @click="handleClear()"
              >
                <el-icon>
                  <i-ep-delete></i-ep-delete>
                </el-icon>
                <span>
                  {{ $t('NocodeViewPermission.clear') }}
                </span>
              </div>
              <div class="add-button" v-if="currentViewPermission.get.rangeType === PermissionRangeType.CUSTOM" @click="handleClickAdd">
                <span>
                  {{ $t('NocodeViewPermission.setRange') }}
                </span>
              </div>
            </div>
            <div class="tag-container" v-if="currentViewPermission.get.rangeType === PermissionRangeType.CUSTOM">
              <span v-if="isEmpty(currentViewPermission.get.range.departments) && isEmpty(currentViewPermission.get.range.roles) && isEmpty(currentViewPermission.get.range.users)">
                {{ $t('NocodeViewPermission.emptyAddFirst') }}<span class="add-text" @click="handleClickAdd">{{ $t('NocodeViewPermission.add') }}</span>
              </span>
              <div class="tag-box" v-else>
                <el-tag closable v-for="tag in currentViewPermission.get.range.departments" :key="tag" @close="closeTag(tag, 'departments')">
                  {{ getDepartmentName(tag) }}
                </el-tag>
                <el-tag closable v-for="tag in currentViewPermission.get.range.roles" :key="tag" @close="closeTag(tag, 'roles')">
                  {{ getRoleName(tag) }}
                </el-tag>
                <el-tag closable v-for="tag in currentViewPermission.get.range.users" :key="tag" @close="closeTag(tag, 'users')">
                  {{ getUserName(tag) }}
                </el-tag>
              </div>
            </div>
            <div class="tips" v-if="currentViewPermission.get.rangeType === PermissionRangeType.CUSTOM">
              <el-icon>
                <i-ep-warning />
              </el-icon>
              <span>
                {{ $t('NocodeViewPermission.adminAllAuthTip') }}
              </span>
            </div>
          </div>
          <div v-show="activeTab === 'operation'" class="view-operation-tab-content">
            <div class="head-container">
              <div class="left">
                <el-icon size="16"><i-ep-warning /></el-icon>
                <span>{{ $t('NocodeViewPermission.operationPermissionTip') }}</span>
              </div>
              <div class="right">
                <el-button type="primary" @click="addOperationGroup()">
                  <el-icon :size="16" style="margin-right: 4px;">
                    <i-ep-plus></i-ep-plus>
                  </el-icon>
                  {{ $t('NocodeViewPermission.addAuthGroup') }}
                </el-button>
              </div>
            </div>

            <view-operation-permission-group-form
              v-for="(item, index) in currentOperationGroups"
              :key="`${activeSettingView}-${index}`"
              :ref="(el: any) => operationGroupFormRef[index] = el"
              :form="item"
              class="operation-group-form"
              @delete="() => deleteOperationGroup(index as number)"
              @copy="() => copyOperationGroup(index as number)"
              @save="(value) => saveOperationGroup(value, index as number)"
            />

            <div v-if="hasOperationGroupsConfigured && !currentOperationGroups.length" class="empty-operation-group">
              {{ $t('NocodeViewPermission.noOperationGroupHidden') }}
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-box">
        {{ $t('NocodeViewPermission.noContent') }}
      </div>
    </div>
    <hr>
    <el-button class="save-button" @click="savePermissions" type="primary">{{ $t('NocodePagePermission.save') }}</el-button>
  </div>
  <nocode-user-select-dialog ref="userSelectRef" @save="handleSave"></nocode-user-select-dialog>
</template>

<script setup lang='ts'>
import { computed, inject, nextTick, Ref, ref, shallowRef, toRaw, watch } from 'vue';
import { ArrowDownBold, Search } from '@element-plus/icons-vue';
import { NOCODE, ORGANIZE_UTIL, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { NocodeStructure, NocodeStructureType, PermissionRangeType, ViewOperationPermissionGroup, ViewOperationPermissionKey, ViewPermissionCategory, ViewSetting } from '@common/types/nocode';
import i18next from 'i18next';
import { deepClone, equals, isEmpty } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import { debounce } from 'lodash';
import axios from "axios";
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { usePassportStore } from '@renderer/stores';
import { getVisibleViewsForCurrentAccount } from '@renderer/views/nocode/utils';
import { getUserDisplayName } from '@renderer/utils/other';

const viewPermissions = ref();
const nocode = inject(NOCODE);
const passportState = usePassportStore();
const searchVal = ref('');
const activePageId = ref();
const treeRef = ref(null);
const userSelectRef = ref(null);
const isChanged = inject<Ref<boolean>>('isChanged')
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);
const organizeUtil = inject(ORGANIZE_UTIL);
const skipViewPermissionChange = ref(true)
const activeTab = ref<'view' | 'operation'>('view');
const operationGroupFormRef = shallowRef([]);
const fallbackOperationGroups = shallowRef<ViewOperationPermissionGroup[]>([]);

const createDefaultViewOperationGroup = (): ViewOperationPermissionGroup => ({
  title: i18next.t('NocodeViewPermission.viewOperationPermissionInitTitle'),
  description: i18next.t('NocodeViewPermission.viewOperationPermissionInitDescription'),
  memberRange: {
    rangeType: PermissionRangeType.ALL,
    range: {
      departments: [],
      roles: [],
      users: [],
    },
  },
  handleRange: {
    [ViewOperationPermissionKey.IMPORT]: true,
    [ViewOperationPermissionKey.EXPORT]: true,
    [ViewOperationPermissionKey.BATCH_PRINT]: true,
    [ViewOperationPermissionKey.BATCH_UPDATE]: true,
    [ViewOperationPermissionKey.BATCH_DELETE]: true,
  },
});

function findFirstPageNode(tree) {
  for (const node of tree) {
    if (node.type === NocodeStructureType.FORM)   {
      return node.id;
    }
    if (node.children) {
      const found = findFirstPageNode(node.children);
      if (found) return found;
    }
  }
  return null;
}
const filterFormTree = computed(() => {
  const structure = nocode.value?.body?.structure || [];

  function filterNode(node: NocodeStructure): NocodeStructure | null {
    const newNode = { ...node, children: [] };
    let hasForm = false;

    if (node.children) {
      for (const child of node.children) {
        const filteredChild = filterNode(child);
        if (filteredChild) {
          newNode.children!.push(filteredChild);
          hasForm = true;
        }
      }
    }

    // 当前节点是 form 或者有 form 后代
    if (node.type === NocodeStructureType.FORM || hasForm) {
      return newNode;
    }
    return null;
  }

  return structure
    .map(node => filterNode(node))
    .filter(Boolean) as NocodeStructure[];
})

const handleNodeClick = (data) => {
  if (data.type !== NocodeStructureType.FORM) return;
  if (nocode.value?.body?.views?.[data.id]?.[0]) {
    handleSettingView(nocode.value.body.views[data.id][0]);
  }
  activePageId.value = data.id;
}

interface Tree {
  [key: string]: any
}

const filterTree = (value: string, data: Tree) => {
  if (!value) return true;
  return data.name.includes(value);
}

const debouncedFilter = debounce((val: string) => {
  treeRef.value?.filter(val);
}, 300);

watch(searchVal, (val) => {
  debouncedFilter(val);
});

const dataViewMenu = computed(() => {
  return getVisibleViewsForCurrentAccount({
    views: nocode.value?.body?.views?.[activePageId?.value],
    tableId: activePageId.value,
    permissions: nocode.value?.body?.permissions?.view,
    account: passportState.account,
    departments: organizeUtil.departments,
  });
});

const activeSettingView = ref(dataViewMenu.value?.[0]?.uid);
const currentViewSetting = computed(() => {
  return dataViewMenu.value?.find(view => view.uid === activeSettingView.value);
});
const isTableView = computed(() => currentViewSetting.value?.type === ViewPermissionCategory.TABLE);
const handleSettingView = (item: ViewSetting) => {
  activeSettingView.value = item.uid;
}

watch(
  () => nocode.value?.body,
  async (body) => {
    if (!body) {
      return
    }
    skipViewPermissionChange.value = true
    viewPermissions.value = deepClone(body.permissions?.view || {})
    activePageId.value = findFirstPageNode(filterFormTree.value)
    activeSettingView.value = body.views?.[activePageId.value]?.[0]?.uid
    await nextTick()
    isChanged.value = false
    skipViewPermissionChange.value = false
  },
  { immediate: true }
)

watch(
  [activePageId, dataViewMenu],
  ([pageId, views]) => {
    if (!pageId || isEmpty(views)) {
      activeSettingView.value = undefined
      return
    }
    if (!views.some(view => view.uid === activeSettingView.value)) {
      activeSettingView.value = views[0]?.uid
    }
  },
  { immediate: true }
)

const currentProject = computed(() => {
  return viewPermissions.value?.[activePageId.value]?.[activeSettingView.value];
})
const currentViewPermission = computed(() => currentProject.value);
const hasOperationGroupsConfigured = computed(() => Array.isArray(currentViewPermission.value?.operationGroups));
const currentOperationGroups = computed(() => {
  return hasOperationGroupsConfigured.value ? currentViewPermission.value.operationGroups : fallbackOperationGroups.value;
});

const getDepartmentName = (id: string) => {
  return organizeUtil.departments.find(item => item.id === id)?.name || id;
}

const getRoleName = (id: string) => {
  return organizeUtil.roles.find(item => item.id === id)?.name || id;
}

const getUserName = (id: string) => {
  return getUserDisplayName(organizeUtil.findUserById(id), id);
}

const handleClickAdd = () => {
  if (!currentViewPermission.value) {
    return
  }
  setTimeout(() => {
    userSelectRef.value.show(i18next.t('NocodeViewPermission.setRange'), currentViewPermission.value.get.range);
  }, 1);
}

const handleSave = (value) => {
  currentViewPermission.value.get.range = deepClone(value);
}

const handleClear = () => {
  if (!currentViewPermission.value) {
    return
  }
  currentViewPermission.value.get.range = {
    departments: [],
    roles:[],
    users: []
  }
  ElMessage.success(i18next.t('NocodeViewPermission.clearSuccess'));
}

const ensureOperationGroupsConfigured = () => {
  if (!currentViewPermission.value) {
    return [];
  }
  if (!Array.isArray(currentViewPermission.value.operationGroups)) {
    currentViewPermission.value.operationGroups = [];
  }
  return currentViewPermission.value.operationGroups;
}

const addOperationGroup = (group?: ViewOperationPermissionGroup) => {
  const operationGroups = ensureOperationGroupsConfigured();
  if (!operationGroups) {
    return;
  }
  operationGroups.unshift(group ?? createDefaultViewOperationGroup());
  nextTick(() => {
    operationGroupFormRef.value[0]?.handleEdit?.();
  });
}

const deleteOperationGroup = (index: number) => {
  const operationGroups = ensureOperationGroupsConfigured();
  operationGroups.splice(index, 1);
}

const copyOperationGroup = (index: number) => {
  addOperationGroup(deepClone(toRaw(currentOperationGroups.value[index])));
}

const saveOperationGroup = (value: ViewOperationPermissionGroup, index: number) => {
  if (!hasOperationGroupsConfigured.value && equals(value, fallbackOperationGroups.value[index])) {
    return;
  }
  const operationGroups = ensureOperationGroupsConfigured();
  operationGroups[index] = value;
}

const resetFallbackOperationGroups = () => {
  if (!isTableView.value || !currentViewPermission.value || hasOperationGroupsConfigured.value) {
    fallbackOperationGroups.value = [];
    return;
  }
  fallbackOperationGroups.value = [createDefaultViewOperationGroup()];
}

const savePermissions = debounce(async () => {
  if(!isChanged.value || !nocode.value?.body) return;

  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  nocode.value.body.permissions.view = deepClone(viewPermissions.value)
  const res = await axios.post("/project/save-nocode-permissions", {
    nocodeId: toRaw(nocode.value.meta.id),
    permissions: nocode.value.body.permissions.view,
    permissionType: 'view',
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
  if(res) {
    ElMessage.success(i18next.t('NocodeViewPermission.saveSuccess'));
    const mainSign = Array.isArray(res.headers?.['x-sign']) ? res.headers['x-sign'][0] : res.headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign
    }
    isChanged.value = false
  }
}, 500)

const closeTag = (tag, type) => {
  viewPermissions.value[activePageId.value][activeSettingView.value].get.range[type] = viewPermissions.value?.[activePageId.value]?.[activeSettingView.value].get.range[type].filter(item => item != tag)
}

watch(
  [activePageId, activeSettingView, isTableView],
  () => {
    if (!isTableView.value) {
      activeTab.value = 'view';
    }
    resetFallbackOperationGroups();
  },
  { immediate: true }
)

watch(
  hasOperationGroupsConfigured,
  () => {
    resetFallbackOperationGroups();
  },
  { immediate: true }
)

watch(
  () => viewPermissions.value,
  () => {
    if (skipViewPermissionChange.value) {
      return
    }
    isChanged.value = true
  },
  { deep: true, immediate: false }
)
</script>
  
<style lang="scss" scoped>
.nocode-view-permission {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  :deep(.el-button){
    border-radius: 4px;
  }

  .content {
    width: 100%;
    height: 100%;
    display: flex;
    min-height: 0;

    .aside {
      width: 300px;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 16px;
      min-height: 0;

      .project {
        flex: 1;
        display: flex;
        flex-direction: column;
        row-gap: 8px;
        overflow: hidden;
        min-height: 0;

        :deep(.el-input) {
          height: 32px;
          
          .el-input__wrapper {
            background-color: var(--bg-color-overlay);
            box-shadow: unset;
            border-radius: 4px;
          }
        }

        :deep(.el-tree) {
          .el-tree-node__content {
            width: 100%;
            height: 44px;
            line-height: 44px;
            transition: all 0.3s ease;

            .el-tree-node__expand-icon {
              position: absolute;
              right: 8px;

              &.expanded {
                transform: rotate(180deg);
              }
            }

            &:hover {
              background-color: var(--bg-color-overlay) !important;
            }

            &:has(> .custom-tree-node.active) {
              background-color: var(--bg-color-overlay) !important;
            }

            .el-tree-node__expand-icon.is-leaf {
              padding: 0;
              margin-right: 4px
            }

            .custom-tree-node {
              width: calc(100% - 16px);
              height: 100%;
              display: flex;
              align-items: center; 
              position: relative;

              .node-icon {
                width: 20px;
                height: 20px;
                border-radius: 4px;
                display: flex;
                justify-content: center;
                align-items: center;
                margin-right: 8px;
                margin-left: 16px;
              }

              span {
                width: calc(100% - 80px);
                z-index: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }

              .more-button {
                margin-right: 18px;
                color: var(--text-color-secondary);
                opacity: 0;
                transition: all 0.3s ease;
              }

              &:hover {
                .more-button {
                  opacity: 1;
                }
              }
            }

          }

          .el-tree-node:focus,
          .el-tree-node:focus-visible,
          .el-tree-node.is-focusable {
            .el-tree-node__content {
              background-color: unset;
            }
          }

        }

        .scrollbar {
          flex: 1;
        }
      }
    }

    .line {
      height: 100%;
      border-left: 1px solid var(--border-color);
    }

    .main {
      width: 100%;
      height: 100%;
      display: flex;
      // flex-direction: column;

      .main-aside {
        width: 200px;
        height: 100%;
        padding: 12px;
        flex-shrink: 0;

        .data-view-item {
          height: 36px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0px 8px 0px 12px;
          border-radius: 4px;
          font-size: 14px;
          line-height: 22px;
          color: #4e5969;
          span {
            display: inline-block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          &:hover {
            cursor: pointer;
            background-color: var(--bg-color-overlay);
          }

          &.active {
            background-color: var(--bg-color-overlay);
          }
        }
      }

      .main-container {
        padding: 16px;
        width: 100%;
        display: flex;
        flex-direction: column; /* 纵向排列 */
        height: 100%; /* 让容器有高度 */

        .tab {
          height: 32px;
          display: flex;
          margin-bottom: 32px;
          border-bottom: 1px solid var(--border-color);
          
          span {
            margin-right: 32px;
            height: 100%;
            display: flex;
            min-width: 28px;
            justify-content: center;
            
            font-weight: 400;
            
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            cursor: pointer;
            transition: all 0.3s ease;
            border-bottom: 2px solid transparent;

            &.active {
              border-bottom: 2px solid var(--color-primary);
              color: var(--color-primary);
            }

            &:hover {
              color: var(--color-primary);
            }
          }
        }

        .head-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;

          .left {
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--text-color-secondary);
            font-style: Bold;
            font-size: 14px;
            leading-trim: NONE;
            line-height: 20px;
            letter-spacing: 0%;
          }

          .right {
            :deep(.el-button) {
              border-radius: 4px;
            }
          }
        }

        .title {
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
        }
        
        .button-box {
          display: flex;
          height: 32px;
          position: relative;
          justify-content: flex-end;
          margin-bottom: 16px;

          .radio {
            position: absolute;
            bottom: 0px;
            left: 0px;
          }
          
          .add-button {
            padding: 0px 16px 0px 12px;
            display: flex;
            align-items: center;
            border-radius: 4px;
            border: 1px solid var(--color-primary);
            color: var(--color-primary);
            gap: 2px;
            cursor: pointer;
            transition: all 0.3s ease;

            &:hover {
              opacity: 0.6;
            }
          }

          .clear-button {
            padding: 0px 16px 0px 12px;
            display: flex;
            align-items: center;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            color: var(--text-color-regular);
            gap: 2px;
            cursor: pointer;
            margin-right: 8px;
            transition: all 0.3s ease;

            
            &:hover {
              opacity: 0.6;
            }
          }

          .el-icon {
            font-size: 16px;
          }
        }

        .tag-container {
          min-height: 216px;
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-color-secondary);

          .add-text {
            color: var(--el-color-primary);
            cursor: pointer;
            
            &:hover {
              text-decoration: underline;
            }

          }

          .tag-box {
            width: 100%;
            min-height: 216px;
            padding: 8px;

            span {
              margin: 4px;
            }

            :deep(.el-tag) {
              transition: none !important;
              animation: none !important;
              background-color: var(--bg-color-overlay); 
              border: none;
              height: 32px;
              color: var(--text-color-regular);

              .el-tag__close {
                color: var(--text-color-secondary);
                transition: all 0.3s ease;

                &:hover {
                  background-color: var(--bg-color-hover);
                }
              }
            }
          }
        }

        .tips {
          display: flex;
          align-items: center;
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          margin-top: 8px;
          color: var(--text-color-secondary);

          .el-icon {
            font-size: 16px;
            margin-right: 2px;
          }
        }

        .view-operation-tab-content {
          min-height: 0;
          overflow: auto;
        }

        .operation-group-form {
          margin-bottom: 16px;
        }

        .empty-operation-group {
          padding: 16px;
          border: 1px dashed var(--border-color);
          border-radius: 4px;
          color: var(--text-color-secondary);
        }
      }
    }
    
    .empty-box {
      display: flex;
      width: 100%;
      height: 100%;
      justify-content: center;
      align-items: center;
      font-size: 14px;
      font-family: "PingFangSC-Regular", "din", "Microsoft Yahei", "Arial", "Helvetica Neue", "Helvetica", sans-serif;
      color: var(--text-color-secondary);
    }
  }
  
  hr {
    margin-top: auto;
    border: 0px solid var(--border-color);
    border-top: 1px solid var(--border-color);
  }

  .save-button {
    margin: 16px;
    height: 32px;
    width: 60px;
    border-radius: 4px;
  }
}
</style>
