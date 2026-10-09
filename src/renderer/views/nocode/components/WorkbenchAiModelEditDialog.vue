<template>
  <div class="workbench-ai-model-edit-dialog">
    <el-dialog
      :model-value="modelValue"
      :title="$t('WorkbenchAiModelEditDialog.title')"
      width="520px"
      align-center
      :close-on-click-modal="false"
      @open="resetForm"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <el-form class="model-edit-form" label-position="left" label-width="110px">
        <el-form-item required>
          <template #label>
            <span class="form-label">
              {{ $t('WorkbenchAiModelEditDialog.modelId') }}
              <el-tooltip :content="$t('WorkbenchAiModelEditDialog.modelIdTip')" placement="top">
                <el-icon><i-ep-question-filled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input :model-value="model?.model || ''" readonly>
            <template #suffix>
              <el-icon class="copy-model-id" @click="copyModelId"><i-ep-copy-document /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="form-label">
              {{ $t('WorkbenchAiModelEditDialog.modelName') }}
              <el-tooltip :content="$t('WorkbenchAiModelEditDialog.modelNameTip')" placement="top">
                <el-icon><i-ep-question-filled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model.trim="form.displayName" />
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="form-label">
              {{ $t('WorkbenchAiModelEditDialog.groupName') }}
              <el-tooltip :content="$t('WorkbenchAiModelEditDialog.groupNameTip')" placement="top">
                <el-icon><i-ep-question-filled /></el-icon>
              </el-tooltip>
            </span>
          </template>
          <el-input v-model.trim="form.group" />
        </el-form-item>

        <div class="model-edit-actions">
          <el-button v-if="false" text bg @click="showMoreSettings = !showMoreSettings">
            {{ $t('WorkbenchAiModelEditDialog.moreSettings') }}
            <el-icon class="more-settings-arrow">
              <i-ep-arrow-up v-if="showMoreSettings" />
              <i-ep-arrow-down v-else />
            </el-icon>
          </el-button>
          <el-button class="save-button" type="primary" :disabled="disabled" @click="handleSave">
            <template #icon><el-icon><i-ep-document-checked /></el-icon></template>
            {{ $t('WorkbenchAiModelEditDialog.save') }}
          </el-button>
        </div>

        <template v-if="showMoreSettings">
          <el-divider />
          <div class="model-type-title">
            <span>{{ $t('WorkbenchAiModelEditDialog.modelType') }}</span>
            <el-tooltip :content="$t('WorkbenchAiModelEditDialog.modelTypeTip')" placement="top">
              <el-icon color="#ff7d00"><i-ep-warning-filled /></el-icon>
            </el-tooltip>
          </div>
          <div class="model-type-list">
            <el-check-tag
              v-for="option in modelTypeOptions"
              :key="option.value"
              :checked="hasCapability(option.value)"
              :disabled="isCapabilityDisabled(option.value) || disabled"
              @change="toggleCapability(option.value)"
            >
              <el-icon>
                <i-ep-view v-if="option.value === AI_MODEL_CAPABILITIES.IMAGE_RECOGNITION" />
                <i-ep-connection v-else-if="option.value === AI_MODEL_CAPABILITIES.WEB_SEARCH" />
                <i-ep-magic-stick v-else-if="option.value === AI_MODEL_CAPABILITIES.REASONING" />
                <i-ep-tools v-else-if="option.value === AI_MODEL_CAPABILITIES.FUNCTION_CALL" />
                <i-ep-sort v-else-if="option.value === AI_MODEL_CAPABILITIES.RERANK" />
                <i-ep-coin v-else />
              </el-icon>
              {{ option.label }}
            </el-check-tag>
          </div>
        </template>
      </el-form>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { AiModelCapability, AiProviderModel } from '@common/types/ai-provider'
import { AI_MODEL_CAPABILITIES, normalizeAiModelCapabilities } from '@common/utils/aiModelCapabilities'
import { ElMessage } from 'element-plus'
import i18next from 'i18next'
import { computed, reactive, ref, type PropType } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  model: { type: Object as PropType<AiProviderModel | null>, default: null },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const showMoreSettings = ref(false)
const form = reactive({
  displayName: '',
  group: '',
  capabilities: [] as AiModelCapability[],
})

const modelTypeOptions = computed(() => [
  { value: AI_MODEL_CAPABILITIES.IMAGE_RECOGNITION, label: i18next.t('WorkbenchAiModelEditDialog.vision') },
  { value: AI_MODEL_CAPABILITIES.WEB_SEARCH, label: i18next.t('WorkbenchAiModelEditDialog.webSearch') },
  { value: AI_MODEL_CAPABILITIES.REASONING, label: i18next.t('WorkbenchAiModelEditDialog.reasoning') },
  { value: AI_MODEL_CAPABILITIES.FUNCTION_CALL, label: i18next.t('WorkbenchAiModelEditDialog.tools') },
  { value: AI_MODEL_CAPABILITIES.RERANK, label: i18next.t('WorkbenchAiModelEditDialog.rerank') },
  { value: AI_MODEL_CAPABILITIES.EMBEDDING, label: i18next.t('WorkbenchAiModelEditDialog.embedding') },
])

const resetForm = () => {
  form.displayName = String(props.model?.displayName || props.model?.model || '').trim()
  form.group = String(props.model?.meta?.group || '').trim()
  form.capabilities = normalizeAiModelCapabilities(props.model?.capabilities)
  showMoreSettings.value = false
}

const hasCapability = (capability: AiModelCapability) => form.capabilities.includes(capability)
const isCapabilityDisabled = (capability: AiModelCapability) => {
  if (capability === AI_MODEL_CAPABILITIES.RERANK) return hasCapability(AI_MODEL_CAPABILITIES.EMBEDDING)
  if (capability === AI_MODEL_CAPABILITIES.EMBEDDING) return hasCapability(AI_MODEL_CAPABILITIES.RERANK)
  return (hasCapability(AI_MODEL_CAPABILITIES.RERANK) || hasCapability(AI_MODEL_CAPABILITIES.EMBEDDING))
}
const toggleCapability = (capability: AiModelCapability) => {
  if (isCapabilityDisabled(capability)) return
  form.capabilities = hasCapability(capability)
    ? form.capabilities.filter(item => item !== capability)
    : [...form.capabilities, capability]
}
const copyModelId = async () => {
  const modelId = String(props.model?.model || '').trim()
  if (!modelId) return
  await navigator.clipboard.writeText(modelId)
  ElMessage.success(i18next.t('WorkbenchAiModelEditDialog.copied'))
}
const handleSave = () => {
  if (!props.model || props.disabled) return
  emit('confirm', {
    displayName: form.displayName || props.model.model,
    group: form.group,
    capabilities: [...form.capabilities],
  })
}
</script>

<style scoped lang="scss">
.workbench-ai-model-edit-dialog {
  :deep(.el-dialog) {
    border-radius: 4px;
    --el-dialog-bg-color: var(--bg-color-page);
    --el-dialog-padding-primary: 0;

    .el-dialog__header {
      height: 56px;
      margin: 0;
      padding: 0;
      border-bottom: 1px solid #e5e6eb;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;

      .el-dialog__title {
        color: #1d2129;
        font-size: 16px;
        line-height: 24px;
        font-weight: 600;
      }

      .el-dialog__headerbtn {
        top: 0;
        width: 56px;
        height: 56px;
      }
    }

    .el-dialog__body {
      padding: 24px;
    }

    .el-input__wrapper {
      min-height: 32px;
      border-radius: 4px;
      background: #fff;
      box-shadow: 0 0 0 1px #c9cdd4 inset;
    }

    .el-form-item {
      margin-bottom: 16px;
    }

    .el-form-item__label {
      color: #1d2129;
      font-size: 14px;
    }
  }
}

.form-label,
.model-edit-actions,
.model-type-title,
.model-type-list,
.model-type-list :deep(.el-check-tag) {
  display: flex;
  align-items: center;
}

.form-label {
  gap: 4px;
}

.form-label .el-icon {
  color: #86909c;
  font-size: 13px;
}

.copy-model-id {
  color: #4e5969;
  cursor: var(--cursor-pointer);
}

.model-edit-actions {
  justify-content: space-between;
  margin-top: 8px;
  
  .el-button {
    height: 32px;
    margin: 0;
    border-radius: 4px;

    &.save-button {
      margin-left: auto;
    }
  }
}


.more-settings-arrow {
  margin-left: 6px;
}

.model-edit-form :deep(.el-divider) {
  margin: 16px 0;
}

.model-type-title {
  gap: 4px;
  margin-bottom: 10px;
  color: #1d2129;
  font-size: 14px;
  font-weight: 500;
}

.model-type-list {
  flex-wrap: wrap;
  gap: 6px;
}

.model-type-list :deep(.el-check-tag) {
  gap: 4px;
  min-height: 26px;
  padding: 0 9px;
  border-radius: 4px;
  color: #86909c;
  font-size: 12px;
}

.model-type-list :deep(.el-check-tag.is-checked) {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
</style>
