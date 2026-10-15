import type { UnifiedFlowIssue } from './nocodeEditorFlowUnifiedIssue'
import type {
  NocodeEditorFlowScheme,
  NocodeEditorFlowSchemeStep,
} from './nocodeEditorFlowScheme'
import { isSameFlowPersonnelSourceType } from './nocodeEditorFlowPersonnel'

export type NocodeEditorFlowSchemeAmbiguousPersonnelStep = {
  stepTitle: string
  mainPathStepKey: string
  branchStepKeys: string[]
  branchKeys: string[]
  branchTitles: string[]
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => normalizeText(value)
  .toLocaleLowerCase()
  .replace(/[\s\-_/\\]+/g, '')

const isPersonnelStep = (step: NocodeEditorFlowSchemeStep) => Boolean(step.personnelRequirement)

const isSamePersonnelStepSignature = (
  left: NocodeEditorFlowSchemeStep,
  right: NocodeEditorFlowSchemeStep,
) => {
  const leftSourceType = left.personnelRequirement?.sourceType
  const rightSourceType = right.personnelRequirement?.sourceType
  const leftTitle = normalizeToken(left.title)
  const rightTitle = normalizeToken(right.title)
  return Boolean(
    leftSourceType
    && rightSourceType
    && leftTitle
    && leftTitle === rightTitle
    && left.kind === right.kind
    && isSameFlowPersonnelSourceType(leftSourceType, rightSourceType),
  )
}

// 主链里位于条件分流之后的人员步骤，如果在分支里又声明了一份同样的步骤，
// 蓝图无法唯一表达这次审批，必须先在方案侧收敛成一种写法。
export const findNocodeEditorFlowSchemeAmbiguousPersonnelSteps = (
  scheme?: NocodeEditorFlowScheme | null,
): NocodeEditorFlowSchemeAmbiguousPersonnelStep[] => {
  const mainPath = Array.isArray(scheme?.mainPath) ? scheme!.mainPath : []
  const branches = Array.isArray(scheme?.branches) ? scheme!.branches : []
  if (!mainPath.length || !branches.length) {
    return []
  }

  const firstConditionIndex = mainPath.findIndex(step => step.kind === 'condition-branch')
  if (firstConditionIndex < 0) {
    return []
  }
  const conditionalMainPathSteps = mainPath.slice(firstConditionIndex + 1).filter(isPersonnelStep)
  if (!conditionalMainPathSteps.length) {
    return []
  }

  const ambiguousSteps = new Map<string, NocodeEditorFlowSchemeAmbiguousPersonnelStep>()
  branches.forEach((branch) => {
    (branch.steps || []).filter(isPersonnelStep).forEach((step) => {
      const matchedMainPathStep = conditionalMainPathSteps.find(mainPathStep => (
        isSamePersonnelStepSignature(mainPathStep, step)
      ))
      if (!matchedMainPathStep) {
        return
      }
      const identity = normalizeText(matchedMainPathStep.key)
        || normalizeText(matchedMainPathStep.title)
      if (!identity) {
        return
      }
      const existing = ambiguousSteps.get(identity) || {
        stepTitle: normalizeText(step.title),
        mainPathStepKey: normalizeText(matchedMainPathStep.key),
        branchStepKeys: [],
        branchKeys: [],
        branchTitles: [],
      }
      const branchStepKey = normalizeText(step.key)
      if (branchStepKey && !existing.branchStepKeys.includes(branchStepKey)) {
        existing.branchStepKeys.push(branchStepKey)
      }
      const branchKey = normalizeText(branch.key)
      if (branchKey && !existing.branchKeys.includes(branchKey)) {
        existing.branchKeys.push(branchKey)
      }
      const branchTitle = normalizeText(branch.title)
      if (branchTitle && !existing.branchTitles.includes(branchTitle)) {
        existing.branchTitles.push(branchTitle)
      }
      ambiguousSteps.set(identity, existing)
    })
  })

  return [...ambiguousSteps.values()]
}

export const buildUnifiedFlowIssuesFromFlowSchemeStructure = (input: {
  scheme?: NocodeEditorFlowScheme | null
  planningContextKey?: string
}): UnifiedFlowIssue[] => {
  const ambiguousSteps = findNocodeEditorFlowSchemeAmbiguousPersonnelSteps(input.scheme)
  if (!ambiguousSteps.length) {
    return []
  }

  return [{
    issueId: 'flow-scheme-ambiguous-personnel-step',
    sourceStage: 'flow-scheme',
    category: 'system_error',
    severity: 'blocking',
    userActionRequired: false,
    planningContextKey: normalizeText(input.planningContextKey) || undefined,
    returnToStage: null,
    blockedNextAction: 'editor_stage_flow_blueprint',
    userMessage: '流程方案里的人员步骤同时出现在主链和分支里，蓝图无法唯一表达，请先修改流程方案再继续生成流程。',
    questionPayload: null,
    diagnostics: ambiguousSteps.map(step => ({
      code: 'flow_scheme_ambiguous_personnel_step',
      message: `「${step.stepTitle || step.mainPathStepKey}」同时声明在主链步骤 ${step.mainPathStepKey} 与分支 ${step.branchKeys.join('、')}`,
      mainPathStepKey: step.mainPathStepKey,
      branchStepKeys: step.branchStepKeys,
      branchKeys: step.branchKeys,
      branchTitles: step.branchTitles,
      expectedNextAction: 'editor_plan_flow_scheme',
    })),
  }]
}
