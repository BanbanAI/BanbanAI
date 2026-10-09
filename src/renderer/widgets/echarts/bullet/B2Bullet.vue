<template>
  <b2-chart> </b2-chart>
</template>

<script lang="ts" setup>
import { OptionFieldValue, useWidget } from "@renderer/b2/types";
import {  TheWidget as Echarts,  component as B2Chart,} from "@renderer/widgets/echarts/basic";
import { Bullet } from "./bullet"
import { onMounted, watch } from "vue";
const bullet = useWidget<Bullet>();

onMounted(() => {
  watch(() => {
    return {
      titleAxis: bullet.getOption<OptionFieldValue[]>("axis-title"),
      rangesAxis: bullet.getOption<OptionFieldValue[]>("axis-ranges"),
      actualAxis: bullet.getOption<OptionFieldValue[]>("axis-actual"),
      valueAxis: bullet.getOption<OptionFieldValue[]>("axis-target-value"),
    }
  }, () => {
    bullet.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
