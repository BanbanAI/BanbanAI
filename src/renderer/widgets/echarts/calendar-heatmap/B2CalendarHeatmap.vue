<template>
  <b2-color-lump></b2-color-lump>
</template>

<script lang="ts" setup>
import { TheWidget as ColorLump, component as B2ColorLump } from "@renderer/widgets/echarts/color-lump";
import { useWidget } from "@renderer/b2/types"
import { CalendarHeatmap } from "./calendar-heatmap"
import { onMounted, watch } from "vue";
const calendarHeatmap = useWidget<CalendarHeatmap>();

onMounted(() => {
  watch(() => {
    return {
      dateAxis: calendarHeatmap.getOption("axis-date"),
      valuexis: calendarHeatmap.getOption("axis-value"),
    }
  }, () => {
    calendarHeatmap.checkErrorData();
  }, { immediate: true, deep: true })
})
</script>

<style lang="scss" scoped>
</style>
