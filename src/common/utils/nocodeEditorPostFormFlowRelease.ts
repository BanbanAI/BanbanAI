import type { NocodeEditorPlanningScope } from './nocodeEditorPlanningScope'
import { isNocodeEditorPostFormFlowEnabledForScope } from './nocodeEditorPostFormFlowScope'

export type NocodeEditorPostFormFlowReleaseStatus =
  | 'disabled'
  | 'ready'
  | 'needs_fix'
  | 'blocked_related'

export type NocodeEditorPostFormFlowReleaseReasonCode =
  | 'scope_disabled'
  | 'ready'
  | 'formula_running'
  | 'issue_details_unavailable'
  | 'unrelated_issues'
  | 'related_issues'

export type NocodeEditorPostFormFlowReleaseIssue = {
  key: string
  source: 'draft' | 'formula'
  code: string
  targetFormId?: string
  targetFormName?: string
  targetFieldId?: string
  targetFieldKey?: string
  targetFieldName?: string
  message: string
}

export type NocodeEditorPostFormFlowReleaseDependency = {
  id: string
  requiredFor?: string
  targetFormId?: string
  targetFormName?: string
  targetFieldId?: string
  targetFieldKey?: string
  targetFieldName?: string
}

export type NocodeEditorPostFormFlowRelease = {
  status: NocodeEditorPostFormFlowReleaseStatus
  reasonCode: NocodeEditorPostFormFlowReleaseReasonCode
  shouldRender: boolean
  shouldAutoContinue: boolean
  canPlan: boolean
  canApply: boolean
  evaluationPending: boolean
  issueCount: number
  relatedIssueCount: number
  issues: NocodeEditorPostFormFlowReleaseIssue[]
  relatedIssues: NocodeEditorPostFormFlowReleaseIssue[]
}

type NocodeEditorPostFormFlowFormulaIssueLike = {
  code?: unknown
  severity?: unknown
  itemKey?: unknown
  target?: {
    formKey?: unknown
    formName?: unknown
    fieldKey?: unknown
    fieldName?: unknown
  } | null
  message?: unknown
}

type NocodeEditorPostFormFlowFormulaSummaryLike = {
  status?: 'status' | 'completed' | 'partial' | 'failed' | 'not_applicable'
  issues?: NocodeEditorPostFormFlowFormulaIssueLike[]
}

const normalizeText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/[\s\-_/\\]+/g, '')
  .replace(/[^\p{Letter}\p{Number}]/gu, '')

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeReleaseIssue = (
  value: unknown,
  index: number,
): NocodeEditorPostFormFlowReleaseIssue | null => {
  if (!isRecord(value)) {
    return null
  }

  const source = normalizeText(value.source)
  const code = normalizeText(value.code)
  const message = normalizeText(value.message)
  if ((source !== 'draft' && source !== 'formula') || !code || !message) {
    return null
  }

  const targetFormId = normalizeText(value.targetFormId) || undefined
  const targetFormName = normalizeText(value.targetFormName) || undefined
  const targetFieldId = normalizeText(value.targetFieldId) || undefined
  const targetFieldKey = normalizeText(value.targetFieldKey) || undefined
  const targetFieldName = normalizeText(value.targetFieldName) || undefined
  const key = normalizeText(value.key) || [
    source,
    targetFormId || targetFormName || 'form',
    targetFieldId || targetFieldKey || targetFieldName || index,
    code,
  ].join(':')

  return {
    key,
    source,
    code,
    targetFormId,
    targetFormName,
    targetFieldId,
    targetFieldKey,
    targetFieldName,
    message,
  }
}

const normalizeReleaseIssues = (
  values?: NocodeEditorPostFormFlowReleaseIssue[] | null,
) => {
  const issueByKey = new Map<string, NocodeEditorPostFormFlowReleaseIssue>()
  ;(Array.isArray(values) ? values : []).forEach((value, index) => {
    const issue = normalizeReleaseIssue(value, index)
    if (issue && !issueByKey.has(issue.key)) {
      issueByKey.set(issue.key, issue)
    }
  })
  return [...issueByKey.values()]
}

const normalizeFormulaSummaryIssues = (
  formulaSummary?: NocodeEditorPostFormFlowFormulaSummaryLike | null,
): NocodeEditorPostFormFlowReleaseIssue[] => (
  (Array.isArray(formulaSummary?.issues) ? formulaSummary!.issues! : [])
    .flatMap((issue, index) => {
      const code = normalizeText(issue?.code) || 'formula_issue'
      const message = normalizeText(issue?.message)
      if (!message) {
        return []
      }
      return [{
        key: `formula:${normalizeText(issue?.itemKey) || index}:${code}`,
        source: 'formula' as const,
        code,
        targetFormName: normalizeText(issue?.target?.formName) || undefined,
        targetFieldKey: normalizeText(issue?.target?.fieldKey) || undefined,
        targetFieldName: normalizeText(issue?.target?.fieldName) || undefined,
        message,
      }]
    })
)

const mergeReleaseIssues = (
  explicitIssues?: NocodeEditorPostFormFlowReleaseIssue[] | null,
  formulaSummary?: NocodeEditorPostFormFlowFormulaSummaryLike | null,
) => normalizeReleaseIssues([
  ...(Array.isArray(explicitIssues) ? explicitIssues : []),
  ...normalizeFormulaSummaryIssues(formulaSummary),
])

const normalizeReleaseDependencies = (
  values?: NocodeEditorPostFormFlowReleaseDependency[] | null,
) => (Array.isArray(values) ? values : []).flatMap((value) => {
  if (!isRecord(value)) {
    return []
  }
  const id = normalizeText(value.id)
  if (!id) {
    return []
  }
  return [{
    id,
    requiredFor: normalizeText(value.requiredFor) || undefined,
    targetFormId: normalizeText(value.targetFormId) || undefined,
    targetFormName: normalizeText(value.targetFormName) || undefined,
    targetFieldId: normalizeText(value.targetFieldId) || undefined,
    targetFieldKey: normalizeText(value.targetFieldKey) || undefined,
    targetFieldName: normalizeText(value.targetFieldName) || undefined,
  } satisfies NocodeEditorPostFormFlowReleaseDependency]
})

const hasSameTargetForm = (
  issue: NocodeEditorPostFormFlowReleaseIssue,
  dependency: NocodeEditorPostFormFlowReleaseDependency,
) => {
  if (issue.targetFormId && dependency.targetFormId) {
    return issue.targetFormId === dependency.targetFormId
  }
  if (issue.targetFormName && dependency.targetFormName) {
    return normalizeToken(issue.targetFormName) === normalizeToken(dependency.targetFormName)
  }
  return !(
    issue.targetFormId
    || issue.targetFormName
    || dependency.targetFormId
    || dependency.targetFormName
  )
}

const buildIssueNameKey = (issue: NocodeEditorPostFormFlowReleaseIssue) => {
  const fieldName = normalizeToken(issue.targetFieldName)
  if (!fieldName) {
    return ''
  }
  return `${normalizeToken(issue.targetFormId || issue.targetFormName || 'form')}:${fieldName}`
}

const collectRelatedReleaseIssues = (input: {
  issues: NocodeEditorPostFormFlowReleaseIssue[]
  dependencies: NocodeEditorPostFormFlowReleaseDependency[]
}) => {
  const issueNameCounts = new Map<string, number>()
  input.issues.forEach((issue) => {
    const nameKey = buildIssueNameKey(issue)
    if (nameKey) {
      issueNameCounts.set(nameKey, (issueNameCounts.get(nameKey) || 0) + 1)
    }
  })

  return input.issues.filter(issue => input.dependencies.some((dependency) => {
    if (!hasSameTargetForm(issue, dependency)) {
      return false
    }
    if (issue.targetFieldId && dependency.targetFieldId) {
      return issue.targetFieldId === dependency.targetFieldId
    }
    if (issue.targetFieldKey && dependency.targetFieldKey) {
      return normalizeToken(issue.targetFieldKey) === normalizeToken(dependency.targetFieldKey)
    }

    const issueFieldName = normalizeToken(issue.targetFieldName)
    const dependencyFieldName = normalizeToken(dependency.targetFieldName)
    if (!issueFieldName || issueFieldName !== dependencyFieldName) {
      return false
    }
    return issueNameCounts.get(buildIssueNameKey(issue)) === 1
  }))
}

const hasPendingAfterFormApplyIntent = (value: unknown) => (
  isRecord(value)
  && normalizeText(value.status) === 'pending_after_form_apply'
)

const buildRelease = (input: {
  status: NocodeEditorPostFormFlowReleaseStatus
  reasonCode: NocodeEditorPostFormFlowReleaseReasonCode
  shouldRender: boolean
  shouldAutoContinue: boolean
  canPlan: boolean
  canApply: boolean
  evaluationPending: boolean
  issues: NocodeEditorPostFormFlowReleaseIssue[]
  relatedIssues: NocodeEditorPostFormFlowReleaseIssue[]
}): NocodeEditorPostFormFlowRelease => ({
  ...input,
  issueCount: input.issues.length,
  relatedIssueCount: input.relatedIssues.length,
})

const releaseReasonCodesByStatus: Record<
  NocodeEditorPostFormFlowReleaseStatus,
  NocodeEditorPostFormFlowReleaseReasonCode[]
> = {
  disabled: ['scope_disabled'],
  ready: ['ready'],
  needs_fix: ['formula_running', 'issue_details_unavailable', 'unrelated_issues'],
  blocked_related: ['related_issues'],
}

export const normalizeNocodeEditorPostFormFlowRelease = (
  value: unknown,
): NocodeEditorPostFormFlowRelease | null => {
  if (!isRecord(value)) {
    return null
  }

  const status = normalizeText(value.status) as NocodeEditorPostFormFlowReleaseStatus
  const reasonCode = normalizeText(value.reasonCode) as NocodeEditorPostFormFlowReleaseReasonCode
  if (!releaseReasonCodesByStatus[status]?.includes(reasonCode)) {
    return null
  }

  const issues = normalizeReleaseIssues(
    Array.isArray(value.issues)
      ? value.issues as NocodeEditorPostFormFlowReleaseIssue[]
      : [],
  )
  const issueKeys = new Set(issues.map(issue => issue.key))
  const relatedIssues = normalizeReleaseIssues(
    Array.isArray(value.relatedIssues)
      ? value.relatedIssues as NocodeEditorPostFormFlowReleaseIssue[]
      : [],
  ).filter(issue => issueKeys.has(issue.key))

  if (status === 'blocked_related' && relatedIssues.length === 0) {
    return null
  }

  if (status === 'disabled') {
    return buildRelease({
      status,
      reasonCode,
      shouldRender: false,
      shouldAutoContinue: false,
      canPlan: false,
      canApply: false,
      evaluationPending: false,
      issues: [],
      relatedIssues: [],
    })
  }

  if (status === 'ready') {
    return buildRelease({
      status,
      reasonCode,
      shouldRender: true,
      shouldAutoContinue: value.shouldAutoContinue === true,
      canPlan: true,
      canApply: true,
      evaluationPending: false,
      issues: [],
      relatedIssues: [],
    })
  }

  if (status === 'blocked_related') {
    return buildRelease({
      status,
      reasonCode,
      shouldRender: true,
      shouldAutoContinue: false,
      canPlan: true,
      canApply: false,
      evaluationPending: false,
      issues,
      relatedIssues,
    })
  }

  const evaluationPending = reasonCode === 'formula_running'
  return buildRelease({
    status,
    reasonCode,
    shouldRender: !evaluationPending,
    shouldAutoContinue: false,
    canPlan: true,
    canApply: reasonCode === 'unrelated_issues',
    evaluationPending,
    issues,
    relatedIssues: [],
  })
}

export const resolveNocodeEditorPostFormFlowRelease = (input: {
  planningScope?: NocodeEditorPlanningScope | null
  persistenceMode?: 'saved' | 'draft_only' | null
  issues?: NocodeEditorPostFormFlowReleaseIssue[] | null
  dependencies?: NocodeEditorPostFormFlowReleaseDependency[] | null
  formulaSummary?: NocodeEditorPostFormFlowFormulaSummaryLike | null
  pendingFlowIntent?: unknown
}): NocodeEditorPostFormFlowRelease => {
  if (!isNocodeEditorPostFormFlowEnabledForScope(input.planningScope)) {
    return buildRelease({
      status: 'disabled',
      reasonCode: 'scope_disabled',
      shouldRender: false,
      shouldAutoContinue: false,
      canPlan: false,
      canApply: false,
      evaluationPending: false,
      issues: [],
      relatedIssues: [],
    })
  }

  const issues = mergeReleaseIssues(input.issues, input.formulaSummary)
  if (input.formulaSummary?.status === 'status') {
    return buildRelease({
      status: 'needs_fix',
      reasonCode: 'formula_running',
      shouldRender: false,
      shouldAutoContinue: false,
      canPlan: true,
      canApply: false,
      evaluationPending: true,
      issues,
      relatedIssues: [],
    })
  }

  const relatedIssues = collectRelatedReleaseIssues({
    issues,
    dependencies: normalizeReleaseDependencies(input.dependencies),
  })
  if (relatedIssues.length > 0) {
    return buildRelease({
      status: 'blocked_related',
      reasonCode: 'related_issues',
      shouldRender: true,
      shouldAutoContinue: false,
      canPlan: true,
      canApply: false,
      evaluationPending: false,
      issues,
      relatedIssues,
    })
  }

  const formulaFailed = (
    input.formulaSummary?.status === 'partial'
    || input.formulaSummary?.status === 'failed'
  )
  const issueDetailsUnavailable = (
    input.persistenceMode === 'draft_only' || formulaFailed
  ) && issues.length === 0
  if (issues.length > 0 || issueDetailsUnavailable) {
    return buildRelease({
      status: 'needs_fix',
      reasonCode: issueDetailsUnavailable ? 'issue_details_unavailable' : 'unrelated_issues',
      shouldRender: true,
      shouldAutoContinue: false,
      canPlan: true,
      canApply: !issueDetailsUnavailable,
      evaluationPending: false,
      issues,
      relatedIssues: [],
    })
  }

  return buildRelease({
    status: 'ready',
    reasonCode: 'ready',
    shouldRender: true,
    shouldAutoContinue: hasPendingAfterFormApplyIntent(input.pendingFlowIntent),
    canPlan: true,
    canApply: true,
    evaluationPending: false,
    issues: [],
    relatedIssues: [],
  })
}
