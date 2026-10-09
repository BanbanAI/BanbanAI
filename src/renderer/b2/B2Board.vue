<template>
  <div ref="boardContainer" class="board" :style="!isEditable ? { height: '100%' } : {}">
    <div :id="`board-${projectId}-${board.uid}`" class='b2-board'>
      <div class="board-view" :class="[!isEditable ? 'uneditable' : '', boardViewBackground]" ref="boardDom" :style="[isViewing ? {'background-image': 'none'} : {}]">
        <b2-background :background="background"></b2-background>
        <div class="content-container" :class="isMobile() ? 'mobile' : 'scrollbar-thin'" :style="{
          position: board.layout === 'static' ? 'absolute' : 'unset',
        }" ref="dom" @dragover.prevent.stop="handleDragOver">
          <b2-container :container="board.container" @click="handleClick"></b2-container>
        </div>
      </div>
    </div>
    <audio :src="backgroundMusicUrl" v-if="backgroundMusicUrl" v-show="false" ref="backgroundMusicRef" :autoplay="isAudioAutoPlay" loop @canplay="handleCanPlay"></audio>
  </div>
</template>
<script lang="ts" setup>
import { computed, ref, nextTick, watch, inject, StyleValue, onMounted, onUnmounted, provide } from "vue";
import { Board } from "./controllers/board";
import { IS_MOBILE_FULLSCREEN, PROJECT, ACTIVE_BOARD_ID, ALL_BOARD_DOM, ACTIVE_BOARD, VISIBLE, ALL_BOARD, EDIT_BOARD_MODULE, CO_EDITING_ACCOUNTS, CUR_CO_EDITING_ACCOUNT, IS_WEB_SHARE, SELECTED_WIDGETS, CLOSE_POPUP, ACTIVE_CONTAINER, PROJECT_TABLE_DRAGGING} from "@renderer/types";
import { useResizeObserver } from "@vueuse/core";
import { Background } from "./controllers/background";
import { usePassportStore } from "@renderer/stores";
import { ElMessage } from "element-plus";
import { Soul, WidgetTemplateSoul, Options, WidgetTemplate } from "@common/types/project";
import { deepClone } from "@common/utils/object";
import i18next from "i18next";
import axios from "axios";
import { handlePastedWidgetsSoul } from "@renderer/utils/cloneWidget";
import { OptionFileValue } from "./types";
import { Widget } from "@renderer/b2/controllers/widget";
import { WatchStopHandle } from "vue";
import { isMobile } from "@renderer/utils";

const props = defineProps<{
  board: Board,
  type: "fore" | "normal" | "back",
  isViewing?: boolean,
}>();
/* eslint-disable */
const allBoard = inject(ALL_BOARD);
const activeBoard = inject(ACTIVE_BOARD);
const projectVisible = inject(VISIBLE);
const isMobileFullscreen = inject(IS_MOBILE_FULLSCREEN, ref(false));
const coEditingAccounts = inject(CO_EDITING_ACCOUNTS);
const curCoEditingAccount = inject(CUR_CO_EDITING_ACCOUNT);
const editBoardModule = inject(EDIT_BOARD_MODULE);
const selectedWidgets = inject(SELECTED_WIDGETS);
const activeContainer = inject(ACTIVE_CONTAINER);
const projectTableDragging = inject(PROJECT_TABLE_DRAGGING);
const passportState = usePassportStore();

const projectId = computed(() => props.board?.projectId);
const nocodeId = computed(() => props.board?.nocodeId);

const boardVisible = computed(()=>{
  if(!projectVisible.value){
    return projectVisible.value;
  }
  if(props.type === 'fore'){
    return activeBoard.value?.uid !== allBoard?.backBoard?.uid;
  }else if(props.type === 'back'){
    if(activeBoard.value?.uid === props.board.uid){
      return true;
    }else if(activeBoard.value?.uid === allBoard?.foreBoard?.uid){
      return false;
    }
    return !activeBoard.value?.getOption("background");
  }else{
    return activeBoard.value?.uid === props.board.uid;
  }
})
watch(()=>boardVisible.value, ()=>{
  props.board.status.isVisible = boardVisible.value;
}, {immediate: true, flush: "post"});


const dom = ref<HTMLElement>(null);
const backgroundMusicRef = ref<HTMLAudioElement>(null);
let musicVolumeWatchStopHandle: WatchStopHandle;
let isUnmounted = false;
onMounted(() => {
  props.board.dom = dom.value;
  props.board.boardView = boardDom.value;
  if (backgroundMusicUrl.value) {
    props.board.backgroundMusicDom = backgroundMusicRef.value;
  }
  if (props.isViewing) {
    reCalcStyle();
  }

  musicVolumeWatchStopHandle = watch(() => props.board.musicVolume / 100, (value) => {
    if (backgroundMusicRef.value) {
      backgroundMusicRef.value.volume = value;
    }
  }, { immediate: true });
});
onUnmounted(() => {
  isUnmounted = true;
  delete props.board.dom;
  if (allBoardDom?.value) {
    delete allBoardDom.value[props.board.uid];
  }
  props.board.destroy();
  musicVolumeWatchStopHandle?.();
});

const handleCanPlay = () => {
  if(backgroundMusicRef.value?.paused) {
    backgroundMusicRef.value.play();
  }
  backgroundMusicRef.value.volume = props.board.musicVolume / 100;
}

const project = inject(PROJECT);
const isEditable = computed(() => props.board.status.isEditable);
const background = ref<Background>();
background.value = new Background(props.board);


const backgroundMusicUrl = computed(() => {
  if (!props.board.getOption("background")) return "";
  const musicOption = props.board.getOption<OptionFileValue>("background-music-file");
  if (musicOption?.url) {
    return musicOption.url;
  }
  if (musicOption?.relativePath) {
    return encodeURI(`${projectId.value}/${musicOption.relativePath}`);
  }
  return "";
})

const boardViewBackground = computed(() => {
  if (props.type === 'fore' && props.board.uid !== activeBoardId.value) {
    return 'foreboard-hide';
  } else if (props.type === 'normal' && project.value?.backboard){
    return 'normal-hide';
  } else if (!isEditable.value) {
    return 'hide-margin';
  } else {
    return 'visible';
  }
})

watch(() => backgroundMusicUrl.value, (val) => {
  if (val && !backgroundMusicRef.value) {
    nextTick(() => {
      props.board.backgroundMusicDom = backgroundMusicRef.value;
    })
  }
})


// dom 的引用，用于获取画布的大小
const allBoardDom = inject(ALL_BOARD_DOM);
const boardDom = ref<HTMLElement>()

provide(CLOSE_POPUP, null);

const boardContainer = ref<HTMLElement>(null);

useResizeObserver(boardDom, (entries)=>{
  const entry = entries[0];
  props.board.size = { width: entry.contentRect.width, height: entry.contentRect.height };
  if (props.isViewing) {
    reCalcStyle();
  }
});


watch(()=> props.board.historyId, (newValue, oldValue) => {
  if (!oldValue) {//首次给historyId赋值
    return;
  }
  if (newValue === oldValue) {
    return;
  }
  if (passportState.mode === 'user' || curCoEditingAccount.value?.boardUIDs?.includes(props.board.uid)) return;
  // 检查当前看板是否是别的人在改
  const coEditingAccount = coEditingAccounts.value?.find((coEditingAccount) => {
    if (coEditingAccount.id !== passportState.account.id) {
      return coEditingAccount.boardUIDs?.includes(props.board.uid);
    }
  })
  if (!coEditingAccount) {
    editBoardModule(props.board.uid);
  } else {
    ElMessage.closeAll();
    ElMessage.warning(i18next.t("boardSavedWarning", {account: coEditingAccount.nickname}));
  }
});
// 利用微任务初始化，微任务将在 Mounted 之后执行，可以拿到正确的 boardDom.value.offsetWidth
nextTick(() => {
  if (!isUnmounted && allBoardDom?.value && boardDom.value) {
    allBoardDom.value[props.board.uid] = boardDom.value;
  }
})
/* 前景/背景看板逻辑开始 */
const activeBoardId = inject(ACTIVE_BOARD_ID);
const isAudioAutoPlay = computed(() => activeBoardId.value === props.board.uid || props.type !== 'normal');
watch(activeBoardId, (val) => {
  if (props.type == 'normal') {
    if (val == props.board.uid) {
      backgroundMusicRef.value?.play();
    } else {
      backgroundMusicRef.value?.pause();
    }
  }
})
// 样式
const fullStyle = ref({});
// 是否滚动
watch(() => isMobileFullscreen.value, () => {
  reCalcStyle();
});
const reCalcStyle = () => {
  fullStyle.value = {
    width: '100%',
  };
}

watch(() => props.board.status.isPlaying, (value) => {
  if (!value) {
    props.board.status.boardEnterTime = 0;
  }
})

const getTemplateSoul = async (template: WidgetTemplate) => {
  const res = await axios.get(`widget/template-soul?soulUrl=${template.url}`).catch(() => {});
  if (res) return res.data;
}

const isObject = (value: any) => {
  return value != null && typeof value === 'object'
}
// 处理elementOption
const handleElementOption = (options: Options) => {
  for (const key in options) {
    if (!isObject(options[key])) continue;
    if (options[key]["__opt_type"] === "element") {
      let uidArr = options[key]['elementPath'];
      if (uidArr && uidArr.length !== 0) {
        uidArr[0] = activeBoard.value?.uid;
      }
    } else {
      handleElementOption(options[key] as any);
    }
  }
}
const addWidget = async (template)=>{
  if (!template.soul && template.url) {
    template.soul = await getTemplateSoul(template);
  } 
  if (!template.hasCopy) {
    const res = await axios.post('widget/handle-template-resource', { nocodeId: nocodeId.value, template:template }).catch(() => {});
    if (res) {
      const { hasChanged, templateSoul } = res.data;
      if (hasChanged) {
        template.soul = templateSoul;
      }
    }
    template.hasCopy = true;
  }
  const templateSoul: WidgetTemplateSoul = template.soul;
  const widgetSoul = deepClone(templateSoul) as Soul;
  widgetSoul.name = template.alias;

  const handledSoul = (await handlePastedWidgetsSoul([ widgetSoul ], projectId.value, activeBoard.value?.uid)).pastedWidgetSouls[0].widgetSoul;
  handleElementOption(handledSoul);

  //修改他的标题文字
  const index = activeContainer.value?.container.souls.length
  const widget = await activeContainer.value?.container?.addWidget(widgetSoul, index, true);
  return widget
}
// const handleDrop = async (ev)=>{
//   if (ev.dataTransfer.getData("connection-type") === "embedded") return;
//   ev.preventDefault();
//   ev.stopPropagation();
//   if(ev.dataTransfer.getData("drag-type") == "ProjectTableDrag"){
//     const [connectUID,tableUID] = JSON.parse(ev.dataTransfer.getData("drag-data"));
//     const connectUIDs = [connectUID]
//     const tableUIDs = [tableUID]
//     let targetTables = [];
//     for(const connection of project.value?.connections){
//       if(connectUIDs.indexOf(connection.uid) > -1){
//         for(const table of connection.tables){
//           if(tableUIDs.indexOf(table.uid) > -1){
//             targetTables.push(table);
//           }
//         }
//       }
//     }

//     for(const table of targetTables){
//       for(const field of table.fields){
//         console.log("field",field);
//       }
//       //
//       const templateGroups = result.data as WidgetTemplateList;
//       let templateSuites:WidgetTemplateType[];
//       //筛选出套件的widget
//       for(const templateGroup of templateGroups){
//         if(templateGroup.type == "KIT"){
//           templateSuites = templateGroup.children;
//           break;
//         }
//       }

//       const pickSuite = templateSuites[0];
    

//       //拿到当前的size
//       const width = activeBoard.value?.size.width;
//       const height = activeBoard.value?.size.height;


//       const originSelectedWidgets = selectedWidgets.value;

//       let titleHeight = 0;
//       //选择大标题
//       let titleTemplate;
//       for(const template of pickSuite.children){
//         if(template.alias.indexOf("大标题")>-1){
//           titleTemplate = template;
//           break;
//         }
//       }
//       if(titleTemplate){
//         const widget = await addWidget(titleTemplate);
//         //resize and reposition
//         widget.defaultPosition = [widget.defaultPosition[0],0];
//         titleHeight = widget.size.height;
//       }


      
//       //选择背板
//       let backTemplate;
//       for(const template of pickSuite.children){
//         if(template.alias.indexOf("背板")>-1){
//           backTemplate = template;
//           break;
//         }
//       }
//       if(backTemplate){
//         const gap = width/40;
//         const backwidth = width/4;

//         const widget1 = await addWidget(backTemplate);
//         widget1.defaultPosition = [gap, titleHeight + gap];
//         widget1.setOption("size",[backwidth, height/3]);

//         const widget2 = await addWidget(backTemplate);
//         widget2.defaultPosition = [gap, titleHeight + gap + height/3 + gap];
//         widget2.setOption("size",[backwidth, height/3]);

//         const widget3 = await addWidget(backTemplate);
//         widget3.defaultPosition = [width - gap - backwidth, titleHeight + gap];
//         widget3.setOption("size",[backwidth, height * 2/3 + gap]);
//       }

      
//     }
//   }
// }
const handleDragOver = (ev)=>{
}
const handleClick = (ev: MouseEvent)=>{
  if (ev.currentTarget === ev.target) {
    selectedWidgets.value = [];
  }
};
props.board.emitter.on("activate.widget", (widget: Widget) => {
  selectedWidgets.value = [widget];
});
props.board.emitter.on("deactivate.widget", () => {
  selectedWidgets.value = [];
});

</script>
<style lang="scss" scoped>
.board {
  width: 100%;
  height: 100%;
  color: var(--text-color-primary);
  overflow: hidden;
  background-color: var(--bg-color-page);
  background-size: 18px 18px;
  position: relative;
}
.b2-board {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  user-select: none;
  overflow: hidden;
  cursor: inherit;
  outline: none;
  position: relative;

  .board-view {
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    pointer-events: none;

    &.uneditable {
      width: 100%;
      height: 100%;
      margin: 0;
    }
    &.foreboard-hide{
      visibility: visible;
      background-image: none;
      background-color: transparent;
    }
    &.normal-hide{
      background-image: none;
      background-color: transparent;
    }
    &.hide-margin{
      visibility: visible;
      margin: 0;
    }
    &.visible{
      visibility: visible;
    }
    .content-container {
      width: 100%;
      height: 100%;
      overflow: hidden auto;
      pointer-events: all;
      z-index: 999;
      &.mobile {
        overflow: auto;
        &::-webkit-scrollbar {
          display: none;
        }
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
    }
  }
}
</style>
