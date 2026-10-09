<template>
  <component :is="component"></component>
</template>

<script lang="ts" setup>
import { VISIBLE } from '@renderer/types';
import { computed, inject, onErrorCaptured, provide, shallowRef, toRaw, watch, nextTick } from 'vue';
import { Widget } from '@renderer/b2/controllers/widget';
import { measureLog } from './utils/measure';

const props = defineProps<{
  widget: Widget
}>();

const component = shallowRef(null);

const parentVisible = inject(VISIBLE);

watch(() => {
  return parentVisible.value && props.widget.enabled && (props.widget.effectedOpacity.value > 0 || props.widget.opacity > 0);
}, (value) => {
  if (props.widget.status.isVisible !== value) {
    props.widget.status.isVisible = value;
  }
}, { immediate: true });

if (props.widget.status.isVisible) {
  if (props.widget.getBoard().status.mockOwner) {
    console.debug("start loading", props.widget.getBoard().name, props.widget.name);
  } else {
    measureLog("loading", "start loading", props.widget.getBoard().name, props.widget.name);
  }
  component.value = toRaw(props.widget.component);
} else {
  //如果组件不可见，则延迟加载
  let count = 0;
  const callback: IdleRequestCallback = (deadline) => {
    if (props.widget.status.isVisible || !deadline.didTimeout || count > 100) {
      if (props.widget.getBoard().status.mockOwner) {
        console.debug("idle loading", count, props.widget.getBoard().name, props.widget.name);
      } else {
        measureLog("loading", "idle loading", count, props.widget.getBoard().name, props.widget.name);
      }
      component.value = toRaw(props.widget.component);
    } else {
      count++;
      window.requestIdleCallback(callback, {timeout: 100});
    }
  };
  window.requestIdleCallback(callback, {timeout: 100});
}

provide('widget', props.widget);

onErrorCaptured((err, instance, info)=>{
  const logger = import.meta.env.DEV ? console.error : console.warn;
  let widget = (instance.$ as any).provides?.widget;
  logger(`catch widget(${widget?.type || "unknow"}) error in ${info}\n`, err, widget ?? instance.$);
  return false;
});
</script>