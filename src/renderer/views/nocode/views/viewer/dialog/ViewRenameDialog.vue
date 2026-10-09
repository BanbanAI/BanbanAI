<template>
  <div class="rename-container">
    <el-dialog 
      v-model="showDialog" 
      width="350px" 
      :title="$t('ViewRenameDialog.viewRename')"
      align-center 
      destroy-on-close 
      :close-on-click-modal="false" 
      @opened="newName.focus()"
    >
      <el-form-item :label="$t('ViewRenameDialog.viewName')" label-position="top">
        <el-input ref="newName" type="text" @keyup.enter="doRename" v-model="editName" />
      </el-form-item>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="doRename">{{ $t("nocodeRenameDialog.confirmLabel") }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
import i18next from "i18next";

const showDialog = ref(false);
const editName = ref("");
const newName = ref<HTMLInputElement>(null);

defineExpose({
  show: (name: string) => {
    editName.value = name;
    showDialog.value = true;
  },
  hide: () => {
    showDialog.value = false;
  }
});

const emit = defineEmits<{
  (e: 'doRename', name: string),
}>();

const doRename = async () => {
  if(!editName.value || !editName.value.trim()) {
    ElMessage.warning(i18next.t('ViewRenameDialog.nameNotNull'))
    showDialog.value = false
    return
  }
  emit('doRename', editName.value)
  showDialog.value = false
};
</script>
<style scoped lang='scss'>
.rename-container {
  position: absolute;

  :deep(.el-dialog) {
    border-radius: 4px;
    overflow: hidden;
    --el-dialog-padding-primary: 0;
    --el-dialog-bg-color: var(--el-bg-color-page);

    .el-dialog__header {
      padding: 0px;
      margin: 0px;
      text-align: center;
      height: 40px;
      line-height: 40px;
      border-bottom: 1px solid var(--border-color);
      --el-dialog-title-font-size: 14px;

      .el-dialog__headerbtn {
        height: 40px;
        width: 40px;
        line-height: 46px;
        font-size: 16px;
        top: 0;
      }
    }

    .el-dialog__body {
      padding: 22px 16px;
    }

    .el-form-item {
      &:last-child {
        margin-bottom: 0;
      }

      .el-form-item__label {
        line-height: 16px;
        margin-bottom: 8px;
        font-size: 12px;
        color: var(--text-color-secondary);
      }

      .el-input {
        font-size: 12px;
        --el-input-bg-color: var(--el-bg-color-overlay);

          .el-input__wrapper {
            border-radius: 4px;
          }
      }
    }

    .el-dialog__footer {
      height: 60px;
      padding: 8px 16px 16px;

      .el-button { 
        height: 36px;
        width: 64px;
        border-radius: 4px;
        transition: all 0.3s ease;
      }
    }
  }
}
</style>