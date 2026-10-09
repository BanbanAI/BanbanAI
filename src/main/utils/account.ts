import { Account } from "@common/types/account"

export const getAccountId = (account: Account) => {
    return account?.id || '0'
  }

export const getAccountName = (account: Account) => {
  return account?.realname || account?.user || 'anonymous'
}