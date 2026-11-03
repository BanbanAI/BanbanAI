// 结构决策键跨版本漂移时，按「上一版同锚点题 + 答案账本」把本轮的新键改回上一版的键。
// 只做确定性的键改名与引用重写，不做语义推断：锚点、账本、唯一性任一不满足就原样放行。

export type FlowDecisionKeyHealingEntry = {
  from: string
  to: string
  reason: 'fact' | 'title'
}

const text = (value: unknown) => String(value ?? '').trim()

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeComparableText = (value: unknown) => text(value)
  .normalize('NFKC')
  .replace(/[\s\p{P}\p{S}]+/gu, '')
  .toLocaleLowerCase()

const readStringList = (value: unknown) => (
  Array.isArray(value) ? value.map(text).filter(Boolean) : []
)

const intersects = (left: string[], right: string[]) => (
  left.some(item => right.includes(item))
)

const readQuestionKey = (question: Record<string, unknown>) => (
  text(question.decisionKey) || text(question.questionId) || text(question.id)
)

const readDecisionScope = (question: Record<string, unknown>) => {
  const scope = isRecord(question.decisionScope) ? question.decisionScope : null
  const kind = text(scope?.kind)
  const id = text(scope?.id)
  return kind && id ? { kind, id } : null
}

const hasDecisionAnswer = (decision: Record<string, unknown>) => Boolean(
  decision.confirmed === true
  || text(decision.selectedOptionValue)
  || text(decision.answerSummary)
  || text(decision.answerDetail)
)

export type FlowDecisionStepScopeHealingEntry = {
  questionId: string
  decisionKey: string
  staleStepKey: string
}

const readStepScope = (question: Record<string, unknown>) => {
  const scope = isRecord(question.decisionScope) ? question.decisionScope : null
  const kind = text(scope?.kind)
  const id = text(scope?.id)
  return kind === 'step' && id ? { kind, id } : null
}

const readSchemeStepKeys = (scheme: Record<string, unknown>) => {
  const mainPath = Array.isArray(scheme.mainPath) ? scheme.mainPath : []
  const branches = Array.isArray(scheme.branches) ? scheme.branches : []
  const steps = [
    ...mainPath,
    ...branches.flatMap(branch => (
      isRecord(branch) && Array.isArray(branch.steps) ? branch.steps : []
    )),
  ].filter(isRecord)
  return new Set(steps.map(step => text(step.key)).filter(Boolean))
}

/**
 * 已确认题随方案重新暂存时，步骤键可能被模型重写（主链路拆分支、审批步骤改名）。
 * 题上的 decisionScope.step 来自上一版，不能当作本轮契约错误：
 * 只要上一版同锚点题确认过同一个步骤，就先摘掉失效的显式作用域，
 * 交给 reconcileFlowSchemeConfirmedAnchors 按「同锚点 + 候选步骤」重锚。
 */
export const healFlowSchemeDecisionStepScopes = (input: {
  scheme: unknown
  previousQuestions?: Array<Record<string, unknown>> | null
}): { scheme: unknown; healed: FlowDecisionStepScopeHealingEntry[] } => {
  const scheme = input.scheme
  const untouched = { scheme, healed: [] as FlowDecisionStepScopeHealingEntry[] }
  if (!isRecord(scheme)) return untouched
  const confirmation = isRecord(scheme.confirmation) ? scheme.confirmation : null
  const rawQuestions = Array.isArray(confirmation?.questions) ? confirmation.questions : []
  const previousQuestions = Array.isArray(input.previousQuestions)
    ? input.previousQuestions.filter(isRecord)
    : []
  if (!rawQuestions.length || !previousQuestions.length) return untouched

  const stepKeys = readSchemeStepKeys(scheme)
  if (!stepKeys.size) return untouched

  const previousByAnchor = new Map<string, Record<string, unknown>>()
  for (const question of previousQuestions) {
    if (question.confirmed !== true) continue
    const key = readQuestionKey(question)
    if (key) previousByAnchor.set(key, question)
  }

  const healed: FlowDecisionStepScopeHealingEntry[] = []
  const nextQuestions = rawQuestions.map((question) => {
    if (!isRecord(question)) return question
    const scope = readStepScope(question)
    if (!scope || stepKeys.has(scope.id)) return question
    const anchor = readQuestionKey(question)
    const previous = anchor ? previousByAnchor.get(anchor) : null
    const previousScope = previous ? readStepScope(previous) : null
    // 只有「上一版同锚点题确认过同一个步骤」才是可继承的漂移；
    // 模型本轮新写的无效步骤继续由契约校验拦住。
    if (!previousScope || previousScope.id !== scope.id) return question
    const { decisionScope, ...rest } = question
    healed.push({
      questionId: text(question.id) || anchor,
      decisionKey: anchor,
      staleStepKey: scope.id,
    })
    return rest
  })

  if (!healed.length) return untouched
  return {
    scheme: {
      ...scheme,
      confirmation: { ...confirmation, questions: nextQuestions },
    },
    healed,
  }
}

export const healFlowSchemeDecisionKeys = (input: {
  scheme: unknown
  /** 上一版暂存方案的确认题：提供键，也提供锚点（scope / facts / title / changes） */
  previousQuestions?: Array<Record<string, unknown>> | null
  /** 答案账本：本轮请求携带的已答决策 ∪ 上一版方案里已作答的题 */
  answeredDecisions?: Array<Record<string, unknown>> | null
}): { scheme: unknown; healed: FlowDecisionKeyHealingEntry[] } => {
  const scheme = input.scheme
  const untouched = { scheme, healed: [] as FlowDecisionKeyHealingEntry[] }
  if (!isRecord(scheme)) return untouched
  const confirmation = isRecord(scheme.confirmation) ? scheme.confirmation : null
  const rawQuestions = Array.isArray(confirmation?.questions) ? confirmation.questions : []
  const currentQuestions = rawQuestions.filter(isRecord)
  const previousQuestions = Array.isArray(input.previousQuestions)
    ? input.previousQuestions.filter(isRecord)
    : []
  const answeredDecisions = Array.isArray(input.answeredDecisions)
    ? input.answeredDecisions.filter(isRecord)
    : []
  if (!currentQuestions.length || !previousQuestions.length || !answeredDecisions.length) {
    return untouched
  }

  const answeredKeys = new Set<string>()
  for (const decision of answeredDecisions) {
    const key = readQuestionKey(decision)
    if (key && hasDecisionAnswer(decision)) {
      answeredKeys.add(key)
    }
  }
  if (!answeredKeys.size) return untouched

  const currentKeys = new Set(currentQuestions.map(readQuestionKey).filter(Boolean))
  const renames = new Map<string, string>()
  const healed: FlowDecisionKeyHealingEntry[] = []

  for (const question of currentQuestions) {
    const key = readQuestionKey(question)
    if (!key || renames.has(key)) continue
    // 本轮已作答的题不覆盖；用户已经按新键给出了答案。
    if (answeredKeys.has(key)) continue
    const scope = readDecisionScope(question)
    if (!scope) continue
    const currentFacts = readStringList(question.producesFacts)
    const currentChanges = readStringList(question.changes)
    const currentTitle = normalizeComparableText(question.title)

    const candidates = previousQuestions.flatMap((previous): FlowDecisionKeyHealingEntry[] => {
      const previousKey = readQuestionKey(previous)
      if (!previousKey || previousKey === key) return []
      // 账本里必须真有这条答案，否则没有可继承的结论。
      if (!answeredKeys.has(previousKey)) return []
      // 不抢本轮现有键：上一版的键已经被这道题之外的题占用时放弃。
      if (currentKeys.has(previousKey)) return []
      if (Array.from(renames.values()).includes(previousKey)) return []
      const previousScope = readDecisionScope(previous)
      if (!previousScope || previousScope.kind !== scope.kind || previousScope.id !== scope.id) {
        return []
      }
      const factMatch = intersects(currentFacts, readStringList(previous.producesFacts))
      const titleMatch = Boolean(
        currentTitle
        && currentTitle === normalizeComparableText(previous.title)
        && intersects(currentChanges, readStringList(previous.changes)),
      )
      if (!factMatch && !titleMatch) return []
      return [{ from: key, to: previousKey, reason: factMatch ? 'fact' : 'title' }]
    })

    // 命中候选必须唯一：两条同锚点题无法判定该继承哪条答案。
    if (candidates.length !== 1) continue
    renames.set(key, candidates[0].to)
    healed.push(candidates[0])
  }

  if (!renames.size) return untouched

  const rewriteKey = (value: unknown) => renames.get(text(value)) || text(value)
  const rewriteKeyList = (value: unknown) => (
    Array.from(new Set(readStringList(value).map(rewriteKey))).filter(Boolean)
  )

  const rewriteQuestion = (question: Record<string, unknown>) => {
    const key = readQuestionKey(question)
    const nextKey = renames.get(key)
    return {
      ...question,
      ...(nextKey ? { decisionKey: nextKey } : {}),
      ...(Array.isArray(question.dependsOn)
        ? { dependsOn: rewriteKeyList(question.dependsOn) }
        : {}),
      ...(Array.isArray(question.prerequisites)
        ? {
            prerequisites: question.prerequisites.map((prerequisite) => (
              isRecord(prerequisite) && renames.has(text(prerequisite.decisionKey))
                ? { ...prerequisite, decisionKey: rewriteKey(prerequisite.decisionKey) }
                : prerequisite
            )),
          }
        : {}),
    }
  }

  return {
    scheme: {
      ...scheme,
      confirmation: {
        ...confirmation,
        questions: rawQuestions.map(question => (
          isRecord(question) ? rewriteQuestion(question) : question
        )),
      },
      ...(Array.isArray(scheme.openQuestions)
        ? {
            openQuestions: scheme.openQuestions.map((question) => (
              isRecord(question) && renames.has(text(question.key))
                ? { ...question, key: rewriteKey(question.key) }
                : question
            )),
          }
        : {}),
      ...(Array.isArray(scheme.dependencies)
        ? {
            dependencies: scheme.dependencies.map((dependency) => (
              isRecord(dependency) && renames.has(text(dependency.decisionKey))
                ? { ...dependency, decisionKey: rewriteKey(dependency.decisionKey) }
                : dependency
            )),
          }
        : {}),
      ...(Array.isArray(scheme.assumptions)
        ? {
            assumptions: scheme.assumptions.map((assumption) => {
              if (!isRecord(assumption)) return assumption
              const decisionKey = renames.has(text(assumption.decisionKey))
                ? rewriteKey(assumption.decisionKey)
                : assumption.decisionKey
              return {
                ...assumption,
                ...(decisionKey ? { decisionKey } : {}),
                ...(Array.isArray(assumption.dependentDecisionKeys)
                  ? { dependentDecisionKeys: rewriteKeyList(assumption.dependentDecisionKeys) }
                  : {}),
              }
            }),
          }
        : {}),
    },
    healed,
  }
}
