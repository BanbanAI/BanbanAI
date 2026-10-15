import type { NocodeEditorAiConfirmQuestion } from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDeferredConfigItem,
  NocodeEditorFlowSchemeDependency,
} from './nocodeEditorFlowScheme'
import { findFlowDeferredCapability } from './nocodeEditorFlowDeferredCapabilities'
import { resolveFlowConfirmationPendingQuestionProjection } from './nocodeEditorFlowConfirmationPendingQuestions'

export type FlowBlueprintReadinessStage = 'blueprint' | 'draft' | 'enable_or_run'

export type FlowBlueprintReadinessIssue = {
  code:
  | 'flow_scheme_not_ready_for_blueprint'
  | 'flow_confirmation_pending'
  | 'flow_dependency_unresolved'
  | 'flow_deferred_runtime_unsupported'
  | 'flow_required_deferred_pending'
  | 'flow_decision_contract_invalid'
  issueId: string
  message: string
  stage: FlowBlueprintReadinessStage
  decisionKey?: string
  dependencyId?: string
  deferredConfigItemId?: string
  diagnostics?: Record<string, unknown>[]
}

export type FlowBlueprintReadiness = {
  canStageBlueprint: boolean
  canGenerateDraft: boolean
  canEnableOrRun: boolean
  blockingIssues: FlowBlueprintReadinessIssue[]
  deferredItems: NocodeEditorFlowSchemeDeferredConfigItem[]
  plannedDependencies: NocodeEditorFlowSchemeDependency[]
  pendingConfirmationQuestions: NocodeEditorAiConfirmQuestion[]
}

const text = (value: unknown) => String(value ?? '').trim()

const questionKey = (question: NocodeEditorAiConfirmQuestion) => (
  text(question.decisionKey) || text(question.id)
)

export const resolveFlowBlueprintReadiness = (scheme?: NocodeEditorFlowScheme | null): FlowBlueprintReadiness => {
  const questions = Array.isArray(scheme?.confirmation?.questions)
    ? scheme!.confirmation!.questions
    : []
  const { pendingQuestions: pendingConfirmationQuestions, contract } = resolveFlowConfirmationPendingQuestionProjection({
    questions,
    factSnapshot: scheme?.confirmation?.factSnapshot,
    decisionSnapshot: scheme?.confirmation?.decisionSnapshot,
  })

  const issues: FlowBlueprintReadinessIssue[] = []
  // confirmation 为 null 是「方案已完全收敛、没有待确认题」的正常形态（例如方案一次性给出全部已确认事实），
  // 此时方案已经可以生成蓝图；只有方案整体缺失才算尚未生成。
  if (!scheme) {
    issues.push({
      code: 'flow_scheme_not_ready_for_blueprint',
      issueId: 'flow-scheme-not-ready-for-blueprint',
      message: '流程方案尚未生成或确认，请先生成并确认流程方案，再暂存流程蓝图。',
      stage: 'blueprint',
    })
  }
  if (contract.invalid) {
    issues.push({
      code: 'flow_decision_contract_invalid',
      issueId: 'flow-decision-contract-invalid',
      message: '流程确认题的决策依赖或默认规则无效，请先修订流程方案。',
      stage: 'blueprint',
      diagnostics: contract.diagnostics.map(item => ({ ...item })),
    })
  }

  pendingConfirmationQuestions.forEach((question) => {
    issues.push({
      code: 'flow_confirmation_pending',
      issueId: `flow-confirmation-pending:${questionKey(question)}`,
      message: `流程方案仍待确认：${text(question.title) || questionKey(question)}`,
      stage: 'blueprint',
      decisionKey: questionKey(question),
    })
  })

  const confirmationQuestionKeys = new Set(questions.map(questionKey).filter(Boolean))
  ;(Array.isArray(scheme?.openQuestions) ? scheme!.openQuestions : []).forEach((question) => {
    const key = text(question.key)
    if (!key || confirmationQuestionKeys.has(key)) return
    issues.push({
      code: 'flow_confirmation_pending',
      issueId: `flow-confirmation-pending:${key}`,
      message: `流程方案仍待确认：${text(question.title) || key}`,
      stage: 'blueprint',
      decisionKey: key,
    })
  })

  const dependencies = Array.isArray(scheme?.dependencies) ? scheme!.dependencies : []
  const plannedDependencies = dependencies.filter(item => (
    item.resolutionStatus === 'resolved'
    && item.resolutionMode === 'create_later'
    && item.materializationStatus === 'planned'
  ))
  dependencies.forEach((dependency) => {
    if (
      dependency.resolutionStatus === 'resolved'
      && (
        dependency.materializationStatus === 'existing'
        || plannedDependencies.includes(dependency)
      )
    ) return
    issues.push({
      code: 'flow_dependency_unresolved',
      issueId: `flow-dependency-unresolved:${text(dependency.id)}`,
      message: `流程依赖尚未解决：${text(dependency.summary) || text(dependency.id)}`,
      stage: 'blueprint',
      dependencyId: dependency.id,
    })
  })

  const deferredItems = Array.isArray(scheme?.deferredConfigItems) ? scheme!.deferredConfigItems : []
  deferredItems.forEach((item) => {
    if (item.supportStatus === 'needs_runtime_support') {
      issues.push({
        code: 'flow_deferred_runtime_unsupported',
        issueId: `flow-deferred-runtime-unsupported:${text(item.id)}`,
        message: `当前运行时不支持延期配置：${text(item.summary) || text(item.id)}`,
        stage: 'blueprint',
        deferredConfigItemId: item.id,
      })
    }
    else if (!scheme || !findFlowDeferredCapability({
      scheme,
      nodeKey: item.nodeKey,
      category: item.category,
      settingPath: item.settingPath,
    })) {
      issues.push({
        code: 'flow_deferred_runtime_unsupported',
        issueId: `flow-deferred-capability-unverified:${text(item.id)}`,
        message: `无法验证该延期配置的运行时能力：${text(item.summary) || text(item.id)}`,
        stage: 'blueprint',
        deferredConfigItemId: item.id,
        diagnostics: [{
          nodeKey: text(item.nodeKey),
          category: item.category,
          settingPath: text(item.settingPath),
        }],
      })
    }
    if (item.requirementLevel === 'required' && item.lifecycleStatus !== 'completed' && item.lifecycleStatus !== 'resolved' && item.lifecycleStatus !== 'materialized') {
      issues.push({
        code: 'flow_required_deferred_pending',
        issueId: `flow-required-deferred-pending:${text(item.id)}`,
        message: `流程启用前仍需补齐配置：${text(item.summary) || text(item.id)}`,
        stage: 'enable_or_run',
        deferredConfigItemId: item.id,
      })
    }
  })

  const blueprintBlocking = issues.filter(issue => issue.stage === 'blueprint')
  const draftBlocking = issues.filter(issue => issue.stage === 'blueprint' || issue.code === 'flow_dependency_unresolved')
  return {
    canStageBlueprint: blueprintBlocking.length === 0,
    canGenerateDraft: draftBlocking.length === 0,
    canEnableOrRun: issues.length === 0,
    blockingIssues: issues,
    deferredItems,
    plannedDependencies,
    pendingConfirmationQuestions,
  }
}
