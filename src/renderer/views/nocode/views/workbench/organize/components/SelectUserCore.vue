<template>
  <div class="select-user-core">
    <div class="department-list">
      <ul class="tab-list" v-if="isInWidget">
        <li v-if="!props.hideDepartmentTab && ((isSetting && (type !== 'member' || !isSetDefault)) || (!isSetting && type === 'department'))" :class="{'active': tabActive === 'department'}" @click="changeTab('department')">{{ $t("SelectUserCore.department") }}</li>
        <li v-if="type === 'member' && !isSetDefault && isSetting && !props.hideRoleTab" :class="{'active': tabActive === 'role'}" @click="changeTab('role')">{{ $t("SelectUserCore.role") }}</li>
        <li v-if="type === 'member'" :class="{'active': tabActive === 'member'}" @click="changeTab('member')">{{ $t("SelectUserCore.member") }}</li>
        <li v-if="props.isShowQuick" :class="{'active': tabActive === 'quick'}" @click="changeTab('quick')">{{ $t("SelectUserCore.quickSetting") }}</li>
      </ul>

      <ul class="tab-list" v-if="isInOption">
        <li v-if="!props.hideDepartmentTab" :class="{'active': tabActive === 'department'}" @click="changeTab('department')">{{ $t("SelectUserCore.department") }}</li>
        <li v-if="!props.hideRoleTab" :class="{'active': tabActive === 'role'}" @click="changeTab('role')">{{ $t("SelectUserCore.role") }}</li>
        <li :class="{'active': tabActive === 'member'}" @click="changeTab('member')">{{ $t("SelectUserCore.member") }}</li>
        <li v-if="props.isShowQuick" :class="{'active': tabActive === 'quick'}" @click="changeTab('quick')">{{ $t("SelectUserCore.quickSetting") }}</li>
      </ul>

      <el-input class="search-input" v-model="searchValue" :placeholder="$t('SelectUserCore.search')" clearable>
        <template #prefix>
          <el-icon class="el-input__icon"><i-workbench-search /></el-icon>
        </template>
      </el-input>
      <el-breadcrumb :separator-icon="separatorIcon" v-if="searchValue.trim() === ''">
        <template v-for="(breadcrumb, index) in collapsedBreadcrumb" :key="breadcrumb.name + index">
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
      <el-checkbox  
        :label="$t('SelectUserCore.selectAll')" 
        :model-value="isSelectAll"
        @change="(checked) => handleChangeAll(checked)"
        :indeterminate="indeterminateAll"
        v-if="multiple"
        :disabled="isEmptyList || disableSelectAll()"
      />
      <div class="show-list">
        <el-scrollbar class="scroll-container" :min-size="10">
          <!-- 成员 -->
          <div
            class="department-item"
            v-for="item in showData"
            :key="item.id + 'meb'"
            v-if="tabActive === 'member'"
            @click="() => {
              if(!item.user && isEnterDepartment(item.id)) {
                toDepartment(item.id)
              }
            }"
          >
            <el-checkbox  
              :label="item.id" 
              :model-value="checkedMap(item.id)"
              @change="(checked) => handleChangeChecked(checked, item.id)"
              :indeterminate="!item.user && indeterminateMap(item.id)"
              v-if="item.user"
              :disabled="isDisabledCheck(item.id, item.departments, item.roles)"
            >
              <span>{{ item.name }}<span v-if="item.staffNo">（{{ item.staffNo }}）</span></span>
            </el-checkBox>
            <span v-else class="group-name">
              <el-icon>
                <i-ep-minus></i-ep-minus>
              </el-icon>
              {{ item.name }}
            </span>
            <el-icon 
              v-if="!item.user && isEnterDepartment(item.id)" 
              size="16" 
              class="next-icon"
              @click.stop="toDepartment(item.id)"
            >
              <i-workbench-arrow-right />
            </el-icon>
          </div>
          <!-- 角色 -->
          <div class="department-item" v-for="item in showRoleData" :key="item.id + 'dep'" v-if="tabActive === 'role'">
            <el-checkbox  
              :label="item.id" 
              :model-value="checkedMap(item.id)"
              @change="(checked) => handleChangeRoleChecked(checked, item)"
              :indeterminate="!item.user && indeterminateMap(item.id)"
            >
              <span>{{ item.name }}</span>
            </el-checkBox>
          </div>
          <!-- 部门 -->
          <div class="department-item" v-for="item in showData.filter(data => !data.user)" :key="item.id + 'dep'" v-if="tabActive === 'department'">
            <el-checkbox  
              :label="item.id" 
              :model-value="checkedMap(item.id)"
              @change="(checked) => handleChangeDepChecked(checked, item)"
              :indeterminate="!item.user && indeterminateMap(item.id)"
              :disabled="isDisabledCheck(item.id)"
            >
              <span>{{ item.name }}</span>
            </el-checkBox>
            <el-icon 
              size="16" 
              class="next-icon"
              @click="toDepartment(item.id)"
              v-if="isEnterDepartment(item.id)"
            >
              <i-workbench-arrow-right />
            </el-icon>
          </div>
          <!-- 快捷 -->
          <div class="department-item" v-if="tabActive === 'quick'" v-for="item in quickOptionList" :key="item.value">
            <el-checkbox
              :model-value="tabList.dynamic.includes(item.value)"
              @change="(checked) => handleChangeDynamicChecked(checked, item.value)"
              :disabled="isDisabledCheck(item.value)"
            >
              <span>{{ item.label }}</span>
            </el-checkBox>
          </div>
        </el-scrollbar>
      </div>
    </div>
    <div class="select-user-list">
      <el-tag type="info"
        v-for="tab in tabList.users.filter(tab => {
          return !isOnlyAdd || !isAddUser.includes(tab?.id);
        })" 
        :closable="!isOnlyAdd || !isAddUser.includes(tab?.id)"
        @close="handleCloseTab(tab?.id)"
      >
        {{ getSelectedUserDisplayName(tab) }}<span v-if="tab.staffNo">（{{ tab.staffNo }}）</span>
      </el-tag>
      <el-tag type="info"
        v-for="tab in tabList.departments.filter(tab => {
          return !isOnlyAdd || !isAddUser.includes(tab?.id);
        })" 
        :closable="!isOnlyAdd || !isAddUser.includes(tab?.id)"
        @close="handleCloseTab(tab?.id)"
      >
        {{ tab?.realname || tab?.name }}
      </el-tag>
      <el-tag type="info"
        v-for="tab in tabList.roles.filter(tab => {
          return !isOnlyAdd || !isAddUser.includes(tab?.id);
        })" 
        :closable="!isOnlyAdd || !isAddUser.includes(tab?.id)"
        @close="handleCloseTab(tab?.id)"
      >
        {{ tab?.realname || tab?.name }}
      </el-tag>
      <el-tag type="info"
        v-if="isInWidget || isInOption"
        v-for="tab in tabList.dynamic" 
        @close="handleCloseTab(tab)"
        closable
      >
        {{ getDynamicName(tab) }}
      </el-tag>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { Account, NocodeUser, Department, Role, Dynamic } from '@common/types/account';
import { ORGANIZE_UTIL } from '@renderer/types';
import { computed, inject, ref, unref, watch } from 'vue';
import axios from 'axios';
import { CheckboxValueType } from 'element-plus';
import { usePassportStore } from '@renderer/stores';
import i18next from 'i18next';
import { getUserDisplayName } from '@renderer/utils/other';

interface BreadcrumbItem {
  name: string;
  id: string;
  children?: BreadcrumbItem[];
}

const props = withDefaults(defineProps<{
  readonly?: boolean;
  onlyUsers?: boolean;
  multiple?: boolean;
  type?: "department" | "member" | "role" | "quick";
  tableList?: {
    departments: Department[];
    roles: Role[];
    users: NocodeUser[];
    dynamic: string[];
  };
  isOnlyAdd: boolean;
  isAvailable: boolean;
  availableValue?: {
    departments: Department[];
    roles: Role[];
    users: NocodeUser[];
    dynamic: string[];
  };
  disabledUid?: string | string[];
  isSetting?: boolean;
  isSetDefault?: boolean;
  isInWidget?: boolean;
  isInOption?: boolean;
  isShowQuick?: boolean;
  hideRoleTab?: boolean;
  hideDepartmentTab?: boolean;
  quickOptions?: Array<{ label: string, value: string }>;
}>(), {
  multiple: true,
  type: "member",
  isOnlyAdd: false,
  isSetDefault: false,
  isInWidget: false,
  isInOption: false,
  isShowQuick: true,
  hideRoleTab: false,
  hideDepartmentTab: false,
  quickOptions: () => []
});

const passportState = usePassportStore();
const organizeUtil = inject(ORGANIZE_UTIL);
const getInitialTabActive = () => {
  const initialType = (props.isSetting && !props.isSetDefault) ? 'department' : props.type;
  return props.hideDepartmentTab && initialType === 'department' ? 'member' : initialType;
}
const tabActive = ref(getInitialTabActive());
const separatorIcon = IWorkbenchArrowRight;
const searchValue = ref('');
const activeDepartmentId = ref(""); //面包屑当前选中的部门id
const departments = ref([]);
const users = ref([]);
const roles = ref([])
const tabList = ref({
  departments: [],
  roles: [],
  users: [],
  dynamic: []
}); //右侧展示的用户列表
const companyName = ref(''); //公司名称
const isAddUser = ref([])
const quickOptionList = computed(() => {
  if (Array.isArray(props.quickOptions) && props.quickOptions.length) {
    return props.quickOptions.filter(item => item?.value && item?.label);
  }
  if (props.type === 'department') {
    return [{ label: i18next.t("SelectUserCore.currentMemberDep"), value: Dynamic.CURRENT_DEPARTMENT }];
  }
  return [{ label: i18next.t("SelectUserCore.currentMember"), value: Dynamic.CURRENT_USER }];
});

const filterInvalidSelectionItems = (list = []) => {
  return list.filter(item => item?.id)
}

const normalizeTabList = (value = props.tableList) => {
  const nextValue = value || {
    departments: [],
    roles: [],
    users: [],
    dynamic: []
  }

  return {
    departments: filterInvalidSelectionItems(nextValue.departments || []),
    roles: filterInvalidSelectionItems(nextValue.roles || []),
    users: filterInvalidSelectionItems(nextValue.users || []),
    dynamic: (nextValue.dynamic || []).filter(item => Boolean(item))
  }
}

const getSelectedUserDisplayName = (user?: NocodeUser) => {
  return getUserDisplayName(user, '')
}


const initTablist = () => {
  const normalized = normalizeTabList(props.tableList)
  tabList.value = normalized
  isAddUser.value = tabList.value.users.map(user => user.id)
}

watch(
  () => props.tableList,
  () => {
    initTablist()
  },
  { immediate: true, deep: true }
)

const normalizeAvailableEntities = <T extends { id?: string }>(list: T[] = []) => {
  return list.filter((item): item is T & { id: string } => Boolean(item?.id))
}

const normalizedAvailableValue = computed(() => {
  const availableValue = props.availableValue || {
    departments: [],
    roles: [],
    users: [],
    dynamic: [],
  }
  availableValue.departments = normalizeAvailableEntities(availableValue.departments || [])
  availableValue.roles = normalizeAvailableEntities(availableValue.roles || [])
  availableValue.users = normalizeAvailableEntities(availableValue.users || [])

  return {
    departments: availableValue.departments || [],
    roles: availableValue.roles || [],
    users: availableValue.users || [],
    dynamic: (availableValue.dynamic || []).filter(Boolean),
    hasConfiguredScope:
      (availableValue.departments?.length || 0) > 0 ||
      (availableValue.roles?.length || 0) > 0 ||
      (availableValue.users?.length || 0) > 0 ||
      (availableValue.dynamic?.length || 0) > 0,
  }
})

const getDepartmentAncestorIdsForAvailable = (departmentIds: string[] = []) => {
  const parentDeps = new Set<string>()
  const visited = new Set<string>()

  const recursive = (depId: string) => {
    if (!depId || visited.has(depId)) return
    visited.add(depId)
    parentDeps.add(depId)

    const dep = departments.value.find(item => item.id === depId)
    if (dep?.parent) {
      recursive(dep.parent)
    }
  }

  for (const depId of departmentIds) {
    recursive(depId)
  }

  return parentDeps
}

const availableScope = computed(() => {
  const validDepartmentsSet = new Set<string>()
  const validUsersSet = new Set<string>()
  const {
    departments: availableDepartmentsList,
    roles: availableRolesList,
    users: availableUsersList,
    hasConfiguredScope,
  } = normalizedAvailableValue.value
  const availableDepartments = new Set(availableDepartmentsList.map(dep => dep.id))
  const availableRoles = new Set(availableRolesList.map(role => role.id))
  const hasAvailable = props.isAvailable && hasConfiguredScope

  if (!hasAvailable) {
    return {
      hasAvailable,
      validDepartmentsSet,
      validUsersSet,
    }
  }

  const addDepartmentAncestors = (depId: string) => {
    getDepartmentAncestorIdsForAvailable([depId]).forEach(item => validDepartmentsSet.add(item))
  }

  const addDepartmentDescendants = (depId: string) => {
    if (!depId || validDepartmentsSet.has(depId)) return
    validDepartmentsSet.add(depId)
    departments.value
      .filter(item => item.parent === depId)
      .forEach(item => addDepartmentDescendants(item.id))
  }

  availableDepartments.forEach(depId => {
    addDepartmentAncestors(depId)
    addDepartmentDescendants(depId)
  })

  availableUsersList.forEach(user => {
    validUsersSet.add(user.id)
    user.departments?.forEach(depId => addDepartmentAncestors(depId))
  })

  users.value.forEach(user => {
    const parentDepartments = getDepartmentAncestorIdsForAvailable(user.departments || [])
    const matchDepartment = [...parentDepartments].some(depId => availableDepartments.has(depId))
    const matchRole = user.roles?.some(roleId => availableRoles.has(roleId))

    if (!matchDepartment && !matchRole) return

    validUsersSet.add(user.id)
    user.departments?.forEach(depId => addDepartmentAncestors(depId))
  })

  return {
    hasAvailable,
    validDepartmentsSet,
    validUsersSet,
  }
})

const getNextBreadCrumb = (activeId: string = activeDepartmentId.value): BreadcrumbItem[] => {
  const breadcrumb: BreadcrumbItem[] = [];

  let currentId = activeId;

  while (currentId !== "") {
    const current = departments.value.find(dep => dep.id === currentId);
    if (!current) break;

    breadcrumb.push({
      name: current.name,
      id: current.id,
    });

    currentId = current.parent;
  }

  return breadcrumb.reverse();
};

const collapsedBreadcrumb = computed(() => {
  const list: BreadcrumbItem[] =  [{
    name: companyName.value, //根目录显示全部部门
    id: "",
  }];
  if (activeDepartmentId.value !== '') {
    list.push(...getNextBreadCrumb());
  }
  if (list.length <= 3) return list;

  return [
    list[0],
    {
      name: '...',
      id: '',
      children: list.slice(1, list.length - 1),
    },
    list[list.length - 1],
  ];
});

const showData = computed(() => {
  const isRoot = activeDepartmentId.value === '';
  const search = searchValue.value.trim();
  const { hasAvailable, validDepartmentsSet, validUsersSet } = availableScope.value

  if(search === '') {
    // 当前部门下的子部门
    const childDepartments = departments.value.filter(dep => dep.parent === activeDepartmentId.value && (!hasAvailable || validDepartmentsSet.has(dep.id)));
    const filteredDepartments = props.onlyUsers ? [] : childDepartments.filter(dep => dep.name);

    // 当前部门下的用户（部门 ID 匹配）
    const matchedUsers = users.value
      .filter(user => user.departments?.includes(activeDepartmentId.value) && user.realname && (!hasAvailable || validUsersSet.has(user.id)))
      .map(user => ({ ...user, name: user.realname }));

    // 根部门下，额外追加未分配部门的用户
    const unassignedUsers = isRoot
      ? users.value
        .filter(user => (!user.departments || user.departments.length === 0) && user.realname && (!hasAvailable || validUsersSet.has(user.id)))
        .map(user => ({ ...user, name: user.realname }))
      : [];
    return [...filteredDepartments, ...matchedUsers, ...unassignedUsers];
  } else {
    // 搜索部门
    const filteredDepartments = props.onlyUsers ? [] : departments.value.filter(dep => dep.name.includes(search) && (!hasAvailable || validDepartmentsSet.has(dep.id)));
    // 搜索用户
    const filteredUsers = isRoot
      ? users.value
        .filter(user => user.realname.includes(search) && (!hasAvailable || validUsersSet.has(user.id)))
        .map(user => ({ ...user, name: user.realname })) 
      : [];
    return [...filteredDepartments, ...filteredUsers];
  }
});

const showRoleData = computed(() => {
  const search = searchValue.value.trim();

  if(search === '') {
    return roles.value;
  } else {
    return roles.value.filter(role => role.name.includes(search));
  }
});

const isEnterDepartment = (id) => {
  // 当前部门下的子部门
  const childDepartments = props.onlyUsers ? [] : departments.value.filter(dep => dep.parent === id);
  // 当前部门下的用户（部门 ID 匹配）
  const matchedUsers = users.value
    .filter(user => user.departments?.includes(id))
    .map(user => ({ ...user, name: user.realname }));
  if(childDepartments.length) {
    return true
  }
  if(matchedUsers.length && tabActive.value === 'member') {
    return true
  }
  return false
}

const initData = async () => {
  await organizeUtil?.getDepartments();
  departments.value = (organizeUtil?.departments || []).filter((department) => department.name !== i18next.t("SelectUserCore.systemAdminGroup"));
  await organizeUtil?.getUsers();
  users.value = (organizeUtil?.users || []).filter((user: Account) => user.user !== 'admin');
  await organizeUtil?.getRoles();
  roles.value = (organizeUtil?.roles || []);

  await axios.get('/workbench/get-company-name').then(res => {
    companyName.value = res.data;
  }).catch(err => {
    console.log(err);
  })
}

const toDepartment = (id: string) => {
  if (props.readonly) return;
  activeDepartmentId.value = id;
}

const getDepIdsWithChildren = (ids: string[]): string[] => {
  const allDepIds = new Set(ids);
  // 递归查找所有子部门
  const findChildren = (parentIds: string[]) => {
    parentIds.forEach(parentId => {
      const children = departments.value.filter(dep => dep.parent === parentId).map(dep => dep.id);
      children.forEach(childId => {
        if (!allDepIds.has(childId)) {
          allDepIds.add(childId);
          findChildren([childId]);
        }
      });
    });
  };
  findChildren(ids);
  return Array.from(allDepIds);
};


const getUsersUnderDep = (depId: string) => {
  const allDepIds = getDepIdsWithChildren([depId]);
  return users.value.filter(user =>
    user.departments?.some(did => allDepIds.includes(did))
  );
};

const isUserChecked = (userId: string) => {
  return tabList.value.users.some(u => u?.id === userId);
};

const isRoleChecked = (userId: string) => {
  return tabList.value.roles.some(u => u?.id === userId);
};

const isDepartmentChecked = (userId: string) => {
  return tabList.value.departments.some(u => u?.id === userId);
};

const isDepartment = (id: string) => {
  return departments.value.some(dep => dep?.id === id);
};

const indeterminateAll = computed(() => {
  if(isEmptyList.value) {
    return true
  }
  if(!isSelectAll.value) {
    if(tabActive.value === 'member' || tabActive.value === 'department') {
      for(const item of showData.value) {
        if(checkedMap.value(item.id)) {
          return true
        }
      }
    } else if(tabActive.value === 'role') {
      for(const item of showRoleData.value) {
        if(checkedMap.value(item.id)) {
          return true
        }
      }
    }
  }
  return false
})

const isEmptyList = computed(() => {
  if(tabActive.value === 'department') {
    for(const item of showData.value) {
      if(isDepartment(item.id)) {
        return false
      }
    }
    return true
  } else if(tabActive.value === 'member') {
    for(const item of showData.value) {
      if(!isDepartment(item.id)) {
        return false
      }
    }
    return true
  } else if(tabActive.value === 'role') {
    return showRoleData.value.length === 0
  }
  return true
})

const disableSelectAll = () => {
  if(!props.isOnlyAdd && !props.isAvailable) return false
  for(const item of showData.value) {
    if(!isDepartment(item.id) && isAddUser.value.includes(item.id)) {
      return true
    }
    if(isDisabledCheck(item.id)) {
      if(tabActive.value === 'member' && !isDepartment(item.id)) {
        return true
      } else if(tabActive.value === 'department') {
        return true
      }
    }
  }
  return false
}

// 去重 Account[]，以 user.id 为 key
const dedupeUsers = (list: Account[]) => {
  const map = new Map<string, Account>();
  list.forEach(user => {
    if (!user?.id || map.has(user.id)) return;
    map.set(user.id, user);
  });
  return Array.from(map.values());
};

const handleChangeChecked = (value: CheckboxValueType, id: string) => {
  const user = users.value.find(u => u.id === id);
  if (!user) return;
  if(props.multiple) {
    if (value) {
      tabList.value.users = dedupeUsers([...tabList.value.users, user]);
    } else {
      tabList.value.users = tabList.value.users.filter(u => u?.id !== user.id);
    }
  } else {
    if (value) {
      tabList.value = {
        departments: [],
        roles: [],
        users: [],
        dynamic: []
      }
      tabList.value.users = dedupeUsers([user]);
    } else {
      tabList.value.users = []
    }
  }
};

const handleChangeAll = (value: CheckboxValueType) => {
  if(isSelectAll.value === value) {
    value = !value
  }
  if(tabActive.value === 'department') {
    for(const item of showData.value) {
      handleChangeDepChecked(value, item)
    }
  } else if(tabActive.value === 'member') {
    for(const item of showData.value) {
      if(!isDepartment(item.id)) {
        handleChangeChecked(value, item.id)
      }
    }
  } else if(tabActive.value === 'role') {
    for(const item of showRoleData.value) {
      if(!isDepartment(item.id)) {
         handleChangeRoleChecked(value, item)
      }
    }
  }
}

const handleChangeDepChecked = (value: CheckboxValueType, item) => {
  const dep = departments.value.find(u => u.id === item.id);
  if (!dep) return;
  if(props.multiple) {
    if(value) {
      if (!tabList.value.departments.some(tab => tab?.id === item.id)) {
        tabList.value.departments.push(item);
      }
    } else {
      tabList.value.departments = tabList.value.departments.filter(u => u?.id !== dep.id);

    }
  } else {
    if(value) {
      tabList.value = {
        departments: [],
        roles: [],
        users: [],
        dynamic: []
      }
      tabList.value.departments.push(item)
    } else {
      tabList.value.departments = []
    }
  }
}

const handleChangeRoleChecked = (value: CheckboxValueType, item) => {
  const role = roles.value.find(u => u.id === item.id);
  if (!role) return;
  if(props.multiple) {
    if (value) {
      if (!tabList.value.roles.some(tab => tab?.id === item.id)) {
        tabList.value.roles.push(item);
      }
    } else {
      tabList.value.roles = tabList.value.roles.filter(u => u?.id !== role.id);
    }
  } else {
    if (value) {
      tabList.value= {
        departments: [],
        roles: [],
        users: [],
        dynamic: []
      }
      tabList.value.roles.push(item)
    } else {
      tabList.value.roles = []
    }
  }
}

const handleChangeDynamicChecked = (value: CheckboxValueType, dynamic: string) => {
  if(!props.multiple) {
    tabList.value = {
      departments: [],
      roles: [],
      users: [],
      dynamic: []
    }
  }
  if(value) {
    tabList.value.dynamic.push(dynamic)
  } else {
    tabList.value.dynamic = tabList.value.dynamic.filter(item => item !== dynamic)
  }
};

const indeterminateMap = computed(() => {
  return (depId: string): boolean => {
    const usersUnderDep = getUsersUnderDep(depId);
    if (usersUnderDep.length === 0) return false;

    const selectedCount = usersUnderDep.filter(u => isUserChecked(u.id)).length;
    return selectedCount > 0 && selectedCount < usersUnderDep.length;
  };
});

const checkedMap = computed(() => {
  return (id: string): boolean => {
    if (tabActive.value === "member") {
      return isUserChecked(id);
    } else if(tabActive.value === 'role') {
      return isRoleChecked(id);
    } else if(tabActive.value === 'department') {
      return isDepartmentChecked(id);
    }
    return false
  };
});

const isSelectAll = computed(() => {
  if(isEmptyList.value) {
    return false
  }
  let result = true
  if(tabActive.value === 'role') {
    for(const item of showRoleData.value) {
      if(!checkedMap.value(item.id)) {
        result = false
      }
    }
  } else {
    for(const item of showData.value) {
      if(!checkedMap.value(item.id)) {
        if(tabActive.value === 'member' && !isDepartment(item.id)) {
          result = false
        } else if(tabActive.value === "department" && isDepartment(item.id)){
          result = false
        }
      }
    }
  }
  return result
})
const useDisabledUid = computed(() => {
  if(!Array.isArray(props.disabledUid)) return [props.disabledUid];
  return props.disabledUid
})
const isDisabledCheck = (id, depIds = undefined, roleIds = undefined) => {
  if(props.isOnlyAdd && isAddUser.value.includes(id)) {
    return true
  }
  if(useDisabledUid.value.includes(id)) return true;
  const {
    departments: availableDepartments,
    roles: availableRoles,
    users: availableUsers,
    dynamic: availableDynamic,
    hasConfiguredScope,
  } = normalizedAvailableValue.value

  if(props.isAvailable && hasConfiguredScope && props.type === 'member') {
    if(id === Dynamic.CURRENT_USER && availableDynamic.includes(Dynamic.CURRENT_USER)) {
      return false
    } else if(id === Dynamic.CURRENT_USER) {
      return true
    }
    let result = true

    if(availableUsers.some(item => item.id === id)) {
      result = false
    }

    if(depIds) {
      for(const depId of getParentDepartmentIds(depIds)) {
        if(availableDepartments.some(item => item.id === depId)) {
          result = false
        }
      }
    }

    if(roleIds) {
      for(const roleId of roleIds) {
        if(availableRoles.some(item => item.id === roleId)) {
          result = false
        }
      }
    }
    return result
  } else if(props.isAvailable && hasConfiguredScope && props.type === 'department') {
    if(id === Dynamic.CURRENT_DEPARTMENT && availableDynamic.includes(Dynamic.CURRENT_DEPARTMENT)) {
      return false
    } else if(id === Dynamic.CURRENT_DEPARTMENT) {
      return true
    }
    let result = true

    const parentDepartments = getParentDepartmentIds([id])

    for(const depId of parentDepartments) {
      if(availableDepartments.some(item => item.id === depId)) {
        result = false
      }
    }
    return result
  }
  return false
}

const getParentDepartmentIds = (departmentIds) => {
  const parentDeps = new Set()
  const visited = new Set()

  const recursive = (depId) => {
    if (visited.has(depId)) return
    visited.add(depId)

    parentDeps.add(depId)

    const dep = organizeUtil.departments.find(item => item.id === depId)
    if (!dep) return

    const parentId = dep.parent
    if (parentId) {
      recursive(parentId)
    }
  }

  for (const depId of departmentIds) {
    recursive(depId)
  }

  return [...parentDeps]
}

const handleCloseTab = (id: string) => {
  tabList.value.departments = tabList.value.departments.filter((item) => item?.id !== id);
  tabList.value.roles = tabList.value.roles.filter((item) => item?.id !== id);
  tabList.value.users = tabList.value.users.filter((item) => item?.id !== id);
  tabList.value.dynamic = tabList.value.dynamic.filter((item) => item !== id);
}

initData();

defineExpose({
  serialize: () => {
    return unref(tabList.value.users).filter((item) => item?.id).map((item) => item.id);
  },
  deserialize: (users: NocodeUser[], departmentId: string = "") => {
    tabList.value.users = filterInvalidSelectionItems(users || []);
    activeDepartmentId.value = departmentId;
  },
  reset: () => {
    tabList.value.departments = [];
    tabList.value.roles = [];
    tabList.value.users = [];
    searchValue.value = '';
    activeDepartmentId.value = '';
  },
  getTabList: () => {
    return {
      departments: tabList.value.departments.map(item => ({ ...item })),
      roles: tabList.value.roles.map(item => ({ ...item })),
      users: tabList.value.users.map(item => ({ ...item })),
      dynamic: [...tabList.value.dynamic],
    };
  }
})


const changeTab = (type) => {
  tabActive.value = type
  activeDepartmentId.value = ''
}

const getDynamicName = (type) => {
  const matchedOption = quickOptionList.value.find(item => item.value === type);
  if (matchedOption?.label) {
    return matchedOption.label;
  }
  if(type === Dynamic.CURRENT_DEPARTMENT) {
    return i18next.t("SelectUserCore.currentMemberDep")
  }
  if(type === Dynamic.CURRENT_USER) {
    return i18next.t("SelectUserCore.currentMember")
  }
  return type
}
</script>

<style lang='scss' scoped>
.select-user-core {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;


  .department-list {
    width: 59.375%;
    height: 100%;
    display: flex;
    flex-direction: column;
    row-gap: 8px;
    padding-right: 16px;
    border-right: 1px solid var(--border-color);

    .tab-list {
      display: flex;
      height: 32px;
      gap: 16px;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 8px;

      li {
        height: 32px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        transition: all 0.3s ease;
        border-bottom: 2px solid transparent;
        border-top: 2px solid transparent;

        &.active {
          border-bottom: 2px solid var(--color-primary);
          color: var(--color-primary);
        }
      }
    }

    .el-input {
      :deep(.el-input__wrapper) {
        width: 320px;
        height: 32px;
        background-color: var(--bg-color-overlay);
        border-radius: 4px;
        box-shadow: unset;

        &:hover {
          box-shadow: 0 0 0 1px var(--border-color) inset;
        }

        &.is-focus {
          box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
        }
      }
    }

    :deep(.el-breadcrumb) {
      display: flex;
      width: 100%;
      height: 25px;
      overflow: hidden;
      margin-top: 8px;

      :last-child {
        span {
          cursor: var(--cursor-default);
          color: var(--text-color-regular);
        }
      }

      .el-breadcrumb__item {

        :deep(.el-breadcrumb__inner) {
          max-width: 103px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          cursor: pointer;

          .el-breadcrumb__separator {
            font-size: 16px;
            margin: 0;
          }
        }

        &>span,
        .menu-icon {
          color: var(--text-color-placeholder);

          :focus-visible {
            outline: none;
          }

          &:hover {
            color: var(--text-color);
          }
        }
      }

    }

    .show-list {
      width: 100%;
      flex: 1;
      min-height: 0;

      .scroll-container {
        height: 100%;
      }

      .el-scrollbar__view {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;

        .department-item {
          width: 100%;
          height: 32px;
          display: flex;
          justify-content: space-between;
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.3s ease;

          .group-name {
            display: flex;
            align-items: center;
            padding-left: 8px;

            .el-icon {
              margin-right: 8px;
              color: var(--text-color-placeholder);
            }
          }

          &:hover {
            background-color: var(--bg-color-overlay);
          }

          :deep(.el-checkbox) {
            width: calc(100% - 32px);
            border-radius: 4px;
            padding-left: 8px;
            cursor: var(--cursor-pointer);

            .el-checkbox__input {
              display: none;
            }
            .el-checkbox__label {
              display: inline-block;
              width: 16px;
              height: 16px;
              padding-left: 24px;
              background-image: url('@renderer/assets/image/checkbox-unselected.png');
              background-size: contain;
              background-repeat: no-repeat;
            }
            &.is-checked .el-checkbox__label {
              background-image: url('@renderer/assets/image/checkbox-selected.png');
            }
            &.is-disabled .el-checkbox__label {
              background-image: url('@renderer/assets/image/checkbox-unselected-disabled.png');
            }
            &.is-checked.is-disabled .el-checkbox__label {
              background-image: url('@renderer/assets/image/checkbox-selected-disabled.png');
            }
          }

          .next-icon {
            width: 32px;
            height: 32px;
            border-radius: 4px;

            &:hover {
              background-color: var(--bg-color-hover);
            }
          }
        }

      }
    }
  }

  .select-user-list {
    width: 40.625%;
    height: 100%;
    padding-left: 16px;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    justify-content: flex-start;
    gap: 8px;

    :deep(.el-tag) {
      height: 32px;
      padding: 6px 8px 6px 8px;
      border: none;
      --el-tag-text-color: var(--text-color-regular);

      .el-tag__content {
        font-size: 14px;
      }

      .el-tag__close {
        font-size: 16px;
      }
    }
  }

}

:deep(.el-breadcrumb__item) {
  cursor: pointer;
}
</style>

<style lang="scss">
.workbench-breadcrumb-menu-popper {
  .el-dropdown__popper.el-popper {
    border: unset;
  }
  .el-dropdown-menu {
    background-color: var(--bg-color-page);
    border-radius: 4px;
    box-shadow: 0px 6px 16px 0px #00000014;
    padding: 2px;

    .el-dropdown-menu__item {
      padding: 8px 12px;
      text-align: left;
      width: 196px;
      height: 32px;
      &>span {
        width: 100%;
        text-overflow: ellipsis;
        white-space: nowrap;
        overflow: hidden;
      }
    }

  }
  .el-popper__arrow {
    display: none;
  }
}
</style>
