<template>
  <div class="nocode-form-permission">
    <div class="content">
      <div class="aside">
        <div class="project">
          <el-input
            v-model="searchVal"
            :placeholder="$t('NocodeFormPermission.searchKeyword')"
            :prefix-icon="Search"
          />

          <el-scrollbar class="scrollbar">
            <el-tree
              style="max-width: 600px"
              :data="treeData"
              @node-click="handleNodeClick"
              ref="treeRef"
              :filter-node-method="filterTree"
              :empty-text="$t('NocodeFormPermission.noContent')"
              :icon="ArrowDownBold"
              :indent="24"
            >
              <template #default="{ node, data }">
                <div class="custom-tree-node" :class="{'active': activePageId === data.id}">
                  <div :class="['node-icon', data.type]">
                    <el-icon size="20"
                      v-if="!node.expanded && data.type === NocodeStructureType.GROUP">
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
          <span :class="{active: activeTab === PermissionCategory.ADD}" @click="clickTab(PermissionCategory.ADD)">{{ $t('NocodeFormPermission.submit') }}</span>
          <span :class="{active: activeTab === 'other'}" @click="clickTab('other')">{{ $t('NocodeFormPermission.view') }}</span>
          <!-- <span :class="{active: activeTab === PermissionCategory.UPDATE}" @click="clickTab(PermissionCategory.UPDATE)">编辑</span>
          <span :class="{active: activeTab === PermissionCategory.DELETE}" @click="clickTab(PermissionCategory.DELETE)">删除</span>  -->
        </div>
        <div v-show="activeTab === PermissionCategory.ADD" class="add-tab-content">
          <div class="title">
            {{ $t('NocodeFormPermission.permissionRange') }}
          </div>
          <member-range v-model:data="currentProject.add"></member-range>
        </div>
        
        <div v-show="activeTab === 'other'" class="view-tab-content">
          <div class="head-container">
            <div class="left">
              <el-icon size="16"><i-ep-warning /></el-icon>
              <span>{{ $t('NocodeFormPermission.adminAllAuthTip') }}</span>
            </div>
            <div class="right">
              <el-button type="primary" @click="() => addOtherCategoryForm()">
                <el-icon :size="16" style="margin-right: 4px;">
                  <i-ep-plus></i-ep-plus>
                </el-icon>
                {{ $t('NocodeFormPermission.addAuthGroup') }}
              </el-button>
            </div>
          </div>

          <other-category-form v-for="(item, index) in currentProject.other" :key="item"
            :ref="(el: any) => otherCategoryFormRef[index] = el"
            :form="item" class="other-category-form"
            :fromFormField="currentFromFormField"
            @delete="() => deleteOtherCategoryForm(index)"
            @copy="() => copyOtherCategoryForm(index)"
            @save="(val: DataPermissionOther) => saveOtherCategoryForm(val, index)"
          ></other-category-form>
        </div>
      </div>
      <div v-else class="empty-box">
        {{ $t('NocodeFormPermission.noContent') }}
      </div>
    </div>
    <hr>
    <el-button class="save-button" @click="savePermissions" type="primary">{{ $t('NocodeFormPermission.save') }}</el-button>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, Ref, ref, shallowRef, toRaw, watch } from 'vue';
import { ArrowDownBold, Search } from '@element-plus/icons-vue';
import { NOCODE, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { DataPermission, DataPermissionContent, DataPermissionOther, NocodeStructureType, PermissionCategory } from '@common/types/nocode';
import { expandLegacyNoProcessDataPermissionGroups } from '@common/utils';
import { debounce } from 'lodash';
import { deepClone, isEmpty } from "@common/utils/object";
import { ElMessage } from 'element-plus';
import axios from "axios"
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { newInitialForm } from './formPermission/utils';
import i18next from 'i18next';

const formPermissions = ref<DataPermission>();
const nocode = inject(NOCODE)
formPermissions.value = normalizeFormPermissions(toRaw(nocode.value.body.permissions.data));
const searchVal = ref('')
const activePageId = ref()
const activeTab = ref<keyof DataPermissionContent>(PermissionCategory.ADD)
const treeRef = ref(null)
const isChanged = inject<Ref<boolean>>('isChanged')
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null)

function normalizeFormPermissions(value?: DataPermission) {
  const normalizedPermissions = deepClone(value || {});
  Object.values(normalizedPermissions).forEach((permissionItem) => {
    if (!permissionItem) return;
    permissionItem.other = expandLegacyNoProcessDataPermissionGroups(permissionItem.other);
  });
  return normalizedPermissions;
}

function findFirstPageNode(tree) {
  for (const node of tree) {
    if (node.type === NocodeStructureType.FORM)   {
      return node.id
    }
    if (node.children) {
      const found = findFirstPageNode(node.children)
      if (found) return found
    }
  }
  return null
}
activePageId.value = findFirstPageNode(nocode.value.body.structure)

const handleNodeClick = (data) => {
  if (data.type === NocodeStructureType.GROUP) return;
  activePageId.value = data.id
}

const currentFromFormField = computed(() => {
  if (!activePageId.value) return []
  const table = nocode.value.body.formData.tables.find((item) => item.uid === activePageId.value)
  const allowFields = ["widget.form.memberSelect", "widget.form.departmentSelect"]
  return table?.fields.filter(f => allowFields.includes(f.meta?.extra?.widgetType)).map(f => {
    return {
      value: f.uid,
      label: f.alias
    }
  })
})

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

const currentProject = computed<DataPermissionContent>({
  get: () => formPermissions.value[activePageId.value],
  set: (val) => {},
});
const otherCategoryFormRef = shallowRef([]);

function addOtherCategoryForm(newForm?: DataPermissionOther) {
  newForm = newForm ?? newInitialForm();
  if (!currentProject.value.other) currentProject.value.other = [];
  currentProject.value.other.unshift(newForm);
  nextTick(() => {
    otherCategoryFormRef.value['0'].handleEdit();
  });
}

function deleteOtherCategoryForm(index: number) {
  currentProject.value.other.splice(index, 1);
}
function copyOtherCategoryForm(index: number) {
  let newForm: DataPermissionOther = deepClone(toRaw(currentProject.value.other[index]));
  addOtherCategoryForm(newForm);
}
function saveOtherCategoryForm(val: DataPermissionOther, index: number) {
  currentProject.value.other[index] = val;
}

const treeData = computed(() => {
  function filterTreeExcludePage(nodes) {
  return nodes
    .map(node => {
    const newNode = { ...node };
    if (newNode.children) {
      newNode.children = filterTreeExcludePage(newNode.children);
    }
      return newNode;
    })
    .filter(node => node.type !== 'page');
  }

  return filterTreeExcludePage(nocode.value.body.structure)
})

const clickTab = (type: keyof DataPermissionContent) => {
  activeTab.value = type
}

// const savePermissions = debounce(async () => {
//   const res = await axios.post("/project/save-nocode-permissions", {
//     nocodeId: toRaw(nocode.value.meta.id),
//     permissions: nocode.value.body.permissions.data[activePageId.value][activeTab.value],
//     permissionType: 'data',
//     type: activeTab.value,
//     pageId: activePageId.value
//   }).catch(err => {
//     ElMessage.error(err.message);
//   });
//   if(res) {
//     ElMessage.success('修改成功！');
//   }
// }, 500)

const savePermissions = debounce(async () => {
  if(!isChanged.value) return;
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  nocode.value.body.permissions.data = deepClone(toRaw(formPermissions.value))
  const res = await axios.post("/project/save-nocode-permissions", {
    nocodeId: toRaw(nocode.value.meta.id),
    permissions: nocode.value.body.permissions.data,
    permissionType: 'data',
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
  if(res) {
    ElMessage.success(i18next.t('NocodeFormPermission.saveSuccess'));
    const mainSign = Array.isArray(res.headers?.['x-sign']) ? res.headers['x-sign'][0] : res.headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign
    }
    isChanged.value = false
  }
}, 500)

watch(
  () => formPermissions.value,
  () => {
    // savePermissions()
    isChanged.value = true
  },
  {
    deep: true, // 深度监听对象内部属性
    immediate: false // 不立即触发
  }
)

defineExpose({
  savePermissions,
})
</script>

<style lang="scss" scoped>
:deep(.el-button){
  border-radius: 4px;
}

:deep(.el-input.noborder-input) {
  .el-input__wrapper {
    box-shadow: unset;
    background-color: var(--bg-color-overlay);
    border-radius: 4px;
  }
}

.nocode-form-permission {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  .content {
    width: 100%;
    flex-grow: 1;
    height: 0;
    display: flex;

    .aside {
      width: 300px;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 16px;

      .project {
        flex: 1;
        display: flex;
        flex-direction: column;
        row-gap: 8px;
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
      }
    }

    .line {
      height: 100%;
      border-left: 1px solid var(--border-color);
    }

    .main {
      padding: 16px;
      width: 100%;
      display: flex;
      flex-direction: column;

      .tab {
        height: 32px;
        display: flex;
        margin-bottom: 32px;
        border-bottom: 1px solid var(--border-color);
        
        &>span {
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

      .add-tab-content{
        .title {
          
          font-weight: 400;
          
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
        }
      }
      
      .view-tab-content {
        flex-grow: 1;
        overflow: auto;

        .head-container{
          display: flex;
          justify-content: space-between;
          align-items: center;

          .left{
            display: flex;
            align-items: center;
            gap: 4px;
            color: var(--text-color-secondary);

            .el-icon {
              padding-top: 1px;
            }

            span {
              
              font-style: Bold;
              font-size: 14px;
              leading-trim: NONE;
              line-height: 20px;
              letter-spacing: 0%;
            }
          }
        }

        .other-category-form{
          margin-top: 16px;
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
  }
}


</style>
