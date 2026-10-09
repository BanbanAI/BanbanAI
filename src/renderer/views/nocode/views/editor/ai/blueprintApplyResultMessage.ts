import type {
  NocodeEditorAiAppBlueprint,
  NocodeEditorAiBlueprintApplyFormResult,
} from './types'
import i18next from 'i18next'

type BlueprintApplySummary = {
  formsCreated: number
  formsReused: number
  fieldsCreated: number
  fieldsReused: number
  fieldsUpdated: number
}

type BlueprintApplyMessageOptions = {
  blueprint?: NocodeEditorAiAppBlueprint | null
  persistenceMode: 'saved' | 'draft_only'
  summary?: BlueprintApplySummary | null
  draftIssueCount?: number
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const resolveBlueprintTitle = (blueprint?: NocodeEditorAiAppBlueprint | null) => {
  const title = normalizeText(blueprint?.title)
  if (title) {
    return title
  }

  const firstFormName = normalizeText(blueprint?.forms?.[0]?.tableName)
  if (firstFormName) {
    return i18next.t('blueprintApplyResultMessage.formBlueprintTitle', { title: firstFormName })
  }

  return i18next.t('blueprintApplyResultMessage.currentBlueprint')
}

const resolveFormName = (form: Pick<NocodeEditorAiBlueprintApplyFormResult, 'tableName'>) => {
  return normalizeText(form.tableName) || i18next.t('blueprintApplyResultMessage.unnamed')
}

const resolveProgressDetail = (form: NocodeEditorAiBlueprintApplyFormResult) => {
  const createdCount = Array.isArray(form.fieldsCreated) ? form.fieldsCreated.length : 0
  const updatedCount = Array.isArray(form.fieldsUpdated) ? form.fieldsUpdated.length : 0
  const reusedCount = Array.isArray(form.fieldsReused) ? form.fieldsReused.length : 0

  if (form.created) {
    if (createdCount > 0) {
      return i18next.t('blueprintApplyResultMessage.createdFields', { count: createdCount })
    }
    if (updatedCount > 0) {
      return i18next.t('blueprintApplyResultMessage.updatedFieldSettings', { count: updatedCount })
    }
    return ''
  }

  if (updatedCount > 0) {
    return i18next.t('blueprintApplyResultMessage.updatedFieldSettings', { count: updatedCount })
  }
  if (createdCount > 0) {
    return i18next.t('blueprintApplyResultMessage.createdFields', { count: createdCount })
  }
  if (reusedCount > 0) {
    return i18next.t('blueprintApplyResultMessage.reusedFields', { count: reusedCount })
  }
  return ''
}

export const formatBlueprintApplyProgressMessage = (input: {
  blueprint?: NocodeEditorAiAppBlueprint | null
  persistenceMode: 'saved' | 'draft_only'
}) => {
  const title = resolveBlueprintTitle(input.blueprint)
  return i18next.t('blueprintApplyResultMessage.generatingByBlueprint', { title })
}

export const formatBlueprintApplyDetectedFormsMessage = (count: number) => {
  const normalizedCount = Math.max(0, Number(count || 0))
  return i18next.t('blueprintApplyResultMessage.detectedForms', { count: normalizedCount })
}

export const formatBlueprintApplyFormProgressMessage = (
  form: NocodeEditorAiBlueprintApplyFormResult,
) => {
  const action = form.created
    ? i18next.t('blueprintApplyResultMessage.generated')
    : i18next.t('blueprintApplyResultMessage.synced')
  const formName = resolveFormName(form)
  const detail = resolveProgressDetail(form)

  if (!detail) {
    return i18next.t('blueprintApplyResultMessage.formProgress', { action, formName })
  }

  return i18next.t('blueprintApplyResultMessage.formProgressWithDetail', { action, formName, detail })
}

const buildSavedSummaryLine = (summary: BlueprintApplySummary) => {
  const formsCreated = Math.max(0, Number(summary.formsCreated || 0))
  const formsReused = Math.max(0, Number(summary.formsReused || 0))
  const fieldsCreated = Math.max(0, Number(summary.fieldsCreated || 0))
  const fieldsUpdated = Math.max(0, Number(summary.fieldsUpdated || 0))

  if (!formsCreated && fieldsUpdated > 0) {
    return i18next.t('blueprintApplyResultMessage.noNewFormsUpdatedFields', { count: fieldsUpdated })
  }

  if (formsCreated > 0 && !formsReused) {
    return i18next.t('blueprintApplyResultMessage.createdFormsAndFields', {
      formCount: formsCreated,
      fieldCount: fieldsCreated,
    })
  }

  if (formsCreated > 0 && formsReused > 0) {
    const parts = [i18next.t('blueprintApplyResultMessage.createdFormsAndFields', {
      formCount: formsCreated,
      fieldCount: fieldsCreated,
    })]
    if (fieldsUpdated > 0) {
      parts.push(i18next.t('blueprintApplyResultMessage.reusedFormsUpdatedFields', {
        formCount: formsReused,
        fieldCount: fieldsUpdated,
      }))
    } else {
      parts.push(i18next.t('blueprintApplyResultMessage.reusedForms', { count: formsReused }))
    }
    return parts.join('')
  }

  if (!formsCreated && formsReused > 0) {
    return i18next.t('blueprintApplyResultMessage.noNewFormsReusedForms', { count: formsReused })
  }

  return i18next.t('blueprintApplyResultMessage.processedForms', { count: formsCreated + formsReused })
}

export const formatBlueprintApplyResultMessage = (input: BlueprintApplyMessageOptions) => {
  const summary = input.summary || {
    formsCreated: 0,
    formsReused: 0,
    fieldsCreated: 0,
    fieldsReused: 0,
    fieldsUpdated: 0,
  }

  if (input.persistenceMode === 'draft_only') {
    const draftIssueCount = Math.max(0, Number(input.draftIssueCount || 0))
    return i18next.t('blueprintApplyResultMessage.draftGeneratedWithIssues', { count: draftIssueCount })
  }

  return [
    i18next.t('blueprintApplyResultMessage.blueprintApplyCompleted'),
    buildSavedSummaryLine(summary),
  ].join('\n')
}

export const buildBlueprintApplyNarrationContent = (input: {
  leadMessage: string
  progressLines?: string[]
  resultMessage?: string | null
  followUpLines?: string[]
}) => {
  const sections = [
    normalizeText(input.leadMessage),
    Array.isArray(input.progressLines)
      ? input.progressLines.map(item => normalizeText(item)).filter(Boolean).join('\n')
      : '',
    normalizeText(input.resultMessage),
    Array.isArray(input.followUpLines)
      ? input.followUpLines.map(item => normalizeText(item)).filter(Boolean).join('\n')
      : '',
  ].filter(Boolean)

  return sections.join('\n\n')
}
