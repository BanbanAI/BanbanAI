<template>
  <b2-chart>
  </b2-chart>
</template>

<script lang="ts" setup>
import { component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { Wordle } from "./wordle";
import { onMounted, watch } from "vue";
const wordle = useWidget<Wordle>();


onMounted(() => {
  watch(() => {
    return {
      wordsAxis: wordle.getOption("axis-words"),
      freqAxis: wordle.getOption("axis-freq"),
    }
  }, () => {
    wordle.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped></style>
