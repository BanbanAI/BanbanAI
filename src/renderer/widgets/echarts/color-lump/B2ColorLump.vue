<template>
  <b2-polar-heatmap></b2-polar-heatmap>
</template>

<script lang="ts" setup>
import { TheWidget as PolarHeatmap, component as B2PolarHeatmap } from "@renderer/widgets/echarts/polar-heatmap";
import { useWidget } from "@renderer/b2/types";
import { ColorLump } from "./color-lump"
const colorlump = useWidget<ColorLump>();
</script>

<style lang="scss" scoped>
</style>

