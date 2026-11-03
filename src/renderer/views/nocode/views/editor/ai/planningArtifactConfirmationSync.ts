import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import {
  applyNocodeEditorFlowPlanConfirmation,
} from '@common/utils/nocodeEditorFlowPlan'
import {
  resolveAiArtifactConfirmation,
} from '@renderer/views/nocode/components/ai/artifactBlock'
import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiSolutionOutline,
} from './types'

type NocodeEditorAiSolutionOutlineWithConfirmation = NocodeEditorAiSolutionOutline & {
  confirmation?: NocodeEditorAiConfirmPayload | null
}

type NocodeEditorAiAppPlanWithConfirmation = NonNullable<NocodeEditorAiArtifactBlock['appPlan']> & {
  outline?: NocodeEditorAiSolutionOutlineWithConfirmation | null
}

const clonePlanningArtifactValue = <T,>(value: T): T => (
  value == null ? value : JSON.parse(JSON.stringify(value))
)

const withClonedConfirmation = <T extends Record<string, unknown>>(
  value: T | null | undefined,
  confirmation: NocodeEditorAiConfirmPayload,
) => (
  value
    ? {
      ...clonePlanningArtifactValue(value),
      confirmation: clonePlanningArtifactValue(confirmation),
    }
    : value
)

const withClonedOutlineConfirmation = (
  outline: NocodeEditorAiSolutionOutlineWithConfirmation | null | undefined,
  confirmation: NocodeEditorAiConfirmPayload,
) => (
  outline
    ? {
      ...clonePlanningArtifactValue(outline),
      confirmation: clonePlanningArtifactValue(confirmation),
    }
    : outline
)

const questionHasStoredAnswer = (question: NocodeEditorAiConfirmQuestion) => Boolean(
  question.confirmed === true
  || String(question.selectedOptionValue || '').trim()
  || String(question.answerSummary || '').trim()
  || String(question.answerDetail || '').trim()
  || question.options?.some(option => option.selected)
)

const resolveConfirmationQuestionKey = (question: NocodeEditorAiConfirmQuestion) => (
  String(question.decisionKey || '').trim() || String(question.id || '').trim()
)

/**
 * flow-scheme 的 confirmation 携带本轮判定的题目；规划重建后同 revision/stagedAt
 * 的旧卡片与新卡片会共享 draftKey。若直接整体替换，新卡片的待答题目会被旧答案
 * 吞掉。这里改为按题目键合并：只有被旧答案覆盖的待答题继承结果，其余保持待答；
 * 完全无覆盖时原样保留当前卡片（题目已按最新规划重建，应由用户重新确认）。
 */
const mergeFlowSchemeConfirmationCarryover = (
  current: NocodeEditorAiConfirmPayload,
  carryover: NocodeEditorAiConfirmPayload,
): NocodeEditorAiConfirmPayload => {
  const currentQuestions = Array.isArray(current.questions) ? current.questions : []
  const hasPendingQuestion = currentQuestions.some(question => !questionHasStoredAnswer(question))
  if (!hasPendingQuestion) {
    return carryover
  }

  const carriedQuestionsByKey = new Map<string, NocodeEditorAiConfirmQuestion>()
  for (const question of Array.isArray(carryover.questions) ? carryover.questions : []) {
    const key = resolveConfirmationQuestionKey(question)
    if (key && questionHasStoredAnswer(question)) {
      carriedQuestionsByKey.set(key, question)
    }
  }

  let matchedPendingCount = 0
  const nextQuestions = currentQuestions.map((question) => {
    if (questionHasStoredAnswer(question)) {
      return question
    }
    const carriedQuestion = carriedQuestionsByKey.get(resolveConfirmationQuestionKey(question))
    if (!carriedQuestion) {
      return question
    }
    matchedPendingCount += 1
    return carriedQuestion
  })

  if (!matchedPendingCount) {
    return current
  }
  if (nextQuestions.every(question => questionHasStoredAnswer(question))) {
    return {
      ...carryover,
      questions: nextQuestions,
    }
  }
  return {
    ...current,
    questions: nextQuestions,
  }
}

export const reconcilePlanningArtifactConfirmation = (
  block: NocodeEditorAiArtifactBlock,
  carryoverConfirmation?: NocodeEditorAiConfirmPayload | null,
) => {
  const currentConfirmation = resolveAiArtifactConfirmation(block)

  if (block.kind === 'flow-plan') {
    const nextFlowPlan = applyNocodeEditorFlowPlanConfirmation(
      block.flowPlan
        ? {
          ...clonePlanningArtifactValue(block.flowPlan),
          ...(currentConfirmation
            ? { confirmation: clonePlanningArtifactValue(currentConfirmation) }
            : {}),
        }
        : null,
      carryoverConfirmation ? clonePlanningArtifactValue(carryoverConfirmation) : undefined,
    )
    const nextConfirmation = nextFlowPlan?.confirmation
      || currentConfirmation
      || carryoverConfirmation
      || null

    return {
      ...block,
      confirmation: nextConfirmation ? clonePlanningArtifactValue(nextConfirmation) : undefined,
      flowPlan: nextFlowPlan ? clonePlanningArtifactValue(nextFlowPlan) : block.flowPlan,
    }
  }

  const nextConfirmation = block.kind === 'flow-scheme' && carryoverConfirmation && currentConfirmation
    ? mergeFlowSchemeConfirmationCarryover(currentConfirmation, carryoverConfirmation)
    : (carryoverConfirmation || currentConfirmation)
  if (!nextConfirmation) {
    return block
  }

  const nextBlock: NocodeEditorAiArtifactBlock = {
    ...block,
    confirmation: clonePlanningArtifactValue(nextConfirmation),
  }

  if (block.kind === 'form-plan') {
    const nextOutline = withClonedOutlineConfirmation(block.outline, nextConfirmation)
    return nextOutline
      ? {
        ...nextBlock,
        outline: nextOutline,
      }
      : nextBlock
  }

  if (block.kind === 'app-plan') {
    const nextAppPlan = block.appPlan
      ? clonePlanningArtifactValue(block.appPlan) as NocodeEditorAiAppPlanWithConfirmation
      : null
    if (nextAppPlan?.outline) {
      nextAppPlan.outline = withClonedOutlineConfirmation(nextAppPlan.outline, nextConfirmation) || null
    }

    const nextBlockOutline = withClonedOutlineConfirmation(block.outline, nextConfirmation)

    return {
      ...nextBlock,
      appPlan: nextAppPlan || block.appPlan,
      ...(nextBlockOutline
        ? {
          outline: nextBlockOutline,
        }
        : {}),
    }
  }

  if (block.kind === 'content-plan') {
    const nextPlan = withClonedConfirmation(block.plan, nextConfirmation)
    return nextPlan
      ? {
        ...nextBlock,
        plan: nextPlan,
      }
      : nextBlock
  }

  if (block.kind === 'formula-plan') {
    const nextFormulaPlan = withClonedConfirmation(block.formulaPlan, nextConfirmation)
    return nextFormulaPlan
      ? {
        ...nextBlock,
        formulaPlan: nextFormulaPlan,
      }
      : nextBlock
  }

  if (block.kind === 'flow-scheme') {
    const nextScheme = withClonedConfirmation(block.scheme, nextConfirmation)
    return nextScheme
      ? {
        ...nextBlock,
        scheme: nextScheme,
      }
      : nextBlock
  }

  return nextBlock
}
