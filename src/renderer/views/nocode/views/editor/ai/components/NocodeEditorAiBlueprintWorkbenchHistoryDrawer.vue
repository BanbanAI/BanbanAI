<template>
  <el-drawer
    :model-value="modelValue"
    :title="drawerTitle"
    size="420px"
    append-to-body
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="ai-blueprint-workbench-history-drawer">
      <div v-if="entries.length" class="ai-blueprint-workbench-history-drawer__list">
        <article
          v-for="entry in entries"
          :key="entry.key"
          class="ai-blueprint-workbench-history-drawer__entry"
          :class="{ 'is-selected': entry.selected }"
        >
          <div class="ai-blueprint-workbench-history-drawer__entry-title">{{ entry.title }}</div>
          <div v-if="entry.summary" class="ai-blueprint-workbench-history-drawer__entry-summary">
            {{ entry.summary }}
          </div>
          <div class="ai-blueprint-workbench-history-drawer__entry-meta">
            <span>
              {{
                entry.mode === 'review'
                  ? $t('nocodeEditorAiBlueprintWorkbenchHistoryDrawer.pendingGeneration')
                  : $t('nocodeEditorAiBlueprintWorkbenchHistoryDrawer.generated')
              }}
            </span>
            <span>{{ entry.timeText }}</span>
            <span v-if="entry.sourceText">{{ entry.sourceText }}</span>
          </div>
        </article>
      </div>
      <el-empty v-else :description="emptyDescription" />
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import i18next from 'i18next'
import { computed } from 'vue'
import type {
  BlueprintWorkbenchHistoryEntry,
  BlueprintWorkbenchMode,
} from '../blueprintWorkbenchViewModel'

const props = defineProps<{
  modelValue: boolean
  entries: BlueprintWorkbenchHistoryEntry[]
  mode: BlueprintWorkbenchMode
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
}>()

const drawerTitle = computed(() => (
  props.mode === 'review'
    ? i18next.t('nocodeEditorAiBlueprintWorkbenchHistoryDrawer.backgroundQueue')
    : i18next.t('nocodeEditorAiBlueprintWorkbenchHistoryDrawer.backgroundRecords')
))

const emptyDescription = computed(() => (
  props.mode === 'review'
    ? i18next.t('nocodeEditorAiBlueprintWorkbenchHistoryDrawer.emptyQueue')
    : i18next.t('nocodeEditorAiBlueprintWorkbenchHistoryDrawer.emptyRecords')
))
</script>

<style scoped lang="scss">
.ai-blueprint-workbench-history-drawer {
  height: 100%;
}

.ai-blueprint-workbench-history-drawer__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-blueprint-workbench-history-drawer__entry {
  border: 1px solid #e2e9f2;
  border-radius: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  padding: 14px;
}

.ai-blueprint-workbench-history-drawer__entry.is-selected {
  border-color: #7ca8ea;
  box-shadow: 0 0 0 1px rgba(53, 114, 215, 0.12);
}

.ai-blueprint-workbench-history-drawer__entry-title {
  font-size: 14px;
  line-height: 22px;
  font-weight: 700;
  color: #1f2d3d;
}

.ai-blueprint-workbench-history-drawer__entry-summary {
  margin-top: 6px;
  font-size: 12px;
  line-height: 18px;
  color: #67778e;
}

.ai-blueprint-workbench-history-drawer__entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  line-height: 18px;
  color: #74849a;
}
</style>
