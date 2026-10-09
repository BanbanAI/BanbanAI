<template>
  <div class="selection-stage-shell nocode-board-editor">
    <div class="selection-stage-toolbar">
      <div class="selection-stage-toolbar__group">
        <button
          type="button"
          class="stage-tool stage-tab"
          :class="{ 'is-active': aiVisible }"
          @click="emit('update:aiVisible', !aiVisible)"
        >
          <el-icon color="#3793ff" :size="16"><i-ven-ai-score-icon /></el-icon>
          <span class="stage-tool__label">{{ $t('nocodeBoardEditor.aiAssistant') }}</span>
        </button>
        <button
          type="button"
          class="stage-tool stage-action"
          :class="{ 'is-active': activeLeftPanel === 'catalog' }"
          @click="toggleLeftPanel('catalog')"
        >
          <el-icon :size="16"><i-ep-plus /></el-icon>
          <span class="stage-tool__label">{{ $t('nocodeBoardEditor.addComponent') }}</span>
        </button>
        <button
          type="button"
          class="stage-tool stage-action"
          :class="{ 'is-active': activeLeftPanel === 'dataLayer' && activeDataLayerTab === 'data' }"
          @click="toggleDataLayerPanel('data')"
        >
          <el-icon :size="16"><i-ep-coin /></el-icon>
          <span class="stage-tool__label">{{ $t('nocodeBoardEditor.data') }}</span>
        </button>
        <button
          type="button"
          class="stage-tool stage-action"
          :class="{ 'is-active': activeLeftPanel === 'dataLayer' && activeDataLayerTab === 'layer' }"
          @click="toggleDataLayerPanel('layer')"
        >
          <el-icon :size="16"><i-uil-layers /></el-icon>
          <span class="stage-tool__label">{{ $t('nocodeBoardEditor.layer') }}</span>
        </button>
      </div>
      <button
        type="button"
        class="stage-tool stage-action"
        :class="{ 'is-active': propertyPanelVisible }"
        @click="togglePropertyPanel"
      >
        <el-icon :size="16"><i-ep-operation /></el-icon>
        <span class="stage-tool__label">{{ $t('nocodeBoardEditor.boardProperties') }}</span>
      </button>
    </div>
    <div
      ref="boardStageBodyRef"
      class="nocode-stage-body selection-stage-body is-board"
      :class="{ 'has-pinned-panel': isBoardDataLayerPinned }"
    >
      <div
        v-if="showDataLayerPanel"
        ref="dataLayerPanelRef"
        class="board-floating-panel board-floating-panel--left board-floating-panel--data-layer"
        :class="{ 'is-pinned': isBoardDataLayerPinned }"
        :style="dataLayerFloatingPanelStyle"
      >
        <div class="board-floating-panel__header" :class="{ 'is-draggable': !isBoardDataLayerPinned }" @mousedown.stop="handleLeftPanelDragStart">
          <el-tabs v-model="activeDataLayerTab" class="board-floating-panel__tabs">
            <el-tab-pane :label="$t('nocodeBoardEditor.data')" name="data" />
            <el-tab-pane :label="$t('nocodeBoardEditor.layer')" name="layer" />
          </el-tabs>
          <button type="button" class="board-floating-panel__pin" @click.stop="toggleBoardDataLayerPinned">
            <el-icon v-if="isBoardDataLayerPinned"><i-ven-icon-no-nail /></el-icon>
            <el-icon v-else><i-ven-icon-nail /></el-icon>
          </button>
          <button
            type="button"
            class="board-floating-panel__close"
            @click.stop="activeLeftPanel = null"
          >
            <el-icon :size="16"><i-ep-close /></el-icon>
          </button>
        </div>
        <el-tabs v-model="activeDataLayerTab" class="board-floating-panel__content-tabs">
          <el-tab-pane name="data">
            <project-data
              ref="projectDataRef"
              :form-data="formData"
              v-bind="attrs"
            >
              <template #empty>
                <div class="board-data-empty">{{ $t('nocodeBoardEditor.noData') }}</div>
              </template>
            </project-data>
          </el-tab-pane>
          <el-tab-pane name="layer">
            <div :id="layerPanelId" class="board-floating-panel__layer-body"></div>
          </el-tab-pane>
        </el-tabs>
      </div>
      <project-editor
        v-if="projectId"
        ref="innerProjectEditorRef"
        :key="projectId"
        :project-id="projectId"
        :project-name="projectName"
        :auto-full-screen="false"
        :embedded="true"
        :catalog-visible="showCatalogPanel"
        :layer-panel-visible="showDataLayerPanel && activeDataLayerTab === 'layer'"
        :property-panel-visible="propertyPanelVisible"
        :nocode-id="nocodeId"
        :left-container="layerPanelSelector"
        @saved="emit('saved')"
        @open-setting="handleOpenSetting"
        @update:catalogVisible="handleCatalogVisibleChange"
        @update:propertyPanelVisible="handlePropertyPanelVisibleChange"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, useAttrs, watch } from "vue";
import { useEventListener, useResizeObserver } from "@vueuse/core";
import type { NocodeFormData } from "@common/types/nocode";
import type { SettingTab, Table } from "@common/types/project";
import ProjectEditor from "@renderer/views/main/project/ProjectEditor.vue";
import ProjectData from "@renderer/views/main/project/ProjectData.vue";
import { EMBEDDED_BOARD_FLOATING_PANEL_Z_INDEX, resolveProjectFloatingPanelMetrics } from "@renderer/views/main/project/projectEditorFloatingPanels";
import { clampFloatingPanelPosition, resolveFieldCatalogCollisionInsets, resolveFieldCatalogDragPosition } from "../formDesignerFloatingPanels";
import { boardPanelState, editorPanelLayouts, resolveEditorPanelPosition, setBoardDataLayerPanel, setBoardPropertyPanelVisible, setEditorPanelPinned, updateEditorPanelFloatingPosition } from "../editorPanelPinning";

type LeftPanelType = "catalog" | "dataLayer" | null;
type DataLayerTab = "data" | "layer";

const props = defineProps<{
  projectId: string;
  projectName: string;
  nocodeId: string;
  formData?: NocodeFormData;
  aiVisible: boolean;
}>();

const emit = defineEmits<{
  (event: "saved"): void;
  (event: "open-setting", settingTab?: SettingTab): void;
  (event: "update:aiVisible", value: boolean): void;
}>();

const attrs = useAttrs();

const boardStageBodyRef = ref<HTMLElement | null>(null);
const dataLayerPanelRef = ref<HTMLElement | null>(null);
const innerProjectEditorRef = ref();
const projectDataRef = ref();
const activeLeftPanel = ref<LeftPanelType>(
  boardPanelState.dataLayerPanel ? "dataLayer" : null,
);
const activeDataLayerTab = ref<DataLayerTab>(boardPanelState.dataLayerPanel || "data");
const propertyPanelVisible = ref(boardPanelState.propertyPanelVisible);
const layerPanelId = `nocode-board-layer-panel-${String(props.projectId || "default").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
const layerPanelSelector = `#${layerPanelId}`;
const boardStageBodyWidth = ref(0);
const leftPanelPosition = ref({
  x: 0,
  y: 0,
});
const leftPanelDragState = ref<null | {
  startPointer: { x: number; y: number }
  startPosition: { x: number; y: number }
}>(null);
const boardFloatingPanelMetrics = computed(() => {
  return resolveProjectFloatingPanelMetrics(boardStageBodyWidth.value || Number.POSITIVE_INFINITY);
});
const isBoardDataLayerPinned = computed(() => editorPanelLayouts.boardDataLayer.pinned);
const dataLayerFloatingPanelStyle = computed(() => ({
  width: `${boardFloatingPanelMetrics.value.leftPanelWidth}px`,
  transform: `translate(${leftPanelPosition.value.x}px, ${leftPanelPosition.value.y}px)`,
  zIndex: String(EMBEDDED_BOARD_FLOATING_PANEL_Z_INDEX),
  height: isBoardDataLayerPinned.value ? "100%" : undefined,
}));

const showCatalogPanel = computed(() => activeLeftPanel.value === "catalog");
const showDataLayerPanel = computed(() => activeLeftPanel.value === "dataLayer");
const activeFloatingLeftPanelRef = computed(() => {
  return showDataLayerPanel.value ? dataLayerPanelRef.value : null;
});

const toggleLeftPanel = (panel: Exclude<LeftPanelType, null>) => {
  activeLeftPanel.value = activeLeftPanel.value === panel ? null : panel;
};

const toggleDataLayerPanel = (tab: DataLayerTab) => {
  if (showDataLayerPanel.value && activeDataLayerTab.value === tab) {
    activeLeftPanel.value = null;
    return;
  }
  activeDataLayerTab.value = tab;
  activeLeftPanel.value = "dataLayer";
};

const handleCatalogVisibleChange = (value: boolean) => {
  if (value) {
    activeLeftPanel.value = "catalog";
    return;
  }
  if (activeLeftPanel.value === "catalog") {
    activeLeftPanel.value = null;
  }
};

const getLeftFloatingPanelMetrics = () => {
  const bounds = boardStageBodyRef.value?.getBoundingClientRect?.();
  const panelRect = activeFloatingLeftPanelRef.value?.getBoundingClientRect?.();
  if (!bounds || !panelRect) {
    return null;
  }
  return {
    bounds: {
      width: bounds.width,
      height: bounds.height,
    },
    panelSize: {
      width: panelRect.width,
      height: panelRect.height,
    },
  };
}

const resolveLeftPanelCollisionInsets = (nextPosition = leftPanelPosition.value) => {
  return resolveFieldCatalogCollisionInsets(
    propertyPanelVisible.value,
    nextPosition,
    undefined,
    boardStageBodyRef.value?.getBoundingClientRect?.().width,
    activeFloatingLeftPanelRef.value?.getBoundingClientRect?.().width || boardFloatingPanelMetrics.value.leftPanelWidth,
    boardFloatingPanelMetrics.value.propertyWidth,
  );
}

const syncLeftPanelPosition = (nextPosition = leftPanelPosition.value) => {
  const metrics = getLeftFloatingPanelMetrics();
  if (!metrics) {
    return;
  }
  if (isBoardDataLayerPinned.value) {
    leftPanelPosition.value = resolveEditorPanelPosition(
      "boardDataLayer",
      metrics.panelSize,
      metrics.bounds,
      { x: boardFloatingPanelMetrics.value.padding, y: boardFloatingPanelMetrics.value.padding },
    );
    return;
  }
  leftPanelPosition.value = clampFloatingPanelPosition(
    nextPosition,
    metrics.panelSize,
    metrics.bounds,
    boardFloatingPanelMetrics.value.padding,
    resolveLeftPanelCollisionInsets(nextPosition),
  );
  updateEditorPanelFloatingPosition("boardDataLayer", leftPanelPosition.value);
}

const handleLeftPanelDragStart = (event: MouseEvent) => {
  if (isBoardDataLayerPinned.value || event.button !== 0) {
    return;
  }
  leftPanelDragState.value = {
    startPointer: {
      x: event.clientX,
      y: event.clientY,
    },
    startPosition: {
      ...leftPanelPosition.value,
    },
  };
  event.preventDefault();
}

const toggleBoardDataLayerPinned = () => {
  const pinned = !isBoardDataLayerPinned.value;
  setEditorPanelPinned("boardDataLayer", pinned, leftPanelPosition.value);
  nextTick(() => {
    const metrics = getLeftFloatingPanelMetrics();
    if (!metrics) return;
    leftPanelPosition.value = resolveEditorPanelPosition(
      "boardDataLayer",
      metrics.panelSize,
      metrics.bounds,
      { x: boardFloatingPanelMetrics.value.padding, y: boardFloatingPanelMetrics.value.padding },
    );
  });
};

const handleOpenSetting = (settingTab?: SettingTab) => {
  emit("open-setting", settingTab);
};

const handlePropertyPanelVisibleChange = (value: boolean) => {
  propertyPanelVisible.value = value;
  setBoardPropertyPanelVisible(value);
};

const togglePropertyPanel = () => {
  handlePropertyPanelVisibleChange(!propertyPanelVisible.value);
};

useEventListener(document, "mousemove", (event: MouseEvent) => {
  if (!leftPanelDragState.value) {
    return;
  }
  const metrics = getLeftFloatingPanelMetrics();
  if (!metrics) {
    return;
  }
  leftPanelPosition.value = resolveFieldCatalogDragPosition({
    startPointer: leftPanelDragState.value.startPointer,
    currentPointer: {
      x: event.clientX,
      y: event.clientY,
    },
    startPosition: leftPanelDragState.value.startPosition,
    panelSize: metrics.panelSize,
    bounds: metrics.bounds,
    padding: boardFloatingPanelMetrics.value.padding,
    insets: resolveLeftPanelCollisionInsets({
      x: leftPanelDragState.value.startPosition.x + (event.clientX - leftPanelDragState.value.startPointer.x),
      y: leftPanelDragState.value.startPosition.y + (event.clientY - leftPanelDragState.value.startPointer.y),
    }),
  });
  updateEditorPanelFloatingPosition("boardDataLayer", leftPanelPosition.value);
});

useEventListener(document, "mouseup", () => {
  leftPanelDragState.value = null;
});

useResizeObserver(boardStageBodyRef, (entries) => {
  boardStageBodyWidth.value = entries[0]?.contentRect?.width || 0;
  syncLeftPanelPosition();
});

watch(() => activeLeftPanel.value, async (panel) => {
  if (panel !== "dataLayer") {
    leftPanelDragState.value = null;
    return;
  }
  await nextTick();
  syncLeftPanelPosition(resolveEditorPanelPosition(
    "boardDataLayer",
    activeFloatingLeftPanelRef.value?.getBoundingClientRect
      ? { width: activeFloatingLeftPanelRef.value.getBoundingClientRect().width, height: activeFloatingLeftPanelRef.value.getBoundingClientRect().height }
      : { width: boardFloatingPanelMetrics.value.leftPanelWidth, height: boardStageBodyRef.value?.getBoundingClientRect().height || 0 },
    { width: boardStageBodyRef.value?.getBoundingClientRect().width || 0, height: boardStageBodyRef.value?.getBoundingClientRect().height || 0 },
    { x: boardFloatingPanelMetrics.value.padding, y: boardFloatingPanelMetrics.value.padding },
  ));
}, {
  immediate: true,
});

watch([activeLeftPanel, activeDataLayerTab], ([panel, tab]) => {
  setBoardDataLayerPanel(panel === "dataLayer" ? tab : null);
});

watch(propertyPanelVisible, async () => {
  if (activeLeftPanel.value !== "dataLayer") {
    return;
  }
  await nextTick();
  syncLeftPanelPosition();
});

defineExpose({
  get projectChanged() {
    return Boolean(innerProjectEditorRef.value?.projectChanged);
  },
  previewPage() {
    return innerProjectEditorRef.value?.previewPage?.();
  },
  saveProject(noMessage?: boolean) {
    return innerProjectEditorRef.value?.saveProject?.(noMessage);
  },
  openComponentCatalog() {
    activeLeftPanel.value = "catalog";
    innerProjectEditorRef.value?.openComponentCatalog?.();
  },
  closeComponentCatalog() {
    if (activeLeftPanel.value === "catalog") {
      activeLeftPanel.value = null;
    }
    innerProjectEditorRef.value?.closeComponentCatalog?.();
  },
  refresh() {
    projectDataRef.value?.refresh?.();
  },
  activity(table: Table) {
    projectDataRef.value?.activity?.(table);
  },
  removeActive() {
    projectDataRef.value?.removeActive?.();
  },
});
</script>

<style lang="scss" scoped>
.nocode-board-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 16px 0;
}

.selection-stage-toolbar {
  width: 100%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  background-color: #ffffff;

  .stage-tool {
    border: none;
    outline: none;
    background: transparent;
    height: 30px;
    padding: 0 10px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 14px;
    line-height: 22px;
    color: #4e5969;
    cursor: pointer;
    transition: background-color 0.18s ease, color 0.18s ease;

    .stage-tool__label {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    }

    &:hover:not(.is-active):not(.active) {
      color: #1d2129;
      background-color: #f2f3f5;
    }

    &.is-active,
    &.active {
      color: #0873ff;
      background-color: #e8f6ff;
    }
  }
}

.selection-stage-toolbar__group {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.nocode-stage-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  position: relative;
  border-radius: 8px;
  overflow: hidden;

  :deep(.project-editor) {
    flex: 1 1 0;
    min-width: 0;
    width: auto;
    height: 100%;
    border-left: none;
    background-color: transparent;
  }
}

.nocode-stage-body.has-pinned-panel {
  gap: 12px;
}

.board-floating-panel {
  position: absolute;
  top: 0;
  left: 0;
  height: calc(100% - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  border: 1px solid #e5e6eb;
  background: #ffffff;
  box-shadow: 0 12px 32px rgba(29, 33, 41, 0.12), 0 4px 12px rgba(29, 33, 41, 0.08);
  overflow: hidden;
  padding: 8px;

  &.is-pinned {
    position: relative !important;
    top: auto;
    left: auto;
    flex: none;
    height: 100% !important;
    transform: none !important;
    z-index: auto !important;
  }
}

.board-floating-panel__header {
  height: 32px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color-light);
  &.is-draggable {
    cursor: move;
  }
}

.board-floating-panel__tabs {
  flex: 1;
  min-width: 0;

  :deep(.el-tabs__header) {
    margin: 0;

    .el-tabs__item {
      padding: 0;
      margin: 0 24px 0 0;
    }

    .el-tabs__nav-wrap::after {
      background-color: transparent;
    }
  }

  :deep(.el-tabs__content) {
    display: none;
  }
}

.board-floating-panel__pin,
.board-floating-panel__close {
  flex: none;
}

.board-floating-panel__pin {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  color: var(--text-color-secondary);
  background: transparent;
  cursor: var(--cursor-pointer);

  img {
    width: 14px;
    height: 14px;
  }

  &:hover {
    background-color: #f2f3f5;
  }
}

.board-floating-panel__title {
  min-width: 0;
  color: var(--text-color-primary);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
}

.board-floating-panel__close {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-color-secondary);
  cursor: var(--cursor-pointer);
  transition: color 0.18s ease, background-color 0.18s ease;

  &:hover {
    background-color: #f2f3f5;
  }
}

.board-floating-panel__content-tabs {
  flex: 1;
  min-height: 0;

  :deep(.el-tabs__header) {
    display: none;
  }

  :deep(.el-tabs__content),
  :deep(.el-tab-pane) {
    height: 100%;
  }
}

.board-floating-panel__layer-body {
  width: 100%;
  height: 100%;
}

.board-floating-panel--data-layer {
  .board-data-empty {
    color: #aba8a8;
  }

  :deep(.project-data) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  :deep(.project-data-body) {
    height: 100%;
    min-height: 0;
  }

  :deep(.project-data-body > .vn-stack) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  :deep(.project-data-body > .vn-stack > .vn-stack-layer) {
    flex: 1;
    min-height: 0;
  }

  :deep(.fields-container) {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  :deep(.fields-container ul) {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin: 0;
  }
}

.board-floating-panel--data-layer {
  .board-floating-panel__layer-body {
    padding: 8px 0;
  }

  :deep(.project-editor-the-left) {
    width: 100%;
    height: 100%;
    border-top: none;
  }
}
</style>
