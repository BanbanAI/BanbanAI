import { FlowTriggerContext, FlowTriggerSkipReason, FormDataColumn, FormDataTableExtra, NocodeFormData } from "@common/types/nocode"
import { AppUID, DataChangeType, TableUID, Row, FieldUID, Field } from "@common/types/project";
import type { Account } from "@common/types/account";
import type { FormDataStage } from "@common/utils";

export type TransformRowOptions = {
  transformType?: boolean,
}

export type Raw = {
  isLost?: boolean,
  tableName: string,
  tableUid: string,
  columns: FormDataColumn[],
  data?: any[],
  count?: number, // for table
  extra?: FormDataTableExtra,
}

export type RawData = Raw[];

export type DocumentIndexKey = `${AppUID}-${TableUID}`;

export type TriggerOptions = {
  triggerTodo?: boolean,
  source?: DataChangeType,
  stashFlow?: boolean,
  validatePermission?: boolean,
  allowDataOwnerUpdate?: boolean,
  ignoreUpdatePermissionDataStatus?: boolean,
  importTaskId?: string,
  triggerContext?: FlowTriggerContext,
  crossAppTriggerResult?: FlowTriggerResult,
  skipSubscribeTaskUpdate?: boolean,
  deferPostMutation?: boolean,
  skipNodeIds?: string[],
  runtimeAccount?: Account,
  beforeMutationRows?: Row[],
  causedByTodoId?: string,
  causedByTaskId?: string,
  skipCancelInProgressTodos?: boolean,
  failOnPostMutationError?: boolean,
  /** Pool used for read-only trigger-condition evaluation when canary mode is enabled. */
  conditionWorkerQueue?: "p0" | "p1",
  /** Durable task lease used by the worker-driven node route. */
  flowWorkerContext?: {
    taskId: string,
    leaseOwner: string,
    leaseVersion: number,
    queueClass?: "p0" | "p1",
  },
  deleteStage?: FormDataStage,
}

export type DataChangeFlowQueueState = {
  previousRows: Row[],
}

export type FlowTriggerResult = {
  triggered: boolean,
  skippedReason?: FlowTriggerSkipReason,
  triggeredTodoId?: string,
}

export type FlowDerivedPostMutationOptions = {
  preparedTaskId?: string,
  eventId: string,
  source: DataChangeType.ADD | DataChangeType.EDIT | DataChangeType.DELETE,
  formData: NocodeFormData,
  nocodeId: string,
  tableUID: TableUID,
  rows: Row[],
  beforeMutationRows?: Row[],
  triggerContext?: FlowTriggerContext,
  causedByTodoId?: string,
  causedByTaskId?: string,
  finalizeDeleteWithoutFlow?: boolean,
}

export type SearchParam = {
  handle: string,
  indexKey: DocumentIndexKey,
  query: any,
  rows?: Row[],
  fields: any[],
  uid: FieldUID
};
