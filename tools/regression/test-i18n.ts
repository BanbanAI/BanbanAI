import fs from 'node:fs'
import path from 'node:path'

import i18next from 'i18next'

const readLocaleResources = (locale: string) => JSON.parse(
  fs.readFileSync(path.resolve(__dirname, `../../src/locales/${locale}/lang.json`), 'utf8'),
)

/**
 * 回归脚本用真实语言包撑起主进程 i18next：
 * 断言的是用户最终看到的文案，而不是键名。
 */
export const initTestI18n = (locale = 'zh-CN') => {
  i18next.init({
    lng: locale,
    fallbackLng: locale,
    initImmediate: false,
    resources: {
      [locale]: { translation: readLocaleResources(locale) },
    },
  })
  ;(global as Record<string, unknown>).i18next = i18next
  return i18next
}
