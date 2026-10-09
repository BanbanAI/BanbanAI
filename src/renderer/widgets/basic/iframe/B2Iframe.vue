<template>
  <b2-widget>
    <div class="iframe-box">
      <iframe class="iframe-value" :src="iframeLink" frameborder="0" ref="iframeDom" allowfullscreen="true"></iframe>
      <div class="iframe-mask" v-if="showMask" @mouseup="handleMouseUp" @dblclick="handleDblClick"></div>
    </div>
  </b2-widget>
</template>

<script lang="ts" setup>
import { useWidget, useActiveWidget } from "@renderer/b2/types"
import { onMounted, ref, watch, computed } from "vue";
import { Iframe } from "./iframe";

const iframe = useWidget<Iframe>();

const iframeDom = ref<HTMLIFrameElement>(null);
const iframeLink = ref("");

const showMask = ref(true);
const activeWidget = useActiveWidget();
const handleMouseUp = (ev)=>{
  if(activeWidget.value?.uid !== iframe.uid) return;
  if(ev.button === 0 && ev.ctrlKey){
    showMask.value = false;
  }
}
const handleDblClick = ()=>{
  if(activeWidget.value?.uid !== iframe.uid) return;
  showMask.value = false;
}
watch(()=>{
  return {
    widget: activeWidget.value,
    isPlaying: iframe.getBoard().status.isPlaying
  }
}, ({widget, isPlaying})=>{

  if(isPlaying) {
    showMask.value = false;
    return;
  }

  if(widget?.uid !== iframe.uid){
    showMask.value = true;
  }
}, { immediate: true });

onMounted(() => {
  watch(() => iframe.iframeLink(), (val, oldVal) => {
    if (val !== oldVal && val) {
      if (val.indexOf("?") > -1) {
        iframeLink.value = val + "&_" + Date.now();
      } else if(val.indexOf("#") > -1) {
        let arr = val.split("#");
        iframeLink.value = arr.join("?_" + Date.now() + "#");
      } else {
        iframeLink.value = val + "?_" + Date.now();
      }
    } else {
      iframeLink.value = "http://";
    }
  }, { immediate: true })

  watch(()=>iframe.status.isVisible,(val,oldVal)=>{
    if(iframe.showLoad){
      iframeLink.value = val ? iframe.iframeLink() : "";
    }
  })


  watch(() => iframe.sandbox, (val) => {
    if (val) {
      iframeDom.value?.setAttribute("sandbox", iframe.sandbox)
    } else {
      iframeDom.value?.removeAttribute("sandbox")
    }
  }, { immediate: true });
  watch(() => iframe.allow, (val) => {
    if (val) {
      iframeDom.value?.setAttribute("allow", iframe.allow)
    } else {
      iframeDom.value?.removeAttribute("allow")
    }
  }, { immediate: true, deep: true })
})

</script>

<style lang="scss" scoped>
.iframe-box {
  position: relative;
  width: 100%;
  height: 100%;

  .iframe-value {
    width: 100%;
    height: 100%;
    color-scheme: normal;
  }

  .iframe-mask{
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: transparent;
  }
}
</style>
