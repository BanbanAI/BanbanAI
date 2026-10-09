export type NocodeEditorPlanningFormReferenceForm = {
  formKey?: string
  tableName?: string
  groupName?: string
}

export type NocodeEditorPlanningFormReferenceAliasEntry = {
  candidateFormKeys: ReadonlySet<string>
  ambiguous: boolean
}

export type NocodeEditorPlanningFormReferenceIndex = {
  canonicalKeys: ReadonlyMap<string, NocodeEditorPlanningFormReferenceAliasEntry>
  aliases: ReadonlyMap<string, NocodeEditorPlanningFormReferenceAliasEntry>
}

export const normalizeNocodeEditorPlanningFormReferenceAlias = (value: unknown) => String(value || '')
  .normalize('NFKC')
  .trim()
  .toLowerCase()
  .replace(/["'`“”‘’：:，,。！？!？；;（）()【】<>]/g, '')
  .replace(/[[\]]/g, '')
  .replace(/[\s._/\\-]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildAliasKeys = (value: unknown) => {
  const normalized = normalizeNocodeEditorPlanningFormReferenceAlias(value)
  if (!normalized) {
    return []
  }
  const compact = normalized.replace(/-/g, '')
  return compact && compact !== normalized
    ? [normalized, compact]
    : [normalized]
}

export const buildNocodeEditorPlanningFormReferenceIndex = (
  forms: NocodeEditorPlanningFormReferenceForm[],
): NocodeEditorPlanningFormReferenceIndex => {
  type MutableEntry = {
    candidateFormKeys: Set<string>
    formIndexes: Set<number>
  }
  const mutableCanonicalKeys = new Map<string, MutableEntry>()
  const mutableAliases = new Map<string, {
    candidateFormKeys: Set<string>
    formIndexes: Set<number>
  }>()

  const appendReferences = (
    target: Map<string, MutableEntry>,
    reference: unknown,
    formKey: string,
    formIndex: number,
  ) => {
    buildAliasKeys(reference).forEach((alias) => {
      const entry = target.get(alias) || {
        candidateFormKeys: new Set<string>(),
        formIndexes: new Set<number>(),
      }
      entry.candidateFormKeys.add(formKey)
      entry.formIndexes.add(formIndex)
      target.set(alias, entry)
    })
  }

  forms.forEach((form, formIndex) => {
    const formKey = String(form?.formKey || '').trim()
    if (!formKey) {
      return
    }
    const tableName = String(form?.tableName || '').trim()
    const groupName = String(form?.groupName || '').trim()
    appendReferences(mutableCanonicalKeys, formKey, formKey, formIndex)
    appendReferences(mutableAliases, tableName, formKey, formIndex)
    appendReferences(
      mutableAliases,
      groupName && tableName ? `${groupName}-${tableName}` : '',
      formKey,
      formIndex,
    )
  })

  const canonicalKeys = new Map<string, NocodeEditorPlanningFormReferenceAliasEntry>()
  mutableCanonicalKeys.forEach((entry, alias) => {
    canonicalKeys.set(alias, {
      candidateFormKeys: new Set(entry.candidateFormKeys),
      ambiguous: entry.candidateFormKeys.size !== 1 || entry.formIndexes.size !== 1,
    })
  })

  const lookupEntry = (
    entries: ReadonlyMap<string, NocodeEditorPlanningFormReferenceAliasEntry>,
    value: unknown,
  ) => {
    for (const alias of buildAliasKeys(value)) {
      const entry = entries.get(alias)
      if (entry) {
        return entry
      }
    }
    return undefined
  }

  const aliases = new Map<string, NocodeEditorPlanningFormReferenceAliasEntry>()
  mutableAliases.forEach((entry, alias) => {
    const hasAmbiguousCandidateFormKey = Array.from(entry.candidateFormKeys).some((formKey) => {
      const canonicalEntry = lookupEntry(canonicalKeys, formKey)
      return !canonicalEntry || canonicalEntry.ambiguous
    })
    aliases.set(alias, {
      candidateFormKeys: new Set(entry.candidateFormKeys),
      ambiguous: hasAmbiguousCandidateFormKey
        || entry.candidateFormKeys.size !== 1
        || entry.formIndexes.size !== 1,
    })
  })

  return { canonicalKeys, aliases }
}

const resolveReference = (
  entries: ReadonlyMap<string, NocodeEditorPlanningFormReferenceAliasEntry>,
  value: unknown,
) => {
  for (const alias of buildAliasKeys(value)) {
    const entry = entries.get(alias)
    if (!entry) {
      continue
    }
    if (entry.ambiguous) {
      return ''
    }
    return entry.candidateFormKeys.values().next().value || ''
  }
  return ''
}

const hasReference = (
  entries: ReadonlyMap<string, NocodeEditorPlanningFormReferenceAliasEntry>,
  value: unknown,
) => buildAliasKeys(value).some(alias => entries.has(alias))

export const resolveNocodeEditorPlanningCanonicalFormKey = (
  index: NocodeEditorPlanningFormReferenceIndex,
  value: unknown,
) => resolveReference(index.canonicalKeys, value)

export const resolveNocodeEditorPlanningFormAlias = (
  index: NocodeEditorPlanningFormReferenceIndex,
  value: unknown,
) => resolveReference(index.aliases, value)

export const resolveNocodeEditorPlanningGenericFormReference = (
  index: NocodeEditorPlanningFormReferenceIndex,
  value: unknown,
) => {
  if (hasReference(index.canonicalKeys, value)) {
    return resolveNocodeEditorPlanningCanonicalFormKey(index, value)
  }
  return resolveNocodeEditorPlanningFormAlias(index, value)
}
