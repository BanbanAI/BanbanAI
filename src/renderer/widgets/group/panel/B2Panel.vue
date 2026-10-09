<template>
  <b2-widget>
    <div class="content-container">
      <b2-container :container="panel.container"></b2-container>
    </div>
    <slot></slot>
  </b2-widget>
</template>

<script lang="ts" setup>
import { useWidget } from "@renderer/b2/types";
import { onMounted, watch } from "vue"
import { Panel } from "./panel";

const panel = useWidget<Panel>();

// FIXME 在编辑时，如果项目较大，子组件加载慢，有可能造成先出现error.style再消失的问题
// 可以考虑项目加载完再加监听或者监听soul里的widgets
watch(() => panel.widgets?.length, (val) => {
  if(!val) {
    panel.status.error.style = [{ key: undefined, type: "panel-empty" }];
  } else {
    panel.status.error.style = [];
  }
}, {immediate: true})

onMounted(() => {
  watch(() => {
    return {
      noEvent: panel.noEvents.value,
      childrenNoEvent: panel.getOption<boolean>("children-no-events")
    }
  }, (options) => {
    panel.widgets.forEach((widget) => {
      widget.noEvents.value = widget.noEvents.value || (options.childrenNoEvent && options.noEvent);
    })
  }, {immediate: true})
})
</script>

<style lang="scss" scoped>
.content-container {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden auto;
  &::-webkit-scrollbar {
    width: 4px;
  }
}
</style>
