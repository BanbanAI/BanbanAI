<template>
  <b2-column></b2-column>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { component as B2Column } from "@renderer/widgets/echarts/column";
import { ColumnStack } from "./column-stack";
const columnStack = useWidget<ColumnStack>();

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
