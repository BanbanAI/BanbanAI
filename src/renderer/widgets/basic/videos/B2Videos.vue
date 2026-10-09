<template>
  <b2-widget>
    <div class="video-container">
      <video v-if="flag" :controls="widget.controls" :muted="widget.muted" :src="videoList[currentIndex]" type="video/mp4" ref="video1"></video>
      <video v-else-if="!flag" :controls="widget.controls" :muted="widget.muted" :src="videoList[currentIndex]" type="video/mp4" ref="video2"></video>
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { getVideoBlobURL } from "@renderer/utils/file";
import { useWidget, OptionFileValue, inCloudHost } from "@renderer/b2/types";
import { equals } from '@common/utils/object';
import { onMounted, ref, watch, nextTick, computed } from "vue";
import { Videos } from "./videos";
const video1 = ref(null);
const video2 = ref(null);
const widget = useWidget<Videos>();

const videoList = ref([]);
let currentIndex = ref<number>(0);
let flag = true; // 浏览器会显示webMediaPlayer数量，需要将标签销毁重建才能释放

onMounted(() => {
  let skipErrorTimer;
  const waitLoadTime = 1500;
  let videoEndedHandle = () => {
    let currentVideo = flag ? video1.value : video2.value;
    if(!currentVideo) {
      setTimeout(() => {
        videoEndedHandle();
      }, 2000)
      return;
    }
    currentVideo.autoplay = widget.getOption("autoplay");
    if(!widget.status.isVisible) currentVideo.pause();
    currentVideo.onended = async () => {
      if (videoList.value.length == 1) {
        currentVideo.play();
      } else {
        currentVideo.src = "";
        currentVideo.srcObject = null;
        currentIndex.value == (videoList.value.length - 1) ? currentIndex.value = 0 : currentIndex.value++;
        flag = !flag;
        await nextTick();
        videoEndedHandle();
      }
    }

    // 出错时跳到下一个视频
    skipErrorTimer = setTimeout(async () => {
      // console.log("Failed to load Video:", videoList[currentIndex.value])
      currentVideo.src = "";
      currentVideo.srcObject = null;
      currentIndex.value == (videoList.value.length - 1) ? currentIndex.value = 0 : currentIndex.value++;
      flag = !flag;
      await nextTick();
      videoEndedHandle();
    }, waitLoadTime)

    currentVideo.addEventListener('loadedmetadata', (e) => { // 如果能正常加载就能触发
      clearTimeout(skipErrorTimer);
    })


  }
  videoEndedHandle();

  watch(() => widget.getOption("no-events"), (val: boolean) => {
    widget.noEvents.value = val;
  }, {immediate: true})
}

)

const projectId = widget.getBoard().projectId;
watch(() => {
  const dimUid = widget.videosFields?.[0]?.uid;
  if (dimUid) {
    const columns = widget.getData().getflatColumns([dimUid])?.[0]?.flat?.() || [];
    const videoSuffix = ['.mp4', '.avi', '.mov', '.wmv', "rmvb", "mkv", "flv", "avchd", "webm"];
    const videos = columns.filter(file => videoSuffix.some(suffix => file.name.endsWith(suffix)));
    if (videos?.length) return videos;
  }

  return widget.getOption("video");
}, async (value: OptionFileValue[], oldValue) => {
  if (!equals(value, oldValue)) {
    const list = [];
    for (let index = 0; index < value.length; index++) {
      if (value[index].relativePath) {
        let videoSrc = `${projectId}/${value[index]?.relativePath}`;
        list.push(inCloudHost() ? (await getVideoBlobURL(videoSrc)) : videoSrc);
      } else if (value[index]?.url) {
        list.push(inCloudHost() ? (await getVideoBlobURL(value[index]?.url)) : value[index]?.url);
      } else {
        list.push();
      }
    }
    videoList.value = list;
    currentIndex.value = 0;
  }
}, { deep: true, immediate: true })

watch(() => {
  return widget.status.isVisible;
}, (value, oldValue) => {
  let currentVideo = currentIndex.value % 2 === 0 ? video1.value : video2.value;
  if(!currentVideo) return;
  if (value) {
    if(widget.getOption("autoplay")){
      currentVideo.play();
    }
  } else {
    currentVideo.pause();
  }
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
  }
}
</style>