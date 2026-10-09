<template>
  <b2-chart></b2-chart>
</template>

<script lang="ts" setup>
import { TheWidget as Echarts, component as B2Chart } from "@renderer/widgets/echarts/basic";
import { useWidget } from "@renderer/b2/types";
import { Funnel } from "./funnel"
import { onMounted, watch } from "vue";
const funnel = useWidget<Funnel>();

onMounted(() => {
  watch(() => {
    return {
      catAxis: funnel.getOption("axis-category"),
      valuexis: funnel.getOption("axis-value"),
    }
  }, () => {
    funnel.checkErrorData();
  }, { immediate: true, deep: true })

  watch(() => funnel.getOption("funnel-shape"), (val, oldVal) => {
    if (val !== oldVal && (val === "rectangle" || oldVal === "rectangle")) {
      funnel.resetChartOption()
      if (oldVal === "rectangle") {
        funnel.echartsChart.off("legendselectchanged")
      }
      if (val === "rectangle") {
        funnel.echartsChart.on("legendselectchanged", (params) => {
          let selects = params.selected || [];
          let newDataSet = funnel._tempDatasetSource.value.map((item) => {
            if (selects[item.name]) {
              return item
            } else {
              return {
                ...item,
                value: 0
              }
            }
          });
          funnel.calculateCount(newDataSet)
          funnel.echartsChart.setOption({
            dataset: { source: newDataSet },
            series: funnel.echartsSeriesOption
          }, {
            notMerge: false,
            replaceMerge: ["dataset", "series"]
          })

        })
      }
    }
  }, { immediate: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
