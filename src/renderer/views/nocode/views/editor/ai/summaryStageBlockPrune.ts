import type { AiAssistantMessageBlock } from '@common/types/ai'
import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiMessageArtifactKind,
  NocodeEditorAiSummaryStage,
} from './types'

const normalizeSummaryStage = (value: unknown): NocodeEditorAiSummaryStage | '' => {
  const normalized = String(value || '').trim().toLowerCase()
  if (
    normalized === 'plain-assistant'
    || normalized === 'app-plan'
    || normalized === 'form-plan'
    || normalized === 'content-plan'
    || normalized === 'formula-plan'
    || normalized === 'flow-scheme'
    || normalized === 'flow-plan'
    || normalized === 'blueprint'
  ) {
    return normalized as NocodeEditorAiSummaryStage
  }
  return ''
}

const STAGE_ARTIFACT_KIND_MAP: Partial<Record<NocodeEditorAiSummaryStage, NocodeEditorAiMessageArtifactKind[]>> = {
  'app-plan': ['app-plan'],
  'form-plan': ['form-plan'],
  'content-plan': ['content-plan'],
  'formula-plan': ['formula-plan'],
  'flow-scheme': ['flow-scheme'],
  'flow-plan': ['flow-plan'],
  blueprint: ['blueprint'],
}

const SUMMARY_STAGE_ARTIFACT_KINDS = new Set<NocodeEditorAiMessageArtifactKind>(
  Object.values(STAGE_ARTIFACT_KIND_MAP).flat(),
)

const PERSISTENT_PLANNING_CHAIN_KINDS = new Set<NocodeEditorAiMessageArtifactKind>([
  'app-plan',
  'form-plan',
  'content-plan',
  'formula-plan',
  'flow-scheme',
  'blueprint',
])

const TOOL_SUMMARY_STAGE_MAP: Partial<Record<string, NocodeEditorAiSummaryStage>> = {
  editor_stage_app_plan: 'app-plan',
  editor_stage_single_form_plan: 'form-plan',
  editor_stage_content_plan: 'content-plan',
  editor_stage_formula_plan: 'formula-plan',
  editor_plan_flow_scheme: 'flow-scheme',
  editor_stage_flow_blueprint: 'flow-plan',
  editor_apply_staged_flow: 'flow-plan',
  editor_stage_app_blueprint: 'blueprint',
}

const isFormulaPlanDecisionOrLoadingBlock = (block: NocodeEditorAiArtifactBlock) => {
  if (block.kind !== 'formula-plan') {
    return false
  }
  if (block.status === 'loading') {
    return true
  }
  const openQuestions = Array.isArray(block.formulaPlan?.openQuestions)
    ? block.formulaPlan.openQuestions
    : []
  const confirmation = block.confirmation
  return openQuestions.length > 0 || (
    confirmation?.status === 'pending'
    && Array.isArray(confirmation.questions)
    && confirmation.questions.length > 0
  )
}

export const resolveIncomingSummaryStage = (
  value?: {
    summaryStage?: unknown
    toolName?: unknown
    actionName?: unknown
  } | null,
): NocodeEditorAiSummaryStage | '' => {
  const explicitStage = normalizeSummaryStage(value?.summaryStage)
  if (explicitStage) {
    return explicitStage
  }

  const toolName = String(value?.toolName || value?.actionName || '').trim()
  return TOOL_SUMMARY_STAGE_MAP[toolName] || ''
}

export const pruneStaleSummaryStageBlocks = (
  blocks: AiAssistantMessageBlock[],
  options: {
    currentSummaryStage?: unknown
    nextSummaryStage?: unknown
  },
) => {
  const currentSummaryStage = normalizeSummaryStage(options.currentSummaryStage)
  const nextSummaryStage = normalizeSummaryStage(options.nextSummaryStage)
  if (!nextSummaryStage || currentSummaryStage === nextSummaryStage) {
    return blocks
  }

  const keepKinds = STAGE_ARTIFACT_KIND_MAP[nextSummaryStage]
  if (!keepKinds?.length) {
    if (currentSummaryStage === 'formula-plan' && nextSummaryStage === 'plain-assistant') {
      return blocks.filter((block) => (
        block.type !== 'artifact'
        || !isFormulaPlanDecisionOrLoadingBlock(block as NocodeEditorAiArtifactBlock)
      ))
    }
    return blocks
  }

  const hasStaleStageArtifact = blocks.some((block) => {
    if (block.type !== 'artifact') {
      return false
    }
    const kind = String((block as NocodeEditorAiArtifactBlock).kind || '').trim() as NocodeEditorAiMessageArtifactKind
    return SUMMARY_STAGE_ARTIFACT_KINDS.has(kind) && !keepKinds.includes(kind)
  })
  if (!currentSummaryStage && !hasStaleStageArtifact) {
    return blocks
  }

  return blocks.filter((block) => {
    if (block.type !== 'artifact') {
      return false
    }

    const artifactBlock = block as NocodeEditorAiArtifactBlock
    const kind = String(artifactBlock.kind || '').trim() as NocodeEditorAiMessageArtifactKind
    if (artifactBlock.status === 'loading' && !keepKinds.includes(kind)) {
      return false
    }
    return PERSISTENT_PLANNING_CHAIN_KINDS.has(kind) || keepKinds.includes(kind)
  })
}
