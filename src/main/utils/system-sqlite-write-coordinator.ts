import { Logger } from "@nestjs/common";
import AsyncLock from "async-lock";
import { resolve } from "path";

export interface SystemSqliteWriteLease {
  release(): void;
}

export class SystemSqliteWriteCoordinator {
  private static readonly LOCK_OPTIONS: AsyncLock.AsyncLockOptions = {
    maxPending: 100,
    timeout: 60 * 1000,
  };

  private readonly logger = new Logger(SystemSqliteWriteCoordinator.name);
  private readonly lock = new AsyncLock(SystemSqliteWriteCoordinator.LOCK_OPTIONS);

  async acquire(databasePath = "system.sqlite"): Promise<SystemSqliteWriteLease> {
    const queuedAt = Date.now();
    const key = this.getKey(databasePath);
    return new Promise<SystemSqliteWriteLease>((resolveLease, rejectLease) => {
      let releaseLock: () => void = () => undefined;
      try {
        const lockPromise = this.lock.acquire(key, () => {
          const acquiredAt = Date.now();
          let released = false;
          return new Promise<void>(resolveLock => {
            releaseLock = resolveLock;
            resolveLease({
              release: () => {
                if (released) {
                  return;
                }
                released = true;
                releaseLock();

                const waitMs = acquiredAt - queuedAt;
                const holdMs = Date.now() - acquiredAt;
                const message = `write lease released: database=${key}, waitMs=${waitMs}, holdMs=${holdMs}`;
                if (holdMs >= 1000) {
                  this.logger.warn(message);
                } else if (waitMs >= 1000) {
                  this.logger.debug(message);
                }
              },
            });
          });
        }, SystemSqliteWriteCoordinator.LOCK_OPTIONS);
        lockPromise.catch(rejectLease);
      } catch (error) {
        rejectLease(error);
      }
    });
  }

  async runExclusive<T>(callback: () => Promise<T>, databasePath = "system.sqlite"): Promise<T> {
    const lease = await this.acquire(databasePath);
    try {
      return await callback();
    } finally {
      lease.release();
    }
  }

  private getKey(databasePath: string): string {
    const normalizedPath = resolve(databasePath);
    return process.platform === "win32" ? normalizedPath.toLowerCase() : normalizedPath;
  }
}

export const systemSqliteWriteCoordinator = new SystemSqliteWriteCoordinator();
