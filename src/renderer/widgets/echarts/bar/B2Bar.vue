<template>
  <b2-column></b2-column>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Column, component as B2Column } from "@renderer/widgets/echarts/column";
import { Bar } from "./bar";
const bar = useWidget<Bar>();

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
