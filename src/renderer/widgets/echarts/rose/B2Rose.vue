<template>
  <b2-pie></b2-pie>
</template>

<script lang="ts" setup>
import { TheWidget as Pie, component as B2Pie } from "@renderer/widgets/echarts/pie";
import { useWidget } from "@renderer/b2/types";
import { Rose } from "./rose"
const rose = useWidget<Rose>();

</script>

<style lang="scss" scoped>
</style>
