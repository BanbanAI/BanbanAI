import type { NocodeEditorAiConfirmQuestion } from '@common/types/nocodeEditorConfirmation'
import { isSameNocodeEditorBlueprintForm } from '@common/utils/nocodeEditorBlueprintFormNormalization'
import type {
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiStageBlueprintDisplayItem,
} from '../types'

export type BlueprintConfirmationQuestionScope = {
  formKey: string
  formName?: string
  includeBlueprintLevelQuestions: boolean
  knownFormKeys: string[]
}

// 工作台一张卡只代表一张表单，字段级确认项按 decisionTarget 归属到对应页签；
// 蓝图级问题只在首个表单页签出现一次。
export const buildBlueprintConfirmationQuestionScope = (
  item?: NocodeEditorAiStageBlueprintDisplayItem | null,
  form?: NocodeEditorAiAppBlueprintForm | null,
): BlueprintConfirmationQuestionScope | null => {
  const blueprint = item?.blueprint
  if (!item || !blueprint || !form) {
    return null
  }

  // 待确认蓝图会按表单拆成多张卡片，卡片内的 blueprint.forms 只剩当前表单；
  // 这里优先使用拆分前记录的表单顺序，才能识别跨表单问题和首张表单。
  const scopeForms = item.itemKind === 'ai_blueprint'
    && Array.isArray(item.blueprintFormScope)
    && item.blueprintFormScope.length
    ? item.blueprintFormScope
    : blueprint.forms
  const knownFormKeys = Array.from(new Set(
    scopeForms
      .flatMap(scopeForm => [scopeForm.formKey, scopeForm.tableName])
      .map(value => String(value || '').trim())
      .filter(Boolean),
  ))
  const primaryForm = scopeForms[0]

  return {
    formKey: String(form.formKey || form.tableName || '').trim(),
    formName: String(form.tableName || '').trim(),
    includeBlueprintLevelQuestions: !primaryForm
      || isSameNocodeEditorBlueprintForm(primaryForm, form),
    knownFormKeys,
  }
}

const normalizeScopeToken = (value: unknown) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[\s\-_/\\]/g, '')

const matchesScopeToken = (left: unknown, right: unknown) => {
  const normalizedLeft = normalizeScopeToken(left)
  const normalizedRight = normalizeScopeToken(right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

const resolveQuestionTargetFormKey = (question: NocodeEditorAiConfirmQuestion) => {
  const target = question.decisionTarget
  if (target?.kind !== 'field-source') {
    return ''
  }
  return String(target.formKey || '').trim()
}

export const isBlueprintConfirmationQuestionInScope = (
  question: NocodeEditorAiConfirmQuestion,
  scope?: BlueprintConfirmationQuestionScope | null,
) => {
  if (!scope) {
    return true
  }

  const targetFormKey = resolveQuestionTargetFormKey(question)
  if (!targetFormKey) {
    return scope.includeBlueprintLevelQuestions
  }

  const knownFormKeys = scope.knownFormKeys.length
    ? scope.knownFormKeys
    : [scope.formKey, scope.formName]
  const targetFormExists = knownFormKeys.some(key => matchesScopeToken(key, targetFormKey))
  if (!targetFormExists) {
    return scope.includeBlueprintLevelQuestions
  }

  return matchesScopeToken(targetFormKey, scope.formKey)
    || matchesScopeToken(targetFormKey, scope.formName)
}
