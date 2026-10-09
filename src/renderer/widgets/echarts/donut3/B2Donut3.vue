<template>
  <b2-pie3></b2-pie3>
</template>

<script lang="ts" setup>
import { TheWidget as Pie3, component as B2Pie3 } from "@renderer/widgets/echarts/pie3";
import { useWidget } from "@renderer/b2/types";
import { Dount3 } from "./dount3";
const dount3 = useWidget<Dount3>();
</script>

<style lang="scss" scoped>
</style>
