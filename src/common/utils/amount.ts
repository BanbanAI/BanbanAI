
import { CurrencyInfo, AmountShowFormat, DisplayAmountOptions, NumberFormatOptions } from "@common/types/nocode";
import nzh from "nzh";
import { toWords } from "number-to-words";
import { fixFloat } from "@common/utils/math";

/**
 * 将数字金额转换为对应语言的大写金额
 * @param num 金额数字
 * @param currencyCode 货币代码 ('CNY', 'USD', ...)
 * @param lang 目标语言 ('zh-CN'/'en-US'/'ja-JP')
 * @param format 格式
 * @returns 转换后的大写字符串
 */
export const convertAmountToUppercase = (
  num: number,
  currencyCode: string,
  lang: string = 'en-US',
  format: AmountShowFormat = 'fraction'
): string => {
  if (num === null || num === undefined || isNaN(num)) return '';

  // 中文
  if (lang === 'zh-CN' || lang === 'zh') {

    const nzhObj = format === 'traditional' ? nzh.hk : nzh.cn;
    let amountStr = nzhObj.toMoney(num, { outSymbol: false });
    if (amountStr?.endsWith('整')) {
      amountStr = amountStr.slice(0, -1);
    }
    return amountStr;
  }
  
  // 日文
  else if (lang === 'ja-JP' || lang === 'ja') {
    const absNum = Math.abs(num);
    const intPart = Math.floor(absNum);
    const decPart = Math.round((absNum - intPart) * 100);

    // 转换函数：将数字转为日文大写格式
    const toJpKanji = (n: number) => {
      let cnText = nzh.cn.encodeB(n);
      
      const map: Record<string, string> = {
        '壹': '壱',
        '贰': '弐',
        '叁': '参',
        '肆': '四',
        '伍': '五',
        '陆': '六',
        '柒': '七',
        '捌': '八',
        '玖': '九',
        '拾': '拾',
        '佰': '佰',
        '仟': '阡',
        '万': '萬',
        '亿': '億'
      };
      
      return cnText.split('').map((char: string) => map[char] || char).join('');
    };

    let majorUnit = '';
    if (currencyCode === 'JPY') {
      majorUnit = '円';
    } else {
      try {
        majorUnit = new Intl.DisplayNames(['ja-JP'], { type: 'currency' }).of(currencyCode) || currencyCode;
      } catch (e) {
        majorUnit = currencyCode;
      }
    }

    let minorUnit = 'セント'; // 默认外币辅币
    if (currencyCode === 'JPY') minorUnit = ''; // 日元不显示辅币
    if (currencyCode === 'CNY') minorUnit = '分';

    let result = toJpKanji(intPart) + majorUnit;

    // 日元忽略小数部分
    if (currencyCode !== 'JPY' && decPart > 0) {
      result += toJpKanji(decPart) + minorUnit;
    }

    return result;
  }

  // 英文
  else {
    const isNegative = num < 0;
    const absNum = Math.abs(num);
    const integerPart = Math.floor(absNum);
    const decimalPart = Math.round((absNum - integerPart) * 100);

    // 处理单复数
    let currencyName = currencyCode;
    try {
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        currencyDisplay: 'name',
      });

      const parts = formatter.formatToParts(integerPart);
      const currencyPart = parts.find(part => part.type === 'currency');
      
      if (currencyPart) {
        currencyName = currencyPart.value;
      }
    } catch (e) {
      currencyName = currencyCode;
    }
    
    currencyName = currencyName.toUpperCase();
    

    let integerWords = toWords(integerPart).toUpperCase();
    if (isNegative) {
      integerWords = "MINUS " + integerWords;
    }

    let result = `${currencyName} ${integerWords}`;

    switch (format) {
      // 美分
      case 'cents': {
        if (decimalPart === 0) {
          return `${result}`;
        }
        const centsWords = toWords(decimalPart).toUpperCase();
        return `${result} AND ${centsWords} CENTS`;
      }
      // 美点
      case 'points': {
        if (decimalPart === 0) {
          return `${result}`;
        }

        const decimalStr = decimalPart < 10 ? `0${decimalPart}` : `${decimalPart}`;
        const digitMap: Record<string, string> = {
          '0': 'ZERO', '1': 'ONE', '2': 'TWO', '3': 'THREE', '4': 'FOUR',
          '5': 'FIVE', '6': 'SIX', '7': 'SEVEN', '8': 'EIGHT', '9': 'NINE'
        };
        const pointWords = decimalStr.split('').map(d => digitMap[d]).join(' ');

        return `${result} AND POINT ${pointWords}`;
      }
      // 分数
      case 'fraction':
      default: {
        if (decimalPart === 0) {
          return `${result}`;
        }
        return `${result} AND ${decimalPart}/100`;
      }
    }
  }
};

export const truncateNumber = (num: number, decimalPlaces = 0): number => {
  if (!Number.isFinite(num)) return num;

  const factor = 10 ** decimalPlaces;
  const sign = num < 0 ? -1 : 1;
  const scaled = fixFloat(Math.abs(num) * factor);
  return (Math.floor(scaled) / factor) * sign;
};

/**
 * 将数字格式化为千分符字符串
 */
export const formatNumberWithSeparator = (
  num: number | string,
  {
    decimalPlaces = 0,
    thousandSeparator = ',',
    decimalSeparator = '.',
    decimalPadding = false
  }: NumberFormatOptions = {}
): string => {
  if (num === null || num === undefined || num === '') return '';
  const n = Number(num);
  if (Number.isNaN(n)) return '';
  const separatorValue = thousandSeparator as unknown;
  const normalizedThousandSeparator = separatorValue === true
    ? ','
    : separatorValue === false
      ? ''
      : separatorValue as string;

  let str = n.toFixed(decimalPlaces);

  if (!decimalPadding && decimalPlaces > 0) {
    str = str.replace(/\.?0+$/, '');
  }

  if (!normalizedThousandSeparator || decimalSeparator === normalizedThousandSeparator) {
    return str.replace('.', decimalSeparator);
  }

  // 处理千分符
  const parts = str.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, normalizedThousandSeparator);
  str = parts.join(decimalSeparator);
  return str;
};

/**
 * 获取用于页面显示的完整金额字符串
 */
export const getDisplayAmount = (
  value: number,
  options: DisplayAmountOptions
): string => {
  if (value === null || value === undefined) return '';
  const prefix = options.prefix ?? '';
  const suffix = options.suffix ?? '';
  const decimalPlaces = options.decimalPlaces ?? 2;
  const decimalPadding = options.decimalPadding ?? false;
  const thousandSeparator = options.thousandSeparator ?? ',';
  const decimalSeparator = options.decimalSeparator ?? '.';

  const numValue = Number(value);
  if (Number.isNaN(numValue)) return '';

  const isNegative = numValue < 0;
  const absValue = Math.abs(numValue);

  // 处理千分符和小数
  let formattedNum
  if (options.isUppercase) {
    formattedNum = convertAmountToUppercase(
      numValue,
      options.currencyType,
      options.uppercaseLanguage,
      options.uppercaseShowFormat as any
    );
  } else {
    formattedNum = formatNumberWithSeparator(
      absValue,
      {
        decimalPlaces,
        decimalPadding,
        thousandSeparator,
        decimalSeparator
      }
    );
  }

  // 负号需要显示在最前面
  return `${isNegative ? '-' : ''}${prefix}${formattedNum}${suffix}`;
};
