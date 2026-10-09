<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types"
import { Liquid } from "./liquid";
const liquid = useWidget<Liquid>();
</script>

<style lang="scss" scoped>
</style>
