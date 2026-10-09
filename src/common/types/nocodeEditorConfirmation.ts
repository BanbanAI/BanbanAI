export type NocodeEditorAiConfirmStage =
  | 'app-plan'
  | 'form-plan'
  | 'content-plan'
  | 'flow-scheme'
  | 'flow-plan'
  | 'blueprint'

export type NocodeEditorAiConfirmSurface = 'inline' | 'drawer' | 'gate'
export type NocodeEditorAiConfirmStatus = 'pending' | 'completed'
export type NocodeEditorPlanningQuestionDomain =
  | 'app'
  | 'form'
  | 'flow'
  | 'unknown'
export type NocodeEditorPlanningQuestionStage = Extract<
  NocodeEditorAiConfirmStage,
  'app-plan' | 'form-plan'
>
export type NocodeEditorAiConfirmQuestionKind =
  | 'note_only'
  | 'binary'
  | 'single_select'

export type NocodeEditorAiConfirmQuestionOption = {
  value: string
  label: string
  description?: string
  selected?: boolean
}

export type NocodeEditorAiConfirmQuestionScopeKind =
  | 'overview'
  | 'trigger-branch'

export type NocodeEditorConfirmationDecisionKeySource =
  | 'explicit'
  | 'legacy_question_id'

export type NocodeEditorAiConfirmQuestion = {
  id: string
  decisionKey?: string
  decisionKeySource?: NocodeEditorConfirmationDecisionKeySource
  title: string
  domain?: NocodeEditorPlanningQuestionDomain
  questionKind?: NocodeEditorAiConfirmQuestionKind
  scopeKind?: NocodeEditorAiConfirmQuestionScopeKind
  branchKey?: string
  description?: string
  required?: boolean
  allowFreeText?: boolean
  options?: NocodeEditorAiConfirmQuestionOption[]
  dependsOn?: string[]
  confirmed?: boolean
  selectedOptionValue?: string
  answerSummary?: string
  answerDetail?: string
}

export type NocodeEditorAiConfirmPayload = {
  stage: NocodeEditorAiConfirmStage
  planningContextKey?: string
  requiredNextAction?: 'editor_plan_flow_scheme'
  blockedNextAction?: 'editor_stage_flow_blueprint'
  preferredSurface?: NocodeEditorAiConfirmSurface
  status?: NocodeEditorAiConfirmStatus
  summary?: string
  completionSummary?: string
  resultSummary?: string[]
  questions: NocodeEditorAiConfirmQuestion[]
  allowContinueWithDefaults?: boolean
  continueLabel?: string
  secondaryActionLabel?: string
  reviewLabel?: string
}

export type NocodeEditorAiPlanningContinuation = {
  stage: Extract<NocodeEditorAiConfirmStage, 'app-plan' | 'form-plan'>
  planningContextKey: string
  autoContinueWithoutConfirmation?: boolean
}
