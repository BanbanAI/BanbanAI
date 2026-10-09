import {
  SystemMigrationApplyStatus,
  SYSTEM_MIGRATION_PACKAGE_EXTENSION,
  SYSTEM_MIGRATION_PACKAGE_FORMAT,
  SYSTEM_MIGRATION_PACKAGE_VERSION,
  SystemMigrationDatabaseInfo,
  SystemMigrationExportOptions,
  SystemMigrationExportResult,
  SystemMigrationExportSummary,
  SystemMigrationExportTaskStatus,
  SystemMigrationFormDataCollection,
  SystemMigrationFormDataChunk,
  SystemMigrationFormDataManifest,
  SystemMigrationImportDatabaseOptions,
  SystemMigrationImportRootDirInfo,
  SystemMigrationPackageInspectResult,
  SystemMigrationPackageManifest,
  SystemMigrationPrecheckItem,
  SystemMigrationPrecheckResult,
  SystemMigrationStorageItem,
  SystemMigrationStorageRestoreMode,
  SystemMigrationStorageTarget,
  SystemMigrationValidateDatabaseResult,
} from "@common/types/system-migration";
import { FormDataTable, FormDatabaseType, NocodeBody } from "@common/types/nocode";
import { NOCODES_DIR, PREFERENCES, PROJECTS_DIR, REPORTS_DIR, UPLOADS_DIR } from "@main/constants";
import { getNocodeBody } from "@main/utils";
import { MikroORM } from "@mikro-orm/core";
import checkDiskSpace from "check-disk-space";
import dayjs from "dayjs";
import { existsSync } from "fs";
import { copyFile, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "fs/promises";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { getFileMd5 } from "@main/utils/md5";
import { readFile as readZipFile, unzip, zip } from "@main/utils/zip";
import os from "os";
import { dirname, isAbsolute, join, parse, relative, resolve } from "path";
import { getRuntime } from "@main/runtime";
import { Preferences } from "../common";
import { DbManager } from "../formData/db.manager";
import { Nocode as NocodeEntity } from "../project/entities";
import {
  clearPendingSystemMigrationResult,
  getPendingSystemMigrationApplyStatus,
  cleanupPendingSystemMigration,
  PendingSystemMigrationState,
  retryPendingSystemMigration,
  writePendingSystemMigrationState,
} from "./system-migration.pending";
import { SortType } from "@common/types/project";
import { SystemField } from "@common/utils";

type StorageSource = {
  key: string;
  sourcePath: string;
  relativePath: string;
  target: SystemMigrationStorageTarget;
  type: "file" | "directory";
  required?: boolean;
  applicationData?: boolean;
  exportEmptyDirectoryWhenExcluded?: boolean;
};

type ImportContext = {
  userDataPath: string;
  rootDirBase: string;
  projectsDirBase: string;
};

type SystemMigrationImportOptions = {
  rootDir?: string;
  databaseOptions?: SystemMigrationImportDatabaseOptions;
};

type DiskCheckCandidate = {
  key: string;
  path: string;
  needBytes: number;
  label: string;
};

type ExportTaskState = {
  id: string;
  canceled: boolean;
  savePath?: string;
};

type ResolvedSystemMigrationExportOptions = Required<SystemMigrationExportOptions>;
type ManagedSystemMigrationExportTask = SystemMigrationExportTaskStatus & {
  filePath?: string;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const EXPORT_CANCELED_ERROR = "SYSTEM_MIGRATION_EXPORT_CANCELED";
const FORM_DATA_EXPORT_CHUNK_ROW_LIMIT = 200;
const MANAGED_IMPORT_PACKAGE_DIR_NAME = "banban-system-migration-upload";
const MANAGED_EXPORT_PACKAGE_DIR_PREFIX = "banban-system-migration-download-";
const MANAGED_IMPORT_PACKAGE_TTL_MS = 24 * 60 * 60 * 1000;
const MANAGED_EXPORT_PACKAGE_TTL_MS = 24 * 60 * 60 * 1000;

type PackageFormDataDiskUsage = {
  totalBytes: number;
  target?: SystemMigrationStorageTarget;
};

type ExportFormDataPageState = {
  skip: number;
  lastMongoCreateTime?: string | number;
  lastMongoRowId?: any;
};

const LOCAL_ONLY_PREFERENCE_KEYS = [
  "domain",
  "rootDir",
  "projectsDir",
  "clientIdentifier",
  "clientUUID",
  "identifier",
  "networkIps",
  "saasIp",
  "saasPort",
  "shareDomain",
  "sharePort",
  "currentReportId",
] as const;

const FORM_DATABASE_PREFERENCE_KEYS = [
  "formDatabaseType",
  "formDatabaseConfig",
] as const;

const ACCOUNT_IDENTITY_PREFERENCE_KEYS = [
  "prevSessionId",
  "loginToken",
  "serverInitStepInfo",
  "companyName",
  "countLoginFail",
] as const;

@Injectable()
export class SystemMigrationService {
  private readonly logger = new Logger(SystemMigrationService.name);
  private pendingImport?: PendingSystemMigrationState;
  private activeExportTask?: ExportTaskState;
  private readonly managedExportTasks = new Map<string, ManagedSystemMigrationExportTask>();

  constructor(
    @Inject(PREFERENCES) private readonly preferences: Preferences,
    @Inject(PROJECTS_DIR) private readonly projectsDir: string,
    @Inject(REPORTS_DIR) private readonly reportsDir: string,
    @Inject(NOCODES_DIR) private readonly nocodesDir: string,
    @Inject(UPLOADS_DIR) private readonly uploadsDir: string,
    private readonly orm: MikroORM,
    private readonly dbManager: DbManager,
  ) {}

  async onApplicationBootstrap() {
    await this.cleanupStaleManagedImportPackages();
    await this.cleanupStaleManagedExportPackages();
  }

  async getExportSummary(): Promise<SystemMigrationExportSummary> {
    return {
      database: await this.getDatabaseInfo(),
    };
  }

  async getApplyStatus(): Promise<SystemMigrationApplyStatus> {
    return await getPendingSystemMigrationApplyStatus(await getRuntime().getUserDataPath());
  }

  async clearApplyStatus() {
    await clearPendingSystemMigrationResult(await getRuntime().getUserDataPath());
    return {
      cleared: true,
    };
  }

  async retryApply() {
    const userDataPath = await getRuntime().getUserDataPath();
    this.pendingImport = await retryPendingSystemMigration(userDataPath);
    return {
      needRelaunch: true,
    };
  }

  async cancelExport(taskId?: string) {
    if (taskId) {
      const managedTask = this.managedExportTasks.get(taskId);
      if (managedTask?.status === "running") {
        managedTask.status = "canceled";
        managedTask.updatedAt = Date.now();
      }
    }
    if (!this.activeExportTask) {
      return { canceled: !!taskId && this.managedExportTasks.get(taskId)?.status === "canceled" };
    }
    if (taskId && this.activeExportTask.id !== taskId) {
      return { canceled: this.managedExportTasks.get(taskId)?.status === "canceled" };
    }
    this.activeExportTask.canceled = true;
    this.logger.log(`cancel system migration export: ${this.activeExportTask.id}`);
    return { canceled: true };
  }

  async startPreparedExportPackageTask(options?: SystemMigrationExportOptions, taskId?: string): Promise<SystemMigrationExportTaskStatus> {
    const id = taskId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const existingTask = this.managedExportTasks.get(id);
    if (existingTask?.status === "running") {
      return this.toPublicExportTaskStatus(existingTask);
    }
    this.ensureNoConcurrentExportTask(id);

    await this.cleanupPreparedExportTask(id);
    const task: ManagedSystemMigrationExportTask = {
      taskId: id,
      status: "running",
      updatedAt: Date.now(),
    };
    this.managedExportTasks.set(id, task);
    void this.runPreparedExportPackageTask(task, options);
    return this.toPublicExportTaskStatus(task);
  }

  async getPreparedExportPackageTaskStatus(taskId: string): Promise<SystemMigrationExportTaskStatus> {
    const task = this.managedExportTasks.get(taskId);
    if (!task) {
      return {
        taskId,
        status: "failed",
        message: global.i18next.t("SystemMigration.exportTaskNotFound"),
        updatedAt: Date.now(),
      };
    }
    return this.toPublicExportTaskStatus(task);
  }

  async getPreparedExportPackageTaskFile(taskId: string): Promise<{ filePath: string, fileName: string }> {
    const task = this.managedExportTasks.get(taskId);
    if (!task || task.status !== "success" || !task.filePath || !task.fileName || !existsSync(task.filePath)) {
      throw new Error(global.i18next.t("SystemMigration.exportTaskNotReady"));
    }
    return {
      filePath: task.filePath,
      fileName: task.fileName,
    };
  }

  async sendPreparedExportPackageTaskFile(taskId: string, res) {
    const file = await this.getPreparedExportPackageTaskFile(taskId);
    let cleaned = false;
    const cleanup = async () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      await this.cleanupPreparedExportTask(taskId);
    };

    res.on("close", () => {
      void cleanup();
    });
    return res.download(file.filePath, file.fileName, () => {
      void cleanup();
    });
  }

  async cleanupPreparedExportTask(taskId: string) {
    const task = this.managedExportTasks.get(taskId);
    if (!task) {
      return {
        cleaned: false,
      };
    }
    if (task.cleanupTimer) {
      clearTimeout(task.cleanupTimer);
    }
    if (task.filePath) {
      await this.cleanupPreparedExportPackage(task.filePath);
    }
    this.managedExportTasks.delete(taskId);
    return {
      cleaned: true,
    };
  }

  private async runPreparedExportPackageTask(task: ManagedSystemMigrationExportTask, options?: SystemMigrationExportOptions) {
    const fileName = this.buildExportPackageFileName();
    const tempDir = join(os.tmpdir(), `banban-system-migration-download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const filePath = join(tempDir, fileName);
    try {
      await mkdir(tempDir, { recursive: true });
      const result = await this.exportPackageToPath(filePath, options, task.taskId);
      if (task.status === "canceled" || result.canceled || !result.filePath) {
        task.status = "canceled";
        task.updatedAt = Date.now();
        await rm(tempDir, { recursive: true, force: true }).catch(() => null);
        this.schedulePreparedExportTaskCleanup(task);
        return;
      }

      task.status = "success";
      task.filePath = filePath;
      task.fileName = fileName;
      task.result = result;
      task.updatedAt = Date.now();
      this.schedulePreparedExportTaskCleanup(task);
    } catch (error) {
      task.status = "failed";
      task.message = error instanceof Error ? error.message : String(error);
      task.updatedAt = Date.now();
      await rm(tempDir, { recursive: true, force: true }).catch(() => null);
      this.schedulePreparedExportTaskCleanup(task);
    }
  }

  private schedulePreparedExportTaskCleanup(task: ManagedSystemMigrationExportTask) {
    if (task.cleanupTimer) {
      clearTimeout(task.cleanupTimer);
    }
    task.cleanupTimer = setTimeout(() => {
      void this.cleanupPreparedExportTask(task.taskId);
    }, MANAGED_EXPORT_PACKAGE_TTL_MS);
  }

  private toPublicExportTaskStatus(task: ManagedSystemMigrationExportTask): SystemMigrationExportTaskStatus {
    return {
      taskId: task.taskId,
      status: task.status,
      fileName: task.fileName,
      message: task.message,
      result: task.result ? {
        ...task.result,
        filePath: undefined,
      } : undefined,
      updatedAt: task.updatedAt,
    };
  }

  async cleanupPreparedExportPackage(filePath: string) {
    if (!filePath) {
      return;
    }
    await rm(dirname(filePath), { recursive: true, force: true }).catch(() => null);
  }

  async cleanupManagedImportPackage(packagePath: string) {
    if (!this.isManagedImportPackagePath(packagePath)) {
      return {
        cleaned: false,
      };
    }
    await rm(packagePath, { force: true }).catch(() => null);
    return {
      cleaned: true,
    };
  }

  private async cleanupStaleManagedImportPackages() {
    const uploadRoot = join(os.tmpdir(), MANAGED_IMPORT_PACKAGE_DIR_NAME);
    if (!existsSync(uploadRoot)) {
      return;
    }

    const entries = await readdir(uploadRoot, { withFileTypes: true }).catch(() => []);
    const now = Date.now();
    for (const entry of entries) {
      const entryPath = join(uploadRoot, entry.name);
      if (entry.isDirectory()) {
        await rm(entryPath, { recursive: true, force: true }).catch(() => null);
        continue;
      }

      const timestamp = Number.parseInt((entry.name || "").split("-")[0] || "", 10);
      if (!Number.isFinite(timestamp) || now - timestamp > MANAGED_IMPORT_PACKAGE_TTL_MS) {
        await rm(entryPath, { force: true }).catch(() => null);
      }
    }
  }

  private async cleanupStaleManagedExportPackages() {
    const tempRoot = os.tmpdir();
    const entries = await readdir(tempRoot, { withFileTypes: true }).catch(() => []);
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(MANAGED_EXPORT_PACKAGE_DIR_PREFIX)) {
        continue;
      }

      const entryPath = join(tempRoot, entry.name);
      const timestamp = Number.parseInt(entry.name.slice(MANAGED_EXPORT_PACKAGE_DIR_PREFIX.length).split("-")[0] || "", 10);
      if (Number.isFinite(timestamp) && now - timestamp <= MANAGED_EXPORT_PACKAGE_TTL_MS) {
        continue;
      }
      await rm(entryPath, { recursive: true, force: true }).catch(() => null);
    }
  }

  async storeUploadedImportPackage(file: { path?: string, originalname?: string } | undefined | null) {
    if (!file?.path || !existsSync(file.path)) {
      throw new Error(global.i18next.t("SystemMigration.packageRequired"));
    }
    const cleanupSourceFile = async () => {
      await rm(file.path!, { force: true }).catch(() => null);
    };
    const originalName = (file.originalname || "").trim();
    if (originalName && !originalName.toLowerCase().endsWith(SYSTEM_MIGRATION_PACKAGE_EXTENSION)) {
      await cleanupSourceFile();
      throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
    }

    const uploadRoot = join(os.tmpdir(), MANAGED_IMPORT_PACKAGE_DIR_NAME);
    await mkdir(uploadRoot, { recursive: true });
    const targetPath = join(uploadRoot, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${SYSTEM_MIGRATION_PACKAGE_EXTENSION}`);
    try {
      await rename(file.path, targetPath);
    } catch (error) {
      await cleanupSourceFile();
      throw error;
    }
    return {
      packagePath: targetPath,
      originalName: originalName || this.buildExportPackageFileName(),
    };
  }

  async exportPackageToPath(savePath: string, options?: SystemMigrationExportOptions, taskId?: string): Promise<SystemMigrationExportResult> {
    await this.dbManager.closeAll();
    const exportTask = this.createExportTask(taskId);
    const database = await this.getDatabaseInfo();
    const exportOptions = this.resolveExportOptions(options);
    this.ensureExportNotCanceled(exportTask);
    if (!database.supported) {
      throw new Error(database.message || global.i18next.t("SystemMigration.unsupportedDatabase"));
    }

    this.ensureExportNotCanceled(exportTask);
    exportTask.savePath = savePath;

    const tempRoot = join(os.tmpdir(), `banban-system-migration-${Date.now()}`);
    try {
      await mkdir(tempRoot, { recursive: true });
      this.ensureExportNotCanceled(exportTask);
      await this.writeConfigPayloads(tempRoot);
      this.ensureExportNotCanceled(exportTask);
      const storageItems = await this.copyStoragePayloads(tempRoot, exportOptions);
      this.ensureExportNotCanceled(exportTask);
      const formDataManifest = await this.exportFormData(tempRoot, database, exportOptions, exportTask);
      if (formDataManifest) {
        await this.writeJson(join(tempRoot, "form-data", "manifest.json"), formDataManifest);
      }

      const manifest = await this.buildManifest(database, storageItems, exportOptions, formDataManifest);
      await this.writeJson(join(tempRoot, "manifest.json"), manifest);
      this.ensureExportNotCanceled(exportTask);
      await zip(savePath, tempRoot);
      this.ensureExportNotCanceled(exportTask);
      const checksum = await getFileMd5(savePath);

      return {
        filePath: savePath,
        checksum,
        database,
        includeApplicationData: exportOptions.includeApplicationData,
      };
    } catch (error) {
      if (this.isExportCanceledError(error)) {
        return {
          canceled: true,
          database,
          includeApplicationData: exportOptions.includeApplicationData,
        };
      }
      throw error;
    } finally {
      if (exportTask.canceled && exportTask.savePath && existsSync(exportTask.savePath)) {
        await rm(exportTask.savePath, { force: true }).catch(() => null);
      }
      if (this.activeExportTask?.id === exportTask.id) {
        this.activeExportTask = undefined;
      }
      await rm(tempRoot, { recursive: true, force: true }).catch(() => null);
    }
  }

  async inspectPackage(packagePath: string): Promise<SystemMigrationPackageInspectResult> {
    if (!packagePath || !packagePath.trim()) {
      throw new Error(global.i18next.t("SystemMigration.packageRequired"));
    }
    if (!existsSync(packagePath)) {
      throw new Error(global.i18next.t("SystemMigration.packageNotFound"));
    }

    let manifest: SystemMigrationPackageManifest;
    try {
      const manifestBuffer = await readZipFile(packagePath, "manifest.json") as Buffer;
      if (!manifestBuffer?.length) {
        throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
      }
      manifest = JSON.parse(manifestBuffer.toString("utf-8"));
    } catch (error) {
      throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
    }

    if (manifest?.format !== SYSTEM_MIGRATION_PACKAGE_FORMAT || !this.isSupportedPackageVersion(manifest?.version)) {
      throw new Error(global.i18next.t("SystemMigration.invalidPackageVersion"));
    }

    await this.ensurePackageConfigPayloads(packagePath);

    return {
      packagePath,
      manifest,
      valid: true,
    };
  }

  async precheckImport(packagePath: string, options?: SystemMigrationImportOptions): Promise<SystemMigrationPrecheckResult> {
    const inspect = await this.inspectPackage(packagePath);
    const importedPreferences = await this.readRequiredZipJsonObject(packagePath, "config/preferences.json");
    const rootDirInfo = await this.buildImportRootDirInfo(importedPreferences, options?.rootDir);
    const checks: SystemMigrationPrecheckItem[] = [];
    const context = await this.getImportContext(rootDirInfo.targetRootDir);
    const formDataDiskUsage = await this.resolvePackageFormDataDiskUsage(packagePath, inspect.manifest);
    const sizeByTarget = this.groupSizeByTarget(inspect.manifest.items);
    if (formDataDiskUsage.target && formDataDiskUsage.totalBytes) {
      sizeByTarget[formDataDiskUsage.target] = (sizeByTarget[formDataDiskUsage.target] || 0) + formDataDiskUsage.totalBytes;
    }
    const importTempBytes = this.getPackageImportTempBytes(inspect.manifest, formDataDiskUsage.totalBytes);

    if (inspect.manifest.database.type === FormDatabaseType.MYSQL) {
      checks.push({
        key: "database-type",
        passed: false,
        message: global.i18next.t("SystemMigration.mysqlNotSupported"),
      });
    } else {
      checks.push({
        key: "database-type",
        passed: true,
        message: global.i18next.t("SystemMigration.databaseTypeSupported"),
      });
    }

    const diskChecks = await this.buildDiskChecks([
      {
        key: "user-data-space",
        path: context.userDataPath,
        needBytes: sizeByTarget[SystemMigrationStorageTarget.USER_DATA] || 0,
        label: global.i18next.t("SystemMigration.diskScopeUserData"),
      },
      {
        key: "root-dir-space",
        path: context.rootDirBase,
        needBytes: sizeByTarget[SystemMigrationStorageTarget.ROOT_DIR] || 0,
        label: global.i18next.t("SystemMigration.diskScopeRootDir"),
      },
      {
        key: "projects-dir-space",
        path: context.projectsDirBase,
        needBytes: sizeByTarget[SystemMigrationStorageTarget.PROJECTS_DIR] || 0,
        label: global.i18next.t("SystemMigration.diskScopeProjectsDir"),
      },
      {
        key: "import-temp-space",
        path: os.tmpdir(),
        needBytes: importTempBytes,
        label: global.i18next.t("SystemMigration.diskScopeImportTemp"),
      },
    ]);
    checks.push(...diskChecks);

    return {
      packagePath,
      inspect,
      rootDirInfo,
      checks,
      passed: checks.every(item => item.passed),
    };
  }

  async validateImportDatabase(packagePath: string, options?: SystemMigrationImportDatabaseOptions): Promise<SystemMigrationValidateDatabaseResult> {
    const inspect = await this.inspectPackage(packagePath);
    if (!inspect.manifest.database.requiresImportStep) {
      return {
        passed: true,
        message: global.i18next.t("SystemMigration.noDatabaseStepRequired"),
      };
    }
    if (inspect.manifest.database.type !== FormDatabaseType.MONGODB) {
      return {
        passed: false,
        message: global.i18next.t("SystemMigration.mysqlNotSupported"),
      };
    }
    if (!options?.host || !options?.port) {
      return {
        passed: false,
        message: global.i18next.t("SystemMigration.databaseConfigRequired"),
      };
    }

    try {
      await this.dbManager.testConnect({
        type: FormDatabaseType.MONGODB,
        host: options.host,
        port: Number(options.port),
        username: options.username,
        password: options.password,
        authDatabase: options.authDatabase,
      });
      return {
        passed: true,
        message: global.i18next.t("SystemMigration.databaseValidated"),
      };
    } catch (error) {
      return {
        passed: false,
        message: error?.message || global.i18next.t("SystemMigration.databaseValidateFailed"),
      };
    }
  }

  async importPackage(packagePath: string, options?: SystemMigrationImportOptions) {
    const userDataPath = await getRuntime().getUserDataPath();
    await this.cleanupPendingImport(userDataPath);
    await clearPendingSystemMigrationResult(userDataPath);

    const precheck = await this.precheckImport(packagePath, options);
    if (!precheck.passed) {
      const failed = precheck.checks.find(item => !item.passed);
      throw new Error(failed?.message || global.i18next.t("SystemMigration.importPrecheckFailed"));
    }

    const manifest = precheck.inspect.manifest;
    if (manifest.database.requiresImportStep) {
      const validation = await this.validateImportDatabase(packagePath, options?.databaseOptions);
      if (!validation.passed) {
        throw new Error(validation.message);
      }
    }

    const tempRoot = join(os.tmpdir(), `banban-system-migration-import-${Date.now()}`);
    let stagedImport: PendingSystemMigrationState | null = null;
    let importPrepared = false;
    try {
      await unzip(packagePath, tempRoot, "utf8");
      const importedPreferences = await this.readRequiredJsonObject(join(tempRoot, "config", "preferences.json"));
      const currentPreferences = this.preferences.dump();
      const finalPreferences = this.buildImportedPreferences(
        importedPreferences,
        currentPreferences,
        manifest.database,
        manifest.includeApplicationData !== false,
        precheck.rootDirInfo.targetRootDir,
        options?.databaseOptions,
      );
      stagedImport = await this.stagePendingImport(tempRoot, finalPreferences, options?.databaseOptions);
      await writePendingSystemMigrationState(userDataPath, stagedImport);
      this.pendingImport = stagedImport;
      stagedImport = null;
      importPrepared = true;
      this.logger.log("system migration import staged, waiting for relaunch");

      return {
        needRelaunch: true,
      };
    } finally {
      if (importPrepared) {
        await this.cleanupManagedImportPackage(packagePath);
      }
      if (this.pendingImport?.cleanupDir !== tempRoot) {
        await rm(tempRoot, { recursive: true, force: true }).catch(() => null);
      }
      if (stagedImport) {
        await rm(stagedImport.cleanupDir, { recursive: true, force: true }).catch(() => null);
      }
    }
  }

  private async getDatabaseInfo(): Promise<SystemMigrationDatabaseInfo> {
    const type = this.preferences.get("formDatabaseType", FormDatabaseType.EMBEDDED);
    if (type === FormDatabaseType.EMBEDDED) {
      return {
        type,
        requiresImportStep: false,
        supported: true,
      };
    }

    const config = Object.assign({}, this.preferences.get("formDatabaseConfig", {}));
    delete config.password;
    if (type === FormDatabaseType.MYSQL) {
      return {
        type,
        requiresImportStep: true,
        supported: false,
        message: global.i18next.t("SystemMigration.mysqlNotSupported"),
        configSummary: config,
      };
    }

    return {
      type,
      requiresImportStep: true,
      supported: true,
      configSummary: config,
    };
  }

  private async writeConfigPayloads(tempRoot: string) {
    await this.writeJson(join(tempRoot, "config", "preferences.json"), this.buildExportedPreferencesPayload());
  }

  private resolveExportOptions(options?: SystemMigrationExportOptions): ResolvedSystemMigrationExportOptions {
    return {
      includeApplicationData: options?.includeApplicationData !== false,
    };
  }

  private createExportTask(taskId?: string): ExportTaskState {
    this.ensureNoConcurrentExportTask(taskId);
    const task = {
      id: taskId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      canceled: false,
    };
    this.activeExportTask = task;
    return task;
  }

  private ensureNoConcurrentExportTask(taskId?: string) {
    if (this.activeExportTask && this.activeExportTask.id !== taskId) {
      throw new Error(global.i18next.t("SystemMigration.exportTaskRunning"));
    }
    const hasOtherRunningManagedTask = Array.from(this.managedExportTasks.values()).some(task => {
      return task.status === "running" && task.taskId !== taskId;
    });
    if (hasOtherRunningManagedTask) {
      throw new Error(global.i18next.t("SystemMigration.exportTaskRunning"));
    }
  }

  private ensureExportNotCanceled(task: ExportTaskState) {
    if (!task.canceled) {
      return;
    }
    const error = new Error(EXPORT_CANCELED_ERROR);
    (error as Error & { code?: string }).code = EXPORT_CANCELED_ERROR;
    throw error;
  }

  private isExportCanceledError(error: unknown) {
    return error instanceof Error && ((error as Error & { code?: string }).code === EXPORT_CANCELED_ERROR || error.message === EXPORT_CANCELED_ERROR);
  }

  private isSupportedPackageVersion(version: number) {
    return version === SYSTEM_MIGRATION_PACKAGE_VERSION;
  }

  private resolveStorageItemRestoreMode(
    source: StorageSource,
    sourceExists: boolean,
    exportOptions: ResolvedSystemMigrationExportOptions,
  ): SystemMigrationStorageRestoreMode {
    const exportActualSource = exportOptions.includeApplicationData || !source.applicationData;
    if (exportActualSource) {
      return sourceExists ? "replace" : "remove";
    }
    return source.type === "directory" && source.exportEmptyDirectoryWhenExcluded ? "reset-empty" : "remove";
  }

  private async copyStoragePayloads(tempRoot: string, exportOptions: ResolvedSystemMigrationExportOptions): Promise<SystemMigrationStorageItem[]> {
    const sources = await this.getStorageSources();
    const items: SystemMigrationStorageItem[] = [];

    for (const source of sources) {
      const sourceExists = existsSync(source.sourcePath);
      const restoreMode = this.resolveStorageItemRestoreMode(source, sourceExists, exportOptions);
      if (source.required && restoreMode === "remove") {
        throw new Error(global.i18next.t("SystemMigration.requiredStorageMissing", { path: source.relativePath }));
      }

      let bytes = 0;
      if (restoreMode === "replace") {
        const packagePath = join(tempRoot, source.target, source.relativePath);
        bytes = await this.getSourceSize(source.sourcePath, source.type);
        await this.copyToPackage(source.sourcePath, packagePath, source.type);
      }
      items.push({
        key: source.key,
        relativePath: source.relativePath.replace(/\\/g, "/"),
        bytes,
        target: source.target,
        exists: sourceExists,
        type: source.type,
        restoreMode,
      });
    }

    return items;
  }

  private async buildManifest(
    database: SystemMigrationDatabaseInfo,
    items: SystemMigrationStorageItem[],
    exportOptions: ResolvedSystemMigrationExportOptions,
    formDataManifest?: SystemMigrationFormDataManifest | null,
  ): Promise<SystemMigrationPackageManifest> {
    const formDataBytes = formDataManifest?.totalBytes || 0;
    const manifestDatabase = {
      ...database,
      requiresImportStep: exportOptions.includeApplicationData ? database.requiresImportStep : false,
    };
    return {
      format: SYSTEM_MIGRATION_PACKAGE_FORMAT,
      version: SYSTEM_MIGRATION_PACKAGE_VERSION,
      appVersion: __APP_VERSION__,
      exportedAt: Date.now(),
      database: manifestDatabase,
      includeApplicationData: exportOptions.includeApplicationData,
      formDataBytes: formDataBytes || undefined,
      formDataTarget: formDataManifest?.target,
      items,
      totalBytes: items.reduce((sum, item) => sum + item.bytes, 0) + formDataBytes,
    };
  }

  private async exportFormData(
    tempRoot: string,
    database: SystemMigrationDatabaseInfo,
    exportOptions: ResolvedSystemMigrationExportOptions,
    exportTask: ExportTaskState,
  ): Promise<SystemMigrationFormDataManifest | null> {
    if (!exportOptions.includeApplicationData) {
      return null;
    }
    if (![FormDatabaseType.EMBEDDED, FormDatabaseType.MONGODB].includes(database.type)) {
      return null;
    }

    const mode = database.type === FormDatabaseType.MONGODB ? "external" : "embedded";
    const nocodeRepository = this.orm.em.getRepository(NocodeEntity);
    const nocodes = await nocodeRepository.find({});
    const collections: SystemMigrationFormDataCollection[] = [];
    let totalBytes = 0;
    for (const nocode of nocodes) {
      this.ensureExportNotCanceled(exportTask);
      let body: NocodeBody;
      try {
        body = await getNocodeBody(this.nocodesDir, nocode.id);
      } catch (error) {
        continue;
      }
      const tables = body?.formData?.options?.tables || [];
      for (const table of tables) {
        this.ensureExportNotCanceled(exportTask);
        const collection = await this.exportFormDataCollection(tempRoot, nocode.id, table, exportTask, database.type);
        totalBytes += collection.bytes;
        collections.push(collection);
      }
    }

    return {
      mode,
      target: mode === "embedded" ? SystemMigrationStorageTarget.ROOT_DIR : undefined,
      totalBytes,
      collections,
    };
  }

  private async exportFormDataCollection(
    tempRoot: string,
    nocodeId: string,
    table: FormDataTable,
    exportTask: ExportTaskState,
    databaseType: FormDatabaseType,
  ): Promise<SystemMigrationFormDataCollection> {
    const db = await this.dbManager.getDB(nocodeId, table);
    const chunks: SystemMigrationFormDataChunk[] = [];
    let rowCount = 0;
    let bytes = 0;
    const pageState: ExportFormDataPageState = {
      skip: 0,
    };
    const sort = databaseType === FormDatabaseType.MONGODB
      ? {
          [SystemField.CREATE_TIME]: SortType.ASC,
          _id: SortType.ASC,
        } as any
      : {
          _time: SortType.ASC,
          _id: SortType.ASC,
        } as any;

    while (true) {
      this.ensureExportNotCanceled(exportTask);
      const rows = await db.find(this.buildExportFormDataQuery(databaseType, pageState), {
        limit: FORM_DATA_EXPORT_CHUNK_ROW_LIMIT,
        skip: databaseType === FormDatabaseType.MONGODB ? undefined : pageState.skip,
        sort,
      });
      if (!rows.length) {
        break;
      }

      const sanitizedRows = rows.map(item => this.sanitizeFormDataRow(item));
      const relativePath = this.buildFormDataChunkRelativePath(nocodeId, table.uid, chunks.length);
      const filePath = this.resolveFormDataPath(tempRoot, relativePath);
      await this.writeJson(filePath, sanitizedRows, false);
      const fileStat = await stat(filePath);
      chunks.push({
        relativePath,
        rowCount: sanitizedRows.length,
        bytes: fileStat.size,
      });
      rowCount += sanitizedRows.length;
      bytes += fileStat.size;
      this.updateExportFormDataPageState(databaseType, pageState, rows);
      if (rows.length < FORM_DATA_EXPORT_CHUNK_ROW_LIMIT) {
        break;
      }
    }

    return {
      nocodeId,
      tableUid: table.uid,
      tableName: table.tableName,
      rowCount,
      bytes,
      chunks,
    };
  }

  private buildFormDataChunkRelativePath(nocodeId: string, tableUid: string, chunkIndex: number) {
    const chunkFileName = `chunk-${String(chunkIndex + 1).padStart(5, "0")}.json`;
    return `${this.buildFormDataCollectionRelativeDir(nocodeId, tableUid)}/${chunkFileName}`;
  }

  private buildFormDataCollectionRelativeDir(nocodeId: string, tableUid: string) {
    return ["collections", encodeURIComponent(nocodeId), encodeURIComponent(tableUid)].join("/");
  }

  private resolveFormDataPath(tempRoot: string, relativePath: string) {
    return join(tempRoot, "form-data", ...relativePath.split("/"));
  }

  private async createEmbeddedDb(nocodeId: string, tableUid: string, tableName: string, nocodesDir = this.nocodesDir) {
    const { LevelDB } = await import("../formData/utils");
    const tableDir = join(nocodesDir, nocodeId, "form-data", tableUid);
    await mkdir(tableDir, { recursive: true });
    return new LevelDB(tableName, { tableDir });
  }

  private async stageEmbeddedFormData(tempRoot: string) {
    const manifest = await this.readJson<SystemMigrationFormDataManifest | null>(join(tempRoot, "form-data", "manifest.json"), null);
    if (!manifest || manifest.mode !== "embedded") {
      return;
    }

    const stagedNocodesDir = join(tempRoot, SystemMigrationStorageTarget.ROOT_DIR, "nocodes");
    for (const collection of manifest.collections || []) {
      const db = await this.createEmbeddedDb(collection.nocodeId, collection.tableUid, collection.tableName, stagedNocodesDir);
      try {
        await db.remove({});
        for (const chunk of collection.chunks || []) {
          const rows = await this.readJson(this.resolveFormDataPath(tempRoot, chunk.relativePath), []);
          if (rows.length) {
            await db.insert(rows);
          }
        }
      } finally {
        await db.close();
      }
    }
  }

  private async stagePendingImport(
    tempRoot: string,
    finalPreferences: Record<string, any>,
    databaseOptions?: SystemMigrationImportDatabaseOptions,
  ): Promise<PendingSystemMigrationState> {
    await this.stageEmbeddedFormData(tempRoot);
    await this.writeJson(join(tempRoot, "config", "final-preferences.json"), finalPreferences);
    return {
      cleanupDir: tempRoot,
      databaseOptions: databaseOptions ? {
        ...databaseOptions,
        port: Number(databaseOptions.port),
      } : undefined,
      status: "pending",
      updatedAt: Date.now(),
    };
  }

  private async cleanupPendingImport(userDataPath?: string) {
    const currentUserDataPath = userDataPath || await getRuntime().getUserDataPath();
    const pendingImport = this.pendingImport || undefined;
    this.pendingImport = undefined;
    await cleanupPendingSystemMigration(currentUserDataPath, pendingImport);
  }

  private buildImportedPreferences(
    importedPreferences: Record<string, any>,
    currentPreferences: Record<string, any>,
    database: SystemMigrationDatabaseInfo,
    includeApplicationData: boolean,
    targetRootDir: string,
    databaseOptions?: SystemMigrationImportDatabaseOptions,
  ) {
    const nextPreferences = this.sanitizeImportedPreferences(importedPreferences);
    this.applyCurrentPreferenceOverrides(nextPreferences, currentPreferences, LOCAL_ONLY_PREFERENCE_KEYS);
    this.applyCurrentPreferenceOverrides(nextPreferences, currentPreferences, ACCOUNT_IDENTITY_PREFERENCE_KEYS);
    nextPreferences.rootDir = targetRootDir;
    nextPreferences.projectsDir = targetRootDir;

    if (!includeApplicationData) {
      this.applyCurrentPreferenceOverrides(nextPreferences, currentPreferences, FORM_DATABASE_PREFERENCE_KEYS);
      return nextPreferences;
    }

    if (database.requiresImportStep && database.type === FormDatabaseType.MONGODB) {
      if (!databaseOptions) {
        throw new Error(global.i18next.t("SystemMigration.databaseConfigRequired"));
      }
      nextPreferences.formDatabaseType = FormDatabaseType.MONGODB;
      nextPreferences.formDatabaseConfig = {
        host: databaseOptions.host,
        port: Number(databaseOptions.port),
        username: databaseOptions.username,
        password: databaseOptions.password,
        authDatabase: databaseOptions.authDatabase,
      };
    }

    return nextPreferences;
  }

  private buildExportedPreferencesPayload() {
    return this.sanitizeExportedPreferences(this.preferences.dump());
  }

  private sanitizeExportedPreferences(preferences: Record<string, any>) {
    const nextPreferences = Object.assign({}, preferences);
    for (const key of ACCOUNT_IDENTITY_PREFERENCE_KEYS) {
      delete nextPreferences[key];
    }
    return nextPreferences;
  }

  private sanitizeImportedPreferences(preferences: Record<string, any>) {
    return this.sanitizeExportedPreferences(preferences);
  }

  private applyCurrentPreferenceOverrides(
    nextPreferences: Record<string, any>,
    currentPreferences: Record<string, any>,
    keys: readonly string[],
  ) {
    for (const key of keys) {
      if (currentPreferences[key] !== undefined) {
        nextPreferences[key] = currentPreferences[key];
      } else {
        delete nextPreferences[key];
      }
    }
  }

  private async buildDiskChecks(items: DiskCheckCandidate[]): Promise<SystemMigrationPrecheckItem[]> {
    const groupedChecks = new Map<string, DiskCheckCandidate & { keys: string[], labels: string[] }>();

    for (const item of items) {
      if (!item.needBytes) {
        continue;
      }

      const groupKey = this.getDiskGroupKey(item.path);
      const current = groupedChecks.get(groupKey);
      if (current) {
        current.needBytes += item.needBytes;
        current.keys.push(item.key);
        current.labels.push(item.label);
        continue;
      }

      groupedChecks.set(groupKey, {
        ...item,
        keys: [item.key],
        labels: [item.label],
      });
    }

    if (!groupedChecks.size) {
      return [{
        key: "disk-space",
        passed: true,
        message: global.i18next.t("SystemMigration.diskCheckSkipped"),
      }];
    }

    return Promise.all(Array.from(groupedChecks.values()).map(async item => {
      const scope = Array.from(new Set(item.labels)).join(global.i18next.t("SystemMigration.diskScopeSeparator"));
      return this.buildDiskCheck(item.keys.join("+"), item.path, item.needBytes, scope);
    }));
  }

  private async buildDiskCheck(key: string, path: string, needBytes: number, scope?: string): Promise<SystemMigrationPrecheckItem> {
    if (!needBytes) {
      return {
        key,
        passed: true,
        message: global.i18next.t("SystemMigration.diskCheckSkipped"),
      };
    }
    const disk = await checkDiskSpace(path);
    const passed = disk.free >= needBytes;
    return {
      key,
      passed,
      message: scope
        ? global.i18next.t(passed ? "SystemMigration.diskCheckPassedWithScope" : "SystemMigration.diskCheckFailedWithScope", { scope })
        : global.i18next.t(passed ? "SystemMigration.diskCheckPassed" : "SystemMigration.diskCheckFailed"),
    };
  }

  private getDiskGroupKey(path: string) {
    return parse(resolve(path)).root.toLowerCase();
  }

  private groupSizeByTarget(items: SystemMigrationStorageItem[]) {
    return items.reduce((acc, item) => {
      acc[item.target] = (acc[item.target] || 0) + item.bytes;
      return acc;
    }, {} as Record<SystemMigrationStorageTarget, number>);
  }

  private getPackageImportTempBytes(manifest: SystemMigrationPackageManifest, formDataBytes: number) {
    const storageBytes = manifest.items.reduce((sum, item) => sum + item.bytes, 0);
    return Math.max(manifest.totalBytes || 0, storageBytes + formDataBytes);
  }

  private async resolvePackageFormDataDiskUsage(
    packagePath: string,
    manifest: SystemMigrationPackageManifest,
  ): Promise<PackageFormDataDiskUsage> {
    if (manifest.formDataBytes) {
      return {
        totalBytes: manifest.formDataBytes,
        target: manifest.formDataTarget,
      };
    }

    let formDataManifestBuffer: Buffer | null = null;
    try {
      formDataManifestBuffer = await readZipFile(packagePath, "form-data/manifest.json") as Buffer;
    } catch (error) {
      return { totalBytes: 0 };
    }
    if (!formDataManifestBuffer?.length) {
      return { totalBytes: 0 };
    }

    let formDataManifest: SystemMigrationFormDataManifest | null = null;
    try {
      formDataManifest = JSON.parse(formDataManifestBuffer.toString("utf-8"));
    } catch (error) {
      return { totalBytes: 0 };
    }
    if (!formDataManifest) {
      return { totalBytes: 0 };
    }

    let totalBytes = formDataManifest.totalBytes || 0;
    if (!totalBytes) {
      for (const collection of formDataManifest.collections || []) {
        totalBytes += collection.bytes || 0;
        if (collection.bytes) {
          continue;
        }
        totalBytes += (collection.chunks || []).reduce((sum, chunk) => sum + (chunk.bytes || 0), 0);
      }
    }

    return {
      totalBytes,
      target: formDataManifest.target || (formDataManifest.mode === "embedded" ? SystemMigrationStorageTarget.ROOT_DIR : undefined),
    };
  }

  private async ensurePackageConfigPayloads(packagePath: string) {
    await this.readRequiredZipJsonObject(packagePath, "config/preferences.json");
  }

  private async readRequiredZipJsonObject(packagePath: string, relativePath: string) {
    try {
      const buffer = await readZipFile(packagePath, relativePath) as Buffer;
      if (!buffer?.length) {
        throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
      }
      return this.parseRequiredJsonObject(buffer.toString("utf-8"));
    } catch (error) {
      throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
    }
  }

  private async getImportContext(rootDirOverride?: string): Promise<ImportContext> {
    const userDataPath = await getRuntime().getUserDataPath();
    const rootDirBase = rootDirOverride || this.preferences.get("rootDir") || userDataPath;
    const projectsDirBase = rootDirOverride || this.preferences.get("projectsDir") || userDataPath;
    return {
      userDataPath,
      rootDirBase,
      projectsDirBase,
    };
  }

  private async buildImportRootDirInfo(
    importedPreferences: Record<string, any>,
    rootDirOverride?: string,
  ): Promise<SystemMigrationImportRootDirInfo> {
    const userDataPath = await getRuntime().getUserDataPath();
    const packageRootDir = typeof importedPreferences.rootDir === "string" ? importedPreferences.rootDir.trim() : "";
    const currentRootDir = (this.preferences.get("rootDir") || userDataPath || "").trim();
    const normalizedOverride = (rootDirOverride || "").trim();
    const packageRootDirDetected = !!packageRootDir;
    const packageRootDirExists = packageRootDirDetected ? existsSync(packageRootDir) : false;
    const targetRootDir = normalizedOverride || (packageRootDirExists ? packageRootDir : currentRootDir);

    return {
      packageRootDir,
      currentRootDir,
      targetRootDir,
      packageRootDirExists,
      packageRootDirDetected,
    };
  }

  private async getStorageSources(): Promise<StorageSource[]> {
    const userDataPath = await getRuntime().getUserDataPath();
    const systemDbTempPath = join(userDataPath, "resources", "system.sqlite");
    return [
      {
        key: "system-db",
        sourcePath: systemDbTempPath,
        relativePath: join("resources", "system.sqlite"),
        target: SystemMigrationStorageTarget.USER_DATA,
        type: "file",
        required: true,
      },
      {
        key: "reports",
        sourcePath: this.reportsDir,
        relativePath: "reports",
        target: SystemMigrationStorageTarget.USER_DATA,
        type: "directory",
      },
      {
        key: "agent-logs",
        sourcePath: join(userDataPath, "logs", "agent"),
        relativePath: join("logs", "agent"),
        target: SystemMigrationStorageTarget.USER_DATA,
        type: "directory",
      },
      {
        key: "projects",
        sourcePath: this.projectsDir,
        relativePath: "projects",
        target: SystemMigrationStorageTarget.PROJECTS_DIR,
        type: "directory",
      },
      {
        key: "nocodes",
        sourcePath: this.nocodesDir,
        relativePath: "nocodes",
        target: SystemMigrationStorageTarget.ROOT_DIR,
        type: "directory",
      },
      {
        key: "uploads",
        sourcePath: this.uploadsDir,
        relativePath: "uploads",
        target: SystemMigrationStorageTarget.ROOT_DIR,
        type: "directory",
        applicationData: true,
        exportEmptyDirectoryWhenExcluded: true,
      },
    ];
  }

  private async copyToPackage(sourcePath: string, packagePath: string, type: "file" | "directory") {
    await mkdir(dirname(packagePath), { recursive: true });
    if (type === "file") {
      if (sourcePath.endsWith(join("resources", "system.sqlite"))) {
        await this.backupSystemDatabase(packagePath);
      } else {
        await copyFile(sourcePath, packagePath);
      }
      return;
    }
    await cp(sourcePath, packagePath, {
      recursive: true,
      force: true,
      filter: (src) => !this.shouldSkipStorageCopy(src),
    });
  }

  private shouldSkipStorageCopy(src: string) {
    return this.isFormDataPath(src);
  }

  private isFormDataPath(src: string) {
    const normalized = src.replace(/\\/g, "/").toLowerCase();
    return /\/form-data(\/|$)/.test(normalized);
  }

  private async backupSystemDatabase(destPath: string) {
    const sourcePath = join(await getRuntime().getUserDataPath(), "resources", "system.sqlite");
    if (!existsSync(sourcePath)) {
      return;
    }
    await mkdir(dirname(destPath), { recursive: true });
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(sourcePath, { readonly: true });
    try {
      await db.backup(destPath);
    } finally {
      db.close();
    }
  }

  private async getSourceSize(sourcePath: string, type: "file" | "directory") {
    if (!existsSync(sourcePath)) {
      return 0;
    }
    if (type === "directory") {
      return await this.getFilteredDirectorySize(sourcePath);
    }
    const fileStat = await stat(sourcePath);
    return fileStat.size;
  }

  private async getFilteredDirectorySize(dirPath: string) {
    if (this.shouldSkipStorageCopy(dirPath)) {
      return 0;
    }
    const entries = await readdir(dirPath, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);
      if (this.shouldSkipStorageCopy(entryPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        total += await this.getFilteredDirectorySize(entryPath);
        continue;
      }
      if (entry.isFile()) {
        const fileStat = await stat(entryPath);
        total += fileStat.size;
      }
    }
    return total;
  }

  private buildExportPackageFileName() {
    return `system-migration-${dayjs().format("YYYYMMDD-HHmmss")}${SYSTEM_MIGRATION_PACKAGE_EXTENSION}`;
  }

  private isManagedImportPackagePath(packagePath: string) {
    const uploadRoot = resolve(join(os.tmpdir(), MANAGED_IMPORT_PACKAGE_DIR_NAME));
    const normalizedPath = resolve(packagePath || "");
    const relativePath = relative(uploadRoot, normalizedPath);
    return !!relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath);
  }

  private async writeJson(filePath: string, payload: any, formatted = true) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(payload, null, formatted ? 2 : 0), "utf-8");
  }

  private async readRequiredJsonObject(filePath: string) {
    if (!existsSync(filePath)) {
      throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
    }
    const content = await readFile(filePath, "utf-8");
    return this.parseRequiredJsonObject(content);
  }

  private async readJson<T = any>(filePath: string, fallback: T): Promise<T> {
    if (!existsSync(filePath)) {
      return fallback;
    }
    const content = await readFile(filePath, "utf-8");
    if (!content.trim()) {
      return fallback;
    }
    return JSON.parse(content) as T;
  }

  private parseRequiredJsonObject(content: string): Record<string, any> {
    if (!content.trim()) {
      throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
    }
    let payload: unknown;
    try {
      payload = JSON.parse(content);
    } catch (error) {
      throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
    }
    return payload as Record<string, any>;
  }

  private sanitizeFormDataRow(row: Record<string, any>) {
    const cloned = Object.assign({}, row);
    delete cloned._id;
    return cloned;
  }

  private buildExportFormDataQuery(databaseType: FormDatabaseType, pageState: ExportFormDataPageState) {
    if (databaseType !== FormDatabaseType.MONGODB || pageState.lastMongoRowId === undefined) {
      return {};
    }

    return {
      $or: [
        {
          [SystemField.CREATE_TIME]: {
            $gt: pageState.lastMongoCreateTime,
          },
        },
        {
          [SystemField.CREATE_TIME]: pageState.lastMongoCreateTime,
          _id: {
            $gt: pageState.lastMongoRowId,
          },
        },
      ],
    };
  }

  private updateExportFormDataPageState(
    databaseType: FormDatabaseType,
    pageState: ExportFormDataPageState,
    rows: Record<string, any>[],
  ) {
    if (databaseType === FormDatabaseType.MONGODB) {
      const lastRow = rows[rows.length - 1];
      pageState.lastMongoCreateTime = lastRow?.[SystemField.CREATE_TIME];
      pageState.lastMongoRowId = lastRow?._id;
      return;
    }

    pageState.skip += rows.length;
  }
}
