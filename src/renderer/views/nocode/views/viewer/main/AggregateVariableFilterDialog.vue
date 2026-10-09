<template>
  <el-dialog
    :model-value="modelValue"
    class="aggregate-variable-filter-dialog-panel"
    width="760"
    align-center
    destroy-on-close
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #header>
      <div class="dialog-header">
        <div class="dialog-header__title">{{ $t('AggregateVariableFilterDialog.title') }}</div>
      </div>
    </template>

    <aggregate-variable-filter-editor
      ref="filterEditorRef"
      :value="value"
      :source-label="sourceLabel"
      :field-options="fieldOptions"
    />

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ $t('AggregateVariableFilterDialog.cancel') }}</el-button>
      <el-button type="primary" @click="handleConfirm">{{ $t('AggregateVariableFilterDialog.confirm') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { FilterRule } from '@common/types/nocode';
import { Field } from '@common/types/project';
import { ref } from 'vue';
import AggregateVariableFilterEditor from './AggregateVariableFilterEditor.vue';

type AggregateFilterFieldOption = {
  value: string,
  label: string,
  field?: Field | null,
};

const props = withDefaults(defineProps<{
  modelValue: boolean,
  value?: FilterRule | null,
  sourceLabel?: string,
  fieldOptions?: AggregateFilterFieldOption[],
}>(), {
  value: undefined,
  sourceLabel: '',
  fieldOptions: () => [],
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void,
  (event: 'update', value?: FilterRule): void,
}>();

const filterEditorRef = ref<InstanceType<typeof AggregateVariableFilterEditor>>();

const handleConfirm = () => {
  if (!filterEditorRef.value?.validate()) {
    return;
  }
  emit('update', filterEditorRef.value?.getValue());
  emit('update:modelValue', false);
};
</script>

<style scoped lang="scss">
.dialog-header__title {
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  text-align: center;
}
</style>

<style lang="scss">
.aggregate-variable-filter-dialog-panel {
  --el-dialog-padding-primary: 0;
  --el-dialog-bg-color: var(--bg-color-page);
  --dialog-header-height: 48px;
  --dialog-footer-height: 64px;
  border-radius: 8px;

  .el-dialog__header {
    height: var(--dialog-header-height);
    padding: 0 16px;
    margin-right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--border-color);
  }

  .el-dialog__headerbtn {
    top: 0;
    right: 0;
    width: var(--dialog-header-height);
    height: var(--dialog-header-height);
  }

  .el-dialog__body {
    padding: 16px;
  }

  .el-dialog__footer {
    height: var(--dialog-footer-height);
    padding: 16px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: end;
    align-items: center;
    background: var(--bg-color-page);
    border-radius: 0 0 8px 8px;
  }

  .el-dialog__footer .el-button {
    border-radius: 4px;
  }
}
</style>
