<template>
  <aside class="ai-blueprint-workbench-rail">
    <div class="ai-blueprint-workbench-rail__list">
      <button
        v-for="group in groups"
        :key="group.key"
        type="button"
        class="ai-blueprint-workbench-rail__item"
        :class="{ 'is-active': group.key === activeGroupKey }"
        @click="emit('select-group', group.key)"
      >
        <div class="ai-blueprint-workbench-rail__item-head">
          <div class="ai-blueprint-workbench-rail__item-main">
            <span class="ai-blueprint-workbench-rail__item-icon">
              <el-icon :size="20"><i-ep-folder-remove /></el-icon>
            </span>
            <div class="ai-blueprint-workbench-rail__item-title">{{ group.name }}</div>
          </div>

          <span
            class="ai-blueprint-workbench-rail__item-status"
            :class="`is-${group.statusTone}`"
          >
            {{ group.statusLabel }}
          </span>
        </div>

        <div
          v-if="group.metaLines?.length"
          class="ai-blueprint-workbench-rail__item-meta"
        >
        <template v-for="(metaLine, index) in group.metaLines" :key="metaLine">
          <span :title="metaLine">{{ metaLine }}</span><span class="meta-line" style="color: #E5E6EB; margin: 0 8px;" v-if="index < group.metaLines.length - 1">|</span>
        </template>
        </div>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { type PropType } from 'vue'
import type { BlueprintWorkbenchGroup } from '../blueprintWorkbenchViewModel'

defineProps({
  groups: {
    type: Array as PropType<BlueprintWorkbenchGroup[]>,
    default: () => [],
  },
  activeGroupKey: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['select-group'])
</script>

<style scoped lang="scss">
.ai-blueprint-workbench-rail {
  width: 100%;
  min-height: 0;
  overflow: auto;
}

.ai-blueprint-workbench-rail__list {
  display: grid;
  gap: 8px;
  align-content: start;
}

.ai-blueprint-workbench-rail__item {
  width: 100%;
  appearance: none;
  min-height: 82px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 16px;
  padding: 12px;
  border: 1px solid var(--blueprint-border);
  border-radius: 4px;
  background: var(--blueprint-surface);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease;
}

.ai-blueprint-workbench-rail__item:hover {
  border-color: #c8daef;
  background: #fbfdff;
}

.ai-blueprint-workbench-rail__item.is-active {
  border-color: var(--blueprint-border-strong);
  background: rgba(232, 246, 255, 0.6);
}

.ai-blueprint-workbench-rail__item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-blueprint-workbench-rail__item-main {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-blueprint-workbench-rail__item-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #67c23a;
}

.ai-blueprint-workbench-rail__item-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 22px;
  font-weight: 400;
  color: var(--blueprint-text-primary);
}

.ai-blueprint-workbench-rail__item-status {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 20px;
  font-weight: 400;
  color: var(--blueprint-brand);
  white-space: nowrap;
}

.ai-blueprint-workbench-rail__item-status.is-applied {
  color: var(--blueprint-success);
}

.ai-blueprint-workbench-rail__item-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 20px;
  color: var(--blueprint-text-tertiary);
}

@media (max-width: 1100px) {
  .ai-blueprint-workbench-rail {
    width: 100%;
    overflow: visible;
  }
}
</style>
