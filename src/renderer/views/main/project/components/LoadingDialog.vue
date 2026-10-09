<template>
  <div class="loading-dialog">
    <el-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)"
      draggable center :modal="false" :show-close="false" :close-on-click-modal="false">
      <div class="loading-container">
        <div class="loading-img">
          <el-icon :size="20" v-show="status === 'loading'">
            <i-ven-loading></i-ven-loading>
          </el-icon>
          <el-icon :size="20" color="#67c23a" v-show="status === 'success'">
            <i-ven-success></i-ven-success>
          </el-icon>
          <el-icon :size="20" color="#dc3545" v-show="status === 'fail'">
            <i-ven-fail></i-ven-fail>
          </el-icon>
        </div>
        <div class="loading-text">{{ tipMessage }}</div>
      </div>
    </el-dialog>
  </div>
</template>

<script lang='ts' setup>
import { useProjectDialogStore } from '@renderer/stores';
import { PROJECT_ID } from '@renderer/types';
import { watch, inject, ref, watchEffect } from 'vue';
type LoadingType = 'hide' | 'loading' | 'success' | 'fail';
defineProps<{
  modelValue: boolean,
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)
}>();

const status = ref<LoadingType>('hide');
const tipMessage = ref('');
const projectId = inject(PROJECT_ID);
const projectDialogState = useProjectDialogStore();
const dialogStorage = projectDialogState.getStorage(projectId);
let closeTimeout: number;
watchEffect(() => {
  if (dialogStorage.loadingDialogVisible) {
    const args = dialogStorage.getArgs('loadingDialogVisible') ?? {};
    if (!args) return;
    let { type, message } = args;
    status.value = type;
    tipMessage.value = message;
    clearTimeout(closeTimeout);
    if (status.value === 'success' || status.value === 'fail') {
      closeTimeout = setTimeout(() => {
        emit('update:modelValue', false);
      }, 1000);
    } else if (status.value === 'hide') {
      emit('update:modelValue', false);
    } else {
      emit('update:modelValue', true);
    }
  }
});
</script>

<style lang='scss' scoped>
:deep(.el-dialog) {
  width: max-content;
  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 0;

    .loading-container {
      height: 50px;
      padding: 0 15px;
      display: flex;
      justify-content: space-around;
      align-items: center;

      .loading-img {
        display: flex;
        margin-right: 5px;
        img {
          height: 30px;
        }
      }

      .loading-text {
        white-space: nowrap;
      }
    }
  }
}
</style>

<style lang="scss">
.loading-dialog>div {
  pointer-events: none !important;

  .el-dialog {
    pointer-events: all;
  }

  .el-overlay-dialog {
    overflow: hidden;
  }
}
</style>