import { ProcessNodeOwnerType } from '@common/types/project'
import type {
  NocodeEditorFlowPlan,
  NocodeEditorFlowPlanNode,
  NocodeEditorFlowPlanTriggerBranch,
} from '@common/utils/nocodeEditorFlowPlan'
import type {
  NocodeEditorFlowGroundingOwnerUsage,
  NocodeEditorFlowSchemeGroundingDiagnostic,
} from '@common/utils/nocodeEditorFlowSchemeGrounding'

type UnknownRecord = Record<string, unknown>

type FlowSummaryField = {
  fieldId: string
  fieldName: string
  writePolicy?: string
  conditionPolicy?: string
  ownerPolicy?: string
  subFields?: FlowSummaryField[]
}

type FlowSummaryTable = {
  tableId: string
  tableName: string
  fields: FlowSummaryField[]
}

type FlowSummarySnapshot = {
  forms: {
    currentForm: FlowSummaryTable | null
    availableForms: FlowSummaryTable[]
  }
}

type FlowPlanGroundingDiagnosticCode =
  | 'grounding_write_field_missing'
  | 'grounding_write_field_forbidden'
  | 'grounding_condition_field_missing'
  | 'grounding_condition_field_forbidden'
  | 'grounding_source_field_missing'
  | 'grounding_source_field_conflict'
  | 'grounding_source_table_missing'
  | 'grounding_owner_field_missing'
  | 'grounding_owner_field_forbidden'

export type FlowPlanGroundingCompatibleField = {
  fieldId: string
  fieldName: string
  ownerPolicy: string
  matchReason?: 'owner_policy_match'
}

export type FlowPlanGroundingDiagnostic = Omit<
  NocodeEditorFlowSchemeGroundingDiagnostic,
  'code' | 'message' | 'compatibleFields'
> & {
  code: FlowPlanGroundingDiagnosticCode
  message: string
  compatibleFields?: FlowPlanGroundingCompatibleField[]
  candidateCount?: number
}

type ValidateFlowPlanGroundingInput = {
  plan: NocodeEditorFlowPlan | null | undefined
  summary: unknown
}

type FlowVisitContext = {
  location: string
  nodeKey?: string
  nodeName?: string
  branchKey?: string
  branchLabel?: string
}

type OwnerFieldExpectation = 'member' | 'department'

type OwnerFieldUsage = {
  label: string
  kind: NocodeEditorFlowGroundingOwnerUsage
}

type OwnerFieldReference = {
  candidate: unknown
  expectations: OwnerFieldExpectation[]
  usage: OwnerFieldUsage
}

export const FLOW_GROUNDING_RECOVERY_HINT_TEXT = '请先回到流程方案补齐可用字段，或改成 flow summary 里允许当前用途的字段。'

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const asRecord = (value: unknown): UnknownRecord => (
  isRecord(value) ? value : {}
)

const asArray = <T = unknown>(value: unknown): T[] => (
  Array.isArray(value) ? value as T[] : []
)

const pickFirstMeaningfulText = (...values: unknown[]) => (
  values
    .map(item => normalizeText(item))
    .find(Boolean)
  || ''
)

export const getFlowFieldReferenceCandidate = (
  value: unknown,
) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return normalizeText(value)
  }
  const record = asRecord(value)
  return pickFirstMeaningfulText(
    record.fieldUID,
    record.fieldId,
    record.uid,
    record.id,
    record.fieldName,
    record.name,
    record.alias,
  )
}

export const getFlowMappingTargetFieldCandidate = (
  value: unknown,
) => {
  const record = asRecord(value)
  return pickFirstMeaningfulText(
    record.targetFieldUID,
    record.targetFieldId,
    record.targetFieldName,
    record.targetFieldAlias,
    record.targetField,
    getFlowFieldReferenceCandidate(record),
  )
}

const buildFlowFieldReferenceInput = (
  value: unknown,
  keyMap: {
    uid: string
    id: string
    name: string
    alias: string
  },
) => {
  const record = asRecord(value)
  const reference = {
    fieldUID: record[keyMap.uid],
    fieldId: record[keyMap.id],
    fieldName: record[keyMap.name],
    alias: record[keyMap.alias],
  }
  return getFlowFieldReferenceCandidate(reference)
    ? reference
    : null
}

export const getFlowMappingSourceReferenceInput = (
  value: unknown,
) => {
  const record = asRecord(value)
  const sourceCandidate = getFlowFieldReferenceCandidate(record.source)
  const valueFieldReference = buildFlowFieldReferenceInput(record, {
    uid: 'valueFieldUID',
    id: 'valueFieldId',
    name: 'valueFieldName',
    alias: 'valueFieldAlias',
  })
  const valueFieldCandidate = getFlowFieldReferenceCandidate(valueFieldReference)

  return {
    candidate: sourceCandidate || valueFieldCandidate,
    sourceInput: sourceCandidate ? record.source : valueFieldReference,
    sourceFieldInput: sourceCandidate ? record.source : null,
    valueFieldInput: valueFieldReference,
  }
}

export const buildFlowMappingSourceConflictMessage = (
  sourceLabel: unknown,
  valueFieldLabel: unknown,
) => (
  `映射来源字段同时提供了 source 与 valueField*，但分别指向“${normalizeText(sourceLabel) || '未知字段'}”和“${normalizeText(valueFieldLabel) || '未知字段'}”，请只保留一个来源字段引用。`
)

export const getFlowMappingSourceFieldCandidate = (
  value: unknown,
) => getFlowMappingSourceReferenceInput(value).candidate

export const getFlowBatchCountFieldReferenceInput = (
  value: unknown,
) => {
  const record = asRecord(value)
  return buildFlowFieldReferenceInput(record, {
    uid: 'countFieldUID',
    id: 'countFieldId',
    name: 'countFieldName',
    alias: 'countFieldAlias',
  }) || buildFlowFieldReferenceInput(record, {
    uid: 'numberFieldUID',
    id: 'numberFieldId',
    name: 'numberFieldName',
    alias: 'numberFieldAlias',
  })
}

export const getFlowBatchCountFieldCandidate = (
  value: unknown,
) => getFlowFieldReferenceCandidate(getFlowBatchCountFieldReferenceInput(value))

export const getFlowTimeTaskTriggerDateCandidate = (
  value: unknown,
) => {
  const record = asRecord(value)
  const schedule = asRecord(record.schedule)
  return pickFirstMeaningfulText(
    getFlowFieldReferenceCandidate(schedule.triggerDate),
    schedule.triggerDateFieldUID,
    schedule.triggerDateFieldId,
    schedule.triggerDateFieldName,
    schedule.triggerDateFieldAlias,
    getFlowFieldReferenceCandidate(record.triggerDate),
    record.triggerDateFieldUID,
    record.triggerDateFieldId,
    record.triggerDateFieldName,
    record.triggerDateFieldAlias,
  )
}

export const getFlowTimeTaskBoundaryFieldCandidate = (
  value: unknown,
) => {
  const record = asRecord(value)
  if (!Object.keys(record).length) {
    return ''
  }
  const typeToken = normalizeToken(record.type || record.mode || record.kind)
  if (typeToken === 'custom' || typeToken === 'none') {
    return ''
  }
  return pickFirstMeaningfulText(
    getFlowFieldReferenceCandidate(record),
    record.value,
  )
}

const getFlowDataWriteMappingItems = (
  options: UnknownRecord,
) => [
  ...asArray(options.mapping),
  ...asArray(options.mappings),
]

const normalizeFlowSummaryField = (value: unknown): FlowSummaryField | null => {
  const record = asRecord(value)
  const fieldId = normalizeText(record.fieldId)
  const fieldName = normalizeText(record.fieldName)
  if (!fieldId && !fieldName) {
    return null
  }
  return {
    fieldId,
    fieldName,
    writePolicy: normalizeText(record.writePolicy) || undefined,
    conditionPolicy: normalizeText(record.conditionPolicy) || undefined,
    ownerPolicy: normalizeText(record.ownerPolicy) || undefined,
    subFields: asArray(record.subFields)
      .map(item => normalizeFlowSummaryField(item))
      .filter((item): item is FlowSummaryField => Boolean(item)),
  }
}

const normalizeFlowSummaryTable = (value: unknown): FlowSummaryTable | null => {
  const record = asRecord(value)
  const tableId = normalizeText(record.tableId)
  const tableName = normalizeText(record.tableName)
  if (!tableId && !tableName) {
    return null
  }
  return {
    tableId,
    tableName,
    fields: asArray(record.fields)
      .map(item => normalizeFlowSummaryField(item))
      .filter((item): item is FlowSummaryField => Boolean(item)),
  }
}

const normalizeFlowSummarySnapshot = (value: unknown): FlowSummarySnapshot => {
  const forms = asRecord(asRecord(value).forms)
  return {
    forms: {
      currentForm: normalizeFlowSummaryTable(forms.currentForm),
      availableForms: asArray(forms.availableForms)
        .map(item => normalizeFlowSummaryTable(item))
        .filter((item): item is FlowSummaryTable => Boolean(item)),
    },
  }
}

const findSummaryFieldDirectly = (
  fields: FlowSummaryField[],
  candidate: string,
) => {
  const normalizedCandidate = normalizeText(candidate)
  const candidateToken = normalizeToken(candidate)
  return fields.find(item => item.fieldId === normalizedCandidate)
    || fields.find(item => normalizeToken(item.fieldName) === candidateToken)
    || null
}

const collectSummaryFields = (
  fields: FlowSummaryField[],
): FlowSummaryField[] => (
  fields.flatMap(field => [
    field,
    ...collectSummaryFields(asArray(field.subFields)),
  ])
)

const collectSummaryFieldMatchesRecursively = (
  fields: FlowSummaryField[],
  candidate: string,
): FlowSummaryField[] => {
  const normalizedCandidate = normalizeText(candidate)
  const candidateToken = normalizeToken(candidate)
  const matches: FlowSummaryField[] = []

  fields.forEach((field) => {
    const leafFieldId = normalizeText(field.fieldId.split('.').pop())
    const leafFieldName = normalizeText(field.fieldName.split('.').pop())
    if (
      field.fieldId === normalizedCandidate
      || normalizeToken(field.fieldName) === candidateToken
      || (
        !candidate.includes('.')
        && (
          leafFieldId === normalizedCandidate
          || normalizeToken(leafFieldName) === candidateToken
        )
      )
    ) {
      matches.push(field)
    }
    matches.push(...collectSummaryFieldMatchesRecursively(asArray(field.subFields), candidate))
  })

  return matches
}

const findSummaryFieldWithLegacyFallback = (
  fields: FlowSummaryField[],
  candidate: string,
) => {
  const matches = collectSummaryFieldMatchesRecursively(fields, candidate)
  return matches.length === 1 ? matches[0] : null
}

const findSummaryFieldByAny = (
  table: FlowSummaryTable | null | undefined,
  candidate: unknown,
): FlowSummaryField | null => {
  if (!table) {
    return null
  }
  const candidateText = isRecord(candidate)
    ? getFlowFieldReferenceCandidate(candidate)
    : normalizeText(candidate)
  if (!candidateText) {
    return null
  }

  const [parentRef, subRef] = candidateText.split('.', 2)
  const parentField = findSummaryFieldDirectly(table.fields, parentRef)
  if (!parentField) {
    return findSummaryFieldWithLegacyFallback(table.fields, candidateText)
  }
  if (!subRef) {
    return parentField
  }
  return findSummaryFieldDirectly(asArray(parentField.subFields), candidateText)
    || findSummaryFieldDirectly(asArray(parentField.subFields), subRef)
    || findSummaryFieldWithLegacyFallback(asArray(parentField.subFields), subRef)
}

const resolveSummaryTableByAny = (
  tables: FlowSummaryTable[],
  candidate: unknown,
) => {
  const record = asRecord(candidate)
  const tableId = normalizeText(record.tableUID || record.tableId || record.uid || record.id || record.formId)
  const tableName = normalizeText(record.tableName || record.name || record.alias || record.label || record.value || record.formName || candidate)
  const tableToken = normalizeToken(tableName)
  return tables.find(item => item.tableId === tableId)
    || tables.find(item => normalizeToken(item.tableName) === tableToken)
    || null
}

const buildGroundingLocation = (context: FlowVisitContext) => {
  const parts = [context.location]
  if (context.nodeName) {
    parts.push(`节点=${context.nodeName}`)
  }
  if (context.nodeKey) {
    parts.push(`nodeKey=${context.nodeKey}`)
  }
  return parts.join('，')
}

const buildGroundingMessage = (
  context: FlowVisitContext,
  detail: string,
) => `${buildGroundingLocation(context)}：${detail} ${FLOW_GROUNDING_RECOVERY_HINT_TEXT}`

const normalizeConditionRecords = (value: unknown): UnknownRecord[] => {
  if (!value) {
    return []
  }
  if (isRecord(value)) {
    if (Array.isArray(value.conditions)) {
      return normalizeConditionRecords(value.conditions)
    }
    return [value]
  }
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap(item => normalizeConditionRecords(item))
}

const collectOwnerFieldReferences = (
  owner: unknown,
  usage: OwnerFieldUsage,
) => {
  const record = asRecord(owner)
  if (!Object.keys(record).length) {
    return [] as OwnerFieldReference[]
  }

  const references: OwnerFieldReference[] = []
  const directType = normalizeToken(record.type || record.ownerType)
  const directFieldCandidate = record.fieldId
    || record.fieldUID
    || record.fieldName
    || record.name
    || record.label

  if (directFieldCandidate) {
    if (directType === 'formdepartment' || directType === 'form-department') {
      references.push({
        candidate: directFieldCandidate,
        expectations: ['department'],
        usage,
      })
    } else if ([
      'field',
      'formfield',
      'currentformfield',
      'formmember',
      'form-member',
    ].includes(directType)) {
      references.push({
        candidate: directFieldCandidate,
        expectations: directType === 'formmember' || directType === 'form-member'
          ? ['member']
          : ['member', 'department'],
        usage,
      })
    }
  }

  asArray(record[ProcessNodeOwnerType.FORM_MEMBER]).forEach((candidate) => {
    references.push({
      candidate,
      expectations: ['member'],
      usage,
    })
  })
  if (record[ProcessNodeOwnerType.FORM_DEPARTMENT]) {
    references.push({
      candidate: record[ProcessNodeOwnerType.FORM_DEPARTMENT],
      expectations: ['department'],
      usage,
    })
  }

  return references
}

const collectCompatibleOwnerFields = (
  table: FlowSummaryTable | null,
  expectations: OwnerFieldExpectation[],
): FlowPlanGroundingCompatibleField[] => {
  if (!table) {
    return []
  }

  const seen = new Set<string>()
  const matches: FlowPlanGroundingCompatibleField[] = []

  collectSummaryFields(table.fields).forEach((field) => {
    const ownerPolicy = normalizeText(field.ownerPolicy)
    if (!expectations.includes(ownerPolicy as OwnerFieldExpectation)) {
      return
    }
    const key = `${normalizeText(field.fieldId)}|${normalizeText(field.fieldName)}`
    if (!key || seen.has(key)) {
      return
    }
    seen.add(key)
    matches.push({
      fieldId: field.fieldId,
      fieldName: field.fieldName,
      ownerPolicy,
      matchReason: 'owner_policy_match',
    })
  })

  return matches
}

const validateWriteFieldReference = (
  diagnostics: FlowPlanGroundingDiagnostic[],
  context: FlowVisitContext,
  table: FlowSummaryTable | null,
  candidate: unknown,
) => {
  const candidateText = normalizeText(
    isRecord(candidate)
      ? getFlowFieldReferenceCandidate(candidate)
      : candidate,
  )
  if (!candidateText) {
    return
  }
  const field = findSummaryFieldByAny(table, candidateText)
  const targetForm = {
    targetFormId: normalizeText(table?.tableId) || undefined,
    targetFormName: normalizeText(table?.tableName) || undefined,
  }
  if (!field) {
    diagnostics.push({
      code: 'grounding_write_field_missing',
      message: buildGroundingMessage(context, `未找到可回写字段“${candidateText}”。`),
      nodeKey: context.nodeKey,
      nodeName: context.nodeName,
      branchKey: context.branchKey,
      branchLabel: context.branchLabel,
      ...targetForm,
      fieldRef: {
        fieldName: candidateText,
      },
    })
    return
  }
  if (normalizeText(field.writePolicy) !== 'writable') {
    diagnostics.push({
      code: 'grounding_write_field_forbidden',
      message: buildGroundingMessage(context, `字段“${field.fieldName || field.fieldId}”当前不可回写（writePolicy=${field.writePolicy || 'unknown'}）。`),
      nodeKey: context.nodeKey,
      nodeName: context.nodeName,
      branchKey: context.branchKey,
      branchLabel: context.branchLabel,
      ...targetForm,
      fieldRef: {
        fieldId: field.fieldId,
        fieldName: field.fieldName,
      },
    })
  }
}

const validateConditionFieldReference = (
  diagnostics: FlowPlanGroundingDiagnostic[],
  context: FlowVisitContext,
  table: FlowSummaryTable | null,
  candidate: unknown,
) => {
  const candidateText = normalizeText(
    isRecord(candidate)
      ? getFlowFieldReferenceCandidate(candidate)
      : candidate,
  )
  if (!candidateText) {
    return
  }
  const field = findSummaryFieldByAny(table, candidateText)
  const targetForm = {
    targetFormId: normalizeText(table?.tableId) || undefined,
    targetFormName: normalizeText(table?.tableName) || undefined,
  }
  if (!field) {
    diagnostics.push({
      code: 'grounding_condition_field_missing',
      message: buildGroundingMessage(context, `未找到条件字段“${candidateText}”。`),
      nodeKey: context.nodeKey,
      nodeName: context.nodeName,
      branchKey: context.branchKey,
      branchLabel: context.branchLabel,
      ...targetForm,
      fieldRef: {
        fieldName: candidateText,
      },
    })
    return
  }
  if (normalizeText(field.conditionPolicy) !== 'usable') {
    diagnostics.push({
      code: 'grounding_condition_field_forbidden',
      message: buildGroundingMessage(context, `字段“${field.fieldName || field.fieldId}”当前不可用于条件（conditionPolicy=${field.conditionPolicy || 'unknown'}）。`),
      nodeKey: context.nodeKey,
      nodeName: context.nodeName,
      branchKey: context.branchKey,
      branchLabel: context.branchLabel,
      ...targetForm,
      fieldRef: {
        fieldId: field.fieldId,
        fieldName: field.fieldName,
      },
    })
  }
}

const validateSourceFieldReference = (
  diagnostics: FlowPlanGroundingDiagnostic[],
  context: FlowVisitContext,
  table: FlowSummaryTable | null,
  candidate: unknown,
) => {
  const candidateText = normalizeText(
    isRecord(candidate)
      ? getFlowFieldReferenceCandidate(candidate)
      : candidate,
  )
  if (!candidateText) {
    return
  }
  const field = findSummaryFieldByAny(table, candidateText)
  if (!field) {
    diagnostics.push({
      code: 'grounding_source_field_missing',
      message: buildGroundingMessage(context, `未找到字段取值来源“${candidateText}”。`),
      nodeKey: context.nodeKey,
      nodeName: context.nodeName,
      branchKey: context.branchKey,
      branchLabel: context.branchLabel,
      targetFormId: normalizeText(table?.tableId) || undefined,
      targetFormName: normalizeText(table?.tableName) || undefined,
      fieldRef: {
        fieldName: candidateText,
      },
    })
  }
}

const validateOwnerFieldReference = (
  diagnostics: FlowPlanGroundingDiagnostic[],
  context: FlowVisitContext,
  table: FlowSummaryTable | null,
  candidate: unknown,
  expectations: OwnerFieldExpectation[],
  usage: OwnerFieldUsage,
) => {
  const candidateText = normalizeText(
    isRecord(candidate)
      ? pickFirstMeaningfulText(getFlowFieldReferenceCandidate(candidate), candidate.value)
      : candidate,
  )
  if (!candidateText) {
    return
  }
  const compatibleFields = collectCompatibleOwnerFields(table, expectations)
  const field = findSummaryFieldByAny(table, candidateText)
  const targetForm = {
    targetFormId: normalizeText(table?.tableId) || undefined,
    targetFormName: normalizeText(table?.tableName) || undefined,
  }
  if (!field) {
    diagnostics.push({
      code: 'grounding_owner_field_missing',
      message: buildGroundingMessage(context, `未找到可作为${usage.label}的字段“${candidateText}”。`),
      nodeKey: context.nodeKey,
      nodeName: context.nodeName,
      branchKey: context.branchKey,
      branchLabel: context.branchLabel,
      ...targetForm,
      fieldRef: {
        fieldName: candidateText,
      },
      ownerUsage: usage.kind,
      compatibleFields: compatibleFields.slice(0, 3),
      candidateCount: compatibleFields.length,
    })
    return
  }
  if (!expectations.includes(normalizeText(field.ownerPolicy) as OwnerFieldExpectation)) {
    diagnostics.push({
      code: 'grounding_owner_field_forbidden',
      message: buildGroundingMessage(context, `字段“${field.fieldName || field.fieldId}”当前不能作为${usage.label}（ownerPolicy=${field.ownerPolicy || 'unknown'}）。`),
      nodeKey: context.nodeKey,
      nodeName: context.nodeName,
      branchKey: context.branchKey,
      branchLabel: context.branchLabel,
      ...targetForm,
      fieldRef: {
        fieldId: field.fieldId,
        fieldName: field.fieldName,
      },
      ownerUsage: usage.kind,
      compatibleFields: compatibleFields.slice(0, 3),
      candidateCount: compatibleFields.length,
    })
  }
}

const validateFilterRuleGrounding = (
  diagnostics: FlowPlanGroundingDiagnostic[],
  context: FlowVisitContext,
  table: FlowSummaryTable | null,
  currentForm: FlowSummaryTable | null,
  value: unknown,
) => {
  normalizeConditionRecords(value).forEach((condition) => {
    validateConditionFieldReference(
      diagnostics,
      context,
      table,
      getFlowFieldReferenceCandidate(condition),
    )
    const valueFieldCandidate = pickFirstMeaningfulText(
      condition.valueFieldUID,
      condition.valueFieldId,
      condition.valueFieldName,
      condition.valueFieldAlias,
    )
    if (valueFieldCandidate) {
      validateSourceFieldReference(
        diagnostics,
        context,
        currentForm,
        valueFieldCandidate,
      )
      return
    }
    if (normalizeToken(condition.type) === 'form') {
      validateSourceFieldReference(
        diagnostics,
        context,
        currentForm,
        condition.value,
      )
    }
  })
}

const validateSourceFormGrounding = (
  diagnostics: FlowPlanGroundingDiagnostic[],
  context: FlowVisitContext,
  sourceForm: unknown,
  currentForm: FlowSummaryTable | null,
  allTables: FlowSummaryTable[],
) => {
  const sourceRecord = asRecord(sourceForm)
  if (!Object.keys(sourceRecord).length) {
    return
  }
  const sourceTableCandidate = pickFirstMeaningfulText(
    sourceRecord.tableUID,
    sourceRecord.tableId,
    sourceRecord.uid,
    sourceRecord.id,
    sourceRecord.formId,
    sourceRecord.tableName,
    sourceRecord.formName,
    sourceRecord.name,
    sourceRecord.alias,
  )
  const sourceTable = resolveSummaryTableByAny(allTables, sourceRecord)
  if (!sourceTable) {
    diagnostics.push({
      code: 'grounding_source_table_missing',
      message: buildGroundingMessage(context, `未找到来源表单“${sourceTableCandidate || '未命名来源表单'}”。`),
      nodeKey: context.nodeKey,
      nodeName: context.nodeName,
      branchKey: context.branchKey,
      branchLabel: context.branchLabel,
    })
    return
  }
  const sourceFormFilter = sourceRecord.filter
    || sourceRecord.filterRule
    || sourceRecord.sourceFilter
    || (Array.isArray(sourceRecord.conditions) ? { conditions: sourceRecord.conditions } : undefined)
  if (!sourceFormFilter) {
    return
  }
  validateFilterRuleGrounding(
    diagnostics,
    context,
    sourceTable,
    currentForm,
    sourceFormFilter,
  )
}

const validateDataWriteNodeGrounding = (
  diagnostics: FlowPlanGroundingDiagnostic[],
  context: FlowVisitContext,
  node: NocodeEditorFlowPlanNode,
  currentForm: FlowSummaryTable | null,
  allTables: FlowSummaryTable[],
) => {
  const options = asRecord(node.options)
  const validateMappingSourceGrounding = (
    mapping: UnknownRecord,
  ) => {
    if (Object.prototype.hasOwnProperty.call(mapping, 'value')) {
      return
    }
    const sourceReference = getFlowMappingSourceReferenceInput(mapping)
    const sourceField = sourceReference.sourceFieldInput
      ? findSummaryFieldByAny(currentForm, sourceReference.sourceFieldInput)
      : null
    const valueField = sourceReference.valueFieldInput
      ? findSummaryFieldByAny(currentForm, sourceReference.valueFieldInput)
      : null
    if (sourceReference.sourceFieldInput && !sourceField) {
      validateSourceFieldReference(
        diagnostics,
        context,
        currentForm,
        sourceReference.sourceFieldInput,
      )
      return
    }
    if (sourceReference.valueFieldInput && !valueField) {
      validateSourceFieldReference(
        diagnostics,
        context,
        currentForm,
        sourceReference.valueFieldInput,
      )
      return
    }
    if (
      sourceField
      && valueField
      && normalizeText(sourceField.fieldId) !== normalizeText(valueField.fieldId)
    ) {
      diagnostics.push({
        code: 'grounding_source_field_conflict',
        message: buildGroundingMessage(
          context,
          buildFlowMappingSourceConflictMessage(
            sourceField.fieldName || sourceField.fieldId,
            valueField.fieldName || valueField.fieldId,
          ),
        ),
        nodeKey: context.nodeKey,
        nodeName: context.nodeName,
        branchKey: context.branchKey,
        branchLabel: context.branchLabel,
      })
      return
    }
    validateSourceFieldReference(
      diagnostics,
      context,
      currentForm,
      sourceReference.candidate,
    )
  }
  const fallbackCurrentTarget = node.type === 'edit-data'
    ? currentForm
    : null
  const targetTable = resolveSummaryTableByAny(allTables, options.targetForm || options.target || {
    tableUID: options.targetTableUID,
    tableId: options.targetTableUID,
  }) || fallbackCurrentTarget

  getFlowDataWriteMappingItems(options).forEach((item) => {
    const mapping = asRecord(item)
    validateWriteFieldReference(
      diagnostics,
      context,
      targetTable,
      getFlowMappingTargetFieldCandidate(mapping),
    )
    validateMappingSourceGrounding(mapping)
  })

  const batch = asRecord(options.batch)
  ;[...asArray(batch.mappings), ...asArray(batch.batchMappings)].forEach((item) => {
    const mapping = asRecord(item)
    validateWriteFieldReference(
      diagnostics,
      context,
      targetTable,
      getFlowMappingTargetFieldCandidate(mapping),
    )
    validateMappingSourceGrounding(mapping)
  })
  validateSourceFieldReference(
    diagnostics,
    context,
    currentForm,
    getFlowBatchCountFieldCandidate(batch),
  )

  validateFilterRuleGrounding(
    diagnostics,
    context,
    targetTable,
    currentForm,
    options.filter || options.targetTableFilterRule,
  )
  validateSourceFormGrounding(diagnostics, context, options.sourceForm, currentForm, allTables)
}

const validateNodeGrounding = (
  diagnostics: FlowPlanGroundingDiagnostic[],
  node: NocodeEditorFlowPlanNode,
  context: FlowVisitContext,
  currentForm: FlowSummaryTable | null,
  allTables: FlowSummaryTable[],
) => {
  const options = asRecord(node.options)

  if (node.type === 'approval') {
    collectOwnerFieldReferences(options.approver, {
      label: '审批人',
      kind: 'approval_owner',
    }).forEach((reference) => {
      validateOwnerFieldReference(
        diagnostics,
        context,
        currentForm,
        reference.candidate,
        reference.expectations,
        reference.usage,
      )
    })
  }

  if (node.type === 'transact') {
    collectOwnerFieldReferences(options.transactor, {
      label: '办理人',
      kind: 'handler',
    }).forEach((reference) => {
      validateOwnerFieldReference(
        diagnostics,
        context,
        currentForm,
        reference.candidate,
        reference.expectations,
        reference.usage,
      )
    })
    validateSourceFormGrounding(
      diagnostics,
      context,
      asRecord(options.finishCondition).sourceForm,
      currentForm,
      allTables,
    )
    validateFilterRuleGrounding(
      diagnostics,
      context,
      currentForm,
      currentForm,
      asRecord(options.finishCondition).conditions,
    )
  }

  if (node.type === 'notify') {
    collectOwnerFieldReferences(options.notifier, {
      label: '通知对象',
      kind: 'notify_target',
    }).forEach((reference) => {
      validateOwnerFieldReference(
        diagnostics,
        context,
        currentForm,
        reference.candidate,
        reference.expectations,
        reference.usage,
      )
    })
  }

  if (node.type === 'report-data') {
    collectOwnerFieldReferences(options.reporter, {
      label: '填报人',
      kind: 'reporter',
    }).forEach((reference) => {
      validateOwnerFieldReference(
        diagnostics,
        context,
        currentForm,
        reference.candidate,
        reference.expectations,
        reference.usage,
      )
    })
    validateSourceFormGrounding(
      diagnostics,
      context,
      asRecord(options.finishCondition).sourceForm,
      currentForm,
      allTables,
    )
    validateFilterRuleGrounding(
      diagnostics,
      context,
      currentForm,
      currentForm,
      asRecord(options.finishCondition).conditions,
    )
  }

  if (node.type === 'trigger-data-change' || node.type === 'trigger-time-task') {
    validateFilterRuleGrounding(
      diagnostics,
      context,
      currentForm,
      currentForm,
      options.conditions,
    )
    validateSourceFormGrounding(diagnostics, context, options.sourceForm, currentForm, allTables)
  }
  if (node.type === 'trigger-time-task') {
    const schedule = asRecord(options.schedule)
    const triggerDateCandidate = getFlowTimeTaskTriggerDateCandidate(options)
    if (triggerDateCandidate) {
      validateSourceFieldReference(
        diagnostics,
        context,
        currentForm,
        triggerDateCandidate,
      )
    }
    const startDateCandidate = getFlowTimeTaskBoundaryFieldCandidate(schedule.startDate || options.startDate)
    if (startDateCandidate) {
      validateSourceFieldReference(
        diagnostics,
        context,
        currentForm,
        startDateCandidate,
      )
    }
    const endDateCandidate = getFlowTimeTaskBoundaryFieldCandidate(schedule.endDate || options.endDate)
    if (endDateCandidate) {
      validateSourceFieldReference(
        diagnostics,
        context,
        currentForm,
        endDateCandidate,
      )
    }
  }

  if (node.type === 'add-data' || node.type === 'edit-data' || node.type === 'delete-data') {
    validateDataWriteNodeGrounding(diagnostics, context, node, currentForm, allTables)
  }

  if (node.type === 'condition-branch') {
    asArray(node.branches).forEach((branch) => {
      validateFilterRuleGrounding(
        diagnostics,
        context,
        currentForm,
        currentForm,
        asRecord(branch).conditions,
      )
    })
  }
}

const visitPlanNodes = (
  diagnostics: FlowPlanGroundingDiagnostic[],
  nodes: NocodeEditorFlowPlanNode[],
  currentForm: FlowSummaryTable | null,
  allTables: FlowSummaryTable[],
  prefix: {
    branchKey?: string
    branchLabel?: string
  } = {},
) => {
  nodes.forEach((node, nodeIndex) => {
    const context: FlowVisitContext = {
      location: prefix.branchLabel
        ? `${prefix.branchLabel} / 节点 ${nodeIndex + 1}`
        : `节点 ${nodeIndex + 1}`,
      nodeKey: normalizeText(node.nodeKey) || undefined,
      nodeName: normalizeText(node.name) || undefined,
      branchKey: prefix.branchKey,
      branchLabel: prefix.branchLabel,
    }
    validateNodeGrounding(diagnostics, node, context, currentForm, allTables)
    asArray(node.branches).forEach((branch, branchIndex) => {
      visitPlanNodes(
        diagnostics,
        asArray(asRecord(branch).nodes) as NocodeEditorFlowPlanNode[],
        currentForm,
        allTables,
        {
          branchKey: normalizeText(asRecord(branch).branchKey) || prefix.branchKey,
          branchLabel: `${context.location} / ${normalizeText(asRecord(branch).label) || `分支 ${branchIndex + 1}`}`,
        },
      )
    })
  })
}

export const validateFlowPlanGrounding = (
  input: ValidateFlowPlanGroundingInput,
) => {
  const plan = input.plan
  if (!plan) {
    return [] as FlowPlanGroundingDiagnostic[]
  }

  const summary = normalizeFlowSummarySnapshot(input.summary)
  const currentForm = summary.forms.currentForm
  const allTables = [
    ...(currentForm ? [currentForm] : []),
    ...summary.forms.availableForms,
  ]
  const diagnostics: FlowPlanGroundingDiagnostic[] = []

  asArray<NocodeEditorFlowPlanTriggerBranch>(plan.triggerBranches).forEach((branch, branchIndex) => {
    const triggerContext: FlowVisitContext = {
      location: `触发分支 ${branchIndex + 1} / 触发节点`,
      nodeKey: normalizeText(branch.triggerNode?.nodeKey) || undefined,
      nodeName: normalizeText(branch.triggerNode?.name) || undefined,
      branchKey: normalizeText(branch.branchKey) || undefined,
      branchLabel: normalizeText(branch.label) || `触发分支 ${branchIndex + 1}`,
    }
    validateNodeGrounding(
      diagnostics,
      branch.triggerNode,
      triggerContext,
      currentForm,
      allTables,
    )
    visitPlanNodes(
      diagnostics,
      asArray(branch.nodes) as NocodeEditorFlowPlanNode[],
      currentForm,
      allTables,
      {
        branchKey: triggerContext.branchKey,
        branchLabel: `触发分支 ${branchIndex + 1}`,
      },
    )
  })

  return diagnostics
}
