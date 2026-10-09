<template>
  <b2-column></b2-column>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Column, component as B2Column } from "@renderer/widgets/echarts/column";
import { ColumnPercent } from "./column-percent";
const columnPercent = useWidget<ColumnPercent>();
</script>

<style lang="scss" scoped></style>
