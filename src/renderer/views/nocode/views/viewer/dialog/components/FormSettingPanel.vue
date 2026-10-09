<template>
  <view-drawer-panel @close="handleClose" @cancel="handleCancel" @confirm="handleConfirm">
    <div class="form-setting-panel">
      <div class="form-setting-panel-title">
        <div class="label">{{ $t("FormSettingPanel.viewName") }}</div>
        <div class="value">
          <el-input v-model="viewName" type="text" :placeholder="$t('FormSettingPanel.viewNamePlaceholder')" />
        </div>
      </div>
      <div class="form-setting-panel-main">
        <vn-stack v-model="activeMenu">
          <div class="tabs">
            <vn-stack-tab
              v-for="item in settingMenus"
              :key="item.name"
              class="tab-item"
              :class="{ active: activeMenu === item.name }"
              :name="item.name"
              @click="activeMenu = item.name"
            >
              <span>{{ item.label }}</span>
            </vn-stack-tab>
          </div>
          <vn-stack-layer name="basic" class="layer-item">
            <el-scrollbar class="layer-scrollbar">
              <div class="setting-group">
                <div class="setting-subtitle">{{ $t("FormSettingPanel.basicMenu") }}</div>
                <div class="setting-row">
                  <div class="setting-label">
                    <span class="label-with-tip">
                      <span>{{ $t("FormSettingPanel.successMode") }}</span>
                      <el-icon class="label-tip-icon" :size="16" :title="$t('FormSettingPanel.successModeTip')">
                        <i-ant-design-question-circle-outlined />
                      </el-icon>
                    </span>
                  </div>
                  <div class="setting-value">
                    <el-select v-model="draftConfig.submitBehavior.successMode" placement="bottom-end">
                      <el-option value="successPage" :label="$t('FormSettingPanel.successModeSuccessPage')+''" />
                      <el-option value="resetForm" :label="$t('FormSettingPanel.successModeResetForm')+''" />
                      <el-option value="keepCurrentContent" :label="$t('FormSettingPanel.successModeKeepCurrentContent')+''" />
                    </el-select>
                  </div>
                </div>
                <div v-if="draftConfig.submitBehavior.successMode === 'successPage'" class="setting-row">
                  <div class="setting-label">{{ $t("FormSettingPanel.submitSuccessText") }}</div>
                  <div class="setting-value">
                    <el-input
                      v-model="draftConfig.submitBehavior.successText"
                      :placeholder="$t('FormSettingPanel.submitSuccessTextPlaceholder')"
                    />
                  </div>
                </div>
                <div class="setting-subtitle">{{ $t("FormSettingPanel.buttonMenu") }}</div>
                <div class="button-setting-list">
                  <div class="button-setting-item">
                    <div class="setting-row switch-row button-setting-switch">
                      <div class="setting-label">{{ $t("FormSettingPanel.submitVisible") }}</div>
                      <el-switch v-model="draftConfig.buttons.submit.visible" />
                    </div>
                    <div v-if="draftConfig.buttons.submit.visible" class="button-setting-input">
                      <div class="setting-value">
                        <el-input v-model="draftConfig.buttons.submit.label" :placeholder="$t('FormSettingPanel.submitLabelPlaceholder')" />
                      </div>
                    </div>
                  </div>
                  <div class="button-setting-item">
                    <div class="setting-row switch-row button-setting-switch">
                      <div class="setting-label">{{ $t("FormSettingPanel.saveDraftVisible") }}</div>
                      <el-switch v-model="draftConfig.buttons.saveDraft.visible" />
                    </div>
                    <div v-if="draftConfig.buttons.saveDraft.visible" class="button-setting-input">
                      <div class="setting-value">
                        <el-input v-model="draftConfig.buttons.saveDraft.label" :placeholder="$t('FormSettingPanel.saveDraftLabelPlaceholder')" />
                      </div>
                    </div>
                  </div>
                  <div class="button-setting-item">
                    <div class="setting-row switch-row button-setting-switch">
                      <div class="setting-label">{{ $t("FormSettingPanel.continuousSubmitVisible") }}</div>
                      <el-switch v-model="draftConfig.buttons.continuousSubmit.visible" :disabled="isKeepCurrentContentMode" />
                    </div>
                    <div v-if="draftConfig.buttons.continuousSubmit.visible" class="button-setting-input">
                      <div class="setting-value">
                        <el-input v-model="draftConfig.buttons.continuousSubmit.label" :placeholder="$t('FormSettingPanel.continuousSubmitLabelPlaceholder')" />
                      </div>
                    </div>
                  </div>
                  <div v-if="draftConfig.buttons.continuousSubmit.visible" class="button-setting-item">
                    <div class="setting-row switch-row button-setting-switch">
                      <div class="setting-label">{{ $t("FormSettingPanel.continuousSubmitDefaultChecked") }}</div>
                      <el-switch v-model="draftConfig.buttons.continuousSubmit.defaultChecked" :disabled="isKeepCurrentContentMode" />
                    </div>
                  </div>
                  <div v-if="draftConfig.buttons.continuousSubmit.visible" class="button-setting-item">
                    <div class="setting-row switch-row button-setting-switch">
                      <div class="setting-label">
                        <span class="label-with-tip">
                          <span>{{ $t("FormSettingPanel.saveCurrentContentVisible") }}</span>
                          <el-icon class="label-tip-icon" :size="16" :title="$t('FormSettingPanel.saveCurrentContentVisibleTip')">
                            <i-ant-design-question-circle-outlined />
                          </el-icon>
                        </span>
                      </div>
                      <el-switch v-model="draftConfig.buttons.saveCurrentContent.visible" :disabled="isKeepCurrentContentMode" />
                    </div>
                    <div v-if="draftConfig.buttons.saveCurrentContent.visible" class="button-setting-input">
                      <div class="setting-value">
                        <el-input v-model="draftConfig.buttons.saveCurrentContent.label" :placeholder="$t('FormSettingPanel.saveCurrentContentLabelPlaceholder')" />
                      </div>
                    </div>
                  </div>
                  <div v-if="draftConfig.buttons.continuousSubmit.visible && draftConfig.buttons.saveCurrentContent.visible" class="button-setting-item">
                    <div class="setting-row switch-row button-setting-switch">
                      <div class="setting-label">{{ $t("FormSettingPanel.saveCurrentContentDefaultChecked") }}</div>
                      <el-switch v-model="draftConfig.buttons.saveCurrentContent.defaultChecked" :disabled="isKeepCurrentContentMode" />
                    </div>
                  </div>
                  <div v-if="draftConfig.submitBehavior.successMode === 'successPage'" class="button-setting-item">
                    <div class="setting-row switch-row button-setting-switch">
                      <div class="setting-label">{{ $t("FormSettingPanel.viewDataVisible") }}</div>
                      <el-switch v-model="draftConfig.buttons.viewDataAfterSubmit.visible" />
                    </div>
                    <div v-if="draftConfig.buttons.viewDataAfterSubmit.visible" class="button-setting-input">
                      <div class="setting-value">
                        <el-input v-model="draftConfig.buttons.viewDataAfterSubmit.label" :placeholder="$t('FormSettingPanel.viewDataLabelPlaceholder')" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </el-scrollbar>
          </vn-stack-layer>
          <vn-stack-layer name="autoSubmit" class="layer-item">
            <el-scrollbar class="layer-scrollbar">
              <div class="setting-group">
                <div class="setting-row switch-row">
                  <div class="setting-label">{{ $t("FormSettingPanel.autoSubmitEnabled") }}</div>
                  <el-switch v-model="draftConfig.autoSubmit.enabled" />
                </div>
                <template v-if="draftConfig.autoSubmit.enabled && firstRule">
                  <div class="setting-row">
                    <div class="setting-label">{{ $t("FormSettingPanel.autoSubmitField") }}</div>
                    <div class="setting-value">
                      <el-select v-model="firstRule.fieldUid" :placeholder="$t('FormSettingPanel.autoSubmitFieldPlaceholder')" placement="bottom-end" :no-data-text="$t('FormSettingPanel.selectFieldNoData')">
                        <el-option v-for="field in availableAutoSubmitFields" :key="field.uid" :label="field.alias" :value="field.uid" />
                      </el-select>
                    </div>
                  </div>
                  <div class="setting-row switch-row">
                    <div class="setting-label">{{ $t("FormSettingPanel.autoSubmitFieldEnterSubmit") }}</div>
                    <el-switch v-model="firstRule.fieldEnterSubmit" />
                  </div>
                  <div
                    v-if="showAutoSubmitMobileScanSubmit"
                    class="setting-row switch-row"
                  >
                    <div class="setting-label">{{ $t("FormSettingPanel.autoSubmitMobileScanSubmit") }}</div>
                    <el-switch v-model="firstRule.mobileScanSubmit" />
                  </div>
                  <div class="setting-row switch-row">
                    <div class="setting-label">{{ $t("FormSettingPanel.autoSubmitRequireNonEmpty") }}</div>
                    <el-switch v-model="firstRule.requireNonEmpty" />
                  </div>
                  <div v-if="showAutoSubmitRequireChanged" class="setting-row switch-row">
                    <div class="setting-label">{{ $t("FormSettingPanel.autoSubmitRequireChanged") }}</div>
                    <el-switch v-model="firstRule.requireChanged" />
                  </div>
                </template>
              </div>
            </el-scrollbar>
          </vn-stack-layer>
        </vn-stack>
      </div>
    </div>
  </view-drawer-panel>
</template>

<script setup lang="ts">
import { Field, Table } from '@common/types/project';
import { FormAutoSubmitRule, FormViewConfig, Nocode, ViewSetting } from '@common/types/nocode';
import { FORM_DATA_VIEWER_EMITTER, NOCODE, NOCODE_SIGN_IS_LATEST, VIEW_ACTIVE_UID, VIEW_SETTING_DRAWER_CLOSE_GUARD, VIEW_SETTING_DRAWER_PANEL_STATE, VIEW_SETTING_DRAWER_REF } from '@renderer/types';
import { computed, inject, onMounted, onUnmounted, type PropType, Ref, ref, watch } from 'vue';
import { cloneDeep } from 'lodash';
import { deepClone, equals } from '@common/utils/object';
import i18next from 'i18next';
import { ElMessage, ElMessageBox } from 'element-plus';
import axios from 'axios';
import { Events } from '../../main/formDataViewerEmitter';
import { checkNocodeSyncBeforeRequest, handleNocodeSyncConflictError } from '@renderer/utils/nocodeSyncMessage';

type FormSettingDraft = Required<FormViewConfig> & {
  buttons: {
    submit: Required<NonNullable<FormViewConfig["buttons"]>["submit"]>,
    saveDraft: Required<NonNullable<FormViewConfig["buttons"]>["saveDraft"]>,
    continuousSubmit: Required<NonNullable<FormViewConfig["buttons"]>["continuousSubmit"]>,
    saveCurrentContent: Required<NonNullable<FormViewConfig["buttons"]>["saveCurrentContent"]>,
    viewDataAfterSubmit: Required<NonNullable<FormViewConfig["buttons"]>["viewDataAfterSubmit"]>,
  },
  submitBehavior: {
    successMode: "successPage" | "resetForm" | "keepCurrentContent",
    successText: string,
  },
  autoSubmit: {
    enabled: boolean,
    rules: FormAutoSubmitRule[],
  },
}

type KeepCurrentContentButtonStateBackup = {
  continuousSubmitVisible: boolean,
  continuousSubmitDefaultChecked: boolean,
  saveCurrentContentVisible: boolean,
  saveCurrentContentDefaultChecked: boolean,
} | null

const props = defineProps({
  currentView: {
    type: Object as PropType<ViewSetting | undefined>,
    default: undefined,
  },
  table: {
    type: Object as PropType<Table>,
    required: true,
  },
});

const nocode: Ref<Nocode> = inject(NOCODE);
const activeTab = inject(VIEW_ACTIVE_UID);
const formDataViewerEmitter = inject(FORM_DATA_VIEWER_EMITTER);
const viewSettingDrawerRef = inject(VIEW_SETTING_DRAWER_REF);
const viewSettingDrawerCloseGuard = inject(VIEW_SETTING_DRAWER_CLOSE_GUARD);
const viewSettingDrawerPanelState = inject(VIEW_SETTING_DRAWER_PANEL_STATE);
const nocodeSignIsLatest = inject(NOCODE_SIGN_IS_LATEST, null);

const settingMenus = [
  { name: "basic", get label() { return i18next.t("FormSettingPanel.basicMenu") } },
  { name: "autoSubmit", get label() { return i18next.t("FormSettingPanel.autoSubmitMenu") } },
];

const createAutoSubmitRuleId = () => `auto_submit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createDefaultRule = (): FormAutoSubmitRule => ({
  id: createAutoSubmitRuleId(),
  enabled: true,
  fieldScope: "mainForm",
  fieldEnterSubmit: true,
  mobileScanSubmit: false,
  requireChanged: true,
  requireNonEmpty: true,
});

function normalizeAutoSubmitRule(rule?: Partial<FormAutoSubmitRule>): FormAutoSubmitRule {
  const legacyTriggerType = (rule as FormAutoSubmitRule & { triggerType?: string } | undefined)?.triggerType;
  const fallbackFieldEnterSubmit = legacyTriggerType === "fieldEnter"
    || (rule?.fieldEnterSubmit === undefined && rule?.mobileScanSubmit === undefined);
  return {
    id: rule?.id || createAutoSubmitRuleId(),
    enabled: rule?.enabled ?? true,
    fieldUid: rule?.fieldUid,
    fieldScope: "mainForm",
    fieldEnterSubmit: rule?.fieldEnterSubmit ?? fallbackFieldEnterSubmit,
    mobileScanSubmit: rule?.mobileScanSubmit ?? false,
    requireChanged: rule?.requireChanged ?? true,
    requireNonEmpty: rule?.requireNonEmpty ?? true,
    blockWhenUploading: rule?.blockWhenUploading,
    blockWhenInvalid: rule?.blockWhenInvalid,
  };
}

function normalizeButtonDraftConfig(config: FormSettingDraft) {
  if (config.submitBehavior.successMode === "keepCurrentContent") {
    config.buttons.continuousSubmit.visible = true;
    config.buttons.continuousSubmit.defaultChecked = true;
    config.buttons.saveCurrentContent.visible = true;
    config.buttons.saveCurrentContent.defaultChecked = true;
    return config;
  }
  if (!config.buttons.continuousSubmit.visible) {
    config.buttons.continuousSubmit.defaultChecked = false;
    config.buttons.saveCurrentContent.visible = false;
    config.buttons.saveCurrentContent.defaultChecked = false;
    return config;
  }
  if (!config.buttons.saveCurrentContent.visible) {
    config.buttons.saveCurrentContent.defaultChecked = false;
  }
  return config;
}

const getStoredActiveMenu = () => {
  const storedMenu = viewSettingDrawerPanelState?.value?.activeMenu;
  return settingMenus.some((item) => item.name === storedMenu) ? storedMenu : "basic";
};

const createDefaultFormViewConfig = (value?: FormViewConfig): FormSettingDraft => {
  return normalizeButtonDraftConfig({
    buttons: {
      submit: {
        visible: value?.buttons?.submit?.visible ?? true,
        label: value?.buttons?.submit?.label ?? "",
        defaultChecked: false,
      },
      saveDraft: {
        visible: value?.buttons?.saveDraft?.visible ?? true,
        label: value?.buttons?.saveDraft?.label ?? "",
        defaultChecked: false,
      },
      continuousSubmit: {
        visible: value?.buttons?.continuousSubmit?.visible ?? true,
        label: value?.buttons?.continuousSubmit?.label ?? "",
        defaultChecked: value?.buttons?.continuousSubmit?.defaultChecked ?? false,
      },
      saveCurrentContent: {
        visible: value?.buttons?.saveCurrentContent?.visible ?? true,
        label: value?.buttons?.saveCurrentContent?.label ?? "",
        defaultChecked: value?.buttons?.saveCurrentContent?.defaultChecked ?? false,
      },
      viewDataAfterSubmit: {
        visible: value?.buttons?.viewDataAfterSubmit?.visible ?? true,
        label: value?.buttons?.viewDataAfterSubmit?.label ?? "",
        defaultChecked: false,
      },
    },
    submitBehavior: {
      successMode: value?.submitBehavior?.successMode ?? "successPage",
      successText: value?.submitBehavior?.successText ?? "",
    },
    autoSubmit: {
      enabled: value?.autoSubmit?.enabled ?? false,
      rules: value?.autoSubmit?.rules?.length
        ? deepClone(value.autoSubmit.rules).map((rule) => normalizeAutoSubmitRule(rule))
        : [createDefaultRule()],
    },
  });
};

const activeMenu = ref(getStoredActiveMenu());
const viewName = ref("");
const originViewName = ref("");
const draftConfig = ref<FormSettingDraft>(createDefaultFormViewConfig());
const originConfig = ref<FormSettingDraft>(createDefaultFormViewConfig());
const keepCurrentContentButtonStateBackup = ref<KeepCurrentContentButtonStateBackup>(null);

const isCurrent = computed(() => props.currentView?.type === "form" && activeTab.value === props.currentView?.uid);

const syncDrawerPanelState = () => {
  if (!viewSettingDrawerPanelState) return;
  if (!isCurrent.value) {
    viewSettingDrawerPanelState.value.activeMenu = null;
    return;
  }
  viewSettingDrawerPanelState.value.activeMenu = activeMenu.value;
};

const ensureFirstRule = () => {
  if (!draftConfig.value.autoSubmit.rules.length) {
    draftConfig.value.autoSubmit.rules = [createDefaultRule()];
  }
  return draftConfig.value.autoSubmit.rules[0];
};

const firstRule = computed<FormAutoSubmitRule | undefined>(() => draftConfig.value.autoSubmit.rules[0]);
const isKeepCurrentContentMode = computed(() => draftConfig.value.submitBehavior.successMode === "keepCurrentContent");

const createKeepCurrentContentButtonStateBackup = (config: FormSettingDraft): NonNullable<KeepCurrentContentButtonStateBackup> => ({
  continuousSubmitVisible: config.buttons.continuousSubmit.visible,
  continuousSubmitDefaultChecked: config.buttons.continuousSubmit.defaultChecked,
  saveCurrentContentVisible: config.buttons.saveCurrentContent.visible,
  saveCurrentContentDefaultChecked: config.buttons.saveCurrentContent.defaultChecked,
});

const restoreKeepCurrentContentButtonStateBackup = (config: FormSettingDraft, backup: NonNullable<KeepCurrentContentButtonStateBackup>) => {
  config.buttons.continuousSubmit.visible = backup.continuousSubmitVisible;
  config.buttons.continuousSubmit.defaultChecked = backup.continuousSubmitDefaultChecked;
  config.buttons.saveCurrentContent.visible = backup.saveCurrentContentVisible;
  config.buttons.saveCurrentContent.defaultChecked = backup.saveCurrentContentDefaultChecked;
};

const supportedAutoSubmitWidgetTypes = new Set([
  "widget.form.textInput",
  "widget.form.phoneInput",
  "widget.form.numberInput",
  "widget.form.amountInput",
  "widget.form.hyperlink",
]);
const mobileScanAutoSubmitWidgetTypes = new Set([
  "widget.form.textInput",
]);

const getFieldWidgetType = (field?: Field) => field?.meta?.extra?.widgetType;
const getFieldLinkType = (field?: Field) => field?.meta?.extra?.linkType;
const isFieldScanInputEnabled = (field?: Field) => {
  const widgetType = getFieldWidgetType(field);
  if (widgetType !== "widget.form.textInput") return false;
  return field?.meta?.extra?.scanInput === true;
};

const isAutoSubmitSupportedField = (field: Field) => {
  const widgetType = getFieldWidgetType(field);
  if (!supportedAutoSubmitWidgetTypes.has(widgetType)) {
    return false;
  }
  if (widgetType === "widget.form.hyperlink" && getFieldLinkType(field) === "form") {
    return false;
  }
  return true;
};

const availableAutoSubmitFields = computed(() => {
  return (props.table?.fields || []).filter((field: Field) => {
    return isAutoSubmitSupportedField(field);
  });
});
const currentAutoSubmitField = computed(() => {
  const fieldUid = firstRule.value?.fieldUid;
  if (!fieldUid) return undefined;
  return availableAutoSubmitFields.value.find(field => field.uid === fieldUid);
});
const showAutoSubmitMobileScanSubmit = computed(() => {
  const widgetType = getFieldWidgetType(currentAutoSubmitField.value);
  return widgetType
    ? mobileScanAutoSubmitWidgetTypes.has(widgetType) && isFieldScanInputEnabled(currentAutoSubmitField.value)
    : false;
});

const showAutoSubmitRequireChanged = computed(() => {
  return draftConfig.value.submitBehavior.successMode === "keepCurrentContent"
    || (draftConfig.value.buttons.continuousSubmit.visible && draftConfig.value.buttons.saveCurrentContent.visible);
});

const getAutoSubmitFieldByUid = (fieldUid?: string) => {
  if (!fieldUid) return undefined;
  return availableAutoSubmitFields.value.find(field => field.uid === fieldUid);
};

const canUseMobileScanSubmit = (field?: Field) => {
  const widgetType = getFieldWidgetType(field);
  return widgetType
    ? mobileScanAutoSubmitWidgetTypes.has(widgetType) && isFieldScanInputEnabled(field)
    : false;
};

const syncDraftRuntimeState = (config: FormSettingDraft) => {
  normalizeButtonDraftConfig(config);
  if (!config.autoSubmit.rules.length) {
    config.autoSubmit.rules = [createDefaultRule()];
  }
  const rule = config.autoSubmit.rules[0];
  if (config.autoSubmit.enabled) {
    const availableFields = availableAutoSubmitFields.value;
    if (!availableFields.length) {
      rule.fieldUid = undefined;
    } else if (!availableFields.some(field => field.uid === rule.fieldUid)) {
      rule.fieldUid = availableFields[0].uid;
    }
  }
  if (!canUseMobileScanSubmit(getAutoSubmitFieldByUid(rule?.fieldUid))) {
    rule.mobileScanSubmit = false;
  }
  return config;
};

const createInitializedFormViewConfig = (value?: FormViewConfig) => {
  return syncDraftRuntimeState(createDefaultFormViewConfig(value));
};

const ensureAutoSubmitField = () => {
  const rule = ensureFirstRule();
  const availableFields = availableAutoSubmitFields.value;
  if (!availableFields.length) {
    rule.fieldUid = undefined;
    return;
  }
  const matchedField = availableFields.find(field => field.uid === rule.fieldUid);
  if (!matchedField) {
    rule.fieldUid = availableFields[0].uid;
  }
};

const validateBeforeSave = () => {
  if (draftConfig.value.autoSubmit.enabled && !availableAutoSubmitFields.value.length) {
    ElMessage.warning(i18next.t("FormSettingPanel.autoSubmitFieldUnavailable"));
    return false;
  }
  const autoSubmitRule = firstRule.value;
  if (
    draftConfig.value.autoSubmit.enabled
    && autoSubmitRule
    && !autoSubmitRule.fieldEnterSubmit
    && !autoSubmitRule.mobileScanSubmit
  ) {
    ElMessage.warning(i18next.t("FormSettingPanel.autoSubmitTriggerRequired"));
    return false;
  }
  return true;
};

const getCurrentViewItem = () => {
  return nocode.value.body.views?.[props.table.uid]?.find(item => item.uid === activeTab.value);
};

const initData = () => {
  if (!isCurrent.value) return;
  const item = getCurrentViewItem();
  const currentViewName = (item?.name || "").trim() || i18next.t("FormDataViewer.formView");
  const baseConfig = createInitializedFormViewConfig(item?.formViewConfig);
  activeMenu.value = getStoredActiveMenu();
  originViewName.value = currentViewName;
  viewName.value = currentViewName;
  originConfig.value = cloneDeep(baseConfig);
  draftConfig.value = cloneDeep(baseConfig);
  keepCurrentContentButtonStateBackup.value = null;
  ensureFirstRule();
  if (draftConfig.value.autoSubmit.enabled) {
    ensureAutoSubmitField();
  }
};

const getComparableViewName = (name: string) => {
  return (name || "").trim() || i18next.t("FormDataViewer.formView");
};

const stripAutoSubmitRuleIds = (config: FormViewConfig) => {
  const autoSubmit = config.autoSubmit;
  if (!autoSubmit) return config;
  return {
    ...config,
    autoSubmit: {
      enabled: autoSubmit.enabled ?? false,
      rules: (autoSubmit.rules || []).map((rule) => {
        const nextRule = { ...rule };
        delete nextRule.id;
        return nextRule;
      }),
    },
  };
};

const hasUnsavedChanges = () => {
  return getComparableViewName(viewName.value) !== getComparableViewName(originViewName.value)
    || !equals(
      stripAutoSubmitRuleIds(buildSavedConfig(draftConfig.value)),
      stripAutoSubmitRuleIds(buildSavedConfig(originConfig.value))
    );
};

const dataToOrigin = () => {
  if (!isCurrent.value) return;
  viewName.value = originViewName.value;
  draftConfig.value = syncDraftRuntimeState(cloneDeep(originConfig.value));
  keepCurrentContentButtonStateBackup.value = null;
  ensureFirstRule();
  if (draftConfig.value.autoSubmit.enabled) {
    ensureAutoSubmitField();
  }
};

const saveTabData = async (data = nocode.value.body.views[props.table.uid]) => {
  if (!checkNocodeSyncBeforeRequest(nocodeSignIsLatest)) return false;
  return await axios.post("/project/save-nocode-toc", {
    nocodeId: nocode.value.meta.id,
    tableId: props.table.uid,
    data,
  }, {
    headers: {
      "x-sign": nocode.value.body.sign,
    },
  }).then(({ headers }) => {
    const mainSign = Array.isArray(headers?.["x-sign"]) ? headers["x-sign"][0] : headers?.["x-sign"];
    if (mainSign) {
      nocode.value.body.sign = mainSign;
    }
    return true;
  }).catch((error) => {
    if (handleNocodeSyncConflictError(error, nocodeSignIsLatest)) return false;
    ElMessage.error(error.message);
    return false;
  });
};

const buildSavedConfig = (config: FormSettingDraft): FormViewConfig => {
  const nextConfig = syncDraftRuntimeState(cloneDeep(config));
  return {
    buttons: {
      submit: {
        visible: nextConfig.buttons.submit.visible,
        label: nextConfig.buttons.submit.label.trim(),
      },
      saveDraft: {
        visible: nextConfig.buttons.saveDraft.visible,
        label: nextConfig.buttons.saveDraft.label.trim(),
      },
      continuousSubmit: {
        visible: nextConfig.buttons.continuousSubmit.visible,
        label: nextConfig.buttons.continuousSubmit.label.trim(),
        defaultChecked: nextConfig.buttons.continuousSubmit.defaultChecked,
      },
      saveCurrentContent: {
        visible: nextConfig.buttons.saveCurrentContent.visible,
        label: nextConfig.buttons.saveCurrentContent.label.trim(),
        defaultChecked: nextConfig.buttons.saveCurrentContent.defaultChecked,
      },
      viewDataAfterSubmit: {
        visible: nextConfig.buttons.viewDataAfterSubmit.visible,
        label: nextConfig.buttons.viewDataAfterSubmit.label.trim(),
      },
    },
    submitBehavior: {
      successMode: nextConfig.submitBehavior.successMode,
      successText: nextConfig.submitBehavior.successText.trim(),
    },
    autoSubmit: {
      enabled: nextConfig.autoSubmit.enabled,
      rules: nextConfig.autoSubmit.enabled
        ? nextConfig.autoSubmit.rules
          .filter(item => item.fieldUid)
          .map(item => normalizeAutoSubmitRule(item))
        : [],
    },
  };
};

const save = async () => {
  if (!validateBeforeSave()) return false;
  const views = cloneDeep(nocode.value.body.views?.[props.table.uid] || []);
  const currentIndex = views.findIndex(view => view.uid === activeTab.value);
  if (currentIndex === -1) return false;
  const nextViewName = (viewName.value || "").trim() || i18next.t("FormDataViewer.formView");
  views[currentIndex].name = nextViewName;
  views[currentIndex].formViewConfig = buildSavedConfig(draftConfig.value);
  const saved = await saveTabData(views);
  if (!saved) return false;
  nocode.value.body.views[props.table.uid] = views;
  if (props.currentView) {
    Object.assign(props.currentView, views[currentIndex]);
  }
  const baseConfig = createInitializedFormViewConfig(views[currentIndex].formViewConfig);
  originViewName.value = nextViewName;
  viewName.value = nextViewName;
  originConfig.value = cloneDeep(baseConfig);
  draftConfig.value = cloneDeep(baseConfig);
  keepCurrentContentButtonStateBackup.value = null;
  ensureFirstRule();
  if (draftConfig.value.autoSubmit.enabled) {
    ensureAutoSubmitField();
  }
  ElMessage.success(i18next.t("FormSettingPanel.saveSuccess"));
  return true;
};

const confirmCloseIfNeeded = async () => {
  if (!isCurrent.value || !hasUnsavedChanges()) return true;
  try {
    await ElMessageBox.confirm(
      i18next.t("FormSettingPanel.isSave"),
      i18next.t("FormSettingPanel.tips"),
      {
        distinguishCancelAndClose: true,
        confirmButtonText: i18next.t("FormSettingPanel.save"),
        cancelButtonText: i18next.t("FormSettingPanel.notSaveText"),
        type: "warning",
      }
    );
    return await save();
  } catch (action) {
    if (action === "cancel") {
      dataToOrigin();
      return true;
    }
    return false;
  }
};

const handleClose = async () => {
  if (!isCurrent.value) return;
  const allowClose = await confirmCloseIfNeeded();
  if (!allowClose) return;
  viewSettingDrawerRef.value?.hide();
};
const handleCancel = async () => {
  if (!isCurrent.value) return;
  const allowClose = await confirmCloseIfNeeded();
  if (!allowClose) return;
  viewSettingDrawerRef.value?.hide();
};
const handleConfirm = async () => {
  if (!isCurrent.value) return;
  await save();
};

const handleDrawerOtherClose = () => {
  if (!isCurrent.value) return;
  dataToOrigin();
};

const handleDrawerOpen = () => {
  if (!isCurrent.value) return;
  syncDrawerPanelState();
  initData();
};

watch(isCurrent, (value) => {
  syncDrawerPanelState();
  if (!viewSettingDrawerCloseGuard) return;
  if (value) {
    viewSettingDrawerCloseGuard.value = confirmCloseIfNeeded;
    return;
  }
  if (viewSettingDrawerCloseGuard.value === confirmCloseIfNeeded) {
    viewSettingDrawerCloseGuard.value = null;
  }
}, { immediate: true });

watch(() => activeTab.value, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    initData();
  }
});

watch(() => draftConfig.value.autoSubmit.enabled, (enabled) => {
  if (!enabled) return;
  ensureFirstRule();
  ensureAutoSubmitField();
}, { immediate: true });

watch(availableAutoSubmitFields, () => {
  if (!draftConfig.value.autoSubmit.enabled) return;
  ensureAutoSubmitField();
}, { immediate: true });

watch(showAutoSubmitMobileScanSubmit, (visible) => {
  if (visible) return;
  const rule = firstRule.value;
  if (!rule) return;
  rule.mobileScanSubmit = false;
}, { immediate: true });

watch(() => draftConfig.value.buttons.continuousSubmit.visible, () => {
  normalizeButtonDraftConfig(draftConfig.value);
}, { immediate: true });

watch(() => draftConfig.value.buttons.saveCurrentContent.visible, () => {
  normalizeButtonDraftConfig(draftConfig.value);
}, { immediate: true });

watch(() => draftConfig.value.submitBehavior.successMode, (nextMode, prevMode) => {
  if (nextMode === "keepCurrentContent" && prevMode !== "keepCurrentContent") {
    keepCurrentContentButtonStateBackup.value = createKeepCurrentContentButtonStateBackup(draftConfig.value);
  }
  if (nextMode !== "keepCurrentContent" && prevMode === "keepCurrentContent" && keepCurrentContentButtonStateBackup.value) {
    restoreKeepCurrentContentButtonStateBackup(draftConfig.value, keepCurrentContentButtonStateBackup.value);
    keepCurrentContentButtonStateBackup.value = null;
  }
  normalizeButtonDraftConfig(draftConfig.value);
}, { immediate: true });

watch(activeMenu, () => {
  syncDrawerPanelState();
}, { immediate: true });

onMounted(() => {
  formDataViewerEmitter.on(Events.DRAWER_OTHERCLOSE, handleDrawerOtherClose);
  formDataViewerEmitter.on(Events.DRAWER_OPEN, handleDrawerOpen);
  syncDrawerPanelState();
  if (!isCurrent.value) return;
  initData();
});

onUnmounted(() => {
  formDataViewerEmitter.off(Events.DRAWER_OTHERCLOSE, handleDrawerOtherClose);
  formDataViewerEmitter.off(Events.DRAWER_OPEN, handleDrawerOpen);
  if (viewSettingDrawerCloseGuard?.value === confirmCloseIfNeeded) {
    viewSettingDrawerCloseGuard.value = null;
  }
  if (viewSettingDrawerPanelState?.value.activeMenu === activeMenu.value) {
    viewSettingDrawerPanelState.value.activeMenu = null;
  }
});
</script>

<style lang="scss" scoped>
.form-setting-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
  overflow: hidden;

  .form-setting-panel-title {
    display: flex;
    align-items: center;
    gap: 12px;

    .label {
      height: 22px;
      color: #4e5969;
      font-size: 14px;
      line-height: 22px;
      flex-shrink: 0;
    }

    .value {
      flex: 1;
    }
  }

  .form-setting-panel-main {
    flex: 1;
    min-height: 0;
    overflow: hidden;

    :deep(.vn-stack) {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .tabs {
      display: flex;
      height: 36px;
      border-bottom: 1px solid #e5e6eb;
      gap: 24px;
      flex-shrink: 0;

      .tab-item:hover {
        cursor: pointer;
      }

      .active {
        color: #0873ff;
        box-shadow: inset 0 -1px 0 #0873ff;
      }
    }

    .layer-item {
      padding-top: 16px;
      box-sizing: border-box;
      min-height: 0;
      overflow: hidden;
    }

    .layer-scrollbar {
      height: 100%;

      :deep(.el-scrollbar__wrap) {
        overflow-x: hidden;
      }

      :deep(.el-scrollbar__view) {
        min-height: 100%;
        padding-right: 10px;
      }
    }
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .setting-subtitle {
    color: #1d2129;
    font-size: 14px;
    font-weight: 500;
    line-height: 22px;
    margin-top: 4px;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 12px;

    .setting-label {
      width: 132px;
      flex-shrink: 0;
      color: #4e5969;
      font-size: 14px;
      line-height: 22px;
    }

    .setting-value {
      flex: 1;
      min-width: 0;
    }
  }

  .value,
  .setting-value {
    :deep(.el-input),
    :deep(.el-select) {
      width: 100%;
      --el-input-border-radius: 4px;
      --el-input-bg-color: #f2f3f5;
      --el-fill-color-blank: #f2f3f5;
      --el-select-border-color-hover: #c9cdd4;
    }

    :deep(.el-input__wrapper),
    :deep(.el-select__wrapper) {
      background-color: #f2f3f5;
      box-shadow: 0 0 0 1px transparent inset;
      border-radius: 4px;
    }

    :deep(.el-input__wrapper:hover),
    :deep(.el-select__wrapper:hover) {
      box-shadow: 0 0 0 1px #c9cdd4 inset;
    }
  }

  .button-setting-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .button-setting-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .button-setting-switch {
    min-height: 32px;
  }

  .button-setting-input {
    padding-left: 0;

    .setting-value {
      width: 100%;
    }
  }

  .switch-row {
    justify-content: space-between;

    .setting-label {
      width: auto;
    }
  }

  .label-with-tip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .label-tip-icon {
    color: #86909c;
    font-size: 14px;
  }
}
</style>
