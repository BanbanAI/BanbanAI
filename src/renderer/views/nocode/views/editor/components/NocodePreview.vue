<template>
  <div class="nocode-preview">
    <el-drawer
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      :title="i18next.t('nocodePreview.preview')"
      direction="btt"
      close-on-click-modal
      :destroy-on-close="true"
    >
      <div class="nocode-preview-content" v-loading="isLoading">
        <iframe :src="url" frameborder="0" @load="onIframeLoad"></iframe>
      </div>
    </el-drawer>
  </div>
</template>
<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import i18next from 'i18next';
import { useSettingStore } from '@renderer/stores';

const settingState = useSettingStore();

const props = defineProps<{
  modelValue: boolean,
  nocodeId: string,
  projectId: string
}>();

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void;
}>();

// 添加加载状态
const isLoading = ref(true);

const url = computed(() => {
  return `/#/preview/page/${props.nocodeId}/${props.projectId}?isPreview=${true}`;
})

// iframe加载完成事件处理
const onIframeLoad = () => {
  isLoading.value = false;
}

// 监听modelValue变化，重置加载状态
watch(() => props.modelValue, (val) => {
  if (val) {
    // 每次打开预览时重置加载状态
    isLoading.value = true;
  }
}, { immediate: true });

</script>

<style scoped lang='scss'>
.nocode-preview {
  --el-dialog-padding-primary: 0px;
  :deep(.el-drawer) {
    height: 90% !important;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;

    .el-drawer__header {
      height: 40px;
      padding: 8px 0 8px 16px;
      background-color: var(--bg-color-page);
      border-bottom: 1px solid var(--border-color);
      margin: 0;
      .el-drawer__title {
        font-size: 14px;
        color: var(--text-color-primary);
      }
      .el-drawer__close-btn {
        width: 40px;
        height: 40px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: var(--cursor-pointer);
      }
    }

    .nocode-preview-content {
      width: 100%;
      height: 100%;
      border-radius: 4px;
      background-color: var(--bg-color-page);
      iframe {
        width: 100%;
        height: 100%;
        border-radius: 4px;
      }
    }
  }
}
</style>