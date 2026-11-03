import type { NocodeEditorFlowPlan } from './nocodeEditorFlowPlan'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
} from './nocodeEditorFlowScheme'

type UnknownRecord = Record<string, unknown>

export type FlowApprovalOwnerSummaryField = {
  fieldId: string
  fieldName: string
  ownerPolicy: string
  subFields?: FlowApprovalOwnerSummaryField[]
}

export type FlowApprovalOwnerSummaryTarget = {
  tableId: string
  tableName: string
  fields: FlowApprovalOwnerSummaryField[]
}

export type FlowApprovalOwnerDependencyState = {
  isExisting: boolean
  isPlanned: boolean
}

export const normalizeFlowApprovalOwnerText = (value: unknown) => String(value ?? '').trim()

export const normalizeFlowApprovalOwnerToken = (value: unknown) => normalizeFlowApprovalOwnerText(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

export const isFlowApprovalOwnerRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

export const isSameFlowApprovalOwnerToken = (left: unknown, right: unknown) => {
  const normalizedLeft = normalizeFlowApprovalOwnerToken(left)
  const normalizedRight = normalizeFlowApprovalOwnerToken(right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

// 申请人角色字段（报销人/申请人）不能被复用为审批人；两侧判定必须同源。
export const isApplicantRoleFieldName = (value: unknown) => (
  ['报销人', '申请人'].includes(normalizeFlowApprovalOwnerText(value))
)

export const collectFlowApprovalOwnerSummaryFields = (value: unknown): FlowApprovalOwnerSummaryField[] => {
  if (!isFlowApprovalOwnerRecord(value)) {
    return []
  }
  const fieldId = normalizeFlowApprovalOwnerText(value.fieldId)
  const fieldName = normalizeFlowApprovalOwnerText(value.fieldName)
  if (!fieldId || !fieldName) {
    return []
  }
  const subFields = Array.isArray(value.subFields)
    ? value.subFields.flatMap(collectFlowApprovalOwnerSummaryFields)
    : []
  return [{
    fieldId,
    fieldName,
    ownerPolicy: normalizeFlowApprovalOwnerText(value.ownerPolicy),
    ...(subFields.length ? { subFields } : {}),
  }]
}

export const flattenFlowApprovalOwnerSummaryFields = (fields: FlowApprovalOwnerSummaryField[]) => (
  fields.flatMap(field => [
    field,
    ...flattenFlowApprovalOwnerSummaryFields(field.subFields || []),
  ])
)

export const resolveFlowApprovalOwnerSummaryTarget = (flowSummary: unknown): FlowApprovalOwnerSummaryTarget | null => {
  if (
    !isFlowApprovalOwnerRecord(flowSummary)
    || !isFlowApprovalOwnerRecord(flowSummary.forms)
    || !isFlowApprovalOwnerRecord(flowSummary.forms.currentForm)
  ) {
    return null
  }
  const currentForm = flowSummary.forms.currentForm
  const tableId = normalizeFlowApprovalOwnerText(currentForm.tableId)
  const tableName = normalizeFlowApprovalOwnerText(currentForm.tableName)
  if (!tableId && !tableName) {
    return null
  }
  return {
    tableId,
    tableName,
    fields: Array.isArray(currentForm.fields)
      ? currentForm.fields.flatMap(collectFlowApprovalOwnerSummaryFields)
      : [],
  }
}

export const resolveFlowSchemeDependencyState = (
  dependency: NocodeEditorFlowSchemeDependency,
): FlowApprovalOwnerDependencyState => ({
  isExisting: (
    dependency.resolutionStatus === 'resolved'
    && dependency.resolutionMode === 'use_existing'
    && dependency.materializationStatus === 'existing'
  ),
  isPlanned: (
    dependency.resolutionStatus === 'resolved'
    && dependency.resolutionMode === 'create_later'
    && dependency.materializationStatus === 'planned'
  ),
})

export const collectFlowSchemeSteps = (scheme: NocodeEditorFlowScheme) => [
  ...(scheme.mainPath || []),
  ...(scheme.branches || []).flatMap(branch => branch.steps || []),
]

export const collectFlowSchemeApprovalSteps = (scheme: NocodeEditorFlowScheme) => (
  collectFlowSchemeSteps(scheme).filter(step => step.kind === 'approval')
)

export const resolveFlowSchemeSingleDependency = (input: {
  dependencies?: NocodeEditorFlowSchemeDependency[] | null
  requiredFor: string
  scopeKey?: unknown
}): NocodeEditorFlowSchemeDependency | null => {
  const dependencies = (input.dependencies || []).filter(dependency => (
    dependency.requiredFor === input.requiredFor
  ))
  const scopeKey = normalizeFlowApprovalOwnerText(input.scopeKey)
  const stepDependencies = dependencies.filter(dependency => (
    dependency.scopeKind === 'step'
    && normalizeFlowApprovalOwnerText(dependency.scopeKey) === scopeKey
  ))
  if (stepDependencies.length === 1) {
    return stepDependencies[0]
  }
  const globalDependencies = dependencies.filter(dependency => dependency.scopeKind === 'global')
  return stepDependencies.length === 0 && globalDependencies.length === 1
    ? globalDependencies[0]
    : null
}

export const isSameFlowFormIdentity = (input: {
  leftId?: unknown
  leftName?: unknown
  rightId?: unknown
  rightName?: unknown
}): boolean => {
  const leftId = normalizeFlowApprovalOwnerText(input.leftId)
  const rightId = normalizeFlowApprovalOwnerText(input.rightId)
  if (leftId && rightId) {
    return leftId === rightId
  }
  const leftName = normalizeFlowApprovalOwnerText(input.leftName)
  const rightName = normalizeFlowApprovalOwnerText(input.rightName)
  return !leftName || !rightName || isSameFlowApprovalOwnerToken(leftName, rightName)
}

// 三方目标表单比对：plan↔scheme（可选）与 scheme↔当前表单证据；任一处不一致即视为上下文不符。
export const hasFlowApprovalOwnerTargetContextMismatch = (input: {
  plan?: NocodeEditorFlowPlan | null
  scheme: NocodeEditorFlowScheme
  target: { tableId?: unknown; tableName?: unknown } | null
}): boolean => {
  if (input.plan && !isSameFlowFormIdentity({
    leftId: input.plan.target?.formId,
    leftName: input.plan.target?.formName,
    rightId: input.scheme.target?.formId,
    rightName: input.scheme.target?.formName,
  })) {
    return true
  }
  if (!input.target) {
    return false
  }
  return !isSameFlowFormIdentity({
    leftId: input.scheme.target?.formId,
    leftName: input.scheme.target?.formName,
    rightId: input.target.tableId,
    rightName: input.target.tableName,
  })
}

// 依赖处于 unverified 时，只比对蓝图引用与已收敛依赖是否自相矛盾（字段 ID 优先、否则字段名）。
export const hasFlowApprovalOwnerUnverifiedFieldConflict = (input: {
  dependency: NocodeEditorFlowSchemeDependency
  actualFieldId?: unknown
  actualFieldName?: unknown
}): boolean => {
  const expectedFieldId = normalizeFlowApprovalOwnerText(input.dependency.fieldRef?.fieldId)
  const expectedFieldName = normalizeFlowApprovalOwnerText(input.dependency.fieldRef?.fieldName)
  const actualFieldId = normalizeFlowApprovalOwnerText(input.actualFieldId)
  const actualFieldName = normalizeFlowApprovalOwnerText(input.actualFieldName)
  if (expectedFieldId && actualFieldId) {
    return expectedFieldId !== actualFieldId
  }
  return Boolean(
    expectedFieldName
    && actualFieldName
    && !isSameFlowApprovalOwnerToken(expectedFieldName, actualFieldName),
  )
}