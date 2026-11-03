import assert from 'node:assert/strict'

import i18next from 'i18next'

import {
  pickFlowSchemePlanningContextKey,
  resolveFlowSchemeContextFormKey,
  resolveFlowSchemeFormIdentityKind,
  resolveFlowSchemeGroundingIdentity,
} from '../../src/common/utils/nocodeEditorFlowSchemeCardIdentity'
import {
  isFlowSchemeArtifactIdentityMismatched,
  resolveFlowSchemeArtifactSyncDecision,
} from '../../src/renderer/views/nocode/views/editor/ai/flowSchemeArtifactState'
import { resolveAiArtifactConfirmation } from '../../src/renderer/views/nocode/components/ai/artifactBlock'
import {
  buildFlowSchemeDisplayVersionIndex,
  resolveFlowSchemeDisplayVersionLabel,
} from '../../src/renderer/views/nocode/views/editor/ai/planningDisplayVersion'
import type { NocodeEditorAiArtifactBlock } from '../../src/renderer/views/nocode/views/editor/ai/types'

i18next.init({
  lng: 'zh-CN',
  initImmediate: false,
  resources: {
    'zh-CN': {
      translation: {
        nocodeEditorVersionLabel: {
          version: '第 {{version}} 版',
        },
      },
    },
  },
})

const STUDENT_FORM_KEY = 't_student_000001'
const REIMBURSEMENT_FORM_KEY = 't_reimburse_0001'
const STUDENT_FORM_NAME = '学生信息'
const REIMBURSEMENT_FORM_NAME = '报销单'
const STUDENT_CONTEXT_KEY = `logical:flow-scheme:5c0wuh6tvuy5:${STUDENT_FORM_KEY}`
const STUDENT_NAME_CONTEXT_KEY = `logical:flow-scheme:5c0wuh6tvuy5:${STUDENT_FORM_NAME}`
const REIMBURSEMENT_CONTEXT_KEY = `logical:flow-scheme:nk14x67m57g5:${REIMBURSEMENT_FORM_KEY}`

// 1) 方案身份优先取暂存态：暂存态顶层 key 才是本次落地的方案，翻历史会拿到别的表单
assert.equal(
  pickFlowSchemePlanningContextKey(REIMBURSEMENT_CONTEXT_KEY, STUDENT_CONTEXT_KEY),
  REIMBURSEMENT_CONTEXT_KEY,
)
assert.equal(
  pickFlowSchemePlanningContextKey('', '', STUDENT_CONTEXT_KEY),
  STUDENT_CONTEXT_KEY,
)
assert.equal(pickFlowSchemePlanningContextKey(undefined, null, '  '), '')

// 2) 身份解析：逻辑 key 与带 revision/stagedAt 的 key 都能取出表单
assert.equal(resolveFlowSchemeContextFormKey(STUDENT_CONTEXT_KEY), STUDENT_FORM_KEY)
assert.equal(
  resolveFlowSchemeContextFormKey(`flow-scheme:outline-1:${STUDENT_FORM_KEY}:12:1761000000000`),
  STUDENT_FORM_KEY,
)
assert.equal(resolveFlowSchemeContextFormKey('flow-scheme'), '')

// 3) 表单表示种类：只认同一种表示，id 对名字不出结论
assert.equal(resolveFlowSchemeFormIdentityKind({
  contextFormKey: STUDENT_FORM_KEY,
  formId: STUDENT_FORM_KEY,
  formName: STUDENT_FORM_NAME,
}), 'id')
assert.equal(resolveFlowSchemeFormIdentityKind({
  contextFormKey: STUDENT_FORM_NAME,
  formId: STUDENT_FORM_KEY,
  formName: STUDENT_FORM_NAME,
}), 'name')
assert.equal(resolveFlowSchemeFormIdentityKind({
  contextFormKey: REIMBURSEMENT_FORM_KEY,
  formId: STUDENT_FORM_KEY,
  formName: STUDENT_FORM_NAME,
}), null)
assert.equal(resolveFlowSchemeFormIdentityKind({ contextFormKey: '', formId: STUDENT_FORM_KEY }), null)

const pendingCard = (input: {
  contextKey?: string
  stagedAt?: number
  schemeFormKey: string
  schemeFormName: string
  questionTarget?: { formKey?: string; formName?: string }
}) => ({
  kind: 'flow-scheme',
  status: 'ready',
  title: `${input.schemeFormName}审批流程`,
  revision: input.stagedAt ? 12 : undefined,
  stagedAt: input.stagedAt,
  scheme: {
    title: `${input.schemeFormName}审批流程`,
    target: { formId: input.schemeFormKey, formName: input.schemeFormName },
  },
  confirmation: {
    status: 'pending',
    planningContextKey: input.contextKey,
    questions: [{
      id: 'q-field-source',
      title: `${input.schemeFormName}字段来源`,
      decisionTarget: input.questionTarget,
    }],
  },
})

const oldStudentCard = pendingCard({
  contextKey: STUDENT_CONTEXT_KEY,
  stagedAt: 1761000000000,
  schemeFormKey: STUDENT_FORM_KEY,
  schemeFormName: STUDENT_FORM_NAME,
  questionTarget: { formKey: STUDENT_FORM_KEY, formName: STUDENT_FORM_NAME },
})
const oldReimbursementCard = pendingCard({
  contextKey: REIMBURSEMENT_CONTEXT_KEY,
  stagedAt: 1761000000000,
  schemeFormKey: REIMBURSEMENT_FORM_KEY,
  schemeFormName: REIMBURSEMENT_FORM_NAME,
  questionTarget: { formKey: REIMBURSEMENT_FORM_KEY, formName: REIMBURSEMENT_FORM_NAME },
})

// 4) 复现死胡同：旧的学生信息卡占据上下文身份，新的报销单收口卡被套上了学生身份
const miscastReimbursementCard = pendingCard({
  contextKey: STUDENT_CONTEXT_KEY,
  schemeFormKey: STUDENT_FORM_KEY,
  schemeFormName: STUDENT_FORM_NAME,
  questionTarget: { formKey: REIMBURSEMENT_FORM_KEY, formName: REIMBURSEMENT_FORM_NAME },
})
assert.equal(
  resolveFlowSchemeArtifactSyncDecision({
    block: miscastReimbursementCard,
    blocks: [oldStudentCard, miscastReimbursementCard],
  }).reason,
  'stale_flow_scheme_artifact',
)
assert.equal(isFlowSchemeArtifactIdentityMismatched(miscastReimbursementCard), true)
assert.equal(isFlowSchemeArtifactIdentityMismatched(oldStudentCard), false)

// 5) 身份一致时保留原有过期判定：真正被新版取代的旧卡不能借此放行作答
const successorReimbursementCard = pendingCard({
  contextKey: REIMBURSEMENT_CONTEXT_KEY,
  stagedAt: 1761000009999,
  schemeFormKey: REIMBURSEMENT_FORM_KEY,
  schemeFormName: REIMBURSEMENT_FORM_NAME,
  questionTarget: { formKey: REIMBURSEMENT_FORM_KEY, formName: REIMBURSEMENT_FORM_NAME },
})
assert.equal(
  resolveFlowSchemeArtifactSyncDecision({
    block: oldReimbursementCard,
    blocks: [oldReimbursementCard, successorReimbursementCard],
  }).reason,
  'stale_flow_scheme_artifact',
)
assert.equal(isFlowSchemeArtifactIdentityMismatched(oldReimbursementCard), false)
assert.equal(isFlowSchemeArtifactIdentityMismatched(successorReimbursementCard), false)

// 6) 题目目标只给了名字、身份里是 id 时拿不到可比值，不判身份不可信
const nameOnlySameFormCard = pendingCard({
  contextKey: STUDENT_CONTEXT_KEY,
  schemeFormKey: STUDENT_FORM_KEY,
  schemeFormName: STUDENT_FORM_NAME,
  questionTarget: { formName: STUDENT_FORM_NAME },
})
assert.equal(isFlowSchemeArtifactIdentityMismatched(nameOnlySameFormCard), false)

// 7) 身份与表单名对齐时按名字比较，跨表单照样识别为不一致
const nameKeyMiscastCard = pendingCard({
  contextKey: STUDENT_NAME_CONTEXT_KEY,
  schemeFormKey: STUDENT_FORM_KEY,
  schemeFormName: STUDENT_FORM_NAME,
  questionTarget: { formKey: REIMBURSEMENT_FORM_KEY, formName: REIMBURSEMENT_FORM_NAME },
})
assert.equal(isFlowSchemeArtifactIdentityMismatched(nameKeyMiscastCard), true)

// 8) 没有身份 key 或身份与方案目标对不上时不降级
assert.equal(isFlowSchemeArtifactIdentityMismatched(pendingCard({
  schemeFormKey: STUDENT_FORM_KEY,
  schemeFormName: STUDENT_FORM_NAME,
  questionTarget: { formKey: REIMBURSEMENT_FORM_KEY, formName: REIMBURSEMENT_FORM_NAME },
})), false)
assert.equal(isFlowSchemeArtifactIdentityMismatched(pendingCard({
  contextKey: REIMBURSEMENT_CONTEXT_KEY,
  schemeFormKey: STUDENT_FORM_KEY,
  schemeFormName: STUDENT_FORM_NAME,
  questionTarget: { formKey: REIMBURSEMENT_FORM_KEY, formName: REIMBURSEMENT_FORM_NAME },
})), false)

// 9) 真实收口卡会丢方案目标：只能靠 id 前缀认出身份存的是表单 id，再和题目目标比
const targetlessMiscastCard = {
  kind: 'flow-scheme',
  status: 'ready',
  title: `${STUDENT_FORM_NAME}审批流程`,
  revision: 11,
  scheme: {
    title: `${STUDENT_FORM_NAME}审批流程`,
    summary: '',
  },
  confirmation: {
    status: 'pending',
    planningContextKey: STUDENT_CONTEXT_KEY,
    questions: [{
      id: 'flow-grounding-source-field-missing:tb_submit',
      title: `AI 规划引用了表单“${REIMBURSEMENT_FORM_NAME}”中没有的字段“已通过”`,
      decisionTarget: {
        kind: 'field-source',
        formKey: REIMBURSEMENT_FORM_KEY,
        formName: REIMBURSEMENT_FORM_NAME,
        fieldKey: '已通过',
      },
    }],
  },
}
assert.equal(isFlowSchemeArtifactIdentityMismatched(targetlessMiscastCard), true)
assert.equal(isFlowSchemeArtifactIdentityMismatched({
  ...targetlessMiscastCard,
  confirmation: {
    ...targetlessMiscastCard.confirmation,
    questions: [{
      id: 'q-name-only',
      title: '学生信息字段来源',
      decisionTarget: { formName: STUDENT_FORM_NAME },
    }],
  },
}), false)

// 10) 身份修正后（R1）新卡不再落进旧身份，自然不判过期
const correctlyIdentifiedCard = pendingCard({
  contextKey: REIMBURSEMENT_CONTEXT_KEY,
  schemeFormKey: REIMBURSEMENT_FORM_KEY,
  schemeFormName: REIMBURSEMENT_FORM_NAME,
  questionTarget: { formKey: REIMBURSEMENT_FORM_KEY, formName: REIMBURSEMENT_FORM_NAME },
})
assert.equal(
  resolveFlowSchemeArtifactSyncDecision({
    block: correctlyIdentifiedCard,
    blocks: [oldStudentCard, correctlyIdentifiedCard],
  }).reason,
  'current_flow_scheme_artifact',
)

// 11) 兜底卡身份按题目指向的表单取：显式 key 是历史最后一张（学生）时要跳过，
//     落到同表单的权威摘要；标题也随之换成该流程的方案名。
const REIMBURSEMENT_SUMMARY_KEY = `logical:flow-scheme:2cj247m4wfdf:${REIMBURSEMENT_FORM_KEY}`
const groundingQuestions = [{
  decisionTarget: {
    kind: 'field-source' as const,
    formKey: REIMBURSEMENT_FORM_KEY,
    formName: REIMBURSEMENT_FORM_NAME,
    fieldKey: '已通过',
  },
}]
const resolvedGroundingIdentity = resolveFlowSchemeGroundingIdentity({
  questions: groundingQuestions,
  candidates: [
    { planningContextKey: STUDENT_CONTEXT_KEY, title: `${STUDENT_FORM_NAME}审批流程` },
    {
      // 暂存态已经认出目标表单，但顶层 key 还是空：只能补标题，不能顶掉同表单的 key。
      title: `${REIMBURSEMENT_FORM_NAME}按金额分流审批流程`,
      formId: REIMBURSEMENT_FORM_KEY,
      formName: REIMBURSEMENT_FORM_NAME,
    },
    {
      planningContextKey: REIMBURSEMENT_SUMMARY_KEY,
      title: `${REIMBURSEMENT_FORM_NAME}按金额分流审批流程`,
      formId: REIMBURSEMENT_FORM_KEY,
      formName: REIMBURSEMENT_FORM_NAME,
    },
    { planningContextKey: STUDENT_CONTEXT_KEY, title: `${STUDENT_FORM_NAME}审批流程` },
  ],
})
assert.equal(resolvedGroundingIdentity?.planningContextKey, REIMBURSEMENT_SUMMARY_KEY)
assert.equal(resolvedGroundingIdentity?.title, `${REIMBURSEMENT_FORM_NAME}按金额分流审批流程`)
assert.equal(resolvedGroundingIdentity?.targetFormId, REIMBURSEMENT_FORM_KEY)

// 没有题目目标时保持原行为：取第一个有身份/标题的来源
assert.equal(
  resolveFlowSchemeGroundingIdentity({
    questions: [],
    candidates: [
      { planningContextKey: STUDENT_CONTEXT_KEY, title: `${STUDENT_FORM_NAME}审批流程` },
      { planningContextKey: REIMBURSEMENT_SUMMARY_KEY },
    ],
  })?.planningContextKey,
  STUDENT_CONTEXT_KEY,
)

// 题目目标存在但没有任何来源对上：返回空，不能再借用别的表单的方案名
assert.equal(resolveFlowSchemeGroundingIdentity({
  questions: groundingQuestions,
  candidates: [
    { planningContextKey: STUDENT_CONTEXT_KEY, title: `${STUDENT_FORM_NAME}审批流程` },
  ],
}), null)

// 12) 身份修正后，兜底卡进入报销单自己的版本族：它和学生信息卡各自都是第 1 版
const healedGroundingCard = {
  ...targetlessMiscastCard,
  title: `${REIMBURSEMENT_FORM_NAME}按金额分流审批流程`,
  scheme: { ...targetlessMiscastCard.scheme, title: `${REIMBURSEMENT_FORM_NAME}按金额分流审批流程` },
  confirmation: {
    ...targetlessMiscastCard.confirmation,
    planningContextKey: REIMBURSEMENT_SUMMARY_KEY,
  },
}
const healedVersionIndex = buildFlowSchemeDisplayVersionIndex({
  messages: [],
  artifactBlocks: [oldStudentCard, healedGroundingCard] as unknown as NocodeEditorAiArtifactBlock[],
})
assert.equal(
  resolveFlowSchemeDisplayVersionLabel(healedGroundingCard as unknown as NocodeEditorAiArtifactBlock, healedVersionIndex),
  '第 1 版',
)
assert.equal(
  resolveFlowSchemeDisplayVersionLabel(oldStudentCard as unknown as NocodeEditorAiArtifactBlock, healedVersionIndex),
  '第 1 版',
)

// 13) 未修正时也不能让没有 stagedAt 的兜底卡抢走族内第 1 版（按 revision 排序）
// 真实数据：学生信息第 10 版带 stagedAt，兜底卡第 11 版没有 stagedAt。
const studentFirstVersionCard = { ...oldStudentCard, revision: 10 }
const studentFamilyIndex = buildFlowSchemeDisplayVersionIndex({
  messages: [],
  artifactBlocks: [targetlessMiscastCard, studentFirstVersionCard] as unknown as NocodeEditorAiArtifactBlock[],
})
assert.equal(
  resolveFlowSchemeDisplayVersionLabel(studentFirstVersionCard as unknown as NocodeEditorAiArtifactBlock, studentFamilyIndex),
  '第 1 版',
)
assert.equal(
  resolveFlowSchemeDisplayVersionLabel(targetlessMiscastCard as unknown as NocodeEditorAiArtifactBlock, studentFamilyIndex),
  '第 2 版',
)

// 14) 读取时卡片自己的确认身份优先：方案载荷里的确认副本属于来源卡，不能反过来盖掉身份
const healedCardWithStaleSchemeCopy = {
  type: 'artifact' as const,
  kind: 'flow-scheme' as const,
  status: 'ready' as const,
  title: `${REIMBURSEMENT_FORM_NAME}按金额分流审批流程`,
  scheme: {
    title: `${REIMBURSEMENT_FORM_NAME}按金额分流审批流程`,
    summary: `${REIMBURSEMENT_FORM_NAME}按金额分流审批流程`,
    trigger: { type: 'manual' as const, description: '用户发起' },
    confirmation: {
      status: 'pending' as const,
      planningContextKey: STUDENT_CONTEXT_KEY,
      questions: [{ id: 'q-student-field-source', title: '字段来源', required: true, allowFreeText: true }],
    },
  },
  confirmation: {
    status: 'pending' as const,
    planningContextKey: REIMBURSEMENT_SUMMARY_KEY,
    questions: [],
  },
}
assert.equal(
  resolveAiArtifactConfirmation(healedCardWithStaleSchemeCopy as unknown as NocodeEditorAiArtifactBlock)
    ?.planningContextKey,
  REIMBURSEMENT_SUMMARY_KEY,
)
// 卡片自身没有 key 时仍回落到载荷副本，旧卡不至于失去身份
assert.equal(
  resolveAiArtifactConfirmation({
    ...healedCardWithStaleSchemeCopy,
    confirmation: { status: 'pending', planningContextKey: '', questions: [] },
  } as unknown as NocodeEditorAiArtifactBlock)?.planningContextKey,
  STUDENT_CONTEXT_KEY,
)

console.log('flow-scheme-context-identity: ok')
