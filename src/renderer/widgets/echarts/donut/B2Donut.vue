<template>
  <b2-pie></b2-pie>
</template>

<script lang="ts" setup>
import { TheWidget as Pie, component as B2Pie } from "@renderer/widgets/echarts/pie";
import { useWidget } from "@renderer/b2/types";
import { watch, onMounted, onUnmounted } from "vue";
import { Donut } from "./donut";
import { equals } from "@common/utils/object";
const donut = useWidget<Donut>();

onMounted(()=>{
  watch(()=>{
    return {
      visible: donut.status.isVisible,
      display: donut.getOption("animation-display")
    }
  },(val,oldval)=>{
    if(!equals(val, oldval)){
      if(val.visible && val.display){
        let delay = donut.getOption<number>("animation-display-delay");
        clearTimeout(donut.delayTimer);
        donut.delayTimer = setTimeout(() => donut.decorationsRotation(), delay * 1000);
      } else {
        donut.stopRotation()
      }
    }
  },{ immediate: true })
})

onUnmounted(()=>{
  donut.stopRotation()
  donut.echartsChart.off('finished')
})
</script>

<style lang="scss" scoped>
</style>
