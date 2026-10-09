export type NocodeGroup<T> = {
  nocodes: T[];
  [key: string]: unknown;
};

export function calculateNocodeRenderCapacity(
  viewportHeight: number,
  contentTopOffset: number,
  columnCount: number,
  rowHeight: number,
): number {
  const safeViewportHeight = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  const safeContentTopOffset = Number.isFinite(contentTopOffset) ? Math.max(0, contentTopOffset) : 0;
  const safeColumnCount = Number.isFinite(columnCount) ? Math.max(1, Math.floor(columnCount)) : 1;
  const safeRowHeight = Number.isFinite(rowHeight) ? Math.max(1, rowHeight) : 1;
  const visibleHeight = Math.max(0, safeViewportHeight - safeContentTopOffset);
  const visibleRowCount = Math.max(1, Math.ceil(visibleHeight / safeRowHeight));
  return visibleRowCount * safeColumnCount;
}

export function sliceNocodeGroupsByLimit<T, G extends NocodeGroup<T>>(
  groups: G[],
  limit: number,
): G[] {
  let remaining = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (!remaining) return [];

  const result: G[] = [];
  for (const group of groups) {
    if (!group.nocodes.length) continue;
    if (!remaining) break;

    const nocodes = group.nocodes.slice(0, remaining);
    result.push(nocodes.length === group.nocodes.length
      ? group
      : { ...group, nocodes } as G);
    remaining -= nocodes.length;
  }
  return result;
}
