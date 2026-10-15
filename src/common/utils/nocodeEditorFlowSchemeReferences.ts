import type { NocodeEditorFlowScheme } from './nocodeEditorFlowScheme'

export type FlowSchemeReferenceDiagnostic = {
  code: 'flow_personnel_step_reference_missing' | 'flow_dependency_scope_reference_missing'
    | 'flow_confirmed_step_removed' | 'flow_scheme_empty_after_revision'
  message: string
  path: string
  questionId?: string
  decisionKey?: string
  stepKey?: string
}

const text = (value: unknown) => String(value || '').trim()

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
      message: `确认题“${question.title}”引用了不存在的流程步骤 ${stepKey}`,
      path: `confirmation.questions[${index}].personnelDecision.stepKey`,
      questionId: question.id,
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
      message: `依赖 ${dependency.id} 引用了不存在的${dependency.scopeKind === 'branch' ? '分支' : '步骤'} ${scopeKey || '(空)'}`,
      path: `dependencies[${index}].scopeKey`,
      stepKey: scopeKey,
      decisionKey: dependency.decisionKey,
    })
  })

  if (previousScheme) {
    const confirmedStepKeys = new Set((previousScheme.confirmation?.questions || [])
      .filter(question => question.confirmed === true)
      .map(question => text(question.personnelDecision?.stepKey))
      .filter(Boolean))
    confirmedStepKeys.forEach((stepKey) => {
      if (!steps.has(stepKey)) diagnostics.push({
        code: 'flow_confirmed_step_removed',
        message: `修订方案删除了已确认人员决策所用的流程步骤 ${stepKey}`,
        path: 'mainPath/branches',
        stepKey,
      })
    })
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
