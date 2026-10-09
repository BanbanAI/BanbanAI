<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { FunnelSymmetric } from './funnel-symmetric';
import { onMounted, watch } from "vue";

const funnelSymmetric = useWidget<FunnelSymmetric>();

onMounted(() => {
  watch(() => {
    return {
      catAxis: funnelSymmetric.getOption("axis-category"),
      value1Axis: funnelSymmetric.getOption("axis-value1"),
      value2Axis: funnelSymmetric.getOption("axis-value2"),
    }
  }, () => {
    funnelSymmetric.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
