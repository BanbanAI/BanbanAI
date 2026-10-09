<template>
  <div class="nocode-project-permission">
    <div style="padding: 16px;">
      <div class="tab">
        <span 
          v-for="tabItem in tabData"
          @click="clickAppTab(tabItem.type)"
          :class="{active: activeTab === tabItem.type}"
        >
          {{ tabItem.name }}
        </span>
      </div>
      <div class="title">
        {{ $t('NocodeProjectPermission.permissionRange') }}
      </div>
      <div v-if="activeTab != PermissionCategory.DELETE">
        <div class="radio">
          <el-radio-group v-model="projectPermission[activeTab].rangeType">
            <el-radio :value="PermissionFilterMode.BLACK" size="small">{{$t('NocodeProjectPermission.allMemberCan')}}{{ tabData.find((t) => t.type === activeTab).name }}</el-radio>
            <el-radio :value="PermissionFilterMode.WHITE" size="small">{{ $t('NocodeProjectPermission.custom') }}</el-radio>
          </el-radio-group>
        </div>
        <div class="button-box">
          <div class="text">
            {{ projectPermission[activeTab].rangeType === PermissionFilterMode.BLACK ? $t('NocodeProjectPermission.excludeMember') : `${$t('NocodeProjectPermission.includeMember')}${tabData.find((t) => t.type === activeTab).name}:`}}
          </div>
          <div 
            class="clear-button" 
            @click="handleClear"
          >
            <el-icon>
              <i-ep-delete></i-ep-delete>
            </el-icon>
            <span>
              {{ $t('NocodeProjectPermission.clear') }}
            </span>
          </div>
          <div class="add-button" @click="handleClickAdd">
            <span>
              {{ $t('NocodeProjectPermission.setRange') }} 
            </span>
          </div>
        </div>
        <div class="tag-container" v-if="true">
          <span v-if="isEmpty(tagData.departments) && isEmpty(tagData.roles) && isEmpty(tagData.users)">
            {{ $t('NocodeProjectPermission.emptyAddFirst') }}<span class="add-text" @click="handleClickAdd">{{ $t('NocodeProjectPermission.add') }}</span>
          </span>
          <div class="tag-box" v-else>
            <el-tag closable v-for="tag in tagData.departments" @close="closeTag(tag,'departments')">
              {{ organizeUtil.departments.find(item => item.id === tag).name }}
            </el-tag>
            <el-tag closable v-for="tag in tagData.roles" @close="closeTag(tag,'roles')">
              {{ organizeUtil.roles.find(item => item.id === tag).name }}
            </el-tag>
            <el-tag closable v-for="tag in tagData.users" @close="closeTag(tag,'users')">
              {{ getUserName(tag) }}
            </el-tag>
          </div>
        </div>
        <div class="tips" v-if="projectPermission[activeTab].rangeType === PermissionFilterMode.WHITE">
          <el-icon>
            <i-ep-warning></i-ep-warning>
          </el-icon>
          {{ $t('NocodeProjectPermission.adminAllAuthTip') }}
        </div>
      </div>
      <div v-else class="admin-delete">
        {{ $t('NocodeProjectPermission.onlyAdminDel') }}
      </div>
    </div>
    <hr>
    <el-button class="save-button" type="primary" @click="savePermissions">{{ $t('NocodeProjectPermission.save') }}</el-button>
    <nocode-user-select-dialog ref="userSelectRef" @save="handleAdd"></nocode-user-select-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, Ref, ref, toRaw, watch } from 'vue';
import { NOCODE, ORGANIZE_UTIL, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { deepClone, isEmpty } from '@common/utils/object';
import { ElMessage } from 'element-plus';
import { PermissionCategory, PermissionFilterMode } from '@common/types/nocode';
import axios from "axios"
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { debounce } from 'lodash';
import i18next from 'i18next';
import { getUserDisplayName } from '@renderer/utils/other';

const projectPermission = ref()
const nocode = inject(NOCODE)
const organizeUtil = inject(ORGANIZE_UTIL)
projectPermission.value = deepClone(nocode.value.body.permissions?.application)
const isChanged = inject<Ref<boolean>>('isChanged')
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null)
const activeTab = ref(PermissionCategory.GET)
const userSelectRef = ref(null)

const tabData = ref([
  {
    get name() { return i18next.t('NocodeProjectPermission.view') },
    type: PermissionCategory.GET,
  },
  {
    get name() { return i18next.t('NocodeProjectPermission.edit') },
    type: PermissionCategory.UPDATE,
  },
  {
    get name() { return i18next.t('NocodeProjectPermission.delete') },
    type: PermissionCategory.DELETE,
  },
])

const tagData = computed(() => {
  const currentTab = activeTab.value
  const currentMode = projectPermission.value[currentTab].rangeType
  const result = deepClone(projectPermission.value[currentTab][currentMode])
  return result
})

const clickAppTab = (type) => {
  activeTab.value = type
}

const handleClickAdd = () => {
  userSelectRef.value.show(i18next.t('NocodeProjectPermission.setRange'), tagData.value)
}

const handleAdd = (value) => {
  const currentTab = activeTab.value
  const currentMode = projectPermission.value[currentTab].rangeType
  projectPermission.value[currentTab][currentMode] = deepClone(value)
}

const getUserName = (id: string) => {
  return getUserDisplayName(organizeUtil.findUserById(id), id);
}

const savePermissions = debounce(async () => {
  if(!isChanged.value) {
    ElMessage(i18next.t('NocodeProjectPermission.noNeedSave'))
    return
  }
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  nocode.value.body.permissions.application = deepClone(projectPermission.value)
  const res = await axios.post("/project/save-nocode-permissions", {
    nocodeId: toRaw(nocode.value.meta.id),
    permissions: nocode.value.body.permissions.application,
    permissionType: 'application',
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
  if(res) {
    ElMessage.success(i18next.t('NocodeProjectPermission.saveSuccess'));
    const mainSign = Array.isArray(res.headers?.['x-sign']) ? res.headers['x-sign'][0] : res.headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign
    }
    isChanged.value = false
  }
}, 500)

watch(
  () => projectPermission.value,
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

const handleClear = () => {
  const currentTab = activeTab.value
  const currentMode = projectPermission.value[currentTab].rangeType
  projectPermission.value[currentTab][currentMode].departments = []
  projectPermission.value[currentTab][currentMode].roles = []
  projectPermission.value[currentTab][currentMode].users = []
}

const closeTag = (tag, type) => {
  const currentTab = activeTab.value
  const currentMode = projectPermission.value[currentTab].rangeType
  projectPermission.value[currentTab][currentMode][type] = projectPermission.value[currentTab][currentMode][type].filter(item => item != tag)
}
</script>

<style lang="scss" scoped>
.nocode-project-permission {
  display: flex;
  flex-direction: column;
  height: 100%;

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

  .radio {
    margin: 16px 0px 32px;
  }

  .button-box {
    display: flex;
    height: 32px;
    position: relative;
    justify-content: flex-end;
    margin-bottom: 16px;

    .text {
      margin-right: auto;
      line-height: 32px;
      
      font-weight: 400;
      
      font-size: 14px;
      letter-spacing: 0%;
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
      padding-top: 1px;
    }
  }

  .admin-delete {
    margin-top: 16px;
    
    font-weight: 400;
    
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 0%;
    color: var(--text-color-secondary);
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
