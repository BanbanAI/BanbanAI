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
  personnelCandidate?: {
    sourceType: 'submitter' | 'submitter_manager' | 'fixed_users' | 'fixed_roles' | 'department_manager' | 'form_member' | 'form_department'
    status: 'existing' | 'supported' | 'planned'
    refId?: string
    refName?: string
  }
}

export type NocodeEditorAiConfirmQuestionScopeKind =
  | 'overview'
  | 'trigger-branch'

export type NocodeEditorConfirmationDecisionKeySource =
  | 'explicit'
  | 'legacy_question_id'

export type NocodeEditorAiDecisionCondition = {
  decisionKey: string
  operator: 'equals' | 'in'
  values: string[]
}

export type NocodeEditorFlowDecisionScope = {
  kind: 'flow' | 'path' | 'branch' | 'step' | 'object'
  id: string
  structureVersion?: string
}

export type NocodeEditorFlowDecisionChange =
  | 'topology'
  | 'scope'
  | 'cardinality'
  | 'options'
  | 'applicability'
  | 'meaning'
  | 'strategy'
  | 'binding'

export type NocodeEditorFlowFactSnapshotItem = {
  value: string
  source: 'user' | 'history' | 'runtime'
  producerDecisionKey?: string
  scope?: NocodeEditorFlowDecisionScope
  version?: string
}

export type NocodeEditorAiConfirmQuestion = {
  id: string
  decisionKey?: string
  decisionKeySource?: NocodeEditorConfirmationDecisionKeySource
  decisionTarget?: {
    kind: 'field-source'
    formKey?: string
    fieldKey: string
  }
  title: string
  domain?: NocodeEditorPlanningQuestionDomain
  questionKind?: NocodeEditorAiConfirmQuestionKind
  scopeKind?: NocodeEditorAiConfirmQuestionScopeKind
  branchKey?: string
  description?: string
  required?: boolean
  allowFreeText?: boolean
  options?: NocodeEditorAiConfirmQuestionOption[]
  decisionScope?: NocodeEditorFlowDecisionScope
  requiresFacts?: string[]
  producesFacts?: string[]
  changes?: NocodeEditorFlowDecisionChange[]
  dependencySources?: Record<string, 'explicit' | 'fact'>
  personnelDecision?: {
    stepKey: string
    slot: 'source' | 'binding' | 'approval_level' | 'multi_person' | 'empty_handler' | 'same_as_submitter'
  }
  dependsOn?: string[]
  prerequisites?: NocodeEditorAiDecisionCondition[]
  uncertainty?: {
    category: 'business_decision' | 'safe_default' | 'deferred_required' | 'deferred_optional' | 'hard_blocker'
    reasonCode: string
    nodeType?: string
    settingPath?: string
    evidenceSource?: string
  }
  confirmed?: boolean
  selectedOptionValue?: string
  answerSummary?: string
  answerDetail?: string
}

export type NocodeEditorAiConfirmPayload = {
  stage: NocodeEditorAiConfirmStage
  planningContextKey?: string
  schemeRevision?: number
  decisionContractVersion?: number
  decisionSnapshot?: Record<string, string>
  factSnapshot?: Record<string, NocodeEditorFlowFactSnapshotItem>
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
