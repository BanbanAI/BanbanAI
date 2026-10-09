import { getNocodeEditorBlueprintFormApplyTargetIdentity } from '@common/utils/nocodeEditorBlueprintFormNormalization'

import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiBlueprintApplyResult,
} from './types'
import { selectNocodeEditorAiBlueprintFormsByTargetFormKeys } from './types'

const cloneBlueprintValue = <T,>(value: T): T => (
  value == null ? value : JSON.parse(JSON.stringify(value))
)

const buildScopedBlueprintWithForms = (
  blueprint: NocodeEditorAiAppBlueprint,
  forms: NocodeEditorAiAppBlueprint['forms'],
) => {
  const nextBlueprint = cloneBlueprintValue(blueprint)
  nextBlueprint.forms = forms.map(form => cloneBlueprintValue(form))
  return nextBlueprint
}

const normalizeTargetFormKeys = (targetFormKeys?: string[] | null) => {
  if (!Array.isArray(targetFormKeys)) {
    return null
  }

  return targetFormKeys
    .map(value => String(value || '').trim())
    .filter(Boolean)
}

const normalizeScopedIdentityParts = (values?: Array<string | null | undefined> | null) => (
  Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map(value => String(value || '').trim())
      .filter(Boolean),
  )).sort()
)

const collectBlueprintApplyScopeKeys = (
  blueprint?: NocodeEditorAiAppBlueprint | null,
) => (
  Array.isArray(blueprint?.forms)
    ? blueprint.forms
      .map((form, index) => (
        getNocodeEditorBlueprintFormApplyTargetIdentity(form)
        || `index:${index}`
      ))
      .filter(Boolean)
      .sort()
    : []
)

const collectAppliedBlueprintTableIds = (
  applyResult?: NocodeEditorAiBlueprintApplyResult | null,
) => normalizeScopedIdentityParts(
  Array.isArray(applyResult?.forms)
    ? applyResult.forms.map(form => String(form.tableId || '').trim())
    : [],
)

const collectAppliedBlueprintScopeKeys = (
  blueprint?: NocodeEditorAiAppBlueprint | null,
  applyResult?: NocodeEditorAiBlueprintApplyResult | null,
) => {
  const scopedBlueprint = buildScopedBlueprintByApplyResult(blueprint, applyResult)
  return collectBlueprintApplyScopeKeys(scopedBlueprint || blueprint)
}

export const buildScopedBlueprintByTargetFormKeys = (
  blueprint?: NocodeEditorAiAppBlueprint | null,
  targetFormKeys?: string[] | null,
) => {
  if (!blueprint) {
    return null
  }

  const normalizedTargetFormKeys = normalizeTargetFormKeys(targetFormKeys)
  if (!normalizedTargetFormKeys) {
    return cloneBlueprintValue(blueprint)
  }

  const scopedForms = selectNocodeEditorAiBlueprintFormsByTargetFormKeys(
    blueprint.forms,
    normalizedTargetFormKeys,
  ).map(({ form }) => form as NocodeEditorAiAppBlueprint['forms'][number])

  return buildScopedBlueprintWithForms(blueprint, scopedForms)
}

export const buildScopedBlueprintByApplyResult = (
  blueprint?: NocodeEditorAiAppBlueprint | null,
  applyResult?: NocodeEditorAiBlueprintApplyResult | null,
) => {
  const targetFormKeys = Array.isArray(applyResult?.forms)
    ? applyResult.forms
      .map(form => String(form.applyTargetKey || '').trim())
      .filter(Boolean)
    : []

  return buildScopedBlueprintByTargetFormKeys(blueprint, targetFormKeys)
}

export const buildScopedAppliedBlueprintIdentityKey = (input: {
  blueprint?: NocodeEditorAiAppBlueprint | null
  pendingIdentityKey?: string | null
  pendingIdentityKeys?: string[] | null
  applyResult?: NocodeEditorAiBlueprintApplyResult | null
}) => {
  const actualFormIds = collectAppliedBlueprintTableIds(input.applyResult)
  if (actualFormIds.length === 1) {
    return actualFormIds[0]
  }

  if (actualFormIds.length > 1) {
    return `group:${actualFormIds.join('||')}`
  }

  const applyScopeKeys = collectAppliedBlueprintScopeKeys(
    input.blueprint,
    input.applyResult,
  )
  if (applyScopeKeys.length > 1) {
    const blueprintId = String(input.blueprint?.id || '').trim() || 'blueprint'
    return `${blueprintId}::scope:${applyScopeKeys.join('||')}`
  }

  const pendingIdentityKeys = normalizeScopedIdentityParts(input.pendingIdentityKeys)
  if (pendingIdentityKeys.length > 1) {
    const blueprintId = String(input.blueprint?.id || '').trim() || 'blueprint'
    return `${blueprintId}::pending:${pendingIdentityKeys.join('||')}`
  }

  const pendingIdentityKey = String(input.pendingIdentityKey || '').trim()
  if (pendingIdentityKey) {
    return pendingIdentityKey
  }

  if (applyScopeKeys.length === 1) {
    return applyScopeKeys[0]
  }

  return String(input.blueprint?.id || '').trim()
}

export const isSameBlueprintApplyScope = (
  leftBlueprint?: NocodeEditorAiAppBlueprint | null,
  rightBlueprint?: NocodeEditorAiAppBlueprint | null,
) => {
  const leftKeys = collectBlueprintApplyScopeKeys(leftBlueprint)
  const rightKeys = collectBlueprintApplyScopeKeys(rightBlueprint)

  if (leftKeys.length !== rightKeys.length) {
    return false
  }

  return leftKeys.every((value, index) => value === rightKeys[index])
}
