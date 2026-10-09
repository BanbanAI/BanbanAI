<template>
  <b2-widget>
    <div class="echarts" ref="echartsRef" @mouseenter="handleEnter" @mouseleave="handleLeave" :style="echartSizeStyle"></div>
    <slot name="widgetSlot"></slot>
  </b2-widget>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { EchartsBasic } from "./echarts";
import { nextTick, onMounted, ref, watch, computed } from "vue";
import { equals } from "@common/utils/object";
import { debounce } from "lodash";

const basicEcharts = useWidget<EchartsBasic>();

const echartsRef = ref<HTMLDivElement>(null);
const echartSizeStyle = computed(()=>{
  return `width:${basicEcharts.contentSize.width}px;height:${basicEcharts.contentSize.height}px`
})

const paddingStyle = computed(()=>{
  return {
    paddingTop: basicEcharts?.layoutStyle?.["paddingTop"],
    paddingBottom: basicEcharts?.layoutStyle?.["paddingBottom"],
    paddingLeft: basicEcharts?.layoutStyle?.["paddingLeft"],
    paddingRight: basicEcharts?.layoutStyle?.["paddingRight"]
  }
})

const hasInited = ref(false);
onMounted(() => {
  watch(
    () => ({
      el: echartsRef.value,
      size: basicEcharts.contentSize,
    }),
    ({ el, size }) => {
      if (hasInited.value) return;
      if (!el) return;
      if (!size?.width || !size?.height) return;

      basicEcharts.bindChartEl(el);
      basicEcharts.initChart();
      basicEcharts.resizeReady = true;

      hasInited.value = true;
    },
    { immediate: true, deep: true }
  );

  watch(() => [basicEcharts.contentSize, basicEcharts.isPlaying, basicEcharts.scaling], debounce(() => {
    if (!basicEcharts.resizeReady) return;
    // 设置resize状态，防止动画进行时被重绘
    basicEcharts.resizeReady = false;
    setTimeout(() => {
      nextTick(() => {
        if (basicEcharts.status.isVisible) {
          basicEcharts.echartsChart.resize({
            width: basicEcharts.contentSize.width,
            height: basicEcharts.contentSize.height
          });
        } else {
          basicEcharts.needPaintWhenVisible = true;
        }
        basicEcharts.resizeReady = true;
      })
    }, 300)
  }));

  watch(() => basicEcharts.status.isVisible, async (value,oldValue) => {
    if (value && value !== oldValue) {
      if(basicEcharts.isAnimating) return;
      let echartsCanvas = echartsRef?.value?.getElementsByTagName("canvas")?.[0];
      if (echartsCanvas && (Math.abs(echartsCanvas.width - basicEcharts.size.width*window.devicePixelRatio) >= 1 || Math.abs(echartsCanvas.height - basicEcharts.size.height*window.devicePixelRatio) >= 1)) {
        basicEcharts.echartsChart.resize({
          width: basicEcharts.contentSize.width,
          height: basicEcharts.contentSize.height
        });
      }
      if(basicEcharts.needPaintWhenVisible){
        basicEcharts.needPaintWhenVisible = false;
        basicEcharts.resetChartOption();
        await nextTick();
        if(basicEcharts.isAnimating) return; // 这里需要加，prestart在这之后才触发，先resetChartOption会导致闪烁
      }
    }
  })


  watch(() => {
    return {
      changed: basicEcharts.dataChangeTime,
      inited: basicEcharts.isConnectionInited
    }
  }, (value, oldValue) => {
    if (!equals(value, oldValue)) {
      if(!basicEcharts.status.isVisible){
        basicEcharts.needPaintWhenVisible = true;
      }else{
        basicEcharts.resetChartOption();
      }
    }
  })
  const stopWatchEchartsChart = watch(() => basicEcharts.echartsChart, (newVal) => {
    if(newVal){
      watch(() => {
        return {
          on: basicEcharts.getOption("animation-display"),
          type: basicEcharts.getOption("animation-display-type"),
          delay: basicEcharts.getOption("animation-display-delay"),
          duration: basicEcharts.getOption("animation-display-duration"),
          singleInterval: basicEcharts.getOption("animation-display-single-interval") || 1000,
          carouselStay: basicEcharts.getOption("animation-display-stay-column-carousel"),
          interval: basicEcharts.getOption("animation-display-interval"),
          linkage: basicEcharts.getOption("display-with-linkage"),
          seriesType: basicEcharts.getOption("series-shape-number-type"),
        }
      }, (val, oldVal) => {
        basicEcharts.restartAnimationDisplay();
        if(!val.on) {
          basicEcharts.stopAnimationDisplay();
        }
      }, {deep:true})
      nextTick(() => {
        stopWatchEchartsChart()
      })
    }
  }, {immediate: true, deep: true})
  watch(() => basicEcharts.getOption("echarts-renderer"), (newVal, oldVal) => {
    if (newVal !== oldVal) {
      basicEcharts.echartsChart.dispose()
      basicEcharts.initChart();
    }
  })
});
const handleEnter = () => {
  basicEcharts.setAnimationDisplayPaused(true);
};
const handleLeave = () => {
  basicEcharts.setAnimationDisplayPaused(false);
};
</script>

<style lang="scss" scoped>
.b2widget{
  :deep(.b2widget-body .rotate-layer .content-container .content) {
    padding: 0 !important;
  }
}

.echarts {
  width: 100%;
  height: 100%;
}
</style>
