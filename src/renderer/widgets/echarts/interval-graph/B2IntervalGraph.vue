<template>
  <b2-interval-histogram></b2-interval-histogram>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types"
import { TheWidget as IntervalHistogram, component as B2IntervalHistogram } from "@renderer/widgets/echarts/interval-histogram";
import { IntervalGraph } from "./interval-graph"

const intervalGraph = useWidget<IntervalGraph>();
</script>

<style lang="scss" scoped>
</style>
