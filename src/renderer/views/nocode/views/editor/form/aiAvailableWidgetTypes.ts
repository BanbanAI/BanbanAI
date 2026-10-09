import { allFormFieldTypes } from '../../../../../b2/formFieldTypes'

export type NocodeEditorAvailableWidgetType = {
  category: string
  type: string
  name: string
  aliases: string[]
}

export const AI_WIDGET_TYPE_ALIAS_MAP: Record<string, string[]> = {
  'widget.form.textInput': ['input', 'text', 'string', 'textinput', 'singleline', 'singlelinetext', 'shorttext', 'email', 'mail', '单行', '单行文本', '文本', '输入框'],
  'widget.form.textarea': ['textarea', 'multiline', 'multilinetext', 'paragraph', 'longtext', '多行', '多行文本'],
  'widget.form.numberInput': ['number', 'integer', 'float', 'numberinput', '数字'],
  'widget.form.amountInput': ['amount', 'currency', 'money', 'price', 'priceinput', '金额', '单价', '总价', '售价', '进价', '成本价', '金额输入'],
  'widget.form.serialNumber': ['serial', 'serialnumber', 'autoid', '自动编号', '编号', '编码', '单号', '单据号', '流水号'],
  'widget.form.datePicker': ['date', 'datetime', 'datepicker', '日期', '日期时间'],
  'widget.form.dateRangePicker': ['daterange', 'date-range', '时间范围', '日期范围'],
  'widget.form.timePicker': ['time', 'timepicker', '时间'],
  'widget.form.radioGroup': ['radio', 'singlechoice', '单选'],
  'widget.form.checkboxGroup': ['checkbox', 'multichoice', '多选'],
  'widget.form.treeSelect': ['select', 'dropdown', 'treeselect', 'singleselect', 'single-select', '下拉单选', 'relation', 'reference', 'lookup', 'related', '关联', '关联字段', '引用', '来自他表', '他表数据'],
  'widget.form.treeMultipleSelect': ['multiple-select', 'dropdownmultiple', 'treemultipleselect', 'multiselect', 'multi-select', '下拉多选'],
  'widget.form.memberSelect': ['member', 'user', 'memberselect', '成员', '人员'],
  'widget.form.departmentSelect': ['department', 'dept', 'departmentselect', '部门'],
  'widget.form.subform': ['subform', 'sub-form', 'childtable', 'child-form', '子表', '子表单', '明细', '清单', '条目'],
  'widget.form.phoneInput': ['phone', 'mobile', 'phonenumber', 'phoneinput', '手机号', '手机'],
  'widget.form.address': ['address', '地址', '收货地址', '发货地址', '联系地址', '配送地址'],
  'widget.form.rate': ['rate', 'rating', 'score', '评分'],
  'widget.form.position': ['position', 'location', '定位'],
  'widget.form.tagInput': ['tag', 'tags', 'taginput', '标签', '标签文本'],
  'widget.form.richTextEditor': ['richtext', 'editor', 'rich-text', '富文本'],
  'widget.form.image-uploader': ['image', 'imageupload', 'uploader-image', '上传图片', '图片'],
  'widget.form.file-uploader': ['file', 'fileupload', 'attachment', 'uploader-file', '上传附件', '附件'],
  'widget.form.switch': ['switch', 'toggle', 'boolean', 'bool', '开关'],
  'widget.form.searchForm': ['searchform', 'lookup', '查询表单'],
  'widget.form.hyperlink': ['link', 'url', 'hyperlink', '超链接'],
  'widget.form.autoCompute': ['autocompute', 'formula', 'calc', 'compute', '实时计算'],
  'widget.form.selectData': ['selectdata', 'relationselect', '选择数据'],
  'widget.form.relatedData': ['relateddata', 'relationfield', '关联字段', '关联数据'],
  'widget.form.titleBar': ['title', 'titlebar', '标题栏'],
  'widget.form.imageTextShow': ['imagetext', 'image-text', '图文展示'],
  'widget.form.multipleTabs': ['tabs', 'tab', 'multitab', 'multiple-tabs', '选项卡'],
}

export const normalizeAiWidgetToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s._-]+/g, '')

export const getAiWidgetTypeAliases = (widgetType: string, widgetName: string) => {
  const suffix = String(widgetType || '').split('.').pop() || ''
  const normalizedName = String(widgetName || '').trim()
  return Array.from(new Set([
    ...(AI_WIDGET_TYPE_ALIAS_MAP[widgetType] || []),
    suffix,
    normalizedName,
  ].filter(Boolean)))
}

export const buildAiAvailableWidgetTypes = (): NocodeEditorAvailableWidgetType[] => {
  return allFormFieldTypes.flatMap(group => group.children.map(item => {
    return {
      category: group.category,
      type: item.type,
      name: item.name,
      aliases: getAiWidgetTypeAliases(item.type, item.name),
    }
  }))
}

export const resolveAiAvailableWidgetType = (
  widgetType: string,
  availableWidgetTypes: NocodeEditorAvailableWidgetType[] = buildAiAvailableWidgetTypes(),
) => {
  const normalized = String(widgetType || '').trim()
  if (!normalized) return ''
  const normalizedToken = normalizeAiWidgetToken(normalized)
  const normalizedCandidates = Array.from(new Set([
    normalizedToken,
    normalizedToken.replace(/^widgetform/, ''),
    normalizedToken.replace(/^widget/, ''),
  ].filter(Boolean)))
  const match = availableWidgetTypes.find(item => {
    const candidates = [
      item.type,
      item.name,
      ...(Array.isArray(item.aliases) ? item.aliases : []),
    ]
    return candidates.some(candidate => normalizedCandidates.includes(normalizeAiWidgetToken(candidate)))
  })
  return match?.type || ''
}
