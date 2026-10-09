<template>
  <section
    v-if="!hidden && (issues.length || resolved)"
    :class="['draft-issue-list', { 'is-compact': compact, 'is-resolved': resolved }]"
  >
    <header class="draft-issue-list__header">
      <div class="draft-issue-list__title-row">
        <div class="draft-issue-list__heading">
          <div class="draft-issue-list__title">{{ resolved ? $t('nocodeEditorAiDraftIssueActionList.draftIssuesCompleted') : $t('nocodeEditorAiDraftIssueActionList.draftIssueChecklist') }}</div>
        </div>
        <el-tag
          class="draft-issue-list__status-tag"
          :type="resolved ? 'success' : 'warning'"
          effect="light"
        >
          {{ resolved ? $t('nocodeEditorAiDraftIssueActionList.completed') : $t('nocodeEditorAiDraftIssueActionList.issueCount', { count: issues.length }) }}
        </el-tag>
      </div>
      <div class="draft-issue-list__summary">{{ summaryText }}</div>
    </header>

    <div
      v-if="resolved"
      class="draft-issue-list__resolved-note"
    >{{ $t('nocodeEditorAiDraftIssueActionList.allDraftIssuesCompletedTip') }}</div>

    <template v-else>
      <div
      v-for="group in visibleGroups"
      :key="group.key"
      class="draft-issue-list__group"
      >
        <div class="draft-issue-list__group-title">{{ group.label }}</div>
        <div
          v-for="issue in group.issues"
          :key="issue.id"
          class="draft-issue-list__item"
        >
          <div class="draft-issue-list__item-main">
            <div
              class="draft-issue-list__item-title"
              :title="getIssueDisplayTitle(issue)"
            >
              {{ getIssueDisplayTitle(issue) }}
            </div>
            <div class="draft-issue-list__item-message">{{ issue.message }}</div>
          </div>
          <el-button
            size="small"
            text
            type="primary"
            :disabled="isLocateDisabled(issue)"
            @click="emit('locate', issue)"
          >{{ $t('nocodeEditorAiDraftIssueActionList.locate') }}</el-button>
        </div>
      </div>
 
      <el-button
        v-if="issues.length > maxCollapsedItems"
        class="draft-issue-list__toggle"
        text
        @click="expanded = !expanded"
      >
        {{ expanded ? $t('nocodeEditorAiDraftIssueActionList.collapse') : $t('nocodeEditorAiDraftIssueActionList.viewAllIssues', { count: issues.length }) }}
      </el-button>
    </template>

  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import i18next from 'i18next'
import type { NocodeEditorAiDraftActionIssue } from '../types'
import { groupDraftActionIssues } from '../draftIssueActionList'

const props = withDefaults(defineProps<{
  issues: NocodeEditorAiDraftActionIssue[]
  summary?: string
  compact?: boolean
  maxCollapsedItems?: number
  resolved?: boolean
  autoHideAfterMs?: number
}>(), {
  summary: '',
  compact: false,
  maxCollapsedItems: 8,
  resolved: false,
  autoHideAfterMs: 0,
})

const emit = defineEmits<{
  (event: 'locate', issue: NocodeEditorAiDraftActionIssue): void
}>()

const expanded = ref(false)
const hidden = ref(false)
let autoHideTimer: ReturnType<typeof setTimeout> | null = null

const clearAutoHideTimer = () => {
  if (!autoHideTimer) {
    return
  }
  clearTimeout(autoHideTimer)
  autoHideTimer = null
}

const summaryText = computed(() => (
  props.resolved
    ? (props.summary || i18next.t('nocodeEditorAiDraftIssueActionList.allIssuesResolvedSummary'))
    : (props.summary || i18next.t('nocodeEditorAiDraftIssueActionList.unresolvedIssuesSummary', { count: props.issues.length }))
))

const visibleIssues = computed(() => (
  expanded.value
    ? props.issues
    : props.issues.slice(0, props.maxCollapsedItems)
))

const visibleGroups = computed(() => groupDraftActionIssues(visibleIssues.value))

const getIssueDisplayTitle = (issue: NocodeEditorAiDraftActionIssue) => {
  const targetLabel = String(issue.targetLabel || issue.targetId || i18next.t('nocodeEditorAiDraftIssueActionList.unnamedField')).trim()
  const formLabel = String(issue.locator?.formLabel || '').trim()
  return issue.targetKind === 'form_field' && formLabel
    ? `${formLabel} · ${targetLabel}`
    : targetLabel
}

const isLocateDisabled = (issue: NocodeEditorAiDraftActionIssue) => issue.targetKind !== 'form_field'

watch(
  [() => props.resolved, () => props.autoHideAfterMs],
  ([resolved, autoHideAfterMs]) => {
    clearAutoHideTimer()
    hidden.value = false

    if (!resolved) {
      return
    }
    if (autoHideAfterMs <= 0) {
      return
    }

    autoHideTimer = setTimeout(() => {
      hidden.value = true
    }, autoHideAfterMs)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  clearAutoHideTimer()
})
</script>

<style scoped lang="scss">
.draft-issue-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 14px;
  border: 1px solid #f1d6a8;
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 251, 243, 0.98), rgba(255, 247, 232, 0.98)),
    linear-gradient(135deg, rgba(245, 158, 11, 0.08), transparent 58%);
  box-shadow: 0 6px 14px rgba(146, 99, 20, 0.05);
}

.draft-issue-list.is-resolved {
  border-color: #b7e3c2;
  background:
    linear-gradient(180deg, rgba(245, 252, 247, 0.98), rgba(236, 249, 240, 0.98)),
    linear-gradient(135deg, rgba(34, 197, 94, 0.08), transparent 58%);
  box-shadow: 0 6px 14px rgba(39, 117, 67, 0.05);
}

.draft-issue-list.is-compact {
  padding: 12px;
  border-radius: 14px;
}

.draft-issue-list__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.draft-issue-list__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.draft-issue-list__heading {
  flex: 1;
  min-width: 0;
}

.draft-issue-list__status-tag {
  flex-shrink: 0;
}

.draft-issue-list__title {
  color: #7c4a03;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.draft-issue-list.is-resolved .draft-issue-list__title {
  color: #1f6b37;
}

.draft-issue-list__summary {
  color: #8a5a13;
  font-size: 12px;
  line-height: 1.5;
}

.draft-issue-list.is-resolved .draft-issue-list__summary {
  color: #3d7a50;
}

.draft-issue-list__resolved-note {
  color: #295b3a;
  font-size: 12px;
  line-height: 1.55;
  padding: 10px 12px;
  border: 1px solid rgba(74, 175, 110, 0.2);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}

.draft-issue-list__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.draft-issue-list__group-title {
  color: #a15c05;
  font-size: 12px;
  font-weight: 700;
}

.draft-issue-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(215, 153, 43, 0.26);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.74);
}

.draft-issue-list__item-main {
  flex: 1;
  min-width: 0;
}

.draft-issue-list__item-title {
  overflow: hidden;
  color: #2f2414;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.draft-issue-list__item-message {
  margin-top: 3px;
  color: #7d6a4f;
  font-size: 12px;
  line-height: 1.45;
}

.draft-issue-list__toggle {
  align-self: flex-start;
  padding-left: 0;
}
</style>
