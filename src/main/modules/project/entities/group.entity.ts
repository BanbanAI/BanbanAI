import { Entity, Property, EntityRepository } from "@mikro-orm/core";
import { PrimaryKey } from "@main/decorators/primary-key";
import { unique } from '@common/utils/unique';

@Entity({
  tableName: "group",
  customRepository: () => GroupRepository,
})
export class Group {
  @PrimaryKey({mongoLike: global.mongoLike})
  id: string = unique();

  @Property()
  name: string = "";

  @Property({ default: 0 })
  sort: number = 0;

  @Property({ columnType: "bigint" })
  createTime: number = Date.now();
}

export class GroupRepository extends EntityRepository<Group> {
}
