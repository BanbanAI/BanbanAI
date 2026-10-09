<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { FunnelContrast } from "./funnel-contrast";
import { onMounted, watch } from "vue";
const funnelContrast = useWidget<FunnelContrast>();

onMounted(() => {
  watch(() => {
    return {
      catAxis: funnelContrast.getOption("axis-category"),
      value1Axis: funnelContrast.getOption("axis-value1"),
      value2Axis: funnelContrast.getOption("axis-value2"),
    }
  }, () => {
    funnelContrast.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
