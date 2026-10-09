<template>
  <div class="ai-flowchart" :class="{ compact }">
    <div v-if="renderError" class="ai-flowchart__state ai-flowchart__state--error">
      <div class="state-title">{{ $t('nocodeEditorAiFlowchart.appStructurePreviewRenderFailed') }}</div>
      <div class="state-text">{{ renderError }}</div>
    </div>

    <div v-else-if="scene" class="ai-flowchart__shell">
      <div class="ai-flowchart__toolbar">
        <div class="ai-flowchart__toolbar-meta">
          <span>{{ solutionPresentation.moduleCount }}{{ $t('nocodeEditorAiFlowchart.moduleCountSuffix') }}</span>
          <span>{{ solutionPresentation.formCount }}{{ $t('nocodeEditorAiFlowchart.formCountSuffix') }}</span>
          <span v-if="solutionPresentation.planningItemCount > 0">
            {{ solutionPresentation.planningItemCount }}{{ $t('nocodeEditorAiFlowchart.planningItemCountSuffix') }}</span>
          <span>{{ compact ? $t('nocodeEditorAiFlowchart.compactView') : $t('nocodeEditorAiFlowchart.detailView') }}</span>
        </div>

        <div class="ai-flowchart__toolbar-actions">
          <button
            type="button"
            class="toolbar-button"
            :disabled="displayScale <= MIN_SCALE + 0.001"
            @click="changeScale(-0.12)"
          >
            -
          </button>
          <button type="button" class="toolbar-button toolbar-button--ghost" @click="resetScale">{{ $t('nocodeEditorAiFlowchart.adapt') }}</button>
          <button
            type="button"
            class="toolbar-button"
            :disabled="displayScale >= MAX_SCALE - 0.001"
            @click="changeScale(0.12)"
          >
            +
          </button>
          <span class="toolbar-scale">{{ zoomText }}</span>
        </div>
      </div>

      <div v-if="scene.modules.length > 1" class="ai-flowchart__module-nav">
        <button
          v-for="module in scene.modules"
          :key="`${module.id}-nav`"
          type="button"
          class="module-nav-chip"
          :class="{ 'is-active': activeModuleId === module.id }"
          :style="getModuleChipStyle(module)"
          @click="focusModule(module.id)"
        >
          {{ module.name }}
        </button>
      </div>

      <div
        ref="viewportRef"
        class="ai-flowchart__viewport"
        :class="{
          'is-pannable': canPanViewport,
          'is-panning': isPanning,
        }"
        @wheel.prevent="handleViewportWheel"
        @mousedown="handleViewportDragStart"
      >
        <div class="ai-flowchart__canvas" :style="canvasStyle">
          <div class="ai-flowchart__scene" :style="sceneStyle">
            <svg
              class="ai-flowchart__edges"
              :width="scene.width"
              :height="scene.height"
              :viewBox="`0 0 ${scene.width} ${scene.height}`"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="ai-flowchart-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#70839a" />
                </marker>
                <marker
                  id="ai-flowchart-arrow-active"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" :fill="activeModuleColor" />
                </marker>
                <marker
                  id="ai-flowchart-arrow-muted"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#c4d1de" />
                </marker>
              </defs>

              <path
                v-for="edge in scene.edges"
                :key="edge.id"
                :d="edge.path"
                class="ai-flowchart__edge-path"
                :class="getEdgeClass(edge)"
                :style="getEdgePathStyle(edge)"
                :marker-end="getEdgeMarker(edge)"
              />
            </svg>

            <div
              v-for="module in scene.modules"
              :key="module.id"
              class="ai-flowchart__module"
              :class="getModuleClass(module)"
              :style="getModuleStyle(module)"
              @click="focusModule(module.id)"
            >
              <div class="module-accent" />
              <div class="module-header">
                <div class="module-title-row">
                  <div class="module-title">{{ module.name }}</div>
                  <div class="module-count">{{ formatModuleCount(module) }}</div>
                </div>
                <div v-if="module.description && !compact" class="module-description">
                  {{ module.description }}
                </div>
              </div>
            </div>

            <div
              v-for="edge in scene.edges"
              :key="`${edge.id}-label`"
              v-show="edge.label"
              class="ai-flowchart__edge-label"
              :class="getEdgeClass(edge)"
              :style="getEdgeLabelStyle(edge)"
            >
              {{ edge.label }}
            </div>

            <div
              v-for="node in scene.nodes"
              :key="node.id"
              class="ai-flowchart__node"
              :class="[
                getNodeClass(node),
                {
                  'is-primary': node.isPrimary,
                  'is-placeholder': node.isPlaceholder,
                },
              ]"
              :style="getNodeStyle(node)"
            >
              <div
                v-if="node.displayCategory === 'planning-item' || node.executionLevel !== 'executable_now'"
                class="node-badges"
              >
                <span
                  v-if="node.displayCategory === 'planning-item'"
                  class="node-badge"
                >
                  {{ node.artifactTypeLabel }}
                </span>
                <span
                  v-if="node.executionLevel !== 'executable_now'"
                  class="node-badge node-badge--muted"
                >
                  {{ node.executionLevelLabel }}
                </span>
              </div>
              <div class="node-title">{{ node.title }}</div>
              <div v-if="node.description" class="node-description">
                {{ node.description }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="ai-flowchart__state">
      <div class="state-title">{{ $t('nocodeEditorAiFlowchart.preparingAppStructurePreview') }}</div>
      <div class="state-text">{{ $t('nocodeEditorAiFlowchart.organizingAppStructureTip') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import i18next from 'i18next'
import {
  buildNocodeEditorAiSolutionPresentation,
  normalizeNocodeEditorAiPlanningArtifactName,
  resolveNocodeEditorAiArtifactTypeLabel,
  resolveNocodeEditorAiExecutionLevelLabel,
  type NocodeEditorAiPlanningArtifact,
} from '@renderer/views/nocode/components/ai/solutionArtifactPresentation'
import {
  resolveFlowEdgeSidesByDistance,
  resolveNextFlowchartActiveModuleId,
  type FlowchartRect,
} from '../flowchartRouting'
import type {
  NocodeEditorAiSolutionOutline,
  NocodeEditorAiSolutionOutlineFlow,
  NocodeEditorAiSolutionOutlineForm,
  NocodeEditorAiSolutionOutlineModule,
} from '../types'

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  outline: NocodeEditorAiSolutionOutline
  planningArtifacts?: NocodeEditorAiPlanningArtifact[]
  compact?: boolean
}>(), {
  planningArtifacts: () => [],
  compact: false,
})

type Point = {
  x: number
  y: number
}

type Rect = {
  x: number
  y: number
  width: number
  height: number
}

type ResolvedOutlineForm = NocodeEditorAiSolutionOutlineForm & {
  id: string
  moduleKey: string
  aliases: string[]
  isPlaceholder?: boolean
  width: number
  height: number
}

type ResolvedOutlineModule = {
  id: string
  key: string
  name: string
  color: string
  description?: string
  forms: ResolvedOutlineForm[]
  width: number
  height: number
}

type ModuleSceneItem = {
  id: string
  key: string
  name: string
  color: string
  description?: string
  forms: ResolvedOutlineForm[]
  formCount: number
  planningItemCount: number
  x: number
  y: number
  width: number
  height: number
}

type NodeSceneItem = {
  id: string
  moduleId: string
  moduleKey: string
  title: string
  description?: string
  displayCategory: 'form' | 'planning-item'
  artifactType: string
  artifactTypeLabel: string
  executionLevel: string
  executionLevelLabel: string
  color: string
  x: number
  y: number
  width: number
  height: number
  isPrimary: boolean
  isPlaceholder: boolean
}

type EdgeSceneItem = {
  id: string
  fromModuleKey: string
  toModuleKey: string
  label?: string
  points: Point[]
  path: string
  labelX?: number
  labelY?: number
  labelWidth?: number
  labelHeight?: number
}

type FlowchartScene = {
  width: number
  height: number
  modules: ModuleSceneItem[]
  nodes: NodeSceneItem[]
  edges: EdgeSceneItem[]
}

type PortSide = 'left' | 'right' | 'top' | 'bottom'
type PortRole = 'from' | 'to'

type ResolvedFlowEdge = {
  id: string
  label?: string
  fromId: string
  toId: string
  fromModuleKey: string
  toModuleKey: string
  fromSide: PortSide
  toSide: PortSide
  fromPortIndex: number
  fromPortCount: number
  toPortIndex: number
  toPortCount: number
  routeOffset: number
}

type ModuleRelation = {
  sourceKey: string
  targetKey: string
}

type PortUsageRecord = {
  fromCount: number
  toCount: number
}

type ResolvedFlowEdgesResult = {
  edges: ResolvedFlowEdge[]
  portUsageMap: Map<string, PortUsageRecord>
}

const MODULE_COLORS = ['#4a98ff', '#54c7a6', '#f59d38', '#48b8c9', '#ff8b6b', '#6d8cff']
const PLACEHOLDER_FORM: NocodeEditorAiSolutionOutlineForm = {
  get tableName() { return i18next.t('nocodeEditorAiFlowchart.placeholderForm') },
  get description() { return i18next.t('nocodeEditorAiFlowchart.placeholderFormDescription') },
}

const MIN_SCALE = 0.22
const MAX_SCALE = 1.6

const FORM_WIDTH = computed(() => (props.compact ? 168 : 212))
const MODULE_SIDE_PADDING = computed(() => (props.compact ? 16 : 20))
const MODULE_HEADER_HEIGHT = computed(() => (props.compact ? 74 : 94))
const MODULE_BOTTOM_PADDING = computed(() => (props.compact ? 16 : 20))
const MODULE_FORM_GAP = computed(() => (props.compact ? 12 : 14))
const SCENE_PADDING = computed(() => (props.compact ? 22 : 28))

const viewportRef = ref<HTMLDivElement | null>(null)
const { width: viewportWidth, height: viewportHeight } = useElementSize(viewportRef)
const canPanViewport = ref(false)
const isPanning = ref(false)

const scene = ref<FlowchartScene | null>(null)
const renderError = ref('')
const manualScale = ref<number | null>(null)
const activeModuleId = ref('')

const displayScale = computed(() => clamp(manualScale.value ?? fitScale.value, MIN_SCALE, MAX_SCALE))
const zoomText = computed(() => `${Math.round(displayScale.value * 100)}%`)
const activeModule = computed(() => scene.value?.modules.find(module => module.id === activeModuleId.value) || null)
const activeModuleKey = computed(() => activeModule.value?.key || '')
const activeModuleColor = computed(() => activeModule.value?.color || MODULE_COLORS[0])
const hasModuleSelection = computed(() => Boolean(activeModuleKey.value))

let renderSerial = 0
let stopViewportPanListeners: (() => void) | null = null
const viewportPanState = {
  startClientX: 0,
  startClientY: 0,
  startScrollLeft: 0,
  startScrollTop: 0,
}

const splitText = (value: string, maxLength: number) => {
  const text = String(value || '').trim()
  if (!text) {
    return ['']
  }

  const lines: string[] = []
  let current = ''
  let weight = 0

  for (const char of text) {
    const codePoint = char.codePointAt(0) || 0
    const charWeight = codePoint > 0xff ? 1 : 0.55
    if (current && weight + charWeight > maxLength) {
      lines.push(current)
      current = char
      weight = charWeight
      continue
    }
    current += char
    weight += charWeight
  }

  if (current) {
    lines.push(current)
  }

  return lines
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

const round = (value: number) => {
  return Math.round(value * 10) / 10
}

const formatModuleCount = (module: ModuleSceneItem) => {
  const parts: string[] = []
  if (module.formCount > 0) {
    parts.push(i18next.t('nocodeEditorAiFlowchart.formCount', { count: module.formCount }))
  }
  if (module.planningItemCount > 0) {
    parts.push(i18next.t('nocodeEditorAiFlowchart.planningItemCount', { count: module.planningItemCount }))
  }
  return parts.join(' · ') || i18next.t('nocodeEditorAiFlowchart.pendingRefinement')
}

const sanitizeEdgeLabel = (value?: string) => String(value || '')
  .replace(/\r?\n/g, ' / ')
  .replace(/\|/g, ' / ')
  .trim()

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '')
  const raw = normalized.length === 3
    ? normalized.split('').map(char => `${char}${char}`).join('')
    : normalized.padEnd(6, '0').slice(0, 6)

  const red = Number.parseInt(raw.slice(0, 2), 16)
  const green = Number.parseInt(raw.slice(2, 4), 16)
  const blue = Number.parseInt(raw.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const estimateFormHeight = (form: NocodeEditorAiSolutionOutlineForm) => {
  const titleLines = Math.min(splitText(form.tableName || i18next.t('nocodeEditorAiFlowchart.unnamedForm'), props.compact ? 12 : 14).length, 2)
  const description = String(form.description || '').trim()
  const descriptionLines = description
    ? Math.min(splitText(description, props.compact ? 16 : 20).length, props.compact ? 1 : 2)
    : 0

  const height = (props.compact ? 28 : 32)
    + titleLines * 20
    + (descriptionLines ? descriptionLines * 18 + 8 : 0)
    + (props.compact ? 14 : 18)

  return clamp(height, props.compact ? 76 : 90, props.compact ? 104 : 126)
}

const estimateModuleSize = (module: NocodeEditorAiSolutionOutlineModule, forms: ResolvedOutlineForm[]) => {
  const width = FORM_WIDTH.value + MODULE_SIDE_PADDING.value * 2
  const contentHeight = forms.reduce((total, form) => total + form.height, 0)
    + Math.max(0, forms.length - 1) * MODULE_FORM_GAP.value
  const descriptionHeight = !props.compact && module.description ? 18 : 0
  const height = MODULE_HEADER_HEIGHT.value + descriptionHeight + contentHeight + MODULE_BOTTOM_PADDING.value

  return {
    width,
    height,
  }
}

const buildModules = (outline: NocodeEditorAiSolutionOutline) => {
  const forms = outline.forms || []
  const formKeyMap = new Map(
    forms.map(form => [String(form.formKey || '').trim(), form]),
  )
  const groupedForms = new Map<string, NocodeEditorAiSolutionOutlineForm[]>()

  for (const form of forms) {
    const groupName = String(form.groupName || i18next.t('nocodeEditorAiFlowchart.ungrouped')).trim()
      || i18next.t('nocodeEditorAiFlowchart.ungrouped')
    if (!groupedForms.has(groupName)) {
      groupedForms.set(groupName, [])
    }
    groupedForms.get(groupName)?.push(form)
  }

  const normalizeForms = (items: NocodeEditorAiSolutionOutlineForm[], moduleKey: string) => {
    const normalizedItems = items.length
      ? items
      : [{
        ...PLACEHOLDER_FORM,
        groupName: moduleKey,
      }]

    return normalizedItems.map((form, index) => {
      const tableName = String(
        form.tableName || i18next.t('nocodeEditorAiFlowchart.unnamedFormWithIndex', { index: index + 1 }),
      ).trim() || i18next.t('nocodeEditorAiFlowchart.unnamedFormWithIndex', { index: index + 1 })
      const aliases = [
        String(form.formKey || '').trim(),
        tableName,
      ].filter(Boolean)

      return {
        ...form,
        tableName,
        id: `form:${moduleKey}:${index + 1}`,
        moduleKey,
        aliases,
        isPlaceholder: !items.length,
        width: FORM_WIDTH.value,
        height: estimateFormHeight(form),
      }
    })
  }

  let baseModules: Array<NocodeEditorAiSolutionOutlineModule & { forms: NocodeEditorAiSolutionOutlineForm[] }>

  if ((outline.modules || []).length) {
    baseModules = (outline.modules || []).map((module, moduleIndex) => {
      const key = String(module.moduleKey || module.name || `module-${moduleIndex + 1}`).trim()
        || `module-${moduleIndex + 1}`
      const moduleForms = ((module.formKeys || [])
        .map(formKey => formKeyMap.get(String(formKey || '').trim()))
        .filter(Boolean) || []) as NocodeEditorAiSolutionOutlineForm[]
      const fallbackForms = groupedForms.get(String(module.name || '').trim()) || []

      return {
        ...module,
        moduleKey: key,
        forms: moduleForms.length ? moduleForms : fallbackForms,
      }
    })
  } else if (groupedForms.size) {
    baseModules = Array.from(groupedForms.entries()).map(([name, groupForms], moduleIndex) => ({
      moduleKey: `module-${moduleIndex + 1}`,
      name,
      forms: groupForms,
    }))
  } else {
    baseModules = [{
      moduleKey: 'module-1',
      name: outline.title || i18next.t('nocodeEditorAiFlowchart.appPlan'),
      description: outline.summary,
      forms: [],
    }]
  }

  return baseModules.map((module, moduleIndex): ResolvedOutlineModule => {
    const key = String(module.moduleKey || `module-${moduleIndex + 1}`)
    const normalizedForms = normalizeForms(module.forms, key)
    const size = estimateModuleSize(module, normalizedForms)

    return {
      id: `module:${key}`,
      key,
      name: module.name || i18next.t('nocodeEditorAiFlowchart.moduleWithIndex', { index: moduleIndex + 1 }),
      color: module.color || MODULE_COLORS[moduleIndex % MODULE_COLORS.length],
      description: module.description,
      forms: normalizedForms,
      width: size.width,
      height: size.height,
    }
  })
}

const resolvedModules = computed(() => buildModules(props.outline))
const solutionPresentation = computed(() => buildNocodeEditorAiSolutionPresentation(
  props.outline,
  props.planningArtifacts || [],
))
const solutionNodePresentationMap = computed(() => new Map(
  solutionPresentation.value.nodes.map(item => [item.normalizedName, item]),
))

const resolveFormPresentation = (form: ResolvedOutlineForm) => {
  const matched = solutionNodePresentationMap.value.get(
    normalizeNocodeEditorAiPlanningArtifactName(form.tableName || form.formKey || ''),
  )
  const artifactType = String(matched?.artifactType || 'form').trim() || 'form'
  const executionLevel = String(matched?.executionLevel || 'executable_now').trim() || 'executable_now'
  const displayCategory = matched?.displayCategory === 'planning-item'
    ? 'planning-item' as const
    : 'form' as const

  return {
    displayCategory,
    artifactType,
    artifactTypeLabel: resolveNocodeEditorAiArtifactTypeLabel(artifactType),
    executionLevel,
    executionLevelLabel: resolveNocodeEditorAiExecutionLevelLabel(executionLevel),
  }
}

const buildModuleRelations = (
  modules: ResolvedOutlineModule[],
  flows: NocodeEditorAiSolutionOutlineFlow[],
) => {
  const formToModule = new Map<string, string>()
  const aliasToFormId = new Map<string, string>()

  for (const module of modules) {
    for (const form of module.forms) {
      formToModule.set(form.id, module.key)
      for (const alias of form.aliases) {
        if (!aliasToFormId.has(alias)) {
          aliasToFormId.set(alias, form.id)
        }
      }
    }
  }

  const relationKeys = new Set<string>()
  const relations: ModuleRelation[] = []

  for (const flow of flows || []) {
    const fromFormId = aliasToFormId.get(String(flow.from || '').trim())
    const toFormId = aliasToFormId.get(String(flow.to || '').trim())
    if (!fromFormId || !toFormId) {
      continue
    }

    const sourceKey = formToModule.get(fromFormId)
    const targetKey = formToModule.get(toFormId)
    if (!sourceKey || !targetKey || sourceKey === targetKey) {
      continue
    }

    const relationKey = `${sourceKey}->${targetKey}`
    if (relationKeys.has(relationKey)) {
      continue
    }

    relationKeys.add(relationKey)
    relations.push({
      sourceKey,
      targetKey,
    })
  }

  return {
    relations,
    formToModule,
    aliasToFormId,
  }
}

const buildResolvedFlowEdges = (
  modules: ModuleSceneItem[],
  nodes: NodeSceneItem[],
  flows: NocodeEditorAiSolutionOutlineFlow[],
): ResolvedFlowEdgesResult => {
  const moduleMap = new Map(modules.map(module => [module.key, module]))
  const nodeMap = new Map(nodes.map(node => [node.id, node]))
  const aliasToFormId = new Map<string, string>()
  const moduleItems = Array.from(moduleMap.values())
  const minModuleX = Math.min(...moduleItems.map(module => module.x))
  const maxModuleRight = Math.max(...moduleItems.map(module => module.x + module.width))
  const sceneMidX = (minModuleX + maxModuleRight) / 2

  for (const module of modules) {
    for (const form of module.forms) {
      for (const alias of form.aliases) {
        if (!aliasToFormId.has(alias)) {
          aliasToFormId.set(alias, form.id)
        }
      }
    }
  }

  const pairBuckets = new Map<string, ResolvedFlowEdge[]>()
  const portBuckets = new Map<string, { from: ResolvedFlowEdge[]; to: ResolvedFlowEdge[] }>()
  const resolved: ResolvedFlowEdge[] = []

  ;(flows || []).forEach((flow, index) => {
    const fromId = aliasToFormId.get(String(flow.from || '').trim())
    const toId = aliasToFormId.get(String(flow.to || '').trim())
    if (!fromId || !toId || fromId === toId) {
      return
    }

    const fromNode = nodeMap.get(fromId)
    const toNode = nodeMap.get(toId)
    if (!fromNode || !toNode) {
      return
    }

    const fromModule = moduleMap.get(fromNode.moduleKey)
    const toModule = moduleMap.get(toNode.moduleKey)
    if (!fromModule || !toModule) {
      return
    }

    const { fromSide, toSide } = resolveEdgeSides(fromNode, toNode, fromModule, toModule, sceneMidX)
    const edge: ResolvedFlowEdge = {
      id: `flow-edge:${index + 1}`,
      label: sanitizeEdgeLabel(flow.label),
      fromId,
      toId,
      fromModuleKey: fromModule.key,
      toModuleKey: toModule.key,
      fromSide,
      toSide,
      fromPortIndex: 0,
      fromPortCount: 1,
      toPortIndex: 0,
      toPortCount: 1,
      routeOffset: 0,
    }
    resolved.push(edge)

    const bucketKey = `${fromModule.key}->${toModule.key}`
    const bucket = pairBuckets.get(bucketKey) || []
    bucket.push(edge)
    pairBuckets.set(bucketKey, bucket)

    registerPortBucket(portBuckets, edge.fromId, edge.fromSide, 'from', edge)
    registerPortBucket(portBuckets, edge.toId, edge.toSide, 'to', edge)
  })

  for (const bucket of pairBuckets.values()) {
    const middle = (bucket.length - 1) / 2
    const routeSpacing = props.compact ? 12 : 52
    bucket.forEach((edge, index) => {
      edge.routeOffset = (index - middle) * routeSpacing
    })
  }

  const portUsageMap = new Map<string, PortUsageRecord>()

  for (const [key, bucket] of portBuckets.entries()) {
    portUsageMap.set(key, {
      fromCount: bucket.from.length,
      toCount: bucket.to.length,
    })

    assignPortIndexes(bucket.from, 'from', nodeMap)
    assignPortIndexes(bucket.to, 'to', nodeMap)
  }

  return {
    edges: resolved,
    portUsageMap,
  }
}

const getAverage = (values: number[]) => {
  if (!values.length) {
    return null
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

const buildColumnOffsets = (
  modules: ResolvedOutlineModule[],
  desiredCenters: Map<string, number>,
  rowGap: number,
) => {
  const offsets = new Map<string, number>()
  let cursor = 0
  const maxAdditionalGap = rowGap * 1.5

  for (const module of modules) {
    const desiredTop = (desiredCenters.get(module.key) ?? cursor + module.height / 2) - module.height / 2
    const top = Math.min(
      Math.max(cursor, desiredTop),
      cursor + maxAdditionalGap,
    )
    offsets.set(module.key, top)
    cursor = top + module.height + rowGap
  }

  return {
    offsets,
    height: Math.max(cursor - rowGap, 0),
  }
}

const buildManualModulePositions = (
  modules: ResolvedOutlineModule[],
  flows: NocodeEditorAiSolutionOutlineFlow[],
) => {
  const positions = new Map<string, { x: number; y: number; width: number; height: number }>()

  if (props.compact) {
    let currentY = SCENE_PADDING.value
    for (const module of modules) {
      positions.set(module.id, {
        x: SCENE_PADDING.value,
        y: currentY,
        width: module.width,
        height: module.height,
      })
      currentY += module.height + 30
    }
    return positions
  }

  const { relations } = buildModuleRelations(modules, flows)
  if (!relations.length) {
    const maxColumns = modules.length <= 4 ? 2 : 3
    const columnGap = modules.length <= 4 ? 124 : 108
    const rowGap = 84
    const rows: ResolvedOutlineModule[][] = []

    modules.forEach((module, index) => {
      const rowIndex = Math.floor(index / maxColumns)
      if (!rows[rowIndex]) {
        rows[rowIndex] = []
      }
      rows[rowIndex].push(module)
    })

    const getRowWidth = (items: ResolvedOutlineModule[]) => items.reduce((total, item, index) => (
      total + item.width + (index ? columnGap : 0)
    ), 0)

    const maxRowWidth = rows.reduce((max, row) => Math.max(max, getRowWidth(row)), 0)
    let currentY = SCENE_PADDING.value

    for (const row of rows) {
      const rowWidth = getRowWidth(row)
      let currentX = SCENE_PADDING.value + Math.max((maxRowWidth - rowWidth) / 2, 0)
      let rowHeight = 0

      for (const module of row) {
        positions.set(module.id, {
          x: currentX,
          y: currentY,
          width: module.width,
          height: module.height,
        })

        currentX += module.width + columnGap
        rowHeight = Math.max(rowHeight, module.height)
      }

      currentY += rowHeight + rowGap
    }

    return positions
  }

  const moduleOrder = new Map(modules.map((module, index) => [module.key, index]))
  const indegree = new Map(modules.map(module => [module.key, 0]))
  const outgoing = new Map(modules.map(module => [module.key, [] as string[]]))
  const incoming = new Map(modules.map(module => [module.key, [] as string[]]))

  relations.forEach((relation) => {
    indegree.set(relation.targetKey, (indegree.get(relation.targetKey) || 0) + 1)
    outgoing.get(relation.sourceKey)?.push(relation.targetKey)
    incoming.get(relation.targetKey)?.push(relation.sourceKey)
  })

  const pendingIndegree = new Map(indegree)
  const queue = modules
    .filter(module => (pendingIndegree.get(module.key) || 0) === 0)
    .sort((left, right) => (moduleOrder.get(left.key) || 0) - (moduleOrder.get(right.key) || 0))
    .map(module => module.key)

  const layerMap = new Map<string, number>()
  const visited = new Set<string>()

  queue.forEach((key) => {
    layerMap.set(key, 0)
  })

  while (queue.length) {
    const currentKey = queue.shift()
    if (!currentKey) {
      continue
    }
    visited.add(currentKey)
    const currentLayer = layerMap.get(currentKey) || 0
    for (const targetKey of outgoing.get(currentKey) || []) {
      layerMap.set(targetKey, Math.max(layerMap.get(targetKey) || 0, currentLayer + 1))
      pendingIndegree.set(targetKey, (pendingIndegree.get(targetKey) || 0) - 1)
      if ((pendingIndegree.get(targetKey) || 0) <= 0) {
        queue.push(targetKey)
      }
    }
  }

  modules.forEach((module) => {
    if (visited.has(module.key)) {
      return
    }
    const parentLayers = (incoming.get(module.key) || []).map(key => layerMap.get(key) || 0)
    layerMap.set(module.key, parentLayers.length ? Math.max(...parentLayers) + 1 : 0)
  })

  const rawLayerCount = Math.max(...Array.from(layerMap.values()), 0) + 1
  const targetColumnCount = rawLayerCount <= 3
    ? rawLayerCount
    : Math.min(rawLayerCount, modules.length <= 5 ? 3 : 4)

  const columns = Array.from({ length: targetColumnCount }, () => [] as ResolvedOutlineModule[])
  const columnIndexMap = new Map<string, number>()

  modules.forEach((module) => {
    const rawLayer = layerMap.get(module.key) || 0
    const columnIndex = rawLayerCount <= targetColumnCount || rawLayerCount <= 1
      ? rawLayer
      : Math.round(rawLayer / (rawLayerCount - 1) * (targetColumnCount - 1))
    columnIndexMap.set(module.key, columnIndex)
    columns[columnIndex].push(module)
  })

  const columnOrderLookup = new Map<string, number>()
  const syncColumnOrderLookup = () => {
    columns.forEach((columnModules) => {
      columnModules.forEach((module, index) => {
        columnOrderLookup.set(module.key, index)
      })
    })
  }

  syncColumnOrderLookup()

  const sortColumnByNeighborOrder = (
    columnModules: ResolvedOutlineModule[],
    columnIndex: number,
    preferPrev: boolean,
  ) => {
    columnModules.sort((left, right) => {
      const getNeighborOrders = (moduleKey: string, usePrevNeighbors: boolean) => {
        const neighborKeys = usePrevNeighbors
          ? (incoming.get(moduleKey) || []).filter(key => (columnIndexMap.get(key) || 0) < columnIndex)
          : (outgoing.get(moduleKey) || []).filter(key => (columnIndexMap.get(key) || 0) > columnIndex)

        return neighborKeys
          .map(key => columnOrderLookup.get(key))
          .filter((value): value is number => typeof value === 'number')
      }

      const leftPrimary = getNeighborOrders(left.key, preferPrev)
      const rightPrimary = getNeighborOrders(right.key, preferPrev)
      const leftFallback = getNeighborOrders(left.key, !preferPrev)
      const rightFallback = getNeighborOrders(right.key, !preferPrev)
      const leftScore = getAverage(leftPrimary) ?? getAverage(leftFallback) ?? (moduleOrder.get(left.key) || 0)
      const rightScore = getAverage(rightPrimary) ?? getAverage(rightFallback) ?? (moduleOrder.get(right.key) || 0)

      if (leftScore !== rightScore) {
        return leftScore - rightScore
      }
      return (moduleOrder.get(left.key) || 0) - (moduleOrder.get(right.key) || 0)
    })
  }

  for (let sweep = 0; sweep < 3; sweep += 1) {
    for (let columnIndex = 1; columnIndex < columns.length; columnIndex += 1) {
      sortColumnByNeighborOrder(columns[columnIndex], columnIndex, true)
      syncColumnOrderLookup()
    }

    for (let columnIndex = columns.length - 2; columnIndex >= 0; columnIndex -= 1) {
      sortColumnByNeighborOrder(columns[columnIndex], columnIndex, false)
      syncColumnOrderLookup()
    }
  }

  const columnGap = modules.length <= 4 ? 164 : 148
  const rowGap = 84
  const columnWidths = columns.map(items => items.reduce((max, item) => Math.max(max, item.width), 0))
  const columnOffsets = columns.map(() => new Map<string, number>())
  const centerLookup = new Map<string, number>()

  columns.forEach((columnModules, columnIndex) => {
    const { offsets } = buildColumnOffsets(columnModules, new Map(), rowGap)
    columnOffsets[columnIndex] = offsets
    columnModules.forEach((module) => {
      const top = offsets.get(module.key) || 0
      centerLookup.set(module.key, top + module.height / 2)
    })
  })

  for (let sweep = 0; sweep < 4; sweep += 1) {
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const desiredCenters = new Map<string, number>()

      for (const module of columns[columnIndex]) {
        const preferredNeighbors = [
          ...(incoming.get(module.key) || []).filter(key => (columnIndexMap.get(key) || 0) < columnIndex),
          ...(outgoing.get(module.key) || []).filter(key => (columnIndexMap.get(key) || 0) > columnIndex),
        ]
        const fallbackNeighbors = [
          ...(incoming.get(module.key) || []),
          ...(outgoing.get(module.key) || []),
        ]
        const neighborCenters = (preferredNeighbors.length ? preferredNeighbors : fallbackNeighbors)
          .map(key => centerLookup.get(key))
          .filter((value): value is number => typeof value === 'number')
        const averageCenter = getAverage(neighborCenters)
        if (typeof averageCenter === 'number') {
          desiredCenters.set(module.key, averageCenter)
        }
      }

      const { offsets } = buildColumnOffsets(columns[columnIndex], desiredCenters, rowGap)
      columnOffsets[columnIndex] = offsets
      columns[columnIndex].forEach((module) => {
        const top = offsets.get(module.key) || 0
        centerLookup.set(module.key, top + module.height / 2)
      })
    }

    for (let columnIndex = columns.length - 1; columnIndex >= 0; columnIndex -= 1) {
      const desiredCenters = new Map<string, number>()

      for (const module of columns[columnIndex]) {
        const preferredNeighbors = [
          ...(outgoing.get(module.key) || []).filter(key => (columnIndexMap.get(key) || 0) > columnIndex),
          ...(incoming.get(module.key) || []).filter(key => (columnIndexMap.get(key) || 0) < columnIndex),
        ]
        const fallbackNeighbors = [
          ...(incoming.get(module.key) || []),
          ...(outgoing.get(module.key) || []),
        ]
        const neighborCenters = (preferredNeighbors.length ? preferredNeighbors : fallbackNeighbors)
          .map(key => centerLookup.get(key))
          .filter((value): value is number => typeof value === 'number')
        const averageCenter = getAverage(neighborCenters)
        if (typeof averageCenter === 'number') {
          desiredCenters.set(module.key, averageCenter)
        }
      }

      const { offsets } = buildColumnOffsets(columns[columnIndex], desiredCenters, rowGap)
      columnOffsets[columnIndex] = offsets
      columns[columnIndex].forEach((module) => {
        const top = offsets.get(module.key) || 0
        centerLookup.set(module.key, top + module.height / 2)
      })
    }
  }

  const columnHeights = columns.map((columnModules, columnIndex) => {
    return columnModules.reduce((maxHeight, module) => {
      const top = columnOffsets[columnIndex].get(module.key) || 0
      return Math.max(maxHeight, top + module.height)
    }, 0)
  })
  const maxColumnHeight = Math.max(...columnHeights, 0)

  let currentX = SCENE_PADDING.value
  columns.forEach((columnModules, columnIndex) => {
    const columnWidth = columnWidths[columnIndex] || 0
    const columnHeight = columnHeights[columnIndex] || 0
    const baseY = SCENE_PADDING.value + Math.max((maxColumnHeight - columnHeight) / 2, 0)

    columnModules.forEach((module) => {
      const offsetTop = columnOffsets[columnIndex].get(module.key) || 0
      positions.set(module.id, {
        x: currentX + Math.max((columnWidth - module.width) / 2, 0),
        y: baseY + offsetTop,
        width: module.width,
        height: module.height,
      })
    })

    currentX += columnWidth + columnGap
  })

  return positions
}

const resolveModulePositions = async (modules: ResolvedOutlineModule[], flows: NocodeEditorAiSolutionOutlineFlow[]) => {
  return buildManualModulePositions(modules, flows)
}

const getNodeCenter = (node: NodeSceneItem) => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2,
})

const getPortUsageKey = (nodeId: string, side: PortSide) => `${nodeId}:${side}`

const resolveEdgeSides = (
  fromNode: NodeSceneItem,
  toNode: NodeSceneItem,
  fromModule: ModuleSceneItem,
  toModule: ModuleSceneItem,
  sceneMidX: number,
): { fromSide: PortSide; toSide: PortSide } => {
  const toRect = (node: NodeSceneItem): FlowchartRect => ({
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  })

  return resolveFlowEdgeSidesByDistance({
    fromRect: toRect(fromNode),
    toRect: toRect(toNode),
    sameModule: fromNode.moduleKey === toNode.moduleKey,
    sceneMidX,
  })
}

const registerPortBucket = (
  portBuckets: Map<string, { from: ResolvedFlowEdge[]; to: ResolvedFlowEdge[] }>,
  nodeId: string,
  side: PortSide,
  role: PortRole,
  edge: ResolvedFlowEdge,
) => {
  const key = getPortUsageKey(nodeId, side)
  const bucket = portBuckets.get(key) || { from: [], to: [] }
  bucket[role].push(edge)
  portBuckets.set(key, bucket)
}

const getEdgePortSortValue = (
  edge: ResolvedFlowEdge,
  role: PortRole,
  nodeMap: Map<string, NodeSceneItem>,
) => {
  const currentNode = nodeMap.get(role === 'from' ? edge.fromId : edge.toId)
  const oppositeNode = nodeMap.get(role === 'from' ? edge.toId : edge.fromId)
  const side = role === 'from' ? edge.fromSide : edge.toSide

  if (!currentNode || !oppositeNode) {
    return 0
  }

  const oppositeCenter = getNodeCenter(oppositeNode)
  return side === 'left' || side === 'right'
    ? oppositeCenter.y
    : oppositeCenter.x
}

const assignPortIndexes = (
  bucket: ResolvedFlowEdge[],
  role: PortRole,
  nodeMap: Map<string, NodeSceneItem>,
) => {
  const sortedBucket = [...bucket].sort((left, right) => {
    const leftValue = getEdgePortSortValue(left, role, nodeMap)
    const rightValue = getEdgePortSortValue(right, role, nodeMap)
    if (leftValue !== rightValue) {
      return leftValue - rightValue
    }
    return left.id.localeCompare(right.id)
  })

  sortedBucket.forEach((edge, index) => {
    if (role === 'from') {
      edge.fromPortIndex = index
      edge.fromPortCount = sortedBucket.length
      return
    }

    edge.toPortIndex = index
    edge.toPortCount = sortedBucket.length
  })
}

const getDistributedPosition = (start: number, end: number, index: number, count: number) => {
  const min = Math.min(start, end)
  const max = Math.max(start, end)
  if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 1 || count <= 1) {
    return round((min + max) / 2)
  }

  const step = (max - min) / Math.max(count - 1, 1)
  return round(min + step * clamp(index, 0, count - 1))
}

const getPortBandRange = (
  start: number,
  end: number,
  role: PortRole,
  usage: PortUsageRecord,
) => {
  const min = Math.min(start, end)
  const max = Math.max(start, end)
  const hasBothRoles = usage.fromCount > 0 && usage.toCount > 0

  if (!hasBothRoles || Math.abs(max - min) < 1) {
    return {
      start: min,
      end: max,
    }
  }

  const span = max - min
  const bandGap = Math.min(Math.max(span * 0.14, props.compact ? 10 : 12), props.compact ? 18 : 24)
  const bandSpan = Math.max((span - bandGap) / 2, 0)

  if (role === 'from') {
    return {
      start: min,
      end: min + bandSpan,
    }
  }

  return {
    start: max - bandSpan,
    end: max,
  }
}

const getNodePortAnchor = (
  node: NodeSceneItem,
  side: PortSide,
  role: PortRole,
  portIndex: number,
  portCount: number,
  portUsageMap: Map<string, PortUsageRecord>,
): Point => {
  const usage = portUsageMap.get(getPortUsageKey(node.id, side)) || {
    fromCount: role === 'from' ? portCount : 0,
    toCount: role === 'to' ? portCount : 0,
  }
  const isVerticalSide = side === 'left' || side === 'right'
  const axisSize = isVerticalSide ? node.height : node.width
  const basePadding = clamp(
    axisSize * (props.compact ? 0.18 : 0.16),
    props.compact ? 10 : 12,
    props.compact ? 18 : 24,
  )
  const axisStart = isVerticalSide ? node.y + basePadding : node.x + basePadding
  const axisEnd = isVerticalSide
    ? node.y + node.height - basePadding
    : node.x + node.width - basePadding
  const band = getPortBandRange(axisStart, axisEnd, role, usage)
  const axisValue = getDistributedPosition(band.start, band.end, portIndex, portCount)

  if (side === 'left') {
    return { x: node.x, y: axisValue }
  }
  if (side === 'right') {
    return { x: node.x + node.width, y: axisValue }
  }
  if (side === 'top') {
    return { x: axisValue, y: node.y }
  }
  return { x: axisValue, y: node.y + node.height }
}

const projectPointFromSide = (point: Point, side: PortSide, distance: number): Point => {
  if (side === 'left') {
    return { x: round(point.x - distance), y: point.y }
  }
  if (side === 'right') {
    return { x: round(point.x + distance), y: point.y }
  }
  if (side === 'top') {
    return { x: point.x, y: round(point.y - distance) }
  }
  return { x: point.x, y: round(point.y + distance) }
}

const simplifyPoints = (points: Point[]) => {
  const normalized = points
    .map(point => ({ x: round(point.x), y: round(point.y) }))
    .filter((point, index, list) => {
      if (index === 0) {
        return true
      }
      const previous = list[index - 1]
      return previous.x !== point.x || previous.y !== point.y
    })

  if (normalized.length <= 2) {
    return normalized
  }

  const simplified: Point[] = [normalized[0]]
  for (let index = 1; index < normalized.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1]
    const current = normalized[index]
    const next = normalized[index + 1]
    const sameX = previous.x === current.x && current.x === next.x
    const sameY = previous.y === current.y && current.y === next.y
    if (!sameX && !sameY) {
      simplified.push(current)
    }
  }
  simplified.push(normalized[normalized.length - 1])

  return simplified
}

const buildPath = (points: Point[]) => {
  if (!points.length) {
    return ''
  }
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

const getRectOverlapArea = (source: Rect, target: Rect) => {
  const overlapWidth = Math.min(source.x + source.width, target.x + target.width) - Math.max(source.x, target.x)
  const overlapHeight = Math.min(source.y + source.height, target.y + target.height) - Math.max(source.y, target.y)
  if (overlapWidth <= 0 || overlapHeight <= 0) {
    return 0
  }
  return overlapWidth * overlapHeight
}

const getLabelBox = (points: Point[], label: string, blockers: Rect[]) => {
  if (!label) {
    return null
  }

  const labelLines = splitText(label, props.compact ? 9 : 11)
  const labelWidth = clamp(
    labelLines.reduce((max, line) => Math.max(max, line.length), 0) * (props.compact ? 10 : 11)
      + (props.compact ? 20 : 24),
    props.compact ? 66 : 76,
    props.compact ? 148 : 176,
  )
  const labelLineHeight = props.compact ? 12 : 13
  const labelHeight = Math.max(
    props.compact ? 26 : 30,
    labelLines.length * labelLineHeight + (props.compact ? 12 : 14),
  )

  const labelGap = props.compact ? 12 : 16
  const segments = points.slice(0, -1)
    .map((start, index) => {
      const end = points[index + 1]
      return {
        start,
        end,
        length: Math.abs(start.x - end.x) + Math.abs(start.y - end.y),
        isHorizontal: start.y === end.y,
      }
    })
    .filter(segment => segment.length > 0)
    .sort((left, right) => right.length - left.length)

  const fallbackCenterX = (points[0].x + points[points.length - 1].x) / 2
  const fallbackCenterY = (points[0].y + points[points.length - 1].y) / 2
  const candidates: Array<Rect & {
    priority: number
    anchorX: number
    anchorY: number
  }> = []

  segments.forEach((segment, segmentIndex) => {
    if (segment.isHorizontal) {
      const minX = Math.min(segment.start.x, segment.end.x)
      const maxX = Math.max(segment.start.x, segment.end.x)
      const segmentCenterX = (minX + maxX) / 2
      const availableLeft = minX + labelGap
      const availableRight = maxX - labelWidth - labelGap
      const centerLeft = segmentCenterX - labelWidth / 2
      const preferredX = round(clamp(centerLeft, availableLeft, availableRight))
      const xPositions = Array.from(new Set([
        preferredX,
        round(centerLeft),
        round(availableLeft),
        round(availableRight),
      ]))

      xPositions.forEach((candidateX, index) => {
        candidates.push({
          x: candidateX,
          y: segment.start.y - labelHeight - labelGap,
          width: labelWidth,
          height: labelHeight,
          priority: segmentIndex * 10 + index,
          anchorX: segmentCenterX,
          anchorY: segment.start.y,
        })
        candidates.push({
          x: candidateX,
          y: segment.start.y + labelGap,
          width: labelWidth,
          height: labelHeight,
          priority: segmentIndex * 10 + index + 1,
          anchorX: segmentCenterX,
          anchorY: segment.start.y,
        })
      })
      return
    }

    const minY = Math.min(segment.start.y, segment.end.y)
    const maxY = Math.max(segment.start.y, segment.end.y)
    const segmentCenterY = (minY + maxY) / 2
    const availableTop = minY + labelGap
    const availableBottom = maxY - labelHeight - labelGap
    const centerTop = segmentCenterY - labelHeight / 2
    const preferredY = round(clamp(centerTop, availableTop, availableBottom))
    const yPositions = Array.from(new Set([
      preferredY,
      round(centerTop),
      round(availableTop),
      round(availableBottom),
    ]))

    yPositions.forEach((candidateY, index) => {
      candidates.push({
        x: segment.start.x + labelGap,
        y: candidateY,
        width: labelWidth,
        height: labelHeight,
        priority: segmentIndex * 10 + index,
        anchorX: segment.start.x,
        anchorY: segmentCenterY,
      })
      candidates.push({
        x: segment.start.x - labelWidth - labelGap,
        y: candidateY,
        width: labelWidth,
        height: labelHeight,
        priority: segmentIndex * 10 + index + 1,
        anchorX: segment.start.x,
        anchorY: segmentCenterY,
      })
    })
  })

  candidates.push({
    x: fallbackCenterX - labelWidth / 2,
    y: fallbackCenterY - labelHeight / 2,
    width: labelWidth,
    height: labelHeight,
    priority: 999,
    anchorX: fallbackCenterX,
    anchorY: fallbackCenterY,
  })

  const bestCandidate = candidates.reduce((best, candidate) => {
    const overlapArea = blockers.reduce((total, blocker) => total + getRectOverlapArea(candidate, blocker), 0)
    const overlapCount = blockers.reduce((total, blocker) => total + (getRectOverlapArea(candidate, blocker) > 0 ? 1 : 0), 0)
    const distancePenalty = Math.abs(candidate.x + candidate.width / 2 - candidate.anchorX)
      + Math.abs(candidate.y + candidate.height / 2 - candidate.anchorY)
    const score = overlapCount * 100000 + overlapArea * 100 + candidate.priority * 1000 + distancePenalty

    if (!best || score < best.score) {
      return {
        candidate,
        score,
      }
    }

    return best
  }, null as null | { candidate: Rect; score: number })

  return bestCandidate?.candidate || {
    x: fallbackCenterX - labelWidth / 2,
    y: fallbackCenterY - labelHeight / 2,
    width: labelWidth,
    height: labelHeight,
  }
}

const routeFlowEdge = (
  edge: ResolvedFlowEdge,
  nodeMap: Map<string, NodeSceneItem>,
  moduleMap: Map<string, ModuleSceneItem>,
  portUsageMap: Map<string, PortUsageRecord>,
  blockers: Rect[],
) => {
  const fromNode = nodeMap.get(edge.fromId)
  const toNode = nodeMap.get(edge.toId)
  const fromModule = moduleMap.get(edge.fromModuleKey)
  const toModule = moduleMap.get(edge.toModuleKey)
  if (!fromNode || !toNode || !fromModule || !toModule) {
    return null
  }

  const connectionGap = props.compact ? 10 : 12
  const channelGap = props.compact ? 20 : 26

  const fromAnchor = getNodePortAnchor(
    fromNode,
    edge.fromSide,
    'from',
    edge.fromPortIndex,
    edge.fromPortCount,
    portUsageMap,
  )
  const toAnchor = getNodePortAnchor(
    toNode,
    edge.toSide,
    'to',
    edge.toPortIndex,
    edge.toPortCount,
    portUsageMap,
  )
  const fromOuter = projectPointFromSide(fromAnchor, edge.fromSide, connectionGap)
  const toOuter = projectPointFromSide(toAnchor, edge.toSide, connectionGap)
  const sameColumn = !props.compact && Math.abs(fromModule.x - toModule.x) < 1

  const points: Point[] = [fromAnchor, fromOuter]

  if (fromNode.moduleKey === toNode.moduleKey) {
    if (edge.fromSide === 'left' || edge.fromSide === 'right') {
      const baseX = edge.fromSide === 'right'
        ? fromModule.x + fromModule.width + channelGap
        : fromModule.x - channelGap
      const channelX = round(baseX + edge.routeOffset)
      points.push(
        { x: channelX, y: fromOuter.y },
        { x: channelX, y: toOuter.y },
      )
    } else {
      const baseY = edge.fromSide === 'bottom'
        ? fromModule.y + fromModule.height + channelGap
        : fromModule.y - channelGap
      const channelY = round(baseY + edge.routeOffset)
      points.push(
        { x: fromOuter.x, y: channelY },
        { x: toOuter.x, y: channelY },
      )
    }
  } else if (
    sameColumn
    && (edge.fromSide === 'left' || edge.fromSide === 'right')
    && edge.fromSide === edge.toSide
  ) {
    const useRightChannel = edge.fromSide === 'right'
    const channelAnchorX = useRightChannel
      ? Math.max(fromModule.x + fromModule.width, toModule.x + toModule.width)
      : Math.min(fromModule.x, toModule.x)
    const channelX = round(channelAnchorX + (useRightChannel ? channelGap + 10 : -(channelGap + 10)) + edge.routeOffset)
    points.push(
      { x: channelX, y: fromOuter.y },
      { x: channelX, y: toOuter.y },
    )
  } else if (
    (edge.fromSide === 'left' || edge.fromSide === 'right')
    && (edge.toSide === 'left' || edge.toSide === 'right')
  ) {
    const channelX = round((fromOuter.x + toOuter.x) / 2 + edge.routeOffset)
    points.push(
      { x: channelX, y: fromOuter.y },
      { x: channelX, y: toOuter.y },
    )
  } else if (
    (edge.fromSide === 'top' || edge.fromSide === 'bottom')
    && (edge.toSide === 'top' || edge.toSide === 'bottom')
  ) {
    const channelY = round((fromOuter.y + toOuter.y) / 2 + edge.routeOffset)
    points.push(
      { x: fromOuter.x, y: channelY },
      { x: toOuter.x, y: channelY },
    )
  } else {
    const preferHorizontalTurn = Math.abs(toAnchor.x - fromAnchor.x) >= Math.abs(toAnchor.y - fromAnchor.y)
    points.push(preferHorizontalTurn
      ? { x: toOuter.x, y: fromOuter.y }
      : { x: fromOuter.x, y: toOuter.y })
  }

  points.push(toOuter, toAnchor)

  const normalizedPoints = simplifyPoints(points)
  const labelBox = getLabelBox(normalizedPoints, edge.label || '', blockers)

  return {
    id: edge.id,
    fromModuleKey: edge.fromModuleKey,
    toModuleKey: edge.toModuleKey,
    label: edge.label,
    points: normalizedPoints,
    path: buildPath(normalizedPoints),
    labelX: labelBox?.x,
    labelY: labelBox?.y,
    labelWidth: labelBox?.width,
    labelHeight: labelBox?.height,
  } as EdgeSceneItem
}

const normalizeScene = (modules: ModuleSceneItem[], nodes: NodeSceneItem[], edges: EdgeSceneItem[]) => {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  const includeBounds = (x: number, y: number, width = 0, height = 0) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x + width)
    maxY = Math.max(maxY, y + height)
  }

  modules.forEach(module => includeBounds(module.x, module.y, module.width, module.height))
  nodes.forEach(node => includeBounds(node.x, node.y, node.width, node.height))
  edges.forEach(edge => {
    const edgePadding = props.compact ? 12 : 16
    edge.points.forEach(point => includeBounds(
      point.x - edgePadding,
      point.y - edgePadding,
      edgePadding * 2,
      edgePadding * 2,
    ))
    if (typeof edge.labelX === 'number' && typeof edge.labelY === 'number') {
      includeBounds(edge.labelX, edge.labelY, edge.labelWidth, edge.labelHeight)
    }
  })

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return {
      width: 0,
      height: 0,
      modules,
      nodes,
      edges,
    } as FlowchartScene
  }

  const offsetX = SCENE_PADDING.value - minX
  const offsetY = SCENE_PADDING.value - minY

  const shiftedModules = modules.map(module => ({
    ...module,
    x: round(module.x + offsetX),
    y: round(module.y + offsetY),
  }))

  const shiftedNodes = nodes.map(node => ({
    ...node,
    x: round(node.x + offsetX),
    y: round(node.y + offsetY),
  }))

  const shiftedEdges = edges.map(edge => ({
    ...edge,
    points: edge.points.map(point => ({
      x: round(point.x + offsetX),
      y: round(point.y + offsetY),
    })),
    labelX: typeof edge.labelX === 'number' ? round(edge.labelX + offsetX) : undefined,
    labelY: typeof edge.labelY === 'number' ? round(edge.labelY + offsetY) : undefined,
  })).map(edge => ({
    ...edge,
    path: buildPath(edge.points),
  }))

  const normalizedScene: FlowchartScene = {
    width: Math.ceil(maxX + offsetX + SCENE_PADDING.value),
    height: Math.ceil(maxY + offsetY + SCENE_PADDING.value),
    modules: shiftedModules,
    nodes: shiftedNodes,
    edges: shiftedEdges,
  }

  return normalizedScene
}

const buildScene = async (
  modules: ResolvedOutlineModule[],
  flows: NocodeEditorAiSolutionOutlineFlow[],
) => {
  const layoutModules = await resolveModulePositions(modules, flows)

  const sceneModules: ModuleSceneItem[] = []
  const sceneNodes: NodeSceneItem[] = []

  for (const module of modules) {
    const positioned = layoutModules.get(module.id)
    const moduleX = Number(positioned?.x || 0)
    const moduleY = Number(positioned?.y || 0)
    const moduleWidth = Number(positioned?.width || module.width)
    const moduleHeight = Number(positioned?.height || module.height)

    const sceneModule: ModuleSceneItem = {
      id: module.id,
      key: module.key,
      name: module.name,
      color: module.color,
      description: module.description,
      forms: module.forms,
      formCount: 0,
      planningItemCount: 0,
      x: moduleX,
      y: moduleY,
      width: moduleWidth,
      height: moduleHeight,
    }
    sceneModules.push(sceneModule)

    let currentY = moduleY + MODULE_HEADER_HEIGHT.value + (!props.compact && module.description ? 18 : 0)
    for (const [formIndex, form] of module.forms.entries()) {
      const formPresentation = resolveFormPresentation(form)
      const sceneNode: NodeSceneItem = {
        id: form.id,
        moduleId: module.id,
        moduleKey: module.key,
        title: form.tableName,
        description: form.description,
        displayCategory: formPresentation.displayCategory,
        artifactType: formPresentation.artifactType,
        artifactTypeLabel: formPresentation.artifactTypeLabel,
        executionLevel: formPresentation.executionLevel,
        executionLevelLabel: formPresentation.executionLevelLabel,
        color: module.color,
        x: moduleX + MODULE_SIDE_PADDING.value,
        y: currentY,
        width: form.width,
        height: form.height,
        isPrimary: !form.isPlaceholder && formIndex === 0,
        isPlaceholder: !!form.isPlaceholder,
      }
      if (!form.isPlaceholder) {
        if (sceneNode.displayCategory === 'planning-item') {
          sceneModule.planningItemCount += 1
        } else {
          sceneModule.formCount += 1
        }
      }
      sceneNodes.push(sceneNode)
      currentY += form.height + MODULE_FORM_GAP.value
    }
  }

  const moduleMap = new Map(sceneModules.map(module => [module.key, module]))
  const nodeMap = new Map(sceneNodes.map(node => [node.id, node]))
  const moduleHeaderBlockHeight = MODULE_HEADER_HEIGHT.value + (!props.compact ? 18 : 0)
  const labelBlockers: Rect[] = [
    ...sceneNodes.map((node) => ({
      x: node.x - 6,
      y: node.y - 6,
      width: node.width + 12,
      height: node.height + 12,
    })),
    ...sceneModules.map((module) => ({
      x: module.x + 12,
      y: module.y + 10,
      width: Math.max(module.width - 24, 0),
      height: Math.min(moduleHeaderBlockHeight, module.height - 12),
    })),
  ]

  const sceneEdges: EdgeSceneItem[] = []
  const edgeBlockers = [...labelBlockers]
  const { edges, portUsageMap } = buildResolvedFlowEdges(sceneModules, sceneNodes, flows)

  for (const edge of edges) {
    const routedEdge = routeFlowEdge(edge, nodeMap, moduleMap, portUsageMap, edgeBlockers)
    if (!routedEdge) {
      continue
    }
    sceneEdges.push(routedEdge)

    if (typeof routedEdge.labelX === 'number' && typeof routedEdge.labelY === 'number') {
      edgeBlockers.push({
        x: routedEdge.labelX - 8,
        y: routedEdge.labelY - 6,
        width: (routedEdge.labelWidth || 0) + 16,
        height: (routedEdge.labelHeight || 0) + 12,
      })
    }
  }

  return normalizeScene(sceneModules, sceneNodes, sceneEdges)
}

const renderChart = async () => {
  const currentRender = ++renderSerial
  renderError.value = ''
  const previousActiveModuleKey = activeModuleKey.value
  scene.value = null

  try {
    const nextScene = await buildScene(resolvedModules.value, props.outline.flows || [])
    if (currentRender !== renderSerial) {
      return
    }
    scene.value = nextScene
    activeModuleId.value = nextScene.modules.find(module => module.key === previousActiveModuleKey)?.id
      || nextScene.modules[0]?.id
      || ''
    manualScale.value = null
  } catch (error) {
    console.error('Failed to render AI flowchart:', error)
    if (currentRender !== renderSerial) {
      return
    }
    renderError.value = error instanceof Error ? error.message : i18next.t('nocodeEditorAiFlowchart.unknownError')
  }
}

watch(
  [resolvedModules, () => props.outline.flows, () => props.compact],
  () => {
    void renderChart()
  },
  {
    deep: true,
    immediate: true,
  },
)

onMounted(() => {
  void renderChart()
})

const fitScale = computed(() => {
  const currentScene = scene.value
  if (!currentScene || !currentScene.width || !viewportWidth.value) {
    return 1
  }

  const reservedWidth = props.compact ? 28 : 40
  const availableWidth = Math.max(viewportWidth.value - reservedWidth, 0)
  if (!availableWidth) {
    return 1
  }

  const scales = [availableWidth / currentScene.width]

  if (!props.compact && currentScene.height && viewportHeight.value) {
    const reservedHeight = 28
    const availableHeight = Math.max(viewportHeight.value - reservedHeight, 0)
    if (availableHeight) {
      scales.push(availableHeight / currentScene.height)
    }
  }

  return clamp(Math.min(...scales), 0.22, 1)
})



const canvasStyle = computed(() => {
  if (!scene.value) {
    return {}
  }

  return {
    width: `${scene.value.width * displayScale.value}px`,
    height: `${scene.value.height * displayScale.value}px`,
  }
})

const sceneStyle = computed(() => {
  if (!scene.value) {
    return {}
  }

  return {
    width: `${scene.value.width}px`,
    height: `${scene.value.height}px`,
    transform: `scale(${displayScale.value})`,
    transformOrigin: 'top left',
  }
})

const syncViewportPanState = () => {
  const viewport = viewportRef.value
  if (!viewport) {
    canPanViewport.value = false
    return
  }

  canPanViewport.value = viewport.scrollWidth > viewport.clientWidth + 1
    || viewport.scrollHeight > viewport.clientHeight + 1
}

const setViewportScale = (nextScale: number, anchor?: { clientX: number; clientY: number }) => {
  const viewport = viewportRef.value
  const currentScale = displayScale.value
  const resolvedScale = clamp(round(nextScale), MIN_SCALE, MAX_SCALE)

  if (!viewport || Math.abs(resolvedScale - currentScale) < 0.001) {
    manualScale.value = resolvedScale
    return
  }

  const rect = viewport.getBoundingClientRect()
  const offsetX = anchor ? anchor.clientX - rect.left : viewport.clientWidth / 2
  const offsetY = anchor ? anchor.clientY - rect.top : viewport.clientHeight / 2
  const contentX = (viewport.scrollLeft + offsetX) / currentScale
  const contentY = (viewport.scrollTop + offsetY) / currentScale

  manualScale.value = resolvedScale

  requestAnimationFrame(() => {
    const nextScrollLeft = contentX * resolvedScale - offsetX
    const nextScrollTop = contentY * resolvedScale - offsetY
    viewport.scrollLeft = Math.max(0, nextScrollLeft)
    viewport.scrollTop = Math.max(0, nextScrollTop)
    syncViewportPanState()
  })
}

const changeScale = (delta: number) => {
  const base = manualScale.value ?? fitScale.value
  setViewportScale(base + delta)
}

const resetScale = () => {
  manualScale.value = null
}

const handleViewportWheel = (event: WheelEvent) => {
  if (!scene.value || !viewportRef.value) {
    return
  }

  const direction = event.deltaY < 0 ? 1 : -1
  const intensity = Math.min(Math.abs(event.deltaY) / 240, 1)
  const delta = direction * (0.08 + intensity * 0.06)
  const base = manualScale.value ?? fitScale.value

  setViewportScale(base + delta, {
    clientX: event.clientX,
    clientY: event.clientY,
  })
}

const isViewportDragTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return true
  }

  return !target.closest('.ai-flowchart__module, .ai-flowchart__node, .ai-flowchart__edge-label')
}

const stopViewportPan = () => {
  isPanning.value = false
  document.body.style.userSelect = ''
  stopViewportPanListeners?.()
  stopViewportPanListeners = null
}

const handleViewportDragMove = (event: MouseEvent) => {
  const viewport = viewportRef.value
  if (!viewport || !isPanning.value) {
    return
  }

  const deltaX = event.clientX - viewportPanState.startClientX
  const deltaY = event.clientY - viewportPanState.startClientY
  viewport.scrollLeft = viewportPanState.startScrollLeft - deltaX
  viewport.scrollTop = viewportPanState.startScrollTop - deltaY
}

const handleViewportDragStart = (event: MouseEvent) => {
  const viewport = viewportRef.value
  if (
    event.button !== 0
    || !viewport
    || !canPanViewport.value
    || !isViewportDragTarget(event.target)
  ) {
    return
  }

  isPanning.value = true
  viewportPanState.startClientX = event.clientX
  viewportPanState.startClientY = event.clientY
  viewportPanState.startScrollLeft = viewport.scrollLeft
  viewportPanState.startScrollTop = viewport.scrollTop
  document.body.style.userSelect = 'none'
  event.preventDefault()

  const handleMouseUp = () => {
    stopViewportPan()
  }

  window.addEventListener('mousemove', handleViewportDragMove)
  window.addEventListener('mouseup', handleMouseUp, { once: true })
  stopViewportPanListeners = () => {
    window.removeEventListener('mousemove', handleViewportDragMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
}

watch(
  [scene, displayScale, viewportWidth, viewportHeight],
  async () => {
    await nextTick()
    requestAnimationFrame(() => {
      syncViewportPanState()
    })
  },
  {
    immediate: true,
  },
)

const getModuleStyle = (module: ModuleSceneItem) => {
  return {
    left: `${module.x}px`,
    top: `${module.y}px`,
    width: `${module.width}px`,
    height: `${module.height}px`,
    '--module-color': module.color,
    '--module-color-soft': hexToRgba(module.color, 0.12),
    '--module-color-strong': hexToRgba(module.color, 0.18),
  }
}

const getModuleChipStyle = (module: ModuleSceneItem) => {
  return {
    '--module-chip-color': module.color,
    '--module-chip-color-soft': hexToRgba(module.color, 0.14),
  }
}

const isModuleHighlighted = (module: ModuleSceneItem) => {
  return !hasModuleSelection.value || module.key === activeModuleKey.value
}

const isNodeHighlighted = (node: NodeSceneItem) => {
  return !hasModuleSelection.value || node.moduleKey === activeModuleKey.value
}

const isEdgeHighlighted = (edge: EdgeSceneItem) => {
  return !hasModuleSelection.value
    || edge.fromModuleKey === activeModuleKey.value
    || edge.toModuleKey === activeModuleKey.value
}

const isEdgeOutgoingFromActiveModule = (edge: EdgeSceneItem) => {
  return hasModuleSelection.value && edge.fromModuleKey === activeModuleKey.value
}

const getModuleClass = (module: ModuleSceneItem) => ({
  'is-active': isModuleHighlighted(module),
  'is-muted': hasModuleSelection.value && !isModuleHighlighted(module),
})

const getNodeClass = (node: NodeSceneItem) => ({
  'is-active': isNodeHighlighted(node),
  'is-muted': hasModuleSelection.value && !isNodeHighlighted(node),
})

const getEdgeClass = (edge: EdgeSceneItem) => ({
  'is-active': isEdgeHighlighted(edge),
  'is-outgoing': isEdgeOutgoingFromActiveModule(edge),
  'is-muted': hasModuleSelection.value && !isEdgeHighlighted(edge),
})

const getEdgeMarker = (edge: EdgeSceneItem) => {
  if (!hasModuleSelection.value) {
    return 'url(#ai-flowchart-arrow)'
  }

  return isEdgeHighlighted(edge)
    ? 'url(#ai-flowchart-arrow-active)'
    : 'url(#ai-flowchart-arrow-muted)'
}

const getEdgePathStyle = (edge: EdgeSceneItem) => {
  const highlightColor = isEdgeOutgoingFromActiveModule(edge)
    ? activeModuleColor.value
    : hexToRgba(activeModuleColor.value, 0.76)

  return {
    '--edge-color': hasModuleSelection.value
      ? (isEdgeHighlighted(edge) ? highlightColor : '#c4d1de')
      : '#70839a',
  }
}

const getNodeStyle = (node: NodeSceneItem) => {
  return {
    left: `${node.x}px`,
    top: `${node.y}px`,
    width: `${node.width}px`,
    height: `${node.height}px`,
    '--node-color': node.color,
    '--node-color-soft': hexToRgba(node.color, 0.14),
  }
}

const getEdgeLabelStyle = (edge: EdgeSceneItem) => {
  const highlightColor = isEdgeOutgoingFromActiveModule(edge)
    ? activeModuleColor.value
    : hexToRgba(activeModuleColor.value, 0.74)

  return {
    left: `${edge.labelX || 0}px`,
    top: `${edge.labelY || 0}px`,
    width: `${edge.labelWidth || 0}px`,
    height: `${edge.labelHeight || 0}px`,
    '--edge-label-color': hasModuleSelection.value
      ? (isEdgeHighlighted(edge) ? highlightColor : '#94a3b5')
      : '#4f6179',
    '--edge-label-border': hasModuleSelection.value
      ? (isEdgeHighlighted(edge) ? hexToRgba(highlightColor, 0.28) : '#e0e8f0')
      : '#d9e3ed',
    '--edge-label-background': hasModuleSelection.value
      ? (isEdgeHighlighted(edge) ? hexToRgba(highlightColor, 0.08) : 'rgba(255, 255, 255, 0.84)')
      : 'rgba(255, 255, 255, 0.96)',
    '--edge-label-shadow': hasModuleSelection.value && isEdgeHighlighted(edge)
      ? `0 10px 18px ${hexToRgba(highlightColor, 0.16)}`
      : '0 6px 14px rgba(36, 50, 73, 0.08)',
  }
}

const focusModule = (moduleId: string) => {
  const currentScene = scene.value
  const viewport = viewportRef.value
  if (!currentScene || !viewport) {
    return
  }

  const nextModuleId = resolveNextFlowchartActiveModuleId(activeModuleId.value, moduleId)
  activeModuleId.value = nextModuleId
  if (!nextModuleId) {
    return
  }

  const targetModule = currentScene.modules.find(module => module.id === nextModuleId)
  if (!targetModule) {
    return
  }

  const nextLeft = targetModule.x * displayScale.value
    - (viewport.clientWidth - targetModule.width * displayScale.value) / 2
  const nextTop = targetModule.y * displayScale.value
    - (viewport.clientHeight - targetModule.height * displayScale.value) / 2

  viewport.scrollTo({
    left: Math.max(0, nextLeft),
    top: Math.max(0, nextTop),
    behavior: 'smooth',
  })
}

onBeforeUnmount(() => {
  renderSerial += 1
  stopViewportPan()
})
</script>

<style scoped lang="scss">
.ai-flowchart {
  display: flex;
  flex-direction: column;
  width: 100%;
  border-radius: 18px;
  border: 1px solid #d7e7f6;
  background:
    linear-gradient(180deg, rgba(246, 251, 255, 0.98), rgba(255, 255, 255, 0.98)),
    radial-gradient(circle at top right, rgba(98, 172, 255, 0.15), transparent 32%),
    linear-gradient(rgba(222, 232, 244, 0.35) 1px, transparent 1px),
    linear-gradient(90deg, rgba(222, 232, 244, 0.35) 1px, transparent 1px);
  background-size: auto, auto, 24px 24px, 24px 24px;
  overflow: hidden;
}

.ai-flowchart.compact {
  max-height: 360px;
}

.ai-flowchart__shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 220px;
  height: 100%;
  overflow: hidden;
}

.ai-flowchart__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 0;
}

.ai-flowchart__toolbar-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #67768c;
}

.ai-flowchart__toolbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-button {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 10px;
  background: #edf4fb;
  color: #29415e;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, opacity 0.18s ease;

  &:hover:not(:disabled) {
    background: #dbe9f8;
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.toolbar-button--ghost {
  width: auto;
  padding: 0 10px;
  font-size: 12px;
}

.toolbar-scale {
  min-width: 42px;
  text-align: right;
  font-size: 12px;
  color: #61758a;
}

.ai-flowchart__viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  padding: 12px 14px 14px;
  user-select: none;

  &.is-pannable {
    cursor: grab;
  }

  &.is-panning {
    cursor: grabbing;
  }
}

.ai-flowchart__module-nav {
  padding: 10px 14px 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.module-nav-chip {
  padding: 6px 12px;
  border: 1px solid #d7e4f2;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #53657b;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    border-color: color-mix(in srgb, var(--module-chip-color, #8cbdf4) 30%, #d7e4f2);
    color: #23446e;
    background: color-mix(in srgb, var(--module-chip-color-soft, rgba(236, 245, 255, 0.98)) 45%, #ffffff);
  }

  &.is-active {
    border-color: color-mix(in srgb, var(--module-chip-color, #8cbdf4) 48%, #ffffff);
    background: color-mix(in srgb, var(--module-chip-color-soft, rgba(236, 245, 255, 0.98)) 68%, #ffffff);
    color: color-mix(in srgb, var(--module-chip-color, #21559f) 72%, #17395b);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--module-chip-color, #8cbdf4) 18%, transparent),
      0 4px 10px rgba(44, 84, 128, 0.08);
  }
}

.ai-flowchart__canvas {
  position: relative;
  margin: 0 auto;
}

.ai-flowchart__scene {
  position: relative;
  pointer-events: none;
}

.ai-flowchart__edges {
  position: absolute;
  inset: 0;
  overflow: visible;
  z-index: 1;
}

.ai-flowchart__edge-path {
  fill: none;
  stroke: var(--edge-color, #70839a);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
  transition: stroke 0.22s ease, stroke-width 0.22s ease, opacity 0.22s ease, filter 0.22s ease;

  &.is-active {
    stroke-width: 2.5;
    filter: drop-shadow(0 2px 5px rgba(73, 118, 171, 0.12));
  }

  &.is-outgoing {
    stroke-width: 2.8;
    filter: drop-shadow(0 3px 7px rgba(73, 118, 171, 0.18));
  }

  &.is-muted {
    opacity: 0.28;
  }
}

.ai-flowchart__module {
  position: absolute;
  z-index: 0;
  border-radius: 22px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 251, 255, 0.92)),
    linear-gradient(135deg, var(--module-color-soft), transparent 48%);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.72),
    0 10px 24px rgba(53, 77, 106, 0.08);
  cursor: pointer;
  transition:
    opacity 0.22s ease,
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease,
    background 0.22s ease;

  &.is-active {
    border-color: color-mix(in srgb, var(--module-color) 18%, rgba(255, 255, 255, 0.8));
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.95)),
      linear-gradient(135deg, color-mix(in srgb, var(--module-color-soft) 140%, transparent), transparent 44%);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.78),
      0 14px 34px rgba(53, 77, 106, 0.12),
      0 0 0 1px color-mix(in srgb, var(--module-color) 10%, transparent);
  }

  &.is-muted {
    opacity: 0.42;
    transform: scale(0.985);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.62),
      0 6px 14px rgba(53, 77, 106, 0.04);
  }
}

.module-accent {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 12px;
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--module-color), var(--module-color-strong));
}

.module-header {
  padding: 24px 18px 0;
}

.module-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.module-title {
  font-size: 15px;
  font-weight: 700;
  color: #213047;
}

.module-count {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(124, 140, 160, 0.18);
  font-size: 12px;
  color: #61758a;
}

.module-description {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #6c7c92;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.ai-flowchart__node {
  position: absolute;
  z-index: 2;
  padding: 14px 14px 12px;
  border-radius: 16px;
  border: 1px solid #dbe7f2;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 1), rgba(250, 252, 255, 0.98)),
    linear-gradient(135deg, var(--node-color-soft), transparent 60%);
  box-shadow:
    0 8px 18px rgba(41, 63, 91, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.72);
  transition:
    opacity 0.22s ease,
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease,
    background 0.22s ease;
}

.ai-flowchart__node::before {
  content: "";
  position: absolute;
  left: 14px;
  right: 14px;
  top: 10px;
  height: 4px;
  border-radius: 999px;
  background: rgba(120, 136, 157, 0.24);
}

.ai-flowchart__node.is-primary {
  border-color: rgba(57, 127, 214, 0.22);
  background:
    linear-gradient(180deg, rgba(243, 250, 255, 1), rgba(255, 255, 255, 0.98)),
    linear-gradient(135deg, var(--node-color-soft), transparent 55%);
}

.ai-flowchart__node.is-primary::before {
  background: linear-gradient(90deg, var(--node-color), rgba(255, 255, 255, 0.9));
}

.ai-flowchart__node.is-active {
  border-color: color-mix(in srgb, var(--node-color) 20%, #dbe7f2);
  box-shadow:
    0 12px 24px rgba(41, 63, 91, 0.12),
    0 0 0 1px color-mix(in srgb, var(--node-color) 12%, transparent),
    inset 0 0 0 1px rgba(255, 255, 255, 0.78);
}

.ai-flowchart__node.is-muted {
  opacity: 0.36;
  transform: scale(0.985);
  box-shadow:
    0 4px 12px rgba(41, 63, 91, 0.04),
    inset 0 0 0 1px rgba(255, 255, 255, 0.62);
}

.ai-flowchart__node.is-placeholder {
  border-style: dashed;
  background:
    linear-gradient(180deg, rgba(250, 253, 255, 1), rgba(255, 255, 255, 0.98)),
    linear-gradient(135deg, rgba(124, 144, 166, 0.12), transparent 55%);
}

.node-badges {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.node-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(65, 129, 212, 0.12);
  color: #275489;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 600;
}

.node-badge--muted {
  background: rgba(112, 131, 154, 0.14);
  color: #5f7186;
}

.node-title {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.45;
  color: #223148;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.node-description {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #6d7d93;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.ai-flowchart__edge-label {
  position: absolute;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--edge-label-border, #d9e3ed);
  background: var(--edge-label-background, rgba(255, 255, 255, 0.96));
  box-shadow: var(--edge-label-shadow, 0 6px 14px rgba(36, 50, 73, 0.08));
  font-size: 12px;
  color: var(--edge-label-color, #4f6179);
  line-height: 1.25;
  text-align: center;
  white-space: normal;
  word-break: break-word;
  transition:
    opacity 0.22s ease,
    color 0.22s ease,
    border-color 0.22s ease,
    background 0.22s ease,
    box-shadow 0.22s ease;

  &.is-active {
    font-weight: 600;
  }

  &.is-muted {
    opacity: 0.32;
  }
}

.ai-flowchart__state {
  min-height: 220px;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.ai-flowchart__state--error {
  color: #b42318;
}

.state-title {
  font-size: 15px;
  font-weight: 700;
  color: inherit;
}

.state-text {
  font-size: 13px;
  line-height: 1.6;
  color: #5b6472;
}

.ai-flowchart__state--error .state-text {
  color: inherit;
}

.ai-flowchart.compact {
  .ai-flowchart__toolbar {
    padding: 10px 12px 0;
  }

  .ai-flowchart__viewport {
    padding: 10px 12px 12px;
  }

  .module-header {
    padding: 22px 16px 0;
  }

  .module-title {
    font-size: 14px;
  }

  .module-count {
    padding: 3px 8px;
    font-size: 11px;
  }

  .ai-flowchart__node {
    padding: 12px 12px 10px;
    border-radius: 15px;
  }

  .node-title {
    font-size: 13px;
  }

  .node-description,
  .ai-flowchart__edge-label,
  .ai-flowchart__toolbar-meta,
  .toolbar-scale {
    font-size: 11px;
  }
}
</style>
