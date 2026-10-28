import assert from 'node:assert/strict'

import type { AiAssistantMessageBlock } from '../../src/common/types/ai'
import {
  shouldHideStructuredGenerationNarration,
} from '../../src/renderer/views/nocode/views/editor/ai/structuredGenerationNarration'

const readyFormPlanBlock = {
  type: 'artifact',
  kind: 'form-plan',
  status: 'ready',
} as AiAssistantMessageBlock

const loadingFormPlanBlock = {
  type: 'artifact',
  kind: 'form-plan',
  status: 'loading',
} as AiAssistantMessageBlock

// 超时等终态错误必须优先于“结构化生成旁白抑制”，否则错误文案会被整行吞掉。
assert.equal(shouldHideStructuredGenerationNarration({
  metadata: {
    persistedError: true,
    errorKind: 'provider_timeout',
  },
  blocks: [readyFormPlanBlock],
}), false)

assert.equal(shouldHideStructuredGenerationNarration({
  metadata: {
    persistedError: true,
    errorKind: 'provider_timeout',
    structuredGenerationActive: true,
  },
  blocks: [loadingFormPlanBlock],
}), false)

assert.equal(shouldHideStructuredGenerationNarration({
  metadata: {
    errorKind: 'stream_error',
  },
  blocks: [readyFormPlanBlock],
}), false)

// 非错误消息仍按原有规则隐藏结构化生成旁白。
assert.equal(shouldHideStructuredGenerationNarration({
  metadata: {},
  blocks: [readyFormPlanBlock],
}), true)

assert.equal(shouldHideStructuredGenerationNarration({
  metadata: {
    structuredGenerationActive: true,
  },
  blocks: [],
}), true)

assert.equal(shouldHideStructuredGenerationNarration({
  metadata: {
    blueprintAppliedFromAction: true,
  },
  blocks: [readyFormPlanBlock],
}), false)

assert.equal(shouldHideStructuredGenerationNarration({
  metadata: {},
  blocks: [{
    type: 'artifact',
    kind: 'form-plan',
    status: 'error',
  } as AiAssistantMessageBlock],
}), false)

console.log('terminal-error-narration-visibility: ok')
