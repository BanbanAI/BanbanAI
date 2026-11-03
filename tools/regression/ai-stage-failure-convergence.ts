import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  buildBlueprintDesignGapStopLossMessage,
  createNocodeEditorToolFailureTracker,
  readNocodeEditorBlueprintDesignGaps,
  resolveNocodeEditorStageOutputContract,
} from '../../src/main/modules/ai/nocode-editor/nocode-editor-stage-output-contract'
import { initTestI18n } from './test-i18n'

initTestI18n()

const TECHNICAL_WORDS = [
  'designGaps',
  'fieldKey',
  'updateMode',
  'enumOptions',
  'formulaSettings',
  'retry',
  'exhausted',
]

// 1) 三种缺口原因分别落到业务表述
const enumGap = buildBlueprintDesignGapStopLossMessage([
  { tableName: '费用类型', fieldName: '类型名称', reason: 'enum-options-missing' },
])
assert.equal(enumGap.includes('“费用类型.类型名称”缺少选项'), true)

const formulaGap = buildBlueprintDesignGapStopLossMessage([
  { tableName: '报销单', fieldName: '合计金额', reason: 'auto-compute-formula-missing' },
])
assert.equal(formulaGap.includes('“报销单.合计金额”是实时计算字段但缺少计算公式'), true)

const relatedFormGap = buildBlueprintDesignGapStopLossMessage([
  { tableName: '部门', reason: 'related-form-needs-design' },
])
assert.equal(relatedFormGap.includes('关联表“部门”尚未规划业务字段'), true)

// 2) 超过三处只列三处，但仍说明总数；字段名为空时只用表名
const manyGaps = buildBlueprintDesignGapStopLossMessage([
  { tableName: '费用类型', fieldName: '类型名称', reason: 'enum-options-missing' },
  { tableName: '报销单', fieldName: '合计金额', reason: 'auto-compute-formula-missing' },
  { tableName: '部门', reason: 'related-form-needs-design' },
  { tableName: '报销单', fieldName: '余额', reason: 'auto-compute-formula-missing' },
])
assert.equal(manyGaps.includes('还有 4 处'), true)
assert.equal(manyGaps.includes('“费用类型.类型名称”'), true)
assert.equal(manyGaps.includes('报销单.余额'), false)

const tableNameOnlyGap = buildBlueprintDesignGapStopLossMessage([
  { tableName: '费用类型', reason: 'enum-options-missing' },
])
assert.equal(tableNameOnlyGap.includes('“费用类型”里还有字段缺少选项'), true)
assert.equal(tableNameOnlyGap.includes('费用类型.'), false)

// 3) 读取时缺表名的缺口被丢弃；全部丢弃时仍有可执行兜底文案
assert.equal(readNocodeEditorBlueprintDesignGaps({
  designGaps: [{ fieldName: '类型名称', reason: 'enum-options-missing' }],
}).length, 0)
const fallback = buildBlueprintDesignGapStopLossMessage([])
assert.equal(fallback.includes('暂存状态'), true)
assert.equal(fallback.includes('按默认方式处理'), true)

// 4) 收口文案不出现实现词
for (const message of [enumGap, formulaGap, relatedFormGap, manyGaps, fallback]) {
  for (const technical of TECHNICAL_WORDS) {
    assert.equal(message.includes(technical), false, `文案不应出现 ${technical}`)
  }
}

// 5) 重试一次仍缺时契约进入 exhausted（P1 收口分支的前置条件）
const blueprintContract = {
  id: 'blueprint-design-completeness',
  applicable: true,
  prerequisiteToolNames: [],
  satisfyingOutputToolNames: ['editor_stage_app_blueprint'],
  retryLimit: 1,
  validateOutcome: (result: { output?: unknown }) => (
    readNocodeEditorBlueprintDesignGaps(result.output).length === 0
  ),
}
const gapResult = {
  name: 'editor_stage_app_blueprint',
  ok: true,
  output: {
    designGaps: [{ tableName: '费用类型', fieldName: '类型名称', reason: 'enum-options-missing' }],
  },
}
assert.deepEqual(
  resolveNocodeEditorStageOutputContract({
    contract: blueprintContract,
    results: [gapResult],
    retryCount: 1,
    hasRetryRoundAvailable: true,
  }),
  { kind: 'exhausted', contractId: 'blueprint-design-completeness' },
)
assert.deepEqual(
  resolveNocodeEditorStageOutputContract({
    contract: blueprintContract,
    results: [gapResult],
    retryCount: 0,
    hasRetryRoundAvailable: true,
  }),
  { kind: 'retry', contractId: 'blueprint-design-completeness', retryCount: 1 },
)
assert.equal(
  resolveNocodeEditorStageOutputContract({
    contract: blueprintContract,
    results: [gapResult],
    retryCount: 0,
    hasRetryRoundAvailable: false,
  }).kind,
  'exhausted',
)
assert.equal(
  resolveNocodeEditorStageOutputContract({
    contract: blueprintContract,
    results: [{ name: 'editor_stage_app_blueprint', ok: true, output: { designGaps: [] } }],
    retryCount: 1,
    hasRetryRoundAvailable: true,
  }).kind,
  'satisfied',
)

// 6) 固化“为什么需要 P1”：ok:true 的带缺口结果不进入同因失败闸
const tracker = createNocodeEditorToolFailureTracker()
for (let round = 1; round <= 5; round += 1) {
  assert.equal(tracker.observe([gapResult], round), null)
}
assert.deepEqual(tracker.snapshot(), [])

const failureTracker = createNocodeEditorToolFailureTracker()
const failedResult = {
  name: 'editor_stage_app_blueprint',
  ok: false,
  metadata: { blueprintInputErrorCode: 'blueprint_input_invalid' },
}
assert.equal(failureTracker.observe([failedResult], 1), null)
assert.equal(failureTracker.observe([failedResult], 2), null)
assert.equal(failureTracker.observe([failedResult], 3)?.count, 3)

// 7) 三条失败文案要说明保留了什么、用户下一步能补什么，不再只让“重试”
const readLocaleChatCopy = (locale: string) => {
  const localePath = path.resolve(__dirname, `../../src/locales/${locale}/lang.json`)
  return JSON.parse(fs.readFileSync(localePath, 'utf8')).nocodeEditorChatService
}
for (const locale of ['zh-CN', 'zh-TW', 'en']) {
  const copy = readLocaleChatCopy(locale)
  for (const key of ['aiEditingFailed', 'flowSchemeReviewFailed', 'executableStructureMissing']) {
    const text = String(copy[key] || '')
    assert.equal(text.length > 0, true, `${locale}.${key} 不应为空`)
    assert.equal(/请重试|請重試|Please try again/i.test(text), false, `${locale}.${key} 不应只让用户重试`)
  }
  assert.equal(String(copy.aiEditingFailed).includes('没有改动') || String(copy.aiEditingFailed).includes('沒有改動') || String(copy.aiEditingFailed).includes('was not changed'), true)
  assert.equal(String(copy.executableStructureMissing).includes('补充目标') || String(copy.executableStructureMissing).includes('補充目標') || String(copy.executableStructureMissing).includes('Add the goal'), true)
}
const zhCnCopy = readLocaleChatCopy('zh-CN')
assert.equal(zhCnCopy.executableStructureMissing.includes('换一种更短的说法'), false)
assert.equal(zhCnCopy.flowSchemeReviewFailed.includes('继续'), true)

console.log('ai-stage-failure-convergence: ok')
