<template>
  <div class="nocode-editor-ai-continuity-notice" :class="{ 'is-compact': compact }">
    <div
      v-for="(hint, index) in hints"
      :key="`${hint.kind}-${index}`"
      class="nocode-editor-ai-continuity-notice__item"
      :class="`is-${hint.kind}`"
    >
      {{ hint.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NocodeEditorAiContinuityHint } from '../types'

// eslint-disable-next-line vue/valid-define-props
defineProps<{
  hints: NocodeEditorAiContinuityHint[]
  compact?: boolean
}>()
</script>

<style scoped>
.nocode-editor-ai-continuity-notice {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nocode-editor-ai-continuity-notice.is-compact {
  gap: 6px;
}

.nocode-editor-ai-continuity-notice__item {
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #666f83;
  background: #f4f6f9;
}

.nocode-editor-ai-continuity-notice__item.is-history-windowed {
  background: #eef2f6;
}

.nocode-editor-ai-continuity-notice__item.is-workbench-handoff {
  color: #5c4300;
  background: linear-gradient(180deg, #fff8e8 0%, #fffdf7 100%);
  border: 1px solid #f4dda1;
}
</style>
