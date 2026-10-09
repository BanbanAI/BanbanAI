<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { Gauge } from "./gauge";
import { onMounted, watch } from "vue";
const gauge = useWidget<Gauge>();


onMounted(() => {
  watch(() => {
    return {
      valueAxis: gauge.getOption("axis-value"),
    }
  }, () => {
    gauge.checkErrorData();
  }, { immediate: true, deep: true })
})

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
