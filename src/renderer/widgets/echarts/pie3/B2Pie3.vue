<template>
  <b2-pie @mouseenter="handleMouseoverFn" @mouseleave="handleMouseleaveFn" style="pointer-events: all;"></b2-pie>
  <!-- <canvas style="display:none;"></canvas> -->
</template>

<script lang="ts">
</script>

<script lang="ts" setup>
import { TheWidget as Pie, component as B2Pie } from "@renderer/widgets/echarts/pie";
import { useWidget } from "@renderer/b2/types";
import { watch, onUnmounted } from "vue";
import { Pie3 } from "./pie3"
const pie3 = useWidget<Pie3>();

const handleMouseoverFn = ()=>{
  pie3.animation_display_paused = true;
}
const handleMouseleaveFn = ()=>{
  pie3.animation_display_paused = false;
}

watch(() => pie3.status.isVisible, (value, oldValue)=>{
  if(!pie3.getOption("webgl-optimization")) return;
  if(value === oldValue) return;
  if(value) {
    setTimeout(()=>{
      pie3.initEchartsInstances();
      pie3.loadEcharts();
      pie3.echartsElement.style.opacity = "1";
    }, 100)
  } else {
    pie3.echartsElement.getElementsByTagName("canvas")[0].getContext('webgl').getExtension('WEBGL_lose_context').loseContext();
    pie3.echartsChart.dispose();
    pie3.echartsElement.style.opacity = "0";
  }
})

onUnmounted(() => {
  pie3.stopAnimate = true;
});
</script>

<style lang="scss" scoped>
</style>
