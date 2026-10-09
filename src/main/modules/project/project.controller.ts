
import { Controller, Req, Res, UseGuards, Get, Query, Post, Body, UploadedFile, Logger, UseInterceptors, Inject, UseFilters, Param, UploadedFiles, ConflictException } from "@nestjs/common";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { Bucket, Connection, ProjectBody, ProjectParams, RowShareAccessScope, Table, PublishUpdateMethod, PublishCategory, TableUID } from "@common/types/project";
import { CLIENT_VERSION, ProjectService } from "./project.services";
import { UserService } from "../user/user.service";
import path, { join } from "path";
import fs from "fs";
import os from "os";
import { mkdir, cp, stat, readFile, unlink, access, rm } from "fs/promises";
import { ConnectionUtils } from "./connection.utils";
import { Preferences } from "../common";
import { NOCODES_DIR, PREFERENCES } from "@main/constants";
import { AliasType, ExportProjectOptions, ExpressUploadFile, ProjectRenewalOptions, UploadFileParams } from "./types";
import { isEmpty } from '@common/utils/object';
const exists = async (path: string) => { try { await access(path); return true; } catch { return false; } };
import { Response, Request } from "express";
import { getNocodeBody, saveNocodeBody, syncNewerNocodeRuntimeStateFromBody, validateSynchronization } from "@main/utils";
import { getAllForms, getAllPages, normalizeNocodeHomePageSetting } from "@common/utils";
import { MikroORM, UseRequestContext } from "@mikro-orm/core";
import { NoLocalAuthGuard } from "../auth/guards/local-auth.guard";
import { ClientTheme } from "@renderer/types";
import { ExportNocodeOptions, FormTableViewMeta, NocodeBody, NocodeFormData, PermissionFilterMode, NocodeStructure, PrintTemplate, NocodeStructureType } from "@common/types/nocode";
import { isSystemAdminAccount } from "@common/types/account";
import { Nocode as NocodeEntity } from "./entities";
import { FormFlowService } from "../formData/form-flow.service";
import { AdminPermissionsGuard } from "../workbench/guards";
import { unique } from "@common/utils/unique";
import { NocodeSyncGuard } from "../nocode/guards";
import { ReturnMainSign, SignContext } from "../nocode/Interceptors/sign.Interceptor";
import { ScheduleDefinitionService } from "../formData/scheduled-trigger/schedule-definition-service";

const uploadDir = os.tmpdir();

const rewriteFile = (srcDir: string, destDir: string) => {
  return new Promise((resolve, reject) => {
    const reader = fs.createReadStream(srcDir);
    const writer = fs.createWriteStream(destDir);
    reader.pipe(writer).on('finish', () => {
      // 删除
      fs.promises.rm(srcDir, { recursive: true });
      resolve(true);
    }).on('error', (err) => {
      reject(err.message)
    } );
  })
}


@Controller("project")
export class ProjectController {
  private readonly logger = new Logger("ProjectController");
  constructor(
    private readonly orm: MikroORM, // used by @UseRequestContext()
    private readonly projectService: ProjectService,
    private readonly userService: UserService,
    private readonly connectionUtils: ConnectionUtils,
    private readonly formFlowService: FormFlowService, 
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    private readonly scheduleDefinitionService: ScheduleDefinitionService,
  ) {}

  private isSameJson(left: unknown, right: unknown) {
    return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
  }

  private getChangedProcessTableUIDs(oldFormData?: NocodeFormData | null, nextFormData?: NocodeFormData | null) {
    const tableUIDs = new Set([
      ...Object.keys(oldFormData?.formOptions || {}),
      ...Object.keys(nextFormData?.formOptions || {}),
    ]);
    return [...tableUIDs].filter(tableUID => !this.isSameJson(
      oldFormData?.formOptions?.[tableUID]?.process ?? null,
      nextFormData?.formOptions?.[tableUID]?.process ?? null,
    ));
  }

  private getRowShareAccessToken(req: Request) {
    const token = req.headers["x-row-share-access-token"];
    return Array.isArray(token) ? token[0] : token;
  }

  private getPublicRowShareToken(req: Request) {
    const token = req.headers["x-row-share-token"];
    return Array.isArray(token) ? token[0] : token;
  }

  private getPublicFormShareContext(req: Request) {
    const nocodeId = req.headers["x-public-form-share-nocode-id"];
    const tableId = req.headers["x-public-form-share-table-id"];
    const visitToken = req.headers["x-public-share-visit-token"];
    return {
      nocodeId: Array.isArray(nocodeId) ? nocodeId[0] : nocodeId,
      tableId: Array.isArray(tableId) ? tableId[0] : tableId,
      visitToken: Array.isArray(visitToken) ? visitToken[0] : visitToken,
    };
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("nocode-layer-create")
  async nocodeLayerCreate(@Body("nocodeId") nocodeId: string, @Body("id") id: string, @Body("structure") structure: NocodeStructure[]) {
    const res = await this.projectService.createBlankProject(nocodeId, id);
    await this.projectService.saveNocodeStructure(nocodeId, structure);
       return res;
  }

  @Get("can-editor-nocode")
  async canEditorNocode(@Query("nocodeId") nocodeId: string, @Req() req: Request) {
    const importState = await this.projectService.getNocodeImportRestrictionState(nocodeId);
    if (importState.expired || importState.disableEdit) {
      return false;
    }
    const account = req.account
    const isAdmin = isSystemAdminAccount(account);
    if(isAdmin) {
      return true
    }
    const canView = await this.projectService.canViewNocode(nocodeId, req);
    if (!canView) return false;

    const allDepartments = await this.projectService.getAllDepartments();

    const departmentMap = new Map(allDepartments.map(dep => [dep.id, dep.parent]));
    let departments: string[] = [];

    for (const depId of account.departments) {
      let parentId: string | undefined = depId;
      const visited = new Set<string>(); // 防止循环

      while (parentId && !visited.has(parentId)) {
        visited.add(parentId);
        departments.push(parentId);
        parentId = departmentMap.get(parentId);
      }
    }
    // 去重
    departments = [...new Set(departments)];

    const body = await this.projectService.getNocodeBody(nocodeId);
    if(!body) return false
    const permission = body?.permissions?.application?.update
    if(isEmpty(permission)) {
      return true
    }
    if(permission.rangeType === PermissionFilterMode.BLACK) {
      if(permission.blacklist.users.includes(account.id)) {
        return false
      }
      for(const depId of departments) {
        if(permission.blacklist.departments.includes(depId)) {
          return false
        }
      }
      for(const roleId of account.roles) {
        if(permission.blacklist.roles.includes(roleId)) {
          return false
        }
      }
      return true
    } else {
      if(permission.whitelist.users.includes(account.id)) {
        return true
      }
      for(const depId of departments) {
        if(permission.whitelist.departments.includes(depId)) {
          return true
        }
      }
      for(const roleId of account.roles) {
        if(permission.whitelist.roles.includes(roleId)) {
          return true
        }
      }
      return false
    }
  }

  @Get("can-view-nocode")
  async canViewNocode(@Query("nocodeId") nocodeId: string, @Req() req: Request) {
    return await this.projectService.canViewNocode(nocodeId, req);
  }

  @Get("can-view-nocode-layer")
  async canViewNocodeLayer(@Query("nocodeId") nocodeId: string, @Query("layerId") layerId: string, @Req() req: Request) {
    return await this.projectService.canViewNocodeLayer(nocodeId, layerId, req);
  }

  @Get("get-nocode-import-state")
  async getNocodeImportState(@Query("nocodeId") nocodeId: string, @Req() req: Request) {
    return await this.projectService.getNocodeImportRestrictionState(nocodeId, req.account);
  }

  @Post("save-nocode-import-readonly")
  async saveNocodeImportReadonly(@Body("nocodeId") nocodeId: string, @Body("disableEdit") disableEdit: boolean, @Req() req: Request) {
    const importState = await this.projectService.getNocodeImportRestrictionState(nocodeId, req.account);
    if (!importState.canManageReadonly) {
      throw new Error(global.i18next.t("projectController.originalAuthorManageLockOnly"));
    }
    await this.projectService.saveNocodeImportReadonly(nocodeId, !!disableEdit);
    return await this.projectService.getNocodeImportRestrictionState(nocodeId, req.account);
  }

  @Post("save-nocode-import-expire-at")
  async saveNocodeImportExpireAt(@Body("nocodeId") nocodeId: string, @Body("expireAt") expireAt: number | null, @Req() req: Request) {
    const importState = await this.projectService.getNocodeImportRestrictionState(nocodeId, req.account);
    if (!importState.canManageExpireAt) {
      throw new Error(global.i18next.t("projectController.originalAuthorManageExpiryOnly"));
    }
    const currentExpireAt = Number(expireAt || 0);
    if (currentExpireAt && currentExpireAt <= Date.now()) {
      throw new Error(global.i18next.t("projectController.expiryMustBeFuture"));
    }
    await this.projectService.saveNocodeImportExpireAt(nocodeId, currentExpireAt || null);
    return await this.projectService.getNocodeImportRestrictionState(nocodeId, req.account);
  }


  @UseGuards(AdminPermissionsGuard)
  @Post("nocode-create")
  async nocodeCreate(
    @Body("name") name: string,
    @Req() req: Request,
    @Body("groupId") groupId: string,
    @Body("description") description?: string,
  ) {
    const accountId = req.account?.id ?? "";
    const nocode = await this.projectService.initNocode(accountId);
    nocode.name = name;
    nocode.description = description?.trim?.() || "";
    nocode.groupId = groupId;
    await this.projectService.setNocodeMeta(nocode);
       return nocode;
  }

  @Get("font-list")
  async getFontList() {
    return this.projectService.getFontList();
  }


  @Get("get-layer")
  async getNocodeLayer(@Query("nocodeId") nocodeId: string, @Query("projectId") projectId:string) {
    return await this.projectService.getProjectBody(nocodeId, projectId, true);
  }


  @Get("deleted-nocode-list")
  async getDeletedNocodeList() {
    const nocodes = await this.projectService.getNocodesMetas("", true);
    return nocodes.sort((a, b)=>{
      return b.deleteTime - a.deleteTime;
    });
  }


  @Get("delete-nocode")
  async deleteNocode(@Query("id") nocodeId:string) {
    return await this.projectService.deleteNocode(nocodeId);
  }

  @Post("restore-nocode-list")
  async restoreNocodeList(@Body("ids") nocodeIdList:string[]) {
    const restoredList = await this.projectService.restoreNocodeList(nocodeIdList);
    return restoredList;
  }

  @Post("complete-delete-nocode-list")
  async completeDeleteNocodeList(@Body("ids") nocodeIdList:string[]) {
    return await this.projectService.completeDeleteNocodeList(nocodeIdList);
  }

  @Get("copy-nocode")
  async copyNocode(
    @Query("id") id: string,
    @Query('parentId') parentId: string,
    @Query('copyData') copyData?: string,
  ) {
    return await this.projectService.copyNocode(id, parentId, copyData === "true");
  }

  // webshare

  @NoLocalAuthGuard()
  @Get("get-project")
  async getProject(@Query("nocodeId") nocodeId: string, @Query("projectId") projectId:string) {
    return await this.projectService.getProjectBody(nocodeId, projectId);
  }

  @Get("rename-nocode")
  async renameNocode(@Query("name") name:string, @Query("id") id:string) {
    await this.projectService.renameNocode(id, name);
       return name
  }

  @Post("save-nocode-basic-setting")
  async saveNocodeBasicSetting(
    @Body("nocodeId") nocodeId: string,
    @Body("name") name?: string,
    @Body("description") description?: string,
  ) {
    return await this.projectService.saveNocodeBasicSetting(nocodeId, {
      name: name?.trim?.(),
      description: description?.trim?.() || "",
    });
  }

  @Post("file")
  @UseInterceptors(FileInterceptor("file", { dest: uploadDir }))
  async uploadFile(@Body() data: UploadFileParams, @UploadedFile() file) {
    let folderName = 'resources';
    let filename = data.filename;
    if (data.type === 'data') {
      folderName = 'data';
    }
    if (data.folder) {
      folderName = path.join(folderName, data.folder)
    }
    const destDir = path.join(this.nocodesDir, data.projectId, folderName);

    // 判断文件是否存在
    if(!data.folder){
      filename = await this.projectService.renameIfNeed(destDir, filename)
    }
    // 文件夹不存在即创建文件夹
    try {
      await mkdir(destDir, { recursive: true });
    } catch (error) {
      //ignored
    }
    //写入文件
    try {
      const destPath = path.join(destDir, filename);
      await rewriteFile(file.path, destPath);
      return { filePath: path.join(folderName, filename).replace(/\\/g, "/") };
    } catch (error) {
      return { filePath: null };
    }
  }

  @Post('fit-files')
  async getAllFitFiles(@Body('types') types: string, @Body('folderTypes') folderTypes: string, @Body('projectId') projectId: string, @Body('recursive') recursive: boolean) {
    return await this.projectService.getAllFitFiles(types, folderTypes, projectId, recursive);
  }

  @Get("get-nocode")
  async getNocode(@Query("nocodeId") nocodeId:string, @Req() req: Request, @Query("includePageBodies") includePageBodies?: string) {
    const meta = await this.projectService.getNocodeMeta(nocodeId);
    const body = await this.projectService.getEditorNocodeBodyWithOtherDataSources(nocodeId, req.account);

    if(body.formData?.tables?.length) {
      const allForms = getAllForms(body.structure || []);
      const unknownTables  = body.formData?.tables.filter(t => {
        if(t.meta?.extra?.primaryTable?.length) {
          return false;
        } else if(allForms.some(f => f.id === t.uid)) {
          return false;
        }
        return true;
      });
      body.structure = [
        ...(body.structure || []),
        ...unknownTables.map((table) => ({
          id: table.uid,
          name: table.alias,
          type: NocodeStructureType.FORM,
        })),
      ];
    }

    if (includePageBodies === "0") {
      return {
        meta,
        body,
      };
    }

    const pages = getAllPages(body.structure || []);
    const pageBodies = await Promise.all(pages.map(async (page) => await this.projectService.getProjectBody(nocodeId, page.id)));

    return {
      meta,
      body,
      pageBodies,
    };
  }



  @Post('export-nocode')
  async exportNocode (@Body('nocodeId') nocodeId: string, @Body() options: ExportNocodeOptions, @Req() req: Request) {
    const extname = this.preferences.$p('nocodeExt');
    return await this.projectService.zipNocode(nocodeId, extname, {
      ...options,
    }, req.account);
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("upload-nocode-snapshot")
  @UseInterceptors(FileInterceptor("file", { dest: uploadDir }))
  async uploadNocodeSnapshot(@Body() data: {
    filename: string,
    nocodeId: string,
    icon: string,
    color: string,
  }, @UploadedFile() file){
    const nocodeBody = await getNocodeBody(this.nocodesDir, data.nocodeId);
    if (!file) {
      nocodeBody.snapshot = {
        color: data.color,
        icon: data.icon,
      }
      await saveNocodeBody(this.nocodesDir, data.nocodeId, nocodeBody);
      await this.projectService.removeNocodeSnapshot(data.nocodeId);
    } else {
      await this.projectService.saveNocodeSnapshot({
        nocodeId: data.nocodeId,
        file,
      });
      delete nocodeBody.snapshot;
      await saveNocodeBody(this.nocodesDir, data.nocodeId, nocodeBody);
    }
    return {
      snapshot: nocodeBody.snapshot,
      cover: {
        type: nocodeBody.snapshot ? "icon" : "image",
      },
    };
  }

  @NoLocalAuthGuard()
  @Get("get-nocode-snapshot/:nocodeId")
  async getNocodeSnapshot(@Param('nocodeId') nocodeId: string, @Res() res: Response) {
    const normalizedNocodeId = String(nocodeId || "").trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(normalizedNocodeId)) {
      return res.sendStatus(404);
    }

    const snapshotFile = path.join(this.nocodesDir, normalizedNocodeId, "snapshot.png");
    if (!await exists(snapshotFile)) {
      return res.sendStatus(404);
    }

    res.type("png");
    return res.sendFile(snapshotFile);
  }

  @NoLocalAuthGuard()
  @Get("get-nocode-body/:nocodeId")
  async getNocodeBody (@Param('nocodeId') nocodeId: string, @Req() req: Request) {
    return await this.projectService.getEditorNocodeBodyWithOtherDataSources(nocodeId, req.account);
  }

  @Post("create-from-nocode")
  @UseInterceptors(FileInterceptor("file", { dest: uploadDir }))
  async createFromNocode(@Body('options') optionsStr, @UploadedFile() file, @Req() req: Request) {
    const result = await this.projectService.importNocodeWithInit(file.path, JSON.parse(optionsStr), req?.account);
    await rm(file.path, { recursive: true });

    if (result.meta) {
      return result;
    } else {
      throw new Error(result.reason);
    }
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("save-nocode-connections")
  async saveNocodeConnections(@Body('nocodeId') nocodeId: string, @Body("connections") connections: Connection[], @Body("formData") formData: NocodeFormData, @Req() req: Request) {
    await this.projectService.assertManageTargetNocode(nocodeId, req.account);
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    nocodeBody.sign = SignContext.get();
    const oldFormData = nocodeBody.formData;
    nocodeBody.connections = connections;
    for (const table of formData.options.tables) {
      for (const column of table.columns) {
        const extra = column.extra;
        if (extra && extra?.widgetType === "widget.form.serialNumber") {
          const originTable = nocodeBody.formData.options.tables.find(t => t.uid === table.uid);
          const originColumn = originTable?.columns?.find(c => c.uid === column.uid);
          const originExtra =  originColumn?.extra;
          if (!originExtra) continue;
          if (extra?.serialNumber?.updateTime) {
            if (extra?.serialNumber?.updateTime > originExtra?.serialNumber?.updateTime) {
              continue;
            }
          }
          column.extra = {
            ...column.extra,
            serialNumber: {
              ...column.extra.serialNumber,
              count: originExtra.serialNumber.count,
              resetTime: originExtra.serialNumber.resetTime,
              updateTime: originExtra.serialNumber.updateTime,
            }
          };
        }
      }
    }
    const views = nocodeBody.views || {};
    for (const table of formData.tables) {
      for (const field of table.fields) {
        const extra = field.meta.extra;
        if (extra && extra?.widgetType === "widget.form.serialNumber") {
          const originTable = nocodeBody.formData.tables.find(t => t.uid === table.uid);
          const originField = originTable?.fields?.find(f => f.uid === field.uid);
          const originExtra =  originField?.meta?.extra;
          if (!originExtra) continue;
          if (extra?.serialNumber?.updateTime) {
            if (extra?.serialNumber?.updateTime > originExtra?.serialNumber?.updateTime) {
              continue;
            }
          }
          field.meta.extra = {
            ...field.meta.extra,
            serialNumber: {
              ...field.meta.extra.serialNumber,
              count: originExtra.serialNumber.count,
              resetTime: originExtra.serialNumber.resetTime,
              updateTime: originExtra.serialNumber.updateTime,
            }
          };
        }
      }
      
      if (!table.meta?.extra?.primaryTable) {
        if (!views[table.uid]) {
          views[table.uid] = [
            {
              uid: unique(),
              name: global.i18next.t('projectControll.form'),
              type: "form"
            },
            {
              uid: unique(),
              name: global.i18next.t('projectControll.dataTable'),
              type: "table"
            },
          ]
        }
      }
    }
    nocodeBody.views = views;
    nocodeBody.formData = formData;
    const changedProcessTableUIDs = this.getChangedProcessTableUIDs(oldFormData, formData);
    if (changedProcessTableUIDs.length) {
      this.scheduleDefinitionService.validateEnabledSchedules(formData, nocodeId, changedProcessTableUIDs);
      await this.scheduleDefinitionService.stageScheduleChange(nocodeId);
    }
    await syncNewerNocodeRuntimeStateFromBody(this.nocodesDir, nocodeId, nocodeBody);
    const result = await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
    if (changedProcessTableUIDs.length) {
      await this.scheduleDefinitionService.queueScheduleChange(nocodeId, "configuration");
    }
    return result;
  }

  @Post("save-sub-serial-number-counters")
  async saveSubSerialNumberCounters(
    @Body('nocodeId') nocodeId: string,
    @Body("counters") counters: Array<{
      tableUID: string,
      fieldId: string,
      counter: {
        count?: number,
        resetTime?: number | null,
        updateTime?: number | null,
      }
    }>,
  ) {
    return await this.projectService.saveSubSerialNumberCounters(nocodeId, counters);
  }


  @UseGuards(AdminPermissionsGuard, NocodeSyncGuard)
  @ReturnMainSign()
  @Post("save-nocode-permissions")
  async saveNocodePermissions(@Body('nocodeId') nocodeId: string, @Body("permissions") permissions, @Body("permissionType") permissionType) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
     if(!nocodeBody.permissions) {
      nocodeBody.permissions = { application:{
        get: {
          rangeType:  PermissionFilterMode.BLACK,
          blacklist: {
            departments: [],
            roles: [],
            users: [],
          },
          whitelist: {
            departments: [],
            roles: [],
            users: [],
          },
        },
        delete: {
          rangeType:  PermissionFilterMode.BLACK,
          blacklist: {
            departments: [],
            roles: [],
            users: [],
          },
          whitelist: {
            departments: [],
            roles: [],
            users: [],
          },
        },
        update: {
          rangeType:  PermissionFilterMode.BLACK,
          blacklist: {
            departments: [],
            roles: [],
            users: [],
          },
          whitelist: {
            departments: [],
            roles: [],
            users: [],
          },
        },
      },page:{},data:{}, view: {}, operation: {}, field: {} }
    }
    nocodeBody.permissions[permissionType] = permissions;
    const result = await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
    return result;
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("rename-nocode-form")
  async renameNocodeForm(@Body('nocodeId') nocodeId: string, @Body("tableUID") tableUID: TableUID, @Body("name") name: string) {
    const result = await this.projectService.renameNocodeForm(nocodeId, tableUID, name);
    return result;
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("save-nocode-settings")
  async saveNocodeSettings(
    @Body('nocodeId') nocodeId: string,
    @Body("themeColor") themeColor,
    @Body("theme") theme: ClientTheme,
    @Body("settings") settings?: NocodeBody["settings"],
  ) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    if (themeColor !== undefined) {
      nocodeBody.themeColor = themeColor;
    }
    if (theme !== undefined) {
      nocodeBody.theme = theme;
    }
    if (settings !== undefined) {
      const nextSettings = { ...settings };
      if (nextSettings.homePage) {
        nextSettings.homePage = normalizeNocodeHomePageSetting(
          nocodeBody.structure,
          nextSettings.homePage,
        );
      }
      nocodeBody.settings = nextSettings;
    }
    const result = await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
    return result;
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("save-nocode-aggregate-tables")
  async saveNocodeAggregateTables(
    @Body('nocodeId') nocodeId: string,
    @Body('aggregateTables') aggregateTables?: NocodeFormData["aggregateTables"],
  ) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    if (!nocodeBody.formData) {
      nocodeBody.formData = {
        uid: unique() as NocodeFormData["uid"],
        options: {
          tables: [],
        },
        formOptions: {} as NocodeFormData["formOptions"],
        tables: [],
      };
    }
    nocodeBody.formData.aggregateTables = aggregateTables || [];
    const result = await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
    return result;
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("save-nocode-table-edit")
  async saveNocodeTableEdit(@Body('nocodeId') nocodeId: string, @Body("isEditTableCell") isEditTableCell) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    nocodeBody.isEditTableCell = isEditTableCell;
    return await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("save-nocode-toc")
  async saveNocodeToc(@Body('nocodeId') nocodeId: string, @Body("tableId") tableId: string, @Body("data") data) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    if (!nocodeBody.views) {
      nocodeBody.views = {};
    }
    nocodeBody.views[tableId] = data;
    return await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("append-form-field-choice")
  async appendFormFieldChoice(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("rootTableUID") rootTableUID: TableUID,
    @Body("fieldId") fieldId: string,
    @Body("widgetUID") widgetUID: string,
    @Body("sign") sign: string,
    @Body("targetSign") targetSign: string,
    @Body("choice") choice: {
      id?: string;
      label: string;
      value: string;
      color?: string;
    },
  ) {
    const result = await this.projectService.appendFormFieldChoice(nocodeId, {
      tableUID,
      rootTableUID,
      fieldId,
      widgetUID,
      sign,
      targetSign,
      choice,
    });
    return {
      sourceNocodeId: result.sourceNocodeId,
      sign: result.sign,
    };
  }

  @ReturnMainSign()
  @Post("get-form-field-choice-sign")
  async getFormFieldChoiceSign(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("rootTableUID") rootTableUID: TableUID,
    @Body("fieldId") fieldId: string,
    @Body("widgetUID") widgetUID: string,
  ) {
    return await this.projectService.getFormFieldChoiceSign(nocodeId, {
      tableUID,
      rootTableUID,
      fieldId,
      widgetUID,
      choice: {
        label: "",
        value: "",
      },
    });
  }

  @ReturnMainSign()
  @Post("get-nocode-sign")
  async getNocodeSign(
    @Body("nocodeId") nocodeId: string,
  ) {
    return await this.projectService.getNocodeSign(nocodeId);
  }

  @NoLocalAuthGuard()
  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("append-public-form-field-choice")
  async appendPublicFormFieldChoice(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("rootTableUID") rootTableUID: TableUID,
    @Body("fieldId") fieldId: string,
    @Body("widgetUID") widgetUID: string,
    @Body("sign") sign: string,
    @Body("targetSign") targetSign: string,
    @Body("choice") choice: {
      id?: string;
      label: string;
      value: string;
      color?: string;
    },
    @Req() req: Request,
  ) {
    const rowShareToken = this.getPublicRowShareToken(req);
    const publicFormShare = this.getPublicFormShareContext(req);
    const result = await this.projectService.appendPublicFormFieldChoice(nocodeId, {
      tableUID,
      rootTableUID,
      fieldId,
      widgetUID,
      sign,
      targetSign,
      choice,
    }, {
      rowShareToken,
      publicFormShare,
    });
    return {
      sourceNocodeId: result.sourceNocodeId,
      sign: result.sign,
    };
  }

  @NoLocalAuthGuard()
  @ReturnMainSign()
  @Post("get-public-form-field-choice-sign")
  async getPublicFormFieldChoiceSign(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("rootTableUID") rootTableUID: TableUID,
    @Body("fieldId") fieldId: string,
    @Body("widgetUID") widgetUID: string,
    @Req() req: Request,
  ) {
    const rowShareToken = this.getPublicRowShareToken(req);
    const publicFormShare = this.getPublicFormShareContext(req);
    return await this.projectService.getPublicFormFieldChoiceSign(nocodeId, {
      tableUID,
      rootTableUID,
      fieldId,
      widgetUID,
      choice: {
        label: "",
        value: "",
      },
    }, {
      rowShareToken,
      publicFormShare,
    });
  }

  @NoLocalAuthGuard()
  @ReturnMainSign()
  @Post("get-public-nocode-sign")
  async getPublicNocodeSign(
    @Body("nocodeId") nocodeId: string,
    @Body("rootTableUID") rootTableUID: TableUID,
    @Req() req: Request,
  ) {
    const rowShareToken = this.getPublicRowShareToken(req);
    const publicFormShare = this.getPublicFormShareContext(req);
    return await this.projectService.getPublicNocodeSign(nocodeId, rootTableUID, {
      rowShareToken,
      publicFormShare,
    });
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("save-nocode-structure")
  async saveNocodeStructure(@Body('nocodeId') nocodeId: string, @Body("structure") structure: NocodeStructure[]) {
    return await this.projectService.saveNocodeStructure(nocodeId, structure);
  }
  
  @Post("upload-nocode-print-template")
  @UseInterceptors(FileInterceptor("file", { dest: uploadDir }))
  async uploadNocodePrintTemplate(@Body('fileName') fileName: string, @UploadedFile() file, @Body("nocodeId") nocodeId: string, @Req() req: Request, @Body("oldFilePath") oldFilePath?: string) {
    return await this.projectService.uploadPrintTemplate(file, fileName, nocodeId);
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("update-nocode-print-template")
  async updateNocodePrintTemplate(@Body('nocodeId') nocodeId: string, @Body("tableId") tableId: TableUID, @Body("printTemplate") printTemplate: PrintTemplate) {
    return await this.projectService.updatePrintTemplate(nocodeId, tableId, printTemplate);
  }

  @Get("get-all-print-template")
  async getNocodePrintTemplateTable(@Query('nocodeId') nocodeId: string, @Query("tableId") tableId: TableUID) {
    return await this.projectService.getAllPrintTemplate(nocodeId, tableId);
  }

  @Get("get-filtered-print-template")
  async getNocodePrintTemplateList(@Query('nocodeId') nocodeId: string, @Query("tableId") tableId: TableUID) {
    return await this.projectService.getFilteredPrintTemplate(nocodeId, tableId);
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("copy-nocode-print-template")
  async copyNocodePrintTemplate(@Body('nocodeId') nocodeId: string, @Body("tableId") tableId: TableUID, @Body("printTemplateUID") printTemplateUID: string) {
    return await this.projectService.copyPrintTemplate(nocodeId, tableId, printTemplateUID);
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("delete-nocode-print-template")
  async deleteNocodePrintTemplate(@Body('nocodeId') nocodeId: string, @Body("tableId") tableId: TableUID, @Body("printTemplateUID") printTemplateUID: string) {
    return await this.projectService.deletePrintTemplate(nocodeId, tableId, printTemplateUID);
  }

  @Get("get-form-export-template-list")
  async getFormExportTemplateList(@Query("nocodeId") nocodeId: string, @Query("tableUID") tableUID: TableUID) {
    return await this.projectService.getFormExportTemplateList(nocodeId, tableUID);
  }

  @Post("template-render")
  async getTemplateRender(@Body('nocodeId') nocodeId: string, @Body('tableId') tableId: TableUID, @Body('printTemplateUID') printTemplateUID: string, @Body('printTemplate') printTemplate: PrintTemplate, @Body('selectRowUids') selectRowUids: Array<string>) {
    const result = await this.projectService.getTemplateRender(nocodeId, tableId, printTemplateUID, printTemplate, selectRowUids);
    return result;
  }

  @Post("generate-print-file")
  async generatePrintFile(@Body('nocodeId') nocodeId: string, @Body('tableId') tableId: TableUID, @Body('printTemplateUID') printTemplateUID: string, @Body('selectRowUids') selectRowUids: Array<string>, @Body('mergePrint') mergePrint: boolean) {
    const result = await this.projectService.generatePrintFile(nocodeId, tableId, printTemplateUID, selectRowUids, mergePrint);
    return result;
  }

  @Post("generate-print-file-url")
  async generatePrintFileUrl(@Body('nocodeId') nocodeId: string, @Body('tableId') tableId: TableUID, @Body('recordId') recordId: string, @Body('isTemporary') isTemporary: boolean, @Body('excelPrintSheetName') excelPrintSheetName: string) {
    return await this.projectService.generatePrintFileUrl(nocodeId, tableId, recordId, { isTemporary, excelPrintSheetName });
  }

  @Post("delete-print-record")
  async deletePrintRecord(@Body('nocodeId') nocodeId: string, @Body('tableId') tableId: TableUID, @Body('printRecordUID') printRecordUID: string) {
    return await this.projectService.deletePrintRecord(nocodeId, tableId, printRecordUID);
  }

  @Post("clear-print-record")
  async clearPrintRecord(@Body('nocodeId') nocodeId: string, @Body('tableId') tableId: TableUID) {
    return await this.projectService.clearPrintRecord(nocodeId, tableId);
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("copy-page")
  async copyPage(@Body('nocodeId') nocodeId: string, @Body('sourcePageId') sourcePageId: string, @Body('copyPageId') copyPageId: string, @Body("structure") structure: NocodeStructure[]) {
    const result = await this.projectService.copyPage(nocodeId, sourcePageId, copyPageId, structure);
    return result;
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("delete-nocode-structure")
  async deleteNocodeStructure(@Body('nocodeId') nocodeId: string, @Body("id") id: string) {
    return await this.projectService.deleteNocodeStructure(nocodeId, id);
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("rename-nocode-structure")
  async renameNocodeStructure(@Body('nocodeId') nocodeId: string, @Body("name") name: string, @Body("id") id: string) {
    return await this.projectService.renameNocodeStructure(nocodeId, name, id);
  }

  @Get("get-sharing-nocodes")
  async getShareNocodes() {
    return await this.projectService.getSharingNocodes();
  }

  @Get("get-share-nocodes-by-account-id")
  async getShareNocodesByAccountId(@Query("hasBody") hasBody, @Req() req: Request)  {
    const accountId = req.account?.id ?? "";
    const nocodeMetas = await this.projectService.getSharePermissionsByAccountId(accountId);
    if (hasBody) {
      const nocodes = await Promise.all(nocodeMetas.map(async (meta) => {
        const body = await getNocodeBody(this.nocodesDir, meta.id).catch(() => null);
        const importState = this.projectService.getNocodeImportRestrictionStateByMeta(meta, req.account);
        return {
          meta,
          body,
          importState,
        }
      }));
      return nocodes.filter((nocode) => !!nocode.body);
    }
    return nocodeMetas;
  }

  @Get("get-share-nocode-summaries-by-account-id")
  async getShareNocodeSummariesByAccountId(@Req() req: Request)  {
    return await this.projectService.getShareNocodeSummariesByAccount(req.account);
  }

  @Post("restore-broken-nocode")
  async restoreBrokenNocode(@Body("nocodeId") nocodeId: string, @Req() req: Request) {
    return await this.projectService.restoreBrokenNocodeByAccount(nocodeId, req.account);
  }

  // @Post("copy-embedded-table")
  // async copyEmbeddedTable(@Body("connection") connection: Connection, @Body("table") table: Table, @Body("tableName") tableName: string, @Body("id") id: string) {
  //   return await this.connectionUtils.copyEmbeddedTable(connection, table, tableName, id);
  // }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("update-nocode-pages")
  async updateNocodeProjects(
    @Body("nocodeId") nocodeId: string,
    @Body("updateMethod") updateMethod: PublishUpdateMethod,
    @Body("innerUpdateMethod") innerUpdateMethod: PublishUpdateMethod,
    @Body("publicUpdateMethod") publicUpdateMethod: PublishUpdateMethod,
    @Body("projectBodies") projectBodies: ProjectBody[],
    @Body("tables") tables?: Table[],
    @Body("releaseTableUIDs") releaseTableUIDs?: string[],
  ) {
    const result = await this.projectService.updateNocodeProjects(nocodeId, {
      updateMethod,
      innerUpdateMethod,
      publicUpdateMethod,
    }, projectBodies, tables, releaseTableUIDs);
    return result;
  }

  @NoLocalAuthGuard()
  @Get("validate-share")
  async validateShare(
    @Query("type") type: PublishCategory,
    @Query("nocodeId") nocodeId: string,
    @Query("projectId") projectId?: string,
  ) {
    return await this.projectService.validateShare(type, nocodeId, projectId);
  }

  @Post("row-share/create-or-get")
  async createOrGetRowShare(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("rowUUID") rowUUID: string,
    @Req() req: Request,
  ) {
    return await this.projectService.createOrGetRowShare(nocodeId, tableUID, rowUUID, req.account?.id || "");
  }

  @Post("row-share/access-config")
  async updateRowShareAccessConfig(
    @Body("token") token: string,
    @Body("scope") scope: RowShareAccessScope,
    @Body("access") access: Record<string, any>,
    @Req() req: Request,
  ) {
    return await this.projectService.updateRowShareAccessConfig(token, scope, access, req.account);
  }

  @NoLocalAuthGuard()
  @Get("row-share/access")
  async getRowShareAccess(
    @Query("token") token: string,
    @Query("scope") scope: RowShareAccessScope,
  ) {
    return await this.projectService.getRowShareAccess(token, scope);
  }

  @Get("row-share/access-detail")
  async getRowShareAccessDetail(
    @Query("token") token: string,
    @Query("scope") scope: RowShareAccessScope,
  ) {
    return await this.projectService.getRowShareAccess(token, scope, true);
  }

  @NoLocalAuthGuard()
  @Post("row-share/visit")
  async visitRowShare(
    @Body("token") token: string,
    @Body("scope") scope: RowShareAccessScope,
    @Body("password") password: string,
    @Req() req: Request,
  ) {
    return await this.projectService.visitRowShare(token, scope, password, req.account?.id || "");
  }

  @NoLocalAuthGuard()
  @Post("row-share/validate-access-token")
  async validateRowShareAccessToken(
    @Body("token") token: string,
    @Body("scope") scope: RowShareAccessScope,
    @Body("accessToken") accessToken: string,
    @Req() req: Request,
  ) {
    return await this.projectService.validateRowShareAccessToken(token, scope, accessToken, req.account?.id || "");
  }

  @Get("row-share/bootstrap")
  async getRowShareBootstrap(@Query("token") token: string, @Req() req: Request) {
    return await this.projectService.getRowShareBootstrap(token, this.getRowShareAccessToken(req));
  }

  @Post("row-share/update")
  async updateRowShare(@Body("token") token: string, @Body("row") row: Record<string, any>, @Req() req: Request) {
    return await this.projectService.updateRowShare(token, row, this.getRowShareAccessToken(req));
  }

  @NoLocalAuthGuard()
  @Get("public-row-share/bootstrap")
  async getPublicRowShareBootstrap(@Query("token") token: string, @Req() req: Request) {
    return await this.projectService.getPublicRowShareBootstrap(token, this.getRowShareAccessToken(req));
  }

  @NoLocalAuthGuard()
  @Post("public-row-share/update")
  async updatePublicRowShare(@Body("token") token: string, @Body("row") row: Record<string, any>, @Req() req: Request) {
    return await this.projectService.updatePublicRowShare(token, row, this.getRowShareAccessToken(req));
  }

  @NoLocalAuthGuard()
  @Get("validate-public-query")
  async validatePublicQuery(
    @Query("nocodeId") nocodeId: string,
    @Query("tableUID") tableUID: TableUID,
  ) {
    return await this.projectService.validatePublicQuery(nocodeId, tableUID);
  }

  @NoLocalAuthGuard()
  @Get("public-query/bootstrap")
  async getPublicQueryBootstrap(
    @Query("nocodeId") nocodeId: string,
    @Query("tableUID") tableUID: TableUID,
    @Req() req: Request,
  ) {
    const headerToken = req.headers["x-public-query-token"];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    return await this.projectService.getPublicQueryBootstrap(nocodeId, tableUID, token);
  }

  @NoLocalAuthGuard()
  @Get("public-query/access")
  async getPublicQueryAccess(
    @Query("nocodeId") nocodeId: string,
    @Query("tableUID") tableUID: TableUID,
  ) {
    return await this.projectService.getPublicQueryAccess(nocodeId, tableUID);
  }

  @NoLocalAuthGuard()
  @Post("public-query/visit")
  async visitPublicQuery(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("password") password: string,
  ) {
    return await this.projectService.visitPublicQuery(nocodeId, tableUID, password);
  }

  @NoLocalAuthGuard()
  @Post("validate-public-query-token")
  async validatePublicQueryToken(
    @Body("nocodeId") nocodeId: string,
    @Body("tableUID") tableUID: TableUID,
    @Body("token") token: string,
  ) {
    return await this.projectService.validatePublicQueryToken(nocodeId, tableUID, token);
  }

  @NoLocalAuthGuard()
  @Post("validate-share-token")
  async validateShareToken(@Body("nocodeId") nocodeId: string, @Body("pageId") pageId: string, @Body("type") type: PublishCategory, @Body("token") token: string) {
    return await this.projectService.validateShareToken(nocodeId, pageId, type, token);
  }

  @UseGuards(NocodeSyncGuard)
  @ReturnMainSign()
  @Post("update-nocode-table-view-meta")
  async updateNocodeTableViewMeta(@Body("nocodeId") nocodeId: string, @Body("tableUID") tableUID: string, @Body("meta") meta: FormTableViewMeta) {
    const result = await this.projectService.updateNocodeTableViewMeta(nocodeId, tableUID, meta);
    return result;
  }

  @Get("api-setting/:appId")
  async getApiSetting(
    @Param("appId") appId: string
  ) {
    return await this.projectService.getApiSetting(appId);
  }

  @UseGuards(AdminPermissionsGuard)
  @Post("api-setting")
  async setApiSetting(
    @Body() nocodeRow: NocodeEntity
  ) {
    const result = await this.projectService.setApiSetting(nocodeRow);
    return result;
  }

  @Post("api-alias-valid")
  async validApiAlias(
    @Body('alias') alias: string,
    @Body('type') type: AliasType,
    @Body('appId') appId: string,
    @Body('tableId') tableId?: TableUID
  ) {
    return await this.projectService.validApiAlias(alias, type, appId, tableId);
  }


  // 分组管理

  // 获取分组
  // 获取所有分组
  @Get("get-all-nocode-groups")
  async getAllNocodeGroups() {
    return await this.projectService.getAllNocodeGroups();
  }
  // 创建分组
  @Post("create-nocode-group")
  async createNocodeGroup(@Body("name") name:string) {
    return await this.projectService.createNocodeGroup(name);
  }

  // 重命名分组
  @Get("rename-nocode-group")
  async renameNocodeGroup(@Query("name") name:string, @Query("id") id:string) {
    await this.projectService.renameNocodeGroup(id, name);
    return name
  }

  // 删除分组（软删除：标记为删除）
  @Get("delete-nocode-group")
  async deleteNocodeGroup(@Query("groupId") groupId:string) {
    const result = await this.projectService.deleteNocodeGroup(groupId);
    return result;
  }

  // 将nocode应用移动到指定分组
  @Post("move-nocodes-to-group")
  async moveNocodesToGroup(@Body("nocodeIds") nocodeIds:string[], @Body("groupId") groupId:string) {
    const result = await this.projectService.moveNocodesToGroup(nocodeIds, groupId);
    return result;
  }
  
  // 将nocode应用移出分组（设为未分组）
  @Post("remove-nocodes-from-group")
  async removeNocodesFromGroup(@Body("nocodeIds") nocodeIds:string[]) {
    const result = await this.projectService.removeNocodesFromGroup(nocodeIds);
    return result;
  }

  // 根据拖拽之后新的排序信息，更新分组列表信息
  @Post("update-group-sort")
  async updateGroupSort(@Body("newSort") newSort:object[]) {
    const result = await this.projectService.updateGroupSort(newSort);
    return result;
  }

  // 根据拖拽之后新的排序信息，更新应用列表信息
  @Post("update-nocode-sort")
  async updateNocodeSort(@Body("newSort") newSort:object[]) {
    const result = await this.projectService.updateNocodeSort(newSort);
    return result;
  }

  @Post("validate-sync")
  async validateSync(@Body("nocodeId") nocodeId:string, @Req() req: Request) {
    const headerSign = req.headers["x-sign"];
    const sign = Array.isArray(headerSign) ? headerSign[0] : headerSign;
    return await validateSynchronization(this.nocodesDir, nocodeId, sign);
  }
}
