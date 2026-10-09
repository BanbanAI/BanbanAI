<template>
  <div class="workbench-ai-health-check-dialog">
    <el-dialog
      :model-value="modelValue"
      :title="$t('WorkbenchAiHealthCheckDialog.title')"
      width="500px"
      align-center
      :close-on-click-modal="false"
      @open="resetForm"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <el-alert
        type="warning"
        :title="$t('WorkbenchAiHealthCheckDialog.costWarning')"
        :closable="false"
        show-icon
      />

      <div class="health-check-options">
        <div class="health-check-option-row">
          <strong>{{ $t('WorkbenchAiHealthCheckDialog.concurrentCheck') }}:</strong>
          <el-segmented v-model="concurrentMode" :options="concurrentModeOptions" />
        </div>
        <div class="health-check-option-row">
          <strong>{{ $t('WorkbenchAiHealthCheckDialog.timeout') }}:</strong>
          <el-input-number v-model="timeoutSeconds" :min="5" :max="60" :step="1" controls-position="right">
            <template #suffix>s</template>
          </el-input-number>
        </div>
      </div>

      <template #footer>
        <el-button @click="emit('update:modelValue', false)">{{ $t('WorkbenchAiHealthCheckDialog.cancel') }}</el-button>
        <el-button type="primary" @click="handleStart">
          {{ $t('WorkbenchAiHealthCheckDialog.start') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import i18next from 'i18next'
import { computed, ref } from 'vue'

defineProps({
  modelValue: { type: Boolean, required: true },
})

const emit = defineEmits(['update:modelValue', 'start'])
const concurrentMode = ref<'disabled' | 'enabled'>('enabled')
const timeoutSeconds = ref(15)
const concurrentModeOptions = computed(() => [
  { label: i18next.t('WorkbenchAiHealthCheckDialog.disabled'), value: 'disabled' },
  { label: i18next.t('WorkbenchAiHealthCheckDialog.enabled'), value: 'enabled' },
])

const resetForm = () => {
  concurrentMode.value = 'enabled'
  timeoutSeconds.value = 15
}
const handleStart = () => emit('start', {
  concurrent: concurrentMode.value === 'enabled',
  timeoutMs: timeoutSeconds.value * 1000,
})
</script>

<style scoped lang="scss">
.workbench-ai-health-check-dialog {
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
      display: flex;
      flex-direction: column;
      gap: 16px;
  
      .el-alert {
        padding: 10px;
        border: 1px solid #ffd666;
        background: #fffbe6;
        border-radius: 4px;
    
        .el-alert__title {
          color: #1d2129;
          font-size: 12px;
          line-height: 20px;
        }
      }
      
      .health-check-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
  
        .health-check-option-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 32px;
          color: #1d2129;
          font-size: 14px;
          text-align: left;
    
          .el-segmented {
            --el-border-radius-base: 4px;
          }
    
          .el-input-number {
            width: 110px;
          }
        }
      }
    }

    .el-dialog__footer {
      padding: 24px;
      border-top: 1px solid #e5e6eb;

      .el-button {
        height: 32px;
        border-radius: 4px;
      }
    }
  }
}
</style>
