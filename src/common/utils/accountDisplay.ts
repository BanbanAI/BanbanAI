import type { Account, NocodeUser } from '@common/types/account'
import i18next from 'i18next'

const SYSTEM_ACCOUNT_DISPLAY_NAME_MAP: Record<string, string> = {
  get 'system:warmup'() { return i18next.t('accountDisplay.aiAssistant') },
}

const normalizeText = (value?: string | null) => String(value || '').trim()

export const resolveSystemAccountDisplayName = (accountId?: string | null, fallbackName?: string | null) => {
  const normalizedAccountId = normalizeText(accountId)
  const normalizedFallbackName = normalizeText(fallbackName)

  return SYSTEM_ACCOUNT_DISPLAY_NAME_MAP[normalizedAccountId]
    || SYSTEM_ACCOUNT_DISPLAY_NAME_MAP[normalizedFallbackName]
    || ''
}

export const resolveAccountDisplayName = (options?: {
  accountId?: string | null,
  accountName?: string | null,
  user?: Pick<Account | NocodeUser, 'realname' | 'user'> | null,
  fallbackName?: string | null,
  emptyText?: string | null,
}) => {
  const systemDisplayName = resolveSystemAccountDisplayName(options?.accountId, options?.accountName || options?.fallbackName)
  if (systemDisplayName) {
    return systemDisplayName
  }

  const userRealname = normalizeText(options?.user?.realname)
  if (userRealname) {
    return userRealname
  }

  const userName = normalizeText(options?.user?.user)
  if (userName) {
    return userName
  }

  const accountName = normalizeText(options?.accountName)
  if (accountName) {
    return accountName
  }

  const fallbackName = normalizeText(options?.fallbackName)
  if (fallbackName) {
    return fallbackName
  }

  const accountId = normalizeText(options?.accountId)
  if (accountId) {
    return accountId
  }

  return normalizeText(options?.emptyText) || '-'
}
