import { Entity, Property, EntityRepository, BeforeDelete, BeforeUpdate, EventArgs } from "@mikro-orm/core";
import { PrimaryKey } from "@main/decorators/primary-key";
import { unique } from '@common/utils/unique';
import { PublishUpdateMethod } from "@common/types/project";
import { NocodeImportRestriction } from "@common/types/nocode";
import { ApiTableSetting } from "../types";
import { LRUCache } from "lru-cache";

@Entity({
  tableName: "nocode",
  customRepository: () => NocodeRepository,
})
export class Nocode {
  @PrimaryKey({mongoLike: global.mongoLike})
  id: string = unique();

  @Property()
  parent: string = "";

  @Property()
  name: string = "";

  @Property({ nullable: true })
  description: string = "";

  @Property({ nullable: true })
  groupId: string = null;

  @Property({ columnType: "bigint" })
  createTime: number = Date.now();

  @Property({ nullable: true, columnType: "bigint" })
  deleteTime: number;

  @Property({ nullable: true })
  deleted?: boolean;

  @Property({ nullable: true, type: "string" })
  updateMethod?: PublishUpdateMethod = PublishUpdateMethod.LIVE;

  @Property({ nullable: true, type: "string" })
  innerUpdateMethod?: PublishUpdateMethod = PublishUpdateMethod.LIVE;

  @Property({ nullable: true, type: "string" })
  publicUpdateMethod?: PublishUpdateMethod = PublishUpdateMethod.LIVE;

  @Property({ nullable: true, type: "json" })
  importRestriction?: NocodeImportRestriction;
  
  @Property({ nullable: true })
  isPublish?: boolean = true;

  @Property({ nullable: true })
  manualChanged?: boolean = false;

  @Property({ nullable: true })
  apiEnabled: boolean = false;

  @Property({ nullable: true })
  apiAlias: string = '';

  @Property({ nullable: true, type: "json" })
  apiTableInfo: ApiTableSetting[];

  @Property({ default: 0 })
  sort: number = 0;


  @BeforeUpdate()
  @BeforeDelete()
  clearCache(args: EventArgs<Nocode>) {
    const entity = args.entity;
    const deletedKeys = [];
    for (const [key, value] of nocodeEntityCache) {
      if (value.id === entity.id) {
        deletedKeys.push(key);
      }
    }
    for (const key of deletedKeys) {
      nocodeEntityCache.delete(key);
    }
  }
}


const nocodeEntityCache = new LRUCache<string, Nocode>({
  max: 100,
});
export class NocodeCache {
  static set(entity: Nocode) {
    nocodeEntityCache.set(entity.id, entity);
    if (entity.apiAlias) {
      nocodeEntityCache.set(entity.apiAlias, entity);
    }
  }

  static get(idOrAlias: string) {
    return nocodeEntityCache.get(idOrAlias);
  }
}


export class NocodeRepository extends EntityRepository<Nocode> {
}
