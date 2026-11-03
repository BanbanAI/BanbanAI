const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const text = (value: unknown) => String(value ?? '').trim()

const normalizeToken = (value: unknown) => text(value)
  .toLocaleLowerCase()
  .replace(/[\s\-_/\\，。；、：:（）()]+/g, '')

// 提交动作通常以这些动词开头；“提交人/提交者”是角色名，不是提交动作。
const SUBMISSION_ACTION_TITLE_PATTERN = /^(提交|发起|申报|上报|新增|录入|填写)(?!人|者)/

export type FlowSchemeSubmissionStepDiagnostic = {
  code: 'submission_action_as_approval_step'
  message: string
  stepKey: string
  stepTitle: string
  sourceType: string
}

const collectSchemeSteps = (scheme: Record<string, unknown>) => {
  const mainPath = Array.isArray(scheme.mainPath) ? scheme.mainPath : []
  const branchSteps = Array.isArray(scheme.branches)
    ? scheme.branches.flatMap(branch => (
      isRecord(branch) && Array.isArray(branch.steps) ? branch.steps : []
    ))
    : []
  return [...mainPath, ...branchSteps].filter(isRecord)
}

/**
 * 提交动作由 scheme.trigger 和触发节点表达，不能再作为审批步骤出现。
 * 只拦截“审批步骤 + 审批人是提交人本人”这种确定错误，保留用户明确要求的本人确认场景。
 */
export const validateFlowSchemeSubmissionSteps = (
  value: unknown,
): FlowSchemeSubmissionStepDiagnostic[] => {
  const scheme = isRecord(value) && isRecord(value.scheme) ? value.scheme : value
  if (!isRecord(scheme)) {
    return []
  }
  const trigger = isRecord(scheme.trigger) ? scheme.trigger : null
  const triggerType = text(trigger?.type)
  const triggerDescription = normalizeToken(trigger?.description)

  return collectSchemeSteps(scheme).flatMap((step) => {
    if (text(step.kind) !== 'approval') {
      return []
    }
    const personnelRequirement = isRecord(step.personnelRequirement) ? step.personnelRequirement : null
    if (text(personnelRequirement?.sourceType) !== 'submitter') {
      return []
    }
    const stepTitle = text(step.title)
    const normalizedTitle = normalizeToken(stepTitle)
    if (!normalizedTitle) {
      return []
    }
    const duplicatesTrigger = Boolean(
      triggerDescription
      && (triggerDescription.includes(normalizedTitle) || normalizedTitle.includes(triggerDescription)),
    )
    const startsWithSubmission = triggerType === 'submit' && SUBMISSION_ACTION_TITLE_PATTERN.test(stepTitle)
    if (!duplicatesTrigger && !startsWithSubmission) {
      return []
    }
    return [{
      code: 'submission_action_as_approval_step',
      message: `「${stepTitle}」是提交动作，已由触发节点表达，不能作为审批步骤，审批人也不会是提交人本人。请删除该步骤；如确需本人确认，请改写为用户明确要求的本人确认节点。`,
      stepKey: text(step.key),
      stepTitle,
      sourceType: 'submitter',
    }]
  })
}
