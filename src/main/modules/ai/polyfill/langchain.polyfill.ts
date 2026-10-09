import {
  Blob as NodeBlob,
} from 'buffer'
import {
  ReadableStream as WebReadableStream,
  TransformStream as WebTransformStream,
  WritableStream as WebWritableStream,
} from 'stream/web'
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util'

type LangGraphRuntimeGlobals = typeof globalThis & {
  ReadableStream?: typeof WebReadableStream
  WritableStream?: typeof WebWritableStream
  TransformStream?: typeof WebTransformStream
  TextEncoder?: typeof NodeTextEncoder
  TextDecoder?: typeof NodeTextDecoder
  Blob?: typeof Blob
  File?: typeof File
  FormData?: typeof FormData
  fetch?: typeof fetch
  Headers?: typeof Headers
  Request?: typeof Request
  Response?: typeof Response
}

const runtime = globalThis as LangGraphRuntimeGlobals
const bufferModule = require('buffer') as typeof import('buffer') & {
  File?: typeof File
}

class FilePolyfill extends NodeBlob {
  readonly lastModified: number
  readonly name: string

  constructor(bits: Array<BlobPart>, name: string, options?: FilePropertyBag) {
    super(bits as any, options)
    this.name = String(name || '')
    this.lastModified = options?.lastModified || Date.now()
  }
}

// Older Node runtimes may lack these Web APIs.
// LangChain / OpenAI touches them during module load, so we patch them as early as possible.
if (typeof runtime.ReadableStream === 'undefined') {
  runtime.ReadableStream = WebReadableStream as unknown as LangGraphRuntimeGlobals['ReadableStream']
}

if (typeof runtime.WritableStream === 'undefined') {
  runtime.WritableStream = WebWritableStream as unknown as LangGraphRuntimeGlobals['WritableStream']
}

if (typeof runtime.TransformStream === 'undefined') {
  runtime.TransformStream = WebTransformStream as unknown as LangGraphRuntimeGlobals['TransformStream']
}

if (typeof runtime.TextEncoder === 'undefined') {
  runtime.TextEncoder = NodeTextEncoder as unknown as LangGraphRuntimeGlobals['TextEncoder']
}

if (typeof runtime.TextDecoder === 'undefined') {
  runtime.TextDecoder = NodeTextDecoder as unknown as LangGraphRuntimeGlobals['TextDecoder']
}

if (typeof runtime.Blob === 'undefined') {
  runtime.Blob = NodeBlob as unknown as LangGraphRuntimeGlobals['Blob']
}

if (typeof runtime.File === 'undefined') {
  runtime.File = (bufferModule.File || FilePolyfill) as unknown as LangGraphRuntimeGlobals['File']
}

if (typeof runtime.FormData === 'undefined') {
  const NodeFormData = require('form-data') as typeof import('form-data')
  runtime.FormData = NodeFormData as unknown as LangGraphRuntimeGlobals['FormData']
}

const abortSignalCtor = globalThis.AbortSignal as any
const abortControllerCtor = globalThis.AbortController as any

if (abortSignalCtor && abortControllerCtor && typeof abortSignalCtor.any !== 'function') {
  Object.defineProperty(abortSignalCtor, 'any', {
    configurable: true,
    writable: true,
    value(signals: AbortSignal[]) {
      const controller = new abortControllerCtor()
      const normalizedSignals = Array.isArray(signals) ? signals.filter(Boolean) : []

      if (normalizedSignals.length === 0) {
        return controller.signal
      }

      const cleanupCallbacks: Array<() => void> = []

      const abortFrom = (signal: AbortSignal) => {
        for (const cleanup of cleanupCallbacks) {
          cleanup()
        }

        const reason = (signal as any).reason
        if (reason !== undefined) {
          controller.abort(reason)
          return
        }
        controller.abort()
      }

      for (const signal of normalizedSignals) {
        if (signal.aborted) {
          abortFrom(signal)
          return controller.signal
        }

        const onAbort = () => abortFrom(signal)
        signal.addEventListener('abort', onAbort, { once: true })
        cleanupCallbacks.push(() => signal.removeEventListener('abort', onAbort))
      }

      return controller.signal as AbortSignal
    },
  })
}

if (abortSignalCtor && abortControllerCtor && typeof abortSignalCtor.timeout !== 'function') {
  Object.defineProperty(abortSignalCtor, 'timeout', {
    configurable: true,
    writable: true,
    value(milliseconds: number) {
      const controller = new abortControllerCtor()
      const timeout = Math.max(0, Number(milliseconds) || 0)
      const timer = setTimeout(() => {
        const error = new Error(`The operation was aborted after ${timeout} ms`)
        ;(error as any).name = 'TimeoutError'
        controller.abort(error)
      }, timeout)

      controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
      return controller.signal
    },
  })
}

if (
  typeof runtime.fetch === 'undefined'
  || typeof runtime.Headers === 'undefined'
  || typeof runtime.Request === 'undefined'
  || typeof runtime.Response === 'undefined'
) {
  const nodeFetch = require('node-fetch') as typeof import('node-fetch')

  runtime.fetch = runtime.fetch || (nodeFetch as unknown as typeof fetch)
  runtime.Headers = runtime.Headers || (nodeFetch.Headers as unknown as typeof Headers)
  runtime.Request = runtime.Request || (nodeFetch.Request as unknown as typeof Request)
  runtime.Response = runtime.Response || (nodeFetch.Response as unknown as typeof Response)
}
