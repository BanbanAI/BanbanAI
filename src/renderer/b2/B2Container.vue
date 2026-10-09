<template>
  <div :class="['b2container', { 'fluid': container.isFluidLayout, mobile: isMobile() } ]" :style="container.layoutStyle" ref="containerRef">
    <template v-for="widget in container.widgets" :key="widget.uid">
      <div class="widget-shadow" v-if="widget.showEditorShadow" :style="widget.layoutStyle"></div>
      <x-widget
        v-if="shouldMountWidget(widget)"
        :widget="widget"
        :class="{ 'no-events': widget.noEvents.value, 'locked': widget.locked && !widget.preventLockEvent }"
        v-show="widget.status.isVisible && container.shouldShowWidget(widget)"
      >
      </x-widget>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { Container } from "@renderer/b2/controllers/container";
import { inject, provide, computed, ref, onMounted } from "vue";
import { VISIBLE } from "@renderer/types";
import { isMobile } from "@renderer/utils";
import { BaseWidget } from "./controllers/widget";

const props = defineProps<{
  container: Container,
}>();
const ownerVisible = computed(() => {
  return props.container.isVisible();
})

const shouldMountWidget = (widget: BaseWidget) => {
  return widget.status.isMounted || widget.shouldLoad;
};

const containerRef = ref<HTMLElement>();
onMounted(() => {
  props.container.dom = containerRef.value;
});
provide(VISIBLE, ownerVisible);
</script>

<style lang="scss" scoped>
.b2container {
  width: 100%;
  min-height: 100%;
  .b2widget {
    &.no-events {
      pointer-events: none !important;
    }
    &.locked {
      pointer-events: none !important;
  
      :deep(.b2widget) {
        pointer-events: none !important;
      }
    }
  }

  &.fluid {
    display: flex;
    height: 100%;
    gap: var(--fluid-gap);
  }

  &.mobile {
    padding: 0 !important;
    gap: 4px;
    display: flex;
    flex-wrap: wrap;
  }

  .widget-shadow {
    background-color: #e1e3e5;
    box-shadow: 0 0 2px 1px rgba(0, 0, 0, 0.2);
    transition: left 0.3s ease-in-out;
    transition: top 0.3s ease-in-out;
  }
}
</style>

<style lang="scss">
.view__lines {
  display: none;
  pointer-events: none;
}

.view__lines i.line {
  position: absolute;
}

.view__lines .t {
  top: 0px;
  left: 0;
  right: 0;
  height: 0;
  width: auto;
  border: 0;
  border-top: 1px solid red;
  z-index: 10;
}

.view__lines .r {
  right: 0;
  top: 0;
  bottom: 0;
  width: 0;
  height: auto;
  border: 0;
  border-right: 1px solid red;
  z-index: 10;
}

.view__lines .b {
  bottom: 0;
  left: 0;
  right: 0;
  height: 0;
  width: auto;
  border: 0;
  border-bottom: 1px solid red;
  z-index: 10;
}

.view__lines .l {
  left: 0;
  top: 0;
  bottom: 0;
  height: auto;
  width: 0;
  border: 0;
  border-left: 1px solid red;
  z-index: 10;
}

.view__resize-label {
  position: fixed;
  height: 24px;
  padding: 0 5px;
  display: inline-block;
  line-height: 24px;
  font-size: 12px;
  z-index: 999;
  background: #FB7055;
  border-radius: 3px;
  color: #fff;
  transform: translateX(-50%);
  pointer-events: none;
}

.view__v-line {
  position: fixed;
  width: 0;
  border-left: 1px solid red;
  z-index: 999;
  pointer-events: none;
}

.view__h-line {
  position: fixed;
  height: 0;
  border-top: 1px solid red;
  z-index: 999;
  pointer-events: none;
}

.view__h-dist-line {
  position: fixed;
  height: 0;
  border-top: 1px dashed #adadad;
  z-index: 999;
  text-align: center;
  pointer-events: none;
}

.view__h-dist-line .label {
  position: absolute;
  left: 50%;
  top: -4px;
  height: 14px;
  display: inline-block;
  line-height: 14px;
  text-align: center;
  background: #FB7055;
  transform: translate(-50%, -100%);
  color: #fff;
  padding: 0 5px;
  pointer-events: none;
  border-radius: 7px;
}

.view__v-dist-line {
  position: fixed;
  width: 0;
  border-left: 1px dashed #adadad;
  z-index: 999;
  text-align: center;
  pointer-events: none;
}

.view__v-dist-line .label {
  position: absolute;
  top: 50%;
  left: -4px;
  height: 14px;
  display: inline-block;
  line-height: 14px;
  text-align: center;
  background: #FB7055;
  transform: translate(-100%, -50%);
  color: #fff;
  padding: 0 5px;
  border-radius: 7px;
}

</style>
