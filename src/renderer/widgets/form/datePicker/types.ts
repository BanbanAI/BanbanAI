

export type DateValue = string | number | Date
export type DateRangeValue = [DateValue?, DateValue?]
export type DatePickerValue = DateValue | DateRangeValue;

export type DatePart = 'year' | 'month' | 'date' | 'datetime';
export enum DateStyle {
  ZH_CN = 'zh_cn',
  HYPHEN = 'hyphen',
  SLASH = 'slash',
  EN_SHORT = 'en_short',
  EN_LONG = 'en_long'
}
export type DatePartMap = Record<DateStyle, Record<DatePart, string>>;