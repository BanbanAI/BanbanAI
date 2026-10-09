<template>
  <div class="nocode-user-select-dialog">
    <el-dialog 
      ref="ElDialogRef" 
      :model-value="visible" 
      :title="dialogTitle"
      @close="visible = false"
      draggable
      align-center
      destroy-on-close
    >
      <div class="body-left">
        <div class="tab">
          <ul>
            <li @click="changeTab('dep')" :class="{active: activeTab === 'dep'}">{{ $t('NocodeUserSelectDialog.department') }}</li>
            <li @click="changeTab('rol')" :class="{active: activeTab === 'rol'}" v-if="!onlyDepart">{{ $t('NocodeUserSelectDialog.role') }}</li>
            <li @click="changeTab('user')" :class="{active: activeTab === 'user'}" v-if="!onlyDepart">{{ $t('NocodeUserSelectDialog.member') }}</li>
          </ul>
        </div>
        <el-input
          v-model="searchValue"
          style="width: 352px"
          :placeholder="$t('NocodeUserSelectDialog.plsInput')"
          clearable
        >
          <template #prefix>
            <el-icon class="el-input__icon"><i-ep-search /></el-icon>
          </template>
        </el-input>
        <div class="list">
          <el-breadcrumb :separator-icon="separatorIcon" v-if="activeTab != 'rol' && searchValue.trim() === ''">


            <el-breadcrumb-item @click="path = []">
              <span :title="companyName">{{ companyName }}</span>
            </el-breadcrumb-item>
            <template v-for="(breadcrumb, index) in path" :key="breadcrumb.name + index">
              <el-breadcrumb-item v-if="!breadcrumb.children" @click="toDepartment(breadcrumb.id)">
                <span :title="breadcrumb.name">{{ breadcrumb.name }}</span>
              </el-breadcrumb-item>
              <el-breadcrumb-item v-else>
                <el-dropdown trigger="hover" popper-class="workbench-breadcrumb-menu-popper">
                  <el-icon class="menu-icon" :size="24"><i-workbench-box-menu /></el-icon>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item :class="{ 'el-breadcrumb-last': index === breadcrumb.children.length - 1 }"
                        v-for="(item, index) in breadcrumb.children" :key="item.name" @click.stop="toDepartment(item.id)"
                        :title="item.name">
                        <span>
                          {{ item.name }}
                        </span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </el-breadcrumb-item>
            </template>
          </el-breadcrumb>
          <el-scrollbar>
            <ul>
              <li @click="onLiClick('all', $event)">
                <el-checkbox
                  :model-value="isCheckAll()"
                  @update:model-value="val => handleChangeAll(val)"
                  :disabled="checkAllIsDisAbled"
                  @click.stop
                />
                <p>
                  {{ $t('NocodeUserSelectDialog.selectAll') }}
                </p>
              </li>
              <li v-for="item in showData" @click="onLiClick(item, $event)">
                <el-checkbox v-if="!(isDepartment(item.id) && activeTab === 'user')" @click.stop :model-value="isCheck(item.id)" @update:model-value="val => handleCheckChange(val, item)"/>
                <el-icon v-else color="var(--text-color-placeholder)">
                  <i-ep-minus></i-ep-minus>
                </el-icon>
                <p>
                  {{ item.realname || item.name }}
                </p>
                <el-icon class="enter-btn" @click.stop="showChild(item)" v-if="activeTab != 'rol' && isEnter(item.id)">
                  <i-ep-arrow-right></i-ep-arrow-right>
                </el-icon>
              </li>
            </ul>
          </el-scrollbar>
        </div>
      </div>

      <div class="body-line"></div>

      <div class="body-right" v-if="!isEmpty(range.departments) || !isEmpty(range.roles) || !isEmpty(range.users)">
        <el-scrollbar>
          <el-tag
            v-for="tag in range.departments"
            closable
            :key="tag"
            type="info" 
            @close="range.departments = range.departments.filter(item => item != tag)"
          >
            {{ organizeUtil.departments.find(item => item.id === tag).name }}
          </el-tag>
          <el-tag
            v-for="tag in range.roles"
            closable
            :key="tag"
            type="info" 
            @close="range.roles = range.roles.filter(item => item != tag)"
          >
            {{ organizeUtil.roles.find(item => item.id === tag).name }}
          </el-tag>
          <el-tag
            v-for="tag in range.users"
            closable
            :key="tag"
            type="info" 
            @close="range.users = range.users.filter(item => item != tag)"
          >
            {{ getUserName(tag) }}
          </el-tag>
        </el-scrollbar>
      </div>
      <div v-else class="empty-tag">{{ $t('NocodeUserSelectDialog.selectFromLeft') }}</div>

      <template #footer>
        <el-button @click="visible = false">{{ $t('NocodeUserSelectDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleSave">{{ $t('NocodeUserSelectDialog.save') }}</el-button>
      </template>
    </el-dialog>
  </div>

</template>

<script lang='ts' setup>
import { ref, onMounted, computed, inject } from 'vue';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { NOCODE } from '@renderer/types';
import axios from "axios"
import { deepClone, isEmpty } from "@common/utils/object";
import { PermissionFilterMode, PermissionRange } from '@common/types/nocode';
import { getUserDisplayName } from '@renderer/utils/other';

const organizeUtil = new OrganizeUtil();
const visible = ref(false)
const searchValue = ref('')
const separatorIcon = IWorkbenchArrowRight;
const listData = ref()
const path = ref([])
const dialogTitle = ref()
const activeTab = ref('dep')
const companyName = ref()
const nocode = inject(NOCODE)

const props = withDefaults(defineProps<{
  onlyDepart: boolean,
}>(), {
  onlyDepart: false,
});

const emit = defineEmits<{
  (event: 'save', value),
}>();

defineExpose({
  show: (title: string, data: PermissionRange = {departments: [], roles: [], users: [],}) => {
    visible.value = true
    dialogTitle.value = title
    range.value = deepClone(data)
  },
  hide: () => {
    visible.value = false
  }
})

const changeTab = (type) => {
  activeTab.value = type
  path.value = []
  if(type === 'dep') {
    listData.value = organizeUtil.departments
  } else if(type === 'rol') {
    listData.value = organizeUtil.roles
  } else {
    listData.value = organizeUtil.users
  }
}

const getUserName = (id: string) => {
  return getUserDisplayName(organizeUtil.findUserById(id), id);
}

const onLiClick = (item: any, event: MouseEvent | KeyboardEvent) => {
  if(isEnter(item.id) && activeTab.value === 'user') {
    showChild(item)
  }

  // 如果点击目标是 a、button、input 等交互元素，就不处理（保险起见）
  const target = event?.target as HTMLElement | null;
  if (target) {
    const tag = target.tagName.toLowerCase();
    if (['input', 'button', 'a', 'svg', 'path'].includes(tag)) {
      return;
    }
  }

  // 切换选中状态
  if(item != 'all') {
    const checked = isCheck(item.id);
    handleCheckChange(!checked, item);
  } else {
    const checked = isCheckAll();
    handleChangeAll(!checked)
  }
};

onMounted(async () => {
  await organizeUtil.getDepartments()
  await organizeUtil.getUsers()
  await organizeUtil.getAllUsers()
  await organizeUtil.getRoles()
  listData.value = organizeUtil.departments
  await axios.get('/workbench/get-company-name').then(res => {
    companyName.value = res.data;
  }).catch(err => {
    console.log(err);
  })
})

const isDepartment = (id: string) => {
  return organizeUtil.departments.some(dep => dep.id === id);
};

const showData = computed(() => {
  let value = listData.value
  if(activeTab.value === 'user') {
    // 过滤admin用户
    value = value.filter(item => !(item.realname === 'admin' || item.use === 'admin'))
  }

  if (searchValue.value.trim() !== '') {
    if(activeTab.value === 'user') {
      value = value.filter(item =>
        item.realname?.toLowerCase().includes(searchValue.value.trim().toLowerCase())
      )
    } else {
      value = value.filter(item =>
        item.name?.toLowerCase().includes(searchValue.value.trim().toLowerCase())
      )
    }
    return value
  } else {
    if(activeTab.value === 'dep') {
      if(path.value.length === 0) {
        return value.filter(item => item.parent === '')
      }
      return value.filter(item => item.parent === path.value[path.value.length-1].id)
    } else if(activeTab.value === 'user') {
      let result = []
      if(path.value.length === 0) {
        for(const item of value) {
          if(isEmpty(item.departments)) {
            result.push(item)
          }
        }
        result = [...organizeUtil.departments.filter(item => item.parent === ''),...result]
        return result
      } else {
        for(const item of value) {
          if(item.departments.includes(path.value[path.value.length-1].id)) {
            result.push(item)
          }
        }
        return [...organizeUtil.departments.filter(item => item.parent === path.value[path.value.length-1].id),...result]
      }

      
    } else {
      return value
    }
  }

  
})

const isEnter = (depId: string) => {
  if (activeTab.value === 'rol') {
    return listData.value.some(item => item.id === depId);
  }
  if(activeTab.value === 'dep') {
    return listData.value.some(item => item.parent === depId);
  } else {
    for(const user of listData.value) {
      if(user.departments.includes(depId)) {
        return true
      }
    }
    return organizeUtil.departments.some(item => item.parent === depId);
  }
};

const showChild = (item) => {
  path.value.push({
    id: item.id,
    name: item.name
  })
}

const toDepartment = (id) => {
  const index = path.value.findIndex(item => item.id === id);
  if (index !== -1) {
    path.value = path.value.slice(0, index + 1); // 保留到当前项（包含）
  }
}
const range = ref<PermissionRange>({
  departments: [],
  roles: [],
  users: [],
})

const isCheck = (item) => {
  return range.value.departments.includes(item) || range.value.roles.includes(item) || range.value.users.includes(item)
}

const checkAllIsDisAbled = computed(() => {
  if(!showData.value?.length) {
    return true
  }
  if(activeTab.value === 'user') {
    for(const item of showData.value) {
      if(!isDepartment(item.id)) {
        return false
      }
    }
    return true
  }
  return false
})

const isCheckAll = () => {
  if(checkAllIsDisAbled.value) {
    return false
  }
  for(const item of showData.value) {
    if(!isCheck(item.id)) {
      if(activeTab.value === 'user') {
        if(!isDepartment(item.id)) {
          return false
        }
      } else {
        return false
      }
    }
  }
  return true
}

const handleCheckChange = (val, item) => {
  if(isDepartment(item.id) && activeTab.value === 'user') {
    return
  }
  if (val) {
    if(activeTab.value === 'dep') {
      if (!range.value.departments.includes(item.id)) {
        range.value.departments.push(item.id)
      }
    } else if(activeTab.value === 'rol') {
      if (!range.value.roles.includes(item.id)) {
        range.value.roles.push(item.id)
      }
    } else if(activeTab.value === 'user'){
      if (!range.value.users.includes(item.id)) {
        range.value.users.push(item.id)
      }
    }
  } else {
    range.value = {
      departments: range.value.departments.filter(c => c !== item.id),
      roles: range.value.roles.filter(c => c !== item.id),
      users: range.value.users.filter(c => c !== item.id),
    }
  }
}

const handleChangeAll = (value) => {
  for(const item of showData.value) {
    handleCheckChange(value,item)
  }
}

const handleSave = () => {
  visible.value = false
  emit('save', range.value)
}
</script>
<style scoped lang='scss'>
.nocode-user-select-dialog {
  :deep(.el-dialog) {
    padding: 0px;
    width: 680px;
    border-radius: 4px;
    background-color: var(--color-white);

    .el-dialog__header {
      padding: 0px;
      height: 40px;
      border-bottom: 1px solid var(--border-color);
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
      display: flex;
      justify-content: center;
      align-items: center;
      
      .el-dialog__headerbtn {
        height: 40px;
      }
    }

    .el-dialog__body {
      height: 412px;
      padding: 16px;
      display: flex;
      gap: 16px;

      .body-left {
        height: 100%;
        width: 352px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        
        .tab {
          width: 100%;
          height: 32px;
          border-bottom: 1px solid var(--border-color);
          
          ul {
            display: flex;
            height: 100%;
            gap: 16px;

            li {
              cursor: pointer;
              width: 28px;
              height: 100%;
              display: flex;
              align-items: center;
              font-weight: 400;
              font-size: 14px;
              line-height: 20px;
              letter-spacing: 0%;
              transition: all 0.3s ease;
              border-bottom: 2px solid transparent;

              &:hover {
                color: var(--color-primary);
              }

              &.active {
                border-bottom: 2px solid var(--color-primary);
                color: var(--color-primary);
              }
            }
          }
        }

        .el-input__wrapper {
          background-color: var(--bg-color-overlay);
          box-shadow: unset;
          border-radius: 4px;
        }
        
        .list {
          width: 100%;
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;

          .el-breadcrumb {
            display: flex;
            align-items: center;
          }

          .el-breadcrumb__item {
            border-radius: 2px;
            opacity: 1;
            margin-bottom: 8px;
            display: flex;

            .el-breadcrumb__inner {
              cursor: pointer;
              color: var(--text-color-secondary);

              &:hover {
                color: var(--color-primary);
              }
            }
          }

          .el-scrollbar {
            flex: 1;
          }

          ul {
            display: flex;
            flex-direction: column;
            gap: 4px;

            li {
              display: flex;
              cursor: pointer;
              align-items: center;
              padding-left: 8px;
              padding-right: 8px;
              transition: all 0.3s ease;
              border-radius: 4px;
              height: 32px;

              p {
                margin-left: 8px;
              }

              /* 关闭 Checkbox 选中动画 */
              .el-checkbox__inner {
                transition: none !important;
              }
              .el-checkbox__inner::after {
                transition: none !important;
              }



              .enter-btn {
                opacity: 0;
                margin-left: auto;
                transition: all 0.3s ease;
              }

              &:hover {
                background-color: var(--bg-color-overlay);

                .el-icon {
                  opacity: 1;
                }
              }
            }
          }
        }
      }

      .body-line {
        width: 0px;
        border-left: 1px solid var(--border-color);
      }

      .body-right {
        width: 264px;
        
        span {
          margin: 3px;
        }
      }

      .empty-tag {
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: var(--text-color-placeholder);
      }
    }

    .el-dialog__footer {
      border-top: 1px solid var(--border-color);
      height: 64px;
      padding: 0px;
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 16px;

      .el-button {
        border-radius: 4px;
      }
    }
  }
}
</style>
