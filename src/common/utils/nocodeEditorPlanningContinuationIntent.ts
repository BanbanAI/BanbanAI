import {
  isNocodeEditorCompleteNewFormIntent,
} from './nocodeEditorSingleFormPlan'

const normalizeText = (value: unknown) => String(value || '').trim()

const EXPLICIT_CONTINUATION_HINTS = [
  '\u7ee7\u7eed',
  '\u786e\u8ba4',
  '\u53ef\u4ee5\u4e86',
  '\u6ca1\u95ee\u9898',
  '\u6ca1\u6709\u95ee\u9898',
  '\u6309\u8fd9\u4e2a\u89c4\u5212',
  '\u6309\u5f53\u524d\u89c4\u5212',
  '\u751f\u6210\u84dd\u56fe',
  '\u6cbf\u7528\u5f53\u524d',
  '\u6cbf\u7528\u73b0\u6709',
  '\u5f53\u524d\u84dd\u56fe',
  '\u5f53\u524d\u89c4\u5212',
  '\u8fd9\u4efd\u84dd\u56fe',
  '\u8fd9\u4efd\u89c4\u5212',
]

const EDITING_CONTINUATION_HINTS = [
  '\u8865\u4e00\u4e2a\u5b57\u6bb5',
  '\u65b0\u589e\u5b57\u6bb5',
  '\u8c03\u6574\u5b57\u6bb5',
  '\u4fee\u6539\u5b57\u6bb5',
  '\u8865\u5145',
]

const includesAny = (text: string, keywords: string[]) => (
  keywords.some(keyword => text.includes(keyword))
)

export const isExplicitNocodeEditorPlanningContinuationText = (value: unknown) => {
  const text = normalizeText(value)
  return Boolean(text) && includesAny(text, EXPLICIT_CONTINUATION_HINTS)
}

export const shouldAutoContinueNocodeEditorPlanningWithoutConfirmation = (input: {
  autoBuilderRequirementKickoff?: unknown
  explicitPlanningConfirmation?: unknown
}) => (
  input.explicitPlanningConfirmation === true
  || input.autoBuilderRequirementKickoff === true
)

export const shouldContinueCurrentPlanningChain = (input: {
  userMessage?: unknown
  editorMode?: unknown
  activeFormId?: unknown
}) => {
  const text = normalizeText(input.userMessage)
  if (!text) {
    return false
  }

  if (isNocodeEditorCompleteNewFormIntent(input)) {
    return false
  }

  if (isExplicitNocodeEditorPlanningContinuationText(text)) {
    return true
  }

  return includesAny(text, EDITING_CONTINUATION_HINTS)
}
