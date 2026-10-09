import { createHash } from 'crypto'
import {
  isTimeTaskSingleTriggerMode,
  isTimeTaskTriggerConditionsEnabled,
  TimeTaskDatePoint,
  TimeTaskDateType,
  TimeTaskMethod,
  TimeTaskOptions,
  TimeTaskRepeat,
  TriggerMode,
} from '@common/types/project'
import { replaceByFormula } from '@common/utils/formula'

export type ScheduleExecutionScope = 'global' | 'per_record'

export type ScheduleIdentity = {
  nocodeId: string
  tableId: string
  processVersion: string
  nodeUid: string
}

export type CompileScheduleInput = {
  identity: ScheduleIdentity
  options: TimeTaskOptions
  timeZone: string
  calendarId: string
  initiatorUserId: string
  hasApprovalOrTransactAfterTrigger: boolean
}

export type CompiledSchedule = {
  scheduleKey: string
  configHash: string
  executionScope: ScheduleExecutionScope
  timeZone: string
  calendarId: string
  initiatorUserId: string
  method: TimeTaskMethod
  triggerDate?: string
  triggerTime: string
  triggerTimePoint?: {
    type: TimeTaskDatePoint
    value: number
  }
  repeat: TimeTaskRepeat
  startDate: {
    type: TimeTaskDateType
    value?: string
  }
  endDate: {
    type: TimeTaskDateType
    value?: string
  }
  conditionsEnabled: boolean
  triggerMode: TriggerMode
  sourceTables: TimeTaskOptions['sourceTables']
  conditions: TimeTaskOptions['conditions']
  referencedDateFields: string[]
  conditionCurrentTableFieldIds: string[]
  conditionSourceFieldIds: Record<string, string[]>
}

type CompiledDateBoundary = {
  type: TimeTaskDateType
  value?: string
}

export class ScheduleCompileError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'ScheduleCompileError'
  }
}

const METHODS = new Set(Object.values(TimeTaskMethod))
const REPEATS = new Set(Object.values(TimeTaskRepeat))
const DATE_TYPES = new Set(Object.values(TimeTaskDateType))
const DATE_POINTS = new Set(Object.values(TimeTaskDatePoint))
const TRIGGER_MODES = new Set(Object.values(TriggerMode))

const fail = (code: string, message: string): never => {
  throw new ScheduleCompileError(code, message)
}

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const body = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')
    return `{${body}}`
  }
  return JSON.stringify(value)
}

const normalizeCustomDate = (value: string, timeZone: string): string | undefined => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) return value
    return undefined
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime())) return undefined
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

const normalizeDateBoundary = (
  boundary: TimeTaskOptions['startDate'] | TimeTaskOptions['endDate'],
  name: 'START' | 'END',
  timeZone: string,
): CompiledDateBoundary => {
  const type = boundary?.type ?? TimeTaskDateType.NONE
  if (!DATE_TYPES.has(type)) {
    return fail(`INVALID_${name}_DATE_TYPE`, `Invalid ${name.toLowerCase()} date type`)
  }
  if (type !== TimeTaskDateType.NONE && !boundary?.value) {
    return fail(`MISSING_${name}_DATE_VALUE`, `${name.toLowerCase()} date requires a value`)
  }
  const value = type === TimeTaskDateType.CUSTOM
    ? normalizeCustomDate(boundary.value as string, timeZone)
    : boundary?.value
  if (type === TimeTaskDateType.CUSTOM && !value) {
    return fail(`INVALID_${name}_DATE_VALUE`, `${name.toLowerCase()} date must use YYYY-MM-DD`)
  }
  return type === TimeTaskDateType.NONE
    ? { type }
    : { type, value }
}

const assertTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format()
  } catch {
    fail('INVALID_TIME_ZONE', 'A valid IANA time zone is required')
  }
}

export const compileSchedule = (input: CompileScheduleInput): CompiledSchedule => {
  const { identity, options } = input
  if (!METHODS.has(options.method)) fail('INVALID_METHOD', 'Invalid schedule method')
  if (!REPEATS.has(options.repeat)) fail('INVALID_REPEAT', 'Invalid schedule repeat')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(options.triggerTime || '')) {
    fail('INVALID_TRIGGER_TIME', 'Trigger time must use HH:mm')
  }
  assertTimeZone(input.timeZone)
  if (!input.calendarId) fail('MISSING_CALENDAR_ID', 'Calendar id is required')
  if (!input.initiatorUserId) fail('MISSING_INITIATOR', 'Scheduled flows require an initiator')

  const conditionsEnabled = isTimeTaskTriggerConditionsEnabled(options)
  const triggerMode = conditionsEnabled ? options.triggerMode ?? TriggerMode.MULTI : TriggerMode.MULTI
  if (!TRIGGER_MODES.has(triggerMode)) fail('INVALID_TRIGGER_MODE', 'Invalid trigger mode')

  let triggerDate: string | undefined
  let triggerTimePoint: CompiledSchedule['triggerTimePoint']
  if (options.method === TimeTaskMethod.ADVANCED_TASK) {
    if (!options.triggerDate) fail('MISSING_TRIGGER_DATE', 'Advanced schedules require a trigger date field')
    triggerDate = options.triggerDate
    const pointType = options.triggerTimePoint?.type
    if (!DATE_POINTS.has(pointType)) fail('INVALID_TRIGGER_DATE_POINT', 'Invalid trigger date point')
    const pointValue = pointType === TimeTaskDatePoint.TODAY ? 0 : Number(options.triggerTimePoint?.value)
    if (pointType !== TimeTaskDatePoint.TODAY && (!Number.isInteger(pointValue) || pointValue < 1)) {
      fail('INVALID_TRIGGER_DATE_OFFSET', 'Before and after offsets must be positive whole days')
    }
    triggerTimePoint = { type: pointType, value: pointValue }
  }

  const startDate = options.repeat === TimeTaskRepeat.ONECE
    ? { type: TimeTaskDateType.NONE }
    : normalizeDateBoundary(options.startDate, 'START', input.timeZone)
  const endDate = options.repeat === TimeTaskRepeat.ONECE
    ? { type: TimeTaskDateType.NONE }
    : normalizeDateBoundary(options.endDate, 'END', input.timeZone)

  const singleTrigger = isTimeTaskSingleTriggerMode({
    enableTriggerConditions: conditionsEnabled,
    triggerMode,
    sourceTables: conditionsEnabled ? options.sourceTables : [],
    conditions: conditionsEnabled ? options.conditions : [],
  })
  if (singleTrigger && input.hasApprovalOrTransactAfterTrigger) {
    fail('UNSUPPORTED_SINGLE_TRIGGER_FLOW', 'Single trigger mode cannot precede approval or transact nodes')
  }

  const referencedDateFields = [
    triggerDate,
    startDate.type === TimeTaskDateType.FIELD ? startDate.value : undefined,
    endDate.type === TimeTaskDateType.FIELD ? endDate.value : undefined,
  ].filter((value): value is string => Boolean(value)).sort()
  const conditionCurrentTableFieldIds = new Set<string>()
  const conditionSourceFieldIds = new Map<string, Set<string>>()
  const addConditionField = (keys: string[]) => {
    if (keys.length === 1 && keys[0]) conditionCurrentTableFieldIds.add(keys[0])
    if (keys[0] === identity.tableId && keys[1]) conditionCurrentTableFieldIds.add(keys[1])
    const source = options.sourceTables?.find(item => item.uid === keys[0])
    if (source && keys[1]) {
      if (!conditionSourceFieldIds.has(source.uid)) conditionSourceFieldIds.set(source.uid, new Set())
      conditionSourceFieldIds.get(source.uid)?.add(keys[1])
    }
  }
  const collectConditionField = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(collectConditionField)
    if (!value || typeof value !== 'object') return
    const condition = value as Record<string, unknown>
    if (typeof condition.uid === 'string') {
      const parts = condition.uid.split('.')
      addConditionField(parts)
    }
    if (typeof condition.formula === 'string') {
      replaceByFormula(condition.formula, keys => {
        addConditionField(keys)
        return ''
      })
    }
  }
  if (conditionsEnabled) collectConditionField(options.conditions)

  const executionScope: ScheduleExecutionScope = singleTrigger
    ? 'global'
    : options.method === TimeTaskMethod.ADVANCED_TASK ||
      triggerMode === TriggerMode.MULTI && conditionsEnabled ||
      referencedDateFields.length > 0
      ? 'per_record'
      : 'global'

  const compiledWithoutHash = {
    executionScope,
    timeZone: input.timeZone,
    calendarId: input.calendarId,
    initiatorUserId: input.initiatorUserId,
    method: options.method,
    triggerDate,
    triggerTime: options.triggerTime,
    triggerTimePoint,
    repeat: options.repeat,
    startDate,
    endDate,
    conditionsEnabled,
    triggerMode,
    sourceTables: conditionsEnabled ? options.sourceTables ?? [] : [],
    conditions: conditionsEnabled ? options.conditions ?? [] : [],
    referencedDateFields,
    conditionCurrentTableFieldIds: Array.from(conditionCurrentTableFieldIds).sort(),
    conditionSourceFieldIds: Object.fromEntries(Array.from(conditionSourceFieldIds, ([uid, ids]) => [uid, Array.from(ids).sort()])),
  }
  const configHash = createHash('sha256').update(stableSerialize(compiledWithoutHash)).digest('hex')

  return {
    scheduleKey: [identity.nocodeId, identity.tableId, identity.processVersion, identity.nodeUid].join(':'),
    configHash,
    ...compiledWithoutHash,
  }
}
