<template>
  <el-date-picker
    class="runtime-date-editor"
    :model-value="normalizedDraft"
    :type="pickerType"
    :format="format"
    :value-format="valueFormat"
    :placeholder="placeholder"
    :start-placeholder="startPlaceholder"
    :end-placeholder="endPlaceholder"
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
import { computed, ref, watch } from "vue";
import dayjs from "dayjs";
import i18next from "@renderer/widgets/i18next";

const props = withDefaults(defineProps<{
  modelValue: unknown;
  type?: string;
  format?: string;
  placeholder?: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
}>(), {
  type: "date",
  format: "YYYY-MM-DD",
  placeholder: i18next.t("subFormPlsSelectDate"),
  startPlaceholder: i18next.t("subFormDateStart"),
  endPlaceholder: i18next.t("subFormDateEnd"),
});

const emit = defineEmits<{
  (event: "commit", value: unknown): void;
  (event: "cancel"): void;
}>();

const draft = ref<unknown>(props.modelValue);
const isRange = computed(() => props.type === "daterange" || props.type === "datetimerange");
const pickerType = computed(() => props.type === "datetime-minute" ? "datetime" : props.type);
const valueFormat = computed(() => {
  if (isRange.value) return "x";
  if (pickerType.value === "year" || pickerType.value === "yearrange") return "YYYY";
  if (pickerType.value === "month" || pickerType.value === "monthrange") return "YYYY-MM";
  if (pickerType.value === "date") return "YYYY-MM-DD";
  return "YYYY-MM-DD HH:mm:ss";
});

const normalizeDate = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number" || value instanceof Date) {
    const parsed = dayjs(value);
    if (!parsed.isValid()) return value;
    return valueFormat.value === "x" ? parsed.valueOf() : parsed.format(valueFormat.value);
  }
  const text = String(value);
  if (valueFormat.value === "x" && /^-?\d{10,}$/.test(text)) return Number(text);
  return text;
};

const normalizeDraft = (value: unknown) => isRange.value
  ? (Array.isArray(value) ? value.slice(0, 2).map(normalizeDate) : ["", ""])
  : normalizeDate(value);

const normalizedDraft = computed(() => normalizeDraft(draft.value));

watch(() => props.modelValue, value => {
  draft.value = value;
});

function handleChange(value: unknown) {
  draft.value = value;
  emit("commit", value);
}

function handleClear() {
  const value = isRange.value ? ["", ""] : "";
  draft.value = value;
  emit("commit", value);
}
</script>

<style scoped>
.runtime-date-editor {
  width: 100%;
  min-width: 0;
  height: 28px;
}

.runtime-date-editor :deep(.el-input__wrapper) {
  box-sizing: border-box;
  min-height: 28px;
  height: 28px;
  padding: 1px 8px;
  border-radius: 4px;
  transition: box-shadow 0.15s ease;
}

.runtime-date-editor :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-border-color-hover, var(--border-color)) inset;
}

.runtime-date-editor :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary, var(--color-primary)) inset;
}
</style>
