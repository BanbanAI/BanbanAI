<template>
  <b2-chart></b2-chart>
</template>
<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as EchartsChart, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { Pizza } from "./pizza";
import { onMounted, watch } from "vue";

const pizza = useWidget<Pizza>();

onMounted(() => {
  watch(() => {
    return {
      fieldsAxis: pizza.getOption("axis-fields"),
    }
  }, () => {
    pizza.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
