<template>
  <vn-stack class="organize-member-manager">
    <el-container>
      <organize-member-manager-aside ref="asideRef"></organize-member-manager-aside>
      <organize-member-manager-main @imported-user="handleImportedUser"></organize-member-manager-main>
    </el-container>
  </vn-stack>
</template>

<script setup lang='ts'>
import { reactive, ref } from 'vue';
import { OrganizeCategory } from '@common/types/project';
import { ArchitectureContext } from '../types';
import { provideArchitectureContext } from '../hooks';

const architectureContext = reactive<ArchitectureContext>({
  category: OrganizeCategory.DEPARTMENT,
  departmentId: "",
  roleId: "",
});
provideArchitectureContext(architectureContext);

const asideRef = ref();

const handleImportedUser = () => {
  asideRef.value.updateDepartmentList()
  asideRef.value.updateRoleList()
}
</script>

<style scoped lang='scss'>
.organize-member-manager {
  width: 100%;
  height: 100%;
  :deep(.el-container) {
    column-gap: 16px;
  }
}
</style>
