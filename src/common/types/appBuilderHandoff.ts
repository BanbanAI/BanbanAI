export type AppBuilderHandoffMaterialUploadHandle = {
  fullPath: string
  id?: string
  sessionId?: string
  originFilePath?: string
}

export type AppBuilderHandoffExcelMaterialAttachment = {
  name: string
  mimeType?: string
  extension?: string
  size?: number
  uploadHandle: AppBuilderHandoffMaterialUploadHandle
}

export type AppBuilderCreationMode =
  | 'create_new_app'
  | 'extend_existing_app'
  | 'undecided'

export type AppBuilderHandoffStatus =
  | 'ready'
  | 'continuing'
  | 'consumed'
  | 'abandoned'

export type AppBuilderHandoffIntentKind = 'create_app' | 'create_form'

export type WorkbenchAppBuilderHandoffIntent = {
  handoffIntent: 'create_app_builder_task'
  creationMode: AppBuilderCreationMode
  intentKind: AppBuilderHandoffIntentKind
  entryTitle: string
  targetAppName?: string
  reason?: string
}

export type AppBuilderHandoff = {
  version: 'v1'
  handoffId: string
  status?: AppBuilderHandoffStatus
  source: {
    threadId: string
    messageId: string
    agentType: 'analysis'
    trigger: 'explicit_user_request' | 'assistant_suggested'
  }
  intent: {
    kind: AppBuilderHandoffIntentKind
    confidence: number
    entryTitle: string
  }
  scope: {
    creationMode: AppBuilderCreationMode
    createdApp?: {
      appId: string
      appName?: string
      createdAt?: number
    }
    targetApp?: {
      appId?: string
      appName?: string
      confidence?: number
      source?: 'user_request' | 'analysis_inference'
    }
    candidateApps?: Array<{
      appId?: string
      appName: string
      confidence: number
      source: 'user_request' | 'analysis_inference'
    }>
  }
  draft: {
    appName?: string
    goal: string
    summary: string
    candidateForms: Array<{
      name: string
      purpose?: string
      fields: Array<{
        name: string
        type?: string
        required?: boolean
        description?: string
        source?: 'user_request' | 'analysis_inference'
      }>
    }>
    candidateFlows: string[]
    openQuestions: string[]
    assumptions: string[]
  }
  materials?: {
    attachments?: AppBuilderHandoffExcelMaterialAttachment[]
  }
  references: Array<{
    kind: 'analysis_fact' | 'metric' | 'dimension' | 'record_pattern'
    text: string
    provenance: {
      messageId: string
      appId?: string
      sourceId?: string
    }
  }>
}
