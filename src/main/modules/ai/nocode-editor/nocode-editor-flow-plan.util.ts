import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmSurface,
} from '@common/types/nocodeEditorConfirmation'
import type {
  NocodeEditorFlowPlan,
  NocodeEditorFlowPlanNode,
  NocodeEditorFlowPlanTriggerBranch,
} from '@common/utils/nocodeEditorFlowPlan'
import {
  NOCODE_EDITOR_FLOW_PLAN_NODE_CATEGORY_MAP,
  NOCODE_EDITOR_FLOW_PLAN_NODE_LABEL_MAP,
  resolveNocodeEditorFlowPlanPendingConfirmationQuestionTitles,
} from '@common/utils/nocodeEditorFlowPlan'

import { buildNocodeEditorConfirmationPayload } from './nocode-editor-confirmation.util'

type NocodeEditorFlowPlanConfirmationInput = Omit<NocodeEditorFlowPlan, 'confirmation'> & {
  confirmation?: unknown
  ignoreOpenQuestionsFallback?: boolean
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const formatNodeLine = (
  node: NocodeEditorFlowPlanNode,
  level: number,
): string[] => {
  const indent = '  '.repeat(level)
  const nodeTypeLabel = NOCODE_EDITOR_FLOW_PLAN_NODE_LABEL_MAP[node.type] || node.type
  const categoryLabel = NOCODE_EDITOR_FLOW_PLAN_NODE_CATEGORY_MAP[node.type]
  const title = normalizeText(node.name) || nodeTypeLabel
  const lines = [`${indent}${level === 0 ? '-' : '*'} ${title}（${nodeTypeLabel} / ${categoryLabel}）`]

  if (Array.isArray(node.branches) && node.branches.length) {
    node.branches.forEach((branch, index) => {
      const branchLabel = normalizeText(branch.label) || `分支 ${index + 1}`
      const conditionCount = Array.isArray(branch.conditions) ? branch.conditions.length : 0
      lines.push(`${indent}  - ${branchLabel}${node.type === 'condition-branch' ? `（${conditionCount} 组条件）` : ''}`)
      branch.nodes.forEach(child => {
        lines.push(...formatNodeLine(child, level + 2))
      })
    })
  }

  return lines
}

export const buildNocodeEditorFlowPlanConfirmation = (
  plan: NocodeEditorFlowPlanConfirmationInput | null | undefined,
  preferredSurface?: NocodeEditorAiConfirmSurface,
): NocodeEditorAiConfirmPayload | null => {
  if (!plan) {
    return null
  }

  return buildNocodeEditorConfirmationPayload({
    stage: 'flow-plan',
    confirmation: plan.confirmation,
    openQuestions: plan.ignoreOpenQuestionsFallback ? [] : plan.openQuestions,
    preferredSurface,
    summary: plan.summary,
  })
}
