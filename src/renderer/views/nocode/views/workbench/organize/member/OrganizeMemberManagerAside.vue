<template>
  <el-aside class="organize-member-manager-aside" width="300px">
    <vn-stack v-model="architectureContext.category" class="organize-member-manager-aside-stack">
      <div class="tabs">
        <vn-stack-tab :name="OrganizeCategory.DEPARTMENT">{{ $t('OrganizeMemberManagerAside.department') }}</vn-stack-tab>
        <vn-stack-tab :name="OrganizeCategory.ROLE">{{ $t('OrganizeMemberManagerAside.role') }}</vn-stack-tab>
      </div>
      <div class="layers">
        <vn-stack-layer class="layer" :name="OrganizeCategory.DEPARTMENT">
          <organize-member-department-aside ref="departmentAsideRef" />
        </vn-stack-layer>
        <vn-stack-layer class="layer" :name="OrganizeCategory.ROLE">
          <organize-member-role-aside ref="roleAsideRef" />
        </vn-stack-layer>
      </div>
    </vn-stack>

  </el-aside>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { useArchitectureContext } from '../hooks';
import { OrganizeCategory } from '@common/types/project';

const departmentAsideRef = ref();
const roleAsideRef = ref();

const architectureContext = useArchitectureContext();

defineExpose({
  updateDepartmentList(){
    departmentAsideRef.value.initDepartment();
  },
  updateRoleList() {
    roleAsideRef.value.initRoleList();
  },
});
</script>

<style scoped lang='scss'>
.organize-member-manager-aside {
  padding: 16px;
  height: 100%;
  background-color: #fff;
  border-radius: 8px;
  overflow: visible;

  .organize-member-manager-aside-stack {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    row-gap: 16px;

    .tabs {
      display: flex;
      width: 100%;
      height: 32px;
      background-color: rgba(245, 245, 247, 1);
      border-radius: 4px;
      border: 1px solid var(--border-color);

      .vn-stack-tab {
        width: 50%;
        height: 100%;
        color: rgba(31, 31, 31, 1);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        cursor: var(--cursor-pointer);
        font-size: 14px;

        &:hover {
          color: var(--color-primary);
          border-radius: 4px;
        }

        &.active {
          background-color: var(--color-primary);
          color: rgba(255, 255, 255, 1);
        }
      }
    }

    .layers {
      height: calc(100% - 52px);

      .layer {
        height: 100%;
      }
    }
  }
}


.nodata{
    width: 100%;
    height: 300px;
    display: flex;
    justify-content: center;
    align-items: center;  
  }

</style>

