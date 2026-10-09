<template>
  <div class="workbench-dialog">
    <el-dialog :modelValue="modelValue"
    @update:model-value="emit('update:modelValue', $event)" align-center draggable :close-on-click-modal="false" :append-to-body="false">
    <template #header>
        <span class="dialog-title">
          {{ title }}
        </span>
      </template>
      <div class="workbench-content">
        <slot name="content"></slot>        
      </div>
      <template #footer>
        <div class="workbench-button">
          <slot name="button"></slot>
        </div>
      </template>
    </el-dialog>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref, nextTick, watch, inject, StyleValue, onMounted, onUnmounted, provide, reactive } from "vue";
defineProps<{
  modelValue: boolean;
  title:string;
  width:string;
}>();
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean)
}>();
</script>

<style lang="scss" scoped>
.workbench-dialog {
  
  :deep(.el-dialog) {
    width: 360px;
    background-color: #fff;
    padding: 0;
    border-radius: 4px;
    box-shadow: none;

    .el-dialog__header {
      width: 100%; 
      height: 40px;
      border-bottom: 1px solid var(--border-color);
      padding: 8px 0;
      display: flex;

      .el-dialog__headerbtn {
        width: 40px;
        height: 40px;
        cursor: var(--cursor-pointer);
      }

      &>span {
        width: 100%;
        height: 100%;
        text-align: center;
        font-size: 14px;
        line-height: 20px;
      }
    }

    .el-dialog__body {
      color: var(--text-color-regular);
      padding: 0;

      .workbench-content {
        width: 100%;
        display: flex;
        color: var(--text-color-regular);
      }
    }

    .el-dialog__footer {
      padding: 0;
      .workbench-button {
        padding: 24px 24px 24px 0;
        padding-left: auto;

        .el-button {
          width: 60px;
          height: 32px;
          border-radius: 4px;
          cursor: var(--cursor-pointer);
        }
      }
    }
  }
}
</style>