<template>
  <b2-columnPercent></b2-columnPercent>
</template>

<script lang="ts" setup>
import { TheWidget as ColumnPercent, component as B2ColumnPercent } from "@renderer/widgets/echarts/column-percent";
import { useWidget } from "@renderer/b2/types";
import { BarPercent } from "./bar-percent";
const barPercent = useWidget<BarPercent>();


</script>

<style lang="scss" scoped>
</style>
