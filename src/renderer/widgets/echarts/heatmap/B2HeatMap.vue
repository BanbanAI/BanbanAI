<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import {  useWidget } from "@renderer/b2/types";
import { HeatMap } from "./heat-map";
import { onMounted, watch } from "vue";
const heatMap = useWidget<HeatMap>();

onMounted(() => {
  watch(() => {
    return {
      xAxis: heatMap.getOption("axis-x"),
      yAxis: heatMap.getOption("axis-y"),
      valueAxis: heatMap.getOption("axis-value"),
    }
  }, () => {
    heatMap.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
