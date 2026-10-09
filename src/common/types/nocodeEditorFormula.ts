import type { NocodeEditorAiConfirmPayload } from './nocodeEditorConfirmation'

export type NocodeEditorFormulaPath = 'default-formula' | 'compute-formula'

export type NocodeEditorFormulaSpec = {
  formulaPath: NocodeEditorFormulaPath
  formula: string
  explanation?: string
}

export type NocodeEditorFormulaTarget = {
  formKey?: string
  formName?: string
  fieldKey?: string
  fieldName: string
}

export type NocodeEditorFormulaPlanItem = {
  itemKey: string
  target: NocodeEditorFormulaTarget
  formulaSettings: NocodeEditorFormulaSpec[]
}

export type NocodeEditorFormulaPlan = {
  title: string
  summary: string
  executionIntent: 'plan_only' | 'plan_and_apply'
  items: NocodeEditorFormulaPlanItem[]
  openQuestions: string[]
  confirmation?: NocodeEditorAiConfirmPayload | null
}

export type NocodeEditorFormulaPlanDisplayMode =
  | 'decision'
  | 'summary'
  | 'status'
  | 'hidden'

export type NocodeEditorFormulaPlanOrigin = 'standalone' | 'blueprint'

export type NocodeEditorFormulaEvidenceField = {
  widgetId: string
  fieldKey?: string
  fieldName?: string
  title?: string
  valueType?: string
  widgetType?: string
  formulaPaths?: NocodeEditorFormulaPath[]
}

export type NocodeEditorFormulaFormEvidence = {
  formId?: string
  draftRevision?: number
  fields?: NocodeEditorFormulaEvidenceField[]
}

export type NocodeEditorFormulaContextSnapshot = {
  taskId?: string
  taskScopeKey: string
  nocodeId: string
  formId: string
  draftRevision?: number
  evidenceFingerprint: string
  capturedAt: number
}

export type NocodeEditorResolvedFormulaWrite = {
  itemKey: string
  tableId: string
  tableName?: string
  widgetId: string
  fieldName: string
  formulaPath: NocodeEditorFormulaPath
  formula: string
  explanation?: string
}

export type NocodeEditorFormulaPreflightIssue = {
  code: string
  severity: 'blocking' | 'warning'
  itemKey: string
  target: NocodeEditorFormulaTarget
  message: string
  userActionRequired: boolean
}

export type NocodeEditorFormulaTargetResult = {
  itemKey: string
  tableId?: string
  tableName?: string
  widgetId?: string
  fieldName: string
  formulaPath?: NocodeEditorFormulaPath
  formula?: string
  status: 'draft' | 'updated' | 'skipped' | 'failed'
  draftOnly?: true
  overlayDraft?: true
  explanation?: string
  reason?: string
}

export type NocodeEditorFormulaTaskStatus =
  | 'status'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'not_applicable'

export type NocodeEditorFormulaPersistenceMode = 'saved' | 'draft_only'

export type NocodeEditorFormulaApplyResult = {
  status: NocodeEditorFormulaTaskStatus
  persistenceMode?: NocodeEditorFormulaPersistenceMode
  targetResults: NocodeEditorFormulaTargetResult[]
  issues: NocodeEditorFormulaPreflightIssue[]
  checkpoint: NocodeEditorFormulaApplyCheckpoint | null
}

export type NocodeEditorFormulaApplyCheckpoint = {
  planFingerprint: string
  contextFingerprint: string
  targets: Record<string, {
    targetFingerprint: string
    status: 'pending' | 'draft' | 'updated' | 'skipped' | 'failed'
    tableId?: string
    widgetId?: string
    reason?: string
  }>
}
