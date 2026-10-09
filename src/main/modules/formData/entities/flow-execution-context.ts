import { Entity, EntityRepository, Property } from "@mikro-orm/core";
import { unique } from "@common/utils/unique";
import { PrimaryKey } from "@main/decorators/primary-key";
import { FlowTriggerContext, ViewActionTriggerContext } from "@common/types/nocode";
import { DataChangeType, ProcessNodeStatus, Row } from "@common/types/project";

@Entity({
  tableName: "flow_execution_context",
  customRepository: () => FlowExecutionContextRepository,
})
export class FlowExecutionContext {
  
  @PrimaryKey({mongoLike: global.mongoLike})
  id: string = unique();

  @Property({ nullable: true, type: "string" })
  todoId: string
  
  @Property({ nullable: true, type: "json" })
  data: any

  @Property({ nullable: true, fieldName: "skip_node_ids", type: "json" })
  skipNodeIds: string[]

  @Property({ nullable: true, fieldName: "view_action_trigger_context", type: "json" })
  viewActionTriggerContext?: ViewActionTriggerContext

  @Property({ nullable: true, fieldName: "trigger_row_snapshot", type: "json" })
  triggerRowSnapshot?: Row

  @Property({ nullable: true, fieldName: "display_row_snapshot", type: "json" })
  displayRowSnapshot?: Row

  @Property({ nullable: true, fieldName: "display_snapshot_action", type: "string" })
  displaySnapshotAction?: DataChangeType

  @Property({ nullable: true, fieldName: "final_status", type: "string" })
  finalStatus?: ProcessNodeStatus

  @Property({ nullable: true, fieldName: "trigger_context", type: "json" })
  triggerContext?: FlowTriggerContext

  @Property({ nullable: true, fieldName: "caused_by_todo_id", type: "string" })
  causedByTodoId?: string

  @Property({ nullable: true, fieldName: "caused_by_task_id", type: "string" })
  causedByTaskId?: string

}

export class FlowExecutionContextRepository extends EntityRepository<FlowExecutionContext> {
}
