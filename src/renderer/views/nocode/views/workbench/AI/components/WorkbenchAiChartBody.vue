<template>
  <div class="ai-chart-body">
    <div v-if="isChartViewActive" ref="chartScrollRef" class="ai-chart-body__scroll">
      <div
        class="ai-chart-body__scroll-content"
        :style="{
          width: resolvedCanvasWidth ? `${resolvedCanvasWidth}px` : '100%',
          minWidth: resolvedCanvasWidth ? `${resolvedCanvasWidth}px` : undefined,
        }"
      >
        <div
          v-for="caption in topAxisCaptions"
          :key="`${caption.axis}-${caption.placement}-${caption.text}`"
          class="ai-chart-body__axis-caption"
          :class="[`is-${caption.placement}`, `is-${caption.axis}`]"
        >
          {{ caption.text }}
        </div>
        <div class="ai-chart-body__canvas-wrap">
          <div
            v-for="caption in overlayAxisCaptions"
            :key="`overlay-${caption.axis}-${caption.placement}-${caption.text}`"
            class="ai-chart-body__axis-caption-overlay"
            :class="[`is-${caption.placement}`, `is-${caption.axis}`]"
          >
            {{ caption.text }}
          </div>
          <div
            ref="chartContainerRef"
            class="ai-chart-body__canvas"
            :style="{
              height: `${resolvedHeight}px`,
            }"
          ></div>
        </div>
      </div>
    </div>
    <WorkbenchAiTableBody
      v-else-if="resolvedTableBlock"
      ref="tableBodyRef"
      :block="resolvedTableBlock"
      :initial-view-key="tableViewKey"
      @update:view-key="$emit('update:tableViewKey', $event)"
    />
    <div v-if="isChartViewActive && chartError && fallbackText" class="ai-chart-body__fallback">{{ fallbackText }}</div>
  </div>
</template>

<script setup lang="ts">
import type { AiAssistantChartBlock, AiAssistantPrimaryViewKey, AiAssistantTableBlock } from '@common/types/ai'
import * as echarts from 'echarts'
import i18next from 'i18next'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import WorkbenchAiTableBody from './WorkbenchAiTableBody.vue'
import { resolveChartHorizontalRestoreOffset } from './workbenchAiChartScrollState'

const chartScrollMemory = new Map<string, number>()
const EXTERNAL_TOP_AXIS_GRID_OFFSET = 56
const EXTERNAL_TOP_AXIS_GRID_MIN = 32
const EXTERNAL_LEFT_AXIS_GRID_OFFSET = 16
const EXTERNAL_LEFT_AXIS_GRID_MIN = 24

type TableExpandPayload = {
  title: string
  tableHtml: string
  tableText: string
  tableViewKey: string
}

type TableBodyExpose = {
  buildExpandPayload: () => TableExpandPayload
}

type AxisCaptionMeta = {
  text: string
  placement: 'start' | 'end'
  axis: 'top-x' | 'left-y' | 'bottom-x'
}

const props = defineProps<{
  block: AiAssistantChartBlock
  activePrimaryViewKey: AiAssistantPrimaryViewKey
  tableViewKey?: string
}>()

defineEmits<{
  (event: 'update:tableViewKey', value: string): void
}>()

const chartContainerRef = ref<HTMLDivElement | null>(null)
const chartScrollRef = ref<HTMLDivElement | null>(null)
const tableBodyRef = ref<TableBodyExpose | null>(null)
const chartInstanceRef = ref<any>(null)
const resizeObserverRef = ref<ResizeObserver | null>(null)
const scrollViewportWidth = ref(0)
const appliedChartSignatureRef = ref('')
const lastRenderedChartScrollTargetRef = ref<HTMLDivElement | null>(null)
const chartError = ref('')
let boundChartScrollTarget: HTMLDivElement | null = null
let pendingActivationSyncFrame: number | null = null
let pendingRenderRetryFrame: number | null = null

const estimateLabelVisualWidth = (label: string) => Array.from(String(label || '')).reduce((sum, char) => {
  if (/[\u4e00-\u9fff]/.test(char)) {
    return sum + 12
  }
  if (/\s/.test(char)) {
    return sum + 4
  }
  if (/[A-Z0-9]/.test(char)) {
    return sum + 7
  }
  if (/[a-z]/.test(char)) {
    return sum + 6
  }
  return sum + 6
}, 0)

const resolveLabelVisualWidth = (label: string) => String(label || '')
  .split('\n')
  .map(segment => estimateLabelVisualWidth(segment.trim()))
  .reduce((max, current) => Math.max(max, current), 0)

const resolvedHeight = computed(() => Math.max(220, Number(props.block.height || 320)))
const cloneChartOption = (option: Record<string, any>) => JSON.parse(JSON.stringify(option || {}))

const resolvePrimaryXAxis = (option: Record<string, any>) => (
  Array.isArray(option?.xAxis) ? option.xAxis[0] : option?.xAxis
)

const resolvePrimaryYAxis = (option: Record<string, any>) => (
  Array.isArray(option?.yAxis) ? option.yAxis[0] : option?.yAxis
)

const resolvePrimarySeries = (option: Record<string, any>) => (
  Array.isArray(option?.series) ? option.series[0] : option?.series
)

const resolvePrimaryCategoryAxis = (option: Record<string, any>) => {
  const axes = [
    resolvePrimaryXAxis(option),
    resolvePrimaryYAxis(option),
  ]
  return axes.find(axis => String(axis?.type || '').trim() === 'category') || null
}

const isHorizontalBarChart = (option: Record<string, any>) => {
  const series = resolvePrimarySeries(option)
  const xAxis = resolvePrimaryXAxis(option)
  const yAxis = resolvePrimaryYAxis(option)
  return (
    String(series?.type || '').trim() === 'bar'
    && String(xAxis?.type || '').trim() === 'value'
    && String(yAxis?.type || '').trim() === 'category'
  )
}

const isVerticalBarChart = (option: Record<string, any>) => {
  const series = resolvePrimarySeries(option)
  const xAxis = resolvePrimaryXAxis(option)
  const yAxis = resolvePrimaryYAxis(option)
  return (
    String(series?.type || '').trim() === 'bar'
    && String(xAxis?.type || '').trim() === 'category'
    && String(yAxis?.type || '').trim() === 'value'
  )
}

const axisCaptionItems = computed<AxisCaptionMeta[]>(() => {
  const option = props.block.option as Record<string, any>
  const xAxis = resolvePrimaryXAxis(option)
  const yAxis = resolvePrimaryYAxis(option)
  const topAxisName = String(xAxis?.name || '').trim()
  const leftAxisName = String(yAxis?.name || '').trim()
  const captions: AxisCaptionMeta[] = []

  if (isHorizontalBarChart(option) && String(xAxis?.position || '').trim() === 'top' && topAxisName) {
    captions.push({
      text: topAxisName,
      placement: 'end',
      axis: 'top-x',
    })
  }

  if (isVerticalBarChart(option) && leftAxisName) {
    captions.push({
      text: leftAxisName,
      placement: 'start',
      axis: 'left-y',
    })
  }

  if (!isHorizontalBarChart(option) && String(xAxis?.type || '').trim() === 'category' && topAxisName) {
    captions.push({
      text: topAxisName,
      placement: 'end',
      axis: 'bottom-x',
    })
  }

  return captions
})

const axisCaptionMeta = computed<AxisCaptionMeta | null>(() => axisCaptionItems.value[0] || null)
const topAxisCaptions = computed(() => axisCaptionItems.value.filter(item => item.axis !== 'bottom-x'))
const overlayAxisCaptions = computed(() => axisCaptionItems.value.filter(item => item.axis === 'bottom-x'))
const hasAxisCaption = (axis: AxisCaptionMeta['axis']) => axisCaptionItems.value.some(item => item.axis === axis)

const resolvedTableBlock = computed<AiAssistantTableBlock | null>(() => {
  if (!props.block.dataTable) {
    return null
  }

  return {
    type: 'table',
    title: props.block.dataTable.title || props.block.title,
    columns: props.block.dataTable.columns,
    rows: props.block.dataTable.rows,
    merge: props.block.dataTable.merge,
    analysisConclusion: props.block.analysisConclusion,
    presentation: props.block.presentation,
    views: {
      defaultKey: props.block.dataTable.key,
      items: [props.block.dataTable],
    },
  }
})

const isChartViewActive = computed(() => (
  props.activePrimaryViewKey === 'chart' || !resolvedTableBlock.value
))

const compactExternalTopAxisGrid = (option: Record<string, any>) => {
  const grid = option.grid
  if (!grid || Array.isArray(grid) || typeof grid !== 'object') {
    return
  }

  const gridTop = Number(grid.top)
  if (!Number.isFinite(gridTop)) {
    return
  }

  option.grid.top = Math.max(EXTERNAL_TOP_AXIS_GRID_MIN, gridTop - EXTERNAL_TOP_AXIS_GRID_OFFSET)
}

const compactExternalLeftAxisGrid = (option: Record<string, any>) => {
  const grid = option.grid
  if (!grid || Array.isArray(grid) || typeof grid !== 'object') {
    return
  }

  const gridTop = Number(grid.top)
  if (!Number.isFinite(gridTop)) {
    return
  }

  option.grid.top = Math.max(EXTERNAL_LEFT_AXIS_GRID_MIN, gridTop - EXTERNAL_LEFT_AXIS_GRID_OFFSET)
}

const resolveCategoricalChartWidth = (labels: string[]) => {
  const normalizedLabels = Array.isArray(labels)
    ? labels.map(label => String(label || '').trim()).filter(Boolean)
    : []
  if (!normalizedLabels.length) {
    return 0
  }

  const longestLabelWidth = normalizedLabels.reduce((max, label) => Math.max(max, resolveLabelVisualWidth(label)), 0)
  const perCategoryWidth = Math.min(160, Math.max(72, longestLabelWidth + 24))
  const widthFloor = normalizedLabels.length <= 2
    ? 560
    : normalizedLabels.length <= 6
      ? 640
      : 720

  return Math.min(1800, Math.max(widthFloor, normalizedLabels.length * perCategoryWidth + 96))
}

const updateScrollViewportWidth = () => {
  scrollViewportWidth.value = Math.max(0, chartScrollRef.value?.clientWidth || 0)
}

const resolvedCanvasWidth = computed(() => {
  let baseCanvasWidth = 0
  if (Number.isFinite(Number(props.block.minWidth)) && Number(props.block.minWidth) > 0) {
    baseCanvasWidth = Math.max(480, Math.round(Number(props.block.minWidth)))
    return Math.max(baseCanvasWidth, scrollViewportWidth.value)
  }

  const categoryAxis = resolvePrimaryCategoryAxis(props.block.option as Record<string, any>)
  const labels = Array.isArray(categoryAxis?.data)
    ? categoryAxis.data.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : []
  baseCanvasWidth = resolveCategoricalChartWidth(labels)
  if (baseCanvasWidth > 0) {
    return Math.max(baseCanvasWidth, scrollViewportWidth.value)
  }
  return scrollViewportWidth.value
})

const resolvedOption = computed(() => {
  const option = props.block.option && typeof props.block.option === 'object' && !Array.isArray(props.block.option)
    ? cloneChartOption(props.block.option as Record<string, any>)
    : {}
  const xAxis = resolvePrimaryXAxis(option as Record<string, any>)
  const yAxis = resolvePrimaryYAxis(option as Record<string, any>)
  if (hasAxisCaption('top-x') && xAxis && String(xAxis?.name || '').trim()) {
    compactExternalTopAxisGrid(option as Record<string, any>)
    delete xAxis.name
    delete xAxis.nameGap
    delete xAxis.nameLocation
    delete xAxis.nameTextStyle
  }
  if (hasAxisCaption('left-y') && yAxis && String(yAxis?.name || '').trim()) {
    compactExternalLeftAxisGrid(option as Record<string, any>)
    delete yAxis.name
    delete yAxis.nameGap
    delete yAxis.nameLocation
    delete yAxis.nameTextStyle
  }
  if (hasAxisCaption('bottom-x') && xAxis && String(xAxis?.name || '').trim()) {
    delete xAxis.name
    delete xAxis.nameGap
    delete xAxis.nameLocation
    delete xAxis.nameTextStyle
  }
  if (props.block.title && option.title) {
    delete option.title
  }
  return option
})

const fallbackText = computed(() => String(props.block.fallbackText || i18next.t('WorkbenchAiChartBlock.chartTemporarilyUnableToRender')).trim())
const chartContentSignature = computed(() => JSON.stringify({
  title: String(props.block.title || '').trim(),
  height: resolvedHeight.value,
  minWidth: resolvedCanvasWidth.value,
  axisCaptionMeta: axisCaptionMeta.value,
  axisCaptionItems: axisCaptionItems.value,
  option: resolvedOption.value,
}))

const disconnectResizeObserver = () => {
  resizeObserverRef.value?.disconnect()
  resizeObserverRef.value = null
}

const clearPendingActivationSync = () => {
  if (pendingActivationSyncFrame === null) {
    return
  }
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(pendingActivationSyncFrame)
  }
  pendingActivationSyncFrame = null
}

const clearPendingRenderRetry = () => {
  if (pendingRenderRetryFrame === null) {
    return
  }
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(pendingRenderRetryFrame)
  }
  pendingRenderRetryFrame = null
}

const disposeChart = () => {
  clearPendingActivationSync()
  clearPendingRenderRetry()
  disconnectResizeObserver()
  chartInstanceRef.value?.dispose?.()
  chartInstanceRef.value = null
}

const resetHorizontalScroll = () => {
  if (!chartScrollRef.value) {
    return
  }
  chartScrollRef.value.scrollLeft = 0
}

const scrollToHorizontalOffset = (offset: number) => {
  if (!chartScrollRef.value) {
    return
  }
  chartScrollRef.value.scrollLeft = Math.max(0, Number(offset || 0))
}

const rememberHorizontalScroll = (signature = chartContentSignature.value) => {
  if (!signature || !chartScrollRef.value) {
    return
  }
  chartScrollMemory.set(signature, Math.max(0, chartScrollRef.value.scrollLeft || 0))
}

const handleHorizontalScroll = () => {
  rememberHorizontalScroll()
}

const bindHorizontalScroll = () => {
  if (boundChartScrollTarget === chartScrollRef.value) {
    return
  }
  if (boundChartScrollTarget) {
    boundChartScrollTarget.removeEventListener('scroll', handleHorizontalScroll)
    boundChartScrollTarget = null
  }
  if (!chartScrollRef.value) {
    return
  }
  chartScrollRef.value.addEventListener('scroll', handleHorizontalScroll, { passive: true })
  boundChartScrollTarget = chartScrollRef.value
}

const unbindHorizontalScroll = () => {
  if (!boundChartScrollTarget) {
    return
  }
  boundChartScrollTarget.removeEventListener('scroll', handleHorizontalScroll)
  boundChartScrollTarget = null
}

const resizeChart = () => {
  chartInstanceRef.value?.resize?.({
    width: chartContainerRef.value?.clientWidth,
    height: resolvedHeight.value,
  })
}

const scheduleChartResize = () => {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    resizeChart()
    return
  }

  window.requestAnimationFrame(() => {
    resizeChart()
  })
}

const scheduleChartActivationSync = () => {
  clearPendingActivationSync()

  const runSync = () => {
    pendingActivationSyncFrame = null
    if (!isChartViewActive.value) {
      return
    }
    syncChart()
    scheduleChartResize()
  }

  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    void nextTick(runSync)
    return
  }

  pendingActivationSyncFrame = window.requestAnimationFrame(() => {
    pendingActivationSyncFrame = window.requestAnimationFrame(() => {
      runSync()
    })
  })
}

const scheduleChartRenderRetry = () => {
  if (pendingRenderRetryFrame !== null) {
    return
  }
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    pendingRenderRetryFrame = null
    void nextTick(() => {
      pendingRenderRetryFrame = null
      syncChart()
    })
    return
  }

  pendingRenderRetryFrame = window.requestAnimationFrame(() => {
    pendingRenderRetryFrame = null
    if (!isChartViewActive.value) {
      return
    }
    syncChart()
  })
}

const renderChart = () => {
  const chartContainer = chartContainerRef.value

  if (!chartContainer || !echarts?.init) {
    chartError.value = 'ECharts unavailable'
    disposeChart()
    return
  }

  const containerWidth = chartContainer.clientWidth
  const containerHeight = chartContainer.clientHeight
  if (containerWidth <= 0 || containerHeight <= 0) {
    clearPendingRenderRetry()
    scheduleChartRenderRetry()
    return
  }

  try {
    clearPendingRenderRetry()
    chartError.value = ''
    chartInstanceRef.value = echarts.getInstanceByDom?.(chartContainer) || chartInstanceRef.value || echarts.init(chartContainer)
    chartInstanceRef.value.setOption(cloneChartOption(resolvedOption.value), true)
    resizeChart()
    scheduleChartResize()
  } catch (error) {
    chartError.value = error instanceof Error ? error.message : String(error)
    disposeChart()
  }
}

const observeContainerResize = () => {
  disconnectResizeObserver()
  if (typeof ResizeObserver === 'undefined' || !chartContainerRef.value) {
    return
  }

  resizeObserverRef.value = new ResizeObserver(() => {
    updateScrollViewportWidth()
    scheduleChartResize()
  })
  resizeObserverRef.value.observe(chartContainerRef.value)
  if (chartScrollRef.value && chartScrollRef.value !== chartContainerRef.value) {
    resizeObserverRef.value.observe(chartScrollRef.value)
  }
}

const syncChart = () => {
  const nextSignature = chartContentSignature.value
  const chartScrollTarget = chartScrollRef.value
  const previousScrollLeft = chartScrollTarget?.scrollLeft ?? 0
  const rememberedScrollLeft = chartScrollMemory.get(nextSignature)
  const shouldResetHorizontalScroll = !appliedChartSignatureRef.value || appliedChartSignatureRef.value !== nextSignature
  const didScrollContainerRemount = !!chartScrollTarget && chartScrollTarget !== lastRenderedChartScrollTargetRef.value
  renderChart()
  observeContainerResize()
  appliedChartSignatureRef.value = nextSignature
  void nextTick(() => {
    if (appliedChartSignatureRef.value !== nextSignature) {
      return
    }
    const restoreScrollLeft = resolveChartHorizontalRestoreOffset({
      previousScrollLeft,
      rememberedScrollLeft,
      shouldResetHorizontalScroll,
      didScrollContainerRemount,
    })
    if (restoreScrollLeft === 0 && shouldResetHorizontalScroll && rememberedScrollLeft === undefined) {
      resetHorizontalScroll()
    } else {
      scrollToHorizontalOffset(restoreScrollLeft)
    }
    rememberHorizontalScroll(nextSignature)
    lastRenderedChartScrollTargetRef.value = chartScrollTarget
    scheduleChartResize()
  })
}

const buildActiveTableExpandPayload = () => {
  if (!resolvedTableBlock.value) {
    return null
  }
  const payload = tableBodyRef.value?.buildExpandPayload()
  if (!payload) {
    return null
  }
  return {
    block: resolvedTableBlock.value,
    ...payload,
  }
}

onMounted(() => {
  updateScrollViewportWidth()
  if (!isChartViewActive.value) {
    return
  }
  bindHorizontalScroll()
  scheduleChartActivationSync()
})

watch(() => chartContentSignature.value, () => {
  if (!isChartViewActive.value) {
    return
  }
  syncChart()
})

watch(isChartViewActive, (value) => {
  if (!value) {
    rememberHorizontalScroll()
    unbindHorizontalScroll()
    disposeChart()
    chartError.value = ''
    return
  }

  void nextTick(() => {
    updateScrollViewportWidth()
    bindHorizontalScroll()
    scheduleChartActivationSync()
  })
})

onBeforeUnmount(() => {
  rememberHorizontalScroll()
  unbindHorizontalScroll()
  disposeChart()
})

defineExpose({
  buildActiveTableExpandPayload,
})
</script>

<style scoped lang="scss">
@use '../styles/aiChatScrollbar.scss' as *;

.ai-chart-body {
  width: 100%;
  min-width: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.ai-chart-body__axis-caption {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  margin: 0 0 2px;
  color: #4e5969;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}

.ai-chart-body__axis-caption.is-start {
  justify-content: flex-start;
  padding-left: 2px;
}

.ai-chart-body__axis-caption.is-end {
  justify-content: flex-end;
  padding-right: 2px;
}

.ai-chart-body__axis-caption.is-top-x {
  margin-bottom: 0;
}

.ai-chart-body__scroll {
  width: 100%;
  padding: 0 0 4px;
  @include ai-chat-scrollbar(x);
}

.ai-chart-body__scroll-content {
  display: flex;
  flex-direction: column;
}

.ai-chart-body__canvas-wrap {
  position: relative;
  width: 100%;
  flex: 0 0 auto;
}

.ai-chart-body__canvas {
  width: 100%;
  min-height: 220px;
  flex: 0 0 auto;
}

.ai-chart-body__axis-caption-overlay {
  position: absolute;
  display: flex;
  align-items: center;
  pointer-events: none;
  color: #4e5969;
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
  z-index: 1;
}

.ai-chart-body__axis-caption-overlay.is-bottom-x {
  right: 8px;
  bottom: 4px;
  justify-content: flex-end;
}

.ai-chart-body__fallback {
  margin-top: 8px;
  color: #86909c;
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
}
</style>
