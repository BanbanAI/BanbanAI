<template>
  <div class="project-viewer" :class="{ 'is-fullscreen': isFullscreen }" :style="projectViewerStyle" v-if="project" ref="projectViewerRef">
    <project-core :project="project" :isScreenBoard="true" :foreView="true" :backView="true" :webshare="webshare" ref="projectCoreRef" :is-editor="false">
    </project-core>
  </div>
  <project-warning-dialog v-model="projectWarning" :warningText="$t('projectViewer.projectExpiredTip')" :webshare="webshare" @closed="quitProject" ></project-warning-dialog>
  <teleport to="body">
    <template v-if="projectVisible">
    </template>
  </teleport>
  <div :id="`option-group-overflow-masks-${projectId}`" class="option-group-overflow-masks"></div>
</template>


<script setup lang="ts">
import { DataCondition, Soul, Connection, WidgetSoul, OptionTableUID, OptionFieldUID, ConnectionData, Table, type ProjectBody } from "@common/types/project";
import { unique } from "@common/utils/unique";
import { AllBoard, ProjectContext, ParsedRef, ParamLog } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { Widget } from "@renderer/b2/controllers/widget";
import { Element } from "@renderer/b2/controllers/element";
import { ACTIVE_BOARD, ACTIVE_BOARD_ID, ACTIVE_WIDGET, ALL_BOARD, ALL_BOARD_DOM, CLOSE_PROJECT, FORE_BACK_ZOOM_X_Y, HOVER_WIDGET, IS_MOBILE_FULLSCREEN, PROJECT, PROJECT_ID, SELECTED_WIDGETS, VISIBLE, IS_PROJECT_READY, HANDLE_PROJECT_SNAPSHOTTED, IS_WEB_SHARE, ACTIVE_ELEMENT, CO_EDITING_ACCOUNTS, WIDGET_MENU_CONTEXT, ACTIVE_ELEMENT_LOCKED, CLONE_WIDGET, HANDLE_PASTED_WIDGETS, IS_DRAGGING_WIDGET, HAS_WIDGET_MOUNTED, UPDATE_OPENING_PROJECT_LIST } from "@renderer/types";
import axios from "axios";
import { ElMessage } from "element-plus";
import { computed, onUnmounted, provide, inject, reactive, Ref, ref, ShallowRef, shallowRef, toRaw, watch, onMounted, nextTick, onBeforeUnmount, StyleValue } from "vue";
import { getProjectFirstScreenBoardIds, loadWidgetsInProject } from "@renderer/b2/utils/widget.util";
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { useEventListener } from "@vueuse/core";
import { mergeObjects, handlePastedWidgetsSoul, isMobile, provideRuntime } from "@renderer/utils";
import { useProjectDialogStore } from "@renderer/stores";
import { Socket } from "socket.io-client";
import i18next from "i18next";
import { measureLog } from "@renderer/b2/utils/measure";
import { handleCopyName } from "@common/utils";
import { FormTableRuntime, Nocode } from "@common/types/nocode";
import { OrganizeUtil, buildTree, formDataApi } from "@renderer/views/nocode/utils";
import {
  buildRuntimeBoardConnections,
  buildRuntimeSources,
  collectRuntimeOptionTableUIDsFromProject,
  createRuntimeConnectionLoader,
  type RuntimeSource,
} from "./runtimeConnectionLoader";
import { getNocodeDataSourceByUID } from "@common/utils/connection";
import { normalizeAutoRefreshInterval } from "./projectAutoRefresh";
import { createTrailingSingleFlightRunner, waitForAll } from "@renderer/b2/utils/auto-refresh.util";

const props = withDefaults(defineProps<{
  project?: ProjectBody,
  projectId: string,
  nocodeId: string,
  active?: boolean,
  webshare?: boolean,
  isDebug?: boolean,
  nocode?: Nocode,
}>(), {
  projectParams: () => ({}),
  active: true,
  webshare: false,
  isDebug: false,
});
const isMobileDevice = isMobile();
const updateNocodeMainSign = (sign: string) => {
  if (props.nocode?.body) {
    props.nocode.body.sign = sign;
  }
};
/* eslint-disable  */
const projectId = props.projectId;

const clientId = unique(32);
const loading = ref(false);
const projectViewerRef = ref();
const projectCoreRef = ref();
const project = ref<ProjectBody>();
const isFullscreen = ref(false);
const PROJECT_VIEWER_FULLSCREEN_CLASS = "project-viewer-fullscreen";
let isFullscreenOwner = false;
let autoRefreshTimer: number;
let isUnmounted = false;
const activeBoardId = ref();
//TODO boards中暂时保持原来结构(前景背景也记到里面)
const allBoard: AllBoard = reactive({
  boards: {}
});
if (props.isDebug) {
  window["temp1"] = allBoard;
}
const allBoardDom = ref<{ [key: string]: HTMLElement }>({});
const foreBackZoomXY = ref({ zoom: 1, x: 0, y: 0 });
const isDraggingWidget = ref(false);
const hoverWidget: ShallowRef<Widget> = shallowRef();
const selectedWidgets: Ref<Widget[]> = ref([]);


watch(()=>hoverWidget.value, (value, oldValue)=>{
  if (value !== oldValue) {
    if (oldValue) {
      oldValue.status.isHover = false;
    }
    if (value) {
      value.status.isHover = true;
    }
  }
}, {immediate: true});

const activeElement = computed(() => {
  return activeBoard.value;
});
provide(ACTIVE_ELEMENT, activeElement);

const projectDialogState = useProjectDialogStore();
projectDialogState.initStorage(props.projectId);

provideRuntime(FormTableRuntime.BOARD_VIEWER);

const coEditingAccounts = ref([]);
provide(CO_EDITING_ACCOUNTS, coEditingAccounts);


//加载动画，替换logo
let cancelLoading = false;
// token登录是否验证完成，用于阻塞loading进度
const hasChecked = ref(true);
// 加载进度
const completeness = ref(0);
// 加载函数定时器
let loadingInterval: number;
// loading执行函数
const progressFinish = ref(false);


const documentVisibility = ref(true);
const projectVisible = computed(() => {
  return documentVisibility.value && !loading.value;
});
const activeBoard = computed(() => allBoard.boards?.[activeBoardId.value]);
const activeWidget = computed(() => selectedWidgets.value[selectedWidgets.value.length-1]);
watch(()=>[...selectedWidgets.value], (values, oldValues)=>{
  const uids = values.map((widget)=>widget.uid);
  const oldUids = oldValues?.map((widget)=>widget.uid);
  if (equals(uids, oldUids)) {
    return;
  }
}, {immediate: true});
watch(()=>activeWidget.value, (value, oldValue)=>{
  if (oldValue) {
    oldValue.status.isActive = false;
  }
  if (value) {
    value.status.isActive = true;
  }
});
// 浏览器导航条
const isProjectReady = ref(false); //是否加载
const hasWidgetMounted = ref(false); //是否有组件加载

let refreshDataSocket: Socket = null;


const organizeUtil = new OrganizeUtil();

/********************************************************  methods   *******************************************************************************************************************************************/

const addBoard = (board) => {
  allBoard.boards[board.uid] = board;
};
const getElementByUID = (uid: string[]):Element=>{
  if(!uid?.length) return undefined;
  const [boardUID, widgetUID] = uid;
  if(!boardUID) return undefined;
  const boards = Object.values(allBoard.boards).concat(allBoard.foreBoard ?? [], allBoard.backBoard ?? []) as Board[];
  let targetBoard: Board;
  for(let board of boards){
    if(board.uid === boardUID){
      targetBoard = board;
      break;
    }
  }
  if(!targetBoard) return undefined;
  let widget: Widget;
  if(widgetUID){
    widget = targetBoard.getWidgetByUID(widgetUID) as Widget;
  }else{
    return targetBoard;
  }
  return widget;
}


const cloneWidget = async (widgetSoul: WidgetSoul, oldUID: string, parent?: Widget | Board, isSameProject = true): Promise<Widget> => {
  if (!widgetSoul || !parent) return;
  let index: number;
  index = parent.container.souls.findIndex(item => item.uid === oldUID);
  if (index === -1) index = parent.container.souls.length;
  const soul: Soul = JSON.parse(JSON.stringify(widgetSoul));
  if (isSameProject) {
    soul.name = handleCopyName(soul.name)
  }
  const newWidget = await parent.container.addWidget(soul, index + 1) as Widget;
  return newWidget;
};

const projectConnectionData = ref<ConnectionData>({});
const mergedConnectionData = ref<ConnectionData>({});

const getConnectionByUID = (uid: string): Connection => {
  return props.nocode?.body?.connections?.find(c => c.uid === uid);
}
const getNocodeBodyData = () => {
  return {
    formData: props.nocode?.body?.formData,
    otherDataSources: props.nocode?.body?.otherDataSources || [],
  };
}
const getRuntimeSources = (): RuntimeSource[] => {
  return buildRuntimeSources(props.nocode?.body, props.nocodeId);
}
const runtimeSources = computed(() => getRuntimeSources());
const boardConnections = computed(() => {
  return buildRuntimeBoardConnections(props.nocode?.body, props.nocodeId, props.nocode?.meta?.name, runtimeSources.value);
});
const getConnections = () => {
  return boardConnections.value;
}

let runtimeConnectionLoader = createRuntimeConnectionLoader({
  currentConnectionUID: props.nocode?.body?.formData?.uid,
  currentNocodeId: props.nocodeId,
  getRuntimeSources,
  projectConnectionData: projectConnectionData.value,
  mergedConnectionData: mergedConnectionData.value,
});
const autoRefreshInterval = computed(() => {
  if (!activeBoard.value?.getOption<boolean>("autoRefresh")) return 0;
  return normalizeAutoRefreshInterval(activeBoard.value.getOption<number>("auto-refresh-interval"));
});

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    window.clearTimeout(autoRefreshTimer);
    autoRefreshTimer = undefined;
  }
};

const refreshVisibleWidgetDataCollections = async () => {
  const refreshedBoardUIDs = new Set<string>();
  const refreshPromises = [allBoard.foreBoard, activeBoard.value, allBoard.backBoard].map(board => {
    if (!board || refreshedBoardUIDs.has(board.uid)) return Promise.resolve();
    refreshedBoardUIDs.add(board.uid);
    return board.refreshWidgetDataCollections();
  });
  await waitForAll(refreshPromises);
};

const refreshProjectData = createTrailingSingleFlightRunner(async () => {
  let refreshSucceeded = true;
  try {
    const activeBoardIdValue = activeBoardId.value;
    const optionTableUIDs = collectRuntimeOptionTableUIDsFromProject(project.value, {
      boardIds: activeBoardIdValue ? [activeBoardIdValue] : undefined,
    });
    await runtimeConnectionLoader.refreshConnectionData(optionTableUIDs);
  } catch (error) {
    refreshSucceeded = false;
    console.error("Failed to refresh project connection data", error);
  }

  try {
    await refreshVisibleWidgetDataCollections();
  } catch (error) {
    refreshSucceeded = false;
    console.error("Failed to refresh visible project widgets", error);
  }

  return refreshSucceeded;
});

const startAutoRefresh = () => {
  stopAutoRefresh();
  if (isUnmounted || !isFullscreen.value || !autoRefreshInterval.value) return;

  autoRefreshTimer = window.setTimeout(async () => {
    await refreshProjectData();
    startAutoRefresh();
  }, autoRefreshInterval.value * 1_000);
};

const handleFullscreenChange = () => {
  const wasFullscreenOwner = isFullscreenOwner;
  const isDocumentFullscreen = document.fullscreenElement === document.documentElement;
  isFullscreen.value = isFullscreenOwner && isDocumentFullscreen;
  if (isFullscreen.value) {
    document.documentElement.classList.add(PROJECT_VIEWER_FULLSCREEN_CLASS);
  } else if (wasFullscreenOwner || !isDocumentFullscreen) {
    document.documentElement.classList.remove(PROJECT_VIEWER_FULLSCREEN_CLASS);
  }
  if (!isDocumentFullscreen) isFullscreenOwner = false;
  if (!isFullscreen.value || !autoRefreshInterval.value) {
    stopAutoRefresh();
    return;
  }
  void refreshProjectData().finally(startAutoRefresh);
};

const enterFullscreen = async () => {
  isFullscreenOwner = true;
  try {
    if (!document.documentElement.requestFullscreen) throw new Error("Fullscreen API is unavailable");
    await document.documentElement.requestFullscreen();
  } catch (error) {
    isFullscreenOwner = false;
    document.documentElement.classList.remove(PROJECT_VIEWER_FULLSCREEN_CLASS);
    console.warn("Failed to enter fullscreen", error);
    ElMessage.warning(i18next.t("projectViewer.fullScreenTips"));
  }
};

defineExpose({
  refreshProjectData,
  enterFullscreen,
});

useEventListener(document, "fullscreenchange", handleFullscreenChange);
watch([activeBoardId, autoRefreshInterval], () => {
  startAutoRefresh();
});
const typography = computed(()=>{
  if (project.value?.typography) {
    return project.value?.typography;
  }
  return "page";
});
const projectContext: ProjectContext = {
  get typography() {
    return typography.value;
  },
  projectId,
  get nocodeId() {
    return props.nocodeId;
  },
  get projectName() {
    return "";
  },
  get runtime() {
    return FormTableRuntime.BOARD_VIEWER;
  },
  getElementByUID,
  get mergedConnectionData() {
    return mergedConnectionData.value;
  },
  get connectionData() {
    return projectConnectionData.value;
  },
  getBoards() {
    return Object.values(allBoard.boards).concat(allBoard.foreBoard ?? [], allBoard.backBoard ?? []) as Board[];
  },
  getConnections,
  getDataConditions() {
    return (project.value as any)?.dataConditions || [];
  },
  setActiveBoardById(boardUID: string) {
    activeBoardId.value = boardUID;
  },
  async refreshConnectionData() {
    await runtimeConnectionLoader.refreshConnectionData();
  },
  async ensureConnectionBucket(optionTableUID) {
    return await runtimeConnectionLoader.ensureConnectionBucket(optionTableUID);
  },
  async readDataByOptions(optionTableUID, options) {
    return await runtimeConnectionLoader.readDataByOptions(optionTableUID, options);
  },

  async updateToConnection(optionTableUID: OptionTableUID, rows: object[], keys?:OptionFieldUID[]){
    if (!optionTableUID) return;
    const dataSource = getNocodeDataSourceByUID(getNocodeBodyData(), optionTableUID[0], {
      nocodeId: props.nocodeId,
    });
    if (!dataSource && !props.nocode?.body?.formData) return;
    return await formDataApi.updateData({
      nocodeId: dataSource?.nocodeId || props.nocodeId,
      schemaNocodeId: props.nocodeId,
      tableUID: optionTableUID[1],
      rows,
      keys,
      sign: props.nocode?.body?.sign,
      onMainSign: updateNocodeMainSign,
    })
  },
  async addToConnection(optionTableUID: OptionTableUID, rows: object[]){
    if (!optionTableUID) return;
    const dataSource = getNocodeDataSourceByUID(getNocodeBodyData(), optionTableUID[0], {
      nocodeId: props.nocodeId,
    });
    if (!dataSource && !props.nocode?.body?.formData) return;
    return await formDataApi.addData({
      nocodeId: dataSource?.nocodeId || props.nocodeId,
      schemaNocodeId: props.nocodeId,
      tableUID: optionTableUID[1],
      rows,
      sign: props.nocode?.body?.sign,
      onMainSign: updateNocodeMainSign,
    })
  },
  async removeFromConnection(optionTableUID: OptionTableUID, rows: object[], keys?: OptionFieldUID[]){
    if (!optionTableUID) return;
    const dataSource = getNocodeDataSourceByUID(getNocodeBodyData(), optionTableUID[0], {
      nocodeId: props.nocodeId,
    });
    if (!dataSource && !props.nocode?.body?.formData) return;
    return await formDataApi.deleteData({
      nocodeId: dataSource?.nocodeId || props.nocodeId,
      schemaNocodeId: props.nocodeId,
      tableUID: optionTableUID[1],
      rows,
      keys,
      sign: props.nocode?.body?.sign,
      onMainSign: updateNocodeMainSign,
    });
  },
  
  async clone(widget, name, options) {
    const newSoul = Object.assign(deepClone(widget.getSoul()), {
      name: name || widget.name,
      widgets: [],
      isSnap: true,
    });
    mergeObjects(newSoul.options, options);
    const { pastedWidgetSouls } = await handlePastedWidgetsSoul([newSoul], projectId, activeBoardId.value);
    const {widgetSoul, oldUID} = pastedWidgetSouls[0];
    return await cloneWidget(widgetSoul, oldUID, widget.parent as Widget, false);
  },
  addProjectLog(log: ParamLog) { },
};

const createBoard = (soul: Soul) => {
  const board = new Board(soul, projectContext);
  board.status.isEditable = false;
  board.status.isPlaying = false;
  return board;
};

const isConnectionInited = ref<boolean>(false);
watch(isConnectionInited, (value) => {
  if(value){
    if (allBoard.foreBoard) {
      allBoard.foreBoard.status.isConnectionInited = value;
    }
    if (allBoard.backBoard) {
      allBoard.backBoard.status.isConnectionInited = value;
    }
    for (const key in allBoard.boards) {
      allBoard.boards[key].status.isConnectionInited = value;
    }
  }
});
// let projectSocket: Socket;
// 是否展示login界面
const showLogin = ref<boolean>()
const baseProject = ref<ProjectBody>();
const loadProject = async () => {
  project.value = JSON.parse(JSON.stringify(toRaw(baseProject.value)));
  // 初始化 allBoard
  if (project.value?.foreboard) {
    allBoard.foreBoard = createBoard(project.value.foreboard);
    addBoard(allBoard.foreBoard);
  }
  project.value.boards.forEach((soul) => addBoard(createBoard(soul)));
  if (project.value.backboard) {
    allBoard.backBoard = createBoard(project.value.backboard);
    addBoard(allBoard.backBoard);
  }
  measureLog("loading", "create all board done");
  activeBoardId.value = project.value?.boards[0]?.uid;
  measureLog("loading", "read data done");
  isConnectionInited.value = true;
}
// 初始化Project
const initProject = async () => {
  measureLog("loading", "init project");
  try {
    let theProject: ProjectBody;
    const url = `/project/get-project?nocodeId=${props.nocodeId}&projectId=${projectId}`;
    const res = props.project ? { data: deepClone(props.project) } : await axios.get(url);
    measureLog("loading", "get project done");
    // 获取项目时登录访客不存在停止loading并展示登录界面
    if (props.webshare && !res.data) {
      ElMessage.error(i18next.t("projectViewer.visitorExist"));
      showLogin.value = true;
      clearInterval(loadingInterval);
      loading.value = false;
      return;
    };
    theProject = res.data;
    // 检查访客权限
    if (theProject.boards.length === 0) {
      loading.value = false;
      cancelLoading = true;
      clearInterval(loadingInterval);
      project.value = theProject;
      return;
    }
    await loadWidgetsInProject(theProject, {
      boardIds: getProjectFirstScreenBoardIds(theProject),
    });
    requestIdleCallback(() => {
      void loadWidgetsInProject(theProject);
    }, { timeout: 1500 });
    measureLog("loading", "load project widgets done");
    baseProject.value = JSON.parse(JSON.stringify(theProject));
    loadProject();
  } catch (err) {
    console.log('get-project-error', err);
  }
}

// 页面加载时首先需要确认页面是否是webshare
const determineIsLoginRequired = async () => {
  await initProject();
}
determineIsLoginRequired();


const projectWarning = ref(false)
let projectExpireTimeOut: number;

const quitProject = () => {
  window.close();
}
const settingStyle = ref<StyleValue>();
const projectViewerStyle = ref<StyleValue>();
const isMobileFullscreen = ref<boolean>(false);

const initMobileFullscreenStyle = async() => {
  projectViewerStyle.value = {};
  settingStyle.value = {}
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;
  projectViewerStyle.value["transform"] = "rotate(90deg)";
  projectViewerStyle.value["width"] = windowHeight + "px";
  projectViewerStyle.value["height"] = windowWidth + "px";
  await nextTick();
  const { x, y } = projectViewerRef.value.getBoundingClientRect();
  projectViewerStyle.value["margin-left"] = y + "px";
  projectViewerStyle.value["margin-top"] = x + "px";
}
const enterMobileFullscreen = () => {
  isMobileFullscreen.value = true;
  initMobileFullscreenStyle();
}
const isLandscape = ref(false);
const isPortraitFullscreen = ref(false);
const checkScreenOrientation = async () => {
  const orientation = screen.orientation.type;
  const currentOrientation = window.screen.orientation.angle;
  if (orientation.includes('landscape') || currentOrientation == 90 || currentOrientation == 270) {
    if (isMobileFullscreen.value) {
      isPortraitFullscreen.value = true;
      exitMobileFullscreen();
    }
    isLandscape.value = true;
  } else if (orientation.includes('portrait')) {
    if (isPortraitFullscreen.value) {
      isPortraitFullscreen.value = false;
      enterMobileFullscreen();
    }
    isLandscape.value = false;
  }
}

if (isMobileDevice) {
  checkScreenOrientation();
  window.addEventListener('resize', () => {
    checkScreenOrientation();
  });
}

const exitMobileFullscreen = () => {
  projectViewerStyle.value = {};
  isMobileFullscreen.value = false;
}

let cleanDocumentVisibility: () => void;
onMounted(() => {
  cleanDocumentVisibility = useEventListener(document, 'visibilitychange', ()=>{
    documentVisibility.value = document.visibilityState === 'visible'
  })
})


//#endregion

onUnmounted(() => {
  isUnmounted = true;
  stopAutoRefresh();
  if (isFullscreenOwner) {
    document.documentElement.classList.remove(PROJECT_VIEWER_FULLSCREEN_CLASS);
  }
  if (isFullscreenOwner && document.fullscreenElement === document.documentElement && document.exitFullscreen) {
    void document.exitFullscreen();
  }
  isFullscreenOwner = false;
  if (refreshDataSocket) refreshDataSocket.disconnect();
  if(loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  clearTimeout(projectExpireTimeOut);
  cleanDocumentVisibility?.();
})



type PostMessageData = {
  action: "setOption",
  data: {
    elementUID: [string, string, string?],
    optionPaths: string[],
    optionValue: any,
    transient: boolean,
  }
};
useEventListener(window, "message", (event) => {
  const data: PostMessageData = event.data;
  if (data?.action === 'setOption') {
    // setOption
    const { elementUID, optionPaths, optionValue, transient } = data.data;
    const element = getElementByUID(elementUID);
    if (!element) return;
    element.setOption(optionPaths, optionValue, transient);
  }
}, false);


provide(ACTIVE_BOARD, activeBoard);
provide(ACTIVE_BOARD_ID, activeBoardId);
provide(IS_DRAGGING_WIDGET, isDraggingWidget);
provide(SELECTED_WIDGETS, selectedWidgets);
provide(ACTIVE_WIDGET, activeWidget);

provide(HOVER_WIDGET, hoverWidget);

provide(PROJECT, project);
provide(IS_PROJECT_READY, isProjectReady);
provide(HAS_WIDGET_MOUNTED, hasWidgetMounted);
provide(PROJECT_ID, projectId);
provide(ALL_BOARD, allBoard);
provide(ALL_BOARD_DOM, allBoardDom);
provide(FORE_BACK_ZOOM_X_Y, foreBackZoomXY);

provide(VISIBLE, projectVisible);

provide(IS_MOBILE_FULLSCREEN, isMobileFullscreen)
provide(IS_WEB_SHARE, props.webshare);

provide(WIDGET_MENU_CONTEXT, null);
provide(ACTIVE_ELEMENT_LOCKED, ref(false));
provide(CLONE_WIDGET, cloneWidget);
provide(HANDLE_PASTED_WIDGETS, handlePastedWidgetsSoul);


</script>
<style scoped lang="scss">
.screen-list {
  position: relative;
  width: 100px;
}


.project-viewer {
  height: 100%;
  position: relative;

  &.is-fullscreen {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
  }

  .option-group-overflow-masks {
    .mask {
      position: absolute;
      left: 0;
      top: 0;
      width: 100vw;
      height: 100vh;
      z-index: 99;
    }
  }
}

.mask-loading {
  position: fixed;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  z-index: 99999;
  user-select: none;
  &.report{
    background: #111222;
  }
}

.show-login{
  position: fixed;
  width: 100vw;
  height: 100vh;
  top: 0;
  left: 0;
  background: linear-gradient(to bottom, #002641, #001224);
  user-select: none;

  .login-background {
    width: 100%;
    height: 100%;
    background: url(@renderer/assets/image/login-background.jpg) center no-repeat;
    background-size: 100% 100%;

    &.noLogo {
      background-image: url(@renderer/assets/image/login-background-no-logo.jpg);
    }
    &.isMobileDevice {
      background-size: auto 100%;
      background-position: unset;
      display: flex;
      justify-content: center;
      align-items: center;
      .login-card {
        position: unset;
        margin-top: v-bind("isLandscape ? '-10%' : '0'");
      }
    }
    .record-number {
      color: #888888;
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      bottom: 20px;

      &:hover {
        color: #406bf7;
      }
    }

    .login-card {
      position: absolute;
      top: 31.5%;
      left: 20.8%;
      width: 400px;
      height: 400px;
      background: url(@renderer/assets/image/login-card-background.png) 0 0 no-repeat;
      background-size: 100% 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 88px 0 61px;

      .login-title {
        font-size: 24px;
        font-family: PingFang SC, PingFang SC-Medium;
        font-weight: 500;
        text-align: center;
        color: #d6e5fa;
        letter-spacing: 2.4px;
      }

      .login-button {
        width: 280px;
        height: 40px;
        line-height: 40px;
        border-radius: 5px;
        font-size: 16px;
        font-family: PingFang SC, PingFang SC-Medium;
        font-weight: 500;
        text-align: center;
        color: #d6e5fa;
        letter-spacing: 1.6px;
        background: linear-gradient(to right, #3067f6, #2f6ed2);
        cursor: var(--cursor-pointer);

        &:hover {
          background: linear-gradient(to right, #2f6ed2, #3067f6)
        }
      }

      .input-area {
        width: 100%;
        height: 195px;
        padding: 34px 0 51px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
      }

      :deep(.el-input) {
        height: 40px;
        width: 280px;

        .el-input__wrapper {
          padding: 0;
          border: 0;
          background-color: transparent;
          box-shadow: none;
          border-bottom: 1px #ffffff44 solid;
          border-radius: 0;

          .el-input__prefix {
            padding-right: 10px;
          }

          .el-input__inner {
            border-radius: 0px;
            border-top-width: 0px;
            border-left-width: 0px;
            border-right-width: 0px;
            background-color: transparent;
          }
        }

        .fs {
          font-size: 20px;
        }
      }
    }
  }
}
</style>
