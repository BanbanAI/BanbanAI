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

export const normalizeText = (value: unknown) => String(value ?? '').trim()

export const containsTechnicalFlowText = (value: unknown) => (
  FLOW_GROUNDING_TECHNICAL_TEXT_PATTERN.test(normalizeText(value))
)

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

const hasTechnicalFlowQuestionText = (value: unknown) => {
  if (typeof value === 'string') {
    return containsTechnicalFlowText(value)
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
  ].some(containsTechnicalFlowText)
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
  title: '流程条件还缺少判断字段',
  description: '需要确认流程应依据哪个业务字段判断后续路径。',
  options: [
    {
      value: 'confirm-condition-source',
      label: '确认判断字段来源',
      description: '说明本次条件应依据哪个业务字段。',
    },
    {
      value: 'choose-another-condition-field',
      label: '改用其他判断字段',
      description: '从已有业务字段中选择更适合的判断依据。',
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
  title: '当前字段不适合用于条件判断',
  description: '需要改用可支持条件判断的业务字段，或调整当前条件设计。',
  options: [
    {
      value: 'confirm-condition-source',
      label: '确认判断字段来源',
      description: '说明本次条件应依据哪个业务字段。',
    },
    {
      value: 'choose-another-condition-field',
      label: '改用其他判断字段',
      description: '从已有业务字段中选择更适合的判断依据。',
    },
    {
      value: 'adjust-condition-design',
      label: '调整条件设计',
      description: '调整当前条件的业务判断方式。',
    },
  ],
}

const writeMissingTemplate: FlowGroundingConfirmationTemplate = {
  key: 'write-field-missing',
  capability: 'write',
  title: '流程写入还缺少目标字段',
  description: '需要确认本次流程写入应保存到哪个业务字段。',
  options: [
    {
      value: 'confirm-write-target',
      label: '确认写入目标字段',
      description: '说明本次流程需要写入哪个业务字段。',
    },
    {
      value: 'choose-another-write-field',
      label: '改用其他写入字段',
      description: '从已有业务字段中选择可用于本次写入的字段。',
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
  title: '当前字段不支持这次写入',
  description: '需要改用支持写入的业务字段，或调整当前写入设计。',
  options: [
    {
      value: 'confirm-write-target',
      label: '确认写入目标字段',
      description: '说明本次流程需要写入哪个业务字段。',
    },
    {
      value: 'choose-another-write-field',
      label: '改用其他写入字段',
      description: '从已有业务字段中选择可用于本次写入的字段。',
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
  title: '数据来源还缺少字段',
  description: '需要确认流程从哪个业务字段获取数据。',
  options: [
    {
      value: 'confirm-source-field',
      label: '确认数据来源字段',
      description: '说明本次流程需要使用哪个数据来源字段。',
    },
    {
      value: 'choose-another-source-field',
      label: '改用其他来源字段',
      description: '从已有业务字段中选择可用的数据来源。',
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
  title: '当前数据来源字段存在冲突',
  description: '需要确认本次流程应使用哪一个数据来源字段。',
  options: [
    {
      value: 'confirm-source-field',
      label: '确认数据来源字段',
      description: '说明本次流程需要使用哪个数据来源字段。',
    },
    {
      value: 'choose-another-source-field',
      label: '改用其他来源字段',
      description: '从已有业务字段中选择可用的数据来源。',
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
  title: '数据来源还缺少表单',
  description: '需要确认流程从哪张业务表单获取数据。',
  options: [
    {
      value: 'confirm-source-table',
      label: '确认数据来源表单',
      description: '说明本次流程需要使用哪张业务表单。',
    },
    {
      value: 'choose-another-source-table',
      label: '改用其他来源表单',
      description: '从已有表单中选择可用的数据来源。',
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
      id: `flow-grounding-${template.key}`,
      type: 'single-choice',
      title: `${ownerLabel}来源还需要确认`,
      description: `需要确认流程如何确定${ownerLabel}。${countDescription}`,
      questionKind: 'single_select',
      scopeKind: 'overview',
      required: true,
      allowFreeText: true,
      options: buildOwnerQuestionOptions(diagnostics, ownerLabel),
    }
  }

  return {
    id: `flow-grounding-${template.key}`,
    type: 'single-choice',
    title: template.title,
    description: template.description,
    questionKind: 'single_select',
    scopeKind: 'overview',
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

  if (template.capability !== 'owner') {
    return template.key
  }

  const state = diagnostic.code === 'grounding_owner_field_forbidden'
    ? 'forbidden'
    : 'missing'
  const usage = isNocodeEditorFlowGroundingOwnerUsage(diagnostic.ownerUsage)
    ? diagnostic.ownerUsage
    : 'generic_owner'

  return `${template.key}-${state}:${usage}`
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
