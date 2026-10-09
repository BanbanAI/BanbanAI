import { DBInfo, FormDatabaseConfig, FormDatabaseType, FormDataTable, Nocode } from "@common/types/nocode";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { BaseDb, LevelDB } from "./utils";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { NOCODES_DIR, PREFERENCES } from "@main/constants";
import { rm } from "fs/promises";
import { Preferences } from "../common";
import { DatabaseConnection } from "./database-connection";
import { isEmpty } from "@common/utils/object";
import md5 from "md5";
import { FormDataStoreScope } from "@common/types/project";

@Injectable()
export class DbManager {
  private readonly logger = new Logger("DbManager");

  constructor(
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(PREFERENCES) private readonly preferences: Preferences,
  ) {

  }

  private _getDBDir(nocodeId: string, scope: FormDataStoreScope = "main") {
    return join(this.nocodesDir, nocodeId, scope === "draft" ? "form-draft" : "form-data");
  }

  private _dbs = new Map<string, Promise<BaseDb>>();
  private connections: Record<string, DatabaseConnection> = {};
  private async _getDB(nocodeId: string, table: FormDataTable, options: DBInfo & { type: FormDatabaseType }, scope: FormDataStoreScope = "main"): Promise<BaseDb> {
    const { type, ...config } = options;
    if (type === FormDatabaseType.EMBEDDED) {
      const tableDir = join(this._getDBDir(nocodeId, scope), table.uid);
      if (!existsSync(tableDir)) mkdirSync(tableDir, { recursive: true });
      const db = new LevelDB(table.tableName, {
        tableDir,
      });
      return db;
    } else {
      if (isEmpty(config)) throw new Error(global.i18next.t('dbManager.dbConnNotConfigured'));
      const connectionConfig = config as FormDatabaseConfig;
      const key = md5(JSON.stringify(connectionConfig));
      if (!this.connections[key]) {
        this.connections[key] = new DatabaseConnection(type, connectionConfig);
        await this.connections[key].connect();
      }
      const db = await this.connections[key].getDb(nocodeId, table.uid, scope);
      return db;
    }
  }

  public async getDB(nocodeId: string, table: FormDataTable, scope: FormDataStoreScope = "main"): Promise<BaseDb> {
    const key = `${scope}:${nocodeId}_${table.uid}`;
    const currentDbPromise = this._dbs.get(key);
    if (currentDbPromise) return await currentDbPromise;
    const type = this.preferences.get("formDatabaseType", FormDatabaseType.EMBEDDED);
    const options = this.preferences.get("formDatabaseConfig", {});

    let dbPromise: Promise<BaseDb>;
    dbPromise = (async () => {
      if (type !== FormDatabaseType.EMBEDDED) {
        return await this._getDB(nocodeId, table, { type, ...options }, scope);
      }

      let busyCount = 0;
      while (true) {
        try {
          return await this._getDB(nocodeId, table, { type, ...options }, scope);
        } catch (err) {
          busyCount += 1;
          if (busyCount > 100) throw new Error(global.i18next.t('dbManager.linvodbBusy'));
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    })().catch((err) => {
      if (this._dbs.get(key) === dbPromise) {
        this._dbs.delete(key);
      }
      throw err;
    });

    this._dbs.set(key, dbPromise);
    return await dbPromise;
  }

  public async removeDB(nocodeId: string, table: FormDataTable, scope: FormDataStoreScope | "all" = "main") {
    const scopes = scope === "all" ? ["main", "draft"] as FormDataStoreScope[] : [scope];
    for (const currentScope of scopes) {
      const key = `${currentScope}:${nocodeId}_${table.uid}`;
      const dbPromise = this._dbs.get(key);
      if (dbPromise) {
        this._dbs.delete(key);
        const db = await dbPromise;
        await db.close();
      }
      const tableDir = join(this._getDBDir(nocodeId, currentScope), table.uid);
      try {
        await rm(tableDir, { force: true, recursive: true, retryDelay: 100, maxRetries: 3 });
      } catch (err) {
        this.logger.error(global.i18next.t('dbManager.deleteFailInUse'), tableDir, err);
      }
    }
  }

  async testConnect(options: Required<DBInfo>) {
    const { type, ...config } = options;
    if (type === FormDatabaseType.EMBEDDED) return true;
    const connection = new DatabaseConnection(type, config);
    await connection.connect();
    const isConnected = connection.isConnected;
    connection.disconnect();
    return isConnected;
  }

  async dataMigration(options: Required<DBInfo>, nocodes: Nocode[]) {
    for (const { meta, body } of nocodes) {
      if (!body) {
        this.logger.warn("Skip data migration because nocode body is empty", meta.id);
        continue;
      }
      const formData = body.formData;
      if (!formData || !Array.isArray(formData.tables)) {
        this.logger.warn("Skip data migration because formData is missing", meta.id);
        continue;
      }
      const formDataOptionTables = formData.options?.tables;
      if (!Array.isArray(formDataOptionTables)) {
        this.logger.warn("Skip data migration because formData options are missing", meta.id);
        continue;
      }
      for (const table of formData.tables) {
        const tableUID = table?.meta?.uid;
        if (!tableUID) {
          this.logger.warn("Skip data migration table because table meta uid is missing", meta.id, table?.uid);
          continue;
        }
        const formDataTable = formDataOptionTables.find(t => t.uid === tableUID);
        if (!formDataTable) {
          this.logger.warn("Skip data migration table because formData table config is missing", meta.id, table.uid, tableUID);
          continue;
        }
        const originDb = await this.getDB(meta.id, formDataTable);
        const db = await this._getDB(meta.id, formDataTable, options);
        const data = await originDb.find();
        if (!isEmpty(data)) {
          await db.remove({});
          await db.insert(data);
        }
      }
    }
  }

  async closeAll() {
    for (const dbPromise of this._dbs.values()) {
      const db = await dbPromise;
      await db.close();
    }
    this._dbs.clear();
  }
}
