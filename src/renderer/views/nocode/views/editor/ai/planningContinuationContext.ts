import {
  isSamePlanningConfirmationContext,
} from '@common/utils/nocodeEditorPlanningConfirmationIdentity'

const normalizeKey = (value: unknown) => String(value || '').trim()
const normalizePlanningName = (value: unknown) => String(value || '')
  .trim()
  .replace(/\s+/g, '')

const pushUniqueKey = (target: string[], value: unknown) => {
  const normalized = normalizeKey(value)
  if (!normalized || target.includes(normalized)) {
    return
  }
  target.push(normalized)
}

const parsePlanningContextKey = (value: unknown) => {
  const normalized = normalizeKey(value)
  if (!normalized) {
    return {
      stage: '',
      outlineId: '',
      primaryFormKey: '',
    }
  }

  const parts = normalized.split(':')
  if (parts[0] === 'logical') {
    return {
      stage: parts[1] || '',
      outlineId: parts[2] || '',
      primaryFormKey: parts.slice(3).join(':') || '',
    }
  }

  return {
    stage: parts[0] || '',
    outlineId: parts[1] || '',
    primaryFormKey: parts[2] || '',
  }
}

export const buildPlanningContinuationContext = (input: {
  currentPlanningContextKey?: string | null
  currentPlanningContextKeys?: Array<string | null | undefined>
  blueprintSourcePlanningContextKeys?: Array<string | null | undefined>
}) => {
  const planningContextKeys: string[] = []

  for (const item of input.blueprintSourcePlanningContextKeys || []) {
    pushUniqueKey(planningContextKeys, item)
  }
  for (const item of input.currentPlanningContextKeys || []) {
    pushUniqueKey(planningContextKeys, item)
  }
  pushUniqueKey(planningContextKeys, input.currentPlanningContextKey)

  return {
    planningContextKey: planningContextKeys[0] || '',
    planningContextKeys,
  }
}

export const alignPlanningOutlineIdentityToContextKey = <
  TOutline extends {
    id?: string | null
    forms?: Array<{
      formKey?: string | null
      tableName?: string | null
    }>
  },
>(
  outline: TOutline,
  planningContextKey?: string | null,
  options: { force?: boolean; forceReason?: 'confirmed-same-chain' } = {},
): TOutline => {
  if (!shouldAlignPlanningOutlineIdentityToContextKey({
    outline,
    planningContextKey,
    force: options.force,
    forceReason: options.forceReason,
  })) {
    return outline
  }

  const parsed = parsePlanningContextKey(planningContextKey)
  const forms = Array.isArray(outline.forms)
    ? [...outline.forms]
    : []
  if (forms[0] && parsed.primaryFormKey) {
    forms[0] = {
      ...forms[0],
      formKey: parsed.primaryFormKey,
    }
  }

  return {
    ...outline,
    id: parsed.outlineId || outline.id,
    forms,
  }
}

export const shouldAlignPlanningOutlineIdentityToContextKey = (input: {
  outline?: {
    title?: unknown
    forms?: Array<{ formKey?: unknown; tableName?: unknown }>
  } | null
  planningContextKey?: string | null
  force?: boolean
  forceReason?: 'confirmed-same-chain'
}) => {
  const parsed = parsePlanningContextKey(input.planningContextKey)
  if (!parsed.outlineId && !parsed.primaryFormKey) {
    return false
  }
  if (input.force && input.forceReason === 'confirmed-same-chain') {
    return true
  }
  const form = input.outline?.forms?.[0]
  const nextFormName = normalizePlanningName(form?.tableName)
  const nextFormKey = normalizePlanningName(form?.formKey)
  const parsedPrimaryFormKey = normalizePlanningName(parsed.primaryFormKey)
  if (!nextFormName && !nextFormKey) {
    return true
  }
  if (nextFormKey && parsedPrimaryFormKey && nextFormKey === parsedPrimaryFormKey) {
    return true
  }
  return false
}

export const resolvePlanningContinuationSourceContextKey = (input: {
  latestCompletedPlanningContextKey?: string | null
  currentPlanningContextKey?: string | null
}) => {
  const latestCompletedPlanningContextKey = normalizeKey(input.latestCompletedPlanningContextKey)
  const currentPlanningContextKey = normalizeKey(input.currentPlanningContextKey)

  if (
    latestCompletedPlanningContextKey
    && currentPlanningContextKey
    && isSamePlanningConfirmationContext(latestCompletedPlanningContextKey, currentPlanningContextKey)
  ) {
    return currentPlanningContextKey
  }

  return latestCompletedPlanningContextKey || currentPlanningContextKey
}

export const resolvePlanningRestoreAnchorContextKey = (input: {
  blockPlanningContextKey?: string | null
  fallbackPlanningContextKey?: string | null
}) => (
  normalizeKey(input.blockPlanningContextKey)
  || normalizeKey(input.fallbackPlanningContextKey)
)
