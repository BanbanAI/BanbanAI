<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { ProgressV2 } from "./progressV2";
import { onMounted, watch } from "vue";
const progress = useWidget<ProgressV2>();

onMounted(() => {
  watch(() => {
    return {
      catAxis: progress.getOption("axis-category"),
      valueAxis: progress.getOption("axis-value"),
    }
  }, () => {
    progress.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
