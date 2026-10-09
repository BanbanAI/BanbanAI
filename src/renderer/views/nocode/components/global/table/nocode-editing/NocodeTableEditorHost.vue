<template>
  <div
    ref="rootRef"
    class="nocode-table-editor-host"
    :style="hostStyle"
    @keydown.enter.stop.prevent="handleEnter"
    @keydown.esc.stop.prevent="handleEscape"
  >
    <x-widget
      ref="xWidgetRef"
      v-if="editorWidget"
      :widget="editorWidget"
      :style="{
        '--table-cell-padding': 0,
        padding: 'var(--table-cell-padding)',
        '--table-row-height': rowHeightValue,
      }"
      style="padding: 0px;"
      @click.stop
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, PropType, provide, ref, watch } from "vue";
import { HAS_WIDGET_MOUNTED, HOVER_WIDGET, VISIBLE } from "@renderer/types";
import type { FormElement } from "@renderer/b2/controllers/form";
import { FormWidgetType, FormTableRowHeight } from "../../../../../../../common/types/nocode";
import { equals } from "@common/utils/object";
import { cloneDeep as deepClone } from "lodash";
import type { NocodeTableEditorContext } from "./types";
import { isNocodeTableEditorEnterCommitEnabled } from "./editor-policy";
import { resolveNocodeEditorHostConfirmResult } from "./editor-host-utils";
import { shouldInitializeNocodeEditorHost } from "./editor-host-runtime";

const props = defineProps({
  modelValue: {
    type: null,
    default: undefined,
  },
  context: {
    type: Object as PropType<NocodeTableEditorContext | undefined>,
    default: undefined,
  },
});

const emit = defineEmits<{
  (event: "update:modelValue", value: any): void;
  (event: "commit", payload?: { value: any; reason?: string }): void;
  (event: "cancel", payload?: { reason?: string }): void;
}>();

const rootRef = ref<HTMLElement | null>(null);
const xWidgetRef = ref<any>(null);
const initialValue = ref<any>(undefined);
const hasInitialized = ref(false);

const editorWidget = computed(() => {
  const elementId = props.context?.editingColumn?.params?.elementId;
  if (!elementId) {
    return null;
  }
  return props.context?.widget?.getInstanceById(elementId) as FormElement | null;
});

const rowHeightValue = computed(() => {
  if (props.context?.rowHeightLevel === FormTableRowHeight.SMALL) {
    return "32px";
  }
  if (props.context?.rowHeightLevel === FormTableRowHeight.MEDIUM) {
    return "66px";
  }
  if (props.context?.rowHeightLevel === FormTableRowHeight.LARGE) {
    return "110px";
  }
  return "auto";
});

const hostStyle = computed(() => {
  if (props.context?.presentationMode === "popup") {
    return {
      minWidth: "100%",
    };
  }
  return {
    minHeight: rowHeightValue.value,
  };
});

const syncWidgetValue = (nextValue: any) => {
  if (!editorWidget.value) {
    return;
  }
  editorWidget.value.setOption("show-title", false, false);
  editorWidget.value.setOption("background-color", "transparent", false);
  editorWidget.value.setOption("is-hidden", false, false);
  editorWidget.value.isInTable = true;
  editorWidget.value.clearValue();
  editorWidget.value.inputValue = nextValue === "" ? null : nextValue;
};

const blurWidgetDom = () => {
  let widgetEl = xWidgetRef.value?.$el as Node | undefined;
  if (!widgetEl) {
    return;
  }
  if (widgetEl.nodeType === Node.TEXT_NODE) {
    widgetEl = widgetEl.parentElement as Node;
  }
  (widgetEl as HTMLElement)?.blur?.();
};

const confirmEdit = (reason = "manual") => {
  const result = resolveNocodeEditorHostConfirmResult({
    widget: editorWidget.value,
    initialValue: initialValue.value,
    reason,
  });

  if (result.action === "stay-editing") {
    return;
  }

  blurWidgetDom();

  if (result.action === "cancel") {
    emit("cancel", {
      reason: result.reason,
    });
    return;
  }

  emit("commit", {
    value: result.value,
    reason: result.reason,
  });
};

const handleEnter = () => {
  if (!editorWidget.value) {
    return;
  }
  if (!isNocodeTableEditorEnterCommitEnabled(editorWidget.value.type as FormWidgetType)) {
    return;
  }
  confirmEdit("enter");
};

const handleEscape = () => {
  emit("cancel", { reason: "escape" });
};

const requestCommit = (reason = "manual") => {
  confirmEdit(reason);
};

const initializeEditorHost = () => {
  if (!editorWidget.value) {
    return;
  }
  syncWidgetValue(props.modelValue);
  nextTick(() => {
    if (!editorWidget.value) {
      return;
    }
    editorWidget.value.command?.("focus");
    initialValue.value = deepClone(editorWidget.value.inputValue);
    emit("update:modelValue", editorWidget.value.inputValue);
    hasInitialized.value = true;
  });
};

watch(() => props.modelValue, (nextValue) => {
  if (!editorWidget.value) {
    return;
  }
  if (equals(editorWidget.value.inputValue, nextValue)) {
    return;
  }
  syncWidgetValue(nextValue);
});

watch(() => editorWidget.value?.inputValue, (nextValue) => {
  emit("update:modelValue", nextValue);
});

watch(() => editorWidget.value, (widget) => {
  if (!shouldInitializeNocodeEditorHost({
    initialized: hasInitialized.value,
    widget,
  })) {
    return;
  }
  initializeEditorHost();
}, {
  immediate: true,
});

defineExpose({
  requestCommit,
});

provide(VISIBLE, computed(() => true));
provide(HAS_WIDGET_MOUNTED, ref(false));
provide(HOVER_WIDGET, ref(null));
</script>

<style scoped lang="scss">
.nocode-table-editor-host {
  width: 100%;
}
</style>
