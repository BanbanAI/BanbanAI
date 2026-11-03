import assert from 'node:assert/strict'

import i18next from 'i18next'

import {
  buildFlowSchemeDisplayVersionIndex,
  resolveFlowSchemeDisplayVersionLabel,
  rewriteArtifactSummaryDisplayVersionText,
} from '../../src/renderer/views/nocode/views/editor/ai/planningDisplayVersion'
import { resolvePlanningArtifactDisplayState } from '../../src/renderer/views/nocode/views/editor/ai/planningArtifactDisplay'
import type { NocodeEditorAiArtifactBlock } from '../../src/renderer/views/nocode/views/editor/ai/types'

i18next.init({
  lng: 'zh-CN',
  initImmediate: false,
  resources: {
    'zh-CN': {
      translation: {
        nocodeEditorVersionLabel: {
          version: '第 {{version}} 版',
        },
      },
    },
  },
})

// 复现数据：合同管理表流程的方案族键（见 docs/flow-scheme-history-card-and-version-plan.md 附录）。
const CONTRACT_CONTEXT_KEY = 'logical:flow-scheme:spbhlsjuiflv:t_iwd1npj37l6h'
const REIMBURSEMENT_CONTEXT_KEY = 'logical:flow-scheme:spbhlsjuiflv:t_reimburse01'

const createFlowSchemeBlock = (input: {
  revision: number
  stagedAt: number
  planningContextKey?: string
  formId?: string
  formName?: string
  schemeId?: string
  withSchemeIdentity?: boolean
  confirmed?: boolean
  confirmationStatus?: 'pending' | 'completed'
  planningStatus?: 'needs_confirmation' | 'ready_for_review'
  title?: string
}): NocodeEditorAiArtifactBlock => {
  const title = input.title || '合同管理表流程'
  const confirmation = {
    stage: 'flow-scheme',
    status: input.confirmationStatus || 'pending',
    planningContextKey: input.planningContextKey === undefined
      ? CONTRACT_CONTEXT_KEY
      : input.planningContextKey,
    schemeRevision: input.revision,
    questions: [{
      id: 'q1',
      title: '审批人是谁？',
      confirmed: input.confirmed === true,
    }],
  }
  const scheme = input.withSchemeIdentity === false
    ? {
      title,
      summary: title,
      trigger: { type: 'unknown', description: '需要确认' },
      mainPath: [],
      branches: [],
      confirmedFacts: [],
      assumptions: [],
      openQuestions: [],
    }
    : {
      id: input.schemeId || 'spbhlsjuiflv',
      title,
      summary: title,
      target: {
        formId: input.formId || 't_iwd1npj37l6h',
        formName: input.formName || '合同管理表',
      },
      trigger: { type: 'unknown', description: '需要确认' },
      mainPath: [],
      branches: [],
      confirmedFacts: [],
      assumptions: [],
      openQuestions: [],
    }

  return {
    type: 'artifact',
    kind: 'flow-scheme',
    status: 'ready',
    revision: input.revision,
    stagedAt: input.stagedAt,
    title,
    planningStatus: input.planningStatus || 'needs_confirmation',
    scheme,
    confirmation,
  } as unknown as NocodeEditorAiArtifactBlock
}

// 1. 同一方案族的三次暂存（revision 7/8/9）按族内顺序显示为第 1/2/3 版。
const contractRev7 = createFlowSchemeBlock({ revision: 7, stagedAt: 1793258764147 })
const contractRev8 = createFlowSchemeBlock({ revision: 8, stagedAt: 1793259200000 })
const contractRev9 = createFlowSchemeBlock({ revision: 9, stagedAt: 1793259400000 })

const contractIndex = buildFlowSchemeDisplayVersionIndex({
  messages: [],
  artifactBlocks: [contractRev7, contractRev8, contractRev9],
})
assert.equal(resolveFlowSchemeDisplayVersionLabel(contractRev7, contractIndex), '第 1 版')
assert.equal(resolveFlowSchemeDisplayVersionLabel(contractRev8, contractIndex), '第 2 版')
assert.equal(resolveFlowSchemeDisplayVersionLabel(contractRev9, contractIndex), '第 3 版')

// 2. 不同目标表单属于不同方案族，各自从第 1 版计数。
const reimbursementRev1 = createFlowSchemeBlock({
  revision: 1,
  stagedAt: 1793258000000,
  planningContextKey: REIMBURSEMENT_CONTEXT_KEY,
  formId: 't_reimburse01',
  formName: '报销申请表',
  schemeId: 'spbhlsjuiflv-reimburse',
  title: '报销申请表流程',
})
const crossFamilyIndex = buildFlowSchemeDisplayVersionIndex({
  messages: [],
  artifactBlocks: [contractRev7, contractRev8, reimbursementRev1, contractRev9],
})
assert.equal(resolveFlowSchemeDisplayVersionLabel(contractRev8, crossFamilyIndex), '第 2 版')
assert.equal(resolveFlowSchemeDisplayVersionLabel(reimbursementRev1, crossFamilyIndex), '第 1 版')

// 3. 输入顺序与时间顺序不一致时，仍按 stagedAt/revision 编号。
const outOfOrderIndex = buildFlowSchemeDisplayVersionIndex({
  messages: [],
  artifactBlocks: [contractRev9, contractRev7, contractRev8],
})
assert.equal(resolveFlowSchemeDisplayVersionLabel(contractRev7, outOfOrderIndex), '第 1 版')
assert.equal(resolveFlowSchemeDisplayVersionLabel(contractRev8, outOfOrderIndex), '第 2 版')
assert.equal(resolveFlowSchemeDisplayVersionLabel(contractRev9, outOfOrderIndex), '第 3 版')

// 4. 缺少目标表单身份（无 context key、无 target、无 scheme.id）时无族键，标签回退为空。
const anonymousBlock = createFlowSchemeBlock({
  revision: 9,
  stagedAt: 1793259400000,
  planningContextKey: '',
  withSchemeIdentity: false,
})
const anonymousIndex = buildFlowSchemeDisplayVersionIndex({
  messages: [],
  artifactBlocks: [contractRev9, anonymousBlock],
})
assert.equal(resolveFlowSchemeDisplayVersionLabel(anonymousBlock, anonymousIndex), '')
assert.equal(resolveFlowSchemeDisplayVersionLabel(anonymousBlock, null), '')

// 5. 被更新版本取代的待确认卡保留卡片形态，只读展示。
const expiredPendingState = resolvePlanningArtifactDisplayState({
  block: contractRev7,
  flowSchemeCardExpired: true,
})
assert.equal(expiredPendingState.renderAsConfirmation, true)
assert.equal(expiredPendingState.renderAsGenericArtifact, false)
assert.equal(expiredPendingState.readonly, true)

const currentPendingState = resolvePlanningArtifactDisplayState({ block: contractRev9 })
assert.equal(currentPendingState.renderAsConfirmation, true)
assert.equal(currentPendingState.readonly, false)

// 6. 已完成卡不被过期分支截胡：仍走原有通用记录卡路径。
const completedBlock = createFlowSchemeBlock({
  revision: 8,
  stagedAt: 1793259200000,
  confirmed: true,
  confirmationStatus: 'completed',
})
const completedExpiredState = resolvePlanningArtifactDisplayState({
  block: completedBlock,
  flowSchemeCardExpired: true,
})
assert.equal(completedExpiredState.renderAsConfirmation, false)
assert.equal(completedExpiredState.renderAsGenericArtifact, true)
assert.equal(completedExpiredState.readonly, false)

// 7. 正文「当前为第 N 版」按族内编号改写；同一批候选里有更新版本时仍锚定原文的 revision。
const rewrittenRev8Text = rewriteArtifactSummaryDisplayVersionText(
  '已暂存「合同管理表流程」, 当前为第 8 版, 还有 3 个待确认问题。',
  [contractRev8],
  null,
  null,
  crossFamilyIndex,
)
assert.equal(rewrittenRev8Text, '已暂存「合同管理表流程」, 当前为第 2 版, 还有 3 个待确认问题。')

const rewrittenRev7Text = rewriteArtifactSummaryDisplayVersionText(
  '已暂存「合同管理表流程」, 当前为第 7 版, 还有 4 个待确认问题。',
  [contractRev7, contractRev8, contractRev9],
  null,
  null,
  crossFamilyIndex,
)
assert.equal(rewrittenRev7Text, '已暂存「合同管理表流程」, 当前为第 1 版, 还有 4 个待确认问题。')

console.log('flow-scheme-display-version: ok')
