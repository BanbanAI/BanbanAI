<template>
  <div
    class="form-designer-main"
    :class="{ 'is-pointer-dragging': pointerDrag?.moved }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover.prevent
    @drop="handleDrop"
    @selectstart="handleSelectStart"
    ref="formDesignerMainRef"
  >
    <el-scrollbar>
      <el-form size="small" label-position="top" @dragleave.stop>
        <template v-for="(widget, index) in showRenderWidgets" :key="widget.uid">
          <el-form-item
            @pointerdown.capture="handlePointerDown($event, widget)"
            @dragover.prevent="handleDragOverForm($event, index, widget)"
            @dragleave="handleDragLeaveForm(widget, $event)"
            :data-form-designer-widget-uid="widget.uid"
            @click.stop.prevent="handleFormItemClick(widget.uid)"
            @mouseover.stop="handleWidgetMouseOver(widget.uid)"
            @mouseleave.stop="handleWidgetMouseLeave(widget.uid)"
            :class="{ active: activeElement?.uid === widget.uid, hover: hoverWidget?.uid === widget.uid }"
            :style="compWidgetWidth(widget.uid)"
          >
            <template #label>
              <div class="label"></div>
              <div class="icon designer-widget-control-wrap" :class="{show: activeElement?.uid === widget.uid}">
                <div class="icon-box">
                  <el-icon :size="16" @click.stop.prevent="handleOpenWidgetSettings(widget)"><i-ep-setting /></el-icon>
                </div>
                <div class="icon-box">
                  <el-icon :size="16" @click.stop.prevent="handleCopyWidget(widget)"><i-ven-form-copy /></el-icon>
                </div>
                <el-popover width="286" :hide-after="0" :hide-icon="true" trigger="click" @click.stop
                  :title="$t('FormDesignerMain.confirmDelField')" :trigger-keys="[]" :ref="(el: PopoverInstance) => deletePopoverRefs[widget.uid] = el"
                  :popper-style="{ 
                    '--el-bg-color-overlay': 'var(--bg-color-page)',
                    '--el-popover-title-text-color': 'var(--text-color-primary)', 
                    '--el-popover-title-font-size': '14px', 
                    '--el-popover-padding': '16px', 
                  }"
                >
                 <div class="content" style="margin-top: -4px;">
                    <p style="font-size: 12px; line-height: 17px;opacity: 0.7;">{{ $t('FormDesignerMain.delFieldWarn') }}</p>
                    <div style="display: flex; justify-content: flex-end; margin-top: 16px">
                      <el-button style="border-radius: 4px;" size="default" @click="handleCancelDeleteWidget(widget.uid)">{{ $t('FormDesignerMain.cancel') }}</el-button>
                      <el-button style="border-radius: 4px;" size="default" type="danger" @click="handleDeleteWidget(widget.uid)">{{ $t('FormDesignerMain.delete') }}</el-button>
                    </div>
                 </div>
                  <template #reference>
                    <div class="icon-box" :ref="(el) => deleteIconRefs[widget.uid] = el">
                      <el-icon :size="16"><i-ven-form-delete /></el-icon>
                    </div>
                  </template>
                </el-popover>
              </div>
            </template>
            <!-- <form-template v-if="widget.type !== TEMPORARY" :isReadonly="true" :type="widget.type" /> -->
            <x-widget
              v-if="widget.type !== TEMPORARY && realWidget(widget.uid)"
              :class="{ isSelectSubForm: (widget.type === SUBFORM || widget.type === MULTIPLETABS) && !isDragFormItem }"
              :widget="realWidget(widget.uid)"
            />
            <div v-else class="widget-placeholder"></div>
          </el-form-item>
        </template>
      </el-form>
    </el-scrollbar>
    <div class="empty" v-if="!renderWidgets?.length">
      <img src="@renderer/assets/image/nocode/form-empty.png" alt="">
      <p>{{ $t('FormDesignerMain.dragComponentTips') }}</p>
    </div>
    <empty-dialog v-model="dialogState.formDesignerEmptyDialogVisible" v-bind="dialogState.getArgs('formDesignerEmptyDialogVisible')"></empty-dialog>
  </div>
</template>

<script setup lang="ts">
import { ACTIVE_ELEMENT, CLEAN_TEMPORARY_WIDGET, DROP_SUCCESS, FORM_DESIGNER_BLUEPRINT_APPLYING_READONLY, HOVER_WIDGET, OPEN_FORM_DESIGNER_PROPERTY_PANEL, SELECTED_WIDGETS } from '@renderer/types';
import { ref, inject, nextTick, provide, watch, reactive, computed } from 'vue';
import { useDraggableIndex, useFormWidget, useFormWidgetRows, useIsDrag, useIsExistContainer, useRenderWidgets } from './hooks';
import { replaceUID } from '@common/utils/replace';
import { unique } from '@common/utils/unique';
import { useDialogStore } from '@renderer/stores/dialog';
import { FormElement } from '@renderer/b2/controllers/form';
import { Soul, WidgetSoul } from '@common/types/project';
import { TEMPORARY, SUBFORM, MULTIPLETABS } from './utils';
import { useMagicKeys } from '@vueuse/core';
import { PopoverInstance } from 'element-plus';
import { useEventListener } from '@vueuse/core';
import { usePointerDrag, usePointerDragClickSuppressed } from './hooks';
import type { FormPointerDragSession } from './hooks';
import { deepClone } from '@common/utils/object';

const activeElement = inject(ACTIVE_ELEMENT);
const selectedWidgets = inject(SELECTED_WIDGETS);
const hoverWidget = inject(HOVER_WIDGET);
const dropSuccess = inject(DROP_SUCCESS);
const cleanTemporaryWidget = inject(CLEAN_TEMPORARY_WIDGET);
const blueprintApplyingReadonly = inject(FORM_DESIGNER_BLUEPRINT_APPLYING_READONLY, ref(false))
const openFormDesignerPropertyPanel = inject(OPEN_FORM_DESIGNER_PROPERTY_PANEL, () => undefined)

const isExistContainer = useIsExistContainer(); //拖拽时是否在容器内
const draggableIndex = useDraggableIndex(); // 拖拽组件位置
const formWidget = useFormWidget();
const renderWidgets = useRenderWidgets(); //临时存放的表单组件
const showRenderWidgets = computed(() => {
  if(isEnterSubForm.value || dropSuccess.value) {
    return renderWidgets.value.filter((widget) => widget.type !== TEMPORARY)
  } 
  return renderWidgets.value
});
const dialogState = useDialogStore();
const emit = defineEmits<{
  (e: 'addWidget', widgetSoul: WidgetSoul, type?: 'drag' | 'click'): void;
  (e: 'moveWidget', souls: WidgetSoul[], index: number): void;
  (e: 'removeWidget', uid: string): void;
}>();

const formDesignerMainRef = ref();
const { DELETE } = useMagicKeys({
  target: formDesignerMainRef,
  passive: false,
});
const { shift } = useMagicKeys();

const deletePopoverRefs = reactive<Record<string, PopoverInstance>>({});
const deleteIconRefs = reactive({});
const realWidget = (uid: string) => {
  return formWidget.value?.widgets.find((widget) => widget.uid === uid) as FormElement;
}



let handled = false;
watch(() => DELETE.value, (val) => {
  if (blueprintApplyingReadonly.value) return;
  if (val || handled) {
    const uid = activeElement.value.uid;
    if (uid === formWidget.value.uid) return;
    const subForm = formWidget.value.widgets.find((widget) => widget.type === SUBFORM) as FormElement;
    const subFormWidgets = subForm?.widgets || [];
    if (subFormWidgets.find((widget) => widget.uid === uid)) return;
    const multipleTabs = formWidget.value.widgets.find((widget) => widget.type === MULTIPLETABS) as FormElement;
    const multipleTabsWidgets = multipleTabs?.widgets || [];
    if (multipleTabsWidgets.find((widget) => widget.uid === uid)) return;

    deleteIconRefs[uid]?.click();
  }

  if (!DELETE.value) {
    handled = false;
  }
})

const isElementInViewport = (el: Element) => {  // 检查元素是否在可视区域内
  const rect = el.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= windowHeight &&
    rect.right <= windowWidth
  );
}

const handleCheckActiveWidget = (uid: string) => {
  if (blueprintApplyingReadonly.value) {
    return;
  }
  if (!uid) {
    selectedWidgets.value = [formWidget.value];
  } else {
    const widget = formWidget.value.widgets.find((widget) => widget.uid === uid);
    if (widget) {
      if (shift.value) {
        const selectedIndex = selectedWidgets.value.findIndex((selectedWidget) => selectedWidget.uid === widget.uid);
        if (selectedIndex > -1) {
          selectedWidgets.value.splice(selectedIndex, 1);
        } else {
          selectedWidgets.value.push(widget);
        }
        return;
      }
      selectedWidgets.value = [widget];
    }
  }
}

const handleFormItemClick = (uid: string) => {
  if (pointerDragClickSuppressed?.value) {
    pointerDragClickSuppressed.value = false;
    return;
  }
  handleCheckActiveWidget(uid);
};

const handleWidgetMouseOver = (widgetId: string) => {
  if (blueprintApplyingReadonly.value || pointerDrag?.value?.moved) {
    return;
  }
  hoverWidget.value = realWidget(widgetId) as any;
}

const handleWidgetMouseLeave = (widgetId: string) => {
  if (blueprintApplyingReadonly.value) {
    hoverWidget.value = undefined;
    return;
  }
  if (hoverWidget.value?.uid === widgetId) {
    hoverWidget.value = undefined;
  }
}

const scrollTo = async () => {
  await nextTick();
  const widget = formWidget.value.widgets[draggableIndex.value];
  if (widget?.dom) {
    const isInView = isElementInViewport(widget?.dom);
    if (!isInView) {
      widget?.dom.scrollIntoView({
        behavior: 'smooth',
      });
    }
  }
}

const handleCancelDeleteWidget = (uid: string) => {
  deletePopoverRefs[uid]?.hide();
}
// 删除组件
const handleDeleteWidget = (uid: string) => {
  if (blueprintApplyingReadonly.value) {
    return;
  }
  const index = renderWidgets.value.findIndex(w => w.uid === uid);
  if (index > -1) {
    renderWidgets.value.splice(index, 1);
  }
  emit('removeWidget', uid);
};

// 复制组件
const handleCopyWidget = (widgetSoul: WidgetSoul) => {
  if (blueprintApplyingReadonly.value) {
    return;
  }
  const newSoulUidMap = ref({});
  const replaceUid = (_soul: WidgetSoul) => {
    const newUid = unique();
    newSoulUidMap.value[_soul.uid] = newUid;
    _soul.uid = newUid;
    for (const widget of _soul.widgets || []) {
      replaceUid(widget);
    }
  }
  const newSoul = deepClone(widgetSoul);
  replaceUid(newSoul);
  replaceUID(newSoul, newSoulUidMap.value);
  
  emit('addWidget', newSoul, 'click');
};

const handleOpenWidgetSettings = (widgetSoul: WidgetSoul) => {
  if (blueprintApplyingReadonly.value) {
    return;
  }
  const widget = realWidget(widgetSoul.uid);
  if (!widget) return;
  selectedWidgets.value = [widget];
  openFormDesignerPropertyPanel();
}

// Pointer 拖拽状态。超过移动阈值后才进入拖拽，保证普通点击仍然可以选择或添加字段。
const widgetSoulPlaceholderSize = ref({ // 拖拽组件占位大小
  width: 527,
  height: 60,
})

const isDragFormItem = ref(false); // 是否拖拽表单组件
const isDrag = useIsDrag();
const pointerDrag = usePointerDrag();
const pointerDragClickSuppressed = usePointerDragClickSuppressed();
const dragWidgetSoul = ref<WidgetSoul | null>(null);
const isEnterSubForm = ref(false);
const notAllowInSubFormTypes = [
  'widget.form.subform',
  'widget.form.splitLine',
  'widget.form.titleBar',
  'widget.form.imageTextShow',
  'widget.form.multipleTabs',
  'widget.form.richTextEditor',
  'widget.form.markdownEditor',
];
let pointerDragDataTransfer: DataTransfer | null = null;
let pointerDragTarget: Element | null = null;
const dragGhost = ref<HTMLElement | null>(null);
let dragAutoScrollFrame: number | null = null;
const dragAutoScrollEdge = 48;

const removePointerPlaceholder = () => {
  const temporaryIndex = renderWidgets.value.findIndex((widget) => widget.type === TEMPORARY);
  if (temporaryIndex > -1) {
    renderWidgets.value.splice(temporaryIndex, 1);
  }
};

const handlePointerDown = (event: PointerEvent, widgetSoul: WidgetSoul) => {
  if (blueprintApplyingReadonly.value || event.button !== 0 || !pointerDrag) return;
  const target = event.target as HTMLElement;
  if (target?.closest('.designer-widget-control-wrap') || target?.closest('.b2widget-resize')) return;
  if ((widgetSoul.type === SUBFORM || widgetSoul.type === MULTIPLETABS)
    && target?.closest('.tabform-editor, .subform-editor')) return;

  event.stopPropagation();
  const sourceElement = event.currentTarget as HTMLElement;
  const sourceRect = sourceElement.getBoundingClientRect();

  pointerDrag.value = {
    source: 'form',
    widgetSoul,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    moved: false,
    originIndex: renderWidgets.value.findIndex((widget) => widget.uid === widgetSoul.uid),
    sourceElement,
    offsetX: event.clientX - sourceRect.left,
    offsetY: event.clientY - sourceRect.top,
  };
};

const handleSelectStart = (event: Event) => {
  if (pointerDrag?.value) {
    event.preventDefault();
  }
};

useEventListener(document, 'selectstart', handleSelectStart);

const handlePointerDragHover = (event: MouseEvent) => {
  if (pointerDrag?.value?.moved) {
    hoverWidget.value = undefined;
    event.stopPropagation();
  }
};

useEventListener(document, 'mouseover', handlePointerDragHover, { capture: true });
useEventListener(document, 'mouseenter', handlePointerDragHover, { capture: true });

const removeDragGhost = () => {
  dragGhost.value?.remove();
  dragGhost.value = null;
};

const updateDragGhost = (session: FormPointerDragSession) => {
  if (!dragGhost.value) return;
  dragGhost.value.style.left = `${session.currentX - session.offsetX}px`;
  dragGhost.value.style.top = `${session.currentY - session.offsetY}px`;
};

const createDragGhost = (session: FormPointerDragSession) => {
  const sourceElement = session.sourceElement;
  if (!sourceElement) return;

  const sourceRect = sourceElement.getBoundingClientRect();
  const ghost = sourceElement.cloneNode(true) as HTMLElement;
  ghost.classList.add('form-drag-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.position = 'fixed';
  ghost.style.left = `${session.currentX - session.offsetX}px`;
  ghost.style.top = `${session.currentY - session.offsetY}px`;
  ghost.style.width = `${sourceRect.width}px`;
  ghost.style.height = `${sourceRect.height}px`;
  ghost.style.margin = '0';
  ghost.style.opacity = '0.5';
  ghost.style.transition = 'none';
  ghost.style.zIndex = '99999';
  ghost.style.setProperty('pointer-events', 'none', 'important');
  ghost.querySelectorAll<HTMLElement>('*').forEach((element) => {
    element.style.setProperty('pointer-events', 'none', 'important');
  });

  (sourceElement.parentElement || document.body).appendChild(ghost);
  dragGhost.value = ghost;
};

const startPointerDrag = (session: FormPointerDragSession) => {
  dropSuccess.value = false;
  hoverWidget.value = undefined;
  dragWidgetSoul.value = session.widgetSoul;
  createDragGhost(session);
  pointerDragDataTransfer = new DataTransfer();
  const dataType = session.source === 'catalog' ? 'widget' : 'formwidget';
  pointerDragDataTransfer.setData(dataType, JSON.stringify(session.widgetSoul));
  if (session.source === 'catalog' && notAllowInSubFormTypes.includes(session.widgetSoul.type)) {
    pointerDragDataTransfer.setData('no-drag', '');
  }
  if (session.source === 'catalog') {
    isDrag.value = true;
    isExistContainer.value = false;
    draggableIndex.value = renderWidgets.value.length;
    return;
  }

  isDragFormItem.value = true;
  isExistContainer.value = true;
  const sourceElement = document.querySelector<HTMLElement>(`[data-form-designer-widget-uid="${session.widgetSoul.uid}"]`);
  const rect = sourceElement?.getBoundingClientRect();
  if (rect) {
    widgetSoulPlaceholderSize.value = { width: rect.width, height: rect.height };
  }

  const index = renderWidgets.value.findIndex((widget) => widget.uid === session.widgetSoul.uid);
  if (index > -1) {
    draggableIndex.value = index;
    renderWidgets.value.splice(index, 1, { type: TEMPORARY, uid: 'temp' });
  }
};

watch(() => dropSuccess.value, (val) => {
  if (val) {
    const temporaryIndex = renderWidgets.value.findIndex((widget) => widget.type === TEMPORARY);
    if (temporaryIndex > -1) {
      renderWidgets.value.splice(temporaryIndex, 1);
    }
  } else {
    isEnterSubForm.value = false;
  }
})

const dispatchPointerDragEvent = (type: 'dragenter' | 'dragleave' | 'dragover' | 'drop', target: Element, session: FormPointerDragSession, relatedTarget: Element | null = null) => {
  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: session.currentX,
    clientY: session.currentY,
    dataTransfer: pointerDragDataTransfer,
    relatedTarget,
  });
  return !target.dispatchEvent(event);
};

const updatePointerDropTarget = (session: FormPointerDragSession) => {
  const target = document.elementFromPoint(session.currentX, session.currentY);
  if (!target) return;

  if (target !== pointerDragTarget) {
    if (pointerDragTarget) {
      dispatchPointerDragEvent('dragleave', pointerDragTarget, session, target);
    }
    dispatchPointerDragEvent('dragenter', target, session, pointerDragTarget);
    pointerDragTarget = target;
  }
  dispatchPointerDragEvent('dragover', target, session);
};

const stopDragAutoScroll = () => {
  if (dragAutoScrollFrame !== null) {
    window.cancelAnimationFrame(dragAutoScrollFrame);
    dragAutoScrollFrame = null;
  }
};

const dragAutoScrollTick = () => {
  dragAutoScrollFrame = null;
  const session = pointerDrag?.value;
  const scrollWrap = formDesignerMainRef.value?.querySelector<HTMLElement>('.el-scrollbar__wrap');
  if (!session?.moved || !scrollWrap) return;

  const rect = scrollWrap.getBoundingClientRect();
  let scrollDelta = 0;
  if (session.currentY < rect.top + dragAutoScrollEdge) {
    const distance = Math.max(0, rect.top + dragAutoScrollEdge - session.currentY);
    scrollDelta = -Math.ceil(Math.min(distance / dragAutoScrollEdge, 1) * 12);
  } else if (session.currentY > rect.bottom - dragAutoScrollEdge) {
    const distance = Math.max(0, session.currentY - (rect.bottom - dragAutoScrollEdge));
    scrollDelta = Math.ceil(Math.min(distance / dragAutoScrollEdge, 1) * 12);
  }

  if (!scrollDelta) return;
  const nextScrollTop = Math.max(0, Math.min(scrollWrap.scrollHeight - scrollWrap.clientHeight, scrollWrap.scrollTop + scrollDelta));
  if (nextScrollTop === scrollWrap.scrollTop) return;

  scrollWrap.scrollTop = nextScrollTop;
  updatePointerDropTarget(session);
  dragAutoScrollFrame = window.requestAnimationFrame(dragAutoScrollTick);
};

const updateDragAutoScroll = (session: FormPointerDragSession) => {
  if (!session.moved || dragAutoScrollFrame !== null) return;
  dragAutoScrollFrame = window.requestAnimationFrame(dragAutoScrollTick);
};

const finishPointerDrag = (event: PointerEvent) => {
  const session = pointerDrag?.value;
  if (!session || session.pointerId !== event.pointerId) return;

  const wasMoved = session.moved;
  const source = session.source;
  let dropHandled = false;
  if (wasMoved) {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (target) {
      session.currentX = event.clientX;
      session.currentY = event.clientY;
      dropHandled = dispatchPointerDragEvent('drop', target, session);
    }
  }
  if (wasMoved && source === 'form') {
    if (!dropSuccess.value) {
      removePointerPlaceholder();
      emit('moveWidget', [session.widgetSoul], Math.max(session.originIndex, 0));
    } else if (isExistContainer.value) {
      // 嵌套容器已接收组件，主画布只需移除拖拽源，不能再次插入根容器。
      removePointerPlaceholder();
      emit('moveWidget', [session.widgetSoul], -1);
    }
  } else if (!dropHandled) {
    removePointerPlaceholder();
  }

  if (pointerDragClickSuppressed && wasMoved) {
    pointerDragClickSuppressed.value = true;
    window.setTimeout(() => {
      pointerDragClickSuppressed.value = false;
    }, 0);
  }
  isDrag.value = false;
  isDragFormItem.value = false;
  isExistContainer.value = false;
  dragWidgetSoul.value = null;
  isEnterSubForm.value = false;
  hoverWidget.value = undefined;
  widgetSoulPlaceholderSize.value = { width: 527, height: 60 };
  pointerDragDataTransfer = null;
  pointerDragTarget = null;
  removeDragGhost();
  stopDragAutoScroll();
  pointerDrag.value = null;
};

useEventListener(document, 'pointermove', (event: PointerEvent) => {
  const session = pointerDrag?.value;
  if (!session || session.pointerId !== event.pointerId || event.buttons !== 1) return;
  session.currentX = event.clientX;
  session.currentY = event.clientY;
  if (!session.moved) {
    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (distance < 5) return;
    session.moved = true;
    window.getSelection()?.removeAllRanges();
    startPointerDrag(session);
  }
  hoverWidget.value = undefined;
  updateDragGhost(session);
  updatePointerDropTarget(session);
  updateDragAutoScroll(session);
});
useEventListener(document, 'wheel', () => {
  const session = pointerDrag?.value;
  if (!session?.moved) return;
  window.requestAnimationFrame(() => {
    const currentSession = pointerDrag?.value;
    if (currentSession?.moved) {
      updatePointerDropTarget(currentSession);
    }
  });
});
useEventListener(document, 'pointerup', finishPointerDrag);
useEventListener(document, 'pointercancel', finishPointerDrag);

// 在容器内移动不重复触发enter和leave
const isLeavingContainer = (e: DragEvent) => {
  const relatedTarget = e.relatedTarget as HTMLElement;
  const target = e.currentTarget as HTMLElement;

  return !relatedTarget || !target.contains(relatedTarget);
}

const handleDragEnter = (e: DragEvent) => {
  if (!isLeavingContainer(e) && !isEnterSubForm.value) return;
  if (!isDragFormItem.value && !e.dataTransfer?.types?.includes('widget') && !e.dataTransfer?.types?.includes('panelwidget') && !e.dataTransfer?.types?.includes('formwidget')) return;
  draggableIndex.value = renderWidgets?.value?.length || 0;
  // isEnterSubForm.value = false;
};

watch(() => cleanTemporaryWidget.value.form, (val) => {
  const temporaryIndex = renderWidgets.value.findIndex((widget) => widget.type === TEMPORARY);
  if (temporaryIndex > -1) {
    renderWidgets.value.splice(temporaryIndex, 1);
  }
}, { deep: true })

const handleDragLeave = (e: DragEvent) => {
  if (isDragFormItem.value  || !isLeavingContainer(e)) return;

  const temporaryIndex = renderWidgets.value.findIndex((widget) => widget.type === TEMPORARY);
  if (temporaryIndex > -1) {
    renderWidgets.value.splice(temporaryIndex, 1);
  }
};

const dragMousePosition = ref({ x: 0, y: 0 });
const updateDragOverForm = (clientX: number, clientY: number, index: number, widget: Soul, force = false) => {
  // 避免重复触发
  if (!force && dragMousePosition.value.x === clientX && dragMousePosition.value.y === clientY) return;
  dragMousePosition.value = { x: clientX, y: clientY };

  if (index === draggableIndex.value && widget.type !== SUBFORM && widget.type !== MULTIPLETABS) return;
  draggableIndex.value = index;

  const temporaryIndex = renderWidgets.value.findIndex((widget) => widget.type === TEMPORARY);
  if (temporaryIndex > -1) {
    renderWidgets.value.splice(temporaryIndex, 1);
  }

  if ((widget.type === SUBFORM && !isDragFormItem.value) || (widget.type === MULTIPLETABS)) {
    return;
  }
  cleanTemporaryWidget.value.subForm = !cleanTemporaryWidget.value.subForm;
  renderWidgets.value.splice(draggableIndex.value, 0, { type: TEMPORARY, uid: 'temp' });
};

const handleDragOverForm = (e: DragEvent, index: number, widget: Soul) => {
  if (!isLeavingContainer(e)) return;
  if (!isDragFormItem.value && !e.dataTransfer?.types?.includes('widget') && !e.dataTransfer?.types?.includes('panelwidget') && !e.dataTransfer?.types?.includes('formwidget')) return;

  updateDragOverForm(e.clientX, e.clientY, index, widget);
};

const handleDragLeaveForm = (widget: Soul, e: DragEvent) => {
  if (!isLeavingContainer(e)) return;
  if (!isDragFormItem.value && !e.dataTransfer?.types?.includes('widget') && !e.dataTransfer?.types?.includes('panelwidget') && !e.dataTransfer?.types?.includes('formwidget')) return;

  if ((widget.type !== SUBFORM && widget.type !== MULTIPLETABS) || isDragFormItem.value) return;

  const rect = e.currentTarget?.getBoundingClientRect();
  const mouseY = e.clientY;

  if (mouseY >= rect.bottom) { //从下边移出 form-item
    draggableIndex.value += 1;
  } else if (mouseY <= rect.top) { //从上边移出 form-item
    draggableIndex.value = draggableIndex.value;
  } else {
    //从左右边移出 form-item
    return
  }
  const temporaryIndex = renderWidgets.value.findIndex((widget) => widget.type === TEMPORARY);
  if (temporaryIndex > -1) {
    renderWidgets.value.splice(temporaryIndex, 1);
  }
  cleanTemporaryWidget.value.subForm = !cleanTemporaryWidget.value.subForm;
  renderWidgets.value.splice(draggableIndex.value, 0, { type: TEMPORARY, uid: 'temp' });
  isEnterSubForm.value = false;
};

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  dropSuccess.value = true;
  if (isExistContainer.value && !e.dataTransfer?.types?.includes('panelwidget') && !e.dataTransfer?.types?.includes('formwidget')) return;
  isDragFormItem.value = false;
  const temporaryIndex = renderWidgets.value.findIndex((widget) => widget.type === TEMPORARY);
  if (temporaryIndex > -1) {
    renderWidgets.value.splice(temporaryIndex, 1);
  }
  
  const widgetSoulJson = e.dataTransfer?.getData('widget') || e.dataTransfer?.getData('panelwidget') || e.dataTransfer?.getData('formwidget');

  let newWidgetSoul: WidgetSoul;
  if (widgetSoulJson) {
    newWidgetSoul = JSON.parse(widgetSoulJson);
  } else {
    newWidgetSoul = dragWidgetSoul.value;
  }

  if (newWidgetSoul) {
    // 表单内与其他组件交换位置（这是原来就在表单内的组件的拖拽）
    if (e.dataTransfer?.types?.includes('formwidget') && !isEnterSubForm.value) {
      isExistContainer.value = false;

      if (dragWidgetSoul.value) {
        emit("moveWidget", [dragWidgetSoul.value], temporaryIndex);
      }
      return
    }
    // 原本不是表单内的组件需要添加
    emit('addWidget', newWidgetSoul, 'drag');
  }
};

watch(() => isDrag.value, (val) => {
  if (!val) {
    const temporaryIndex = renderWidgets.value.findIndex((widget) => widget.type === TEMPORARY);
    if (temporaryIndex > -1) {
      renderWidgets.value.splice(temporaryIndex, 1);
    }
  }
})

// 生成 widget 的行布局
const createWidgetRows = (widgets: FormElement[]) => {
  let rows: FormElement[][] = [];
  let currentRow: FormElement[] = [];
  let currentWidth = 0;

  for (const widget of widgets || []) {
    const widthRatio = widget.widthRatio;
    if ((currentWidth + widthRatio) > 1) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }
    currentRow.push(widget);
    currentWidth += widthRatio;
  }

  // 处理最后一行
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
};

// 响应表单数据变化
const formWidgetRows = useFormWidgetRows();
watch(
  () => renderWidgets.value,
  async (val) => {
    await nextTick();
    if (!val) return;
    const res = createWidgetRows(formWidget.value?.widgets as FormElement[]);
    formWidgetRows.value = res;
  },
  { deep: true, immediate: true }
);

const compWidgetWidth = (uid: string) => {
  if (!formWidgetRows.value) return {};
  for (const widgets of formWidgetRows.value) {
    const widget = widgets.find(w => w.uid === uid);
    if (widget) {
      const widthRatio = widget.widthRatio;
      return {
        width: `${widthRatio * 100}%`,
      };
    }
  }
  return {};
};

defineExpose({
  scrollTo,
})
</script>

<style scoped lang="scss">
.form-designer-main {
  width: 100%;
  height: 100%;
  padding: 5px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: rgba(0, 0, 0, 0.08) 0px 4px 16px 1px;
  position: relative;

  :deep(.el-scrollbar) {
    .el-form {
      display: flex;
      flex-wrap: wrap;
      row-gap: 20px;

      .el-form-item {
        transition: width 0.5s ease-in-out;
        cursor: pointer;
        position: relative;
        margin: 0;
        z-index: 99;

        .icon {
          column-gap: 6px;
          display: flex;
          visibility: hidden;
          opacity: 0;
          justify-content: space-between;
          align-items: center;
          color: var(--color-primary);
          background-color: var(--color-white);
          padding: 2px;
          border-radius: 6px;
          box-shadow: -2px 2px 8px 0px var(--border-color);
          transition: opacity 0.15s;

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

        .show {
          visibility: visible;
          opacity: 1;
        }

        outline-offset: -2px;
        &.hover {
          outline: 2px dashed var(--color-primary);
          .icon {
            visibility: visible;
            opacity: 1;
          }
          .form-design .background{
            background-color: var(--bg-color-overlay) !important;
          }
        }
        &.active {
          outline: 2px solid var(--color-primary);

          .form-design .background{
            background-color: var(--bg-color-overlay) !important;
          }
        }

        .el-form-item__label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          pointer-events: none;
          position: absolute;
          right: 0;
          top: 6px;
          z-index: 99;
          margin: 0;
          .label {
            color: #fff;
          }
        }

        .el-form-item__content {
          width: 100%;
          padding: 2px;
          >.b2widget {
            position: unset !important;
            pointer-events: v-bind("(isDrag && !isDragFormItem) ? 'unset' : 'none'") !important;
            outline: none !important;
            width: 100% !important;

            .el-upload {
              pointer-events: none !important;
            }

            .el-input__prefix-inner {
              pointer-events: none !important;
            }

            .b2widget-resize {
              display: none !important;
            }
          }

          .isSelectSubForm {
            pointer-events: unset !important;
          }
        }
      }

      .el-form-item:has(.widget-placeholder) {
        width: 100%;
        height: v-bind("widgetSoulPlaceholderSize.height + 'px'");
        border: 1px dashed var(--color-primary);
      }
    }

    .el-scrollbar__bar {
      z-index: 9999;
    }
  }

  &.is-pointer-dragging {
    :deep(.el-scrollbar .el-form .el-form-item.hover:not(.form-drag-ghost)) {
      outline: none !important;

      .icon {
        visibility: hidden;
        opacity: 0;
      }
    }
  }

  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    row-gap: 10px;
    pointer-events: none;
    color: var(--text-color-secondary);

    img {
      width: 160px;
    }
  }
}
</style>
