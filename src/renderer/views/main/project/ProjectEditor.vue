<template>
  <div class="project-editor" :class="{ embedded: props.embedded }" :style="{
    '--var-pointer-events-isDraggingWidget': isDraggingWidget ? 'none' : undefined,
  }" tabindex="1" @click.stop="handleMouseClick" @paste="pasteImageToWidget" v-if="project">
    <div class="el-header" v-if="!props.embedded">
      <div :class="['title', { 'is-changed': isConnectionInited && projectChanged}]">
        <div>
          <span :title="projectName">{{ projectName }}</span>
        </div>
      </div>
      <div class="tools">
        <el-scrollbar>
          <template v-if="selectedWidgets.length === 1">
            <component :widget="activeWidget" v-if="activeWidget.enabled && activeWidget?.toolbar" :is="activeWidget?.toolbar"></component>
          </template>
        </el-scrollbar>
      </div>
      <div class="menus">
        <el-button size="small" @click="previewPage">
          <el-icon size="16"><i-ven-form-preview /></el-icon>
          <span>{{ $t('formCreate.preview') }}</span>
        </el-button>
        <el-button class="save" size="small" @click="saveProject()">{{ $t('projectEditor.save') }}</el-button>
        <el-button class="publish" type="success" size="small" @click="handlePublish">{{ $t('projectEditor.published') }}</el-button>
      </div>
    </div>
    <teleport to="body">
      <widget-context-menu ref="widgetContextMenuRef" />
    </teleport>
    <el-container class="main-container" :class="{ 'has-pinned-panel': props.embedded && isBoardPropertyPinned }">
      <teleport v-if="props.layerPanelVisible" :disabled="!leftContainer" :to="leftContainer">
        <project-editor-the-left ref="projectEditorTheLeftRef" style="width: 100%; height: 100%;" />
      </teleport>
      <div
        v-if="props.embedded && props.catalogVisible"
        ref="catalogPanelRef"
        class="project-editor-floating-panel project-editor-catalog-panel"
        :style="floatingCatalogPanelStyle"
      >
        <widget-list
          @drag-start="handleCatalogPanelDragStart"
          @addWidget="handleAddWidget"
          :modelValue="catalogVisible"
          :widgetListVisible="listVisible"
          @update:modelValue="emit('update:catalogVisible', $event)"
        ></widget-list>
      </div>
      <div class="project-core-wrapper" ref="projectCoreWrapperRef" @drop="handleDrop" @dragover.prevent.stop>
        <div class="add-form-container" @mouseup.self="handleClickOutside" v-if="isShowFormCreate">
          <div class="add-form" ref="addFormRef" :style="{
          top: `${formCreatePosition.y}px`,
          left: `${formCreatePosition.x}px`,
        }">
            <div class="add-form-middle">
              <div class="add-form-item" @click.stop.prevent="addFormFn('table')">{{ $t("projectEditor.tableWidget") }}</div>
              <div class="add-form-middle-main"></div>
              <div class="add-form-item" @click.stop.prevent="addFormFn('form')">{{ $t("projectEditor.formWidget") }}</div>
            </div>
          </div>
        </div>
        <project-core :project="project" :isScreenBoard="isScreenBoard" :autoFullScreen="autoFullScreen" :foreView="foreView" :backView="backView" ref="projectCoreRef"
          @mousewheel.stop="handleBoardMouseWheel" :is-editor="true" @menuClicked="handleClickMenu" @dblclick.stop="handleBoardDblclick">
          <template #tabs v-if="false">
            <div class="bottom-container" ref="bottomContainerRef">
              <div class="tabs">
                <div class="drag-cursor"
                  :style="{ left: `${dragEndPosition * 130}px`, transform: project.foreboard ? `translateX(calc(130px - 5px))` : `translateX(50px)` }"
                  v-show="dragging">
                </div>
                <div class="boards_tabs" ref="boardsTabs">
                  <div class="scroll_tabs" @wheel="tabsWheel">
                    <vn-stack-tab class="tab" v-for="(board, index) in project.boards" :key="board.uid" :name="board.uid" @mousedown.stop
                      @click="onTabChange(board.uid, 'basic', $event)" @dblclick="onDoubleClickTab(board)" @dragstart="onTabDragStart(index)"
                      @dragover="onTabDragOver($event, index)" @dragend="onTabDragEnd" :draggable="!(editBoardTab.id === board.uid)">
                      <div :title="board.name" style="width: calc(100% + 10px);height: 100%;margin-left: -10px;padding: 0 10px;" @contextmenu.prevent.stop="handleContextMenuShow($event, board)">
                        <el-icon class="icon" v-if="!allBoard?.boards?.[board.uid]?.isReady()">
                          <i-ven-tab-loading></i-ven-tab-loading>
                        </el-icon>
                        <el-icon class="icon" v-else><i-ep-data-board /></el-icon>
                        <input class="name-input" type="text" v-if="editBoardTab.id === board.uid" v-model="editBoardTab.name"
                          @blur="onTabNameBlur" placeholder="" @mouseup.stop="" @keyup.enter="inputEls[board.uid].blur()" :ref="(el: HTMLInputElement)=>{inputEls[board.uid]=el}" />
                        <span v-else>{{ board.name }}</span>
                        <i class="fs fs-remove btn-remove" @click.stop="removeScreen(board.uid)"></i>
                      </div>
                    </vn-stack-tab>
                  </div>
                </div>
                <div class="new-tab" @click="addScreen()"><i class="fs fs-add"></i></div>
              </div>
              <div class="zoom">
                <span class="zoom-icon key-list">
                  <el-icon size="20" :title="$t('projectEditor.shortcutList')" @click="toggleShortcutKeyList"><i-uil-keyboard /></el-icon>
                </span>
                <span class="zoom-icon key-list">
                  <el-icon size="20" :title="$t('projectEditor.consolePanel')" @click="toggleConsolePanel"><i-ant-design-code-twotone /></el-icon>
                </span>
                <div v-if="shortcutKeyListVisible && projectVisible" @mouseup.self="shortcutKeyListVisible = false" class="shortcut-list-wrapper">
                  <shortcut-key-list @close="closeShortcutKeyList"></shortcut-key-list>
                </div>
                <div v-if="consolePanelVisible" @mouseup.self="consolePanelVisible = false" class="console-panel-wrapper">
                  <console-panel @close="closeConsolePanel"></console-panel>
                </div>
              </div>
            </div>
          </template>
          <template #empty>
            <div class="board-empty">
              <img src="@renderer/assets/image/nocode/form-empty.png" alt="">
              <p>{{ $t("projectEditor.clickOrDrag") }}</p>
            </div>
          </template>
        </project-core>
      </div>
      <div
        v-if="props.embedded && props.propertyPanelVisible"
        ref="propertyPanelRef"
        class="project-editor-floating-panel project-editor-property-panel"
        :class="{ 'is-pinned': isBoardPropertyPinned }"
        :style="floatingPropertyPanelStyle"
      >
        <div class="project-editor-floating-panel__header project-editor-floating-panel__header--property" :class="{ 'is-draggable': !isBoardPropertyPinned }" @mousedown.stop="handlePropertyPanelDragStart">
          <bread-crumbs class="project-editor-floating-panel__breadcrumbs" />
          <button
            type="button"
            class="project-editor-floating-panel__pin"
            @click.stop="toggleBoardPropertyPinned"
          >
            <el-icon v-if="isBoardPropertyPinned"><i-ven-icon-no-nail /></el-icon>
            <el-icon v-else><i-ven-icon-nail /></el-icon>
          </button>
          <button
            type="button"
            class="project-editor-floating-panel__close"
            @click.stop="emit('update:propertyPanelVisible', false)"
          >
            <el-icon :size="16"><i-ep-close /></el-icon>
          </button>
        </div>
        <div class="project-editor-floating-panel__body project-editor-floating-panel__body--property">
          <project-editor-the-right style="width: 100%; height: 100%;" :show-breadcrumbs="false" />
        </div>
      </div>
      <project-editor-the-right v-if="!props.embedded && props.propertyPanelVisible" />
    </el-container>
    <div :id="`resize-masks-${projectId}`" class="resize-masks"></div>
    <div :id="`option-group-overflow-masks-${projectId}`" class="option-group-overflow-masks"></div>
  </div>
  <project-warning-dialog v-if="dialogStorage.projectWarningDialogVisible" v-model="dialogStorage.projectWarningDialogVisible" @closed="quitProject" ></project-warning-dialog>
  <confirm-delete-dialog v-if="dialogStorage.confirmDeleteDialogVisible" v-model="dialogStorage.confirmDeleteDialogVisible" :deleteName="deleteName" @picked="handlepicked" :deleteType="deleteType"></confirm-delete-dialog>
  <single-context-menu v-if="contextMenu.visible" :menus="contextMenu.menus" :event="contextMenu.event" v-model="contextMenu.visible" :modal="true"  />
  <loading-dialog v-if="dialogStorage.loadingDialogVisible" v-model="dialogStorage.loadingDialogVisible"></loading-dialog>
</template>

<script lang="ts" setup>

import { ref, provide, inject, watch, toRaw, computed, Ref, shallowRef, ShallowRef, nextTick, CSSProperties, reactive, onErrorCaptured, unref, readonly, onUnmounted, onMounted, markRaw, ComputedRef, onBeforeUnmount } from "vue";
import axios from "axios";
import { unique } from "@common/utils/unique";
import { BoardSoul, DataCondition, Soul, WidgetSoul, CoEditingAccount, ProjectBody, Connection, ConnectionData, Options, ApplyStatus, QueryOptions, OptionTableUID, OptionFieldUID, SettingTab, Table } from "@common/types/project";
import { useMagicKeys, onKeyStroke, watchOnce, whenever, useActiveElement, useEventListener, useClipboard, useResizeObserver } from "@vueuse/core";
import { and, or, not } from "@vueuse/math";
import { ElContainer, ElIcon, ElInput, ElMessage,ElMessageBox } from "element-plus";
import type { Action } from 'element-plus';
import { isBoard, AllBoard, OptionFieldValue, ProjectContext, isOptionFieldValue, WidgetMenuContext, ParsedRef, isWidget, DeployNavDialogArgs, LogsObj, ProjectLog } from "@renderer/b2/types";
import { Board } from "@renderer/b2/controllers/board";
import { Widget } from "@renderer/b2/controllers/widget";
import { Element } from "@renderer/b2/controllers/element";
import { Bucket } from "@common/types/project";
import { getProjectFirstScreenBoardIds, loadWidgetsInProject } from "@renderer/b2/utils/widget.util";
import { restoreBoardSoul } from "@renderer/b2/utils/soul.util";
import { Socket } from "socket.io-client";
import { useSettingStore, useProjectDialogStore, usePassportStore } from "@renderer/stores";
import dayjs from 'dayjs';
import { deepClone, equals, isEmpty } from "@common/utils/object";
import { FormTableRuntime } from "@common/types/nocode";
import { handlePastedWidgetsSoul, mergeObjects, getSocket, provideRuntime } from "@renderer/utils";
import { WarnTriangleFilled } from "@element-plus/icons-vue";
import { HANDLE_PROJECT_RENAMED, CLOSE_PROJECT, PROJECT, PROJECT_ID, ALL_BOARD, MODIFY_DATA_CONDITIONS, SELECTED_WIDGETS,
  ACTIVE_WIDGET, HOVER_WIDGET, ACTIVE_ELEMENT, ACTIVE_BOARD, ACTIVE_BOARD_ID, FORE_BACK_ZOOM_X_Y, WIDGET_CATALOG_REF,
  ACTIVE_CONTAINER, ALL_BOARD_DOM, VISIBLE, HANDLE_PROJECT_SNAPSHOTTED, ACTIVE_ELEMENT_LOCKED, MERGE_WIDGETS_FUN, CLONE_WIDGET, PROJECT_PARAMS, 
  HANDLE_WIDGET_MOVE_DOWN, HANDLE_WIDGET_MOVE_UP, HANDLE_WIDGET_TO_BOTTOM, HANDLE_WIDGET_TO_TOP, PROJECT_CHANGED, CANCEL_MERGE_WIDGETS,
  CO_EDITING_ACCOUNTS, EDIT_BOARD_MODULE, EDIT_PROJECT_MODULE, CUR_CO_EDITING_ACCOUNT, PARENT_ID, GET_LIST, PRESENTER_INFO, HANDLE_PASTED_WIDGETS, IS_PROJECT_READY, WIDGET_MENU_CONTEXT, IS_WEB_SHARE, NOT_USING_INPUT, HAS_NO_DIALOG_VISIBLE, MOVE_WIDGETS_FUN, IS_DRAGGING_WIDGET, PROJECT_TABLE_DRAGGING, SHOW_DATA_CONDITION_DIALOG, HAS_WIDGET_MOUNTED, COPY_STYLES, UPDATE_OPENING_PROJECT_LIST, RechargeSubType, RechargeType, RechargeChannelDialogArgs, LOGS_INFO_OBJ,
  CLOUD_HOST_STATUS, DO_COPY,
IS_EDITABLE,
SWITCH_CATALOG_TAB,
NOCODE,
ORGANIZE_UTIL,
SAVE_PROJECT,
IS_PICKING_ELEMENT,
PICKED_ELEMENT,
PREVIEW_NOCODE_LAYER} from "@renderer/types";
import { usePlatform } from "@renderer/hooks";
import i18next from "i18next";
import { handleCopyName, shouldMarkProjectManualChanged } from "@common/utils";
import { getNocodeDataSourceByUID } from "@common/utils/connection";
import {
  buildRuntimeBoardConnections,
  buildRuntimeSources,
  createRuntimeConnectionLoader,
  getRuntimeSourceAggregateFieldSignature,
  type RuntimeSource,
} from "./runtimeConnectionLoader";
import md5 from "md5";
import { SaasPlan } from "@common/types/user";
import { buildTree, formDataApi } from "@renderer/views/nocode/utils";
import { EMBEDDED_BOARD_FLOATING_PANEL_Z_INDEX, resolveProjectFloatingPanelMetrics } from "./projectEditorFloatingPanels";
import { clampFloatingPanelPosition, resolveFieldCatalogCollisionInsets, resolveFieldCatalogDragPosition } from "@renderer/views/nocode/views/editor/formDesignerFloatingPanels";
import { editorPanelLayouts, resolveEditorPanelPosition, setEditorPanelPinned, updateEditorPanelFloatingPosition } from "@renderer/views/nocode/views/editor/editorPanelPinning";
import { createCoordinationReadyGate } from "./projectCoordinationReadyGate";

const projectDialogState = useProjectDialogStore();

const props = defineProps<{
  projectId: string,
  projectName: string,
  autoFullScreen: boolean,
  active?: boolean,
  nocodeId?: string,
  leftContainer?: HTMLElement | string,
  embedded?: boolean,
  catalogVisible?: boolean,
  layerPanelVisible?: boolean,
  propertyPanelVisible?: boolean,
}>();

const emit = defineEmits<{
  (event: "saved"),
  (event: "open-setting", settingTab?: SettingTab);
  (event: "update:catalogVisible", value: boolean);
  (event: "update:propertyPanelVisible", value: boolean);
}>();

const passportState = usePassportStore();

const contextMenu = reactive({
  event: null as MouseEvent,
  visible: false,
  board: null as BoardSoul,
  menus: [
    {
      get label() { return i18next.t("projectEditor.renameBoard") },
      icon: IEpEdit,
      click: () => {
        onDoubleClickTab(contextMenu.board);
      },
    },
    {
      get label() { return i18next.t("projectEditor.deleteBoard") },
      icon: IEpDelete,
      click: () => {
        removeScreen(contextMenu.board.uid)
      },
    },
  ]

});

const dialogStorage = projectDialogState.initStorage(props.projectId);

let getList: (parentId?: string) => Promise<void>;
let closeProject: Function;
let handleProjectRenamed: (projectId: string, name: string) => void;
let handleProjectSnapshotted: (projectId: string) => void;
let updateOpeningList: (type: 'open' | 'close', projectId: string) => void;
const pasteMd5Salt = "--banban--";

getList = async (parentId?: string) => {
    if (window.opener) {
      try {
        window.opener.postMessage({
          type: 'getList',
        }, window.opener.origin);
      } catch (err) {
        console.error(err.message)        
      }
    }
}
closeProject = window.close;
handleProjectRenamed = (projectId: string, name: string) => {
    document.title = name;
    console.log('name',name)
    if (window.opener) {
      window.opener.postMessage({
        type: 'rename',
        data: {
          projectId,
          name,
        }
      }, window.opener.origin);
    }
}
handleProjectSnapshotted = (projectId: string) => {
    if (window.opener) {
      window.opener.postMessage({
        type: 'snapshot',
        data: {
          projectId,
        }
      }, window.opener.origin);
    }
}
updateOpeningList = (type: 'open' | 'close', projectId: string) => {
    if (window.opener) {
      window.opener.postMessage({
        type: 'updateOpening',
        data: {
          type,
          projectId,
        }
      }, window.opener.origin);
    }
}

const clientId = unique(32);      // 客户端Id，访问项目时生成，用于在多处同时访问同一个项目时区分不同的客户端
const widgetMenuContext = reactive<WidgetMenuContext>({});    // 组件菜单的上下文对象
const widgetContextMenuRef = ref();
widgetMenuContext.showWidgetMenu = (...args) => {
  widgetContextMenuRef.value.show(...args);
}
const projectCoreRef = ref(null);
const presenterInfo = ref('');
const coEditingAccounts = ref<CoEditingAccount[]>([]);
const curCoEditingAccount = ref<CoEditingAccount>();
let projectSocket: Socket;
const coordinationReadyGate = createCoordinationReadyGate();

type CopiedData = {
  copyType: "widget",
  originalProjectId: string,
  originalBoardId: string,
  copiedDataConditions: DataCondition[],
  copiedConnections: Connection[],
  widgetSouls: WidgetSoul[]
}

type SyncCoEditingAccountsData = {
  coEditingAccounts: CoEditingAccount[],
  curCoEditingAccount: CoEditingAccount
}

if (!inject(PROJECT_TABLE_DRAGGING)) {
  provide(PROJECT_TABLE_DRAGGING, ref(false));
}

const documentVisibility = ref(true);
const projectVisible = computed(()=>{
  return documentVisibility.value;
});

const hasNoDialogVisible =  computed(() => !dialogStorage.hasVisible());

const isEditable = computed(() => activeBoard.value?.status?.isEditable)

// 在编辑项目整体部分的那个CoEditingAccount
const editingProjectModuleCoEditingAccount = computed(() => {
  return coEditingAccounts.value.find(coEditingAccount => {
    if(passportState.account.id !== coEditingAccount.id) {
      return coEditingAccount.editModule === 'project' || coEditingAccount.editModule === 'all'
    }
  })
});


const editProjectModule = async (): Promise<boolean> => {
  if (passportState.mode === 'user') return true;
  if (!projectSocket){
    ElMessage.warning(i18next.t("projectEditor.coordinationSocketWarning"));
    return false;
  }
  // 检查有无其他人在编辑整个项目
  if (!!editingProjectModuleCoEditingAccount.value) {
    ElMessage.warning(i18next.t("projectEditor.usingTip", {account: editingProjectModuleCoEditingAccount.value.nickname}));
    return false;
  }
  if (!await coordinationReadyGate.wait()) return false;
  return new Promise((resolve) => {
    projectSocket.emit('update-coordination-states', { editModule: 'project' }, (success) => {
      if (!success) {
        ElMessage.error(i18next.t("projectEditor.editBoardError"));
        resolve(false);
        return;
      }
      resolve(success);
    });
  })
}

const hasEditBoardIds = ref<string[]>([]);
const getEditingBoardModuleCoEditingAccount = (boardId: string) => {
  return coEditingAccounts.value.find(coEditingAccount => {
    if(passportState.account.id !== coEditingAccount.id) {
      return coEditingAccount.boardUIDs?.includes(boardId);
    }
  });
};

const checkBoardEditable = (boardId = activeBoard.value.uid) => {
  if (!projectSocket){
    if (!hasEditBoardIds.value.includes(boardId)) {
      hasEditBoardIds.value.push(boardId);
    }
    ElMessage.warning(i18next.t("projectEditor.coordinationSocketWarning"));
    return false;
  }
  const coEditingAccount = getEditingBoardModuleCoEditingAccount(boardId);
  if (!!coEditingAccount) {
    ElMessage.warning(i18next.t("projectEditor.cannotEditBoardTip", {account: coEditingAccount.nickname}));
    return false;
  }
  return true;
}
const editBoardModule = async (boardId = activeBoard.value.uid): Promise<boolean> => {
  if (!checkBoardEditable(boardId)) return false;
  if (passportState.mode !== 'user' && !await coordinationReadyGate.wait()) return false;
  return new Promise<boolean>((resolve) => {
    projectSocket?.emit('update-coordination-states', { editModule: 'board', boardId }, (success) => {
      if (!success) {
        ElMessage.error(i18next.t("projectEditor.editBoardError"));
        resolve(false);
        return;
      }
      resolve(success);
    });
  });
}

const showDataConditionDialog = async () => {
  if (!await editProjectModule()) return;
  dialogStorage.show('dataConditionDialogVisible');
}

provide(VISIBLE, projectVisible);
provide(IS_EDITABLE, isEditable);
provide(CO_EDITING_ACCOUNTS, coEditingAccounts);
provide(CUR_CO_EDITING_ACCOUNT, curCoEditingAccount);
provide(EDIT_PROJECT_MODULE, editProjectModule);
provide(EDIT_BOARD_MODULE, editBoardModule);
provide(PRESENTER_INFO, presenterInfo);
provide(SHOW_DATA_CONDITION_DIALOG, showDataConditionDialog);

const boardsTabs = ref<HTMLDivElement>(null)
const tabsWheel = (ev: WheelEvent) => {
  // 获取滚动方向
  const detail = ev["wheelDelta"];
  // 定义滚动方向
  const moveForwardStep = 1;
  const moveBackStep = -1;
  // 定义滚动距离
  let step = 0;
  // 判断滚动方向,设置滚动幅度
  if (detail < 0) {
    step = moveForwardStep * 50;
  } else {
    step = moveBackStep * 50;
  }
  
  // 对需要滚动的元素进行滚动操作
  boardsTabs.value.scrollLeft += step;
}

const nocode = inject(NOCODE);
const updateNocodeMainSign = (sign: string) => {
  if (nocode?.value?.body) {
    nocode.value.body.sign = sign;
  }
};
const project = ref<ProjectBody>();
const projectId = props.projectId;
let reconnectCallback: Function;
const initCoordinationStates = () => {
  if(passportState.mode === 'user') return;
  const coordinationReadyVersion = coordinationReadyGate.reset();
  projectSocket.off("disconnect").on("disconnect", (message) => {
    console.log('socket disconnect', message);
    coordinationReadyGate.reset();
    const coEditingAccount = deepClone(curCoEditingAccount.value);
    reconnectCallback = () => {
      if (coEditingAccount.id === passportState.account.id) {
        if (coEditingAccount.editModule === "all") {
          editProjectModule();
        }
        const boardUIDs = coEditingAccount.boardUIDs || [];
        for (const boardId of boardUIDs) {
          editBoardModule(boardId);
        }
      }
      reconnectCallback = null;
    }
    if (message === "io server disconnect") {
      projectSocket.once("connect", () => {
        ElMessage.success(i18next.t("projectEditor.socketReconnectSuccess"));
      });
      projectSocket.connect();
      ElMessageBox.alert(i18next.t("projectEditor.socketDisconnectTip"), i18next.t("projectEditor.joinCoEditInvalidTitle"), {
        type: "warning",
        confirmButtonText: i18next.t("projectEditor.confirmLabel"),
        showClose: false,
      })
    } 
  })
  projectSocket.off("sync-coEditingAccounts").on('sync-coEditingAccounts', (data: SyncCoEditingAccountsData) => {
    coEditingAccounts.value = data.coEditingAccounts;
    curCoEditingAccount.value = data.curCoEditingAccount;
    // 更新board的状态
    const boards = Object.values(allBoard.boards).concat(allBoard.foreBoard ?? [], allBoard.backBoard ?? []) as Board[];
    const editingBoards = data.coEditingAccounts.reduce((prev, item) => {
      if (item.id === passportState.account.id) return prev;
      return prev.concat(item.boardUIDs || []);
    }, [])
    for (const board of boards) {
      if (editingBoards.includes(board.uid)) {
        board.status.isEditable = false;
      } else {
        board.status.isEditable = true;
      }
    }
  });

  projectSocket.off("sync-projectBody").on('sync-projectBody', async (data) => {
    const { coEditingAccount, projectBody }: { coEditingAccount: CoEditingAccount, projectBody: ProjectBody } = data;
    const currentBoardId = activeBoardId.value;
    const boardUIDs = coEditingAccount.boardUIDs;
    // 先加载修改源项目的组件
    await loadWidgetsInProject(projectBody);
    // 对前景与背景看板被移除的做处理
    if (project.value.foreboard && !projectBody.foreboard) {
      delete project.value.foreboard;
    }
    if (project.value.backboard && !projectBody.backboard) {
      delete project.value.backboard;
    }
    if(coEditingAccount.editModule !== 'board') {
      // await getConnectionData();
    }
    // 拷贝修改源项目到当前项目内
    for (const key in projectBody) {
      if (key !== 'foreboard' && key !== 'backboard' && key !== 'boards' && key !== 'connections') {
        // 非board相关直接赋值
        project.value[key] = projectBody[key];
      } else {
        // board相关先处理前景后景看板
        if (key === 'foreboard' && !project.value.foreboard) {
          project.value[key] = projectBody[key];
        } else if (key === 'backboard' && !project.value.backboard) {
          project.value[key] = projectBody[key];
        } else if (key === 'foreboard' && project.value.foreboard && boardUIDs?.includes(projectBody.foreboard.uid)) {
          restoreBoardSoul(allBoard.foreBoard, projectBody.foreboard);
        } else if (key === 'backboard' && project.value.foreboard && boardUIDs?.includes(projectBody.backboard.uid)) {
          restoreBoardSoul(allBoard.backBoard, projectBody.backboard);
        } else if (key === "boards") {
          // 首先对改动的看板进行widget映射进行处理
          boardUIDs?.forEach(boardUID => {
            const oldBoard = allBoard.boards[boardUID];
            const newBoardSoul = projectBody.boards.find(bo => bo.uid === boardUID);
            if (newBoardSoul) {
              // 新增的看板则添加到当前项目内
              if (!oldBoard) {
                project.value.boards.push(newBoardSoul);
              } else {
                // 编辑原有的看板则进行映射处理
                restoreBoardSoul(oldBoard, newBoardSoul);
              }
            }
          })
          // 为当前项目添加所有修改源项目新增的子看板
          projectBody.boards.forEach(boardSoul => {
            if (!project.value.boards.find(board => board.uid === boardSoul.uid)) {
              project.value.boards.push(boardSoul);
            }
          })
          // 删除当前项目中修改源项目删除的子看板
          project.value.boards.forEach((boardSoul, index) => {
            if (!projectBody.boards.find(board => board.uid === boardSoul.uid)) {
              project.value.boards.splice(index, 1);
            }
          })
          // 当前项目子看板按照修改源项目进行排序
          project.value.boards.sort((prevBoardSoul, nextBoardSoul) => {
            return projectBody.boards.findIndex(boardSoul => boardSoul.uid === prevBoardSoul.uid) - projectBody.boards.findIndex(boardSoul => boardSoul.uid === nextBoardSoul.uid);
          })
        }
      }
    }
    if (coEditingAccount.id === curCoEditingAccount.value.id) {
      ElMessage.success(i18next.t("projectEditor.syncProjectSuccess"));
    } else {
      ElMessage.success(coEditingAccount.nickname + i18next.t("projectEditor.updateProjectSuccess"))
    }
    // console.log('同步完成')
    nextTick(() => {
      const allBoardUIDs = [allBoard.foreBoard?.uid || [], Object.keys(allBoard.boards), allBoard.backBoard?.uid || []].flat(Infinity);
      if (allBoardUIDs.includes(currentBoardId)) {
        activeBoardId.value = currentBoardId;
      }
    });

    // TODO 同步之后页面根据projectBody进行重绘
  })

  projectSocket.off("error").on('error', (data) => {
    ElMessage.error(data?.message);
  })

  projectSocket.emit('join-coordination-edit',{}, (data) => {
    const joined = data?.success === true;
    coordinationReadyGate.resolve(coordinationReadyVersion, joined);
    if (data?.message) {
      ElMessageBox.alert(data?.message, i18next.t("projectEditor.joinCoEditInvalidTitle"), {
        type: "warning",
        confirmButtonText: i18next.t("projectEditor.joinCoEditInvalidTipConfirm"),
        showClose: false,
        callback() {
          location.href = location.origin;
        }
      })
    }
    if (!joined) return;
    if (typeof reconnectCallback === "function") {
      reconnectCallback();
    } else {
      // ElMessage.success(i18next.t("projectEditor.joinCoEditSuccess"));
    }
  });

  if (hasEditBoardIds.value.length > 0) {
    for (const boardId of hasEditBoardIds.value) {
      editBoardModule(boardId).then((success) => {
        if (success) {
          const index = hasEditBoardIds.value.findIndex(item => item === boardId);
          hasEditBoardIds.value.splice(index, 1);
        }
      })
    }
  }
}


const initProjectSocket = async () => {
  const query = {
    projectId,
    clientId,
    nocodeId: props.nocodeId,
  }
  Object.assign(query, {
    accountId: passportState.account?.id,
    isCoordinationEdit: true,
  });
  projectSocket = await getSocket({
    ioOptions: {
      closeOnBeforeunload: false,
      query,
    }
  });
  projectSocket.off("connect").on('connect' , () => {
    initCoordinationStates();
  });
}

let cleanDocumentVisibility: () => void;
onMounted(() => {
  cleanDocumentVisibility = useEventListener(document, 'visibilitychange', ()=>{
    documentVisibility.value = document.visibilityState === 'visible'
  })
})
onUnmounted(() => {
  coordinationReadyGate.dispose();
  projectSocket?.disconnect();
  delete window["temp"];
  clearAutoSaveProjectTimer(); //清除自动保存的定时器
  cleanDocumentVisibility?.();
  cleanWindowPaste();
  clearTimeout(projectExpireTimeOut);
  projectDialogState.removeStorage(projectId);
  projectSocket?.disconnect();
});

window.addEventListener('beforeunload',()=>{
  updateOpeningList('close', projectId);
})

const quitProject = () => {
  window.close();
}
const _activeElement = useActiveElement() as unknown as ComputedRef<HTMLElement>;
const notUsingInput = computed(() => {
  return _activeElement.value?.tagName !== 'INPUT' && _activeElement.value?.tagName !== 'TEXTAREA';
});
const { Ctrl_N, Meta_N, space, shift, ctrl, alt, Ctrl_C, Meta_C, Ctrl_Z, Meta_Z, Ctrl_Shift_Z, Meta_Shift_Z, Ctrl_Y, Meta_Y, Delete, Backspace, Ctrl_A, Meta_A, F1, Ctrl_S, Meta_S, Ctrl_Shift_S, Meta_Shift_S, Ctrl_Semicolon, Meta_Semicolon, Ctrl_Alt_Semicolon, Meta_Alt_Semicolon, Ctrl_G, Meta_G, Ctrl_F5, Meta_F5, Ctrl_Shift_G, Meta_Shift_G, Ctrl_R, Meta_R, Ctrl_P, Meta_P, Ctrl_Shift_H, Meta_Shift_H, Ctrl_Shift_L, Meta_Shift_L, } = useMagicKeys({
  passive: false,
  onEventFired(e) {
    //阻止一些浏览器或客户端中默认的功能
    if (e.type === "keydown" && notUsingInput.value) {
      const _ctrl_a = ((e.ctrlKey || e.metaKey) && e.key === "a");
      const _f1 = (e.key === "F1");
      const _ctrl_s = ((e.ctrlKey || e.metaKey) && e.key === "s");
      const _ctrl_g = ((e.ctrlKey || e.metaKey) && e.key === "g");
      const _ctrl_n = ((e.ctrlKey || e.metaKey) && e.key === "n");
      const _ctrl_y = ((e.ctrlKey || e.metaKey) && e.key === "y");
      const _ctrl_r = ((e.ctrlKey || e.metaKey) && e.key === "r");
      const _ctrl_p = ((e.ctrlKey || e.metaKey) && e.key === "p");
      const _meta_s = (e.metaKey && e.key === "s");
      if(_ctrl_a || _f1 || _ctrl_s || _meta_s || _ctrl_g || _ctrl_n || _ctrl_y  || _ctrl_r || _ctrl_p){
        e.preventDefault();
      }
    }
  }
});

const shortcutKeyListVisible = ref(false)
const closeShortcutKeyList = () => {
  shortcutKeyListVisible.value  = false
}
const toggleShortcutKeyList = () => {
  shortcutKeyListVisible.value  = !shortcutKeyListVisible.value
  if(shortcutKeyListVisible.value){
    closeConsolePanel()
  }
}

const logsObj = reactive<LogsObj>({
  projectLogs: []
})
provide(LOGS_INFO_OBJ, logsObj)
const consolePanelVisible = ref(false)
const closeConsolePanel = () => {
  consolePanelVisible.value  = false
}
const toggleConsolePanel = () => {
  consolePanelVisible.value  = !consolePanelVisible.value
}

const allBoard: AllBoard = reactive({
  boards: {}
});
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
const allBoardDom = ref<{ [key: string]: HTMLElement }>({});
const boardIdx = ref();

const activeBoardId = ref<string>();
const activeBoard = computed(() => {
  if (activeBoardId.value === allBoard.foreBoard?.uid) return allBoard.foreBoard;
  if (activeBoardId.value === allBoard.backBoard?.uid) return allBoard.backBoard;
  return allBoard.boards?.[activeBoardId.value];
});
watch(()=>activeBoardId.value, ()=>{
  selectedWidgets.value = [];
  activeElementLocked.value = false;
})
const firstBoard = computed(() => {
  return allBoard.boards?.[project.value.boards?.[0]?.uid];
});

const projectConnectionData = ref<ConnectionData>({});
const mergedConnectionData = ref<ConnectionData>({});

const getRuntimeSources = (): RuntimeSource[] => {
  return buildRuntimeSources(nocode?.value?.body, nocode?.value?.meta?.id);
}
const runtimeSources = computed(() => getRuntimeSources());
const createProjectRuntimeConnectionLoader = () => {
  return createRuntimeConnectionLoader({
    currentConnectionUID: nocode?.value?.body?.formData?.uid,
    currentNocodeId: nocode?.value?.meta?.id,
    getRuntimeSources,
    projectConnectionData: projectConnectionData.value,
    mergedConnectionData: mergedConnectionData.value,
  });
}

let runtimeConnectionLoader = createProjectRuntimeConnectionLoader();

const runtimeConnectionSignature = computed(() => JSON.stringify({
  nocodeId: nocode?.value?.meta?.id,
  currentUID: nocode?.value?.body?.formData?.uid,
  currentTables: nocode?.value?.body?.formData?.tables?.map(table => table.uid) || [],
  currentAggregateFields: getRuntimeSourceAggregateFieldSignature(nocode?.value?.body?.formData),
  other: (nocode?.value?.body?.otherDataSources || []).map(source => ({
    uid: source.uid,
    nocodeId: source.nocodeId,
    tables: source.tables?.map(table => table.uid) || [],
    aggregateFields: getRuntimeSourceAggregateFieldSignature(source),
  })),
}));

watch(runtimeConnectionSignature, () => {
  runtimeConnectionLoader = createProjectRuntimeConnectionLoader();
  runtimeConnectionLoader.reset();
}, { immediate: true });

const getConnectionByUID = (uid: string): Connection => {
  return nocode?.value?.body?.connections?.find(c => c.uid === uid);
}
const boardConnections = computed(() => {
  return buildRuntimeBoardConnections(nocode.value?.body, nocode.value?.meta?.id, nocode.value?.meta?.name, runtimeSources.value);
});
const getConnections = () => {
  return boardConnections.value;
}

const typography = computed(()=>{
  if (project.value?.typography) {
    return project.value?.typography;
  }
  return "page";
});

const organizeUtil = inject(ORGANIZE_UTIL);
const projectContext: ProjectContext = {
  get typography() {
    return typography.value;
  },
  projectId,
  runtime: FormTableRuntime.BOARD_EDITOR,
  get nocodeId() {
    return props.nocodeId;
  },
  get projectName() {
    // return project.value.meta.name;
    return i18next.t('projectEditor.page');
  },
  get pagePermissionContext() {
    return {
      nocodeBody: nocode?.value?.body,
      departments: organizeUtil?.departments || [],
      account: usePassportStore().account,
    };
  },
  getElementByUID,
  get connectionData() {
    return projectConnectionData.value;
  },
  get mergedConnectionData() {
    return mergedConnectionData.value;
  },
  getBoards() {
    return Object.values(allBoard.boards).concat(allBoard.foreBoard ?? [], allBoard.backBoard ?? []) as Board[];
  },
  getConnections,
  getDataConditions() {
    return (project.value as any)?.dataConditions || [];
  },
  getNocodeBodyData() {
    return {
      formData: nocode?.value?.body?.formData,
      otherDataSources: nocode?.value?.body?.otherDataSources || [],
    };
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
  async updateToConnection(optionTableUID: OptionTableUID, rows: object[], keys?: OptionFieldUID[]) {
    if (!optionTableUID) return;
    const dataSource = getNocodeDataSourceByUID(nocode?.value?.body, optionTableUID[0], {
      nocodeId: nocode.value?.meta?.id,
      name: nocode.value?.meta?.name,
    });
    if (!dataSource && !nocode?.value?.body?.formData) return;
    return await formDataApi.updateData({
      nocodeId: dataSource?.nocodeId || nocode.value?.meta?.id,
      schemaNocodeId: nocode.value?.meta?.id,
      tableUID: optionTableUID[1],
      rows,
      keys,
      sign: nocode.value?.body?.sign,
      onMainSign: updateNocodeMainSign,
    })
  },
  async addToConnection(optionTableUID: OptionTableUID, rows: object[]) {
    if (!optionTableUID) return;
    const dataSource = getNocodeDataSourceByUID(nocode?.value?.body, optionTableUID[0], {
      nocodeId: nocode.value?.meta?.id,
      name: nocode.value?.meta?.name,
    });
    if (!dataSource && !nocode?.value?.body?.formData) return;
    return await formDataApi.addData({
      nocodeId: dataSource?.nocodeId || nocode.value?.meta?.id,
      schemaNocodeId: nocode.value?.meta?.id,
      tableUID: optionTableUID[1],
      rows,
      sign: nocode.value?.body?.sign,
      onMainSign: updateNocodeMainSign,
    })
  },
  async removeFromConnection(optionTableUID: OptionTableUID, rows: object[], keys?: OptionFieldUID[]) {
    if (!optionTableUID) return;
    const dataSource = getNocodeDataSourceByUID(nocode?.value?.body, optionTableUID[0], {
      nocodeId: nocode.value?.meta?.id,
      name: nocode.value?.meta?.name,
    });
    if (!dataSource && !nocode?.value?.body?.formData) return;
    return await formDataApi.deleteData({
      nocodeId: dataSource?.nocodeId || nocode.value?.meta?.id,
      schemaNocodeId: nocode.value?.meta?.id,
      tableUID: optionTableUID[1],
      rows,
      keys,
      sign: nocode.value?.body?.sign,
      onMainSign: updateNocodeMainSign,
    });
  },

  async readDataByOptions(optionTableUID, options) {
    return await runtimeConnectionLoader.readDataByOptions(optionTableUID, options);
  },


  /**
   * 数据编辑相关方法 -- end
   */
  async clone(widget: Widget, name, options) {
    const newSoul = Object.assign(deepClone(widget.getSoul()), {
      name: name || widget.name,
      widgets: [],
      isSnap: true,
    });
    mergeObjects(newSoul.options, options);
    const { pastedWidgetSouls } = await handlePastedWidgetsSoul([newSoul], projectId, activeBoardId.value);
    const { widgetSoul, oldUID } = pastedWidgetSouls[0];
    return await cloneWidget(widgetSoul, oldUID, widget.parent, false);
  },
  addProjectLog(log: ProjectLog) {
    logsObj.projectLogs.push({
      ...log,
      currentTime: dayjs(Date.now()).format('YYYY-MM-DD HH:mm:ss'),
    } as any);
  },
  selectWidgets(widgets) {
    selectedWidgets.value = widgets;
  },
};

const createBoard = (soul: Soul) => {
  const board = new Board(soul, projectContext, unique());
  board.status.isNew = false;
  board.status.isEditable = true;
  board.status.isConnectionInited = isConnectionInited.value;
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

const preventClose = ref(false);
const onClose = async (name: string)=>{
  const shouldClose = await ElMessageBox.confirm(
    i18next.t("projectEditor.projectSaveTip"),
    i18next.t("projectEditor.confirmLabel"),
    {
      distinguishCancelAndClose: true,
      confirmButtonText: i18next.t("projectEditor.saveText"),
      cancelButtonText: i18next.t("projectEditor.notSaveText"),
      type: "warning",
      icon: markRaw(WarnTriangleFilled),
      beforeClose: async (action, instance, done) => {
        if (action === 'confirm') {
          instance.confirmButtonLoading = true
          instance.confirmButtonText = i18next.t("projectEditor.saving")
          await saveProject();
          done();
          setTimeout(() => {
            instance.confirmButtonLoading = false
          }, 300);
        } else {
          done()
        }
      },
      customClass: "message-confirm-box"
    }
  )
  .then(async () => {
    //保存并退出
    return true;
  })
  .catch((action: Action) => {
    //如果点右上角的× 则action是close
    if(action === "cancel"){
      //不保存 直接返回正常关闭
      return true;
    }
    return false;
  })
  return shouldClose;
};

/**
 * 浏览器环境下需要单独实现阻止关闭
 */
//  const windowCloseListener = (e) => {
//   e.returnValue = i18next.t("projectEditor.saveNotSavedTip");
//   return i18next.t("projectEditor.saveNotSavedTip");
// };
// watch(preventClose, (value, prev) => {
//   if (prev === value) return;
//   if (value) {
//     window.addEventListener('beforeunload', windowCloseListener);
//   } else {
//     window.removeEventListener('beforeunload', windowCloseListener);
//   }
// });

const projectChanged = ref(true);//先设置为true，项目加载完成后设置为false
watch(projectChanged, (value)=>{
  if (value) {
    preventClose.value = true;
  } else {
    preventClose.value = false;
    watchOnce(()=>{
      const historyIds = [allBoard.foreBoard?.historyId, allBoard.backBoard?.historyId];
      for (const key in allBoard.boards) {
        historyIds.push(allBoard.boards[key].historyId);
      }
      return historyIds;
    },()=>{
      projectChanged.value = true;
    });
  }
});

provide(PROJECT_CHANGED, projectChanged)

const uploadFile = async (copiedFile: File) => {
  /* 文件传输到后端 */
  let params = new FormData();
  params.append('file', copiedFile);
  params.append('filename', copiedFile.name);
  params.append('projectId', projectId);
  params.append('type', 'resource');
  const res = await axios.post('/project/file', params, { headers: { 'Content-Type': 'multipart/form-data' } }).catch((err) => {
    console.log(i18next.t("projectEditor.saveFileFailed"));
  })
  if (res) {
    if (res.data.filePath) {
      // filePath是文件保存路径
      return {
        isLink: false,
        relativePath: res.data.filePath,
        uid: unique(),
        __opt_type: 'file'
      }
    }
  }
}

const isImageType = (test_str: string) => {
  var index = test_str.lastIndexOf('.') // 获取指定字符串最后一次出现的位置，返回index
  var str = test_str.substr(index + 1) // substr(start, length) 抽取从start下标开始的length个字符，返回新的字符串
  // toLowerCase() 将字符串转换为小写，返回一个新的字符串
  return ['png', 'jpg','jpeg', 'bmp', 'gif', 'webp', 'psd', 'svg', 'tiff'].indexOf(str.toLowerCase()) !== -1
}

const getImageSize = (url: string, callback: (width: number,height: number) => void) => {
  let image = new Image();
  let w: number, h: number;
  image.src = url;
  // 如果有缓存，读缓存
  if(image.complete){
    w = image.width;	// 图片宽度
    h = image.height;	// 图片高度
  }else {	//否则加载图片
    image.onload = function() {
      w = image.width;	// 图片宽度
      h = image.height;	// 图片高度
      image.onload = null;	// 避免重复加载
      callback(w, h)
    };
  }
}


let projectExpireTimeOut: number;
const warmupProjectWidgets = (projectBody: ProjectBody) => {
  requestIdleCallback(() => {
    void loadWidgetsInProject(projectBody);
  }, { timeout: 1500 });
}

const initProject = async () => {
  await passportState.init();
  await initProjectSocket();
  try {
    let res = await axios.get(`/project/get-layer?nocodeId=${props.nocodeId}&projectId=${props.projectId}`);
    const theProject: ProjectBody = res.data;
    await loadWidgetsInProject(theProject, {
      boardIds: getProjectFirstScreenBoardIds(theProject),
    });
    project.value = theProject;
    activeBoardId.value = theProject.boards[0]?.uid;
    boardIdx.value = theProject.boards.length;
    warmupProjectWidgets(theProject);
    console.log("read data done");

    isConnectionInited.value = true;
    projectChanged.value = false;
  } catch(err) {
    console.log("get project error", err);
    ElMessage.error(err.message);
    closeProject(projectId);
  }
};
initProject();

const selectedWidgets: Ref<Widget[]> = ref([]);
const hoverWidget: ShallowRef<Widget> = shallowRef();
const isDraggingWidget = ref(false);
const activeElementLocked = ref(false);
const copiedWidgetsSoulArr = reactive<CopiedData>({
  copyType: "widget",
  originalBoardId: '',
  originalProjectId: projectId,
  copiedConnections: [],
  copiedDataConditions: [],
  widgetSouls: []
})
watch(()=>hoverWidget.value, (value, oldValue)=>{
  if (value !== oldValue) {
    if (oldValue) {
      oldValue.status.isHover = false;
    }
    if (value) {
      value.status.isHover = true;
    }

    let oldParents: Widget[] = [];
    if (oldValue) {
      oldParents = oldValue.getParentWidgets() as Widget[];
    }
    let parents: Widget[] = [];
    if (value) {
      if (!value.locked && !value.isPlaying) {
        parents = value.getParentWidgets() as Widget[];
      }
    }
    if (activeWidget.value) {
      if (!activeWidget.value.locked && !activeWidget.value.isPlaying) {
        parents.push(...activeWidget.value.getParentWidgets() as Widget[]);
      }
    }
    for (const widget of oldParents) {
      if (widget && !parents.includes(widget)) {
        if (widget.status.canEditorChild !== false) {
          widget.status.canEditorChild = false;
        }
      }
    }
    for (const widget of parents) {
      if (!oldParents.includes(widget)) {
        widget.status.canEditorChild = true;
      }
    }
  }
}, {immediate: true});
watch(()=>[...selectedWidgets.value], (values, oldValues)=>{
  const uids = values.map((widget)=>widget.uid);
  const oldUids = oldValues?.map((widget)=>widget.uid);
  if (equals(uids, oldUids)) {
    return;
  }
  //selected
  for (const widget of oldValues ?? []) {
    if (!values.includes(widget)) {
      widget.status.isSelected = false;
    }
  }
  for (const widget of values) {
    if (!oldValues.includes(widget)) {
      widget.status.isSelected = true;
    }
  }
}, {immediate: true});
const activeWidget = computed(() => {
  return selectedWidgets.value[selectedWidgets.value.length-1];
});
watch(()=>activeWidget.value, (value, oldValue)=>{
  let oldParents: Widget[] = [];
  if (oldValue) {
    oldValue.status.isActive = false;
    oldParents = oldValue.getParentWidgets() as Widget[];
  }
  let parents: Widget[] = [];
  if (value) {
    value.status.isActive = true;
    if (!value.locked && !value.isPlaying) {
      parents = value.getParentWidgets() as Widget[];
    }
  }
  for (const widget of oldParents) {
    if (widget && !parents.includes(widget)) {
      if (widget.status.canEditorChild !== false) {
        widget.status.canEditorChild = false;
      }
    }
  }
  for (const widget of parents) {
    if (!oldParents.includes(widget)) {
      widget.status.canEditorChild = true;
    }
  }
});
const isPickingElement = ref<boolean>(false);
const pickedElement = ref<Element>();
const activeElement: ComputedRef<Element> = computed(() => {
  if(activeElementLocked.value){
    return activeElement.value;
  } else {
    let resElement: Element;
    resElement = activeWidget.value ?? activeBoard.value;
    window["temp"] = resElement;
    if (isPickingElement.value) {
      pickedElement.value = resElement;
      return activeElement.value;
    } else {
      return resElement;
    }
  }
});
const activeContainer = computed(() => {
  if (activeWidget.value) {
    if (activeWidget.value.container) {
      return activeWidget.value;
    } else if(!isBoard(activeWidget.value.parent)) {
      return activeWidget.value.parent;
    }
  }
  return activeBoard.value;
});
provide(ACTIVE_BOARD, activeBoard);
provide(SELECTED_WIDGETS, selectedWidgets);
provide(ACTIVE_WIDGET, activeWidget);
provide(ACTIVE_ELEMENT, activeElement);
provide(ACTIVE_ELEMENT_LOCKED, activeElementLocked);
provide(HOVER_WIDGET, hoverWidget);
provide(IS_DRAGGING_WIDGET, isDraggingWidget);
provide(ACTIVE_CONTAINER, activeContainer);
provide(IS_PICKING_ELEMENT, isPickingElement);
provide(PICKED_ELEMENT, pickedElement);


const inputEls: { [uid: string]: HTMLInputElement } = {};
/* 子看板重命名逻辑 */
const editBoardTab = ref({ name: "", id: "" });
const onDoubleClickTab = async (board: BoardSoul) => {
  if (!checkBoardEditable(board.uid)) return;
  editBoardTab.value = {
    id: board.uid,
    name: board.name
  };
  await nextTick();
  inputEls[board.uid]?.focus();
};

const onTabNameBlur = () => {
  if (isEditable.value && editBoardTab.value.id) {
    for (const id in allBoard.boards) {
      if (id === editBoardTab.value.id) {
        const board = allBoard.boards[id];
        board.name = editBoardTab.value.name;
        board.updateHistory();
      }
    }
  }
  editBoardTab.value = { name: "", id: "" };
};

/* 子看板重命名逻辑 结束 */

/* 子看板移动逻辑 */
const dragging = ref(false);
const dragStartPosition = ref(0);
const dragEndPosition = ref(0);
const onTabDragStart = (index: number) => {
  dragging.value = true;
  dragStartPosition.value = index;
};
const onTabDragOver = (ev: MouseEvent, index: number) => {
  // 130 为一个 Tab 的长度
  if (ev.offsetX < 65) {
    dragEndPosition.value = index;
  } else {
    dragEndPosition.value = index + 1;
  }
};
const onTabDragEnd = async () => {
  if (!await editProjectModule()) return dragging.value = false;
  if (dragStartPosition.value < dragEndPosition.value) {
    project.value.boards.splice(dragEndPosition.value - 1, 0, project.value.boards.splice(dragStartPosition.value, 1)[0]);
  } else if (dragStartPosition.value > dragEndPosition.value) {
    project.value.boards.splice(dragEndPosition.value, 0, project.value.boards.splice(dragStartPosition.value, 1)[0]);
  }
  dragging.value = false;
};
/* 子看板移动逻辑 结束 */

const handleBoardMouseWheel = function (ev) {
  if (ev.ctrlKey) {
    ev.preventDefault();//阻止默认缩放
  }
};


const bottomContainerRef = ref<HTMLDivElement>(null);
const handleBoardDblclick = function (_ev: MouseEvent) {
  selectedWidgets.value = [];
}
const widgetCatalogRef = ref(null);

provide(WIDGET_CATALOG_REF, widgetCatalogRef);

// 递归调用
//参数：父组件，当前组件，组件名字，是否是手动选中的组件
const cloneWidget = async (widgetSoul: WidgetSoul, oldUID: string, parent?: Widget | Board, isSameProject = true): Promise<Widget> => {
  if (!widgetSoul) return;
  let index: number;
  const parentContainer = parent ? parent : activeContainer.value
  if (parent) {
    index = parent.container.souls.findIndex(item => item.uid === oldUID)
    if (index === -1) index = parent.container.souls.length
  } else {
    if (activeWidget.value) {
      if (activeWidget.value.container) {
        index = activeWidget.value.container.souls.length;
      } else {
        index = activeWidget.value.parent.container.souls.findIndex(item => item.uid === activeWidget.value.uid);
      }
    } else {
      index = activeBoard.value.container.souls.length;
    }
  }
  let newWidget: Widget
  let soul: Soul = JSON.parse(JSON.stringify(widgetSoul));
  if (isSameProject) {
    soul.name = handleCopyName(soul.name)
  }
  newWidget = await parentContainer.container.addWidget(soul, index + 1) as Widget;
  // TODO 展开存在问题
  widgetCatalogRef.value?.expandWidgetParent(newWidget) as Widget;
  if (!isBoard(parentContainer)) {
    widgetCatalogRef.value?.expandWidget(parentContainer);
  }
  return newWidget;
};

// 将原先的elementOption转换为带有__opt_type的值
const transformOptionValue = function (widget: Widget, options, prePaths:string[]=[]) {
  for(const key in options){
    const paths = prePaths.concat(key);
    const optionVal = widget.getOptionType(paths);
    if(optionVal && !optionVal.type){
      if(Array.isArray(options[key]) || typeof options[key] !== "object") continue;
      transformOptionValue(widget, options[key], paths);
    }else if(optionVal && optionVal.type && /^(element|board|widget)/.test(optionVal.type)){
      if(!options[key].length) continue;
      let value;
      if(typeof options[key][0] === "string"){
        value = {
          elementPath: options[key],
          __opt_type: 'element',
        }
      }else if(Array.isArray(options[key][0])){
        value = options[key].map((val)=>{
          return {
            elementPath: val,
            __opt_type: 'element',
          }
        })
      }
      if(value) widget.setOption(paths, value);
    }
  }
}

// 递归转换soul里的elementOption
const handleCopiedElementOption = (element: Widget) => {
  transformOptionValue(element, element.getSoul().options, [])
  for (const widget of (element as Widget)?.widgets || []) {
    handleCopiedElementOption(widget);
  }
}

// 获取所有option所使用的connection
const getAllCopiedOptionConnections = (options: any, usedConnections: Connection[], usedConditions: DataCondition[]) => {
  for (const key in options) {
    if (isOptionFieldValue(options[key])) {
      (options[key] as OptionFieldValue[]).forEach((filedValue) => {
        const connectionUID = filedValue.uid[0];
        const isExist = usedConnections.find(connectionItem => connectionUID === connectionItem.uid);
        if (!isExist) {
          const usedConnection = getConnections().find(connection => connection.uid === connectionUID);
          usedConnection && usedConnections.push(usedConnection);
        }
      });
    } else {
      getAllCopiedOptionConnections(options[key] as any, usedConnections, usedConditions);
    }
  }
}

// 获取组件 options 中所使用的 connection
const getCopiedConnections = (soul: Soul, usedConnections: Connection[], usedConditions: DataCondition[]) => {
  getAllCopiedOptionConnections(soul.options, usedConnections, usedConditions);
}

const { copy } = useClipboard({ legacy: true });
const doCopy = async (copyText: string) => {
  const md5Sign = md5(copyText + pasteMd5Salt)
  await copy(md5Sign + copyText)
  ElMessage.success(i18next.t("projectEditor.copyTip"));
}
provide(DO_COPY, doCopy);

// 递归获取组件中的所有connection与dataCondition
const getCopiedConnectionsAndDataConditions = (soul: WidgetSoul, copiedConnections: Connection[], copiedDataConditions: DataCondition[]) => {
  getCopiedConnections(soul, copiedConnections, copiedDataConditions);
  for (const widget of (soul as WidgetSoul)?.widgets || []) {
    getCopiedConnectionsAndDataConditions(widget, copiedConnections, copiedDataConditions);
  }
}

// 复制组件
const copyWidgets = async () => {
  copiedWidgetsSoulArr.originalBoardId = activeBoardId.value;
  // 初始化复制信息中的数据源与数据条件数组
  copiedWidgetsSoulArr.copiedConnections = [];
  copiedWidgetsSoulArr.copiedDataConditions = [];
  for (const widget of selectedWidgets.value) {
    handleCopiedElementOption(widget);
    getCopiedConnectionsAndDataConditions(widget.getSoul(), copiedWidgetsSoulArr.copiedConnections, copiedWidgetsSoulArr.copiedDataConditions);
  }
  let ruleConnectionUIDs: string[] = [];
  for (const dataCondition of copiedWidgetsSoulArr.copiedDataConditions) {
    for (const rule of dataCondition.rules) {
      for (const ruleItem of rule) {
        ruleConnectionUIDs.push(ruleItem.connection);
      }
    }
  }
  ruleConnectionUIDs = [...ruleConnectionUIDs]; // 去重
  for (const uid of ruleConnectionUIDs) {
    const isExist = copiedWidgetsSoulArr.copiedConnections.find(connectionItem => uid === connectionItem.uid);
    if (!isExist) {
      const usedConnection = getConnections().find(connection => connection.uid === uid);
      usedConnection && copiedWidgetsSoulArr.copiedConnections.push(usedConnection);
    }
  }
  copiedWidgetsSoulArr.widgetSouls = selectedWidgets.value.map((selectedWidget) =>{ 
    const widgetSoul = selectedWidget.getSoul()
    widgetSoul.name = selectedWidget.name
    return widgetSoul
  })
  // 复制组件时将粘贴板text置为widget
  await doCopy(JSON.stringify(copiedWidgetsSoulArr));
  ElMessage.success(i18next.t("projectEditor.widgetCopySuccess"));
}

provide(HANDLE_PASTED_WIDGETS, handlePastedWidgetsSoul);

// 粘贴时将原本的connection对应的静态文件拷贝到当前项目内
const copyConnectionFiles = async (connections: Connection[], originalProjectId: string) => {
  for (const connectionItem of connections) {
    const isExist = getConnections().find(connection => connectionItem.uid === connection.uid);
    if (!isExist) {
      // 先复制数据源对应文件再将数据源添加到当前项目内
      if (connectionItem.options?.path) {
        const res = await axios.post('/project/copy-file', {
          filePath: connectionItem.options.path,
          optType: "field-file",
          originProjectId: originalProjectId,
          projectId
        });
        if(res?.data?.filePath){
          //有返回新的path则替换
          connectionItem.options.path = res.data.filePath;
        }
      }
      nocode.value.body.connections.push(connectionItem);
    }
  }
}

// 粘贴组件
const pasteWidgets = async (copiedWidgetsData: CopiedData) => {
  const isSameProject = projectId === copiedWidgetsData.originalProjectId;
  // 复制粘贴前先将数据源字段和数据条件复制到当前项目
  if (!isSameProject && copiedWidgetsData.copiedConnections.length > 0) {
    let action: Action = await ElMessageBox.confirm(
      i18next.t("projectEditor.widgetDataPasteTip"),
      i18next.t("projectEditor.confirmLabel"),
      {
        distinguishCancelAndClose: true,
        confirmButtonText: i18next.t("projectEditor.confirmLabel"),
        cancelButtonText: i18next.t("projectEditor.cancelText"),
        type: "warning",
        icon: markRaw(WarnTriangleFilled),
        customClass: "message-confirm-box"
      }
    ).then(async (action) => {
      // 复制所有未添加的数据源文件
      await copyConnectionFiles((copiedWidgetsData as CopiedData).copiedConnections, (copiedWidgetsData as CopiedData).originalProjectId);
      return action;
    }).catch((action: Action) => { 
      return action;
    });
    if (action === "close") return;
  }
  const { pastedWidgetSouls } = await handlePastedWidgetsSoul(copiedWidgetsData.widgetSouls, projectId, activeBoardId.value, copiedWidgetsData.originalBoardId, copiedWidgetsData.originalProjectId);
  const clonedWidgets: Widget[] = [];
  for (const pastedWidgetSoul of pastedWidgetSouls) {
    const { widgetSoul, oldUID } = pastedWidgetSoul;
    const cloneWidegt = await cloneWidget(widgetSoul, oldUID, null, isSameProject);
    if (activeWidget.value) {
      if (activeWidget.value.container || (activeWidget.value.parent.container && !(activeWidget.value.parent instanceof Board))) {
        cloneWidegt.unsetOption('position');
      }
    } 
    clonedWidgets.push(cloneWidegt);
  }
  selectedWidgets.value = clonedWidgets;
  selectedWidgets.value[0].getBoard().updateHistory();
}

type CopiedStyles = {
  copyType: "styles",
  originWidgetId: string,
  originBoardId: string,
  plan: SaasPlan,
  styles: Options,
}
const copyStyles = async () => {
  const options = activeElement.value.getOptions();
  const copiedStyles: CopiedStyles = {
    copyType: "styles",
    originWidgetId: activeElement.value.uid,
    originBoardId: activeElement.value.getBoard().uid,
    plan: activeElement.value.plan,
    styles: options,
  }
  await doCopy(JSON.stringify(copiedStyles));
  ElMessage.success(i18next.t("projectEditor.styleCopySuccess"));
}

const excludeKeys = ['position', 'cover',
"linkage", "filter", "field"];

const isExcludePath = (widget: Widget, key: string) => {
  return !widget.hasOption(key) || excludeKeys.includes(key) || excludeKeys.includes(widget.getOptionGroup(key));
}

const handlePasteStylesToElement = (copiedStyles: CopiedStyles, widget: Widget) => {
  for (const key in copiedStyles.styles) {
    if (isExcludePath(widget, key)) continue;
    const value = copiedStyles.styles[key];
    widget.setOption(key, value);
  }

}
const updatePasteBoard = (elements: Element[]) => {
  const boardIds: string[] = [];
  elements.forEach(element => {
    const board = element.getBoard();
    if (boardIds.includes(board.uid)) return;
    boardIds.push(board.uid);
    board.updateHistory();
  });
}
const pasteStyles = (copiedStyles: CopiedStyles) => {
  for (const widget of selectedWidgets.value) {
    if (copiedStyles.originBoardId === widget.uid) continue;
    if (copiedStyles.plan) {
      widget.plan = copiedStyles.plan;
    }
    handlePasteStylesToElement(copiedStyles, widget);
  }
  updatePasteBoard(selectedWidgets.value);
}
provide(COPY_STYLES, copyStyles);

const pasteImageToWidget = async (event: ClipboardEvent) =>{
	let file = event.clipboardData.files[0];
  // 复制图片时会把粘贴板text置为空
  if (!file || !isImageType(file.name) || !notUsingInput.value || !projectVisible.value || !isEditable.value) return
  const fileOption = await uploadFile(file)
  getImageSize(`${projectId}/${fileOption.relativePath}`, async (width,height) => {
    const index = activeBoard.value.container.souls.length
    const pastedImageWidget = await activeContainer.value.container.addWidget("widget.basic.image", index + 1) as Widget;
    pastedImageWidget.setOption('image',fileOption)
    pastedImageWidget.size = {width, height};
    selectedWidgets.value = [ pastedImageWidget]
  })
}
// 黏贴
const doPaste = async (event?: ClipboardEvent) => {
  if (!notUsingInput.value || !projectVisible.value || !isEditable.value) return;
  let copiedText: string;
  if (navigator.clipboard) {
    copiedText = await navigator.clipboard.readText();
  } else {
    copiedText = event.clipboardData.getData('text');
  }
  if (copiedText) {
    const md5Sign = copiedText.substring(0, 32);
    const copyText = copiedText.substring(32);
    const newMd5Sign = md5(copyText + pasteMd5Salt);
    if (newMd5Sign === md5Sign) {
      copiedText = copyText;
      try {
        let parsedCopiedText: CopiedData | CopiedStyles = JSON.parse(copiedText);
        if (parsedCopiedText?.copyType === 'widget') {
          pasteWidgets(parsedCopiedText);
        } else if (parsedCopiedText?.copyType === 'styles') {
          pasteStyles(parsedCopiedText);
        }
      } catch (error) {
        console.log(error);
      }
    }
  }
}
const cleanWindowPaste =  useEventListener(document, 'paste', doPaste);

// 撤销
const cancelChange = () => {
  // 如果当前看板是前景或者背景看板,直接进行撤销操作
  if (["foreboard","backboard"].includes(activeBoard.value.type) || (!allBoard.foreBoard && !allBoard.backBoard)) {
    activeBoard.value.undoHistory() && (projectChanged.value = true);
  } else {
    // 分别获取看板当前历史记录时间
    const historyTimestampMap = {};
    if(allBoard.foreBoard){
      const foreboardCaches = allBoard.foreBoard.getHistoryTimestamps();
      const foreboardTimestamp = foreboardCaches.find(cache => cache.historyId === allBoard.foreBoard.historyId).timestamp;
      historyTimestampMap[foreboardTimestamp] = allBoard.foreBoard;
    }
    if(allBoard.backBoard){
      const backboardCaches = allBoard.backBoard.getHistoryTimestamps();
      const backBoardTimestamp = backboardCaches.find(cache => cache.historyId === allBoard.backBoard.historyId)?.timestamp;
      historyTimestampMap[backBoardTimestamp] = allBoard.backBoard;
    }
    // 同一时间，相对activeBoard优先级更高
    const activeBoardCaches = activeBoard.value.getHistoryTimestamps();
    const activeBoardTimestamp = activeBoardCaches.find(cache => cache.historyId === activeBoard.value.historyId).timestamp;
    historyTimestampMap[activeBoardTimestamp] = activeBoard.value;
    
    const compareTimestamps = Object.keys(historyTimestampMap).map(timestamp=>Number(timestamp));
    const latestBoardTimestamp = Math.max(...compareTimestamps);
    // 对历史记录最新的看板进行撤销操作
    historyTimestampMap[latestBoardTimestamp]?.undoHistory() && (projectChanged.value = true);
  }
}

// 恢复
const recoverChange = () => {
  // 如果当前看板是前景或者背景看板,直接进行恢复操作
  if (["foreboard","backboard"].includes(activeBoard.value.type) || (!allBoard.foreBoard && !allBoard.backBoard)) {
    activeBoard.value.redoHistory() && (projectChanged.value = true);
  } else {
    const historyTimestampMap = {};
    if(allBoard.foreBoard){
      const foreboardCaches = allBoard.foreBoard.getHistoryTimestamps();
      const foreboardTimestamp = foreboardCaches[foreboardCaches.findIndex(cache => cache.historyId === allBoard.foreBoard.historyId) + 1]?.timestamp || Infinity;
      historyTimestampMap[foreboardTimestamp] = allBoard.foreBoard;
    }
    if(allBoard.backBoard){
      const backboardCaches = allBoard.backBoard.getHistoryTimestamps();
      const backBoardTimestamp = backboardCaches[backboardCaches.findIndex(cache => cache.historyId === allBoard.backBoard.historyId) + 1]?.timestamp || Infinity;
      historyTimestampMap[backBoardTimestamp] = allBoard.backBoard;
    }
    // 同一时间，相对activeBoard优先级更高
    const activeBoardCaches = activeBoard.value.getHistoryTimestamps();
    const activeBoardTimestamp = activeBoardCaches[activeBoardCaches.findIndex(cache => cache.historyId === activeBoard.value.historyId) + 1]?.timestamp || Infinity;
    historyTimestampMap[activeBoardTimestamp] = activeBoard.value;

    const compareTimestamps = Object.keys(historyTimestampMap).map(timestamp=>Number(timestamp));
    const latestUndoBoardTimestamp = Math.min(...compareTimestamps);
    // 对历史记录最新的看板进行撤销操作
    historyTimestampMap[latestUndoBoardTimestamp]?.redoHistory() && (projectChanged.value = true);
  }
}

// 全选
const selectAllWidgets = () => {
  selectedWidgets.value = [...activeBoard.value.widgets as Widget[]];
}

// 删除组件
const deleteWidgets = () => {
  if (selectedWidgets.value.length > 0) {
    if (settingState.ifDeleteRemind) {//如果开启了删除提醒，则开启提示弹窗
      if(selectedWidgets.value.length==1){
        deleteName.value = selectedWidgets.value[0].name
      }else{
        deleteName.value = i18next.t("projectEditor.widgetCountDescribe", {widgetName: selectedWidgets.value[0].name, widgetCount: selectedWidgets.value.length});
      }
      deleteType.value = 'element';
      dialogStorage.show('confirmDeleteDialogVisible');
    } else {
      confdel();
    }
  }
}

// 置于顶层
const handleWidgetToTop = () => {
  if (activeWidget.value.parent.layout === "fluid") {
    activeWidget.value.parent.container.moveWidgetBottom(activeWidget.value.uid);
  } else {
    activeWidget.value.parent.container.moveWidgetTop(activeWidget.value.uid);
  }
}

// 置于底层
const handleWidgetToBottom = () => {
  if (activeWidget.value.parent.layout === "fluid") {
    activeWidget.value.parent.container.moveWidgetTop(activeWidget.value.uid);
  } else {
    activeWidget.value.parent.container.moveWidgetBottom(activeWidget.value.uid);
  }
}

// 上移一层
const handleWidgetMoveUp = () => {
  if (activeWidget.value.parent.layout === "fluid") {
    activeWidget.value.parent.container.moveWidgetDown(activeWidget.value.uid);
  } else {
    activeWidget.value.parent.container.moveWidgetUp(activeWidget.value.uid);
  }
}

// 下移一层
const handleWidgetMoveDown = () => {
  if (activeWidget.value.parent.layout === "fluid") {
    activeWidget.value.parent.container.moveWidgetUp(activeWidget.value.uid);
  } else {
    activeWidget.value.parent.container.moveWidgetDown(activeWidget.value.uid);
  }
}

// 对齐与排列
const handleWidgetsAlign = (action: string) => {
  if(!isEditable.value) return ElMessage.warning(i18next.t("projectEditor.notEditableTip"));
  let widgets = selectedWidgets.value;
  let len = widgets.length;
  if((action.startsWith("align-") && len < 2) || (action.startsWith("distribute") && len < 3)) return;
  const baseWidget = widgets[widgets.length-1];
  const position = baseWidget.position;
  const {width, height} = baseWidget.size;
  let newLeft = position.left;
  let newTop = position.top;
  let newBottom = newTop + height;
  let newRight = newLeft + width;
  if(action === "align-tops" || action === "align-bottoms") { //顶对齐 or 底对齐
    widgets.forEach(widget => {
      let { top } = widget.position;
      newTop = Math.min(newTop, top);
      newBottom = Math.max(newBottom, top + widget.size.height);
    });

    widgets.forEach(widget => {
      let top = action === "align-tops" ? newTop : newBottom - widget.size.height;
      widget.position = { left: widget.position.left, top };
    });
  } else if(action === "align-centers-v") { //竖直居中对齐
    widgets.forEach(widget => {
      let top = widget.position.top;
      newTop = Math.min(newTop, top);
      newBottom = Math.max(newBottom, top + widget.size.height);
    });

    let middle = (newBottom + newTop) / 2;
    widgets.forEach(widget => {
      widget.position = {left: widget.position.left, top: middle - widget.size.height / 2};
    });
  } else if(action === "align-centers-h") { //水平居中对齐
    widgets.forEach(widget => {
      let left = widget.position.left;
      newLeft = Math.min(newLeft, left);
      newRight = Math.max(newRight, left + widget.size.width);
    });

    let middle = (newLeft + newRight) / 2;
    widgets.forEach(widget => {
      widget.position = {left: middle - widget.size.width / 2, top: widget.position.top};
    })
  } else if(action === "align-lefts" || action === "align-rights") { //左对齐 or 右对齐
    widgets.forEach(widget => {
      let left = widget.position.left;
      newLeft = Math.min(newLeft, left);
      newRight = Math.max(newRight, left + widget.size.width);
    });

    widgets.forEach(widget => {
      let left = action === "align-lefts" ? newLeft : newRight - widget.size.width;
      widget.position = { left, top: widget.position.top };
    });
  } else if(action === "distribute-tops") { //按顶分布
    let lowestTop = newTop;
    widgets.forEach(widget => {
      let top = widget.position.top;
      newTop = Math.min(newTop, top);
      lowestTop = Math.max(lowestTop, top);
    });

    widgets = widgets.sort((a, b) => a.position.top - b.position.top);
    let topRange = (lowestTop - newTop) / (len - 1);
    for(let i = 1; i < len - 1; i++) {
      let widget = widgets[i];
      newTop += topRange;
      widget.position = {left: widget.position.left, top: newTop};
    }
  } else if(action === "distribute-centers-v") { //竖直居中分布
    let highestMiddle = newTop + height / 2;
    let lowestMiddle = newTop + height / 2;

    widgets.forEach(widget => {
      let widgetMiddle = widget.position.top + widget.size.height / 2;
      highestMiddle = Math.min(highestMiddle, widgetMiddle);
      lowestMiddle = Math.max(lowestMiddle, widgetMiddle);
    });

    widgets = widgets.sort((a, b) => a.position.top - b.position.top);
    let middleRange = (lowestMiddle - highestMiddle) / (len - 1);
    for(let i = 1; i < len - 1; i++) {
      let widget = widgets[i];
      highestMiddle += middleRange;
      let newTop = highestMiddle - widget.size.height / 2;
      widget.position = {left: widget.position.left, top: newTop};
    }
  } else if(action === "distribute-bottoms") { //按底分布
    let highestBottom = newTop + height;
    let lowestBottom = newTop + height;

    widgets.forEach(widget => {
      let widgetBottom = widget.position.top + widget.size.height;
      highestBottom = Math.min(widgetBottom, highestBottom);
      lowestBottom = Math.max(widgetBottom, lowestBottom);
    });

    widgets = widgets.sort((a, b) => a.position.top - b.position.top);
    let bottomRange = (lowestBottom - highestBottom) / (len - 1);
    for(let i = 1; i < len - 1; i++) {
      let widget = widgets[i];
      highestBottom += bottomRange;
      let newTop = highestBottom - widget.size.height;
      widget.position = {left: widget.position.left, top: newTop};
    }
  } else if(action === "distribute-lefts") { //按左分布
    let rightestLeft = newLeft;

     widgets.forEach(widget => {
      let left = widget.position.left;
      newLeft = Math.min(left, newLeft);
      rightestLeft = Math.max(left, rightestLeft);
    });

    widgets = widgets.sort((a, b) => a.position.left - b.position.left);
    let rleftRange = (rightestLeft - newLeft) / (len - 1);
    for(let i = 1; i < len - 1; i++) {
      let widget = widgets[i];
      newLeft += rleftRange;
      widget.position = {left: newLeft, top: widget.position.top};
    }
  } else if(action === "distribute-centers-h") { //水平居中分布
    let leftestMiddle = newLeft + width / 2;
    let rightestMiddle = newLeft + width / 2;

    widgets.forEach(widget => {
      let widgetMiddle = widget.position.left + widget.size.width / 2;
      leftestMiddle = Math.min(leftestMiddle, widgetMiddle);
      rightestMiddle = Math.max(rightestMiddle, widgetMiddle);
    });

    widgets = widgets.sort((a, b) => a.position.left - b.position.left);
    let middleRange = (rightestMiddle - leftestMiddle) / (len - 1);

    for(let i = 1; i < len - 1; i++) {
      let widget = widgets[i];
      leftestMiddle += middleRange;
      let newLeft = leftestMiddle - widget.size.width / 2;
      widget.position = {left: newLeft, top: widget.position.top};
    }
  } else if(action === "distribute-rights") { //按右分布
    let leftestRight = newLeft + width;
    let rightestRight = newLeft + width;

    widgets.forEach(widget => {
      let widgetRight = widget.position.left + widget.size.width;
      leftestRight = Math.min(widgetRight, leftestRight);
      rightestRight = Math.max(widgetRight, rightestRight);
    });

    widgets = widgets.sort((a, b) => a.position.left - b.position.left);
    let rightRange = (rightestRight - leftestRight) / (len - 1);
    for(let i = 1; i < len - 1; i++) {
      let widget = widgets[i];
      leftestRight += rightRange;
      let newLeft = leftestRight - widget.size.width;
      widget.position = {left: newLeft, top: widget.position.top};
    }
  }

  activeBoard.value.updateHistory();
}


// 锁定 / 解除锁定
const toggleLock = () => {
  const elements = selectedWidgets.value;
  for (const element of elements) {
    if (element.parent.locked) continue;
    element.locked = !element.locked;
  }
}

// 隐藏 / 解除隐藏
const toggleEnabled = () => {
  const elements = selectedWidgets.value;
  for (const element of elements) {
    if (!element.parent.enabled) continue;
    element.enabled = !element.enabled;
  }
}

provide(CLONE_WIDGET, cloneWidget);
provide(HANDLE_WIDGET_TO_TOP, handleWidgetToTop);
provide(HANDLE_WIDGET_TO_BOTTOM, handleWidgetToBottom);
provide(HANDLE_WIDGET_MOVE_UP, handleWidgetMoveUp);
provide(HANDLE_WIDGET_MOVE_DOWN, handleWidgetMoveDown);
provide(NOT_USING_INPUT, notUsingInput);
provide(HAS_NO_DIALOG_VISIBLE, hasNoDialogVisible);

whenever(and(or(Ctrl_N, Meta_N), notUsingInput, projectVisible, isEditable, hasNoDialogVisible), () => {
  addScreen();
});
whenever(and(or(Ctrl_P, Meta_P), not(alt),  notUsingInput, projectVisible, isEditable, hasNoDialogVisible), async () => {
  if (!await editProjectModule()) return;
  dialogStorage.show('projectSettingDialogVisible');
});
whenever(and(or(Ctrl_A, Meta_A), notUsingInput, projectVisible, isEditable, hasNoDialogVisible), selectAllWidgets);
whenever(and(or(Ctrl_C, Meta_C), notUsingInput, projectVisible, isEditable, hasNoDialogVisible, not(consolePanelVisible)), copyWidgets);
whenever(and(or(Ctrl_Z, Meta_Z), notUsingInput, projectVisible, isEditable, hasNoDialogVisible), cancelChange);
whenever(and(or(Ctrl_Y, Ctrl_Shift_Z, Meta_Y, Meta_Shift_Z), notUsingInput, projectVisible, isEditable, hasNoDialogVisible), recoverChange);

whenever(and(or(Ctrl_Shift_H, Meta_Shift_H), notUsingInput, projectVisible, isEditable, hasNoDialogVisible), () => toggleEnabled());
whenever(and(or(Ctrl_Shift_L, Meta_Shift_L), notUsingInput, projectVisible, isEditable, hasNoDialogVisible), () => toggleLock());
const deleteName = ref('')
const { isMac } = usePlatform();
if (isMac) {
  whenever(and(Backspace, notUsingInput, projectVisible, isEditable, hasNoDialogVisible), deleteWidgets);
} else {
  whenever(and(Delete, notUsingInput, projectVisible, isEditable, hasNoDialogVisible), deleteWidgets);
}
const handlepicked = (value: boolean, type: 'element' | 'foreboard' | 'backboard' | 'board') => {
  if (value) {
    if (type === 'element') {
      confdel();
    } else if (type === 'foreboard') {
      delete project.value.foreboard;
    } else if (type === 'backboard') {
      delete project.value.backboard;
    } else if (type === 'board') {
      project.value.boards = project.value.boards.filter((item) => {
        return item.uid !== deleteBoardUID.value;
      });
    }
  }
  deleteBoardUID.value = '';
}
const confdel = () => {
  selectedWidgets.value.forEach((widget) => {
    widget.remove();
  });
  selectedWidgets.value.length = 0;
};
const settingState = useSettingStore();

whenever(and(F1, notUsingInput, projectVisible, isEditable, hasNoDialogVisible), () => {
  const enabled = !activeWidget.value.enabled;
  selectedWidgets.value.forEach(widget => {
    widget.enabled = enabled;
  });
});
whenever(and(or(Meta_S, Ctrl_S), not(shift), notUsingInput, projectVisible, isEditable, hasNoDialogVisible), () => {
  saveProject();
});
whenever(and(or(Ctrl_Shift_S, Meta_Shift_S), notUsingInput, projectVisible, isEditable, hasNoDialogVisible),() => {
  saveProject(true).then(() => showSaveAsDialog());
})
whenever(and(or(Ctrl_G, Meta_G), notUsingInput, projectVisible, isEditable, hasNoDialogVisible, not(shift)), async () => {
  if (selectedWidgets.value.length === 0) return
  mergeWidgetsFun(selectedWidgets.value)
});
whenever(and(or(Ctrl_Shift_G, Meta_Shift_G), notUsingInput, projectVisible, isEditable, hasNoDialogVisible), async () => {
  if (!activeWidget.value) return
  cancelMergeWidgets();
});

// 移入到分组
const moveWidgetsFun = (widgets: Widget[], panelUID: string|Widget, options?: any) => {
  let panel = panelUID;
  if(typeof panel === "string"){
    panel = getElementByUID([activeBoard.value.uid, panel]) as Widget;
  }
  const {type , referUID} = options ?? {};
  for(const widget of widgets){
    if(!panel.container.isChildTypeValid(widget.type)) continue;
    const soul = widget.detach();
    if(widget.parent !== panel){
      soul.options['position'] = [0,0];
    }
    switch(type){
      case 'before':
        if (panel.layout === "fluid") {
          panel.container.insertAfter(soul, referUID);
        } else {
          panel.container.insertBefore(soul, referUID);
        }
        break;
      case 'after':
        if (panel.layout === "fluid") {
          panel.container.insertBefore(soul, referUID);
        } else {
          panel.container.insertAfter(soul, referUID);
        }
        break;
      default:
        if (panel.layout === "fluid") {
          panel.container.prepend(soul);
        } else {
          panel.container.append(soul);
        }
        break;
    }
  }
  selectedWidgets.value = [];
  nextTick(()=>{
    selectedWidgets.value = widgets;
  });
}
provide(MOVE_WIDGETS_FUN, moveWidgetsFun);
// 生成分组逻辑
const mergeWidgetsFun = async (widgets: Widget[], panelUID?: string|Widget, options?: any) => {
  if (!panelUID) {
    const { newGroupName } = options ?? {};
    const widget = widgets[0];
    let oneParent = widgets[0].parent;
    for (let i = 0; i < widgets.length; i++) {
      // 跨层操作不往下执行
      if (widgets[i].parent !== oneParent) {
        ElMessage.warning(i18next.t("projectEditor.crossLayerOperate"));
        return;
      }
    }
    let xMin = Number.MAX_VALUE, yMin = Number.MAX_VALUE, xMax = Number.MIN_VALUE, yMax = Number.MIN_VALUE;
    let panelIndex = 0;
    widgets.forEach((widget) => {
      let widgetIndex = unref(widget.parent.container.widgets).findIndex(item => item.uid === widget.uid)
      if (widgetIndex > panelIndex) {
        panelIndex = widgetIndex;
      }
      const { left, top } = widget.position;
      const { width, height } = widget.size;
      if (xMin > left) {
        xMin = left;
      }
      if (yMin > top) {
        yMin = top;
      }
      if (xMax < left + width) {
        xMax = left + width;
      }
      if (yMax < top + height) {
        yMax = top + height;
      }
    });
    const widgetUIDs = widgets.map((widget) => widget.getSoul().uid);
    const souls = [];
    const allWidgets = widgets[0].parent.widgets;
    for (let i = 0; i < allWidgets.length; i++) {
      const widget = allWidgets[i];
      if (widgetUIDs.includes(widget.getSoul().uid)) {
        const { left, top } = widget.position;
        widget.status.isSelected = false;
        widget.status.isActive = false;
        const soul = toRaw(widget.detach());
        soul.options['position'] = [left - xMin, top - yMin];
        souls.push(soul);
        i--;
      }
    }
    let panel = await widget.parent.container.addWidget({
      type: "widget.group.panel",
      options: {
        position: [xMin, yMin],
        size: [xMax - xMin, yMax - yMin],
        background: false,  //background不设置，边框也不生效
        border: false
      },
      widgets: souls,
      name: newGroupName,
    }, panelIndex - widgetUIDs.length + 1) as Widget;
    widgets = [panel];
    selectedWidgets.value = [ panel ];
    widgetMenuContext.newAddPanelWidget = true;
  } else {
    const {type , referUID} = options ?? {};
    let panel = panelUID;
    if(typeof panel === "string"){
      panel = getElementByUID([activeBoard.value.uid, panel]) as Widget;
    }
    const _isBoard = isBoard(panel);
    for(const widget of widgets){
      if(!panel.container.isChildTypeValid(widget.type)) continue;
      if(!_isBoard){
        adjustPositionForWidget(panel, widget)
        let { top: widgetAbsoluteTop, left: widgetAbsoluteLeft } = getAbsolutePosition(widget);
        let { top: panelAbsoluteTop, left: panelAbsoluteLeft } = getAbsolutePosition(panel);
        widget.position = {
          left: widgetAbsoluteLeft - panelAbsoluteLeft,
          top: widgetAbsoluteTop - panelAbsoluteTop,
        };
      }
      const soul = widget.detach();
      switch(type){
        case 'before':
          if (panel.layout === "fluid") {
            panel.container.insertAfter(soul, referUID);
          } else {
            panel.container.insertBefore(soul, referUID);
          }
          break;
        case 'after':
          if (panel.layout === "fluid") {
            panel.container.insertBefore(soul, referUID);
          } else {
            panel.container.insertAfter(soul, referUID);
          }
          break;
        default:
          if (panel.layout === "fluid") {
            panel.container.prepend(soul);
          } else {
            panel.container.append(soul);
          }
          break;
      }
    }
    if (_isBoard) {
      selectedWidgets.value = [];
      await nextTick();
      selectedWidgets.value = widgets;
    } else {
      selectedWidgets.value = [ panel ];
    }
  }
}
provide(MERGE_WIDGETS_FUN, mergeWidgetsFun);

// 取消分组逻辑
const cancelMergeWidgets = () => {
  // 删除面板
  const index = activeWidget.value.parent.container.souls.findIndex(item => item.uid === activeWidget.value.uid);
  // 使组件在视觉上的位置不发生变化
  const { left, top } = activeWidget.value.position;
  let souls = activeWidget.value.container.souls.map(widget => {
    if (widget.options.position) {
      widget.options.position[0] = widget.options.position[0] + left;
      widget.options.position[1] = widget.options.position[1] + top;
    } else {
      widget.options.position = [left, top]
    }
    return widget;
  })
  for(const widget of activeWidget.value.widgets){
    widget.detach();
  }
  // 删除分组面板
  toRaw(activeWidget.value.remove());
  // 父容器添加
  activeWidget.value.parent.container.insertByIndex(souls, index);

  selectedWidgets.value = [];
}


const adjustPositionForWidget = (panel: Widget, widget: Widget) => {
  if (panel.parent && !isBoard(panel.parent)) {
    adjustPositionForWidget(panel.parent, widget);
  }

  let xMin = Number.MAX_VALUE, yMin = Number.MAX_VALUE, xMax = 0, yMax = 0;
  let { top: panelAbsoluteTop, left: panelAbsoluteLeft } = getAbsolutePosition(panel);
  let panelWidth = panel.size.width;
  let panelHeight = panel.size.height;
  let { top: widgetAbsoluteTop, left: widgetAbsoluteLeft } = getAbsolutePosition(widget);
  let widgetWidth = widget.size.width;
  let widgetHeight = widget.size.height;
  let xAbsoluteMin = Math.min(panelAbsoluteLeft, widgetAbsoluteLeft);
  let yAbsoluteMin = Math.min(panelAbsoluteTop, widgetAbsoluteTop);
  let xAbsoluteMax = Math.max(panelAbsoluteLeft + panelWidth, widgetAbsoluteLeft + widgetWidth);
  let yAbsoluteMax = Math.max(panelAbsoluteTop + panelHeight, widgetAbsoluteTop + widgetHeight);
  let diffRangeX = panelAbsoluteLeft - panel.position.left;
  let diffRangeY = panelAbsoluteTop - panel.position.top;
  xMin = xAbsoluteMin - diffRangeX;
  xMax = xAbsoluteMax - diffRangeX;
  yMin = yAbsoluteMin - diffRangeY;
  yMax = yAbsoluteMax - diffRangeY;

  let resetPosition = [];
  if (xMin !== panel.position.left || yMin !== panel.position.top) {
    resetPosition = [xMin - panel.position.left, yMin - panel.position.top];
  }

  panel.size = {
    width: xMax - xMin,
    height: yMax - yMin
  };

  panel.position = {
    left: xMin,
    top: yMin
  };
  if (!resetPosition.length) return;
  let internalWidgets = panel.widgets || [];
  for (let internalWidget of internalWidgets) {
    internalWidget.position = {
      left: internalWidget.position.left - resetPosition[0],
      top: internalWidget.position.top - resetPosition[1]
    };
  }
}

const getAbsolutePosition = (widget: Widget) => {
  if (isBoard(widget.parent)) {
    return widget.position;
  }
  let { top, left } = getAbsolutePosition(widget.parent);
  return {
    top: widget.position.top + top,
    left: widget.position.left + left
  };
}

const projectEditorTheLeftRef = ref(null);
const switchCatalogTab = (tabName: string) => {
  projectEditorTheLeftRef.value?.switchTab(tabName);
}
provide(SWITCH_CATALOG_TAB, switchCatalogTab);

const projectCoreWrapperRef = ref<HTMLElement>();
const catalogPanelRef = ref<HTMLElement | null>(null);
const propertyPanelRef = ref<HTMLElement | null>(null);
const projectCoreWrapperWidth = ref(0);
const embeddedFloatingPanelMetrics = computed(() => {
  return resolveProjectFloatingPanelMetrics(projectCoreWrapperWidth.value || Number.POSITIVE_INFINITY);
});
const catalogPanelPosition = ref({
  x: embeddedFloatingPanelMetrics.value.padding,
  y: embeddedFloatingPanelMetrics.value.padding,
});
const catalogPanelDragState = ref<null | {
  startPointer: { x: number; y: number }
  startPosition: { x: number; y: number }
}>(null);
const propertyPanelPosition = ref({
  x: 0,
  y: embeddedFloatingPanelMetrics.value.padding,
});
const propertyPanelDragState = ref<null | {
  startPointer: { x: number; y: number }
  startPosition: { x: number; y: number }
}>(null);
const propertyPanelHasManualPosition = ref(false);
const isBoardPropertyPinned = computed(() => editorPanelLayouts.boardProperty.pinned);
const getEmbeddedFloatingPanelBounds = () => {
  const bounds = projectCoreWrapperRef.value?.getBoundingClientRect?.();
  if (!bounds) {
    return null;
  }
  return {
    width: bounds.width,
    height: bounds.height,
  };
}
const getCatalogPanelMetrics = () => {
  const bounds = getEmbeddedFloatingPanelBounds();
  const panelRect = catalogPanelRef.value?.getBoundingClientRect?.();
  if (!bounds || !panelRect) {
    return null;
  }
  return {
    bounds,
    panelSize: {
      width: panelRect.width,
      height: panelRect.height,
    },
  };
}
const getPropertyPanelMetrics = () => {
  const bounds = getEmbeddedFloatingPanelBounds();
  const panelRect = propertyPanelRef.value?.getBoundingClientRect?.();
  if (!bounds || !panelRect) {
    return null;
  }
  return {
    bounds,
    panelSize: {
      width: panelRect.width,
      height: panelRect.height,
    },
  };
}
const resolveCatalogPanelCollisionInsets = (nextPosition = catalogPanelPosition.value) => {
  return resolveFieldCatalogCollisionInsets(
    Boolean(props.propertyPanelVisible),
    nextPosition,
    propertyPanelPosition.value,
    getEmbeddedFloatingPanelBounds()?.width,
    catalogPanelRef.value?.getBoundingClientRect?.().width || embeddedFloatingPanelMetrics.value.catalogWidth,
    embeddedFloatingPanelMetrics.value.propertyWidth,
  );
}
const syncCatalogPanelPosition = (nextPosition = catalogPanelPosition.value) => {
  const metrics = getCatalogPanelMetrics();
  if (!metrics) {
    return;
  }
  catalogPanelPosition.value = clampFloatingPanelPosition(
    nextPosition,
    metrics.panelSize,
    metrics.bounds,
    embeddedFloatingPanelMetrics.value.padding,
    resolveCatalogPanelCollisionInsets(nextPosition),
  );
}
const syncPropertyPanelPosition = (nextPosition = propertyPanelPosition.value) => {
  const metrics = getPropertyPanelMetrics();
  if (!metrics) {
    return;
  }
  if (isBoardPropertyPinned.value) {
    propertyPanelPosition.value = resolveEditorPanelPosition(
      'boardProperty',
      metrics.panelSize,
      metrics.bounds,
      { x: metrics.bounds.width - metrics.panelSize.width, y: 0 },
    );
    return;
  }
  propertyPanelPosition.value = clampFloatingPanelPosition(
    nextPosition,
    metrics.panelSize,
    metrics.bounds,
    embeddedFloatingPanelMetrics.value.padding,
  );
  updateEditorPanelFloatingPosition('boardProperty', propertyPanelPosition.value);
}
const resetPropertyPanelPosition = () => {
  const metrics = getPropertyPanelMetrics();
  if (!metrics) {
    return;
  }
  propertyPanelPosition.value = clampFloatingPanelPosition(
    {
      x: metrics.bounds.width - metrics.panelSize.width - embeddedFloatingPanelMetrics.value.padding,
      y: embeddedFloatingPanelMetrics.value.padding,
    },
    metrics.panelSize,
    metrics.bounds,
    embeddedFloatingPanelMetrics.value.padding,
  );
}
const floatingCatalogPanelStyle = computed(() => ({
  width: `${embeddedFloatingPanelMetrics.value.catalogWidth}px`,
  transform: `translate(${catalogPanelPosition.value.x}px, ${catalogPanelPosition.value.y}px)`,
  zIndex: String(EMBEDDED_BOARD_FLOATING_PANEL_Z_INDEX),
}));
const floatingPropertyPanelStyle = computed(() => ({
  width: `${embeddedFloatingPanelMetrics.value.propertyWidth}px`,
  transform: `translate(${propertyPanelPosition.value.x}px, ${propertyPanelPosition.value.y}px)`,
  zIndex: String(EMBEDDED_BOARD_FLOATING_PANEL_Z_INDEX),
  height: isBoardPropertyPinned.value ? '100%' : undefined,
}));
const projectMenuRef = ref();
provide(ACTIVE_BOARD_ID, activeBoardId);

useResizeObserver(projectCoreWrapperRef, (entries) => {
  projectCoreWrapperWidth.value = entries[0]?.contentRect?.width || 0;
  syncCatalogPanelPosition();
  if (!props.propertyPanelVisible) {
    return;
  }
  if (propertyPanelHasManualPosition.value || isBoardPropertyPinned.value || editorPanelLayouts.boardProperty.floatingPosition) {
    syncPropertyPanelPosition();
    return;
  }
  resetPropertyPanelPosition();
});

watch(() => props.catalogVisible, async (visible) => {
  if (!visible) {
    catalogPanelDragState.value = null;
    return;
  }
  await nextTick();
  syncCatalogPanelPosition({
    x: embeddedFloatingPanelMetrics.value.padding,
    y: embeddedFloatingPanelMetrics.value.padding,
  });
}, {
  immediate: true,
});

watch(() => props.propertyPanelVisible, async (visible) => {
  if (!visible) {
    propertyPanelDragState.value = null;
    propertyPanelHasManualPosition.value = false;
    if (props.catalogVisible) {
      await nextTick();
      syncCatalogPanelPosition();
    }
    return;
  }
  await nextTick();
  resetPropertyPanelPosition();
  if (props.catalogVisible) {
    syncCatalogPanelPosition();
  }
}, {
  immediate: true,
});

const handleCatalogPanelDragStart = (event: MouseEvent) => {
  catalogPanelDragState.value = {
    startPointer: {
      x: event.clientX,
      y: event.clientY,
    },
    startPosition: {
      ...catalogPanelPosition.value,
    },
  };
  event.preventDefault();
}

const handlePropertyPanelDragStart = (event: MouseEvent) => {
  if (isBoardPropertyPinned.value || event.button !== 0) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (
    target?.closest('.sub-region .level-item span')
    || target?.closest('.bread-crumbs__ellipsis')
    || target?.closest('.el-dropdown-menu')
  ) {
    return;
  }
  propertyPanelHasManualPosition.value = true;
  propertyPanelDragState.value = {
    startPointer: {
      x: event.clientX,
      y: event.clientY,
    },
    startPosition: {
      ...propertyPanelPosition.value,
    },
  };
  event.preventDefault();
}

const toggleBoardPropertyPinned = () => {
  const pinned = !isBoardPropertyPinned.value;
  setEditorPanelPinned('boardProperty', pinned, propertyPanelPosition.value);
  nextTick(() => {
    const metrics = getPropertyPanelMetrics();
    if (!metrics) {
      return;
    }
    propertyPanelPosition.value = resolveEditorPanelPosition(
      'boardProperty',
      metrics.panelSize,
      metrics.bounds,
      { x: metrics.bounds.width - metrics.panelSize.width, y: 0 },
    );
  });
}

useEventListener(document, 'mousemove', (event: MouseEvent) => {
  if (catalogPanelDragState.value) {
    const metrics = getCatalogPanelMetrics();
    if (metrics) {
      catalogPanelPosition.value = resolveFieldCatalogDragPosition({
        startPointer: catalogPanelDragState.value.startPointer,
        currentPointer: {
          x: event.clientX,
          y: event.clientY,
        },
        startPosition: catalogPanelDragState.value.startPosition,
        panelSize: metrics.panelSize,
        bounds: metrics.bounds,
        padding: embeddedFloatingPanelMetrics.value.padding,
        insets: resolveCatalogPanelCollisionInsets({
          x: catalogPanelDragState.value.startPosition.x + (event.clientX - catalogPanelDragState.value.startPointer.x),
          y: catalogPanelDragState.value.startPosition.y + (event.clientY - catalogPanelDragState.value.startPointer.y),
        }),
      });
    }
  }
  if (propertyPanelDragState.value) {
    const metrics = getPropertyPanelMetrics();
    if (metrics) {
      propertyPanelPosition.value = resolveFieldCatalogDragPosition({
        startPointer: propertyPanelDragState.value.startPointer,
        currentPointer: {
          x: event.clientX,
          y: event.clientY,
        },
        startPosition: propertyPanelDragState.value.startPosition,
        panelSize: metrics.panelSize,
        bounds: metrics.bounds,
        padding: embeddedFloatingPanelMetrics.value.padding,
      });
      updateEditorPanelFloatingPosition('boardProperty', propertyPanelPosition.value);
    }
  }
});

useEventListener(document, 'mouseup', () => {
  catalogPanelDragState.value = null;
  propertyPanelDragState.value = null;
});

const onTabChange = (boardId: string, type: "fore" | "back" | "basic", ev: MouseEvent) => {
  selectedWidgets.value = [];
  //告诉背景看板点击了正常子看板
  // type 判断 是什么看板 
  if (type === 'fore') {
    isScreenBoard.value = false;
    backView.value = false;
    foreView.value = true;
  } else if (type === 'back') {
    isScreenBoard.value = false;
    backView.value = true;
    foreView.value = false;
  } else {
    isScreenBoard.value = true;
    foreView.value = true;
    backView.value = true;
  }
};


const addScreen = async () => {
  if (!await editProjectModule()) return;
  boardIdx.value++;
  const boardSoul: BoardSoul = {
    type: "board",
    uid: unique(),
    isNew: true,
    name: i18next.t("projectEditor.subKanban") + boardIdx.value,
    options: {
      background: !project.value.backboard,
      "background-fill-type": "stretch",
    },
    widgets: [],
  };
  project.value.boards.push(boardSoul);
  nextTick(() => {
    boardsTabs.value.scrollTo(boardsTabs.value.scrollWidth, 0);
    const board = getElementByUID([boardSoul.uid]) as Board;
    board.status.isProjectReady = true;
  })
};

const deleteType = ref('');
const deleteBoardUID = ref('');
const removeScreen = async (uid: string) => {
  if (!checkBoardEditable(uid)) return;
  if (!await editProjectModule()) return;
  if(project.value.boards.length === 1) {
    return ElMessage.warning(i18next.t("projectEditor.subKanbanDeleteTip"));
  }
  if (settingState.ifDeleteRemind) {
    deleteType.value = 'board';
    deleteBoardUID.value = uid;
    deleteName.value = project.value.boards.find((item) => item.uid === uid).name;
    dialogStorage.show('confirmDeleteDialogVisible');
  } else {
    project.value.boards = project.value.boards.filter((item) => {
      return item.uid !== uid;
    });
  }
};

const handleClickMenu = async (type: string, paths: string[]) => {
  if (type === "new-tab") {
    addScreen();
  } else if (type === "save-project") {
    saveProject();
  } else if (type === "export-save-as") {
    saveProject(true).then(() => showSaveAsDialog());
  } else if (type === "pack-project") {
    saveProject(true).then(() => showDeployNavDialog('export'));
  } else if (type === "release") {
    saveProject(true).then(() => showDeployNavDialog('share'));
  } else if (type === "close-project") {
    closeProject(projectId);
  } else if (type === 'data-conditions') {
    showDataConditionDialog();
  } else if (type === 'project-setting') {
    if (!await editProjectModule()) return;
    dialogStorage.show('projectSettingDialogVisible');
  } else if (type === 'copy') {
    // 复制组件
    copyWidgets();
  } else if (type === 'paste') {
    // 粘贴组件
    doPaste();
  } else if (type === 'select-all') {
    // 全选组件
    selectAllWidgets();
  } else if (type === 'cancel') {
    // 取消更改
    cancelChange();
  } else if (type === "recover") {
    // 恢复更改
    recoverChange();
  } else if (type === "delete") {
    // 删除组件
    deleteWidgets();
  } else if (type === "to-top") {
    // 置于顶层
    handleWidgetToTop();
  } else if (type === "to-bottom") {
    // 恢复更改
    handleWidgetToBottom();
  } else if (type === "move-up") {
    // 上移一层
    handleWidgetMoveUp();
  } else if (type === "move-down") {
    // 下移一层
    handleWidgetMoveDown();
  } else if (type === "create-group") {
    // 合并分组
    dialogStorage.show('groupMergeDialogVisible');
  } else if (type === "delete-group") {
    // 取消分组
    cancelMergeWidgets();
  } else if (type === 'resource-check') {
    showResourceCheckDialog();
  } else if (type === "play" || type === "present-start") {
    if (type === "present-start") {
      // 切换到首页
      activeBoardId.value = Object.keys(allBoard.boards)[0];
    }
  } else {
    if (paths?.length > 1 && [i18next.t("projectEditor.alignment"), i18next.t("projectEditor.arrange")].includes(paths[1])) {
      handleWidgetsAlign(type);
    }
  }

};

const showResourceCheckDialog = () => {
  dialogStorage.show('projectResourceCheckDialogVisible');
}

const handleMouseClick = () => {
  projectMenuRef.value?.closeMenu();
  if(activeElement.value === activeBoard.value) {
    activeBoard.value.status.pointDwonTime = Date.now();
  } 
}


const isShowFormCreate = ref(false);
const formCreatePosition = ref({ x: 0, y: 0 });
const embeddedConnection = ref(null); //保存数据源信息
const tableUid = ref(null);
const connectUid = ref(null);
const addFormRef = ref(null);
const handleDrop = async (ev: DragEvent) => {
  const data = ev.dataTransfer.getData("drag-data");
  if (!data) return;
  const [connectUID, tableUID] = JSON.parse(data);
  tableUid.value = tableUID;
  connectUid.value = connectUID;
  if (ev.dataTransfer.getData("connection-type") === "embedded") {
    embeddedConnection.value = nocode.value?.body?.connections?.find(
      (connection) => connection.uid === connectUID
    );
    const formOptions = embeddedConnection.value?.formOptions;
    if (!formOptions) return;

    isShowFormCreate.value = true;
    await nextTick();
    const parentRect = projectCoreWrapperRef.value.getBoundingClientRect();
    const childRect = addFormRef.value.getBoundingClientRect();

    // 计算鼠标位置，并使子元素居中
    let x = ev.clientX - parentRect.left - childRect.width / 2;
    let y = ev.clientY - parentRect.top - childRect.height / 2;

    // 限制子元素不超出父容器
    const maxX = parentRect.width - childRect.width;
    const maxY = parentRect.height - childRect.height;

    x = Math.min(Math.max(0, x), maxX);
    y = Math.min(Math.max(0, y), maxY);

    formCreatePosition.value = { x, y };
  }
};

const handleClickOutside = () => {
  isShowFormCreate.value = false;
};

const addFormFn = async (type: "form" | "table") => {
  dialogStorage.show('loadingDialogVisible', { type: 'loading', message: i18next.t('projectEditorTheLeft.loadingMessage') })
  const index = activeBoard.value?.container?.souls?.length;

  let soul: WidgetSoul;
  if (type === "form") {
    soul = {
      type: "widget.form.submitform",
    }
  } else if (type === "table") {
    soul = {
      type: "widget.form.table",
    }
  }
  const widget = await activeBoard.value?.container?.addWidget(soul, index + 1);
  isShowFormCreate.value = false;
  console.log('widget', widget);
  widget.setTableOptionValue([connectUid.value, tableUid.value]);

  dialogStorage.hide('loadingDialogVisible');
};

const isProjectReady = ref(false);
const hasWidgetMounted = ref(false);

provide(ALL_BOARD, allBoard);
provide(ALL_BOARD_DOM, allBoardDom);
provide(PROJECT_ID, projectId);
provide(PROJECT, project);
provide(IS_PROJECT_READY, isProjectReady);
provide(HAS_WIDGET_MOUNTED, hasWidgetMounted);
provide(CANCEL_MERGE_WIDGETS, cancelMergeWidgets)
provide(WIDGET_MENU_CONTEXT, widgetMenuContext);
provide(IS_WEB_SHARE, false);
provide(GET_LIST, getList);

const saveProject = async (ignoreSnap = false, autoSave = false, noMessage = false): Promise<boolean> => {
  const action = i18next.t("projectEditor.login");
  if (!passportState.isLogin) {
    !noMessage && ElMessage.error(i18next.t("projectEditor.loginTip", {operate: action}))
    return false;
  }
  if(!isProjectReady.value) {
      !noMessage && ElMessage.warning(i18next.t('projectEditor.notReadySaveWarning'))
      return false;
    }
    if (passportState.mode !== 'user' && !await coordinationReadyGate.wait()) return false;
    const editBoards: Board[] = [];
    for (const boardUID of curCoEditingAccount.value?.boardUIDs || []) {
      if (allBoard?.backBoard?.uid === boardUID) {
        editBoards.push(allBoard.backBoard);
      } else if (allBoard?.foreBoard?.uid === boardUID) {
        editBoards.push(allBoard.foreBoard);
      } else if (allBoard?.boards?.[boardUID]) {
        editBoards.push(allBoard.boards[boardUID]);
      }
    }
    try{
      await Promise.all([
        ...editBoards.map((board)=>{
          return board.onSave();
        }),
      ]);
    }catch(err){
      !noMessage && ElMessage.error(err.message);
      return false;
    }
    if (shouldMarkProjectManualChanged(nocode.value.meta, project.value)) {
      project.value.manualChanged = true;
    }
    return await new Promise<boolean>((resolve) => {
      projectSocket.emit("save-project", { projectBody: project.value }, async ({ success, message }) => {
        let publishUpdateText = '';
        if (!success){ 
          !noMessage && ElMessage.error(message || i18next.t("projectEditor.saveFailed"));
          resolve(false);
          return;
        } else {
          let text = i18next.t("projectEditor.saveSuccess");
          if (ignoreSnap && !projectChanged.value){
            text = '';
            publishUpdateText = '';
          }
          projectChanged.value = false;
          emit("saved");
          if(text) !noMessage && ElMessage.success(text);
        }
        // if(publishUpdateText) !noMessage && ElMessage.success(publishUpdateText);
        if(ignoreSnap){ 
          resolve(true);
          return;
        }
        resolve(true);
      });
    });
};

const showDeployNavDialog = async (action: DeployNavDialogArgs['action']) => {
  dialogStorage.show('deployNavDialogVisible', { projectId, action });
};

const showSaveAsDialog = async () => {
  dialogStorage.show('saveAsDialogVisible', {type: 'project', id: projectId});
};

/* 前景/背景看板逻辑开始 */
// isScreenBoard 判断是否点击了子看板
const isScreenBoard = ref(true);
const foreView = ref(true);  //前景看板是否显示
const backView = ref(true);  //背景看板是否显示
const foreBackZoomXY = ref({ zoom: 1, x: 0, y: 0 });
provide(FORE_BACK_ZOOM_X_Y, foreBackZoomXY);
/* 前景/背景看板逻辑结束 */

watch(() => project.value?.boards.map(board => board.uid), async (boardUIDs, oldBoardUIDs) => {
  boardUIDs = boardUIDs || [];
  oldBoardUIDs = oldBoardUIDs || [];
  const addBoardUIDs = boardUIDs.filter(UID => !oldBoardUIDs.includes(UID));
  const removeBoardUIDs = oldBoardUIDs.filter(UID => !boardUIDs.includes(UID));
  // 新增子看板
  for (const UID of addBoardUIDs) {
    const soul = project.value.boards.find(board => board.uid === UID);
    addBoard(createBoard(soul));
  }

  // 删除子看板
  await nextTick(); // 删除后先等vnStack 把activeBoardId改成显示的那个，防止出现activeBoard为undefined的情况
  for (const UID of removeBoardUIDs) {
    delete allBoard.boards[UID];
  }

})

// 前景看板
watch(() => project.value?.foreboard?.uid, async (value) => {
  if (value) {
    allBoard.foreBoard = createBoard(project.value.foreboard);
  } else {
    await nextTick(); // 删除后先等vnStack 把activeBoardId改成显示的那个，防止出现activeBoard为undefined的情况
    delete allBoard.foreBoard
  }
})

// 背景看板
watch(() => project.value?.backboard?.uid, async (value) => {
  if (value) {
    allBoard.backBoard = createBoard(project.value.backboard);
  } else {
    await nextTick(); // 删除后先等vnStack 把activeBoardId改成显示的那个，防止出现activeBoard为undefined的情况
    delete allBoard.backBoard
  }
})

const handleChangePosition = (type: 'x' | 'y', delta: number) => {
  for (const widget of selectedWidgets.value) {
    if (type === "x") {
      widget.position = {
        ...widget.position,
        left: widget.position.left + delta
      }
    } else {
      widget.position = {
        ...widget.position,
        top: widget.position.top + delta
      }
    }
  }
}

// 组件与辅助线的移动
onKeyStroke(['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'], (event) => {
  // event.preventDefault();
  if (!notUsingInput.value || ctrl.value || alt.value) return;
  if (selectedWidgets.value.length === 1 && activeWidget.value.preventKeyboardMove) {
    return;
  }
  let delta = shift.value ? 5 : 1;
  switch (event.key) {
    case 'ArrowLeft':
      handleChangePosition('x', -1 * delta);
      break;
    case 'ArrowUp':
      handleChangePosition('y', -1 * delta);
      break;
    case 'ArrowRight':
      handleChangePosition('x', 1 * delta);
      break;
    case 'ArrowDown':
      handleChangePosition('y', 1 * delta);
      break;
  }
});

onErrorCaptured((err, instance, info)=>{
  const logger = import.meta.env.DEV ? console.error : console.warn;
  logger(`catch project error in ${info}\n`, err, props.projectId, instance);
  return false;
});

// tab contextmenu

const handleContextMenuShow = (ev: MouseEvent, board: BoardSoul) => {
  contextMenu.visible = true;
  contextMenu.event = ev;
  contextMenu.board = board;
}


//项目自动保存
let autoSaveProjectTimer = null;
const setAutoSaveProjectTimer = () => { //自动保存项目
  if(settingState.isAutoSaveProject && !autoSaveProjectTimer && isProjectReady.value) {
    let saveInterval = settingState.autoSaveInterval * 60 * 1000;
    autoSaveProjectTimer = setInterval(() => {
      if(projectChanged.value){//项目被修改了才自动保存
        saveProject(true, true);
      }
    }, saveInterval);
  }
}
const clearAutoSaveProjectTimer = () => {
  if(!autoSaveProjectTimer) return;
  clearInterval(autoSaveProjectTimer);
  autoSaveProjectTimer = null;
}
const checkAutoSaveProject = async () => { //检测自动保存功能是否开启
  await settingState.autoSaveProject();
  setAutoSaveProjectTimer();
}

const handlePublish = async () => {
  saveProject(true);
  emit('open-setting', SettingTab.PUBLISH);
}

watch(() => settingState.autoSaveInterval, () => {
  clearAutoSaveProjectTimer();
  setAutoSaveProjectTimer();
});
watch(() => settingState.isAutoSaveProject, value => {
  value ? setAutoSaveProjectTimer() : clearAutoSaveProjectTimer();
});

//项目内组件加载完后才开始的事件
watch(() => isProjectReady.value, (value) => {
  if (value) {
    checkAutoSaveProject();
  }
});

provide(SAVE_PROJECT, saveProject);

const listVisible = ref({
  isVisble: false,
  type: 'btn-click'
});
const hideList = () => {
  listVisible.value.isVisble = false;
}
const showList = (type : string) => {
  listVisible.value.isVisble = true;
  if(type){
    listVisible.value.type = type
  }
}

watch(() => props.catalogVisible, (value) => {
  if (value) {
    showList('embedded-toggle');
    return;
  }
  hideList();
}, {
  immediate: true,
});


const {  Ctrl_F, Meta_F } = useMagicKeys({
  passive: false,
  onEventFired(e) {
    //阻止一些浏览器或客户端中默认的功能
    if (e.type === "keydown" && notUsingInput.value) {
      const _ctrl_f = ((e.ctrlKey || e.metaKey) && e.key === "f" && !listVisible.value.isVisble);
      if(_ctrl_f){
        e.preventDefault();
      }
    }
  }
});

whenever(and(or(Ctrl_F, Meta_F), projectVisible, isEditable), () => showList("Ctrl_F"));



provideRuntime(FormTableRuntime.BOARD_EDITOR);
const previewNocodeLayer = inject(PREVIEW_NOCODE_LAYER);
const previewPage = async () => {
  await saveProject();
  previewNocodeLayer();
}

const handleAddWidget = async (widgetType) => {
  dialogStorage.show('loadingDialogVisible', { type: 'loading', message: i18next.t('projectEditorTheLeft.loadingMessage') })
  const index = activeBoard.value?.container?.souls?.length;
  await activeBoard.value?.container?.addWidget(widgetType, index + 1);
  isShowFormCreate.value = false;
  dialogStorage.hide('loadingDialogVisible');
}

/**
 * 通过expose preventClose和onClose来让VnStackWindow阻止关闭
 */
defineExpose({
  preventClose,
  onClose,
  get projectChanged() {
    return projectChanged.value;
  },
  previewPage,
  saveProject: async (noMessage: boolean)=>{
    return await saveProject(false, false, noMessage);
  },
  openComponentCatalog() {
    showList('embedded-toolbar');
  },
  closeComponentCatalog() {
    hideList();
  },
});
</script>

<style lang="scss" scoped>
.pre-fullscreen-fade {
  display: block !important;
  position: absolute;
  top: 0;
  left: 0;
  background-color: aquamarine;
  opacity: 1;
}

.current-fullscreen-fade {
  opacity: 0;
  position: absolute;
  top: 0;
  left: 0;
}

//水平平移样式
.pre-fullscreen-horizontal {
  display: block !important;
  position: absolute;
  left: 0;
  top: 0;
}

.current-fullscreen-horizontal {
  position: absolute;
  left: 100%;
  top: 0;
}

// 垂直平移样式
.pre-fullscreen-vertical {
  display: block !important;
}

.current-fullscreen-vertical {
  display: block;
}
.project-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  // border-left: 4px solid var(--border-color-light);
  background-color: var(--bg-color-page);
  position: relative;

  &.embedded {
    border-left: none;
  }

  &:focus-visible {
    outline: none;
  }

  .menu {
    flex: none;
    height: 36px;
    background-color: var(--bg-color);
    line-height: 25px;
    color: var(--text-color-primary);
  }

  .el-header {
    padding: 0 16px 0 12px;
    display: flex;
    height: 40px;
    align-items: center;
    justify-content: space-between;
    background-color: var(--bg-color-page);
    width: 100%;
    border-bottom: 1px solid var(--border-color-light);
  
    .title {
      display: flex;
      align-items: center;
      font-size: 16px;
      font-weight: 500;
      max-width: 230px;

      span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      &.is-changed {
        position: relative;
        &::after {
          content: "";
          position: absolute;
          width: 7px;
          height: 7px;
          background-color: var(--color-warning);
          border-radius: 50%;
          right: -10px;
          top: -4px;
        }
      }
    }

    .tools {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      flex: auto;
      align-items: center;
      :deep(.el-scrollbar) {
        width: 100%;

        .el-scrollbar__view {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      }
    }
    .menus {
      display: flex;

      .el-button {
        width: 56px;
        height: 24px;
        border-radius: 2px;
        cursor: var(--cursor-pointer);
      }
    }
  }

  .main-container {
    flex: auto;
    min-height: 0;
    position: relative;

    &.has-pinned-panel {
      display: flex;
      gap: 12px;
    }

    .widget-list {
      --el-aside-width: 50px;
      background-color: var(--bg-color-overlay);
      border-right: 1px solid var(--border-color-light);
      color: var(--text-color-primary);
      overflow: visible !important;
    }

    .project-editor-floating-panel {
      position: absolute;
      top: 0;
      left: 0;
      height: calc(100% - 32px);
      display: flex;
      flex-direction: column;
      pointer-events: auto;
      border-radius: 8px;
      border: 1px solid #e5e6eb;
      background: #fff;
      box-shadow: 0 12px 32px rgba(29, 33, 41, 0.12), 0 4px 12px rgba(29, 33, 41, 0.08);
      overflow: hidden;

      &.is-pinned {
        position: relative !important;
        top: auto;
        left: auto;
        flex: none;
        height: 100% !important;
        transform: none !important;
        z-index: auto !important;
      }
    }

    .project-editor-floating-panel__header {
      height: 40px;
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 0 8px;
      border-bottom: 1px solid #E5E6EB;
      cursor: move;
    }

    .project-editor-floating-panel__breadcrumbs {
      min-width: 0;
      flex: 1;
      padding: 0;
      border-bottom: none;
    }

    .project-editor-floating-panel__close {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-color-secondary);
      cursor: var(--cursor-pointer);
      transition: color 0.18s ease, background-color 0.18s ease;

      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }

    .project-editor-floating-panel__pin {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: var(--text-color-secondary);
      cursor: var(--cursor-pointer);

      &:hover {
        background-color: var(--bg-color-overlay);
      }
    }

    .project-editor-floating-panel__body {
      flex: 1;
      min-height: 0;
    }

    .project-editor-catalog-panel {
      height: 630px;
      max-height: calc(100% - 32px);

      :deep(.widgets-list-wrapper) {
        width: 100%;
        height: 100%;
      }
    }

    .project-editor-property-panel {
      overflow: hidden;
    }

    .project-core-wrapper {
      flex: 1 1 0;
      min-width: 0;
      width: auto;
      height: 100%;
      position: relative;
      overflow: hidden;
      border-right: 1px solid var(--border-color-light);

      .add-form-container {
        width: 100%;
        height: 100%;
        background-color: transparent;
        position: absolute;
        top: 0;
        left: 0;
        z-index: 9999;

        .add-form {
          width: 344px;
          height: 198px;
          position: absolute;
          z-index: 99;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
  
          .add-form-middle {
            width: 100%;
            height: 36px;
            display: flex;
            justify-content: space-between;
            align-items: center;
  
            .add-form-middle-main {
              width: 36px;
              height: 36px;
              border: 4px solid #5E5E5E;
              border-radius: 50%;
            }
          }
  
          .add-form-item {
            width: 102px;
            height: 32px;
            background-color: #37383D;
            text-align: center;
            line-height: 32px;
            color: #D0D0D1;
            font-size: 14px;
            border-radius: 4px;
  
            
            &:hover {
              background-color: #354D69;
              color: #FFFFFF;
            }
          }
          .disabled {
            opacity: 0.5;
            pointer-events: none;
          }
        }
      }

      .box-area {
        position: absolute;
        border: 1px dashed #666666;
        z-index: 11;
        pointer-events: none;
      }

      .bottom-container {
        display: flex;
        justify-content: space-between;
        height: 40px;
        flex: none;
        border-top: 1px solid var(--border-color-light);
        background-color: var(--bg-color);
        color: var(--text-color-primary);
        .tabs {
          display: flex;
          flex-wrap: nowrap;
          width: calc(100% - 150px);
          border-left: 1px solid var(--border-color-light);

          .drag-cursor {
            width: 10px;
            height: 10px;
            display: block;
            position: absolute;
            top: -6px;
            transform: translateX(calc(33px - 5px));
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid var(--text-color-primary);
            border-bottom: 5px solid transparent;
          }

          .tab {
            display: inline-block;
            list-style: none;
            line-height: 40px;
            padding-left: 10px;
            border-right: 1px solid var(--border-color-light);
            background-color: transparent;
            color: var(--text-color-primary);
            cursor: var(--cursor-pointer);
            position: relative;
            border-top: 1px solid transparent;
            width: 128px;

            &.active {
              background-color: var(--bg-color-overlay);
              color: var(--color-primary);
              cursor: inherit;
              border-top-color: var(--color-primary);
            }

            .name-input {
              width: calc(100% - 30px);
              margin-left: 5px;
              height: 25px;
              line-height: 25px;
              border: 1px solid var(--color-primary);
              border-radius: 4px;
            }

            span {
              display: inline-block;
              white-space: nowrap;
              text-overflow: ellipsis;
              overflow: hidden;
              width: calc(100% - 22px);
              font-size: inherit;
              margin-left: 5px;
              user-select: none;
              vertical-align: middle;
            }

            .icon {
              vertical-align: middle;
              font-size: 12px;
            }

            .btn-remove {
              position: absolute;
              right: 1px;
              top: 0;
              font-size: 10px;
              display: none;
              color: var(--text-color-primary);
              margin: 0;
              line-height: 12px;
              cursor: var(--cursor-pointer);
            }

            &:hover .btn-remove {
              display: block;
            }
          }

          .fore-board,
          .back-board {
            position: relative;
            width: 64px;
            flex-shrink: 0;
            &.have-back {
              width: 128px;
              .fs {
                color: #917157;
                &.btn-remove {
                  color: var(--text-color-primary);
                }
              }
            }
            .text {
              font-size: 12px;
              font-style:normal;
            }
            .add-board {
              position: absolute;
              right: 0;
              top: 0;
              display: block;
              width:40px;
              height:40px;
              text-align: center;
              em {
                display: block;
                position: absolute;
                right: 0;
                top: 0;
                width:0;
                height:0;
                text-align: center;
              }
              .circle-add {
                position: absolute;
                height: 16px;
                right: 6px;
                bottom: 20px;
                font-size: 15px;
                font-weight: 100;
              }
              &:hover .circle-add {
                font-size: 17px;
              }
            }
          }
          .back-board {
            border-left: 1px solid var(--border-color-light);
          }

          .new-tab {
            display: inline-block;
            width: 32px;
            text-align: center;
            padding: 0;
            color: var(--text-color-primary);
            cursor: var(--cursor-pointer);
            border: 0;
            position: relative;
            border-radius: 20px;
            margin: 5px 0;
            line-height: 30px;

            &:hover {
              background-color: var(--bg-color-overlay);
            }
          }

        }

        .zoom {
          display: flex;
          align-items: center;
          width: 120px;
          justify-content: flex-end;

          .el-input {
            width: 60px;
          }

          :deep(.el-input__wrapper) {
            box-shadow: unset;
            background: none;

            input {
              width: 52px;
              height: 23px;
              text-align: center;
              font-size: 12px;
              margin: auto 0;
              position: absolute;
              top: 0;
              bottom: 0;
              border: none;

              &:focus,
              &:hover {
                background: var(--bg-color-hover);
              }
            }
          }

          .zoom-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            cursor: var(--cursor-pointer);

            &:hover {
              background-color: var(--bg-color-hover);
            }
            &.key-list{
              border-left: 1px solid var(--border-color-light);
            }
          }

          .shortcut-list-wrapper{
            position: fixed;
            top: 0;
            left: 0;
            right: 15px;
            bottom: 0;
            z-index: 9999;
          }
        }
      }

      .board-empty {
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
  }

  :deep(.el-notification__content){
    max-height: 300px;
    overflow: auto;
  }
}

.boards_tabs{
  overflow-x: auto;
  overflow-y: hidden;

  .scroll_tabs{
    display: flex;
    flex-wrap: nowrap;

    .tab {
      flex-shrink: 0;

      span {
        pointer-events: none;
      }
    }
  }
  
  &::-webkit-scrollbar {
    height: 10px;
    display: none;
  }

  &::-webkit-scrollbar-thumb {
    border-radius: 2.5px;
    background-color: #76767680;
  }

  &:hover::-webkit-scrollbar{
    display: block;
  }
}
</style>

<style lang="scss">

.resize-masks {
  .mask {
    position: absolute;
    left: 0;
    top: 0;
    width: 100vw;
    height: 100vh;
    z-index: 99;
  }
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
.ifdeltop {
  font-size: 17px;
  }
.ifdel {
  text-align: center;
}
.not-warn {
  position: absolute;
  left: 20px;
}

</style>
