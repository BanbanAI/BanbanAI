<template>
  <b2-chart> </b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { Punch } from './punch';
import { onMounted, watch } from "vue";
const punch = useWidget<Punch>();

onMounted(() => {
  watch(() => {
    return {
      dateAxis: punch.getOption("axis-date"),
      valueAxis: punch.getOption("axis-value"),
    }
  }, () => {
    punch.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
