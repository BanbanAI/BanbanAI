<template>
  <div class="workbench-add-admin-dialog">
    <mobile-organize-manager-dialog
      v-if="isMobileDevice"
      ref="mobileOrganizeManageDialogRef"
      @confirm="handleConfirm"
      @update="handleUpdate"
      @update:modelValue="handleUpdateModelValue"
      v-bind="attrs"
    ></mobile-organize-manager-dialog>

    <pc-organize-manager-dialog
      v-else
      ref="pcOrganizeManageDialogRef"
      @confirm="handleConfirm"
      @update="handleUpdate"
      @update:modelValue="handleUpdateModelValue"
      v-bind="attrs"
    ></pc-organize-manager-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, useAttrs } from 'vue';
import { isMobile } from "@renderer/utils";

const isMobileDevice = isMobile();

const emit = defineEmits<{
  (e: 'confirm', userIds: string[]): void;
  (e: 'update', userIds: string[]): void;
  (e: 'update:modelValue', value: boolean);
}>();

const attrs = useAttrs();

const handleConfirm = (userIds: string[]) => {
  emit('confirm', userIds);
}

const handleUpdate = (userIds: string[]) => {
  emit('update', userIds);
}

const handleUpdateModelValue = (value: boolean) => {
  emit('update:modelValue', value);
}

const mobileOrganizeManageDialogRef = ref(null);
const pcOrganizeManageDialogRef = ref(null);
const show = () => {
  if (isMobileDevice) {
    mobileOrganizeManageDialogRef.value?.show();
  } else {
    pcOrganizeManageDialogRef.value?.show();
  }
}

defineExpose({
  show,
});
</script>
