<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types"
import { Radar } from "./radar";
import { onMounted, watch } from "vue";

const radar = useWidget<Radar>();

onMounted(() => {
  watch(() => {
    return {
      xAxis: radar.getOption("axis-x"),
      yAxis: radar.getOption("axis-y"),
    }
  }, () => {
    radar.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
