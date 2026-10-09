<template>
  <template v-for="newItem in newItems" :key="newItem.name ?? 'tabs'">
    <b2-option-tab v-if="Array.isArray(newItem)" :element="element" :item="newItem" :paths="paths" />
    <b2-option-item v-else :element="element" :item="newItem" :paths="paths" />
  </template>
</template>

<script lang="ts" setup>
import { computed, Ref, unref, ref } from "vue";
import { DefinedOptionGroup, DefinedOptionSubgroup, isOptionSubgroup, isCallableVisible } from "./types";
import { Element } from "@renderer/b2/controllers/element";

const props = defineProps<{
  element: Element,
  items: DefinedOptionGroup["children"],
  paths: string[],
}>();

type ItemType = DefinedOptionSubgroup[] | GetElementType<DefinedOptionGroup["children"]>;
const newItems: Ref<ItemType[]> = computed(()=>{
  const _newItems: ItemType[] = [];
  let tabSubgroups: DefinedOptionSubgroup[];
  for (let i = 0; i < props.items.length; i++) {
    const item = props.items[i];
    if (isOptionSubgroup(item) && item.show === "tab") {
      if (!tabSubgroups) {
        tabSubgroups = [];
        _newItems.push(tabSubgroups);
      }
      tabSubgroups.push(item);
    } else {
      _newItems.push(item);
    }
  }
  return _newItems;
});
</script>

<style lang="scss" scoped>
</style>