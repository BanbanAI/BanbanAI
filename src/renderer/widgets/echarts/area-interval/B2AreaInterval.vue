<template>
  <b2-line></b2-line>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Line, component as B2Line } from "@renderer/widgets/echarts/line";
import { AreaInterval } from "./area-interval";
const areaInterval = useWidget<AreaInterval>();

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
