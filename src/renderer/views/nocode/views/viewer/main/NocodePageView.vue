<template>
  <div class="container">
    <div class="aside-container" v-if="!isHideSidebar">
      <div class="header">
        <router-link to="/apps">
          <el-button class="back" text :title="$t('NocodePageView.backToWorkbench')">
            <el-icon size="16" class="arrow">
              <i-ep-arrow-left />
            </el-icon>
          </el-button>
        </router-link>
        <div class="icon" :style="{ background: nocode?.body?.snapshot?.color }" v-if="nocode?.body?.snapshot">
          <el-icon :size="18">
            <component :is="nocode?.body?.snapshot?.icon" />
          </el-icon>
        </div>
        <el-image loading="lazy" :src="getCoverImageURL(nocodeId)" v-else>
          <template #error>
            <img src="@renderer/assets/image/report-default-cover.png" alt="">
          </template>
        </el-image>
        <span :title="nocode?.meta?.name">{{ nocode?.meta?.name }}</span>
        <el-button class="fold-button" text @click="isHideSidebar = true" v-if="!isHideSidebar">
          <el-icon :size="16">
            <i-workbench-horizontal-fold />
          </el-icon>
        </el-button>
      </div>
      <div class="project">
        <el-scrollbar class="scroll-container">
          <div class="project-search-box">
            <el-input
              v-model="searchVal"
              :placeholder="$t('NocodePageView.searchKeyword')"
              :prefix-icon="Search"
            />
            <el-button link @click="toggleExpandCollapse">
              <el-icon size="16">
                <i-workbench-put-away v-if="isAllCollapse" />
                <i-workbench-unfold v-else />
              </el-icon>
            </el-button>
          </div>
          <div
            v-if="homePage"
            class="home-page-node"
            :class="{ 'active': isHomeActive, 'popover-open': homePageSettingVisible }"
            @click="handleHomePageClick"
          >
            <div class="node-icon home">
              <el-icon size="20"><i-ven-global-page-home /></el-icon>
            </div>
            <span :title="$t('NocodePageView.homePage')">{{ $t('NocodePageView.homePage') }}</span>
            <el-popover
              v-if="getAppPermissions('editable')"
              popper-class="nocode-page-viewer-tree-popover"
              placement="bottom-start"
              trigger="click"
              :hide-after="0"
              :show-arrow="false"
              :persistent="false"
              :teleported="false"
              width="160"
              @show="homePageSettingVisible = true"
              @hide="homePageSettingVisible = false"
            >
              <ul @click.stop>
                <li @click="homePageSettingDialogVisible = true">
                  {{ $t('NocodePageView.homePageSetting') }}
                </li>
              </ul>
              <template #reference>
                <el-icon class="more-button" size="16" @click.stop>
                  <i-ven-more-vertical />
                </el-icon>
              </template>
            </el-popover>
            <div class="edit-box" v-else></div>
          </div>
          <el-tree
            class="page-tree"
            :class="{ 'has-home-page': Boolean(homePage) }"
            :data="nocode.body.structure"
            :props="defaultProps"
            @node-click="handleNodeClick"
            ref="treeRef"
            node-key="id" 
            :filter-node-method="filterTree"
            :empty-text="$t('NocodePageView.noContent')"
            :icon="ArrowDownBold"
            :indent="24"
            :default-expanded-keys="defaultExpandedKeys"
          >
            <template #default="{ node, data }">
              <div class="custom-tree-node" :class="{'active': activeID === data.id && !isHomeActive, 'popover-open': openedTreePopoverId === data.id}">
                <div :class="['node-icon', data.type]">
                  <el-icon size="20"
                    v-if="data.type === NocodeStructureType.GROUP">
                    <i-ven-global-page-folder-open v-if="node.expanded" />
                    <i-ven-global-page-folder v-else />
                  </el-icon>
                  <el-icon size="20" v-else-if="data.type === NocodeStructureType.PAGE">
                    <i-ven-global-page-document />
                  </el-icon>
                  <el-icon size="20" v-else-if="data.type === NocodeStructureType.FORM">
                    <i-ven-global-page-form />
                  </el-icon>
                </div>
                <span :title="data.name">{{ data.name }}</span>
                <el-button
                  v-if="data.type === NocodeStructureType.PAGE && data.id === activePageId && !isHomeActive"
                  class="fullscreen-button"
                  text
                  :title="$t('NocodePageView.fullScreen')"
                  @click.stop="handleProjectFullscreen"
                >
                  <el-icon size="16"><i-ven-icon-full-screen /></el-icon>
                </el-button>
                <el-popover
                  popper-class="nocode-page-viewer-tree-popover"
                  placement="bottom-start"
                  trigger="click"
                  :visible="openedTreePopoverId === data.id"
                  :hide-after="0"
                  :show-arrow="false"
                  :persistent="false"
                  :teleported="false"
                  width="160"
                  @update:visible="visible => handleTreeNodePopoverVisibleChange(data.id, visible)"
                  v-if="getAppPermissions('editable') || (data.type === NocodeStructureType.PAGE && data.id === activePageId && !isHomeActive)"
                >
                  <ul @click.stop>
                    <li v-if="data.type != NocodeStructureType.GROUP && getAppPermissions('editable')" @click="enterEditor(data.id)">
                      <el-icon size="16" class="tree-node-icon">
                        <i-ven-edit-state/>
                      </el-icon>
                      {{ $t('NocodePageView.toEdit') }}
                    </li>
                    <li v-if="getAppPermissions('editable')" @click="handleNodeRename(data)">
                      <el-icon size="16" class="tree-node-icon">
                        <i-ven-page-view-rename/>
                      </el-icon>
                      {{ $t('NocodePageView.rename') }}
                    </li>
                    <li v-if="data.type === NocodeStructureType.PAGE && data.id === activePageId && !isHomeActive" @click="handleRefreshProject">
                      <el-icon size="16" class="tree-node-icon">
                        <i-ep-refresh />
                      </el-icon>
                      {{ $t('NocodePageView.refreshData') }}
                    </li>
                    <li v-if="false && data.type != NocodeStructureType.GROUP">
                      <el-icon size="16" class="tree-node-icon">
                        <i-ep-picture/>
                      </el-icon>
                      {{ $t('NocodePageView.setIcon') }}
                    </li>
                    <li v-if="false">
                      <el-icon size="16" class="tree-node-icon">
                        <i-ven-page-view-move/>
                      </el-icon>
                      {{ $t('NocodePageView.move') }}
                    </li>
                    <div class="line" v-if="data.type === NocodeStructureType.FORM"></div>
                    <li v-if="data.type === NocodeStructureType.FORM" @click="handleCopyToCurrentNocode(data, node)">
                      <el-icon size="16" class="tree-node-icon">
                        <i-workbench-copy/>
                      </el-icon>
                      {{ $t('NocodePageView.copyToCurrentNocode') }}
                    </li>
                    <li v-if="data.type === NocodeStructureType.FORM" @click="openCopyToOtherNocodeDialog(data)">
                      <el-icon size="16" class="tree-node-icon">
                        <i-workbench-copy/>
                      </el-icon>
                      {{ $t('NocodePageView.copyToOtherNocode') }}
                    </li>
                    <div class="line" v-if="getAppPermissions('editable')"></div>
                    <li v-if="getAppPermissions('editable')" class="delete" @click="handleDelete(data, node)">
                      <el-icon size="16" class="tree-node-icon">
                        <i-ep-delete/>
                      </el-icon>
                      {{ $t('NocodePageView.delete') }}
                    </li>
                  </ul>
                  <template #reference>
                    <el-icon class="more-button" size="16" @click.stop>
                      <i-ven-more-vertical></i-ven-more-vertical>
                    </el-icon>
                  </template>
                </el-popover>
                <el-icon class="edit-button" size="16" @click="enterEditor(data.id)" :title="$t('NocodePageView.toEdit')" v-if="getAppPermissions('editable') && data.type != NocodeStructureType.GROUP">
                  <i-ven-edit-state/>
                </el-icon>
                <div class="edit-box" v-else></div>
              </div>
            </template>
          </el-tree>
        </el-scrollbar>
      </div>
    </div>

    <div :class="['main-wrapper', { 'hide-sidebar': isHideSidebar }]">
      <div class="header">
        <el-button class="expand-button" text @click="isHideSidebar = false" v-if="isHideSidebar">
          <el-icon :size="16">
            <i-workbench-horizontal-unfold />
          </el-icon>
        </el-button>
        <span :title="activeName">{{ activeName }}</span>
        <div class="header-right">
          <el-badge v-if="isShowProcess" :value="getCount" :max="999" :hidden="getCount <= 0" class="header-action-badge">
            <el-button :class="['header-action', { active: isMyTodoHeaderActive }]" text @click="openMyTodoFromHeader" :title="$t('NocodePageView.myTodo')">
              <el-icon :size="16">
                <i-workbench-expedite />
              </el-icon>
            </el-button>
          </el-badge>
          <el-badge v-if="drafts.length" :value="drafts.length" type="primary" :show-zero="false" class="header-action-badge">
            <el-button class="header-action" link  @click.stop="openDraftBox" :title="$t('NocodePageView.draftBox')">
              <el-icon :size="16">
                <i-ep-takeaway-box></i-ep-takeaway-box>
              </el-icon>
            </el-button>
          </el-badge>
          <el-button v-if="canManageImportReadonly" class="header-action" text @click="handleToggleImportReadonly" :title="importReadonlyActionTitle">
            <el-icon :size="16">
              <i-ep-unlock v-if="isImportReadonly"></i-ep-unlock>
              <i-ep-lock v-else></i-ep-lock>
            </el-icon>
          </el-button>
          <router-link
            :to="buildNocodeEditorRoute(nocodeId, {
              query: {
                id: activeID ?? undefined,
              },
              returnTo: route.fullPath,
            })"
            class="header-action-link"
            v-if="getAppPermissions('editable')"
          >
            <el-button class="header-action" text :title="$t('NocodePageView.editApp')">
              <el-icon :size="16">
                <i-ep-edit></i-ep-edit>
              </el-icon>
            </el-button>
          </router-link>
          <router-link :to="`/app/${nocodeId}/setting`" class="header-action-link" v-if="getAppPermissions('editable')">
            <el-button class="header-action" text :title="$t('NocodePageView.appSetting')">
              <el-icon :size="16">
                <i-ep-setting></i-ep-setting>
              </el-icon>
            </el-button>
          </router-link>
          <WorkBenchUserCard></WorkBenchUserCard>
        </div>
      </div>
      <template v-if="activeID">
        <div class="todo-container" v-if="isTodo">
          <nocode-todo-box ref="todoBoxRef" :isShowTab="false" @count-refreshed="handleTodoRefreshed" />
        </div>
        <div v-else-if="isSwitchingFormContent" class="viewer-loading">
          <el-icon class="viewer-loading__icon" :size="24">
            <Loading />
          </el-icon>
          <span>{{ $t('NocodePageView.loading') }}</span>
        </div>
        <form-data-viewer ref="formDataViewerRef" :key="renderedFormId" :tableId="renderedFormId" v-else-if="renderedFormId && activeFormId === activeID" @draft-saved="handleDraftSaved" @submitted="scheduleTodoCountRefresh" @changeRows="handleTableRowsChange" />
        <div v-else class="viewer-container">
          <div class="project-viewer"> 
            <project-viewer
              ref="projectViewerRef"
              :nocode="nocode"
              :projectId="activeID"
              :nocodeId="nocodeId"
              :webshare="true"
              :key="activeID"
            />
          </div>
        </div>
      </template>
      <div class="empty-layer" v-else>
        {{ $t('NocodePageView.noContent') }}
      </div>
    </div>
    <nocode-node-rename-dialog ref="nodeRenameDialogRef" @confirm="handleNodeRenamed"></nocode-node-rename-dialog>
    <delete-confirm-dialog :text="deleteConfirmContext.text" :tip="deleteConfirmContext.tip" v-model="deleteConfirmContext.visible" @confirm="deleteConfirmContext.confirm"  />
    <form-draft-list v-model="draftBoxListVisible" :drafts="drafts" :table="table" :enable-clear="true" @delete="handleDeleteDraft" @clear="handleClearDrafts" @submitted="handleDraftSubmitted" @updated="handleDraftSaved" />
    <el-dialog
      v-model="expiredDialogVisible"
      class="nocode-expired-dialog"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="400px"
      align-center
    >
      <div class="expired-dialog-content">
        <el-icon class="warning-icon" :size="16">
          <i-ep-warning-filled />
        </el-icon>
        <span class="text">{{ $t("nocodeRouter.nocodeExpired") }}</span>
      </div>
      <template #footer>
        <el-button type="primary" class="confirm-btn" @click="handleExpiredConfirm">
          {{ $t("projectImportDialog.projectImportConfirm") }}
        </el-button>
      </template>
    </el-dialog>
    <copy-to-other-nocode-dialog
      v-model="copyToOtherNocodeDialog.visible"
      :keyword="copyToOtherNocodeDialog.keyword"
      :loading="copyToOtherNocodeDialog.loading"
      :selected-nocode-id="copyToOtherNocodeDialog.selectedNocodeId"
      :target-nocodes="copyToOtherNocodeDialog.targetNocodes"
      @update:keyword="copyToOtherNocodeDialog.keyword = $event"
      @update:selected-nocode-id="copyToOtherNocodeDialog.selectedNocodeId = $event"
      @close="closeCopyToOtherNocodeDialog"
      @confirm="handleCopyToOtherNocode"
    />
    <nocode-home-page-setting-dialog v-model="homePageSettingDialogVisible" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, inject, computed, watch, onMounted, onUnmounted, provide, watchEffect, nextTick, toRaw, defineAsyncComponent } from 'vue';
import { isNavigationFailure, NavigationFailureType, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import { ArrowDownBold, Loading, Search } from '@element-plus/icons-vue';
import { NOCODE, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { TodoCategory, Nocode, NocodeBody, NocodeFormData, NocodeImportState, NocodeStructureType, NocodeMeta, NocodeStructure, TODO, PermissionFilterMode, FormDataTable } from '@common/types/nocode';
import { ORGANIZE_UTIL } from '@renderer/types';
import { formDataApi, formFlowApi, OrganizeUtil } from '@renderer/views/nocode/utils';
import { Bucket, Connection, Permission, Row, Table } from '@common/types/project';
import { usePassportStore, useShareNocodeCacheStore } from '@renderer/stores';

import axios from "axios";
import { ElIcon, ElMessage } from "element-plus";
import { deepClone, isEmpty, equals } from '@common/utils/object';
import { FormDataStage, getNocodeHomePage, hasPublishedProcess, isNocodeImportExpired, isNocodeImportReadonly, setNocodeImportReadonly, SystemField } from '@common/utils';
import i18next from 'i18next';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import CopyToOtherNocodeDialog from './CopyToOtherNocodeDialog.vue';
import { projectApi } from '@renderer/utils/api/project';
import { buildNocodeEditorRoute } from '../../editor/editorReturnNavigation';
import NocodeHomePageSettingDialog from '@renderer/views/nocode/components/NocodeHomePageSettingDialog.vue';

export type DeleteConfirmContext = {
  text: string,
  tip: string,
  visible: boolean,
  confirm: Function,
}

type CopiedFormPayload = {
  table: Table,
  tables: Table[],
  optionTables: FormDataTable[],
  formOptions: NocodeFormData["formOptions"],
}

const route = useRoute();
const nocodeId = route.params.nocodeId as string;
const router = useRouter();
const FormDataViewer = defineAsyncComponent(() => import('./FormDataViewer.vue'));
const searchVal = ref('');
const activeName = ref('');
const activeID = ref('')
const openedTreePopoverId = ref('')
const homePageSettingVisible = ref(false);
const homePageSettingDialogVisible = ref(false);
type GuardableFormDataViewer = {
  canLeaveView?: (showMessage?: boolean) => boolean | Promise<boolean>,
  refreshActiveDataView?: () => void | Promise<void>,
};
type ProjectViewerExpose = {
  refreshProjectData: () => Promise<boolean>,
  enterFullscreen: () => Promise<void>,
};
const formDataViewerRef = ref<GuardableFormDataViewer | null>(null);
const projectViewerRef = ref<ProjectViewerExpose | null>(null);
const treeRef = ref();
const todoBoxRef = ref();
const nocode = inject(NOCODE);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);
const organizeUtil = new OrganizeUtil();
const isHideSidebar = ref(false);

const homePage = computed(() => getNocodeHomePage(
  nocode?.value?.body?.structure || [],
  nocode?.value?.body?.settings?.homePage,
));
const isHomeActive = computed(() => (
  activeID.value === homePage.value?.id
  && (
    route.query.home === '1'
    || !(route.query.project || route.query.form)
  )
));


const isAllCollapse = computed(() => {
  // 如果 treeRef 未初始化或 root 不存在，默认返回 false
  if (!treeRef.value || !treeRef.value.root) return false;
  
  const childNodes = treeRef.value.root.childNodes;
  return childNodes.every(node => node.isLeaf || !node.expanded);
})

const formData = computed(() => {
  return nocode.value?.body?.formData;
})

const isTodo = ref(false);
const categoryData = reactive([
  {
    get name() { return i18next.t('NocodePageView.myTodo') },
    category: TodoCategory.MY_TODO,
    icon: IWorkbenchTodoMyTodo,
  },
  {
    get name() { return i18next.t('NocodePageView.myInitiate') },
    category: TodoCategory.MY_INITIATED,
    icon: IWorkbenchTodoMyInitiated,
  },
  {
    get name() { return i18next.t('NocodePageView.myHandle') },
    category: TodoCategory.MY_PROCESSED,
    icon: IWorkbenchTodoMyProcessed,
  },
  {
    get name() { return i18next.t('NocodePageView.ccToMe') },
    category: TodoCategory.CC_ME,
    icon: IWorkbenchTodoCcMe,
  }
]);
provide(ORGANIZE_UTIL, organizeUtil);

const activeFormId = ref("");
const activePageId = ref("");
const renderedFormId = ref("");
const isSwitchingFormContent = ref(false);
const defaultExpandedKeys = ref<string[]>([]);
const currentImportState = ref<NocodeImportState | null>(null);
const expiredDialogVisible = ref(false);
const isLeavingBecauseExpired = ref(false);
let nocodeImportStateTimer: number | null = null;
let isSyncingNocodeImportState = false;
const NOCODE_IMPORT_STATE_SYNC_INTERVAL = 60 * 1000;

const getExpandedKeys = (structure: NocodeStructure[], targetId: string): string[] => {
  const stack: { node: NocodeStructure; path: string[] }[] = [];

  for (const node of structure) {
    stack.push({ node, path: [] });
  }

  while (stack.length > 0) {
    const { node, path } = stack.pop()!;
    if (node.id === targetId) {
      return path;
    }
    if (node.children) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push({ node: node.children[i], path: [...path, node.id] });
      }
    }
  }
  return [];
}

const table = computed(() =>{
  if (activeID.value !== activeFormId.value) return null;
  return formData.value?.tables?.find(table => table.uid === activeFormId.value);
})

const isAppTodoCategory = (category?: string) => {
  return categoryData.some(item => item.category === category);
}

const canLeaveCurrentFormViewer = async (showMessage = true) => {
  if (activeID.value !== activeFormId.value) {
    return true;
  }
  return await formDataViewerRef.value?.canLeaveView?.(showMessage) ?? true;
};

const getRouteActiveState = () => {
  if (route.query.category && isAppTodoCategory(route.query.category as string)) {
    return {
      isTodo: true,
      activeID: route.query.category as string,
      activeName: categoryData.find(item => item.category === route.query.category)?.name || "",
      activePageId: "",
      activeFormId: "",
      defaultExpandedKeys: [] as string[],
      kind: "todo" as const,
    };
  }

  if (route.query.category === TodoCategory.INITIATE_PROCESS && isShowProcess.value) {
    return {
      isTodo: true,
      activeID: categoryData[0].category,
      activeName: categoryData[0].name,
      activePageId: "",
      activeFormId: "",
      defaultExpandedKeys: [] as string[],
      kind: "todo" as const,
    };
  }

  const requestedId = (route.query.project || route.query.form) as string;
  let page = requestedId
    ? findPage(nocode.value.body.structure, requestedId)
    : homePage.value || findPage(nocode.value.body.structure);
  if (!page && route.query.home === '1') {
    page = homePage.value;
  }
  if (!page) {
    page = findPage(nocode.value.body.structure);
  }

  if (page) {
    return {
      isTodo: false,
      activeID: page.id,
      activeName: page.name,
      activePageId: page.type === NocodeStructureType.PAGE ? page.id : "",
      activeFormId: page.type === NocodeStructureType.FORM ? page.id : "",
      defaultExpandedKeys: getExpandedKeys(nocode.value.body.structure, page.id),
      kind: page.type === NocodeStructureType.FORM ? "form" as const : "page" as const,
    };
  }

  if (isShowProcess.value) {
    return {
      isTodo: true,
      activeID: categoryData[0].category,
      activeName: categoryData[0].name,
      activePageId: "",
      activeFormId: "",
      defaultExpandedKeys: [] as string[],
      kind: "todo" as const,
    };
  }

  return {
    isTodo: false,
    activeID: "",
    activeName: "",
    activePageId: "",
    activeFormId: "",
    defaultExpandedKeys: [] as string[],
    kind: "empty" as const,
  };
}

const applyNodeSelectionImmediately = (data: NocodeStructure) => {
  if (data.type === NocodeStructureType.GROUP) return;

  isTodo.value = false;
  activeID.value = data.id;
  activeName.value = data.name;
  activePageId.value = data.type === NocodeStructureType.PAGE ? data.id : "";
  activeFormId.value = data.type === NocodeStructureType.FORM ? data.id : "";
  defaultExpandedKeys.value = getExpandedKeys(nocode.value.body.structure, data.id);

  if (data.type === NocodeStructureType.FORM) {
    isSwitchingFormContent.value = true;
    renderedFormId.value = "";
    return;
  }

  isSwitchingFormContent.value = false;
  renderedFormId.value = "";
};

const waitForNextPaint = () => {
  return new Promise<void>((resolve) => {
    if (document.visibilityState === "hidden") {
      window.setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => resolve());
  });
}

let routeActiveStateSyncToken = 0;
let pendingNodeClickToken = 0;
const syncActiveStateWithRoute = async () => {
  const currentToken = ++routeActiveStateSyncToken;
  const nextState = getRouteActiveState();
  const shouldDelayMountNextForm = nextState.kind === "form"
    && !!renderedFormId.value
    && renderedFormId.value !== nextState.activeFormId;

  isTodo.value = nextState.isTodo;
  activeID.value = nextState.activeID;
  activeName.value = nextState.activeName;
  activePageId.value = nextState.activePageId;
  activeFormId.value = nextState.activeFormId;
  defaultExpandedKeys.value = nextState.defaultExpandedKeys;

  if (nextState.kind !== "form") {
    renderedFormId.value = "";
    isSwitchingFormContent.value = false;
    return;
  }

  if (!shouldDelayMountNextForm) {
    renderedFormId.value = nextState.activeFormId;
    isSwitchingFormContent.value = false;
    return;
  }

  isSwitchingFormContent.value = true;
  renderedFormId.value = "";
  await nextTick();
  if (currentToken !== routeActiveStateSyncToken) return;
  await waitForNextPaint();
  if (currentToken !== routeActiveStateSyncToken) return;
  renderedFormId.value = nextState.activeFormId;
  isSwitchingFormContent.value = false;
}

const handleNodeClick = async (data: NocodeStructure, fromHome = false) => {
  const isFromHome = fromHome === true;
  if (data.type === NocodeStructureType.GROUP) return;
  const isCurrentSelection = data.id === activeID.value
    && (isFromHome ? isHomeActive.value : !isHomeActive.value);
  if (isCurrentSelection) return;
  const clickToken = ++pendingNodeClickToken;
  const allowLeave = await canLeaveCurrentFormViewer(true);
  if (!allowLeave || clickToken !== pendingNodeClickToken) return;
  applyNodeSelectionImmediately(data);
  await nextTick();
  if (clickToken !== pendingNodeClickToken) return;
  await waitForNextPaint();
  if (clickToken !== pendingNodeClickToken) return;
  if (data.type === NocodeStructureType.PAGE) {
    const navigationResult = await router.push({
      query: {
        project: data.id,
        home: isFromHome ? '1' : undefined,
      }
    });
    if (isNavigationFailure(navigationResult, NavigationFailureType.duplicated)) {
      await syncActiveStateWithRoute();
    }
  } else if (data.type === NocodeStructureType.FORM) {
    const navigationResult = await router.push({
      query: {
        form: data.id,
        home: isFromHome ? '1' : undefined,
      }
    });
    if (isNavigationFailure(navigationResult, NavigationFailureType.duplicated)) {
      await syncActiveStateWithRoute();
    }
  }
}

const handleTreeNodePopoverVisibleChange = (nodeId: string, visible: boolean) => {
  if (visible) {
    openedTreePopoverId.value = nodeId;
  } else if (openedTreePopoverId.value === nodeId) {
    openedTreePopoverId.value = "";
  }
};

const handleRefreshProject = async () => {
  openedTreePopoverId.value = "";
  const refreshed = await projectViewerRef.value?.refreshProjectData();
  if (refreshed === false) {
    ElMessage.error(i18next.t("NocodePageView.refreshDataFailed"));
  }
};

const handleProjectFullscreen = async () => {
  openedTreePopoverId.value = "";
  await projectViewerRef.value?.enterFullscreen();
};

const handleHomePageClick = async () => {
  if (!homePage.value) return;
  await handleNodeClick(homePage.value, true);
};

const passportState = usePassportStore();
const hasApplicationPermission = (nocodeBody: NocodeBody, type: keyof Permission) => {
  if (isNocodeImportExpired(nocodeBody)) {
    return false
  }
  if (type === 'editable' && isNocodeImportReadonly(nocodeBody)) {
    return false
  }

  const account = passportState.account
  if(account.isAdmin || passportState.isMainAccount) {
    return true
  }

  if(isEmpty(nocodeBody?.permissions?.application)) {
    return true
  }

  function hasPermission(permission) {
    const allDepartments = organizeUtil.departments
    const departmentMap = new Map(allDepartments.map(dep => [dep.id, dep.parent]));

    let departments: string[] = [];
    const roles = account.roles || [];

    for (const depId of account?.departments || []) {
      let parentId: string | undefined = depId;
      const visited = new Set<string>(); // 防止循环

      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        departments.push(parentId);
        parentId = departmentMap.get(parentId);
      }
    }
    // 去重
    departments = [...new Set(departments)];
    if(permission.rangeType === PermissionFilterMode.BLACK) {
      if(permission.blacklist.users.includes(account.id)) {
        return false
      }
      for(const depId of departments) {
        if(permission.blacklist.departments.includes(depId)) {
          return false
        }
      }
      for(const roleId of roles) {
        if(permission.blacklist.roles.includes(roleId)) {
          return false
        }
      }
      return true
    } else {
      if(permission.whitelist.users.includes(account.id)) {
        return true
      }
      for(const depId of departments) {
        if(permission.whitelist.departments.includes(depId)) {
          return true
        }
      }
      for(const roleId of roles) {
        if(permission.whitelist.roles.includes(roleId)) {
          return true
        }
      }
      return false
    }
  }

  if(type === 'deletable') {
    return hasPermission(nocodeBody?.permissions?.application.delete)
  } else if (type === 'editable') {
    return hasPermission(nocodeBody?.permissions?.application.update)
  } else if (type === 'enabled') {
    return hasPermission(nocodeBody?.permissions?.application.get)
  }
}

const getAppPermissions = (type: keyof Permission) => {
  return hasApplicationPermission(nocode.value.body, type)
}

const canManageImportReadonly = computed(() => {
  return !!currentImportState.value?.canManageReadonly;
})

const isImportReadonly = computed(() => {
  return !!currentImportState.value?.disableEdit;
})

const importReadonlyActionText = computed(() => {
  return i18next.t(isImportReadonly.value ? 'NocodePageView.unlock' : 'NocodePageView.lock');
})

const importReadonlyActionTitle = computed(() => {
  return i18next.t(isImportReadonly.value ? 'NocodePageView.unlockTitle' : 'NocodePageView.lockTitle');
})

const syncLocalImportReadonly = (disableEdit: boolean) => {
  setNocodeImportReadonly(nocode.value?.meta, disableEdit, { emptyValue: null });
  setNocodeImportReadonly(nocode.value?.body, disableEdit);
}

const handleToggleImportReadonly = async () => {
  const nextDisableEdit = !isImportReadonly.value;
  const importState = await projectApi.saveNocodeImportReadonly(nocodeId, nextDisableEdit).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
    return null;
  });
  if (!importState) return;

  syncLocalImportReadonly(importState.disableEdit);
  currentImportState.value = importState;
  ElMessage.success(i18next.t(importState.disableEdit ? 'NocodePageView.lockSuccess' : 'NocodePageView.unlockSuccess'));
}

const enterEditor = (id) => {
  setTimeout(() => {
    router.push(buildNocodeEditorRoute(nocodeId, {
      query: {
        id: id,
      },
      returnTo: route.fullPath,
    }))
  }, 1);
}

const callSwitchTodoBox = async (item) => {
  if (isTodo.value && activeID.value === item.category) {
    return;
  }
  const allowLeave = await canLeaveCurrentFormViewer(true);
  if (!allowLeave) return;
  todoBoxRef.value?.handleSwitchCategory(item.category)
  await router.push({
    query: {
      category: item.category,
    }
  })
}

const openMyTodoFromHeader = () => {
  void callSwitchTodoBox(categoryData[0]);
}

const isMyTodoHeaderActive = computed(() => {
  return isTodo.value && activeID.value === TodoCategory.MY_TODO;
})

const defaultProps = {
  children: 'children',
  label: 'label',
}

interface Tree {
  [key: string]: any
}

const filterTree = (value: string, data: Tree) => {
  if (!value) return true;
  return data.name.includes(value);
}

let timer = null;
const searchNocodeTree = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    treeRef.value.filter(searchVal.value);
  }, 300);
}
watch(() => searchVal.value, () => {
  searchNocodeTree();
});

const backHome = ()=>{
  router.push("/");
};

const clearNocodeImportStateTimer = () => {
  if (nocodeImportStateTimer) {
    clearInterval(nocodeImportStateTimer);
    nocodeImportStateTimer = null;
  }
}

const showExpiredDialog = () => {
  clearNocodeImportStateTimer();
  if (expiredDialogVisible.value) return;
  expiredDialogVisible.value = true;
}

const syncNocodeImportState = async () => {
  if (expiredDialogVisible.value || isLeavingBecauseExpired.value || isSyncingNocodeImportState) {
    return;
  }
  isSyncingNocodeImportState = true;
  const importState = await projectApi.getNocodeImportState(nocodeId).catch(() => null);
  isSyncingNocodeImportState = false;
  currentImportState.value = importState;
  if (importState) {
    syncLocalImportReadonly(importState.disableEdit);
  }
  if (importState?.expired) {
    showExpiredDialog();
  }
}

const handleExpiredConfirm = async () => {
  isLeavingBecauseExpired.value = true;
  expiredDialogVisible.value = false;
  await router.replace("/");
}

const startNocodeImportStateSync = () => {
  clearNocodeImportStateTimer();
  nocodeImportStateTimer = window.setTimeout(() => {
    void syncNocodeImportState();
    startNocodeImportStateSync();
  }, NOCODE_IMPORT_STATE_SYNC_INTERVAL);
}

const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    void syncNocodeImportState();
  }
}

const findPage = (_structures: NocodeStructure[], id?: string): NocodeStructure => {
  let i = 0;
  while (i < _structures?.length) {
    if (_structures[i].type === NocodeStructureType.GROUP) {
      const page = findPage(_structures[i].children, id);
      if (page) return page;
    } else if (id) {
      if (id === _structures[i].id) {
        return _structures[i];
      }
    } else {
      return _structures[i];
    }
    i ++;
  }
}

const openFirstPage = async ()=>{
  // 打开第一个项目
  const findPage = (_structures = nocode?.value?.body?.structure): NocodeStructure => {
    let i = 0;
    while (i < _structures.length) {
      if (_structures[i].type === NocodeStructureType.GROUP) {
        const page = findPage(_structures[i].children);
        if (page) return page;
      } else {
        return _structures[i];
      }
      i ++;
    }
  }
  const page = homePage.value || findPage();
  if (page) {
    handleNodeClick(page, page.id === homePage.value?.id);
  } else {
    activeID.value = "";
    activeName.value = "";
  }
}

const getCount = ref(0);
const tableRowsInitialized = new Set<string>();
let todoCountTimer: number | null = null;
let todoCountPromise: Promise<void> | null = null;

const handleTodoRefreshed = (count: number) => {
  getCount.value = count;
}
const getTodoCount = async () => {
  if (!isShowProcess.value) return;
  if (todoCountPromise) return todoCountPromise;
  todoCountPromise = (async () => {
    try {
      const res = await formFlowApi.getAllCategoryTodoCount({
        "categories[0]": TodoCategory.MY_TODO,
        nocodeId,
      });
      if (!res) return;
      handleTodoRefreshed(res?.[TodoCategory.MY_TODO]);
    } catch (err) {

    } finally {
      todoCountPromise = null;
    }
  })();
  return todoCountPromise;
}
const scheduleTodoCountRefresh = (delay = 120) => {
  try {
    if (!isShowProcess.value) return;
    if (todoCountTimer) {
      clearTimeout(todoCountTimer);
    }
    todoCountTimer = window.setTimeout(() => {
      todoCountTimer = null;
      void getTodoCount();
    }, delay);
  } catch (err) {
  }
}
const handleTableRowsChange = () => {
  const tableId = activeFormId.value;
  if (!tableId) return;
  if (!tableRowsInitialized.has(tableId)) {
    tableRowsInitialized.add(tableId);
    return;
  }
  scheduleTodoCountRefresh();
}

watch(renderedFormId, (newFormId, oldFormId) => {
  if (newFormId !== oldFormId) {
    tableRowsInitialized.clear();
  }
});

const init = async () => {
  if (route.query.category && (isAppTodoCategory(route.query.category as string) || route.query.category === TodoCategory.INITIATE_PROCESS)) {
    void syncActiveStateWithRoute();
    return;
  }

  const hasTargetQuery = !!(route.query.project || route.query.form);
  if (hasTargetQuery) {
    void syncActiveStateWithRoute();
    return;
  }

  const page = homePage.value || findPage(nocode.value.body.structure);
  const isDefaultHomePage = page?.id === homePage.value?.id;
  if (page?.type === NocodeStructureType.PAGE) {
    await router.replace({
      query: {
        project: page.id,
        home: isDefaultHomePage ? '1' : undefined,
      }
    });
    return;
  } else if (page?.type === NocodeStructureType.FORM) {
    await router.replace({
      query: {
        form: page.id,
        home: isDefaultHomePage ? '1' : undefined,
      }
    });
    return;
  }

  void syncActiveStateWithRoute();
}

watch(
  [
    () => route.query.category,
    () => route.query.project,
    () => route.query.form,
    () => route.query.home,
  ],
  () => {
    void syncActiveStateWithRoute();
  }
);

onMounted(async () => {
  init()
  scheduleTodoCountRefresh();
  void syncNocodeImportState();
  startNocodeImportStateSync();
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
  clearNocodeImportStateTimer();
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  drafts.value = [];
  draftsPromises.clear();
  draftsLoadedKey = "";
})

const isShowProcess = computed(() => {
  const formOptions = nocode.value.body?.formData?.formOptions;
  if (!formOptions) return false;
  for (const tableId of Object.keys(formOptions)) {
    const formOption = formOptions[tableId];
    if(hasPublishedProcess(formOption?.process)) {
      return true;
    }
  }
  return false;
})

const delStructureNode = async (id) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;
  return await axios.post('/project/delete-nocode-structure', {
    nocodeId: nocodeId,
    id: id,
  }, {
    headers: {
      'x-sign': nocode.value.body.sign,
    },
  })
  .then(({headers}) => {
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
    return true;
  })
  .catch((error) => {
    const { response } = error;
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(response?.data?.message);
  });
}

const deleteConfirmContext = reactive<DeleteConfirmContext>({
  text: "",
  tip: "",
  visible: false,
  confirm: null as Function,
})

const handleDeleteTable = async (table: Table) => {
  const _formData = await formDataApi.deleteTable({
    nocodeId,
    formData: formData.value,
    table,
  })
  if (!_formData) return;
  nocode.value.body.formData = _formData;
  await saveNocodeConnections();
  if (activeID.value === table.uid) {
    openFirstPage();
  }
  ElMessage.success(i18next.t('NocodePageView.deleteSuccess'));
}

const handleDelete = async (data: NocodeStructure, node)=>{
  if (activeID.value === data.id) {
    const allowLeave = await canLeaveCurrentFormViewer(true);
    if (!allowLeave) return;
  }
  const _delete = async () => {
    treeRef.value.remove(node);
    const res = await delStructureNode(node.data.id)
    if (data.type === NocodeStructureType.FORM) {
      const delTable = formData.value?.tables?.find(table => table.uid === data.id);
      handleDeleteTable(delTable)
    } else if (res) {
      ElMessage.success(i18next.t('NocodePageView.deleteSuccess'));
      if (activeID.value === data.id) {
        openFirstPage()
      }
    }
  }
  if (data.type === NocodeStructureType.GROUP) {
    if (!isEmpty(data?.children)) {
      ElMessage.warning(i18next.t('NocodePageView.delGroupFirst'));
      return;
    }
    _delete();
  } else if (data.type === NocodeStructureType.FORM) {
    deleteConfirmContext.text = i18next.t('NocodePageView.confirmDelForm')
    deleteConfirmContext.tip = i18next.t('NocodePageView.delFormWarn')
    deleteConfirmContext.visible = true;
    deleteConfirmContext.confirm = _delete;
  }  else {
    deleteConfirmContext.text = i18next.t('NocodePageView.confirmDelBoard')
    deleteConfirmContext.tip = i18next.t('NocodePageView.delBoardWarn')
    deleteConfirmContext.visible = true;
    deleteConfirmContext.confirm = _delete;
  }
};

const nodeRenameDialogRef = ref(null)

const renameData = ref<NocodeStructure>()


const handleNodeRenamed = async (name: string) => {
  renameData.value.name = name;
  if(renameData.value.type === NocodeStructureType.FORM) {
    if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
    const data = await axios.post("project/rename-nocode-form", {
      nocodeId,
      tableUID: renameData.value.id,
      name,
    }, {
      headers: {
        'x-sign': nocode.value.body.sign,
      },
    }).then(({data, headers}) => {
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign) {
        nocode.value.body.sign = mainSign;
      }
      return data;
    }).catch((error) => {
      handleNocodeSyncConflictError(error, nocodeSignIsLatest)
    });
    if (data) {
      ElMessage.success(i18next.t('NocodePageView.modifySuccess'));
      activeName.value = name;
    }
  } else {
    if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
    const res = await axios.post('/project/rename-nocode-structure', {
      nocodeId: nocodeId,
      name: name,
      id: renameData.value.id,
    }, {
      headers: {
        'x-sign': nocode.value.body.sign,
      },
    }).then(({data, headers}) => {
      const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
      if (mainSign) {
        nocode.value.body.sign = mainSign;
      }
      return data;
    }).catch((error) => {
      const { response } = error;
      if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
      ElMessage.error(response?.data?.message);
    });
    if(res) {
      if (renameData.value.type !== NocodeStructureType.GROUP) {
        activeName.value = name;
      }
      ElMessage.success(i18next.t('NocodePageView.modifySuccess'));
    }
  }
}

const handleNodeRename = (data: NocodeStructure) => {
  renameData.value = data;
  nodeRenameDialogRef.value.show(data.name, data.type);
}

const saveNocodeConnectionsToTarget = async (targetNocode: Pick<Nocode, "meta" | "body">, isCurrentNocode = false) => {
  if (isCurrentNocode && !checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;
  return await axios.post("/project/save-nocode-connections", {
    nocodeId: toRaw(targetNocode.meta.id),
    connections: toRaw(targetNocode.body.connections || []),
    formData: toRaw(targetNocode.body.formData),
  }, {
    headers: {
      'x-sign': targetNocode.body.sign,
    },
  }).then(({headers}) => {
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      targetNocode.body.sign = mainSign;
    }
    return true;
  }).catch(err => {
    if (isCurrentNocode && handleNocodeSyncConflictError(err, nocodeSignIsLatest)) return false;
    ElMessage.error(err?.response?.data?.message || err.message);
    return false;
  });
}

const saveNocodeConnections = async () => {
  return await saveNocodeConnectionsToTarget(nocode.value, true);
}

const saveStructureToTarget = async (targetNocode: Pick<Nocode, "meta" | "body">, structure: NocodeStructure[], isCurrentNocode = false) => {
  if (isCurrentNocode && !checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;
  return await axios.post("/project/save-nocode-structure", {
    nocodeId: targetNocode.meta.id,
    structure: toRaw(structure),
  }, {
    headers: {
      'x-sign': targetNocode.body.sign,
    },
  }).then(({ headers }) => {
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      targetNocode.body.sign = mainSign;
    }
    return true;
  }).catch((error) => {
    if (isCurrentNocode && handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return false;
    ElMessage.error(error?.response?.data?.message || error.message);
    return false;
  });
}

const getCopiedFormName = (name: string) => `${name}${i18next.t('NocodePageView.copiedSuffix')}`;

const requestCopiedForm = async (sourceFormId: string, copyName: string) => {
  return await axios.post('/form-data/copy-table', {
    nocodeId,
    sourceFormId,
    copyName,
  }).then(({ data }) => data as { formData: NocodeFormData, table: Table }).catch(({ response }) => {
    ElMessage.error(response?.data?.message);
    return null;
  });
}

const getCopiedFormPayload = (formDataAfterCopy: NocodeFormData, copiedTable: Table): CopiedFormPayload => {
  const currentFormData = nocode.value.body.formData;
  const tableUIDSet = new Set((currentFormData?.tables || []).map(table => table.uid));
  const optionTableUIDSet = new Set((currentFormData?.options?.tables || []).map(table => table.uid));
  const formOptionUIDSet = new Set(Object.keys(currentFormData?.formOptions || {}));

  return {
    table: copiedTable,
    tables: (formDataAfterCopy?.tables || []).filter(table => !tableUIDSet.has(table.uid)),
    optionTables: (formDataAfterCopy?.options?.tables || []).filter(table => !optionTableUIDSet.has(table.uid)),
    formOptions: Object.fromEntries(
      Object.entries(formDataAfterCopy?.formOptions || {}).filter(([tableUID]) => !formOptionUIDSet.has(tableUID))
    ),
  };
}

const detectExternalTableReference = (
  value: any,
  allowedTableUIDs: Set<string>,
  allowedOptionTableUIDs: Set<string>,
  allowedFieldUIDs: Set<string>,
): boolean => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some(item => detectExternalTableReference(item, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs));
  }

  return Object.entries(value).some(([key, childValue]) => {
    if (['tableUID', 'targetTableUID', 'sourceTableUID'].includes(key) && typeof childValue === 'string') {
      return !allowedTableUIDs.has(childValue);
    }
    if (key === 'selectLinkForm' && typeof childValue === 'string') {
      const tableUID = childValue.split(',')[1] || childValue;
      return !allowedTableUIDs.has(tableUID);
    }
    if (['linkageTable'].includes(key) && Array.isArray(childValue)) {
      return !allowedOptionTableUIDs.has(childValue[1]);
    }
    if (key === 'relatedTableUID' && Array.isArray(childValue)) {
      return !allowedOptionTableUIDs.has(childValue[1]);
    }
    if (key === 'subTableUID' && Array.isArray(childValue)) {
      return !allowedTableUIDs.has(childValue[1]);
    }
    if (['otherTableFieldUID'].includes(key) && Array.isArray(childValue)) {
      return !allowedTableUIDs.has(childValue[1]) || !allowedFieldUIDs.has(childValue[2]);
    }
    return detectExternalTableReference(childValue, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs);
  });
}

const externalDataWidgetTypes = new Set([
  'widget.form.searchForm',
  'widget.form.relatedData',
  'widget.form.selectData',
]);

const linkedSelectWidgetTypes = new Set([
  'widget.form.treeSelect',
  'widget.form.treeMultipleSelect',
  'widget.form.radioGroup',
  'widget.form.checkboxGroup',
]);

const clearLinkedFormConfig = (target: any, resetLinkFlag = false) => {
  if (!target || typeof target !== 'object') return;
  delete target.selectLinkForm;
  delete target['select-link-form'];
  delete target.linkFormFilter;
  delete target['link-form-filter'];
  delete target.openFormType;
  delete target['open-form-type'];
  if (resetLinkFlag) {
    if ('isLinkForm' in target) target.isLinkForm = false;
    if ('linkForm' in target) target.linkForm = false;
  }
};

const clearRelationConfig = (holder: any, target: any, clearFormula = false) => {
  if (!target || typeof target !== 'object') return;
  delete target.relatedTableUID;
  delete target.relatedDataMode;
  delete target.otherTableFieldUID;
  delete target.dataFilter;
  delete target.autoAddRule;
  delete target.autoAddRules;
  delete target.autoCreate;
  delete target.allowCreate;
  delete target.createRule;
  clearLinkedFormConfig(target, true);
  if (clearFormula) {
    delete target.formula;
  }
  if (holder && Array.isArray(holder.relatedTableFields)) {
    holder.relatedTableFields = [];
  }
};

const clearKeys = (target: any, keys: string[]) => {
  if (!target || typeof target !== 'object') return;
  keys.forEach(key => {
    delete target[key];
  });
};

const createEmptyChoicesOption = () => ({
  options: [],
});

const clearAutoRuleConfig = (target: any) => {
  clearKeys(target, [
    'setting-related-form-fill',
    'fillRules',
    'fill-rules',
    'fields-filling',
    'data-fill-rules',
    'autoAddRule',
    'autoAddRules',
    'autoCreate',
    'allowCreate',
    'createRule',
    'createRules',
  ]);
};

const clearSearchFormConfig = (target: any) => {
  if (!target || typeof target !== 'object') return;
  clearKeys(target, [
    'select-search-form',
    'showFields',
    'hidden-fields-uid',
    'other-table-field',
    'form-data-filter',
    'form-data-sort-fields',
    'form-data-sort-orderby',
    'allow-add-new-row',
  ]);
};

const clearSelectDataConfig = (target: any) => {
  if (!target || typeof target !== 'object') return;
  clearKeys(target, [
    'connectionTable',
    'showFields',
    'other-table-field',
    'form-data-filter',
    'allow-add-new-row',
  ]);
  clearAutoRuleConfig(target);
};

const clearRelatedDataConfig = (target: any) => {
  if (!target || typeof target !== 'object') return;
  clearSelectDataConfig(target);
  clearKeys(target, [
    'dataMode',
  ]);
};

const hasLinkedSelectDataSourceConfig = (target: any) => {
  if (!target || typeof target !== 'object') return false;
  return target['select-choices-type'] === 'from-table'
    || 'other-table-field' in target
    || 'showFields' in target
    || 'option-filter' in target
    || 'form-data-sort-fields' in target
    || 'form-data-sort-orderby' in target;
};

const clearLinkedSelectConfig = (target: any, widgetType?: string) => {
  if (!target || typeof target !== 'object') return;

  target['select-choices-type'] = 'custom';
  clearKeys(target, [
    'other-table-field',
    'showFields',
    'option-filter',
    'option-filter-use-group-option',
    'form-data-sort-fields',
    'form-data-sort-orderby',
  ]);

  if (widgetType === 'widget.form.treeSelect' || widgetType === 'widget.form.treeMultipleSelect') {
    if (!target['treeselect-value-text-option'] || typeof target['treeselect-value-text-option'] !== 'object') {
      target['treeselect-value-text-option'] = createEmptyChoicesOption();
    } else if (!Array.isArray(target['treeselect-value-text-option'].options)) {
      target['treeselect-value-text-option'].options = [];
    }
  }

  if (widgetType === 'widget.form.radioGroup') {
    if (!target['radiogroup-value-text-color-option'] || typeof target['radiogroup-value-text-color-option'] !== 'object') {
      target['radiogroup-value-text-color-option'] = createEmptyChoicesOption();
    } else if (!Array.isArray(target['radiogroup-value-text-color-option'].options)) {
      target['radiogroup-value-text-color-option'].options = [];
    }
  }

  if (widgetType === 'widget.form.checkboxGroup') {
    if (!target['checkbox-option'] || typeof target['checkbox-option'] !== 'object') {
      target['checkbox-option'] = createEmptyChoicesOption();
    } else if (!Array.isArray(target['checkbox-option'].options)) {
      target['checkbox-option'].options = [];
    }
  }
};

const extractFormulaBracketIds = (formula: any) => {
  if (typeof formula !== 'string') return [] as string[][];
  const regex = /\[\[([a-zA-Z0-9._]+(?:,[^[\]]*)?)\]\]/g;
  const ids: string[][] = [];
  formula.replace(regex, (_match, content) => {
    const [id] = String(content || '').split(',');
    if (id) {
      ids.push(id.split('.').filter(Boolean));
    }
    return _match;
  });
  return ids;
};

const isAllowedConditionUID = (
  uid: any,
  allowedTableUIDs: Set<string>,
  allowedFieldUIDs: Set<string>,
  allowedSourceUIDs: Set<string>,
) => {
  if (typeof uid !== 'string' || !uid) return false;
  const parts = uid.split('.').filter(Boolean);
  if (parts.length === 0) return false;
  if (parts.length === 1) {
    return allowedFieldUIDs.has(parts[0]) || allowedSourceUIDs.has(parts[0]);
  }

  const [head, ...tail] = parts;
  if (!allowedTableUIDs.has(head) && !allowedSourceUIDs.has(head)) {
    return false;
  }
  return tail.every(part => allowedFieldUIDs.has(part));
};

const hasExternalFormulaReference = (
  formula: any,
  allowedTableUIDs: Set<string>,
  allowedFieldUIDs: Set<string>,
  allowedSourceUIDs: Set<string>,
) => {
  return extractFormulaBracketIds(formula).some(ids => {
    if (ids.length === 0) return false;
    if (ids.length === 1) {
      return !allowedFieldUIDs.has(ids[0]) && !allowedSourceUIDs.has(ids[0]);
    }

    const [head, ...tail] = ids;
    if (!allowedTableUIDs.has(head) && !allowedSourceUIDs.has(head)) {
      return true;
    }
    return tail.some(id => !allowedFieldUIDs.has(id));
  });
};

const createEmptyFilterRule = (logic?: string) => ({
  logic: logic || 'AND',
  conditions: [],
});

const sanitizeFormValidRuleForOtherNocode = (
  rule: any,
  allowedTableUIDs: Set<string>,
  allowedOptionTableUIDs: Set<string>,
  allowedFieldUIDs: Set<string>,
) => {
  if (!rule || typeof rule !== 'object') return null;
  if (typeof rule.targetTableUID === 'string' && !allowedTableUIDs.has(rule.targetTableUID)) {
    return null;
  }

  rule.sourceTables = (Array.isArray(rule.sourceTables) ? rule.sourceTables : []).filter(sourceTable => {
    if (!sourceTable?.tableUID || !allowedTableUIDs.has(sourceTable.tableUID)) {
      return false;
    }
    if (sourceTable?.sourceType === 'current-subform') {
      return typeof sourceTable?.currentSubTableFieldUID === 'string' && allowedFieldUIDs.has(sourceTable.currentSubTableFieldUID);
    }
    return true;
  });

  rule.sourceTables.forEach(sourceTable => {
    if (sourceTable?.filterRule && detectExternalTableReference(sourceTable.filterRule, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs)) {
      sourceTable.filterRule = createEmptyFilterRule(sourceTable?.filterRule?.logic);
    }
  });

  const allowedSourceUIDs = new Set<string>(
    rule.sourceTables.map(sourceTable => String(sourceTable?.uid || '')).filter(Boolean)
  );

  rule.validConditions = (Array.isArray(rule.validConditions) ? rule.validConditions : []).map(group => {
    const conditions = (Array.isArray(group?.conditions) ? group.conditions : []).filter(condition => {
      if (!condition || typeof condition !== 'object') return false;
      if (condition.type === 'FILTER_ROW') {
        return typeof condition.uid === 'string' && allowedSourceUIDs.has(condition.uid);
      }
      if (condition.type === 'formula') {
        return !hasExternalFormulaReference(condition.formula, allowedTableUIDs, allowedFieldUIDs, allowedSourceUIDs);
      }
      return isAllowedConditionUID(condition.uid, allowedTableUIDs, allowedFieldUIDs, allowedSourceUIDs);
    });

    return {
      ...group,
      conditions,
    };
  }).filter(group => group.conditions.length > 0);

  if (!rule.validConditions.length && !rule.sourceTables.length) {
    return null;
  }

  return rule;
};

const sanitizeWidgetForOtherNocode = (
  widget: any,
  allowedTableUIDs: Set<string>,
  allowedOptionTableUIDs: Set<string>,
  allowedFieldUIDs: Set<string>,
) => {
  if (!widget || typeof widget !== 'object') return;

  const options = widget.options;
  if (options && typeof options === 'object') {
    delete options['fields-filling'];
    delete options['data-fill-rules'];

    const sanitizedSubmitValid = sanitizeFormValidRuleForOtherNocode(
      options['submit-valid'],
      allowedTableUIDs,
      allowedOptionTableUIDs,
      allowedFieldUIDs,
    );
    if (sanitizedSubmitValid) {
      options['submit-valid'] = sanitizedSubmitValid;
    } else {
      delete options['submit-valid'];
    }

    if (externalDataWidgetTypes.has(widget.type) || linkedSelectWidgetTypes.has(widget.type)) {
      clearRelationConfig(widget, options, true);
    } else {
      clearLinkedFormConfig(options, true);
    }

    if (widget.type === 'widget.form.searchForm') {
      clearSearchFormConfig(options);
    }
    if (widget.type === 'widget.form.selectData') {
      clearSelectDataConfig(options);
    }
    if (widget.type === 'widget.form.relatedData') {
      clearRelatedDataConfig(options);
    }
    if (linkedSelectWidgetTypes.has(widget.type) && hasLinkedSelectDataSourceConfig(options)) {
      clearLinkedSelectConfig(options, widget.type);
    }
  }

  if (Array.isArray(widget.widgets)) {
    widget.widgets.forEach(child => sanitizeWidgetForOtherNocode(child, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs));
  }
};

const sanitizeFieldForOtherNocode = (
  field: any,
  allowedTableUIDs: Set<string>,
  allowedOptionTableUIDs: Set<string>,
  allowedFieldUIDs: Set<string>,
) => {
  if (!field || typeof field !== 'object') return;

  const extra = field.meta?.extra;
  if (extra && typeof extra === 'object') {
    const sanitizedSubmitValid = sanitizeFormValidRuleForOtherNocode(
      extra.submitValid,
      allowedTableUIDs,
      allowedOptionTableUIDs,
      allowedFieldUIDs,
    );
    if (sanitizedSubmitValid) {
      extra.submitValid = sanitizedSubmitValid;
    } else {
      delete extra.submitValid;
    }

    if (externalDataWidgetTypes.has(extra.widgetType) || linkedSelectWidgetTypes.has(extra.widgetType)) {
      clearRelationConfig(field, extra, true);
    }

    if (extra.widgetType === 'widget.form.searchForm') {
      clearSearchFormConfig(extra);
    }
    if (extra.widgetType === 'widget.form.selectData') {
      clearSelectDataConfig(extra);
    }
    if (extra.widgetType === 'widget.form.relatedData') {
      clearRelatedDataConfig(extra);
    }
    if (linkedSelectWidgetTypes.has(extra.widgetType) && hasLinkedSelectDataSourceConfig(extra)) {
      clearLinkedSelectConfig(extra, extra.widgetType);
    }

    const relatedTableUID = Array.isArray(extra.relatedTableUID) ? extra.relatedTableUID[1] : null;
    if (relatedTableUID && !allowedOptionTableUIDs.has(relatedTableUID)) {
      clearRelationConfig(field, extra, true);
    }

    const otherTableFieldUID = Array.isArray(extra.otherTableFieldUID) ? extra.otherTableFieldUID[1] : null;
    if (otherTableFieldUID && !allowedTableUIDs.has(otherTableFieldUID)) {
      delete extra.otherTableFieldUID;
      delete extra.dataFilter;
      delete extra.formula;
    }

    if (typeof extra.selectLinkForm === 'string') {
      clearLinkedFormConfig(extra, true);
    }
  }

  if (Array.isArray(field.subTableFields)) {
    field.subTableFields.forEach(subField => sanitizeFieldForOtherNocode(subField, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs));
  }
};

const sanitizeFormOptionsForOtherNocode = (
  formOptions: NocodeFormData["formOptions"] = {},
  allowedTableUIDs: Set<string>,
  allowedOptionTableUIDs: Set<string>,
  allowedFieldUIDs: Set<string>,
) => {
  Object.values(formOptions || {}).forEach(option => {
    if (!option || typeof option !== 'object') return;
    delete option.process;
    sanitizeWidgetForOtherNocode(option?.widget, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs);
    if (Array.isArray(option?.deletedWidgets)) {
      option.deletedWidgets.forEach(item => sanitizeWidgetForOtherNocode(item as any, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs));
    }
  });
};

const sanitizeCopiedFormForOtherNocode = (payload: CopiedFormPayload) => {
  const sanitizedPayload = deepClone(payload);
  const allowedTableUIDs = new Set(sanitizedPayload.tables.map(table => table.uid));
  const allowedOptionTableUIDs = new Set(sanitizedPayload.optionTables.map(table => table.uid));
  const allowedFieldUIDs = new Set<string>();

  sanitizedPayload.tables.forEach(table => {
    table.fields?.forEach(field => {
      allowedFieldUIDs.add(field.uid);
      if (field.meta?.uid) {
        allowedFieldUIDs.add(field.meta.uid);
      }
      field.subTableFields?.forEach(subField => {
        allowedFieldUIDs.add(subField.uid);
        if (subField.meta?.uid) {
          allowedFieldUIDs.add(subField.meta.uid);
        }
      });
    });
  });

  sanitizedPayload.tables.forEach(table => {
    table.fields?.forEach(field => sanitizeFieldForOtherNocode(field, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs));
  });
  sanitizeFormOptionsForOtherNocode(sanitizedPayload.formOptions, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs);

  const walk = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(item => walk(item));
      return;
    }

    const relatedTableUID = Array.isArray(value.relatedTableUID) ? value.relatedTableUID[1] : null;
    if (relatedTableUID && !allowedOptionTableUIDs.has(relatedTableUID)) {
      delete value.relatedTableUID;
      delete value.relatedDataMode;
      if (Array.isArray(value.relatedTableFields)) {
        value.relatedTableFields = [];
      }
    }

    const subTableUID = Array.isArray(value.subTableUID) ? value.subTableUID[1] : null;
    if (subTableUID && !allowedTableUIDs.has(subTableUID)) {
      delete value.subTableUID;
      if (Array.isArray(value.subTableFields)) {
        value.subTableFields = [];
      }
    }

    const otherTableFieldUID = Array.isArray(value.otherTableFieldUID) ? value.otherTableFieldUID[1] : null;
    if (otherTableFieldUID && !allowedTableUIDs.has(otherTableFieldUID)) {
      delete value.otherTableFieldUID;
      delete value.dataFilter;
    }

    if (typeof value.selectLinkForm === 'string') {
      clearLinkedFormConfig(value, true);
    }

    if ('process' in value) {
      delete value.process;
    }

    if ('select-search-form' in value) {
      clearSearchFormConfig(value);
    }

    if ('connectionTable' in value) {
      clearSelectDataConfig(value);
      if ('dataMode' in value) {
        clearRelatedDataConfig(value);
      }
    }

    if (hasLinkedSelectDataSourceConfig(value)) {
      clearLinkedSelectConfig(value, value.widgetType || value.type);
    }

    clearAutoRuleConfig(value);

    const metaExtra = value.meta?.extra;
    const metaRelatedTableUID = Array.isArray(metaExtra?.relatedTableUID) ? metaExtra.relatedTableUID[1] : null;
    if (metaRelatedTableUID && !allowedOptionTableUIDs.has(metaRelatedTableUID)) {
      clearRelationConfig(value, metaExtra, true);
    }

    if (value.formula && typeof value.formula === 'object' && value.formula.filterRules) {
      const hasExternalReference = detectExternalTableReference(
        value.formula.filterRules,
        allowedTableUIDs,
        allowedOptionTableUIDs,
        allowedFieldUIDs,
      );
      if (hasExternalReference) {
        delete value.formula;
      }
    }

    if (value.linkFormFilter && detectExternalTableReference(value.linkFormFilter, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs)) {
      delete value.linkFormFilter;
    }
    if (value.dataFilter && detectExternalTableReference(value.dataFilter, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs)) {
      delete value.dataFilter;
    }
    if (value.filterRule && detectExternalTableReference(value.filterRule, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs)) {
      delete value.filterRule;
    }
    if (value.targetTableFilterRule && detectExternalTableReference(value.targetTableFilterRule, allowedTableUIDs, allowedOptionTableUIDs, allowedFieldUIDs)) {
      delete value.targetTableFilterRule;
    }

    for (const childValue of Object.values(value)) {
      walk(childValue);
    }
  }

  walk(sanitizedPayload);
  return sanitizedPayload;
}

const retargetCopiedFormTableOwnerForOtherNocode = (payload: CopiedFormPayload, targetFormDataUID: string) => {
  const allowedTableUIDs = new Set(payload.tables.map(table => table.uid));

  const walk = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(item => walk(item));
      return;
    }

    if (Array.isArray(value.subTableUID) && allowedTableUIDs.has(value.subTableUID[1])) {
      value.subTableUID = [targetFormDataUID, value.subTableUID[1]];
    }
    if (Array.isArray(value.primaryTable) && allowedTableUIDs.has(value.primaryTable[1])) {
      value.primaryTable = [targetFormDataUID, value.primaryTable[1]];
    }

    Object.values(value).forEach(childValue => walk(childValue));
  };

  walk(payload);
};

const appendCopiedFormToTargetNocode = (targetNocode: Pick<Nocode, "meta" | "body">, payload: CopiedFormPayload) => {
  if (!targetNocode.body.formData) {
    throw new Error(i18next.t('NocodePageView.targetNocodeUnavailable'));
  }

  retargetCopiedFormTableOwnerForOtherNocode(payload, targetNocode.body.formData.uid);

  targetNocode.body.formData.tables = [
    ...(targetNocode.body.formData.tables || []),
    ...payload.tables,
  ];
  targetNocode.body.formData.options.tables = [
    ...(targetNocode.body.formData.options.tables || []),
    ...payload.optionTables,
  ];
  targetNocode.body.formData.formOptions = {
    ...(targetNocode.body.formData.formOptions || {}),
    ...(payload.formOptions || {}),
  };
  targetNocode.body.structure = [
    ...(targetNocode.body.structure || []),
    {
      id: payload.table.uid,
      name: payload.table.alias,
      type: NocodeStructureType.FORM,
    }
  ];
}

const copyToOtherNocodeDialog = reactive({
  visible: false,
  keyword: '',
  loading: false,
  selectedNocodeId: '',
  sourceNode: null as NocodeStructure | null,
  targetNocodes: [] as Nocode[],
});

const shareNocodeCacheStore = useShareNocodeCacheStore();

const loadCopyTargetNocodes = async () => {
  const res = await shareNocodeCacheStore.getShareNocodes();
  copyToOtherNocodeDialog.targetNocodes = res.filter(item => {
    return item?.meta?.id
      && item.meta.id !== nocodeId
      && item.body
      && hasApplicationPermission(item.body, 'editable');
  });
}

const closeCopyToOtherNocodeDialog = () => {
  copyToOtherNocodeDialog.visible = false;
  copyToOtherNocodeDialog.keyword = '';
  copyToOtherNocodeDialog.loading = false;
  copyToOtherNocodeDialog.selectedNocodeId = '';
  copyToOtherNocodeDialog.sourceNode = null;
}

const openCopyToOtherNocodeDialog = async (data: NocodeStructure) => {
  copyToOtherNocodeDialog.sourceNode = data;
  copyToOtherNocodeDialog.selectedNocodeId = '';
  copyToOtherNocodeDialog.keyword = '';
  await loadCopyTargetNocodes();
  copyToOtherNocodeDialog.visible = true;
}

const handleCopyToCurrentNocode = async (data: NocodeStructure, node: any) => {
  if (data.type !== NocodeStructureType.FORM) return;
  const copyName = getCopiedFormName(data.name);
  const copied = await requestCopiedForm(data.id, copyName);
  if (!copied) return;

  nocode.value.body.formData = copied.formData;
  const savedConnections = await saveNocodeConnections();
  if (!savedConnections) return;

  treeRef.value.insertAfter({
    id: copied.table.uid,
    name: copied.table.alias,
    type: data.type,
  }, node);

  nocode.value.body.structure = treeRef.value.data;
  const savedStructure = await saveStructureToTarget(nocode.value, nocode.value.body.structure, true);
  if (!savedStructure) return;

  ElMessage.success(i18next.t('NocodePageView.copySuccess'));
}

const handleCopyToOtherNocode = async () => {
  if (!copyToOtherNocodeDialog.sourceNode) return;
  if (!copyToOtherNocodeDialog.selectedNocodeId) {
    ElMessage.warning(i18next.t('NocodePageView.selectTargetNocodeWarn'));
    return;
  }

  const targetNocode = copyToOtherNocodeDialog.targetNocodes.find(item => item.meta.id === copyToOtherNocodeDialog.selectedNocodeId);
  if (!targetNocode?.body?.formData) {
    ElMessage.warning(i18next.t('NocodePageView.targetNocodeUnavailable'));
    return;
  }

  copyToOtherNocodeDialog.loading = true;
  try {
    const copyName = getCopiedFormName(copyToOtherNocodeDialog.sourceNode.name);
    const copied = await requestCopiedForm(copyToOtherNocodeDialog.sourceNode.id, copyName);
    if (!copied) return;

    const copiedPayload = getCopiedFormPayload(copied.formData, copied.table);
    const sanitizedPayload = sanitizeCopiedFormForOtherNocode(copiedPayload);
    const targetNocodeData = deepClone(targetNocode);
    appendCopiedFormToTargetNocode(targetNocodeData, sanitizedPayload);

    const savedConnections = await saveNocodeConnectionsToTarget(targetNocodeData);
    if (!savedConnections) return;

    const savedStructure = await saveStructureToTarget(targetNocodeData, targetNocodeData.body.structure || []);
    if (!savedStructure) return;

    ElMessage.success(i18next.t('NocodePageView.copySuccess'));
    closeCopyToOtherNocodeDialog();
  } finally {
    copyToOtherNocodeDialog.loading = false;
  }
}

const getCoverImageURL = (nocodeId: string) => {
  return `project/get-nocode-snapshot/${nocodeId}`;
};
function setDeleteConfirmDialog(dcc: DeleteConfirmContext){
  deleteConfirmContext.text = dcc.text;
  deleteConfirmContext.tip = dcc.tip;
  deleteConfirmContext.visible = dcc.visible;
  deleteConfirmContext.confirm = dcc.confirm;
}

const draftBoxListVisible = ref(false);
const drafts = ref<Row[]>([]);
let draftsLoadedKey = "";
const draftsPromises = new Map<string, Promise<void>>();
const getDrafts = async (options: { refreshTodoCount?: boolean } = {}) => {
  const { refreshTodoCount = true } = options;
  if (!activeFormId.value) return;
  const draftKey = `${nocodeId}:${activeFormId.value}`;
  if (draftsLoadedKey === draftKey) {
    if (refreshTodoCount) scheduleTodoCountRefresh();
    return;
  }
  let draftsPromise = draftsPromises.get(draftKey);
  if (!draftsPromise) {
    draftsPromise = formDataApi.getDrafts({
      nocodeId,
      tableUID: activeFormId.value,
    }).then((data) => {
      if (data) {
        drafts.value = data;
        draftsLoadedKey = draftKey;
        if (!data?.length) draftBoxListVisible.value = false;
      }
    }).finally(() => draftsPromises.delete(draftKey));
    draftsPromises.set(draftKey, draftsPromise);
  }
  await draftsPromise;
  if (refreshTodoCount) {
    scheduleTodoCountRefresh();
  }
}
const handleDraftSubmitted = async () => {
  draftsLoadedKey = "";
  await Promise.all([
    getDrafts({ refreshTodoCount: false }),
    formDataViewerRef.value?.refreshActiveDataView?.(),
  ]);
  scheduleTodoCountRefresh();
}
const handleDraftSaved = async () => {
  draftsLoadedKey = "";
  await getDrafts({ refreshTodoCount: false });
}
const openDraftBox = () => {
  draftBoxListVisible.value = true;
}

const deleteDraftRows = async (rows: Row[]) => {
  if (!rows.length) return false;
  const table = formData.value?.tables?.find(table => table.uid === activeFormId.value);
  if (!table) return;
  const uuidField = table.fields.find(field => field.meta.name === SystemField.UUID);
  if (!uuidField) return;
  return await formDataApi.deleteDraft({
    nocodeId,
    tableUID: activeFormId.value,
    rows,
    keys: [ [formData.value.uid, table.uid, uuidField.uid] ],
    sign: nocode.value.body.sign,
    onMainSign: (sign: string) => {
      nocode.value.body.sign = sign;
    },
  })
}

const handleDeleteDraft = async (row: Row) => {
  const res = await deleteDraftRows([ row ]);
  if (res) {
    ElMessage.success(i18next.t('NocodePageView.deleteSuccess'));
    drafts.value = drafts.value.filter(item => item[SystemField.UUID] !== row[SystemField.UUID]);
    if (!drafts.value.length) draftBoxListVisible.value = false;
    scheduleTodoCountRefresh();
  }
}

const handleClearDrafts = async () => {
  const res = await deleteDraftRows([ ...drafts.value ]);
  if (res) {
    ElMessage.success(i18next.t('NocodePageView.clearDraftSuccess'));
    drafts.value = [];
    draftBoxListVisible.value = false;
    scheduleTodoCountRefresh();
  }
}

// 切换全部展开和全部收起状态
const toggleExpandCollapse = () => { 
  const shouldExpand = isAllCollapse.value
  treeRef.value.store._getAllNodes().forEach(node => {
    if(!node.isLeaf) {
      node.expanded = shouldExpand;
    }
  });
}

watch(() => activeID.value, (value, oldValue) => {
  if (equals(value, oldValue) || !value) return;
  if (activeID.value === activeFormId.value) {
    drafts.value = [];
    getDrafts({ refreshTodoCount: false });
  }
}, { immediate: true });

onBeforeRouteLeave(async () => {
  if (isLeavingBecauseExpired.value) {
    return true;
  }
  return await canLeaveCurrentFormViewer(true);
});

provide('setDeleteConfirmDialog', setDeleteConfirmDialog);
</script>

<style lang="scss" scoped>
:deep(.nocode-expired-dialog) {
  border-radius: 8px;
  padding: 0;

  .el-dialog__header {
    display: none;
  }

  .el-dialog__body {
    padding: 24px 20px;
  }

  .el-dialog__footer {
    padding: 16px 20px;
  }
}

.expired-dialog-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  line-height: 20px;
  color: #333;

  .warning-icon {
    color: #ffb020;
    flex-shrink: 0;
  }

  .text {
    flex: 1;
  }
}

.confirm-btn {
  min-width: 48px;
  height: 32px;
  padding: 0 16px;
  border-radius: 4px;
}

.container {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  min-width: 1000px;
  --icon-default-color: #373737;
  --icon-page-folder-color: #66b22b;
  --icon-page-document-color: #f5764e;
  .aside-container {
    width: 300px;
    height: 100%;
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;

    &:hover {
      .fold-button {
        display: flex !important;
      }
    }

    .header {
      width: 100%;
      height: 52px;
      column-gap: 6px;
      border-bottom-width: 1px;
      padding: 16px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;

      span {
        // width: calc(100% - 114px);
        flex: 1;
        font-weight: 400;
        font-size: 20px;
        line-height: 32px;
        letter-spacing: 0%;
        margin-left: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .icon {
        min-width: 24px;
        width: 24px;
        height: 24px;
        border-radius: 4px;
        display: flex;
        justify-content: center;
        align-items: center;

        .el-icon {
          color: var(--color-white)
        }
      }

      .back {
        height: 32px;
        width: 32px;
        color: var(--text-color-primary);
        transition: all 0.3s ease;
        border-radius: 4px;

        // &:hover {
        //   background-color: var(--bg-color-overlay);
        // }
      }

      .el-icon {
        height: 24px;
        width: 24px;

        &.logo {
          margin-left: 4px;
          margin-right: 8px;
        }
      }

      img {
        width: 24px; 
        height: 24px;
      }

      .el-image {
        border-radius: 4px;
        width: 32px; 
        height: 32px;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .fold-button {
        padding: 0;
        width: 32px;
        min-width: 32px;
        border-radius: 4px;
        display: none;
      }
    }

    .tab {
      .count {
        position: absolute;
        top: 5px;
        right: 9px;
        width: 16px;
        height: 16px;
        background-color: var(--color-danger);
        border-radius: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-white);
        margin-left: auto;
      }
      ul {
        display: flex;
        justify-content: space-around;
        height: 84px;
        li {
          position: relative;
          height: 100%;
          display: flex;
          justify-content: center;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 64px;

          &:hover {
            background-color: var(--bg-color-overlay);
          }

          &.active {
            background-color: var(--bg-color-overlay);
          }

          span {
            font-weight: 400;
            font-size: 12px;
            line-height: 16px;
            letter-spacing: 0%;
            margin-top: 4px;
          }
        }
      }
      border-bottom: 1px solid var(--border-color);
    }

    .project {
      flex: 1;
      padding: 0 0 16px 0;
      display: flex;
      flex-direction: column;
      row-gap: 8px;
      min-height: 0px;

      .scroll-container {
        height: 100%;
      }
      .project-search-box {
        height: 48px;
        padding: 8px;
        display: flex;
        :deep(.el-input) {
          --el-input-bg-color: var(--bg-color-overlay);
          --el-input-focus-border-color: unset;
          width: 100%;
          height: 32px;
          .el-input__wrapper {
            border-radius: 4px;
            box-shadow: none;
            .el-input__prefix {
              color: var(--icon-default-color);
              font-size: 16px;
            }
          }
        }

        .el-button {
          .el-icon {
            margin-left: 8px;
          }
        }
      }

      :deep(.el-tree) {
        height: calc(100% - 40px);

        &.has-home-page {
          height: calc(100% - 96px);
        }
        
        .el-tree-node__content {
          width: 100%;
          height: 44px;
          line-height: 44px;
          transition: all 0.3s ease;

          .el-tree-node__expand-icon {
            position: absolute;
            right: 19px;
            padding: 0px;
            color: var(--icon-default-color);

            &.expanded {
              transform: rotate(180deg);
            }
          }
  
          &:hover {
            background-color: var(--bg-color-overlay) !important;
          }

          &:has(> .custom-tree-node.popover-open) {
            background-color: var(--bg-color-overlay) !important;
          }
  
          &:has(> .custom-tree-node.active) {
            background-color: #e8f6ff !important;
          }

          .el-tree-node__expand-icon.is-leaf {
            padding: 0;
            margin-right: 4px
          }

          .custom-tree-node {
            width: calc(100% - 16px);
            height: 100%;
            display: flex;
            align-items: center; 
            position: relative;

            .node-icon {
              width: 20px;
              height: 20px;
              border-radius: 4px;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 3px;
              margin-right: 8px;
              margin-left: 16px;
            }

            .tree-node-icon {
              color: var(--icon-default-color);
            }

            > span {
              flex: 1;
              min-width: 0;
              width: auto;
              z-index: 1;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .fullscreen-button {
              flex: 0 0 20px;
              width: 20px;
              min-width: 20px;
              height: 20px;
              padding: 0;
              margin-right: 8px;
              color: var(--icon-default-color);
              opacity: 0;
              border-radius: 4px;
              transition: all 0.3s ease;

              &:hover {
                background-color: var(--color-white);
              }
            }

            .more-button {
              flex-shrink: 0;
              margin-right: 8px;
              color: var(--icon-default-color);
              opacity: 0;
              transition: all 0.3s ease;
              width: 20px;
              height: 20px;
              border-radius: 4px;

              &:hover {
                background-color: var(--color-white);
              }
            }

            .edit-button {
              flex-shrink: 0;
              color: var(--icon-default-color);
              opacity: 0;
              transition: all 0.3s ease;
              width: 20px;
              height: 20px;
              border-radius: 4px;

              &:hover {
                background-color: var(--color-white);
              }
            }

            .edit-box {
              opacity: 0;
              transition: all 0.3s ease;
              width: 20px;
              height: 20px;
              border-radius: 4px;
            }

            &:hover,
            &.popover-open {
              .fullscreen-button,
              .more-button {
                opacity: 1;
              }

              .edit-button {
                opacity: 1;
              }
            }
          }

        }

        .el-tree-node:focus,
        .el-tree-node:focus-visible,
        .el-tree-node.is-focusable {
          .el-tree-node__content {
            background-color: unset;
          }
        }

      }

      .home-page-node {
        width: calc(100% - 16px);
        height: 44px;
        margin: 0 8px 4px;
        padding: 0 8px;
        display: flex;
        align-items: center;
        border-radius: 4px;
        cursor: pointer;
        color: var(--text-color-primary);

        &:hover,
        &.popover-open {
          background-color: var(--bg-color-overlay);
        }

        &.active {
          background-color: #e8f6ff;
        }

        .node-icon.home {
          width: 20px;
          height: 20px;
          margin-right: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
        }

        > span {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .more-button {
          width: 20px;
          height: 20px;
          margin-left: 8px;
          border-radius: 4px;
          color: var(--icon-default-color);
          opacity: 0;
          transition: opacity 0.3s ease;

          &:hover {
            background-color: var(--color-white);
          }
        }

        &:hover,
        &.popover-open {
          .more-button {
            opacity: 1;
          }
        }
      }
    }
  }


  .main-wrapper {
    width: calc(100% - 300px);
    background-color: var(--bg-color-overlay);
    height: 100%;
    display: flex;
    flex-direction: column;

    &.hide-sidebar {
      width: 100%;
    }

    .header {
      display: flex;
      align-items: center;
      width: 100%;
      height: 52px;
      padding: 0px 16px 0px 16px;
      border-bottom: 1px solid var(--border-color);
      border-bottom-width: 1px;
      background-color: var(--color-white);
      column-gap: 16px;

      .expand-button {
        padding: 0;
        width: 32px;
        border-radius: 4px;
      }


      span {
        font-weight: 400;
        font-size: 20px;
        line-height: 32px;
        letter-spacing: 0%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .header-right {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .header-action-link {
        display: flex;
        text-decoration: none;
      }

      .header-action {
        width: 32px;
        height: 32px;
        padding: 0;
        border-radius: 8px;
        color: var(--text-color-regular);
        border: 1px solid transparent;
        transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;

        &:hover {
          background-color: var(--fill-color-light);
          color: var(--text-color-primary);
        }

        &.active {
          background-color: #e8f3ff;
          border-color: #b8dcff;
          color: var(--color-primary);
        }
      }

      .header-action-badge {
        display: flex;

        :deep(.el-badge__content) {
          top: 6px;
          right: 16px;
        }
      }

      :deep(.header-action .el-icon) {
        margin: 0;
      }
    }

    .viewer-container {
      display: flex;
      justify-content: center;
      width: 100%;
      flex: 1;

      .project-viewer {
        position: relative;
        width: 100%;
        height: 100%;
        border: 0px solid var(--border-color);
        overflow: hidden;
      }
    }

    .viewer-loading {
      height: calc(100% - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      color: var(--text-color-secondary);
      background-color: var(--bg-color-page);

      .viewer-loading__icon {
        color: var(--el-color-primary);
        animation: viewer-loading-rotate 2s linear infinite;
      }
    }

    .todo-container,
    .empty-layer {
      height: calc(100% - 64px);
    }
    .empty-layer {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      color: var(--text-color-secondary);
    }
  }
}

@keyframes viewer-loading-rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>

<style lang="scss">
.nocode-page-viewer-tree-popover {
  --el-popover-padding: 4px;
  --el-popover-border-radius: 12px;
  --el-bg-color-overlay: #ffffff;
  --el-popover-border-color: rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.12), 0 2px 8px rgba(15, 23, 42, 0.06);

  ul {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .line {
      width: 100%;
      height: 1px;
      background-color: rgba(15, 23, 42, 0.08);
    }

    li {
      font-weight: 400;
      font-size: 14px;
      line-height: 20px;
      color: #1f2937;
      height: 36px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      border-radius: 4px;
      transition: background-color 0.2s ease, color 0.2s ease;
      cursor: pointer;

      .el-icon {
        color: #6b7280;
        margin-right: 8px;
      }

      &:hover {
        background: #f3f4f6;
      }
    }
  }
}
</style>
