export const searchWebInputSchemaJson = {
  type: 'object',
  required: ['query'],
  properties: {
    query: { type: 'string' },
    topK: { type: 'number', default: 5 },
    provider: {
      type: 'string',
      enum: ['baidu', 'sogou', 'duckduckgo', 'tavily', 'searxng', 'serpapi'],
    },
    recencyDays: { type: 'number' },
    domains: {
      type: 'array',
      items: { type: 'string' },
    },
  },
} as const

export const fetchWebpageInputSchemaJson = {
  type: 'object',
  required: ['url'],
  properties: {
    url: { type: 'string' },
    extractMode: {
      type: 'string',
      enum: ['text', 'html', 'meta'],
      default: 'text',
    },
    maxChars: { type: 'number', default: 8000 },
  },
} as const
