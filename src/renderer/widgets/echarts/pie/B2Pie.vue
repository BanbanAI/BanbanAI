<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { onMounted, watch } from "vue";
import { Pie } from "./pie";

const pie = useWidget<Pie>();

onMounted(() => {
  watch(() => {
    return {
      catAxis: pie.getOption("axis-category"),
      valueAxis: pie.getOption("axis-value"),
    }
  }, () => {
    pie.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped></style>
