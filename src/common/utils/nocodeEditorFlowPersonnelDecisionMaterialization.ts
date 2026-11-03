import type { NocodeEditorConfirmationDecision } from './nocodeEditorConfirmationDecisionProjection'
import type { NocodeEditorFlowPersonnelRequirement } from './nocodeEditorFlowPersonnel'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeStep,
} from './nocodeEditorFlowScheme'
import { resolveStructuredPersonnelDecision } from './nocodeEditorFlowDecisionIdentity'

export type FlowPersonnelDecisionMaterializationEntry = {
  decisionKey: string
  stepKey: string
  slot: 'approval_level'
  departmentManager: { mode: 'up' | 'down'; level: number }
}

export type FlowPersonnelDecisionMaterializationSkip = {
  decisionKey: string
  stepKey: string
  reason: 'step_missing' | 'step_not_approval' | 'source_conflict' | 'level_unparsed'
}

export type FlowPersonnelDecisionMaterializationResult = {
  scheme: NocodeEditorFlowScheme
  applied: FlowPersonnelDecisionMaterializationEntry[]
  skipped: FlowPersonnelDecisionMaterializationSkip[]
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const LEVEL_VALUE_PATTERN = /^(up|down)[_\-\s]*(?:level[_\-\s]*)?(\d{1,2})$/iu
const LEVEL_LABEL_PATTERN = /(向上|向下)\s*(\d{1,2})\s*级/u

// 只读 selectedOptionValue / answerSummary：answerDetail 是题目说明，里面常带
// “例如：向上 1 级”，解析它会得到错误层级。
const parseDepartmentManagerLevel = (
  decision: NocodeEditorConfirmationDecision,
): { mode: 'up' | 'down'; level: number } | null => {
  const texts = [decision.selectedOptionValue, decision.answerSummary]
    .map(normalizeText)
    .filter(Boolean)
  for (const text of texts) {
    const valueMatch = LEVEL_VALUE_PATTERN.exec(text.replace(/\s+/g, ''))
    if (valueMatch) {
      const level = Number(valueMatch[2])
      if (Number.isInteger(level) && level >= 1) {
        return { mode: valueMatch[1].toLowerCase() === 'down' ? 'down' : 'up', level }
      }
    }
    const labelMatch = LEVEL_LABEL_PATTERN.exec(text)
    if (labelMatch) {
      const level = Number(labelMatch[2])
      if (Number.isInteger(level) && level >= 1) {
        return { mode: labelMatch[1] === '向下' ? 'down' : 'up', level }
      }
    }
  }
  return null
}

const collectSteps = (scheme: NocodeEditorFlowScheme): NocodeEditorFlowSchemeStep[] => [
  ...(scheme.mainPath || []),
  ...(scheme.branches || []).flatMap(branch => branch.steps || []),
]

// 已确认的人员决策必须落进人员配置：评估链路只认 personnelRequirement，
// 不回写就会重新派生同键依赖，并把已确认题投影回待答状态。
// 本函数目前只处理 approval_level（upN/downN），其它槽位单列后续。
export const materializeFlowPersonnelDecisionAnswers = (input: {
  scheme: NocodeEditorFlowScheme
  decisions?: NocodeEditorConfirmationDecision[] | null
}): FlowPersonnelDecisionMaterializationResult => {
  const decisions = Array.isArray(input.decisions) ? input.decisions : []
  if (!decisions.length) {
    return { scheme: input.scheme, applied: [], skipped: [] }
  }

  const stepsByKey = new Map<string, NocodeEditorFlowSchemeStep>()
  collectSteps(input.scheme).forEach((step) => {
    const key = normalizeText(step.key)
    if (key) stepsByKey.set(key, step)
  })

  const applied: FlowPersonnelDecisionMaterializationEntry[] = []
  const skipped: FlowPersonnelDecisionMaterializationSkip[] = []
  const patched = new Map<string, NocodeEditorFlowPersonnelRequirement>()

  decisions.forEach((decision) => {
    const decisionKey = normalizeText(decision.decisionKey) || normalizeText(decision.questionId)
    const parsed = resolveStructuredPersonnelDecision(decisionKey)
    const stepKey = normalizeText(parsed?.stepKey)
    if (parsed?.slot !== 'approval_level' || !stepKey) {
      return
    }
    const step = stepsByKey.get(stepKey)
    if (!step) {
      skipped.push({ decisionKey, stepKey, reason: 'step_missing' })
      return
    }
    if (step.kind !== 'approval') {
      skipped.push({ decisionKey, stepKey, reason: 'step_not_approval' })
      return
    }
    const existing = patched.get(stepKey) || step.personnelRequirement
    if (
      existing
      && existing.sourceType !== 'unresolved'
      && existing.sourceType !== 'department_manager'
    ) {
      // 用户换过来源：不能拿旧的层级答案覆盖新来源，交给后续来源题重新确认。
      skipped.push({ decisionKey, stepKey, reason: 'source_conflict' })
      return
    }
    const departmentManager = parseDepartmentManagerLevel(decision)
    if (!departmentManager) {
      skipped.push({ decisionKey, stepKey, reason: 'level_unparsed' })
      return
    }
    patched.set(stepKey, {
      ...(existing && existing.sourceType !== 'unresolved' ? existing : {}),
      sourceType: 'department_manager',
      departmentManager,
    })
    applied.push({ decisionKey, stepKey, slot: 'approval_level', departmentManager })
  })

  if (!patched.size) {
    return { scheme: input.scheme, applied, skipped }
  }
  const mapSteps = (steps?: NocodeEditorFlowSchemeStep[]) => (steps || []).map((step) => {
    const key = normalizeText(step.key)
    const next = key ? patched.get(key) : undefined
    return next ? { ...step, personnelRequirement: next } : step
  })
  return {
    scheme: {
      ...input.scheme,
      mainPath: mapSteps(input.scheme.mainPath),
      branches: (input.scheme.branches || []).map(branch => ({
        ...branch,
        steps: mapSteps(branch.steps),
      })),
    },
    applied,
    skipped,
  }
}
