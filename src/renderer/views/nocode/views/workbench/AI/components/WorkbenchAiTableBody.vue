<template>
  <div class="ai-table-body">
    <div v-if="availableViews.length > 1" class="ai-table-body__sub-switch">
      <el-radio-group v-model="activeViewKey" size="small">
        <el-radio-button
          v-for="view in availableViews"
          :key="view.key"
          :value="view.key"
        >
          {{ resolveViewLabel(view) }}
        </el-radio-button>
      </el-radio-group>
    </div>
    <div class="ai-table-body__scroll">
      <table ref="tableRef" class="ai-table-body__table">
        <thead>
          <tr>
            <th
              v-for="column in activeTableBlock.columns"
              :key="column.key"
              :class="resolveAlignClass(column)"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(renderRow, rowIndex) in renderRows" :key="rowIndex">
            <td
              v-for="cell in renderRow.cells"
              :key="cell.column.key"
              :rowspan="cell.rowspan"
              :class="cell.alignClass"
            >
              {{ cell.value }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AiAssistantTableBlock } from '@common/types/ai'
import i18next from 'i18next'
import { computed, ref, watch } from 'vue'
import {
  buildAiTableCellSpans,
  buildAiTableFallbackHtml,
  buildAiTableRenderRows,
  buildAiTableText,
  resolveAiTableAlignClass,
  resolveAiTableViewLabel,
} from './workbenchAiTableBlockModel'

type TableColumn = AiAssistantTableBlock['columns'][number]
type TableView = NonNullable<AiAssistantTableBlock['views']>['items'][number]

const props = defineProps<{
  block: AiAssistantTableBlock
  initialViewKey?: string
}>()

const emit = defineEmits<{
  (event: 'update:viewKey', value: string): void
}>()

const tableRef = ref<HTMLTableElement | null>(null)
const activeViewKey = ref(props.initialViewKey || props.block.views?.defaultKey || 'base')
const summaryTableViewLabel = computed(() => i18next.t('WorkbenchAiChat.summaryTableViewLabel'))
const detailTableViewLabel = computed(() => i18next.t('WorkbenchAiChat.detailTableViewLabel'))

const availableViews = computed(() => (
  props.block.views?.items?.length
    ? props.block.views.items
    : [{
        key: 'base',
        title: props.block.title,
        columns: props.block.columns,
        rows: props.block.rows,
        merge: props.block.merge,
      }]
))

const activeView = computed(() => (
  availableViews.value.find(item => item.key === activeViewKey.value) || availableViews.value[0]
))

const activeTableBlock = computed<AiAssistantTableBlock>(() => ({
  ...props.block,
  title: activeView.value.title || props.block.title,
  columns: activeView.value.columns,
  rows: activeView.value.rows,
  merge: activeView.value.merge,
}))

watch(() => props.initialViewKey, (value) => {
  if (!value) {
    return
  }
  activeViewKey.value = value
}, { immediate: true })

watch(() => props.block, (block) => {
  activeViewKey.value = props.initialViewKey || block.views?.defaultKey || 'base'
})

watch(availableViews, (views) => {
  if (views.some(item => item.key === activeViewKey.value)) {
    return
  }
  activeViewKey.value = props.initialViewKey || props.block.views?.defaultKey || views[0]?.key || 'base'
}, { immediate: true })

watch(activeViewKey, (value) => {
  emit('update:viewKey', value)
}, { immediate: true })

const cellSpans = computed(() => buildAiTableCellSpans(activeTableBlock.value))
const renderRows = computed(() => buildAiTableRenderRows(activeTableBlock.value, cellSpans.value))

const resolveAlignClass = (column: TableColumn) => resolveAiTableAlignClass(column)
const resolveViewLabel = (view: TableView) => resolveAiTableViewLabel(view, {
  summaryTableViewLabel: summaryTableViewLabel.value,
  detailTableViewLabel: detailTableViewLabel.value,
})

const buildExpandPayload = () => ({
  title: activeTableBlock.value.title || '',
  tableHtml: tableRef.value?.outerHTML || buildAiTableFallbackHtml(activeTableBlock.value, cellSpans.value),
  tableText: buildAiTableText(activeTableBlock.value),
  tableViewKey: activeViewKey.value,
})

defineExpose({
  buildExpandPayload,
})
</script>

<style scoped lang="scss">
@use '../styles/aiChatScrollbar.scss' as *;

.ai-table-body {
  width: 100%;
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.ai-table-body__sub-switch {
  margin-bottom: 12px;

  :deep(.el-radio-button__inner) {
    min-width: 72px;
    border-radius: 999px;
    font-size: 12px;
  }
}

.ai-table-body__scroll {
  width: 100%;
  padding: 0 8px 6px;
  @include ai-chat-scrollbar(x);
}

.ai-table-body__table {
  width: 100%;
  min-width: 520px;
  border-collapse: collapse;
  table-layout: auto;
}

.ai-table-body__table th,
.ai-table-body__table td {
  padding: 8px 10px;
  border: 1px solid #e5e6eb;
  color: #1d2129;
  font-size: 13px;
  line-height: 20px;
  vertical-align: top;
  white-space: normal;
  overflow-wrap: anywhere;
}

.ai-table-body__table th {
  background: #f7f8fa;
  color: #4e5969;
  font-weight: 600;
}

.ai-table-body__table .is-align-left {
  text-align: left;
}

.ai-table-body__table .is-align-center {
  text-align: center;
}

.ai-table-body__table .is-align-right {
  text-align: right;
}
</style>
