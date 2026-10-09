<template>
  <div class="virtual-table-lab__popup-editor" @click.stop>
    <select
      class="virtual-table-lab__select"
      :value="modelValue"
      :disabled="disabled || readonly"
      @change="handleChange"
    >
      <option v-for="option in options" :key="option" :value="option">{{ option }}</option>
    </select>
    <div class="virtual-table-lab__popup-actions">
      <button type="button" class="virtual-table-lab__button ghost" @click="emit('cancel', { reason: 'cancel' })">{{ $t('virtualTableLabPopupSelectEditor.cancel') }}</button>
      <button type="button" class="virtual-table-lab__button primary" @click="emit('commit', { value: modelValue, reason: 'save' })">{{ $t('virtualTableLabPopupSelectEditor.confirm') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  modelValue?: string;
  readonly?: boolean;
  disabled?: boolean;
  context?: {
    options?: string[];
  };
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
  (event: "commit", payload?: { value?: string; reason?: string }): void;
  (event: "cancel", payload?: { reason?: string }): void;
}>();

const options = computed(() => {
  return Array.isArray(props.context?.options) ? props.context.options : [];
});

const handleChange = (event: Event) => {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
};
</script>
