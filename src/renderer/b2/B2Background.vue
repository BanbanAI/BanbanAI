<template>
  <div v-if="background.enabled || background.border.enabled" class="background" :style="styleValue">
    <video v-if="isVideo(url) && background.enabled" :src="videoURL" autoplay loop muted></video>
    <div v-else-if="background.enabled" class="img" :style="imageStyle"></div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from '@vue/reactivity';
import { StyleValue, inject, watch } from 'vue';
import { Background } from './controllers/background';
import { getVideoBlobURL, isVideo } from '@renderer/utils'
import { isMobile } from "@renderer/utils";

const props = defineProps<{
  background: Background,
}>();

const videoURL = ref('');

const imageStyle = computed<StyleValue>(() => {
  if (props.background.fillType === 'none') {
    return {
      'background-image': url.value ? `url(${url.value}` : 'none',
      'background-repeat': 'no-repeat',
      'background-size': `${ props.background.imageScale }%`,
      'background-position': `${ props.background.imagePosition[0] }% ${ props.background.imagePosition[1] }%`,
    }
  }
  if (props.background.isUseNinePatch && props.background.ninePatch) {
    const { top, right, bottom, left } = props.background.ninePatch;

    return {
      'border-style': 'solid',
      'border-image-source': url.value ? `url(${url.value}` : 'none',
      'border-image-slice': `${top}% ${right}% ${bottom}% ${left}% fill`,
      'border-image-width': 'auto',
    };
  }
  return {
    'background-image': url.value ? `url(${url.value}` : 'none',
    'background-repeat': props.background.fillType === 'tile' ? 'repeat' : 'no-repeat',
    'background-size': props.background.fillType === 'tile' ? '' : '100% 100%',
  }
})

const url = computed(() => {
  const imageOption = props.background.image;
  if (imageOption?.url) {
    return imageOption.url;
  }
  if (imageOption?.relativePath) {
    return encodeURI(`${props.background.element.getBoard().projectId}/${imageOption.relativePath}`);
  }
  return "";
})

const styleValue = computed(() => {
  let style = {}
  if (isMobile()) {
    return style;
  }
  if (props.background.enabled) {
    if(props.background.color.isGradient()) {
      style["background-image"] = props.background.color.toCssString()
      style["background-color"] = ''
    } else {
      style["background-image"] = ''
      style["background-color"] = props.background.color.toCssString()
    }
    style["backdrop-filter"] = props.background.blur > 0 ? `blur(${props.background.blur}px)` : `none`;
  }
  if (props.background.border.enabled) {
    style["border"] = `${props.background.border.width}px ${props.background.border.style} ${props.background.border.color}`;
    style["border-radius"] = `${props.background.border.radius}px`;
  }
  return style;
})

watch(() => url.value, async (url) => {
  if (isVideo(url)) {
    if (inCloudHost()) {
      videoURL.value = await getVideoBlobURL(url);
    } else {
      videoURL.value = url;
    }
    return;
  }
  videoURL.value = '';
}, { immediate: true });
</script>

<style lang="scss" scoped>
.background {
  width: 100%;
  height: 100%;
  left: 0;
  top: 0;
  position: absolute;
  overflow: hidden;
  .img {
    width: 100%;
    height: 100%;
  }
  video {
    width: 100%;
    height: 100%;
    object-fit: fill;
  }
}
</style>