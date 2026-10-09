import type {
  NocodeEditorPlanningQuestionDomain,
} from '@common/types/nocodeEditorConfirmation'

export type NocodeEditorQuestionDomain = NocodeEditorPlanningQuestionDomain

export type NocodeEditorQuestionStage =
  | 'app-plan'
  | 'form-plan'
  | 'form-blueprint'
  | 'flow-scheme'

export const normalizeNocodeEditorPlanningQuestionDomain = (
  value: unknown,
): NocodeEditorPlanningQuestionDomain | undefined => {
  const domain = String(value ?? '').trim()
  return domain === 'app'
    || domain === 'form'
    || domain === 'flow'
    || domain === 'unknown'
    ? domain
    : undefined
}

const normalizeText = (value: unknown) => typeof value === 'string'
  ? value.replace(/\s+/gu, ' ').trim()
  : ''

const collectOptionText = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [normalizeText(value)].filter(Boolean)
  }

  if (!value || typeof value !== 'object') {
    return []
  }

  const option = value as Record<string, unknown>
  return [
    normalizeText(option.label),
    normalizeText(option.value),
    normalizeText(option.description),
  ].filter(Boolean)
}

const collectNocodeEditorQuestionPrimaryText = (value: unknown) => {
  if (typeof value === 'string') {
    return normalizeText(value)
  }

  if (!value || typeof value !== 'object') {
    return ''
  }

  const question = value as Record<string, unknown>
  return [
    normalizeText(question.title),
    normalizeText(question.question),
    normalizeText(question.name),
    normalizeText(question.description),
  ].filter(Boolean).join(' ')
}

export const collectNocodeEditorQuestionText = (value: unknown) => {
  const primaryText = collectNocodeEditorQuestionPrimaryText(value)
  if (!value || typeof value !== 'object') {
    return primaryText
  }

  const question = value as Record<string, unknown>
  const options = Array.isArray(question.options)
    ? question.options
    : [question.options]

  return [
    primaryText,
    ...options.flatMap(collectOptionText),
  ].filter(Boolean).join(' ')
}

const CORE_FIELD_CONFIGURATION_PATTERNS = [
  /(?:字段|field|控件|widget)[\s\S]{0,20}(?:组件|类型|格式|必填|显示|选项|枚举|memberselect|textinput)/i,
  /(?:组件|类型|格式|必填|显示|选项|枚举|memberselect|textinput)[\s\S]{0,20}(?:字段|field|控件|widget)/i,
  /(?:审批人|办理人|抄送人)(?:字段|field)[\s\S]{0,20}(?:选择|选取)/i,
  /(?:审批状态|流程状态)[\s\S]{0,20}(?:字段|field|选项|枚举)/i,
  /(?:字段|field|选项|枚举)[\s\S]{0,20}(?:审批状态|流程状态)/i,
]

const EXPLICIT_ROLE_FIELD_RELATIONSHIP_PATTERNS = [
  /(?:审批人|办理人|抄送人)(?:字段|field)[\s\S]{0,20}(?:关联|关系)/i,
  /(?:表单|字段|field|来源|显示字段)[\s\S]{0,20}(?:关联|关系)[\s\S]{0,20}(?:审批人|办理人|抄送人)(?:字段|field)/i,
]

const RELATION_FORM_FIELD_CONFIGURATION_PATTERNS = [
  /(?:关联|关系)[\s\S]{0,20}(?:字段|field|表单|来源|显示字段)/i,
  /(?:字段|field|表单|来源|显示字段)[\s\S]{0,20}(?:关联|关系)/i,
]

const EXPLICIT_FORM_FIELD_ACTION_PATTERNS = [
  /(?:增加|新增|保留|展示|记录|采集).{0,16}(?:字段|列|控件)/iu,
]

const EXPLICIT_FORM_FIELD_NAME_PATTERNS = [
  /[“"']?[^“”"']{1,24}(?:说明|备注|状态|编号)[”"']?字段/iu,
]

const FIELD_TO_FLOW_BEHAVIOR_PATTERNS = [
  /(?:字段|列|控件)(?:(?:值)?(?:发生)?(?:变化|更新|提交|保存|完成))?(?:后|时)[\s\S]{0,24}(?:触发|自动发起|发起)[\s\S]{0,20}(?:审批流程|流程|审批)/iu,
  /(?:字段|列|控件)[\s\S]{0,32}(?:提交(?:后|时)?|按钮|定时|数据变化)[\s\S]{0,20}(?:自动发起|手动发起|触发|发起)[\s\S]{0,20}(?:审批流程|流程|审批)/iu,
]

const STRONG_FLOW_BEHAVIOR_PATTERNS = [
  /(?:审批|审核|流程|办理)节点[\s\S]{0,32}(?:决定|判断|驳回|通过|退回|结束)/iu,
  /(?:(?:流程|审批)[\s\S]{0,20}(?:触发|发起)|(?:触发|发起)[\s\S]{0,20}(?:流程|审批))/iu,
  /(?:(?:提交(?:后|时)?|按钮|定时|数据变化)[\s\S]{0,20}(?:自动发起|手动发起)|(?:自动发起|手动发起)[\s\S]{0,20}(?:提交(?:后|时)?|按钮|定时|数据变化))/iu,
  /(?:驳回|通过|审批后|办理后)[\s\S]{0,20}(?:退回|结束|处理|写回|通知|抄送|归档)/iu,
]

const FLOW_SEMANTIC_PATTERNS = [
  /审批流程|审批节点|流程节点|approval\s*(?:flow|process|workflow)/i,
  /(?:审批人|办理人|抄送人)[\s\S]{0,20}(?:选择|使用|表单字段)/i,
  /(?:选择|使用|表单字段)[\s\S]{0,20}(?:审批人|办理人|抄送人)/i,
  /(?:审批人|办理人|抄送人)[\s\S]{0,20}(?:固定人员|固定成员|角色|部门负责人|直属主管|提交人上级)/i,
  /(?:固定人员|固定成员|角色|部门负责人|直属主管|提交人上级)[\s\S]{0,20}(?:审批人|办理人|抄送人)/i,
  /(?:直属主管|部门负责人|财务|总经理)[\s\S]{0,20}(?:审批|复核|审核)/i,
  /(?:审批|复核|审核)[\s\S]{0,20}(?:直属主管|部门负责人|财务|总经理)/i,
]

const STRONG_APPROVAL_OWNER_FIELD_SOURCE_DECISION_PATTERNS = [
  /(?:审批人|办理人|抄送人)(?:字段|field)[\s\S]{0,20}(?:来源|来自|取自)[\s\S]{0,20}(?:固定人员|固定成员|角色|部门负责人|直属主管|提交人上级|表单字段[\s\S]{0,12}作为审批人|作为审批人)/i,
  /(?:审批人|办理人|抄送人)(?:字段|field)[\s\S]{0,20}(?:固定人员|固定成员|角色|部门负责人|直属主管|提交人上级|表单字段[\s\S]{0,12}作为审批人|作为审批人)[\s\S]{0,20}(?:来源|来自|取自)/i,
]

const STRONG_APPROVAL_OWNER_DECISION_PATTERNS = [
  /(?:审批人|办理人|抄送人)(?:的)?(?:来源|来自|取自)/i,
  /(?:审批人|办理人|抄送人)(?:应|由)?(?:来自|取自)/i,
  /(?:来源|来自|取自)[\s\S]{0,12}(?:审批人|办理人|抄送人)/i,
  /(?:审批人|办理人|抄送人)[\s\S]{0,20}(?:固定人员|固定成员|角色|部门负责人|直属主管|提交人上级)/i,
  /(?:固定人员|固定成员|角色|部门负责人|直属主管|提交人上级)[\s\S]{0,20}(?:审批人|办理人|抄送人)/i,
]

const APPROVAL_OWNER_SOURCE_MAPPING_PATTERNS = [
  /(?:审批人|办理人|抄送人)[\s\S]{0,20}(?:表单字段|字段|field)[\s\S]{0,20}(?:关联|关系|映射)/i,
  /(?:表单字段|字段|field)[\s\S]{0,20}(?:关联|关系|映射)[\s\S]{0,20}(?:审批人|办理人|抄送人)/i,
]

const GENERAL_FORM_FIELD_PATTERN = /字段|field|列|column|控件|widget/i

const matchesAny = (text: string, patterns: RegExp[]) => patterns.some(pattern => pattern.test(text))

const resolveNocodeEditorQuestionTextDomain = (
  text: string,
): NocodeEditorQuestionDomain => {
  if (!text) {
    return 'unknown'
  }

  if (matchesAny(text, STRONG_APPROVAL_OWNER_FIELD_SOURCE_DECISION_PATTERNS)) {
    return 'flow'
  }

  if (matchesAny(text, FIELD_TO_FLOW_BEHAVIOR_PATTERNS)) {
    return 'flow'
  }

  if (matchesAny(text, EXPLICIT_FORM_FIELD_ACTION_PATTERNS)) {
    return 'form'
  }

  if (matchesAny(text, CORE_FIELD_CONFIGURATION_PATTERNS)) {
    return 'form'
  }

  if (matchesAny(text, STRONG_FLOW_BEHAVIOR_PATTERNS)) {
    return 'flow'
  }

  if (matchesAny(text, EXPLICIT_FORM_FIELD_NAME_PATTERNS)) {
    return 'form'
  }

  if (matchesAny(text, STRONG_APPROVAL_OWNER_DECISION_PATTERNS)) {
    return 'flow'
  }

  if (matchesAny(text, EXPLICIT_ROLE_FIELD_RELATIONSHIP_PATTERNS)) {
    return 'form'
  }

  if (matchesAny(text, APPROVAL_OWNER_SOURCE_MAPPING_PATTERNS)) {
    return 'flow'
  }

  if (matchesAny(text, FLOW_SEMANTIC_PATTERNS)) {
    return 'flow'
  }

  if (matchesAny(text, RELATION_FORM_FIELD_CONFIGURATION_PATTERNS)) {
    return 'form'
  }

  return GENERAL_FORM_FIELD_PATTERN.test(text) ? 'form' : 'unknown'
}

export const resolveNocodeEditorQuestionDomain = (
  value: unknown,
): NocodeEditorQuestionDomain => {
  const explicitDomain = value && typeof value === 'object' && !Array.isArray(value)
    ? normalizeNocodeEditorPlanningQuestionDomain(
      (value as Record<string, unknown>).domain,
    )
    : undefined
  if (explicitDomain) {
    return explicitDomain
  }

  const primaryText = collectNocodeEditorQuestionPrimaryText(value)
  const primaryDomain = resolveNocodeEditorQuestionTextDomain(primaryText)
  if (primaryDomain !== 'unknown') {
    return primaryDomain
  }

  return resolveNocodeEditorQuestionTextDomain(
    collectNocodeEditorQuestionText(value),
  )
}

export const isNocodeEditorQuestionAllowedForStage = (
  value: unknown,
  stage: NocodeEditorQuestionStage,
) => {
  if (stage === 'flow-scheme') {
    return true
  }

  const domain = resolveNocodeEditorQuestionDomain(value)
  if (stage === 'form-plan' || stage === 'form-blueprint') {
    return domain === 'form' || domain === 'unknown'
  }

  return domain !== 'flow'
}

export const filterNocodeEditorQuestionsForStage = <T>(
  values: T[],
  stage: NocodeEditorQuestionStage,
) => values.filter(value => isNocodeEditorQuestionAllowedForStage(value, stage))
