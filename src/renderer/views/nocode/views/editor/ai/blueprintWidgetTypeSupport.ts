const normalizeWidgetTypeToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s._-]+/g, '')

type AvailableWidgetTypeLike = {
  type?: string
  name?: string
  aliases?: string[]
}

const buildWidgetTypeCandidates = (value: unknown) => {
  const normalized = String(value || '').trim()
  const token = normalizeWidgetTypeToken(normalized)
  const suffix = normalized.split('.').pop() || ''

  return Array.from(new Set([
    normalized,
    suffix,
    token,
    token.replace(/^widgetform/, ''),
    token.replace(/^widget/, ''),
  ].filter(Boolean)))
}

const buildWidgetTypeLookup = (availableWidgetTypes: AvailableWidgetTypeLike[]) => {
  const lookup = new Map<string, string>()

  for (const item of availableWidgetTypes || []) {
    const type = String(item?.type || '').trim()
    if (!type) {
      continue
    }

    const candidates = [
      type,
      item?.name,
      ...(Array.isArray(item?.aliases) ? item.aliases : []),
    ]

    for (const candidate of candidates) {
      const normalized = normalizeWidgetTypeToken(candidate)
      if (normalized && !lookup.has(normalized)) {
        lookup.set(normalized, type)
      }
    }
  }

  return lookup
}

const resolveFamilyFallbacks = (requestedType: string) => {
  const normalized = normalizeWidgetTypeToken(requestedType)
  if (!normalized) {
    return ['widget.form.textInput']
  }

  const exactFallbacks: Array<[RegExp, string[]]> = [
    [/(widgetformtextinput|widgetforminput|textinput|singleline|shorttext|单行|单行文本|文本|输入框|input)/, ['widget.form.textInput']],
    [/(widgetformtextarea|textarea|multiline|longtext|paragraph|多行|多行文本)/, ['widget.form.textarea', 'widget.form.textInput']],
    [/(widgetformnumberinput|numberinput|integer|float|数字)/, ['widget.form.numberInput', 'widget.form.textInput']],
    [/(widgetformamountinput|amountinput|currency|money|price|金额|单价|总价|售价|进价|成本价)/, ['widget.form.amountInput', 'widget.form.numberInput', 'widget.form.textInput']],
    [/(widgetformserialnumber|serialnumber|autoid|编号|编码|单号|单据号|流水号)/, ['widget.form.serialNumber', 'widget.form.textInput']],
    [/(widgetformdatepicker|datepicker|datetime|日期|日期时间)/, ['widget.form.datePicker', 'widget.form.textInput']],
    [/(widgetformdaterangepicker|daterangepicker|daterange|日期范围|时间范围)/, ['widget.form.dateRangePicker', 'widget.form.datePicker', 'widget.form.textInput']],
    [/(widgetformtimepicker|timepicker|时间选择|时分秒)/, ['widget.form.timePicker', 'widget.form.textInput']],
    [/(widgetformradiogroup|radiogroup|radio|singlechoice|单选)/, ['widget.form.radioGroup', 'widget.form.treeSelect', 'widget.form.textInput']],
    [/(widgetformcheckboxgroup|checkboxgroup|checkbox|multichoice|多选)/, ['widget.form.checkboxGroup', 'widget.form.treeMultipleSelect', 'widget.form.treeSelect', 'widget.form.textInput']],
    [/(widgetformtreeselect|treeselect|dropdown|select|relation|reference|lookup|关联|引用|下拉单选)/, ['widget.form.treeSelect', 'widget.form.radioGroup', 'widget.form.textInput']],
    [/(widgetformtreemultipleselect|treemultipleselect|multiselect|multipleselect|下拉多选)/, ['widget.form.treeMultipleSelect', 'widget.form.checkboxGroup', 'widget.form.treeSelect', 'widget.form.textInput']],
    [/(widgetformmemberselect|memberselect|成员|人员|用户选择)/, ['widget.form.memberSelect', 'widget.form.treeSelect', 'widget.form.textInput']],
    [/(widgetformdepartmentselect|departmentselect|deptselect|部门)/, ['widget.form.departmentSelect', 'widget.form.treeSelect', 'widget.form.textInput']],
    [/(widgetformsubform|subform|childtable|childform|子表|子表单|明细|清单|条目)/, ['widget.form.subform', 'widget.form.textInput']],
    [/(widgetformphoneinput|phoneinput|mobile|手机号|电话|联系电话)/, ['widget.form.phoneInput', 'widget.form.textInput']],
    [/(widgetformaddress|address|联系地址|收货地址|发货地址|配送地址|地址)/, ['widget.form.address', 'widget.form.textarea', 'widget.form.textInput']],
    [/(widgetformrate|rate|rating|评分|打分)/, ['widget.form.rate', 'widget.form.numberInput', 'widget.form.textInput']],
    [/(widgetformposition|position|location|定位|位置)/, ['widget.form.position', 'widget.form.address', 'widget.form.textInput']],
    [/(widgetformtaginput|taginput|tags|标签)/, ['widget.form.tagInput', 'widget.form.textInput']],
    [/(widgetformrichtexteditor|richtexteditor|richtext|富文本)/, ['widget.form.richTextEditor', 'widget.form.textarea', 'widget.form.textInput']],
    [/(widgetformimageuploader|widgetformimageuploader|imageuploader|imageupload|上传图片|图片上传|图片)/, ['widget.form.image-uploader', 'widget.form.file-uploader', 'widget.form.textInput']],
    [/(widgetformfileuploader|fileuploader|fileupload|attachment|上传附件|附件上传|附件)/, ['widget.form.file-uploader', 'widget.form.textInput']],
    [/(widgetformswitch|switch|toggle|布尔|开关)/, ['widget.form.switch', 'widget.form.radioGroup', 'widget.form.textInput']],
    [/(widgetformsearchform|searchform|查询表单)/, ['widget.form.searchForm', 'widget.form.treeSelect', 'widget.form.textInput']],
    [/(widgetformhyperlink|hyperlink|url|link|超链接)/, ['widget.form.hyperlink', 'widget.form.textInput']],
    [/(widgetformautocompute|autocompute|formula|calc|compute|自动计算|实时计算|公式)/, ['widget.form.autoCompute', 'widget.form.numberInput', 'widget.form.textInput']],
    [/(widgetformhandwrittensignature|handwrittensignature|signature|签名|手写签名)/, ['widget.form.handwrittenSignature', 'widget.form.image-uploader', 'widget.form.file-uploader', 'widget.form.textInput']],
    [/(widgetformselectdata|selectdata|选择数据)/, ['widget.form.selectData', 'widget.form.treeSelect', 'widget.form.textInput']],
    [/(widgetformrelateddata|relateddata|关联数据|关联记录)/, ['widget.form.relatedData', 'widget.form.treeSelect', 'widget.form.textInput']],
    [/(widgetformtitlebar|titlebar|标题栏)/, ['widget.form.titleBar', 'widget.form.textInput']],
    [/(widgetformimagetextshow|imagetextshow|imagetext|图文展示)/, ['widget.form.imageTextShow', 'widget.form.richTextEditor', 'widget.form.textarea', 'widget.form.textInput']],
    [/(widgetformmultipletabs|multipletabs|tabs|tab|选项卡|多标签页)/, ['widget.form.multipleTabs', 'widget.form.titleBar', 'widget.form.textInput']],
  ]

  for (const [matcher, fallbacks] of exactFallbacks) {
    if (matcher.test(normalized)) {
      return fallbacks
    }
  }

  if (/(subform|childtable|childform|明细|清单|条目)/.test(normalized)) {
    return ['widget.form.subform', 'widget.form.textInput']
  }
  if (/(amount|currency|money|price|金额)/.test(normalized)) {
    return ['widget.form.amountInput', 'widget.form.numberInput', 'widget.form.textInput']
  }
  if (/(serial|autoid|serialnumber|编号|编码|单号|流水号)/.test(normalized)) {
    return ['widget.form.serialNumber', 'widget.form.textInput']
  }
  if (/(address|地址)/.test(normalized)) {
    return ['widget.form.address', 'widget.form.textarea', 'widget.form.textInput']
  }
  if (/(phone|mobile|手机号|电话)/.test(normalized)) {
    return ['widget.form.phoneInput', 'widget.form.textInput']
  }
  if (/(date|datetime|日期|时间)/.test(normalized)) {
    return ['widget.form.datePicker', 'widget.form.textInput']
  }
  if (/(radio|singlechoice|单选)/.test(normalized)) {
    return ['widget.form.radioGroup', 'widget.form.treeSelect', 'widget.form.textInput']
  }
  if (/(checkbox|multichoice|多选|multiselect|multiple)/.test(normalized)) {
    return ['widget.form.checkboxGroup', 'widget.form.treeMultipleSelect', 'widget.form.treeSelect', 'widget.form.textInput']
  }
  if (/(treeselect|select|dropdown|relation|reference|lookup|关联|引用)/.test(normalized)) {
    return ['widget.form.treeSelect', 'widget.form.radioGroup', 'widget.form.textInput']
  }
  if (/(textarea|multiline|longtext|多行)/.test(normalized)) {
    return ['widget.form.textarea', 'widget.form.textInput']
  }
  if (/(number|integer|float|数字)/.test(normalized)) {
    return ['widget.form.numberInput', 'widget.form.textInput']
  }

  return ['widget.form.textInput']
}

export const resolveSupportedBlueprintWidgetType = (options: {
  requestedType?: string
  availableWidgetTypes?: AvailableWidgetTypeLike[]
}) => {
  const availableWidgetTypes = Array.isArray(options.availableWidgetTypes)
    ? options.availableWidgetTypes
    : []
  const requestedType = String(options.requestedType || '').trim()
  const lookup = buildWidgetTypeLookup(availableWidgetTypes)

  for (const candidate of buildWidgetTypeCandidates(requestedType)) {
    const normalized = normalizeWidgetTypeToken(candidate)
    if (!normalized) {
      continue
    }
    const matched = lookup.get(normalized)
    if (matched) {
      return {
        widgetType: matched,
        fallback: false,
      }
    }
  }

  for (const fallbackCandidate of resolveFamilyFallbacks(requestedType)) {
    const normalized = normalizeWidgetTypeToken(fallbackCandidate)
    const matched = lookup.get(normalized)
    if (matched) {
      return {
        widgetType: matched,
        fallback: true,
      }
    }
  }

  const firstAvailable = availableWidgetTypes.find(item => String(item?.type || '').trim())
  if (firstAvailable?.type) {
    return {
      widgetType: String(firstAvailable.type).trim(),
      fallback: true,
    }
  }

  return {
    widgetType: requestedType,
    fallback: false,
  }
}
