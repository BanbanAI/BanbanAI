import assert from 'node:assert/strict'

import { inferBlueprintFieldIntent } from '../../src/renderer/views/nocode/views/editor/ai/blueprintFieldIntent'
import { isBlueprintConfirmationQuestionInScope } from '../../src/renderer/views/nocode/views/editor/ai/components/blueprintConfirmationQuestionScope'
import type { NocodeEditorAiConfirmQuestion } from '../../src/common/types/nocodeEditorConfirmation'

const masterDefinitionField = {
  formName: '学生信息管理',
  fieldName: '班级',
  explicitWidgetType: 'widget.form.textInput',
  description: '',
  notes: [] as string[],
  hasSource: false,
  canResolveRelationSource: false,
  hasChildren: false,
  enumOptionsCount: 0,
}

const unboundIntent = inferBlueprintFieldIntent(masterDefinitionField)
assert.equal(unboundIntent.intent, 'ambiguous-relation')
assert.equal(unboundIntent.requiresClarification, true)

const referencedIntent = inferBlueprintFieldIntent({
  ...masterDefinitionField,
  isReferencedSourceField: true,
})
assert.equal(referencedIntent.requiresClarification, false)
assert.equal(referencedIntent.intent, 'relation-master-data')
assert.equal(referencedIntent.widgetType, 'widget.form.textInput')
assert.equal(referencedIntent.trustedExplicitWidgetType, 'widget.form.textInput')
assert.ok(referencedIntent.matchedSignals.includes('referenced-source-field'))

const unresolvedRelationField = inferBlueprintFieldIntent({
  ...masterDefinitionField,
  isReferencedSourceField: false,
})
assert.equal(unresolvedRelationField.requiresClarification, true)

const question = (
  id: string,
  decisionTarget?: NocodeEditorAiConfirmQuestion['decisionTarget'],
) => ({
  id,
  title: id,
  ...(decisionTarget ? { decisionTarget } : {}),
}) as NocodeEditorAiConfirmQuestion

const studentFormScope = {
  formKey: 'form-student',
  formName: '学生信息管理',
  includeBlueprintLevelQuestions: false,
  knownFormKeys: ['form-leave', '学生请假申请表', 'form-student', '学生信息管理'],
}

assert.equal(isBlueprintConfirmationQuestionInScope(question('own-field', {
  kind: 'field-source',
  formKey: 'form-student',
  fieldKey: 'f-class',
}), studentFormScope), true)
assert.equal(isBlueprintConfirmationQuestionInScope(question('other-field', {
  kind: 'field-source',
  formKey: 'form-leave',
  fieldKey: 'f-reason',
}), studentFormScope), false)
assert.equal(isBlueprintConfirmationQuestionInScope(question('global-question'), studentFormScope), false)
assert.equal(isBlueprintConfirmationQuestionInScope(question('global-question'), {
  ...studentFormScope,
  includeBlueprintLevelQuestions: true,
}), true)
assert.equal(isBlueprintConfirmationQuestionInScope(question('form-name-target', {
  kind: 'field-source',
  formKey: '学生信息管理',
  fieldKey: 'f-class',
}), studentFormScope), true)
assert.equal(isBlueprintConfirmationQuestionInScope(question('dangling-target', {
  kind: 'field-source',
  formKey: 'form-removed',
  fieldKey: 'f-old',
}), {
  ...studentFormScope,
  includeBlueprintLevelQuestions: true,
}), true)

console.log('blueprint-master-data-definition-field: ok')
