<template>
  <div class="workbench-select-users-dialog">
    <el-dialog v-model="dialogVisible" :close-on-click-modal="false" :title="$t('WorkbenchSelectUserDialog.selectUser')"
      align-center destroy-on-close @closed="onClosed">
      <div class="dialog-body">
        <select-user-core ref="selectUserCoreRef" />
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">{{ $t('WorkbenchSelectUserDialog.cancel') }}</el-button>
          <el-button type="primary" @click="handleConfirm">{{ $t('WorkbenchSelectUserDialog.confirm') }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { NocodeUser } from '@common/types/account';
import { ORGANIZE_UTIL } from '@renderer/types';
import { ref, inject, nextTick } from 'vue';

const emit = defineEmits<{
  (e: 'confirm', userIds: string[]): void;
}>();

const dialogVisible = ref(false);
const selectUserCoreRef = ref();
const organizeUtil = inject(ORGANIZE_UTIL);

const onClosed = () => {
  selectUserCoreRef.value?.reset();
}


const handleConfirm = () => {
  dialogVisible.value = false;
  const userIds = selectUserCoreRef.value?.serialize();
  emit('confirm', userIds);
}

defineExpose({
  show: async (users: NocodeUser[]) => {
    dialogVisible.value = true;
    await nextTick();
    selectUserCoreRef.value?.deserialize(users);
  }
})
</script>

<style scoped lang='scss'>
.workbench-select-users-dialog {
  :deep(.el-dialog) {
    width: 676px;
    background-color: var(--bg-color-page);
    border-radius: 4px;
    padding: 0;

    .el-dialog__header {
      text-align: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);


      &>span {
        font-size: 14px;
      }

      &>.el-dialog__headerbtn {
        width: 40px;
        height: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
    }

    .dialog-body {
      height: 352px;
      padding: 8px 24px;
    }

    .el-dialog__footer {
      padding: 24px 24px 24px 0;
      border-top: 1px solid var(--border-color);


      .el-button {
        width: 60px;
        height: 32px;
        border-radius: 4px;
      }
    }
  }
}
</style>
