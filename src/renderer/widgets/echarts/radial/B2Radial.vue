<template>
  <b2-axis></b2-axis>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { Radial } from "./radial";
const radial = useWidget<Radial>();
</script>

<style lang="scss" scoped>
</style>
