<template>
  <div class="creation-container">
    <el-dialog
      class="creation-dialog"
      :model-value="modelValue"
      :title="$t('nocodeCreationDialog.dialogHeader')"
      :close-on-click-modal="false"
      :close-on-press-escape="isDialogClosable"
      :show-close="isDialogClosable"
      @update:model-value="emit('update:modelValue', $event)"
      width="960px"
      @opened="emit('opened')"
      align-center
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-header__title">{{ $t("nocodeCreationDialog.dialogHeader") }}</span>
        </div>
      </template>

      <div class="project-creation">
        <section class="hero-section">
          <h2 class="hero-title">
            <span>{{ $t("NocodeCreationDialog.heroTitlePrefix") }}</span>
            <span class="hero-title__accent">AI</span>
            <span>{{ $t("NocodeCreationDialog.heroTitleSuffix") }}</span>
          </h2>

          <div class="builder-composer" :class="{ 'has-login-prompt': showLoginPrompt }">
            <workbench-ai-login-prompt
              v-if="showLoginPrompt"
              :admin-only="showAdminLoginPrompt"
              @login="handleLoginClick"
              @other-options="handleOtherOptionsClick"
            />
            <workbench-ai-chat-input
              ref="builderChatInputRef"
              v-model="builderPrompt"
              :attachments="builderAttachments"
              :attachment-accept="WORKBENCH_AI_ATTACHMENT_ACCEPT"
              :defer-attachment-upload="true"
              :placeholder="$t('NocodeCreationDialog.builderPlaceholder')"
              :show-app-selector="false"
              :show-model-selector="true"
              :model-options="modelSelectorOptions"
              :selected-model-value="selectedModelValue"
              :model-label="currentModelLabel"
              :allow-model-selection="!isBusy"
              :model-selection-loading="aiConfigStore.catalogLoading"
              :loading="false"
              :textareaRow="showLoginPrompt ? 1 : 3"
              :submitting="isBusy"
              @submit="handleBuilderSubmit"
              @model-change="handleModelChange"
              @select-attachment="handleBuilderAttachmentSelect"
              @remove-attachment="handleBuilderAttachmentRemove"
            />
          </div>
        </section>

        <section class="creation-methods" :class="{ 'is-disabled': isBusy }">
          <h3 class="creation-methods__title">
            {{ $t("NocodeCreationDialog.templateRecommend") }}
          </h3>
          <div class="creation-methods__grid">
            <button
              type="button"
              class="creation-method creation-method--blank"
              :disabled="isBusy"
              @click="clickCreateButton"
            >
              <span class="creation-method__label">{{ $t("NocodeCreationDialog.createBlankApp") }}</span>
            </button>
            <button
              type="button"
              class="creation-method creation-method--template"
              :disabled="isBusy"
              @click="openMarketPage"
            >
              <span class="creation-method__content">
                <span class="creation-method__label">{{ $t("NocodeCreationDialog.createFromTemplate") }}</span>
                <el-icon class="creation-method__arrow" :size="18"><i-ep-right /></el-icon>
              </span>
            </button>
          </div>
        </section>
      </div>
    </el-dialog>
    <nocode-create-info-dialog ref="createInfoDialogRef" :submitting="isDialogCreating" @create="createEmptyNocode"></nocode-create-info-dialog>
  </div>
</template>

<script lang='ts' setup>
import type {
  AiAttachment,
  AiAttachmentSelectionEventPayload,
} from "@common/types/aiAttachment";
import { WORKBENCH_AI_ATTACHMENT_ACCEPT } from "@common/utils/aiAttachmentFormats";
import { inject, ref, computed, nextTick, watch } from "vue";
import { UPDATE_OPENING_PROJECT_LIST } from "@renderer/types";
import { useAiConfigStore, useDialogStore, usePassportStore } from "@renderer/stores";
import { ElMessage } from "element-plus";
import { NocodeMeta } from "@common/types/nocode";
import i18next from "i18next";
import { NOCODE_LIST } from "@renderer/types";
import { useRouter } from 'vue-router';
import { projectApi } from "@renderer/utils/api/project";
import { createEmptyNocodeShell, resolveBlankNocodeCreationBehavior } from "./nocodeCreationFlow";
import { buildNocodeEditorRoute } from '../../editor/editorReturnNavigation';
import { stageNocodeEditorBuilderAttachments } from '@renderer/utils/nocodeEditorBuilderAttachmentTransfer';
import { stageNocodeEditorBuilderModelSelection } from '@renderer/utils/nocodeEditorBuilderModelSelectionTransfer';
import { BUILTIN_AI_PROVIDER_ID, resolveThreadModelSelectorValue } from '@common/utils/aiProvider';
import type { AiThreadModelSelection } from '@common/types/ai-provider';
import WorkbenchAiChatInput from '../AI/components/WorkbenchAiChatInput.vue';
import WorkbenchAiLoginPrompt from '../AI/components/WorkbenchAiLoginPrompt.vue';

type BlankNocodeCreationSource = 'builder' | 'dialog';

const router = useRouter();
const passportState = usePassportStore();
const aiConfigStore = useAiConfigStore();
const nocodeList = inject(NOCODE_LIST);
const createInfoDialogRef = ref(null)
const builderChatInputRef = ref<InstanceType<typeof WorkbenchAiChatInput> | null>(null);
const builderPrompt = ref('');
const builderAttachments = ref<AiAttachment[]>([]);
const builderProviderId = ref('');
const builderModelId = ref('');
const builderModel = ref('');

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  modelValue: boolean,
  parentId: string,
  autoOpen?: boolean
}>(), {
  autoOpen: true,
});
// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: "gotoMarket"),
  (event: "closed"),
  (event: "opened"),
  (event: "update:modelValue", value: boolean),
  (event: "created",value: NocodeMeta),
}>();

const pendingBuilderPromptStorageKey = 'NOCODE_CREATION_BUILDER_PROMPT';
const modelSelectorOptions = computed(() => aiConfigStore.modelOptions
  .filter(option => passportState.isLoginUser || option.providerId !== BUILTIN_AI_PROVIDER_ID)
  .map(option => {
    const catalogItem = aiConfigStore.catalog.items.find(item => (
      item.providerId === option.providerId && item.modelId === option.modelId
    ));
    return {
      ...option,
      label: catalogItem?.displayName || option.label,
      groupLabel: catalogItem?.providerName || i18next.t('WorkbenchAiChatInput.otherModelGroup'),
      groupKey: `provider:${option.providerId || 'other'}`,
    };
  }));
const firstExplicitModelOption = computed(() => (
  modelSelectorOptions.value.find(item => item.modelSelectionSource === 'explicit') || null
));
const resolveSavedModelOption = () => {
  const providerId = builderProviderId.value;
  const modelId = builderModelId.value;
  const model = builderModel.value || '';
  if (!providerId && !modelId && !model) {
    return null;
  }
  return modelSelectorOptions.value.find(option => (
    (!providerId || option.providerId === providerId)
    && (modelId ? option.modelId === modelId : (!model || option.model === model))
  )) || null;
};
const savedModelOption = computed(() => resolveSavedModelOption());
const temporaryFallbackModelOption = computed(() => (
  savedModelOption.value ? null : firstExplicitModelOption.value
));
const effectiveModelOption = computed(() => (
  savedModelOption.value || temporaryFallbackModelOption.value
));
const selectedModelValue = computed(() => resolveThreadModelSelectorValue(
  effectiveModelOption.value?.modelSelectionSource,
  effectiveModelOption.value,
));
const currentModelLabel = computed(() => (
  effectiveModelOption.value?.label || ''
));
const showAdminLoginPrompt = computed(() => (
  passportState.isLoginAccount && !passportState.isMainAccount
));
const showLoginPrompt = computed(() => (
  !aiConfigStore.catalogLoading
  && (!passportState.isLoginUser || showAdminLoginPrompt.value)
  && !modelSelectorOptions.value.some(item => item.modelSelectionSource === 'explicit')
));
const showNoAvailableModelMessage = () => {
  ElMessage.warning(i18next.t('NocodeCreationDialog.noAvailableModel'));
};
const canSubmitBuilder = () => {
  if (aiConfigStore.catalogLoading) return false;
  if (effectiveModelOption.value) return true;
  showNoAvailableModelMessage();
  return false;
};

const blankCreationSource = ref<BlankNocodeCreationSource | null>(null);
const isBlankCreating = computed(() => blankCreationSource.value !== null);
const isDialogCreating = computed(() => blankCreationSource.value === 'dialog');
const isBusy = computed(() => isBlankCreating.value);
const isDialogClosable = computed(() => !isBlankCreating.value);
let updateOpeningList = inject(UPDATE_OPENING_PROJECT_LIST);

const persistPendingBuilderInitialPrompt = (nocodeId: string, value: string) => {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }
  const normalizedNocodeId = String(nocodeId || '').trim();
  if (!normalizedNocodeId) {
    return;
  }
  try {
    window.sessionStorage.setItem(`${pendingBuilderPromptStorageKey}:${normalizedNocodeId}`, value);
  } catch (error) {
    console.error('Persist pending builder initial prompt failed:', error);
  }
};

const applyFirstExplicitModelSelection = () => {
  const option = firstExplicitModelOption.value;
  if (!option || builderProviderId.value || builderModelId.value) {
    return;
  }
  builderProviderId.value = option.providerId || '';
  builderModelId.value = option.modelId || '';
  builderModel.value = option.model || '';
};

const resetBuilderEntryDraft = () => {
  builderPrompt.value = '';
  builderAttachments.value = [];
  builderProviderId.value = '';
  builderModelId.value = '';
  builderModel.value = '';
  applyFirstExplicitModelSelection();
};

const handleBuilderAttachmentSelect = (payload: AiAttachmentSelectionEventPayload) => {
  builderAttachments.value = payload.attachments;
};

const handleBuilderAttachmentRemove = (payload: AiAttachmentSelectionEventPayload) => {
  builderAttachments.value = payload.attachments;
};

const handleModelChange = (value: string) => {
  const option = modelSelectorOptions.value.find(item => item.value === value);
  if (!option) {
    return;
  }
  builderProviderId.value = option.providerId || '';
  builderModelId.value = option.modelId || '';
  builderModel.value = option.model || '';
};

const handleLoginClick = () => dialogState.show('loginDialogVisible');

const handleOtherOptionsClick = () => {
  router.push({
    name: 'Organize',
    query: { tab: 'aiModelManage' },
  });
};

const createEmptyNocode = async (
  name: string,
  description: string,
  formData: FormData | null,
  groupId: string,
  options?: {
    aiEntry?: 'builder-home',
    initialPrompt?: string,
    initialAttachments?: AiAttachment[],
    initialModelSelection?: AiThreadModelSelection,
    source?: BlankNocodeCreationSource,
  },
)=>{
  if(!name || !name.trim()){
    ElMessage.warning(i18next.t("nocodeCreationDialog.nameEmptyTip"));
    return;
  }
  if (isBusy.value) return;

  const behavior = resolveBlankNocodeCreationBehavior({
    autoOpen: props.autoOpen,
  });
  blankCreationSource.value = options?.source || 'dialog';

  let data = await createEmptyNocodeShell({
    name,
    description,
    groupId,
  }).catch(() => {
    // ElMessage.error(response?.data?.message);
  });
  if (!data) {
    blankCreationSource.value = null;
    return;
  }
  nocodeList.value.unshift(data);
  updateOpeningList('open', data.id)
  if (formData) {
    formData.append('nocodeId', data.id);
    await projectApi.uploadNocodeSnapshot({
      nocodeId: data.id,
      formData,
    }).catch((err) => {
      console.log('snapshot save failed: ', err);
    });
  }
  const initialPrompt = String(options?.initialPrompt || '').trim();
  if (initialPrompt) {
    persistPendingBuilderInitialPrompt(data.id, initialPrompt);
  }
  const initialAttachments = Array.isArray(options?.initialAttachments)
    ? options.initialAttachments.filter(item => item?.id && item?.name && item?.kind)
    : [];
  if (initialAttachments.length) {
    stageNocodeEditorBuilderAttachments(data.id, initialAttachments);
  }
  if (options?.initialModelSelection) {
    stageNocodeEditorBuilderModelSelection(data.id, options.initialModelSelection);
  }
  if (behavior.shouldAutoNavigate) {
    try {
      await router.push(buildNocodeEditorRoute(data.id, {
        query: options?.aiEntry ? { aiEntry: options.aiEntry } : undefined,
      }));
      dialogState.hide('NocodeCreationInfoDialogVisible');
      dialogState.hide('NocodeCreationDialogVisible');
      emit("update:modelValue",false);
      return data;
    } finally {
      blankCreationSource.value = null;
    }
  }

  blankCreationSource.value = null;
  dialogState.hide('NocodeCreationInfoDialogVisible');
  dialogState.hide('NocodeCreationDialogVisible');
  emit("update:modelValue",false);
  if (behavior.shouldRefreshWorkbench) {
    emit("closed");
  }
  return data;
}

const clickCreateButton = () => {
  if (isBusy.value) {
    return;
  }
  dialogState.show('NocodeCreationInfoDialogVisible');
}

const handleBuilderSubmit = async () => {
  const prompt = builderPrompt.value.trim();
  const attachments = builderAttachments.value.map(item => ({
    ...item,
    uploadHandle: item.uploadHandle?.fullPath
      ? {
        id: item.uploadHandle.id,
        fullPath: item.uploadHandle.fullPath,
        sessionId: item.uploadHandle.sessionId,
        originFilePath: item.uploadHandle.originFilePath,
      }
      : undefined,
  })).filter(item => item.status !== 'error');
  if ((!prompt && !attachments.length) || isBusy.value) {
    return;
  }
  if (!canSubmitBuilder()) {
    return;
  }

  const modelSelection = effectiveModelOption.value
    ? {
      modelSelectionSource: 'explicit' as const,
      providerId: effectiveModelOption.value.providerId,
      modelId: effectiveModelOption.value.modelId,
      model: effectiveModelOption.value.model,
    }
    : undefined;
  const created = await createEmptyNocode(
    i18next.t('NocodeCreateInfoDialog.myLowCodeApp'),
    prompt,
    null,
    '',
    {
      aiEntry: 'builder-home',
      initialPrompt: prompt,
      initialAttachments: attachments,
      initialModelSelection: modelSelection,
      source: 'builder',
    },
  );
  if (created) {
    resetBuilderEntryDraft();
  }
};

const openMarketPage = () => {
  if (isBusy.value) {
    return;
  }
  emit("update:modelValue", false);
  emit("closed");
  router.push("/market");
};

watch(() => props.modelValue, async (value) => {
  if (value) {
    await aiConfigStore.loadCatalog().catch(() => null);
    applyFirstExplicitModelSelection();
    void nextTick(() => {
      builderChatInputRef.value?.focusTextarea();
    });
  } else {
    resetBuilderEntryDraft();
  }
})

const dialogState = useDialogStore();
</script>

<style lang="scss" scoped>
:deep(.creation-dialog) {
  border-radius: 8px;
  --el-dialog-bg-color: #ffffff;
  --el-dialog-padding-primary: 0;
  overflow: hidden;
  padding: 24px;

  .el-dialog__close {
    font-size: 16px;
  }
}

.dialog-header__title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.project-creation {
  position: relative;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  background: #ffffff;
}

.hero-section {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: 48px;
}

.hero-title {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  margin: 0 0 32px;
  font-size: 28px;
  line-height: 40px;
  font-weight: 600;
  text-align: center;
  color: #1d2129;
}

.builder-composer {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;

  &.has-login-prompt {
    border-radius: 16px;
    background: #f7f8fa;
  }
}

.hero-title__accent {
  color: #1f77ff;
}

.creation-methods {
  margin-top: 40px;
  margin-bottom: 32px;
  display: flex;
  flex-direction: column;

  &.is-disabled {
    opacity: 0.72;
  }
}

.creation-methods__title {
  margin: 0 0 12px;
  font-size: 16px;
  line-height: 24px;
  color: #1d2129;
  font-weight: 500;
}

.creation-methods__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.creation-method {
  position: relative;
  height: 88px;
  min-width: 0;
  padding: 12px 16px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  overflow: hidden;
  text-align: left;
  color: #1d2129;
  cursor: var(--cursor-pointer);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    border-color: #94c8ff;
    box-shadow: 0 6px 16px rgba(31, 119, 255, 0.08);
  }

  &:disabled {
    cursor: not-allowed;
    box-shadow: none;
  }
}

.creation-method--blank {
  display: flex;
  align-items: flex-start;
  background-color: #f7f8fa;
  background-image: url('@renderer/assets/image/workbench/create-empty-app.jpg');
  background-position: center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
}

.creation-method--template {
  background-color: #f1f8ff;
  background-image: url('@renderer/assets/image/workbench/create-app-by-model.jpg');
  background-position: center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
}

.creation-method__content {
  position: relative;
  z-index: 2;
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
}

.creation-method__label {
  position: relative;
  z-index: 2;
  font-size: 14px;
  line-height: 22px;
}

.creation-method__arrow {
  color: #1f77ff;
}

@media (max-width: 768px) {
  :deep(.creation-dialog) {
    .el-dialog__header {
      padding: 16px 16px 0;
    }

    .el-dialog__headerbtn {
      top: 16px;
      right: 12px;
    }

    .el-dialog__body {
      padding: 0 16px 18px;
    }
  }

  .hero-section {
    margin-top: 24px;
  }

  .hero-title {
    margin-bottom: 24px;
    padding-left: 0;
    font-size: 18px;
    line-height: 28px;
  }

  .creation-methods__grid {
    grid-template-columns: 1fr;
  }
}
</style>
