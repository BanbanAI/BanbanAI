import type {
  NocodeEditorBlueprintPlanningCarryover,
  NocodeEditorBlueprintPlanningFieldStrategyHint,
} from './nocodeEditorBlueprintPlanningCarryover'

export type BlueprintFieldIntent =
  | 'member-identity'
  | 'department-identity'
  | 'relation-person'
  | 'relation-master-data'
  | 'free-text-name'
  | 'ambiguous-person'
  | 'ambiguous-relation'
  | 'generic'

export type BlueprintFieldIntentCapabilityFamily =
  | 'organization-identity'
  | 'master-data-relation'
  | 'boolean-state'
  | 'collection-shape'
  | 'time-granularity'
  | 'media-evidence'
  | 'generic'

export type BlueprintFieldIntentInput = {
  formName: string
  fieldName: string
  explicitWidgetType?: string
  description?: string
  notes?: string[]
  hasSource: boolean
  canResolveRelationSource: boolean
  hasChildren: boolean
  enumOptionsCount: number
  planningCarryover?: NocodeEditorBlueprintPlanningCarryover | null
}

export type BlueprintFieldIntentSignals = {
  formName: string
  fieldName: string
  description: string
  notes: string[]
  explicitWidgetType: string
  hasSource: boolean
  canResolveRelationSource: boolean
  enumOptionsCount: number
  hasChildren: boolean
  planningCarryoverFieldStrategyHints: NocodeEditorBlueprintPlanningFieldStrategyHint[]
}

export type BlueprintFieldIntentDecision = {
  intent: BlueprintFieldIntent
  capabilityFamily: BlueprintFieldIntentCapabilityFamily
  widgetType?: string
  trustedExplicitWidgetType?: string
  confidence: 'high' | 'medium' | 'low'
  requiresClarification: boolean
  clarificationQuestion?: string
  matchedSignals: string[]
}

type BlueprintFieldIntentResolverContext = {
  signals: BlueprintFieldIntentSignals
  semanticText: string
}

type BlueprintFieldIntentResolver = (
  context: BlueprintFieldIntentResolverContext,
) => BlueprintFieldIntentDecision | undefined

const DIRECT_MEMBER_KEYWORDS = ['申请人', '发起人', '填报人', '提交人', '提报人', '报销人', '处理人', '办理人', '协助人', '参与人']
const DIRECT_DEPARTMENT_KEYWORDS = ['申请部门', '所属部门', '归属部门', '审批部门', '负责部门']
const AMBIGUOUS_DEPARTMENT_KEYWORDS = ['部门负责人']
const DIRECT_RELATION_PERSON_KEYWORDS = ['客户联系人', '供应商联系人', '讲师', '医生', '顾问', '学员', '学生', '家长']
const AMBIGUOUS_PERSON_KEYWORDS = ['负责人', '经办人', '对接人', '审批人', '审核人', '联系人', '跟进人', '接待人', '介绍人']
const MASTER_DATA_RELATION_KEYWORDS = ['客户', '供应商', '仓库', '门店', '店铺', '班级', '课程', '项目', '合同', '物料', '商品']
const INTERNAL_WORKFLOW_CONTEXT = ['申请', '审批', '报销', '请假', '出差', '付款', '打款', '工单', '派单', '转办', '办理', '提交']
const RELATION_PERSON_TOKENS = ['联系人', '联络人', '对接人', '接口人']
const EXTERNAL_RELATION_PREFIX_TOKENS = ['客户', '供应商', '外部', '合作方', '渠道']
const PERSON_ATTRIBUTE_SUFFIX_PATTERNS = /(职位|职务|岗位|头衔)$/i
const EXTERNAL_RELATION_PERSON_TEXT_PATTERNS = /(外部|客户|供应商|合作方|渠道).*(联系人|联络人|对接人|接口人).*(姓名|名字|称呼)?/

const EXPLICIT_RELATION_BINDING_VERBS = [
  '关联',
  '绑定',
  '引用',
  '来自',
  '来源',
  '选择',
  '选取',
  '从',
  'choose',
  'select',
  'pick',
  'bind',
  'link',
  'relate',
  'from',
]

const EXPLICIT_RELATION_BINDING_ACTION_VERBS = EXPLICIT_RELATION_BINDING_VERBS.filter(verb => (
  verb !== '来源'
  && verb !== 'choose'
  && verb !== 'select'
  && verb !== 'pick'
))

const EXPLICIT_RELATION_BINDING_WEAK_ACTION_VERBS = [
  'choose',
  'select',
  'pick',
]

const EXPLICIT_RELATION_BINDING_TARGETS = [
  '表',
  '表单',
  '列表',
  '主数据',
  'source',
  'table',
  'form',
  'archive',
  'record',
  'lookup',
]

const EXPLICIT_RELATION_BINDING_WEAK_TARGETS = [
  '档案',
  '信息',
  '资料',
]

const EXPLICIT_RELATION_BINDING_STRONG_TARGETS = [
  '表',
  '表单',
  '列表',
  '主数据',
  'table',
  'form',
  'archive',
  'record',
  'lookup',
  'relation',
]

const EXPLICIT_RELATION_BINDING_NON_RELATION_STRONG_TARGETS = EXPLICIT_RELATION_BINDING_STRONG_TARGETS.filter(target => (
  target !== 'relation'
))

const ENUM_BUSINESS_ATTRIBUTE_WIDGET_TYPES = new Set([
  'widget.form.radioGroup',
  'widget.form.checkboxGroup',
  'widget.form.singleSelect',
])

const ENUM_BUSINESS_ATTRIBUTE_KEYWORDS = [
  '意向等级',
  '等级',
  '状态',
  '阶段',
  '类型',
  '分类',
  '来源',
  '渠道',
  '优先级',
  '满意度',
]

const EXPLICIT_RELATION_BINDING_PHRASES = [
  '关联表',
  '关联表单',
  '绑定表',
  '绑定表单',
  '引用表',
  '引用表单',
  '来自表',
  '来自表单',
  '选择表',
  '选择表单',
  '选取表',
  '选取表单',
  '主数据',
  'lookup',
]

const RELATION_DOMAIN_ALIAS_MAP: Record<string, string[]> = {
  customer: ['客户', 'customer', 'client'],
  supplier: ['供应商', 'supplier', 'vendor'],
  warehouse: ['仓库', 'warehouse'],
  store: ['门店', '店铺', 'store', 'shop'],
  class: ['班级', 'class'],
  course: ['课程', 'course'],
  project: ['项目', 'project'],
  contract: ['合同', 'contract'],
  material: ['物料', 'material'],
  product: ['商品', 'product', 'goods', 'item'],
}

const BOOLEAN_STATE_PATTERNS = [
  /^(?:is|whether)[a-z]/i,
  /是否(?:启用|加急|通过|公开|默认|可见|允许)/,
]

const BOOLEAN_RADIO_PATTERNS = [
  /是否通过/,
  /(是|否)[/／](?:否|是)/,
  /通过[/／]不通过/,
]

const COLLECTION_SHAPE_PATTERNS = [
  /标签/,
  /技能/,
  /角色/,
  /适用范围/,
  /参与角色/,
  /覆盖区域/,
  /适用品类/,
]

const TIME_RANGE_PATTERNS = [
  /(时间范围|日期范围|起止时间|起止日期|开始至结束|开始时间到结束时间|开始日期到结束日期)/,
]

const TIME_ONLY_PATTERNS = [
  /(上课时间|营业时间|时间段|时分秒|钟点|几点|上班时间|下班时间|班次时间)/,
]

const TIME_POINT_PATTERNS = [
  /(截止时间|截止日期|开始时间|结束时间|开始日期|结束日期|预约时间|发生时间|提交时间|创建时间|生效日期|失效日期|到期日期|到期时间|签到时间|签退时间|入职日期|出生日期|交付日期|交货日期)/,
]

const AMBIGUOUS_TIME_PATTERNS = [
  /^(时间|日期|日期时间|时刻)$/,
]

const IMAGE_PATTERNS = [
  /(现场照片|图片|截图|头像|封面|证件照|照片)/,
]

const FILE_PATTERNS = [
  /(合同附件|报销凭证|证明材料|上传文件|文件附件|资料附件|证件材料|审批附件|附件材料)/,
  /^.+附件$/,
]

const AMBIGUOUS_ATTACHMENT_PATTERNS = [
  /^(附件|上传附件)$/,
]

const normalizeIntentToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

const createDecision = (
  decision: BlueprintFieldIntentDecision,
): BlueprintFieldIntentDecision => decision

export const resolveBlueprintExplicitWidgetType = (value: unknown) => {
  const rawWidgetType = String(value || '').trim()
  if (!rawWidgetType) return ''

  const widgetFormMatch = /^widget\.form\.(.+)$/i.exec(rawWidgetType)
  const normalized = normalizeIntentToken(widgetFormMatch?.[1] || rawWidgetType)
  if (!normalized) return ''

  if (/(memberselect|userselect|userpicker|member|user)/.test(normalized)) {
    return 'widget.form.memberSelect'
  }
  if (/(departmentselect|deptselect|department|dept)/.test(normalized)) {
    return 'widget.form.departmentSelect'
  }
  if (/(subform|childtable|childform)/.test(normalized)) {
    return 'widget.form.subform'
  }
  if (/(switch|toggle|boolean|bool)/.test(normalized)) {
    return 'widget.form.switch'
  }
  if (/(handwrittensignature|signature|handsign)/.test(normalized)) {
    return 'widget.form.handwrittenSignature'
  }
  if (/(treemultipleselect|multiselect|multichoice|checkboxgroup)/.test(normalized)) {
    return normalized.includes('checkbox') ? 'widget.form.checkboxGroup' : 'widget.form.treeMultipleSelect'
  }
  if (/(daterangepicker|daterange)/.test(normalized)) {
    return 'widget.form.dateRangePicker'
  }
  if (/timepicker/.test(normalized)) {
    return 'widget.form.timePicker'
  }
  if (/(treeselect|relation|reference|lookup|related)/.test(normalized)) {
    return 'widget.form.treeSelect'
  }
  if (/(singleselect|dropdown|select)/.test(normalized)) {
    return 'widget.form.singleSelect'
  }
  if (/(radiogroup|radio)/.test(normalized)) {
    return 'widget.form.radioGroup'
  }
  if (/(textarea|multiline|longtext|paragraph)/.test(normalized)) {
    return 'widget.form.textarea'
  }
  if (/(amount|currency|money|price)/.test(normalized)) {
    return 'widget.form.amountInput'
  }
  if (/(serial|autoid|serialnumber)/.test(normalized)) {
    return 'widget.form.serialNumber'
  }
  if (/address/.test(normalized)) {
    return 'widget.form.address'
  }
  if (/(imageuploader|imageupload)/.test(normalized)) {
    return 'widget.form.image-uploader'
  }
  if (/(fileuploader|fileupload|attachment)/.test(normalized)) {
    return 'widget.form.file-uploader'
  }
  if (/(phone|mobile|telephone)/.test(normalized)) {
    return 'widget.form.phoneInput'
  }
  if (/(date|datetime|time)/.test(normalized)) {
    return 'widget.form.datePicker'
  }
  if (/(number|integer|float)/.test(normalized)) {
    return 'widget.form.numberInput'
  }
  if (/(text|string|input)/.test(normalized)) {
    return 'widget.form.textInput'
  }

  return rawWidgetType
}

export const buildBlueprintFieldIntentSignals = (
  input: BlueprintFieldIntentInput,
): BlueprintFieldIntentSignals => ({
  formName: String(input.formName || '').trim(),
  fieldName: String(input.fieldName || '').trim(),
  description: String(input.description || '').trim(),
  notes: Array.isArray(input.notes)
    ? input.notes.map(item => String(item || '').trim()).filter(Boolean)
    : [],
  explicitWidgetType: resolveBlueprintExplicitWidgetType(input.explicitWidgetType),
  hasSource: Boolean(input.hasSource),
  canResolveRelationSource: Boolean(input.canResolveRelationSource),
  enumOptionsCount: Number.isFinite(input.enumOptionsCount) ? Math.max(0, input.enumOptionsCount) : 0,
  hasChildren: Boolean(input.hasChildren),
  planningCarryoverFieldStrategyHints: Array.isArray(input.planningCarryover?.fieldStrategyHints)
    ? input.planningCarryover!.fieldStrategyHints
    : [],
})

const includesAny = (text: string, keywords: string[]) => keywords.some(keyword => text.includes(keyword))

const findKeyword = (text: string, keywords: string[]) => keywords.find(keyword => text.includes(keyword))

const findFieldTailKeyword = (text: string, keywords: string[]) => {
  const fieldName = String(text || '').trim()
  return keywords.find(keyword => fieldName === keyword || fieldName.endsWith(keyword))
}

const hasRelationPersonToken = (text: string) => (
  RELATION_PERSON_TOKENS.some(token => text.includes(token))
)

const isRelationPersonAttributeField = (fieldName: string) => (
  hasRelationPersonToken(fieldName)
  && PERSON_ATTRIBUTE_SUFFIX_PATTERNS.test(fieldName)
)

const hasExternalRelationPersonContext = (semanticText: string) => (
  EXTERNAL_RELATION_PERSON_TEXT_PATTERNS.test(semanticText)
)

const isExternalRelationPersonTextField = (fieldName: string, semanticText: string) => {
  const hasExternalPrefix = EXTERNAL_RELATION_PREFIX_TOKENS.some(token => fieldName.includes(token))
  return hasRelationPersonToken(fieldName) && (
    hasExternalPrefix
    || hasExternalRelationPersonContext(semanticText)
  )
}

const findAmbiguousPersonKeyword = (fieldName: string) => {
  if (isRelationPersonAttributeField(fieldName)) {
    return undefined
  }
  return AMBIGUOUS_PERSON_KEYWORDS.find(keyword => (
    fieldName === keyword || fieldName.endsWith(keyword)
  ))
}

const matchesAnyPattern = (text: string, patterns: RegExp[]) => patterns.some(pattern => pattern.test(text))

const hasEnglishToken = (text: string, token: string) => {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escapedToken}([^a-z0-9]|$)`, 'i').test(text)
}

const hasRelationBindingTerm = (
  semanticText: string,
  normalizedText: string,
  term: string,
) => {
  const rawTerm = String(term || '').trim()
  if (!rawTerm) {
    return false
  }
  if (/^[a-z0-9]+$/i.test(rawTerm)) {
    return hasEnglishToken(semanticText, rawTerm)
  }
  return normalizedText.includes(normalizeIntentToken(rawTerm))
}

const hasAnyRelationBindingTerm = (
  semanticText: string,
  normalizedText: string,
  terms: string[],
) => terms.some(term => hasRelationBindingTerm(semanticText, normalizedText, term))

const hasEnumBusinessAttributeKeyword = (fieldName: string) => (
  ENUM_BUSINESS_ATTRIBUTE_KEYWORDS.some(keyword => (
    fieldName === keyword
    || fieldName.endsWith(keyword)
    || fieldName.includes(keyword)
  ))
)

const hasExplicitRelationBindingPhrase = (semanticText: string) => {
  const normalizedText = normalizeIntentToken(semanticText)
  if (!normalizedText) {
    return false
  }
  if (hasAnyRelationBindingTerm(semanticText, normalizedText, EXPLICIT_RELATION_BINDING_PHRASES)) {
    return true
  }

  const hasVerb = hasAnyRelationBindingTerm(semanticText, normalizedText, EXPLICIT_RELATION_BINDING_ACTION_VERBS)
  const hasTarget = hasAnyRelationBindingTerm(semanticText, normalizedText, EXPLICIT_RELATION_BINDING_TARGETS)
  const hasStrongTarget = hasAnyRelationBindingTerm(semanticText, normalizedText, EXPLICIT_RELATION_BINDING_STRONG_TARGETS)
  const hasWeakTarget = hasAnyRelationBindingTerm(semanticText, normalizedText, EXPLICIT_RELATION_BINDING_WEAK_TARGETS)
  const hasNonRelationStrongTarget = hasAnyRelationBindingTerm(
    semanticText,
    normalizedText,
    EXPLICIT_RELATION_BINDING_NON_RELATION_STRONG_TARGETS,
  )
  const hasWeakActionVerb = hasAnyRelationBindingTerm(semanticText, normalizedText, EXPLICIT_RELATION_BINDING_WEAK_ACTION_VERBS)
  const hasRelationTarget = hasEnglishToken(semanticText, 'relation')
  const hasDomain = MASTER_DATA_RELATION_KEYWORDS.some(token => normalizedText.includes(normalizeIntentToken(token)))
  return hasDomain && (
    hasVerb && hasTarget
    || hasWeakActionVerb && hasStrongTarget
    || hasRelationTarget && hasNonRelationStrongTarget
    || hasWeakTarget && hasNonRelationStrongTarget
  )
}

const isContactMethodField = (fieldName: string, semanticText: string) => (
  /(电话|手机号|手机|联系方式|联系邮箱|邮箱|email|联系地址|地址)/i.test(fieldName)
  || /(联系电话|联系人电话|手机号|手机|邮箱|email|联系地址)/i.test(semanticText)
)

const hasManualTextEntrySignal = (semanticText: string) => (
  /(手动|手工|直接)(填写|输入)|自由文本|文本输入|输入文本|手动填写|手动输入/.test(semanticText)
)

const buildClarificationQuestion = (keyword: string) => {
  if (/审批人|审核人/.test(keyword)) {
    return `“${keyword}”需要作为流程节点自动选人，还是只是表单展示字段？`
  }
  if (/部门负责人/.test(keyword)) {
    return `“${keyword}”是要选择一个部门，还是选择该部门对应的负责人成员？`
  }
  if (/负责人/.test(keyword)) {
    return `“${keyword}”是组织内成员，还是业务档案中的负责人？`
  }
  if (/经办人/.test(keyword)) {
    return `“${keyword}”需要作为内部成员参与流程/通知，还是仅记录业务经办姓名？`
  }
  if (/联系人/.test(keyword)) {
    return `“${keyword}”是组织成员，还是客户/供应商/外部联系人？`
  }
  return `这里的“${keyword}”是组织内成员，还是业务档案中的人员？`
}

const buildMasterDataClarificationQuestion = (keyword: string) => `“${keyword}”这类字段通常来自其他表单数据。请确认它要关联哪个表单、显示哪个字段？`

const buildCollectionClarificationQuestion = (fieldName: string) => `“${fieldName}”是一个多选集合字段。如这些选项来自其他表单，请确认 source；如果是自定义选项，请明确需要哪些值。`

const buildTimeClarificationQuestion = (fieldName: string) => `“${fieldName}”需要记录单个时间点、时间范围，还是仅记录时分秒？`

const buildAttachmentClarificationQuestion = (fieldName: string) => `“${fieldName}”更适合上传图片证据，还是通用文件附件？`

const genericFallbackDecision = (): BlueprintFieldIntentDecision => createDecision({
  intent: 'generic',
  capabilityFamily: 'generic',
  confidence: 'low',
  requiresClarification: false,
  matchedSignals: [],
})

const buildRelationSemanticText = (signals: BlueprintFieldIntentSignals) => [
  signals.fieldName,
  signals.description,
  ...signals.notes,
].join(' ')

const resolveRelationDomainAliases = (domain: string) => {
  const normalizedDomain = normalizeIntentToken(domain)
  if (!normalizedDomain) {
    return []
  }

  for (const [domainKey, aliases] of Object.entries(RELATION_DOMAIN_ALIAS_MAP)) {
    const normalizedDomainKey = normalizeIntentToken(domainKey)
    if (
      normalizedDomainKey === normalizedDomain
      || aliases.some(alias => normalizeIntentToken(alias) === normalizedDomain)
    ) {
      return Array.from(new Set([domainKey, ...aliases]))
    }
  }

  return [domain]
}

const resolveMasterDataRelationDomain = (text: string) => {
  const normalizedText = normalizeIntentToken(text)
  if (!normalizedText) {
    return ''
  }

  for (const keyword of MASTER_DATA_RELATION_KEYWORDS) {
    if (normalizedText.includes(normalizeIntentToken(keyword))) {
      const matchedDomain = Object.entries(RELATION_DOMAIN_ALIAS_MAP).find(([, aliases]) => (
        aliases.some(alias => normalizeIntentToken(alias) === normalizeIntentToken(keyword))
      ))
      return matchedDomain?.[0] || normalizeIntentToken(keyword)
    }
  }

  for (const [domain, aliases] of Object.entries(RELATION_DOMAIN_ALIAS_MAP)) {
    if (aliases.some(alias => normalizedText.includes(normalizeIntentToken(alias)))) {
      return domain
    }
  }

  return ''
}

const hasExplicitRelationBindingRequest = (
  signals: BlueprintFieldIntentSignals,
  semanticText: string,
  hint: NocodeEditorBlueprintPlanningFieldStrategyHint,
) => {
  if (
    signals.explicitWidgetType === 'widget.form.treeSelect'
    || signals.explicitWidgetType === 'widget.form.treeMultipleSelect'
  ) {
    return true
  }

  const normalizedText = normalizeIntentToken(semanticText)
  const aliases = resolveRelationDomainAliases(hint.relationDomain)
  const hasAlias = aliases.some(alias => normalizedText.includes(normalizeIntentToken(alias)))
  const hasVerb = EXPLICIT_RELATION_BINDING_VERBS.some(token => normalizedText.includes(normalizeIntentToken(token)))
  const hasTarget = EXPLICIT_RELATION_BINDING_TARGETS.some(token => normalizedText.includes(normalizeIntentToken(token)))

  return hasAlias && hasVerb && hasTarget
}

const resolvePlanningTextFirstStrategyHint = (
  signals: BlueprintFieldIntentSignals,
  semanticText: string,
  relationDomain: string,
) => {
  if (!relationDomain || signals.hasSource || signals.canResolveRelationSource || signals.hasChildren) {
    return null
  }

  const normalizedRelationAliases = resolveRelationDomainAliases(relationDomain)
    .map(alias => normalizeIntentToken(alias))
    .filter(Boolean)

  for (const hint of signals.planningCarryoverFieldStrategyHints) {
    if (
      hint.strategyKey !== 'text-first'
      || hint.suppressSourceClarification !== true
      || hint.deferSourceBinding !== true
      || hint.keepWidgetType !== 'widget.form.textInput'
    ) {
      continue
    }

    const hintAliases = resolveRelationDomainAliases(hint.relationDomain)
      .map(alias => normalizeIntentToken(alias))
      .filter(Boolean)
    const sameRelationDomain = hintAliases.some(alias => normalizedRelationAliases.includes(alias))
    if (!sameRelationDomain) {
      continue
    }

    if (hasExplicitRelationBindingRequest(signals, semanticText, hint)) {
      continue
    }

    return hint
  }

  return null
}

const createPlanningTextFirstDecision = (
  signals: BlueprintFieldIntentSignals,
  hint: NocodeEditorBlueprintPlanningFieldStrategyHint,
): BlueprintFieldIntentDecision => createDecision({
  intent: 'free-text-name',
  capabilityFamily: 'generic',
  widgetType: hint.keepWidgetType,
  trustedExplicitWidgetType: signals.explicitWidgetType === hint.keepWidgetType
    ? hint.keepWidgetType
    : undefined,
  confidence: 'high',
  requiresClarification: false,
  matchedSignals: [
    `planning-carryover:${hint.strategyKey}`,
    `planning-question:${hint.sourceQuestionId}`,
  ],
})

const earlyGenericResolver: BlueprintFieldIntentResolver = ({ signals, semanticText }) => {
  if (
    !signals.fieldName
    || signals.hasChildren
    || isContactMethodField(signals.fieldName, semanticText)
  ) {
    return genericFallbackDecision()
  }
  return undefined
}

const organizationIdentityResolvers: BlueprintFieldIntentResolver[] = [
  ({ signals }) => {
    const directDepartmentKeyword = findKeyword(signals.fieldName, DIRECT_DEPARTMENT_KEYWORDS)
    if (!directDepartmentKeyword) return undefined
    return createDecision({
      intent: 'department-identity',
      capabilityFamily: 'organization-identity',
      widgetType: 'widget.form.departmentSelect',
      confidence: 'high',
      requiresClarification: false,
      matchedSignals: [`direct-department:${directDepartmentKeyword}`],
    })
  },
  ({ signals }) => {
    if (signals.explicitWidgetType !== 'widget.form.departmentSelect') return undefined
    return createDecision({
      intent: 'department-identity',
      capabilityFamily: 'organization-identity',
      widgetType: 'widget.form.departmentSelect',
      confidence: 'high',
      requiresClarification: false,
      matchedSignals: ['explicit-widget:department-select'],
    })
  },
  ({ signals }) => {
    const ambiguousDepartmentKeyword = findKeyword(signals.fieldName, AMBIGUOUS_DEPARTMENT_KEYWORDS)
    if (!ambiguousDepartmentKeyword) return undefined
    return createDecision({
      intent: 'ambiguous-relation',
      capabilityFamily: 'organization-identity',
      confidence: 'low',
      requiresClarification: true,
      clarificationQuestion: buildClarificationQuestion(ambiguousDepartmentKeyword),
      matchedSignals: [`ambiguous-department:${ambiguousDepartmentKeyword}`],
    })
  },
]

const personResolvers: BlueprintFieldIntentResolver[] = [
  ({ signals }) => {
    const directMemberKeyword = findKeyword(signals.fieldName, DIRECT_MEMBER_KEYWORDS)
    if (!directMemberKeyword) return undefined
    return createDecision({
      intent: 'member-identity',
      capabilityFamily: 'organization-identity',
      widgetType: 'widget.form.memberSelect',
      confidence: 'high',
      requiresClarification: false,
      matchedSignals: [`direct-member:${directMemberKeyword}`],
    })
  },
  ({ signals }) => {
    if (signals.explicitWidgetType !== 'widget.form.memberSelect') return undefined
    return createDecision({
      intent: 'member-identity',
      capabilityFamily: 'organization-identity',
      widgetType: 'widget.form.memberSelect',
      confidence: 'high',
      requiresClarification: false,
      matchedSignals: ['explicit-widget:member-select'],
    })
  },
  ({ signals }) => {
    if (signals.explicitWidgetType !== 'widget.form.treeSelect') return undefined
    const masterDataDomain = resolveMasterDataRelationDomain(buildRelationSemanticText(signals))
    if (masterDataDomain && !signals.hasSource && !signals.canResolveRelationSource) {
      return undefined
    }
    return createDecision({
      intent: 'relation-person',
      capabilityFamily: 'master-data-relation',
      widgetType: 'widget.form.treeSelect',
      confidence: 'high',
      requiresClarification: false,
      matchedSignals: ['explicit-widget:tree-select'],
    })
  },
  ({ signals, semanticText }) => {
    if (includesAny(semanticText, INTERNAL_WORKFLOW_CONTEXT)) {
      return undefined
    }
    if (signals.explicitWidgetType === 'widget.form.treeSelect') {
      return undefined
    }
    if (!/(姓名|名字|称呼)/.test(signals.fieldName)) {
      return undefined
    }
    return createDecision({
      intent: 'free-text-name',
      capabilityFamily: 'generic',
      widgetType: 'widget.form.textInput',
      confidence: 'high',
      requiresClarification: false,
      matchedSignals: ['free-text-name'],
    })
  },
  ({ signals, semanticText }) => {
    if (includesAny(semanticText, INTERNAL_WORKFLOW_CONTEXT)) {
      return undefined
    }
    if (signals.explicitWidgetType === 'widget.form.treeSelect') {
      return undefined
    }
    if (!/(名称)$/.test(signals.fieldName) || !hasManualTextEntrySignal(semanticText)) {
      return undefined
    }
    return createDecision({
      intent: 'free-text-name',
      capabilityFamily: 'generic',
      widgetType: 'widget.form.textInput',
      confidence: 'high',
      requiresClarification: false,
      matchedSignals: ['free-text-name', 'manual-text-entry'],
    })
  },
  ({ signals, semanticText }) => {
    if (
      signals.explicitWidgetType !== 'widget.form.textInput'
      || signals.hasSource
      || signals.canResolveRelationSource
    ) {
      return undefined
    }
    const isRelationAttribute = isRelationPersonAttributeField(signals.fieldName)
    const isExternalRelationText = isExternalRelationPersonTextField(signals.fieldName, semanticText)
    if (!isRelationAttribute && !isExternalRelationText) {
      return undefined
    }
    return createDecision({
      intent: 'generic',
      capabilityFamily: 'generic',
      widgetType: 'widget.form.textInput',
      trustedExplicitWidgetType: 'widget.form.textInput',
      confidence: 'high',
      requiresClarification: false,
      matchedSignals: [
        isRelationAttribute ? 'relation-person-attribute' : 'external-relation-person-text',
        'explicit-widget:text-input',
      ],
    })
  },
  ({ signals }) => {
    const directRelationKeyword = findFieldTailKeyword(signals.fieldName, DIRECT_RELATION_PERSON_KEYWORDS)
    if (!directRelationKeyword) return undefined
    if (signals.hasSource || signals.canResolveRelationSource) {
      return createDecision({
        intent: 'relation-person',
        capabilityFamily: 'master-data-relation',
        widgetType: 'widget.form.treeSelect',
        confidence: 'high',
        requiresClarification: false,
        matchedSignals: [`direct-relation-person:${directRelationKeyword}`, 'source'],
      })
    }
    return createDecision({
      intent: 'ambiguous-person',
      capabilityFamily: 'organization-identity',
      confidence: 'low',
      requiresClarification: true,
      clarificationQuestion: buildClarificationQuestion(directRelationKeyword),
      matchedSignals: [`ambiguous-relation:${directRelationKeyword}`],
    })
  },
  ({ signals }) => {
    const ambiguousKeyword = findAmbiguousPersonKeyword(signals.fieldName)
    if (!ambiguousKeyword) return undefined
    return createDecision({
      intent: 'ambiguous-person',
      capabilityFamily: 'organization-identity',
      confidence: 'low',
      requiresClarification: true,
      clarificationQuestion: buildClarificationQuestion(ambiguousKeyword),
      matchedSignals: [`ambiguous-keyword:${ambiguousKeyword}`],
    })
  },
  ({ signals, semanticText }) => {
    if (!includesAny(semanticText, INTERNAL_WORKFLOW_CONTEXT) || !/(\S+人)$/.test(signals.fieldName)) {
      return undefined
    }
    return createDecision({
      intent: 'member-identity',
      capabilityFamily: 'organization-identity',
      widgetType: 'widget.form.memberSelect',
      confidence: 'medium',
      requiresClarification: false,
      matchedSignals: ['workflow-context'],
    })
  },
]

const masterDataRelationResolvers: BlueprintFieldIntentResolver[] = [
  ({ signals }) => {
    const relationSemanticText = buildRelationSemanticText(signals)
    const masterDataDomain = resolveMasterDataRelationDomain(relationSemanticText)
    if (!masterDataDomain) {
      return undefined
    }

    if (signals.hasSource || signals.canResolveRelationSource) {
      return createDecision({
        intent: 'relation-master-data',
        capabilityFamily: 'master-data-relation',
        widgetType: 'widget.form.treeSelect',
        confidence: 'high',
        requiresClarification: false,
        matchedSignals: [`master-data:${masterDataDomain}`, 'source'],
      })
    }

    const planningTextFirstHint = resolvePlanningTextFirstStrategyHint(
      signals,
      relationSemanticText,
      masterDataDomain,
    )
    if (planningTextFirstHint) {
      return createPlanningTextFirstDecision(signals, planningTextFirstHint)
    }

    return createDecision({
      intent: 'ambiguous-relation',
      capabilityFamily: 'master-data-relation',
      confidence: 'medium',
      requiresClarification: true,
      clarificationQuestion: buildMasterDataClarificationQuestion(signals.fieldName),
      matchedSignals: [`master-data:${masterDataDomain}`, 'missing-source'],
    })
  },
]

const booleanStateResolvers: BlueprintFieldIntentResolver[] = [
  ({ signals, semanticText }) => {
    const fullText = `${signals.fieldName} ${semanticText}`.trim()
    if (!matchesAnyPattern(fullText, BOOLEAN_STATE_PATTERNS)) {
      return undefined
    }
    const shouldUseRadio = signals.enumOptionsCount > 0 || matchesAnyPattern(fullText, BOOLEAN_RADIO_PATTERNS)
    return createDecision({
      intent: 'generic',
      capabilityFamily: 'boolean-state',
      widgetType: shouldUseRadio ? 'widget.form.radioGroup' : 'widget.form.switch',
      confidence: shouldUseRadio ? 'medium' : 'high',
      requiresClarification: false,
      matchedSignals: [shouldUseRadio ? 'boolean-radio' : 'boolean-switch'],
    })
  },
]

const collectionShapeResolvers: BlueprintFieldIntentResolver[] = [
  ({ signals, semanticText }) => {
    const fullText = `${signals.fieldName} ${semanticText}`.trim()
    if (!matchesAnyPattern(fullText, COLLECTION_SHAPE_PATTERNS)) {
      return undefined
    }
    if (signals.hasSource || signals.canResolveRelationSource) {
      return createDecision({
        intent: 'generic',
        capabilityFamily: 'collection-shape',
        widgetType: 'widget.form.treeMultipleSelect',
        confidence: 'high',
        requiresClarification: false,
        matchedSignals: ['collection-source'],
      })
    }
    if (signals.enumOptionsCount > 0) {
      return createDecision({
        intent: 'generic',
        capabilityFamily: 'collection-shape',
        widgetType: 'widget.form.checkboxGroup',
        confidence: 'high',
        requiresClarification: false,
        matchedSignals: ['collection-enum-options'],
      })
    }
    return createDecision({
      intent: 'generic',
      capabilityFamily: 'collection-shape',
      confidence: 'medium',
      requiresClarification: true,
      clarificationQuestion: buildCollectionClarificationQuestion(signals.fieldName),
      matchedSignals: ['collection-missing-options'],
    })
  },
]

const enumBusinessAttributeResolvers: BlueprintFieldIntentResolver[] = [
  ({ signals, semanticText }) => {
    if (
      !ENUM_BUSINESS_ATTRIBUTE_WIDGET_TYPES.has(signals.explicitWidgetType)
      || signals.enumOptionsCount <= 0
      || !hasEnumBusinessAttributeKeyword(signals.fieldName)
      || hasExplicitRelationBindingPhrase(semanticText)
    ) {
      return undefined
    }

    return createDecision({
      intent: 'generic',
      capabilityFamily: 'generic',
      widgetType: signals.explicitWidgetType,
      trustedExplicitWidgetType: signals.explicitWidgetType,
      confidence: 'high',
      requiresClarification: false,
      matchedSignals: [
        'enum-business-attribute',
        `explicit-widget:${signals.explicitWidgetType}`,
        `enum-options:${signals.enumOptionsCount}`,
      ],
    })
  },
]

const timeGranularityResolvers: BlueprintFieldIntentResolver[] = [
  ({ signals, semanticText }) => {
    const fullText = `${signals.fieldName} ${semanticText}`.trim()
    if (matchesAnyPattern(signals.fieldName, AMBIGUOUS_TIME_PATTERNS)) {
      return createDecision({
        intent: 'generic',
        capabilityFamily: 'time-granularity',
        confidence: 'medium',
        requiresClarification: true,
        clarificationQuestion: buildTimeClarificationQuestion(signals.fieldName),
        matchedSignals: ['time-ambiguous'],
      })
    }
    if (matchesAnyPattern(fullText, TIME_RANGE_PATTERNS)) {
      return createDecision({
        intent: 'generic',
        capabilityFamily: 'time-granularity',
        widgetType: 'widget.form.dateRangePicker',
        confidence: 'high',
        requiresClarification: false,
        matchedSignals: ['time-range'],
      })
    }
    if (matchesAnyPattern(fullText, TIME_ONLY_PATTERNS)) {
      return createDecision({
        intent: 'generic',
        capabilityFamily: 'time-granularity',
        widgetType: 'widget.form.timePicker',
        confidence: 'high',
        requiresClarification: false,
        matchedSignals: ['time-only'],
      })
    }
    if (matchesAnyPattern(fullText, TIME_POINT_PATTERNS)) {
      return createDecision({
        intent: 'generic',
        capabilityFamily: 'time-granularity',
        widgetType: 'widget.form.datePicker',
        confidence: 'high',
        requiresClarification: false,
        matchedSignals: ['time-point'],
      })
    }
    return undefined
  },
]

const mediaEvidenceResolvers: BlueprintFieldIntentResolver[] = [
  ({ signals, semanticText }) => {
    const fullText = `${signals.fieldName} ${semanticText}`.trim()
    if (matchesAnyPattern(signals.fieldName, AMBIGUOUS_ATTACHMENT_PATTERNS)) {
      return createDecision({
        intent: 'generic',
        capabilityFamily: 'media-evidence',
        confidence: 'medium',
        requiresClarification: true,
        clarificationQuestion: buildAttachmentClarificationQuestion(signals.fieldName),
        matchedSignals: ['attachment-ambiguous'],
      })
    }
    if (matchesAnyPattern(fullText, IMAGE_PATTERNS)) {
      return createDecision({
        intent: 'generic',
        capabilityFamily: 'media-evidence',
        widgetType: 'widget.form.image-uploader',
        confidence: 'high',
        requiresClarification: false,
        matchedSignals: ['image-evidence'],
      })
    }
    if (matchesAnyPattern(fullText, FILE_PATTERNS)) {
      return createDecision({
        intent: 'generic',
        capabilityFamily: 'media-evidence',
        widgetType: 'widget.form.file-uploader',
        confidence: 'high',
        requiresClarification: false,
        matchedSignals: ['file-evidence'],
      })
    }
    return undefined
  },
]

const BLUEPRINT_FIELD_INTENT_RESOLVERS: BlueprintFieldIntentResolver[] = [
  earlyGenericResolver,
  ...organizationIdentityResolvers,
  ...personResolvers,
  ...booleanStateResolvers,
  ...collectionShapeResolvers,
  ...enumBusinessAttributeResolvers,
  ...timeGranularityResolvers,
  ...mediaEvidenceResolvers,
  ...masterDataRelationResolvers,
]

export const inferBlueprintFieldIntent = (
  input: BlueprintFieldIntentInput,
): BlueprintFieldIntentDecision => {
  const signals = buildBlueprintFieldIntentSignals(input)
  const semanticText = [
    signals.formName,
    signals.fieldName,
    signals.description,
    ...signals.notes,
  ].join(' ')
  const context: BlueprintFieldIntentResolverContext = {
    signals,
    semanticText,
  }

  for (const resolver of BLUEPRINT_FIELD_INTENT_RESOLVERS) {
    const decision = resolver(context)
    if (decision) {
      return decision
    }
  }

  return genericFallbackDecision()
}
