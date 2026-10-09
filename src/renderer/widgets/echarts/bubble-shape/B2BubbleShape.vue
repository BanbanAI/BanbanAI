<template>
  <b2-bubble></b2-bubble>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Bubble, component as B2Bubble } from "@renderer/widgets/echarts/bubble";
import { BubbleShape } from "./bubble-shape";
const widget = useWidget<BubbleShape>();
</script>

<style lang="scss" scoped>
</style>
