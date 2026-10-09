<template>
  <b2-widget >
    <div class="image-wrap" ref="imageWrap">
      <img ref="imageItem" :src="currentSrc" @load="finishLoad" @error="handleError" @click="clickImage" :style="loaded ? image.imageStyle : {}" v-show="loaded">
      <div class="scale-text hidden-scale" style="position: absolute;">{{ imageScale }}</div>
      <!-- image-allow-zoom  -->
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { Color } from "@renderer/b2/color";
import { ref, onMounted, watch, reactive, onUnmounted, computed, onBeforeUnmount } from "vue";
import gsap from "gsap";
import md5 from "md5";
import axios from "axios";
import { Image } from "./image";
import { equals } from "@common/utils/object";
const imageWrap = ref<HTMLDivElement>(null);
const imageItem = ref<HTMLImageElement>(null);
const image = useWidget<Image>();
const loaded = ref(false);
const imageScale = ref("100%");
let animationDisplayTween = null;
const currentSrc = ref("");
let finishLoad = () => {
  loaded.value = true;
  let needReset = image.getOption("image-reset-size");
  if(needReset && image.imageSrc) {
    image.setOption("image-reset-size", false);
    image.size = { width: imageItem.value.naturalWidth, height: imageItem.value.naturalHeight };
  }
}
let useLocal = false;

watch(() => image.imageSrc, (newVal, oldVal) => {
  if(newVal !== oldVal) {
    currentSrc.value = image.imageSrc
    useLocal = false;
  }
}, { immediate: true })

let handleError = async () => {
  if (!useLocal && image.imageSrc) {
    useLocal = true;
    try {
      currentSrc.value = `local/image?url=${image.imageSrc}&ts=${Date.now()}&sign=${md5(Date.now() + image.imageSrc)}`
      loaded.value = true;
    } catch (error) {
      loaded.value = false;
    }
  } else {
    loaded.value = false;
  }
};
let clickImage = () => {
  if(image.getOption("show-selected")){
    image.toggleSelect();
  }
}
let timer = null;
const handleMouseWheel = (event)=>{
  if(!image.getOption("image-allow-zoom")) return;
  const scaleTextDom = imageWrap.value.querySelector(".scale-text");
  clearTimeout(timer);
  scaleTextDom && scaleTextDom.classList.remove("hidden-scale");
  const style = imageItem.value.style;
  const offset = event.deltaY * 0.0005;
  const scale = String(isNaN(Number(style.scale)) ? 1 : +style.scale - offset);
  style.scale = +scale <= 1 ? "1" : scale;
  imageScale.value = `${Math.round(+style.scale * 100)}%`;
  if(style.scale == "none" || +style.scale == 1){
    style.translate = "none";
  }
  timer = setTimeout(()=>{
    scaleTextDom && scaleTextDom.classList.add("hidden-scale");
  }, 100)
}
const handelMouseDown = (event)=>{
  if(!image.getOption("image-allow-zoom")) return
  const style = imageItem.value.style;
  const scale = isNaN(Number(style.scale)) ? 1 : +style.scale;
  let [startX, startY] = (style.translate ?? "none").replaceAll("px", "").split(" ").map(it=>Number(it));
  if(startY == undefined){
    [startX, startY] = [0,0];
  }
  const { screenX, screenY } = event;
  const mousemoveFn = (ev)=>{
    if(scale == 1){
      style.translate = "none";
    } else {
      let maxX = (image.contentSize.width * (scale - 1)) / 2;
      let maxY = (image.contentSize.height * (scale - 1)) / 2;

      let offsetX = startX + ev.screenX - screenX;
      let offsetY = startY + ev.screenY - screenY;
      if(Math.abs(offsetX) > maxX) {
        offsetX = Math.sign(offsetX) * maxX;
      }
      if(Math.abs(offsetY) > maxX) {
        offsetY = Math.sign(offsetY) * maxY;
      }
      style.translate = `${offsetX}px ${offsetY}px`;
    }
  }
  const mouseupFn = ()=>{
    // 修改位置
    document.removeEventListener("mousemove", mousemoveFn);
    document.removeEventListener("mouseup", mouseupFn);
  }
  document.addEventListener("mousemove", mousemoveFn);
  document.addEventListener("mouseup", mouseupFn)
}

const anaphase = computed(() => {
  const saturate = image.getOption<number>("saturate");
  const contrast = image.getOption<number>("contrast");
  const hue = image.getOption("hue") + "deg";
  const brightness = image.getOption<number>("brightness");
  return `saturate(${saturate}) contrast(${contrast}) hue-rotate(${hue}) brightness(${brightness})`;
})

onMounted(() => {
  image.bindImageItem(imageItem.value)

  watch(() => {
    return image.status.isVisible;
  }, (value, oldValue) => {
    if (value) {
      imageItem.value.src = imageItem.value.src;
    }
  })

  watch(() => {
    return {
      noEvents: image.noEvents.value,
      active: image.status.isActive,
      editable: image.getBoard().status.isEditable,
      playing: image.getBoard().isPlaying
    }
  }, (value) => {
    let evType = "none";
    if (!value.noEvents && !(image.locked && !image.preventLockEvent)) {
      if (value.editable) {
        if (value.active || value.playing) {
          evType = "all";
        }
      } else {
        evType = "all";
      }
    }
    imageItem.value.style.pointerEvents = evType;
  }, {immediate: true})

  watch(() => image.imageSrc, (val, oldVal) => {
    if (!image.getOption("image-original-size")) return
    if(!oldVal && val !== oldVal && !val.startsWith("http") && !val.startsWith("data:")) {
      image.setOption("image-reset-size", true);
    }
  })

  watch(() => {
    return {
      src: image.imageSrc,
      background: image.getOption("background"),
      alpha: new Color(image.getOption("background-color")).alpha(),
      backgroundImage: image.getOption("background-image")
    }
  }, (val, oldVal)=>{
    if(val.src) {
      image.status.error.style = [];
    } else if(val.background && (val.alpha > 0 || val.backgroundImage)) {
      image.status.error.style = [];
    } else {
      image.status.error.style = [{ key: undefined, type: "image-empty" }];
    }
  }, {immediate: true})

  watch(() => image.getOption<boolean>("no-events"), (val) => {
    image.noEvents.value = val;
  }, {immediate: true})

  watch(() => {
    return {
      on: image.getOption<boolean>("animation-display"),
      loop: image.getOption<boolean>("animation-loop"),
      delay: image.getOption<number>("animation-delay"),
      interval: image.getOption<number>("animation-interval"),
      duration: image.getOption<number>("animation-duration"),
      animationType: image.getOption<"clockwise"|"anti-clockwise"|"blink">("animation-type"),
      easing: image.getOption<string>("animation-easing"),
      visible: image.status.isVisible
    }
  }, (options) => {
    let fromObject = {
      rotation: 0,
      autoAlpha: 1
    };
    if (animationDisplayTween) {
      animationDisplayTween?.kill();
      animationDisplayTween = null;
      gsap.to(imageItem.value, {
        rotation: 0,
        autoAlpha: 1,
        duration: 0,
        delay: 0
      });
    }
    if (!options.on || !options.visible) return;
    let toObject = {
      delay: options.delay,
      duration: options.duration,
      repeat: options.loop ? -1 : 0,
      repeatDelay: options.interval,
      ease: options.easing
    };
    if(options.animationType == "blink"){
      toObject["yoyo"] = true;
      toObject["autoAlpha"] = 0;
    }else if(options.animationType == "clockwise"){
      toObject["rotation"] = 360;
    }else if(options.animationType == "anti-clockwise"){
      toObject["rotation"] = -360;
    }
    animationDisplayTween = gsap.fromTo(imageItem.value, fromObject, toObject);
  }, { immediate: true })

  watch(()=> image.getOption("image-original-size"),val => {
    if(val){
      image.size = { width: imageItem.value.naturalWidth, height: imageItem.value.naturalHeight };
    }
  })

  if(imageWrap.value) {
    imageWrap.value.addEventListener("wheel", handleMouseWheel);
    imageWrap.value.addEventListener("mousedown", handelMouseDown);
  }
});

onBeforeUnmount(()=>{
  if(imageWrap.value) {
    imageWrap.value.removeEventListener("wheel", handleMouseWheel);
    imageWrap.value.removeEventListener("mousedown", handelMouseDown);
  }
})

onUnmounted(() => {
  animationDisplayTween?.kill();
  animationDisplayTween = null;
})

</script>

<style lang="scss" scoped>
:deep(.b2widget-body) {
  overflow: visible !important;
}
.image-wrap, img {
  width: 100%;
  height: 100%;
}

img {
  filter: v-bind("anaphase");
}

.scale-text{
  opacity: 1;
  padding: 10px;
  width: 100px;
  text-align: center;
  background-color: #000;
  color: #fff;
  top: 50%;
  left: 50%;
  transform: translate(-50%,-50%);
  border-radius: 10px;
  transition: opacity 1s;
}
.hidden-scale{
  opacity: 0;
  display: none;
}

.hover-pointer {
    &:hover {
      cursor: var(--cursor-pointer);
    }
  }
</style>
