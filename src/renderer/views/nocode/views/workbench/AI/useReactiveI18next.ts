import i18next from 'i18next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

type LocaleDefaults = {
  zhCN: string
  zhTW: string
  en: string
}

export const useReactiveI18next = () => {
  const languageVersion = ref(0)

  const handleLanguageChanged = () => {
    languageVersion.value += 1
  }

  onMounted(() => {
    i18next.on('languageChanged', handleLanguageChanged)
  })

  onBeforeUnmount(() => {
    i18next.off('languageChanged', handleLanguageChanged)
  })

  const resolveLocaleDefault = (defaults: LocaleDefaults) => {
    void languageVersion.value
    const language = String(i18next.language || '').toLowerCase()

    if (language.startsWith('zh-tw') || language.startsWith('zh-hk')) {
      return defaults.zhTW
    }
    if (language.startsWith('en')) {
      return defaults.en
    }

    return defaults.zhCN
  }

  const translateText = (key: string, defaults: LocaleDefaults | string) => {
    void languageVersion.value
    const defaultValue = typeof defaults === 'string'
      ? defaults
      : resolveLocaleDefault(defaults)

    return i18next.t(key, { defaultValue })
  }

  const translate = (key: string, defaults?: LocaleDefaults) => computed(() => {
    void languageVersion.value
    return defaults ? translateText(key, defaults) : i18next.t(key)
  })

  return {
    translate,
    translateText,
  }
}
