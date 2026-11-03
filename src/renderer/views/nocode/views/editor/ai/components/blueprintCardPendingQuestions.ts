import { resolveAiArtifactPendingQuestions } from '@renderer/views/nocode/components/ai/artifactBlock'
import { isBlueprintStagedPhase } from '@common/utils/nocodeEditorBlueprintLifecycle'
import { buildBlueprintArtifactBlockFromWorkbenchCard } from './blueprintWorkbenchArtifactBlock'
import {
  buildBlueprintConfirmationQuestionScope,
  isBlueprintConfirmationQuestionInScope,
} from './blueprintConfirmationQuestionScope'
import type { BlueprintWorkbenchCard } from '../blueprintWorkbenchViewModel'

// 一张卡只代表一张表单：字段级问题按 decisionTarget 归属，蓝图级问题只在首张表单计一次。
export const resolveBlueprintCardPendingQuestions = (card?: BlueprintWorkbenchCard | null) => {
  if (!card || !isBlueprintStagedPhase(card.item.phase)) {
    return []
  }
  const block = buildBlueprintArtifactBlockFromWorkbenchCard(card)
  if (!block) {
    return []
  }
  const scope = buildBlueprintConfirmationQuestionScope(card.item, card.form)
  const pendingQuestions = resolveAiArtifactPendingQuestions(block)
  return scope
    ? pendingQuestions.filter(question => isBlueprintConfirmationQuestionInScope(question, scope))
    : pendingQuestions
}

export const countBlueprintCardPendingQuestions = (
  card?: BlueprintWorkbenchCard | null,
) => resolveBlueprintCardPendingQuestions(card).length

// 只有一个表单有待确认时，打开弹窗可以直接聚焦它；多个都有时保持总览。
export const resolveUniquePendingBlueprintCardKey = (cards: BlueprintWorkbenchCard[]) => {
  const pendingCards = cards.filter(card => countBlueprintCardPendingQuestions(card) > 0)
  return pendingCards.length === 1 ? pendingCards[0].key : ''
}
