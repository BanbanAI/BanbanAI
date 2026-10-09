<template>
  <div :class="['flow-plan-preview', `is-${mode}`]">
    <section class="flow-plan-preview__hero">
      <div class="flow-plan-preview__hero-copy">
        <div v-if="mode === 'embedded'" class="flow-plan-preview__eyebrow">{{ displayTitle }}</div>
        <div class="flow-plan-preview__title-row">
          <h3 class="flow-plan-preview__title">
            {{ mode === 'artifact' ? displayTitle : (flowPlan?.title || $t('nocodeEditorAiFlowPlanPreview.workflowBlueprint')) }}
          </h3>
          <span
            v-if="mode === 'embedded' && flowPlan?.target?.formName"
            class="flow-plan-preview__hero-pill"
          >
            {{ flowPlan.target.formName }}
          </span>
        </div>
        <p v-if="displaySummary" class="flow-plan-preview__summary">{{ displaySummary }}</p>
      </div>

      <el-button
        v-if="showApplyButton"
        type="primary"
        :loading="applying"
        @click="emit('apply-flow')"
      >{{ $t('nocodeEditorAiFlowPlanPreview.generateFormWorkflowFromBlueprint') }}</el-button>
    </section>

    <section class="flow-plan-preview__meta-grid">
      <article
        v-for="item in metaCards"
        :key="item.label"
        class="flow-plan-preview__meta-card"
      >
        <div class="flow-plan-preview__meta-label">{{ item.label }}</div>
        <div class="flow-plan-preview__meta-value">{{ item.value }}</div>
      </article>
    </section>

    <section
      v-if="detailTabs.length"
      class="flow-plan-preview__tab-bar"
      role="tablist"
      :aria-label="$t('nocodeEditorAiFlowPlanPreview.workflowTriggerBranchSwitch')"
    >
      <button
        v-for="tab in detailTabs"
        :key="tab.key"
        type="button"
        class="flow-plan-preview__tab"
        :class="{ 'is-active': resolvedActiveScopeKey === tab.key }"
        :aria-selected="resolvedActiveScopeKey === tab.key"
        @click="setActiveScopeKey(tab.key)"
      >
        {{ tab.label }}
      </button>
    </section>

    <section v-if="applySummaryText" class="flow-plan-preview__status-strip is-success">
      <div class="flow-plan-preview__status-strip-icon">
        <el-icon><i-ep-success-filled /></el-icon>
      </div>
      <div class="flow-plan-preview__status-strip-body">
        <div class="flow-plan-preview__status-strip-title">{{ $t('nocodeEditorAiFlowPlanPreview.latestGeneration') }}</div>
        <p class="flow-plan-preview__status-strip-text">{{ applySummaryText }}</p>
      </div>
    </section>

    <section v-if="showOverviewCards || currentScopeNodeViewModels.length" class="flow-plan-preview__section">
      <div class="flow-plan-preview__section-head">
        <div>
          <h4 class="flow-plan-preview__section-title">{{ sectionTitle }}</h4>
          <p class="flow-plan-preview__section-caption">{{ sectionCaption }}</p>
        </div>
      </div>

      <div
        v-if="showOverviewCards"
        class="flow-plan-preview__trigger-branch-grid"
      >
        <article
          v-for="branch in triggerBranchViewModels"
          :key="branch.key"
          class="flow-plan-preview__trigger-branch-card"
        >
          <div class="flow-plan-preview__trigger-branch-head">
            <div class="flow-plan-preview__trigger-branch-title-block">
              <div class="flow-plan-preview__trigger-branch-title">{{ branch.label }}</div>
              <p class="flow-plan-preview__trigger-branch-summary">{{ branch.triggerNode.summary || $t('nocodeEditorAiFlowPlanPreview.triggerBranchReady') }}</p>
            </div>
            <div class="flow-plan-preview__trigger-branch-tags">
              <span class="flow-plan-preview__tag is-category is-trigger">{{ $t('nocodeEditorAiFlowPlanPreview.triggerBranch') }}</span>
              <span class="flow-plan-preview__tag is-type">{{ branch.triggerNode.typeLabel }}</span>
            </div>
          </div>

          <div class="flow-plan-preview__trigger-branch-meta">
            <span class="flow-plan-preview__meta-chip">{{ $t('nocodeEditorAiFlowPlanPreview.followingNodesCount', { count: branch.nodeCount }) }}</span>
            <span class="flow-plan-preview__meta-chip">{{ $t('nocodeEditorAiFlowPlanPreview.internalNodesCount', { count: branch.totalNodeCount }) }}</span>
            <span class="flow-plan-preview__meta-chip">{{ $t('nocodeEditorAiFlowPlanPreview.internalBranchesCount', { count: branch.branchCount }) }}</span>
          </div>
        </article>
      </div>

      <div v-else class="flow-plan-preview__diagram">
        <div class="flow-plan-preview__diagram-surface">
          <FlowPlanNodeTree
            v-for="(node, index) in currentScopeNodeViewModels"
            :key="node.key"
            :node="node"
            :depth="0"
            :is-last="index === currentScopeNodeViewModels.length - 1"
          />

          <div class="flow-plan-preview__diagram-end">
            <span class="flow-plan-preview__diagram-end-dot"></span>
            <span class="flow-plan-preview__diagram-end-label">{{ $t('nocodeEditorAiFlowPlanPreview.workflowEndpointAutoCompleted') }}</span>
          </div>
        </div>
      </div>
    </section>

    <div
      v-if="visibleQuestions.length || visibleWarnings.length"
      class="flow-plan-preview__status-grid"
    >
      <section v-if="visibleQuestions.length" class="flow-plan-preview__status-card is-question">
        <div class="flow-plan-preview__status-card-head">
          <el-icon><i-ep-info-filled /></el-icon>
          <div class="flow-plan-preview__status-title">{{ $t('nocodeEditorAiFlowPlanPreview.pendingConfirmationItems') }}</div>
        </div>
        <ul class="flow-plan-preview__status-list">
          <li v-for="question in visibleQuestions" :key="question">{{ question }}</li>
        </ul>
      </section>

      <section v-if="visibleWarnings.length" class="flow-plan-preview__status-card is-warning">
        <div class="flow-plan-preview__status-card-head">
          <el-icon><i-ep-warning-filled /></el-icon>
          <div class="flow-plan-preview__status-title">{{ mode === 'embedded' ? $t('nocodeEditorAiFlowPlanPreview.afterApplyTips') : $t('nocodeEditorAiFlowPlanPreview.applyTips') }}</div>
        </div>
        <ul class="flow-plan-preview__status-list">
          <li v-for="warning in visibleWarnings" :key="warning">{{ warning }}</li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref, resolveDynamicComponent, watch, type PropType } from 'vue'
import i18next from 'i18next'
import type { AiAssistantArtifactBlock, AiAssistantFlowPlanArtifactBlock } from '@common/types/ai'
import {
  DataChangeType,
  EditDataTargetScope,
  OperationTriggerMode,
  OwnerEmptyHandle,
  ProcessNodeOwnerType,
  TargetFieldFillType,
  TimeTaskDatePoint,
  TimeTaskDateType,
  TimeTaskMethod,
  TimeTaskRepeat,
  TriggerMode,
} from '@common/types/project'
import {
  NOCODE_EDITOR_FLOW_PLAN_NODE_CATEGORY_MAP,
  NOCODE_EDITOR_FLOW_PLAN_NODE_LABEL_MAP,
  countNocodeEditorFlowPlanBranches,
  countNocodeEditorFlowPlanNodes,
  countNocodeEditorFlowPlanTotalNodes,
  normalizeNocodeEditorFlowPlan,
  resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles,
  type NocodeEditorFlowPlanBranch,
  type NocodeEditorFlowPlanNode,
  type NocodeEditorFlowPlanTriggerBranch,
} from '@common/utils/nocodeEditorFlowPlan'

type FlowPreviewMode = 'artifact' | 'embedded'
type FlowPreviewTone = 'trigger' | 'human' | 'cross-table' | 'branch'
type FlowPreviewScopeKey = 'overview' | `trigger-branch:${string}`

type FlowNodeType = NocodeEditorFlowPlanNode['type']

type FlowBranchViewModel = {
  key: string
  label: string
  modeLabel: string
  summary: string
  laneNote: string
  nodes: FlowNodeViewModel[]
}

type FlowNodeViewModel = {
  key: string
  stepLabel: string
  title: string
  typeKey: FlowNodeType
  typeLabel: string
  categoryLabel: string
  tone: FlowPreviewTone
  iconName: string
  summary: string
  meta: string[]
  branches: FlowBranchViewModel[]
}

type FlowTriggerBranchViewModel = {
  key: string
  label: string
  triggerNode: FlowNodeViewModel
  timelineNodes: FlowNodeViewModel[]
  nodeCount: number
  totalNodeCount: number
  branchCount: number
}

type FlowDetailTab = {
  key: FlowPreviewScopeKey
  label: string
}

const OVERVIEW_SCOPE_KEY = 'overview' as const

const CATEGORY_LABEL_MAP: Record<FlowPreviewTone, string> = {
  get trigger() { return i18next.t('nocodeEditorAiFlowPlanPreview.triggerNode') },
  get human() { return i18next.t('nocodeEditorAiFlowPlanPreview.humanNode') },
  get 'cross-table'() { return i18next.t('nocodeEditorAiFlowPlanPreview.crossTableAction') },
  get branch() { return i18next.t('nocodeEditorAiFlowPlanPreview.branchNode') },
}

const FLOW_NODE_ICON_MAP: Record<FlowNodeType, string> = {
  'trigger-data-change': 'i-nocode-process-flow-data-change',
  'trigger-time-task': 'i-nocode-flow-timer-task',
  'trigger-operation': 'i-ep-operation',
  approval: 'i-nocode-process-flow-approval',
  transact: 'i-nocode-process-flow-transact',
  notify: 'i-nocode-process-flow-notify',
  'report-data': 'i-nocode-flow-data-filling',
  'add-data': 'i-nocode-flow-add-data',
  'edit-data': 'i-nocode-flow-edit-data',
  'delete-data': 'i-nocode-flow-delete-data',
  'condition-branch': 'i-nocode-flow-condition-branch',
  'parallel-branch': 'i-nocode-flow-parallel-branch',
}

const FLOW_NODE_LABEL_MAP: Record<FlowNodeType, string> = {
  get 'trigger-data-change'() { return i18next.t('nocodeEditorAiFlowPlanPreview.dataChangeTrigger') },
  get 'trigger-time-task'() { return i18next.t('nocodeEditorAiFlowPlanPreview.scheduledTriggerNode') },
  get 'trigger-operation'() { return i18next.t('nocodeEditorAiFlowPlanPreview.operationTriggerNode') },
  get approval() { return i18next.t('nocodeEditorAiFlowPlanPreview.approvalNode') },
  get transact() { return i18next.t('nocodeEditorAiFlowPlanPreview.transactionNode') },
  get notify() { return i18next.t('nocodeEditorAiFlowPlanPreview.notificationNode') },
  get 'report-data'() { return i18next.t('nocodeEditorAiFlowPlanPreview.dataEntryNode') },
  get 'add-data'() { return i18next.t('nocodeEditorAiFlowPlanPreview.addDataNode') },
  get 'edit-data'() { return i18next.t('nocodeEditorAiFlowPlanPreview.editDataNode') },
  get 'delete-data'() { return i18next.t('nocodeEditorAiFlowPlanPreview.deleteDataNode') },
  get 'condition-branch'() { return i18next.t('nocodeEditorAiFlowPlanPreview.conditionBranchNode') },
  get 'parallel-branch'() { return i18next.t('nocodeEditorAiFlowPlanPreview.parallelBranchNode') },
}

const DATA_CHANGE_LABEL_MAP: Record<DataChangeType, string> = {
  get add() { return i18next.t('nocodeEditorAiFlowPlanPreview.dataChangeAdd') },
  get edit() { return i18next.t('nocodeEditorAiFlowPlanPreview.dataChangeEdit') },
  get delete() { return i18next.t('nocodeEditorAiFlowPlanPreview.dataChangeDelete') },
}

const TRIGGER_MODE_LABEL_MAP: Record<string, string> = {
  get [TriggerMode.MULTI]() { return i18next.t('nocodeEditorAiFlowPlanPreview.multiRecordTrigger') },
  get [TriggerMode.SINGLE]() { return i18next.t('nocodeEditorAiFlowPlanPreview.singleRecordTrigger') },
}

const TIME_TASK_METHOD_LABEL_MAP: Record<string, string> = {
  get [TimeTaskMethod.BASIC_TASK]() { return i18next.t('nocodeEditorAiFlowPlanPreview.basicSchedule') },
  get [TimeTaskMethod.ADVANCED_TASK]() { return i18next.t('nocodeEditorAiFlowPlanPreview.advancedSchedule') },
}

const TIME_TASK_REPEAT_LABEL_MAP: Record<string, string> = {
  get [TimeTaskRepeat.ONECE]() { return i18next.t('nocodeEditorAiFlowPlanPreview.once') },
  get [TimeTaskRepeat.EVERY_DAY]() { return i18next.t('nocodeEditorAiFlowPlanPreview.daily') },
  get [TimeTaskRepeat.EVERY_WEEK]() { return i18next.t('nocodeEditorAiFlowPlanPreview.weekly') },
  get [TimeTaskRepeat.EVERY_TWO_WEEKS]() { return i18next.t('nocodeEditorAiFlowPlanPreview.biweekly') },
  get [TimeTaskRepeat.EVERY_MONTH]() { return i18next.t('nocodeEditorAiFlowPlanPreview.monthly') },
  get [TimeTaskRepeat.EVERY_QUARTER]() { return i18next.t('nocodeEditorAiFlowPlanPreview.quarterly') },
  get [TimeTaskRepeat.EVERY_YEAR]() { return i18next.t('nocodeEditorAiFlowPlanPreview.yearly') },
  get [TimeTaskRepeat.EVERY_WORK_DAY]() { return i18next.t('nocodeEditorAiFlowPlanPreview.statutoryWorkdays') },
  get [TimeTaskRepeat.EVERY_HOLIDAY]() { return i18next.t('nocodeEditorAiFlowPlanPreview.statutoryHolidays') },
  get [TimeTaskRepeat.EVERY_WORK_DAY_OF_WEEK]() { return i18next.t('nocodeEditorAiFlowPlanPreview.weekdays') },
}

const OPERATION_TRIGGER_LABEL_MAP: Record<string, string> = {
  get [OperationTriggerMode.EACH_RECORD]() { return i18next.t('nocodeEditorAiFlowPlanPreview.perRecordTrigger') },
  get [OperationTriggerMode.VIEW_CONTEXT_ONCE]() { return i18next.t('nocodeEditorAiFlowPlanPreview.viewContextOnceTrigger') },
}

const APPROVER_TYPE_LABEL_MAP: Record<string, string> = {
  get and() { return i18next.t('nocodeEditorAiFlowPlanPreview.jointApproval') },
  get or() { return i18next.t('nocodeEditorAiFlowPlanPreview.orApproval') },
  get sequential() { return i18next.t('nocodeEditorAiFlowPlanPreview.sequentialApproval') },
}

const OWNER_EMPTY_LABEL_MAP: Record<string, string> = {
  get [OwnerEmptyHandle.AUTO_APPROVE]() { return i18next.t('nocodeEditorAiFlowPlanPreview.autoApproveWhenEmpty') },
  get [OwnerEmptyHandle.ASSIGNEE]() { return i18next.t('nocodeEditorAiFlowPlanPreview.assignWhenEmpty') },
  get [OwnerEmptyHandle.ADMIN]() { return i18next.t('nocodeEditorAiFlowPlanPreview.adminWhenEmpty') },
}

const EDIT_SCOPE_LABEL_MAP: Record<string, string> = {
  get [EditDataTargetScope.CURRENT]() { return i18next.t('nocodeEditorAiFlowPlanPreview.currentRecordOnly') },
  get [EditDataTargetScope.HISTORY]() { return i18next.t('nocodeEditorAiFlowPlanPreview.historicalRecords') },
}

const TARGET_FIELD_FILL_LABEL_MAP: Record<string, string> = {
  get [TargetFieldFillType.FIELD]() { return i18next.t('nocodeEditorAiFlowPlanPreview.fieldMapping') },
  get [TargetFieldFillType.CUSTOM]() { return i18next.t('nocodeEditorAiFlowPlanPreview.fixedValue') },
  get [TargetFieldFillType.EMPTY]() { return i18next.t('nocodeEditorAiFlowPlanPreview.clearValue') },
  get [TargetFieldFillType.DEFAULT]() { return i18next.t('nocodeEditorAiFlowPlanPreview.defaultValue') },
  get [TargetFieldFillType.FORMULA]() { return i18next.t('nocodeEditorAiFlowPlanPreview.formula') },
  get [TargetFieldFillType.AUTO_RELATED]() { return i18next.t('nocodeEditorAiFlowPlanPreview.autoLink') },
}

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  block?: AiAssistantFlowPlanArtifactBlock | null
  mode?: FlowPreviewMode
  embeddedTitle?: string
  canApply?: boolean
  applying?: boolean
  activeScopeKey?: string
}>(), {
  mode: 'artifact',
  embeddedTitle: '',
  canApply: false,
  applying: false,
  activeScopeKey: '',
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'apply-flow'): void
  (event: 'update:activeScopeKey', value: string): void
}>()

const flowPlan = computed(() => normalizeNocodeEditorFlowPlan(props.block?.flowPlan))
const localActiveScopeKey = ref<string>('')

const normalizeText = (value: unknown) => String(value ?? '').trim()

const asRecord = (value: unknown) => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {}
)

const asArray = <T = unknown,>(value: unknown) => (
  Array.isArray(value) ? value as T[] : []
)

const resolveCountUnit = (unit: 'person' | 'role') => (
  unit === 'person'
    ? i18next.t('nocodeEditorAiFlowPlanPreview.personUnit')
    : i18next.t('nocodeEditorAiFlowPlanPreview.roleUnit')
)

const toLocalizedCountText = (count: number, unit: 'person' | 'role') => (
  count > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.countWithUnit', { count, unit: resolveCountUnit(unit) }) : ''
)

const resolveOptionLabel = (
  value: unknown,
  labelMap: Record<string, string>,
  fallback = '',
) => {
  const normalized = normalizeText(value)
  return labelMap[normalized] || normalized || fallback
}

const resolveTableLabel = (value: unknown) => {
  if (typeof value === 'string') {
    return normalizeText(value)
  }

  const record = asRecord(value)
  return normalizeText(
    record.alias
    || record.name
    || record.formName
    || record.tableName
    || record.label
    || record.formId
    || record.tableUID
    || record.tableId
    || record.uid
    || record.id,
  )
}

const resolveDateRefLabel = (value: unknown) => {
  const record = asRecord(value)
  const type = resolveOptionLabel(record.type, {
    get [TimeTaskDateType.FIELD]() { return i18next.t('nocodeEditorAiFlowPlanPreview.fieldDate') },
    get [TimeTaskDateType.CUSTOM]() { return i18next.t('nocodeEditorAiFlowPlanPreview.customDate') },
    get [TimeTaskDateType.NONE]() { return i18next.t('nocodeEditorAiFlowPlanPreview.noEndLimit') },
  })
  const target = normalizeText(record.value)
  return [type, target].filter(Boolean).join(' · ')
}

const resolveTimePointLabel = (value: unknown) => {
  const record = asRecord(value)
  const point = resolveOptionLabel(record.type, {
    get [TimeTaskDatePoint.BEFORE]() { return i18next.t('nocodeEditorAiFlowPlanPreview.before') },
    get [TimeTaskDatePoint.TODAY]() { return i18next.t('nocodeEditorAiFlowPlanPreview.sameDay') },
    get [TimeTaskDatePoint.AFTER]() { return i18next.t('nocodeEditorAiFlowPlanPreview.after') },
  })
  const offset = Number(record.value || 0)
  if (!point) {
    return ''
  }
  if (record.type === TimeTaskDatePoint.TODAY) {
    return point
  }
  return i18next.t('nocodeEditorAiFlowPlanPreview.relativeDays', { point, count: offset })
}

const countConditionGroups = (value: unknown) => (
  asArray<unknown[]>(value).filter(group => Array.isArray(group) && group.length > 0).length
)

const countFilterConditions = (value: unknown) => (
  asArray(asRecord(value).conditions).length
)

const resolveSourceTablesSummary = (value: unknown) => {
  const sourceTables = asArray(value)
    .map(item => resolveTableLabel(item))
    .filter(Boolean)
  if (!sourceTables.length) {
    return ''
  }

  const preview = sourceTables.slice(0, 2).join(i18next.t('nocodeEditorAiFlowPlanPreview.listSeparator'))
  return sourceTables.length > 2
    ? i18next.t('nocodeEditorAiFlowPlanPreview.tablesAndMore', { preview, count: sourceTables.length })
    : preview
}

const resolveOwnerSummary = (value: unknown) => {
  const owner = asRecord(value)
  const labels: string[] = []

  if (owner[ProcessNodeOwnerType.SUBMITTER]) {
    labels.push(i18next.t('nocodeEditorAiFlowPlanPreview.submitter'))
  }

  const assignee = asRecord(owner[ProcessNodeOwnerType.ASSIGNEE])
  const assigneeUsers = asArray<string>(assignee.users).filter(Boolean).length
  const assigneeRoles = asArray<string>(assignee.roles).filter(Boolean).length
  if (assigneeUsers || assigneeRoles) {
    labels.push(i18next.t('nocodeEditorAiFlowPlanPreview.assignedMembersOrRoles', {
      details: [
        toLocalizedCountText(assigneeUsers, 'person'),
        toLocalizedCountText(assigneeRoles, 'role'),
      ].filter(Boolean).join(i18next.t('nocodeEditorAiFlowPlanPreview.listSeparator')),
    }))
  }

  const departmentManager = asRecord(owner[ProcessNodeOwnerType.DEPARTMENT_MANAGER])
  if (departmentManager.value) {
    labels.push(i18next.t('nocodeEditorAiFlowPlanPreview.departmentManagerLevels', {
      direction: departmentManager.mode === 'down' ? i18next.t('nocodeEditorAiFlowPlanPreview.downward') : i18next.t('nocodeEditorAiFlowPlanPreview.upward'),
      count: departmentManager.value,
    }))
  }

  const formMemberCount = asArray<string>(owner[ProcessNodeOwnerType.FORM_MEMBER]).filter(Boolean).length
  if (formMemberCount > 0) {
    labels.push(i18next.t('nocodeEditorAiFlowPlanPreview.formMemberFields', { count: formMemberCount }))
  }

  const formDepartment = asRecord(owner[ProcessNodeOwnerType.FORM_DEPARTMENT])
  if (formDepartment.value) {
    labels.push(i18next.t('nocodeEditorAiFlowPlanPreview.formDepartmentField'))
  }

  const multiLevelManager = asRecord(owner[ProcessNodeOwnerType.MULTI_LEVEL_DEPARTMENT_MANAGER])
  if (multiLevelManager.value) {
    labels.push(i18next.t('nocodeEditorAiFlowPlanPreview.multiLevelDepartmentManager', {
      direction: multiLevelManager.mode === 'down' ? i18next.t('nocodeEditorAiFlowPlanPreview.downward') : i18next.t('nocodeEditorAiFlowPlanPreview.upward'),
      count: multiLevelManager.value,
    }))
  }

  return labels.join(i18next.t('nocodeEditorAiFlowPlanPreview.listSeparator'))
}

const buildNodeDetails = (node: NocodeEditorFlowPlanNode) => {
  const options = asRecord(node.options)

  if (node.type === 'trigger-data-change') {
    const changeTypes = asArray<DataChangeType>(options.changeType)
      .map(item => DATA_CHANGE_LABEL_MAP[item] || normalizeText(item))
      .filter(Boolean)
    const changeText = changeTypes.length ? changeTypes.join(i18next.t('nocodeEditorAiFlowPlanPreview.listSeparator')) : i18next.t('nocodeEditorAiFlowPlanPreview.dataChange')
    const sourceText = resolveSourceTablesSummary(options.sourceTables)
    const conditionCount = countConditionGroups(options.conditions)
    return {
      summary: sourceText
        ? i18next.t('nocodeEditorAiFlowPlanPreview.listenSourceDataChange', { source: sourceText, change: changeText })
        : i18next.t('nocodeEditorAiFlowPlanPreview.listenCurrentFormDataChange', { change: changeText }),
      meta: [
        changeTypes.length ? i18next.t('nocodeEditorAiFlowPlanPreview.changeTypesMeta', { types: changeTypes.join(i18next.t('nocodeEditorAiFlowPlanPreview.listSeparator')) }) : '',
        typeof options.enableTriggerConditions === 'boolean'
          ? (options.enableTriggerConditions ? i18next.t('nocodeEditorAiFlowPlanPreview.triggerConditionsEnabled') : i18next.t('nocodeEditorAiFlowPlanPreview.triggerConditionsDisabled'))
          : '',
        conditionCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.triggerConditionGroups', { count: conditionCount }) : '',
      ],
    }
  }

  if (node.type === 'trigger-time-task') {
    const triggerMode = resolveOptionLabel(options.triggerMode, TRIGGER_MODE_LABEL_MAP)
    const repeat = resolveOptionLabel(options.repeat, TIME_TASK_REPEAT_LABEL_MAP)
    const method = resolveOptionLabel(options.method, TIME_TASK_METHOD_LABEL_MAP)
    const conditionCount = countConditionGroups(options.conditions)
    return {
      summary: [repeat, triggerMode || method || i18next.t('nocodeEditorAiFlowPlanPreview.scheduledTrigger')].filter(Boolean).join(' · '),
      meta: [
        method ? i18next.t('nocodeEditorAiFlowPlanPreview.modeMeta', { value: method }) : '',
        normalizeText(options.triggerDate) ? i18next.t('nocodeEditorAiFlowPlanPreview.dateMeta', { value: normalizeText(options.triggerDate) }) : '',
        normalizeText(options.triggerTime) ? i18next.t('nocodeEditorAiFlowPlanPreview.timeMeta', { value: normalizeText(options.triggerTime) }) : '',
        resolveDateRefLabel(options.startDate) ? i18next.t('nocodeEditorAiFlowPlanPreview.startMeta', { value: resolveDateRefLabel(options.startDate) }) : '',
        resolveDateRefLabel(options.endDate) ? i18next.t('nocodeEditorAiFlowPlanPreview.endMeta', { value: resolveDateRefLabel(options.endDate) }) : '',
        resolveTimePointLabel(options.triggerTimePoint) ? i18next.t('nocodeEditorAiFlowPlanPreview.timePointMeta', { value: resolveTimePointLabel(options.triggerTimePoint) }) : '',
        conditionCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.triggerConditionGroups', { count: conditionCount }) : '',
      ],
    }
  }

  if (node.type === 'trigger-operation') {
    const mode = resolveOptionLabel(
      options.triggerMode || (options.allowViewContextOnce ? OperationTriggerMode.VIEW_CONTEXT_ONCE : OperationTriggerMode.EACH_RECORD),
      OPERATION_TRIGGER_LABEL_MAP,
      i18next.t('nocodeEditorAiFlowPlanPreview.manualOperationTrigger'),
    )
    return {
      summary: i18next.t('nocodeEditorAiFlowPlanPreview.triggerAfterUserOperation'),
      meta: [
        mode,
        options.allowViewContextOnce ? i18next.t('nocodeEditorAiFlowPlanPreview.allowViewContextTrigger') : '',
      ],
    }
  }

  if (node.type === 'approval') {
    const owner = resolveOwnerSummary(options.approver)
    return {
      summary: owner ? i18next.t('nocodeEditorAiFlowPlanPreview.continueAfterApprovalByOwner', {
        owner,
        interpolation: { escapeValue: false },
      }) : i18next.t('nocodeEditorAiFlowPlanPreview.waitForApproval'),
      meta: [
        resolveOptionLabel(options.approverType, APPROVER_TYPE_LABEL_MAP),
        resolveOptionLabel(options.approverEmpty, OWNER_EMPTY_LABEL_MAP),
        options.allowTransfer ? i18next.t('nocodeEditorAiFlowPlanPreview.allowTransfer') : '',
        options.allowReject ? i18next.t('nocodeEditorAiFlowPlanPreview.allowReject') : '',
        options.allowRevert ? i18next.t('nocodeEditorAiFlowPlanPreview.allowRevert') : '',
        options.continueAfterReject ? i18next.t('nocodeEditorAiFlowPlanPreview.continueAfterReject') : '',
        asArray(options.rejectSkipNodeIds).length ? i18next.t('nocodeEditorAiFlowPlanPreview.rejectSkipNodes', { count: asArray(options.rejectSkipNodeIds).length }) : '',
        asArray(options.revertRange).length ? i18next.t('nocodeEditorAiFlowPlanPreview.revertRangeNodes', { count: asArray(options.revertRange).length }) : '',
      ],
    }
  }

  if (node.type === 'transact') {
    const owner = resolveOwnerSummary(options.transactor)
    const finishConditionCount = countConditionGroups(asRecord(options.finishCondition).conditions)
    const finishSourceText = resolveSourceTablesSummary(asRecord(options.finishCondition).sourceTables)
    return {
      summary: owner ? i18next.t('nocodeEditorAiFlowPlanPreview.continueAfterTransactionByOwner', {
        owner,
        interpolation: { escapeValue: false },
      }) : i18next.t('nocodeEditorAiFlowPlanPreview.waitForTransaction'),
      meta: [
        resolveOptionLabel(options.transactorType, APPROVER_TYPE_LABEL_MAP),
        resolveOptionLabel(options.transactorEmpty, OWNER_EMPTY_LABEL_MAP),
        options.allowTransfer ? i18next.t('nocodeEditorAiFlowPlanPreview.allowTransfer') : '',
        options.requireSatisfyCondition ? i18next.t('nocodeEditorAiFlowPlanPreview.requireFinishCondition') : '',
        finishConditionCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.finishConditionGroups', { count: finishConditionCount }) : '',
        finishSourceText ? i18next.t('nocodeEditorAiFlowPlanPreview.finishConditionSourceMeta', { source: finishSourceText }) : '',
      ],
    }
  }

  if (node.type === 'notify') {
    const owner = resolveOwnerSummary(options.notifier)
    return {
      summary: owner ? i18next.t('nocodeEditorAiFlowPlanPreview.sendNotificationToOwner', {
        owner,
        interpolation: { escapeValue: false },
      }) : i18next.t('nocodeEditorAiFlowPlanPreview.sendNotification'),
      meta: [],
    }
  }

  if (node.type === 'report-data') {
    const targetTable = resolveTableLabel({
      tableUID: options.targetTableUID,
      tableName: options.targetTableName,
      tableId: options.targetTableId,
    })
    const owner = resolveOwnerSummary(options.reporter)
    const finishConditionCount = countConditionGroups(asRecord(options.finishCondition).conditions)
    return {
      summary: targetTable
        ? i18next.t('nocodeEditorAiFlowPlanPreview.continueAfterReportData', { table: targetTable })
        : (owner ? i18next.t('nocodeEditorAiFlowPlanPreview.continueAfterReportByOwner', {
          owner,
          interpolation: { escapeValue: false },
        }) : i18next.t('nocodeEditorAiFlowPlanPreview.waitForReportData')),
      meta: [
        owner ? i18next.t('nocodeEditorAiFlowPlanPreview.reporterMeta', {
          owner,
          interpolation: { escapeValue: false },
        }) : '',
        options.allowTransfer ? i18next.t('nocodeEditorAiFlowPlanPreview.allowTransfer') : '',
        options.requireSatisfyCondition ? i18next.t('nocodeEditorAiFlowPlanPreview.requireFinishCondition') : '',
        finishConditionCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.finishConditionGroups', { count: finishConditionCount }) : '',
      ],
    }
  }

  if (node.type === 'add-data' || node.type === 'edit-data' || node.type === 'delete-data') {
    const targetTable = resolveTableLabel(options.target)
      || resolveTableLabel(options.targetForm)
      || resolveTableLabel({
        tableUID: options.targetTableUID,
        tableName: options.targetTableName,
        tableId: options.targetTableId,
      })
      || i18next.t('nocodeEditorAiFlowPlanPreview.targetForm')
    const sourceText = resolveSourceTablesSummary(options.sourceTables)
    const mappingCount = asArray(options.targetFields).length
    const batchFieldCount = asArray(options.batchFields).length
    const filterCount = countFilterConditions(options.targetTableFilterRule)
    const primarySource = resolveTableLabel(options.primarySourceTable)
    const batchNumberType = resolveOptionLabel(asRecord(options.batchNumber).type, TARGET_FIELD_FILL_LABEL_MAP)
    const actionText = node.type === 'delete-data'
      ? i18next.t('nocodeEditorAiFlowPlanPreview.deleteData')
      : node.type === 'edit-data'
        ? i18next.t('nocodeEditorAiFlowPlanPreview.updateData')
        : i18next.t('nocodeEditorAiFlowPlanPreview.addData')
    return {
      summary: i18next.t('nocodeEditorAiFlowPlanPreview.applyDataActionToTable', { table: targetTable, action: actionText }),
      meta: [
        sourceText ? i18next.t('nocodeEditorAiFlowPlanPreview.sourceMeta', { source: sourceText }) : '',
        primarySource ? i18next.t('nocodeEditorAiFlowPlanPreview.primarySourceMeta', { source: primarySource }) : '',
        mappingCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.fieldMappingItems', { count: mappingCount }) : '',
        options.batchEnabled ? i18next.t('nocodeEditorAiFlowPlanPreview.batchEnabled') : '',
        batchFieldCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.batchFieldItems', { count: batchFieldCount }) : '',
        batchNumberType ? i18next.t('nocodeEditorAiFlowPlanPreview.batchQuantityMeta', { value: batchNumberType }) : '',
        filterCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.targetFilterRules', { count: filterCount }) : '',
        resolveOptionLabel(options.targetTableDataScope, EDIT_SCOPE_LABEL_MAP) || '',
      ],
    }
  }

  if (node.type === 'condition-branch' || node.type === 'parallel-branch') {
    const branchCount = asArray<NocodeEditorFlowPlanBranch>(node.branches).length
    // const branchConditionCount = asArray<NocodeEditorFlowPlanBranch>(node.branches)
    // .reduce((total, branch) => total + countConditionGroups(branch.conditions), 0)
    return {
      summary: node.type === 'condition-branch'
        ? i18next.t('nocodeEditorAiFlowPlanPreview.splitToConditionPaths', { count: branchCount })
        : i18next.t('nocodeEditorAiFlowPlanPreview.expandParallelPaths', { count: branchCount }),
      meta: [
        // node.type === 'condition-branch' && branchConditionCount > 0
        //   ? `分支条件 ${branchConditionCount} 组`
        //   : '',
        branchCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.branchCountMeta', { count: branchCount }) : '',
      ],
    }
  }

  return {
    summary: '',
    meta: [],
  }
}

const buildBranchSummary = (
  nodeType: FlowNodeType,
  branch: NocodeEditorFlowPlanBranch,
) => {
  const conditionCount = countConditionGroups(branch.conditions)
  if (nodeType === 'condition-branch') {
    return {
      summary: conditionCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.enterAfterConditionGroups', { count: conditionCount }) : i18next.t('nocodeEditorAiFlowPlanPreview.enterWhenNoConditionMatched'),
      laneNote: conditionCount > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.conditionGroups', { count: conditionCount }) : i18next.t('nocodeEditorAiFlowPlanPreview.defaultFallback'),
    }
  }

  return {
    summary: branch.nodes.length > 0 ? i18next.t('nocodeEditorAiFlowPlanPreview.parallelSteps', { count: branch.nodes.length }) : i18next.t('nocodeEditorAiFlowPlanPreview.parallelPath'),
    laneNote: i18next.t('nocodeEditorAiFlowPlanPreview.parallelExecution'),
  }
}

const buildNodeViewModel = (
  node: NocodeEditorFlowPlanNode,
  path: number[],
): FlowNodeViewModel => {
  const tone = NOCODE_EDITOR_FLOW_PLAN_NODE_CATEGORY_MAP[node.type] as FlowPreviewTone
  const details = buildNodeDetails(node)
  const meta = details.meta.filter(Boolean)
  const typeLabel = FLOW_NODE_LABEL_MAP[node.type] || NOCODE_EDITOR_FLOW_PLAN_NODE_LABEL_MAP[node.type] || node.type
  const title = normalizeText(node.name) || typeLabel
  return {
    key: normalizeText(node.nodeKey) || `${node.type}-${path.join('-')}`,
    stepLabel: path.map(item => item + 1).join('.'),
    title,
    typeKey: node.type,
    typeLabel,
    categoryLabel: CATEGORY_LABEL_MAP[tone] || '',
    tone,
    iconName: FLOW_NODE_ICON_MAP[node.type],
    summary: details.summary,
    meta,
    branches: asArray<NocodeEditorFlowPlanBranch>(node.branches).map((branch, branchIndex) => {
      const branchDetails = buildBranchSummary(node.type, branch)
      return {
        key: normalizeText(branch.branchKey) || `${node.type}-${path.join('-')}-branch-${branchIndex + 1}`,
        label: normalizeText(branch.label) || (node.type === 'parallel-branch'
          ? i18next.t('nocodeEditorAiFlowPlanPreview.parallelBranchWithIndex', { index: branchIndex + 1 })
          : i18next.t('nocodeEditorAiFlowPlanPreview.conditionBranchWithIndex', { index: branchIndex + 1 })),
        modeLabel: node.type === 'parallel-branch' ? i18next.t('nocodeEditorAiFlowPlanPreview.parallelBranch') : i18next.t('nocodeEditorAiFlowPlanPreview.conditionBranch'),
        summary: branchDetails.summary,
        laneNote: branchDetails.laneNote,
        nodes: asArray<NocodeEditorFlowPlanNode>(branch.nodes).map((child, childIndex) => buildNodeViewModel(child, [...path, childIndex])),
      }
    }),
  }
}

const buildTriggerBranchScopeKey = (
  triggerBranch: NocodeEditorFlowPlanTriggerBranch,
  index: number,
): FlowPreviewScopeKey => `trigger-branch:${normalizeText(triggerBranch.branchKey) || index + 1}`

const resolveTriggerBranchLabel = (
  triggerBranch: NocodeEditorFlowPlanTriggerBranch,
  index: number,
) => normalizeText(triggerBranch.triggerNode.name)
  || normalizeText(triggerBranch.label)
  || i18next.t('nocodeEditorAiFlowPlanPreview.triggerBranchWithIndex', { index: index + 1 })

const buildTriggerBranchViewModel = (
  triggerBranch: NocodeEditorFlowPlanTriggerBranch,
  index: number,
): FlowTriggerBranchViewModel => {
  const timelineNodes = [
    buildNodeViewModel(triggerBranch.triggerNode, [0]),
    ...asArray<NocodeEditorFlowPlanNode>(triggerBranch.nodes).map((node, nodeIndex) => (
      buildNodeViewModel(node, [nodeIndex + 1])
    )),
  ]
  return {
    key: buildTriggerBranchScopeKey(triggerBranch, index),
    label: resolveTriggerBranchLabel(triggerBranch, index),
    triggerNode: timelineNodes[0],
    timelineNodes,
    nodeCount: asArray<NocodeEditorFlowPlanNode>(triggerBranch.nodes).length,
    totalNodeCount: 1 + countNocodeEditorFlowPlanNodes(asArray<NocodeEditorFlowPlanNode>(triggerBranch.nodes)),
    branchCount: countNocodeEditorFlowPlanBranches(asArray<NocodeEditorFlowPlanNode>(triggerBranch.nodes)),
  }
}

const triggerBranchViewModels = computed(() => (
  asArray<NocodeEditorFlowPlanTriggerBranch>(flowPlan.value?.triggerBranches)
    .map((triggerBranch, index) => buildTriggerBranchViewModel(triggerBranch, index))
))

const showTriggerTabs = computed(() => triggerBranchViewModels.value.length >= 2)

const detailTabs = computed(() => (
  showTriggerTabs.value
    ? [
      {
        key: OVERVIEW_SCOPE_KEY,
        label: i18next.t('nocodeEditorAiFlowPlanPreview.overview'),
      },
      ...triggerBranchViewModels.value.map(branch => ({
        key: branch.key,
        label: branch.label,
      })),
    ]
    : []
))

const normalizeActiveScopeKey = (value: string): FlowPreviewScopeKey | '' => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return ''
  }

  if (normalized === OVERVIEW_SCOPE_KEY) {
    return OVERVIEW_SCOPE_KEY
  }

  return detailTabs.value.some(tab => tab.key === normalized)
    ? normalized as FlowPreviewScopeKey
    : ''
}

const resolveDefaultScopeKey = () => {
  if (showTriggerTabs.value) {
    return OVERVIEW_SCOPE_KEY
  }
  return triggerBranchViewModels.value[0]?.key || OVERVIEW_SCOPE_KEY
}

watch(
  () => [props.activeScopeKey, detailTabs.value.map(tab => tab.key).join('|'), triggerBranchViewModels.value.length],
  () => {
    const externalScopeKey = normalizeActiveScopeKey(props.activeScopeKey || '')
    if (externalScopeKey) {
      localActiveScopeKey.value = externalScopeKey
      return
    }

    const defaultScopeKey = resolveDefaultScopeKey()
    if (localActiveScopeKey.value !== defaultScopeKey) {
      localActiveScopeKey.value = defaultScopeKey
    }
  },
  {
    immediate: true,
  },
)

const setActiveScopeKey = (value: string) => {
  localActiveScopeKey.value = value
  emit('update:activeScopeKey', value)
}

const resolvedActiveScopeKey = computed<FlowPreviewScopeKey>(() => {
  const externalScopeKey = normalizeActiveScopeKey(props.activeScopeKey || '')
  if (externalScopeKey) {
    return externalScopeKey
  }
  return (localActiveScopeKey.value || resolveDefaultScopeKey()) as FlowPreviewScopeKey
})

const isOverviewActive = computed(() => (
  showTriggerTabs.value && resolvedActiveScopeKey.value === OVERVIEW_SCOPE_KEY
))

const activeTriggerBranch = computed(() => {
  if (showTriggerTabs.value && isOverviewActive.value) {
    return null
  }

  const targetKey = resolvedActiveScopeKey.value
  return triggerBranchViewModels.value.find(branch => branch.key === targetKey)
    || triggerBranchViewModels.value[0]
    || null
})

const currentScopeNodeViewModels = computed(() => (
  activeTriggerBranch.value?.timelineNodes || []
))

const showOverviewCards = computed(() => isOverviewActive.value)

const questions = computed(() => (
  resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles(flowPlan.value)
))
const warnings = computed(() => asArray<string>(props.block?.flowApplyResult?.warnings).map(item => normalizeText(item)).filter(Boolean))
const visibleQuestions = computed(() => (
  props.mode === 'artifact'
    ? (
      showTriggerTabs.value && !isOverviewActive.value
        ? []
        : questions.value
    )
    : []
))
const visibleWarnings = computed(() => (
  showTriggerTabs.value && !isOverviewActive.value
    ? []
    : warnings.value
))

const triggerBranchCount = computed(() => asArray<NocodeEditorFlowPlanTriggerBranch>(flowPlan.value?.triggerBranches).length)
const totalNodeCount = computed(() => countNocodeEditorFlowPlanTotalNodes(asArray<NocodeEditorFlowPlanTriggerBranch>(flowPlan.value?.triggerBranches)))
const branchCount = computed(() => (
  asArray<NocodeEditorFlowPlanTriggerBranch>(flowPlan.value?.triggerBranches)
    .reduce((total, triggerBranch) => (
      total + countNocodeEditorFlowPlanBranches(asArray<NocodeEditorFlowPlanNode>(triggerBranch.nodes))
    ), 0)
))

const displayTitle = computed(() => (
  props.mode === 'embedded'
    ? normalizeText(props.embeddedTitle) || i18next.t('nocodeEditorAiFlowPlanPreview.currentFormWorkflowBlueprint')
    : normalizeText(flowPlan.value?.title) || i18next.t('nocodeEditorAiFlowPlanPreview.workflowBlueprint')
))

const displaySummary = computed(() => normalizeText(flowPlan.value?.summary))

const showApplyButton = computed(() => (
  props.mode === 'artifact'
  && props.canApply
  && (!showTriggerTabs.value || isOverviewActive.value)
))

const metaCards = computed(() => ([
  {
    label: i18next.t('nocodeEditorAiFlowPlanPreview.targetFormLabel'),
    value: normalizeText(flowPlan.value?.target?.formName || flowPlan.value?.target?.formId) || i18next.t('nocodeEditorAiFlowPlanPreview.currentForm'),
  },
  {
    label: i18next.t('nocodeEditorAiFlowPlanPreview.triggerBranchLabel'),
    value: i18next.t('nocodeEditorAiFlowPlanPreview.countWithUnit', { count: triggerBranchCount.value, unit: i18next.t('nocodeEditorAiFlowPlanPreview.branchUnit') }),
  },
  {
    label: i18next.t('nocodeEditorAiFlowPlanPreview.totalNodesLabel'),
    value: i18next.t('nocodeEditorAiFlowPlanPreview.countWithUnit', { count: totalNodeCount.value, unit: i18next.t('nocodeEditorAiFlowPlanPreview.nodeUnit') }),
  },
  {
    label: i18next.t('nocodeEditorAiFlowPlanPreview.branchesLabel'),
    value: i18next.t('nocodeEditorAiFlowPlanPreview.countWithUnit', { count: branchCount.value, unit: i18next.t('nocodeEditorAiFlowPlanPreview.pathUnit') }),
  },
]))

const applySummaryText = computed(() => {
  const summary = props.block?.flowApplyResult?.summary
  if (!summary) {
    return ''
  }
  return i18next.t('nocodeEditorAiFlowPlanPreview.workflowGeneratedSummary', {
    triggerBranchCount: Number(summary.triggerBranchCount || 0),
    totalNodeCount: Number(summary.totalNodeCount || 0),
    branchCount: Number(summary.branchCount || 0),
  })
})

const sectionTitle = computed(() => (
  showOverviewCards.value ? i18next.t('nocodeEditorAiFlowPlanPreview.triggerBranchOverview') : i18next.t('nocodeEditorAiFlowPlanPreview.workflowStructure')
))

const sectionCaption = computed(() => {
  if (showOverviewCards.value) {
    return i18next.t('nocodeEditorAiFlowPlanPreview.overviewSectionCaption')
  }
  return i18next.t('nocodeEditorAiFlowPlanPreview.structureSectionCaption')
})

const renderIcon = (iconName: string) => {
  const component = resolveDynamicComponent(iconName)
  return h(component as any, {})
}

const FlowPlanNodeTree = defineComponent({
  name: 'FlowPlanNodeTree',
  props: {
    node: {
      type: Object as PropType<FlowNodeViewModel>,
      required: true,
    },
    depth: {
      type: Number,
      default: 0,
    },
    isLast: {
      type: Boolean,
      default: false,
    },
  },
  setup(componentProps) {
    return () => {
      const hasBranches = componentProps.node.branches.length > 0
      const branchGridMode = componentProps.node.typeKey === 'parallel-branch'
        ? 'is-parallel'
        : 'is-condition'

      return h('article', {
        class: [
          'flow-plan-preview__node',
          `is-${componentProps.node.tone}`,
          `type-${componentProps.node.typeKey}`,
          {
            'is-compact': componentProps.depth > 0,
            'has-branches': hasBranches,
          },
        ],
      }, [
        h('div', { class: 'flow-plan-preview__node-rail' }, [
          h('span', { class: 'flow-plan-preview__node-step' }, componentProps.node.stepLabel),
          !componentProps.isLast
            ? h('span', { class: 'flow-plan-preview__node-line' })
            : null,
        ]),
        h('div', { class: 'flow-plan-preview__node-body' }, [
          h('section', { class: 'flow-plan-preview__node-card' }, [
            h('div', { class: 'flow-plan-preview__node-card-main' }, [
              h('div', { class: 'flow-plan-preview__node-icon-badge' }, [
                h('span', { class: 'flow-plan-preview__node-icon' }, [
                  renderIcon(componentProps.node.iconName),
                ]),
              ]),
              h('div', { class: 'flow-plan-preview__node-copy' }, [
                h('div', { class: 'flow-plan-preview__node-copy-head' }, [
                  h('div', { class: 'flow-plan-preview__node-title-block' }, [
                    h('div', { class: 'flow-plan-preview__node-title' }, componentProps.node.title),
                    componentProps.node.summary
                      ? h('p', { class: 'flow-plan-preview__node-summary' }, componentProps.node.summary)
                      : null,
                  ]),
                  h('div', { class: 'flow-plan-preview__node-tags' }, [
                    h('span', {
                      class: ['flow-plan-preview__tag', 'is-category', `is-${componentProps.node.tone}`],
                    }, componentProps.node.categoryLabel),
                    h('span', {
                      class: ['flow-plan-preview__tag', 'is-type'],
                    }, componentProps.node.typeLabel),
                  ]),
                ]),
                componentProps.node.meta.length
                  ? h('div', { class: 'flow-plan-preview__meta-list' }, [
                    ...componentProps.node.meta.map(item => {
                      return h('span', { class: 'flow-plan-preview__meta-chip' }, item)
                    }
                    ),
                  ])
                  : null,
              ]),
            ]),
          ]),
          hasBranches
            ? h('section', { class: 'flow-plan-preview__branch-shell' }, [
              h('div', { class: 'flow-plan-preview__branch-shell-head' }, [
                h('span', { class: 'flow-plan-preview__branch-shell-dot' }),
                // @ts-ignore
                h('span', { class: 'flow-plan-preview__branch-shell-text' }, componentProps.node.typeKey === 'parallel-branch' ? i18next.t('nocodeEditorAiFlowPlanPreview.expandFromHereParallel') : i18next.t('nocodeEditorAiFlowPlanPreview.splitFromHereByCondition')),
              ]),
              h('div', {
                class: ['flow-plan-preview__branch-grid', branchGridMode],
              }, componentProps.node.branches.map(branch => (
                h('section', {
                  key: branch.key,
                  class: 'flow-plan-preview__branch-card',
                }, [
                  h('div', { class: 'flow-plan-preview__branch-head' }, [
                    h('span', { class: 'flow-plan-preview__branch-mode' }, branch.modeLabel),
                    h('div', { class: 'flow-plan-preview__branch-title-block' }, [
                      h('div', { class: 'flow-plan-preview__branch-title' }, branch.label),
                      h('p', { class: 'flow-plan-preview__branch-summary' }, branch.summary),
                    ]),
                    // h('span', { class: 'flow-plan-preview__branch-note' }, branch.laneNote),
                  ]),
                  branch.nodes.length
                    ? h('div', { class: 'flow-plan-preview__branch-body' }, branch.nodes.map((child, childIndex) => (
                      h(FlowPlanNodeTree, {
                        key: child.key,
                        node: child,
                        depth: componentProps.depth + 1,
                        isLast: childIndex === branch.nodes.length - 1,
                      })
                    )))
                    // @ts-ignore
                    : h('div', { class: 'flow-plan-preview__branch-empty' }, i18next.t('nocodeEditorAiFlowPlanPreview.emptyBranchNodes')),
                ])
              ))),
              // h('div', { class: 'flow-plan-preview__branch-shell-foot' }, componentProps.node.typeKey === 'parallel-branch' ? '并行分支完成后继续汇合到主链' : '命中对应条件后继续执行该路径'),
            ])
            : null,
        ]),
      ])
    }
  },
})
</script>

<style lang="scss">
.flow-plan-preview {
  --flow-surface: #ffffff;
  --flow-surface-soft: #f6f9fc;
  --flow-surface-muted: #eef3f7;
  --flow-surface-strong: #f8fbff;
  --flow-border: #d8e2eb;
  --flow-border-strong: #c5d3e0;
  --flow-line: #d5dde6;
  --flow-text-primary: #172233;
  --flow-text-secondary: #566578;
  --flow-text-tertiary: #7a8796;
  --flow-brand: #1972ff;
  --flow-brand-soft: rgba(25, 114, 255, 0.1);
  --flow-success: #2d9467;
  --flow-success-soft: rgba(45, 148, 103, 0.1);
  --flow-warning: #b6791b;
  --flow-warning-soft: rgba(182, 121, 27, 0.1);
  --flow-danger: #c25b37;
  --flow-danger-soft: rgba(194, 91, 55, 0.1);
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  color: var(--flow-text-primary);
}

.flow-plan-preview.is-embedded {
  gap: 12px;
}

.flow-plan-preview__hero,
.flow-plan-preview__section,
.flow-plan-preview__status-card,
.flow-plan-preview__status-strip {
  border: 1px solid var(--flow-border);
  border-radius: 18px;
  background: var(--flow-surface);
}

.flow-plan-preview__hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 251, 255, 0.98)),
    linear-gradient(135deg, rgba(25, 114, 255, 0.06), transparent 58%);
}

.flow-plan-preview.is-embedded .flow-plan-preview__hero {
  padding: 14px 16px;
}

.flow-plan-preview__hero-copy {
  min-width: 0;
  flex: 1;
}

.flow-plan-preview__eyebrow {
  margin-bottom: 6px;
  font-size: 11px;
  line-height: 18px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--flow-brand);
}

.flow-plan-preview__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.flow-plan-preview__title {
  margin: 0;
  font-size: 18px;
  line-height: 26px;
  font-weight: 700;
  color: var(--flow-text-primary);
}

.flow-plan-preview.is-embedded .flow-plan-preview__title {
  font-size: 16px;
  line-height: 24px;
}

.flow-plan-preview__hero-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--flow-brand-soft);
  color: var(--flow-brand);
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}

.flow-plan-preview__summary {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 22px;
  color: var(--flow-text-secondary);
}

.flow-plan-preview__meta-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.flow-plan-preview__tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.flow-plan-preview__tab {
  min-width: 88px;
  padding: 8px 14px;
  border: 1px solid rgba(198, 208, 223, 0.95);
  border-radius: 999px;
  background: rgba(248, 251, 255, 0.96);
  color: #61738f;
  font-size: 13px;
  line-height: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s ease;
}

.flow-plan-preview__tab:hover {
  border-color: rgba(25, 114, 255, 0.24);
  color: #2450bf;
}

.flow-plan-preview__tab.is-active {
  border-color: rgba(25, 114, 255, 0.26);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(233, 241, 255, 0.98));
  color: #1d45ae;
  box-shadow: 0 12px 26px rgba(56, 89, 178, 0.12);
}

.flow-plan-preview__meta-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--flow-border);
  background: linear-gradient(180deg, #ffffff, var(--flow-surface-strong));
}

.flow-plan-preview__meta-label {
  font-size: 11px;
  line-height: 18px;
  color: var(--flow-text-tertiary);
}

.flow-plan-preview__meta-value {
  font-size: 14px;
  line-height: 22px;
  font-weight: 700;
  color: var(--flow-text-primary);
}

.flow-plan-preview__status-strip {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px 16px;
  background: linear-gradient(180deg, #ffffff, #f7fcf9);
}

.flow-plan-preview__status-strip-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: rgba(46, 155, 98, 0.12);
  color: #2e9b62;
  flex-shrink: 0;
}

.flow-plan-preview__status-strip-title {
  font-size: 13px;
  line-height: 20px;
  font-weight: 700;
  color: var(--flow-text-primary);
}

.flow-plan-preview__status-strip-text {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--flow-text-secondary);
}

.flow-plan-preview__section {
  padding: 16px;
}

.flow-plan-preview__section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.flow-plan-preview__section-title {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
  color: var(--flow-text-primary);
}

.flow-plan-preview__section-caption {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--flow-text-tertiary);
}

.flow-plan-preview__diagram {
  padding: 4px 0 0;
}

.flow-plan-preview__diagram-surface {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid rgba(216, 226, 235, 0.9);
  background:
    radial-gradient(circle at top right, rgba(25, 114, 255, 0.05), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 254, 0.98));
  overflow: hidden;
}

.flow-plan-preview__diagram-surface::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(216, 226, 235, 0.28) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(216, 226, 235, 0.28) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.4), transparent 92%);
  pointer-events: none;
}

.flow-plan-preview__trigger-branch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.flow-plan-preview__trigger-branch-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 168px;
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(216, 226, 235, 0.95);
  background:
    radial-gradient(circle at top right, rgba(25, 114, 255, 0.06), transparent 28%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 250, 254, 0.98));
  box-shadow: 0 18px 40px rgba(97, 118, 156, 0.12);
}

.flow-plan-preview__trigger-branch-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.flow-plan-preview__trigger-branch-title-block {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6px;
}

.flow-plan-preview__trigger-branch-title {
  color: var(--flow-text-primary);
  font-size: 16px;
  line-height: 24px;
  font-weight: 700;
}

.flow-plan-preview__trigger-branch-summary {
  margin: 0;
  color: var(--flow-text-secondary);
  font-size: 13px;
  line-height: 22px;
}

.flow-plan-preview__trigger-branch-tags,
.flow-plan-preview__trigger-branch-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.flow-plan-preview__node {
  --node-accent: #1972ff;
  --node-accent-soft: rgba(25, 114, 255, 0.1);
  --node-accent-ghost: rgba(25, 114, 255, 0.16);
  position: relative;
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 14px;
  min-width: 0;
}

.flow-plan-preview__node.type-trigger-data-change {
  --node-accent: #6cb238;
  --node-accent-soft: rgba(108, 178, 56, 0.14);
  --node-accent-ghost: rgba(108, 178, 56, 0.24);
}

.flow-plan-preview__node.type-trigger-time-task {
  --node-accent: #13b3c2;
  --node-accent-soft: rgba(19, 179, 194, 0.14);
  --node-accent-ghost: rgba(19, 179, 194, 0.24);
}

.flow-plan-preview__node.type-trigger-operation {
  --node-accent: #bb8ce8;
  --node-accent-soft: rgba(187, 140, 232, 0.14);
  --node-accent-ghost: rgba(187, 140, 232, 0.24);
}

.flow-plan-preview__node.type-approval {
  --node-accent: #fa8515;
  --node-accent-soft: rgba(250, 133, 21, 0.14);
  --node-accent-ghost: rgba(250, 133, 21, 0.24);
}

.flow-plan-preview__node.type-notify {
  --node-accent: #1f77fc;
  --node-accent-soft: rgba(31, 119, 252, 0.14);
  --node-accent-ghost: rgba(31, 119, 252, 0.24);
}

.flow-plan-preview__node.type-transact {
  --node-accent: #f9572b;
  --node-accent-soft: rgba(249, 87, 43, 0.14);
  --node-accent-ghost: rgba(249, 87, 43, 0.24);
}

.flow-plan-preview__node.type-add-data {
  --node-accent: #f5ab00;
  --node-accent-soft: rgba(245, 171, 0, 0.14);
  --node-accent-ghost: rgba(245, 171, 0, 0.24);
}

.flow-plan-preview__node.type-edit-data {
  --node-accent: #266eeb;
  --node-accent-soft: rgba(38, 110, 235, 0.14);
  --node-accent-ghost: rgba(38, 110, 235, 0.24);
}

.flow-plan-preview__node.type-delete-data {
  --node-accent: #ff5a52;
  --node-accent-soft: rgba(255, 90, 82, 0.14);
  --node-accent-ghost: rgba(255, 90, 82, 0.24);
}

.flow-plan-preview__node.type-report-data {
  --node-accent: #00a38d;
  --node-accent-soft: rgba(0, 163, 141, 0.14);
  --node-accent-ghost: rgba(0, 163, 141, 0.24);
}

.flow-plan-preview__node.type-condition-branch,
.flow-plan-preview__node.type-parallel-branch {
  --node-accent: #c58b2d;
  --node-accent-soft: rgba(197, 139, 45, 0.14);
  --node-accent-ghost: rgba(197, 139, 45, 0.24);
}

.flow-plan-preview__node.is-compact {
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
}

.flow-plan-preview__node-rail {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.flow-plan-preview__node-step {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 40px;
  min-height: 40px;
  padding: 0 8px;
  border-radius: 14px;
  background: #ffffff;
  border: 1px solid var(--node-accent-ghost);
  box-shadow: 0 8px 20px rgba(24, 39, 75, 0.06);
  font-size: 12px;
  line-height: 18px;
  font-weight: 700;
  color: var(--node-accent);
}

.flow-plan-preview__node.is-compact .flow-plan-preview__node-step {
  min-width: 34px;
  min-height: 34px;
  border-radius: 12px;
  font-size: 11px;
}

.flow-plan-preview__node-line {
  width: 2px;
  flex: 1;
  min-height: 48px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--node-accent-ghost), rgba(213, 221, 230, 0.55));
}

.flow-plan-preview__node-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.flow-plan-preview__node-card {
  position: relative;
  min-width: 0;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--node-accent-ghost);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.98)),
    linear-gradient(135deg, var(--node-accent-soft), transparent 56%);
  box-shadow: 0 12px 28px rgba(17, 32, 56, 0.04);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.flow-plan-preview__node-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(17, 32, 56, 0.08);
}

.flow-plan-preview__node.is-compact .flow-plan-preview__node-card {
  padding: 12px;
  border-radius: 16px;
}

.flow-plan-preview__node-card-main {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  min-width: 0;
}

.flow-plan-preview__node.is-compact .flow-plan-preview__node-card-main {
  gap: 10px;
}

.flow-plan-preview__node-icon-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: var(--node-accent-soft);
  color: var(--node-accent);
  flex-shrink: 0;
}

.flow-plan-preview__node.is-compact .flow-plan-preview__node-icon-badge {
  width: 34px;
  height: 34px;
  border-radius: 12px;
}

.flow-plan-preview__node-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.flow-plan-preview__node.is-compact .flow-plan-preview__node-icon {
  font-size: 16px;
}

.flow-plan-preview__node-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.flow-plan-preview__node-copy-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.flow-plan-preview__node-title-block {
  min-width: 0;
  flex: 1;
}

.flow-plan-preview__node-title {
  font-size: 15px;
  line-height: 22px;
  font-weight: 700;
  color: var(--flow-text-primary);
}

.flow-plan-preview__node.is-compact .flow-plan-preview__node-title {
  font-size: 14px;
  line-height: 20px;
}

.flow-plan-preview__node-summary {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--flow-text-secondary);
}

.flow-plan-preview__node-tags,
.flow-plan-preview__meta-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.flow-plan-preview__tag,
.flow-plan-preview__meta-chip,
.flow-plan-preview__branch-mode,
.flow-plan-preview__branch-note {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 18px;
  font-weight: 600;
}

.flow-plan-preview__tag.is-type,
.flow-plan-preview__meta-chip {
  background: var(--flow-surface-soft);
  color: var(--flow-text-secondary);
}

.flow-plan-preview__meta-chip.is-overflow {
  color: var(--node-accent);
  background: var(--node-accent-soft);
}

.flow-plan-preview__tag.is-category.is-trigger {
  background: var(--flow-brand-soft);
  color: var(--flow-brand);
}

.flow-plan-preview__tag.is-category.is-human {
  background: var(--flow-success-soft);
  color: var(--flow-success);
}

.flow-plan-preview__tag.is-category.is-cross-table {
  background: var(--flow-danger-soft);
  color: var(--flow-danger);
}

.flow-plan-preview__tag.is-category.is-branch,
.flow-plan-preview__branch-mode {
  background: var(--flow-warning-soft);
  color: var(--flow-warning);
}

.flow-plan-preview__branch-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding-left: 12px;
}

.flow-plan-preview__branch-shell::before {
  content: "";
  position: absolute;
  left: 0;
  top: 10px;
  bottom: 10px;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--node-accent-ghost), rgba(213, 221, 230, 0.35));
}

.flow-plan-preview__branch-shell-head {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--flow-text-secondary);
}

.flow-plan-preview__branch-shell-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--node-accent);
  box-shadow: 0 0 0 4px var(--node-accent-soft);
  flex-shrink: 0;
}

.flow-plan-preview__branch-shell-text {
  font-weight: 600;
}

.flow-plan-preview__branch-grid {
  display: grid;
  gap: 12px;
}

.flow-plan-preview__branch-grid.is-parallel {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.flow-plan-preview__branch-grid.is-condition {
  grid-template-columns: minmax(0, 1fr);
}

.flow-plan-preview__branch-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border-radius: 18px;
  border: 1px solid var(--flow-border-strong);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 252, 255, 0.98));
}

// .flow-plan-preview__branch-card::before {
//   content: "";
//   position: absolute;
//   left: 14px;
//   top: 0;
//   bottom: 0;
//   width: 3px;
//   border-radius: 999px;
//   background: linear-gradient(180deg, rgba(197, 139, 45, 0.22), rgba(197, 139, 45, 0.06));
// }

.flow-plan-preview__branch-head {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px 10px;
  min-width: 0;
  padding-left: 12px;
}

.flow-plan-preview__branch-title-block {
  min-width: 0;
  flex: 1;
}

.flow-plan-preview__branch-title {
  font-size: 14px;
  line-height: 22px;
  font-weight: 700;
  color: var(--flow-text-primary);
}

.flow-plan-preview__branch-summary {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 20px;
  color: var(--flow-text-secondary);
}

.flow-plan-preview__branch-note {
  background: rgba(197, 139, 45, 0.1);
  color: #9b6a13;
}

.flow-plan-preview__branch-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.flow-plan-preview__branch-empty {
  padding: 12px;
  border-radius: 14px;
  background: var(--flow-surface-muted);
  font-size: 12px;
  line-height: 20px;
  color: var(--flow-text-tertiary);
}

.flow-plan-preview__branch-shell-foot {
  padding-left: 12px;
  font-size: 12px;
  line-height: 20px;
  color: var(--flow-text-tertiary);
}

.flow-plan-preview__diagram-end {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: 15px;
  padding-top: 4px;
  color: var(--flow-text-tertiary);
  font-size: 12px;
  line-height: 18px;
}

.flow-plan-preview__diagram-end::before {
  content: "";
  position: absolute;
  left: 6px;
  top: -12px;
  width: 2px;
  height: 12px;
  border-radius: 999px;
  background: var(--flow-line);
}

.flow-plan-preview__diagram-end-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #ffffff;
  border: 2px solid var(--flow-line);
  flex-shrink: 0;
}

.flow-plan-preview__diagram-end-label {
  font-weight: 600;
}

.flow-plan-preview__status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.flow-plan-preview__status-card {
  padding: 14px 16px;
}

.flow-plan-preview__status-card.is-question {
  background: linear-gradient(180deg, #ffffff, #fafcff);
}

.flow-plan-preview__status-card.is-warning {
  background: linear-gradient(180deg, #ffffff, #fffaf2);
}

.flow-plan-preview__status-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--flow-text-secondary);
}

.flow-plan-preview__status-title {
  font-size: 13px;
  line-height: 20px;
  font-weight: 700;
  color: var(--flow-text-primary);
}

.flow-plan-preview__status-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 20px;
  color: var(--flow-text-secondary);
}

@media (max-width: 960px) {
  .flow-plan-preview__hero,
  .flow-plan-preview__node-copy-head,
  .flow-plan-preview__section-head {
    flex-direction: column;
  }

  .flow-plan-preview__meta-grid,
  .flow-plan-preview__status-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .flow-plan-preview__section,
  .flow-plan-preview__diagram-surface {
    padding: 12px;
  }

  .flow-plan-preview__node {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .flow-plan-preview__node-rail {
    flex-direction: row;
    align-items: center;
  }

  .flow-plan-preview__node-line {
    width: 100%;
    min-height: 2px;
  }

  .flow-plan-preview__branch-grid.is-parallel {
    grid-template-columns: 1fr;
  }

  .flow-plan-preview__diagram-end {
    margin-left: 0;
  }

  .flow-plan-preview__diagram-end::before {
    display: none;
  }
}
</style>
