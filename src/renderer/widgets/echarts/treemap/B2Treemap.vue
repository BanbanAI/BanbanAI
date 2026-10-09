<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { Treemap } from "./treemap";
import { onMounted, watch } from "vue";
const treemap = useWidget<Treemap>();

onMounted(() => {
  watch(() => {
    return {
      catAxis: treemap.getOption("axis-category"),
      valueAxis: treemap.getOption("axis-value"),
    }
  }, () => {
    treemap.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
