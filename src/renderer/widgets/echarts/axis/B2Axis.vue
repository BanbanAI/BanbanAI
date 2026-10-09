<template>
  <b2-echarts></b2-echarts>
</template>

<script lang="ts" setup>
import { component as B2Echarts } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { watch, onMounted } from "vue";
import { Axis } from "./axis";

const axis = useWidget<Axis>();

watch(() => axis.status.isVisible, (val, oldVal) => {
  if (val !== oldVal) {
    axis.stopAnimate = !val;
  }
})

onMounted(() => {
  watch(() => {
    return {
      xAxis: axis.getOption("axis-x"),
      yAxis: axis.getOption("axis-y"),
      lineAxis: axis.getOption("axis-line"),
    }
  }, () => {
    axis.checkErrorData();
  }, { immediate: true, deep: true })
})

</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
