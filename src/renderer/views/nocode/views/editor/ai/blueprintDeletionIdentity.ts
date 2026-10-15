import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiAppBlueprintField,
  NocodeEditorAiAppBlueprintForm,
} from './types'

export const normalizeBlueprintIdentityToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s\-_/\\]/g, '')
  .replace(/[？?！!，,。、“”"'‘’：:；;（）()【】[\]《》<>]/g, '')

export const getBlueprintFieldStableIdentityKey = (field: Partial<NocodeEditorAiAppBlueprintField> | null | undefined) => (
  String(field?.fieldKey || '').trim()
)

export const getBlueprintFieldNameIdentityKey = (field: Partial<NocodeEditorAiAppBlueprintField> | null | undefined) => (
  normalizeBlueprintIdentityToken(field?.name)
)

// 删除清单的 key 按「真实 fieldKey → 归一化 fieldKey → 归一化字段名」三级匹配，
// 与合并链路的字段解析口径保持一致；模型偶尔会拿字段名当 fieldKey 传入。
export const buildBlueprintDeletionKeySet = (keys: Array<string | undefined> | null | undefined) => new Set(
  (Array.isArray(keys) ? keys : []).flatMap((key) => {
    const raw = String(key || '').trim()
    if (!raw) {
      return []
    }
    const token = normalizeBlueprintIdentityToken(raw)
    return token && token !== raw ? [raw, token] : [raw]
  }),
)

export const isBlueprintFieldMarkedDeleted = (
  field: Partial<NocodeEditorAiAppBlueprintField> | null | undefined,
  deletedFieldKeys?: Set<string>,
) => {
  if (!deletedFieldKeys?.size) {
    return false
  }

  const stableKey = getBlueprintFieldStableIdentityKey(field)
  if (stableKey && deletedFieldKeys.has(stableKey)) {
    return true
  }

  const normalizedFieldKey = normalizeBlueprintIdentityToken(stableKey)
  if (normalizedFieldKey && deletedFieldKeys.has(normalizedFieldKey)) {
    return true
  }

  const nameKey = getBlueprintFieldNameIdentityKey(field)
  return Boolean(nameKey && deletedFieldKeys.has(nameKey))
}

export const countBlueprintDeletionMatches = (
  blueprint: NocodeEditorAiAppBlueprint | null | undefined,
  deletedFormKeys: string[],
  deletedFields: Array<{ formKey: string, fieldKeys: string[] }>,
) => {
  const forms = Array.isArray(blueprint?.forms) ? blueprint.forms : []
  if (!forms.length) {
    return 0
  }

  const deletedFormKeySet = new Set(deletedFormKeys)
  const deletedFieldKeyMap = new Map(
    deletedFields.map(item => [item.formKey, buildBlueprintDeletionKeySet(item.fieldKeys)] as const),
  )
  const countFieldDeletionMatches = (
    fields: NocodeEditorAiAppBlueprintField[],
    deletedFieldKeys: Set<string>,
  ): number => fields.reduce((total, field) => (
    total
    + (isBlueprintFieldMarkedDeleted(field, deletedFieldKeys) ? 1 : 0)
    + countFieldDeletionMatches(Array.isArray(field.children) ? field.children : [], deletedFieldKeys)
  ), 0)

  return forms.reduce((total, form: NocodeEditorAiAppBlueprintForm) => {
    const formKey = String(form.formKey || '').trim()
    if (formKey && deletedFormKeySet.has(formKey)) {
      return total + 1
    }
    const deletedFieldKeys = formKey ? deletedFieldKeyMap.get(formKey) : undefined
    if (!deletedFieldKeys?.size) {
      return total
    }
    return total + countFieldDeletionMatches(Array.isArray(form.fields) ? form.fields : [], deletedFieldKeys)
  }, 0)
}
