import { NocodeBody, NocodeFormData, NocodeStructureType, ProjectNode } from '@common/types/nocode';
import { getRuntime } from "@main/runtime";
import { DepolyFile } from "@main/utils";
import { basename, extname, join } from "path";
import { cp, mkdir } from "fs/promises";
import { writeFile, readFile, readdir, rm, rename } from "fs/promises";
import { existsSync } from 'fs';
import { unique } from '@common/utils/unique';
import { ConnectionUID, Field, TableUID } from '@common/types/project';
import { Logger } from '@nestjs/common';
import { LRUCache } from "lru-cache";
import { deepClone } from '@common/utils/object';
import { SignContext } from '@main/modules/nocode/Interceptors/sign.Interceptor';
import { mappingSystemFieldAlias, SystemField } from '@common/utils';
import { isDataOwnerEnabledTable } from '@common/utils/connection';
import { mergeNewerSerialNumberRuntimeState } from './serial-number-runtime';
import type { RuntimeState, SerialNumberCounterState } from './serial-number-runtime';

export { mergeNewerSerialNumberRuntimeState } from './serial-number-runtime';
export type { RuntimeState, SerialNumberCounterState } from './serial-number-runtime';

const nocodeBodyCache = new LRUCache<string, NocodeBody>({
  max: 100,
});
const runtimeStateCache = new LRUCache<string, RuntimeState>({
  max: 100,
});

const logger = new Logger('nocodeUtils')
const RUNTIME_STATE_VERSION = 1;
const RUNTIME_FILENAME = "runtime.json";
const MAIN_JSON_FILENAME = "main.json";
const MAIN_JSON_BAD_FILENAME = "main.json.bad";

// 内容版本号：每次保存都换一个，供并发校验（x-sign 往返）判断内容是否已被他人保存
const createMainVersion = () => `${unique(32)}_${Date.now()}`;

const serializeNocodeBody = (nocodeBody: NocodeBody) => getRuntime().isProduction
  ? JSON.stringify(nocodeBody)
  : JSON.stringify(nocodeBody, null, 2);

const getRestoreBackupUnavailableMessage = (nocodeId: string) => {
  return global.i18next.t("commonNocode.restoreBackupUnavailable", { appId: nocodeId });
};

type SerialNumberFieldContext = {
  tableId: string;
  fieldId: string;
  field: Field;
  column?: Record<string, any>;
}

const getRuntimeStatePath = (nocodeDir: string) => join(nocodeDir, RUNTIME_FILENAME);

export const createEmptyRuntimeState = (): RuntimeState => ({
  version: RUNTIME_STATE_VERSION,
  serialNumber: {
    counters: {},
  },
});

export const normalizeRuntimeState = (runtimeState?: Partial<RuntimeState> | null): RuntimeState => ({
  version: RUNTIME_STATE_VERSION,
  serialNumber: {
    counters: runtimeState?.serialNumber?.counters || {},
  },
});

const cloneCounter = (counter?: SerialNumberCounterState | null): SerialNumberCounterState | null => {
  if (!counter) {
    return null;
  }

  const clonedCounter: SerialNumberCounterState = {};
  if (counter.count !== undefined) {
    clonedCounter.count = counter.count;
  }
  if (counter.resetTime !== undefined) {
    clonedCounter.resetTime = counter.resetTime;
  }
  if (counter.updateTime !== undefined) {
    clonedCounter.updateTime = counter.updateTime;
  }
  return clonedCounter;
};

const hasCounterValue = (counter?: SerialNumberCounterState | null) => {
  return !!counter && ["count", "resetTime", "updateTime"].some((key) => counter[key] !== undefined);
};

const pickLegacyCounter = (fieldCounter?: SerialNumberCounterState | null, columnCounter?: SerialNumberCounterState | null) => {
  const normalizedFieldCounter = cloneCounter(fieldCounter);
  const normalizedColumnCounter = cloneCounter(columnCounter);

  if (!hasCounterValue(normalizedFieldCounter) && !hasCounterValue(normalizedColumnCounter)) {
    return null;
  }

  const fieldUpdateTime = normalizedFieldCounter?.updateTime ?? 0;
  const columnUpdateTime = normalizedColumnCounter?.updateTime ?? 0;
  if (columnUpdateTime > fieldUpdateTime) {
    return normalizedColumnCounter;
  }
  if (fieldUpdateTime > columnUpdateTime) {
    return normalizedFieldCounter;
  }

  return {
    count: normalizedColumnCounter?.count ?? normalizedFieldCounter?.count,
    resetTime: normalizedColumnCounter?.resetTime ?? normalizedFieldCounter?.resetTime,
    updateTime: normalizedColumnCounter?.updateTime ?? normalizedFieldCounter?.updateTime,
  };
};

const getSerialNumberFieldContexts = (formData?: NocodeFormData | null): SerialNumberFieldContext[] => {
  if (!formData?.tables?.length) {
    return [];
  }

  const optionTableMap = new Map((formData.options?.tables || []).map(table => [table.uid, table]));

  return formData.tables.reduce((contexts, table) => {
    const tableId = table?.meta?.uid || table?.uid;
    if (!tableId || !Array.isArray(table?.fields)) {
      return contexts;
    }

    const optionTable = optionTableMap.get(tableId);
    for (const field of table.fields) {
      if (field?.meta?.extra?.widgetType !== "widget.form.serialNumber") {
        continue;
      }

      contexts.push({
        tableId,
        fieldId: field.uid,
        field,
        column: optionTable?.columns?.find(column => column.uid === field?.meta?.uid),
      });
    }

    return contexts;
  }, [] as SerialNumberFieldContext[]);
};

const cleanupRuntimeStateCounters = (runtimeState: RuntimeState) => {
  for (const [tableId, fieldCounters] of Object.entries(runtimeState.serialNumber.counters || {})) {
    for (const [fieldId, counter] of Object.entries(fieldCounters || {})) {
      if (!hasCounterValue(counter)) {
        delete fieldCounters[fieldId];
      }
    }

    if (!Object.keys(fieldCounters || {}).length) {
      delete runtimeState.serialNumber.counters[tableId];
    }
  }

  return runtimeState;
};

const isRuntimeStateEmpty = (runtimeState?: RuntimeState | null) => {
  return !Object.keys(cleanupRuntimeStateCounters(normalizeRuntimeState(runtimeState)).serialNumber.counters).length;
};

export const getRuntimeCounter = (runtimeState: RuntimeState, tableId: string, fieldId: string) => {
  return cloneCounter(runtimeState?.serialNumber?.counters?.[tableId]?.[fieldId]);
};

export const setRuntimeCounter = (runtimeState: RuntimeState, tableId: string, fieldId: string, counter?: SerialNumberCounterState | null) => {
  const normalizedRuntimeState = normalizeRuntimeState(runtimeState);
  const normalizedCounter = cloneCounter(counter);

  if (!normalizedCounter || !hasCounterValue(normalizedCounter)) {
    if (normalizedRuntimeState.serialNumber.counters?.[tableId]) {
      delete normalizedRuntimeState.serialNumber.counters[tableId][fieldId];
      if (!Object.keys(normalizedRuntimeState.serialNumber.counters[tableId]).length) {
        delete normalizedRuntimeState.serialNumber.counters[tableId];
      }
    }
    return normalizedRuntimeState;
  }

  if (!normalizedRuntimeState.serialNumber.counters[tableId]) {
    normalizedRuntimeState.serialNumber.counters[tableId] = {};
  }
  normalizedRuntimeState.serialNumber.counters[tableId][fieldId] = normalizedCounter;
  return normalizedRuntimeState;
};

export const extractLegacyRuntimeStateFromNocodeBody = (nocodeBody?: NocodeBody | null): RuntimeState | null => {
  if (!nocodeBody?.formData) {
    return null;
  }

  const runtimeState = createEmptyRuntimeState();
  for (const context of getSerialNumberFieldContexts(nocodeBody.formData)) {
    const fieldCounter = context.field?.meta?.extra?.serialNumber;
    const columnCounter = context.column?.extra?.serialNumber;
    const counter = pickLegacyCounter(fieldCounter, columnCounter);
    if (!counter) {
      continue;
    }

    setRuntimeCounter(runtimeState, context.tableId, context.fieldId, counter);
  }

  return isRuntimeStateEmpty(runtimeState) ? null : runtimeState;
};

export const stripRuntimeStateFromNocodeBody = (nocodeBody?: NocodeBody | null): NocodeBody | null => {
  if (!nocodeBody) {
    return nocodeBody;
  }

  const strippedNocodeBody = deepClone(nocodeBody);
  for (const context of getSerialNumberFieldContexts(strippedNocodeBody.formData)) {
    const fieldSerialNumber = context.field?.meta?.extra?.serialNumber;
    if (fieldSerialNumber) {
      delete fieldSerialNumber.count;
      delete fieldSerialNumber.resetTime;
      delete fieldSerialNumber.updateTime;
    }

    const columnSerialNumber = context.column?.extra?.serialNumber;
    if (columnSerialNumber) {
      delete columnSerialNumber.count;
      delete columnSerialNumber.resetTime;
      delete columnSerialNumber.updateTime;
    }
  }

  return strippedNocodeBody;
};

export const mirrorRuntimeStateToNocodeBody = (nocodeBody: NocodeBody, runtimeState?: RuntimeState | null): NocodeBody => {
  if (!nocodeBody) {
    return nocodeBody;
  }

  // Runtime counters live on a few field/column metadata objects. Copy only
  // those paths instead of cloning the complete application body on every
  // runtime read (scheduled flows can perform this read for every row).
  const formData = nocodeBody.formData;
  const exportNocodeBody = {
    ...nocodeBody,
    formData: formData ? {
      ...formData,
      tables: (formData.tables || []).map(table => ({
        ...table,
        fields: (table.fields || []).map(field => {
          if (field?.meta?.extra?.widgetType !== "widget.form.serialNumber") {
            return field;
          }
          return {
            ...field,
            meta: {
              ...field.meta,
              extra: {
                ...field.meta.extra,
                serialNumber: field.meta.extra.serialNumber
                  ? { ...field.meta.extra.serialNumber }
                  : field.meta.extra.serialNumber,
              },
            },
          };
        }),
      })),
      options: formData.options ? {
        ...formData.options,
        tables: (formData.options.tables || []).map(table => ({
          ...table,
          columns: (table.columns || []).map(column => {
            if (column?.extra?.widgetType !== "widget.form.serialNumber") {
              return column;
            }
            return {
              ...column,
              extra: {
                ...column.extra,
                serialNumber: column.extra.serialNumber
                  ? { ...column.extra.serialNumber }
                  : column.extra.serialNumber,
              },
            };
          }),
        })),
      } : formData.options,
    } : formData,
  } as NocodeBody;
  const normalizedRuntimeState = normalizeRuntimeState(runtimeState);

  for (const context of getSerialNumberFieldContexts(exportNocodeBody?.formData)) {
    const counter = getRuntimeCounter(normalizedRuntimeState, context.tableId, context.fieldId);
    if (!counter) {
      continue;
    }

    if (context.field?.meta?.extra?.serialNumber) {
      context.field.meta.extra.serialNumber = {
        ...context.field.meta.extra.serialNumber,
        ...counter,
      };
    }

    if (context.column?.extra?.serialNumber) {
      context.column.extra.serialNumber = {
        ...context.column.extra.serialNumber,
        ...counter,
      };
    }
  }

  return exportNocodeBody;
};

export const pickRuntimeStateForNocodeBody = (nocodeBody: NocodeBody, runtimeState?: RuntimeState | null) => {
  const pickedRuntimeState = createEmptyRuntimeState();
  const normalizedRuntimeState = normalizeRuntimeState(runtimeState);

  for (const context of getSerialNumberFieldContexts(nocodeBody?.formData)) {
    const counter = getRuntimeCounter(normalizedRuntimeState, context.tableId, context.fieldId);
    if (!counter) {
      continue;
    }

    setRuntimeCounter(pickedRuntimeState, context.tableId, context.fieldId, counter);
  }

  return pickedRuntimeState;
};

const replaceOldJson = async (oldJsonDir: string) => {
  const files = await readdir(oldJsonDir);
  const targetFiles = files.filter(filename => filename.startsWith('main.json.old'));
  if (targetFiles.length === 0) return;
  targetFiles.sort((prev, next) => {
    const suffixA = parseInt(extname(prev).slice(1));
    const suffixB = parseInt(extname(next).slice(1));
    return suffixA - suffixB;
  });
  for (let index = targetFiles.length - 1; index >= 0; index--) {
    const filename = targetFiles[index];
    const oldPath = join(oldJsonDir, filename);
    if (index >= 999) {
      try {
        await rm(oldPath);
      } catch (err) {
        logger.log(`${oldPath} rm error`, err);
      }
    } else {
      const curName = basename(filename, extname(filename));
      const newPath = join(oldJsonDir, `${curName}.${index + 2}`);
      await rename(oldPath, newPath);
    }
  }
}
const nocodeSaveMap: Record<string, number> = {};

const buildVirtualDataOwnerField = (): Field => ({
  uid: SystemField.DATA_OWNER as any,
  alias: mappingSystemFieldAlias(SystemField.DATA_OWNER),
  type: "string",
  meta: {
    name: SystemField.DATA_OWNER,
    uid: SystemField.DATA_OWNER as any,
    subType: "account",
    extra: {},
    isSystem: true,
  },
} as unknown as Field);

const normalizeTableFields = (fields: Field[] = [], allowDataOwner = true) => {
  const normalizedFields = fields
    .filter(field => allowDataOwner || field?.meta?.name !== SystemField.DATA_OWNER)
    .map((field) => {
      if (!field?.meta?.isSystem) {
        return field;
      }

      return {
        ...field,
        alias: mappingSystemFieldAlias(field.meta?.name || field.alias),
      };
    });

  if (allowDataOwner && !normalizedFields.some(field => field?.meta?.name === SystemField.DATA_OWNER)) {
    normalizedFields.push(buildVirtualDataOwnerField());
  }

  return normalizedFields;
};

const normalizeOptionTableColumns = (columns: any[] = [], allowDataOwner = true) => {
  return columns
    .filter(column => allowDataOwner || column?.name !== SystemField.DATA_OWNER)
    .map((column) => {
      if (!column?.isSystem) {
        return column;
      }

      return {
        ...column,
        alias: mappingSystemFieldAlias(column.name || column.alias),
      };
    });
};

const normalizeFormDataSystemFields = (formData?: NocodeFormData | null) => {
  if (!formData?.tables?.length) {
    return;
  }

  for (const table of formData.tables) {
    const allowDataOwner = isDataOwnerEnabledTable(table);
    table.fields = normalizeTableFields(Array.isArray(table?.fields) ? table.fields : [], allowDataOwner);

    const optionTable = formData.options?.tables?.find(item => item?.uid === table?.meta?.uid);
    if (optionTable?.columns) {
      optionTable.columns = normalizeOptionTableColumns(optionTable.columns, allowDataOwner);
    }
  }
};

const normalizeNocodeBodySystemFields = (nocodeBody?: NocodeBody | null) => {
  if (!nocodeBody?.formData) {
    return nocodeBody;
  }

  normalizeFormDataSystemFields(nocodeBody.formData);
  return nocodeBody;
};

export async function readRuntimeState(nocodeDir: string): Promise<RuntimeState | null> {
  if (runtimeStateCache.has(nocodeDir)) {
    return deepClone(runtimeStateCache.get(nocodeDir));
  }

  try {
    const runtimeState = normalizeRuntimeState(JSON.parse(await readFile(getRuntimeStatePath(nocodeDir), "utf-8")));
    runtimeStateCache.set(nocodeDir, runtimeState);
    return deepClone(runtimeState);
  } catch (err) {
    return null;
  }
}

export async function saveRuntimeState(nocodeDir: string, runtimeState: RuntimeState) {
  const normalizedRuntimeState = cleanupRuntimeStateCounters(normalizeRuntimeState(runtimeState));
  const content = getRuntime().isProduction
    ? JSON.stringify(normalizedRuntimeState)
    : JSON.stringify(normalizedRuntimeState, null, 2);

  await mkdir(nocodeDir, { recursive: true });
  await writeFile(getRuntimeStatePath(nocodeDir), content, "utf-8");
  runtimeStateCache.set(nocodeDir, normalizedRuntimeState);
  return normalizedRuntimeState;
}

export async function removeRuntimeState(nocodeDir: string) {
  runtimeStateCache.delete(nocodeDir);
  await rm(getRuntimeStatePath(nocodeDir), { force: true }).catch(() => {});
}

const migrateLegacyRuntimeState = async (nocodeDir: string, nocodeBody?: NocodeBody | null) => {
  if (existsSync(getRuntimeStatePath(nocodeDir))) {
    return await readRuntimeState(nocodeDir);
  }

  const legacyRuntimeState = extractLegacyRuntimeStateFromNocodeBody(nocodeBody || await readNocodeBody(nocodeDir));
  if (!legacyRuntimeState) {
    return null;
  }

  return await saveRuntimeState(nocodeDir, legacyRuntimeState);
};

async function _getRuntimeState(nocodeDir: string): Promise<RuntimeState> {
  const runtimeState = await readRuntimeState(nocodeDir);
  if (runtimeState) {
    return runtimeState;
  }

  return await migrateLegacyRuntimeState(nocodeDir) || createEmptyRuntimeState();
}

export async function getNocodeRuntimeState(nocodesDir: string, nocodeId: string): Promise<RuntimeState> {
  const nocodeDir = join(nocodesDir, nocodeId);
  return await _getRuntimeState(nocodeDir);
}

export async function saveNocodeRuntimeState(nocodesDir: string, nocodeId: string, runtimeState: RuntimeState) {
  const nocodeDir = join(nocodesDir, nocodeId);
  return await saveRuntimeState(nocodeDir, runtimeState);
}

export async function syncNewerNocodeRuntimeStateFromBody(nocodesDir: string, nocodeId: string, nocodeBody: NocodeBody) {
  const submittedRuntimeState = extractLegacyRuntimeStateFromNocodeBody(nocodeBody);
  if (!submittedRuntimeState) {
    return false;
  }

  const currentRuntimeState = await getNocodeRuntimeState(nocodesDir, nocodeId);
  const mergedResult = mergeNewerSerialNumberRuntimeState(currentRuntimeState, submittedRuntimeState);
  if (!mergedResult.changed) {
    return false;
  }

  await saveNocodeRuntimeState(nocodesDir, nocodeId, mergedResult.runtimeState);
  return true;
}

export async function removeNocodeRuntimeState(nocodesDir: string, nocodeId: string) {
  const nocodeDir = join(nocodesDir, nocodeId);
  await removeRuntimeState(nocodeDir);
}

export async function writeNocodeBody(nocodeDir: string, nocodeBody: NocodeBody) {
  normalizeNocodeBodySystemFields(nocodeBody);
  const jsonDir = join(nocodeDir, "main.json");
  const id = basename(nocodeDir);
  if (
    (!nocodeSaveMap[id] || ((Date.now() - nocodeSaveMap[id]) > 60 * 1000))
    && existsSync(jsonDir)
  ) {
    nocodeSaveMap[id] = Date.now();
    await replaceOldJson(nocodeDir);
    const oldJsonDir = join(nocodeDir, `main.json.old.${Date.now()}.1`);
    await rename(jsonDir, oldJsonDir);
  }

  nocodeBody.sign = createMainVersion();
  const content = serializeNocodeBody(nocodeBody);

  await mkdir(nocodeDir, { recursive: true });
  await writeFile(jsonDir, content, "utf-8");
  nocodeBodyCache.delete(nocodeDir);

  return nocodeBody.sign;
}

async function readNocodeBody(nocodeDir: string): Promise<NocodeBody> {
  if (nocodeBodyCache.has(nocodeDir)) {
    return nocodeBodyCache.get(nocodeDir);
  }
  try {
    const jsonDir = join(nocodeDir, "main.json");
    const nocodeBody = JSON.parse(await readFile(jsonDir, "utf-8"));
    if (!nocodeBody.sign) {
      nocodeBody.sign = createMainVersion();
      await writeFile(jsonDir, serializeNocodeBody(nocodeBody), "utf-8");
    }
    normalizeNocodeBodySystemFields(nocodeBody);
    nocodeBodyCache.set(nocodeDir, nocodeBody);
    return nocodeBody;
  } catch (err) {
    return null;
  }
}

export function getEmptyNocodeBody(): NocodeBody {
  const cUID: ConnectionUID = `c_${unique()}`;
  const tUID: TableUID = `t_${unique()}`;
  const dataUID = unique();
  
  return {
    settings: {},
    connections: [],
    structure: []
  }
}

export async function saveNocodeBody(nocodesDir: string, nocodeId: string, nocodeBody: NocodeBody) {
  const nocodeDir = join(nocodesDir, nocodeId);
  try {
    // 这里先保存 nocodeBody， 防止nocodeBody没保存成功，而出现projectMeta却修改成功 的情况
    await migrateLegacyRuntimeState(nocodeDir, nocodeBody);
    const sign = await writeNocodeBody(nocodeDir, stripRuntimeStateFromNocodeBody(nocodeBody));
    SignContext.set(sign);
    return sign
  } catch (err) {
    throw err;
  }
}

function getFormReleaseDir(nocodesDir: string, nocodeId: string, tableUID: TableUID) {
  return join(nocodesDir, nocodeId, "release", "forms", tableUID);
}

export async function saveFormReleaseNocodeBody(nocodesDir: string, nocodeId: string, tableUID: TableUID, nocodeBody: NocodeBody) {
  const releaseDir = getFormReleaseDir(nocodesDir, nocodeId, tableUID);
  return await writeNocodeBody(releaseDir, nocodeBody);
}

export async function getFormReleaseNocodeBody(nocodesDir: string, nocodeId: string, tableUID: TableUID): Promise<NocodeBody> {
  const releaseDir = getFormReleaseDir(nocodesDir, nocodeId, tableUID);
  return _getNocodeBody(releaseDir);
}

export async function getNocodeBody(nocodesDir: string, nocodeId: string): Promise<NocodeBody> {
  const nocodeDir = join(nocodesDir, nocodeId);
  return _getNocodeBody(nocodeDir);
}

type NocodeOldVersionCandidate = {
  filename: string;
  path: string;
  order: number;
};

export type RestoreBrokenNocodeBodyResult = {
  body: NocodeBody;
  restoredFrom: {
    order: number;
  };
};

const getNocodeOldVersionCandidates = async (nocodeDir: string): Promise<NocodeOldVersionCandidate[]> => {
  const files = await readdir(nocodeDir).catch(() => []);
  return files
    .map((filename) => {
      const match = filename.match(/^main\.json\.old\.(.+)\.(\d+)$/);
      if (!match) {
        return null;
      }
      const order = Number.parseInt(match[2], 10);
      if (!Number.isFinite(order)) {
        return null;
      }
      return {
        filename,
        path: join(nocodeDir, filename),
        order,
      } as NocodeOldVersionCandidate;
    })
    .filter((candidate): candidate is NocodeOldVersionCandidate => !!candidate)
    .sort((left, right) => left.order - right.order);
};

const replaceFileByRename = async (fromPath: string, toPath: string) => {
  if (!existsSync(fromPath)) {
    return;
  }
  await rm(toPath, { force: true }).catch(() => null);
  await rename(fromPath, toPath);
};

const backupCurrentNocodeMainFiles = async (nocodeDir: string) => {
  await replaceFileByRename(join(nocodeDir, MAIN_JSON_FILENAME), join(nocodeDir, MAIN_JSON_BAD_FILENAME));
  nocodeBodyCache.delete(nocodeDir);
};

export async function restoreBrokenNocodeBodyFromOldVersions(nocodesDir: string, nocodeId: string): Promise<RestoreBrokenNocodeBodyResult> {
  const nocodeDir = join(nocodesDir, nocodeId);
  const candidates = await getNocodeOldVersionCandidates(nocodeDir);
  if (!candidates.length) {
    throw new Error(getRestoreBackupUnavailableMessage(nocodeId));
  }

  for (const candidate of candidates) {
    await backupCurrentNocodeMainFiles(nocodeDir);
    await cp(candidate.path, join(nocodeDir, MAIN_JSON_FILENAME));
    nocodeBodyCache.delete(nocodeDir);

    const body = await _getNocodeBody(nocodeDir);
    if (body) {
      return {
        body,
        restoredFrom: {
          order: candidate.order,
        },
      };
    }
  }

  throw new Error(getRestoreBackupUnavailableMessage(nocodeId));
}

async function _getNocodeBody(nocodeDir: string): Promise<NocodeBody> {
  const nocodeBody = await readNocodeBody(nocodeDir);
  if (!nocodeBody?.formData) {
    return nocodeBody;
  }

  // Keep disk main.json design-only, but continue exposing serial number
  // counters in runtime reads so existing runtime behaviors stay compatible.
  const runtimeState = await _getRuntimeState(nocodeDir);
  if (isRuntimeStateEmpty(runtimeState)) {
    return nocodeBody;
  }

  return mirrorRuntimeStateToNocodeBody(nocodeBody, runtimeState);
}

export async function validateSynchronization(nocodesDir: string, nocodeId: string, sign: string) {
  if (!nocodeId || !sign) return false;
  const nocodeBody = await readNocodeBody(join(nocodesDir, nocodeId));
  return !!nocodeBody?.sign && nocodeBody.sign === sign;
}

export class NocodeFile extends DepolyFile {
  async getNocodeBody(): Promise<NocodeBody> {
    return _getNocodeBody(this.unzipDir);
  }

  async readCatalog(): Promise<ProjectNode[]> {
    const catalogDir = join(this.unzipDir, "catalog");
    if (!existsSync(catalogDir)) {
      return null;
    }
    const catalogJson = JSON.parse(await readFile(catalogDir, "utf-8"));
    return catalogJson;
  }
}
