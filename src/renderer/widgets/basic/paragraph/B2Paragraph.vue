<template>
  <b2-widget @mouseenter="pauseAnimation" @mouseleave="continueAnimation">
    <div ref="textareaWrap" class="textarea-wrap" v-if="!editing" @dblclick="handleDbClick" @mousewheel="handleWheel">
      <div v-html="widget.htmlValue" ref="textareaContent" class="p-textarea" :style="textareaStyle"></div>
    </div>
    <el-input ref="textareaInput" type="textarea" v-else v-model="textInput" :style="textareaStyle" @blur="exitEditing" @mousedown.stop @click.stop @keydown.stop />
  </b2-widget>
</template>

<script lang="ts" setup>
import { useWidget, OptionFontValue } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { ref, onMounted, watch, computed, nextTick, onUnmounted } from "vue";
import { Paragraph } from "./paragraph";

const textareaWrap = ref(null);
const textareaContent = ref(null);
const textareaInput = ref(null);
const editing = ref(false);
const textInput = ref("");
const widget = useWidget<Paragraph>();

const textareaStyle = computed<any>(()=>{
  const padding = widget.getOption("text-padding");
  const fontStyle = widget.getOption<OptionFontValue>("font");
  const shadowColor = widget.toCssColor(widget.getOption("font-shadow-color"));
  const shadowBlur = widget.getOption<number>("font-shadow-blur");
  const shadowX = widget.getOption("font-shadow-offset-x");
  const shadowY = widget.getOption("font-shadow-offset-y");
  return {
    color: widget.toCssColor(fontStyle.color as Color),
    fontSize: fontStyle.size + "px",
    fontFamily: fontStyle.family,
    fontStyle: fontStyle.italic ? "italic" : "normal",
    fontWeight: fontStyle.bold ? "bold" : "normal",
    letterSpacing: widget.getOption("font-spacing") + "px",
    lineHeight: widget.getOption("font-line-height") + "px",
    textIndent: widget.getOption("text-indent") + "em",
    textShadow: shadowBlur > 0 ? `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowColor}` : "none",
    padding: `${padding[2]}px ${padding[1]}px ${padding[3]}px ${padding[0]}px`,
    textAlign: widget.getOption<string>("text-position"),
  }
});

const exitEditing = () => {
  if (!editing.value) return;
  editing.value = false;
  widget.setOption("text", textInput.value);
}

const handleDbClick = () => {
  if (widget.isPlaying || !widget.isEditable) return;
  if (editing.value) return;
  editing.value = true;
  nextTick(() => {
    textareaInput.value.focus();
  });
}

let animationScrollFrameId = null;
let animationScrollPaused = false;
let animationScrollPausedStartTime = 0;
let animationScrollPausedTime = 0;
let currentPositionY = 0;
let needRefreshScrollTop = false;
const maxScrollTop = computed(()=>{
  if(!textareaContent.value || !textareaWrap.value) return 0;
  return Math.abs(textareaWrap.value.clientHeight - textareaContent.value.scrollHeight);
});

const handleWheel = (e) => {
  if (widget.isPlaying || !widget.isEditable) return;
  if (editing.value) return;
  currentPositionY = textareaWrap.value.scrollTop;
}

const pauseAnimation = () => {
  animationScrollPaused = true;
}

const continueAnimation = () => {
  animationScrollPaused = false; 
}

onMounted(() => {
  watch(()=> widget.status.isActive,(val)=>{
    if(!val){
      exitEditing();
    }
  });

  watch(()=>{
    return {
      enabled: widget.status.isVisible && !editing.value && widget.getOption<boolean>("animation-display"),
      delay: widget.getOption<number>("animation-delay"),
      duration: widget.getOption<number>("animation-duration"),
      loop: widget.getOption<boolean>("animation-loop"),
      interval: widget.getOption<number>("animation-interval"),
      lineHeight: widget.getOption<number>("font-line-height"),
    }
  }, async (options, oldOptions)=>{
    await nextTick();
    cancelAnimationFrame(animationScrollFrameId);
    if(!options.enabled || !textareaWrap.value){
      return;
    }
    if(options.enabled !== oldOptions?.enabled) {
      needRefreshScrollTop = true;
    }
    const oneFrameScrollTop = options.lineHeight / (options.duration * 1000 / 16.666666666666664);
    const animationFn = () => {
      if(animationScrollPaused){
        animationScrollFrameId = requestAnimationFrame(animationFn);
        return; 
      }
      if(animationScrollPausedStartTime && Date.now() - animationScrollPausedStartTime < animationScrollPausedTime) {
        animationScrollFrameId = requestAnimationFrame(animationFn);
        return; 
      }
      if(animationScrollPausedStartTime){
        animationScrollPausedStartTime = 0;
      }
      if(needRefreshScrollTop){
        currentPositionY = 0;
        needRefreshScrollTop = false; 
      }
      currentPositionY += oneFrameScrollTop;
      if(currentPositionY < maxScrollTop.value){
        textareaWrap.value.scrollTop = currentPositionY;
        animationScrollFrameId = requestAnimationFrame(animationFn);
        return;
      }

      if(options.loop){
        animationScrollPausedStartTime = Date.now();
        animationScrollPausedTime = options.interval * 1000;
        needRefreshScrollTop = true;
        animationScrollFrameId = requestAnimationFrame(animationFn);
      } else {
        animationScrollPausedStartTime = 0;
        cancelAnimationFrame(animationScrollFrameId);
      }
    }

    animationScrollFrameId = requestAnimationFrame(animationFn);
    animationScrollPausedStartTime = Date.now();
    animationScrollPausedTime = options.delay * 1000;
  }, { deep: true, immediate: true });
});

onUnmounted(() => {
  cancelAnimationFrame(animationScrollFrameId);
});
</script>

<style lang="scss" scoped>
.textarea-wrap {
  height: 100%;
  overflow-y: visible;
  overflow-y: auto;
  &::-webkit-scrollbar {
    display: none;
  }
  &::-webkit-scrollbar-track {
    display: none;
  }
  &::-webkit-scrollbar-thumb {
    display: none;
  }
}
:deep(.el-textarea){
  height: 100%; 
  .el-textarea__inner{
    height: 100%; 
    padding: 0;
    line-height: inherit;
    color: inherit;
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    resize: none;
    &::-webkit-scrollbar {
      display: none; 
    }
    &::-webkit-scrollbar-track {
      display: none; 
    }
    &::-webkit-scrollbar-thumb {
      display: none; 
    }
  }
}
</style>