<template>
  <b2-bar></b2-bar>
</template>

<script lang="ts" setup>
import { TheWidget as Bar, component as B2Bar } from "@renderer/widgets/echarts/bar";
import { useWidget } from "@renderer/b2/types";
import { BarStack } from "./bar-stack";

const barStack = useWidget<BarStack>();

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
