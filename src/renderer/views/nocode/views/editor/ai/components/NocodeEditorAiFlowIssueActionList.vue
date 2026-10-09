<template>
  <section
    v-if="issues.length"
    class="flow-issue-list"
  >
    <header class="flow-issue-list__header">
      <div class="flow-issue-list__header-top">
        <div class="flow-issue-list__title">{{ $t('nocodeEditorAiFlowIssueActionList.workflowDraftIssues') }}</div>
        <el-tag type="warning" effect="light">
          {{ $t('nocodeEditorAiFlowIssueActionList.issueCount', { count: issueNodeCount }) }}
        </el-tag>
      </div>
      <div class="flow-issue-list__summary">{{ getSummaryText() }}</div>
    </header>

    <div
      v-for="group in getVisibleGroups()"
      :key="group.key"
      class="flow-issue-list__group"
    >
      <div class="flow-issue-list__group-title">{{ group.label }}</div>
      <div
        v-for="issue in group.issues"
        :key="issue.id"
        class="flow-issue-list__item"
      >
        <div class="flow-issue-list__item-main">
          <div
            class="flow-issue-list__item-title"
            :title="issue.targetLabel"
          >
            {{ issue.targetLabel || $t('nocodeEditorAiFlowIssueActionList.unnamedNode') }}
          </div>
          <div class="flow-issue-list__item-message">
            {{ formatIssueMessages(issue.mergedMessages) }}
          </div>
        </div>
        <el-button
          size="small"
          text
          type="primary"
          @click="emit('locate', issue)"
        >{{ $t('nocodeEditorAiFlowIssueActionList.locate') }}</el-button>
      </div>
    </div>

    <el-button
      v-if="issues.length > maxCollapsedItems"
      class="flow-issue-list__toggle"
      text
      @click="expanded = !expanded"
    >
      {{ expanded ? $t('nocodeEditorAiFlowIssueActionList.collapse') : $t('nocodeEditorAiFlowIssueActionList.viewAllIssues', { count: issueNodeCount }) }}
    </el-button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import i18next from 'i18next'
import type { NocodeEditorAiFlowActionIssue } from '../types'
import { groupFlowActionIssues, type NocodeEditorAiFlowActionIssueGroup } from '../flowIssueActionList'

const props = withDefaults(defineProps<{
  issues: NocodeEditorAiFlowActionIssue[]
  summary?: string
  maxCollapsedItems?: number
}>(), {
  summary: '',
  maxCollapsedItems: 8,
})

const emit = defineEmits<{
  (event: 'locate', issue: NocodeEditorAiFlowActionIssue): void
}>()

const expanded = ref(false)
const issueNodeCount = computed(() => (
  new Set(props.issues.map(issue => issue.targetId || issue.targetLabel)).size
))

const getSummaryText = () => {
  const summary = String(props.summary || '').trim()
  const isEnglish = /^en(?:-|$)/i.test(i18next.resolvedLanguage || i18next.language || '')
  if (summary && !(isEnglish && /[\u3400-\u9fff]/.test(summary))) {
    return summary
  }
  return i18next.t('nocodeEditorAiFlowIssueActionList.unresolvedFlowIssuesSummary', { count: issueNodeCount.value })
}

const visibleIssues = computed(() => (
  expanded.value
    ? props.issues
    : props.issues.slice(0, props.maxCollapsedItems)
))

const getVisibleGroups = (): NocodeEditorAiFlowActionIssueGroup[] => groupFlowActionIssues(visibleIssues.value)

const formatIssueMessages = (messages: string[]) => {
  const normalized = messages
    .map(item => String(item || '').trim())
    .filter(Boolean)
  if (!normalized.length) {
    return i18next.t('nocodeEditorAiFlowIssueActionList.incompleteConfig')
  }
  if (normalized.length === 1) {
    return normalized[0]
  }
  return i18next.t('nocodeEditorAiFlowIssueActionList.incompleteConfigWithReasons', {
    reasons: normalized.join(i18next.t('nocodeEditorAiFlowIssueActionList.listSeparator')),
  })
}
</script>

<style scoped lang="scss">
.flow-issue-list {
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

.flow-issue-list__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.flow-issue-list__title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #7c4a03;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.flow-issue-list__header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.flow-issue-list__summary {
  color: #8a5a13;
  font-size: 12px;
  line-height: 1.5;
}

.flow-issue-list__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flow-issue-list__group-title {
  color: #a15c05;
  font-size: 12px;
  font-weight: 700;
}

.flow-issue-list__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(215, 153, 43, 0.26);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.74);
}

.flow-issue-list__item-main {
  flex: 1;
  min-width: 0;
}

.flow-issue-list__item-title {
  overflow: hidden;
  color: #2f2414;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-issue-list__item-message {
  margin-top: 3px;
  color: #7d6a4f;
  font-size: 12px;
  line-height: 1.45;
}

.flow-issue-list__toggle {
  align-self: flex-start;
  padding-left: 0;
}
</style>
