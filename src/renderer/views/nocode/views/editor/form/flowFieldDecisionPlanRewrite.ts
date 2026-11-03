import type { NocodeEditorFlowPlan } from '@common/utils/nocodeEditorFlowPlan'
import type { NocodeEditorFlowScheme } from '@common/utils/nocodeEditorFlowScheme'
import {
  FLOW_GROUNDING_GLOBAL_SCOPE_KEY,
  normalizeText,
} from '@common/utils/nocodeEditorFlowGroundingPresentation'
import {
  resolveFlowFieldDecisionSummary,
  type FlowFieldDecisionSummary,
  type FlowFieldDecisionSummaryField,
} from '@common/utils/nocodeEditorFlowFieldDecisionConvergence'
import {
  getFlowFieldReferenceCandidate,
  getFlowMappingSourceReferenceInput,
  getFlowMappingTargetFieldCandidate,
} from './ai-flow-plan-grounding'

type UnknownRecord = Record<string, unknown>

type PlanFieldDecision = {
  capability: 'condition' | 'source'
  scopeKey: string
  field: FlowFieldDecisionSummaryField
}

type PlanRewriteSkipReason = 'scope_ambiguous'

export type FlowFieldDecisionPlanRewriteResult = {
  plan: NocodeEditorFlowPlan
  rewrittenSites: number
  skipped: Array<{
    capability: 'condition' | 'source'
    reason: PlanRewriteSkipReason
    nodeKey?: string
    branchKey?: string
  }>
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

// 计划对象可能来自 Vue 响应式状态，JSON 深拷贝比 structuredClone 更安全。
const clonePlan = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const resolveCatalogField = (
  target: FlowFieldDecisionSummary,
  candidate: unknown,
): FlowFieldDecisionSummaryField | null => {
  const text = normalizeText(
    isRecord(candidate) ? getFlowFieldReferenceCandidate(candidate) : candidate,
  )
  if (!text) {
    return null
  }
  const direct = target.fields.find(field => field.fieldId === text)
    || target.fields.find(field => normalizeToken(field.fieldName) === normalizeToken(text))
  if (direct) {
    return direct
  }
  if (text.includes('.')) {
    // 镜像 grounding 的父/子路径解析：父字段可以是 id 或名称，子字段按全路径、叶子 id 或名称匹配。
    const [parentRef, subRef] = text.split('.', 2)
    const parent = target.fields.find(field => field.fieldId === parentRef)
      || target.fields.find(field => normalizeToken(field.fieldName) === normalizeToken(parentRef))
    if (!parent) {
      return null
    }
    const children = target.fields.filter(field => field.fieldId.startsWith(`${parent.fieldId}.`))
    const childMatches = children.filter(field => (
      field.fieldId === text
      || normalizeText(field.fieldId.split('.').pop()) === normalizeText(subRef)
      || normalizeToken(field.fieldName) === normalizeToken(subRef)
    ))
    return childMatches.length === 1 ? childMatches[0] : null
  }
  const matches = target.fields.filter((field) => {
    const leafId = normalizeText(field.fieldId.split('.').pop())
    const leafName = normalizeText(field.fieldName.split('.').pop())
    return leafId === text || normalizeToken(leafName) === normalizeToken(text)
  })
  return matches.length === 1 ? matches[0] : null
}

const resolvePlanDecisions = (input: {
  scheme?: NocodeEditorFlowScheme | null
  target: FlowFieldDecisionSummary
}): PlanFieldDecision[] => {
  const dependencies = input.scheme?.dependencies || []
  // 与 Phase A 同一条保护：来源表单仍未解决时，不消费来源字段决策。
  const hasUnresolvedSourceTable = (scopeKey: string) => dependencies.some((dependency) => {
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
      || dependencyBranchKey === scopeKey
      || dependencyScopeKey === scopeKey
      || scopeKey === FLOW_GROUNDING_GLOBAL_SCOPE_KEY
  })
  return dependencies.flatMap((dependency) => {
    if (
      dependency.resolutionStatus !== 'resolved'
      || dependency.resolutionMode !== 'use_existing'
      || dependency.materializationStatus !== 'existing'
    ) {
      return []
    }
    const decisionKey = normalizeText(dependency.decisionKey).toLowerCase()
    const capability = decisionKey.startsWith('flow.condition.field:')
      ? 'condition' as const
      : decisionKey.startsWith('flow.source.field:')
        ? 'source' as const
        : null
    if (!capability) {
      return []
    }
    if (
      (capability === 'condition' && dependency.requiredFor !== 'condition')
      || (capability === 'source' && dependency.requiredFor !== 'source_mapping')
    ) {
      return []
    }
    const fieldId = normalizeText(dependency.fieldRef?.fieldId)
    const field = fieldId
      ? input.target.fields.find(item => item.fieldId === fieldId) || null
      : null
    if (!field) {
      return []
    }
    if (capability === 'condition' && field.conditionPolicy !== 'usable') {
      return []
    }
    // 决策键后缀记录的是用户作答时的问题作用域，优先采信；branchKey / scopeKey 只作旧数据的兜底。
    const scopeKey = decisionKey.slice(decisionKey.indexOf(':') + 1)
      || normalizeText(dependency.branchKey).toLowerCase()
      || normalizeText(dependency.scopeKey).toLowerCase()
      || FLOW_GROUNDING_GLOBAL_SCOPE_KEY
    if (capability === 'source' && hasUnresolvedSourceTable(scopeKey)) {
      return []
    }
    return [{
      capability,
      scopeKey,
      field,
    }]
  })
}

type RewriteContext = {
  nodeKey?: string
  branchKey?: string
}

const pickPlanDecision = (input: {
  decisions: PlanFieldDecision[]
  capability: 'condition' | 'source'
  context: RewriteContext
}) => {
  const candidates = input.decisions.filter(decision => decision.capability === input.capability)
  const nodeKey = normalizeText(input.context.nodeKey).toLowerCase()
  const branchKey = normalizeText(input.context.branchKey).toLowerCase()
  // 只按作用域令牌匹配，不依赖 scopeKind：决策键后缀可能来自 branchKey，也可能来自 nodeKey。
  const tiers = [
    nodeKey ? candidates.filter(decision => decision.scopeKey === nodeKey) : [],
    branchKey ? candidates.filter(decision => decision.scopeKey === branchKey) : [],
    candidates.filter(decision => decision.scopeKey === FLOW_GROUNDING_GLOBAL_SCOPE_KEY),
  ]
  const tier = tiers.find(items => items.length)
  if (!tier?.length) {
    return { decision: null, ambiguous: false }
  }
  const fieldIds = new Set(tier.map(item => item.field.fieldId))
  return fieldIds.size > 1
    ? { decision: null, ambiguous: true }
    : { decision: tier[0], ambiguous: false }
}

const mapConditionRecords = (
  value: unknown,
  mapper: (record: UnknownRecord) => UnknownRecord,
): unknown => {
  if (!value) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(item => mapConditionRecords(item, mapper))
  }
  if (!isRecord(value)) {
    return value
  }
  if (Array.isArray(value.conditions)) {
    return {
      ...value,
      conditions: mapConditionRecords(value.conditions, mapper),
    }
  }
  return mapper(value)
}

const deleteKeys = (record: UnknownRecord, keys: string[]) => {
  keys.forEach((key) => {
    delete record[key]
  })
}

const rewriteConditionValue = (
  record: UnknownRecord,
  decision: PlanFieldDecision,
) => {
  record.type = 'FORM'
  record.value = decision.field.fieldId
  deleteKeys(record, [
    'valueFieldUID',
    'valueFieldId',
    'valueFieldName',
    'valueFieldAlias',
  ])
}

const rewriteConditionRecord = (input: {
  record: UnknownRecord
  context: RewriteContext
  decisions: PlanFieldDecision[]
  target: FlowFieldDecisionSummary
  diagnostics: FlowFieldDecisionPlanRewriteResult['skipped']
  counter: { value: number }
}) => {
  const { record, context, decisions, target, diagnostics, counter } = input
  const next = { ...record }

  const subjectCandidate = normalizeText(getFlowFieldReferenceCandidate(record))
  const subject = subjectCandidate ? resolveCatalogField(target, subjectCandidate) : null
  // 没有主体引用的记录不在这里补字段，和 validateConditionFieldReference 保持一致。
  const subjectInvalid = Boolean(subjectCandidate)
    && (!subject || subject.conditionPolicy !== 'usable')
  if (subjectInvalid) {
    const picked = pickPlanDecision({ decisions, capability: 'condition', context })
    if (picked.decision) {
      next.uid = picked.decision.field.fieldId
      deleteKeys(next, ['fieldUID', 'fieldId', 'id', 'fieldName', 'name', 'alias'])
      counter.value += 1
    } else if (picked.ambiguous) {
      diagnostics.push({
        capability: 'condition',
        reason: 'scope_ambiguous',
        nodeKey: context.nodeKey,
        branchKey: context.branchKey,
      })
    }
  }

  const valueFieldCandidate = [
    record.valueFieldUID,
    record.valueFieldId,
    record.valueFieldName,
    record.valueFieldAlias,
  ].map(item => normalizeText(item)).find(Boolean)
  const valueFieldValid = valueFieldCandidate
    ? Boolean(resolveCatalogField(target, valueFieldCandidate))
    : null
  const usesFormValue = normalizeToken(record.type) === 'form'
  // 与 grounding 一致：type=FORM 时 value 也可能是字段引用对象，不能直接 String() 成 [object Object]。
  const formValueCandidate = usesFormValue && !valueFieldCandidate
    ? normalizeText(
      isRecord(record.value) ? getFlowFieldReferenceCandidate(record.value) : record.value,
    )
    : ''
  const formValueValid = formValueCandidate
    ? Boolean(resolveCatalogField(target, formValueCandidate))
    : null
  const valueInvalid = valueFieldValid === false || formValueValid === false
  if (valueInvalid) {
    const picked = pickPlanDecision({ decisions, capability: 'source', context })
    if (picked.decision) {
      rewriteConditionValue(next, picked.decision)
      counter.value += 1
    } else if (picked.ambiguous) {
      diagnostics.push({
        capability: 'source',
        reason: 'scope_ambiguous',
        nodeKey: context.nodeKey,
        branchKey: context.branchKey,
      })
    }
  }

  return next
}

const rewriteConditionContainers = (input: {
  container: UnknownRecord
  keys: string[]
  context: RewriteContext
  decisions: PlanFieldDecision[]
  target: FlowFieldDecisionSummary
  diagnostics: FlowFieldDecisionPlanRewriteResult['skipped']
  counter: { value: number }
}) => {
  input.keys.forEach((key) => {
    if (key in input.container) {
      input.container[key] = mapConditionRecords(
        input.container[key],
        record => rewriteConditionRecord({ ...input, record }),
      )
    }
  })
}

// 模型常把枚举取值写进 valueFieldName/source，运行时会当作来源字段而找不到。
// 命中目标字段已有选项（label 或 value）时按固定值回写，避免升级成“来源字段不存在”的确认卡。
const resolveEnumFixedValue = (
  target: FlowFieldDecisionSummary,
  mapping: UnknownRecord,
  sourceText: string,
) => {
  const targetField = resolveCatalogField(target, getFlowMappingTargetFieldCandidate(mapping))
  if (!targetField?.enumOptions?.length || !sourceText) {
    return null
  }
  const token = normalizeToken(sourceText)
  const matched = targetField.enumOptions.filter(option => (
    normalizeToken(option.label) === token || normalizeToken(option.value) === token
  ))
  return matched.length === 1 ? matched[0] : null
}

const rewriteMappingSource = (input: {
  mapping: UnknownRecord
  context: RewriteContext
  decisions: PlanFieldDecision[]
  target: FlowFieldDecisionSummary
  diagnostics: FlowFieldDecisionPlanRewriteResult['skipped']
  counter: { value: number }
}) => {
  const { mapping, context, decisions, target, diagnostics, counter } = input
  if (Object.prototype.hasOwnProperty.call(mapping, 'value')) {
    return
  }
  const reference = getFlowMappingSourceReferenceInput(mapping)
  const sourceField = reference.sourceFieldInput
    ? resolveCatalogField(target, reference.sourceFieldInput)
    : null
  const valueField = reference.valueFieldInput
    ? resolveCatalogField(target, reference.valueFieldInput)
    : null
  const sourceInvalid = Boolean(reference.sourceFieldInput && !sourceField)
  const valueInvalid = Boolean(reference.valueFieldInput && !valueField)
  const conflict = Boolean(
    sourceField
    && valueField
    && sourceField.fieldId !== valueField.fieldId,
  )
  if (!sourceInvalid && !valueInvalid && !conflict) {
    return
  }
  if (!conflict) {
    // 只有「唯一来源引用且解析失败」才按固定值自愈；另一侧字段有效时说明模型给的是字段取值，保持原样。
    const healSourceInvalid = sourceInvalid && !valueField
    const healValueInvalid = valueInvalid && !sourceField
    const sourceText = healSourceInvalid
      ? getFlowFieldReferenceCandidate(reference.sourceFieldInput)
      : healValueInvalid
        ? getFlowFieldReferenceCandidate(reference.valueFieldInput)
        : ''
    const fixedValue = resolveEnumFixedValue(target, mapping, sourceText)
    if (fixedValue) {
      mapping.value = fixedValue.value
      deleteKeys(mapping, [
        'source',
        'valueFieldUID',
        'valueFieldId',
        'valueFieldName',
        'valueFieldAlias',
      ])
      counter.value += 1
      return
    }
  }
  const picked = pickPlanDecision({ decisions, capability: 'source', context })
  if (!picked.decision) {
    if (picked.ambiguous) {
      diagnostics.push({
        capability: 'source',
        reason: 'scope_ambiguous',
        nodeKey: context.nodeKey,
        branchKey: context.branchKey,
      })
    }
    return
  }
  mapping.source = { fieldUID: picked.decision.field.fieldId }
  deleteKeys(mapping, [
    'valueFieldUID',
    'valueFieldId',
    'valueFieldName',
    'valueFieldAlias',
  ])
  counter.value += 1
}

export const convergeFlowPlanFieldDecisions = (input: {
  plan: NocodeEditorFlowPlan
  scheme?: NocodeEditorFlowScheme | null
  flowSummary?: unknown
}): FlowFieldDecisionPlanRewriteResult => {
  const target = resolveFlowFieldDecisionSummary(input.flowSummary)
  if (!target) {
    return {
      plan: input.plan,
      rewrittenSites: 0,
      skipped: [],
    }
  }
  const decisions = resolvePlanDecisions({ scheme: input.scheme, target })
  // 固定值回写自愈不依赖方案决策，空决策也要继续遍历；各决策改写分支在空决策下本就是 no-op。

  const plan = clonePlan(input.plan)
  const diagnostics: FlowFieldDecisionPlanRewriteResult['skipped'] = []
  const counter = { value: 0 }

  const visitNodes = (
    nodes: NocodeEditorFlowPlan['triggerBranches'][number]['nodes'],
    prefix: RewriteContext,
  ) => {
    nodes.forEach((node) => {
      const context: RewriteContext = {
        nodeKey: normalizeText(node.nodeKey) || undefined,
        branchKey: prefix.branchKey,
      }
      const options = isRecord(node.options) ? node.options : null
      if (options) {
        if (node.type === 'transact' || node.type === 'report-data') {
          const finishCondition = isRecord(options.finishCondition)
            ? options.finishCondition
            : null
          if (finishCondition) {
            rewriteConditionContainers({
              container: finishCondition,
              keys: ['conditions'],
              context,
              decisions,
              target,
              diagnostics,
              counter,
            })
          }
        }
        if (node.type === 'trigger-data-change' || node.type === 'trigger-time-task') {
          rewriteConditionContainers({
            container: options,
            keys: ['conditions'],
            context,
            decisions,
            target,
            diagnostics,
            counter,
          })
        }
        if (node.type === 'condition-branch') {
          // 与 grounding 对齐：condition-branch 节点自身的条件组使用节点上下文，不使用内层分支键。
          (node.branches || []).forEach((branch) => {
            const branchRecord = isRecord(branch) ? branch : null
            if (branchRecord) {
              rewriteConditionContainers({
                container: branchRecord,
                keys: ['conditions'],
                context,
                decisions,
                target,
                diagnostics,
                counter,
              })
            }
          })
        }
        if (node.type === 'add-data' || node.type === 'edit-data' || node.type === 'delete-data') {
          const mappings = [
            ...(Array.isArray(options.mapping) ? options.mapping : []),
            ...(Array.isArray(options.mappings) ? options.mappings : []),
          ]
          mappings.forEach((item) => {
            if (isRecord(item)) {
              rewriteMappingSource({ mapping: item, context, decisions, target, diagnostics, counter })
            }
          })
          const batch = isRecord(options.batch) ? options.batch : null
          if (batch) {
            const batchMappings = [
              ...(Array.isArray(batch.mappings) ? batch.mappings : []),
              ...(Array.isArray(batch.batchMappings) ? batch.batchMappings : []),
            ]
            batchMappings.forEach((item) => {
              if (isRecord(item)) {
                rewriteMappingSource({ mapping: item, context, decisions, target, diagnostics, counter })
              }
            })
          }
        }
      }
      (node.branches || []).forEach((branch) => {
        const branchRecord = isRecord(branch) ? branch : null
        if (!branchRecord) {
          return
        }
        visitNodes(
          Array.isArray(branchRecord.nodes) ? branchRecord.nodes : [],
          {
            branchKey: normalizeText(branchRecord.branchKey).toLowerCase()
              || prefix.branchKey,
          },
        )
      })
    })
  }

  plan.triggerBranches.forEach((branch) => {
    const triggerContext: RewriteContext = {
      nodeKey: normalizeText(branch.triggerNode?.nodeKey) || undefined,
      branchKey: normalizeText(branch.branchKey) || undefined,
    }
    const triggerNode = branch.triggerNode
    // 与 grounding 对齐：只有数据变化、定时任务两类触发节点的条件参与字段校验与改写。
    const triggerType = normalizeText(triggerNode?.type)
    if (
      triggerNode?.options
      && isRecord(triggerNode.options)
      && (triggerType === 'trigger-data-change' || triggerType === 'trigger-time-task')
    ) {
      rewriteConditionContainers({
        container: triggerNode.options,
        keys: ['conditions'],
        context: triggerContext,
        decisions,
        target,
        diagnostics,
        counter,
      })
    }
    visitNodes(branch.nodes || [], {
      branchKey: normalizeText(branch.branchKey) || undefined,
    })
  })

  return {
    plan,
    rewrittenSites: counter.value,
    skipped: diagnostics,
  }
}
