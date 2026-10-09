import { Injectable } from '@nestjs/common';
import chineseDays from 'chinese-days';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const { isHoliday, isWorkday } = chineseDays;

const CHINA_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const CHINESE_CALENDAR_SUPPORTED_THROUGH = 2026;
export const CHINESE_CALENDAR_ID = 'CN@chinese-days-1.5.9';

type SupplementalCalendarYear = {
  complete?: boolean;
  holidays?: string[];
  workdays?: string[];
};

type SupplementalCalendar = {
  calendarId: string;
  source: string;
  years: Record<string, SupplementalCalendarYear>;
};

const CALENDAR_FILE_ENV = 'BANBAN_CHINESE_CALENDAR_FILE';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const loadSupplementalCalendar = (): SupplementalCalendar | undefined => {
  const configuredPath = process.env[CALENDAR_FILE_ENV];
  if (!configuredPath) return undefined;
  const filePath = resolve(configuredPath);
  if (!existsSync(filePath)) {
    throw new Error(`Chinese statutory calendar file is unavailable: ${filePath}`);
  }
  let parsed: Partial<SupplementalCalendar>;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<SupplementalCalendar>;
  } catch (error) {
    throw new Error(`Chinese statutory calendar file is invalid: ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed.calendarId || !parsed.source || !parsed.years || typeof parsed.years !== 'object') {
    throw new Error(`Chinese statutory calendar file is missing calendarId, source or years: ${filePath}`);
  }
  const years: Record<string, SupplementalCalendarYear> = {};
  for (const [year, value] of Object.entries(parsed.years)) {
    if (!/^\d{4}$/.test(year) || !value || typeof value !== 'object') {
      throw new Error(`Chinese statutory calendar year entry is invalid: ${year}`);
    }
    const holidays = Array.isArray(value.holidays) ? value.holidays : [];
    const workdays = Array.isArray(value.workdays) ? value.workdays : [];
    if ([...holidays, ...workdays].some(date => typeof date !== 'string' || !DATE_RE.test(date) || date.slice(0, 4) !== year)) {
      throw new Error(`Chinese statutory calendar dates are invalid for ${year}`);
    }
    years[year] = {
      complete: value.complete === true,
      holidays: [...new Set(holidays)],
      workdays: [...new Set(workdays)],
    };
  }
  return { calendarId: parsed.calendarId, source: parsed.source, years };
};

const toChinaDate = (date: Date | string) => {
  if (typeof date === 'string') return date;
  const parts = Object.fromEntries(CHINA_DATE_FORMATTER.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

@Injectable()
export class HolidayService {
  private readonly supplementalCalendar = loadSupplementalCalendar();

  /**
   * 判断某天是否是工作日（周一至周五，且非法定节假日，含调休）
   */
  getCalendarId(): string {
    return this.supplementalCalendar?.calendarId || CHINESE_CALENDAR_ID;
  }

  private getSupplementalDate(date: string) {
    const year = date.slice(0, 4);
    const data = this.supplementalCalendar?.years[year];
    if (!data) return undefined;
    return {
      yearData: data,
      holiday: data.holidays?.includes(date) === true,
      workday: data.workdays?.includes(date) === true,
    };
  }

  private assertCalendarCoverage(date: string) {
    const year = Number(date.slice(0, 4));
    if (!Number.isInteger(year) || year <= CHINESE_CALENDAR_SUPPORTED_THROUGH) return;
    const data = this.getSupplementalDate(date)?.yearData;
    if (data?.complete === true) return;
    const error = new Error(`Chinese statutory calendar data is unavailable for ${year}`) as Error & { code?: string };
    error.code = 'CALENDAR_DATA_UNAVAILABLE';
    throw error;
  }

  isWorkday(date: Date | string): boolean {
    const chinaDate = toChinaDate(date);
    this.assertCalendarCoverage(chinaDate);
    const supplemental = this.getSupplementalDate(chinaDate);
    if (supplemental?.workday) return true;
    if (supplemental?.holiday) return false;
    if (Number(chinaDate.slice(0, 4)) > CHINESE_CALENDAR_SUPPORTED_THROUGH) {
      const day = new Date(`${chinaDate}T00:00:00Z`).getUTCDay();
      return day !== 0 && day !== 6;
    }
    return isWorkday(chinaDate);
  }

  /**
   * 判断某天是否是节假日（包括周末 + 法定节假日）
   */
  isHoliday(date: Date | string): boolean {
    const chinaDate = toChinaDate(date);
    this.assertCalendarCoverage(chinaDate);
    const supplemental = this.getSupplementalDate(chinaDate);
    if (supplemental?.workday) return false;
    if (supplemental?.holiday) return true;
    if (Number(chinaDate.slice(0, 4)) > CHINESE_CALENDAR_SUPPORTED_THROUGH) {
      const day = new Date(`${chinaDate}T00:00:00Z`).getUTCDay();
      return day === 0 || day === 6;
    }
    return isHoliday(chinaDate);
  }

  /**
   * 获取下一个工作日（从给定日期的次日开始找）
   * @param from 起始日期（下一个工作日必须 > from）
   * @param maxDays 最大查找天数（防死循环，默认365天）
   */
  getNextWorkday(from: Date, maxDays = 365): Date {
    const next = new Date(from);
    next.setDate(next.getDate() + 1); // 从下一天开始

    for (let i = 0; i < maxDays; i++) {
      if (this.isWorkday(next)) {
        return next;
      }
      next.setDate(next.getDate() + 1);
    }

    throw new Error(`${global.i18next.t('holidayService.cannotFindIn')} ${maxDays} ${global.i18next.t('holidayService.nextWorkdayInDays')}`);
  }

  /**
   * 获取下一个节假日（从给定日期的次日开始找）
   * @param from 起始日期（下一个节假日必须 > from）
   * @param maxDays 最大查找天数（防死循环，默认365天）
   */
  getNextHoliday(from: Date, maxDays = 365): Date {
    const next = new Date(from);
    next.setDate(next.getDate() + 1); // 从下一天开始

    for (let i = 0; i < maxDays; i++) {
      if (this.isHoliday(next)) {
        return next;
      }
      next.setDate(next.getDate() + 1);
    }

    throw new Error(`${global.i18next.t('holidayService.cannotFindIn')} ${maxDays} ${global.i18next.t('holidayService.nextHolidayInDays')}`);
  }
}
