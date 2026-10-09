import { Entity, EntityRepository, Property } from "@mikro-orm/core";
import { unique } from "@common/utils/unique";
import { PrimaryKey } from "@main/decorators/primary-key";


@Entity({
  tableName: 'account',
  customRepository: () => WorkbenchUserRepository
})
export class WorkbenchUser {
  @PrimaryKey({ mongoLike: global.mongoLike, length: 20 })
  id: string = unique(20);

  @Property()
  user: string;

  @Property()
  pass: string

  @Property()
  realname: string = '';

  @Property()
  root: boolean = false;

  @Property({ nullable: true, columnType: "bigint" })
  loginTime: number = 0;

  @Property()
  roles: string[] = [];

  @Property()
  departments: string[] = [];

  @Property({ nullable: true })
  staffNo: string = '';

  @Property()
  phone: string = '';

  @Property()
  email: string = '';

  @Property({ nullable: true })
  isAdmin?: boolean = false;

  @Property({ nullable: true, hidden: true })
  apiKey?: string;

  @Property({ nullable: true, hidden: true })
  apiSecret?: string;

  @Property({ columnType: "bigint" })
  createTime: number = Date.now();
  
  @Property({ columnType: "bigint" })
  updateTime: number = Date.now();

}

export class WorkbenchUserRepository extends EntityRepository<WorkbenchUser> {
}
