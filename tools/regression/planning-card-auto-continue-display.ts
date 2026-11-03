import assert from 'node:assert/strict'

import { resolvePlanningArtifactDisplayState } from '../../src/renderer/views/nocode/views/editor/ai/planningArtifactDisplay'
import type { NocodeEditorAiArtifactBlock } from '../../src/renderer/views/nocode/views/editor/ai/types'

const CONFIRMED_KEY = 'form-plan:sol-1792548415087-87c6fe:form-1:2:1792548415089'

const createFormPlanBlock = (input: {
  revision: number
  stagedAt: number
  status?: 'pending' | 'completed'
  confirmationKey?: string
  questionConfirmed?: boolean
  questions?: Array<{ id: string; title: string; confirmed?: boolean }>
}): NocodeEditorAiArtifactBlock => {
  const confirmation = {
    stage: 'form-plan',
    status: input.status || 'completed',
    planningContextKey: input.confirmationKey === undefined ? CONFIRMED_KEY : input.confirmationKey,
    questions: input.questions || [{
      id: 'q1',
      title: '学生姓名如何填写？',
      confirmed: input.questionConfirmed !== false,
    }],
  }
  return {
    type: 'artifact',
    kind: 'form-plan',
    status: 'ready',
    revision: input.revision,
    stagedAt: input.stagedAt,
    title: '学生请假申请表规划',
    confirmation,
    outline: {
      id: 'sol-1792548415087-87c6fe',
      summary: '学生请假申请表',
      forms: [{ formKey: 'form-1', tableName: '学生请假申请表' }],
      openQuestions: [],
      confirmation,
    },
  } as unknown as NocodeEditorAiArtifactBlock
}

const confirmedBlock = createFormPlanBlock({
  revision: 2,
  stagedAt: 1792548415089,
})
assert.equal(resolvePlanningArtifactDisplayState({ block: confirmedBlock }).renderAsConfirmation, true)
assert.equal(
  resolvePlanningArtifactDisplayState({ block: confirmedBlock }).hiddenAutoContinuedPlanningCard,
  undefined,
)

const autoContinuedBlock = createFormPlanBlock({
  revision: 3,
  stagedAt: 1792548780054,
  confirmationKey: CONFIRMED_KEY,
})
const autoContinuedState = resolvePlanningArtifactDisplayState({ block: autoContinuedBlock })
assert.equal(autoContinuedState.renderAsConfirmation, false)
assert.equal(autoContinuedState.renderAsGenericArtifact, false)
assert.equal(autoContinuedState.hiddenAutoContinuedPlanningCard, true)

const pendingFollowUpBlock = createFormPlanBlock({
  revision: 5,
  stagedAt: 1792549000000,
  status: 'pending',
  confirmationKey: 'form-plan:sol-1792548415087-87c6fe:form-1:5:1792549000000',
  questionConfirmed: false,
})
assert.equal(
  resolvePlanningArtifactDisplayState({ block: pendingFollowUpBlock }).renderAsConfirmation,
  true,
)
assert.equal(
  resolvePlanningArtifactDisplayState({ block: pendingFollowUpBlock }).hiddenAutoContinuedPlanningCard,
  undefined,
)
assert.equal(
  resolvePlanningArtifactDisplayState({ block: pendingFollowUpBlock }).readonly,
  true,
)

const confirmedWithoutKey = createFormPlanBlock({
  revision: 6,
  stagedAt: 1792549100000,
  confirmationKey: '',
})
assert.equal(
  resolvePlanningArtifactDisplayState({ block: confirmedWithoutKey }).renderAsConfirmation,
  true,
)

// 零题规划卡的显式 completed 不会被状态解析当作完成，自动续跑判断仍要隐藏它。
const autoContinuedQuestionlessBlock = createFormPlanBlock({
  revision: 7,
  stagedAt: 1792549200000,
  questions: [],
})
assert.equal(
  resolvePlanningArtifactDisplayState({ block: autoContinuedQuestionlessBlock }).hiddenAutoContinuedPlanningCard,
  true,
)

const confirmedQuestionlessBlock = createFormPlanBlock({
  revision: 2,
  stagedAt: 1792548415089,
  questions: [],
})
const confirmedQuestionlessState = resolvePlanningArtifactDisplayState({ block: confirmedQuestionlessBlock })
assert.equal(confirmedQuestionlessState.hiddenAutoContinuedPlanningCard, undefined)
assert.equal(confirmedQuestionlessState.renderAsConfirmation, true)

console.log('planning-card-auto-continue-display: ok')
