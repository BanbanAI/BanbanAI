import type { NocodeEditorAiArtifactBlock } from './types'

const normalizeText = (value: unknown) => (
  value == null ? '' : String(value).trim()
)

const resolveBlueprintConfirmationQuestions = (
  block?: NocodeEditorAiArtifactBlock | null,
) => {
  const confirmation = block?.confirmation
  if (confirmation && Array.isArray(confirmation.questions)) {
    return confirmation.questions.flatMap((question) => {
      const title = normalizeText(question?.title)
      if (!title) {
        return []
      }

      return [{
        title,
        description: normalizeText(question?.description),
      }]
    })
  }

  const openQuestions = Array.isArray(block?.blueprint?.openQuestions)
    ? block.blueprint.openQuestions
      .map(item => normalizeText(item))
      .filter(Boolean)
    : []

  return openQuestions.map((title) => ({
    title,
    description: '',
  }))
}

const buildQuestionPromptLines = (
  questions: ReturnType<typeof resolveBlueprintConfirmationQuestions>,
) => (
  questions.flatMap((question, index) => {
    const lines = [`${index + 1}. ${question.title}`]
    const description = normalizeText(question.description)
    if (description) {
      lines.push(`   说明：${description}`)
    }
    return lines
  })
)

export const buildBlueprintAdjustmentPrompt = (block?: NocodeEditorAiArtifactBlock | null) => {
  if (!block || block.kind !== 'blueprint' || !block.blueprint) {
    return [
      '继续调整当前蓝图。',
      '',
      '请保持最小改动，并优先处理还没有确认的问题。',
    ].join('\n')
  }

  const blueprint = block.blueprint
  const formNames = Array.isArray(blueprint.forms)
    ? blueprint.forms
      .map(form => String(form?.tableName || '').trim())
      .filter(Boolean)
    : []
  const questions = resolveBlueprintConfirmationQuestions(block)
  const questionLines = buildQuestionPromptLines(questions)
  const questionCount = questions.length
  const title = String(block.title || blueprint.title || formNames[0] || '当前蓝图').trim() || '当前蓝图'

  if (!questionCount) {
    return [
      `继续调整蓝图“${title}”。`,
      '',
      '请基于现有结构继续优化以下内容：',
      '- 字段分组',
      '- 字段类型',
      '- 字段说明',
      '- 关系字段设计',
      '',
      '保持最小改动，只调整真正需要优化的部分。',
    ].join('\n')
  }

  const replyHint = Array.from({ length: questionCount }, (_, index) => String(index + 1)).join('/')

  return [
    `继续调整蓝图“${title}”。`,
    '',
    `这份蓝图还有 ${questionCount} 个需要确认的点，请逐项回复：`,
    '',
    ...questionLines,
    '',
    `你可以直接按“${replyHint}”逐项回复。`,
    '如果这些确认会影响字段类型、关系字段或字段分组，我会一起更新到蓝图里。',
  ].join('\n')
}
