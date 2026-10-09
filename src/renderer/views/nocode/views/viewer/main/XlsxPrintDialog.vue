<template>
  <div class="xlsx-print-dialog-container">
    <el-dialog 
      class="xlsx-print-dialog"
      v-model="dialogVisible"
      :title="$t('XlsxPrintDialog.print')"
      @close="cancel"
    >
      <div class="dialog-content">
        <div>{{ $t('XlsxPrintDialog.printRange') }}</div>
        <el-radio-group v-model="printRange" @change="handlePrintRangeChange">
          <div v-for="item in options" :key="item.value">
            <el-radio :label="item.value">{{ item.label }}</el-radio>
          </div>
        </el-radio-group>
        
        <div class="dialog-footer">
          <el-button @click="cancel">{{ $t('XlsxPrintDialog.cancel') }}</el-button>
          <el-button type="primary" @click="confirm" :loading="isLoading">
            {{ $t('XlsxPrintDialog.nextStep') }}
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import i18next from 'i18next'
const dialogVisible = ref(false)
const options = ref([
  {
    get label() { return i18next.t('XlsxPrintDialog.currentSheet') },
    value: 'content',
  },
  {
    get label() { return i18next.t('XlsxPrintDialog.allSheets') },
    value: 'all',
  }
])
const emits = defineEmits(['confirm'])

const isLoading = ref(false);

const defineValue = options.value[0].value
const printRange = ref(defineValue)

const handlePrintRangeChange = (val: string) => {
  printRange.value = val
}
const cancel = () => {
  dialogVisible.value = false
}
const confirm = () => {
  isLoading.value = true;
  emits('confirm', printRange.value)
}
defineExpose({
  show: () => {
    printRange.value = defineValue
    isLoading.value = false;
    dialogVisible.value = true
  },
  close: () => {
    dialogVisible.value = false
    isLoading.value = false;
  }
})
</script>

<style lang="scss" scoped>
.xlsx-print-dialog-container {
  :deep(.xlsx-print-dialog).el-dialog {
    width: 290px;
    height: fit-content;
    margin: auto;
    top: 50%;
    transform: translateY(-50%);
    .el-dialog__header {
      --el-dialog-title-font-size: 14px;
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
