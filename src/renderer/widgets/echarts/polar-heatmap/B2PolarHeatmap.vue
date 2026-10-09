<template>
  <b2-echarts></b2-echarts>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Echarts } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { PolarHeatmap } from "./polar-heatmap";
import { onMounted, watch } from "vue";
const polarheatmap = useWidget<PolarHeatmap>();

onMounted(() => {
  watch(() => {
    return {
      angleAxis: polarheatmap.getOption("axis-angle"),
      radiusAxis: polarheatmap.getOption("axis-radius"),
      valueAxis: polarheatmap.getOption("axis-value"),
    }
  }, () => {
    polarheatmap.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
