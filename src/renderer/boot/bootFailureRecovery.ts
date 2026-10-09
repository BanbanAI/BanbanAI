const BOOT_DYNAMIC_IMPORT_RECOVERY_KEY = 'workbench.boot.dynamic-import-recovery-at'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type ConsumeRecoveryBudgetOptions = {
  now?: number
  ttlMs?: number
}

const DEFAULT_DYNAMIC_IMPORT_RECOVERY_TTL_MS = 15_000

const normalizeMessage = (error: unknown) => {
  if (error instanceof Error) {
    return String(error.message || '').trim()
  }
  return String(error || '').trim()
}

export const isDynamicImportBootFailure = (error: unknown) => {
  const message = normalizeMessage(error)
  return message.includes('Failed to fetch dynamically imported module')
}

const readRecoveryTimestamp = (storage: StorageLike) => {
  const raw = String(storage.getItem(BOOT_DYNAMIC_IMPORT_RECOVERY_KEY) || '').trim()
  if (!raw) {
    return null
  }
  const timestamp = Number(raw)
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null
}

export const consumeBootDynamicImportRecoveryBudget = (
  storage: StorageLike,
  options: ConsumeRecoveryBudgetOptions = {},
) => {
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now()
  const ttlMs = Number.isFinite(options.ttlMs) ? Number(options.ttlMs) : DEFAULT_DYNAMIC_IMPORT_RECOVERY_TTL_MS
  const previous = readRecoveryTimestamp(storage)

  if (previous !== null && now - previous < ttlMs) {
    return false
  }

  storage.setItem(BOOT_DYNAMIC_IMPORT_RECOVERY_KEY, String(now))
  return true
}

export const clearBootDynamicImportRecoveryBudget = (storage: StorageLike | null | undefined) => {
  if (!storage) {
    return
  }
  storage.removeItem(BOOT_DYNAMIC_IMPORT_RECOVERY_KEY)
}

export const shouldAutoRecoverFromBootFailure = (
  error: unknown,
  storage: StorageLike | null | undefined,
) => {
  if (!storage || !isDynamicImportBootFailure(error)) {
    return false
  }

  return consumeBootDynamicImportRecoveryBudget(storage)
}
