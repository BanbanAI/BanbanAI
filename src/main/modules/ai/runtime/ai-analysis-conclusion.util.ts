const ANALYSIS_CONCLUSION_HEADING_PATTERN = /^(?:\*\*|__)?\s*分析结论\s*(?:\*\*|__)?\s*[：:]?\s*$/u
const STANDALONE_MARKDOWN_HEADING_PATTERN = /^(?:\*\*|__)\s*[^*_]+?\s*(?:\*\*|__)\s*[：:]?\s*$/u

export const stripMarkdownTablesForAnalysisConclusion = (markdown: string) => {
  return String(markdown || '')
    .replace(/(?:^|\n)\|.+\|\n\|(?:\s*:?-{3,}:?\s*\|)+\n(?:\|.*\|\n?)*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const normalizeAnalysisConclusionLine = (line: string) => {
  const normalizedLine = String(line || '')
    .trim()
    .replace(/^#{1,6}\s*/, '')
    .trim()

  if (!normalizedLine) {
    return ''
  }

  if (ANALYSIS_CONCLUSION_HEADING_PATTERN.test(normalizedLine)) {
    return ''
  }

  if (STANDALONE_MARKDOWN_HEADING_PATTERN.test(normalizedLine)) {
    return ''
  }

  return normalizedLine
    .replace(/^-\s*/, '')
    .replace(/^\*\s+/, '')
    .replace(/(\*\*|__)([^*_]+?)\1/g, '$2')
    .trim()
}

export const buildAnalysisConclusionItems = (markdown: string) => {
  return stripMarkdownTablesForAnalysisConclusion(markdown)
    .split(/\n+/)
    .map(line => normalizeAnalysisConclusionLine(line))
    .filter(Boolean)
    .slice(0, 4)
}
