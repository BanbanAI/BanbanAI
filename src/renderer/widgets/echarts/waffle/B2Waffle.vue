<template>
  <b2-chart></b2-chart>
</template>


<script lang="ts" setup>
import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { Waffle } from "./waffle";
import { onMounted, watch } from "vue";
const waffle = useWidget<Waffle>();


onMounted(() => {
  watch(() => {
    return {
      catAxis: waffle.getOption("axis-category"),
      valueAxis: waffle.getOption("axis-value"),
    }
  }, () => {
    waffle.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
