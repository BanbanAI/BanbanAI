<template>
  <div class="form-real-time-editor-container">
    <el-scrollbar>
      <div v-for="(widget, index) in showWidgets" :key="widget.uid" class="widget-wrapper">
        <span class="widget-name" :title="widget.title">{{ widget.title }}</span>
        <x-widget :widget="widget"></x-widget>
      </div>
    </el-scrollbar>
  </div>
</template>

<script lang='ts' setup>
import { AbstractForm } from '@renderer/b2/controllers/form';
import { computed } from 'vue';
import { SubForm } from './subForm';
import { FormElement } from '@renderer/b2/controllers/form';

const props = defineProps<{
  form: AbstractForm;
}>();
const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void
  (event: "update", value: object[]): void;
}>();

const showWidgets = computed(() => {
  return (props.form.children as FormElement[]).filter(widget => !widget.isHidden);
})

</script>

<style lang='scss' scoped>
.form-real-time-editor-container {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-scrollbar) {
    .el-scrollbar__view {
      display: flex;
      flex-direction: column;
      row-gap: 20px;
      padding: 10px;
    }

    .el-scrollbar__bar {
      margin-right: 6px;
      transform: translateX(6px);
    }

    .el-scrollbar__thumb {
      width: 6px;
    }
  }

  .widget-wrapper {
    display: flex;
    flex-direction: column;
    min-width: 0;

    .widget-name {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      color: var(--text-color-primary);
      margin-bottom: 2px;
      line-height: 20px;
      font-weight: 700;
    }

    .b2widget {
      padding: 0;
    }
  }
}
</style>
