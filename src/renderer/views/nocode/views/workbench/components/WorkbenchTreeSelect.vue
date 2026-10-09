<template>
  <el-tree-select
    :model-value="modelValue"
    @update:model-value="value => emit('update:modelValue', value)"
    :data="data"
    check-strictly
    :placeholder="placeholder"
    :class="[theme, 'workbench-tree-select']"
    popper-class="custom-select-tree-popper"
    :collapse-tags="true"
  >
    <template #default="{ data: node }">
      <span>
        {{ node.label }}
      </span>
    </template>
  </el-tree-select>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import i18next from 'i18next'

interface treeData {
  label: string,
  value:string,
  children: string
}
const props = defineProps({
  modelValue: String,
  data: Array<treeData>,
  placeholder: {
    type: String,
    default: () => i18next.t('WorkbenchTreeSelect.plsSelect')
  },
  theme: {
    type: String,
    default: 'light',
    validator: (value: string) => ['dark', 'light'].includes(value)
  }
})
const emit = defineEmits(['update:modelValue'])

const popperClass = computed(() => {
  return `workbench-tree-select-popper ${props.theme}`;
})

</script>

<style lang="scss" scoped>
.dark {
  --el-fill-color-blank: transparent;
  --el-bg-color: #1d1e1f;
  --el-text-color-primary: #b2b2b2;
  --el-border-color: #434343;
  --el-select-dropdown-bg-color: #1d1e1f;
  --el-tree-node-hover-bg-color: #2c2c2c;
}

.light {
  --el-color-info-light-8: #e9e9eb;
  --el-color-info-light-9: #eeeeee;
}

.el-select__wrapper {
  background-color: var(--el-bg-color);
  color: var(--el-text-color-primary);
  border-color: var(--el-border-color);
}

.el-select__placeholder {
  color: var(--el-text-color-primary);
}
</style>
<style lang="scss">
.workbench-tree-select-popper{
  &.light{
    --el-fill-color-blank: #f5f5f7;
    --el-bg-color: #f5f5f5;
    --el-text-color-regular: #606266;
    --el-text-color-primary: var(--color-primary);
    --el-border-color: #dcdfe6;
    --el-tree-node-hover-bg-color: #f5f7fa;
    --el-bg-color-overlay: var(--el-fill-color-blank);
    --el-select-dropdown-bg-color: var(--el-fill-color-blank);
    --el-border-color-light: #e4e7ed;
    --el-fill-color-light: #cccccc;
    --el-color-primary: var(--el-text-color-primary);
  }
  .el-tree {
    background-color: var(--el-select-dropdown-bg-color);
  }

  .el-tree-node__content {    
    &:hover {
      background-color: var(--el-tree-node-hover-bg-color);
    }
  }
}
</style>
