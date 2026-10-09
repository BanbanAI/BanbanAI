import { once } from 'node:events'
import http from 'node:http'
import type { AddressInfo, Socket } from 'node:net'

export const FIXTURE_MODES = [
  'first-event-timeout',
  'idle-timeout',
  'total-timeout',
  'buffer-overflow',
  'truncated-tool-call',
] as const

export type FixtureMode = typeof FIXTURE_MODES[number]

type FixtureLogger = Pick<Console, 'log' | 'error'>
type FixtureRequestPayload = {
  model?: unknown
  tools?: unknown
  stream_options?: {
    include_usage?: unknown
  }
}

type StartAiOpenAiStreamFixtureServerOptions = {
  keepAliveIntervalMs?: number
  logger?: FixtureLogger
  mode: FixtureMode
  port?: number
  totalEventIntervalMs?: number
}

type StartedAiOpenAiStreamFixtureServer = {
  close: () => Promise<void>
  host: string
  mode: FixtureMode
  port: number
  url: string
}

type SseWriter = {
  close: () => void
  done: () => void
  trackInterval: (callback: () => void, intervalMs: number) => NodeJS.Timeout
  writeComment: (comment?: string) => void
  writeData: (payload: Record<string, unknown>) => void
}

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_KEEP_ALIVE_INTERVAL_MS = 250
const DEFAULT_TOTAL_EVENT_INTERVAL_MS = 1000

const normalizeText = (value: unknown) => String(value ?? '').trim()

const isFixtureMode = (value: unknown): value is FixtureMode => (
  typeof value === 'string' && FIXTURE_MODES.includes(value as FixtureMode)
)

const normalizePositiveInteger = (
  value: unknown,
  fallback: number,
) => {
  const normalized = Number(value)
  return Number.isFinite(normalized) && normalized > 0
    ? Math.floor(normalized)
    : fallback
}

const parseJsonBody = async (req: http.IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const rawBuffer = Buffer.concat(chunks)
  const rawText = rawBuffer.toString('utf8')
  const payload = rawText
    ? JSON.parse(rawText) as FixtureRequestPayload
    : {}

  return {
    payload,
    rawText,
  }
}

const createChunkBase = (model: string) => ({
  id: 'chatcmpl_fixture_stream',
  object: 'chat.completion.chunk',
  created: Math.floor(Date.now() / 1000),
  model,
})

const createRoleChunk = (model: string) => ({
  ...createChunkBase(model),
  choices: [{
    index: 0,
    delta: {
      role: 'assistant',
    },
    finish_reason: null,
  }],
})

const createEmptyContentChunk = (model: string) => ({
  ...createChunkBase(model),
  choices: [{
    index: 0,
    delta: {
      content: '',
    },
    finish_reason: null,
  }],
})

const createToolCallChunk = (
  model: string,
  options: {
    argumentsText: string
    id?: string
    includeName?: boolean
  },
) => ({
  ...createChunkBase(model),
  choices: [{
    index: 0,
    delta: {
      tool_calls: [{
        index: 0,
        ...(options.id ? { id: options.id } : {}),
        type: 'function',
        function: {
          ...(options.includeName ? { name: 'fixture_tool' } : {}),
          arguments: options.argumentsText,
        },
      }],
    },
    finish_reason: null,
  }],
})

const createFinishChunk = (
  model: string,
  finishReason: 'length' | 'stop',
) => ({
  ...createChunkBase(model),
  choices: [{
    index: 0,
    delta: {},
    finish_reason: finishReason,
  }],
})

const createUsageChunk = (model: string) => ({
  ...createChunkBase(model),
  choices: [],
  usage: {
    prompt_tokens: 11,
    completion_tokens: 7,
    total_tokens: 18,
  },
})

const createBufferOverflowErrorPayload = () => ({
  error: {
    message: 'InternalError.Algo [Backend buffer overflow.]',
    type: 'server_error',
    code: 'backend_buffer_overflow',
  },
})

const createSseWriter = (res: http.ServerResponse): SseWriter => {
  let closed = false
  const timers = new Set<NodeJS.Timeout>()

  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  const clearTimers = () => {
    for (const timer of timers) {
      clearInterval(timer)
    }
    timers.clear()
  }

  const safeWrite = (chunk: string) => {
    if (closed || res.writableEnded || res.destroyed) {
      return
    }
    res.write(chunk)
  }

  const close = () => {
    if (closed) {
      return
    }
    closed = true
    clearTimers()
    if (!res.writableEnded && !res.destroyed) {
      res.end()
    }
  }

  res.once('close', close)

  return {
    close,
    done() {
      safeWrite('data: [DONE]\n\n')
      close()
    },
    trackInterval(callback, intervalMs) {
      const timer = setInterval(callback, intervalMs)
      timers.add(timer)
      return timer
    },
    writeComment(comment = 'keepalive') {
      safeWrite(`: ${ comment }\n\n`)
    },
    writeData(payload) {
      safeWrite(`data: ${ JSON.stringify(payload) }\n\n`)
    },
  }
}

const handleTimeoutStream = (
  writer: SseWriter,
  model: string,
  mode: Extract<FixtureMode, 'first-event-timeout' | 'idle-timeout' | 'total-timeout'>,
  options: {
    keepAliveIntervalMs: number
    totalEventIntervalMs: number
  },
) => {
  if (mode === 'idle-timeout') {
    writer.writeData(createRoleChunk(model))
    writer.writeData(createEmptyContentChunk(model))
    writer.trackInterval(() => {
      writer.writeComment()
    }, options.keepAliveIntervalMs)
    return
  }

  if (mode === 'total-timeout') {
    writer.writeData(createRoleChunk(model))
    writer.writeData(createEmptyContentChunk(model))
    writer.trackInterval(() => {
      writer.writeData(createEmptyContentChunk(model))
    }, options.totalEventIntervalMs)
    return
  }

  writer.trackInterval(() => {
    writer.writeComment()
  }, options.keepAliveIntervalMs)
}

const handleTruncatedToolCallStream = (
  writer: SseWriter,
  model: string,
  includeUsage: boolean,
) => {
  writer.writeData(createRoleChunk(model))
  writer.writeData(createToolCallChunk(model, {
    id: 'call_fixture_tool_1',
    includeName: true,
    argumentsText: '{"query":"继续生成',
  }))
  writer.writeData(createToolCallChunk(model, {
    argumentsText: '但工具调用被截断',
  }))
  writer.writeData(createFinishChunk(model, 'length'))
  if (includeUsage) {
    writer.writeData(createUsageChunk(model))
  }
  writer.done()
}

export const startAiOpenAiStreamFixtureServer = async (
  options: StartAiOpenAiStreamFixtureServerOptions,
): Promise<StartedAiOpenAiStreamFixtureServer> => {
  const host = DEFAULT_HOST
  const keepAliveIntervalMs = normalizePositiveInteger(
    options.keepAliveIntervalMs,
    DEFAULT_KEEP_ALIVE_INTERVAL_MS,
  )
  const totalEventIntervalMs = normalizePositiveInteger(
    options.totalEventIntervalMs,
    DEFAULT_TOTAL_EVENT_INTERVAL_MS,
  )
  const logger = options.logger || console
  const port = normalizePositiveInteger(options.port, 0)
  const sockets = new Set<Socket>()
  const activeWriters = new Set<SseWriter>()

  const server = http.createServer(async (req, res) => {
    try {
      const pathname = normalizeText(req.url).split('?')[0]
      if (
        req.method !== 'POST'
        || (pathname !== '/v1/chat/completions' && pathname !== '/chat/completions')
      ) {
        res.statusCode = 404
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({
          error: {
            message: 'Not found',
          },
        }))
        return
      }

      const { payload, rawText } = await parseJsonBody(req)
      const model = normalizeText(payload.model) || 'gpt-fixture'
      const toolsCount = Array.isArray(payload.tools) ? payload.tools.length : 0

      logger.log?.(
        `fixture-request mode=${ options.mode } model=${ model } bodyBytes=${ Buffer.byteLength(rawText, 'utf8') } tools=${ toolsCount }`,
      )

      if (options.mode === 'buffer-overflow') {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(createBufferOverflowErrorPayload()))
        return
      }

      const writer = createSseWriter(res)
      activeWriters.add(writer)
      res.once('close', () => {
        activeWriters.delete(writer)
      })

      if (options.mode === 'truncated-tool-call') {
        handleTruncatedToolCallStream(
          writer,
          model,
          payload.stream_options?.include_usage === true,
        )
        return
      }

      handleTimeoutStream(writer, model, options.mode, {
        keepAliveIntervalMs,
        totalEventIntervalMs,
      })
    } catch (error) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      }))
    }
  })

  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.setNoDelay(true)
    socket.setKeepAlive(true)
    socket.once('close', () => {
      sockets.delete(socket)
    })
  })

  server.listen(port, host)
  await once(server, 'listening')

  const address = server.address() as AddressInfo | null
  const resolvedPort = address?.port || port
  const url = `http://${ host }:${ resolvedPort }`
  logger.log?.(`fixture-listening mode=${ options.mode } url=${ url }`)

  return {
    close: async () => {
      for (const writer of activeWriters) {
        writer.close()
      }
      for (const socket of sockets) {
        socket.destroy()
      }
      if (server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.close(error => {
            if (error) {
              reject(error)
              return
            }
            resolve()
          })
        })
      }
    },
    host,
    mode: options.mode,
    port: resolvedPort,
    url,
  }
}

const parseCliArgs = (argv: string[]) => {
  let keepAliveIntervalMs = DEFAULT_KEEP_ALIVE_INTERVAL_MS
  let mode = ''
  let port = 18080
  let totalEventIntervalMs = DEFAULT_TOTAL_EVENT_INTERVAL_MS

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const nextValue = argv[index + 1]

    if (token === '--mode') {
      mode = normalizeText(nextValue)
      index += 1
      continue
    }
    if (token === '--port') {
      port = normalizePositiveInteger(nextValue, 18080)
      index += 1
      continue
    }
    if (token === '--keep-alive-interval-ms') {
      keepAliveIntervalMs = normalizePositiveInteger(
        nextValue,
        DEFAULT_KEEP_ALIVE_INTERVAL_MS,
      )
      index += 1
      continue
    }
    if (token === '--total-event-interval-ms') {
      totalEventIntervalMs = normalizePositiveInteger(
        nextValue,
        DEFAULT_TOTAL_EVENT_INTERVAL_MS,
      )
      index += 1
      continue
    }
  }

  if (!isFixtureMode(mode)) {
    throw new Error(`Unsupported mode: ${ mode || '(empty)' }`)
  }

  return {
    keepAliveIntervalMs,
    mode,
    port,
    totalEventIntervalMs,
  }
}

const runCli = async () => {
  let server: StartedAiOpenAiStreamFixtureServer | null = null

  try {
    const args = parseCliArgs(process.argv.slice(2))
    server = await startAiOpenAiStreamFixtureServer({
      ...args,
      logger: console,
    })

    const shutdown = async (signal: string) => {
      console.log(`fixture-shutdown signal=${ signal }`)
      if (server) {
        await server.close()
      }
      process.exit(0)
    }

    process.once('SIGINT', () => {
      void shutdown('SIGINT')
    })
    process.once('SIGTERM', () => {
      void shutdown('SIGTERM')
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

if (require.main === module) {
  void runCli()
}
