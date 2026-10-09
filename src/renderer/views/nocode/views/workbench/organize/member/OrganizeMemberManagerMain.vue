<template>
  <el-main class="organize-member-manager-main">
    <el-header class="header" height="36px">
      <div class="title">
        <span class="title-text">{{ title }}</span>
        <span class="count">{{ `(${totalNumber}${$t('OrganizeMemberManagerMain.person')})` }}</span>
        <el-select
        v-if="architectureContext.category === OrganizeCategory.DEPARTMENT && architectureContext.departmentId"
          v-model="selectedDeptUserMode"
          :placeholder="$t('OrganizeMemberManagerMain.selectMemberScope')" :show-arrow="false" popper-class="custom-popper-small"
          size="small" :offset="2"
          @change="getUserList"
        >
          <el-option
            v-for="item in includeSubDeptOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <div class="control">
        <el-input class="search-input" v-model="searchValue" :placeholder="$t('OrganizeMemberManagerMain.searchKeyword')" @change="getUserList" clearable>
          <template #prefix>
            <el-icon color="var(--text-color-regular)" :size="16">
              <i-ep-search />
            </el-icon>
          </template>
        </el-input>
        <template v-if="canForceDelete">
          <el-dropdown
            v-if="showBatchManage"
            trigger="click"
            placement="bottom-end"
            popper-class="batch-manage-dropdown"
            @command="handleBatchManageCommand"
            @visible-change="handleBatchManageVisibleChange"
          >
            <el-button class="batch-manage-button" link>
              <span class="batch-manage-button-content">
                {{ $t('OrganizeMemberManagerMain.batchManage') }}
                <el-icon :class="['batch-manage-arrow', { 'is-open': batchManageDropdownVisible }]" :size="13">
                  <i-ep-arrow-down />
                </el-icon>
              </span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="adjustDepartment">
                  <div class="batch-manage-menu-item">
                    <el-icon :size="16">
                      <i-ven-change />
                    </el-icon>
                    <span>{{ $t('OrganizeMemberManagerMain.adjustDepartment') }}</span>
                  </div>
                </el-dropdown-item>
                <el-dropdown-item command="batchImport">
                  <div class="batch-manage-menu-item">
                    <el-icon :size="16">
                      <i-table-import />
                    </el-icon>
                    <span>{{ $t('OrganizeMemberManagerMain.batchImport') }}</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button class="add-user-button" type="primary" @click="handleClickAddUser" v-if="architectureContext.category === OrganizeCategory.DEPARTMENT">
            <el-icon :size="16" style="margin-right: 4px;">
              <i-ep-plus></i-ep-plus>
            </el-icon>
            {{ $t('OrganizeMemberManagerMain.addMember') }}
          </el-button>
          <el-button class="set-user-role-button" type="primary" plain @click="handleSelectUser" v-else>
            <el-icon :size="16" style="margin-right: 4px;">
              <i-ep-plus></i-ep-plus>
            </el-icon>
            {{ $t('OrganizeMemberManagerMain.selectMember') }}
          </el-button>
        </template>
      </div>
    </el-header>
    
    <workbench-user-table
      ref="userTableRef"
      class="member-manager-user-table"
      :data="showUserList"
      :theme="'light'"
      actionColumn
      :selection-column="showSelectionColumn"
      :selection-selectable="checkIsSelectableUser"
      @selection-change="handleSelectionChange"
    >
      <template #action="scoped">
        <div class="row-actions">
          <el-button link type="primary" :disabled="isDisabled('editable', scoped.row)" @click="handleEdit(scoped.row)">
            {{ $t('OrganizeMemberManagerMain.edit') }}
          </el-button>
          <el-dropdown
            v-if="canForceDelete"
            trigger="click"
            placement="bottom-end"
            popper-class="member-row-action-dropdown"
            @command="(command) => handleRowCommand(command, scoped.row)"
          >
            <el-button link type="primary">
              {{ $t('OrganizeMemberManagerMain.more') }}
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :disabled="isCurrentAccountRow(scoped.row)" command="permanentDelete">
                  <div class="row-action-menu-item">
                    <el-icon :size="16"><i-ep-delete /></el-icon>
                    <span>{{ $t('OrganizeMemberManagerMain.permanentDelete') }}</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </template>
    </workbench-user-table>
    <el-pagination v-if="totalNumber > pageSize" class="page-change" v-model:current-page="currentPage" @current-change="getUserList" :page-size="pageSize" background layout="prev, pager, next" :total="totalNumber"/>
    <workbench-import-user-dialog ref="importUserDialogRef" @completed="handleImportedUser"></workbench-import-user-dialog>
    <workbench-add-user-dialog ref="addUserDialogRef" @confirm="handleConfirm"></workbench-add-user-dialog>
    <workbench-add-user-to-department-dialog ref="addUserToDepartmentDialogRef" @add-user-to-department="handleConfirm" @select-user-to-department="handleSelectUserToDepartment" />
    <workbench-select-users-dialog ref="selectUserToRoleDialogRef" @confirm="handleAddUserToRole" />
    <organize-manager-dialog
      ref="batchAdjustDepartmentDialogRef"
      :tableList="{
        users: [],
        departments: [],
        roles: [],
        dynamic: []
      }"
      :dialogTitle="$t('OrganizeMemberManagerMain.adjustDepartment')"
      :isInWidget="true"
      :isSetting="false"
      :isShowQuick="false"
      :multiple="true"
      currentType="department"
      @confirm="handleBatchAdjustDepartmentConfirm"
    />
    <organize-delete-user-dialog
      v-model="deleteUserConfirmDialogVisible"
      :title="$t('OrganizeDeleteUserDialog.deleteTipsTitle')"
      :tip-title="$t('OrganizeDeleteUserDialog.confirmDeleteMember')"
      :warning-text="$t('OrganizeDeleteUserDialog.deleteMemberWarn')"
      :confirm-text="$t('OrganizeDeleteUserDialog.delete')"
      confirm-type="danger"
      @confirm="handleDeleteUser"
    />
  </el-main>
</template>

<script setup lang='ts'>
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import { ref, inject, watch, computed, onMounted, nextTick } from 'vue';
import { ElMessage } from "element-plus";
import { OrganizeCategory } from '@common/types/project';
import { useActiveOrganizeTab, useArchitectureContext } from '../hooks';
import { usePassportStore } from '@renderer/stores';
import { NocodeUser, Department, ADMIN_USERNAME } from '@common/types/account';
import i18next from 'i18next';

// 添加 emits 定义
const emit = defineEmits(['imported-user']);

enum DeptUserMode {
  OnlyCurrent = 'only-current',
  WithChildren = 'with-children'
}

const architectureContext = useArchitectureContext();
const activeOrganizeTab = useActiveOrganizeTab();
const organizeUtil = inject(ORGANIZE_UTIL);
const passportState = usePassportStore();

const searchValue = ref('');
const deleteUserConfirmDialogVisible = ref(false);
const deleteRequestMode = ref<'single' | 'batch'>('single');

const showUserList = ref<NocodeUser[]>([]);
const currentPage = ref(1);

const pageSize = ref(20);
const totalNumber = ref(0);

const importUserDialogRef = ref();
const addUserDialogRef = ref();
const addUserToDepartmentDialogRef = ref();
const selectUserToRoleDialogRef = ref();
const batchAdjustDepartmentDialogRef = ref();
const userTableRef = ref();
const batchManageDropdownVisible = ref(false);
const selectedUsers = ref<NocodeUser[]>([]);
const canForceDelete = computed(() => passportState.account.user === ADMIN_USERNAME || !!passportState.account.isAdmin);
const showSelectionColumn = computed(() => {
  return canForceDelete.value;
});
const showBatchManage = computed(() => {
  return canForceDelete.value;
});
const handleEdit = (row) => {
  addUserDialogRef.value.show('edit', row);
}
const nocodeId = inject(NOCODE_ID);

const selectedDeptUserMode = ref<DeptUserMode>(DeptUserMode.WithChildren);
const includeSubDeptOptions = [
  { value: DeptUserMode.OnlyCurrent, get label() { return i18next.t('OrganizeMemberManagerMain.onlyCurrentDeptMember') } },
  { value: DeptUserMode.WithChildren, get label() { return i18next.t('OrganizeMemberManagerMain.includeSubDeptMember') } }
];

const isDisabled = () => {
  return !canForceDelete.value;
}

const isCurrentAccountRow = (row?: NocodeUser | null) => {
  const currentId = String(passportState.account.id || '').trim();
  const rowId = String(row?.id || '').trim();
  if (currentId && rowId) {
    return currentId === rowId;
  }

  const currentUser = String(passportState.account.user || '').trim();
  const rowUser = String(row?.user || '').trim();
  return !!currentUser && !!rowUser && currentUser === rowUser;
};


const title = computed(() => {
  if (architectureContext.category === OrganizeCategory.DEPARTMENT) {
    if (architectureContext.departmentId === "") return i18next.t('OrganizeMemberManagerMain.allMember');

    const deptName = findDepartmentNameById(organizeUtil.departments, architectureContext.departmentId);
    if(deptName) return deptName;
  } else if (architectureContext.category === OrganizeCategory.ROLE) {
    const roleName = organizeUtil.roleList.find(role => role.id === architectureContext.roleId)?.name
    if(roleName) return roleName;
  }

  return '';
});

const buildDeptMap = (departments: Department[]) => {
  const map = new Map<string, Department[]>();
  for (const dept of departments) {
    const parentId = dept.parent || '';
    if (!map.has(parentId)) {
      map.set(parentId, []);
    }
    map.get(parentId)!.push(dept);
  }
  return map;
};

const getAllChildDeptIdsFromFlat = (deptId: string, deptMap: Map<string, Department[]>): string[] => {
  const result: string[] = [deptId];
  const children = deptMap.get(deptId) || [];
  for (const child of children) {
    result.push(...getAllChildDeptIdsFromFlat(child.id, deptMap));
  }
  return result;
};

const findAllChildDeptId = (id: string) => {
  const deptMap = buildDeptMap(organizeUtil.departments);
  const resultSet = new Set<string>();
  const childIds = getAllChildDeptIdsFromFlat(id, deptMap);
  childIds.forEach(id => resultSet.add(id));
  return Array.from(resultSet);
}

const getUserList = async () => {
  const userList = await organizeUtil.getAllUsers({
    nocodeId,
    search: searchValue.value,
  }).catch((err) => {
      ElMessage.error(err.message);
      return null;
  });
  const sourceUsers = userList || [];
  if (!userList) {
    return;
  }
  const filterUsers = sourceUsers.filter((item) => {
    if (item.user === ADMIN_USERNAME) return false;
    if (architectureContext.category === OrganizeCategory.DEPARTMENT) {
      if (!architectureContext.departmentId) return true;
      else if (selectedDeptUserMode.value === DeptUserMode.WithChildren) {
        const childIds = findAllChildDeptId(architectureContext.departmentId);
        return (item.departments || []).some(id => childIds.includes(id));
      }
      return item.departments?.includes(architectureContext.departmentId);
    } else if (architectureContext.category === OrganizeCategory.ROLE) {
      return item.roles?.includes(architectureContext.roleId);
    } else {
      return true;
    }
  });
  totalNumber.value = filterUsers.length;
  // 数据分页
  const maxPage = Math.max(1, Math.ceil(totalNumber.value / pageSize.value));
  currentPage.value = Math.min(currentPage.value, maxPage);

  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  showUserList.value = filterUsers.slice(start, end);
  await nextTick();
  userTableRef.value?.clearSelection?.();
  selectedUsers.value = [];
}

const  handleClickImportUser = () => {
  importUserDialogRef.value.show();
}

const handleBatchManageVisibleChange = (visible: boolean) => {
  batchManageDropdownVisible.value = visible;
}

const handleBatchManageCommand = (command: string) => {
  if (command === 'adjustDepartment') {
    handleBatchAdjustDepartment();
    return;
  }
  if (command === 'batchImport') {
    handleClickImportUser();
    return;
  }
}

const handleClickAddUser = async () => {
  if (architectureContext.departmentId) {
    addUserToDepartmentDialogRef.value?.show(architectureContext.departmentId);
  } else {
    addUserDialogRef.value?.show();
  }
}

const handleSelectUser = () => {
  const users = (organizeUtil.allUsers || []).filter(u => (u.roles || []).includes(architectureContext.roleId));
  selectUserToRoleDialogRef.value?.show(users);
}

const handleImportedUser = async() => {
  await getUserList();
  emit('imported-user');
}

const handleConfirm = async (userInfo, type: string, callback: (success: boolean) => void) => {
  try {
    if (type === 'add') {
      // 添加成员的逻辑
      userInfo.nocodeId = nocodeId;
      await organizeUtil.addUser(userInfo);
      ElMessage.success(i18next.t('nocodeUtilsApi.addSuccess'));
    } else if (type === 'edit') {
      // 编辑成员的逻辑
      userInfo.nocodeId = nocodeId;
      await organizeUtil.updateUser(userInfo);
      ElMessage.success(i18next.t('OrganizeMemberManagerMain.editSuccess'));
    }
    await getUserList();
    callback(true);
  } catch {
    callback(false);
  }
}

const handleRowCommand = (command: string, row: NocodeUser) => {
  if (command === 'permanentDelete') {
    handleDelete(row);
  }
}

const handleSelectUserToDepartment = async (userIds: string[]) => {
  await organizeUtil.addUserToDepartment({
    departmentId: architectureContext.departmentId, 
    userIds,
  });
  await getUserList();
}



const handleAddUserToRole = async (userIds: string[]) => {
  await organizeUtil.addUserToRole({
    roleId: architectureContext.roleId, 
    userIds,
  });
  await getUserList();
}

const checkIsSelectableUser = (row: NocodeUser) => {
  return !isDisabled('editable', row);
}

const handleSelectionChange = (rows: NocodeUser[]) => {
  selectedUsers.value = rows;
}

const pendingDeleteUsers = ref<NocodeUser[]>([]);
const handleDelete = (row: NocodeUser) => {
  if (isCurrentAccountRow(row)) {
    return;
  }
  deleteRequestMode.value = 'single';
  pendingDeleteUsers.value = [row];
  deleteUserConfirmDialogVisible.value = true;
}

const handleBatchAdjustDepartment = () => {
  if (!selectedUsers.value.length) {
    ElMessage.warning(i18next.t('OrganizeMemberManagerMain.selectMembersToAdjustDepartment'));
    return;
  }
  batchAdjustDepartmentDialogRef.value?.show();
}

const handleBatchAdjustDepartmentConfirm = async (value) => {
  const departmentIds = value.departments.map((item: Department) => item.id).filter(Boolean) as string[];
  for (const user of selectedUsers.value) {
    await organizeUtil.updateUser({
      ...user,
      nocodeId,
      departments: departmentIds,
    });
  }
  ElMessage.success(i18next.t('OrganizeMemberManagerMain.editSuccess'));
  await getUserList();
}

const handleDeleteUser = async () => {
  const requestMode = deleteRequestMode.value;
  const ids = pendingDeleteUsers.value.map(user => user.id).filter(Boolean);
  if (requestMode === 'batch') {
    await organizeUtil.removeUserPermanentlyList({ ids });
  } else {
    await organizeUtil.removeUserPermanently({ id: ids[0] });
  }
  pendingDeleteUsers.value = [];
  deleteRequestMode.value = 'single';
  ElMessage.success(i18next.t('OrganizeMemberManagerMain.permanentDeleteSuccess'));
  await getUserList();
}

const findDepartmentNameById = (
  departments: Department[],
  targetId: string
): string | undefined => {
  for (const dept of departments) {
    if (dept.id === targetId) {
      return dept.name;
    }

    if (dept.children && dept.children.length > 0) {
      const foundInChildren = findDepartmentNameById(dept.children, targetId);
      if (foundInChildren !== undefined) {
        return foundInChildren;
      }
    }
  }

  return undefined;
}

onMounted(async () => {
  await getUserList();
});

watch(activeOrganizeTab, (val) => {
  if (val === 'member') {
    getUserList();
  }
});

watch(()=>architectureContext, ()=>{
  getUserList();
}, { deep: true })
</script>


<style scoped lang='scss'>
.organize-member-manager-main {
  --member-main-min-width: 580px;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background-color: var(--bg-color-page);
  padding: 16px;
  box-sizing: border-box;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  position: relative;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-width: var(--member-main-min-width);
    column-gap: 16px;
    margin-bottom: 32px;
    height: 32px;

    .title {
      display: flex;
      align-items: center;
      min-width: 0;
      flex: 1 1 auto;
      font-size: 16px;
      line-height: 24px;

      .title-text {
        max-width: min(36vw, 360px);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .count {
        color: var(--text-color-regular);
        margin-left: 4px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .el-select {
        width: 124px;
        margin-left: 16px;
        flex-shrink: 0;

        :deep(.el-select__wrapper) {
          border-radius: 4px;

          .el-select__selected-item {
            color: var(--text-color-secondary);
          }
        }
      }
    }

    .control {
      display: flex;
      align-items: center;
      column-gap: 8px;
      flex-shrink: 0;
      white-space: nowrap;

      .search-input {
        width: clamp(180px, 20vw, 284px);

        :deep(.el-input__wrapper) {
          border-radius: 4px;
          background-color: var(--bg-color-overlay);
          box-shadow: unset;
          color: var(--text-color-secondary);

          &:hover {
            box-shadow: 0 0 0 1px var(--border-color) inset;
          }

          &.is-focus {
            box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
          }

          .el-input__inner {
            font-size: 14px;
            height: 32px;

            &::placeholder {
              font-size: 14px;
            }
          }
        }
      }

      .batch-manage-dropdown {
        display: flex;
      }

      .batch-manage-button {
        font-size: 14px;
        border-radius: 4px;
        height: 32px;
        padding: 6px 16px;
        line-height: 20px;
        background-color: var(--bg-color-overlay);
        margin-left: 0;
        color: var(--text-color-primary);

        .batch-manage-button-content {
          display: flex;
          align-items: center;
          column-gap: 8px;
        }

        .batch-manage-arrow {
          transition: transform 0.2s ease;

          &.is-open {
            transform: rotate(180deg);
          }
        }
      }

      .add-user-button,
      .set-user-role-button {
        font-size: 14px;
        border-radius: 4px;
        height: 32px;
        padding: 6px 12px 6px 12px;
        line-height: 20px;
        margin-left: 0;
      }
    }
  }

  .member-manager-user-table {
    width: 100%;
    min-width: var(--member-main-min-width);

    .el-table__body {
      .el-table__cell {
        .row-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          column-gap: 12px;
          width: 100%;

          :deep(.el-button) {
            padding: 0;
            min-height: 20px;
            line-height: 20px;
          }
        }
      }
    }
  }
}

.page-change {
  width: 100%;
  min-width: var(--member-main-min-width);
  height: 36px;
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;

  --el-pagination-button-bg-color: #fff;
  --el-disabled-bg-color: #fff;
  --el-color-primary: var(--color-primary);
  --el-pagination-button-color: rgba(20, 20, 20, 1);

  :deep(.el-pager) {
    li {
      border-radius: 4px;

      &:hover {
        border: 1px solid var(--color-primary);
      }
    }
  }
}

.delete-dialog{
  width: 480px;
}

.delete-dialog-content{
  width: 100%;
  padding: 24px 24px 0 24px;
  font-size: 14px;
}

</style>
<style lang="scss">
.el-dropdown__popper.member-row-action-dropdown {
  width: 144px;

  border-radius: 8px !important;
  padding: 4px !important;
  border: 1px solid var(--border-color-light) !important;
  box-shadow: 0px 4px 10px 0px #0000001A !important;
  background-color: var(--el-bg-color-page) !important;
  margin-top: -8px;

  .el-scrollbar {
    --el-scrollbar-bg-color: var(--el-bg-color-page) !important;
  }

  .el-scrollbar__wrap {
    overflow-x: hidden !important;
  }

  .el-dropdown__list {
    padding: 0 !important;
  }

  .el-popper__arrow {
    display: none !important;
  }

  .el-scrollbar__view,
  .el-dropdown-menu {
    background-color: var(--el-bg-color-page);
  }

  .el-dropdown-menu {
    padding: 0;
  }

  .row-action-menu-item {
    display: flex;
    align-items: center;
    column-gap: 8px;
    width: 100%;
    color: var(--text-color-primary);
  }

  .el-dropdown-menu__item {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding: 10px 12px;
    border-radius: 4px;
    line-height: 22px;
    height: 36px;
    font-size: 14px;
    color: var(--text-color-primary);
    display: flex;
    align-items: center;

    &:hover {
      background-color: var(--bg-color-overlay);
    }

    &:focus {
      background-color: var(--bg-color-overlay);
    }
  }

  .el-dropdown-menu__item.is-disabled,
  .el-dropdown-menu__item.is-disabled .row-action-menu-item,
  .el-dropdown-menu__item.is-disabled .el-icon {
    color: var(--el-text-color-disabled) !important;
  }
}

.el-dropdown__popper.batch-manage-dropdown {
  width: 180px;

  border-radius: 8px !important;
  padding: 4px !important;
  border: 1px solid var(--border-color-light) !important;
  box-shadow: 0px 4px 10px 0px #0000001A !important;
  background-color: var(--el-bg-color-page) !important;
  margin-top: -8px;

  .el-scrollbar {
    --el-scrollbar-bg-color: var(--el-bg-color-page) !important;
  }

  .el-dropdown__list {
    padding: 0 !important;
  }

  .el-popper__arrow {
    display: none !important;
  }

  .el-scrollbar__view,
  .el-dropdown-menu {
    background-color: var(--el-bg-color-page);
  }

  .el-dropdown-menu {
    padding: 0;
  }

  .batch-manage-menu-item {
    display: flex;
    align-items: center;
    column-gap: 8px;
    color: var(--text-color-primary);
  }

  .el-dropdown-menu__item {
    min-width: 144px;
    padding: 10px 12px;
    border-radius: 4px;
    line-height: 22px;
    height: 36px;
    font-size: 14px;
    color: var(--text-color-primary);
    display: flex;
    align-items: center;

    &:hover {
      background-color: var(--bg-color-overlay);
    }
    &:focus {
      background-color: var(--bg-color-overlay);
    }
  }

}
</style>
