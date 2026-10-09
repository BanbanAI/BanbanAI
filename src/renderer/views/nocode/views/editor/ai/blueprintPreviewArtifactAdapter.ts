import type { AiAssistantArtifactBlock } from '@common/types/ai'
import {
  isBlueprintAppliedPhase,
  normalizeBlueprintPhase,
} from '@common/utils/nocodeEditorBlueprintLifecycle'
import {
  normalizeNocodeEditorPlanningScopeValue,
} from '@common/utils/nocodeEditorPostFormFlowScope'
import {
  buildBlueprintWorkbenchViewModel,
  type BlueprintWorkbenchCard,
  type BlueprintWorkbenchMode,
} from './blueprintWorkbenchViewModel'
import {
  buildBlueprintArtifactVersionFromParts,
  getNocodeEditorAiBlueprintPlanningContextKey,
} from './blueprintArtifactIdentity'
import { normalizeBlueprintFormulaSettings } from './blueprintFormulaApply'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiStageBlueprintDisplayItem,
} from './types'
import i18next from 'i18next'

export type BlueprintPreviewScope = 'app' | 'form'

export type BlueprintPreviewSnapshot = {
  appName: string
  item: NocodeEditorAiStageBlueprintDisplayItem
  scope: BlueprintPreviewScope
}

const normalizeText = (value: unknown, fallback = '') => {
  const text = String(value || '').trim()
  return text || fallback
}

const normalizeNumber = (value: unknown) => {
  const nextValue = Number(value || 0)
  return nextValue > 0 ? nextValue : undefined
}

const normalizeIdentityToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')
  .replace(/[^\p{Letter}\p{Number}]/gu, '')

const resolveBlueprintPreviewMode = (
  item: NocodeEditorAiStageBlueprintDisplayItem,
): BlueprintWorkbenchMode => (
  item.itemKind === 'ai_blueprint' && isBlueprintAppliedPhase(item.phase)
    ? 'generated'
    : 'review'
)

export const buildBlueprintPreviewSnapshot = (input: {
  block?: AiAssistantArtifactBlock | null
  appName?: string
}): BlueprintPreviewSnapshot | null => {
  const block = input.block
  if (!block || block.kind !== 'blueprint' || block.status !== 'ready' || !block.blueprint) {
    return null
  }

  const versionKey = buildBlueprintArtifactVersionFromParts(block)
  const blueprint = normalizeBlueprintFormulaSettings({
    ...(block.blueprint as NocodeEditorAiAppBlueprint),
    confirmation: block.confirmation || (block.blueprint as any)?.confirmation || undefined,
  } as NocodeEditorAiAppBlueprint).blueprint
  const phase = normalizeBlueprintPhase(block.phase)
  const applyResult = (block.applyResult as any) || null
  const appliedAt = Number(applyResult?.finishedAt || 0) || undefined

  const item: NocodeEditorAiStageBlueprintDisplayItem = {
    itemKind: 'ai_blueprint',
    id: versionKey || normalizeText((block.blueprint as any)?.id, 'preview-blueprint'),
    identityKey: normalizeText((block.blueprint as any)?.id, versionKey || 'preview-blueprint'),
    planningScope: normalizeNocodeEditorPlanningScopeValue(block.planningScope),
    phase,
    status: phase,
    source: isBlueprintAppliedPhase(phase) ? 'ai-apply' : 'ai-staged',
    title: normalizeText(block.title || blueprint.title, i18next.t('blueprintPreviewArtifactAdapter.blueprintDraft')),
    summary: normalizeText(block.summary || blueprint.summary) || undefined,
    updatedAt: Number(appliedAt || block.stagedAt || Date.now()),
    appliedAt,
    displayRevision: normalizeNumber((block as any).displayRevision),
    displayVersionLabel: normalizeText((block as any).displayVersionLabel) || undefined,
    revision: Number(block.revision || 0) || undefined,
    stagedAt: Number(block.stagedAt || 0) || undefined,
    sourcePlanningContextKey: getNocodeEditorAiBlueprintPlanningContextKey({
      block: block as any,
      blueprint,
      sourcePlanningContextKey: (block as any).sourcePlanningContextKey,
    }),
    applyResult,
    draftPersistenceState: (block as any).draftPersistenceState || applyResult?.draftPersistenceState || null,
    blueprint,
  }

  const workbench = buildBlueprintWorkbenchViewModel({
    items: [item],
    activeMode: resolveBlueprintPreviewMode(item),
  })

  return {
    appName: normalizeText(input.appName),
    item,
    scope: workbench.cards.length > 1 || workbench.groups.length > 1 ? 'app' : 'form',
  }
}

const buildFormFocusIdentity = (form?: NocodeEditorAiAppBlueprintForm | null) => {
  const formKey = normalizeText(form?.formKey)
  const tableName = normalizeIdentityToken(form?.tableName || (form as any)?.name)
  const groupName = normalizeIdentityToken(form?.groupName)
  if (formKey) {
    return `form:${formKey}`
  }

  return [
    groupName ? `group:${groupName}` : 'group:unknown',
    tableName ? `table:${tableName}` : 'table:unknown',
  ].join('|')
}

const hasSameVersionSignal = (
  left: NocodeEditorAiStageBlueprintDisplayItem,
  right: NocodeEditorAiStageBlueprintDisplayItem,
) => {
  const leftRevision = Number(left.revision || 0)
  const rightRevision = Number(right.revision || 0)
  const leftStagedAt = Number(left.stagedAt || 0)
  const rightStagedAt = Number(right.stagedAt || 0)
  const leftAppliedAt = Number(left.applyResult?.finishedAt || left.appliedAt || 0)
  const rightAppliedAt = Number(right.applyResult?.finishedAt || right.appliedAt || 0)

  if ((leftRevision || rightRevision) && leftRevision !== rightRevision) {
    return false
  }
  if ((leftStagedAt || rightStagedAt) && leftStagedAt !== rightStagedAt) {
    return false
  }
  if ((leftAppliedAt || rightAppliedAt) && leftAppliedAt !== rightAppliedAt) {
    return false
  }

  return Boolean(leftRevision || leftStagedAt || leftAppliedAt || rightRevision || rightStagedAt || rightAppliedAt)
}

const doesPreviewCardMatchSharedCard = (
  targetCard: BlueprintWorkbenchCard,
  sharedCard: BlueprintWorkbenchCard,
) => {
  const targetItem = targetCard.item
  const sharedItem = sharedCard.item
  if (targetCard.mode !== sharedCard.mode) {
    return false
  }

  if (normalizeText(targetItem.phase) !== normalizeText(sharedItem.phase)) {
    return false
  }

  if (!hasSameVersionSignal(targetItem, sharedItem)) {
    return false
  }

  const targetPlanningContextKey = normalizeText(targetItem.sourcePlanningContextKey)
  const sharedPlanningContextKey = normalizeText(sharedItem.sourcePlanningContextKey)
  if (
    targetPlanningContextKey
    && sharedPlanningContextKey
    && targetPlanningContextKey !== sharedPlanningContextKey
  ) {
    return false
  }

  return buildFormFocusIdentity(targetCard.form) === buildFormFocusIdentity(sharedCard.form)
}

export const resolveBlueprintPreviewInitialFocusCardKey = (input: {
  block?: AiAssistantArtifactBlock | null
  appName?: string
  workbenchItems?: NocodeEditorAiStageBlueprintDisplayItem[]
}) => {
  const snapshot = buildBlueprintPreviewSnapshot({
    block: input.block,
    appName: input.appName,
  })
  const sharedItems = Array.isArray(input.workbenchItems) ? input.workbenchItems : []
  if (!snapshot || !sharedItems.length) {
    return ''
  }

  const activeMode = resolveBlueprintPreviewMode(snapshot.item)
  const targetWorkbench = buildBlueprintWorkbenchViewModel({
    items: [snapshot.item],
    activeMode,
    includeAllStatuses: true,
  })
  const sharedWorkbench = buildBlueprintWorkbenchViewModel({
    items: sharedItems,
    activeMode,
    includeAllStatuses: true,
  })

  for (const targetCard of targetWorkbench.cards) {
    const sharedCard = sharedWorkbench.cards.find(card => doesPreviewCardMatchSharedCard(targetCard, card))
    if (sharedCard) {
      return sharedCard.key
    }
  }

  return ''
}
