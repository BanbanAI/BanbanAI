export type NocodeEditorFlowEntryIntentState = 'explicit_positive' | 'explicit_negative' | 'none'

export type NocodeEditorFlowEntryIntent = {
  state: NocodeEditorFlowEntryIntentState
  evidence: string[]
  sourceUserMessage: string
  targetFormName?: string
}

const normalizeText = (value: unknown) => String(value || '').replace(/\s+/g, ' ').trim()

const NEGATIVE_FLOW_PATTERNS = [
  /(不需要|不用|不要|无需)(审批流|审批流程|办理流程|流程)(?=$|[\s，。！？；、,.;!?])/u,
  /(不加|不要加|别加)(个|一个)?(审批流|审批流程|办理流程|流程|审批)(?=$|[\s，。！？；、,.;!?])/u,
  /(不需要|不用|不要|无需)审批(?=$|[\s，。！？；、,.;!?])/u,
  /(先不|暂不)(做|处理|配置)?(审批流|审批流程|办理流程|流程)(?=$|[\s，。！？；、,.;!?])/u,
  /不审批(?=$|[\s，。！？；、,.;!?])/u,
  /不走流程(?=$|[\s，。！？；、,.;!?])/u,
]
const NEUTRAL_FLOW_FIELD_PATTERNS = [
  /(字段|控件|列).{0,8}(包含|包括|带|带上).{0,8}审批(?=$|[\s，。！？；、,.;!?])/u,
  /(字段|控件|列).{0,8}(需要|还要|要)审批(?=$|[\s，。！？；、,.;!?])/u,
  /(审批状态|审批意见|审批时间|流程编号)(字段|列)?/u,
]
const EXPLICIT_POSITIVE_FLOW_PATTERNS = [
  /(需要有|要有|并带有|并带上|并带|带有|带上|带)(一个|个)?(审批流|审批流程|办理流程)(?=$|[\s，。！？；、,.;!?])/u,
]
const collectMatches = (text: string, patterns: RegExp[]) => (
  patterns.flatMap((pattern) => {
    const match = text.match(pattern)
    return match?.[0] ? [match[0]] : []
  })
)

export const resolveNocodeEditorFlowEntryIntent = (input: {
  userMessage?: unknown
  activeFormName?: unknown
}): NocodeEditorFlowEntryIntent => {
  const sourceUserMessage = normalizeText(input.userMessage)
  const targetFormName = normalizeText(input.activeFormName)

  if (!sourceUserMessage) {
    return {
      state: 'none',
      evidence: [],
      sourceUserMessage,
      ...(targetFormName ? { targetFormName } : {}),
    }
  }

  const negativeEvidence = collectMatches(sourceUserMessage, NEGATIVE_FLOW_PATTERNS)
  if (negativeEvidence.length) {
    return {
      state: 'explicit_negative',
      evidence: negativeEvidence,
      sourceUserMessage,
      ...(targetFormName ? { targetFormName } : {}),
    }
  }

  const neutralFieldEvidence = collectMatches(sourceUserMessage, NEUTRAL_FLOW_FIELD_PATTERNS)
  if (neutralFieldEvidence.length) {
    return {
      state: 'none',
      evidence: [],
      sourceUserMessage,
      ...(targetFormName ? { targetFormName } : {}),
    }
  }

  const positiveEvidence = collectMatches(sourceUserMessage, EXPLICIT_POSITIVE_FLOW_PATTERNS)
  if (positiveEvidence.length) {
    return {
      state: 'explicit_positive',
      evidence: positiveEvidence,
      sourceUserMessage,
      ...(targetFormName ? { targetFormName } : {}),
    }
  }

  return {
    state: 'none',
    evidence: [],
    sourceUserMessage,
    ...(targetFormName ? { targetFormName } : {}),
  }
}
