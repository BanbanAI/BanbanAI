<template>
  <div class="ai-blueprint-apply-confirm-dialog-wrapper">
  <el-dialog
    class="ai-blueprint-apply-confirm-dialog"
    :model-value="modelValue"
    :width="width"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="closeOnPressEscape"
    :show-close="false"
    :destroy-on-close="true"
    :draggable="true"
    @closed="handleClosed"
    @update:model-value="handleVisibleChange"
  >
    <template #header>
      <div class="ai-blueprint-apply-confirm-dialog__header">
        <div class="ai-blueprint-apply-confirm-dialog__title">{{ title }}</div>
        <button
          type="button"
          class="ai-blueprint-apply-confirm-dialog__close"
          :aria-label="$t('nocodeEditorAiBlueprintApplyConfirmDialog.close')"
          @click="handleCancel"
        >
          <el-icon :size="16">
            <i-ep-close />
          </el-icon>
        </button>
      </div>
    </template>

    <div class="ai-blueprint-apply-confirm-dialog__body">
      <div class="ai-blueprint-apply-confirm-dialog__summary">
        <el-icon class="ai-blueprint-apply-confirm-dialog__summary-icon" :size="20">
          <i-ep-warning-filled />
        </el-icon>
        <div class="ai-blueprint-apply-confirm-dialog__summary-text">{{ summaryText }}</div>
      </div>

      <div class="ai-blueprint-apply-confirm-dialog__risk">
        {{ riskText }}
      </div>

      <div class="ai-blueprint-apply-confirm-dialog__recommendation">
        {{ recommendationText }}
      </div>
    </div>

    <template #footer>
      <div class="ai-blueprint-apply-confirm-dialog__footer">
        <el-button class="ai-blueprint-apply-confirm-dialog__cancel" @click="handleCancel">
          {{ cancelText }}
        </el-button>
        <el-button
          class="ai-blueprint-apply-confirm-dialog__confirm"
          type="primary"
          @click="handleConfirm"
        >
          {{ confirmText }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</div>
</template>

<script setup lang="ts">
import i18next from 'i18next'
import { computed, ref } from 'vue'

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  summaryText?: string
  riskText?: string
  recommendationText?: string
  pendingQuestionCount?: number
  confirmText?: string
  cancelText?: string
  closeOnPressEscape?: boolean
  width?: number | string
}>(), {
  title: '',
  summaryText: '',
  riskText: '',
  recommendationText: '',
  pendingQuestionCount: 0,
  confirmText: '',
  cancelText: '',
  closeOnPressEscape: true,
  width: 400,
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'confirm'): void
  (event: 'cancel'): void
}>()

const title = computed(() => (
  props.title.trim() || i18next.t('nocodeEditorAiBlueprintApplyConfirmDialog.pendingConfirmation')
))
const riskText = computed(() => (
  props.riskText.trim() || i18next.t('nocodeEditorAiBlueprintApplyConfirmDialog.directGenerateRisk')
))
const confirmText = computed(() => (
  props.confirmText.trim() || i18next.t('nocodeEditorAiBlueprintApplyConfirmDialog.generateAnyway')
))
const cancelText = computed(() => (
  props.cancelText.trim() || i18next.t('nocodeEditorAiBlueprintApplyConfirmDialog.backToEdit')
))
const summaryText = computed(() => (
  props.summaryText.trim()
    || i18next.t('nocodeEditorAiBlueprintApplyConfirmDialog.pendingQuestionsSummary', { count: props.pendingQuestionCount })
))
const recommendationText = computed(() => (
  props.recommendationText.trim()
    || i18next.t('nocodeEditorAiBlueprintApplyConfirmDialog.adjustBeforeGenerate')
))

const closeReason = ref<'confirm' | 'cancel' | null>(null)

const handleVisibleChange = (value: boolean) => {
  if (!value && closeReason.value == null) {
    closeReason.value = 'cancel'
    emit('cancel')
  }
  emit('update:modelValue', value)
}

const handleConfirm = () => {
  closeReason.value = 'confirm'
  emit('confirm')
  emit('update:modelValue', false)
}

const handleCancel = () => {
  closeReason.value = 'cancel'
  emit('cancel')
  emit('update:modelValue', false)
}

const handleClosed = () => {
  closeReason.value = null
}
</script>

<style scoped lang="scss">
.ai-blueprint-apply-confirm-dialog-wrapper {

  :deep(.ai-blueprint-apply-confirm-dialog) {
    width: 400px;
    min-height: 252px;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
    display: flex;
    flex-direction: column;
    padding: 0;
    .el-dialog__header {
      margin: 0;
      padding: 0;
      height: 48px;
      border-bottom: 1px solid var(--border-color);
      text-align: center;
      box-sizing: content-box;
    }
  
  
    .el-dialog__body {
      flex: 1;
      min-height: 0;
      padding: 24px 20px;
      overflow: hidden;
    }
  
    .el-dialog__footer {
      margin: 0;
      padding: 16px 20px;
      border-top: 1px solid #e5e6eb;
    }
  }
  
  .ai-blueprint-apply-confirm-dialog__header {
    position: relative;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
  }
  
  .ai-blueprint-apply-confirm-dialog__title {
    font-size: 16px;
    line-height: 24px;
    color: #1d2129;
  }
  
  .ai-blueprint-apply-confirm-dialog__close {
    position: absolute;
    right: 0;
    top: 0;
    width: 48px;
    height: 48px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #4e5969;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .ai-blueprint-apply-confirm-dialog__body {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .ai-blueprint-apply-confirm-dialog__summary {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  
  .ai-blueprint-apply-confirm-dialog__summary-icon {
    flex-shrink: 0;
    margin-top: 1px;
    color: #faad14;
  }
  
  .ai-blueprint-apply-confirm-dialog__summary-text {
    font-size: 14px;
    line-height: 22px;
    color: #1d2129;
  }
  
  .ai-blueprint-apply-confirm-dialog__risk {
    padding: 8px;
    border-radius: 4px;
    background: #fffbe8;
    color: #cf870c;
    font-size: 14px;
    line-height: 22px;
  }

  .ai-blueprint-apply-confirm-dialog__recommendation {
    padding: 8px 10px;
    border-radius: 4px;
    background: #f7f8fa;
    color: #4e5969;
    font-size: 14px;
    line-height: 22px;
  }
  
  .ai-blueprint-apply-confirm-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  
  .ai-blueprint-apply-confirm-dialog__cancel,
  .ai-blueprint-apply-confirm-dialog__confirm {
    min-width: 112px;
    height: 32px;
    padding: 0 18px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 22px;
  }
  
  .ai-blueprint-apply-confirm-dialog__cancel {
    background: #f2f3f5;
    border-color: #f2f3f5;
    color: #4e5969;
  }
  
  .ai-blueprint-apply-confirm-dialog__confirm {
    background: #0873ff;
    border-color: #0873ff;
  }
}
</style>
