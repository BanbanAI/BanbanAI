<template>
  <div class="workbench-user-table">
    <el-table ref="tableRef" :empty-text="emptyText" :data="data" style="width: 100%;" show-overflow-tooltip :class="[theme]" :height="tableHeight" row-key="id" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="48" align="center" v-if="selectionColumn" :selectable="selectionSelectable" />
      <el-table-column prop="user" :label="$t('WorkbenchUserTable.account')" align="center" v-if="!isAdmin" />
      <el-table-column prop="realname" :label="$t('WorkbenchUserTable.name')" align="center">
        <template #default="{ row }">
          {{ row.realname }} <el-tag class="supervisor-tag" v-if="checkIsSupervisor(row)">{{ $t("WorkbenchUserTable.manager") }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="staffNo" :label="$t('WorkbenchUserTable.id')" align="center" v-if="!isAdmin">
      </el-table-column>
      <el-table-column prop="roles" :label="$t('WorkbenchUserTable.role')" align="center">
        <template #default="{ row }">
          {{ formatRoles(row.roles) }}
        </template>
      </el-table-column>
      <el-table-column prop="departments" :label="$t('WorkbenchUserTable.dep')" align="center">
        <template #default="{ row }">
          {{ formatDepartments(row.departments) }}
        </template>
      </el-table-column>
      <el-table-column prop="phone" :label="$t('WorkbenchUserTable.phone')" align="center" :formatter="emptyFormatter" v-if="!isAdmin" />
      <el-table-column prop="email" :label="$t('WorkbenchUserTable.email')" align="center" :formatter="emptyFormatter" v-if="!isAdmin" />
      <el-table-column prop="action" :label="$t('WorkbenchUserTable.operate')" align="center" width="104" :show-overflow-tooltip="false" v-if="actionColumn">
        <template #default="scoped">
          <div class="menus">
            <slot name="action" v-bind="scoped"></slot>
          </div>
        </template>
      </el-table-column>

      <template #empty>
        <div class="empty">
          <img src="@renderer/assets/image/table-empty.png" />
          {{ $t("WorkbenchUserTable.noData") }}
        </div>
      </template>
    </el-table>
  </div>
</template>

<script setup lang='ts'>
import { Account, NocodeUser, ADMIN_USERNAME } from '@common/types/account';
import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { ORGANIZE_UTIL } from '@renderer/types';
import { useArchitectureContext } from '../organize/hooks';
import i18next from 'i18next';
const organizeUtil = inject(ORGANIZE_UTIL);
const architectureContext = useArchitectureContext();

// 定义 props
const props = withDefaults(defineProps<{
  data: Account[];
  theme: string;
  actionColumn?: boolean;
  isAdmin?: boolean;
  readonly?: boolean;
  selectionColumn?: boolean;
  selectionSelectable?: (row: Account, index: number) => boolean;
}>(), {
  actionColumn: false,
  isAdmin: false,
  selectionColumn: false,
});
const emit = defineEmits<{
  (event: 'edit', value: Account)
  (event: 'delete', value: Account)
  (event: 'selection-change', value: Account[])
}>();


const handleEdit = (row: Account) => {
  emit('edit', row)
}
const handleDelete = (row: Account) => {
  emit('delete', row)
}

const handleSelectionChange = (rows: Account[]) => {
  emit('selection-change', rows)
}

const emptyText = computed(() => {
  return props.isAdmin? i18next.t("WorkbenchUserTable.noAdmin") : i18next.t("WorkbenchUserTable.noUser");
})

const formatRoles = (roles: string[]) => {
  const roleLabel = roles?.map(roleId => {
    const role = organizeUtil.roles.find(role => role.id === roleId);
    return role ? role.name : '';
  }).join(';');
  return roleLabel ? roleLabel : '-';
}

const formatDepartments = (departments: string[]) => {
  const depLabel = departments?.map(departmentId => {
    const department = organizeUtil.departments.find(department => department.id === departmentId);
    return department ? department.name : '';
  }).join(';');
  return depLabel ? depLabel : '-';
}

const emptyFormatter = (row: any, column: any, cellValue: any) => {
  return cellValue ? cellValue : '-';
};

const tableHeight = ref(300);
const tableRef = ref();
const calcTableHeight = () => {
  tableHeight.value = window.innerHeight - (props.isAdmin ? 322 : 250);
};

const clearSelection = () => {
  tableRef.value?.clearSelection();
};

const checkIsSupervisor = (account:Account) => {
  if(architectureContext?.departmentId) {
    return organizeUtil.departments.find((dept) => dept.id === architectureContext.departmentId)?.managers.includes(account.id)
  } else {
    for (const dep of organizeUtil.departments) {
      if(dep.managers.includes(account.id)) {
        return true
      }
    }
    return false
  }
  
}


onMounted(() => {
  calcTableHeight();
  window.addEventListener('resize', calcTableHeight);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', calcTableHeight);
});

defineExpose({
  clearSelection,
});
</script>
<style scoped lang='scss'>
.header-left {
  width: 320px;
  height: 32px;
}

.workbench-user-table {
  width: 100%;
  height: calc(100% - 120px);
  background-color: #fff;
  border-radius: 8px;
  padding: 0;

  :deep(.el-table) {
    --el-table-tr-bg-color: #fff;
    --el-table-header-bg-color: #fff;
    --el-table-border: none;
    --el-table-text-color: #1E1E1E;
    --el-table-header-text-color: #141414;
    --el-table-row-hover-bg-color: var(--bg-color-overlay);
    --el-table-bg-color: #fff;
    --el-table-border-color: #fff;
    border: none;

    table {
      border-spacing: 0 8px;
    }

    .el-table__header-wrapper {
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }

    .el-table__header {
      font-size: 15px;
      font-weight: 400;
    }

    .el-table__cell {
      padding: 0;
      height: 36px;
      border-radius: 4px;

      .cell {
        height: 100%;
        line-height: 36px;

        .supervisor-tag {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          margin-left: 8px;
          padding: 2px 4px;
        }

        .menus {
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          column-gap: 10px;

          &.no-permission .el-icon {
            color: #ccc;
            pointer-events: none;
          }
          .el-icon {
            cursor: var(--cursor-pointer);
          }
        }

      }
    }

    .empty {
      row-gap: 0;
      font-size: 14px;
      line-height: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      img {
        width: 64px;
        margin-bottom: 8px;
      }
    }

    thead th {
      font-weight: 400;
    }

    &.light .el-popper{
      --el-bg-color: #000;
      --el-text-color-primary: #e2e2e4;
    }
  }
}
</style>
