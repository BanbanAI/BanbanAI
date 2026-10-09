export type TableDatePrecision = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';
export const TABLE_DATE_VALUE_FORMAT = 'YYYY-MM-DD HH:mm:ss';
export const TABLE_TIME_VALUE_FORMAT = 'HH:mm:ss';

type DateFormatOption =
  | 'year'
  | 'yearrange'
  | 'month'
  | 'monthrange'
  | 'date'
  | 'daterange'
  | 'datetime'
  | 'datetimerange'
  | undefined;

type DatePickerField = {
  getOption?: (key: string) => any,
} | null | undefined;

type DateExtra = Record<string, any> | null | undefined;

const DISPLAY_FORMAT_MAP: Record<TableDatePrecision, string> = {
  year: 'YYYY',
  month: 'YYYY-MM',
  day: 'YYYY-MM-DD',
  hour: 'YYYY-MM-DD HH',
  minute: 'YYYY-MM-DD HH:mm',
  second: TABLE_DATE_VALUE_FORMAT,
};

const getDateFormatOption = (element?: DatePickerField, extra?: DateExtra): DateFormatOption => {
  return element?.getOption?.('date-format') || extra?.['date-format'];
};

const getTimePrecisionOption = (element?: DatePickerField, extra?: DateExtra) => {
  return element?.getOption?.('time-precision') || extra?.['time-precision'];
};

const inferTimePrecisionFromFormat = (format?: string): TableDatePrecision => {
  if (!format) {
    return 'second';
  }
  const formatWithoutMonthToken = format.replace(/M/g, '');
  if (/s/.test(formatWithoutMonthToken)) {
    return 'second';
  }
  if (/m/.test(formatWithoutMonthToken)) {
    return 'minute';
  }
  if (/[Hh]/.test(formatWithoutMonthToken)) {
    return 'hour';
  }
  return 'day';
};

const inferDatePrecisionFromFormat = (format?: string): TableDatePrecision => {
  if (!format) {
    return 'day';
  }
  const timePrecision = inferTimePrecisionFromFormat(format);
  if (timePrecision !== 'day') {
    return timePrecision;
  }
  if (/[Dd]/.test(format)) {
    return 'day';
  }
  if (/M/.test(format)) {
    return 'month';
  }
  return 'year';
};

export const getTableDatePrecision = (element?: DatePickerField, extra?: DateExtra): TableDatePrecision => {
  const dateFormat = getDateFormatOption(element, extra);
  switch (dateFormat) {
    case 'year':
    case 'yearrange':
      return 'year';
    case 'month':
    case 'monthrange':
      return 'month';
    case 'date':
    case 'daterange':
      return 'day';
    case 'datetime':
    case 'datetimerange': {
      const timePrecision = getTimePrecisionOption(element, extra);
      if (timePrecision === 'HH') {
        return 'hour';
      }
      if (timePrecision === 'HH:mm') {
        return 'minute';
      }
      return inferTimePrecisionFromFormat(extra?.format);
    }
    default:
      return inferDatePrecisionFromFormat(extra?.format);
  }
};

export const getTableDatePickerType = (element?: DatePickerField, extra?: DateExtra) => {
  const dateFormat = getDateFormatOption(element, extra);
  if (dateFormat === 'year' || dateFormat === 'yearrange') {
    return 'year';
  }
  if (dateFormat === 'month' || dateFormat === 'monthrange') {
    return 'month';
  }
  if (dateFormat === 'datetime' || dateFormat === 'datetimerange') {
    return 'datetime';
  }
  return 'date';
};

export const getTableDateRangePickerType = (element?: DatePickerField, extra?: DateExtra) => {
  const dateFormat = getDateFormatOption(element, extra);
  if (dateFormat === 'year' || dateFormat === 'yearrange') {
    return 'yearrange';
  }
  if (dateFormat === 'month' || dateFormat === 'monthrange') {
    return 'monthrange';
  }
  if (dateFormat === 'datetime' || dateFormat === 'datetimerange') {
    return 'datetimerange';
  }
  return 'daterange';
};

export const getTableDateDisplayFormat = (element?: DatePickerField, extra?: DateExtra) => {
  return extra?.format || DISPLAY_FORMAT_MAP[getTableDatePrecision(element, extra)];
};

export const getTableTimeDisplayFormat = (element?: DatePickerField, extra?: DateExtra) => {
  return getTimePrecisionOption(element, extra) || TABLE_TIME_VALUE_FORMAT;
};
