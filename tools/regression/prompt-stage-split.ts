import assert from 'node:assert/strict'

import { AiNocodeEditorPromptService } from '../../src/main/modules/ai/nocode-editor/nocode-editor-prompt.service'
import type { AiChatRequest } from '../../src/main/modules/ai/ai.types'

const service = new AiNocodeEditorPromptService()
const request = {
  message: '流程再增加一档：报销总金额大于 5000 元时由财务审批',
  scenePayload: { mode: 'process-setting', nocodeId: 'demo' },
  metadata: {},
} as unknown as AiChatRequest

const fullPrompt = service.buildSystemPrompt({ request, actions: [] })
const flowPrompt = service.buildSystemPrompt({ request, actions: [], stage: 'flow' })

assert.equal(service.buildSystemPrompt({ request, actions: [], stage: null }), fullPrompt)

const FLOW_MARKERS = [
  'editor_get_flow_summary',
  'dependsOn',
  'personnelDecision',
  'binary 只用于明确的二选一确认题',
  '规划层级判定',
  'topology、scope、cardinality、options、applicability、meaning、strategy、binding',
  '触发方式变化会改变流程起点和节点构成，按 topology 记',
  '人员决策只能标在真正询问人员来源或绑定的单选题上',
  '选项必须先对齐 editor_get_flow_summary 中该字段的 enumOptionsPreview',
  '禁止新增近义写法',
  '用户可见正文只写 1 句状态播报',
]
for (const marker of FLOW_MARKERS) {
  assert.ok(fullPrompt.includes(marker), `全量 prompt 缺少流程 marker: ${marker}`)
  assert.ok(flowPrompt.includes(marker), `流程 prompt 缺少流程 marker: ${marker}`)
}

const FORM_ONLY_MARKERS = [
  '公式任务模式',
  'editor_stage_content_plan 暂存内容规划',
  '单表单规划的 openQuestions',
  'editor_stage_single_form_plan 的 outline 必须输出 flowIntent',
]
for (const marker of FORM_ONLY_MARKERS) {
  assert.ok(fullPrompt.includes(marker), `全量 prompt 应有表单 marker: ${marker}`)
  assert.ok(!flowPrompt.includes(marker), `流程 prompt 不应含表单 marker: ${marker}`)
}

const fullBytes = Buffer.byteLength(fullPrompt)
const flowBytes = Buffer.byteLength(flowPrompt)
assert.ok(
  flowBytes <= Math.floor(fullBytes * 0.8),
  `流程 prompt 裁剪不足: ${flowBytes}B / ${fullBytes}B`,
)

console.log(`prompt-stage-split: ok (${fullBytes} -> ${flowBytes})`)
