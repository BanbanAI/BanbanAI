import type { AiExcelAnalysisColumnContext } from '@common/types/aiExcelAnalysis'

export const EXCEL_SKIP_IMPORT_TOKEN = '不导入'

export type ExcelFieldColumnKey = `col-${number}`
export type ExcelLocalFieldPresetConfidence = 'high' | 'medium' | 'low'

export type ExcelLocalFieldPresetEvidence = {
  kind: 'title' | 'excel_type' | 'sample' | 'distinct_values' | 'empty_column' | 'fallback'
  reason: string
}

export type ExcelLocalFieldPresetInput = {
  excelField: ExcelFieldColumnKey
  excelFieldTitle?: string
  currentFieldTitle?: string
  currentFieldType?: string
  detectedFieldType?: string
  excelFieldType?: string
  hasSubformChildren?: boolean
  column?: AiExcelAnalysisColumnContext
}

export type ExcelLocalFieldPresetItem = {
  excelField: ExcelFieldColumnKey
  import?: boolean
  fieldTitle?: string
  fieldType?: string
  decisionLevel?: 'clear' | 'review'
  reason?: string
  resolvedBy?: 'rule'
  confidence?: ExcelLocalFieldPresetConfidence
  evidence?: ExcelLocalFieldPresetEvidence[]
}

export type ExcelLocalFieldPresetResult = {
  recommendation: ExcelLocalFieldPresetItem
  confidence: ExcelLocalFieldPresetConfidence
  evidence: ExcelLocalFieldPresetEvidence[]
}

const SUPPORTED_WIDGET_TYPES = [
  EXCEL_SKIP_IMPORT_TOKEN,
  'widget.form.textInput',
  'widget.form.textarea',
  'widget.form.numberInput',
  'widget.form.amountInput',
  'widget.form.serialNumber',
  'widget.form.datePicker',
  'widget.form.dateRangePicker',
  'widget.form.radioGroup',
  'widget.form.checkboxGroup',
  'widget.form.treeSelect',
  'widget.form.treeMultipleSelect',
  'widget.form.memberSelect',
  'widget.form.departmentSelect',
  'widget.form.subform',
  'widget.form.phoneInput',
  'widget.form.address',
  'widget.form.richTextEditor',
  'widget.form.markdownEditor',
] as const

const SUPPORTED_WIDGET_TYPE_SET = new Set<string>(SUPPORTED_WIDGET_TYPES)

const WIDGET_TYPE_ALIAS_MAP: Record<string, string> = {
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
  daterange: 'widget.form.dateRangePicker',
  datepicker: 'widget.form.datePicker',
  daterangepicker: 'widget.form.dateRangePicker',
  datetime: 'widget.form.datePicker',
  phone: 'widget.form.phoneInput',
  mobile: 'widget.form.phoneInput',
  address: 'widget.form.address',
  radio: 'widget.form.radioGroup',
  radiogroup: 'widget.form.radioGroup',
  select: 'widget.form.radioGroup',
  enum: 'widget.form.radioGroup',
  checkbox: 'widget.form.checkboxGroup',
  checkboxgroup: 'widget.form.checkboxGroup',
  singleselect: 'widget.form.treeSelect',
  multiselect: 'widget.form.treeMultipleSelect',
  treeselect: 'widget.form.treeSelect',
  treemultipleselect: 'widget.form.treeMultipleSelect',
  member: 'widget.form.memberSelect',
  memberselect: 'widget.form.memberSelect',
  department: 'widget.form.departmentSelect',
  departmentselect: 'widget.form.departmentSelect',
  subform: 'widget.form.subform',
  serial: 'widget.form.serialNumber',
  serialnumber: 'widget.form.serialNumber',
}

const IDENTIFIER_TITLE_PATTERN = /(学号|工号|编号|单号|单据号|流水号|序号|编码|识别码|证号|卡号|\bid\b|\bcode\b|\bsku\b|\bserial\b|\bno\.?\b|\bidentifier\b)/i
const TEXT_TITLE_PATTERN = /(姓名|名称|名字|客户|供应商|联系人|标题|主题|name|title)$/i
const LONG_TEXT_TITLE_PATTERN = /(备注|说明|描述|详情|原因|要求|内容|意见|建议|note|remark|description|comment|content)/i
const INTEGER_TITLE_PATTERN = /(年龄|数量|人数|天数|次数|件数|个数|工龄|成绩|分数|得分|age|qty|quantity|count|days|times|score)/i
const NUMBER_TITLE_PATTERN = /^(number|num)$/i
const AMOUNT_TITLE_PATTERN = /(金额|单价|总价|费用|成本|预算|报价|收款|付款|应收|应付|工资|price|amount|fee|cost|salary)/i
const DATE_RANGE_TITLE_PATTERN = /(起止|区间|周期|时间段|日期段|范围|date range|period)/i
const DATE_TITLE_PATTERN = /(日期|时间|生日|创建时间|更新时间|开始|截止|到期|入职|离职|发生时间|date|time)/i
const PHONE_TITLE_PATTERN = /(手机|手机号|联系电话|联系手机|电话|mobile|phone)/i
const ADDRESS_TITLE_PATTERN = /(地址|住址|所在地|收货地址|发货地址|详细地址|地区|区域|address)/i
const MEMBER_TITLE_PATTERN = /(负责人|成员|申请人|发起人|提交人|审批人|跟进人|归属人|owner|assignee)/i
const DEPARTMENT_TITLE_PATTERN = /(部门|科室|团队|组织|事业部|中心|分部|department|team|group)/i
const OPTION_TITLE_PATTERN = /(状态|类型|类别|分类|等级|阶段|来源|渠道|优先级|status|type|category|level|stage|source|priority)/i
const EMPTY_TITLE_PATTERN = /^(empty|blank|unused|ignore|\u7a7a\u5217|\u7a7a\u767d|\u672a\u4f7f\u7528|\u5ffd\u7565)$/i

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/[\s\-_/\\.]+/g, '')

const normalizeWidgetType = (value: unknown): string => {
  const normalized = normalizeText(value)
  if (!normalized) return ''
  if (normalized === EXCEL_SKIP_IMPORT_TOKEN) return EXCEL_SKIP_IMPORT_TOKEN
  if (SUPPORTED_WIDGET_TYPE_SET.has(normalized)) return normalized
  const alias = WIDGET_TYPE_ALIAS_MAP[normalizeToken(normalized)] || normalized
  return SUPPORTED_WIDGET_TYPE_SET.has(alias) ? alias : ''
}

const uniqueStrings = (values: Array<string | undefined | null>) => [...new Set(
  values
    .map(item => normalizeText(item))
    .filter(Boolean),
)]

const collectSamples = (column?: AiExcelAnalysisColumnContext) => uniqueStrings([
  ...(column?.sampleValues || []),
  ...(column?.distinctValuesSample || []),
])

const matchRatio = (values: string[], predicate: (value: string) => boolean) => {
  if (!values.length) return 0
  return values.filter(predicate).length / values.length
}

const isNumericLikeValue = (value: string) => /^-?\d+(?:\.\d+)?$/.test(value.replace(/[,\s]/g, ''))
const isPhoneValue = (value: string) => /^(?:86)?1[3-9]\d{9}$/.test(value.replace(/[^\d]/g, ''))
const isIdentifierLikeValue = (value: string) => {
  const normalized = normalizeText(value)
  if (!normalized) return false
  return /[a-z]/i.test(normalized)
    || /^0\d+$/.test(normalized)
    || /[a-z0-9][\-_/\\.][a-z0-9]/i.test(normalized)
}
const isDateLikeValue = (value: string) => (
  /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?$/.test(value)
  || /^\d{4}年\d{1,2}月\d{1,2}日(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?$/.test(value)
  || /^\d{8}$/.test(value)
)
const isDateRangeValue = (value: string) => /(?:至|到|~|-).*(?:\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/.test(value)

const inferredTypeMatches = (value: unknown, candidates: string[]) => {
  const normalized = normalizeToken(value)
  return candidates.map(item => normalizeToken(item)).includes(normalized)
}

const makeRecommendation = (input: {
  excelField: ExcelFieldColumnKey
  import: boolean
  fieldTitle?: string
  fieldType: string
  decisionLevel: 'clear' | 'review'
  reason: string
}): ExcelLocalFieldPresetItem => ({
  excelField: input.excelField,
  import: input.import,
  fieldTitle: input.import ? input.fieldTitle : undefined,
  fieldType: input.import ? input.fieldType : EXCEL_SKIP_IMPORT_TOKEN,
  decisionLevel: input.decisionLevel,
  reason: input.reason,
  resolvedBy: 'rule',
})

export function recommendExcelFieldByLocalRules(
  input: ExcelLocalFieldPresetInput,
): ExcelLocalFieldPresetResult {
  const titles = uniqueStrings([
    input.currentFieldTitle,
    input.excelFieldTitle,
    input.column?.title,
  ])
  const hasMeaningfulTitle = titles.length > 0
  const title = titles[0] || input.excelField
  const samples = collectSamples(input.column)
  const inferredType = input.column?.inferredType || input.excelFieldType || ''
  const detectedFieldType = normalizeWidgetType(input.detectedFieldType)
  const currentFieldType = normalizeWidgetType(input.currentFieldType)
  const evidence: ExcelLocalFieldPresetEvidence[] = []

  const hasTitle = (pattern: RegExp) => titles.some(item => pattern.test(item))
  const hasEmptyTitle = hasTitle(EMPTY_TITLE_PATTERN)
  const numericRatio = matchRatio(samples, isNumericLikeValue)
  const phoneRatio = matchRatio(samples, isPhoneValue)
  const identifierRatio = matchRatio(samples, isIdentifierLikeValue)
  const dateRatio = matchRatio(samples, isDateLikeValue)
  const dateRangeRatio = matchRatio(samples, isDateRangeValue)
  const distinctCount = uniqueStrings(samples).length
  const nonEmptySampleCount = samples.length

  if (input.hasSubformChildren) {
    evidence.push({ kind: 'title', reason: '识别为子表单容器字段' })
    return {
      recommendation: makeRecommendation({
        excelField: input.excelField,
        import: true,
        fieldTitle: title,
        fieldType: 'widget.form.subform',
        decisionLevel: 'clear',
        reason: '识别为子表单容器字段',
      }),
      confidence: 'high',
      evidence,
    }
  }

  if (!nonEmptySampleCount && (!hasMeaningfulTitle || hasEmptyTitle)) {
    evidence.push({ kind: 'empty_column', reason: '标题和样本均为空' })
    return {
      recommendation: makeRecommendation({
        excelField: input.excelField,
        import: false,
        fieldType: EXCEL_SKIP_IMPORT_TOKEN,
        decisionLevel: 'clear',
        reason: '空列建议暂不导入',
      }),
      confidence: 'high',
      evidence,
    }
  }

  if (hasTitle(PHONE_TITLE_PATTERN) && phoneRatio >= 0.6) {
    evidence.push({ kind: 'title', reason: '标题指向手机号' }, { kind: 'sample', reason: '样本多数符合手机号格式' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.phoneInput', decisionLevel: 'clear', reason: '列名与样本都明显指向手机号字段' }), confidence: 'high', evidence }
  }

  if (hasTitle(AMOUNT_TITLE_PATTERN) && (numericRatio >= 0.6 || inferredTypeMatches(inferredType, ['number', 'amount', 'currency', 'decimal']))) {
    evidence.push({ kind: 'title', reason: '标题指向金额' }, { kind: 'excel_type', reason: '类型或样本为数值' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.amountInput', decisionLevel: 'clear', reason: '列名与数值样本都明显指向金额字段' }), confidence: 'high', evidence }
  }

  if ((hasTitle(INTEGER_TITLE_PATTERN) || hasTitle(NUMBER_TITLE_PATTERN)) && (numericRatio >= 0.6 || inferredTypeMatches(inferredType, ['number', 'integer', 'decimal']))) {
    evidence.push({ kind: 'title', reason: '标题指向数量类字段' }, { kind: 'excel_type', reason: '类型或样本为数值' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.numberInput', decisionLevel: 'clear', reason: '列名与数值样本都明显指向数字字段' }), confidence: 'high', evidence }
  }

  if (hasTitle(IDENTIFIER_TITLE_PATTERN)) {
    evidence.push({ kind: 'title', reason: '标题指向业务标识符字段' })
    if (identifierRatio >= 0.5) {
      evidence.push({ kind: 'sample', reason: '样本包含字母、前导零或连接符等标识符信号' })
    }
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.textInput', decisionLevel: 'clear', reason: '标识符字段应保持文本输入，避免误判为数值字段' }), confidence: 'high', evidence }
  }

  if (hasTitle(DATE_RANGE_TITLE_PATTERN) && (dateRangeRatio >= 0.5 || inferredTypeMatches(inferredType, ['dateRange', 'daterange', 'date_range', 'period']))) {
    evidence.push({ kind: 'title', reason: '标题指向日期区间' }, { kind: 'sample', reason: '样本符合日期区间格式' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.dateRangePicker', decisionLevel: 'clear', reason: '列名与样本都明显指向日期区间字段' }), confidence: 'high', evidence }
  }

  if (hasTitle(DATE_TITLE_PATTERN) && (dateRatio >= 0.5 || inferredTypeMatches(inferredType, ['date', 'datetime', 'timestamp']))) {
    evidence.push({ kind: 'title', reason: '标题指向日期' }, { kind: 'excel_type', reason: '类型或样本为日期' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.datePicker', decisionLevel: 'clear', reason: '列名与样本都明显指向日期字段' }), confidence: 'high', evidence }
  }

  if (hasTitle(LONG_TEXT_TITLE_PATTERN)) {
    evidence.push({ kind: 'title', reason: '标题指向长文本说明字段' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.textarea', decisionLevel: 'clear', reason: '列名明显指向备注说明类字段' }), confidence: 'high', evidence }
  }

  if (hasTitle(TEXT_TITLE_PATTERN)) {
    evidence.push({ kind: 'title', reason: '标题指向普通文本字段' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.textInput', decisionLevel: 'clear', reason: '列名明显指向文本字段' }), confidence: 'high', evidence }
  }

  if (hasTitle(OPTION_TITLE_PATTERN) && distinctCount > 0 && distinctCount <= 12) {
    evidence.push({ kind: 'title', reason: '标题指向枚举字段' }, { kind: 'distinct_values', reason: `样本去重值 ${distinctCount} 个` })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.radioGroup', decisionLevel: 'review', reason: '列名与低基数样本指向单选字段，建议确认选项是否完整' }), confidence: 'medium', evidence }
  }

  if (hasTitle(MEMBER_TITLE_PATTERN)) {
    evidence.push({ kind: 'title', reason: '标题可能指向成员字段' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.memberSelect', decisionLevel: 'review', reason: '列名可能指向人员字段，建议确认是否需要绑定成员' }), confidence: 'medium', evidence }
  }

  if (hasTitle(DEPARTMENT_TITLE_PATTERN)) {
    evidence.push({ kind: 'title', reason: '标题可能指向部门字段' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.departmentSelect', decisionLevel: 'review', reason: '列名可能指向部门字段，建议确认是否需要绑定组织部门' }), confidence: 'medium', evidence }
  }

  if (hasTitle(ADDRESS_TITLE_PATTERN)) {
    evidence.push({ kind: 'title', reason: '标题可能指向地址字段' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: true, fieldTitle: title, fieldType: 'widget.form.address', decisionLevel: 'review', reason: '列名可能指向地址字段，建议确认地址格式' }), confidence: 'medium', evidence }
  }

  if (detectedFieldType && detectedFieldType !== EXCEL_SKIP_IMPORT_TOKEN) {
    evidence.push({ kind: 'excel_type', reason: '仅 Excel 类型命中，缺少明确标题语义' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: false, fieldType: EXCEL_SKIP_IMPORT_TOKEN, decisionLevel: 'review', reason: '仅根据 Excel 类型无法确定业务字段，默认不导入' }), confidence: 'low', evidence }
  }

  if (currentFieldType && currentFieldType !== EXCEL_SKIP_IMPORT_TOKEN) {
    evidence.push({ kind: 'fallback', reason: '仅存在当前字段类型，缺少明确标题语义' })
    return { recommendation: makeRecommendation({ excelField: input.excelField, import: false, fieldType: EXCEL_SKIP_IMPORT_TOKEN, decisionLevel: 'review', reason: '当前字段类型缺少明确语义支撑，默认不导入' }), confidence: 'low', evidence }
  }

  evidence.push({ kind: 'fallback', reason: '未命中明确本地规则' })
  return {
    recommendation: makeRecommendation({ excelField: input.excelField, import: false, fieldType: EXCEL_SKIP_IMPORT_TOKEN, decisionLevel: 'review', reason: '本地规则无法确定字段类型，默认不导入' }),
    confidence: 'low',
    evidence,
  }
}
