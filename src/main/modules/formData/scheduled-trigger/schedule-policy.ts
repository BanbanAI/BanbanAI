export const SCHEDULE_POLICY = {
  timeZone: 'Asia/Shanghai',
  calendarId: 'CN@chinese-days-1.5.9',
  initiatorUserId: 'admin',
  successfulRunRetentionDays: 90,
  deadLetterRetentionDays: 180,
  catchUp: 'latest_only',
} as const
