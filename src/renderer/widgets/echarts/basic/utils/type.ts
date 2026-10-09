import { OptionFieldValue } from "@renderer/b2/types";
import { Connection, Field, Row } from "@common/types/project";

export type CategorySummary =
  | "year"
  | "year-quarter"
  | "year-month"
  | "year-week"
  | "year-month-day"
  // 以后扩展

export enum SummaryYearFormat {
  YYYY_Y = "YYYY_Y",
  YYYY = "YYYY",
  YY_Y = "YY_Y",
  YY = "YY",
}
export enum SummaryYearQuarterFormat {
  YYYY_Q = "YYYY_Q",
  "YYYY/Q" = "YYYY/Q",
  "YY/Q" = "YY/Q",
}

export enum SummaryYearMonthFormat {
  YYYY_Y_MM_M = "YYYY_Y_MM_M",
  "YYYY/MM_M" = "YYYY/MM_M",
  "YYYY/MM" = "YYYY/MM",
  "YY/MM" = "YY/MM",
}

export enum SummaryYearWeekFormat {
  YYYY_Y_WW_W = "YYYY_Y_WW_W",
  "YYYY/WW_W" = "YYYY/WW_W",
  "YY/WW_W" = "YY/WW_W",
}

export enum SummaryYearMonthDayFormat {
  YYYY_Y_MM_M_DD_D = "YYYY_Y_MM_M_DD_D",
  "YYYY/MM/DD" = "YYYY/MM/DD",
  "YY/MM/DD" = "YY/MM/DD",
  MM_M_DD_D = "MM_M_DD_D",
  "MM/DD" = "MM/DD",
}

export type SummaryDataFormat = SummaryYearFormat | SummaryYearQuarterFormat | SummaryYearMonthFormat | SummaryYearWeekFormat | SummaryYearMonthDayFormat;

export type CategoryAggregateContext = {
  key: string;
  field: OptionFieldValue;
};

export interface CategoryAggregator {
  /**
   * 计算分类 key（决定分桶）
   */
  getKey(
    rawValue: any,
    ctx: {
      dim: OptionFieldValue;
      row: Row;
      field: Field;
    }
  ): string;
}