<template>
  <div class="workbench-ai-provider-dialog">
    <el-dialog
      :model-value="modelValue"
      :title="$t(editing ? 'WorkbenchAiProviderDialog.editModelService' : 'WorkbenchAiProviderDialog.addModelService')"
      :width="480"
      align-center
      :close-on-click-modal="false"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <div class="provider-dialog">
        <div class="provider-type-list">
          <button
            v-for="option in providerTypeOptions"
            :key="option.value"
            type="button"
            class="provider-type-card"
            :class="{ 'is-active': providerForm.type === option.value }"
            :disabled="editing"
            @click="emit('type-change', option.value)"
          >
            <div class="provider-type-card__title">{{ option.label }}</div>
            <p>{{ option.description }}</p>
          </button>
        </div>
  
        <el-form label-position="top">
          <el-form-item :label="$t('WorkbenchAiProviderDialog.serviceName')">
            <el-input
              :model-value="providerForm.name"
              :placeholder="$t('WorkbenchAiProviderDialog.localOllamaPlaceholder')"
              @update:model-value="emit('field-change', 'name', String($event || '').trim())"
            />
          </el-form-item>
          <el-form-item :label="$t('WorkbenchAiProviderDialog.serviceUrl')">
            <el-input
              :model-value="providerForm.baseUrl"
              :placeholder="providerForm.type === 'ollama' ? 'http://localhost:11434' : 'https://example.com/v1'"
              @update:model-value="emit('field-change', 'baseUrl', String($event || '').trim())"
            />
          </el-form-item>
          <el-form-item v-if="providerForm.type === 'openai-compatible'" :label="$t('WorkbenchAiProviderDialog.apiKey')">
            <el-input
              :model-value="providerForm.apiKey"
              type="password"
              clearable
              placeholder="sk-proj-..."
              @update:model-value="emit('field-change', 'apiKey', String($event || '').trim())"
            />
          </el-form-item>
        </el-form>
      </div>
  
      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ $t('WorkbenchAiProviderDialog.cancel') }}</el-button>
        <el-button type="primary" @click="emit('confirm')">{{ $t(editing ? 'WorkbenchAiProviderDialog.confirmEdit' : 'WorkbenchAiProviderDialog.confirmAdd') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'

type ProviderFormType = 'ollama' | 'openai-compatible'

interface ProviderForm {
  type: ProviderFormType
  name: string
  baseUrl: string
  apiKey: string
}

interface ProviderTypeOption {
  value: ProviderFormType
  label: string
  description: string
}

defineProps({
  modelValue: {
    type: Boolean,
    required: true,
  },
  providerForm: {
    type: Object as PropType<ProviderForm>,
    required: true,
  },
  providerTypeOptions: {
    type: Array as PropType<ProviderTypeOption[]>,
    required: true,
  },
  editing: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'update:modelValue',
  'type-change',
  'field-change',
  'confirm',
])
</script>

<style scoped lang="scss">
.workbench-ai-provider-dialog {
  :deep(.el-dialog) {
    border-radius: 4px ;
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
      
      .provider-dialog {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .provider-type-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
  
        .provider-type-card {
          width: 100%;
          min-width: 0;
          min-height: 64px;
          padding: 10px 12px;
          border: 1px solid #e5e6eb;
          border-radius: 4px;
          background: #fff;
          text-align: left;
          cursor: var(--cursor-pointer);
          appearance: none;
          color: inherit;
          font: inherit;
    
          &:hover,
          &.is-active {
            border-color: #165dff;
            box-shadow: none;
            background: #fff;
          }

          &:disabled {
            cursor: default;
          }
    
          .provider-type-card__title {
            font-size: 14px;
            line-height: 22px;
            font-weight: 400;
            color: #1d2129;
          }
    
          p {
            margin: 2px 0 0;
            font-size: 12px;
            line-height: 18px;
            color: #86909c;
          }
        }
      }

      .el-input__wrapper,
      .el-textarea__inner,
      .el-select__wrapper {
        min-height: 32px;
        border-radius: 4px;
        background: #fff;
        box-shadow: 0 0 0 1px #c9cdd4 inset;
  
        &:hover {
          box-shadow: 0 0 0 1px #c0c4cc inset;
        }
      }

      .el-input.is-focus .el-input__wrapper,
      .el-select.is-focused .el-select__wrapper,
      .el-textarea__inner:focus {
        box-shadow: 0 0 0 1px var(--el-color-primary) inset;
      }

      .el-form-item {
        margin-bottom: 16px;
      }

      .el-form-item:last-child {
        margin-bottom: 0;
      }

      .el-form-item__label {
        height: 20px;
        margin-bottom: 6px;
        padding: 0;
        color: #1d2129;
        font-size: 14px;
        line-height: 20px;
      }
    }

    .el-dialog__footer {
      height: 80px;
      padding: 24px;
      border-top: 1px solid #e5e6eb;
      box-sizing: border-box;
  
      .el-button {
        height: 32px;
        margin-left: 8px;
        border-radius: 4px;
      }
    }
  }
}

@media (max-width: 960px) {
  .provider-type-list {
    grid-template-columns: 1fr;
  }
}
</style>
