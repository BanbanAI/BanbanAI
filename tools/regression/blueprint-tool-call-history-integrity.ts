import assert from 'node:assert/strict'

import { AiMessageRole } from '../../src/main/modules/ai/ai.types'
import type { AiProviderMessage } from '../../src/main/modules/ai/ai.types'
import {
  projectNocodeEditorProviderMessagesForContext,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-provider-context-projection.util'

const latestUserContent = '费用明细 子表中添加报销材料字段，类型为图片'
const stagedBlueprintToolCallInput = {
  updateMode: 'patch',
  blueprint: {
    forms: [{
      formKey: 'form-1',
      fields: [{
        fieldKey: 'expenseDetails',
        children: [{
          fieldKey: 'reimbursementMaterial',
          name: '报销材料',
          widgetType: 'widget.form.image-uploader',
        }],
      }],
    }],
  },
}

const messages: AiProviderMessage[] = [
  {
    role: AiMessageRole.USER,
    content: '报销单：报销人、费用明细子表（费用类型、金额）',
  },
  {
    role: AiMessageRole.ASSISTANT,
    content: '',
    metadata: {
      modelToolExchangeCall: {
        id: 'call-1',
        name: 'editor_stage_app_blueprint',
        input: stagedBlueprintToolCallInput,
      },
    },
  } as AiProviderMessage,
  {
    role: AiMessageRole.TOOL,
    content: JSON.stringify({
      toolCallId: 'call-1',
      output: { ok: false },
    }),
    metadata: {
      modelToolExchangeResult: {
        id: 'call-1',
        name: 'editor_stage_app_blueprint',
      },
    },
  } as AiProviderMessage,
  {
    role: AiMessageRole.USER,
    content: latestUserContent,
  },
]

const projected = projectNocodeEditorProviderMessagesForContext(messages)
const projectedToolCall = projected.messages[1]?.metadata?.modelToolExchangeCall
assert.deepEqual(
  projectedToolCall?.input,
  stagedBlueprintToolCallInput,
  '历史工具调用参数必须保持原始结构，不能被上下文投影压平',
)
const projectedBlueprint = (projectedToolCall?.input as {
  blueprint?: { forms?: Array<{ fields?: Array<{ children?: unknown }> }> }
} | undefined)?.blueprint
assert.deepEqual(
  projectedBlueprint?.forms?.[0]?.fields?.[0]?.children,
  [{
    fieldKey: 'reimbursementMaterial',
    name: '报销材料',
    widgetType: 'widget.form.image-uploader',
  }],
  '子字段必须继续嵌套在父字段 children 内',
)
assert.equal(
  projected.projections.some(item => item.strategy === 'nocode-editor-staged-blueprint-tool-call-compaction'),
  false,
  '不应再对历史工具调用参数做结构压缩',
)

console.log('blueprint tool call history integrity regression checks passed')
