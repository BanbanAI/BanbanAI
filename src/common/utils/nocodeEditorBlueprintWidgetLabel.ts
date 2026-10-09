import i18next from 'i18next'

const normalizeBlueprintWidgetTypeToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s._-]+/g, '')

type BlueprintWidgetTypeLabelEntry = {
  label: string
  aliases: string[]
}

const BLUEPRINT_WIDGET_TYPE_LABEL_ENTRIES: BlueprintWidgetTypeLabelEntry[] = [
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.singleLineText') },
    aliases: ['widget.form.textInput', 'textInput', 'text', 'input', 'singleline', 'singlelinetext', 'shorttext', '单行', '单行文本', '文本', '输入框'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.multiLineText') },
    aliases: ['widget.form.textarea', 'textarea', 'textArea', 'multiline', 'longtext', 'paragraph', '多行', '多行文本'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.number') },
    aliases: ['widget.form.numberInput', 'numberInput', 'number', 'integer', 'float', '数字'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.amount') },
    aliases: ['widget.form.amountInput', 'amountInput', 'amount', 'currency', 'money', 'price', '金额', '单价', '总价', '售价', '进价', '成本价', '金额输入'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.autoNumber') },
    aliases: ['widget.form.serialNumber', 'serialNumber', 'serial', 'autoid', '编号', '编码', '单号', '单据号', '流水号', '自动编号'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.dateTime') },
    aliases: ['widget.form.datePicker', 'datePicker', 'dateTimePicker', 'datetime', 'date', '日期', '日期时间'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.dateRange') },
    aliases: ['widget.form.dateRangePicker', 'dateRangePicker', 'daterange', 'date-range', '时间范围', '日期范围'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.time') },
    aliases: ['widget.form.timePicker', 'timePicker', 'time', '时间'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.singleChoice') },
    aliases: ['widget.form.radioGroup', 'radioGroup', 'radio', 'singlechoice', '单选'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.multipleChoice') },
    aliases: ['widget.form.checkboxGroup', 'checkboxGroup', 'checkbox', 'multichoice', '多选'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.dropdownSingle') },
    aliases: ['widget.form.treeSelect', 'treeSelect', 'select', 'dropdown', 'relation', 'reference', 'lookup', 'related', '下拉单选', '关联', '关联字段', '引用', '来自他表', '他表数据'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.dropdownMultiple') },
    aliases: ['widget.form.treeMultipleSelect', 'treeMultipleSelect', 'multipleselect', 'multiple-select', 'multiselect', '下拉多选'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.member') },
    aliases: ['widget.form.memberSelect', 'memberSelect', 'member', 'user', '成员', '人员'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.department') },
    aliases: ['widget.form.departmentSelect', 'departmentSelect', 'department', 'dept', '部门'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.subform') },
    aliases: ['widget.form.subform', 'subform', 'sub-form', 'childtable', 'childform', '子表', '子表单', '明细', '清单', '条目'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.phone') },
    aliases: ['widget.form.phoneInput', 'phoneInput', 'phone', 'mobile', '手机号', '手机'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.address') },
    aliases: ['widget.form.address', 'address', '收货地址', '发货地址', '联系地址', '配送地址', '地址'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.rating') },
    aliases: ['widget.form.rate', 'rate', 'rating', 'score', '评分'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.location') },
    aliases: ['widget.form.position', 'position', 'location', '定位'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.tagText') },
    aliases: ['widget.form.tagInput', 'tagInput', 'tag', 'tags', '标签', '标签文本'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.richText') },
    aliases: ['widget.form.richTextEditor', 'richTextEditor', 'richtext', 'rich-text', 'editor', '富文本'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.imageUpload') },
    aliases: ['widget.form.image-uploader', 'image-uploader', 'imageuploader', 'imageupload', 'imageUpload', '上传图片', '图片'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.attachmentUpload') },
    aliases: ['widget.form.file-uploader', 'file-uploader', 'fileuploader', 'fileupload', 'attachment', '上传附件', '附件'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.toggle') },
    aliases: ['widget.form.switch', 'switch', 'toggle', 'boolean', 'bool', '开关'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.queryForm') },
    aliases: ['widget.form.searchForm', 'searchForm', 'searchform', '查询表单'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.hyperlink') },
    aliases: ['widget.form.hyperlink', 'hyperlink', 'link', 'url', '超链接'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.calculated') },
    aliases: ['widget.form.autoCompute', 'autoCompute', 'autocompute', 'formula', 'calc', 'compute', '实时计算'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.selectData') },
    aliases: ['widget.form.selectData', 'selectData', 'selectdata', '选择数据'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.relatedData') },
    aliases: ['widget.form.relatedData', 'relatedData', 'relateddata', 'relationfield', '关联数据'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.titleBar') },
    aliases: ['widget.form.titleBar', 'titleBar', 'titlebar', '标题栏'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.imageText') },
    aliases: ['widget.form.imageTextShow', 'imageTextShow', 'imagetext', 'image-text', '图文展示'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.tabs') },
    aliases: ['widget.form.multipleTabs', 'multipleTabs', 'tabs', 'tab', 'multitab', 'multiple-tabs', '选项卡'],
  },
  {
    get label() { return i18next.t('nocodeEditorBlueprintWidgetLabel.signature') },
    aliases: ['widget.form.handwrittenSignature', 'handwrittenSignature', 'handwrittensignature', 'signature', '签名', '手写签名'],
  },
]

const BLUEPRINT_WIDGET_TYPE_LABEL_LOOKUP = new Map<string, BlueprintWidgetTypeLabelEntry>(
  BLUEPRINT_WIDGET_TYPE_LABEL_ENTRIES.flatMap(entry => entry.aliases.map(alias => [
    normalizeBlueprintWidgetTypeToken(alias),
    entry,
  ] as const)),
)

export const resolveBlueprintWidgetTypeLabel = (value: unknown) => {
  const normalized = normalizeBlueprintWidgetTypeToken(value)
  if (!normalized) {
    return ''
  }
  return BLUEPRINT_WIDGET_TYPE_LABEL_LOOKUP.get(normalized)?.label || ''
}

export const resolveBlueprintWidgetTypeLabelFromAny = (value: unknown) => {
  const directLabel = resolveBlueprintWidgetTypeLabel(value)
  if (directLabel) {
    return directLabel
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ''
  }

  const record = value as Record<string, unknown>
  const candidates = [
    record.widgetType,
    record.type,
    record.name,
    record.label,
    record.alias,
    record.value,
  ]

  for (const candidate of candidates) {
    const label = resolveBlueprintWidgetTypeLabel(candidate)
    if (label) {
      return label
    }
  }

  return ''
}

export const normalizeBlueprintWidgetTypeLabelToken = normalizeBlueprintWidgetTypeToken
