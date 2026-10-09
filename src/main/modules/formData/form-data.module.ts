import { Global, Module } from "@nestjs/common";
import { FormDataController } from "./form-data.controller";
import { FormDataService } from "./form-data.service";
import { DbManager } from "./db.manager";
import { FormDataConnector } from "./form-data.connector";
import { FormFlowService } from "./form-flow.service";
import { FormFlowController } from "./form-flow.controller";
import { DraftStorageStateService } from "./draft-storage-state.service";
import { ScheduledTriggerRepository } from "./scheduled-trigger/scheduled-trigger.repository";
import { ScheduledFlowStarterAdapter } from "./scheduled-trigger/scheduled-flow-starter.adapter";
import { SCHEDULED_FLOW_STARTER, ScheduledRunWorkerPool } from "./scheduled-trigger/scheduled-run-worker-pool";
import { ScheduleDefinitionService } from "./scheduled-trigger/schedule-definition-service";
import { DueDispatcher, SCHEDULED_DUE_PROVIDER } from "./scheduled-trigger/due-dispatcher";
import { ScheduledTriggerController } from "./scheduled-trigger/scheduled-trigger.controller";
import { ScheduledTriggerSignal } from "./scheduled-trigger/scheduled-trigger-signal";
import { ScheduledTriggerMaintenance } from "./scheduled-trigger/scheduled-trigger-maintenance";
import { ScheduledTriggerSystemWake } from "./scheduled-trigger/scheduled-trigger-system-wakeup";
import { ScheduledTriggerReconciliation } from "./scheduled-trigger/scheduled-trigger-reconciliation";
import { ScheduledTriggerStartupBarrier } from "./scheduled-trigger/scheduled-trigger-startup-barrier";
import { ScheduledTriggerSubscriptionBackfill } from "./scheduled-trigger/scheduled-trigger-subscription-backfill";
import { ViewActionTriggerTaskService } from "./view-action-trigger-task.service";
import { FlowWorkerPool } from "./flow-worker-pool";

@Global()
@Module({
  controllers: [ FormDataController, FormFlowController, ScheduledTriggerController ],
  providers: [
    FormDataService,
    FormDataConnector,
    DbManager,
    FormFlowService,
    FlowWorkerPool,
    DraftStorageStateService,
    ViewActionTriggerTaskService,
    ScheduledTriggerSignal,
    ScheduledTriggerStartupBarrier,
    ScheduledTriggerRepository,
    ScheduleDefinitionService,
    ScheduledTriggerSubscriptionBackfill,
    { provide: SCHEDULED_DUE_PROVIDER, useExisting: ScheduleDefinitionService },
    DueDispatcher,
    ScheduledFlowStarterAdapter,
    { provide: SCHEDULED_FLOW_STARTER, useExisting: ScheduledFlowStarterAdapter },
    ScheduledRunWorkerPool,
    ScheduledTriggerMaintenance,
    ScheduledTriggerSystemWake,
    ScheduledTriggerReconciliation,
  ],
  exports: [ FormDataConnector, FormDataService, FormFlowService, DbManager, DraftStorageStateService, ViewActionTriggerTaskService, ScheduleDefinitionService, ScheduledTriggerRepository, ScheduledTriggerSignal, ScheduledTriggerSystemWake ],
})
export class FormDataModule {

}
