<template>
  <b2-line></b2-line>
</template>

<script lang="ts" setup>
import {  useWidget } from "@renderer/b2/types";
import { TheWidget as Line, component as B2Line } from "@renderer/widgets/echarts/line";
import { RoadMap } from "./road-map";
import { onMounted, watch } from "vue";

const roadmap = useWidget<RoadMap>();
onMounted(() => {
  watch(() => {
    return {
      xAxis: roadmap.getOption("axis-x"),
      yAxis: roadmap.getOption("axis-y"),
      catAxis: roadmap.getOption("axis-catalog"),
    }
  }, () => {
    roadmap.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
