
export enum CurrencyType {
  CNY = "CNY",
  USD = "USD",
  EUR = "EUR"
}

export type AmountShowLang = "zh-CN" | "en-US" | "ja-JP";
export type AmountShowFormat = "simplified" | "traditional" | "fraction" | "cents" | "points" | "japanese";

export interface CurrencyInfo {
  label: string; // 货币名
  value: string; // 货币代码
  symbol: string; // 货币符号
  precision: number; // 小数位数精度
}

export type PrefixType = "currencySymbol" | "currencyCode" | "custom";
export type SuffixType = PrefixType;

export interface DisplayAmountOptions {
  isUppercase: boolean;
  currencyType: string;
  uppercaseLanguage: AmountShowLang;
  uppercaseShowFormat: AmountShowFormat | null;
  decimalPlaces?: number;
  thousandSeparator?: string;
  decimalSeparator?: string;
  prefix?: string;
  suffix?: string;
}