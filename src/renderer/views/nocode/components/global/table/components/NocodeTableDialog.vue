<template>
  <div class="nocode-table-dialog">
    <el-dialog
      :title="title"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      width="80%"
      :center="!isMobileDevice"
      :align-center="!isMobileDevice"
      :fullscreen="isMobileDevice"
      :show-close="!isMobileDevice"
      :close-on-click-modal="false"
      draggable
      @closed="onClosed"
    >
      <template #header>
        <div class="title">
          <el-icon v-if="isMobileDevice" class="back-button" @click="handleCancel"><i-ep-arrow-left /></el-icon>
          <span>{{ title }}</span>
        </div>
      </template>
      <nocode-permission-table v-bind="attrs" />
    </el-dialog>
  </div>
</template>


<script setup lang="ts">
import { ref, onMounted, useAttrs, reactive } from 'vue'
import { isMobile } from '@renderer/utils';
import { providePreRow } from '@renderer/views/nocode/views/editor/form/hooks';
import { Row } from '@common/types/project';

const props = withDefaults(defineProps<{
  modelValue?: boolean,
  title: string,
}>(), {
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
}>();

const preRow = reactive<Row>({});
const attrs = useAttrs();
const isMobileDevice = isMobile();

const handleCancel = () => {
  emit('update:modelValue', false);
}

const handleClearPreRow = () => {
  for (const key in preRow) {
    delete preRow[key];
  }
}
const onClosed = () => {
  handleClearPreRow();
}
defineExpose({
  setPreRow(row: Row) {
    Object.assign(preRow, row);
  }
})

providePreRow(preRow)
</script>

<style scoped lang="scss">
.nocode-table-dialog {
  :deep(.el-overlay-dialog) {
    overflow: hidden;
  }
  :deep(.el-dialog) {
    border-radius: 4px;
    background-color: var(--color-white);
    max-height: 100%;
    height: 740px;

    .el-dialog__header {
      font-size: 18px;
      line-height: 24px;

      .title {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .el-dialog__body {
      height: calc(100% - 40px);
    }
  }
}

.nocode-table-dialog.mobile {
  :deep(.el-dialog) {
    padding: 0;
    border-radius: 0;
    display: flex;
    flex-direction: column;
    
    .el-dialog__header {
      padding: 0 16px;
      padding-bottom: 0;
      padding-top: 24px;
      .title {
        height: 44px;
        display: inline-flex;
        align-items: center;
        padding-right: 12px;
        gap: 8px;

        .back-button {
          color: var(--text-color-primary);
          font-size: 16px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        span {
          font-weight: 500;
          font-size: 16px;
          line-height: 24px;
          letter-spacing: 0px;
        }
      }
    }

    .el-dialog__body {
      flex: 1;
      padding: 0 6px;
      padding-bottom: 16px;
    }
  }
}
</style>
