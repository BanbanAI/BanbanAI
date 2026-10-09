import type { AiAssistantMarkdownBlock } from '@common/types/ai'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmSurface,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorContentPlan,
  NocodeEditorContentPlanScope,
} from '@common/utils/nocodeEditorContentPlan'

import { buildNocodeEditorConfirmationPayload } from './nocode-editor-confirmation.util'

type NocodeEditorContentPlanConfirmationInput = NocodeEditorContentPlan & {
  confirmation?: unknown
}

const scopeLabelMap: Record<NocodeEditorContentPlanScope, string> = {
  get board() { return global.i18next.t('nocodeEditorContentPlan.boardPage') },
  get workflow() { return global.i18next.t('nocodeEditorContentPlan.workflow') },
  get formula() { return global.i18next.t('nocodeEditorContentPlan.formula') },
  get 'form-local'() { return global.i18next.t('nocodeEditorContentPlan.formLocal') },
  get local() { return global.i18next.t('nocodeEditorContentPlan.local') },
}

const executionLevelLabelMap: Record<string, string> = {
  get executable_now() { return global.i18next.t('nocodeEditorContentPlan.executableNow') },
  get need_confirm() { return global.i18next.t('nocodeEditorContentPlan.needConfirm') },
  get planning_only() { return global.i18next.t('nocodeEditorContentPlan.planningOnly') },
}

const formatListItem = (item: NocodeEditorContentPlan['items'][number], index: number) => {
  const details = [
    item.type
      ? global.i18next.t('nocodeEditorContentPlan.typeDetail', { type: item.type })
      : '',
    item.purpose
      ? global.i18next.t('nocodeEditorContentPlan.purposeDetail', { purpose: item.purpose })
      : '',
    global.i18next.t('nocodeEditorContentPlan.executionLevelDetail', {
      level: executionLevelLabelMap[item.executionLevel]
        || global.i18next.t('nocodeEditorContentPlan.needConfirm'),
    }),
  ].filter(Boolean).join(global.i18next.t('nocodeEditorContentPlan.sectionSeparator'))

  return global.i18next.t('nocodeEditorContentPlan.planItem', {
    index: index + 1,
    name: item.name,
    details: details
      ? global.i18next.t('nocodeEditorContentPlan.parenthesizedDetails', { details })
      : '',
  })
}

const formatTargetLabel = (plan: NocodeEditorContentPlan) => {
  const scopeLabel = scopeLabelMap[plan.scope] || scopeLabelMap.local
  const targetParts = [
    plan.target.formName
      ? global.i18next.t('nocodeEditorContentPlan.formTarget', { formName: plan.target.formName })
      : '',
    global.i18next.t('nocodeEditorContentPlan.scopeTarget', {
      scope: scopeLabel,
      target: plan.target.name,
    }),
  ].filter(Boolean)
  return targetParts.join(' / ')
}

export const buildNocodeEditorContentPlanConfirmation = (
  plan: NocodeEditorContentPlanConfirmationInput | null | undefined,
  preferredSurface?: NocodeEditorAiConfirmSurface,
): NocodeEditorAiConfirmPayload | null => {
  if (!plan) {
    return null
  }

  return buildNocodeEditorConfirmationPayload({
    stage: 'content-plan',
    confirmation: plan.confirmation,
    openQuestions: plan.openQuestions,
    preferredSurface,
    summary: plan.summary,
  })
}

export const buildNocodeEditorContentPlanMarkdownBlock = (
  plan: NocodeEditorContentPlan | null | undefined,
): AiAssistantMarkdownBlock | null => {
  if (!plan) {
    return null
  }

  const lines = [
    global.i18next.t('nocodeEditorContentPlan.heading'),
    '',
    global.i18next.t('nocodeEditorContentPlan.titleLine', { title: plan.title }),
    global.i18next.t('nocodeEditorContentPlan.scopeLine', {
      scope: scopeLabelMap[plan.scope] || scopeLabelMap.local,
    }),
    global.i18next.t('nocodeEditorContentPlan.targetLine', { target: formatTargetLabel(plan) }),
    '',
    global.i18next.t('nocodeEditorContentPlan.summaryHeading'),
    '',
    plan.summary,
    '',
    global.i18next.t('nocodeEditorContentPlan.itemsHeading'),
    '',
    ...(plan.items.length
      ? plan.items.map(formatListItem)
      : [global.i18next.t('nocodeEditorContentPlan.noItems')]),
  ]

  lines.push(
    '',
    global.i18next.t('nocodeEditorContentPlan.confirmHeading'),
    '',
    ...(plan.openQuestions.length
      ? plan.openQuestions.map((item, index) => `${index + 1}. ${item}`)
      : [global.i18next.t('nocodeEditorContentPlan.noQuestions')]),
  )

  return {
    type: 'markdown',
    text: lines.join('\n'),
  }
}
