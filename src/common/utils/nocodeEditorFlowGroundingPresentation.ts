import type {
  NocodeEditorAiConfirmQuestion,
  NocodeEditorAiConfirmQuestionOption,
} from '../types/nocodeEditorConfirmation'
import {
  isNocodeEditorFlowGroundingOwnerUsage,
} from './nocodeEditorFlowSchemeGrounding'
import type {
  NocodeEditorFlowGroundingOwnerUsage,
  NocodeEditorFlowSchemeGroundingDiagnostic,
} from './nocodeEditorFlowSchemeGrounding'

export type FlowGroundingQuestion = NocodeEditorAiConfirmQuestion & {
  type: 'single-choice'
}

export type FlowGroundingConfirmationGroup = {
  kind: 'confirmation'
  key: string
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[]
  question: FlowGroundingQuestion
}

export type FlowGroundingSystemErrorGroup = {
  kind: 'system_error'
  key: string
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[]
  userMessage: string
}

export type FlowGroundingIssueGroup =
  | FlowGroundingConfirmationGroup
  | FlowGroundingSystemErrorGroup

type FlowGroundingCapability = 'condition' | 'write' | 'source' | 'owner'

const FLOW_GROUNDING_DECISION_KEY_PREFIX: Record<FlowGroundingCapability, string> = {
  condition: 'flow.condition.field',
  source: 'flow.source.field',
  write: 'flow.write.field',
  owner: '', // 审批人来源由 flow.approval.owner.source 收敛，合成题不生成第二身份
}

export const FLOW_GROUNDING_GLOBAL_SCOPE_KEY = 'global'

export const FLOW_GROUNDING_USE_EXISTING_CONDITION_FIELD_OPTION_PREFIX = 'use-existing-condition-field:'
export const FLOW_GROUNDING_USE_EXISTING_SOURCE_FIELD_OPTION_PREFIX = 'use-existing-source-field:'

export type FlowGroundingFieldOptionDecision = {
  capability: 'condition' | 'source'
  fieldId: string
}

export const parseFlowGroundingFieldOptionDecision = (
  value: unknown,
): FlowGroundingFieldOptionDecision | null => {
  const optionValue = normalizeText(value)
  const parse = (
    prefix: string,
    capability: FlowGroundingFieldOptionDecision['capability'],
  ) => {
    if (!optionValue.startsWith(prefix)) {
      return null
    }
    const fieldId = normalizeText(optionValue.slice(prefix.length))
    return fieldId ? { capability, fieldId } : null
  }
  return parse(FLOW_GROUNDING_USE_EXISTING_CONDITION_FIELD_OPTION_PREFIX, 'condition')
    || parse(FLOW_GROUNDING_USE_EXISTING_SOURCE_FIELD_OPTION_PREFIX, 'source')
}

const resolveFlowGroundingDecisionKeyPrefix = (
  template: FlowGroundingConfirmationTemplate,
) => {
  if (template.key === 'sequential-write-conflict') {
    return 'flow.write.sequential'
  }
  if (template.key === 'source-table-missing') {
    return 'flow.source.table'
  }
  return FLOW_GROUNDING_DECISION_KEY_PREFIX[template.capability]
}

export const resolveFlowGroundingDecisionScopeKey = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
) => {
  if (diagnostics.some(diagnostic => diagnostic.code === 'grounding_sequential_write_conflict')) {
    return FLOW_GROUNDING_GLOBAL_SCOPE_KEY
  }
  const scopeKeys = new Set(
    diagnostics
      .map(diagnostic => normalizeText(diagnostic.branchKey) || normalizeText(diagnostic.nodeKey))
      .filter(Boolean)
      .map(scopeKey => scopeKey.toLowerCase()),
  )
  return scopeKeys.size === 1 ? [...scopeKeys][0] : FLOW_GROUNDING_GLOBAL_SCOPE_KEY
}

const resolveFlowGroundingDecisionKey = (
  template: FlowGroundingConfirmationTemplate,
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
) => {
  const prefix = resolveFlowGroundingDecisionKeyPrefix(template)
  return prefix
    ? `${prefix}:${resolveFlowGroundingDecisionScopeKey(diagnostics)}`
    : ''
}

type FlowGroundingConfirmationTemplate = {
  key: string
  capability: FlowGroundingCapability
  title: string
  description: string
  options: NocodeEditorAiConfirmQuestionOption[]
}

type FlowGroundingDraftGroup = {
  key: string
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[]
  template: FlowGroundingConfirmationTemplate | null
}

type UnknownRecord = Record<string, unknown>

const FLOW_GROUNDING_SYSTEM_ERROR_USER_MESSAGE = '流程生成前诊断暂时无法转换成可处理的业务问题。'
const FLOW_GROUNDING_VISIBLE_QUESTION_FALLBACK_TITLE = '流程方案还需要补充确认'
const FLOW_GROUNDING_VISIBLE_QUESTION_FALLBACK_DESCRIPTION = '请补充这个流程生成前必须确认的信息。'

// Only protocol-shaped fragments are technical. Business field names may legitimately use snake_case or IDs.
export const FLOW_GROUNDING_TECHNICAL_TEXT_PATTERN = /\b(?:nodeKey|branchKey|nodeId|branchId|fieldId|fieldUID|tableId|ownerPolicy|conditionPolicy|writePolicy)\s*=|\b(?:flow summary|flowSummary|flowPlan|not-rendered)\b/i

// 与业务命名不同，表单引擎生成的字段/表单编码形如 fld_qv5i0t8v39t6、f_1a2b3c，不能展示给用户。
// 判定要保守：纯英文 snake_case（如 owner_name）不算引擎编码；能否上屏另由 isFlowGroundingBusinessLabelText 判定。
const FLOW_GROUNDING_IDENTIFIER_PREFIX_PATTERN = /^(?:fld|f|tbl|t|frm|fm|uid|fk)(?:[_-][A-Za-z0-9]+)+$/i
const FLOW_GROUNDING_MACHINE_ID_PATTERN = /^[A-Za-z]{1,4}[_-][A-Za-z0-9]{5,}$/

export const normalizeText = (value: unknown) => String(value ?? '').trim()

export const isFlowGroundingIdentifierText = (value: unknown) => {
  const text = normalizeText(value)
  if (!text) {
    return false
  }
  if (FLOW_GROUNDING_IDENTIFIER_PREFIX_PATTERN.test(text)) {
    return true
  }
  return FLOW_GROUNDING_MACHINE_ID_PATTERN.test(text) && /\d[A-Za-z0-9]{3,}$/.test(text)
}

export const containsTechnicalFlowText = (value: unknown) => (
  FLOW_GROUNDING_TECHNICAL_TEXT_PATTERN.test(normalizeText(value))
)

// 句子里的字段编码也要识别出来（如“涉及字段：“fld_qv5i0t8v39t6””），按词切开逐个判断。
export const containsFlowGroundingIdentifierText = (value: unknown) => (
  normalizeText(value)
    .split(/[\s“”"'‘’（）()【】\[\]，,。；;：:、|/]+/)
    .some(isFlowGroundingIdentifierText)
)

// 字段引用只有读起来像业务标签时才进入用户文案：含中文，或是带空格/首字母大写的可读英文。
// 形如 approved、owner_name、fld_xxx 的编码式引用一律不展示，改为一句话描述业务影响。
const FLOW_GROUNDING_BUSINESS_LABEL_CJK_PATTERN = /[\u3400-\u9fff]/

export const isFlowGroundingBusinessLabelText = (value: unknown) => {
  const text = normalizeText(value)
  if (!text || isFlowGroundingIdentifierText(text) || containsTechnicalFlowText(text)) {
    return false
  }
  return FLOW_GROUNDING_BUSINESS_LABEL_CJK_PATTERN.test(text)
    || /\s/.test(text)
    || /^[A-Z][a-z]/.test(text)
}

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeQuestionKind = (value: unknown): NocodeEditorAiConfirmQuestion['questionKind'] => {
  const questionKind = normalizeText(value)
  return questionKind === 'binary' || questionKind === 'single_select' || questionKind === 'note_only'
    ? questionKind
    : undefined
}

const normalizeQuestionOptions = (value: unknown) => (
  Array.isArray(value)
    ? value.flatMap((item) => {
      if (typeof item === 'string') {
        const label = normalizeText(item)
        return label ? [{ value: label, label }] : []
      }
      if (!isRecord(item)) {
        return []
      }
      const label = normalizeText(item.label)
      const optionValue = normalizeText(item.value) || label
      if (!label || !optionValue) {
        return []
      }
      return [{
        value: optionValue,
        label,
        description: normalizeText(item.description) || undefined,
        selected: typeof item.selected === 'boolean' ? item.selected : undefined,
      }]
    })
    : []
)

const isUnreadableFlowQuestionText = (value: unknown) => (
  containsTechnicalFlowText(value) || containsFlowGroundingIdentifierText(value)
)

const hasTechnicalFlowQuestionText = (value: unknown) => {
  if (typeof value === 'string') {
    return isUnreadableFlowQuestionText(value)
  }
  if (!isRecord(value)) {
    return false
  }

  const options = Array.isArray(value.options) ? value.options : []
  return [
    value.title ?? value.question ?? value.name,
    value.description,
    ...options.flatMap((option) => (
      isRecord(option) ? [option.label, option.description] : [option]
    )),
  ].some(isUnreadableFlowQuestionText)
}

const buildVisibleQuestionFallback = (
  value: unknown,
  index: number,
): NocodeEditorAiConfirmQuestion => {
  const record = isRecord(value) ? value : {}
  return {
    id: normalizeText(record.id) || `flow-grounding-confirmation-${index + 1}`,
    title: FLOW_GROUNDING_VISIBLE_QUESTION_FALLBACK_TITLE,
    description: FLOW_GROUNDING_VISIBLE_QUESTION_FALLBACK_DESCRIPTION,
    questionKind: 'note_only',
    scopeKind: record.scopeKind === 'trigger-branch' ? 'trigger-branch' : 'overview',
    branchKey: record.scopeKind === 'trigger-branch'
      ? normalizeText(record.branchKey) || undefined
      : undefined,
    required: true,
    allowFreeText: true,
  }
}

export const normalizeVisibleQuestion = (
  value: unknown,
  index = 0,
): NocodeEditorAiConfirmQuestion | null => {
  if (hasTechnicalFlowQuestionText(value)) {
    return buildVisibleQuestionFallback(value, index)
  }

  if (typeof value === 'string') {
    const title = normalizeText(value)
    return title
      ? {
        id: `flow-grounding-confirmation-${index + 1}`,
        title,
        questionKind: 'note_only',
        required: true,
        allowFreeText: true,
      }
      : null
  }
  if (!isRecord(value)) {
    return null
  }

  const title = normalizeText(value.title ?? value.question ?? value.name)
  if (!title) {
    return null
  }
  const options = normalizeQuestionOptions(value.options)
  const questionKind = normalizeQuestionKind(value.questionKind)
    || (options.length ? 'single_select' : 'note_only')
  const scopeKind = value.scopeKind === 'trigger-branch' ? 'trigger-branch' : 'overview'
  const dependsOn = Array.isArray(value.dependsOn)
    ? value.dependsOn.map(normalizeText).filter(Boolean)
    : []

  return {
    id: normalizeText(value.id) || `flow-grounding-confirmation-${index + 1}`,
    decisionKey: normalizeText(value.decisionKey) || undefined,
    decisionKeySource: value.decisionKeySource === 'explicit'
      || value.decisionKeySource === 'legacy_question_id'
      ? value.decisionKeySource
      : undefined,
    decisionTarget: isRecord(value.decisionTarget)
      && normalizeText(value.decisionTarget.fieldKey)
      ? {
        kind: 'field-source' as const,
        formKey: normalizeText(value.decisionTarget.formKey) || undefined,
        formName: normalizeText(value.decisionTarget.formName) || undefined,
        fieldKey: normalizeText(value.decisionTarget.fieldKey),
        fieldName: normalizeText(value.decisionTarget.fieldName) || undefined,
      }
      : undefined,
    title,
    description: normalizeText(value.description) || undefined,
    questionKind,
    scopeKind,
    branchKey: scopeKind === 'trigger-branch'
      ? normalizeText(value.branchKey) || undefined
      : undefined,
    required: typeof value.required === 'boolean' ? value.required : true,
    allowFreeText: typeof value.allowFreeText === 'boolean' ? value.allowFreeText : true,
    options: questionKind === 'note_only' || !options.length ? undefined : options,
    dependsOn: dependsOn.length ? dependsOn : undefined,
    confirmed: typeof value.confirmed === 'boolean' ? value.confirmed : undefined,
    selectedOptionValue: questionKind === 'note_only'
      ? undefined
      : normalizeText(value.selectedOptionValue) || undefined,
    answerSummary: normalizeText(value.answerSummary) || undefined,
    answerDetail: normalizeText(value.answerDetail) || undefined,
  }
}

const conditionMissingTemplate: FlowGroundingConfirmationTemplate = {
  key: 'condition-field-missing',
  capability: 'condition',
  title: 'AI 规划的条件判断还缺少字段',
  description: '需要确认流程应依据哪个业务字段判断后续路径。',
  options: [
    {
      value: 'choose-another-condition-field',
      label: '改用其他判断字段',
      description: '先点推荐的字段按钮直接选用；没有合适的就在“补充说明”里写明字段名。',
    },
    {
      value: 'adjust-condition-design',
      label: '调整条件设计',
      description: '调整当前条件的业务判断方式。',
    },
  ],
}

const conditionForbiddenTemplate: FlowGroundingConfirmationTemplate = {
  key: 'condition-field-forbidden',
  capability: 'condition',
  title: 'AI 规划用到的字段不能用于条件判断',
  description: '需要改用可支持条件判断的业务字段，或调整当前条件设计。',
  options: [
    {
      value: 'choose-another-condition-field',
      label: '改用其他判断字段',
      description: '先点推荐的字段按钮直接选用；没有合适的就在“补充说明”里写明字段名。',
    },
    {
      value: 'adjust-condition-design',
      label: '调整条件设计',
      description: '调整当前条件的业务判断方式。',
    },
  ],
}

const sequentialWriteConflictTemplate: FlowGroundingConfirmationTemplate = {
  key: 'sequential-write-conflict',
  capability: 'write',
  title: '多个顺序步骤会改写同一字段',
  description: '请确认这些更新应按顺序执行，还是分别对应不同条件下的结果。',
  options: [
    {
      value: 'confirm-sequential-updates',
      label: '确认按顺序更新',
      description: '这些步骤确实需要依次写入同一字段。',
    },
    {
      value: 'split-into-conditional-paths',
      label: '改为条件分支',
      description: '这些不同写入值分别对应不同条件或业务结果。',
    },
    {
      value: 'adjust-write-design',
      label: '调整写入设计',
      description: '改用其他字段或重新设计后续处理方式。',
    },
  ],
}

const writeMissingTemplate: FlowGroundingConfirmationTemplate = {
  key: 'write-field-missing',
  capability: 'write',
  title: 'AI 规划的流程写入还缺少目标字段',
  description: '需要确认本次流程写入应保存到哪个业务字段。',
  options: [
    {
      value: 'choose-another-write-field',
      label: '改用其他写入字段',
      description: '在“补充说明”里写明要写入的字段名。',
    },
    {
      value: 'adjust-write-design',
      label: '调整写入设计',
      description: '调整当前流程写入的业务安排。',
    },
  ],
}

const writeForbiddenTemplate: FlowGroundingConfirmationTemplate = {
  key: 'write-field-forbidden',
  capability: 'write',
  title: 'AI 规划使用的字段不支持这次写入',
  description: '需要改用支持写入的业务字段，或调整当前写入设计。',
  options: [
    {
      value: 'choose-another-write-field',
      label: '改用其他写入字段',
      description: '在“补充说明”里写明要写入的字段名。',
    },
    {
      value: 'adjust-write-design',
      label: '调整写入设计',
      description: '调整当前流程写入的业务安排。',
    },
  ],
}

const sourceFieldMissingTemplate: FlowGroundingConfirmationTemplate = {
  key: 'source-field-missing',
  capability: 'source',
  title: 'AI 规划的数据来源还缺少字段',
  description: '需要确认流程从哪个业务字段获取数据。',
  options: [
    {
      value: 'choose-another-source-field',
      label: '改用其他来源字段',
      description: '先点推荐的字段按钮直接选用；没有合适的就在“补充说明”里写明字段名。',
    },
    {
      value: 'adjust-source-design',
      label: '调整数据来源设计',
      description: '调整当前流程的数据来源安排。',
    },
  ],
}

const sourceFieldConflictTemplate: FlowGroundingConfirmationTemplate = {
  key: 'source-field-conflict',
  capability: 'source',
  title: 'AI 规划引用了相互冲突的来源字段',
  description: '需要确认本次流程应使用哪一个数据来源字段。',
  options: [
    {
      value: 'keep-one-conflict-source',
      label: '保留其中一个来源',
      description: '在“补充说明”里写明保留哪一个来源字段。',
    },
    {
      value: 'choose-another-source-field',
      label: '改用其他来源字段',
      description: '在“补充说明”里写明要改用哪个来源字段。',
    },
    {
      value: 'adjust-source-design',
      label: '调整数据来源设计',
      description: '调整当前流程的数据来源安排。',
    },
  ],
}

const sourceTableMissingTemplate: FlowGroundingConfirmationTemplate = {
  key: 'source-table-missing',
  capability: 'source',
  title: 'AI 规划的数据来源还缺少表单',
  description: '需要确认流程从哪张业务表单获取数据。',
  options: [
    {
      value: 'choose-another-source-table',
      label: '改用其他来源表单',
      description: '在“补充说明”里写明要使用的表单名。',
    },
    {
      value: 'adjust-source-design',
      label: '调整数据来源设计',
      description: '调整当前流程的数据来源安排。',
    },
  ],
}

const ownerTemplate: FlowGroundingConfirmationTemplate = {
  key: 'owner-field',
  capability: 'owner',
  title: '',
  description: '',
  options: [],
}

const resolveFlowGroundingConfirmationTemplate = (
  code: string,
): FlowGroundingConfirmationTemplate | null => {
  switch (code) {
  case 'grounding_condition_field_missing':
    return conditionMissingTemplate
  case 'grounding_condition_field_forbidden':
    return conditionForbiddenTemplate
  case 'grounding_sequential_write_conflict':
    return sequentialWriteConflictTemplate
  case 'grounding_write_field_missing':
    return writeMissingTemplate
  case 'grounding_write_field_forbidden':
    return writeForbiddenTemplate
  case 'grounding_source_field_missing':
    return sourceFieldMissingTemplate
  case 'grounding_source_field_conflict':
    return sourceFieldConflictTemplate
  case 'grounding_source_table_missing':
    return sourceTableMissingTemplate
  case 'grounding_owner_field_missing':
    return ownerTemplate
  case 'grounding_owner_field_forbidden':
    return ownerTemplate
  default:
    return null
  }
}

const resolveOwnerUsageLabel = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
) => {
  const usages = new Set<NocodeEditorFlowGroundingOwnerUsage>()
  diagnostics.forEach((diagnostic) => {
    if (diagnostic.ownerUsage) {
      usages.add(diagnostic.ownerUsage)
    }
  })

  if (usages.size !== 1) {
    return '处理人'
  }

  const usage = [...usages][0]
  switch (usage) {
  case 'approval_owner':
    return '审批人'
  case 'notify_target':
    return '通知对象'
  case 'handler':
    return '办理人'
  case 'reporter':
    return '填报人'
  case 'generic_owner':
    return '处理人'
  default:
    return '处理人'
  }
}

const buildOwnerQuestionOptions = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
  ownerLabel: string,
): NocodeEditorAiConfirmQuestionOption[] => {
  const diagnostic = diagnostics.length === 1 ? diagnostics[0] : null
  const compatibleFieldOptions = (diagnostic?.compatibleFields || [])
    .filter(field => field?.fieldId && field?.fieldName)
    .map(field => ({
      value: `use-existing-owner-field:${field.fieldId}`,
      label: `使用现有成员或组织字段（${field.fieldName}）`,
      description: `复用该字段作为${ownerLabel}来源。`,
    }))

  return [
    ...compatibleFieldOptions,
    {
      value: 'confirm-owner-source',
      label: `确认${ownerLabel}来源`,
      description: `说明本次流程如何确定${ownerLabel}。`,
    },
    {
      value: 'choose-another-owner-source',
      label: `改用其他${ownerLabel}来源`,
      description: `从已有成员、组织或业务字段中选择${ownerLabel}来源。`,
    },
    {
      value: 'adjust-owner-design',
      label: `调整${ownerLabel}安排`,
      description: `调整当前流程中${ownerLabel}的业务安排。`,
    },
  ].map(option => ({ ...option }))
}

const buildCompatibleConditionFieldOptions = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
): NocodeEditorAiConfirmQuestionOption[] => {
  const seen = new Set<string>()
  return diagnostics
    .flatMap(diagnostic => diagnostic.compatibleFields || [])
    .flatMap((field) => {
      const fieldId = normalizeText(field?.fieldId)
      const fieldName = normalizeText(field?.fieldName)
      if (!fieldId || !fieldName || seen.has(fieldId) || containsTechnicalFlowText(fieldName)) {
        return []
      }
      seen.add(fieldId)
      return [{
        value: `${FLOW_GROUNDING_USE_EXISTING_CONDITION_FIELD_OPTION_PREFIX}${fieldId}`,
        // 用引号携带字段名：确认卡展示层会剥除标签结尾的括号内容，括号形式会让字段名在按钮上消失。
        label: `改用现有字段“${fieldName}”`,
        description: '使用该字段作为条件判断依据。',
      }]
    })
    .slice(0, 3)
}

const buildCompatibleSourceFieldOptions = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
): NocodeEditorAiConfirmQuestionOption[] => {
  const seen = new Set<string>()
  return diagnostics
    .flatMap(diagnostic => diagnostic.compatibleFields || [])
    .flatMap((field) => {
      const fieldId = normalizeText(field?.fieldId)
      const fieldName = normalizeText(field?.fieldName)
      if (!fieldId || !fieldName || seen.has(fieldId) || containsTechnicalFlowText(fieldName)) {
        return []
      }
      seen.add(fieldId)
      return [{
        value: `${FLOW_GROUNDING_USE_EXISTING_SOURCE_FIELD_OPTION_PREFIX}${fieldId}`,
        // 用引号携带字段名：确认卡展示层会剥除标签结尾的括号内容，括号形式会让字段名在按钮上消失。
        label: `改用现有字段“${fieldName}”`,
        description: '使用该字段作为本次流程的数据来源。',
      }]
    })
    .slice(0, 3)
}

const collectBusinessReadableText = (value: unknown) => {
  const text = normalizeText(value)
  return text && !containsTechnicalFlowText(text) && !isFlowGroundingIdentifierText(text)
    ? text
    : ''
}

const collectUniqueBusinessTexts = (values: unknown[]) => (
  Array.from(new Set(values.map(collectBusinessReadableText).filter(Boolean)))
)

// 未解析的字段引用（missing 类诊断）可能只是模型写出的英文键，只有业务标签形态才展示。
const collectUniqueBusinessFieldLabels = (values: unknown[]) => (
  Array.from(new Set(values.map(value => (
    isFlowGroundingBusinessLabelText(value) ? normalizeText(value) : ''
  )).filter(Boolean)))
)

// 同一处问题可能同时来自多个校验入口，按“代码 + 节点 + 作用域 + 目标表单 + 字段”收敛后再计数。
const resolveFlowGroundingDiagnosticIdentity = (
  diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic,
) => [
  normalizeText(diagnostic.code),
  normalizeText(diagnostic.nodeKey),
  normalizeText(diagnostic.branchKey),
  normalizeText(diagnostic.targetFormId || diagnostic.targetFormName),
  normalizeText(diagnostic.fieldRef?.fieldId || diagnostic.fieldRef?.fieldName),
].join('|')

const countUniqueFlowGroundingDiagnostics = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
) => new Set(diagnostics.map(resolveFlowGroundingDiagnosticIdentity)).size

const joinBusinessTextList = (values: string[]) => (
  values.slice(0, 3).map(value => `“${value}”`).join('、')
)

const buildConditionFieldQuestionNarrative = (
  template: FlowGroundingConfirmationTemplate,
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
): { title: string; description: string } | null => {
  const forbidden = template.key === 'condition-field-forbidden'
  const nodeNames = collectUniqueBusinessTexts(diagnostics.map(diagnostic => diagnostic.nodeName))
  const nodeName = nodeNames[0]
  const formName = collectBusinessReadableText(diagnostics[0]?.targetFormName)
  const actionHint = '请从下面已有字段中选择替代字段，或补充说明条件应如何判断。'
  const fieldNames = forbidden
    ? collectUniqueBusinessTexts(
      diagnostics.map(diagnostic => diagnostic.fieldRef?.fieldName || diagnostic.fieldRef?.fieldId),
    )
    : collectUniqueBusinessFieldLabels(
      diagnostics.map(diagnostic => diagnostic.fieldRef?.fieldName || diagnostic.fieldRef?.fieldId),
    )
  if (!fieldNames.length) {
    // 引用的是表单引擎编码、英文键或已在表单中改名/删除的字段时，不把编码抛给用户，只描述业务影响。
    if (forbidden) {
      return {
        title: template.title,
        description: nodeName
          ? `AI 规划在“${nodeName}”使用的字段当前不能用于条件判断。${actionHint}`
          : `${template.description}${actionHint}`,
      }
    }
    return {
      title: nodeName
        ? `AI 规划在“${nodeName}”使用的条件字段已不存在`
        : 'AI 规划使用的条件字段已不存在',
      description: `这个字段在当前表单里找不到，可能是表单调整后被改名或删除。${actionHint}`,
    }
  }
  const count = Math.max(countUniqueFlowGroundingDiagnostics(diagnostics), fieldNames.length)

  if (count > 1) {
    const title = forbidden
      ? `AI 规划有 ${count} 处条件使用了不能用于判断的字段`
      : `AI 规划的条件判断有 ${count} 处引用了不存在的字段`
    const nodeHint = nodeNames.length ? `涉及节点：${joinBusinessTextList(nodeNames)}。` : ''
    return {
      title,
      description: `涉及字段：${joinBusinessTextList(fieldNames)}。${nodeHint}${actionHint}`,
    }
  }

  const fieldName = fieldNames[0]
  if (forbidden) {
    const reason = nodeName
      ? `AI 规划在“${nodeName}”需要依据它判断后续路径，但该字段当前不支持条件判断。`
      : '该字段当前不支持条件判断。'
    return {
      title: `AI 规划用到的字段“${fieldName}”不能用于条件判断`,
      description: `${reason}${actionHint}`,
    }
  }

  const reason = nodeName
    ? `AI 规划在“${nodeName}”需要依据它判断后续路径，但当前表单没有这个字段。`
    : 'AI 规划需要依据它判断后续路径，但当前表单没有这个字段。'
  return {
    title: formName
      ? `AI 规划的条件判断引用了表单“${formName}”中没有的字段“${fieldName}”`
      : `AI 规划的条件判断引用了当前表单中没有的字段“${fieldName}”`,
    description: `${reason}${actionHint}`,
  }
}

const extractSourceConflictFieldNames = (message: unknown) => {
  const matched = normalizeText(message).match(/指向“(.+?)”和“(.+?)”/)
  return matched ? [matched[1], matched[2]] : []
}

const extractMissingSourceFormName = (message: unknown) => {
  const matched = normalizeText(message).match(/未找到来源表单“(.+?)”/)
  return matched?.[1] || ''
}

const buildSourceFieldQuestionNarrative = (
  template: FlowGroundingConfirmationTemplate,
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
): { title: string; description: string } | null => {
  const nodeNames = collectUniqueBusinessTexts(diagnostics.map(diagnostic => diagnostic.nodeName))
  const nodeName = nodeNames[0]

  if (template.key === 'source-field-conflict') {
    const conflictFieldNames = collectUniqueBusinessTexts(
      diagnostics.flatMap(diagnostic => extractSourceConflictFieldNames(diagnostic.message)),
    )
    if (!conflictFieldNames.length) {
      return null
    }
    const actionHint = '请确认保留其中一个来源，或补充说明应使用哪个字段。'
    if (diagnostics.length > 1 || conflictFieldNames.length > 2) {
      const nodeHint = nodeNames.length ? `涉及节点：${joinBusinessTextList(nodeNames)}。` : ''
      return {
        title: `AI 规划引用的来源字段有 ${Math.max(diagnostics.length, 2)} 处存在冲突`,
        description: `涉及字段：${joinBusinessTextList(conflictFieldNames)}。${nodeHint}${actionHint}`,
      }
    }
    const [leftFieldName, rightFieldName] = conflictFieldNames
    const reason = nodeName
      ? `AI 规划在“${nodeName}”这一步同时引用了“${leftFieldName}”和“${rightFieldName}”两个来源字段，无法确定使用哪一个。`
      : `AI 规划同时引用了“${leftFieldName}”和“${rightFieldName}”两个来源字段，无法确定使用哪一个。`
    return {
      title: `AI 规划引用的来源字段“${leftFieldName}”和“${rightFieldName}”存在冲突`,
      description: `${reason}${actionHint}`,
    }
  }

  if (template.key === 'source-table-missing') {
    const formNames = collectUniqueBusinessTexts(
      diagnostics
        .map(diagnostic => extractMissingSourceFormName(diagnostic.message))
        .filter(name => name && name !== '未命名来源表单'),
    )
    if (!formNames.length) {
      return null
    }
    const actionHint = '请改用其他来源表单，或补充说明数据来源。'
    if (formNames.length > 1) {
      const nodeHint = nodeNames.length ? `涉及节点：${joinBusinessTextList(nodeNames)}。` : ''
      return {
        title: `AI 规划引用了 ${formNames.length} 处不存在的表单`,
        description: `涉及表单：${joinBusinessTextList(formNames)}。${nodeHint}${actionHint}`,
      }
    }
    const formName = formNames[0]
    const reason = nodeName
      ? `AI 规划在“${nodeName}”这一步需要从这张表单获取数据，但当前应用中没有找到它。`
      : 'AI 规划需要从这张表单获取数据，但当前应用中没有找到它。'
    return {
      title: `AI 规划引用了当前应用中不存在的表单“${formName}”`,
      description: `${reason}${actionHint}`,
    }
  }

  const fieldNames = collectUniqueBusinessFieldLabels(
    diagnostics.map(diagnostic => diagnostic.fieldRef?.fieldName || diagnostic.fieldRef?.fieldId),
  )
  const formName = collectBusinessReadableText(diagnostics[0]?.targetFormName)
  const actionHint = '请从下面已有字段中选择替代字段，或补充说明数据来源。'
  if (!fieldNames.length) {
    return {
      title: nodeName
        ? `AI 规划在“${nodeName}”使用的来源字段已不存在`
        : 'AI 规划使用的来源字段已不存在',
      description: `这个字段在当前表单里找不到，可能是表单调整后被改名或删除。${actionHint}`,
    }
  }
  const count = Math.max(countUniqueFlowGroundingDiagnostics(diagnostics), fieldNames.length)

  if (count > 1) {
    const nodeHint = nodeNames.length ? `涉及节点：${joinBusinessTextList(nodeNames)}。` : ''
    return {
      title: `AI 规划引用了 ${count} 处不存在的字段`,
      description: `涉及字段：${joinBusinessTextList(fieldNames)}。${nodeHint}${actionHint}`,
    }
  }

  const fieldName = fieldNames[0]
  const reason = nodeName
    ? `AI 规划在“${nodeName}”这一步需要从该字段获取数据，但当前表单没有这个字段。`
    : 'AI 规划需要从该字段获取数据，但当前表单没有这个字段。'
  return {
    title: formName
      ? `AI 规划引用了表单“${formName}”中没有的字段“${fieldName}”`
      : `AI 规划引用了当前表单中没有的字段“${fieldName}”`,
    description: `${reason}${actionHint}`,
  }
}

const buildFlowGroundingQuestionIdentity = (
  template: FlowGroundingConfirmationTemplate,
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
) => {
  const decisionKey = resolveFlowGroundingDecisionKey(template, diagnostics)
  // owner 分组键含 usage、且不按作用域拆分，id 与作用域都维持原样，避免同分支多个 owner 组撞 id。
  if (!decisionKey) {
    return {
      id: `flow-grounding-${template.key}`,
      scopeKind: 'overview' as const,
    }
  }

  const scopeKey = resolveFlowGroundingDecisionScopeKey(diagnostics)
  const branchKey = scopeKey === FLOW_GROUNDING_GLOBAL_SCOPE_KEY ? '' : scopeKey
  const singleDiagnostic = diagnostics.length === 1 ? diagnostics[0] : null
  const targetFieldName = normalizeText(singleDiagnostic?.fieldRef?.fieldName)
  const targetFieldId = normalizeText(singleDiagnostic?.fieldRef?.fieldId)
  return {
    // global 作用域保持原 id，兼容既有按 id 判断的分支
    id: branchKey
      ? `flow-grounding-${template.key}:${branchKey}`
      : `flow-grounding-${template.key}`,
    scopeKind: branchKey ? 'trigger-branch' as const : 'overview' as const,
    decisionKey,
    ...(branchKey ? { branchKey } : {}),
    ...(singleDiagnostic && (targetFieldId || targetFieldName)
      ? {
        decisionTarget: {
          kind: 'field-source' as const,
          formKey: normalizeText(singleDiagnostic.targetFormId) || undefined,
          formName: normalizeText(singleDiagnostic.targetFormName) || undefined,
          fieldKey: targetFieldId || targetFieldName,
          fieldName: targetFieldName || undefined,
        },
      }
      : {}),
  }
}

const buildFlowGroundingQuestion = (
  template: FlowGroundingConfirmationTemplate,
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
): FlowGroundingQuestion => {
  if (template.capability === 'owner') {
    const ownerLabel = resolveOwnerUsageLabel(diagnostics)
    const countDescription = diagnostics.length > 1
      ? `流程中有 ${diagnostics.length} 处需要一起处理。`
      : ''
    return {
      ...buildFlowGroundingQuestionIdentity(template, diagnostics),
      type: 'single-choice',
      title: `${ownerLabel}来源还需要确认`,
      description: `需要确认流程如何确定${ownerLabel}。${countDescription}`,
      questionKind: 'single_select',
      required: true,
      allowFreeText: true,
      options: buildOwnerQuestionOptions(diagnostics, ownerLabel),
    }
  }

  if (template.capability === 'condition') {
    const narrative = buildConditionFieldQuestionNarrative(template, diagnostics)
    return {
      ...buildFlowGroundingQuestionIdentity(template, diagnostics),
      type: 'single-choice',
      title: narrative?.title || template.title,
      description: narrative?.description || template.description,
      questionKind: 'single_select',
      required: true,
      allowFreeText: true,
      options: [
        ...buildCompatibleConditionFieldOptions(diagnostics),
        ...template.options.map(option => ({ ...option })),
      ],
    }
  }

  if (template.capability === 'source') {
    const narrative = buildSourceFieldQuestionNarrative(template, diagnostics)
    return {
      ...buildFlowGroundingQuestionIdentity(template, diagnostics),
      type: 'single-choice',
      title: narrative?.title || template.title,
      description: narrative?.description || template.description,
      questionKind: 'single_select',
      required: true,
      allowFreeText: true,
      options: [
        ...buildCompatibleSourceFieldOptions(diagnostics),
        ...template.options.map(option => ({ ...option })),
      ],
    }
  }

  return {
    ...buildFlowGroundingQuestionIdentity(template, diagnostics),
    type: 'single-choice',
    title: template.title,
    description: template.description,
    questionKind: 'single_select',
    required: true,
    allowFreeText: true,
    options: template.options.map(option => ({ ...option })),
  }
}

const resolveFlowGroundingGroupKey = (
  template: FlowGroundingConfirmationTemplate | null,
  diagnostic: NocodeEditorFlowSchemeGroundingDiagnostic,
) => {
  if (!template) {
    return 'system-error'
  }

  if (template.capability === 'owner') {
    const state = diagnostic.code === 'grounding_owner_field_forbidden'
      ? 'forbidden'
      : 'missing'
    const usage = isNocodeEditorFlowGroundingOwnerUsage(diagnostic.ownerUsage)
      ? diagnostic.ownerUsage
      : 'generic_owner'

    return `${template.key}-${state}:${usage}`
  }

  const scopeKey = resolveFlowGroundingDecisionScopeKey([diagnostic])
  return scopeKey === FLOW_GROUNDING_GLOBAL_SCOPE_KEY && template.key === 'sequential-write-conflict'
    ? template.key
    : `${template.key}:${scopeKey}`
}

export const buildFlowGroundingIssueGroups = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
): FlowGroundingIssueGroup[] => {
  const groups: FlowGroundingDraftGroup[] = []
  const groupsByKey = new Map<string, FlowGroundingDraftGroup>()

  ;(Array.isArray(diagnostics) ? diagnostics : []).forEach((diagnostic) => {
    const template = resolveFlowGroundingConfirmationTemplate(diagnostic.code)
    const key = resolveFlowGroundingGroupKey(template, diagnostic)
    const existingGroup = groupsByKey.get(key)
    if (existingGroup) {
      existingGroup.diagnostics.push(diagnostic)
      return
    }

    const group = {
      key,
      diagnostics: [diagnostic],
      template,
    }
    groups.push(group)
    groupsByKey.set(key, group)
  })

  return groups.map((group) => {
    if (!group.template) {
      return {
        kind: 'system_error',
        key: group.key,
        diagnostics: group.diagnostics,
        userMessage: FLOW_GROUNDING_SYSTEM_ERROR_USER_MESSAGE,
      }
    }

    return {
      kind: 'confirmation',
      key: group.key,
      diagnostics: group.diagnostics,
      question: buildFlowGroundingQuestion(group.template, group.diagnostics),
    }
  })
}

export const buildFlowGroundingOpenQuestionKey = (
  question: NocodeEditorAiConfirmQuestion,
  index = 0,
) => normalizeText(question?.decisionKey)
  || normalizeText(question?.id)
  || `flow-grounding-confirmation-${index + 1}`

export const projectFlowGroundingQuestions = (
  groups: FlowGroundingIssueGroup[],
): FlowGroundingQuestion[] => (
  (Array.isArray(groups) ? groups : [])
    .filter((group): group is FlowGroundingConfirmationGroup => group.kind === 'confirmation')
    .map(group => group.question)
)

export const buildFlowGroundingConfirmationQuestions = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
): FlowGroundingQuestion[] => (
  projectFlowGroundingQuestions(buildFlowGroundingIssueGroups(diagnostics))
)

export const normalizeVisibleFlowGroundingQuestions = (input: {
  questions: unknown
  diagnostics?: NocodeEditorFlowSchemeGroundingDiagnostic[]
  preferDiagnostics?: boolean
}): NocodeEditorAiConfirmQuestion[] => {
  const rawQuestions = Array.isArray(input.questions) ? input.questions : []
  const diagnostics = Array.isArray(input.diagnostics) ? input.diagnostics : []
  const groupedQuestions = diagnostics.length
    ? projectFlowGroundingQuestions(buildFlowGroundingIssueGroups(diagnostics))
    : []
  const hasTechnicalQuestion = rawQuestions.some(hasTechnicalFlowQuestionText)

  if (input.preferDiagnostics === true && groupedQuestions.length) {
    return groupedQuestions
  }

  if (
    hasTechnicalQuestion
    && groupedQuestions.length
    && (!rawQuestions.length || groupedQuestions.length === rawQuestions.length)
  ) {
    return groupedQuestions
  }

  return rawQuestions.flatMap((question, index) => {
    if (hasTechnicalFlowQuestionText(question) && groupedQuestions.length === 1) {
      return [groupedQuestions[0]]
    }
    const normalized = normalizeVisibleQuestion(question, index)
    return normalized ? [normalized] : []
  })
}

export const buildFlowGroundingBusinessUserMessage = (
  diagnostics: NocodeEditorFlowSchemeGroundingDiagnostic[],
) => {
  const capabilityLabels: Record<FlowGroundingCapability, string> = {
    condition: '条件判断依据',
    write: '写入目标字段',
    source: '数据来源字段或表单',
    owner: '处理人来源',
  }
  const capabilities = new Set<FlowGroundingCapability>()
  ;(Array.isArray(diagnostics) ? diagnostics : []).forEach((diagnostic) => {
    const capability = resolveFlowGroundingConfirmationTemplate(diagnostic.code)?.capability
    if (capability) {
      capabilities.add(capability)
    }
  })

  const labels = [...capabilities].map(capability => capabilityLabels[capability])
  return labels.length
    ? `流程方案还需要补充${labels.join('、')}，请确认后再继续生成流程。`
    : FLOW_GROUNDING_SYSTEM_ERROR_USER_MESSAGE
}
