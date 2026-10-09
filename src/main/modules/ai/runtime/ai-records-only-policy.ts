export const AI_RECORDS_ONLY_CAPABILITY_PROMPT =
  '当前应用 AI 只支持表单记录查询和聚合统计，不支持文档正文阅读、制度条款解读或其他非记录型内容查询。'

export const AI_RECORDS_ONLY_DOCUMENT_VIEW_BOUNDARY =
  '文档视图按表单记录处理，不作为正文阅读入口。'

export const AI_RECORDS_ONLY_NON_RECORD_REDIRECT =
  '需要处理制度条款、帮助文档或其他非记录型内容时，应切换到独立内容问答能力。'

export const AI_RECORDS_ONLY_UNSUPPORTED_INTENT_RESPONSE =
  '当前应用 AI 不支持这类非记录型问题，并建议改为查询表单数据。'

export function buildRecordsOnlyUnsupportedIntentInstruction() {
  return `如果用户要求阅读制度条款、帮助文档正文、文档正文或其他非记录型内容，直接说明${AI_RECORDS_ONLY_UNSUPPORTED_INTENT_RESPONSE}`
}

export function buildRepeatedSearchUnsupportedIntentMessage(options?: {
  includeGetAppMemoryHint?: boolean
  includeDisambiguationHint?: boolean
}) {
  const recordsFollowup: string[] = []
  if (options?.includeGetAppMemoryHint) {
    recordsFollowup.push('改用 get_app_memory')
  }
  if (options?.includeDisambiguationHint) {
    recordsFollowup.push('补充新的区分线索')
  }

  return [
    '当前问题里已连续多次 search_apps 且候选未变化。继续用同一类搜索通常不会带来新增候选证据。',
    `如果这是制度条款、帮助文档正文、文档正文或其他非记录型内容，请直接说明${AI_RECORDS_ONLY_UNSUPPORTED_INTENT_RESPONSE}`,
    recordsFollowup.length ? `如果仍是记录查询，请${recordsFollowup.join('、')}。` : '',
  ].filter(Boolean).join(' ')
}
