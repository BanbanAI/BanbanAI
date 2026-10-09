const DRAFT_ISSUE_OPEN_QUESTION_PREFIX = '字段《'
const DRAFT_ISSUE_OPEN_QUESTION_MARKER = '》需要补齐配置：'
const LEGACY_DRAFT_ISSUE_OPEN_QUESTION_PREFIX = '字段「'
const LEGACY_DRAFT_ISSUE_OPEN_QUESTION_MARKER = '」需要补齐配置：'

const normalizeQuestion = (question: unknown) => String(question || '').trim()

export const isNocodeEditorDraftIssueOpenQuestion = (question: unknown) => {
  const normalizedQuestion = normalizeQuestion(question)
  return (
    normalizedQuestion.startsWith(DRAFT_ISSUE_OPEN_QUESTION_PREFIX)
    && normalizedQuestion.includes(DRAFT_ISSUE_OPEN_QUESTION_MARKER)
  ) || (
    normalizedQuestion.startsWith(LEGACY_DRAFT_ISSUE_OPEN_QUESTION_PREFIX)
    && normalizedQuestion.includes(LEGACY_DRAFT_ISSUE_OPEN_QUESTION_MARKER)
  )
}

export const filterNocodeEditorDraftIssueOpenQuestions = (questions: unknown) => {
  if (!Array.isArray(questions)) {
    return []
  }

  return questions
    .map(item => normalizeQuestion(item))
    .filter(question => question && !isNocodeEditorDraftIssueOpenQuestion(question))
}

export const getNocodeEditorDraftIssueOpenQuestionParts = () => ({
  prefix: DRAFT_ISSUE_OPEN_QUESTION_PREFIX,
  marker: DRAFT_ISSUE_OPEN_QUESTION_MARKER,
})
