<template>
  <b2-widget>
    <div class="video-container">
      <img :src="widget.snapshotImg" v-if="widget.showSnapshot">
      <video :controls="widget.controls" :class="SNAPSHOT_IGNORE_CLASS" :muted="widget.muted" :style="widget.mixBlend ? 'mix-blend-mode: screen' : ''" type="video/mp4" ref="video">
      </video>
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { getVideoBlobURL } from "@renderer/utils/file";
import { SNAPSHOT_IGNORE_CLASS, useWidget, inCloudHost } from "@renderer/b2/types";
import { onMounted, watch, ref, computed } from "vue";
import { equals } from '@common/utils/object';
import { Video } from "./video";
const widget = useWidget<Video>();
const video = ref(null);
let firstPlay = true;

onMounted(() => {
  const canplay = ref(false);
  const needPlayWhenLoaded = ref(false);
  const doPlayVideo = () => {
    if(!canplay.value) {
      needPlayWhenLoaded.value = true;
    } else {
      video.value.play();
    }
  }
  const doPauseVideo = () => {
    if(!canplay.value) {
      needPlayWhenLoaded.value = false;
    } else {
      video.value.pause();
    }
  }

  watch([needPlayWhenLoaded, canplay], ([needPlay, canPlay]) => {
    if (needPlay && canPlay) {
      video.value.play();
    }
  });

  video.value.onended = () => {
    let loop = !!widget.getOption("loop");
    if (loop) {
      let currentTime = widget.getOption("loop-start-time") || 0;
      video.value.currentTime = currentTime;
      doPlayVideo();
    }
  }
  widget.videoDom = video.value;

  watch(() => widget.getOption("speed"), (val)=>{
    video.value.playbackRate = val;
  }, {immediate: true})

  watch(() => widget.getOption("autoplay"), (val)=>{
    video.value.autoplay = val;
    video.value.currentTime = widget.getOption("loop-start-time") || 0;
    if (widget.status.isVisible && val && widget.getOption<number>("opacity") > 0) {
      doPlayVideo();
    } else {
      doPauseVideo();
    }
  }, {immediate: true})

  let lastState;
  watch(() => {
    return {
      visible: widget.status.isVisible && widget.getOption<number>("opacity") > 0,
      src: widget.videoSrc,
    };
  }, async (value, oldValue) => {
    if(equals(value, oldValue)) return;
    if(value.visible) {
      if(widget.getOption("pause-to-continue") === "rewind") {
        video.value.currentTime = 0;
      }
      if(lastState === "play") doPlayVideo();
    } else {
      if(firstPlay) {
        lastState = widget.getOption("autoplay") ? "play" : "pause";
      } else {
        lastState = video.value.paused ? "pause" : "play";
      }
      doPauseVideo();
    }
    if(!value.visible && firstPlay || !firstPlay && value.src === oldValue.src) return;

    if (inCloudHost()) {
      value.src = await getVideoBlobURL(value.src);
    }
    video.value.setAttribute("src", value.src);
    canplay.value = false;

    video.value.addEventListener('canplay', () => {
      canplay.value = true;
    }, { once: true });

    if(firstPlay){
      if(widget.getOption("autoplay") && value){
        doPlayVideo();
      }else{
        doPauseVideo();
      }
      firstPlay = false;
    } else {
      if (widget.getOption("autoplay") && value) {
        widget.getOption("pause-to-continue") === "rewind" ? video.value.currentTime = 0 : '';
        doPlayVideo();
      } else {
        doPauseVideo();
      }
    }
  }, {immediate: true})

  watch(() => widget.getOption("no-events"), (val: boolean) => {
    widget.noEvents.value = val;
  }, {immediate: true})

  watch(()=>widget.getOption("pause-to-continue"),(val,oldVal)=>{
      if(val === "rewind"){
        video.value.currentTime = 0;
      }
      if (widget.status.isVisible || widget.getOption<number>("opacity") > 0) {
        doPlayVideo();
      }
  })
})
//todo 自动播放和从第几秒开始，倍速播放需要watch


const anaphase = computed(() => {
  const saturate = widget.getOption<number>("saturate");
  const contrast = widget.getOption<number>("contrast");
  const hue = widget.getOption("hue") + "deg";
  const brightness = widget.getOption<number>("brightness");
  return `saturate(${saturate}) contrast(${contrast}) hue-rotate(${hue}) brightness(${brightness})`;
})
</script>

<style lang="scss" scoped>
.video-container {
  width: 100%;
  height: 100%;

  video {
    width: 100%;
    height: 100%;
    object-fit: fill;
    filter: v-bind("anaphase");
  }
  img{
    width: 100%;
    height: 100%;
    object-fit: fill;
    filter: v-bind("anaphase");
  }
}
</style>
