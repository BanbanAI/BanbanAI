<template>
  <div class="subform-editor" ref="subFormEditorRef" tabindex="-1" @mousedown="focusSubFormEditor" @mouseenter.stop="hoverWidget = subForm">
    <div class="columns">
      <div class="column index">
        <div class="label"></div>
        <div class="content">1</div>
      </div>
      <div class="ps-container" ref="scrollContainer">
        <div
          :class="['column-list', { dragging: insertIndex !== null }]"
          @dragover="handleDragOver"
          @drop.stop.prevent="handleDrop"
          @dragleave.prevent.stop="handleMouseleave"
        >
          <span v-if="columns.length === 0" class="tips">
            {{ $t('dragFieldsFromLeft') }}
          </span>

          <template v-for="(widget, index) in columns" :key="widget.uid">
            <div class="temporary-column" v-if="isTemporaryColumn(widget)"></div>
            <div class="column" v-else :data-uid="widget.uid"
              @mouseover.stop="handleColumnMouseOver(widget)"
              @pointerdown.capture.stop="handleColumnPointerDown($event, widget as FormElement)"
              @click.stop="handleColumnClick(widget as FormElement)"
              @dragstart="handleDragstart($event, widget as FormElement)"
              @dragend="handleDragend"
              draggable="true"
              :class="{
                'resizing-active': isResizing && resizingWidget?.uid === widget.uid,
                'resizing-left': isLeftResizing && resizingWidget?.uid === widget.uid,
                'resize-hover': isResizing,
                active: activeWidget?.uid === widget.uid,
                hover: hoverWidget?.uid === widget.uid,
                dragging: draggingWidget?.uid === widget.uid,
                error: widget.validationError
              }"
              :style="{width: `${(widget as FormElement).widthInSubForm}px`}"
            >
              <div
                class="label"
                :class="{
                'resize-hover': resizableColumn === widget.uid || (index !== 0 && leftResizableColumn === columns[index - 1].uid || isResizing),
                }"
                @mousedown="startResize($event, widget as FormElement)"
                @mousemove="handleLabelHover($event, widget as FormElement)"
              >
              <el-tooltip
                effect="light"
                :content="widget.validationError"
                placement="top-start"
                v-if="widget.validationError"
              >
                <el-icon :size="16" color="#F56C6C">
                  <i-ep-warning />
                </el-icon>
              </el-tooltip>
                <span class="required" v-if="(widget as FormElement).isRequired">*</span>
                <span class="label-content" :title="(widget as FormElement).title" :style="{color: isHiddenValue(widget) ? 'var(--text-color-secondary)' : 'var(--text-color-primary)'}">{{ (widget as FormElement).title }}</span>
                <span class="header-description-tooltip" v-if="(widget as FormElement).showDescription && (widget as FormElement).descriptionLayout === 'tooltip'">
                  <el-tooltip
                    :content="(widget as FormElement).descriptionContent" raw-content effect="light" :disabled="!(widget as FormElement).descriptionContent"
                    show-arrow placement="top" trigger="hover"
                    popper-class="header-description-tooltip-popper"
                  >
                    <el-icon size="14"><i-ven-icon-widget-form-sub-form-data-source-form-question/></el-icon>
                  </el-tooltip>
                </span>
                <!-- 被联动的字段显示图标 -->
                <el-icon v-if="widget.isLinkage" size="14" @click="showLinkageWidget(widget as FormElement, 'in')" :class="{active: widget.isLinkageHighLight === 'in'}"><i-ven-icon-widget-form-sub-form-widget-be-linkaged /></el-icon>
                <!-- 联动触发字段显示图标 -->
                <el-icon v-if="widget.isLinkageTrigger" size="14" @click="showLinkageWidget(widget as FormElement, 'out')" :class="{active: widget.isLinkageHighLight === 'out'}"><i-ven-icon-widget-form-sub-form-widget-linkage /></el-icon>
                <!-- 被显隐控制的字段显示图标 -->
                <el-icon v-if="widget.isVisibleControl" size="14" @click="showVisibleWidget(widget as FormElement, 'in')" :class="{active: widget.isVisibleHighLight === 'in'}"><i-ven-icon-widget-form-sub-form-widget-be-visibled /></el-icon>
                <!-- 显隐控制触发字段显示图标 -->
                <el-icon v-if="widget.isVisibleTrigger" size="14" @click="showVisibleWidget(widget as FormElement, 'out')" :class="{active: widget.isVisibleHighLight === 'out'}"><i-ven-icon-widget-form-sub-form-widget-visible /></el-icon>
                <el-icon v-if="isHiddenValue(widget)" style="color: var(--text-color-secondary);"><i-ep-hide /></el-icon>
              </div>
              <div class="content">
                <x-widget :widget="widget" :style="{'pointer-events': 'none', padding: '0px'}"></x-widget>
              </div>
              <div class="icons" v-show="activeWidget?.uid === widget.uid || deletingWidgetUids[widget.uid]">
                <div class="icon-box">
                  <el-icon :size="14" @click.stop.prevent="handleOpenWidgetSettings(widget)"><i-ep-setting /></el-icon>
                </div>
                <div class="icon-box">
                  <el-icon :size="14" @click.stop.prevent="handleCopyWidget(widget)"><i-ep-copy-document /></el-icon>
                </div>
                <el-popconfirm
                  width="236"
                  :title="$t('deleteFieldConfirm')"
                  :hide-after="0"
                  :hide-icon="true"
                  @show="handleDeleteShow(widget.uid)"
                  @confirm="handleConfirmDelete(widget)"
                  @hide="handleDeleteAfterHide(widget.uid)"
                >
                  <template #reference>
                    <div class="icon-box" :ref="(el) => deleteIconRefs[widget.uid] = el">
                      <el-icon :size="14"><i-ep-delete /></el-icon>
                    </div>
                  </template>
                  <template #actions="{ cancel, confirm }">
                    <el-button size="small" @click="cancel">{{ i18next.t('cancel') }}</el-button>
                    <el-button type="danger" size="small" @click="confirm">{{ i18next.t('delete') }}</el-button>
                  </template>
                </el-popconfirm>
              </div>
            </div>
          </template>
          <div v-if="columns.length != 0" style="width: 80px;">
            <!-- 空的格子 -->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, inject, ref, watch, onMounted, onUnmounted, nextTick, Ref, reactive } from 'vue';
import { SubForm } from './subForm';
import { unique } from "@common/utils/unique";
import { HOVER_WIDGET, SELECTED_WIDGETS, ACTIVE_WIDGET, CLEAN_TEMPORARY_WIDGET, HANDLE_INTO_FIELD_RECYCLE_BIN_KEY, OPEN_FORM_DESIGNER_PROPERTY_PANEL, FORM_DESIGNER_BLUEPRINT_APPLYING_READONLY } from "@renderer/types/inject";
import { FormElement } from "@renderer/b2/controllers/form";
import { WidgetSoul } from "@common/types/project";
import IEpDelete from "~icons/ep/delete";
import IEpHide from "~icons/ep/hide";
import IEpCopyDocument from "~icons/ep/copy-document";
import IEpSetting from "~icons/ep/setting";
import IEpWarning from "~icons/ep/warning";
import IVenIconWidgetLinkage from "~icons/ven-icon/widget-form-sub-form-widget-linkage";
import IVenIconWidgetBeLinkaged from "~icons/ven-icon/widget-form-sub-form-widget-be-linkaged";
import IVenIconWidgetBeVisibled from "~icons/ven-icon/widget-form-sub-form-widget-be-visibled";
import IVenIconWidgetVisible from "~icons/ven-icon/widget-form-sub-form-widget-visible";
import IVenIconDataSourceFormQuestion from "~icons/ven-icon/widget-form-sub-form-data-source-form-question";
import PerfectScrollbar from 'perfect-scrollbar'
import 'perfect-scrollbar/css/perfect-scrollbar.css'
import { throttle } from 'lodash-es';
import i18next, { $t } from "@renderer/widgets/i18next";
import { useMagicKeys } from '@vueuse/core';

type TemporaryColumn = {
  TEMPORARY: true;
  uid: string;
}

type Column = TemporaryColumn | FormElement;

const activeWidget = inject(ACTIVE_WIDGET);
const selectedWidgets = inject(SELECTED_WIDGETS);
const blueprintApplyingReadonly = inject(FORM_DESIGNER_BLUEPRINT_APPLYING_READONLY, ref(false));
const hoverWidget = inject(HOVER_WIDGET);
const cleanTemporaryWidget = inject(CLEAN_TEMPORARY_WIDGET);
const handleIntoFieldRecycleBin = inject(HANDLE_INTO_FIELD_RECYCLE_BIN_KEY);
const openFormDesignerPropertyPanel = inject(OPEN_FORM_DESIGNER_PROPERTY_PANEL);
const scrollContainer = ref<HTMLElement>()
const subFormEditorRef = ref<HTMLElement>();
const deleteIconRefs = reactive<Record<string, HTMLElement | null>>({});
const { DELETE } = useMagicKeys({
  passive: false,
});
let ps: PerfectScrollbar | null = null

const focusSubFormEditor = () => {
  subFormEditorRef.value?.focus();
};

const props = defineProps<{
  subForm: SubForm;
}>();
props.subForm.setSelectedWidgetsRef(selectedWidgets)
const deletingWidgetUids = reactive<Record<string, boolean>>({});
const pendingDeleteWidgets = reactive<Record<string, FormElement | undefined>>({});

const insertIndex = ref<number>(null);
const draggingWidget = ref<FormElement>();

const isResizing = ref(false);
const resizingWidget = ref<any>(null);
const startX = ref(0);
const startWidth = ref(0);
const minColumnWidth = 60;
const resizableColumn = ref<string>(null);
const leftResizableColumn = ref<string>(null);
const isLeftResizing = ref(false);
let stopWidthWatch:() => void | null = null;

const columns = computed(()=>{
  const columns: any[] = [ ...props.subForm.children ];
  const _index = insertIndex.value
  if (draggingWidget.value && _index !== null) {
    const index = columns.findIndex((widget)=>widget.uid === draggingWidget.value.uid);
    columns.splice(index, 1);
    columns.splice(_index, 0, draggingWidget.value);
  } else if (_index !== null) {
    columns.splice(_index, 0, {
      TEMPORARY: true,
      uid: unique(),
    })
    cleanTemporaryWidget.value.form = !cleanTemporaryWidget.value.form
    // if (cleanTemporaryWidget?.value) cleanTemporaryWidget.value.form = !cleanTemporaryWidget.value?.form
  }
  return columns as Column[];
});

watch(() => DELETE.value, (value) => {
  if (!value || blueprintApplyingReadonly.value) return;
  if (!subFormEditorRef.value?.contains(document.activeElement)) return;

  const activeWidgetUid = activeWidget?.value?.uid;
  if (!activeWidgetUid || !props.subForm.children.some(widget => widget.uid === activeWidgetUid)) return;

  deleteIconRefs[activeWidgetUid]?.click();
});

const handleColumnMouseOver = (widget: FormElement) => {
  hoverWidget.value = widget;
};

const selectColumn = (widget: FormElement) => {
  if (blueprintApplyingReadonly.value) return;

  selectedWidgets.value = [widget];
  openFormDesignerPropertyPanel?.();
};

const handleColumnPointerDown = (event: PointerEvent, widget: FormElement) => {
  if (event.button !== 0 || blueprintApplyingReadonly.value) return;

  // Disabled preview controls do not reliably emit click events. Select the
  // column at pointer-down so the designer can still open its properties.
  selectColumn(widget);
};

const handleColumnClick = (widget: FormElement) => {
  selectColumn(widget);
};

const startResize = (event: MouseEvent, widget: FormElement) => {
  const labelElement = event.target as HTMLElement;
  const rect = labelElement.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;

  if (offsetX >= rect.width - 5) {
    event.preventDefault();
    isResizing.value = true;
    resizingWidget.value = widget as FormElement;
    startX.value = event.clientX;
    startWidth.value = widget.widthInSubForm || 160;
    return;
  }

  if (offsetX <= 3) {
    event.preventDefault();
    const prevColumn = getPreviousColumn(widget);
    if (prevColumn) {
      isLeftResizing.value = true;
      resizingWidget.value = prevColumn as FormElement;
      startX.value = event.clientX;
      startWidth.value = prevColumn.widthInSubForm || 160;
    }
  }
};

const getPreviousColumn = (widget: FormElement): FormElement | null => {
  const index = props.subForm.children.findIndex(w => w.uid === widget.uid);
  return index > 0 ? props.subForm.children[index - 1] : null;
};

const isHiddenValue = (formElement: FormElement) => {
  if (formElement.isVisibleControl && !formElement.getOption<boolean>('is-hidden')) {
    return false;
  } else {
    return formElement.isHidden;
  }
}

watch(() => {
  return cleanTemporaryWidget.value.subForm
  // return cleanTemporaryWidget?.value.subForm
}, (newValue) => {
  insertIndex.value = null;
},{ deep: true });


const handleMouseMove = (event: MouseEvent) => {
  if (isResizing.value || isLeftResizing.value) {
    const deltaX = event.clientX - startX.value;
    let newWidth = startWidth.value + deltaX;

    if (newWidth < minColumnWidth) {
      newWidth = minColumnWidth;
    }

    resizingWidget.value?.setOption('width-subform', newWidth);
    return;
  }
};

const handleLabelHover = (event: MouseEvent, widget: FormElement) => {
  if (isResizing.value || isLeftResizing.value) return;

  const labelElement = event.target as HTMLElement;
  const rect = labelElement.getBoundingClientRect();
  const offsetX = event.clientX - rect.left;

  if (offsetX <= 3) {
    const prevColumn = getPreviousColumn(widget);
    leftResizableColumn.value = prevColumn?.uid || null;
    resizableColumn.value = null;
  }
  else if (offsetX >= rect.width - 5) {
    resizableColumn.value = widget.uid;
    leftResizableColumn.value = null;
  }
  else {
    resizableColumn.value = null;
    leftResizableColumn.value = null;
  }
};

const handleMouseUp = () => {
  if (isResizing.value || isLeftResizing.value) {
    isResizing.value = false;
    isLeftResizing.value = false;
    resizingWidget.value = null;
    leftResizableColumn.value = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }
};

const isTemporaryColumn = (widget: any): widget is TemporaryColumn => {
  return widget.TEMPORARY
};

const handleCopyWidget = async (widget: FormElement, uid?: string) => {
  const index = props.subForm.children.findIndex((w)=>w.uid === widget.uid);
  const soul = widget.copySoul();
  await props.subForm.addWidget(soul, index + 1);
};

const handleOpenWidgetSettings = (widget: FormElement) => {
  selectedWidgets.value = [widget];
  openFormDesignerPropertyPanel(widget.getSoul());
};

const handleDeleteShow = (uid: string) => {
  deletingWidgetUids[uid] = true;
};

const handleConfirmDelete = (widget: FormElement) => {
  pendingDeleteWidgets[widget.uid] = widget;
};

const handleDeleteAfterHide = (uid: string) => {
  delete deletingWidgetUids[uid];
  const widget = pendingDeleteWidgets[uid];
  delete pendingDeleteWidgets[uid];
  if (widget) {
    handleDeleteWidget(widget);
  }
};

const handleDeleteWidget = (widget: FormElement) => {
  // 删除前存入回收站
  const mainFormData = props.subForm.getBoard().getConnections()?.find(c => c.uid === props.subForm.topForm.tableUID?.[0]);
  const mainTable = mainFormData?.tables?.find(tableItem => tableItem.uid === props.subForm.topForm.tableUID[1]);
  const subFormTableUID = props.subForm.tableUID || mainTable?.fields?.find(fieldItem => fieldItem.meta?.uid === props.subForm.uid)?.meta?.extra?.subTableUID;
  if (subFormTableUID) {
    const subTable = props.subForm.getTable(subFormTableUID);
    handleIntoFieldRecycleBin(widget.getSoul(), subTable);
  }
  widget.detach();
  widget.destroy();
  widget.getBoard().updateHistory();
};

const handleMouseleave = (ev: DragEvent)=>{
  const target = ev.target;
  if (target !== ev.currentTarget || draggingWidget.value) return;
  insertIndex.value = null;
}

const handleDragstart = (ev: DragEvent, widget: FormElement) => {
  ev.stopPropagation();
  draggingWidget.value = widget;
}

const handleDragend = async (ev: DragEvent) => {
  ev.stopPropagation();
  if (insertIndex.value === null) return;
  await props.subForm.moveWidget(draggingWidget.value, insertIndex.value);

  draggingWidget.value = null;
  insertIndex.value = null;
}

const handleDragOver = (ev: DragEvent)=>{
  if (!draggingWidget.value && (!ev.dataTransfer.types?.includes("widget") || ev.dataTransfer.types.includes("no-drag"))) return;
  ev.preventDefault();
  const container = ev.currentTarget as HTMLElement;
  const mouseX = ev.clientX;
  const children = Array.from(container.children) as HTMLElement[];

  for (let i = 0; i < children.length; i++) {
    const rect = children[i].getBoundingClientRect();
    if (mouseX < rect.left + rect.width / 2) {
      insertIndex.value = i;
      return;
    }
  }
  insertIndex.value = children.length;
}

const handleDrop = async (ev: DragEvent)=>{
  if (!ev.dataTransfer.types?.includes("widget") || ev.dataTransfer.types.includes("no-drag")) return;
  ev.preventDefault();
  ev.stopPropagation();
  const data = ev.dataTransfer.getData("widget");
  const widgetSoul: WidgetSoul = JSON.parse(data);

  await props.subForm.addWidget(widgetSoul, insertIndex.value);
  insertIndex.value = null;
}

const initPerfectScrollbar = () => {
  if (scrollContainer.value) {
    ps = new PerfectScrollbar(scrollContainer.value, {
      wheelSpeed: 1,
      wheelPropagation: false,
      suppressScrollX: false,
      suppressScrollY: true,
      minScrollbarLength: 20
    })

    const stop = setTimeout(()=>{
      updatePerfectScrollbar();
      clearTimeout(stop);
    }, 0)
  }
}

const updatePerfectScrollbar = () => {
  nextTick(() => {
    ps?.update();
  })
}

// 添加缓动配置
const wheelConfig = {
  duration: 200, // 滚动持续时间（毫秒）
  easing: (t: number) => t * (2 - t), // easeOutQuad缓动函数
  sensitivity: 1 // 滚动灵敏度
};

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  if (ps) {
    const scrollAmount = e.deltaY * wheelConfig.sensitivity;
    const targetScrollLeft = ps.element.scrollLeft + scrollAmount;
    const maxScrollLeft = ps.element.scrollWidth - ps.element.clientWidth;
    const clampedTarget = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));

    // 使用缓动函数实现平滑滚动
    const startScrollLeft = ps.element.scrollLeft;
    const startTime = performance.now();

    const animate = () => {
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / wheelConfig.duration, 1);
      const easedProgress = wheelConfig.easing(progress);
      const newScrollLeft = startScrollLeft + (clampedTarget - startScrollLeft) * easedProgress;

      ps.element.scrollLeft = newScrollLeft;
      ps.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }
};

const throttledUpdate = throttle(updatePerfectScrollbar, 16);

const showLinkageWidget = (widget: FormElement, type) => {
  if(widget.topForm.linkageHighLightWidget.value?.uid === widget.uid && type === widget.topForm.linkageHighLightWidget.value?.type) {
    widget.topForm.linkageHighLightWidget.value = null
    return
  };
  widget.topForm.linkageHighLightWidget.value = {
    uid: widget.uid,
    type
  }
}

const showVisibleWidget = (widget: FormElement, type) => {
  if(widget.topForm.visibleHighLightWidget.value?.uid === widget.uid && type === widget.topForm.visibleHighLightWidget.value?.type) {
    widget.topForm.visibleHighLightWidget.value = null
    return
  };
  widget.topForm.visibleHighLightWidget.value = {
    uid: widget.uid,
    type
  }
}

onMounted(async() => {
  initPerfectScrollbar()

  scrollContainer.value?.addEventListener('wheel', handleWheel);

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
  stopWidthWatch = watch(() => props.subForm.children.map(col => col?.widthInSubForm), ()=>{
    const stop = setTimeout(()=>{
      updatePerfectScrollbar();
      clearTimeout(stop);
    }, 0)
  })
  window.addEventListener('resize', throttledUpdate);
});

onUnmounted(() => {
  scrollContainer.value?.removeEventListener('wheel', handleWheel);

  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('resize', throttledUpdate);
  if (stopWidthWatch) stopWidthWatch()
  if (ps) {
    ps.destroy()
    ps = null
  }
});
</script>

<style lang="scss" scoped>
.subform-editor {
  --border-color: #e6e8ed;
  --cell-default-min-height: 64px;
  display: flex;
  width: 100%;
  padding-bottom: 12px;

  .columns {
    display: flex;
    max-width: 100%;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 14px;
    position: relative;

    .ps-container {
      height: calc(100% + 20px);
      width: 100%;
      overflow-x: hidden;

      :deep(.ps__rail-x) {
        background-color: transparent !important;

        &:hover,
        &:active {
          background-color: transparent !important;
        }

        .ps__thumb-x {
          height: 10px !important;
        }
      }

      .column-list {
        display: flex;
        width: max-content;

        .tips {
          color: var(--text-color-secondary);
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 17px;
          width: 280px;
          height: var(--cell-default-min-height);
          background-color: var(--color-white);
        }

        &.dragging {
          >* {
            pointer-events: none;
          }
        }
      }
    }

    .column {
      flex: none;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--border-color);
      position: relative;

      .label {
        height: 32px;
        flex: none;
        background-color: #f0f1f4;
        padding: 4px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        align-items: center;
        margin-right: -1px;
        border-right: 1px solid var(--border-color);
        gap: 5px;

        .label-content {
          display: inline-block;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .header-description-tooltip {
          display: inline-flex;
          align-items: center;
          color: var(--text-color-secondary);
          cursor: pointer;
        }

        .el-icon {
          &.active {
            svg {
              fill: var(--color-primary);
            }
          }

          svg {
            fill: #86909C;
          }
        }

        &.resize-hover {
          cursor: col-resize !important;
        }

        .required {
          color: #eb5050;
          font-size: 14px;
          margin-right: 4px;
          font-family: "Segoe UI";
        }
      }

      .content {
        height: 100%;
        flex: auto;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        background-color: var(--color-white);

        .b2widget {
          padding: 0px;

          :deep(.b2widget-body .rotate-layer .content-container .content .content-container) {
            width: 100% !important;
          }
        }
      }

      &.index {
        width: 80px;

        &:hover {
          outline: none;
        }
      }

      outline-offset: -1px;

      &.hover {
        outline: 1px dashed var(--color-primary);
      }

      &.active {
        outline: 1px solid var(--color-primary);
        &.error {
          outline: 1px solid var(--color-danger);
        }
      }

      &.dragging {
        border: 1px dashed var(--color-primary);
      }

      &.resizing-active,
      &.resizing-left {
        border-right: 1px solid var(--color-primary);

        .label {
          border-right: 1px solid var(--color-primary);
        }

        +.column {
          border-left: 1px solid var(--color-primary);

          .label {
            padding-left: 3px;
          }

          .content {
            padding-left: 3px;
          }
        }
      }

      &.resize-hover {
        cursor: col-resize !important;
      }

      .icons {
        position: absolute;
        top: 2px;
        right: 5px;
        pointer-events: all !important;
        color: var(--color-primary);

        .icon-box {
          width: 20px;
          height: 20px;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          border-radius: 4px;

          &:hover {
            background-color: #dedfe0;
          }
        }

        .el-icon {
          cursor: var(--cursor-pointer);
        }
      }
    }

    .temporary-column {
      width: 160px;
      min-width: 160px;
      border: 1px dashed var(--color-primary);
      min-height: var(--cell-default-min-height);
    }
  }
}
</style>
