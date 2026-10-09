<template>
  <div
    v-if="isVisible && anchor"
    ref="rootRef"
    class="virtual-table-edit-host"
    :style="hostStyle"
    @click.stop
    @mousedown.stop
  >
    <component
      ref="editorRef"
      :is="definition?.component"
      v-bind="editorProps"
      @update:modelValue="emit('draft-change', $event)"
      @commit="emit('commit', $event)"
      @cancel="emit('cancel', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, PropType, ref } from "vue";
import { VirtualTableEditAnchor, VirtualTableEditSession, VirtualTableEditorDefinition } from "./types";

const props = defineProps({
  session: {
    type: Object as PropType<VirtualTableEditSession>,
    required: true,
  },
  definition: {
    type: Object as PropType<VirtualTableEditorDefinition | undefined>,
    default: undefined,
  },
  anchor: {
    type: Object as PropType<VirtualTableEditAnchor | null>,
    default: null,
  },
  editorProps: {
    type: Object as PropType<Record<string, any>>,
    default: () => ({}),
  },
});

const emit = defineEmits<{
  (event: "draft-change", value: any): void;
  (event: "commit", payload?: any): void;
  (event: "cancel", payload?: any): void;
  (event: "outside-click", mouseEvent: MouseEvent): void;
}>();

const rootRef = ref<HTMLElement | null>(null);
const editorRef = ref<any>(null);

const isVisible = computed(() => {
  return props.session.status === "editing" && props.definition?.mode === "popup";
});

const hostStyle = computed(() => {
  if (!props.anchor) {
    return {};
  }
  return {
    top: `${props.anchor.top}px`,
    left: `${props.anchor.left}px`,
    width: `${Math.max(props.anchor.width, 1)}px`,
    minWidth: `${Math.max(props.anchor.width, 1)}px`,
    maxWidth: `${Math.max(props.anchor.width, 1)}px`,
  };
});

const onDocumentMouseDown = (event: MouseEvent) => {
  if (!isVisible.value) {
    return;
  }
  if (rootRef.value?.contains(event.target as Node)) {
    return;
  }
  emit("outside-click", event);
};

onMounted(() => {
  document.addEventListener("mousedown", onDocumentMouseDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onDocumentMouseDown, true);
});

defineExpose({
  requestCommit: (reason = "outside-click") => {
    editorRef.value?.requestCommit?.(reason);
  },
});
</script>

<style scoped lang="scss">
.virtual-table-edit-host {
  position: absolute;
  z-index: 30;
  pointer-events: auto;
  overflow: hidden;
}
</style>
