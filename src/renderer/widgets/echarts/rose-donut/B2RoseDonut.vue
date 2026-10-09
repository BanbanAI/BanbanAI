<template>
  <b2-rose></b2-rose>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Rose, component as B2Rose } from "@renderer/widgets/echarts/rose";
import { RoseDonut } from "./rose-donut";
const roseDonut = useWidget<RoseDonut>();
</script>

<style lang="scss" scoped>
</style>
