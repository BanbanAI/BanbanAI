<template>
  <div class="vn-stack"><slot></slot></div>
</template>

<script lang="ts" setup>
import { computed, onMounted, provide, ref, watch } from "vue";
import { stackContextKey, StackContext } from "./stack";

const props = defineProps({
  activeName: { type: String, default: "" },
  modelValue: { type: String, default: "" },
  beforeLeave: { type: Function, default: () => true },
});
const emits = defineEmits(["close", "update:modelValue"]);
const currentValue = ref(props.modelValue || props.activeName);
const currentName = computed({
  get: () => currentValue.value,
  set: (value: string) => {
    if (currentValue.value === value) return;
    currentValue.value = value;
    emits("update:modelValue", value);
  },
});

const stackContext: StackContext = {
  tabs: [],
  layers: [],
  autoOpen: false,
  currentName,
  close: name => emits("close", name),
  closed(name) {
    const index = this.tabs.indexOf(name);
    if (index >= 0) this.tabs.splice(index, 1);
    const layerIndex = this.layers.indexOf(name);
    if (layerIndex >= 0) this.layers.splice(layerIndex, 1);
    if (!this.tabs.includes(currentName.value)) currentName.value = this.tabs[Math.max(0, index - 1)];
  },
  beforeLeave: async name => await props.beforeLeave(name),
};

provide(stackContextKey, stackContext);
watch(() => props.activeName, value => currentName.value = value);
watch(() => props.modelValue, value => currentName.value = value);
onMounted(() => {
  stackContext.autoOpen = props.activeName !== null;
  if (stackContext.tabs.length && currentName.value === "") currentName.value = stackContext.tabs[0];
});
</script>

<style>
.vn-stack-tab {
  position: relative;
  display: flex;
  align-items: center;
}
.vn-stack-tab .stack-tab-title {
  padding: 0 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.vn-stack-tab .stack-tab-btn-close {
  user-select: none;
  width: 16px;
  height: 16px;
  text-align: center;
  cursor: var(--cursor-pointer);
  display: flex;
  align-items: center;
  margin-right: 4px;
  border-radius: 5px;
  padding: 2px;
}
.vn-stack-tab .stack-tab-btn-close:hover { background-color: #555555; }
.vn-stack-layer.active { flex: 1; position: relative; }
.icon-close { width: 16px; height: 16px; pointer-events: none; }
.icon-close > path { fill: white; }
.icon-prevent { width: 10px; height: 10px; margin: 1px; }
.icon-prevent > path { fill: rgb(255, 205, 111); }
.icon-prevent + .icon-close { display: none; }
.stack-tab-btn-close:hover .icon-close { display: block; }
.stack-tab-btn-close:hover .icon-prevent { display: none; }
</style>
