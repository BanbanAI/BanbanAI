import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDeferredConfigItem,
  NocodeEditorFlowSchemeDependency,
  NocodeEditorFlowSchemeStep,
} from '@common/utils/nocodeEditorFlowScheme'
import type {
  NocodeEditorFlowPersonnelRef,
  NocodeEditorFlowPersonnelRequirement,
} from '@common/utils/nocodeEditorFlowPersonnel'
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
}): NocodeEditorFlowSchemeDependency => ({
  id: `flow-personnel:${input.step.key}:${input.suffix}`,
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
})

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
) => ({
  id: `flow-deferred:personnel:${step.key}:${assessment.issueCode}`,
  nodeKey: step.key,
  nodeTitle: step.title,
  category,
  requirementLevel: 'required' as const,
  supportStatus: 'runtime_supported' as const,
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
      dependency: buildBlockingDependency({
        step: input.step,
        assessment,
        suffix: 'source',
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
    'block',
    `${input.step.title}所需的经理人员语义当前不受运行时支持`,
    ['经理人员语义'],
    metadata.issueCode,
  )
  return {
    assessment,
    dependency: buildBlockingDependency({
      step: input.step,
      assessment,
      suffix: 'capability',
      kind: 'capability_gap',
    }),
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

  const fallbackIssueCode = issueCodes.fixed_users
  const assessment = getAssessmentBase(
    input.step,
    'block',
    `${input.step.title}的兜底人员来源尚未确定`,
    ['兜底人员来源'],
    fallbackIssueCode,
  )
  return {
    assessment,
    dependency: buildBlockingDependency({
      step: input.step,
      assessment,
      suffix: 'fallback',
      kind: 'org_anchor_missing',
    }),
  }
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
  const getPersonnelDependencySemanticKey = (dependency: NocodeEditorFlowSchemeDependency) => [
    normalizeText(dependency.kind),
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
  const existingDeferredConfigItems = Array.isArray(input.scheme.deferredConfigItems)
    ? input.scheme.deferredConfigItems.filter(item => !normalizeText(item.id).startsWith('flow-deferred:personnel:'))
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
