import {
  buildUniqueAppBuilderHandoffExcelMaterials,
  normalizeAppBuilderHandoff,
  resolveAppBuilderHandoffExcelAttachmentReference,
} from '@common/utils/appBuilderHandoff'
import type { AiAttachmentReference } from '@common/types/aiAttachment'
import {
  normalizeAiAttachmentMessageMetadata,
} from '@common/utils/aiAttachmentIntent'
import { inspectWorkbenchAppBuilderHandoffIntentLikeFence } from '@common/utils/workbenchAppBuilderHandoffIntent'
import type {
  AppBuilderCreationMode,
  AppBuilderHandoff,
  WorkbenchAppBuilderHandoffIntent,
} from '@common/types/appBuilderHandoff'
import { RequestStorage } from '@main/middleware'
import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common'
import { AiAppBuilderHandoffIssueMetadata, AiMessageRole } from '../ai.types'
import { collectPromptExplicitAppNameSignals } from '../utils/ai-explicit-app-name-signal.util'
import { ProjectService } from '../../project/project.services'
import { AiAttachmentService } from '../thread/ai-attachment.service'
import { AppBuilderHandoffStoreService } from './app-builder-handoff.store.service'
import { isSystemAdminAccount } from '@common/types/account'

export type WorkbenchAppBuilderHandoffClarification = {
  required: true
  question: string
  options: Array<{
    value: Exclude<AppBuilderCreationMode, 'undecided'>
    label: string
  }>
}

export type WorkbenchAppBuilderHandoffResult = {
  handoff: AppBuilderHandoff
  clarification?: WorkbenchAppBuilderHandoffClarification
}

export enum WorkbenchAppBuilderHandoffIssueCode {
  MISSING_ENTRY_TITLE = 'missing_entry_title',
  INVALID_CREATION_MODE = 'invalid_creation_mode',
  INVALID_INTENT_KIND = 'invalid_intent_kind',
  INVALID_JSON = 'invalid_json',
}

export type WorkbenchAppBuilderHandoffIssue = {
  issueCode: WorkbenchAppBuilderHandoffIssueCode
  code: WorkbenchAppBuilderHandoffIssueCode
  rawPayload: string
}

export type WorkbenchAppBuilderHandoffIntentInspection =
  | { kind: 'absent' }
  | ({
      kind: 'malformed'
    } & WorkbenchAppBuilderHandoffIssue)
  | {
      kind: 'parsed'
      intent: WorkbenchAppBuilderHandoffIntent
    }

export type WorkbenchAppBuilderHandoffOutcome =
  | WorkbenchAppBuilderHandoffResult
  | {
      issue: AiAppBuilderHandoffIssueMetadata
    }

export type WorkbenchAppBuilderHandoffContinuePayload =
  | {
      mode: 'create_new_app'
      nocodeId: string
      createdApp?: {
        appId: string
        appName?: string
      }
      handoffId: string
      sourceThreadId: string
    }
  | {
      mode: 'extend_existing_app'
      nocodeId: string
      handoffId: string
      sourceThreadId: string
    }

export type WorkbenchAppBuilderHandoffPreviewMetadata = {
  actionType: 'app-builder-handoff'
  handoffId: string
  creationMode: AppBuilderCreationMode
  status?: AppBuilderHandoff['status']
  excelAttachment?: AiAttachmentReference
  targetApp: AppBuilderHandoff['scope']['targetApp'] | null
  candidateApps: NonNullable<AppBuilderHandoff['scope']['candidateApps']>
  clarification: WorkbenchAppBuilderHandoffClarification | null
  summary: ReturnType<typeof buildWorkbenchHandoffPreview>
  sourceThreadId: string
}

type CandidateAppInput = {
  appId?: string
  appName: string
  confidence: number
}

const APP_BUILDER_HANDOFF_CONTINUING_TIMEOUT_MS = 10 * 60 * 1000

const INVALID_EXPLICIT_TARGET_APP_NAMES = new Set([
  '\u6211',
  '\u6211\u4eec',
  '\u81ea\u5df1',
  '\u73b0\u6709',
  '\u73b0\u6709\u5e94\u7528',
  '\u5df2\u6709',
  '\u5df2\u6709\u5e94\u7528',
])

const normalizeWorkbenchHandoffText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()
const WORKBENCH_HANDOFF_SUMMARY_LIMIT = 160

const truncateWorkbenchHandoffText = (value: string, limit = WORKBENCH_HANDOFF_SUMMARY_LIMIT) => {
  const text = normalizeWorkbenchHandoffText(value)
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 3))}...`
}

const normalizeExplicitTargetAppName = (value: unknown) => {
  const appName = normalizeWorkbenchHandoffText(value)
  return appName && !INVALID_EXPLICIT_TARGET_APP_NAMES.has(appName)
    ? appName
    : ''
}

const resolveWorkbenchExplicitTargetAppName = (userMessage: string) => {
  const text = normalizeWorkbenchHandoffText(userMessage)
  const patterns = [
    /\u5728\s*([^\s\uff0c,\u3002]{1,32})\s*(?:\u91cc|\u4e2d)[\s\S]*?(?:\u52a0|\u65b0\u589e|\u6dfb\u52a0)/u,
    /(?:\u7ed9|\u5411)\s*([^\s\uff0c,\u3002]{1,32})\s*(?:\u52a0|\u65b0\u589e|\u6dfb\u52a0)/u,
    /\u6269\u5c55\s*([^\s\uff0c,\u3002]{1,32})/u,
  ]
  for (const pattern of patterns) {
    const appName = normalizeExplicitTargetAppName(text.match(pattern)?.[1])
    if (appName) {
      return appName
    }
  }
  return ''
}

const CREATION_MODE_LABELS = {
  get createNewApp() { return global.i18next.t('appBuilderHandoffService.createNewApp') },
  get extendExistingApp() { return global.i18next.t('appBuilderHandoffService.extendExistingApp') },
}

const buildCreationModeConfirmationText = () => (
  global.i18next.t('appBuilderHandoffService.confirmCreationMode', {
    createNewApp: CREATION_MODE_LABELS.createNewApp,
    extendExistingApp: CREATION_MODE_LABELS.extendExistingApp,
  })
)

const buildWorkbenchHandoffCardSummary = (handoff: AppBuilderHandoff) => {
  const targetAppName = resolveWorkbenchHandoffTargetAppName(handoff)
  if (handoff.scope.creationMode === 'undecided') {
    return global.i18next.t('appBuilderHandoffService.undecidedCardSummary', {
      createNewApp: CREATION_MODE_LABELS.createNewApp,
      extendExistingApp: CREATION_MODE_LABELS.extendExistingApp,
    })
  }
  if (handoff.scope.creationMode === 'create_new_app') {
    return global.i18next.t('appBuilderHandoffService.createNewAppCardSummary')
  }
  return targetAppName
    ? global.i18next.t('appBuilderHandoffService.extendNamedAppCardSummary', { appName: targetAppName })
    : global.i18next.t('appBuilderHandoffService.extendExistingAppCardSummary')
}

export const buildWorkbenchHandoffPreview = (handoff: AppBuilderHandoff) => {
  const materialsSummary = buildWorkbenchHandoffMaterialsSummary(handoff)
  return {
    title: handoff.intent.entryTitle || handoff.draft.appName || global.i18next.t('appBuilderHandoffService.appCreationDraft'),
    summary: buildWorkbenchHandoffCardSummary(handoff),
    sourceThreadId: handoff.source.threadId,
    ...(materialsSummary ? { materialsSummary } : {}),
  }
}

export const buildWorkbenchHandoffPreviewMetadata = (
  handoff: AppBuilderHandoff,
  clarification?: WorkbenchAppBuilderHandoffClarification | null,
): WorkbenchAppBuilderHandoffPreviewMetadata => {
  const excelAttachment = resolveAppBuilderHandoffExcelAttachmentReference(handoff)

  return {
    actionType: 'app-builder-handoff' as const,
    handoffId: handoff.handoffId,
    creationMode: handoff.scope.creationMode,
    status: handoff.status,
    ...(excelAttachment ? { excelAttachment } : {}),
    targetApp: handoff.scope.targetApp || null,
    candidateApps: handoff.scope.candidateApps || [],
    clarification: clarification || null,
    summary: buildWorkbenchHandoffPreview(handoff),
    sourceThreadId: handoff.source.threadId,
  }
}

export const buildWorkbenchHandoffDraftSummary = (options: {
  userMessage: string
  entryTitle: string
  intentKind: AppBuilderHandoff['intent']['kind']
  creationMode: AppBuilderCreationMode
  targetAppName?: string
}) => {
  const title = normalizeWorkbenchHandoffText(options.entryTitle)
  const goal = normalizeWorkbenchHandoffText(options.userMessage)
  const objectLabel = options.intentKind === 'create_form'
    ? global.i18next.t('appBuilderHandoffService.form')
    : global.i18next.t('appBuilderHandoffService.app')
  const targetAppName = normalizeWorkbenchHandoffText(options.targetAppName)
  const targetText = options.creationMode === 'extend_existing_app' && targetAppName
    ? global.i18next.t('appBuilderHandoffService.targetAppSuffix', { appName: targetAppName })
    : options.creationMode === 'undecided'
      ? global.i18next.t('appBuilderHandoffService.creationModeSuffix', {
        mode: buildCreationModeConfirmationText(),
      })
      : ''
  const goalText = goal ? global.i18next.t('appBuilderHandoffService.goalSuffix', { goal }) : ''
  return truncateWorkbenchHandoffText(global.i18next.t('appBuilderHandoffService.draftSummary', {
    goal: goalText,
    object: objectLabel,
    target: targetText,
    title: title || objectLabel,
  }))
}

const resolveWorkbenchHandoffTargetAppName = (handoff: AppBuilderHandoff) => (
  normalizeWorkbenchHandoffText(handoff.scope.targetApp?.appName)
)

function buildWorkbenchHandoffMaterialsSummary(handoff: AppBuilderHandoff) {
  const attachmentName = normalizeWorkbenchHandoffText(handoff.materials?.attachments?.[0]?.name)
  return attachmentName
    ? global.i18next.t('appBuilderHandoffService.excelAttached', { name: attachmentName })
    : ''
}

export const parseWorkbenchAppBuilderHandoffIntent = (
  assistantText: string,
): WorkbenchAppBuilderHandoffIntent | null => {
  const inspection = inspectWorkbenchAppBuilderHandoffIntent(assistantText)
  return inspection.kind === 'parsed' ? inspection.intent : null
}

export const buildWorkbenchHandoffIssueMetadata = (options: {
  issueCode: WorkbenchAppBuilderHandoffIssueCode
  sourceThreadId: string
}): AiAppBuilderHandoffIssueMetadata => {
  const sourceThreadId = normalizeWorkbenchHandoffText(options.sourceThreadId)
  const summaryByCode: Record<WorkbenchAppBuilderHandoffIssueCode, string> = {
    [WorkbenchAppBuilderHandoffIssueCode.MISSING_ENTRY_TITLE]:
      global.i18next.t('appBuilderHandoffService.missingEntryTitle'),
    [WorkbenchAppBuilderHandoffIssueCode.INVALID_CREATION_MODE]:
      global.i18next.t('appBuilderHandoffService.invalidCreationMode'),
    [WorkbenchAppBuilderHandoffIssueCode.INVALID_INTENT_KIND]:
      global.i18next.t('appBuilderHandoffService.invalidIntentKind'),
    [WorkbenchAppBuilderHandoffIssueCode.INVALID_JSON]:
      global.i18next.t('appBuilderHandoffService.invalidPayload'),
  }

  return {
    actionType: 'app-builder-handoff-issue',
    issueCode: options.issueCode,
    title: global.i18next.t('appBuilderHandoffService.incompleteRequest'),
    summary: summaryByCode[options.issueCode],
    sourceThreadId,
  }
}

export const inspectWorkbenchAppBuilderHandoffIntent = (
  assistantText: string,
): WorkbenchAppBuilderHandoffIntentInspection => {
  const inspection = inspectWorkbenchAppBuilderHandoffIntentLikeFence(assistantText)
  if (inspection.kind === 'parsed') {
    const targetAppName = normalizeExplicitTargetAppName(inspection.intent.targetAppName)
    const reason = normalizeWorkbenchHandoffText(inspection.intent.reason)
    return {
      kind: 'parsed',
      intent: {
        ...inspection.intent,
        ...(targetAppName ? { targetAppName } : {}),
        ...(reason ? { reason } : {}),
      },
    }
  }

  if (inspection.kind === 'malformed') {
    const issueCode = inspection.code === 'missing_entry_title'
      ? WorkbenchAppBuilderHandoffIssueCode.MISSING_ENTRY_TITLE
      : inspection.code === 'invalid_creation_mode'
        ? WorkbenchAppBuilderHandoffIssueCode.INVALID_CREATION_MODE
        : inspection.code === 'invalid_intent_kind'
          ? WorkbenchAppBuilderHandoffIssueCode.INVALID_INTENT_KIND
          : WorkbenchAppBuilderHandoffIssueCode.INVALID_JSON
    return {
      kind: 'malformed',
      issueCode,
      code: issueCode,
      rawPayload: inspection.rawPayload,
    }
  }

  return { kind: 'absent' }
}

export const normalizeWorkbenchAppBuilderCreationMode = (value: unknown): AppBuilderCreationMode | null => {
  if (value === 'create_new_app' || value === 'extend_existing_app' || value === 'undecided') {
    return value
  }
  return null
}

export const buildWorkbenchHandoffAssistantContent = (result: WorkbenchAppBuilderHandoffResult) => {
  const handoff = result.handoff
  const title = normalizeWorkbenchHandoffText(handoff.intent.entryTitle || handoff.draft.appName)
    || global.i18next.t('appBuilderHandoffService.appCreationRequest')
  const objectLabel = handoff.intent.kind === 'create_form'
    ? global.i18next.t('appBuilderHandoffService.form')
    : global.i18next.t('appBuilderHandoffService.app')
  if (result.clarification?.required) {
    return global.i18next.t('appBuilderHandoffService.assistantContentNeedsMode', {
      mode: buildCreationModeConfirmationText(),
      object: objectLabel,
      title,
    })
  }

  const targetAppName = resolveWorkbenchHandoffTargetAppName(handoff)
  return handoff.scope.creationMode === 'extend_existing_app' && targetAppName
    ? global.i18next.t('appBuilderHandoffService.assistantContentWithTarget', {
      object: objectLabel,
      target: targetAppName,
      title,
    })
    : global.i18next.t('appBuilderHandoffService.assistantContent', {
      object: objectLabel,
      title,
    })
}

@Injectable()
export class AppBuilderHandoffService {
  private readonly logger = new Logger(AppBuilderHandoffService.name)
  private readonly continueLocks = new Set<string>()

  constructor(
    private readonly storeService: AppBuilderHandoffStoreService,
    @Optional()
    private readonly projectService?: ProjectService,
    @Optional()
    private readonly attachmentService?: AiAttachmentService,
  ) {}

  async maybeBuildFromAssistantTurn(options: {
    thread: {
      id: string
      ownerAccountId?: string | null
    }
    userMessage: string
    assistantText: string
    assistantBlocks?: unknown[]
    assistantMessageId?: string
    assistantOutcome?: {
      finishReason?: string | null
      fallback?: boolean | null
    }
    historyMessages?: Array<{
      id?: string
      role?: AiMessageRole | string
      content?: string | null
      metadata?: Record<string, unknown> | null
    }>
  }): Promise<WorkbenchAppBuilderHandoffOutcome | null> {
    const threadId = this.normalizeText(options.thread?.id)
    const accountId = this.normalizeText(options.thread?.ownerAccountId)
    const userMessage = this.normalizeText(options.userMessage)
    const assistantText = this.normalizeAssistantText(options.assistantText)
    if (!this.isSuccessfulAssistantOutcome(options.assistantOutcome)) {
      return null
    }
    if (!threadId || !accountId) {
      return null
    }
    if (this.isExplicitCreationDenied(userMessage)) {
      return null
    }
    const handoffInspection = inspectWorkbenchAppBuilderHandoffIntent(assistantText)
    if (handoffInspection.kind === 'malformed') {
      return {
        issue: buildWorkbenchHandoffIssueMetadata({
          issueCode: handoffInspection.issueCode,
          sourceThreadId: threadId,
        }),
      }
    }
    if (handoffInspection.kind === 'absent') {
      return null
    }
    const handoffIntent = handoffInspection.intent

    const explicitTargetAppName = this.resolveUserConfirmedTargetAppName(userMessage, handoffIntent.targetAppName)
    const candidateApps = this.collectCandidateApps(userMessage, explicitTargetAppName)
    const creationMode = handoffIntent.creationMode
    const targetApp = creationMode === 'extend_existing_app'
      ? this.resolveTargetApp(userMessage, candidateApps, explicitTargetAppName)
      : undefined
    const inferredIntentKind = handoffIntent.intentKind
    const entryTitle = handoffIntent.entryTitle
    const assistantMessageId = this.normalizeText(options.assistantMessageId)
      || this.normalizeText(options.historyMessages?.find(item => item.role === AiMessageRole.ASSISTANT)?.id)
      || `assistant-${Date.now()}`

    const draft: AppBuilderHandoff['draft'] = {
      appName: inferredIntentKind === 'create_app' ? entryTitle : undefined,
      goal: userMessage,
      summary: buildWorkbenchHandoffDraftSummary({
        userMessage,
        entryTitle,
        intentKind: inferredIntentKind,
        creationMode,
        targetAppName: targetApp?.appName,
      }),
      candidateForms: inferredIntentKind === 'create_form'
        ? [{
          name: entryTitle,
          purpose: userMessage,
          fields: [],
        }]
        : [],
      candidateFlows: [],
      openQuestions: creationMode === 'undecided'
        ? [global.i18next.t('appBuilderHandoffService.confirmCreationModeQuestion', {
          createNewApp: CREATION_MODE_LABELS.createNewApp,
          extendExistingApp: CREATION_MODE_LABELS.extendExistingApp,
        })]
        : [],
      assumptions: [],
    }
    const references = this.collectReferences(options.historyMessages, assistantMessageId)
    const materials = await this.resolveCurrentTurnExcelMaterials(accountId, threadId)
    const handoff = normalizeAppBuilderHandoff({
      version: 'v1',
      handoffId: `handoff-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      source: {
        threadId,
        messageId: assistantMessageId,
        agentType: 'analysis',
        trigger: this.isAssistantSuggested(userMessage, assistantText)
          ? 'assistant_suggested'
          : 'explicit_user_request',
      },
      intent: {
        kind: inferredIntentKind,
        confidence: creationMode === 'undecided' ? 0.64 : 0.86,
        entryTitle,
      },
      scope: {
        creationMode,
        ...(targetApp ? { targetApp } : {}),
        ...(candidateApps.length ? { candidateApps } : {}),
      },
      draft,
      ...(materials ? { materials } : {}),
      references,
    })

    if (!handoff) {
      return null
    }

    const readyHandoff = {
      ...handoff,
      status: 'ready' as const,
    }

    await this.storeService.createOrReplace({
      ...readyHandoff,
      accountId,
      createdAt: 0,
      updatedAt: 0,
    })

    if (readyHandoff.scope.creationMode === 'undecided') {
      return {
        handoff: readyHandoff,
        clarification: {
          required: true,
          question: global.i18next.t('appBuilderHandoffService.creationModeQuestion', {
            createNewApp: CREATION_MODE_LABELS.createNewApp,
            extendExistingApp: CREATION_MODE_LABELS.extendExistingApp,
          }),
          options: [
            { value: 'create_new_app', label: CREATION_MODE_LABELS.createNewApp },
            { value: 'extend_existing_app', label: CREATION_MODE_LABELS.extendExistingApp },
          ],
        },
      }
    }

    return { handoff: readyHandoff }
  }

  async getHandoffForOwner(accountId: string, threadId: string, handoffId: string) {
    const normalizedThreadId = this.normalizeText(threadId)
    const handoff = await this.storeService.getByHandoffId(accountId, handoffId)
    if (!handoff || handoff.source.threadId !== normalizedThreadId) {
      throw new Error('App builder handoff not found or access denied')
    }
    return await this.recoverExpiredContinuingHandoffForRead(handoff)
  }

  async consumeHandoffForOwner(accountId: string, threadId: string, handoffId: string) {
    await this.getHandoffForOwner(accountId, threadId, handoffId)
    const consumed = await this.storeService.markConsumed(accountId, handoffId)
    if (!consumed) {
      throw new Error('App builder handoff not found or access denied')
    }
    return consumed
  }

  async releaseHandoffForOwner(accountId: string, threadId: string, handoffId: string) {
    const handoff = await this.getHandoffForOwner(accountId, threadId, handoffId)
    if (handoff.status !== 'continuing') {
      return handoff
    }
    const released = await this.storeService.markReady(accountId, handoffId)
    if (!released) {
      throw new Error('App builder handoff not found or access denied')
    }
    return released
  }

  async resolveHandoffForOwner(
    accountId: string,
    threadId: string,
    handoffId: string,
    body: {
      creationMode?: 'create_new_app' | 'extend_existing_app'
      targetAppId?: string
      targetAppName?: string
    },
  ) {
    const current = await this.getHandoffForOwner(accountId, threadId, handoffId)
    if (current.status !== 'ready') {
      throw new Error('App builder handoff must be ready before it can be resolved')
    }
    const creationMode = this.normalizeResolvedCreationMode(body?.creationMode)
    const targetAppId = this.normalizeText(body?.targetAppId)
    const targetAppName = this.normalizeText(body?.targetAppName)
    if (creationMode === 'extend_existing_app' && !targetAppId) {
      throw new Error('targetAppId is required when resolving extend_existing_app handoff')
    }
    const candidateApps = current.scope.candidateApps?.length
      ? { candidateApps: current.scope.candidateApps }
      : {}
    const nextOpenQuestions = current.draft.openQuestions.filter(question => (
      !/新建独立应用/.test(String(question || ''))
      && !/加到现有应用里/.test(String(question || ''))
      && !/添加到已有应用/.test(String(question || ''))
    ))
    const currentTargetAppName = this.normalizeText(current.scope.targetApp?.appName)
    const displayTargetAppName = targetAppName || currentTargetAppName
    const resolvedTargetApp = creationMode === 'extend_existing_app'
      ? {
        appId: targetAppId,
        ...(displayTargetAppName ? { appName: displayTargetAppName } : {}),
        confidence: 1,
        source: 'user_request' as const,
      }
      : undefined
    const nextScope: AppBuilderHandoff['scope'] = creationMode === 'create_new_app'
      ? {
        creationMode,
        ...candidateApps,
      }
      : {
        creationMode,
        ...candidateApps,
        ...(resolvedTargetApp ? { targetApp: resolvedTargetApp } : {}),
      }
    const next = normalizeAppBuilderHandoff({
      ...current,
      scope: nextScope,
      draft: {
        ...current.draft,
        openQuestions: nextOpenQuestions,
      },
    })
    if (!next) {
      throw new Error('Invalid app builder handoff resolve payload')
    }

    const saved = await this.storeService.createOrReplace({
      ...next,
      accountId: current.accountId,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
      status: current.status,
    })
    return saved
  }

  async continueHandoffForOwner(
    accountId: string,
    threadId: string,
    handoffId: string,
  ): Promise<WorkbenchAppBuilderHandoffContinuePayload> {
    const lockKey = this.buildContinueLockKey(accountId, threadId, handoffId)
    if (this.continueLocks.has(lockKey)) {
      throw new Error('App builder handoff continue is already in progress')
    }
    this.continueLocks.add(lockKey)
    try {
      return await this.claimAndBuildContinuePayload(accountId, threadId, handoffId)
    } finally {
      this.continueLocks.delete(lockKey)
    }
  }

  private async claimAndBuildContinuePayload(
    accountId: string,
    threadId: string,
    handoffId: string,
  ): Promise<WorkbenchAppBuilderHandoffContinuePayload> {
    const handoff = await this.getHandoffForOwner(accountId, threadId, handoffId)
    if (handoff.status === 'consumed') {
      throw new Error('App builder handoff has been consumed')
    }
    if (handoff.status === 'continuing' && !this.isContinuingExpired(handoff.updatedAt)) {
      throw new Error('App builder handoff continue is already in progress')
    }
    if (handoff.scope.creationMode === 'undecided') {
      throw new Error('creationMode must be resolved before continuing app builder handoff')
    }

    if (handoff.scope.creationMode === 'create_new_app') {
      const existingCreatedAppId = this.normalizeText(handoff.scope.createdApp?.appId)
      if (existingCreatedAppId) {
        await this.markHandoffContinuing(accountId, threadId, handoffId)
        return {
          mode: 'create_new_app',
          nocodeId: existingCreatedAppId,
          createdApp: {
            appId: existingCreatedAppId,
            ...(this.normalizeText(handoff.scope.createdApp?.appName)
              ? { appName: this.normalizeText(handoff.scope.createdApp?.appName) }
              : {}),
          },
          handoffId: handoff.handoffId,
          sourceThreadId: handoff.source.threadId,
        }
      }

      this.assertCreateNewAppAllowed()
      const claimed = await this.markHandoffContinuing(accountId, threadId, handoffId)
      const createdApp = await this.createNewAppShell({
        accountId,
        name: handoff.draft.appName || handoff.intent.entryTitle || global.i18next.t('appBuilderHandoffService.unnamedApp'),
        description: handoff.draft.summary || handoff.draft.goal || '',
        groupId: '',
      })
      const createdAt = Date.now()
      const persisted = await this.storeService.createOrReplace({
        ...claimed,
        accountId: claimed.accountId,
        createdAt: claimed.createdAt,
        updatedAt: claimed.updatedAt,
        status: 'continuing',
        scope: {
          ...claimed.scope,
          createdApp: {
            appId: createdApp.id,
            ...(this.normalizeText(createdApp.name) ? { appName: this.normalizeText(createdApp.name) } : {}),
            createdAt,
          },
        },
      })
      return {
        mode: 'create_new_app',
        nocodeId: persisted.scope.createdApp?.appId || createdApp.id,
        createdApp: {
          appId: persisted.scope.createdApp?.appId || createdApp.id,
          ...(this.normalizeText(persisted.scope.createdApp?.appName || createdApp.name)
            ? { appName: this.normalizeText(persisted.scope.createdApp?.appName || createdApp.name) }
            : {}),
        },
        handoffId: handoff.handoffId,
        sourceThreadId: handoff.source.threadId,
      }
    }

    const nocodeId = String(handoff.scope.targetApp?.appId || '').trim()
    if (!nocodeId) {
      throw new Error(global.i18next.t('appBuilderHandoffService.targetAppMissing'))
    }

    await this.markHandoffContinuing(accountId, threadId, handoffId)

    return {
      mode: 'extend_existing_app',
      nocodeId,
      handoffId: handoff.handoffId,
      sourceThreadId: handoff.source.threadId,
    }
  }

  private async markHandoffContinuing(accountId: string, threadId: string, handoffId: string) {
    const claimed = await this.storeService.markContinuing(accountId, handoffId)
    if (!claimed || claimed.source.threadId !== this.normalizeText(threadId)) {
      throw new Error('App builder handoff not found or access denied')
    }
    return claimed
  }

  private isContinuingExpired(updatedAt: number) {
    const normalizedUpdatedAt = Number(updatedAt || 0)
    return !Number.isFinite(normalizedUpdatedAt)
      || normalizedUpdatedAt <= 0
      || Date.now() - normalizedUpdatedAt > APP_BUILDER_HANDOFF_CONTINUING_TIMEOUT_MS
  }

  private async recoverExpiredContinuingHandoffForRead(handoff: ReturnType<AppBuilderHandoffStoreService['getByHandoffId']> extends Promise<infer T> ? NonNullable<T> : never) {
    if (handoff.status !== 'continuing' || !this.isContinuingExpired(handoff.updatedAt)) {
      return handoff
    }

    const recovered = await this.storeService.markReady(handoff.accountId, handoff.handoffId)
    if (!recovered) {
      throw new Error('App builder handoff not found or access denied')
    }

    this.logger.warn(
      `Recovered stale continuing app-builder handoff handoffId=${recovered.handoffId} threadId=${recovered.source.threadId} creationMode=${recovered.scope.creationMode}`,
    )

    return recovered
  }

  private buildContinueLockKey(accountId: string, threadId: string, handoffId: string) {
    return [
      this.normalizeText(accountId),
      this.normalizeText(threadId),
      this.normalizeText(handoffId),
    ].join('\n')
  }

  private isExplicitCreationDenied(userMessage: string) {
    const text = this.normalizeText(userMessage)
    return /(\u4e0d\u8981|\u522b|\u4e0d\u7528|\u65e0\u9700|\u5148\u4e0d|\u6682\u4e0d|\u4e0d)\s*(?:\u521b\u5efa|\u65b0\u5efa|\u751f\u6210|\u843d\u5730|\u642d\u5efa)/u.test(text)
      || /(\u53ea|\u4ec5)\s*(?:\u8bbe\u8ba1|\u5206\u6790|\u68b3\u7406|\u89c4\u5212)/u.test(text)
  }

  private resolveUserConfirmedTargetAppName(userMessage: string, targetAppName?: string) {
    const normalizedIntentTarget = this.normalizeText(targetAppName)
    if (!normalizedIntentTarget) {
      return this.extractTargetAppName(userMessage)
    }

    const explicitSignals = collectPromptExplicitAppNameSignals(userMessage, [targetAppName || normalizedIntentTarget])
    if (explicitSignals.some(signal => this.normalizeText(signal.appName) === normalizedIntentTarget)) {
      return normalizedIntentTarget
    }

    const userNamedTargetAppName = this.extractTargetAppName(userMessage)
    if (normalizedIntentTarget && normalizedIntentTarget === userNamedTargetAppName) {
      return normalizedIntentTarget
    }

    return userNamedTargetAppName
  }

  private isSuccessfulAssistantOutcome(outcome?: {
    finishReason?: string | null
    fallback?: boolean | null
  }) {
    if (!outcome) {
      return true
    }
    if (outcome.fallback === true) {
      return false
    }
    const finishReason = this.normalizeText(outcome.finishReason).toLowerCase()
    return finishReason !== 'fallback' && finishReason !== 'error'
  }

  private collectCandidateApps(
    userMessage: string,
    explicitTargetAppName?: string,
  ): NonNullable<AppBuilderHandoff['scope']['candidateApps']> {
    const byName = new Map<string, NonNullable<AppBuilderHandoff['scope']['candidateApps']>[number]>()
    const targetAppName = this.normalizeText(explicitTargetAppName) || this.extractTargetAppName(userMessage)
    if (targetAppName) {
      byName.set(targetAppName, {
        appName: targetAppName,
        confidence: 0.82,
        source: 'user_request',
      })
    }

    return Array.from(byName.values())
  }

  private resolveTargetApp(
    userMessage: string,
    candidateApps: NonNullable<AppBuilderHandoff['scope']['candidateApps']>,
    explicitTargetAppName?: string,
  ): AppBuilderHandoff['scope']['targetApp'] | undefined {
    const targetAppName = this.normalizeText(explicitTargetAppName) || this.extractTargetAppName(userMessage)
    const candidate = candidateApps.find(item => item.appName === targetAppName)
    if (!candidate) {
      return undefined
    }
    return {
      appName: candidate.appName,
      confidence: candidate.confidence,
      source: candidate.source,
    }
  }

  private extractTargetAppName(userMessage: string) {
    return resolveWorkbenchExplicitTargetAppName(userMessage)
  }

  private async resolveCurrentTurnExcelMaterials(
    accountId: string,
    threadId: string,
  ): Promise<AppBuilderHandoff['materials'] | undefined> {
    const req = RequestStorage.current?.req as { body?: { metadata?: unknown } } | undefined
    const attachmentMetadata = normalizeAiAttachmentMessageMetadata(req?.body?.metadata)
    const existingMaterials = buildUniqueAppBuilderHandoffExcelMaterials(attachmentMetadata.attachments)
    if (existingMaterials) return existingMaterials

    const remoteAttachments = attachmentMetadata.attachments.filter(attachment => (
      attachment.kind === 'excel'
      && Boolean(String(attachment.remoteHandle?.attachmentId || '').trim())
    ))
    if (remoteAttachments.length !== 1 || !this.attachmentService) return undefined

    const attachment = remoteAttachments[0]
    const attachmentId = String(attachment.remoteHandle?.attachmentId || '').trim()
    const session = await this.attachmentService.createImportSession(accountId, threadId, attachmentId)
    const data = session?.data
    const fullPath = String(data?.fullPath || '').trim()
    if (!fullPath) return undefined

    const importedName = String(data?.filename || '').trim()
    const importedExtension = importedName.split('.').pop()?.toLowerCase()
    const importedMimeType = importedExtension === 'xls'
      ? 'application/vnd.ms-excel'
      : importedExtension === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : ''

    return buildUniqueAppBuilderHandoffExcelMaterials([{
      ...attachment,
      ...(importedName ? { name: importedName } : {}),
      ...(importedExtension ? { extension: importedExtension } : {}),
      ...(importedMimeType ? { mimeType: importedMimeType } : {}),
      uploadHandle: {
        id: attachment.id,
        fullPath,
        ...(String(data?.sessionId || '').trim() ? { sessionId: String(data.sessionId).trim() } : {}),
        ...(String(data?.originFilePath || '').trim()
          ? { originFilePath: String(data.originFilePath).trim() }
          : {}),
      },
    }])
  }

  private assertCreateNewAppAllowed() {
    const req = RequestStorage.current?.req
    if (!req) {
      return
    }
    if (!isSystemAdminAccount(req.account)) {
      throw new ForbiddenException('Only admins can create app builder handoff apps')
    }
  }

  private async createNewAppShell(options: {
    accountId: string
    name: string
    description?: string
    groupId?: string
  }) {
    if (!this.projectService?.createEmptyNocodeShell) {
      throw new Error('App builder handoff create_new_app requires project creation support')
    }

    const createdApp = await this.projectService.createEmptyNocodeShell({
      accountId: options.accountId,
      name: options.name,
      description: options.description,
      groupId: options.groupId,
    })

    return createdApp
  }

  private collectReferences(
    historyMessages: Array<{ id?: string; role?: AiMessageRole | string; content?: string | null }> | undefined,
    assistantMessageId: string,
  ): AppBuilderHandoff['references'] {
    const messages = Array.isArray(historyMessages) ? historyMessages : []
    return messages
      .filter(item => item.role === AiMessageRole.ASSISTANT)
      .slice(-2)
      .map(item => {
        const text = this.normalizeText(item.content)
        const messageId = this.normalizeText(item.id) || assistantMessageId
        if (!text || !messageId) {
          return null
        }
        return {
          kind: 'analysis_fact' as const,
          text: text.length > 160 ? `${text.slice(0, 157)}...` : text,
          provenance: {
            messageId,
          },
        }
      })
      .filter(Boolean) as AppBuilderHandoff['references']
  }

  private readCandidateAppsFromUnknown(value: unknown): CandidateAppInput[] {
    if (!Array.isArray(value)) {
      return []
    }
    return value
      .map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return null
        }
        const raw = item as Record<string, unknown>
        const appName = this.normalizeText(raw.appName)
        const confidence = Number(raw.confidence)
        if (!appName || !Number.isFinite(confidence)) {
          return null
        }
        const appId = this.normalizeText(raw.appId)
        return {
          ...(appId ? { appId } : {}),
          appName,
          confidence: Math.min(1, Math.max(0, confidence)),
        }
      })
      .filter(Boolean) as CandidateAppInput[]
  }

  private isAssistantSuggested(userMessage: string, assistantText: string) {
    return !/(\u65b0\u5efa|\u521b\u5efa|\u751f\u6210|\u505a\u4e2a|\u505a\u4e00\u4e2a|\u642d\u5efa|\u52a0\u4e00\u4e2a|\u65b0\u589e|\u6dfb\u52a0|\u6269\u5c55)/.test(userMessage)
      && /(\u53ef\u4ee5\u7ee7\u7eed\u521b\u5efa|\u751f\u6210\u5e94\u7528|\u65b0\u5efa\u5e94\u7528)/.test(assistantText)
  }

  private normalizeResolvedCreationMode(value: unknown): Exclude<AppBuilderCreationMode, 'undecided'> {
    if (value === 'create_new_app' || value === 'extend_existing_app') {
      return value
    }
    throw new Error('creationMode must be create_new_app or extend_existing_app')
  }

  private normalizeText(value: unknown) {
    return String(value || '').replace(/\s+/g, ' ').trim()
  }

  private normalizeAssistantText(value: unknown) {
    return String(value || '').replace(/\r\n?/g, '\n').trim()
  }
}
