<template>
  <div class="workbench-add-user-to-department-dialog">
    <el-dialog v-model="dialogVisible" width="680px" :close-on-click-modal="false" @opened="handleDialogOpened"
      :title="$t('WorkbenchAddUserToDepartmentDialog.addMember')" align-center destroy-on-close @closed="handleClosed">
      <div class="dialog-body">
        <el-tabs v-model="activeName" stretch>
          <el-tab-pane :label="$t('WorkbenchAddUserToDepartmentDialog.addNewMember')" name="new">
            <user-info-core ref="userInfoCoreRef" />
          </el-tab-pane>
          <el-tab-pane :label="$t('WorkbenchAddUserToDepartmentDialog.selectExistingMember')" name="exist" class="exist-pane">
            <select-user-core ref="selectUserCoreRef" />
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button class="cancel" @click="dialogVisible = false">{{ $t('WorkbenchAddUserToDepartmentDialog.cancel') }}</el-button>
        <el-button type="primary" class="confirm" @click="handleConfirm">{{ $t('WorkbenchAddUserToDepartmentDialog.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang='ts'>
import { ref, computed, inject, nextTick } from 'vue';
import { NOCODE_ID, ORGANIZE_UTIL } from '@renderer/types';
const organizeUtil = inject(ORGANIZE_UTIL);

const emit = defineEmits<{
  (event: 'add-user-to-department', userInfo?: Record<string, string[] | string>, type?: string, resolve?: (value: boolean) => void),
  (event: "select-user-to-department", userIds: string[])
}>();

const dialogVisible = ref(false);
const userInfoCoreRef = ref();
const selectUserCoreRef = ref();
const activeName = ref("new");

const nocodeId = inject(NOCODE_ID);

organizeUtil.getRoles({nocodeId});

organizeUtil.getDepartments({nocodeId});


const handleDialogOpened = () => {

}

const handleClosed = () => {
  userInfoCoreRef.value.reset();
}

const handleConfirm = () => {
  if (activeName.value === 'new') {
    userInfoCoreRef.value.validate(async (valid: boolean) => {
      if (valid) {
        const success = await new Promise((resolve) => {
          emit('add-user-to-department', userInfoCoreRef.value.serialize(), 'add', resolve);
        })
        if (success) {
          dialogVisible.value = false;
        }
      }
    });
  } else {
    emit('select-user-to-department', selectUserCoreRef.value.serialize());
    dialogVisible.value = false;
  }
}

defineExpose({
  show: (id: string) => {
    dialogVisible.value = true;
    nextTick(() => {
      userInfoCoreRef.value?.deserialize({ departments: [id] });

      const users = organizeUtil.users.filter(u => u.departments.includes(id));
      selectUserCoreRef.value.deserialize(users);
    })
  }
})
</script>

<style scoped lang='scss'>
.workbench-add-user-to-department-dialog {
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

        .el-dialog__close {
          font-size: 18px;
        }

      }
    }

    .el-dialog__body {
      padding: 16px; 

      .dialog-body {
        position: relative;
        padding: 8px 0;

        .el-tabs {
          .el-tabs__nav {
            height: 32px;
          }

          .el-tabs__header {
            margin: 0 0 32px;
          }

          .el-tabs__content {
            overflow: visible;
          }

          .el-tabs__item {
            color: var(--text-color-regular);
            display: block;
            text-align: center;
            line-height: 24px;

            &.is-active {
              color: var(--text-color-primary);
            }
          }

          .el-tabs__nav-wrap::after {
            height: 1px;
          }

          .exist-pane {
            height: 308px;
          }
        }
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
