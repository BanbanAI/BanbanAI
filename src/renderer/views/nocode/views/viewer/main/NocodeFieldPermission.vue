<template>
  <div class="nocode-field-permission">
    <div class="content">
      <div class="aside">
        <div class="project">
          <el-input
            v-model="searchVal"
            :placeholder="$t('NocodeFieldPermission.searchKeyword')"
            :prefix-icon="Search"
          />

          <el-scrollbar class="scrollbar">
            <el-tree
              style="max-width: 600px"
              :data="filterFormTree"
              @node-click="handleNodeClick"
              ref="treeRef"
              :filter-node-method="filterTree"
              :empty-text="$t('NocodeFieldPermission.noContent')"
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

      <div class="main" v-if="activePageId">
        <div class="tab">
          <span class="active">{{ $t('NocodeFieldPermission.view') }}</span>
        </div>
        <div class="button-box">
          <div class="tips">
            <el-icon>
              <i-ep-warning />
            </el-icon>
            <span>
              {{ $t('NocodeFieldPermission.adminAllAuthTip') }}
            </span>
          </div>
          <div class="add-button">
            <el-button type="primary" @click="() => addPermissionGroupItem()">
              <el-icon :size="16" style="margin-right: 4px;">
                <i-ep-plus></i-ep-plus>
              </el-icon>
              {{ $t('NocodeFieldPermission.addAuthGroup') }}
            </el-button>
          </div>
        </div>
        <field-permission-group-item v-for="(item, index) in currentProject" :key="item"
          :ref="(el: any) => fieldPermissionItemRef[index] = el"
          :group="item" class="field-permission-item"
          :activePageId="activePageId"
          @delete="() => deleteFieldPermissionGroupItem(index)"
          @copy="() => copyFieldPermissionGroupItem(index)"
          @save="(val: FieldPermissionGroupItemType) => saveFieldPermissionGroupItem(val,  index)"
        ></field-permission-group-item>
      </div>
      <div v-else class="empty-box">
        {{ $t('NocodeFieldPermission.noContent') }}
      </div>
    </div>
    <hr>
    <el-button class="save-button" @click="savePermissions" type="primary">{{ $t('NocodeFieldPermission.save') }}</el-button>
  </div>
</template>

<script setup lang='ts'>
import { NOCODE, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { deepClone } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import { debounce } from 'lodash';
import { computed, inject, nextTick, ref, Ref, shallowRef, toRaw, watch } from 'vue';
import axios from "axios";
import i18next from 'i18next';
import { ArrowDownBold, Search } from '@element-plus/icons-vue';
import { NocodeStructureType, NocodeStructure, FieldPermissionGroupItemType } from '@common/types/nocode';
import { newFieldPermissionItem } from './formPermission/utils';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';

const isChanged = inject<Ref<boolean>>('isChanged');
const fieldPermissions = ref();
const nocode = inject(NOCODE);
fieldPermissions.value = deepClone(toRaw(nocode.value.body.permissions.field));
const activePageId = ref();
const searchVal = ref('');
const treeRef = ref(null);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null)

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
  const structure = nocode.value.body.structure;

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

activePageId.value = findFirstPageNode(filterFormTree.value);

const handleNodeClick = (data) => {
  if (data.type !== NocodeStructureType.FORM) return;
  activePageId.value = data.id
}

interface Tree {
  [key: string]: any
}

const filterTree = (value: string, data: Tree) => {
  if (!value) return true
  return data.name.includes(value)
}

const debouncedFilter = debounce((val: string) => {
  treeRef.value?.filter(val);
}, 300);

watch(searchVal, (val) => {
  debouncedFilter(val);
});

const currentProject = computed<FieldPermissionGroupItemType[]>({
  get: () => fieldPermissions.value[activePageId.value].get,
  set: (val) => {},
});

const deleteFieldPermissionGroupItem = (index: number) => {
  currentProject.value.splice(index, 1);
}

const copyFieldPermissionGroupItem = (index: number) => {
  let newItem: FieldPermissionGroupItemType = deepClone(currentProject.value[index]);
  addPermissionGroupItem(newItem);
}

const saveFieldPermissionGroupItem = (val: FieldPermissionGroupItemType, index: number) => {
  currentProject.value[index] = val;
}

const fieldPermissionItemRef = shallowRef([]);
const addPermissionGroupItem = (newItem?: FieldPermissionGroupItemType) => {
  newItem = newItem ?? newFieldPermissionItem();
  if (!currentProject.value) currentProject.value = [];
  currentProject.value.unshift(newItem);
  nextTick(() => {
    fieldPermissionItemRef.value['0'].handleEdit();
  })
}

const savePermissions = debounce(async () => {
  if(!isChanged.value) return;
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  nocode.value.body.permissions.field = deepClone(fieldPermissions.value);
  const res = await axios.post("/project/save-nocode-permissions", {
    nocodeId: toRaw(nocode.value.meta.id),
    permissions: nocode.value.body.permissions.field,
    permissionType: 'field',
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
  if(res) {
    ElMessage.success(i18next.t('NocodeFieldPermission.saveSuccess'));
    const mainSign = Array.isArray(res.headers?.['x-sign']) ? res.headers['x-sign'][0] : res.headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign
    }
    isChanged.value = false;
  }
}, 500)

watch(() => fieldPermissions.value, () => {
  isChanged.value = true
}, { deep: true, immediate: false })
</script>

<style lang='scss' scoped>
:deep(.el-button){
  border-radius: 4px;
}

.nocode-field-permission {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

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
      display: flex;
      flex-direction: column; /* 纵向排列 */
      height: 100%; /* 让容器有高度 */
      padding: 16px;
      
      .tab {
        height: 32px;
        display: flex;
        margin-bottom: 32px;
        border-bottom: 1px solid var(--border-color);
        
        span {
          margin-right: 32px;
          height: 100%;
          display: flex;
          width: 28px;
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
      
      .button-box {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .tips {
          display: flex;
          align-items: center;
          font-weight: 400;
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          margin-top: 8px;
          gap: 4px;
          color: var(--text-color-secondary);

          .el-icon {
            font-size: 16px;
            margin-right: 2px;
          }
        }
      }

      .field-permission-item {
        margin-top: 16px;
      }
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
