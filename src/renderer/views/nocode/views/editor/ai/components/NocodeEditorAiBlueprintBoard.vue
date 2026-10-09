<template>
  <div class="ai-blueprint-board" :class="{ compact }">
    <div
      v-for="group in groupedForms"
      :key="group.name"
      class="ai-blueprint-board__group"
      :class="{ 'is-collapsed': isGroupCollapsed(group.name) }"
    >
      <button
        type="button"
        class="ai-blueprint-board__group-header"
        :class="{ 'is-collapsible': collapseEnabled }"
        :aria-expanded="String(!isGroupCollapsed(group.name))"
        @click="toggleGroup(group.name)"
      >
        <div class="ai-blueprint-board__group-title-wrap">
          <span
            v-if="collapseEnabled"
            class="ai-blueprint-board__group-arrow"
            :class="{ 'is-collapsed': isGroupCollapsed(group.name) }"
          >
            <el-icon :size="14"><i-ep-arrow-down /></el-icon>
          </span>
          <div class="ai-blueprint-board__group-title">{{ group.name }}</div>
        </div>
        <div class="ai-blueprint-board__group-meta">{{ group.forms.length }}{{ $t('nocodeEditorAiBlueprintBoard.formCountSuffix') }}</div>
      </button>

      <div v-show="!isGroupCollapsed(group.name)" class="ai-blueprint-board__forms">
        <div
          v-for="form in group.forms"
          :key="form.formKey || form.tableName"
          class="ai-blueprint-board__form"
        >
          <div class="ai-blueprint-board__form-name">{{ form.tableName }}</div>
          <div v-if="form.description" class="ai-blueprint-board__form-description">{{ form.description }}</div>
          <div class="ai-blueprint-board__field-list">
            <template v-if="compact">
              <span
                v-for="field in form.fields.slice(0, 10)"
                :key="field.fieldKey || field.name"
                class="ai-blueprint-board__field-tag"
              >
                {{ field.name }}
              </span>
              <span v-if="form.fields.length > 10" class="ai-blueprint-board__field-tag is-muted">
                +{{ form.fields.length - 10 }}
              </span>
            </template>

            <template v-else>
              <div
                v-for="field in form.fields"
                :key="field.fieldKey || field.name"
                class="ai-blueprint-board__field-row"
              >
                <div class="ai-blueprint-board__field-name">
                  {{ field.name }}
                  <span
                    v-if="getFieldTypeLabel(field.widgetType)"
                    class="ai-blueprint-board__field-type"
                  >
                    {{ getFieldTypeLabel(field.widgetType) }}
                  </span>
                </div>
                <div v-if="field.description" class="ai-blueprint-board__field-description">{{ field.description }}</div>
                <div v-if="field.children?.length" class="ai-blueprint-board__children">{{ $t('nocodeEditorAiBlueprintBoard.childFieldsLabel') }}{{ field.children.map(item => item.name).join('、') }}
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type PropType } from 'vue'
import i18next from 'i18next'
import { resolveBlueprintWidgetTypeLabel } from '@common/utils/nocodeEditorBlueprintWidgetLabel'
import type { NocodeEditorAiAppBlueprint } from '../types'

const props = defineProps({
  blueprint: {
    type: Object as PropType<NocodeEditorAiAppBlueprint>,
    required: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  collapsible: {
    type: Boolean,
    default: true,
  },
})

const groupedForms = computed(() => {
  const groups = new Map<string, typeof props.blueprint.forms>()
  for (const form of props.blueprint.forms || []) {
    const groupName = String(form.groupName || i18next.t('nocodeEditorAiBlueprintBoard.ungrouped')).trim() || i18next.t('nocodeEditorAiBlueprintBoard.ungrouped')
    const items = groups.get(groupName) || []
    items.push(form)
    groups.set(groupName, items)
  }
  return Array.from(groups.entries()).map(([name, forms]) => ({
    name,
    forms,
  }))
})

const getFieldTypeLabel = (widgetType?: string) => {
  return resolveBlueprintWidgetTypeLabel(widgetType)
}

const collapsedGroupNames = ref<string[]>([])

const collapseEnabled = computed(() => props.collapsible && !props.compact)

const isGroupCollapsed = (groupName: string) => {
  if (!collapseEnabled.value) {
    return false
  }
  return collapsedGroupNames.value.includes(groupName)
}

const toggleGroup = (groupName: string) => {
  if (!collapseEnabled.value) {
    return
  }

  if (collapsedGroupNames.value.includes(groupName)) {
    collapsedGroupNames.value = collapsedGroupNames.value.filter(item => item !== groupName)
    return
  }

  collapsedGroupNames.value = [...collapsedGroupNames.value, groupName]
}

watch(groupedForms, (groups) => {
  const groupNameSet = new Set(groups.map(group => group.name))
  collapsedGroupNames.value = collapsedGroupNames.value.filter(name => groupNameSet.has(name))
}, {
  immediate: true,
})
</script>

<style scoped lang="scss">
.ai-blueprint-board {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ai-blueprint-board__group {
  border-radius: 18px;
  border: 1px solid #dbe7f3;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.92));
  padding: 14px;
}

.ai-blueprint-board__group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  margin-bottom: 10px;
  text-align: left;

  &.is-collapsible {
    cursor: pointer;
  }
}

.ai-blueprint-board__group-title-wrap {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ai-blueprint-board__group-arrow {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #eef5ff;
  color: #6380a5;
  transition: transform 0.18s ease, background-color 0.18s ease, color 0.18s ease;

  &.is-collapsed {
    transform: rotate(-90deg);
  }
}

.ai-blueprint-board__group-header.is-collapsible:hover {
  .ai-blueprint-board__group-arrow {
    background: #e1eefc;
    color: #3d618e;
  }
}

.ai-blueprint-board__group-title {
  font-size: 14px;
  font-weight: 700;
  color: #1f2d3d;
}

.ai-blueprint-board__group-meta {
  font-size: 12px;
  color: #6b7789;
}

.ai-blueprint-board__forms {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.ai-blueprint-board__group.is-collapsed {
  .ai-blueprint-board__group-header {
    margin-bottom: 0;
  }
}

.ai-blueprint-board__form {
  border-radius: 14px;
  border: 1px solid #e5edf5;
  background: #ffffff;
  padding: 12px;
}

.ai-blueprint-board__form-name {
  font-size: 13px;
  font-weight: 700;
  color: #203149;
}

.ai-blueprint-board__form-description {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: #66758c;
}

.ai-blueprint-board__field-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.ai-blueprint-board__field-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: #eef5ff;
  color: #24538a;
  font-size: 12px;
  line-height: 1;

  &.is-muted {
    background: #f4f6f8;
    color: #728197;
  }
}

.ai-blueprint-board__field-row {
  width: 100%;
  border-radius: 10px;
  background: #f7fbff;
  border: 1px solid #ebf2f8;
  padding: 8px 10px;
}

.ai-blueprint-board__field-name {
  font-size: 12px;
  font-weight: 700;
  color: #223047;
}

.ai-blueprint-board__field-type {
  margin-left: 6px;
  font-weight: 500;
  color: #6c7b91;
}

.ai-blueprint-board__field-description,
.ai-blueprint-board__children {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.6;
  color: #69778c;
}

.ai-blueprint-board.compact .ai-blueprint-board__forms {
  grid-template-columns: 1fr;
}
</style>
