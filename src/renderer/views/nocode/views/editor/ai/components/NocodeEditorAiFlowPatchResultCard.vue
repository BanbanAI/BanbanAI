<template>
  <section
    class="flow-patch-result-card"
    :aria-busy="loading"
  >
    <header class="flow-patch-result-card__header">
      <div class="flow-patch-result-card__title">{{ presentation.title }}</div>
      <el-button
        class="flow-patch-result-card__view"
        type="primary"
        link
        :loading="loading"
        :disabled="disabled || loading"
        :aria-label="`查看流程草稿 V${block.draftVersion} 的修改`"
        @click="handleView"
      >
        <span>查看修改</span>
      </el-button>
    </header>

    <div class="flow-patch-result-card__summary">
      <div class="flow-patch-result-card__groups">
        <section
          v-for="group in presentation.groups"
          :key="group.key"
          class="flow-patch-result-card__group"
        >
          <div class="flow-patch-result-card__group-title">{{ group.label }}</div>
          <ul class="flow-patch-result-card__operations">
            <li
              v-for="(operation, index) in group.items"
              :key="`${group.key}-${operation.nodeKey || operation.tempKey || index}`"
              class="flow-patch-result-card__operation"
            >
              {{ operation.nodeName }}
            </li>
          </ul>
        </section>
      </div>
    </div>

    <div
      v-if="warnings.length"
      class="flow-patch-result-card__warnings"
      role="status"
    >
      <el-icon :size="16" aria-hidden="true"><i-ep-warning /></el-icon>
      <div>
        <div class="flow-patch-result-card__warnings-title">注意事项</div>
        <ul class="flow-patch-result-card__warnings-list">
          <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
        </ul>
      </div>
    </div>

  </section>
</template>

<script setup lang="ts">
import type { AiAssistantFlowPatchResultBlock } from '@common/types/ai'
import { computed } from 'vue'
import { buildFlowPatchResultPresentation } from '../flowPatchResultPresentation'

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  block: AiAssistantFlowPatchResultBlock
  loading?: boolean
  disabled?: boolean
}>(), {
  loading: false,
  disabled: false,
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'view', target: { formId: string; formName?: string; draftVersion: number }): void
}>()

const presentation = computed(() => buildFlowPatchResultPresentation(props.block))
const warnings = computed(() => (
  Array.isArray(props.block.warnings)
    ? props.block.warnings.map(item => String(item || '').trim()).filter(Boolean)
    : []
))

const handleView = () => {
  if (props.disabled || props.loading) {
    return
  }
  emit('view', {
    ...presentation.value.viewTarget,
    formName: props.block.formName,
  })
}
</script>

<style scoped lang="scss">
.flow-patch-result-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px 18px;
  border: 1px solid #dce8f6;
  border-radius: 18px;
  background: #ffffff;
  box-shadow: 0 6px 14px rgba(36, 77, 134, 0.05);
  color: #1d2129;
}

.flow-patch-result-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.flow-patch-result-card__title {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #173150;
}

.flow-patch-result-card__summary {
  padding: 16px 14px;
  border-radius: 12px;
  background: #f5f7fa;
}

.flow-patch-result-card__groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flow-patch-result-card__group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.flow-patch-result-card__group-title {
  color: #86909c;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}

.flow-patch-result-card__operations,
.flow-patch-result-card__warnings-list {
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.flow-patch-result-card__operation {
  overflow-wrap: anywhere;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  color: #1d2129;
}

.flow-patch-result-card__operation + .flow-patch-result-card__operation {
  margin-top: 4px;
}

.flow-patch-result-card__warnings {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff7e8;
  color: #b67310;
  font-size: 12px;
  line-height: 18px;
}

.flow-patch-result-card__warnings-title {
  font-weight: 600;
}

.flow-patch-result-card__view {
  flex-shrink: 0;
  padding: 0;
  min-height: auto;
  font-size: 12px;
  line-height: 20px;
  font-weight: 500;
}

@media (max-width: 480px) {
  .flow-patch-result-card {
    padding: 16px;
  }

  .flow-patch-result-card__header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
