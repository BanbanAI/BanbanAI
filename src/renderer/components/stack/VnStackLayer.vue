<template>
  <div class="vn-stack-layer" :class="{ active }" v-show="active">
    <component :is="component" v-if="shouldBeRender && component" v-bind="data" :active="active" />
    <slot v-if="shouldBeRender && !component" :active="active" />
  </div>
</template>

<script lang="ts" setup>
import { eagerComputed } from "@vueuse/core";
import { defineAsyncComponent, inject, ref, resolveComponent, shallowRef, watch, Ref } from "vue";
import { stackContextKey } from "./stack";

const props = defineProps({
  name: { type: String, default: "" },
  component: { type: String, default: "" },
  data: { type: Object, default: {} },
  title: { type: String, default: "" },
  lazy: { type: Boolean, default: false },
});
const stackRoot = inject(stackContextKey);
const nameRef: Ref<string> = ref(props.name || stackRoot.tabs[stackRoot.layers.length]);
stackRoot.layers.push(nameRef.value);
watch(() => props.name, value => { if (value) nameRef.value = value; });
watch(nameRef, (value, oldValue) => {
  const index = stackRoot.tabs.indexOf(oldValue);
  if (index >= 0) stackRoot.tabs[index] = value;
});
const active = ref(stackRoot.currentName.value === nameRef.value);
if (stackRoot.autoOpen) { stackRoot.currentName.value = nameRef.value; active.value = true; }
const component = shallowRef();
if (props.component) component.value = /^[\w-]+$/.test(props.component)
  ? resolveComponent(props.component)
  : defineAsyncComponent(() => import(/* @vite-ignore */ props.component));
const loaded = ref(active.value);
const shouldBeRender = eagerComputed(() => !props.lazy || loaded.value || active.value);
watch(stackRoot.currentName, value => { active.value = value === nameRef.value; if (active.value) loaded.value = true; });
</script>
