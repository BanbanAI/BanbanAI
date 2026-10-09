import { FormDatabaseConfig, FormDatabaseType } from "@common/types/nocode";
import { FormDataStoreScope } from "@common/types/project";
import { MongoDb, MongoDbConnection } from "./database/mongodb";
import { BaseDbConnection } from "./utils";
export class DatabaseConnection {
  private connection: BaseDbConnection;
  constructor(private type: Exclude<FormDatabaseType, FormDatabaseType.EMBEDDED>, private config: FormDatabaseConfig) {
    if (this.type === FormDatabaseType.MONGODB) {
      this.connection = new MongoDbConnection(config);
    }

  }

  async connect() {
    if (this.connection) {
      return await this.connection.connect();
    }
    return null;
  }

  async disconnect() {
    if (this.connection) {
      return await this.connection.close();
    }
    return null;
  }

  async getDb(nocodeId: string, tableId: string, scope: FormDataStoreScope = "main") {
    if (this.connection) {
      const collectionName = scope === "draft"
        ? `${nocodeId}_draft_${tableId}`
        : `${nocodeId}_${tableId}`;
      return await this.connection.getDb("banban_form_data", collectionName);
    }
    return null;
  }

  get isConnected() {
    return this.connection.isConnectionActive();  
  }
}
