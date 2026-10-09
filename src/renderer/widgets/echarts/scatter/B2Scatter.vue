<template>
  <b2-axis></b2-axis>
</template>

<script lang="ts" setup>
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { useWidget } from "@renderer/b2/types";
import { Scatter } from "./scatter";
const scatter = useWidget<Scatter>();

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
