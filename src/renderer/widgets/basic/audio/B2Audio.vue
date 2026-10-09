<template>
  <b2-widget>
    <div class="audio-container">
      <audio ref="audio" :controls="widget.controls"></audio>
    </div>
    <div class="wid-mask" v-if="showMask" @mouseup="handleMouseUp" @dblclick="handleDblClick"></div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { getVideoBlobURL } from "@renderer/utils/file";
import { useWidget, inCloudHost, useActiveWidget } from "@renderer/b2/types";
import { equals } from '@common/utils/object';
import { onMounted, watch, ref, computed } from "vue";
import { Audio } from "./audio";
const widget = useWidget<Audio>();
const audio = ref<HTMLAudioElement>(null);

const showMask = ref(true);
const activeWidget = useActiveWidget();

const handleMouseUp = (ev)=>{
  if(activeWidget.value?.uid !== widget.uid) return;
  if(ev.button === 0 && ev.ctrlKey){
    showMask.value = false;
  }
}
const handleDblClick = ()=>{
  if(activeWidget.value?.uid !== widget.uid) return;
  showMask.value = false;
}
watch(()=>{
  return {
    aWidget: activeWidget.value,
    isPlaying: widget.getBoard().status.isPlaying
  }
}, ({aWidget, isPlaying})=>{

  if(isPlaying) {
    showMask.value = false;
    return;
  }

  if(aWidget?.uid !== widget.uid){
    showMask.value = true;
  }
}, { immediate: true });

onMounted(() => {
  audio.value.onplay = () =>{
    if(widget.getOption<string>("pause-to-continue") === "rewind"){
      audio.value.currentTime = widget.startTime;
    }
  }
  audio.value.onended = () => {
    if (widget.getOption<boolean>("loop")) {
      audio.value.currentTime = widget.startTime;
      audio.value.play();
    }
  }
  watch(()=>{
    return {
      enable: widget.status.isVisible && widget.getOption<number>("opacity") > 0,
      audioSrc: widget.audioSrc,
      autoplay: widget.getOption<boolean>("autoplay")
    }
  }, async (option, oldOption)=>{
    if(equals(option, oldOption)) return;
    if (option.enable && option.audioSrc) {
      if (inCloudHost()) {
        audio.value.setAttribute("src", await getVideoBlobURL(option.audioSrc));
      } else{
        audio.value.setAttribute("src", option.audioSrc);
      }
      if(option.autoplay){
        audio.value.currentTime = widget.startTime;
        audio.value.play();
      }
    } else {
      audio.value.pause();
    }
  },{ immediate: true})

  watch(() => widget.getOption<number>("speed"), (val)=>{
    audio.value.playbackRate = val;
  }, {immediate: true})

  watch(() => widget.getOption<number>("volume"), (val)=>{
    audio.value.volume = val / 100;
  }, {immediate: true})

  watch(() => widget.getOption("no-events"), (val: boolean) => {
    widget.noEvents.value = val;
  }, {immediate: true})

});
</script>

<style lang="scss" scoped>
.audio-container {
  display: flex;
  align-items: center;
  width: 100%;
  height: 100%;

  audio {
    width: 100%;
  }
}
.wid-mask{
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
}
</style>
