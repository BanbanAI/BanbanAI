<template>
  <div
    ref="editorRef"
    class="runtime-option-editor"
    :class="{ 'is-multiple': multiple, 'is-text': isTextDisplay }"
    @focusout="handleFocusout"
  >
    <el-select
      class="runtime-option-editor__select"
      :model-value="selectValue"
      :multiple="multiple"
      clearable
      :empty-values="['', null, undefined]"
      :value-on-clear="''"
      :loading="loading"
      :collapse-tags="multiple && isTextDisplay"
      :collapse-tags-tooltip="multiple && isTextDisplay"
      :no-data-text="noDataText"
      :placeholder="placeholderText"
      popper-class="runtime-option-editor__popper"
      teleported
      @change="handleChange"
      @visible-change="handleVisibleChange"
      @keydown.escape.stop.prevent="cancel"
    >
      <template #label="{ label, value }">
        <span>{{ displayLabel(label, value) }}</span>
      </template>
      <template v-if="multiple && isTextDisplay" #tag>
        <span class="runtime-option-editor__summary" :title="summaryText">{{ summaryText }}</span>
      </template>
      <el-option
        v-for="option in displayOptions"
        :key="option.value"
        :value="option.value"
        :label="optionLabel(option)"
      >
        <div
          v-if="isOtherOption(option)"
          class="runtime-option-editor__other"
          @click.stop="toggleOther"
          @mousedown.stop
        >
          <span class="runtime-option-editor__other-name">{{ option.label }}</span>
          <span v-if="hasOtherSelected" class="runtime-option-editor__other-field" @click.stop @mousedown.stop>
            <el-input
              ref="otherInputRef"
              v-model="customValue"
              class="runtime-option-editor__other-input"
              size="small"
              :placeholder="otherLabel"
              @input="handleOtherInput"
              @keydown.enter.stop.prevent="commit"
              @keydown.escape.stop.prevent="cancel"
            />
          </span>
        </div>
        <span v-else class="runtime-option-editor__option">{{ optionLabel(option) }}</span>
      </el-option>
      <template v-if="addOption" #footer>
        <div class="runtime-option-editor__add" @click.stop @keydown.stop>
          <el-button
            v-if="!addingOption"
            class="runtime-option-editor__add-trigger"
            link
            type="primary"
            @click="openAddOption"
          >
            <span class="runtime-option-editor__add-plus">+</span>{{ addOptionText }}
          </el-button>
          <div v-else class="runtime-option-editor__add-form">
            <el-input
              ref="addOptionInputRef"
              v-model="newOptionValue"
              :placeholder="addOptionPlaceholder"
              @keydown.enter.stop.prevent="confirmAddOption"
            />
            <div class="runtime-option-editor__add-actions">
              <el-button text bg @click="cancelAddOption">{{ cancelText }}</el-button>
              <el-button type="primary" @click="confirmAddOption">{{ confirmText }}</el-button>
            </div>
          </div>
        </div>
      </template>
    </el-select>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, watch } from "vue";
import i18next from "@renderer/widgets/i18next";

export type RuntimeOption = {
  value: string;
  label: string;
  depth?: number;
};

const props = withDefaults(defineProps<{
  modelValue: unknown;
  options: readonly RuntimeOption[];
  multiple?: boolean;
  allowCustom?: boolean;
  otherLabel?: string;
  placeholder?: string;
  loading?: boolean;
  error?: string;
  addOption?: (value: string) => { value: string; label: string } | null;
  display?: "tag" | "text";
}>(), {
  multiple: false,
  allowCustom: false,
  otherLabel: "",
  placeholder: "",
  loading: false,
  error: "",
  display: "tag",
});

const emit = defineEmits<{
  (event: "commit", value: unknown): void;
  (event: "cancel"): void;
  (event: "open"): void;
  (event: "close"): void;
}>();

const editorRef = ref<HTMLElement | null>(null);
const otherInputRef = ref<{ focus?: () => void } | { focus?: () => void }[] | null>(null);
const customValue = ref("");
const draft = ref<unknown>(normalize(props.modelValue, props.multiple));
const draftDirty = ref(false);

const options = computed(() => props.options || []);
const multiple = computed(() => props.multiple === true);
const allowCustom = computed(() => props.allowCustom === true);
const otherLabel = computed(() => String(props.otherLabel || "").trim());
const customEnabled = computed(() => allowCustom.value && Boolean(otherLabel.value));

const displayOptions = computed(() => {
  const list = options.value;
  if (!allowCustom.value || !otherLabel.value) return list;
  if (list.some(option => option.value === otherLabel.value)) return list;
  return [...list, { value: otherLabel.value, label: otherLabel.value }];
});
const optionValues = computed(() => new Set(displayOptions.value.map(option => option.value)));
const selectValue = computed(() => normalize(draft.value, multiple.value));
const isTextDisplay = computed(() => props.display === "text");
const hasOtherSelected = computed(() => {
  const value = normalize(draft.value, multiple.value);
  return multiple.value ? (value as string[]).includes(otherLabel.value) : value === otherLabel.value;
});
function displayLabel(label: unknown, value: unknown) {
  if (value !== otherLabel.value) return String(label ?? "");
  return customValue.value.trim() || otherLabel.value;
}
const summaryText = computed(() => {
  const labels = new Map(displayOptions.value.map(option => [option.value, option.label]));
  return (normalize(draft.value, true) as string[])
    .map(value => value === otherLabel.value
      ? (customValue.value.trim() || otherLabel.value)
      : (labels.get(value) ?? value))
    .join(",");
});

function optionLabel(option: RuntimeOption) {
  return option.depth ? `${"  ".repeat(option.depth)}${option.label}` : option.label;
}

function isOtherOption(option: RuntimeOption) {
  return allowCustom.value && Boolean(otherLabel.value) && option.value === otherLabel.value;
}

function syncDraft(value: unknown, isMultiple: boolean) {
  const normalized = normalize(value, isMultiple);
  if (isMultiple) {
    const values = normalized as string[];
    const standard: string[] = [];
    const others: string[] = [];
    for (const item of values) {
      if (item === otherLabel.value) continue;
      if (!customEnabled.value || optionValues.value.has(item)) standard.push(item);
      else others.push(item);
    }
    customValue.value = others.join(", ");
    draft.value = values.includes(otherLabel.value) || others.length
      ? [...standard, otherLabel.value]
      : standard;
  } else {
    const single = normalized as string;
    const isOther = customEnabled.value && single !== "" && (single === otherLabel.value || !optionValues.value.has(single));
    customValue.value = isOther && single !== otherLabel.value ? single : "";
    draft.value = isOther ? otherLabel.value : single;
  }
  draftDirty.value = false;
}

watch(() => [props.modelValue, props.multiple, props.options] as const, ([value, isMultiple]) => {
  if (!draftDirty.value) syncDraft(value, isMultiple === true);
}, { immediate: true });

function handleFocusout(event: FocusEvent) {
  const next = event.relatedTarget;
  if (next instanceof Node && (
    editorRef.value?.contains(next)
    || (next instanceof Element && next.closest(".el-select-dropdown, .el-popper"))
  )) return;
  commit();
}

function normalize(value: unknown, isMultiple: boolean): string | string[] {
  const normalizeItem = (item: unknown) => {
    if (item && typeof item === "object") {
      const option = item as Record<string, unknown>;
      const identity = option.value ?? option.id ?? option.uid;
      return identity === undefined || identity === null ? "" : String(identity);
    }
    return item === undefined || item === null ? "" : String(item);
  };
  if (isMultiple) {
    if (Array.isArray(value)) return value.map(normalizeItem).filter(Boolean);
    if (value === null || value === undefined || value === "") return [];
    return String(value).split(",").map(item => item.trim()).filter(Boolean);
  }
  if (value === null || value === undefined) return "";
  return normalizeItem(value);
}

function orderOtherLast(values: readonly string[]) {
  if (!otherLabel.value || !values.includes(otherLabel.value)) return [...values];
  return [...values.filter(item => item !== otherLabel.value), otherLabel.value];
}

function handleChange(value: unknown) {
  const normalized = normalize(value, multiple.value);
  draft.value = multiple.value ? orderOtherLast(normalized as string[]) : normalized;
  draftDirty.value = true;
  if (multiple.value) {
    if (!(draft.value as string[]).includes(otherLabel.value)) customValue.value = "";
  } else if (draft.value !== otherLabel.value) {
    customValue.value = "";
  }
  if (allowCustom.value && !isBlankValue(draft.value)) return;
  draftDirty.value = false;
  emit("commit", normalize(draft.value, multiple.value));
}

function isBlankValue(value: string | string[]) {
  return Array.isArray(value) ? value.length === 0 : value === "";
}

function toggleOther() {
  if (!otherLabel.value) return;
  draftDirty.value = true;
  const values = normalize(draft.value, true) as string[];
  if (multiple.value && values.includes(otherLabel.value)) {
    draft.value = values.filter(item => item !== otherLabel.value);
    customValue.value = "";
    return;
  }
  draft.value = multiple.value ? [...values, otherLabel.value] : otherLabel.value;
  focusOtherInput();
}

function focusOtherInput() {
  void nextTick(() => {
    const target = otherInputRef.value;
    const input = Array.isArray(target) ? target[0] : target;
    input?.focus?.();
  });
}

function handleOtherInput() {
  draftDirty.value = true;
}

function handleVisibleChange(visible: boolean) {
  if (!visible) {
    cancelAddOption();
    commit();
  }
  emit(visible ? "open" : "close");
}

function commit() {
  if (!draftDirty.value) return;
  draftDirty.value = false;
  emit("commit", resolveCommitValue());
}

function resolveCommitValue(): unknown {
  const value = normalize(draft.value, multiple.value);
  if (!allowCustom.value || !hasOtherSelected.value) return value;
  const text = customValue.value.trim() || otherLabel.value;
  if (multiple.value) return [...(value as string[]).filter(item => item !== otherLabel.value), text];
  return text;
}

function cancel() {
  if (!draftDirty.value) return;
  syncDraft(props.modelValue, multiple.value);
  emit("cancel");
}


const addingOption = ref(false);
const newOptionValue = ref("");
const addOptionInputRef = ref<{ focus?: () => void } | null>(null);
const addOptionText = computed(() => i18next.t("subFormAddOption"));
const addOptionPlaceholder = computed(() => i18next.t("subFormPlsInputOption"));
const cancelText = computed(() => i18next.t("subFormCancel"));
const confirmText = computed(() => i18next.t("subFormConfirm"));
const noDataText = computed(() => props.error || i18next.t("subFormNoOption"));
const placeholderText = computed(() => props.placeholder || i18next.t("subFormPlsSelect"));

function openAddOption() {
  addingOption.value = true;
  newOptionValue.value = "";
  void nextTick(() => addOptionInputRef.value?.focus?.());
}

function cancelAddOption() {
  addingOption.value = false;
  newOptionValue.value = "";
}

function confirmAddOption() {
  const value = newOptionValue.value.trim();
  if (!value) return;
  const added = props.addOption?.(value);
  if (!added) return;
  const next = new Set(normalize(draft.value, true) as string[]);
  next.add(added.value);
  draft.value = orderOtherLast([...next]);
  draftDirty.value = false;
  cancelAddOption();
  emit("commit", normalize(draft.value, true));
}
</script>

<style lang="scss" scoped>
.runtime-option-editor {
  --option-border: var(--el-border-color, var(--border-color));
  --option-focus: var(--el-color-primary, var(--color-primary));
  --option-fill: var(--el-fill-color-blank, var(--bg-color));
  --option-text: var(--el-text-color-regular, var(--text-color-primary));
  box-sizing: border-box;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  padding: 2px;

  &__select {
    flex: 1;
    min-width: 0;
  }

  &__select :deep(.el-select__wrapper) {
    min-height: 32px;
    padding: 0 8px;
    font-size: 13px;
  }

  &__select :deep(.el-select__selection),
  &__select :deep(.el-select__tags) {
    margin: 0;
    flex-wrap: nowrap;
    gap: 4px;
  }

  &.is-multiple :deep(.el-select__selection) {
    min-height: 24px;
    overflow: hidden;
  }

  &.is-multiple :deep(.el-select__tags) {
    overflow: hidden;
  }

  &__select :deep(.el-select__selected-item) {
    white-space: nowrap;
  }

  &__select :deep(.el-tag__close) {
    display: none;
  }

  &__summary {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.is-text :deep(.el-select__tags-text) {
    display: none;
  }

  &__other {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 6px;
  }

  &__other-name {
    flex: none;
  }

  &__other-field {
    display: flex;
    flex: none;
    width: 120px;
  }

  &__other-input {
    flex: 1;
    min-width: 0;
  }

  &__add {
    padding: 0;
  }

  &__add-trigger {
    padding-left: 4px;
  }

  &__add-plus {
    margin-right: 2px;
    font-size: 14px;
    line-height: 1;
  }

  &__add-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 4px 8px 8px;
  }

  &__add-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}
</style>

<style lang="scss">
.runtime-option-editor__popper.el-popper,
.runtime-option-editor__popper .el-select-dropdown,
.runtime-option-editor__popper .el-select-dropdown__footer {
  background: #fff;
}

.runtime-option-editor__popper .el-select-dropdown__list {
  padding: 2px;
}

.runtime-option-editor__popper .el-select-dropdown__item {
  height: 36px;
  line-height: 36px;
  margin-bottom: 8px;
  padding: 0 10px;
  border-radius: 4px;
}

.runtime-option-editor__popper .el-select-dropdown__item:last-child {
  margin-bottom: 0;
}

.runtime-option-editor__popper .el-select-dropdown__item.is-selected::after {
  display: none;
}

.runtime-option-editor__popper .el-select-dropdown__item:has(.runtime-option-editor__other) {
  display: flex;
  align-items: center;
  height: auto;
  min-height: 36px;
  padding: 4px 10px;
  line-height: 20px;
}

.runtime-option-editor__popper .el-select-dropdown__item:has(.runtime-option-editor__other) .runtime-option-editor__other-input {
  --el-input-height: 26px;
  font-size: 13px;
}

.runtime-option-editor__popper .el-select-dropdown__item:has(.runtime-option-editor__other) .el-input__wrapper {
  border-radius: 4px;
}
</style>
