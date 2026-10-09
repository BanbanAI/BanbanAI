<template>
  <b2-column></b2-column>
</template>

<script lang="ts" setup>
import { OptionFieldValue, useWidget } from "@renderer/b2/types";
import { Widget } from "@renderer/b2/controllers/widget";
import { TheWidget as Column, component as B2Column } from "@renderer/widgets/echarts/column";
import { Column3 } from "./column3d"
const column = useWidget<Column3>();


</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
