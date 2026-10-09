<template>
  <div class="workbench-add-user-dialog">
    <el-dialog v-model="dialogVisible" width="680px" :close-on-click-modal="false" @opened="handleDialogOpened"
      :title="title" align-center destroy-on-close @closed="handleClosed">
      <div class="dialog-body">
        <user-info-core :type="type" ref="userInfoCoreRef" />
        <div class="line"></div>
      </div>
      <template #footer>
        <el-button class="cancel" @click="dialogVisible = false">{{ $t('WorkbenchAddUserDialog.cancel') }}</el-button>
        <el-button type="primary" class="confirm" @click="handleConfirm">{{ $t('WorkbenchAddUserDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ref, computed, inject, nextTick } from 'vue';
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
import i18next from 'i18next';
const organizeUtil = inject(ORGANIZE_UTIL);

const emit = defineEmits<{
  (event: 'confirm', userInfo: Record<string, string[] | string>, type: string, resolve: (value: boolean) => void),
}>();

const dialogVisible = ref(false);
const type = ref<'add' | 'edit'>('add');
const userInfoCoreRef = ref();
const title = computed(() => {
  if (type.value === 'add') return i18next.t('WorkbenchAddUserDialog.addUser');
  return i18next.t('WorkbenchAddUserDialog.editUser');
});

const nocodeId = inject(NOCODE_ID);

organizeUtil.getRoles({nocodeId});

organizeUtil.getDepartments({nocodeId});


const handleDialogOpened = () => {

}

const handleClosed = () => {
  userInfoCoreRef.value.reset();
}

const handleConfirm = () => {
  userInfoCoreRef.value.validate(async (valid: boolean) => {
    if (valid) {
      try {
        const success = await new Promise((resolve) => {
          emit('confirm', userInfoCoreRef.value.serialize(), type.value, resolve);
        });
        if (success) {
          dialogVisible.value = false;
        }
      } catch (error) {
        console.log(error);
      }
    }
  });
}

defineExpose({
  show: (dialogType: 'add' | 'edit' = 'add', info: any = {}) => {
    dialogVisible.value = true;
    type.value = dialogType;
    if (dialogType !== 'add') {
      nextTick(() => {
        userInfoCoreRef.value.deserialize(info);
      })
    }
  }
})
</script>

<style scoped lang='scss'>
.workbench-add-user-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 40px;
        width: 40px;
        line-height: 46px;
        font-size: 16px;
        border-top-right-radius: 4px;
        top: 0;

        &:hover {
          background-color: var(--color-danger);

          .el-dialog__close {
            color:var(--color-white);
          }
        }
        .el-dialog__close {
          font-size: 18px;
        }

      }
    }

    .el-dialog__body {
      padding: 24px 16px;
      border-bottom: 1px solid var(--border-color);

      .dialog-body {
        position: relative;

        .line {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
          width: 1px;
          height: 384px;
        }
      }
    }

    .el-dialog__footer {
      padding: 16px;

      .el-button { 
        height: 32px;
        width: 64px;
        border-radius: 4px;
      }
    }
  }
}
</style>
