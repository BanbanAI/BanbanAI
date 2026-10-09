<template>
  <div class="mobile-select-user-core">
    <div class="search-container">
      <el-input class="search-input" v-model="searchValue" :placeholder="$t('MobileSelectUserCore.searchMember')" clearable>
        <template #prefix>
          <el-icon class="el-input__icon"><i-workbench-search /></el-icon>
        </template>
      </el-input>
    </div>

    <ul class="tab-list">
      <li :class="{'active': uiTab === 'dataList'}" @click="changeUiTab('dataList')">{{ dataListTabName }}</li>
      <li v-if="props.isShowQuick" :class="{'active': uiTab === 'quick'}" @click="changeUiTab('quick')">{{ $t('MobileSelectUserCore.quickSettings') }}</li>
      <li :class="{'active': uiTab === 'selected'}" @click="changeUiTab('selected')">
        {{ $t('MobileSelectUserCore.selected') }}
        <!-- <span v-if="selectedCount > 0">({{ selectedCount }})</span> -->
      </li>
    </ul>

    <div class="content-area" v-show="uiTab === 'dataList' || uiTab === 'quick' || tabList.users.length !== 0 || tabList.departments.length !== 0 || tabList.roles.length !== 0 || tabList.dynamic.length !== 0">

      <div class="list-container" v-if="newCurrentType === 'member' || newCurrentType === 'department' || (newCurrentType === 'role' && !props.hideRoleTab)">
        <!-- 成员 -->
        <div class="list-item-wrap member" :class="`item-${item.level || 0}`" v-if="newCurrentType === 'member' && uiTab === 'dataList'" v-for="item in displayList" :key="item.id">
          <div class="list-item department-item" v-if="!item.user" @click="toggleDepartment(item.id)">
            <div class="item-info">
              <el-icon class="item-icon"><i-nocode-user-folder /></el-icon>
              <span class="item-name">{{ item.name }}</span>
            </div>
            <el-icon class="expand-icon" :class="{ 'is-expanded': expandedDepartmentIds.has(item.id) }"><i-workbench-arrow-right /></el-icon>
          </div>
          <div class="list-item user-item" v-else @click="handleMemberClick(item)">
            <div class="item-info">
              <div class="avatar">{{ item.name ? item.name.substring(0, 1) : '' }}</div>
              <span class="item-name">{{ item.name }}<span v-if="item?.staffNo">（{{ item.staffNo }}）</span></span>
            </div>
            <el-checkbox
              :model-value="checkedMap(item.id)"
              :indeterminate="indeterminateMap(item.id)"
              :disabled="isDisabledCheck(item.id, item.departments, item.roles)"
            />
          </div>
        </div>
        <!-- 部门 -->
        <div class="list-item-wrap department" :class="`item-${item.level || 0}`" v-if="newCurrentType === 'department' && uiTab === 'dataList'" v-for="item in displayList.filter(data => !data.user)" :key="item.id">
          <div class="list-item department-item" @click="handleDepClick(item)">
            <div class="item-info">
              <el-icon class="item-icon"><i-nocode-user-folder /></el-icon>
              <span class="item-name">{{ item.name }}</span>
            </div>
            <el-checkbox
              :model-value="checkedMap(item.id)"
              :indeterminate="indeterminateMap(item.id)"
              :disabled="isDisabledCheck(item.id)"
            />
            <el-icon
              v-if="!isDepartmentCheckbox(item.id)"
              class="expand-icon"
              :class="{ 'is-expanded': expandedDepartmentIds.has(item.id) }"
              @click.stop="toggleDepartment(item.id)"
            ><i-workbench-arrow-right /></el-icon>
          </div>
        </div>
        <!-- 角色 -->
        <div class="list-item-wrap role" v-if="newCurrentType === 'role' && !props.hideRoleTab && uiTab === 'dataList'" v-for="item in showRoleData" :key="item.id">
          <div class="list-item role-item" @click="handleRoleClick(item)">
            <div class="item-info">
              <el-icon class="item-icon"><i-ep-user /></el-icon>
              <span class="item-name">{{ item.name }}</span>
            </div>
            <el-checkbox
              v-if="isDepartmentCheckbox(item.id)"
              :model-value="checkedMap(item.id)"
              :indeterminate="indeterminateMap(item.id)"
              :disabled="isDisabledCheck(item.id)"
            />
            <el-icon v-else class="expand-icon" :class="{ 'is-expanded': expandedDepartmentIds.has(item.id) }"><i-workbench-arrow-right /></el-icon>
          </div>
        </div>
      </div>

      <div class="list-container" v-if="uiTab === 'quick'">
        <div class="list-item-wrap" v-for="item in quickOptionList" :key="item.value">
          <div class="list-item quick-item" @click="handleDynamicClick(item.value)">
            <div class="item-info">
              <div class="avatar" v-if="newCurrentType === 'member'">{{ item.label.substring(0, 1) }}</div>
              <el-icon class="item-icon" v-else><i-nocode-user-folder /></el-icon>
              <span class="item-name">{{ item.label }}</span>
            </div>
            <el-checkbox
              :model-value="tabList.dynamic.includes(item.value)"
              :disabled="isDisabledCheck(item.value)"
            />
          </div>
        </div>
      </div>

      <div class="list-container" v-if="uiTab === 'selected'">
        <div class="list-item-wrap" v-if="getSelectedList('member').length > 0" v-for="tab in getSelectedList('member')" :key="tab.id + '-sel-user'">
          <div class="list-item selected-item">
            <div class="item-info">
              <div class="avatar">{{ getSelectedUserAvatar(tab) }}</div>
              <span class="item-name">{{ getSelectedUserDisplayName(tab) }}<span v-if="tab?.staffNo">（{{ tab.staffNo }}）</span></span>
            </div>
            <el-icon class="remove-icon" @click="handleCloseTab(tab?.id)"><i-ep-close-bold /></el-icon>
          </div>
        </div>
        <div class="list-item-wrap" v-if="getSelectedList('department').length > 0" v-for="tab in getSelectedList('department')" :key="tab?.id + '-sel-dep'">
          <div class="list-item selected-item">
            <div class="item-info">
              <el-icon class="item-icon"><i-nocode-user-folder /></el-icon>
              <span class="item-name">{{ tab?.name }}</span>
            </div>
            <el-icon class="remove-icon" @click="handleCloseTab(tab?.id)"><i-ep-close-bold /></el-icon>
          </div>
        </div>
        <div class="list-item-wrap" v-if="getSelectedList('role').length > 0" v-for="tab in getSelectedList('role')" :key="tab?.id + '-sel-role'">
          <div class="list-item selected-item">
            <div class="item-info">
              <el-icon class="item-icon"><i-ep-user /></el-icon>
              <span class="item-name">{{ tab?.name }}</span>
            </div>
            <el-icon class="remove-icon" @click="handleCloseTab(tab?.id)"><i-ep-close-bold /></el-icon>
          </div>
        </div>
        <div class="list-item-wrap" v-if="getSelectedList('dynamic').length > 0" v-for="tab in getSelectedList('dynamic')" :key="tab?.id + '-sel-dynamic'">
          <div class="list-item selected-item">
            <div class="item-info">
              <div class="avatar" v-if="newCurrentType === 'member'">{{ getQuickName(tab)?.substring(0, 1) }}</div>
              <el-icon class="item-icon" v-if="newCurrentType === 'department'"><i-nocode-user-folder /></el-icon>
              <span class="item-name">{{ getQuickName(tab) }}</span>
            </div>
            <el-icon class="remove-icon" @click="handleCloseTab(tab)"><i-ep-close-bold /></el-icon>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang='ts' setup>
import { Account, NocodeUser, Department, Role, Dynamic } from '@common/types/account';
import { ORGANIZE_UTIL } from '@renderer/types';
import { computed, inject, unref, ref, watch } from 'vue';
import { CheckboxValueType } from 'element-plus';
import { usePassportStore } from '@renderer/stores';
import axios from 'axios';
import i18next from 'i18next';
import { getUserBaseName, getUserDisplayName } from '@renderer/utils/other';

const props = withDefaults(defineProps<{
  readonly?: boolean;
  onlyUsers?: boolean;
  multiple?: boolean;
  currentType?: "department" | "member" | "role" | "quick";
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
  currentType: "member",
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
const newCurrentType = computed(() => {
  const currentType = (props.isSetting && !props.isSetDefault) ? 'department' : props.currentType;
  return props.hideDepartmentTab && currentType === 'department' ? 'member' : currentType;
});


const organizeUtil = inject(ORGANIZE_UTIL);
const uiTab = ref('dataList');
const searchValue = ref('');
const departments = ref([]);
const users = ref([]);
const roles = ref([]);
// 选中用户的列表
const tabList = ref({ departments: [], roles: [], users: [], dynamic: [] });
const isAddUser = ref([]);
const isSearching = ref(false);

const expandedDepartmentIds = ref(new Set<string>());
const quickOptionList = computed(() => {
  if (Array.isArray(props.quickOptions) && props.quickOptions.length) {
    return props.quickOptions.filter(item => item?.value && item?.label);
  }
  if (newCurrentType.value === 'department') {
    return [{ label: i18next.t('MobileSelectUserCore.currentMemberDept'), value: Dynamic.CURRENT_DEPARTMENT }];
  }
  return [{ label: i18next.t('MobileSelectUserCore.currentMember'), value: Dynamic.CURRENT_USER }];
});

const dataListTabName = computed(() => {
  if (newCurrentType.value === 'department') {
    return i18next.t('MobileSelectUserCore.department');
  } else if (newCurrentType.value === 'role') {
    return i18next.t('SelectUserCore.role');
  }
  return i18next.t('MobileSelectUserCore.member');
});

const filterInvalidSelectionItems = (list = []) => {
  return list.filter(item => item?.id);
};

const normalizeTabList = (value = props.tableList) => {
  const nextValue = value || { departments: [], roles: [], users: [], dynamic: [] };

  return {
    departments: filterInvalidSelectionItems(nextValue.departments || []),
    roles: filterInvalidSelectionItems(nextValue.roles || []),
    users: filterInvalidSelectionItems(nextValue.users || []),
    dynamic: (nextValue.dynamic || []).filter(item => Boolean(item)),
  };
};

const getSelectedUserDisplayName = (user?: NocodeUser) => {
  return getUserDisplayName(user, '');
};

const getSelectedUserAvatar = (user?: NocodeUser) => {
  return getUserBaseName(user, '').substring(0, 1);
};

const initTablist = () => {
  const normalized = normalizeTabList(props.tableList);
  tabList.value = normalized;
  isAddUser.value = tabList.value.users.map(user => user.id);
};
watch(() => props.tableList,
  () => {
    initTablist()
  },
  { immediate: true, deep: true }
);

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

  return {
    departments: normalizeAvailableEntities(availableValue.departments || []),
    roles: normalizeAvailableEntities(availableValue.roles || []),
    users: normalizeAvailableEntities(availableValue.users || []),
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

const showRoleData = computed(() => {
  const search = searchValue.value.trim();

  if(search === '') {
    return roles.value;
  } else {
    return roles.value.filter(role => role.name.includes(search));
  }
});

const isDepartmentCheckbox = (id) => {
  // 当前部门下的子部门
  const childDepartments = props.onlyUsers ? [] : departments.value.filter(dep => dep.parent === id);
  if(childDepartments.length) {
    // 有子部门则不显示多选框
    return false;
  }
  return true;
}

const displayList = computed(() => {
  const search = searchValue.value.trim();
  const { hasAvailable, validDepartmentsSet, validUsersSet } = availableScope.value
  if (search !== '') {
    const filteredDepartments = departments.value
      .filter(dep => dep.name.includes(search) && (!hasAvailable || validDepartmentsSet.has(dep.id)))
      .map(d => ({ ...d, level: 0 }));
    const filteredUsers = users.value
      .filter(user => user.realname?.includes(search) && (!hasAvailable || validUsersSet.has(user.id)))
      .map(user => ({ ...user, name: user.realname, user: true, level: 0 }));
    return [...filteredDepartments, ...filteredUsers];
  }

  const result: any[] = [];
  const buildTree = (parentId: string, level: number) => {
    // 当前部门下的子部门
    const childDepartments = departments.value.filter(d => d.parent === parentId && (!hasAvailable || validDepartmentsSet.has(d.id)));
    
    // 当前部门下的用户（部门 ID 匹配）
    const usersInDept = users.value
        .filter(u => u.departments?.includes(parentId) && u.realname && (!hasAvailable || validUsersSet.has(u.id)))
        .map(u => ({ ...u, name: u.realname }));

    // 合并并添加到结果列表中
    for (const dept of childDepartments) {
      result.push({ ...dept, level });
      if (expandedDepartmentIds.value.has(dept.id)) {
        buildTree(dept.id, level + 1);
      }
    }
    for (const user of usersInDept) {
        result.push({ ...user, level });
    }  
    
    // 根部门下，额外追加未分配部门的用户
    if (parentId === '') {
        const unassignedUsers = users.value
            .filter(u => (!u.departments || u.departments.length === 0) && u.realname && (!hasAvailable || validUsersSet.has(u.id)))
            .map(u => ({ ...u, name: u.realname, level: 0 }));
        result.push(...unassignedUsers);
    }
  };

  buildTree('', 0);
  return result;
});

const updateSearchFlag = (list: any[], searchWord: string) => {
  if (!searchWord) return list;
  return list.map(item => {
    let isSearchResult = false;
    if (item.name.includes(searchWord) || item.realname?.includes(searchWord)) {
      isSearchResult = true;
    }
    return {
      ...item,
      isSearchResult,
    }
  })
}

watch(() => searchValue.value, (value, oldValue) => {
  isSearching.value = !!value;
  tabList.value.users = updateSearchFlag(tabList.value.users, value);
  tabList.value.departments = updateSearchFlag(tabList.value.departments, value);
  tabList.value.roles = updateSearchFlag(tabList.value.roles, value);
});

const getSelectedList = (listType: 'member' | 'department' | 'role' | 'dynamic') => {
  const s = searchValue.value;
  if (listType === 'member') {
    return tabList.value.users.filter(i => isSearching.value ? i.realname?.includes(s) : true);
  } else if (listType === 'department') {
    return tabList.value.departments.filter(i => isSearching.value ? i.name?.includes(s) : true);
  } else if (listType === 'role') {
    return tabList.value.roles.filter(i => isSearching.value ? i.name?.includes(s) : true);
  } else if (listType === 'dynamic') {
    const dynamicMap = {}
    dynamicMap[Dynamic.CURRENT_USER] = i18next.t('MobileSelectUserCore.currentMember');
    dynamicMap[Dynamic.CURRENT_DEPARTMENT] = i18next.t('MobileSelectUserCore.currentMemberDept');
    return tabList.value.dynamic.filter(i => isSearching.value ? dynamicMap[i]?.includes(s) : true);
  }
}

async function initData() {
  await organizeUtil?.getDepartments();
  departments.value = (organizeUtil?.departments || []).filter((d) => d.name !== i18next.t('MobileSelectUserCore.systemAdminGroup'));
  await organizeUtil?.getUsers();
  users.value = (organizeUtil?.users || []).filter((u: Account) => u.user !== 'admin');
  await organizeUtil?.getRoles();
  roles.value = (organizeUtil?.roles || []);
}

const toggleDepartment = (id: string) => {
  if (expandedDepartmentIds.value.has(id)) {
    expandedDepartmentIds.value.delete(id);
  } else {
    expandedDepartmentIds.value.add(id);
  }
};

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

const isUserChecked = (userId: string) => tabList.value.users.some(u => u?.id === userId);


const isRoleChecked = (userId: string) => {
  return tabList.value.roles.some(u => u?.id === userId);
};

const isDepartmentChecked = (id: string) => {
  return tabList.value.departments.some(dep => dep?.id === id);
};

const isDepartment = (id: string) => {
  return departments.value.some(dep => dep?.id === id);
};


const indeterminateAll = computed(() => {
  if(isEmptyList.value) {
    return true
  }
  if(!isSelectAll.value) {
    if(newCurrentType.value === 'member' || newCurrentType.value === 'department') {
      for(const item of displayList.value) {
        if(checkedMap.value(item.id)) {
          return true
        }
      }
    } else if(newCurrentType.value === 'role') {
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
  if(newCurrentType.value === 'department') {
    for(const item of displayList.value) {
      if(isDepartment(item.id)) {
        return false
      }
    }
    return true
  } else if(newCurrentType.value === 'member') {
    for(const item of displayList.value) {
      if(!isDepartment(item.id)) {
        return false
      }
    }
    return true
  } else if(newCurrentType.value === 'role') {
    return showRoleData.value.length === 0
  }
  return true
})

const disableSelectAll = () => {
  if(!props.isOnlyAdd && !props.isAvailable) return false
  for(const item of displayList.value) {
    if(!isDepartment(item.id) && isAddUser.value.includes(item.id)) {
      return true
    }
    if(isDisabledCheck(item.id)) {
      if(newCurrentType.value === 'member' && !isDepartment(item.id)) {
        return true
      } else if(newCurrentType.value === 'department') {
        return true
      }
    }
  }
  return false
}

const checkedMap = computed(() => {
  return (id: string): boolean => {
    if (newCurrentType.value === "member") {
      return isUserChecked(id);
    } else if(newCurrentType.value === 'role') {
      return isRoleChecked(id);
    } else if(newCurrentType.value === 'department') {
      return isDepartmentChecked(id);
    }
    return false;
  };
});
const selectedCount = computed(() => {
    return tabList.value.users.length + tabList.value.departments.length + tabList.value.roles.length + tabList.value.dynamic.length;
});

const getQuickName = (dynamic?: string) => {
  const matchedOption = quickOptionList.value.find(item => item.value === dynamic);
  if (matchedOption?.label) {
    return matchedOption.label;
  }
  if (newCurrentType.value === "member") {
    return i18next.t('MobileSelectUserCore.currentMember');
  } else if(newCurrentType.value === 'role') {
    return i18next.t('MobileSelectUserCore.currentRole');
  } else if(newCurrentType.value === 'department') {
    return i18next.t('MobileSelectUserCore.currentMemberDept');
  }
}

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
    if(value) {
      tabList.value = {
        departments: [],
        roles: [],
        users: [],
        dynamic: []
      }
      tabList.value.users = dedupeUsers([user]);
    } else {
      tabList.value.users = [];
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
  if (!props.multiple) tabList.value = { departments: [], roles: [], users: [], dynamic: [] };
  if (value) {
    if (!tabList.value.dynamic.includes(dynamic)) tabList.value.dynamic.push(dynamic);
  } else {
    tabList.value.dynamic = tabList.value.dynamic.filter(item => item !== dynamic);
  }
};

// 列表项的点击事件处理函数

const handleMemberClick = (item: any) => {
  if (isDisabledCheck(item.id, item.departments, item.roles)) return;
  const isChecked = tabList.value.users.find(i => i?.id === item.id);
  
  handleChangeChecked(!isChecked, item.id);
};

const handleDepClick = (item: any) => {
  if (isDisabledCheck(item.id)) return;
  const isChecked = tabList.value.departments.find(i => i?.id === item.id);
  
  handleChangeDepChecked(!isChecked, item);
};

const handleRoleClick = (item: any) => {
  toggleDepartment(item.id);
  if (isDisabledCheck(item.id)) return;
  if (!isDepartmentCheckbox(item.id)) return;
  const isChecked = tabList.value.roles.some(i => i?.id === item.id);
  
  handleChangeRoleChecked(!isChecked, item);
};

const handleDynamicClick = (dynamic: string) => {
  if (isDisabledCheck(dynamic)) return;
  const isChecked = tabList.value.dynamic.includes(dynamic);
  
  handleChangeDynamicChecked(!isChecked, dynamic);
};

const indeterminateMap = computed(() => {
  return (depId: string): boolean => {
    const usersUnderDep = getUsersUnderDep(depId);
    if (usersUnderDep.length === 0) return false;

    const selectedCount = usersUnderDep.filter(u => isUserChecked(u.id)).length;
    return selectedCount > 0 && selectedCount < usersUnderDep.length;
  };
});

const isSelectAll = computed(() => {
  if(isEmptyList.value) {
    return false
  }
  let result = true
  if(newCurrentType.value === 'role') {
    for(const item of showRoleData.value) {
      if(!checkedMap.value(item.id)) {
        result = false
      }
    }
  } else {
    for(const item of displayList.value) {
      if(!checkedMap.value(item.id)) {
        if(newCurrentType.value === 'member' && !isDepartment(item.id)) {
          result = false
        } else if(newCurrentType.value === "department" && isDepartment(item.id)){
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

  if(props.isAvailable && hasConfiguredScope && newCurrentType.value === 'member') {
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
  } else if(props.isAvailable && hasConfiguredScope && newCurrentType.value === 'department') {
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
  tabList.value.departments = tabList.value.departments.filter(item => item?.id !== id);
  tabList.value.roles = tabList.value.roles.filter(item => item?.id !== id);
  tabList.value.users = tabList.value.users.filter(item => item?.id !== id);
  tabList.value.dynamic = tabList.value.dynamic.filter(item => item !== id);
};

initData();

const changeUiTab = (tabName: string) => {
  uiTab.value = tabName;
};

defineExpose({
  serialize: () => {
    return unref(tabList.value.users).filter((item) => item?.id).map((item) => item.id);
  },
  reset: () => {
    tabList.value = { departments: [], roles: [], users: [], dynamic: [] };
    searchValue.value = '';
    expandedDepartmentIds.value.clear();
  },
  getTabList: () => ({
    departments: tabList.value.departments.map(item => ({ ...item })),
    roles: tabList.value.roles.map(item => ({ ...item })),
    users: tabList.value.users.map(item => ({ ...item })),
    dynamic: [...tabList.value.dynamic],
  }),
  deserialize: (users: NocodeUser[]) => { tabList.value.users = filterInvalidSelectionItems(users || []); }
});
</script>

<style lang='scss' scoped>
.mobile-select-user-core {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-bottom: 110px;

  .search-container {
    padding: 8px 12px;
    margin-top: 16px;
    border-radius: 8px;
    background-color: #fff;
    .search-input :deep(.el-input__wrapper) {
      border-radius: 18px;
      box-shadow: none !important;
      border: none;
      padding: 0;
      font-size: 14px;
      .el-icon {
        font-size: 16px;
      }
    }
  }

  .tab-list {
    display: flex;
    height: 44px;
    border-bottom: 1px solid #f0f0f0;
    flex-shrink: 0;
    padding: 0;
    margin-top: 8px;
    justify-content: space-between;
    border-bottom: 1px solid #D6D6D6;

    li {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      font-size: 14px;
      color: #090A0A;
      border-bottom: 2px solid transparent;
      padding: 8px 0;
      margin-bottom: -1px;
      -webkit-tap-highlight-color: transparent;

      &.active {
        color: #0873FF;
        font-weight: 500;
        border-bottom: 2px solid #0873FF;
      }
    }
  }
  
  .content-area {
    height: calc(100% - 106px);
    min-height: 0;
    padding-top: 16px;
    border-radius: 8px;
    
    overflow: auto;
    &::-webkit-scrollbar {
      display: none;
    }
    scrollbar-width: none;
    -ms-overflow-style: none;

    .list-item-wrap {
      position: relative;
      -webkit-tap-highlight-color: transparent;

      &:not(:last-child)::after {
        position: absolute;
        bottom: 0;
        left: 2.5%;
        content: '';
        display: block;
        width: 95%;
        height: 1px;
        background-color: #E6E6E6;
      }
    }
    
    .list-container {
      height: auto;
      background-color: #fff;
      padding: 0 8px;
      border-radius: 8px;

      > div {
        padding: 8px 0;
      }
      
      .item-0 {
        padding-left: 0;
      }
      .item-1 {
        padding-left: 16px;
      }
      .item-2 {
        padding-left: 32px;
      }
      .item-3 {
        padding-left: 48px;
      }
    }


    .list-item {
      height: 40px; 
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 0 8px;

      cursor: pointer;

      .item-info {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
      }
      .item-icon {
        font-size: 22px;
        color: #fff;
      }
      .avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background-color: #007aff;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
      }
      .item-name { 
        font-size: 14px; 
        color: #333; 
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      :deep(.el-checkbox) {
        .el-checkbox__inner {
          border-color: #727272;
        }
        .is-checked .el-checkbox__inner {
          border-color: #0873FF;
        }
      }

      &.department-item {
        .expand-icon {
          font-size: 18px;
          color: #090A0A;
          transition: transform 0.2s ease-in-out;
          &.is-expanded {
            transform: rotate(90deg);
          }
        }
      }
      &.selected-item {
        .remove-icon { 
            color: #999; 
            font-size: 16px; 
            cursor: pointer; 
        }
      }
      // &.quick-item {
      //   padding-left: 16px !important;
      //   .item-name { flex: 1; }
      // }
    }
  }
}
</style>
