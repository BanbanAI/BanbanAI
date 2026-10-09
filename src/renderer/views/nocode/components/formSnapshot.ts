import type { Row } from "@common/types/project";
import { deepClone, equals } from "@common/utils/object";

const INTERNAL_FORM_SNAPSHOT_KEYS = new Set([
  "__copyContext__",
  "__uuid__",
  "isManualAdd",
]);

const cloneSnapshotValue = <T>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return deepClone(value);
  }
};

const isEmptySnapshotValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
};

const normalizeSnapshotObject = (value: Record<string, unknown>) => {
  const normalized: Record<string, unknown> = {};

  for (const [key, item] of Object.entries(value)) {
    if (INTERNAL_FORM_SNAPSHOT_KEYS.has(key)) {
      continue;
    }

    const normalizedItem = normalizeSnapshotValue(item);
    if (isEmptySnapshotValue(normalizedItem)) {
      continue;
    }

    normalized[key] = normalizedItem;
  }

  return normalized;
};

export const normalizeSnapshotValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .map(item => normalizeSnapshotValue(item))
      .filter(item => !isEmptySnapshotValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return normalizeSnapshotObject(value as Record<string, unknown>);
};

export const createFormSnapshot = (...rows: Array<Row | object | null | undefined>) => {
  const mergedRow = rows.reduce<Record<string, unknown>>((prev, row) => {
    if (!row || typeof row !== "object") {
      return prev;
    }
    return {
      ...prev,
      ...(row as Record<string, unknown>),
    };
  }, {});

  return cloneSnapshotValue(normalizeSnapshotObject(mergedRow)) as Row;
};

export const isSameFormSnapshot = (
  previousSnapshot: Row | object | null | undefined,
  currentSnapshot: Row | object | null | undefined,
) => {
  return equals(previousSnapshot || {}, currentSnapshot || {});
};

const waitFormSnapshotFrame = (delayMs: number) => new Promise<void>((resolve) => {
  const timeout = globalThis.setTimeout;
  const requestFrame = globalThis.requestAnimationFrame || ((callback: FrameRequestCallback) => timeout(callback, 0));
  timeout(() => {
    requestFrame(() => resolve());
  }, delayMs);
});

export const captureStableFormSnapshot = async (
  getSnapshot: () => Row,
  options: {
    stableCount?: number;
    maxAttempts?: number;
    delayMs?: number;
  } = {},
) => {
  const stableCount = Math.max(options.stableCount ?? 3, 1);
  const maxAttempts = Math.max(options.maxAttempts ?? 12, stableCount);
  const delayMs = options.delayMs ?? 50;
  let snapshot = getSnapshot();
  let matchedCount = 1;

  for (let attempt = 1; attempt < maxAttempts; attempt += 1) {
    await waitFormSnapshotFrame(delayMs);
    const nextSnapshot = getSnapshot();
    if (isSameFormSnapshot(snapshot, nextSnapshot)) {
      matchedCount += 1;
      if (matchedCount >= stableCount) {
        return nextSnapshot;
      }
    } else {
      snapshot = nextSnapshot;
      matchedCount = 1;
    }
  }

  return snapshot;
};
