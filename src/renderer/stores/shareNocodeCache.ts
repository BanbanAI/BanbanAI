import { Nocode, NocodeBody, NocodeCoverSummary, NocodeImportState, NocodeMeta } from "@common/types/nocode";
import axios from "axios";
import { ElMessage } from "element-plus";
import { defineStore } from "pinia";
import {
  type FetchOptions,
  clearBucket,
  createCacheBucket,
  fetchWithCache,
  getCacheKey,
  getOrCreateEntry,
  hasValidCache,
  installRouteDirtyHook,
  markBucketDirty,
} from "./runtimeCache";

type ShareNocode = Nocode & {
  importState?: NocodeImportState;
};

export type ShareNocodeSummary = {
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
};

const mapShareNocodesToMetas = (shareNocodes?: ShareNocode[]) => {
  return (shareNocodes || []).map((item) => item.meta);
};

const SHARE_NOCODE_METAS_KEY = getCacheKey({
  hasBody: false,
});

const SHARE_NOCODES_KEY = getCacheKey({
  hasBody: true,
});

const SHARE_NOCODE_SUMMARIES_KEY = getCacheKey({
  summary: true,
});

export const useShareNocodeCacheStore = defineStore("shareNocodeCache", () => {
  const shareNocodeMetasCache = createCacheBucket<NocodeMeta[]>();
  const shareNocodesCache = createCacheBucket<ShareNocode[]>();
  const shareNocodeSummariesCache = createCacheBucket<ShareNocodeSummary[]>();

  const syncShareNocodeMetasCache = (shareNocodes?: ShareNocode[]) => {
    const entry = getOrCreateEntry(shareNocodeMetasCache, SHARE_NOCODE_METAS_KEY);
    entry.data = mapShareNocodesToMetas(shareNocodes);
    entry.updatedAt = Date.now();
    entry.dirty = shareNocodesCache[SHARE_NOCODES_KEY]?.dirty ?? false;
  };

  const requestShareNocodeMetas = async () => {
    try {
      const { data } = await axios.get("/project/get-share-nocodes-by-account-id");
      return data as NocodeMeta[];
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message);
      return void 0;
    }
  };

  const requestShareNocodes = async () => {
    try {
      const { data } = await axios.get("/project/get-share-nocodes-by-account-id", {
        params: {
          hasBody: true,
        },
      });
      return data as ShareNocode[];
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message);
      return void 0;
    }
  };

  const requestShareNocodeSummaries = async () => {
    try {
      const { data } = await axios.get("/project/get-share-nocode-summaries-by-account-id");
      return data as ShareNocodeSummary[];
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.message);
      return void 0;
    }
  };

  const getShareNocodeMetas = async (options?: FetchOptions) => {
    const shareNocodesEntry = shareNocodesCache[SHARE_NOCODES_KEY];
    if (!options?.force) {
      if (shareNocodesEntry?.pending) {
        const pendingShareNocodes = await shareNocodesEntry.pending;
        if (pendingShareNocodes) {
          syncShareNocodeMetasCache(pendingShareNocodes);
          return mapShareNocodesToMetas(pendingShareNocodes);
        }
      }

      if (shareNocodesEntry && hasValidCache(shareNocodesEntry)) {
        const shareNocodeMetas = mapShareNocodesToMetas(shareNocodesEntry.data);
        syncShareNocodeMetasCache(shareNocodesEntry.data);
        return shareNocodeMetas;
      }
    }

    return (await fetchWithCache({
      bucket: shareNocodeMetasCache,
      key: SHARE_NOCODE_METAS_KEY,
      request: requestShareNocodeMetas,
      options,
      keepDirtyOnFallback: true,
    })) ?? [];
  };

  const getShareNocodes = async (options?: FetchOptions) => {
    const shareNocodes = (await fetchWithCache({
      bucket: shareNocodesCache,
      key: SHARE_NOCODES_KEY,
      request: requestShareNocodes,
      options,
      keepDirtyOnFallback: true,
    })) ?? [];
    if (shareNocodes.length || shareNocodesCache[SHARE_NOCODES_KEY]?.data) {
      syncShareNocodeMetasCache(shareNocodes);
    }
    return shareNocodes;
  };

  const getShareNocodeSummaries = async (options?: FetchOptions) => {
    return (await fetchWithCache({
      bucket: shareNocodeSummariesCache,
      key: SHARE_NOCODE_SUMMARIES_KEY,
      request: requestShareNocodeSummaries,
      options,
      keepDirtyOnFallback: true,
    })) ?? [];
  };

  const patchShareNocodeSummary = (nocodeId: string, updater: (current: ShareNocodeSummary) => ShareNocodeSummary) => {
    const entry = shareNocodeSummariesCache[SHARE_NOCODE_SUMMARIES_KEY];
    if (!entry?.data?.length) {
      return;
    }

    entry.data = entry.data.map((item) => {
      if (item.meta.id !== nocodeId) {
        return item;
      }
      return updater(item);
    });
    entry.updatedAt = Date.now();
    entry.dirty = false;
  };

  const markShareNocodeMetasDirty = () => {
    markBucketDirty(shareNocodeMetasCache, SHARE_NOCODE_METAS_KEY);
  };

  const markShareNocodesDirty = () => {
    markBucketDirty(shareNocodesCache, SHARE_NOCODES_KEY);
  };

  const markShareNocodeSummariesDirty = () => {
    markBucketDirty(shareNocodeSummariesCache, SHARE_NOCODE_SUMMARIES_KEY);
  };

  const markAllDirty = () => {
    markShareNocodeMetasDirty();
    markShareNocodesDirty();
    markShareNocodeSummariesDirty();
  };

  const clearShareNocodeMetasCache = () => {
    clearBucket(shareNocodeMetasCache);
  };

  const clearShareNocodesCache = () => {
    clearBucket(shareNocodesCache);
  };

  const clearShareNocodeSummariesCache = () => {
    clearBucket(shareNocodeSummariesCache);
  };

  const clearAllCache = () => {
    clearShareNocodeMetasCache();
    clearShareNocodesCache();
    clearShareNocodeSummariesCache();
  };

  const getShareNocodeMetasCache = () => {
    return shareNocodeMetasCache[SHARE_NOCODE_METAS_KEY]?.data;
  };

  const getShareNocodesCache = () => {
    return shareNocodesCache[SHARE_NOCODES_KEY]?.data;
  };

  const getShareNocodeSummariesCache = () => {
    return shareNocodeSummariesCache[SHARE_NOCODE_SUMMARIES_KEY]?.data;
  };

  const isShareNocodeMetasDirty = () => {
    return shareNocodeMetasCache[SHARE_NOCODE_METAS_KEY]?.dirty ?? true;
  };

  const isShareNocodesDirty = () => {
    return shareNocodesCache[SHARE_NOCODES_KEY]?.dirty ?? true;
  };

  const isShareNocodeSummariesDirty = () => {
    return shareNocodeSummariesCache[SHARE_NOCODE_SUMMARIES_KEY]?.dirty ?? true;
  };

  installRouteDirtyHook("shareNocodeCache", markAllDirty);

  return {
    shareNocodeMetasCache,
    shareNocodesCache,
    shareNocodeSummariesCache,
    getShareNocodeMetas,
    getShareNocodes,
    getShareNocodeSummaries,
    patchShareNocodeSummary,
    getShareNocodeMetasCache,
    getShareNocodesCache,
    getShareNocodeSummariesCache,
    isShareNocodeMetasDirty,
    isShareNocodesDirty,
    isShareNocodeSummariesDirty,
    markShareNocodeMetasDirty,
    markShareNocodesDirty,
    markShareNocodeSummariesDirty,
    markAllDirty,
    clearShareNocodeMetasCache,
    clearShareNocodesCache,
    clearShareNocodeSummariesCache,
    clearAllCache,
  };
});
