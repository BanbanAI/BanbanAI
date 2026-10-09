<template>
  <el-scrollbar class="layer" ref="vnScrollDom" @dragenter="$event.preventDefault()" @dragover="$event.preventDefault()">
    <el-tree ref="widgetCatalogDom" draggable class="catalog-tree" :class="isDragging ? 'is-dragging' : ''" :data="widgetLists" :allow-drag="allowDragFn" node-key="uid" :indent="12"
      :allow-drop="allowDropFn" :props="{...defaultProps, class: customNodeClass}" :check-on-click-node="true" :expand-on-click-node="false"
      @node-expand="nodeExpandFn" @node-collapse="nodeCollapseFn" :default-expanded-keys="expandedKeys" :auto-expand-parent="false"
      @node-click="checkedWidget" @node-contextmenu.stop="handleContextMenuShow" @node-drag-start="dragstart" 
      @mouseleave="handleMouseOver(false)" @node-drag-end="drop" empty-text="">
      <template #default="{ node, data }">
        <div class="catalog-widget" @mouseover="handleMouseOver(true, data.widget)"
        :class="[{ 'catalog-widget-hover': hoverWidget?.uid === data.widget.uid, 'visible-false': data.isHide } ]" :ref="(el: HTMLDivElement)=>{divContentEls[data.widget.uid]=el}">
          <div class="catalog-widget-content">
            <div class="item-title" @dblclick="startRename($event, data.widget)"
              :class="{
                'is_hover' : (data.widget.status.isHover || data.widget.locked || !data.widget.enabled),
                'is-g2': (passportState.user.staff && data.widget.type.indexOf('widget.g2.') !== -1),
              }"
              v-show="data.widget.uid !== renamingWidget?.uid">
              <template v-if="data.isBoard">
                <el-icon class="widget-icon"><i-ep-data-board /></el-icon>
              </template>
              <template v-else>
                <img class="widget-icon" :src="data.widget.icon">
              </template>
              <span class="widget-name" :title="data.widget.name+data.widget.nameSuffix">{{ data.widget.name }}{{ data.widget.nameSuffix }}</span>
            </div>
            <input class="widget-name-input" type="text" @keyup.enter="endRename(data.widget)" v-model.lazy="data.widget.name" @blur="endRename(data.widget)" :class="{ 'current-name-input': data.widget.uid === renamingWidget?.uid }"
              v-show="data.widget.uid === renamingWidget?.uid" :ref="(el: HTMLInputElement)=>{inputEls[data.widget.uid]=el}" />
            <div class="hot-icon-wrapper" v-if="data.showHotIcon">
              <div class="item-icon" :class="{ show: data.widget.status.isHover || data.widget.locked }"
                @click.stop="toggleLock(data.widget)">
                <i class="fs" :class="data.widget.locked ? 'fs-locked' : 'fs-unlocked'"></i>
              </div>
              <div class="item-icon" :class="{ show: data.widget.status.isHover || !data.widget.enabled }"
                @click.stop="toggleEnabled(data.widget)">
                <i class="fs" :class="data.widget.enabled ? 'fs-enable' : 'fs-disable'"></i>
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-tree>
  </el-scrollbar>
</template>

<script lang="ts" setup>
import { ParsedRef, isBoard } from '@renderer/b2/types';
import { Board } from '@renderer/b2/controllers/board';
import { Widget } from '@renderer/b2/controllers/widget';
import { unique } from '@common/utils/unique';
import { ref, inject, nextTick, computed, watch, UnwrapRef, onMounted } from "vue";
import { HOVER_WIDGET, SELECTED_WIDGETS, DRAG_WIDGET, WIDGET_MENU_CONTEXT, MERGE_WIDGETS_FUN, MOVE_WIDGETS_FUN, ACTIVE_BOARD } from '@renderer/types';
import { useMagicKeys } from '@vueuse/core';
import { ElMessage, ElTree } from 'element-plus'
import { usePassportStore } from "@renderer/stores";
import i18next from "i18next";
import { SaasPlan } from '@common/types/user';
import { isEmpty } from '@common/utils/object';

const passportState = usePassportStore();
const props = defineProps<{
  widgets: Widget[],
}>();
const { ctrl, shift } = useMagicKeys();
const widgetCatalogDom = ref<InstanceType<typeof ElTree>>();
const activeBoard = inject(ACTIVE_BOARD);
const selectedWidgets = inject(SELECTED_WIDGETS);
const hoverWidget = inject(HOVER_WIDGET);
const dragWidget = inject(DRAG_WIDGET);
const widgetMenuContext = inject(WIDGET_MENU_CONTEXT);
const mergeWidgetsFun = inject(MERGE_WIDGETS_FUN);
const moveWidgetsFun = inject(MOVE_WIDGETS_FUN);

let firstClickNodeId  //最新一次点击的节点的id
let firstClickNodeParentUID // 最新一次点击的节点的父元素的uid
let prevSelected = [];  //最新一次shift新选中的所有节点
//点击组件触发
const checkedWidget = (data: Tree, newNode, _treeNode, event: PointerEvent) => {
  if (!event.isTrusted) return;
  if (!data.widget.isEditable) return;
  if (ctrl.value && !shift.value) {
    firstClickNodeId = newNode.id;
    firstClickNodeParentUID = newNode.data.widget.parent.uid
    prevSelected = [];
    if (selectedWidgets.value.filter(item => item.uid === data.widget.uid).length >= 1) {
      selectedWidgets.value = selectedWidgets.value.filter(item => item.uid !== data.widget.uid);
    } else {
      selectedWidgets.value.push(data.widget);
    }
  } else if (shift.value && !ctrl.value) {
    if (!selectedWidgets.value.length) {
      selectedWidgets.value = [data.widget];
    } else {
      if (data.widget.parent.uid !== firstClickNodeParentUID) return ElMessage.warning(i18next.t("widgetCatalog.crossLayerSelectTip"))
      let nodesArr = Object.values(widgetCatalogDom.value.store.nodesMap)
      nodesArr.sort((a, b) => a.id - b.id);
      let minId = Math.min(newNode.id, firstClickNodeId);
      let maxId = Math.max(newNode.id, firstClickNodeId);
      //数组的id是连续的，但第一项起始id数字是不固定的
      let middleArr = nodesArr.filter(item => {
        return item.id >= minId && item.id <= maxId && item.data.widget.parent.uid === firstClickNodeParentUID
      }).map(item => item.data.widget);
      selectedWidgets.value = selectedWidgets.value.filter(item => {
        if (!prevSelected.includes(item)) return item;
      })
      for (let i = 0; i < middleArr.length; i++) {
        if (!selectedWidgets.value.includes(middleArr[i])) {
          selectedWidgets.value.push(middleArr[i]);
        }
      }
      prevSelected = middleArr;
    }
  } else {
    selectedWidgets.value = [data.widget];
    firstClickNodeId = newNode.id;
    firstClickNodeParentUID = newNode.data.widget.parent?.uid
    prevSelected = [];
  }
}

const preventDragWidgetId = ref()
// 判断组件能否被拖拽
const allowDragFn = (node) => {
  if (node.data.widget.locked || preventDragWidgetId.value === node.data.widget.uid) {
    return false;
  } else {
    return true;
  }
}

/**
 * 
 * @param node 当前node
 * @param ancestorNode 需要判断的祖先node
 * @param self 是否包含自身
 */
const isAncestorNode = (node, ancestorNode, self = false) => {
  if(!node || !ancestorNode) return false;
  if(self && node ===  ancestorNode) {
    return true;
  }
  if (node.parent === ancestorNode) {
    return true;
  }
  return isAncestorNode(node.parent, ancestorNode);
}

//判断能够拖到组件内部
const allowDropFn = (draggingNode, dropNode, type) => {
  if (dropNode?.data?.isHide && type !== 'prev') return false;
  if (isAncestorNode(dropNode, draggingNode, true)) return false;
  if(dropNode.data.originWidget) return true;
  if (dropNode.data.widget.container && type === "inner" && dropNode.data.widget.container.isChildTypeValid(draggingNode.data.widget.type)) {
    return true;
  } else if (type !== "inner") {
    if (!dropNode.data.widget.parent) {
      return false;
    }
    return dropNode.data.widget.parent.container.isChildTypeValid(draggingNode.data.widget.type);
  } else {
    return false;
  }
}

// 节点开始拖拽时触发的事件
const isDragging = ref(false);
const dragstart = async (node) => {
  isDragging.value = true;
  dragWidget.value = node.data.widget;
  selectedWidgets.value = [node.data.widget];
}

//拖拽结束时（可能未成功）触发的事件
const drop = (dragNode, enterNode, type, evt) => {
  if (enterNode?.data?.isHide) {
    enterNode.data.widget = enterNode.data.originWidget;
    type = 'after';
  }
  isDragging.value = false;
  if (!dragWidget.value) {
    if (dragNode.data) {
      dragWidget.value = dragNode.data.widget;
    } else {
      return;
    }
  }
  if (dragNode == enterNode || !enterNode) return;
  let widget = enterNode.data.widget;
  const dragWidgets = [dragWidget.value] as unknown as Widget[];
  const toWidget = type === 'inner' ? widget : widget.parent;
  const isPositionSet = dragWidget.value.isOptionSet("position");
  if(isPositionSet){
    mergeWidgetsFun(dragWidgets, toWidget, {type, referUID: widget.uid});
  }else{
    moveWidgetsFun(dragWidgets, toWidget, {type, referUID: widget.uid});
  }
  dragWidget.value = null;
}

// 鼠标右键触发
const handleContextMenuShow = function (evt: MouseEvent, data) {

  //TODO:currentTarget只存在于事件触发和时间处理之间，事件结束currentTarget为null
  // contextMenuEvent.value = evt;
  if (selectedWidgets.value.filter(item => item.uid === data.widget.uid).length >= 1) {
  } else {
    selectedWidgets.value = [data.widget];
  }
  const mousePosition = { left: evt.pageX, top: evt.pageY }
  widgetMenuContext.showWidgetMenu(data.widget, true, mousePosition);

}

//鼠标经过触发
const handleMouseOver = (hover = true, widget?) => {
  if (hover) {
    hoverWidget.value = widget;
  } else {
    hoverWidget.value = undefined;
  }
}

const toggleLock = (widget: Widget) => {
  if (widget.parent.locked) {
    return;
  }
  widget.locked = !widget.locked;
  if (widget.locked) {
    widget.container?.getChildWidgets(true).map((item)=>item.uid) || [];
  }
};
const toggleEnabled = (widget: Widget) => {
  if (!widget.parent.enabled) {
    return;
  }
  widget.enabled = !widget.enabled;
  if (!widget.enabled) {
    widget.container?.getChildWidgets(true).map((item)=>item.uid) || [];
  }
}

const inputEls: { [uid: string]: HTMLInputElement } = {};
const renamingWidget: ParsedRef<Widget> = ref();  //正在重命名的widget
let widgetName = "";  //没有输入名字，则用widget的name

// input表单输入触发
const startRename = async (evt, widget: UnwrapRef<Widget>) => {
  widgetName = widget.name;
  preventDragWidgetId.value = widget.uid
  renamingWidget.value = widget;
  await nextTick();
  inputEls[widget.uid]?.focus();
  inputEls[widget.uid]?.select();
}

// 重命名组件名 input表单结束change时触发
const endRename = (widget: Widget) => {
  if (!widget.name) {
    widget.name = widgetName;
  }
  renamingWidget.value = null;
  preventDragWidgetId.value = ''
}

const allContainer = ref([]);

interface Tree {
  widget: Widget
  uid: string
  label: string
  type: string
  children?: Tree[]
  isHide?: boolean,
  originWidget?: Widget,
}
const expandedKeys = ref([activeBoard.value.uid]);
//构造tree控件所需的结构
const transformTreeBuild: (arr: Board[]|Widget[]) => Tree[] = (arr) => {
  return arr.map(widget => {
    if(widget.container) {
      allContainer.value.push(widget.uid);
    }
    const _isBoard = isBoard(widget);
    return {
      widget: widget,
      // id:widget.uid,
      // hover:false,
      label: widget.name,
      uid: widget.uid,
      type: widget.getSoul().type,
      children: widget.container ? transformTreeBuild(widget.container?.reversedWidgets) : null,
      showHotIcon: !_isBoard,
      catalogFolding: _isBoard ? "always-unfold" : "fold",
      isBoard: _isBoard,
    }
  })
}
const widgetLists = computed(() => {
  const lists = transformTreeBuild([activeBoard.value]);
  if (lists.length > 1) {
    const lastList = lists.slice(-1)[0];
    if (!isEmpty(lastList.children)) {
      const { children, widget, ...rest } = lastList;
      const uid = unique();
      lists.push({
        ...rest,
        uid,
        widget: {
          uid,
          type: '',
          status: {},
        } as any,
        originWidget: widget,
        isHide: true,
      });
    }
  }
  return lists;
})
const defaultProps = {
  label: "label",
  children: "children"
}

widgetMenuContext.renameWidgetCallback = async (widget: Widget)=>{
  renamingWidget.value = widget as unknown as UnwrapRef<Widget>;
  await nextTick();
  inputEls[renamingWidget.value.uid]?.focus();
}

widgetMenuContext.setWidgetCatalogStatus = (type) => {
  if (type == "fold") {
    expandedKeys.value = allContainer.value;  //全部展开，再折叠，否则会有问题
    widgetLists.value.forEach(node => {
      widgetCatalogDom.value!.store.nodesMap[node.uid].expanded = false;
    })
    expandedKeys.value = [];
  } else {
    expandedKeys.value = allContainer.value;
  }
}
const nodeExpandFn = (data, node, target) => {
  const filterIndex = expandedKeys.value.findIndex(key => key === node.key);
  if (filterIndex < 0) {
    expandedKeys.value.push(node.key)
  }
}

const nodeCollapseFn = (data, node, target) => {
  const filterArr = expandedKeys.value.filter(key => key !== node.key || data.catalogFolding === "always-unfold");
  expandedKeys.value = filterArr;
}

// 点击widget,自动滚动到组件位置
const vnScrollDom = ref();
const divContentEls: { [uid: string]: HTMLDivElement } = {};
watch(selectedWidgets, (val) => {
  if (val.length > 1 || !val.length) return;
  if (widgetMenuContext.newAddPanelWidget) {
    expandedKeys.value = [...expandedKeys.value, val[0].uid];
  }
  widgetMenuContext.newAddPanelWidget = false;
  if (val[0]?.parent?.type !== "board") {
    expandWidgetParent(val[0]);
  }
  setTimeout(()=>{
    let selectedElement = divContentEls[val[0]?.uid]?.parentElement?.parentElement;
    if (selectedElement) {
      const scrollElement = vnScrollDom.value?.wrapRef;
      if (!scrollElement) return;
      let scrollHeight = scrollElement.offsetHeight / 2;
      let selectedTop = selectedElement.offsetTop;
      let selectedForScrollHeight = selectedTop - scrollElement.scrollTop;
      if(scrollElement.offsetHeight > selectedForScrollHeight && selectedForScrollHeight >= 0) return;
      scrollElement.scrollTop = selectedTop - scrollHeight;
    }
  },310)
})

const expandWidgetParent = (widget: Widget) => {
  if (widget?.parent && widget.parent.type !== "board") {
    if (!expandedKeys.value.includes(widget.parent.uid)) {
      expandedKeys.value = [...expandedKeys.value, widget.parent.uid];
    }
    expandWidgetParent(widget.parent as Widget);
  }
};
const expandWidget = (widget: Widget) => {
  if (widget.container) {
    if (!expandedKeys.value.includes(widget.uid)) {
      expandedKeys.value.push(widget.uid);
    }
  }
}

const customNodeClass = (data, node) => {
  let selected = selectedWidgets.value.some(item => item?.uid == data.uid);
  let hover = hoverWidget.value?.uid === data.uid;
  let treeClass = "";
  if (selected) {
    treeClass += "selected ";
  }
  if (hover) {
    treeClass += "hover";
  }
  return treeClass;
}

defineExpose({
  expandWidgetParent,
  expandWidget
})
</script>

<style lang="scss" scoped>
.layer {
  height: 100%;
}
.catalog-tree {
  background: inherit;
  flex: 1;
  min-height: 0;
  :deep(.el-tree-node) {

    &:has(.visible-false) {
      opacity: 0;
      visibility: hidden;
    }
    .el-tree-node__content {
      position: relative;
      height: 28px;
      border: 1px solid transparent;
      box-sizing: border-box;
      .el-tree-node__label {
        width: calc(100% - 12px);
      }
      user-select: none;
    }
   
    &.selected>.el-tree-node__content {
      background-color: #f2f3f5;
    }

  
    &.hover>.el-tree-node__content {
      background-color: #f2f3f5;
    }
  }

  &.is-dragging :deep(.el-tree-node):has(.visible-false) {
    visibility: unset;
  }
  :deep(.el-tree-node__expand-icon) {
    padding-left: 0;
    padding-right: 0;
  }

  .catalog-widget {
    width: calc(100% - 12px);
    height: 28px;
    line-height: 28px;
    .el-icon {
      margin-right: 4px;
    }
    &.PREMIUM {
      color: #87ABFF;
    }
    &.BUSINESS {
      color: #CCA26A;
    }
    &.ENTERPRISE {
      color: #B59EFF;
    }

    .plan-icon {
      margin-right: 4px;
      border-radius: 1px;
      transform: translateY(-1px);
      vertical-align: middle;
    }

    .catalog-widget-content {
      position: relative;
    }

    .item-title {
      height: 28px;
      border: 1px solid transparent;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      user-select: none;
      width: calc(100% - 5px);

      &.is_hover{
        width: calc(100% - 50px);
      }

      .fs-arraw {
        display: inline-block;
        width: 16px;
        height: 16px;
        line-height: 16px;
        vertical-align: middle;
        text-align: center;
        font-size: 8px;

        &::before {
          content: "\e694";
        }
      }

      .widget-icon {
        width: 20px;
        height: 20px;
        vertical-align: middle;
        transform: translateY(-1px);
        filter: brightness(1.2) saturate(0%);
      }

      &.is-g2{
        color: #ccc621;
        .widget-icon{
          filter: invert(71%) sepia(96%) saturate(407%) hue-rotate(9deg) brightness(96%) contrast(85%);
        }
      }
    }

    .widget-name-input {
      width: calc(100% - 50px);
      height: 26px;
      margin-top: 1px;
      font-size: 12px;
      background-color: var(--bg-color)
    }
    .hot-icon-wrapper {
      position: absolute;
      top: 0;
      right: 5px;
      line-height: 26px;

      .item-icon {
        display: inline-block;
        width: 22px;
        height: 22px;
        border-radius: 5px;
        line-height: 22px;
        vertical-align: middle;
        text-align: center;
        visibility: hidden;

        &.show {
          visibility: visible;

          &:hover {
            color: var(--color-primary);
            background-color: var(--bg-color);
          }
        }
      }
    }

    // &:hover > .item-title {
    //   border-color: #0089ff;
    // }
    // &.hover > .item-title {
    //   border-color: #0089ff;
    // }
    // &.dropping-in{
    //   border-top: 1px solid #444;
    //   background-color: #0089ff;
    // }
    // &.dropping{
    //   border-top: 1px solid #0089ff;
    // }
  }

  &.is-dragging{
    :deep(.el-tree-node){
      &:hover .el-tree-node__content{
        cursor: default !important;
      }
    }
  }
}
</style>
