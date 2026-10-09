<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { River } from "./river";
import { onMounted, watch } from "vue";
const river = useWidget<River>();

onMounted(() => {
  watch(() => {
    return {
      dateAxis: river.getOption("axis-date"),
      catAxis: river.getOption("axis-category"),
      valueAxis: river.getOption("axis-value"),
    }
  }, () => {
    river.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
