import type {
  NocodeEditorFormulaPath,
  NocodeEditorFormulaPlan,
  NocodeEditorFormulaTargetResult,
} from '@common/types/nocodeEditorFormula'
import { normalizeNocodeEditorFormulaPlan } from '@common/utils/nocodeEditorFormulaDomain'
import i18next from 'i18next'
import type { NocodeEditorAiArtifactBlock } from './types'

export type NocodeEditorFormulaPlanPresentation = {
  goal?: string
  planningItems?: string[]
  scope?: string
  pendingTitle?: string
  loading?: boolean
}

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeCount = (value: unknown) => {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

export const resolveNocodeEditorFormulaPathLabel = (
  formulaPath?: NocodeEditorFormulaPath,
) => {
  const fallback = formulaPath === 'default-formula' ? 'Default formula' : 'Compute formula'
  const label = formulaPath === 'default-formula'
    ? i18next.t('formulaPlanPresentation.path.default-formula', { defaultValue: fallback })
    : i18next.t('formulaPlanPresentation.path.compute-formula', { defaultValue: fallback })
  return normalizeText(label) || fallback
}

const FORMULA_TARGET_STATUS_FALLBACKS: Record<NocodeEditorFormulaTargetResult['status'], string> = {
  updated: 'Configured',
  skipped: 'Skipped',
  failed: 'Failed to configure',
  draft: 'Staged',
}

export const resolveNocodeEditorFormulaCountLabel = (count: unknown) => {
  const normalizedCount = normalizeCount(count)
  const fallback = `Formula count: ${normalizedCount}`
  return normalizeText(i18next.t('formulaPlanPresentation.formulaCount', {
    count: normalizedCount,
    defaultValue: fallback,
  })) || fallback
}

export const resolveNocodeEditorFormulaTargetStatusLabel = (
  status: NocodeEditorFormulaTargetResult['status'],
) => {
  const fallback = FORMULA_TARGET_STATUS_FALLBACKS[status]
  if (!fallback) {
    return normalizeText(status)
  }

  return normalizeText(i18next.t(`formulaPlanPresentation.targetStatus.${status}`, {
    defaultValue: fallback,
  })) || fallback
}

export const resolveNocodeEditorBlueprintFormulaSummaryLabels = (input: {
  updated?: unknown
  skipped?: unknown
  failed?: unknown
  blocking?: unknown
}) => {
  const items = [{
    key: 'updated',
    count: normalizeCount(input.updated),
    fallback: (count: number) => `Configured formulas: ${count}`,
  }, {
    key: 'skipped',
    count: normalizeCount(input.skipped),
    fallback: (count: number) => `Skipped formulas: ${count}`,
  }, {
    key: 'failed',
    count: normalizeCount(input.failed),
    fallback: (count: number) => `Failed formulas: ${count}`,
  }, {
    key: 'blocking',
    count: normalizeCount(input.blocking),
    fallback: (count: number) => `Blocking formula issues: ${count}`,
  }]

  return items
    .filter(item => item.count > 0)
    .map(item => {
      const fallback = item.fallback(item.count)
      return normalizeText(i18next.t(`formulaPlanPresentation.blueprintSummary.${item.key}`, {
        count: item.count,
        defaultValue: fallback,
      })) || fallback
    })
}

const resolveFormulaPlanScope = (plan: NocodeEditorFormulaPlan) => {
  const formNames = Array.from(new Set(
    plan.items
      .map(item => normalizeText(item.target.formName))
      .filter(Boolean),
  ))
  return formNames.join('、')
}

const resolveFormulaPlanItems = (plan: NocodeEditorFormulaPlan) => (
  plan.items.flatMap(item => (
    item.formulaSettings.map((setting) => {
      const fallback = `${item.target.fieldName}: ${resolveNocodeEditorFormulaPathLabel(setting.formulaPath)}; ${setting.formula}`
      const itemText = i18next.t('formulaPlanPresentation.formulaItem', {
        fieldName: item.target.fieldName,
        formulaPath: resolveNocodeEditorFormulaPathLabel(setting.formulaPath),
        formula: setting.formula,
        defaultValue: fallback,
      })
      return normalizeText(itemText) || fallback
    })
  ))
)

export const buildNocodeEditorFormulaPlanPresentation = (
  block?: Pick<NocodeEditorAiArtifactBlock, 'formulaPlan'> | null,
): NocodeEditorFormulaPlanPresentation | null => {
  const plan = normalizeNocodeEditorFormulaPlan(block?.formulaPlan)
  if (!plan) {
    return null
  }

  const planningItems = resolveFormulaPlanItems(plan)
  const scope = resolveFormulaPlanScope(plan)
  return {
    goal: plan.summary,
    ...(planningItems.length ? { planningItems } : {}),
    ...(scope ? { scope } : {}),
    ...(plan.openQuestions.length
      ? { pendingTitle: i18next.t('formulaPlanPresentation.pendingTitle', { count: plan.openQuestions.length }) }
      : {}),
  }
}

export const resolveNocodeEditorFormulaPlanPresentation = (
  block?: NocodeEditorAiArtifactBlock | null,
): NocodeEditorFormulaPlanPresentation | null => {
  const explicit = block?.formulaPresentation
  if (explicit && typeof explicit === 'object') {
    const planningItems = Array.isArray(explicit.planningItems)
      ? explicit.planningItems.map(item => normalizeText(item)).filter(Boolean)
      : []
    const presentation = {
      goal: normalizeText(explicit.goal) || undefined,
      ...(planningItems.length ? { planningItems } : {}),
      scope: normalizeText(explicit.scope) || undefined,
      pendingTitle: normalizeText(explicit.pendingTitle) || undefined,
      loading: explicit.loading === true || undefined,
    }
    if (presentation.goal || presentation.planningItems?.length || presentation.scope || presentation.pendingTitle || presentation.loading) {
      return presentation
    }
  }

  return buildNocodeEditorFormulaPlanPresentation(block)
}

export const buildNocodeEditorFormulaPlanLoadingPresentation = (): NocodeEditorFormulaPlanPresentation => ({
  goal: i18next.t('formulaPlanPresentation.loading'),
  loading: true,
})
