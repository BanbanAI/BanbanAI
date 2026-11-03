import assert from 'node:assert/strict'

import {
  resolveFlowSchemeArtifactSyncDecision,
} from '../../src/renderer/views/nocode/views/editor/ai/flowSchemeArtifactState'
import type { FlowSchemeArtifactLike } from '../../src/renderer/views/nocode/views/editor/ai/flowSchemeArtifactState'

const FORM_KEY = 't_d7mqxt3724d7'
const FORM_NAME = '报销单'
const SCHEME_TITLE = `${FORM_NAME}按报销金额分流审批流程`
const CONTEXT_KEY = `logical:flow-scheme:83dk685hxbtw:${FORM_KEY}`
const T_OLD = 1793622000000
const T_STAGED = 1793622687778

// 真实数据：方案 rev1 的旧待答卡带 stagedAt；蓝图阶段失败后生成的收口恢复卡只带 revision，
// 不带 stagedAt。按 stagedAt 优先比会把恢复卡当成最旧的一张，它自己反而被判过期只读。
const pendingSchemeCard = (input: {
  revision: number
  stagedAt?: number
}) => ({
  kind: 'flow-scheme',
  status: 'ready',
  title: SCHEME_TITLE,
  revision: input.revision,
  ...(input.stagedAt ? { stagedAt: input.stagedAt } : {}),
  scheme: {
    title: SCHEME_TITLE,
    target: { formId: FORM_KEY, formName: FORM_NAME },
  },
  confirmation: {
    status: 'pending',
    planningContextKey: CONTEXT_KEY,
    questions: [{
      id: 'flow-grounding-source-field-missing:tb_amount',
      title: `AI 规划引用的条件字段已不存在`,
      decisionTarget: { formKey: FORM_KEY, formName: FORM_NAME },
    }],
  },
}) as FlowSchemeArtifactLike

const syncReason = (
  block: FlowSchemeArtifactLike,
  blocks: FlowSchemeArtifactLike[],
) => resolveFlowSchemeArtifactSyncDecision({ block, blocks }).reason

// 1) 恢复卡缺 stagedAt 时按 revision 排：rev2 的恢复卡是当前卡，rev1 的旧卡退休
const oldCard = pendingSchemeCard({ revision: 1, stagedAt: T_OLD })
const groundingCardWithoutStagedAt = pendingSchemeCard({ revision: 2 })
assert.equal(syncReason(groundingCardWithoutStagedAt, [oldCard, groundingCardWithoutStagedAt]), 'current_flow_scheme_artifact')
assert.equal(syncReason(oldCard, [oldCard, groundingCardWithoutStagedAt]), 'stale_flow_scheme_artifact')

// 2) 带上 stagedAt 的恢复卡同样可用，且旧卡照样退休
const groundingCardWithStagedAt = pendingSchemeCard({ revision: 3, stagedAt: T_STAGED })
assert.equal(syncReason(groundingCardWithStagedAt, [oldCard, groundingCardWithStagedAt]), 'current_flow_scheme_artifact')
assert.equal(syncReason(oldCard, [oldCard, groundingCardWithStagedAt]), 'stale_flow_scheme_artifact')

// 3) 两张都缺 stagedAt 时也按 revision 排
const noStagedAtOld = pendingSchemeCard({ revision: 1 })
const noStagedAtNew = pendingSchemeCard({ revision: 2 })
assert.equal(syncReason(noStagedAtNew, [noStagedAtOld, noStagedAtNew]), 'current_flow_scheme_artifact')
assert.equal(syncReason(noStagedAtOld, [noStagedAtOld, noStagedAtNew]), 'stale_flow_scheme_artifact')

// 4) 两张都带 stagedAt 时保留原判定：stagedAt 大的是新卡
const stagedOlder = pendingSchemeCard({ revision: 5, stagedAt: T_OLD })
const stagedNewer = pendingSchemeCard({ revision: 5, stagedAt: T_OLD + 9999 })
assert.equal(syncReason(stagedNewer, [stagedOlder, stagedNewer]), 'current_flow_scheme_artifact')
assert.equal(syncReason(stagedOlder, [stagedOlder, stagedNewer]), 'stale_flow_scheme_artifact')

// 5) revision 相同、只有一张带 stagedAt 时，带时间戳的算新卡，不会退化成并列
const sameRevisionNoStagedAt = pendingSchemeCard({ revision: 2 })
const sameRevisionStaged = pendingSchemeCard({ revision: 2, stagedAt: T_STAGED })
assert.equal(syncReason(sameRevisionStaged, [sameRevisionNoStagedAt, sameRevisionStaged]), 'current_flow_scheme_artifact')
assert.equal(syncReason(sameRevisionNoStagedAt, [sameRevisionNoStagedAt, sameRevisionStaged]), 'stale_flow_scheme_artifact')

// 6) 版本号完全相同时仍是后出现的卡胜出，不因新判定改变并列口径
const tiedFirst = pendingSchemeCard({ revision: 2 })
const tiedSecond = pendingSchemeCard({ revision: 2 })
assert.equal(syncReason(tiedSecond, [tiedFirst, tiedSecond]), 'current_flow_scheme_artifact')
assert.equal(syncReason(tiedFirst, [tiedFirst, tiedSecond]), 'stale_flow_scheme_artifact')

console.log('flow-scheme-stale-grounding-card: ok')
