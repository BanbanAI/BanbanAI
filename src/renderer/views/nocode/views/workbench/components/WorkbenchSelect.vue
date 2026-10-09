<template>
  <div class="workbench-select" :class="theme">
    <el-select :modelValue="modelValue" @update:model-value="emit('update:modelValue', $event)" :placeholder="placeholder" :multiple="multiple"  :no-data-text="modataText"
      popper-class="custom-popper-large" :offset="2" :collapse-tags="true">
      <el-option
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
  </div>
</template>

<script setup lang='ts'>
import { withDefaults } from 'vue';
import i18next from 'i18next';

interface SelectItem {
  label: string;
  value: string;
}

const props = withDefaults(defineProps<{  
  modelValue: string[];
  options: SelectItem[];
  placeholder?: string;
  multiple?: boolean;
  modataText?: string;
  theme?: string;
}>(), {
  placeholder: () => i18next.t('WorkbenchSelect.plsSelect'),
  multiple: false,
  modelValue: () => [],
  modataText: () => i18next.t('WorkbenchSelect.noData'),
});

const emit = defineEmits<{
  (event: 'update:modelValue', value: string[]): void;
}>();
</script>

<style lang='scss'>
.workbench-select {
  width: 100%;
  &.light{
    --el-color-info-light-8: #e9e9eb;
    --el-color-info-light-9: #eeeeee;
    --el-color-primary: #303133;
  }
}
.workbench-select-popper.light {
  --el-fill-color-blank: #f5f5f7;
  --el-text-color-regular: #606266;
  --el-text-color-primary: #303133;
  --el-bg-color-overlay: var(--el-fill-color-blank);
  --el-border-color-light: #e4e7ed;
  --el-fill-color-light: #cccccc;
  --el-color-primary: #303133;
}
</style>