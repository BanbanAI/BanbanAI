<template>
  <b2-form-element>
    <div class="department-container" v-if="!widget.isReadonly" ref="containerRef">
      <div class="department-select-pane" :class="{'mobile': isMobileDevice}" @click="openChooseDialog">
        <el-tag v-if="orderedUsers.length" v-for="item in orderedUsers" :key="item.id">
          <span :title="displayUserValue(item.id)">
            {{ displayUserValue(item.id) }}
          </span>
        </el-tag>
        <el-tag v-if="widget.selectedList.departments.length" v-for="item in widget.selectedList.departments" :title="item.realname || item.name">{{ item.realname || item.name }}</el-tag>
        <el-tag v-if="widget.selectedList.dynamic.length" v-for="item in widget.selectedList.dynamic" :title="getDynamicName(item)">{{ getDynamicName(item) }}</el-tag>
        <div class="empty-wrapper" v-if="widget.selectedList.departments.length === 0 && widget.selectedList.users.length === 0 && widget.selectedList.dynamic.length === 0">
          <el-icon class="empty-icon"><Plus /></el-icon>
          <span class="empty-text">{{ currentType === 'department' ? $t('departmentSelect') : $t('memberSelect') }}</span>
        </div>
      </div>
    </div>
    <div class="value" v-else :class="{'mobile': isMobileDevice}">
      <el-tag v-for="item in orderedUsers" v-if="orderedUsers.length" :key="item.id">
        <span :title="displayUserValue(item.id)">
          {{ displayUserValue(item.id) }}
        </span>
      </el-tag>
      <div v-if="isShowUnknownMember">{{ $t('unknownMember') }}</div>
      <el-tag v-for="item in widget.selectedList.departments" v-if="widget.selectedList.departments.length" :title="item.realname || item.name">{{ item.realname || item.name }}</el-tag>
      <el-tag v-if="widget.selectedList.dynamic.length" v-for="item in widget.selectedList.dynamic" :title="getDynamicName(item)">{{ getDynamicName(item) }}</el-tag>
      <div style="color: var(--text-color-inactive);" v-if="widget.selectedList.departments.length === 0 && (widget.currentType === 'member' && widget.selectedList.users.length === 0 && !widget.inputValue) && widget.selectedList.dynamic.length === 0">{{ $t('noContent') }}</div>
    </div>
    <teleport to="body">
      <organize-manager-dialog
        ref="organizeManageDialogRef"
        @confirm="handleClosed"
        :isInWidget="true"
        :multiple="isMultiple"
        :currentType="currentType"
        :dialogTitle="currentType === 'department' ? $t('departmentSelect') : $t('memberSelect')"
        :tableList="tableList"
        :availableValue="availableValue"
        :isAvailable="widget.getOption('select-range') && widget.getOption('range-type') === 'custom'"
      ></organize-manager-dialog>
    </teleport>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { Department, OrganizeData } from "./department";
import { Member } from "../memberSelect/member";
import { Dynamic } from "@common/types/account";
import { isMobile } from "@renderer/utils/pure";
import { displayUserInfo } from "@renderer/utils/other";
import { useWidget } from "@renderer/b2/types";
import { isEmpty } from "@common/utils/object";
import { Plus } from "@element-plus/icons-vue";
import { onClickOutside } from '@vueuse/core'
import { formatDynamicOrganizeLabel } from "./dynamic-label";
import { resolveDisplayItemsByOrder } from "./display-order";
import { displayFilledMemberInfoByUser } from "../memberSelect/display-user-info";
import i18next, { $t } from "@renderer/widgets/i18next";

const isMobileDevice = isMobile();

const widget = useWidget<Department | Member>();
const containerRef = ref<HTMLDivElement | null>(null);
const searchUserInput = ref();
const showSearchList = ref(false);
const organizeManageDialogRef = ref(null)

const currentType = computed(()=>{
  return widget.currentType;
});
const hasCurrentUserDynamic = computed(() => {
  return currentType.value === 'member'
    && widget.selectedList.dynamic.includes(Dynamic.CURRENT_USER);
});
const orderedUsers = computed(() => {
  if (currentType.value !== 'member') {
    return widget.selectedList.users;
  }
  const users = resolveDisplayItemsByOrder(widget.inputValue || [], widget.selectedList.users, widget.allUserList);
  if (!hasCurrentUserDynamic.value) {
    return users;
  }
  return users.filter(item => item.id !== widget.currentAccount?.id);
});
const showInfo = computed(()=>{
  return (widget as Member)?.showInfo || [];
});
const isFillMemberInfoMode = computed(() => {
  return currentType.value === 'member'
    && widget.getOption("auto-fill") === "fill"
    && !!widget.getOption("fill-field");
});
const allUserList = computed(()=>{
  return widget.allRolesList;
});
const allDepartmentsList = computed(()=>{
  return widget.allDepartmentsList;
})
const isShowUnknownMember = computed(() => {
  return currentType.value === 'member' &&
    !widget.selectedList.dynamic.length &&
    !widget.selectedList.users.length &&
    widget.inputValue && !isEmpty(widget.inputValue);
});

onClickOutside(containerRef, ()=>{
  if(showSearchList.value){
    showSearchList.value = false;
    searchUserInput.value = "";
  }
})


const tableList = ref({
  departments: [...widget.selectedList.departments],
  users: [...widget.selectedList.users],
  roles: [...widget.selectedList.roles],
  dynamic: [...widget.selectedList.dynamic],
});
const openChooseDialog = () => {
  organizeManageDialogRef.value.show();
  tableList.value = {
    departments: [...widget.selectedList.departments],
    users: [...widget.selectedList.users],
    roles: [...widget.selectedList.roles],
    dynamic: [...widget.selectedList.dynamic],
  };
}


const handleClosed = (data: OrganizeData) => {
  if (currentType.value === "department") {
    widget.inputValue = data.departments.map(item => item.id);
    widget.isSelectCurrent = data.dynamic.includes(Dynamic.CURRENT_DEPARTMENT)
  } else {
    widget.inputValue = data.users.map((user)=> user.id);
    widget.isSelectCurrent = data.dynamic.includes(Dynamic.CURRENT_USER)
  }
}

const flattenDepartments = (departments: any[]) => {
  const result: any[] = []
  function dfs(list: any[]) {
    for (const item of list) {
      result.push(item) // 先加自己
      if (item.children && item.children.length > 0) {
        dfs(item.children) // 递归子节点
      }
    }
  }
  dfs(departments)
  return result
}

const displayUserValue = (userId: string): string => {
  const selectedUser = widget.selectedList.users.find(item => item.id === userId);
  const organize = {
    users: selectedUser
      ? [selectedUser, ...widget.allUserList.filter(item => item.id !== userId)]
      : widget.allUserList,
    departments: widget.allDepartmentsList,
    roles: widget.allRolesList
  }
  if (isFillMemberInfoMode.value) {
    return displayFilledMemberInfoByUser(
      selectedUser || widget.allUserList.find(item => item.id === userId),
      organize,
      showInfo.value,
      i18next.t('unknownMember'),
    );
  }
  return displayUserInfo(userId, organize, showInfo.value);
}

const currentAccountLabel = computed(() => {
  return widget.currentAccount?.user || widget.currentAccount?.realname || widget.currentAccount?.name || "";
});
const currentMemberName = computed(() => {
  return widget.currentAccount?.realname || widget.currentAccount?.name || widget.currentAccount?.user || "";
});
const currentDepartmentNames = computed(() => {
  const departmentIds = widget.currentAccount?.departments || [];
  const displayDepartmentIds = widget.isMultiple ? departmentIds : departmentIds.slice(0, 1);
  return displayDepartmentIds
    .map(departmentId => widget.allDepartmentsList.find(department => department.id === departmentId)?.name)
    .filter(Boolean)
    .join("、");
});

onMounted(async ()=>{
  widget.allDepartmentsList = flattenDepartments(await widget.getBoard().getOrganizeDepartments())
  widget.allRolesList = await widget.getBoard().getOrganizeRoles();
  if (!widget.allUserList.length) {
    widget.allUserList = await widget.getBoard().getOrganizeUsers();
  }
});

const isMultiple = computed(() => {
  return widget.isMultiple
})

const availableValue = computed(() => {
  if(widget.getOption('range-type') != 'all') {
    return currentType.value === 'department' ? widget.availableDepartmentsList : widget.availableUserList
  }
  return currentType.value === 'department' ? allDepartmentsList.value : allUserList.value
})

const getDynamicName = (value) => {
  if (currentType.value === 'member' && value === Dynamic.CURRENT_USER && currentMemberName.value) {
    return widget.isEditable
      ? formatDynamicOrganizeLabel(value, currentMemberName.value)
      : currentMemberName.value;
  }
  if (currentType.value === 'department' && value === Dynamic.CURRENT_DEPARTMENT) {
    if (currentDepartmentNames.value) {
      return widget.isEditable
        ? formatDynamicOrganizeLabel(value, currentDepartmentNames.value)
        : currentDepartmentNames.value;
    }
    return formatDynamicOrganizeLabel(value);
  }
  return formatDynamicOrganizeLabel(value, currentAccountLabel.value);
}
</script>

<style lang="scss" scoped>
:deep(.b2widget-body) {
  overflow: visible !important;
}
.department-select-pane{
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  min-height: 32px;
  border: 1px dashed #CCCCCC;
  border-radius: 4px;
  gap: 4px;
  padding: 3px;
  cursor: pointer;
  background-color: var(--color-white);

  :deep(.el-tag) {
    max-width: 100%;
    .el-tag__content {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .empty-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
    width: 100%;
    padding: 2px;

    .empty-text {
      padding-left: 4px;
      line-height: normal;
    }
  }
  .el-tag {
    background-color: #f5f6f8;
    border-color: #D7D9DC;
    color: #141E31;
  }
}
.search-user-container {
  position: relative;
  width: calc(100% - 2px);
  left: 1px;
  z-index: 1;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 0 4px 0 rgba(9,30,64,.05),0 6px 16px -1px rgba(9,30,64,.06),0 6px 32px 8px rgba(9,30,64,.04);

  :deep(.el-input) {
    --el-input-bg-color: #fff;
    --el-input-text-color:#525967FF;
    .el-input__wrapper {
      box-shadow: none !important;
    }
  }

  .user-list {
    font-size: 14px;
    color: #525967FF;
    padding: 4px;
    .search-list-item {
        height: 32px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        padding: 8px 0;
        font-size: 14px;

        .item-content {
          .item-info {
            display: flex;
            align-items: center;

            .avatar-icon {
              width: 20px;
              height: 20px;
              line-height: 18px;
              background: #f0a800;
              border: 1px solid transparent;
              border-radius: 50%;
              display: inline-block;
              overflow: hidden;
              text-align: center;
              vertical-align: middle;
              margin-right: 4px
            }
          }
          .keyword {
            color: #4dcdb8 !important;
          }
        }

        .el-checkbox {
          --el-checkbox-bg-color: #fff;
          pointer-events: none;
        }
    }
  }

  .show-all {
    height: 32px;
    font-size: 14px;
    color: #4dcdb8;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
}

.value {
  display: flex;
  height: auto;
  min-height: 32px;
  align-items: center;
  background: var(--el-bg-color-overlay);
  color: var(--el-text-color-primary);
  border: 1px solid var(--border-color);
  border-radius: 2px;
  padding: 4px 8px !important;
  line-height: 20px;
  flex-wrap: wrap;
  gap: 4px;

  :deep(.el-tag) {
    max-width: 100%;
    background-color: #f5f6f8;
    border-color: #D7D9DC;
    color: #141E31;

    .el-tag__content {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.department-select-pane.mobile{
  min-height: 40px;
  border: 1px solid var(--border-color);
  padding-left: 4px;
  padding-right: 4px;
  align-content: initial;
  align-items: center;
}
.value.mobile {
  min-height: 40px;
  line-height: 40px;
  border-radius: 4px;
  align-content: initial;
  align-items: center;
}
</style>

