import assert from 'node:assert/strict'

import {
  countBlueprintCardPendingQuestions,
  resolveBlueprintCardPendingQuestions,
  resolveUniquePendingBlueprintCardKey,
} from '../../src/renderer/views/nocode/views/editor/ai/components/blueprintCardPendingQuestions'
import type { BlueprintWorkbenchCard } from '../../src/renderer/views/nocode/views/editor/ai/blueprintWorkbenchViewModel'
import type {
  NocodeEditorAiAppBlueprintForm,
  NocodeEditorAiStageBlueprintDisplayItem,
} from '../../src/renderer/views/nocode/views/editor/ai/types'
import type {
  NocodeEditorAiConfirmPayload,
  NocodeEditorAiConfirmQuestion,
} from '../../src/common/types/nocodeEditorConfirmation'

const formA: NocodeEditorAiAppBlueprintForm = {
  formKey: 'form-a',
  tableName: '学生信息',
  fields: [],
}
const formB: NocodeEditorAiAppBlueprintForm = {
  formKey: 'form-b',
  tableName: '学生请假申请表',
  fields: [],
}
const formC: NocodeEditorAiAppBlueprintForm = {
  formKey: 'form-c',
  tableName: '报销申请',
  fields: [],
}
const forms = [formA, formB, formC]

const questions: NocodeEditorAiConfirmQuestion[] = [
  {
    id: 'q-a',
    title: '学生姓名来自哪里？',
    questionKind: 'single_select',
    required: true,
    decisionTarget: { kind: 'field-source', formKey: 'form-a', fieldKey: 'student-name' },
  },
  {
    id: 'q-b1',
    title: '请假类型如何选择？',
    questionKind: 'single_select',
    required: true,
    decisionTarget: { kind: 'field-source', formKey: 'form-b', fieldKey: 'leave-type' },
  },
  {
    id: 'q-b2',
    title: '请假天数是否自动计算？',
    questionKind: 'binary',
    required: true,
    decisionTarget: { kind: 'field-source', formKey: 'form-b', fieldKey: 'leave-days' },
  },
  {
    id: 'q-blueprint',
    title: '班级字段通常来自其他表单数据',
    questionKind: 'single_select',
    required: true,
  },
  {
    id: 'q-default',
    title: '学生信息先按手填文本处理',
    questionKind: 'note_only',
    required: false,
    uncertainty: { category: 'safe_default', reasonCode: 'no-student-table' },
  },
  {
    id: 'q-confirmed',
    title: '已确认的问题',
    questionKind: 'binary',
    required: true,
    confirmed: true,
    decisionTarget: { kind: 'field-source', formKey: 'form-a', fieldKey: 'confirmed-field' },
  },
]

const confirmation: NocodeEditorAiConfirmPayload = {
  stage: 'blueprint',
  status: 'pending',
  questions,
}

const createCard = (
  form: NocodeEditorAiAppBlueprintForm,
  phase: 'staged' | 'applied_saved' = 'staged',
): BlueprintWorkbenchCard => ({
  key: `card-${form.formKey}`,
  itemKey: `card-${form.formKey}`,
  formKey: form.formKey || '',
  mode: phase === 'staged' ? 'review' : 'generated',
  role: 'primary',
  status: phase,
  title: form.tableName,
  groupName: '',
  formName: form.tableName,
  titleMeta: '',
  fieldCount: 0,
  meta: [],
  statusText: '',
  statusLabel: '',
  statusNote: '',
  fieldsPreview: [],
  item: {
    itemKind: 'ai_blueprint',
    id: `pending:${form.formKey}`,
    identityKey: `pending:${form.formKey}`,
    blueprintFormScope: forms.map(scopeForm => ({
      formKey: scopeForm.formKey,
      tableName: scopeForm.tableName,
    })),
    planningScope: { kind: 'form', keys: [] },
    phase,
    status: phase,
    updatedAt: 1,
    applyResult: null,
    draftPersistenceState: null,
    // 切片后卡片内只剩当前表单，跨表单归属只能靠 blueprintFormScope。
    blueprint: {
      title: '学生请假申请',
      summary: '请假申请蓝图',
      forms: [form],
      openQuestions: [],
      confirmation,
    },
  } as unknown as NocodeEditorAiStageBlueprintDisplayItem,
  form,
})

const cardA = createCard(formA)
const cardB = createCard(formB)
const cardC = createCard(formC)

// 字段级问题按目标表单归属；无 decisionTarget 的蓝图级问题只算首张表单。
assert.deepEqual(
  resolveBlueprintCardPendingQuestions(cardA).map(question => question.id),
  ['q-a', 'q-blueprint'],
)
assert.deepEqual(
  resolveBlueprintCardPendingQuestions(cardB).map(question => question.id),
  ['q-b1', 'q-b2'],
)
assert.equal(countBlueprintCardPendingQuestions(cardC), 0)
assert.equal(countBlueprintCardPendingQuestions(cardA), 2)
assert.equal(countBlueprintCardPendingQuestions(cardB), 2)

// 总览合计等于各页签之和，每题只算一次。
const overviewTotal = [cardA, cardB, cardC]
  .reduce((total, card) => total + countBlueprintCardPendingQuestions(card), 0)
assert.equal(overviewTotal, 4)

// 已生成卡片不显示“待确认”角标。
const appliedCardB = createCard(formB, 'applied_saved')
assert.equal(countBlueprintCardPendingQuestions(appliedCardB), 0)

// 只有一个表单有待确认时聚焦它；多个都有时保持总览。
assert.equal(resolveUniquePendingBlueprintCardKey([cardA, cardB]), '')
assert.equal(resolveUniquePendingBlueprintCardKey([cardA, cardC]), 'card-form-a')
assert.equal(resolveUniquePendingBlueprintCardKey([cardC, appliedCardB]), '')

console.log('blueprint-form-tab-pending-badge: ok')
