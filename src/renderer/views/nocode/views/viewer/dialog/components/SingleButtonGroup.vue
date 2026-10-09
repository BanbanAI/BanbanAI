<template>
  <div class="single-button-group">
    <el-button
      v-for="item in options"
      class="album-setting-fun"
      :class="{
        'is-checked': item.value === modelValue,
      }"
      :style="buttonStyle"
      :key="item.value"
      @click="handleButton(item)"
    >
      {{ item.label || item.value }}
    </el-button>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";

interface Option<T = any> {
  value: T;
  label: string;
}
interface Props<T = any> {
  options: Option<T>[];
  modelValue: T | "";
  width?: number;
}
const props = withDefaults(defineProps<Props<string>>(), {
  options: () => [],
  modelValue: "",
  width: 54,
});
const buttonStyle = computed(() => {
  return `
    width: ${props.width}px;
  `;
});
const emits = defineEmits<{
  (event: "handleClick", value: Option): void;
  (event: "update:modelValue", value: any): void;
}>();
const handleButton = (item: Option) => {
  emits("handleClick", item);
  emits("update:modelValue", item.value);
};
</script>
<style lang="scss">
.single-button-group {
  display: flex;
  align-items: center;

  .el-button {
    border: 1px solid #d9d9d9;
    background-color: #f5f6f7;
    color: #141414cc;
    margin: 0;
    font-size: 12px;
    height: 24px;
    box-sizing: border-box;

    &:first-child {
      border-radius: 2px 0px 0px 2px;
    }

    &:last-child {
      border-radius: 0px 2px 2px 0px;
    }
  }

  .el-button.is-checked {
    border: 1px solid var(--el-color-primary);
    color: #ffffff;
    background-color: var(--el-color-primary);
  }
}
</style>
