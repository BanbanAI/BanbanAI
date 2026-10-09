<template>
  <div class="project-editor-the-left">
    <el-aside class="left-aside widget-catalog" @click="selectedWidgets = []">
      <div class="widget-catalog-list">
        <widget-catalog :widgets="activeBoard?.reversedWidgets ?? []" :key="activeBoard?.uid" ref="widgetCatalogRef">
        </widget-catalog>
      </div>
    </el-aside>
    <!-- 组件右键弹窗 -->
    <template>
      <teleport to="body">
        <template v-if="projectVisible">
        </template>
      </teleport>
      <group-merge-dialog v-model="dialogStorage.groupMergeDialogVisible" />
      <widget-manager-dialog v-model="dialogStorage.widgetManagerDialogVisible" />
      <edit-unable-mask></edit-unable-mask>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ParsedRef } from "@renderer/b2/types.js";
import { PROJECT_ID } from "@renderer/types/inject";
import { Widget } from "@renderer/b2/controllers/widget";
import { useProjectDialogStore } from "@renderer/stores";
import { ACTIVE_BOARD, DRAG_WIDGET, MOUSE_POSITION, SELECTED_WIDGETS, WIDGET_CATALOG_REF, VISIBLE } from "@renderer/types";
import { inject, provide, ref } from "vue";

const selectedWidgets = inject(SELECTED_WIDGETS);
const activeBoard = inject(ACTIVE_BOARD);
const projectVisible = inject(VISIBLE);
const projectId = inject(PROJECT_ID);
const widgetCatalogRef = inject(WIDGET_CATALOG_REF);

const projectDialogState = useProjectDialogStore();
const dialogStorage = projectDialogState.getStorage(projectId);

const mousePosition = ref({ left: 0, top: 0 });

const dragWidget: ParsedRef<Widget> = ref();
provide(DRAG_WIDGET, dragWidget);
provide(MOUSE_POSITION, mousePosition);
defineExpose({
  switchTab: (tabName: string) => {
  }
})
</script>

<style lang="scss" scoped>
.project-editor-the-left {
  width: 200px;
  height: 100%;
  flex: none;
  border-top: 1px solid var(--border-color-light);
}

.left-aside.widget-catalog {
  width: 100%;
  height: 100%;
  background-color: var(--bg-color-page);

  .title {
    display: flex;
    align-items: center;
    font-size: 12px;
    color: var(--text-color-primary);
    background-color: var(--bg-color);
    height: 40px;
    text-indent: 4px;
    font-weight: 700;
    padding-left: 5px;

    .search-icon {
      margin-left: auto;
      margin-right: 16px;
      &:hover {
        cursor: var(--cursor-pointer);
        color: #0089ff;
      }
    }
  }

  .vn-stack {
    height: 100%;
    display: flex;
    flex-direction: column;

  }
  .widget-catalog-list {
    // height: calc(100% - 40px);
  }
}
</style>
