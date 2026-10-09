import { resolve } from "path";

interface SystemSqliteReadLease {
  release(): void;
}

type PendingRead = {
  resolve(lease: SystemSqliteReadLease): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
};

type ReadState = {
  active: number;
  limit: number;
  pending: PendingRead[];
};

export class SystemSqliteReadCoordinator {
  private static readonly TIMEOUT = 60 * 1000;
  private readonly states = new Map<string, ReadState>();

  async run<T>(callback: () => Promise<T>, limit: number, databasePath = "system.sqlite"): Promise<T> {
    const lease = await this.acquire(limit, databasePath);
    try {
      return await callback();
    } finally {
      lease.release();
    }
  }

  private acquire(limit: number, databasePath: string): Promise<SystemSqliteReadLease> {
    const key = this.getKey(databasePath);
    const normalizedLimit = Math.max(1, Math.floor(limit));
    let state = this.states.get(key);
    if (!state) {
      state = {
        active: 0,
        limit: normalizedLimit,
        pending: [],
      };
      this.states.set(key, state);
    } else {
      state.limit = normalizedLimit;
    }

    if (state.active < state.limit) {
      state.active += 1;
      return Promise.resolve(this.createLease(key, state));
    }
    return new Promise<SystemSqliteReadLease>((resolveLease, rejectLease) => {
      const pendingRead: PendingRead = {
        resolve: resolveLease,
        reject: rejectLease,
        timer: setTimeout(() => {
          const index = state!.pending.indexOf(pendingRead);
          if (index !== -1) {
            state!.pending.splice(index, 1);
          }
          pendingRead.reject(new Error(`SQLite read queue timed out: database=${key}`));
        }, SystemSqliteReadCoordinator.TIMEOUT),
      };
      state!.pending.push(pendingRead);
    });
  }

  private createLease(key: string, state: ReadState): SystemSqliteReadLease {
    let released = false;
    return {
      release: () => {
        if (released) {
          return;
        }
        released = true;
        state.active -= 1;

        const pendingRead = state.pending.shift();
        if (pendingRead) {
          clearTimeout(pendingRead.timer);
          state.active += 1;
          pendingRead.resolve(this.createLease(key, state));
          return;
        }
        if (state.active === 0) {
          this.states.delete(key);
        }
      },
    };
  }

  private getKey(databasePath: string): string {
    const normalizedPath = resolve(databasePath);
    return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath;
  }
}

export const systemSqliteReadCoordinator = new SystemSqliteReadCoordinator();
