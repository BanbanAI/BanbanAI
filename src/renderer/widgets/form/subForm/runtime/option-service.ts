import type { CellAddress, RowContext } from "./types";
import type { RowStore } from "./row-store";

export type RuntimeOption = {
  readonly value: string;
  readonly label: string;
  readonly depth?: number;
};

export type DynamicOptionDescriptor = {
  readonly source: "from-table" | "data-fill";
  readonly widgetId: string;
  readonly ruleId?: string;
  readonly sourceField: readonly string[];
  readonly filter: Readonly<Record<string, unknown>>;
  readonly sort: readonly Readonly<Record<string, unknown>>[];
  readonly rowDependencies: readonly string[];
  readonly formDependencies: readonly string[];
  readonly revision: string;
};

export type RuntimeOptionSnapshot = Readonly<Record<string, unknown>>;

export type RuntimeOptionToken = {
  readonly key: string;
  readonly promise: Promise<readonly RuntimeOption[]>;
  isCurrent(): boolean;
  release(): void;
};

export type RuntimeOptionSnapshotResolver = (
  descriptor: DynamicOptionDescriptor,
  row: RowContext,
) => RuntimeOptionSnapshot;

export type RuntimeOptionLoader = (
  descriptor: DynamicOptionDescriptor,
  snapshot: RuntimeOptionSnapshot,
  signal: AbortSignal,
) => Promise<readonly RuntimeOption[]>;

type CacheEntry = {
  options: readonly RuntimeOption[];
  expiresAt: number;
};

type SharedRequest = {
  controller: AbortController;
  promise: Promise<readonly RuntimeOption[]>;
  consumers: number;
};

type AddressState = {
  version: number;
  key: string;
};

type RuntimeOptionServiceOptions = {
  maxEntries?: number;
  ttlMs?: number;
};

const addressKey = (address: CellAddress) => `${address.rowId}\u0000${address.fieldId}`;

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = stableValue((value as Record<string, unknown>)[key]);
      return result;
    }, {});
};

export const dynamicOptionRequestKey = (
  descriptor: DynamicOptionDescriptor,
  snapshot: RuntimeOptionSnapshot,
) => `option:${descriptor.revision}:${JSON.stringify(stableValue(snapshot))}`;

export class RuntimeOptionService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly pending = new Map<string, SharedRequest>();
  private readonly addresses = new Map<string, AddressState>();
  private readonly addedOptions = new Map<string, readonly RuntimeOption[]>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly stopStoreSubscription: () => boolean;
  private disposed = false;

  constructor(
    private readonly store: RowStore,
    private readonly resolveSnapshot: RuntimeOptionSnapshotResolver,
    private readonly load: RuntimeOptionLoader,
    options: RuntimeOptionServiceOptions = {},
  ) {
    this.maxEntries = Math.max(1, options.maxEntries || 64);
    this.ttlMs = Math.max(0, options.ttlMs ?? 60_000);
    this.stopStoreSubscription = store.subscribe(changeSet => {
      for (const rowId of changeSet.changedRows) this.invalidateRow(rowId);
    });
  }

  get cacheSize() {
    return this.cache.size;
  }

  get activeRequestCount() {
    return this.pending.size;
  }

  request(address: CellAddress, descriptor: DynamicOptionDescriptor): RuntimeOptionToken {
    if (this.disposed) throw new Error("RuntimeOptionService has been disposed");
    const row = this.store.getRow(address.rowId);
    if (!row) throw new Error(`Unknown row: ${address.rowId}`);
    const snapshot = this.resolveSnapshot(descriptor, row);
    const key = dynamicOptionRequestKey(descriptor, snapshot);
    const cellKey = addressKey(address);
    const previous = this.addresses.get(cellKey);
    if (previous?.key && previous.key !== key) this.releaseShared(previous.key);
    const version = (previous?.version || 0) + 1;
    this.addresses.set(cellKey, { version, key });

    const cached = this.getCached(key);
    let shared: SharedRequest | undefined;
    let promise: Promise<readonly RuntimeOption[]>;
    if (cached) {
      promise = Promise.resolve(cached);
    } else {
      shared = this.pending.get(key);
      if (!shared) {
        const controller = new AbortController();
        const request: SharedRequest = {
          controller,
          consumers: 0,
          promise: Promise.resolve().then(() => this.load(descriptor, snapshot, controller.signal)),
        };
        request.promise = request.promise.then(options => {
          const normalized = Object.freeze(options.map(option => Object.freeze({ ...option })));
          if (!controller.signal.aborted) this.setCached(key, normalized);
          return normalized;
        });
        shared = request;
        this.pending.set(key, request);
        void request.promise.then(
          () => this.cleanupShared(key, request),
          () => this.cleanupShared(key, request),
        );
      }
      shared.consumers += 1;
      promise = shared.promise;
    }

    const rowRevision = row.revision;
    let released = false;
    return {
      key,
      promise,
      isCurrent: () => {
        const current = this.addresses.get(cellKey);
        const currentRow = this.store.getRow(address.rowId);
        return !released
          && !this.disposed
          && current?.version === version
          && current.key === key
          && currentRow?.revision === rowRevision
          && dynamicOptionRequestKey(descriptor, this.resolveSnapshot(descriptor, currentRow)) === key;
      },
      release: () => {
        if (released) return;
        released = true;
        const current = this.addresses.get(cellKey);
        if (current?.version === version) this.addresses.delete(cellKey);
        if (shared) this.releaseShared(key);
      },
    };
  }

  getAddedOptions(fieldId: string): readonly RuntimeOption[] {
    return this.addedOptions.get(fieldId) || [];
  }

  addOption(fieldId: string, option: RuntimeOption): readonly RuntimeOption[] {
    const list = this.addedOptions.get(fieldId) || [];
    if (list.some(item => item.value === option.value)) return list;
    const next = Object.freeze([...list, Object.freeze({ ...option })]);
    this.addedOptions.set(fieldId, next);
    return next;
  }

  invalidateRow(rowId: string) {
    for (const [key, state] of this.addresses) {
      if (!key.startsWith(`${rowId}\u0000`)) continue;
      this.addresses.delete(key);
      this.releaseShared(state.key);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopStoreSubscription();
    this.addresses.clear();
    this.cache.clear();
    for (const request of this.pending.values()) request.controller.abort();
    this.pending.clear();
  }

  private getCached(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.options;
  }

  private setCached(key: string, options: readonly RuntimeOption[]) {
    this.cache.delete(key);
    this.cache.set(key, { options, expiresAt: Date.now() + this.ttlMs });
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }

  private releaseShared(key: string) {
    const request = this.pending.get(key);
    if (!request) return;
    request.consumers -= 1;
    if (request.consumers > 0) return;
    request.controller.abort();
    this.pending.delete(key);
  }

  private cleanupShared(key: string, request: SharedRequest) {
    if (this.pending.get(key) === request) this.pending.delete(key);
  }
}
