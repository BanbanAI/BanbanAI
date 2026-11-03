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
  // 入口意图只表示“用户要不要流程”，不携带目标表单：当时打开的表单可能是上一轮留下的，
  // 把 activeFormName 当成目标会把旧表单的流程要求带到新表单上。目标由挂账在表单落地时确定。
  void input.activeFormName
  const buildIntent = (
    state: NocodeEditorFlowEntryIntentState,
    evidence: string[],
  ): NocodeEditorFlowEntryIntent => ({
    state,
    evidence,
    sourceUserMessage,
  })

  if (!sourceUserMessage) {
    return buildIntent('none', [])
  }

  const negativeEvidence = collectMatches(sourceUserMessage, NEGATIVE_FLOW_PATTERNS)
  if (negativeEvidence.length) {
    return buildIntent('explicit_negative', negativeEvidence)
  }

  const neutralFieldEvidence = collectMatches(sourceUserMessage, NEUTRAL_FLOW_FIELD_PATTERNS)
  if (neutralFieldEvidence.length) {
    return buildIntent('none', [])
  }

  const positiveEvidence = collectMatches(sourceUserMessage, EXPLICIT_POSITIVE_FLOW_PATTERNS)
  if (positiveEvidence.length) {
    return buildIntent('explicit_positive', positiveEvidence)
  }

  return buildIntent('none', [])
}
