import type {
  ExcelFieldItem,
  ExcelFormColMap,
  ExcelSubformColMaps,
} from '@common/types/excel'
import { getNocodeEditorBlueprintFormApplyTargetIdentity } from '@common/utils/nocodeEditorBlueprintFormNormalization'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiBlueprintApplyFormResult,
  NocodeEditorAiBlueprintApplyResult,
  NocodeEditorAiBlueprintFieldBinding,
  NocodeEditorAiBlueprintOption,
  NocodeEditorAiExcelBlueprintDraftInput,
  NocodeEditorAiExcelBlueprintImportContext,
  NocodeEditorAiExcelColumnBinding,
} from './types'

type ExcelColumnKey = `col-${number}`
type ExcelColumnValues = Partial<Record<ExcelColumnKey, string[]>>

type NormalizedExcelFieldNode = {
  excelField: ExcelColumnKey
  excelFieldTitle: string
  fieldName: string
  fieldKey: string
  excelFieldType?: string
  widgetType: string
  validationFormat?: string
  enumOptions?: NocodeEditorAiBlueprintOption[]
  parentExcelField?: ExcelColumnKey
  children: NormalizedExcelFieldNode[]
}

type ExcelImportContextDescriptor = {
  source: {
    kind: 'excel'
    fileName: string
    worksheet: string
    titleRowIndex: number
    uploadSourceType?: 'excel' | 'zip' | ''
  }
  formKey: string
  tableName: string
  groupName?: string
  columns: Array<{
    excelField: ExcelColumnKey
    title: string
    type?: string
    fieldKey?: string
    fieldName: string
    widgetType?: string
    parentExcelField?: ExcelColumnKey
    parentFieldKey?: string
    sampleValues: string[]
    distinctValuesSample: string[]
    kind: 'field' | 'subform' | 'subform-child'
  }>
}

export type ExcelImportContextCompact = {
  compactContract: 'nocode-editor-excel-import-context@1'
  source: ExcelImportContextDescriptor['source']
  targetForm: {
    formKey: string
    tableName: string
    groupName?: string
  }
  counts: {
    columnCount: number
    subformCount: number
    leafFieldCount: number
  }
  columns: ExcelImportContextDescriptor['columns']
}

export type ExcelImportMappingsFromApplyResult = {
  ok: boolean
  formKey: string
  applyTargetKey: string
  tableId?: string
  tableName?: string
  mapping: ExcelFormColMap
  subformMappings: ExcelSubformColMaps
  unresolvedColumns: Array<{
    excelField: ExcelColumnKey
    fieldKey?: string
    fieldName: string
    parentExcelField?: ExcelColumnKey
    reason: string
  }>
  warnings: string[]
}

const SKIP_IMPORT_TOKEN = '不导入'
const COMPACT_SAMPLE_LIMIT = 5
const ENUM_SAMPLE_LIMIT = 8

const EXPLICIT_WIDGET_TYPE_ALIAS_MAP: Record<string, string> = {
  text: 'widget.form.textInput',
  textinput: 'widget.form.textInput',
  string: 'widget.form.textInput',
  textarea: 'widget.form.textarea',
  multiline: 'widget.form.textarea',
  number: 'widget.form.numberInput',
  integer: 'widget.form.numberInput',
  int: 'widget.form.numberInput',
  float: 'widget.form.numberInput',
  decimal: 'widget.form.numberInput',
  amount: 'widget.form.amountInput',
  money: 'widget.form.amountInput',
  currency: 'widget.form.amountInput',
  date: 'widget.form.datePicker',
  datetime: 'widget.form.datePicker',
  timestamp: 'widget.form.datePicker',
  time: 'widget.form.timePicker',
  phone: 'widget.form.phoneInput',
  mobile: 'widget.form.phoneInput',
  tel: 'widget.form.phoneInput',
  address: 'widget.form.address',
  boolean: 'widget.form.switch',
  bool: 'widget.form.switch',
  switch: 'widget.form.switch',
  radio: 'widget.form.radioGroup',
  radiogroup: 'widget.form.radioGroup',
  checkbox: 'widget.form.checkboxGroup',
  checkboxgroup: 'widget.form.checkboxGroup',
  select: 'widget.form.radioGroup',
  enum: 'widget.form.radioGroup',
  image: 'widget.form.image-uploader',
  file: 'widget.form.file-uploader',
  serial: 'widget.form.serialNumber',
  serialnumber: 'widget.form.serialNumber',
  member: 'widget.form.memberSelect',
  department: 'widget.form.departmentSelect',
  subform: 'widget.form.subform',
}

const isRecord = (value: unknown): value is Record<string, any> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/[\s\-_/\\.]+/g, '')

const normalizeIdentifier = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\.[^.]+$/, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const normalizeExcelFieldKey = (value: unknown): ExcelColumnKey | '' => {
  const matched = /^col-(\d+)$/.exec(normalizeText(value))
  if (!matched) {
    return ''
  }
  return `col-${Number(matched[1])}` as ExcelColumnKey
}

const getExcelFieldOrder = (value: unknown) => {
  const matched = /^col-(\d+)$/.exec(normalizeText(value))
  return matched ? Number(matched[1]) : Number.MAX_SAFE_INTEGER
}

const uniqueStrings = (value: unknown, limit = Number.MAX_SAFE_INTEGER) => {
  const appended = new Set<string>()
  const result: string[] = []
  for (const item of Array.isArray(value) ? value : []) {
    const normalized = normalizeText(item)
    if (!normalized || appended.has(normalized)) {
      continue
    }
    appended.add(normalized)
    result.push(normalized)
    if (result.length >= limit) {
      break
    }
  }
  return result
}

const isSkippedExcelField = (field: Partial<ExcelFieldItem> | null | undefined) => (
  normalizeText(field?.formField) === SKIP_IMPORT_TOKEN
  || normalizeText(field?.formFieldType) === SKIP_IMPORT_TOKEN
)

const cloneExcelFieldShallow = (field: ExcelFieldItem, parentExcelField?: ExcelColumnKey | ''): ExcelFieldItem | null => {
  const excelField = normalizeExcelFieldKey(field?.excelField)
  if (!excelField) {
    return null
  }
  return {
    ...field,
    excelField,
    excelFieldTitle: normalizeText(field?.excelFieldTitle) || excelField,
    formFieldTitle: normalizeText(field?.formFieldTitle) || undefined,
    formFieldType: normalizeText(field?.formFieldType) || undefined,
    parentExcelField: normalizeExcelFieldKey(field?.parentExcelField) || parentExcelField || undefined,
    subformExcelFields: undefined,
  }
}

const flattenExcelFields = (
  fields: ExcelFieldItem[] = [],
  parentExcelField?: ExcelColumnKey | '',
  result: Array<{ field: ExcelFieldItem; order: number }> = [],
  orderState = { value: 0 },
) => {
  for (const field of fields) {
    const normalizedField = cloneExcelFieldShallow(field, parentExcelField)
    if (!normalizedField) {
      continue
    }
    result.push({
      field: normalizedField,
      order: orderState.value,
    })
    orderState.value += 1
    flattenExcelFields(field?.subformExcelFields || [], normalizedField.excelField, result, orderState)
  }
  return result
}

const mergeExcelField = (currentField: ExcelFieldItem, nextField: ExcelFieldItem): ExcelFieldItem => ({
  ...currentField,
  ...nextField,
  excelFieldTitle: normalizeText(currentField.excelFieldTitle) || normalizeText(nextField.excelFieldTitle) || currentField.excelField,
  formFieldTitle: normalizeText(currentField.formFieldTitle) || normalizeText(nextField.formFieldTitle) || undefined,
  formFieldType: normalizeText(currentField.formFieldType) || normalizeText(nextField.formFieldType) || undefined,
  parentExcelField: normalizeExcelFieldKey(currentField.parentExcelField)
    || normalizeExcelFieldKey(nextField.parentExcelField)
    || undefined,
})

const buildNormalizedExcelFieldTree = (fields: ExcelFieldItem[] = [], columnValues: ExcelColumnValues = {}) => {
  const flattened = flattenExcelFields(fields)
  const fieldMap = new Map<ExcelColumnKey, ExcelFieldItem>()
  const fieldOrderMap = new Map<ExcelColumnKey, number>()

  for (const entry of flattened) {
    if (isSkippedExcelField(entry.field)) {
      continue
    }
    const key = normalizeExcelFieldKey(entry.field.excelField)
    if (!key) {
      continue
    }
    const currentField = fieldMap.get(key)
    fieldMap.set(key, currentField ? mergeExcelField(currentField, entry.field) : entry.field)
    if (!fieldOrderMap.has(key)) {
      fieldOrderMap.set(key, entry.order)
    }
  }

  const childMap = new Map<ExcelColumnKey, ExcelColumnKey[]>()
  for (const field of fieldMap.values()) {
    const parentExcelField = normalizeExcelFieldKey(field.parentExcelField)
    if (!parentExcelField || !fieldMap.has(parentExcelField)) {
      continue
    }
    const children = childMap.get(parentExcelField) || []
    if (!children.includes(field.excelField)) {
      children.push(field.excelField)
      childMap.set(parentExcelField, children)
    }
  }

  const buildNode = (excelField: ExcelColumnKey): NormalizedExcelFieldNode => {
    const field = fieldMap.get(excelField)!
    const children = (childMap.get(excelField) || [])
      .sort((left, right) => getExcelFieldOrder(left) - getExcelFieldOrder(right))
      .map(childExcelField => buildNode(childExcelField))
    const fieldName = normalizeText(field.formFieldTitle) || normalizeText(field.excelFieldTitle) || excelField
    const distinctValues = uniqueStrings(columnValues[excelField], ENUM_SAMPLE_LIMIT)
    const widgetType = resolveExcelWidgetType({
      field,
      fieldName,
      hasChildren: children.length > 0,
      distinctValues,
    })
    const validationFormat = resolveValidationFormat(fieldName, field.excelFieldType, widgetType)
    const enumOptions = resolveEnumOptions(widgetType, distinctValues)
    return {
      excelField,
      excelFieldTitle: normalizeText(field.excelFieldTitle) || excelField,
      fieldName,
      fieldKey: `field-${excelField}`,
      excelFieldType: normalizeText(field.excelFieldType) || undefined,
      widgetType,
      validationFormat,
      enumOptions,
      parentExcelField: normalizeExcelFieldKey(field.parentExcelField) || undefined,
      children,
    }
  }

  const rootExcelFields = [...fieldMap.values()]
    .filter((field) => {
      const parentExcelField = normalizeExcelFieldKey(field.parentExcelField)
      return !parentExcelField || !fieldMap.has(parentExcelField)
    })
    .sort((left, right) => {
      const leftOrder = fieldOrderMap.get(left.excelField) ?? Number.MAX_SAFE_INTEGER
      const rightOrder = fieldOrderMap.get(right.excelField) ?? Number.MAX_SAFE_INTEGER
      return leftOrder - rightOrder
    })
    .map(field => field.excelField)

  return rootExcelFields.map(excelField => buildNode(excelField))
}

const resolveExplicitWidgetType = (value: unknown) => {
  const normalized = normalizeText(value)
  if (!normalized || normalized === SKIP_IMPORT_TOKEN) {
    return ''
  }
  if (normalized.startsWith('widget.')) {
    return normalized
  }
  return EXPLICIT_WIDGET_TYPE_ALIAS_MAP[normalizeToken(normalized)] || normalized
}

const resolveValidationFormat = (
  fieldName: string,
  excelFieldType: unknown,
  widgetType: string,
) => {
  const normalizedType = normalizeToken(excelFieldType)
  const normalizedName = normalizeText(fieldName)
  if (widgetType === 'widget.form.phoneInput' || /(mobile|phone|telephone|手机号|手机|电话)/i.test(normalizedName)) {
    return 'mobile-phone'
  }
  if (/(email|mail|邮箱)/i.test(normalizedName) || normalizedType === 'email') {
    return 'email'
  }
  if (/(idcard|identity|身份证|证件号)/i.test(normalizedName) || normalizedType === 'idcard') {
    return 'ID-number'
  }
  return undefined
}

const resolveEnumOptions = (
  widgetType: string,
  distinctValues: string[],
) => {
  if (!['widget.form.radioGroup', 'widget.form.checkboxGroup'].includes(widgetType)) {
    return undefined
  }
  if (distinctValues.length < 2 || distinctValues.length > ENUM_SAMPLE_LIMIT) {
    return undefined
  }
  return distinctValues.map((value) => ({
    label: value,
    value,
  }))
}

const resolveExcelWidgetType = (options: {
  field: ExcelFieldItem
  fieldName: string
  hasChildren: boolean
  distinctValues: string[]
}) => {
  const explicitWidgetType = resolveExplicitWidgetType(options.field.formFieldType)
  if (explicitWidgetType) {
    return explicitWidgetType
  }
  if (options.hasChildren) {
    return 'widget.form.subform'
  }

  const normalizedName = normalizeText(options.fieldName)
  const normalizedType = normalizeToken(options.field.excelFieldType)

  if (
    normalizedType === 'boolean'
    || normalizedType === 'bool'
    || /^(是否|is[a-z]?)/i.test(normalizedName)
  ) {
    return 'widget.form.switch'
  }

  if (
    /(money|amount|currency|price|cost|fee|total|金额|单价|总价|费用|成本|报价|预算)/i.test(normalizedName)
    || /(amount|currency|money|decimal)/i.test(normalizedType)
  ) {
    return 'widget.form.amountInput'
  }

  if (
    /(number|int|float|double|decimal|numeric|percent|ratio)/i.test(normalizedType)
    || /(数量|数值|百分比|占比|次数|分数|评分)/.test(normalizedName)
  ) {
    return 'widget.form.numberInput'
  }

  if (
    /(datetime|timestamp|date)/i.test(normalizedType)
    || /(日期|时间|到期|截至|生日|发生时间|创建时间|更新时间)/.test(normalizedName)
  ) {
    return 'widget.form.datePicker'
  }

  if (
    /(phone|mobile|telephone|tel)/i.test(normalizedType)
    || /(手机号|手机|电话|联系电话)/.test(normalizedName)
  ) {
    return 'widget.form.phoneInput'
  }

  if (/(address|location)/i.test(normalizedType) || /(地址|地点|位置)/.test(normalizedName)) {
    return 'widget.form.address'
  }

  if (/(file|attachment)/i.test(normalizedType) || /(附件|文件|合同)/.test(normalizedName)) {
    return 'widget.form.file-uploader'
  }

  if (/(image|picture|photo)/i.test(normalizedType) || /(图片|照片|截图|头像)/.test(normalizedName)) {
    return 'widget.form.image-uploader'
  }

  if (
    options.distinctValues.length >= 2
    && options.distinctValues.length <= ENUM_SAMPLE_LIMIT
    && (
      /(enum|option|select)/i.test(normalizedType)
      || /(status|type|category|level|priority|result|stage|source|channel|gender)/i.test(normalizedName)
      || /(状态|类型|类别|级别|优先级|结果|阶段|来源|渠道|性别)/.test(normalizedName)
    )
  ) {
    return options.distinctValues.length <= 5
      ? 'widget.form.radioGroup'
      : 'widget.form.checkboxGroup'
  }

  return 'widget.form.textInput'
}

const countLeafColumns = (columns: Array<{ excelField: ExcelColumnKey; parentExcelField?: ExcelColumnKey }>) => {
  const parentExcelFields = new Set(
    columns
      .map(column => column.parentExcelField)
      .filter((value): value is ExcelColumnKey => Boolean(value)),
  )
  return columns.filter(column => !parentExcelFields.has(column.excelField)).length
}

const collectColumnBindingsFromNodes = (
  nodes: NormalizedExcelFieldNode[],
  parentFieldKey?: string,
  result: NocodeEditorAiExcelColumnBinding[] = [],
): NocodeEditorAiExcelColumnBinding[] => {
  for (const node of nodes) {
    result.push({
      excelField: node.excelField,
      fieldKey: node.fieldKey,
      fieldName: node.fieldName,
      parentExcelField: node.parentExcelField,
      parentFieldKey,
    })
    collectColumnBindingsFromNodes(node.children, node.fieldKey, result)
  }
  return result
}

const convertNodeToBlueprintField = (node: NormalizedExcelFieldNode): NocodeEditorAiAppBlueprintField => ({
  fieldKey: node.fieldKey,
  name: node.fieldName,
  widgetType: node.widgetType,
  validationFormat: node.validationFormat,
  enumOptions: node.enumOptions,
  children: node.children.length
    ? node.children.map(child => convertNodeToBlueprintField(child))
    : undefined,
  excelSource: {
    excelField: node.excelField,
    title: node.excelFieldTitle,
    type: node.excelFieldType,
    parentExcelField: node.parentExcelField,
  },
})

const buildFormKey = (source: NocodeEditorAiExcelBlueprintDraftInput['source'], tableName: string) => {
  const identifier = [
    normalizeIdentifier(source.worksheet),
    normalizeIdentifier(tableName),
  ].filter(Boolean).join('-')
  return `excel-form-${identifier || 'import'}`
}

const buildBlueprintTitle = (tableName: string) => `${tableName || 'Excel'} Import Draft`

const buildBlueprintSummary = (options: {
  source: NocodeEditorAiExcelBlueprintDraftInput['source']
  tableName: string
  fieldCount: number
  subformCount: number
}) => {
  const parts = [
    `${options.source.fileName || 'Excel'} / ${options.source.worksheet || 'Sheet'}`,
    `${options.tableName || 'Form'}`,
    `${options.fieldCount} fields`,
  ]
  if (options.subformCount > 0) {
    parts.push(`${options.subformCount} subforms`)
  }
  return parts.join(' | ')
}

const buildCompactDescriptorFromDraftInput = (
  input: NocodeEditorAiExcelBlueprintDraftInput,
): ExcelImportContextDescriptor => {
  const tableName = normalizeText(input.tableName) || normalizeText(input.source?.worksheet) || 'Excel Import'
  const groupName = normalizeText(input.groupName) || undefined
  const normalizedNodes = buildNormalizedExcelFieldTree(input.excelFields, input.columnValues || {})
  const formKey = buildFormKey(input.source, tableName)
  const columns = collectColumnBindingsFromNodes(normalizedNodes)
    .map((binding) => {
      const node = findNodeByFieldKey(normalizedNodes, binding.fieldKey)
      const distinctValuesSample = uniqueStrings(
        (input.columnValues || {})[binding.excelField],
        COMPACT_SAMPLE_LIMIT,
      )
      return {
        excelField: binding.excelField,
        title: node?.excelFieldTitle || binding.fieldName,
        type: node?.excelFieldType,
        fieldKey: binding.fieldKey,
        fieldName: binding.fieldName,
        widgetType: node?.widgetType,
        parentExcelField: binding.parentExcelField,
        parentFieldKey: binding.parentFieldKey,
        sampleValues: distinctValuesSample,
        distinctValuesSample,
        kind: node?.children.length
          ? 'subform'
          : binding.parentExcelField
            ? 'subform-child'
            : 'field',
      } satisfies ExcelImportContextDescriptor['columns'][number]
    })
    .sort((left, right) => getExcelFieldOrder(left.excelField) - getExcelFieldOrder(right.excelField))

  return {
    source: {
      kind: 'excel',
      fileName: normalizeText(input.source?.fileName),
      worksheet: normalizeText(input.source?.worksheet),
      titleRowIndex: Number(input.source?.titleRowIndex || 0),
      uploadSourceType: input.source?.uploadSourceType || undefined,
    },
    formKey,
    tableName,
    groupName,
    columns,
  }
}

const buildFieldIndex = (
  fields: NocodeEditorAiAppBlueprintField[] = [],
  parentFieldKey?: string,
  result = new Map<string, {
    field: NocodeEditorAiAppBlueprintField
    parentFieldKey?: string
  }>(),
) => {
  for (const field of fields) {
    const fieldKey = normalizeText(field?.fieldKey)
    if (!fieldKey) {
      continue
    }
    result.set(fieldKey, {
      field,
      parentFieldKey,
    })
    buildFieldIndex(field.children || [], fieldKey, result)
  }
  return result
}

const buildCompactDescriptorFromContext = (options: {
  context: NocodeEditorAiExcelBlueprintImportContext
  fields?: NocodeEditorAiAppBlueprintField[]
  groupName?: string
  columnValues?: ExcelColumnValues
}) => {
  const fieldIndex = buildFieldIndex(options.fields || [])
  const columns = (Array.isArray(options.context.columns) ? options.context.columns : [])
    .map((column) => {
      const fieldEntry = fieldIndex.get(normalizeText(column.fieldKey))
      const excelSource = fieldEntry?.field?.excelSource
      const distinctValuesSample = uniqueStrings(
        (options.columnValues || {})[column.excelField],
        COMPACT_SAMPLE_LIMIT,
      )
      return {
        excelField: column.excelField,
        title: normalizeText(excelSource?.title) || normalizeText(column.fieldName) || column.excelField,
        type: normalizeText(excelSource?.type) || undefined,
        fieldKey: normalizeText(column.fieldKey) || undefined,
        fieldName: normalizeText(column.fieldName) || normalizeText(excelSource?.title) || column.excelField,
        widgetType: normalizeText(fieldEntry?.field?.widgetType) || undefined,
        parentExcelField: normalizeExcelFieldKey(column.parentExcelField) || undefined,
        parentFieldKey: normalizeText(column.parentFieldKey) || fieldEntry?.parentFieldKey || undefined,
        sampleValues: distinctValuesSample,
        distinctValuesSample,
        kind: normalizeText(fieldEntry?.field?.widgetType) === 'widget.form.subform'
          ? 'subform'
          : column.parentExcelField
            ? 'subform-child'
            : 'field',
      } satisfies ExcelImportContextDescriptor['columns'][number]
    })
    .sort((left, right) => getExcelFieldOrder(left.excelField) - getExcelFieldOrder(right.excelField))

  return {
    source: {
      kind: 'excel' as const,
      fileName: normalizeText(options.context.source?.fileName),
      worksheet: normalizeText(options.context.source?.worksheet),
      titleRowIndex: Number(options.context.source?.titleRowIndex || 0),
      uploadSourceType: options.context.source?.uploadSourceType || undefined,
    },
    formKey: normalizeText(options.context.formKey),
    tableName: normalizeText(options.context.tableName),
    groupName: normalizeText(options.groupName) || undefined,
    columns,
  }
}

const findNodeByFieldKey = (
  nodes: NormalizedExcelFieldNode[],
  fieldKey: string,
): NormalizedExcelFieldNode | null => {
  for (const node of nodes) {
    if (node.fieldKey === fieldKey) {
      return node
    }
    const matchedChild = findNodeByFieldKey(node.children, fieldKey)
    if (matchedChild) {
      return matchedChild
    }
  }
  return null
}

const findBlueprintFormWithExcelContext = (
  blueprint: NocodeEditorAiAppBlueprint | null | undefined,
  targetFormKey?: string | null,
) => {
  const forms = Array.isArray(blueprint?.forms) ? blueprint!.forms : []
  const normalizedTargetFormKey = normalizeText(targetFormKey)
  if (normalizedTargetFormKey) {
    const exactMatch = forms.find(form => normalizeText(form.formKey) === normalizedTargetFormKey)
    if (exactMatch?.excelImportContext) {
      return exactMatch
    }
  }
  return forms.find(form => form?.excelImportContext) || null
}

const resolveCompactDescriptor = (input: unknown): ExcelImportContextDescriptor | null => {
  if (!input) {
    return null
  }

  if (
    isRecord(input)
    && Array.isArray(input.excelFields)
    && isRecord(input.source)
  ) {
    return buildCompactDescriptorFromDraftInput(input as NocodeEditorAiExcelBlueprintDraftInput)
  }

  if (isRecord(input) && isRecord(input.excelImportContext)) {
    const form = input as NocodeEditorAiAppBlueprintForm
    return buildCompactDescriptorFromContext({
      context: form.excelImportContext!,
      fields: form.fields,
      groupName: form.groupName,
    })
  }

  if (isRecord(input) && isRecord(input.context)) {
    const value = input as {
      context: NocodeEditorAiExcelBlueprintImportContext
      fields?: NocodeEditorAiAppBlueprintField[]
      groupName?: string
      columnValues?: ExcelColumnValues
    }
    return buildCompactDescriptorFromContext({
      context: value.context,
      fields: value.fields,
      groupName: value.groupName,
      columnValues: value.columnValues,
    })
  }

  if (isRecord(input) && isRecord(input.blueprint)) {
    const value = input as {
      blueprint: NocodeEditorAiAppBlueprint | null | undefined
      targetFormKey?: string | null
      columnValues?: ExcelColumnValues
    }
    const form = findBlueprintFormWithExcelContext(value.blueprint, value.targetFormKey)
    if (!form?.excelImportContext) {
      return null
    }
    return buildCompactDescriptorFromContext({
      context: form.excelImportContext,
      fields: form.fields,
      groupName: form.groupName,
      columnValues: value.columnValues,
    })
  }

  return null
}

const buildCompactCounts = (columns: ExcelImportContextDescriptor['columns']) => ({
  columnCount: columns.length,
  subformCount: columns.filter(column => column.kind === 'subform').length,
  leafFieldCount: countLeafColumns(columns),
})

const normalizeBindingMatchKey = (value: unknown) => normalizeToken(value)

const buildBindingIndex = (bindings: NocodeEditorAiBlueprintFieldBinding[] = []) => {
  const byFieldKey = new Map<string, NocodeEditorAiBlueprintFieldBinding>()
  const byFieldName = new Map<string, NocodeEditorAiBlueprintFieldBinding[]>()

  for (const binding of bindings) {
    const fieldKey = normalizeText(binding?.fieldKey)
    const fieldNameKey = normalizeBindingMatchKey(binding?.fieldName)
    if (fieldKey) {
      byFieldKey.set(fieldKey, binding)
    }
    if (fieldNameKey) {
      const bucket = byFieldName.get(fieldNameKey) || []
      bucket.push(binding)
      byFieldName.set(fieldNameKey, bucket)
    }
  }

  return {
    byFieldKey,
    byFieldName,
  }
}

const findApplyResultForm = (
  applyForms: NocodeEditorAiBlueprintApplyFormResult[],
  context: ExcelImportContextDescriptor,
) => {
  const applyTargetKey = getNocodeEditorBlueprintFormApplyTargetIdentity({
    formKey: context.formKey,
    tableName: context.tableName,
  })
  const directMatch = applyForms.find(form => normalizeText(form.applyTargetKey) === applyTargetKey)
  if (directMatch) {
    return {
      applyTargetKey,
      applyForm: directMatch,
    }
  }
  const formKeyMatch = applyForms.find(form => normalizeText(form.formKey) === context.formKey)
  if (formKeyMatch) {
    return {
      applyTargetKey,
      applyForm: formKeyMatch,
    }
  }
  const tableNameMatch = applyForms.find(form => normalizeToken(form.tableName) === normalizeToken(context.tableName))
  return {
    applyTargetKey,
    applyForm: tableNameMatch || null,
  }
}

const resolveColumnBinding = (
  column: ExcelImportContextDescriptor['columns'][number],
  bindingIndex: ReturnType<typeof buildBindingIndex>,
) => {
  const fieldKey = normalizeText(column.fieldKey)
  if (fieldKey && bindingIndex.byFieldKey.has(fieldKey)) {
    return bindingIndex.byFieldKey.get(fieldKey) || null
  }
  const sameNameBindings = bindingIndex.byFieldName.get(normalizeBindingMatchKey(column.fieldName)) || []
  if (!sameNameBindings.length) {
    return null
  }
  if (!column.parentFieldKey) {
    return sameNameBindings[0] || null
  }
  return sameNameBindings.find(binding => normalizeText(binding.parentFieldKey) === normalizeText(column.parentFieldKey))
    || sameNameBindings[0]
    || null
}

export const buildExcelBlueprintDraft = (
  input: NocodeEditorAiExcelBlueprintDraftInput,
): NocodeEditorAiAppBlueprint => {
  const descriptor = buildCompactDescriptorFromDraftInput(input)
  const normalizedNodes = buildNormalizedExcelFieldTree(input.excelFields, input.columnValues || {})
  const fields = normalizedNodes.map(node => convertNodeToBlueprintField(node))
  const counts = buildCompactCounts(descriptor.columns)
  const form: NocodeEditorAiAppBlueprintForm = {
    formKey: descriptor.formKey,
    tableName: descriptor.tableName,
    groupName: descriptor.groupName,
    fields,
    excelImportContext: {
      source: descriptor.source,
      formKey: descriptor.formKey,
      tableName: descriptor.tableName,
      columns: descriptor.columns.map((column) => ({
        excelField: column.excelField,
        fieldKey: normalizeText(column.fieldKey) || `field-${column.excelField}`,
        fieldName: column.fieldName,
        parentExcelField: column.parentExcelField,
        parentFieldKey: column.parentFieldKey,
      })),
    },
  }

  return {
    title: buildBlueprintTitle(descriptor.tableName),
    summary: buildBlueprintSummary({
      source: input.source,
      tableName: descriptor.tableName,
      fieldCount: counts.leafFieldCount,
      subformCount: counts.subformCount,
    }),
    forms: [form],
    assumptions: [],
    openQuestions: [],
  }
}

export const compactExcelImportContextForModel = (
  input:
    | NocodeEditorAiExcelBlueprintDraftInput
    | NocodeEditorAiAppBlueprintForm
    | {
      blueprint: NocodeEditorAiAppBlueprint | null | undefined
      targetFormKey?: string | null
      columnValues?: ExcelColumnValues
    }
    | {
      context: NocodeEditorAiExcelBlueprintImportContext
      fields?: NocodeEditorAiAppBlueprintField[]
      groupName?: string
      columnValues?: ExcelColumnValues
    }
    | null
    | undefined,
): ExcelImportContextCompact | null => {
  const descriptor = resolveCompactDescriptor(input)
  if (!descriptor) {
    return null
  }
  const counts = buildCompactCounts(descriptor.columns)
  return {
    compactContract: 'nocode-editor-excel-import-context@1',
    source: descriptor.source,
    targetForm: {
      formKey: descriptor.formKey,
      tableName: descriptor.tableName,
      groupName: descriptor.groupName,
    },
    counts,
    columns: descriptor.columns,
  }
}

export const buildExcelImportMappingsFromApplyResult = (input: {
  blueprint?: NocodeEditorAiAppBlueprint | null | undefined
  form?: NocodeEditorAiAppBlueprintForm | null | undefined
  context?: NocodeEditorAiExcelBlueprintImportContext | null | undefined
  applyResult?: NocodeEditorAiBlueprintApplyResult | null | undefined
  targetFormKey?: string | null
}): ExcelImportMappingsFromApplyResult => {
  const compactDescriptor = input.form?.excelImportContext
    ? buildCompactDescriptorFromContext({
      context: input.form.excelImportContext,
      fields: input.form.fields,
      groupName: input.form.groupName,
    })
    : input.context
      ? buildCompactDescriptorFromContext({
        context: input.context,
      })
      : resolveCompactDescriptor({
        blueprint: input.blueprint,
        targetFormKey: input.targetFormKey,
      })

  const mapping: ExcelFormColMap = {}
  const subformMappings: ExcelSubformColMaps = {}
  const unresolvedColumns: ExcelImportMappingsFromApplyResult['unresolvedColumns'] = []
  const warnings: string[] = []

  if (!compactDescriptor) {
    return {
      ok: false,
      formKey: normalizeText(input.targetFormKey),
      applyTargetKey: normalizeText(input.targetFormKey),
      mapping,
      subformMappings,
      unresolvedColumns,
      warnings: ['missing_excel_import_context'],
    }
  }

  const applyForms = Array.isArray(input.applyResult?.forms) ? input.applyResult!.forms : []
  const { applyTargetKey, applyForm } = findApplyResultForm(applyForms, compactDescriptor)

  if (!applyForm) {
    return {
      ok: false,
      formKey: compactDescriptor.formKey,
      applyTargetKey,
      mapping,
      subformMappings,
      unresolvedColumns,
      warnings: ['missing_apply_result_form'],
    }
  }

  const fieldBindings = Array.isArray(applyForm.fieldBindings) ? applyForm.fieldBindings : []
  const bindingIndex = buildBindingIndex(fieldBindings)
  const resolvedParentBindings = new Map<ExcelColumnKey, NocodeEditorAiBlueprintFieldBinding>()

  for (const column of compactDescriptor.columns) {
    if (column.parentExcelField) {
      let parentBinding = resolvedParentBindings.get(column.parentExcelField) || null
      if (!parentBinding) {
        const parentColumn = compactDescriptor.columns.find(item => item.excelField === column.parentExcelField) || null
        parentBinding = parentColumn ? resolveColumnBinding(parentColumn, bindingIndex) : null
        if (parentBinding) {
          resolvedParentBindings.set(column.parentExcelField, parentBinding)
          mapping[column.parentExcelField] = parentBinding.widgetId
        }
      }
      if (!parentBinding?.widgetId) {
        const reason = `missing_parent_binding:${column.parentExcelField}`
        unresolvedColumns.push({
          excelField: column.excelField,
          fieldKey: column.fieldKey,
          fieldName: column.fieldName,
          parentExcelField: column.parentExcelField,
          reason,
        })
        warnings.push(reason)
        continue
      }

      const childBinding = resolveColumnBinding(column, bindingIndex)
      if (!childBinding?.widgetId) {
        const reason = 'missing_child_binding'
        unresolvedColumns.push({
          excelField: column.excelField,
          fieldKey: column.fieldKey,
          fieldName: column.fieldName,
          parentExcelField: column.parentExcelField,
          reason,
        })
        warnings.push(reason)
        continue
      }

      subformMappings[column.parentExcelField] = {
        ...(subformMappings[column.parentExcelField] || {}),
        [column.excelField]: childBinding.widgetId,
      }
      continue
    }

    const binding = resolveColumnBinding(column, bindingIndex)
    if (!binding?.widgetId) {
      const reason = 'missing_field_binding'
      unresolvedColumns.push({
        excelField: column.excelField,
        fieldKey: column.fieldKey,
        fieldName: column.fieldName,
        reason,
      })
      warnings.push(reason)
      continue
    }

    mapping[column.excelField] = binding.widgetId
    if (binding.widgetType === 'widget.form.subform') {
      resolvedParentBindings.set(column.excelField, binding)
    }
  }

  return {
    ok: unresolvedColumns.length === 0,
    formKey: compactDescriptor.formKey,
    applyTargetKey,
    tableId: normalizeText(applyForm.tableId) || undefined,
    tableName: normalizeText(applyForm.tableName) || undefined,
    mapping,
    subformMappings,
    unresolvedColumns,
    warnings: uniqueStrings(warnings),
  }
}
