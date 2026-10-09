<template>
  <b2-widget>
    <div class="submit-success" :class="{'mobile': isMobileDevice}" v-if="isSubmit">
      <el-icon :size="120"><i-ven-submit-success /></el-icon>
      <p class="tip">{{ submitSuccessPageText }}</p>
      <div class="btns">
        <el-button class="continue-btn" type="primary" @click="handleContinueSubmit">{{ continueSubmitText }}</el-button>
        <el-button v-if="viewDataButtonVisible" class="view-data-btn" @click="handleViewData">{{ viewDataButtonText }}</el-button>
      </div>
    </div>

    <template v-else>
      <div class="submit-form" v-if="!isMobileDevice">
        <div class="form-body">
          <el-scrollbar class="form-scrollbar">
            <div class="form-wrapper">
              <nocode-form v-if="isShowForm && widget.formTableUID" ref="nocodeFormRef" v-bind="nocodeFormInfo" @ready="handleFormReady"></nocode-form>
            </div>
          </el-scrollbar>
          <div class="footer">
            <div class="left">
              <el-tooltip v-if="submitButtonVisible" :content="$t('formLoadingTip')" :disabled="isFormReady" placement="top">
                <span class="form-action-tooltip-trigger">
                  <el-button class="submit-button" :loading="isLoading" :disabled="!isFormReady" type="primary" @click="handleSubmit">{{ submitButtonText }}</el-button>
                </span>
              </el-tooltip>
              <el-tooltip v-if="saveDraftButtonVisible" :content="$t('formLoadingTip')" :disabled="isFormReady" placement="top">
                <span class="form-action-tooltip-trigger">
                  <el-button :loading="isLoading" :disabled="!isFormReady" @click="handleSubmitDraft">{{ saveDraftButtonText }}</el-button>
                </span>
              </el-tooltip>
              <el-tooltip v-if="stashButtonVisible" :content="$t('formLoadingTip')" :disabled="isFormReady" placement="top">
                <span class="form-action-tooltip-trigger">
                  <el-button :loading="isLoading" :disabled="!isFormReady" @click="handleStash">{{ stashButtonText }}</el-button>
                </span>
              </el-tooltip>
            </div>
            <div class="right" v-if="continuousSubmitVisible || (saveCurrentContentVisible && isSubmitContinuous)">
              <el-checkbox v-if="continuousSubmitVisible" v-model="isSubmitContinuous" :disabled="isKeepCurrentContentMode">{{ continuousSubmitText }}</el-checkbox>
              <el-checkbox v-if="saveCurrentContentVisible && isSubmitContinuous" v-model="isSaveCurrentContent" :disabled="isKeepCurrentContentMode">{{ saveCurrentContentText }}</el-checkbox>
            </div>
          </div>
        </div>
      </div>

      <div class="mobile-submit-form" v-else>
        <div class="form-wrapper">
          <nocode-form v-if="isShowForm && widget.formTableUID" ref="nocodeFormRef" v-bind="nocodeFormInfo" @ready="handleFormReady"></nocode-form>
        </div>
        <div class="footer">
          <div class="left" v-if="continuousSubmitVisible || (saveCurrentContentVisible && isSubmitContinuous)">
            <el-checkbox v-if="continuousSubmitVisible" v-model="isSubmitContinuous" :disabled="isKeepCurrentContentMode">{{ continuousSubmitText }}</el-checkbox>
            <el-checkbox v-if="saveCurrentContentVisible && isSubmitContinuous" v-model="isSaveCurrentContent" :disabled="isKeepCurrentContentMode">{{ saveCurrentContentText }}</el-checkbox>
          </div>
          <div class="right">
            <el-tooltip v-if="saveDraftButtonVisible" :content="$t('formLoadingTip')" :disabled="isFormReady" placement="top">
              <span class="form-action-tooltip-trigger">
                <el-button :loading="isLoading" :disabled="!isFormReady" class="submit-draft" @click="handleSubmitDraft">{{ mobileSaveDraftButtonText }}</el-button>
              </span>
            </el-tooltip>
            <el-tooltip v-if="stashButtonVisible" :content="$t('formLoadingTip')" :disabled="isFormReady" placement="top">
              <span class="form-action-tooltip-trigger">
                <el-button :loading="isLoading" :disabled="!isFormReady" class="submit-draft" @click="handleStash">{{ mobileStashButtonText }}</el-button>
              </span>
            </el-tooltip>
            <el-tooltip v-if="submitButtonVisible" :content="$t('formLoadingTip')" :disabled="isFormReady" placement="top">
              <span class="form-action-tooltip-trigger submit-action-tooltip-trigger">
                <el-button :loading="isLoading" :disabled="!isFormReady" class="submit-button" type="primary" @click="handleSubmit">{{ submitButtonText }}</el-button>
              </span>
            </el-tooltip>
          </div>
        </div>
      </div>
    </template>
  </b2-widget>
</template>

<script lang="ts" setup>
import { isMobile } from "@renderer/utils/pure";
import { SystemField } from "@common/utils/connection";
import { useWidget } from "@renderer/b2/types";
import { FORM_VIEW_CONFIG } from "@renderer/types/inject";
import { SubmitForm } from "./submitForm";
import { ElLoading, ElMessage } from "element-plus";
import { ref, computed, inject, nextTick, onBeforeUnmount, watch, type ComputedRef } from "vue";
import IVenSubmitSuccess from "~icons/ven-icon/widget-form-submit-form-submit-success";
import i18next, { $t } from "@renderer/widgets/i18next";

type FormAutoSubmitTriggerType = "fieldEnter" | "mobileScan";
type FormViewConfig = NonNullable<SubmitForm["formViewConfig"]>;
type FormAutoSubmitRule = {
  id: string;
  enabled?: boolean;
  fieldUid?: string;
  fieldScope?: "mainForm";
  fieldEnterSubmit?: boolean;
  mobileScanSubmit?: boolean;
  requireChanged?: boolean;
  requireNonEmpty?: boolean;
  blockWhenUploading?: boolean;
  blockWhenInvalid?: boolean;
};

type NocodeFormExpose = {
  submit: (options?: { skipSubmitValidationNoticeConfirm?: boolean; skipSubmitSignSyncConfirm?: boolean }) => Promise<any>;
  saveDraft: () => Promise<any>;
  stash?: () => Promise<false | { dataUid?: string } | { isStashed?: boolean }>;
  confirmSubmitBeforeMutation?: (options?: { onSignSyncConflict?: () => Promise<boolean> }) => Promise<boolean>;
  confirmSubmitValidationNotice?: () => Promise<boolean>;
  clearSubmitValidationNotice?: () => void;
  getFormRow?: () => Record<string, any>;
  resetAddingRowIdentity?: () => Promise<void>;
  registerAutoSubmitHandler?: (handler: (payload: { type: FormAutoSubmitTriggerType; fieldUid?: string; value?: any }) => void) => () => void;
};

type AutoSubmitPayload = {
  type: FormAutoSubmitTriggerType;
  fieldUid?: string;
  value?: any;
};

const isMobileDevice = isMobile();

const emit = defineEmits<{
  (event: "draft-saved"): void;
  (event: "form-submitted", dataUid: string): void;
  (event: "view-data", dataUid: string): void;
}>();

const widget = useWidget<SubmitForm>();
const isFormReady = ref(false);
const isLoading = ref(false);
const isShowForm = ref(true);
const isSubmit = ref(false);
const viewDataUid = ref<string>();
const nocodeFormRef = ref<NocodeFormExpose>();
const handleFormReady = () => {
  isFormReady.value = true;
}
const saveDraftBeforeRefresh = async ()=>{
  if(!nocodeFormRef.value) return false;
  const loadingInstance = ElLoading.service({
    target: ".form-wrapper",
    background: "rgba(0, 0, 0, 0.2)"
  });
  const res = await nocodeFormRef.value.saveDraft().then(() => true).catch(() => false);
  loadingInstance.close();
  return res;
}
const unregisterAutoSubmit = ref<null | (() => void)>(null);
const lastSubmittedAutoSubmitFieldValue = ref("");
const injectedFormViewConfig = inject<ComputedRef<FormViewConfig | undefined> | undefined>(FORM_VIEW_CONFIG as any, undefined);

const formViewConfig = computed(() => injectedFormViewConfig?.value || widget.formViewConfig || {});
const buttonsConfig = computed(() => formViewConfig.value.buttons || {});
const autoSubmitConfig = computed(() => formViewConfig.value.autoSubmit || {});
const submitBehavior = computed(() => formViewConfig.value.submitBehavior || {});

const isKeepCurrentContentMode = computed(() => submitBehavior.value.successMode === "keepCurrentContent");
const isSubmitContinuous = ref(Boolean(buttonsConfig.value.continuousSubmit?.defaultChecked));
const isSaveCurrentContent = ref(Boolean(buttonsConfig.value.saveCurrentContent?.defaultChecked));

const submitButtonVisible = computed(() => buttonsConfig.value.submit?.visible !== false);
const saveDraftButtonVisible = computed(() => buttonsConfig.value.saveDraft?.visible !== false);
const stashButtonVisible = computed(() => buttonsConfig.value.stash?.visible === true);
const continuousSubmitVisible = computed(() => {
  return isKeepCurrentContentMode.value || buttonsConfig.value.continuousSubmit?.visible !== false;
});
const saveCurrentContentVisible = computed(() => {
  return continuousSubmitVisible.value && (isKeepCurrentContentMode.value || buttonsConfig.value.saveCurrentContent?.visible !== false);
});
const viewDataButtonVisible = computed(() => buttonsConfig.value.viewDataAfterSubmit?.visible !== false);

const submitButtonText = computed(() => buttonsConfig.value.submit?.label?.trim() || i18next.t("submit"));
const saveDraftButtonText = computed(() => buttonsConfig.value.saveDraft?.label?.trim() || i18next.t("saveDraft"));
const stashButtonText = computed(() => buttonsConfig.value.stash?.label?.trim() || i18next.t("stash"));
const mobileSaveDraftButtonText = computed(() => {
  if (isSubmitContinuous.value && !buttonsConfig.value.saveDraft?.label?.trim()) {
    return i18next.t("saveDraftShort");
  }
  return saveDraftButtonText.value;
});
const mobileStashButtonText = computed(() => {
  if (isSubmitContinuous.value && !buttonsConfig.value.stash?.label?.trim()) {
    return i18next.t("stash");
  }
  return stashButtonText.value;
});
const continuousSubmitText = computed(() => buttonsConfig.value.continuousSubmit?.label?.trim() || i18next.t("continuousSubmit"));
const saveCurrentContentText = computed(() => buttonsConfig.value.saveCurrentContent?.label?.trim() || i18next.t("saveCurrentContent"));
const continueSubmitText = computed(() => buttonsConfig.value.continuousSubmit?.label?.trim() || i18next.t("continueSubmit"));
const viewDataButtonText = computed(() => buttonsConfig.value.viewDataAfterSubmit?.label?.trim() || i18next.t("viewData"));
const submitSuccessPageText = computed(() => submitBehavior.value.successText?.trim() || i18next.t("submitSuccess"));
const successMode = computed(() => submitBehavior.value.successMode || "successPage");

const autoSubmitRule = computed<FormAutoSubmitRule | undefined>(() => {
  if (!autoSubmitConfig.value.enabled) return undefined;
  const rule = (autoSubmitConfig.value.rules || []).find(item => item.enabled !== false && item.fieldUid);
  if (!rule) return undefined;
  const legacyTriggerType = (rule as FormAutoSubmitRule & { triggerType?: string }).triggerType;
  const fallbackFieldEnterSubmit = legacyTriggerType === "fieldEnter"
    || (rule.fieldEnterSubmit === undefined && rule.mobileScanSubmit === undefined);
  const fieldEnterSubmit = rule.fieldEnterSubmit ?? fallbackFieldEnterSubmit;
  return {
    ...rule,
    fieldEnterSubmit,
    mobileScanSubmit: rule.mobileScanSubmit ?? false,
  };
});
const shouldCheckAutoSubmitFieldChanged = computed(() => {
  if (!autoSubmitRule.value?.requireChanged) return false;
  if (isSubmitContinuous.value) {
    return isSaveCurrentContent.value;
  }
  return successMode.value === "keepCurrentContent";
});

const nocodeFormInfo = computed(() => ({
  nocodeId: widget.getBoard().nocodeId,
  tableUID: widget.formTableUID,
  memberFieldsAuth: widget.fieldsAuth,
}));

const initCheckboxState = () => {
  isSubmitContinuous.value = continuousSubmitVisible.value && (isKeepCurrentContentMode.value || Boolean(buttonsConfig.value.continuousSubmit?.defaultChecked));
  isSaveCurrentContent.value = saveCurrentContentVisible.value && (isKeepCurrentContentMode.value || Boolean(buttonsConfig.value.saveCurrentContent?.defaultChecked));
};

const clampCheckboxState = () => {
  if (isKeepCurrentContentMode.value) {
    isSubmitContinuous.value = true;
    isSaveCurrentContent.value = true;
    return;
  }
  if (!continuousSubmitVisible.value) {
    isSubmitContinuous.value = false;
  }
  if (!saveCurrentContentVisible.value) {
    isSaveCurrentContent.value = false;
  }
};

const serializeAutoSubmitValue = (value: any) => {
  if (value === undefined) return "__undefined__";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getCurrentAutoSubmitFieldValue = (fieldUid?: string) => {
  if (!fieldUid) return undefined;
  return nocodeFormRef.value?.getFormRow?.()?.[fieldUid];
};

const syncLastSubmittedAutoSubmitFieldValue = () => {
  const fieldUid = autoSubmitRule.value?.fieldUid;
  if (!fieldUid) {
    lastSubmittedAutoSubmitFieldValue.value = "";
    return;
  }
  lastSubmittedAutoSubmitFieldValue.value = serializeAutoSubmitValue(getCurrentAutoSubmitFieldValue(fieldUid));
};

const resetFormBySuccessMode = async () => {
  if (isSubmitContinuous.value) {
    if (isSaveCurrentContent.value) {
      return;
    }
    isFormReady.value = false;
    isShowForm.value = false;
    await nextTick();
    isShowForm.value = true;
    return;
  }
  if (successMode.value === "keepCurrentContent") {
    return;
  }
  if (successMode.value === "resetForm") {
    isFormReady.value = false;
    isShowForm.value = false;
    await nextTick();
    isShowForm.value = true;
  }
};

const finishSubmitSuccess = async (result: any, source: "manual" | "auto" = "manual") => {
  if (!result) return;
  viewDataUid.value = result[0]?.[SystemField.UUID];
  ElMessage.success(i18next.t("submitSuccess"));
  const shouldKeepCurrentContent = (isSubmitContinuous.value && isSaveCurrentContent.value)
    || (!isSubmitContinuous.value && successMode.value === "keepCurrentContent");
  if (shouldKeepCurrentContent) {
    await nocodeFormRef.value?.resetAddingRowIdentity?.();
  }
  syncLastSubmittedAutoSubmitFieldValue();
  if (viewDataUid.value) {
    emit("form-submitted", viewDataUid.value);
  }

  if (isSubmitContinuous.value || successMode.value !== "successPage") {
    await resetFormBySuccessMode();
    return;
  }

  isFormReady.value = false;
  isSubmit.value = true;
};

const doSubmit = async (source: "manual" | "auto" = "manual") => {
  if (!nocodeFormRef.value || !isFormReady.value || isLoading.value) return false;
  isLoading.value = true;
  let loadingInstance: ReturnType<typeof ElLoading.service> | undefined;
  try {
    const mutationConfirmed = await nocodeFormRef.value.confirmSubmitBeforeMutation?.({
      onSignSyncConflict: saveDraftBeforeRefresh,
    });
    if (mutationConfirmed === false) {
      nocodeFormRef.value?.clearSubmitValidationNotice?.();
      return false;
    }
    const validationConfirmed = await nocodeFormRef.value.confirmSubmitValidationNotice?.();
    if (validationConfirmed === false) {
      nocodeFormRef.value?.clearSubmitValidationNotice?.();
      if (source === "auto") {
        ElMessage.warning(i18next.t("autoSubmitInvalid"));
      }
      return false;
    }
    loadingInstance = ElLoading.service({
      target: ".form-wrapper",
      text: i18next.t("submitting"),
      background: "rgba(0, 0, 0, 0.2)",
    });
    const result = await nocodeFormRef.value.submit({ skipSubmitValidationNoticeConfirm: true, skipSubmitSignSyncConfirm: true });
    await finishSubmitSuccess(result, source);
    return true;
  } catch {
    return false;
  } finally {
    loadingInstance?.close();
    isLoading.value = false;
  }
};

const handleSubmit = async () => {
  await doSubmit("manual");
};

const handleSubmitDraft = async () => {
  if (!nocodeFormRef.value || !isFormReady.value || isLoading.value) return;
  isLoading.value = true;
  const loadingInstance = ElLoading.service({
    target: ".form-wrapper",
    text: i18next.t("savingDraft"),
    background: "rgba(0, 0, 0, 0.2)",
  });
  const success = await nocodeFormRef.value.saveDraft().then(() => true).catch(() => false);
  loadingInstance.close();
  isLoading.value = false;
  if (!success) return;
  isFormReady.value = false;
  isShowForm.value = false;
  ElMessage.success(i18next.t("saveDraftSuccess"));
  await nextTick();
  isShowForm.value = true;
  emit("draft-saved");
};

const handleStash = async () => {
  if (!nocodeFormRef.value || !isFormReady.value || isLoading.value || !nocodeFormRef.value.stash) return;
  const mutationConfirmed = await nocodeFormRef.value.confirmSubmitBeforeMutation?.({
    onSignSyncConflict: saveDraftBeforeRefresh,
  });
  if (mutationConfirmed === false) {
    nocodeFormRef.value?.clearSubmitValidationNotice?.();
    return;
  }
  isLoading.value = true;
  const loadingInstance = ElLoading.service({
    target: ".form-wrapper",
    text: i18next.t("stashing"),
    background: "rgba(0, 0, 0, 0.2)",
  });
  const result = await nocodeFormRef.value.stash().catch(() => false);
  loadingInstance.close();
  isLoading.value = false;
  if (!result) return;
  isFormReady.value = false;
  isShowForm.value = false;
  ElMessage.success(i18next.t("stashSuccess"));
  await nextTick();
  isShowForm.value = true;
  if (result && typeof result === "object" && result.dataUid) {
    emit("form-submitted", result.dataUid);
  }
};

const handleContinueSubmit = () => {
  isFormReady.value = false;
  isSubmit.value = false;
  initCheckboxState();
};

const handleViewData = () => {
  if (!viewDataUid.value) return;
  emit("view-data", viewDataUid.value);
};

const shouldAutoSubmit = (payload: AutoSubmitPayload) => {
  const rule = autoSubmitRule.value;
  if (!rule) return false;
  if (rule.fieldUid !== payload.fieldUid) return false;
  if (payload.type === "fieldEnter" && !rule.fieldEnterSubmit) return false;
  if (payload.type === "mobileScan" && !rule.mobileScanSubmit) return false;
  const currentFieldValue = payload.value !== undefined ? payload.value : getCurrentAutoSubmitFieldValue(rule.fieldUid);
  if (rule.requireNonEmpty && (currentFieldValue === undefined || currentFieldValue === null || currentFieldValue === "")) {
    return false;
  }
  if (shouldCheckAutoSubmitFieldChanged.value) {
    if (serializeAutoSubmitValue(currentFieldValue) === lastSubmittedAutoSubmitFieldValue.value) {
      return false;
    }
  }
  return true;
};

const triggerAutoSubmit = (payload: AutoSubmitPayload) => {
  if (!shouldAutoSubmit(payload)) return;
  const rule = autoSubmitRule.value;
  if (!rule?.fieldUid) {
    ElMessage.warning(i18next.t("autoSubmitMissingField"));
    return;
  }
  void doSubmit("auto");
};

const registerAutoSubmitHandler = () => {
  unregisterAutoSubmit.value?.();
  unregisterAutoSubmit.value = nocodeFormRef.value?.registerAutoSubmitHandler?.((payload) => {
    triggerAutoSubmit(payload);
  }) || null;
};

watch(nocodeFormRef, () => {
  registerAutoSubmitHandler();
});

watch(buttonsConfig, () => {
  initCheckboxState();
}, { deep: true, immediate: true });

watch([continuousSubmitVisible, saveCurrentContentVisible, isSubmitContinuous, isSaveCurrentContent, isKeepCurrentContentMode], () => {
  clampCheckboxState();
}, { immediate: true });

watch(() => [
  autoSubmitRule.value?.id,
  autoSubmitRule.value?.fieldUid,
  autoSubmitRule.value?.fieldEnterSubmit,
  autoSubmitRule.value?.mobileScanSubmit,
  autoSubmitRule.value?.requireChanged,
], () => {
  lastSubmittedAutoSubmitFieldValue.value = "";
});

onBeforeUnmount(() => {
  unregisterAutoSubmit.value?.();
});
</script>

<style lang="scss" scoped>
.submit-form {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.submit-button.el-button--primary:not(.is-disabled)) {
    background-color: var(--form-share-submit-button-color, var(--el-color-primary));
    border-color: var(--form-share-submit-button-color, var(--el-color-primary));
  }

  :deep(.submit-button.el-button--primary:not(.is-disabled):hover),
  :deep(.submit-button.el-button--primary:not(.is-disabled):focus),
  :deep(.submit-button.el-button--primary:not(.is-disabled):active) {
    background-color: var(--form-share-submit-button-color, var(--el-color-primary));
    border-color: var(--form-share-submit-button-color, var(--el-color-primary));
  }

  .form-body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .form-scrollbar {
    flex: 1;
    min-height: 0;
    width: 100%;

    :deep(.el-scrollbar__wrap) {
      overflow-x: hidden;
    }
  }

  .form-wrapper {
    min-height: 100%;
    width: 100%;
    padding-bottom: 16px;

    :deep(.board) {
      .axis {
        position: unset;

        .board-container {
          position: unset;
        }
      }
    }
  }

  .footer {
    flex: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 24px;
    border-top: 1px dashed var(--border-color-light);
    background-color: var(--bg-color-page);

    .left {
      display: flex;
      align-items: center;
      gap: 12px;

      .el-button {
        min-width: 96px;
        height: 32px;
        border-radius: 4px;
      }
    }

    .right > label {
      margin: 0;

      &::before {
        content: "";
        width: 1px;
        height: 14px;
        background-color: var(--border-color);
        margin: 0 16px;
        display: inline-block;
      }

      &:first-child::before {
        display: none;
      }
    }
  }
}

.submit-success {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  :deep(.submit-button.el-button--primary) {
    background-color: var(--form-share-submit-button-color, var(--el-color-primary));
    border-color: var(--form-share-submit-button-color, var(--el-color-primary));
  }

  :deep(.submit-button.el-button--primary:hover),
  :deep(.submit-button.el-button--primary:focus),
  :deep(.submit-button.el-button--primary:active) {
    background-color: var(--form-share-submit-button-color, var(--el-color-primary));
    border-color: var(--form-share-submit-button-color, var(--el-color-primary));
  }

  .tip {
    height: 30px;
    line-height: 30px;
    color: var(--bg-color-active);
    font-size: 20px;
    margin: 8px 0 16px;
  }

  .btns {
    display: flex;

    .el-button {
      min-width: 120px;
      height: 36px;
      border-radius: 4px;
    }
  }
}

.submit-success.mobile {
  .btns {
    flex-direction: column;

    .tip {
      margin-top: 8px;
      font-size: 20px;
    }

    .el-button {
      min-width: 120px;
      height: 32px;
      border-radius: 4px;
      font-size: 14px;
    }

    .view-data-btn {
      margin: 8px 0 0;
    }
  }
}

.mobile-submit-form {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.submit-button.el-button--primary:not(.is-disabled)) {
    background-color: var(--form-share-submit-button-color, var(--el-color-primary));
    border-color: var(--form-share-submit-button-color, var(--el-color-primary));
  }

  :deep(.submit-button.el-button--primary:not(.is-disabled):hover),
  :deep(.submit-button.el-button--primary:not(.is-disabled):focus),
  :deep(.submit-button.el-button--primary:not(.is-disabled):active) {
    background-color: var(--form-share-submit-button-color, var(--el-color-primary));
    border-color: var(--form-share-submit-button-color, var(--el-color-primary));
  }

  .form-wrapper {
    flex: auto;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    padding-bottom: 55px;

    :deep(.board) {
      .axis {
        position: unset;

        .board-container {
          position: unset;
        }
      }
    }
  }

  .footer {
    width: 100%;
    min-height: 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: absolute;
    bottom: 0;
    left: 0;
    gap: 10px;
    padding: 0 10px;

    .left > label {
      margin: 0 10px 0 0;

      &:last-child {
        margin-right: 0;
      }
    }

    .right {
      display: flex;
      justify-content: flex-end;
      flex: 1;
      gap: 8px;

      .submit-draft {
        height: 40px;
        padding: 0 16px;
        border-radius: 4px;
      }

      .submit-button {
        width: 100%;
        height: 40px;
        border-radius: 4px;
      }

      .submit-action-tooltip-trigger {
        max-width: 128px;
        flex: 1;
      }
    }
  }
}

.form-action-tooltip-trigger {
  display: inline-flex;
}
</style>
