<template>
  <div v-loading="loading" class="ai-model-manage-page">
    <div class="model-management-content">
      <section class="default-model-section">
        <el-alert
          v-if="hasNoConfiguredDefaultModels"
          class="default-model-alert"
          type="warning"
          :title="$t('workbenchAiSettingsPanel.defaultModelMissingWarning')"
          :closable="false"
          show-icon
        />
        <div class="section-header">
          <div>
            <h3>{{ $t('workbenchAiSettingsPanel.tierDefaultModels') }}</h3>
            <p>{{ $t('workbenchAiSettingsPanel.tierDefaultModelsDescription') }}</p>
          </div>
          <el-switch
            v-model="draft.autoTaskEnabled"
            :aria-label="$t('workbenchAiSettingsPanel.autoTaskEnabled')"
            size="small"
            @change="handleAutoTaskEnabledChange"
          />
        </div>
        <div class="tier-default-grid">
          <div v-for="tier in tierRows" :key="tier.value" class="tier-default-card">
            <label>{{ tier.label }}</label>
            <el-select
              :model-value="getTierDefaultValue(tier.value)"
              :placeholder="$t('workbenchAiSettingsPanel.selectModelPlaceholder')"
              :disabled="!draft.autoTaskEnabled"
              clearable
              @change="value => handleTierDefaultChange(tier.value, String(value || ''))"
            >
              <template #label="{ label }">
                <span>{{ isTierDefaultModelUnavailable(tier.value) ? $t('workbenchAiSettingsPanel.noDefaultModel') : label }}</span>
              </template>
              <el-option
                :label="$t('workbenchAiSettingsPanel.noDefaultModel')"
                value=""
              />
              <el-option-group
                v-for="group in getTierDefaultOptionGroups()"
                :key="group.key"
                :label="group.label"
              >
                <el-option
                  v-for="option in group.options"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-option-group>
            </el-select>
          </div>
        </div>
      </section>

      <section class="section-card--fill service-management-section">
        <div class="management-layout">
          <aside class="provider-rail">
            <el-menu
              :default-active="activeProviderId"
              class="provider-menu"
              @select="selectProvider"
            >
              <template v-for="provider in draft.providers" :key="provider.id">
                <el-menu-item
                  v-if="!isBuiltinProvider(provider)"
                  :index="provider.id"
                  @contextmenu.prevent.stop="openProviderContextMenu($event, provider)"
                >
                  <span class="provider-item__icon" :class="{ 'is-ollama': provider.type === 'ollama' }">
                    <el-icon v-if="provider.type === 'ollama'" :size="14"><i-ven-ollama /></el-icon>
                    <span v-else>{{ getProviderInitial(provider) }}</span>
                  </span>
                  <span class="provider-item__name">{{ getProviderDisplayName(provider) }}</span>
                  <span v-if="provider.enabled" class="provider-item__status">
                    {{ $t('workbenchAiSettingsPanel.enabledStatus') }}
                  </span>
                </el-menu-item>
                <el-menu-item v-else :index="provider.id">
                  <span class="provider-item__icon is-builtin">
                    <el-icon :size="14"><i-ven-logo /></el-icon>
                  </span>
                  <span class="provider-item__name">{{ getProviderDisplayName(provider) }}</span>
                  <span v-if="provider.enabled" class="provider-item__status">
                    {{ $t('workbenchAiSettingsPanel.enabledStatus') }}
                  </span>
                </el-menu-item>
              </template>
            </el-menu>
            <el-menu
              v-show="providerContextMenuVisible"
              class="provider-context-menu provider-context-right-sub-menu"
              :style="{
                left: `${providerContextMenuPosition.left}px`,
                top: `${providerContextMenuPosition.top}px`,
              }"
              @click.stop
              @contextmenu.prevent
              @select="handleProviderContextCommand"
            >
              <el-menu-item index="edit">
                <el-icon><i-ep-edit /></el-icon>
                <span>{{ $t('workbenchAiSettingsPanel.editProvider') }}</span>
              </el-menu-item>
              <el-menu-item index="delete" class="provider-context-menu__item--danger">
                <el-icon><i-ep-delete /></el-icon>
                <span>{{ $t('workbenchAiSettingsPanel.deleteProvider') }}</span>
              </el-menu-item>
            </el-menu>
            <el-button
              class="add-provider-button"
              @click="openProviderDialog"
            >
              <template #icon>
                <el-icon><i-ep-plus /></el-icon>
              </template>
              {{ $t('workbenchAiSettingsPanel.add') }}
            </el-button>
          </aside>

          <div v-if="activeProvider" class="provider-detail">
            <section class="detail-panel provider-config-panel">
              <div class="provider-title-row">
                <div class="provider-title-row__main">
                  <h4>{{ getProviderDisplayName(activeProvider) }}</h4>
                  <a href="https://www.banban.work" target="_black" v-if="isBuiltinProvider(activeProvider)" class="provider-title-row__link">
                    <el-icon><i-ven-jump /></el-icon>
                  </a>
                </div>
                <div class="toolbar-actions">
                  <el-switch
                    v-model="activeProvider.enabled"
                    :disabled="isProviderLoginLocked(activeProvider) || isProviderBusy(activeProvider)"
                    size="small"
                    @change="value => persistProviderFieldChange(activeProvider, 'enabled', value)"
                  />
                </div>
              </div>
              <div v-if="isBuiltinProvider(activeProvider) && isBuiltinAccountAccessLocked" class="login-required-card">
                <div class="login-required-card__icon"><el-icon><i-ven-logo /></el-icon></div>
                <div class="login-required-card__text">
                  <h3>{{ $t('workbenchAiSettingsPanel.loginRequiredTitle') }}</h3>
                  <p>{{ $t('workbenchAiSettingsPanel.loginRequiredDescription') }}</p>
                </div>
                <p v-if="showAdminLoginPrompt" class="login-required-card__admin-only">
                  {{ $t('workbenchAiSettingsPanel.loginRequiredAdminOnly') }}
                </p>
                <el-button v-else type="primary" @click="openLoginDialog">{{ $t('workbenchAiSettingsPanel.login') }}</el-button>
              </div>
              <div v-else-if="isBuiltinProvider(activeProvider)" class="builtin-account-panel">
                <div class="builtin-account-panel__user">
                  {{ passportState.showUserNickname }}
                  <el-button v-if="passportState.isMainAccount" text size="small" bg @click="handleSoftwareLogout">
                    <template #icon>
                      <el-icon :size="14"><i-icon-park-outline-logout /></el-icon>
                    </template>
                    {{ $t('workbenchAiSettingsPanel.logout') }}
                  </el-button>
                </div>
                <div class="toolbar-actions builtin-account-panel__coin-row">
                  <div class="builtin-account-panel__coin">
                    <el-icon :size="16"><i-ven-ai-star /></el-icon>
                    {{ $t('workbenchAiSettingsPanel.points') }}: <span class="builtin-account-panel-coin__number">{{ softwareCoinBalance }}</span>
                  </div>
                  <el-button type="primary" @click="rechargeDrawerVisible = true">{{ $t('WorkbenchRechargeManagement.rechargeNow') }}</el-button>
                </div>
              </div>

              <div v-else class="external-provider-config">
                <div v-if="activeProvider.type === 'openai-compatible'" class="field-block field-block--with-action">
                  <label>{{ $t('workbenchAiSettingsPanel.apiKey') }}</label>
                  <div class="field-action-row">
                    <el-input
                      v-model.trim="activeProvider.apiKey"
                      type="password"
                      clearable
                      :disabled="isProviderBusy(activeProvider)"
                      placeholder="sk-proj-..."
                      @change="value => persistProviderFieldChange(activeProvider, 'apiKey', value)"
                    />
                    <el-button
                      :loading="hasPendingModelValidation(activeProvider)"
                      :type="getProviderValidationButtonType(activeProvider)"
                      :title="getProviderValidationMessage(activeProvider)"
                      plain
                      :disabled="isProviderValidationEntryDisabled(activeProvider)"
                      @click="openModelValidationDialog(activeProvider)"
                    >
                      <template #icon v-if="hasProviderValidationPassed(activeProvider) || hasProviderValidationFailed(activeProvider)">
                        <el-icon v-if="hasProviderValidationPassed(activeProvider)"><i-ep-check /></el-icon>
                        <el-icon v-else-if="hasProviderValidationFailed(activeProvider)"><i-ep-refresh-right /></el-icon>
                      </template>
                      {{ getProviderValidationButtonLabel(activeProvider) }}
                    </el-button>
                  </div>
                  <p class="field-help-text" v-if="false">{{ $t('workbenchAiSettingsPanel.apiKeySeparatorTip') }}</p>
                  <p class="field-tip-text">{{ $t('workbenchAiSettingsPanel.apiKeyEncryptedTip') }}</p>
                </div>
                <div class="field-block">
                  <label>{{ $t('workbenchAiSettingsPanel.serviceUrl') }}</label>
                  <div class="field-action-row">
                    <el-input
                      v-model.trim="activeProvider.baseUrl"
                      :disabled="isProviderBusy(activeProvider)"
                      :placeholder="activeProvider.type === 'ollama' ? 'http://localhost:11434/v1' : 'https://example.com/v1'"
                      @change="value => persistProviderFieldChange(activeProvider, 'baseUrl', value)"
                    />
                    <el-button
                      v-if="activeProvider.type === 'ollama'"
                      :loading="hasPendingModelValidation(activeProvider)"
                      :type="getProviderValidationButtonType(activeProvider)"
                      :title="getProviderValidationMessage(activeProvider)"
                      plain
                      :disabled="isProviderValidationEntryDisabled(activeProvider)"
                      @click="openModelValidationDialog(activeProvider)"
                    >
                      <template #icon v-if="hasProviderValidationPassed(activeProvider) || hasProviderValidationFailed(activeProvider)">
                        <el-icon v-if="hasProviderValidationPassed(activeProvider)"><i-ep-check /></el-icon>
                        <el-icon v-else-if="hasProviderValidationFailed(activeProvider)"><i-ep-refresh-right /></el-icon>
                      </template>
                      {{ getProviderValidationButtonLabel(activeProvider) }}
                    </el-button>
                  </div>
                  <p v-if="getProviderEndpointPreview(activeProvider)" class="field-help-text field-help-text--preview">
                    {{ $t('workbenchAiSettingsPanel.serviceUrlPreview') }}{{ getProviderEndpointPreview(activeProvider) }}
                  </p>
                </div>
                <p v-if="activeProvider.lastHealthMessage" class="provider-feedback-text">{{ activeProvider.lastHealthMessage }}</p>
              </div>
            </section>

            <section class="detail-panel model-list-panel">
              <div class="model-list-header">
                <h4>{{ $t('workbenchAiSettingsPanel.models') }} <span>{{ getManagedModelDisplayCount(activeProvider) }}</span></h4>
                <div class="model-list-header__actions">
                  <el-tooltip :content="$t('WorkbenchAiHealthCheckDialog.title')" placement="top" effect="light">
                    <el-button
                      class="health-check-button"
                      circle
                      text
                      :loading="isProviderHealthActionRunning(activeProvider)"
                      :disabled="isProviderLoginLocked(activeProvider) || !getManagedModelDisplayCount(activeProvider) || isProviderBusy(activeProvider)"
                      @click="handleProviderHealthAction(activeProvider)"
                    >
                      <template #icon>
                        <el-icon v-if="!isProviderHealthActionRunning(activeProvider)"><i-ven-check-all-ai /></el-icon>
                      </template>
                    </el-button>
                  </el-tooltip>
                  <el-button
                    size="small"
                    :disabled="isProviderLoginLocked(activeProvider) || isProviderBusy(activeProvider)"
                    @click="openModelPickerDialog(activeProvider.id)"
                  >{{ $t('workbenchAiSettingsPanel.add') }}</el-button>
                </div>
              </div>

              <el-empty
                v-if="!getManagedModelDisplayCount(activeProvider)"
                :description="$t('workbenchAiSettingsPanel.emptyAddedModels')"
                :image-size="56"
              />

              <el-collapse
                v-else
                v-model="expandedManagedModelGroupKeys"
                class="managed-model-list managed-model-groups"
              >
                <el-collapse-item
                  v-for="group in managedModelGroups"
                  :key="group.key"
                  :name="group.key"
                  class="managed-model-group"
                >
                  <template #title>
                    <div class="managed-model-group__title">
                      <span>{{ group.name }}</span>
                      <el-button
                        circle
                        text
                        class="managed-model-group__delete"
                        :title="$t('workbenchAiSettingsPanel.deleteModelGroup')"
                        :disabled="isProviderLoginLocked(activeProvider) || isProviderBusy(activeProvider)"
                        @click.stop="handleDeleteModelGroup(activeProvider, group)"
                      >
                        <el-icon><i-ep-minus /></el-icon>
                      </el-button>
                    </div>
                  </template>
                  <div class="managed-model-group__list">
                    <div
                      v-for="model in group.models"
                      :key="model.id"
                      class="managed-model-row"
                    >
                  <div class="managed-model-row__main">
                    <span class="model-status-mark" :class="{ 'is-enabled': model.enabled }"></span>
                    <div>
                      <div class="model-title__name-line">
                        <span>{{ getModelDisplayName(activeProvider, model) }}</span>
                        <el-tag
                          v-for="label in getSystemDefaultModelTagLabels(activeProvider, model)"
                          :key="label"
                          size="small"
                          type="primary"
                        >{{ label }}</el-tag>
                      </div>
                    </div>
                  </div>
                  <div class="managed-model-row__actions">
                    <div v-if="isModelHealthChecking(activeProvider, model)" class="model-health-status is-checking">
                      <el-icon class="is-loading"><i-ep-loading /></el-icon>
                    </div>
                    <el-tooltip
                      v-else-if="getModelHealthResult(activeProvider, model)"
                      placement="top"
                      :show-after="200"
                      effect="light"
                    >
                      <template #content>
                        <div class="model-health-tooltip">
                          <div
                            v-for="keyResult in getModelHealthResult(activeProvider, model)?.keyResults"
                            :key="keyResult.keyIndex"
                            class="model-health-tooltip__item"
                          >
                            <strong :class="keyResult.success ? 'is-passed' : 'is-failed'">
                              {{ keyResult.success ? $t('WorkbenchAiHealthCheckDialog.passed') : $t('WorkbenchAiHealthCheckDialog.failed') }}
                            </strong>
                            <span>{{ getHealthCheckKeyLabel(activeProvider, keyResult.keyIndex) }}</span>
                            <span v-if="keyResult.success">
                              {{ $t('WorkbenchAiHealthCheckDialog.durationLabel') }}{{ formatModelHealthDuration(keyResult.durationMs) }}
                            </span>
                            <span v-else-if="keyResult.message">{{ keyResult.message }}</span>
                          </div>
                        </div>
                      </template>
                      <div class="model-health-status" :class="`is-${getModelHealthStatus(activeProvider, model)}`">
                        <span v-if="getModelHealthLatency(activeProvider, model)" class="model-health-latency">
                          {{ getModelHealthLatency(activeProvider, model) }}
                        </span>
                        <el-icon>
                          <i-ep-circle-check-filled v-if="getModelHealthStatus(activeProvider, model) === 'passed'" />
                          <i-ep-warning-filled v-else-if="getModelHealthStatus(activeProvider, model) === 'partial'" />
                          <i-ep-circle-close-filled v-else />
                        </el-icon>
                      </div>
                    </el-tooltip>
                    <el-button
                      circle
                      text
                      :title="$t('workbenchAiSettingsPanel.modelSettings')"
                      :disabled="isModelActionLocked(activeProvider, model)"
                      @click="openModelEditDialog(activeProvider, model)"
                    >
                      <el-icon><i-ep-setting /></el-icon>
                    </el-button>
                    <el-button
                      class="model-delete-button"
                      circle
                      text
                      :title="$t('workbenchAiSettingsPanel.delete')"
                      :disabled="isModelActionLocked(activeProvider, model)"
                      @click="handleDeleteModel(activeProvider, model)"
                    ><el-icon><i-ep-minus /></el-icon></el-button>
                  </div>
                </div>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </section>
          </div>

          <div v-else class="provider-detail provider-detail--empty">
            <el-empty :description="$t('workbenchAiSettingsPanel.emptyModelServices')">
              <el-button type="primary" @click="openProviderDialog">{{ $t('workbenchAiSettingsPanel.addModelService') }}</el-button>
            </el-empty>
          </div>
        </div>
      </section>
    </div>

    <workbench-ai-provider-dialog
      v-model="providerDialogVisible"
      :provider-form="providerForm"
      :provider-type-options="providerTypeOptions"
      :editing="providerDialogEditing"
      @type-change="handleProviderTypeChange"
      @field-change="handleProviderFieldChange"
      @confirm="handleSaveProvider"
    />

    <workbench-ai-model-picker-dialog
      v-model="modelPickerDialogVisible"
      v-model:keyword="modelPickerKeyword"
      :provider="currentModelProvider"
      :models="filteredAvailableModels"
      :syncing="isProviderSyncing(currentModelProvider)"
      :action-disabled="isProviderActionDisabled(currentModelProvider, 'syncing')"
      :provider-busy="isProviderBusy(currentModelProvider)"
      :is-model-already-added="isModelAlreadyAdded"
      :get-model-display-name="getModelPickerDisplayName"
      :should-show-model-raw-name="shouldShowModelRawName"
      @sync="handleRefreshPickerModels"
      @add="handleAddModelFromAvailable"
      @add-all="handleAddAllModels"
      @remove="handleRemoveModelFromPicker"
    />

    <workbench-ai-model-validation-dialog
      v-model="modelValidationDialogVisible"
      :provider="modelValidationProvider"
      :models="modelValidationModels"
      :submitting="hasPendingModelValidation(modelValidationProvider)"
      :error-message="getProviderValidationMessage(modelValidationProvider)"
      :get-model-display-name="getModelDisplayName"
      @confirm="handleValidateSelectedModel"
    />

    <workbench-ai-model-edit-dialog
      v-model="modelEditDialogVisible"
      :model="modelEditModel"
      :disabled="isModelActionLocked(modelEditProvider, modelEditModel)"
      @confirm="handleSaveModelEdit"
    />

    <workbench-ai-health-check-dialog
      v-model="modelHealthCheckDialogVisible"
      @start="handleStartModelHealthCheck"
    />

    <el-drawer
      v-model="rechargeDrawerVisible"
      :title="$t('WorkbenchRechargeManagement.rechargeManagement')"
      direction="rtl"
      class="workbench-recharge-drawer"
      size="70%"
      append-to-body
      destroy-on-close
    >
      <workbench-recharge-management embedded />
    </el-drawer>

    <nocode-login-dialog
      v-model="dialogState.loginDialogVisible"
      @update:model-value="dialogState.loginDialogVisible = $event"
    />

    <exit-dialog
      v-model="softwareLogoutDialogVisible"
      @confirm-exit="softwareLogoutDialogVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, h, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'
import type {
  AiModelCatalogItem,
  AiModelCapability,
  AiModelHealthCheckResult,
  AiModelTier,
  AiProviderConfig,
  AiProviderModel,
  AiSettings,
} from '@common/types/ai-provider'
import {
  AI_MODEL_CAPABILITIES,
  AI_MODEL_MODALITIES,
  normalizeAiModelCapabilities,
  normalizeAiModelModalities,
} from '@common/utils/aiModelCapabilities'
import {
  BUILTIN_AI_PROVIDER_ID,
  getAiModelDisplayName,
  getAiModelTierDefaultBadgeLabel,
  getAiModelTierLabel,
  isAiModelTierDefaultSelection,
  serializeAiTierSelectionValue,
  setAiTierDefaultSelection,
  shouldExposeAiModelRawName,
} from '@common/utils/aiProvider'
import { useAiConfigStore, useDialogStore, usePassportStore } from '@renderer/stores'
import {
  createWorkbenchAiSettingsMutationSnapshot,
  withRollbackOnSaveFailure,
  type WorkbenchAiSettingsMutationState,
} from './workbenchAiSettingsRollback'
import { createSingleFlightSaveQueue } from './workbenchAiSettingsSaveQueue'
import i18next from 'i18next';
import WorkbenchRechargeManagement from '@renderer/views/nocode/views/workbench/rechargeManagement/WorkbenchRechargeManagement.vue'
import NocodeLoginDialog from '@renderer/views/nocode/dialog/NocodeLoginDialog.vue'
import ExitDialog from '@renderer/views/nocode/dialog/ExitDialog.vue'
import WorkbenchAiModelPickerDialog from './WorkbenchAiModelPickerDialog.vue'
import WorkbenchAiModelValidationDialog from './WorkbenchAiModelValidationDialog.vue'
import WorkbenchAiProviderDialog from './WorkbenchAiProviderDialog.vue'
import WorkbenchAiHealthCheckDialog from './WorkbenchAiHealthCheckDialog.vue'
import WorkbenchAiModelEditDialog from './WorkbenchAiModelEditDialog.vue'

type ProviderFormType = 'ollama' | 'openai-compatible'
type ProviderPendingAction = 'syncing'
type ManagedModelGroup = {
  key: string
  name: string
  models: AiProviderModel[]
}
type TierDefaultOption = {
  value: string
  label: string
}
type TierDefaultOptionGroup = {
  key: string
  label: string
  options: TierDefaultOption[]
}

const createEmptySettings = (): AiSettings => ({
  enabled: true,
  autoTaskEnabled: false,
  allowModelSelection: true,
  defaultSelections: {
    fast: null,
    balanced: null,
    deep: null,
  },
  defaultProviderId: null,
  defaultModelId: null,
  providers: [],
})

const createProviderForm = () => ({
  type: 'openai-compatible' as ProviderFormType,
  name: i18next.t('workbenchAiSettingsPanel.openaiCompatibleProvider'),
  baseUrl: '',
  apiKey: '',
})

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const aiConfigStore = useAiConfigStore()
const passportState = usePassportStore()
const dialogState = useDialogStore()
const loading = computed(() => aiConfigStore.configLoading || aiConfigStore.catalogLoading)
const draft = ref<AiSettings>(createEmptySettings())
const isLoggedIn = computed(() => passportState.isLoginUser)
const showAdminLoginPrompt = computed(() => (
  passportState.isLoginAccount && !passportState.isMainAccount
))
const isBuiltinAccountAccessLocked = computed(() => !isLoggedIn.value)

const softwareCoinBalance = computed(() => Number(passportState.user?.coin || 0).toLocaleString())
const rechargeDrawerVisible = ref(false)
const softwareLogoutDialogVisible = ref(false)
const openLoginDialog = () => {
  dialogState.show('loginDialogVisible')
}
const handleSoftwareLogout = () => {
  softwareLogoutDialogVisible.value = true
}
const activeProviderId = ref('')
const providerContextMenuVisible = ref(false)
const providerContextMenuProviderId = ref('')
const providerContextMenuPosition = reactive({ left: 0, top: 0 })
const providerDialogVisible = ref(false)
const providerDialogEditing = ref(false)
const providerDialogProviderId = ref('')
const modelPickerDialogVisible = ref(false)
const modelValidationDialogVisible = ref(false)
const modelValidationProviderId = ref('')
const modelEditDialogVisible = ref(false)
const modelEditProviderId = ref('')
const modelEditModelId = ref('')
const modelHealthCheckDialogVisible = ref(false)
const modelHealthCheckProviderId = ref('')
const modelHealthCheckRunning = ref(false)
const modelHealthCheckResults = reactive<Record<string, AiModelHealthCheckResult | undefined>>({})
const modelHealthCheckingMap = reactive<Record<string, boolean>>({})
const modelHealthCheckApiKeys = ref<string[]>([])
const modelHealthCheckAbortControllers = new Set<AbortController>()
let modelHealthCheckRunToken = 0
const activeModelProviderId = ref('')
const expandedManagedModelGroupKeys = ref<string[]>([])
const modelPickerKeyword = ref('')
const providerForm = reactive(createProviderForm())
const providerPendingActionMap = reactive<Record<string, ProviderPendingAction | undefined>>({})
const modelValidatingMap = reactive<Record<string, boolean>>({})
const providerValidationResults = reactive<Record<string, { success: boolean; message?: string | null }>>({})
let providerValidationRunToken = 0
let providerValidationAbortController: AbortController | null = null
let modelValidationCloseAfterSubmit = false

const providerTypeOptions = computed<Array<{ value: ProviderFormType; label: string; description: string }>>(() => [
  { value: 'openai-compatible', label: i18next.t('workbenchAiSettingsPanel.openaiCompatibleProvider'), description: i18next.t('workbenchAiSettingsPanel.openaiProviderDescription') },
  { value: 'ollama', label: 'Ollama', description: i18next.t('workbenchAiSettingsPanel.ollamaProviderDescription') },
])

const serializeSettings = (value: AiSettings) => JSON.stringify(value)
const createSaveRequest = () => ({
  snapshot: serializeSettings(draft.value),
  payload: clone(draft.value),
})
const saveQueue = createSingleFlightSaveQueue<AiSettings, AiSettings>({
  persist: async payload => await aiConfigStore.saveConfig(payload),
  getSavedSnapshot: saved => serializeSettings(saved),
})
const getModelPendingKey = (providerId?: string | null, modelId?: string | null) => `${String(providerId || '').trim()}::${String(modelId || '').trim()}`
const getModelToolCapabilities = (model?: AiProviderModel | null) => ({
  auto: Boolean(model?.toolCapabilities?.auto ?? model?.supportsTools),
  requireAny: Boolean(model?.toolCapabilities?.requireAny),
  requireSpecific: Boolean(model?.toolCapabilities?.requireSpecific),
  parallel: Boolean(model?.toolCapabilities?.parallel),
})

const setModelVisionCapability = (model: AiProviderModel, enabled: boolean) => {
  const capabilities = normalizeAiModelCapabilities(model.capabilities)
  const inputModalities = normalizeAiModelModalities(model.inputModalities)
  model.capabilities = enabled
    ? [...new Set([...capabilities, AI_MODEL_CAPABILITIES.IMAGE_RECOGNITION])]
    : capabilities.filter(item => item !== AI_MODEL_CAPABILITIES.IMAGE_RECOGNITION)
  model.inputModalities = enabled
    ? [...new Set([...inputModalities, AI_MODEL_MODALITIES.IMAGE])]
    : inputModalities.filter(item => item !== AI_MODEL_MODALITIES.IMAGE)
  delete model.supportsVision
}
const normalizeInlineText = (value?: string | null) => String(value || '').trim()
const getProviderEndpointPreview = (provider?: Pick<AiProviderConfig, 'type' | 'baseUrl'> | null) => {
  const baseUrl = normalizeInlineText(provider?.baseUrl).replace(/\/+$/, '')
  if (!baseUrl) return ''
  if (/\/chat\/completions$/i.test(baseUrl)) return baseUrl
  if (provider?.type === 'ollama' || /\/v\d+$/i.test(baseUrl)) return `${baseUrl}/chat/completions`
  return `${baseUrl}/v1/chat/completions`
}
const isModelSelectable = (model?: AiProviderModel | null) => Boolean(model?.enabled)
const setProviderPendingAction = (providerId: string, action?: ProviderPendingAction) => {
  if (!providerId) return
  if (action) {
    providerPendingActionMap[providerId] = action
    return
  }
  delete providerPendingActionMap[providerId]
}
const setModelValidatingState = (providerId: string, modelId: string, validating: boolean) => {
  const key = getModelPendingKey(providerId, modelId)
  if (validating) {
    modelValidatingMap[key] = true
    return
  }
  delete modelValidatingMap[key]
}
const isProviderSyncing = (provider?: AiProviderConfig | null) => Boolean(provider && providerPendingActionMap[provider.id] === 'syncing')
const isProviderHealthChecking = (provider?: AiProviderConfig | null) => Boolean(
  provider && modelHealthCheckRunning.value && modelHealthCheckProviderId.value === provider.id,
)
const isProviderHealthActionRunning = (provider?: AiProviderConfig | null) => Boolean(
  provider && isProviderHealthChecking(provider),
)
const isProviderLoginLocked = (provider?: AiProviderConfig | null) => Boolean(
  provider && isBuiltinProvider(provider) && isBuiltinAccountAccessLocked.value,
)
const hasPendingModelValidation = (provider?: AiProviderConfig | null) => Boolean(
  provider && Object.keys(modelValidatingMap).some(key => key.startsWith(`${provider.id}::`) && modelValidatingMap[key]),
)
const isProviderBusy = (provider?: AiProviderConfig | null) => Boolean(
  provider && (providerPendingActionMap[provider.id] || hasPendingModelValidation(provider) || isProviderHealthChecking(provider)),
)
const isProviderActionDisabled = (provider?: AiProviderConfig | null, action?: ProviderPendingAction) => {
  if (!provider || isProviderLoginLocked(provider)) return true
  if (!action) return false
  return isProviderBusy(provider)
}
const isModelActionLocked = (provider?: AiProviderConfig | null, model?: AiProviderModel | null) => {
  if (!provider || !model || isProviderLoginLocked(provider)) return true
  return isProviderBusy(provider)
}
const isValidateButtonDisabled = (provider?: AiProviderConfig | null, model?: AiProviderModel | null) => {
  if (!provider || !model || isProviderLoginLocked(provider)) return true
  return isProviderBusy(provider)
}
const resolveErrorMessage = (error: any, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as any)?.message || error.message || fallback
  }
  if (error instanceof Error) {
    return error.message || fallback
  }
  return fallback
}
const getProviderSelectableModels = (providerId?: string | null) => {
  const provider = draft.value.providers.find(item => item.id === providerId)
  return provider?.enabled ? provider.models.filter(model => isModelSelectable(model)) : []
}
const isBuiltinProvider = (provider?: Pick<AiProviderConfig, 'type'> | null) => provider?.type === 'builtin-cloud'
const tierRows = [
  { value: 'fast', get label() { return i18next.t('workbenchAiSettingsPanel.fastDefault') } },
  { value: 'balanced', get label() { return i18next.t('workbenchAiSettingsPanel.balancedDefault') } },
  { value: 'deep', get label() { return i18next.t('workbenchAiSettingsPanel.deepDefault') } },
] as const
const getManagedModels = (provider?: AiProviderConfig | null) => {
  if (!provider) return []
  return provider.models
}
const getManagedModelDisplayCount = (provider?: AiProviderConfig | null) => getManagedModels(provider).length

const activeProvider = computed(() => draft.value.providers.find(item => item.id === activeProviderId.value) || null)
const currentModelProvider = computed(() => draft.value.providers.find(item => item.id === activeModelProviderId.value) || null)
const modelValidationProvider = computed(() => draft.value.providers.find(item => item.id === modelValidationProviderId.value) || null)
const modelEditProvider = computed(() => draft.value.providers.find(item => item.id === modelEditProviderId.value) || null)
const modelEditModel = computed(() => modelEditProvider.value?.models.find(item => item.id === modelEditModelId.value) || null)
const modelHealthCheckProvider = computed(() => draft.value.providers.find(item => item.id === modelHealthCheckProviderId.value) || null)
const getProviderValidationModels = (provider?: AiProviderConfig | null) => {
  return provider?.models || []
}
const modelValidationModels = computed(() => getProviderValidationModels(modelValidationProvider.value))
const getProviderDisplayName = (provider?: Pick<AiProviderConfig, 'name' | 'type'> | null) => (
  isBuiltinProvider(provider) ? i18next.t('workbenchAiSettingsPanel.builtinProviderName') : (provider?.name || '')
)
const getProviderInitial = (provider?: Pick<AiProviderConfig, 'name' | 'type'> | null) => (
  Array.from(getProviderDisplayName(provider).trim())[0] || '?'
)
const getModelDisplayName = (provider?: Pick<AiProviderConfig, 'type'> | null, model?: AiProviderModel | null) =>
  getAiModelDisplayName(model?.displayName, provider?.type, model?.model)
const getModelPickerDisplayName = (provider?: Pick<AiProviderConfig, 'type'> | null, model?: AiProviderModel | null) => (
  isBuiltinProvider(provider)
    ? (normalizeInlineText(model?.displayName) || normalizeInlineText(model?.model))
    : getModelDisplayName(provider, model)
)
const getManagedModelGroupName = (model?: AiProviderModel | null) => (
  normalizeInlineText(model?.meta?.group) || i18next.t('workbenchAiSettingsPanel.defaultModelGroup')
)
const managedModelGroups = computed<ManagedModelGroup[]>(() => {
  const provider = activeProvider.value
  if (!provider) return []
  const groups = new Map<string, ManagedModelGroup>()
  getManagedModels(provider).forEach(model => {
    const name = getManagedModelGroupName(model)
    const key = JSON.stringify([provider.id, name])
    const group = groups.get(key)
    if (group) {
      group.models.push(model)
      return
    }
    groups.set(key, { key, name, models: [model] })
  })
  return [...groups.values()]
})
const managedModelGroupKeys = computed(() => managedModelGroups.value.map(group => group.key))
const getModelFullLabel = (provider?: Pick<AiProviderConfig, 'name' | 'type'> | null, model?: AiProviderModel | null) => {
  return getModelDisplayName(provider, model)
}
const interactiveDefaultTier: AiModelTier = 'balanced'
const modelTiers: AiModelTier[] = ['fast', 'balanced', 'deep']
const hasNoConfiguredDefaultModels = computed(() => modelTiers.every(tier => {
  if (!draft.value.autoTaskEnabled) return false
  const selection = draft.value.defaultSelections?.[tier]
  return !selection?.providerId || !selection?.modelId
}))
const syncLegacyInteractiveDefaultFromTierDefaults = () => {
  const interactiveDefaultSelection = draft.value.defaultSelections?.[interactiveDefaultTier] || null
  draft.value.defaultProviderId = interactiveDefaultSelection?.providerId || null
  draft.value.defaultModelId = interactiveDefaultSelection?.modelId || null
}
const syncBuiltinManagedModels = (provider: AiProviderConfig) => {
  if (!isBuiltinProvider(provider)) return
  provider.builtinManagedModels = provider.models
    .map(model => clone(model))
}
const getTierSelectableModels = () => draft.value.providers.flatMap(provider => {
  const managedOptions = (provider.models || [])
    .filter(model =>
      isModelSelectable(model)
      && provider.enabled,
    )
    .map(model => ({
      providerId: provider.id,
      providerName: getProviderDisplayName(provider),
      modelId: model.id,
      label: getModelFullLabel(provider, model),
    }))
  return managedOptions
    .filter((item, index, array) => array.findIndex(candidate =>
      candidate.providerId === item.providerId && candidate.modelId === item.modelId,
    ) === index)
})
const getTierDefaultValue = (tier: AiModelTier) => {
  const selection = draft.value.defaultSelections?.[tier] || null
  return serializeAiTierSelectionValue(selection)
}
const getTierDefaultOptionGroups = () => {
  const groups = new Map<string, TierDefaultOptionGroup>()
  getTierSelectableModels()
    .filter(item => !isBuiltinAccountAccessLocked.value || item.providerId !== BUILTIN_AI_PROVIDER_ID)
    .forEach(item => {
      const group = groups.get(item.providerId) || {
        key: item.providerId,
        label: item.providerName,
        options: [],
      }
      group.options.push({
        value: `${item.providerId}::${item.modelId}`,
        label: item.label,
      })
      groups.set(item.providerId, group)
    })
  return [...groups.values()].sort((left, right) => {
    const leftIsBuiltin = left.key === BUILTIN_AI_PROVIDER_ID
    const rightIsBuiltin = right.key === BUILTIN_AI_PROVIDER_ID
    if (leftIsBuiltin === rightIsBuiltin) return 0
    return leftIsBuiltin ? -1 : 1
  })
}
const isTierDefaultModelUnavailable = (tier: AiModelTier) => {
  const value = getTierDefaultValue(tier)
  if (!value) return false

  return !getTierDefaultOptionGroups().some(group => (
    group.options.some(option => option.value === value)
  ))
}
const handleTierDefaultChange = async (tier: AiModelTier, value: string) => {
  const [providerId, modelId] = String(value || '').split('::')
  const saved = await saveDraftMutationWithRollback(() => {
    draft.value.defaultSelections = setAiTierDefaultSelection(
      draft.value.defaultSelections,
      tier,
      providerId && modelId ? { providerId, modelId } : null,
    )
    syncLegacyInteractiveDefaultFromTierDefaults()
  })
  if (saved) ElMessage.success(i18next.t('workbenchAiSettingsPanel.tierDefaultUpdated', { tier: getAiModelTierLabel(tier) }))
}
const filteredAvailableModels = computed(() => {
  const provider = currentModelProvider.value
  if (!provider) return [] as AiProviderModel[]
  const keyword = String(modelPickerKeyword.value || '').trim().toLowerCase()
  const models = provider.availableModels || []
  return models.filter(model => {
    if (!keyword) return true
    const displayName = getModelPickerDisplayName(provider, model).toLowerCase()
    return displayName.includes(keyword) || model.displayName.toLowerCase().includes(keyword) || model.model.toLowerCase().includes(keyword)
  })
})

const createDraftMutationState = (): WorkbenchAiSettingsMutationState => ({
  draft: clone(draft.value),
  activeProviderId: activeProviderId.value,
  providerDialogVisible: providerDialogVisible.value,
  modelPickerDialogVisible: modelPickerDialogVisible.value,
  activeModelProviderId: activeModelProviderId.value,
  modelPickerKeyword: modelPickerKeyword.value,
})

const restoreDraftMutationState = (snapshot: WorkbenchAiSettingsMutationState) => {
  const restored = createWorkbenchAiSettingsMutationSnapshot(snapshot)
  draft.value = restored.draft
  activeProviderId.value = restored.activeProviderId
  providerDialogVisible.value = restored.providerDialogVisible
  modelPickerDialogVisible.value = restored.modelPickerDialogVisible
  activeModelProviderId.value = restored.activeModelProviderId
  modelPickerKeyword.value = restored.modelPickerKeyword
  syncActiveProvider(activeProviderId.value)
}

const syncActiveProvider = (preferredId?: string | null) => {
  const providerIds = draft.value.providers.map(item => item.id)
  if (!providerIds.length) {
    activeProviderId.value = ''
    return
  }
  if (preferredId && providerIds.includes(preferredId)) {
    activeProviderId.value = preferredId
    return
  }
  if (!providerIds.includes(activeProviderId.value)) {
    activeProviderId.value = providerIds[0]
  }
}

const applySavedDraft = (value: AiSettings) => {
  draft.value = clone(value)
  syncActiveProvider(activeProviderId.value)
}

const createReadonlyProviderFromCatalog = (
  providerId: string,
  items: AiModelCatalogItem[],
): AiProviderConfig => {
  const firstItem = items[0]
  const builtin = firstItem?.providerType === 'builtin-cloud'
  return {
    id: providerId,
    name: builtin ? i18next.t('workbenchAiSettingsPanel.builtinProviderName') : (firstItem?.providerName || providerId),
    type: firstItem?.providerType || 'openai-compatible',
    enabled: true,
    baseUrl: null,
    apiKey: null,
    defaultModelId: items.find(item => item.isDefault)?.modelId || null,
    models: items.map(item => ({
      id: item.modelId,
      model: item.model,
      displayName: item.displayName,
      enabled: true,
      allowInWorkbenchAgent: true,
      supportsTools: item.supportsTools,
      capabilities: item.capabilities,
      inputModalities: item.inputModalities,
      outputModalities: item.outputModalities,
      endpointTypes: item.endpointTypes,
      maxInputTokens: item.maxInputTokens ?? null,
      maxOutputTokens: item.maxOutputTokens ?? null,
      supportsStreaming: item.supportsStreaming,
      contextWindow: item.contextWindow ?? null,
      source: builtin ? 'builtin' : 'sync',
      validationStatus: 'passed',
    })),
    availableModels: [],
    builtinManagedModels: builtin
      ? items.map(item => ({
          id: item.modelId,
          model: item.model,
          displayName: item.displayName,
          enabled: true,
          allowInWorkbenchAgent: true,
          supportsTools: item.supportsTools,
          capabilities: item.capabilities,
          inputModalities: item.inputModalities,
          outputModalities: item.outputModalities,
          endpointTypes: item.endpointTypes,
          maxInputTokens: item.maxInputTokens ?? null,
          maxOutputTokens: item.maxOutputTokens ?? null,
          supportsStreaming: item.supportsStreaming,
          contextWindow: item.contextWindow ?? null,
          source: 'manual' as const,
          validationStatus: 'passed' as const,
        }))
      : undefined,
    lastHealthStatus: 'unknown',
  }
}

const createReadonlySettingsFromCatalog = (): AiSettings => {
  const items = aiConfigStore.catalog.items
  const itemsByProvider = new Map<string, AiModelCatalogItem[]>()
  items.forEach(item => {
    const providerItems = itemsByProvider.get(item.providerId) || []
    providerItems.push(item)
    itemsByProvider.set(item.providerId, providerItems)
  })
  const providers = Array.from(itemsByProvider, ([providerId, providerItems]) => (
    createReadonlyProviderFromCatalog(providerId, providerItems)
  ))
  if (!providers.some(provider => isBuiltinProvider(provider))) {
    providers.unshift({
      id: BUILTIN_AI_PROVIDER_ID,
      name: i18next.t('workbenchAiSettingsPanel.builtinProviderName'),
      type: 'builtin-cloud',
      enabled: true,
      baseUrl: null,
      apiKey: null,
      defaultModelId: null,
      models: [],
      availableModels: [],
      lastHealthStatus: 'unknown',
      builtinRouteStatus: 'unknown',
    })
  }
  return {
    enabled: true,
    autoTaskEnabled: false,
    allowModelSelection: true,
    defaultSelections: { fast: null, balanced: null, deep: null },
    defaultProviderId: aiConfigStore.catalog.defaultProviderId || null,
    defaultModelId: aiConfigStore.catalog.defaultModelId || null,
    providers,
  }
}

const applyLoadedDraft = (config?: AiSettings | null) => {
  const nextDraft = config || aiConfigStore.config || createReadonlySettingsFromCatalog()
  if (nextDraft) {
    applySavedDraft(nextDraft)
    return
  }
  if (!draft.value.providers.length) {
    applySavedDraft(createEmptySettings())
  }
}

const shouldShowModelRawName = (provider?: Pick<AiProviderConfig, 'type'> | null, model?: AiProviderModel | null) =>
  shouldExposeAiModelRawName(model?.displayName, model?.model, provider?.type)
const resetProviderForm = () => Object.assign(providerForm, createProviderForm())
const handleProviderFieldChange = (field: 'name' | 'baseUrl' | 'apiKey', value: string) => {
  providerForm[field] = value
}

const normalizeDraftTierDefaults = () => {
  (['fast', 'balanced', 'deep'] as AiModelTier[]).forEach(tier => {
    const selection = draft.value.defaultSelections?.[tier]
    if (!selection) return
    const matched = getTierSelectableModels().some(item =>
      item.providerId === selection.providerId && item.modelId === selection.modelId,
    )
    if (!matched) {
      draft.value.defaultSelections = {
        ...(draft.value.defaultSelections || { fast: null, balanced: null, deep: null }),
        [tier]: null,
      }
    }
  })
  syncLegacyInteractiveDefaultFromTierDefaults()
}

const normalizeDraftDefaultSelection = () => {
  normalizeDraftTierDefaults()
  syncLegacyInteractiveDefaultFromTierDefaults()
}

const reloadConfig = async () => {
  const [config] = await Promise.all([
    aiConfigStore.loadConfig(true).catch(() => null),
    aiConfigStore.loadCatalog(true).catch(() => null),
  ])
  applyLoadedDraft(config)
}

const loadInitialConfig = async () => {
  const [config] = await Promise.all([
    aiConfigStore.loadConfig().catch(() => null),
    aiConfigStore.loadCatalog().catch(() => null),
  ])
  applyLoadedDraft(config)
}

const handleSave = async (showMessage = true, errorMessage: string | null = i18next.t('workbenchAiSettingsPanel.saveFailedRetry')) => {
  normalizeDraftDefaultSelection()
  try {
    const saved = await saveQueue.save(createSaveRequest())
    if (!saved) return null
    applySavedDraft(saved)
    await aiConfigStore.loadCatalog(true).catch(() => null)
    if (showMessage) ElMessage.success(i18next.t('workbenchAiSettingsPanel.saveSuccess'))
    return saved
  } catch (error) {
    if (errorMessage) {
      ElMessage.error(resolveErrorMessage(error, errorMessage))
    }
    return null
  }
}

type ProviderField = 'enabled' | 'baseUrl' | 'apiKey'
const persistProviderFieldChange = async (
  provider: AiProviderConfig | null,
  field: ProviderField,
  value: unknown,
) => {
  if (!provider || isProviderBusy(provider)) return
  const savedProvider = aiConfigStore.config?.providers.find(item => item.id === provider.id)
  const previousValue = savedProvider?.[field]
  const nextValue = field === 'enabled'
    ? Boolean(value)
    : (String(value || '').trim() || null)
  if (field !== 'apiKey' && nextValue === previousValue) return

  try {
    const saved = await aiConfigStore.updateProvider(provider.id, { [field]: nextValue } as Partial<AiProviderConfig>)
    if (saved) applySavedDraft(saved)
  } catch (error) {
    if (field === 'enabled') provider.enabled = Boolean(previousValue)
    if (field === 'baseUrl') provider.baseUrl = previousValue as string | null | undefined
    if (field === 'apiKey') provider.apiKey = null
    ElMessage.error(resolveErrorMessage(error, i18next.t('workbenchAiSettingsPanel.saveFailedRetry')))
  }
}

const handleAutoTaskEnabledChange = async (value: boolean | string | number) => {
  const previousValue = aiConfigStore.config?.autoTaskEnabled
  const nextValue = Boolean(value)
  if (nextValue === previousValue) return
  try {
    const saved = await aiConfigStore.updateGlobalConfig({ autoTaskEnabled: nextValue })
    if (saved) applySavedDraft(saved)
  } catch (error) {
    draft.value.autoTaskEnabled = Boolean(previousValue)
    ElMessage.error(resolveErrorMessage(error, i18next.t('workbenchAiSettingsPanel.saveFailedRetry')))
  }
}

const saveDraftMutationWithRollback = async (
  mutate: () => void,
  errorMessage?: string | null,
) => await withRollbackOnSaveFailure({
  capture: createDraftMutationState,
  mutate,
  save: async () => (
    errorMessage === undefined
      ? await handleSave(false)
      : await handleSave(false, errorMessage)
  ),
  restore: restoreDraftMutationState,
})

const selectProvider = (providerId: string) => { activeProviderId.value = providerId }
const systemDefaultTagTiers: AiModelTier[] = ['fast', 'balanced', 'deep']
const getSystemDefaultModelTagLabels = (provider: AiProviderConfig, model: AiProviderModel) => systemDefaultTagTiers
  .filter(tier => isAiModelTierDefaultSelection(
    draft.value.defaultSelections,
    tier,
    {
      providerId: provider.id,
      modelId: model.id,
    },
  ))
  .map(tier => getAiModelTierDefaultBadgeLabel(tier))

const openProviderDialog = () => {
  resetProviderForm()
  providerDialogEditing.value = false
  providerDialogProviderId.value = ''
  providerDialogVisible.value = true
}
const openProviderEditDialog = (provider: AiProviderConfig) => {
  if (isBuiltinProvider(provider)) return
  providerDialogEditing.value = true
  providerDialogProviderId.value = provider.id
  providerForm.type = provider.type === 'ollama' ? 'ollama' : 'openai-compatible'
  providerForm.name = provider.name
  providerForm.baseUrl = provider.baseUrl || ''
  providerForm.apiKey = ''
  providerDialogVisible.value = true
}
const handleProviderTypeChange = (type: ProviderFormType) => {
  if (providerDialogEditing.value) return
  providerForm.type = type
  if (type === 'ollama') {
    providerForm.name = i18next.t('workbenchAiSettingsPanel.localOllamaName')
    providerForm.baseUrl = 'http://localhost:11434/v1'
  } else {
    providerForm.name = i18next.t('workbenchAiSettingsPanel.openaiCompatibleProvider')
    providerForm.baseUrl = ''
  }
  providerForm.apiKey = ''
}

const closeProviderContextMenu = () => {
  providerContextMenuVisible.value = false
  providerContextMenuProviderId.value = ''
}
const openProviderContextMenu = (event: MouseEvent, provider: AiProviderConfig) => {
  if (isBuiltinProvider(provider)) {
    closeProviderContextMenu()
    return
  }
  const menuWidth = 144
  const menuHeight = 76
  const viewportGap = 8
  activeProviderId.value = provider.id
  providerContextMenuProviderId.value = provider.id
  providerContextMenuPosition.left = Math.max(
    viewportGap,
    Math.min(event.clientX, window.innerWidth - menuWidth - viewportGap),
  )
  providerContextMenuPosition.top = Math.max(
    viewportGap,
    Math.min(event.clientY, window.innerHeight - menuHeight - viewportGap),
  )
  providerContextMenuVisible.value = true
}
const handleProviderContextCommand = async (action: 'edit' | 'delete') => {
  const provider = draft.value.providers.find(item => item.id === providerContextMenuProviderId.value)
  closeProviderContextMenu()
  if (!provider || isBuiltinProvider(provider)) return
  if (action === 'edit') {
    openProviderEditDialog(provider)
    return
  }
  await handleDeleteProvider(provider)
}

const handleDeleteProvider = async (provider: AiProviderConfig) => {
  if (isBuiltinProvider(provider)) return
  try {
    await ElMessageBox.confirm(
      i18next.t('workbenchAiSettingsPanel.deleteProviderConfirm', { name: provider.name }),
      i18next.t('workbenchAiSettingsPanel.deleteProviderTitle'),
      { type: 'warning' },
    )
  } catch {
    return
  }
  const saved = await saveDraftMutationWithRollback(() => {
    draft.value.providers = draft.value.providers.filter(item => item.id !== provider.id)
    if (activeProviderId.value === provider.id) {
      syncActiveProvider()
    }
  })
  if (saved) ElMessage.success(i18next.t('workbenchAiSettingsPanel.modelServiceDeleted'))
}

const handleSaveProvider = async () => {
  if (!providerForm.name.trim()) {
    ElMessage.warning(i18next.t('workbenchAiSettingsPanel.serviceNameRequired'))
    return
  }
  const providerId = providerDialogEditing.value
    ? providerDialogProviderId.value
    : `provider-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
  const saved = await saveDraftMutationWithRollback(() => {
    const nextProvider = {
      id: providerId,
      name: providerForm.name.trim(),
      type: providerForm.type,
      enabled: providerDialogEditing.value
        ? draft.value.providers.find(item => item.id === providerId)?.enabled !== false
        : true,
      baseUrl: providerForm.baseUrl.trim() || null,
      ...(providerDialogEditing.value
        ? (providerForm.apiKey.trim() ? { apiKey: providerForm.apiKey.trim() } : {})
        : { apiKey: providerForm.apiKey.trim() || null }),
      defaultModelId: null,
      models: [] as AiProviderModel[],
      availableModels: [] as AiProviderModel[],
      lastHealthStatus: 'unknown' as const,
      lastHealthMessage: null,
    }
    if (providerDialogEditing.value) {
      const index = draft.value.providers.findIndex(item => item.id === providerId)
      if (index >= 0) {
        draft.value.providers[index] = {
          ...draft.value.providers[index],
          ...nextProvider,
          models: draft.value.providers[index].models,
          availableModels: draft.value.providers[index].availableModels,
        }
      }
    } else {
      draft.value.providers.push(nextProvider)
    }
    activeProviderId.value = providerId
    providerDialogVisible.value = false
  })
  if (saved) {
    ElMessage.success(i18next.t(providerDialogEditing.value
      ? 'workbenchAiSettingsPanel.providerUpdated'
      : 'workbenchAiSettingsPanel.modelServiceAdded'))
    providerDialogEditing.value = false
    providerDialogProviderId.value = ''
  }
}

const handleSyncModels = async (provider: AiProviderConfig, silent = false) => {
  if (isProviderActionDisabled(provider, 'syncing')) return
  setProviderPendingAction(provider.id, 'syncing')
  try {
    const data = await aiConfigStore.syncProviderModels(provider.id)
    if (!data) return
    applySavedDraft(data)
    await aiConfigStore.loadCatalog(true).catch(() => null)
    if (!silent) {
      ElMessage.success(i18next.t('workbenchAiSettingsPanel.refreshProviderModelsSuccess', { provider: provider.name }))
    }
  } catch (error) {
    if (!silent) {
      ElMessage.error(resolveErrorMessage(error, i18next.t('workbenchAiSettingsPanel.refreshProviderModelsFailed', { provider: provider.name })))
    }
  } finally {
    setProviderPendingAction(provider.id)
  }
}

const handleRefreshPickerModels = async (provider: AiProviderConfig) => {
  await handleSyncModels(provider)
}

const openModelPickerDialog = (providerId: string) => {
  const provider = draft.value.providers.find(item => item.id === providerId)
  if (!provider || isProviderLoginLocked(provider)) return
  activeProviderId.value = providerId
  activeModelProviderId.value = providerId
  modelPickerKeyword.value = ''
  modelPickerDialogVisible.value = true
  void handleSyncModels(provider, true)
}

const isModelAlreadyAdded = (modelId: string) => Boolean(currentModelProvider.value?.models.some(model => model.id === modelId))
const handleAddModelFromAvailable = async (model: AiProviderModel) => {
  const provider = draft.value.providers.find(item => item.id === activeModelProviderId.value)
  if (!provider || isProviderLoginLocked(provider)) return
  if (provider.models.some(item => item.id === model.id)) {
    ElMessage.warning(i18next.t('workbenchAiSettingsPanel.modelAlreadyAdded'))
    return
  }
  const saved = await saveDraftMutationWithRollback(() => {
    provider.models.push({ ...clone(model), enabled: true, source: 'manual' })
    syncBuiltinManagedModels(provider)
    normalizeDraftDefaultSelection()
  })
  if (!saved) return
  ElMessage.success(i18next.t('workbenchAiSettingsPanel.modelAdded', { model: getModelDisplayName(provider, model) }))
  // 添加后立即同步，让新增模型的顺序回到服务端目录顺序
  void handleSyncModels(provider, true)
}

const handleAddAllModels = async () => {
  const provider = currentModelProvider.value
  if (!provider || isProviderLoginLocked(provider) || isProviderBusy(provider)) return
  const modelIds = new Set(provider.models.map(model => model.id))
  const modelsToAdd = filteredAvailableModels.value.filter(model => !modelIds.has(model.id))
  if (!modelsToAdd.length) {
    ElMessage.warning(i18next.t('workbenchAiSettingsPanel.noModelsToAdd'))
    return
  }
  try {
    await ElMessageBox.confirm(
      h('div', { class: 'workbench-ai-add-all-message' }, [
        h('div', { class: 'workbench-ai-add-all-message__title' }, [
          h(WarningFilled, { class: 'workbench-ai-add-all-message__icon' }),
          h('span', i18next.t('workbenchAiSettingsPanel.addAllModelsTitle')),
        ]),
        h('p', { class: 'workbench-ai-add-all-message__description' }, i18next.t('workbenchAiSettingsPanel.addAllModelsConfirm')),
      ]),
      '',
      {
        customClass: 'workbench-ai-add-all-confirm',
        showClose: false,
        closeOnClickModal: false,
        confirmButtonText: i18next.t('workbenchAiSettingsPanel.confirm'),
        cancelButtonText: i18next.t('workbenchAiSettingsPanel.cancel'),
      },
    )
  } catch {
    return
  }
  const saved = await saveDraftMutationWithRollback(() => {
    provider.models.push(...modelsToAdd.map(model => ({ ...clone(model), enabled: true, source: 'manual' })))
    syncBuiltinManagedModels(provider)
    normalizeDraftDefaultSelection()
  })
  if (saved) {
    ElMessage.success(i18next.t('workbenchAiSettingsPanel.allModelsAdded', { count: modelsToAdd.length }))
    // 添加后立即同步，让新增模型的顺序回到服务端目录顺序
    void handleSyncModels(provider, true)
  }
}

const handleRemoveModelFromPicker = async (model: AiProviderModel) => {
  const provider = currentModelProvider.value
  if (!provider) return
  await handleDeleteModel(provider, model)
}

const clearDefaultSelectionsForModel = (provider: AiProviderConfig, modelId: string) => {
  const defaultSelections = draft.value.defaultSelections || { fast: null, balanced: null, deep: null }
  const nextSelections = { ...defaultSelections }
  let changed = false
  ;(Object.keys(nextSelections) as AiModelTier[]).forEach(tier => {
    const selection = nextSelections[tier]
    if (selection?.providerId === provider.id && selection.modelId === modelId) {
      nextSelections[tier] = null
      changed = true
    }
  })
  if (changed) {
    draft.value.defaultSelections = nextSelections
    syncLegacyInteractiveDefaultFromTierDefaults()
  }
}

const handleDeleteModel = async (provider: AiProviderConfig, model: AiProviderModel) => {
  if (isProviderLoginLocked(provider)) return
  try {
    await ElMessageBox.confirm(i18next.t('workbenchAiSettingsPanel.deleteModelConfirm', { model: getModelDisplayName(provider, model) }), i18next.t('workbenchAiSettingsPanel.deleteModelTitle'), { type: 'warning' })
  } catch {
    return
  }
  const saved = await saveDraftMutationWithRollback(() => {
    clearDefaultSelectionsForModel(provider, model.id)
    provider.models = provider.models.filter(item => item.id !== model.id)
    syncBuiltinManagedModels(provider)
    normalizeDraftDefaultSelection()
  })
  if (saved) ElMessage.success(i18next.t('workbenchAiSettingsPanel.modelDeleted'))
}

const handleDeleteModelGroup = async (provider: AiProviderConfig, group: ManagedModelGroup) => {
  if (isProviderLoginLocked(provider) || isProviderBusy(provider)) return
  try {
    await ElMessageBox.confirm(
      i18next.t('workbenchAiSettingsPanel.deleteModelGroupConfirm', { group: group.name, count: group.models.length }),
      i18next.t('workbenchAiSettingsPanel.deleteModelGroupTitle'),
      { type: 'warning' },
    )
  } catch {
    return
  }
  const modelIds = new Set(group.models.map(model => model.id))
  const saved = await saveDraftMutationWithRollback(() => {
    group.models.forEach(model => clearDefaultSelectionsForModel(provider, model.id))
    provider.models = provider.models.filter(model => !modelIds.has(model.id))
    syncBuiltinManagedModels(provider)
    normalizeDraftDefaultSelection()
  })
  if (saved) ElMessage.success(i18next.t('workbenchAiSettingsPanel.modelGroupDeleted'))
}

const handleValidateModel = async (provider: AiProviderConfig, model: AiProviderModel): Promise<boolean> => {
  if (isValidateButtonDisabled(provider, model)) return false
  providerValidationAbortController?.abort()
  const runToken = ++providerValidationRunToken
  const controller = new AbortController()
  providerValidationAbortController = controller
  setModelValidatingState(provider.id, model.id, true)
  try {
    if (runToken !== providerValidationRunToken) return false
    const response = await axios.post<AiModelHealthCheckResult>(
      `/ai/providers/${provider.id}/validate-model-health`,
      { modelId: model.id, timeoutMs: 15_000 },
      { signal: controller.signal },
    )
    const data = response?.data
    if (!data || runToken !== providerValidationRunToken) return false
    providerValidationResults[provider.id] = { success: data.success, message: data.message }
    if (data.success) {
      ElMessage.success(i18next.t('aiConfigService.connectionSuccessful'))
    } else {
      ElMessage.error(data.message || i18next.t('workbenchAiSettingsPanel.modelValidationRequestFailed', { model: getModelDisplayName(provider, model) }))
    }
    return data.success
  } catch (error) {
    if (runToken !== providerValidationRunToken || axios.isCancel(error)) return false
    const message = resolveErrorMessage(error, i18next.t('workbenchAiSettingsPanel.modelValidationRequestFailed', { model: getModelDisplayName(provider, model) }))
    providerValidationResults[provider.id] = { success: false, message }
    ElMessage.error(message)
    return false
  } finally {
    setModelValidatingState(provider.id, model.id, false)
    if (providerValidationAbortController === controller) providerValidationAbortController = null
  }
}

const hasProviderValidationPassed = (provider?: AiProviderConfig | null) => Boolean(
  provider && providerValidationResults[provider.id]?.success,
)
const hasProviderValidationFailed = (provider?: AiProviderConfig | null) => Boolean(
  provider && providerValidationResults[provider.id] && !providerValidationResults[provider.id].success,
)
const getProviderValidationButtonType = (provider?: AiProviderConfig | null) => (
  hasProviderValidationPassed(provider) ? 'success' : hasProviderValidationFailed(provider) ? 'danger' : 'default'
)
const getProviderValidationMessage = (provider?: AiProviderConfig | null) => normalizeInlineText(
  provider ? providerValidationResults[provider.id]?.message : '',
)
const getProviderValidationButtonLabel = (provider?: AiProviderConfig | null) => (
  hasProviderValidationFailed(provider)
    ? i18next.t('workbenchAiSettingsPanel.detectAgain')
    : i18next.t('workbenchAiSettingsPanel.detectModel')
)
const isProviderValidationEntryDisabled = (provider?: AiProviderConfig | null) => Boolean(
  !provider
  || isProviderBusy(provider),
)
const openModelValidationDialog = async (provider: AiProviderConfig) => {
  if (isProviderValidationEntryDisabled(provider)) return
  const validationProvider = draft.value.providers.find(item => item.id === provider.id) || provider
  if (!validationProvider.models.length) {
    ElMessage.error(i18next.t('workbenchAiSettingsPanel.noModelsForValidation'))
    return
  }
  modelValidationProviderId.value = validationProvider.id
  modelValidationDialogVisible.value = true
}
const handleValidateSelectedModel = ({ model }: { model: AiProviderModel }) => {
  const provider = modelValidationProvider.value
  if (!provider) return
  modelValidationCloseAfterSubmit = true
  void handleValidateModel(provider, model)
  modelValidationDialogVisible.value = false
}

type ModelEditPayload = {
  displayName: string
  group: string
  capabilities: AiModelCapability[]
}

const openModelEditDialog = (provider: AiProviderConfig, model: AiProviderModel) => {
  if (isModelActionLocked(provider, model)) return
  modelEditProviderId.value = provider.id
  modelEditModelId.value = model.id
  modelEditDialogVisible.value = true
}

const handleSaveModelEdit = async (payload: ModelEditPayload) => {
  const provider = modelEditProvider.value
  const model = modelEditModel.value
  if (!provider || !model || isModelActionLocked(provider, model)) return
  const saved = await saveDraftMutationWithRollback(() => {
    model.displayName = String(payload.displayName || model.model).trim() || model.model
    const meta = { ...(model.meta || {}) }
    const group = String(payload.group || '').trim()
    if (group) meta.group = group
    else delete meta.group
    model.meta = meta
    model.capabilities = normalizeAiModelCapabilities(payload.capabilities)
    const supportsTools = model.capabilities.includes(AI_MODEL_CAPABILITIES.FUNCTION_CALL)
    model.supportsTools = supportsTools
    model.toolCapabilities = supportsTools
      ? { ...getModelToolCapabilities(model), auto: true }
      : { auto: false, requireAny: false, requireSpecific: false, parallel: false }
    setModelVisionCapability(model, model.capabilities.includes(AI_MODEL_CAPABILITIES.IMAGE_RECOGNITION))
    syncBuiltinManagedModels(provider)
  })
  if (!saved) return
  modelEditDialogVisible.value = false
  ElMessage.success(i18next.t('WorkbenchAiModelEditDialog.saved'))
}

const getModelHealthResult = (provider?: AiProviderConfig | null, model?: AiProviderModel | null) => {
  if (!provider || !model || modelHealthCheckProviderId.value !== provider.id) return undefined
  return modelHealthCheckResults[model.id]
}
const isModelHealthChecking = (provider?: AiProviderConfig | null, model?: AiProviderModel | null) => Boolean(
  provider && model && modelHealthCheckingMap[getModelPendingKey(provider.id, model.id)],
)
const getModelHealthStatus = (provider?: AiProviderConfig | null, model?: AiProviderModel | null) => {
  const result = getModelHealthResult(provider, model)
  if (!result?.keyResults?.length) return 'failed'
  const passedCount = result.keyResults.filter(item => item.success).length
  if (passedCount === result.keyResults.length) return 'passed'
  return passedCount > 0 ? 'partial' : 'failed'
}
const formatModelHealthDuration = (durationMs: number) => `${(Math.max(0, durationMs) / 1000).toFixed(2)}s`
const getModelHealthLatency = (provider?: AiProviderConfig | null, model?: AiProviderModel | null) => {
  const successfulDurations = getModelHealthResult(provider, model)?.keyResults
    ?.filter(item => item.success)
    .map(item => item.durationMs)
    .filter(duration => duration > 0) || []
  return successfulDurations.length ? formatModelHealthDuration(Math.min(...successfulDurations)) : ''
}
const maskHealthCheckApiKey = (apiKey: string) => apiKey.length <= 8
  ? '****'
  : `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`
const getHealthCheckKeyLabel = (provider: AiProviderConfig, keyIndex: number) => provider.type === 'openai-compatible'
  ? maskHealthCheckApiKey(modelHealthCheckApiKeys.value[keyIndex] || '')
  : provider.name

const clearModelHealthCheckResults = () => {
  Object.keys(modelHealthCheckResults).forEach(modelId => delete modelHealthCheckResults[modelId])
}

const openModelHealthCheckDialog = (provider: AiProviderConfig) => {
  if (!provider.models.length || isProviderBusy(provider)) return
  if (modelHealthCheckProviderId.value && modelHealthCheckProviderId.value !== provider.id) {
    clearModelHealthCheckResults()
  }
  modelHealthCheckProviderId.value = provider.id
  modelHealthCheckDialogVisible.value = true
}

const handleProviderHealthAction = (provider: AiProviderConfig) => openModelHealthCheckDialog(provider)

const handleCancelModelHealthCheck = () => {
  modelHealthCheckRunToken += 1
  modelHealthCheckAbortControllers.forEach(controller => controller.abort())
  modelHealthCheckAbortControllers.clear()
  Object.keys(modelHealthCheckingMap).forEach(key => delete modelHealthCheckingMap[key])
  modelHealthCheckRunning.value = false
  modelHealthCheckDialogVisible.value = false
}

const createFailedHealthCheckResult = (
  keyCount: number,
  startedAt: number,
  message: string,
): AiModelHealthCheckResult => ({
  success: false,
  checkedAt: Date.now(),
  durationMs: Date.now() - startedAt,
  message,
  keyResults: Array.from({ length: Math.max(1, keyCount) }, (_, keyIndex) => ({
    keyIndex,
    success: false,
    checkedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    message,
  })),
})

const summarizeModelHealthResults = (provider: AiProviderConfig, models: AiProviderModel[]) => {
  let passedCount = 0
  let partialCount = 0
  let failedCount = 0

  models.forEach(model => {
    const result = modelHealthCheckResults[model.id]
    if (!result) return
    if (result.success) {
      passedCount += 1
      return
    }
    if (result.keyResults.some(keyResult => keyResult.success)) {
      partialCount += 1
    } else {
      failedCount += 1
    }
  })

  const summaryParts: string[] = []
  if (passedCount > 0) {
    summaryParts.push(i18next.t('WorkbenchAiHealthCheckDialog.modelStatusPassed', { count: passedCount }))
  }
  if (partialCount > 0) {
    summaryParts.push(i18next.t('WorkbenchAiHealthCheckDialog.modelStatusPartial', { count: partialCount }))
  }
  if (failedCount > 0) {
    summaryParts.push(i18next.t('WorkbenchAiHealthCheckDialog.modelStatusFailed', { count: failedCount }))
  }
  if (!summaryParts.length) return ''
  return i18next.t('WorkbenchAiHealthCheckDialog.modelStatusSummary', {
    provider: provider.name,
    summary: summaryParts.join(', '),
  })
}

const handleStartModelHealthCheck = async (options: { concurrent: boolean; timeoutMs: number }) => {
  const provider = modelHealthCheckProvider.value
  if (!provider || isProviderLoginLocked(provider) || !provider.models.length) return

  const models = provider.models.map(model => clone(model))
  const runToken = ++modelHealthCheckRunToken
  clearModelHealthCheckResults()
  modelHealthCheckApiKeys.value = provider.type === 'openai-compatible'
    ? (provider.credentials || [])
      .filter(credential => credential.enabled)
      .map(credential => credential.masked)
    : ['']
  models.forEach(model => {
    modelHealthCheckingMap[getModelPendingKey(provider.id, model.id)] = true
  })
  modelHealthCheckRunning.value = true
  modelHealthCheckDialogVisible.value = false

  const validateModel = async (model: AiProviderModel) => {
    if (runToken !== modelHealthCheckRunToken) return
    const startedAt = Date.now()
    const controller = new AbortController()
    modelHealthCheckAbortControllers.add(controller)
    try {
      const response = await axios.post<AiModelHealthCheckResult>(
        `/ai/providers/${provider.id}/validate-model-health`,
        {
          modelId: model.id,
          timeoutMs: options.timeoutMs,
        },
        { signal: controller.signal },
      )
      if (runToken === modelHealthCheckRunToken && response.data) {
        modelHealthCheckResults[model.id] = response.data
      }
    } catch (error) {
      if (runToken === modelHealthCheckRunToken && !axios.isCancel(error)) {
        modelHealthCheckResults[model.id] = createFailedHealthCheckResult(
          modelHealthCheckApiKeys.value.length || 1,
          startedAt,
          resolveErrorMessage(error, i18next.t('WorkbenchAiHealthCheckDialog.requestFailed')),
        )
      }
    } finally {
      modelHealthCheckAbortControllers.delete(controller)
      delete modelHealthCheckingMap[getModelPendingKey(provider.id, model.id)]
    }
  }

  if (options.concurrent) {
    await Promise.allSettled(models.map(model => validateModel(model)))
  } else {
    for (const model of models) {
      if (runToken !== modelHealthCheckRunToken) break
      await validateModel(model)
    }
  }

  if (runToken !== modelHealthCheckRunToken) return
  const summary = summarizeModelHealthResults(provider, models)
  if (summary) ElMessage.info(summary)
  modelHealthCheckRunning.value = false
}

onMounted(() => {
  void loadInitialConfig()
  document.addEventListener('click', closeProviderContextMenu)
  window.addEventListener('resize', closeProviderContextMenu)
  window.addEventListener('scroll', closeProviderContextMenu, true)
})
watch(isLoggedIn, loggedIn => {
  if (loggedIn) void reloadConfig()
})
watch(() => draft.value.providers.map(item => item.id).join('::'), () => syncActiveProvider(activeProviderId.value))
watch(() => {
  const provider = activeProvider.value
  return provider ? [provider.id, provider.apiKey || '', provider.baseUrl || ''].join('\u0000') : ''
}, (snapshot, previousSnapshot) => {
  if (!previousSnapshot || snapshot === previousSnapshot) return
  const provider = activeProvider.value
  if (!provider) return
  delete providerValidationResults[provider.id]
  if (hasPendingModelValidation(provider)) {
    providerValidationRunToken += 1
    providerValidationAbortController?.abort()
  }
})
watch(activeProviderId, providerId => {
  if (modelHealthCheckProviderId.value && providerId !== modelHealthCheckProviderId.value) {
    handleCancelModelHealthCheck()
    clearModelHealthCheckResults()
    modelHealthCheckProviderId.value = ''
  }
})
watch(managedModelGroupKeys, (keys, previousKeys) => {
  const previous = new Set(previousKeys || [])
  const expanded = new Set(expandedManagedModelGroupKeys.value)
  expandedManagedModelGroupKeys.value = keys.filter(key => expanded.has(key) || !previous.has(key))
}, { immediate: true })
watch(modelPickerDialogVisible, visible => { if (!visible) modelPickerKeyword.value = '' })
watch(modelValidationDialogVisible, visible => {
  if (!visible && modelValidationCloseAfterSubmit) {
    modelValidationCloseAfterSubmit = false
    return
  }
  if (!visible && hasPendingModelValidation(modelValidationProvider.value)) {
    providerValidationRunToken += 1
    providerValidationAbortController?.abort()
  }
})
onBeforeUnmount(() => {
  handleCancelModelHealthCheck()
  providerValidationRunToken += 1
  providerValidationAbortController?.abort()
  document.removeEventListener('click', closeProviderContextMenu)
  window.removeEventListener('resize', closeProviderContextMenu)
  window.removeEventListener('scroll', closeProviderContextMenu, true)
})
</script>

<style scoped lang="scss">
.ai-model-manage-page {
  width: 100%;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: #1d2129;
  position: relative;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-textarea__inner) {
    box-shadow: none;
    background: #f7f8fa;
    border-radius: 8px;
  }

  :deep(.el-dialog) {
    max-width: calc(100vw - 32px);
  }

  .el-button {
    border-radius: 4px;
  }

  .external-provider-config {
    :deep(.el-input__wrapper) {
      min-height: 32px;
      padding: 1px 11px;
      border-radius: 4px;
      background: #fff;
      box-shadow: 0 0 0 1px #c9cdd4 inset;
    }

    :deep(.el-input__wrapper:hover) {
      box-shadow: 0 0 0 1px #86909c inset;
    }

    :deep(.el-input.is-focus .el-input__wrapper) {
      box-shadow: 0 0 0 1px var(--color-primary) inset;
    }
  }
}

.model-management-content {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.login-required-card {
  min-height: 184px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  border-radius: 4px;
  background: #F7F8FA;
  box-sizing: border-box;
  text-align: center;
}

.login-required-card__icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: #1d69ff;
  color: #fff;
  font-size: 20px;
}

.login-required-card__text {
  display: flex;
  flex-direction: column;
  gap: 4px;

  h3 {
    margin: 0;
    font-size: 16px;
    line-height: 24px;
    font-weight: 600;
  }

  p {
    color: #86909c;
    font-size: 12px;
    line-height: 20px;
  }
}

.login-required-card__admin-only {
  margin: 0;
  color: #86909c;
  font-size: 12px;
  line-height: 20px;
}

.default-model-section {
  padding: 24px;
  border-bottom: 1px solid #e5e6eb;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.default-model-alert {
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #ffe0b2;
  background: #fff7e8;
}

.default-model-section .section-header h3 {
  margin-bottom: 2px;
  font-size: 14px;
  line-height: 22px;
  font-weight: 600;
}

.default-model-section .section-header p {
  font-size: 12px;
  line-height: 18px;
}

.default-model-section :deep(.el-select__wrapper) {
  min-height: 32px;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 0 0 1px #c9cdd4 inset;
}

.service-management-section {
  padding: 0;
  overflow: hidden;
}

.section-card--fill {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.section-header h3 {
  margin: 0 0 6px;
  font-size: 18px;
  line-height: 26px;
}

.section-header p,
.helper-text,
.model-title__note {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: #86909c;
  overflow-wrap: anywhere;
}

.toolbar-actions,
.model-title__name-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.field-block label {
  font-size: 12px; line-height: 18px; color: #86909c;
}

.tier-default-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.management-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 256px minmax(0, 1fr);
  gap: 0;
  overflow: hidden;
}

.provider-rail,
.provider-detail {
  min-width: 0;
  min-height: 0;
}

.provider-rail {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  border-right: 1px solid #e5e6eb;
  background: #fff;
  overflow: hidden;
}

.provider-detail {
  overflow-y: auto;
  padding-right: 4px;
  padding-bottom: 12px;
  box-sizing: border-box;
}

.provider-menu {
  flex: 1;
  border-right: 0;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 4px;
  :deep(.el-menu-item) {
    width: 100%;
    height: 32px;
    min-height: 32px;
    padding: 5px 8px !important;
    border-radius: 4px;
    color: #1d2129;
    gap: 8px;
    line-height: 32px;

    &:hover,
    &.is-active {
      color: #1677ff;
      background: #e8f3ff;
    }

    &.is-active::before {
      display: none;
    }
  }

}

.provider-context-menu {
  position: fixed;
  z-index: 9999;
  width: 144px;
  padding: 6px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 6px 16px rgb(0 0 0 / 12%);

  :deep(.el-menu-item) {
    height: 32px;
    min-height: 32px;
    margin: 0;
    padding: 0 10px;
    border-radius: 4px;
    gap: 8px;
    color: #1d2129;
    font-size: 14px;
    line-height: 32px;

    .el-icon {
      margin: 0;
      color: #4e5969;
      font-size: 16px;
    }

    &:hover,
    &:focus {
      background: #f2f3f5;
      color: #1d2129;
    }

    &.provider-context-menu__item--danger {
      color: #f53f3f;

      .el-icon {
        color: #f53f3f;
      }

      &:hover,
      &:focus {
        background: #fff0f0;
        color: #f53f3f;
      }
    }
  }

  &.provider-context-right-sub-menu {
    :deep(.el-menu-item) {
      padding: 0 10px;
    }
  }
}

.provider-item__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 20px;
  font-weight: 400;
  flex: 1;
}

.model-status-mark {
  width: 16px;
  height: 16px;
  flex: none;
  border-radius: 50%;
  background: #c9cdd4;
  color: #fff;
}

.provider-item__icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: #94bfff;

  .el-icon{
    margin: 0;
  }
}

.provider-item__icon.is-builtin {
  background: #1677ff;
}

.provider-item__icon img {
  width: 14px;
  height: 14px;
  filter: brightness(0) invert(1);
}

.provider-item__status {
  flex: none;
  padding: 0 4px;
  border: 1px solid #95de64;
  border-radius: 2px;
  background: #f6ffed;
  color: #52c41a;
  font-size: 11px;
  line-height: 16px;
}

.add-provider-button {
  width: 100%;
  flex: none;
  border-radius: 4px;
}

.provider-detail {
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-content: start;
  padding: 24px;
}
.provider-detail--empty {
  display: flex;
  justify-content: center;
}

.detail-panel {
  border-radius: 0;
  background: #fff;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.detail-panel--models {
  min-height: 0;
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  box-shadow: inset 0 -1px 0 #e5e6eb;
}

.provider-config-panel {
  flex: none;
}

.provider-title-row,
.provider-title-row__main,
.model-list-header,
.managed-model-row,
.managed-model-row__main,
.managed-model-row__actions,
.field-action-row,
.provider-feedback-row {
  display: flex;
  align-items: center;
}

.provider-title-row,
.model-list-header,
.managed-model-row,
.provider-feedback-row {
  justify-content: space-between;
}

.provider-title-row {
  min-height: 40px;
}

.provider-title-row h4 {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}

.provider-title-row__main,
.managed-model-row__main,
.managed-model-row__actions,
.field-action-row {
  gap: 8px;
}

.provider-title-row__link {
  border-radius: 4px;
  padding: 5px;
  color: #86909c;
  font-size: 14px;
}

.builtin-account-panel {
  display: flex;
  flex-direction: column;
  min-height: 114px;
  padding: 16px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  gap: 24px;

  .builtin-account-panel__user {
    display: flex;
    gap: 16px;
    font-size: 14px;
    line-height: 24px;
    font-weight: 600;

    .el-button {
      color: #4E5969;
    }
  }

  .builtin-account-panel__coin-row {
    justify-content: space-between;
    align-items: center;

    .builtin-account-panel__coin {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
      line-height: 22px;

      .builtin-account-panel-coin__number {
        margin-left: 8px;
        font-size: 20px;
        line-height: 28px;
        font-weight: bold;
      }
    }
  }
}

.external-provider-config {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 0;
}

.field-action-row .el-input {
  flex: 1;
}

.field-action-row > .el-button {
  flex: none;
  min-width: 64px;
  height: 32px;
  padding: 0 12px;
  border-radius: 4px;
}

.field-help-text,
.field-tip-text,
.provider-feedback-text {
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
  text-align: right;
}
.field-tip-text {
  text-align: left;
}
.field-help-text--preview {
  margin: 4px 0 0 6px;
  text-align: left;
  white-space: break-spaces;
  word-break: break-all;
}

.provider-feedback-text {
  margin-top: -10px;
  text-align: left;
}

.provider-feedback-row {
  min-height: 24px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
}

.model-list-panel {
  flex: 1;
  min-height: 220px;
  display: flex;
  flex-direction: column;
  border-bottom: 0;
  overflow: hidden;
}

.model-list-header {
  flex: none;
  h4 {
    font-size: 14px;
    line-height: 22px;
    font-weight: 600;
    span {
      height: 16px;
      margin-left: 6px;
      padding: 0 6px;
      border-radius: 2px;
      background: #f2f3f5;
      color: #86909c;
      font-size: 12px;
      line-height: 16px;
      font-weight: 400;
    }
  }
}

.model-list-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;

  .el-button {
    margin: 0;
  }
}

.health-check-button {
  width: 28px;
  height: 28px;
  margin: 0;
  color: #4e5969;
}

.managed-model-row {
  min-height: 42px;
  padding: 6px 10px;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  background: #fff;
  box-sizing: border-box;
}

.model-delete-button {
  color: #4e5969;
  margin: 0;
}

.model-delete-button:hover {
  color: #f53f3f;
  background: #fff0f0;
}

.model-health-status {
  display: flex;
  min-width: 18px;
  height: 24px;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
}

.model-health-status.is-passed { color: #00b42a; }
.model-health-status.is-partial { color: #ff7d00; }
.model-health-status.is-failed { color: #f53f3f; }
.model-health-status.is-checking { color: #4e5969; }

.model-health-latency {
  color: #86909c;
  font-size: 12px;
}

.model-health-tooltip {
  display: flex;
  max-width: 300px;
  max-height: 300px;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.model-health-tooltip__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 4px 6px;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.model-health-tooltip__item > span:last-child {
  grid-column: 1 / -1;
}

.model-status-mark.is-enabled {
  background: #00b42a;
}


.field-block { display: flex; flex-direction: column; gap: 8px; min-width: 0; }

.managed-model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

:global(.el-drawer.workbench-recharge-drawer) {
  max-width: calc(100vw - 32px);
  background: #fff;
}

:global(.el-drawer.workbench-recharge-drawer .el-drawer__header) {
  height: 48px;
  margin: 0;
  padding: 0 20px 0 16px;
  border-bottom: 1px solid #e5e6eb;
  color: #1d2129;
  font-size: 16px;
  line-height: 48px;
}

:global(.el-drawer.workbench-recharge-drawer .el-drawer__body) {
  min-height: 0;
  padding: 0;
}

:global(.el-message-box.workbench-ai-add-all-confirm) {
  --el-messagebox-padding-primary: 0;
  background: #fff;
  width: 360px;
  max-width: calc(100vw - 32px);
  padding: 24px;
  border-radius: 4px;
  box-shadow: 0 8px 20px rgb(0 0 0 / 10%);
}

:global(.el-message-box.workbench-ai-add-all-confirm .el-message-box__header) {
  display: none;
}

:global(.el-message-box.workbench-ai-add-all-confirm .el-message-box__container) {
  display: block;
}

:global(.workbench-ai-add-all-message__title) {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1d2129;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
}

:global(.workbench-ai-add-all-message__icon) {
  width: 18px;
  height: 18px;
  flex: none;
  color: #ff7d00;
}

:global(.workbench-ai-add-all-message__description) {
  margin: 16px 0 0;
  color: #4e5969;
  font-size: 14px;
  line-height: 22px;
}

:global(.el-message-box.workbench-ai-add-all-confirm .el-message-box__btns) {
  gap: 8px;
  padding-top: 24px;
}

:global(.el-message-box.workbench-ai-add-all-confirm .el-message-box__btns .el-button) {
  height: 32px;
  margin: 0;
  border-radius: 4px;
}

.managed-model-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  padding-bottom: 8px;
  box-sizing: border-box;
}

.managed-model-groups {
  border-top: 0;
  border-bottom: 0;
  gap: 12px;

  :deep(.el-collapse-item__header) {
    min-height: 36px;
    height: auto;
    padding: 0 8px;
    border: 1px solid #e5e6eb;
    border-radius: 4px;
    background: #f7f8fa;
    color: #1d2129;
    line-height: 22px;
  }

  :deep(.el-collapse-item__wrap) {
    border-bottom: 0;
  }

  :deep(.el-collapse-item__content) {
    padding: 8px 0 0;
  }
}

.managed-model-group__title {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

.managed-model-group__title > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.managed-model-group__delete {
  flex: none;
  margin-left: auto;
  margin-right: 8px;
  color: #4e5969;
  opacity: 0;
  transition: opacity 0.2s;
}

.managed-model-group:hover .managed-model-group__delete,
.managed-model-group__delete:focus-visible {
  opacity: 1;
}

.managed-model-group__delete:hover {
  color: #f53f3f;
  background: #fff0f0;
}

.managed-model-group__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-title { min-width: 0; flex: 1; }
.model-title__name-line { font-size: 14px; line-height: 22px; font-weight: 600; color: #1d2129; min-width: 0; }
.model-title__subtitle { margin-top: 4px; font-size: 13px; line-height: 20px; color: #4e5969; overflow-wrap: anywhere; }
.tier-default-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tier-default-card label {
  font-size: 12px;
  line-height: 18px;
  color: #86909c;
}
:deep(.tier-default-card .el-select) {
  width: 100%;

  .el-select__wrapper {
    border-radius: 4px;
  }
}

@media (max-width: 1180px) {
  .management-layout { grid-template-columns: 1fr; overflow: auto; }
  .provider-rail { max-height: 260px; }
}

@media (max-width: 960px) {
  .section-header { flex-direction: column; align-items: stretch; }
}
</style>
