const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const text = (value: unknown) => String(value ?? '').trim()

const LEGAL_IMPACTS = ['structure', 'parameter', 'detail']
const STRUCTURAL_CHANGES = ['topology', 'scope', 'applicability']

export type FlowStructureAssumptionDiagnostic = {
  code: 'assumption_impact_missing'
    | 'structure_assumption_decision_missing'
    | 'structure_assumption_question_missing'
    | 'structure_assumption_question_not_structural'
    | 'structure_assumption_dependent_missing'
    | 'structure_assumption_dependent_without_prerequisite'
  message: string
  assumptionIndex: number
  /** 假设原文：收口提问要用它做题目，不能从 message 里反解 */
  assumptionText?: string
  decisionKey?: string
  dependencyKey?: string
}

/**
 * 结构性默认方案不能只写在 assumptions 里：必须绑定一道结构确认题，
 * 且受其影响的下游题必须声明 prerequisites，否则会与结构题同屏提问。
 * 只检查原始入参：归一化会把无法识别的 impact/changes 丢掉。
 */
export const validateFlowStructureAssumptions = (
  value: unknown,
): FlowStructureAssumptionDiagnostic[] => {
  const scheme = isRecord(value) && isRecord(value.scheme) ? value.scheme : value
  if (!isRecord(scheme)) return []
  const assumptions = Array.isArray(scheme.assumptions) ? scheme.assumptions : []
  if (!assumptions.length) return []
  const confirmation = isRecord(scheme.confirmation) ? scheme.confirmation : null
  const questions = (Array.isArray(confirmation?.questions) ? confirmation.questions : [])
    .filter(isRecord)
  const questionByKey = new Map<string, Record<string, unknown>>()
  questions.forEach((question) => {
    const key = text(question.decisionKey) || text(question.id)
    if (key) questionByKey.set(key, question)
  })

  const diagnostics: FlowStructureAssumptionDiagnostic[] = []
  assumptions.forEach((assumption, assumptionIndex) => {
    if (!isRecord(assumption)) {
      diagnostics.push({
        code: 'assumption_impact_missing',
        assumptionIndex,
        message: '假设必须写成 { text, impact }，不能用纯文本。',
      })
      return
    }
    const assumptionText = text(assumption.text)
    const impact = text(assumption.impact)
    if (!LEGAL_IMPACTS.includes(impact)) {
      diagnostics.push({
        code: 'assumption_impact_missing',
        assumptionIndex,
        ...(assumptionText ? { assumptionText } : {}),
        message: `假设“${assumptionText || '未命名'}”必须声明 impact（structure/parameter/detail）。`,
      })
      return
    }
    if (impact !== 'structure') return

    const decisionKey = text(assumption.decisionKey)
    if (!decisionKey) {
      diagnostics.push({
        code: 'structure_assumption_decision_missing',
        assumptionIndex,
        ...(assumptionText ? { assumptionText } : {}),
        message: `结构性假设“${assumptionText}”必须绑定一道结构确认题的 decisionKey。`,
      })
      return
    }
    const structureQuestion = questionByKey.get(decisionKey)
    if (!structureQuestion) {
      diagnostics.push({
        code: 'structure_assumption_question_missing',
        assumptionIndex,
        ...(assumptionText ? { assumptionText } : {}),
        decisionKey,
        message: `结构性假设“${assumptionText}”没有对应的确认题（${decisionKey}），请先把该结构交给用户确认。`,
      })
      return
    }
    const changes = (Array.isArray(structureQuestion.changes) ? structureQuestion.changes : []).map(text)
    if (!changes.some(change => STRUCTURAL_CHANGES.includes(change))) {
      diagnostics.push({
        code: 'structure_assumption_question_not_structural',
        assumptionIndex,
        ...(assumptionText ? { assumptionText } : {}),
        decisionKey,
        message: `结构确认题 ${decisionKey} 的 changes 必须包含 topology、scope 或 applicability。`,
      })
    }

    const dependents = (Array.isArray(assumption.dependentDecisionKeys)
      ? assumption.dependentDecisionKeys
      : []).map(text).filter(Boolean)
    dependents.forEach((dependentKey) => {
      const dependent = questionByKey.get(dependentKey)
      if (!dependent) {
        diagnostics.push({
          code: 'structure_assumption_dependent_missing',
          assumptionIndex,
          ...(assumptionText ? { assumptionText } : {}),
          decisionKey,
          dependencyKey: dependentKey,
          message: `结构性假设声明的下游题 ${dependentKey} 不存在于本轮确认题。`,
        })
        return
      }
      const prerequisites = Array.isArray(dependent.prerequisites) ? dependent.prerequisites : []
      const bound = prerequisites.some(item => isRecord(item) && text(item.decisionKey) === decisionKey)
      if (!bound) {
        diagnostics.push({
          code: 'structure_assumption_dependent_without_prerequisite',
          assumptionIndex,
          ...(assumptionText ? { assumptionText } : {}),
          decisionKey,
          dependencyKey: dependentKey,
          message: `下游题 ${dependentKey} 必须在 prerequisites 中引用结构题 ${decisionKey}，否则会与结构题同屏提问。`,
        })
      }
    })
  })
  return diagnostics
}
