<template>
  <header class="ai-blueprint-workbench-header">
    <div class="ai-blueprint-workbench-header__top">
      <div class="ai-blueprint-workbench-header__copy">
        <div class="ai-blueprint-workbench-header__title">{{ title }}</div>
      </div>

      <div v-if="visibleActions.length" class="ai-blueprint-workbench-header__actions">
        <el-button
          v-for="action in visibleActions"
          :key="action.key"
          :type="resolveButtonType(action.tone)"
          :plain="action.tone !== 'primary'"
          size="small"
          :loading="action.loading"
          :disabled="action.disabled"
          @click="emit('action', action.key)"
        >
          {{ action.label }}
        </el-button>
      </div>
    </div>

    <div v-if="description" class="ai-blueprint-workbench-header__description">
      {{ description }}
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import type {
  BlueprintWorkbenchHeaderAction,
} from '../blueprintWorkbenchViewModel'

const emit = defineEmits(['action'])

const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  actions: {
    type: Array as PropType<BlueprintWorkbenchHeaderAction[]>,
    default: () => [],
  },
})

const HIDDEN_ACTION_KEYS = new Set<BlueprintWorkbenchHeaderAction['key']>([
  'open-history',
  'switch-to-review',
])

const visibleActions = computed(() => props.actions.filter(action => !HIDDEN_ACTION_KEYS.has(action.key)))

const resolveButtonType = (tone: BlueprintWorkbenchHeaderAction['tone']) => {
  if (tone === 'primary') {
    return 'primary'
  }

  if (tone === 'secondary') {
    return 'info'
  }

  return 'default'
}
</script>

<style scoped lang="scss">
.ai-blueprint-workbench-header {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--blueprint-border);
  border-radius: 8px;
  background: var(--blueprint-surface);
  box-shadow: var(--blueprint-shadow);
}

.ai-blueprint-workbench-header__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.ai-blueprint-workbench-header__copy {
  min-width: 0;
  flex: 1;
}

.ai-blueprint-workbench-header__title {
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-workbench-header__description {
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-header__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 8px;
}

.ai-blueprint-workbench-header__actions :deep(.el-button) {
  min-height: 32px;
  padding: 0 14px;
  border-radius: 4px;
  font-size: 14px;
  line-height: 22px;
  border-color: var(--blueprint-border);
  color: var(--blueprint-text-secondary);
}

.ai-blueprint-workbench-header__actions :deep(.el-button--primary) {
  border-color: var(--blueprint-brand);
  background: var(--blueprint-brand);
  color: #fff;
}

.ai-blueprint-workbench-header__actions :deep(.el-button--info.is-plain),
.ai-blueprint-workbench-header__actions :deep(.el-button.is-plain) {
  background: #fff;
  border-color: #bfd7ff;
  color: var(--blueprint-brand);
}

@media (max-width: 960px) {
  .ai-blueprint-workbench-header {
    padding: 18px;
  }

  .ai-blueprint-workbench-header__top {
    flex-direction: column;
  }

  .ai-blueprint-workbench-header__title {
    font-size: 20px;
    line-height: 28px;
  }

  .ai-blueprint-workbench-header__actions {
    justify-content: flex-start;
  }
}
</style>
