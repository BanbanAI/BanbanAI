import {
  AnyEntity,
  Configuration,
  EntityDictionary,
  NativeInsertUpdateManyOptions,
  QueryResult,
} from "@mikro-orm/core";
import { AbstractSqlDriver } from "@mikro-orm/knex";
import { BetterSqlitePlatform } from "@mikro-orm/better-sqlite";
import { SystemSqliteConnection } from "./system-sqlite-connection";

export class SystemSqliteDriver extends AbstractSqlDriver<SystemSqliteConnection> {
  constructor(config: Configuration) {
    super(config, new BetterSqlitePlatform(), SystemSqliteConnection, ["knex", "better-sqlite3"]);
  }

  async nativeInsertMany<T extends AnyEntity<T>>(
    entityName: string,
    data: EntityDictionary<T>[],
    options: NativeInsertUpdateManyOptions<T> = {},
  ): Promise<QueryResult<T>> {
    options.processCollections ??= true;
    const result = await super.nativeInsertMany(entityName, data, options);
    const primaryKeys = this.getPrimaryKeyFields(entityName);
    const firstInsertId = Number(result.insertId) - data.length + 1;
    result.rows ??= [];
    data.forEach((item, index) => {
      result.rows[index] = {
        [primaryKeys[0]]: item[primaryKeys[0]] ?? firstInsertId + index,
      };
    });
    result.row = result.rows[0];
    return result;
  }
}
