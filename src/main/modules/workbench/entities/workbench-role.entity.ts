import { Entity, Property, EntityRepository } from "@mikro-orm/core";
import { PrimaryKey } from "@main/decorators/primary-key";
import { unique } from "@common/utils/unique";

@Entity({
  tableName: "role"
})
export class WorkbenchRole {
  @PrimaryKey({mongoLike: global.mongoLike})
  id: string = unique(20);

  @Property()
  name: string;

  @Property({ nullable: true })
  parent: string = "";

  @Property()
  isGroup: boolean = false;

  @Property({ columnType: "bigint" })
  createTime: number = Date.now();

  @Property({ columnType: "bigint" })
  updateTime: number = Date.now();

  @Property({ columnType: "bigint" })
  deleteTime: number = 0;

}
export class WorkbenchRoleRepository extends EntityRepository<WorkbenchRole> {}
