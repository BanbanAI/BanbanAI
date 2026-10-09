<template>
  <b2-column></b2-column>
</template>

<script lang="ts" setup>
import { TheWidget as Column, component as B2Column } from "@renderer/widgets/echarts/column";
import { useWidget } from "@renderer/b2/types";
import { Waterfall } from "./waterfall"
const waterfall = useWidget<Waterfall>();

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
