import {
  SystemMigrationApplyStatus,
  SystemMigrationFormDataManifest,
  SystemMigrationImportDatabaseOptions,
  SystemMigrationPackageManifest,
  SystemMigrationStorageItem,
  SystemMigrationStorageRestoreMode,
  SystemMigrationStorageTarget,
} from "@common/types/system-migration";
import { FormDatabaseType } from "@common/types/nocode";
import Conf from "conf";
import { Logger } from "@nestjs/common";
import { Db, MongoClient } from "mongodb";
import { existsSync } from "fs";
import { copyFile, cp, mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

export type PendingSystemMigrationState = {
  cleanupDir: string;
  databaseOptions?: SystemMigrationImportDatabaseOptions;
  status: "pending" | "failed";
  errorMessage?: string;
  updatedAt: number;
};

type PendingSystemMigrationResult = {
  status: "success" | "failed";
  message?: string;
  updatedAt: number;
};

type ImportContext = {
  userDataPath: string;
  rootDirBase: string;
  projectsDirBase: string;
};

type RestoreBackupState = {
  item: SystemMigrationStorageItem;
  targetPath: string;
  backupPath?: string;
  walBackupPath?: string;
  shmBackupPath?: string;
  journalBackupPath?: string;
};

type AppliedChange = {
  rollback(): Promise<void>;
  commit(): Promise<void>;
};

type MongoCollectionSwitchState = {
  targetName: string;
  stagingName: string;
  backupName: string;
  hadOriginal: boolean;
  switched: boolean;
};

const PENDING_DIR_NAME = "system-migration-pending";
const PENDING_STATE_FILE_NAME = "pending.json";
const PENDING_RESULT_FILE_NAME = "result.json";
const FORM_DATA_DB_NAME = "banban_form_data";
const PREFERENCES_ENCRYPTION_KEY = "shanhaibipreferences";
const LOCAL_ONLY_STORAGE_ITEM_KEYS = [
  "https-protocol",
] as const;

export function getPendingSystemMigrationRoot(userDataPath: string) {
  return join(userDataPath, "Temp", PENDING_DIR_NAME);
}

export function getPendingSystemMigrationStatePath(userDataPath: string) {
  return join(getPendingSystemMigrationRoot(userDataPath), PENDING_STATE_FILE_NAME);
}

function getPendingSystemMigrationResultPath(userDataPath: string) {
  return join(getPendingSystemMigrationRoot(userDataPath), PENDING_RESULT_FILE_NAME);
}

export async function readPendingSystemMigrationState(userDataPath: string): Promise<PendingSystemMigrationState | null> {
  const state = await readJson<Partial<PendingSystemMigrationState> | null>(getPendingSystemMigrationStatePath(userDataPath), null);
  return normalizePendingSystemMigrationState(state);
}

export async function writePendingSystemMigrationState(userDataPath: string, state: PendingSystemMigrationState) {
  await writeJson(getPendingSystemMigrationStatePath(userDataPath), state);
}

export async function clearPendingSystemMigrationState(userDataPath: string) {
  await rm(getPendingSystemMigrationStatePath(userDataPath), { force: true }).catch(() => null);
}

export async function readPendingSystemMigrationResult(userDataPath: string): Promise<PendingSystemMigrationResult | null> {
  return await readJson<PendingSystemMigrationResult | null>(getPendingSystemMigrationResultPath(userDataPath), null);
}

export async function writePendingSystemMigrationResult(userDataPath: string, result: PendingSystemMigrationResult) {
  await writeJson(getPendingSystemMigrationResultPath(userDataPath), result);
}

export async function clearPendingSystemMigrationResult(userDataPath: string) {
  await rm(getPendingSystemMigrationResultPath(userDataPath), { force: true }).catch(() => null);
}

export async function getPendingSystemMigrationApplyStatus(userDataPath: string): Promise<SystemMigrationApplyStatus> {
  const pendingState = await readPendingSystemMigrationState(userDataPath);
  const result = await readPendingSystemMigrationResult(userDataPath);
  const hasPendingPayload = !!pendingState?.cleanupDir && existsSync(pendingState.cleanupDir);

  if (result) {
    return {
      status: result.status,
      pending: hasPendingPayload && pendingState?.status === "pending",
      canRetry: hasPendingPayload && pendingState?.status === "failed",
      message: result.message,
      updatedAt: result.updatedAt,
    };
  }

  if (pendingState?.status === "failed") {
    return {
      status: "failed",
      pending: false,
      canRetry: hasPendingPayload,
      message: pendingState.errorMessage,
      updatedAt: pendingState.updatedAt,
    };
  }

  if (pendingState?.status === "pending" && hasPendingPayload) {
    return {
      status: "pending",
      pending: true,
      canRetry: false,
      updatedAt: pendingState.updatedAt,
    };
  }

  return {
    status: "idle",
    pending: false,
    canRetry: false,
  };
}

export async function retryPendingSystemMigration(userDataPath: string): Promise<PendingSystemMigrationState> {
  const pendingState = await readPendingSystemMigrationState(userDataPath);
  if (!pendingState?.cleanupDir || !existsSync(pendingState.cleanupDir)) {
    throw new Error(global.i18next.t("SystemMigration.retryNotAvailable"));
  }

  const nextState: PendingSystemMigrationState = {
    cleanupDir: pendingState.cleanupDir,
    databaseOptions: pendingState.databaseOptions,
    status: "pending",
    updatedAt: Date.now(),
  };
  await writePendingSystemMigrationState(userDataPath, nextState);
  await clearPendingSystemMigrationResult(userDataPath);
  return nextState;
}

export async function cleanupPendingSystemMigration(userDataPath: string, state?: PendingSystemMigrationState | null) {
  const pendingState = state || await readPendingSystemMigrationState(userDataPath);
  if (pendingState?.cleanupDir) {
    await rm(pendingState.cleanupDir, { recursive: true, force: true }).catch(() => null);
  }
  await clearPendingSystemMigrationState(userDataPath);
}

export async function applyPendingSystemMigration(userDataPath: string, logger = new Logger("SystemMigrationPending")) {
  const pendingState = await readPendingSystemMigrationState(userDataPath);
  if (!pendingState?.cleanupDir || pendingState.status !== "pending" || !existsSync(pendingState.cleanupDir)) {
    return false;
  }

  await clearPendingSystemMigrationResult(userDataPath);
  try {
    await applyPendingSystemMigrationState(userDataPath, pendingState, logger);
    await cleanupPendingSystemMigration(userDataPath, pendingState);
    await writePendingSystemMigrationResult(userDataPath, {
      status: "success",
      updatedAt: Date.now(),
    });
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.stack || error.message : String(error);
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`apply pending system migration failed: ${detail}`);
    const failedAt = Date.now();
    await writePendingSystemMigrationState(userDataPath, {
      cleanupDir: pendingState.cleanupDir,
      databaseOptions: pendingState.databaseOptions,
      status: "failed",
      errorMessage: message,
      updatedAt: failedAt,
    }).catch(() => null);
    await writePendingSystemMigrationResult(userDataPath, {
      status: "failed",
      message,
      updatedAt: failedAt,
    }).catch(() => null);
    return false;
  }
}

async function applyPendingSystemMigrationState(
  userDataPath: string,
  pendingState: PendingSystemMigrationState,
  logger: Logger,
) {
  const manifest = await readJson<SystemMigrationPackageManifest | null>(join(pendingState.cleanupDir, "manifest.json"), null);
  if (!manifest) {
    throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
  }

  const finalPreferences = await readJson<Record<string, any>>(join(pendingState.cleanupDir, "config", "final-preferences.json"), {});
  const context = buildImportContext(userDataPath, finalPreferences);

  const mongoChange = await applyExternalMongoFormData(pendingState.cleanupDir, manifest, pendingState.databaseOptions);
  let storageChange: AppliedChange | null = null;
  let preferencesChange: AppliedChange | null = null;

  try {
    storageChange = await applyStorageItems(pendingState.cleanupDir, manifest.items, context);
    preferencesChange = await applyConfStore(userDataPath, "Pref", PREFERENCES_ENCRYPTION_KEY, finalPreferences);
  } catch (error) {
    await rollbackAppliedChange(preferencesChange, logger, "preferences");
    await rollbackAppliedChange(storageChange, logger, "storage items");
    await rollbackAppliedChange(mongoChange, logger, "external mongo form data");
    throw error;
  }

  await commitAppliedChange(preferencesChange, logger, "preferences");
  await commitAppliedChange(storageChange, logger, "storage items");
  await commitAppliedChange(mongoChange, logger, "external mongo form data");
}

function buildImportContext(userDataPath: string, finalPreferences: Record<string, any>): ImportContext {
  return {
    userDataPath,
    rootDirBase: finalPreferences.rootDir || userDataPath,
    projectsDirBase: finalPreferences.projectsDir || userDataPath,
  };
}

async function applyStorageItems(
  cleanupDir: string,
  items: SystemMigrationStorageItem[],
  context: ImportContext,
): Promise<AppliedChange> {
  const backups: RestoreBackupState[] = [];
  try {
    for (const item of items) {
      if (isLocalOnlyStorageItem(item)) {
        continue;
      }
      const targetPath = resolveTargetPath(item, context);
      const backup = await backupRestoreTarget(item, targetPath);
      backups.push(backup);
      await applyRestoreTarget(item, cleanupDir, targetPath);
    }
  } catch (error) {
    await rollbackRestoreBackups(backups);
    throw error;
  }

  return {
    rollback: async () => {
      await rollbackRestoreBackups(backups);
    },
    commit: async () => {
      await cleanupRestoreBackups(backups);
    },
  };
}

async function applyConfStore(
  userDataPath: string,
  configName: string,
  encryptionKey: string,
  data: Record<string, any>,
): Promise<AppliedChange> {
  const targetPath = join(userDataPath, configName);
  const backupPath = existsSync(targetPath)
    ? `${targetPath}.system-migration-backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    : "";

  if (backupPath) {
    await rm(backupPath, { force: true }).catch(() => null);
    await rename(targetPath, backupPath);
  }

  try {
    const conf = new Conf({
      cwd: userDataPath,
      configName,
      fileExtension: "",
      encryptionKey,
    });
    conf.clear();
    conf.store = Object.assign({}, data);
  } catch (error) {
    await rm(targetPath, { force: true }).catch(() => null);
    if (backupPath && existsSync(backupPath)) {
      await rename(backupPath, targetPath).catch(() => null);
    }
    throw error;
  }

  return {
    rollback: async () => {
      await rm(targetPath, { force: true }).catch(() => null);
      if (backupPath && existsSync(backupPath)) {
        await rename(backupPath, targetPath).catch(() => null);
      }
    },
    commit: async () => {
      if (backupPath && existsSync(backupPath)) {
        await rm(backupPath, { force: true }).catch(() => null);
      }
    },
  };
}

async function applyExternalMongoFormData(
  cleanupDir: string,
  manifest: SystemMigrationPackageManifest,
  databaseOptions?: SystemMigrationImportDatabaseOptions,
): Promise<AppliedChange> {
  const formDataManifest = await readJson<SystemMigrationFormDataManifest | null>(join(cleanupDir, "form-data", "manifest.json"), null);
  if (!formDataManifest || formDataManifest.mode !== "external") {
    return createNoopChange();
  }
  if (manifest.database.type !== FormDatabaseType.MONGODB || !databaseOptions) {
    throw new Error(global.i18next.t("SystemMigration.databaseConfigRequired"));
  }

  const client = createMongoClient(databaseOptions);
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  const db = client.db(FORM_DATA_DB_NAME);
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const states: MongoCollectionSwitchState[] = [];

  try {
    for (const collection of formDataManifest.collections || []) {
      const targetName = `${collection.nocodeId}_${collection.tableUid}`;
      const stagingName = `${targetName}__sm_new_${token}`;
      const backupName = `${targetName}__sm_backup_${token}`;
      await dropCollectionIfExists(db, stagingName);
      await dropCollectionIfExists(db, backupName);
      await db.createCollection(stagingName);
      for (const chunk of collection.chunks || []) {
        const rows = await readJson<any[]>(resolveFormDataPath(cleanupDir, chunk.relativePath), []);
        if (rows.length) {
          await db.collection(stagingName).insertMany(rows);
        }
      }
      states.push({
        targetName,
        stagingName,
        backupName,
        hadOriginal: await collectionExists(db, targetName),
        switched: false,
      });
    }

    for (const state of states) {
      if (state.hadOriginal) {
        await db.collection(state.targetName).rename(state.backupName, { dropTarget: true });
      }
      await db.collection(state.stagingName).rename(state.targetName, { dropTarget: true });
      state.switched = true;
    }
  } catch (error) {
    await rollbackMongoStates(db, states);
    await cleanupMongoStates(db, states);
    await client.close().catch(() => null);
    throw error;
  }

  return {
    rollback: async () => {
      await rollbackMongoStates(db, states);
      await cleanupMongoStates(db, states);
      await client.close().catch(() => null);
    },
    commit: async () => {
      await cleanupMongoStates(db, states);
      await client.close().catch(() => null);
    },
  };
}

function createMongoClient(options: SystemMigrationImportDatabaseOptions) {
  const credentials = options.username && options.password
    ? `${encodeURIComponent(options.username)}:${encodeURIComponent(options.password)}@`
    : "";
  return new MongoClient(`mongodb://${credentials}${options.host}:${Number(options.port)}`, {
    authSource: options.username ? (options.authDatabase || "admin") : undefined,
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 10_000,
  });
}

function createNoopChange(): AppliedChange {
  return {
    rollback: async () => undefined,
    commit: async () => undefined,
  };
}

async function rollbackAppliedChange(change: AppliedChange | null, logger: Logger, label: string) {
  if (!change) {
    return;
  }
  try {
    await change.rollback();
  } catch (error) {
    logger.error(`rollback ${label} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function commitAppliedChange(change: AppliedChange | null, logger: Logger, label: string) {
  if (!change) {
    return;
  }
  try {
    await change.commit();
  } catch (error) {
    logger.warn(`commit ${label} cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function rollbackMongoStates(db: Db, states: MongoCollectionSwitchState[]) {
  for (const state of [...states].reverse()) {
    if (state.switched) {
      await dropCollectionIfExists(db, state.targetName);
      if (state.hadOriginal && await collectionExists(db, state.backupName)) {
        await db.collection(state.backupName).rename(state.targetName, { dropTarget: true });
      }
      continue;
    }

    if (state.hadOriginal && await collectionExists(db, state.backupName)) {
      await dropCollectionIfExists(db, state.targetName);
      await db.collection(state.backupName).rename(state.targetName, { dropTarget: true });
    }
  }
}

async function cleanupMongoStates(db: Db, states: MongoCollectionSwitchState[]) {
  for (const state of states) {
    await dropCollectionIfExists(db, state.stagingName);
    await dropCollectionIfExists(db, state.backupName);
  }
}

async function collectionExists(db: Db, name: string) {
  const collections = await db.listCollections({ name }, { nameOnly: true }).toArray();
  return collections.length > 0;
}

async function dropCollectionIfExists(db: Db, name: string) {
  if (await collectionExists(db, name)) {
    await db.collection(name).drop().catch(() => null);
  }
}

function resolveTargetPath(item: SystemMigrationStorageItem, context: ImportContext) {
  const relativePath = item.relativePath.replace(/\\/g, "/");
  if (item.target === SystemMigrationStorageTarget.USER_DATA) {
    return join(context.userDataPath, relativePath);
  }
  if (item.target === SystemMigrationStorageTarget.PROJECTS_DIR) {
    return join(context.projectsDirBase, relativePath);
  }
  return join(context.rootDirBase, relativePath);
}

function isSystemDatabaseItem(item: SystemMigrationStorageItem) {
  return item.key === "system-db";
}

function isLocalOnlyStorageItem(item: SystemMigrationStorageItem) {
  return (LOCAL_ONLY_STORAGE_ITEM_KEYS as readonly string[]).includes(item.key);
}

function resolveStorageItemRestoreMode(item: SystemMigrationStorageItem): SystemMigrationStorageRestoreMode {
  if (item.restoreMode) {
    return item.restoreMode;
  }
  return "replace";
}

async function backupRestoreTarget(item: SystemMigrationStorageItem, targetPath: string): Promise<RestoreBackupState> {
  const backupSuffix = `.system-migration-backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const state: RestoreBackupState = {
    item,
    targetPath,
  };

  if (existsSync(targetPath)) {
    state.backupPath = `${targetPath}${backupSuffix}`;
    await rm(state.backupPath, { recursive: true, force: true }).catch(() => null);
    await rename(targetPath, state.backupPath);
  }

  if (isSystemDatabaseItem(item)) {
    const walPath = `${targetPath}-wal`;
    const shmPath = `${targetPath}-shm`;
    const journalPath = `${targetPath}-journal`;
    if (existsSync(walPath)) {
      state.walBackupPath = `${walPath}${backupSuffix}`;
      await rm(state.walBackupPath, { force: true }).catch(() => null);
      await rename(walPath, state.walBackupPath);
    }
    if (existsSync(shmPath)) {
      state.shmBackupPath = `${shmPath}${backupSuffix}`;
      await rm(state.shmBackupPath, { force: true }).catch(() => null);
      await rename(shmPath, state.shmBackupPath);
    }
    if (existsSync(journalPath)) {
      state.journalBackupPath = `${journalPath}${backupSuffix}`;
      await rm(state.journalBackupPath, { force: true }).catch(() => null);
      await rename(journalPath, state.journalBackupPath);
    }
  }

  return state;
}

async function applyRestoreTarget(item: SystemMigrationStorageItem, cleanupDir: string, targetPath: string) {
  const restoreMode = resolveStorageItemRestoreMode(item);
  if (restoreMode === "remove") {
    return;
  }

  if (restoreMode === "reset-empty") {
    if (item.type === "directory") {
      await mkdir(targetPath, { recursive: true });
    }
    return;
  }

  const sourcePath = join(cleanupDir, item.target, item.relativePath.replace(/\\/g, "/"));
  if (!existsSync(sourcePath)) {
    throw new Error(global.i18next.t("SystemMigration.invalidPackage"));
  }

  if (item.type === "directory") {
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true, force: true });
    return;
  }

  await mkdir(dirname(targetPath), { recursive: true });
  if (isSystemDatabaseItem(item)) {
    await replaceSystemDatabase(sourcePath, targetPath);
    return;
  }
  await copyFile(sourcePath, targetPath);
}

async function rollbackRestoreBackups(backups: RestoreBackupState[]) {
  for (const backup of [...backups].reverse()) {
    await rm(backup.targetPath, { recursive: true, force: true }).catch(() => null);
    if (backup.backupPath && existsSync(backup.backupPath)) {
      await rename(backup.backupPath, backup.targetPath).catch(() => null);
    }
    if (backup.walBackupPath && existsSync(backup.walBackupPath)) {
      await rename(backup.walBackupPath, `${backup.targetPath}-wal`).catch(() => null);
    }
    if (backup.shmBackupPath && existsSync(backup.shmBackupPath)) {
      await rename(backup.shmBackupPath, `${backup.targetPath}-shm`).catch(() => null);
    }
    if (backup.journalBackupPath && existsSync(backup.journalBackupPath)) {
      await rename(backup.journalBackupPath, `${backup.targetPath}-journal`).catch(() => null);
    }
  }
}

async function cleanupRestoreBackups(backups: RestoreBackupState[]) {
  for (const backup of backups) {
    if (backup.backupPath && existsSync(backup.backupPath)) {
      await rm(backup.backupPath, { recursive: true, force: true }).catch(() => null);
    }
    if (backup.walBackupPath && existsSync(backup.walBackupPath)) {
      await rm(backup.walBackupPath, { force: true }).catch(() => null);
    }
    if (backup.shmBackupPath && existsSync(backup.shmBackupPath)) {
      await rm(backup.shmBackupPath, { force: true }).catch(() => null);
    }
    if (backup.journalBackupPath && existsSync(backup.journalBackupPath)) {
      await rm(backup.journalBackupPath, { force: true }).catch(() => null);
    }
  }
}

async function replaceSystemDatabase(sourcePath: string, targetPath: string) {
  await mkdir(dirname(targetPath), { recursive: true });
  await rm(`${targetPath}-wal`, { force: true }).catch(() => null);
  await rm(`${targetPath}-shm`, { force: true }).catch(() => null);
  await rm(`${targetPath}-journal`, { force: true }).catch(() => null);
  await copyFile(sourcePath, targetPath);
}

function resolveFormDataPath(cleanupDir: string, relativePath: string) {
  return join(cleanupDir, "form-data", ...relativePath.split("/"));
}

async function writeJson(filePath: string, payload: any) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

function normalizePendingSystemMigrationState(
  state: Partial<PendingSystemMigrationState> | null,
): PendingSystemMigrationState | null {
  if (!state?.cleanupDir) {
    return null;
  }
  return {
    cleanupDir: state.cleanupDir,
    databaseOptions: state.databaseOptions,
    status: state.status === "failed" ? "failed" : "pending",
    errorMessage: state.errorMessage,
    updatedAt: state.updatedAt || Date.now(),
  };
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) {
    return fallback;
  }
  const content = await readFile(filePath, "utf-8");
  if (!content.trim()) {
    return fallback;
  }
  return JSON.parse(content) as T;
}
