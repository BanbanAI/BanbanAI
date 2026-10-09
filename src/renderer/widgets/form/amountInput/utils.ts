import { CurrencyInfo } from "./types";

export const getCurrencyDict = (lang: string = 'zh-CN'): CurrencyInfo[] => {
  const currencyCodes = (Intl as any).supportedValuesOf('currency') as string[];
  const displayNames = new Intl.DisplayNames([lang], { type: 'currency' });

  const list = currencyCodes.map((code): CurrencyInfo => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    });

    const parts = formatter.formatToParts(0);
    const symbol = parts.find(p => p.type === 'currency')?.value || code;
    const precision = formatter.resolvedOptions().maximumFractionDigits ?? 2;

    return {
      label: displayNames.of(code) || code,
      value: code,
      symbol: symbol,
      precision: precision
    };
  });

  return list.sort((a, b) => {
    return a.label.localeCompare(b.label, lang);
  });
};