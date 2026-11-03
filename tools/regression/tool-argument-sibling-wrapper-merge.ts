import assert from 'node:assert/strict'

import { mergeSiblingPropertiesIntoSoleRequiredObjectWrapper } from '../../src/main/modules/ai/openai/ai-openai-tool-argument-repair.util'

const singleFormPlanSchema = {
  type: 'object',
  properties: {
    outline: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        forms: {
          type: 'array',
          items: {
            type: 'object',
            properties: { tableName: { type: 'string' } },
            required: ['tableName'],
          },
        },
        flowIntent: { type: 'object' },
        modules: { type: 'array' },
      },
      required: ['forms', 'flowIntent'],
    },
  },
  required: ['outline'],
  additionalProperties: false,
}

// 模型把 forms 写成 outline 的平级数组时，并回 outline.forms。
const siblingArrayMerged = mergeSiblingPropertiesIntoSoleRequiredObjectWrapper({
  outline: { title: '报销单' },
  forms: [{ tableName: '报销单' }],
}, singleFormPlanSchema)
assert.deepEqual(siblingArrayMerged, {
  outline: { title: '报销单', forms: [{ tableName: '报销单' }] },
})

// forms 是 JSON 字符串时同样并回（字符串解析交给后续按 schema 归一化）。
const siblingStringMerged = mergeSiblingPropertiesIntoSoleRequiredObjectWrapper({
  outline: { title: '报销单' },
  forms: '[{"tableName":"报销单"}]',
}, singleFormPlanSchema)
assert.deepEqual(siblingStringMerged, {
  outline: { title: '报销单', forms: '[{"tableName":"报销单"}]' },
})

// 多个必填平级字段同时并回，根层不再保留。
const multipleSiblingsMerged = mergeSiblingPropertiesIntoSoleRequiredObjectWrapper({
  outline: { title: '报销单' },
  forms: [{ tableName: '报销单' }],
  flowIntent: { state: 'none' },
}, singleFormPlanSchema)
assert.deepEqual(multipleSiblingsMerged, {
  outline: {
    title: '报销单',
    forms: [{ tableName: '报销单' }],
    flowIntent: { state: 'none' },
  },
})

// 可选字段不并回：根层 modules 不是包装必填键，保持原来的忽略语义。
const optionalSiblingInput = {
  outline: { forms: [{ tableName: '报销单' }], flowIntent: { state: 'none' } },
  modules: [{ name: '基础信息' }],
}
assert.equal(
  mergeSiblingPropertiesIntoSoleRequiredObjectWrapper(optionalSiblingInput, singleFormPlanSchema),
  optionalSiblingInput,
)

// 包装内已有同名字段时以嵌套值为准，不用根层覆盖。
const nestedWinsInput = {
  outline: { forms: [{ tableName: '报销单' }] },
  forms: [{ tableName: '其它单' }],
}
assert.equal(
  mergeSiblingPropertiesIntoSoleRequiredObjectWrapper(nestedWinsInput, singleFormPlanSchema),
  nestedWinsInput,
)

// 没有包装键时保持原样，交给既有的整体包装逻辑。
const unwrappedInput = { title: '报销单', forms: [{ tableName: '报销单' }] }
assert.equal(
  mergeSiblingPropertiesIntoSoleRequiredObjectWrapper(unwrappedInput, singleFormPlanSchema),
  unwrappedInput,
)

// 根 schema 自己声明了同名字段时不搬，避免改变既有语义。
const rootOwnedKeySchema = {
  type: 'object',
  properties: {
    outline: {
      type: 'object',
      properties: {
        forms: { type: 'array' },
      },
      required: ['forms'],
    },
    forms: { type: 'array' },
  },
  required: ['outline'],
}
const rootOwnedKeyInput = { outline: {}, forms: [{ tableName: '报销单' }] }
assert.equal(
  mergeSiblingPropertiesIntoSoleRequiredObjectWrapper(rootOwnedKeyInput, rootOwnedKeySchema),
  rootOwnedKeyInput,
)

// 根层不是唯一必填包装键时不处理。
const multiRequiredSchema = {
  type: 'object',
  properties: {
    outline: {
      type: 'object',
      properties: { forms: { type: 'array' } },
      required: ['forms'],
    },
    mode: { type: 'string' },
  },
  required: ['outline', 'mode'],
}
const multiRequiredInput = { outline: {}, forms: [{ tableName: '报销单' }] }
assert.equal(
  mergeSiblingPropertiesIntoSoleRequiredObjectWrapper(multiRequiredInput, multiRequiredSchema),
  multiRequiredInput,
)

console.log('tool-argument-sibling-wrapper-merge: ok')
