<template>
  <b2-biaxial></b2-biaxial>
</template>

<script lang="ts" setup>
import { TheWidget as Biaxial, component as B2Biaxial } from "@renderer/widgets/echarts/biaxial";
import { useWidget } from "@renderer/b2/types";
import { BiaxialStack } from './biaxial-stack';
const biaxialStack = useWidget<BiaxialStack>();

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
