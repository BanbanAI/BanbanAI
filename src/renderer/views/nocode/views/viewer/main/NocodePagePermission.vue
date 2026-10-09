<template>
  <div class="nocode-page-permission">
    <div class="content">

      <div class="aside">
        <div class="project">
          <el-input
            v-model="searchVal"
            :placeholder="$t('NocodePagePermission.searchKeyword')"
            :prefix-icon="Search"
          />

          <el-scrollbar class="scrollbar">
            <el-tree
              style="max-width: 600px"
              :data="nocode.body.structure"
              @node-click="handleNodeClick"
              ref="treeRef"
              :filter-node-method="filterTree"
              :empty-text="$t('NocodePagePermission.noContent')"
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
        <div style="padding: 16px;">
          <div class="tab">
            <span class="active">{{ $t('NocodePagePermission.view') }}</span>
          </div>
          <div class="title">
            {{ $t('NocodePagePermission.permissionRange') }}
          </div>
          <div class="button-box">
            <div class="radio">
              <el-radio-group v-model="currentProject.get.rangeType">
                <el-radio :value="PermissionRangeType.ALL" size="small">{{ $t('NocodePagePermission.allViewMember') }}</el-radio>
                <el-radio :value="PermissionRangeType.CUSTOM" size="small">{{ $t('NocodePagePermission.custom') }} </el-radio>
              </el-radio-group>
            </div>
            <div 
              class="clear-button" 
              v-if="currentProject.get.rangeType === PermissionRangeType.CUSTOM"
              @click="handleClear()"
            >
              <el-icon>
                <i-ep-delete></i-ep-delete>
              </el-icon>
              <span>
                {{ $t('NocodePagePermission.clear') }}
              </span>
            </div>
            <div class="add-button" v-if="currentProject.get.rangeType === PermissionRangeType.CUSTOM" @click="handleClickAdd">
              <span>
                {{ $t('NocodePagePermission.setRange') }} 
              </span>
            </div>
          </div>
          <div class="tag-container" v-if="currentProject.get.rangeType === PermissionRangeType.CUSTOM">
            <span v-if="isEmpty(currentProject.get.range.departments) && isEmpty(currentProject.get.range.roles) && isEmpty(currentProject.get.range.users)">
              {{ $t('NocodePagePermission.emptyAddFirst') }}<span class="add-text" @click="handleClickAdd">{{ $t('NocodePagePermission.add') }}</span>
            </span>
            <div class="tag-box" v-else>
              <el-tag closable v-for="tag in currentProject.get.range.departments" @close="closeTag(tag, 'departments')">
                {{ organizeUtil.departments.find(item => item.id === tag).name }}
              </el-tag>
              <el-tag closable v-for="tag in currentProject.get.range.roles" @close="closeTag(tag, 'roles')">
                {{ organizeUtil.roles.find(item => item.id === tag).name }}
              </el-tag>
              <el-tag closable v-for="tag in currentProject.get.range.users" @close="closeTag(tag, 'users')">
                {{ getUserName(tag) }}
              </el-tag>
            </div>
          </div>
          <div class="tips" v-if="currentProject.get.rangeType === PermissionRangeType.CUSTOM">
            <el-icon>
              <i-ep-warning />
            </el-icon>
            <span>
              {{ $t('NocodePagePermission.adminAllAuthTip') }}
            </span>
          </div>
        </div>
      </div>
      <div v-else class="empty-box">
        {{ $t('NocodePagePermission.noContent') }}
      </div>
    </div>
    <hr>
    <el-button class="save-button" @click="savePermissions" type="primary">{{ $t('NocodePagePermission.save') }}</el-button>
  </div>
  
  
  <nocode-user-select-dialog ref="userSelectRef" @save="handleSave"></nocode-user-select-dialog>
</template>

<script setup lang="ts">
import { computed, inject, Ref, ref, toRaw, watch } from 'vue';
import { ArrowDownBold, Search } from '@element-plus/icons-vue';
import { NOCODE, ORGANIZE_UTIL, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { NocodeStructureType, PermissionRangeType } from '@common/types/nocode';
import { debounce } from 'lodash';
import { deepClone, isEmpty } from "@common/utils/object";
import { ElMessage } from 'element-plus';
import axios from "axios";
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import i18next from 'i18next';
import { getUserDisplayName } from '@renderer/utils/other';

const pagePermissions = ref()
const nocode = inject(NOCODE)
pagePermissions.value = deepClone(nocode.value.body.permissions?.page)
const searchVal = ref('')
const organizeUtil = inject(ORGANIZE_UTIL)
const activePageId = ref()
const userSelectRef = ref(null)
const treeRef = ref(null)
const isChanged = inject<Ref<boolean>>('isChanged')
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null)

function findFirstPageNode(tree) {
  for (const node of tree) {
    if (node.type != NocodeStructureType.GROUP)   {
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

const currentProject = computed(() => {
  // const currentProject = nocode.value.body.permissions.page[activePageId.value]
  // return currentProject
  const currentProject = pagePermissions.value?.[activePageId.value]
  return currentProject
})

const handleClickAdd = () => {
  setTimeout(() => {
    userSelectRef.value.show(i18next.t('NocodePagePermission.setRange'), currentProject.value.get.range)
  }, 1);
}

const handleSave = (value) => {
  const currentProject = pagePermissions.value?.[activePageId.value]
  currentProject.get.range = deepClone(value)
}

const getUserName = (id: string) => {
  return getUserDisplayName(organizeUtil.findUserById(id), id);
}

const handleClear = () => {
  currentProject.value.get.range = {
    departments: [],
    roles:[],
    users: []
  }
  ElMessage.success(i18next.t('NocodePagePermission.clearSuccess'))
}

const savePermissions = debounce(async () => {
  if(!isChanged.value) return;

  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  nocode.value.body.permissions.page = deepClone(pagePermissions.value)
  const res = await axios.post("/project/save-nocode-permissions", {
    nocodeId: toRaw(nocode.value.meta.id),
    permissions: nocode.value.body.permissions.page,
    permissionType: 'page',
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
  if(res) {
    ElMessage.success(i18next.t('NocodePagePermission.saveSuccess'));
    const mainSign = Array.isArray(res.headers?.['x-sign']) ? res.headers['x-sign'][0] : res.headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign
    }
    isChanged.value = false
  }
}, 500)

const closeTag = (tag, type) => {
  pagePermissions.value[activePageId.value].get.range[type] = pagePermissions.value?.[activePageId.value].get.range[type].filter(item => item != tag)
}

watch(
  () => pagePermissions.value,
  () => {
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
.nocode-page-permission {
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
