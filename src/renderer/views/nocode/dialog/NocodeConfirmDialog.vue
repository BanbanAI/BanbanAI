<template>
  <div class="confirm-dialog">
    <el-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" :title="title"
      :width="width" align-center :close-on-click-modal="closeOnClickModal"
      :close-on-press-escape="closeOnPressEscape" :draggable="draggable" :destroy-on-close="destroyOnClose"
      ref="dialogRef" @close="handleClose" @closed="handleClosed" v-bind="attrs">
      <div class="wrapper-content">
        <div class="icon-warning">
          <el-icon :size="34" color="var(--color-warning)">
            <i-ep-warn-triangle-filled />
          </el-icon>
        </div>
        <div class="content">
          <div>{{ content }}</div>
        </div>
      </div>
      <template #footer>
        <el-checkbox v-model="remind" size="small" v-if="showRemindCheckbox">{{ remindCheckboxText }}</el-checkbox>
        <span class="dialog-footer">
          <el-button type="primary" @click="handleConfirm">{{ confirmText }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { ref, useAttrs } from "vue";
import { useMagicKeys, whenever } from "@vueuse/core";
import { and } from "@vueuse/math";
import i18next from "i18next";

const { ENTER } = useMagicKeys();
const props = withDefaults(defineProps<{
  modelValue: boolean,
  title: string,
  content: string,
  width?: number | string,
  closeOnClickModal?: boolean,
  closeOnPressEscape?: boolean,
  draggable?: boolean,
  destroyOnClose?: boolean,
  confirmText?: string,
  cancelText?: string,
  showCancelButton?: boolean,
  showRemindCheckbox?: boolean,
  remindCheckboxText?: string,
}>(), {
  width: 400,
  closeOnClickModal: false,
  closeOnPressEscape: true,
  draggable: false,
  destroyOnClose: false,
  confirmText: () => i18next.t("confirmDialog.confirmText"),
  cancelText: () => i18next.t("confirmDialog.cancelText"),
  showCancelButton: false,
  showRemindCheckbox: false,
  remindCheckboxText: () => i18next.t("confirmDialog.cancelPrompt")
});
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
  (event: "confirm", remind: boolean);
  (event: "close");
  (event: "confirmed", remind: boolean);
  (event: "closed");
}>();

const attrs = useAttrs();

const dialogRef = ref();
const remind = ref(false);
const isConfirm = ref(false);
const closeDialog = () => {
  dialogRef.value.visible = false;
}
const handleConfirm = () => {
  closeDialog();
  isConfirm.value = true;
}

const handleClose = () => {
  if (isConfirm.value) {
    emit("confirm", remind.value);
  } else {
    emit("close");
  }
}

const handleClosed = () => {
  if (isConfirm.value) {
    emit("confirmed", remind.value);
  } else {
    emit("closed");
  }
  isConfirm.value = false;
}

whenever(and(ENTER, () => props.modelValue), () => {
  handleConfirm();
})

</script>
<style lang="scss" scoped>
.confirm-dialog {
  :deep(.el-dialog) {
    padding: 0;
    border-radius: 4px;

    .el-dialog__header {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0;
      height: 40px;
      padding: 0;
      border-bottom: 1px solid var(--fill-color-light);

      span {
        font-size: 14px;
        color: var(--text-color-primary);
        font-weight: 500;
      }

      button {
        width: 40px;
        height: 40px;
      }
    }

    .el-dialog__footer {
      padding: 0 24px 24px 24px;

      .el-button {
        border-radius: 4px;
        margin-left: 8px;
      }
    }

    .el-dialog__body {
      padding: 24px;
      color: var(--text-color-regular);
    }
  }

  .wrapper-content {
    display: flex;
    align-items: center;

    .icon-warning {
      margin-right: 16px;

      i {
        font-size: 27px;
      }
    }

    .content {
      font-size: 14px;
      line-height: 20px;
    }
  }
}
</style>