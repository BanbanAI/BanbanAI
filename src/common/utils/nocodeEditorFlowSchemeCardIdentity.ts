import { parsePlanningConfirmationContextKey } from './nocodeEditorPlanningConfirmationIdentity'

const normalizeText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim()

export const resolveFlowSchemeContextFormKey = (contextKey?: string | null) => (
  normalizeText(parsePlanningConfirmationContextKey(contextKey).primaryFormKey)
)

// 暂存态身份优先于翻历史消息：历史里最后一张卡可能属于另一张表单。
export const pickFlowSchemePlanningContextKey = (
  ...candidates: Array<string | null | undefined>
) => {
  for (const candidate of candidates) {
    const value = normalizeText(candidate)
    if (value) {
      return value
    }
  }
  return ''
}

// 表单 id 统一是 t_ 前缀（见 TableUID）；身份里没有方案目标可对照时，
// 靠它判断 key 存的是表单 id 还是表单名，避免拿 id 去和名字比出假差异。
export const isFlowSchemeContextFormIdLike = (contextFormKey?: string | null) => (
  /^t_/i.test(normalizeText(contextFormKey))
)

// 上下文身份里的表单可以用表单 id 或表单名表示；只把同一种表示放在一起比，
// 否则「id 对名字」会得出假的差异。
export const resolveFlowSchemeFormIdentityKind = (input: {
  contextFormKey?: string | null
  formId?: string | null
  formName?: string | null
}) => {
  const contextFormKey = normalizeText(input.contextFormKey)
  if (!contextFormKey) {
    return null
  }
  if (normalizeText(input.formId) === contextFormKey) {
    return 'id' as const
  }
  if (normalizeText(input.formName) === contextFormKey) {
    return 'name' as const
  }
  return null
}

const normalizeFormToken = (value: unknown) => normalizeText(value).replace(/\s+/g, '').toLowerCase()

export type FlowSchemeIdentityCandidate = {
  planningContextKey?: string | null
  title?: string | null
  formId?: string | null
  formName?: string | null
}

// 方案身份里的表单可能是 id 也可能是名字；题目决策目标同时给出两者，任一对上就是同一张表单。
export const isFlowSchemeIdentityCandidateForForm = (
  candidate: FlowSchemeIdentityCandidate | null | undefined,
  target: { formId?: string | null; formName?: string | null },
) => {
  if (!candidate) {
    return false
  }
  const targetFormId = normalizeText(target.formId)
  const targetFormName = normalizeFormToken(target.formName)
  if (!targetFormId && !targetFormName) {
    return false
  }
  const contextFormKey = resolveFlowSchemeContextFormKey(candidate.planningContextKey)
  if (contextFormKey) {
    return Boolean(
      (targetFormId && contextFormKey === targetFormId)
      || (targetFormName && normalizeFormToken(contextFormKey) === targetFormName),
    )
  }
  return Boolean(
    (targetFormId && normalizeText(candidate.formId) === targetFormId)
    || (targetFormName && normalizeFormToken(candidate.formName) === targetFormName),
  )
}

// 兜底确认卡问的是某张表单上的问题：身份只能取自指向同一张表单的来源。
// 上一张卡可能是另一张表单的方案，直接沿用会把它的方案名和版本族借给当前流程。
export const resolveFlowSchemeGroundingIdentity = (input: {
  questions?: Array<{ decisionTarget?: { formKey?: string | null; formName?: string | null } | null }> | null
  candidates: FlowSchemeIdentityCandidate[]
}): (FlowSchemeIdentityCandidate & { targetFormId?: string; targetFormName?: string }) | null => {
  const targetForm = (Array.isArray(input.questions) ? input.questions : [])
    .map(question => question?.decisionTarget)
    .find(target => normalizeText(target?.formKey) || normalizeText(target?.formName))
  const targetFormId = normalizeText(targetForm?.formKey)
  const targetFormName = normalizeText(targetForm?.formName)
  const usable = input.candidates.filter(candidate => (
    normalizeText(candidate?.planningContextKey) || normalizeText(candidate?.title)
  ))
  if (!targetFormId && !targetFormName) {
    return usable[0] || null
  }

  const matchedCandidates = usable.filter(candidate => isFlowSchemeIdentityCandidateForForm(candidate, {
    formId: targetFormId,
    formName: targetFormName,
  }))
  if (!matchedCandidates.length) {
    return null
  }

  // 能定身份的是 key；只有标题的来源（例如尚未写入 key 的暂存态）用来补标题，
  // 不能反过来让空 key 覆盖掉同表单已有的方案身份。
  const matched = matchedCandidates.find(candidate => normalizeText(candidate.planningContextKey))
    || matchedCandidates[0]
  const title = normalizeText(matched.title)
    || matchedCandidates.map(candidate => normalizeText(candidate.title)).find(Boolean)
    || undefined
  return {
    ...matched,
    title,
    targetFormId: targetFormId || undefined,
    targetFormName: targetFormName || undefined,
  }
}
