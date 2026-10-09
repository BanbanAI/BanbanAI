import { normalizeNocodeEditorFlowPlan } from '@common/utils/nocodeEditorFlowPlan'
import { buildLogicalPlanningConfirmationContextKey } from '@common/utils/nocodeEditorPlanningConfirmationIdentity'
import type {
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiMessage,
} from './types'

type FlowArtifactMessageLike = Pick<NocodeEditorAiMessage, 'metadata'>

type FlowArtifactAccessors<TMessage extends FlowArtifactMessageLike> = {
  getAllArtifactBlocks: (message: TMessage) => NocodeEditorAiArtifactBlock[]
  setMessageArtifactBlocks: (message: TMessage, blocks: NocodeEditorAiArtifactBlock[]) => void
}

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')
  .replace(/[？?！!，,。、“”"'‘’：:；;（）()【】[\]《》<>]/g, '')

const isReadyFlowArtifactBlock = (
  block?: NocodeEditorAiArtifactBlock | null,
): block is NocodeEditorAiArtifactBlock => (
  Boolean(
    block
    && block.kind === 'flow-plan'
    && block.status === 'ready'
    && block.flowPlan,
  )
)

const isAppliedReadyFlowArtifactBlock = (
  block?: NocodeEditorAiArtifactBlock | null,
): block is NocodeEditorAiArtifactBlock => (
  Boolean(
    isReadyFlowArtifactBlock(block)
    && block.flowApplyResult,
  )
)

const isFlowAppliedActionMessage = (
  message?: FlowArtifactMessageLike | null,
) => Boolean(message?.metadata?.flowAppliedFromAction)

const resolveFlowArtifactFinishedAt = (
  block?: NocodeEditorAiArtifactBlock | null,
) => Number(block?.flowApplyResult?.finishedAt || 0)

const buildFlowArtifactLogicalScopeKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const normalizedPlan = normalizeNocodeEditorFlowPlan(block?.flowPlan)
  if (!normalizedPlan) {
    return ''
  }

  return buildLogicalPlanningConfirmationContextKey({
    stage: 'flow-plan',
    outlineId: normalizedPlan.id || normalizedPlan.title || block?.title,
    primaryFormKey: normalizedPlan.target?.formId || normalizedPlan.target?.formName,
  })
}

const getFlowArtifactDraftIdentityKey = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  if (!isReadyFlowArtifactBlock(block)) {
    return ''
  }

  const revision = Number(block.revision || 0)
  const stagedAt = Number(block.stagedAt || 0)
  if (revision > 0 || stagedAt > 0) {
    return `state:${revision}:${stagedAt}`
  }

  const normalizedPlan = normalizeNocodeEditorFlowPlan(block.flowPlan)
  if (!normalizedPlan) {
    return ''
  }

  const planningContextKey = normalizeText(
    block.confirmation?.planningContextKey
    || normalizedPlan.confirmation?.planningContextKey,
  )
  const logicalScopeKey = buildFlowArtifactLogicalScopeKey(block)
  const targetFormId = normalizeText(normalizedPlan.target?.formId)
  const targetFormName = normalizeToken(normalizedPlan.target?.formName)
  const titleToken = normalizeToken(normalizedPlan.id || normalizedPlan.title || block.title)
  const scopeKey = planningContextKey || logicalScopeKey || titleToken
  if (!scopeKey) {
    return ''
  }

  return `plan:${scopeKey}|target:${targetFormId || targetFormName || 'unknown'}`
}

export const syncActionAppliedFlowHistory = <TMessage extends FlowArtifactMessageLike>(
  messages: TMessage[],
  accessors: FlowArtifactAccessors<TMessage>,
) => {
  const appliedBlocksByDraftIdentity = new Map<string, NocodeEditorAiArtifactBlock>()

  for (const message of Array.isArray(messages) ? messages : []) {
    if (!isFlowAppliedActionMessage(message)) {
      continue
    }

    for (const block of accessors.getAllArtifactBlocks(message)) {
      if (!isAppliedReadyFlowArtifactBlock(block)) {
        continue
      }

      const draftIdentityKey = getFlowArtifactDraftIdentityKey(block)
      if (!draftIdentityKey) {
        continue
      }

      const previousBlock = appliedBlocksByDraftIdentity.get(draftIdentityKey)
      if (!previousBlock || resolveFlowArtifactFinishedAt(block) >= resolveFlowArtifactFinishedAt(previousBlock)) {
        appliedBlocksByDraftIdentity.set(draftIdentityKey, block)
      }
    }
  }

  if (!appliedBlocksByDraftIdentity.size) {
    return
  }

  for (const message of Array.isArray(messages) ? messages : []) {
    const blocks = accessors.getAllArtifactBlocks(message)
    if (!blocks.length) {
      continue
    }

    let changed = false
    const nextBlocks = blocks.map((block) => {
      if (!isReadyFlowArtifactBlock(block) || block.flowApplyResult) {
        return block
      }

      const draftIdentityKey = getFlowArtifactDraftIdentityKey(block)
      const appliedBlock = draftIdentityKey
        ? appliedBlocksByDraftIdentity.get(draftIdentityKey)
        : undefined
      if (!appliedBlock) {
        return block
      }

      changed = true
      return {
        ...appliedBlock,
      }
    })

    if (changed) {
      accessors.setMessageArtifactBlocks(message, nextBlocks)
    }
  }
}

export const collectSyncedAppliedFlowArtifactDraftIdentityKeys = <TMessage extends FlowArtifactMessageLike>(
  messages: TMessage[],
  accessors: Pick<FlowArtifactAccessors<TMessage>, 'getAllArtifactBlocks'>,
) => {
  const actionDraftIdentityKeys = new Set<string>()
  const historicalDraftIdentityKeys = new Set<string>()

  for (const message of Array.isArray(messages) ? messages : []) {
    const isActionMessage = isFlowAppliedActionMessage(message)
    for (const block of accessors.getAllArtifactBlocks(message)) {
      if (!isAppliedReadyFlowArtifactBlock(block)) {
        continue
      }

      const draftIdentityKey = getFlowArtifactDraftIdentityKey(block)
      if (!draftIdentityKey) {
        continue
      }

      if (isActionMessage) {
        actionDraftIdentityKeys.add(draftIdentityKey)
      } else {
        historicalDraftIdentityKeys.add(draftIdentityKey)
      }
    }
  }

  return Array.from(actionDraftIdentityKeys).filter(key => historicalDraftIdentityKeys.has(key))
}

export const shouldHideAppliedFlowArtifactInActionMessage = (input: {
  message?: FlowArtifactMessageLike | null
  block?: NocodeEditorAiArtifactBlock | null
  syncedDraftIdentityKeys?: Iterable<string> | null
}) => {
  if (!isFlowAppliedActionMessage(input.message) || !isAppliedReadyFlowArtifactBlock(input.block)) {
    return false
  }

  const syncedDraftIdentityKeys = new Set(Array.from(input.syncedDraftIdentityKeys || []))
  const draftIdentityKey = getFlowArtifactDraftIdentityKey(input.block)
  return Boolean(draftIdentityKey && syncedDraftIdentityKeys.has(draftIdentityKey))
}
