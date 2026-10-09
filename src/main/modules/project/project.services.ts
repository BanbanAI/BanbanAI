import { Injectable, Inject, Logger, OnApplicationBootstrap, forwardRef, INestApplication } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import AsyncLock from "async-lock";
import { PREFERENCES, CLIENT_CONTEXT, USER, REPORTS_DIR, NOCODES_DIR, UPLOADS_DIR, SERVER_ENDPOINT, COMMON_UTIL } from "@main/constants";
import { CommonUtil, Preferences } from "../common";
import { EntityManager, FilterQuery, MikroORM, MikroORMOptions, UseRequestContext } from "@mikro-orm/core";
import { Group as GroupEntity, GroupRepository, Nocode as NocodeEntity, NocodeRepository } from "./entities";
import { getRuntime } from "@main/runtime";
import { existsSync, createWriteStream, createReadStream } from "fs";
import path, { basename, dirname, extname, join } from "path";
import os, { tmpdir } from "os";
import { randomBytes } from "crypto";
import { Connection, Presenter, ProjectBody, RowShareAccessConfig, RowShareAccessPublishConfig, RowShareAccessScope, Visitor, WidgetSoul, BoardSoul, VisitorOrganizeCategory, OrganizeCategory, Table, FormOptions, PublishUpdateMethod, Bucket, PublishCategory, TableUID, Row, SortType, QueryOptions, OptionTableUID, Field, RowShareRecord, FormValidRule, TablePublicQuery, ProcessNodeStatus, FormDataStageWhereCondition, DataChangeType } from "@common/types/project";
import fs, { writeFile, readdir, copyFile, readFile, stat, access, unlink, cp, rename, mkdir, rm } from "fs/promises";
import { zip } from "@main/utils/zip";
import SystemFonts from "font-list";
import { ConnectionUtils } from "./connection.utils";
import { unique } from "@common/utils/unique";
import { deepClone, isEmpty } from "@common/utils/object";
const exists = async (path: string) => { try { await access(path); return true; } catch { return false; } };
import dayjs from "dayjs";
import { createEmptyRuntimeState, extractLegacyRuntimeStateFromNocodeBody, getNocodeBody, getNocodeRuntimeState, getProjectBody, getRuntimeCounter, getDirSize, getEmptyNocodeBody, getEmptyProjectBody, getFormReleaseNocodeBody, getLocalResourceDir, mirrorRuntimeStateToNocodeBody, NocodeFile, normalizeRuntimeState, pickRuntimeStateForNocodeBody, readRuntimeState, removeNocodeRuntimeState, restoreBrokenNocodeBodyFromOldVersions, sanitizeFilenameAdvanced, saveFormReleaseNocodeBody, saveNocodeBody, saveNocodeRuntimeState, saveProjectBody, setRuntimeCounter, stripRuntimeStateFromNocodeBody, validateSynchronization, writeNocodeBody, writeProjectBody, encodePassword } from "@main/utils";
import { buildNocodeImportState, expandNocodeExportTableUIDs, filterNocodeExportBody, FormDataStage, getAllPages, getAllRelatedDepartments, getFlowById, getFlows, getFormElementsInfo, getFormPublicPublishUpdateMethod, getInnerPublishUpdateMethod, normalizeNocodeHomePageSetting, getPublicPublishUpdateMethod, handleCopyName, hasManualPublishScope, isNocodeImportExpired, isNocodeImportReadonly, NOCODE_IMPORT_EXPIRED_ERROR, isSystemField, setNocodeImportReadonly, sortByIDArray } from "@common/utils";
import { findWidgetSoulByUID } from "@common/utils/element";
import { DownloadRest } from "../client";
import { ApplicationPermission, DataPermissionOther, ExportNocodeDataStages, ExportNocodeOptions, FieldAuthValue, FormTableViewMeta, ImportNocodeDataStages, ImportNocodeOptions, ImportNocodeResult, KeyValue, NocodeBody, NocodeCoverSummary, NocodeImportDataFailureItem, NocodeImportDataSummary, NocodeImportOriginalAuthor, NocodeImportState, NocodeMeta, NocodeProjectPublishOptions, NocodeStructure, NocodeStructureType, OtherDataSource, PagePermission, PermissionCategory, PermissionFilterMode, PermissionRangeType, PrintFlowCommentRule, PrintTemplate, PrintTemplateExportNameMode, PrintTemplateMode, PrintTemplateType, PrintedTemplateRecord, ProjectNode, NocodeFormData, FormWidgetType, ViewActionFieldId } from "@common/types/nocode";
import { resolveNocodeCoverSummary } from "@common/utils/nocodeCover";
import { CachedOrganizeDepartment, OrganizeCacheService } from "../workbench/organize-cache.service";
import { ADMIN_USERNAME, Account, NocodeUser, isSystemAdminAccount } from "@common/types/account";
import { Rest } from "../client/rest/base.rest";
import { aes256Decode, aes256Encode } from "@main/utils/crypto";
import { FormDataService } from "../formData/form-data.service";
import { DraftStorageStateService } from "../formData/draft-storage-state.service";
import { AliasType, ApiSetting, ApiTableSetting } from "./types";
import { FormFlowService } from "../formData/form-flow.service";
import { buildPrintFlowCommentTextRows, buildPrintRowShareUrl, buildPrintTemplateBaseName, buildPrintTemplateFileName, buildTableAggregateRuntimeFields, collectPrintCurrentOwnerIds, createPrintFlowCommentField, createPrintRowShareFields, fillPrintProcessSystemFieldValues, fillPrintableTableAggregateFieldValues, getPrintProcessFlow, normalizePrintArrayValue, getPrintRowShareDisabledText, getPrintRowShareUnavailableText, printRowShareInternalUrl, printRowSharePublicUrl, getUUIDSystemField, shouldAppendTimestampForPrintTemplateName, replaceUID, SystemField } from '@common/utils';
import { createWorkbookFromSheets, replaceExcelTemplate } from '@common/utils/print/excel-template';
import { replaceDocxTemplate } from '@common/utils/print/docx-template';
import { WorkbenchService } from '../workbench/workbench.service';
import { UserService } from '../user/user.service';
import { FlowExecutionRecords, FlowExecutionRecordsRepository } from "../formData/entities";
import { ScheduledTriggerRepository } from "../formData/scheduled-trigger/scheduled-trigger.repository";
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import imageSize from 'image-size'
import { Request } from "express";
import { OfficeService } from "../office/office.service";
import { assignFieldsAuth } from "@common/utils/element";
import { ExportBucketChunkFileWriter, ZipOutputEntry, createZipFromEntries } from "./export-nocode.utils";
import { iterateImportBucketsByChunks, replaceNocodeIdInRow, stripNocodeFlowRuntimeFields } from "./import-nocode.utils";
import { getNocodeDataSourceTableByUID } from "@common/utils/connection";
import { attachPrintableRelatedSubFormRows, buildPrintableRelatedSubFormRuntimeFields, getPrintableRelatedSubForms } from "@common/utils/related";
import { applyCopiedNocodeInternalIdMaps, buildCopiedNocodeInternalIdMaps, remapCopiedNocodeInternalIds, remapCopiedPageBodyInternalIds } from "./copy-nocode-internal-id-map";
import type { CopiedNocodeInternalIdMaps } from "./copy-nocode-internal-id-map";
import { ApiException } from "../api/filters";

export const CLIENT_VERSION = 4;
let PORT = 4400;

type SubSerialNumberCounter = {
  count?: number;
  resetTime?: number | null;
  updateTime?: number | null;
}

type SaveSubSerialNumberCounterOptions = {
  tableUID: string;
  fieldId: string;
  counter: SubSerialNumberCounter;
}

type TableExportStat = {
  exportedCount: number;
  totalCount: number;
}

type CrossAppPermissionContext = {
  account?: Partial<Account>;
  departments: string[];
}

type AppendFormFieldChoicePayload = {
  tableUID: TableUID;
  rootTableUID?: TableUID;
  fieldId: string;
  widgetUID: string;
  choice: {
    id?: string;
    label: string;
    value: string;
    color?: string;
  };
  sign?: string;
  targetSign?: string;
};

type AppendFormFieldChoiceTarget = {
  sourceNocodeId: string;
  tableUID: TableUID;
  rootTableUID: TableUID;
  widgetType: string;
};

type AppendFormFieldChoiceResult = {
  nocodeBody: NocodeBody;
  sourceNocodeId: string;
  sign: string;
};

type GetFormFieldChoiceSignResult = {
  sourceNocodeId: string;
  sign: string;
};

type GetNocodeSignResult = {
  nocodeId: string;
  sign: string;
};

type ShareNocodeSummary = {
  meta: NocodeMeta;
  snapshot?: NocodeBody["snapshot"];
  cover?: NocodeCoverSummary;
  isBroken?: boolean;
  importState?: NocodeImportState;
  permissions: {
    editable: boolean;
    deletable: boolean;
    canManageImportExpireAt: boolean;
  };
}

type NocodeImportBucketResult = {
  totalCount: number;
  successCount: number;
  failures: NocodeImportDataFailureItem[];
  successRowUUIDs: string[];
}

type ImportedNocodeDataResult = {
  summary: NocodeImportDataSummary;
  importedRowsByTable: Record<string, Set<string>>;
}

type CopyNocodeMetaSnapshot = {
  parent: string;
  description: string;
  groupId: string | null;
  isPublish: boolean;
  manualChanged: boolean;
  updateMethod?: PublishUpdateMethod;
  innerUpdateMethod?: PublishUpdateMethod;
  publicUpdateMethod?: PublishUpdateMethod;
  importRestriction?: {
    disableEdit?: boolean;
    lockable?: boolean;
    expireAt?: number;
    originalAuthor?: NocodeImportOriginalAuthor;
  } | null;
  apiEnabled: boolean;
  apiAlias: string;
  apiTableInfo: ApiTableSetting[];
}

type CopyNocodeSourceMeta = NocodeMeta & Pick<NocodeEntity, "apiEnabled" | "apiAlias" | "apiTableInfo">;

type InternalZipNocodeOptions = ExportNocodeOptions & {
  preservePermissions?: boolean;
  rewriteCopyInternalIds?: boolean;
  rewriteCopyDataUUID?: boolean;
}

type InternalImportNocodeOptions = Omit<ImportNocodeOptions, "groupId"> & {
  groupId?: string | null;
  preservePermissions?: boolean;
  cleanupOnFailure?: boolean;
  throwOnError?: boolean;
  metaOverrides?: Partial<CopyNocodeMetaSnapshot>;
}

type ExportNocodeDataStageConfig = {
  relativeDir: "data" | "data-recycle" | "data-draft";
  scope: "main" | "draft";
  stage: QueryOptions["stage"];
}

type CopyDataUuidMap = Map<TableUID, Map<string, string>>;
type CopyDataUuidSetMap = Map<TableUID, Set<string>>;

type RewriteCopyRowContext = {
  sourceFormData: NocodeFormData;
  copiedFormData: NocodeFormData;
  idMaps: CopiedNocodeInternalIdMaps;
  uuidMap: CopyDataUuidMap;
  unresolvedLocalUuidMap: CopyDataUuidSetMap;
  currentSourceTableUID: TableUID;
};

const filterSoul = (souls: BoardSoul | WidgetSoul) => {
  if ((souls as WidgetSoul)?.widgets) {
    (souls as WidgetSoul).widgets = (souls as WidgetSoul).widgets.filter(widgetSoul => {
      if (widgetSoul.isSnap) return false;
      filterSoul(widgetSoul);
      return true;
    })
  }
}


@Injectable()
export class ProjectService implements OnApplicationBootstrap {
  private readonly logger = new Logger("ProjectService");
  private readonly rowShareLock = new AsyncLock({ timeout: 60 * 1000 });
  private readonly exportDataChunkSize = 200;
  private readonly importDataChunkSize = 200;

  private getDefaultReadableStageCondition(): QueryOptions['stage'] {
    return {
      $nin: [FormDataStage.DRAFT, FormDataStage.DELETED],
    };
  }

  private getDefaultExportDataStages(exportDataStages?: ExportNocodeDataStages): Required<ExportNocodeDataStages> {
    return {
      submitted: exportDataStages?.submitted !== false,
      recycle: !!exportDataStages?.recycle,
      draft: !!exportDataStages?.draft,
    };
  }

  private getDefaultImportDataStages(importDataStages?: ImportNocodeDataStages): Required<ImportNocodeDataStages> {
    return {
      submitted: importDataStages?.submitted !== false,
      recycle: !!importDataStages?.recycle,
      draft: !!importDataStages?.draft,
    };
  }

  private getCopyImportDataStages(copyData: boolean): Required<ImportNocodeDataStages> {
    if (!copyData) {
      return {
        submitted: false,
        recycle: false,
        draft: false,
      };
    }
    return {
      submitted: true,
      recycle: true,
      draft: true,
    };
  }

  private getCopyExportDataStages(copyData: boolean): Required<ExportNocodeDataStages> {
    if (!copyData) {
      return {
        submitted: false,
        recycle: false,
        draft: false,
      };
    }
    return {
      submitted: true,
      recycle: true,
      draft: true,
    };
  }
  private fonts = [];
  public ossConfig: Record<string, string>;
  private readonly nocodeRepository: NocodeRepository;
  private readonly groupRepository: GroupRepository;
  private readonly flowExecutionRecordsRepository: FlowExecutionRecordsRepository;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly orm: MikroORM, // used by @UseRequestContext()
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    private readonly rest: Rest,
    private readonly entityManager: EntityManager,
    private readonly connectionUtils: ConnectionUtils,
    private readonly downloadRest: DownloadRest,
    private readonly formDataService: FormDataService,
    @Inject(COMMON_UTIL) private readonly commonUtil: CommonUtil,
    @Inject(REPORTS_DIR) private readonly reportsDir: string,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
    @Inject(SERVER_ENDPOINT) private readonly serverHost: string,
    private readonly formFlowService: FormFlowService, 
    private readonly workbenchService: WorkbenchService,
    private readonly organizeCache: OrganizeCacheService,
    private readonly officeService: OfficeService,
    private readonly draftStorageStateService: DraftStorageStateService,
    private readonly scheduledTriggerRepository: ScheduledTriggerRepository,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
  ) {
    this.nocodeRepository = this.entityManager.getRepository(NocodeEntity);
    this.groupRepository = this.entityManager.getRepository(GroupEntity);
    this.flowExecutionRecordsRepository = this.entityManager.getRepository(FlowExecutionRecords);
  }
  @UseRequestContext()
  async onApplicationBootstrap() {
    this.initFonts();
  }

  public async getProjectBody(nocodeId: string, id: string, liveUpdate?: boolean) {
    try {
      const pagesDir = this.commonUtil.getPagesPath(nocodeId);
      return await getProjectBody(pagesDir, id, liveUpdate);
    } catch(err) {
      this.logger.warn("read main.json failed", err);
      throw new Error(`read main.json failed: ${err.message}`);
    }
  }

  private async initFonts() {
    try{
      this.fonts = await SystemFonts.getFonts({ disableQuoting: true });
    }catch(err){
      this.fonts = [];
    }
  }

  public async getFontList() {
    return this.fonts;
  }

  private getPrintSystemField(table: Table, systemField: SystemField) {
    return table?.fields?.find(field => field.meta?.name === systemField);
  }

  private getPrintRowSystemFieldValue(table: Table, row: Row, systemField: SystemField) {
    const field = this.getPrintSystemField(table, systemField);
    if (field?.uid && row?.[field.uid] !== undefined) {
      return row[field.uid];
    }
    return row?.[systemField];
  }

  private setPrintRowSystemFieldValue(table: Table, row: Row, systemField: SystemField, value: unknown) {
    const field = this.getPrintSystemField(table, systemField);
    if (field?.uid) {
      row[field.uid] = value;
    }
    row[systemField] = value;
  }

  private isPrintFlowCommentTextTemplate(template?: Pick<PrintTemplate, "type"> | null) {
    return template?.type === PrintTemplateType.WORD || template?.type === PrintTemplateType.EXCEL;
  }

  private async fillPrintCurrentOwnerSystemField(nocodeId: string, table: Table, formData: NocodeFormData, rows: Row[]) {
    const process = formData.formOptions?.[table.uid]?.process;
    if (!process || !Array.isArray(rows) || rows.length === 0) {
      return rows;
    }

    await Promise.all(rows.map(async row => {
      const status = this.getPrintRowSystemFieldValue(table, row, SystemField.STATUS);
      if (status !== ProcessNodeStatus.IN_PROGRESS) {
        this.setPrintRowSystemFieldValue(table, row, SystemField.CURRENT_NODE, []);
        this.setPrintRowSystemFieldValue(table, row, SystemField.CURRENT_OWNER, []);
        return;
      }

      const nodeIds = normalizePrintArrayValue(this.getPrintRowSystemFieldValue(table, row, SystemField.CURRENT_NODE));
      if (!nodeIds.length) {
        this.setPrintRowSystemFieldValue(table, row, SystemField.CURRENT_OWNER, []);
        return;
      }

      const uuid = this.getPrintRowSystemFieldValue(table, row, SystemField.UUID);
      if (!uuid) {
        this.setPrintRowSystemFieldValue(table, row, SystemField.CURRENT_OWNER, []);
        return;
      }

      const nodeFlows = nodeIds
        .map(flowId => getPrintProcessFlow(process, flowId, row))
        .filter(Boolean);
      if (!nodeFlows.length) {
        this.setPrintRowSystemFieldValue(table, row, SystemField.CURRENT_OWNER, []);
        return;
      }

      const todoId = this.getPrintRowSystemFieldValue(table, row, SystemField.TODO_ID);
      const flowsOperators = await this.formFlowService.getFlowsPaddingOperators({
        nocodeId,
        tableId: table.uid,
        uuid: String(uuid),
        todoId: todoId ? String(todoId) : undefined,
      }, nodeFlows);
      const ownerIds = Array.from(new Set(Object.values(flowsOperators || {}).flatMap(value => normalizePrintArrayValue(value))));
      this.setPrintRowSystemFieldValue(table, row, SystemField.CURRENT_OWNER, ownerIds);
    }));

    return rows;
  }

  private async getPrintOwnerNameMap(rows: Row[], fields: Field[]) {
    const ownerIds = collectPrintCurrentOwnerIds(rows, fields);
    if (!ownerIds.length) return {};

    return Object.fromEntries(await this.organizeCache.resolveUserDisplayNames(ownerIds));
  }

  private async formatPrintProcessSystemFields(nocodeId: string, table: Table, formData: NocodeFormData, rows: Row[]) {
    await this.fillPrintCurrentOwnerSystemField(nocodeId, table, formData, rows);
    const ownerNameMap = await this.getPrintOwnerNameMap(rows, table.fields);
    return fillPrintProcessSystemFieldValues(rows, table.fields, {
      process: formData.formOptions?.[table.uid]?.process,
      ownerNameMap,
    });
  }

  private async fillPrintFlowCommentText(nocodeId: string, table: Table, rows: Row[], rule?: PrintFlowCommentRule) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return rows;
    }

    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField?.uid) {
      return rows;
    }

    const uuids = Array.from(new Set(
      rows
        .map(row => row?.[uuidField.uid])
        .filter(value => value !== undefined && value !== null && String(value).trim() !== "")
        .map(value => String(value)),
    ));
    if (uuids.length === 0) {
      return buildPrintFlowCommentTextRows(rows, [], { rowUuidKey: uuidField.uid, rule });
    }

    const records = await this.flowExecutionRecordsRepository.find({
      nocodeId,
      tableId: table.uid,
      uuid: { $in: uuids },
    } as FilterQuery<FlowExecutionRecords>);

    return buildPrintFlowCommentTextRows(rows, records, { rowUuidKey: uuidField.uid, rule });
  }

  private async getPrintRowShareBaseUrl() {
    try {
      const domainPort = await this.userService.getDomainPort();
      return String(domainPort?.saas?.domain || "").trim().replace(/\/+$/, "");
    } catch (err) {
      this.logger.warn(`Get print row share base url failed: ${err?.message || err}`);
      return "";
    }
  }

  private setPrintRowShareUnavailable(row: Row) {
    const unavailableText = getPrintRowShareUnavailableText();
    row[printRowShareInternalUrl] = unavailableText;
    row[printRowSharePublicUrl] = unavailableText;
  }

  private warnPrintRowShareUnavailable(
    sourceNocodeId: string,
    tableUID: TableUID,
    reason: string,
    rowUUID?: unknown,
  ) {
    this.logger.warn(`Fill print row share link unavailable: sourceNocodeId=${sourceNocodeId}, tableUID=${tableUID}, rowUUID=${rowUUID === undefined ? "" : rowUUID}, reason=${reason}`);
  }

  private fillPrintRowShareDisabled(rows: Row[]) {
    const disabledText = getPrintRowShareDisabledText();
    return rows.map(row => ({
      ...row,
      [printRowShareInternalUrl]: disabledText,
      [printRowSharePublicUrl]: disabledText,
    }));
  }

  private async fillPrintRowShareLinks(sourceNocodeId: string, table: Table, rows: Row[], accountId: string) {
    if (!Array.isArray(rows) || rows.length === 0) {
      return rows;
    }

    if (!table?.publish?.rowShareEnabled) {
      return this.fillPrintRowShareDisabled(rows);
    }

    const uuidField = getUUIDSystemField(table.fields);
    const baseUrl = await this.getPrintRowShareBaseUrl();

    const nextRows: Row[] = [];
    for (const row of rows) {
      const nextRow = { ...row };
      const rowUUID = uuidField?.uid ? nextRow[uuidField.uid] : undefined;
      if (!uuidField?.uid) {
        this.warnPrintRowShareUnavailable(sourceNocodeId, table.uid, "uuid-field-missing", rowUUID);
        this.setPrintRowShareUnavailable(nextRow);
        nextRows.push(nextRow);
        continue;
      }
      if (rowUUID === undefined || rowUUID === null || String(rowUUID).trim() === "") {
        this.warnPrintRowShareUnavailable(sourceNocodeId, table.uid, "row-uuid-empty", rowUUID);
        this.setPrintRowShareUnavailable(nextRow);
        nextRows.push(nextRow);
        continue;
      }
      if (!baseUrl) {
        this.warnPrintRowShareUnavailable(sourceNocodeId, table.uid, "base-url-empty", rowUUID);
        this.setPrintRowShareUnavailable(nextRow);
        nextRows.push(nextRow);
        continue;
      }

      try {
        const rowShare = await this.createOrGetRowShare(sourceNocodeId, table.uid, String(rowUUID), accountId);
        const internalUrl = buildPrintRowShareUrl(baseUrl, rowShare.internalToken || "", "internal");
        const publicUrl = buildPrintRowShareUrl(baseUrl, rowShare.publicToken || rowShare.token || "", "public");
        if (!internalUrl || !publicUrl) {
          this.warnPrintRowShareUnavailable(sourceNocodeId, table.uid, "row-share-url-empty", rowUUID);
          this.setPrintRowShareUnavailable(nextRow);
          nextRows.push(nextRow);
          continue;
        }

        nextRow[printRowShareInternalUrl] = internalUrl;
        nextRow[printRowSharePublicUrl] = publicUrl;
      } catch (err) {
        this.logger.warn(`Fill print row share link failed: nocodeId=${sourceNocodeId}, tableUID=${table.uid}, rowUUID=${rowUUID}, error=${err?.message || err}`);
        this.setPrintRowShareUnavailable(nextRow);
      }
      nextRows.push(nextRow);
    }
    return nextRows;
  }

  async findAllFItFilesInDirectory(dir: string, relativePath: string, fileExts: string[], filePaths: string[]) {
    try {
      const files = await readdir(dir);
      for (const file of files) {
        const filePath = join(dir, file);
        const stats = await stat(filePath);
        if (stats.isDirectory()) {
          await this.findAllFItFilesInDirectory(filePath, `${relativePath}/${file}`, fileExts, filePaths);
        } else if (stats.isFile() && fileExts.indexOf(path.extname(filePath)) !== -1) {
          filePaths.push(`${relativePath}/${file}`);
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${dir}: ${err}`);
    }
  }

  async getAllFitFiles(types: string, folderTypes:string, projectId: string, recursive?: boolean): Promise<Record<string, string[]>> {
    let allTypes: string[] = [];
    let allFolderTypes: string[] = [];
    let sourcePath: string;
    allTypes = types?.split(',') || [];
    allFolderTypes = folderTypes?.split(',') || [];
    sourcePath = 'resources';
    const resourceDir = path.join(this.nocodesDir, projectId, sourcePath);
    if (existsSync(resourceDir)) {
      let allFiles: string[] = [];
      let allFolderFiles: string[] = [];
      const files = await readdir(resourceDir, { withFileTypes: true});

      for (const file of files) {
        if (file.isDirectory()) {
          const items = await readdir(join(resourceDir, file.name), { withFileTypes: true});
          for (const item of items) {
            const fileExt = path.extname(path.join(resourceDir, file.name, item.name))
            if ((allFolderTypes.indexOf(fileExt) !== -1) && item.isFile()) {
              allFolderFiles.push(`${sourcePath}/${file.name}/${item.name}`)
            }
          }
        } else {
          if (!recursive) {
            const fileExt = path.extname(path.join(resourceDir, file.name))
            if ((allTypes.indexOf(fileExt) !== -1) && file.isFile()) {
              allFiles.push(`${sourcePath}/${file.name}`);
            }
          }
        }
      }
      if (recursive) {
        await this.findAllFItFilesInDirectory(resourceDir, sourcePath, allTypes, allFiles);
      }
      return { allFiles, allFolderFiles }
    } else {
      return { allFiles: [], allFolderFiles: [] }
    }
  }

  async saveProjectBody(nocodeId: string, id: string, projectBody: ProjectBody) {
    const pagesDir = this.commonUtil.getPagesPath(nocodeId);
    await saveProjectBody(pagesDir, id, projectBody);
  }

  public async createBlankProject(nocodeId: string, id: string) {
    const projectBody = getEmptyProjectBody();
    await this.saveProjectBody(nocodeId, id, projectBody);
    return { id, projectBody };
  }

  async saveNocodeStructure(nocodeId: string, structure: NocodeStructure[]) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    nocodeBody.structure = structure;
    nocodeBody.settings.homePage = normalizeNocodeHomePageSetting(structure, nocodeBody.settings?.homePage);
    return await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
  }

  async saveSubSerialNumberCounters(nocodeId: string, counters: SaveSubSerialNumberCounterOptions[]) {
    if (isEmpty(counters)) return;

    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData;
    if (!formData) return;
    const runtimeState = await getNocodeRuntimeState(this.nocodesDir, nocodeId);

    for (const item of counters) {
      const table = formData.tables.find(current => current.uid === item.tableUID);
      const field = table?.fields.find(current => current.uid === item.fieldId);
      const tableId = table?.meta?.uid || table?.uid;
      if (!tableId || !field?.meta) continue;

      const currentCounter = getRuntimeCounter(runtimeState, tableId, field.uid) || {};
      const currentUpdateTime = currentCounter.updateTime ?? 0;
      const nextUpdateTime = item.counter?.updateTime ?? 0;
      if (currentUpdateTime > nextUpdateTime) continue;

      setRuntimeCounter(runtimeState, tableId, field.uid, {
        ...currentCounter,
        ...item.counter,
      });
    }

    return await saveNocodeRuntimeState(this.nocodesDir, nocodeId, runtimeState);
  }

  async copyPage(nocodeId: string, sourcePageId: string, copyPageId: string, structure: NocodeStructure[]) {
    const pagesDir = this.commonUtil.getPagesPath(nocodeId);
    const sourcePageDir = path.join(pagesDir, sourcePageId);
    const copyPageDir = path.join(pagesDir, copyPageId);

    // 检查源文件是否存在
    try {
      await access(sourcePageDir);
    } catch (err) {
      // 如果源文件不存在，则直接返回
      return
    }
    // 复制整个源文件
    await cp(sourcePageDir, copyPageDir, { recursive: true });
    // 读取复制后的项目内容
    const projectBody = await getProjectBody(pagesDir, copyPageId);

    await this.saveNocodeStructure(nocodeId, structure);
    return {
      id: copyPageId, 
      pageBody: projectBody
    };
  }

  async deleteNocodeStructure(nocodeId: string, id: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    function delNode(array) {
      for (let i = 0; i < array.length; i++) {
        const node = array[i];
        if (node.id === id) {
          array.splice(i, 1);
          return true;
        }
        if (node.type === 'group' && !isEmpty(node.children)) {
          const deleted = delNode(node.children);
          if (deleted) return true;
        }
      }
      return false
    }
    const result = delNode(nocodeBody.structure)
    if(result) {
      nocodeBody.settings.homePage = normalizeNocodeHomePageSetting(nocodeBody.structure, nocodeBody.settings?.homePage);
      await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody)
    }
    return;
  }

  async renameNocodeForm(nocodeId: string, tableUID: TableUID, name: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const formData = nocodeBody.formData;
    const table = formData.tables.find(table => table.uid === tableUID);
    const oldName = table.alias;
    table.alias = name;
    const tableNames = [oldName, table.meta?.name].filter(Boolean);
    for (const subTable of formData.tables.filter(table => table.meta?.extra?.primaryTable?.[1] === tableUID)) {
      const prefix = typeof subTable.alias === "string"
        ? tableNames.find(tableName => subTable.alias.startsWith(`${tableName}--`))
        : undefined;
      if (prefix) {
        subTable.alias = `${name}${subTable.alias.slice(prefix.length)}`;
      }
    }
    function renameForm(array) {
      for(const node of array) {
        if(node.id === tableUID) {
          node.name = name
          return true
        }
        if(node.type === 'group' && !isEmpty(node.children)) {
          const renamed = renameForm(node.children)
          if(renamed) {
            return true
          }
        }
      }
      return false
    }
    const result = renameForm(nocodeBody.structure)
    if(result) {
      const sign = await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody)
      nocodeBody.sign = sign;
    }
    return nocodeBody;
  }

  async appendFormFieldChoice(
    nocodeId: string,
    payload: AppendFormFieldChoicePayload,
  ) {
    const target = await this.resolveAppendFormFieldChoiceTarget(nocodeId, payload, {
      requirePersistEnabled: true,
    });
    await this.validateAppendFormFieldChoiceTargetSync(target, payload);
    const nocodeBody = await getNocodeBody(this.nocodesDir, target.sourceNocodeId);
    return await this.appendFormFieldChoiceToNocodeBody(nocodeBody, target, payload);
  }

  async getFormFieldChoiceSign(
    nocodeId: string,
    payload: AppendFormFieldChoicePayload,
  ): Promise<GetFormFieldChoiceSignResult> {
    const target = await this.resolveAppendFormFieldChoiceTarget(nocodeId, payload, {
      requirePersistEnabled: false,
    });
    const nocodeBody = await getNocodeBody(this.nocodesDir, target.sourceNocodeId);
    return {
      sourceNocodeId: target.sourceNocodeId,
      sign: nocodeBody?.sign || "",
    };
  }

  async getNocodeSign(nocodeId: string): Promise<GetNocodeSignResult> {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    return {
      nocodeId,
      sign: nocodeBody?.sign || "",
    };
  }

  async appendPublicFormFieldChoice(
    nocodeId: string,
    payload: AppendFormFieldChoicePayload,
    context: {
      rowShareToken?: string;
      publicFormShare?: {
        nocodeId?: string;
        tableId?: string;
        visitToken?: string;
      };
    },
  ) {
    const rowShareToken = context?.rowShareToken;
    if (rowShareToken) {
      const rowShareContext = await this.getPublicRowShareContext(rowShareToken);
      this.assertPublicRowShareTableAccess(
        rowShareContext.nocodeBody,
        rowShareContext.table.uid,
        [payload.rootTableUID || payload.tableUID, payload.tableUID],
      );
      if (rowShareContext.rowShare.nocodeId !== nocodeId) {
        throw new Error(global.i18next.t('projectServices.rowShareNotEnabled'));
      }
      const target = await this.resolveAppendFormFieldChoiceTarget(rowShareContext.rowShare.nocodeId, payload, {
        requirePersistEnabled: true,
      });
      await this.validateAppendFormFieldChoiceTargetSync(target, payload);
      const targetNocodeBody = await getNocodeBody(this.nocodesDir, target.sourceNocodeId);
      return await this.appendFormFieldChoiceToNocodeBody(
        targetNocodeBody,
        target,
        payload,
      );
    }

    const publicFormShare = context?.publicFormShare;
    if (publicFormShare?.nocodeId && publicFormShare?.tableId) {
      if (publicFormShare.nocodeId !== nocodeId) {
        throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      }
      const publicFormContext = await this.getPublicFormShareContext(
        publicFormShare.nocodeId,
        publicFormShare.tableId as TableUID,
        publicFormShare.visitToken,
      );
      this.assertPublicFormTableAccess(
        publicFormContext.nocodeBody,
        publicFormContext.rootTableUID,
        [payload.rootTableUID || payload.tableUID, payload.tableUID],
      );
      const target = await this.resolveAppendFormFieldChoiceTarget(publicFormShare.nocodeId, payload, {
        requirePersistEnabled: true,
      });
      await this.validateAppendFormFieldChoiceTargetSync(target, payload);
      const targetNocodeBody = await getNocodeBody(this.nocodesDir, target.sourceNocodeId);
      return await this.appendFormFieldChoiceToNocodeBody(
        targetNocodeBody,
        target,
        payload,
      );
    }

    throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
  }

  async getPublicFormFieldChoiceSign(
    nocodeId: string,
    payload: AppendFormFieldChoicePayload,
    context: {
      rowShareToken?: string;
      publicFormShare?: {
        nocodeId?: string;
        tableId?: string;
        visitToken?: string;
      };
    },
  ): Promise<GetFormFieldChoiceSignResult> {
    const rowShareToken = context?.rowShareToken;
    if (rowShareToken) {
      const rowShareContext = await this.getPublicRowShareContext(rowShareToken);
      this.assertPublicRowShareTableAccess(
        rowShareContext.nocodeBody,
        rowShareContext.table.uid,
        [payload.rootTableUID || payload.tableUID, payload.tableUID],
      );
      if (rowShareContext.rowShare.nocodeId !== nocodeId) {
        throw new Error(global.i18next.t('projectServices.rowShareNotEnabled'));
      }
      return await this.getFormFieldChoiceSign(rowShareContext.rowShare.nocodeId, payload);
    }

    const publicFormShare = context?.publicFormShare;
    if (publicFormShare?.nocodeId && publicFormShare?.tableId) {
      if (publicFormShare.nocodeId !== nocodeId) {
        throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      }
      const publicFormContext = await this.getPublicFormShareContext(
        publicFormShare.nocodeId,
        publicFormShare.tableId as TableUID,
        publicFormShare.visitToken,
      );
      this.assertPublicFormTableAccess(
        publicFormContext.nocodeBody,
        publicFormContext.rootTableUID,
        [payload.rootTableUID || payload.tableUID, payload.tableUID],
      );
      return await this.getFormFieldChoiceSign(publicFormShare.nocodeId, payload);
    }

    throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
  }

  async getPublicNocodeSign(
    nocodeId: string,
    rootTableUID: TableUID,
    context: {
      rowShareToken?: string;
      publicFormShare?: {
        nocodeId?: string;
        tableId?: string;
        visitToken?: string;
      };
    },
  ): Promise<GetNocodeSignResult> {
    const rowShareToken = context?.rowShareToken;
    if (rowShareToken) {
      const rowShareContext = await this.getPublicRowShareContext(rowShareToken);
      this.assertPublicRowShareTableAccess(
        rowShareContext.nocodeBody,
        rowShareContext.table.uid,
        [rootTableUID],
      );
      if (rowShareContext.rowShare.nocodeId !== nocodeId) {
        throw new Error(global.i18next.t('projectServices.rowShareNotEnabled'));
      }
      return await this.getNocodeSign(rowShareContext.rowShare.nocodeId);
    }

    const publicFormShare = context?.publicFormShare;
    if (publicFormShare?.nocodeId && publicFormShare?.tableId) {
      if (publicFormShare.nocodeId !== nocodeId) {
        throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      }
      const publicFormContext = await this.getPublicFormShareContext(
        publicFormShare.nocodeId,
        publicFormShare.tableId as TableUID,
        publicFormShare.visitToken,
      );
      this.assertPublicFormTableAccess(
        publicFormContext.nocodeBody,
        publicFormContext.rootTableUID,
        [rootTableUID],
      );
      return await this.getNocodeSign(publicFormShare.nocodeId);
    }

    throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
  }

  private buildAppendedFormFieldChoice(choice: {
    id?: string;
    label: string;
    value: string;
    color?: string;
  }) {
    const choiceValue = choice?.value?.trim?.();
    if (!choiceValue) {
      throw new Error(global.i18next.t("projectServices.appendChoiceValueRequired"));
    }
    return {
      id: choice.id?.trim?.() || unique(),
      label: choice.label?.trim?.() || choiceValue,
      value: choiceValue,
      color: choice.color,
    };
  }

  private appendChoiceToWidgetOptions(
    formData: NocodeFormData,
    target: AppendFormFieldChoiceTarget,
    payload: Pick<AppendFormFieldChoicePayload, "widgetUID">,
    choice: {
      id: string;
      label: string;
      value: string;
      color?: string;
    },
  ) {
    const rootWidgetSoul = formData.formOptions?.[target.rootTableUID]?.widget;
    if (!target.widgetType || !rootWidgetSoul?.widgets?.length || !payload.widgetUID) {
      return;
    }

    const targetWidget = findWidgetSoulByUID(rootWidgetSoul.widgets || [], payload.widgetUID);
    if (!targetWidget) {
      return;
    }

    const optionKey = target.widgetType === "widget.form.checkboxGroup"
      ? "checkbox-option"
      : "treeselect-value-text-option";
    const optionConfig = ((targetWidget.options || {})[optionKey] || {}) as any;
    const optionList = Array.isArray(optionConfig.options) ? optionConfig.options : [];
    if (optionList.some((item: any) => item?.value === choice.value)) {
      return;
    }

    targetWidget.options = targetWidget.options || {};
    targetWidget.options[optionKey] = {
      ...optionConfig,
      options: [...optionList, choice],
    };
  }

  private getAppendFormFieldChoiceOptionMeta(widgetType: string) {
    if (widgetType === "widget.form.checkboxGroup") {
      return {
        optionKey: "checkbox-option",
        allowKey: "allow-add-custom-option",
        persistKey: "persist-added-custom-option",
      } as const;
    }
    if (widgetType === "widget.form.treeMultipleSelect") {
      return {
        optionKey: "treeselect-value-text-option",
        allowKey: "allow-add-custom-option",
        persistKey: "persist-added-custom-option",
      } as const;
    }
    return null;
  }

  private async validateAppendFormFieldChoiceTargetSync(
    target: AppendFormFieldChoiceTarget,
    payload: AppendFormFieldChoicePayload,
  ) {
    if (!target?.sourceNocodeId) {
      return;
    }
    const targetSign = payload?.targetSign || payload?.sign;
    if (!targetSign) {
      throw new ApiException(global.i18next.t("NocodeSyncGuardTs.syncFailed"), {
        type: "NOCODE_SYNC_CONFLICT",
        source: "AppendFormFieldChoiceTargetSync",
      });
    }
    const isSync = await validateSynchronization(this.nocodesDir, target.sourceNocodeId, targetSign);
    if (!isSync) {
      throw new ApiException(global.i18next.t("NocodeSyncGuardTs.syncFailed"), {
        type: "NOCODE_SYNC_CONFLICT",
        source: "AppendFormFieldChoiceTargetSync",
      });
    }
  }

  private resolveAppendFormFieldChoiceTargetFromBody(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    nocodeId: string,
    payload: AppendFormFieldChoicePayload,
    options: {
      requirePersistEnabled: boolean;
    },
  ): AppendFormFieldChoiceTarget {
    const tableSource = getNocodeDataSourceTableByUID(nocodeBody, payload.tableUID, { nocodeId }, true);
    const rootTableUID = payload.rootTableUID || payload.tableUID;
    const rootTableSource = getNocodeDataSourceTableByUID(nocodeBody, rootTableUID, { nocodeId }, true);
    const sourceNocodeId = tableSource?.connection?.nocodeId || nocodeId;
    const rootSourceNocodeId = rootTableSource?.connection?.nocodeId || nocodeId;
    if (!tableSource?.table || !rootTableSource?.table || sourceNocodeId !== rootSourceNocodeId) {
      throw new Error(global.i18next.t("projectServices.appendChoiceTargetTableNotFound"));
    }

    const formData = tableSource.connection || nocodeBody.formData;
    const field = tableSource.table.fields?.find(item => item.uid === payload.fieldId);
    if (!formData || !field) {
      throw new Error(global.i18next.t("projectServices.appendChoiceTargetFieldNotFound"));
    }

    const rootWidgetSoul = formData.formOptions?.[rootTableUID]?.widget;
    const targetWidget = findWidgetSoulByUID(rootWidgetSoul?.widgets || [], payload.widgetUID);
    if (!targetWidget) {
      throw new Error(global.i18next.t("projectServices.appendChoiceTargetWidgetNotFound"));
    }

    const optionMeta = this.getAppendFormFieldChoiceOptionMeta(targetWidget.type);
    if (!optionMeta) {
      throw new Error(global.i18next.t("projectServices.appendChoiceTargetWidgetTypeUnsupported"));
    }

    const widgetOptions = (targetWidget.options || {}) as Record<string, any>;
    if (!widgetOptions[optionMeta.allowKey]) {
      throw new Error(global.i18next.t("projectServices.appendChoiceTargetWidgetCustomOptionDisabled"));
    }
    if (options.requirePersistEnabled && !widgetOptions[optionMeta.persistKey]) {
      throw new Error(global.i18next.t("projectServices.appendChoiceTargetWidgetPersistDisabled"));
    }

    return {
      sourceNocodeId,
      tableUID: payload.tableUID,
      rootTableUID,
      widgetType: targetWidget.type,
    };
  }

  private async resolveAppendFormFieldChoiceTarget(
    nocodeId: string,
    payload: AppendFormFieldChoicePayload,
    options: {
      requirePersistEnabled: boolean;
    },
  ) {
    const nocodeBody = await this.getNocodeBodyWithOtherDataSources(nocodeId);
    return this.resolveAppendFormFieldChoiceTargetFromBody(nocodeBody, nocodeId, payload, options);
  }

  private async appendFormFieldChoiceToNocodeBody(
    nocodeBody: NocodeBody,
    target: AppendFormFieldChoiceTarget,
    payload: AppendFormFieldChoicePayload,
  ): Promise<AppendFormFieldChoiceResult> {
    const formData = nocodeBody.formData;
    if (!formData) {
      throw new Error(global.i18next.t("projectServices.appendChoiceFormNotFound"));
    }

    const table = formData.tables?.find(item => item.uid === target.tableUID);
    if (!table) {
      throw new Error(global.i18next.t("projectServices.appendChoiceTargetTableNotFound"));
    }

    const field = table.fields?.find(item => item.uid === payload.fieldId);
    if (!field) {
      throw new Error(global.i18next.t("projectServices.appendChoiceTargetFieldNotFound"));
    }

    const choice = this.buildAppendedFormFieldChoice(payload.choice);
    const extra = ((field.meta?.extra || {}) as Record<string, any>);
    const choices = Array.isArray(extra.choices) ? extra.choices : [];
    if (!choices.some((item: any) => item?.value === choice.value)) {
      extra.choices = [...choices, choice];
      field.meta.extra = extra;
    }

    this.appendChoiceToWidgetOptions(formData, target, payload, choice);

    const sign = await saveNocodeBody(this.nocodesDir, target.sourceNocodeId, nocodeBody);
    nocodeBody.sign = sign;
    return {
      nocodeBody,
      sourceNocodeId: target.sourceNocodeId,
      sign,
    };
  }

  async renameNocodeStructure(nocodeId: string, name: string, id: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    function renameNode(array) {
      for(const node of array) {
        if(node.id === id) {
          node.name = name
          return true
        }
        if(node.type === 'group' && !isEmpty(node.children)) {
          const renamed = renameNode(node.children)
          if(renamed) {
            return true
          }
        }
      }
      return false
    }
    const result = renameNode(nocodeBody.structure)
    if(result) {
      await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody)
    }
    return;
  }

  public async copyNocode(nocodeId: string, parentId: string, copyData = false) {
    const originMeta = await this.getNocodeMeta(nocodeId) as CopyNocodeSourceMeta;
    const copiedName = handleCopyName(originMeta.name);
    const metaSnapshot = this.buildCopyNocodeMetaSnapshot(originMeta, parentId);
    const { packagePath, cleanup, idMaps } = await this.createInternalCopyPackage(
      nocodeId,
      copiedName,
      copyData,
      this.getCopyExportDataStages(copyData),
    );
    this.applyCopyNocodeMetaIdMaps(metaSnapshot, idMaps);
    const nocodeExt = this.preferences.$p('nocodeExt') || ".zip";
    let copiedNocodeId = "";
    try {
      const result = await this.importNocode(packagePath, {
        filename: `${copiedName}${nocodeExt}`,
        parentId: metaSnapshot.parent,
        groupId: metaSnapshot.groupId,
        preservePermissions: true,
        cleanupOnFailure: true,
        throwOnError: true,
        metaOverrides: metaSnapshot,
        importDataStages: this.getCopyImportDataStages(copyData),
      }, null);
      if (!result?.meta?.id) {
        throw new Error("copy nocode failed");
      }
      copiedNocodeId = result.meta.id;
      await this.workbenchService.copyAppAiPermission(nocodeId, copiedNocodeId, idMaps?.uidMap);
      return result.meta;
    } catch (err) {
      if (copiedNocodeId) {
        await this.cleanupCopiedNocodeArtifacts(copiedNocodeId);
      }
      throw err;
    } finally {
      await cleanup();
    }
  }

  private async rebuildCopiedNocodeInternalIds(nocodeId: string) {
    const sourceBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const sourceTableUIDs = sourceBody?.formData?.tables?.map(table => table.uid) || [];
    const { nocodeBody, idMaps } = remapCopiedNocodeInternalIds(sourceBody);
    await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
    await this.rebuildCopiedPageBodies(nocodeId, idMaps);
    await this.rebuildCopiedFormReleaseBodies(nocodeId, sourceTableUIDs, idMaps);
    return idMaps;
  }

  private async rebuildCopiedPageBodies(nocodeId: string, idMaps: CopiedNocodeInternalIdMaps) {
    const pagesDir = this.commonUtil.getPagesPath(nocodeId);
    for (const [sourcePageId, copiedPageId] of Object.entries(idMaps.pageIdMap || {}) as [string, string][]) {
      const sourcePageDir = join(pagesDir, sourcePageId);
      const copiedPageDir = join(pagesDir, copiedPageId);
      if (sourcePageId !== copiedPageId && await exists(sourcePageDir)) {
        await rename(sourcePageDir, copiedPageDir);
      }

      if (!await exists(copiedPageDir)) {
        continue;
      }

      const pageBody = await getProjectBody(pagesDir, copiedPageId);
      await saveProjectBody(pagesDir, copiedPageId, remapCopiedPageBodyInternalIds(pageBody, idMaps));

      const releaseDir = join(copiedPageDir, "release");
      if (!await exists(releaseDir)) {
        continue;
      }
      const releaseBody = await getProjectBody(pagesDir, copiedPageId, false).catch(() => null);
      if (!releaseBody) {
        continue;
      }
      await writeProjectBody(releaseDir, remapCopiedPageBodyInternalIds(releaseBody, idMaps), copiedPageId);
    }
  }

  private async rebuildCopiedFormReleaseBodies(nocodeId: string, sourceTableUIDs: TableUID[], idMaps: CopiedNocodeInternalIdMaps) {
    for (const sourceTableUID of sourceTableUIDs || []) {
      const copiedTableUID = idMaps?.uidMap?.[sourceTableUID] as TableUID | undefined;
      if (!copiedTableUID) {
        continue;
      }
      const sourceReleaseDir = join(this.nocodesDir, nocodeId, "release", "forms", sourceTableUID);
      const copiedReleaseDir = join(this.nocodesDir, nocodeId, "release", "forms", copiedTableUID);
      if (sourceTableUID !== copiedTableUID && await exists(sourceReleaseDir)) {
        await rename(sourceReleaseDir, copiedReleaseDir);
      }
      if (!await exists(copiedReleaseDir)) {
        continue;
      }
      const releaseBody = await getFormReleaseNocodeBody(this.nocodesDir, nocodeId, copiedTableUID).catch(() => null);
      if (!releaseBody) {
        continue;
      }
      await saveFormReleaseNocodeBody(this.nocodesDir, nocodeId, copiedTableUID, applyCopiedNocodeInternalIdMaps(releaseBody, idMaps));
    }
  }

  private applyCopyNocodeMetaIdMaps(metaSnapshot: CopyNocodeMetaSnapshot, idMaps?: CopiedNocodeInternalIdMaps) {
    if (!idMaps?.uidMap || isEmpty(metaSnapshot?.apiTableInfo)) {
      return;
    }
    metaSnapshot.apiTableInfo = (metaSnapshot.apiTableInfo || []).map(item => ({
      ...item,
      id: (idMaps.uidMap[item.id] || item.id) as TableUID,
    }));
  }

  private buildCopyNocodeMetaSnapshot(originMeta: CopyNocodeSourceMeta, parentId: string): CopyNocodeMetaSnapshot {
    const importRestriction = {
      disableEdit: originMeta.importRestriction?.disableEdit,
      lockable: originMeta.importRestriction?.lockable || originMeta.importRestriction?.disableEdit || undefined,
      expireAt: originMeta.importRestriction?.expireAt,
      originalAuthor: originMeta.importRestriction?.originalAuthor ? { ...originMeta.importRestriction.originalAuthor } : undefined,
    };
    if (!importRestriction.disableEdit) {
      delete importRestriction.disableEdit;
    }
    if (!importRestriction.lockable) {
      delete importRestriction.lockable;
    }
    if (!importRestriction.expireAt) {
      delete importRestriction.expireAt;
    }
    if (!importRestriction.originalAuthor) {
      delete importRestriction.originalAuthor;
    }
    return {
      parent: parentId || originMeta.parent || "",
      description: originMeta.description || "",
      groupId: originMeta.groupId ?? null,
      isPublish: originMeta.isPublish ?? true,
      manualChanged: originMeta.manualChanged ?? false,
      updateMethod: originMeta.updateMethod,
      innerUpdateMethod: originMeta.innerUpdateMethod,
      publicUpdateMethod: originMeta.publicUpdateMethod,
      importRestriction: isEmpty(importRestriction) ? null : importRestriction,
      apiEnabled: originMeta.apiEnabled ?? false,
      apiAlias: originMeta.apiAlias || "",
      apiTableInfo: (originMeta.apiTableInfo || []).map(item => ({ ...item })),
    };
  }

  private async applyCopyNocodeMetaOverrides(nocodeMeta: NocodeEntity, overrides?: Partial<CopyNocodeMetaSnapshot>) {
    if (!overrides) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "parent")) {
      nocodeMeta.parent = overrides.parent || "";
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "description")) {
      nocodeMeta.description = overrides.description || "";
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "groupId")) {
      nocodeMeta.groupId = overrides.groupId ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "isPublish")) {
      nocodeMeta.isPublish = overrides.isPublish ?? nocodeMeta.isPublish;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "manualChanged")) {
      nocodeMeta.manualChanged = overrides.manualChanged ?? nocodeMeta.manualChanged;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "updateMethod")) {
      nocodeMeta.updateMethod = overrides.updateMethod ?? nocodeMeta.updateMethod;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "innerUpdateMethod")) {
      nocodeMeta.innerUpdateMethod = overrides.innerUpdateMethod ?? nocodeMeta.innerUpdateMethod;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "publicUpdateMethod")) {
      nocodeMeta.publicUpdateMethod = overrides.publicUpdateMethod ?? nocodeMeta.publicUpdateMethod;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "importRestriction")) {
      const importRestriction = {
        disableEdit: overrides.importRestriction?.disableEdit,
        lockable: overrides.importRestriction?.lockable || overrides.importRestriction?.disableEdit || undefined,
        expireAt: overrides.importRestriction?.expireAt,
        originalAuthor: overrides.importRestriction?.originalAuthor ? { ...overrides.importRestriction.originalAuthor } : undefined,
      };
      if (!importRestriction.disableEdit) {
        delete importRestriction.disableEdit;
      }
      if (!importRestriction.lockable) {
        delete importRestriction.lockable;
      }
      if (!importRestriction.expireAt) {
        delete importRestriction.expireAt;
      }
      if (!importRestriction.originalAuthor) {
        delete importRestriction.originalAuthor;
      }
      nocodeMeta.importRestriction = isEmpty(importRestriction) ? null : importRestriction;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "apiEnabled")) {
      nocodeMeta.apiEnabled = overrides.apiEnabled ?? nocodeMeta.apiEnabled;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "apiAlias")) {
      nocodeMeta.apiAlias = await this.resolveCopyNocodeApiAlias(overrides.apiAlias, nocodeMeta.id);
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "apiTableInfo")) {
      nocodeMeta.apiTableInfo = (overrides.apiTableInfo || []).map(item => ({ ...item }));
    }
  }

  private applyCopyNocodeBodyOverrides(nocodeBody: NocodeBody, overrides?: Partial<CopyNocodeMetaSnapshot>) {
    if (!overrides) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(overrides, "importRestriction")) {
      const nextImportRestriction = {
        ...(nocodeBody.importRestriction || {}),
        ...(overrides.importRestriction || {}),
      };
      if (nextImportRestriction.disableEdit && !nextImportRestriction.lockable) {
        nextImportRestriction.lockable = true;
      }
      if (!nextImportRestriction.disableEdit) {
        delete nextImportRestriction.disableEdit;
      }
      if (!nextImportRestriction.lockable) {
        delete nextImportRestriction.lockable;
      }
      if (!nextImportRestriction.expireAt) {
        delete nextImportRestriction.expireAt;
      }
      if (!nextImportRestriction.originalAuthor) {
        delete nextImportRestriction.originalAuthor;
      }
      nocodeBody.importRestriction = isEmpty(nextImportRestriction) ? undefined : nextImportRestriction;
    }
  }

  private async resolveCopyNocodeApiAlias(alias: string, appId: string) {
    const normalizedAlias = String(alias || "").trim();
    if (!normalizedAlias) {
      return "";
    }
    if (await this.appAliasValidator(normalizedAlias, appId)) {
      return normalizedAlias;
    }
    let suffix = 0;
    let nextAlias = `${normalizedAlias}-copy`;
    while (!await this.appAliasValidator(nextAlias, appId)) {
      suffix += 1;
      nextAlias = `${normalizedAlias}-copy-${suffix}`;
    }
    return nextAlias;
  }

  private async createInternalCopyPackage(
    nocodeId: string,
    copiedName: string,
    copyData = false,
    exportDataStages?: ExportNocodeDataStages,
  ) {
    const packageRootDir = path.join(os.tmpdir(), `banban_copy_${Date.now()}_${unique()}`);
    await mkdir(packageRootDir, { recursive: true }).catch(() => {});
    const ext = this.preferences.$p('nocodeExt') || ".zip";
    const safeFileName = sanitizeFilenameAdvanced(copiedName) || copiedName || unique();
    const packagePath = path.join(packageRootDir, `${safeFileName}${ext}`);
    let copiedIdMaps: CopiedNocodeInternalIdMaps | undefined;
    try {
      const result = await this.zipNocodeToFile(nocodeId, packagePath, {
        exportData: copyData,
        exportDataType: copyData ? "all" : undefined,
        preservePermissions: true,
        rewriteCopyInternalIds: true,
        rewriteCopyDataUUID: copyData,
        exportDataStages,
      });
      copiedIdMaps = result.copiedIdMaps || undefined;
    } catch (err) {
      await rm(packageRootDir, {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 1000,
      }).catch(() => {});
      throw err;
    }
    return {
      packagePath,
      idMaps: copiedIdMaps,
      cleanup: async () => {
        await rm(packageRootDir, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 1000,
        }).catch(() => {});
      },
    };
  }

  private async cleanupCopiedNocodeArtifacts(nocodeId: string) {
    const config = this.workbenchService.getAiPermissionConfig();
    if (config?.apps?.[nocodeId]) {
      const apps = { ...(config.apps || {}) };
      delete apps[nocodeId];
      await this.workbenchService.setAiPermissionConfig({
        ...config,
        apps,
      }).catch(() => {});
    }
    await rm(join(this.nocodesDir, nocodeId), {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 1000,
    }).catch(() => {});
    await rm(join(this.uploadsDir, nocodeId), {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 1000,
    }).catch(() => {});
    await this.completeDeleteNocodeList([nocodeId]).catch(() => {});
  }

  async createReleaseRecord(nocodeId: string, projectId: string, resourceBaseDir?: string) {
    const pagesDir = this.commonUtil.getPagesPath(nocodeId);
    const projectDir = join(pagesDir, projectId);
    resourceBaseDir = resourceBaseDir || projectDir;
    const releaseDir = join(projectDir, 'release');
    if (! await exists(releaseDir)) {
      await mkdir(releaseDir, { recursive: true });
    }
    await cp(join(projectDir, 'main.json'),join(releaseDir, 'main.json'));

    //读取项目结构
    let projectBody: ProjectBody = await this.getProjectBody(nocodeId, projectId);

    //检查项目是否使用二开文件
    let projectBodyStr = JSON.stringify(projectBody);
    const boards = [].concat(projectBody.foreboard, projectBody.boards, projectBody.backboard).filter(board=>!!board);
    const relativePaths = this.getUsedResourcePaths(boards);
    /**
     * 需要拷贝的资源目录
     * code/ 二开文件
     * resources/thinInstanceData/ 植被信息
     * versional/ 预留目录
     */
    const copiedDirs = ['code/', 'resources/thinInstanceData/', 'versional/'];
    for (const copiedDir of copiedDirs) {
      const filterPaths = relativePaths.filter(value => value.startsWith(copiedDir));
      if (filterPaths.length) {
        for (const filterPath of filterPaths) {
          const distDir = join('release', filterPath);
          const reg = new RegExp(filterPath, 'g');
          //正则替换
          projectBodyStr = projectBodyStr.replace(reg, distDir.replace(/\\/g, "/"));
          //拷贝资源
          await cp(join(resourceBaseDir, filterPath), join(projectDir, distDir), { recursive: true });
        }
      }
    }
    //更新body下的二开文件存储信息
    projectBody = JSON.parse(projectBodyStr);
    //存储项目结构到当前发布目录
    await writeProjectBody(releaseDir, projectBody, projectId);
  }

  public async renameNocode(nocodeId: string, name: string) {
    const nocode = await this.getNocodeMeta(nocodeId);
    nocode.name = name;
    await this.nocodeRepository.persistAndFlush(nocode);
  }

  public async saveNocodeBasicSetting(nocodeId: string, options: Partial<Pick<NocodeMeta, "name" | "description">>) {
    const nocode = await this.getNocodeMeta(nocodeId);
    if (!nocode) {
      throw new Error(global.i18next.t('projectServices.projectNotExistOrPrivate'));
    }
    if (options.name !== undefined) {
      nocode.name = options.name;
    }
    if (options.description !== undefined) {
      nocode.description = options.description;
    }
    await this.nocodeRepository.persistAndFlush(nocode);
    return nocode;
  }

  public async createNocode(options: object) {
    const nocode = new NocodeEntity();
    for(const key in options){
      nocode[key] = options[key];
    }
    await this.nocodeRepository.persistAndFlush(nocode);
    const nocodeBody = getEmptyNocodeBody();
    await saveNocodeBody(this.nocodesDir, nocode.id, nocodeBody);
    await this.workbenchService.ensureNewAppAiPermission(nocode.id);
    await this.notifyAiWarmup(nocode.id, 'create');
    return nocode;
  }

  public async createEmptyNocodeShell(options: {
    accountId: string;
    name: string;
    description?: string;
    groupId?: string;
  }) {
    const nocode = await this.initNocode(options.accountId || "");
    nocode.name = options.name;
    nocode.description = options.description?.trim?.() || "";
    nocode.groupId = options.groupId || "";
    await this.setNocodeMeta(nocode);
    return nocode;
  }

  private async migrateLegacyPublishUpdateMethod(nocodeMeta: NocodeMeta | null) {
    if (!nocodeMeta?.updateMethod) {
      return nocodeMeta;
    }

    let changed = false;
    if (!nocodeMeta.innerUpdateMethod) {
      nocodeMeta.innerUpdateMethod = nocodeMeta.updateMethod;
      changed = true;
    }
    if (!nocodeMeta.publicUpdateMethod) {
      nocodeMeta.publicUpdateMethod = nocodeMeta.updateMethod;
      changed = true;
    }

    if (changed) {
      await this.setNocodeMeta(nocodeMeta);
    }

    return nocodeMeta;
  }

  public async getNocodeMeta(id: string, deleted?: boolean) {
    const query = {};
    query["id"] = id;
    if (deleted !== undefined) {
      if(deleted) {
        query['deleted'] = true;
      } else {
        query['$or'] = [
          { deleted: { $ne: true } },
          { deleted: null },
        ]
      }
    }
    const nocodeMeta = await this.nocodeRepository.findOne(query);
    return await this.migrateLegacyPublishUpdateMethod(nocodeMeta);
  }

  public async setNocodeMeta(nocode: NocodeMeta) {
    return await this.nocodeRepository.persistAndFlush(nocode);
  }

  private buildNocodeImportOriginalAuthor(account?: Partial<Account>): NocodeImportOriginalAuthor | null {
    const identifier = this.preferences.getIdentifier();
    const uniqueAccountId = account?.id ? `id:${account.id}` : account?.user ? `user:${account.user}` : "";
    if (!identifier || !uniqueAccountId) return null;
    return {
      uid: `${identifier}:${uniqueAccountId}`,
      identifier,
      accountId: account?.id,
      username: account?.user,
      realname: account?.realname,
    };
  }

  private isNocodeImportOriginalAuthor(originalAuthor?: NocodeImportOriginalAuthor | null, account?: Partial<Account>) {
    const currentOriginalAuthor = this.buildNocodeImportOriginalAuthor(account);
    return !!originalAuthor?.uid && !!currentOriginalAuthor?.uid && originalAuthor.uid === currentOriginalAuthor.uid;
  }

  private canImportExpiredNocode(importRestriction?: Pick<NonNullable<NocodeMeta["importRestriction"]>, "expireAt" | "originalAuthor"> | null, account?: Partial<Account>) {
    if (!isNocodeImportExpired(importRestriction)) {
      return true;
    }
    return !getRuntime().isProduction || this.isNocodeImportOriginalAuthor(importRestriction?.originalAuthor, account);
  }

  private buildNocodeImportRestrictionState(target?: Pick<NocodeMeta, "importRestriction"> | null, account?: Partial<Account>): NocodeImportState {
    const importRestriction = target?.importRestriction;
    const isOriginalAuthor = this.isNocodeImportOriginalAuthor(importRestriction?.originalAuthor, account);
    const canManageInDev = isOriginalAuthor || !getRuntime().isProduction;
    const canManageReadonly = !!(importRestriction?.disableEdit || importRestriction?.lockable) && canManageInDev;
    return buildNocodeImportState(target, {
      canClearReadonly: !!importRestriction?.disableEdit && canManageInDev,
      canManageReadonly,
      canManageExpireAt: canManageInDev,
    });
  }

  private getCrossAppTableUIDs(formData: NocodeFormData, rootTableUIDs: TableUID[]) {
    return expandNocodeExportTableUIDs(formData, rootTableUIDs);
  }

  private isAdminAccount(account?: Partial<Account>) {
    return isSystemAdminAccount(account);
  }

  async createCrossAppPermissionContext(account?: Partial<Account>): Promise<CrossAppPermissionContext> {
    if (!account?.id || this.isAdminAccount(account)) {
      return {
        account,
        departments: [],
      };
    }

    return {
      account,
      departments: getAllRelatedDepartments(await this.getAllDepartments(), account.departments || []),
    };
  }

  public async canReadNocodeByAccount(nocodeId: string, account?: Partial<Account>) {
    const [meta, body] = await Promise.all([
      this.getNocodeMeta(nocodeId, false).catch(() => null),
      this.getNocodeBody(nocodeId).catch(() => null),
    ]);
    if (!meta || !body) {
      return false;
    }

    const importState = this.getNocodeImportRestrictionStateByMeta(meta, account);
    if (importState.expired) {
      return false;
    }

    const context = await this.createCrossAppPermissionContext(account);
    return this.canViewTargetNocode(body, context);
  }

  public async canWriteNocodeByAccount(nocodeId: string, account?: Partial<Account>) {
    const [meta, body] = await Promise.all([
      this.getNocodeMeta(nocodeId, false).catch(() => null),
      this.getNocodeBody(nocodeId).catch(() => null),
    ]);
    if (!meta || !body) {
      return false;
    }

    const importState = this.getNocodeImportRestrictionStateByMeta(meta, account);
    if (importState.expired || importState.disableEdit) {
      return false;
    }

    const context = await this.createCrossAppPermissionContext(account);
    return this.canManageTargetNocode(body, context);
  }

  private hasPermissionRange(
    permission: ApplicationPermission[keyof ApplicationPermission] | undefined,
    context: CrossAppPermissionContext,
  ) {
    if (this.isAdminAccount(context.account)) {
      return true;
    }

    if (isEmpty(permission)) {
      return true;
    }

    const account = context.account;
    if (!account?.id) {
      return false;
    }

    if (permission.rangeType === PermissionFilterMode.BLACK) {
      if (permission.blacklist.users.includes(account.id)) {
        return false;
      }
      if ((account.roles || []).some(roleId => permission.blacklist.roles.includes(roleId))) {
        return false;
      }
      if (context.departments.some(departmentId => permission.blacklist.departments.includes(departmentId))) {
        return false;
      }
      return true;
    }

    if (permission.whitelist.users.includes(account.id)) {
      return true;
    }
    if ((account.roles || []).some(roleId => permission.whitelist.roles.includes(roleId))) {
      return true;
    }
    if (context.departments.some(departmentId => permission.whitelist.departments.includes(departmentId))) {
      return true;
    }
    return false;
  }

  private hasPagePermission(
    permission: PagePermission[string][PermissionCategory.GET] | undefined,
    context: CrossAppPermissionContext,
  ) {
    if (this.isAdminAccount(context.account)) {
      return true;
    }

    if (isEmpty(permission) || permission.rangeType === PermissionRangeType.ALL) {
      return true;
    }

    const account = context.account;
    if (!account?.id) {
      return false;
    }

    if (permission.range?.users?.includes(account.id)) {
      return true;
    }
    if (permission.range?.roles?.some(roleId => (account.roles || []).includes(roleId))) {
      return true;
    }
    return permission.range?.departments?.some(departmentId => context.departments.includes(departmentId)) ?? false;
  }

  private hasDataMemberPermission(
    permission: DataPermissionOther | undefined,
    context: CrossAppPermissionContext,
  ) {
    if (this.isAdminAccount(context.account)) {
      return true;
    }

    const account = context.account;
    if (!account?.id) {
      return false;
    }

    if (permission?.memberRange?.rangeType === PermissionRangeType.ALL) {
      return true;
    }

    if (permission?.memberRange?.range?.users?.includes(account.id)) {
      return true;
    }

    if (permission?.memberRange?.range?.roles?.some(roleId => (account.roles || []).includes(roleId))) {
      return true;
    }

    return permission?.memberRange?.range?.departments?.some(departmentId => context.departments.includes(departmentId)) ?? false;
  }

  private canViewTargetNocode(targetBody: NocodeBody | null | undefined, context: CrossAppPermissionContext) {
    if (!targetBody) {
      return false;
    }
    return this.hasPermissionRange(targetBody.permissions?.application?.get, context);
  }

  private canManageTargetNocode(targetBody: NocodeBody | null | undefined, context: CrossAppPermissionContext) {
    if (!targetBody || !this.canViewTargetNocode(targetBody, context)) {
      return false;
    }
    if (isNocodeImportReadonly(targetBody)) {
      return false;
    }
    return this.hasPermissionRange(targetBody.permissions?.application?.update, context);
  }

  public async assertManageTargetNocode(
    targetNocodeId: string,
    account?: Partial<Account>,
  ) {
    const targetBody = await getNocodeBody(this.nocodesDir, targetNocodeId).catch(() => null);
    if (isNocodeImportExpired(targetBody)) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
    const context = await this.createCrossAppPermissionContext(account);
    if (!this.canManageTargetNocode(targetBody, context)) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
  }

  canViewTargetTable(targetBody: NocodeBody | null | undefined, tableUID: TableUID, context: CrossAppPermissionContext) {
    if (!targetBody || !tableUID || !this.canViewTargetNocode(targetBody, context)) {
      return false;
    }
    return this.hasPagePermission(targetBody.permissions?.page?.[tableUID]?.[PermissionCategory.GET], context);
  }

  private canReadTargetTableData(targetBody: NocodeBody | null | undefined, tableUID: TableUID, context: CrossAppPermissionContext) {
    if (!targetBody || !tableUID || !this.canViewTargetNocode(targetBody, context)) {
      return false;
    }

    const permissions = targetBody.permissions?.data?.[tableUID]?.other;
    if (permissions === undefined) {
      return true;
    }

    return permissions.some(permission => {
      if (!permission?.handleRange?.[PermissionCategory.GET]) {
        return false;
      }
      return this.hasDataMemberPermission(permission, context);
    });
  }

  private canWriteTargetTableData(
    targetBody: NocodeBody | null | undefined,
    tableUID: TableUID,
    action: DataChangeType,
    context: CrossAppPermissionContext,
  ) {
    if (!targetBody || !tableUID || !this.canViewTargetNocode(targetBody, context)) {
      return false;
    }

    if (action === DataChangeType.ADD) {
      const permission = targetBody.permissions?.data?.[tableUID]?.[PermissionCategory.ADD];
      if (isEmpty(permission) || permission.rangeType === PermissionRangeType.ALL) {
        return true;
      }

      const account = context.account;
      if (!account?.id) {
        return false;
      }

      if (permission.range?.users?.includes(account.id)) {
        return true;
      }
      if (permission.range?.roles?.some(roleId => (account.roles || []).includes(roleId))) {
        return true;
      }
      return permission.range?.departments?.some(departmentId => context.departments.includes(departmentId)) ?? false;
    }

    const permissions = targetBody.permissions?.data?.[tableUID]?.other;
    if (permissions === undefined) {
      return true;
    }

    const handlePermission = action === DataChangeType.DELETE
      ? PermissionCategory.DELETE
      : PermissionCategory.UPDATE;

    return permissions.some(permission => {
      if (!permission?.handleRange?.[handlePermission]) {
        return false;
      }
      return this.hasDataMemberPermission(permission, context);
    });
  }

  private async buildOtherDataSources(
    nocodeId: string,
    nocodeBody: NocodeBody,
    filterRootTable?: (targetBody: NocodeBody, targetNocodeId: string, tableUID: TableUID) => boolean,
  ): Promise<OtherDataSource[]> {
    const crossAppForms = nocodeBody?.settings?.crossApp?.forms || [];
    if (!crossAppForms.length) return [];

    const formGroups = crossAppForms.reduce<Record<string, TableUID[]>>((prev, item) => {
      if (!item?.nocodeId || item.nocodeId === nocodeId || !item.tableUID) return prev;
      prev[item.nocodeId] = prev[item.nocodeId] || [];
      prev[item.nocodeId].push(item.tableUID);
      return prev;
    }, {});

    const otherDataSources = await Promise.all(Object.entries(formGroups).map(async ([targetNocodeId, tableUIDs]) => {
      const targetBody = await getNocodeBody(this.nocodesDir, targetNocodeId).catch(() => null);
      const targetFormData = targetBody?.formData;
      if (!targetFormData?.tables?.length) return null;

      const rootTableUIDs = [...new Set(tableUIDs)].filter(tableUID => {
        if (!filterRootTable) {
          return true;
        }
        return filterRootTable(targetBody, targetNocodeId, tableUID);
      });
      if (!rootTableUIDs.length) return null;

      const targetMeta = await this.getNocodeMeta(targetNocodeId).catch(() => null);
      const crossAppTableUIDs = this.getCrossAppTableUIDs(targetFormData, rootTableUIDs);
      if (!crossAppTableUIDs.size) return null;

      const tables = targetFormData.tables.filter(table => crossAppTableUIDs.has(table.uid));
      const tableMetaUIDs = new Set(tables.map(table => table.meta?.uid).filter(Boolean));
      const optionTables = (targetFormData.options?.tables || []).filter(table => tableMetaUIDs.has(table.uid));
      const formOptions = Object.entries(targetFormData.formOptions || {}).reduce((prev, [tableUID, option]) => {
        if (crossAppTableUIDs.has(tableUID as TableUID)) {
          prev[tableUID] = deepClone(option);
        }
        return prev;
      }, {});
      const metas = Object.entries(targetFormData.metas || {}).reduce((prev, [tableUID, meta]) => {
        if (crossAppTableUIDs.has(tableUID as TableUID)) {
          prev[tableUID] = deepClone(meta);
        }
        return prev;
      }, {});
      const aggregateTables = deepClone(targetFormData.aggregateTables || []);

      return {
        nocodeId: targetNocodeId,
        uid: targetFormData.uid,
        name: targetMeta?.name || targetNocodeId,
        options: {
          ...deepClone(targetFormData.options),
          tables: optionTables,
        },
        formOptions,
        metas,
        tables,
        aggregateTables,
      } as OtherDataSource;
    }));

    return otherDataSources.filter(Boolean);
  }

  private async buildEditorOtherDataSources(nocodeId: string, nocodeBody: NocodeBody, account?: Partial<Account>): Promise<OtherDataSource[]> {
    const context = await this.createCrossAppPermissionContext(account);
    return await this.buildOtherDataSources(nocodeId, nocodeBody, (targetBody, _targetNocodeId, tableUID) => {
      if (isNocodeImportExpired(targetBody)) {
        return false;
      }
      return this.canViewTargetTable(targetBody, tableUID, context)
        && this.canReadTargetTableData(targetBody, tableUID, context);
    });
  }

  public async assertCrossAppFlowWritePermission(
    targetNocodeId: string,
    targetTableUID: TableUID,
    action: DataChangeType,
    account?: Partial<Account>,
  ) {
    const context = await this.createCrossAppPermissionContext(account);
    const targetBody = await getNocodeBody(this.nocodesDir, targetNocodeId).catch(() => null);

    if (!this.canViewTargetTable(targetBody, targetTableUID, context)) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }

    if (!this.canWriteTargetTableData(targetBody, targetTableUID, action, context)) {
      throw new Error(global.i18next.t('formDataService.noPerm'));
    }
  }

  private async buildOtherDataSourceSchemas(nocodeId: string, nocodeBody: NocodeBody): Promise<OtherDataSource[]> {
    return await this.buildOtherDataSources(nocodeId, nocodeBody);
  }

  public async getNocodeBody(id: string): Promise<NocodeBody> {
    return await getNocodeBody(this.nocodesDir, id);
  }

  public async findPageWidgetSoul(nocodeId: string, widgetUID: string) {
    if (!nocodeId || !widgetUID) {
      return null;
    }
    const body = await this.getNocodeBody(nocodeId).catch(() => null);
    const pages = getAllPages(body?.structure || []);
    for (const page of pages) {
      const projectBody = await this.getProjectBody(nocodeId, page.id).catch(() => null);
      const boards = [projectBody?.foreboard, ...(projectBody?.boards || []), projectBody?.backboard].filter(Boolean) as BoardSoul[];
      for (const board of boards) {
        const widget = findWidgetSoulByUID(board.widgets || [], widgetUID);
        if (widget) {
          return {
            pageId: page.id,
            widget,
          };
        }
      }
    }
    return null;
  }

  public async saveNocodeBodyById(nocodeId: string, body: NocodeBody) {
    return await saveNocodeBody(this.nocodesDir, nocodeId, body);
  }

  private async buildPublicFormReleaseSnapshotBody(nocodeId: string, nocodeBody: NocodeBody) {
    const otherDataSources = await this.buildOtherDataSources(nocodeId, nocodeBody);

    return {
      ...nocodeBody,
      otherDataSources,
      otherDataSourceSchemas: otherDataSources,
    };
  }

  private async getPublicFormSnapshot(nocodeId: string, tableUID: TableUID) {
    const nocodeMeta = await this.getNocodeMeta(nocodeId);
    const currentBody = await this.getNocodeBody(nocodeId);
    const currentTable = currentBody?.formData?.tables?.find(table => table.uid === tableUID);

    if (!currentTable) {
      return {
        nocodeMeta,
        nocodeBody: currentBody,
        table: null,
      };
    }

    const isLiveUpdate = getFormPublicPublishUpdateMethod(nocodeMeta, currentTable.publish) === PublishUpdateMethod.LIVE;
    let nocodeBody = currentBody;
    if (!isLiveUpdate) {
      nocodeBody = await getFormReleaseNocodeBody(this.nocodesDir, nocodeId, tableUID).catch(() => null);
      if (!nocodeBody) {
        throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      }
    } else {
      nocodeBody = await this.buildPublicFormReleaseSnapshotBody(nocodeId, nocodeBody);
    }

    return {
      nocodeMeta,
      nocodeBody,
      table: nocodeBody?.formData?.tables?.find(table => table.uid === tableUID) || currentTable,
    };
  }

  private async getPublicQuerySnapshot(nocodeId: string, tableUID: TableUID) {
    const nocodeMeta = await this.getNocodeMeta(nocodeId);
    const nocodeBody = await this.getNocodeBody(nocodeId);
    const table = nocodeBody?.formData?.tables?.find(item => item.uid === tableUID) || null;
    return {
      nocodeMeta,
      nocodeBody,
      table,
    };
  }

  private getPublicFormFieldsAuth(nocodeBody: NocodeBody, tableId: TableUID) {
    const permissions = nocodeBody?.permissions?.field?.[tableId]?.[PermissionCategory.GET];
    if (isEmpty(permissions)) return "all";
    const fieldsAuth: Record<string, number> = {};
    let hasMatchedPermission = false;
    let hasCustomFieldRange = false;
    for (const permission of permissions) {
      if (permission.externalVisitorEnabled === false) continue;
      hasMatchedPermission = true;
      if (permission.fieldRange?.rangeType === PermissionRangeType.ALL) continue;
      hasCustomFieldRange = true;
      assignFieldsAuth(fieldsAuth, permission.fieldRange?.range || {});
    }
    if (!hasMatchedPermission) return "all";
    if (!hasCustomFieldRange || isEmpty(fieldsAuth)) return "all";
    return fieldsAuth as Record<string, FieldAuthValue>;
  }

  private async getPublicFormShareContext(nocodeId: string, rootTableUID: TableUID, visitToken?: string) {
    const formSnapshot = await this.getPublicFormSnapshot(nocodeId, rootTableUID);
    const table = formSnapshot.table;
    if (!table || !table.publish?.sharing || !table.publish?.isPublicShare) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    if (table.publish.shareExpireTime && dayjs(table.publish.shareExpireTime).isBefore(dayjs())) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    if (table.publish.isNeedPassword) {
      const validToken = visitToken ? await this.validateShareToken(nocodeId, rootTableUID, PublishCategory.FORM, visitToken) : false;
      if (!validToken) {
        throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      }
    }
    return {
      ...formSnapshot,
      formData: formSnapshot.nocodeBody?.formData,
      rootTableUID,
    };
  }

  private async buildPublishUserInfo(meta?: NocodeMeta | null) {
    const userId = String(meta?.userId || "").trim();
    if (!userId) {
      return {
        userId: "",
        user: String(meta?.user || ""),
        realname: String(meta?.realname || ""),
      };
    }
    const account = await this.organizeCache.getUserById(userId).catch(() => null);
    return {
      userId,
      user: String(account?.user || meta?.user || ""),
      realname: String(account?.realname || meta?.realname || account?.user || meta?.user || ""),
    };
  }

  private buildReportAccount() {
    return String(this.userService.getUser()?.loginName || "").trim();
  }

  private assertPublicFormTableAccess(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    rootTableUID: TableUID,
    tableUIDs: TableUID[],
  ) {
    const allowedTableUIDs = this.collectPublicRowShareAccessibleTableUIDs(nocodeBody, rootTableUID);
    const invalidTableUID = tableUIDs.find((tableUID) => !allowedTableUIDs.has(tableUID));
    if (invalidTableUID) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
  }

  private resolvePublicFormDataTableSource(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    nocodeId: string,
    tableUID: TableUID,
  ) {
    const tableSource = getNocodeDataSourceTableByUID(nocodeBody, tableUID, {
      nocodeId,
    }, true);

    return {
      formData: tableSource?.connection || nocodeBody?.formData,
      table: tableSource?.table || nocodeBody?.formData?.tables?.find(item => item.uid === tableUID),
      sourceNocodeId: tableSource?.connection?.nocodeId || nocodeId,
    };
  }

  public async getNocodeBodyWithOtherDataSources(id: string): Promise<NocodeBody> {
    const nocodeBody = await this.getNocodeBody(id);
    if (!nocodeBody) return nocodeBody;
    const otherDataSources = await this.buildOtherDataSources(id, nocodeBody);

    return {
      ...nocodeBody,
      otherDataSources,
      otherDataSourceSchemas: otherDataSources,
    };
  }

  public async resolveFormMutationSource(
    nocodeId: string,
    tableUID: TableUID,
    context: {
      rowShareToken?: string;
      publicFormShare?: {
        nocodeId: string;
        rootTableUID: TableUID;
        visitToken?: string;
      };
    } = {},
  ) {
    if (context.rowShareToken) {
      const rowShareContext = await this.getPublicRowShareContext(context.rowShareToken);
      this.assertPublicRowShareTableAccess(
        rowShareContext.nocodeBody,
        rowShareContext.table.uid,
        [tableUID],
      );
      const target = this.resolvePublicFormDataTableSource(
        rowShareContext.nocodeBody,
        rowShareContext.rowShare.nocodeId,
        tableUID,
      );
      if (!target.formData || !target.table) {
        throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
      }
      return target;
    }

    if (context.publicFormShare?.nocodeId && context.publicFormShare.rootTableUID) {
      if (context.publicFormShare.nocodeId !== nocodeId) {
        throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      }
      const publicContext = await this.getPublicFormShareContext(
        nocodeId,
        context.publicFormShare.rootTableUID,
        context.publicFormShare.visitToken,
      );
      this.assertPublicFormTableAccess(
        publicContext.nocodeBody,
        context.publicFormShare.rootTableUID,
        [tableUID],
      );
      const target = this.resolvePublicFormDataTableSource(publicContext.nocodeBody, nocodeId, tableUID);
      if (!target.formData || !target.table) {
        throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      }
      return target;
    }

    const nocodeBody = await this.getNocodeBodyWithOtherDataSources(nocodeId);
    const target = this.resolvePublicFormDataTableSource(nocodeBody, nocodeId, tableUID);
    if (!target.formData || !target.table) {
      throw new Error(`Current form table not found: ${nocodeId}:${tableUID}`);
    }
    return target;
  }

  public async validateNocodeSign(nocodeId: string, sign: string) {
    if (!nocodeId || !sign) return false;
    return await validateSynchronization(this.nocodesDir, nocodeId, sign);
  }

  public async getEditorNocodeBodyWithOtherDataSources(id: string, account?: Partial<Account>): Promise<NocodeBody> {
    const nocodeBody = await this.getNocodeBody(id);
    if (!nocodeBody) return nocodeBody;
    const currentAccount = account || await this.formDataService.getAccount().catch(() => null);
    const otherDataSources = await this.buildEditorOtherDataSources(id, nocodeBody, currentAccount || undefined);

    return {
      ...nocodeBody,
      otherDataSources,
      otherDataSourceSchemas: otherDataSources,
    };
  }

  async getAllNocodeMetas() {
    return await this.nocodeRepository.find({}, {orderBy: {"createTime": "DESC"}});
  }
  public async getNocodesMetas(folderId: string, deleted: boolean = false) {
    const query = {};
    query["parent"] = folderId;
    if (deleted !== undefined) {
      if(deleted) {
        query['deleted'] = true;
      } else {
        query['$or'] = [
          { deleted: { $ne: true } },
          { deleted: null },
        ]
      }
    }
    return await this.nocodeRepository.find(query, {orderBy: {"createTime": "DESC"}});
  }

  public async deleteNocode(id: string, flush = true) {
    void flush;
    return await this.scheduledTriggerRepository.softDeleteNocodeAndPauseSchedules(id, Date.now());
  }

  public async restoreNocodeList(ids: string[], flush = true) {
    const nocodeList:NocodeEntity[] = await this.nocodeRepository.find({
      id: { $in: ids }
    }, {orderBy: {"createTime": "DESC"}})
    for (const id of ids) {
      await this.scheduledTriggerRepository.stageScheduleChange(id, "restore_pending");
    }
    if (nocodeList.length) {
      for (const nocode of nocodeList) {
        nocode.deleted = false;
        // nocode.deleteTime = Date.now();
        // nocode.deletedBy = null;
      }
    }
    if (flush) {
      await this.nocodeRepository.flush();
    }
    for (const id of ids) {
      await this.scheduledTriggerRepository.resumeSchedulesByNocodeId(id);
      await this.scheduledTriggerRepository.queueScheduleChange(id, "restore");
    }
    return nocodeList;
  }

  public async completeDeleteNocodeList(ids: string[], flush = true) {
    const nocodeList:NocodeEntity[] = await this.nocodeRepository.find({
      id: { $in: ids }
    }, {orderBy: {"createTime": "DESC"}})
    if (nocodeList.length) {
      await this.getAiNocodeEditorConversationService().deleteConversationsForApps(
        nocodeList.map(nocode => nocode.id),
      );
      for (const nocode of nocodeList) {
        this.nocodeRepository.remove(nocode);
      }
    }
    if (flush) {
      await this.nocodeRepository.flush();
    }
    return nocodeList;
  }

  private getAiNocodeEditorConversationService() {
    const conversationModule = require('../ai/nocode-editor/nocode-editor-conversation.service') as typeof import('../ai/nocode-editor/nocode-editor-conversation.service');
    return this.moduleRef.get(conversationModule.AiNocodeEditorConversationService, { strict: false });
  }

  private async copyPages(nocodeId: string, tempDir: string, structure?: NocodeStructure[]) {
    const pagesDir = this.commonUtil.getPagesPath(nocodeId);
    const nocodeBody = structure ? null : await getNocodeBody(this.nocodesDir, nocodeId);
    const allPages = getAllPages(structure || nocodeBody?.structure || []);
    for (const page of allPages) {
      const pageDir = join(pagesDir, page.id);
      const tempPageDir = join(tempDir, 'projects', page.id);
      if (!await exists(pageDir)) {
        continue;
      }
      // 复制整页目录，保留 release/code/resources 等页面级资源。
      await cp(pageDir, tempPageDir, { recursive: true });
    }
  }

  private buildExportFormDataQueryOptions(
    start: number,
    limit: number,
    stage: QueryOptions["stage"],
    scope: QueryOptions["scope"] = "main",
  ): QueryOptions {
    return {
      orderBy: SortType.ASC,
      stage,
      scope,
      start,
      limit,
    };
  }

  private getExportDataStageConfigs(exportDataStages?: ExportNocodeDataStages): ExportNocodeDataStageConfig[] {
    const stages = this.getDefaultExportDataStages(exportDataStages);
    const configs: ExportNocodeDataStageConfig[] = [];
    if (stages.submitted) {
      configs.push({
        relativeDir: "data",
        scope: "main",
        stage: this.getDefaultReadableStageCondition(),
      });
    }
    if (stages.recycle) {
      configs.push({
        relativeDir: "data-recycle",
        scope: "main",
        stage: FormDataStage.DELETED,
      });
    }
    if (stages.draft) {
      configs.push({
        relativeDir: "data-draft",
        scope: "draft",
        stage: FormDataStage.DRAFT,
      });
    }
    return configs;
  }

  private async writeExportMainFiles(stageDir: string, nocodeBody: NocodeBody) {
    const content = getRuntime().isProduction
      ? JSON.stringify(nocodeBody)
      : JSON.stringify(nocodeBody, null, 2);
    await writeFile(join(stageDir, "main.json"), content, "utf-8");
  }

  private async writeExportRuntimeFile(stageDir: string, runtimeState: ReturnType<typeof createEmptyRuntimeState>) {
    const content = getRuntime().isProduction
      ? JSON.stringify(runtimeState)
      : JSON.stringify(runtimeState, null, 2);
    await writeFile(join(stageDir, "runtime.json"), content, "utf-8");
  }

  private async exportNocodeFormDataByChunks(
    nocodeBody: NocodeBody,
    nocodeId: string,
    stageDir: string,
    options: ExportNocodeOptions,
    config: ExportNocodeDataStageConfig,
    selectedTableUIDs?: TableUID[],
  ) {
    if (!options.exportData || isEmpty(nocodeBody.formData)) {
      return {
        exportedRowsByTable: {},
        tableExportStats: {},
      };
    }

    const formData = nocodeBody.formData;
    const selectedTableUIDSet = new Set((selectedTableUIDs || []).filter(Boolean));
    const tables = (formData?.tables || []).filter(table => !selectedTableUIDSet.size || selectedTableUIDSet.has(table.uid));
    if (!tables.length) {
      return {
        exportedRowsByTable: {},
        tableExportStats: {},
      };
    }

    const chunkWriter = new ExportBucketChunkFileWriter(join(stageDir, config.relativeDir, formData.uid));
    const exportLimit = options.exportDataType === "some"
      ? Math.max(1, options.rowCount || 1)
      : Number.POSITIVE_INFINITY;
    const shouldCopyPartialUploads = options.exportDataType !== "all" && await exists(join(this.uploadsDir, nocodeId));
    const partialUploadsDir = join(stageDir, "uploads");

    if (shouldCopyPartialUploads) {
      await mkdir(partialUploadsDir, { recursive: true });
    }

    let isCompleted = false;
    const exportedRowsByTable: Record<string, Row[]> = {};
    const tableExportStats: Record<string, TableExportStat> = {};
    try {
      for (const table of tables) {
        let exportedCount = 0;
        let totalCount = 0;
        while (exportedCount < exportLimit) {
          const limit = Number.isFinite(exportLimit)
            ? Math.min(this.exportDataChunkSize, exportLimit - exportedCount)
            : this.exportDataChunkSize;
          if (!(limit > 0)) {
            break;
          }

          const res = await this.connectionUtils.readConnectionData(formData, false, nocodeId, unique(), {}, {
            tableUIDs: [table.uid],
            queryOptions: this.buildExportFormDataQueryOptions(exportedCount, limit, config.stage, config.scope),
          });
          const bucket = res?.buckets?.find(item => item.tableId === table.uid) || res?.buckets?.[0];
          if (!bucket) {
            break;
          }

          const rows = stripNocodeFlowRuntimeFields(
            Array.isArray(bucket.rows) ? bucket.rows : [],
            table,
          );
          if (!rows.length) {
            break;
          }
          if (!exportedRowsByTable[bucket.tableId]) {
            exportedRowsByTable[bucket.tableId] = [];
          }
          exportedRowsByTable[bucket.tableId].push(...rows);

          await chunkWriter.writeBucketChunk({
            tableName: bucket.tableName,
            tableId: bucket.tableId,
            fields: bucket.fields,
            count: bucket.count,
          }, rows);
          if (shouldCopyPartialUploads) {
            await this.copyUploadResourceByBuckets([bucket], dirname(this.uploadsDir), partialUploadsDir);
          }

          exportedCount += rows.length;
          totalCount = bucket.count || 0;
          if (exportedCount >= exportLimit || exportedCount >= totalCount) {
            break;
          }
        }
        tableExportStats[table.meta?.uid || table.uid] = {
          exportedCount,
          totalCount,
        };
      }
      isCompleted = true;
    } finally {
      if (isCompleted) {
      } else {
        await rm(join(stageDir, config.relativeDir, formData.uid), { recursive: true, force: true }).catch(() => {});
      }
    }

    return {
      exportedRowsByTable,
      tableExportStats,
    };
  }

  private async buildExportZipEntries(stageDir: string, nocodeBody: NocodeBody, nocodeId: string, includeAllUploads: boolean) {
    const nocodePath = join(this.nocodesDir, nocodeId);
    const entries: ZipOutputEntry[] = [
      {
        type: "directory",
        sourcePath: stageDir,
        zipPath: "",
      },
    ];

    const pagesDir = this.commonUtil.getPagesPath(nocodeId);
    const stagedProjectsDir = join(stageDir, "projects");
    if (!await exists(stagedProjectsDir) && await exists(pagesDir)) {
      const allPages = getAllPages(nocodeBody.structure);
      for (const page of allPages) {
        const pageDir = join(pagesDir, page.id);
        if (!await exists(pageDir)) {
          continue;
        }
        entries.push({
          type: "directory",
          sourcePath: pageDir,
          zipPath: join("projects", page.id),
        });
      }
    }

    if (await exists(join(nocodePath, "resources"))) {
      entries.push({
        type: "directory",
        sourcePath: join(nocodePath, "resources"),
        zipPath: "resources",
      });
    }
    if (await exists(join(nocodePath, "resource"))) {
      entries.push({
        type: "directory",
        sourcePath: join(nocodePath, "resource"),
        zipPath: "resources",
      });
    }

    if (await exists(join(nocodePath, "code"))) {
      entries.push({
        type: "directory",
        sourcePath: join(nocodePath, "code"),
        zipPath: "code",
      });
    }

    if (await exists(join(nocodePath, "snapshot.png"))) {
      entries.push({
        type: "file",
        sourcePath: join(nocodePath, "snapshot.png"),
        zipPath: "snapshot.png",
      });
    }

    if (includeAllUploads && await exists(join(this.uploadsDir, nocodeId))) {
      entries.push({
        type: "directory",
        sourcePath: join(this.uploadsDir, nocodeId),
        zipPath: "uploads",
      });
    }

    return entries;
  }

  private async copyNocodeUploadsExcludingAiFiles(nocodeId: string, destDir: string) {
    const sourceDir = join(this.uploadsDir, nocodeId);
    if (!await exists(sourceDir)) {
      return;
    }

    const aiAttachmentsDir = path.resolve(sourceDir, "_ai");
    await cp(sourceDir, destDir, {
      recursive: true,
      filter: (sourcePath) => {
        const resolvedPath = path.resolve(sourcePath);
        return resolvedPath !== aiAttachmentsDir;
      },
    });
    await rm(join(destDir, "_ai"), { recursive: true, force: true });
  }

  private async zipNocodeToFile(nocodeId: string, destFileDir: string, options: InternalZipNocodeOptions, account?: Partial<Account>) {
    const stageDir = path.join(os.tmpdir(), `banban_export_${Date.now()}_${unique()}`);
    try {
      await mkdir(stageDir, { recursive: true }).catch(()=>{});
      const nocode = await this.getNocodeMeta(nocodeId);
      const nocodeBody = deepClone(await getNocodeBody(this.nocodesDir, nocodeId));

      const missingConnections: Connection[] = [];
      const selectedRootTableUIDs = options.selectedTableUIDs?.length
        ? [...new Set(options.selectedTableUIDs)]
        : [];
      const selectedTableUIDs = selectedRootTableUIDs.length && nocodeBody.formData
        ? [...this.getCrossAppTableUIDs(nocodeBody.formData, selectedRootTableUIDs)]
        : [];
      const exportNocodeBody = (selectedRootTableUIDs.length || Array.isArray(options.selectedPageIDs))
        ? filterNocodeExportBody(nocodeBody, selectedRootTableUIDs, options.selectedPageIDs)
        : nocodeBody;

      const copiedIdMaps = options.rewriteCopyInternalIds
        ? buildCopiedNocodeInternalIdMaps(exportNocodeBody)
        : null;
      if (copiedIdMaps) {
        await this.copyPages(nocodeId, stageDir, exportNocodeBody.structure);
      }
      let exportRuntimeState = options.exportData
        ? pickRuntimeStateForNocodeBody(exportNocodeBody, await getNocodeRuntimeState(this.nocodesDir, nocodeId))
        : null;
      const exportedRowsByTable: Record<string, Row[]> = {};

      if (options.exportData && !isEmpty(exportNocodeBody.formData)) {
        const exportDataStageConfigs = this.getExportDataStageConfigs(options.exportDataStages);
        for (const config of exportDataStageConfigs) {
          const currentExportResult = await this.exportNocodeFormDataByChunks(
            exportNocodeBody,
            nocodeId,
            stageDir,
            options,
            config,
            selectedTableUIDs,
          );
          for (const [tableUID, rows] of Object.entries(currentExportResult.exportedRowsByTable)) {
            exportedRowsByTable[tableUID] = exportedRowsByTable[tableUID] || [];
            exportedRowsByTable[tableUID].push(...rows);
          }
        }
        if (options.rewriteCopyDataUUID && copiedIdMaps) {
          const copiedNocodeBody = applyCopiedNocodeInternalIdMaps(exportNocodeBody, copiedIdMaps);
          for (const config of exportDataStageConfigs) {
            await this.rewriteCopiedNocodeExportData(
              stageDir,
              config.relativeDir,
              exportNocodeBody.formData,
              copiedNocodeBody.formData,
              copiedIdMaps,
            );
          }
        }
      }
      let outputNocodeBody = exportNocodeBody;
      if (copiedIdMaps) {
        await this.rewriteCopiedNocodePackageFiles(stageDir, exportNocodeBody, copiedIdMaps);
        exportRuntimeState = this.remapCopiedRuntimeState(exportRuntimeState, copiedIdMaps);
        outputNocodeBody = applyCopiedNocodeInternalIdMaps(exportNocodeBody, copiedIdMaps);
      }

      outputNocodeBody.exportVersion = __APP_VERSION__;
      outputNocodeBody.exportId = nocodeId;
      outputNocodeBody.identifier = this.preferences.getIdentifier();
      const exportImportRestriction = (isEmpty(options.importRestriction) ? {} : options.importRestriction) as NonNullable<NocodeBody["importRestriction"]>;
      const originalAuthor = nocodeBody.importRestriction?.originalAuthor || this.buildNocodeImportOriginalAuthor(account);
      if (originalAuthor) {
        exportImportRestriction.originalAuthor = originalAuthor;
      }
      outputNocodeBody.importRestriction = isEmpty(exportImportRestriction) ? undefined : exportImportRestriction;
      if (!options.preservePermissions) {
        delete outputNocodeBody.permissions;
      }
      if (options.exportData && exportRuntimeState && !isEmpty(outputNocodeBody.formData)) {
        await this.writeExportRuntimeFile(stageDir, exportRuntimeState);
      }
      await this.writeExportMainFiles(
        stageDir,
        options.exportData
          ? mirrorRuntimeStateToNocodeBody(outputNocodeBody, exportRuntimeState)
          : stripRuntimeStateFromNocodeBody(outputNocodeBody),
      );

      const includeAllUploads = !!(options.exportData && options.exportDataType === "all");
      if (includeAllUploads) {
        await this.copyNocodeUploadsExcludingAiFiles(nocodeId, join(stageDir, "uploads"));
      }
      const zipEntries = await this.buildExportZipEntries(stageDir, outputNocodeBody, nocodeId, false);
      await createZipFromEntries(destFileDir, zipEntries);
      return { nocode, missingConnections, copiedIdMaps };
    } finally {
      await rm(stageDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 }).catch(() => {});
    }
  }

  async zipNocode(nocodeId: string, extname: string, options: ExportNocodeOptions, account?: Partial<Account>) {
    try {
      const nocode = await this.getNocodeMeta(nocodeId);
      const zipDir = path.join(os.tmpdir(), "static");
      if (!existsSync(zipDir)) {
        await mkdir(zipDir, {recursive:true});
      }
      const exportName = nocode.name + extname;
      const destFileDir = path.join(zipDir, exportName);
      await this.zipNocodeToFile(nocodeId, destFileDir, options, account);
      return {
        url: `/tmp/${exportName}`,
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  private async copyResolvedUploadResourceByUrls(urls: string[], srcDir: string, destDir: string) {
    await mkdir(destDir, { recursive: true }).catch(() => {});
    for (const url of Array.from(new Set((urls || []).filter(Boolean)))) {
      await cp(join(srcDir, url), join(destDir, basename(url)), { recursive: true }).catch(() => {
        this.logger.error(`copy upload resource error`, url);
      });
    }
  }

  private async copyUploadResourceByBuckets(buckets: Bucket[], srcDir: string, destDir: string) {
    const urls: string[] = [];
    for (const bucket of buckets) {
      const fields = bucket.fields.filter(f => ["html", "image", "file"].includes(f.meta.subType));
      for (const row of bucket.rows) {
        for (const field of fields) {
          const value = row[field.uid];
          if (Array.isArray(value)) {
            urls.push(...value.map(item => item.url)?.filter(Boolean));
          } else if (typeof value === "string") {
            const matches = [...value.matchAll(/src="(uploads[^"]+)"/g)];
            urls.push(...matches.map(m => m[1]));
          }
        }
      }
    }

    await this.copyResolvedUploadResourceByUrls(urls, srcDir, destDir);
  }

  private transformCatalog(catalog: ProjectNode[]) {
    return catalog.map(item => {
      if (item.type === "folder") {
        item.children = this.transformCatalog(item.children);
        item.type = NocodeStructureType.GROUP;
      } else {
        item.type = NocodeStructureType.PAGE;
      }
      return item;
    })
  }

  private replaceNocodeIdInRows(rows: Row[], nocodeBody: NocodeBody, nocodeId: string) {
    const sourceNocodeId = nocodeBody.exportId;
    for (const row of rows) {
      replaceNocodeIdInRow(row, sourceNocodeId, nocodeId);
    }
    return rows;
  }

  private async rewriteCopiedNocodeExportData(
    stageDir: string,
    relativeDir: string,
    sourceFormData: NocodeFormData,
    copiedFormData: NocodeFormData,
    idMaps: CopiedNocodeInternalIdMaps,
  ) {
    const dataDir = join(stageDir, relativeDir, sourceFormData.uid);
    if (!existsSync(dataDir)) {
      return;
    }
    const uuidMap = await this.buildCopyDataUuidMap(dataDir, sourceFormData);
    const unresolvedLocalUuidMap: CopyDataUuidSetMap = new Map();
    await this.rewriteCopyDataChunks(dataDir, sourceFormData, copiedFormData, idMaps, uuidMap, unresolvedLocalUuidMap);
    await this.validateCopyDataReferences(dataDir, copiedFormData, uuidMap, idMaps, unresolvedLocalUuidMap);
    const copiedDataDir = join(stageDir, relativeDir, copiedFormData.uid);
    if (dataDir !== copiedDataDir) {
      await rm(copiedDataDir, { recursive: true, force: true }).catch(() => {});
      await rename(dataDir, copiedDataDir);
    }
  }

  private async buildCopyDataUuidMap(dataDir: string, formData: NocodeFormData): Promise<CopyDataUuidMap> {
    const uuidMap: CopyDataUuidMap = new Map();
    const usedUuidSet = new Set<string>();
    await iterateImportBucketsByChunks(dataDir, this.importDataChunkSize, async ({ bucket, rows }) => {
      const tableUID = bucket.tableId as TableUID;
      const table = formData.tables?.find(item => item.uid === tableUID);
      const uuidField = table ? getUUIDSystemField(table.fields) : null;
      if (!table || !uuidField?.uid) {
        return;
      }
      let tableMap = uuidMap.get(tableUID);
      if (!tableMap) {
        tableMap = new Map<string, string>();
        uuidMap.set(tableUID, tableMap);
      }
      for (const row of rows || []) {
        const oldUuid = String(row?.[uuidField.uid] || "").trim();
        if (!oldUuid || tableMap.has(oldUuid)) {
          continue;
        }
        tableMap.set(oldUuid, "");
        usedUuidSet.add(oldUuid);
      }
    });
    for (const tableMap of uuidMap.values()) {
      for (const [oldUuid] of tableMap.entries()) {
        tableMap.set(oldUuid, this.generateCopyDataUuid(usedUuidSet));
      }
    }
    return uuidMap;
  }

  private generateCopyDataUuid(usedUuidSet: Set<string>) {
    let nextUuid = unique(12);
    while (usedUuidSet.has(nextUuid)) {
      nextUuid = unique(12);
    }
    usedUuidSet.add(nextUuid);
    return nextUuid;
  }

  private async rewriteCopyDataChunks(
    dataDir: string,
    sourceFormData: NocodeFormData,
    copiedFormData: NocodeFormData,
    idMaps: CopiedNocodeInternalIdMaps,
    uuidMap: CopyDataUuidMap,
    unresolvedLocalUuidMap: CopyDataUuidSetMap,
  ) {
    const filenames = (await readdir(dataDir))
      .filter(filename => /\.json$/i.test(filename))
      .sort((a, b) => a.localeCompare(b));
    for (const filename of filenames) {
      const filePath = join(dataDir, filename);
      const content = await readFile(filePath, "utf-8");
      const bucket = JSON.parse(content) as Bucket;
      const sourceTableUID = bucket.tableId as TableUID;
      const sourceTable = sourceFormData.tables?.find(item => item.uid === sourceTableUID);
      const copiedTableUID = idMaps.uidMap[sourceTableUID] as TableUID || sourceTableUID;
      const copiedTable = copiedFormData.tables?.find(item => item.uid === copiedTableUID);
      if (!sourceTable || !copiedTable || !Array.isArray(bucket.rows)) {
        continue;
      }
      const context: RewriteCopyRowContext = {
        sourceFormData,
        copiedFormData,
        idMaps,
        uuidMap,
        unresolvedLocalUuidMap,
        currentSourceTableUID: sourceTableUID,
      };
      bucket.tableId = copiedTableUID;
      bucket.fields = copiedTable.fields;
      bucket.rows = bucket.rows.map(row => {
        const nextRow = this.rewriteCopyRowReferences(sourceTable, deepClone(row), context);
        return this.remapCopyRowFieldKeys(nextRow, sourceTable, context);
      }).filter(Boolean);
      await writeFile(filePath, JSON.stringify(bucket));
    }
  }

  private rewriteCopyRowReferences(table: Table, row: Row, context: RewriteCopyRowContext) {
    const uuidField = getUUIDSystemField(table.fields);
    const currentUuid = uuidField?.uid ? String(row?.[uuidField.uid] || "").trim() : "";
    if (uuidField?.uid && currentUuid) {
      const currentMap = context.uuidMap.get(context.currentSourceTableUID);
      const nextUuid = currentMap?.get(currentUuid);
      if (!nextUuid) {
        throw new Error(`copy data uuid map missing: ${context.currentSourceTableUID}:${currentUuid}`);
      }
      row[uuidField.uid] = nextUuid;
    }

    for (const field of table.fields || []) {
      const widgetType = field?.meta?.extra?.widgetType;
      if (widgetType === FormWidgetType.RELATED_DATA) {
        const relatedTableUID = field?.meta?.extra?.relatedTableUID?.[1] as TableUID | undefined;
        if (!relatedTableUID || !Array.isArray(row?.[field.uid])) {
          continue;
        }
        const isLocalRelatedTable = this.isCopyDataLocalTable(context.sourceFormData, relatedTableUID);
        const relatedMap = context.uuidMap.get(relatedTableUID);
        row[field.uid] = row[field.uid].map((item: string) => {
          const oldUuid = String(item || "").trim();
          if (!oldUuid) return item;
          if (!isLocalRelatedTable) {
            return oldUuid;
          }
          const nextUuid = relatedMap?.get(oldUuid);
          if (!nextUuid) {
            this.addCopyDataUuidSetValue(context.unresolvedLocalUuidMap, relatedTableUID, oldUuid, context.idMaps);
            return oldUuid;
          }
          return nextUuid;
        });
        continue;
      }

      const subTableUID = field?.meta?.extra?.subTableUID?.[1] as TableUID | undefined;
      if (!subTableUID || !Array.isArray(row?.[field.uid])) {
        continue;
      }
      const subTable = context.sourceFormData.tables?.find(item => item.uid === subTableUID);
      if (!subTable) {
        continue;
      }
      row[field.uid] = row[field.uid].map((subRow: Row) => {
        const nextSubRow = this.rewriteCopyRowReferences(subTable, deepClone(subRow), {
          ...context,
          currentSourceTableUID: subTableUID,
        });
        const relationField = subTable.fields.find(item => item.meta?.name === SystemField.KEY);
        if (relationField?.uid && currentUuid) {
          const currentMap = context.uuidMap.get(context.currentSourceTableUID);
          const nextUuid = currentMap?.get(currentUuid);
          if (!nextUuid) {
            throw new Error(`copy sub table relation uuid map missing: ${context.currentSourceTableUID}:${currentUuid}`);
          }
          nextSubRow[relationField.uid] = nextUuid;
        }
        return nextSubRow;
      });
    }

    const relationField = table.fields.find(item => item.meta?.name === SystemField.KEY);
    if (relationField?.uid && typeof row?.[relationField.uid] === "string") {
      const parentTableUID = this.resolveSubTableParentUID(context.sourceFormData, context.currentSourceTableUID);
      const parentMap = parentTableUID ? context.uuidMap.get(parentTableUID) : null;
      const oldRelationValue = String(row[relationField.uid] || "").trim();
      if (oldRelationValue && parentMap?.has(oldRelationValue)) {
        row[relationField.uid] = parentMap.get(oldRelationValue);
      }
    }

    return row;
  }

  private remapCopyRowFieldKeys(row: Row, sourceTable: Table, context: RewriteCopyRowContext) {
    if (!row) {
      return row;
    }
    const nextRow: Row = {};
    for (const [key, value] of Object.entries(row)) {
      const sourceField = sourceTable.fields?.find(field => field.uid === key);
      if (sourceField?.meta?.extra?.subTableUID?.[1]) {
        continue;
      }
      const nextKey = context.idMaps.uidMap[key] || key;
      nextRow[nextKey] = value;
    }
    return nextRow;
  }

  private resolveSubTableParentUID(formData: NocodeFormData, subTableUID: TableUID) {
    return formData.tables?.find(table => table.uid === subTableUID)?.meta?.extra?.primaryTable?.[1];
  }

  private async rewriteCopiedNocodePackageFiles(stageDir: string, sourceBody: NocodeBody, idMaps: CopiedNocodeInternalIdMaps) {
    await this.rewriteCopiedStagePageBodies(stageDir, idMaps);
    await this.rewriteCopiedStageFormReleaseBodies(stageDir, sourceBody?.formData?.tables?.map(table => table.uid) || [], idMaps);
  }

  private async rewriteCopiedStagePageBodies(stageDir: string, idMaps: CopiedNocodeInternalIdMaps) {
    const pagesDir = join(stageDir, "projects");
    if (!await exists(pagesDir)) {
      return;
    }
    for (const [sourcePageId, copiedPageId] of Object.entries(idMaps.pageIdMap || {}) as [string, string][]) {
      const sourcePageDir = join(pagesDir, sourcePageId);
      const copiedPageDir = join(pagesDir, copiedPageId);
      if (sourcePageId !== copiedPageId && await exists(sourcePageDir)) {
        await rename(sourcePageDir, copiedPageDir);
      }
      if (!await exists(copiedPageDir)) {
        continue;
      }
      const pageBody = await getProjectBody(pagesDir, copiedPageId).catch(() => null);
      if (pageBody) {
        await saveProjectBody(pagesDir, copiedPageId, remapCopiedPageBodyInternalIds(pageBody, idMaps));
      }
      const releaseDir = join(copiedPageDir, "release");
      if (!await exists(releaseDir)) {
        continue;
      }
      const releaseBody = await getProjectBody(pagesDir, copiedPageId, false).catch(() => null);
      if (releaseBody) {
        await writeProjectBody(releaseDir, remapCopiedPageBodyInternalIds(releaseBody, idMaps), copiedPageId);
      }
    }
  }

  private async rewriteCopiedStageFormReleaseBodies(stageDir: string, sourceTableUIDs: TableUID[], idMaps: CopiedNocodeInternalIdMaps) {
    const formsReleaseDir = join(stageDir, "release", "forms");
    if (!await exists(formsReleaseDir)) {
      return;
    }
    for (const sourceTableUID of sourceTableUIDs || []) {
      const copiedTableUID = idMaps?.uidMap?.[sourceTableUID] as TableUID | undefined;
      if (!copiedTableUID) {
        continue;
      }
      const sourceReleaseDir = join(formsReleaseDir, sourceTableUID);
      const copiedReleaseDir = join(formsReleaseDir, copiedTableUID);
      if (sourceTableUID !== copiedTableUID && await exists(sourceReleaseDir)) {
        await rename(sourceReleaseDir, copiedReleaseDir);
      }
      if (!await exists(copiedReleaseDir)) {
        continue;
      }
      const releaseBody = await getFormReleaseNocodeBody(stageDir, ".", copiedTableUID).catch(() => null);
      if (releaseBody) {
        await saveFormReleaseNocodeBody(stageDir, ".", copiedTableUID, applyCopiedNocodeInternalIdMaps(releaseBody, idMaps));
      }
    }
  }

  private remapCopiedRuntimeState(
    runtimeState: ReturnType<typeof createEmptyRuntimeState> | null,
    idMaps: CopiedNocodeInternalIdMaps,
  ) {
    if (!runtimeState) {
      return runtimeState;
    }
    return replaceUID(deepClone(runtimeState), idMaps.uidMap);
  }

  private addCopyDataUuidSetValue(
    uuidSetMap: CopyDataUuidSetMap,
    tableUID: TableUID,
    uuid: string,
    idMaps?: CopiedNocodeInternalIdMaps,
  ) {
    const tableUIDs = [tableUID, idMaps?.uidMap?.[tableUID] as TableUID | undefined].filter(Boolean) as TableUID[];
    for (const currentTableUID of tableUIDs) {
      let uuidSet = uuidSetMap.get(currentTableUID);
      if (!uuidSet) {
        uuidSet = new Set<string>();
        uuidSetMap.set(currentTableUID, uuidSet);
      }
      uuidSet.add(uuid);
    }
  }

  private isCopyDataLocalTable(formData: NocodeFormData, tableUID?: TableUID) {
    return !!tableUID && !!formData.tables?.some(item => item.uid === tableUID);
  }

  private buildCopyDataUuidValueMap(uuidMap: CopyDataUuidMap, idMaps?: CopiedNocodeInternalIdMaps) {
    const uuidValueMap = new Map<TableUID, Set<string>>();
    for (const [tableUID, tableMap] of uuidMap.entries()) {
      uuidValueMap.set(tableUID, new Set(tableMap.values()));
      const copiedTableUID = idMaps?.uidMap?.[tableUID] as TableUID | undefined;
      if (copiedTableUID) {
        uuidValueMap.set(copiedTableUID, new Set(tableMap.values()));
      }
    }
    return uuidValueMap;
  }

  private async validateCopyDataReferences(
    dataDir: string,
    formData: NocodeFormData,
    uuidMap: CopyDataUuidMap,
    idMaps?: CopiedNocodeInternalIdMaps,
    unresolvedLocalUuidMap?: CopyDataUuidSetMap,
  ) {
    const uuidValueMap = this.buildCopyDataUuidValueMap(uuidMap, idMaps);
    await iterateImportBucketsByChunks(dataDir, this.importDataChunkSize, async ({ bucket, rows }) => {
      const tableUID = bucket.tableId as TableUID;
      const table = formData.tables?.find(item => item.uid === tableUID);
      if (!table) {
        return;
      }
      for (const row of rows || []) {
        for (const field of table.fields || []) {
          if (field?.meta?.extra?.widgetType === FormWidgetType.RELATED_DATA && Array.isArray(row?.[field.uid])) {
            const relatedTableUID = field?.meta?.extra?.relatedTableUID?.[1] as TableUID | undefined;
            if (!this.isCopyDataLocalTable(formData, relatedTableUID)) {
              continue;
            }
            const relatedUuidSet = relatedTableUID ? uuidValueMap.get(relatedTableUID) : null;
            const unresolvedLocalUuidSet = relatedTableUID ? unresolvedLocalUuidMap?.get(relatedTableUID) : null;
            for (const value of row[field.uid]) {
              const relatedUuid = String(value || "").trim();
              if (relatedUuid && !relatedUuidSet?.has(relatedUuid) && !unresolvedLocalUuidSet?.has(relatedUuid)) {
                throw new Error(`copy related data invalid: ${relatedTableUID}:${relatedUuid}`);
              }
            }
          }
        }
        const relationField = table.fields.find(item => item.meta?.name === SystemField.KEY);
        if (relationField?.uid) {
          const relationValue = String(row?.[relationField.uid] || "").trim();
          if (!relationValue) {
            continue;
          }
          const parentTableUID = this.resolveSubTableParentUID(formData, tableUID);
          const parentUuidSet = parentTableUID ? uuidValueMap.get(parentTableUID) : null;
          if (parentUuidSet && !parentUuidSet.has(relationValue)) {
            throw new Error(`copy sub table relation invalid: ${parentTableUID}:${relationValue}`);
          }
        }
      }
    });
  }

  private getNocodeImportFailureReason(err: unknown) {
    return err instanceof Error ? err.message : String(err);
  }

  private getImportDataLocation(nocodeId: string, formDataUid: string, relativeDir: string) {
    const nocodeDir = join(this.nocodesDir, nocodeId);
    return {
      chunkDir: join(nocodeDir, relativeDir, formDataUid),
      dataPath: join(nocodeDir, relativeDir, `${formDataUid}.json`),
    };
  }

  private mergeImportDataSummaries(items: Array<NocodeImportDataSummary | undefined>): NocodeImportDataSummary | undefined {
    const summaries = items.filter(Boolean) as NocodeImportDataSummary[];
    if (!summaries.length) {
      return;
    }
    const failures = summaries.flatMap(item => item.failures || []);
    return {
      totalCount: summaries.reduce((sum, item) => sum + (item.totalCount || 0), 0),
      successCount: summaries.reduce((sum, item) => sum + (item.successCount || 0), 0),
      failedCount: failures.length,
      failures: failures.length ? failures : undefined,
    };
  }

  private async importNocodeDataByRelativeDir(
    nocodeId: string,
    nocodeBody: NocodeBody,
    relativeDir: string,
    importBucket: (formData: NocodeFormData, nocodeId: string, bucket: Bucket, rows: Row[], keepSubmitter: boolean) => Promise<NocodeImportBucketResult>,
    afterBucket?: (tableUID: TableUID) => Promise<void> | void,
  ): Promise<NocodeImportDataSummary | undefined> {
    const formData = nocodeBody.formData;
    if (!formData) return;
    const { chunkDir, dataPath } = this.getImportDataLocation(nocodeId, formData.uid, relativeDir);
    if (!existsSync(chunkDir) && !existsSync(dataPath)) return;
    let totalCount = 0;
    let successCount = 0;
    const failures: NocodeImportDataFailureItem[] = [];

    try {
      const identifier = this.preferences.getIdentifier();
      const keepSubmitter = identifier === nocodeBody.identifier;
      const tableRowOffsets = new Map<string, number>();
      await iterateImportBucketsByChunks(existsSync(chunkDir) ? chunkDir : dataPath, this.importDataChunkSize, async ({ bucket, rows, rowStartIndex }) => {
        if (isEmpty(rows)) {
          return;
        }
        const table = formData.tables?.find(item => item.uid === bucket.tableId);
        const normalizedRows = stripNocodeFlowRuntimeFields(
          this.replaceNocodeIdInRows(rows, nocodeBody, nocodeId),
          table,
        );
        if (isEmpty(normalizedRows)) {
          return;
        }
        const result = await importBucket(formData, nocodeId, {
          ...bucket,
          rows: normalizedRows,
        } as Bucket, normalizedRows, keepSubmitter);
        totalCount += result.totalCount;
        successCount += result.successCount;
        if (!isEmpty(result.failures)) {
          const baseRowOffset = tableRowOffsets.get(bucket.tableId) ?? rowStartIndex;
          result.failures.forEach((item) => {
            if (item.rowIndex > 0) {
              item.rowIndex += baseRowOffset;
            }
          });
          failures.push(...result.failures);
        }
        tableRowOffsets.set(bucket.tableId, (tableRowOffsets.get(bucket.tableId) ?? 0) + rows.length);
        await afterBucket?.(bucket.tableId as TableUID);
      });
    } finally {
      await rm(dataPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
      await rm(chunkDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
    }

    return {
      totalCount,
      successCount,
      failedCount: failures.length,
      failures: failures.length ? failures : undefined,
    };
  }

  private async importBucketDataWithFallback(
    formData: NocodeFormData,
    nocodeId: string,
    bucket: Bucket,
    rows: Row[],
    keepSubmitter: boolean,
  ): Promise<NocodeImportBucketResult> {
    if (isEmpty(rows)) {
      return {
        totalCount: 0,
        successCount: 0,
        failures: [],
        successRowUUIDs: [],
      };
    }

    const table = formData.tables?.find(item => item.uid === bucket.tableId);
    const tableName = bucket.tableName || table?.alias || table?.meta?.name || String(bucket.tableId || "");
    const uuidField = table ? getUUIDSystemField(table.fields) : null;
    const getRowUUID = (row?: Row | null) => {
      return uuidField?.uid
        ? String(row?.[uuidField.uid] || "").trim()
        : "";
    };

    try {
      await this.formDataService.addData(
        formData,
        nocodeId,
        bucket.tableId as TableUID,
        rows,
        { validatePermission: false, triggerTodo: false, skipSubscribeTaskUpdate: true },
        {
          keepSubmitter,
          overrideStage: FormDataStage.NORMAL,
          uniqueValidation: { skipValidation: true },
        },
      );
      return {
        totalCount: rows.length,
        successCount: rows.length,
        failures: [],
        successRowUUIDs: Array.from(new Set(
          rows
            .map((row) => getRowUUID(row))
            .filter(Boolean),
        )),
      };
    } catch (err) {
      if ((err as Error & { mutationCommitted?: boolean })?.mutationCommitted === true) {
        return {
          totalCount: rows.length,
          successCount: 0,
          failures: [{
            tableId: String(bucket.tableId || ""),
            tableName,
            rowIndex: 0,
            reason: this.getNocodeImportFailureReason(err),
          }],
          successRowUUIDs: [],
        };
      }
      this.logger.warn(`import nocode bucket fallback: ${tableName}`, this.getNocodeImportFailureReason(err));
    }

    const failures: NocodeImportDataFailureItem[] = [];
    const successRowUUIDs = new Set<string>();
    let successCount = 0;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      try {
        await this.formDataService.addData(
          formData,
          nocodeId,
          bucket.tableId as TableUID,
          [row],
          { validatePermission: false, triggerTodo: false, skipSubscribeTaskUpdate: true },
          {
            keepSubmitter,
            overrideStage: FormDataStage.NORMAL,
            uniqueValidation: { skipValidation: true },
          },
        );
        successCount += 1;
        const rowUUID = getRowUUID(row);
        if (rowUUID) {
          successRowUUIDs.add(rowUUID);
        }
      } catch (err) {
        failures.push({
          tableId: String(bucket.tableId || ""),
          tableName,
          rowIndex: index + 1,
          rowUUID: uuidField?.uid ? row?.[uuidField.uid] : undefined,
          reason: this.getNocodeImportFailureReason(err),
        });
      }
    }

    return {
      totalCount: rows.length,
      successCount,
      failures,
      successRowUUIDs: Array.from(successRowUUIDs),
    };
  }

  private async importRecycleBucketDataWithFallback(
    formData: NocodeFormData,
    nocodeId: string,
    bucket: Bucket,
    rows: Row[],
    keepSubmitter: boolean,
  ): Promise<NocodeImportBucketResult> {
    if (isEmpty(rows)) {
      return {
        totalCount: 0,
        successCount: 0,
        failures: [],
        successRowUUIDs: [],
      };
    }

    const table = formData.tables?.find(item => item.uid === bucket.tableId);
    const tableName = bucket.tableName || table?.alias || table?.meta?.name || String(bucket.tableId || "");
    const uuidField = table ? getUUIDSystemField(table.fields) : null;
    const getRowUUID = (row?: Row | null) => {
      return uuidField?.uid
        ? String(row?.[uuidField.uid] || "").trim()
        : "";
    };

    try {
      await this.formDataService.addData(
        formData,
        nocodeId,
        bucket.tableId as TableUID,
        rows,
        { validatePermission: false, triggerTodo: false },
        {
          keepSubmitter,
          overrideStage: FormDataStage.DELETED,
          uniqueValidation: { skipValidation: true },
        },
      );
      return {
        totalCount: rows.length,
        successCount: rows.length,
        failures: [],
        successRowUUIDs: Array.from(new Set(
          rows
            .map((row) => getRowUUID(row))
            .filter(Boolean),
        )),
      };
    } catch (err) {
      if ((err as Error & { mutationCommitted?: boolean })?.mutationCommitted === true) {
        return {
          totalCount: rows.length,
          successCount: 0,
          failures: [{
            tableId: String(bucket.tableId || ""),
            tableName,
            rowIndex: 0,
            reason: this.getNocodeImportFailureReason(err),
          }],
          successRowUUIDs: [],
        };
      }
      this.logger.warn(`import nocode recycle bucket fallback: ${tableName}`, this.getNocodeImportFailureReason(err));
    }

    const failures: NocodeImportDataFailureItem[] = [];
    const successRowUUIDs = new Set<string>();
    let successCount = 0;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      try {
        await this.formDataService.addData(
          formData,
          nocodeId,
          bucket.tableId as TableUID,
          [row],
          { validatePermission: false, triggerTodo: false },
          {
            keepSubmitter,
            overrideStage: FormDataStage.DELETED,
            uniqueValidation: { skipValidation: true },
          },
        );
        successCount += 1;
        const rowUUID = getRowUUID(row);
        if (rowUUID) {
          successRowUUIDs.add(rowUUID);
        }
      } catch (err) {
        failures.push({
          tableId: String(bucket.tableId || ""),
          tableName,
          rowIndex: index + 1,
          rowUUID: uuidField?.uid ? row?.[uuidField.uid] : undefined,
          reason: this.getNocodeImportFailureReason(err),
        });
      }
    }

    return {
      totalCount: rows.length,
      successCount,
      failures,
      successRowUUIDs: Array.from(successRowUUIDs),
    };
  }

  private async importDraftBucketDataWithFallback(
    formData: NocodeFormData,
    nocodeId: string,
    bucket: Bucket,
    rows: Row[],
  ): Promise<NocodeImportBucketResult> {
    if (isEmpty(rows)) {
      return {
        totalCount: 0,
        successCount: 0,
        failures: [],
        successRowUUIDs: [],
      };
    }

    const table = formData.tables?.find(item => item.uid === bucket.tableId);
    const tableName = bucket.tableName || table?.alias || table?.meta?.name || String(bucket.tableId || "");
    const uuidField = table ? getUUIDSystemField(table.fields) : null;
    const getRowUUID = (row?: Row | null) => {
      return uuidField?.uid
        ? String(row?.[uuidField.uid] || "").trim()
        : "";
    };

    try {
      await this.formDataService.addDraftData(
        formData,
        nocodeId,
        bucket.tableId as TableUID,
        rows,
      );
      return {
        totalCount: rows.length,
        successCount: rows.length,
        failures: [],
        successRowUUIDs: Array.from(new Set(
          rows
            .map((row) => getRowUUID(row))
            .filter(Boolean),
        )),
      };
    } catch (err) {
      if ((err as Error & { mutationCommitted?: boolean })?.mutationCommitted === true) {
        return {
          totalCount: rows.length,
          successCount: 0,
          failures: [{
            tableId: String(bucket.tableId || ""),
            tableName,
            rowIndex: 0,
            reason: this.getNocodeImportFailureReason(err),
          }],
          successRowUUIDs: [],
        };
      }
      this.logger.warn(`import nocode draft bucket fallback: ${tableName}`, this.getNocodeImportFailureReason(err));
    }

    const failures: NocodeImportDataFailureItem[] = [];
    const successRowUUIDs = new Set<string>();
    let successCount = 0;
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      try {
        await this.formDataService.addDraftData(
          formData,
          nocodeId,
          bucket.tableId as TableUID,
          [row],
        );
        successCount += 1;
        const rowUUID = getRowUUID(row);
        if (rowUUID) {
          successRowUUIDs.add(rowUUID);
        }
      } catch (err) {
        failures.push({
          tableId: String(bucket.tableId || ""),
          tableName,
          rowIndex: index + 1,
          rowUUID: uuidField?.uid ? row?.[uuidField.uid] : undefined,
          reason: this.getNocodeImportFailureReason(err),
        });
      }
    }

    return {
      totalCount: rows.length,
      successCount,
      failures,
      successRowUUIDs: Array.from(successRowUUIDs),
    };
  }

  private async importNocodeSubmittedDataWithDetails(
    nocodeId: string,
    nocodeBody: NocodeBody,
  ): Promise<ImportedNocodeDataResult | undefined> {
    const formData = nocodeBody.formData;
    if (!formData) return;
    const { chunkDir, dataPath } = this.getImportDataLocation(nocodeId, formData.uid, "data");
    if (!existsSync(chunkDir) && !existsSync(dataPath)) return;
    let totalCount = 0;
    let successCount = 0;
    const failures: NocodeImportDataFailureItem[] = [];
    const importedRowsByTable: Record<string, Set<string>> = {};

    try {
      const identifier = this.preferences.getIdentifier();
      const keepSubmitter = identifier === nocodeBody.identifier;
      const tableRowOffsets = new Map<string, number>();
      await iterateImportBucketsByChunks(existsSync(chunkDir) ? chunkDir : dataPath, this.importDataChunkSize, async ({ bucket, rows, rowStartIndex }) => {
        if (isEmpty(rows)) {
          return;
        }
        const table = formData.tables?.find(item => item.uid === bucket.tableId);
        const normalizedRows = stripNocodeFlowRuntimeFields(
          this.replaceNocodeIdInRows(rows, nocodeBody, nocodeId),
          table,
        );
        if (isEmpty(normalizedRows)) {
          return;
        }
        const result = await this.importBucketDataWithFallback(
          formData,
          nocodeId,
          {
            ...bucket,
            rows: normalizedRows,
          } as Bucket,
          normalizedRows,
          keepSubmitter,
        );
        totalCount += result.totalCount;
        successCount += result.successCount;
        if (result.successRowUUIDs.length) {
          importedRowsByTable[bucket.tableId] = importedRowsByTable[bucket.tableId] || new Set<string>();
          result.successRowUUIDs.forEach((rowUUID) => importedRowsByTable[bucket.tableId].add(rowUUID));
        }
        if (!isEmpty(result.failures)) {
          const baseRowOffset = tableRowOffsets.get(bucket.tableId) ?? rowStartIndex;
          result.failures.forEach((item) => {
            if (item.rowIndex > 0) {
              item.rowIndex += baseRowOffset;
            }
          });
          failures.push(...result.failures);
        }
        tableRowOffsets.set(bucket.tableId, (tableRowOffsets.get(bucket.tableId) ?? 0) + rows.length);
      });
    } finally {
      await rm(dataPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
      await rm(chunkDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
    }

    return {
      summary: {
        totalCount,
        successCount,
        failedCount: failures.length,
        failures: failures.length ? failures : undefined,
      },
      importedRowsByTable,
    };
  }

  async importNocodeSubmittedData(nocodeId: string, nocodeBody: NocodeBody, account: Account): Promise<NocodeImportDataSummary | undefined> {
    return (await this.importNocodeSubmittedDataWithDetails(nocodeId, nocodeBody))?.summary;
  }

  async importNocodeRecycleData(nocodeId: string, nocodeBody: NocodeBody, account: Account): Promise<NocodeImportDataSummary | undefined> {
    return await this.importNocodeDataByRelativeDir(
      nocodeId,
      nocodeBody,
      "data-recycle",
      this.importRecycleBucketDataWithFallback.bind(this),
    );
  }

  async importNocodeDraftData(nocodeId: string, nocodeBody: NocodeBody, account: Account): Promise<NocodeImportDataSummary | undefined> {
    const importedTableUIDs = new Set<TableUID>();
    const result = await this.importNocodeDataByRelativeDir(
      nocodeId,
      nocodeBody,
      "data-draft",
      async (formData, currentNocodeId, bucket, rows) => await this.importDraftBucketDataWithFallback(formData, currentNocodeId, bucket, rows),
      async (tableUID) => {
        importedTableUIDs.add(tableUID);
      },
    );
    for (const tableUID of importedTableUIDs) {
      await this.draftStorageStateService.setTableStatus(nocodeId, tableUID, "separated");
    }
    return result;
  }

  async importNocodeData(nocodeId: string, nocodeBody: NocodeBody, account: Account): Promise<NocodeImportDataSummary | undefined> {
    return await this.importNocodeSubmittedData(nocodeId, nocodeBody, account);
  }


  async importNocode(importPath: string, options: InternalImportNocodeOptions, account?: Account): Promise<ImportNocodeResult> {
    const nocodeFile = new NocodeFile(importPath);
    let createdNocodeId = "";
    try {
      const unzipDir = await nocodeFile.unzipFile();
      let nocodeBody = await nocodeFile.getNocodeBody();
      delete nocodeBody.exportVersion;
      const importRestriction = isEmpty(nocodeBody.importRestriction) ? undefined : nocodeBody.importRestriction;
      const extname = path.extname(options.filename);
      const nocodeName = path.basename(options.filename, extname);
      if (!this.canImportExpiredNocode(importRestriction, account)) {
        throw new Error(NOCODE_IMPORT_EXPIRED_ERROR);
      }

      //创建nocodeMeta
      const nocodeMeta = new NocodeEntity();
      nocodeMeta.name = nocodeName;
      nocodeMeta.parent = options.parentId ?? "";
      nocodeMeta.groupId = options.groupId ?? "";
      nocodeMeta.importRestriction = importRestriction;
      await this.applyCopyNocodeMetaOverrides(nocodeMeta, options.metaOverrides);
      await this.nocodeRepository.persistAndFlush(nocodeMeta);
      const nocodeId = nocodeMeta.id;
      createdNocodeId = nocodeId;
      const nocodeDir = path.join(this.nocodesDir, nocodeId);
      if(existsSync(nocodeDir)) await rm(nocodeDir, {recursive: true}) //删除之前的body数据
      // 导入nocode内的project
      
      const projectsDir = join(unzipDir, "projects");
      const catalog = await nocodeFile.readCatalog();
      // TODO 兼容旧版应用文件、将在后续版本中删除
      if (!isEmpty(catalog)) {
        nocodeBody.structure = this.transformCatalog(catalog) as NocodeStructure[];
        await rm(join(unzipDir, "catalog"));
      }
      const pagesDir = this.commonUtil.getPagesPath(nocodeId);
      if (existsSync(projectsDir)) {
        await cp(projectsDir, pagesDir, {recursive: true});
        await rm(projectsDir, {recursive: true});
      }

      if (await exists(join(unzipDir, "uploads"))) {
        const uploadsDir = join(this.uploadsDir, nocodeId);
        await cp(join(unzipDir, "uploads"), uploadsDir, { recursive: true });
        await rm(join(unzipDir, "uploads"), { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
      }

      const importDataStages = this.getDefaultImportDataStages(options.importDataStages);
      const hasImportedData = await exists(join(unzipDir, "data"))
        || await exists(join(unzipDir, "data-recycle"))
        || await exists(join(unzipDir, "data-draft"));
      await fs.cp(unzipDir, nocodeDir, {recursive: true});
      const importedRuntimeState = await readRuntimeState(nocodeDir);
      if (!options.preservePermissions) {
        delete nocodeBody?.permissions;
      }
      // 导入数据
      const importSubmittedData = importDataStages.submitted
        ? await this.importNocodeSubmittedDataWithDetails(nocodeId, nocodeBody)
        : undefined;
      const importRecycleData = importDataStages.recycle
        ? await this.importNocodeRecycleData(nocodeId, nocodeBody, account)
        : undefined;
      const importDraftData = importDataStages.draft
        ? await this.importNocodeDraftData(nocodeId, nocodeBody, account)
        : undefined;
      const importData = this.mergeImportDataSummaries([
        importSubmittedData?.summary,
        importRecycleData,
        importDraftData,
      ]);
      if (nocodeBody.printTemplate) {
        for (const tableId in nocodeBody.printTemplate) {
          const templates: PrintTemplate[] = nocodeBody.printTemplate[tableId];
          for (const template of templates) {
            if (template.file?.path) {
              template.file.path = template.file.path.replace(nocodeBody?.exportId, nocodeId)
            }
          }
        }
      }
      delete nocodeBody?.exportId;
      delete nocodeBody?.identifier;
      nocodeBody.importRestriction = importRestriction;
      this.applyCopyNocodeBodyOverrides(nocodeBody, options.metaOverrides);

      await this.scheduledTriggerRepository.stageScheduleChange(nocodeId, "import_pending");
      await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
      await this.scheduledTriggerRepository.queueScheduleChange(nocodeId, "import");
      if (importedRuntimeState) {
        await saveNocodeRuntimeState(this.nocodesDir, nocodeId, importedRuntimeState);
      } else if (hasImportedData && importData?.successCount) {
        const legacyRuntimeState = extractLegacyRuntimeStateFromNocodeBody(nocodeBody);
        if (legacyRuntimeState) {
          await saveNocodeRuntimeState(this.nocodesDir, nocodeId, legacyRuntimeState);
        }
      } else if (!hasImportedData) {
        await removeNocodeRuntimeState(this.nocodesDir, nocodeId);
      }
      await this.workbenchService.ensureNewAppAiPermission(nocodeId);
      await this.notifyAiWarmup(nocodeId, 'import');
      nocodeFile.destroy();
      return { meta: nocodeMeta, importData }
    } catch (err) {
      if (createdNocodeId && options.cleanupOnFailure) {
        await this.cleanupCopiedNocodeArtifacts(createdNocodeId);
      }
      nocodeFile.destroy();
      if (options.throwOnError) {
        throw err;
      }
      return { reason: err.message }
    }
  }

  private async initImportedNocode(nocodeId: string) {
    await this.scheduledTriggerRepository.queueScheduleChange(nocodeId, "import");
  }

  async importNocodeWithInit(importPath: string, options: ImportNocodeOptions, account: Account): Promise<ImportNocodeResult> {
    const result = await this.importNocode(importPath, options, account);
    if (result.meta?.id) {
      await this.initImportedNocode(result.meta.id);
    }
    return result;
  }

  async installTemplateAppFromUrl(url: string, options: ImportNocodeOptions, account: Account): Promise<ImportNocodeResult> {
    const rawFilename = options?.filename?.trim() || "template.bb";
    const fileExt = extname(rawFilename) || ".bb";
    const rawBaseName = path.basename(rawFilename, fileExt) || "template";
    const normalizedBaseName = sanitizeFilenameAdvanced(rawBaseName) || "template";
    const normalizedFilename = `${normalizedBaseName}${fileExt}`;
    const tempFilePath = join(tmpdir(), "banban-market-install", `${randomBytes(18).toString("hex")}${fileExt}`);

    try {
      await this.downloadFile(url, tempFilePath);
      return await this.importNocodeWithInit(tempFilePath, {
        ...options,
        filename: normalizedFilename,
      }, account);
    } finally {
      await unlink(tempFilePath).catch(() => null);
    }
  }

  async uploadPrintTemplate(file, fileName: string, nocodeId: string) {
    const extname = path.extname(fileName);
    const baseName = path.basename(fileName, extname);
    const filename = `${baseName}_${unique()}${extname}`;
    const printFilePath = `${nocodeId}/resources/${filename}`
    const printTemplateFilePath = join(this.nocodesDir, printFilePath);
    await cp(file.path, printTemplateFilePath, {recursive: true});
    await rm(file.path, {recursive: true});

    return { path: printFilePath.replace(/\\/g, "/") };
  }

  async updatePrintTemplate(nocodeId: string, tableId: string, printTemplate: PrintTemplate) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    if (!nocodeBody.printTemplate) {
      nocodeBody.printTemplate = {}
    }
    if (!nocodeBody.printTemplate[tableId]) {
      nocodeBody.printTemplate[tableId] = [];
    }
    const tempIndex = nocodeBody.printTemplate[tableId]?.findIndex(item => item.uid === printTemplate.uid);
    if (tempIndex > -1) {
      nocodeBody.printTemplate[tableId][tempIndex] = printTemplate;
    } else {
      nocodeBody.printTemplate[tableId].push(printTemplate);
    }
    return await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
  }

  async getAllPrintTemplate(nocodeId: string, tableId: string) { 
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    if (!nocodeBody.printTemplate) {
      return [];
    }
    return nocodeBody.printTemplate[tableId] || [];
  }

  async getFilteredPrintTemplate(nocodeId: string, tableId: string) { 
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    if (!nocodeBody.printTemplate) {
      return [];
    }
    const allPrintTemplate = nocodeBody.printTemplate[tableId] || [];
    
    const account = await this.formDataService.getAccount();
    // 如果是管理员账户，直接返回所有模板
    if (isSystemAdminAccount(account)) {
      return allPrintTemplate;
    }

    // 使用 map 和 Promise.all 来正确处理异步过滤
    const filterResults = await Promise.all(allPrintTemplate.map(async (template) => {
      const range = template.range;
      if (!range) return null;
      let isEmptyArray = (value: any) => Array.isArray(value) && value.length === 0;
      if (isEmptyArray(range.users) && isEmptyArray(range.roles) && isEmptyArray(range.departments)) {
        return template;
      }
      // 检查用户是否在允许的用户列表中
      if (range.users && range.users.includes(account.id)) {
        return template;
      }
      // 检查用户角色是否在允许的角色列表中
      if (range.roles && range.roles.some(role => account.roles.includes(role))) {
        return template;
      }
      // 检查用户部门是否在允许的部门列表中（包括子部门）
      if (range.departments && await this.workbenchService.isInDepartments(account.departments, range.departments)) {
        return template;
      }
      return null;
    }));

    // 根据过滤结果创建最终的过滤数组
    const filteredPrintTemplate = filterResults.filter(Boolean);

    return filteredPrintTemplate;
  }

  async copyPrintTemplate(nocodeId: string, tableId: string, printTemplateUID: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    // 查找要复制的目标模板
    const targetPrintTemplate = nocodeBody.printTemplate[tableId].find(template => template.uid === printTemplateUID);
    // 生成新的模板对象
    const newPrintTemplate = deepClone(targetPrintTemplate);
    newPrintTemplate.uid = unique();
    newPrintTemplate.name = global.i18next.t("projectServices.printTemplateCopyName", {
      name: targetPrintTemplate.name,
    });
    // 如果有文件关联，则复制文件
    if (targetPrintTemplate.file && targetPrintTemplate.file.path) {
      const originalFilePath = path.join(this.nocodesDir, targetPrintTemplate.file.path);
      const extname = path.extname(targetPrintTemplate.file.name);
      const baseName = path.basename(targetPrintTemplate.file.name, extname);
      const newFileName = `${baseName}${unique()}${extname}`;
      const newFilePath = `${nocodeId}/resource/${newFileName}`;
      const newFullFilePath = path.join(this.nocodesDir, newFilePath);
      // 复制文件到新位置
      await cp(originalFilePath, newFullFilePath, { recursive: true });
      // 更新新模板的文件信息
      newPrintTemplate.file = {
        ...targetPrintTemplate.file,
        path: newFilePath.replace(/\\/g, "/"),
        name: newFileName
      };
    }  
    // 将新模板添加到列表中
    nocodeBody.printTemplate[tableId].push(newPrintTemplate);
    // 保存更新后的nocode数据体
    await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
    
    return newPrintTemplate;
  }

  async deletePrintTemplate(nocodeId: string, tableId: string, printTemplateUID: string) {
    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId);
    const targetPrintTemplate = nocodeBody.printTemplate[tableId].find(template => template.uid === printTemplateUID);
    const filePath = this.nocodesDir + "/" + targetPrintTemplate.file.path
    await rm(filePath, { recursive: true });
    nocodeBody.printTemplate[tableId] = nocodeBody.printTemplate[tableId].filter(template => template.uid !== printTemplateUID);

    return await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
  }

  async getFormExportTemplateList(nocodeId: string, tableUID: TableUID) {
    const userDataPath = await getRuntime().getUserDataPath();
    const templateDir = join(userDataPath, "FormTemplates", nocodeId, tableUID);
    const jsonDir = join(templateDir, "main.json");
    if (!existsSync(jsonDir)) {
      return [];
    }
    const json = await readFile(jsonDir, "utf-8");
    const account = await this.formDataService.getAccount();
    const currentUserData = JSON.parse(json).filter(item => item.userId === account.id || !item.userId)
    return currentUserData;
  }

  private async preparePrintableRelatedSubFormData(
    nocodeId: string,
    formData: NocodeFormData,
    table: Table,
    rows: Row[],
    stage: FormDataStageWhereCondition,
  ) {
    const relatedSubForms = getPrintableRelatedSubForms(formData, table);
    const relatedSubFormFields = buildPrintableRelatedSubFormRuntimeFields(relatedSubForms);
    if (isEmpty(rows) || isEmpty(relatedSubFormFields)) {
      return {
        rows,
        fields: relatedSubFormFields,
      };
    }

    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField?.uid) {
      return {
        rows,
        fields: relatedSubFormFields,
      };
    }
    const rowUids = rows.map(row => row?.[uuidField.uid]).filter(Boolean);
    if (isEmpty(rowUids)) {
      return {
        rows,
        fields: relatedSubFormFields,
      };
    }

    const relatedRowsByTable: Record<TableUID, Row[]> = {};
    await Promise.all(Object.entries(relatedSubForms).map(async ([tableUID, relatedInfo]) => {
      const relatedTableUID = tableUID as TableUID;
      const filters = {
        [relatedTableUID]: [{
          $or: relatedInfo.fields.map(field => ({
            [field.uid]: {
              $in: rowUids,
            },
          })),
        }],
      };
      const buckets = await this.formDataService.getData(nocodeId, [relatedTableUID], {
        transformFormData: true,
        filters,
        stage,
        orderBy: SortType.ASC,
      });
      relatedRowsByTable[relatedTableUID] = buckets[0]?.rows || [];
    }));

    return {
      rows: attachPrintableRelatedSubFormRows(rows, uuidField.uid, relatedSubForms, relatedRowsByTable),
      fields: relatedSubFormFields,
    };
  }

  async getTemplateRender(nocodeId: string, tableId: TableUID, printTemplateUID: string, printTemplate: PrintTemplate, selectRowUids?: Array<string>) {
    // 获取项目数据
    const nocodeBody = await this.getNocodeBodyWithOtherDataSources(nocodeId);
    const resolveTableSource = (targetTableUID: TableUID) => {
      return getNocodeDataSourceTableByUID(nocodeBody, targetTableUID, { nocodeId }, true);
    };
    const tableSource = resolveTableSource(tableId);
    const formData = tableSource?.connection as NocodeFormData || nocodeBody.formData as NocodeFormData;
    const sourceNocodeId = tableSource?.connection?.nocodeId || nocodeId;
    const table = tableSource?.table || formData.tables.find(t => t.uid === tableId);

    // 根据printTemplateUID查找对应的打印模板
    let targetPrintTemplate: PrintTemplate = null;
    if (printTemplateUID) {
      const tablePrintTemplates = nocodeBody.printTemplate?.[tableId] || [];
      targetPrintTemplate = tablePrintTemplates.find(template => template.uid === printTemplateUID);
    } else if (printTemplate) {
      targetPrintTemplate = printTemplate;
    }
    if (!targetPrintTemplate) {
      throw new Error(`Print template with UID ${printTemplateUID} not found`);
    }

    // 获取打印人名字
    const printAccount = await this.formDataService.getAccount();
    const printOperator = printAccount.realname;
    // 获取打印时间
    const createTime = Date.now();

    // 获取数据
    let rows: Row[] = null;
    if (!selectRowUids) {
      const data = await this.formDataService.findOne(nocodeId, tableId, {
        fillSubTable: true,
        transformFormData: true,
        transformRelated: true,
        transformRelatedResultObject: true,
      });
      const rowsArr = Array.isArray(data) ? data : [data];
      rows = rowsArr.filter(row => !!row && typeof row === "object");
      if (isEmpty(rows)) throw new Error(global.i18next.t('projectServices.printTemplatePreviewNoData'));
    } else {
      // 根据selectRowUids获取选中的行数据
      const uuidField = getUUIDSystemField(table.fields);
      // 构造过滤条件，获取指定UID的行
      const filters = {
        [tableId]: [
          { [uuidField.uid]: { '$in': selectRowUids } }
        ]
      };
      // 使用formData服务获取数据
      const buckets = await this.formDataService.getData(nocodeId, [tableId], { 
        transformRelated: true,
        transformRelatedResultObject: true,
        transformFormData: true,
        fillSubTable: true,
        filters,
        stage: {
          $nin: [FormDataStage.DRAFT, FormDataStage.DELETED]
        }
      });
      let selectRows = buckets.find(item => item.tableId === tableId)?.rows || [];
      // 添加子表单数据
      if (isEmpty(selectRows)) throw new Error(global.i18next.t('projectServices.printFailStatusChangedTips'));

      rows = selectRows;
    }
    // 需要加载 关联表单的子表单数据
    const relatedFields = table.fields.filter(field => {
      return field?.meta?.extra?.widgetType === FormWidgetType.RELATED_DATA
    });
    for (const field of relatedFields) {
      const relatedTableUID = field.meta?.extra?.relatedTableUID;
      if (!Array.isArray(relatedTableUID)) continue;
      const relatedTableId = relatedTableUID[1];
      const relatedTableSource = resolveTableSource(relatedTableId);
      const relatedTable = relatedTableSource?.table;
      const relatedFormData = relatedTableSource?.connection as NocodeFormData;
      const relatedNocodeId = relatedTableSource?.connection?.nocodeId || nocodeId;
      if (!relatedTable || !relatedFormData) continue;
      for (const relatedTableField of relatedTable.fields) {
        if (relatedTableField.meta?.extra?.widgetType === FormWidgetType.SUBFORM) {
          for (const row of rows) {
            row[field.uid] = await this.formDataService.fillSubFormField(row[field.uid], relatedNocodeId, relatedTable, relatedFormData)
          }
        }
      }
    }


    rows = await this.formatPrintProcessSystemFields(nocodeId, table, formData, rows);

    // 为每条数据添加printOperator和printTime属性
    rows = rows.map(row => ({
      ...row,
      printOperator: printOperator,
      printTime: dayjs(createTime).format('YYYY-MM-DD HH:mm'),
    }));
    const aggregateFields = formData.metas?.[tableId]?.aggregateFields || [];
    const aggregateRuntimeFields = buildTableAggregateRuntimeFields(table.uid, aggregateFields);
    rows = fillPrintableTableAggregateFieldValues(rows, table, aggregateFields);
    const relatedSubFormPrintData = await this.preparePrintableRelatedSubFormData(
      nocodeId,
      formData,
      table,
      rows,
      { $nin: [FormDataStage.DRAFT, FormDataStage.DELETED] },
    );
    rows = relatedSubFormPrintData.rows;
    const relatedSubFormRuntimeFields = relatedSubFormPrintData.fields;

    // 数据排序
    const uidField = getUUIDSystemField(table.fields);
    rows = sortByIDArray(selectRowUids, rows, uidField.uid);
    if (this.isPrintFlowCommentTextTemplate(targetPrintTemplate)) {
      rows = await this.fillPrintFlowCommentText(nocodeId, table, rows, targetPrintTemplate.flowCommentRule);
    }
    rows = await this.fillPrintRowShareLinks(sourceNocodeId, table, rows, printAccount.id);

    let titleField;
    let titleValues = [];
    if (targetPrintTemplate.exportNameMode === PrintTemplateExportNameMode.DATA_TITLE) {
      // 如果使用数据标题命名方式，则获取标题字段的值并存入数组
      titleField = table.fields.find(field => field.meta.name === SystemField.DATA_TITLE);
      if (titleField) {
        rows.forEach(row => {
          const titleValue = row[titleField.uid];
          if (titleValue) {
            titleValues.push(titleValue);
          }
        });
      }
    }

    // 获取模板文件绝对路径
    let templateBuffer;
    if (targetPrintTemplate.file?.path) {
      const templatePath = join(this.nocodesDir, targetPrintTemplate.file?.path);
      const buffer = await readFile(templatePath);
      templateBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }

    if (!templateBuffer) {
      throw new Error(`Template file not found for print template UID ${printTemplateUID}`);
    }

    // 处理子表单
    const nestedFormData = (field: Field) => {
      const subTableUID: OptionTableUID = field.meta?.extra?.subTableUID;
      if (subTableUID) {
        const subTableId = subTableUID[1]
        const subTable = resolveTableSource(subTableId)?.table;
        if (!subTable) return field;
        field.subTableFields = subTable.fields.map(subField => ({ ...subField }));
      }
      return field
    }
    const nestedRelatedData = (field: Field) => {
      const relatedTableUID: OptionTableUID = field.meta?.extra?.relatedTableUID;
      if (relatedTableUID) {
        const subTableId = relatedTableUID[1]
        const subTable = resolveTableSource(subTableId)?.table;
        if (!subTable) return field;
        field.relatedTableFields = subTable.fields.map(subField => nestedFormData({ ...subField }));
      }
      return field
    }
    const fieldsArr = [
      ...table.fields,
      ...aggregateRuntimeFields,
      ...createPrintRowShareFields(),
      ...(this.isPrintFlowCommentTextTemplate(targetPrintTemplate) ? [createPrintFlowCommentField()] : []),
      ...relatedSubFormRuntimeFields].map(field => ({ ...field })).map(nestedFormData).map(nestedRelatedData)

    // 根据模板类型使用不同的处理方法
    let workbookArr;
    if (targetPrintTemplate.type === PrintTemplateType.EXCEL) {
      workbookArr = await replaceExcelTemplate(targetPrintTemplate, templateBuffer, rows, fieldsArr, {
        getDataPath: () => path.dirname(this.uploadsDir),
        readFile: async (path: string) => {
          const base64 = await readFile(path, "base64");
          return `data:image/png;base64,${base64}`
        },
        readFileToArrBuffer: async (path: string) => {
          const buffer = await readFile(path);
          return buffer.buffer as ArrayBuffer;
        },
        getImageDimensions: async (buffer: ArrayBuffer) => {
          const uint8Array: Uint8Array = new Uint8Array(buffer);
          const metadata = imageSize(uint8Array);
          if (metadata.width == null || metadata.height == null) {
            throw new Error('Failed to extract image dimensions');
          }
          return { width: metadata.width, height: metadata.height };
        },
        getParser: () => new DOMParser(),
        formOptions: formData.formOptions,
        formTableUID: tableId,
      });
    } else if (targetPrintTemplate.type === PrintTemplateType.WORD) {
      workbookArr = await replaceDocxTemplate(
        targetPrintTemplate,
        templateBuffer,
        rows,
        fieldsArr,
        {
          getDataPath: () => path.dirname(this.uploadsDir),
          readFile: async (path: string) => {
            const base64 = await readFile(path, "base64");
            return `data:image/png;base64,${base64}`
          },
          readFileToArrBuffer: async (path: string) => {
            const buffer = await readFile(path);
            return buffer.buffer as ArrayBuffer;
          },
          getImageDimensions: async (buffer: ArrayBuffer) => {
            const uint8Array: Uint8Array = new Uint8Array(buffer);
            const metadata = imageSize(uint8Array);
            if (metadata.width == null || metadata.height == null) {
              throw new Error('Failed to extract image dimensions');
            }
            return { width: metadata.width, height: metadata.height };
          },
          formOptions: formData.formOptions,
          formTableUID: tableId,
        }
      );
    }

    const templateDir = join(os.tmpdir(), "static", nocodeId, tableId);
    // 确保目录存在
    if (!existsSync(templateDir)) {
      await mkdir(templateDir, { recursive: true });
    }
    // 根据打印设置生成文件名，将处理后的数据写入文件
    let fileName;
    let filePath;
    let url;
    let buffer;
    const timestamp = dayjs(createTime).format('YYYYMMDDHHmmss');
    const appendTimestamp = shouldAppendTimestampForPrintTemplateName(targetPrintTemplate);
    const fieldsForFilename = table.fields;
    const getTitleValueForFilename = (row?: Row, index = 0) => {
      return titleField ? row?.[titleField.uid] : titleValues[index];
    };
    const singleBaseName = buildPrintTemplateBaseName({
      template: targetPrintTemplate,
      tableAlias: table.alias,
      row: rows[0],
      fields: fieldsForFilename,
      titleValue: getTitleValueForFilename(rows[0], 0),
    });
    const zipBaseName = buildPrintTemplateBaseName({
      template: targetPrintTemplate,
      tableAlias: table.alias,
      row: rows[0],
      fields: fieldsForFilename,
      titleValue: getTitleValueForFilename(rows[0], 0),
      useRowForMultiple: false,
    });
    const makeFileName = (baseName: string, extension: string, existingNames = new Set<string>()) => {
      const timedBaseName = appendTimestamp ? `${baseName}_${timestamp}` : baseName;
      return buildPrintTemplateFileName({
        baseName: timedBaseName,
        extension,
        exists: name => existingNames.has(name) || existsSync(join(templateDir, name)),
      });
    };

    if (targetPrintTemplate.mode === PrintTemplateMode.SINGLE) {
      if (targetPrintTemplate.type === PrintTemplateType.EXCEL) {
        fileName = makeFileName(singleBaseName, ".xlsx");
        filePath = join(templateDir, fileName);
        url = join('/tmp', nocodeId, tableId, fileName).replace(/\\/g, "/");
        buffer = await workbookArr[0].xlsx.writeBuffer();
        const fileDir = dirname(filePath);
        if (!existsSync(fileDir)) {
          await mkdir(fileDir, { recursive: true });
        }
        await writeFile(filePath, new Uint8Array(buffer));
      } else if (targetPrintTemplate.type === PrintTemplateType.WORD) {
        fileName = makeFileName(singleBaseName, ".docx");
        filePath = join(templateDir, fileName);
        url = join('/tmp', nocodeId, tableId, fileName).replace(/\\/g, "/");
        buffer = await workbookArr[0];
        const fileDir = dirname(filePath);
        if (!existsSync(fileDir)) {
          await mkdir(fileDir, { recursive: true });
        }
        await writeFile(filePath, new Uint8Array(buffer));
      }
    } else if (targetPrintTemplate.mode === PrintTemplateMode.MULTIPLE) {
      fileName = makeFileName(zipBaseName, ".zip");
      const zipFilePath = join(templateDir, fileName);
      url = join('/tmp', nocodeId, tableId, fileName).replace(/\\/g, "/");

      const tempDir = join(tmpdir(), `print_export_${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      try {
        const usedZipEntryNames = new Set<string>();
        const filePromises = workbookArr.map(async (workbook, index) => {
          const entryBaseName = buildPrintTemplateBaseName({
            template: targetPrintTemplate,
            tableAlias: table.alias,
            row: rows[index] || rows[0],
            fields: fieldsForFilename,
            titleValue: getTitleValueForFilename(rows[index], index),
            useRowForMultiple: true,
          });
          const entryBaseNameWithIndex = appendTimestamp
            ? `${entryBaseName}_${timestamp}_${index + 1}`
            : entryBaseName;
          const tempFileName = buildPrintTemplateFileName({
            baseName: entryBaseNameWithIndex,
            extension: ".xlsx",
            exists: name => usedZipEntryNames.has(name) || existsSync(join(tempDir, name)),
          });
          usedZipEntryNames.add(tempFileName);
          const tempFilePath = join(tempDir, tempFileName);
          const fileDir = dirname(tempFilePath);
          if (!existsSync(fileDir)) {
            await mkdir(fileDir, { recursive: true });
          }
          const buf = await workbook.xlsx.writeBuffer();
          await writeFile(tempFilePath, new Uint8Array(buf));
          return tempFilePath;
        });

        await Promise.all(filePromises);
        await zip(zipFilePath, tempDir);
        buffer = await readFile(zipFilePath);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }

    // 更新打印记录列表信息
    const jsonDir = join(templateDir, "main.json");
    let printRecordList = [];
    if (existsSync(jsonDir)) {
      const jsonContent = await readFile(jsonDir, "utf-8");
      printRecordList = JSON.parse(jsonContent);
    }
    const account = await this.formDataService.getAccount();
    // 添加新生成的打印记录信息
    const record = {
      uid: unique(),
      name: fileName,
      url: url,
      size: buffer.byteLength,
      createTime: createTime,
      type: targetPrintTemplate.type,
      userId: account.id,
      isTemporary: true,
    };
    printRecordList.push(record);

    // 保存打印记录列表
    await writeFile(jsonDir, JSON.stringify(printRecordList, null, 2));

    return {
      record,
      url,
    }
  }

  async generatePrintFile(nocodeId: string, tableId: TableUID, printTemplateUID: string, selectRowUids: Array<string>, mergePrint?: boolean) {
    // 获取项目数据
    const nocodeBody = await this.getNocodeBodyWithOtherDataSources(nocodeId);
    const resolveTableSource = (targetTableUID: TableUID) => {
      return getNocodeDataSourceTableByUID(nocodeBody, targetTableUID, { nocodeId }, true);
    };
    const tableSource = resolveTableSource(tableId);
    const formData = tableSource?.connection as NocodeFormData || nocodeBody.formData as NocodeFormData;
    const sourceNocodeId = tableSource?.connection?.nocodeId || nocodeId;
    const table = tableSource?.table || formData.tables.find(t => t.uid === tableId);

    // 根据printTemplateUID查找对应的打印模板
    const tablePrintTemplates = nocodeBody.printTemplate?.[tableId] || [];
    const targetPrintTemplate = tablePrintTemplates.find(template => template.uid === printTemplateUID);
    if (!targetPrintTemplate) {
      throw new Error(`Print template with UID ${printTemplateUID} not found`);
    }

    // 获取打印人名字
    const printAccount = await this.formDataService.getAccount();
    const printOperator = printAccount.realname;
    // 获取打印时间
    const createTime = Date.now();

    // 根据selectRowUids获取选中的行数据
    const uuidField = getUUIDSystemField(table.fields);
    // 构造过滤条件，获取指定UID的行
    const filters = {
      [tableId]: [
        { [uuidField.uid]: { '$in': selectRowUids } }
      ]
    };
    // 使用formData服务获取数据
    const buckets = await this.formDataService.getData(nocodeId, [tableId], {
      transformRelated: true,
      transformRelatedResultObject: true,
      transformFormData: true,
      fillSubTable: true,
      filters,
      stage: { $nin: [FormDataStage.DRAFT, FormDataStage.DELETED]}
    });
    let selectRows = buckets.find(item => item.tableId === tableId)?.rows || [];
    // 添加子表单数据
    if (isEmpty(selectRows)) throw new Error(global.i18next.t('projectServices.printFailStatusChangedTips'));
    selectRows = await this.formDataService.fillSubFormField(selectRows, sourceNocodeId, table, formData, {}, true)

    // 需要加载 关联表单的子表单数据
    const relatedFields = table.fields.filter(field => {
      return field?.meta?.extra?.widgetType === FormWidgetType.RELATED_DATA
    });
    for (const field of relatedFields) {
      const relatedTableUID = field.meta?.extra?.relatedTableUID;
      if (!Array.isArray(relatedTableUID)) continue;
      const relatedTableId = relatedTableUID[1];
      const relatedTableSource = resolveTableSource(relatedTableId);
      const relatedTable = relatedTableSource?.table;
      const relatedFormData = relatedTableSource?.connection as NocodeFormData;
      const relatedNocodeId = relatedTableSource?.connection?.nocodeId || nocodeId;
      if (!relatedTable || !relatedFormData) continue;
      for (const relatedTableField of relatedTable.fields) {
        if (relatedTableField.meta?.extra?.widgetType === FormWidgetType.SUBFORM) {
          for (const row of selectRows) {
            row[field.uid] = await this.formDataService.fillSubFormField(row[field.uid], relatedNocodeId, relatedTable, relatedFormData)
          }
        }
      }
    }
    selectRows = await this.formatPrintProcessSystemFields(nocodeId, table, formData, selectRows);

    // 为每条数据添加printOperator和printTime属性
    selectRows = selectRows.map(row => ({
      ...row,
      printOperator: printOperator,
      printTime: dayjs(createTime).format('YYYY-MM-DD HH:mm'),
    }));
    const aggregateFields = formData.metas?.[tableId]?.aggregateFields || [];
    const aggregateRuntimeFields = buildTableAggregateRuntimeFields(table.uid, aggregateFields);
    selectRows = fillPrintableTableAggregateFieldValues(selectRows, table, aggregateFields, {
      sourceRows: mergePrint ? selectRows : undefined,
    });
    const relatedSubFormPrintData = await this.preparePrintableRelatedSubFormData(
      nocodeId,
      formData,
      table,
      selectRows,
      { $nin: [FormDataStage.DRAFT, FormDataStage.DELETED] },
    );
    selectRows = relatedSubFormPrintData.rows;
    const relatedSubFormRuntimeFields = relatedSubFormPrintData.fields;

    // 数据排序
    const uidField = getUUIDSystemField(table.fields);
    selectRows = sortByIDArray(selectRowUids, selectRows, uidField.uid);
    let titleField;
    let titleValues = [];
    if (targetPrintTemplate.exportNameMode === PrintTemplateExportNameMode.DATA_TITLE) {
      // 如果使用数据标题命名方式，则获取标题字段的值并存入数组
      titleField = table.fields.find(field => field.meta.name === SystemField.DATA_TITLE);
      if (titleField) {
        selectRows.forEach(row => {
          const titleValue = row[titleField.uid];
          if (titleValue) {
            titleValues.push(titleValue);
          }
        });
      }
    }
    if (this.isPrintFlowCommentTextTemplate(targetPrintTemplate)) {
      selectRows = await this.fillPrintFlowCommentText(nocodeId, table, selectRows, targetPrintTemplate.flowCommentRule);
    }
    selectRows = await this.fillPrintRowShareLinks(sourceNocodeId, table, selectRows, printAccount.id);

    // 获取模板文件绝对路径
    let templateBuffer;
    if (targetPrintTemplate.file?.path) {
      const templatePath = join(this.nocodesDir, targetPrintTemplate.file?.path);
      const buffer = await readFile(templatePath);
      templateBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }

    // 处理子表单
    const nestedFormData = (field: Field) => {
      const subTableUID: OptionTableUID = field.meta?.extra?.subTableUID;
      if (subTableUID) {
        const subTableId = subTableUID[1]
        const subTable = resolveTableSource(subTableId)?.table;
        if (!subTable) return field;
        field.subTableFields = subTable.fields.map(subField => ({ ...subField }));
      }
      return field
    }
    const nestedRelatedData = (field: Field) => {
      const relatedTableUID: OptionTableUID = field.meta?.extra?.relatedTableUID;
      if (relatedTableUID) {
        const subTableId = relatedTableUID[1]
        const subTable = resolveTableSource(subTableId)?.table;
        if (!subTable) return field;
        field.relatedTableFields = subTable.fields.map(subField => nestedFormData({ ...subField }));
      }
      return field
    }
    const fieldsArr = [
      ...table.fields,
      ...aggregateRuntimeFields,
      ...createPrintRowShareFields(),
      ...(this.isPrintFlowCommentTextTemplate(targetPrintTemplate) ? [createPrintFlowCommentField()] : []),
      ...relatedSubFormRuntimeFields].map(field => ({ ...field })).map(nestedFormData).map(nestedRelatedData)

    // 根据模板类型使用不同的处理方法
    let workbookArr;
    if (targetPrintTemplate.type === PrintTemplateType.EXCEL) {
      workbookArr = await replaceExcelTemplate(targetPrintTemplate, templateBuffer, selectRows, fieldsArr, {
        getDataPath: () => path.dirname(this.uploadsDir),
        readFile: async (path: string) => {
          const base64 = await readFile(path, "base64");
          return `data:image/png;base64,${base64}`
        },
        readFileToArrBuffer: async (path: string) => {
          const buffer = await readFile(path);
          return buffer.buffer as ArrayBuffer;
        },
        getImageDimensions: async (buffer: ArrayBuffer) => {
          const uint8Array: Uint8Array = new Uint8Array(buffer);
          const metadata = imageSize(uint8Array);
          if (metadata.width == null || metadata.height == null) {
            throw new Error('Failed to extract image dimensions');
          }
          return { width: metadata.width, height: metadata.height };
        },
        getParser: () => new DOMParser(),
        mergePrint,
        formOptions: formData.formOptions,
        formTableUID: tableId,
      });
    } else if (targetPrintTemplate.type === PrintTemplateType.WORD) {
      workbookArr = await replaceDocxTemplate(
        targetPrintTemplate,
        templateBuffer,
        selectRows,
        fieldsArr,
        {
          getDataPath: () => path.dirname(this.uploadsDir),
          readFile: async (path: string) => {
            const base64 = await readFile(path, "base64");
            return `data:image/png;base64,${base64}`
          },
          readFileToArrBuffer: async (path: string) => {
            const buffer = await readFile(path);
            return buffer.buffer as ArrayBuffer;
          },
          getImageDimensions: async (buffer: ArrayBuffer) => {
            const uint8Array: Uint8Array = new Uint8Array(buffer);
            const metadata = imageSize(uint8Array);
            if (metadata.width == null || metadata.height == null) {
              throw new Error('Failed to extract image dimensions');
            }
            return { width: metadata.width, height: metadata.height };
          },
          mergePrint,
          formOptions: formData.formOptions,
          formTableUID: tableId,
        }
      );
    }
    
    // 存储处理后的数据
    // 存储的路径
    const userDataPath = await getRuntime().getUserDataPath();
    const templateDir = join(userDataPath, "FormTemplates", nocodeId, tableId);
    // 确保目录存在
    if (!existsSync(templateDir)) {
      await mkdir(templateDir, { recursive: true });
    }

    // 根据打印设置生成文件名，将处理后的数据写入文件
    let fileName;
    let filePath;
    let url;
    let buffer;
    const timestamp = dayjs(createTime).format('YYYYMMDDHHmmss');
    const appendTimestamp = shouldAppendTimestampForPrintTemplateName(targetPrintTemplate);
    const fieldsForFilename = table.fields;
    const getTitleValueForFilename = (row?: Row, index = 0) => {
      return titleField ? row?.[titleField.uid] : titleValues[index];
    };
    const singleBaseName = buildPrintTemplateBaseName({
      template: targetPrintTemplate,
      tableAlias: table.alias,
      row: selectRows[0],
      fields: fieldsForFilename,
      titleValue: getTitleValueForFilename(selectRows[0], 0),
    });
    const zipBaseName = buildPrintTemplateBaseName({
      template: targetPrintTemplate,
      tableAlias: table.alias,
      row: selectRows[0],
      fields: fieldsForFilename,
      titleValue: getTitleValueForFilename(selectRows[0], 0),
      useRowForMultiple: false,
    });
    const makeFileName = (baseName: string, extension: string, existingNames = new Set<string>()) => {
      const timedBaseName = appendTimestamp ? `${baseName}_${timestamp}` : baseName;
      return buildPrintTemplateFileName({
        baseName: timedBaseName,
        extension,
        exists: name => existingNames.has(name) || existsSync(join(templateDir, name)),
      });
    };

    if (targetPrintTemplate.mode === PrintTemplateMode.SINGLE) {
      if (targetPrintTemplate.type === PrintTemplateType.EXCEL) {
        fileName = makeFileName(singleBaseName, ".xlsx");
        filePath = join(templateDir, fileName);
        url = join("/template", nocodeId, tableId, fileName).replace(/\\/g, "/");
        buffer = await workbookArr[0].xlsx.writeBuffer();
        await writeFile(filePath, new Uint8Array(buffer));
      } else if (targetPrintTemplate.type === PrintTemplateType.WORD) {
        fileName = makeFileName(singleBaseName, ".docx");
        filePath = join(templateDir, fileName);
        url = join("/template", nocodeId, tableId, fileName).replace(/\\/g, "/");
        buffer = await workbookArr[0];
        await writeFile(filePath, new Uint8Array(buffer));
      }
    } else if (targetPrintTemplate.mode === PrintTemplateMode.MULTIPLE) {
      fileName = makeFileName(zipBaseName, ".zip");
      const zipFilePath = join(templateDir, fileName);
      url = join("/template", nocodeId, tableId, fileName).replace(/\\/g, "/");

      const tempDir = join(tmpdir(), `print_export_${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      try {
        const usedZipEntryNames = new Set<string>();
        const filePromises = workbookArr.map(async (workbook, index) => {
          const entryBaseName = buildPrintTemplateBaseName({
            template: targetPrintTemplate,
            tableAlias: table.alias,
            row: selectRows[index] || selectRows[0],
            fields: fieldsForFilename,
            titleValue: getTitleValueForFilename(selectRows[index], index),
            useRowForMultiple: true,
          });
          const entryBaseNameWithIndex = appendTimestamp
            ? `${entryBaseName}_${timestamp}_${index + 1}`
            : entryBaseName;
          const tempFileName = buildPrintTemplateFileName({
            baseName: entryBaseNameWithIndex,
            extension: ".xlsx",
            exists: name => usedZipEntryNames.has(name) || existsSync(join(tempDir, name)),
          });
          usedZipEntryNames.add(tempFileName);
          const tempFilePath = join(tempDir, tempFileName);
          const buf = await workbook.xlsx.writeBuffer();
          await writeFile(tempFilePath, new Uint8Array(buf));
          return tempFilePath;
        });

        await Promise.all(filePromises);
        await zip(zipFilePath, tempDir);
        buffer = await readFile(zipFilePath);
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }

    // 更新打印记录列表信息
    const jsonDir = join(templateDir, "main.json");
    let printRecordList = [];
    if (existsSync(jsonDir)) {
      const jsonContent = await readFile(jsonDir, "utf-8");
      printRecordList = JSON.parse(jsonContent);
    }
    
    const account = await this.formDataService.getAccount();
    // 添加新生成的打印记录信息
    const record = {
      uid: unique(),
      name: fileName,
      url: url,
      size: buffer.byteLength,
      createTime: createTime,
      type: targetPrintTemplate.type,
      userId: account.id,
    };
    printRecordList.push(record);
    
    // 保存打印记录列表
    await writeFile(jsonDir, JSON.stringify(printRecordList, null, 2));

    return {
      record,
      printRecordList: printRecordList,
      selectRows: selectRows,
    };
  }

  async generatePrintFileUrl(nocodeId: string, tableId: TableUID, printRecordUID: string, options: { isTemporary?: boolean, excelPrintSheetName: string | string[] }) {
    const { isTemporary = false, excelPrintSheetName } = options;
    const baseFileStr = isTemporary ? "static" : "FormTemplates";
    const userDataPath = await getRuntime().getUserDataPath();
    const templateDir = isTemporary ? join(os.tmpdir(), baseFileStr, nocodeId, tableId) : join(userDataPath, baseFileStr, nocodeId, tableId);
    const jsonDir = join(templateDir, "main.json");
    if (!existsSync(jsonDir)) {
      throw new Error(global.i18next.t('projectServices.illegalOperation'));
    }
    const jsonContent = await readFile(jsonDir, "utf-8");
    const printRecordList: PrintedTemplateRecord[] = JSON.parse(jsonContent);
    const record = printRecordList.find(item => item.uid === printRecordUID);
    const filename = basename(record.url);
    let inputPath = join(templateDir, filename);
    
    // 如果是xlsx文件并且excelPrintSheetName指定了要打印的工作表的名称
    if (record.name.endsWith(".xlsx") && excelPrintSheetName) {
      const buffer = await readFile(inputPath);
      const templateBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      const workbook = await createWorkbookFromSheets(templateBuffer, excelPrintSheetName);
      if (workbook instanceof Error) {
        throw workbook;
      }
      const buf = await workbook.xlsx.writeBuffer();
      const tempDir = join(os.tmpdir(), "static", record.name);
      await writeFile(tempDir, new Uint8Array(buf));
      inputPath = tempDir;
    }
    const outputName = `${basename(filename, extname(filename))}_${unique(32)}.pdf`;
    const outputPath = join(os.tmpdir(), "static", outputName);
    await this.officeService.toPDF(inputPath, outputPath);
    return {
      url: `tmp/${outputName}`,
    }
  }

  async deletePrintRecord(nocodeId: string, tableId: TableUID, printRecordUID: string) {
    // 获取用户数据路径
    const userDataPath = await getRuntime().getUserDataPath();
    const templateDir = join(userDataPath, "FormTemplates", nocodeId, tableId);
    const jsonDir = join(templateDir, "main.json");
    
    // 检查main.json是否存在
    if (!existsSync(jsonDir)) {
      throw new Error(global.i18next.t('projectServices.illegalOperation'));
    }

    // 读取现有的打印记录列表
    const jsonContent = await readFile(jsonDir, "utf-8");
    let printRecordList = JSON.parse(jsonContent);

    // 查找要删除的记录
    const recordIndex = printRecordList.findIndex(record => record.uid === printRecordUID);
    if (recordIndex === -1) {
      return;
    }

    // 获取要删除的记录信息
    const recordToDelete = printRecordList[recordIndex];
    
    // 删除对应的文件
    const fileToDelete = join(templateDir, recordToDelete.name);
    if (existsSync(fileToDelete)) {
      await unlink(fileToDelete);
    }

    // 从打印记录列表中移除该记录
    printRecordList.splice(recordIndex, 1);
    
    // 保存更新后的打印记录列表
    await writeFile(jsonDir, JSON.stringify(printRecordList, null, 2));

    return true;
  }

  async clearPrintRecord(nocodeId: string, tableId: TableUID) {
    // 获取用户数据路径
    const userDataPath = await getRuntime().getUserDataPath();
    const templateDir = join(userDataPath, "FormTemplates", nocodeId, tableId);

    // 检查目录是否存在
    if (!existsSync(templateDir)) {
      throw new Error(global.i18next.t('projectServices.illegalOperation'));
    }

    // 删除整个目录
    await rm(templateDir, { recursive: true });

    return true;
  }

  //#endregion


  private getUsedResourcePaths(boardVal: any): string[] {
    const paths = [];
    if (Array.isArray(boardVal)) {
      for (const item of boardVal) {
        paths.push(...this.getUsedResourcePaths(item));
      }
    } else if (boardVal instanceof Object) {
      if (boardVal['__opt_type'] === 'file' && boardVal['relativePath']) {
        const relativePath = boardVal['relativePath'].replace(/\\/g, "/");
        if (boardVal['exportFolder']) {
          paths.push(dirname(relativePath));
        } else {
          paths.push(relativePath);
        }
      } else if (boardVal['__opt_type'] === 'folder' && boardVal['relativePath']) {
        const relativeDir = boardVal['relativeDir'].replace(/\\/g, "/");
        paths.push(relativeDir);
      } else {
        for (const key in boardVal) {
          paths.push(...this.getUsedResourcePaths(boardVal[key]));
        }
      }
    }
    return Array.from(new Set(paths));
  }
  

  downloadFile(url: string, savePath: string, onDownloadProgress?: (progress: number) => void): Promise<void> {
    return this.downloadRest.downloadFile(url, savePath, onDownloadProgress);
  }

  async copyTemplates(relativePath: string, savePath: string) {
    const localResourceDir = await getLocalResourceDir();
    const templatePath = join(localResourceDir, 'projects', relativePath);
    await cp(templatePath, savePath);
    return;
  }

  async initNocode(accountId?: string): Promise<NocodeMeta> {
    return await this.createNocode({name:global.i18next.t('projectServices.nocodeApp'), parent:""})
  }

  // 获取重复文件的唯一名称
  async renameIfNeed(destDir: string, filename: string) {
    //1.检查文件是否存在，不存在直接返回文件名
    if (!await exists(join(destDir, filename))) {
      return filename;
    }

    //2.存在的话，重命名
    const extname = path.extname(filename);
    let basename = path.basename(filename, extname);
    console.log(basename,'basename');
    
    const regex = /(\d+)$/;
    const match = basename.match(regex);
    if (match) {
      const num = parseInt(match[1]) + 1;
      basename = basename.replace(regex, `${num}`);
    }else {
      basename = `${basename}_1`
    }
    const newFileame = `${basename}${extname}`;
    return this.renameIfNeed(destDir, newFileame);
  }

  async saveNocodeSnapshot(options: {
    nocodeId: string,
    file: any
  }): Promise<string> {
    const nocodeDir = join(this.nocodesDir, options.nocodeId);
    let snapshotDir = join(nocodeDir, "snapshot");
    const fileName = basename(options.file.originalname);
    let snapshotFile = `snapshot-${fileName}.png`;
    snapshotFile = await this.renameIfNeed(snapshotDir, snapshotFile);
    const snapshotPath = join(snapshotDir, snapshotFile);
    const snapshotOutsidePath = join(nocodeDir, "snapshot.png");
    try {
      //先创建到snapshot目录下
      if (!existsSync(snapshotDir)) {
        await mkdir(snapshotDir, {recursive:true});
      }
      await cp(options.file.path, snapshotPath);
      // 将图片拷贝到外层，用于显示项目封面
      await cp(snapshotPath, snapshotOutsidePath);
      return snapshotFile;
    } catch (err) {
      this.logger.warn("write snapshot.png failed", err);
      throw err;
    }
  }

  async removeNocodeSnapshot(nocodeId: string) {
    const snapshotPath = join(this.nocodesDir, nocodeId, "snapshot.png");
    if (!existsSync(snapshotPath)) return;
    await unlink(snapshotPath).catch((error) => {
      this.logger.warn(`remove snapshot.png failed: ${nocodeId}`, error);
    });
  }

  async getSharingNocodes() {
    return await this.nocodeRepository.find({
      isPublish: true,
      $or: [
        { deleted: { $ne: true } },
        { deleted: null },
      ]
    }, { orderBy: { "sort": "ASC", "createTime": "DESC" } })
  }

  async getSharePermissionsByAccountId(accountId: string) {
    const [account, allDepartments] = await Promise.all([
      this.organizeCache.getUserById(accountId),
      this.organizeCache.getAllDepartments(),
    ]);
    if(!account) return [];
    const allShareNocodes = await this.getSharingNocodes();

    if(isSystemAdminAccount(account)) {
      return allShareNocodes
    }
    const result = []

    const departmentMap = new Map(allDepartments.map(dep => [dep.id, dep.parent]));
    const departmentIds = new Set<string>();
    const pendingDepartmentIds = [...account.departments];
    while (pendingDepartmentIds.length) {
      const departmentId = pendingDepartmentIds.pop();
      if (!departmentId || departmentIds.has(departmentId)) continue;
      departmentIds.add(departmentId);
      const parentId = departmentMap.get(departmentId);
      if (parentId) pendingDepartmentIds.push(parentId);
    }
    const roles = account.roles;

    function hasPermission(permission) {

      if(permission.rangeType === PermissionFilterMode.BLACK) {
        if(permission.blacklist.users.includes(account.id)) {
          return false
        }
        for(const depId of departmentIds) {
          if(permission.blacklist.departments.includes(depId)) {
            return false
          }
        }
        for(const roleId of roles) {
          if(permission.blacklist.roles.includes(roleId)) {
            return false
          }
        }
        return true
      } else {
        if(permission.whitelist.users.includes(account.id)) {
          return true
        }
        for(const depId of departmentIds) {
          if(permission.whitelist.departments.includes(depId)) {
            return true
          }
        }
        for(const roleId of roles) {
          if(permission.whitelist.roles.includes(roleId)) {
            return true
          }
        }
        return false
      }
    }

    for(const nocode of allShareNocodes) {
      const nocodeBody = await this.getNocodeBody(nocode.id);
      if(isEmpty(nocodeBody?.permissions?.application?.get)) {
        result.push(nocode)
        continue
      }
      const permission = nocodeBody.permissions.application.get
      if(hasPermission(permission)) {
        result.push(nocode)
      }
    }
    return result
  }

  async getShareNocodeSummariesByAccount(account?: Partial<Account>): Promise<ShareNocodeSummary[]> {
    const accountId = String(account?.id || "").trim();
    const shareMetas = accountId
      ? await this.getSharePermissionsByAccountId(accountId).catch(() => [])
      : await this.getSharingNocodes().catch(() => []);

    const uniqueShareMetas: NocodeMeta[] = [];
    const seenAppIds = new Set<string>();
    for (const meta of Array.isArray(shareMetas) ? shareMetas : []) {
      const appId = String(meta?.id || "").trim();
      if (!appId || seenAppIds.has(appId)) {
        continue;
      }
      seenAppIds.add(appId);
      uniqueShareMetas.push(meta);
    }

      if (!accountId) {
        const context = await this.createCrossAppPermissionContext(account);
        const summaries = await Promise.all(uniqueShareMetas.map(async (meta) => {
          const body = await this.getNocodeBody(meta.id).catch(() => null);
          const importState = this.getNocodeImportRestrictionStateByMeta(meta, account);
          if (!body) {
            if (!this.isAdminAccount(account)) {
              return null;
            }
            return {
              meta,
              isBroken: true,
              importState,
            permissions: {
              editable: false,
              deletable: this.isAdminAccount(account),
              canManageImportExpireAt: !!importState?.canManageExpireAt,
            },
          } as ShareNocodeSummary;
        }
        if (!this.canViewTargetNocode(body, context)) {
          return null;
        }

        return {
          meta,
          snapshot: body.snapshot,
          cover: resolveNocodeCoverSummary(
            body.snapshot,
            !body.snapshot && existsSync(join(this.nocodesDir, meta.id, "snapshot.png")),
          ),
          importState,
          permissions: {
            editable: this.canManageTargetNocode(body, context),
            deletable: this.isAdminAccount(account),
            canManageImportExpireAt: !!importState?.canManageExpireAt,
          },
        } as ShareNocodeSummary;
      }));

      return summaries.filter((item): item is ShareNocodeSummary => !!item);
    }

    const context = await this.createCrossAppPermissionContext(account);
    const summaries = await Promise.all(uniqueShareMetas.map(async (meta) => {
      const body = await this.getNocodeBody(meta.id).catch(() => null);
      const importState = this.getNocodeImportRestrictionStateByMeta(meta, account);
      if (!body) {
        if (!this.isAdminAccount(account)) {
          return null;
        }
        return {
          meta,
          isBroken: true,
          importState,
          permissions: {
            editable: false,
            deletable: this.isAdminAccount(account),
            canManageImportExpireAt: !!importState?.canManageExpireAt,
          },
        } as ShareNocodeSummary;
      }

      return {
        meta,
        snapshot: body.snapshot,
        cover: resolveNocodeCoverSummary(
          body.snapshot,
          !body.snapshot && existsSync(join(this.nocodesDir, meta.id, "snapshot.png")),
        ),
        importState,
        permissions: {
          editable: this.canManageTargetNocode(body, context),
          deletable: this.isAdminAccount(account),
          canManageImportExpireAt: !!importState?.canManageExpireAt,
        },
      } as ShareNocodeSummary;
    }));

    return summaries.filter((item): item is ShareNocodeSummary => !!item);
  }

  async restoreBrokenNocodeByAccount(nocodeId: string, account?: Partial<Account>) {
    const normalizedNocodeId = String(nocodeId || "").trim();
    if (!normalizedNocodeId) {
      throw new Error(global.i18next.t("workbenchController.appNotExist"));
    }

    const nocodeMeta = await this.getNocodeMeta(normalizedNocodeId).catch(() => null);
    if (!nocodeMeta || nocodeMeta.deleted) {
      throw new Error(global.i18next.t("workbenchController.appNotExist"));
    }

    if (!this.isAdminAccount(account)) {
      throw new Error(global.i18next.t("formDataService.noPerm"));
    }

    const currentBody = await this.getNocodeBody(normalizedNocodeId).catch(() => null);
    if (currentBody) {
      return {
        restored: false,
        alreadyAvailable: true,
        body: currentBody,
        snapshot: currentBody?.snapshot,
        cover: resolveNocodeCoverSummary(
          currentBody?.snapshot,
          !currentBody?.snapshot && existsSync(join(this.nocodesDir, normalizedNocodeId, "snapshot.png")),
        ),
      };
    }

    const restoreResult = await restoreBrokenNocodeBodyFromOldVersions(this.nocodesDir, normalizedNocodeId);
    return {
      restored: true,
      body: restoreResult.body,
      restoredFrom: restoreResult.restoredFrom,
      snapshot: restoreResult.body?.snapshot,
      cover: resolveNocodeCoverSummary(
        restoreResult.body?.snapshot,
        !restoreResult.body?.snapshot && existsSync(join(this.nocodesDir, normalizedNocodeId, "snapshot.png")),
      ),
    };
  }

  async getVisibleWarmupNocodeMetas(accountId?: string): Promise<NocodeMeta[]> {
    let targetAccountId = String(accountId || "").trim();
    if (!targetAccountId) {
      const adminAccount = await this.organizeCache.getAdmin();
      targetAccountId = String(adminAccount?.id || "").trim();
    }

    const visibleMetas = targetAccountId
      ? await this.getSharePermissionsByAccountId(targetAccountId).catch(() => [])
      : await this.getSharingNocodes().catch(() => []);

    const uniqueMetas: NocodeMeta[] = []
    const seenAppIds = new Set<string>()
    for (const meta of Array.isArray(visibleMetas) ? visibleMetas : []) {
      const appId = String(meta?.id || "").trim()
      if (!appId || seenAppIds.has(appId)) {
        continue
      }
      seenAppIds.add(appId)
      uniqueMetas.push(meta)
    }

    const metasWithBody = await Promise.all(uniqueMetas.map(async meta => {
      const appId = String(meta?.id || "").trim()
      if (!appId) {
        return null
      }
      const body = await this.getNocodeBody(appId).catch(() => null)
      return body ? meta : null
    }))

    return metasWithBody.filter((meta): meta is NocodeMeta => Boolean(meta))
  }

  async getAllDepartments() {
    return await this.organizeCache.getAllDepartments();
  }

  async getNocodeProject(type: PublishCategory, nocodeId: string, id: string, isPreview: boolean = false) {
    let nocodeBody = await this.getNocodeBodyWithOtherDataSources(nocodeId);
    let nocodeMeta = await this.getNocodeMeta(nocodeId);
    let project
    let isNeedPassword
    let fieldsAuth: Record<string, FieldAuthValue> | "all" = "all";
    if (type === PublishCategory.PAGE) {
        project = await this.getProjectBody(nocodeId, id, getPublicPublishUpdateMethod(nocodeMeta) === PublishUpdateMethod.LIVE);
      if (!project || (!project?.sharing && !isPreview) ) return null;
      isNeedPassword = project?.isNeedPassword;
    } else {
      const formSnapshot = await this.getPublicFormSnapshot(nocodeId, id as TableUID);
      nocodeMeta = formSnapshot.nocodeMeta;
      nocodeBody = formSnapshot.nocodeBody;
      project = formSnapshot.table;

      if (!project || (!project.publish.sharing && !isPreview)) return null;
      isNeedPassword = project.publish.isNeedPassword;
      fieldsAuth = this.getPublicFormFieldsAuth(nocodeBody, project.uid);
    }
    const nocode = {
      meta: nocodeMeta,
      body: nocodeBody,
    }
    const publisher = await this.buildPublishUserInfo(nocodeMeta);
    const reportAccount = this.buildReportAccount();
    return {
      project,
      nocode,
      isNeedPassword: isPreview ? false : isNeedPassword,
      fieldsAuth,
      publisher,
      reportAccount,
    }
  }

  async getViewNocodeLayer(type: PublishCategory, nocodeId: string, id: string) {
    const nocodeBody = await this.getNocodeBodyWithOtherDataSources(nocodeId);
    const nocodeMeta = await this.getNocodeMeta(nocodeId);
    let project
    if (type === PublishCategory.PAGE) {
        project = await this.getProjectBody(nocodeId, id, getInnerPublishUpdateMethod(nocodeMeta) === PublishUpdateMethod.LIVE);
      if (!project || !project?.sharing ) return null;
    } else {
      const tables = (nocodeBody?.formData?.tables ?? []);
      project = tables.find(t => t.uid === id);
      if (!project || !project.publish.sharing) return null;
    }
    const nocode = {
      meta: nocodeMeta,
      body: nocodeBody,
    }
    const publisher = await this.buildPublishUserInfo(nocodeMeta);
    const reportAccount = this.buildReportAccount();
    return {
      project,
      nocode,
      publisher,
      reportAccount,
    }
  }
  private async getSharePagePassword(type: PublishCategory, nocodeId: string, id: string) {
    let pagePassword: string;
    if (type === PublishCategory.PAGE) {
      const nocodeMeta = await this.getNocodeMeta(nocodeId);
        const projectBody = await this.getProjectBody(nocodeId, id, getPublicPublishUpdateMethod(nocodeMeta) === PublishUpdateMethod.LIVE);
      if (!projectBody || (!projectBody?.sharing) ) throw new Error(global.i18next.t('projectServices.projectNotExistOrPrivate'));
      pagePassword = projectBody.password;
    } else {
      const { table } = await this.getPublicFormSnapshot(nocodeId, id as TableUID);
      if (!table || (!table?.publish?.sharing) ) throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      pagePassword = table.publish.password;
    }
    return pagePassword;
  }

  async visitNocodeProject(type: PublishCategory, nocodeId: string, projectId: string, password: string) {
    const pagePassword = await this.getSharePagePassword(type, nocodeId, projectId);

    if (encodePassword(password) == pagePassword) {
      const info = JSON.stringify({
        expireTime: dayjs().add(1, 'day').valueOf(),
      })
      const payload = btoa(info);
      return {
      success: true,
      token: `${payload}.${pagePassword}.${encodePassword(payload)}`,
    };
    } else {
      throw new Error(global.i18next.t('projectServices.passwordError'));
    }
  }

  async validateShareToken(nocodeId: string, pageId: string, type: PublishCategory, token: string) {
    const info = token?.split(".") || [];
    if (info.length !== 3) return false;
    const { expireTime } = JSON.parse(atob(info[0])) || {};
    if (dayjs().valueOf() > expireTime) return false;
    if (encodePassword(info[0]) !== info[2]) return false;
    const pagePassword = await this.getSharePagePassword(type, nocodeId, pageId);
    if (pagePassword !== info[1]) return false;
    return true;
  }

  async getNocodeProjectsPassword(nocodeId: string) {
    const body = await this.getNocodeBody(nocodeId);
    const pages = getAllPages(body.structure || []);
    const pageBodies = await Promise.all(pages.map(async (page) => await this.getProjectBody(nocodeId, page.id)));
    const pagePasswords = pageBodies.filter(body => !isEmpty(body.password)).map(body => {
      return {
        id: body.id,
        password: aes256Decode('652a6227894b94e67b6123aa38bb6dd8', '399d5d0f45823e5a', body.password),
      }
    })

    const tables = (body?.formData?.tables ?? []);
    const tablePasswords = tables.filter(t => !isEmpty(t.publish.password)).map(t => {
      return {
        id: t.uid,
        password: aes256Decode('652a6227894b94e67b6123aa38bb6dd8', '399d5d0f45823e5a', t.publish.password),
      }
    })

    return [ ...pagePasswords, ...tablePasswords ]
  }

  async updateNocodeProjects(
    nocodeId: string,
    publishMethods: {
      updateMethod?: PublishUpdateMethod,
      innerUpdateMethod?: PublishUpdateMethod,
      publicUpdateMethod?: PublishUpdateMethod,
    },
    projectBodies: ProjectBody[],
    tables: Table[],
    releaseTableUIDs: string[] = [],
  ) {
    const result: any = {};
    const nocodeMeta = await this.getNocodeMeta(nocodeId);
    if (nocodeMeta) {
      const nextInnerUpdateMethod = publishMethods.innerUpdateMethod || getInnerPublishUpdateMethod(nocodeMeta);
      const nextPublicUpdateMethod = publishMethods.publicUpdateMethod || getPublicPublishUpdateMethod(nocodeMeta);
      nocodeMeta.innerUpdateMethod = nextInnerUpdateMethod;
      nocodeMeta.publicUpdateMethod = nextPublicUpdateMethod;
      await this.setNocodeMeta(nocodeMeta);
    }
    if (projectBodies?.length) {
      const oldBodies = await Promise.all(projectBodies.map(async body => await this.getProjectBody(nocodeId, body.id)));
      for (const oldBody of oldBodies || []) {
        const newBody = projectBodies.find(body => body.id === oldBody.id);
        if (newBody) {
          oldBody.isPublicShare = newBody.isPublicShare;
          oldBody.shareExpireTime = newBody.shareExpireTime;
          oldBody.isNeedPassword = newBody.isNeedPassword;
          oldBody.sharing = newBody.sharing;
          oldBody.manualChanged = false;
          if (!newBody.isNeedPassword) {
            oldBody.password = undefined;
            oldBody.encrypted = true;
          } else if (newBody.encrypted === false && newBody.password) {
            oldBody.password = encodePassword(newBody.password);
            oldBody.encrypted = true;
          }
        }
      }
      const needPublishPageIds = oldBodies.filter(oldBody => oldBody.sharing).map(body => body.id);
      await Promise.all(oldBodies.map(async oldBody => await this.saveProjectBody(nocodeId, oldBody.id, oldBody)));
      
        if (hasManualPublishScope(nocodeMeta)) {
          await Promise.all(needPublishPageIds.map(async id => await this.createReleaseRecord(nocodeId, id, join(this.nocodesDir, nocodeId))));
        }
      }

    if (tables?.length) {
      const body = await this.getNocodeBody(nocodeId);
      const formData = body?.formData;
      const releaseTableUIDSet = new Set(releaseTableUIDs);
      const manualPublicTableIds: TableUID[] = [];
      for (const table of tables) {
        table.publish = table.publish || {};
        if (!table.publish?.encrypted && table.publish.isNeedPassword && table.publish.password) {
          table.publish.password = encodePassword(table.publish.password);
          table.publish.encrypted = true;
        }
        if (
          !table.publish?.publicQuery?.encrypted
          && table.publish?.publicQuery?.isNeedPassword
          && table.publish?.publicQuery?.password
        ) {
          table.publish.publicQuery.password = encodePassword(table.publish.publicQuery.password);
          table.publish.publicQuery.encrypted = true;
        }
        if (
          releaseTableUIDSet.has(table.uid)
          && getFormPublicPublishUpdateMethod(nocodeMeta, table.publish) === PublishUpdateMethod.MANUAL
        ) {
          manualPublicTableIds.push(table.uid);
        }
        const index = formData.tables.findIndex(t => table.uid === t.uid);
        formData.tables[index] = table;
      }
      await saveNocodeBody(this.nocodesDir, nocodeId, body);
      const publicFormReleaseSnapshot = manualPublicTableIds.length > 0
        ? await this.buildPublicFormReleaseSnapshotBody(nocodeId, body)
        : null;
      await Promise.all(
        manualPublicTableIds.map(tableUID => saveFormReleaseNocodeBody(
          this.nocodesDir,
          nocodeId,
          tableUID,
          deepClone(publicFormReleaseSnapshot),
        ))
      );
      await this.notifyAiWarmup(nocodeId, 'publish');
      result.tables = tables;
    }
    return result;
  }

  private getAiWarmupService() {
    const warmupModule = require('../ai/memory/ai-app-memory-warmup.service') as typeof import('../ai/memory/ai-app-memory-warmup.service');
    return this.moduleRef.get(warmupModule.AiAppMemoryWarmupService, { strict: false });
  }

  private async notifyAiWarmup(appId: string, reason: 'create' | 'import' | 'publish') {
    const normalizedAppId = String(appId || '').trim();
    if (!normalizedAppId) {
      return;
    }
    await this.getAiWarmupService()?.scheduleBootstrapWarmup(normalizedAppId, reason).catch(() => undefined);
  }

  async validateShare(type: PublishCategory, nocodeId: string, id:string) {
    let publishOption
    if (type === PublishCategory.PAGE) {
      publishOption = await this.getProjectBody(nocodeId, id).catch(() => null);
    } else {
      const table = await this.getPublicFormSnapshot(nocodeId, id as TableUID).then((data) => data.table).catch(() => null);
      if (table) publishOption = table.publish
    }

    if (!publishOption) return false;
    if (!publishOption.sharing || !publishOption.isPublicShare) return false;
    if (publishOption.shareExpireTime && dayjs(publishOption.shareExpireTime).isBefore(dayjs())) return false;
    return true;
  }

  private buildPublicQueryToken(nocodeId: string, tableUID: TableUID, passwordHash = "") {
    const payload = btoa(JSON.stringify({
      nocodeId,
      tableUID,
      expireTime: dayjs().add(1, "day").valueOf(),
    }));
    const passwordSegment = String(passwordHash || "");
    const sign = encodePassword(`${payload}.${passwordSegment}`);
    return `${payload}.${passwordSegment}.${sign}`;
  }

  private parsePublicQueryToken(token: string) {
    const info = String(token || "").split(".");
    if (info.length !== 3) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    const [payload, passwordSegment, sign] = info;
    if (encodePassword(`${payload}.${passwordSegment}`) !== sign) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    let payloadInfo: any = {};
    try {
      payloadInfo = JSON.parse(atob(payload)) || {};
    } catch {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    const nocodeId = String(payloadInfo?.nocodeId || "");
    const tableUID = String(payloadInfo?.tableUID || "") as TableUID;
    const expireTime = Number(payloadInfo?.expireTime || 0);
    if (!nocodeId || !tableUID || !expireTime) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    if (dayjs().valueOf() > expireTime) {
      throw new Error(global.i18next.t('projectServices.rowShareExpired'));
    }
    return {
      nocodeId,
      tableUID,
      passwordSegment,
    };
  }

  private isPublicQueryConditionField(field: Field) {
    if (!field || isSystemField(field)) {
      return false;
    }
    if (field.meta?.subType === "related" || field.meta?.subType === "subForm") {
      return false;
    }
    const widgetType = field.meta?.extra?.widgetType;
    if ([
      FormWidgetType.RELATED_DATA,
      FormWidgetType.DATE_RANGE_PICKER,
      FormWidgetType.SUBFORM,
      FormWidgetType.FILE_UPLOADER,
      FormWidgetType.IMAGE_UPLOADER,
    ].includes(widgetType as FormWidgetType)) {
      return false;
    }
    return ![
      SystemField.DATA_TITLE,
      SystemField.UUID,
      SystemField.RELATED_SUB_FORM,
    ].includes(field.meta?.name as SystemField);
  }

  private getDefaultPublicQueryConditionFieldUIDs(table: Table) {
    return (table?.fields || [])
      .filter((field) => this.isPublicQueryConditionField(field))
      .map(field => field.uid);
  }

  private getPublicQuerySubTableFields(field: Field, formData?: NocodeFormData) {
    if (Array.isArray(field?.subTableFields) && field.subTableFields.length) {
      return field.subTableFields;
    }
    const subTableUID = field?.meta?.extra?.subTableUID?.[1];
    if (!subTableUID) {
      return [];
    }
    return formData?.tables?.find(table => table.uid === subTableUID)?.fields || [];
  }

  private isPublicQueryDisplayRootField(field: Field) {
    if (!field) {
      return false;
    }
    if (field.meta?.subType === "related") {
      return false;
    }
    return ![
      SystemField.DATA_TITLE,
      SystemField.RELATED_SUB_FORM,
    ].includes(field.meta?.name as SystemField);
  }

  private isPublicQueryDisplaySubField(field: Field) {
    if (!field) {
      return false;
    }
    if (field.meta?.subType === "related") {
      return false;
    }
    return !isSystemField(field) || field.meta?.name === SystemField.UUID;
  }

  private getDefaultPublicQueryDisplayFieldUIDs(table: Table, formData?: NocodeFormData) {
    const displayFieldUIDs: string[] = [];
    for (const field of table?.fields || []) {
      if (!this.isPublicQueryDisplayRootField(field)) {
        continue;
      }
      displayFieldUIDs.push(field.uid);
      for (const subField of this.getPublicQuerySubTableFields(field, formData)) {
        if (!this.isPublicQueryDisplaySubField(subField)) {
          continue;
        }
        displayFieldUIDs.push(subField.uid);
      }
    }
    return Array.from(new Set(displayFieldUIDs));
  }

  private getPublicQueryDisplayFieldParentMap(table: Table, formData?: NocodeFormData) {
    const map = new Map<string, string>();
    for (const field of table?.fields || []) {
      if (!this.isPublicQueryDisplayRootField(field)) {
        continue;
      }
      map.set(field.uid, field.uid);
      for (const subField of this.getPublicQuerySubTableFields(field, formData)) {
        if (!this.isPublicQueryDisplaySubField(subField)) {
          continue;
        }
        map.set(subField.uid, field.uid);
      }
    }
    return map;
  }

  private getNormalizedPublicQueryConfig(table: Table, formData?: NocodeFormData) {
    const defaultConditionFieldUIDs = this.getDefaultPublicQueryConditionFieldUIDs(table);
    const defaultDisplayFieldUIDs = this.getDefaultPublicQueryDisplayFieldUIDs(table, formData);
    const allowedConditionFieldUIDs = new Set<string>(defaultConditionFieldUIDs);
    const allowedDisplayFieldUIDs = new Set<string>(defaultDisplayFieldUIDs);
    const publicQuery = (table?.publish?.publicQuery || {}) as TablePublicQuery;
    const hasConditionFieldUIDsConfig = Array.isArray(publicQuery.conditionFieldUIDs);
    const hasDisplayFieldUIDsConfig = Array.isArray(publicQuery.displayFieldUIDs);
    const conditionFieldUIDs = Array.from(new Set((hasConditionFieldUIDsConfig
      ? (publicQuery.conditionFieldUIDs || [])
      : defaultConditionFieldUIDs
    ).filter(uid => allowedConditionFieldUIDs.has(uid as any))));
    const displayFieldUIDs = Array.from(new Set((hasDisplayFieldUIDsConfig
      ? (publicQuery.displayFieldUIDs || [])
      : defaultDisplayFieldUIDs
    ).filter(uid => allowedDisplayFieldUIDs.has(uid))));
    return {
      enabled: !!publicQuery.enabled,
      conditionFieldUIDs,
      displayFieldUIDs,
      shareExpireTime: publicQuery.shareExpireTime || null,
      isNeedPassword: !!publicQuery.isNeedPassword,
    };
  }

  private getPublicQueryFieldDisplayType(field?: Field): "account" | "department" | "node" | null {
    if (!field) {
      return null;
    }
    if (field.meta?.subType === "account" || [
      SystemField.CREATE_OWNER,
      SystemField.DATA_OWNER,
      SystemField.UPDATE_OWNER,
      SystemField.CURRENT_OWNER,
    ].includes(field.meta?.name as SystemField)) {
      return "account";
    }
    if (field.meta?.subType === "department") {
      return "department";
    }
    if (field.meta?.subType === "node" || field.meta?.name === SystemField.CURRENT_NODE) {
      return "node";
    }
    return null;
  }

  private getPublicQueryRelevantFields(table: Table, formData: NocodeFormData, fieldUIDs: Set<string>) {
    const result: Array<{ field: Field; tableUID: TableUID; displayType: "account" | "department" | "node" }> = [];
    for (const field of table?.fields || []) {
      const displayType = this.getPublicQueryFieldDisplayType(field);
      if (displayType && fieldUIDs.has(field.uid)) {
        result.push({
          field,
          tableUID: table.uid,
          displayType,
        });
      }
      const subTableUID = field?.meta?.extra?.subTableUID?.[1] as TableUID | undefined;
      for (const subField of this.getPublicQuerySubTableFields(field, formData)) {
        const subDisplayType = this.getPublicQueryFieldDisplayType(subField);
        if (!subDisplayType || !fieldUIDs.has(subField.uid) || !subTableUID) {
          continue;
        }
        result.push({
          field: subField,
          tableUID: subTableUID,
          displayType: subDisplayType,
        });
      }
    }
    return result;
  }

  private flattenPublicQueryDisplayValues(values: any[]): string[] {
    const result: string[] = [];
    const appendValue = (value: any) => {
      if (Array.isArray(value)) {
        value.forEach(appendValue);
        return;
      }
      if (value === null || value === undefined || value === "") {
        return;
      }
      result.push(String(value));
    };
    (values || []).forEach(appendValue);
    return Array.from(new Set(result));
  }

  private getPublicQueryDepartmentParentNames(
    departmentId: string,
    departmentMap: ReadonlyMap<string, CachedOrganizeDepartment>,
  ) {
    const parentNames: string[] = [];
    const visited = new Set<string>();
    let currentId = departmentId;
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const department = departmentMap.get(currentId);
      if (!department) {
        break;
      }
      if (department.name) {
        parentNames.unshift(department.name);
      }
      currentId = String(department.parent || "");
    }
    return parentNames;
  }

  private async buildPublicQueryDisplayMap(
    nocodeId: string,
    table: Table,
    formData: NocodeFormData,
    publicQuery: Pick<TablePublicQuery, "conditionFieldUIDs" | "displayFieldUIDs">,
  ) {
    const stage = this.getDefaultReadableStageCondition();
    const fieldUIDs = new Set<string>([
      ...(publicQuery.conditionFieldUIDs || []),
      ...(publicQuery.displayFieldUIDs || []),
    ]);
    const relevantFields = this.getPublicQueryRelevantFields(table, formData, fieldUIDs);
    const accountIds = new Set<string>();
    const departmentIds = new Set<string>();
    const nodeIdsByTable = new Map<TableUID, Set<string>>();

    await Promise.all(relevantFields.map(async ({ field, tableUID, displayType }) => {
      const values = await this.formDataService.distinct(nocodeId, tableUID, field.uid as any, { stage }, true).catch(() => []);
      const normalizedValues = this.flattenPublicQueryDisplayValues(values || []);
      if (displayType === "account") {
        normalizedValues.forEach((id) => accountIds.add(id));
        return;
      }
      if (displayType === "department") {
        normalizedValues.forEach((id) => departmentIds.add(id));
        return;
      }
      if (!nodeIdsByTable.has(tableUID)) {
        nodeIdsByTable.set(tableUID, new Set<string>());
      }
      normalizedValues.forEach((id) => nodeIdsByTable.get(tableUID)?.add(id));
    }));

    const allDepartments = await this.organizeCache.getAllDepartments();
    const departmentEntityMap = new Map(
      allDepartments
        .filter((item) => !item.deleteTime)
        .map((item) => [item.id, item] as const)
    );
    const users = await this.organizeCache.getUsersByIds(Array.from(accountIds));
    users.forEach((user) => {
      (user.departments || []).forEach((id) => {
        if (id) {
          departmentIds.add(String(id));
        }
      });
    });

    const departments = Array.from(departmentIds).reduce<Record<string, { id: string; name?: string; parentNames?: string[] }>>((result, id) => {
      const department = departmentEntityMap.get(id);
      result[id] = {
        id,
        name: department?.name || "",
        parentNames: this.getPublicQueryDepartmentParentNames(id, departmentEntityMap),
      };
      return result;
    }, {});

    const accounts = users.reduce<Record<string, { id: string; realname?: string; user?: string; phone?: string; departmentName?: string }>>((result, user) => {
      const firstDepartmentId = String(user.departments?.[0] || "");
      result[user.id] = {
        id: user.id,
        realname: user.realname || user.user || "",
        user: user.user || "",
        phone: user.phone || "",
        departmentName: departments[firstDepartmentId]?.name || "",
      };
      return result;
    }, {});

    const nodes = Array.from(nodeIdsByTable.entries()).reduce<Record<string, { id: string; name?: string }>>((result, [tableUID, nodeIds]) => {
      const process = formData?.formOptions?.[tableUID]?.process;
      const flows = getFlows(process);
      nodeIds.forEach((nodeId) => {
        if (!nodeId || result[nodeId]) {
          return;
        }
        result[nodeId] = {
          id: nodeId,
          name: getFlowById(flows, nodeId)?.options?.name || "",
        };
      });
      return result;
    }, {});

    return {
      accounts,
      departments,
      nodes,
    };
  }

  private assertPublicQueryAvailable(table?: Table) {
    const publicQuery = table?.publish?.publicQuery;
    if (!table || !publicQuery?.enabled) {
      throw new Error(global.i18next.t('projectServices.publicQueryNotEnabled'));
    }
    if (publicQuery.shareExpireTime && dayjs(publicQuery.shareExpireTime).isBefore(dayjs())) {
      throw new Error(global.i18next.t('projectServices.rowShareExpired'));
    }
  }

  private async getPublicQueryAccessContext(nocodeId: string, tableUID: TableUID) {
    const formSnapshot = await this.getPublicQuerySnapshot(nocodeId, tableUID);
    const { nocodeBody, nocodeMeta, table } = formSnapshot;
    if (!table) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    if (!nocodeBody?.formData) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    this.assertPublicQueryAvailable(table);
    const publicQuery = this.getNormalizedPublicQueryConfig(table, nocodeBody.formData);
    return {
      nocodeBody,
      nocodeMeta,
      table,
      publicQuery,
    };
  }

  async getPublicQueryAccess(nocodeId: string, tableUID: TableUID) {
    const { publicQuery } = await this.getPublicQueryAccessContext(nocodeId, tableUID);
    return {
      isNeedPassword: publicQuery.isNeedPassword,
    };
  }

  async visitPublicQuery(nocodeId: string, tableUID: TableUID, password: string) {
    const { table, publicQuery } = await this.getPublicQueryAccessContext(nocodeId, tableUID);
    if (!publicQuery.isNeedPassword) {
      return {
        success: true,
        token: this.buildPublicQueryToken(nocodeId, tableUID, ""),
      };
    }
    const currentPassword = table?.publish?.publicQuery?.password || "";
    if (!currentPassword || encodePassword(password) !== currentPassword) {
      throw new Error(global.i18next.t('projectServices.passwordError'));
    }
    return {
      success: true,
      token: this.buildPublicQueryToken(nocodeId, tableUID, currentPassword),
    };
  }

  async validatePublicQueryToken(nocodeId: string, tableUID: TableUID, token: string) {
    try {
      const tokenInfo = this.parsePublicQueryToken(token);
      if (tokenInfo.nocodeId !== nocodeId || tokenInfo.tableUID !== tableUID) {
        return false;
      }
      const { table, publicQuery } = await this.getPublicQueryAccessContext(nocodeId, tableUID);
      if (publicQuery.isNeedPassword) {
        return tokenInfo.passwordSegment === String(table?.publish?.publicQuery?.password || "");
      }
      return true;
    } catch {
      return false;
    }
  }

  async validatePublicQuery(nocodeId: string, tableUID: TableUID) {
    try {
      await this.getPublicQueryAccessContext(nocodeId, tableUID);
      return true;
    } catch {
      return false;
    }
  }

  async getPublicQueryBootstrap(nocodeId: string, tableUID: TableUID, token?: string) {
    const { nocodeBody, nocodeMeta, table, publicQuery } = await this.getPublicQueryAccessContext(nocodeId, tableUID);
    let runtimeToken = this.buildPublicQueryToken(nocodeId, tableUID, "");
    if (publicQuery.isNeedPassword) {
      const valid = await this.validatePublicQueryToken(nocodeId, tableUID, token || "");
      if (!valid) {
        throw new Error(global.i18next.t('projectServices.passwordError'));
      }
      runtimeToken = String(token || "");
    }
    const displayMap = await this.buildPublicQueryDisplayMap(nocodeId, table, nocodeBody.formData, publicQuery);
    const publisher = await this.buildPublishUserInfo(nocodeMeta);
    const reportAccount = this.buildReportAccount();

    return {
      token: runtimeToken,
      nocode: {
        id: nocodeMeta?.id || nocodeId,
        name: nocodeMeta?.name || table.alias,
      },
      table,
      formData: nocodeBody.formData,
      publicQuery,
      displayMap,
      queryFields: (table.fields || []).filter(field => publicQuery.conditionFieldUIDs.includes(field.uid)),
      displayFieldUIDs: publicQuery.displayFieldUIDs,
      publisher,
      reportAccount,
    };
  }

  private sanitizePublicQueryWhereCondition(where: any, allowedFieldUIDs: Set<string>): any {
    if (!where || typeof where !== "object" || Array.isArray(where)) {
      return null;
    }
    const next: Record<string, any> = {};

    if (Array.isArray(where.$and)) {
      const children = where.$and
        .map((item) => this.sanitizePublicQueryWhereCondition(item, allowedFieldUIDs))
        .filter(Boolean);
      if (children.length) {
        next.$and = children;
      }
    }
    if (Array.isArray(where.$or)) {
      const children = where.$or
        .map((item) => this.sanitizePublicQueryWhereCondition(item, allowedFieldUIDs))
        .filter(Boolean);
      if (children.length) {
        next.$or = children;
      }
    }
    if (where.$not) {
      const child = this.sanitizePublicQueryWhereCondition(where.$not, allowedFieldUIDs);
      if (child) {
        next.$not = child;
      }
    }

    for (const [fieldUID, value] of Object.entries(where)) {
      if (fieldUID.startsWith("$")) continue;
      if (!allowedFieldUIDs.has(fieldUID)) continue;
      if (value === "" || value === undefined || value === null) continue;
      if (Array.isArray(value) && !value.length) continue;
      next[fieldUID] = value;
    }
    return Object.keys(next).length ? next : null;
  }

  private sanitizePublicQueryFilters(
    filters: QueryOptions["filters"],
    tableUID: TableUID,
    allowedFieldUIDs: Set<string>,
  ): QueryOptions["filters"] {
    const where = filters?.[tableUID];
    if (!where) {
      return {};
    }
    const whereList = (Array.isArray(where) ? where : [where])
      .map(item => this.sanitizePublicQueryWhereCondition(item, allowedFieldUIDs))
      .filter(Boolean);
    if (!whereList.length) {
      return {};
    }
    return {
      [tableUID]: whereList,
    };
  }

  private sanitizePublicQueryOrderBy(orderBy: QueryOptions["orderBy"], allowedSortFieldUIDs: Set<string>) {
    if (!orderBy || typeof orderBy !== "object" || Array.isArray(orderBy)) {
      return undefined;
    }
    const nextOrderBy: Record<string, SortType> = {};
    for (const [fieldUID, value] of Object.entries(orderBy)) {
      if (!allowedSortFieldUIDs.has(fieldUID)) continue;
      const sortValue = Number(value);
      if (sortValue !== SortType.ASC && sortValue !== SortType.DESC) continue;
      nextOrderBy[fieldUID] = sortValue as SortType;
    }
    return Object.keys(nextOrderBy).length ? nextOrderBy : undefined;
  }

  private async getPublicQueryContextByToken(token: string) {
    const { nocodeId, tableUID, passwordSegment } = this.parsePublicQueryToken(token);
    const formSnapshot = await this.getPublicQuerySnapshot(nocodeId, tableUID);
    const { nocodeBody, table } = formSnapshot;
    if (!table) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    if (!nocodeBody?.formData) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    this.assertPublicQueryAvailable(table);
    const publicQuery = this.getNormalizedPublicQueryConfig(table, nocodeBody.formData);
    if (publicQuery.isNeedPassword) {
      const currentPassword = String(table?.publish?.publicQuery?.password || "");
      if (!currentPassword || passwordSegment !== currentPassword) {
        throw new Error(global.i18next.t('projectServices.passwordError'));
      }
    }
    return {
      nocodeId,
      table,
      formData: nocodeBody.formData,
      publicQuery,
    };
  }

  async getPublicQueryData(token: string, tableUIDs: TableUID[], options?: QueryOptions) {
    const { nocodeId, table, formData, publicQuery } = await this.getPublicQueryContextByToken(token);
    const requestTableUIDs = Array.from(new Set((tableUIDs || []).filter(Boolean)));
    if (!requestTableUIDs.length) {
      return [];
    }
    const buildEmptyBucket = (tableUID: TableUID): Bucket => {
      const targetTable = formData.tables?.find(item => item.uid === tableUID);
      return {
        tableId: tableUID,
        tableName: targetTable?.alias || tableUID,
        fields: targetTable?.fields || [],
        rows: [],
        count: 0,
      };
    };
    const allowedQueryFieldUIDs = new Set(publicQuery.conditionFieldUIDs);
    const selectedDisplayFieldUIDs = new Set(publicQuery.displayFieldUIDs);
    const displayFieldParentMap = this.getPublicQueryDisplayFieldParentMap(table, formData);
    const allowedDisplayRootFieldUIDs = new Set<string>();
    const allowedDisplaySubFieldUIDsByParent = new Map<string, Set<string>>();
    for (const fieldUID of selectedDisplayFieldUIDs) {
      const parentUID = displayFieldParentMap.get(fieldUID);
      if (!parentUID) {
        continue;
      }
      allowedDisplayRootFieldUIDs.add(parentUID);
      if (fieldUID === parentUID) {
        continue;
      }
      if (!allowedDisplaySubFieldUIDsByParent.has(parentUID)) {
        allowedDisplaySubFieldUIDsByParent.set(parentUID, new Set<string>());
      }
      const subFieldUIDs = allowedDisplaySubFieldUIDsByParent.get(parentUID);
      if (subFieldUIDs) {
        subFieldUIDs.add(fieldUID);
      }
    }
    const allowedSortFieldUIDs = new Set(allowedDisplayRootFieldUIDs);
    const uuidField = getUUIDSystemField(table.fields || []);
    if (uuidField?.uid) {
      allowedDisplayRootFieldUIDs.add(uuidField.uid);
    }
    const allowedDisplaySubTableMap = new Map<TableUID, {
      includeAllSubFields: boolean;
      selectedSubFieldUIDs: Set<string>;
      relationFieldUID: string;
    }>();
    for (const field of table.fields || []) {
      if (!field?.uid || !allowedDisplayRootFieldUIDs.has(field.uid)) {
        continue;
      }
      const isSubFormField = field.meta?.subType === "subForm" || field.meta?.extra?.widgetType === FormWidgetType.SUBFORM;
      if (!isSubFormField) {
        continue;
      }
      const subTableUID = field?.meta?.extra?.subTableUID?.[1];
      if (!subTableUID) {
        continue;
      }
      const subTable = formData.tables?.find(item => item.uid === subTableUID);
      const relationFieldUID = subTable?.fields?.find(item => item?.meta?.name === SystemField.KEY)?.uid;
      if (!subTable || !relationFieldUID) {
        continue;
      }
      const previousInfo = allowedDisplaySubTableMap.get(subTableUID);
      if (previousInfo) {
        const selectedSubFieldUIDs = new Set(allowedDisplaySubFieldUIDsByParent.get(field.uid) || []);
        const shouldIncludeAllSubFields = selectedDisplayFieldUIDs.has(field.uid) && selectedSubFieldUIDs.size === 0;
        previousInfo.includeAllSubFields = previousInfo.includeAllSubFields || shouldIncludeAllSubFields;
        for (const uid of selectedSubFieldUIDs) {
          previousInfo.selectedSubFieldUIDs.add(uid);
        }
        continue;
      }
      const selectedSubFieldUIDs = new Set(allowedDisplaySubFieldUIDsByParent.get(field.uid) || []);
      const shouldIncludeAllSubFields = selectedDisplayFieldUIDs.has(field.uid) && selectedSubFieldUIDs.size === 0;
      allowedDisplaySubTableMap.set(subTableUID, {
        includeAllSubFields: shouldIncludeAllSubFields,
        selectedSubFieldUIDs,
        relationFieldUID,
      });
    }
    const requestIncludesRootTable = requestTableUIDs.includes(table.uid);
    const requestSubTableUIDs = requestTableUIDs.filter(uid => allowedDisplaySubTableMap.has(uid));
    if (!requestIncludesRootTable && !requestSubTableUIDs.length) {
      return requestTableUIDs.map(uid => buildEmptyBucket(uid));
    }

    const queryOptions: QueryOptions = {
      ...(options || {}),
      filters: this.sanitizePublicQueryFilters(options?.filters, table.uid, allowedQueryFieldUIDs),
      orderBy: this.sanitizePublicQueryOrderBy(options?.orderBy, allowedSortFieldUIDs),
      stage: options?.stage || this.getDefaultReadableStageCondition(),
      formatData: true,
    };

    const maxPageSize = 100;
    if (typeof queryOptions.pageSize === "number" && queryOptions.pageSize > maxPageSize) {
      queryOptions.pageSize = maxPageSize;
    }
    if (typeof queryOptions.limit === "number" && queryOptions.limit > maxPageSize) {
      queryOptions.limit = maxPageSize;
    }

    let rootBucket: Bucket | null = null;
    if (requestIncludesRootTable) {
      const buckets = await this.formDataService._getData(formData, [table.uid], nocodeId, queryOptions);
      rootBucket = buckets.map((bucket) => {
        const rows = (bucket?.rows || []).map((row) => {
          const nextRow: Record<string, any> = {};
          for (const fieldUID of allowedDisplayRootFieldUIDs) {
            if (Object.prototype.hasOwnProperty.call(row, fieldUID)) {
              const rowValue = row[fieldUID];
              const selectedSubFieldUIDs = allowedDisplaySubFieldUIDsByParent.get(fieldUID);
              if (
                !Array.isArray(rowValue)
                || !selectedSubFieldUIDs?.size
                || selectedDisplayFieldUIDs.has(fieldUID)
              ) {
                nextRow[fieldUID] = rowValue;
                continue;
              }
              nextRow[fieldUID] = rowValue.map((subRow: Record<string, any>) => {
                if (!subRow || typeof subRow !== "object" || Array.isArray(subRow)) {
                  return subRow;
                }
                const nextSubRow: Record<string, any> = {};
                for (const [subFieldUID, value] of Object.entries(subRow)) {
                  if (
                    selectedSubFieldUIDs.has(subFieldUID)
                    || subFieldUID.startsWith("_")
                    || subFieldUID === "order"
                  ) {
                    nextSubRow[subFieldUID] = value;
                  }
                }
                return nextSubRow;
              });
            }
          }
          return nextRow;
        });
        return {
          ...bucket,
          rows,
        };
      })[0] || buildEmptyBucket(table.uid);
    }
    const subBucketMap = new Map<TableUID, Bucket>();
    for (const subTableUID of requestSubTableUIDs) {
      const subTableInfo = allowedDisplaySubTableMap.get(subTableUID);
      if (!subTableInfo) {
        continue;
      }
      const allowedSubFilterFieldUIDs = new Set<string>([subTableInfo.relationFieldUID]);
      if (subTableInfo.includeAllSubFields) {
        const subTable = formData.tables?.find(item => item.uid === subTableUID);
        for (const subField of subTable?.fields || []) {
          if (!isSystemField(subField)) {
            allowedSubFilterFieldUIDs.add(subField.uid);
          }
        }
      } else {
        for (const uid of subTableInfo.selectedSubFieldUIDs) {
          allowedSubFilterFieldUIDs.add(uid);
        }
      }
      const subQueryOptions: QueryOptions = {
        ...(options || {}),
        filters: this.sanitizePublicQueryFilters(options?.filters, subTableUID, allowedSubFilterFieldUIDs),
        orderBy: undefined,
        stage: options?.stage || {
          $nin: [FormDataStage.DRAFT, FormDataStage.DELETED],
        },
        formatData: true,
      };
      const subBuckets = await this.formDataService._getData(formData, [subTableUID], nocodeId, subQueryOptions);
      const subBucket = subBuckets[0] || buildEmptyBucket(subTableUID);
      if (subTableInfo.includeAllSubFields || !subTableInfo.selectedSubFieldUIDs.size) {
        subBucketMap.set(subTableUID, subBucket);
        continue;
      }
      subBucket.rows = (subBucket.rows || []).map((subRow) => {
        if (!subRow || typeof subRow !== "object" || Array.isArray(subRow)) {
          return subRow;
        }
        const nextSubRow: Record<string, any> = {};
        for (const [subFieldUID, value] of Object.entries(subRow)) {
          if (
            subTableInfo.selectedSubFieldUIDs.has(subFieldUID)
            || subFieldUID === subTableInfo.relationFieldUID
            || subFieldUID.startsWith("_")
            || subFieldUID === "order"
          ) {
            nextSubRow[subFieldUID] = value;
          }
        }
        return nextSubRow;
      });
      subBucketMap.set(subTableUID, subBucket);
    }

    return requestTableUIDs.map((tableUID) => {
      if (tableUID === table.uid) {
        return rootBucket || buildEmptyBucket(tableUID);
      }
      return subBucketMap.get(tableUID) || buildEmptyBucket(tableUID);
    });
  }

  async getPublicQueryDistinct(token: string, tableUID: TableUID, fieldUID: string, options?: QueryOptions, onlyValue = true) {
    const { nocodeId, table, formData, publicQuery } = await this.getPublicQueryContextByToken(token);
    if (tableUID !== table.uid || !publicQuery.conditionFieldUIDs.includes(fieldUID)) {
      throw new Error(global.i18next.t('projectServices.publicQueryNotEnabled'));
    }
    const queryOptions: QueryOptions = {
      ...(options || {}),
      filters: this.sanitizePublicQueryFilters(options?.filters, table.uid, new Set(publicQuery.conditionFieldUIDs)),
      stage: options?.stage || this.getDefaultReadableStageCondition(),
    };
    const res = await this.formDataService._distinct(
      formData,
      nocodeId,
      tableUID,
      fieldUID as any,
      queryOptions,
      { skipReadPermission: true },
    );
    if (!onlyValue) return res;
    return res.map(({ value }) => value);
  }

  private getRowShareFilePath(nocodeId: string) {
    return join(this.nocodesDir, nocodeId, "row-shares.json");
  }

  private getRowShareLockKey(nocodeId: string) {
    return `${nocodeId}:row-share`;
  }

  private async withRowShareLock<T>(nocodeId: string, fn: () => Promise<T>) {
    return await this.rowShareLock.acquire(this.getRowShareLockKey(nocodeId), fn);
  }

  private async readRowShares(nocodeId: string): Promise<RowShareRecord[]> {
    const filePath = this.getRowShareFilePath(nocodeId);
    if (!existsSync(filePath)) {
      return [];
    }
    const content = await readFile(filePath, "utf-8").catch(() => "[]");
    return JSON.parse(content || "[]");
  }

  private async saveRowShares(nocodeId: string, rowShares: RowShareRecord[]) {
    const filePath = this.getRowShareFilePath(nocodeId);
    await writeFile(filePath, JSON.stringify(rowShares, null, 2));
  }

  private createRowShareToken() {
    return randomBytes(18).toString("hex");
  }

  private createRowSharePassword() {
    return randomBytes(4).toString("hex");
  }

  private encryptRowShareAccessPassword(password: string) {
    if (!password) {
      return "";
    }
    return aes256Encode('652a6227894b94e67b6123aa38bb6dd8', '399d5d0f45823e5a', password);
  }

  private decryptRowShareAccessPassword(password: string) {
    if (!password) {
      return "";
    }
    try {
      return aes256Decode('652a6227894b94e67b6123aa38bb6dd8', '399d5d0f45823e5a', password);
    } catch {
      return password;
    }
  }

  private getRowSharePublishAccessConfig(table?: Table, scope?: RowShareAccessScope): RowShareAccessPublishConfig {
    const publish = table?.publish;
    if (scope === "internal") {
      return publish?.rowShareInternalAccess || {};
    }
    return publish?.rowSharePublicAccess || {};
  }

  private getRowShareRuntimeAccessConfig(rowShare?: RowShareRecord, scope?: RowShareAccessScope): RowShareAccessConfig {
    if (!rowShare) {
      return {};
    }
    return scope === "internal"
      ? (rowShare.internalAccess || {})
      : (rowShare.publicAccess || {});
  }

  private setRowShareRuntimeAccessConfig(rowShare: RowShareRecord, scope: RowShareAccessScope, access: RowShareAccessConfig) {
    if (scope === "internal") {
      rowShare.internalAccess = access;
      return;
    }
    rowShare.publicAccess = access;
  }

  private normalizeRowShareAccessConfig(access?: RowShareAccessConfig | null): RowShareAccessConfig {
    if (!access) {
      return {};
    }
    return {
      isNeedPassword: !!access.isNeedPassword,
      shareExpireTime: access.shareExpireTime ? Number(access.shareExpireTime) : null,
      password: access.password || "",
      passwordHash: access.passwordHash || "",
      encrypted: access.encrypted !== false,
    };
  }

  private sanitizeRowShareAccessConfig(access?: RowShareAccessConfig | null) {
    const normalized = this.normalizeRowShareAccessConfig(access);
    return {
      isNeedPassword: normalized.isNeedPassword,
      shareExpireTime: normalized.shareExpireTime || null,
      password: normalized.password
        ? (normalized.encrypted === false ? normalized.password : this.decryptRowShareAccessPassword(normalized.password))
        : "",
    };
  }

  private ensureRowShareAccessPassword(access: RowShareAccessConfig) {
    if (!access.isNeedPassword || this.getRowShareAccessPasswordHash(access)) {
      return false;
    }
    const password = this.createRowSharePassword();
    access.password = this.encryptRowShareAccessPassword(password);
    access.passwordHash = encodePassword(password);
    access.encrypted = true;
    return true;
  }

  private getRowShareAccessPasswordHash(access?: RowShareAccessConfig | null) {
    const normalized = this.normalizeRowShareAccessConfig(access);
    return String(normalized.passwordHash || "");
  }

  private updateRowShareAccessPasswordHash(access: RowShareAccessConfig) {
    if (!access.isNeedPassword) {
      return;
    }
    if (access.password && access.encrypted === false) {
      access.passwordHash = encodePassword(access.password);
      access.password = this.encryptRowShareAccessPassword(access.password);
      access.encrypted = true;
      return;
    }
    if (!access.passwordHash && access.password) {
      const password = access.encrypted === false
        ? access.password
        : this.decryptRowShareAccessPassword(access.password);
      access.passwordHash = encodePassword(password);
      access.password = this.encryptRowShareAccessPassword(password);
      access.encrypted = true;
    }
  }

  private syncRowShareAccessConfigByPublish(rowShare: RowShareRecord, table?: Table) {
    let changed = false;
    for (const scope of ["internal", "public"] as RowShareAccessScope[]) {
      const publishAccess = this.getRowSharePublishAccessConfig(table, scope);
      const access = this.normalizeRowShareAccessConfig(this.getRowShareRuntimeAccessConfig(rowShare, scope));
      const previousPasswordHash = access.passwordHash;
      const previousExpireTime = access.shareExpireTime;
      access.isNeedPassword = !!publishAccess.passwordEnabled;
      access.shareExpireTime = publishAccess.expireEnabled ? access.shareExpireTime : null;
      if (publishAccess.passwordEnabled) {
        changed = this.ensureRowShareAccessPassword(access) || changed;
      }
      this.updateRowShareAccessPasswordHash(access);
      if (access.passwordHash !== previousPasswordHash || access.shareExpireTime !== previousExpireTime) {
        changed = true;
      }
      this.setRowShareRuntimeAccessConfig(rowShare, scope, access);
    }
    return changed;
  }

  private async persistSyncedRowShareAccessIfNeeded(rowShare: RowShareRecord, table?: Table) {
    if (!this.syncRowShareAccessConfigByPublish(rowShare, table)) {
      return rowShare;
    }
    rowShare.updatedAt = Date.now();
    const rowShares = await this.readRowShares(rowShare.nocodeId);
    const currentShare = rowShares.find(item => item.id === rowShare.id);
    if (!currentShare) {
      return rowShare;
    }
    currentShare.internalAccess = this.normalizeRowShareAccessConfig(rowShare.internalAccess);
    currentShare.publicAccess = this.normalizeRowShareAccessConfig(rowShare.publicAccess);
    currentShare.updatedAt = rowShare.updatedAt;
    await this.saveRowShares(rowShare.nocodeId, rowShares);
    return currentShare;
  }

  private getEffectiveRowShareAccessConfig(rowShare: RowShareRecord, table: Table, scope: RowShareAccessScope) {
    const publishAccess = this.getRowSharePublishAccessConfig(table, scope);
    const access = this.normalizeRowShareAccessConfig(this.getRowShareRuntimeAccessConfig(rowShare, scope));
    return {
      ...access,
      isNeedPassword: !!publishAccess.passwordEnabled,
      shareExpireTime: publishAccess.expireEnabled ? access.shareExpireTime : null,
    };
  }

  private buildRowShareAccessToken(token: string, scope: RowShareAccessScope, passwordHash = "", accountId = "") {
    const normalizedAccountId = scope === "internal" ? String(accountId || "").trim() : "";
    const payload = `${token}.${scope}.${normalizedAccountId}`;
    const passwordSegment = String(passwordHash || "");
    const sign = encodePassword(`${payload}.${passwordSegment}`);
    return `${payload}.${passwordSegment}.${sign}`;
  }

  private parseRowShareAccessToken(accessToken: string) {
    const info = String(accessToken || "").split(".");
    if (info.length < 5) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    const token = info[0];
    const scope = info[1] as RowShareAccessScope;
    const accountId = info[2];
    const passwordSegment = info[3];
    const sign = info.slice(4).join(".");
    if (!["internal", "public"].includes(scope)) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    const normalizedAccountId = scope === "internal" ? accountId : "";
    if (encodePassword(`${token}.${scope}.${normalizedAccountId}.${passwordSegment}`) !== sign) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    return {
      token,
      scope,
      accountId: normalizedAccountId,
      passwordSegment,
    };
  }

  private assertRowShareAccessAvailable(access?: RowShareAccessConfig | null) {
    const normalized = this.normalizeRowShareAccessConfig(access);
    if (normalized.shareExpireTime && dayjs(normalized.shareExpireTime).isBefore(dayjs())) {
      throw new Error(global.i18next.t('projectServices.rowShareExpired'));
    }
  }

  private async resolvePublicRowShareVisitState(token: string) {
    let rawToken = String(token || "");
    let accessTokenInfo: ReturnType<ProjectService["parseRowShareAccessToken"]> | null = null;
    try {
      const parsed = this.parseRowShareAccessToken(rawToken);
      if (parsed.scope === "public") {
        rawToken = parsed.token;
        accessTokenInfo = parsed;
      }
    } catch {}
    const rowShare = await this.resolveRowShareByToken(rawToken, "public");
    return {
      rowShare,
      rawToken,
      accessTokenInfo,
    };
  }

  private assertRowShareVisitAuthorized(access: RowShareAccessConfig, accessTokenInfo?: { passwordSegment: string } | null) {
    this.assertRowShareAccessAvailable(access);
    if (!access.isNeedPassword) {
      return;
    }
    const currentPasswordHash = this.getRowShareAccessPasswordHash(access);
    if (!currentPasswordHash || accessTokenInfo?.passwordSegment !== currentPasswordHash) {
      throw new Error(global.i18next.t('projectServices.passwordError'));
    }
  }

  private getRowShareDefaultFieldsAuth(formData: NocodeFormData, table: Table) {
    const formElements = getFormElementsInfo(formData?.formOptions?.[table.uid]?.widget?.widgets || []);
    return formElements.reduce<Record<string, FieldAuthValue>>((prev, item) => {
      prev[item.uid] = FieldAuthValue.VISIBLE;
      return prev;
    }, {});
  }

  private async getRowShareInternalMemberFieldsAuth(nocodeBody: NocodeBody, tableId: TableUID) {
    const account = await this.formDataService.getAccount();
    if (isSystemAdminAccount(account)) {
      return "all";
    }
    const permissions = nocodeBody?.permissions?.field?.[tableId]?.[PermissionCategory.GET];
    if (isEmpty(permissions)) {
      return "all";
    }
    const fieldsAuth: Record<string, number> = {};
    let hasMatchedPermission = false;
    let hasCustomFieldRange = false;
    for (const permission of permissions) {
      if (permission.memberRange.rangeType === PermissionRangeType.CUSTOM) {
        const users = await this.workbenchService.getUsers(permission.memberRange.range);
        const userIds = users.map(user => user.id);
        if (!userIds.includes(account.id)) {
          continue;
        }
      }
      hasMatchedPermission = true;
      if (permission.fieldRange.rangeType === PermissionRangeType.ALL) {
        continue;
      }
      hasCustomFieldRange = true;
      assignFieldsAuth(fieldsAuth, permission.fieldRange.range || {});
    }
    if (!hasMatchedPermission || !hasCustomFieldRange || isEmpty(fieldsAuth)) {
      return "all";
    }
    return fieldsAuth as Record<string, FieldAuthValue>;
  }

  private getRowShareFieldsAuth(formData: NocodeFormData, table: Table) {
    const defaultFieldsAuth = this.getRowShareDefaultFieldsAuth(formData, table);
    const rowShareFieldsAuth = table.publish?.rowShareFieldsAuth;
    if (!rowShareFieldsAuth) {
      return defaultFieldsAuth;
    }
    return Object.keys(defaultFieldsAuth).reduce<Record<string, FieldAuthValue>>((prev, fieldUID) => {
      const fieldAuth = rowShareFieldsAuth[fieldUID];
      prev[fieldUID] = [FieldAuthValue.HIDDEN, FieldAuthValue.VISIBLE, FieldAuthValue.VISIBLE_EDITABLE].includes(fieldAuth)
        ? fieldAuth
        : defaultFieldsAuth[fieldUID];
      return prev;
    }, {});
  }

  private getRowShareFieldByUID(table: Table, fieldUID?: string | null) {
    if (!fieldUID) {
      return null;
    }
    return table.fields.find(item => item.meta?.uid === fieldUID || item.uid === fieldUID) || null;
  }

  private getRowShareWidgetFieldUIDMap(formData: NocodeFormData, table: Table) {
    const fieldUIDMap = new Map<string, string>();
    for (const field of table.fields || []) {
      if (field.meta?.uid) {
        fieldUIDMap.set(field.meta.uid, field.uid);
      }
      fieldUIDMap.set(field.uid, field.uid);
    }

    const formElements = getFormElementsInfo(formData?.formOptions?.[table.uid]?.widget?.widgets || []);
    for (const item of formElements) {
      const candidateUIDs = [item.uid, ...(item.path || []).slice().reverse()];
      const field = candidateUIDs
        .map(uid => this.getRowShareFieldByUID(table, uid))
        .find(currentField => !!currentField);
      if (field?.uid) {
        fieldUIDMap.set(item.uid, field.uid);
      }
    }

    return fieldUIDMap;
  }

  private canRowShareEditField(field?: Field) {
    if (!field) return false;
    if (isSystemField(field)) return false;
    const widgetType = String(field.meta?.extra?.widgetType || "");
    if (widgetType.includes("serialNumber") || widgetType.includes("formula")) return false;
    return true;
  }

  private getRowShareEditableFieldUIDs(formData: NocodeFormData, table: Table) {
    const fieldsAuth = this.getRowShareFieldsAuth(formData, table);
    const widgetFieldUIDMap = this.getRowShareWidgetFieldUIDMap(formData, table);
    const editableFieldUIDs = new Set<ViewActionFieldId>();
    for (const [widgetUID, auth] of Object.entries(fieldsAuth)) {
      if (auth !== FieldAuthValue.VISIBLE_EDITABLE) {
        continue;
      }
      const field = this.getRowShareFieldByUID(table, widgetFieldUIDMap.get(widgetUID));
      if (field?.uid && this.canRowShareEditField(field)) {
        editableFieldUIDs.add(field.uid);
      }
    }
    return [...editableFieldUIDs];
  }

  private getAllEditableFieldUIDs(table: Table) {
    return (table.fields || [])
      .filter(field => this.canRowShareEditField(field))
      .map<ViewActionFieldId>(field => field.uid);
  }

  private getEditableFieldUIDsByFieldsAuth(
    formData: NocodeFormData,
    table: Table,
    fieldsAuth: Record<string, FieldAuthValue> | "all",
  ) {
    if (fieldsAuth === "all") {
      return this.getAllEditableFieldUIDs(table);
    }
    const widgetFieldUIDMap = this.getRowShareWidgetFieldUIDMap(formData, table);
    const editableFieldUIDs = new Set<ViewActionFieldId>();
    for (const [widgetUID, auth] of Object.entries(fieldsAuth || {})) {
      if (auth !== FieldAuthValue.VISIBLE_EDITABLE) {
        continue;
      }
      const field = this.getRowShareFieldByUID(table, widgetFieldUIDMap.get(widgetUID));
      if (field?.uid && this.canRowShareEditField(field)) {
        editableFieldUIDs.add(field.uid);
      }
    }
    return [...editableFieldUIDs];
  }

  private getVisibleFieldUIDsByFieldsAuth(
    formData: NocodeFormData,
    table: Table,
    fieldsAuth: Record<string, FieldAuthValue> | "all",
  ) {
    if (fieldsAuth === "all") {
      return new Set((table.fields || []).map(field => field.uid));
    }
    const widgetFieldUIDMap = this.getRowShareWidgetFieldUIDMap(formData, table);
    const visibleFieldUIDs = new Set<string>();
    for (const [widgetUID, auth] of Object.entries(fieldsAuth || {})) {
      if (auth === FieldAuthValue.HIDDEN) {
        continue;
      }
      const field = this.getRowShareFieldByUID(table, widgetFieldUIDMap.get(widgetUID));
      if (field?.uid) {
        visibleFieldUIDs.add(field.uid);
      }
    }
    return visibleFieldUIDs;
  }

  private getInternalShareEditableFieldUIDs(
    formData: NocodeFormData,
    table: Table,
    memberFieldsAuth: Record<string, FieldAuthValue> | "all",
  ) {
    return this.getEditableFieldUIDsByFieldsAuth(formData, table, memberFieldsAuth);
  }

  private getRowShareVisibleFieldUIDs(formData: NocodeFormData, table: Table) {
    const fieldsAuth = this.getRowShareFieldsAuth(formData, table);
    const widgetFieldUIDMap = this.getRowShareWidgetFieldUIDMap(formData, table);
    return new Set<string>(
      Object.keys(fieldsAuth)
        .filter((fieldUID) => fieldsAuth[fieldUID] !== FieldAuthValue.HIDDEN)
        .map((fieldUID) => widgetFieldUIDMap.get(fieldUID) || fieldUID)
    );
  }

  private sanitizeRowShareRow(row: Row, visibleFieldUIDs: Set<string>) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return row;
    }
    return Object.entries(row).reduce<Row>((prev, [key, value]) => {
      const baseFieldUID = key.endsWith("_entity") ? key.slice(0, -7) : key;
      if (key.startsWith("_") || key === "order" || visibleFieldUIDs.has(baseFieldUID)) {
        prev[key] = value;
      }
      return prev;
    }, {});
  }

  private sanitizeRowShareBucket(bucket: Bucket, rootTableUID: TableUID, visibleFieldUIDs: Set<string>) {
    if (!bucket || bucket.tableId !== rootTableUID) {
      return bucket;
    }
    return {
      ...bucket,
      fields: (bucket.fields || []).filter((field) => visibleFieldUIDs.has(field.uid)),
      rows: (bucket.rows || []).map((row) => this.sanitizeRowShareRow(row, visibleFieldUIDs)),
    };
  }

  private async readRowShareFormData(formData: NocodeFormData, nocodeId: string, table: Table, rowUUID: string) {
    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField) {
      throw new Error(global.i18next.t('projectServices.rowShareUuidFieldNotFound'));
    }
    const { buckets } = await this.connectionUtils.readConnectionData(formData, false, nocodeId, unique(), {}, {
      tableUIDs: [table.uid],
      queryOptions: {
        filters: {
          [table.uid]: [{
            [uuidField.uid]: rowUUID,
          }],
        },
        stage: {
          $ne: null,
        },
        formatData: true,
      },
    });
    const bucket = buckets?.find(item => item.tableId === table.uid) || buckets?.[0];
    let row = bucket?.rows?.[0];
    if (!row) {
      throw new Error(global.i18next.t('projectServices.rowShareRowNotFound'));
    }
    [row] = await this.formDataService.fillSubFormField(
      [row],
      nocodeId,
      table,
      formData,
      {},
      false,
      true,
    );
    if (!row) {
      throw new Error(global.i18next.t('projectServices.rowShareRowNotFound'));
    }
    return row;
  }

  private async getRowShareRow(formData: NocodeFormData, nocodeId: string, table: Table, rowUUID: string) {
    return await this.readRowShareFormData(formData, nocodeId, table, rowUUID);
  }

  private async assertRowShareCurrentAccountReadable(nocodeId: string, table: Table, rowUUID: string, formData?: NocodeFormData) {
    const targetFormData = formData || (await this.getNocodeBody(nocodeId))?.formData;
    if (!targetFormData) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    await this.readRowShareFormData(targetFormData, nocodeId, table, rowUUID);
  }

  private isPublicRowShareScopedSubTable(rootTable: Table, tableUID: TableUID) {
    return (rootTable.fields || []).some((field) => field?.meta?.extra?.subTableUID?.[1] === tableUID);
  }

  private getPublicRowShareBaseFilter(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    nocodeId: string,
    rootTable: Table,
    tableUID: TableUID,
    rowUUID: string,
  ) {
    if (tableUID === rootTable.uid) {
      const uuidField = getUUIDSystemField(rootTable.fields);
      if (!uuidField) {
        throw new Error(global.i18next.t('projectServices.rowShareUuidFieldNotFound'));
      }
      return {
        [uuidField.uid]: rowUUID,
      };
    }
    if (!this.isPublicRowShareScopedSubTable(rootTable, tableUID)) {
      return null;
    }
    const targetTable = this.resolvePublicFormDataTableSource(nocodeBody, nocodeId, tableUID).table;
    const relationField = targetTable?.fields?.find(item => item?.meta?.name === SystemField.KEY);
    if (!targetTable || !relationField) {
      throw new Error(global.i18next.t('projectServices.rowShareNotEnabled'));
    }
    return {
      [relationField.uid]: rowUUID,
    };
  }

  private appendPublicRowShareBaseFilters(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    nocodeId: string,
    rootTable: Table,
    rowShare: RowShareRecord,
    tableUIDs: TableUID[],
    filters?: QueryOptions["filters"],
  ) {
    const nextFilters: NonNullable<QueryOptions["filters"]> = { ...(filters || {}) };
    for (const tableUID of tableUIDs) {
      const baseFilter = this.getPublicRowShareBaseFilter(nocodeBody, nocodeId, rootTable, tableUID, rowShare.rowUUID);
      if (!baseFilter) {
        continue;
      }
      const currentFilter = nextFilters[tableUID];
      nextFilters[tableUID] = currentFilter
        ? [...(Array.isArray(currentFilter) ? currentFilter : [currentFilter]), baseFilter]
        : [baseFilter];
    }
    return nextFilters;
  }

  private assertPublicRowShareFieldReadable(
    tableUID: TableUID,
    fieldUID: string,
    rootTableUID: TableUID,
    visibleFieldUIDs: Set<string>,
  ) {
    if (tableUID === rootTableUID && !visibleFieldUIDs.has(fieldUID)) {
      throw new Error(global.i18next.t('projectServices.rowShareNotEnabled'));
    }
  }

  private assertRowShareAvailable(table?: Table, scope: "internal" | "public" = "internal") {
    const publish = table?.publish;
    if (!table || !publish?.rowShareEnabled) {
      throw new Error(global.i18next.t('projectServices.rowShareNotEnabled'));
    }
  }

  private normalizeRowShareRecord(rowShare: RowShareRecord) {
    if (!rowShare) {
      return rowShare;
    }
    if (!rowShare.publicToken && rowShare.token) {
      rowShare.publicToken = rowShare.token;
    }
    if (!rowShare.internalToken) {
      rowShare.internalToken = this.createRowShareToken();
    }
    rowShare.internalAccess = this.normalizeRowShareAccessConfig(rowShare.internalAccess);
    rowShare.publicAccess = this.normalizeRowShareAccessConfig(rowShare.publicAccess);
    return rowShare;
  }

  private async resolveRowShareByToken(token: string, scope: "internal" | "public") {
    const nocodeIds = await readdir(this.nocodesDir).catch(() => []);
    for (const nocodeId of nocodeIds) {
      const rowShares = await this.readRowShares(nocodeId);
      const target = rowShares.find(item => {
        if (item.disabled) {
          return false;
        }
        const currentToken = scope === "public"
          ? (item.publicToken || item.token)
          : item.internalToken;
        return currentToken === token;
      });
      if (target) {
        return this.normalizeRowShareRecord(target);
      }
    }
    throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
  }

  async createOrGetRowShare(nocodeId: string, tableUID: TableUID, rowUUID: string, accountId: string) {
    const nocodeBody = await this.getNocodeBody(nocodeId);
    const formData = nocodeBody?.formData;
    const table = formData?.tables?.find(item => item.uid === tableUID);
    if (!table) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    this.assertRowShareAvailable(table, "internal");
    await this.getRowShareRow(formData, nocodeId, table, rowUUID);

    return await this.withRowShareLock(nocodeId, async () => {
      const rowShares = await this.readRowShares(nocodeId);
      let rowShare = rowShares.find(item => !item.disabled && item.tableUID === tableUID && item.rowUUID === rowUUID);
      if (!rowShare) {
        const currentTime = Date.now();
        rowShare = {
          id: unique(),
          internalToken: this.createRowShareToken(),
          publicToken: this.createRowShareToken(),
          nocodeId,
          tableUID,
          rowUUID,
          internalAccess: {},
          publicAccess: {},
          createdBy: accountId,
          createdAt: currentTime,
          updatedAt: currentTime,
        };
        rowShares.push(rowShare);
      }
      this.normalizeRowShareRecord(rowShare);
      await this.persistSyncedRowShareAccessIfNeeded(rowShare, table);
      await this.saveRowShares(nocodeId, rowShares);
      return rowShare;
    });
  }

  private async getRowShareBootstrapByToken(token: string, scope: "internal" | "public", accessToken?: string) {
    const rowShare = await this.resolveRowShareByToken(token, scope);
    const nocodeMeta = await this.getNocodeMeta(rowShare.nocodeId);
    const publisher = await this.buildPublishUserInfo(nocodeMeta);
    const reportAccount = this.buildReportAccount();
    let nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">;
    let formData: NocodeFormData;
    let table: Table;
    let sourceNocodeId = rowShare.nocodeId;
    if (scope === "public") {
      const publicContext = await this.getPublicRowShareContext(token, accessToken);
      nocodeBody = publicContext.nocodeBody;
      formData = publicContext.formData;
      table = publicContext.table;
      sourceNocodeId = publicContext.sourceNocodeId;
    } else {
      const currentBody = await this.getNocodeBody(rowShare.nocodeId);
      formData = currentBody?.formData;
      table = formData?.tables?.find(item => item.uid === rowShare.tableUID);
      if (!table) {
        throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
      }
      this.assertRowShareAvailable(table, scope);
      nocodeBody = currentBody;
    }

    const memberFieldsAuth = scope === "internal"
      ? await this.getRowShareInternalMemberFieldsAuth(nocodeBody as NocodeBody, table.uid)
      : "all";
    const fieldsAuth = scope === "internal"
      ? memberFieldsAuth
      : this.getRowShareFieldsAuth(formData, table);
    const visibleFieldUIDs = scope === "internal"
      ? this.getVisibleFieldUIDsByFieldsAuth(formData, table, memberFieldsAuth)
      : this.getRowShareVisibleFieldUIDs(formData, table);
    const row = this.sanitizeRowShareRow(
      await this.getRowShareRow(formData, sourceNocodeId, table, rowShare.rowUUID),
      visibleFieldUIDs,
    );
    const editableFieldUIDs = scope === "internal"
      ? this.getInternalShareEditableFieldUIDs(formData, table, memberFieldsAuth)
      : this.getRowShareEditableFieldUIDs(formData, table);

    return {
      share: rowShare,
      nocode: {
        id: nocodeMeta?.id || rowShare.nocodeId,
        name: nocodeMeta?.name || table.alias,
      },
      publisher,
      reportAccount,
      formData,
      table,
      row,
      fieldsAuth,
      memberFieldsAuth,
      hasEditableFields: editableFieldUIDs.length > 0,
    };
  }

  private normalizeRowShareLinkedTableUID(value: unknown) {
    if (Array.isArray(value)) {
      return value[1] || null;
    }
    if (typeof value === "string") {
      if (value.includes(",")) {
        return value.split(",")[1] || null;
      }
      const ids = value.split(".");
      if (ids.length >= 3) {
        return ids[1] || null;
      }
      return value;
    }
    return null;
  }

  private resolveAccessibleLinkedTableUIDs(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    value: unknown,
  ) {
    const linkedTableUID = this.normalizeRowShareLinkedTableUID(value);
    if (!linkedTableUID) {
      return [];
    }
    const tableUIDs = new Set<TableUID>();
    const currentTables = nocodeBody?.formData?.tables || [];
    const otherTables = (nocodeBody?.otherDataSources || []).flatMap(source => source?.tables || []);
    for (const table of [...currentTables, ...otherTables]) {
      if (table?.uid === linkedTableUID || table?.meta?.uid === linkedTableUID) {
        tableUIDs.add(table.uid as TableUID);
      }
    }
    return [...tableUIDs];
  }

  private collectRowShareWidgetReferencedTableUIDs(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    value: unknown,
    tableUIDSet: Set<TableUID>,
    result: Set<TableUID>,
  ) {
    if (Array.isArray(value)) {
      for (const tableUID of this.resolveAccessibleLinkedTableUIDs(nocodeBody, value)) {
        if (tableUIDSet.has(tableUID)) {
          result.add(tableUID);
        }
      }
      for (const item of value) {
        this.collectRowShareWidgetReferencedTableUIDs(nocodeBody, item, tableUIDSet, result);
      }
      return;
    }
    if (typeof value === "string") {
      for (const tableUID of this.resolveAccessibleLinkedTableUIDs(nocodeBody, value)) {
        if (tableUIDSet.has(tableUID)) {
          result.add(tableUID);
        }
      }
      return;
    }
    if (!value || typeof value !== "object") {
      return;
    }
    for (const item of Object.values(value as Record<string, unknown>)) {
      this.collectRowShareWidgetReferencedTableUIDs(nocodeBody, item, tableUIDSet, result);
    }
  }

  private collectPublicRowShareAccessibleTableUIDs(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    rootTableUID: TableUID,
  ) {
    const allowed = new Set<TableUID>();
    const allTableUIDs = new Set<TableUID>([
      ...(nocodeBody?.formData?.tables || []).map(item => item.uid),
      ...(nocodeBody?.otherDataSources || []).flatMap(source => (source?.tables || []).map(item => item.uid)),
    ]);
    const queue: TableUID[] = [rootTableUID];
    while (queue.length) {
      const tableUID = queue.shift();
      if (!tableUID || allowed.has(tableUID)) continue;
      allowed.add(tableUID);
      const table = getNocodeDataSourceTableByUID(nocodeBody, tableUID)?.table;
      if (!table) continue;
      for (const field of table.fields || []) {
        const extra = (field.meta?.extra || {}) as Record<string, any>;
        const linkedTableUIDs = [
          ...this.resolveAccessibleLinkedTableUIDs(nocodeBody, extra.subTableUID),
          ...this.resolveAccessibleLinkedTableUIDs(nocodeBody, extra.relatedTableUID),
          ...this.resolveAccessibleLinkedTableUIDs(nocodeBody, extra.selectLinkForm),
          ...this.resolveAccessibleLinkedTableUIDs(nocodeBody, extra.primaryTable),
        ];
        for (const linkedTableUID of linkedTableUIDs) {
          if (!allowed.has(linkedTableUID)) {
            queue.push(linkedTableUID);
          }
        }
      }
    }
    const formWidget = nocodeBody?.formData?.formOptions?.[rootTableUID]?.widget;
    if (formWidget) {
      this.collectRowShareWidgetReferencedTableUIDs(nocodeBody, formWidget, allTableUIDs, allowed);
    }
    return allowed;
  }

  private async getPublicRowShareContext(token: string, accessToken?: string) {
    const visitState = await this.resolvePublicRowShareVisitState(accessToken || token);
    const shareToken = accessToken ? token : visitState.rawToken;
    if (accessToken && visitState.rawToken !== token) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    const rowShare = visitState.rowShare;
    const nocodeBody = await this.getNocodeBodyWithOtherDataSources(rowShare.nocodeId);
    const { formData, table, sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, rowShare.nocodeId, rowShare.tableUID);
    if (!formData || !table) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    this.assertRowShareAvailable(table, "public");
    await this.persistSyncedRowShareAccessIfNeeded(rowShare, table);
    this.assertRowShareVisitAuthorized(
      this.normalizeRowShareAccessConfig(rowShare.publicAccess),
      visitState.accessTokenInfo,
    );
    return {
      token: shareToken,
      rowShare,
      nocodeBody,
      formData,
      table,
      sourceNocodeId,
    };
  }

  private assertPublicRowShareTableAccess(
    nocodeBody: Pick<NocodeBody, "formData" | "otherDataSources">,
    rootTableUID: TableUID,
    tableUIDs: TableUID[],
  ) {
    const allowedTableUIDs = this.collectPublicRowShareAccessibleTableUIDs(nocodeBody, rootTableUID);
    const invalidTableUID = tableUIDs.find((tableUID) => !allowedTableUIDs.has(tableUID));
    if (invalidTableUID) {
      throw new Error(global.i18next.t('projectServices.rowShareNotEnabled'));
    }
  }

  async getRowShareBootstrap(token: string, accessToken?: string) {
    const rowShare = await this.resolveRowShareByToken(token, "internal");
    const nocodeBody = await this.getNocodeBody(rowShare.nocodeId);
    const table = nocodeBody?.formData?.tables?.find(item => item.uid === rowShare.tableUID);
    if (!table) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    this.assertRowShareAvailable(table, "internal");
    await this.persistSyncedRowShareAccessIfNeeded(rowShare, table);
    const access = this.getEffectiveRowShareAccessConfig(rowShare, table, "internal");
    this.assertRowShareAccessAvailable(access);
    if (access.isNeedPassword) {
      const account = await this.formDataService.getAccount().catch(() => null);
      const valid = await this.validateRowShareAccessToken(token, "internal", String(accessToken || ""), account?.id || "");
      if (!valid) {
        throw new Error(global.i18next.t('projectServices.passwordError'));
      }
    }
    return await this.getRowShareBootstrapByToken(token, "internal");
  }

  async getPublicRowShareBootstrap(token: string, accessToken?: string) {
    const visitState = await this.resolvePublicRowShareVisitState(accessToken || token);
    if (visitState.rawToken !== token) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    return await this.getRowShareBootstrapByToken(visitState.rawToken, "public", accessToken);
  }

  async getRowShareAccess(token: string, scope: RowShareAccessScope, detail = false) {
    const rowShare = await this.resolveRowShareByToken(token, scope);
    const nocodeBody = await this.getNocodeBody(rowShare.nocodeId);
    const table = nocodeBody?.formData?.tables?.find(item => item.uid === rowShare.tableUID);
    if (!table) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    this.assertRowShareAvailable(table, scope);
    await this.persistSyncedRowShareAccessIfNeeded(rowShare, table);
    if (detail) {
      await this.assertRowShareCurrentAccountReadable(rowShare.nocodeId, table, rowShare.rowUUID, nocodeBody?.formData);
    }
    const access = this.getEffectiveRowShareAccessConfig(rowShare, table, scope);
    let expired = false;
    try {
      this.assertRowShareAccessAvailable(access);
    } catch (error: any) {
      if (!detail || error?.message !== global.i18next.t('projectServices.rowShareExpired')) {
        throw error;
      }
      expired = true;
    }
    const publishAccess = this.getRowSharePublishAccessConfig(table, scope);
    const result = {
      publish: {
        passwordEnabled: !!publishAccess.passwordEnabled,
        expireEnabled: !!publishAccess.expireEnabled,
      },
      isNeedPassword: !!access.isNeedPassword,
    } as Record<string, any>;
    if (detail) {
      result.access = this.sanitizeRowShareAccessConfig(access);
      result.expired = expired;
    }
    return result;
  }

  async updateRowShareAccessConfig(
    token: string,
    scope: RowShareAccessScope,
    accessPayload: Partial<RowShareAccessConfig>,
    account?: Partial<Account>,
  ) {
    if (!this.isAdminAccount(account)) {
      throw new Error(global.i18next.t('projectServices.noPermissions'));
    }
    const rowShare = await this.resolveRowShareByToken(token, scope);
    const nocodeBody = await this.getNocodeBody(rowShare.nocodeId);
    const table = nocodeBody?.formData?.tables?.find(item => item.uid === rowShare.tableUID);
    if (!table) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    this.assertRowShareAvailable(table, scope);
    const publishAccess = this.getRowSharePublishAccessConfig(table, scope);
    await this.persistSyncedRowShareAccessIfNeeded(rowShare, table);
    const currentAccess = this.getRowShareRuntimeAccessConfig(rowShare, scope);
    const nextAccess: RowShareAccessConfig = {
      ...currentAccess,
      isNeedPassword: publishAccess.passwordEnabled ? !!accessPayload?.isNeedPassword : false,
      shareExpireTime: publishAccess.expireEnabled
        ? (accessPayload?.shareExpireTime ? Number(accessPayload.shareExpireTime) : null)
        : null,
      password: typeof accessPayload?.password === "string" ? accessPayload.password : currentAccess.password,
      passwordHash: currentAccess.passwordHash,
      encrypted: typeof accessPayload?.password === "string" ? false : currentAccess.encrypted,
    };
    if (nextAccess.shareExpireTime && dayjs(nextAccess.shareExpireTime).isBefore(dayjs())) {
      throw new Error(global.i18next.t('projectServices.rowShareExpired'));
    }
    if (nextAccess.isNeedPassword && !String(nextAccess.password || "").trim()) {
      throw new Error(global.i18next.t('projectServices.passwordError'));
    }
    this.updateRowShareAccessPasswordHash(nextAccess);
    this.setRowShareRuntimeAccessConfig(rowShare, scope, nextAccess);
    rowShare.updatedAt = Date.now();
    const rowShares = await this.readRowShares(rowShare.nocodeId);
    const currentShare = rowShares.find(item => item.id === rowShare.id);
    if (currentShare) {
      this.setRowShareRuntimeAccessConfig(currentShare, scope, nextAccess);
      currentShare.updatedAt = rowShare.updatedAt;
      await this.saveRowShares(rowShare.nocodeId, rowShares);
    }
    return {
      access: this.sanitizeRowShareAccessConfig(nextAccess),
    };
  }

  async visitRowShare(token: string, scope: RowShareAccessScope, password: string, accountId = "") {
    const rowShare = await this.resolveRowShareByToken(token, scope);
    const nocodeBody = await this.getNocodeBody(rowShare.nocodeId);
    const table = nocodeBody?.formData?.tables?.find(item => item.uid === rowShare.tableUID);
    if (!table) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    this.assertRowShareAvailable(table, scope);
    await this.persistSyncedRowShareAccessIfNeeded(rowShare, table);
    const access = this.getEffectiveRowShareAccessConfig(rowShare, table, scope);
    this.assertRowShareAccessAvailable(access);
    const normalizedAccountId = scope === "internal" ? String(accountId || "").trim() : "";
    if (scope === "internal" && !normalizedAccountId) {
      throw new Error(global.i18next.t('projectServices.passwordError'));
    }
    if (!access.isNeedPassword) {
      return {
        success: true,
        token: this.buildRowShareAccessToken(token, scope, "", normalizedAccountId),
      };
    }
    const currentPasswordHash = this.getRowShareAccessPasswordHash(access);
    if (!currentPasswordHash || encodePassword(password) !== currentPasswordHash) {
      throw new Error(global.i18next.t('projectServices.passwordError'));
    }
    return {
      success: true,
      token: this.buildRowShareAccessToken(token, scope, currentPasswordHash, normalizedAccountId),
    };
  }

  async validateRowShareAccessToken(token: string, scope: RowShareAccessScope, accessToken: string, accountId = "") {
    try {
      const tokenInfo = this.parseRowShareAccessToken(accessToken);
      if (tokenInfo.token !== token || tokenInfo.scope !== scope) {
        return false;
      }
      const normalizedAccountId = scope === "internal" ? String(accountId || "").trim() : "";
      if (scope === "internal" && tokenInfo.accountId !== normalizedAccountId) {
        return false;
      }
      const rowShare = await this.resolveRowShareByToken(token, scope);
      const nocodeBody = await this.getNocodeBody(rowShare.nocodeId);
      const table = nocodeBody?.formData?.tables?.find(item => item.uid === rowShare.tableUID);
      if (!table) {
        return false;
      }
      await this.persistSyncedRowShareAccessIfNeeded(rowShare, table);
      const access = this.getEffectiveRowShareAccessConfig(rowShare, table, scope);
      this.assertRowShareAccessAvailable(access);
      if (access.isNeedPassword) {
        return tokenInfo.passwordSegment === this.getRowShareAccessPasswordHash(access);
      }
      return true;
    } catch {
      return false;
    }
  }

  async getPublicRowShareReadFormData(token: string, tableId?: TableUID, uuid?: string, accessToken?: string) {
    const { rowShare, nocodeBody, formData, table } = await this.getPublicRowShareContext(token, accessToken);
    const targetTableUID = tableId || rowShare.tableUID;
    this.assertPublicRowShareTableAccess(nocodeBody, table.uid, [targetTableUID]);
    const { formData: targetFormData, table: targetTable, sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, rowShare.nocodeId, targetTableUID);
    const targetUUID = uuid || (targetTableUID === rowShare.tableUID ? rowShare.rowUUID : undefined);
    if (!targetFormData || !targetTable || !targetUUID) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    if (targetTableUID === rowShare.tableUID && targetUUID !== rowShare.rowUUID) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    const visibleFieldUIDs = this.getRowShareVisibleFieldUIDs(formData, table);
    let row = await this.readRowShareFormData(targetFormData, sourceNocodeId, targetTable, targetUUID);
    if (targetTableUID === rowShare.tableUID) {
      row = this.sanitizeRowShareRow(row, visibleFieldUIDs);
    }
    return {
      formData: targetFormData,
      otherDataSources: nocodeBody.otherDataSources || [],
      row,
      fieldsAuth: targetTableUID === rowShare.tableUID ? this.getRowShareFieldsAuth(formData, table) : "all",
    };
  }

  async getPublicFormShareReadFormData(nocodeId: string, rootTableUID: TableUID, tableId?: TableUID, uuid?: string, visitToken?: string) {
    const { nocodeBody } = await this.getPublicFormShareContext(nocodeId, rootTableUID, visitToken);
    const targetTableUID = tableId || rootTableUID;
    this.assertPublicFormTableAccess(nocodeBody, rootTableUID, [targetTableUID]);
    const { formData, table, sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, nocodeId, targetTableUID);
    if (!formData || !table) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    return {
      formData,
      otherDataSources: nocodeBody.otherDataSources || [],
      row: uuid ? await this.readRowShareFormData(formData, sourceNocodeId, table, uuid) : undefined,
      fieldsAuth: sourceNocodeId === nocodeId ? this.getPublicFormFieldsAuth(nocodeBody, table.uid) : "all",
    };
  }

  async getPublicRowShareData(token: string, tableUIDs: TableUID[], options?: QueryOptions, accessToken?: string) {
    const { rowShare, nocodeBody, formData, table } = await this.getPublicRowShareContext(token, accessToken);
    this.assertPublicRowShareTableAccess(nocodeBody, table.uid, tableUIDs);
    const queryOptions: QueryOptions = {
      ...(options || {}),
      filters: this.appendPublicRowShareBaseFilters(nocodeBody, rowShare.nocodeId, table, rowShare, tableUIDs, options?.filters),
      stage: options?.stage || this.getDefaultReadableStageCondition(),
      formatData: true,
    };
    const bucketMap = new Map<TableUID, Bucket>();
    const groupedSourceMap = new Map<string, {
      formData: NocodeFormData,
      sourceNocodeId: string,
      tableUIDs: TableUID[],
    }>();
    for (const tableUID of tableUIDs) {
      const { formData: targetFormData, sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, rowShare.nocodeId, tableUID);
      if (!targetFormData?.tables?.find(item => item.uid === tableUID)) {
        throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
      }
      const sourceKey = `${sourceNocodeId}:${targetFormData.uid}`;
      const currentGroup = groupedSourceMap.get(sourceKey);
      if (currentGroup) {
        currentGroup.tableUIDs.push(tableUID);
      } else {
        groupedSourceMap.set(sourceKey, {
          formData: targetFormData,
          sourceNocodeId,
          tableUIDs: [tableUID],
        });
      }
    }
    for (const { formData: targetFormData, sourceNocodeId, tableUIDs: currentTableUIDs } of groupedSourceMap.values()) {
      const buckets = await this.formDataService._getData(targetFormData, currentTableUIDs, sourceNocodeId, queryOptions);
      if (queryOptions.fillSubTable) {
        for (const bucket of buckets) {
          const currentTable = targetFormData.tables.find(item => item.uid === bucket.tableId);
          if (!currentTable) continue;
          bucket.rows = await this.formDataService.fillSubFormField(
            bucket.rows,
            sourceNocodeId,
            currentTable,
            targetFormData,
            queryOptions.subTableFilters || {},
            queryOptions.transformFormData,
            queryOptions.formatData,
            queryOptions.scope || "main",
          );
        }
      }
      if (queryOptions.transformRelated) {
        for (const bucket of buckets) {
          const currentTable = targetFormData.tables.find(item => item.uid === bucket.tableId);
          if (!currentTable) continue;
          bucket.rows = await this.formDataService.transformRelatedField(
            bucket.rows,
            sourceNocodeId,
            currentTable,
            nocodeBody,
            queryOptions.stage,
            queryOptions,
          );
        }
      }
      for (const bucket of buckets) {
        bucketMap.set(bucket.tableId as TableUID, bucket);
      }
    }
    const visibleFieldUIDs = this.getRowShareVisibleFieldUIDs(formData, table);
    return tableUIDs
      .map(tableUID => bucketMap.get(tableUID))
      .filter(Boolean)
      .map((bucket) => this.sanitizeRowShareBucket(bucket, table.uid, visibleFieldUIDs));
  }

  async getPublicFormShareData(nocodeId: string, rootTableUID: TableUID, tableUIDs: TableUID[], options?: QueryOptions, visitToken?: string) {
    const { nocodeBody } = await this.getPublicFormShareContext(nocodeId, rootTableUID, visitToken);
    this.assertPublicFormTableAccess(nocodeBody, rootTableUID, tableUIDs);
    const queryOptions: QueryOptions = {
      ...(options || {}),
      stage: options?.stage || this.getDefaultReadableStageCondition(),
      formatData: true,
    };
    const groupedSourceMap = new Map<string, {
      formData: NocodeFormData,
      sourceNocodeId: string,
      tableUIDs: TableUID[],
    }>();
    for (const tableUID of tableUIDs) {
      const { formData, sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, nocodeId, tableUID);
      if (!formData?.tables?.find(item => item.uid === tableUID)) {
        throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
      }
      const sourceKey = `${sourceNocodeId}:${formData.uid}`;
      const currentGroup = groupedSourceMap.get(sourceKey);
      if (currentGroup) {
        currentGroup.tableUIDs.push(tableUID);
      } else {
        groupedSourceMap.set(sourceKey, {
          formData,
          sourceNocodeId,
          tableUIDs: [tableUID],
        });
      }
    }
    const bucketMap = new Map<TableUID, Bucket>();
    for (const { formData, sourceNocodeId, tableUIDs: currentTableUIDs } of groupedSourceMap.values()) {
      const buckets = await this.formDataService._getData(formData, currentTableUIDs, sourceNocodeId, queryOptions);
      if (queryOptions.fillSubTable) {
        for (const bucket of buckets) {
          const currentTable = formData.tables.find(item => item.uid === bucket.tableId);
          if (!currentTable) continue;
          bucket.rows = await this.formDataService.fillSubFormField(
            bucket.rows,
            sourceNocodeId,
            currentTable,
            formData,
            queryOptions.subTableFilters || {},
            queryOptions.transformFormData,
            queryOptions.formatData,
            queryOptions.scope || "main",
          );
        }
      }
      if (queryOptions.transformRelated) {
        for (const bucket of buckets) {
          const currentTable = formData.tables.find(item => item.uid === bucket.tableId);
          if (!currentTable) continue;
        bucket.rows = await this.formDataService.transformRelatedField(
          bucket.rows,
          sourceNocodeId,
          currentTable,
          nocodeBody,
          queryOptions.stage,
          queryOptions,
        );
      }
      }
      for (const bucket of buckets) {
        bucketMap.set(bucket.tableId as TableUID, bucket);
      }
    }
    return tableUIDs.map(tableUID => bucketMap.get(tableUID)).filter(Boolean);
  }

  async getPublicRowShareDistinct(token: string, tableUID: TableUID, fieldId: string, options?: QueryOptions, onlyValue = true, accessToken?: string) {
    const { rowShare, nocodeBody, formData, table } = await this.getPublicRowShareContext(token, accessToken);
    this.assertPublicRowShareTableAccess(nocodeBody, table.uid, [tableUID]);
    const visibleFieldUIDs = this.getRowShareVisibleFieldUIDs(formData, table);
    this.assertPublicRowShareFieldReadable(tableUID, fieldId, table.uid, visibleFieldUIDs);
    const { formData: targetFormData, sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, rowShare.nocodeId, tableUID);
    const queryOptions: QueryOptions = {
      ...(options || {}),
      filters: this.appendPublicRowShareBaseFilters(nocodeBody, rowShare.nocodeId, table, rowShare, [tableUID], options?.filters),
      stage: options?.stage || this.getDefaultReadableStageCondition(),
    };
    const res = await this.formDataService._distinct(
      targetFormData,
      sourceNocodeId,
      tableUID,
      fieldId as any,
      queryOptions,
      { skipReadPermission: true },
    );
    if (!onlyValue) return res;
    return res.map(({ value }) => value);
  }

  async getPublicFormShareDistinct(nocodeId: string, rootTableUID: TableUID, tableUID: TableUID, fieldId: string, options?: QueryOptions, visitToken?: string, onlyValue = true) {
    const { nocodeBody } = await this.getPublicFormShareContext(nocodeId, rootTableUID, visitToken);
    this.assertPublicFormTableAccess(nocodeBody, rootTableUID, [tableUID]);
    const { formData, sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, nocodeId, tableUID);
    if (!formData?.tables?.find(item => item.uid === tableUID)) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    const res = await this.formDataService._distinct(
      formData,
      sourceNocodeId,
      tableUID,
      fieldId as any,
      options,
      { skipReadPermission: true },
    );
    if (!onlyValue) return res;
    return res.map(({ value }) => value);
  }

  async getPublicRowShareFindOne(token: string, tableUID: TableUID, accessToken?: string) {
    await this.getPublicRowShareContext(token, accessToken);
    const buckets = await this.getPublicRowShareData(token, [tableUID], {
      fillSubTable: true,
      transformRelated: true,
    }, accessToken);
    return buckets[0]?.rows?.[0] ?? null;
  }

  async getPublicFormShareFindOne(nocodeId: string, rootTableUID: TableUID, tableUID: TableUID, visitToken?: string) {
    await this.getPublicFormShareContext(nocodeId, rootTableUID, visitToken);
    const buckets = await this.getPublicFormShareData(nocodeId, rootTableUID, [tableUID], {
      fillSubTable: true,
      transformRelated: true,
    }, visitToken);
    return buckets[0]?.rows?.[0] ?? null;
  }

  async getPublicRowShareReadFormList(token: string, tableId: TableUID, accessToken?: string) {
    const { rowShare, nocodeBody, table } = await this.getPublicRowShareContext(token, accessToken);
    this.assertPublicRowShareTableAccess(nocodeBody, table.uid, [tableId]);
    const { formData, table: targetTable, sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, rowShare.nocodeId, tableId);
    if (!formData || !targetTable) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    const { buckets } = await this.connectionUtils.readConnectionData(formData, false, sourceNocodeId, unique(), {}, {
      tableUIDs: [tableId],
      queryOptions: {
        filters: this.appendPublicRowShareBaseFilters(nocodeBody, rowShare.nocodeId, table, rowShare, [tableId]),
        stage: {
          $ne: null,
        },
        formatData: true,
      }
    });
    const visibleFieldUIDs = this.getRowShareVisibleFieldUIDs(formData, table);
    const bucket = this.sanitizeRowShareBucket(buckets[0], table.uid, visibleFieldUIDs);

    return {
      bucket,
      rows: bucket?.rows,
      connection: formData,
      otherDataSources: nocodeBody.otherDataSources || [],
    };
  }

  async getPublicFormShareReadFormList(nocodeId: string, rootTableUID: TableUID, tableId: TableUID, visitToken?: string) {
    const { nocodeBody } = await this.getPublicFormShareContext(nocodeId, rootTableUID, visitToken);
    this.assertPublicFormTableAccess(nocodeBody, rootTableUID, [tableId]);
    const { formData, table: targetTable, sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, nocodeId, tableId);
    if (!formData || !targetTable) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    const { buckets } = await this.connectionUtils.readConnectionData(formData, false, sourceNocodeId, unique(), {}, {
      tableUIDs: [tableId],
      queryOptions: {
        stage: {
          $ne: null,
        },
        formatData: true,
      }
    });

    return {
      bucket: buckets[0],
      rows: buckets[0]?.rows,
      connection: formData,
    };
  }

  async getPublicRowShareTableFieldList(token: string, tableId: TableUID, subType?: string[] | string, accessToken?: string) {
    const { rowShare, nocodeBody, formData, table } = await this.getPublicRowShareContext(token, accessToken);
    this.assertPublicRowShareTableAccess(nocodeBody, table.uid, [tableId]);
    const targetTable = this.resolvePublicFormDataTableSource(nocodeBody, rowShare.nocodeId, tableId).table;
    if (!targetTable) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    let judger: Function = (field: Field) => !isSystemField(field);
    if (Array.isArray(subType)) {
      judger = (field: Field) => !isSystemField(field) && subType.indexOf(field.meta.subType) !== -1;
    } else if (subType) {
      judger = (field: Field) => !isSystemField(field) && field.meta.subType == subType;
    }
    const visibleFieldUIDs = this.getRowShareVisibleFieldUIDs(formData, table);
    return targetTable.fields.filter(item => {
      if (tableId === table.uid && !visibleFieldUIDs.has(item.uid)) {
        return false;
      }
      return judger(item);
    });
  }

  async getPublicFormShareTableFieldList(nocodeId: string, rootTableUID: TableUID, tableId: TableUID, subType?: string[] | string, visitToken?: string) {
    const { nocodeBody } = await this.getPublicFormShareContext(nocodeId, rootTableUID, visitToken);
    this.assertPublicFormTableAccess(nocodeBody, rootTableUID, [tableId]);
    const { table: targetTable } = this.resolvePublicFormDataTableSource(nocodeBody, nocodeId, tableId);
    if (!targetTable) {
      throw new Error(global.i18next.t('projectServices.formNotExistOrPrivate'));
    }
    let judger: Function = (field: Field) => !isSystemField(field);
    if (Array.isArray(subType)) {
      judger = (field: Field) => !isSystemField(field) && subType.indexOf(field.meta.subType) !== -1;
    } else if (subType) {
      judger = (field: Field) => !isSystemField(field) && field.meta.subType == subType;
    }
    return targetTable.fields.filter(item => judger(item));
  }

  async getPublicRowShareTOC(token: string, tableId: TableUID, accessToken?: string) {
    const { rowShare, nocodeBody, table } = await this.getPublicRowShareContext(token, accessToken);
    this.assertPublicRowShareTableAccess(nocodeBody, table.uid, [tableId]);
    const { sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, rowShare.nocodeId, tableId);
    const targetBody = sourceNocodeId === rowShare.nocodeId
      ? nocodeBody
      : await this.getNocodeBody(sourceNocodeId);
    return targetBody?.views?.[tableId];
  }

  async getPublicFormShareTOC(nocodeId: string, rootTableUID: TableUID, tableId: TableUID, visitToken?: string) {
    const { nocodeBody } = await this.getPublicFormShareContext(nocodeId, rootTableUID, visitToken);
    this.assertPublicFormTableAccess(nocodeBody, rootTableUID, [tableId]);
    const { sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, nocodeId, tableId);
    const targetBody = sourceNocodeId === nocodeId
      ? nocodeBody
      : await this.getNocodeBody(sourceNocodeId);
    return targetBody?.views?.[tableId];
  }

  async validatePublicFormShareFormSubmit(
    nocodeId: string,
    rootTableUID: TableUID,
    row: Row | Row[],
    formValidRule: FormValidRule,
    type: "form" | "subform",
    visitToken?: string,
    tableId?: TableUID,
    options: { fullReplace?: boolean, fullReplaceRelationValue?: any } = {},
  ) {
    await this.getPublicFormShareContext(nocodeId, rootTableUID, visitToken);
    if (type === "form") {
      return await this.formDataService.validateFormSubmit(nocodeId, row as Row, formValidRule);
    }
    return await this.formDataService.validateSubFormSubmit(nocodeId, row as Row[], formValidRule, tableId, options);
  }

  async validatePublicRowShareFormSubmit(token: string, row: Row | Row[], formValidRule: FormValidRule, type: "form" | "subform", accessToken?: string) {
    const { sourceNocodeId } = await this.getPublicRowShareContext(token, accessToken);
    if (type === "form") {
      return await this.formDataService.validateFormSubmit(sourceNocodeId, row as Row, formValidRule);
    }
    return await this.formDataService.validateSubFormSubmit(sourceNocodeId, row as Row[], formValidRule);
  }

  async checkPublicRowShareUniqueValue(token: string, tableId: TableUID, uniqueChecks: KeyValue[], uuid?: KeyValue, accessToken?: string) {
    const { rowShare, nocodeBody, table } = await this.getPublicRowShareContext(token, accessToken);
    this.assertPublicRowShareTableAccess(nocodeBody, table.uid, [tableId]);
    const { sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, rowShare.nocodeId, tableId);
    return await this.formDataService.checkUniqueValue(sourceNocodeId, tableId, uniqueChecks, uuid);
  }

  async checkPublicFormShareUniqueValue(
    nocodeId: string,
    rootTableUID: TableUID,
    tableId: TableUID,
    uniqueChecks: KeyValue[],
    uuid?: KeyValue,
    visitToken?: string,
  ) {
    const { nocodeBody } = await this.getPublicFormShareContext(nocodeId, rootTableUID, visitToken);
    this.assertPublicFormTableAccess(nocodeBody, rootTableUID, [tableId]);
    const { sourceNocodeId } = this.resolvePublicFormDataTableSource(nocodeBody, nocodeId, tableId);
    return await this.formDataService.checkUniqueValue(sourceNocodeId, tableId, uniqueChecks, uuid);
  }

  private async updateRowShareByToken(token: string, rowPatch: Row, scope: "internal" | "public", accessToken?: string) {
    const rowShare = await this.resolveRowShareByToken(token, scope);
    let formData: NocodeFormData;
    let table: Table;
    let sourceNocodeId = rowShare.nocodeId;
    let memberFieldsAuth: Record<string, FieldAuthValue> | "all" = "all";
    if (scope === "public") {
      const publicContext = await this.getPublicRowShareContext(token, accessToken);
      formData = publicContext.formData;
      table = publicContext.table;
      sourceNocodeId = publicContext.sourceNocodeId;
    } else {
      const nocodeBody = await this.getNocodeBody(rowShare.nocodeId);
      formData = nocodeBody?.formData;
      table = formData?.tables?.find(item => item.uid === rowShare.tableUID);
      if (!table) {
        throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
      }
      this.assertRowShareAvailable(table, scope);
      memberFieldsAuth = await this.getRowShareInternalMemberFieldsAuth(nocodeBody, table.uid);
    }

    const uuidField = getUUIDSystemField(table.fields);
    if (!uuidField) {
      throw new Error(global.i18next.t('projectServices.rowShareUuidFieldNotFound'));
    }
    const editableFieldUIDs = scope === "internal"
      ? this.getInternalShareEditableFieldUIDs(formData, table, memberFieldsAuth)
      : this.getRowShareEditableFieldUIDs(formData, table);
    if (isEmpty(editableFieldUIDs)) {
      return await this.getRowShareBootstrapByToken(token, scope, accessToken);
    }

    const nextRow: Row = {
      [uuidField.uid]: rowShare.rowUUID,
    };
    for (const fieldUID of editableFieldUIDs) {
      if (Object.prototype.hasOwnProperty.call(rowPatch || {}, fieldUID)) {
        nextRow[fieldUID] = rowPatch[fieldUID];
      }
    }

    if (Object.keys(nextRow).length > 1) {
      if (scope === "internal") {
        await this.formDataService.tryUpdateData(
          formData,
          sourceNocodeId,
          table.uid,
          [nextRow],
          [[formData.uid, table.uid, uuidField.uid]],
          null,
          undefined,
          {},
          editableFieldUIDs,
        );
      } else {
        await this.formDataService.updateData(
          formData,
          sourceNocodeId,
          table.uid,
          [nextRow],
          [[formData.uid, table.uid, uuidField.uid]],
        );
      }
      await this.withRowShareLock(rowShare.nocodeId, async () => {
        const rowShares = await this.readRowShares(rowShare.nocodeId);
        const currentShare = rowShares.find(item => item.id === rowShare.id);
        if (currentShare) {
          currentShare.updatedAt = Date.now();
          await this.saveRowShares(rowShare.nocodeId, rowShares);
        }
      });
    }

    return await this.getRowShareBootstrapByToken(token, scope, accessToken);
  }

  async updateRowShare(token: string, rowPatch: Row, accessToken?: string) {
    const rowShare = await this.resolveRowShareByToken(token, "internal");
    const nocodeBody = await this.getNocodeBody(rowShare.nocodeId);
    const table = nocodeBody?.formData?.tables?.find(item => item.uid === rowShare.tableUID);
    if (!table) {
      throw new Error(global.i18next.t('projectServices.rowShareFormNotFound'));
    }
    this.assertRowShareAvailable(table, "internal");
    await this.persistSyncedRowShareAccessIfNeeded(rowShare, table);
    const access = this.getEffectiveRowShareAccessConfig(rowShare, table, "internal");
    this.assertRowShareAccessAvailable(access);
    if (access.isNeedPassword) {
      const account = await this.formDataService.getAccount().catch(() => null);
      const valid = await this.validateRowShareAccessToken(token, "internal", String(accessToken || ""), account?.id || "");
      if (!valid) {
        throw new Error(global.i18next.t('projectServices.passwordError'));
      }
    }
    return await this.updateRowShareByToken(token, rowPatch, "internal", accessToken);
  }

  async updatePublicRowShare(token: string, rowPatch: Row, accessToken?: string) {
    const visitState = await this.resolvePublicRowShareVisitState(accessToken || token);
    if (visitState.rawToken !== token) {
      throw new Error(global.i18next.t('projectServices.rowShareLinkInvalid'));
    }
    return await this.updateRowShareByToken(visitState.rawToken, rowPatch, "public", accessToken);
  }

  async updateNocodeTableViewMeta(nocodeId: string, tableId: string, meta: FormTableViewMeta) {
    const nocodeBody = await this.getNocodeBody(nocodeId);
    nocodeBody.formData.metas = nocodeBody.formData.metas || {};
    nocodeBody.formData.metas[tableId] = meta;
    await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
  }
  private formatApiSettingRes(nocodeEntity: NocodeEntity){
    const res: ApiSetting = {
      id: nocodeEntity.id,
      apiEnabled: nocodeEntity.apiEnabled,
      apiAlias: nocodeEntity.apiAlias,
      apiTableInfo: nocodeEntity.apiTableInfo
    }
    return res;
  }

  async getApiSetting(appId: string){
    let nocodeEntity: NocodeEntity = await this.nocodeRepository.findOne({ id: appId });

    // 更新数据
    nocodeEntity = await this.refreshApiSetting(appId, nocodeEntity);
    
    const resData: ApiSetting = this.formatApiSettingRes(nocodeEntity);

    return {
      data: resData
    }
  }

  async refreshApiSetting(appId: string, nocodeEntity: NocodeEntity){
    const nocodeBody = await getNocodeBody(this.nocodesDir, appId);
    const formData = nocodeBody.formData;
    let origin: ApiTableSetting[] = nocodeEntity.apiTableInfo ?? [];
    nocodeEntity.apiTableInfo = formData.tables.filter(table => !table.meta?.extra?.primaryTable).map(table => {
      let tableInfo: ApiTableSetting = origin.find(item => item.id === table.uid);
      return {
        id: table.uid,
        name: table.alias,
        apiAlias: tableInfo?.apiAlias ?? '',
        public: tableInfo?.public ?? false
      }
    });
    nocodeEntity.apiAlias = nocodeEntity.apiAlias ?? '';
    nocodeEntity.apiEnabled = nocodeEntity.apiEnabled ?? false;
    await this.nocodeRepository.flush();
    
    return nocodeEntity;
  }

  async setApiSetting(appRow: NocodeEntity){
    let nocodeEntity: NocodeEntity = await this.nocodeRepository.findOne({ id: appRow.id });
    if(!nocodeEntity) return ;
    
    const { apiEnabled, apiAlias, apiTableInfo } = appRow;
    nocodeEntity.apiEnabled = apiEnabled ?? nocodeEntity.apiEnabled;
    nocodeEntity.apiAlias = apiAlias ?? nocodeEntity.apiAlias;
    nocodeEntity.apiTableInfo = apiTableInfo ?? nocodeEntity.apiTableInfo;
    
    await this.nocodeRepository.flush();

    const resData: ApiSetting = this.formatApiSettingRes(nocodeEntity);

    return {
      data: resData
    }
  }

  async validApiAlias(alias: string, type: AliasType, appId: string, tableId?: TableUID){
    const validatorMap = {
      app: this.appAliasValidator,
      table: this.tableAliasValidator
    }
    const valid = await validatorMap[type].apply(this, [alias, appId, tableId]);

    return {
      valid
    }
  }

  private async appAliasValidator(alias: string, appId: string){
    const nocodeEntity: NocodeEntity = await this.nocodeRepository.findOne({
      id: { '$ne': appId },
      apiAlias: alias
    });
    let valid: boolean = !nocodeEntity;

    return valid;
  }

  private async tableAliasValidator(alias: string, appId: string, tableId: TableUID){
    const nocodeEntity: NocodeEntity = await this.nocodeRepository.findOne({ id: appId });
    const row = nocodeEntity?.apiTableInfo.find(item => {
      return item.id !== tableId && item.apiAlias === alias;
    });
    let valid: boolean = !row;

    return valid;
  }


  // 分组管理

  // 获取分组
  // 获取所有分组
  public async getAllNocodeGroups() {
    // return await this.groupRepository.find({}, { orderBy: { createTime: "DESC" } });
    // return await this.groupRepository.find({}, { orderBy: { createTime: "ASC" } });
    return await this.groupRepository.find({}, { orderBy: { sort: "ASC" } });
  }
  // 根据分组id获取分组
  public async getNocodeGroup(id: string) {
    return await this.groupRepository.findOne({ id });
  }

  // 创建分组
  public async createNocodeGroup(name: string) {
    const nocodeGroup = new GroupEntity();
    nocodeGroup.name = name;
    nocodeGroup.createTime = Date.now();

    // 获取当前分组列表中最大的 sort 值
    const maxSortGroup = await this.groupRepository.findOne({ sort: { $gte: 0 } }, { orderBy: { sort: 'DESC' } });
    const maxSort = maxSortGroup ? maxSortGroup.sort : -1;

    // 设置 sort 值为最大值 + 1
    nocodeGroup.sort = maxSort + 1;
    
    await this.groupRepository.persistAndFlush(nocodeGroup);
    
    return nocodeGroup;
  }

  // 重命名分组
  public async renameNocodeGroup(id: string, name: string) {
    const nocodeGroup = await this.getNocodeGroup(id);
    if (!nocodeGroup) {
      throw new Error(global.i18next.t('projectServices.groupNotExist'));
    }
    
    nocodeGroup.name = name;
    await this.groupRepository.persistAndFlush(nocodeGroup);
  }

  // 删除分组
  public async deleteNocodeGroup(id: string) {
    const nocodeGroup = await this.getNocodeGroup(id);
    if (!nocodeGroup) {
      throw new Error(global.i18next.t('projectServices.groupNotExist'));
    }

    // 将所有引用此分组的nocode项目设置为未分组
    const nocodesInGroup = await this.nocodeRepository.find({ groupId: id }, {orderBy: {"sort": "ASC"}});
    for (const nocode of nocodesInGroup) {
      nocode.groupId = null;
    }
    await this.nocodeRepository.persistAndFlush(nocodesInGroup);
    
    // 硬删除：直接从数据库中移除记录
    await this.groupRepository.removeAndFlush(nocodeGroup);
    
    return nocodeGroup;
  }

  // 将nocode应用移动到指定分组
  public async moveNocodesToGroup(nocodeIds: string[], groupId: string) {
    // 获取目标分组
    const group = await this.groupRepository.findOne({ id: groupId });
    if (!group) {
      throw new Error(global.i18next.t('projectServices.targetGroupNotExist'));
    }

    // 统计分组内已有应用的数量
    const count = await this.nocodeRepository.count({ groupId });
    
    // 获取所有要移动的nocode应用
    const nocodes = await this.nocodeRepository.find({ id: { $in: nocodeIds } }, {orderBy: {"sort": "ASC"}});
    
    // 更新每个nocode应用的分组
    nocodes.forEach((nocode, index) => {
      nocode.groupId = group.id;
      nocode.sort = index + count;
    })
    
    // 保存更改
    await this.nocodeRepository.persistAndFlush(nocodes);
    
    return nocodes;
  }

  // 将nocode应用移出分组（设为未分组）
  public async removeNocodesFromGroup(nocodeIds: string[]) {
    // 获取所有要移出分组的nocode应用
    const nocodes = await this.nocodeRepository.find({ id: { $in: nocodeIds } }, {orderBy: {"sort": "ASC"}});
    
    // 将这些nocode应用的分组设为null
    for (const nocode of nocodes) {
      nocode.groupId = null;
    }
    
    // 保存更改
    await this.nocodeRepository.persistAndFlush(nocodes);
    
    return nocodes;
  }

  // 根据拖拽之后新的排序信息，更新分组列表信息
  public async updateGroupSort(newSort: object[]) {
    // 遍历 newSort 数组，更新每个分组的 sort 值
    for (const item of newSort) {
      const { id, sort } = item as { id: string; sort: number };
      
      // 根据 id 查找对应的分组
      const group = await this.groupRepository.findOne({ id });
      
      // 如果找到了对应的分组，则更新其 sort 值
      if (group) {
        group.sort = sort;
      }
    }
    
    // 批量保存所有更改
    await this.groupRepository.flush();
  }

  // 根据拖拽之后新的排序信息，更新应用列表信息
  public async updateNocodeSort(newSort: object[]) {
    // 遍历 newSort 数组，更新每个应用的 sort 值
    for (const item of newSort) {
      const { id, sort } = item as { id: string; sort: number };
      
      // 根据 id 查找对应的分组
      const nocode = await this.nocodeRepository.findOne({ id });
      
      // 如果找到了对应的分组，则更新其 sort 值
      if (nocode) {
        nocode.sort = sort;
      }
    }
    
    // 批量保存所有更改
    await this.nocodeRepository.flush();
  }

  async canViewNocode(nocodeId: string, req: Request) {
    const importState = await this.getNocodeImportRestrictionState(nocodeId);
    if (importState.expired) {
      return false;
    }
    const account = req.account
    const isAdmin = isSystemAdminAccount(account);
    if(isAdmin) {
      return true
    }
    const allDepartments = await this.getAllDepartments();
    
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



    const body = await this.getNocodeBody(nocodeId);
    if(!body) return false
    const permission = body?.permissions?.application?.get
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

  async canViewNocodeLayer(nocodeId: string, layerId: string, req: Request) {
    const account = req.account
    const isAdmin = isSystemAdminAccount(account);
    if(isAdmin) {
      return true;
    }
    const canViewNocode = await this.canViewNocode(nocodeId, req);
    if (!canViewNocode) return false;
    // 判断是否有页面权限
    const body = await this.getNocodeBody(nocodeId);
    if(!body) return false
    const permission = body?.permissions?.page?.[layerId]?.[PermissionCategory.GET];
    if(isEmpty(permission)) {
      return true
    }
    if(permission.rangeType === PermissionRangeType.ALL) {
      return canViewNocode;
    }
    if (permission.range?.users?.includes(account.id)) {
      return true;
    } else if (permission.range?.roles?.some(roleId => account.roles.includes(roleId))) {
      return true;
    } else {
      return await this.workbenchService.isInDepartments(account.departments, permission.range?.departments)
    }
  }

  getNocodeImportRestrictionStateByMeta(nocodeMeta?: Pick<NocodeMeta, "importRestriction"> | null, account?: Partial<Account>) {
    return this.buildNocodeImportRestrictionState(nocodeMeta, account);
  }

  async getNocodeImportRestrictionState(nocodeId: string, account?: Partial<Account>) {
    const nocodeMeta = await this.getNocodeMeta(nocodeId).catch(() => null);
    return this.buildNocodeImportRestrictionState(nocodeMeta, account);
  }

  async saveNocodeImportReadonly(nocodeId: string, disableEdit: boolean) {
    const nocodeMeta = await this.getNocodeMeta(nocodeId);
    setNocodeImportReadonly(nocodeMeta, disableEdit, { emptyValue: null });
    await this.setNocodeMeta(nocodeMeta);

    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId).catch(() => null);
    if (nocodeBody) {
      setNocodeImportReadonly(nocodeBody, disableEdit);
      await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
    }
  }

  async saveNocodeImportExpireAt(nocodeId: string, expireAt: number | null) {
    const nocodeMeta = await this.getNocodeMeta(nocodeId);
    nocodeMeta.importRestriction = nocodeMeta.importRestriction || {};
    if (expireAt) {
      nocodeMeta.importRestriction.expireAt = expireAt;
    } else {
      delete nocodeMeta.importRestriction.expireAt;
    }
    if (isEmpty(nocodeMeta.importRestriction)) {
      nocodeMeta.importRestriction = null;
    }
    await this.setNocodeMeta(nocodeMeta);

    const nocodeBody = await getNocodeBody(this.nocodesDir, nocodeId).catch(() => null);
    if (nocodeBody) {
      nocodeBody.importRestriction = nocodeBody.importRestriction || {};
      if (expireAt) {
        nocodeBody.importRestriction.expireAt = expireAt;
      } else {
        delete nocodeBody.importRestriction.expireAt;
      }
      if (isEmpty(nocodeBody.importRestriction)) {
        delete nocodeBody.importRestriction;
      }
      await saveNocodeBody(this.nocodesDir, nocodeId, nocodeBody);
    }
  }
}
