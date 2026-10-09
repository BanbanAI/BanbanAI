<template>
  <b2-container :container="mockBoard.container"></b2-container>
</template>
<script lang="ts" setup>
import { unique } from "@common/utils/unique";
import { Options } from "@common/types/project";
import { ProjectContext, Linkage, SoulUIDMapping, ParamLog } from "./types";
import { Widget } from "@renderer/b2/controllers/widget";
import { Soul, WidgetSoul } from "@common/types/project";
import { Board } from "@renderer/b2/controllers/board";
import { provide, ref, inject, watch, Ref, reactive } from 'vue';
import { replace, equals, deepClone } from '@common/utils/object';
import { CLOSE_POPUP, CLOSE_MOCKBOARD } from "@renderer/types";

// 在创建mockboard的地方provide
const closeMockBoard = inject(CLOSE_MOCKBOARD); 
// 处理弹窗关闭事件
provide(CLOSE_POPUP, ()=>{
  closeMockBoard(props.teleportId, true);
})

const props = defineProps<{
  mockBoard: {
    soul: WidgetSoul,
    linkages: Linkage[],
    visible: Ref<boolean>,
    preloadTime: Ref<number>,
  },
  owner: Widget,
  teleportId: string,
}>();
const newBoardUID = unique();
const uidMap:SoulUIDMapping = {};
// 更新组件soul的uid
const updateSoulUID = (soul) => {
  const newUID = unique();
  uidMap[soul.uid] = newUID;
  soul = Object.assign(soul, {
    uid: newUID,
  })
  for (let i in soul.widgets || []) {
    updateSoulUID(soul.widgets[i]);
  }
  return soul;
}
const isObject = (value: any) => {
  return value != null && typeof value === 'object'
}
const replaceElementUID = (options: Options, soulUIDs: SoulUIDMapping)=>{
  for(const key in options){
    const option = options[key];
    if(!isObject(options[key])) continue;
    if(option?.["__opt_type"] === "element"){
      const uidArr = option['elementPath'];
      const widgetUID = uidArr[1];
      if(widgetUID && soulUIDs[widgetUID]){
        option['elementPath'][0] = newBoardUID;
        option['elementPath'][1] = soulUIDs[widgetUID];
      }
    }else{
      replaceElementUID(option as any, soulUIDs);
    }
  }
}
const replaceElementOptions = (elementSoul: WidgetSoul, soulUIDs: SoulUIDMapping) => {
  replaceElementUID(elementSoul.options, soulUIDs);
  for (const widget of (elementSoul as WidgetSoul).widgets || []) {
    replaceElementOptions(widget, soulUIDs);
  }
}
let ownerBoard = props.owner.getBoard();
let mockWidget = JSON.parse(JSON.stringify(props.mockBoard.soul));
mockWidget = updateSoulUID(mockWidget);
replaceElementOptions(mockWidget, uidMap);
mockWidget.options.position = [0, 0];

const boardSoul = reactive({
  name: "Mock Board",
  uid: newBoardUID,
  widgets: [mockWidget],
  type: "board",
  options:{
    background: false
  }
});
const mockBoard: Board = new Board(boardSoul as Soul, {
  get typography() {
    return ownerBoard.typography;
  },
  get runtime() {
    return ownerBoard.runtime;
  },
  projectId: ownerBoard.projectId,
  get projectName() {
    return ownerBoard.projectName;
  },
  getElementByUID(uid: string[]){
    const [boardUID, widgetUID] = uid ?? [];
    if(boardUID === mockBoard.uid){
      let widget: Widget;
      if(widgetUID){
        widget = mockBoard.getWidgetByUID(widgetUID) as Widget;
      }else{
        return mockBoard;
      }
      return widget;
    }else{
      return ownerBoard.getElementByUID(uid);
    }
  },
  get projectParams() {
    return ownerBoard.projectParams;
  },
  editProjectParams: (params) => {
    return ownerBoard.editProjectParams(params);
  },
  get connectionData() {
    return ownerBoard.projectConnectionData;
  },
  get mergedConnectionData() {
    return ownerBoard.mergedConnectionData;
  },
  getBoards: () => {
    return ownerBoard.getBoards().concat(mockBoard);
  },
  getDataConditions: () => {
    return ownerBoard.getDataConditions();
  },
  getConnections: () => {
    return ownerBoard.getConnections();
  },
  setActiveBoardById: (boardUID: string) => {
    return ownerBoard.setActiveBoardById(boardUID);
  },
  refreshConnectionData: () => {
    return ownerBoard.refreshConnectionData();
  },
  clone: async (widget: Widget, name: string, options: Options) => {
    return await ownerBoard.cloneWidget(widget, name, options);
  },
  addProjectLog(log: ParamLog) {
    return ownerBoard.addProjectLog(log);
  },
} as any as ProjectContext);

Object.assign(mockBoard.status, {
  isEditable: false,
  isPlaying: true,
  isVisible: false,
  mockOwner: props.owner.uid,
  get isConnectionInited() {
    return ownerBoard.status.isConnectionInited;
  },
  get isProjectReady() {
    return ownerBoard.status.isProjectReady;
  },
});
// 设置linkage
let widgets = mockBoard.container.getChildWidgets(true, (widget) => {
  if (widget.getOption("linkage-out")) {
    return true;
  }
  return undefined;
});
for (let key in widgets) {
  let widget = widgets[key];
  // 在看板里的联动 + owner里传入的联动
  const _getLinkageFilter = widget.getLinkageFilter.bind(widget);
  widget.getLinkageFilter = function () {
    const linkages = _getLinkageFilter();// 原始组件接收的联动
    const boardLinkages = props.mockBoard.linkages || [];// 创建mockboard的组件的联动
    const newLinkages = deepClone(linkages);
    if(linkages){
      if(boardLinkages.length){
        for(let linkage of boardLinkages){
          let hasSame = false;
          for (let i = 0; i < linkages.length; i++) {
            if(equals(Object.keys(linkage), Object.keys(linkages[i]))){
              newLinkages.splice(i, 1, { ...linkages[i] });
              hasSame = true;
              break;
            }
          }
          if (!hasSame) {
            newLinkages.push({ ...linkage });
          }
        }
      }
      return newLinkages;
    }else{
      return boardLinkages;
    }
  };
}

watch(()=>props.mockBoard.visible.value, (value, oldValue)=>{
  if (!equals(value, oldValue)) {
    mockBoard.status.isVisible = value;
    if(value){
      (mockBoard.widgets[0] as any)?.showPopup?.();
    }else{
      (mockBoard.widgets[0] as any)?.hidePopup?.();
    }
  }
}, { immediate: true })

watch(()=>props.mockBoard.preloadTime.value, (value, oldValue)=>{
  if(!equals(value, oldValue)){
    (mockBoard.widgets[0] as any)?.setTransientOption("opacity", 100);
  }
})

</script>
<style lang="scss" scoped>
</style>
