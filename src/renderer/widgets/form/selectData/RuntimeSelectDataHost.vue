<template>
  <select-data-dialog
    v-if="widget"
    :model-value="modelValue"
    :runtime="runtime"
    @update:model-value="emit('update:modelValue', $event)"
    @select="(rows) => emit('select', rows)"
    @fill-start="emit('fill-start')"
    @fill-error="emit('fill-error')"
  />
</template>

<script lang="ts" setup>
import { provide } from "vue";
import type { SelectData } from "./selectData";
import SelectDataDialog, { type RuntimeSelectDataContext } from "./SelectDataDialog.vue";

const props = defineProps<{
  widget: SelectData | null;
  modelValue: boolean;
  runtime: RuntimeSelectDataContext | null;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
  (event: "select", value: Record<string, any[]>): void;
  (event: "fill-start"): void;
  (event: "fill-error"): void;
}>();

provide("widget", props.widget);
</script>
