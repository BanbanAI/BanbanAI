<template>
  <div
    v-if="group"
    class="ai-blueprint-workbench-group-summary-panel"
  >
    <section class="ai-blueprint-workbench-group-summary-panel__shell">
      <section class="ai-blueprint-workbench-group-summary-panel__hero">
        <div class="ai-blueprint-workbench-group-summary-panel__hero-top">
          <div class="ai-blueprint-workbench-group-summary-panel__hero-main">
            <div class="ai-blueprint-workbench-group-summary-panel__title">{{ group.name }}</div>
          </div>

        <el-button
          v-if="showApply"
          type="primary"
          plain
          class="ai-blueprint-workbench-group-summary-panel__action"
          :loading="loading"
          :disabled="disabled"
          @click="emit('apply-group')"
        >{{ $t('nocodeEditorAiBlueprintWorkbenchGroupSummaryPanel.generateByGroup') }}</el-button>
        </div>

        <div class="ai-blueprint-workbench-group-summary-panel__description">
          {{ group.summaryText || group.description || $t('nocodeEditorAiBlueprintWorkbenchGroupSummaryPanel.defaultSummary') }}
        </div>
      </section>

      <section class="ai-blueprint-workbench-group-summary-panel__strip">
        <div class="ai-blueprint-workbench-group-summary-panel__strip-copy">
          {{ group.stripText }}
        </div>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import type { BlueprintWorkbenchGroup } from '../blueprintWorkbenchViewModel'

defineProps({
  group: {
    type: Object as PropType<BlueprintWorkbenchGroup | null>,
    default: null,
  },
  showApply: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['apply-group'])
</script>

<style scoped lang="scss">
.ai-blueprint-workbench-group-summary-panel {
  min-width: 0;
}

.ai-blueprint-workbench-group-summary-panel__shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--blueprint-border);
  background: var(--blueprint-surface);
}

.ai-blueprint-workbench-group-summary-panel__hero {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-blueprint-workbench-group-summary-panel__hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ai-blueprint-workbench-group-summary-panel__hero-main {
  min-width: 0;
  flex: 1;
}

.ai-blueprint-workbench-group-summary-panel__title {
  font-size: 18px;
  line-height: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-workbench-group-summary-panel__action {
  min-width: 98px;
  min-height: 32px;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 22px;
  border-color: #bfd7ff;
  background: #fff;
  color: var(--blueprint-brand);
}

.ai-blueprint-workbench-group-summary-panel__description {
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-group-summary-panel__strip {
  padding: 4px 6px;
  border-radius: 4px;
  background: #edf5ff;
}

.ai-blueprint-workbench-group-summary-panel__strip-copy {
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
  color: var(--blueprint-brand);
}

@media (max-width: 1100px) {
  .ai-blueprint-workbench-group-summary-panel__shell {
    padding: 18px;
  }

  .ai-blueprint-workbench-group-summary-panel__title {
    font-size: 18px;
    line-height: 26px;
  }
}
</style>
