export const AUTO_REFRESH_INTERVALS = [60, 180, 300, 600, 900, 1800, 3600, 10800] as const;

export const normalizeAutoRefreshInterval = (value?: number) => {
  return AUTO_REFRESH_INTERVALS.includes(value as typeof AUTO_REFRESH_INTERVALS[number]) ? value : 0;
};
