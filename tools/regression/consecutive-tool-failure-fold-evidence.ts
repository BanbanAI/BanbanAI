import assert from 'node:assert/strict'

import { AiMessageRole } from '../../src/main/modules/ai/ai.types'
import { projectNocodeEditorProviderMessagesForContext } from '../../src/main/modules/ai/nocode-editor/nocode-editor-provider-context-projection.util'

const FAILURE = '规划至少需要包含一个表单'

const buildFailedPlanExchange = (round: number) => {
  const callId = `call_${round}`
  return [
    {
      role: AiMessageRole.ASSISTANT,
      content: '',
      metadata: {
        round,
        modelToolExchangeCall: {
          id: callId,
          name: 'editor_stage_single_form_plan',
          input: {
            outline: { title: '报销单' },
            forms: [{ tableName: '报销单' }],
          },
        },
      },
    },
    {
      role: AiMessageRole.TOOL,
      content: JSON.stringify({ ok: false, error: FAILURE }),
      toolCallId: callId,
      metadata: {
        round,
        modelToolExchangeResult: {
          callId,
          name: 'editor_stage_single_form_plan',
          ok: false,
          error: FAILURE,
        },
      },
    },
  ]
}

const userMessage = {
  role: AiMessageRole.USER,
  content: '创建一个报销单，需要有审批流程',
}

const projected = projectNocodeEditorProviderMessagesForContext([
  userMessage,
  ...buildFailedPlanExchange(2),
  ...buildFailedPlanExchange(3),
  ...buildFailedPlanExchange(4),
] as any)

assert.equal(projected.compacted, true)
assert.equal(projected.projections.length, 1)
assert.equal(projected.projections[0].strategy, 'nocode-editor-consecutive-tool-failure-fold')
assert.equal(projected.projections[0].changedMessages, 5)

// 连续 3 次同因失败只保留最后一条，前两次调用与结果都被折叠。
assert.equal(
  projected.messages.some(message => message.metadata?.modelToolExchangeCall?.id === 'call_2'),
  false,
)
assert.equal(
  projected.messages.some(message => message.metadata?.modelToolExchangeCall?.id === 'call_3'),
  false,
)
assert.equal(
  projected.messages.some(message => message.metadata?.modelToolExchangeCall?.id === 'call_4'),
  true,
)

const keptResult = projected.messages.find(
  message => message.metadata?.modelToolExchangeResult?.callId === 'call_4',
)
assert.ok(keptResult)
const keptPayload = JSON.parse(keptResult.content)
assert.equal(keptPayload.error, FAILURE)
assert.equal(keptPayload.repeatedFailure.count, 3)
assert.equal(keptPayload.repeatedFailure.firstRound, 2)
assert.equal(keptPayload.repeatedFailure.lastRound, 4)

// 首条失败的入参形状必须保留，模型据此判断 forms 被写到了包装外。
assert.equal(keptPayload.repeatedFailure.firstFailure.round, 2)
assert.deepEqual(keptPayload.repeatedFailure.firstFailure.inputKeys, ['outline', 'forms'])
assert.ok(keptPayload.repeatedFailure.firstFailure.inputPreview.includes('"forms"'))

// 只有一次失败时不折叠，结果里不出现 repeatedFailure。
const singleFailureMessages = [userMessage, ...buildFailedPlanExchange(2)] as any
const singleProjected = projectNocodeEditorProviderMessagesForContext(singleFailureMessages)
assert.equal(singleProjected.compacted, false)
const singleResult = singleProjected.messages.find(
  message => message.metadata?.modelToolExchangeResult?.callId === 'call_2',
)
assert.ok(singleResult)
assert.equal(JSON.parse(singleResult.content).repeatedFailure, undefined)

console.log('consecutive-tool-failure-fold-evidence: ok')
