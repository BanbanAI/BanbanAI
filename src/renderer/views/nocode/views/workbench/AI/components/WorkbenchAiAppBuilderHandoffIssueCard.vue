<template>
  <section class="workbench-ai-handoff-issue-card" :aria-label="$t('workbenchAiAppBuilderHandoffIssueCard.appCreationErrorCard')">
    <div class="workbench-ai-handoff-issue-card__header">
      <div class="workbench-ai-handoff-issue-card__eyebrow">
        <span class="workbench-ai-handoff-issue-card__dot" aria-hidden="true"></span>
        <span>{{ $t('workbenchAiAppBuilderHandoffIssueCard.handoffError') }}</span>
      </div>
      <span class="workbench-ai-handoff-issue-card__pill">{{ issueLabel }}</span>
    </div>

    <div class="workbench-ai-handoff-issue-card__body">
      <h3 class="workbench-ai-handoff-issue-card__title">{{ issue.title }}</h3>
      <p class="workbench-ai-handoff-issue-card__summary">{{ issue.summary }}</p>
      <p class="workbench-ai-handoff-issue-card__hint">{{ $t('workbenchAiAppBuilderHandoffIssueCard.handoffErrorTip') }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import i18next from 'i18next'
import type { WorkbenchAiAppBuilderHandoffIssuePreview } from '../workbenchAiInsightPanelModel'

// eslint-disable-next-line vue/valid-define-props
const props = defineProps<{
  issue: WorkbenchAiAppBuilderHandoffIssuePreview
}>()

const ISSUE_LABEL_MAP: Record<WorkbenchAiAppBuilderHandoffIssuePreview['issueCode'], string> = {
  get missing_entry_title() { return i18next.t('workbenchAiAppBuilderHandoffIssueCard.missingEntryTitle') },
  get invalid_creation_mode() { return i18next.t('workbenchAiAppBuilderHandoffIssueCard.invalidCreationMode') },
  get invalid_intent_kind() { return i18next.t('workbenchAiAppBuilderHandoffIssueCard.invalidIntentKind') },
  get invalid_json() { return i18next.t('workbenchAiAppBuilderHandoffIssueCard.invalidJson') },
}

const issueLabel = computed(() => (
  ISSUE_LABEL_MAP[props.issue.issueCode] || i18next.t('workbenchAiAppBuilderHandoffIssueCard.handoffError')
))
</script>

<style scoped lang="scss">
.workbench-ai-handoff-issue-card {
  width: 100%;
  border: 1px solid rgba(198, 86, 86, 0.18);
  border-radius: 16px;
  background:
    radial-gradient(circle at top right, rgba(230, 96, 96, 0.16), transparent 36%),
    linear-gradient(180deg, #fff8f8 0%, #ffffff 100%);
  box-shadow: 0 16px 36px rgba(110, 38, 38, 0.08);
  color: #1d2129;
  overflow: hidden;
}

.workbench-ai-handoff-issue-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 0;
}

.workbench-ai-handoff-issue-card__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #b43c3c;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}

.workbench-ai-handoff-issue-card__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #d14b4b;
  box-shadow: 0 0 0 4px rgba(209, 75, 75, 0.12);
}

.workbench-ai-handoff-issue-card__pill {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 2px 9px;
  border-radius: 999px;
  background: rgba(198, 86, 86, 0.12);
  color: #b43c3c;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
}

.workbench-ai-handoff-issue-card__body {
  padding: 10px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.workbench-ai-handoff-issue-card__title {
  margin: 0;
  color: #17233d;
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
}

.workbench-ai-handoff-issue-card__summary {
  margin: 0;
  color: #6b7785;
  font-size: 13px;
  line-height: 20px;
  white-space: pre-wrap;
}

.workbench-ai-handoff-issue-card__hint {
  margin: 0;
  color: #b43c3c;
  font-size: 12px;
  line-height: 18px;
}
</style>
