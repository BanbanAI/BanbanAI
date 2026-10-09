<template>
  <b2-axis></b2-axis>
</template>

<script lang="ts" setup>
import {  OptionFieldValue, useWidget } from "@renderer/b2/types";
import { component as B2Axis } from "@renderer/widgets/echarts/axis";
import { onMounted, watch } from "vue";
import { Column } from "./column";
import { debounce } from "lodash";

const column = useWidget<Column>();

onMounted(()=>{
  watch(() => {
    let conditions = JSON.stringify(column.getOption("series-color-cluster") || {});
    return {conditions}
  }, debounce((val, oldValue)=>{
    if(val.conditions !== oldValue.conditions) {
      let newOpt = column.echartsOption["series"];
      column.echartsChart.setOption({series: newOpt}, {
        notMerge: false,
        replaceMerge: "series",
        lazyUpdate: true
      });
    }
  }, 200), {deep: true})

  watch(() => {
    return {
      axisX: column.getOption<OptionFieldValue[]>("axis-x"),
      axisY: column.getOption<OptionFieldValue[]>("axis-y")
    }
  }, (curVal, oldVal) => {
    if (JSON.stringify(curVal.axisX) !== JSON.stringify(oldVal.axisX) || JSON.stringify(curVal.axisY) !== JSON.stringify(oldVal.axisY)) {
      let colorIndexes = column.getArrayClusterIndexes("series-color-cluster");
      for (const index of colorIndexes) {
        let conditionSetting = column.getOption(['series-color-cluster', colorIndexes[index], "condition-setting"])
        if (conditionSetting) {
          let path = ['series-color-cluster', colorIndexes[index]]
          let indexes = column.getOption([...path, "single-settings-condition-cluster"])?.["indexes"] || [];
          for (const clusterIndex of indexes) {
            column.setOption([...path, 'single-settings-condition-cluster', clusterIndex, "condition-field"], column.defaultConditionField);
          }
        }
      }
    }
  })

  watch(() => [column.getOption<boolean>("texture-image-animation"), column.getOption("texture-image-animation-duration")], (newVal, oldVal)=>{
    const textureOffsetY = column.textureOffsetY;
  }, { deep: true })
})
</script>

<style lang="scss" scoped>
.chart {
  width: 100%;
  height: 100%;
}
</style>
