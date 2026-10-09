import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import { CategoryAggregator, CategorySummary, SummaryYearFormat, SummaryYearMonthDayFormat, SummaryYearMonthFormat, SummaryYearQuarterFormat, SummaryYearWeekFormat } from "./type";
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(quarterOfYear);
dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);
dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat)

export const SUMMARY_TIME_FORMATTERS: Record<
  string,
  (d: dayjs.Dayjs) => string
> = {
  // ===== 年 =====
  [SummaryYearFormat.YYYY_Y]: d => d.format("YYYY年"),
  [SummaryYearFormat.YYYY]: d => d.format("YYYY"),
  [SummaryYearFormat.YY_Y]: d => d.format("YY年"),
  [SummaryYearFormat.YY]: d => d.format("YY"),

  // ===== 年-季度 =====
  [SummaryYearQuarterFormat.YYYY_Q]: d => d.format("YYYY年Q季度"),
  [SummaryYearQuarterFormat["YYYY/Q"]]: d => d.format("YYYY/Q季度"),
  [SummaryYearQuarterFormat["YY/Q"]]: d => d.format("YY/Q季度"),

  // ===== 年-月 =====
  [SummaryYearMonthFormat.YYYY_Y_MM_M]: d => d.format("YYYY年MM月"),
  [SummaryYearMonthFormat["YYYY/MM_M"]]: d => d.format("YYYY/MM月"),
  [SummaryYearMonthFormat["YYYY/MM"]]: d => d.format("YYYY/MM"),
  [SummaryYearMonthFormat["YY/MM"]]: d => d.format("YY/MM"),

  // ===== 年-周 =====
  [SummaryYearWeekFormat.YYYY_Y_WW_W]: d => d.format("YYYY年WW周"),
  [SummaryYearWeekFormat["YYYY/WW_W"]]: d => d.format("YYYY/WW周"),
  [SummaryYearWeekFormat["YY/WW_W"]]: d => d.format("YY/WW周"),

  // ===== 年-月-日 =====
  [SummaryYearMonthDayFormat.YYYY_Y_MM_M_DD_D]: d =>
    d.format("YYYY年MM月DD日"),
  [SummaryYearMonthDayFormat["YYYY/MM/DD"]]: d =>
    d.format("YYYY/MM/DD"),
  [SummaryYearMonthDayFormat["YY/MM/DD"]]: d =>
    d.format("YY/MM/DD"),
  [SummaryYearMonthDayFormat.MM_M_DD_D]: d =>
    d.format("MM月DD日"),
  [SummaryYearMonthDayFormat["MM/DD"]]: d =>
    d.format("MM/DD"),
};

export const TIME_CATEGORY_SUMMARIES: CategorySummary[] = [
  "year",
  "year-quarter",
  "year-month",
  "year-week",
  "year-month-day",
];

export const isTimeCategorySummary = (summary?: string | null): summary is CategorySummary => {
  return TIME_CATEGORY_SUMMARIES.includes(summary as CategorySummary);
}

const resolveTimeBucketStart = (value: dayjs.Dayjs, summary: CategorySummary) => {
  switch (summary) {
    case "year":
      return value.startOf("year");
    case "year-quarter":
      return value.startOf("quarter");
    case "year-month":
      return value.startOf("month");
    case "year-week": {
      const dayOfWeek = value.day();
      const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      return value.startOf("day").subtract(offset, "day");
    }
    case "year-month-day":
      return value.startOf("day");
    default:
      return value;
  }
}

const formatTimeBucketLabel = (start: dayjs.Dayjs, dim: { summary?: string | null, dataFormat?: string | null }) => {
  const dataFormat = String(dim?.dataFormat || "").trim();
  if (dataFormat && SUMMARY_TIME_FORMATTERS[dataFormat]) {
    return SUMMARY_TIME_FORMATTERS[dataFormat](start);
  }

  switch (dim.summary as CategorySummary) {
    case "year":
      return start.format("YYYY");
    case "year-quarter":
      return `${start.year()}-Q${start.quarter()}`;
    case "year-month":
      return start.format("YYYY-MM");
    case "year-week":
      return `${start.year()}-W${start.isoWeek()}`;
    case "year-month-day":
      return start.format("YYYY-MM-DD");
    default:
      return start.format();
  }
}

export const resolveTimeCategoryBucket = (
  rawValue: any,
  dim: { summary?: string | null, dataFormat?: string | null },
  field?: { meta?: { extra?: { format?: string } } } | null,
) => {
  if (rawValue == null || rawValue === "" || !isTimeCategorySummary(dim?.summary)) {
    return null;
  }

  const value = dayjs(rawValue, field?.meta?.extra?.format);
  if (!value.isValid()) {
    return null;
  }

  const start = resolveTimeBucketStart(value, dim.summary as CategorySummary);
  return {
    key: String(start.valueOf()),
    label: formatTimeBucketLabel(start, dim),
    startedAt: start.valueOf(),
  };
}

export const formatTimeCategoryLabelByStartedAt = (
  startedAt: number,
  dim: { summary?: string | null, dataFormat?: string | null },
) => {
  return formatTimeBucketLabel(dayjs(startedAt), dim);
}

export const getNextTimeCategoryStartedAt = (startedAt: number, summary: CategorySummary) => {
  const value = dayjs(startedAt);
  switch (summary) {
    case "year":
      return value.add(1, "year").valueOf();
    case "year-quarter":
      return value.add(1, "quarter").valueOf();
    case "year-month":
      return value.add(1, "month").valueOf();
    case "year-week":
      return value.add(1, "week").valueOf();
    case "year-month-day":
      return value.add(1, "day").valueOf();
    default:
      return startedAt;
  }
}

export const timeCategoryAggregator: CategoryAggregator = {
  getKey(rawValue, ctx) {
    if (rawValue == null || rawValue === "") {
      return "";
    }

    const bucket = resolveTimeCategoryBucket(rawValue, ctx.dim, ctx.field);
    if (bucket) {
      return bucket.label;
    }

    const d = dayjs(rawValue, ctx.field?.meta?.extra?.format);
    if (!d.isValid()) {
      return String(rawValue);
    }
    const summary = ctx.dim?.summary;

    switch (summary as CategorySummary) {
      case "year":
        return d.format("YYYY");

      case "year-quarter":
        return `${d.year()}-Q${d.quarter()}`;

      case "year-month":
        return d.format("YYYY-MM");

      case "year-week":
        return `${d.year()}-W${d.isoWeek()}`;

      case "year-month-day":
        return d.format("YYYY-MM-DD");

      default:
        return String(rawValue);
    }
  }
};

export const CATEGORY_AGGREGATORS: Record<
  CategorySummary,
  CategoryAggregator
> = {
  "year": timeCategoryAggregator,
  "year-quarter": timeCategoryAggregator,
  "year-month": timeCategoryAggregator,
  "year-week": timeCategoryAggregator,
  "year-month-day": timeCategoryAggregator,

  // 未来扩展
  // province: addressCategoryAggregator,
  // city: addressCategoryAggregator,
  // district: addressCategoryAggregator,
};
