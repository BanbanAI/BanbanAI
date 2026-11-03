import {
  isSameNocodeEditorBlueprintForm,
  normalizeNocodeEditorBlueprintIdentityToken,
} from '@common/utils/nocodeEditorBlueprintFormNormalization'
import {
  buildBlueprintFieldIdentityPathTokens,
  getBlueprintFieldNameIdentityKey,
  getBlueprintFieldStableIdentityKey,
  normalizeBlueprintIdentityToken,
  resolveBlueprintFieldPath,
} from './blueprintFieldIdentity'
import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
} from './types'

export type BlueprintFieldDeletionMatcher = {
  directKeys: Set<string>
  pathKeys: Set<string>
}

const BLUEPRINT_DELETION_FORM_DIAGNOSTIC_LIMIT = 12
const BLUEPRINT_DELETION_FIELD_DIAGNOSTIC_LIMIT = 20

const formatBlueprintFieldPathLabel = (
  path: readonly NocodeEditorAiAppBlueprintField[],
) => path
  .map(field => String(field?.name || '').trim() || String(field?.fieldKey || '').trim())
  .filter(Boolean)
  .join('.')

const formatBlueprintFieldPathIdentityLabel = (
  path: readonly NocodeEditorAiAppBlueprintField[],
) => {
  const nameLabel = formatBlueprintFieldPathLabel(path)
  const keyLabel = path
    .map(field => String(field?.fieldKey || '').trim())
    .filter(Boolean)
    .join('.')
  if (nameLabel && keyLabel && nameLabel !== keyLabel) {
    return `${nameLabel}（${keyLabel}）`
  }
  return nameLabel || keyLabel
}

const formatBlueprintFormLabel = (
  form: Partial<NocodeEditorAiAppBlueprintForm> | null | undefined,
) => {
  const tableName = String(form?.tableName || '').trim() || '未命名表单'
  const formKey = String(form?.formKey || '').trim()
  const groupName = String(form?.groupName || '').trim()
  return [
    tableName,
    formKey ? `formKey=${formKey}` : '',
    groupName ? `groupName=${groupName}` : '',
  ].filter(Boolean).join('，')
}

const formatLimitedList = (values: readonly string[], limit: number) => {
  const list = values.map(value => String(value || '').trim()).filter(Boolean)
  if (!list.length) {
    return ''
  }
  const visible = list.slice(0, limit)
  return list.length > limit
    ? `${visible.join('、')} 等 ${list.length} 项`
    : visible.join('、')
}

export type BlueprintDeletionSource = 'deletedFormKeys' | 'deletedFields'

export type BlueprintDeletionIssue =
  | {
    kind: 'unresolved_form'
    reference: string
    source: BlueprintDeletionSource
  }
  | {
    kind: 'ambiguous_form'
    reference: string
    source: BlueprintDeletionSource
    candidates: NocodeEditorAiAppBlueprintForm[]
  }
  | {
    kind: 'unresolved_field'
    formReference: string
    fieldReference: string
    availablePaths: string[]
  }
  | {
    kind: 'ambiguous_field'
    formReference: string
    fieldReference: string
    candidatePaths: string[]
  }

export type BlueprintDeletionPlan = {
  deletedForms: Set<NocodeEditorAiAppBlueprintForm>
  fieldKeysByForm: Map<NocodeEditorAiAppBlueprintForm, string[]>
  issues: BlueprintDeletionIssue[]
}

type BlueprintFormReferenceResolution =
  | { kind: 'matched'; form: NocodeEditorAiAppBlueprintForm }
  | { kind: 'ambiguous'; candidates: NocodeEditorAiAppBlueprintForm[] }
  | { kind: 'unresolved' }

// 表单引用与 patch 合并共用同一身份口径：稳定 key 优先，缺失时按表名唯一兜底。
const resolveBlueprintFormReference = (
  forms: readonly NocodeEditorAiAppBlueprintForm[],
  reference: unknown,
): BlueprintFormReferenceResolution => {
  const raw = String(reference || '').trim()
  if (!raw) {
    return { kind: 'unresolved' }
  }

  const exactMatches = forms.filter(form => String(form.formKey || '').trim() === raw)
  if (exactMatches.length) {
    return exactMatches.length === 1
      ? { kind: 'matched', form: exactMatches[0] }
      : { kind: 'ambiguous', candidates: exactMatches }
  }

  const normalizedKey = normalizeNocodeEditorBlueprintIdentityToken(raw)
  const normalizedKeyMatches = normalizedKey
    ? forms.filter(form => (
      normalizeNocodeEditorBlueprintIdentityToken(form.formKey) === normalizedKey
    ))
    : []
  if (normalizedKeyMatches.length) {
    return normalizedKeyMatches.length === 1
      ? { kind: 'matched', form: normalizedKeyMatches[0] }
      : { kind: 'ambiguous', candidates: normalizedKeyMatches }
  }

  const tableNameMatches = forms.filter(form => (
    isSameNocodeEditorBlueprintForm(form, { tableName: raw })
  ))
  if (tableNameMatches.length === 1) {
    return { kind: 'matched', form: tableNameMatches[0] }
  }
  return tableNameMatches.length > 1
    ? { kind: 'ambiguous', candidates: tableNameMatches }
    : { kind: 'unresolved' }
}

// 删除清单里的「父.子」路径先解析成真实字段链再匹配；
// 解析失败的标识仍按原始 key 做兜底匹配，保持与合并链路一致的三级口径。
export const buildBlueprintFieldDeletionMatcher = (
  fields: readonly NocodeEditorAiAppBlueprintField[] | null | undefined,
  keys: Array<string | undefined> | null | undefined,
): BlueprintFieldDeletionMatcher => {
  const directKeys = new Set<string>()
  const pathKeys = new Set<string>()

  for (const key of Array.isArray(keys) ? keys : []) {
    const raw = String(key || '').trim()
    if (!raw) {
      continue
    }
    const pathResolution = resolveBlueprintFieldPath(raw, fields)
    if (pathResolution?.kind === 'ambiguous') {
      const candidatePaths = pathResolution.candidates
        .map(candidate => formatBlueprintFieldPathLabel([...pathResolution.fieldChain, candidate]))
        .join('、')
      throw new Error(
        `删除字段路径「${raw}」在当前暂存蓝图中存在多个匹配：${candidatePaths}。`
        + '请改用带稳定 fieldKey 的「父字段.子字段」路径，或先调用 editor_get_staged_app_blueprint（detail="structure"）核对结构后重试。',
      )
    }
    if (pathResolution?.kind === 'existing') {
      buildBlueprintFieldIdentityPathTokens(pathResolution.fieldChain).forEach(token => pathKeys.add(token))
      continue
    }
    directKeys.add(raw)
    const token = normalizeBlueprintIdentityToken(raw)
    if (token) {
      directKeys.add(token)
    }
  }

  return { directKeys, pathKeys }
}

export const isBlueprintFieldMarkedDeleted = (
  field: Partial<NocodeEditorAiAppBlueprintField> | null | undefined,
  matcher?: BlueprintFieldDeletionMatcher | null,
  fieldPath: readonly (Partial<NocodeEditorAiAppBlueprintField> | null | undefined)[] = [],
) => {
  if (!matcher) {
    return false
  }

  if (matcher.directKeys.size) {
    const stableKey = getBlueprintFieldStableIdentityKey(field)
    if (stableKey && matcher.directKeys.has(stableKey)) {
      return true
    }
    const normalizedFieldKey = normalizeBlueprintIdentityToken(stableKey)
    if (normalizedFieldKey && matcher.directKeys.has(normalizedFieldKey)) {
      return true
    }
    const nameKey = getBlueprintFieldNameIdentityKey(field)
    if (nameKey && matcher.directKeys.has(nameKey)) {
      return true
    }
  }

  return Boolean(
    matcher.pathKeys.size
    && fieldPath.length
    && buildBlueprintFieldIdentityPathTokens(fieldPath).some(token => matcher.pathKeys.has(token)),
  )
}

const walkBlueprintFields = (
  fields: readonly NocodeEditorAiAppBlueprintField[] | null | undefined,
  visit: (
    field: NocodeEditorAiAppBlueprintField,
    path: NocodeEditorAiAppBlueprintField[],
  ) => void,
  parentPath: NocodeEditorAiAppBlueprintField[] = [],
) => {
  for (const field of Array.isArray(fields) ? fields : []) {
    const fieldPath = [...parentPath, field]
    visit(field, fieldPath)
    walkBlueprintFields(field.children, visit, fieldPath)
  }
}

const collectBlueprintFieldDeletionMatches = (
  fields: readonly NocodeEditorAiAppBlueprintField[] | null | undefined,
  matcher: BlueprintFieldDeletionMatcher,
) => {
  const matches: Array<{
    field: NocodeEditorAiAppBlueprintField
    path: NocodeEditorAiAppBlueprintField[]
  }> = []
  walkBlueprintFields(fields, (field, path) => {
    if (isBlueprintFieldMarkedDeleted(field, matcher, path)) {
      matches.push({ field, path })
    }
  })
  return matches
}

const listBlueprintFieldPathLabels = (
  fields: readonly NocodeEditorAiAppBlueprintField[] | null | undefined,
) => {
  const labels: string[] = []
  walkBlueprintFields(fields, (_field, path) => {
    const label = formatBlueprintFieldPathIdentityLabel(path)
    if (label) {
      labels.push(label)
    }
  })
  return labels
}

const pushBlueprintFormIssue = (
  issues: BlueprintDeletionIssue[],
  reference: string,
  source: BlueprintDeletionSource,
  resolution: BlueprintFormReferenceResolution,
) => {
  if (resolution.kind === 'ambiguous') {
    issues.push({
      kind: 'ambiguous_form',
      reference,
      source,
      candidates: resolution.candidates,
    })
    return
  }
  if (resolution.kind === 'unresolved') {
    issues.push({ kind: 'unresolved_form', reference, source })
  }
}

// 删除清单必须整体可解析：部分命中就落库会静默删一半，后续重试还会叠加身份漂移。
export const resolveBlueprintDeletionPlan = (
  blueprint: NocodeEditorAiAppBlueprint | null | undefined,
  deletedFormKeys: Array<string | undefined> | null | undefined,
  deletedFields: Array<{
    formKey?: string
    fieldKeys?: string[]
  }> | null | undefined,
): BlueprintDeletionPlan => {
  const forms = Array.isArray(blueprint?.forms) ? blueprint.forms : []
  const deletedForms = new Set<NocodeEditorAiAppBlueprintForm>()
  const fieldKeysByForm = new Map<NocodeEditorAiAppBlueprintForm, string[]>()
  const issues: BlueprintDeletionIssue[] = []

  for (const reference of Array.isArray(deletedFormKeys) ? deletedFormKeys : []) {
    const raw = String(reference || '').trim()
    if (!raw) {
      continue
    }
    const resolution = resolveBlueprintFormReference(forms, raw)
    if (resolution.kind === 'matched') {
      deletedForms.add(resolution.form)
      continue
    }
    pushBlueprintFormIssue(issues, raw, 'deletedFormKeys', resolution)
  }

  for (const item of Array.isArray(deletedFields) ? deletedFields : []) {
    const formReference = String(item?.formKey || '').trim()
    const fieldKeys = Array.from(new Set(
      (Array.isArray(item?.fieldKeys) ? item.fieldKeys : [])
        .map(key => String(key || '').trim())
        .filter(Boolean),
    ))
    if (!formReference || !fieldKeys.length) {
      continue
    }

    const resolution = resolveBlueprintFormReference(forms, formReference)
    if (resolution.kind !== 'matched') {
      pushBlueprintFormIssue(issues, formReference, 'deletedFields', resolution)
      continue
    }
    const form = resolution.form
    if (deletedForms.has(form)) {
      continue
    }
    const fields = Array.isArray(form.fields) ? form.fields : []
    const validFieldKeys: string[] = []

    for (const fieldReference of fieldKeys) {
      const pathResolution = resolveBlueprintFieldPath(fieldReference, fields)
      if (pathResolution?.kind === 'ambiguous') {
        issues.push({
          kind: 'ambiguous_field',
          formReference,
          fieldReference,
          candidatePaths: pathResolution.candidates.map(candidate => (
            formatBlueprintFieldPathIdentityLabel([...pathResolution.fieldChain, candidate])
          )),
        })
        continue
      }

      const matcher = buildBlueprintFieldDeletionMatcher(fields, [fieldReference])
      const matches = collectBlueprintFieldDeletionMatches(fields, matcher)
      if (!matches.length) {
        issues.push({
          kind: 'unresolved_field',
          formReference,
          fieldReference,
          availablePaths: listBlueprintFieldPathLabels(fields),
        })
        continue
      }
      if (matches.length > 1) {
        issues.push({
          kind: 'ambiguous_field',
          formReference,
          fieldReference,
          candidatePaths: matches.map(match => formatBlueprintFieldPathIdentityLabel(match.path)),
        })
        continue
      }
      validFieldKeys.push(fieldReference)
    }

    if (validFieldKeys.length) {
      fieldKeysByForm.set(
        form,
        Array.from(new Set([
          ...(fieldKeysByForm.get(form) || []),
          ...validFieldKeys,
        ])),
      )
    }
  }

  return { deletedForms, fieldKeysByForm, issues }
}

export const formatBlueprintDeletionPlanIssues = (
  plan: BlueprintDeletionPlan,
  blueprint: NocodeEditorAiAppBlueprint | null | undefined,
): string => {
  const forms = Array.isArray(blueprint?.forms) ? blueprint.forms : []
  const availableFormLabels = forms.length
    ? formatLimitedList(
      forms.map(form => formatBlueprintFormLabel(form)),
      BLUEPRINT_DELETION_FORM_DIAGNOSTIC_LIMIT,
    )
    : '无'

  const detailLines = plan.issues.map((issue) => {
    switch (issue.kind) {
    case 'ambiguous_form': {
      const candidates = formatLimitedList(
        issue.candidates.map(candidate => formatBlueprintFormLabel(candidate)),
        BLUEPRINT_DELETION_FORM_DIAGNOSTIC_LIMIT,
      )
      return `- 删除表单「${issue.reference}」：匹配到多个表单（${candidates}），请改用稳定 formKey。`
    }
    case 'unresolved_form':
      return `- 删除表单「${issue.reference}」：当前暂存蓝图中没有匹配项。可用表单标识：${availableFormLabels}。`
    case 'ambiguous_field': {
      const candidatePaths = formatLimitedList(
        issue.candidatePaths,
        BLUEPRINT_DELETION_FIELD_DIAGNOSTIC_LIMIT,
      )
      return `- 删除字段「${issue.fieldReference}」（表单「${issue.formReference}」）：匹配到多个字段（${candidatePaths}），请改用「父字段.子字段」路径。`
    }
    case 'unresolved_field': {
      const availableFields = issue.availablePaths.length
        ? formatLimitedList(issue.availablePaths, BLUEPRINT_DELETION_FIELD_DIAGNOSTIC_LIMIT)
        : '该表单暂无字段'
      return `- 删除字段「${issue.fieldReference}」（表单「${issue.formReference}」）：未找到匹配字段。可用字段路径：${availableFields}。`
    }
    default:
      return ''
    }
  }).filter(Boolean)

  return [
    'patch 的删除清单有目标无法唯一解析，已取消本次暂存：',
    ...detailLines,
    '请先调用 editor_get_staged_app_blueprint（detail="structure"）核对 formIdentity / fieldKey 后重试。',
  ].join('\n')
}
