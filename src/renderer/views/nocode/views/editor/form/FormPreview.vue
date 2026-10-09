<template>
  <div class="form-preview">
    <el-drawer
      :model-value="modelValue"
      @update:model-value="emit('update:modelValue', $event)"
      close-on-click-modal
      :title="i18next.t('formPreview.preview')"
      direction="btt"
      :destroy-on-close="true"
    >
      <div class="form-preview-content" v-loading="isLoading">
        <!-- <iframe class="nocode-form-box" :src="url" frameborder="0" @load="onIframeLoad"></iframe> -->
        <nocode-form :nocodeId="nocodeId" :tableUID="tableUID" :isPreview="true" @ready="onIframeLoad" />
        <div class="form-preview-content-footer">
          <el-button type="primary" @click="submit">{{ $t("formPreview.confirm") }}</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang='ts'>
import { useSettingStore } from '@renderer/stores/setting';
import { ElMessage } from 'element-plus';
import i18next from 'i18next';
import { ref, computed, inject, watch } from 'vue';
import { useFormData, useFormTable } from './hooks';
import { NOCODE_ID } from '@renderer/types';
import { OptionTableUID } from '@common/types/project';

const props = defineProps<{
  modelValue: boolean,
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const settingState = useSettingStore();

// 加载状态
const isLoading = ref(true);

const nocodeId = inject(NOCODE_ID);
const table = useFormTable();
const formData = useFormData();
const tableUID = computed(() => [formData.value?.uid, table.value?.uid]);

const submit = () => {
  ElMessage.warning(i18next.t('FormPreview.previewTips'));
}

// iframe加载完成事件处理
const onIframeLoad = () => {
  isLoading.value = false;
};

const relatedTableUIDsArray = ref([]);
const getRelatedTables = () => {
  const relatedTables: OptionTableUID[] = [];
  for (const filed of table.value.fields) {
    const subTableUID = filed.meta.extra?.subTableUID;
    if (subTableUID) {
      relatedTables.push(subTableUID);
    }
  }
  return relatedTables;
}

const init = async() => {
  // 开始加载时显示加载状态
  isLoading.value = true;

  const relatedTables = getRelatedTables();
  relatedTableUIDsArray.value = relatedTables.map(uid => uid.join()) || [];
}

const url = computed(() => {
  const relatedTableUIDsArrayStr = encodeURIComponent(JSON.stringify(relatedTableUIDsArray.value || []));
  const tableUIDStr = encodeURIComponent(JSON.stringify(tableUID.value || []));
  return `/#/nocode/form?nocodeId=${nocodeId}&tableUID=${tableUIDStr}&relatedTableUIDsArray=${relatedTableUIDsArrayStr}&isPreview=true`;
});

watch(() => props.modelValue, async(val) => {
  if (val) {
    await init();
  }
}, { immediate: true });

</script>

<style scoped lang='scss'>
.form-preview {
  --el-dialog-padding-primary: 0px;
  :deep(.el-overlay) {
    background-color: var(--el-overlay-color-lighter) !important;
  }
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

    .el-drawer__body {
      .form-preview-content {
        width: 1024px;
        height: 100%;
        margin: 0 auto;
        background-color: var(--bg-color-page);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        box-shadow: 0px 0px 8px var(--border-color-light);

        .nocode-form-box {
          width: 100%;
          height: calc(100% - 40px);
        }

        .form-preview-content-footer {
          width: 100%;
          padding: 10px 24px;
          border-top: 1px solid var(--border-color);
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
}
</style>