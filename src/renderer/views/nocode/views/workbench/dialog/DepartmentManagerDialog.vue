
<template>
  <div class="department-rename-dialog">
    <el-dialog :modelValue="modelValue" @update:modelValue="emit('update:modelValue', $event)" :title="$t('DepartmentManagerDialog.setDeptManager')" width="680px"
    align-center draggable :close-on-click-modal="false" destroy-on-close @opened="onOpened">
      <div class="body">
        <select-user-core :onlyUsers="true" :readonly="true" ref="selectUserCoreRef" />
      </div>
      <template #footer>
        <el-button type="primary" class="confirm" @click="confirm">{{ $t('DepartmentManagerDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>


<script setup lang='ts'>
import { NocodeUser } from '@common/types/account';
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import { ref, watch, inject, computed, onMounted } from 'vue';
import { ElMessage } from "element-plus";

const props = defineProps<{
  modelValue: boolean;
  departmentId: string;
  managerIds: string[];
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)  
  (event: 'confirm', value: object)
}>();

const organizeUtil = inject(ORGANIZE_UTIL);
const nocodeId = inject(NOCODE_ID);

const selectUserCoreRef = ref();
const users = ref<NocodeUser[]>([]);
const dUsers = computed(() => users.value.filter(item => item.departments.includes(props.departmentId)));
const getAllUsers = async ()=> {
  users.value = await organizeUtil.getAllUsers({nocodeId}).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
    return [];
  });
}
getAllUsers();

const confirm = ()=> {
  emit('update:modelValue', false);
  emit('confirm', { 
    id: props.departmentId, 
    managers: selectUserCoreRef.value?.serialize(),
  });
}

const onOpened = async () => {
  const users = dUsers.value.filter(item => props.managerIds.includes(item.id));
  selectUserCoreRef.value?.deserialize(users, props.departmentId);
}

</script>
<style scoped lang='scss'>
.department-rename-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    background-color: #fff;
    box-shadow: unset;
    --el-dialog-padding-primary: 0px;

    .el-dialog__header {
      height: 40px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      padding: 16px 32px;
      color: rgba(20, 20, 20, 1);
      display: flex;
      align-items: center;
      justify-content: center;

      span {
        font-size: 14px;
      }

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
        color: rgba(30, 30, 30, 0.8);
      }
    }

    .el-dialog__body {
      padding: 16px;

      .body {
        padding: 8px 0;
        height: 352px;
      }
    }

    .el-dialog__footer {
      padding: 16px;
      border-top: 1px solid var(--border-color);

      .el-button { 
        height: 32px;
        width: 64px;
        border-radius: 4px;
      }
    }
  }
}
</style>
