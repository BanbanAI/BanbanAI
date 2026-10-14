import type { CellAddress, RowId } from "./types";
import type { RowStore } from "./row-store";

export type RuntimeAsyncToken<T> = {
  readonly address: CellAddress;
  readonly version: number;
  readonly signal: AbortSignal;
  readonly promise: Promise<T>;
  isCurrent(): boolean;
  release(): void;
};

type SharedRequest<T> = {
  promise: Promise<T>;
  controller: AbortController;
  consumers: number;
};

type AddressState = {
  version: number;
  requestKey?: string;
};

const addressKey = (address: CellAddress) => `${address.rowId}\u0000${address.fieldId}`;

export class RuntimeAsyncService {
  private readonly addresses = new Map<string, AddressState>();
  private readonly shared = new Map<string, SharedRequest<unknown>>();
  private disposed = false;

  constructor(private readonly store: RowStore) {}

  get activeRequestCount() {
    return this.shared.size;
  }

  request<T>(
    address: CellAddress,
    requestKey: string,
    resolve: (signal: AbortSignal) => Promise<T> | T,
  ): RuntimeAsyncToken<T> {
    if (this.disposed) throw new Error("RuntimeAsyncService has been disposed");
    const key = addressKey(address);
    const previous = this.addresses.get(key);
    if (previous?.requestKey && previous.requestKey !== requestKey) this.releaseShared(previous.requestKey);

    const state = { version: (previous?.version || 0) + 1, requestKey };
    this.addresses.set(key, state);
    let shared = this.shared.get(requestKey) as SharedRequest<T> | undefined;
    if (!shared) {
      const controller = new AbortController();
      const promise = Promise.resolve().then(() => resolve(controller.signal));
      shared = { promise, controller, consumers: 0 };
      this.shared.set(requestKey, shared as SharedRequest<unknown>);
      void promise.then(() => this.cleanupShared(requestKey, shared!), () => this.cleanupShared(requestKey, shared!));
    }
    shared.consumers += 1;
    const version = state.version;
    let released = false;
    return {
      address: { ...address },
      version,
      signal: shared.controller.signal,
      promise: shared.promise,
      isCurrent: () => {
        const current = this.addresses.get(key);
        return !this.disposed
          && Boolean(this.store.getRow(address.rowId))
          && current?.version === version
          && current.requestKey === requestKey
          && !shared!.controller.signal.aborted;
      },
      release: () => {
        if (released) return;
        released = true;
        const current = this.addresses.get(key);
        if (current?.version === version) this.addresses.delete(key);
        this.releaseShared(requestKey);
      },
    };
  }

  invalidateRow(rowId: RowId) {
    for (const [key, state] of this.addresses) {
      if (!key.startsWith(`${rowId}\u0000`)) continue;
      this.addresses.delete(key);
      if (state.requestKey) this.releaseShared(state.requestKey);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.addresses.clear();
    for (const request of this.shared.values()) request.controller.abort();
    this.shared.clear();
  }

  private releaseShared(requestKey: string) {
    const request = this.shared.get(requestKey);
    if (!request) return;
    request.consumers -= 1;
    if (request.consumers <= 0) {
      request.controller.abort();
      this.shared.delete(requestKey);
    }
  }

  private cleanupShared(requestKey: string, request: SharedRequest<unknown>) {
    if (this.shared.get(requestKey) !== request) return;
    this.shared.delete(requestKey);
  }
}
