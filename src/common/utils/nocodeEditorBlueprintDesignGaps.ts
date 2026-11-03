import type {
  NocodeEditorBlueprintFieldLike,
  NocodeEditorBlueprintFormLike,
} from './nocodeEditorBlueprintFormNormalization'

export type NocodeEditorBlueprintDesignGapReason =
  | 'enum-options-missing'
  | 'auto-compute-formula-missing'
  | 'related-form-needs-design'

export type NocodeEditorBlueprintDesignGap = {
  formKey?: string
  tableName: string
  fieldKey?: string
  fieldName?: string
  widgetType?: string
  reason: NocodeEditorBlueprintDesignGapReason
}

// 只检查只能靠自定义选项的枚举组件；treeSelect 无 source 时可能是待补来源的关系字段，
// 不能当成缺选项。
const ENUM_WIDGET_TYPES = new Set([
  'widget.form.radioGroup',
  'widget.form.checkboxGroup',
  'widget.form.singleSelect',
])

const AUTO_COMPUTE_WIDGET_TYPE = 'widget.form.autoCompute'

const OPTION_DEFERRED_HINT = '生成后补充选项'

const normalizeText = (value: unknown) => String(value ?? '').trim()

const hasMeaningfulSource = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return false
  }
  const source = value as Record<string, unknown>
  return ['formKey', 'formName', 'fieldKey', 'fieldName']
    .some(key => normalizeText(source[key]).length > 0)
}

const isOptionDeferred = (field: NocodeEditorBlueprintFieldLike) => [
  field?.description,
  ...(Array.isArray(field?.notes) ? field.notes : []),
].some(text => normalizeText(text).includes(OPTION_DEFERRED_HINT))

const hasComputeFormula = (field: NocodeEditorBlueprintFieldLike) => {
  const settings = Array.isArray(field?.formulaSettings) ? field.formulaSettings : []
  return settings.some((setting: unknown) => {
    if (!setting || typeof setting !== 'object') {
      return false
    }
    const record = setting as Record<string, unknown>
    return normalizeText(record.formulaPath) === 'compute-formula'
      && normalizeText(record.formula).length > 0
  })
}

const visitBlueprintFields = (
  forms: NocodeEditorBlueprintFormLike[] | null | undefined,
  visit: (form: NocodeEditorBlueprintFormLike, field: NocodeEditorBlueprintFieldLike) => void,
) => {
  const visitField = (
    form: NocodeEditorBlueprintFormLike,
    field: NocodeEditorBlueprintFieldLike,
  ) => {
    visit(form, field)
    const children = Array.isArray(field?.children) ? field.children : []
    children.forEach(child => visitField(form, child))
  }
  const formList = Array.isArray(forms) ? forms : []
  formList.forEach((form) => {
    const fields = Array.isArray(form?.fields) ? form.fields : []
    fields.forEach(field => visitField(form, field))
  })
}

export const collectNocodeEditorBlueprintEnumDesignGaps = (
  forms: NocodeEditorBlueprintFormLike[] | null | undefined,
): NocodeEditorBlueprintDesignGap[] => {
  const gaps: NocodeEditorBlueprintDesignGap[] = []
  visitBlueprintFields(forms, (form, field) => {
    const widgetType = normalizeText(field?.widgetType)
    const enumOptions = Array.isArray(field?.enumOptions) ? field.enumOptions : []
    if (
      ENUM_WIDGET_TYPES.has(widgetType)
      && !hasMeaningfulSource(field?.source)
      && !enumOptions.length
      && !isOptionDeferred(field)
    ) {
      gaps.push({
        formKey: normalizeText(form?.formKey) || undefined,
        tableName: normalizeText(form?.tableName),
        fieldKey: normalizeText(field?.fieldKey) || undefined,
        fieldName: normalizeText(field?.name),
        widgetType,
        reason: 'enum-options-missing',
      })
    }
  })
  return gaps
}

// 实时计算字段没有公式，生成后只会得到一个不可用的计算列；
// 这类缺口必须在蓝图阶段回给模型补齐，不能留给 apply 之后的校验。
export const collectNocodeEditorBlueprintAutoComputeDesignGaps = (
  forms: NocodeEditorBlueprintFormLike[] | null | undefined,
): NocodeEditorBlueprintDesignGap[] => {
  const gaps: NocodeEditorBlueprintDesignGap[] = []
  visitBlueprintFields(forms, (form, field) => {
    if (normalizeText(field?.widgetType) !== AUTO_COMPUTE_WIDGET_TYPE) {
      return
    }
    if (hasComputeFormula(field)) {
      return
    }
    gaps.push({
      formKey: normalizeText(form?.formKey) || undefined,
      tableName: normalizeText(form?.tableName),
      fieldKey: normalizeText(field?.fieldKey) || undefined,
      fieldName: normalizeText(field?.name),
      widgetType: AUTO_COMPUTE_WIDGET_TYPE,
      reason: 'auto-compute-formula-missing',
    })
  })
  return gaps
}
