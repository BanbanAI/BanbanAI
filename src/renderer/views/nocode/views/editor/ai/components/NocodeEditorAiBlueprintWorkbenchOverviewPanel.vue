<template>
  <section class="ai-blueprint-workbench-overview-panel">
    <el-scrollbar style="width: 100%;">
      <div
        :class="[
          'ai-blueprint-workbench-overview-panel__layout',
          { 'is-single-card': secondaryCards.length === 0 },
        ]"
      >
        <div
          v-if="primaryCard"
          class="ai-blueprint-workbench-overview-panel__primary-shell"
        >
          <el-scrollbar
            class="ai-blueprint-workbench-overview-panel__primary-scroll"
            height="100%"
          >
            <nocode-editor-ai-blueprint-workbench-card
              class="ai-blueprint-workbench-overview-panel__primary-card"
              :card="primaryCard"
              :selected="false"
              :applying-id="applyingId"
              :allow-apply-action="allowApplyAction"
              :allow-open-action="allowOpenAction"
              @select="emit('select', $event)"
              @apply="emit('apply', $event)"
              @open="emit('open', $event)"
            />
          </el-scrollbar>
        </div>
  
        <div
          v-if="secondaryCards.length"
          class="ai-blueprint-workbench-overview-panel__secondary-shell"
        >
          <el-scrollbar
            class="ai-blueprint-workbench-overview-panel__secondary-scroll"
            height="100%"
          >
            <nocode-editor-ai-blueprint-workbench-card
              v-for="card in secondaryCards"
              :key="card.key"
              class="ai-blueprint-workbench-overview-panel__secondary-card"
              :card="card"
              :compact="true"
              :selected="false"
              :applying-id="applyingId"
              :allow-apply-action="allowApplyAction"
              :allow-open-action="allowOpenAction"
              @select="emit('select', $event)"
              @apply="emit('apply', $event)"
              @open="emit('open', $event)"
            />
          </el-scrollbar>
        </div>
      </div>
    </el-scrollbar>
  </section>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue'
import type { BlueprintWorkbenchCard } from '../blueprintWorkbenchViewModel'
import NocodeEditorAiBlueprintWorkbenchCard from './NocodeEditorAiBlueprintWorkbenchCard.vue'

const props = defineProps({
  cards: {
    type: Array as PropType<BlueprintWorkbenchCard[]>,
    default: () => [],
  },
  selectedCardKey: {
    type: String,
    default: '',
  },
  applyingId: {
    type: String,
    default: '',
  },
  allowApplyAction: {
    type: Boolean,
    default: true,
  },
  allowOpenAction: {
    type: Boolean,
    default: true,
  },
})

const emit = defineEmits(['select', 'apply', 'open'])

const primaryCard = computed(() => props.cards[0] || null)
const secondaryCards = computed(() => props.cards.slice(1))
</script>

<style scoped lang="scss">
.ai-blueprint-workbench-overview-panel {
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  display: flex;
}

.ai-blueprint-workbench-overview-panel__layout {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 428px;
  gap: 12px;
}

.ai-blueprint-workbench-overview-panel__layout.is-single-card {
  grid-template-columns: minmax(0, 1fr);
}

.ai-blueprint-workbench-overview-panel__primary-shell,
.ai-blueprint-workbench-overview-panel__secondary-shell {
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
  height: max-content;
}

.ai-blueprint-workbench-overview-panel__primary-scroll,
.ai-blueprint-workbench-overview-panel__secondary-scroll {
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.ai-blueprint-workbench-overview-panel__primary-scroll :deep(.el-scrollbar__wrap),
.ai-blueprint-workbench-overview-panel__secondary-scroll :deep(.el-scrollbar__wrap) {
  height: 100%;
  overflow-x: hidden;
}

.ai-blueprint-workbench-overview-panel__primary-scroll :deep(.el-scrollbar__view),
.ai-blueprint-workbench-overview-panel__secondary-scroll :deep(.el-scrollbar__view) {
  min-height: 100%;
  min-width: 0;
}

.ai-blueprint-workbench-overview-panel__primary-scroll :deep(.el-scrollbar__view) {
  display: flex;
  flex-direction: column;
}

.ai-blueprint-workbench-overview-panel__secondary-scroll :deep(.el-scrollbar__view) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-blueprint-workbench-overview-panel__primary-scroll :deep(.el-scrollbar__bar.is-horizontal),
.ai-blueprint-workbench-overview-panel__secondary-scroll :deep(.el-scrollbar__bar.is-horizontal) {
  display: none;
}

.ai-blueprint-workbench-overview-panel__primary-card {
  flex: 1;
  min-height: 100%;
}

.ai-blueprint-workbench-overview-panel__secondary-scroll {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-blueprint-workbench-overview-panel__secondary-card {
  flex-shrink: 0;
}

@media (max-width: 1500px) {
  .ai-blueprint-workbench-overview-panel__layout {
    grid-template-columns: 1fr;
  }
}
</style>
