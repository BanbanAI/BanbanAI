<template>
  <b2-column3></b2-column3>
</template>

<script lang="ts" setup>
import { TheWidget as Column3, component as B2Column3 } from "@renderer/widgets/echarts/column3";
import { useWidget } from "@renderer/b2/types";
import { ColumnStack3 } from "./column-stack3"
const columnStack = useWidget<ColumnStack3>();

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
