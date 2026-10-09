
<template>
  <div class="department-rename-dialog">
    <el-dialog :modelValue="modelValue" :width="360" :title="$t('WorkbenchDeleteTipDialog.tips')"
    @update:modelValue="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false" :append-to-body="false" :show-close="false"
    :close-on-press-escape="false" destroy-on-close>
      <div class="wrapper-content">
        <div class="icon-warning">
          <el-icon :size="34" color="var(--color-warning)">
            <i-ven-dialog-warning />
          </el-icon>
        </div>
        <div class="content">
          <div class="tip">{{ tip }}</div>
        </div>
      </div>
      <template #footer>
        <el-button class="confirm" @click="confirm">{{ $t('WorkbenchDeleteTipDialog.iKnow') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>


<script setup lang='ts'>
import { ref, onMounted, computed, reactive } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  tip: string
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)  
}>();

const confirm = ()=> {
  emit('update:modelValue', false)
}
</script>
<style scoped lang='scss'>
.department-rename-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-padding-primary: 0;
    background-color: var(--bg-color-page);

    .el-dialog__header {
      height: 40px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;

      span {
        font-size: 14px;
      }
    }
    .el-dialog__footer {
      padding: 8px 16px 16px 16px;

      .el-button {
        height: 32px;
        width: 88px;
        border-radius: 4px;
      }
    }

    .el-dialog__body {
      padding: 16px; 
      color: var(--text-color-regular);
    }
  }

  .wrapper-content {
    padding: 8px 0;
    display: flex;
    align-items: center;

    .icon-warning {
      margin-right: 14px;

      i {
        font-size: 27px;
      }
    }

    .content {
      font-size: 14px;
      line-height: 20px;

      .tip {
        font-size: 14px;

      }
    }
  }
}
</style>