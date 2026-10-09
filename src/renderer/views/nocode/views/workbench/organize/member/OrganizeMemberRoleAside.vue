<template>
  <div class="organize-member-role-aside">
    <div class="add-role">
      <p class="title">{{ $t('OrganizeMemberRoleAside.role') }}</p>
      <el-icon size="16" class="add-role-icon" v-if="canManageContacts" @click="handleAddRole"><i-workbench-black-add /></el-icon>
    </div>
    <div class="tree-wrapper">
      <organize-tree :groupList="roleTree" @edit="editRole" :editList="roleEditList" :theme="'light'"
        v-model:activeKey="architectureContext.roleId" :hiddenRightIcon="!canManageContacts">
        <template #content="{ data }">
          <el-icon size="16">
            <i-ep-folder v-if="data.isGroup"></i-ep-folder>
            <i-workbench-role class="role-icon" v-else />
          </el-icon>
        </template>

        <template #empty>
          <p class="empty-tip">{{ $t('OrganizeMemberRoleAside.noRole') }},<el-button type="primary" link @click="handleAddRole">{{ $t('OrganizeMemberRoleAside.add') }}</el-button></p>
        </template>
      </organize-tree>
    </div>

    <workbench-add-role-group-dialog v-model="addRoleGroupDialogVisible"
      @confirm="RoleGroupConfirm"></workbench-add-role-group-dialog>
    <workbench-add-role-dialog v-model="createRoleDialogVisible" @confirm="RoleConfirm" :roleTeam="roleTeam"
      :activeGroup="activeRoleGroup"></workbench-add-role-dialog>
    <workbench-select-dialog v-model="selectRoleGroupDialogVisible" :title="$t('OrganizeMemberRoleAside.adjustGroup')" :label="$t('OrganizeMemberRoleAside.selectTargetGroup')" :roleTeam="roleTeam" :info="activeRole"
      @confirm="regulateRoleGroup"></workbench-select-dialog>
    <workbench-delete-dialog v-model="deleteDialogVisible" :title="$t('OrganizeMemberRoleAside.delete')" :category="architectureContext.category" @confirm="handleDeleteRole"></workbench-delete-dialog>
    <department-rename-dialog v-model="renameRoleDialogVisible" :title="$t('OrganizeMemberRoleAside.rename')" :label="$t('OrganizeMemberRoleAside.newName')" :info="activeRole" @confirm="changeRoleName"></department-rename-dialog>
    <workbench-delete-tip-dialog v-model="deleteTipDialogVisible" :tip="$t('OrganizeMemberRoleAside.delRoleTip')"></workbench-delete-tip-dialog>
  </div>
</template>

<script lang='ts' setup>
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import { buildTree } from '@renderer/views/nocode/utils';
import { ElMessage } from 'element-plus';
import { computed, inject, reactive, ref } from 'vue';
import { useArchitectureContext } from '../hooks';
import { isEmpty } from '@common/utils/object';
import { Role } from '@common/types/account';
import { usePassportStore } from '@renderer/stores';
import i18next from 'i18next';
import { ADMIN_USERNAME } from '@common/types/account';

type RoleTree = Role & {
  children?: Role[]
}

interface Team {
  label: string,
  value:string
}

const nocodeId = inject(NOCODE_ID);
const organizeUtil = inject(ORGANIZE_UTIL);
const architectureContext = useArchitectureContext();
const passportState = usePassportStore();
const canManageContacts = computed(() => passportState.isMainAccount || passportState.account?.isAdmin || passportState.account?.user === ADMIN_USERNAME);

const roleEditList = [
  { 
    get name() { return i18next.t('OrganizeMemberRoleAside.rename') },
    click: (data) => { renameRole(data) }, 
    visible: (data) => {
      return canManageContacts.value;
    }
  },
  { 
    get name() { return i18next.t('OrganizeMemberRoleAside.addRole') },
    click: (data) => { addRole(data) }, 
    visible: (data: Role) => {
      return canManageContacts.value && data.isGroup;
    }, 
  },
  { 
    get name() { return i18next.t('OrganizeMemberRoleAside.adjustGroup') },
    click: (data) => { changeRoleGroup(data) }, 
    visible: (data: Role) => {
      return canManageContacts.value && data.isGroup && !data.isGroup;
    },
  },
  { 
    get name() { return i18next.t('OrganizeMemberRoleAside.delete') },
    click: (data) => { clickDelete(data) }, 
    className: 'delete', 
    visible: () => { 
      return canManageContacts.value;
    } 
  }
]


const addRoleDropdownRef = ref();
const addRoleGroupDialogVisible = ref(false);
const activeRoleGroup = ref();
const createRoleDialogVisible = ref(false);
const roleTree = ref<RoleTree[]>([]);
const activeRole = ref<Role>(null);
const renameRoleDialogVisible = ref(false);
const selectRoleGroupDialogVisible = ref(false)
const deleteDialogVisible = ref(false);
const deleteTipDialogVisible = ref(false);

const roleTeam = computed(() => {
  let list = <Team[]>([]);
  if(!organizeUtil.roleGroups.length){
    list.push({label:i18next.t('OrganizeMemberRoleAside.default'),value: ""}) 
  }
  roleTree.value.forEach(role => {
    list.push({label:role.name,value:role.id})
  });
  return list;
})



const handleAddGroup = () => {
  addRoleDropdownRef['role']?.handleClose?.();
  addRoleGroupDialogVisible.value = true;
}

const addRole = (data?) => {
  console.log('addRole', data)
  if (data) {
    activeRoleGroup.value = data.id;
  }
  createRoleDialogVisible.value = true;
}

const handleAddRole = () => {
  addRoleDropdownRef['role']?.handleClose?.();
  createRoleDialogVisible.value = true;
}

const updateRoleList = () => {
  const tree = buildTree(organizeUtil.roleList.map(item => {
    return {
      ...item,
      label: item.name,
      value: item.id
    }
  }));
  if (!architectureContext.roleId) {
    architectureContext.roleId = tree[0]?.id;
  }
  roleTree.value = tree;
}

const initRoleList = () => {
  organizeUtil.getRoles({nocodeId}).then((res) => {
    updateRoleList(); 
  })
}

initRoleList();

const RoleGroupConfirm = async (name) => {
  try {
    const res = await organizeUtil.addRole({ name, isGroup: true, nocodeId });
    ElMessage.success(i18next.t('OrganizeMemberRoleAside.roleGroupCreateSuccess'));
    updateRoleList();
  } catch (error) {
    ElMessage.error(error.response?.data?.message || i18next.t('OrganizeMemberRoleAside.roleGroupCreateFail'));
  }
}
const editRole = () => {

}

const renameRole = (data) => {
  activeRole.value = data;
  renameRoleDialogVisible.value = true;
}

const changeRoleGroup = (data) => {
  activeRole.value = data;
  selectRoleGroupDialogVisible.value = true;
}


const RoleConfirm = async (data) => {
  try {
    await organizeUtil.addRole({ name: data.name, userIds: data.userIds, nocodeId });
    ElMessage.success(i18next.t('OrganizeMemberRoleAside.roleCreateSuccess'));
    updateRoleList();
  } catch (error) {
    ElMessage.error(error.response?.data?.message || i18next.t('OrganizeMemberRoleAside.roleCreateFail'));
  }
}

const clickDelete = (data: Role) => {
  const users = organizeUtil.allUsers.filter(u => u.roles.includes(data.id));
  if (!isEmpty(users)) {
    // TODO: 换成提示弹窗
    deleteTipDialogVisible.value = true
    return;
  }
  activeRole.value = data;
  deleteDialogVisible.value = true
}


const regulateRoleGroup = async (roleId) => {
  const newRole = Object.assign({nocodeId}, activeRole.value, {parent:roleId});
  await organizeUtil.updateRole(newRole);
  updateRoleList();
}

const handleDeleteRole = async () => {
  await organizeUtil.removeRole({...activeRole.value, nocodeId});
  if (architectureContext.roleId === activeRole.value.id) {
    architectureContext.roleId = '';
  }
  updateRoleList();
}

const changeRoleName = async (roleName) => {
  renameRoleDialogVisible.value = false;
  const newRole = Object.assign({}, activeRole.value, {name:roleName});
  const option = {...newRole, nocodeId}
  await organizeUtil.updateRole(option);
  updateRoleList();
}

defineExpose({
  initRoleList
});

</script>

<style lang='scss' scoped>
.organize-member-role-aside {
  width: 100%;
  height: 100%;

  .add-role {
    height: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px;
    margin-bottom: 8px;

    .title {
      font-weight: bold;
      font-size: 14px;
    }

    .add-role-icon {
      cursor: pointer;
    }
  }

  .tree-wrapper {
    height: calc(100% - 30px);

    .el-link {
      cursor: var(--cursor-pointer);
    }
  }

  :deep(.el-tree-node__content) {
    padding-left: 4px !important;
    .el-tree-node__expand-icon {
      display: none;
    }
  }
}
</style>

<style lang="scss">
.add-role-dropdown {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12) !important;
  background-color: rgba(255, 255, 255, 1) !important;
  color: rgba(30, 30, 30, 1) !important;
  border-radius: 8px;
  border: none !important;
  padding: 4px !important;
  width: 112px !important;

  .role-button {
    cursor: var(--cursor-pointer);
    border-radius: 4px;
    padding: 4px 8px;
    
    &:hover {
      background-color: var(--color-primary);
      color: rgba(255, 255, 255, 1);
    }
  }

  .el-popper__arrow::before {
    background: rgba(255, 255, 255, 1) !important;
    border-color: rgba(255, 255, 255, 1) !important;
  }
}
</style>
