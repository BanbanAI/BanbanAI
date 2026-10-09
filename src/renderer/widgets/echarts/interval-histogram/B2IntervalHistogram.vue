<template>
  <b2-axis></b2-axis>
</template>

<script lang="ts" setup>
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { useWidget } from "@renderer/b2/types";
import { IntervalHistogram } from "./interval-histogram";
import { onMounted, watch } from "vue";

const intervalHistogram = useWidget<IntervalHistogram>();

onMounted(() => {
  watch(() => {
    return {
      xAxis: intervalHistogram.getOption("axis-x"),
      startAxis: intervalHistogram.getOption("axis-start"),
      endAxis: intervalHistogram.getOption("axis-end"),
    }
  }, () => {
    intervalHistogram.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
