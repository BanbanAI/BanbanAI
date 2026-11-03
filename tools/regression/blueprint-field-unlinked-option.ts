import assert from 'node:assert/strict'

import {
  inferBlueprintFieldIntent,
  isBlueprintFieldClarificationQuestionText,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintFieldIntent'
import { resolveBlueprintFieldInterpretation } from '../../src/renderer/views/nocode/views/editor/ai/blueprintFieldInterpretation'
import {
  attachBlueprintFieldKeepAsTextOptions,
} from '../../src/renderer/views/nocode/views/editor/ai/blueprintConfirmationDecisionOverride'
import type { NocodeEditorAiConfirmPayload } from '../../src/common/types/nocodeEditorConfirmation'

const masterDataInput = {
  formName: '合同管理表',
  fieldName: '客户名称',
  description: '',
  notes: [] as string[],
  hasSource: false,
  canResolveRelationSource: false,
  hasChildren: false,
  enumOptionsCount: 0,
}
const intent = inferBlueprintFieldIntent(masterDataInput)
assert.equal(intent.intent, 'ambiguous-relation')
assert.equal(intent.capabilityFamily, 'master-data-relation')
assert.equal(intent.requiresClarification, true)

const question = String(intent.clarificationQuestion || '')
assert.ok(question.includes('也可以先不关联'))
assert.ok(isBlueprintFieldClarificationQuestionText(question))
// 升级前草稿里的旧题面仍要识别。
assert.ok(isBlueprintFieldClarificationQuestionText(
  '“客户名称”这类字段通常来自其他表单数据。请确认它要关联哪个表单、显示哪个字段？',
))
assert.equal(isBlueprintFieldClarificationQuestionText('客户名称字段是否必填？'), false)

const toInterpretationInput = (fieldName: string) => ({
  ...masterDataInput,
  fieldName,
  name: fieldName,
  hasBlueprint: true,
  textFirstConfirmed: false,
})

const interpretation = resolveBlueprintFieldInterpretation(toInterpretationInput('客户名称'))
assert.equal(interpretation.requiresClarification, true)
assert.equal(interpretation.clarificationKind, 'relation-source')

// 组织身份题同类 intent 但不是来源追问，不能给“先不关联”。
const departmentInterpretation = resolveBlueprintFieldInterpretation(toInterpretationInput('部门负责人'))
assert.equal(departmentInterpretation.clarificationKind, undefined)

const payload = {
  stage: 'blueprint',
  status: 'pending',
  questions: [
    { id: 'q-relation', title: question },
    { id: 'q-other', title: '客户名称字段是否必填？' },
    { id: 'q-answered', title: question, selectedOptionValue: 'keep-as-text' },
    {
      id: 'q-note',
      title: question,
      questionKind: 'note_only',
      required: false,
    },
  ],
} as NocodeEditorAiConfirmPayload

const patched = attachBlueprintFieldKeepAsTextOptions({
  confirmation: payload,
  relationQuestionTitles: new Set([question]),
}) as NocodeEditorAiConfirmPayload
const byId = new Map(patched.questions.map(item => [item.id, item]))
assert.equal(byId.get('q-relation')?.questionKind, 'single_select')
assert.equal(byId.get('q-relation')?.options?.length, 1)
assert.equal(byId.get('q-relation')?.options?.[0].label, '先不关联')
assert.ok(byId.get('q-relation')?.description)
assert.equal(byId.get('q-other')?.questionKind, undefined)
assert.equal(byId.get('q-answered')?.questionKind, undefined)
assert.equal(byId.get('q-note')?.questionKind, 'note_only')
assert.equal(byId.get('q-note')?.options, undefined)

// 没有关系题题面时不改动对象身份，避免无谓重渲染。
assert.equal(attachBlueprintFieldKeepAsTextOptions({
  confirmation: payload,
  relationQuestionTitles: new Set(),
}), payload)

console.log('blueprint-field-unlinked-option: ok')
