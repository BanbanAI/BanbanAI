import {
  PROJECT_PARAMS_UID,
  type Bucket,
  type Connection,
  type ConnectionData,
  type OptionFieldUID,
  type OptionTableUID,
  type ProjectBody,
  type QueryOptions,
  type Soul,
} from "@common/types/project";
import type { NocodeBody } from "@common/types/nocode";
import { getBoardConnectionsByNocodeBody } from "@common/utils/connection";
import { getBoardsForWidgetLoad, getProjectFirstScreenBoardIds } from "@renderer/b2/utils/widget-load.util";
import {
  buildBoardConnectionsWithAggregateTables,
  type AggregateRuntimeSource,
} from "@renderer/utils/aggregateTable";
import {
  extendConnectionsWithTableAggregateFields,
  mergeBucketsWithTableAggregateFields,
  type TableAggregateRuntimeSource,
} from "@renderer/utils/tableAggregateField";
import { formDataApi } from "@renderer/utils/api/form-data";
import {
  createKeyedSingleFlightRunner,
  resolveRefreshOptionTableUIDs,
  waitForAll,
} from "@renderer/b2/utils/auto-refresh.util";

export type RuntimeSource = AggregateRuntimeSource & TableAggregateRuntimeSource;

type ProjectBoardsLike = Pick<ProjectBody, "boards" | "foreboard" | "backboard">;

type SoulLike = Pick<Soul, "options"> & {
  widgets?: SoulLike[],
};

type LoadBuckets = (options: {
  nocodeId: string,
  tableUIDs: string[],
  options?: QueryOptions,
}) => Promise<Bucket[]>;

export type RuntimeConnectionLoaderOptions = {
  currentConnectionUID?: string,
  currentNocodeId?: string,
  getRuntimeSources: () => RuntimeSource[],
  projectConnectionData: ConnectionData,
  mergedConnectionData: ConnectionData,
  loadBuckets?: LoadBuckets,
};

export const resetConnectionData = (target: ConnectionData) => {
  Object.keys(target).forEach(key => delete target[key]);
};

export const buildRuntimeSources = (
  body?: Pick<NocodeBody, "formData" | "otherDataSources">,
  currentNocodeId?: string,
): RuntimeSource[] => {
  const sources: RuntimeSource[] = [];

  if (body?.formData?.uid) {
    sources.push({
      uid: body.formData.uid,
      nocodeId: currentNocodeId,
      tables: body.formData.tables || [],
      aggregateTables: body.formData.aggregateTables || [],
      metas: body.formData.metas || {},
    });
  }

  (body?.otherDataSources || []).forEach(source => {
    if (!source?.uid) return;
    sources.push({
      uid: source.uid,
      nocodeId: source.nocodeId,
      tables: source.tables || [],
      aggregateTables: (source as any).aggregateTables || [],
      metas: source.metas || {},
    });
  });

  return sources;
};

export const buildRuntimeBoardConnections = (
  body?: Pick<NocodeBody, "connections" | "formData" | "otherDataSources">,
  currentNocodeId?: string,
  projectName?: string,
  runtimeSources: RuntimeSource[] = [],
) => {
  const connectionsWithAggregateTable = buildBoardConnectionsWithAggregateTables(getBoardConnectionsByNocodeBody(body, {
    nocodeId: currentNocodeId,
    name: projectName,
  }), runtimeSources);
  return extendConnectionsWithTableAggregateFields(connectionsWithAggregateTable, runtimeSources);
};

export const getRuntimeSourceAggregateFieldSignature = (source?: Pick<RuntimeSource, "tables" | "metas">) => {
  return (source?.tables || []).map(table => ({
    uid: table.uid,
    aggregateFields: (source?.metas?.[table.uid]?.aggregateFields || []).map(field => ({
      uid: field.uid,
      mode: field.mode,
      formula: field.formula || "",
      singleFieldConfig: field.singleFieldConfig ? {
        aggregate: field.singleFieldConfig.aggregate,
        fieldUID: field.singleFieldConfig.fieldUID,
        subFieldUID: field.singleFieldConfig.subFieldUID,
      } : null,
    })),
  }));
};

const isOptionUID = (value: unknown): value is OptionTableUID | OptionFieldUID => {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === "string"
    && typeof value[1] === "string";
};

const buildOptionTableKey = (optionTableUID?: OptionTableUID) => {
  if (!optionTableUID?.[0] || !optionTableUID?.[1]) return "";
  return `${optionTableUID[0]}__${optionTableUID[1]}`;
};

const parseOptionTableKey = (value: string): OptionTableUID | undefined => {
  const [connectionUID, tableUID] = value.split("__");
  if (!connectionUID || !tableUID) return undefined;
  return [connectionUID, tableUID];
};

const collectOptionTableUIDsFromValue = (value: any, addTableUID: (optionTableUID?: OptionTableUID) => void) => {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach(item => collectOptionTableUIDsFromValue(item, addTableUID));
    return;
  }

  if (typeof value !== "object") return;

  if (isOptionUID(value.uid)) {
    addTableUID([value.uid[0], value.uid[1]]);
  }

  if (typeof value.connection === "string" && typeof value.table === "string" && value.table !== PROJECT_PARAMS_UID) {
    addTableUID([value.connection, value.table]);
  }

  Object.keys(value).forEach(key => {
    if (key === "uid") return;
    collectOptionTableUIDsFromValue(value[key], addTableUID);
  });
};

const collectSoulOptionTableUIDs = (
  soul: SoulLike | undefined,
  addTableUID: (optionTableUID?: OptionTableUID) => void,
) => {
  if (!soul) return;

  collectOptionTableUIDsFromValue(soul.options, addTableUID);

  for (const widget of soul.widgets || []) {
    collectSoulOptionTableUIDs(widget, addTableUID);
  }

};

export const collectRuntimeOptionTableUIDsFromProject = (
  project: ProjectBoardsLike | undefined,
  options: {
    boardIds?: string[],
  } = {},
) => {
  if (!project) return [];

  const tableUIDMap = new Map<string, OptionTableUID>();
  const addTableUID = (optionTableUID?: OptionTableUID) => {
    if (!optionTableUID?.[0] || !optionTableUID?.[1]) return;
    if (optionTableUID[1] === PROJECT_PARAMS_UID) return;
    tableUIDMap.set(buildOptionTableKey(optionTableUID), [optionTableUID[0], optionTableUID[1]]);
  };

  const boards = getBoardsForWidgetLoad(project, {
    boardIds: options.boardIds || getProjectFirstScreenBoardIds(project),
  }) as SoulLike[];

  boards.forEach(board => collectSoulOptionTableUIDs(board, addTableUID));

  return Array.from(tableUIDMap.values());
};

export function createRuntimeConnectionLoader(options: RuntimeConnectionLoaderOptions) {
  const loadedTableKeys = new Set<string>();
  const loadingPromises = new Map<string, Promise<Bucket | undefined>>();
  const loadBuckets = options.loadBuckets || formDataApi.getData;

  const getCurrentConnectionUID = () => options.currentConnectionUID;

  const getRuntimeSource = (sourceUID?: string) => {
    return options.getRuntimeSources().find(source => source.uid === sourceUID);
  };

  const getTargetNocodeId = (source?: RuntimeSource) => {
    return source?.nocodeId || options.currentNocodeId || "";
  };

  const ensureSourceBuckets = (sourceUID: string) => {
    if (!options.mergedConnectionData[sourceUID]) {
      options.mergedConnectionData[sourceUID] = [];
    }

    const mergedBuckets = options.mergedConnectionData[sourceUID];
    if (sourceUID === getCurrentConnectionUID()) {
      options.projectConnectionData[sourceUID] = mergedBuckets;
    }

    return mergedBuckets;
  };

  const writeBucketToCache = (sourceUID: string, bucket?: Bucket) => {
    if (!bucket) return undefined;

    const buckets = ensureSourceBuckets(sourceUID);
    const targetIndex = buckets.findIndex(item => item.tableId === bucket.tableId);
    if (targetIndex > -1) {
      buckets[targetIndex] = bucket;
    } else {
      buckets.push(bucket);
    }

    return bucket;
  };

  const loadBucket = async (optionTableUID: OptionTableUID, queryOptions?: QueryOptions) => {
    const source = getRuntimeSource(optionTableUID?.[0]);
    const nocodeId = getTargetNocodeId(source);
    if (!source || !nocodeId) return undefined;

    const buckets = await loadBuckets({
      nocodeId,
      tableUIDs: [optionTableUID[1]],
      options: queryOptions,
    });

    return mergeBucketsWithTableAggregateFields(source.uid, buckets || [], {
      sources: options.getRuntimeSources(),
    })[0];
  };

  const loadAndCacheBucket = (optionTableUID: OptionTableUID) => {
    const tableKey = buildOptionTableKey(optionTableUID);
    const loadingPromise = loadBucket(optionTableUID).then(bucket => {
      if (bucket) {
        loadedTableKeys.add(tableKey);
        return writeBucketToCache(optionTableUID[0], bucket);
      }
      return undefined;
    }).finally(() => {
      if (loadingPromises.get(tableKey) === loadingPromise) loadingPromises.delete(tableKey);
    });

    loadingPromises.set(tableKey, loadingPromise);
    return loadingPromise;
  };

  const forceLoadBucket = createKeyedSingleFlightRunner(async (
    tableKey: string,
    optionTableUID: OptionTableUID,
  ) => {
    const loadingPromise = loadingPromises.get(tableKey);
    if (loadingPromise) await loadingPromise;
    return await loadAndCacheBucket(optionTableUID);
  });

  const ensureConnectionBucket = async (
    optionTableUID?: OptionTableUID,
    config: { force?: boolean } = {},
  ) => {
    if (!optionTableUID?.[0] || !optionTableUID?.[1]) return undefined;

    const tableKey = buildOptionTableKey(optionTableUID);
    if (!tableKey) return undefined;

    if (config.force) {
      return await forceLoadBucket(tableKey, optionTableUID);
    }

    if (loadedTableKeys.has(tableKey)) {
      const buckets = options.mergedConnectionData[optionTableUID[0]] || [];
      return buckets.find(bucket => bucket.tableId === optionTableUID[1]);
    }

    if (loadingPromises.has(tableKey)) {
      return loadingPromises.get(tableKey);
    }

    return await loadAndCacheBucket(optionTableUID);
  };

  const preloadOptionTableUIDs = async (optionTableUIDs: OptionTableUID[] = []) => {
    const uniqueOptionTableUIDs = Array.from(new Map(
      optionTableUIDs
        .filter(optionTableUID => optionTableUID?.[0] && optionTableUID?.[1])
        .map(optionTableUID => [buildOptionTableKey(optionTableUID), optionTableUID]),
    ).values());

    await Promise.all(uniqueOptionTableUIDs.map(optionTableUID => ensureConnectionBucket(optionTableUID)));
  };

  const refreshConnectionData = async (optionTableUIDs?: OptionTableUID[]) => {
    const loadedOptionTableUIDs = Array.from(loadedTableKeys)
      .map(parseOptionTableKey)
      .filter((optionTableUID): optionTableUID is OptionTableUID => !!optionTableUID);

    const refreshOptionTableUIDs = resolveRefreshOptionTableUIDs(loadedOptionTableUIDs, optionTableUIDs);

    await waitForAll(refreshOptionTableUIDs.map(optionTableUID => ensureConnectionBucket(optionTableUID, {
      force: true,
    })));
  };

  const readDataByOptions = async (optionTableUID?: OptionTableUID, queryOptions?: QueryOptions) => {
    if (!optionTableUID?.[0] || !optionTableUID?.[1]) return undefined;
    return await loadBucket(optionTableUID, queryOptions);
  };

  const reset = () => {
    loadedTableKeys.clear();
    loadingPromises.clear();
    forceLoadBucket.clear();
    resetConnectionData(options.projectConnectionData);
    resetConnectionData(options.mergedConnectionData);
  };

  return {
    reset,
    ensureConnectionBucket,
    preloadOptionTableUIDs,
    refreshConnectionData,
    readDataByOptions,
    getLoadedTableKeys() {
      return Array.from(loadedTableKeys);
    },
  };
}
