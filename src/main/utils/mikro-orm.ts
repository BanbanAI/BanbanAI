import { Logger } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { Configuration, ConnectionOptions, MikroORM, MikroORMOptions } from "@mikro-orm/core";
import { getRuntime } from "@main/runtime";
import { isAbsolute, join } from "path";
import { SystemSqliteDriver } from "./system-sqlite-driver";
import { SystemSqliteConnection } from "./system-sqlite-connection";
import { SchemaGenerator } from "@mikro-orm/knex";

type Options = {
  entities: MikroORMOptions['entities'],
  onSchemaSyncError?: (error: unknown) => void | Promise<void>,
};
type DbOptions = Options & {
  db: {
    type: keyof typeof Configuration.PLATFORMS,
  } & ConnectionOptions,
};

export function makeMikroOrmModule(options: DbOptions) {
  const logger = new Logger('makeMikroOrmModule');
  let mikroOrmModule;
  if (options.db) {
    const dbOptions = options as DbOptions;
    logger.log("db config", Object.assign({}, dbOptions.db, {password: '******'}));
    let updateSchemaPromise: Promise<void> | null = null;
    mikroOrmModule = MikroOrmModule.forRootAsync({
      useFactory: async () => {
        if (dbOptions.db.type === "sqlite" && dbOptions.db.dbName && !isAbsolute(dbOptions.db.dbName)) {
          const userDataPath = await getRuntime().getUserDataPath();
          dbOptions.db.dbName = join(userDataPath, "resources", dbOptions.db.dbName);
        }
        const finalOptions = Object.assign({}, dbOptions.db, {
          entities: dbOptions.entities,
          logger: logger.log.bind(logger),
        }, dbOptions.db.type === "sqlite" ? {
          driver: SystemSqliteDriver,
        } : {});
        if (!updateSchemaPromise) {
          updateSchemaPromise = (async () => {
            let orm: MikroORM | null = null;
            try {
              logger.debug("try to generate schema");
              orm = await MikroORM.init(finalOptions);
              if (dbOptions.db.type === "sqlite") {
                await updateSqliteSchema(orm, logger);
              } else {
                const generator = orm.getSchemaGenerator();
                await generator.updateSchema({
                  dropTables: false,
                  safe: true,
                });
              }
              if (dbOptions.db.type === "sqlite") {
                await makeObsoleteSqliteColumns(orm);
              }
              logger.debug("generate schema success");
            } finally {
              await orm?.close(true);
            }
          })().catch(async err => {
            logger.error("generate schema err", err);
            if (dbOptions.db.type === "sqlite" && !(err instanceof ScheduledTriggerSchemaConflictError)) {
              let repairOrm: MikroORM | null = null;
              try {
                repairOrm = await MikroORM.init(finalOptions);
                const repaired = await addMissingSqliteColumns(repairOrm, logger);
                if (repaired) {
                  await updateSqliteSchema(repairOrm, logger);
                  await makeObsoleteSqliteColumns(repairOrm);
                  logger.warn("sqlite schema repaired after sync failure");
                  return;
                }
              } catch (repairError) {
                logger.error("repair sqlite schema err", repairError);
              } finally {
                await repairOrm?.close(true);
              }
            }
            await dbOptions.onSchemaSyncError?.(err);
            throw err;
          });
        }
        await updateSchemaPromise;
        return {
          ...finalOptions,
          registerRequestContext: false,
        };
      }
    });
  }
  return mikroOrmModule;
}

const SCHEDULED_TRIGGER_SCHEMA_MIGRATION_ID = "flow-scheduled-trigger-schema-20260901-v1";
const SCHEDULED_TRIGGER_BACKFILL_COLUMNS: Record<string, Set<string>> = {
  flow_schedule_definition: new Set([
    "initiator_user_id",
    "lifecycle_epoch",
    "head_dirty",
    "head_version",
  ]),
  flow_schedule_fire: new Set(["lifecycle_epoch"]),
  flow_scheduled_run: new Set(["initiator_user_id", "lifecycle_epoch"]),
  flow_schedule_projection_change: new Set(["state", "available_at", "attempt_count"]),
};
const SCHEDULED_TRIGGER_UNIQUE_KEYS = [
  {
    indexName: "flow_schedule_definition_revision_unique",
    tableName: "flow_schedule_definition",
    columns: ["schedule_key", "revision"],
  },
  {
    indexName: "flow_schedule_cursor_subject_unique",
    tableName: "flow_schedule_cursor",
    columns: ["schedule_id", "subject_key"],
  },
  {
    indexName: "flow_schedule_fire_unique",
    tableName: "flow_schedule_fire",
    columns: ["schedule_id", "scheduled_for"],
  },
  {
    indexName: "flow_scheduled_run_unique",
    tableName: "flow_scheduled_run",
    columns: ["schedule_id", "subject_key", "scheduled_for"],
  },
  {
    indexName: "flow_scheduled_run_todo_unique",
    tableName: "flow_scheduled_run",
    columns: ["todo_id"],
  },
  {
    indexName: "flow_schedule_projection_change_unique",
    tableName: "flow_schedule_projection_change",
    columns: ["schedule_id", "record_id"],
  },
  {
    indexName: "flow_schedule_change_outbox_nocode_unique",
    tableName: "flow_schedule_change_outbox",
    columns: ["nocode_id"],
  },
] as const;

class ScheduledTriggerSchemaConflictError extends Error {}

export async function addMissingSqliteColumns(orm: MikroORM, logger: Logger): Promise<boolean> {
  const connection = orm.em.getConnection() as SystemSqliteConnection;
  const targetSchema = (orm.getSchemaGenerator() as SchemaGenerator).getTargetSchema();
  let repaired = false;
  let scheduledTriggerBackfillRequired = false;

  for (const table of targetSchema.getTables()) {
    const tableName = table.name as string;
    const escapedTableName = tableName.replace(/"/g, '""');
    const actualColumns = await connection.execute<Array<{ name: string }>>(
      `pragma table_info("${escapedTableName}")`,
    );
    if (!actualColumns.length) continue;
    const actualColumnNames = new Set(actualColumns.map(column => column.name));
    for (const column of table.getColumns()) {
      if (column.name === "_id" || actualColumnNames.has(column.name)) continue;
      const columnName = column.name.replace(/"/g, '""');
      const columnType = column.type || "text";
      const nullable = column.nullable;
      const hasDefault = column.default !== undefined && column.default !== null;
      const defaultValue = !nullable || hasDefault ? ` default ${getSqliteColumnDefault(column)}` : "";
      const notNull = nullable ? "" : " not null";
      await connection.execute(
        `alter table "${escapedTableName}" add column "${columnName}" ${columnType}${notNull}${defaultValue}`,
      );
      actualColumnNames.add(column.name);
      repaired = true;
      if (SCHEDULED_TRIGGER_BACKFILL_COLUMNS[tableName]?.has(column.name)) {
        scheduledTriggerBackfillRequired = true;
      }
      logger.warn(`sqlite schema added missing column: ${tableName}.${column.name}`);
    }
  }

  if (scheduledTriggerBackfillRequired) {
    await backfillScheduledTriggerSqliteColumns(orm, logger, true);
  }
  return repaired;
}

export async function updateSqliteSchema(orm: MikroORM, logger: Logger) {
  await assertNoScheduledTriggerDuplicateBusinessKeys(orm);
  const backfillRequired = await hasMissingScheduledTriggerBackfillColumns(orm);
  await orm.getSchemaGenerator().updateSchema({
    dropTables: false,
    safe: true,
  });
  await backfillScheduledTriggerSqliteColumns(orm, logger, backfillRequired);
}

export async function backfillScheduledTriggerSqliteColumns(
  orm: MikroORM,
  logger: Logger,
  force = false,
): Promise<boolean> {
  const connection = orm.em.getConnection() as SystemSqliteConnection;
  const tableRows = await connection.execute<Array<{ name: string }>>(
    "select name from sqlite_master where type = 'table'",
  );
  const existingTables = new Set(tableRows.map(row => row.name));
  const schedulerTables = [
    "flow_schedule_definition",
    "flow_schedule_fire",
    "flow_scheduled_run",
    "flow_schedule_projection_change",
  ];
  if (!schedulerTables.some(tableName => existingTables.has(tableName))) return false;
  if (existingTables.has("system_data_migration")) {
    if (force) {
      await connection.execute(
        "delete from system_data_migration where id = ?",
        [SCHEDULED_TRIGGER_SCHEMA_MIGRATION_ID],
      );
    } else {
      const completed = await connection.execute<Array<{ id: string }>>(
        "select id from system_data_migration where id = ? limit 1",
        [SCHEDULED_TRIGGER_SCHEMA_MIGRATION_ID],
      );
      if (completed.length) return false;
    }
  }

  const statements: Array<[string, string]> = [
    [
      "flow_schedule_definition",
      "update \"flow_schedule_definition\" set \"initiator_user_id\" = 'admin' where \"initiator_user_id\" is null or \"initiator_user_id\" = ''",
    ],
    [
      "flow_schedule_definition",
      "update \"flow_schedule_definition\" set \"lifecycle_epoch\" = 0 where \"lifecycle_epoch\" is null",
    ],
    [
      "flow_schedule_definition",
      "update \"flow_schedule_definition\" set \"head_version\" = 0 where \"head_version\" is null",
    ],
    [
      "flow_schedule_definition",
      "update \"flow_schedule_definition\" set \"head_dirty\" = 1 where \"state\" in ('active', 'building') and (\"head_dirty\" is null or \"head_dirty\" = 0)",
    ],
    [
      "flow_schedule_fire",
      "update \"flow_schedule_fire\" set \"lifecycle_epoch\" = 0 where \"lifecycle_epoch\" is null",
    ],
    [
      "flow_scheduled_run",
      "update \"flow_scheduled_run\" set \"initiator_user_id\" = 'admin' where \"initiator_user_id\" is null or \"initiator_user_id\" = ''",
    ],
    [
      "flow_scheduled_run",
      "update \"flow_scheduled_run\" set \"lifecycle_epoch\" = 0 where \"lifecycle_epoch\" is null",
    ],
    [
      "flow_schedule_projection_change",
      "update \"flow_schedule_projection_change\" set \"state\" = 'pending' where \"state\" is null or \"state\" = ''",
    ],
    [
      "flow_schedule_projection_change",
      "update \"flow_schedule_projection_change\" set \"available_at\" = coalesce(nullif(\"updated_at\", 0), cast(strftime('%s','now') as integer) * 1000) where \"available_at\" is null or \"available_at\" = 0",
    ],
    [
      "flow_schedule_projection_change",
      "update \"flow_schedule_projection_change\" set \"attempt_count\" = 0 where \"attempt_count\" is null",
    ],
  ];
  await connection.transactional(async transaction => {
    for (const [tableName, statement] of statements) {
      if (!existingTables.has(tableName)) continue;
      await connection.execute(statement, [], "run", transaction);
    }
    if (existingTables.has("system_data_migration")) {
      await connection.execute(
        "insert or ignore into system_data_migration (id, completed_at) values (?, ?)",
        [SCHEDULED_TRIGGER_SCHEMA_MIGRATION_ID, Date.now()],
        "run",
        transaction,
      );
    }
  });
  logger.warn("sqlite scheduler columns backfilled with durable defaults");
  return true;
}

async function hasMissingScheduledTriggerBackfillColumns(orm: MikroORM): Promise<boolean> {
  const connection = orm.em.getConnection() as SystemSqliteConnection;
  for (const [tableName, requiredColumns] of Object.entries(SCHEDULED_TRIGGER_BACKFILL_COLUMNS)) {
    const columns = await connection.execute<Array<{ name: string }>>(
      `pragma table_info("${escapeSqliteIdentifier(tableName)}")`,
    );
    if (!columns.length) continue;
    const columnNames = new Set(columns.map(column => column.name));
    if ([...requiredColumns].some(columnName => !columnNames.has(columnName))) return true;
  }
  return false;
}

async function assertNoScheduledTriggerDuplicateBusinessKeys(orm: MikroORM): Promise<void> {
  const connection = orm.em.getConnection() as SystemSqliteConnection;
  const tables = await connection.execute<Array<{ name: string }>>(
    "select name from sqlite_master where type = 'table'",
  );
  const indexes = await connection.execute<Array<{ name: string; sql?: string }>>(
    "select name, sql from sqlite_master where type = 'index'",
  );
  const existingTables = new Set(tables.map(row => row.name));

  for (const key of SCHEDULED_TRIGGER_UNIQUE_KEYS) {
    if (!existingTables.has(key.tableName)) continue;
    const existingIndex = indexes.find(row => row.name === key.indexName);
    if (existingIndex && /^create\s+unique\s+index/i.test(existingIndex.sql || "")) {
      const indexColumns = await connection.execute<Array<{ name: string; seqno: number }>>(
        `pragma index_info("${escapeSqliteIdentifier(key.indexName)}")`,
      );
      const actualColumns = indexColumns.sort((left, right) => left.seqno - right.seqno).map(column => column.name);
      if (actualColumns.length === key.columns.length && key.columns.every((column, index) => column === actualColumns[index])) {
        continue;
      }
    }
    const tableColumns = await connection.execute<Array<{ name: string }>>(
      `pragma table_info("${escapeSqliteIdentifier(key.tableName)}")`,
    );
    const columnNames = new Set(tableColumns.map(column => column.name));
    if (key.columns.some(columnName => !columnNames.has(columnName))) continue;

    const selectedColumns = key.columns.map(columnName => `"${escapeSqliteIdentifier(columnName)}"`).join(", ");
    const duplicates = await connection.execute<Array<Record<string, unknown> & { duplicate_count: number }>>(
      `select ${selectedColumns}, count(*) as duplicate_count from "${escapeSqliteIdentifier(key.tableName)}" group by ${selectedColumns} having count(*) > 1 limit 1`,
    );
    if (!duplicates.length) continue;

    const duplicate = duplicates[0];
    const values = key.columns
      .map(columnName => `${columnName}=${JSON.stringify(duplicate[columnName])}`)
      .join(", ");
    throw new ScheduledTriggerSchemaConflictError(
      `Scheduler schema upgrade blocked: cannot create unique index ${key.indexName} on ${key.tableName} (${key.columns.join(", ")}) because a duplicate business key was found (${values}; duplicate rows: ${duplicate.duplicate_count}). Back up the database, deduplicate these scheduler rows, then restart the application. No schema changes were applied.`,
    );
  }
}

function escapeSqliteIdentifier(value: string): string {
  return value.replace(/"/g, '""');
}

type SqliteColumnInfo = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

async function makeObsoleteSqliteColumns(orm: MikroORM): Promise<void> {
  const connection = orm.em.getConnection() as SystemSqliteConnection;
  const targetSchema = (orm.getSchemaGenerator() as SchemaGenerator).getTargetSchema();
  const knex = connection.getKnex();

  for (const table of targetSchema.getTables()) {
    const tableName = table.name as string;
    const expectedColumns = new Set(table.getColumns().map((column: { name: string }) => column.name));
    const escapedTableName = tableName.replace(/'/g, "''");
    const actualColumns = await connection.execute<SqliteColumnInfo[]>(
      `pragma table_info('${escapedTableName}')`,
    );
    const obsoleteColumns = actualColumns.filter(column => (
      !expectedColumns.has(column.name)
      && column.notnull === 1
      && column.pk === 0
    ));
    if (!obsoleteColumns.length) {
      continue;
    }

    await connection.executeSchemaBuilder(
      knex.schema.alterTable(tableName, tableBuilder => {
        for (const column of obsoleteColumns) {
          const columnBuilder = tableBuilder
            .specificType(column.name, column.type || "text")
            .nullable();
          if (column.dflt_value !== null) {
            columnBuilder.defaultTo(knex.raw(column.dflt_value));
          }
          columnBuilder.alter();
        }
      }),
    );
  }
}

function getSqliteColumnDefault(column: { type?: string; default?: string; name: string }): string {
  if (column.default !== undefined && column.default !== null) {
    return String(column.default);
  }
  if (/int|real|numeric|decimal/i.test(column.type || "")) {
    return "0";
  }
  if (/roles|departments/i.test(column.name)) {
    return "'[]'";
  }
  if (column.type === "json" || /permissions|metadata/i.test(column.name)) {
    return "'{}'";
  }
  return "''";
}
