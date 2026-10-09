<template>
  <template v-if="isOption(item)">
    <x-option :element="element" :item="item" :paths="paths" v-if="visible" />
  </template>
  <template v-else-if="isOptionCluster(item)">
    <b2-option-cluster :element="element" :item="item" :paths="paths" v-if="visible"></b2-option-cluster>
  </template>
  <template v-else>
    <b2-option-subgroup :element="element" :item="item" :paths="paths" :title="item.alias" v-if="visible" />
  </template>
</template>

<script lang="ts" setup>
import { computed, unref } from "vue";
import { DefinedOptionGroup, isOption, isOptionCluster, isCallableVisible } from "./types";
import { Element } from "@renderer/b2/controllers/element";


const props = defineProps<{
  element: Element,
  item: GetElementType<DefinedOptionGroup["children"]>,
  paths: string[]
}>();

const visible = computed(() => {
  if (props.item.visible === undefined) return true;
  return isCallableVisible(props.item.visible) ? unref(props.item.visible(props.element, props.paths)) : props.item.visible;
});
</script>

<style lang="scss" scoped>
</style>
