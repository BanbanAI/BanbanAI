<template>
  <input
    class="virtual-table-lab__input"
    type="number"
    :value="modelValue"
    :readonly="readonly"
    :disabled="disabled"
    @click.stop
    @input="handleInput"
    @keydown.enter.prevent="emit('commit', { value: modelValue, reason: 'enter' })"
    @keydown.esc.prevent="emit('cancel', { reason: 'escape' })"
  />
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: number;
  readonly?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: number): void;
  (event: "commit", payload?: { value?: number; reason?: string }): void;
  (event: "cancel", payload?: { reason?: string }): void;
}>();

const handleInput = (event: Event) => {
  emit("update:modelValue", Number((event.target as HTMLInputElement).value));
};
</script>
