import type {
  AnyEntity,
  EntityData,
  IsolationLevel,
  QueryResult,
  Transaction,
  TransactionEventBroadcaster,
} from "@mikro-orm/core";
import type { Knex } from "@mikro-orm/knex";
import { BetterSqliteConnection } from "@mikro-orm/better-sqlite";
import { resolve } from "path";
import {
  SystemSqliteWriteLease,
  systemSqliteWriteCoordinator,
} from "./system-sqlite-write-coordinator";
import { systemSqliteReadCoordinator } from "./system-sqlite-read-coordinator";

type TransactionOptions = {
  isolationLevel?: IsolationLevel;
  ctx?: Knex.Transaction;
  eventBroadcaster?: TransactionEventBroadcaster;
};

type BetterSqlitePoolConnection = {
  exec(sql: string): void;
};

type BetterSqlitePoolCallback = (
  error: Error | null,
  connection: BetterSqlitePoolConnection,
) => void;

const READ_QUERY_RE = /^(select|explain|values)\b/i;
const READ_PRAGMA_RE = /^pragma\s+(main\.)?(table_info|table_xinfo|index_info|index_xinfo|index_list|foreign_key_list|database_list)\s*(\(|$)/i;
const READ_SCALAR_PRAGMA_RE = /^pragma\s+(main\.)?(user_version|schema_version|application_id|encoding|auto_vacuum|cache_size|busy_timeout|journal_mode)\s*$/i;
const READ_WITH_QUERY_RE = /^with\b[\s\S]*\)\s*(select|values|explain)\b/i;
const RETRY_DELAYS = [50, 50, 50, 50];
const RESERVED_POOL_CONNECTIONS = 2;

type TransactionState = {
  root: Knex.Transaction;
  closed: boolean;
  lease?: SystemSqliteWriteLease;
  leasePromise?: Promise<SystemSqliteWriteLease>;
};

export class SystemSqliteConnection extends BetterSqliteConnection {
  private readonly transactionStates = new WeakMap<Knex.Transaction, TransactionState>();

  async connect(): Promise<void> {
    await super.connect();
    await systemSqliteWriteCoordinator.runExclusive(
      () => this.client.raw("pragma journal_mode = wal"),
      this.getDatabaseKey(),
    );
  }

  async begin(options: TransactionOptions = {}): Promise<Knex.Transaction> {
    if (options.ctx) {
      const transaction = await super.begin(options);
      const state = this.transactionStates.get(options.ctx);
      if (state) {
        this.transactionStates.set(transaction, state);
      }
      return transaction;
    }

    const lease = await systemSqliteWriteCoordinator.acquire(this.getDatabaseKey());
    try {
      const transaction = await super.begin(options);
      this.transactionStates.set(transaction, { root: transaction, closed: false, lease });
      return transaction;
    } catch (error) {
      lease?.release();
      throw error;
    }
  }

  async commit(
    ctx: Knex.Transaction,
    eventBroadcaster?: TransactionEventBroadcaster,
  ): Promise<void> {
    const state = this.transactionStates.get(ctx);
    if (state?.root === ctx) {
      state.closed = true;
    }
    try {
      await super.commit(ctx, eventBroadcaster);
    } finally {
      this.transactionStates.delete(ctx);
      if (state?.root === ctx) {
        state.lease?.release();
      }
    }
  }

  async rollback(
    ctx: Knex.Transaction,
    eventBroadcaster?: TransactionEventBroadcaster,
  ): Promise<void> {
    const state = this.transactionStates.get(ctx);
    if (state?.root === ctx) {
      state.closed = true;
    }
    try {
      await super.rollback(ctx, eventBroadcaster);
    } finally {
      this.transactionStates.delete(ctx);
      if (state?.root === ctx) {
        state.lease?.release();
      }
    }
  }

  async execute<
    T extends QueryResult | EntityData<AnyEntity> | EntityData<AnyEntity>[] = EntityData<AnyEntity>[],
  >(
    queryOrKnex: string | Knex.QueryBuilder | Knex.Raw,
    params: unknown[] = [],
    method: "all" | "get" | "run" = "all",
    ctx?: Transaction,
  ): Promise<T> {
    const transactionContext = ctx ?? this.getTransactionContext(queryOrKnex);
    const isWriteQuery = this.isWriteQuery(queryOrKnex);
    const executeQuery = () => this.executeWithRetry(
      () => super.execute<T>(queryOrKnex, params, method, transactionContext),
    );

    if (transactionContext) {
      if (isWriteQuery) {
        await this.acquireTransactionLease(transactionContext);
      }
      return executeQuery();
    }
    if (!isWriteQuery) {
      return this.executeWithRetry(() => systemSqliteReadCoordinator.run(
        () => super.execute<T>(queryOrKnex, params, method),
        this.getReadConcurrency(),
        this.getDatabaseKey(),
      ));
    }
    return systemSqliteWriteCoordinator.runExclusive(executeQuery, this.getDatabaseKey());
  }

  async executeSchemaBuilder<T = unknown>(builder: Knex.SchemaBuilder): Promise<T> {
    return systemSqliteWriteCoordinator.runExclusive(
      () => this.executeWithRetry(() => builder as unknown as Promise<T>),
      this.getDatabaseKey(),
    );
  }

  protected getKnexOptions(type: string): Knex.Config {
    const options = super.getKnexOptions(type);
    const pool = options.pool || {};
    const originalAfterCreate = pool.afterCreate;
    return {
      ...options,
      pool: {
        ...pool,
        afterCreate: (
          connection: BetterSqlitePoolConnection,
          done: BetterSqlitePoolCallback,
        ) => {
          const configureConnection = (targetConnection: BetterSqlitePoolConnection) => {
            try {
              targetConnection.exec("pragma foreign_keys = on; pragma busy_timeout = 1000;");
              done(null, targetConnection);
            } catch (error) {
              done(error as Error, targetConnection);
            }
          };

          if (typeof originalAfterCreate !== "function") {
            configureConnection(connection);
            return;
          }

          originalAfterCreate(
            connection,
            (error: Error | null, configuredConnection = connection) => {
              if (error) {
                done(error, configuredConnection);
                return;
              }
              configureConnection(configuredConnection);
            },
          );
        },
      },
    };
  }

  private isWriteQuery(queryOrKnex: string | Knex.QueryBuilder | Knex.Raw) {
    let sql: string;
    try {
      sql = typeof queryOrKnex === "string"
        ? queryOrKnex
        : queryOrKnex.toSQL().sql;
    } catch {
      return true;
    }

    const normalizedSql = sql.trimStart();
    if (READ_QUERY_RE.test(normalizedSql) || READ_PRAGMA_RE.test(normalizedSql)) {
      return false;
    }
    if (READ_SCALAR_PRAGMA_RE.test(normalizedSql)) {
      return false;
    }
    if (/^with\b/i.test(normalizedSql)) {
      return !READ_WITH_QUERY_RE.test(normalizedSql);
    }
    return true;
  }

  private async acquireTransactionLease(ctx: Transaction): Promise<void> {
    let state = this.transactionStates.get(ctx);
    if (!state) {
      state = { root: ctx, closed: false };
      this.transactionStates.set(ctx, state);
    }
    if (state.lease) {
      return;
    }
    if (!state.leasePromise) {
      state.leasePromise = systemSqliteWriteCoordinator.acquire(this.getDatabaseKey())
        .then(lease => {
          if (state!.closed) {
            lease.release();
            throw new Error("SQLite transaction is already complete");
          }
          state!.lease = lease;
          return lease;
        })
        .catch(error => {
          state!.leasePromise = undefined;
          throw error;
        });
    }
    await state.leasePromise;
  }

  private getTransactionContext(queryOrKnex: string | Knex.QueryBuilder | Knex.Raw): Transaction | undefined {
    if (typeof queryOrKnex === "string") {
      return undefined;
    }
    const query = queryOrKnex as Knex.QueryBuilder & { client?: { transacting?: boolean } };
    return query.client?.transacting ? queryOrKnex as Transaction : undefined;
  }

  private getDatabaseKey(): string {
    return resolve(this.config.get("dbName"));
  }

  private getReadConcurrency(): number {
    const pool = this.config.get("pool") as { max?: number } | undefined;
    const poolMax = Number.isInteger(pool?.max) ? pool!.max! : 1;
    return Math.max(1, poolMax - RESERVED_POOL_CONNECTIONS);
  }

  private async executeWithRetry<T>(executeQuery: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await executeQuery();
      } catch (error) {
        if (!this.isRetryableLockError(error) || attempt >= RETRY_DELAYS.length) {
          throw error;
        }
        await new Promise(resolveDelay => setTimeout(resolveDelay, RETRY_DELAYS[attempt]));
      }
    }
  }

  private isRetryableLockError(error: unknown): boolean {
    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    return message.includes("sqlite_busy")
      || message.includes("sqlite_locked")
      || message.includes("database is locked");
  }
}
