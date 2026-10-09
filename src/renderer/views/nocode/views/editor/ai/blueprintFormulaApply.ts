import type {
  NocodeEditorFormulaApplyCheckpoint,
  NocodeEditorFormulaApplyResult,
  NocodeEditorFormulaPlan,
  NocodeEditorFormulaPlanItem,
  NocodeEditorFormulaPreflightIssue,
  NocodeEditorFormulaTargetResult,
  NocodeEditorResolvedFormulaWrite,
} from '@common/types/nocodeEditorFormula'
import {
  buildNocodeEditorFormulaCheckpointTargetKey,
  buildNocodeEditorFormulaPlanFingerprint,
  buildNocodeEditorFormulaTargetFingerprint,
  canReuseCheckpointTarget,
  normalizeNocodeEditorFormulaSpecList,
} from '@common/utils/nocodeEditorFormulaDomain'
import {
  preflightNocodeEditorFormulaPlan,
  type NocodeEditorFormulaPreflightForm,
} from '@common/utils/nocodeEditorFormulaPreflight'
import {
  resolveNocodeEditorPostFormFlowRelease,
  type NocodeEditorPostFormFlowReleaseStatus,
} from '@common/utils/nocodeEditorPostFormFlowRelease'
import {
  normalizeBlueprintDefaultValue,
  resolveLegacyEnumBlueprintDefaultValue,
} from './blueprintDefaultValue'

import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiBlueprintApplyFormResult,
  NocodeEditorAiBlueprintFieldBinding,
  NocodeEditorAiBlueprintFormulaSummary,
} from './types'

export type NocodeEditorBlueprintFormulaIssue = {
  code: 'formula_settings_invalid' | 'formula_paths_conflict'
  severity: 'blocking'
  target: {
    formKey?: string
    fieldKey?: string
    fieldName: string
  }
  message: string
}

export type NocodeEditorBlueprintFormulaPlan = {
  origin: 'blueprint'
  plan: NocodeEditorFormulaPlan
  issues: NocodeEditorBlueprintFormulaIssue[]
}

type FormulaBinding = NocodeEditorAiBlueprintFieldBinding & {
  fieldName: string
  widgetId: string
  token: string
  formulaPaths: Array<'default-formula' | 'compute-formula'>
}

const normalizeText = (value: unknown): string => String(value || '').trim()

const cloneValue = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const resolveFieldIdentity = (field: NocodeEditorAiAppBlueprintField) => (
  normalizeText(field.fieldKey) || normalizeText(field.name)
)

const normalizeFieldFormulaSettings = (input: {
  field: NocodeEditorAiAppBlueprintField
  formKey?: string
  issues: NocodeEditorBlueprintFormulaIssue[]
}): NocodeEditorAiAppBlueprintField => {
  const field = cloneValue(input.field)
  const rawFormulaSettings = (field as Record<string, unknown>).formulaSettings
  const normalizedDefaultValue = normalizeBlueprintDefaultValue(
    (field as Record<string, unknown>).defaultValue,
  )

  if (normalizedDefaultValue === undefined) {
    delete (field as Record<string, unknown>).defaultValue
  } else {
    field.defaultValue = normalizedDefaultValue
  }

  if (rawFormulaSettings !== undefined) {
    const formulaSettings = normalizeNocodeEditorFormulaSpecList(rawFormulaSettings)
    if (!formulaSettings?.length) {
      delete (field as Record<string, unknown>).formulaSettings
      input.issues.push({
        code: 'formula_settings_invalid',
        severity: 'blocking',
        target: {
          ...(normalizeText(input.formKey) ? { formKey: normalizeText(input.formKey) } : {}),
          ...(normalizeText(field.fieldKey) ? { fieldKey: normalizeText(field.fieldKey) } : {}),
          fieldName: field.name,
        },
        message: `字段“${field.name}”的公式配置无效。`,
      })
    } else {
      const legacyDefaultValue = resolveLegacyEnumBlueprintDefaultValue({
        widgetType: field.widgetType,
        enumOptions: field.enumOptions,
        formulaSettings,
        defaultValue: field.defaultValue,
      })
      if (legacyDefaultValue !== undefined) {
        field.defaultValue = legacyDefaultValue
        delete (field as Record<string, unknown>).formulaSettings
      } else {
        const formulaPaths = new Set(formulaSettings.map(setting => setting.formulaPath))
        if (formulaPaths.size > 1) {
          delete (field as Record<string, unknown>).formulaSettings
          input.issues.push({
            code: 'formula_paths_conflict',
            severity: 'blocking',
            target: {
              ...(normalizeText(input.formKey) ? { formKey: normalizeText(input.formKey) } : {}),
              ...(normalizeText(field.fieldKey) ? { fieldKey: normalizeText(field.fieldKey) } : {}),
              fieldName: field.name,
            },
            message: `字段“${field.name}”不能同时使用默认值公式和实时计算公式。`,
          })
        } else {
          field.formulaSettings = formulaSettings
          if (formulaPaths.has('compute-formula')) {
            field.widgetType = 'widget.form.autoCompute'
          }
        }
      }
    }
  }

  if (Array.isArray(field.children)) {
    field.children = field.children.map(child => normalizeFieldFormulaSettings({
      field: child,
      formKey: input.formKey,
      issues: input.issues,
    }))
  }

  return field
}

export const normalizeBlueprintFormulaSettings = (
  blueprint: NocodeEditorAiAppBlueprint,
): {
  blueprint: NocodeEditorAiAppBlueprint
  issues: NocodeEditorBlueprintFormulaIssue[]
} => {
  const issues: NocodeEditorBlueprintFormulaIssue[] = []
  const normalizedBlueprint = cloneValue(blueprint)
  normalizedBlueprint.forms = (normalizedBlueprint.forms || []).map(form => ({
    ...form,
    fields: (form.fields || []).map(field => normalizeFieldFormulaSettings({
      field,
      formKey: form.formKey,
      issues,
    })),
  }))

  return { blueprint: normalizedBlueprint, issues }
}

const collectBlueprintFormulaItems = (input: {
  formKey: string
  formName: string
  fields: NocodeEditorAiAppBlueprintField[]
}): NocodeEditorFormulaPlanItem[] => (
  input.fields.flatMap(field => {
    const fieldKey = resolveFieldIdentity(field)
    const formulaSettings = Array.isArray(field.formulaSettings) ? field.formulaSettings : []
    const item = formulaSettings.length && fieldKey
      ? [{
        itemKey: `${input.formKey}:${fieldKey}:${field.name}`,
        target: {
          formKey: input.formKey,
          formName: input.formName,
          ...(normalizeText(field.fieldKey) ? { fieldKey: normalizeText(field.fieldKey) } : {}),
          fieldName: field.name,
        },
        formulaSettings,
      } satisfies NocodeEditorFormulaPlanItem]
      : []

    return [
      ...item,
      ...collectBlueprintFormulaItems({
        formKey: input.formKey,
        formName: input.formName,
        fields: Array.isArray(field.children) ? field.children : [],
      }),
    ]
  })
)

const matchesFormResult = (
  form: NocodeEditorAiAppBlueprint['forms'][number],
  result: NocodeEditorAiBlueprintApplyFormResult,
) => {
  const formKey = normalizeText(form.formKey)
  const resultKey = normalizeText(result.formKey) || normalizeText(result.applyTargetKey)
  return formKey
    ? formKey === resultKey
    : normalizeText(form.tableName) === normalizeText(result.tableName)
}

export const buildBlueprintFormulaPlan = (input: {
  blueprint: NocodeEditorAiAppBlueprint
  formResults: NocodeEditorAiBlueprintApplyFormResult[]
}): NocodeEditorBlueprintFormulaPlan => {
  const normalizedBlueprint = normalizeBlueprintFormulaSettings(input.blueprint)
  const targetForms = (normalizedBlueprint.blueprint.forms || []).filter(form => (
    input.formResults.some(result => matchesFormResult(form, result))
  ))
  const items = targetForms.flatMap(form => collectBlueprintFormulaItems({
    formKey: normalizeText(form.formKey) || normalizeText(form.tableName),
    formName: form.tableName,
    fields: Array.isArray(form.fields) ? form.fields : [],
  })).sort((left, right) => left.itemKey.localeCompare(right.itemKey))

  return {
    origin: 'blueprint',
    plan: {
      title: normalizeText(input.blueprint.title) || '蓝图公式',
      summary: normalizeText(input.blueprint.summary) || '按蓝图配置字段公式。',
      executionIntent: 'plan_and_apply',
      items,
      openQuestions: [],
    },
    issues: normalizedBlueprint.issues,
  }
}

export const resolveBlueprintFormulaPaths = (binding: {
  widgetType?: string
  formulaPaths?: unknown
}): FormulaBinding['formulaPaths'] => {
  if (Array.isArray(binding.formulaPaths)) {
    return binding.formulaPaths.filter((path): path is FormulaBinding['formulaPaths'][number] => (
      path === 'default-formula' || path === 'compute-formula'
    ))
  }
  return normalizeText(binding.widgetType).includes('autoCompute')
    ? ['compute-formula']
    : []
}

const buildPreflightForms = (input: {
  formResults: NocodeEditorAiBlueprintApplyFormResult[]
  bindings: NocodeEditorAiBlueprintFieldBinding[]
}): NocodeEditorFormulaPreflightForm[] => (
  input.formResults.map(formResult => ({
    formKey: formResult.formKey,
    formName: formResult.tableName,
    tableId: formResult.tableId,
    fields: input.bindings
      .filter(binding => (
        !normalizeText(binding.tableId)
        || normalizeText(binding.tableId) === normalizeText(formResult.tableId)
      ))
      .map(binding => ({
        ...binding,
        fieldName: binding.fieldName,
        widgetId: binding.widgetId,
        token: binding.token,
        formulaPaths: resolveBlueprintFormulaPaths(binding),
      }))
      .filter((binding): binding is FormulaBinding => (
        Boolean(normalizeText(binding.fieldName))
        && Boolean(normalizeText(binding.widgetId))
        && Boolean(normalizeText(binding.token))
      )),
  }))
)

const createSkippedResult = (input: {
  issue: NocodeEditorFormulaPreflightIssue
  formResults: NocodeEditorAiBlueprintApplyFormResult[]
}): NocodeEditorFormulaTargetResult => {
  const formKey = normalizeText(input.issue.target.formKey)
  const formName = normalizeText(input.issue.target.formName)
  const formResult = input.formResults.find(result => (
    (formKey && normalizeText(result.formKey) === formKey)
    || (formName && normalizeText(result.tableName) === formName)
  ))
  return {
    itemKey: input.issue.itemKey,
    ...(formResult?.tableId ? { tableId: formResult.tableId } : {}),
    ...(formResult?.tableName ? { tableName: formResult.tableName } : {}),
    fieldName: input.issue.target.fieldName,
    status: 'skipped',
    reason: input.issue.message,
  }
}

const buildCheckpoint = (input: {
  plan: NocodeEditorFormulaPlan
  contextFingerprint: string
  targetResults: NocodeEditorFormulaTargetResult[]
}): NocodeEditorFormulaApplyCheckpoint => ({
  planFingerprint: buildNocodeEditorFormulaPlanFingerprint(input.plan),
  contextFingerprint: input.contextFingerprint,
  targets: Object.fromEntries(input.targetResults.flatMap(result => {
    if (result.status !== 'updated' || !result.formulaPath) {
      return []
    }
    const item = input.plan.items.find(candidate => candidate.itemKey === result.itemKey)
    const setting = item?.formulaSettings.find(candidate => candidate.formulaPath === result.formulaPath)
    if (!item || !setting) {
      return []
    }
    return [[
      buildNocodeEditorFormulaCheckpointTargetKey({
        itemKey: result.itemKey,
        formulaPath: result.formulaPath,
      }),
      {
        targetFingerprint: buildNocodeEditorFormulaTargetFingerprint(item, setting),
        status: 'updated' as const,
        ...(normalizeText(result.tableId) ? { tableId: result.tableId } : {}),
        ...(normalizeText(result.widgetId) ? { widgetId: result.widgetId } : {}),
      },
    ]]
  })),
})

export const resolveBlueprintFormulaApplyStatus = (
  targetResults: NocodeEditorFormulaTargetResult[],
) => {
  if (!targetResults.length) return 'not_applicable' as const
  const hasSucceeded = targetResults.some(result => (
    result.status === 'updated' || result.status === 'draft'
  ))
  const hasFailed = targetResults.some(result => result.status === 'failed')
  const hasSkipped = targetResults.some(result => result.status === 'skipped')
  if (hasFailed || hasSkipped) return hasSucceeded ? 'partial' as const : 'failed' as const
  return 'completed' as const
}

export const applyBlueprintFormulaPlan = async (input: {
  formulaPlan: NocodeEditorBlueprintFormulaPlan
  formResults: NocodeEditorAiBlueprintApplyFormResult[]
  getBindings?: () => Promise<NocodeEditorAiBlueprintFieldBinding[]> | NocodeEditorAiBlueprintFieldBinding[]
  preflight?: (input: {
    preflight: () => {
      resolvedWrites: NocodeEditorResolvedFormulaWrite[]
      issues: NocodeEditorFormulaPreflightIssue[]
    }
  }) => Promise<{
    resolvedWrites: NocodeEditorResolvedFormulaWrite[]
    issues: NocodeEditorFormulaPreflightIssue[]
  }> | {
    resolvedWrites: NocodeEditorResolvedFormulaWrite[]
    issues: NocodeEditorFormulaPreflightIssue[]
  }
  setAiFieldOptions?: (input: {
    widgetId: string
    changes: Array<{ path: string[]; value: string }>
  }) => Promise<unknown> | unknown
  checkpoint?: NocodeEditorFormulaApplyCheckpoint | null
  contextFingerprint?: string
  getRuntimeFormula?: (input: {
    tableId: string
    widgetId: string
    formulaPath: NocodeEditorResolvedFormulaWrite['formulaPath']
  }) => Promise<string | null | undefined> | string | null | undefined
  persistenceMode?: 'saved' | 'draft_only'
}): Promise<NocodeEditorFormulaApplyResult> => {
  if (!input.formulaPlan.plan.items.length) {
    return {
      status: 'not_applicable',
      ...(input.persistenceMode ? { persistenceMode: input.persistenceMode } : {}),
      targetResults: [],
      issues: [],
      checkpoint: null,
    }
  }

  const bindings = input.getBindings ? await input.getBindings() : []
  const preflight = () => preflightNocodeEditorFormulaPlan({
    plan: input.formulaPlan.plan,
    forms: buildPreflightForms({ formResults: input.formResults, bindings }),
  })
  const preflightResult = input.preflight
    ? await input.preflight({ preflight })
    : preflight()
  const targetResults = preflightResult.issues.map(issue => createSkippedResult({
    issue,
    formResults: input.formResults,
  }))
  const contextFingerprint = normalizeText(input.contextFingerprint) || preflightResult.resolvedWrites
    .map(write => `${write.tableId}:${write.widgetId}:${write.itemKey}:${write.formulaPath}`)
    .sort()
    .join('|')

  for (const write of preflightResult.resolvedWrites) {
    const planItem = input.formulaPlan.plan.items.find(item => item.itemKey === write.itemKey)
    const setting = planItem?.formulaSettings.find(item => item.formulaPath === write.formulaPath)
    const currentRuntimeFormula = input.getRuntimeFormula
      ? await input.getRuntimeFormula({
        tableId: write.tableId,
        widgetId: write.widgetId,
        formulaPath: write.formulaPath,
      })
      : undefined
    const targetStatus = input.persistenceMode === 'draft_only' ? 'draft' as const : 'updated' as const
    const buildSuccessResult = (): NocodeEditorFormulaTargetResult => ({
      itemKey: write.itemKey,
      tableId: write.tableId,
      tableName: write.tableName,
      widgetId: write.widgetId,
      fieldName: write.fieldName,
      formulaPath: write.formulaPath,
      formula: write.formula,
      status: targetStatus,
      ...(targetStatus === 'draft' ? { draftOnly: true as const, overlayDraft: true as const } : {}),
      ...(write.explanation ? { explanation: write.explanation } : {}),
    })

    if (
      input.persistenceMode !== 'draft_only'
      && planItem
      && setting
      && canReuseCheckpointTarget({
        checkpoint: input.checkpoint,
        plan: input.formulaPlan.plan,
        contextFingerprint,
        item: planItem,
        setting,
        resolvedWrite: write,
        currentRuntimeFormula,
      })
    ) {
      targetResults.push(buildSuccessResult())
      continue
    }

    try {
      await input.setAiFieldOptions?.({
        widgetId: write.widgetId,
        changes: [{ path: [write.formulaPath], value: write.formula }],
      })
      targetResults.push(buildSuccessResult())
    } catch (error) {
      targetResults.push({
        itemKey: write.itemKey,
        tableId: write.tableId,
        tableName: write.tableName,
        widgetId: write.widgetId,
        fieldName: write.fieldName,
        formulaPath: write.formulaPath,
        formula: write.formula,
        status: 'failed',
        ...(write.explanation ? { explanation: write.explanation } : {}),
        reason: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    status: resolveBlueprintFormulaApplyStatus(targetResults),
    ...(input.persistenceMode ? { persistenceMode: input.persistenceMode } : {}),
    targetResults,
    issues: preflightResult.issues,
    checkpoint: input.persistenceMode === 'draft_only'
      ? null
      : buildCheckpoint({
        plan: input.formulaPlan.plan,
        contextFingerprint,
        targetResults,
      }),
  }
}

export const summarizeBlueprintFormulaApply = (input: {
  formulaApply: NocodeEditorFormulaApplyResult
  persistenceMode: 'saved' | 'draft_only'
}): {
  formulaSummary: NocodeEditorAiBlueprintFormulaSummary
  persistenceMode: 'saved' | 'draft_only'
  release: NocodeEditorPostFormFlowReleaseStatus
} => {
  const formulaSummary: NocodeEditorAiBlueprintFormulaSummary = {
    status: input.formulaApply.status,
    updated: input.formulaApply.targetResults.filter(result => result.status === 'updated').length,
    skipped: input.formulaApply.targetResults.filter(result => result.status === 'skipped').length,
    failed: input.formulaApply.targetResults.filter(result => result.status === 'failed').length,
    ...(input.formulaApply.issues.length ? { issues: input.formulaApply.issues } : {}),
  }

  return {
    formulaSummary,
    persistenceMode: input.persistenceMode,
    release: resolveNocodeEditorPostFormFlowRelease({
      planningScope: 'form',
      persistenceMode: input.persistenceMode,
      formulaSummary,
    }).status,
  }
}
