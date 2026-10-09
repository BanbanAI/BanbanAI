import { FormDatabaseConfig, FormDatabaseType } from "./nocode";

export const SYSTEM_MIGRATION_PACKAGE_FORMAT = "banban-system-migration";
export const SYSTEM_MIGRATION_PACKAGE_VERSION = 3;
export const SYSTEM_MIGRATION_PACKAGE_LEGACY_VERSION = 1;
export const SYSTEM_MIGRATION_PACKAGE_EXTENSION = ".bbm";

export enum SystemMigrationStorageTarget {
  USER_DATA = "userData",
  ROOT_DIR = "rootDir",
  PROJECTS_DIR = "projectsDir",
}

export type SystemMigrationStorageRestoreMode = "replace" | "remove" | "reset-empty";

export type SystemMigrationStorageItem = {
  key: string;
  relativePath: string;
  bytes: number;
  target: SystemMigrationStorageTarget;
  exists?: boolean;
  type: "file" | "directory";
  restoreMode?: SystemMigrationStorageRestoreMode;
};

export type SystemMigrationDatabaseInfo = {
  type: FormDatabaseType;
  requiresImportStep: boolean;
  supported: boolean;
  message?: string;
  configSummary?: Partial<FormDatabaseConfig>;
};

export type SystemMigrationFormDataMode = "embedded" | "external";

export type SystemMigrationFormDataChunk = {
  relativePath: string;
  rowCount: number;
  bytes: number;
};

export type SystemMigrationFormDataCollection = {
  nocodeId: string;
  tableUid: string;
  tableName: string;
  rowCount: number;
  bytes: number;
  chunks: SystemMigrationFormDataChunk[];
};

export type SystemMigrationFormDataManifest = {
  mode: SystemMigrationFormDataMode;
  target?: SystemMigrationStorageTarget;
  totalBytes?: number;
  collections: SystemMigrationFormDataCollection[];
};

export type SystemMigrationPackageManifest = {
  format: typeof SYSTEM_MIGRATION_PACKAGE_FORMAT;
  version: number;
  appVersion: string;
  exportedAt: number;
  database: SystemMigrationDatabaseInfo;
  includeApplicationData?: boolean;
  formDataBytes?: number;
  formDataTarget?: SystemMigrationStorageTarget;
  items: SystemMigrationStorageItem[];
  totalBytes: number;
};

export type SystemMigrationPackageInspectResult = {
  packagePath: string;
  manifest: SystemMigrationPackageManifest;
  valid: boolean;
};

export type SystemMigrationPrecheckItem = {
  key: string;
  passed: boolean;
  message: string;
};

export type SystemMigrationImportRootDirInfo = {
  packageRootDir: string;
  currentRootDir: string;
  targetRootDir: string;
  packageRootDirExists: boolean;
  packageRootDirDetected: boolean;
};

export type SystemMigrationPrecheckResult = {
  packagePath: string;
  inspect: SystemMigrationPackageInspectResult;
  rootDirInfo: SystemMigrationImportRootDirInfo;
  checks: SystemMigrationPrecheckItem[];
  passed: boolean;
};

export type SystemMigrationExportSummary = {
  database: SystemMigrationDatabaseInfo;
};

export type SystemMigrationExportOptions = {
  includeApplicationData?: boolean;
};

export type SystemMigrationExportResult = {
  canceled?: boolean;
  filePath?: string;
  checksum?: string;
  database: SystemMigrationDatabaseInfo;
  includeApplicationData?: boolean;
};

export type SystemMigrationExportTaskStage = "running" | "success" | "failed" | "canceled";

export type SystemMigrationExportTaskStatus = {
  taskId: string;
  status: SystemMigrationExportTaskStage;
  fileName?: string;
  message?: string;
  result?: SystemMigrationExportResult;
  updatedAt: number;
};

export type SystemMigrationImportDatabaseOptions = {
  type: FormDatabaseType;
  host: string;
  port: number;
  username: string;
  password: string;
  authDatabase?: string;
};

export type SystemMigrationValidateDatabaseResult = {
  passed: boolean;
  message: string;
};

export type SystemMigrationApplyStage = "idle" | "pending" | "success" | "failed";

export type SystemMigrationApplyStatus = {
  status: SystemMigrationApplyStage;
  pending: boolean;
  canRetry: boolean;
  message?: string;
  updatedAt?: number;
};
