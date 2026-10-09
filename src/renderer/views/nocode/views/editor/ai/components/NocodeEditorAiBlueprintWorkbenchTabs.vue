<template>
  <section class="ai-blueprint-workbench-tabs">
    <div class="ai-blueprint-workbench-tabs__top">
      <div class="ai-blueprint-workbench-tabs__bar" role="tablist" :aria-label="$t('nocodeEditorAiBlueprintWorkbenchTabs.blueprintWorkbenchTabs')">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          role="tab"
          class="ai-blueprint-workbench-tabs__button"
          :class="{ 'is-active': tab.key === activeKey }"
          :aria-selected="tab.key === activeKey"
          @click="emit('select', tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>

      <p v-if="summaryTexts?.length" class="ai-blueprint-workbench-tabs__summary">
        <template v-for="(text, index) in summaryTexts" :key="text">
          <span>{{ text }}</span><span v-if="index < summaryTexts.length - 1" style="margin: 0 8px; color: #E5E6EB;">|</span>
        </template>
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'

defineProps({
  tabs: {
    type: Array as PropType<Array<{ key: string, label: string }>>,
    default: () => [],
  },
  activeKey: {
    type: String,
    required: true,
  },
  summaryTexts: {
    type: Array as PropType<string[]>,
    default: () => [],
  },
})

const emit = defineEmits(['select'])
</script>

<style scoped lang="scss">
.ai-blueprint-workbench-tabs {
  display: flex;
  flex-direction: column;
}

.ai-blueprint-workbench-tabs__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 32px;
}

.ai-blueprint-workbench-tabs__bar {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}

.ai-blueprint-workbench-tabs__button {
  min-width: 0;
  padding: 8px 2px 10px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: transparent;
  color: var(--blueprint-text-tertiary);
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.18s ease, color 0.18s ease;
}

.ai-blueprint-workbench-tabs__button.is-active {
  border-color: var(--blueprint-brand);
  background: transparent;
  color: var(--blueprint-brand);
  box-shadow: none;
}

.ai-blueprint-workbench-tabs__summary {
  flex-shrink: 0;
  margin: 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-secondary);
  white-space: nowrap;
}

@media (max-width: 1500px) {
  .ai-blueprint-workbench-tabs__top {
    flex-direction: column;
    align-items: stretch;
  }

  .ai-blueprint-workbench-tabs__summary {
    white-space: normal;
  }
}
</style>
