import type { Language } from "element-plus/es/locale";
import en from "element-plus/es/locale/lang/en";
import ja from "element-plus/es/locale/lang/ja";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import zhTw from "element-plus/es/locale/lang/zh-tw";
import { shallowRef } from "vue";
import i18next from "@renderer/widgets/i18next";

type WidgetI18n = typeof i18next & {
  resolvedLanguage?: string;
  on?: (event: "languageChanged", listener: (language: string) => void) => void;
};

const localeMap: Record<string, Language> = {
  en,
  ja,
  zh: zhCn,
  "zh-cn": zhCn,
  "zh-sg": zhCn,
  "zh-tw": zhTw,
  "zh-hk": zhTw,
  "zh-mo": zhTw,
};

export const resolveElementPlusLocale = (language?: string): Language => {
  const normalizedLanguage = (language || "en").replace("_", "-").toLowerCase();
  return localeMap[normalizedLanguage] || localeMap[normalizedLanguage.split("-")[0]] || en;
};

const i18nInstance = i18next as WidgetI18n;

export const elementPlusLocale = shallowRef(
  resolveElementPlusLocale(i18nInstance.resolvedLanguage || i18nInstance.language),
);

i18nInstance.on?.("languageChanged", (language) => {
  elementPlusLocale.value = resolveElementPlusLocale(language);
});
