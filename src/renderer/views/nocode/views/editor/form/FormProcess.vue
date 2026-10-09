<template>
  <div
    class="form-process"
    ref="formProcessRef"
    tabindex="1"
  >
    <div v-if="showStructureLockedTip" class="process-structure-tip">
      <el-icon size="16"><i-ep-warning /></el-icon>
      {{ $t('FormProcess.structureLockedTip') }}
    </div>

    <div class="process-toolbar" v-if="props.active">
      <el-dropdown ref="versionDropdownRef" trigger="click" placement="bottom-end" popper-class="process-version-dropdown"
        @command="handleVersionCommand" @visible-change="handleVersionDropdownVisibleChange">
        <div class="version-trigger">
          <div class="version-trigger__title">
            <span :class="['version-trigger__dot', getVersionStatusClass(currentVersionStatus)]"></span>
            <span class="version-trigger__name">{{ currentVersionLabel }}</span>
            <span class="version-trigger__status" :class="getVersionStatusClass(currentVersionStatus)">{{ currentVersionStatusLabel }}</span>
          </div>
          <el-button
            v-if="currentVersionStatus === ProcessVersionStatus.ENABLED"
            link
            class="version-trigger__action is-disable"
            @click.stop.prevent="handleDisableCurrentVersion"
          >
            {{ $t('FormProcess.disableVersion') }}
          </el-button>
          <el-button
            v-else
            type="primary"
            size="small"
            class="version-trigger__action is-enable"
            @click.stop.prevent="handleEnableCurrentVersion"
          >
            {{ $t('FormProcess.enableVersion') }}
          </el-button>
          <el-icon :size="16" class="version-trigger__icon" :class="{ 'is-open': versionDropdownVisible }">
            <i-ep-arrow-down />
          </el-icon>
        </div>

        <template #dropdown>
          <el-dropdown-menu style="--el-dropdown-menuItem-hover-fill: transparent">
            <div class="process-version-dropdown__list">
              <el-scrollbar :max-height="306">
                <el-dropdown-item v-for="item in versionItems" :key="item.version" :command="`switch:${item.version}`"
                  class="process-version-dropdown__item" :class="{ 'is-active': item.status === ProcessVersionStatus.ENABLED, 'is-editing': item.isEditing }">
                  <div class="process-version-dropdown__row">
                    <div class="process-version-dropdown__left">
                      <span>{{ formatVersionName(item.version) }}</span>
                    </div>
                    <div class="process-version-dropdown__meta">
                      <button v-if="item.status === ProcessVersionStatus.ENABLED" type="button"
                        class="process-version-dropdown__status is-disable-action"
                        @click.stop.prevent="handleDisableVersionFromDropdown(item.version)">
                        {{ $t('FormProcess.disableVersion') }}
                      </button>
                      <div class="process-version-dropdown__status" :class="getVersionStatusClass(item.status)">
                        {{ item.statusLabel }}
                      </div>
                      <button v-if="item.status !== ProcessVersionStatus.ENABLED" type="button"
                        class="process-version-dropdown__status is-enable-action"
                        @click.stop.prevent="handleEnableVersionFromDropdown(item.version)">
                        {{ $t('FormProcess.enableVersion') }}
                      </button>
                    </div>
                  </div>
                </el-dropdown-item>
              </el-scrollbar>
            </div>

            <div class="process-version-dropdown__divider"></div>

            <div class="process-version-dropdown__footer">
              <el-dropdown-item command="create" class="process-version-dropdown__action">
                <span class="process-version-dropdown__action-icon is-add">
                  <el-icon :size="16"><i-ep-plus /></el-icon>
                </span>
                <span>{{ $t('FormProcess.newVersion') }}</span>
              </el-dropdown-item>
              <el-dropdown-item command="copy" class="process-version-dropdown__action">
                <span class="process-version-dropdown__action-icon is-add">
                  <el-icon :size="16"><i-ep-copy-document /></el-icon>
                </span>
                <span>{{ $t('FormProcess.copyVersion') }}</span>
              </el-dropdown-item>
              <el-dropdown-item command="copy-to-form" class="process-version-dropdown__action" :title="$t('FormProcess.copyToFormTip')">
                <span class="process-version-dropdown__action-icon is-add">
                  <el-icon :size="16"><i-ven-icon-copy-to /></el-icon>
                </span>
                <span>{{ $t('FormProcess.copyToForm') }}</span>
              </el-dropdown-item>
              <el-dropdown-item command="manage" class="process-version-dropdown__action">
                <span class="process-version-dropdown__action-icon is-manage">
                  <el-icon :size="16"><i-ep-setting /></el-icon>
                </span>
                <span>{{ $t('FormProcess.manageVersions') }}</span>
              </el-dropdown-item>
            </div>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div class="canvas" :class="{ 'is-applying-ai-flow': isApplyingAiFlow || isAiFlowPatchPending }">
      <form-flow-editor v-if="props.active" ref="flowEditorRef"></form-flow-editor>
    </div>
  </div>

  <process-version-manager-dialog v-model="versionManagerVisible" :versions="versionItems"
    @enable-version="handleEnableVersion" @disable-version="confirmDisableVersion" @copy-version="handleCopyVersionFromManager"
    @copy-to-form="handleCopyToFormFromManager" @edit-version="handleEditVersion" @delete-version="handleDeleteVersion" />
  <form-save-tip-dialog ref="switchVersionSaveTipDialogRef" :title="$t('formCreate.confirmSaveFlow')" />
  <copy-process-to-form-dialog
    v-model="copyToFormDialog.visible"
    :keyword="copyToFormDialog.keyword"
    :loading="copyToFormDialog.loading"
    :selected-form-id="copyToFormDialog.selectedFormId"
    :target-forms="copyToFormDialog.targetForms"
    @update:keyword="copyToFormDialog.keyword = $event"
    @update:selected-form-id="copyToFormDialog.selectedFormId = $event"
    @close="closeCopyToFormDialog"
    @confirm="handleConfirmCopyToForm"
  />
</template>

<script lang='ts' setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef, watch, type PropType, Ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  provideFormElementsInfo,
  provideProcessNodeIssueMap,
  provideProcessStructureEditable,
  provideRootBranch,
  useFormData,
  useFormOption,
} from './hooks';
import { Branch, BranchNode, ProcessNode } from './process/process';
import { FormOption, NocodeProcess, ProcessFlow, ProcessNodeType, ProcessVersionStatus, WidgetSoul } from '@common/types/project';
import { isEmpty } from '@common/utils/object';
import { NOCODE, NOCODE_SIGN_IS_LATEST, ORGANIZE_UTIL, UPDATE_NOCODE_SIGN } from '@renderer/types';
import { cloneDeep } from 'lodash';
import {
  getFlows,
  getFormElementsInfo,
  getEnabledProcessVersion,
  getMaxProcessVersion,
  getProcessVersionKey,
  getProcessVersionNumbers,
  getProcessVersionStatus,
  setProcessVersionStatus,
  hasProcessVersion,
  canEnableProcessVersion,
  canDisableProcessVersion,
  isSystemField,
  SystemField,
} from '@common/utils';
import { provideFormFields, useFormTable } from './hooks'
import { useMagicKeys } from '@vueuse/core';
import { Nocode, OrganizeData } from '@common/types/nocode';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import i18next from 'i18next';
import { formFlowApi } from '@renderer/utils/api/form-flow';
import { getDataOwnerSystemField, getNocodeDataSourceTableByUID, isDataOwnerEnabledTable } from '@common/utils/connection';
import { normalizeFlowReferenceOptions } from './process/flow-rules';
import ProcessVersionManagerDialog from './process/ProcessVersionManagerDialog.vue';
import FormSaveTipDialog from './dialogs/FormSaveTipDialog.vue';
import {
  applyAiFlowPlan as buildAppliedAiFlowPlan,
  buildAiFlowSummary,
  compileAiFlowPatchNode,
  inspectRuntimeFlowIssueState,
} from './ai-form-process-runtime';
import { executeNocodeEditorFlowPatch } from './ai-form-process-patch-runtime';
import {
  createNocodeEditorFlowPatchMutationSnapshot,
  prepareNocodeEditorFlowPatchVersionMutation,
  restoreNocodeEditorFlowPatchMutationSnapshot,
  type NocodeEditorFlowPatchVersionMutationSnapshot,
} from './ai-form-process-patch-versioning';
import {
  buildNocodeEditorFlowFingerprint,
  NocodeEditorFlowPatchError,
  type NocodeEditorFlowPatch,
  type NocodeEditorFlowPatchResult,
} from '@common/utils/nocodeEditorFlowPatch';
import FormFlowEditor from './process/FormFlowEditor.vue';
import { buildProcessNodeIssueMap } from './process/processNodeIssueMap';
import {
  resolveCanvasFlowIssueState,
  resolveCurrentFlowIssueProcessNodeId,
} from './process/resolveCanvasFlowIssueState';
import type {
  NocodeEditorAiFlowActionIssue,
  NocodeEditorAiFlowIssueLocateResult,
  NocodeEditorAiFlowIssueState,
} from '../ai/types';
import CopyProcessToFormDialog from './process/CopyProcessToFormDialog.vue';
import { buildCrossAppTargetForms, copyProcessVersionToForm, getCopyableTargetForms, getTargetTableByUID, type CopyableTargetForm } from './utils/processCopy';
import axios, { AxiosError } from 'axios';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';
import { useShareNocodeCacheStore } from '@renderer/stores';
import { projectApi } from '@renderer/utils/api/project';
import { isNocodeImportExpired } from '@common/utils';
import { unique } from '@common/utils/unique';

type ProcessVersionItem = {
  version: number,
  status: ProcessVersionStatus,
  statusLabel: string,
  isStored: boolean,
  isEditing: boolean,
  showDelete: boolean,
  canDelete: boolean,
};

const organizeUtil = new OrganizeUtil()
provide(ORGANIZE_UTIL, organizeUtil)

const nocode = inject(NOCODE, null);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);
const updateNocodeSign = inject(UPDATE_NOCODE_SIGN, null);
const formData = useFormData();
const table = useFormTable();
const formFields = computed(() => {
  return table.value?.fields?.filter(field => {
    return !isSystemField(field) || [SystemField.CREATE_OWNER, SystemField.DATA_OWNER, SystemField.CREATE_TIME, SystemField.UPDATE_TIME].includes(field.meta.name as SystemField);
  }) || [];
})

const formElementsInfo = computed(() => getFormElementsInfo(formWidget.value?.widgets || []));
const props = defineProps<{
  active?: boolean;
  aiFlowIssueState?: NocodeEditorAiFlowIssueState | null;
}>();

const getAiFlowSummaryTableFields = (targetTable?: any | null) => {
  const fields = targetTable?.fields || [];
  if (!targetTable) {
    return [];
  }
  if (!isDataOwnerEnabledTable(targetTable)) {
    return fields.filter(field => field.meta?.name !== SystemField.DATA_OWNER);
  }
  if (fields.some(field => field.meta?.name === SystemField.DATA_OWNER)) {
    return fields;
  }
  return [
    ...fields,
    getDataOwnerSystemField(fields),
  ];
}

const isAiFlowSummaryEditableSystemField = (targetTable: any | null | undefined, field?: any | null) => {
  return Boolean(
    isDataOwnerEnabledTable(targetTable)
    && field?.meta?.name === SystemField.DATA_OWNER,
  );
}

const getAiFlowSummaryTableWidget = (targetTable?: any | null) => {
  if (!targetTable?.uid) {
    return null;
  }
  if (targetTable.uid === table.value?.uid) {
    return formWidget.value || null;
  }
  const dataSourceTable = getNocodeDataSourceTableByUID(nocode?.value?.body, targetTable.uid, {
    nocodeId: nocode?.value?.meta?.id,
    name: nocode?.value?.meta?.name,
    includeSchemaSources: true,
  }, false);
  const widgetOwnerTableUID = dataSourceTable?.table?.meta?.extra?.primaryTable?.[1] || targetTable.uid;
  return dataSourceTable?.connection?.formOptions?.[widgetOwnerTableUID]?.widget || null;
}

const aiFlowSummaryRenderedFieldUIDs = computed(() => {
  const renderedUIDsByTable = new Map<string, Set<string>>();
  for (const targetTable of formData.value?.tables || []) {
    const tableUID = targetTable?.uid;
    if (!tableUID) {
      continue;
    }

    const widget = getAiFlowSummaryTableWidget(targetTable);
    const fieldUIDs = new Set<string>();
    const pending = widget ? [widget] : [];
    while (pending.length) {
      const soul = pending.pop();
      if (!soul) {
        continue;
      }
      if (soul.uid) {
        fieldUIDs.add(soul.uid);
      }
      if (soul.widgets?.length) {
        pending.push(...soul.widgets);
      }
    }
    renderedUIDsByTable.set(tableUID, fieldUIDs);
  }
  return renderedUIDsByTable;
});

const isAiFlowSummaryFieldRendered = (targetTable: any | null | undefined, field?: any | null) => {
  if (!field) {
    return false;
  }
  if (isAiFlowSummaryEditableSystemField(targetTable, field)) {
    return true;
  }
  const tableUID = targetTable?.uid;
  const fieldUID = field?.meta?.uid;
  if (!tableUID || !fieldUID) {
    return false;
  }
  return aiFlowSummaryRenderedFieldUIDs.value.get(tableUID)?.has(fieldUID) || false;
}

const formProcessRef = ref<HTMLElement>();
const flowEditorRef = ref<InstanceType<typeof FormFlowEditor>>();
const versionDropdownRef = ref<{ handleClose?: () => void } | null>(null);
const switchVersionSaveTipDialogRef = ref<InstanceType<typeof FormSaveTipDialog>>();
const canvasChanged = ref(false);
const structureChanged = ref(false);
const processMetaChanged = ref(false);
const isApplyingAiFlow = ref(false);
const allowAiStructureMutation = ref(false);
const pendingAiFlowPatchTransactions = new Map<
  string,
  NocodeEditorFlowPatchVersionMutationSnapshot
>();
type PendingAiFlowPatchContext = {
  mutationId: string;
  formId: string;
  generation: number;
  draftVersion: number;
  appliedFingerprint: string;
};
const isAiFlowPatchPending = ref(false);
let pendingAiFlowPatchContext: PendingAiFlowPatchContext | null = null;
let aiFlowPatchContextGeneration = 0;
let aiFlowPatchMutationSequence = 0;
const processChanged = computed(() => canvasChanged.value || processMetaChanged.value);
const runtimeFlowIssueState = shallowRef<NocodeEditorAiFlowIssueState | null>(null);
// 标记实时校验是否已经对当前草稿结算过，避免把生成期的 AI 快照当成当前画布的结论
const runtimeFlowIssueStateSettled = ref(false);
const currentFlowIssueState = computed<NocodeEditorAiFlowIssueState | null>(() => (
  resolveCanvasFlowIssueState({
    aiFlowIssueState: props.aiFlowIssueState || null,
    runtimeFlowIssueState: runtimeFlowIssueState.value,
    runtimeFlowIssueStateSettled: runtimeFlowIssueStateSettled.value,
    currentFlows: getCurrentDraftFlows(),
  })
));
const runtimeFlowIssueVerdict = computed(() => ({
  formId: String(table.value?.uid || ''),
  settled: runtimeFlowIssueStateSettled.value,
  state: runtimeFlowIssueState.value,
}));
const currentProcessNodeIssueMap = computed(() => buildProcessNodeIssueMap(
  currentFlowIssueState.value,
  getCurrentDraftFlows(),
));
const versionDropdownVisible = ref(false);
const versionDeleteStateMap = ref<Record<number, boolean>>({});
const persistedVersions = ref<number[]>([]);
const savedProcessSnapshot = ref<NocodeProcess | null>(null);
const formOption = useFormOption();
const formWidget = computed(() => formOption.value.widget);
const editingVersion = ref(1);
const versionManagerVisible = ref(false);
const shareNocodeCacheStore = useShareNocodeCacheStore();
const copyToFormDialog = reactive({
  visible: false,
  keyword: '',
  loading: false,
  selectedFormId: '',
  sourceVersion: 1,
  targetForms: [] as CopyableTargetForm[],
});
let copyToFormTargetRequestId = 0;

useMagicKeys({
  passive: false,
  target: formProcessRef,
  onEventFired(e) {
    if (e.type === "keydown" && e.key === 'Delete') {
      e.preventDefault();
    }
  }
});

const getDefaultFlows = (): ProcessFlow[] => {
  return [
    {
      type: ProcessNodeType.START,
      uid: 'start',
      options: {
        name: i18next.t('FormProcess.processStartNode'),
        fieldAuth: "all",
      },
      branches: [],
    },
    {
      type: ProcessNodeType.END,
      uid: 'end',
      options: {
        name: i18next.t('FormProcess.processEnd'),
      },
    }
  ]
}

const isInvalidFlows = (flows: ProcessFlow[]) => {
  if (isEmpty(flows) || flows.length <= 1) return true;
  return flows.some(flow => {
    return (flow.x && flow.y) || flow.options?.owner
  })
}

const organizeData = reactive<OrganizeData>({} as null);
const branch: Ref<Branch> = ref(null);

const ensureProcessStructure = () => {
  if (!formOption.value.process) {
    formOption.value.process = {
      enabled: false,
      flowsByVersion: {},
      versionStatusByVersion: {
        v1: ProcessVersionStatus.DESIGNING,
      },
      version: 1,
    };
  }
  const process = formOption.value.process as NocodeProcess;
  if (process.flows && !process.flowsByVersion) {
    getFlows(process, process.version ?? 1);
  }
  process.flowsByVersion = process.flowsByVersion || {};
  if (!Number.isInteger(process.version) || process.version <= 0) {
    process.version = 1;
  }
  process.versionStatusByVersion = process.versionStatusByVersion || {};
  for (const version of getProcessVersionNumbers(process)) {
    const versionKey = getProcessVersionKey(version);
    if (!process.versionStatusByVersion[versionKey]) {
      process.versionStatusByVersion[versionKey] = getProcessVersionStatus(process, version) || ProcessVersionStatus.DESIGNING;
    }
  }
  return process;
}

const syncPersistedVersions = (process?: NocodeProcess | null) => {
  persistedVersions.value = getProcessVersionNumbers(process || undefined);
}

const formatVersionName = (version: number) => i18next.t('FormProcess.versionLabel', { version });

const getVersionStatusLabel = (status: ProcessVersionStatus) => {
  if (status === ProcessVersionStatus.ENABLED) {
    return i18next.t('FormProcess.enabledStatus');
  }
  if (status === ProcessVersionStatus.HISTORY) {
    return i18next.t('FormProcess.historyStatus');
  }
  return i18next.t('FormProcess.designingStatus');
}

const getVersionStatusClass = (status: ProcessVersionStatus) => {
  if (status === ProcessVersionStatus.ENABLED) {
    return 'is-enabled';
  }
  if (status === ProcessVersionStatus.HISTORY) {
    return 'is-history';
  }
  return 'is-designing';
}

const currentVersionStatus = computed(() => {
  const process = ensureProcessStructure();
  return getProcessVersionStatus(process, editingVersion.value) || ProcessVersionStatus.DESIGNING;
});

const currentVersionStatusLabel = computed(() => getVersionStatusLabel(currentVersionStatus.value));
const isStructureEditable = computed(() => (
  currentVersionStatus.value === ProcessVersionStatus.DESIGNING
  && !isApplyingAiFlow.value
  && !isAiFlowPatchPending.value
));
const canMutateStructure = computed(() => (
  currentVersionStatus.value === ProcessVersionStatus.DESIGNING
  && !isAiFlowPatchPending.value
  && (allowAiStructureMutation.value || !isApplyingAiFlow.value)
));
const showStructureLockedTip = computed(() => [ProcessVersionStatus.ENABLED, ProcessVersionStatus.HISTORY].includes(currentVersionStatus.value));

const ensureAiFlowPatchMutationIdle = () => {
  if (!isAiFlowPatchPending.value) {
    return true;
  }
  ElMessage.warning('AI 流程局部修改正在保存，请稍后再编辑流程');
  return false;
}

const invalidatePendingAiFlowPatchTransactions = () => {
  pendingAiFlowPatchTransactions.clear();
  pendingAiFlowPatchContext = null;
  isAiFlowPatchPending.value = false;
  aiFlowPatchContextGeneration += 1;
}

const isAiFlowPatchRollbackCurrent = (input: {
  mutationId: string;
  formId: string;
  generation: number;
  draftVersion: number;
  appliedFingerprint: string;
}) => {
  const pending = pendingAiFlowPatchContext;
  return !!pending
    && pending.mutationId === input.mutationId
    && pending.formId === input.formId
    && pending.generation === input.generation
    && pending.draftVersion === input.draftVersion
    && pending.appliedFingerprint === input.appliedFingerprint;
}

const isDeleteStateLoaded = (version: number) => {
  return Object.prototype.hasOwnProperty.call(versionDeleteStateMap.value, version);
}

const refreshVersionDeleteStates = async () => {
  const process = ensureProcessStructure();
  const nocodeId = nocode?.value?.meta?.id;
  const tableId = table.value?.uid;
  const entries = await Promise.all(getDisplayVersionNumbers().map(async (version) => {
    const status = getProcessVersionStatus(process, version) || ProcessVersionStatus.DESIGNING;
    if (![ProcessVersionStatus.DESIGNING, ProcessVersionStatus.HISTORY].includes(status)) {
      return null;
    }
    if (!hasPersistedVersion(version)) {
      return [version, true] as const;
    }
    if (!nocodeId || !tableId) {
      return [version, false] as const;
    }
    const deleteCheck = await formFlowApi.checkProcessVersionDeletable({
      nocodeId,
      tableId,
      version,
    });
    return [version, !!deleteCheck?.canDelete] as const;
  }));
  const nextStateMap = { ...versionDeleteStateMap.value };
  for (const entry of entries) {
    if (!entry) {
      continue;
    }
    nextStateMap[entry[0]] = entry[1];
  }
  versionDeleteStateMap.value = nextStateMap;
}

const getDisplayVersionNumbers = () => {
  const process = ensureProcessStructure();
  const versions = getProcessVersionNumbers(process);
  if (!versions.includes(editingVersion.value)) {
    versions.push(editingVersion.value);
  }
  return Array.from(new Set(versions)).sort((left, right) => right - left);
}

const getCurrentDraftFlows = () => {
  const currentFlows = branch.value?.getFlows?.();
  return cloneDeep(isEmpty(currentFlows) ? getDefaultFlows() : currentFlows);
}

const storeCurrentDraftToVersion = (version: number) => {
  const process = ensureProcessStructure();
  process.flowsByVersion[getProcessVersionKey(version)] = getCurrentDraftFlows();
}

const createEditableFlows = (version: number) => {
  const process = ensureProcessStructure();
  const storedFlows = cloneDeep(getFlows(process, version));
  const nextFlows = isInvalidFlows(storedFlows) ? getDefaultFlows() : storedFlows;
  return reactive<ProcessFlow[]>(nextFlows);
}

const createBranchContext = (
  flows: ProcessFlow[],
  updateHistory?: (changeType?: 'settings' | 'structure') => void,
  resolveAllowStructureEdit: () => boolean = () => canMutateStructure.value,
) => ({
  updateHistory: updateHistory || (() => undefined),
  get allowStructureEdit() {
    return resolveAllowStructureEdit();
  },
  normalizeFlowOptions: () => {
    normalizeFlowReferenceOptions(flows);
  },
  get organizeData() {
    return organizeData;
  },
  get tables() {
    const currentTables = formData.value.tables || [];
    const otherTables = (nocode?.value?.body?.otherDataSources || []).flatMap(source => source?.tables || []);
    return [...currentTables, ...otherTables];
  },
  get formFields() {
    return formFields.value;
  },
  get formElementsInfo() {
    return formElementsInfo.value;
  }
})

const createBranch = (flows: ProcessFlow[]) => {
  branch.value?.destroy?.();
  branch.value = new Branch({
    uid: "root",
    type: "root",
    flows,
  }, null,
    createBranchContext(flows, (changeType = 'settings') => {
      canvasChanged.value = true;
      if (changeType === 'structure') {
        structureChanged.value = true;
      }
    }))
}

const restoreAiFlowPatchSnapshot = (
  snapshot: NocodeEditorFlowPatchVersionMutationSnapshot,
) => {
  const restored = restoreNocodeEditorFlowPatchMutationSnapshot(snapshot);
  formOption.value.process = restored.process;
  editingVersion.value = restored.editingVersion;
  createBranch(createEditableFlows(restored.editingVersion));
  canvasChanged.value = restored.canvasChanged;
  structureChanged.value = restored.structureChanged;
  processMetaChanged.value = restored.processMetaChanged;
}

const validateVersionFlows = (flows: ProcessFlow[]) => {
  const validationFlows = cloneDeep(flows);
  const validationBranch = new Branch({
    uid: "root",
    type: "root",
    flows: validationFlows,
  }, null, createBranchContext(validationFlows, undefined, () => false));
  const valid = validationBranch.validate();
  validationBranch.destroy();
  return valid;
}

const validateEditingDraftFlows = async () => {
  const currentDraftFlows = getCurrentDraftFlows();
  const valid = validateVersionFlows(currentDraftFlows);
  if (!valid) {
    await nextTick();
    branch.value?.validate();
  }
  return valid;
}

const AI_FLOW_APPLY_STEP_DELAY_MS = 500;

const sleep = (duration: number) => new Promise<void>((resolve) => {
  setTimeout(resolve, duration);
});

const buildAiFlowApplySkeleton = (sourceStartFlow: ProcessFlow) => {
  const [defaultStartFlow, endFlow] = cloneDeep(getDefaultFlows()) as ProcessFlow[];
  return [
    {
      ...defaultStartFlow,
      branches: (sourceStartFlow.branches || []).map(branch => ({
        ...branch,
        flows: [],
      })),
    },
    endFlow,
  ] as ProcessFlow[];
}

const waitForFlowNodeVisible = async (uid?: string | null) => {
  await nextTick();
  await flowEditorRef.value?.keepNodeInView?.(uid);
  if (uid) {
    await sleep(AI_FLOW_APPLY_STEP_DELAY_MS);
  }
}

const stripFlowOptionsForAiCreation = (flow?: ProcessFlow | null): ProcessFlow | null => {
  if (!flow) {
    return null;
  }

  const nextFlow = cloneDeep(flow);
  delete nextFlow.options;
  if (Array.isArray(nextFlow.branches)) {
    nextFlow.branches = nextFlow.branches.map((branchItem) => ({
      ...branchItem,
      flows: Array.isArray(branchItem.flows)
        ? branchItem.flows
          .filter(Boolean)
          .map(item => stripFlowOptionsForAiCreation(item) as ProcessFlow)
          .filter(Boolean)
        : [],
    }));
  }
  return nextFlow;
}

const applyAiFlowNodeOptions = (
  node: ProcessNode | null | undefined,
  sourceFlow?: ProcessFlow | null,
) => {
  if (!node || !sourceFlow?.options) {
    return;
  }

  node.options = Object.assign(node.options || {}, cloneDeep(sourceFlow.options));
}

const applyAiFlowBranchSettingOptions = (
  ownerNode: BranchNode | null | undefined,
  sourceFlow?: ProcessFlow | null,
) => {
  if (!ownerNode || !Array.isArray(sourceFlow?.branches)) {
    return;
  }

  sourceFlow.branches.forEach((sourceBranch, index) => {
    const targetBranch = ownerNode.branches[index];
    const sourceBranchSettingFlow = sourceBranch?.flows?.find(item => item?.type === ProcessNodeType.BRANCH_SETTING);
    const targetBranchSettingNode = targetBranch?.nodes?.find(item => item?.type === ProcessNodeType.BRANCH_SETTING) as ProcessNode | undefined;
    applyAiFlowNodeOptions(targetBranchSettingNode, sourceBranchSettingFlow);
  });
}

const focusAiFlowIssue = async (
  issue: NocodeEditorAiFlowActionIssue,
): Promise<NocodeEditorAiFlowIssueLocateResult> => {
  const processNodeId = resolveCurrentFlowIssueProcessNodeId({
    issue,
    currentFlows: getCurrentDraftFlows(),
  }) || String(issue.locator?.processNodeId || issue.targetId || '').trim();
  if (!processNodeId) {
    return {
      ok: false,
      reason: 'target_not_found',
      message: i18next.t('FormProcess.flowNodeNotFoundMaybeRegenerated'),
    };
  }
  const focused = await flowEditorRef.value?.openNodeOptionsByUid?.(processNodeId);
  return focused
    ? { ok: true }
    : {
      ok: false,
      reason: 'target_not_found',
      message: i18next.t('FormProcess.flowNodeCannotLocate'),
    };
}

const appendFlowToBranch = async (
  targetBranch: Branch,
  flow: ProcessFlow,
  index?: number,
) => {
  const nextFlow = stripFlowOptionsForAiCreation(flow);
  if (nextFlow?.branches?.length) {
    nextFlow.branches = nextFlow.branches.map((branchItem) => ({
      ...branchItem,
      flows: (branchItem.flows || [])
        .filter(item => item?.type === ProcessNodeType.BRANCH_SETTING),
    }));
  }
  const createdNode = targetBranch.addNode(nextFlow, typeof index === 'number' ? index : -1) as ProcessNode | null;
  if (!createdNode) {
    return null;
  }
  applyAiFlowNodeOptions(createdNode, flow);
  if (createdNode instanceof BranchNode) {
    applyAiFlowBranchSettingOptions(createdNode, flow);
  }
  await waitForFlowNodeVisible(createdNode.uid);
  return createdNode;
}

const populateBranchFlows = async (
  targetBranch: Branch,
  flows: ProcessFlow[],
) => {
  for (const flow of flows || []) {
    if (!flow || [ProcessNodeType.END, ProcessNodeType.BRANCH_SETTING].includes(flow.type)) {
      continue;
    }
    const createdNode = await appendFlowToBranch(targetBranch, flow);
    if (!createdNode) {
      continue;
    }
    if (flow.branches?.length && createdNode instanceof BranchNode) {
      await populateChildBranches(createdNode, flow.branches);
    }
  }
}

const populateChildBranches = async (
  ownerNode: BranchNode,
  sourceBranches: Array<{ flows?: ProcessFlow[] }>,
) => {
  if (ownerNode.type === ProcessNodeType.START) {
    for (let index = ownerNode.branches.length; index < (sourceBranches || []).length; index += 1) {
      ownerNode.addBranch([], index);
    }
  }
  for (let index = 0; index < (sourceBranches || []).length; index += 1) {
    if (!ownerNode.branches[index]) {
      ownerNode.addBranch([], index);
    }
    const targetBranch = ownerNode.branches[index];
    if (!targetBranch) {
      continue;
    }
    const branchFlows = (sourceBranches[index]?.flows || []).filter(Boolean) as ProcessFlow[];
    await populateBranchFlows(targetBranch, branchFlows);
  }
}

const applyAiFlowPlanStepByStep = async (flows: ProcessFlow[]) => {
  const rootFlows = flows || [];
  const startFlow = rootFlows.find(flow => flow?.type === ProcessNodeType.START);
  if (!startFlow) {
    throw new Error(i18next.t('FormProcess.flowStartNodeInitFailed'));
  }
  createBranch(reactive<ProcessFlow[]>(buildAiFlowApplySkeleton(startFlow)));
  await nextTick();
  const nextStartNode = branch.value?.nodes?.find(node => node.type === ProcessNodeType.START) as BranchNode | undefined;
  if (!nextStartNode || !(nextStartNode instanceof BranchNode)) {
    throw new Error(i18next.t('FormProcess.flowStartNodeInitFailed'));
  }
  const startBranches = startFlow?.branches || [];
  await populateChildBranches(nextStartNode, startBranches);
}

const loadVersion = (version: number) => {
  const process = ensureProcessStructure();
  const nextVersion = Number.isInteger(version) && version > 0 ? version : (getMaxProcessVersion(process) || process.version || 1);
  editingVersion.value = nextVersion;
  canvasChanged.value = false;
  structureChanged.value = false;
  createBranch(createEditableFlows(nextVersion));
}

const getInitialEditingVersion = (process = ensureProcessStructure()) => {
  const versions = getProcessVersionNumbers(process);
  const designingVersion = [...versions].reverse().find(version => {
    return getProcessVersionStatus(process, version) === ProcessVersionStatus.DESIGNING;
  });
  return designingVersion || getEnabledProcessVersion(process) || getMaxProcessVersion(process) || process.version || 1;
}

const restoreSavedProcessSnapshot = () => {
  const restoredProcess = cloneDeep(savedProcessSnapshot.value || ensureProcessStructure());
  formOption.value.process = restoredProcess;
  syncPersistedVersions(restoredProcess);
  const nextEditingVersion = hasProcessVersion(restoredProcess, editingVersion.value)
    ? editingVersion.value
    : getInitialEditingVersion(restoredProcess);
  loadVersion(nextEditingVersion);
  processMetaChanged.value = false;
}

const init = (version?: number) => {
  const process = ensureProcessStructure();
  syncPersistedVersions(process);
  savedProcessSnapshot.value = cloneDeep(process || ensureProcessStructure());
  loadVersion(version || getInitialEditingVersion(process));
}

provideFormFields(formFields);
provideRootBranch(branch);
provideFormElementsInfo(formElementsInfo)
provideProcessNodeIssueMap(currentProcessNodeIssueMap);
provideProcessStructureEditable(isStructureEditable);

watch(() => {
  if (!props.active) {
    return null;
  }
  return {
    currentTable: table.value,
    tables: formData.value?.tables || [],
    formFields: formFields.value,
    currentFlows: getCurrentDraftFlows(),
    organizeData,
    fieldRenderState: (formData.value?.tables || []).flatMap(targetTable => (
      getAiFlowSummaryTableFields(targetTable).map(field => [
        targetTable.uid,
        field.meta?.uid,
        isAiFlowSummaryFieldRendered(targetTable, field),
      ])
    )),
  };
}, (state) => {
  if (!state) {
    return;
  }
  const { currentTable, tables, formFields: currentFormFields, currentFlows, organizeData: currentOrganizeData } = state;
  runtimeFlowIssueState.value = inspectRuntimeFlowIssueState({
    currentTable,
    tables,
    formFields: currentFormFields,
    currentFlows,
    organizeData: currentOrganizeData,
    isEditableSystemField: isAiFlowSummaryEditableSystemField,
    isFieldRendered: isAiFlowSummaryFieldRendered,
  }) || null;
  runtimeFlowIssueStateSettled.value = true;
}, { deep: true, immediate: true, flush: 'post' });

watch(() => props.active, (active) => {
  if (active && isEmpty(branch.value?.nodes)) {
    init();
  }
}, { immediate: true })

const currentVersionLabel = computed(() => formatVersionName(editingVersion.value));

const versionItems = computed<ProcessVersionItem[]>(() => {
  const process = ensureProcessStructure();
  const storedVersions = getProcessVersionNumbers(process);
  return getDisplayVersionNumbers().map((version) => {
    const isStored = storedVersions.includes(version);
    const status = getProcessVersionStatus(process, version) || ProcessVersionStatus.DESIGNING;
    const showDelete = [ProcessVersionStatus.DESIGNING, ProcessVersionStatus.HISTORY].includes(status);
    const canDelete = !showDelete
      ? false
      : !isStored
        ? true
        : isDeleteStateLoaded(version)
          ? versionDeleteStateMap.value[version]
          : false;
    return {
      version,
      status,
      statusLabel: getVersionStatusLabel(status),
      isStored,
      isEditing: editingVersion.value === version,
      showDelete,
      canDelete,
    };
  });
});

const hasPersistedVersion = (version: number) => {
  return persistedVersions.value.includes(version);
}

const createCopiedVersionFromSource = (sourceVersion: number, switchToNewVersion = true) => {
  const process = ensureProcessStructure();
  const sourceFlows = hasProcessVersion(process, sourceVersion)
    ? cloneDeep(getFlows(process, sourceVersion))
    : cloneDeep(getCurrentDraftFlows());
  const currentStatus = getProcessVersionStatus(process, sourceVersion) || ProcessVersionStatus.DESIGNING;
  if (currentStatus === ProcessVersionStatus.DESIGNING && !sourceFlows?.length) {
    return createEmptyVersion();
  }
  const nextVersion = getMaxProcessVersion(process) + 1;
  process.flowsByVersion[getProcessVersionKey(nextVersion)] = sourceFlows;
  setProcessVersionStatus(process, nextVersion, ProcessVersionStatus.DESIGNING);
  processMetaChanged.value = true;
  if (switchToNewVersion) {
    loadVersion(nextVersion);
  }
  return nextVersion;
}

const createEmptyVersion = () => {
  const process = ensureProcessStructure();
  const nextVersion = getMaxProcessVersion(process) + 1;
  process.flowsByVersion[getProcessVersionKey(nextVersion)] = cloneDeep(getDefaultFlows());
  setProcessVersionStatus(process, nextVersion, ProcessVersionStatus.DESIGNING);
  processMetaChanged.value = true;
  loadVersion(nextVersion);
  return nextVersion;
}

const ensureEditableVersionForFlowMutation = async () => {
  const process = ensureProcessStructure();
  const currentStatus = getProcessVersionStatus(process, editingVersion.value) || ProcessVersionStatus.DESIGNING;
  if (currentStatus === ProcessVersionStatus.DESIGNING) {
    return editingVersion.value;
  }
  const nextVersion = createCopiedVersionFromSource(editingVersion.value);
  await nextTick();
  return nextVersion;
}

const ensureEditableVersionForAiApply = async () => {
  return await ensureEditableVersionForFlowMutation();
}

const persistCurrentDraft = () => {
  const process = ensureProcessStructure();
  const currentStatus = getProcessVersionStatus(process, editingVersion.value) || ProcessVersionStatus.DESIGNING;
  if (currentStatus === ProcessVersionStatus.DESIGNING) {
    if (!hasProcessVersion(process, editingVersion.value) || canvasChanged.value || processMetaChanged.value) {
      storeCurrentDraftToVersion(editingVersion.value);
    }
    return editingVersion.value;
  }
  if (!canvasChanged.value) {
    return editingVersion.value;
  }
  if (structureChanged.value) {
    return createCopiedVersionFromSource(editingVersion.value);
  }
  storeCurrentDraftToVersion(editingVersion.value);
  return editingVersion.value;
}

const confirmCurrentChanges = async () => {
  if (!processChanged.value) {
    return editingVersion.value;
  }
  const isSave = await switchVersionSaveTipDialogRef.value?.confirm();
  if (isSave) {
    if (!ensureAiFlowPatchMutationIdle()) {
      return;
    }
    return persistCurrentDraft();
  }
  restoreSavedProcessSnapshot();
  return editingVersion.value;
}

const confirmSwitchVersion = async () => {
  await confirmCurrentChanges();
  return true;
}

const switchVersion = async (version: number) => {
  if (editingVersion.value === version) {
    return;
  }
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  await confirmSwitchVersion();
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  loadVersion(version);
}

const handleCreateVersion = async () => {
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  await confirmCurrentChanges();
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  createEmptyVersion();
}

const resolveSourceVersion = (sourceVersion: number, fallbackVersion?: number) => {
  const process = ensureProcessStructure();
  if (hasProcessVersion(process, sourceVersion)) {
    return sourceVersion;
  }
  if (fallbackVersion && hasProcessVersion(process, fallbackVersion)) {
    return fallbackVersion;
  }
  return null;
}

const ensureTargetFormOption = (formOption?: FormOption | null) => {
  const widget = (formOption?.widget || {}) as WidgetSoul;
  return {
    ...(formOption || {}),
    widget: {
      ...widget,
      uid: widget.uid || unique(),
      type: widget.type || 'widget.form.form',
      name: widget.name || i18next.t('formCreate.dataForm'),
      widgets: Array.isArray(widget.widgets) ? widget.widgets : [],
    },
  } as FormOption;
}

const handleCopyVersion = async (sourceVersion = editingVersion.value) => {
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const useResolvedVersionAsFallback = sourceVersion === editingVersion.value;
  const resolvedVersion = await confirmCurrentChanges();
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const actualSourceVersion = resolveSourceVersion(
    sourceVersion,
    useResolvedVersionAsFallback ? resolvedVersion : undefined,
  );
  if (!actualSourceVersion) {
    return;
  }
  createCopiedVersionFromSource(actualSourceVersion);
}

const getCurrentCopyToFormTargets = () => {
  return getCopyableTargetForms(
    nocode?.value?.body,
    table.value?.uid,
    nocode?.value?.meta?.id,
    nocode?.value?.meta?.name,
  );
};

const closeCopyToFormDialog = () => {
  copyToFormTargetRequestId += 1;
  copyToFormDialog.visible = false;
  copyToFormDialog.keyword = '';
  copyToFormDialog.loading = false;
  copyToFormDialog.selectedFormId = '';
  copyToFormDialog.sourceVersion = editingVersion.value;
  copyToFormDialog.targetForms = [];
};

const openCopyToFormDialog = async (sourceVersion = editingVersion.value) => {
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const useResolvedVersionAsFallback = sourceVersion === editingVersion.value;
  const resolvedVersion = await confirmCurrentChanges();
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const actualSourceVersion = resolveSourceVersion(
    sourceVersion,
    useResolvedVersionAsFallback ? resolvedVersion : undefined,
  );
  if (!actualSourceVersion) {
    return;
  }
  copyToFormDialog.selectedFormId = '';
  copyToFormDialog.keyword = '';
  copyToFormDialog.sourceVersion = actualSourceVersion;
  copyToFormDialog.targetForms = getCurrentCopyToFormTargets();
  copyToFormDialog.visible = true;
  const requestId = ++copyToFormTargetRequestId;

  void (async () => {
    try {
      const [sharedSummaries, sharedNocodes] = await Promise.all([
        shareNocodeCacheStore.getShareNocodeSummaries(),
        shareNocodeCacheStore.getShareNocodes(),
      ]);
      if (requestId !== copyToFormTargetRequestId || !copyToFormDialog.visible) {
        return;
      }
      const editableNocodeIdSet = new Set(
        (sharedSummaries || [])
          .filter(item => item?.permissions?.editable && !isNocodeImportExpired(item.meta))
          .map(item => item?.meta?.id)
          .filter(Boolean),
      );
      const crossAppTargets = buildCrossAppTargetForms(
        sharedNocodes.filter(item => item?.body && editableNocodeIdSet.has(item.meta?.id)),
        nocode?.value?.meta?.id,
      );
      copyToFormDialog.targetForms = [...getCurrentCopyToFormTargets(), ...crossAppTargets];
    } catch {
      if (requestId !== copyToFormTargetRequestId || !copyToFormDialog.visible) {
        return;
      }
      ElMessage.warning(i18next.t('FormProcess.copyToFormCrossAppLoadFailWarn'));
    }
  })();
};

const handleConfirmCopyToForm = async () => {
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  if (!copyToFormDialog.selectedFormId) {
    ElMessage.warning(i18next.t('FormProcess.selectTargetFormWarn'));
    return;
  }
  const targetForm = copyToFormDialog.targetForms.find(item => item.id === copyToFormDialog.selectedFormId);
  const targetTableUID = targetForm?.table?.uid;
  if (!targetForm || !targetTableUID) {
    ElMessage.warning(i18next.t('FormProcess.targetFormUnavailable'));
    return;
  }

  const sourceFlows = cloneDeep(getFlows(ensureProcessStructure(), copyToFormDialog.sourceVersion));
  if (!sourceFlows?.length) {
    ElMessage.warning(i18next.t('FormProcess.copyToFormEmptyWarn'));
    return;
  }

  const isCurrentNocodeTarget = !targetForm.isCrossApp || targetForm.nocodeId === nocode.value?.meta?.id;
  if (isCurrentNocodeTarget && !checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) {
    return;
  }
  const targetNocodeData = isCurrentNocodeTarget
    ? await (async () => {
      if (!nocode.value?.meta?.id) {
        return undefined;
      }
      const targetBody = await projectApi.getNocodeBody(nocode.value.meta.id).catch(() => null);
      if (!targetBody) {
        return undefined;
      }
      return {
        meta: cloneDeep(nocode.value.meta),
        body: targetBody,
      } as Nocode;
    })()
    : await (async () => {
      const sharedNocode = cloneDeep((await shareNocodeCacheStore.getShareNocodes()).find(item => item.meta?.id === targetForm.nocodeId) as Nocode | undefined);
      if (!sharedNocode?.meta?.id) {
        return undefined;
      }
      const targetBody = await projectApi.getNocodeBody(sharedNocode.meta.id).catch(() => null);
      if (!targetBody) {
        return undefined;
      }
      sharedNocode.body = targetBody;
      return sharedNocode;
    })();

  if (!targetNocodeData?.body?.formData) {
    ElMessage.warning(i18next.t('FormProcess.targetFormUnavailable'));
    return;
  }

  const targetTable = getTargetTableByUID(targetNocodeData.body, targetTableUID);
  if (!targetTable) {
    ElMessage.warning(i18next.t('FormProcess.targetFormUnavailable'));
    return;
  }

  const nextFormData = cloneDeep(targetNocodeData.body.formData);
  nextFormData.formOptions = nextFormData.formOptions || {};
  nextFormData.formOptions[targetTable.uid] = ensureTargetFormOption(nextFormData.formOptions[targetTable.uid]);

  const targetFormOption = nextFormData.formOptions[targetTable.uid];
  const copiedResult = copyProcessVersionToForm(
    sourceFlows,
    targetFormOption.process,
    {
      currentTable: cloneDeep(table.value),
      targetTable: cloneDeep(targetTable),
      targetFormOption,
      nocodeBody: cloneDeep(targetNocodeData.body),
      nocodeId: targetForm.nocodeId || targetNocodeData.meta?.id,
      nocodeName: targetForm.nocodeName || targetNocodeData.meta?.name,
    },
  );
  targetFormOption.process = copiedResult.process;

  copyToFormDialog.loading = true;
  try {
    const { headers } = await axios.post('/project/save-nocode-connections', {
      nocodeId: targetNocodeData.meta.id,
      connections: targetNocodeData.body.connections,
      formData: nextFormData,
    }, {
      headers: {
        'x-sign': targetNocodeData.body.sign,
      },
    });

    targetNocodeData.body.formData = nextFormData;
    const mainSign = Array.isArray(headers?.['x-sign']) ? headers['x-sign'][0] : headers?.['x-sign'];
    if (mainSign) {
      targetNocodeData.body.sign = mainSign;
      if (isCurrentNocodeTarget) {
        updateNocodeSign?.(mainSign);
      }
    }

    if (isCurrentNocodeTarget) {
      nocode.value.body.formData.formOptions = nocode.value.body.formData.formOptions || {};
      nocode.value.body.formData.formOptions[targetTable.uid] = cloneDeep(targetFormOption);
      formData.value.formOptions = formData.value.formOptions || {};
      formData.value.formOptions[targetTable.uid] = cloneDeep(targetFormOption);
    } else {
      shareNocodeCacheStore.markShareNocodesDirty();
    }
    ElMessage.success(i18next.t('FormProcess.copyToFormSuccess', { version: copiedResult.version }));
    closeCopyToFormDialog();
  } catch (error: unknown) {
    if (isCurrentNocodeTarget && handleNocodeSyncConflictError(error, nocodeSignIsLatest)) {
      return;
    }
    if (!isCurrentNocodeTarget) {
      shareNocodeCacheStore.markShareNocodesDirty();
    }
    if (error instanceof AxiosError) {
      ElMessage.error(error.response?.data?.message || error.message);
      return;
    }
    if (error instanceof Error) {
      ElMessage.error(error.message);
      return;
    }
    ElMessage.error(i18next.t('ExportDataDialog.requestFail'));
  } finally {
    copyToFormDialog.loading = false;
  }
};

const copyVersionFromManager = async (version: number) => {
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const useResolvedVersionAsFallback = version === editingVersion.value;
  const resolvedVersion = await confirmCurrentChanges();
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const actualSourceVersion = resolveSourceVersion(
    version,
    useResolvedVersionAsFallback ? resolvedVersion : undefined,
  );
  if (!actualSourceVersion) {
    return;
  }
  createCopiedVersionFromSource(actualSourceVersion, false);
}

const handleEnableVersion = async (version: number) => {
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const process = ensureProcessStructure();
  if (version !== editingVersion.value && (canvasChanged.value || processMetaChanged.value)) {
    persistCurrentDraft();
  }
  if (!hasProcessVersion(process, version) && version !== editingVersion.value) {
    return;
  }
  let targetVersion = version;
  if (version === editingVersion.value && (!hasProcessVersion(process, version) || canvasChanged.value || processMetaChanged.value)) {
    targetVersion = persistCurrentDraft();
  }
  if (!hasProcessVersion(process, targetVersion)) {
    return;
  }
  if (!canEnableProcessVersion(process, targetVersion)) {
    ElMessage.warning(i18next.t('FormProcess.processEnableIncompleteTips'));
    return;
  }
  const valid = targetVersion === editingVersion.value
    ? await validateEditingDraftFlows()
    : validateVersionFlows(getFlows(process, targetVersion));
  if (!valid) {
    if (targetVersion !== editingVersion.value) {
      loadVersion(targetVersion);
      await nextTick();
      branch.value?.validate();
    }
    ElMessage.warning(i18next.t('FormProcess.processEnableIncompleteTips'));
    return;
  }
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const enabledVersion = getEnabledProcessVersion(process);
  if (enabledVersion && enabledVersion !== targetVersion) {
    setProcessVersionStatus(process, enabledVersion, ProcessVersionStatus.HISTORY);
  }
  setProcessVersionStatus(process, targetVersion, ProcessVersionStatus.ENABLED);
  process.version = targetVersion;
  process.enabled = true;
  canvasChanged.value = false;
  structureChanged.value = false;
  processMetaChanged.value = true;
  versionManagerVisible.value = false;
}

const handleDisableVersion = (version: number) => {
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const process = ensureProcessStructure();
  if (!canDisableProcessVersion(process, version)) {
    return;
  }
  setProcessVersionStatus(process, version, ProcessVersionStatus.HISTORY);
  process.enabled = false;
  processMetaChanged.value = true;
  versionManagerVisible.value = false;
}

const confirmDisableVersion = async (version: number) => {
  try {
    await ElMessageBox.confirm(
      i18next.t('FormProcess.disableVersionConfirm'),
      i18next.t('FormProcess.disableVersionTitle'),
      {
        type: 'warning',
        confirmButtonText: i18next.t('FormProcess.disableVersionConfirmButtonText'),
        cancelButtonText: i18next.t('FormProcess.cancelButtonText'),
      },
    );
  } catch (error) {
    return;
  }

  handleDisableVersion(version);
}

const closeVersionDropdown = () => {
  versionDropdownVisible.value = false;
  versionDropdownRef.value?.handleClose?.();
}

const handleEnableVersionFromDropdown = (version: number) => {
  handleEnableVersion(version);
  closeVersionDropdown();
}

const handleDisableVersionFromDropdown = async (version: number) => {
  closeVersionDropdown();
  await confirmDisableVersion(version);
}

const handleEnableCurrentVersion = () => {
  closeVersionDropdown();
  handleEnableVersion(editingVersion.value);
}

const handleDisableCurrentVersion = async () => {
  closeVersionDropdown();
  await confirmDisableVersion(editingVersion.value);
}

const handleEditVersion = async (version: number) => {
  versionManagerVisible.value = false;
  await switchVersion(version);
}

const handleCopyVersionFromManager = async (version: number) => {
  await copyVersionFromManager(version);
}

const handleCopyToFormFromManager = async (version: number) => {
  await openCopyToFormDialog(version);
}

const handleDeleteVersion = async (version: number) => {
  if (!ensureAiFlowPatchMutationIdle()) {
    return;
  }
  const process = ensureProcessStructure();
  if (!hasProcessVersion(process, version)) {
    return;
  }
  const versionStatus = getProcessVersionStatus(process, version) || ProcessVersionStatus.DESIGNING;
  const persisted = hasPersistedVersion(version);
  if (!persisted) {
    if (versionStatus === ProcessVersionStatus.ENABLED) {
      ElMessage.warning(i18next.t('FormProcess.deleteEnabledVersionTip'));
      return;
    }
  } else {
    const nocodeId = nocode?.value?.meta?.id;
    const tableId = table.value?.uid;
    if (!nocodeId || !tableId) {
      ElMessage.warning(i18next.t('FormProcess.deleteVersionHasDataTip'));
      return;
    }
    const deleteCheck = await formFlowApi.checkProcessVersionDeletable({
      nocodeId,
      tableId,
      version,
    });
    if (!deleteCheck?.canDelete) {
      ElMessage.warning(deleteCheck?.versionStatus === ProcessVersionStatus.ENABLED
        ? i18next.t('FormProcess.deleteEnabledVersionTip')
        : i18next.t('FormProcess.deleteVersionHasDataTip'));
      return;
    }
  }
  if (editingVersion.value === version && canvasChanged.value) {
    const isSave = await switchVersionSaveTipDialogRef.value?.confirm();
    if (isSave) {
      persistCurrentDraft();
    }
  }
  try {
    await ElMessageBox.confirm(
      i18next.t('FormProcess.deleteVersionConfirm'),
      i18next.t('FormProcess.deleteVersionTitle'),
      {
        type: 'warning',
        confirmButtonText: i18next.t('FormProcess.confirmButtonText'),
        cancelButtonText: i18next.t('FormProcess.cancelButtonText'),
      },
    );
  } catch {
    return;
  }
  delete process.flowsByVersion[getProcessVersionKey(version)];
  delete process.versionStatusByVersion?.[getProcessVersionKey(version)];
  processMetaChanged.value = true;
  const remainingVersions = getDisplayVersionNumbers().filter(item => item !== version);
  if (editingVersion.value === version) {
    loadVersion(remainingVersions[0] || getEnabledProcessVersion(process) || 1);
  }
}

const handleVersionCommand = async (command: string) => {
  if (command === 'create') {
    await handleCreateVersion();
    return;
  }
  if (command === 'copy') {
    await handleCopyVersion();
    return;
  }
  if (command === 'copy-to-form') {
    await openCopyToFormDialog();
    return;
  }
  if (command === 'manage') {
    versionManagerVisible.value = true;
    return;
  }
  if (command.startsWith('switch:')) {
    await switchVersion(Number(command.replace('switch:', '')));
  }
}

const handleVersionDropdownVisibleChange = (visible: boolean) => {
  versionDropdownVisible.value = visible;
}

watch(versionManagerVisible, (visible) => {
  if (visible) {
    refreshVersionDeleteStates();
  }
})

onBeforeUnmount(() => {
  invalidatePendingAiFlowPatchTransactions();
})

defineExpose({
  get processChanged() {
    return processChanged.value;
  },
  get currentFlowIssueState() {
    return currentFlowIssueState.value;
  },
  get runtimeFlowIssueVerdict() {
    return runtimeFlowIssueVerdict.value;
  },
  init,
  clear() {
    invalidatePendingAiFlowPatchTransactions();
    branch.value?.destroy();
    branch.value = null;
    canvasChanged.value = false;
    structureChanged.value = false;
    processMetaChanged.value = false;
    savedProcessSnapshot.value = null;
    runtimeFlowIssueState.value = null;
    runtimeFlowIssueStateSettled.value = false;
    editingVersion.value = 1;
    versionManagerVisible.value = false;
    versionDeleteStateMap.value = {};
    persistedVersions.value = [];
  },
  async save(options?: { skipValidation?: boolean }) {
    const valid = await validateEditingDraftFlows();
    if (!options?.skipValidation && !valid) {
      throw new Error(i18next.t('FormProcess.processSaveIncompleteTips'));
    }
    const flowIssueState = !valid
      ? inspectRuntimeFlowIssueState({
        currentTable: table.value,
        tables: formData.value?.tables || [],
        formFields: formFields.value,
        currentFlows: getCurrentDraftFlows(),
        organizeData,
        isEditableSystemField: isAiFlowSummaryEditableSystemField,
        isFieldRendered: isAiFlowSummaryFieldRendered,
      })
      : null;
    persistCurrentDraft();
    return {
      ok: true,
      flowIssueState: (flowIssueState || null) as NocodeEditorAiFlowIssueState | null,
    };
  },
  markSaved() {
    const process = ensureProcessStructure();
    syncPersistedVersions(process);
    savedProcessSnapshot.value = cloneDeep(process || ensureProcessStructure());
    canvasChanged.value = false;
    structureChanged.value = false;
    processMetaChanged.value = false;
  },
  getAiFlowSummary() {
    return buildAiFlowSummary({
      currentTable: table.value,
      tables: formData.value?.tables || [],
      formFields: formFields.value,
      currentFlows: getCurrentDraftFlows(),
      organizeData,
      editingVersion: editingVersion.value,
      currentVersionStatus: currentVersionStatus.value,
      resolveTableFields: getAiFlowSummaryTableFields,
      isEditableSystemField: isAiFlowSummaryEditableSystemField,
      isFieldRendered: isAiFlowSummaryFieldRendered,
    });
  },
  validateAiFlowPlan(input: { plan: unknown }) {
    if (!table.value) {
      throw new Error('当前未找到表单信息');
    }
    const startedAt = Date.now();
    const result = buildAppliedAiFlowPlan({
      plan: input?.plan,
      currentTable: table.value,
      tables: formData.value?.tables || [],
      formFields: formFields.value,
      organizeData,
      isEditableSystemField: isAiFlowSummaryEditableSystemField,
      isFieldRendered: isAiFlowSummaryFieldRendered,
    });
    const finishedAt = Date.now();
    return {
      ok: true,
      startedAt,
      finishedAt,
      compilable: true,
      validation: {
        status: 'passed',
        compilable: true,
        summary: '当前流程规划已通过流程 dry-run 校验。',
        validatedAt: finishedAt,
        diagnostics: [],
      },
      summary: result.summary,
      warnings: result.warnings,
    };
  },
  async applyAiFlowPlan(input: { plan: unknown }) {
    if (!table.value) {
      throw new Error(i18next.t('FormProcess.currentFormNotFound'));
    }
    if (isAiFlowPatchPending.value) {
      throw new Error('流程局部修改正在保存，请稍后再应用完整流程蓝图');
    }
    if (isApplyingAiFlow.value) {
      throw new Error(i18next.t('FormProcess.aiApplyingFlowWait'));
    }
    const startedAt = Date.now();
    const result = buildAppliedAiFlowPlan({
      plan: input?.plan,
      currentTable: table.value,
      tables: formData.value?.tables || [],
      formFields: formFields.value,
      organizeData,
      isEditableSystemField: isAiFlowSummaryEditableSystemField,
      isFieldRendered: isAiFlowSummaryFieldRendered,
    });
    isApplyingAiFlow.value = true;
    allowAiStructureMutation.value = true;
    try {
      await ensureEditableVersionForAiApply();
      await applyAiFlowPlanStepByStep(result.flows);
      canvasChanged.value = true;
      structureChanged.value = true;
      return {
        ok: true,
        startedAt,
        finishedAt: Date.now(),
        summary: result.summary,
        warnings: result.warnings,
        flowIssueState: result.flowIssueState || null,
      };
    } finally {
      allowAiStructureMutation.value = false;
      isApplyingAiFlow.value = false;
    }
  },
  async applyAiFlowPatch(input: { patch: NocodeEditorFlowPatch }) {
    if (pendingAiFlowPatchTransactions.size > 0) {
      throw new NocodeEditorFlowPatchError(
        'flow_patch_conflict',
        '已有流程局部修改正在保存，请等待当前事务完成',
      );
    }
    let snapshot: NocodeEditorFlowPatchVersionMutationSnapshot | undefined;
    try {
      const process = ensureProcessStructure();
      const snapshotProcess = cloneDeep(process);
      snapshotProcess.flowsByVersion[getProcessVersionKey(editingVersion.value)] = getCurrentDraftFlows();
      snapshot = createNocodeEditorFlowPatchMutationSnapshot({
        process: snapshotProcess,
        editingVersion: editingVersion.value,
        canvasChanged: canvasChanged.value,
        structureChanged: structureChanged.value,
        processMetaChanged: processMetaChanged.value,
      });

      const patch = input.patch;
      const currentFormId = String(table.value?.uid || '');
      if (!currentFormId || patch.target.formId !== currentFormId) {
        throw new NocodeEditorFlowPatchError(
          'flow_patch_target_ambiguous',
          '流程局部修改目标与当前表单不一致',
          { currentFormId, targetFormId: patch.target.formId },
        );
      }
      if (patch.target.processVersion !== editingVersion.value) {
        throw new NocodeEditorFlowPatchError(
          'flow_patch_conflict',
          '流程版本已发生变化，请重新读取流程摘要',
          {
            currentProcessVersion: editingVersion.value,
            targetProcessVersion: patch.target.processVersion,
          },
        );
      }

      const sourceFlows = getCurrentDraftFlows();
      const currentFingerprint = buildNocodeEditorFlowFingerprint({
        processVersion: editingVersion.value,
        flows: sourceFlows,
      });
      if (patch.target.flowFingerprint !== currentFingerprint) {
        throw new NocodeEditorFlowPatchError(
          'flow_patch_conflict',
          '流程已发生变化，请重新读取流程摘要',
          { currentFingerprint, targetFingerprint: patch.target.flowFingerprint },
        );
      }

      const candidate = executeNocodeEditorFlowPatch({
        flows: sourceFlows,
        patch,
        compileNode: compileInput => compileAiFlowPatchNode({
          ...compileInput,
          currentTable: table.value,
          tables: formData.value?.tables || [],
          formFields: formFields.value,
          organizeData,
          isEditableSystemField: isAiFlowSummaryEditableSystemField,
          isFieldRendered: isAiFlowSummaryFieldRendered,
        }),
      });
      normalizeFlowReferenceOptions(candidate.flows);
      const versionFlowsValid = validateVersionFlows(candidate.flows);
      const flowIssueState = inspectRuntimeFlowIssueState({
        currentFlows: candidate.flows,
        currentTable: table.value,
        tables: formData.value?.tables || [],
        formFields: formFields.value,
        organizeData,
        isEditableSystemField: isAiFlowSummaryEditableSystemField,
        isFieldRendered: isAiFlowSummaryFieldRendered,
      });
      if (!versionFlowsValid || flowIssueState) {
        throw new NocodeEditorFlowPatchError(
          'flow_patch_validation_failed',
          flowIssueState?.summary || '流程局部修改后的配置未通过完整校验',
          { flowIssueState },
        );
      }

      const prepared = prepareNocodeEditorFlowPatchVersionMutation({
        process: snapshot.process,
        sourceVersion: editingVersion.value,
        patchedFlows: candidate.flows,
      });
      formOption.value.process = prepared.process;
      editingVersion.value = prepared.draftVersion;
      createBranch(createEditableFlows(prepared.draftVersion));
      canvasChanged.value = true;
      structureChanged.value = true;
      processMetaChanged.value = true;

      const mutationId = `flow-patch-${Date.now()}-${++aiFlowPatchMutationSequence}`;
      const appliedFingerprint = buildNocodeEditorFlowFingerprint({
        processVersion: prepared.draftVersion,
        flows: candidate.flows,
      });
      const result: NocodeEditorFlowPatchResult = {
        ok: true,
        formId: currentFormId,
        ...(String(table.value?.alias || '').trim()
          ? { formName: String(table.value?.alias || '').trim() }
          : {}),
        sourceVersion: prepared.sourceVersion,
        draftVersion: prepared.draftVersion,
        createdDraftVersion: prepared.createdDraftVersion,
        ...(prepared.activeVersion === undefined ? {} : { activeVersion: prepared.activeVersion }),
        activeVersionUnchanged: prepared.activeVersionUnchanged,
        appliedOperations: candidate.appliedOperations,
        warnings: [],
      };
      pendingAiFlowPatchTransactions.set(mutationId, snapshot);
      pendingAiFlowPatchContext = {
        mutationId,
        formId: currentFormId,
        generation: aiFlowPatchContextGeneration,
        draftVersion: prepared.draftVersion,
        appliedFingerprint,
      };
      isAiFlowPatchPending.value = true;
      return { mutationId, result };
    } catch (error) {
      if (snapshot) {
        restoreAiFlowPatchSnapshot(snapshot);
      }
      throw error;
    }
  },
  finalizeAiFlowPatch(input: { mutationId: string }) {
    if (
      pendingAiFlowPatchContext?.mutationId !== input.mutationId
      || pendingAiFlowPatchContext.generation !== aiFlowPatchContextGeneration
      || !pendingAiFlowPatchTransactions.has(input.mutationId)
    ) {
      return false;
    }
    pendingAiFlowPatchTransactions.delete(input.mutationId);
    pendingAiFlowPatchContext = null;
    isAiFlowPatchPending.value = false;
    return true;
  },
  rollbackAiFlowPatch(input: { mutationId: string }) {
    const snapshot = pendingAiFlowPatchTransactions.get(input.mutationId);
    if (!snapshot) {
      return false;
    }
    const currentFormId = String(table.value?.uid || '');
    const liveAppliedFingerprint = buildNocodeEditorFlowFingerprint({
      processVersion: editingVersion.value,
      flows: getCurrentDraftFlows(),
    });
    const rollbackCurrent = isAiFlowPatchRollbackCurrent({
      mutationId: input.mutationId,
      formId: currentFormId,
      generation: aiFlowPatchContextGeneration,
      draftVersion: editingVersion.value,
      appliedFingerprint: liveAppliedFingerprint,
    });
    if (!rollbackCurrent) {
      invalidatePendingAiFlowPatchTransactions();
      return false;
    }
    restoreAiFlowPatchSnapshot(snapshot);
    pendingAiFlowPatchTransactions.delete(input.mutationId);
    pendingAiFlowPatchContext = null;
    isAiFlowPatchPending.value = false;
    return true;
  },
  async viewAiFlowPatchResult(input: { draftVersion: number; nodeKey?: string }) {
    const draftVersion = input?.draftVersion;
    if (
      !Number.isInteger(draftVersion)
      || draftVersion <= 0
      || !hasProcessVersion(formOption.value.process, draftVersion)
    ) {
      return false;
    }
    await switchVersion(draftVersion);
    await nextTick();
    if (input.nodeKey) {
      await flowEditorRef.value?.keepNodeInView?.(input.nodeKey);
    }
    return true;
  },
  focusAiFlowIssue,
})

onMounted(async () => {
  await organizeUtil.getDepartments()
  await organizeUtil.getAllUsers()
  await organizeUtil.getUsers()
  await organizeUtil.getRoles()

  organizeData.departments = organizeUtil.departments
  organizeData.roles = organizeUtil.roles
  organizeData.users = organizeUtil.allUsers
})
</script>

<style lang='scss' scoped>
.form-process {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: black;
  height: 100%;
  position: relative;
  background: #eeeeee;

  &:focus-visible {
    outline: none;
  }

  .process-toolbar {
    position: absolute;
    top: 18px;
    right: 20px;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 0;
    background: transparent;
    border: 0;
    backdrop-filter: none;
  }

  .process-structure-tip {
    position: absolute;
    top: 18px;
    left: 20px;
    z-index: 20;
    font-size: 14px;
    width: fit-content;
    background-color: rgb(255, 251, 232);
    color: var(--el-color-warning);
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 4px;

    span {
      line-height: 22px;
    }

    .menu-icon {
      margin-right: 4px;
    }
  }

  .version-trigger {
    min-width: 200px;
    max-width: 320px;
    height: 32px;
    border-radius: 8px;
    border: 1px solid #e8edf4;
    background: rgba(255, 255, 255, 0.98);
    padding: 5px 8px;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(31, 35, 41, 0.08);
    color: #394557;
    transition: box-shadow 0.2s ease, border-color 0.2s ease;

    &:hover {
      border-color: #d8e2ee;
      box-shadow: 0 14px 30px rgba(31, 35, 41, 0.1);
    }

    &__title {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      line-height: 22px;
      min-width: 0;
      flex: 1;
    }

    &__name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #FAAD14;
      box-shadow: 0 0 0 4px rgba(246, 179, 26, 0.16);

      &.is-enabled {
        background-color: #52C41A;
        box-shadow: 0 0 0 4px rgba(22, 119, 255, 0.14);
      }

      &.is-history {
        background-color: #96a0af;
        box-shadow: 0 0 0 4px rgba(150, 160, 175, 0.16);
      }
    }

    &__status {
      height: 16px;
      padding: 4px;
      border-radius: 2px;
      font-size: 12px;
      line-height: 20px;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;

      &.is-designing {
        color: #FAAD14;
        background: #F4FFE8;
      }

      &.is-enabled {
        color: #ffffff;
        background: #52C41A;
      }

      &.is-history {
        color: #7f8898;
        background: #f3f5f7;
      }
    }

    &__icon {
      color: #98a2b3;
      flex-shrink: 0;
      transition: transform 0.2s ease;

      &.is-open {
        transform: rotate(180deg);
      }
    }

    &__action {
      flex-shrink: 0;

      &.el-button {
        height: 16px;
        margin: 0;
        font-size: 12px;
      }

      &.is-enable.el-button {
        padding: 0 4px;
        border: 0;
        border-radius: 4px;
        --el-button-bg-color: #0873FF;
        --el-button-border-color: #0873FF;
        --el-button-hover-bg-color: #4096ff;
        --el-button-hover-border-color: #4096ff;
        --el-button-active-bg-color: #0666e0;
        --el-button-active-border-color: #0666e0;
      }

      &.is-disable.el-button {
        padding: 0;
        color: #F77234;
      }
    }
  }

  .canvas {
    &.is-applying-ai-flow {
      pointer-events: none;
    }
  }

  .canvas {
    flex: 1;
    height: 100%;
    width: 100%;
  }
}
</style>

<style lang="scss">
.process-version-dropdown.el-dropdown__popper {
  border: 0 !important;
  background: transparent;
  box-shadow: none !important;

  .el-popper__arrow {
    display: none !important;
  }

  .el-dropdown-menu {
    padding: 4px !important;
    width: 300px;
    border-radius: 8px;
    overflow: hidden;
    background: #ffffff;
    border: 1px solid #e8edf4;
    box-shadow: 0 18px 40px rgba(31, 35, 41, 0.12);
  }

  .process-version-dropdown__list {

    .el-scrollbar__view {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  }

  .process-version-dropdown__item.el-dropdown-menu__item {
    display: flex !important;
    height: 32px;
    width: 100% !important;
    min-width: 0;
    line-height: normal;
    box-sizing: border-box;
    padding: 5px 12px;
    margin: 0;
    border-radius: 4px;
    align-items: stretch;

    &:hover {
      background-color: var(--bg-color-hover)
    }

    &.is-editing {
      background: #eaf4ff;

      .process-version-dropdown__left {
        color: #0873FF !important;
      }
    }


    .process-version-dropdown__row {
      width: 100%;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0;

      .process-version-dropdown__meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .process-version-dropdown__left {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        overflow: hidden;
        color: #3d495a;
        font-size: 14px;
        min-width: 0;

        >span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .process-version-dropdown__status {
        flex-shrink: 0;
        height: 16px;
        border-radius: 2px;
        padding: 4px;
        border: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        line-height: 20px;

        &.is-designing {
          color: #FAAD14;
          background: #F4FFE8;
        }

        &.is-enabled {
          color: #ffffff;
          background: #52C41A;
        }

        &.is-history {
          color: #7f8898;
          background: #f3f5f7;
        }

        &.is-enable-action {
          display: none;
          appearance: none;
          color: #ffffff;
          background: #0873FF;
          cursor: pointer;
        }

        &.is-disable-action {
          appearance: none;
          color: #F77234;
          background: transparent;
          cursor: pointer;
        }
      }
    }

    &:hover {
      .process-version-dropdown__status.is-disable-action,
      .process-version-dropdown__status.is-enable-action {
        display: inline-flex;
      }
    }

  }

  .process-version-dropdown__divider {
    height: 1px;
    background: #edf1f6;
    margin: 4px 0;
  }

  .process-version-dropdown__footer {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .process-version-dropdown__action.el-dropdown-menu__item {
    height: 32px;
    border-radius: 4px;
    padding: 5px 14px !important;
    color: #4a5565;
    font-size: 15px;
    font-weight: 500;
    display: flex;
    align-items: center;

    &:hover {
      background: #edf2f7;
      color: #1677ff;
    }

    .process-version-dropdown__action-icon {
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-right: 10px;
      color: inherit;
    }
  }

}
</style>
