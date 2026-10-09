import i18next, { TOptions, TFunctionResult } from "i18next";

const isChineseLanguage = () => (
  (i18next.resolvedLanguage || i18next.language || "en").toLowerCase().startsWith("zh")
);

const punctuation = {
  zh: {
    colon: "：",
    leftParenthesis: "（",
    rightParenthesis: "）",
    comma: "，",
  },
  default: {
    colon: ":",
    leftParenthesis: "(",
    rightParenthesis: ")",
    comma: ",",
  },
} as const;

export const getI18nPunctuation = (type: keyof typeof punctuation.default) => (
  punctuation[isChineseLanguage() ? "zh" : "default"][type]
);

export const getI18nLabelColon = () => getI18nPunctuation("colon");

export const getI18nInstance = (id:string) => {
  return {
    t: (key:string | string[], option:TOptions={}):TFunctionResult => {
      const o = Object.assign({ns: id}, option);
      return i18next.t(key, o);
    },
    get language() {
      return i18next.language;
    },
    on: i18next.on.bind(i18next),
    off: i18next.off.bind(i18next),
  }
}
