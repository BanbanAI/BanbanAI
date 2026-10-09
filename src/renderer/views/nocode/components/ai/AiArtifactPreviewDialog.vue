<template>
  <el-dialog
    v-model="dialogVisible"
    class="nocode-editor-ai-preview-dialog"
    width="94%"
    align-center
    append-to-body
    destroy-on-close
  >
    <template #header>
      <div class="preview-dialog-header">
        <div class="preview-dialog-title-row">
          <div class="preview-dialog-title">{{ dialogTitle }}</div>
          <span v-if="headerVersionLabel" class="preview-dialog-version">{{ headerVersionLabel }}</span>
        </div>
      </div>
    </template>

    <div
      v-if="block?.kind === 'app-plan' && (block as any).appPlan"
      class="preview-dialog-body is-app-plan"
    >
      <nocode-editor-ai-flowchart
        v-if="appPlanOutline"
        :outline="appPlanOutline"
        :planning-artifacts="[]"
        compact
      />
    </div>

    <div
      v-else-if="block?.kind === 'form-plan' && (block as any).outline && (block as any).applicationStructurePreview?.enabled"
      class="preview-dialog-body is-form-plan"
    >
      <nocode-editor-ai-flowchart
        :outline="(block as any).outline"
        :planning-artifacts="[]"
        compact
      />
    </div>

    <div
      v-else-if="block?.kind === 'content-plan' && (block as any).plan"
      class="preview-dialog-body is-content-plan"
    >
      <div class="content-plan-preview">
        <div v-if="contentPlanSummary" class="preview-dialog-summary">{{ contentPlanSummary }}</div>
        <section v-if="contentPlanScope || contentPlanTarget" class="content-plan-section">
          <h3>{{ $t('aiArtifactPreviewDialog.planningScope') }}</h3>
          <p v-if="contentPlanScope">{{ contentPlanScope }}</p>
          <p v-if="contentPlanTarget">{{ contentPlanTarget }}</p>
        </section>
        <section class="content-plan-section">
          <h3>{{ $t('aiArtifactPreviewDialog.planningChecklist') }}</h3>
          <ol v-if="contentPlanItems.length">
            <li v-for="(item, index) in contentPlanItems" :key="`${index}-${item}`">{{ item }}</li>
          </ol>
          <p v-else>{{ $t('aiArtifactPreviewDialog.emptyPlanningItems') }}</p>
        </section>
        <section class="content-plan-section">
          <h3>{{ $t('aiArtifactPreviewDialog.needsConfirmation') }}</h3>
          <ol v-if="contentPlanQuestions.length">
            <li
              v-for="(question, index) in contentPlanQuestions"
              :key="question.id || `${index}-${question.title}`"
            >
              <div>{{ question.title }}</div>
              <p v-if="question.description">{{ question.description }}</p>
            </li>
          </ol>
          <p v-else>{{ $t('aiArtifactPreviewDialog.emptyConfirmationQuestions') }}</p>
        </section>
      </div>
    </div>

    <div
      v-else-if="block?.kind === 'formula-plan' && formulaPlan"
      class="preview-dialog-body is-formula-plan"
    >
      <div class="formula-plan-preview">
        <div v-if="formulaPlanSummary" class="preview-dialog-summary">{{ formulaPlanSummary }}</div>
        <section v-if="formulaPlanStatus" class="content-plan-section formula-plan-status">
          <p>{{ formulaPlanStatus }}</p>
        </section>
        <section class="content-plan-section">
          <h3>{{ $t('aiArtifactPreviewDialog.planningChecklist') }}</h3>
          <ol v-if="formulaPlanItems.length" class="formula-plan-item-list">
            <li v-for="item in formulaPlanItems" :key="item.key" class="formula-plan-item">
              <div class="formula-plan-item__target">{{ item.target }}</div>
              <div class="formula-plan-item__path">{{ resolveNocodeEditorFormulaPathLabel(item.formulaPath) }}</div>
              <code class="formula-plan-item__formula">{{ item.formula }}</code>
              <p v-if="item.explanation" class="formula-plan-item__explanation">{{ item.explanation }}</p>
            </li>
          </ol>
          <p v-else>{{ $t('aiArtifactPreviewDialog.emptyPlanningItems') }}</p>
        </section>
        <section class="content-plan-section">
          <h3>{{ $t('aiArtifactPreviewDialog.needsConfirmation') }}</h3>
          <ol v-if="formulaPlanQuestions.length">
            <li
              v-for="(question, index) in formulaPlanQuestions"
              :key="question.id || `${index}-${question.title}`"
            >
              <div>{{ question.title }}</div>
              <p v-if="question.description">{{ question.description }}</p>
            </li>
          </ol>
          <p v-else>{{ $t('aiArtifactPreviewDialog.emptyConfirmationQuestions') }}</p>
        </section>
      </div>
    </div>

    <div
      v-else-if="block?.kind === 'flow-plan' && (block as any).flowPlan"
      class="preview-dialog-body is-flow-plan"
    >
      <nocode-editor-ai-flow-plan-preview
        :block="block"
        :can-apply="canApplyFlow"
        :applying="applyingFlow"
        @apply-flow="emit('apply-flow')"
      />
    </div>

    <div
      v-else-if="block?.kind === 'blueprint' && (block as any).blueprint"
      class="preview-dialog-body is-blueprint"
    >
      <nocode-editor-ai-blueprint-preview-workbench
        :block="block"
        :app-name="appName"
        :workbench-items="blueprintWorkbenchItems"
        :workbench-history-items="blueprintWorkbenchHistoryItems"
        :blueprint-preview-focus-card-key="blueprintPreviewFocusCardKey"
        :flow-artifact-blocks="flowArtifactBlocks"
        :get-flow-confirmation-response-drafts="getFlowConfirmationResponseDrafts"
        :get-flow-active-confirmation-input-question-ids="getFlowActiveConfirmationInputQuestionIds"
        :get-flow-inline-confirmation-note-question-ids="getFlowInlineConfirmationNoteQuestionIds"
        :can-apply-flow-artifact="canApplyFlowArtifact"
        :is-applying-flow-artifact="isApplyingFlowArtifact"
        :can-apply="canApplyBlueprint"
        :can-continue="canContinueBlueprint"
        :applying="applyingBlueprint"
        :response-drafts="confirmationResponseDrafts"
        :active-input-question-ids="activeConfirmationInputQuestionIds"
        :inline-note-question-ids="inlineConfirmationNoteQuestionIds"
        :submitting-confirmation="submittingConfirmation"
        @apply-blueprint="emit('apply-blueprint')"
        @apply-flow="emit('apply-flow', $event)"
        @continue-blueprint-adjustment="emit('continue-blueprint-adjustment')"
        @continue-flow-defaults="emit('continue-flow-defaults', $event)"
        @select-confirmation-option="emit('select-confirmation-option', $event)"
        @toggle-note-input="emit('toggle-note-input', $event)"
        @toggle-flow-note-input="emit('toggle-flow-note-input', $event)"
        @update-note="emit('update-note', $event)"
        @update-flow-note="emit('update-flow-note', $event)"
        @submit-confirmation-responses="emit('submit-confirmation-responses')"
        @submit-flow-confirmation-responses="emit('submit-flow-confirmation-responses', $event)"
        @open-generated-page="emit('open-generated-page', $event)"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import i18next from 'i18next'
import type { AiAssistantArtifactBlock } from '@common/types/ai'
import type { NocodeEditorAiConfirmQuestionOption } from '@common/types/nocodeEditorConfirmation'
import type { NocodeEditorAiConfirmationResponseDraftMap } from '@renderer/views/nocode/views/editor/ai/components/confirmationInteraction'
import { getI18nLabelColon } from '@common/utils/i18n'
import NocodeEditorAiBlueprintPreviewWorkbench from '@renderer/views/nocode/views/editor/ai/components/NocodeEditorAiBlueprintPreviewWorkbench.vue'
import NocodeEditorAiFlowchart from '@renderer/views/nocode/views/editor/ai/components/NocodeEditorAiFlowchart.vue'
import NocodeEditorAiFlowPlanPreview from '@renderer/views/nocode/views/editor/ai/components/NocodeEditorAiFlowPlanPreview.vue'
import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiGeneratedBlueprintPageTarget,
  NocodeEditorAiStageBlueprintDisplayItem,
} from '@renderer/views/nocode/views/editor/ai/types'
import {
  type AiArtifactConfirmationQuestion,
  resolveAiArtifactCaption,
  resolveAiArtifactFormulaPlanItems,
  resolveAiArtifactQuestions,
  resolveAiArtifactTitle,
  resolveAiArtifactVersionLabel,
} from './artifactBlock'
import {
  resolveNocodeEditorFormulaPathLabel,
  resolveNocodeEditorFormulaPlanPresentation,
} from '@renderer/views/nocode/views/editor/ai/formulaPlanPresentation'

// eslint-disable-next-line vue/valid-define-props
const props = withDefaults(defineProps<{
  modelValue: boolean
  block?: AiAssistantArtifactBlock | null
  appName?: string
  blueprintWorkbenchItems?: NocodeEditorAiStageBlueprintDisplayItem[]
  blueprintWorkbenchHistoryItems?: NocodeEditorAiStageBlueprintDisplayItem[]
  blueprintPreviewFocusCardKey?: string
  flowArtifactBlocks?: NocodeEditorAiArtifactBlock[]
  getFlowConfirmationResponseDrafts?: (block: NocodeEditorAiArtifactBlock) => NocodeEditorAiConfirmationResponseDraftMap
  getFlowActiveConfirmationInputQuestionIds?: (block: NocodeEditorAiArtifactBlock) => string[]
  getFlowInlineConfirmationNoteQuestionIds?: (block: NocodeEditorAiArtifactBlock) => string[]
  canApplyFlowArtifact?: (block: NocodeEditorAiArtifactBlock) => boolean
  isApplyingFlowArtifact?: (block: NocodeEditorAiArtifactBlock) => boolean
  canApplyFlow?: boolean
  applyingFlow?: boolean
  canApplyBlueprint?: boolean
  canContinueBlueprint?: boolean
  applyingBlueprint?: boolean
  confirmationResponseDrafts?: NocodeEditorAiConfirmationResponseDraftMap
  activeConfirmationInputQuestionIds?: string[]
  inlineConfirmationNoteQuestionIds?: string[]
  submittingConfirmation?: boolean
}>(), {
  appName: '',
  blueprintWorkbenchItems: () => [],
  blueprintWorkbenchHistoryItems: () => [],
  blueprintPreviewFocusCardKey: '',
  flowArtifactBlocks: () => [],
  getFlowConfirmationResponseDrafts: undefined,
  getFlowActiveConfirmationInputQuestionIds: undefined,
  getFlowInlineConfirmationNoteQuestionIds: undefined,
  canApplyFlowArtifact: undefined,
  isApplyingFlowArtifact: undefined,
  canApplyFlow: false,
  applyingFlow: false,
  canApplyBlueprint: false,
  canContinueBlueprint: false,
  applyingBlueprint: false,
  confirmationResponseDrafts: () => ({}),
  activeConfirmationInputQuestionIds: () => [],
  inlineConfirmationNoteQuestionIds: () => [],
  submittingConfirmation: false,
})

// eslint-disable-next-line vue/valid-define-emits
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'apply-flow', block?: NocodeEditorAiArtifactBlock): void
  (event: 'apply-blueprint'): void
  (event: 'continue-blueprint-adjustment'): void
  (event: 'continue-flow-defaults', block: NocodeEditorAiArtifactBlock): void
  (event: 'select-confirmation-option', payload: {
    question: AiArtifactConfirmationQuestion
    option: NocodeEditorAiConfirmQuestionOption
  }): void
  (event: 'toggle-note-input', question: AiArtifactConfirmationQuestion): void
  (event: 'toggle-flow-note-input', payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
  }): void
  (event: 'update-note', payload: {
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
  (event: 'update-flow-note', payload: {
    block: NocodeEditorAiArtifactBlock
    question: AiArtifactConfirmationQuestion
    note: string
  }): void
  (event: 'submit-confirmation-responses'): void
  (event: 'submit-flow-confirmation-responses', block: NocodeEditorAiArtifactBlock): void
  (event: 'open-generated-page', payload: NocodeEditorAiGeneratedBlueprintPageTarget): void
}>()

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const dialogTitle = computed(() => {
  if (props.block?.kind === 'app-plan') {
    return i18next.t('aiArtifactPreviewDialog.appStructurePreview')
  }
  if (props.block?.kind === 'form-plan' && (props.block as any).applicationStructurePreview?.enabled) {
    return i18next.t('aiArtifactPreviewDialog.appStructurePreview')
  }
  return props.block
    ? resolveAiArtifactTitle(props.block)
    : i18next.t('aiArtifactPreviewDialog.viewDetails')
})

const headerVersionLabel = computed(() => (
  props.block?.kind === 'blueprint' ? '' : resolveAiArtifactVersionLabel(props.block)
))

const appPlan = computed(() => (
  props.block?.kind === 'app-plan' && (props.block as any).appPlan
    ? (props.block as any).appPlan as Record<string, any>
    : null
))

const buildFallbackAppPlanOutline = (plan: Record<string, any> | null) => {
  const artifacts = Array.isArray(plan?.artifacts) ? plan.artifacts : []
  const forms = artifacts
    .map((artifact: Record<string, any>, index: number) => {
      const tableName = String(artifact?.name || '').trim()
      if (!tableName) {
        return null
      }

      return {
        formKey: `artifact-${index + 1}`,
        tableName,
        description: String(artifact?.purpose || '').trim() || undefined,
      }
    })
    .filter((item): item is {
      formKey: string
      tableName: string
      description?: string
    } => Boolean(item))

  if (!forms.length) {
    return null
  }

  const goal = String(plan?.goal || '').trim()
  const objects = Array.isArray(plan?.objects)
    ? plan.objects.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : []
  const openQuestions = Array.isArray(plan?.openQuestions)
    ? plan.openQuestions.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : []
  const formKeys = forms
    .map(item => String(item.formKey || '').trim())
    .filter(Boolean)

  const objectNames = objects.slice(0, 4).join(i18next.t('aiArtifactPreviewDialog.listSeparator'))

  return {
    title: goal
      ? i18next.t('aiArtifactPreviewDialog.goalAppStructure', { goal })
      : i18next.t('aiArtifactPreviewDialog.appStructure'),
    summary: objects.length
      ? i18next.t('aiArtifactPreviewDialog.appStructureSummary', { objects: objectNames })
      : undefined,
    forms,
    modules: [{
      moduleKey: 'module-1',
      name: goal || i18next.t('aiArtifactPreviewDialog.overallStructure'),
      description: objects.length
        ? i18next.t('aiArtifactPreviewDialog.appStructureDescription', { objects: objectNames })
        : undefined,
      formKeys,
    }],
    flows: formKeys.slice(1).map((formKey: string, index: number) => ({
      from: formKeys[index],
      to: formKey,
    })),
    assumptions: [],
    openQuestions,
  }
}

const appPlanOutline = computed(() => (
  appPlan.value?.outline && typeof appPlan.value.outline === 'object'
    ? appPlan.value.outline
    : buildFallbackAppPlanOutline(appPlan.value)
))

const contentPlan = computed(() => (
  props.block?.kind === 'content-plan' && (props.block as any).plan
    ? (props.block as any).plan as Record<string, any>
    : null
))

const scopeLabelMap: Record<string, string> = {
  get board() { return i18next.t('aiArtifactPreviewDialog.boardScope') },
  get flow() { return i18next.t('aiArtifactPreviewDialog.flowScope') },
  get workflow() { return i18next.t('aiArtifactPreviewDialog.flowScope') },
  get formula() { return i18next.t('aiArtifactPreviewDialog.formulaScope') },
  get 'form-local'() { return i18next.t('aiArtifactPreviewDialog.formLocalScope') },
  get local() { return i18next.t('aiArtifactPreviewDialog.localScope') },
}

const contentPlanSummary = computed(() => (
  String(props.block?.summary || contentPlan.value?.summary || '').trim()
))

const contentPlanScope = computed(() => {
  const scope = String(contentPlan.value?.scope || '').trim()
  return scope
    ? i18next.t('aiArtifactPreviewDialog.planningScopeLabel', { scope: scopeLabelMap[scope] || scope })
    : ''
})

const contentPlanTarget = computed(() => {
  const target = contentPlan.value?.target && typeof contentPlan.value.target === 'object'
    ? contentPlan.value.target as Record<string, any>
    : {}
  const name = String(target.name || '').trim()
  const formName = String(target.formName || '').trim()
  if (!name && !formName) {
    return ''
  }
  return i18next.t('aiArtifactPreviewDialog.targetObjectLabel', {
    target: [formName, name].filter(Boolean).join(' / '),
  })
})

const contentPlanItems = computed(() => (
  Array.isArray(contentPlan.value?.items)
    ? contentPlan.value.items
      .map((item: any) => {
        const name = String(item?.name || '').trim()
        const purpose = String(item?.purpose || '').trim()
        return [name, purpose].filter(Boolean).join(getI18nLabelColon())
      })
      .filter(Boolean)
    : []
))

const contentPlanQuestions = computed(() => resolveAiArtifactQuestions(props.block))

const formulaPlan = computed(() => (
  props.block?.kind === 'formula-plan' && props.block.formulaPlan
    ? props.block.formulaPlan
    : null
))

const formulaPlanSummary = computed(() => (
  resolveNocodeEditorFormulaPlanPresentation(props.block)?.goal
  || String(props.block?.summary || formulaPlan.value?.summary || '').trim()
))

const formulaPlanItems = computed(() => resolveAiArtifactFormulaPlanItems(props.block))

const formulaPlanQuestions = computed(() => resolveAiArtifactQuestions(props.block))

const formulaPlanStatus = computed(() => (
  props.block?.kind === 'formula-plan'
    ? resolveAiArtifactCaption(props.block)
    : ''
))
</script>

<style lang="scss">
.el-dialog.nocode-editor-ai-preview-dialog {
  width: min(94vw, 1680px);
  height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 22px;
}

.el-dialog.nocode-editor-ai-preview-dialog .el-dialog__body {
  flex: 1;
  min-height: 0;
  padding-top: 4px;
  padding-bottom: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>

<style scoped lang="scss">
.preview-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.preview-dialog-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-dialog-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-color-primary);
}

.preview-dialog-version {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  background: #edf4ff;
  color: #3c67c2;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.preview-dialog-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
  padding-right: 6px;

  :deep(.ai-flowchart) {
    min-height: 100%;
  }
}

.preview-dialog-body.is-blueprint,
.preview-dialog-body.is-content-plan,
.preview-dialog-body.is-formula-plan,
.preview-dialog-body.is-flow-plan {
  overflow: auto;
}

.preview-dialog-body.is-app-plan,
.preview-dialog-body.is-form-plan {
  overflow: hidden;
  padding-right: 0;

  :deep(.ai-flowchart) {
    flex: 1;
    height: 100%;
  }
}

.preview-dialog-summary {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-color-regular);
}

.content-plan-preview {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 860px;
}

.formula-plan-preview {
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 860px;
}

.formula-plan-item-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-left: 20px;
}

.formula-plan-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.formula-plan-item__target {
  font-weight: 600;
  color: var(--text-color-primary);
}

.formula-plan-item__path,
.formula-plan-item__explanation {
  color: var(--text-color-regular);
}

.formula-plan-item__formula {
  display: block;
  padding: 8px 10px;
  border: 1px solid var(--border-color-light);
  border-radius: 6px;
  background: #f7f8fa;
  color: var(--text-color-primary);
  overflow-wrap: anywhere;
}

.formula-plan-item__explanation {
  margin: 0;
}

.content-plan-section {
  padding: 16px;
  border: 1px solid var(--border-color-light);
  border-radius: 14px;
  background: #fafcff;
  color: var(--text-color-regular);

  h3 {
    margin: 0 0 10px;
    font-size: 15px;
    color: var(--text-color-primary);
  }

  p,
  ol {
    margin: 0;
    line-height: 1.8;
  }

  ol {
    padding-left: 20px;
  }
}
</style>
