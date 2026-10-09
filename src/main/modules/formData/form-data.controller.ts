import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { FormDataService } from './form-data.service';
import { AggregateTable, DBInfo, EnqueueViewActionTriggerRequest, ExecuteViewActionEditContext, ExecuteViewActionRequest, FormDataColumn, FormDataTableExtra, FormTableRuntime, FormValidateSubmitOptions, FormWidgetType, NocodeFormData, ViewActionFieldId } from '@common/types/nocode';
import { DataChangeType, Field, FieldUID, OptionFieldUID, QueryOptions, Row, Table, TableUID } from '@common/types/project';
import { FormDataStage, isAnonymousAccount } from '@common/utils';
import { getNocodeDataSourceByUID } from '@common/utils/connection';
import { NoLocalAuthGuard } from '../auth/guards';
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { ReturnMainSign } from '../nocode/Interceptors/sign.Interceptor';
import { ProjectService } from '../project/project.services';
import { ViewActionTriggerTaskService } from './view-action-trigger-task.service';
import type { FormDataFindRequest } from '@common/types/form-data-find';
import type { TriggerOptions } from './types';

@Controller("form-data")
export class FormDataController {

  constructor(
    private readonly formDataService: FormDataService,
    private readonly projectService: ProjectService,
    private readonly viewActionTriggerTaskService: ViewActionTriggerTaskService,
  ) {

  }

  private getPublicRowShareToken(req: Request) {
    const token = req.headers['x-row-share-token'];
    return Array.isArray(token) ? token[0] : token;
  }

  private getPublicRowShareAccessToken(req: Request) {
    const token = req.headers['x-row-share-access-token'];
    return Array.isArray(token) ? token[0] : token;
  }

  private getPublicFormShareContext(req: Request) {
    const nocodeId = req.headers['x-public-form-share-nocode-id'];
    const tableId = req.headers['x-public-form-share-table-id'];
    const visitToken = req.headers['x-public-share-visit-token'];
    return {
      nocodeId: Array.isArray(nocodeId) ? nocodeId[0] : nocodeId,
      tableId: Array.isArray(tableId) ? tableId[0] : tableId,
      visitToken: Array.isArray(visitToken) ? visitToken[0] : visitToken,
    };
  }

  private getPublicQueryToken(req: Request) {
    const token = req.headers['x-public-query-token'];
    return Array.isArray(token) ? token[0] : token;
  }

  @NoLocalAuthGuard()
  @Get("/mutation-task-stream")
  streamMutationTask(@Query("taskId") taskId: string, @Res() res: Response) {
    this.viewActionTriggerTaskService.attach(taskId, res);
  }

  private getRequestSign(req: Request) {
    const sign = req.headers['x-sign'];
    return Array.isArray(sign) ? sign[0] : sign;
  }

  private getMutationEventId(req: Request, action: string) {
    const header = req.headers["x-flow-event-id"];
    const headerValue = Array.isArray(header) ? header[0] : header;
    const requestHeader = req.headers["x-request-id"];
    const requestHeaderValue = Array.isArray(requestHeader) ? requestHeader[0] : requestHeader;
    const eventId = String(headerValue || req.body?.eventId || requestHeaderValue || "").trim();
    return eventId && eventId.length <= 200
      ? eventId
      : `${action}:${randomUUID()}`;
  }

  private getMutationIntentReplayResponse(intent: {
    taskId: string;
    replayed?: boolean;
    status?: string;
    queued?: boolean;
  } | null) {
    if (!intent?.replayed) return null;
    return {
      success: !["failed", "unknown"].includes(intent.status || ""),
      taskId: intent.taskId,
      status: intent.status,
      queued: intent.queued === true,
      replayed: true,
    };
  }

  private async resolveMutationSource(nocodeId: string, tableUID: TableUID, req: Request) {
    const rowShareToken = this.getPublicRowShareToken(req);
    const publicFormShare = this.getPublicFormShareContext(req);
    const hasPublicFormContext = Boolean(publicFormShare.nocodeId && publicFormShare.tableId);
    if (!rowShareToken && !hasPublicFormContext && (!req.account || isAnonymousAccount(req.account))) {
      throw new ForbiddenException("Public form context is required");
    }
    const requestSign = this.getRequestSign(req);
    const schemaNocodeId = String(req.body?.schemaNocodeId || nocodeId);
    if (!rowShareToken && !hasPublicFormContext) {
      if (!requestSign) {
        throw new ConflictException(global.i18next.t('NocodeForm.submitSignSyncConflictContent'));
      }
      const isSynchronized = await this.projectService.validateNocodeSign(schemaNocodeId, requestSign);
      if (!isSynchronized) {
        throw new ConflictException(global.i18next.t('NocodeForm.submitSignSyncConflictContent'));
      }
    }

    const source = await this.projectService.resolveFormMutationSource(
      rowShareToken || hasPublicFormContext ? nocodeId : schemaNocodeId,
      tableUID,
      {
        rowShareToken,
        ...(hasPublicFormContext ? {
          publicFormShare: {
            nocodeId: publicFormShare.nocodeId,
            rootTableUID: publicFormShare.tableId as TableUID,
            visitToken: publicFormShare.visitToken,
          },
        } : {}),
      },
    );
    if (!rowShareToken && !hasPublicFormContext && source.sourceNocodeId !== nocodeId) {
      throw new ConflictException(global.i18next.t('NocodeForm.submitSignSyncConflictContent'));
    }
    return source;
  }

  private collectReadableViewTableTableUIDs(
    tableMap: Map<TableUID, Table>,
    tableUID: TableUID,
    result = new Set<TableUID>(),
  ) {
    if (!tableUID || result.has(tableUID)) {
      return result;
    }
    result.add(tableUID);
    const table = tableMap.get(tableUID);
    for (const field of table?.fields || []) {
      this.collectReadableTableUIDsByField(tableMap, field, result);
    }
    return result;
  }

  private collectReadableTableUIDsByField(
    tableMap: Map<TableUID, Table>,
    field: Field | undefined,
    result: Set<TableUID>,
  ) {
    const subTableUID = field?.meta?.extra?.subTableUID?.[1];
    if (subTableUID && !result.has(subTableUID)) {
      this.collectReadableViewTableTableUIDs(tableMap, subTableUID, result);
    }
    const relatedTableUID = field?.meta?.extra?.relatedTableUID?.[1];
    if (relatedTableUID) {
      result.add(relatedTableUID);
    }
  }

  private async assertManagedViewTableAccess(
    nocodeId: string,
    widgetNocodeId: string,
    widgetUID: string,
    tableUIDs: TableUID[],
    req: Request,
  ) {
    if (!widgetNocodeId || !widgetUID) {
      throw new BadRequestException("missing widget context");
    }
    const widgetTarget = await this.projectService.findPageWidgetSoul(widgetNocodeId, widgetUID);
    const widgetSoul = widgetTarget?.widget;
    if (!widgetSoul || widgetSoul.type !== FormWidgetType.VIEW_TABLE) {
      throw new ForbiddenException("widget is not allowed");
    }
    const widgetTableUID = widgetSoul.options?.["form-table"]?.[0]?.uid;
    const widgetPermissionMode = widgetSoul.options?.["table-permission-mode"] || "form";
    if (widgetPermissionMode !== "all") {
      throw new ForbiddenException("widget data permission is not allowed");
    }
    if (!Array.isArray(widgetTableUID) || widgetTableUID.length < 2) {
      throw new ForbiddenException("widget table config is invalid");
    }
    const [widgetConnectionUID, widgetTargetTableUID] = widgetTableUID;
    const hostBody = await this.projectService.getEditorNocodeBodyWithOtherDataSources(widgetNocodeId, req.account);
    const targetConnection = getNocodeDataSourceByUID(hostBody, widgetConnectionUID, { nocodeId: widgetNocodeId });
    const targetNocodeId = targetConnection?.nocodeId || widgetNocodeId;
    const tableMap = new Map((targetConnection?.tables || []).map(table => [table.uid, table] as const));
    const readableTableUIDSet = this.collectReadableViewTableTableUIDs(tableMap, widgetTargetTableUID);
    if (!tableUIDs?.every(tableUID => readableTableUIDSet.has(tableUID))) {
      throw new ForbiddenException("table target mismatch");
    }
    if (nocodeId !== targetNocodeId) {
      throw new ForbiddenException("nocode target mismatch");
    }
    const canViewLayer = await this.projectService.canViewNocodeLayer(widgetNocodeId, widgetTarget.pageId, req);
    if (!canViewLayer) {
      throw new ForbiddenException("page permission denied");
    }
  }

  @NoLocalAuthGuard()
  @Post("/get")
  async getData(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUIDs") tableUIDs: TableUID[],
    @Body("options") options: QueryOptions,
    @Req() req: Request,
  ) {
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      return await this.projectService.getPublicRowShareData(shareToken, tableUIDs, options, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      return await this.projectService.getPublicFormShareData(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, tableUIDs, options, publicFormShare.visitToken);
    }
    const publicQueryToken = this.getPublicQueryToken(req);
    if (publicQueryToken) {
      return await this.projectService.getPublicQueryData(publicQueryToken, tableUIDs, options);
    }
    return await this.formDataService.getData(nocodeId, tableUIDs, {
      ...(options || {}),
      stage: options?.stage || {
        $nin: [FormDataStage.DRAFT, FormDataStage.DELETED],
      },
      formatData: true,
    });
  }

  @NoLocalAuthGuard()
  @Post("/get-managed-view-table-data")
  async getManagedViewTableData(
    @Body("nocodeId") nocodeId: string,
    @Body("widgetNocodeId") widgetNocodeId: string,
    @Body("widgetUID") widgetUID: string,
    @Body("tableUIDs") tableUIDs: TableUID[],
    @Body("options") options: QueryOptions,
    @Req() req: Request,
  ) {
    await this.assertManagedViewTableAccess(nocodeId, widgetNocodeId, widgetUID, tableUIDs, req);
    return await this.formDataService.getData(nocodeId, tableUIDs, {
      ...(options || {}),
      stage: options?.stage || {
        $nin: [FormDataStage.DRAFT, FormDataStage.DELETED],
      },
      formatData: true,
      useEditorSources: true,
    }, {
      skipReadPermission: true,
      enforceFieldReadAuth: false,
    });
  }

  @Post("/find")
  async find(@Body() request: FormDataFindRequest, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    let clientDisconnected = false;
    const handleClose = () => {
      if (!res.writableEnded) clientDisconnected = true;
    };
    res.once("close", handleClose);
    try {
      if (!request?.nocodeId || !request?.tableUID) {
        throw new BadRequestException({ code: "FIND_INVALID_REQUEST", message: "nocodeId and tableUID are required" });
      }
      const managedContext = request.context;
      if (managedContext) {
        await this.assertManagedViewTableAccess(
          request.nocodeId,
          managedContext.widgetNocodeId,
          managedContext.widgetUID,
          [request.tableUID],
          req,
        );
      }
      return await this.formDataService.find(request, {
        skipReadPermission: Boolean(managedContext),
        enforceFieldReadAuth: !managedContext,
        useEditorSources: Boolean(managedContext),
        isAborted: () => req.aborted || clientDisconnected,
      });
    } finally {
      res.off("close", handleClose);
    }
  }

  @Post("/preview-aggregate-table")
  async previewAggregateTable(
    @Body("nocodeId") nocodeId: string,
    @Body("aggregateTable") aggregateTable: AggregateTable,
    @Body("options") options?: QueryOptions,
  ) {
    return await this.formDataService.previewAggregateTable(nocodeId, aggregateTable, options);
  }

  @NoLocalAuthGuard()
  @Post('/findOne')
  async findOne(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Req() req: Request,
    @Body("uuid") uuid?: string,
  ) {
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      return await this.projectService.getPublicRowShareFindOne(shareToken, tableUID, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      return await this.projectService.getPublicFormShareFindOne(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, tableUID, publicFormShare.visitToken);
    }
    if (uuid) {
      return await this.formDataService.findOneByUUID(nocodeId, tableUID, uuid, {
        fillSubTable: true,
        transformRelated: true,
      });
    }
    return await this.formDataService.findOne(nocodeId, tableUID, {
      fillSubTable: true,
      transformRelated: true,
    })
  }

  @NoLocalAuthGuard()
  @Post("/distinct")
  async distinct(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("columnId") fieldId: FieldUID, @Body("options") options: QueryOptions, @Req() req: Request) {
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      return await this.projectService.getPublicRowShareDistinct(shareToken, tableUID, fieldId, options, true, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      return await this.projectService.getPublicFormShareDistinct(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, tableUID, fieldId, options, publicFormShare.visitToken);
    }
    const publicQueryToken = this.getPublicQueryToken(req);
    if (publicQueryToken) {
      return await this.projectService.getPublicQueryDistinct(publicQueryToken, tableUID, fieldId, options);
    }
    return await this.formDataService.distinct(nocodeId, tableUID, fieldId, options);
  }

  @NoLocalAuthGuard()
  @Post("/distinctCount")
  async distinctCount(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("columnId") fieldId: FieldUID, @Body("options") options: QueryOptions, @Req() req: Request) {
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      return await this.projectService.getPublicRowShareDistinct(shareToken, tableUID, fieldId, options, false, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      return await this.projectService.getPublicFormShareDistinct(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, tableUID, fieldId, options, publicFormShare.visitToken, false);
    }
    const publicQueryToken = this.getPublicQueryToken(req);
    if (publicQueryToken) {
      return await this.projectService.getPublicQueryDistinct(publicQueryToken, tableUID, fieldId, options, false);
    }
    return await this.formDataService.distinct(nocodeId, tableUID, fieldId, options, false);
  }

  @Post("/autoComputeDistinctCount")
  async autoComputeDistinctCount(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("columnId") fieldId: FieldUID,
    @Body("options") options: QueryOptions
  ) {
    return await this.formDataService.autoComputeDistinct(
      nocodeId,
      tableUID,
      fieldId,
      options,
    );
  }

  @Post("/sync")
  async syncTable(@Body("nocodeId") nocodeId: string, @Body("tableUIDs") tableUIDs: string[], @Body("formData") formData: NocodeFormData) {
    return await this.formDataService.syncTable(nocodeId, tableUIDs, formData);
  }

  @NoLocalAuthGuard()
  @ReturnMainSign()
  @Post("/add")
  async addData(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("rows") rows: any[], @Body("runtime") runtime: FormTableRuntime, @Body("stashFlow") stashFlow: boolean, @Req() req: Request) {
    const source = await this.resolveMutationSource(nocodeId, tableUID, req);
    const formData = source.formData;
    nocodeId = source.sourceNocodeId;
    if (stashFlow) {
      return await this.formDataService.addData(formData, nocodeId, tableUID, rows, {
        triggerTodo: runtime !== FormTableRuntime.FORM_EDITOR,
        deferPostMutation: true,
        stashFlow,
      });
    }
    const triggerTodo = runtime !== FormTableRuntime.FORM_EDITOR;
    const eventId = this.getMutationEventId(req, "add");
    const intent = triggerTodo ? await this.viewActionTriggerTaskService.preparePostMutationIntent({
      eventId,
      action: "add",
      auditAction: "addData",
      formData,
      nocodeId,
      tableUID,
      rows,
      runtime,
      request: req,
    }) : null;
    const replay = this.getMutationIntentReplayResponse(intent);
    if (replay) return replay;
    let result;
    try {
      result = await this.formDataService.addData(formData, nocodeId, tableUID, rows, {
        triggerTodo,
        deferPostMutation: true,
      });
    } catch (error) {
      if (intent?.taskId) await this.viewActionTriggerTaskService.failPostMutationIntent(intent.taskId, error);
      throw error;
    }
    if (!triggerTodo) {
      return result;
    }
    if (!intent) return result;
    const task = await this.viewActionTriggerTaskService.enqueuePostMutation({
      preparedTaskId: intent.taskId,
      eventId,
      action: "add",
      auditAction: "addData",
      formData,
      nocodeId,
      tableUID,
      rows: result.data || [],
      deferMatching: true,
      runtime,
      request: req,
    });
    return task ? { ...result, ...task } : result;
  }

  @ReturnMainSign()
  @Post("/add-draft")
  async addDraft(@Body("formData") formData: NocodeFormData, @Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("rows") rows: any[]) {
    return await this.formDataService.addDraftData(formData, nocodeId, tableUID, rows);
  }

  @Post("/get-drafts")
  async getDrafts(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID) {
    return await this.formDataService.getDrafts(nocodeId, tableUID);
  }

  @NoLocalAuthGuard()
  @ReturnMainSign()
  @Post("/update-draft")
  async updateDraft(@Body("formData") formData: NocodeFormData, @Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("rows") rows: any[], @Body("stage") stage: FormDataStage, @Req() req: Request) {
    return await this.formDataService.updateDraftData(formData, nocodeId, tableUID, rows, stage);
  }

  @ReturnMainSign()
  @Post("/delete-draft")
  async deleteDraft(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("rows") rows: any[], @Body("keys") keys: OptionFieldUID[], @Req() req: Request) {
    const source = await this.resolveMutationSource(nocodeId, tableUID, req);
    const formData = source.formData;
    nocodeId = source.sourceNocodeId;
    return await this.formDataService.deleteDraftData(formData, nocodeId, tableUID, rows, keys);
  }

  @ReturnMainSign()
  @Post("/delete")
  async deleteData(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("rows") rows: any[], @Body("keys") keys: OptionFieldUID[], @Body("runtime") runtime: FormTableRuntime, @Req() req: Request) {
    const source = await this.resolveMutationSource(nocodeId, tableUID, req);
    const formData = source.formData;
    nocodeId = source.sourceNocodeId;
    const triggerTodo = runtime !== FormTableRuntime.FORM_EDITOR;
    if (!triggerTodo) {
      return await this.formDataService.tryDeleteData(formData, nocodeId, tableUID, rows, keys, { triggerTodo: false });
    }
    const eventId = this.getMutationEventId(req, "delete");
    const intent = await this.viewActionTriggerTaskService.preparePostMutationIntent({
      eventId,
      action: "delete",
      auditAction: "deleteData",
      formData,
      nocodeId,
      tableUID,
      rows,
      requestIdentity: { keys },
      runtime,
      request: req,
    });
    const replay = this.getMutationIntentReplayResponse(intent);
    if (replay) return replay;
    let result;
    try {
      result = await this.formDataService.tryDeleteData(formData, nocodeId, tableUID, rows, keys, {
        triggerTodo: true,
        deferPostMutation: true,
      });
    } catch (error) {
      if (intent?.taskId) await this.viewActionTriggerTaskService.failPostMutationIntent(intent.taskId, error);
      throw error;
    }
    const delegatedRows = Array.isArray((result as any)?.delegatedRows) ? (result as any).delegatedRows : [];
    if (!intent) return result;
    const task = await this.viewActionTriggerTaskService.enqueuePostMutation({
      preparedTaskId: intent.taskId,
      eventId,
      action: "delete",
      auditAction: "deleteData",
      formData,
      nocodeId,
      tableUID,
      rows: delegatedRows,
      beforeMutationRows: (result as any)?.queueState?.previousRows || [],
      queueState: (result as any)?.queueState || null,
      deferMatching: true,
      runtime,
      request: req,
    });
    const response = { ...(result as any) };
    delete response.queueState;
    return task ? { ...response, ...task } : response;
  }

  @ReturnMainSign()
  @Post("/delete-all")
  async deleteAllData(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("runtime") runtime: FormTableRuntime, @Req() req: Request) {
    const source = await this.resolveMutationSource(nocodeId, tableUID, req);
    const formData = source.formData;
    nocodeId = source.sourceNocodeId;
    // 本表没有数据变更流程时清空无需进入 P1 队列，直接同步删除。
    const triggerTodo = runtime !== FormTableRuntime.FORM_EDITOR
      && this.viewActionTriggerTaskService.hasPotentialDataChangeFlow(formData, tableUID, DataChangeType.DELETE);
    if (!triggerTodo) {
      return await this.formDataService.tryDeleteAllData(formData, nocodeId, tableUID, { triggerTodo: false });
    }
    const eventId = this.getMutationEventId(req, "delete-all");
    return await this.viewActionTriggerTaskService.enqueueDeleteAll({
      eventId,
      formData,
      nocodeId,
      tableUID,
      runtime,
      request: req,
    });
  }

  @ReturnMainSign()
  @Post("/restore")
  async restoreData(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("rows") rows: any[], @Body("keys") keys: OptionFieldUID[], @Req() req: Request) {
    const source = await this.resolveMutationSource(nocodeId, tableUID, req);
    const formData = source.formData;
    nocodeId = source.sourceNocodeId;
    return await this.formDataService.restoreDeletedData(formData, nocodeId, tableUID, rows, keys);
  }

  @ReturnMainSign()
  @Post("/purge")
  async purgeData(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("rows") rows: any[], @Body("keys") keys: OptionFieldUID[], @Req() req: Request) {
    const source = await this.resolveMutationSource(nocodeId, tableUID, req);
    const formData = source.formData;
    nocodeId = source.sourceNocodeId;
    return await this.formDataService.purgeDeletedData(formData, nocodeId, tableUID, rows, keys);
  }

  @ReturnMainSign()
  @Post("/update")
  async updateData(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("rows") rows: any[], @Body("keys") keys: OptionFieldUID[], @Body("updateFieldIds") updateFieldIds: ViewActionFieldId[], @Body("viewActionContext") viewActionContext: ExecuteViewActionEditContext, @Body("runtime") runtime: FormTableRuntime, @Body("stashFlow") stashFlow: boolean, @Req() req: Request) {
    const source = await this.resolveMutationSource(nocodeId, tableUID, req);
    const formData = source.formData;
    nocodeId = source.sourceNocodeId;
    const triggerTodo = runtime !== FormTableRuntime.FORM_EDITOR;
    const triggerOptions: TriggerOptions = {
      triggerTodo,
      deferPostMutation: true,
      stashFlow,
    };
    if (stashFlow) {
      return await this.formDataService.tryUpdateData(
        formData,
        nocodeId,
        tableUID,
        rows,
        keys,
        null,
        triggerOptions,
        {},
        updateFieldIds,
        viewActionContext,
      );
    }
    const eventId = this.getMutationEventId(req, "update");
    const intent = triggerTodo ? await this.viewActionTriggerTaskService.preparePostMutationIntent({
      eventId,
      action: "update",
      auditAction: "updateData",
      formData,
      nocodeId,
      tableUID,
      rows,
      requestIdentity: { keys, updateFieldIds, viewActionContext },
      runtime,
      request: req,
    }) : null;
    const replay = this.getMutationIntentReplayResponse(intent);
    if (replay) return replay;
    let result;
    try {
      result = await this.formDataService.tryUpdateData(
        formData,
        nocodeId,
        tableUID,
        rows,
        keys,
        null,
        triggerOptions,
        {},
        updateFieldIds,
        viewActionContext,
      );
    } catch (error) {
      if (intent?.taskId) await this.viewActionTriggerTaskService.failPostMutationIntent(intent.taskId, error);
      throw error;
    }
    if (!triggerTodo) {
      return result;
    }
    if (!intent) return result;
    const task = await this.viewActionTriggerTaskService.enqueuePostMutation({
      preparedTaskId: intent.taskId,
      eventId,
      action: "update",
      auditAction: "updateData",
      formData,
      nocodeId,
      tableUID,
      rows: result.data || [],
      beforeMutationRows: triggerOptions.beforeMutationRows || [],
      queueState: (result as any)?.queueState || null,
      deferMatching: true,
      runtime,
      request: req,
    });
    return task ? { ...result, ...task } : result;
  }

  @ReturnMainSign()
  @Post("/recalculate-table-field")
  async recalculateTableField(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("fieldUID") fieldUID: FieldUID,
  ) {
    return await this.formDataService.recalculateTableFieldData(nocodeId, tableUID, fieldUID);
  }

  @ReturnMainSign()
  @Post("/precheck-view-action-trigger")
  async precheckViewActionTrigger(@Body() request: ExecuteViewActionRequest) {
    return {
      success: true,
      data: await this.viewActionTriggerTaskService.precheck(request),
    };
  }

  @ReturnMainSign()
  @Post("/enqueue-view-action-trigger")
  async enqueueViewActionTrigger(@Body() request: EnqueueViewActionTriggerRequest, @Req() req: Request) {
    return {
      success: true,
      data: await this.viewActionTriggerTaskService.enqueue(request, req),
    };
  }

  @ReturnMainSign()
  @Post("/execute-view-action")
  async executeViewAction(@Body() request: ExecuteViewActionRequest) {
    return {
      success: true,
      data: await this.formDataService.executeViewAction(request),
    };
  }

  @Post("/add-table")
  async addTable(@Body("formData") formData: NocodeFormData, @Body("name") name: string, @Body("extra") extra: FormDataTableExtra) {
    return await this.formDataService.addTable(formData, name, extra);
  }

  @Post("/delete-table")
  async deleteTable(@Body("formData") formData: NocodeFormData, @Body("nocodeId") nocodeId: string, @Body("table") table: Table) {
    return await this.formDataService.deleteTable(formData, nocodeId, table);
  }

  @Post("/sync-table-columns")
  async syncTableColumns(@Body("formData") formData: NocodeFormData, @Body("tableUID") tableUID: string, @Body("columns") columns: FormDataColumn[]) {
    return await this.formDataService.syncTableColumns(formData, tableUID, columns);
  }

  @Post("update-sort-data")
  async updateSortData (@Body('nocodeId') nocodeId: string, @Body('rows') rows: object[], @Body('tableUID') tableUID: TableUID) {
    return await this.formDataService.updateSortData(nocodeId, tableUID, rows)
  }
  
  @Post('form/create/:appId/:formId')
  async createFormData(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Body('rows') rows: Row[]
  ) {
    return await this.formDataService.createFormData(appId, formId, rows);
  }

  @Post('form/update/:appId/:formId')
  async updateFormData(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Body('rows') rows: Row[],
  ) {
    return await this.formDataService.updateFormData(appId, formId, rows);
  }

  @Post('form/delete/:appId/:formId')
  async deleteFormData(
    @Param('appId') appId: string,
    @Param('formId') formId: TableUID,
    @Body('rows') rows: Row[],
  ) {
    return await this.formDataService.deleteFormData(appId, formId, rows);
  }

  @Post("copy-table")
  async copyTable(@Body('nocodeId') nocodeId: string, @Body('sourceFormId') sourceFormId: string, @Body('copyName') copyName: string) {
    return await this.formDataService.copyTable(nocodeId, sourceFormId, copyName);
  }

  @NoLocalAuthGuard()
  @Post("/validate-form-submit")
  async validateFormSubmit(@Body() request: FormValidateSubmitOptions, @Req() req: Request) {
    const { nocodeId, formValidRule } = request;
    const shareToken = this.getPublicRowShareToken(req);
    const accessToken = this.getPublicRowShareAccessToken(req);
    if (shareToken) {
      if (request.type === 'form') {
        return await this.projectService.validatePublicRowShareFormSubmit(shareToken, request.row, formValidRule, request.type, accessToken);
      }
      return await this.projectService.validatePublicRowShareFormSubmit(shareToken, request.rows, formValidRule, request.type, accessToken);
    }
    const publicFormShare = this.getPublicFormShareContext(req);
    if (publicFormShare.nocodeId && publicFormShare.tableId) {
      if (request.type === 'form') {
        return await this.projectService.validatePublicFormShareFormSubmit(publicFormShare.nocodeId, publicFormShare.tableId as TableUID, request.row, formValidRule, request.type, publicFormShare.visitToken);
      }
      return await this.projectService.validatePublicFormShareFormSubmit(
        publicFormShare.nocodeId,
        publicFormShare.tableId as TableUID,
        request.rows,
        formValidRule,
        request.type,
        publicFormShare.visitToken,
        request.tableId,
        {
          fullReplace: request.fullReplace,
          fullReplaceRelationValue: request.fullReplaceRelationValue,
        },
      );
    }
    
    if (request.type === 'form') {
      return await this.formDataService.validateFormSubmit(
        nocodeId,
        request.row,
        formValidRule,
        false,
        {
          connectionUID: request.connectionUID,
          tableUID: request.tableUID,
          originRow: request.originRow,
        },
      );
    } else {
      return await this.formDataService.validateSubFormSubmit(nocodeId, request.rows, formValidRule, request.tableId, {
        fullReplace: request.fullReplace,
        fullReplaceRelationValue: request.fullReplaceRelationValue,
      });
    }
  }

  @Post("/test-db-connect")
  async testDBConnect(@Body() config: Required<DBInfo>) {
    return await this.formDataService.testDBConnect(config);
  }

  @Post("/data-migration")
  async dataMigration(@Body() config: Required<DBInfo>) {
    return await this.formDataService.dataMigration(config);
  }

}
