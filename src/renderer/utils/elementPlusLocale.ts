import type { Language } from "element-plus/es/locale";
import en from "element-plus/es/locale/lang/en";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import zhTw from "element-plus/es/locale/lang/zh-tw";
import i18next from "i18next";
import { shallowRef } from "vue";

const localeMap: Record<string, Language> = {
  en,
  zh: zhCn,
  "zh-hans": zhCn,
  "zh-cn": zhCn,
  "zh-sg": zhCn,
  "zh-hant": zhTw,
  "zh-tw": zhTw,
  "zh-hk": zhTw,
  "zh-mo": zhTw,
};

export const resolveElementPlusLocale = (language?: string): Language => {
  const normalizedLanguage = (language || "en").replace(/_/g, "-").toLowerCase();
  const languageParts = normalizedLanguage.split("-");
  const candidates = [
    normalizedLanguage,
    languageParts.length > 1 ? `${languageParts[0]}-${languageParts[1]}` : "",
    languageParts.length > 2 ? `${languageParts[0]}-${languageParts[languageParts.length - 1]}` : "",
    languageParts[0],
  ];
  return candidates.map((candidate) => localeMap[candidate]).find(Boolean) || en;
};

export const elementPlusLocale = shallowRef(
  resolveElementPlusLocale(i18next.resolvedLanguage || i18next.language),
);

i18next.on("languageChanged", (language) => {
  elementPlusLocale.value = resolveElementPlusLocale(language);
});
