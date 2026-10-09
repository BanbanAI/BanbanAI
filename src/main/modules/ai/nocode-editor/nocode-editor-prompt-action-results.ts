import type { AiActionResult } from '../ai.types'
import { summarizeEnumOnlyFormSummariesOutput } from './nocode-editor-batch-enum'

const getPromptResultGroup = (result: AiActionResult) => {
  const name = String(result?.name || '').trim()
  if (!name) {
    return `call:${String(result?.callId || '').trim()}`
  }

  if (name.includes('app_plan')) {
    return 'app-plan'
  }

  if (name.includes('single_form_plan')) {
    return 'single-form-plan'
  }

  if (name.includes('app_blueprint')) {
    return 'app-blueprint'
  }

  if (name === 'editor_get_host_context') {
    return 'host-context'
  }

  if (name === 'editor_get_all_form_summaries') {
    return 'all-form-summaries'
  }

  if (name === 'editor_get_form_summary') {
    return 'form-summary'
  }

  if (name === 'editor_get_current_task_context') {
    return 'current-task-context'
  }

  if (name === 'editor_get_widget_option_schema') {
    return `widget-schema:${String(result?.metadata?.input?.widgetId || '').trim()}`
  }

  if (name === 'editor_get_widget_option_choices') {
    return `widget-choices:${String(result?.metadata?.input?.widgetId || '').trim()}`
  }

  return `${name}:${String(result?.callId || '').trim()}`
}

const getPromptFacingName = (name: string) => {
  const normalized = String(name || '').trim()
  if (normalized.includes('app_plan')) {
    return '当前应用规划'
  }
  if (normalized.includes('single_form_plan')) {
    return '当前表单规划'
  }
  if (normalized.includes('app_blueprint')) {
    return '当前蓝图'
  }
  if (normalized === 'editor_get_host_context') {
    return '当前编辑器状态'
  }
  if (normalized === 'editor_get_all_form_summaries') {
    return '应用表单摘要'
  }
  if (normalized === 'editor_get_form_summary') {
    return '当前表单摘要'
  }
  if (normalized === 'editor_get_current_task_context') {
    return '当前任务上下文'
  }
  if (normalized === 'editor_get_widget_option_schema') {
    return '字段设置结构'
  }
  if (normalized === 'editor_get_widget_option_choices') {
    return '字段候选项'
  }
  if (normalized === 'editor_create_form') {
    return '新建表单结果'
  }
  if (normalized === 'editor_add_fields') {
    return '新增字段结果'
  }
  if (normalized === 'editor_delete_field') {
    return '删除字段结果'
  }
  if (normalized === 'editor_replace_field') {
    return '替换字段结果'
  }
  if (normalized === 'editor_bind_field_source') {
    return '字段绑定结果'
  }
  if (normalized === 'editor_set_field_formulas') {
    return '字段公式设置结果'
  }
  if (normalized === 'editor_set_field_options') {
    return '字段设置结果'
  }
  if (normalized === 'editor_set_enum_options') {
    return '枚举选项更新结果'
  }
  return normalized.replace(/^editor_/, '')
}

export const buildNocodeEditorPromptActionResults = (results: AiActionResult[]) => {
  const normalizedResults = Array.isArray(results) ? results : []
  const kept: AiActionResult[] = []
  const seenGroups = new Set<string>()

  for (let index = normalizedResults.length - 1; index >= 0; index -= 1) {
    const result = normalizedResults[index]
    const groupKey = getPromptResultGroup(result)
    if (seenGroups.has(groupKey)) {
      continue
    }
    seenGroups.add(groupKey)
    kept.push({
      ...result,
      name: getPromptFacingName(result.name),
      output: normalizePromptFacingOutput(result),
    })
  }

  return kept.reverse()
}

const normalizePromptFacingOutput = (result: AiActionResult) => {
  const normalizedName = String(result?.name || '').trim()
  if (normalizedName !== 'editor_get_all_form_summaries') {
    return result.output
  }

  const summary = summarizeEnumOnlyFormSummariesOutput(result.output)
  if (summary.enumFieldCount <= 0) {
    return result.output
  }

  return {
    stats: {
      formCount: summary.formCount,
      enumFieldCount: summary.enumFieldCount,
      customEnumFieldCount: summary.customEnumFieldCount,
      customEnumFieldWithOptionsCount: summary.customEnumFieldWithOptionsCount,
      customEnumFieldWithoutOptionsCount: summary.customEnumFieldWithoutOptionsCount,
      customEnumFieldAlreadyChineseCount: summary.customEnumFieldAlreadyChineseCount,
      customEnumFieldNeedingChineseUpdateCount: summary.customEnumFieldNeedingChineseUpdateCount,
      relationEnumFieldCount: summary.relationEnumFieldCount,
    },
    customEnumFields: summary.customEnumFields.slice(0, 20).map(item => ({
      tableId: item.tableId,
      tableName: item.tableName,
      widgetId: item.widgetId,
      name: item.name,
      enumOptionCount: item.enumOptionCount,
      enumOptionsPreview: item.enumOptionsPreview,
    })),
    relationEnumFields: summary.relationEnumFields.slice(0, 20).map(item => ({
      tableId: item.tableId,
      tableName: item.tableName,
      widgetId: item.widgetId,
      name: item.name,
    })),
  }
}
