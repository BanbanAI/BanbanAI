export type VirtualTableSizeValue = string | number | null | undefined;

type ResolveVirtualTableContainerStyleOptions = {
  width?: VirtualTableSizeValue;
  minWidth?: VirtualTableSizeValue;
  maxWidth?: VirtualTableSizeValue;
  height?: VirtualTableSizeValue;
  minHeight?: VirtualTableSizeValue;
  maxHeight?: VirtualTableSizeValue;
};

type ResolveVirtualTableBodyViewportHeightOptions = {
  viewportHeight: number;
  estimatedRowHeight: number;
  headerHeight: number;
  footerHeight: number;
  showFooter: boolean;
  verticalChromeHeight?: number;
};

type ResolveVirtualTableBodyHeightOptions = {
  totalHeight: number;
  bodyViewportHeight: number;
  mode?: "fill" | "content";
};

type ResolveVirtualTableNeedsVerticalScrollbarOptions = ResolveVirtualTableBodyHeightOptions;

type ResolveVirtualTableCanvasWidthOptions = {
  totalWidth: number;
  viewportWidth: number;
};

type ResolveVirtualTableTrailingFillerWidthOptions = {
  canvasWidth: number;
  totalWidth: number;
};

type ResolveVirtualTableViewportMetricsOptions = {
  clientWidth?: number;
  clientHeight?: number;
  contentRectWidth?: number;
  contentRectHeight?: number;
};

type ResolveVirtualTableMinRowHeightOptions = {
  estimatedRowHeight: number;
  minRowHeight: number | null | undefined;
};

export const normalizeVirtualTableSizeValue = (value: VirtualTableSizeValue) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? `${Math.max(0, value)}px` : undefined;
  }
  const normalized = String(value).trim();
  return normalized || undefined;
};

export const resolveVirtualTableContainerStyle = (
  options: ResolveVirtualTableContainerStyleOptions,
) => {
  const style: Record<string, string> = {};
  const valueEntries = [
    ["width", options.width],
    ["minWidth", options.minWidth],
    ["maxWidth", options.maxWidth],
    ["height", options.height],
    ["minHeight", options.minHeight],
    ["maxHeight", options.maxHeight],
  ] as const;

  for (const [key, value] of valueEntries) {
    const normalized = normalizeVirtualTableSizeValue(value);
    if (!normalized) {
      continue;
    }
    style[key] = normalized;
  }

  return style;
};

export const resolveVirtualTableBodyViewportHeight = (
  options: ResolveVirtualTableBodyViewportHeightOptions,
) => {
  const headerHeight = Math.max(0, Math.floor(Number(options.headerHeight) || 0));
  const footerHeight = options.showFooter
    ? Math.max(0, Math.floor(Number(options.footerHeight) || 0))
    : 0;
  const verticalChromeHeight = Math.max(0, Math.ceil(Number(options.verticalChromeHeight) || 0));
  const resolvedViewportHeight = Math.max(0, Math.floor(Number(options.viewportHeight) || 0));
  if (resolvedViewportHeight <= 0) {
    return 0;
  }
  return Math.max(0, resolvedViewportHeight - headerHeight - footerHeight - verticalChromeHeight);
};

export const resolveVirtualTableBodyHeight = (
  options: ResolveVirtualTableBodyHeightOptions,
) => {
  const totalHeight = Math.max(0, Math.ceil(Number(options.totalHeight) || 0));
  if (options.mode === "content") {
    return Math.max(totalHeight, 1);
  }

  const bodyViewportHeight = Math.max(0, Math.ceil(Number(options.bodyViewportHeight) || 0));
  return Math.max(totalHeight, bodyViewportHeight, 1);
};

export const resolveVirtualTableBodyFillerHeight = (
  options: ResolveVirtualTableBodyHeightOptions,
) => {
  if (options.mode === "content") {
    return 0;
  }

  const totalHeight = Math.max(0, Math.ceil(Number(options.totalHeight) || 0));
  return Math.max(0, resolveVirtualTableBodyHeight(options) - totalHeight);
};

export const resolveVirtualTableNeedsVerticalScrollbar = (
  options: ResolveVirtualTableNeedsVerticalScrollbarOptions,
) => {
  if (options.mode === "content") {
    return false;
  }

  const totalHeight = Math.max(0, Math.ceil(Number(options.totalHeight) || 0));
  const bodyViewportHeight = Math.max(0, Math.ceil(Number(options.bodyViewportHeight) || 0));
  return bodyViewportHeight > 0 && totalHeight > bodyViewportHeight;
};

export const resolveVirtualTableCanvasWidth = (
  options: ResolveVirtualTableCanvasWidthOptions,
) => {
  const totalWidth = Math.max(0, Math.ceil(Number(options.totalWidth) || 0));
  const viewportWidth = Math.max(0, Math.ceil(Number(options.viewportWidth) || 0));
  return Math.max(totalWidth, viewportWidth, 1);
};

export const resolveVirtualTableTrailingFillerWidth = (
  options: ResolveVirtualTableTrailingFillerWidthOptions,
) => {
  const canvasWidth = Math.max(0, Math.floor(Number(options.canvasWidth) || 0));
  const totalWidth = Math.max(0, Math.ceil(Number(options.totalWidth) || 0));
  return Math.max(0, canvasWidth - totalWidth);
};

export const resolveVirtualTableViewportMetrics = (
  options: ResolveVirtualTableViewportMetricsOptions,
) => {
  const clientWidth = Math.floor(Number(options.clientWidth) || 0);
  const clientHeight = Math.floor(Number(options.clientHeight) || 0);
  const contentRectWidth = Math.floor(Number(options.contentRectWidth) || 0);
  const contentRectHeight = Math.floor(Number(options.contentRectHeight) || 0);

  return {
    width: Math.max(0, clientWidth > 0 ? clientWidth : contentRectWidth),
    height: Math.max(0, clientHeight > 0 ? clientHeight : contentRectHeight),
  };
};

export const resolveVirtualTableMinRowHeight = (
  options: ResolveVirtualTableMinRowHeightOptions,
) => {
  if (options.minRowHeight === undefined || options.minRowHeight === null) {
    return Math.max(0, Math.floor(Number(options.estimatedRowHeight) || 0));
  }
  return Math.max(0, Math.floor(Number(options.minRowHeight) || 0));
};
