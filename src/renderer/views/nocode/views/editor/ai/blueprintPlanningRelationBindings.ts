import { isSameNocodeEditorBlueprintFormName } from '@common/utils/nocodeEditorBlueprintFormNormalization'
import { resolvePlanningRelationBindingForField } from './blueprintFieldIntent'
import type { NocodeEditorBlueprintPlanningRelationBinding } from './nocodeEditorBlueprintPlanningCarryover'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
} from './types'

export type AppliedBlueprintRelationBinding = {
  fieldLabel: string
  tableName: string
  displayFieldName: string
  displayFieldInferred: boolean
}

const hasMeaningfulBlueprintSource = (value: unknown) => {
  if (!value || typeof value !== 'object') return false
  const source = value as Record<string, unknown>
  return ['formKey', 'formName', 'fieldKey', 'fieldName']
    .some(key => String(source[key] || '').trim().length > 0)
}

// 关系绑定的目标表不能是字段所在表本身：自己指向自己不是关联，
// 只会把主数据表自己的属性字段全部标成“共享字段”。
// 表名可能带/不带“表、信息、台账”等后缀（“学生信息”与“学生信息表”按同一张表处理），
// 但“项目管理表 / 项目台账”这类核心词相同、后缀不同的不同表仍各自独立。
const isSameBindingTargetForm = (
  form: NocodeEditorAiAppBlueprintForm,
  tableName: string,
) => isSameNocodeEditorBlueprintFormName(form.tableName, tableName)

const visitBlueprintFields = (
  blueprint: NocodeEditorAiAppBlueprint,
  visit: (form: NocodeEditorAiAppBlueprintForm, field: NocodeEditorAiAppBlueprintField) => void,
) => {
  const visitField = (form: NocodeEditorAiAppBlueprintForm, field: NocodeEditorAiAppBlueprintField) => {
    visit(form, field)
    ;(Array.isArray(field.children) ? field.children : []).forEach(child => visitField(form, child))
  }
  blueprint.forms.forEach(form => {
    ;(Array.isArray(form.fields) ? form.fields : []).forEach(field => visitField(form, field))
  })
}

const isSelfReferentialBlueprintSource = (
  form: NocodeEditorAiAppBlueprintForm,
  source: Record<string, any> | null | undefined,
) => {
  if (!hasMeaningfulBlueprintSource(source)) {
    return false
  }
  const sourceFormKey = String(source?.formKey || '').trim()
  if (sourceFormKey && sourceFormKey === String(form.formKey || '').trim()) {
    return true
  }
  return isSameBindingTargetForm(form, String(source?.formName || ''))
}

// source 指向字段所在表自己没有业务含义（“取自本表”），只会把属性字段误标成共享字段。
// 历史暂存蓝图里可能已有这种脏数据，暂存和应用两处都要剥掉。
export const stripSelfReferentialBlueprintSources = (
  blueprint: NocodeEditorAiAppBlueprint,
) => {
  const stripped: string[] = []
  visitBlueprintFields(blueprint, (form, field) => {
    if (!isSelfReferentialBlueprintSource(form, field.source)) {
      return
    }
    field.source = undefined
    stripped.push(`${form.tableName}.${field.name}`)
  })
  return Array.from(new Set(stripped))
}

export const applyPlanningRelationBindings = (
  blueprint: NocodeEditorAiAppBlueprint,
  bindings?: NocodeEditorBlueprintPlanningRelationBinding[],
  options: {
    // 已确认文本优先的字段不允许被绑定重新拉回关联。
    shouldSkipField?: (
      form: NocodeEditorAiAppBlueprintForm,
      field: NocodeEditorAiAppBlueprintField,
    ) => boolean
  } = {},
) => {
  const applied: AppliedBlueprintRelationBinding[] = []
  if (!bindings?.length) {
    return applied
  }

  visitBlueprintFields(blueprint, (form, field) => {
    // 只补“完全没有 source”的字段；已有 source 的交给部分来源补全，避免覆盖模型更具体的选择。
    if (
      hasMeaningfulBlueprintSource(field.source)
      || !String(field.name || '').trim()
      || options.shouldSkipField?.(form, field)
    ) {
      return
    }
    const binding = resolvePlanningRelationBindingForField(bindings, {
      fieldKey: field.fieldKey,
      fieldName: field.name,
      description: field.description,
      notes: Array.isArray(field.notes) ? field.notes : undefined,
    }, {
      relationFieldNameOnly: true,
      form,
    })
    if (!binding || isSameBindingTargetForm(form, binding.tableName)) {
      return
    }
    const displayFieldInferred = !binding.displayFieldName
    const displayFieldName = binding.displayFieldName || String(field.name).trim()
    field.source = {
      formName: binding.tableName,
      fieldName: displayFieldName,
    }
    applied.push({
      fieldLabel: `${form.tableName}.${field.name}`,
      tableName: binding.tableName,
      displayFieldName,
      displayFieldInferred,
    })
  })
  return applied
}

export const completePartialBlueprintSources = (
  blueprint: NocodeEditorAiAppBlueprint,
  bindings?: NocodeEditorBlueprintPlanningRelationBinding[],
) => {
  const completed: string[] = []
  if (!bindings?.length) {
    return completed
  }

  visitBlueprintFields(blueprint, (form, field) => {
    const source = field.source
    if (!source || typeof source !== 'object' || !String(field.name || '').trim()) {
      return
    }
    const hasTable = Boolean(String(source.formKey || '').trim() || String(source.formName || '').trim())
    const hasField = Boolean(String(source.fieldKey || '').trim() || String(source.fieldName || '').trim())
    if (hasTable && hasField) {
      return
    }
    const binding = resolvePlanningRelationBindingForField(bindings, {
      fieldKey: field.fieldKey,
      fieldName: field.name,
      description: field.description,
      notes: Array.isArray(field.notes) ? field.notes : undefined,
    }, {
      form,
    })
    if (!binding) {
      return
    }
    if (!hasTable) {
      source.formName = binding.tableName
    }
    if (!hasField) {
      source.fieldName = binding.displayFieldName || String(field.name).trim()
    }
    completed.push(`${form.tableName}.${field.name}`)
  })
  return Array.from(new Set(completed))
}

export const formatRelationBindingAssumption = (
  applied: AppliedBlueprintRelationBinding[],
) => applied.length
  ? `已按规划阶段“关联其他表单”的答复补齐来源：${applied
    .map(item => `“${item.fieldLabel}” → “${item.tableName}”（显示字段：${item.displayFieldName}${
      item.displayFieldInferred ? '，按同名字段暂定' : ''
    }）`)
    .join('；')}。`
  : ''
