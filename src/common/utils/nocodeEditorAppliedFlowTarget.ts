export type NocodeEditorAppliedFlowTargetIdentity = {
  targetFormId?: string
  targetFormName?: string
}

// 表单规划会把当前表单关联到的来源表一并生成；这些依赖表不参与流程推荐。
// 主表单身份由规划上下文给出（primaryFormKey / 蓝图标题），而不是按批次里“只剩一张”来推断。
export type NocodeEditorAppliedFlowTargetHints = {
  primaryFormKey?: unknown
  primaryFormName?: unknown
}

type AppliedFormCandidate = {
  tableId: string
  tableName: string
  formKey: string
  applyTargetKey: string
  isPrimary: boolean
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const readAppliedForm = (value: unknown): AppliedFormCandidate | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  const tableId = normalizeText(record.tableId)
  const tableName = normalizeText(record.tableName)
  if (!tableId && !tableName) {
    return null
  }
  const formKey = normalizeText(record.formKey)
  const applyTargetKey = normalizeText(record.applyTargetKey)
  return {
    tableId,
    tableName,
    formKey,
    applyTargetKey,
    // 宿主给每张蓝图表单算的 applyTargetKey：模型声明过 formKey 时就是 formKey；
    // 归一化阶段补进来的来源表没有 formKey，key 会退化成 group:|table:<name>。
    isPrimary: Boolean(formKey && formKey === applyTargetKey),
  }
}

const matchesPrimaryFormHints = (
  candidate: AppliedFormCandidate,
  hints: { primaryFormKey: string; primaryFormName: string },
) => {
  if (hints.primaryFormKey) {
    // 规划上下文里的 primaryFormKey 通常是 formKey，缺少 formKey 时会退化成表名。
    if (
      candidate.formKey === hints.primaryFormKey
      || candidate.applyTargetKey === hints.primaryFormKey
      || candidate.tableName === hints.primaryFormKey
    ) {
      return true
    }
  }
  return Boolean(hints.primaryFormName) && candidate.tableName === hints.primaryFormName
}

const toIdentity = (candidate: AppliedFormCandidate): NocodeEditorAppliedFlowTargetIdentity => ({
  targetFormId: candidate.tableId || undefined,
  targetFormName: candidate.tableName || undefined,
})

// 一次蓝图应用可能同时落下用户要的表单和它依赖的来源表；用户这条需求指向的只是前者。
// 返回的 id/name 一定来自本次批次，不会回落到挂账或入口意图里“当时打开的表单”。
export const resolveNocodeEditorAppliedPrimaryForm = (
  forms?: readonly unknown[] | null,
  hints?: NocodeEditorAppliedFlowTargetHints | null,
): NocodeEditorAppliedFlowTargetIdentity => {
  const candidates: AppliedFormCandidate[] = []
  const seenKeys = new Set<string>()
  for (const form of Array.isArray(forms) ? forms : []) {
    const candidate = readAppliedForm(form)
    if (!candidate) {
      continue
    }
    const dedupeKey = candidate.tableId || `name:${candidate.tableName}`
    if (seenKeys.has(dedupeKey)) {
      continue
    }
    seenKeys.add(dedupeKey)
    candidates.push(candidate)
  }
  if (!candidates.length) {
    return {}
  }
  if (candidates.length === 1) {
    return toIdentity(candidates[0])
  }

  const normalizedHints = {
    primaryFormKey: normalizeText(hints?.primaryFormKey),
    primaryFormName: normalizeText(hints?.primaryFormName),
  }
  if (normalizedHints.primaryFormKey || normalizedHints.primaryFormName) {
    const hintedCandidates = candidates.filter(candidate => (
      matchesPrimaryFormHints(candidate, normalizedHints)
    ))
    // 提示只用于消除多表批次里的歧义；命中多张说明提示本身对不上身份，继续按原规则处理。
    if (hintedCandidates.length === 1) {
      return toIdentity(hintedCandidates[0])
    }
  }

  const primaryCandidates = candidates.filter(candidate => candidate.isPrimary)
  if (primaryCandidates.length !== 1) {
    return {}
  }
  return toIdentity(primaryCandidates[0])
}
