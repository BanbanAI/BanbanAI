<template>
  <div class="confirm-delete-dialog">
    <el-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :title="$t('confirmDeleteDialog.deleteTitle')" width="426px" @close="handlePicked(false);" align-center ref="dialogRef">
      <span><el-icon color="#e6a23c" :size="24"><WarnTriangleFilled /></el-icon></span>
      <span class="ifdel"> {{ $t("confirmDeleteDialog.deleteTip", {deleteName: props.deleteName}) }}</span>
      <template #footer>
        <div class="dialog-footer">
          <el-checkbox v-model="notRemind" size="small">{{ $t("confirmDeleteDialog.cancelPrompt") }}</el-checkbox>
          <div class="buttons">
            <el-button type="primary" @click="handlePicked(true);">{{ $t("confirmDeleteDialog.confirmLabel") }}</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { ref } from "vue";
import { useSettingStore } from "@renderer/stores";
import { useMagicKeys, whenever} from "@vueuse/core";
import { and } from "@vueuse/math";
import { WarnTriangleFilled } from '@element-plus/icons-vue'
import { ElDialog, ElIcon, ElCheckbox, ElButton } from "element-plus";

const { ENTER } = useMagicKeys();
const props = defineProps<{
  deleteName: string,
  modelValue: boolean,
  deleteType: string,
}>();
const emit = defineEmits<{
  (event: 'picked', value: boolean, deleteType: string),
  (event: 'update:modelValue', value: boolean),
}>();

const dialogRef = ref();
const notRemind = ref(false);
const settingState = useSettingStore();
const handlePicked = function (value: boolean) {
  dialogRef.value.visible = false;
  if (notRemind.value == true) {
    // 关闭删除提醒
    settingState.offDeleteRemind();
  }
  emit('picked', value, props.deleteType);
}

whenever(and(ENTER, () => props.modelValue), () => {
  // 回车就直接确定删除
  handlePicked(true);
})

</script>
<style lang="scss" scoped>
:deep(.el-dialog) {
  --el-dialog-padding-primary: 0;
  --el-dialog-border-radius: 4px;
  .el-dialog__header {
    height: 40px;
    padding: 0;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    --el-dialog-title-font-size: 14px;
    --el-text-color-primary: var(--el-text-color-regular);

    .el-dialog__headerbtn {
      width: 40px;
      height: 40px;
    }

  }
  .el-dialog__body {
    padding: 24px 16px;
    span {
      margin-right: 9px;
      vertical-align: middle;
      &.ifdel {
        font-size: 14px;
      }
    }
  }
  .el-dialog__footer {
    padding: 0 16px 16px;
    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .el-button {
      width: 80px;
    }
  }
}
</style>