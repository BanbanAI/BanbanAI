<template>
  <b2-widget>
    <div class="split-line" :style="contentContainerStyle">
      <div class="container">
        <div class="title">{{ widget.titleText }}</div>
        <el-divider v-if="widget.isSplitLineType" :border-style="splitLineStyle.lineType"/>
        <div class="line" v-else></div>
      </div>
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { OptionFontValue, useWidget } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { onMounted, ref, computed, watch, nextTick } from "vue";
import { SplitLine } from "./splitLine";
import { equals } from "@common/utils/object";
import { useResizeObserver } from '@vueuse/core';

const widget = useWidget<SplitLine>();

const contentContainerStyle = computed(() => {
  return {
    display: "flex",
  };
});


const splitLineStyle = computed(()=>{
  const font = widget.getOption<OptionFontValue>("font");
  const lineWidth = widget.getOption<number>("line-width") + "px";
  const lineColor = widget.getOption<string>("line-color");
  const lineType = widget.lineType;
  const isSplitLineType = widget.isSplitLineType;
  const radius = widget.getOption<number>("line-radius") + "px";
  const dottedRadius = (widget.getOption<number>("dotted-radius") * 2) + "px";
  const letterSpacing = widget.getOption<number>("letter-spacing");
  // const dottedLineWidth = lineType === "dotted" ? 1 : widget.getOption<number>("dashed-dotted-line-width");
  // const dashedSpaceWidth = lineType === "dotted" || lineType === "dashed" ? widget.getOption<number>("dashed-dotted-space") : 0;
  return {
    hidden: widget.hiddenTitle ? "none" : "block",
    fontSize: font.size + "px",
    fontFamily: font.family,
    fontStyle: font.italic ? "italic" : "normal",
    fontWeight: font.bold ? "bold" : "normal",
    fontColor: new Color(font.color).toCssString(),
    marginBottom: widget.getOption("margin-bottom") + "px",
    isSplitLine: isSplitLineType,
    lineType: lineType,
    borderWidth: lineType === "dotted" ? dottedRadius : lineWidth,
    lineWidth,
    lineColor: new Color(lineColor).toCssString(),
    background: widget.imageSrc,
    radius: lineType === "dotted" ? 0 : radius,
    letterSpacing: letterSpacing + "px",
  };
});
</script>

<style lang="scss" scoped>
.split-line {
  width: 100%;
  height: 100%;
  .container {
    width: 100%;
    .title {
      display: v-bind("splitLineStyle.hidden");
      font-size: v-bind("splitLineStyle.fontSize");
      font-family: v-bind("splitLineStyle.fontFamily");
      font-weight: v-bind("splitLineStyle.fontWeight");
      font-style: v-bind("splitLineStyle.fontStyle");
      color: v-bind("splitLineStyle.fontColor");
      height: 20px;
      margin-bottom: v-bind("splitLineStyle.marginBottom");
      letter-spacing: v-bind("splitLineStyle.letterSpacing");
    }
    .line {
      width: 100%;
      height: v-bind("splitLineStyle.lineWidth");
      background: v-bind("splitLineStyle.background");
    }
    .el-divider {
      border-width: v-bind("splitLineStyle.borderWidth");
      border-color: v-bind("splitLineStyle.lineColor");
      border-radius: v-bind("splitLineStyle.radius");
    }
  }
}
</style>
