<template>
  <b2-axis ref="ganttDiv">
  </b2-axis>
</template>

<script lang="ts" setup>
import { useMouseInElement, useEventListener } from "@vueuse/core";
import { TheWidget as Axis, component as B2Axis } from "@renderer/widgets/echarts/axis";
import { useWidget } from "@renderer/b2/types";
import { onMounted, ref, onUnmounted, watch} from 'vue';
import { Gantt } from "./gantt";
const gantt = useWidget<Gantt>();
const ganttDiv = ref(null);
let flag = 1;
const { isOutside } = useMouseInElement(ganttDiv)
onMounted(() => {
  gantt.selectDispatchAction()
  document.addEventListener("keydown", removeDown)
  document.addEventListener("keyup", removeUp)

  watch(() => {
    return {
      nameAxis: gantt.getOption("axis-name"),
      startAxis: gantt.getOption("axis-start"),
      endAxis: gantt.getOption("axis-end"),
      valueAxis: gantt.getOption("axis-value"),
    }
  }, () => {
    gantt.checkErrorData();
  }, { immediate: true, deep: true })
})


const removeDown = (ev) => {
  if (!isOutside.value && ev.key === "Shift") {
    if (flag && gantt.getOption("x-display") && gantt.getOption("y-display")) {
      flag = 0
      gantt.echartsChart.setOption({
        dataZoom: [{ id: "zoomInside", moveOnMouseWheel: false, },
        ]
      })
    }
  }
}

const removeUp = (ev) => {
  if (!isOutside.value && ev.key === "Shift") {
    if (!flag && gantt.getOption("x-display") && gantt.getOption("y-display")) {
      flag = 1
      gantt.echartsChart.setOption({
        dataZoom: [{ id: "zoomInside", moveOnMouseWheel: true },
        ]
      })
    }
  }
}

onUnmounted(() => {
  document.removeEventListener("keydown", removeDown)
  document.removeEventListener("keyup", removeUp)
})

</script>

<style lang="scss" scoped></style>
