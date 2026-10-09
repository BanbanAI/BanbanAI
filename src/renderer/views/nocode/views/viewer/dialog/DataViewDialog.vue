<template>
  <div class="data-view-drawer" v-if="useDrawer">
    <el-drawer
      class="data-view-drawer"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :z-index="resolvedDrawerZIndex"
      append-to-body
      size="70%"
      :show-close="false"
      close-on-click-modal
    >
      <template #header>
        <div class="data-view-drawer__header">
          <span class="data-view-drawer__title">{{ resolvedTitle }}</span>
          <el-button link class="data-view-drawer__close" @click="handleCancel">
            <el-icon><i-ep-close /></el-icon>
          </el-button>
        </div>
      </template>
      <nocode-data-view
        :key="dataViewKey"
        :active="modelValue"
        :nocodeId="nocodeId"
        :tableId="tableId"
        :filterPath="filterPath"
        v-bind="attrs"
        @title-change="handleTitleChange"
      />
    </el-drawer>
  </div>
  <div class="data-view-dialog" :class="{'mobile': isMobileDevice}" v-else>
    <el-dialog
      :title="resolvedTitle"
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      width="80%"
      :center="!isMobileDevice"
      :align-center="!isMobileDevice"
      :fullscreen="isMobileDevice"
      :show-close="!isMobileDevice"
    >
      <template #header>
        <div class="title">
          <el-icon v-if="isMobileDevice" class="back-button" @click="handleCancel"><i-ep-arrow-left /></el-icon>
          <span>{{ resolvedTitle }}</span>
        </div>
      </template>
      <nocode-data-view
        :key="dataViewKey"
        :active="modelValue"
        :nocodeId="nocodeId"
        :tableId="tableId"
        :filterPath="filterPath"
        v-bind="attrs"
        @title-change="handleTitleChange"
      />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, useAttrs } from 'vue'
import { isMobile } from '@renderer/utils';
import i18next from 'i18next';

const attrs = useAttrs();
const isMobileDevice = isMobile();

const props = withDefaults(defineProps<{
  nocodeId?: string,
  tableId?: string,
  filterPath?: string,
  title?: string,
  modelValue?: boolean,
  openMode?: 'dialog' | 'drawer',
  zIndex?: number,
}>(), {
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean),
}>();

const DATA_VIEW_DRAWER_Z_INDEX = 2100
const useDrawer = computed(() => props.openMode === 'drawer' && !isMobileDevice)
const resolvedDrawerZIndex = computed(() => props.zIndex ?? DATA_VIEW_DRAWER_Z_INDEX)
const dataViewKey = computed(() => `${props.nocodeId || ''}:${props.tableId || ''}:${props.filterPath || ''}`)
const resolvedTableTitle = ref('')
const resolvedTitle = computed(() => resolvedTableTitle.value || props.title || i18next.t('DataViewDialog.dataView'))

watch(() => dataViewKey.value, () => {
  resolvedTableTitle.value = ''
}, { immediate: true })

const handleTitleChange = (value: string) => {
  resolvedTableTitle.value = String(value || '').trim()
}

const handleCancel = () => {
  emit('update:modelValue', false);
}
</script>

<style scoped lang="scss">
.data-view-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    background-color: var(--color-white);

    .el-dialog__header {
      font-size: 18px;
      line-height: 24px;
    }

    .el-dialog__body {
      height: 700px;
    }
  }
}

.data-view-drawer {
  :deep(.el-drawer) {
    background-color: var(--color-white);

    .el-drawer__header {
      margin-bottom: 0;
      padding: 0 16px;
      height: 48px;
      border-bottom: 1px solid var(--border-color);
    }

    .el-drawer__body {
      padding: 0;
      overflow: hidden;
    }
  }
}

:deep(.data-view-drawer.el-drawer .el-drawer__header) {
  box-sizing: border-box;
}

.data-view-drawer__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-color-primary);
  font-size: 16px;
  line-height: 24px;
}

.data-view-drawer__title {
  flex: 1;
  min-width: 0;
}

.data-view-drawer__close {
  flex: 0 0 auto;
  margin-left: auto;
}

.data-view-dialog.mobile {
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
