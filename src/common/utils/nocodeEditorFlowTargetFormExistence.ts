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
