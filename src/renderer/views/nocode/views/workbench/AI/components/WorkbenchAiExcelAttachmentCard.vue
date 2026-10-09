<template>
  <div class="workbench-ai-excel-attachment-card" :class="{ 'is-expired': isExpired }">
    <div class="workbench-ai-excel-attachment-card__head">
      <div class="workbench-ai-excel-attachment-card__title-wrap">
        <div class="workbench-ai-excel-attachment-card__icon" aria-hidden="true">
          <el-icon :size="18"><i-ep-document /></el-icon>
        </div>
        <div class="workbench-ai-excel-attachment-card__heading">
          <div class="workbench-ai-excel-attachment-card__eyebrow">{{ $t('workbenchAiExcelAttachmentCard.excelFile') }}</div>
          <div class="workbench-ai-excel-attachment-card__title">{{ attachment.name }}</div>
        </div>
      </div>
      <span class="workbench-ai-excel-attachment-card__badge" :class="{ 'is-expired': isExpired }">
        {{ isExpired ? $t('workbenchAiExcelAttachmentCard.expired') : $t('workbenchAiExcelAttachmentCard.reusable') }}
      </span>
    </div>

    <div class="workbench-ai-excel-attachment-card__section">
      <div class="workbench-ai-excel-attachment-card__section-title">{{ $t('workbenchAiExcelAttachmentCard.availableActions') }}</div>
      <p class="workbench-ai-excel-attachment-card__section-copy">
        {{ isExpired ? $t('workbenchAiExcelAttachmentCard.expiredActionTip') : $t('workbenchAiExcelAttachmentCard.reusableActionTip') }}
      </p>
    </div>

    <div v-if="isExpired" class="workbench-ai-excel-attachment-card__expired">{{ $t('workbenchAiExcelAttachmentCard.fileExpiredUploadAgain') }}</div>

    <div class="workbench-ai-excel-attachment-card__actions">
      <button
        type="button"
        class="workbench-ai-excel-attachment-card__action"
        :disabled="isExpired || createDisabled"
        @click="emit('create-form-from-attachment', attachment)"
      >{{ $t('workbenchAiExcelAttachmentCard.createFormFromFile') }}</button>
      <button
        type="button"
        class="workbench-ai-excel-attachment-card__action workbench-ai-excel-attachment-card__action--secondary"
        :disabled="isExpired"
        @click="emit('add-attachment-to-composer', attachment)"
      >{{ $t('workbenchAiExcelAttachmentCard.addToInput') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiAttachmentReference } from '@common/types/aiAttachment'

// eslint-disable-next-line vue/valid-define-props
defineProps<{
  attachment: AiAttachmentReference
  isExpired?: boolean
  createDisabled?: boolean
}>()

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'create-form-from-attachment', attachment: AiAttachmentReference): void
  (event: 'add-attachment-to-composer', attachment: AiAttachmentReference): void
}>()
</script>

<style scoped lang="scss">
.workbench-ai-excel-attachment-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  padding: 16px;
  border: 1px solid #dce8f6;
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(246, 251, 255, 0.98), rgba(255, 255, 255, 0.98)),
    linear-gradient(135deg, rgba(92, 162, 255, 0.12), transparent 58%);
  box-shadow: 0 6px 14px rgba(36, 77, 134, 0.05);
  box-sizing: border-box;
}

.workbench-ai-excel-attachment-card.is-expired {
  border-color: #f4b8b8;
  background:
    linear-gradient(180deg, rgba(255, 250, 250, 0.98), rgba(255, 255, 255, 0.98)),
    linear-gradient(135deg, rgba(245, 63, 63, 0.08), transparent 58%);
}

.workbench-ai-excel-attachment-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.workbench-ai-excel-attachment-card__title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.workbench-ai-excel-attachment-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.workbench-ai-excel-attachment-card__heading {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.workbench-ai-excel-attachment-card__eyebrow {
  color: #607791;
  font-size: 12px;
  line-height: 18px;
  font-weight: 500;
}

.workbench-ai-excel-attachment-card__title {
  color: #173150;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
  word-break: break-word;
}

.workbench-ai-excel-attachment-card__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(8, 115, 255, 0.1);
  color: #0f63d8;
  font-size: 11px;
  line-height: 16px;
  font-weight: 700;
}

.workbench-ai-excel-attachment-card__badge.is-expired {
  background: rgba(245, 63, 63, 0.12);
  color: #cf2f2f;
}

.workbench-ai-excel-attachment-card__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(220, 232, 246, 0.9);
}

.workbench-ai-excel-attachment-card__section-title {
  color: #1d2129;
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
}

.workbench-ai-excel-attachment-card__section-copy {
  margin: 0;
  color: #4e5969;
  font-size: 13px;
  line-height: 20px;
}

.workbench-ai-excel-attachment-card__expired {
  color: #f53f3f;
  font-size: 12px;
  line-height: 18px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(245, 63, 63, 0.08);
}

.workbench-ai-excel-attachment-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.workbench-ai-excel-attachment-card__action {
  border: 0;
  border-radius: 12px;
  min-height: 42px;
  padding: 10px 14px;
  background: linear-gradient(180deg, #2688ff 0%, #1467d8 100%);
  color: #ffffff;
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
  cursor: var(--cursor-pointer);
}

.workbench-ai-excel-attachment-card__action:disabled {
  background: #f2f3f5;
  color: #86909c;
  cursor: not-allowed;
}

.workbench-ai-excel-attachment-card__action--secondary {
  background: #ffffff;
  color: #1677ff;
  border: 1px solid #cddff8;
}

@media (max-width: 768px) {
  .workbench-ai-excel-attachment-card__head {
    align-items: flex-start;
    flex-direction: column;
  }

  .workbench-ai-excel-attachment-card__actions {
    grid-template-columns: 1fr;
  }
}
</style>
