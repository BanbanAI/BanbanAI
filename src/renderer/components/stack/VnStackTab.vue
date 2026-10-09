<template>
  <div class="vn-stack-tab" ref="stackTab" :class="{ active }" @click.left="tabClick" @click.middle="tabCloseClick">
    <label v-if="title" class="stack-tab-title">{{ title }}</label>
    <div v-if="closable" class="stack-tab-btn-close" @click="tabCloseClick">
      <svg class="icon-prevent" v-if="layerComponent?.preventClose" viewBox="0 0 1024 1024"><path d="M512 949.138286c238.72 0 437.138286-197.997714 437.138286-437.138286 0-238.72-198.857143-437.138286-437.577143-437.138286C272.438857 74.861714 74.88 273.28 74.88 512c0 239.140571 197.997714 437.138286 437.138286 437.138286z"></path></svg>
      <svg class="icon-close" viewBox="0 0 1024 1024"><path d="M819.2 848.2c-7.2 0-14-2.8-19-7.9L512 551.2l-288 286.5c-5.1 5-11.8 7.8-18.9 7.8-7.2 0-14-2.8-19.1-7.9-5.1-5.1-7.8-11.8-7.8-19 0-7.2 2.8-13.9 7.9-19l288-286.4L188.4 226.6c-10.5-10.5-10.4-27.6.1-38 5.1-5 11.8-7.8 19-7.8 7.2 0 13.9 2.8 19 7.9l285.7 286.6 288.2-286.6c5.1-5.1 11.8-7.8 18.9-7.8 7.2 0 14 2.8 19.1 8 10.4 10.5 10.4 27.5-.1 38L550.1 513.3l288.2 289.1c10.4 10.5 10.4 27.5-.1 38C833.1 845.4 826.4 848.2 819.2 848.2z"></path></svg>
    </div>
    <slot v-else></slot>
  </div>
</template>

<script lang="ts" setup>
import hashsum from "hash-sum";
import { eagerComputed } from "@vueuse/core";
import { computed, inject, onMounted, onUnmounted, Ref, ref, watch } from "vue";
import { stackContextKey } from "./stack";

const props = defineProps<{
  name?: string;
  title?: string;
  closable?: boolean;
  icon?: string;
  layerComponent?: { preventClose: Ref<boolean>; onClose: (name: string) => Promise<boolean> };
}>();
const emits = defineEmits(["active", "inactive"]);
const stackRoot = inject(stackContextKey);
const nameRef = ref(props.name || hashsum([props.title, stackRoot.tabs.length, new Date()]));
stackRoot.tabs.push(nameRef.value);
watch(() => props.name, value => { if (value) nameRef.value = value; });
watch(nameRef, (value, oldValue) => {
  const index = stackRoot.tabs.indexOf(oldValue);
  if (index >= 0) stackRoot.tabs[index] = value;
});
const title = computed(() => props.title);
const active = eagerComputed(() => stackRoot.currentName.value === nameRef.value);
const stackTab: Ref<HTMLElement> = ref(null);
onMounted(() => emits(active.value ? "active" : "inactive", stackTab.value));
watch(active, (value, oldValue) => {
  if (stackTab.value && value !== oldValue) emits(value ? "active" : "inactive", stackTab.value);
});
const tabClick = async () => {
  if (stackRoot.currentName.value !== nameRef.value && !(await stackRoot.beforeLeave(nameRef.value))) return;
  stackRoot.currentName.value = nameRef.value;
};
const tabCloseClick = async (event: Event) => {
  if (!props.closable) return;
  event.stopPropagation();
  if (props.layerComponent?.preventClose && await props.layerComponent.onClose?.(nameRef.value) === false) return;
  stackRoot.close(nameRef.value);
};
defineExpose({ title, active, tabClick, tabCloseClick });
if (stackRoot.autoOpen) stackRoot.currentName.value = nameRef.value;
onUnmounted(() => stackRoot.closed(nameRef.value));
</script>
