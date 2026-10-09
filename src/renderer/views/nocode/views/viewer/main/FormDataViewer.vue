<template>
  <vn-stack class="form-data-viewer" v-model="activeTab" :beforeLeave="handleBeforeLeaveTab">
    <el-container class="container" :style="{ width: viewSettingDrawerVisible ? `calc(100% - ${viewSettingDrawerWidth})` : '100%' }">
     <el-header>
        <div class="view-list-wrapper" v-if="!isEmptyViews" ref="tabsWrapperRef">
          <el-dropdown trigger="click" :hide-on-click="false" :teleported="false" :persistent="false" size="small" popper-class="viewer-manage-popover"
            placement="bottom-start" @visible-change="onChangeMenuVisible">
            <div class="view-header-button" v-if="getAppPermissions('editable')"
              :style="{ 'background-color': viewListVisible ? 'var(--bg-color-page)' : '' }">
              <el-icon><i-ep-setting /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>
                  <el-popover :disabled="isEmptyViews" placement="right" :show-arrow="false" :visible="visible"
                    :teleported="false" :persistent="false" :trigger="[]" :popper-style="{ padding: '0', minWidth: '100px' }" :offset="14"
                    width="auto" transition="none" popper-class="viewer-sort-popover" @hide="saveTabData">
                    <template #reference>
                      <div
                        :style="{ width: '100%', padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }"
                        @mouseenter="onEnterViewDrager" @mouseleave="onLeaveViewDrager">
                        <div class="drop-menu-describe">
                          <el-icon :size="14" :style="{ marginRight: 0 }">
                            <i-ep-sort />
                          </el-icon>
                          <span>{{ $t('FormDataViewer.viewSort') }}</span>
                        </div>
                        <el-icon :size="14" :style="{ marginRight: 0 }">
                          <i-ep-arrow-right />
                        </el-icon>
                      </div>
                    </template>
                    <div class="el-dropdown-menu" :class="{ 'is-dragging': isDragging }" :style="{
                      '--el-dropdown-menuItem-hover-fill': 'var(--el-color-primary-light-9)',
                      '--el-dropdown-menuItem-hover-color': 'var(--el-color-primary)',
                    }" @mouseenter="onEnterViewDrager" @mouseleave="onLeaveViewDrager">
                      <draggable v-if="showTableViews"
                        :model-value="showTableViews" item-key="uid" @start="handleDragStart"
                        @end="handleDragEnd" handle=".move" chosen-class="dragging"
                        :component-data="{ class: 'tabs-content' }" animation="400" ref="draggableRef">
                        <template #item="{ element, index }">
                          <div class="view-drag-item">
                            <div class="view-describe">
                              <el-icon :size="16">
                                <i-workbench-form v-if="element.type === 'form'" />
                                <i-workbench-table v-if="element.type === 'table'" />
                                <i-ven-nocode-view-document
                                  v-if="element.type === 'document'"></i-ven-nocode-view-document>
                                <i-icon-park-outline-category-management
                                  v-if="element.type === 'category'"></i-icon-park-outline-category-management>
                                <i-workbench-table v-if="element.type === 'album'"></i-workbench-table>
                              </el-icon>
                              <span class="tab-name">
                                {{ getViewDisplayName(element) }}
                              </span>
                            </div>

                            <el-icon class="darg-icon move" color="var(--text-color-secondary)" :size="16">
                              <i-icon-park-outline-drag />
                            </el-icon>
                          </div>
                        </template>
                      </draggable>
                    </div>
                  </el-popover>
                </el-dropdown-item>
                <el-dropdown-item v-if="canManagePermissionSetting" @mouseenter="hideViewSorter" @click="openViewPermissionSetting">
                  <div class="drop-menu-describe">
                    <el-icon :size="14" :style="{ marginRight: 0 }">
                      <i-ven-nocode-setting-permission-view />
                    </el-icon>
                    <span>{{ $t('FormDataViewer.viewPermission') }}</span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-scrollbar ref="scrollbarRef" @scroll="onScroll">
            <div class="scroll-button-overlay left" v-if="showLeftButton">
              <el-button link class="scroll-button" @click="scrollTab(-300)">
                <el-icon :size="16" :class="{ disabled: scrollLeft <= 0 }">
                  <CaretLeft />
                </el-icon>
              </el-button>
            </div>
            <div class="tab-container" ref="tabContainer">
              <vn-stack-tab v-for="item in showTableViews" :key="item.uid" class="tab"
                :class="{ isEditor: getAppPermissions('editable'), notEditor: !getAppPermissions('editable') }"
                :name="item.uid">
                <div class="tab-context">
                  <el-icon :size="16">
                    <i-workbench-form v-if="item.type === 'form'" />
                    <i-workbench-table v-if="item.type === 'table'" />
                    <i-ven-nocode-view-document v-if="item.type === 'document'"></i-ven-nocode-view-document>
                    <i-icon-park-outline-category-management
                      v-if="item.type === 'category'"></i-icon-park-outline-category-management>
                    <i-workbench-table v-if="item.type === 'album'"></i-workbench-table>
                  </el-icon>
                  <span class="tab-name">
                    {{ getViewDisplayName(item) }}
                  </span>
                  <el-popover popper-class="form-data-viewer-more-popover" placement="bottom-start" :show-after="200"
                    :hide-after="200" :offset="0" :teleported="true" :persistent="false"
                    v-if="getAppPermissions('editable')">
                    <div class="more-menu">
                      <ul>
                        <li @click="openRenameDialog(item)">
                          <el-icon>
                            <i-ven-page-view-rename />
                          </el-icon>
                          {{ $t('FormDataViewer.rename') }}
                        </li>
                        <li @click="handleCopyView(item)" v-if="false">
                          <el-icon>
                            <i-ven-form-copy />
                          </el-icon>
                          {{ $t('FormDataViewer.copyView') }}
                        </li>
                        <li @click="showSettingDrawer(item)" v-if="isViewSettingDrawerAvailable && (item.type === 'album' || item.type === 'table' || item.type === 'form')">
                          <el-icon>
                            <i-ven-setting />
                          </el-icon>
                          {{ $t('FormDataViewer.viewConfig') }}
                        </li>
                        <li @click="deleteTab(item.uid)" class="delete">
                          <el-icon>
                            <i-ep-delete />
                          </el-icon>
                          {{ $t('FormDataViewer.delView') }}
                        </li>
                      </ul>
                    </div>
                    <template #reference>
                      <el-icon class="more-btn" ref="moreButtonRef"
                        :style="{ visibility: activeTab === item.uid ? 'visible' : 'hidden' }">
                        <i-ep-more-filled></i-ep-more-filled>
                      </el-icon>
                    </template>
                  </el-popover>
                </div>
              </vn-stack-tab>
            </div>
            <div class="scroll-button-overlay right" v-if="showRightButton">
              <el-button link class="scroll-button" @click="scrollTab(300)">
                <el-icon :class="{ disabled: scrollLeft + clientWidth >= scrollWidth }">
                  <CaretRight />
                </el-icon>
              </el-button>
            </div>
          </el-scrollbar>
          <el-dropdown v-if="!isEmptyViews" trigger="click" :hide-on-click="false" :teleported="false" :persistent="false" size="small"
            popper-class="viewer-manage-popover" placement="bottom-end" ref="viewDownRef" max-height="300px">
            <el-button link class="view-header-button">
              <el-icon><i-ep-arrow-down /></el-icon>
            </el-button>

            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-for="element in showTableViews" @click="switchTab(element.uid)"
                  :class="{
                    'el-dropdown-item-active': activeTab === element.uid,
                  }">
                  <div class="view-arrow-down-drag-item">
                    <el-icon :size="16">
                      <i-workbench-form v-if="element.type === 'form'" />
                      <i-workbench-table v-if="element.type === 'table'" />
                      <i-ven-nocode-view-document v-if="element.type === 'document'"></i-ven-nocode-view-document>
                      <i-icon-park-outline-category-management
                        v-if="element.type === 'category'"></i-icon-park-outline-category-management>
                      <i-workbench-table v-if="element.type === 'album'"></i-workbench-table>
                    </el-icon>
                    <span class="tab-name">
                      {{ getViewDisplayName(element) }}
                    </span>
                  </div>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <div ref="addViewButtonRef" class="view-header-button" @click="showViewList"
            v-if="!isEmptyViews && getAppPermissions('editable')"
            :style="{ 'background-color': viewListVisible ? 'var(--bg-color-page)' : '' }">
            <el-icon><i-ep-plus /></el-icon>
          </div>
        </div>
        <div ref="addViewButtonRef" class="add-tab" @click="showViewList"
          v-if="isEmptyViews && getAppPermissions('editable')">
          <el-icon><i-ep-plus /></el-icon>
          <span>{{ $t('FormDataViewer.addView') }}</span>
        </div>
      </el-header>
      <div class="content">
        <div class="empty-box" v-if="isEmpty(showTableViews)">
          <img src="@renderer/assets/image/view-empty-cover.png" alt="">
          {{ $t('FormDataViewer.noViewAdd') }}
        </div>
        <div v-for="item in showTableViews" :key="item.uid" class="tab vn-stack-layer" :class="{ active: activeTab === item.uid }" v-show="activeTab === item.uid" v-else>
          <!-- 数据管理表-温馨提示 -->
          <div class="warm-reminder" v-if="item.type === 'table' && warnReminderDisplay && activeTab === item.uid">
            <div class="warm-reminder-container">
              <span class="text" :title="$t('FormDataViewer.warnReminderText')">{{ $t('FormDataViewer.warnReminderText') }}</span>
              <el-button link>
                <el-icon :size="16" class="close" @click="closeWarnReminder">
                  <i-ep-close></i-ep-close>
                </el-icon>
              </el-button>
            </div>
          </div>
          <submit-form-layer :active="activeTab === item.uid" :currentTOC="item" v-if="item.type === 'form' && shouldMountView(item.uid)" @draft-saved="emit('draft-saved')" @form-submitted="handleFormSubmitted" />
          <data-management-v2 :ref="(el) => setDataManagementRef(item.uid, el)" :active="activeTab === item.uid" :uid="item.uid" :currentTOC="item" v-else-if="item.type === 'table' && shouldMountView(item.uid)" @submitted="emit('submitted')" @changeRows="emit('changeRows')" @draft-saved="emit('draft-saved')"
            :class="{
              'has-warn-reminder-data-management-height': item.type === 'table' && warnReminderDisplay
            }"
          ></data-management-v2>
          <document-view v-else-if="isCatalogView(item) && item.type === 'document' && shouldMountView(item.uid)" :ref="(el) => setDocumentViewRef(item.uid, el)" :active="activeTab === item.uid" :currentTOC="item" @draft-saved="emit('draft-saved')"></document-view>
          <category-view v-else-if="isCatalogView(item) && item.type === 'category' && shouldMountView(item.uid)" :active="activeTab === item.uid" :currentTOC="item"></category-view>
          <album-view 
            v-else-if="item.type === 'album' && shouldMountView(item.uid)"
            :active="activeTab === item.uid"
            :currentTOC="item"
            @submitted="emit('submitted')"
          >
          </album-view>
        </div>
      </div>
      <div
        ref="dataViewListRef"
        class="data-view-list"
        v-show="viewListVisible"
        tabindex="0"
        @blur="viewListVisible = false;"
        :style="{ ...location }"
      >
        <div v-for="item in dataViewMenu" :key="item.name" class="data-view-item" @click="handleAddTab(item)">
          <el-icon :size="16">
            <i-workbench-form v-if="item.name === 'form'"/>
            <i-workbench-table v-if="item.name === 'table'"/>
            <i-ven-nocode-view-document v-if="item.name === 'document'"></i-ven-nocode-view-document>
            <i-icon-park-outline-category-management v-if="item.name === 'category'"></i-icon-park-outline-category-management>
            <i-workbench-table v-if="item.name === 'album'"></i-workbench-table>
          </el-icon>
          {{ item.alias }}
        </div>
      </div>
      <catalog-setting-dialog
        v-if="dialogState.catalogSettingDialogVisible"
        v-model="dialogState.catalogSettingDialogVisible"
        @savaCatalogSetting="savaCatalogSetting"
        :type="dialogState.getArgs('catalogSettingDialogVisible')"
      />
    </el-container>
    <view-drawer
      v-if="isViewSettingDrawerAvailable && viewSettingDrawerMounted"
      ref="viewSettingDrawerRef"
      :width="viewSettingDrawerWidth"
      @otherClick="viewSettingDrawerHandleOtherClose"
      @beforeClose="handleCloseViewSettingDrawer"
      @open="viewSettingDrawerOpen"
    >
      <div ref="viewSettingDrawerSlotRef" class="view-settting-drawer-slot"></div>
    </view-drawer>
  </vn-stack>
  <view-rename-dialog v-if="viewRenameDialogMounted" ref="viewRenameDialogRef" @doRename="handleRename"/>
</template>

<script lang='ts' setup>
import { NOCODE, FORM_DATA_VIEWER_EMITTER, VIEW_ACTIVE_UID, NOCODE_SIGN_IS_LATEST } from '@renderer/types';
import { computed, defineAsyncComponent, inject, watch, ref, shallowRef, toRaw, nextTick, Ref, onMounted, provide, onUnmounted, toRefs, type ComponentPublicInstance } from 'vue';
import { provideFormData, provideFormTable } from '../../editor/form/hooks';
import { useDialogStore } from '@renderer/stores';
import axios from 'axios';
import { CatalogViewSetting, Nocode, NocodeMeta, PermissionFilterMode } from '@common/types/nocode';
import { ElMessage, ScrollbarInstance, Table } from 'element-plus';
import { unique } from '@common/utils/unique';
import { cloneDeep } from 'lodash';
import { usePassportStore } from '@renderer/stores';
import { Permission, SettingTab } from '@common/types/project';
import { isEmpty } from '@common/utils/object';
import { provideRuntime, isMobile } from '@renderer/utils';
import { FormTableRuntime } from "@common/types/nocode";
import { buildOperationPermissionsForActionCopies, cloneViewActionsForCopy } from '@common/utils/viewActionPermission';
import { OrganizeUtil, getVisibleViewsForCurrentAccount } from '@renderer/views/nocode/utils';
import { ORGANIZE_UTIL, VIEW_SETTING_DRAWER_CLOSE_GUARD, VIEW_SETTING_DRAWER_PANEL_STATE, VIEW_SETTING_DRAWER_REF, VIEW_SETTING_DRAWER_SLOT } from '@renderer/types';
import { DefautAlbumStateOption } from '@renderer/views/nocode/components/global/table/album'
import { Events, EventBusEvents } from './formDataViewerEmitter';
import mitt, { Emitter } from "mitt";
import i18next from 'i18next';
import { dataManagerWarnReminderStore } from '@renderer/utils';
import { useResizeObserver, useScroll } from '@vueuse/core';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { useRoute, useRouter } from 'vue-router';
import { resolvePreferredFormDataViewerTabUid } from './formDataViewerViewSelection';

import draggable from "vuedraggable";
import { CaretLeft, CaretRight } from '@element-plus/icons-vue'

const SubmitFormLayer = defineAsyncComponent(() => import('./SubmitFormLayer.vue'));
const DataManagementV2 = defineAsyncComponent(() => import('../../editor/form/DataManagementV2.vue'));
const DocumentView = defineAsyncComponent(() => import('./DocumentView.vue'));
const CategoryView = defineAsyncComponent(() => import('./CategoryView.vue'));
const AlbumView = defineAsyncComponent(() => import('../../editor/form/AlbumView.vue'));
const CatalogSettingDialog = defineAsyncComponent(() => import('../dialog/CatalogSettingDialog.vue'));
const ViewDrawer = defineAsyncComponent(() => import('../dialog/components/ViewDrawer.vue'));
const ViewRenameDialog = defineAsyncComponent(() => import('../dialog/ViewRenameDialog.vue'));

const emit = defineEmits<{
  (event: "draft-saved")
  (event: "submitted")
  (event: "changeRows")
}>();

const formDataViewerEmitter: Emitter<EventBusEvents> = mitt<EventBusEvents>();

const nocode: Ref<Nocode> = inject(NOCODE);
const activeTab = ref('');
const dialogState = useDialogStore();
const viewListVisible = ref<boolean>(false);
const location = ref<Location>();
const addViewButtonRef = shallowRef<HTMLElement | null>(null);
const dataViewListRef = shallowRef<HTMLElement | null>(null);
const moreButtonRef = ref(null)
type ViewRenameDialogInstance = { show: (name: string) => void };
type ViewSettingDrawerInstance = { show: () => void; hide: () => void };

const viewRenameDialogRef = ref<ViewRenameDialogInstance | null>(null)
const viewRenameDialogMounted = ref(false);
const pendingViewRenameName = ref<string | null>(null);
const organizeUtil = new OrganizeUtil()
provide(ORGANIZE_UTIL, organizeUtil)

const viewSettingDrawerRef = ref<ViewSettingDrawerInstance | null>(null)
const pendingViewSettingDrawerOpen = ref(false);
const viewSettingDrawerSlotRef = ref<HTMLElement>(null)
const viewSettingDrawerCloseGuard = ref<null | (() => Promise<boolean>)>(null)
const viewSettingDrawerPanelState = ref({
  visible: false,
  activeMenu: null as string | null,
  actionDetailVisible: false,
})
provide(VIEW_ACTIVE_UID, activeTab)
provide(FORM_DATA_VIEWER_EMITTER, formDataViewerEmitter)
provide(VIEW_SETTING_DRAWER_REF, viewSettingDrawerRef)
provide(VIEW_SETTING_DRAWER_SLOT, viewSettingDrawerSlotRef)
provide(VIEW_SETTING_DRAWER_CLOSE_GUARD, viewSettingDrawerCloseGuard)
provide(VIEW_SETTING_DRAWER_PANEL_STATE, viewSettingDrawerPanelState)

const scrollbarRef = ref<ScrollbarInstance>();
const tabsWrapperRef = ref<HTMLDivElement>();
const viewDownRef = ref(null)
const scrollLeft = ref(0);
const scrollWidth = ref(0);
const clientWidth = ref(0);
const hasScrollbar = ref(false);
const visible = ref(false);
let hideTimer: number | null = null;
const showLeftButton = computed(() => hasScrollbar.value && (scrollLeft.value > 0));
const EPS = 2;
const showRightButton = computed(() => {
  return (
    hasScrollbar.value &&
    scrollLeft.value + clientWidth.value < scrollWidth.value - EPS
  );
});
const showTableViews = computed(() => {
  return getVisibleViewsForCurrentAccount({
    views: nocode.value?.body?.views?.[props.tableId],
    tableId: props.tableId,
    permissions: nocode.value?.body?.permissions?.view,
    account: passportState.account,
    departments: organizeUtil.departments,
  });
})

const viewSettingDrawerVisible = ref(false);
const viewSettingDrawerMounted = ref(false);
const VIEW_SETTING_DRAWER_DEFAULT_WIDTH = "320px";
const VIEW_SETTING_DRAWER_ACTION_WIDTH = "900px";
const isViewSettingDrawerAvailable = computed(() => !isMobile());
const viewSettingDrawerWidth = computed(() => {
  if (
    viewSettingDrawerPanelState.value.activeMenu === "action"
    && viewSettingDrawerPanelState.value.actionDetailVisible
  ) {
    return VIEW_SETTING_DRAWER_ACTION_WIDTH;
  }
  return VIEW_SETTING_DRAWER_DEFAULT_WIDTH;
});
const viewSettingDrawerHandleOtherClose = async () => {
  const allowClose = await (viewSettingDrawerCloseGuard.value?.() ?? Promise.resolve(true));
  if (!allowClose) return;
  formDataViewerEmitter.emit(Events.DRAWER_OTHERCLOSE);
  viewSettingDrawerRef.value?.hide();
}
const handleCloseViewSettingDrawer = () => {
  viewSettingDrawerVisible.value = false;
  viewSettingDrawerPanelState.value.visible = false;
  viewSettingDrawerPanelState.value.activeMenu = null;
  viewSettingDrawerPanelState.value.actionDetailVisible = false;
}
const viewSettingDrawerOpen = () => {
  formDataViewerEmitter.emit(Events.DRAWER_OPEN);
  viewSettingDrawerVisible.value = true;
  viewSettingDrawerPanelState.value.visible = true;
}
onMounted(async () => {
  await organizeUtil.getDepartments();

  window.setTimeout(updateScrollInfo, 100);
})
const warnReminderDisplay = ref(!dataManagerWarnReminderStore.get());
const closeWarnReminder = () => {
  dataManagerWarnReminderStore.set(true);
  warnReminderDisplay.value = false;
}
const isEmptyViews = computed(() => {
  return isEmpty(showTableViews.value);
})

const passportState = usePassportStore();
const route = useRoute();
const router = useRouter();
const getAppPermissions = (type: keyof Permission) => {
  const account = passportState.account;
  if (isEmpty(account)) {
    return false;
  }
  if(account.isAdmin || passportState.isMainAccount) {
    return true
  }

  const nocodeBody = nocode.value.body

  if(isEmpty(nocodeBody?.permissions?.application)) {
    return true
  }

  function hasPermission(permission) {
    if (!account.departments) return;
    const allDepartments = organizeUtil.departments
    const departmentMap = new Map(allDepartments.map(dep => [dep.id, dep.parent]));
    let departments: string[] = [];
    const roles = account.roles;
    for (const depId of account.departments) {
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
      if (!account.roles) return;
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
const canManagePermissionSetting = computed(() => !!passportState.account?.isAdmin);

const openViewPermissionSetting = () => {
  if (!canManagePermissionSetting.value) {
    return;
  }
  const nocodeId = nocode.value?.meta?.id;
  if (!nocodeId) {
    return;
  }
  router.push({
    path: `/app/${nocodeId}/setting`,
    query: {
      tab: SettingTab.VIEW,
    },
  });
}

const formData = computed(() => {
  return nocode?.value?.body?.formData;
});

const table = computed(() => {
  return formData.value?.tables?.find(t => t.uid === props.tableId);
})

provideFormData(formData);
provideFormTable(table);

const dataViewList = ref([
  {
    name: 'form',
    get alias() { return i18next.t('FormDataViewer.formView') },
  }, 
  {
    name: 'table',
    get alias() { return i18next.t('FormDataViewer.dataTableView') },
  },
  {
    name: 'document',
    get alias() { return i18next.t('FormDataViewer.docView') },
  },
  {
    name: 'category',
    get alias() { return i18next.t('FormDataViewer.categoryView') }
  },
  {
    name: 'album',
    get alias() { return i18next.t('FormDataViewer.albumView') },
  },
]);
const dataViewMenu = computed(() => dataViewList.value);
type GuardableDocumentView = {
  canLeaveView?: (showMessage?: boolean) => boolean | Promise<boolean>,
};
type RefreshableDataManagementView = {
  refreshData?: () => void | Promise<void>,
};
const documentViewRefs = new Map<string, GuardableDocumentView>();
const dataManagementRefs = new Map<string, RefreshableDataManagementView>();

const props = defineProps<{
  tableId: string,
}>();

const setDocumentViewRef = (uid: string, instance: GuardableDocumentView | null) => {
  if (instance) {
    if (documentViewRefs.get(uid) === instance) return;
    documentViewRefs.set(uid, instance);
  } else {
    documentViewRefs.delete(uid);
  }
};
const isCatalogView = (view: any): view is CatalogViewSetting => {
  return Boolean(view && (view.type === 'document' || view.type === 'category') && view.catalogFieldUID);
};
const setDataManagementRef = (
  uid: string,
  instance: Element | ComponentPublicInstance | RefreshableDataManagementView | null,
) => {
  if (instance && typeof instance === "object" && "refreshData" in instance) {
    if (dataManagementRefs.get(uid) === instance) return;
    dataManagementRefs.set(uid, instance as RefreshableDataManagementView);
  } else {
    dataManagementRefs.delete(uid);
  }
};

const shouldMountView = (uid: string) => {
  return activeTab.value === uid;
};

const canLeaveActiveView = async (showMessage = true) => {
  const activeView = showTableViews.value?.find(view => view.uid === activeTab.value);
  if (activeView?.type !== 'document') {
    return true;
  }
  return await documentViewRefs.get(activeTab.value)?.canLeaveView?.(showMessage) ?? true;
};
const refreshActiveDataView = async () => {
  const activeView = showTableViews.value?.find(view => view.uid === activeTab.value);
  if (activeView?.type !== 'table') {
    return;
  }
  await dataManagementRefs.get(activeTab.value)?.refreshData?.();
};
const handleFormSubmitted = async () => {
  await refreshActiveDataView();
  emit('submitted');
};

const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null)

const saveTabData = async () => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return;
  const res = await axios.post("/project/save-nocode-toc", {
    nocodeId: toRaw(nocode.value.meta.id),
    tableId: props.tableId,
    data: nocode.value.body.views[props.tableId],
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
  })
  .catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return;
    ElMessage.error(error.message);
  });
}

const getViewDefaultName = (type?: string) => {
  if (type === 'form') return i18next.t('FormDataViewer.formView');
  if (type === 'table') return i18next.t('FormDataViewer.dataTableView');
  if (type === 'document') return i18next.t('FormDataViewer.docView');
  if (type === 'category') return i18next.t('FormDataViewer.categoryView');
  if (type === 'album') return i18next.t('FormDataViewer.albumView');
  return i18next.t('FormDataViewer.dataTableView');
}

const getViewDisplayName = (view?: { name?: string; type?: string }) => {
  const name = (view?.name || '').trim();
  return name || getViewDefaultName(view?.type);
}

const initViewData = () => {
  if(!nocode.value.body.views) {
    nocode.value.body.views = {}
  }
  if (!(props.tableId in nocode.value.body.views)) {
    nocode.value.body.views[props.tableId] = [
      {
        uid: unique(),
        name: i18next.t('FormDataViewer.form'),
        type: "form"
      },
      {
        uid: unique(),
        name: i18next.t('FormDataViewer.dataTable'),
        type: "table"
      },
    ]
    saveTabData()
  }
}
initViewData()

watch(() => props.tableId, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    documentViewRefs.clear();
    dataManagementRefs.clear();
    activeTab.value = '';
  }
  initViewData()
});

watch(
  [activeTab, () => (showTableViews.value ?? []).map(view => view.uid).join(',')],
  ([uid]) => {
    const views = showTableViews.value ?? [];
    if (!views.length) {
      if (activeTab.value) {
        activeTab.value = '';
      }
      return;
    }

    const nextUid = resolvePreferredFormDataViewerTabUid({
      views,
      currentUid: uid,
      query: route.query as Record<string, string | string[] | null | undefined>,
    });
    if (nextUid !== activeTab.value) {
      activeTab.value = nextUid;
      return;
    }

  },
  { immediate: true },
);

const switchTabInternal = (uid: string) => {
  activeTab.value = uid;
  nextTick(() => {
    const activeTabElement = scrollbarRef.value?.wrapRef?.querySelector('.vn-stack-tab.active') as HTMLElement | null;
    if (!(scrollbarRef.value?.wrapRef instanceof HTMLElement) || !(activeTabElement instanceof HTMLElement)) {
      return;
    }
    const distance = getChildOutParentDistance(scrollbarRef.value.wrapRef, activeTabElement);
    const moveDistance = 32 + distance.distance;
    if (distance.status === "outLeft") {
      scrollTab(-moveDistance);
    }
    if (distance.status === "outRight") {
      scrollTab(moveDistance);
    }
  });
};

const requestSwitchTab = async (uid: string) => {
  if (!uid || uid === activeTab.value) {
    return true;
  }
  const allowLeave = await canLeaveActiveView(true);
  if (!allowLeave) {
    return false;
  }
  switchTabInternal(uid);
  return true;
};

const handleBeforeLeaveTab = async (uid: string) => {
  if (!uid || uid === activeTab.value) {
    return true;
  }
  return await canLeaveActiveView(true);
};

type Location = {
  '--left': string,
  '--top': string
}

function showViewList(): void {
  // 获取add-view-button元素的位置
  const l = addViewButtonRef.value.getBoundingClientRect();
  const viewportWidth = window.innerWidth
  if (viewportWidth - l.left < 200) {
    location.value = {
      '--left': `${l.left - 170 - 300}px`,
      '--top': `${l.top - 32}px`
    }
  } else {
    location.value = {
      '--left': `${l.left - 300}px`,
      '--top': `${l.top - 32}px`
    }
  }
  viewListVisible.value = true;
  nextTick(() => {
    dataViewListRef.value.focus();
  })
}
const switchTab = (uid: string) => {
  viewDownRef.value?.handleClose()
  void requestSwitchTab(uid)
}
/**
 * 计算子元素超出父元素左侧/右侧的距离
 * @param {HTMLElement} parentEl 父DOM元素
 * @param {HTMLElement} childEl 子DOM元素
 * @returns {Object} 包含超出状态和对应距离的结果
 */
const getChildOutParentDistance = (parentEl, childEl) => {
  // 校验传入的元素是否有效
  if (!(parentEl instanceof HTMLElement) || !(childEl instanceof HTMLElement)) {
    console.error("传入的参数必须是有效的DOM元素");
    return { status: "error", distance: 0 };
  }

  // 获取父子元素的边界信息（相对于视口的布局数据）
  const parentRect = parentEl.getBoundingClientRect();
  const childRect = childEl.getBoundingClientRect();

  // 关键边界值提取
  const parentLeft = parentRect.left; // 父元素左侧边界横坐标
  const parentRight = parentRect.right; // 父元素右侧边界横坐标
  const childLeft = childRect.left; // 子元素左侧边界横坐标
  const childRight = childRect.right; // 子元素右侧边界横坐标


  if (childLeft <= parentLeft) {
    // 子元素完全在父元素左侧之外
    return {
      status: "outLeft", // 状态：超出左侧
      distance: parentLeft - childLeft // 子左边 到 父左边的距离（正数）
    };
  } else if (childRight >= parentRight) {
    // 子元素完全在父元素右侧之外
    return {
      status: "outRight", // 状态：超出右侧
      distance: childRight - parentRight // 子右边 到 父右边的距离（正数）
    };
  } else {
    // 子元素部分在父元素内，或完全在父元素内
    return {
      status: "inRange", // 状态：在范围内
      distance: 0 // 无超出距离
    };
  }
}

const getDefaultOption = (item) => {
  if (item.name === 'album') return DefautAlbumStateOption

  return {}
}
const handleAddTab = (item) => {
  if(item.name === 'document' || item.name === 'category'){
    catalogSettingDialogShow(item.name);
  } else {
    const defaultOption = getDefaultOption(item)
    nocode.value.body.views[props.tableId].push({
      uid: unique(),
      name: getAutoName('new',item.alias),
      type: item.name,
      ...defaultOption,
    })
    saveTabData()
  }
  viewListVisible.value = false;
  nextTick(() => {
    updateScrollInfo()
  })
}

const flushPendingViewSettingDrawerOpen = () => {
  if (!pendingViewSettingDrawerOpen.value || !viewSettingDrawerRef.value) return;
  pendingViewSettingDrawerOpen.value = false;
  viewSettingDrawerRef.value.show();
};
watch(viewSettingDrawerRef, flushPendingViewSettingDrawerOpen);

const showSettingDrawer = () => {
  if (!isViewSettingDrawerAvailable.value) return;
  pendingViewSettingDrawerOpen.value = true;
  viewSettingDrawerMounted.value = true;
  viewSettingDrawerVisible.value = true;
  nextTick(flushPendingViewSettingDrawerOpen);
}

const deleteTab = async (uid) => {
  if (uid === activeTab.value) {
    const allowLeave = await canLeaveActiveView(true);
    if (!allowLeave) {
      return;
    }
  }
  const oldId = activeTab.value
  nocode.value.body.views[props.tableId] = nocode.value.body.views[props.tableId].filter(item => item.uid != uid)
  if(uid === activeTab.value && !isEmpty(nocode.value.body.views[props.tableId])) {
    setTimeout(() => {
      activeTab.value = nocode.value.body.views[props.tableId][0].uid
    }, 1)
  } else if(uid != activeTab.value) {
    setTimeout(() => {
      activeTab.value = oldId
    }, 1)
  }
  saveTabData();
  nextTick(() => {
    updateScrollInfo()
  })
}
const savaCatalogSetting = ref<Function>();
const catalogSettingDialogShow = (type) => {
  savaCatalogSetting.value = async (viewSetting: CatalogViewSetting) => {
    nocode.value.body.views[props.tableId].push({ ...viewSetting });
    await saveTabData()
    dialogState.hide('catalogSettingDialogVisible');
  }
  dialogState.show('catalogSettingDialogVisible', type);
}

const flushPendingViewRename = () => {
  if (pendingViewRenameName.value === null || !viewRenameDialogRef.value) return;
  const name = pendingViewRenameName.value;
  pendingViewRenameName.value = null;
  viewRenameDialogRef.value.show(name);
};
watch(viewRenameDialogRef, flushPendingViewRename);

const openRenameDialog = (item) => {
  pendingViewRenameName.value = getViewDisplayName(item);
  viewRenameDialogMounted.value = true;
  nextTick(flushPendingViewRename);
}

const handleRename = (name) => {
  nocode.value.body.views[props.tableId].forEach(item => {
    if(item.uid === activeTab.value) {
      const nextName = (name || '').trim() || getViewDefaultName(item.type);
      if(nextName === item.name) {
        return
      }
      item.name = nextName
      ElMessage.success(i18next.t('FormDataViewer.renameSuccess'))
    }
  })
  saveTabData()
  nextTick(() => {
    updateScrollInfo()
  })
}

const createCopiedViewActionId = () => `operation_${unique(8)}`

const handleCopyView = (item) => {
  const views = nocode.value.body.views[props.tableId]
  const index = views.findIndex(view => view.uid === item.uid)
  if (index !== -1) {
    const copy = {
      ...cloneDeep(item),
      uid: unique(),
      name: getAutoName('copy', getViewDisplayName(item)),
    }
    const { actions, permissionCopySources } = cloneViewActionsForCopy({
      actions: copy.actions,
      createActionId: createCopiedViewActionId,
    })
    copy.actions = actions
    const nextOperationPermissions = buildOperationPermissionsForActionCopies({
      operationPermissions: nocode.value.body.permissions?.operation,
      tableId: props.tableId,
      permissionCopySources,
    })
    if (nextOperationPermissions) {
      nocode.value.body.permissions.operation = nextOperationPermissions
    }
    views.splice(index + 1, 0, copy) // 插入到当前项后面
  }
  saveTabData()
}

defineExpose({
  canLeaveView: canLeaveActiveView,
  refreshActiveDataView,
});

const getAutoName = (type, name) => {
  const existingNames = nocode.value.body.views[props.tableId].map(v => v.name)
  if (type === 'copy') {
    let baseName = name + i18next.t('FormDataViewer.copy');
    let newName = baseName;
    let counter = 1;

    while (existingNames.includes(newName+')')) {
      newName = `${baseName}${counter}`;
      counter++;
    }

    return newName +')';
  } else if (type === 'new') {
    let baseName = name;
    let newName = baseName;
    let counter = 1;

    while (existingNames.includes(newName)) {
      newName = `${baseName}${counter}`;
      counter++;
    }

    return newName;
  } else {
    return name; // 默认返回原名
  }
}
provideRuntime(FormTableRuntime.FORM_VIEWER);

let timer: number | null = null;
const onScroll = (ev: { scrollLeft: number }) => {
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(() => {
    scrollLeft.value = ev.scrollLeft;
  }, 100)
}

const scrollTab = (delta: number) => {
  if (!scrollbarRef.value) return;
  const left = scrollbarRef.value.wrapRef?.scrollLeft || 0;
  scrollbarRef.value.scrollTo({
    left: left + delta,
    behavior: "smooth",
  });
};

const updateScrollInfo = () => {
  if (scrollbarRef.value?.wrapRef) {
    scrollWidth.value = scrollbarRef.value.wrapRef.scrollWidth;
    clientWidth.value = scrollbarRef.value.wrapRef.clientWidth;
    scrollLeft.value = scrollbarRef.value.wrapRef.scrollLeft;
    hasScrollbar.value = scrollWidth.value > clientWidth.value;
  }
};
const draggableRef = ref(null);
const isDragging = ref(false);
const handleDragStart = (evt) => {
  const item = evt.item as HTMLElement;
  item.classList.add('pre-drag-hide');
  isDragging.value = true
};
const handleDragEnd = ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
  draggableRef.value?.targetDomElement
    .querySelectorAll('.pre-drag-hide')
    .forEach(el => el.classList.remove('pre-drag-hide'));

  if (oldIndex === newIndex) return;

  const views = nocode.value.body.views[props.tableId];
  if (!views) return;

  const movedItem = views.splice(oldIndex, 1)[0];
  views.splice(newIndex, 0, movedItem);

  isDragging.value = false;
};

useResizeObserver(tabsWrapperRef, updateScrollInfo)

const onChangeMenuVisible = (v) => {
  if (!v) visible.value = false;
}

const onEnterViewDrager = () => {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  visible.value = true
}

const onLeaveViewDrager = () => {
  hideTimer = window.setTimeout(() => {
    visible.value = false
  }, 600);
}

const hideViewSorter = () => {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  visible.value = false
}

onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  pendingViewRenameName.value = null
  pendingViewSettingDrawerOpen.value = false
  documentViewRefs.clear()
  dataManagementRefs.clear()
  formDataViewerEmitter.all.clear()
})
</script>

<style lang='scss' scoped>
.form-data-viewer {
  height: calc(100% - 52px);
  padding: 16px;
  position: relative;
  background-color: rgb(242, 243, 245);
  --header-button-width: 48px;
  --header-button-height: 32px;

  .container {
    background-color: var(--bg-color-page);
    height: 100%;

    .el-header {
      display: flex;
      height: 32px;
      background-color: var(--bg-color-overlay);
      padding: 0;

      .view-list-wrapper {
        flex: 1;
        min-width: 0;
        height: 100%;
        display: flex;
        align-items: center;
        position: relative;
        width: 100%;
        .el-scrollbar {
          max-width: calc(100% - calc(var(--header-button-width) * 3));
        }
        .scroll-button-overlay {
          aspect-ratio: 1 / 1;
          height: calc(var(--header-button-height) + 2px);
          position: absolute;
          top: -1px;
          z-index: 99;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-color-overlay);

          .scroll-button {
            width: 24px;
            height: 24px;
            outline: none;
            border-radius: 4px;

            &:hover {
              background-color: var(--bg-color-hover);
              color: var(--text-color-regular);
            }

            .el-icon {
              margin: 0 3px;
              cursor: var(--cursor-pointer);

              &.disabled {
                color: var(--text-color-disabled);
                cursor: not-allowed;
              }
            }
          }

          &.left {
            left: -1px;
            box-shadow: 4px 0px 8px rgba(0, 0, 0, 0.08);
            clip-path: inset(1px -20px 1px 1px);
          }
    
          &.right {
            right: -1px;
            box-shadow: -4px 0px 8px rgba(0, 0, 0, 0.08);
            clip-path: inset(1px 1px 1px -20px);
          }
        }

        .el-scrollbar {
    
          :deep(.el-scrollbar__bar) {
            display: none !important;
          }
        }
      }

      .tab-container {
        display: flex;
        width: fit-content;
        background-color: var(--el-bg-color);
      }

      .tab {
        padding: 4px 16px;
        cursor: pointer;
        border-radius: 4px 6px 0 0;
        column-gap: 8px;
        font-size: 14px;
        transition: all 0.3s ease;
        position: relative;

        &:hover {
          .tab-context {
            background-color: var(--color-white);
          }
        }

        &.active {
          background-color: var(--bg-color-page);

          .el-icon {
            color: var(--color-primary);
          }
        }

        .tab-context {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 24px;
          padding-left: 8px;
          padding-right: 4px;
          border-radius: 4px;
          transition: all 0.3s ease;
          width: auto;

          span {
            margin-right: 4px;
            text-wrap: nowrap;
          }

          .tab-name {
            display: inline-block;
            max-width: 154px;
            line-height: 24px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .more-btn {
            visibility: hidden;
            width: 16px;
            height: 16px;
            transform: rotate(90deg);
            color: var(--text-color-placeholder);
            font-size: 12px;
            margin-right: 4px;
            transition: all 0.3s ease;
            border-radius: 4px;
            cursor: pointer;
            &:hover {
              background-color: #F5F6F7;
            }
          }
        }

        .el-icon {
          margin-right: 8px;
        }
      }

      .view-header-button {
        position: relative;
        width: var(--header-button-width);
        height: var(--header-button-height);
        align-self: center;
        font-size: 14px;
        color: var(--text-color-regular);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          background-color: var(--bg-color-hover);
        }
      }
      .add-tab {
        background-color: var(--color-white);
        height: 32px;
        border-radius: 4px 4px 0 0;
        padding: 0px 24px 0px 20px;
        display: flex;
        align-items: center;

        .el-icon {
          font-size: 16px;
          padding-top: 2px;
          color: var(--color-primary);
          transition: all 0.3s ease;
          width: 24px;
          height: 24px;
          cursor: pointer;
          border-radius: 4px;

          &:hover {
            background-color: var(--bg-color-overlay);
            color: var(--text-color-regular);
          }

        }

        span {
          
          font-weight: 400;
          
          font-size: 14px;
          line-height: 20px;
          letter-spacing: 0%;
          margin-left: 4px;
        }
      }

      // 排除.active元素、其前一位的兄弟元素
      .isEditor:not(:has(+ .active), .active)::before {
        content: "";
        display: inline-block;
        width: 1px;
        height: 12px;
        background-color: var(--text-color-placeholder);
        position: absolute;
        right: 0px;
      }

      .notEditor:not(:has(+ .active), .active, :last-of-type)::before {
        content: "";
        display: inline-block;
        width: 1px;
        height: 12px;
        background-color: var(--text-color-placeholder);
        position: absolute;
        right: 0px;
      }

      .tab:first-child:not(.active)::after {
        content: "";
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 1px;
        height: 12px;
        background-color: var(--text-color-placeholder);
      }
    }

    .content {
      height: calc(100% - 32px);

      .vn-stack-layer {
        height: 100%;
      }

      .empty-box {
        display: flex;
        height: 100%;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        
        font-weight: 400;
        
        font-size: 12px;
        line-height: 150%;
        letter-spacing: 0%;
        color: var(--text-color-secondary);

        img {
          height: 90px;
          margin-bottom: 10px;
        }
      }
      --warn-reminder-height: 60px;
      .warm-reminder {
        padding: 16px 16px 0 16px;
        box-sizing: border-box;
        height: var(--warn-reminder-height);
        .warm-reminder-container {
          width: 100%;
          height: 46px;
          padding: 0 8px;
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: #FFFBE8;
          .text {
            font-size: 14px;
            color: #CF870C;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
      .has-warn-reminder-data-management-height {
        height: calc(100% - var(--warn-reminder-height));
      }
    }

    .data-view-list {
      position: absolute;
      left: var(--left);
      top: var(--top);
      background-color: var(--bg-color-page);
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      box-shadow: 0px 6px 16px 0px rgba(0, 0, 0, 0.08);
      outline: 0;
      z-index: 10;

      .data-view-item {
        padding: 8px 12px;
        min-width: 196px;
        cursor: pointer;
        display: flex;
        align-items: center;
        
        font-weight: 400;
        
        font-size: 14px;
        color: var(--text-color-regular);
        line-height: 20px;
        letter-spacing: 0%;
        transition: all 0.3s ease;

        .el-icon {
          padding-top: 1px;
          margin-right: 8px;
        }

        &:hover {
          background-color: var(--bg-color-hover);
        }
      }
    }
  }
  .view-settting-drawer-slot {
    height: 100%;
  }
}
</style>

<style lang="scss">
.el-popper.form-data-viewer-more-popover {
  background-color: #fff;
  padding: 0px;
  border-radius: 4px;
  overflow: hidden;

  .more-menu {
    ul {
      li {
        height: 36px;
        display: flex;
        align-items: center;
        padding-left: 12px;
        transition: all 0.3s ease ;
        cursor: pointer;

        .el-icon {
          color: var(--text-color-regular) !important;
          padding-bottom: 2px;
          margin-right: 8px;
        }

        &:hover {
          background-color: var(--bg-color-overlay);
        }

        &.delete {
          color: var(--color-danger);

          .el-icon {
            color: var(--color-danger) !important;
          }
        }
      }
    }
  }
}

.viewer-sort-popover {
  border: none !important;
  user-select: none;

  .el-scrollbar {
    --el-scrollbar-bg-color: var(--el-bg-color-page) !important;
    border-radius: 8px;
  }

  .el-dropdown-menu {
    padding: 4px;
    background-color: var(--el-bg-color-page);
    max-height: 400px;
    overflow-y: auto;

    &:not(.is-dragging){
      .view-drag-item {
          &:hover {
          background-color: var(--bg-color-overlay);
        }
      }
    }
    max-height: 400px;
    overflow-y: auto;
  }

  .view-drag-item {
    overflow: visible;
    height: 36px;
    width: 232px;
    padding: 0 8px 0 12px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 16px;
    justify-content: space-between;

    .view-describe {
      display: flex;
      gap: 8px;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      vertical-align: middle;
    }
  }

  .tabs-content {
    >.dragging.sortable-ghost {
      visibility: hidden;
      opacity: 1;
    }

    > :not(.dragging) {
      .el-input__wrapper {
        &:hover .el-input__prefix {
          opacity: v-bind("isDragging ? 0 : 1");
        }
      }
    }

    .move {
      cursor: move;
    }
  }
}

.viewer-manage-popover {
  border: none !important;
  overflow: visible;

  .view-arrow-down-drag-item {
    display: flex;
    align-items: center;
  }
  .el-dropdown-item-active {
    background-color: var(--bg-color-overlay);
  }
  .el-scrollbar {
    --el-scrollbar-bg-color: var(--el-bg-color-page) !important;
    border-radius: 8px;
    overflow: visible;

    .el-scrollbar__wrap  {
      overflow: visible;
    }
  }

  .el-dropdown-menu {
    background-color: var(--el-bg-color-page);
    padding: 4px;
    border-radius: 8px;

    .el-dropdown-menu__item {
      width: 172px;
      height: 36px;
      line-height: 32px;
      margin-bottom: 0;
      border-radius: 4px;
      padding: 0 8px 0 12px;
      font-size: 14px;

      .el-tooltip__trigger {
      padding: 0 !important;
    }

      .drop-menu-describe {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      &:last-child {
        margin-bottom: 0;
      }

      &.is-hovering,
      &:hover,
      &:focus {
        color: var(--text-color-regular);
        background-color: var(--bg-color-overlay);
      }
    }
  }
}
</style>
