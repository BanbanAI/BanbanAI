export const resolveCurrentAiLanguage = () => (
  String(global.i18next?.resolvedLanguage || global.i18next?.language || 'zh-CN').trim() || 'zh-CN'
)

export const buildAiOutputLanguagePrompt = () => [
  `当前软件语言：${resolveCurrentAiLanguage()}。`,
  '用户可见内容的输出语言规则：',
  '系统提示词使用中文只用于表达内部规则，不代表必须使用中文回复；输出语言只按以下规则决定。',
  '1. 用户明确指定语言时，使用用户指定的语言。',
  '2. 用户当前输入明显使用某种语言时，跟随用户当前输入。',
  '3. 当前输入过短或无法判断时，沿用当前会话语言。',
  '4. 当前会话语言也无法判断时，使用当前软件语言。',
  '5. 本轮确定回复语言后，所有面向用户的自然语言内容必须使用同一种语言，包括普通回复以及工具调用中最终会展示给用户的标题、名称、说明和问题。',
  '6. 工具名、协议字段、枚举值以及已有的应用名、表单名、字段名和数据值保持原样，不因回复语言而翻译。',
].join('\n')
