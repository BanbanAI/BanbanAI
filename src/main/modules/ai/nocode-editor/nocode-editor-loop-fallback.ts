import { sanitizeNocodeEditorUnsupportedBlueprintProtocol } from '@common/utils/nocodeEditorUnsupportedBlueprintProtocol'
import type { AiActionResult } from '../ai.types'
import { getNocodeEditorUnsupportedBlueprintProtocolRepairFailedMessage } from './nocode-editor-blueprint-auto-repair.util'
import { buildNocodeEditorToolResultAssistantMessage } from './nocode-editor-tool-result-messages'

const MUTATING_EDITOR_TOOL_NAMES = new Set([
  'editor_stage_app_plan',
  'editor_stage_single_form_plan',
  'editor_stage_content_plan',
  'editor_plan_flow_scheme',
  'editor_stage_flow_blueprint',
  'editor_apply_staged_flow',
  'editor_patch_flow',
  'editor_create_form',
  'editor_stage_app_blueprint',
  'editor_clear_staged_app_blueprint',
  'editor_apply_staged_app_blueprint',
  'editor_add_fields',
  'editor_delete_field',
  'editor_replace_field',
  'editor_bind_field_source',
  'editor_set_field_formulas',
  'editor_set_field_options',
  'editor_set_enum_options',
])

const isMutatingEditorResult = (result?: AiActionResult | null) => (
  MUTATING_EDITOR_TOOL_NAMES.has(String(result?.name || '').trim())
)

const isNonExecutingMutationGuard = (result?: AiActionResult | null) => (
  isMutatingEditorResult(result)
  && (
    String(result?.metadata?.executor || '').trim() === 'server-guard'
    || result?.metadata?.duplicateBlocked === true
    || result?.metadata?.toolPolicyViolation === true
  )
)

const isRealMutationAttempt = (result?: AiActionResult | null) => (
  isMutatingEditorResult(result)
  && !isNonExecutingMutationGuard(result)
)

export const sanitizeNocodeEditorAssistantText = (value: string) => sanitizeNocodeEditorUnsupportedBlueprintProtocol(String(value || '')
  .replace(/[ \t]*请求执行动作[:：][^\r\n]*/g, '')
  .split('\n')
  .map(line => line.trimEnd())
  .filter(line => !/^请求执行动作[:：]/.test(line.trim()))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim(), {
  replaceWhenDetected: true,
})

export const buildNocodeEditorFallbackAssistantText = (_results: AiActionResult[]) => {
  const normalizedResults = Array.isArray(_results) ? _results : []
  const latestMutationAttempt = [...normalizedResults]
    .reverse()
    .find(result => isRealMutationAttempt(result))
  const latestMutationGuard = [...normalizedResults]
    .reverse()
    .find(result => isNonExecutingMutationGuard(result))
  if (!latestMutationAttempt && latestMutationGuard) {
    return global.i18next.t('nocodeEditorLoopFallback.mutationBlocked')
  }
  if (!latestMutationAttempt?.ok && latestMutationAttempt?.name === 'editor_patch_flow') {
    const flowPatchErrorCode = String(
      latestMutationAttempt.metadata?.flowPatchErrorCode
      || latestMutationAttempt.output?.flowPatchErrorCode
      || '',
    ).trim()
    if (flowPatchErrorCode === 'flow_patch_conflict') {
      return global.i18next.t('nocodeEditorLoopFallback.flowPatchConflictRetry')
    }
    if (
      flowPatchErrorCode === 'requires_full_rebuild'
      || latestMutationAttempt.metadata?.requiresFullRebuild === true
    ) {
      return global.i18next.t('nocodeEditorLoopFallback.flowPatchFullRebuildRequired')
    }
    return global.i18next.t('nocodeEditorLoopFallback.flowPatchRetry')
  }
  if (latestMutationAttempt && !latestMutationAttempt.ok) {
    return global.i18next.t('nocodeEditorLoopFallback.mutationRetry')
  }

  const latestBlueprintWithLateQuestions = (
    latestMutationAttempt?.ok
    && String(latestMutationAttempt?.name || '').trim() === 'editor_stage_app_blueprint'
    && Array.isArray(latestMutationAttempt?.metadata?.planningConvergenceLateQuestions)
    && latestMutationAttempt.metadata!.planningConvergenceLateQuestions!.length > 0
  )
    ? latestMutationAttempt
    : undefined
  if (latestBlueprintWithLateQuestions) {
    const summary = buildNocodeEditorToolResultAssistantMessage(latestBlueprintWithLateQuestions)
    const summaryContent = String(summary?.content || '').trim()
    if (summaryContent) {
      return summaryContent
    }
  }

  const latestMutatingSuccess = latestMutationAttempt?.ok ? latestMutationAttempt : undefined
  const latestSuccess = latestMutatingSuccess || [...normalizedResults]
    .reverse()
    .find(result => result?.ok)

  if (latestSuccess?.name === 'editor_add_fields') {
    const createdFields = Array.isArray(latestSuccess.output?.created)
      ? latestSuccess.output.created
        .map(item => String(item?.name || '').trim())
        .filter(Boolean)
      : []
    if (createdFields.length === 1) {
      return global.i18next.t('nocodeEditorLoopFallback.fieldAdded', { fieldName: createdFields[0] })
    }
    if (createdFields.length > 1) {
      return global.i18next.t('nocodeEditorLoopFallback.fieldsAdded', {
        fieldNames: createdFields.join(global.i18next.t('nocodeEditorLoopFallback.listSeparator')),
      })
    }
    return global.i18next.t('nocodeEditorLoopFallback.fieldsAddedDefault')
  }

  if (latestSuccess?.name === 'editor_delete_field') {
    const fieldName = String(latestSuccess.output?.name || '').trim()
    return fieldName
      ? global.i18next.t('nocodeEditorLoopFallback.fieldDeleted', { fieldName })
      : global.i18next.t('nocodeEditorLoopFallback.fieldDeletedDefault')
  }

  if (latestSuccess?.name === 'editor_create_form') {
    const formName = String(
      latestSuccess.output?.tableName
      || latestSuccess.metadata?.tableName
      || '',
    ).trim()
    return formName
      ? global.i18next.t('nocodeEditorLoopFallback.formCreated', { formName })
      : global.i18next.t('nocodeEditorLoopFallback.formCreatedDefault')
  }

  if (latestSuccess?.name === 'editor_stage_content_plan') {
    return global.i18next.t('nocodeEditorLoopFallback.contentPlanStaged')
  }

  if (latestSuccess?.name === 'editor_patch_flow') {
    const draftVersion = Number(latestSuccess.output?.draftVersion || 0)
    return draftVersion > 0
      ? global.i18next.t('nocodeEditorLoopFallback.flowDraftUpdated', { version: draftVersion })
      : global.i18next.t('nocodeEditorLoopFallback.flowPatchCompleted')
  }

  if (latestSuccess?.name === 'editor_plan_flow_scheme') {
    return global.i18next.t('nocodeEditorLoopFallback.flowSchemeStaged')
  }

  if (latestSuccess?.name === 'editor_stage_flow_blueprint') {
    return global.i18next.t('nocodeEditorLoopFallback.flowBlueprintStaged')
  }

  if (latestSuccess?.name === 'editor_apply_staged_flow') {
    return global.i18next.t('nocodeEditorLoopFallback.flowApplied')
  }

  if (latestSuccess?.name === 'editor_stage_app_plan') {
    return global.i18next.t('nocodeEditorLoopFallback.appPlanStaged')
  }

  if (latestSuccess?.name === 'editor_set_field_formulas' || latestSuccess?.name === 'editor_set_field_options') {
    const fieldName = String(latestSuccess.output?.name || latestSuccess.output?.widgetId || '').trim()
    const applied = Array.isArray(latestSuccess.output?.applied) ? latestSuccess.output.applied : []
    const hasFormulaApplied = applied.some(item => {
      const path = Array.isArray(item?.path)
        ? item.path.map((part: unknown) => String(part || '').trim()).filter(Boolean)
        : []
      const normalizedPath = path.join('.')
      return normalizedPath === 'default-formula'
        || normalizedPath === 'compute-formula'
    })
    if (hasFormulaApplied) {
      return fieldName
        ? global.i18next.t('nocodeEditorLoopFallback.fieldFormulaUpdated', { fieldName })
        : global.i18next.t('nocodeEditorLoopFallback.fieldFormulaUpdatedDefault')
    }
    return fieldName
      ? global.i18next.t('nocodeEditorLoopFallback.fieldSettingsUpdated', { fieldName })
      : global.i18next.t('nocodeEditorLoopFallback.fieldSettingsUpdatedDefault')
  }

  if (latestSuccess?.name === 'editor_replace_field') {
    return global.i18next.t('nocodeEditorLoopFallback.fieldTypeUpdated')
  }

  if (latestSuccess?.name === 'editor_bind_field_source') {
    return global.i18next.t('nocodeEditorLoopFallback.fieldSourceUpdated')
  }

  if (latestSuccess?.name === 'editor_set_enum_options') {
    return global.i18next.t('nocodeEditorLoopFallback.fieldOptionsUpdated')
  }

  return global.i18next.t('nocodeEditorLoopFallback.roundCompleted')
}

export const buildNocodeEditorToolLoopFinalAssistantText = (options: {
  latestRoundAssistantText: string
  assistantText: string
  finishReason: string
  actionResults: AiActionResult[]
}) => {
  if (options.finishReason === 'unsupported_blueprint_protocol_after_repair') {
    return getNocodeEditorUnsupportedBlueprintProtocolRepairFailedMessage()
  }

  const latestRoundAssistantText = sanitizeNocodeEditorAssistantText(String(options.latestRoundAssistantText || '').trim())

  return latestRoundAssistantText
    || buildNocodeEditorFallbackAssistantText(options.actionResults)
}
