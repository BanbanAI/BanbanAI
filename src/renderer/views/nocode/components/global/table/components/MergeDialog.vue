<template>
  <div class="merge-print-dialog-container">
    <el-dialog 
      class="merge-print-dialog"
      :modelValue="show" 
      @update:modelValue="emits('update:modelValue', $event)"
      :title="props.title || $t('mergeDialog.print')"
      @close="cancel"
      @open="handleOpen"
    >
      <div class="dialog-content">
        <div>{{ $t('mergeDialog.printMethod') }}</div>
        <el-radio-group v-model="printRange" @change="handlePrintRangeChange">
          <div>
            <el-radio :label="false">{{ $t('mergeDialog.printSeparately') }}</el-radio>
          </div>
          <div>
            <el-radio :label="true">{{ $t('mergeDialog.mergePrint') }}</el-radio>
          </div>
        </el-radio-group>

        <div class="dialog-footer">
          <el-button @click="cancel">{{ $t('mergeDialog.cancel') }}</el-button>
          <el-button type="primary" @click="confirm">{{ $t('mergeDialog.nextStep') }}</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
const props = defineProps<{
  modelValue: boolean;
  title?: string
}>();
const emits = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
  (event: 'confirm', value: boolean): void;
}>();
const show = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emits('update:modelValue', value)
  },
})
const defineValue = false;
const printRange = ref(defineValue);

const handlePrintRangeChange = (val: boolean) => {
  printRange.value = val;
}
const handleOpen = () => {
  printRange.value = defineValue;
}
const cancel = () => {
  show.value = false
}
const confirm = () => {
  emits('confirm', printRange.value);
  show.value = false
}
</script>

<style lang="scss" scoped>
.merge-print-dialog-container {
  :deep(.el-dialog) {
    --el-dialog-padding-primary: 0;
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    width: 290px;
    height: fit-content;
    margin: auto;
    top: 50%;
    transform: translateY(-50%);
    .el-dialog__header {
      --el-dialog-title-font-size: 14px;
      text-align: center;
      border-bottom: 1px solid var(--border-color);
      padding: 0px;
      margin: 0px;
      line-height: 40px;
    }
    .el-dialog__body {
      height: calc(100% - 40px);
      padding: 24px 16px 16px 16px;
      border-radius: 4px;
    }
    .dialog-content {
      width: 100%;
    }
    .el-radio-group {
      margin-top: 10px;
      display: flex;
      align-items: flex-start;
      flex-direction: column;
    }
    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
    .el-button {
      border-radius: 4px;
    }
  }
}
</style>
