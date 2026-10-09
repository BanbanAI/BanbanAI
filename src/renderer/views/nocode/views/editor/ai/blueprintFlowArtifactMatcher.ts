import { normalizeNocodeEditorFlowPlan } from '@common/utils/nocodeEditorFlowPlan'
import { buildLogicalPlanningConfirmationContextKey } from '@common/utils/nocodeEditorPlanningConfirmationIdentity'
import type {
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiArtifactBlock,
  NocodeEditorAiBlueprintApplyFormResult,
  NocodeEditorAiStageBlueprintDisplayItem,
} from './types'

export type MatchedBlueprintFlowArtifact = {
  block: NocodeEditorAiArtifactBlock
  flowPlan: NonNullable<NocodeEditorAiArtifactBlock['flowPlan']>
  matchedBy: 'formId' | 'formName'
}

export type BlueprintFormFlowArtifactContext = {
  activeFlowArtifact: MatchedBlueprintFlowArtifact | null
  flowHistoryArtifacts: MatchedBlueprintFlowArtifact[]
  isCurrentStagedFlow: boolean
}

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')
  .replace(/[？?！!，,。、“”"'‘’：:；;（）()【】[\]《》<>]/g, '')

const buildFlowArtifactIdentityKey = (block: NocodeEditorAiArtifactBlock) => {
  const version = normalizeText(block.version)
  if (version) {
    return `version:${version}`
  }

  const revision = Number(block.revision || 0)
  const stagedAt = Number(block.stagedAt || 0)
  const finishedAt = Number(block.flowApplyResult?.finishedAt || 0)
  if (revision > 0 || stagedAt > 0 || finishedAt > 0) {
    return `state:${revision}:${stagedAt}:${finishedAt}`
  }

  const flowId = normalizeText(block.flowPlan?.id)
  if (flowId) {
    return `flow:${flowId}`
  }

  return ''
}

const buildFlowArtifactLogicalScopeKey = (block: NocodeEditorAiArtifactBlock) => {
  const normalizedPlan = normalizeNocodeEditorFlowPlan(block.flowPlan)
  if (!normalizedPlan) {
    return ''
  }

  const logicalKey = buildLogicalPlanningConfirmationContextKey({
    stage: 'flow-plan',
    outlineId: normalizedPlan.id || normalizedPlan.title || block.title,
    primaryFormKey: normalizedPlan.target?.formId || normalizedPlan.target?.formName,
  })
  return logicalKey || ''
}

const resolveFlowArtifactSortTime = (block: NocodeEditorAiArtifactBlock) => Number(
  block.flowApplyResult?.finishedAt || block.stagedAt || 0,
)

const resolveFlowArtifactRevision = (block: NocodeEditorAiArtifactBlock) => Number(block.revision || 0)

const pickMatchedApplyFormResult = (
  item: NocodeEditorAiStageBlueprintDisplayItem | null | undefined,
  form: NocodeEditorAiAppBlueprintForm | null | undefined,
): NocodeEditorAiBlueprintApplyFormResult | null => {
  const resultForms = Array.isArray(item?.applyResult?.forms)
    ? item!.applyResult!.forms
    : []
  if (!resultForms.length) {
    return null
  }

  const formKey = normalizeText(form?.formKey)
  const tableName = normalizeText(form?.tableName)

  return resultForms.find(entry => (
    formKey
    && tableName
    && normalizeText(entry.formKey) === formKey
    && normalizeText(entry.tableName) === tableName
  )) || resultForms.find(entry => (
    formKey
    && normalizeText(entry.formKey) === formKey
  )) || resultForms.find(entry => (
    tableName
    && normalizeText(entry.tableName) === tableName
  )) || null
}

const collectBlueprintFormIdCandidates = (
  item: NocodeEditorAiStageBlueprintDisplayItem | null | undefined,
  form: NocodeEditorAiAppBlueprintForm | null | undefined,
) => {
  const result = new Set<string>()
  const append = (value: unknown) => {
    const text = normalizeText(value)
    if (text) {
      result.add(text)
    }
  }

  append(form?.formKey)

  const matchedApplyForm = pickMatchedApplyFormResult(item, form)
  append(matchedApplyForm?.tableId)

  return result
}

const collectBlueprintFormNameCandidates = (
  item: NocodeEditorAiStageBlueprintDisplayItem | null | undefined,
  form: NocodeEditorAiAppBlueprintForm | null | undefined,
) => {
  const result = new Set<string>()
  const append = (value: unknown) => {
    const text = normalizeToken(value)
    if (text) {
      result.add(text)
    }
  }

  append(form?.tableName)

  const matchedApplyForm = pickMatchedApplyFormResult(item, form)
  append(matchedApplyForm?.tableName)

  return result
}

export const resolveReadyFlowArtifactBlocks = (
  blocks: NocodeEditorAiArtifactBlock[] | null | undefined,
) => {
  const source = Array.isArray(blocks) ? blocks : []
  const seen = new Set<string>()
  const seenLogicalScopes = new Set<string>()
  const results: NocodeEditorAiArtifactBlock[] = []

  source.forEach((block) => {
    if (block.kind !== 'flow-plan' || block.status !== 'ready') {
      return
    }

    const normalizedPlan = normalizeNocodeEditorFlowPlan(block.flowPlan)
    if (!normalizedPlan) {
      return
    }

    const normalizedBlock: NocodeEditorAiArtifactBlock = {
      ...block,
      flowPlan: normalizedPlan,
    }

    const logicalScopeKey = buildFlowArtifactLogicalScopeKey(normalizedBlock)
    if (logicalScopeKey) {
      if (seenLogicalScopes.has(logicalScopeKey)) {
        return
      }
      seenLogicalScopes.add(logicalScopeKey)
    }

    const identityKey = buildFlowArtifactIdentityKey(normalizedBlock)
    if (identityKey) {
      if (seen.has(identityKey)) {
        return
      }
      seen.add(identityKey)
    }

    results.push(normalizedBlock)
  })

  return results
}

export const resolveMatchedFlowArtifactForBlueprintForm = (input: {
  item?: NocodeEditorAiStageBlueprintDisplayItem | null
  form?: NocodeEditorAiAppBlueprintForm | null
  flowArtifactBlocks?: NocodeEditorAiArtifactBlock[] | null
}): MatchedBlueprintFlowArtifact | null => (
  resolveBlueprintFormFlowArtifactContext(input).activeFlowArtifact
)

const resolveMatchedFlowArtifactForForm = (input: {
  block: NocodeEditorAiArtifactBlock
  formIdCandidates: Set<string>
  formNameCandidates: Set<string>
}): MatchedBlueprintFlowArtifact | null => {
  const flowPlan = normalizeNocodeEditorFlowPlan(input.block.flowPlan)
  if (!flowPlan?.target) {
    return null
  }

  const targetFormId = normalizeText(flowPlan.target.formId)
  const targetFormName = normalizeToken(flowPlan.target.formName)

  if (targetFormId && input.formIdCandidates.has(targetFormId)) {
    return {
      block: {
        ...input.block,
        flowPlan,
      },
      flowPlan,
      matchedBy: 'formId',
    }
  }

  if (targetFormName && input.formNameCandidates.has(targetFormName)) {
    return {
      block: {
        ...input.block,
        flowPlan,
      },
      flowPlan,
      matchedBy: 'formName',
    }
  }

  return null
}

const compareMatchedFlowArtifacts = (
  left: MatchedBlueprintFlowArtifact,
  right: MatchedBlueprintFlowArtifact,
) => {
  const revisionDiff = resolveFlowArtifactRevision(right.block) - resolveFlowArtifactRevision(left.block)
  if (revisionDiff !== 0) {
    return revisionDiff
  }

  const timeDiff = resolveFlowArtifactSortTime(right.block) - resolveFlowArtifactSortTime(left.block)
  if (timeDiff !== 0) {
    return timeDiff
  }

  const leftStagePriority = left.block.flowApplyResult ? 0 : 1
  const rightStagePriority = right.block.flowApplyResult ? 0 : 1
  if (leftStagePriority !== rightStagePriority) {
    return leftStagePriority - rightStagePriority
  }

  if (left.matchedBy !== right.matchedBy) {
    return left.matchedBy === 'formId' ? -1 : 1
  }

  return normalizeText(right.block.version).localeCompare(normalizeText(left.block.version))
}

export const resolveBlueprintFormFlowArtifactContext = (input: {
  item?: NocodeEditorAiStageBlueprintDisplayItem | null
  form?: NocodeEditorAiAppBlueprintForm | null
  flowArtifactBlocks?: NocodeEditorAiArtifactBlock[] | null
}): BlueprintFormFlowArtifactContext => {
  const item = input.item || null
  const form = input.form || null
  if (!item || !form) {
    return {
      activeFlowArtifact: null,
      flowHistoryArtifacts: [],
      isCurrentStagedFlow: false,
    }
  }

  const formIdCandidates = collectBlueprintFormIdCandidates(item, form)
  const formNameCandidates = collectBlueprintFormNameCandidates(item, form)
  if (!formIdCandidates.size && !formNameCandidates.size) {
    return {
      activeFlowArtifact: null,
      flowHistoryArtifacts: [],
      isCurrentStagedFlow: false,
    }
  }

  const flowHistoryArtifacts = resolveReadyFlowArtifactBlocks(input.flowArtifactBlocks)
    .map(block => resolveMatchedFlowArtifactForForm({
      block,
      formIdCandidates,
      formNameCandidates,
    }))
    .filter((artifact): artifact is MatchedBlueprintFlowArtifact => Boolean(artifact))
    .sort(compareMatchedFlowArtifacts)

  const activeFlowArtifact = flowHistoryArtifacts[0] || null

  return {
    activeFlowArtifact,
    flowHistoryArtifacts,
    isCurrentStagedFlow: Boolean(activeFlowArtifact && !activeFlowArtifact.block.flowApplyResult),
  }
}
