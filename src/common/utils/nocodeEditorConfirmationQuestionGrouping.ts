import type { NocodeEditorAiConfirmQuestion } from '@common/types/nocodeEditorConfirmation'

const DEFAULT_HANDLED_UNCERTAINTY_CATEGORIES = new Set(['safe_default', 'deferred_optional'])

type GroupableConfirmationQuestion = Pick<
  NocodeEditorAiConfirmQuestion,
  'confirmed' | 'required' | 'uncertainty'
>

// 「已按默认处理」只用于告知用户 AI 已采用的默认方案：可补充说明调整，但不阻塞生成。
export const isNocodeEditorDefaultHandledConfirmationQuestion = (
  question?: GroupableConfirmationQuestion | null,
) => (
  Boolean(question)
  && question?.confirmed !== true
  && (
    question?.required === false
    || DEFAULT_HANDLED_UNCERTAINTY_CATEGORIES.has(String(question?.uncertainty?.category || ''))
  )
)

export const isNocodeEditorPendingDecisionQuestion = (
  question?: GroupableConfirmationQuestion | null,
) => (
  Boolean(question)
  && question?.confirmed !== true
  && !isNocodeEditorDefaultHandledConfirmationQuestion(question)
)
