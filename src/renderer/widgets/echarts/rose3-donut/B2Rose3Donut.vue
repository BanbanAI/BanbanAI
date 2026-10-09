<template>
  <b2-pie3></b2-pie3>
</template>

<script lang="ts" setup>
import { TheWidget as Pie3, component as B2Pie3, } from "@renderer/widgets/echarts/pie3";
import { useWidget } from "@renderer/b2/types";
import { Rose3Donut } from "./rose3-donut";
const rose3 = useWidget<Rose3Donut>();
</script>

<style lang="scss" scoped>
</style>
