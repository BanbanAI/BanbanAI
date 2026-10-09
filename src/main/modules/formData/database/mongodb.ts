import { FormDatabaseConfig } from "@common/types/nocode";
import { BaseDb, BaseDbConnection, FindOptions, RemoveOptions, UpdateOptions } from "../utils"
import { MongoClient, Db, Collection, Filter, IndexDescription, OptionalId, UpdateFilter, UpdateResult, DeleteResult, Sort, AnyBulkWriteOperation, Document } from "mongodb"
import { SystemField } from "@common/utils";
import { SortType } from "@common/types/project";
import { isEmpty } from "@common/utils/object";

export class MongoDbConnection extends BaseDbConnection {
  private client: MongoClient;
  private isConnected: boolean = false;

  constructor(private config: FormDatabaseConfig) {
    super();
    const { host, port, username, password, authDatabase } = config;
    
    const credentials = username && password ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@` : '';
    const connectionString = `mongodb://${credentials}${host}:${port}`;
    
    this.client = new MongoClient(connectionString, {
      // useUnifiedTopology: true,
      authSource: username ? (authDatabase ? authDatabase : 'admin') : undefined,
      // maxPoolSize: 10,
      // minPoolSize: 2,
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 10_000,
    });
  }

  async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        console.log('MongoDB already connected');
        return;
      }
      await this.client.connect();
      await this.client.db('admin').command({ ping: 1 });
      this.isConnected = true;
      console.log('MongoDB connected successfully');
    } catch (error) {
      this.isConnected = false;
      throw new Error(`MongoDB connection failed: ${error.message}`);
    }
  }

  async close(): Promise<void> {
    try {
      if (!this.isConnected) {
        console.log('MongoDB already closed');
        return;
      }

      await this.client.close();
      this.isConnected = false;
      console.log('MongoDB connection closed');
    } catch (error) {
      throw new Error(`MongoDB close failed: ${error.message}`);
    }
  }

  private getDatabase(dbName: string): Db {
    if (!this.isConnected) {
      throw new Error('MongoDB is not connected. Call connect() first.');
    }
    return this.client.db(dbName);
  }

  private getCollection(dbName: string, collectionName: string): Collection {
    return this.getDatabase(dbName).collection(collectionName);
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  async getDb(databaseName: string, tableName: string): Promise<MongoDb> {
    const collection = this.getCollection(databaseName, tableName);
    return new MongoDb(collection);
  }
}

export class MongoDb extends BaseDb {

  constructor(private collection: Collection) {
    super();
  }

  async ensureIndexes(indexes: IndexDescription[]) {
    if (indexes.length) {
      await this.collection.createIndexes(indexes);
    }
  }

  private buildMongoProjection(projection?: string[]) {
    if (!projection?.length) return undefined;
    return projection.reduce<Record<string, 1>>((result, key) => {
      if (key) {
        result[key] = 1;
      }
      return result;
    }, {});
  }

  async find<Q = Filter<Document>, O extends FindOptions = FindOptions>(query: Q = {} as Q, options: O = {} as O): Promise<any[]> {
    try {
      const cleanedQuery = this.cleanQuery(query);
      let cursor = this.collection.find(cleanedQuery);
      const projection = this.buildMongoProjection(options.projection);

      if (projection) {
        cursor = cursor.project(projection);
      }

      if (!isEmpty(options?.sort) && typeof options?.sort === 'object') {
        const mongoSort: Record<string, SortType> = {};
        for (const [field, sortType] of Object.entries(options.sort)) {
          mongoSort[field] = sortType || -1;
        }
        cursor = cursor.sort(mongoSort);
      } else {
        cursor = cursor.sort({ [SystemField.CREATE_TIME]: options.sort || -1 } as Sort);
      }

      if (options.skip) {
        cursor = cursor.skip(options.skip);
      }

      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }

      const results = await cursor.toArray();
      return results;
    } catch (error) {
      throw new Error(`MongoDB find operation failed: ${error.message}`);
    }
  }
  async findOne<Q = Filter<Document>, O extends FindOptions = FindOptions>(query: Q = {} as Q, options: O = {} as O): Promise<any> {
    try {
      const cleanedQuery = this.cleanQuery(query);
      let findOptions: any = {};
      const projection = this.buildMongoProjection(options.projection);

      if (!isEmpty(options.sort) && typeof options.sort === 'object') {
        const mongoSort: Record<string, SortType> = {};
        for (const [field, sortType] of Object.entries(options.sort)) {
          mongoSort[field] = sortType || -1;
        }
        findOptions.sort = mongoSort;
      } else {
        findOptions.sort = { [SystemField.CREATE_TIME]: options.sort || -1 };
      }

      if (options.skip) {
        findOptions.skip = options.skip;
      }
      if (projection) {
        findOptions.projection = projection;
      }

      const result = await this.collection.findOne(cleanedQuery, findOptions);
      return result;
    } catch (error) {
      throw new Error(`MongoDB findOne operation failed: ${error.message}`);
    }
  }
  async findWithCount<Q = Filter<Document>, O extends FindOptions = FindOptions>(query: Q = {} as Q, options: O = {} as O): Promise<{ docs: any[]; count: number; }> {
    try {
      const cleanedQuery = this.cleanQuery(query);
      const count = await this.collection.countDocuments(cleanedQuery);
      
      const docs = await this.find(query, options);

      return { docs, count };
    } catch (error) {
      throw new Error(`MongoDB findWithCount operation failed: ${error.message}`);
    }
  }
  async insert<T = OptionalId<Document>>(data: T): Promise<any[]> {
    try {
      if (Array.isArray(data)) {
        const result = await this.collection.insertMany(data);
        
        return Object.values(result.insertedIds).map((id, index) => ({
          ...data[index],
          _id: id
        }));
      } else {
        const result = await this.collection.insertOne(data);
        return [{
          ...data,
          _id: result.insertedId
        }];
      }
    } catch (error) {
      throw new Error(`MongoDB insert operation failed: ${error.message}`);
    }
  }
  async save<T = Document>(docs: T[]): Promise<Record<string, number>[]> {
    if (!docs?.length) return [];
    try {
      const operations: AnyBulkWriteOperation<Document>[] = docs.map((sourceDoc) => {
        const doc = { ...(sourceDoc as Document) };
        if (doc._id == null) {
          return {
            insertOne: {
              document: doc,
            },
          };
        }
        return {
          replaceOne: {
            filter: { _id: doc._id },
            replacement: doc,
            upsert: false,
          },
        };
      });
      const result = await this.collection.bulkWrite(operations, { ordered: true });
      return [{
        insertedCount: result.insertedCount,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
      }];
    } catch (error) {
      throw new Error(`MongoDB save operation failed: ${error.message}`);
    }
  }
  async update<Q = Filter<Document>, S = (Document[] | UpdateFilter<Document>), O extends UpdateOptions = UpdateOptions>(query: Q, updateQuery: S, options = {} as O): Promise<any[]> {
    try {
      const cleanedQuery = this.cleanQuery(query);
      const isMulti = options.multi !== false;
      let result: UpdateResult<Document>;
      if (isMulti) {
        result = await this.collection.updateMany(
          cleanedQuery,
          updateQuery,
          {
            upsert: options.upsert || false
          }
        );
      } else {
        result = await this.collection.updateOne(
          cleanedQuery,
          updateQuery,
          {
            upsert: options.upsert || false
          }
        );
      }
      return [{
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedId: result.upsertedId,
        upsertedCount: result.upsertedCount || 0
      }];
    } catch (error) {
      throw new Error(`MongoDB update operation failed: ${error.message}`);
    }
  }
  async remove<Q = Filter<Document>, O extends RemoveOptions = RemoveOptions>(query: Q, options = {} as O): Promise<any[]> {
    try {
      const cleanedQuery = this.cleanQuery(query);
      const isMulti = options.multi !== false;
      let result: DeleteResult;
      if (isMulti) {
        result = await this.collection.deleteMany(cleanedQuery);
      } else {
        result = await this.collection.deleteOne(cleanedQuery);
      }

      return [{
        deletedCount: result.deletedCount
      }];
    } catch (error) {
      throw new Error(`MongoDB remove operation failed: ${error.message}`);
    }
  }
  async count<Q = Filter<Document>>(query: Q = {} as Q, quiet?: boolean): Promise<number> {
    try {
      const cleanedQuery = this.cleanQuery(query);
      const count = await this.collection.countDocuments(cleanedQuery);
      
      if (!quiet) {
        console.log(`MongoDB count: ${count} documents found`);
      }
      
      return count;
    } catch (error) {
      throw new Error(`MongoDB count operation failed: ${error.message}`);
    }
  }
  async distinct<Q = Filter<Document>, O extends FindOptions = FindOptions>(field: string, query: Q = {} as Q, options = {} as  O): Promise<{ value: any; count: number; }[]> {
    try {
      const cleanedQuery = this.cleanQuery(query);
      const pipeline: any[] = [];

      if (cleanedQuery && Object.keys(cleanedQuery).length > 0) {
        pipeline.push({ $match: cleanedQuery });
      }

      pipeline.push({
        $unwind: {
          path: `$${field}`,
          preserveNullAndEmptyArrays: true
        }
      });

      const sortValue = isEmpty(options.sort) ? SortType.DESC : options.sort;
      let groupValue = {
        createTime: { $max: `$${SystemField.CREATE_TIME}` }
      }
      if (sortValue instanceof Object) {
        for (const key in sortValue) {
          groupValue[key] = { $max: `$${key}` }
        }
      }
      pipeline.push({
        $group: {
          _id: `$${field}`,
          count: { $sum: 1 },
          ...groupValue,
        }
      });

      pipeline.push({
        $project: {
          _id: 0,
          value: '$_id',
          count: 1,
          ...(Object.keys(groupValue).reduce((prev, key) => {
            prev[key] = 1;
            return prev;
          }, {}))
        }
      });

      if (sortValue instanceof Object) {
        pipeline.push({ $sort: sortValue });
      } else {
        pipeline.push({
          $sort: { createTime: sortValue }
        });
      }

      if (options.skip) {
        pipeline.push({ $skip: options.skip });
      }
      if (options.limit) {
        pipeline.push({ $limit: options.limit });
      }

      const results = await this.collection.aggregate(pipeline).toArray();
      return results as { value: any; count: number; }[];
    } catch (error) {
      throw new Error(`MongoDB distinct operation failed: ${error.message}`);
    }
  }
  async close(): Promise<void> {
  }

  private cleanQuery(query: any): any {
    if (!query || typeof query !== 'object') {
      return query;
    }

    if (Array.isArray(query)) {
      return query.map(item => this.cleanQuery(item));
    }

    const cleanedQuery: any = {};

    for (const [key, value] of Object.entries(query)) {
      if (key === '$and') {
        if (Array.isArray(value)) {
          cleanedQuery[key] = value.map(condition => this.cleanQuery(condition));
        }
      } else if (key === '$or') {
        if (Array.isArray(value)) {
          cleanedQuery[key] = value.map(item => this.cleanQuery(item));
        }
      } else if (key === '$not') {
        const notCondition = this.cleanQuery(value);
        cleanedQuery['$nor'] = [notCondition];
      } else if (value && typeof value === 'object') {
        if (value instanceof RegExp) {
          cleanedQuery[key] = this.cleanRegexValue(value);
        } else if ((value as any).$regex && (value as any).$regex instanceof RegExp) {
          cleanedQuery[key] = this.cleanRegexValue((value as any).$regex);
        } else {
          const cleanedValue: any = {};
          for (const [subKey, subValue] of Object.entries(value)) {
            if (subValue instanceof RegExp) {
              cleanedValue[subKey] = this.cleanRegexValue(subValue);
            } else if (subKey === '$not' && subValue && typeof subValue === 'object') {
              cleanedValue[subKey] = this.cleanQuery(subValue);
            } else {
              cleanedValue[subKey] = subValue;
            }
          }
          cleanedQuery[key] = cleanedValue;
        }
      } else {
        cleanedQuery[key] = value;
      }
    }

    return cleanedQuery;
  }

  private cleanRegexValue(regexValue: any): any {
    if (regexValue instanceof RegExp) {
      return {
        $regex: regexValue.source,
        $options: regexValue.flags
      };
    } else if (regexValue && typeof regexValue === 'object' && '$regex' in regexValue) {
      const regex = regexValue.$regex;
      if (regex instanceof RegExp) {
        return {
          $regex: regex.source,
          $options: regex.flags
        };
      }
    }
    return regexValue;
  }


  async updateManyColumns<Q = any, K extends object = Record<string, string>>(query: Q, keyMap: K): Promise<any> {
    const setValue: Record<string, string> = {};
    for (const key in keyMap) {
      setValue[key] = `$${keyMap[key]}`;
    }
    await this.collection.updateMany(query, [{
      $set: setValue
    }])
  }
  
}
