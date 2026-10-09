<template>
  <div class="organize-member-department-aside">
    <div class="members-wrapper">
      <p class="title">{{ $t('OrganizeMemberDepartmentAside.member') }}</p>
      <ul class="members">
        <li :class="['member-item', { active: !architectureContext.departmentId }]" @click="handleActiveAllMember">
          <el-icon :size="16">
            <i-workbench-all-member></i-workbench-all-member>
          </el-icon>
          <span>{{ $t('OrganizeMemberDepartmentAside.allMember') }}</span>
        </li>
      </ul>
    </div>
    <el-divider style="margin: 16px 0" /> 
    <div class="add-department">
      <p class="title">{{ $t('OrganizeMemberDepartmentAside.department') }}</p>
      <el-icon size="16" @click="handleDepartment" class="add-department-icon" v-if="canManageContacts"><i-workbench-black-add /></el-icon>
    </div>

    <div class="tree-wrapper">
      <organize-tree :groupList="departmentTree" @edit="editDepartment" :editList=groupEditList :theme="'light'"
        v-model:activeKey="architectureContext.departmentId" :hiddenRightIcon="!canManageContacts"
        :expandOnClickNode="true"> 
        <template #content>
          <el-icon size="16"><i-workbench-set /></el-icon>
        </template>

        <template #empty>
          <p class="empty-tip">{{ $t('OrganizeMemberDepartmentAside.noDepartment') }}<el-button type="primary" link @click="handleDepartment">{{ $t('OrganizeMemberDepartmentAside.add') }}</el-button></p>
        </template>
      </organize-tree>
    </div>

    <workbench-department-dialog v-model="departmentDialogVisible" :department="activeDepartment" @confirm="departmentConfirm" :departmentList="departmentRootTree"></workbench-department-dialog>
    <department-rename-dialog v-model="departmentRenameDialogVisible" :title="$t('OrganizeMemberDepartmentAside.rename')" :label="$t('OrganizeMemberDepartmentAside.deptName')" @confirm="changeDepartmentName" :info="activeDepartment"></department-rename-dialog>
    <department-manager-dialog v-model="departmentManagerDialogVisible" :title="departmentDialogName" :managerIds="departmentManagers" :departmentId="activeDepartmentId" @confirm="setManager"></department-manager-dialog>
    <workbench-delete-dialog v-model="deleteDialogVisible" :title="$t('OrganizeMemberDepartmentAside.delete')" :category="architectureContext.category" @confirm="handleDelete"></workbench-delete-dialog>
    <workbench-delete-tip-dialog v-model="deleteTipDialogVisible" :tip="hasUserTip"></workbench-delete-tip-dialog>
    <department-rename-dialog v-model="departmentAddSonDialogVisible" :title="$t('OrganizeMemberDepartmentAside.addSubDept')" :label="$t('OrganizeMemberDepartmentAside.subDeptName')" @confirm="addSonDepartment"></department-rename-dialog>
  </div>
</template>

<script lang='ts' setup>
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import { buildTree } from '@renderer/views/nocode/utils';
import { computed, inject, ref } from 'vue';
import { useArchitectureContext } from '../hooks';
import { Department } from '@common/types/account';
import { ElMessage } from 'element-plus';
import { usePassportStore } from '@renderer/stores';
import { isEmpty } from '@common/utils/object';
import i18next from 'i18next';
import { ADMIN_USERNAME } from '@common/types/account';

type DepartmentTree = Department & {
 children?: Department[]
}

const nocodeId = inject(NOCODE_ID);
const organizeUtil = inject(ORGANIZE_UTIL);
const architectureContext = useArchitectureContext();
const passportState = usePassportStore();
const canManageContacts = computed(() => passportState.isMainAccount || passportState.account?.isAdmin || passportState.account?.user === ADMIN_USERNAME);

const groupEditList = [
  { 
    get name() { return i18next.t('OrganizeMemberDepartmentAside.rename') },
    click: (data) => { editDepartmentName(data) }, 
    visible: () => canManageContacts.value
  },
  { 
    get name() { return i18next.t('OrganizeMemberDepartmentAside.adjustParentDept') },
    click: (data) => { editParentDepartMent(data) }, 
    visible: () => canManageContacts.value
  },
  { 
    get name() { return i18next.t('OrganizeMemberDepartmentAside.addSubDept') },
    click: (data) => { groupAddSon(data) }, 
    visible: () => canManageContacts.value
  },
  { 
    get name() { return i18next.t('OrganizeMemberDepartmentAside.setDeptManager') },
    click: (data) => { addManager(data) }, 
    visible: () => canManageContacts.value
  },
  { 
    get name() { return i18next.t('OrganizeMemberDepartmentAside.delete') },
    click: (data) => { clickDelete(data) }, 
    className: 'delete', 
    visible: () => canManageContacts.value
  }
]

const departmentDialogVisible = ref(false);
const departmentRootTree = ref([]);
const departmentTree = ref<DepartmentTree[]>([]);
const activeDepartment = ref<DepartmentTree>();
const departmentRenameDialogVisible = ref(false)
const departmentAddSonDialogVisible = ref(false)
const activeDepartmentId = ref("");
const departmentDialogName = ref('')
const departmentManagers = ref<string[]>([]);
const departmentManagerDialogVisible = ref(false)
const hasUserTip = ref('');
const deleteDialogVisible = ref(false);
const deleteTipDialogVisible = ref(false);

const handleActiveAllMember = () => {
  architectureContext.departmentId = "";
}

const handleDepartment = () => {
  activeDepartment.value = null;
  departmentDialogVisible.value = true;
}
const departmentConfirm = async (departInfo, type: "add" | "edit") =>{
  if (type === "add") {
    await organizeUtil.addDepartment({...departInfo, nocodeId});
    updateDepartmentList();
  } else {
    await organizeUtil.updateDepartmentParent({
      ...departInfo,
      nocodeId,
      departmentId: activeDepartment.value?.id,
    });
    initDepartment();
  }
}


const updateDepartmentList = () => {
  const tree = buildTree(organizeUtil.departments.map(item=>{
    return {
     ...item,
      label: item.name,
      value: item.id
    }
  }));
  departmentTree.value = tree;

  departmentRootTree.value = [{
    label: i18next.t('OrganizeMemberDepartmentAside.allDept'),
    value: "",
    children: tree
  }]
}

const initDepartment = () => {
  organizeUtil.getDepartments({nocodeId}).then((res) => {
    updateDepartmentList(); 
  })
}

initDepartment();

const editDepartment = ()=> {

}

const editDepartmentName = (data) => {
  activeDepartment.value = data;
  departmentRenameDialogVisible.value = true
}
const addManager = (data) => {
  activeDepartmentId.value = data.id;
  departmentManagerDialogVisible.value = true;
  departmentDialogName.value = data.name;
  departmentManagers.value = data.managers || [];
}

const editParentDepartMent = (data: DepartmentTree) => {
  activeDepartment.value = data;
  departmentDialogVisible.value = true;
  console.log('data', data);
}
const groupAddSon = (data) => {
  activeDepartment.value = data;
  departmentAddSonDialogVisible.value = true
}
const clickDelete = (data: DepartmentTree) => {
  const users = organizeUtil.allUsers.filter(u => u.departments.includes(data.id));
  if (!isEmpty(data.children) || !isEmpty(users)) {
    // TODO: 换成提示弹窗
    hasUserTip.value = !isEmpty(data.children) ?  i18next.t('OrganizeMemberDepartmentAside.delDeptTip1') : i18next.t('OrganizeMemberDepartmentAside.delDeptTip2');
    deleteTipDialogVisible.value = true
    return;
  }
  activeDepartment.value = data; 
  deleteDialogVisible.value = true
}
const handleDelete = async () => {
  await organizeUtil.removeDepartment({...activeDepartment.value, nocodeId});
  updateDepartmentList();
}


const changeDepartmentName = async (departmentName) => {
  const newDepartment = Object.assign({nocodeId}, activeDepartment.value, {name:departmentName});
  await organizeUtil.updateDepartment(newDepartment); 
  updateDepartmentList();
}

const addSonDepartment = async (departmentName) => {
  await organizeUtil.addDepartment({name:departmentName, parent: activeDepartment.value?.id, isEditor: false, nocodeId });
  updateDepartmentList();
}

const setManager = async (payload) => {
  try {
    // 调用organizeUtil中的方法将部门主管信息发送到后端
    await organizeUtil.updateDepartmentManagers({ id: payload.id, managers: payload.managers, nocodeId });
    // 更新部门列表以反映最新变化
    await organizeUtil.getDepartments({nocodeId}).then((res) => {
      updateDepartmentList(); 
    })
    // 只有在成功时才执行以下操作
    ElMessage.success(i18next.t('OrganizeMemberDepartmentAside.setDeptManagerSuccess'));
  } catch (error) {
    // 在错误情况下只显示错误消息，不执行其他操作
    console.error(i18next.t('OrganizeMemberDepartmentAside.setDeptManagerFailWithReason'), error);
    ElMessage.error(error.response?.data?.message || i18next.t('OrganizeMemberDepartmentAside.setDeptManagerFail'));
  }
}

defineExpose({
  initDepartment
});

</script>

<style lang='scss' scoped>
.organize-member-department-aside {
  width: 100%;
  height: 100%;
  .members-wrapper {
    display: flex;
    flex-direction: column;
    row-gap: 8px;

    .title {
      line-height: 24px;
      font-weight: bold;
      font-size: 14px;
    }

    .members {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .member-item {
        height: 32px;
        cursor: pointer;
        display: flex;
        align-items: center;
        column-gap: 4px;
        padding: 0 8px;
        border-radius: 4px;

        &:hover {
          background-color: var(--bg-color-hover);
        }

        &.active {
          background-color: var(--color-primary-light-9);
          color: var(--color-primary);
        }

        span {
          font-size: 14px;
        }
      }
    }
  }

  .add-department{
    height: 24px;
    display: flex;
    justify-content: space-between;
    padding: 2px;
    margin-bottom: 8px;

    .title {
      font-weight: bold;
      font-size: 14px;
    }

    .add-department-icon {
      cursor: var(--cursor-pointer);
    }
  }

  .tree-wrapper {
    height: calc(100% - 126px);

    .el-link {
      cursor: var(--cursor-pointer);
    }
  }
}
</style>
