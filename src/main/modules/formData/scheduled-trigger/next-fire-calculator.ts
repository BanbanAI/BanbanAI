import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import {
  TimeTaskDatePoint,
  TimeTaskDateType,
  TimeTaskMethod,
  TimeTaskRepeat,
} from '@common/types/project'
import { CompiledSchedule } from './schedule-compiler'

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(customParseFormat)

export type ScheduleCalendar = {
  isWorkday(localDate: string): boolean
  isHoliday(localDate: string): boolean
}

export type NextFireResult = {
  nextFireAt?: Date
  reason?: 'END_DATE_REACHED' | 'INVALID_TRIGGER_DATE' | 'INVALID_START_DATE' | 'INVALID_END_DATE' | 'CALENDAR_REQUIRED' | 'CALENDAR_DATA_UNAVAILABLE' | 'COMPLETED'
}

export type CalculateNextFireInput = {
  schedule: CompiledSchedule
  activationAt: Date
  lastScheduledFor?: Date
  recordDates?: Record<string, unknown>
  calendar?: ScheduleCalendar
  /** Used by the incremental projection when a record date is changed to the past. */
  allowPastDue?: boolean
}

export type CalculateLatestDueInput = CalculateNextFireInput & { now: Date }

const DATE_FORMAT = 'YYYY-MM-DD'
const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm'
const MAX_ADVANCE_STEPS = 100_000

const parseLocalDate = (value: unknown, timeZone: string): string | undefined => {
  if (value instanceof Date) {
    return dayjs(value).tz(timeZone).format(DATE_FORMAT)
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return dayjs(value).tz(timeZone).format(DATE_FORMAT)
  }
  if (typeof value !== 'string' || !value) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return dayjs(value, DATE_FORMAT, true).isValid() ? value : undefined
  }
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.tz(timeZone).format(DATE_FORMAT) : undefined
}

const addDays = (date: string, days: number) => dayjs(date, DATE_FORMAT, true).add(days, 'day').format(DATE_FORMAT)

const addMonthsClamped = (date: string, months: number) => {
  const source = dayjs(date, DATE_FORMAT, true)
  const target = source.startOf('month').add(months, 'month')
  return target.date(Math.min(source.date(), target.daysInMonth())).format(DATE_FORMAT)
}

const atTriggerTime = (date: string, time: string, timeZone: string) => {
  return dayjs.tz(`${date} ${time}`, DATE_TIME_FORMAT, timeZone).toDate()
}

const resolveBoundary = (
  boundary: CompiledSchedule['startDate'] | CompiledSchedule['endDate'],
  recordDates: Record<string, unknown>,
  timeZone: string,
): string | undefined => {
  if (boundary.type === TimeTaskDateType.NONE) return undefined
  if (boundary.type === TimeTaskDateType.CUSTOM) return parseLocalDate(boundary.value, timeZone)
  return parseLocalDate(recordDates[boundary.value || ''], timeZone)
}

const requiresCalendar = (repeat: TimeTaskRepeat) => {
  return repeat === TimeTaskRepeat.EVERY_WORK_DAY || repeat === TimeTaskRepeat.EVERY_HOLIDAY
}

const isEligibleDate = (date: string, repeat: TimeTaskRepeat, calendar?: ScheduleCalendar) => {
  if (repeat === TimeTaskRepeat.EVERY_WORK_DAY_OF_WEEK) {
    const day = dayjs(date, DATE_FORMAT, true).day()
    return day >= 1 && day <= 5
  }
  if (repeat === TimeTaskRepeat.EVERY_WORK_DAY) return calendar?.isWorkday(date) ?? false
  if (repeat === TimeTaskRepeat.EVERY_HOLIDAY) return calendar?.isHoliday(date) ?? false
  return true
}

const isCalendarDataUnavailableError = (error: unknown) => (
  Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'CALENDAR_DATA_UNAVAILABLE')
)

const dateAtOccurrence = (date: string, repeat: TimeTaskRepeat, occurrence: number) => {
  switch (repeat) {
  case TimeTaskRepeat.EVERY_DAY:
  case TimeTaskRepeat.EVERY_WORK_DAY:
  case TimeTaskRepeat.EVERY_HOLIDAY:
  case TimeTaskRepeat.EVERY_WORK_DAY_OF_WEEK:
    return addDays(date, occurrence)
  case TimeTaskRepeat.EVERY_WEEK:
    return addDays(date, occurrence * 7)
  case TimeTaskRepeat.EVERY_TWO_WEEKS:
    return addDays(date, occurrence * 14)
  case TimeTaskRepeat.EVERY_MONTH:
    return addMonthsClamped(date, occurrence)
  case TimeTaskRepeat.EVERY_QUARTER:
    return addMonthsClamped(date, occurrence * 3)
  case TimeTaskRepeat.EVERY_YEAR:
    return addMonthsClamped(date, occurrence * 12)
  default:
    return date
  }
}

const getBaseDate = (input: CalculateNextFireInput): { date?: string, reason?: NextFireResult['reason'] } => {
  const { schedule, recordDates = {} } = input
  if (schedule.method === TimeTaskMethod.ADVANCED_TASK) {
    const sourceDate = parseLocalDate(recordDates[schedule.triggerDate || ''], schedule.timeZone)
    if (!sourceDate) return { reason: 'INVALID_TRIGGER_DATE' }
    const offset = schedule.triggerTimePoint?.type === TimeTaskDatePoint.BEFORE
      ? -schedule.triggerTimePoint.value
      : schedule.triggerTimePoint?.type === TimeTaskDatePoint.AFTER
        ? schedule.triggerTimePoint.value
        : 0
    return { date: addDays(sourceDate, offset) }
  }

  const startDate = resolveBoundary(schedule.startDate, recordDates, schedule.timeZone)
  if (schedule.startDate.type !== TimeTaskDateType.NONE && !startDate) return { reason: 'INVALID_START_DATE' }
  return { date: startDate || dayjs(input.activationAt).tz(schedule.timeZone).format(DATE_FORMAT) }
}

export const calculateNextFire = (input: CalculateNextFireInput): NextFireResult => {
  const { schedule, recordDates = {}, calendar } = input
  if (requiresCalendar(schedule.repeat) && !calendar) return { reason: 'CALENDAR_REQUIRED' }

  const base = getBaseDate(input)
  if (!base.date) return { reason: base.reason }
  const startDate = resolveBoundary(schedule.startDate, recordDates, schedule.timeZone)
  if (schedule.startDate.type !== TimeTaskDateType.NONE && !startDate) return { reason: 'INVALID_START_DATE' }
  const endDate = resolveBoundary(schedule.endDate, recordDates, schedule.timeZone)
  if (schedule.endDate.type !== TimeTaskDateType.NONE && !endDate) return { reason: 'INVALID_END_DATE' }

  const initialThreshold = input.lastScheduledFor || input.activationAt
  const needsStrictAdvance = Boolean(input.lastScheduledFor)

  if (schedule.repeat === TimeTaskRepeat.ONECE) {
    let candidateDate = base.date
    let candidate = atTriggerTime(candidateDate, schedule.triggerTime, schedule.timeZone)
    if (input.lastScheduledFor) return { reason: 'COMPLETED' }
    if (candidate < initialThreshold && !input.allowPastDue) {
      if (schedule.method !== TimeTaskMethod.BASIC_TASK) return { reason: 'COMPLETED' }
      candidateDate = addDays(candidateDate, 1)
      candidate = atTriggerTime(candidateDate, schedule.triggerTime, schedule.timeZone)
    }
    return { nextFireAt: candidate }
  }

  for (let step = 0; step < MAX_ADVANCE_STEPS; step += 1) {
    const candidateDate = dateAtOccurrence(base.date, schedule.repeat, step)
    const candidate = atTriggerTime(candidateDate, schedule.triggerTime, schedule.timeZone)
    const beforeThreshold = needsStrictAdvance ? candidate <= initialThreshold : candidate < initialThreshold
    let eligible = false
    try {
      eligible = isEligibleDate(candidateDate, schedule.repeat, calendar)
    } catch (error) {
      if (isCalendarDataUnavailableError(error)) return { reason: 'CALENDAR_DATA_UNAVAILABLE' }
      throw error
    }
    if (!beforeThreshold && (!startDate || candidateDate >= startDate) && eligible) {
      if (endDate && candidateDate > endDate) return { reason: 'END_DATE_REACHED' }
      return { nextFireAt: candidate }
    }
  }

  return { reason: 'COMPLETED' }
}

/** Return the most recent logical occurrence at or before now, without replaying older periods. */
export const calculateLatestDue = (input: CalculateLatestDueInput): NextFireResult => {
  let cursor = input.lastScheduledFor
  let latest: Date | undefined
  for (let step = 0; step < MAX_ADVANCE_STEPS; step += 1) {
    const result = calculateNextFire({ ...input, lastScheduledFor: cursor, allowPastDue: true })
    if (!result.nextFireAt) {
      if (result.reason === 'CALENDAR_DATA_UNAVAILABLE') return result
      return latest ? { nextFireAt: latest } : result
    }
    if (result.nextFireAt.getTime() > input.now.getTime()) return latest ? { nextFireAt: latest } : result
    latest = result.nextFireAt
    cursor = result.nextFireAt
    if (input.schedule.repeat === TimeTaskRepeat.ONECE) return { nextFireAt: latest }
  }
  return latest ? { nextFireAt: latest } : { reason: 'COMPLETED' }
}
