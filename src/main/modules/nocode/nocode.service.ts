import { EntityManager, FilterQuery } from '@mikro-orm/core';
import { Injectable, Logger, Inject, OnApplicationBootstrap } from '@nestjs/common';
import { FormConditionValueType, FormTableRuntime, NocodeBody, KeyValue, NocodeFormData, PermissionCategory, PermissionRangeType } from '@common/types/nocode';
import { MikroORM, RequestContext, UseRequestContext } from "@mikro-orm/core";
import { NOCODES_DIR, UPLOADS_DIR } from '@main/constants';
import { getNocodeBody, getNocodeRuntimeState, getRuntimeCounter, parseExcelData, saveNocodeBody, saveNocodeRuntimeState, setRuntimeCounter } from '@main/utils';
import { ConnectionUID, DataChangeType, Field, FieldUID, FlowOpinionFile, ProcessNodeType, Row, Table, TableUID, WhereCondition } from '@common/types/project';
import { isSystemAdminAccount, type Account } from '@common/types/account';
import { isEmpty, deepClone } from '@common/utils/object';
import { FormDataStage, getFlows, getUUIDSystemField, hasConfiguredValue, isBuiltinField, replaceIllegalChars } from '@common/utils';
import { getNocodeDataSourceTableByUID } from '@common/utils/connection';
import { ConnectionUtils } from '../project/connection.utils';
import { unique } from '@common/utils/unique';
import { Nocode, NocodeRepository } from '../project/entities';
import { ProjectService } from '../project/project.services';
import path, { join } from 'path';
import { rename, writeFile, mkdir, cp, rm, readdir, stat, copyFile } from 'fs/promises';
import { WorkbenchService } from '../workbench/workbench.service';
import { FormDataService } from '../formData/form-data.service';
import { ViewActionTriggerTaskService } from '../formData/view-action-trigger-task.service';
import type { DataChangeFlowQueueState } from '../formData/types';
import { RequestStorage } from '@main/middleware';
import { ExcelFileData, ExcelFormColMap, ExcelLocation, ExcelSubformColMaps, SheetData } from '@common/types/excel';
import { validateSerialNumber } from './utils';
import { parseRelatedDataIds, processCellData } from '@common/utils/validate';
import { createWriteStream, existsSync } from 'fs';
import { zip } from '@main/utils/zip'
import os from "os";
import { getRuntime } from '@main/runtime';
import { getFormulaStr, rowsDefaultValueCalculation } from "@common/utils/formula";
import { countSerialNumber } from '../formData/utils';
import { assignFieldsAuth } from '@common/utils/element';
import * as XLSX from 'xlsx';
import iconv from 'iconv-lite';
import yauzl from 'yauzl';
import { Response } from 'express';
import { convertMarkdownEditorRowValues } from '../formData/markdown-editor-storage.util';

const IMPORT_SESSION_DIR_PREFIX = "nocode-import-session-";

type ImportPostMutationBatch = {
  rows: Row[];
  source: DataChangeType.ADD | DataChangeType.EDIT;
  beforeMutationRows?: Row[];
  queueState?: DataChangeFlowQueueState | null;
  preparedTaskId?: string;
  requestDigest?: string;
  eventId?: string;
};
const IMPORT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const IMPORT_PACKAGE_MAX_SIZE = 200 * 1024 * 1024;
const IMPORT_IMAGE_FILE_EXTENSIONS = new Set([
  ".apng",
  ".avif",
  ".bmp",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
]);

type ImportSourceType = "excel" | "zip";
type ImportSessionMeta = {
  sessionId: string;
  sourceType: ImportSourceType;
  rootDir: string;
  sourcePath: string;
  excelPath: string;
};
type ImportResolvedUploadFile = FlowOpinionFile;

type ExcelImportErrorItem = {
  rowIndexes: number[];
  rows: any[][];
  reason: string;
}

type ImportExcelProgressTask = {
  taskId: string;
  percent: number;
  successImportCount?: number;
  importMode?: string;
  heartbeatTimer?: ReturnType<typeof setInterval>;
  flowProgressTimer?: ReturnType<typeof setInterval>;
  startedAt?: number;
  estimatedDurationMs?: number;
  flowComplexityScore?: number;
  flowEstimateProfile?: 'default' | 'dataProcessingHeavy';
}

type ImportExcelProgressEvent = {
  taskId: string;
  percent: number;
}

@Injectable()
export class NocodeService implements OnApplicationBootstrap {
  private static readonly IMPORT_EXCEL_PARSE_MAX_PERCENT = 20;
  private static readonly IMPORT_EXCEL_FLOW_MAX_PERCENT = 89.9;
  private static readonly IMPORT_EXCEL_FLOW_SHORT_MIN_DURATION_MS = 10000;
  private static readonly IMPORT_EXCEL_FLOW_MEDIUM_MIN_DURATION_MS = 18000;
  private static readonly IMPORT_EXCEL_FLOW_LONG_MIN_DURATION_MS = 30000;
  private static readonly IMPORT_EXCEL_FLOW_DEFAULT_BASE_STARTUP_MS = 2500;
  private static readonly IMPORT_EXCEL_FLOW_DEFAULT_PER_ROW_MS = 1900;
  private static readonly IMPORT_EXCEL_FLOW_DEFAULT_COMPLEXITY_UNIT_MS = 120;
  private static readonly IMPORT_EXCEL_FLOW_DEFAULT_ROW_COMPLEXITY_FACTOR_MS = 10;
  private static readonly IMPORT_EXCEL_FLOW_DATA_PROCESSING_HEAVY_BASE_STARTUP_MS = 8000;
  private static readonly IMPORT_EXCEL_FLOW_DATA_PROCESSING_HEAVY_PER_ROW_MS = 21000;
  private static readonly IMPORT_EXCEL_FLOW_DATA_PROCESSING_HEAVY_COMPLEXITY_UNIT_MS = 300;
  private static readonly IMPORT_EXCEL_FLOW_MAX_DURATION_MS = 180000;
  private static readonly IMPORT_EXCEL_FLOW_LARGE_MAX_DURATION_MS = 600000;
  private static readonly IMPORT_EXCEL_FLOW_TICK_MS = 1000;
  private readonly logger = new Logger("NocodeService");
  private nocodeRepository: NocodeRepository;
  private importExcelProgressTasks = new Map<string, ImportExcelProgressTask>();
  private importExcelProgressStreamClients = new Map<string, Set<Response>>();
  constructor(
    private readonly entityManager: EntityManager,
    private readonly orm: MikroORM, // used by @UseRequestContext()
    private readonly connectionUtils: ConnectionUtils,
    private readonly workbenchService: WorkbenchService,
    private readonly formDataService: FormDataService,
    private readonly viewActionTriggerTaskService: ViewActionTriggerTaskService,
    private readonly projectService: ProjectService,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
  ) {
    this.nocodeRepository = this.entityManager.getRepository(Nocode);
  }

  @UseRequestContext()
  async onApplicationBootstrap() {
    await this.cleanupStaleImportSessions();
  }

  private buildImportSessionRoot(sessionId: string) {
    return join(os.tmpdir(), `${IMPORT_SESSION_DIR_PREFIX}${sessionId}`);
  }

  private getImportSessionStageRoot(sessionId: string) {
    return join(this.buildImportSessionRoot(sessionId), "stage", "unzipped");
  }

  private isImportSessionPath(targetPath: string) {
    const normalizedRoot = path.resolve(os.tmpdir());
    const normalizedTarget = path.resolve(targetPath);
    return normalizedTarget.startsWith(path.resolve(join(normalizedRoot, IMPORT_SESSION_DIR_PREFIX)));
  }

  private async collectExcelFiles(rootDir: string) {
    const excelFiles: string[] = [];
    const pendingDirs = [rootDir];

    while (pendingDirs.length > 0) {
      const currentDir = pendingDirs.pop();
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const entryPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          pendingDirs.push(entryPath);
          continue;
        }
        const extension = path.extname(entry.name).toLowerCase();
        if ([".xlsx", ".xls"].includes(extension)) {
          excelFiles.push(entryPath);
        }
      }
    }

    return excelFiles;
  }

  private resolveImportExcelPathFromZip(zipRoot: string, excelFiles: string[]) {
    if (excelFiles.length === 1) {
      return excelFiles[0];
    }

    const rootExcelFiles = excelFiles.filter(item => path.dirname(item) === zipRoot);
    if (rootExcelFiles.length === 1) {
      return rootExcelFiles[0];
    }

    throw new Error(global.i18next.t("ImportExcelDialog.invalidZipExcelEntry"));
  }

  private decodeImportZipEntryFileName(entry: yauzl.Entry) {
    const isUtf8 = (entry.generalPurposeBitFlag & 0x800) !== 0;
    return iconv.decode(entry.fileName as unknown as Buffer, isUtf8 ? "utf8" : "gbk");
  }

  private resolveImportZipEntryTargetPath(unzipDir: string, entryFileName: string) {
    const normalizedEntryName = entryFileName.replace(/\\/g, "/");
    const targetPath = path.resolve(unzipDir, normalizedEntryName);
    const relativeToRoot = path.relative(path.resolve(unzipDir), targetPath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      throw new Error(global.i18next.t("ImportExcelDialog.readExcelFileFail"));
    }

    return {
      normalizedEntryName,
      targetPath,
    };
  }

  private async extractImportZipDirectoryEntry(targetPath: string) {
    await mkdir(targetPath, { recursive: true });
  }

  private async extractImportZipFileEntry(entry: yauzl.Entry, zipFile: yauzl.ZipFile, targetPath: string) {
    await mkdir(path.dirname(targetPath), { recursive: true });

    return new Promise<void>((resolve, reject) => {
      zipFile.openReadStream(entry, (error, readStream) => {
        if (error || !readStream) {
          reject(error || new Error(global.i18next.t("ImportExcelDialog.readExcelFileFail")));
          return;
        }

        const writeStream = createWriteStream(targetPath);
        const fail = (streamError: unknown) => {
          readStream.destroy();
          writeStream.destroy();
          reject(streamError);
        };

        readStream.on("error", fail);
        writeStream.on("error", fail);
        writeStream.on("finish", () => resolve());
        readStream.pipe(writeStream);
      });
    });
  }

  private async unzipImportPackage(sourcePath: string, unzipDir: string) {
    return new Promise<void>((resolve, reject) => {
      let hasFinished = false;
      const finishWithError = (error: unknown, zipFile?: yauzl.ZipFile | null) => {
        if (hasFinished) {
          return;
        }
        hasFinished = true;
        zipFile?.close();
        reject(error instanceof Error ? error : new Error(String(error)));
      };

      yauzl.open(sourcePath, { lazyEntries: true, decodeStrings: false }, (openError, zipFile) => {
        if (openError || !zipFile) {
          finishWithError(openError || new Error(global.i18next.t("ImportExcelDialog.readExcelFileFail")));
          return;
        }

        const tasks: Promise<void>[] = [];
        zipFile.on("error", error => finishWithError(error, zipFile));
        zipFile.on("entry", entry => {
          let normalizedEntryName = "";
          let targetPath = "";
          try {
            const entryFileName = this.decodeImportZipEntryFileName(entry);
            ({ normalizedEntryName, targetPath } = this.resolveImportZipEntryTargetPath(unzipDir, entryFileName));
          } catch (error) {
            finishWithError(error, zipFile);
            return;
          }

          const task = /\/$/.test(normalizedEntryName)
            ? this.extractImportZipDirectoryEntry(targetPath)
            : this.extractImportZipFileEntry(entry, zipFile, targetPath);

          tasks.push(
            task
              .then(() => {
                zipFile.readEntry();
              })
              .catch(error => {
                finishWithError(error, zipFile);
              })
          );
        });

        zipFile.on("close", () => {
          Promise.all(tasks)
            .then(() => {
              if (hasFinished) {
                return;
              }
              hasFinished = true;
              resolve();
            })
            .catch(error => finishWithError(error, zipFile));
        });

        zipFile.readEntry();
      });
    });
  }

  private isUploadWidgetField(field?: Field) {
    const widgetType = field?.meta?.extra?.widgetType;
    return ["widget.form.image-uploader", "widget.form.file-uploader"].includes(widgetType);
  }

  private isZipImportSource(extraData: any) {
    if (!extraData?.sessionId || !extraData?.fullPath) {
      return false;
    }

    const stageRoot = this.getImportSessionStageRoot(extraData.sessionId).replace(/\\/g, "/");
    const currentPath = String(extraData.fullPath).replace(/\\/g, "/");
    return currentPath.startsWith(stageRoot);
  }

  private normalizeImportUploadPaths(data: any) {
    if (data == null) {
      return [];
    }

    return String(data)
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  }

  private buildImportUploadFieldError(field?: Field) {
    return new Error(global.i18next.t("ImportExcelDialog.invalidFieldData", {
      field: field?.alias || field?.meta?.name || "-",
    }));
  }

  private resolveImportZipRelativePath(baseDir: string, zipRoot: string, relativePath: string, field?: Field) {
    const normalizedPath = String(relativePath || "").trim().replace(/\\/g, "/");
    if (!normalizedPath) {
      throw this.buildImportUploadFieldError(field);
    }

    if (/^(https?:)?\/\//i.test(normalizedPath)) {
      throw this.buildImportUploadFieldError(field);
    }

    if (path.isAbsolute(normalizedPath)) {
      throw this.buildImportUploadFieldError(field);
    }

    const safeRelativePath = normalizedPath.replace(/^\.\//, "");
    if (!safeRelativePath) {
      throw this.buildImportUploadFieldError(field);
    }

    const resolvedBaseDir = path.resolve(baseDir);
    const resolvedZipRoot = path.resolve(zipRoot);
    const targetPath = path.resolve(resolvedBaseDir, safeRelativePath);
    const relativeToRoot = path.relative(resolvedZipRoot, targetPath);
    if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
      throw this.buildImportUploadFieldError(field);
    }

    return {
      targetPath,
    };
  }

  private async materializeImportUploadFiles(
    nocodeId: string,
    field: Field,
    data: any,
    extraData: any,
  ): Promise<ImportResolvedUploadFile[] | any> {
    if (Array.isArray(data)) {
      return data;
    }

    if (!this.isZipImportSource(extraData)) {
      return data == null || data === "" ? [] : data;
    }

    const pathList = this.normalizeImportUploadPaths(data);
    if (!pathList.length) {
      return [];
    }

    const zipRoot = this.getImportSessionStageRoot(extraData.sessionId);
    const excelDir = path.dirname(path.resolve(String(extraData.fullPath)));
    const uploadDir = join(this.uploadsDir, nocodeId);
    await mkdir(uploadDir, { recursive: true });

    const result: ImportResolvedUploadFile[] = [];
    for (const itemPath of pathList) {
      const { targetPath } = this.resolveImportZipRelativePath(excelDir, zipRoot, itemPath, field);
      if (!existsSync(targetPath)) {
        throw this.buildImportUploadFieldError(field);
      }

      const targetStat = await stat(targetPath);
      if (!targetStat.isFile()) {
        throw this.buildImportUploadFieldError(field);
      }

      const fileName = path.basename(targetPath);
      const extension = path.extname(fileName).toLowerCase();
      if (
        field?.meta?.extra?.widgetType === "widget.form.image-uploader"
        && !IMPORT_IMAGE_FILE_EXTENSIONS.has(extension)
      ) {
        throw this.buildImportUploadFieldError(field);
      }

      const uniqueFileName = `${path.basename(fileName, extension)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${extension}`;
      const uploadFilePath = join(uploadDir, uniqueFileName);
      await copyFile(targetPath, uploadFilePath);

      result.push({
        uid: unique(),
        name: fileName,
        status: "success",
        size: targetStat.size,
        url: `uploads/${nocodeId}/${uniqueFileName}`,
      });
    }

    return result;
  }

  private async normalizeImportRowUploadFields(
    nocodeId: string,
    formData: NocodeFormData,
    table: Table,
    row: Row,
    extraData: any,
  ) {
    for (const field of table?.fields || []) {
      if (!field) {
        continue;
      }

      if (this.isUploadWidgetField(field)) {
        row[field.uid] = await this.materializeImportUploadFiles(
          nocodeId,
          field,
          row[field.uid],
          extraData,
        );
        continue;
      }

      if (field.meta?.extra?.widgetType !== "widget.form.subform" || !Array.isArray(row[field.uid])) {
        continue;
      }

      const subTableUID = field.meta?.extra?.subTableUID?.[field.meta?.extra?.subTableUID?.length - 1];
      const subTable = formData.tables.find(item => item.uid === subTableUID);
      if (!subTable) {
        continue;
      }

      for (const subRow of row[field.uid]) {
        await this.normalizeImportRowUploadFields(nocodeId, formData, subTable, subRow, extraData);
      }
    }
  }

  private resolveImportSessionSourceType(fileName: string): ImportSourceType {
    return path.extname(fileName).toLowerCase() === ".zip" ? "zip" : "excel";
  }

  private async persistImportSourceFile(options: {
    sourcePath: string;
    originalName?: string;
    nocodeId?: string;
  }): Promise<string> {
    const sourcePath = String(options.sourcePath || "").trim();
    if (!sourcePath || !existsSync(sourcePath)) {
      throw new Error(global.i18next.t("ImportExcelDialog.readExcelFileFail"));
    }

    const originalName = String(options.originalName || path.basename(sourcePath) || "").trim();
    const extension = path.extname(originalName || sourcePath) || path.extname(sourcePath) || ".xlsx";
    const baseName = replaceIllegalChars(path.basename(originalName || `import${extension}`, extension) || "import") || "import";
    const persistedDir = join(
      this.uploadsDir,
      replaceIllegalChars(String(options.nocodeId || "").trim() || "_shared"),
      ".ai-import-sources",
    );

    await mkdir(persistedDir, { recursive: true });

    const persistedFilePath = join(
      persistedDir,
      `${baseName}_${Date.now()}_${unique(6)}${extension}`,
    );
    await copyFile(sourcePath, persistedFilePath);
    return persistedFilePath;
  }

  private async createImportSessionFromSource(options: {
    sourcePath: string;
    originalName?: string;
    size?: number;
    moveSourceFile?: boolean;
  }): Promise<ImportSessionMeta> {
    const sourcePath = String(options.sourcePath || "").trim();
    if (!sourcePath || !existsSync(sourcePath)) {
      throw new Error(global.i18next.t("ImportExcelDialog.readExcelFileFail"));
    }

    const sourceStat = await stat(sourcePath).catch(() => null);
    if (!sourceStat?.isFile()) {
      throw new Error(global.i18next.t("ImportExcelDialog.readExcelFileFail"));
    }

    const size = Number(options.size || sourceStat.size || 0);
    if (size > IMPORT_PACKAGE_MAX_SIZE) {
      if (options.moveSourceFile) {
        await rm(sourcePath, { force: true }).catch(() => null);
      }
      throw new Error(global.i18next.t("ImportExcelDialog.importPackageTooLarge"));
    }

    const originalName = String(options.originalName || path.basename(sourcePath) || "").trim();
    const sourceType = this.resolveImportSessionSourceType(originalName || sourcePath);
    const extension = path.extname(originalName).toLowerCase();
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const rootDir = this.buildImportSessionRoot(sessionId);
    const sourceDir = join(rootDir, "source");
    const stageDir = join(rootDir, "stage");
    try {
      await mkdir(sourceDir, { recursive: true });
      await mkdir(stageDir, { recursive: true });

      const normalizedFileName = originalName || `import${extension || (sourceType === "zip" ? ".zip" : ".xlsx")}`;
      const sessionSourcePath = join(sourceDir, normalizedFileName);
      if (options.moveSourceFile) {
        try {
          await rename(sourcePath, sessionSourcePath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code !== "EXDEV") {
            throw error;
          }
          await copyFile(sourcePath, sessionSourcePath);
          await rm(sourcePath, { force: true });
        }
      } else {
        await copyFile(sourcePath, sessionSourcePath);
      }

      if (sourceType === "excel") {
        return {
          sessionId,
          sourceType,
          rootDir,
          sourcePath: sessionSourcePath,
          excelPath: sessionSourcePath,
        };
      }

      const unzipDir = join(stageDir, "unzipped");
      await mkdir(unzipDir, { recursive: true });
      // Windows 涓嬬敤鎴锋墜鍔ㄥ帇缂╃殑瀵煎叆鍖呮枃浠跺悕閫氬父鎸?GBK 缂栫爜锛岃嚜鍔ㄦ帰娴嬩細鎶婁腑鏂囩洰褰曞悕瑙ｉ敊
      await this.unzipImportPackage(sessionSourcePath, unzipDir);

      const excelFiles = await this.collectExcelFiles(unzipDir);
      if (!excelFiles.length) {
        throw new Error(global.i18next.t("ImportExcelDialog.invalidZipExcelCount"));
      }
      const excelPath = this.resolveImportExcelPathFromZip(unzipDir, excelFiles);

      return {
        sessionId,
        sourceType,
        rootDir,
        sourcePath: sessionSourcePath,
        excelPath,
      };
    } catch (error) {
      await rm(rootDir, { recursive: true, force: true }).catch(() => null);
      throw error;
    }
  }

  private async createImportSession(file: { path?: string; originalname?: string; size?: number }, fileMessage: any): Promise<ImportSessionMeta> {
    return await this.createImportSessionFromSource({
      sourcePath: String(file?.path || "").trim(),
      originalName: String(fileMessage?.filename || file.originalname || "").trim(),
      size: file?.size,
      moveSourceFile: true,
    });
  }

  async cleanupImportSession(sessionId: string) {
    if (!sessionId) {
      return { cleaned: false };
    }

    const targetPath = this.buildImportSessionRoot(sessionId);
    if (!this.isImportSessionPath(targetPath)) {
      return { cleaned: false };
    }

    await rm(targetPath, { recursive: true, force: true }).catch(() => null);
    return { cleaned: true };
  }

  async cleanupStaleImportSessions() {
    const tempRoot = os.tmpdir();
    const entries = await readdir(tempRoot, { withFileTypes: true }).catch(() => []);
    const now = Date.now();

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(IMPORT_SESSION_DIR_PREFIX)) {
        continue;
      }

      const targetPath = join(tempRoot, entry.name);
      const targetStat = await stat(targetPath).catch(() => null);
      if (!targetStat) {
        continue;
      }
      if (now - targetStat.mtimeMs <= IMPORT_SESSION_TTL_MS) {
        continue;
      }

      await rm(targetPath, { recursive: true, force: true }).catch(() => null);
    }
  }

  async getFieldsAuth(nocodeBody: NocodeBody, tableId: TableUID) {
    const account = await this.formDataService.getAccount();
    if (isSystemAdminAccount(account)) return "all";
    const permissions = nocodeBody?.permissions?.field?.[tableId]?.[PermissionCategory.GET];
    if (isEmpty(permissions)) return "all";
    const fieldsAuth: Record<string, number> = {};
    let hasMatchedPermission = false;
    let hasCustomFieldRange = false;
    for (const permission of permissions) {
      if (permission.memberRange.rangeType === PermissionRangeType.CUSTOM) {
        const users = await this.workbenchService.getUsers(permission.memberRange.range);
        const userIds = users.map(user => user.id);
        if (!userIds.includes(account.id)) continue;
      }
      hasMatchedPermission = true;
      if (permission.fieldRange.rangeType === PermissionRangeType.ALL) continue;
      hasCustomFieldRange = true;
      const range = permission.fieldRange.range;
      assignFieldsAuth(fieldsAuth, range);
    }
    if (!hasMatchedPermission) return "all";
    if (!hasCustomFieldRange || isEmpty(fieldsAuth)) return "all";
    return fieldsAuth;
  }

  private async resolveFormDataTableSource(nocodeId: string, tableId: TableUID) {
    const nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(nocodeId);
    const tableSource = getNocodeDataSourceTableByUID(nocodeBody, tableId, {
      nocodeId,
    }, true);

    return {
      nocodeBody,
      formData: tableSource?.connection || nocodeBody?.formData,
      table: tableSource?.table || nocodeBody?.formData?.tables?.find(t => t.uid === tableId),
      sourceNocodeId: tableSource?.connection?.nocodeId || nocodeId,
    };
  }

  async readFormData(nocodeId: string,tableId: TableUID, uuid: string) {
    const { nocodeBody, formData, table, sourceNocodeId } = await this.resolveFormDataTableSource(nocodeId, tableId);
    let row;
    if (uuid && table && formData) {
      const uuidField = getUUIDSystemField(table.fields);
      const { buckets } = await this.connectionUtils.readConnectionData(formData, false, sourceNocodeId, unique(), {}, {
        tableUIDs: [tableId],
        queryOptions: {
          filters: {
            [tableId]: [
              { [uuidField.uid]: uuid },
            ],
          },
          stage: {
            $ne: null,
          },
          formatData: true,
        },
      });
      row = buckets[0]?.rows?.[0];

      if (row) {
        //查询子表数据
        [row] = await this.formDataService.fillSubFormField(
          [row],
          sourceNocodeId,
          table,
          formData,
          {},
          false,
          true,
          "main",
          true,
          undefined,
          FormDataStage.NORMAL,
        );
      }
    }
    
    const fieldsAuth = sourceNocodeId === nocodeId ? await this.getFieldsAuth(nocodeBody, tableId) : "all";
    return {
      formData,
      otherDataSources: nocodeBody.otherDataSources || [],
      otherDataSourceSchemas: nocodeBody.otherDataSourceSchemas || [],
      settings: nocodeBody.settings,
      row,
      fieldsAuth,
    };
  }

  async readFormList(nocodeId: string, connectionId: ConnectionUID, tableId: TableUID) {
    const { nocodeBody, formData, sourceNocodeId } = await this.resolveFormDataTableSource(nocodeId, tableId);
    const { buckets } = await this.connectionUtils.readConnectionData(formData, false, sourceNocodeId, unique(), {}, {
       tableUIDs: [tableId],
       queryOptions: {
        formatData: true,
       }
    })

    // 填充子表单字段（全量填充性能消耗略大，使用时各数据再单独请求此字段的填充数据）
    // buckets[0].rows = await this.fillSubFormField(buckets[0].rows, nocodeId, table, formData);
    
    return {
      bucket: buckets[0],
      rows: buckets[0]?.rows,
      connection: formData,
      otherDataSources: nocodeBody.otherDataSources || [],
    }
  }
  
  async tableFieldList(appId: string, tableId: TableUID, subType?: string[] | string) {
    const nocodeBody = await this.projectService.getNocodeBodyWithOtherDataSources(appId);
    const table = getNocodeDataSourceTableByUID(nocodeBody, tableId, {
      nocodeId: appId,
    }, true)?.table;
    // 过滤掉系统字段
    let judger: Function = (field: Field) => !isBuiltinField(field);
    if (Array.isArray(subType)) {
      judger = (field: Field) => !isBuiltinField(field) && subType.indexOf(field.meta.subType) !== -1;
    } else if (subType) {
      // 此情况筛选出field.meta中subType属性 未定义或为null 的个体
      judger = (field: Field) => !isBuiltinField(field) && field.meta.subType == subType;
    }
    return table?.fields?.filter(item => judger(item)) || [];
  }

  async getTOC(appId: string, tableId: TableUID) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, appId);
    return nocodeBody.views[tableId];
  }

  async checkUniqueValue(nocodeId: string, tableId: TableUID, uniqueChecks: KeyValue[], uuid: KeyValue) {
    const res = await this.formDataService.checkUniqueValue(nocodeId, tableId, uniqueChecks, uuid);
    return res;
  }

  // 富文本编辑器上传资源
  async uploadResource(file, fileMessage) {
    let filename = fileMessage.filename;
    const nocodeId = fileMessage.nocodeId;
    const destDir = path.join(this.uploadsDir, nocodeId);

    const ext = path.extname(filename);
    const basename = path.basename(filename, ext);
    filename = `${basename}_${Date.now()}${ext}`;

    // 文件夹不存在即创建文件夹
    try {
      await mkdir(destDir, { recursive: true });
    } catch (error) {
      //ignored
    }
    //写入文件
    try {
      const filePath = path.join(destDir, filename);
      await writeFile(filePath, file.buffer);
      return { url: `uploads/${nocodeId}/${filename}` };
    } catch (error) {
      console.error(error);
      return { url: null };
    }
  }

  async uploadFile(file, fileMessage) {
    try {
      const session = await this.createImportSession(file, fileMessage);
      const persistedOriginFilePath = await this.persistImportSourceFile({
        sourcePath: session.sourcePath,
        originalName: String(fileMessage?.filename || file?.originalname || "").trim(),
        nocodeId: String(fileMessage?.nocodeId || "").trim(),
      }).catch((error) => {
        this.logger.error(`Persist import source file failed: ${error?.message || error}`);
        return session.sourcePath;
      });

      return {
        success: true,
        data: {
          filename: path.basename(session.excelPath),
          fullPath: session.excelPath.replace(/\\/g, "/"),
          sessionId: session.sessionId,
          sourceType: session.sourceType,
          originFilePath: persistedOriginFilePath.replace(/\\/g, "/"),
        }
      };
    } catch (error) {
      console.error(error);
      if (file?.path) {
        await rm(file.path, { force: true }).catch(() => null);
      }
      throw error;
    }
  }

  async createImportSessionFromPath(fullPath: string, fileMessage?: { filename?: string }) {
    const normalizedPath = String(fullPath || "").trim();
    const session = await this.createImportSessionFromSource({
      sourcePath: normalizedPath,
      originalName: String(fileMessage?.filename || path.basename(normalizedPath) || "").trim(),
      moveSourceFile: false,
    });

    return {
      success: true,
      data: {
        filename: path.basename(session.excelPath),
        fullPath: session.excelPath.replace(/\\/g, "/"),
        sessionId: session.sessionId,
        sourceType: session.sourceType,
        originFilePath: normalizedPath.replace(/\\/g, "/"),
      }
    };
  }

  async createImportSessionFromTrustedSource(fullPath: string, fileMessage?: { filename?: string }) {
    return await this.createImportSessionFromPath(fullPath, fileMessage);
  }

  async readExcelFile(fullPath, maxRows?, sessionId?: string) {
    try {
      const parseData: ExcelFileData = await parseExcelData(fullPath, maxRows);
      return {
        success: true,
        data: { ...parseData, sessionId }
      };
    } catch (error) {
      console.error(`${global.i18next.t('nocodeService.readExcelFileFail')} ${fullPath}`, error);
      return {
        success: false,
        error: global.i18next.t('nocodeService.readExcelFileFail') + error.message
      };
    }
  }

  async collectColumnData(
    extraData,
    length: number,
    titleRowIndex: number,
  ) {
    const sheetData: SheetData = await this.getSheetData(extraData);

    // const isOnlySubformField = Object.keys(mapping).every(col => subformMappings[col]);
    let titleRowHeight = Math.max(...(sheetData.mergeData[titleRowIndex]?.map(item => item?.rowspan ?? 1) ?? [1]));
    const data = []
    for(let colIndex = 0; colIndex < length; colIndex++) {
      const resultSet = new Set<string>();
      for (let rowIndex = titleRowIndex + titleRowHeight; rowIndex < sheetData.rows.length; rowIndex++) {
        const curRowspanArr: number[] =
          sheetData.mergeData[rowIndex]?.map(item => item?.rowspan ?? 1) ?? [1];

        const minRowspan = Math.min(...curRowspanArr);

        // 跳过子表单行
        if (minRowspan <= 0) continue;

        const cell = sheetData.rows[rowIndex]?.[colIndex];

        if (!cell) continue;

        // 支持  a,b,c 这种多值单元格
        cell
          .toString()
          .split(',')
          .forEach(v => {
            const value = v.trim();
            if (value) {
              resultSet.add(value);
            }
          });
      }
      data.push([...resultSet]);
    }

    return data;
  }

  async getSheetData(extraData: any) {
    const { fileName, sheets, originSheetsData }: ExcelFileData = await parseExcelData(extraData.fullPath);
    const sheetData: SheetData = originSheetsData[extraData.worksheet];
    return sheetData;
  }

  private getImportErrorReportHeaders(sheetData: SheetData, titleRowIndex: number, titleRowHeight: number) {
    const columnCount = sheetData.rows.reduce((max, row) => Math.max(max, row?.length ?? 0), 0);
    return Array.from({ length: columnCount }, (_, colIndex) => {
      const titles: string[] = [];
      for (let rowIndex = titleRowIndex; rowIndex < Math.min(sheetData.rows.length, titleRowIndex + titleRowHeight); rowIndex++) {
        const value = sheetData.rows[rowIndex]?.[colIndex];
        const text = value == null ? '' : String(value).trim();
        if (text && !titles.includes(text)) {
          titles.push(text);
        }
      }
      return titles.join('/') || XLSX.utils.encode_col(colIndex);
    });
  }

  private collectImportErrorRows(sheetData: SheetData, startRowIndex: number, endRowIndex: number, reason: string): ExcelImportErrorItem {
    const rowIndexes: number[] = [];
    const rows: any[][] = [];
    for (let rowIndex = startRowIndex; rowIndex <= endRowIndex && rowIndex < sheetData.rows.length; rowIndex++) {
      rowIndexes.push(rowIndex + 1);
      rows.push(sheetData.rows[rowIndex] ?? []);
    }
    return {
      rowIndexes,
      rows,
      reason,
    };
  }

  private async getImportErrorReportDirs() {
    const dirSet = new Set<string>([path.join(os.tmpdir(), 'static')]);

    try {
      const userDataPath = await getRuntime().getUserDataPath();
      if (userDataPath) {
        dirSet.add(path.join(userDataPath, 'Temp', 'static'));
      }
    } catch (error) {
      // 桌面端和服务端临时目录映射不一致，获取失败时至少保证默认临时目录可用
    }

    return [...dirSet];
  }

  private async createImportErrorReport(table: Table, sheetData: SheetData, titleRowIndex: number, titleRowHeight: number, errors: ExcelImportErrorItem[]) {
    if (isEmpty(errors)) {
      return null;
    }

    const headers = this.getImportErrorReportHeaders(sheetData, titleRowIndex, titleRowHeight);
    const reportRows: any[][] = [
      [
        global.i18next.t('ImportExcelDialog.originalRowNumber'),
        ...headers,
        global.i18next.t('ImportExcelDialog.errorReason'),
      ],
    ];

    errors.forEach(error => {
      error.rows.forEach((row, index) => {
        reportRows.push([
          error.rowIndexes[index],
          ...headers.map((_, colIndex) => row?.[colIndex] ?? ''),
          error.reason,
        ]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(reportRows);
    const workbook = XLSX.utils.book_new();
    const sheetName = global.i18next.t('ImportExcelDialog.errorReportSheetName').slice(0, 31) || 'Errors';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fileName = `${replaceIllegalChars(table?.alias || 'import')}_${global.i18next.t('ImportExcelDialog.errorReportFileSuffix')}_${Date.now()}.xlsx`;
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    const reportDirs = await this.getImportErrorReportDirs();

    for (const dir of reportDirs) {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, fileName), buffer);
    }

    return {
      url: `/tmp/${fileName}`,
      name: fileName,
    };
  }

  async createImportExcelProgressStream(taskId: string, res: Response) {
    if (!taskId) {
      res.status(400).end();
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const clients = this.importExcelProgressStreamClients.get(taskId) || new Set<Response>();
    clients.add(res);
    this.importExcelProgressStreamClients.set(taskId, clients);

    const currentPercent = this.importExcelProgressTasks.get(taskId)?.percent;
    if (typeof currentPercent === 'number') {
      this.writeImportExcelProgressEvent(res, {
        taskId,
        percent: currentPercent,
      });
    }

    res.on('close', () => {
      this.removeImportExcelProgressStreamClient(taskId, res);
    });
  }

  private writeImportExcelProgressEvent(res: Response, payload: ImportExcelProgressEvent) {
    try {
      res.write('event: import-excel-progress\n');
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      this.logger.warn(`write import excel progress stream failed: ${ error instanceof Error ? error.message : String(error) }`);
    }
  }

  private removeImportExcelProgressStreamClient(taskId: string, res: Response) {
    const clients = this.importExcelProgressStreamClients.get(taskId);
    if (!clients) return;
    clients.delete(res);
    if (clients.size === 0) {
      this.importExcelProgressStreamClients.delete(taskId);
    }
  }

  private emitImportExcelPercent(taskId: string | undefined, percent: number) {
    if (!taskId) return;
    const clients = this.importExcelProgressStreamClients.get(taskId);
    if (!clients?.size) return;
    clients.forEach((res) => {
      this.writeImportExcelProgressEvent(res, {
        taskId,
        percent,
      });
    });
  }

  private getImportExcelFlowEstimateBreakdown(
    rowCount: number,
    flowComplexityScore: number,
    flowEstimateProfile: 'default' | 'dataProcessingHeavy' = 'default',
  ) {
    const safeRowCount = Math.max(0, Math.floor(Number(rowCount) || 0));
    const safeFlowComplexityScore = Math.max(0, Number(flowComplexityScore) || 0);
    const minDurationMs = safeRowCount <= 10
      ? NocodeService.IMPORT_EXCEL_FLOW_SHORT_MIN_DURATION_MS
      : safeRowCount <= 100
        ? NocodeService.IMPORT_EXCEL_FLOW_MEDIUM_MIN_DURATION_MS
        : NocodeService.IMPORT_EXCEL_FLOW_LONG_MIN_DURATION_MS;
    const maxDurationMs = flowEstimateProfile === 'dataProcessingHeavy'
      ? NocodeService.IMPORT_EXCEL_FLOW_LARGE_MAX_DURATION_MS
      : safeRowCount <= 100
        ? NocodeService.IMPORT_EXCEL_FLOW_MAX_DURATION_MS
        : NocodeService.IMPORT_EXCEL_FLOW_LARGE_MAX_DURATION_MS;
    const baseStartupMs = flowEstimateProfile === 'dataProcessingHeavy'
      ? NocodeService.IMPORT_EXCEL_FLOW_DATA_PROCESSING_HEAVY_BASE_STARTUP_MS
      : NocodeService.IMPORT_EXCEL_FLOW_DEFAULT_BASE_STARTUP_MS;
    const perRowContributionMs = flowEstimateProfile === 'dataProcessingHeavy'
      ? safeRowCount * NocodeService.IMPORT_EXCEL_FLOW_DATA_PROCESSING_HEAVY_PER_ROW_MS
      : safeRowCount * NocodeService.IMPORT_EXCEL_FLOW_DEFAULT_PER_ROW_MS;
    const complexityContributionMs = flowEstimateProfile === 'dataProcessingHeavy'
      ? safeFlowComplexityScore * NocodeService.IMPORT_EXCEL_FLOW_DATA_PROCESSING_HEAVY_COMPLEXITY_UNIT_MS
      : safeFlowComplexityScore * NocodeService.IMPORT_EXCEL_FLOW_DEFAULT_COMPLEXITY_UNIT_MS;
    const rowComplexityContributionMs = flowEstimateProfile === 'dataProcessingHeavy'
      ? 0
      : safeRowCount * safeFlowComplexityScore * NocodeService.IMPORT_EXCEL_FLOW_DEFAULT_ROW_COMPLEXITY_FACTOR_MS;
    const rawEstimatedDurationMs = baseStartupMs
      + perRowContributionMs
      + complexityContributionMs
      + rowComplexityContributionMs;
    const estimatedDurationMs = Math.min(
      maxDurationMs,
      Math.max(minDurationMs, Math.floor(rawEstimatedDurationMs)),
    );
    const complexityUnitMs = flowEstimateProfile === 'dataProcessingHeavy'
      ? NocodeService.IMPORT_EXCEL_FLOW_DATA_PROCESSING_HEAVY_COMPLEXITY_UNIT_MS
      : NocodeService.IMPORT_EXCEL_FLOW_DEFAULT_COMPLEXITY_UNIT_MS;
    const perRowUnitMs = flowEstimateProfile === 'dataProcessingHeavy'
      ? NocodeService.IMPORT_EXCEL_FLOW_DATA_PROCESSING_HEAVY_PER_ROW_MS
      : NocodeService.IMPORT_EXCEL_FLOW_DEFAULT_PER_ROW_MS;
    const rowComplexityFactorMs = flowEstimateProfile === 'dataProcessingHeavy'
      ? 0
      : NocodeService.IMPORT_EXCEL_FLOW_DEFAULT_ROW_COMPLEXITY_FACTOR_MS;
    const estimatedPerRowMs = safeRowCount > 0
      ? Number((estimatedDurationMs / safeRowCount).toFixed(2))
      : 0;

    return {
      safeRowCount,
      safeFlowComplexityScore,
      baseStartupMs,
      perRowUnitMs,
      perRowContributionMs,
      complexityUnitMs,
      complexityContributionMs: Number(complexityContributionMs.toFixed(2)),
      rowComplexityFactorMs,
      rowComplexityContributionMs: Number(rowComplexityContributionMs.toFixed(2)),
      rawEstimatedDurationMs: Number(rawEstimatedDurationMs.toFixed(2)),
      minDurationMs,
      maxDurationMs,
      estimatedDurationMs,
      estimatedPerRowMs,
    };
  }

  private getEstimatedImportExcelFlowProgressMeta(elapsedMs: number, estimatedDurationMs: number, rowCount: number) {
    const safeElapsedMs = Math.max(0, Math.floor(Number(elapsedMs) || 0));
    const safeEstimatedDurationMs = Math.max(1, Math.floor(Number(estimatedDurationMs) || 0));
    const progressRatio = Math.max(0, safeElapsedMs / safeEstimatedDurationMs);
    const durationBucket = this.getImportExcelFlowDurationBucket(rowCount, safeEstimatedDurationMs);
    // 使用无限半衰逼近，避免预估时长过短时过早耗尽可用进度。
    const rawMappedRatio = 1 - Math.pow(0.5, progressRatio);
    const safeMappedRatio = Math.max(0, Math.min(0.999999, rawMappedRatio));
    const rawPercent = NocodeService.IMPORT_EXCEL_PARSE_MAX_PERCENT
      + safeMappedRatio * (NocodeService.IMPORT_EXCEL_FLOW_MAX_PERCENT - NocodeService.IMPORT_EXCEL_PARSE_MAX_PERCENT);
    // 流程阶段向下截断 1 位小数，避免 89.85 之类的值被显示成 89.9。
    const percent = Math.floor((rawPercent + Number.EPSILON) * 10) / 10;
    return {
      percent,
      progressRatio: Number(progressRatio.toFixed(4)),
      mappedRatio: Number(safeMappedRatio.toFixed(4)),
      durationBucket,
      mappingSegment: 'remaining-space-halving',
      remainingRatio: Number((1 - safeMappedRatio).toFixed(4)),
    };
  }

  private setImportExcelPercent(taskId: string | undefined, percent: number) {
    if (!taskId) return;
    const safePercent = Math.max(0, Math.min(100, Number((Number(percent) || 0).toFixed(1))));
    const task = this.importExcelProgressTasks.get(taskId) || {
      taskId,
      percent: 0,
    };
    const nextPercent = Math.max(task.percent, safePercent);
    if (nextPercent === task.percent && this.importExcelProgressTasks.has(taskId)) return;
    task.percent = nextPercent;
    this.importExcelProgressTasks.set(taskId, task);
    this.emitImportExcelPercent(taskId, nextPercent);
  }

  private clearImportExcelProgressTask(taskId: string | undefined) {
    if (!taskId) return;
    const task = this.importExcelProgressTasks.get(taskId);
    if (task?.heartbeatTimer) clearInterval(task.heartbeatTimer);
    if (task?.flowProgressTimer) clearInterval(task.flowProgressTimer);
    this.importExcelProgressTasks.delete(taskId);
  }

  private startImportExcelHeartbeat(taskId: string | undefined) {
    if (!taskId) return;
    const task = this.importExcelProgressTasks.get(taskId) || {
      taskId,
      percent: 0,
    };
    if (task.heartbeatTimer) clearInterval(task.heartbeatTimer);
    this.setImportExcelPercent(taskId, NocodeService.IMPORT_EXCEL_PARSE_MAX_PERCENT);
    task.heartbeatTimer = setInterval(() => {
      const currentTask = this.importExcelProgressTasks.get(taskId);
      if (!currentTask || currentTask.percent >= NocodeService.IMPORT_EXCEL_FLOW_MAX_PERCENT) return;
      const step = currentTask.percent < 60 ? 3 : 1;
      this.setImportExcelPercent(taskId, Math.min(NocodeService.IMPORT_EXCEL_FLOW_MAX_PERCENT, currentTask.percent + step));
    }, 900);
    this.importExcelProgressTasks.set(taskId, task);
  }

  private collectImportTriggerFlowStats(
    formData: NocodeFormData,
    tableUID: TableUID,
    sources: DataChangeType[] = [DataChangeType.ADD],
  ) {
    const process = formData.formOptions?.[tableUID]?.process;
    const flows = getFlows(process);
    if (!process?.enabled || isEmpty(flows?.[0]?.branches)) return null;

    const branch = flows[0].branches.find(item => (
      item?.flows?.[0]?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
      && sources.some(source => item?.flows?.[0]?.options?.changeType?.includes(source))
      && item.flows.length >= 2
    ));
    if (!branch?.flows?.length) return null;

    const stats = {
      nodeCount: 0,
      approvalCount: 0,
      transactCount: 0,
      notifyCount: 0,
      reportDataCount: 0,
      conditionBranchCount: 0,
      parallelBranchCount: 0,
      maxDepth: 0,
      endNodeCount: 0,
      junctionCount: 0,
      dataProcessingCount: 0,
      branchFlowMaxLength: 0,
      branchFlowTotalLength: 0,
      leafPathMaxLength: 0,
      leafPathTotalLength: 0,
      leafPathCount: 0,
      triggerChainLength: 0,
    };

    const isDataProcessingNode = (type: ProcessNodeType) => {
      return [
        ProcessNodeType.ADD_DATA,
        ProcessNodeType.EDIT_DATA,
        ProcessNodeType.DELETE_DATA,
      ].includes(type);
    };

    const visitFlows = (currentFlows: any[] = [], depth = 1) => {
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      stats.branchFlowMaxLength = Math.max(stats.branchFlowMaxLength, currentFlows.length);
      stats.branchFlowTotalLength += currentFlows.length;
      for (const flow of currentFlows) {
        if (!flow) continue;
        stats.nodeCount += 1;
        if (flow.type === ProcessNodeType.END) stats.endNodeCount += 1;
        if (flow.type === ProcessNodeType.JUNCTION) stats.junctionCount += 1;
        if (isDataProcessingNode(flow.type)) stats.dataProcessingCount += 1;
        if (flow.type === ProcessNodeType.APPROVAL) {
          stats.approvalCount += 1;
          continue;
        }
        if (flow.type === ProcessNodeType.TRANSACT) {
          stats.transactCount += 1;
          continue;
        }
        if (flow.type === ProcessNodeType.NOTIFY) {
          stats.notifyCount += 1;
          continue;
        }
        if (flow.type === ProcessNodeType.REPORT_DATA) stats.reportDataCount += 1;
        if (flow.type === ProcessNodeType.CONDITION_BRANCH) stats.conditionBranchCount += 1;
        if (flow.type === ProcessNodeType.PARALLEL_BRANCH) stats.parallelBranchCount += 1;
        if (Array.isArray(flow.branches) && flow.branches.length > 0) {
          let heaviestBranchFlows: any[] = [];
          for (const childBranch of flow.branches) {
            const branchFlows = childBranch?.flows || [];
            if (branchFlows.length > heaviestBranchFlows.length) {
              heaviestBranchFlows = branchFlows;
            }
          }
          visitFlows(heaviestBranchFlows, depth + 1);
        }
      }

      if (!currentFlows.some(flow => Array.isArray(flow?.branches) && flow.branches.length > 0)) {
        stats.leafPathCount += 1;
        stats.leafPathTotalLength += currentFlows.length;
        stats.leafPathMaxLength = Math.max(stats.leafPathMaxLength, currentFlows.length);
      }
    };

    const triggerFlows = branch.flows.slice(1);
    visitFlows(triggerFlows, 1);

    stats.triggerChainLength = (() => {
      let length = 0;
      for (const flow of triggerFlows) {
        if (!flow) continue;
        if ([
          ProcessNodeType.APPROVAL,
          ProcessNodeType.TRANSACT,
          ProcessNodeType.CONDITION_BRANCH,
          ProcessNodeType.PARALLEL_BRANCH,
          ProcessNodeType.END,
        ].includes(flow.type)) {
          break;
        }
        length += 1;
      }
      return length;
    })();

    const complexityScore = stats.nodeCount * 0.6
      + stats.approvalCount * 1.5
      + stats.transactCount * 1.2
      + stats.notifyCount * 0.2
      + stats.reportDataCount * 1.5
      + stats.conditionBranchCount * 0.8
      + stats.parallelBranchCount * 1
      + stats.maxDepth * 0.5;

    return {
      ...stats,
      leafPathAvgLength: stats.leafPathCount > 0
        ? Number((stats.leafPathTotalLength / stats.leafPathCount).toFixed(2))
        : 0,
      complexityScore,
    };
  }

  private getImportExcelFlowEstimateProfile(flowStats?: {
    approvalCount?: number;
    dataProcessingCount?: number;
    conditionBranchCount?: number;
  }) {
    const isDataProcessingHeavyFlow = !!flowStats
      && flowStats.approvalCount === 0
      && (flowStats.dataProcessingCount || 0) >= 3
      && (flowStats.conditionBranchCount || 0) >= 1;

    return isDataProcessingHeavyFlow ? 'dataProcessingHeavy' : 'default';
  }

  private getImportExcelFlowEstimatedDurationMs(
    rowCount: number,
    flowComplexityScore: number,
    flowEstimateProfile: 'default' | 'dataProcessingHeavy' = 'default',
  ) {
    return this.getImportExcelFlowEstimateBreakdown(
      rowCount,
      flowComplexityScore,
      flowEstimateProfile,
    ).estimatedDurationMs;
  }

  private getImportExcelFlowDurationBucket(rowCount: number, estimatedDurationMs: number) {
    const safeRowCount = Math.max(0, Math.floor(Number(rowCount) || 0));
    const safeEstimatedDurationMs = Math.max(1, Math.floor(Number(estimatedDurationMs) || 0));
    if (safeRowCount <= 8 && safeEstimatedDurationMs <= 15000) return 'short';
    if (safeRowCount <= 80 && safeEstimatedDurationMs <= 90000) return 'medium';
    return 'long';
  }

  private getEstimatedImportExcelFlowPercent(elapsedMs: number, estimatedDurationMs: number, rowCount: number) {
    return this.getEstimatedImportExcelFlowProgressMeta(
      elapsedMs,
      estimatedDurationMs,
      rowCount,
    ).percent;
  }

  private startImportExcelTodoObserver(
    taskId: string | undefined,
    formData: NocodeFormData,
    tableUID: TableUID,
    sources: DataChangeType[] = [DataChangeType.ADD],
  ) {
    if (!taskId) return;
    const task = this.importExcelProgressTasks.get(taskId) || {
      taskId,
      percent: 0,
    };
    if (task.flowProgressTimer) clearInterval(task.flowProgressTimer);
    this.setImportExcelPercent(taskId, NocodeService.IMPORT_EXCEL_PARSE_MAX_PERCENT);

    const rowCount = Math.max(0, Math.floor(Number(task.successImportCount) || 0));
    if (rowCount <= 0) {
      this.importExcelProgressTasks.set(taskId, task);
      return;
    }

    const flowStats = this.collectImportTriggerFlowStats(formData, tableUID, sources);
    task.flowComplexityScore = flowStats?.complexityScore || 0;
    task.flowEstimateProfile = this.getImportExcelFlowEstimateProfile(flowStats);
    const estimateBreakdown = this.getImportExcelFlowEstimateBreakdown(
      rowCount,
      task.flowComplexityScore,
      task.flowEstimateProfile,
    );
    task.estimatedDurationMs = estimateBreakdown.estimatedDurationMs;
    task.startedAt = Date.now();

    const pushEstimatedProgress = () => {
      const currentTask = this.importExcelProgressTasks.get(taskId);
      if (!currentTask || !currentTask.startedAt || !currentTask.estimatedDurationMs) return;
      if (currentTask.percent >= NocodeService.IMPORT_EXCEL_FLOW_MAX_PERCENT) return;
      const elapsedMs = Date.now() - currentTask.startedAt;
      const progressMeta = this.getEstimatedImportExcelFlowProgressMeta(elapsedMs, currentTask.estimatedDurationMs, rowCount);
      const percent = progressMeta.percent;
      this.setImportExcelPercent(taskId, Math.min(NocodeService.IMPORT_EXCEL_FLOW_MAX_PERCENT, percent));
    };

    task.flowProgressTimer = setInterval(() => {
      pushEstimatedProgress();
    }, NocodeService.IMPORT_EXCEL_FLOW_TICK_MS);
    this.importExcelProgressTasks.set(taskId, task);
    pushEstimatedProgress();
  }

  private emitImportExcelProgress(taskId: string | undefined, current: number, total: number) {
    const safeTotal = Math.max(0, Math.floor(Number(total) || 0));
    const safeCurrent = Math.max(0, Math.floor(Number(current) || 0));
    const percent = safeTotal <= 0
      ? 0
      : Number(Math.min(
        NocodeService.IMPORT_EXCEL_PARSE_MAX_PERCENT,
        5 + (safeCurrent / safeTotal) * 15,
      ).toFixed(1));
    this.setImportExcelPercent(taskId, percent);
  }

  private shouldTriggerImportTodo(
    formData: NocodeFormData,
    tableUID: TableUID,
    runtime: FormTableRuntime,
    source: DataChangeType = DataChangeType.ADD,
  ) {
    if (runtime === FormTableRuntime.FORM_EDITOR) return false;
    const process = formData.formOptions?.[tableUID]?.process;
    const flows = getFlows(process);
    if (!process?.enabled || isEmpty(flows?.[0]?.branches)) return false;

    return flows[0].branches.some(branch => (
      branch?.flows?.[0]?.type === ProcessNodeType.TRIGGER_DATA_CHANGE
      && branch.flows[0]?.options?.changeType?.includes(source)
      && branch.flows.length >= 2
    ));
  }

  private saveImportExcelProgressTask(taskId: string | undefined, successImportCount: number) {
    if (!taskId) return;
    this.importExcelProgressTasks.set(taskId, {
      ...(this.importExcelProgressTasks.get(taskId) || { taskId, percent: 0 }),
      taskId,
      percent: this.importExcelProgressTasks.get(taskId)?.percent || 0,
      successImportCount,
    });
  }

  private async startImportPostMutationTasks(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    batches: ImportPostMutationBatch[],
    importTaskId: string | undefined,
    runtimeAccount?: Account,
  ) {
    const runnableBatches = batches.filter(batch => batch.rows.length);
    if (!runnableBatches.length) return;
    const request = RequestStorage.current?.req;
    const tasks = await Promise.all(runnableBatches.map(async batch => {
      const enqueue = () => this.viewActionTriggerTaskService.enqueueImportPostMutation({
        formData,
        nocodeId,
        tableUID,
        rows: batch.rows,
        source: batch.source,
        beforeMutationRows: batch.beforeMutationRows,
        importTaskId,
        preparedTaskId: batch.preparedTaskId,
        requestDigest: batch.requestDigest,
        eventId: batch.eventId,
        runtimeAccount,
        queueState: batch.queueState,
        request,
      });
      return request
        ? await new Promise<Awaited<ReturnType<typeof enqueue>>>((resolve, reject) => {
          RequestStorage.runWithRequest(request, () => void enqueue().then(resolve, reject));
        })
        : await enqueue();
    }));
    const acceptedTasks = tasks.filter(Boolean);
    if (!acceptedTasks.length || !importTaskId) {
      this.setImportExcelPercent(importTaskId, 100);
      this.clearImportExcelProgressTask(importTaskId);
      return;
    }
    // Persisting the batch is part of accepting the import. Only completion
    // observation runs in the background; an enqueue failure must reach the
    // import request instead of being logged as a successful 100% import.
    void (async () => {
      try {
        await Promise.all(acceptedTasks.map(async task => {
          const batchId = (task as { batchId?: string }).batchId;
          if (batchId) {
            await this.waitForImportPostMutationBatch(batchId);
            return;
          }
          // Compatibility for a task created before import batches existed.
          await this.waitForImportPostMutationTask(task.taskId);
        }));
        this.setImportExcelPercent(importTaskId, 100);
        this.clearImportExcelProgressTask(importTaskId);
      } catch (error) {
        this.logger.error(`observe import excel post mutation task failed: ${error instanceof Error ? error.message : String(error)}`);
        this.setImportExcelPercent(importTaskId, 100);
        this.clearImportExcelProgressTask(importTaskId);
      }
    })();
  }

  private async prepareImportPostMutationIntent(
    formData: NocodeFormData,
    nocodeId: string,
    tableUID: TableUID,
    rows: Row[],
    source: DataChangeType.ADD | DataChangeType.EDIT,
    beforeMutationRows: Row[] | undefined,
    importTaskId: string | undefined,
  ) {
    const eventId = importTaskId ? `import:${importTaskId}:${source}` : undefined;
    return await this.viewActionTriggerTaskService.prepareImportPostMutationIntent({
      formData,
      nocodeId,
      tableUID,
      rows,
      source,
      beforeMutationRows,
      importTaskId,
      eventId,
      runtimeAccount: await this.formDataService.getAccount(),
      request: RequestStorage.current?.req,
    });
  }

  private shouldSkipReplayedImportMutation(intent: { replayed?: boolean; status?: string } | null) {
    if (!intent?.replayed) return false;
    if (["queued", "running", "completed"].includes(intent.status || "")) return true;
    throw new Error(`Import event is already ${intent.status || "being recovered"} and cannot be replayed automatically`);
  }

  private async waitForImportPostMutationBatch(batchId: string) {
    for (;;) {
      const batch = await this.viewActionTriggerTaskService.getBatchStatus(batchId);
      if (!batch || ["completed", "failed", "unknown"].includes(batch.status)) {
        return;
      }
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 1000);
        (timer as unknown as { unref?: () => void }).unref?.();
      });
    }
  }

  private async waitForImportPostMutationTask(taskId: string) {
    for (;;) {
      const task = await this.viewActionTriggerTaskService.getTaskStatus(taskId);
      if (!task || ["completed", "failed", "blocked", "stale", "unknown"].includes(task.status)) {
        return;
      }
      await new Promise<void>(resolve => {
        const timer = setTimeout(resolve, 1000);
        (timer as unknown as { unref?: () => void }).unref?.();
      });
    }
  }

  private async resolveOverwriteImportRows(
    nocodeId: string,
    tableUID: TableUID,
    identifierFieldUid: string,
    uuidFieldUid: string,
    rowGroup: Record<string, Row[]>,
  ) {
    const identifierKeys = Object.keys(rowGroup);
    const existingRowsByIdentifier = new Map<string, Row[]>();
    for (let offset = 0; offset < identifierKeys.length; offset += 500) {
      const [bucket] = await this.formDataService.getData(nocodeId, [tableUID], {
        filters: {
          [tableUID]: [{
            [identifierFieldUid]: { $in: identifierKeys.slice(offset, offset + 500) },
          }],
        },
      });
      for (const existingRow of bucket?.rows || []) {
        const key = String(existingRow?.[identifierFieldUid]);
        const groupedRows = existingRowsByIdentifier.get(key) || [];
        groupedRows.push(existingRow);
        existingRowsByIdentifier.set(key, groupedRows);
      }
    }

    const addIdentifiers = new Set<string>();
    const rowsToUpdate: Row[] = [];
    for (const key of identifierKeys) {
      const importRows = rowGroup[key];
      const existingRows = existingRowsByIdentifier.get(key) || [];
      if (!existingRows.length) {
        addIdentifiers.add(key);
        continue;
      }
      rowsToUpdate.push(...existingRows.map(existingRow => ({
        ...deepClone(importRows[importRows.length - 1]),
        [uuidFieldUid]: existingRow[uuidFieldUid],
      })));
    }
    return { addIdentifiers, rowsToUpdate };
  }

  async importExcelData(nocodeId: string, tableUID: TableUID, runtime: FormTableRuntime, extraData: any, mapping: ExcelFormColMap, subformMappings: ExcelSubformColMaps, titleRowIndex: number) {
    const importTaskId = extraData?.importTaskId;
    let postMutationInBackground = false;

    try {
      const importMode = extraData?.importMode || 'addData';
      if (importTaskId) {
        this.importExcelProgressTasks.set(importTaskId, {
          ...(this.importExcelProgressTasks.get(importTaskId) || { taskId: importTaskId, percent: 0 }),
          taskId: importTaskId,
          percent: this.importExcelProgressTasks.get(importTaskId)?.percent || 0,
          importMode,
        });
      }
      const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
      const formData: NocodeFormData = nocodeBody.formData;
      const table: Table = formData.tables.find(table => table.uid === tableUID);
      
      const sheetData: SheetData = await this.getSheetData(extraData);
    // 标题行有纵向的单元格合并时，会占用多行，例如存在子表单列；标题行中只有子表单列的情况，需要主动加上子表单标题行的行高；
    const isOnlySubformField = Object.keys(mapping).every(col => subformMappings[col]);
    let titleRowHeight = Math.max(...(sheetData.mergeData[titleRowIndex]?.map(item => item?.rowspan ?? 1) ?? [1]));
    if (isOnlySubformField) {
      titleRowHeight += Math.max(...(sheetData.mergeData[titleRowIndex + titleRowHeight]?.map(item => item?.rowspan ?? 1) ?? [1]));
    }

    let rows: Row[] = [], totalCount = 0, updatedCount = 0, addedCount = 0;
    const importErrors: ExcelImportErrorItem[] = [];
    if (!sheetData.isSheetNull) {
      const userList = (await this.workbenchService.getUserList()).filter(user => !user.resigned);
      const departmentList = await this.workbenchService.getDepartmentList();
      const relatedDataImportMap: Record<string, Set<string>> = {};
      const serialNumberOfNotImp = table.fields.filter(field => {
        return field.meta?.extra?.widgetType === "widget.form.serialNumber" 
          && !Object.values(mapping).includes(field.uid)
      })
      const runtimeState = serialNumberOfNotImp.length
        ? await getNocodeRuntimeState(this.nocodesDir, nocodeId)
        : null;

      const relatedFieldEntries = Object.entries(mapping)
        .map(([col, uid]) => ({
          col,
          field: table.fields.find(field => field.uid === uid),
        }))
        .filter(item => item.field?.meta?.extra?.widgetType === "widget.form.relatedData");

      if (relatedFieldEntries.length > 0) {
        const relatedValueMap: Record<string, Set<string>> = {};

        for (let rowIndex = titleRowIndex + titleRowHeight; rowIndex < sheetData.rows.length; rowIndex++) {
          const row = sheetData.rows[rowIndex];
          const curRowspanArr: number[] = sheetData.mergeData[rowIndex]?.map(item => item?.rowspan ?? 1) ?? [1];
          const minRowspan = Math.min(...curRowspanArr);
          if (minRowspan <= 0) continue;

          relatedFieldEntries.forEach(({ col, field }) => {
            const relatedTableUID = field?.meta?.extra?.relatedTableUID?.[1];
            if (!relatedTableUID) return;

            const colIndex = Number(col.replace('col-', ''));
            const cell = row?.[colIndex];
            if (cell == null || String(cell).trim() === '') return;

            if (!relatedValueMap[relatedTableUID]) {
              relatedValueMap[relatedTableUID] = new Set<string>();
            }

            parseRelatedDataIds(cell)
              .forEach(item => {
                relatedValueMap[relatedTableUID].add(item);
              });
          });
        }

        for (const [relatedTableUID, uuidSet] of Object.entries(relatedValueMap)) {
          const relatedTable = formData.tables.find(item => item.uid === relatedTableUID);
          const uuidField = getUUIDSystemField(relatedTable?.fields || []);
          if (!relatedTable || !uuidField || uuidSet.size === 0) {
            relatedDataImportMap[relatedTableUID] = new Set<string>();
            continue;
          }

          const result = await this.formDataService.distinct(
            nocodeId,
            relatedTableUID as TableUID,
            uuidField.uid,
            {
              filters: {
                [relatedTableUID]: [
                  {
                    [uuidField.uid]: {
                      '$in': [...uuidSet]
                    }
                  }
                ]
              }
            }
          );

          relatedDataImportMap[relatedTableUID] = new Set<string>((result || []).filter(Boolean));
        }
      }

      const importableRows: Array<{ rowIndex: number, rowSpan: number }> = [];

      for (let rowIndex = titleRowIndex + titleRowHeight; rowIndex < sheetData.rows.length; rowIndex++) {
        const curRowspanArr: number[] = sheetData.mergeData[rowIndex]?.map(item => item?.rowspan ?? 1) ?? [1];
        const minRowspan = Math.min(...curRowspanArr);
        if (minRowspan <= 0) continue;

        importableRows.push({
          rowIndex,
          rowSpan: Math.max(...curRowspanArr),
        });
      }

      totalCount = importableRows.length;
      let processedCount = 0;
      this.emitImportExcelProgress(importTaskId, processedCount, totalCount);

      rowLoop:
      for (let rowIndex = titleRowIndex + titleRowHeight; rowIndex < sheetData.rows.length; rowIndex++) {
        const row = sheetData.rows[rowIndex];
        const newRow: Row = {};
        const curRowspanArr: number[] = sheetData.mergeData[rowIndex]?.map(item => item?.rowspan ?? 1) ?? [1];
        let minRowspan = Math.min(...curRowspanArr);
        if (minRowspan <= 0) continue rowLoop; // 当前行存在被纵向合并单元格，则识别为子表单行，跳过处理
        const rowSpan = Math.max(...curRowspanArr);
        let isRowProcessed = false;
        const markRowProcessed = () => {
          if (isRowProcessed) return;
          isRowProcessed = true;
          processedCount++;
          this.emitImportExcelProgress(importTaskId, processedCount, totalCount);
        };
        const collectImportError = (reason: string) => {
          importErrors.push(this.collectImportErrorRows(sheetData, rowIndex, rowIndex + rowSpan - 1, reason));
        };

        // 先解析整行字段值，再基于整行上下文校验条件必填
        const fieldDataMap = new Map<string, any>();
        const fieldMetaMap = new Map<string, { field: Field, cellLocation: ExcelLocation, rawData: any }>();
        for (const [col, uid] of Object.entries(mapping)) {
          const colIndex = Number(col.replace('col-', ''));
          const field: Field = table.fields.find(field => field.uid === uid);
          const cellLocation: ExcelLocation = { c: colIndex, r: rowIndex };
          fieldMetaMap.set(uid, { field, cellLocation, rawData: row[colIndex] });
          const processRes = await processCellData(
            row[colIndex],
            cellLocation,
            field,
            sheetData,
            titleRowIndex,
            nocodeBody,
            subformMappings,
            userList,
            departmentList,
            relatedDataImportMap,
            Object.fromEntries(fieldDataMap),
            undefined,
            true,
          );
          if (!processRes.valid) {
            collectImportError(processRes.reason || global.i18next.t('ImportExcelDialog.invalidFieldData', { field: field?.alias || field?.meta?.name || '-' }));
            markRowProcessed();
            continue rowLoop;
          }
          newRow[uid] = processRes.data;
          if (field?.uid) {
            fieldDataMap.set(field.uid, processRes.data);
          }
          if (field?.meta?.uid) {
            fieldDataMap.set(field.meta.uid, processRes.data);
          }
        }

        for (const [uid, { field, cellLocation, rawData }] of fieldMetaMap.entries()) {
          const processRes = await processCellData(
            rawData,
            cellLocation,
            field,
            sheetData,
            titleRowIndex,
            nocodeBody,
            subformMappings,
            userList,
            departmentList,
            relatedDataImportMap,
            Object.fromEntries(fieldDataMap),
            undefined,
          );
          if (!processRes.valid) {
            collectImportError(processRes.reason || global.i18next.t('ImportExcelDialog.invalidFieldData', { field: field?.alias || field?.meta?.name || '-' }));
            markRowProcessed();
            continue rowLoop;
          }
          newRow[uid] = processRes.data;
        }

        try {
          await this.normalizeImportRowUploadFields(nocodeId, formData, table, newRow, extraData);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          collectImportError(errorMessage || global.i18next.t('ImportExcelDialog.invalidFieldData', { field: '-' }));
          continue rowLoop;
        }

        serialNumberOfNotImp.forEach(field => {
          const runtimeCounter = getRuntimeCounter(runtimeState, table.meta.uid, field.uid) || {};
          newRow[field.uid] = countSerialNumber(nocodeBody.formData, table.meta.uid, newRow, field.uid, {
            users: userList,
            departments: departmentList,
          }, runtimeCounter);
          setRuntimeCounter(runtimeState, table.meta.uid, field.uid, runtimeCounter);
        })

        // 验证自动编号字段是否符合规则
        for (const [col, uid] of Object.entries(mapping)) {
          const colIndex = Number(col.replace('col-', ''));
          const field: Field = table.fields.find(field => field.uid === uid);
          // 检查是否为自动编号字段
          if (field.meta?.extra?.widgetType === "widget.form.serialNumber") {
            const excelData = row[colIndex];
            const isValid = await validateSerialNumber(
              excelData, 
              field, 
              Object.fromEntries(fieldDataMap),
            );
            
            if (isValid) {
              // 如果自动编号符合规则，则将字段数据放入newRow中
              newRow[uid] = fieldDataMap.get(uid);
            } else {
              // 如果自动编号不符合规则，则跳过整行
              collectImportError(global.i18next.t('ImportExcelDialog.invalidSerialNumber', { field: field?.alias || field?.meta?.name || '-' }));
              markRowProcessed();
              continue rowLoop;
            }
          }
        }

        rows.push(newRow);
        markRowProcessed();
      }

      if (serialNumberOfNotImp.length) await saveNocodeRuntimeState(this.nocodesDir, nocodeId, runtimeState); // 保存自动编号计数

      // 只有当fillDefaultValue为true时才处理默认值和公式字段
      if (extraData.fillDefaultValue) { 
        const formulaFields = []
        const defaultFields = []
        const isUseField = Object.keys(mapping).map(col => mapping[col]);

        for(const col of Object.keys(subformMappings)) {
          for(const subCol of Object.keys(subformMappings[col])) {
            const subFormCol = subformMappings[col][subCol];
            isUseField.push(subFormCol);
          }
        }
        
        for(const f of table.fields) {
          if(f.meta?.extra?.widgetType === "widget.form.subform") {
            const subFormTable = formData.tables.find(t => t.uid === f.meta?.extra?.subTableUID?.[f.meta?.extra?.subTableUID?.length - 1]);
            for(const subField of subFormTable.fields) {
              if(isUseField.find(t => t === subField.uid)) continue
              const extra = subField.meta?.extra
              if((extra?.defaultValueType == 'custom' || extra?.linkType == 'form') && hasConfiguredValue(extra?.defaultValue)) {
                defaultFields.push({...subField, uid: `${f.uid}.${subField.uid}`});
              }

              if(extra?.defaultValueType == 'formula' && !isEmpty(getFormulaStr(extra?.formula))) {
                formulaFields.push({...subField, uid: `${f.uid}.${subField.uid}`});
              }
            }
            continue
          }

          if(isUseField.find(t => t === f.uid)) continue
          const extra = f.meta?.extra
          if((extra?.defaultValueType == 'custom' || extra?.linkType == 'form') && hasConfiguredValue(extra?.defaultValue)) {
            defaultFields.push(f);
          }
          if(extra?.defaultValueType == 'formula' && !isEmpty(getFormulaStr(extra?.formula))) {
            formulaFields.push(f);
          }
        }

        try {
          rowsDefaultValueCalculation(rows, {formulaFields, defaultFields}, table, formData);
        } catch (err) {
          this.logger.error(`edit data formula calculation error:`, err);
        }
      }

      rows.forEach(row => convertMarkdownEditorRowValues(row, table, formData));

      if (!extraData.importMode || extraData.importMode === 'addData') {
        const shouldTriggerImportFlow = this.shouldTriggerImportTodo(formData, tableUID, runtime);
        if (rows.length > 0) {
          if (shouldTriggerImportFlow) {
            this.saveImportExcelProgressTask(importTaskId, rows.length);
            this.startImportExcelTodoObserver(importTaskId, formData, tableUID);
          } else {
            this.startImportExcelHeartbeat(importTaskId);
          }
        }
        const importIntent = shouldTriggerImportFlow && runtime !== FormTableRuntime.FORM_EDITOR && rows.length > 0
          ? await this.prepareImportPostMutationIntent(formData, nocodeId, tableUID, rows, DataChangeType.ADD, undefined, importTaskId)
          : null;
        const replayedImport = this.shouldSkipReplayedImportMutation(importIntent);
        let addResult: any;
        if (replayedImport) {
          addResult = { data: rows };
        } else {
          try {
            addResult = await this.formDataService.addData(formData, nocodeId, tableUID, rows, {
              triggerTodo: runtime !== FormTableRuntime.FORM_EDITOR,
              importTaskId,
              deferPostMutation: Boolean(importIntent),
            });
          } catch (error) {
            if (importIntent?.taskId) await this.viewActionTriggerTaskService.failImportPostMutationIntent(importIntent.taskId, error);
            throw error;
          }
        }
        if (shouldTriggerImportFlow && runtime !== FormTableRuntime.FORM_EDITOR && rows.length > 0) {
          postMutationInBackground = true;
          await this.startImportPostMutationTasks(
            formData,
            nocodeId,
            tableUID,
            [{
              rows: Array.isArray(addResult?.data) ? addResult.data : rows,
              source: DataChangeType.ADD,
              preparedTaskId: importIntent?.taskId,
              requestDigest: importIntent?.requestDigest,
              eventId: importIntent?.eventId,
            }],
            importTaskId,
            await this.formDataService.getAccount(),
          );
        }
      } else if (extraData.importMode === 'overWrite') {
        const rowsToAdd: Row[] = []
        const postMutationBatches: ImportPostMutationBatch[] = [];
        const rowGroup: Record<string, Row[]> = {}
        const identifierFieldUid = mapping[extraData.identifierField];
        const uuidField = getUUIDSystemField(table.fields);
        // 循环遍历rows，将唯一标识字段值相同的数据合并到一个数组中，以唯一标识字段值为key，放在rowGroup中
        for (const row of rows) {
          const key = row[identifierFieldUid];
          if (!rowGroup[key]) {
            rowGroup[key] = [];
          }
          rowGroup[key].push(row);
        }
        // Resolve overwrite identifiers in bounded set queries. The previous
        // per-identifier distinct() call produced up to 10,000 SQL queries for
        // a 10,000-row import.
        const { addIdentifiers, rowsToUpdate } = await this.resolveOverwriteImportRows(
          nocodeId,
          tableUID,
          identifierFieldUid,
          uuidField.uid,
          rowGroup,
        );
        // 覆盖导入的已有数据一次性更新，避免每行触发完整更新链路导致数据表逐条刷新。
          if (rowsToUpdate.length > 0) {
          const shouldTriggerEditImportFlow = runtime !== FormTableRuntime.FORM_EDITOR
            && this.shouldTriggerImportTodo(formData, tableUID, runtime, DataChangeType.EDIT);
          const beforeMutationRows: Row[] = [];
          if (shouldTriggerEditImportFlow) {
            for (let offset = 0; offset < rowsToUpdate.length; offset += 500) {
              const [beforeUpdateBucket] = await this.formDataService.getData(nocodeId, [tableUID], {
                filters: {
                  [tableUID]: [{
                    [uuidField.uid]: { $in: rowsToUpdate.slice(offset, offset + 500).map(row => row[uuidField.uid]) },
                  }],
                },
              });
              beforeMutationRows.push(...(beforeUpdateBucket?.rows || []));
            }
          }
          const editIntent = shouldTriggerEditImportFlow
            ? await this.prepareImportPostMutationIntent(formData, nocodeId, tableUID, rowsToUpdate, DataChangeType.EDIT, beforeMutationRows, importTaskId)
            : null;
          const replayedEdit = this.shouldSkipReplayedImportMutation(editIntent);
          let updateResult: any;
          if (replayedEdit) {
            updateResult = { data: rowsToUpdate };
          } else {
            try {
              updateResult = await this.formDataService.updateData(
                formData,
                nocodeId,
                tableUID,
                rowsToUpdate,
                [[formData.uid, tableUID, uuidField.uid]],
              );
            } catch (error) {
              if (editIntent?.taskId) await this.viewActionTriggerTaskService.failImportPostMutationIntent(editIntent.taskId, error);
              throw error;
            }
          }
          updatedCount += rowsToUpdate.length;
          const updatedRows = Array.isArray(updateResult?.data) ? updateResult.data : [];
          if (updatedRows.length > 0 && shouldTriggerEditImportFlow) {
            postMutationBatches.push({
              rows: updatedRows,
              source: DataChangeType.EDIT,
              beforeMutationRows,
              preparedTaskId: editIntent?.taskId,
              requestDigest: editIntent?.requestDigest,
              eventId: editIntent?.eventId,
            });
          }
        }
        // 循环遍历rows，构建rowsToAdd
        for (const row of rows) {
          if (addIdentifiers.has(String(row[identifierFieldUid]))) {
            rowsToAdd.push(row);
          }
        }
        if (rowsToAdd.length > 0) {
          // 添加数据
          const shouldTriggerImportFlow = this.shouldTriggerImportTodo(formData, tableUID, runtime);
          const addIntent = shouldTriggerImportFlow && runtime !== FormTableRuntime.FORM_EDITOR
            ? await this.prepareImportPostMutationIntent(formData, nocodeId, tableUID, rowsToAdd, DataChangeType.ADD, undefined, importTaskId)
            : null;
          const replayedAdd = this.shouldSkipReplayedImportMutation(addIntent);
          let addResult: any;
          if (replayedAdd) {
            addResult = { data: rowsToAdd };
          } else {
            try {
              addResult = await this.formDataService.addData(formData, nocodeId, tableUID, rowsToAdd, {
                triggerTodo: runtime !== FormTableRuntime.FORM_EDITOR,
                importTaskId,
                deferPostMutation: Boolean(addIntent),
              });
            } catch (error) {
              if (addIntent?.taskId) await this.viewActionTriggerTaskService.failImportPostMutationIntent(addIntent.taskId, error);
              throw error;
            }
          }
          if (shouldTriggerImportFlow && runtime !== FormTableRuntime.FORM_EDITOR) {
            postMutationBatches.push({
              rows: Array.isArray(addResult?.data) ? addResult.data : rowsToAdd,
              source: DataChangeType.ADD,
              preparedTaskId: addIntent?.taskId,
              requestDigest: addIntent?.requestDigest,
              eventId: addIntent?.eventId,
            });
          }
          addedCount += rowsToAdd.length;
        }
        if (postMutationBatches.length > 0) {
          postMutationInBackground = true;
          this.saveImportExcelProgressTask(
            importTaskId,
            postMutationBatches.reduce((total, batch) => total + batch.rows.length, 0),
          );
          this.startImportExcelTodoObserver(
            importTaskId,
            formData,
            tableUID,
            postMutationBatches.map(batch => batch.source),
          );
          await this.startImportPostMutationTasks(
            formData,
            nocodeId,
            tableUID,
            postMutationBatches,
            importTaskId,
            await this.formDataService.getAccount(),
          );
        } else if (rowsToUpdate.length > 0 || rowsToAdd.length > 0) {
          this.startImportExcelHeartbeat(importTaskId);
        }
      }
    }

    let errorReport = null;
    if (!isEmpty(importErrors)) {
      try {
        errorReport = await this.createImportErrorReport(table, sheetData, titleRowIndex, titleRowHeight, importErrors);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.stack || error.message : String(error);
        this.logger.warn(`Failed to generate import error report for table ${tableUID}: ${errorMessage}`);
      }
    }

    const result = {
      successImportCount: rows.length,
      total: totalCount,
      updatedCount: updatedCount,
      addedCount: addedCount,
      errorReport,
    };

    if (!postMutationInBackground) {
      this.setImportExcelPercent(importTaskId, 100);
      this.clearImportExcelProgressTask(importTaskId);
    }

    if (extraData?.sessionId) {
      await this.cleanupImportSession(extraData.sessionId);
    }

    return result;
    } catch (error) {
      this.clearImportExcelProgressTask(importTaskId);
      throw error;
    }
  }

  private resolveExportUploadFilePath(fileUrl: unknown) {
    const normalizedUrl = String(fileUrl || "")
      .trim()
      .replace(/\\/g, "/")
      .split(/[?#]/)[0]
      .replace(/^\/+/, "");
    if (!normalizedUrl.startsWith("uploads/")) {
      return null;
    }

    let relativeUploadPath = normalizedUrl.slice("uploads/".length);
    try {
      relativeUploadPath = decodeURIComponent(relativeUploadPath);
    } catch (_error) {
      // Keep the raw path when decoding fails; unsafe paths are rejected below.
    }

    const uploadRootPath = path.resolve(this.uploadsDir);
    const uploadFilePath = path.resolve(uploadRootPath, relativeUploadPath);
    const uploadRelativePath = path.relative(uploadRootPath, uploadFilePath);
    if (!uploadRelativePath || uploadRelativePath.startsWith("..") || path.isAbsolute(uploadRelativePath)) {
      return null;
    }

    return uploadFilePath;
  }

  async exportImageAttachment(selectedColumns, rows, excelData, tableName, tableUID) {
    const baseUrl = path.join(os.tmpdir(), "static")

    // 过滤图片和附件列
    const filteredColumns = selectedColumns.filter(column => 
      column.subType === 'image' || column.subType === 'file'
    );

    // 获取要导出的图片和附件列表
    const filesArray = [];
    rows.forEach(row => {
      filteredColumns.forEach(column => {
        if (column.parentUID) { // 处理子表单情况
          row[column.parentUID].forEach(item => {
            if(item[column.uid] && Array.isArray(item[column.uid]) && item[column.uid].length > 0) {
              item[column.uid].forEach(file => {
                if(file.url){
                  filesArray.push({
                    name: file.name,
                    copyUrl: this.resolveExportUploadFilePath(file.url)
                  });
                }
              });
            }
          });
        }
        if (row[column.uid] && Array.isArray(row[column.uid]) && (row[column.uid].length > 0)) {
          row[column.uid].forEach(file => {
            if (file.url) {
              filesArray.push({
                name: file.name,
                copyUrl: this.resolveExportUploadFilePath(file.url)
              });
            }
          });
        }
      })
    })

    // 将要导出的图片和附件列表保存在本地，并返回给前端
    const excelDownLoadDir = path.join(baseUrl, tableUID);
    const fileDownLoadDir = path.join(excelDownLoadDir, `${tableName}_${global.i18next.t('nocodeService.attachment')}`);
    // 文件夹不存在即创建文件夹
    try {
      await mkdir(fileDownLoadDir, { recursive: true });
    } catch (error) {
      //ignored
    }

    // 保存Excel文件
    try {
      const excelBuffer = Buffer.from(excelData);
      const excelFileName = `${replaceIllegalChars(tableName)}.xlsx`;
      const excelFilePath = path.join(excelDownLoadDir, excelFileName);
      await writeFile(excelFilePath, new Uint8Array(excelBuffer));
      this.logger.log(`${global.i18next.t('nocodeService.excelFileSavedTo')} ${excelFilePath}`);
    } catch (error) {
      this.logger.error(global.i18next.t('nocodeService.saveExcelFileFail'), error.stack);
    }

    // 下载并保存每个文件
    const copyPromises = filesArray.map(async (file) => {
      if (!file.copyUrl) {
        this.logger.warn(`File ${file.name} has no URL to download`);
        return;
      }
      try {
        const filePath = path.join(fileDownLoadDir, file.name);
        // 直接从本地路径拷贝文件
        await cp(file.copyUrl, filePath);
      } catch (error) {
        this.logger.error(`Failed to download file: ${file.name}`, error.stack);
      }
    });

    // 等待所有文件下载完成
    await Promise.all(copyPromises);
    
    // 创建zip文件路径
    let zipFileName = `${tableName}(${global.i18next.t('nocodeService.data')}+${global.i18next.t('nocodeService.attachment')}).zip`;
    let zipFilePath = path.join(baseUrl, zipFileName);
    // 检查文件是否存在，如果存在则添加uid后缀
    if (existsSync(zipFilePath)) {
      zipFileName = `${tableName}(${global.i18next.t('nocodeService.data')}+${global.i18next.t('nocodeService.attachment')})_${unique()}.zip`;
      zipFilePath = path.join(baseUrl, zipFileName);
    }

    await zip(zipFilePath, excelDownLoadDir);
    
    // 删除临时文件夹
    rm(excelDownLoadDir, { recursive: true }).catch(err => {
      this.logger.warn(`Failed to remove temporary directory: ${excelDownLoadDir}`, err.stack);
    });

    // 返回保存文件路径（系统ip地址/tmp/zipFileName）
    return {
      zipFileUrl: `/tmp/${zipFileName}`,
    }
  }
}
