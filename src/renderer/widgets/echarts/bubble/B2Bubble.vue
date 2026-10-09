<template>
  <b2-scatter></b2-scatter>
</template>

<script lang="ts" setup>
import { TheWidget as Scatter, component as B2Scatter } from "@renderer/widgets/echarts/scatter";
import { useWidget } from "@renderer/b2/types";
import { Bubble } from "./bubble";
const bubble = useWidget<Bubble>();
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
