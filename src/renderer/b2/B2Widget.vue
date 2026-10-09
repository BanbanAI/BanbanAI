<template>
  <div
    class="b2widget"
    :type="widget.type"
    :uid="widget.uid"
    :class="{
      hover: !widget.isPlaying && widget.isEditable && (widget.status.isHover || widget.status.isSelected || widget.showEditorShadow),
      active: !widget.isPlaying && !widget.locked && (widget.status.isActive),
      'cursor-copy': alt && !widget.isPlaying && !widget.locked,
      'selected': widget.status.isSelected && !widget.status.isActive && !widget.isPlaying,
      'data-invalid': isDataInvalid,
      'empty-invalid': isShowWidgetStyle,
      transition: !widget.isPlaying && widget.isEditable && !widget.showEditorShadow,
      'z-index-top': !widget.isPlaying && widget.isEditable && widget.showEditorShadow,
    }"
    :style="{
      ...widget.layoutStyle,
      opacity: `${widget.effectedOpacity.value}`,
      ...editingLayoutStyle,
    }"
    ref="dom"
    @mouseleave.stop="handleMouseOver(false)"
    @mouseover.stop="handleMouseOver()"
    @mouseenter.stop="handleMouseOver()"
    @contextmenu.prevent.stop="handleContextMenuShow"
    @mousedown="handleMouseDown($event)"
    @pointerdown.stop="handlePointerDown($event)"
  >
    <b2-background :background="background" :style="{zIndex: -1}"></b2-background>
    <div class="b2widget-body" ref="bodyRef"
      :style="{ perspective: widget.rotate.x === 0 && widget.rotate.y === 0?'unset':`${widget.size.width + widget.size.height}px`,overflow:widgetBodyOverflow, ...bodyBorder }">
      <div class="rotate-layer" :style="{ transform: widgetRotate }">
        <div class="header" v-if="!widget.isFormMode && [FormTableRuntime.BOARD_EDITOR, FormTableRuntime.BOARD_VIEWER].includes(widget?.getBoard()?.runtime)">
          <span class="title" :style="titleStyle" v-if="widget.widgetTitleEnabled">{{ widget.widgetTitle }}</span>

          <div class="header-btn-wrapper" :class="{show: hoverWidget?.uid === widget.uid && !isDraggingWidget}" v-if="widget?.getBoard()?.runtime === FormTableRuntime.BOARD_EDITOR">
            <div class="icon-box">
              <el-icon :size="16" @click.stop.prevent="handleCopyWidget(widget)"><i-ven-form-copy /></el-icon>
            </div>
            <el-popover width="286" :hide-icon="true" trigger="click" @click.stop
              :title="$t('b2Widget.deleteTip')" :trigger-keys="[]" v-model:visible="deletePopoverVisible"
              :popper-style="{ 
                '--el-bg-color-overlay': 'var(--bg-color-page)',
                '--el-popover-title-text-color': 'var(--text-color-primary)', 
                '--el-popover-title-font-size': '14px', 
                '--el-popover-padding': '16px', 
              }"
            >
             <div class="content" style="margin-top: -4px;">
                <!-- <p style="font-size: 12px; line-height: 17px;opacity: 0.7;">删除该字段后，对应表单中的数据会一并删除， 与字段相关的功能也会受到影响，请谨慎删除！</p> -->
                <div style="display: flex; justify-content: flex-end; margin-top: 16px">
                  <el-button style="border-radius: 4px;" size="default" @click="() => deletePopoverVisible = false">{{ $t('b2Widget.cancel') }}</el-button>
                  <el-button style="border-radius: 4px;" size="default" type="danger" @click="handleDeleteWidget()">{{ $t('b2Widget.delete') }}</el-button>
                </div>
             </div>
              <template #reference>
                <div class="icon-box">
                  <el-icon :size="16"><i-ven-form-delete /></el-icon>
                </div>
              </template>
            </el-popover>
          </div>
        </div>
        <div class="content-container">
          <div class="content" :style="widget.contentStyle" v-show="!(isDataInvalid || isShowWidgetStyle)"><slot></slot></div>
          <div class="b2widget-invalid-warpper" v-if="widget.isEditable">
            <div class="message-container" v-show="isDataInvalid || isShowWidgetStyle">
              <div class="message-tip">{{ inValidMessageTip }}</div>
            </div>
          </div>
        </div>
      </div>
      <template v-for="(mockBoard, teleportId) in widget.mockBoardMap" :key="teleportId">
        <teleport :to="`[id='${teleportId}']`">
          <b2-mock-board :teleportId="(teleportId as any)" :soul="mockBoard.soul" :linkages="mockBoard.linkages" :owner="widget" :mockBoard="mockBoard"></b2-mock-board>
        </teleport>
      </template>
    </div>
    <div class="widget-mask" v-if="ctrl && widget.shouldShowMask"></div>
    <div class="b2widget-resize" :class="[SNAPSHOT_IGNORE_CLASS]" v-if="canResize">
      <div class="ew" @mousedown.stop="handleResizeMouseDown($event, 'width')" @pointerdown.stop></div>
      <div class="ns" @mousedown.stop="handleResizeMouseDown($event, 'height')" @pointerdown.stop></div>
      <div class="se" @mousedown.stop="handleResizeMouseDown($event, 'both')" @pointerdown.stop></div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useWidget, SNAPSHOT_IGNORE_CLASS, OptionFontValue } from "./types";
import { ref, onMounted, inject, computed, watch, onUnmounted, provide, toRaw, nextTick, CSSProperties } from "vue";
import { Widget } from "./controllers/widget";
import { CLOSE_MOCKBOARD, SELECTED_WIDGETS, HOVER_WIDGET, ACTIVE_WIDGET, PROJECT_ID, ACTIVE_BOARD_ID, ACTIVE_ELEMENT_LOCKED, CLONE_WIDGET, HANDLE_PASTED_WIDGETS, WIDGET_MENU_CONTEXT, IS_DRAGGING_WIDGET, HAS_WIDGET_MOUNTED } from "@renderer/types";
import { Background } from "./controllers/background";
import { useMagicKeys, useEventListener, computedAsync } from "@vueuse/core";
import i18next from "i18next";
import { deepClone } from "@common/utils/object";
import { FormTableRuntime } from "@common/types/nocode";

const widget = useWidget<Widget>();

const { ctrl, shift, alt } = widget.isEditable ? useMagicKeys() : { ctrl: ref(false), shift: ref(false), alt: ref(false) };

const widgetMenuContext = inject(WIDGET_MENU_CONTEXT);
const isDraggingWidget = inject(IS_DRAGGING_WIDGET);
const hasWidgetMounted = inject(HAS_WIDGET_MOUNTED);

const props = defineProps(["overflow"]);

const handleContextMenuShow = function (ev: MouseEvent) {
  if (widget.isPlaying || !widget.isEditable) return;
  if (!selectedWidgets.value?.find((w) => w.uid === widget.uid)) {//当前widget未被选中
    selectedWidgets.value = [widget];
  }
  const mousePosition = { left: ev.pageX, top: ev.pageY };
  widgetMenuContext?.showWidgetMenu?.(widget, false, mousePosition);
};

const selectedWidgets = inject(SELECTED_WIDGETS);
const activeWidget = inject(ACTIVE_WIDGET);
const hoverWidget = inject(HOVER_WIDGET);
const dom = ref<HTMLElement>(null);
const bodyRef = ref<HTMLElement>(null);
const deletePopoverVisible = ref<boolean>(false)

const handleMouseOver = (active = true) => {
  if (!widget.status.isVisible || widget.locked) return;
  if (active) {
    hoverWidget.value = widget;
  } else {
    hoverWidget.value = undefined;
  }
};
const widgetRotate = computed(() => {
  if (widget.rotate.x === 0 && widget.rotate.y === 0 && widget.rotate.z === 0) return 'unset'
  return `rotateX(${widget.rotate.x}deg) rotateY(${widget.rotate.y}deg) rotateZ(${widget.rotate.z}deg)`
})
const inValidMessageTip = ref('');
const isDataInvalid = computed(()=>{
  const result = widget.status.error.data?.find(val => {
    return ["filed-empty", "filed-incomplete", "data-error"].indexOf(val.type) > -1;
  });

  if(result !== undefined){
    if(result.type === "filed-empty"){
      // 未设置数据,请在右侧窗口设置数据字段
      inValidMessageTip.value = i18next.t("b2Widget.dataNotSet") + ',' + i18next.t("b2Widget.dataSetTip")
    }else if(result.type === "filed-incomplete"){
      // 数据不完整,请在右侧窗口设置数据字段
      inValidMessageTip.value = i18next.t("b2Widget.dataIncomplete") + ',' + i18next.t("b2Widget.dataSetTip")
    }else{
      // 数据错误,请在右侧窗口检查数据字段
      inValidMessageTip.value = i18next.t("b2Widget.dataError") + ',' + i18next.t("b2Widget.dataCheckTip")
    }
    return true;
  } else{
    return false;
  }
});

const widgetBodyOverflow = computed(() => {
  return widget.status.canEditorChild ? 'visible' : props.overflow;
});

const isShowWidgetStyle = computed(() => {
  const result = widget.status.error.style?.find(val => {
    return ["panel-empty", "image-empty"].indexOf(val.type) > -1;
  });
  if(result !== undefined){
    if(result.type === "panel-empty"){  // 分组面板为空的时候
      inValidMessageTip.value = i18next.t("b2Widget.panelEmpty") + ',' + i18next.t("b2Widget.panelEmptyTip")
    }else if(result.type === "image-empty"){  // 图片未选择的时候
      inValidMessageTip.value = i18next.t("b2Widget.imageEmpty") + ',' + i18next.t("b2Widget.imageEmptyTip")
    }
    return true;
  }
  return false;
})

const titleStyle = computed<CSSProperties>(() => { 
  const titleFont = widget.getOption<OptionFontValue>("widget-font");

  return {
    fontFamily: titleFont.family,
    fontSize: titleFont.size + "px",
    color: titleFont.color as string,
    fontWeight: titleFont.bold ? 'bold' : 'normal',
    fontStyle: titleFont.italic ? 'italic' : 'normal',
    textDecoration: `${titleFont.underline ? "underline" : ""} ${titleFont["line-through"] ? "line-through" : ""}`,
    letterSpacing: widget.getOption("widget-font-spacing") + "px"
  }
});

const editingLayoutStyle = ref({});


const activeElementLocked = inject(ACTIVE_ELEMENT_LOCKED);

const hasMoved = ref(false);
const handleMouseDown = function (ev: MouseEvent) {
  ev.stopPropagation()
  if(!widget.isMoveable || widget.isPlaying || !widget.isEditable || widget.isFormMode) return;
  if (widget.locked || ev.buttons !== 1) {
    return;
  }

  const startPosition = {
    x: ev.clientX,
    y: ev.clientY,
    scrollY: widget.dom.parentElement.parentElement.scrollTop,
    left: widget.position.left,
    top: widget.position.top,
  };
  editingLayoutStyle.value = {};

  hasMoved.value = false;
  let movedDistance = 0;
  const cleanWidgetMove = useEventListener(document, 'mousemove', async (ev: MouseEvent) => {
    if (!ev.movementX && !ev.movementY) {
      return;
    }
    if (widget.parent?.layout === "fluid" || widget.isPlaying || !widget.isEditable) return;
    if (ev.buttons !== 1) return;
    if (isDraggingWidget.value !== true) {
      isDraggingWidget.value = true;
    }
    const deltaX = ev.clientX - startPosition.x;
    const deltaY = ev.clientY - startPosition.y + widget.dom.parentElement.parentElement.scrollTop - startPosition.scrollY;
    if (!hasMoved.value) {
      movedDistance = Math.sqrt(Math.pow(Math.abs(deltaX),2)+Math.pow(deltaY,2));
    }
    if(!hasMoved.value && movedDistance <= 10){
      return;
    }
    if (!hasMoved.value && movedDistance > 0) {
      hasMoved.value = true;
    }
    widget.showEditorShadow = true;
    const mLeft = startPosition.left + deltaX;
    const mTop = startPosition.top + deltaY;
    const left = Math.max(10, Math.min(mLeft, widget.parent.size.width-10-widget.size.width));
    const top = Math.max(10, mTop);
    editingLayoutStyle.value = {
      left: `${left}px`,
      top: `${top}px`,
    };
    widget.position = {left, top};
    widget.parent.container.autoArrange();
    widget.getBoard().updateHistory();
  })

  const cleanMouseUp = useEventListener(document, "mouseup", () => {
    if (isDraggingWidget.value !== false) {
      isDraggingWidget.value = false;
    }
    widget.showEditorShadow = false;
    editingLayoutStyle.value = {};
    cleanWidgetMove();
    cleanMouseUp();
  });
};
const handlePointerDown = function (ev: MouseEvent) {
  if(widget.isPlaying || !widget.isEditable || widget.isFormMode) return;
  if (widget.locked || ev.buttons !== 1) {
    return;
  }
  widget.status.pointDwonTime = Date.now();
  activeElementLocked.value = true;

  const cleanMouseUp = useEventListener(document, 'pointerup', (ev: MouseEvent) => {
    if (!isDraggingWidget.value) {
      const widgetHasSelected = selectedWidgets.value.filter(item => item === widget).length >= 1;
      if (shift.value) {
        if (widgetHasSelected) {
          selectedWidgets.value = selectedWidgets.value.filter(item => item !== widget);
        } else {
          selectedWidgets.value.push(widget);
        }
      } else {
        if (!widgetHasSelected || selectedWidgets.value.length > 1) {
          selectedWidgets.value = [widget];
        }
      }
    }
    activeElementLocked.value = false;
    cleanMouseUp();
  })
}


const canResize = computed(()=>{
  return widget.isEditable && !widget.isPlaying && !widget.isFormMode && widget.parent?.layout === "static";
});
const handleResizeMouseDown = function(ev: MouseEvent, type: "width"|"height"|"both") {
  if (widget.locked || ev.buttons !== 1) {
    return;
  }

  const startPosition = {
    x: ev.clientX,
    y: ev.clientY,
    width: widget.size.width,
    height: widget.size.height,
  };
  editingLayoutStyle.value = {};

  const cleanMouseMove = useEventListener(document, 'mousemove', async (ev: MouseEvent)=>{
    if (!ev.movementX && !ev.movementY) {
      return;
    }
    widget.showEditorShadow = true;
    const mWidth = (type !== "height") ? ev.clientX - startPosition.x + startPosition.width : startPosition.width;
    const mHeight = (type !== "width") ? ev.clientY - startPosition.y + startPosition.height : startPosition.height;
    const minWidth = widget.minGrid.width / 60 * (widget.parent.size.width-10) - 10;
    const minHeight = widget.minGrid.height * 15 - 10;
    const width = Math.max(minWidth, Math.min(mWidth, widget.parent.size.width-10-widget.position.left));
    const height = Math.max(minHeight, mHeight);
    editingLayoutStyle.value = {
      width: `${width}px`,
      height: `${height}px`,
    };
    widget.size = {width, height};
    widget.parent.container.autoArrange();
    widget.getBoard().updateHistory();
  });
  const cleanMouseUp = useEventListener(document, 'mouseup', (ev: MouseEvent) => {
    widget.showEditorShadow = false;
    editingLayoutStyle.value = {};
    cleanMouseMove();
    cleanMouseUp();
  })
}

const activeWidgetBoard = computed(() => activeWidget?.value?.getBoard());
const handlePastedWidget = inject(HANDLE_PASTED_WIDGETS, async () => ({ pastedWidgetSouls: [], pastedWidgetsUIDMap: {} }));
const cloneWidget = inject(CLONE_WIDGET, (async () => null) as any);
const projectId = inject(PROJECT_ID, '');
const handleCopyWidget = async (widget: Widget) => {
  const activeWidgetBoardId = activeWidgetBoard.value.uid
  const widgetSoul = deepClone(widget.getSoul())

  selectedWidgets.value = [];
  const res = await handlePastedWidget([widgetSoul], projectId, activeWidgetBoardId, activeWidgetBoardId);
  if (!res?.pastedWidgetSouls) return;

  for(const pastedWidgetSoul of res.pastedWidgetSouls){
    const {widgetSoul, oldUID} = pastedWidgetSoul;
    const clonedWidget = await cloneWidget(widgetSoul, oldUID, widget.parent, false);
    if (clonedWidget) selectedWidgets.value.push(clonedWidget);
  }
}

const handleDeleteWidget = async () => { 
  selectedWidgets.value = selectedWidgets.value.splice(selectedWidgets.value.indexOf(widget), 1);
  widget.remove();
}

let intersectionObserver: IntersectionObserver;
onMounted(() => {
  widget.dom = dom.value;
  widget.status.isMounted = true;
  widget.startWatchFluidSize(bodyRef);
  if(!hasWidgetMounted.value) {
    hasWidgetMounted.value = true;
  }
  intersectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        widget.status.hasEnteredView = true;
        intersectionObserver.unobserve(dom.value);
      }
    });
  });
  intersectionObserver.observe(dom.value);
});
onUnmounted(() => {
  if(!widget.getBoard().getInstancedWidget(widget.uid)){
    delete widget.dom;
    widget.status.isMounted = false;
  }
  intersectionObserver.disconnect();
});

const background = ref<Background>();
background.value = new Background(widget);

const bodyBorder = computed(() => {
  if (background.value.border.enabled) {
    return {
      border: `${background.value.border.width}px solid transparent`,
      "border-radius": `${background.value.border.radius}px`
    }
  } else {
    return {}
  }
});

watch(() => widget.getOption<boolean>("no-events"), (val) => {
  widget.noEvents.value = val;
}, {immediate: true});
// 删除mockBoard
provide(CLOSE_MOCKBOARD, (teleportId, remove=true)=>{
  widget.closeMockBoard(teleportId, remove)
})
</script>

<style lang="scss" scoped>
.b2widget {
  // pointer-events: var(--var-pointer-events-isDraggingWidget, all);
  overflow: hidden;
  pointer-events: auto;

  &.hover {
    outline: solid var(--el-color-primary-light-5);
    outline-width: 2px;
    outline-offset: 0px;
  }

  &.active {
    outline: solid var(--el-color-primary);
  }

  &.selected {
    outline: dashed var(--el-color-primary-dark-2) !important;
  }

  &.transition {
    transition: left 0.3s ease-in-out;
    transition: top 0.3s ease-in-out;
  }
  &.z-index-top {
    z-index: 999999;
  }

  &.cursor-copy{
    cursor: copy;
  }

  .b2widget-body {
    width: 100%;
    height: 100%;
    // overflow: hidden;
    .rotate-layer {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      .header {
        flex: none;
        height: 28px;
        padding: 4px 8px 0px 8px;
        line-height: 24px;
        font-size: 14px;
        font-weight: 700;
        display: flex;
        justify-content: space-between;

        .header-btn-wrapper {
          column-gap: 6px;
          display: flex;
          visibility: hidden;
          opacity: 0;
          pointer-events: none; 
          transition: opacity 0.15s;
          justify-content: space-between;
          align-items: center;
          color: var(--color-primary);
          background-color: var(--color-white);
          padding: 2px;
          border-radius: 6px;
          box-shadow: -2px 2px 8px 0px var(--border-color);
          margin-left: auto;
          &.show {
            visibility: visible;
            opacity: 1;
            pointer-events: auto;
          }

          &.designer-widget-control-wrap {
            pointer-events: all;
          }

          .icon-box {
            width: 20px;
            height: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 4px;
            transition: all 0.3s ease;     
                   
            &:hover {
              background-color: #dedfe0;
            }
          }

          .el-icon {
            cursor: var(--cursor-pointer);
          }
        }
      }
      .content-container {
        width: 100%;
        height: 100%;
        position: relative;
        flex: auto;
        min-height: 0px;

        .content {
          height: 100%;
        }
      }
    }
  }

  .b2widget-resize {
    .ew, .ns, .se {
      // background-color: red;
      position: absolute;
      right: 0px;
      bottom: 0px;
      width: 10px;
      height: 10px;
    }
    .ew {
      height: 100%;
      cursor: ew-resize;
    }
    .ns {
      width: 100%;
      cursor: ns-resize;
    }
    .se {
      cursor: se-resize;
    }
  }

  .b2widget-invalid-warpper{
    display: none;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    text-align: center;
    background-color: var(--color-white);
    // border: 1px solid var(--border-color);
    border-radius: 4px;

    .message-container{

      .message-tip{
        font-size: 12px;
        line-height: 24px;
        letter-spacing: 1px;
        white-space: pre-wrap;
        color: var(--text-color-secondary);
       }

    }
  }

  .widget-mask{
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
  }

  &.data-invalid,
  &.empty-invalid {
    .rotate-layer .content{
      filter: blur(5px);
    }
    .b2widget-invalid-warpper{
      display: flex;
    }
  }
}
</style>
