import assert from 'node:assert/strict'

import {
  isNocodeEditorFlowSchemeReviewResultText,
  isPureNocodeEditorFlowSchemeReviewResultText,
  parseNocodeEditorFlowSchemeReviewResultText,
} from '../../src/common/utils/nocodeEditorFlowScheme'
import { normalizeNocodeEditorAiMessageHistory } from '../../src/common/utils/nocodeEditorAiMessageHistory'
import { buildNocodeEditorToolLoopFinalAssistantText } from '../../src/main/modules/ai/nocode-editor/nocode-editor-loop-fallback'

;(global as Record<string, unknown>).i18next = {
  t: (key: string) => key,
}

const passedReviewText = `\`\`\`json
{
  "failed": false,
  "failureReasons": [],
  "summary": "方案已通过复核。主链路包含财务审批节点。",
  "questions": []
}
\`\`\``

const failedReviewText = '{"failed": true, "failureReasons": ["main_path_missing"], "summary": "主链路缺失", "questions": []}'

// 1. 复核协议体识别：带 markdown 代码块、裸 JSON 都算内部协议；普通正文不算。
assert.equal(isNocodeEditorFlowSchemeReviewResultText(passedReviewText), true)
assert.equal(isNocodeEditorFlowSchemeReviewResultText(failedReviewText), true)
assert.equal(parseNocodeEditorFlowSchemeReviewResultText(passedReviewText)?.failed, false)
assert.equal(parseNocodeEditorFlowSchemeReviewResultText(failedReviewText)?.failed, true)
assert.equal(
  parseNocodeEditorFlowSchemeReviewResultText(passedReviewText)?.summary,
  '方案已通过复核。主链路包含财务审批节点。',
)
assert.equal(isNocodeEditorFlowSchemeReviewResultText('报销单审批流程已暂存，共 2 个主步骤。'), false)
assert.equal(isNocodeEditorFlowSchemeReviewResultText('{"failed": false}'), false)

// 2. 普通轮里模型复述复核协议体时，不能把它落成用户可见回复，退回本轮动作的业务说明。
const flowSchemeResult = { name: 'editor_plan_flow_scheme', ok: true, output: {} }
const sanitizedFinalText = buildNocodeEditorToolLoopFinalAssistantText({
  latestRoundAssistantText: passedReviewText,
  assistantText: passedReviewText,
  finishReason: 'stop',
  actionResults: [flowSchemeResult],
})
assert.equal(sanitizedFinalText, 'nocodeEditorLoopFallback.flowSchemeStaged')
assert.equal(sanitizedFinalText.includes('failureReasons'), false)

// 失败复核同样不能原样展示。
const failedFinalText = buildNocodeEditorToolLoopFinalAssistantText({
  latestRoundAssistantText: failedReviewText,
  assistantText: failedReviewText,
  finishReason: 'stop',
  actionResults: [flowSchemeResult],
})
assert.equal(failedFinalText.includes('main_path_missing'), false)

// 3. 正常正文保持原样，不被兜底文案覆盖。
assert.equal(
  buildNocodeEditorToolLoopFinalAssistantText({
    latestRoundAssistantText: '报销单审批流程已暂存，共 2 个主步骤。',
    assistantText: '报销单审批流程已暂存，共 2 个主步骤。',
    finishReason: 'stop',
    actionResults: [flowSchemeResult],
  }),
  '报销单审批流程已暂存，共 2 个主步骤。',
)

// 4. 只有整条消息就是协议体时才按泄漏处理；正文里引用 JSON 的叙述保持原样。
assert.equal(isPureNocodeEditorFlowSchemeReviewResultText(passedReviewText), true)
assert.equal(isPureNocodeEditorFlowSchemeReviewResultText(failedReviewText), true)
assert.equal(
  isPureNocodeEditorFlowSchemeReviewResultText(`复核结果如下：\n${passedReviewText}`),
  false,
)

// 5. 已经落库的泄漏消息在历史归一层被剔除，不再回显。
const leakedHistory = normalizeNocodeEditorAiMessageHistory([
  { id: 'u1', role: 'user', content: '继续为“报销单”创建流程', sequence: 1 },
  { id: 'a1', role: 'assistant', content: '已切到报销单流程设置页，正在继续规划流程。', sequence: 2 },
  { id: 'a2', role: 'assistant', content: passedReviewText, sequence: 3, metadata: { internalContinuation: undefined } },
])
assert.deepEqual(leakedHistory.map(message => message.id), ['u1', 'a1'])
assert.equal(
  leakedHistory.some(message => String(message.content || '').includes('failureReasons')),
  false,
)

// 正文引用协议体（不是整条消息）的历史不剔除。
const narratingHistory = normalizeNocodeEditorAiMessageHistory([
  { id: 'a1', role: 'assistant', content: `复核结果如下：\n${passedReviewText}`, sequence: 1 },
])
assert.deepEqual(narratingHistory.map(message => message.id), ['a1'])

// 带可渲染卡片的助手消息即使正文是协议体也保留卡片数据。
const cardHistory = normalizeNocodeEditorAiMessageHistory([
  {
    id: 'a1',
    role: 'assistant',
    content: passedReviewText,
    sequence: 1,
    metadata: { blocks: [{ kind: 'flow-scheme', status: 'ready' }] },
  },
])
assert.deepEqual(cardHistory.map(message => message.id), ['a1'])

console.log('flow scheme review result visibility: ok')
