<template>
  <el-time-picker
    class="runtime-time-editor"
    :model-value="draft"
    :format="format"
    :value-format="format"
    :placeholder="placeholder"
    :clearable="true"
    :empty-values="['', null, undefined]"
    :value-on-clear="''"
    :teleported="true"
    @update:model-value="handleChange"
    @clear="handleClear"
    @click.stop
  />
</template>

<script lang="ts" setup>
import { ref, watch } from "vue";
import i18next from "@renderer/widgets/i18next";

const props = withDefaults(defineProps<{
  modelValue: unknown;
  format?: string;
  placeholder?: string;
}>(), {
  format: "HH:mm",
  placeholder: i18next.t("subFormPlsSelectTime"),
});

const emit = defineEmits<{
  (event: "commit", value: unknown): void;
  (event: "cancel"): void;
}>();

const draft = ref<unknown>(props.modelValue);
watch(() => props.modelValue, value => { draft.value = value; });

function handleChange(value: unknown) {
  draft.value = value;
  emit("commit", value);
}

function handleClear() {
  draft.value = "";
  emit("commit", "");
}
</script>

<style scoped>
.runtime-time-editor {
  width: 100%;
  min-width: 0;
  height: 28px;
}

.runtime-time-editor :deep(.el-input__wrapper) {
  box-sizing: border-box;
  min-height: 28px;
  height: 28px;
  padding: 1px 8px;
  border-radius: 4px;
  transition: box-shadow 0.15s ease;
}

.runtime-time-editor :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-border-color-hover, var(--border-color)) inset;
}

.runtime-time-editor :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary, var(--color-primary)) inset;
}
</style>
