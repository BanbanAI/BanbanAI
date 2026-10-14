<template>
  <div class="editor-host" v-if="activeAddress" ref="editorHostRef">
    <component
      v-if="effectiveEditor"
      :is="effectiveEditor.component"
      v-bind="effectiveEditor.props"
      @commit="handleCommit"
      @cancel="handleCancel"
    />
    <div class="editor-host__fallback" v-else>
      <input
        v-if="column?.type === 'widget.form.switch'"
        ref="fallbackInputRef"
        class="editor-host__fallback-checkbox"
        type="checkbox"
        :checked="booleanDraftValue"
        @change="handleBooleanCommit"
        @keydown.escape="handleCancel"
      />
      <textarea
        v-else-if="column?.type === 'widget.form.textarea'"
        ref="fallbackInputRef"
        class="editor-host__fallback-input"
        :value="draftValue"
        @blur="handleCommit"
        @keydown.escape="handleCancel"
      />
      <input
        v-else
        ref="fallbackInputRef"
        class="editor-host__fallback-input"
        :type="fallbackInputType"
        :value="draftValue"
        @blur="handleCommit"
        @keydown.enter="handleCommit"
        @keydown.escape="handleCancel"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, nextTick, onBeforeUnmount, type Component } from "vue";
import type { CellAddress } from "../runtime/types";
import type { ColumnDefinition } from "../runtime/column-definition";
import type { RowStore } from "../runtime/row-store";
import { resolveRuntimeEditor } from "./runtime-editor-registry";

const props = defineProps<{
  address: CellAddress | null;
  column: ColumnDefinition | null;
  store: RowStore;
  version?: number;
  editorComponent?: Component;
  editorProps?: Record<string, unknown>;
}>();

const emit = defineEmits<{
  (e: "commit", payload: { address: CellAddress; value: unknown }): void;
  (e: "cancel", address: CellAddress): void;
  (e: "close"): void;
}>();

const editorHostRef = ref<HTMLElement | null>(null);
const fallbackInputRef = ref<HTMLInputElement | HTMLTextAreaElement | null>(null);
const commitSent = ref(false);

const activeAddress = computed(() => props.address);
const activeColumn = computed(() => props.column);
const renderVersion = computed(() => props.version);
const activeValue = computed(() => ({
  version: renderVersion.value,
  value: activeAddress.value ? props.store.getValue(activeAddress.value) : undefined,
}));

const draftValue = computed(() => {
  const value = activeValue.value.value;
  return value === undefined || value === null ? "" : String(value);
});

const booleanDraftValue = computed(() => {
  const value = activeValue.value.value;
  return value === true || value === "true";
});

const fallbackInputType = computed(() => {
  if (activeColumn.value?.type === "widget.form.numberInput") return "number";
  if (activeColumn.value?.type === "widget.form.datePicker") return "date";
  return "text";
});

const runtimeEditor = computed(() => resolveRuntimeEditor(activeColumn.value, activeAddress.value, props.store));
const effectiveEditor = computed(() => {
  if (props.editorComponent) {
    return {
      component: props.editorComponent,
      props: {
        ...(props.editorProps || {}),
        modelValue: activeValue.value.value,
      },
    };
  }
  return runtimeEditor.value;
});

watch(() => props.address, (newAddress) => {
  commitSent.value = false;
  if (newAddress) {
    nextTick(() => {
      fallbackInputRef.value?.focus();
    });
  }
}, { immediate: true });

function handleCommit(value?: unknown) {
  if (!activeAddress.value) return;
  if (commitSent.value) return;
  commitSent.value = true;
  const isDomEvent = typeof Event !== "undefined" && value instanceof Event;
  const commitValue = value !== undefined && !isDomEvent
    ? value
    : fallbackInputRef.value?.value ?? draftValue.value;
  emit("commit", { address: activeAddress.value, value: commitValue });
}

function handleCancel() {
  if (!activeAddress.value) return;
  if (commitSent.value) return;
  emit("cancel", activeAddress.value);
}

function handleBooleanCommit(event: Event) {
  handleCommit((event.target as HTMLInputElement).checked);
}

onBeforeUnmount(() => {
  if (activeAddress.value) {
    emit("cancel", activeAddress.value);
  }
});
</script>

<style lang="scss" scoped>
.editor-host {
  --editor-border: var(--el-border-color, var(--border-color));
  --editor-focus: var(--el-color-primary, var(--color-primary));
  --editor-fill: var(--el-fill-color-blank, var(--bg-color));
  --editor-text: var(--el-text-color-regular, var(--text-color-primary));
  box-sizing: border-box;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  z-index: 10;
  background: var(--bg-color);

  &__fallback {
    width: 100%;
    height: 100%;
  }

  &__fallback-input {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    border: 1px solid var(--editor-border);
    border-radius: 4px;
    outline: none;
    padding: 0 8px;
    font-size: inherit;
    font-family: inherit;
    background: var(--editor-fill);
    color: var(--editor-text);
    resize: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  &__fallback-input:hover {
    border-color: var(--el-border-color-hover, var(--editor-border));
  }

  &__fallback-input:focus {
    border-color: var(--editor-focus);
    box-shadow: 0 0 0 1px var(--editor-focus) inset;
  }

  &__fallback-checkbox {
    width: 18px;
    height: 18px;
    accent-color: var(--editor-focus);
  }
}
</style>
