<template>
  <textarea
    class="virtual-table-lab__textarea"
    :value="modelValue"
    :rows="rows"
    :readonly="readonly"
    :disabled="disabled"
    @click.stop
    @input="handleInput"
    @keydown.ctrl.enter.prevent="emit('commit', { value: modelValue, reason: 'ctrl-enter' })"
    @keydown.esc.prevent="emit('cancel', { reason: 'escape' })"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  modelValue?: string;
  readonly?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "commit", payload?: { value?: string; reason?: string }): void;
  (event: "cancel", payload?: { reason?: string }): void;
}>();

const rows = computed(() => {
  const length = String(props.modelValue || "").length;
  if (length >= 24) {
    return 3;
  }
  if (length >= 12) {
    return 2;
  }
  return 1;
});

const handleInput = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
};
</script>
