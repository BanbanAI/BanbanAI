<template>
  <b2-chart></b2-chart>
</template>
<script lang="ts">
import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";

</script>

<script lang="ts" setup>
import { OptionFieldValue, useWidget } from "@renderer/b2/types";
import { onMounted, watch } from "vue";
import { PolarBar } from "./polar-bar";
const polarBar = useWidget<PolarBar>();

onMounted(() => {
  watch(() => {
    return {
      catAxis: polarBar.getOption("axis-category"),
      valueAxis: polarBar.getOption("axis-value"),
    }
  }, () => {
    polarBar.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
