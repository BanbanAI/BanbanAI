<template>
  <b2-line></b2-line>
</template>

<script lang="ts" setup>
import { TheWidget as Line, component as B2Line } from "@renderer/widgets/echarts/line";
import { OptionFieldValue, useWidget } from "@renderer/b2/types";
import { Area } from "./area";
const area = useWidget<Area>();

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
