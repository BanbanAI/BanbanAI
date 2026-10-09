import type {
  AiDefaultFormulaContext,
  AiDefaultFormulaTargetContext,
  AiEditorSettingTargetContext,
  AiEditorTaskContext,
  AiEditorSettingContext,
  AiScenePayload,
} from '../ai.types'

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeDefaultFormulaFieldLine = (
  field: AiDefaultFormulaContext['fieldList'][number],
) => {
  const parts = [
    field.token,
    field.title,
    field.valueType,
    field.sourceType,
  ]
  if (field.disabled) {
    parts.push(`disabled=true${field.disabledReason ? `(${field.disabledReason})` : ''}`)
  }
  return `- ${parts.filter(Boolean).join(' | ')}`
}

const normalizeDefaultFormulaFunctionLine = (
  formula: AiDefaultFormulaContext['formulaList'][number],
) => {
  const parts = [
    formula.name,
    formula.category,
    formula.kind,
    normalizeText(formula.usage),
    normalizeText(formula.defaultArgTail),
    normalizeText(formula.summary),
  ].filter(Boolean)
  return `- ${parts.join(' | ')}`
}

const buildDefaultFormulaTaskContextPrompt = (context: AiDefaultFormulaContext) => {
  const ruleLines = Array.isArray(context.rules)
    ? context.rules
      .map(item => normalizeText(item))
      .filter(Boolean)
      .map(item => `- ${item}`)
    : []
  const fieldLines = Array.isArray(context.fieldList)
    ? context.fieldList.map(item => normalizeDefaultFormulaFieldLine(item))
    : []
  const formulaLines = Array.isArray(context.formulaList)
    ? context.formulaList.map(item => normalizeDefaultFormulaFunctionLine(item))
      : []

  return [
    '指定任务上下文：默认值公式生成。',
    `目标组件：${normalizeText(context.widgetTitle) || normalizeText(context.widgetId) || '未命名组件'}`,
    `当前公式：${normalizeText(context.currentFormula) || '空'}`,
    ruleLines.length
      ? `生成规则：\n${ruleLines.join('\n')}`
      : '',
    fieldLines.length
      ? `可用字段：\n${fieldLines.join('\n')}`
      : '',
    formulaLines.length
      ? `可用函数：\n${formulaLines.join('\n')}`
      : '',
    '生成公式时只能使用这里提供的字段 token 和函数；字段引用必须完整保留可用字段中的 [[字段token,字段标题]] 形式，不要只使用 token/id。',
    '不要引用 disabled=true 的字段。',
    'kind=column 的函数只在整列计算时使用。',
    'kind=context 的函数依赖运行时上下文，没有明确需要时不要优先使用。',
    '如果用户要你生成或修改默认值公式，先判断用户说的目标字段是否存在于当前表单。',
    '如果用户明确提到了别的目标字段，且该字段存在，就优先修改那个字段，不要默认修改当前弹窗里的字段。',
    '如果用户没有明确提到目标字段，或你无法从用户文本中稳定识别出目标字段，再把当前设置目标上下文中的字段当作默认目标。',
    '如果用户提到的目标字段在当前表单中不存在，要明确告诉用户没有找到目标字段；只有在用户没有明确指定目标字段时，才允许回退到当前设置目标上下文。',
    '如果要修改字段设置，先读取当前表单摘要确认目标字段，再读取该字段的可写设置结构，然后再写入设置。',
  ].filter(Boolean).join('\n')
}

const buildDefaultFormulaSettingTargetContextPrompt = (context: AiDefaultFormulaTargetContext) => {
  return [
    '当前设置目标上下文：',
    `当前界面正在配置的字段：${normalizeText(context.widgetTitle) || normalizeText(context.widgetId) || '未命名组件'}`,
    '只有在用户消息里没有明确指出要生成或修改哪个字段的默认值公式时，才可以把这里的字段作为默认目标。',
  ].filter(Boolean).join('\n')
}

const isDefaultFormulaContext = (value: AiEditorSettingContext): value is AiDefaultFormulaContext => (
  Boolean(value) && value.type === 'default-formula'
)

const isDefaultFormulaTaskContext = (value: AiEditorTaskContext): value is AiDefaultFormulaContext => (
  Boolean(value) && value.type === 'default-formula'
)

const isDefaultFormulaSettingTargetContext = (value: AiEditorSettingTargetContext): value is AiDefaultFormulaTargetContext => (
  Boolean(value) && value.type === 'default-formula-target'
)

export const buildNocodeEditorSettingContextPrompt = (input: {
  scenePayload?: AiScenePayload
  metadata?: Record<string, any>
}) => {
  const promptParts: string[] = []

  if (input.scenePayload?.taskContextType === 'default-formula') {
    const taskContext = (input.metadata?.editorTaskContext || null) as AiEditorTaskContext
    if (isDefaultFormulaTaskContext(taskContext)) {
      promptParts.push(buildDefaultFormulaTaskContextPrompt(taskContext))
    }
  }

  if (input.scenePayload?.settingTargetContextType === 'default-formula-target') {
    const settingTargetContext = (input.metadata?.editorSettingTargetContext || null) as AiEditorSettingTargetContext
    if (isDefaultFormulaSettingTargetContext(settingTargetContext)) {
      promptParts.push(buildDefaultFormulaSettingTargetContextPrompt(settingTargetContext))
    }
  }

  if (promptParts.length) {
    return promptParts.join('\n')
  }

  const context = (input.metadata?.editorSettingContext || null) as AiEditorSettingContext
  if (input.scenePayload?.settingContextType !== 'default-formula') {
    return ''
  }
  if (!isDefaultFormulaContext(context)) {
    return ''
  }

  return buildDefaultFormulaTaskContextPrompt(context)
}
