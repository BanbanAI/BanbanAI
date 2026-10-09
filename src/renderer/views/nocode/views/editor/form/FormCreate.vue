<template>
  <div ref="formCreateRootRef" class="form-create">
    <el-container class="form-create__container">
      <vn-stack class="stack" v-model="activeTab" :before-leave="isBeforeLeave">
        <el-header v-if="!props.embedded">
          <div :class="['title', { 'is-changed': isChanged}]">
            <el-icon @click="goBack" v-if="false"><i-ep-arrowLeftBold /></el-icon>
            <el-button class="expand-button" text @click.stop="emit('update:sidebarFolded', false)" v-if="sidebarFolded">
              <el-icon :size="16">
                <i-workbench-horizontal-unfold />
              </el-icon>
            </el-button>
            <div class="title-text">
              <span :title="table?.alias">{{ table?.alias }}</span>
            </div>
          </div>
          <div class="menus-tab">
            <div class="tab-parents">
              <vn-stack-tab class="item-tab" v-for="item in tabData" :name="item.id">
                <span class="item-tab__label">
                  {{ item.label }}
                  <span
                    v-if="(item.id === 'form-design' && hasFormDraftIssues) || (item.id === 'process-setting' && hasProcessDraftIssues)"
                    class="item-tab__warning-dot"
                  ></span>
                </span>
              </vn-stack-tab>
              <div class="setting-tab-container">
                <div class="setting-tab" @click="emit('open-setting')">{{ $t('formCreate.appSet') }}</div>
              </div>
            </div>
          </div>
          <div class="menus">
            <el-radio-group size="small" v-model="previewPlatform" v-if="false">
              <el-radio-button v-for="item in ProjectPreviewPlatform" :key="item" :value="item">
                <el-icon :size="16">
                  <i-ep-monitor v-if="item === ProjectPreviewPlatform.PC"></i-ep-monitor>
                  <i-ep-iphone v-else></i-ep-iphone>
                </el-icon>
              </el-radio-button>
            </el-radio-group>
            <el-button size="small" @click="preview" v-if="activeTab === 'form-design'">
              <el-icon size="16"><i-ven-form-preview /></el-icon>
              <span>{{ $t('formCreate.preview') }}</span>
            </el-button>
            <el-button class="save" size="small" @click="save()">{{ $t('formCreate.save') }}</el-button>
            <el-button class="publish" type="success" size="small" @click="handlePublish">{{ $t('formCreate.published') }}</el-button>
          </div>
        </el-header>
        <vn-stack-layer class="layer" :class="{ embedded: props.embedded }" name="form-design" :lazy="true">
          <form-designer
            ref="formDesignerRef"
            @save="save(true, true)"
            :field-catalog-visible="props.fieldCatalogVisible"
            :property-panel-visible="props.propertyPanelVisible"
            :blueprint-applying-readonly="props.blueprintApplyingReadonly"
            @update:field-catalog-visible="emit('update:field-catalog-visible', $event)"
            @update:property-panel-visible="emit('update:property-panel-visible', $event)"
          />
        </vn-stack-layer>
        <vn-stack-layer class="layer" :class="{ embedded: props.embedded }" name="process-setting" :lazy="true">
          <form-process
            ref="formProcessRef"
            :active="activeTab === 'process-setting'"
            :ai-flow-issue-state="props.aiFlowIssueState || null"
          ></form-process>
        </vn-stack-layer>
        <vn-stack-layer class="layer" :class="{ 'displayReminder': displayReminder, embedded: props.embedded }" name="data-management" :lazy="true">
          <div class="kind-reminder" v-if="displayReminder">
            <div class="kind-reminder-container">
              <span class="text">{{ $t('formCreate.dataManageTip') }}</span>
              <el-button link>
                <el-icon :size="16" class="close" @click="closeKindReminder">
                  <i-ep-close></i-ep-close>
                </el-icon>
              </el-button>
            </div>
          </div>
          <DataManagementV2
            :active="activeTab === 'data-management'"
            :uid="table?.uid || ''"
          />
        </vn-stack-layer>
      </vn-stack>
      <form-preview v-model="previewDrawerVisible"></form-preview>
    </el-container>
  </div>
</template>

<script lang='ts' setup>
import { Connection, Table, ProjectPreviewPlatform, FormOption, ProcessVersionStatus, SettingTab } from '@common/types/project';
import { ref, reactive, computed, inject, nextTick, watch, onBeforeUnmount } from 'vue';
import { provideFormData, provideFormOption, provideFormTable } from './hooks';
import { useMagicKeys, whenever } from '@vueuse/core';
import { and, or } from '@vueuse/math';
import { deepClone, isEmpty } from '@common/utils/object';
import { unique } from '@common/utils/unique';
import { ElMessage, ElLoading } from 'element-plus';
import { HANDLE_SYNC_FORM_TABLE, NOCODE } from '@renderer/types';
import { AggregateTable, NocodeFormData } from '@common/types/nocode';
import type { NocodeEditorFlowPatch } from '@common/utils/nocodeEditorFlowPatch';
import { provideRuntime } from '@renderer/utils';
import { FormTableRuntime } from "@common/types/nocode";
import { formDataManagerTipStore } from '@renderer/utils';
import i18next from 'i18next';
import DataManagementV2 from './DataManagementV2.vue';
import {
  resolvePersistedFormDesignIssues,
  summarizeFormDesignValidationIssues,
} from './designValidation';
import { resolveFormSaveLoadingTarget } from './formSaveLoadingTarget';
import { buildBlueprintDraftPersistenceState } from '../ai/blueprintDraftSaveState';
import {
  isDraftPersistenceStateDraftOnly,
  resolveRefreshedDraftPersistenceState,
  shouldBlockNavigationForDraftPersistenceState,
} from '../ai/draftIssueActionList';
import {
  canContinueAfterNavigationPersistence,
  resolveNavigationPersistenceWithoutLocalChanges,
  resolveNavigationPersistenceFeedback,
} from '../navigationPersistence';
import type {
  NocodeEditorAiDraftActionIssue,
  NocodeEditorAiDraftSaveOptions,
  NocodeEditorAiDraftPersistenceState,
  NocodeEditorAiDraftIssueLocateResult,
  NocodeEditorAiFlowActionIssue,
  NocodeEditorAiFlowIssueState,
  NocodeEditorAiFlowIssueLocateResult,
  NocodeEditorNavigationPersistenceIntent,
  NocodeEditorNavigationPersistenceResult,
} from '../ai/types';
import type { FormDesignValidationIssue } from './designValidation';
const nocode = inject(NOCODE);
const handleSyncFormTable = inject(HANDLE_SYNC_FORM_TABLE) as ((formData: NocodeFormData, table: Table, save?: boolean, options?: { preserveAiDraftState?: boolean; beforeWrite?: () => void }) => Promise<NocodeFormData | undefined>) | undefined
const aiDraftDirty = inject('nocode-editor-ai-draft-dirty', ref(false))
const aiDraftPersistenceState = inject('nocode-editor-ai-draft-status', ref<NocodeEditorAiDraftPersistenceState | null>(null))

const props = withDefaults(defineProps<{
  save: (formData: NocodeFormData, table: Table, noMessage?: boolean) => Promise<boolean | void>,
  sidebarFolded: boolean,
  embedded?: boolean,
  fieldCatalogVisible?: boolean,
  propertyPanelVisible?: boolean,
  blueprintApplyingReadonly?: boolean,
  visibleTab?: 'form-design' | 'process-setting' | 'data-management',
  aiFlowIssueState?: NocodeEditorAiFlowIssueState | null,
}>(), {
  embedded: false,
  fieldCatalogVisible: true,
  propertyPanelVisible: true,
  blueprintApplyingReadonly: false,
});

const emit = defineEmits<{
  (event: "exit-form-mode", voluntary?: boolean),
  (event: "renameTable", status: 'success' | 'error'),
  (event: 'update-nocode'): void,
  (event: 'update-table', tables: Table[]),
  (event: "open-setting", settingTab?: SettingTab);
  (event: "update:sidebarFolded", isHide: boolean): void;
  (event: "update:field-catalog-visible", visible: boolean): void;
  (event: "update:property-panel-visible", visible: boolean): void;
  (event: 'active-tab-change', tab: string): void;
  (event: 'draft-persistence-state-change', state: NocodeEditorAiDraftPersistenceState | null): void;
}>();

const { Ctrl_S, Meta_S} = useMagicKeys({
  passive: false,
  onEventFired(e) {
    //阻止一些浏览器或客户端中默认的功能
    if (e.type === "keydown") {

      const _ctrl_s = ((e.ctrlKey || e.metaKey) && e.key === "s");
      const _meta_s = (e.metaKey && e.key === "s");
      if(_ctrl_s || _meta_s){
        e.preventDefault();
      }
    }
  }
});

const previewPlatform = ref(ProjectPreviewPlatform.PC);
const formData = ref<NocodeFormData>();
const originTable = ref<Table>();
const formCreateRootRef = ref<HTMLElement | null>(null);
const hasLocalChanges = computed(() => Boolean(formDesignerRef.value?.formChanged || formProcessRef.value?.processChanged));
const isChanged = computed(() => hasLocalChanges.value || aiDraftDirty.value);
const getPersistedFormDesignIssues = (): FormDesignValidationIssue[] => {
  return resolvePersistedFormDesignIssues(aiDraftPersistenceState.value);
}

const getCurrentAiDraftPersistenceSource = () => ({
  sourceTraceId: aiDraftPersistenceState.value?.sourceTraceId,
  sourceBlueprintIdentityKey: aiDraftPersistenceState.value?.sourceBlueprintIdentityKey,
  sourceBlueprintVersionKey: aiDraftPersistenceState.value?.sourceBlueprintVersionKey,
});

const buildSavedFormDraftPersistenceState = (
  issues: FormDesignValidationIssue[] = [],
): NocodeEditorAiDraftPersistenceState | null => {
  if (!issues.length) {
    return null;
  }
  return buildBlueprintDraftPersistenceState({
    ok: true,
    persistedToSession: true,
    persistedToApp: true,
    hasBlockingIssues: true,
    issues,
    summary: summarizeFormDesignValidationIssues(issues).summary,
    ...getAiDraftFormContext(),
  }, {
    dirty: false,
    ...getCurrentAiDraftPersistenceSource(),
  });
}

const hasDirtyDraftPersistenceState = () => (
  Boolean(
    isDraftPersistenceStateDraftOnly(aiDraftPersistenceState.value)
    && aiDraftPersistenceState.value?.dirty !== false
  )
)

const closeNavigationPersistenceMessage = () => {
  return
}

const showNavigationPersistenceMessage = (
  type: 'success' | 'warning' | 'error',
  message: string,
) => {
  ElMessage({
    type,
    message,
  });
}
// 是否显示温馨提示
const displayReminder = ref(!formDataManagerTipStore.get());

// 该table是与nocode强关联的，确保不会丢失响应式
const table = computed(() => {
  return nocode.value?.body?.formData?.tables?.find(t => t.uid === originTable.value?.uid);
})

type FormSaveResult = 'saved' | 'unchanged' | 'blocked' | 'failed'
const isFormalSaveAllowed = (result: FormSaveResult) => result === 'saved' || result === 'unchanged'

const previewDrawerVisible = ref(false);
const emitDraftPersistenceStateChange = (state: NocodeEditorAiDraftPersistenceState | null) => {
  emit('draft-persistence-state-change', state);
}
const hasBlockingDraftPersistenceIssues = computed(() => (
  shouldBlockNavigationForDraftPersistenceState(aiDraftPersistenceState.value)
))
const hasFormDraftIssues = computed(() => (
  hasDirtyDraftPersistenceState()
  && Boolean(aiDraftPersistenceState.value?.actionIssues?.some(issue => issue.targetKind === 'form_field'))
))
const hasProcessDraftIssues = computed(() => (
  hasDirtyDraftPersistenceState()
  && Boolean(aiDraftPersistenceState.value?.actionIssues?.some(issue => issue.targetKind === 'process_node'))
))
const currentFlowIssueState = computed(() => formProcessRef.value?.currentFlowIssueState || null)
const flowIssueRuntimeVerdict = computed(() => formProcessRef.value?.runtimeFlowIssueVerdict || null)
type EditorTab = 'form-design' | 'process-setting' | 'data-management'
const resolveVisibleEditorTab = (): EditorTab => {
  if (props.visibleTab && ['form-design', 'process-setting', 'data-management'].includes(props.visibleTab)) {
    return props.visibleTab;
  }
  if (['form-design', 'process-setting', 'data-management'].includes(activeTab.value)) {
    return activeTab.value as EditorTab;
  }
  return 'form-design';
}
const preview = async() => {
  if (isChanged.value) {
    const result = await save(true)
    if (!isFormalSaveAllowed(result)) {
      return
    }
  }
  previewDrawerVisible.value = true;
}
const persistForNavigation = async (
  intent: NocodeEditorNavigationPersistenceIntent = 'exit_editor',
): Promise<NocodeEditorNavigationPersistenceResult> => {
  if (!hasLocalChanges.value) {
    const result = resolveNavigationPersistenceWithoutLocalChanges({
      draftPersistenceState: aiDraftPersistenceState.value,
      intent,
    });
    emitDraftPersistenceStateChange(result.draftPersistenceState || null);
    return result;
  }

  try {
    const draftResult = await saveAiDraft({
      skipProcessValidation: intent === 'internal_switch',
      persistToApp: intent === 'exit_editor',
    });
    if (!draftResult.ok || !draftResult.persistedToSession) {
      return {
        mode: 'failed',
        reason: 'draft_sync_failed',
        message: draftResult.error || i18next.t('formCreate.draftSyncFailed'),
        draftPersistenceState: null,
      };
    }

    if (intent === 'internal_switch') {
      if (draftResult.hasBlockingIssues) {
        const draftPersistenceState = buildBlueprintDraftPersistenceState(draftResult, {
          ...getCurrentAiDraftPersistenceSource(),
        });
        emitDraftPersistenceStateChange(draftPersistenceState);
        return {
          mode: 'draft_only',
          draftPersistenceState,
          flowIssueState: draftResult.flowIssueState || null,
        };
      }
      return {
        mode: 'unchanged',
        draftPersistenceState: null,
        flowIssueState: draftResult.flowIssueState || null,
      };
    }

    if (draftResult.hasBlockingIssues) {
      const draftPersistenceState = buildBlueprintDraftPersistenceState(draftResult, {
        ...getCurrentAiDraftPersistenceSource(),
      });
      emitDraftPersistenceStateChange(draftPersistenceState);
      return {
        mode: 'draft_only',
        draftPersistenceState,
      };
    }

    const result = await save(true);
    if (isFormalSaveAllowed(result)) {
      return {
        mode: result,
        draftPersistenceState: null,
      };
    }

    return {
      mode: 'failed',
      reason: 'formal_save_failed',
      message: i18next.t('formCreate.formalSaveFailed'),
      draftPersistenceState: null,
    };
  } catch (error) {
    return {
      mode: 'failed',
      reason: 'draft_sync_failed',
      message: error instanceof Error ? error.message : i18next.t('formCreate.draftSyncFailed'),
      draftPersistenceState: null,
    };
  }
}
const goBack = async (showChangeTip = true) => {
  if (showChangeTip) {
    closeNavigationPersistenceMessage();
    const result = await persistForNavigation('exit_editor');
    const feedback = resolveNavigationPersistenceFeedback(result);
    if (!canContinueAfterNavigationPersistence(result)) {
      showNavigationPersistenceMessage('error', feedback.message);
      return false;
    }
    if (feedback.toastType === 'success') {
      showNavigationPersistenceMessage('success', feedback.message);
    } else if (result.mode === 'draft_only') {
      const draftIssueCount = Number(result.draftPersistenceState?.issueCount || 0);
      const exitMessage = draftIssueCount > 0
        ? i18next.t('formCreate.savedWithIncompleteFieldConfig', { count: draftIssueCount })
        : i18next.t('formCreate.savedWithPendingConfig');
      showNavigationPersistenceMessage('error', exitMessage);
    } else if (feedback.toastType === 'warning') {
      showNavigationPersistenceMessage('warning', feedback.message);
    }
  }
  await clear();
  formData.value = undefined;
  originTable.value = undefined;
  return true;
}

const isBeforeLeave = async (name: string) => {
  const currentTab = resolveVisibleEditorTab();
  if (currentTab === name) {
    if (activeTab.value !== name) {
      activeTab.value = name;
    }
    return true;
  }
  if (isChanged.value) {
    return isFormalSaveAllowed(await save(true));
  }
  return true;
}

const switchEditorTab = async (
  tab: EditorTab,
  options?: { skipBeforeLeave?: boolean },
) => {
  if (resolveVisibleEditorTab() === tab) {
    if (activeTab.value !== tab) {
      activeTab.value = tab;
    }
    return true;
  }
  if (!['form-design', 'process-setting', 'data-management'].includes(tab)) return false;
  if (options?.skipBeforeLeave) {
    activeTab.value = tab;
    return true;
  }
  const isLeave = await isBeforeLeave(tab);
  if (!isLeave) {
    return false;
  }
  activeTab.value = tab;
  return true;
}

const switchAiEditorTab = async (tab: 'form-design' | 'process-setting') => {
  if (activeTab.value === tab) {
    return true;
  }
  if (!await isBeforeLeave(tab)) {
    return false;
  }
  if (activeTab.value !== tab) {
    activeTab.value = tab;
    await nextTick();
  }
  return true;
}

const restoreFormDesignValidationErrors = async () => {
  if (activeTab.value !== 'form-design') return [];
  const persistedIssues = getPersistedFormDesignIssues();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await nextTick();
    const restoredIssues = formDesignerRef.value?.restoreDesignValidationErrors?.(persistedIssues) || [];
    console.log('[design-validation][form-create][restore]', {
      activeTab: activeTab.value,
      attempt,
      persistedIssueCount: persistedIssues.length,
      restoredIssueCount: restoredIssues.length,
    });
    if (restoredIssues.length > 0 || persistedIssues.length === 0) {
      return restoredIssues;
    }
  }
  const fallbackIssues = formDesignerRef.value?.restoreDesignValidationErrors?.() || [];
  console.log('[design-validation][form-create][restore-fallback]', {
    activeTab: activeTab.value,
    persistedIssueCount: persistedIssues.length,
    restoredIssueCount: fallbackIssues.length,
  });
  if (fallbackIssues.length > 0) {
    return fallbackIssues;
  }
  return [];
}

const restoreSavedFormDraftPersistenceState = async () => {
  if (hasDirtyDraftPersistenceState() && hasLocalChanges.value) {
    return aiDraftPersistenceState.value;
  }
  await nextTick();
  let issues = formDesignerRef.value?.getDesignValidationIssues?.() || [];
  for (let attempt = 0; attempt < 3 && issues.length === 0; attempt += 1) {
    await nextTick();
    issues = formDesignerRef.value?.getDesignValidationIssues?.() || [];
  }
  const nextState = buildSavedFormDraftPersistenceState(issues);
  emitDraftPersistenceStateChange(nextState);
  return nextState;
}

const handlePublish = async () => {
  const result = await save(true);
  if (!isFormalSaveAllowed(result)) {
    return
  }
  emit('open-setting', SettingTab.PUBLISH)
}

const closeKindReminder = async () => { 
  formDataManagerTipStore.set(true);
  displayReminder.value = false;
}

const formDesignerRef = ref();
const formProcessRef = ref();

const getDefaultFormOption = (): FormOption => {
  return {
    widget: {
      uid: unique(),
      type: 'widget.form.form',
      name: i18next.t('formCreate.dataForm'),
      widgets: [],
    },
    process: {
      enabled: false,
      flowsByVersion: {},
      versionStatusByVersion: {
        v1: ProcessVersionStatus.DESIGNING,
      },
      version: 1,
    }
  }
}
const formOptions = computed(() => formData.value?.formOptions);
const formOption = ref(getDefaultFormOption());

const init = async () => {
  const origin = formOptions.value?.[originTable.value?.uid];
  const isFirstCreate = isEmpty(origin);
  if (!isFirstCreate) {
    formOption.value = deepClone(origin);
  }
  await formDesignerRef.value?.init(formOption.value.widget, isFirstCreate);
  formProcessRef.value?.init();
  await restoreFormDesignValidationErrors();
  formDesignerRef.value?.resetChangeTracking?.();
  cancelAiDraftPersistenceRefresh();
  await restoreSavedFormDraftPersistenceState();
}

const clear = async () => {
  cancelAiDraftPersistenceRefresh();
  formOption.value = getDefaultFormOption();
  await formDesignerRef.value?.clear();
  await formProcessRef.value?.clear();
  if (activeTab.value !== "data-management") {
    activeTab.value = 'form-design';
  }
}
const getOptions = () => {
  const options = formOptions.value || {};
  options[originTable.value.uid] = formOption.value;
  return options;
};
const saveForm = async () => {
  const formOptions = getOptions();
  const connection = await formDesignerRef.value.save(formOptions);
  return connection;
}
const saveFormDraft = async (options?: { beforeWrite?: () => void }) => {
  const formOptions = getOptions();
  return await formDesignerRef.value.saveDraft(formOptions, {
    beforeWrite: options?.beforeWrite,
  });
}
const getCurrentFormIdentity = () => table.value?.uid || originTable.value?.uid || ''
const getAiDraftFormContext = () => ({
  formId: table.value?.uid || originTable.value?.uid || '',
  formLabel: table.value?.alias || originTable.value?.alias || '',
})
const saveProcess = async (_connection = formData.value) => {
  await formProcessRef.value?.save();
  _connection.formOptions = getOptions();
  return _connection;
}
const saveProcessForAiDraft = async (_connection = formData.value) => {
  const result = await formProcessRef.value?.save?.({
    skipValidation: true,
  });
  _connection.formOptions = getOptions();
  return {
    formData: _connection,
    flowIssueState: result?.flowIssueState || null,
  };
}
const save = async (noMessage = false, noLoading = false): Promise<FormSaveResult> => {
  if (!hasLocalChanges.value && !aiDraftDirty.value) {
    !noMessage && ElMessage.info(i18next.t('formCreate.noSave'))
    return 'unchanged'
  };

    const loadingInstance = noLoading ? null : ElLoading.service({
      text: i18next.t('formCreate.saving'),
      target: resolveFormSaveLoadingTarget(formCreateRootRef.value),
    });
    let result: FormSaveResult = 'saved';
    let _formData = formData.value;
    if (formDesignerRef.value?.formChanged) {
      _formData = await saveForm();
      if (!_formData) {
        if (loadingInstance) {
          loadingInstance.close();
        }
        return 'blocked';
      }
    } 
    if (formProcessRef.value?.processChanged) {
      try {
        _formData = await saveProcess(_formData);
      } catch (err) {
        !noMessage && ElMessage.error(err.message);
        activeTab.value = 'process-setting';
        result = 'failed';
      }
    }
    if (result === 'saved') {
      const saved = await props.save(_formData, table.value, noMessage);
      formProcessRef.value?.markSaved?.();
      if (saved === false) {
        result = 'failed';
      }
    }
    if (result === 'saved' || result === 'unchanged') {
      emitDraftPersistenceStateChange(null);
    }
    if (loadingInstance) {
      loadingInstance.close();
    }
    return result;

}

const saveAiDraft = async (options: AiDraftSaveOptions = {}) => {
  const refreshGuard = options.refreshGuard
  assertAiDraftPersistenceRefreshActive(refreshGuard)
  const formContext = getAiDraftFormContext()
  const shouldPersistToApp = Boolean(options.persistToApp)
  if (!hasLocalChanges.value) {
    return {
      ok: true,
      persistedToSession: true,
      persistedToApp: shouldPersistToApp,
      hasBlockingIssues: false,
      issues: [],
      ...formContext,
    }
  }

  if (!table.value) {
    throw new Error(i18next.t('formCreate.formInfoMissing'))
  }
  if (!handleSyncFormTable) {
    throw new Error(i18next.t('formCreate.formDraftSyncUnavailable'))
  }

  const issues = formDesignerRef.value?.getDesignValidationIssues?.() || []
  let flowIssueState = null
  const beforeRefreshWrite = refreshGuard
    ? () => assertAiDraftPersistenceRefreshActive(refreshGuard)
    : undefined
  let _formData = formData.value
  if (formDesignerRef.value?.formChanged) {
    assertAiDraftPersistenceRefreshActive(refreshGuard)
    _formData = await saveFormDraft({
      beforeWrite: beforeRefreshWrite,
    })
    assertAiDraftPersistenceRefreshActive(refreshGuard)
  }
  if (formProcessRef.value?.processChanged) {
    try {
      assertAiDraftPersistenceRefreshActive(refreshGuard)
      if (options.skipProcessValidation) {
        const processDraftResult = await saveProcessForAiDraft(_formData)
        _formData = processDraftResult.formData
        flowIssueState = processDraftResult.flowIssueState || null
      } else {
        _formData = await saveProcess(_formData)
      }
      assertAiDraftPersistenceRefreshActive(refreshGuard)
    } catch (err) {
      assertAiDraftPersistenceRefreshActive(refreshGuard)
      activeTab.value = 'process-setting'
      throw err
    }
  }
  assertAiDraftPersistenceRefreshActive(refreshGuard)
  const syncedFormData = await handleSyncFormTable(_formData, table.value, shouldPersistToApp, {
    preserveAiDraftState: shouldPersistToApp,
    beforeWrite: beforeRefreshWrite,
  })
  assertAiDraftPersistenceRefreshActive(refreshGuard)
  if (!syncedFormData) {
    return {
      ok: false,
      persistedToSession: false,
      persistedToApp: false,
      hasBlockingIssues: issues.length > 0,
      issues,
      flowIssueState,
      error: 'AI draft sync failed',
      ...formContext,
    }
  }
  const hasBlockingDraft = issues.length > 0 || flowIssueState?.mode === 'flow_issue'
  if (shouldPersistToApp && !hasBlockingDraft) {
    formDesignerRef.value?.resetChangeTracking?.()
    formProcessRef.value?.markSaved?.()
    aiDraftDirty.value = false
    emitDraftPersistenceStateChange(null)
  }
  const summary = summarizeFormDesignValidationIssues(issues).summary
  return {
    ok: true,
    persistedToSession: true,
    persistedToApp: shouldPersistToApp,
    hasBlockingIssues: issues.length > 0,
    issues,
    flowIssueState,
    summary,
    ...formContext,
  }
}

type AiDraftPersistenceRefreshOptions = {
  expectedFormId?: string
  expectedChangeRevision?: number
  expectedGeneration?: number
  requireDraftOnly?: boolean
}
type AiDraftPersistenceRefreshGuard = {
  generation: number
  formId: string
  changeRevision?: number
  requireDraftOnly: boolean
}
type AiDraftSaveOptions = NocodeEditorAiDraftSaveOptions & {
  refreshGuard?: AiDraftPersistenceRefreshGuard
}
const STALE_AI_DRAFT_REFRESH_ERROR = 'stale_ai_draft_refresh'
let formCreateUnmounted = false;
let aiDraftPersistenceRefreshGeneration = 0
const getCurrentFormChangeRevision = () => formDesignerRef.value?.changeRevision
const createAiDraftPersistenceRefreshGuard = (
  options: AiDraftPersistenceRefreshOptions,
): AiDraftPersistenceRefreshGuard => ({
  generation: typeof options.expectedGeneration === 'number'
    ? options.expectedGeneration
    : aiDraftPersistenceRefreshGeneration,
  formId: options.expectedFormId || getCurrentFormIdentity(),
  changeRevision: typeof options.expectedChangeRevision === 'number'
    ? options.expectedChangeRevision
    : getCurrentFormChangeRevision(),
  requireDraftOnly: Boolean(options.requireDraftOnly),
})
const isStaleAiDraftPersistenceRefresh = (guard: AiDraftPersistenceRefreshGuard) => {
  if (formCreateUnmounted) return true;
  if (guard.generation !== aiDraftPersistenceRefreshGeneration) return true;
  if (guard.requireDraftOnly && aiDraftPersistenceState.value?.mode !== 'draft_only') return true;
  if (guard.formId && getCurrentFormIdentity() !== guard.formId) return true;
  if (
    typeof guard.changeRevision === 'number'
    && getCurrentFormChangeRevision() !== guard.changeRevision
  ) {
    return true;
  }
  return false;
}
const createStaleAiDraftPersistenceRefreshError = () => new Error(STALE_AI_DRAFT_REFRESH_ERROR)
const isStaleAiDraftPersistenceRefreshError = (error: unknown) => (
  error instanceof Error && error.message === STALE_AI_DRAFT_REFRESH_ERROR
)
const assertAiDraftPersistenceRefreshActive = (
  guard?: AiDraftPersistenceRefreshGuard,
) => {
  if (guard && isStaleAiDraftPersistenceRefresh(guard)) {
    throw createStaleAiDraftPersistenceRefreshError()
  }
}

let aiDraftRevisionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
const clearAiDraftRevisionRefreshTimer = () => {
  if (!aiDraftRevisionRefreshTimer) return;
  clearTimeout(aiDraftRevisionRefreshTimer);
  aiDraftRevisionRefreshTimer = null;
}
const cancelAiDraftPersistenceRefresh = () => {
  aiDraftPersistenceRefreshGeneration += 1
  clearAiDraftRevisionRefreshTimer()
}

const refreshAiDraftPersistenceState = async (options?: AiDraftPersistenceRefreshOptions) => {
  const refreshOptions = options || {};
  const refreshGuard = createAiDraftPersistenceRefreshGuard(refreshOptions);
  let draftResult;
  try {
    assertAiDraftPersistenceRefreshActive(refreshGuard)
    draftResult = await saveAiDraft({ refreshGuard });
  } catch (error) {
    const draftRefreshError = isStaleAiDraftPersistenceRefreshError(error)
      ? STALE_AI_DRAFT_REFRESH_ERROR
      : error instanceof Error ? error.message : String(error);
    return {
      draftResult: {
        ok: false,
        persistedToSession: false,
        hasBlockingIssues: hasBlockingDraftPersistenceIssues.value,
        issues: aiDraftPersistenceState.value?.issues || [],
        error: draftRefreshError,
      },
      draftPersistenceState: aiDraftPersistenceState.value || null,
      draftRefreshError,
      draftRefreshOk: false,
    };
  }
  if (!draftResult.ok || !draftResult.persistedToSession) {
    return {
      draftResult,
      draftPersistenceState: aiDraftPersistenceState.value || null,
      draftRefreshError: draftResult.error || 'AI draft sync failed',
      draftRefreshOk: false,
    };
  }
  if (isStaleAiDraftPersistenceRefresh(refreshGuard)) {
    return {
      draftResult,
      draftPersistenceState: aiDraftPersistenceState.value || null,
      draftRefreshError: STALE_AI_DRAFT_REFRESH_ERROR,
      draftRefreshOk: false,
    };
  }
  const nextState = resolveRefreshedDraftPersistenceState({
    currentState: aiDraftPersistenceState.value,
    draftResult,
    resolvedAt: Date.now(),
    sourceTraceId: aiDraftPersistenceState.value?.sourceTraceId,
    sourceBlueprintIdentityKey: aiDraftPersistenceState.value?.sourceBlueprintIdentityKey,
    sourceBlueprintVersionKey: aiDraftPersistenceState.value?.sourceBlueprintVersionKey,
  });
  if (isStaleAiDraftPersistenceRefresh(refreshGuard)) {
    return {
      draftResult,
      draftPersistenceState: aiDraftPersistenceState.value || null,
      draftRefreshError: STALE_AI_DRAFT_REFRESH_ERROR,
      draftRefreshOk: false,
    };
  }
  emitDraftPersistenceStateChange(nextState);
  return {
    draftResult,
    draftPersistenceState: nextState,
    draftRefreshOk: true,
  };
}

const scheduleAiDraftRevisionRefresh = (revision?: number) => {
  cancelAiDraftPersistenceRefresh();
  if (isDraftPersistenceStateDraftOnly(aiDraftPersistenceState.value)) {
    const revisionFormId = getCurrentFormIdentity();
    const revisionChangeRevision = typeof revision === 'number'
      ? revision
      : getCurrentFormChangeRevision();
    const revisionGeneration = aiDraftPersistenceRefreshGeneration;
    if (!revisionFormId) return;
    aiDraftRevisionRefreshTimer = setTimeout(async () => {
      aiDraftRevisionRefreshTimer = null;
      if (!isDraftPersistenceStateDraftOnly(aiDraftPersistenceState.value)) return;
      const currentFormId = getCurrentFormIdentity();
      if (currentFormId !== revisionFormId) return;
      if (
        typeof revisionChangeRevision === 'number'
        && formDesignerRef.value?.changeRevision !== revisionChangeRevision
      ) {
        return;
      }
      await refreshAiDraftPersistenceState({
        expectedFormId: revisionFormId,
        expectedChangeRevision: revisionChangeRevision,
        expectedGeneration: revisionGeneration,
        requireDraftOnly: true,
      });
    }, 700);
  }
}

watch(
  () => formDesignerRef.value?.changeRevision,
  (revision, previousRevision) => {
    if (!revision || revision === previousRevision) return;
    scheduleAiDraftRevisionRefresh(revision);
  },
)

watch(
  () => aiDraftPersistenceState.value?.mode,
  () => {
    if (!isDraftPersistenceStateDraftOnly(aiDraftPersistenceState.value)) {
      cancelAiDraftPersistenceRefresh();
    }
  },
)

watch(
  () => table.value?.uid || originTable.value?.uid,
  () => {
    cancelAiDraftPersistenceRefresh();
  },
)

onBeforeUnmount(() => {
  closeNavigationPersistenceMessage();
  formCreateUnmounted = true;
  cancelAiDraftPersistenceRefresh();
})

const ensureAiFormDesignTab = async () => {
  if (activeTab.value === 'form-design') {
    return true;
  }
  if (activeTab.value === 'process-setting' && formProcessRef.value?.processChanged) {
    return false;
  }
  if (activeTab.value === 'form-design' && formDesignerRef.value?.formChanged) {
    return false;
  }
  return await switchAiEditorTab('form-design');
}

const ensureAiProcessTab = async () => {
  if (activeTab.value === 'process-setting') {
    return true;
  }
  return await switchAiEditorTab('process-setting');
}

const focusAiDraftIssue = async (
  issue: NocodeEditorAiDraftActionIssue,
): Promise<NocodeEditorAiDraftIssueLocateResult> => {
  if (issue.targetKind !== 'form_field') {
    return {
      ok: false,
      reason: 'unsupported_target',
      message: i18next.t('formCreate.unsupportedDraftIssueLocate'),
    };
  }
  if (!await ensureAiFormDesignTab()) {
    return {
      ok: false,
      reason: 'tab_switch_blocked',
      message: i18next.t('formCreate.switchFormTabBlocked'),
    };
  }
  const formIssue = issue.formDesignIssue || {
    widgetId: issue.locator.widgetId || issue.targetId,
    widgetType: '',
    fieldName: issue.targetLabel,
    code: issue.code as any,
    message: issue.message,
    blockingSave: false,
  };
  const focused = await formDesignerRef.value?.focusDesignValidationIssue?.(formIssue, {
    optionPath: issue.locator.optionPath,
  });
  return focused
    ? { ok: true }
    : {
      ok: false,
      reason: 'target_not_found',
      message: i18next.t('formCreate.fieldTargetNotFound'),
    };
}

const focusAiFlowIssue = async (
  issue: NocodeEditorAiFlowActionIssue,
): Promise<NocodeEditorAiFlowIssueLocateResult> => {
  if (!await ensureAiProcessTab()) {
    return {
      ok: false,
      reason: 'tab_switch_blocked',
      message: i18next.t('formCreate.switchProcessTabBlocked'),
    };
  }
  return await formProcessRef.value?.focusAiFlowIssue?.(issue) || {
    ok: false,
    reason: 'runtime_unavailable',
    message: i18next.t('formCreate.processEditorNotReady'),
  };
}

const applyForExitFormMode = async (showChangeTip = true) => {
  const isExited = await goBack(showChangeTip);
  if (!isExited) {
    return false;
  }
  activeTab.value = 'form-design';
  emit("exit-form-mode");
  return true;
}

const closeForm = async () => {
  setTimeout(async() => {
    const isExited = await goBack();
    if (!isExited) return;
    emit("exit-form-mode", true);
  }, 200)
}

whenever(and(or(Meta_S, Ctrl_S)), () => {
  if (!formData.value || !originTable.value) return;
  save();
});

defineExpose({
  async applyForEnterFormMode(_formData: NocodeFormData, _table: Table, askSave = true) {
    let isCheck = true;
    let nextFormData = _formData;
    if (originTable.value?.uid === _table?.uid) {
      formData.value = _formData;
      if (activeTab.value === 'form-design') {
        await restoreFormDesignValidationErrors();
      }
      await restoreSavedFormDraftPersistenceState();
      return true;
    }
    if (askSave && isChanged.value) {
      closeNavigationPersistenceMessage();
      const result = await persistForNavigation('exit_editor');
      const feedback = resolveNavigationPersistenceFeedback(result);
      isCheck = canContinueAfterNavigationPersistence(result);
      if (!isCheck) {
        showNavigationPersistenceMessage('error', feedback.message);
      } else {
        if (feedback.toastType === 'success') {
          showNavigationPersistenceMessage('success', feedback.message);
        } else if (feedback.toastType === 'warning') {
          showNavigationPersistenceMessage('warning', feedback.message);
        }
        if (result.mode === 'saved') {
          nextFormData = formData.value;
        }
      }
    }
    if (!isCheck) {
      return false;
    }
    await clear();
    formData.value = nextFormData;
    originTable.value = _table;
    await init();
    return true
  },
  applyForExitFormMode,
  async syncConnection(_connection: NocodeFormData) {
    if (_connection.uid === formData.value?.uid) {
      formData.value = _connection;
    }
  },
  syncAggregateTables(aggregateTables: AggregateTable[]) {
    if (!formData.value) return;
    formData.value.aggregateTables = aggregateTables;
  },
  get isChanged() {
    return isChanged.value;
  },
  get hasLocalChanges() {
    return hasLocalChanges.value;
  },
  get currentFlowIssueState() {
    return currentFlowIssueState.value;
  },
  get flowIssueRuntimeVerdict() {
    return flowIssueRuntimeVerdict.value;
  },
  get activeTab() {
    return activeTab.value;
  },

  preview,
  save,
  saveAiDraft,
  refreshAiDraftPersistenceState,
  persistForNavigation,
  focusAiDraftIssue,
  focusAiFlowIssue,
  getAiEditorContext() {
    return {
      activeTab: activeTab.value,
      tableId: originTable.value?.uid || '',
      tableName: table.value?.alias || '',
      dirty: {
        form: Boolean(formDesignerRef.value?.formChanged),
        process: Boolean(formProcessRef.value?.processChanged),
      }
    };
  },
  async switchAiTab(tab: 'form-design' | 'process-setting') {
    if (tab !== 'form-design' && tab !== 'process-setting') return false;
    return await switchAiEditorTab(tab);
  },
  async switchEditorTab(
    tab: 'form-design' | 'process-setting' | 'data-management',
    options?: { skipBeforeLeave?: boolean },
  ) {
    return await switchEditorTab(tab, options);
  },
  async restoreDesignValidationErrors() {
    return await restoreFormDesignValidationErrors();
  },
  openRecycleBin() {
    formDesignerRef.value?.openRecycleBin?.();
  },
  async getAiFormSummary() {
    if (!await ensureAiFormDesignTab()) {
      throw new Error(i18next.t('formCreate.switchFormTabFailed'));
    }
    return await formDesignerRef.value?.getAiFormSummary?.();
  },
  async getAiDefaultFormulaTaskContext() {
    if (!await ensureAiFormDesignTab()) {
      throw new Error(i18next.t('formCreate.switchFormTabFailed'));
    }
    return await formDesignerRef.value?.getAiDefaultFormulaTaskContext?.();
  },
  async openAiFormulaPanel(input: { widgetId: string }) {
    if (!await ensureAiFormDesignTab()) {
      throw new Error(i18next.t('formCreate.switchFormTabFailed'));
    }
    return await formDesignerRef.value?.openAiFormulaPanel?.(input);
  },
  async getAiFlowSummary() {
    if (!await ensureAiProcessTab()) {
      throw new Error(i18next.t('formCreate.switchProcessTabFailed'));
    }
    return await formProcessRef.value?.getAiFlowSummary?.();
  },
  async validateAiFlowPlan(input: { plan: unknown }) {
    if (!await ensureAiProcessTab()) {
      throw new Error('无法切换到流程设计页');
    }
    return await formProcessRef.value?.validateAiFlowPlan?.(input);
  },
  async applyAiFlowPlan(input: { plan: unknown }) {
    if (!await ensureAiProcessTab()) {
      throw new Error(i18next.t('formCreate.switchProcessTabFailed'));
    }
    return await formProcessRef.value?.applyAiFlowPlan?.(input);
  },
  async applyAiFlowPatch(input: { patch: NocodeEditorFlowPatch }) {
    if (!await ensureAiProcessTab()) {
      throw new Error('无法切换到流程设计页');
    }
    return await formProcessRef.value?.applyAiFlowPatch?.(input);
  },
  async finalizeAiFlowPatch(input: { mutationId: string }): Promise<boolean> {
    if (!await ensureAiProcessTab()) {
      throw new Error('无法切换到流程设计页');
    }
    return await formProcessRef.value?.finalizeAiFlowPatch?.(input) === true;
  },
  async rollbackAiFlowPatch(input: { mutationId: string }) {
    if (!await ensureAiProcessTab()) {
      throw new Error('无法切换到流程设计页');
    }
    return await formProcessRef.value?.rollbackAiFlowPatch?.(input);
  },
  async viewAiFlowPatchResult(input: { draftVersion: number; nodeKey?: string }) {
    if (!await ensureAiProcessTab()) {
      throw new Error('无法切换到流程设计页');
    }
    return await formProcessRef.value?.viewAiFlowPatchResult?.(input);
  },
  async getAiWidgetOptionSchema(input: { widgetId: string }) {
    if (!await ensureAiFormDesignTab()) {
      throw new Error(i18next.t('formCreate.switchFormTabFailed'));
    }
    return await formDesignerRef.value?.getAiWidgetOptionSchema?.(input);
  },
  async getAiWidgetOptionChoices(input: { widgetId: string; optionKey?: string; optionPath?: string[] }) {
    if (!await ensureAiFormDesignTab()) {
      throw new Error(i18next.t('formCreate.switchFormTabFailed'));
    }
    return await formDesignerRef.value?.getAiWidgetOptionChoices?.(input);
  },
  async addAiFields(input: { fields: Array<Record<string, any>> }) {
    if (!await ensureAiFormDesignTab()) {
      throw new Error(i18next.t('formCreate.switchFormTabFailed'));
    }
    return await formDesignerRef.value?.addAiFields?.(input);
  },
  async replaceAiField(input: { widgetId: string; widgetType: string; name?: string }) {
    if (!await ensureAiFormDesignTab()) {
      throw new Error(i18next.t('formCreate.switchFormTabFailed'));
    }
    return await formDesignerRef.value?.replaceAiField?.(input);
  },
  async setAiFieldOptions(input: { widgetId: string; changes: Array<Record<string, any>> }) {
    if (!await ensureAiFormDesignTab()) {
      throw new Error(i18next.t('formCreate.switchFormTabFailed'));
    }
    return await formDesignerRef.value?.setAiFieldOptions?.(input);
  },
})
provideFormData(formData);
provideFormTable(table);
provideFormOption(formOption);
provideRuntime(FormTableRuntime.FORM_EDITOR);
const activeTab = ref('form-design');
const tabData = reactive([
  {
    get label() { return i18next.t('formCreate.formDesign') },
    id: 'form-design'
  },
  {
    get label() { return i18next.t('formCreate.flowDesign') },
    id: 'process-setting'
  },
  {
    get label() { return i18next.t('formCreate.dataManage') },
    id: 'data-management'
  }
])

watch(activeTab, async (value, previousValue) => {
  emit('active-tab-change', value);
  if (value === 'form-design' && previousValue && previousValue !== 'form-design') {
    await restoreFormDesignValidationErrors();
  }
}, {
  immediate: true,
})

</script>

<style lang='scss' scoped>
.form-create {
  background-color: var(--bg-color-page);
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;

  .form-create__container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .stack {
    height: 100%;

    .el-header {
      padding: 0 16px 0 12px;
      height: 40px;
      display: flex;
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
  
        .el-icon {
          cursor: pointer;
        }

        .title-text {
          margin-left: 4px;
        }
  
        span {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;

        }

        .expand-button {
          padding: 0;
          width: 32px;
          border-radius: 4px;
        }
        
       &.is-changed {
        position: relative;
          &::after {
            content: "";
            position: absolute;
            width: 7px;
            height: 7px;
            background-color: orange;
            border-radius: 50%;
            right: -10px;
            top: -4px;
          }
        }
      }
  
      .menus-tab {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        .tab-parents {
          display: flex;
          align-items: center;
  
          .item-tab {
            width: 56px;
            height: 40px;
            margin-right: 16px;
            gap: 10px;
            border-bottom-width: 4px;
            display: flex;
            justify-content: center;
            align-items: center;
            
            font-weight: 500;
            font-size: 14px;
            line-height: 20px;
            letter-spacing: 0%;
            border-bottom: #228bfc00 4px solid;
            transition: all 0.2s ease;
            cursor: pointer;
  
            &:hover {
              color: #228CFC;
            }
  
            &.active {
              border-bottom: #228CFC 4px solid;
              color: #228CFC;
            }

            .item-tab__label {
              position: relative;
              display: inline-flex;
              align-items: center;
            }

            .item-tab__warning-dot {
              position: absolute;
              right: -10px;
              top: 2px;
              width: 6px;
              height: 6px;
              border-radius: 50%;
              background: #fa8c16;
              box-shadow: 0 0 0 2px #fff;
            }

          }

          .setting-tab-container {
            margin-left: 16px;

            .setting-tab {
              padding-left: 32px;
              height: 12px;
              display: flex;
              justify-content: center;
              align-items: center;
              
              font-weight: 500;
              font-size: 14px;
              line-height: 20px;
              letter-spacing: 0%;
              border-left: #d9d9d9 1px solid;
              padding-bottom: 4px;
              transition: all 0.2s ease;
              cursor: pointer;
              // background-color: blue;
    
              &:hover {
                color: #228CFC;
              }
            }
          }

            
        }
      }
  
      .menus {
        display: flex;

        .el-button {
          border-radius: 2px;
          width: 56px;
          height: 24px;
          transition: 0s;
        }
  
        :deep(.el-radio-group) {
          .el-radio-button {
            margin: 0;
            --el-button-bg-color: transparent;
  
            &.is-active {
              --el-radio-button-checked-bg-color: #313e51;
              --el-radio-button-checked-border-color: var(--el-radio-button-checked-bg-color);
            }
  
            .el-radio-button__inner {
              width: 38px;
              height: 24px;
              border: none;
              border-radius: 2px;
              display: flex;
              justify-content: center;
              align-items: center;
  
              .el-icon {
                color: #A7ABBD;
              }
            }
          }
        }
        .preview {
          span {
            font-size: 12px;
            .preview-icon {
              margin-right: 4px;
            }
          }
        }
      }
    }
    .layer {
      height: calc(100% - 40px);

      &.embedded {
        height: 100%;
      }

      &.displayReminder {
        height: calc(100% - 100px);

        &.embedded {
          height: calc(100% - 60px);
        }
      }
    }
    .kind-reminder {
      padding: 16px 16px 0 16px;
      .kind-reminder-container {
        width: 100%;
        height: 44px;
        padding: 0 8px;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: rgba($color: #FAAD14, $alpha: 0.15);
        .text {
          font-size: 14px;
          color: var(--el-color-danger);
        }
      }
    }
  }
}

:deep(.setting-drawer-body) {
  padding: 0px;
  margin: 0px;
}
</style>
