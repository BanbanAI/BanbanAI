type RowMeasurementLike = {
  entry?: {
    contentRect?: {
      height?: number;
    };
    borderBoxSize?: {
      blockSize?: number;
    } | Array<{
      blockSize?: number;
    }>;
  };
  element?: {
    offsetHeight?: number;
    getBoundingClientRect?: () => {
      height?: number;
    };
  } | null;
  minRowHeight: number;
};

type MeasureVisibleVirtualRowsOptions = {
  visibleItems: Array<{
    key: string | number;
  }>;
  rowComponentRefMap: Map<string | number, {
    measureRow?: () => void;
  } | null>;
};

const normalizeCandidate = (value: unknown) => {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue) || nextValue <= 0) {
    return null;
  }
  return Math.ceil(nextValue);
};

const resolveBorderBoxHeight = (
  borderBoxSize?: RowMeasurementLike["entry"]["borderBoxSize"],
) => {
  if (Array.isArray(borderBoxSize)) {
    for (const item of borderBoxSize) {
      const nextValue = normalizeCandidate(item?.blockSize);
      if (nextValue != null) {
        return nextValue;
      }
    }
    return null;
  }

  return normalizeCandidate(borderBoxSize?.blockSize);
};

export const resolveMeasuredVirtualRowHeight = (
  options: RowMeasurementLike,
) => {
  const minRowHeight = Math.max(0, Math.ceil(Number(options.minRowHeight) || 0));
  const borderBoxHeight = resolveBorderBoxHeight(options.entry?.borderBoxSize);
  const rectHeight = normalizeCandidate(options.element?.getBoundingClientRect?.().height);
  const offsetHeight = normalizeCandidate(options.element?.offsetHeight);
  const contentHeight = normalizeCandidate(options.entry?.contentRect?.height);

  return Math.max(
    minRowHeight,
    borderBoxHeight ?? 0,
    rectHeight ?? 0,
    offsetHeight ?? 0,
    contentHeight ?? 0,
  );
};

export const measureVisibleVirtualRows = (
  options: MeasureVisibleVirtualRowsOptions,
) => {
  for (const item of options.visibleItems) {
    options.rowComponentRefMap.get(item.key)?.measureRow?.();
  }
};
