import { ProcessNodeStatus } from "@common/types/project";
import { Entity, EntityRepository, Property } from "@mikro-orm/core";
import { unique } from "@common/utils/unique";
import { PrimaryKey } from "@main/decorators/primary-key";

@Entity({
  tableName: "flow_branch_records",
  customRepository: () => FlowBranchRecordsRepository,
})
export class FlowBranchRecords {
  
  @PrimaryKey({mongoLike: global.mongoLike})
  id: string = unique();

  /** 分支节点uid */
  @Property({ type: "string" })
  flowId: string;

  //** 数据uuid  */
  @Property({ type: "string" })
  uuid: string

  @Property({ nullable: true, type: "string" })
  todoId: string
  
  /** 分支状态 */
  @Property({ type: "string" })
  status: ProcessNodeStatus

  @Property({ type: "json" })
  branchIds: string[]

}

export class FlowBranchRecordsRepository extends EntityRepository<FlowBranchRecords> {
}
