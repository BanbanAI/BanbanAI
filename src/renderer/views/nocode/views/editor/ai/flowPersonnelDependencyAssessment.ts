import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDeferredConfigItem,
  NocodeEditorFlowSchemeDependency,
  NocodeEditorFlowSchemeStep,
} from '@common/utils/nocodeEditorFlowScheme'
import {
  inferFlowPersonnelDecision,
  resolveFlowDependencyPersonnelDecision,
} from '@common/utils/nocodeEditorFlowDecisionIdentity'
import type {
  NocodeEditorFlowPersonnelRef,
  NocodeEditorFlowPersonnelRequirement,
} from '@common/utils/nocodeEditorFlowPersonnel'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFlowPersonnelSourceEvidence,
} from '@common/utils/nocodeEditorFlowPersonnelSourceAnchor'
import {
  decorateFlowSchemeWithConvergence,
  mergeDeferredConfigItems,
} from './flowSchemeConvergence'

export type FlowPersonnelDependencyDisposition =
  | 'resolved'
  | 'materialize_before_apply'
  | 'defer_after_generation'
  | 'block'

export type FlowPersonnelDependencyAssessment = {
  nodeKey: string
  nodeTitle: string
  requiredFor: 'approval_owner' | 'owner_binding' | 'notify_target'
  disposition: FlowPersonnelDependencyDisposition
  issueCode?: string
  missingLabels: string[]
  summary: string
}

type UnknownRecord = Record<string, unknown>

type PersonnelObject = {
  id: string
  name: string
}

type SummaryField = {
  fieldId: string
  fieldName: string
  ownerPolicy: string
  isMemberField: boolean
  isDepartmentField: boolean
}

type SummaryForm = {
  tableId: string
  tableName: string
  fields: SummaryField[]
}

type AssessmentProjection = {
  assessment: FlowPersonnelDependencyAssessment
  dependency?: NocodeEditorFlowSchemeDependency
  deferredConfigItem?: NocodeEditorFlowSchemeDeferredConfigItem
}

const PERSONNEL_STEP_METADATA: Partial<Record<NocodeEditorFlowSchemeStep['kind'], {
  requiredFor: FlowPersonnelDependencyAssessment['requiredFor']
  issueCode: string
  ownerSettingKey: string
}>> = {
  approval: {
    requiredFor: 'approval_owner',
    issueCode: 'approval_approver_missing',
    ownerSettingKey: 'approver',
  },
  transact: {
    requiredFor: 'owner_binding',
    issueCode: 'transact_transactor_missing',
    ownerSettingKey: 'transactor',
  },
  notify: {
    requiredFor: 'notify_target',
    issueCode: 'notify_notifier_missing',
    ownerSettingKey: 'notifier',
  },
  'report-data': {
    requiredFor: 'owner_binding',
    issueCode: 'report_data_reporter_missing',
    ownerSettingKey: 'reporter',
  },
}

const FALLBACK_ISSUE_CODES = {
  approval: {
    admin: 'approval_empty_handler_admin_missing',
    fixed_users: 'approval_empty_handler_user_missing',
  },
  transact: {
    admin: 'transact_empty_handler_admin_missing',
    fixed_users: 'transact_empty_handler_user_missing',
  },
  'report-data': {
    admin: 'report_data_reporter_empty_admin_missing',
    fixed_users: 'report_data_reporter_empty_user_missing',
  },
} as const

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeName = (value: unknown) => normalizeText(value)
  .normalize('NFKC')
  .replace(/[\s_.-]+/g, '')
  .toLocaleLowerCase()

const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
)

const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : []

const normalizePersonnelObjects = (value: unknown): PersonnelObject[] => (
  asArray(value).flatMap((item) => {
    const record = asRecord(item)
    const id = normalizeText(record.id)
    const name = normalizeText(record.name)
    return id || name ? [{ id, name }] : []
  })
)

const normalizeSummaryField = (value: unknown): SummaryField | null => {
  const record = asRecord(value)
  const fieldId = normalizeText(record.fieldId || record.uid || record.id)
  const fieldName = normalizeText(record.fieldName || record.name || record.label)
  if (!fieldId && !fieldName) {
    return null
  }
  return {
    fieldId,
    fieldName,
    ownerPolicy: normalizeText(record.ownerPolicy),
    isMemberField: record.isMemberField === true,
    isDepartmentField: record.isDepartmentField === true,
  }
}

const normalizeSummaryForm = (value: unknown): SummaryForm | null => {
  const record = asRecord(value)
  const tableId = normalizeText(record.tableId || record.uid || record.id)
  const tableName = normalizeText(record.tableName || record.name || record.alias)
  if (!tableId && !tableName) {
    return null
  }
  const fieldValues = [
    ...asArray(record.fields),
    ...asArray(record.memberFields),
    ...asArray(record.departmentFields),
  ]
  const fields = fieldValues
    .map(item => normalizeSummaryField(item))
    .filter((item): item is SummaryField => Boolean(item))
    .filter((item, index, items) => items.findIndex(candidate => (
      (item.fieldId && candidate.fieldId === item.fieldId)
      || (!item.fieldId && normalizeName(candidate.fieldName) === normalizeName(item.fieldName))
    )) === index)
  return { tableId, tableName, fields }
}

const getSummaryEvidence = (flowSummary: unknown) => {
  const summary = asRecord(flowSummary)
  const organization = asRecord(summary.organization)
  const forms = asRecord(summary.forms)
  const currentForm = normalizeSummaryForm(forms.currentForm)
  const availableForms = asArray(forms.availableForms)
    .map(item => normalizeSummaryForm(item))
    .filter((item): item is SummaryForm => Boolean(item))
  return {
    summary,
    users: normalizePersonnelObjects(organization.users),
    roles: normalizePersonnelObjects(organization.roles),
    forms: [
      ...(currentForm ? [currentForm] : []),
      ...availableForms,
    ],
    currentForm,
  }
}

// 人员来源锚定所需的最小证据投影：组织角色/成员名（→ 指定成员/角色）
// 与当前表单的成员/部门字段名（→ 表单内成员/部门字段），供派生题与模型题统一标注推荐来源。
export const resolveNocodeEditorFlowPersonnelSourceEvidence = (
  flowSummary: unknown,
): NocodeEditorFlowPersonnelSourceEvidence | null => {
  if (!flowSummary) {
    return null
  }
  const evidence = getSummaryEvidence(flowSummary)
  const formFields = evidence.currentForm?.fields || []
  const memberFieldNames = formFields
    .filter(field => field.isMemberField === true || field.ownerPolicy === 'member')
    .map(field => field.fieldName)
    .filter(Boolean)
  const departmentFieldNames = formFields
    .filter(field => field.isDepartmentField === true || field.ownerPolicy === 'department')
    .map(field => field.fieldName)
    .filter(Boolean)
  const roles = evidence.roles.filter(item => item.name)
  const users = evidence.users.filter(item => item.name)
  if (!roles.length && !users.length && !memberFieldNames.length && !departmentFieldNames.length) {
    return null
  }
  return { roles, users, memberFieldNames, departmentFieldNames }
}

export type FlowPersonnelCandidateDiagnostic = {
  questionId: string
  decisionKey?: string
  stepKey: string
  optionValue: string
  message: string
}

export const validateFlowPersonnelConfirmationCandidates = (input: {
  scheme: NocodeEditorFlowScheme
  confirmation?: NocodeEditorAiConfirmPayload | null
  flowSummary?: unknown
}): FlowPersonnelCandidateDiagnostic[] => {
  const confirmation = input.confirmation
  if (!confirmation || !Array.isArray(confirmation.questions)) {
    return []
  }
  const evidence = getSummaryEvidence(input.flowSummary)
  const diagnostics: FlowPersonnelCandidateDiagnostic[] = []
  const hasEvidence = Boolean(input.flowSummary)
  const steps = new Map(getStepList(input.scheme).map(step => [step.key, step]))
  const addDiagnostic = (question: typeof confirmation.questions[number], optionValue: string, message: string) => {
    diagnostics.push({
      questionId: question.id,
      decisionKey: question.decisionKey,
      stepKey: question.personnelDecision?.stepKey || '',
      optionValue,
      message,
    })
  }

  confirmation.questions.forEach((question) => {
    const personnelDecision = question.personnelDecision
    if (!personnelDecision) {
      return
    }
    const step = steps.get(personnelDecision.stepKey)
    if (!step || !PERSONNEL_STEP_METADATA[step.kind]) {
      addDiagnostic(question, '', `确认题“${question.title}”引用了不存在或无需设置人员的流程步骤`)
      return
    }
    if (personnelDecision.slot === 'approval_level' || personnelDecision.slot === 'multi_person' || personnelDecision.slot === 'same_as_submitter') {
      if (step.kind !== 'approval') {
        addDiagnostic(question, '', `确认题“${question.title}”的审批专属设置不适用于${step.title}`)
      }
      return
    }
    if (personnelDecision.slot !== 'source' && personnelDecision.slot !== 'binding') {
      return
    }
    if (!Array.isArray(question.options)) {
      return
    }
    question.options.forEach((option) => {
      const candidate = option.personnelCandidate
      if (!candidate) {
        addDiagnostic(question, option.value, `确认题“${question.title}”的选项“${option.label}”缺少人员来源和证据状态`)
        return
      }
      const refId = normalizeText(candidate.refId)
      const refName = normalizeText(candidate.refName)
      const selected = question.confirmed === true && (
        option.selected === true || option.value === question.selectedOptionValue
      )
      const isConcreteSource = ['fixed_users', 'fixed_roles', 'form_member', 'form_department'].includes(candidate.sourceType)
      if (candidate.status === 'planned') {
        if (!refName || refId) {
          addDiagnostic(question, option.value, `确认题“${question.title}”的待补配置选项需要明确名称，且不能伪装成已有 ID`)
        }
        return
      }
      if (candidate.status === 'supported') {
        // Selecting a source type does not require binding its concrete owners yet.
        // Fixed owners, form member fields, form department fields and manager rules
        // are tracked as follow-up decisions after generation; runtime capability gaps
        // are registered as deferred config items by the personnel dependency assessment.
        const isDeferredSourceType = personnelDecision.slot === 'source'
          && [
            'fixed_users',
            'fixed_roles',
            'form_member',
            'form_department',
            'submitter_manager',
            'department_manager',
          ].includes(candidate.sourceType)
          && !refId && !refName
        if (isDeferredSourceType) {
          return
        }
        if (isConcreteSource || refId || refName) {
          addDiagnostic(question, option.value, `确认题“${question.title}”不能将未验证的具体人员、角色或字段标成 supported；来源类型选项仅限 source 槽且不能携带具体引用`)
        } else if (selected && candidate.sourceType !== 'submitter' && (!hasEvidence || !supportsManagerSource(evidence.summary, step))) {
          addDiagnostic(question, option.value, `确认题“${question.title}”的动态人员规则缺少当前节点的能力证据`)
        }
        return
      }
      if (!isConcreteSource || !refId) {
        addDiagnostic(question, option.value, `确认题“${question.title}”的已有对象选项需要真实 ID`)
        return
      }
      if (!hasEvidence) {
        if (selected) {
          addDiagnostic(question, option.value, `确认题“${question.title}”的已选对象缺少当前项目证据`)
        }
        return
      }
      const matched = candidate.sourceType === 'fixed_users'
        ? evidence.users.some(item => item.id === refId)
        : candidate.sourceType === 'fixed_roles'
          ? evidence.roles.some(item => item.id === refId)
          : Boolean(evidence.currentForm?.fields.some(field => (
            field.fieldId === refId
            && isCompatibleOwnerField(field, candidate.sourceType === 'form_member' ? 'form_member' : 'form_department')
          )))
      if (!matched) {
        addDiagnostic(question, option.value, `确认题“${question.title}”的选项“${option.label}”未在当前项目证据中找到对应人员、角色或兼容字段`)
      }
    })
  })
  return diagnostics
}

const getStepList = (scheme: NocodeEditorFlowScheme) => [
  ...(Array.isArray(scheme.mainPath) ? scheme.mainPath : []),
  ...(Array.isArray(scheme.branches)
    ? scheme.branches.flatMap(branch => Array.isArray(branch.steps) ? branch.steps : [])
    : []),
]

export const assertUniqueFlowSchemeStepKeys = (
  scheme: NocodeEditorFlowScheme,
) => {
  const firstLocationByKey = new Map<string, string>()
  const stepEntries = [
    ...(scheme.mainPath || []).map((step, index) => ({
      step,
      location: `mainPath[${index}]`,
    })),
    ...(scheme.branches || []).flatMap((branch, branchIndex) => (
      (branch.steps || []).map((step, stepIndex) => ({
        step,
        location: `branches[${branchIndex}].steps[${stepIndex}]`,
      }))
    )),
  ]

  stepEntries.forEach(({ step, location }) => {
    const key = normalizeText(step.key)
    const firstLocation = firstLocationByKey.get(key)
    if (firstLocation) {
      throw new Error(`流程步骤 key“${key}”重复：${firstLocation} 与 ${location}`)
    }
    firstLocationByKey.set(key, location)
  })
}

export const hasFlowSchemePersonnelRequirements = (
  scheme: NocodeEditorFlowScheme,
) => getStepList(scheme).some((step) => {
  if (!PERSONNEL_STEP_METADATA[step.kind] || !step.personnelRequirement) {
    return false
  }
  const { sourceType, emptyHandler } = step.personnelRequirement
  const primaryNeedsEvidence = [
    'fixed_users',
    'fixed_roles',
    'form_member',
    'form_department',
    'submitter_manager',
    'department_manager',
  ].includes(sourceType)
  const fallbackNeedsEvidence = emptyHandler?.mode === 'admin'
    || emptyHandler?.mode === 'fixed_users'
  return primaryNeedsEvidence || fallbackNeedsEvidence
})

const getMissingRefLabels = (
  refs: NocodeEditorFlowPersonnelRef[] | undefined,
  objects: PersonnelObject[],
  fallbackLabel: string,
) => {
  const normalizedRefs = Array.isArray(refs)
    ? refs.filter(ref => normalizeText(ref?.id) || normalizeText(ref?.name))
    : []
  if (!normalizedRefs.length) {
    return [fallbackLabel]
  }
  return normalizedRefs.flatMap((ref) => {
    const id = normalizeText(ref.id)
    const name = normalizeName(ref.name)
    const matched = Boolean(
      (id && objects.some(item => item.id === id))
      || (name && objects.some(item => normalizeName(item.name) === name)),
    )
    return matched ? [] : [normalizeText(ref.name) || id || fallbackLabel]
  })
}

const getAssessmentBase = (
  step: NocodeEditorFlowSchemeStep,
  disposition: FlowPersonnelDependencyDisposition,
  summary: string,
  missingLabels: string[],
  issueCode?: string,
): FlowPersonnelDependencyAssessment => ({
  nodeKey: step.key,
  nodeTitle: step.title,
  requiredFor: PERSONNEL_STEP_METADATA[step.kind]!.requiredFor,
  disposition,
  ...(issueCode ? { issueCode } : {}),
  missingLabels,
  summary,
})

const buildBlockingDependency = (input: {
  step: NocodeEditorFlowSchemeStep
  assessment: FlowPersonnelDependencyAssessment
  suffix: string
  kind: NocodeEditorFlowSchemeDependency['kind']
  targetForm?: SummaryForm | null
  fieldRef?: NocodeEditorFlowSchemeDependency['fieldRef']
}): NocodeEditorFlowSchemeDependency => {
  const personnelDecision = resolvePersonnelDependencyDecision(input)
  return {
    id: `flow-personnel:${input.step.key}:${input.suffix}`,
    ...(personnelDecision
      ? {
        personnelDecision,
        decisionKey: personnelDecision.slot === 'source'
            && input.assessment.requiredFor === 'approval_owner'
          ? 'flow.approval.owner'
          : `flow.personnel:${personnelDecision.stepKey}:${personnelDecision.slot}`,
      }
      : {}),
    kind: input.kind,
    requiredFor: input.assessment.requiredFor,
    scopeKind: 'step',
    scopeKey: input.step.key,
    scopeTitle: input.step.title,
    ...(input.targetForm?.tableId ? { targetFormId: input.targetForm.tableId } : {}),
    ...(input.targetForm?.tableName ? { targetFormName: input.targetForm.tableName } : {}),
    ...(input.fieldRef ? { fieldRef: input.fieldRef } : {}),
    riskLevel: 'high',
    resolutionStatus: 'unresolved',
    materializationStatus: 'not_available',
    summary: input.assessment.summary,
  }
}

const PERSONNEL_DEPENDENCY_SLOT_BY_SUFFIX = {
  source: 'source',
  level: 'approval_level',
  field: 'binding',
  fallback: 'empty_handler',
} as const

const resolvePersonnelDependencyDecision = (input: {
  step: NocodeEditorFlowSchemeStep
  suffix: string
}): NonNullable<NocodeEditorFlowSchemeDependency['personnelDecision']> | null => {
  const slot = PERSONNEL_DEPENDENCY_SLOT_BY_SUFFIX[
    input.suffix as keyof typeof PERSONNEL_DEPENDENCY_SLOT_BY_SUFFIX
  ]
  return slot ? { stepKey: input.step.key, slot } : null
}

const buildPlannedFieldDependency = (input: {
  step: NocodeEditorFlowSchemeStep
  assessment: FlowPersonnelDependencyAssessment
  targetForm: SummaryForm | null
  fieldRef: NonNullable<NocodeEditorFlowPersonnelRequirement['fieldRef']>
}): NocodeEditorFlowSchemeDependency => ({
  id: `flow-personnel:${input.step.key}:field`,
  kind: 'field_missing',
  requiredFor: input.assessment.requiredFor,
  scopeKind: 'step',
  scopeKey: input.step.key,
  scopeTitle: input.step.title,
  ...(input.targetForm?.tableId ? { targetFormId: input.targetForm.tableId } : {}),
  ...(input.targetForm?.tableName ? { targetFormName: input.targetForm.tableName } : {}),
  fieldRef: {
    ...(normalizeText(input.fieldRef.fieldId) ? { fieldId: normalizeText(input.fieldRef.fieldId) } : {}),
    ...(normalizeText(input.fieldRef.fieldName) ? { fieldName: normalizeText(input.fieldRef.fieldName) } : {}),
    expectedType: normalizeText(input.fieldRef.expectedType),
  },
  riskLevel: 'low',
  resolutionStatus: 'resolved',
  resolutionMode: 'create_later',
  materializationStatus: 'planned',
  summary: input.assessment.summary,
})

const buildExistingFieldDependency = (input: {
  step: NocodeEditorFlowSchemeStep
  assessment: FlowPersonnelDependencyAssessment
  targetForm: SummaryForm
  field: SummaryField
  sourceType: 'form_member' | 'form_department'
}): NocodeEditorFlowSchemeDependency => ({
  id: `flow-personnel:${input.step.key}:field`,
  kind: 'field_missing',
  requiredFor: input.assessment.requiredFor,
  scopeKind: 'step',
  scopeKey: input.step.key,
  scopeTitle: input.step.title,
  ...(input.targetForm.tableId ? { targetFormId: input.targetForm.tableId } : {}),
  ...(input.targetForm.tableName ? { targetFormName: input.targetForm.tableName } : {}),
  fieldRef: {
    fieldId: input.field.fieldId,
    fieldName: input.field.fieldName,
    expectedType: input.sourceType === 'form_member' ? 'memberSelect' : 'departmentSelect',
  },
  riskLevel: 'low',
  resolutionStatus: 'resolved',
  resolutionMode: 'use_existing',
  materializationStatus: 'existing',
  summary: input.assessment.summary,
})

const buildDeferredConfigItem = (
  step: NocodeEditorFlowSchemeStep,
  assessment: FlowPersonnelDependencyAssessment,
  category: NocodeEditorFlowSchemeDeferredConfigItem['category'],
  supportStatus: NocodeEditorFlowSchemeDeferredConfigItem['supportStatus'] = 'runtime_supported',
) => ({
  id: `flow-deferred:personnel:${step.key}:${assessment.issueCode}`,
  nodeKey: step.key,
  nodeTitle: step.title,
  // 延期项的能力验证按 (category, settingPath) 对照运行时注册表，
  // 兜底配置归属 options.emptyHandler，不能沿用节点 owner 设置路径。
  settingPath: category === 'fallback_handler' ? 'options.emptyHandler'
    : step.kind === 'approval' ? 'options.approver'
      : step.kind === 'transact' ? 'options.transactor'
        : step.kind === 'notify' ? 'options.notifier' : 'options.reporter',
  category,
  requirementLevel: 'required' as const,
  supportStatus,
  summary: assessment.summary,
  fillTiming: 'after_generation' as const,
  severity: category === 'fallback_handler' ? 'medium' as const : 'high' as const,
  relatedIssueCodes: assessment.issueCode ? [assessment.issueCode] : [],
})

const resolveTargetForm = (
  scheme: NocodeEditorFlowScheme,
  forms: SummaryForm[],
  currentForm: SummaryForm | null,
) => {
  const targetId = normalizeText(scheme.target?.formId)
  const targetName = normalizeName(scheme.target?.formName)
  if (targetId || targetName) {
    return forms.find(form => targetId && form.tableId === targetId)
      || forms.find(form => targetName && normalizeName(form.tableName) === targetName)
      || null
  }
  return currentForm || forms[0] || null
}

const findField = (
  form: SummaryForm | null,
  fieldRef: NonNullable<NocodeEditorFlowPersonnelRequirement['fieldRef']>,
) => {
  if (!form) {
    return null
  }
  const fieldId = normalizeText(fieldRef.fieldId)
  const fieldName = normalizeName(fieldRef.fieldName)
  return form.fields.find(field => fieldId && field.fieldId === fieldId)
    || form.fields.find(field => fieldName && normalizeName(field.fieldName) === fieldName)
    || null
}

const isCompatibleOwnerField = (
  field: SummaryField,
  sourceType: 'form_member' | 'form_department',
) => sourceType === 'form_member'
  ? field.ownerPolicy === 'member' || field.isMemberField
  : field.ownerPolicy === 'department' || field.isDepartmentField

const supportsManagerSource = (
  flowSummary: UnknownRecord,
  step: NocodeEditorFlowSchemeStep,
) => {
  const availableFlowNodes = asRecord(flowSummary.availableFlowNodes)
  const nodeType = asArray(availableFlowNodes.nodeTypes).find((item) => {
    const record = asRecord(item)
    return normalizeName(record.type) === normalizeName(step.kind)
  })
  if (!nodeType) {
    return false
  }
  const metadata = PERSONNEL_STEP_METADATA[step.kind]!
  const nodeRecord = asRecord(nodeType)
  const ownerSetting = asArray(nodeRecord.keySettings).find((item) => (
    normalizeName(asRecord(item).key) === normalizeName(metadata.ownerSettingKey)
  ))
  const capabilityText = JSON.stringify({
    supportedPersonnelSources: nodeRecord.supportedPersonnelSources,
    personnelSources: nodeRecord.personnelSources,
    ownerSourceTypes: nodeRecord.ownerSourceTypes,
    capabilities: nodeRecord.capabilities,
    ownerSetting,
  }).toLocaleLowerCase()
  return capabilityText.includes('submitter_manager')
    || capabilityText.includes('department_manager')
    || capabilityText.includes('departmentmanager')
    || capabilityText.includes('部门主管')
    || capabilityText.includes('部门负责人')
}

const assessFixedSource = (input: {
  step: NocodeEditorFlowSchemeStep
  objects: PersonnelObject[]
  refs: NocodeEditorFlowPersonnelRef[] | undefined
  objectLabel: string
}) => {
  const metadata = PERSONNEL_STEP_METADATA[input.step.kind]!
  const missingLabels = getMissingRefLabels(input.refs, input.objects, `指定${input.objectLabel}`)
  if (!missingLabels.length) {
    return {
      assessment: getAssessmentBase(input.step, 'resolved', `${input.step.title}的${input.objectLabel}已匹配`, []),
    } satisfies AssessmentProjection
  }
  const summary = missingLabels[0] === `指定${input.objectLabel}`
    ? `${input.step.title}尚未指定${input.objectLabel}，需在流程生成后补齐`
    : `${input.step.title}引用的${input.objectLabel}“${missingLabels.join('、')}”当前不存在，需在流程生成后补齐`
  const assessment = getAssessmentBase(
    input.step,
    'defer_after_generation',
    summary,
    missingLabels,
    metadata.issueCode,
  )
  return {
    assessment,
    deferredConfigItem: buildDeferredConfigItem(input.step, assessment, 'owner_binding'),
  } satisfies AssessmentProjection
}

const assessFormSource = (input: {
  scheme: NocodeEditorFlowScheme
  step: NocodeEditorFlowSchemeStep
  requirement: NocodeEditorFlowPersonnelRequirement
  forms: SummaryForm[]
  currentForm: SummaryForm | null
}) => {
  const metadata = PERSONNEL_STEP_METADATA[input.step.kind]!
  const fieldRef = input.requirement.fieldRef || { expectedType: input.requirement.sourceType === 'form_member' ? 'memberSelect' : 'departmentSelect' }
  const targetForm = resolveTargetForm(input.scheme, input.forms, input.currentForm)
  const fieldName = normalizeText(fieldRef.fieldName)
  const fieldId = normalizeText(fieldRef.fieldId)
  if (!targetForm) {
    const targetLabel = normalizeText(input.scheme.target?.formName || input.scheme.target?.formId) || '目标表单'
    const assessment = getAssessmentBase(
      input.step,
      'block',
      `${input.step.title}的目标表单“${targetLabel}”当前不存在`,
      [targetLabel],
      metadata.issueCode,
    )
    return {
      assessment,
      dependency: buildBlockingDependency({
        step: input.step,
        assessment,
        suffix: 'field',
        kind: 'source_table_missing',
        fieldRef,
      }),
    } satisfies AssessmentProjection
  }

  const field = findField(targetForm, fieldRef)
  if (!field) {
    const fieldOnOtherForm = input.forms
      .filter(form => form !== targetForm)
      .find(form => findField(form, fieldRef))
    if (fieldOnOtherForm) {
      const label = fieldName || fieldId || '人员字段'
      const assessment = getAssessmentBase(
        input.step,
        'block',
        `${input.step.title}引用的字段“${label}”不属于目标表单“${targetForm.tableName || targetForm.tableId}”`,
        [label],
        metadata.issueCode,
      )
      return {
        assessment,
        dependency: buildBlockingDependency({
          step: input.step,
          assessment,
          suffix: 'field',
          kind: 'mapping_conflict',
          targetForm,
          fieldRef,
        }),
      } satisfies AssessmentProjection
    }
    if (fieldName) {
      const assessment = getAssessmentBase(
        input.step,
        'materialize_before_apply',
        `${input.step.title}所需的人员字段“${fieldName}”将在应用流程前创建`,
        [fieldName],
        metadata.issueCode,
      )
      return {
        assessment,
        dependency: buildPlannedFieldDependency({
          step: input.step,
          assessment,
          targetForm,
          fieldRef,
        }),
      } satisfies AssessmentProjection
    }
    const label = fieldId || '人员字段'
    const assessment = getAssessmentBase(
      input.step,
      'block',
      `${input.step.title}引用的人员字段尚未明确`,
      [label],
      metadata.issueCode,
    )
    return {
      assessment,
      dependency: buildBlockingDependency({
        step: input.step,
        assessment,
        suffix: 'field',
        kind: 'field_missing',
        targetForm,
        fieldRef,
      }),
    } satisfies AssessmentProjection
  }

  const sourceType = input.requirement.sourceType as 'form_member' | 'form_department'
  if (!isCompatibleOwnerField(field, sourceType)) {
    const label = field.fieldName || field.fieldId
    const assessment = getAssessmentBase(
      input.step,
      'block',
      `${input.step.title}引用的字段“${label}”不支持当前人员来源策略`,
      [label],
      metadata.issueCode,
    )
    return {
      assessment,
      dependency: buildBlockingDependency({
        step: input.step,
        assessment,
        suffix: 'field',
        kind: 'field_policy_mismatch',
        targetForm,
        fieldRef,
      }),
    } satisfies AssessmentProjection
  }

  const assessment = getAssessmentBase(
    input.step,
    'resolved',
    `${input.step.title}的人员字段已匹配`,
    [],
  )
  return {
    assessment,
    dependency: buildExistingFieldDependency({
      step: input.step,
      assessment,
      targetForm,
      field,
      sourceType,
    }),
  } satisfies AssessmentProjection
}

const assessPrimaryRequirement = (input: {
  scheme: NocodeEditorFlowScheme
  step: NocodeEditorFlowSchemeStep
  evidence: ReturnType<typeof getSummaryEvidence>
}): AssessmentProjection => {
  const metadata = PERSONNEL_STEP_METADATA[input.step.kind]!
  const requirement = input.step.personnelRequirement
  if (!requirement || requirement.sourceType === 'unresolved') {
    const assessment = getAssessmentBase(
      input.step,
      'block',
      `${input.step.title}的人员来源尚未确定`,
      ['人员来源'],
      metadata.issueCode,
    )
    return {
      assessment,
      dependency: buildBlockingDependency({
        step: input.step,
        assessment,
        suffix: 'source',
        kind: 'org_anchor_missing',
      }),
    }
  }

  if (requirement.sourceType === 'fixed_users') {
    return assessFixedSource({
      step: input.step,
      objects: input.evidence.users,
      refs: requirement.userRefs,
      objectLabel: '固定人员',
    })
  }
  if (requirement.sourceType === 'fixed_roles') {
    return assessFixedSource({
      step: input.step,
      objects: input.evidence.roles,
      refs: requirement.roleRefs,
      objectLabel: '固定角色',
    })
  }
  if (requirement.sourceType === 'form_member' || requirement.sourceType === 'form_department') {
    return assessFormSource({
      scheme: input.scheme,
      step: input.step,
      requirement,
      forms: input.evidence.forms,
      currentForm: input.evidence.currentForm,
    })
  }
  if (requirement.sourceType === 'submitter') {
    return {
      assessment: getAssessmentBase(input.step, 'resolved', `${input.step.title}使用提交人作为人员来源`, []),
    }
  }

  if (
    requirement.sourceType === 'department_manager'
    && !requirement.departmentManager
  ) {
    const assessment = getAssessmentBase(
      input.step,
      'block',
      `${input.step.title}的部门主管层级尚未确定`,
      ['部门主管层级'],
      metadata.issueCode,
    )
    return {
      assessment,
      // 来源已确定为部门主管，缺失的是层级；派生题必须按层级问题收敛，
      // 不能复用 :source 后缀被派生成“请选择来源”的五选项来源题。
      dependency: buildBlockingDependency({
        step: input.step,
        assessment,
        suffix: 'level',
        kind: 'org_anchor_missing',
      }),
    }
  }

  if (supportsManagerSource(input.evidence.summary, input.step)) {
    return {
      assessment: getAssessmentBase(input.step, 'resolved', `${input.step.title}的经理人员语义已受运行时支持`, []),
    }
  }
  const assessment = getAssessmentBase(
    input.step,
    'defer_after_generation',
    `${input.step.title}所需的经理人员语义当前不受运行时支持`,
    ['经理人员语义'],
    metadata.issueCode,
  )
  return {
    assessment,
    deferredConfigItem: buildDeferredConfigItem(
      input.step,
      assessment,
      'owner_binding',
      'needs_runtime_support',
    ),
  }
}

const assessFallbackRequirement = (input: {
  step: NocodeEditorFlowSchemeStep
  evidence: ReturnType<typeof getSummaryEvidence>
}): AssessmentProjection | null => {
  const requirement = input.step.personnelRequirement
  const emptyHandler = requirement?.emptyHandler
  const issueCodes = FALLBACK_ISSUE_CODES[input.step.kind as keyof typeof FALLBACK_ISSUE_CODES]
  if (!emptyHandler || !issueCodes || emptyHandler.mode === 'none' || emptyHandler.mode === 'auto_approve') {
    return null
  }
  const requiredFor = PERSONNEL_STEP_METADATA[input.step.kind]!.requiredFor
  if (emptyHandler.mode === 'admin') {
    if (input.evidence.users.length > 0) {
      return {
        assessment: {
          nodeKey: input.step.key,
          nodeTitle: input.step.title,
          requiredFor,
          disposition: 'resolved',
          missingLabels: [],
          summary: `${input.step.title}的管理员兜底对象可由运行时解析`,
        },
      }
    }
    const assessment = getAssessmentBase(
      input.step,
      'defer_after_generation',
      `${input.step.title}的管理员兜底对象当前不存在，需在流程生成后补齐`,
      ['管理员'],
      issueCodes.admin,
    )
    return {
      assessment,
      deferredConfigItem: buildDeferredConfigItem(input.step, assessment, 'fallback_handler'),
    }
  }
  if (emptyHandler.mode === 'fixed_users') {
    const missingLabels = getMissingRefLabels(emptyHandler.userRefs, input.evidence.users, '指定兜底人员')
    if (!missingLabels.length) {
      return {
        assessment: getAssessmentBase(input.step, 'resolved', `${input.step.title}的指定兜底人员已匹配`, []),
      }
    }
    const summary = missingLabels[0] === '指定兜底人员'
      ? `${input.step.title}尚未指定兜底人员，需在流程生成后补齐`
      : `${input.step.title}的兜底人员“${missingLabels.join('、')}”当前不存在，需在流程生成后补齐`
    const assessment = getAssessmentBase(
      input.step,
      'defer_after_generation',
      summary,
      missingLabels,
      issueCodes.fixed_users,
    )
    return {
      assessment,
      deferredConfigItem: buildDeferredConfigItem(input.step, assessment, 'fallback_handler'),
    }
  }

  // 兜底人员来源未确定（unresolved）时不追问：直接沿用节点人员默认值
  // （审批为自动通过、办理为转交管理员、填报为指定人员），与手动新增节点一致。
  return null
}

export const assessFlowSchemePersonnelDependencies = (input: {
  scheme: NocodeEditorFlowScheme
  flowSummary?: unknown
}) => {
  assertUniqueFlowSchemeStepKeys(input.scheme)
  const evidence = getSummaryEvidence(input.flowSummary)
  const projections = getStepList(input.scheme).flatMap((step) => {
    if (!PERSONNEL_STEP_METADATA[step.kind]) {
      return []
    }
    const primary = assessPrimaryRequirement({ scheme: input.scheme, step, evidence })
    const fallback = assessFallbackRequirement({ step, evidence })
    return fallback ? [primary, fallback] : [primary]
  })
  const personnelDependencies = projections.flatMap(item => item.dependency ? [item.dependency] : [])
  const existingDependencies = Array.isArray(input.scheme.dependencies)
    ? input.scheme.dependencies.filter(item => !normalizeText(item.id).startsWith('flow-personnel:'))
    : []
  // kind 只是问题归类，不是依赖身份；同一 (requiredFor, scope, target, fieldRef) 上
  // 模型自写依赖与系统评估依赖必须视为同一条，否则下游解析器会因“多个 step 依赖”放弃解析。
  const getPersonnelDependencySemanticKey = (dependency: NocodeEditorFlowSchemeDependency) => [
    normalizeText(dependency.requiredFor),
    normalizeText(dependency.scopeKind),
    normalizeText(dependency.scopeKey),
    normalizeText(dependency.targetFormId || input.scheme.target?.formId),
    normalizeText(dependency.targetFormName || input.scheme.target?.formName),
    normalizeText(dependency.fieldRef?.fieldId),
    normalizeText(dependency.fieldRef?.fieldName),
    normalizeText(dependency.fieldRef?.expectedType),
  ].join('|')
  const personnelDependencyKeys = new Set(
    personnelDependencies.map(getPersonnelDependencySemanticKey),
  )
  const dependencies = [
    ...existingDependencies.filter(item => (
      !personnelDependencyKeys.has(getPersonnelDependencySemanticKey(item))
    )),
    ...personnelDependencies,
  ]
    .filter((item, index, items) => items.findIndex(candidate => candidate.id === item.id) === index)
  const personnelDeferredConfigItems = projections.flatMap(item => (
    item.deferredConfigItem ? [item.deferredConfigItem] : []
  ))
  const runtimeSupportedManagerNodeKeys = new Set(
    projections.flatMap((projection) => {
      const step = getStepList(input.scheme).find(item => (
        normalizeText(item.key) === normalizeText(projection.assessment.nodeKey)
      ))
      return step?.personnelRequirement
        && ['submitter_manager', 'department_manager'].includes(step.personnelRequirement.sourceType)
        && projection.assessment.disposition === 'resolved'
        ? [normalizeText(step.key)]
        : []
    }),
  )
  const existingDeferredConfigItems = Array.isArray(input.scheme.deferredConfigItems)
    ? input.scheme.deferredConfigItems.filter(item => (
      !normalizeText(item.id).startsWith('flow-deferred:personnel:')
      && !(
        item.supportStatus === 'needs_runtime_support'
        && item.category === 'owner_binding'
        && runtimeSupportedManagerNodeKeys.has(normalizeText(item.nodeKey))
      )
      && !personnelDeferredConfigItems.some(assessmentItem => (
        normalizeText(assessmentItem.nodeKey) === normalizeText(item.nodeKey)
        && normalizeText(assessmentItem.settingPath) === normalizeText(item.settingPath)
        && assessmentItem.category === item.category
      ))
    ))
    : []
  const deferredConfigItems = mergeDeferredConfigItems({
    existingItems: existingDeferredConfigItems,
    incomingItems: personnelDeferredConfigItems,
    mode: 'preserve',
  })
  const scheme = decorateFlowSchemeWithConvergence({
    scheme: {
      ...input.scheme,
      dependencies,
      deferredConfigItems,
      convergence: null,
    },
  })
  const assessments = projections.map(item => item.assessment)
  const assessmentsByNodeKey = assessments.reduce<Record<string, FlowPersonnelDependencyAssessment[]>>(
    (result, assessment) => {
      if (!result[assessment.nodeKey]) {
        result[assessment.nodeKey] = []
      }
      result[assessment.nodeKey].push(assessment)
      return result
    },
    {},
  )

  return {
    scheme,
    assessments,
    assessmentsByNodeKey,
  }
}

export const assessAndDecorateFlowSchemePersonnelDependencies = (input: {
  scheme: NocodeEditorFlowScheme
  flowSummary?: unknown
}): NocodeEditorFlowScheme => assessFlowSchemePersonnelDependencies(input).scheme

export type FlowPersonnelQuestionReconciliation = {
  decisionKey: string
  stepKey: string
  stepTitle: string
  slot: 'source' | 'approval_level'
}

const isFlowPersonnelQuestionAnswered = (
  question: NocodeEditorAiConfirmQuestion,
) => Boolean(
  question.confirmed === true
  || normalizeText(question.selectedOptionValue)
  || normalizeText(question.answerSummary)
  || normalizeText(question.answerDetail)
  || question.options?.some(option => option.selected === true),
)

// 来源已定：unresolved 之外都算已确定；固定人员/角色未绑定对象属于“生成后待补”，
// 由评估链路产出待配置项，不再回头问来源。
const isFlowPersonnelSourceDecided = (
  requirement?: NocodeEditorFlowPersonnelRequirement,
) => Boolean(requirement && requirement.sourceType !== 'unresolved')

// 层级已定：非部门主管来源不需要层级；部门主管则必须已有 departmentManager。
const isFlowPersonnelSlotDecided = (input: {
  requirement?: NocodeEditorFlowPersonnelRequirement
  slot: 'source' | 'approval_level'
}) => {
  if (!isFlowPersonnelSourceDecided(input.requirement)) return false
  if (input.slot === 'source') return true
  return input.requirement!.sourceType !== 'department_manager'
    || Boolean(input.requirement!.departmentManager)
}

const buildFlowPersonnelStepLookup = (scheme: NocodeEditorFlowScheme) => new Map(
  getStepList(scheme).flatMap(step => {
    const key = normalizeText(step.key)
    return key ? [[key, step] as const] : []
  }),
)

// 人员题与 personnelRequirement 对齐：已确定来源/层级的槽位不再追问。
// 只回收未答题，已答题保留为历史；无配置或 unresolved 时不动（安全态）。
export const reconcilePersonnelQuestionsWithRequirements = (input: {
  scheme: NocodeEditorFlowScheme
}): {
  scheme: NocodeEditorFlowScheme
  reconciled: FlowPersonnelQuestionReconciliation[]
} => {
  const scheme = input.scheme
  const stepByKey = buildFlowPersonnelStepLookup(scheme)
  if (!stepByKey.size) {
    return { scheme, reconciled: [] }
  }
  const decisionStepLookup = new Map(
    [...stepByKey].map(([key, step]) => [key, { key, kind: step.kind }] as const),
  )
  const reconciled: FlowPersonnelQuestionReconciliation[] = []
  const droppedDecisionKeys = new Set<string>()
  const recordedKeys = new Set<string>()

  const recordDropped = (item: {
    decisionKey: unknown
    stepKey: unknown
    slot: 'source' | 'approval_level'
  }) => {
    const step = stepByKey.get(normalizeText(item.stepKey))
    if (!step) return
    const decisionKey = normalizeText(item.decisionKey)
    if (decisionKey) droppedDecisionKeys.add(decisionKey)
    const recordedKey = `${decisionKey}|${normalizeText(item.stepKey)}|${item.slot}`
    if (recordedKeys.has(recordedKey)) return
    recordedKeys.add(recordedKey)
    reconciled.push({
      decisionKey,
      stepKey: normalizeText(step.key),
      stepTitle: normalizeText(step.title),
      slot: item.slot,
    })
  }

  const isDecided = (decision: {
    stepKey: string
    slot: 'source' | 'approval_level'
  }) => isFlowPersonnelSlotDecided({
    requirement: stepByKey.get(normalizeText(decision.stepKey))?.personnelRequirement,
    slot: decision.slot,
  })

  const questions = (scheme.confirmation?.questions || []).filter((question) => {
    if (isFlowPersonnelQuestionAnswered(question)) return true
    const decision = inferFlowPersonnelDecision(question, decisionStepLookup)
    const slot = decision?.slot
    if (!decision || (slot !== 'source' && slot !== 'approval_level')) {
      return true
    }
    if (!isDecided({ stepKey: decision.stepKey, slot })) return true
    recordDropped({
      decisionKey: normalizeText(question.decisionKey) || normalizeText(question.id),
      stepKey: decision.stepKey,
      slot,
    })
    return false
  })

  const openQuestions = (scheme.openQuestions || []).filter((question) => {
    const key = normalizeText(question.key)
    if (key && droppedDecisionKeys.has(key)) return false
    const decision = inferFlowPersonnelDecision({
      id: key,
      decisionKey: key,
      title: '',
      questionKind: 'single_select',
      ...(question.scopeKind === 'step' && normalizeText(question.scopeKey)
        ? { decisionScope: { kind: 'step' as const, id: normalizeText(question.scopeKey) } }
        : {}),
    }, decisionStepLookup)
    const slot = decision?.slot
    if (!decision || (slot !== 'source' && slot !== 'approval_level')) {
      return true
    }
    if (!isDecided({ stepKey: decision.stepKey, slot })) return true
    recordDropped({ decisionKey: key, stepKey: decision.stepKey, slot })
    return false
  })

  const dependencies = (scheme.dependencies || []).filter((dependency) => {
    if (dependency.resolutionStatus === 'resolved') return true
    const decision = resolveFlowDependencyPersonnelDecision(dependency)
    const slot = decision?.slot
    if (!decision || (slot !== 'source' && slot !== 'approval_level')) {
      return true
    }
    if (!isDecided({ stepKey: decision.stepKey, slot })) return true
    recordDropped({
      decisionKey: normalizeText(dependency.decisionKey) || normalizeText(dependency.id),
      stepKey: decision.stepKey,
      slot,
    })
    return false
  })

  if (!reconciled.length) {
    return { scheme, reconciled }
  }
  const confirmation = scheme.confirmation
    ? {
      ...scheme.confirmation,
      status: questions.some(question => question.required !== false && question.confirmed !== true)
        ? 'pending' as const
        : 'completed' as const,
      questions,
    }
    : scheme.confirmation
  return {
    scheme: {
      ...scheme,
      openQuestions,
      dependencies,
      ...(confirmation ? { confirmation } : {}),
    },
    reconciled,
  }
}

export const removeDeferredCapabilityConfirmationQuestions = (
  scheme: NocodeEditorFlowScheme,
): NocodeEditorFlowScheme => {
  const deferredNodeKeys = new Set(
    (scheme.deferredConfigItems || [])
      .filter(item => item.supportStatus === 'needs_runtime_support' && item.nodeKey)
      .map(item => String(item.nodeKey).trim()),
  )
  const capabilityDecisionKeys = new Set(
    [...deferredNodeKeys].map(nodeKey => `flow-personnel:${nodeKey}:capability`),
  )
  const isApprovalOwnerSourceDecisionKey = (key: string) => (
    key === 'approver_source'
    || key === 'flow.approval.owner'
    || key === 'flow.approval.owner.source'
    || /^flow\.approval\.owner\.source:[^:]+$/u.test(key)
    || /^flow\.[a-z-]+\.owner\.source\.[^:]+$/u.test(key)
    || /^flow\.personnel:[^:]+:source$/u.test(key)
  )
  const resolveConfirmedSourceValue = (question: NocodeEditorAiConfirmQuestion) => String(
    question.selectedOptionValue
    || question.options?.find(option => option.selected)?.value
    || question.options?.find(option => option.selected)?.personnelCandidate?.sourceType
    || '',
  ).trim()
  const hasConfirmedDepartmentManagerSource = (scheme.confirmation?.questions || []).some(question => (
    isApprovalOwnerSourceDecisionKey(String(question.decisionKey || question.id || '').trim())
    && question.confirmed === true
    && resolveConfirmedSourceValue(question) === 'department_manager'
  ))
  const isRedundantApprovalOwnerNote = (question: NocodeEditorAiConfirmQuestion) => (
    hasConfirmedDepartmentManagerSource
    && question.questionKind === 'note_only'
    && String(question.decisionKey || question.id || '').trim() === 'flow.approval.owner'
  )
  if (!deferredNodeKeys.size && !hasConfirmedDepartmentManagerSource) return scheme

  const openQuestions = (scheme.openQuestions || []).filter(question => (
    !capabilityDecisionKeys.has(String(question.key || '').trim())
    && !(hasConfirmedDepartmentManagerSource
      && String(question.key || '').trim() === 'flow.approval.owner')
  ))
  const questions = (scheme.confirmation?.questions || []).filter(question => (
    !capabilityDecisionKeys.has(String(question.decisionKey || question.id || '').trim())
    && !isRedundantApprovalOwnerNote(question)
  ))
  return {
    ...scheme,
    openQuestions,
    ...(scheme.confirmation ? {
      confirmation: {
        ...scheme.confirmation,
        status: questions.some(question => question.required !== false && question.confirmed !== true)
          ? 'pending' as const
          : 'completed' as const,
        questions,
      },
    } : {}),
  }
}
