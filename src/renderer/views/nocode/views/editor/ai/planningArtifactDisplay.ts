import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiStagedAppPlan,
  NocodeEditorAiStagedFormPlan,
  NocodeEditorAiStagedFormulaPlan,
} from './types'
import {
  isFlowSchemePrerequisiteMissingBlock,
  resolveAiArtifactConfirmation,
  resolveAiArtifactConfirmationQuestionCount,
  resolveAiArtifactConfirmationStatus,
  shouldRenderAiArtifactInlineConfirmation,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import { doesAppPlanArtifactMatchStagedState } from './appPlanArtifactState'
import {
  shouldAutoContinueFlowBlueprintFromScheme,
  shouldHideNonUserActionableFlowSchemeSystemError,
} from './flowSchemeAutoContinue'
import { resolveNocodeEditorFormulaPlanDisplayMode } from '@common/utils/nocodeEditorFormulaDomain'

type ResolvePlanningArtifactDisplayStateInput = {
  block: NocodeEditorAiArtifactBlock
  stagedAppPlan?: NocodeEditorAiStagedAppPlan | null
  stagedFormPlan?: NocodeEditorAiStagedFormPlan | null
  stagedFormulaPlan?: NocodeEditorAiStagedFormulaPlan | null
  allowHistoricalCompletedFlowSchemeCard?: boolean
  flowSchemeCardExpired?: boolean
}

export type PlanningArtifactDisplayState = {
  renderAsConfirmation: boolean
  renderAsGenericArtifact: boolean
  readonly: boolean
  hiddenAutoContinuedPlanningCard?: boolean
}

const normalizePositiveNumber = (value: unknown) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0
}

const resolveConfirmationKeyRevision = (value?: string | null) => {
  const match = String(value || '').trim().match(/:(\d+):(\d+)$/)
  if (!match) {
    return null
  }
  return {
    revision: Number(match[1]),
    stagedAt: Number(match[2]),
  }
}

// 零题规划卡的显式 completed 会被状态解析视为空状态（避免空卡冒充完成），
// 但自动续跑判断仍需要认出它是一张已确认完成的卡。
const isCompletedPlanningConfirmation = (block: NocodeEditorAiArtifactBlock) => (
  resolveAiArtifactConfirmationStatus(block) === 'completed'
  || (
    resolveAiArtifactConfirmationQuestionCount(block) <= 0
    && String(resolveAiArtifactConfirmation(block)?.status || '').trim().toLowerCase() === 'completed'
  )
)

// 用户答完问题后自动续跑会再暂存一版规划，这版沿用上一轮的确认结果（completed），
// planningContextKey 仍指向被确认的旧版本。它不是新的待确认卡片，不应插入时间线。
const isAutoContinuedPlanningCard = (block: NocodeEditorAiArtifactBlock) => {
  if (block.kind !== 'app-plan' && block.kind !== 'form-plan') {
    return false
  }
  if (block.status !== 'ready' || !isCompletedPlanningConfirmation(block)) {
    return false
  }

  const confirmationKeyRevision = resolveConfirmationKeyRevision(
    resolveAiArtifactConfirmation(block)?.planningContextKey,
  )
  const blockRevision = normalizePositiveNumber(block.revision)
  const blockStagedAt = normalizePositiveNumber(block.stagedAt)
  if (!confirmationKeyRevision || !blockRevision || !blockStagedAt) {
    return false
  }

  return (
    confirmationKeyRevision.revision !== blockRevision
    || confirmationKeyRevision.stagedAt !== blockStagedAt
  )
}

const isSameFormulaSourceContext = (
  blockSourceContext: Record<string, unknown> | null | undefined,
  stagedSourceContext: Record<string, unknown> | null | undefined,
) => {
  const blockContext = blockSourceContext || {}
  const stagedContext = stagedSourceContext || {}
  const normalizeText = (value: unknown) => String(value || '').trim()
  const normalizeDraftRevision = (value: unknown) => {
    const revision = Number(value)
    return Number.isFinite(revision) ? revision : null
  }

  return (
    normalizeText(blockContext.taskId) === normalizeText(stagedContext.taskId)
    && normalizeText(blockContext.taskScopeKey) === normalizeText(stagedContext.taskScopeKey)
    && normalizeText(blockContext.nocodeId) === normalizeText(stagedContext.nocodeId)
    && normalizeText(blockContext.formId) === normalizeText(stagedContext.formId)
    && normalizeDraftRevision(blockContext.draftRevision) === normalizeDraftRevision(stagedContext.draftRevision)
    && normalizeText(blockContext.evidenceFingerprint) === normalizeText(stagedContext.evidenceFingerprint)
  )
}

export const resolvePlanningArtifactDisplayState = (
  input: ResolvePlanningArtifactDisplayStateInput,
): PlanningArtifactDisplayState => {
  const {
    block,
    stagedAppPlan,
    stagedFormPlan,
    stagedFormulaPlan,
    allowHistoricalCompletedFlowSchemeCard = false,
    flowSchemeCardExpired = false,
  } = input

  if (block.kind === 'formula-plan') {
    const isReady = block.status === 'ready'
    if (!isReady) {
      return {
        renderAsConfirmation: false,
        renderAsGenericArtifact: true,
        readonly: false,
      }
    }

    const blockRevision = normalizePositiveNumber(block.revision)
    const stagedRevision = normalizePositiveNumber(stagedFormulaPlan?.revision)
    const blockStagedAt = normalizePositiveNumber(block.stagedAt)
    const stagedAt = normalizePositiveNumber(stagedFormulaPlan?.stagedAt)
    const isCurrent = Boolean(
      stagedFormulaPlan?.plan
      && blockRevision > 0
      && stagedRevision > 0
      && blockStagedAt > 0
      && stagedAt > 0
      && blockRevision === stagedRevision
      && blockStagedAt === stagedAt
      && isSameFormulaSourceContext(
        block.sourceContext as Record<string, unknown> | null | undefined,
        stagedFormulaPlan.sourceContext as Record<string, unknown> | null | undefined,
      ),
    )
    const displayMode = resolveNocodeEditorFormulaPlanDisplayMode(block.formulaPlan)
    if (!isCurrent) {
      return {
        renderAsConfirmation: false,
        renderAsGenericArtifact: true,
        readonly: true,
      }
    }
    if (displayMode === 'decision') {
      return {
        renderAsConfirmation: true,
        renderAsGenericArtifact: false,
        readonly: false,
      }
    }
    if (displayMode === 'hidden' && isCurrent) {
      return {
        renderAsConfirmation: false,
        renderAsGenericArtifact: false,
        readonly: false,
      }
    }

    return {
      renderAsConfirmation: false,
      renderAsGenericArtifact: true,
      readonly: !isCurrent,
    }
  }

  if (isAutoContinuedPlanningCard(block)) {
    return {
      renderAsConfirmation: false,
      renderAsGenericArtifact: false,
      readonly: false,
      hiddenAutoContinuedPlanningCard: true,
    }
  }

  if (block.kind === 'app-plan') {
    const isCurrent = doesAppPlanArtifactMatchStagedState(block, stagedAppPlan)
    const isReady = block.status === 'ready'
    return {
      renderAsConfirmation: isReady,
      renderAsGenericArtifact: !isReady,
      readonly: isReady && !isCurrent,
    }
  }

  if (block.kind === 'form-plan') {
    const blockRevision = normalizePositiveNumber(block.revision)
    const stagedRevision = normalizePositiveNumber(stagedFormPlan?.revision)
    const blockStagedAt = normalizePositiveNumber(block.stagedAt)
    const stagedAt = normalizePositiveNumber(stagedFormPlan?.stagedAt)
    const isCurrent = Boolean(
      stagedFormPlan?.outline
      && block.status === 'ready'
      && blockRevision > 0
      && stagedRevision > 0
      && blockStagedAt > 0
      && stagedAt > 0
      && blockRevision === stagedRevision
      && blockStagedAt === stagedAt,
    )
    const isReady = block.status === 'ready'
    return {
      renderAsConfirmation: isReady,
      renderAsGenericArtifact: !isReady,
      readonly: isReady && !isCurrent,
    }
  }

  // 历史会话里由“前置缺失”伪造的 flow-scheme 块既不是方案也不是问题，直接隐藏。
  if (block.kind === 'flow-scheme' && isFlowSchemePrerequisiteMissingBlock(block)) {
    return {
      renderAsConfirmation: false,
      renderAsGenericArtifact: false,
      readonly: false,
    }
  }

  // 内部自纠类 system_error 一律不作为用户可见卡片，优先于「historical completed」放行。
  if (block.kind === 'flow-scheme' && shouldHideNonUserActionableFlowSchemeSystemError(block)) {
    return {
      renderAsConfirmation: false,
      renderAsGenericArtifact: false,
      readonly: false,
    }
  }

  // 被同上下文更新版本取代的待确认卡：保留在时间线上，只读并标记已过期。
  // 整卡隐藏会让「已暂存成功」文案失去对应卡片，用户也无法回看旧一版问了什么。
  if (
    flowSchemeCardExpired
    && block.kind === 'flow-scheme'
    && block.status === 'ready'
    && resolveAiArtifactConfirmationStatus(block) !== 'completed'
  ) {
    return {
      renderAsConfirmation: true,
      renderAsGenericArtifact: false,
      readonly: true,
    }
  }

  if (
    block.kind === 'flow-scheme'
    && allowHistoricalCompletedFlowSchemeCard
    && resolveAiArtifactConfirmationStatus(block) === 'completed'
  ) {
    return {
      renderAsConfirmation: true,
      renderAsGenericArtifact: false,
      readonly: true,
    }
  }

  // 自动续跑蓝图时保留已确认方案的只读完成卡：卡片自带本轮已答题，可正常呈现确认结果；
  // 无题可渲染时退回通用记录卡，避免方案确认完成后直接从时间线消失。
  if (block.kind === 'flow-scheme' && shouldAutoContinueFlowBlueprintFromScheme(block)) {
    const canRenderCompletedCard = resolveAiArtifactConfirmationStatus(block) === 'completed'
    return {
      renderAsConfirmation: canRenderCompletedCard,
      renderAsGenericArtifact: !canRenderCompletedCard,
      readonly: true,
    }
  }

  const renderAsConfirmation = shouldRenderAiArtifactInlineConfirmation(block)
  return {
    renderAsConfirmation,
    renderAsGenericArtifact: !renderAsConfirmation,
    readonly: false,
  }
}
