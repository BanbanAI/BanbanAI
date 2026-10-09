<template>
  <b2-area></b2-area>
</template>


<script lang="ts" setup>
import { TheWidget as Area, component as B2Area } from "@renderer/widgets/echarts/area";
import { useWidget } from "@renderer/b2/types";
import { AreaRainfall } from "./area-rainfall";
const areaRainfall = useWidget<AreaRainfall>();
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>./area-rainfall
