import {
  resolveNocodeEditorFlowEntryIntent,
  type NocodeEditorFlowEntryIntent,
} from './nocodeEditorFlowEntryIntent'

export type NocodeEditorFlowIntentSignalState =
  | 'explicit_positive'
  | 'explicit_negative'
  | 'none'

export type NocodeEditorFlowIntentSignalConfidence =
  | 'high'
  | 'medium'
  | 'low'

export type NocodeEditorFlowIntentSignal = {
  state: NocodeEditorFlowIntentSignalState
  confidence: NocodeEditorFlowIntentSignalConfidence
  evidence: string[]
  targetFormName?: string
}

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeComparableText = (value: unknown) => normalizeText(value)
  .replace(/[\s，。！？；、,.;!?:"'“”‘’（）()[\]{}]/g, '')
  .toLowerCase()

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value)
  && typeof value === 'object'
  && !Array.isArray(value)
)

const uniqueTexts = (values: unknown[]) => Array.from(new Set(
  values.map(item => normalizeText(item)).filter(Boolean),
))

const FIELD_ONLY_EVIDENCE_PATTERNS = [
  /(字段|控件|列).{0,12}审批/u,
  /审批(状态|意见|时间|人|部门|角色|编号).{0,8}(字段|列|控件)?/u,
  /流程(编号|说明).{0,8}(字段|列|控件)?/u,
]

const FIELD_ONLY_CONTEXT_PATTERNS = [
  /(字段|控件|列|字段名|默认值|显示).{0,12}审批/u,
  /审批.{0,8}(字段|列|控件|字段名|默认值)/u,
  /流程.{0,8}(编号|说明).{0,8}(字段|列|控件|字段名)?/u,
]

const FLOW_ACTION_CONTEXT_PATTERNS = [
  /提交后/u,
  /通过后/u,
  /驳回后/u,
  /审批后/u,
  /审核后/u,
  /确认后/u,
  /办理后/u,
  /发起审批/u,
  /走流程/u,
  /节点/u,
  /通知/u,
  /抄送/u,
  /回写/u,
  /归档/u,
]

const hasFlowActionContext = (value: unknown) => {
  const text = normalizeText(value)
  return Boolean(text && FLOW_ACTION_CONTEXT_PATTERNS.some(pattern => pattern.test(text)))
}

const getEvidenceContextWindow = (input: {
  evidence: unknown
  userMessage: unknown
}) => {
  const evidence = normalizeText(input.evidence)
  const userMessage = normalizeText(input.userMessage)
  const index = evidence ? userMessage.indexOf(evidence) : -1
  if (index < 0) {
    return evidence
  }
  const radius = 16
  return userMessage.slice(
    Math.max(0, index - radius),
    Math.min(userMessage.length, index + evidence.length + radius),
  )
}

const isFieldOnlyEvidence = (input: {
  evidence: unknown
  userMessage: unknown
}) => {
  const evidence = normalizeText(input.evidence)
  if (!evidence) {
    return false
  }
  if (hasFlowActionContext(evidence)) {
    return false
  }
  if (FIELD_ONLY_EVIDENCE_PATTERNS.some(pattern => pattern.test(evidence))) {
    return true
  }

  const context = getEvidenceContextWindow(input)
  if (hasFlowActionContext(context)) {
    return false
  }
  return FIELD_ONLY_CONTEXT_PATTERNS.some(pattern => pattern.test(context))
}

const evidenceAppearsInUserMessage = (input: {
  evidence: string
  userMessage: string
}) => {
  const evidence = normalizeComparableText(input.evidence)
  const userMessage = normalizeComparableText(input.userMessage)
  return Boolean(evidence && userMessage && userMessage.includes(evidence))
}

export const normalizeNocodeEditorFlowIntentSignal = (
  value: unknown,
): NocodeEditorFlowIntentSignal | null => {
  if (!isPlainObject(value)) {
    return null
  }

  const state = normalizeText(value.state) as NocodeEditorFlowIntentSignalState
  if (
    state !== 'explicit_positive'
    && state !== 'explicit_negative'
    && state !== 'none'
  ) {
    return null
  }

  const confidence = normalizeText(value.confidence) as NocodeEditorFlowIntentSignalConfidence
  if (
    confidence !== 'high'
    && confidence !== 'medium'
    && confidence !== 'low'
  ) {
    return null
  }

  return {
    state,
    confidence,
    evidence: uniqueTexts(Array.isArray(value.evidence) ? value.evidence : []),
    targetFormName: normalizeText(value.targetFormName) || undefined,
  }
}

export const resolveNocodeEditorFlowEntryIntentWithSignal = (input: {
  userMessage?: unknown
  activeFormName?: unknown
  modelSignal?: unknown
}): NocodeEditorFlowEntryIntent => {
  const fallbackIntent = resolveNocodeEditorFlowEntryIntent({
    userMessage: input.userMessage,
    activeFormName: input.activeFormName,
  })

  if (fallbackIntent.state === 'explicit_negative') {
    return fallbackIntent
  }

  const sourceUserMessage = normalizeText(input.userMessage)
  const activeFormName = normalizeText(input.activeFormName)
  const noneIntent: NocodeEditorFlowEntryIntent = {
    state: 'none',
    evidence: [],
    sourceUserMessage,
    targetFormName: activeFormName || undefined,
  }
  const modelSignal = normalizeNocodeEditorFlowIntentSignal(input.modelSignal)

  if (!modelSignal || modelSignal.confidence !== 'high') {
    return fallbackIntent.state === 'explicit_positive'
      ? fallbackIntent
      : noneIntent
  }

  const groundedEvidence = modelSignal.evidence.filter(evidence => (
    evidenceAppearsInUserMessage({ evidence, userMessage: sourceUserMessage })
    && !isFieldOnlyEvidence({ evidence, userMessage: sourceUserMessage })
  ))

  if (modelSignal.state === 'explicit_negative') {
    return groundedEvidence.length
      ? {
        state: 'explicit_negative',
        evidence: groundedEvidence,
        sourceUserMessage,
        targetFormName: modelSignal.targetFormName || activeFormName || undefined,
      }
      : noneIntent
  }

  if (modelSignal.state !== 'explicit_positive' || !groundedEvidence.length) {
    return noneIntent
  }

  return {
    state: 'explicit_positive',
    evidence: groundedEvidence,
    sourceUserMessage,
    targetFormName: modelSignal.targetFormName || activeFormName || undefined,
  }
}
