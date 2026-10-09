export type OfficeRuntimeErrorCode =
  | 'office_plugin_unavailable'
  | 'office_service_start_failed'
  | 'office_conversion_failed'

export class OfficeRuntimeError extends Error {
  readonly code: OfficeRuntimeErrorCode

  constructor(code: OfficeRuntimeErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'OfficeRuntimeError'
    this.code = code
    if (cause !== undefined) {
      Object.assign(this, { cause })
    }
  }
}

export class OfficeStartupSingleFlight<T> {
  private pending: Promise<T> | null = null

  run(start: () => Promise<T>) {
    if (!this.pending) {
      this.pending = Promise.resolve()
        .then(start)
        .finally(() => {
          this.pending = null
        })
    }
    return this.pending
  }
}

type OfficeConversionRecoveryOptions<T> = {
  ensureRunning: () => Promise<void>
  isRunning: () => Promise<boolean>
  restart: () => Promise<void>
  convert: () => Promise<T>
  conversionErrorMessage: string
}

export async function runOfficeConversionWithRecovery<T>(
  options: OfficeConversionRecoveryOptions<T>,
) {
  await options.ensureRunning()

  try {
    return await options.convert()
  } catch (error) {
    if (await options.isRunning()) {
      throw new OfficeRuntimeError(
        'office_conversion_failed',
        options.conversionErrorMessage,
        error,
      )
    }
  }

  await options.restart()
  try {
    return await options.convert()
  } catch (error) {
    throw new OfficeRuntimeError(
      'office_conversion_failed',
      options.conversionErrorMessage,
      error,
    )
  }
}
