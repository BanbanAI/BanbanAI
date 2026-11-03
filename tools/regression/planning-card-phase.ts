import assert from 'node:assert/strict'

import { resolvePlanningCardPhase } from '../../src/renderer/views/nocode/views/editor/ai/planningCardPhase'
import type { NocodeEditorAiArtifactBlock } from '../../src/renderer/views/nocode/views/editor/ai/types'

const createFormPlanBlock = (input: {
  status: 'pending' | 'completed'
  questionConfirmed: boolean
}): NocodeEditorAiArtifactBlock => {
  const confirmation = {
    stage: 'form-plan',
    status: input.status,
    planningContextKey: 'form-plan:context',
    questions: [{
      id: 'q1',
      title: '学生姓名如何填写？',
      confirmed: input.questionConfirmed,
    }],
  }
  return {
    type: 'artifact',
    kind: 'form-plan',
    status: 'ready',
    revision: 2,
    stagedAt: 1792548415089,
    title: '学生请假申请表规划',
    confirmation,
    outline: {
      id: 'sol-1',
      summary: '学生请假申请表',
      forms: [{ formKey: 'form-1', tableName: '学生请假申请表' }],
      openQuestions: [],
      confirmation,
    },
  } as unknown as NocodeEditorAiArtifactBlock
}

const completedBlock = createFormPlanBlock({ status: 'completed', questionConfirmed: true })
const pendingBlock = createFormPlanBlock({ status: 'pending', questionConfirmed: false })

// 蓝图加载中：已确认的方案卡要留在加载态，避免先闪成“已完成”。
assert.equal(
  resolvePlanningCardPhase({
    block: completedBlock,
    matchedBlueprintSignal: { state: 'loading' },
  }),
  'next-stage-loading',
)

// 蓝图失败仍是错误态，不被加载分支覆盖。
assert.equal(
  resolvePlanningCardPhase({
    block: completedBlock,
    matchedBlueprintSignal: { state: 'error' },
  }),
  'error',
)

// 没有下一阶段信号时保持原有完成/待答判定。
assert.equal(
  resolvePlanningCardPhase({ block: completedBlock, matchedBlueprintSignal: { state: '' } }),
  'completed',
)
assert.equal(
  resolvePlanningCardPhase({ block: pendingBlock, matchedBlueprintSignal: { state: '' } }),
  'pending',
)

// 未确认完的方案卡即使下一阶段在加载，也不能显示“已完成并续跑”。
assert.equal(
  resolvePlanningCardPhase({
    block: pendingBlock,
    matchedBlueprintSignal: { state: 'loading' },
  }),
  'pending',
)

console.log('planning-card-phase: ok')
