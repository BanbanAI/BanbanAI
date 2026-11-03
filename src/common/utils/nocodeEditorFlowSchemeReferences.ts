import type { NocodeEditorAiConfirmQuestion } from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeStep,
  NocodeEditorFlowSchemeStepKind,
} from './nocodeEditorFlowScheme'

export type FlowSchemeReferenceDiagnosticCode =
  | 'flow_personnel_step_reference_missing'
  | 'flow_dependency_scope_reference_missing'
  | 'flow_confirmed_step_removed'
  | 'flow_confirmed_step_reanchored'
  | 'flow_confirmed_step_applied_to_split_steps'
  | 'flow_confirmed_decision_superseded_by_replan'
  | 'flow_scheme_empty_after_revision'

export type FlowSchemeReferenceDiagnostic = {
  code: FlowSchemeReferenceDiagnosticCode
  message: string
  path: string
  questionId?: string
  questionTitle?: string
  decisionKey?: string
  stepKey?: string
  stepTitle?: string
  candidateStepKeys?: string[]
}

const text = (value: unknown) => String(value || '').trim()

const PERSONNEL_STEP_KINDS: ReadonlySet<NocodeEditorFlowSchemeStepKind> = new Set([
  'approval',
  'transact',
  'notify',
  'report-data',
])

const collectSchemeSteps = (scheme: NocodeEditorFlowScheme): NocodeEditorFlowSchemeStep[] => [
  ...(scheme.mainPath || []),
  ...(scheme.branches || []).flatMap(branch => branch.steps || []),
]

const normalizeTitleToken = (value: unknown) => text(value)
  .replace(/[\s，,。.、:：;；!！?？()（）[\]【】]+/g, '')
  .toLowerCase()

const resolveQuestionAnchorKey = (question: NocodeEditorAiConfirmQuestion) => (
  text(question.decisionKey) || text(question.id)
)

// 已确认结论的“来源类型”才是可跨版本迁移的身份；步骤键是模型每轮重新生成的。
const resolveConfirmedSourceType = (question: NocodeEditorAiConfirmQuestion) => {
  const options = question.options || []
  const selectedValue = text(question.selectedOptionValue)
  const selected = options.find(option => option.selected === true)
    || options.find(option => text(option.value) === selectedValue)
  return text(selected?.personnelCandidate?.sourceType)
}

const isStepPersonnelGrounded = (step: NocodeEditorFlowSchemeStep) => {
  const sourceType = text(step.personnelRequirement?.sourceType)
  return Boolean(sourceType) && sourceType !== 'unresolved'
}

const isStepCoveredByPendingQuestion = (
  step: NocodeEditorFlowSchemeStep,
  questions: NocodeEditorAiConfirmQuestion[],
) => questions.some(question => (
  text(question.personnelDecision?.stepKey) === text(step.key)
  && question.confirmed !== true
  && !text(question.selectedOptionValue)
))

const resolveReanchorCandidates = (input: {
  previousQuestion: NocodeEditorAiConfirmQuestion
  previousStep?: NocodeEditorFlowSchemeStep
  steps: NocodeEditorFlowSchemeStep[]
}) => {
  const expectedKind = input.previousStep?.kind
  const expectedSourceType = resolveConfirmedSourceType(input.previousQuestion)
    || text(input.previousStep?.personnelRequirement?.sourceType)
  const expectedTitle = normalizeTitleToken(input.previousStep?.title)
  return input.steps.filter((step) => {
    if (expectedKind && step.kind !== expectedKind) {
      return false
    }
    const stepSourceType = text(step.personnelRequirement?.sourceType)
    if (expectedSourceType && stepSourceType && stepSourceType === expectedSourceType) {
      return true
    }
    return Boolean(expectedTitle) && normalizeTitleToken(step.title) === expectedTitle
  })
}

export type FlowSchemeConfirmedAnchorReconciliation = {
  scheme: NocodeEditorFlowScheme
  blockers: FlowSchemeReferenceDiagnostic[]
  notices: FlowSchemeReferenceDiagnostic[]
}

/**
 * 已确认人员决策的锚点只跟“决策是否仍被当前方案引用”有关，不跟模型上一版生成的步骤键有关：
 * 步骤键在重构（主路径拆分支、增删二级审批）后必然变化，直接比对会把合法修订判成删除信息。
 * 这里按“唯一候选重锚 → 多候选阻断 → 决策已不在方案里则视为被本轮调整作废”收敛。
 */
export const reconcileFlowSchemeConfirmedAnchors = (input: {
  scheme: NocodeEditorFlowScheme
  previousScheme?: NocodeEditorFlowScheme | null
}): FlowSchemeConfirmedAnchorReconciliation => {
  const { scheme, previousScheme } = input
  if (!previousScheme) {
    return { scheme, blockers: [], notices: [] }
  }

  const steps = collectSchemeSteps(scheme)
  const stepKeys = new Set(steps.map(step => text(step.key)).filter(Boolean))
  const previousSteps = new Map(
    collectSchemeSteps(previousScheme).map(step => [text(step.key), step] as const),
  )
  const questions = scheme.confirmation?.questions || []
  const questionsByAnchor = new Map(
    questions
      .map(question => [resolveQuestionAnchorKey(question), question] as const)
      .filter(([key]) => Boolean(key)),
  )
  const healedAnchorById = new Map<string, string>()
  const removedQuestionIds = new Set<string>()
  const blockers: FlowSchemeReferenceDiagnostic[] = []
  const notices: FlowSchemeReferenceDiagnostic[] = []

  const previousQuestions = previousScheme.confirmation?.questions || []
  previousQuestions.forEach((previousQuestion) => {
    if (previousQuestion.confirmed !== true) {
      return
    }
    const previousStepKey = text(previousQuestion.personnelDecision?.stepKey)
    if (!previousStepKey || stepKeys.has(previousStepKey)) {
      return
    }
    const previousStep = previousSteps.get(previousStepKey)
    const previousStepTitle = text(previousStep?.title) || '原流程步骤'
    const questionTitle = text(previousQuestion.title) || '人员决策'
    const answerSummary = text(previousQuestion.answerSummary)
    const anchorFields = {
      questionId: text(previousQuestion.id) || undefined,
      questionTitle: questionTitle,
      decisionKey: text(previousQuestion.decisionKey) || undefined,
      stepKey: previousStepKey,
      stepTitle: previousStepTitle,
    }
    const carriedQuestion = questionsByAnchor.get(resolveQuestionAnchorKey(previousQuestion))

    if (!carriedQuestion) {
      const ungroundedStep = steps.find(step => (
        PERSONNEL_STEP_KINDS.has(step.kind)
        && !isStepPersonnelGrounded(step)
        && !isStepCoveredByPendingQuestion(step, questions)
      ))
      if (ungroundedStep) {
        blockers.push({
          code: 'flow_confirmed_step_removed',
          message: `上一版已确认的“${questionTitle}”在新方案里没有对应步骤，步骤“${text(ungroundedStep.title) || '新步骤'}”也没有配置人员来源，这条结论已丢失。请补回该结论，或先确认新步骤的人员来源再提交。`,
          path: 'mainPath/branches',
          ...anchorFields,
          candidateStepKeys: [text(ungroundedStep.key)].filter(Boolean),
        })
        return
      }
      notices.push({
        code: 'flow_confirmed_decision_superseded_by_replan',
        message: `上一版已确认的“${questionTitle}”${answerSummary ? `（${answerSummary}）` : ''}在新方案里没有对应步骤，已按本次调整作废。`,
        path: 'mainPath/branches',
        ...anchorFields,
      })
      return
    }

    const candidates = resolveReanchorCandidates({
      previousQuestion,
      previousStep,
      steps,
    })
    if (candidates.length === 1) {
      const target = candidates[0]
      healedAnchorById.set(carriedQuestion.id, text(target.key))
      notices.push({
        code: 'flow_confirmed_step_reanchored',
        message: `上一版已确认的“${questionTitle}”已挂到新方案的步骤“${text(target.title) || '新步骤'}”上。`,
        path: 'mainPath/branches',
        ...anchorFields,
        stepKey: text(target.key),
        candidateStepKeys: [text(target.key)],
      })
      return
    }
    if (candidates.length > 1) {
      // 主链路按条件拆成多条分支时，同一人员结论会同时落在多个同来源步骤上：
      // 每个候选都已自带人员来源且来源一致，就视为同一条结论被沿用，而不是“无法判断归属”。
      const expectedSourceType = resolveConfirmedSourceType(previousQuestion)
        || text(previousStep?.personnelRequirement?.sourceType)
      const candidateSourceTypes = new Set(
        candidates
          .map(candidate => text(candidate.personnelRequirement?.sourceType))
          .filter(Boolean),
      )
      if (
        candidates.every(isStepPersonnelGrounded)
        && candidateSourceTypes.size === 1
        && (!expectedSourceType || candidateSourceTypes.has(expectedSourceType))
      ) {
        const primary = candidates[0]
        healedAnchorById.set(carriedQuestion.id, text(primary.key))
        notices.push({
          code: 'flow_confirmed_step_applied_to_split_steps',
          message: `上一版已确认的“${questionTitle}”已沿用到新方案的 ${candidates.length} 个同来源步骤上。`,
          path: 'mainPath/branches',
          ...anchorFields,
          stepKey: text(primary.key),
          candidateStepKeys: candidates.map(candidate => text(candidate.key)).filter(Boolean),
        })
        return
      }
      blockers.push({
        code: 'flow_confirmed_step_removed',
        message: `上一版已确认的“${questionTitle}”在新方案里有多个可承接的步骤（${candidates.map(candidate => text(candidate.title) || '未命名步骤').join('、')}），无法确定这条结论应挂到哪一步，请保留原步骤键或明确对应关系后重试。`,
        path: 'mainPath/branches',
        ...anchorFields,
        candidateStepKeys: candidates.map(candidate => text(candidate.key)).filter(Boolean),
      })
      return
    }
    removedQuestionIds.add(carriedQuestion.id)
    notices.push({
      code: 'flow_confirmed_decision_superseded_by_replan',
      message: `上一版已确认的“${questionTitle}”${answerSummary ? `（${answerSummary}）` : ''}在新方案里没有可承接的步骤，该题已按本次调整移除。`,
      path: 'mainPath/branches',
      ...anchorFields,
    })
  })

  if (!blockers.length && !notices.length) {
    return { scheme, blockers, notices }
  }
  if (!removedQuestionIds.size && !healedAnchorById.size) {
    return { scheme, blockers, notices }
  }

  const reconciledQuestions = questions.flatMap((question) => {
    if (removedQuestionIds.has(question.id)) {
      return []
    }
    const healedStepKey = healedAnchorById.get(question.id)
    if (!healedStepKey) {
      return [question]
    }
    const previousStepKey = text(question.personnelDecision?.stepKey)
    const decisionScope = question.decisionScope
    return [{
      ...question,
      personnelDecision: question.personnelDecision
        ? { ...question.personnelDecision, stepKey: healedStepKey }
        : question.personnelDecision,
      ...(decisionScope?.kind === 'step' && text(decisionScope.id) === previousStepKey
        ? { decisionScope: { ...decisionScope, id: healedStepKey } }
        : {}),
    }]
  })

  return {
    scheme: {
      ...scheme,
      confirmation: scheme.confirmation
        ? { ...scheme.confirmation, questions: reconciledQuestions }
        : scheme.confirmation,
    },
    blockers,
    notices,
  }
}

export const validateFlowSchemeReferences = (
  scheme: NocodeEditorFlowScheme,
  previousScheme?: NocodeEditorFlowScheme | null,
): FlowSchemeReferenceDiagnostic[] => {
  const diagnostics: FlowSchemeReferenceDiagnostic[] = []
  const steps = new Set([
    ...(scheme.mainPath || []).map(step => text(step.key)),
    ...(scheme.branches || []).flatMap(branch => (branch.steps || []).map(step => text(step.key))),
  ].filter(Boolean))
  const branches = new Set((scheme.branches || []).map(branch => text(branch.key)).filter(Boolean))

  scheme.confirmation?.questions.forEach((question, index) => {
    const stepKey = text(question.personnelDecision?.stepKey)
    if (stepKey && !steps.has(stepKey)) diagnostics.push({
      code: 'flow_personnel_step_reference_missing',
      message: `确认题“${text(question.title) || '人员决策'}”引用的流程步骤已不存在，请重新选择该题对应的步骤后提交。`,
      path: `confirmation.questions[${index}].personnelDecision.stepKey`,
      questionId: question.id,
      questionTitle: text(question.title) || undefined,
      decisionKey: question.decisionKey,
      stepKey,
    })
  })

  scheme.dependencies?.forEach((dependency, index) => {
    const scopeKey = text(dependency.scopeKey)
    if (
      (dependency.scopeKind === 'step' && (!scopeKey || !steps.has(scopeKey)))
      || (dependency.scopeKind === 'branch' && (!scopeKey || !branches.has(scopeKey)))
    ) diagnostics.push({
      code: 'flow_dependency_scope_reference_missing',
      message: `流程依赖项引用了不存在的${dependency.scopeKind === 'branch' ? '分支' : '步骤'}，请先补齐对应结构再提交。`,
      path: `dependencies[${index}].scopeKey`,
      stepKey: scopeKey,
      decisionKey: dependency.decisionKey,
    })
  })

  if (previousScheme) {
    if (!steps.size && (
      (previousScheme.mainPath || []).length
      || (previousScheme.branches || []).some(branch => branch.steps.length)
    )) diagnostics.push({
      code: 'flow_scheme_empty_after_revision',
      message: '修订方案清空了原有流程步骤',
      path: 'mainPath/branches',
    })
  }
  return diagnostics
}
