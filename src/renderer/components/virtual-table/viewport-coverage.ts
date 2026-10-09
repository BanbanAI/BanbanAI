import type { VirtualWindow } from "./types";

type ResolveVirtualViewportCoverageOptions = {
  renderedWindow: VirtualWindow;
  scrollTop: number;
  viewportHeight: number;
  rowCount: number;
};

type ResolveVirtualViewportCompensationOptions = ResolveVirtualViewportCoverageOptions;
type ResolveVirtualViewportCoverageActionOptions = ResolveVirtualViewportCoverageOptions & {
  currentRenderedWindowEnd?: number;
  currentCompensation?: number;
  projectedRenderedWindowEnd?: number;
};

export const resolveVirtualViewportRenderedBottom = (window: VirtualWindow) => {
  const totalHeight = Math.max(0, Number(window.totalHeight) || 0);
  const offsetBottom = Math.max(0, Number(window.offsetBottom) || 0);
  return Math.max(0, totalHeight - offsetBottom);
};

export const resolveVirtualViewportCoverageGap = (
  options: ResolveVirtualViewportCoverageOptions,
) => {
  const viewportHeight = Math.max(0, Number(options.viewportHeight) || 0);
  if (viewportHeight <= 0) {
    return 0;
  }

  const renderedBottom = resolveVirtualViewportRenderedBottom(options.renderedWindow);
  const viewportBottom = Math.max(0, Number(options.scrollTop) || 0) + viewportHeight;
  return Math.max(0, Math.ceil(viewportBottom - renderedBottom));
};

export const shouldForceVirtualViewportCoverageExpansion = (
  options: ResolveVirtualViewportCoverageOptions,
) => {
  const viewportHeight = Math.max(0, Number(options.viewportHeight) || 0);
  const rowCount = Math.max(0, Number(options.rowCount) || 0);
  if (viewportHeight <= 0 || rowCount <= 0) {
    return false;
  }

  const end = Math.max(-1, Math.floor(Number(options.renderedWindow.end) || -1));
  if (end >= rowCount - 1) {
    return false;
  }

  return resolveVirtualViewportCoverageGap(options) > 0;
};

export const resolveVirtualViewportCompensation = (
  options: ResolveVirtualViewportCompensationOptions,
) => {
  if (!shouldForceVirtualViewportCoverageExpansion(options)) {
    return 0;
  }
  return resolveVirtualViewportCoverageGap(options);
};

export const resolveVirtualViewportCoverageAction = (
  options: ResolveVirtualViewportCoverageActionOptions,
) => {
  const compensation = resolveVirtualViewportCompensation(options);
  const currentCompensation = Math.max(0, Math.ceil(Number(options.currentCompensation) || 0));
  const currentRenderedWindowEnd = Math.floor(Number(options.currentRenderedWindowEnd) || -1);
  const projectedRenderedWindowEnd = Math.floor(Number(options.projectedRenderedWindowEnd) || -1);
  const projectedWindowWouldGrow = (
    projectedRenderedWindowEnd < 0
    || currentRenderedWindowEnd < 0
    || projectedRenderedWindowEnd > currentRenderedWindowEnd
  );
  return {
    compensation,
    shouldFollowupMeasurement: compensation > currentCompensation && projectedWindowWouldGrow,
  };
};
