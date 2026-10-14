import { CellAddress, CellState } from "./types";
import { RowStore } from "./row-store";

export type CellRequestToken = {
  readonly address: CellAddress;
  readonly version: number;
  readonly signal: AbortSignal;
  isCurrent(): boolean;
};

type CellRuntime = {
  address: CellAddress;
  version: number;
  controller?: AbortController;
};

const keyOf = (address: CellAddress) => `${address.rowId}\u0000${address.fieldId}`;

export class CellRuntimeRegistry {
  private readonly runtimes = new Map<string, CellRuntime>();
  private disposed = false;

  constructor(private readonly store: RowStore) {}

  get size() {
    return this.runtimes.size;
  }

  getState(address: CellAddress): CellState {
    return this.store.ensureCellState(address);
  }

  beginRequest(address: CellAddress): CellRequestToken {
    if (this.disposed) throw new Error("CellRuntimeRegistry has been disposed");
    const key = keyOf(address);
    const runtime = this.runtimes.get(key) || { address: { ...address }, version: 0 };
    runtime.controller?.abort();
    runtime.version += 1;
    runtime.controller = new AbortController();
    this.runtimes.set(key, runtime);
    const version = runtime.version;
    const signal = runtime.controller.signal;
    return {
      address: { ...address },
      version,
      signal,
      isCurrent: () => this.runtimes.get(key)?.version === version && !signal.aborted,
    };
  }

  finishRequest(address: CellAddress, version: number) {
    const runtime = this.runtimes.get(keyOf(address));
    if (runtime?.version !== version) return false;
    runtime.controller = undefined;
    return true;
  }

  release(address: CellAddress) {
    const key = keyOf(address);
    const runtime = this.runtimes.get(key);
    runtime?.controller?.abort();
    this.runtimes.delete(key);
    this.store.releaseCellState(address);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const runtime of this.runtimes.values()) runtime.controller?.abort();
    this.runtimes.clear();
  }
}

