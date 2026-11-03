import type { NocodeEditorAiConfirmPayload } from '../types/nocodeEditorConfirmation'
import {
  normalizeNocodeEditorBlueprintIdentityToken,
  stripNocodeEditorBlueprintFormSuffixes,
  type NocodeEditorBlueprintFormLike,
} from './nocodeEditorBlueprintFormNormalization'

export const NOCODE_EDITOR_BLUEPRINT_SOURCE_TARGET_MISSING = 'BLUEPRINT_SOURCE_TARGET_MISSING'

export type NocodeEditorBlueprintExistingFormLike = {
  formKey?: string
  tableId?: string
  tableName?: string
}

export type NocodeEditorBlueprintResolvedSourceField = {
  ownerFormKey?: string
  ownerFormName?: string
  ownerFieldKey?: string
  ownerFieldName?: string
}

export type NocodeEditorBlueprintUnresolvedSourceTarget = {
  formKey?: string
  formName?: string
  fieldNames: string[]
  owners: string[]
  // owners 是给人看的文案，不能用来做身份匹配；这里保留字段级归属。
  ownerTargets?: Array<{
    formKey?: string
    formName?: string
    fieldKey?: string
    fieldName?: string
  }>
}

export type NocodeEditorBlueprintSynthesizedRelatedForm = {
  tableName: string
  fields: Array<{ name: string; fieldKey?: string }>
}

export type NocodeEditorBlueprintSourceTargetCompletionResult = {
  forms: NocodeEditorBlueprintFormLike[]
  synthesizedForms: NocodeEditorBlueprintSynthesizedRelatedForm[]
  resolvedSourceFields: NocodeEditorBlueprintResolvedSourceField[]
  unresolved: NocodeEditorBlueprintUnresolvedSourceTarget[]
}

type CollectedSourceRef = {
  formKey: string
  formName: string
  fieldKey: string
  fieldName: string
  ownerFormKey: string
  ownerFormName: string
  ownerFieldKey: string
  ownerFieldName: string
}

type MissingSourceTargetGroup = {
  formKey: string
  formName: string
  fieldNames: string[]
  fieldKeyByName: Map<string, string>
  refs: CollectedSourceRef[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeIdentity = (value: unknown) => normalizeNocodeEditorBlueprintIdentityToken(value)

const getFormAliasTokens = (value: unknown) => Array.from(new Set([
  normalizeIdentity(value),
  normalizeIdentity(stripNocodeEditorBlueprintFormSuffixes(value)),
].filter(Boolean)))

const matchesSourceTarget = (
  target: NocodeEditorBlueprintFormLike | NocodeEditorBlueprintExistingFormLike,
  source: { formKey: string; formName: string },
) => {
  const sourceKey = normalizeText(source.formKey)
  if (sourceKey) {
    const targetFormKey = normalizeText(target.formKey)
    const targetTableId = normalizeText((target as NocodeEditorBlueprintExistingFormLike).tableId)
    if (
      (targetFormKey && targetFormKey === sourceKey)
      || (targetTableId && targetTableId === sourceKey)
    ) {
      return true
    }
  }

  const sourceAliases = getFormAliasTokens(source.formName)
  if (!sourceAliases.length) {
    return false
  }
  const targetAliases = getFormAliasTokens(target.tableName)
  return sourceAliases.some(alias => targetAliases.includes(alias))
}

const collectSourceRefs = (forms: NocodeEditorBlueprintFormLike[]) => {
  const refs: CollectedSourceRef[] = []
  const visit = (
    ownerForm: NocodeEditorBlueprintFormLike,
    fields: unknown,
  ) => {
    if (!Array.isArray(fields)) {
      return
    }
    fields.forEach((field) => {
      if (!isRecord(field)) {
        return
      }
      const source = isRecord(field.source) ? field.source : null
      if (source) {
        const ref: CollectedSourceRef = {
          formKey: normalizeText(source.formKey),
          formName: normalizeText(source.formName),
          fieldKey: normalizeText(source.fieldKey),
          fieldName: normalizeText(source.fieldName),
          ownerFormKey: normalizeText(ownerForm.formKey),
          ownerFormName: normalizeText(ownerForm.tableName),
          ownerFieldKey: normalizeText(field.fieldKey),
          ownerFieldName: normalizeText(field.name),
        }
        if (ref.formKey || ref.formName || ref.fieldKey || ref.fieldName) {
          refs.push(ref)
        }
      }
      visit(ownerForm, field.children)
    })
  }
  forms.forEach(form => visit(form, form.fields))
  return refs
}

const resolveMissingGroupKey = (ref: CollectedSourceRef) => {
  const formNameKey = normalizeIdentity(ref.formName)
  if (formNameKey) {
    return `name:${formNameKey}`
  }
  if (ref.formKey) {
    return `key:${ref.formKey}`
  }
  return `field:${normalizeIdentity(ref.fieldName)}`
}

const appendUnique = (values: string[], value: string) => {
  if (value && !values.includes(value)) {
    values.push(value)
  }
}

const formatOwnerLabel = (ref: CollectedSourceRef) => (
  [ref.ownerFormName, ref.ownerFieldName].filter(Boolean).join('.')
)

const resolveResolvedSourceFieldKey = (ref: CollectedSourceRef) => [
  ref.ownerFormKey,
  normalizeIdentity(ref.ownerFormName),
  ref.ownerFieldKey,
  normalizeIdentity(ref.ownerFieldName),
].join('::')

/**
 * 字段 source 指向的表必须能在当前应用或本轮蓝图里找到。
 * 用户/规划已经指定了关联表时，缺失的表按“新建关联表”补进蓝图，
 * 而不是留成一条悬空 source 或阻塞问题。
 */
export const completeNocodeEditorBlueprintSourceTargets = (input: {
  forms?: NocodeEditorBlueprintFormLike[] | null
  existingForms?: NocodeEditorBlueprintExistingFormLike[] | null
}): NocodeEditorBlueprintSourceTargetCompletionResult => {
  const forms = Array.isArray(input.forms) ? input.forms : []
  const existingForms = Array.isArray(input.existingForms) ? input.existingForms : []
  const targets = [...forms, ...existingForms]
  const refs = collectSourceRefs(forms)
  const missingGroups = new Map<string, MissingSourceTargetGroup>()

  refs.forEach((ref) => {
    if (targets.some(target => matchesSourceTarget(target, ref))) {
      return
    }
    const groupKey = resolveMissingGroupKey(ref)
    let group = missingGroups.get(groupKey)
    if (!group) {
      group = {
        formKey: ref.formKey,
        formName: ref.formName,
        fieldNames: [],
        fieldKeyByName: new Map(),
        refs: [],
      }
      missingGroups.set(groupKey, group)
    }
    group.refs.push(ref)
    group.formKey = group.formKey || ref.formKey
    group.formName = group.formName || ref.formName
    if (ref.fieldName) {
      appendUnique(group.fieldNames, ref.fieldName)
      if (ref.fieldKey && !group.fieldKeyByName.has(ref.fieldName)) {
        group.fieldKeyByName.set(ref.fieldName, ref.fieldKey)
      }
    }
  })

  const synthesizedForms: NocodeEditorBlueprintSynthesizedRelatedForm[] = []
  const unresolved: NocodeEditorBlueprintUnresolvedSourceTarget[] = []
  const resolvedSourceFields: NocodeEditorBlueprintResolvedSourceField[] = []
  const resolvedSourceFieldKeys = new Set<string>()

  missingGroups.forEach((group) => {
    if (!group.formName || !group.fieldNames.length) {
      unresolved.push({
        formKey: group.formKey || undefined,
        formName: group.formName || undefined,
        fieldNames: group.fieldNames,
        owners: Array.from(new Set(group.refs.map(formatOwnerLabel).filter(Boolean))),
        ownerTargets: Array.from(new Map(group.refs.map(ref => [
          [ref.ownerFormKey, ref.ownerFieldKey, ref.ownerFieldName].join('::'),
          {
            formKey: ref.ownerFormKey || undefined,
            formName: ref.ownerFormName || undefined,
            fieldKey: ref.ownerFieldKey || undefined,
            fieldName: ref.ownerFieldName || undefined,
          },
        ])).values()),
      })
      return
    }

    synthesizedForms.push({
      tableName: group.formName,
      fields: group.fieldNames.map(name => ({
        name,
        ...(group.fieldKeyByName.get(name) ? { fieldKey: group.fieldKeyByName.get(name) } : {}),
      })),
    })
    group.refs.forEach((ref) => {
      const key = resolveResolvedSourceFieldKey(ref)
      if (resolvedSourceFieldKeys.has(key)) {
        return
      }
      resolvedSourceFieldKeys.add(key)
      resolvedSourceFields.push({
        ownerFormKey: ref.ownerFormKey || undefined,
        ownerFormName: ref.ownerFormName || undefined,
        ownerFieldKey: ref.ownerFieldKey || undefined,
        ownerFieldName: ref.ownerFieldName || undefined,
      })
    })
  })

  return {
    forms: synthesizedForms.length ? [...forms, ...synthesizedForms] : forms,
    synthesizedForms,
    resolvedSourceFields,
    unresolved,
  }
}

const createSynthesizedFormAliasEntries = (
  synthesizedForms: NocodeEditorBlueprintSynthesizedRelatedForm[],
) => synthesizedForms.flatMap(form => (
  getFormAliasTokens(form.tableName)
    // 去掉“表/管理/信息”后缀可能只剩 2 个字（如“学生”），不能拿来做问题归属。
    .filter(alias => alias.length >= 3)
    .map(alias => ({ alias, formName: form.tableName }))
))

const getQuestionText = (question: unknown) => {
  if (typeof question === 'string') {
    return normalizeIdentity(question)
  }
  if (!isRecord(question)) {
    return ''
  }
  return normalizeIdentity([
    normalizeText(question.title),
    normalizeText(question.description),
  ].filter(Boolean).join('\n'))
}

const isCompletedQuestion = (question: unknown) => {
  if (!isRecord(question)) {
    return false
  }
  return question.confirmed === true
    || Boolean(
      normalizeText(question.selectedOptionValue)
      || normalizeText(question.answerSummary)
      || normalizeText(question.answerDetail)
    )
    || (
      Array.isArray(question.options)
      && question.options.some(option => isRecord(option) && option.selected === true)
    )
}

const matchesResolvedSourceField = (
  question: unknown,
  resolvedSourceFields: NocodeEditorBlueprintResolvedSourceField[],
) => {
  if (!isRecord(question) || !isRecord(question.decisionTarget)) {
    return false
  }
  const target = question.decisionTarget
  if (target.kind !== 'field-source') {
    return false
  }
  const targetFormKey = normalizeText(target.formKey)
  const targetFormName = normalizeIdentity(target.formName)
  const targetFieldKey = normalizeText(target.fieldKey)
  const targetFieldName = normalizeIdentity(target.fieldName)
  if (!targetFormKey && !targetFormName && !targetFieldKey && !targetFieldName) {
    return false
  }
  return resolvedSourceFields.some((field) => {
    const formMatches = (
      targetFormKey
      && normalizeText(field.ownerFormKey)
      && normalizeText(field.ownerFormKey) === targetFormKey
    ) || (
      targetFormName
      && normalizeIdentity(field.ownerFormName) === targetFormName
    )
    const fieldMatches = (
      targetFieldKey
      && normalizeText(field.ownerFieldKey)
      && normalizeText(field.ownerFieldKey) === targetFieldKey
    ) || (
      targetFieldName
      && normalizeIdentity(field.ownerFieldName) === targetFieldName
    )
    return Boolean(formMatches && fieldMatches)
  })
}

export const filterNocodeEditorBlueprintResolvedSourceOpenQuestions = (
  openQuestions: unknown,
  synthesizedForms: NocodeEditorBlueprintSynthesizedRelatedForm[],
) => {
  const values = Array.isArray(openQuestions)
    ? openQuestions.map(item => normalizeText(item)).filter(Boolean)
    : []
  const aliasEntries = createSynthesizedFormAliasEntries(synthesizedForms)
  if (!aliasEntries.length) {
    return values
  }
  return values.filter(question => {
    const text = getQuestionText(question)
    return !aliasEntries.some(entry => text.includes(entry.alias))
  })
}

/**
 * 已自动补全的关联表会让原问题失去前提，不能再作为阻塞项。
 * 保留一条默认处理说明，用户仍可在蓝图里调整。
 */
export const downgradeNocodeEditorBlueprintResolvedSourceQuestions = (
  confirmation: NocodeEditorAiConfirmPayload | null | undefined,
  synthesizedForms: NocodeEditorBlueprintSynthesizedRelatedForm[],
  resolvedSourceFields: NocodeEditorBlueprintResolvedSourceField[] = [],
): NocodeEditorAiConfirmPayload | null | undefined => {
  if (!confirmation || !Array.isArray(confirmation.questions)) {
    return confirmation
  }
  const aliasEntries = createSynthesizedFormAliasEntries(synthesizedForms)
  if (!aliasEntries.length && !resolvedSourceFields.length) {
    return confirmation
  }

  let changed = false
  const questions = (confirmation.questions as unknown as Array<Record<string, unknown> | string>)
    .map((question) => {
      if (isCompletedQuestion(question)) {
        return question
      }
      const text = getQuestionText(question)
      const aliasMatch = aliasEntries.find(entry => text.includes(entry.alias))
      const fieldMatch = matchesResolvedSourceField(question, resolvedSourceFields)
      if (!aliasMatch && !fieldMatch) {
        return question
      }
      changed = true
      const formName = aliasMatch?.formName || synthesizedForms[0]?.tableName || '关联表'
      return {
        ...(isRecord(question) ? question : {}),
        title: `已按关联来源将“${formName}”加入蓝图，可继续调整该表字段。`,
        questionKind: 'note_only',
        description: undefined,
        options: undefined,
        selectedOptionValue: undefined,
        required: false,
        uncertainty: {
          category: 'safe_default',
          reasonCode: 'related_form_auto_created',
        },
      }
    })

  return changed
    ? {
      ...confirmation,
      questions: questions as NocodeEditorAiConfirmPayload['questions'],
    }
    : confirmation
}
