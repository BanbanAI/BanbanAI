<template>
  <el-scrollbar
    ref="workbenchScrollbarRef"
    class="workbench-home-main-scrollbar"
    height="100%"
    :tabindex="0"
  >
    <div class="workbench-home-main">
      <div class="approval-container">
        <div class="approval-header">
          <div class="header-left">
            <el-icon color="var(--color-primary)" :size="20"><i-workbench-pending-approval /></el-icon>
            <div class="approval-header-text">{{ $t("WorkbenchHomeMain.pendingApproval") }}</div>
          </div>
        </div>
        <div class="approval-body">
          <div class="approval-body-left">
            <div class="approval-body-left-left" @click.stop="handleGoToTodo(allTodoCountTempData.category)">
              <div class="todo-item-count">{{ allTodoCountTempData.count }}</div>
              <div class="todo-item-label">{{ allTodoCountTempData.label }}</div>
            </div>
            <div class="approval-body-left-right">
              <template v-for="(item, index) in todoSubCategories" :key="item.label">
                <div class="line" v-if="index !== 0"></div>
                <div class="todo-item" @click.stop="handleGoToTodo(TodoCategory.MY_TODO, item.category)">
                    <div class="todo-item-text">
                      <div class="todo-item-label">
                        <el-icon :size="16"><i-workbench-time-out /></el-icon>
                        {{ item.label }}
                      </div>
                      <div class="todo-item-count">{{ item.count }}</div>
                    </div>
                </div>
              </template>
            </div>
          </div>
          <div class="approval-body-right">
            <div v-for="item in approvalList" :key="item.icon" class="approval-item" @click.stop="handleGoToTodo(item.category)">
              <div class="approval-item-left">
                <component v-if="item.category === TodoCategory.INITIATE_PROCESS" color="#fab01a" :is="item.icon"></component>
                <component v-else color="var(--color-primary)" :is="item.icon"></component>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="manage-container">
        <div class="manage-header">
          <div class="manage-header-left">
            <el-icon color="var(--color-primary)" :size="20"><i-workbench-my-application /></el-icon>
            <div class="manage-header-text">{{ $t("WorkbenchHomeMain.myApp") }}</div>
          </div>
        </div>
        <div class="manage-body-container">
          <div class="manage-body-header">
            <div class="manage-body-header-left">
              <el-input v-model="searchValue" :placeholder="$t('WorkbenchHomeMain.searchApp')" clearable class="search-input">
                <template #prefix>
                  <el-icon><i-workbench-search /></el-icon>
                </template>
              </el-input>
            </div>
            <div class="manage-body-header-right">
              <el-icon :title="$t('WorkbenchHomeMain.recycleBin')" :size="16" @click="handleRecycle" v-if="passportState.account.isAdmin"><i-workbench-recycle /></el-icon>
              <el-icon :title="$t('WorkbenchHomeMain.importApp')" :size="16" @click="handleImport" v-if="passportState.account.isAdmin"><i-workbench-import  /></el-icon>
              <el-icon :title="$t('WorkbenchHomeMain.groupSetting')" :size="16" @click="handleGroupManagement" v-if="passportState.account.isAdmin"><i-workbench-add-folder /></el-icon>
              <el-button class="add-button" @click="openProjectCreationDialog" type="primary" v-if="passportState.account.isAdmin">
                <el-icon :size="16" color="var(--color-white)"><i-workbench-add /></el-icon>
                <span class="add-text">{{ $t('WorkbenchHomeMain.createApp') }}</span>
              </el-button>
            </div>
          </div>
          <div class="manage-body" v-if="!isLoading && isShowNocodes">
            <template v-for="group in renderedGroupStructure" :key="group.id">
              <div class="nocode-group" v-if="group.nocodes.length > 0">
                <div class="group-title" v-if="hasGroup">
                  <div class="group-title-line"></div>
                  {{ group.name }}
                </div>
                <div class="group-body">
                  <workbench-nocode-box 
                    :ref="(el) => nocodeBoxRefs[nocode.id] = el" 
                    v-for="nocode in group.nocodes" 
                    :key="nocode.id"
                    :nocode="nocode"
                    :snapshot="nocodeSnapshots[nocode.id]"
                    :cover="nocodeCovers[nocode.id]"
                    :warmupSummary="resolveNocodeWarmupSummary(nocode.id)"
                    :isEditable="permissionsMap[nocode.id]?.editable || false"
                    :isDeletable="permissionsMap[nocode.id]?.deletable || false"
                    :canCopy="!!passportState.account?.isAdmin"
                    :canSaveAs="!!passportState.account?.isAdmin"
                    :isExpired="isNocodeImportExpired(nocode)"
                    :isBroken="isBrokenNocode(nocode.id)"
                    :canManageImportExpireAt="permissionsMap[nocode.id]?.canManageImportExpireAt || false"
                    :menuDisabled="isBrokenNocode(nocode.id)
                      ? !passportState.account?.isAdmin
                      : (!passportState.account?.isAdmin && !(permissionsMap[nocode.id]?.canManageImportExpireAt || false))"
                    @preview="handlePreviewNocode(nocode)"
                    @open="handleOpenNocode(nocode.id)"
                    @saveAs="handleSaveAs('nocode', nocode.id)"
                    @manage-expire-at="handleOpenNocodeExpireDialog(nocode.id)"
                    @delete="handleShowDeleteNocodeDialog(nocode)"
                    @rename="renameNocodeDialogRef?.show(nocode.id, nocode.name)"
                    @copy="handleCopyNocode(nocode.id)"
                    @replace-icon="openNocodeReplaceIconDialog(nocode)"
                  >
                  </workbench-nocode-box>
                </div>
              </div>
            </template>
          </div>
          <div class="skeleton-body" v-if="isLoading">
            <el-skeleton :animated="true" class="skeleton-group" v-for="box in 3">
              <template #template>
                <el-skeleton-item variant="text" style="width: 144px; height: 24px;"/>
                <div class="skeleton-img">
                  <div v-for="box in 6" style="flex: 1" class="skeleton-box">
                    <el-skeleton-item variant="text" style="height: 144px"/>
                    <el-icon>
                      <i-ven-skeleton-logo />
                    </el-icon>
                  </div>
                </div>
              </template>
            </el-skeleton>
          </div>
        </div>
      </div>
      <el-empty :description="passportState.account.isAdmin ? $t('WorkbenchHomeMain.noApp') : $t('WorkbenchHomeMain.noNocode')" v-if="!isLoading && !isShowNocodes">
        <template #image>
          <img src="@renderer/assets/image/workbench/empty.png" alt="" :style="{ cursor: passportState.account.isAdmin ? 'pointer': undefined }" @click.stop="openProjectCreationDialog">
        </template>
      </el-empty>
    </div>
    <nocode-creation-dialog v-model="dialogState.NocodeCreationDialogVisible"
      :parentId="parentId"
      @closed="handleCloseCreate"></nocode-creation-dialog>
    <project-recycle-dialog v-model="dialogState.recycleDialogVisible" @refresh="refreshGroupStructure"
      ></project-recycle-dialog>
    <project-import-dialog v-model="dialogState.importDialogVisible" @refresh="refreshGroupStructure"
      :args="dialogState.getArgs('importDialogVisible')" @close-dialog="handleCloseImport"></project-import-dialog>
    <project-group-dialog v-model="dialogState.groupDialogVisible" @refresh="getGroupStructure"
      ></project-group-dialog>
    <nocode-replace-img-dialog v-model="dialogState.nocodeReplaceImgDialogVisible"
      :nocode="dialogState.getArgs('nocodeReplaceImgDialogVisible')"
      @updateNocodeCoverImage="updateNocodeCoverImage"></nocode-replace-img-dialog>
    <save-as-dialog v-model="dialogState.saveAsDialogVisible"
      :args="dialogState.getArgs('saveAsDialogVisible')"></save-as-dialog>
    <copy-nocode-dialog
      v-model="copyNocodeDialogVisible"
      :nocode-id="currentCopyNocodeId"
      :parent-id="parentId"
      @success="handleCopyNocodeSuccess"
    ></copy-nocode-dialog>
    <workbench-nocode-expire-dialog v-model="nocodeExpireDialogVisible" :nocodeId="currentExpireDialogNocodeId" @updated="handleNocodeExpireUpdated"></workbench-nocode-expire-dialog>
    <nocode-rename-dialog ref="renameNocodeDialogRef" @closed="handleNocodeRenamed"></nocode-rename-dialog>
    <project-limit-dialog v-model="dialogState.projectLimitDialogVisible" ref="projectLimitDialogRef"></project-limit-dialog>
    <delete-confirm-dialog :text="$t('WorkbenchHomeMain.areYouConfirmDelete')" :tip="$t('WorkbenchHomeMain.deleteWithCaution')" v-model="deleteConfirmDialogVisible" @confirm="handleDeleteNocode" />
    <workbench-broken-app-restore-dialog
      v-model="brokenAppRestoreDialogVisible"
      :loading="restoringBrokenApp"
      @confirm="handleConfirmRestoreBrokenNocode"
    />
  </el-scrollbar>
</template>

<script setup lang='ts'>
import { NocodeCoverSummary, NocodeImportState, NocodeMeta, TodoCategory, NocodeBody, TodoSubCategory } from '@common/types/nocode';
import { useDialogStore, usePassportStore, useShareNocodeCacheStore, type ShareNocodeSummary } from '@renderer/stores';
import { GET_LIST, NOCODE_LIST, PARENT_ID, UPDATE_OPENING_PROJECT_LIST } from '@renderer/types';
import axios from 'axios';
import { ElMessage, type ScrollbarInstance } from 'element-plus';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, reactive, Ref, ref, unref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { isNocodeImportExpired, isNocodeImportReadonly } from '@common/utils';
import { unique } from '@common/utils/unique';
import { isEmpty } from '@common/utils/object';
import { formFlowApi } from '../../utils';
import i18next from 'i18next';
import { canShowWorkbenchMetaActions } from './components/workbenchNocodeBox.helper';
import { buildNocodeEditorRoute } from '../editor/editorReturnNavigation';
import { useLocalizedDocumentTitle } from '@renderer/hooks/useLocalizedDocumentTitle';
import { AI_WARMUP_ACTIVITY_REPORTER } from '../../utils/aiWarmupActivityReporter';
import { calculateNocodeRenderCapacity, sliceNocodeGroupsByLimit } from './workbenchNocodeProgressiveRender';

useLocalizedDocumentTitle(() => `${i18next.t("WorkbenchHomeMain.workbench")} - ${i18next.t("WorkbenchHomeMain.home")}`);

const router = useRouter();
const dialogState = useDialogStore();
const passportState = usePassportStore();
const shareNocodeCacheStore = useShareNocodeCacheStore();

type WorkbenchNocodeSnapshot = NocodeBody['snapshot'];
type WorkbenchNocodeSummary = ShareNocodeSummary;
type WorkbenchPermissionState = {
  editable: boolean,
  deletable: boolean,
  canManageImportExpireAt: boolean,
};
type WorkbenchAiWarmupStatus = 'missing' | 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'expired';
type WorkbenchAiWarmupPhaseState = {
  status: WorkbenchAiWarmupStatus,
  updatedAt?: number,
  durationMs?: number,
  lastError?: string,
};
type WorkbenchAiWarmupState = {
  phases?: {
    catalog?: WorkbenchAiWarmupPhaseState,
    profile?: WorkbenchAiWarmupPhaseState,
    deep?: WorkbenchAiWarmupPhaseState,
  },
  lastWarmAt?: number,
  lastError?: string,
};
type WorkbenchAiWarmupBadgeTone = 'cold' | 'base' | 'ready' | 'deep' | 'running' | 'error';
type WorkbenchAiWarmupSummary = {
  tone: WorkbenchAiWarmupBadgeTone,
  label: string,
  description: string,
  phases: {
    catalog: WorkbenchAiWarmupStatus,
    profile: WorkbenchAiWarmupStatus,
    deep: WorkbenchAiWarmupStatus,
  },
  lastWarmAt?: number,
  lastError?: string,
};
type WorkbenchAiWarmupLedgerApp = {
  appId: string,
  warmupState?: WorkbenchAiWarmupState | null,
};
type WorkbenchAiWarmupActivitySnapshot = {
  lastUserActivityAt?: number,
  lastForegroundAiActivityAt?: number,
  lastServerWriteActivityAt?: number,
  lastWarmupStartedAt?: number,
  lastWarmupCanceledAt?: number,
  lastActivityReason?: string,
  lastCancelReason?: string,
  activityEpoch?: number,
  globalIdleAgeMs?: number,
  scopedIdleAgeByAppId?: Record<string, number>,
};
type WorkbenchAiWarmupSchedulerDebugState = {
  idleEligible?: boolean,
  idleAgeMs?: number,
  requiredIdleMs?: number,
  pausedReason?: string,
  nextEligibleAt?: number,
  activityEpoch?: number,
  queueDepth?: number,
  runningTaskKey?: string,
  lastCanceledAt?: number,
  canceledCount?: number,
  skippedBecauseActiveCount?: number,
};
type WorkbenchAiWarmupLedgerBody = {
  activity?: WorkbenchAiWarmupActivitySnapshot | null,
  scheduler?: WorkbenchAiWarmupSchedulerDebugState | null,
  apps?: Record<string, WorkbenchAiWarmupLedgerApp> | null,
};
type WorkbenchAiWarmupLedgerResponse = {
  live?: WorkbenchAiWarmupLedgerBody | null,
  disk?: WorkbenchAiWarmupLedgerBody | null,
};

const allTodoCount: Ref<Record<TodoCategory, number>> = ref({} as any);
const nocodes = ref<NocodeMeta[]>([]);
const nocodeSnapshots = reactive<Record<string, WorkbenchNocodeSnapshot>>({});
const nocodeCovers = reactive<Record<string, NocodeCoverSummary | undefined>>({});
const brokenNocodeMap = reactive<Record<string, boolean>>({});
const searchValue = ref('');
const NOCODE_GRID_COLUMN_COUNT = 6;
const NOCODE_GRID_ROW_HEIGHT = 144;
const RENDER_BOTTOM_TOLERANCE_PX = 1;
const renderedNocodeCount = ref(0);
const progressiveRenderBatchSize = ref(NOCODE_GRID_COLUMN_COUNT);
const workbenchScrollbarRef = ref<ScrollbarInstance>();
let progressiveRenderScrollRoot: HTMLElement | null = null;
let progressiveRenderBatchPending = false;
let progressiveRenderResizeObserver: ResizeObserver | null = null;
const nocodeBoxRefs = ref([]);
const renameNocodeDialogRef = ref();
const projectLimitDialogRef = ref();
const nocodeExpireDialogVisible = ref(false);
const currentExpireDialogNocodeId = ref("");
const parentId = ref('');
const permissionsMap = reactive<Record<string, WorkbenchPermissionState>>({});
const brokenAppRestoreDialogVisible = ref(false);
const restoringBrokenApp = ref(false);
const pendingRestoreBrokenNocode = ref<NocodeMeta | null>(null);
const isLoading = ref(true)
const isDevelopmentMode = import.meta.env.DEV;
const WARMUP_POLL_INTERVAL_MS = 30 * 1000;
const warmupLedgerApps = ref<Record<string, WorkbenchAiWarmupLedgerApp>>({});
const hasLoadedWarmupLedger = ref(false);
const warmupFetchSequence = ref(0);
let warmupPollTimer: number | null = null;
const aiWarmupActivityReporter = inject(AI_WARMUP_ACTIVITY_REPORTER, null);

const isAiWarmupBadgeEnabled = computed(() => (
  isDevelopmentMode && Boolean(passportState.account?.isAdmin)
));

const isShowNocodes = computed(() => nocodes.value.length > 0);

const allTodoCountTempData = computed(() => {return { label: `${i18next.t("WorkbenchHomeMain.allPending")}`, count: allTodoCount.value?.[TodoCategory.MY_TODO] || 0, category: TodoCategory.MY_TODO }})
const todoSubCategories = computed(() => {
  return [
    { label: `${i18next.t("WorkbenchHomeMain.timeOut")}`, count: allTodoCount.value?.[TodoSubCategory.EXPIRED] || 0, category: TodoSubCategory.EXPIRED },
  ]
});
const approvalList = computed(() => {
  return [
    { icon: IWorkbenchInitiatedByMe, label: `${i18next.t("WorkbenchHomeMain.initiatedByMe")}`, count: allTodoCount.value?.[TodoCategory.MY_INITIATED] || 0, category: TodoCategory.MY_INITIATED },
    { icon: IWorkbenchHandledByMe, label: `${i18next.t("WorkbenchHomeMain.processedByMe")}`, count: allTodoCount.value?.[TodoCategory.MY_PROCESSED] || 0, category: TodoCategory.MY_PROCESSED },
    { icon: IWorkbenchCcToMe, label: `${i18next.t("WorkbenchHomeMain.copiedToMe")}`, count: allTodoCount.value?.[TodoCategory.CC_ME] || 0, category: TodoCategory.CC_ME },
    { icon: IWorkbenchInitiateProcess, label: `${i18next.t("WorkbenchHomeMain.startProcess")}`, count: allTodoCount.value?.[TodoCategory.INITIATE_PROCESS] || 0, category: TodoCategory.INITIATE_PROCESS },
  ]
});
const clearRecord = (record: Record<string, unknown>) => {
  Object.keys(record).forEach((key) => {
    delete record[key];
  });
}

const WARMUP_STATUS_ORDER: WorkbenchAiWarmupStatus[] = ['missing', 'queued', 'running', 'succeeded', 'failed', 'skipped', 'expired'];
const normalizeWarmupStatus = (value?: unknown): WorkbenchAiWarmupStatus => {
  const normalized = String(value || '').trim() as WorkbenchAiWarmupStatus;
  return WARMUP_STATUS_ORDER.includes(normalized) ? normalized : 'missing';
}

const normalizePositiveNumber = (value?: unknown) => {
  const normalized = Math.round(Number(value || 0));
  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
}

const resolveWarmupPhaseStatus = (
  state: WorkbenchAiWarmupState | null | undefined,
  phase: 'catalog' | 'profile' | 'deep',
): WorkbenchAiWarmupStatus => normalizeWarmupStatus(state?.phases?.[phase]?.status);

const resolveWarmupLedgerApps = (value?: WorkbenchAiWarmupLedgerBody | null) => {
  if (!value?.apps || typeof value.apps !== 'object' || Array.isArray(value.apps)) {
    return {};
  }
  return value.apps;
}

const buildWarmupSummary = (state?: WorkbenchAiWarmupState | null): WorkbenchAiWarmupSummary => {
  const phases = {
    catalog: resolveWarmupPhaseStatus(state, 'catalog'),
    profile: resolveWarmupPhaseStatus(state, 'profile'),
    deep: resolveWarmupPhaseStatus(state, 'deep'),
  };
  const statuses = Object.values(phases);
  const hasRunning = statuses.some(status => status === 'queued' || status === 'running');
  const lastWarmAt = normalizePositiveNumber(state?.lastWarmAt);
  const lastError = String(
    state?.lastError
    || state?.phases?.deep?.lastError
    || state?.phases?.profile?.lastError
    || state?.phases?.catalog?.lastError
    || '',
  ).trim() || undefined;

  if (hasRunning) {
    return {
      tone: 'running',
      label: i18next.t('WorkbenchHomeMain.aiWarmingUp'),
      description: i18next.t('WorkbenchHomeMain.aiWarmingUpDescription'),
      phases,
      lastWarmAt,
      lastError,
    };
  }

  if (phases.deep === 'succeeded') {
    return {
      tone: 'deep',
      label: i18next.t('WorkbenchHomeMain.aiDeepReady'),
      description: i18next.t('WorkbenchHomeMain.aiDeepReadyDescription'),
      phases,
      lastWarmAt,
      lastError,
    };
  }

  if (phases.profile === 'succeeded') {
    return {
      tone: 'ready',
      label: i18next.t('WorkbenchHomeMain.aiReady'),
      description: i18next.t('WorkbenchHomeMain.aiReadyDescription'),
      phases,
      lastWarmAt,
      lastError,
    };
  }

  if (phases.catalog === 'succeeded') {
    return {
      tone: 'base',
      label: i18next.t('WorkbenchHomeMain.aiBaseReady'),
      description: i18next.t('WorkbenchHomeMain.aiBaseReadyDescription'),
      phases,
      lastWarmAt,
      lastError,
    };
  }

  if (statuses.some(status => status === 'failed' || status === 'expired')) {
    return {
      tone: 'error',
      label: i18next.t('WorkbenchHomeMain.aiWarmupError'),
      description: i18next.t('WorkbenchHomeMain.aiWarmupErrorDescription'),
      phases,
      lastWarmAt,
      lastError,
    };
  }

  return {
    tone: 'cold',
    label: i18next.t('WorkbenchHomeMain.aiColdStart'),
    description: i18next.t('WorkbenchHomeMain.aiColdStartDescription'),
    phases,
    lastWarmAt,
    lastError,
  };
}

const resolveNocodeWarmupSummary = (appId: string): WorkbenchAiWarmupSummary | null => {
  if (!isAiWarmupBadgeEnabled.value || !hasLoadedWarmupLedger.value) {
    return null;
  }
  const warmupState = warmupLedgerApps.value[appId]?.warmupState;
  return buildWarmupSummary(warmupState);
}

const clearWarmupPolling = () => {
  if (warmupPollTimer !== null) {
    window.clearInterval(warmupPollTimer);
    warmupPollTimer = null;
  }
}

const clearWarmupLedgerState = () => {
  warmupLedgerApps.value = {};
  hasLoadedWarmupLedger.value = false;
}

const loadWarmupLedger = async () => {
  if (!isAiWarmupBadgeEnabled.value) {
    clearWarmupLedgerState();
    return;
  }

  const requestId = warmupFetchSequence.value + 1;
  warmupFetchSequence.value = requestId;

  try {
    const { data } = await axios.get<WorkbenchAiWarmupLedgerResponse>('/ai/debug/warmup');
    if (warmupFetchSequence.value !== requestId) {
      return;
    }
    const nextApps = {
      ...resolveWarmupLedgerApps(data?.disk),
      ...resolveWarmupLedgerApps(data?.live),
    };
    warmupLedgerApps.value = nextApps;
    hasLoadedWarmupLedger.value = true;
  } catch (error) {
    if (warmupFetchSequence.value !== requestId) {
      return;
    }
    console.debug('Load AI warmup ledger failed:', error);
  }
}

const startWarmupPolling = () => {
  clearWarmupPolling();
  if (!isAiWarmupBadgeEnabled.value) {
    clearWarmupLedgerState();
    return;
  }

  void loadWarmupLedger();
  warmupPollTimer = window.setInterval(() => {
    void loadWarmupLedger();
  }, WARMUP_POLL_INTERVAL_MS);
}

const syncNocodeSnapshots = (nocodeList: WorkbenchNocodeSummary[]) => {
  clearRecord(nocodeSnapshots);
  clearRecord(nocodeCovers);
  nocodeList.forEach((item) => {
    nocodeSnapshots[item.meta.id] = item.snapshot;
    nocodeCovers[item.meta.id] = item.cover;
  });
}

const syncBrokenNocodeState = (nocodeList: WorkbenchNocodeSummary[]) => {
  clearRecord(brokenNocodeMap);
  nocodeList.forEach((item) => {
    if (item.isBroken) {
      brokenNocodeMap[item.meta.id] = true;
    }
  });
}

const getAllCategoryTodoCount = async () => {
  allTodoCount.value = await formFlowApi.getAllCategoryTodoCount({
    "categories[0]": TodoCategory.MY_TODO,
    includeTodoPendingCategories: true,
  }) || {};
}

const getNocodes = async () => {
  const res = await shareNocodeCacheStore.getShareNocodeSummaries() as WorkbenchNocodeSummary[];
  syncNocodeSnapshots(res);
  syncBrokenNocodeState(res);
  nocodes.value = res.map((item) => item.meta);
  syncPermissions(res);
}
const groupStructure = ref();
// 有数据的分组数量
const hasGroup = ref(false)
const ungroupedApp = ref();
// 构建分组结构
const buildGroupStructure = async () => {
  await axios.get("/project/get-all-nocode-groups").then(({ data }) => {
    groupStructure.value = buildStructure(data, nocodes.value);

    // 统计 groupStructure 中 nocodes 不为空数组的元素个数
    hasGroup.value = groupStructure.value.filter(item => {
      return item.nocodes.length > 0 && !item.isUngrouped;
    }).length > 0;
  }).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return [];
  });
  isLoading.value = false;
}
function buildStructure(groups, nocodes) {
  // 1. 复制分组数组并为每个分组初始化nocodes为空数组
  const groupStructure = groups.map(group => ({
    ...group,
    nocodes: []
  }));
  // 2. 为每个分组添加对应的nocodes
  nocodes.forEach(nocode => {
    // 找到对应的分组
    const group = groupStructure.find(g => g.id === nocode.groupId);
    if (group) {
        group.nocodes.push(nocode);
    }
  });
  // 3. 收集未分组的nocodes（groupId为null或不存在对应分组）
  const ungroupedNocodes = nocodes.filter(nocode => {
    return !nocode.groupId || !groups.some(g => g.id === nocode.groupId);
  });
  // 4. 添加未分组应用项
  ungroupedApp.value = {
    id: unique(),
    name: i18next.t('WorkbenchHomeMain.ungroupedApp'),
    isUngrouped: true,
    nocodes: ungroupedNocodes
  }
  groupStructure.push(ungroupedApp.value);

  return groupStructure;
}
// 获取我的应用分组结构
const getGroupStructure = async () => {
  await getNocodes();
  await buildGroupStructure();
  if (isAiWarmupBadgeEnabled.value) {
    void loadWarmupLedger();
  }
}
const refreshGroupStructure = async (_parentId?: string) => {
  shareNocodeCacheStore.markAllDirty();
  await getGroupStructure();
}

getGroupStructure()

function handleCloseImport() {
  dialogState.hide('importDialogVisible');
}

const handleRecycle = () => {
  dialogState.show('recycleDialogVisible');
}

const handleImport = async() => {
  dialogState.show('importDialogVisible', 'nocode');
}

const handleGroupManagement = () => {
  dialogState.show('groupDialogVisible');
}

const handleNocodeRenamed = (id: string, name: string) => {
  const nocode = nocodes.value.find((f)=>f.id === id);
  if (nocode) {
    nocode.name = name;
  }
  shareNocodeCacheStore.markAllDirty();
}
const openProjectCreationDialog = () => {
  if (!passportState.account.isAdmin) return;
  dialogState.show('NocodeCreationDialogVisible');
};

const handleCloseCreate = async() => {
  dialogState.NocodeCreationDialogVisible = false;
  shareNocodeCacheStore.markAllDirty();
  await getGroupStructure();
}

const updateNocodeCoverImage = (
  nocodeId: string,
  cover?: NocodeCoverSummary,
  snapshot?: NocodeBody['snapshot'],
) => {
  nocodeSnapshots[nocodeId] = snapshot;
  nocodeCovers[nocodeId] = cover;
  shareNocodeCacheStore.patchShareNocodeSummary(nocodeId, (current) => ({
    ...current,
    snapshot,
    cover,
  }));
  shareNocodeCacheStore.markShareNocodesDirty();
  nocodeBoxRefs.value[nocodeId]?.updateCoverImage();
}

const openNocodeReplaceIconDialog = (nocode: NocodeMeta) => {
  dialogState.show('nocodeReplaceImgDialogVisible', nocode);
}

const handleSaveAs = async (type: string, id: string) => {
  dialogState.show('saveAsDialogVisible', { type, id });
  // const res = await axios.post("/project/export-nocode", {
  //   nocodeId: id,
  //   toJson: false,
  //   exportUser: false,
  // }).catch(reason => {
  //   let message = reason.response.data.message || "";
  //   if (message.indexOf("ENOSPC:") > -1) message = i18next.t("ReportSaveAs.diskSpaceTip");
  //   ElMessage.error(message);
  //   return null;
  // });
  // if (res && res.data) {
  //   doDownload(res.data);
  // }
};

const handleOpenNocodeExpireDialog = (nocodeId: string) => {
  currentExpireDialogNocodeId.value = nocodeId;
  nocodeExpireDialogVisible.value = true;
}

const handleNocodeExpireUpdated = (importState: NocodeImportState) => {
  const nocode = nocodes.value.find(item => item.id === currentExpireDialogNocodeId.value);
  if (!nocode) return;

  nocode.importRestriction = nocode.importRestriction || {};
  if (importState.expireAt) {
    nocode.importRestriction.expireAt = importState.expireAt;
  } else {
    delete nocode.importRestriction.expireAt;
  }
  if (isEmpty(nocode.importRestriction)) {
    delete nocode.importRestriction;
  }

  if (permissionsMap[currentExpireDialogNocodeId.value]) {
    permissionsMap[currentExpireDialogNocodeId.value].canManageImportExpireAt = !!importState.canManageExpireAt;
  }
}

const deleteConfirmDialogVisible = ref(false);
const activeNocode = ref<NocodeMeta>();
const copyNocodeDialogVisible = ref(false);
const currentCopyNocodeId = ref("");
const handleShowDeleteNocodeDialog = (nocode: NocodeMeta) => {
  activeNocode.value = nocode;
  deleteConfirmDialogVisible.value = true;
}

const handleDeleteNocode = async () => {
  const res = await axios.get(`/project/delete-nocode?id=${activeNocode.value.id}`).then(() => true).catch(({ response }) => {
    ElMessage.error(response.data.message);
    return false;
  });
  if (!res) return;
  shareNocodeCacheStore.markAllDirty();
  await getGroupStructure();
}


const handleCopyNocode = (nocodeId: string) => {
  currentCopyNocodeId.value = nocodeId;
  copyNocodeDialogVisible.value = true;
}

const handleCopyNocodeSuccess = async () => {
  ElMessage.success(`${i18next.t("WorkbenchHomeMain.copySuccess")}`);
  shareNocodeCacheStore.markAllDirty();
  await getGroupStructure();
}

const openingProjectList = ref<string[]>([]);
const updateOpeningList = (type: 'open' | 'close', projectId: string) => {
  if (type === 'open') {
    openingProjectList.value.push(projectId);
  } else if(openingProjectList.value.indexOf(projectId) !== -1) {
    openingProjectList.value.splice(openingProjectList.value.indexOf(projectId), 1);
  }
}

const handleOpenNocode = async (nocodeId: string) => {
  aiWarmupActivityReporter?.report('open_app');
  router.push(buildNocodeEditorRoute(nocodeId))
}

const isBrokenNocode = (nocodeId: string) => !!brokenNocodeMap[nocodeId];

const applyRestoredBrokenNocode = (
  nocodeMeta: NocodeMeta,
  restoredBody?: NocodeBody | null,
  cover?: NocodeCoverSummary,
) => {
  delete brokenNocodeMap[nocodeMeta.id];
  nocodeSnapshots[nocodeMeta.id] = restoredBody?.snapshot;
  nocodeCovers[nocodeMeta.id] = cover;
  shareNocodeCacheStore.patchShareNocodeSummary(nocodeMeta.id, (current) => ({
    ...current,
    isBroken: false,
    snapshot: restoredBody?.snapshot,
    cover,
  }));
  shareNocodeCacheStore.markShareNocodesDirty();
}

const handleRestoreBrokenNocode = async (nocodeMeta: NocodeMeta) => {
  pendingRestoreBrokenNocode.value = nocodeMeta;
  brokenAppRestoreDialogVisible.value = true;
}

const handleConfirmRestoreBrokenNocode = async () => {
  if (!pendingRestoreBrokenNocode.value || restoringBrokenApp.value) {
    return;
  }

  restoringBrokenApp.value = true;
  const nocodeMeta = pendingRestoreBrokenNocode.value;
  const restoreResult = await axios.post("/project/restore-broken-nocode", {
    nocodeId: nocodeMeta.id,
  }).then(({ data }) => data).catch(({ response }) => {
    ElMessage.error(response?.data?.message || i18next.t("nocodeServiceTs.restoreBackupUnavailable"));
    return null;
  });

  if (!restoreResult) {
    restoringBrokenApp.value = false;
    return;
  }

  brokenAppRestoreDialogVisible.value = false;
  pendingRestoreBrokenNocode.value = null;
  restoringBrokenApp.value = false;
  ElMessage.success(i18next.t("WorkbenchHomeMain.restoreBrokenAppSuccess"));
  applyRestoredBrokenNocode(nocodeMeta, restoreResult.body, restoreResult.cover);
}

watch(brokenAppRestoreDialogVisible, (visible) => {
  if (!visible && !restoringBrokenApp.value) {
    pendingRestoreBrokenNocode.value = null;
  }
});

const handlePreviewNocode = (nocodeMeta: NocodeMeta) => {
  if (isBrokenNocode(nocodeMeta.id)) {
    void handleRestoreBrokenNocode(nocodeMeta);
    return;
  }
  router.push({
    path: `/app/${nocodeMeta.id}/`,
  });
}

const handleGoToTodo = (category: TodoCategory, subCategory?: TodoSubCategory) => {
  if (!category) return;
  if (subCategory) {
    router.push({
      path: '/process',
      query: {
        category,
        todoPendingFilter: 'overtime',
      },
    });
    return;
  }
  goToProcess(category);
}

getAllCategoryTodoCount();

const goToProcess = (category = TodoCategory.MY_TODO) => {
  router.push({
    path:'/process',
    query: {
      category,
    }
  });
}

provide(NOCODE_LIST, nocodes);
provide(GET_LIST, refreshGroupStructure);
provide(PARENT_ID, parentId);
provide(UPDATE_OPENING_PROJECT_LIST, updateOpeningList);

let hasWarmedAppRoutes = false;
const warmupWorkbenchAppRoutes = () => {
  if (hasWarmedAppRoutes || import.meta.env.DEV) return;
  hasWarmedAppRoutes = true;
  requestIdleCallback(() => {
    void Promise.allSettled([
      import("@renderer/views/nocode/views/viewer/NocodeIndex.vue"),
      import("@renderer/views/nocode/views/viewer/NocodeHome.vue"),
      import("@renderer/views/nocode/views/viewer/NocodeDataView.vue"),
      import("@renderer/views/nocode/views/viewer/main/NocodePageView.vue"),
      import("@renderer/views/nocode/views/viewer/main/FormDataViewer.vue"),
      import("@renderer/views/main/project/ProjectViewer.vue"),
      import("@renderer/views/nocode/views/editor/NocodeEditor.vue"),
      import("@renderer/views/main/project/ProjectEditor.vue"),
    ]);
  }, { timeout: 15000 });
}

// 根据搜索值过滤分组结构
const filteredGroupStructure = computed(() => {
  if (!groupStructure.value) return [];
  
  if (!searchValue.value) {
    return groupStructure.value;
  }
  
  // 创建一个新的分组结构，仅包含符合搜索条件的应用
  return groupStructure.value.map(group => {
    return {
      ...group,
      nocodes: group.nocodes.filter(nocode => 
        nocode.name.toLowerCase().includes(searchValue.value.toLowerCase())
      )
    };
  }).filter(group => group.nocodes.length > 0 || group.isUngrouped);
});
const filteredNocodeCount = computed(() => (
  filteredGroupStructure.value.reduce((total, group) => total + group.nocodes.length, 0)
));
const renderedGroupStructure = computed(() => (
  sliceNocodeGroupsByLimit(filteredGroupStructure.value, renderedNocodeCount.value)
));
const hasMoreNocodes = computed(() => renderedNocodeCount.value < filteredNocodeCount.value);
const resolveProgressiveRenderScrollRoot = (element: HTMLElement | null) => {
  let current = element?.parentElement || null;
  while (current) {
    const overflowY = getComputedStyle(current).overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && current.clientHeight > 0) return current;
    current = current.parentElement;
  }
  return element;
};
const resolveProgressiveRenderCapacity = () => {
  const scrollRoot = progressiveRenderScrollRoot;
  if (!scrollRoot) return NOCODE_GRID_COLUMN_COUNT;

  const manageBody = scrollRoot.querySelector<HTMLElement>('.manage-body');
  const scrollRootRect = scrollRoot.getBoundingClientRect();
  const contentTopOffset = manageBody
    ? manageBody.getBoundingClientRect().top - scrollRootRect.top + scrollRoot.scrollTop
    : 0;
  return calculateNocodeRenderCapacity(
    scrollRoot.clientHeight,
    contentTopOffset,
    NOCODE_GRID_COLUMN_COUNT,
    NOCODE_GRID_ROW_HEIGHT,
  );
};
const handleProgressiveRenderScroll = () => {
  const scrollRoot = progressiveRenderScrollRoot;
  if (
    !scrollRoot
    || scrollRoot.scrollHeight - scrollRoot.scrollTop - scrollRoot.clientHeight > RENDER_BOTTOM_TOLERANCE_PX
  ) return;
  requestNextNocodeBatch();
};
const scheduleProgressiveRenderCoverageCheck = () => {
  nextTick(() => {
    requestAnimationFrame(() => {
      progressiveRenderBatchPending = false;
      handleProgressiveRenderScroll();
    });
  });
};
const resetProgressiveRender = async () => {
  progressiveRenderBatchPending = false;
  await nextTick();
  const capacity = resolveProgressiveRenderCapacity();
  progressiveRenderBatchSize.value = capacity;
  renderedNocodeCount.value = capacity;
  scheduleProgressiveRenderCoverageCheck();
};
const loadNextNocodeBatch = () => {
  renderedNocodeCount.value = Math.min(
    filteredNocodeCount.value,
    renderedNocodeCount.value + progressiveRenderBatchSize.value,
  );
};
const requestNextNocodeBatch = () => {
  if (progressiveRenderBatchPending || !hasMoreNocodes.value) return;

  progressiveRenderBatchPending = true;
  loadNextNocodeBatch();
  scheduleProgressiveRenderCoverageCheck();
};
const syncProgressiveRenderCapacity = () => {
  if (isLoading.value) return;
  const capacity = resolveProgressiveRenderCapacity();
  progressiveRenderBatchSize.value = capacity;
  if (renderedNocodeCount.value < capacity) {
    renderedNocodeCount.value = capacity;
  }
  scheduleProgressiveRenderCoverageCheck();
};

watch([searchValue, groupStructure, isLoading], () => {
  if (!isLoading.value) resetProgressiveRender();
}, { flush: 'post' });
onMounted(async () => {
  await nextTick();
  progressiveRenderScrollRoot = resolveProgressiveRenderScrollRoot(
    unref(workbenchScrollbarRef.value?.wrapRef) || null,
  );
  progressiveRenderScrollRoot?.addEventListener('scroll', handleProgressiveRenderScroll, { passive: true });
  if (progressiveRenderScrollRoot) {
    progressiveRenderResizeObserver = new ResizeObserver(syncProgressiveRenderCapacity);
    progressiveRenderResizeObserver.observe(progressiveRenderScrollRoot);
  }
  if (!isLoading.value) resetProgressiveRender();
});
const syncPermissions = (nocodeList: WorkbenchNocodeSummary[]) => {
  if (!nocodeList.length) {
    clearRecord(permissionsMap);
    return;
  }

  const permissions = nocodeList.map((item) => {
    const editable = canShowWorkbenchMetaActions({
      hasEditablePermission: !!item.permissions?.editable,
      isImportReadonly: isNocodeImportReadonly(item.meta),
      isImportExpired: isNocodeImportExpired(item.meta),
    });
    return {
      nocodeId: item.meta.id,
      editable,
      deletable: !!item.permissions?.deletable,
      canManageImportExpireAt: !!item.permissions?.canManageImportExpireAt,
    };
  });

  clearRecord(permissionsMap);
  permissions.forEach(({ nocodeId, editable, deletable, canManageImportExpireAt }) => {
    permissionsMap[nocodeId] = { editable, deletable, canManageImportExpireAt };
  });
}

watch(() => isLoading.value, (value) => {
  if (!value) {
    // warmupWorkbenchAppRoutes();
  }
}, { immediate: true });

watch(isAiWarmupBadgeEnabled, () => {
  startWarmupPolling();
}, { immediate: true });

onBeforeUnmount(() => {
  progressiveRenderScrollRoot?.removeEventListener('scroll', handleProgressiveRenderScroll);
  progressiveRenderResizeObserver?.disconnect();
  progressiveRenderResizeObserver = null;
  progressiveRenderScrollRoot = null;
  clearWarmupPolling();
});
</script>

<style scoped lang='scss'>
.workbench-home-main-scrollbar {
  height: 100%;

  :deep(.el-scrollbar__wrap) {
    overflow-x: hidden;
    box-sizing: border-box;
  }

  :deep(.el-scrollbar__view) {
    min-height: 100%;
    overflow: hidden;
  }

  :deep(.el-scrollbar__bar.is-horizontal) {
    display: none !important;
  }
}

.workbench-home-main {
  min-width: 1024px;
  max-width: 1920px;
  min-height: calc(100vh - 60px);
  height: 100%;
  padding: 24px 32px;
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  overflow-x: hidden;

  .approval-container {
    width: calc(100% + 2px);
    margin-bottom: 32px;
    display: flex;
    flex-direction: column;
    row-gap: 12px;

    .approval-header {
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .header-left {
        padding: 0 2px;
        display: flex;
        align-items: center;
        column-gap: 8px;

        .approval-header-text {
          color: var(--text-color-regular);
          font-size: 16px;
          line-height: 24px;
        }
      }
    }

    .approval-body {
      height: 180px;
      border-radius: 4px;
      display: flex;
      column-gap: 16px;

      .approval-body-left {
        padding: 16px;
        width: 40%;
        height: 100%;
        background-color: var(--bg-color-page);
        border-radius: 8px;
        display: grid;
        grid-template-columns: 1fr 2fr;
        grid-column-gap: 16px;

        .approval-body-left-left {
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          border-radius: 4px;
          gap: 12px;
          padding: 8px;
          cursor: var(--cursor-pointer);
          transition: background-color 0.3s ease;

          &:hover {
            background-color: var(--bg-color-overlay);
          }

          .todo-item-count {
            font-size: 40px;
            line-height: 48px;
            font-weight: 500;
            color: var(--color-primary);
          }
          .todo-item-label {
            font-size: 16px;
            line-height: 24px;
          }
        }

        .approval-body-left-right {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-direction: column;
          padding: 0;

          .line {
            height: 1px;
            width: calc(100% - 24px);
            background-color: rgba(0, 0, 0, 0.1);
            margin: 4px 0;
          }

          .todo-item {
            width: 100%;
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 0;

            .todo-item-text {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 8px 12px;
              border-radius: 4px;
              cursor: var(--cursor-pointer);
              transition: background-color 0.3s ease;

              &:hover {
                background-color: var(--bg-color-overlay);
              }
              .todo-item-label {
                display: flex;
                align-items: center;
                gap: 12px;
                font-size: 14px;
                line-height: 22px;
              }
  
              .todo-item-count {
                font-size: 20px;
                font-weight: 500;
                line-height: 28px;
              }
            }
          }
        }
      }

      .approval-body-right {
        width: 60%;
        height: 100%;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        gap: 16px;
        background-color: var(--bg-color-page);
        border-radius: 8px;
        padding: 16px;

        .approval-item {
          padding: 16px 32px;
          height: 100%;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: var(--cursor-pointer);
          transition: box-shadow 0.3s ease;
          padding: 12px 16px;

          &:hover {
            background-color: var(--bg-color-overlay);
          }

          .approval-item-left {
            display: flex;
            align-items: center;
            flex-direction: column;
            column-gap: 8px;

            span {
              color: var(--text-color-regular);
              font-size: 14px;
              line-height: 22px;
              margin-top: 12px;
            }
          }

          .approval-item-right {
            height: 32px;
            color: rgba(19, 19, 20, 1);
            font-size: 24px;
            font-weight: 700;
          }
        }
      }
    }
  }

  .manage-container {
    width: calc(100% + 2px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;

    .manage-header {
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      .manage-header-left {
        padding: 0 2px;
        display: flex;
        min-width: 120px;
        height: 100%;
        align-items: center;
        column-gap: 8px;

        .manage-header-text {
          color: var(--text-color-regular);
          font-size: 16px;
          line-height: 24px;
        }
      }

      .manage-header-right {
        height: 100%;
        display: flex;
        justify-content: end;
        align-items: center;
        column-gap: 8px;

        :deep(.search-input) {
          width: 320px;
          height: 100%;

          .el-input__wrapper {
            box-shadow: unset;
            background-color: var(--bg-color-page);
            border-radius: 4px;

            &:hover {
              box-shadow: 0 0 0 1px var(--border-color) inset;
            }

            &.is-focus {
              box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
            }
          }
        }

        >.el-icon {
          width: 36px;
          height: 100%;
          background-color: var(--bg-color-page);
          border-radius: 4px;
          cursor: var(--cursor-pointer);

          &:hover {
            color: var(--color-primary);
          }
        }

        .add-button {
          width: 108px;
          height: 100%;
          border-radius: 4px;
          cursor: var(--cursor-pointer);

          .add-text {
            color: var(--color-white);
            font-size: 14px;
          }
        }
      }
    }

    .manage-body-container {
      background-color: #fff;
      border-radius: 8px;
      padding: 16px;
      flex: 1;
      .manage-body-header {
        height: 36px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        column-gap: 8px;
        margin-bottom: 24px;
        .manage-body-header-left {
          :deep(.search-input) {
            width: 320px;
            height: 36px;
  
            .el-input__wrapper {
              box-shadow: unset;
              background-color: #F2F3F5;
              border-radius: 4px;
              font-size: 14px;
              line-height: 22px;
  
              &:hover {
                box-shadow: 0 0 0 1px var(--border-color) inset;
              }
  
              &.is-focus {
                box-shadow: 0 0 0 1px var(--el-input-focus-border-color) inset !important;
                background-color: #FFF;
              }
            }
          }
        }
        
        .manage-body-header-right {
          display: flex;
          align-items: center;
          column-gap: 8px;
          >.el-icon {
            width: 36px;
            height: 36px;
            background-color: #F2F3F5;
            border-radius: 4px;
            cursor: var(--cursor-pointer);
  
            &:hover {
              background-color: #E5E6EB;
            }
          }

          .add-button {
            width: 108px;
            height: 36px;
            border-radius: 4px;
            cursor: var(--cursor-pointer);
  
            .add-text {
              color: var(--color-white);
              font-size: 14px;
            }
          }
        }

      }

      .manage-body {
        flex: 1;
        margin-top: 12px;
      }
  
      .skeleton-body {
        margin-top: 16px;
        display: flex;
        flex-direction: column;
        row-gap: 16px;
  
        .skeleton-group {
          display: flex;
          flex-direction: column;
          row-gap: 12px;
  
          &.is-animated .el-skeleton__item {
            background: linear-gradient(90deg, #F0F1F2 25%, #fff 37%, #F0F1F2 63%);
            background-size:  400%  100%;
            animation: el-skeleton-loading 2s linear infinite;
          }
  
          .el-skeleton__item {
            background-color: #EBEDF0;
            border-radius: 8px;
          }
  
          .skeleton-img {
            display: flex;
            justify-content: space-between;
            gap: 16px;
  
            .skeleton-box {
              position: relative;
  
              .el-icon {
                position: absolute;
                inset: 0;
                margin: auto;
                width: 38px;  
                height: 38px;
                color: #ffffff98;
                font-size: 38px;
              }
            }
          }
        }
  
        
      }
    }


    .nocode-group {
      margin-bottom: 24px;

      .group-title {
        font-size: 14px;
        font-weight: 500;
        line-height: 22px;
        display: flex;
        align-items: center;
        margin-bottom: 12px;
        gap: 4px;
        .group-title-line {
          width: 3px;
          height: 16px;
          background-color: var(--color-primary);
          border-radius: 2px;
        }
      }
      .group-body {
        display: grid;
        // grid-template-columns: repeat(auto-fill, minmax(296px, 1fr));
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 16px;
      }
    }

  }

  :deep(.el-empty) {
    position: absolute;
    top: calc(50% + 160px);
    left: 50%;
    transform: translate(-50%, -50%);
    --el-font-size-base: 12px;

    .el-empty__description {
      margin-top: 10px;
      line-height: 150%;
    }

    svg {
      color: currentColor;
    }
  }
}
</style>
