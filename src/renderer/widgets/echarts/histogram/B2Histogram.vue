<template>
  <b2-axis></b2-axis>
</template>

<script lang="ts" setup>
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { useWidget } from "@renderer/b2/types";
import { Histogram } from "./histogram";
import { onMounted, watch } from "vue";

const histogram = useWidget<Histogram>();
onMounted(() => {
  watch(() => {
    return {
      valueAxis: histogram.getOption("axis-fields"),
    }
  }, () => {
    histogram.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
