import { Body, Controller, Get, Post, Query, Req, Inject } from '@nestjs/common';
import { FormFlowService } from './form-flow.service';
import { BackTodoOptions, CancelTodoOptions, CheckProcessVersionDeletableParams, DeleteTodoOptions, FinishTodoOptions, GetAllCategoryTodoCountParams, GetAllProcessParams, GetFlowRecordsParams, GetTodosParams, GetTodoParams, GetTransferTodoUsersOptions, RejectTodoOptions, StashTodoOptions, SubmitTodoOptions, TransferTodoOptions, TodoCategory, DeleteTodosOptions } from '@common/types/nocode';
import { isSystemAdminAccount } from '@common/types/account';
import { Request } from 'express';
import { getNocodeBody } from '@main/utils';
import { ProjectService } from '../project/project.services';
import { NOCODES_DIR } from "@main/constants";
import { isEmpty } from '@common/utils/object';
import { hasProcessBranches } from '@common/utils';

@Controller("form-flow")
export class FormFlowController {

  constructor(
    private readonly formFlowService: FormFlowService,
    private readonly projectService: ProjectService,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
  ) {

  }

  @Get("/get-todos")
  async getTodo(@Query() query: GetTodosParams, @Req() req: Request) {
    if (query.nocodeId) {
      return await this.formFlowService.getTodosByNocodeId(query, req.account.id);
    } else {
      return await this.formFlowService.getAllTodos(query, req.account.id);
    }
  }

  @Get("/get-todo")
  async getTodoById(@Query() query: GetTodoParams, @Req() req: Request) {
    return await this.formFlowService.getTodo(query, req.account.id);
  }

  @Post("/submit-todo")
  async submitTodo(@Body() options: SubmitTodoOptions, @Req() req: Request) {
    return await this.formFlowService.submitTodo(options, req.account.id);
  }

  @Post("/stash-todo")
  async stashTodo(@Body() options: StashTodoOptions, @Req() req: Request) {
    return await this.formFlowService.stashTodo(options, req.account.id);
  }

  @Post("/back-todo")
  async backTodo(@Body() options: BackTodoOptions, @Req() req: Request) {
    return await this.formFlowService.backTodo(options, req.account.id);
  }

  @Post("reject-todo")
  async rejectTodo(@Body() options: RejectTodoOptions, @Req() req: Request) {
    return await this.formFlowService.rejectTodo(options, req.account.id);
  }

  @Post("/cancel-todo")
  async cancelTodo(@Body() options: CancelTodoOptions, @Req() req: Request) {
    return await this.formFlowService.cancelTodo(options, req.account.id);
  }

  @Post("/finish-todo")
  async finishTodo(@Body() options: FinishTodoOptions, @Req() req: Request) {
    const isAdmin = isSystemAdminAccount(req.account);
    return await this.formFlowService.finishTodo(options, req.account.id, isAdmin);
  }

  @Post("/transfer-todo")
  async transferTodo(@Body() options: TransferTodoOptions, @Req() req: Request) {
    return await this.formFlowService.transferTodo(options, req.account.id);
  }

  @Get("/get-transfer-todo-users")
  async getTransferTodoUsers(@Query() query: GetTransferTodoUsersOptions, @Req() req: Request) {
    return await this.formFlowService.getTransferTodoUsers(query, req.account.id);
  }

  @Post("/delete-todo")
  async deleteTodo(@Body() options: DeleteTodoOptions, @Req() req: Request) {
    return await this.formFlowService.deleteTodo(options, req.account.id);
  }

  @Post("/delete-todos")
  async deleteTodos(@Body() options: DeleteTodosOptions, @Req() req: Request) {
    return await this.formFlowService.deleteTodos(options?.options, req.account.id);
  }

  @Get("/get-all-process")
  async getAllProcess(@Query() query: GetAllProcessParams ,@Req() req: Request) {
    const accountId = req.account?.id ?? "";
    const nocodeMetas = await this.projectService.getSharePermissionsByAccountId(accountId);
    const res = await Promise.all(nocodeMetas.map(async (meta) => {
      const body = await getNocodeBody(this.nocodesDir, meta.id).catch(() => null);
      return {
        meta,
        body,
      }
    }));

    const context = await this.projectService.createCrossAppPermissionContext(req.account);
    const nocodes = await Promise.all(res.filter((nocode) => !!nocode.body).map(async (item) => {
      const formOptions = item.body?.formData?.formOptions || {};
      const tables = item.body?.formData?.tables || [];

      const visibleTables = (await Promise.all(tables.map(async (table) => {
        if(table.meta?.extra?.primaryTable) {
          return null;
        }
        if(isEmpty(formOptions[table.uid])) {
          return null;
        }
        const formOption = formOptions[table.uid];
        if(!(formOption?.process?.enabled && hasProcessBranches(formOption?.process))) {
          return null;
        }

        const canViewTable = await this.projectService.canViewTargetTable(
          item.body,
          table.uid,
          context,
        );
        return canViewTable ? table : null;
      }))).filter(Boolean);

      return {
        ...item.meta,
        formDataUID: item.body?.formData?.uid || "",
        tables: visibleTables,
      }
    }));
    return nocodes.filter(nocode => !isEmpty(nocode.tables))
  }

  @Get("get-flow-records")
  async getFlowRecords(@Query() query: GetFlowRecordsParams) {
    return await this.formFlowService.getFlowRecords(query);
  }

  @Get("get-all-flows")
  async getAllFlows(@Query() query: GetFlowRecordsParams) {
    const res = await this.formFlowService.getAllFlows(query);
    return res.flows;
  }

  @Get("/get-all-category-todo-count")
  async getAllCategoryTodoCount(@Query() query: GetAllCategoryTodoCountParams, @Req() req: Request) {
    const categories = Array.isArray(query.categories)
      ? query.categories
      : typeof query["categories[0]"] === "string"
        ? [query["categories[0]"] as TodoCategory]
        : [];
    const includeTodoPendingCategories = query.includeTodoPendingCategories === true || query.includeTodoPendingCategories === "true";
    const nocodeId = typeof query.nocodeId === "string" ? query.nocodeId : "";
    if (nocodeId) {
      return await this.formFlowService.getAllCategoryTodoCountByNocodeId(req.account.id, nocodeId, categories, includeTodoPendingCategories);
    }
    return await this.formFlowService.getAllCategoryTodoCount(req.account.id, categories, includeTodoPendingCategories);
  }

  @Get("/get-process-nocode-simplify-datas")
  async getProcessNocodeSimplifyDatas() {
    return await this.formFlowService.getProcessNocodeSimplifyDatas();
  }

  @Get("/get-start-todo-owners")
  async getStartTodoOwners(@Query("category") category: TodoCategory, @Query("nocodeId") nocodeId: string, @Req() req: Request) {
    return await this.formFlowService.getStartTodoOwners(category, req.account.id, nocodeId);
  }

  @Get("/check-process-version-deletable")
  async checkProcessVersionDeletable(@Query() query: CheckProcessVersionDeletableParams) {
    return await this.formFlowService.getProcessVersionDeletable(query.nocodeId, query.tableId, Number(query.version));
  }
}
