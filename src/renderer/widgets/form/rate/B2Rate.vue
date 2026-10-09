<template>
  <b2-form-element>
    <el-rate v-model="widget.inputValue" :class="{ 'is-in-table': widget.isInTable }" @change="handleChanged" :colors="colorsComputed" :allow-half="widget.allowHalf" :max="widget.maxRate" :disabled="widget.isReadonly"/>
  </b2-form-element>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { Rate } from "./rate";
import { computed } from "vue";

const widget = useWidget<Rate>();

const colorsComputed = computed(() => {
  return [widget.rateColor, widget.rateColor, widget.rateColor];
});

const handleChanged = () => {
  widget.validate();
};
</script>

<style lang="scss" scoped>
.is-in-table {
  :deep(.el-rate__icon) {
    text-align: left;
  }
}
</style>
