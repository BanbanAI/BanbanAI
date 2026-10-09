<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { onMounted, watch } from "vue";
import { SankeyV2 } from "./sankeyV2";

const sankey = useWidget<SankeyV2>();
onMounted(() => {
  watch(() => {
    return {
      valsAxis: sankey.getOption("axis-values"),
      nodesAxis: sankey.getOption("axis-nodes"),
    }
  }, () => {
    sankey.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
