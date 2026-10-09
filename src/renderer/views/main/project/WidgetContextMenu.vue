<template>
  <div class="context-menu-div" @mouseup.self="closeMenu" v-show="dialogStorage.widgetContextMenuVisible">
    <el-menu class=context-menu mode="vertical" :style="position">
      <el-menu-item-group v-if="!contextMenuWidget?.locked">
        <el-menu-item @click="reloadFn">
          <i class="fs fs-icon-reset"></i>
          <span>{{ $t("widgetContextMenu.menuReset") }}</span>
        </el-menu-item>
      </el-menu-item-group>
      <el-menu-item-group v-if="customMenuItems?.length > 0 && !contextMenuWidget?.locked">
        <el-divider />
        <template v-for="menuItem in customMenuItems" :key="menuItem.role">
          <template v-if="menuItem.visible">
            <el-menu-item  @click="customMenuItemClick(menuItem)">
              <i class="fs"></i>
              <span>{{ menuItem.label }}</span>
            </el-menu-item>
          </template>
        </template>
      </el-menu-item-group>
      <!-- <el-menu-item-group v-if="!contextMenuWidget?.locked">
        <el-divider />
        <el-menu-item class="select-layer" v-if="!isFromCatalog && layerBoards.length">
          <i class="fs fs-group"></i>
          {{ i18next.t("widgetContextMenu.selectLayer") }}
          <el-icon :size="16" class="arrow">
            <i-material-symbols-play-arrow></i-material-symbols-play-arrow>
          </el-icon>
          <el-menu-item-group class="layers">
            <div class="menu-item" @click.stop="handleSelectWidget(activeElement as Widget)">
              <el-icon class="select-icon" :size="12">
                <i-ep-select></i-ep-select>
              </el-icon>
              <img class="icon" :src="activeElement.icon" alt="">
              <span class="widget-name">{{ activeElement.name }}</span>
            </div>
            <div class="group" v-for="item,index in layerBoards" :key="index">
              <div class="label" :title="item.crumbs.join(` > `)">{{ item.crumbs.join(` > `) }}</div>
              <context-menu-sub :selected-uid="activeElement.uid" :menus="item.children" @selected="handleSelectWidget"></context-menu-sub>
            </div>
          </el-menu-item-group>
        </el-menu-item>

        <el-menu-item @click="toTopFn" :disabled="selectedWidgets.length !== 1">
          <i class="fs fs-move-to-top"></i>
          <span>{{ $t("widgetContextMenu.menuMoveTop") }}</span>
        </el-menu-item>
        <el-menu-item @click="toBottomFn" :disabled="selectedWidgets.length !== 1">
          <i class="fs fs-move-to-bottom"></i>
          <span>{{ $t("widgetContextMenu.menuMoveBottom") }}</span>
        </el-menu-item>
        <el-menu-item @click="moveUpFn" :disabled="selectedWidgets.length !== 1">
          <i class="fs fs-move-up"></i>
          <span>{{ $t("widgetContextMenu.menuMoveUp") }}</span>
        </el-menu-item>
        <el-menu-item @click="moveDownFn" :disabled="selectedWidgets.length !== 1">
          <i class="fs fs-move-down"></i>
          <span>{{ $t("widgetContextMenu.menuMoveDown") }}</span>
        </el-menu-item>
      </el-menu-item-group> -->
      <el-menu-item-group>
        <el-divider />
        <el-menu-item @click="visibleShowFn" v-if="contextMenuWidget?.enabled">
          <i class="fs fs-hide"></i>
          <span>{{ $t("widgetContextMenu.menuHidden") }}</span>
        </el-menu-item>
        <el-menu-item @click="visibleShowFn" v-if="!contextMenuWidget?.enabled">
          <i class="fs fs-visible"></i>
          <span>{{ $t("widgetContextMenu.menuDisplay") }}</span>
        </el-menu-item>
        <el-menu-item @click="lockFn" v-if="!contextMenuWidget?.locked">
          <i class="fs fs-lock"></i>
          <span>{{ $t("widgetContextMenu.menuLock") }}</span>
        </el-menu-item>
        <el-menu-item @click="lockFn" v-if="contextMenuWidget?.locked">
          <i class="fs fs-unlocked"></i>
          <span>{{ $t("widgetContextMenu.menuUnlocked") }}</span>
        </el-menu-item>
      </el-menu-item-group>
      <el-menu-item-group v-if="!contextMenuWidget?.locked">
        <el-divider />
        <!-- <el-menu-item @click="renameFn">
          <i class="fs fs-rename2"></i>
          <span>{{ $t("widgetContextMenu.menuRename") }}</span>
        </el-menu-item> -->
        <!-- <el-menu-item @click="widgetManangeFn('move')">
          <el-icon :size="12">
            <i-ven-widget-move />
          </el-icon>
          <span>{{ $t("widgetContextMenu.menuMoveWidget") }}</span>
        </el-menu-item> -->
        <el-menu-item @click="widgetManangeFn('copy')">
          <i class="fs fs-clone"></i>
          <span>{{ $t("widgetContextMenu.menuCopyWidget") }}</span>
        </el-menu-item>
        <!-- <el-menu-item @click="copyStyles">
          <el-icon :size="12">
            <i-ep-copy-document></i-ep-copy-document>
          </el-icon>
          <span>{{ $i18next.t("widgetContextMenu.menuCopyStyle") }}</span>
        </el-menu-item> -->
        <el-menu-item @click="deleteFn">
          <i class="fs fs-delete"></i>
          <span>{{ $t("widgetContextMenu.menuDelete") }}</span>
        </el-menu-item>
      </el-menu-item-group>
      <!-- <el-menu-item-group v-if="!contextMenuWidget?.locked">
        <el-divider />
        <el-menu-item @click="menuNewAndMoveIntoGroup">
          <i class="fs fs-group"></i>
          <span>{{ $t("widgetContextMenu.menuNewAndMoveIntoGroup") }}</span>
        </el-menu-item>
        <el-menu-item @click="moveIntoGroup">
          <i class="fs fs-group"></i>
          <span>{{ $t("widgetContextMenu.menuMoveIntoGroup") }}</span>
        </el-menu-item>
        <el-menu-item @click="mergeGroup">
          <i class="fs fs-group"></i>
          <span>{{ $t("widgetContextMenu.menuMergeGroup") }}</span>
        </el-menu-item>
        <el-menu-item :disabled="contextMenuWidget?.type !== 'widget.group.panel'" @click="handleCancelMergeWidget">
          <i class="fs fs-ungroup"></i>
          <span>{{ $t("widgetContextMenu.menuUngroup") }}</span>
        </el-menu-item>
      </el-menu-item-group> -->
      <el-menu-item-group v-if="isFromCatalog && !contextMenuWidget?.locked">
        <el-divider />
        <el-menu-item @click="foldAllFn" :disabled="!catalogStatus">
          <i class="fs fs-fold2"></i>
          <span>{{ $t("widgetContextMenu.menuFoldAll") }}</span>
        </el-menu-item>
        <el-menu-item @click="expandAllFn" :disabled="!catalogStatus">
          <i class="fs fs-expand"></i>
          <span>{{ $t("widgetContextMenu.menuExpandAll") }}</span>
        </el-menu-item>
      </el-menu-item-group>
    </el-menu>
  </div>
</template>
<script lang="ts" setup>
import { ACTIVE_BOARD, CANCEL_MERGE_WIDGETS, HANDLE_WIDGET_MOVE_DOWN, HANDLE_WIDGET_MOVE_UP, HANDLE_WIDGET_TO_BOTTOM, HANDLE_WIDGET_TO_TOP, SELECTED_WIDGETS, PROJECT_ID, WIDGET_MENU_CONTEXT, ACTIVE_ELEMENT, COPY_STYLES, MERGE_WIDGETS_FUN, ALL_BOARD, ACTIVE_WIDGET, HANDLE_PASTED_WIDGETS, CLONE_WIDGET } from '@renderer/types/inject';
import { computed, inject, ref, Ref, toRaw } from 'vue';
import { useProjectDialogStore } from '@renderer/stores';
import { useWindowSize } from '@vueuse/core'
import { MousePosition, widgetManagerDialogArgs } from '@renderer/b2/types';
import { Widget } from '@renderer/b2/controllers/widget';
import { deepClone } from '@common/utils/object';
import { LayerBoard, LayerWidget } from '@renderer/utils/filterWidgetPosition';

const projectId = inject(PROJECT_ID);
const selectedWidgets = inject(SELECTED_WIDGETS);
const activeBoard = inject(ACTIVE_BOARD);
const activeElement = inject(ACTIVE_ELEMENT);
const widgetMenuContext = inject(WIDGET_MENU_CONTEXT);
const allBoard = inject(ALL_BOARD);
const handleWidgetToTop = inject(HANDLE_WIDGET_TO_TOP);
const handleWidgetToBottom = inject(HANDLE_WIDGET_TO_BOTTOM);
const handleWidgetMoveUp = inject(HANDLE_WIDGET_MOVE_UP);
const handleWidgetMoveDown = inject(HANDLE_WIDGET_MOVE_DOWN);
const cancelMergeWidgets = inject(CANCEL_MERGE_WIDGETS);
const copyElementStyles = inject(COPY_STYLES);
const mergeWidgetsFun =  inject(MERGE_WIDGETS_FUN);

const contextMenuWidget = ref<Widget>();
const customMenuItems = ref([])
const isFromCatalog = ref(false);
const mousePosition = ref<MousePosition>()

const projectDialogState = useProjectDialogStore();
const dialogStorage = projectDialogState.getStorage(projectId);
const catalogStatus = computed(() => {
  for (const widget of selectedWidgets.value) {
    if (widget.container) {
      return true;
    }
  }
  return false;
})

const closeMenu = () => {
  dialogStorage.hide('widgetContextMenuVisible');
}

const customMenuItemClick = (menuItem) => {
  menuItem.do()
  closeMenu();
}

// 屏幕窗口大小
const { width, height } = useWindowSize()
const position = computed(() => {
  if (width.value - mousePosition.value?.left >= 130 && height.value - mousePosition.value?.top >= 460) {
    return {
      left: `${mousePosition.value?.left}px`,
      top: `${mousePosition.value?.top}px`
    }

  } else if (width.value - mousePosition.value?.left >= 130 && height.value - mousePosition.value?.top <= 460) {
    return {
      left: `${mousePosition.value?.left - 50}px`,   //减去50是模拟windows的鼠标右键
      bottom: `${height.value - mousePosition.value?.top}px`
    }
  } else if (width.value - mousePosition.value?.left <= 130 && height.value - mousePosition.value?.top >= 460) {
    return {
      right: `0px`,
      top: `${mousePosition.value?.top}px`
    }
  } else if (width.value - mousePosition.value?.left <= 130 && height.value - mousePosition.value?.top <= 460) {
    return {
      right: `0px`,
      bottom: `${height.value - mousePosition.value?.top}px`
    }
  }
}); //定位



const reloadFn = async () => {
  closeMenu();
  selectedWidgets.value = [];
  const widget = await contextMenuWidget.value.parent.container.reloadWidget(contextMenuWidget.value);
  selectedWidgets.value = [widget];
}

const toTopFn = () => {
  handleWidgetToTop();
  closeMenu();
}
const toBottomFn = () => {
  handleWidgetToBottom();
  closeMenu();
}
const moveUpFn = () => {
  handleWidgetMoveUp();
  closeMenu();
}
const moveDownFn = () => {
  handleWidgetMoveDown();  
  closeMenu();
}

// 显示隐藏、解锁锁定效果都有触发右键的组件来决定
const visibleShowFn = () => {
  const enabled = !contextMenuWidget.value.enabled;
  selectedWidgets.value.forEach(widget=>{
    widget.enabled = enabled;
  })

  closeMenu();
}
const lockFn = () => {
  const locked = !contextMenuWidget.value.locked;
  selectedWidgets.value.forEach(widget=>{
    widget.locked = locked;
  })
  closeMenu();
  activeBoard.value.updateHistory();
}
const renameFn = () => {
  widgetMenuContext.renameWidgetCallback(contextMenuWidget.value);
  closeMenu();
}

const activeWidgetBoard = computed(() => selectedWidgets?.value?.[0]?.getBoard());
const cloneWidget = inject(CLONE_WIDGET)
const handlePastedWidget = inject(HANDLE_PASTED_WIDGETS);
const widgetManangeFn = async (type: widgetManagerDialogArgs) => {
  if (type === "copy") {
    const activeWidgetBoardId = activeWidgetBoard.value.uid
    const selectWidgetsValue = toRaw(selectedWidgets.value);
    const widgetSouls = selectWidgetsValue.map(widget => {
      const widgetSoul = deepClone(widget.getSoul());
      return widgetSoul
    });
    selectedWidgets.value = [];
    const { pastedWidgetSouls } = await handlePastedWidget(widgetSouls, projectId, activeWidgetBoardId, activeWidgetBoardId);
    for(const pastedWidgetSoul of pastedWidgetSouls){
      const {widgetSoul, oldUID} = pastedWidgetSoul;
      const currentWidget = selectWidgetsValue.find(widget => widget.uid === oldUID);
      selectedWidgets.value.push(await cloneWidget(widgetSoul, oldUID, currentWidget.parent as Widget, false));
    }
  } else {
    dialogStorage.show('widgetManagerDialogVisible', type);
  }

  closeMenu();
}
const copyStyles = async () => {
  await copyElementStyles();
  closeMenu();
}

const deleteFn = () => {
  selectedWidgets.value.forEach((widget) => {
    widget.remove();
  });
  selectedWidgets.value.length = 0;
  closeMenu();
}
const moveIntoGroup = () => {
  dialogStorage.show('groupMergeDialogVisible', 'move');
  closeMenu();
}
const menuNewAndMoveIntoGroup = () => {
  mergeWidgetsFun(selectedWidgets.value);
  closeMenu();
}
const mergeGroup = () => {
  dialogStorage.show('groupMergeDialogVisible', 'merge');
  closeMenu();
}

const handleCancelMergeWidget = () => {
  cancelMergeWidgets();
  closeMenu();
}

const foldAllFn = () => {
  widgetMenuContext.setWidgetCatalogStatus('fold');
  closeMenu();
}

const expandAllFn = () => {
  widgetMenuContext.setWidgetCatalogStatus('expand');
  closeMenu();
}

const handleSelectWidget = (widget: Widget) => {
  selectedWidgets.value = [ widget ];
  closeMenu();
}

const foldChildren = (children: LayerWidget[]) => {
  if (!children.length || children.length > 1 || children[0]?.widget === activeElement.value) {
    return {
      crumbs: [],
      children,
    }
  }
  const foldValue = foldChildren(children[0].children);
  return {
    crumbs: [children[0].widget.name, ...foldValue.crumbs],
    children: foldValue.children,
  }
}

const layerBoards: Ref<LayerBoard[]> = ref([]);
defineExpose({
  show(widget:Widget, _isFromCatalog: boolean, _mousePosition: MousePosition) {
    dialogStorage.show('widgetContextMenuVisible');
    customMenuItems.value = widget?.getContextMenuItems?.() || [];
    contextMenuWidget.value = widget;
    isFromCatalog.value = _isFromCatalog;
    mousePosition.value = _mousePosition;

    layerBoards.value.length = 0;
    //TODO 收集右键点击到的组件
  }
})
</script>

<style lang="scss" scoped>
.context-menu-div {
  position: fixed;
  inset: 0;
  background-color: transparent;
  z-index: 99999;

  :deep(.context-menu) {
    .el-menu-item {
      padding-left: 10px;
    }
  }
}

.context-menu {
  position: fixed;
  z-index: 99999;
  width: 130px;
  border: solid 1px var(--border-color-light);
  background-color: var(--bg-color-overlay);

  :deep(.el-menu-item-group) {
    width: 100%;
    .el-menu-item-group__title {
      display: none;
    }

    .select-layer {
      position: relative;
      --layer-display: none;
      &:hover {
        --layer-display: block;
      }

      .arrow {
        position: absolute;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
      }
      .layers {
        max-height: 444px;
        position: absolute;
        background-color: #2e2f33;
        left: 100%;
        top: -3px;
        border: 1px solid var(--el-menu-border-color);
        display: var(--layer-display);
        width: max-content;
        min-width: 100%;
        overflow-y: scroll;
        user-select: none;

        &::-webkit-scrollbar {
          display: none;
        }

        >ul {
          overflow: hidden;
        }

        .group {
          .label {
            padding: 0 10px;
            opacity: 0.35;
            max-width: 256px;
            text-overflow: ellipsis;
            overflow: hidden;
          }
        }
        .menu-item {
          height: 25px;
          display: flex;
          align-items: center;
          padding-left: 10px !important;
          position: relative;

          .select-icon {
            width: 12px;
            position: unset;
            svg {
              position: absolute;
              left: 10px;
            }
          }
          .icon {
            width: 25px;
            height: 25px;
            filter: brightness(1.2) saturate(0%);
          }

          .widget-name {
            display: flex;
            height: 100%;
            align-items: center;
            justify-content: center;
          }

        }
      }

    }
  }
  .el-divider {
    margin: 2px 0;
  }

  .el-menu-item {
    padding: 0 10px;
    height: 25px;
    line-height: 25px;
    font-size: 12px;
  }

  .fs,
  .el-icon {
    display: flex;
    width: 25px;
    height: 25px;
    line-height: 25px;
    font-size: 12px;
    align-items: center;
    justify-content: start;
    margin: 0;
  }
}
</style>
