<template>
  <div class="nocode-page-dialog">
    <el-dialog class="nocode-page-container"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)" 
      @opened="emit('opened')" 
      align-center
      :show-close="false"
      destroy-on-close
      ref="dialogRef"
    >
      <div class="container">
        <div class="title">
          <el-icon @click="emit('update:modelValue', false)">
            <i-ep-arrow-left/>
          </el-icon>
          <span class="text">{{ props.pageName }}</span>
        </div>
        <div class="project-viewer-wrapper">
          <project-viewer
            :project="props.project"
            :nocode="props.nocode"
            :projectId="props.activePageId"
            :nocodeId="props.nocodeId"
            :webshare="true"
            :key="props.activePageId"
          />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{
  modelValue: boolean,
  pageName: string,
  activePageId: string,
  project: any,
  nocode: any,
  nocodeId: string,
  webshare: boolean,
  key: string
}>();
const emit = defineEmits<{
  (event: "closed"),
  (event: "opened"),
  (event: "submit"),
  (event: "back"),
  (event: 'cancel'),
  (event: "update:modelValue", value: boolean),
}>();
</script>

<style lang="scss" scoped>
.nocode-page-dialog {
  :deep(.nocode-page-container) {
    width: 100%;
    height: 100%;
    padding-top: 32px;

    .el-dialog__header {
      display: none;
    }
    .el-dialog__body {
      height: 100%;
      .container {
        height: 100%;
        .title {
          display: flex;
          align-items: center;
    
          .text {
            font-size: 16px;
            font-weight: 500;
            margin-left: 8px;
          }
        }
        .project-viewer-wrapper {
          margin-top: 16px;
          height: calc(100% - 32px);
        }
      }
    }
  }
}
</style>