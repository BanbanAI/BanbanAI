export type FlowTargetFormDeclarationStatus = 'no_target' | 'exists' | 'not_found'

export type FlowTargetFormDeclarationForm = {
  tableId?: string
  name?: string
}

export type FlowTargetFormDeclarationInput = {
  declaredFormId?: string
  declaredFormName?: string
  availableForms?: FlowTargetFormDeclarationForm[] | null
}

export type FlowTargetFormDeclarationResult = {
  status: FlowTargetFormDeclarationStatus
  matchedTableId?: string
  matchedName?: string
}

const normalizeFlowTargetFormToken = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

// 声明的每个身份都必须落到真实表单，且多个身份必须指向同一张表：
// 任一身份落空都拦截，避免“当前打开表单兜底 id”掩盖幻影表单名（名字被原样写进方案身份）。
// 名称按 token 归一化比对，避免空格/大小写/连字符差异造成误报。
export const resolveFlowTargetFormDeclaration = (
  input: FlowTargetFormDeclarationInput,
): FlowTargetFormDeclarationResult => {
  const declaredFormId = String(input?.declaredFormId || '').trim()
  const declaredFormName = String(input?.declaredFormName || '').trim()
  if (!declaredFormId && !declaredFormName) {
    return { status: 'no_target' }
  }
  const forms = Array.isArray(input?.availableForms) ? input.availableForms : []
  const byId = declaredFormId
    ? forms.find(item => String(item?.tableId || '').trim() === declaredFormId)
    : undefined
  if (declaredFormId && !byId) {
    return { status: 'not_found' }
  }
  const declaredNameToken = normalizeFlowTargetFormToken(declaredFormName)
  const byName = declaredNameToken
    ? forms.find(item => normalizeFlowTargetFormToken(item?.name) === declaredNameToken)
    : undefined
  if (declaredFormName && !byName) {
    return { status: 'not_found' }
  }
  if (
    byId
    && byName
    && String(byId.tableId || '').trim() !== String(byName.tableId || '').trim()
  ) {
    return { status: 'not_found' }
  }
  const matched = byId || byName
  if (!matched) {
    return { status: 'not_found' }
  }
  return {
    status: 'exists',
    matchedTableId: String(matched.tableId || '').trim() || undefined,
    matchedName: String(matched.name || '').trim() || undefined,
  }
}

export type FlowSchemeTargetIdentitySource = 'declared' | 'trusted' | 'previous' | 'active' | 'none'

export type FlowSchemeTargetIdentityResult = {
  formId: string
  formName: string
  source: FlowSchemeTargetIdentitySource
  inheritedFromPrevious: boolean
  declaredConflictsWithTrusted: boolean
}

// 目标表单是流程方案的身份：模型声明 → 确认卡可信上下文 → 上一版同名方案 → 当前打开表单。
// “当前打开的表单”只说明用户此刻在浏览哪张表，用户切到别的表单后回答卡片或重提方案时，
// 它不能覆盖已经建立的方案身份，否则目标会跟着人走。
export const resolveFlowSchemeTargetIdentity = (input: {
  declaredFormId?: unknown
  declaredFormName?: unknown
  trustedFormId?: unknown
  trustedFormName?: unknown
  previousFormId?: unknown
  previousFormName?: unknown
  previousTitle?: unknown
  currentTitle?: unknown
  activeFormId?: unknown
  activeFormName?: unknown
}): FlowSchemeTargetIdentityResult => {
  const text = (value: unknown) => String(value ?? '').trim()
  const declaredFormId = text(input?.declaredFormId)
  const declaredFormName = text(input?.declaredFormName)
  const trustedFormId = text(input?.trustedFormId)
  const trustedFormName = text(input?.trustedFormName)
  const previousFormId = text(input?.previousFormId)
  const previousFormName = text(input?.previousFormName)
  const declaredConflictsWithTrusted = Boolean(trustedFormId && (
    declaredFormId
      ? declaredFormId !== trustedFormId
      : Boolean(
        declaredFormName
        && trustedFormName
        && normalizeFlowTargetFormToken(declaredFormName) !== normalizeFlowTargetFormToken(trustedFormName),
      )
  ))
  const previousTitleToken = normalizeFlowTargetFormToken(input?.previousTitle)
  const inheritedFromPrevious = Boolean(
    !declaredFormId
    && !declaredFormName
    && !trustedFormId
    && !trustedFormName
    && previousTitleToken
    && previousTitleToken === normalizeFlowTargetFormToken(input?.currentTitle)
    && (previousFormId || previousFormName),
  )
  const formId = declaredFormId
    || (declaredConflictsWithTrusted ? '' : trustedFormId)
    || (inheritedFromPrevious ? previousFormId : '')
    || text(input?.activeFormId)
  const formName = declaredFormName
    || trustedFormName
    || (inheritedFromPrevious ? previousFormName : '')
    || text(input?.activeFormName)
  const source: FlowSchemeTargetIdentitySource = declaredFormId || declaredFormName
    ? 'declared'
    : trustedFormId || trustedFormName
      ? 'trusted'
      : inheritedFromPrevious
        ? 'previous'
        : formId || formName
          ? 'active'
          : 'none'
  return { formId, formName, source, inheritedFromPrevious, declaredConflictsWithTrusted }
}
