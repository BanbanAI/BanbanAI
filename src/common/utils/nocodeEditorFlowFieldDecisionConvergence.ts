import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeDependency,
} from './nocodeEditorFlowScheme'
import type { NocodeEditorConfirmationDecision } from './nocodeEditorConfirmationDecisionProjection'
import {
  FLOW_GROUNDING_GLOBAL_SCOPE_KEY,
  normalizeText,
  parseFlowGroundingFieldOptionDecision,
} from './nocodeEditorFlowGroundingPresentation'

type UnknownRecord = Record<string, unknown>

type FlowFieldDecisionCapability = 'condition' | 'source'

export type FlowFieldDecisionSummaryField = {
  fieldId: string
  fieldName: string
  conditionPolicy?: string
  enumOptions?: Array<{ label: string; value: string }>
}

export type FlowFieldDecisionSummary = {
  tableId: string
  tableName: string
  fields: FlowFieldDecisionSummaryField[]
}

export type FlowFieldDecisionSkipReason =
  | 'form_evidence_unavailable'
  | 'target_form_mismatch'
  | 'field_not_found'
  | 'field_not_usable_for_condition'
  | 'source_table_unresolved'
  | 'scope_ambiguous'

export type FlowFieldDecisionConvergenceResult = {
  scheme: NocodeEditorFlowScheme
  applied: Array<{
    decisionKey: string
    providedKeys: string[]
    capability: FlowFieldDecisionCapability
    scopeKey: string
    fieldId: string
    fieldName: string
    dependencyIds: string[]
    closedQuestionIds: string[]
  }>
  skipped: Array<{
    decisionKey: string
    capability: FlowFieldDecisionCapability
    reason: FlowFieldDecisionSkipReason
    fieldId?: string
  }>
  // 规范键 + 原始键/问题 id：宿主用它判断 superseded_by_replan 是否已被消费。
  consumedDecisionKeys: string[]
}

const isRecord = (value: unknown): value is UnknownRecord => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/[-_/\\]/g, '')

const collectSummaryEnumOptions = (
  value: unknown,
): Array<{ label: string; value: string }> => (
  (Array.isArray(value) ? value : []).flatMap((item) => {
    if (typeof item === 'string') {
      const text = normalizeText(item)
      return text ? [{ label: text, value: text }] : []
    }
    if (!isRecord(item)) {
      return []
    }
    const label = normalizeText(item.label) || normalizeText(item.value)
    const optionValue = normalizeText(item.value) || normalizeText(item.label)
    return label && optionValue ? [{ label, value: optionValue }] : []
  })
)

const collectSummaryFields = (
  value: unknown,
): FlowFieldDecisionSummaryField[] => {
  if (!isRecord(value)) {
    return []
  }
  const fieldId = normalizeText(value.fieldId)
  const fieldName = normalizeText(value.fieldName)
  if (!fieldId || !fieldName) {
    return []
  }
  const enumOptions = collectSummaryEnumOptions(value.enumOptionsPreview)
  return [{
    fieldId,
    fieldName,
    conditionPolicy: normalizeText(value.conditionPolicy) || undefined,
    ...(enumOptions.length ? { enumOptions } : {}),
  }, ...(Array.isArray(value.subFields)
    ? value.subFields.flatMap(collectSummaryFields)
    : [])]
}

export const resolveFlowFieldDecisionSummary = (
  flowSummary: unknown,
): FlowFieldDecisionSummary | null => {
  const forms = isRecord(flowSummary) && isRecord(flowSummary.forms)
    ? flowSummary.forms
    : null
  const currentForm = forms && isRecord(forms.currentForm)
    ? forms.currentForm
    : null
  if (!currentForm) {
    return null
  }
  const tableId = normalizeText(currentForm.tableId)
  const tableName = normalizeText(currentForm.tableName)
  if (!tableId && !tableName) {
    return null
  }
  return {
    tableId,
    tableName,
    fields: Array.isArray(currentForm.fields)
      ? currentForm.fields.flatMap(collectSummaryFields)
      : [],
  }
}

const findSummaryField = (
  target: FlowFieldDecisionSummary,
  candidate: string,
) => {
  const text = normalizeText(candidate)
  if (!text) {
    return null
  }
  const direct = target.fields.find(field => field.fieldId === text)
    || target.fields.find(field => normalizeToken(field.fieldName) === normalizeToken(text))
  if (direct) {
    return direct
  }
  const matches = target.fields.filter((field) => {
    const leafId = normalizeText(field.fieldId.split('.').pop())
    const leafName = normalizeText(field.fieldName.split('.').pop())
    return !text.includes('.') && (
      leafId === text || normalizeToken(leafName) === normalizeToken(text)
    )
  })
  return matches.length === 1 ? matches[0] : null
}

const resolveDecisionQuestion = (
  scheme: NocodeEditorFlowScheme,
  decision: NocodeEditorConfirmationDecision,
) => {
  const keys = new Set([
    normalizeText(decision.decisionKey).toLowerCase(),
    normalizeText(decision.questionId).toLowerCase(),
  ].filter(Boolean))
  return (scheme.confirmation?.questions || []).find(question => (
    keys.has(normalizeText(question.decisionKey).toLowerCase())
    || keys.has(normalizeText(question.id).toLowerCase())
  )) || null
}

const resolveDecisionScopeKey = (input: {
  decision: NocodeEditorConfirmationDecision
  question: ReturnType<typeof resolveDecisionQuestion>
}): string => {
  const decisionKey = normalizeText(input.decision.decisionKey).toLowerCase()
  const canonicalScope = decisionKey.match(/^flow\.(?:condition|source)\.field:(.+)$/)?.[1]
  if (canonicalScope) {
    return canonicalScope
  }
  const legacyScope = decisionKey.match(
    /^flow-grounding-(?:condition-field(?:-(?:missing|forbidden))?|source-field(?:-(?:missing|conflict))?):(.+)$/,
  )?.[1]
  if (legacyScope) {
    return legacyScope
  }
  const branchKey = normalizeText(input.question?.branchKey).toLowerCase()
  return branchKey || FLOW_GROUNDING_GLOBAL_SCOPE_KEY
}

const buildCanonicalDecisionKey = (
  capability: FlowFieldDecisionCapability,
  scopeKey: string,
) => `${capability === 'condition' ? 'flow.condition.field' : 'flow.source.field'}:${scopeKey}`

const matchesDecisionIdentity = (
  key: unknown,
  decision: {
    capability: FlowFieldDecisionCapability
    decisionKey: string
    scopeKey: string
  },
) => {
  const normalizedKey = normalizeText(key).toLowerCase()
  if (!normalizedKey) {
    return false
  }
  if (normalizedKey === decision.decisionKey) {
    return true
  }
  if (!normalizedKey.startsWith('flow-grounding-')) {
    return false
  }
  const legacyKeys = decision.capability === 'condition'
    ? [
      'flow-grounding-condition-field',
      'flow-grounding-condition-field-missing',
      'flow-grounding-condition-field-forbidden',
    ]
    : [
      'flow-grounding-source-field',
      'flow-grounding-source-field-missing',
      'flow-grounding-source-field-conflict',
    ]
  return legacyKeys.some(legacyKey => (
    normalizedKey === `${legacyKey}:${decision.scopeKey}`
    || (decision.scopeKey === FLOW_GROUNDING_GLOBAL_SCOPE_KEY
      && normalizedKey === legacyKey)
  ))
}

const resolveDecisionFieldName = (input: {
  target: FlowFieldDecisionSummary
  fieldId: string
}) => findSummaryField(input.target, input.fieldId)

// 决策作用域可能是分支键，也可能是没有分支的节点键；按方案里的真实键归类，
// 避免新依赖的 scopeKind 与 scopeKey 对不上，影响作用域展示与后续匹配。
const resolveFieldDecisionScopeKind = (
  scheme: NocodeEditorFlowScheme,
  scopeKey: string,
): NocodeEditorFlowSchemeDependency['scopeKind'] => {
  if (scopeKey === FLOW_GROUNDING_GLOBAL_SCOPE_KEY) {
    return 'global'
  }
  const branchKeys = (scheme.branches || [])
    .map(branch => normalizeText(branch.key).toLowerCase())
    .filter(Boolean)
  if (branchKeys.includes(scopeKey)) {
    return 'branch'
  }
  const stepKeys = [
    ...(scheme.mainPath || []).map(step => step.key),
    ...(scheme.branches || []).flatMap(branch => (branch.steps || []).map(step => step.key)),
  ].map(key => normalizeText(key).toLowerCase()).filter(Boolean)
  return stepKeys.includes(scopeKey) ? 'step' : 'branch'
}

const upsertFieldDecisionDependency = (
  dependencies: NocodeEditorFlowSchemeDependency[],
  input: {
    decisionKey: string
    capability: FlowFieldDecisionCapability
    scopeKey: string
    scopeKind: NocodeEditorFlowSchemeDependency['scopeKind']
    fieldId: string
    fieldName: string
  },
) => {
  const id = `flow-dependency:field-decision:${input.capability}:${input.scopeKey}`
  const isGlobal = input.scopeKind === 'global'
  const next: NocodeEditorFlowSchemeDependency = {
    id,
    decisionKey: input.decisionKey,
    kind: 'field_missing',
    requiredFor: input.capability === 'condition' ? 'condition' : 'source_mapping',
    scopeKind: input.scopeKind,
    scopeKey: isGlobal ? undefined : input.scopeKey,
    ...(input.scopeKind === 'branch' ? { branchKey: input.scopeKey } : {}),
    riskLevel: 'high',
    resolutionStatus: 'resolved',
    resolutionMode: 'use_existing',
    materializationStatus: 'existing',
    fieldRef: { fieldId: input.fieldId, fieldName: input.fieldName },
    summary: input.capability === 'condition'
      ? `条件判断改用现有字段“${input.fieldName}”`
      : `数据来源改用现有字段“${input.fieldName}”`,
  }
  const index = dependencies.findIndex(dependency => dependency.id === id)
  if (index < 0) {
    return [...dependencies, next]
  }
  return dependencies.map((dependency, itemIndex) => (
    itemIndex === index ? { ...next, id: dependency.id } : dependency
  ))
}

export const convergeNocodeEditorFlowFieldDecisions = (input: {
  scheme: NocodeEditorFlowScheme
  flowSummary?: unknown
  flowConfirmationDecisions?: NocodeEditorConfirmationDecision[]
}): FlowFieldDecisionConvergenceResult => {
  const decisions = (input.flowConfirmationDecisions || []).flatMap((decision) => {
    const option = parseFlowGroundingFieldOptionDecision(decision.selectedOptionValue)
    if (!option) {
      return []
    }
    const question = resolveDecisionQuestion(input.scheme, decision)
    const scopeKey = resolveDecisionScopeKey({ decision, question })
    return [{
      capability: option.capability,
      fieldId: option.fieldId,
      optionValue: normalizeText(decision.selectedOptionValue),
      decisionKey: buildCanonicalDecisionKey(option.capability, scopeKey),
      scopeKey,
      question,
      originalFieldName: normalizeText(decision.decisionTarget?.fieldName)
        || normalizeText(question?.decisionTarget?.fieldName)
        || undefined,
      rawKeys: Array.from(new Set([
        normalizeText(decision.decisionKey),
        normalizeText(decision.questionId),
        normalizeText(question?.decisionKey),
        normalizeText(question?.id),
      ].map(key => key.toLowerCase()).filter(Boolean))),
    }]
  })

  if (!decisions.length) {
    return {
      scheme: input.scheme,
      applied: [],
      skipped: [],
      consumedDecisionKeys: [],
    }
  }

  const target = resolveFlowFieldDecisionSummary(input.flowSummary)
  const skipped: FlowFieldDecisionConvergenceResult['skipped'] = []
  const targetFormId = normalizeText(input.scheme.target?.formId)
  const targetFormName = normalizeText(input.scheme.target?.formName)

  if (!target) {
    decisions.forEach(decision => skipped.push({
      decisionKey: decision.decisionKey,
      capability: decision.capability,
      reason: 'form_evidence_unavailable',
      fieldId: decision.fieldId,
    }))
    return {
      scheme: input.scheme,
      applied: [],
      skipped,
      consumedDecisionKeys: [],
    }
  }

  const targetMatchesScheme = (!targetFormId || !target.tableId || targetFormId === target.tableId)
    && (!targetFormName || !target.tableName
      || normalizeToken(targetFormName) === normalizeToken(target.tableName))
  if (!targetMatchesScheme) {
    decisions.forEach(decision => skipped.push({
      decisionKey: decision.decisionKey,
      capability: decision.capability,
      reason: 'target_form_mismatch',
      fieldId: decision.fieldId,
    }))
    return {
      scheme: input.scheme,
      applied: [],
      skipped,
      consumedDecisionKeys: [],
    }
  }

  const applied: FlowFieldDecisionConvergenceResult['applied'] = []
  // 只浅拷贝方案：下面所有写入都新建对象，不改调用方持有的嵌套结构。
  const nextScheme: NocodeEditorFlowScheme = { ...input.scheme }
  let dependencies = [...(nextScheme.dependencies || [])]

  decisions.forEach((decision) => {
    const field = resolveDecisionFieldName({
      target,
      fieldId: decision.fieldId,
    })
    if (!field) {
      skipped.push({
        decisionKey: decision.decisionKey,
        capability: decision.capability,
        reason: 'field_not_found',
        fieldId: decision.fieldId,
      })
      return
    }
    if (
      decision.capability === 'condition'
      && field.conditionPolicy !== 'usable'
    ) {
      skipped.push({
        decisionKey: decision.decisionKey,
        capability: decision.capability,
        reason: 'field_not_usable_for_condition',
        fieldId: decision.fieldId,
      })
      return
    }

    const requiredFor = decision.capability === 'condition'
      ? 'condition'
      : 'source_mapping'
    const allowedKinds = decision.capability === 'condition'
      ? ['field_missing', 'field_policy_mismatch']
      : ['field_missing', 'mapping_conflict']
    // 已解析的同类依赖也要参与匹配：同一槽位再次回答时覆盖上一次选择，保证最后一次生效。
    const candidates = dependencies.filter(dependency => (
      dependency.requiredFor === requiredFor
      && allowedKinds.includes(dependency.kind)
      && (
        !dependency.targetFormId
        || !target.tableId
        || dependency.targetFormId === target.tableId
      )
      && (
        !dependency.targetFormName
        || !target.tableName
        || normalizeToken(dependency.targetFormName) === normalizeToken(target.tableName)
      )
    ))

    // candidates 已排除 source_table_missing，这里要在全部未解析依赖里检查来源表单。
    // 全局来源表单问题会影响所有映射；分支级问题只影响同分支与全局决策。
    const hasUnresolvedSourceTable = decision.capability === 'source'
      && dependencies.some((dependency) => {
        if (
          dependency.resolutionStatus === 'resolved'
          || dependency.requiredFor !== 'source_mapping'
          || dependency.kind !== 'source_table_missing'
        ) {
          return false
        }
        const dependencyBranchKey = normalizeText(dependency.branchKey).toLowerCase()
        const dependencyScopeKey = normalizeText(dependency.scopeKey).toLowerCase()
        return dependency.scopeKind === 'global'
          || (!dependencyBranchKey && !dependencyScopeKey)
          || dependencyBranchKey === decision.scopeKey
          || dependencyScopeKey === decision.scopeKey
          || decision.scopeKey === FLOW_GROUNDING_GLOBAL_SCOPE_KEY
      })
    if (hasUnresolvedSourceTable) {
      skipped.push({
        decisionKey: decision.decisionKey,
        capability: decision.capability,
        reason: 'source_table_unresolved',
        fieldId: decision.fieldId,
      })
      return
    }

    // 合成题按分支取值，依赖的 scopeKey 可能落在节点上；branchKey 或 scopeKey 任一同名即同一槽位。
    // 已带同一规范决策键的依赖也是同一槽位：全局决策曾唯一回退到分支依赖时，改选要覆盖原依赖而不是追加新依赖。
    const sameScope = candidates.filter((dependency) => {
      if (
        normalizeText(dependency.decisionKey).toLowerCase() === decision.decisionKey
      ) {
        return true
      }
      if (decision.scopeKey === FLOW_GROUNDING_GLOBAL_SCOPE_KEY) {
        return dependency.scopeKind === 'global'
      }
      const dependencyBranchKey = normalizeText(dependency.branchKey).toLowerCase()
      const dependencyScopeKey = normalizeText(dependency.scopeKey).toLowerCase()
      return dependencyBranchKey === decision.scopeKey
        || dependencyScopeKey === decision.scopeKey
    })
    let matched = sameScope
    if (!matched.length && decision.scopeKey === FLOW_GROUNDING_GLOBAL_SCOPE_KEY) {
      // 只对未解析候选做唯一回退：不能用一个全局答案覆盖别的分支已经确认的字段。
      const unresolvedCandidates = candidates.filter(
        dependency => dependency.resolutionStatus !== 'resolved',
      )
      if (unresolvedCandidates.length === 1) {
        matched = unresolvedCandidates
      } else if (unresolvedCandidates.length > 1) {
        skipped.push({
          decisionKey: decision.decisionKey,
          capability: decision.capability,
          reason: 'scope_ambiguous',
          fieldId: decision.fieldId,
        })
        return
      }
    }

    const matchedIds = new Set(matched.map(dependency => dependency.id))
    dependencies = dependencies.map((dependency) => {
      if (!matchedIds.has(dependency.id)) {
        return dependency
      }
      return {
        ...dependency,
        decisionKey: decision.decisionKey,
        resolutionStatus: 'resolved',
        resolutionMode: 'use_existing',
        materializationStatus: 'existing',
        unverifiedReason: undefined,
        fieldRef: { fieldId: field.fieldId, fieldName: field.fieldName },
        summary: decision.capability === 'condition'
          ? `条件判断改用现有字段“${field.fieldName}”`
          : `数据来源改用现有字段“${field.fieldName}”`,
      }
    })
    if (!matched.length) {
      dependencies = upsertFieldDecisionDependency(dependencies, {
        decisionKey: decision.decisionKey,
        capability: decision.capability,
        scopeKey: decision.scopeKey,
        scopeKind: resolveFieldDecisionScopeKind(nextScheme, decision.scopeKey),
        fieldId: field.fieldId,
        fieldName: field.fieldName,
      })
    }

    const closedQuestionIds: string[] = []
    nextScheme.confirmation = nextScheme.confirmation
      ? {
        ...nextScheme.confirmation,
        questions: nextScheme.confirmation.questions.map((question) => {
          if (!matchesDecisionIdentity(question.id, decision)
            && !matchesDecisionIdentity(question.decisionKey, decision)) {
            return question
          }
          closedQuestionIds.push(question.id)
          const options = Array.isArray(question.options) ? [...question.options] : []
          const hasOption = options.some(option => (
            normalizeText(option.value) === decision.optionValue
          ))
          if (!hasOption) {
            options.push({
              value: decision.optionValue,
              label: `改用现有字段“${field.fieldName}”`,
              description: decision.capability === 'condition'
                ? '使用该字段作为条件判断依据。'
                : '使用该字段作为本次流程的数据来源。',
            })
          }
          return {
            ...question,
            options: options.map(option => (
              normalizeText(option.value) === decision.optionValue
                ? { ...option, selected: true }
                : (option.selected ? { ...option, selected: false } : option)
            )),
            confirmed: true,
            selectedOptionValue: decision.optionValue,
            answerSummary: `改用现有字段“${field.fieldName}”`,
          }
        }),
      }
      : nextScheme.confirmation

    nextScheme.openQuestions = (nextScheme.openQuestions || [])
      .filter(question => !matchesDecisionIdentity(question.key, decision))
    const originalHint = decision.originalFieldName
      && decision.originalFieldName !== field.fieldName
      ? decision.originalFieldName
      : ''
    const fact = decision.capability === 'condition'
      ? (originalHint
        ? `AI 规划原引用的条件字段“${originalHint}”不可用，已确认改用现有字段“${field.fieldName}”作为判断依据。`
        : `条件判断已确认改用现有字段“${field.fieldName}”作为判断依据。`)
      : (originalHint
        ? `AI 规划原引用的来源字段“${originalHint}”不可用，已确认改用现有字段“${field.fieldName}”作为取值依据。`
        : `数据来源已确认改用现有字段“${field.fieldName}”作为取值依据。`)
    if (!(nextScheme.confirmedFacts || []).includes(fact)) {
      nextScheme.confirmedFacts = [...(nextScheme.confirmedFacts || []), fact]
    }

    applied.push({
      decisionKey: decision.decisionKey,
      providedKeys: decision.rawKeys,
      capability: decision.capability,
      scopeKey: decision.scopeKey,
      fieldId: field.fieldId,
      fieldName: field.fieldName,
      dependencyIds: matched.length
        ? [...matchedIds]
        : [`flow-dependency:field-decision:${decision.capability}:${decision.scopeKey}`],
      closedQuestionIds,
    })
  })

  return {
    scheme: {
      ...nextScheme,
      dependencies,
    },
    applied,
    skipped,
    consumedDecisionKeys: Array.from(new Set(
      applied.flatMap(item => [item.decisionKey, ...item.providedKeys]),
    )),
  }
}
