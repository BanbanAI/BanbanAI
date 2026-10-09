<template>
  <el-dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)" align-center v-bind="attr">
    <component :is="component" v-bind="componentProps" />
  </el-dialog>
</template>

<script lang='ts' setup>
import { Component as ComponentType, useAttrs } from 'vue';


const props = withDefaults(defineProps<{
  modelValue: boolean,
  component: ComponentType,
  componentProps?: Record<string, any>
}>(), {
  componentProps: () => ({})
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>();


const attr = useAttrs();

</script>

<style lang='scss' scoped></style>