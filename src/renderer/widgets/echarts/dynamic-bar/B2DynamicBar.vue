<template>
  <b2-axis></b2-axis>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { DynamicBar } from "./dynamic-bar";
import { onMounted, watch } from "vue";
const dynamicBar = useWidget<DynamicBar>();

onMounted(() => {
  watch(() => {
    return {
      xAxis: dynamicBar.getOption("axis-x"),
      yAxis: dynamicBar.getOption("axis-y"),
    }
  }, () => {
    dynamicBar.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
