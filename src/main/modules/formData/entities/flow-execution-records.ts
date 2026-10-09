import { FlowOpinionFile, ProcessNodeStatus, ProcessNodeType, SubmitRecord, TableUID, TimeTaskRepeat, TODOTriggerType, TransfersRecord as TransferRecord, TriggerMode, DataChangeType } from "@common/types/project";
import { FlowTriggerSkipReason } from "@common/types/nocode";
import { Entity, EntityRepository, Property, Unique } from "@mikro-orm/core";
import { unique } from "@common/utils/unique";
import { PrimaryKey } from "@main/decorators/primary-key";

export type FlowExecutionRecordMeta = {
  comment?: string,
  tip?: string,
  commentImages?: FlowOpinionFile[],
  commentFiles?: FlowOpinionFile[],
  timeoutAutoAction?: "submit" | "back",
  updateTime?: number,
  back?: boolean,
  backId?: string,
  cancel?: boolean,
  finishFlow?: boolean,
  source?: TODOTriggerType,
  entryId?: string,
  operationId?: string,
  operationDisplayName?: string,
  reject?: boolean,
  targetTableUID?: TableUID,
  timeTaskRepeat?: TimeTaskRepeat,
  timeTaskTriggerMode?: TriggerMode,
  singleOnceTimeTask?: boolean,
  emptyRowTrigger?: boolean,
  crossAppWriteTargetNocodeId?: string,
  crossAppWriteTargetTableUID?: TableUID,
  crossAppWriteAction?: DataChangeType,
  crossAppTriggeredTodoId?: string,
  crossAppTriggerSkippedReason?: FlowTriggerSkipReason,
  timeoutDeadlineAt?: number,
  timeoutRuleExecutedAtMap?: Record<string, number>,
  scheduledStartProgress?: "recorded" | "row_updated" | "next_node_enqueued",
  stashedTargetNocodeId?: string,
  stashedTargetTableUID?: TableUID,
  stashedTargetUUID?: string,
}

@Entity({
  tableName: "flow_execution_records",
  customRepository: () => FlowExecutionRecordsRepository,
})
@Unique({ name: "flow_execution_records_scheduled_run_unique", properties: ["scheduledRunId"] })
export class FlowExecutionRecords {
  
  @PrimaryKey({mongoLike: global.mongoLike})
  id: string = unique();

  /** 节点uid */
  @Property({ type: "string" })
  flowId: string;

  /** 节点类型 */
  @Property({ type: "string" })
  type: ProcessNodeType

  /** 节点状态 */
  @Property({ type: "string" })
  status: ProcessNodeStatus

  /** 处理了该节点的人的id */
  @Property({ nullable: true, type: "json" })
  operators: string[]

  /** 需要处理该节点的人的id */
  @Property({ nullable: true, fieldName: "padding_operators", type: "json" })
  paddingOperators: string[]

  /** 应用id */
  @Property({ type: "string" })
  nocodeId: string

  @Property({ type: "string" })
  tableId: TableUID

  @Property({ type: "string" })
  uuid: string

  /** 流程实例绑定的流程版本 */
  @Property({ nullable: true, fieldName: "process_version" })
  processVersion?: number

  @Property({ nullable: true, fieldName: "todo_id", type: "string" })
  todoId: string

  @Property({ nullable: true, fieldName: "scheduled_run_id", type: "string" })
  scheduledRunId?: string

  @Property({ nullable: true, fieldName: "scheduled_for", type: "bigint" })
  scheduledFor?: number

  /** 节点开始时间 */
  @Property({ type: "bigint" })
  startTime: number

  /** 节点结束时间 */
  @Property({ type: "bigint", nullable: true })
  endTime: number

  /** @deprecated 转交表 */
  @Property({ type: "json", nullable: true })
  transfer: Record<string, string>

  /** 转交记录 */
  @Property({ type: "json", nullable: true })
  transferRecords: TransferRecord[]

  /** 提交记录 */
  @Property({ type: "json", nullable: true })
  submitRecords: SubmitRecord[]

  @Property({ nullable: true, fieldName: "is_stashed", type: "boolean" })
  isStashed?: boolean

  @Property({ nullable: true, fieldName: "stash_time", type: "bigint" })
  stashTime?: number

  @Property({ nullable: true, fieldName: "stash_operator_id", type: "string" })
  stashOperatorId?: string

  /** 节点信息，如意见、会签时间 */
  @Property({ type: "json", nullable: true })
  metas: Record<string, FlowExecutionRecordMeta>

  /** 删除了该节点记录的人的id */
  @Property({ nullable: true, fieldName: 'deleted_users', type: "json" })
  deletedUsers: string[]
}

export class FlowExecutionRecordsRepository extends EntityRepository<FlowExecutionRecords> {
  private timer = null;
  private delayFlush() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.flush();
    }, 1000)
  }
  persistAndDelayFlush(records: FlowExecutionRecords | FlowExecutionRecords[]) {
    this.persist(records);
    this.delayFlush();
  }
}
