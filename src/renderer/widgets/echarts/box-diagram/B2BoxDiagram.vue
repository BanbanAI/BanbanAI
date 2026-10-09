<template>
  <b2-axis></b2-axis>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { BoxDiagram } from './box-diagram';
import { watch, onMounted } from "vue";
const boxDiagram = useWidget<BoxDiagram>();

onMounted(() => {
  watch(() => {
    return {
      valAxis: boxDiagram.getOption("axis-value"),
    }
  }, () => {
    boxDiagram.checkErrorData();
  }, { immediate: true, deep: true })
})

</script>

<style lang="scss" scoped>
</style>
