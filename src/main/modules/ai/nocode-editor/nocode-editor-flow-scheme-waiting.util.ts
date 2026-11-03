import type { AiActionResult } from '../ai.types'
import {
  isFlowSchemePrerequisiteMissingIssue,
  normalizeUnifiedFlowIssues,
} from '@common/utils/nocodeEditorFlowUnifiedIssue'
import { normalizeFlowIssueRoutingResult } from '@common/utils/nocodeEditorFlowIssueRouter'
import { normalizeNocodeEditorFlowScheme } from '@common/utils/nocodeEditorFlowScheme'

const isRecord = (value: unknown): value is Record<string, any> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

export const hasPendingFlowSchemeConvergence = (
  scheme?: ReturnType<typeof normalizeNocodeEditorFlowScheme> | null,
) => (
  scheme?.convergence?.businessStatus === 'pending'
  || scheme?.convergence?.dependencyStatus === 'pending'
)

export const resolveFlowIssueRoutingFromResult = (result: AiActionResult) => {
  const output = isRecord(result.output) ? result.output : null
  return normalizeFlowIssueRoutingResult(result.metadata?.flowIssueRouting)
    || normalizeFlowIssueRoutingResult(output?.flowIssueRouting)
}

export const resolveFlowIssuesFromResult = (result: AiActionResult) => {
  const output = isRecord(result.output) ? result.output : null
  return normalizeUnifiedFlowIssues(
    Array.isArray(result.metadata?.flowUnifiedIssues)
      ? result.metadata.flowUnifiedIssues
      : output?.flowUnifiedIssues,
  )
}

// 前置缺失是“宿主缺少暂存方案”，不是“等待用户确认方案”，不能被等待守卫收口。
export const isFlowSchemePrerequisiteMissingResult = (result: AiActionResult) => {
  const issues = resolveFlowIssuesFromResult(result)
  return issues.length > 0 && issues.every(isFlowSchemePrerequisiteMissingIssue)
}

// 只需判断是否存在等待确认的 flow-scheme 结果，如果是则返回该轮结果，否则返回 null
export const getLatestFlowSchemeWaitingResult = (results: AiActionResult[]) => {
  for (let index = results.length - 1; index >= 0; index -= 1) {
    const result = results[index]
    const routing = resolveFlowIssueRoutingFromResult(result)
    if (routing) {
      if (routing.outcome === 'return_to_flow_scheme') {
        if (isFlowSchemePrerequisiteMissingResult(result)) {
          return null
        }
        return result
      }
      if (
        routing.outcome === 'execution_blocker'
        || routing.outcome === 'system_error'
        || routing.outcome === 'auto_continue'
      ) {
        return null
      }
    }

    const toolName = normalizeText(result?.name)
    if (!result?.ok || toolName !== 'editor_plan_flow_scheme') {
      continue
    }

    const scheme = normalizeNocodeEditorFlowScheme(
      isRecord(result.output) ? result.output.scheme : null,
    )
    const confirmationQuestions = Array.isArray(scheme?.confirmation?.questions)
      ? scheme.confirmation.questions.filter(Boolean)
      : []
    const openQuestions = Array.isArray(scheme?.openQuestions)
      ? scheme.openQuestions.filter(Boolean)
      : []
    const planningStatus = normalizeText(isRecord(result.output) ? result.output.planningStatus : '')

    if (
      hasPendingFlowSchemeConvergence(scheme)
      || planningStatus === 'needs_confirmation'
      || openQuestions.length > 0
      || confirmationQuestions.some(question => !question.confirmed)
    ) {
      return result
    }

    return null
  }

  return null
}
