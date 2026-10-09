<template>
  <div class="workbench-ai-model-validation-dialog">
    <el-dialog
      :model-value="modelValue"
      :title="$t('WorkbenchAiModelValidationDialog.title')"
      width="480px"
      align-center
      :close-on-click-modal="false"
      @open="resetSelection"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <el-select
        v-model="selectedModelId"
        class="model-validation-select"
        :placeholder="$t('WorkbenchAiModelValidationDialog.placeholder')"
      >
        <el-option
          v-for="model in models"
          :key="model.id"
          :label="getModelDisplayName(provider, model)"
          :value="model.id"
        />
      </el-select>

      <el-alert
        v-if="errorMessage"
        class="validation-error"
        type="error"
        :closable="false"
        :title="errorMessage"
      />
  
      <template #footer>
        <el-button :disabled="submitting" @click="emit('update:modelValue', false)">{{ $t('WorkbenchAiModelValidationDialog.cancel') }}</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!selectedModelId || submitting" @click="handleConfirm">
          {{ $t('WorkbenchAiModelValidationDialog.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import type { AiProviderConfig, AiProviderModel } from '@common/types/ai-provider'
import type { PropType } from 'vue'
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, required: true },
  provider: { type: Object as PropType<AiProviderConfig | null>, default: null },
  models: { type: Array as PropType<AiProviderModel[]>, required: true },
  submitting: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  getModelDisplayName: {
    type: Function as PropType<(provider?: Pick<AiProviderConfig, 'type'> | null, model?: AiProviderModel | null) => string>,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue', 'confirm'])
const selectedModelId = ref('')

const resetSelection = () => {
  selectedModelId.value = props.models[0]?.id || ''
}

const handleConfirm = () => {
  const model = props.models.find(item => item.id === selectedModelId.value)
  if (!model) return
  emit('confirm', {
    model,
  })
}
</script>

<style scoped lang="scss">
.workbench-ai-model-validation-dialog {
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

      .model-validation-select {
        width: 100%;
  
        .el-select__wrapper {
          min-height: 32px;
          border-radius: 4px;
          background: #fff;
          box-shadow: 0 0 0 1px #c9cdd4 inset;
        }
      }

      .validation-error {
        margin-top: 16px;
        word-break: break-word;
      }
    }
    
    .el-dialog__footer {
      height: 80px;
      padding: 24px;
      border-top: 1px solid #e5e6eb;
      box-sizing: border-box;
      
      .el-button {
        min-width: 60px;
        height: 32px;
        margin-left: 8px;
        border-radius: 4px;
      }
    }
  }
}
</style>
