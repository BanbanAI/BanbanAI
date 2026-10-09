<template>
  <div class="tabform-editor" @mouseenter.stop="hoverWidget = widget">
    <div class="tabform-drage-box"
      :class="[{ dragging: insertIndex !== null }]"
      @dragover.stop.prevent="handleDragOver"
      @drop.stop.prevent="handleDrop"
      @dragleave.stop.prevent="handleMouseleave"
      @dragenter.stop="handleDragEnter"
      @dragend.stop="handleDragend"
    >
      <div v-if="tabPanelItems.length === 0" class="tips">{{ $t('dragFieldsFromLeft') }}</div>
      <el-form v-else size="small" label-position="top" class="tab-list">
        <template v-for="(widget, index) in tabPanelItems" :key="widget.uid">
          <el-form-item
            :draggable="true"
            class="panel-form-item"
            @mouseover.stop="hoverWidget = (widget as any)"
            @click.stop="handleSelectWidget(widget as FormElement)"
            @dragstart.stop="handleDragstart($event, widget as FormElement)"
            @dragend.stop="handleDragend"
            @dragover.stop.prevent="handleDragOverForm($event, index, widget as FormElement)"
            @dragleave.stop="handleDragLeaveForm($event, index, widget as FormElement)"
            :class="{
              active: activeWidget?.uid === widget.uid,
              hover: hoverWidget?.uid === widget.uid,
              dragging: draggingWidget?.uid === widget.uid,
            }"
          :style="compWidgetWidth(widget.uid)">
            <div class="temporary-column" v-if="isTemporaryColumn(widget)"></div>
            <div class="content" v-else>
              <x-widget :widget="widget" :style="{'pointer-events': 'none'}" :class="{ isSelectSubForm: (widget.type === SUBFORM || widget.type === MULTIPLETABS) && !isDragFormItem }"></x-widget>
              <div class="icons" v-if="activeWidget?.uid === widget.uid">
                <div class="icon-box">
                  <el-icon
                    :size="14"
                    @click.stop.prevent="handleOpenWidgetSettings(widget as FormElement)"
                    ><i-ep-setting
                  /></el-icon>
                </div>
                <div class="icon-box">
                  <el-icon
                    :size="14"
                    @click.stop.prevent="handleCopyWidget(widget as FormElement)"
                    ><i-ep-copy-document
                  /></el-icon>
                </div>
                <el-popover width="286" :hide-after="0" :hide-icon="true" trigger="click" @click.stop
                  :title="$t('confirmDeleteFieldTitle')" :trigger-keys="[]" :ref="(el: PopoverInstance) => deletePopoverRefs[widget.uid] = el"
                  :popper-style="{
                    '--el-bg-color-overlay': 'var(--bg-color-page)',
                    '--el-popover-title-text-color': 'var(--text-color-primary)',
                    '--el-popover-title-font-size': '14px',
                    '--el-popover-padding': '16px',
                  }"
                >
                 <div class="content" style="margin-top: -4px;">
                    <p style="font-size: 12px; line-height: 17px;opacity: 0.7;">{{ $t('deleteFieldImpact') }}</p>
                    <div style="display: flex; justify-content: flex-end; margin-top: 16px">
                      <el-button style="border-radius: 4px;" size="default" @click="handleCancelDeleteWidget(widget.uid)">{{ $t('cancel') }}</el-button>
                      <el-button style="border-radius: 4px;" size="default" type="danger" @click="handleDeleteWidget(widget)">{{ $t('delete') }}</el-button>
                    </div>
                 </div>
                  <template #reference>
                    <div class="icon-box" :ref="(el) => handleDeleteWidget[widget.uid] = el">
                      <el-icon :size="16"><i-ep-delete /></el-icon>
                    </div>
                  </template>
                </el-popover>
              </div>
            </div>
          </el-form-item>
        </template>
      </el-form>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { unique } from "@common/utils/unique";
import { useWidget } from "@renderer/b2/types";
import { ACTIVE_WIDGET, HOVER_WIDGET, SELECTED_WIDGETS, DROP_SUCCESS, CLEAN_TEMPORARY_WIDGET, HANDLE_INTO_FIELD_RECYCLE_BIN_KEY, OPEN_FORM_DESIGNER_PROPERTY_PANEL } from "@renderer/types/inject";
import { FormElement } from "@renderer/b2/controllers/form";
import { WidgetSoul } from "@common/types/project";
import { deepClone, isEmpty } from "@common/utils/object";
import { computed, inject, nextTick, reactive, ref, watch } from "vue";
import { MultipleTabs } from "./multipleTabs";
import IEpDelete from "~icons/ep/delete";
import IEpCopyDocument from "~icons/ep/copy-document";
import { MULTIPLETABS, SUBFORM } from "./type";
import IEpSetting from "~icons/ep/setting";
import { PopoverInstance } from "element-plus";
import i18next, { $t } from "@renderer/widgets/i18next";

type TemporaryColumn = {
  TEMPORARY: true;
  uid: string;
  type?: 'temporary',
};
type tabPanelItem = TemporaryColumn | FormElement;

const activeWidget = inject(ACTIVE_WIDGET);
const selectedWidgets = inject(SELECTED_WIDGETS);
const hoverWidget = inject(HOVER_WIDGET);
const dropSuccess = inject(DROP_SUCCESS);
const cleanTemporaryWidget = inject(CLEAN_TEMPORARY_WIDGET);
const handleIntoFieldRecycleBin = inject(HANDLE_INTO_FIELD_RECYCLE_BIN_KEY);
const openFormDesignerPropertyPanel = inject(OPEN_FORM_DESIGNER_PROPERTY_PANEL);
watch(() => dropSuccess.value, async (newVal) => {
  if(skipWatch.value) return;
  if(newVal) {
    isDragFormItem.value = false;
    widgetSoulPlaceholderSize.value = {
      width: 527,
      height: 60,
    }

    // 组件移出选项卡删除
    if (draggingWidget.value && hoverWidget.value.uid !== draggingWidget.value.parent.uid && !isMoveWidget.value) {
      widget.tabPanel.container.removeWidget(draggingWidget.value.uid);
      draggingWidget.value = null;
      insertIndex.value = null;
      return
    }
    if (insertIndex.value === null) return;
    await widget.tabPanel.moveWidget(draggingWidget.value, insertIndex.value);

    isMoveWidget.value = false
    draggingWidget.value = null;
    insertIndex.value = null;
  }
})

watch(() => cleanTemporaryWidget.value.subForm, (newVal) => {
  insertIndex.value = null;
})

const widget = useWidget<MultipleTabs>();
const insertIndex = ref<number>(null);
const draggingWidget = ref<FormElement>();
const deletePopoverRefs = reactive<Record<string, PopoverInstance>>({});

widget.useHandleIntoFieldRecycleBin(handleIntoFieldRecycleBin);
// 强制tabPanelItems触发依赖更新
const forceUpdateFlag = ref(false);
const tabPanelItems = computed(() => {
  forceUpdateFlag.value;

  let tabPanelItems: any[] = widget.tabPanel !== undefined ? [...widget.tabPanel.children] : [];

  if (isEnterSubForm.value && !isDragFormItem.value) return tabPanelItems as tabPanelItem[];

  // 组件移出选项卡阻止占位符生成
  if (isLeavedMultiple.value) return tabPanelItems as tabPanelItem[];

  if (isEnterSubForm.value) {
    const temporaryIndex = tabPanelItems.findIndex((w) => w.TEMPORARY);
    if(temporaryIndex > -1) {
      tabPanelItems.splice(temporaryIndex, 1);
      insertIndex.value = temporaryIndex;
      cleanTemporaryWidget.value.form = !cleanTemporaryWidget.value.form
    }
    isEnterSubForm.value = false
    return tabPanelItems as tabPanelItem[];
  }

  if (draggingWidget.value && insertIndex.value !== null) {
    const index = tabPanelItems.findIndex((widget) => widget.uid === draggingWidget.value.uid);
    if (index > -1) {
      // 调换两个元素的位置(这里被拖动的元素通过高亮框体现位置)
      tabPanelItems.splice(index, 1);
    }
    tabPanelItems.splice(insertIndex.value, 0, {
      TEMPORARY: true,
      uid: unique(),
    });
  } else if (insertIndex.value !== null) {
    tabPanelItems.splice(insertIndex.value, 0, {
      TEMPORARY: true,
      uid: unique(),
    });
  }

  isEnterSubForm.value = false

  if(dropSuccess.value) {
    const temporaryIndex = tabPanelItems.findIndex((w) => w.TEMPORARY);
    if(temporaryIndex > -1) {
      tabPanelItems.splice(temporaryIndex, 1);
    }
  };

  return tabPanelItems as tabPanelItem[];
});

const isTemporaryColumn = (widget: any): widget is TemporaryColumn => {
  return widget.TEMPORARY;
};

// 拖拽移动表单组件位置
const widgetSoulPlaceholderSize = ref({ // 拖拽组件占位大小
  width: 527,
  height: 60,
})

const handleCancelDeleteWidget = (uid: string) => {
  deletePopoverRefs[uid]?.hide();
}

// 在容器内移动不重复触发enter和leave
const isLeavingContainer = (ev: DragEvent) => {
  const relatedTarget = ev.relatedTarget as HTMLElement;
  const target = ev.currentTarget as HTMLElement;

  return !relatedTarget || !target.contains(relatedTarget);
}

const handleCopyWidget = (_widget: FormElement) => {
  const soul = _widget.copySoul();
  const index = _widget.parent.children.findIndex((w) => w.uid === _widget.uid);
  widget.tabPanel.addWidget(soul, index + 1);
};

const handleOpenWidgetSettings = (_widget: FormElement) => {
  selectedWidgets.value = [_widget];
  openFormDesignerPropertyPanel(_widget.getSoul());
};

const handleSelectWidget = (_widget: FormElement) => {
  selectedWidgets.value = [_widget];

  if (_widget.type !== "widget.form.relatedData") return;

  const relatedDataWidget = _widget as FormElement & {
    connectionTable?: string[];
    showConnectionTableDialog?: () => void;
    showSelectDataDialog?: () => void;
  };

  if (isEmpty(relatedDataWidget.connectionTable)) {
    relatedDataWidget.showConnectionTableDialog?.();
    return;
  }

  relatedDataWidget.showSelectDataDialog?.();
};

const handleDeleteWidget = (_widget: FormElement) => {
  const deleteWidget = widget.tabPanel.container.removeWidget(_widget.uid);
  handleIntoFieldRecycleBin(deleteWidget, widget.mainTable);
};

let debounceTimer: any = null;
const handleDragEnter = (ev: DragEvent) => {
  if (debounceTimer) clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    if (widget.tabPanel.uid === draggingWidget.value?.parent.uid && isleaveChildrenMultiple.value) {
      ev.stopPropagation();
      isEnterSubForm.value = false;
      isLeavedMultiple.value = false;
      forceUpdateFlag.value = !forceUpdateFlag.value;
    }
    debounceTimer = null;
  }, 100);
}

const isLeavedMultiple = ref(false)
const handleMouseleave = (ev: DragEvent) => {
  if(!isLeavingContainer(ev) && !isEnterSubForm.value) return;

  const temporaryIndex = tabPanelItems.value.findIndex((w: TemporaryColumn) => w.TEMPORARY);
  if (temporaryIndex > -1) {
    tabPanelItems.value.splice(temporaryIndex, 1);
  }

  // 组件移出组件选项卡中不显示，在handleDragend最终删除
  isLeavedMultiple.value = true
  if (draggingWidget.value && hoverWidget.value.uid !== draggingWidget.value.parent.uid) {
    const draggingWidgetIndex = tabPanelItems.value.findIndex((w) => w.uid === draggingWidget.value.uid);
    if (draggingWidgetIndex > -1) {
      tabPanelItems.value.splice(draggingWidgetIndex, 1);
    }
    insertIndex.value = null;
    return
  }

  insertIndex.value = null;
};

const handleDragstart = (ev: DragEvent, widget: FormElement) => {
  ev.stopPropagation();
  dropSuccess.value = false;
  isDragFormItem.value = true;
  draggingWidget.value = widget;
  const widgetSoulJson = JSON.stringify(widget.getSoul());
  ev.dataTransfer?.setData("panelwidget", widgetSoulJson);

  if (ev.target instanceof HTMLElement) {
    const { width, height } = ev.target.getBoundingClientRect();
    widgetSoulPlaceholderSize.value = { width, height };
  }
};

const skipWatch = ref(false);

const handleDragend = async (ev: DragEvent) => {
  if(!dropSuccess.value) {
    skipWatch.value = true;

    nextTick(() => {
      dropSuccess.value = true;
    })
    forceUpdateFlag.value = !forceUpdateFlag.value;
    setTimeout(() => {
      skipWatch.value = false;
    }, 0)
    insertIndex.value = null;
    return
  }
  isDragFormItem.value = false;
  ev.stopPropagation();
  widgetSoulPlaceholderSize.value = {
    width: 527,
    height: 60,
  }

  // 组件移出选项卡删除
  if (draggingWidget.value && hoverWidget.value.uid !== draggingWidget.value.parent.uid && !isMoveWidget.value) {
    widget.tabPanel.container.removeWidget(draggingWidget.value.uid);
    draggingWidget.value = null;
    insertIndex.value = null;
    return
  }
  if (insertIndex.value === null) return;
  await widget.tabPanel.moveWidget(draggingWidget.value, insertIndex.value);

  isMoveWidget.value = false
  draggingWidget.value = null;
  insertIndex.value = null;
};

const isDragFormItem = ref(false); // 是否拖拽选项卡内的表单组件
const isEnterSubForm = ref(false);
const handleDragOverForm = (ev: DragEvent, _index: number, _curHoverWidget: FormElement) => {
  if(!isLeavingContainer(ev)) return
  if (isTemporaryColumn(_curHoverWidget)) return;

  if ((_curHoverWidget.getSoul().type === SUBFORM && !isDragFormItem.value) || _curHoverWidget.getSoul().type === MULTIPLETABS) {
    isEnterSubForm.value = true;
    isleaveChildrenMultiple.value = false;

    // 在内部拖拽到选项卡时本身暂时隐藏，handleDragend才进行删除
    if (_curHoverWidget.getSoul().type === MULTIPLETABS && _curHoverWidget.getSoul().uid !== draggingWidget.value?.parent?.uid) {
      if (draggingWidget.value && hoverWidget.value.uid !== draggingWidget.value?.parent?.uid) {
        const draggingWidgetIndex = tabPanelItems.value.findIndex((w) => w.uid === draggingWidget.value?.uid);
        if (draggingWidgetIndex > -1) {
          tabPanelItems.value.splice(draggingWidgetIndex, 1);
        }
        insertIndex.value = null;
      }
    }
    return;
  }
  if (_curHoverWidget.getSoul().type !== MULTIPLETABS && widget.tabPanel.uid === draggingWidget.value?.parent?.uid) {
    insertIndex.value = -1;
  }
}

const isleaveChildrenMultiple = ref(false)
const handleDragLeaveForm = (ev: DragEvent, _index: number, _curHoverWidget: FormElement) => {
  if(!isLeavingContainer(ev)) return
  if (isTemporaryColumn(_curHoverWidget)) return;

  if (!isDragFormItem.value && !ev.dataTransfer?.types?.includes('widget') && !ev.dataTransfer?.types?.includes('formwidget') && !ev.dataTransfer?.types?.includes('panelwidget')) return;
  if (isDragFormItem.value && _curHoverWidget.getSoul().type === MULTIPLETABS &&_curHoverWidget.getSoul().uid !== draggingWidget.value.parent.uid) {
    isEnterSubForm.value = false;
    isleaveChildrenMultiple.value = true;
  }
  if ((_curHoverWidget.getSoul().type !== SUBFORM && _curHoverWidget.getSoul().type !== MULTIPLETABS) || isDragFormItem.value) return;

  isEnterSubForm.value = false;
}

const handleDragOver = (ev: DragEvent) => {
  if(!isLeavingContainer(ev) && isEnterSubForm.value) return
  if (!draggingWidget.value && !ev.dataTransfer.types?.includes("widget") && !ev.dataTransfer?.types?.includes('formwidget') && !ev.dataTransfer?.types?.includes('panelwidget')) return;
  ev.preventDefault();
  isLeavedMultiple.value = false

  const container = ev.currentTarget as HTMLElement;
  const mouseY = ev.clientY;
  const _children = Array.from(container.children[0].children) as HTMLElement[];

  for (let i = 0; i < _children.length; i++) {
    const rect = _children[i].getBoundingClientRect();
    if (mouseY < rect.top + rect.height / 2) {
      insertIndex.value = i;
      cleanTemporaryWidget.value.form = !cleanTemporaryWidget.value.form
      return;
    }
  }
  insertIndex.value = _children.length + 1;
  cleanTemporaryWidget.value.form = !cleanTemporaryWidget.value.form
};

const isMoveWidget = ref(false) // 在被拖拽的组件所在的选项卡内部移动
const handleDrop = async (ev: DragEvent) => {
  dropSuccess.value = true

  ev.preventDefault();
  ev.stopPropagation();

  if (!ev.dataTransfer.types?.includes("widget") && !ev.dataTransfer?.types?.includes('formwidget') && !ev.dataTransfer?.types?.includes('panelwidget')) return;
  isDragFormItem.value = false;
  const data = ev.dataTransfer.getData("widget") || ev.dataTransfer.getData("formwidget") || ev.dataTransfer.getData("panelwidget");
  const widgetSoul: WidgetSoul = JSON.parse(data);
  if (ev.dataTransfer?.types?.includes('panelwidget') && widget.tabPanel.widgets.findIndex(panelWidgetItem => panelWidgetItem.uid === widgetSoul.uid) > -1) {
    isMoveWidget.value = true
    return
  }
  let soul = widgetSoul;
  const dropWidget = widget.topForm.getChildElement(soul.uid);
  if (dropWidget) {
    // 跨容器移动时先从原容器摘除，避免目标容器和源容器同时持有同一个 UID。
    if (ev.dataTransfer.types.includes('formwidget') && dropWidget.parent !== widget.tabPanel) {
      soul = dropWidget.detach() as WidgetSoul;
    } else {
      soul = dropWidget.getSoul();
    }
  }
  const addedWidget = await widget.tabPanel.addWidget(soul, insertIndex.value);
  if (addedWidget) {
    selectedWidgets.value = [addedWidget as FormElement];
  }
  insertIndex.value = null;
};

// 计算面板内组件宽
const compWidgetWidth = (uid: string) => {
  const widget = tabPanelItems.value.find(item => item.uid === uid);
  if (widget) {
    const widthRatio = (widget as FormElement).widthRatio;
    return {
      width: `${widthRatio * 100}%`,
    };
  }
  return {
    width: "100%",
  };
};
</script>

<style lang="scss" scoped>
.tabform-editor {
  width: 100%;
  min-height: 228px;

  .tabform-drage-box {
    position: relative;
    width: 100%;
    min-height: 228px;
    padding: 8px;

    &.dragging {
      > * {
        pointer-events: none;
      }
    }
    .tips {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      row-gap: 10px;
    }
    .tab-list {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      .panel-form-item {
        width: 100%;
        transition: width 0.5s ease-in-out;
        cursor: pointer;
        position: relative;
        margin: 0;
        z-index: 99;
        pointer-events: all;
        .temporary-column {
          width: 100%;
          height: v-bind("widgetSoulPlaceholderSize.height + 'px'");
          border: 1px dashed var(--color-primary);
        }
        :deep(.content) {
          outline-offset: -1px;
          position: relative;
          width: 100%;
          &.hover {
            outline: 1px dashed var(--color-primary);
          }
          &.active {
            outline: 1px solid var(--color-primary);
          }

          &.dragging {
            border: 1px dashed var(--color-primary);
          }
          .icons {
            position: absolute;
            top: 2px;
            right: 2px;
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

            .isSelectSubForm {
              pointer-events: unset !important;
            }
          }
        }
      }
    }
  }
}
</style>
